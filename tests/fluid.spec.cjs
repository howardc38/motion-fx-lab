const { test, expect } = require("@playwright/test");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  os = require("node:os"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  ids = ["overflow", "viscous", "smoke"];
test('an empty still-frame request is rejected before opening Blender work', () => {
  const script="import runpy,sys,types;sys.modules['bpy']=types.SimpleNamespace();sys.modules['mathutils']=types.SimpleNamespace(Vector=object);sys.argv=['render.py','--','--recipe','overflow','--work','unused','--stills',''];runpy.run_path('tools/blender/render.py',run_name='__main__')";
  const r=spawnSync('python3',['-c',script],{cwd:root,encoding:'utf8',timeout:10000});
  expect(r.status).toBe(2);expect(r.stderr).toContain('Specify one or more integer frame numbers');
});
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
    for (const [file, expected] of [[m.sourceScript || 'tools/blender/scenes.py', m.sourceScriptSha256], [m.renderSource.script, m.renderSource.scriptSha256]])
      expect(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')).toBe(expected);
    if (id === 'overflow') {
      expect(proof.initialWaterVolume).toBeGreaterThan(.5);
      for (const sample of proof.samples) {
        expect(sample.meshVolume).toBeGreaterThanOrEqual(proof.initialWaterVolume * .7);
        expect(sample.poolHeight).toBeGreaterThan(.8);
      }
      expect(proof.samples.at(-1).poolHeight).toBeGreaterThanOrEqual(1.17);
    }
    if (id !== 'smoke') {
      expect(m.meshSource.script).toBe('tools/blender/finish-mesh.py');
      expect(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,m.meshSource.script))).digest('hex')).toBe(m.meshSource.scriptSha256);
      expect(m.version).toMatch(/^[0-9a-f]{16}$/);
      expect(m.pattern).toBe(`frame-%06d.jpg?v=${m.version}`);
      await page.route(`**/assets/fluid/${id}/frame-*.jpg`, r => r.fulfill({status:404, body:'Old cached frame URL'}));
    }
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
  await page.route("**/assets/fluid/smoke/manifest.json*", (r) =>
    r.fulfill({ status: 404, body: "missing" }),
  );
  await page.goto("/examples/fluid-smoke.html");
  await expect(page.locator("#error")).toContainText("Missing frame manifest");
});

test('failed water retention or rim evidence cannot replace the previous source', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fluid-proof-')), work=path.join(dir,'work'), out=path.join(dir,'published');
  fs.mkdirSync(work);fs.mkdirSync(out);fs.writeFileSync(path.join(out,'keep.txt'),'previous source');
  const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
  const write=(name,data)=>fs.writeFileSync(path.join(work,name),JSON.stringify(data));
  write('receipt.json',{recipe:'overflow',revision:2,bakedData:true,frameStart:1,frameEnd:289,fps:30,resolution:128,script:'tools/blender/liquid-scenes.py',scriptSha256:hash('tools/blender/liquid-scenes.py')});
  write('render-receipt.json',{width:1280,height:720,frames:289,fps:30,script:'tools/blender/render.py',scriptSha256:hash('tools/blender/render.py')});
  write('mesh-receipt.json',{script:'tools/blender/finish-mesh.py',scriptSha256:hash('tools/blender/finish-mesh.py'),particleRadius:1.7});
  try {
    for(const [height,volume] of [[.4,1],[1.1,1],[1.2,.1],[null,1]]) {
      write('simulation-proof.json',{domain:'LIQUID',resolution:128,width:1280,height:720,meshParticleRadius:1.7,initialWaterVolume:1,samples:Array.from({length:4},()=>({vertices:100,meshVolume:volume,poolHeight:height}))});
      const r=spawnSync('python3',['tools/blender/publish-frames.py',work,out,'--replace'],{cwd:root,encoding:'utf8',timeout:10000});
      expect(r.status).not.toBe(0);expect(r.stderr).toContain('Water retention or rim-height evidence');
      expect(fs.readdirSync(out)).toEqual(['keep.txt']);expect(fs.readFileSync(path.join(out,'keep.txt'),'utf8')).toBe('previous source');
    }
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

for (const defect of ["corrupt", "wrong-size", "modified-after-render"])
  test(`publisher preserves the previous bundle when a middle PNG is ${defect}`, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fluid-png-")),
      work = path.join(dir, "work"), out = path.join(dir, "published"),
      frames = path.join(work, "frames"), source = path.join(root, "assets/fluid/overflow");
    fs.mkdirSync(frames, { recursive: true }); fs.mkdirSync(out);
    fs.writeFileSync(path.join(out, "keep.txt"), "previous source");
    fs.mkdirSync(path.join(out, "nested")); fs.writeFileSync(path.join(out, "nested/frame.jpg"), "previous image");
    for (const file of ["receipt.json", "simulation-proof.json", "render-receipt.json", "mesh-receipt.json"])
      if (fs.existsSync(path.join(source, file))) fs.copyFileSync(path.join(source, file), path.join(work, file));
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
