const { test, expect } = require('@playwright/test');
async function open(page) {
  await page.goto('/examples/character-workbench.html');
  await page.waitForFunction(() => window.characterWorkbench);
}

test('two different rigs animate without clipping, preserve transparency and reproduce sought frames', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await open(page);
  const result = await page.evaluate(() => {
    const out = [];
    for (const [id, source] of Object.entries(characterWorkbench.study.sources)) for (const motion of Object.keys(source.rig.definition.motions)) {
      const raw = source.frame(.74, { motion }), first = raw.toDataURL();
      const pixels = new Uint8ClampedArray(raw.getContext('2d').getImageData(0, 0, raw.width, raw.height).data);
      source.frame(2.3, { motion });
      const second = source.frame(1.08, { motion }).toDataURL();
      const repeat = first === source.frame(.74, { motion }).toDataURL();
      let ink = 0, edge = 0;
      for (let y = 0; y < raw.height; y++) for (let x = 0; x < raw.width; x++) if (pixels[(y * raw.width + x) * 4 + 3] > 95) {
        ink++; if (x === 0 || y === 0 || x === raw.width - 1 || y === raw.height - 1) edge++;
      }
      out.push({ id, motion, repeat, different: first !== second, ink, edge });
    }
    return out;
  });
  expect(result).toHaveLength(7);
  for (const row of result) {
    expect(row.repeat, JSON.stringify(row)).toBe(true);
    expect(row.different, JSON.stringify(row)).toBe(true);
    expect(row.ink).toBeGreaterThan(1000); expect(row.edge).toBe(0);
  }
  expect(errors).toEqual([]);
});

test('all styles alter the subject rather than only a background, with alpha retained', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { STYLE_PRESETS } = await import('/fx/character/index.js'), out = [];
    for (const source of Object.values(characterWorkbench.study.sources)) {
      const signatures = [], alpha = [];
      for (const s of STYLE_PRESETS) {
        const c = source.frame(1, { motion: 'idle', style: s.id }), p = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        signatures.push(c.toDataURL()); let empty = 0, ink = 0;
        for (let i = 3; i < p.length; i += 4) { if (p[i] === 0) empty++; if (p[i] > 95) ink++; }
        alpha.push({ empty, ink });
      }
      out.push({ distinct: new Set(signatures).size, alpha });
    }
    return out;
  });
  for (const row of result) {
    expect(row.distinct).toBe(8);
    for (const a of row.alpha) { expect(a.empty).toBeGreaterThan(1000); expect(a.ink).toBeGreaterThan(500); }
  }
});

test('scene timing uses the configured motion clock, supports multiple actors and rejects missing sources', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { CharacterScene, CutoutRig } = await import('/fx/character/index.js');
    const source = characterWorkbench.study.sources.cat, scene = new CharacterScene({ cat: source });
    const actor = { character: 'cat', motion: 'run', style: 'original', start: 1, end: 2, x: 600, y: 360, travel: false, offset: .3, rate: 2 };
    const alpha = c => { const p = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < p.length; i += 4) if (p[i]) n++; return n; };
    const before = alpha(scene.frame(.9, { actors: [actor] })), after = alpha(scene.frame(2, { actors: [actor] }));
    const timed = scene.frame(1.2, { actors: [actor] }).toDataURL();
    const expected = scene.frame(.7, { actors: [{ ...actor, start: 0, offset: 0, rate: 1 }] }).toDataURL();
    const active = alpha(scene.frame(1.2, { actors: [actor] }));
    const duet = alpha(scene.frame(1.2, { actors: [actor, { ...actor, x: 150 }] }));
    let unknown = false, crop = false;
    try { scene.frame(0, { actors: [{ character: 'missing' }] }); } catch (e) { unknown = /Unknown scene character/.test(e.message); }
    const image = document.createElement('canvas'); image.width = image.height = 20;
    try { new CutoutRig({ version: 1, canvas: { width: 100, height: 100, origin: [50, 50] }, assets: { art: 'x.png' }, joints: { a: [0, 0] }, parts: [{ id: 'a', asset: 'art', rect: [0, 0, 21, 20], from: 'a', pivot: [10, 10] }] }, { art: image }); } catch (e) { crop = /Crop exceeds/.test(e.message); }
    return { before, after, sameClock: timed === expected, active, duet, unknown, crop };
  });
  expect(result.before).toBe(0); expect(result.after).toBe(0); expect(result.sameClock).toBe(true);
  expect(result.active).toBeGreaterThan(1000); expect(result.duet).toBe(result.active * 2);
  expect(result.unknown).toBe(true); expect(result.crop).toBe(true);
});

test('workbench exposes only configured motions and every layout redraws', async ({ page }) => {
  await open(page);
  await page.locator('#character').selectOption('robot');
  await expect(page.locator('#motion option')).toHaveText(['idle', 'wave', 'jump']);
  await page.locator('#motion').selectOption('wave'); await page.locator('#seek').fill('4');
  const signatures = new Set();
  for (const layout of ['single', 'pairs', 'board', 'rig', 'reel']) {
    await page.locator('#layout').selectOption(layout);
    signatures.add(await page.locator('#frame canvas').evaluate(c => c.toDataURL()));
  }
  expect(signatures.size).toBe(5);
  await expect(page.locator('#error')).toBeEmpty();
});

test('character Menu IDs are registered and render through the gallery adapter', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => window.galleryAPI); await page.evaluate(() => galleryAPI.pause());
  const results = await page.evaluate(async () => {
    const out = [];
    for (const id of ['character-rig', 'character-motion', 'character-style']) {
      const r = await galleryAPI.draw(id, 1), c = r.stage.querySelector('canvas');
      out.push({ id, role: FXCatalog.byId.get(id).role, family: FXCatalog.byId.get(id).familyId, canvas: !!c, ratio: c?.width / c?.height, error: r.stage.querySelector('.oops')?.textContent });
    }
    return out;
  });
  expect(results.map(r => r.role)).toEqual(['technique', 'variant', 'technique']);
  expect(results[1].family).toBe('character-rig');
  for (const r of results) { expect(r.canvas).toBe(true); expect(r.ratio).toBeCloseTo(16 / 9); expect(r.error).toBeUndefined(); }
});
