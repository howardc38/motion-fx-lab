const { test, expect } = require("@playwright/test");
const fs = require("node:fs"),
  path = require("node:path"),
  os = require("node:os");
const { spawnSync } = require("node:child_process");
async function open(page) {
  await page.goto("/examples/studio.html");
  await page.waitForFunction(() => window.studio?.current);
}

test("14 studio demos move and reproduce their own frames after backward seeks", async ({
  page,
}) => {
  await open(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const results = await page.evaluate(async () => {
    const out = [];
    for (const s of FXStudio.studies) {
      const e = await FXStudio.create(s.id),
        t = s.id === "time-remap" ? 0.4 : s.hero;
      await e.frame(t);
      const a = e.canvas.toDataURL();
      await e.frame(t + 0.8);
      const b = e.canvas.toDataURL();
      await e.frame(t);
      out.push({
        id: s.id,
        moves: a !== b,
        repeat: a === e.canvas.toDataURL(),
      });
    }
    return out;
  });
  expect(results).toHaveLength(14);
  for (const r of results)
    expect(r, r.id).toMatchObject({ moves: true, repeat: true });
  expect(errors).toEqual([]);
});
test("twenty distinct art directions are presets, not extra gallery registrations", async ({
  page,
}) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { themes } = await import("/fx/studio/themes.js");
    const e = await FXStudio.create("themes"),
      images = [];
    for (let i = 0; i < 20; i++) {
      await e.frame(2, { theme: i });
      images.push(e.canvas.toDataURL());
    }
    return {
      names: themes.map((t) => t.name),
      unique: new Set(images).size,
      count: FXStudio.studies.length,
    };
  });
  expect(result.names).toHaveLength(20);
  expect(new Set(result.names).size).toBe(20);
  expect(result.unique).toBe(20);
  expect(result.count).toBe(14);
});
test("RGBA sequence has exact frame indexing, stable decoding and real transparency", async ({
  page,
}) => {
  await open(page);
  const p = await page.evaluate(async () => {
    const { FrameSource } = await import("/fx/studio/frame-source.js");
    const s = await FrameSource.load(
      new URL("/assets/studio/fight/manifest.json", location),
    );
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
    return {
      fps: s.data.fps,
      start: s.indexAt(-1),
      next: s.indexAt(1 / 24),
      last: s.indexAt(99),
      count: s.data.count,
      repeat: a === c.toDataURL(),
      transparent: alpha.some((x) => x === 0),
      opaque: alpha.some((x) => x === 255),
    };
  });
  expect(p).toMatchObject({
    fps: 24,
    start: 0,
    next: 1,
    repeat: true,
    transparent: true,
    opaque: true,
  });
  expect(p.last).toBe(p.count - 1);
});
test("point identity follows source cells instead of randomizing every sample", async ({
  page,
}) => {
  await open(page);
  const r = await page.evaluate(async () => {
    const { PointField } = await import("/fx/studio/point-field.js");
    const pixels = new Uint8Array([
      20, 30, 40, 255, 50, 60, 70, 0, 80, 90, 100, 0, 110, 120, 130, 255,
    ]);
    const f = new PointField().sample(pixels, 2, 2, 1),
      ids = [...f.ids];
    pixels[0] = 220;
    pixels[12] = 4;
    f.sample(pixels, 2, 2, 1);
    return { ids, after: [...f.ids], color: f.rgba[0] };
  });
  expect(r).toEqual({ ids: [0, 3], after: [0, 3], color: 220 });
});
test("source time can hold while output time advances, and reverse moves backwards", async ({
  page,
}) => {
  await open(page);
  const p = await page.evaluate(async () => {
    const e = await FXStudio.create("time-remap");
    await e.frame(7.4);
    const a = e.canvas.toDataURL(),
      pa = e.proof();
    await e.frame(7.9);
    const b = e.canvas.toDataURL(),
      pb = e.proof();
    await e.frame(10);
    const r1 = e.proof().sourceIndex;
    await e.frame(10.8);
    return {
      hold: a === b,
      indexA: pa.sourceIndex,
      indexB: pb.sourceIndex,
      r1,
      r2: e.proof().sourceIndex,
    };
  });
  expect(p.hold).toBe(true);
  expect(p.indexA).toBe(p.indexB);
  expect(p.r2).toBeLessThan(p.r1);
});
test("real GLB surface points animate, while freeze orbit changes only camera", async ({
  page,
}) => {
  await open(page);
  const r = await page.evaluate(async () => {
    const e = await FXStudio.create("skin-cloud");
    await e.frame(0.4);
    const a = e.proof();
    await e.frame(1.2);
    const b = e.proof();
    const orbit = await FXStudio.create("freeze-orbit");
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
  const header = fs
    .readFileSync(path.resolve(__dirname, "../assets/studio/fighter.glb"))
    .subarray(0, 4)
    .toString();
  expect(header).toBe("glTF");
});
test("2.5D mode remains explicitly labelled as relief rather than recovered anatomy", async ({
  page,
}) => {
  await open(page);
  const p = await page.evaluate(async () => {
    const e = await FXStudio.create("depth-dots");
    await e.frame(2);
    return e.proof();
  });
  expect(p.depth).toContain("not recovered geometry");
  expect(p.dots).toBeGreaterThan(100);
});
test("invalid source import cannot delete an existing output sequence", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "clip-import-"));
  try {
    const out = path.join(temp, "frames");
    fs.mkdirSync(out);
    fs.writeFileSync(path.join(out, "keep"), "original");
    const r = spawnSync(
      "python3",
      [
        path.resolve(__dirname, "../video/import-clip.py"),
        path.join(temp, "absent.mp4"),
        out,
        "--replace",
      ],
      { encoding: "utf8", timeout: 10000 },
    );
    expect(r.status).not.toBe(0);
    expect(fs.readFileSync(path.join(out, "keep"), "utf8")).toBe("original");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('battle film has authored attacks, independent instances and a repeatable contact hold', async ({page}) => {
  await page.goto('/examples/dot-battle.html');
  await page.evaluate(async()=>{await __ready;await __record();});
  const result=await page.evaluate(async()=>{
    const film=filmEffect;
    await __render(.6); const contact=film.canvas.toDataURL(); const pose=film.proof();
    await __render(3); const kick=film.canvas.toDataURL();
    await __render(.6); const again=film.canvas.toDataURL();
    const other=await FXStudio.create('dot-battle'); await other.frame(3);
    return {duration:__DUR, cues:__cues().length, changes:contact!==kick,repeat:contact===again,independent:other.canvas!==film.canvas,pose};
  });
  expect(result).toMatchObject({duration:19.2,cues:27,changes:true,repeat:true,independent:true});
});
