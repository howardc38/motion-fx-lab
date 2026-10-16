const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fxm = require('../tools/fx-manifest.cjs');
const ROOT = path.resolve(__dirname, '..');
const fresh = () => structuredClone(fxm.load());
const family = (manifest, id) => manifest.families.find(f => f.id === id);
const expectError = (manifest, pattern) => {
  const errors = fxm.validate(manifest);
  assert.ok(errors.some(e => pattern.test(e)), `expected ${pattern} in:\n${errors.join('\n')}`);
};

test('the manifest matches the registered demos and the generated blocks are current', () => {
  assert.deepEqual(fxm.validate(), []);
  assert.deepEqual(fxm.sync(true), []);
  const result = spawnSync(process.execPath, [path.join(ROOT, 'tools/fx-manifest.cjs'), '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('every registered demo belongs to exactly one family, which loads the script that registers it', () => {
  const manifest = fxm.load(), { owner, stats, families, showcases } = fxm.registry(manifest);
  const listed = manifest.families.flatMap(f => Object.keys(f.sources).map(id => [id, f.id]));
  assert.equal(listed.length, stats.demos);
  assert.equal(new Set(listed.map(([id]) => id)).size, listed.length);
  for (const [id, familyId] of listed) {
    assert.equal(owner.get(id).family, familyId, id);
    assert.ok(family(manifest, familyId).scripts.includes(owner.get(id).file), id);
  }
  assert.equal(manifest.gallery.order.length, families.length);
  assert.deepEqual([...manifest.gallery.showcaseOrder].sort(), [...showcases].sort());
});

test('a demo claimed twice, by the wrong family or by none is rejected', () => {
  let m = fresh();
  family(m, 'classic').sources.whip = ['fx/demos.js'];
  expectError(m, /^whip .* exactly one family; claimed by core, classic$/);
  m = fresh();
  delete family(m, 'core').sources.whip;
  expectError(m, /^whip .* claimed by none$/);
  m = fresh();
  family(m, 'classic').sources.whip = family(m, 'core').sources.whip;
  delete family(m, 'core').sources.whip;
  expectError(m, /^whip is registered by fx\/demos\.js in family core but listed under classic$/);
  m = fresh();
  family(m, 'core').sources['not-a-demo'] = ['fx/demos.js'];
  expectError(m, /^not-a-demo is listed in sources but no script registers it$/);
});

test('the gallery order lists every family once and nothing else', () => {
  let m = fresh();
  m.gallery.order.push(m.gallery.order[0]);
  expectError(m, new RegExp(`gallery\\.order repeats ${m.gallery.order[0]}$`));
  m = fresh();
  m.gallery.order = m.gallery.order.filter(id => id !== 'character-rig');
  expectError(m, /gallery\.order is missing character-rig/);
  m = fresh();
  m.gallery.order.push('frame-glitch'); // a variant, not a card
  expectError(m, /gallery\.order lists frame-glitch/);
  m = fresh();
  m.gallery.showcaseOrder.pop();
  expectError(m, /gallery\.showcaseOrder is missing/);
  m = fresh();
  m.gallery.previewDefault['cjk-solid'] = 'studio-lowpoly';
  expectError(m, /previewDefault: studio-lowpoly is not a variant of cjk-solid/);
  m = fresh();
  m.gallery.previewHero.gpuparticles = 999;
  expectError(m, /previewHero: gpuparticles needs a time within/);
});

test('scripts, sources, readmes and anchors must exist', () => {
  let m = fresh();
  family(m, 'design').scripts.push('fx/missing.js');
  expectError(m, /family design: missing script fx\/missing\.js/);
  m = fresh();
  family(m, 'studio').scripts.push('fx/demos.js');
  expectError(m, /family studio: fx\/demos\.js is listed more than once/);
  m = fresh();
  family(m, 'signals').sources['signal-audio-relief'].push('fx/signals/missing.js');
  expectError(m, /signal-audio-relief source fx\/signals\/missing\.js does not exist/);
  m = fresh();
  family(m, 'dialogue').readme = 'fx/dialogue/MISSING.md';
  expectError(m, /family dialogue: missing readme/);
  m = fresh();
  family(m, 'design').anchor = "id:'{key}-renamed'";
  expectError(m, /design-type-orbit: anchor id:'type-orbit-renamed' not found in fx\/design-effects\.js/);
});

test('source refs point at the registering line of each anchored demo', () => {
  const manifest = fxm.load();
  for (const f of manifest.families.filter(f => f.anchor)) {
    for (const id of Object.keys(f.sources)) {
      const [first, ...rest] = fxm.sourceRefs(id, manifest);
      const line = fs.readFileSync(path.join(ROOT, first.path), 'utf8').split('\n')[first.line - 1];
      assert.ok(line.includes(f.anchor.replaceAll('{id}', id).replaceAll('{key}', f.prefix ? id.replace(f.prefix, '') : id)), `${id}: ${line}`);
      assert.ok(rest.every(r => r.line === 1));
    }
  }
  assert.deepEqual(fxm.sourceRefs('character-rig', manifest)[0], { path: 'fx/pack-character.js', line: 1 });
  assert.throws(() => fxm.sourceRefs('not-a-demo', manifest), /No fx\/manifest\.json sources/);
});

test('pages load the generated block, then the gallery scripts in dependency order', () => {
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const at = text => { const i = index.indexOf(text); assert.ok(i >= 0, text); return i; };
  const sequence = ['window.FX_RENDER_SIZE', '<!-- fx:scripts:start -->', 'src="fx/demos.js"', 'src="fx/catalog.js?v=', '<!-- fx:scripts:end -->',
    'src="fx/gallery-layout.js"', 'src="fx/films-data.js?v=graphic-1"', 'src="fx/gallery-meta.js?v=graphic-1"', 'src="fx/gallery-page.js"'].map(at);
  assert.deepEqual(sequence, [...sequence].sort((a, b) => a - b));
  assert.doesNotMatch(index, /const (ORDER|PREVIEW_DEFAULT|PREVIEW_HERO|KINDS|STACKS|NEEDS)\b/);
  const manifest = fxm.load(), intro = fxm.renderScripts(manifest, 'video/intro.html');
  assert.match(intro, /<script src="\.\.\/fx\/demos\.js"><\/script>/);
  assert.match(intro, /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/flubber@0\.4\.2\/build\/flubber\.min\.js"><\/script>/);
  assert.match(fxm.renderScripts(manifest, 'index.html'), /<script src="fx\/fluid-effects\.js\?v=liquid-v2"><\/script>/);
});

test('the README effect overview names every gallery card once, in gallery order, without counts', () => {
  const manifest = fxm.load(), text = fxm.renderReadmeEffects(manifest), reg = fxm.registry(manifest);
  const ids = [...text.matchAll(/#demo-([a-z0-9-]+)\)/g)].map(m => m[1]);
  assert.deepEqual([...ids].sort(), reg.cards.map(c => c.id).sort());
  const basics = new Set(reg.cards.filter(c => c.basic).map(c => c.id));
  assert.deepEqual(ids.filter(id => basics.has(id)), manifest.gallery.order.filter(id => basics.has(id)));
  assert.doesNotMatch(text, /\d+\s+(effects|effect families|variants|techniques)/i);
  for (const f of manifest.families.filter(x => x.readme)) assert.ok(text.includes(`(${f.readme})`), f.readme);
});

test('--write rewrites only the marked blocks and --check reports stale ones', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-manifest-'));
  try {
    for (const file of ['fx/manifest.json', 'index.html', 'video/intro.html', 'fx/gallery-meta.js']) {
      fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true });
      fs.copyFileSync(path.join(ROOT, file), path.join(tmp, file));
    }
    const page = path.join(tmp, 'video/intro.html'), before = fs.readFileSync(page, 'utf8');
    const stale = before.replace('<!-- fx:scripts:start -->\n', '<!-- fx:scripts:start -->\n<script src="../fx/old.js"></script>\n');
    fs.writeFileSync(page, stale);
    assert.throws(() => fxm.sync(true, tmp), /stale in video\/intro\.html; run node tools\/fx-manifest\.cjs --write/);
    assert.deepEqual(fxm.sync(false, tmp), ['video/intro.html']);
    assert.equal(fs.readFileSync(page, 'utf8'), before);
    assert.deepEqual(fxm.sync(true, tmp), []);
    fs.writeFileSync(page, before.replace('<!-- fx:scripts:end -->', ''));
    assert.throws(() => fxm.sync(false, tmp), /needs exactly one <!-- fx:scripts:start -->/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
