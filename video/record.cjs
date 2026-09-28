// Usage (page paths are relative to the current directory):
//   node record.cjs frames page.html 3.2 10 30.5 ...  -> PNG stills in video/stills/<name>/
//   node record.cjs cues   page.html out.json         -> sound cues, music sections and GIF clips
//   node record.cjs video  page.html master.mkv [--fps 30] [--workers 4] [--no-verify]
//                                                     -> frame-exact lossless silent master, BT.709
//   node record.cjs measure page.html t "css selector" ...
// Exit codes: 3 when the two renders of a verified video disagree (worth retrying), 1 otherwise.
// Every mode renders WebGL on the GPU through ANGLE Metal and refuses to run if the browser
// falls back to SwiftShader. --cpu renders on SwiftShader on purpose. One backend per run:
// the two do not produce the same pixels, so a run never mixes them.
const path = require("path");
const fs = require("fs");
const { spawn, spawnSync, execFileSync } = require("child_process");
const { pathToFileURL } = require("url");
const { chromium } = require("@playwright/test");

const url = (file) => pathToFileURL(path.resolve(file)).href;
const MINUTE = 60_000;

// Record every WebGL context the page creates, so each frame can prove none was lost.
// A lost context screenshots as a blank frame without any error (seen with 8 SwiftShader browsers).
function watchContexts() {
  const orig = HTMLCanvasElement.prototype.getContext;
  window.__gl = [];
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = orig.call(this, type, ...rest);
    if (ctx && /webgl/.test(type) && !window.__gl.includes(ctx)) window.__gl.push(ctx);
    return ctx;
  };
}

async function open(file, gpu) {
  const browser = await chromium.launch({ args: gpu ? ["--use-angle=metal"] : [] });
  const probe = await browser.newPage();
  await probe.goto(url(file), { waitUntil: "load" });
  const size = await probe.evaluate(() => window.__SIZE);
  const renderer = await probe.evaluate(() => {
    const g = document.createElement("canvas").getContext("webgl");
    if (!g) return null;
    const ext = g.getExtension("WEBGL_debug_renderer_info");
    return g.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : g.RENDERER);
  });
  await probe.close();
  const want = gpu ? /Metal/ : /SwiftShader/;
  if (!renderer || !want.test(renderer)) {
    await browser.close();
    throw new Error(`WebGL renderer is "${renderer}", expected ${want}; refusing to render`);
  }
  const page = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push("[console] " + m.text()); });
  page.on("pageerror", (e) => errors.push("[pageerror] " + e.message));
  await page.addInitScript(watchContexts);
  await page.goto(url(file), { waitUntil: "load" });
  await page.evaluate(() => window.__record());
  // A page with a WebGL layer builds its textures after its fonts; wait for it.
  await page.evaluate(() => (window.__ready ? window.__ready.then(() => true) : true));
  await page.evaluate(async () => {
    for (let t = 0; t <= window.__DUR; t += 0.25) window.__render(t);
    await document.fonts.ready;
  });
  // Every face the page used has loaded; a face still loading or failed would render a fallback.
  const unsettled = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loading" || f.status === "error").map((f) => `${f.family} ${f.weight} ${f.status}`));
  if (unsettled.length) throw new Error(`${file}: fonts not settled: ${unsettled.join(", ")}`);
  if (errors.length) throw new Error(`${file}: page reported errors while loading: ${errors.join(" | ")}`);
  const cdp = await page.context().newCDPSession(page);
  return { browser, page, cdp, size, renderer, errors };
}

// Page.captureScreenshot with optimizeForSpeed: still lossless PNG, about 2.4x faster than
// page.screenshot(), which does not pass that option.
async function shot(w, t) {
  const lost = await w.page.evaluate((time) => {
    window.__render(time);
    return window.__gl.filter((g) => g.isContextLost()).length;
  }, t);
  if (lost) throw new Error(`${lost} WebGL context(s) lost at t=${t}`);
  if (w.errors.length) throw new Error(`page reported errors at t=${t}: ${w.errors.join(" | ")}`);
  const { data } = await w.cdp.send("Page.captureScreenshot", {
    format: "png", optimizeForSpeed: true,
    clip: { x: 0, y: 0, width: w.size.w, height: w.size.h, scale: 1 },
  });
  return Buffer.from(data, "base64");
}

// One pass over every frame. Frames are dealt round-robin to independent browsers (tabs in one
// browser share its GPU process and barely help), starting at `offset`, and written in order
// to one ffmpeg through a small reorder buffer.
async function renderPass(ws, out, fps, dur, count, offset, label) {
  const n = ws.length;
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
    // RGB screenshots to BT.709 YUV, tagged as such; untagged video is read as BT.709 by browsers
    // anyway, so a BT.601 conversion showed #ff90e8 as #ff9fe8.
    "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
    // ffmpeg 8.1 drops -color_primaries/-color_trc here; x264 writes all three into the stream itself.
    "-colorspace", "bt709", "-color_range", "tv",
    "-c:v", "libx264", "-preset", "ultrafast", "-qp", "0", "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  let ffFailed = null;
  const ffClosed = new Promise((r) => ff.on("close", (code) => { if (code !== 0) ffFailed = `ffmpeg exited ${code}`; r(code); }));
  ff.stdin.on("error", (e) => { ffFailed = `ffmpeg stdin: ${e.message}`; });

  const pending = new Map();
  const wake = [];
  const ahead = n * 4;
  let next = 0, arrived = null;
  const writer = (async () => {
    while (next < count) {
      if (ffFailed) throw new Error(ffFailed);
      if (!pending.has(next)) { await new Promise((r) => { arrived = r; }); continue; }
      const buf = pending.get(next);
      pending.delete(next);
      next++;
      if (!ff.stdin.write(buf)) await Promise.race([new Promise((r) => ff.stdin.once("drain", r)), ffClosed]);
      wake.splice(0).forEach((r) => r());
    }
  })();

  const started = Date.now();
  await Promise.all([writer, ...ws.map(async (w, k) => {
    for (let i = (k - offset + n) % n; i < count; i += n) {
      while (i - next >= ahead) await new Promise((r) => wake.push(r));
      if (ffFailed) throw new Error(ffFailed);
      pending.set(i, await shot(w, Math.min(i / fps, dur)));
      if (arrived) { const r = arrived; arrived = null; r(); }
      if (i % (fps * 10) === 0) console.error(`${label} frame ${i}/${count - 1}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
    }
  })]);
  if (next !== count) throw new Error(`wrote ${next} of ${count} frames`);
  ff.stdin.end();
  await ffClosed;
  if (ffFailed) throw new Error(ffFailed);
  return (Date.now() - started) / 1000;
}

// Per-frame share of pixels that differ between two masters by more than `level` in any plane.
function diffCounts(a, b, level) {
  const lut = `gt(val\\,${level})*255`;
  const r = spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-i", a, "-i", b, "-lavfi",
    `[0][1]blend=all_mode=difference,lutyuv=y=${lut}:u=${lut}:v=${lut},signalstats,metadata=print`, "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 1 << 30, timeout: 30 * MINUTE });
  if (r.status !== 0) throw new Error(`ffmpeg compare failed: ${(r.stderr || "").slice(-400)}`);
  const frames = [];
  for (const block of r.stderr.split(/frame:(?=\d+ )/).slice(1)) {
    const n = +block.match(/^\d+/)[0];
    // signalstats prints small averages in %g form (6.9e-05); a missing key is an error, not zero.
    const v = (k) => {
      const m = block.match(new RegExp(`signalstats\\.${k}=([-+0-9.eE]+)`));
      if (!m) throw new Error(`ffmpeg compare printed no ${k} for frame ${n}`);
      return +m[1] / 255;
    };
    frames[n] = Math.max(v("YAVG"), v("UAVG"), v("VAVG"));
  }
  return frames;
}

// The GPU rasterises edges of rotated text, SVG strokes and GL points with a little noise from
// run to run (seen: 36 pixels at most 14 levels off; 5 pixels at most 43 off). Real differences
// cover an area: a missing line of text was 396 pixels, up to 165 off; a frame from the wrong t
// is 100,000+. Both limits count samples in the luma or either chroma plane: more than 0.01 %
// off by more than 8 levels, or more than 20 luma-sized samples off by more than 48, fails.
const OVER = 8, MAX_OVER_SHARE = 0.0001, STRONG = 48, MAX_STRONG_PX = 20;
const probeFrames = (file) => +execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_packets",
  "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", file], { timeout: 10 * MINUTE }).toString().trim();

async function video(file, out, fps, n, gpu, verify) {
  if (verify && n < 2) throw new Error("verification renders every frame on a second browser: use --workers 2 or more, or --no-verify");
  const ws = await Promise.all(Array.from({ length: n }, () => open(file, gpu)));
  const renderers = new Set(ws.map((w) => w.renderer));
  if (renderers.size !== 1) throw new Error(`workers disagree on the renderer: ${[...renderers].join(" / ")}`);
  const dur = await ws[0].page.evaluate(() => window.__DUR);
  const count = Math.round(dur * fps) + 1;
  const name = path.basename(file, ".html");
  console.error(`${name}: ${count} frames, ${n} browser(s), ${[...renderers][0]}`);

  const sec = await renderPass(ws, out, fps, dur, count, 0, name);
  const packets = probeFrames(out);
  if (packets !== count) throw new Error(`${out} holds ${packets} frames, expected ${count}`);

  let note = "not verified (--no-verify)";
  if (verify) {
    // Render everything again with every frame on a different browser, and compare all frames.
    // Now and then one of several parallel browsers draws web-font text wrongly for a stretch
    // of a run (cause not found; see README). Sampling missed it; a full second pass cannot.
    const again = out.replace(/(\.\w+)?$/, ".verify$1");
    try {
      const sec2 = await renderPass(ws, again, fps, dur, count, 1, `${name} verify`);
      if (probeFrames(again) !== count) throw new Error(`${again} does not hold ${count} frames`);
      const over = diffCounts(out, again, OVER), strong = diffCounts(out, again, STRONG);
      if (over.length !== count || strong.length !== count) throw new Error(`compared ${over.length} of ${count} frames`);
      const maxStrongShare = MAX_STRONG_PX / (ws[0].size.w * ws[0].size.h);
      const bad = [];
      for (let i = 0; i < count; i++) if (over[i] > MAX_OVER_SHARE || strong[i] > maxStrongShare) bad.push(i);
      if (bad.length) {
        const dir = path.join(__dirname, "mismatch");
        fs.mkdirSync(dir, { recursive: true });
        for (const i of bad.slice(0, 3)) for (const [src, tag] of [[out, "a"], [again, "b"]]) {
          execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", src, "-vf", `select=eq(n\\,${i})`, "-frames:v", "1",
            path.join(dir, `${name}_${i}_${tag}.png`)], { timeout: 10 * MINUTE });
        }
        const px = (s) => Math.round(s * ws[0].size.w * ws[0].size.h);
        const e = new Error(`${bad.length}/${count} frames differ between two renders (first: ${bad.slice(0, 8).map((i) => `${i} [${px(over[i])} px > ${OVER}, ${px(strong[i])} px > ${STRONG}]`).join(", ")}); ` +
          `the first three are saved in video/mismatch/`);
        e.exitCode = 3;
        throw e;
      }
      const worst = over.reduce((m, v, i) => (v > over[m] ? i : m), 0);
      note = `second render with every frame on another browser matches all ${count} frames (worst: frame ${worst}, ` +
        `${Math.round(over[worst] * ws[0].size.w * ws[0].size.h)} px > ${OVER}) in ${sec2.toFixed(1)}s`;
    } finally {
      fs.rmSync(again, { force: true });
    }
  }
  console.error(`${name}: ${count} frames in ${sec.toFixed(1)}s (${(sec * 1000 / count).toFixed(1)} ms/frame); ${note}`);
  await Promise.all(ws.map((w) => w.browser.close()));
}

(async () => {
  const argv = process.argv.slice(2);
  const flag = (name, def) => { const i = argv.indexOf(name); if (i < 0) return def; const v = argv[i + 1]; argv.splice(i, 2); return v; };
  const bool = (name) => { const i = argv.indexOf(name); if (i < 0) return false; argv.splice(i, 1); return true; };
  const gpu = !bool("--cpu");
  const verify = !bool("--no-verify");
  const fps = +flag("--fps", 30);
  // One render pass of a 56-second, 3D-heavy page on an M4 with 16 GB: 4 browsers 19.4 s, 6 20.1 s, 8 22.6 s.
  const workers = +flag("--workers", 4);
  if (!Number.isInteger(workers) || workers < 1 || !(fps > 0)) {
    throw new Error(`--workers needs a whole number >= 1 and --fps a positive number (got ${workers}, ${fps})`);
  }
  const [mode, file, ...rest] = argv;
  if (!["frames", "cues", "video", "measure"].includes(mode)) throw new Error(`usage: node record.cjs frames|cues|video|measure page.html ... (got ${mode})`);
  if (!file || !fs.existsSync(file)) throw new Error(`page not found: ${file} (paths are relative to ${process.cwd()})`);
  if ((mode === "video" || mode === "cues") && !rest[0]) throw new Error(`${mode} needs an output path`);
  if (mode === "video") {
    const out = rest[0];
    try { await video(file, out, fps, workers, gpu, verify); }
    catch (e) { fs.rmSync(out, { force: true }); throw e; }
    return;
  }
  const w = await open(file, gpu);
  const name = path.basename(file, ".html");
  if (mode === "frames") {
    const dir = path.join(__dirname, "stills", name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (const t of rest.map(Number)) {
      fs.writeFileSync(path.join(dir, `t${t.toFixed(2).padStart(6, "0")}.png`), await shot(w, t));
    }
  } else if (mode === "cues") {
    const cues = await w.page.evaluate(() => ({ dur: window.__DUR, cues: window.__cues(), music: window.__music || null, gif: window.__gif || null }));
    fs.writeFileSync(rest[0], JSON.stringify(cues, null, 1));
    console.error(`${cues.cues.length} cues`);
  } else if (mode === "measure") {
    const t = +rest[0];
    const out = await w.page.evaluate(({ t, sels }) => {
      window.__render(t);
      return sels.map((s) => {
        const el = document.querySelector(s);
        if (!el) return { s, missing: true };
        const b = el.getBoundingClientRect();
        return { s, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), cx: Math.round(b.x + b.width / 2), cy: Math.round(b.y + b.height / 2), bottom: Math.round(b.bottom), right: Math.round(b.right) };
      });
    }, { t, sels: rest.slice(1) });
    console.log(JSON.stringify(out, null, 1));
  } else {
    throw new Error(`unknown mode ${mode}`);
  }
  await w.browser.close();
})().catch((e) => { console.error(e.message || e); process.exit(e.exitCode || 1); });
