const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const artifacts = ["film_hq.mp4", "film.mp4", "film.jpg"];

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "delivery-preservation-"));
  const destination = path.join(dir, "published");
  fs.mkdirSync(destination);
  for (const name of [...artifacts, "unrelated.txt"])
    fs.writeFileSync(path.join(destination, name), "previous " + name);
  const driver = path.join(dir, "deliver-driver.py");
  // Keep main(), real filesystem staging and the real bundle publisher. Only
  // replace expensive media processing, including the successful/no-frame case.
  fs.writeFileSync(driver, `
import importlib.util, os, pathlib, sys
spec = importlib.util.spec_from_file_location("delivery", sys.argv[1])
delivery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(delivery)
destination, poster = sys.argv[2:4]
delivery.probe = lambda _: {"format": {"duration": "1"}}
delivery.master_for_aac = lambda *_: "normalized.wav"
def encode(master, audio, output):
    print("ENCODED")
    pathlib.Path(output).write_text("new video")
delivery.encode_hq = encode
delivery.check = lambda *_args, **_kwargs: None
real_run = delivery.run
def run(*args, **kwargs):
    if args[0] != "ffmpeg":
        return real_run(*args, **kwargs)
    mode = os.environ.get("POSTER_RESULT", "image")
    if mode != "missing":
        pathlib.Path(args[-1]).write_bytes(b"new poster" if mode == "image" else b"")
delivery.run = run
sys.argv = ["deliver.py", "master.mkv", "mix.wav", destination, "film"]
if poster != "default":
    sys.argv.append(poster)
delivery.main()
`);
  const preload = path.join(dir, "fail-final-install.cjs");
  fs.writeFileSync(preload, `
const fs = require("node:fs/promises"), path = require("node:path");
const rename = fs.rename;
fs.rename = async (from, to) => {
  if (from.includes(path.sep + "next" + path.sep) && path.basename(to) === "film.jpg")
    throw new Error("injected final poster install failure");
  return rename(from, to);
};
`);
  return {
    destination,
    run(poster = "0.5", env = {}) {
      return spawnSync("python3", [driver, path.join(root, "video/deliver.py"), destination, poster], {
        encoding: "utf8", timeout: 10000,
        env: { ...process.env, PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH, ...env },
      });
    },
    failureEnvironment: { NODE_OPTIONS: `--require=${JSON.stringify(preload)}` },
    expectUnchanged() {
      for (const name of [...artifacts, "unrelated.txt"])
        expect(fs.readFileSync(path.join(destination, name), "utf8")).toBe("previous " + name);
      expect(fs.readdirSync(destination).sort()).toEqual([...artifacts, "unrelated.txt"].sort());
    },
    cleanup() { fs.rmSync(dir, { recursive: true, force: true }); },
  };
}

test("delivery rejects invalid poster times before encoding or publication", () => {
  const f = fixture();
  try {
    for (const poster of ["-0.1", "1", "99", "NaN", "Infinity", "invalid"]) {
      const result = f.run(poster);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("poster_seconds must be a finite number within the master duration");
      expect(result.stdout).not.toContain("ENCODED");
      f.expectUnchanged();
    }
  } finally { f.cleanup(); }
});

test("delivery preserves old videos and poster when successful extraction produces no image", () => {
  const f = fixture();
  try {
    for (const mode of ["missing", "empty"]) {
      const result = f.run("0.99", { POSTER_RESULT: mode });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stdout).toContain("ENCODED");
      expect(result.stderr).toContain("poster extraction produced no image");
      f.expectUnchanged();
    }
  } finally { f.cleanup(); }
});

test("delivery rolls back both videos if the final poster installation fails", () => {
  const f = fixture();
  try {
    const result = f.run("0.5", f.failureEnvironment);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("injected final poster install failure");
    f.expectUnchanged();
  } finally { f.cleanup(); }
});

test("delivery publishes all three artifacts together and preserves unrelated files", () => {
  const f = fixture();
  try {
    const result = f.run("default");
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    for (const name of artifacts)
      expect(fs.readFileSync(path.join(f.destination, name), "utf8")).toBe(name.endsWith(".jpg") ? "new poster" : "new video");
    expect(fs.readFileSync(path.join(f.destination, "unrelated.txt"), "utf8")).toBe("previous unrelated.txt");
    expect(fs.readdirSync(f.destination).sort()).toEqual([...artifacts, "unrelated.txt"].sort());
  } finally { f.cleanup(); }
});
