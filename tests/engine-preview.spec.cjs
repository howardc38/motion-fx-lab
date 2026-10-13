// The engine's preview scrub bar: present on every page that uses video/engine.js, absent from
// recording, and without any effect on recorded cues or frames.
const { test, expect } = require('@playwright/test');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const enginePages = [
  ...fs.readdirSync(path.join(root, 'examples')).filter(f => f.endsWith('.html')).map(f => 'examples/' + f),
  ...fs.readdirSync(path.join(root, 'video')).filter(f => f.endsWith('.html')).map(f => 'video/' + f),
].filter(file => [...fs.readFileSync(path.join(root, file), 'utf8').matchAll(/<script[^>]+src="([^"]*engine\.js)"/g)]
  .some(([, src]) => path.resolve(root, path.dirname(file), src) === path.join(root, 'video', 'engine.js'))).sort();
// record.cjs installs this before any page script runs (its WebGL context watch).
const asRecorder = () => { window.__gl = []; window.__gpuErrors = []; window.__gpuAdapters = []; };
const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const bar = page => page.locator('#fx-preview');
const slider = page => page.getByRole('slider', { name: 'Timeline position in seconds' });
const clock = page => page.locator('#fx-preview output');
const seconds = async page => parseFloat(await clock(page).textContent());
// Whether the bar or its stylesheet is anywhere in the document.
const previewTraces = () => !!document.getElementById('fx-preview') || [...document.querySelectorAll('style')].some(s => s.textContent.includes('fx-preview'));
// The stage scale the engine has always used (before the bar existed): the viewport less 32 px.
const fittedWithoutBar = () => {
  const probe = document.createElement('div'), { w, h } = window.__SIZE;
  probe.style.transform = `scale(${Math.min((innerWidth - 32) / w, (innerHeight - 32) / h)})`;
  return probe.style.transform === document.getElementById('stage').style.transform;
};
// What the engine and the page's hooks write for a frame, in the scenes that frame shows. A hidden
// scene keeps the styles it was last rendered with, which depend on what was previewed before.
const snapshot = page => page.evaluate(() => {
  const stage = document.getElementById('stage');
  return [document.body.className, document.getElementById('frame').getAttribute('style'), stage.getAttribute('style'),
    ...[...stage.querySelectorAll('.scene')].filter(s => s.style.visibility !== 'hidden').map(s => s.outerHTML)].join('\n');
});

test('every page that uses the engine shows the preview bar', async ({ page }) => {
  expect(enginePages).toEqual(expect.arrayContaining(['examples/reel.html', 'examples/product.html', 'examples/infographic.html', 'examples/broll.html']));
  for (const file of enginePages) {
    await page.goto('/' + file, { waitUntil: 'domcontentloaded' });
    await expect(bar(page), file).toBeVisible();
    const dur = await page.evaluate(() => window.__DUR);
    await expect(slider(page), file).toHaveAttribute('max', String(dur));
    await expect(page.locator('#fx-preview button'), file).toBeVisible();
    await expect(clock(page), file).toHaveText(new RegExp(` / ${dur.toFixed(2)} s$`));
  }
});

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`the bar leaves the film uncovered at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const file of ['examples/reel.html', 'examples/product.html']) {
      await page.goto('/' + file);
      await page.evaluate(() => window.__ready);
      const film = await page.locator('#frame').boundingBox(), controls = await bar(page).boundingBox();
      expect(film.y + film.height, file).toBeLessThanOrEqual(controls.y);
      expect(film.x, file).toBeGreaterThanOrEqual(0);
      expect(film.x + film.width, file).toBeLessThanOrEqual(viewport.width);
      expect(controls.x, file).toBeGreaterThanOrEqual(0);
      expect(controls.x + controls.width, file).toBeLessThanOrEqual(viewport.width);
    }
  });
}

test('dragging the slider seeks at once, and play, pause and Space work', async ({ page }) => {
  await page.goto('/examples/reel.html');
  await page.evaluate(() => window.__ready);
  const play = page.locator('#fx-preview button');
  await expect(play).toHaveText('Pause');
  // Playing: the clock advances.
  const start = await seconds(page);
  await expect.poll(() => seconds(page)).toBeGreaterThan(start);
  await play.click();
  await expect(play).toHaveText('Play');

  // Paused: setting the slider renders that time, exactly as the recorder's frame 186 at 30 fps.
  await slider(page).fill('6.2');
  await expect(clock(page)).toHaveText('6.20 / 12.00 s');
  await expect(play).toHaveText('Play');
  const seeked = await snapshot(page);
  await page.evaluate(() => window.__render(186 / 30));
  expect(await snapshot(page)).toBe(seeked);
  await page.waitForTimeout(300);
  await expect(clock(page)).toHaveText('6.20 / 12.00 s');

  // Arrow keys step one frame at 30 fps and stay paused.
  await slider(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(clock(page)).toHaveText('6.23 / 12.00 s');
  await page.keyboard.press('Home');
  await expect(clock(page)).toHaveText('0.00 / 12.00 s');
  await expect(play).toHaveText('Play');

  // Space toggles playback (also while the slider has focus).
  await page.keyboard.press('Space');
  await expect(play).toHaveText('Pause');
  await expect.poll(() => seconds(page)).toBeGreaterThan(0.1);
  await page.locator('body').click({ position: { x: 2, y: 2 } });
  await page.keyboard.press('Space');
  await expect(play).toHaveText('Play');
  const held = await seconds(page);
  await page.waitForTimeout(300);
  expect(await seconds(page)).toBe(held);

  // Dragging while playing pauses under the pointer and resumes on release.
  await play.click();
  await expect(play).toHaveText('Pause');
  const box = await slider(page).boundingBox();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 4 });
  await page.waitForTimeout(200);
  const dragged = await seconds(page);
  expect(dragged).toBeGreaterThan(4.5);
  expect(dragged).toBeLessThan(7.5);
  await expect(play).toHaveText('Play');
  await page.waitForTimeout(300);
  expect(await seconds(page)).toBe(dragged);
  await page.mouse.up();
  await expect(play).toHaveText('Pause');
  await expect.poll(() => seconds(page)).toBeGreaterThan(dragged);

  // A click on the film still restarts it.
  await page.locator('#frame').click();
  await expect(play).toHaveText('Pause');
  await expect.poll(() => seconds(page)).toBeLessThan(dragged);
});

test.describe('recording', () => {
  test.use({ viewport: { width: 1080, height: 1920 } });

  test('the recorder never sees the bar, and __record() removes it everywhere else', async ({ page, context }) => {
    // As record.cjs opens a page: no bar at any time, and the stage fitted as without one.
    const recorder = await context.newPage();
    await recorder.addInitScript(asRecorder);
    await recorder.goto('/examples/reel.html');
    expect(await recorder.evaluate(previewTraces)).toBe(false);
    expect(await recorder.evaluate(fittedWithoutBar)).toBe(true);
    await recorder.evaluate(async () => { await window.__ready; await window.__record(); });
    await expect(bar(recorder)).toHaveCount(0);

    // A preview that was scrubbed and paused, then recorded.
    await page.goto('/examples/reel.html');
    await page.evaluate(() => window.__ready);
    await expect(bar(page)).toBeVisible();
    await page.locator('#fx-preview button').click();
    await slider(page).fill('4.2');
    await expect(clock(page)).toHaveText('4.20 / 12.00 s');
    await page.evaluate(async () => { await window.__ready; await window.__record(); });
    await expect(bar(page)).toHaveCount(0);
    expect(await page.evaluate(previewTraces)).toBe(false);
    expect(await page.evaluate(fittedWithoutBar)).toBe(true);
    // Space and slider events no longer drive the film once recording.
    await page.keyboard.press('Space');

    // Same cues, same DOM and the same pixels at every sampled time.
    expect(await page.evaluate(() => JSON.stringify(window.__cues()))).toBe(await recorder.evaluate(() => JSON.stringify(window.__cues())));
    const size = await page.evaluate(() => window.__SIZE);
    const clip = { x: 0, y: 0, width: size.w, height: size.h };
    for (const t of [0, 0.3, 2.6, 4.2, 6.2, 7, 9.5, 12]) {
      await page.evaluate(time => window.__render(time), t);
      await recorder.evaluate(time => window.__render(time), t);
      expect(await snapshot(page), `t=${t}`).toBe(await snapshot(recorder));
      expect(sha(await page.screenshot({ clip })), `t=${t}`).toBe(sha(await recorder.screenshot({ clip })));
    }
    await recorder.close();
  });
});

test('engine-manifest.json lists exactly the primitives the engine accepts', async ({ page }) => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'video/engine-manifest.json'), 'utf8'));
  const source = fs.readFileSync(path.join(root, 'video/engine.js'), 'utf8');
  await page.goto('/examples/reel.html', { waitUntil: 'domcontentloaded' });
  const engine = await page.evaluate(() => window.__enginePrimitives);
  expect(manifest.primitives.map(p => p.id)).toEqual(engine.fx);
  expect(manifest.fallback_duration_sec).toBe(engine.fallbackDur);
  expect(manifest.page.scene_wipe_sec).toBe(engine.wipe);
  for (const p of manifest.primitives) {
    expect(p.default_duration_sec, p.id).toBe(engine.defaultDur[p.id] ?? engine.fallbackDur);
    expect(p.scales, p.id).toBe(engine.scales.includes(p.id));
    expect(['in', 'pass', 'continuous'], p.id).toContain(p.timing);
    // Each documented parameter is read by the engine (data-mark-h -> dataset.markH or d.markH).
    for (const attr of Object.keys(p.parameters)) {
      const key = attr.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      expect(new RegExp(`(dataset|\\bd)\\.${key}\\b`).test(source), `${p.id} ${attr}`).toBe(true);
    }
  }
  for (const attr of [...Object.keys(manifest.element_attributes), ...Object.keys(manifest.sound_attributes)]) {
    const key = attr.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    expect(new RegExp(`\\b(d|dataset)\\.${key}\\b|\\[data-${attr.slice(5)}\\]`).test(source), attr).toBe(true);
  }
});
