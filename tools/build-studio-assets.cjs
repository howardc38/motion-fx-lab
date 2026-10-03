const path = require("node:path"),
  fs = require("node:fs/promises");
const os = require("node:os"),
  { execFileSync } = require("node:child_process");
const { chromium } = require("@playwright/test");
const { serve, ROOT } = require("../video/serve.cjs");
(async () => {
  const server = await serve();
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ acceptDownloads: true });
    await page.goto(server.origin + "/tools/fighter-asset.html");
    await page.waitForFunction(() => !!window.buildAsset);
    const download = page.waitForEvent("download");
    await page.evaluate(() => buildAsset());
    await fs.mkdir(path.join(ROOT, "assets/studio"), { recursive: true });
    await (await download).saveAs(path.join(ROOT, "assets/studio/fighter.glb"));
    console.log(
      "Original rig + 4.8s skeletal animation -> assets/studio/fighter.glb",
    );
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
})()
  .then(async () => {
    const work = await fs.mkdtemp(path.join(os.tmpdir(), "studio-source-"));
    try {
      const master = path.join(work, "source.mkv");
      execFileSync(
        process.execPath,
        [
          "video/record.cjs",
          "video",
          "examples/fight-source.html",
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
          "assets/studio/fight-source.mp4",
        ],
        { cwd: ROOT, stdio: "inherit", timeout: 120000 },
      );
      execFileSync(
        "python3",
        [
          "video/import-clip.py",
          "assets/studio/fight-source.mp4",
          "assets/studio/fight",
          "--fps",
          "24",
          "--key",
          "0x00ff00",
          "--replace",
        ],
        { cwd: ROOT, stdio: "inherit", timeout: 300000 },
      );
    } finally {
      await fs.rm(work, { recursive: true, force: true });
    }
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
