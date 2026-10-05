const { test, expect } = require("@playwright/test");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  os = require("node:os"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  ids = ["overflow", "viscous", "smoke"];
for (const id of ids)
  test(`baked ${id} source is complete, fingerprinted and randomly seekable`, async ({
    page,
  }) => {
    const dir = path.join(root, "assets/fluid", id),
      m = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")),
      proof = JSON.parse(
        fs.readFileSync(path.join(dir, "simulation-proof.json"), "utf8"),
      );
    expect(m).toMatchObject({
      fps: 30,
      count: 289,
      width: 1280,
      height: 720,
      alpha: "opaque",
      recipe: id,
    });
    expect(Object.keys(m.sourceFrameHashes)).toHaveLength(289);
    for (let i = 0; i < 289; i++) {
      const f = `frame-${String(i).padStart(6, "0")}.jpg`;
      expect(
        crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(dir, f)))
          .digest("hex"),
      ).toBe(m.sourceFrameHashes[f]);
    }
    if (id === "smoke") {
      expect(proof.samples[0].maxDensity).toBeGreaterThan(0);
      expect(proof.samples[1].maxDensity).toBeGreaterThan(0);
    } else proof.samples.forEach((s) => expect(s.vertices).toBeGreaterThan(8));
    await page.goto("/examples/fluid-" + id + ".html");
    const result = await page.evaluate(async () => {
      await __ready;
      await __record();
      await __render(2.1);
      const a = document.querySelector("canvas").toDataURL();
      await __render(8.3);
      const b = document.querySelector("canvas").toDataURL();
      await __render(2.1);
      return {
        repeat: a === document.querySelector("canvas").toDataURL(),
        moves: a !== b,
        proof: filmEffect.proof(),
      };
    });
    expect(result.repeat).toBe(true);
    expect(result.moves).toBe(true);
    expect(result.proof.sourceIndex).toBe(63);
    expect(result.proof.baked).toBe(true);
  });
test("an incomplete Blender render cannot replace an existing source asset", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluid-preserve-")),
    work = path.join(dir, "work"),
    out = path.join(dir, "published");
  fs.mkdirSync(work);
  fs.mkdirSync(out);
  fs.mkdirSync(path.join(work, "frames"));
  fs.writeFileSync(path.join(out, "keep.txt"), "previous source");
  const digest = (file) =>
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(root, file)))
      .digest("hex");
  fs.writeFileSync(
    path.join(work, "receipt.json"),
    JSON.stringify({
      recipe: "overflow",
      fps: 30,
      frameStart: 1,
      frameEnd: 289,
      resolution: 80,
      bakedData: true,
      scriptSha256: digest("tools/blender/scenes.py"),
    }),
  );
  fs.writeFileSync(
    path.join(work, "simulation-proof.json"),
    JSON.stringify({
      domain: "LIQUID", resolution: 80, width: 1280, height: 720,
      samples: Array.from({ length: 4 }, () => ({ vertices: 200 })),
    }),
  );
  fs.writeFileSync(
    path.join(work, "render-receipt.json"),
    JSON.stringify({
      script: "tools/blender/render.py",
      scriptSha256: digest("tools/blender/render.py"),
      width: 1280,
      height: 720,
      frames: 289,
      fps: 30,
    }),
  );
  try {
    const r = spawnSync(
      "python3",
      ["tools/blender/publish-frames.py", work, out, "--replace"],
      { cwd: root, encoding: "utf8", timeout: 10000 },
    );
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("Expected 289 source frames");
    expect(fs.readFileSync(path.join(out, "keep.txt"), "utf8")).toBe(
      "previous source",
    );
    expect(fs.readdirSync(out)).toEqual(["keep.txt"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("baked films reject a missing source instead of showing an empty success frame", async ({
  page,
}) => {
  await page.route("**/assets/fluid/smoke/manifest.json", (r) =>
    r.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto("/examples/fluid-smoke.html");
  await expect(page.locator("#error")).toContainText("Missing frame manifest");
});

for (const defect of ["corrupt", "wrong-size", "modified-after-render"])
  test(`publisher preserves the previous bundle when a middle PNG is ${defect}`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluid-png-")),
      work = path.join(dir, "work"), out = path.join(dir, "published"),
      frames = path.join(work, "frames"), source = path.join(root, "assets/fluid/overflow");
    fs.mkdirSync(frames, { recursive: true }); fs.mkdirSync(out);
    fs.writeFileSync(path.join(out, "keep.txt"), "previous source");
    fs.mkdirSync(path.join(out, "nested")); fs.writeFileSync(path.join(out, "nested/frame.jpg"), "previous image");
    for (const file of ["receipt.json", "simulation-proof.json", "render-receipt.json"])
      fs.copyFileSync(path.join(source, file), path.join(work, file));
    const now = Date.now() / 1000;
    fs.writeFileSync(path.join(work, "scene.blend"), "fixture");
    fs.utimesSync(path.join(work, "scene.blend"), now - 60, now - 60);
    try {
      const first = path.join(frames, "frame-0001.png");
      const makePNG = (file, size) => {
        const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", `color=black:s=${size}`, "-frames:v", "1", file], { encoding: "utf8" });
        expect(r.status, r.stderr).toBe(0);
      };
      makePNG(first, "1280x720");
      for (let i = 2; i <= 289; i++) fs.linkSync(first, path.join(frames, `frame-${String(i).padStart(4, "0")}.png`));
      const bad = path.join(frames, "frame-0144.png"); fs.unlinkSync(bad);
      if (defect === "corrupt") {
        const bytes = fs.readFileSync(first); bytes[bytes.length - 20] ^= 0xff;
        fs.writeFileSync(bad, bytes);
      } else if (defect === "wrong-size") makePNG(bad, "640x360");
      else fs.copyFileSync(first, bad);
      fs.utimesSync(path.join(work, "render-receipt.json"), now + 60, now + 60);
      if (defect === "modified-after-render") fs.utimesSync(bad, now + 120, now + 120);
      const r = spawnSync("python3", ["tools/blender/publish-frames.py", work, out, "--replace"], { cwd: root, encoding: "utf8", timeout: 15000 });
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain("frame-0144.png");
      expect(r.stderr).toContain(defect === "corrupt" ? "damaged" : defect === "wrong-size" ? "expected 1280x720, found 640x360" : "outside completed render");
      expect(fs.readdirSync(out).sort()).toEqual(["keep.txt", "nested"]);
      expect(fs.readFileSync(path.join(out, "keep.txt"), "utf8")).toBe("previous source");
      expect(fs.readFileSync(path.join(out, "nested/frame.jpg"), "utf8")).toBe("previous image");
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
