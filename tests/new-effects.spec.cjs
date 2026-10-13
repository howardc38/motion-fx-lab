const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

async function openLab(page, mode) {
  await page.goto("/examples/stack-lab/#" + mode);
  await page.waitForFunction(
    () =>
      window.demoLab &&
      document.getElementById("backend").textContent !== "INITIALIZING",
  );
}

test("all six optical effects move and survive backward seeks and shared-context interleaving", async ({
  page,
}) => {
  await page.goto("/examples/optical.html");
  const results = await page.evaluate(() => {
    const { frames, canvas, modes } = opticalDemo;
    opticalDemo.pause();
    return modes.map((mode, i) => {
      frames[i](2.1);
      const first = canvas.toDataURL();
      frames[i](5.4);
      const later = canvas.toDataURL();
      frames.forEach((frame) => frame(6.2));
      frames[i](2.1);
      const again = canvas.toDataURL();
      frames[i](2.1, 0.3);
      const weaker = canvas.toDataURL();
      return {
        mode,
        moves: first !== later,
        repeatable: first === again,
        adjustable: first !== weaker,
      };
    });
  });
  expect(results).toHaveLength(6);
  for (const result of results)
    expect(result, result.mode).toMatchObject({
      moves: true,
      repeatable: true,
      adjustable: true,
    });
});

test("optical export supplies working audio and GIF contracts to the full build", async ({
  page,
}) => {
  await page.goto("/examples/optical.html");
  const spec = await page.evaluate(() => ({
    dur: __DUR,
    cues: __cues(),
    music: window.__music,
    gif: window.__gif,
    poster: __poster,
  }));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "optical-audio-test-"));
  try {
    const cues = path.join(work, "cues.json"),
      audio = path.join(work, "music.wav");
    fs.writeFileSync(cues, JSON.stringify(spec));
    // This is the build's real consumer; a metadata-only assertion missed the
    // missing music plan even though all video-frame tests passed.
    execFileSync(
      "python3",
      [path.resolve(__dirname, "../video/music.py"), cues, audio],
      { timeout: 60000 },
    );
    expect(fs.statSync(audio).size).toBeGreaterThan(48000 * 18);
    expect(spec.gif).toHaveLength(6);
    for (const [start, end] of spec.gif) {
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      expect(end).toBeLessThanOrEqual(spec.dur);
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

test("optical effects keep their build, hit and aftermath contracts and the sampler tiles the film", async ({ page }) => {
  await page.goto("/examples/optical.html");
  const r = await page.evaluate(() => {
    opticalDemo.pause();
    const { frames, modes } = opticalDemo;
    const f = (m) => frames[modes.indexOf(m)];
    return {
      slit: [0.5, 3, 6.5].map((t) => f("slit").proof(t)),
      moire: [0.5, 2, 3, 4, 5.8, 7.6].map((t) => f("moire").proof(t)),
      foil: [0.5, 1.2].map((t) => f("foil").proof(t)),
      segments: opticalDemo.segments,
      dur: __DUR,
    };
  });
  // Slit-scan: the plain source at 0.5 s and 6.5 s; at 3 s the first letter recurs at
  // three or more spin angles and the light's trail crosses at least 40% of the frame.
  expect(r.slit[0].delta).toBe(0);
  expect(r.slit[2].delta).toBe(0);
  expect(r.slit[1].tRuns.length).toBeGreaterThanOrEqual(3);
  expect(new Set(r.slit[1].tRuns.map((run) => run.angle)).size).toBeGreaterThanOrEqual(3);
  expect(r.slit[1].orbTrailOfWidth).toBeGreaterThanOrEqual(0.4);
  // Moiré: one layer at 0.5 s; broad fringes (at least 10% of the width) from 2 to 4 s;
  // aligned and still at 5.8 s, when the hidden word cannot be seen; withdrawn by 7.6 s.
  expect(r.moire[0].pose[0]).toBeGreaterThan(1.5);
  for (const p of r.moire.slice(1, 4)) {
    expect(p.aligned).toBe(false);
    expect(p.fringePeriodOfWidth).toBeGreaterThanOrEqual(0.1);
  }
  expect(r.moire[4].aligned).toBe(true);
  expect(r.moire[5].presence).toBe(0);
  // Foil: matte at 0.5 s; the spectral band crosses the card centre near 1.2 s.
  expect(Math.abs(r.foil[0].sweep)).toBeGreaterThan(0.3);
  expect(Math.abs(r.foil[1].sweep)).toBeLessThan(0.08);
  // The sampler's segments tile the whole film, one per effect.
  expect(r.segments.map((s) => s.id)).toEqual(["optical-foil", "optical-slit", "optical-moire", "optical-ribbon", "optical-caustic", "optical-morph"]);
  expect(r.segments[0].start).toBe(0);
  for (let i = 1; i < r.segments.length; i++) expect(r.segments[i].start).toBeCloseTo(r.segments[i - 1].end, 6);
  expect(r.segments.at(-1).end).toBeCloseTo(r.dur, 6);
});

test("intro tells three film stories with native frames and reproducible seeks", async ({page}) => {
  await page.goto("/video/intro.html");
  await page.evaluate(async()=>{await __ready;await __record();});
  const result=await page.evaluate(async()=>{
    await __render(20.4);const host=document.querySelector('#dialogue-shot').getBoundingClientRect(),canvas=document.querySelector('#dialogue-shot canvas').getBoundingClientRect();const actionFill=[canvas.width/host.width,canvas.height/host.height];
    const samples=[];
    for(const t of [27,33.1,34,36.7,38,40.3,45.3,46.5,48,49.4]){
      await __render(t);samples.push({t,...await introProof()});
    }
    await __render(37.8);const first=document.querySelector('#word-shot canvas').toDataURL();
    await __render(40);await __render(37.8);
    return {samples,actionFill,repeat:first===document.querySelector('#word-shot canvas').toDataURL(),gpu:__REQUIRES_WEBGPU};
  });
  expect(result.gpu).toBe(false);expect(result.repeat).toBe(true);expect(result.actionFill).toEqual([1,1]);
  expect(result.samples.find(s=>s.t===33.1).worlds).toMatchObject({phase:'overview',count:20});
  expect(result.samples.find(s=>s.t===36.7).word.phase).toBe('contours');
  expect(result.samples.find(s=>s.t===38).word.phase).toBe('glitch');
  expect(result.samples.find(s=>s.t===40.3).word.phase).toBe('resolved');
  expect(result.samples.find(s=>s.t===45.3).chain.fallen).toBe(48);
  expect(result.samples.find(s=>s.t===46.5).edit.word).toBe('WAVE');
  expect(result.samples.find(s=>s.t===48).edit.word).toBe('FLOW');
  expect(result.samples.find(s=>s.t===49.4).edit.exported).toBe(true);
  await expect(page.locator('#scLib')).toContainText('73 effect techniques');
  expect(await page.locator('#scStacks').count()).toBe(0);
});

test("missing Flubber fails visibly without disabling Canvas effects", async ({
  page,
}) => {
  await page.route("**/flubber@0.4.2/**", (route) => route.abort());
  await page.goto("/examples/optical.html");
  await page.getByRole("button", { name: "Path morph", exact: true }).click();
  await expect(page.locator("#error")).toContainText("Flubber");
  await page.getByRole("button", { name: "Paper ribbon", exact: true }).click();
  await expect(page.locator("#error")).toBeEmpty();
});

test("Pixi frame(t) switches filters and reproduces earlier pixels", async ({
  page,
}) => {
  await openLab(page, "pixi");
  const proof = await page.evaluate(async () => {
    const d = await FXStack.create("pixi");
    await d.frame(3);
    const a = d.canvas.toDataURL(),
      filters = d.proof().filterClasses;
    await d.frame(0.8);
    const b = d.canvas.toDataURL();
    await d.frame(3);
    return { changed: a !== b, repeats: a === d.canvas.toDataURL(), filters };
  });
  expect(proof).toEqual({
    changed: true,
    repeats: true,
    filters: ["DisplacementFilter", "BlurFilter", "ColorMatrixFilter"],
  });
});

test("Rapier frame(t) propagates collisions and resets for backward seeks and changed speed", async ({
  page,
}) => {
  await openLab(page, "rapier");
  const r = await page.evaluate(async () => {
    const d = await FXStack.create("rapier");
    await d.frame(0);
    const a = d.proof();
    await d.frame(2);
    const b = d.proof();
    await d.frame(7.5);
    const c = d.proof();
    await d.frame(0);
    await d.frame(7.5);
    const e = d.proof();
    await d.frame(2, { speed: 0.5 });
    const slow = d.proof();
    return {
      initial: a.fallen,
      middle: b.fallen,
      end: c.fallen,
      repeats: JSON.stringify(c.positions) === JSON.stringify(e.positions),
      slowSteps: slow.steps,
    };
  });
  expect(r).toMatchObject({
    initial: 0,
    end: 48,
    repeats: true,
    slowSteps: 120,
  });
  expect(r.middle).toBeGreaterThan(0);
  expect(r.middle).toBeLessThan(48);
});

test("WebGPU frame(t) updates real storage and reproduces state after non-monotonic seeks", async ({
  page,
}) => {
  await openLab(page, "gpu");
  if (
    !(await page.evaluate(() => !!demoLab.current)) &&
    process.env.REQUIRE_WEBGPU !== "1"
  )
    test.skip(true, "A real WebGPU adapter is required");
  const r = await page.evaluate(async () => {
    const d = await FXStack.create("gpu");
    await d.frame(0);
    const a = await d.proof();
    await d.frame(2);
    const b = await d.proof();
    await d.frame(6);
    const c = await d.proof();
    await d.frame(2);
    const e = await d.proof();
    return { a, b, c, e };
  });
  expect(r.b).toMatchObject({
    isWebGPU: true,
    count: 65536,
    steps: 240,
    finite: true,
  });
  expect(r.b.sample).not.toEqual(r.a.sample);
  expect(r.c.finite).toBe(true);
  expect(r.e.sample).toEqual(r.b.sample);
});

test("film page switches the visible canvas instead of leaving stale GPU frames on top", async ({
  page,
}) => {
  await page.goto("/examples/stacks.html");
  await page.evaluate(async () => {
    await __ready;
    await __record();
  });
  for (const t of [20, 0, 10, 2]) {
    await page.evaluate((t) => __render(t), t);
    await expect(page.locator("#frame canvas:visible")).toHaveCount(1);
    const backend = await page.evaluate(() => {
      const e = stackFilm.effects.find((e) => !e.canvas.hidden);
      return e.backend;
    });
    expect(backend).toContain(t < 7 ? "PIXI" : t < 16 ? "RAPIER" : "WEBGPU");
  }
});

test("WebGPU unavailability is explicit and another demo can still load", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", {
      value: undefined,
      configurable: true,
    }),
  );
  await openLab(page, "gpu");
  await expect(page.locator("#backend")).toHaveText(
    "UNAVAILABLE — NO FALLBACK",
  );
  await expect(page.locator("#error")).toContainText("WebGPU");
  await page.getByRole("button", { name: /PixiJS/ }).click();
  await expect(page.locator("#backend")).toContainText("PIXI 8.22.0");
  await expect(page.locator("#error")).toBeEmpty();
});

test("stack player fits mobile and pause prevents simulation from advancing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await openLab(page, "pixi");
  const result = await page.evaluate(async () => {
    demoLab.pause();
    const t = demoLab.current.time;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    return {
      width: innerWidth,
      content: document.documentElement.scrollWidth,
      t,
      after: demoLab.current.time,
    };
  });
  expect(result.content).toBeLessThanOrEqual(result.width);
  expect(result.after).toBe(result.t);
});

test("recorder awaits asynchronous frames before every screenshot", async ({
  page,
}) => {
  const root = path.resolve(__dirname, "..");
  const args = [
    "video/record.cjs",
    "frames",
    "tests/fixtures/async-frame.html",
    "0",
    ".1",
    ".2",
    ...(process.platform === "darwin" ? [] : ["--cpu"]),
  ];
  execFileSync(process.execPath, args, { cwd: root, timeout: 30000 });
  const files = ["t000.00.png", "t000.10.png", "t000.20.png"].map((n) =>
    fs
      .readFileSync(path.join(root, "video/stills/async-frame", n))
      .toString("base64"),
  );
  const colors = await page.evaluate(async (files) => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const result = [];
    for (const data of files) {
      const img = new Image();
      img.src = "data:image/png;base64," + data;
      await img.decode();
      g.drawImage(img, 0, 0);
      result.push([...g.getImageData(20, 20, 1, 1).data]);
    }
    return result;
  }, files);
  expect(colors).toEqual([
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
  ]);
});

test("a rejected asynchronous frame stops encoding and removes partial output", () => {
  const root = path.resolve(__dirname, ".."),
    work = fs.mkdtempSync(path.join(os.tmpdir(), "failed-frame-")),
    out = path.join(work, "failed.mkv");
  try {
    const result = spawnSync(
      process.execPath,
      [
        "video/record.cjs",
        "video",
        "tests/fixtures/rejected-frame.html",
        out,
        "--workers",
        "2",
        ...(process.platform === "darwin" ? [] : ["--cpu"]),
      ],
      { cwd: root, encoding: "utf8", timeout: 30000 },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("injected asynchronous frame failure");
    expect(fs.existsSync(out)).toBe(false);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
});

test('recorder refuses a destroyed WebGPU device without publishing a movie',async({page})=>{
  await page.goto('/tests/fixtures/async-frame.html');
  const supported=await page.evaluate(async()=>!!(navigator.gpu&&await navigator.gpu.requestAdapter()));
  if(!supported&&process.env.REQUIRE_WEBGPU!=='1')test.skip(true,'WebGPU unavailable');
  expect(supported).toBe(true);
  const root=path.resolve(__dirname,'..'),work=fs.mkdtempSync(path.join(os.tmpdir(),'lost-gpu-')),out=path.join(work,'failed.mkv');
  try{
    const result=spawnSync(process.execPath,['video/record.cjs','video','tests/fixtures/lost-device.html',out,'--workers','2'],{cwd:root,encoding:'utf8',timeout:30000});
    expect(result.error).toBeUndefined();expect(result.status).toBe(1);expect(result.stderr).toContain('WebGPU device lost');expect(fs.existsSync(out)).toBe(false);
  }finally{fs.rmSync(work,{recursive:true,force:true});}
});

test("optical gallery frames preserve default strength across absolute-time loops", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.galleryAPI);
  const proof = await page.evaluate(async () => {
    galleryAPI.pause();
    // Gallery canvases follow FX_RENDER_SIZE; the reference must use the same size.
    const reference = document.createElement("canvas");
    reference.width = window.FX_RENDER_SIZE?.w || 1120;
    reference.height = window.FX_RENDER_SIZE?.h || 630;
    const direct = FXOptical.create(reference, "ribbon");
    direct(0.5);
    const expected = reference.toDataURL();
    direct(2.5);
    const changed = reference.toDataURL();
    const frames = [];
    for (const absoluteTime of [0.5, 8.5]) {
      const { stage } = await galleryAPI.draw("optical-ribbon", absoluteTime);
      frames.push(stage.querySelector("canvas").toDataURL());
    }
    return {
      moves: expected !== changed,
      matchesDefault: frames.map(frame => frame === expected),
      repeats: frames[0] === frames[1],
    };
  });
  expect(proof).toEqual({ moves: true, matchesDefault: [true, true], repeats: true });
});
