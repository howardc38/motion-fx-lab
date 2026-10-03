const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const backendArgs = process.platform === "darwin" ? [] : ["--cpu"];

test("failed render preserves an existing master and verification sibling", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "preserve-master-"));
  try {
    const out = path.join(dir, "master.mkv");
    const sibling = path.join(dir, "master.verify.mkv");
    fs.writeFileSync(out, "previous good master");
    fs.writeFileSync(sibling, "unrelated verification file");
    const result = spawnSync(process.execPath, [
      "video/record.cjs", "video", "tests/fixtures/rejected-frame.html",
      out, "--workers", "2", ...backendArgs,
    ], { cwd: root, encoding: "utf8", timeout: 30000 });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("injected asynchronous frame failure");
    expect(fs.readFileSync(out, "utf8")).toBe("previous good master");
    expect(fs.readFileSync(sibling, "utf8")).toBe("unrelated verification file");
    expect(fs.readdirSync(dir).sort()).toEqual(["master.mkv", "master.verify.mkv"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("successful verified render replaces only the destination master", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "publish-master-"));
  try {
    const out = path.join(dir, "master.mkv");
    const sibling = path.join(dir, "master.verify.mkv");
    fs.writeFileSync(out, "previous good master");
    fs.writeFileSync(sibling, "unrelated verification file");
    const result = spawnSync(process.execPath, [
      "video/record.cjs", "video", "tests/fixtures/async-frame.html",
      out, "--workers", "2", ...backendArgs,
    ], { cwd: root, encoding: "utf8", timeout: 60000 });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("matches all 7 frames");
    const probe = spawnSync("ffprobe", [
      "-v", "error", "-count_packets", "-select_streams", "v:0",
      "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", out,
    ], { encoding: "utf8", timeout: 10000 });
    expect(probe.status).toBe(0);
    expect(probe.stdout.trim()).toBe("7");
    expect(fs.readFileSync(sibling, "utf8")).toBe("unrelated verification file");
    expect(fs.readdirSync(dir).sort()).toEqual(["master.mkv", "master.verify.mkv"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("repeated music builds keep later drum gains and filter sweeps bounded", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "music-builds-"));
  try {
    // Exercise the real synthesizer with an initial drop and two later builds.
    // The old global first-build/first-drop ratio creates a negative cutoff.
    const spec = path.join(dir, "cues.json");
    const out = path.join(dir, "score.wav");
    fs.writeFileSync(spec, JSON.stringify({ dur: 14.4, music: [
      [0, "drop"], [2.4, "build"], [4.8, "drop"],
      [9.6, "build"], [12, "final"], [13.2, "tail"],
    ] }));
    const result = spawnSync("python3", ["video/music.py", spec, out], {
      cwd: root, encoding: "utf8", timeout: 60000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(Number(result.stdout.match(/peak ([\d.]+)/)?.[1])).toBeLessThan(2);
    const probe = spawnSync("ffprobe", [
      "-v", "error", "-show_entries", "stream=sample_rate,channels,duration",
      "-of", "json", out,
    ], { encoding: "utf8", timeout: 10000 });
    expect(probe.status).toBe(0);
    const stream = JSON.parse(probe.stdout).streams[0];
    expect(stream.sample_rate).toBe("48000");
    expect(stream.channels).toBe(2);
    expect(Number(stream.duration)).toBeCloseTo(15.4, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("line-printer artwork uses several glyph densities rather than solid @ cells", async ({ page }) => {
  await page.goto("/tests/fixtures/async-frame.html");
  const glyphs = await page.evaluate(async () => {
    const { flyer } = await import("/fx/studio/themes.js");
    const original = CanvasRenderingContext2D.prototype.fillText;
    const used = new Set();
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (/\b6px monospace$/.test(this.font)) used.add(text);
      return original.call(this, text, ...args);
    };
    try { flyer(15, 2); }
    finally { CanvasRenderingContext2D.prototype.fillText = original; }
    return [...used];
  });
  expect(glyphs.length).toBeGreaterThanOrEqual(3);
  for (const glyph of glyphs) expect("@#%*+:").toContain(glyph);
});

test("recorder rejects infinite FPS before starting browsers or touching a master", () => {
  const result = spawnSync(process.execPath, [
    "video/record.cjs", "video", "tests/fixtures/async-frame.html", "/unused.mkv", "--fps", "Infinity",
  ], { cwd: root, encoding: "utf8", timeout: 10000 });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("--fps a positive number");
});

test("bundle publisher rolls back earlier replacements when a later install fails", async () => {
  const { publishBundle } = require("../video/publish.cjs");
  const fsp = require("node:fs/promises");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-rollback-"));
  const source = path.join(dir, "new"), destination = path.join(dir, "published");
  fs.mkdirSync(source); fs.mkdirSync(destination);
  for (const name of ["film.mp4", "film.gif"]) {
    fs.writeFileSync(path.join(source, name), "new " + name);
    fs.writeFileSync(path.join(destination, name), "previous " + name);
  }
  fs.writeFileSync(path.join(destination, "retired.gif"), "previous retired preview");
  const rename = fsp.rename;
  fsp.rename = async (from, to) => {
    if (from.includes(path.sep + "next" + path.sep) && to === path.join(destination, "film.gif")) {
      throw new Error("injected second artifact install failure");
    }
    return rename(from, to);
  };
  try {
    await expect(publishBundle(source, destination, ["film.mp4", "film.gif"], ["retired.gif"]))
      .rejects.toThrow("injected second artifact install failure");
    for (const name of ["film.mp4", "film.gif"])
      expect(fs.readFileSync(path.join(destination, name), "utf8")).toBe("previous " + name);
    expect(fs.readFileSync(path.join(destination, "retired.gif"), "utf8")).toBe("previous retired preview");
    expect(fs.readdirSync(destination).sort()).toEqual(["film.gif", "film.mp4", "retired.gif"]);
  } finally {
    fsp.rename = rename;
  }
  try {
    await publishBundle(source, destination, ["film.mp4", "film.gif"], ["retired.gif"]);
    for (const name of ["film.mp4", "film.gif"])
      expect(fs.readFileSync(path.join(destination, name), "utf8")).toBe("new " + name);
    expect(fs.existsSync(path.join(destination, "retired.gif"))).toBe(false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("film build preserves failed bundles and removes a retired GIF only on success", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "film-bundle-"));
  try {
    for (const sub of ["video", "media", "bin"]) fs.mkdirSync(path.join(dir, sub));
    for (const file of ["build.sh", "publish.cjs", "gif.py"])
      fs.copyFileSync(path.join(root, "video", file), path.join(dir, "video", file));
    fs.writeFileSync(path.join(dir, "film.html"), "<!doctype html>");
    const artifacts = ["film.mp4", "film_hq.mp4", "film.jpg", "film.gif"];
    for (const name of artifacts) fs.writeFileSync(path.join(dir, "media", name), "previous " + name);
    fs.writeFileSync(path.join(dir, "media", "other.gif"), "unrelated preview");
    const python = spawnSync("python3", ["-c", "import sys; print(sys.executable)"], { encoding: "utf8" }).stdout.trim();
    // Substitute expensive encoders only; execute the production shell pipeline
    // and publisher, including the failure boundary after MP4/JPG delivery.
    const shim = path.join(dir, "bin", "runner");
    fs.writeFileSync(shim, `#!${process.execPath}
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const command=path.basename(process.argv[1]), a=process.argv.slice(2);
if(command==='node') {
  if(a[0]==='publish.cjs') { const r=cp.spawnSync(${JSON.stringify(process.execPath)},a,{stdio:'inherit'});process.exit(r.status); }
  fs.writeFileSync(a[3],a[1]==='cues'?'{"poster":0}':'new master');
} else if(command==='python3') {
  if(a[0]==='-c') console.log(0);
  else if(a[0]==='deliver.py') { for(const suffix of ['.mp4','_hq.mp4','.jpg']) fs.writeFileSync(path.join(a[3],a[4]+suffix),'new '+a[4]+suffix); }
  else if(a[0]==='gif.py') {
    if(process.env.NO_GIF==='1') {const r=cp.spawnSync(${JSON.stringify(python)},a,{stdio:'inherit'});process.exit(r.status);}
    if(process.env.FAIL_GIF==='1') {console.error('injected GIF failure');process.exit(1);}fs.writeFileSync(a[3],'new film.gif');
  }
  else fs.writeFileSync(a[2],'audio');
} else if(command==='ffmpeg') fs.writeFileSync(a.at(-1),'mixed audio');
`, { mode: 0o755 });
    for (const name of ["node", "python3", "ffmpeg"]) fs.symlinkSync(shim, path.join(dir, "bin", name));
    const env = { ...process.env, PATH: path.join(dir, "bin") + path.delimiter + process.env.PATH };
    const failed = spawnSync("bash", ["video/build.sh", "film.html"], {
      cwd: dir, env: { ...env, FAIL_GIF: "1" }, encoding: "utf8", timeout: 10000,
    });
    expect(failed.status, failed.stderr).toBe(1);
    expect(failed.stderr).toContain("injected GIF failure");
    for (const name of artifacts) expect(fs.readFileSync(path.join(dir, "media", name), "utf8")).toBe("previous " + name);
    const success = spawnSync("bash", ["video/build.sh", "film.html"], {
      cwd: dir, env: { ...env, FAIL_GIF: "0" }, encoding: "utf8", timeout: 10000,
    });
    expect(success.status, success.stderr).toBe(0);
    for (const name of artifacts) expect(fs.readFileSync(path.join(dir, "media", name), "utf8")).toBe("new " + name);
    // Exercise real gif.py with no cues, then the real build/publish removal path.
    const noGif = spawnSync("bash", ["video/build.sh", "film.html"], {
      cwd: dir, env: { ...env, NO_GIF: "1" }, encoding: "utf8", timeout: 10000,
    });
    expect(noGif.status, noGif.stderr).toBe(0);
    expect(fs.existsSync(path.join(dir, "media", "film.gif"))).toBe(false);
    expect(fs.readFileSync(path.join(dir, "media", "other.gif"), "utf8")).toBe("unrelated preview");
    for (const name of artifacts.filter(name => !name.endsWith(".gif")))
      expect(fs.readFileSync(path.join(dir, "media", name), "utf8")).toBe("new " + name);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("studio asset regeneration publishes GLB, source and frames only after all stages succeed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-bundle-"));
  try {
    for (const sub of ["tools", "video", "examples", "assets/studio/fight"])
      fs.mkdirSync(path.join(dir, sub), { recursive: true });
    for (const file of ["tools/build-studio-assets.cjs", "video/serve.cjs", "video/publish.cjs", "examples/fight-source.html"])
      fs.copyFileSync(path.join(root, file), path.join(dir, file));
    const destination = path.join(dir, "assets/studio");
    for (const name of ["fighter.glb", "fight-source.mp4", "fight/manifest.json"])
      fs.writeFileSync(path.join(destination, name), "previous " + name);
    const preload = path.join(dir, "renderer-stub.cjs");
    fs.writeFileSync(preload, `
const Module=require('node:module'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const load=Module._load;
Module._load=function(name,...rest) {
  if(name==='@playwright/test') return {chromium:{launch:async()=>({close:async()=>{},newPage:async()=>({
    goto:async()=>{},waitForFunction:async()=>{},evaluate:async()=>{},
    waitForEvent:async()=>({saveAs:async file=>fs.writeFileSync(file,'new rig')})
  })})}};
  const mod=load.call(this,name,...rest);
  if(name!=='node:child_process') return mod;
  return {...mod,execFileSync:(command,args)=>{
    if(args[0]==='video/record.cjs') {
      assert.equal(fs.readFileSync('assets/studio/fighter.glb','utf8'),'previous fighter.glb');
      const page=fs.readFileSync(args[2],'utf8');assert.match(page,/source-asset/);assert.match(page,/\.studio-build-/);
      assert.equal(fs.readFileSync(path.join(path.dirname(args[2]),'fighter.glb'),'utf8'),'new rig');
      if(process.env.FAIL_ASSET==='1') throw Error('injected source render failure');
      fs.writeFileSync(args[3],'master');
    } else if(command==='ffmpeg') fs.writeFileSync(args.at(-1),'new clip');
    else {fs.mkdirSync(args[2]);fs.writeFileSync(path.join(args[2],'manifest.json'),'new frames');}
  }};
};
`);
    const args = ["--require", preload, "tools/build-studio-assets.cjs"];
    const failed = spawnSync(process.execPath, args, {
      cwd: dir, env: { ...process.env, FAIL_ASSET: "1" }, encoding: "utf8", timeout: 10000,
    });
    expect(failed.status, failed.stderr).toBe(1);
    expect(failed.stderr).toContain("injected source render failure");
    for (const name of ["fighter.glb", "fight-source.mp4", "fight/manifest.json"])
      expect(fs.readFileSync(path.join(destination, name), "utf8")).toBe("previous " + name);
    expect(fs.readdirSync(destination).sort()).toEqual(["fight", "fight-source.mp4", "fighter.glb"]);
    const success = spawnSync(process.execPath, args, {
      cwd: dir, env: { ...process.env, FAIL_ASSET: "0" }, encoding: "utf8", timeout: 10000,
    });
    expect(success.status, success.stderr).toBe(0);
    for (const [name, expected] of [["fighter.glb", "new rig"], ["fight-source.mp4", "new clip"], ["fight/manifest.json", "new frames"]])
      expect(fs.readFileSync(path.join(destination, name), "utf8")).toBe(expected);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
