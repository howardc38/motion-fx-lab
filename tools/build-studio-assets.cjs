const path = require("node:path"),
  fs = require("node:fs/promises");
const { execFileSync } = require("node:child_process");
const { chromium } = require("@playwright/test");
const { serve, ROOT } = require("../video/serve.cjs");
const { publishBundle } = require("../video/publish.cjs");
(async () => {
  const destination = path.join(ROOT, "assets/studio");
  await fs.mkdir(destination, { recursive: true });
  // The recorder serves files below ROOT. This temporary page uses the real
  // source renderer with a staged GLB, keeping all shipped assets untouched.
  const work = await fs.mkdtemp(path.join(destination, ".studio-build-"));
  let server;
  let browser;
  try {
    server = await serve();
    browser = await chromium.launch();
    const page = await browser.newPage({ acceptDownloads: true });
    await page.goto(server.origin + "/tools/fighter-asset.html");
    await page.waitForFunction(() => !!window.buildAsset);
    const download = page.waitForEvent("download");
    await page.evaluate(() => buildAsset());
    await (await download).saveAs(path.join(work, "fighter.glb"));
    await browser.close();
    browser = null;
    await server.close();
    server = null;
    const source = await fs.readFile(path.join(ROOT, "examples/fight-source.html"), "utf8");
    const head = source.match(/<head\b[^>]*>/i);
    if (!head) throw new Error("examples/fight-source.html needs a <head> for its staged asset URL");
    const assetUrl = "/" + path.relative(ROOT, path.join(work, "fighter.glb")).split(path.sep).map(encodeURIComponent).join("/");
    const stagedPage = path.join(work, "fight-source.html");
    await fs.writeFile(stagedPage, source.replace(head[0], `${head[0]}<base href="/examples/"><meta name="source-asset" content="${assetUrl}">`));
    const master = path.join(work, "source.mkv");
    execFileSync(
      process.execPath,
      [
        "video/record.cjs",
        "video",
        stagedPage,
        master,
        "--fps",
        "24",
        "--workers",
        "2",
      ],
      { cwd: ROOT, stdio: "inherit", timeout: 300000 },
    );
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-v",
        "error",
        "-i",
        master,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "12",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        path.join(work, "fight-source.mp4"),
      ],
      { cwd: ROOT, stdio: "inherit", timeout: 120000 },
    );
    execFileSync(
      "python3",
      [
        "video/import-clip.py",
        path.join(work, "fight-source.mp4"),
        path.join(work, "fight"),
        "--fps",
        "24",
        "--key",
        "0x00ff00",
      ],
      { cwd: ROOT, stdio: "inherit", timeout: 300000 },
    );
    await publishBundle(work, destination, ["fighter.glb", "fight-source.mp4", "fight"]);
    console.log("Original rig, verified source clip and RGBA sequence published together -> assets/studio/");
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
    await fs.rm(work, { recursive: true, force: true });
  }
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
