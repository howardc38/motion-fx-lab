// Record the real interactive backends. This is a browser recording, not the
// frame-exact recorder: it deliberately makes no cross-device pixel guarantee.
// Usage: node video/record-stacks.cjs [--out-dir path]
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "..");
const SEGMENTS = [
  { id: "pixi", seconds: 7, start: 0, title: "01 / PIXIJS - LIQUID POSTER" },
  { id: "rapier", seconds: 9, start: 7, title: "02 / RAPIER - CHAIN REACTION" },
  {
    id: "gpu",
    seconds: 8,
    start: 16,
    title: "03 / WEBGPU + TSL - ORBITAL MATTER",
  },
];
const ffmpeg = (...args) =>
  execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", ...args],
    { timeout: 180000, stdio: ["ignore", "pipe", "pipe"] },
  );

function serve() {
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".cjs": "text/plain",
    ".css": "text/css",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".mp4": "video/mp4",
  };
  return http.createServer(async (req, res) => {
    try {
      const file = path.resolve(
        ROOT,
        "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
      );
      if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      const stat = await fsp.stat(file);
      const target = stat.isDirectory() ? path.join(file, "index.html") : file;
      res.setHeader(
        "Content-Type",
        types[path.extname(target)] || "application/octet-stream",
      );
      const stream = fs.createReadStream(target);
      stream.on("error", () => {
        if (!res.headersSent) res.writeHead(404);
        res.end();
      });
      res.on("close", () => stream.destroy());
      stream.pipe(res);
    } catch {
      res.writeHead(404).end();
    }
  });
}

async function record(page, segment, work) {
  await page.evaluate((id) => demoLab.select(id), segment.id);
  await page.waitForFunction(() => !demoLab.busy);
  await page.evaluate(() => demoLab.pause());
  const state = await page.evaluate(() => {
    if (!demoLab.current)
      throw new Error(document.getElementById("error").textContent);
    return { backend: demoLab.current.backend };
  });
  const downloading = page.waitForEvent("download", { timeout: 30000 });
  const proof = await page.evaluate(async (segment) => {
    const demo = demoLab.current;
    await demo.reset();
    demo.parameter(segment.id === "pixi" ? 0.45 : 0.5);
    await demo.render();
    const before = await demo.proof();
    if (segment.id === "gpu" && !before.isWebGPU)
      throw new Error("Real WebGPU required; no substitute accepted");
    const output = document.createElement("canvas");
    output.width = 1280;
    output.height = 720;
    const g = output.getContext("2d"),
      stream = output.captureStream(30),
      chunks = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 7000000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    let active = true,
      changed = false,
      animation;
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = (e) =>
        reject(new Error(e.error?.message || "MediaRecorder failed"));
    });
    const start = performance.now();
    if (segment.id === "pixi") demo.action();
    function copy() {
      if (!active) return;
      const elapsed = performance.now() - start;
      if (
        !changed &&
        ((segment.id === "pixi" && elapsed >= 1400) ||
          (segment.id === "gpu" && elapsed >= 4500))
      ) {
        demo.action();
        changed = true;
      }
      g.drawImage(demo.canvas, 0, 0, 1280, 720);
      g.fillStyle = "#07110edd";
      g.fillRect(24, 650, 1232, 46);
      g.fillStyle = "#eaffdc";
      g.font = "500 18px monospace";
      g.textAlign = "left";
      g.fillText(segment.title, 42, 680);
      g.font = "500 14px monospace";
      g.textAlign = "right";
      g.fillText(
        segment.id === "pixi"
          ? changed
            ? "DISPLACEMENT + BLUR + COLOR"
            : "ORIGINAL / NO FILTERS"
          : segment.id === "gpu"
            ? changed
              ? "DISPERSAL / 65,536 PARTICLES"
              : "TRUE GPU COMPUTE / 65,536 PARTICLES"
            : demo.stats(),
        1238,
        679,
      );
      animation = requestAnimationFrame(copy);
    }
    try {
      copy();
      recorder.start(200);
      demoLab.play();
      await new Promise((resolve) =>
        setTimeout(resolve, segment.seconds * 1000),
      );
      demoLab.pause();
      recorder.stop();
      await stopped;
      const after = await demo.proof();
      if (segment.id === "rapier" && after.fallen !== 48)
        throw new Error("Recording too slow: domino chain did not complete");
      if (
        segment.id === "gpu" &&
        (!after.finite ||
          JSON.stringify(before.sample) === JSON.stringify(after.sample))
      )
        throw new Error("GPU buffer did not update correctly");
      const url = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
      const a = document.createElement("a");
      a.href = url;
      a.download = segment.id + ".webm";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return {
        backend: demo.backend,
        simulatedSeconds: demo.time,
        ...(segment.id === "gpu"
          ? { particles: after.count, isWebGPU: after.isWebGPU }
          : segment.id === "rapier"
            ? { fallen: after.fallen }
            : { filters: after.filterClasses }),
      };
    } finally {
      active = false;
      cancelAnimationFrame(animation);
      demoLab.pause();
      stream.getTracks().forEach((track) => track.stop());
    }
  }, segment);
  await (await downloading).saveAs(path.join(work, segment.id + ".webm"));
  console.log(`${segment.id}: ${state.backend}, ${segment.seconds}s captured`);
  return proof;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--out-dir"))
    throw new Error("Usage: node video/record-stacks.cjs [--out-dir path]");
  const out = args.length
    ? path.resolve(args[1])
    : path.join(ROOT, "examples/stack-lab");
  const work = await fsp.mkdtemp(
    path.join(os.tmpdir(), "motion-stack-capture-"),
  );
  const server = serve();
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    browser = await chromium.launch({
      args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
    });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1000 },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      acceptDownloads: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `http://127.0.0.1:${server.address().port}/examples/stack-lab/`,
    );
    await page.waitForFunction(
      () =>
        window.demoLab &&
        document.getElementById("backend").textContent !== "INITIALIZING",
    );
    const proofs = [];
    for (const segment of SEGMENTS)
      proofs.push(await record(page, segment, work));
    if (errors.length) throw new Error(errors.join("\n"));
    await browser.close();
    browser = null;
    const parts = SEGMENTS.map(
      (s, i) =>
        `[${i}:v]fps=30,tpad=stop_mode=clone:stop_duration=1,trim=duration=${s.seconds},setsar=1,setpts=PTS-STARTPTS[v${i}]`,
    );
    const preview = path.join(work, "preview.mp4");
    ffmpeg(
      ...SEGMENTS.flatMap((s) => ["-i", path.join(work, s.id + ".webm")]),
      "-filter_complex",
      parts.join(";") + ";[v0][v1][v2]concat=n=3:v=1:a=0,format=yuv420p[v]",
      "-map",
      "[v]",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "24",
      "-movflags",
      "+faststart",
      "-an",
      preview,
    );
    const meta = JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration:stream=width,height,nb_frames,r_frame_rate",
          "-of",
          "json",
          preview,
        ],
        { encoding: "utf8" },
      ),
    );
    if (+meta.format.duration !== 24 || +meta.streams[0].nb_frames !== 720)
      throw new Error("Preview must be 24 seconds / 720 frames");
    ffmpeg(
      "-ss",
      "19",
      "-i",
      preview,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      path.join(work, "poster.jpg"),
    );
    const atlases = SEGMENTS.map((s) => ({
      id: s.id,
      file: `atlas-${s.id}.jpg`,
      columns: 10,
      frames: s.seconds * 10,
      width: 480,
      height: 270,
    }));
    for (let i = 0; i < SEGMENTS.length; i++) {
      const s = SEGMENTS[i],
        a = atlases[i];
      ffmpeg(
        "-ss",
        String(s.start),
        "-t",
        String(s.seconds),
        "-i",
        preview,
        "-vf",
        `fps=10,scale=480:270:flags=lanczos,tile=10x${s.seconds}`,
        "-frames:v",
        "1",
        "-q:v",
        "3",
        path.join(work, a.file),
      );
    }
    const manifest = JSON.stringify(
      {
        width: 1280,
        height: 720,
        fps: 30,
        seconds: 24,
        segments: SEGMENTS.map((s, i) => ({
          id: s.id,
          start: s.start,
          seconds: s.seconds,
          proof: proofs[i],
          atlas: atlases[i],
        })),
      },
      null,
      2,
    );
    await fsp.writeFile(path.join(work, "capture.json"), manifest + "\n");
    // A classic script also works when the recorder opens intro.html over file:.
    await fsp.writeFile(
      path.join(work, "capture.js"),
      "// Generated by npm run record:stacks.\nwindow.FX_STACK_CAPTURE = " +
        manifest +
        ";\n",
    );
    await fsp.mkdir(out, { recursive: true });
    for (const name of [
      "preview.mp4",
      "poster.jpg",
      "capture.json",
      "capture.js",
      ...atlases.map((a) => a.file),
    ])
      await fsp.copyFile(path.join(work, name), path.join(out, name));
    console.log(
      `Verified 24s / 720 frames; preview, poster and 3 intro atlases -> ${out}`,
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await fsp.rm(work, { recursive: true, force: true });
  }
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.stack || e.message);
    process.exitCode = 1;
  });
