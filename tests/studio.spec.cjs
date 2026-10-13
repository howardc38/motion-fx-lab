const { test, expect } = require("@playwright/test");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { spawnSync } = require("node:child_process");
async function open(page) {
  await page.goto("/examples/studio.html");
  await page.waitForFunction(() => window.studio?.current);
}
const range = (a, b, step) => Array.from({ length: Math.round((b - a) / step) }, (_, i) => +(a + i * step).toFixed(4));

test("13 studio demos move and reproduce their own frames after backward seeks", async ({ page }) => {
  test.setTimeout(180000);
  await open(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const results = await page.evaluate(async () => {
    const out = [];
    for (const s of FXStudio.studies) {
      const e = await FXStudio.create(s.id), t = s.hero;
      await e.frame(t);
      const a = e.canvas.toDataURL();
      await e.frame(t + 0.8);
      const b = e.canvas.toDataURL();
      await e.frame(t);
      out.push({ id: s.id, moves: a !== b, repeat: a === e.canvas.toDataURL() });
    }
    return out;
  });
  expect(results.map((r) => r.id)).toEqual(["portal", "themes", "gallery", "lowpoly", "video-dots", "dot-rhythm", "dot-impact", "echo", "time-remap", "depth-dots", "skin-cloud", "freeze-orbit", "particle-lens"]);
  for (const r of results) expect(r, r.id).toMatchObject({ moves: true, repeat: true });
  expect(errors).toEqual([]);
});
test("gallery tiles show the raw effect at tile resolution, not the comparison template", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.galleryAPI);
  await page.evaluate(() => galleryAPI.pause());
  for (const id of ["studio-video-dots", "studio-echo", "studio-skin-cloud", "studio-freeze-orbit"]) {
    const r = await page.evaluate(async (id) => {
      const inst = await galleryAPI.draw(id, FXCatalog.byId.get(id).hero);
      const c = inst.stage.querySelector("canvas"), box = inst.stage.getBoundingClientRect();
      return { width: c.width, height: c.height, css: box.width, dpr: devicePixelRatio, oops: !!inst.stage.querySelector(".oops") };
    }, id);
    expect(r.oops, id).toBe(false);
    expect(r.width, id).toBe(Math.max(320, Math.min(1280, Math.round((r.css * r.dpr) / 16) * 16)));
    expect(r.width / r.height).toBeCloseTo(16 / 9, 3);
  }
  // The input/effect comparison stays available in the studio player.
  expect(await page.evaluate(() => Object.keys(FXStudio.previews).length)).toBe(9);
});
test("twenty distinct art directions are presets, not extra gallery registrations", async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { themes } = await import("/fx/studio/themes.js");
    const e = await FXStudio.create("themes"), images = [];
    for (let i = 0; i < 20; i++) {
      await e.frame(2, { theme: i });
      images.push(e.canvas.toDataURL());
    }
    return { names: themes.map((t) => t.name), unique: new Set(images).size, count: FXStudio.studies.length, flight: FXStudio.studies.some((s) => s.id === "flight") };
  });
  expect(result.names).toHaveLength(20);
  expect(new Set(result.names).size).toBe(20);
  expect(result.unique).toBe(20);
  expect(result.count).toBe(13);
  expect(result.flight).toBe(false);
});
test("halftone close-up: ≥3 CSS px dot pitch in a tile, ≥3:1 dot diameters, ≥4 palette changes per loop", async ({ page }) => {
  await open(page);
  const p = await page.evaluate(async () => {
    const e = await FXStudio.create("video-dots"), rows = [];
    for (let t = 0; t < 4.8; t += 0.1) { await e.frame(t); rows.push(e.proof()); }
    const r = await FXStudio.create("dot-rhythm"), cuts = [];
    for (let t = 0; t < 4.8; t += 0.15) { await r.frame(t); cuts.push(r.proof().palette); }
    return { rows, cuts };
  });
  expect((p.rows[0].pitch * 382) / 1280).toBeGreaterThanOrEqual(3);
  expect(Math.min(...p.rows.map((r) => r.diameterRatio))).toBeGreaterThanOrEqual(3);
  const changes = p.rows.slice(1).filter((r, i) => r.palette !== p.rows[i].palette).length;
  expect(changes).toBeGreaterThanOrEqual(4);
  expect(p.rows.every((r) => r.subject === "Apricot")).toBe(true);
  expect(p.cuts.slice(1).filter((c, i) => c !== p.cuts[i]).length).toBeGreaterThanOrEqual(4);
});
test("time echoes: hold fans ≥5 layers beyond the subject width; four clock states are distinct", async ({ page }) => {
  await open(page);
  const p = await page.evaluate(async (times) => {
    const e = await FXStudio.create("echo"), rows = [];
    for (const t of times) { await e.frame(t); rows.push({ t, ...e.proof() }); }
    const remap = await FXStudio.create("time-remap"), steps = [];
    for (const t of [3.92, 3.98, 4.1, 4.2]) { await remap.frame(t); steps.push(remap.proof()); }
    return { rows, steps };
  }, range(0, 6, 0.1));
  const at = (t) => p.rows.find((r) => Math.abs(r.t - t) < 1e-6);
  const hero = at(3.1);
  expect(hero.state).toBe("HOLD");
  expect(hero.layers).toBeGreaterThanOrEqual(5);
  expect(hero.farthest).toBeGreaterThanOrEqual(hero.subjectWidth);
  expect(at(2.6).sourceTime).toBe(at(3.3).sourceTime);
  expect(at(3.8).sourceTime).toBeLessThan(at(3.5).sourceTime);
  expect(new Set(p.rows.map((r) => r.state))).toEqual(new Set(["NORMAL", "SLOW", "HOLD", "REVERSE", "RAMP"]));
  // Slow motion carries a longer, denser trail than normal playback.
  expect(at(2.0).layers).toBeGreaterThan(at(0.5).layers);
  expect(p.rows[0].sourceTime).toBe(0);
  expect(p.steps[0].sourceTime).toBe(p.steps[1].sourceTime);
  expect(p.steps[2].sourceTime).toBeGreaterThan(p.steps[0].sourceTime);
  expect(p.steps.every((s) => s.state === "STEPS")).toBe(true);
});
test("RGBA sequence has exact frame indexing, stable decoding and real transparency", async ({ page }) => {
  await open(page);
  const p = await page.evaluate(async () => {
    const { FrameSource } = await import("/fx/studio/frame-source.js");
    const s = await FrameSource.load(new URL("/assets/studio/fight/manifest.json", location));
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 360;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(await s.at(1.2), 0, 0);
    const a = c.toDataURL(),
      alpha = g.getImageData(0, 0, 640, 360).data.filter((_, i) => i % 4 === 3);
    await s.at(4);
    g.clearRect(0, 0, 640, 360);
    g.drawImage(await s.at(1.2), 0, 0);
    return { fps: s.data.fps, start: s.indexAt(-1), next: s.indexAt(1 / 24), last: s.indexAt(99), count: s.data.count, repeat: a === c.toDataURL(), transparent: alpha.some((x) => x === 0), opaque: alpha.some((x) => x === 255) };
  });
  expect(p).toMatchObject({ fps: 24, start: 0, next: 1, repeat: true, transparent: true, opaque: true });
  expect(p.last).toBe(p.count - 1);
});
test("point identity follows source cells instead of randomizing every sample", async ({ page }) => {
  await open(page);
  const r = await page.evaluate(async () => {
    const { PointField } = await import("/fx/studio/point-field.js");
    const pixels = new Uint8Array([20, 30, 40, 255, 50, 60, 70, 0, 80, 90, 100, 0, 110, 120, 130, 255]);
    const f = new PointField().sample(pixels, 2, 2, 1), ids = [...f.ids];
    pixels[0] = 220;
    pixels[12] = 4;
    f.sample(pixels, 2, 2, 1);
    return { ids, after: [...f.ids], color: f.rgba[0] };
  });
  expect(r).toEqual({ ids: [0, 3], after: [0, 3], color: 220 });
});
test("legacy footage clock: source time holds while output advances, and reverse moves backwards", async ({ page }) => {
  await open(page);
  const p = await page.evaluate(async () => {
    const e = await FXStudio.create("time-remap", { legacy: true });
    await e.frame(7.4);
    const a = e.canvas.toDataURL(), pa = e.proof();
    await e.frame(7.9);
    const b = e.canvas.toDataURL(), pb = e.proof();
    await e.frame(10);
    const r1 = e.proof().sourceIndex;
    await e.frame(10.8);
    return { hold: a === b, indexA: pa.sourceIndex, indexB: pb.sourceIndex, r1, r2: e.proof().sourceIndex };
  });
  expect(p.hold).toBe(true);
  expect(p.indexA).toBe(p.indexB);
  expect(p.r2).toBeLessThan(p.r1);
});
test("skinned point cloud: attached points, ≥40% of the loop scattered, near bokeh ≥4× far", async ({ page }) => {
  test.setTimeout(120000);
  await open(page);
  const p = await page.evaluate(async (times) => {
    const e = await FXStudio.create("skin-cloud"), rows = [];
    for (const t of times) { await e.frame(t); const q = e.proof(); rows.push({ t, scattered: q.scattered, ratio: q.bokeh.ratio, solid: q.solid, sample: q.sample, points: q.points }); }
    const lens = await FXStudio.create("particle-lens");
    await lens.frame(1);
    return { rows, lens: lens.proof() };
  }, range(0, 6, 0.1));
  const at = (t) => p.rows.find((r) => Math.abs(r.t - t) < 1e-6);
  expect(at(0.4).points).toBeGreaterThan(12000);
  expect(at(1.5).sample).not.toEqual(at(1.8).sample);
  expect(at(0.3).solid).toBe(true);
  expect(p.rows.filter((r) => r.scattered > 0.05).length / p.rows.length).toBeGreaterThanOrEqual(0.4);
  expect(Math.max(...p.rows.map((r) => r.ratio))).toBeGreaterThanOrEqual(4);
  expect(at(3.2).ratio).toBeGreaterThanOrEqual(4);
  expect(at(5.9).scattered).toBe(0);
  expect(p.lens.mode).toBe("particle-lens");
});
test("freeze-orbit: a held 3D pose, ≥10 frozen debris, an arc ≥180° and no silhouette overlap ≥50%", async ({ page }) => {
  test.setTimeout(120000);
  await open(page);
  const p = await page.evaluate(async () => {
    const m = await import("/fx/studio/freeze.js"), e = await m.createFreezeOrbit(), rows = [];
    for (const t of [2.3, 3.4, 4.9]) { await e.frame(t); rows.push(e.proof()); }
    await e.frame(1.0); const live = e.proof();
    const arc = [];
    for (let deg = -22; deg <= 208; deg += 23) arc.push(e.measure(deg));
    return { rows, live, arc, start: m.orbitAngle(m.FREEZE.start), end: m.orbitAngle(m.FREEZE.end - 1e-6), loop: [m.orbitAngle(0), m.orbitAngle(5.999999)] };
  });
  for (const r of p.rows) { expect(r.held).toBe(true); expect(r.sourceTime).toBe(p.rows[0].sourceTime); expect(r.debris).toBeGreaterThanOrEqual(10); }
  expect(p.rows[0].sample).toEqual(p.rows[2].sample);
  expect(p.rows[0].camera).not.toEqual(p.rows[1].camera);
  expect(p.live.held).toBe(false);
  expect(p.end - p.start).toBeGreaterThanOrEqual(180);
  expect(p.end - p.start).toBeLessThanOrEqual(270);
  expect(p.loop[1] - p.loop[0]).toBeCloseTo(360, 1);
  const largest = Math.max(...p.arc.map((a) => a.figure));
  for (const a of p.arc) {
    expect(a.overlap, `overlap at ${a.azimuth}°`).toBeLessThan(0.5);
    expect(a.figure / largest, `silhouette at ${a.azimuth}°`).toBeGreaterThan(0.5);
  }
});
test("image relief: drum hits extrude ≥15% of the portrait width; silent bars stay flat", async ({ page }) => {
  await open(page);
  const p = await page.evaluate(async (times) => {
    const e = await FXStudio.create("depth-dots"), rows = [];
    for (const t of times) { await e.frame(t); rows.push({ t, ...e.proof() }); }
    const legacy = await FXStudio.create("depth-dots", { legacy: true });
    await legacy.frame(2);
    return { rows, legacy: legacy.proof() };
  }, range(0, 6, 0.05));
  expect(Math.max(...p.rows.map((r) => r.extrusion))).toBeGreaterThanOrEqual(0.15);
  for (const r of p.rows.filter((r) => r.t < 0.8 || r.t > 4.7)) expect(r.flat, `t=${r.t}`).toBe(true);
  expect(Math.max(...p.rows.map((r) => Math.abs(r.cameraAngle)))).toBeGreaterThan(50);
  expect(p.rows[0].depth).toContain("not recovered geometry");
  expect(p.rows[0].dots).toBeGreaterThan(2000);
  expect(p.legacy.depth).toContain("not recovered geometry");
});
test("portal panels meet without gaps and the courier spans two worlds", async ({ page }) => {
  await open(page);
  const p = await page.evaluate(async () => {
    const e = await FXStudio.create("portal"), rows = [];
    // While the courier is wholly in frame (1.5–4.5 s) its body always crosses a seam.
    for (let t = 1.5; t <= 4.5; t += 0.1) { await e.frame(t); rows.push(e.proof().spans.length); }
    return rows;
  });
  for (const n of p) expect(n).toBeGreaterThanOrEqual(2);
});
test("legacy GLB surface points animate, while legacy freeze orbit changes only camera", async ({ page }) => {
  await open(page);
  const r = await page.evaluate(async () => {
    const e = await FXStudio.create("skin-cloud", { legacy: true });
    await e.frame(0.4);
    const a = e.proof();
    await e.frame(1.2);
    const b = e.proof();
    const orbit = await FXStudio.create("freeze-orbit", { legacy: true });
    await orbit.frame(2);
    const x = orbit.proof();
    await orbit.frame(4);
    const y = orbit.proof();
    return { a, b, x, y };
  });
  expect(r.a.points).toBe(16000);
  expect(r.a.sample).not.toEqual(r.b.sample);
  expect(r.x.sourceTime).toBe(0.6);
  expect(r.y.sample).toEqual(r.x.sample);
  expect(r.y.camera).not.toEqual(r.x.camera);
  const header = fs.readFileSync(path.resolve(__dirname, "../assets/studio/fighter.glb")).subarray(0, 4).toString();
  expect(header).toBe("glTF");
});
test("invalid source import cannot delete an existing output sequence", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "clip-import-"));
  try {
    const out = path.join(temp, "frames");
    fs.mkdirSync(out);
    fs.writeFileSync(path.join(out, "keep"), "original");
    const r = spawnSync("python3", [path.resolve(__dirname, "../video/import-clip.py"), path.join(temp, "absent.mp4"), out, "--replace"], { encoding: "utf8", timeout: 10000 });
    expect(r.status).not.toBe(0);
    expect(fs.readFileSync(path.join(out, "keep"), "utf8")).toBe("original");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("battle film has authored attacks, independent instances and a repeatable contact hold", async ({ page }) => {
  await page.goto("/examples/dot-battle.html");
  await page.evaluate(async () => { await __ready; await __record(); });
  const result = await page.evaluate(async () => {
    const film = filmEffect;
    await __render(0.6); const contact = film.canvas.toDataURL(); const pose = film.proof();
    await __render(3); const kick = film.canvas.toDataURL();
    await __render(0.6); const again = film.canvas.toDataURL();
    const other = await FXStudio.create("dot-battle"); await other.frame(3);
    return { duration: __DUR, cues: __cues().length, changes: contact !== kick, repeat: contact === again, independent: other.canvas !== film.canvas, pose };
  });
  expect(result).toMatchObject({ duration: 19.8, cues: 28, changes: true, repeat: true, independent: true });
});
