// Render the transparent RGBA source clips for the signal studies.
//   node tools/signals/render-source.cjs fragments <work-dir>   -> <work-dir>/cat.mov + cues.json
//   node tools/signals/render-source.cjs relief <work-dir>      -> <work-dir>/portrait.mov
// The clips are lossless PNG-in-MOV with alpha; video/import-clip.py turns them into the
// fixed-FPS frame folders that tools/signals/build.py measures (see fx/signals/README.md).
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { chromium } = require('@playwright/test');
const { serve, ROOT } = require('../../video/serve.cjs');

async function main() {
  const [kind, out] = process.argv.slice(2);
  if (!['fragments', 'relief'].includes(kind) || !out) throw new Error('usage: render-source.cjs fragments|relief <work-dir>');
  const work = path.resolve(out), frames = path.join(work, kind + '-png');
  fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
  const server = await serve({ projectRoot: ROOT }), browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => { throw e; });
    await page.goto(server.origin + '/tools/signals/source.html');
    await page.evaluate(() => window.sourceReady);
    const spec = await page.evaluate(() => window.sourceSpec());
    const write = (i, url) => fs.writeFileSync(path.join(frames, `${String(i).padStart(6, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
    let fps, name;
    if (kind === 'fragments') {
      fps = spec.stage.fps; name = 'cat.mov';
      // Cover the remapped source time of the film's final frame, plus one guard frame.
      const count = Math.ceil(spec.sourceEnd * fps) + 2;
      for (let i = 0; i < count; i++) write(i, await page.evaluate(t => window.renderCat(t), i / fps));
      fs.writeFileSync(path.join(work, 'cues.json'), JSON.stringify(spec.cues, null, 1) + '\n');
    } else {
      fps = 24; name = 'portrait.mov';
      write(0, await page.evaluate(() => window.renderPortrait()));
    }
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(fps), '-i', path.join(frames, '%06d.png'), '-c:v', 'png', '-pix_fmt', 'rgba', path.join(work, name)]);
    console.log(`${fs.readdirSync(frames).length} RGBA frames -> ${path.join(work, name)}`);
  } finally { await browser.close(); await server.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
