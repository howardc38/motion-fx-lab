// The film manifest (examples/films.json v2, or examples/films.next.json while films.json is still v1) is the only
// source for published films. These checks run without a browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const tool = require('../tools/films.cjs');
const ROOT = path.resolve(__dirname, '..');
const state = tool.load();
const manifest = state.manifest;
const copy = value => JSON.parse(JSON.stringify(value));
const errorsAfter = change => { const m = copy(manifest); change(m); return tool.validateManifest(m).join('\n'); };
const film = (m, id) => m.films.find(f => f.id === id);
const sampleV1 = {
  version: 1,
  films: [
    { id: 'clip', title: 'Clip', kind: 'Use case', section: 'uses', duration: 6, format: '9:16', source: 'examples/clip.html', media: { mp4: 'media/clip.mp4', gif: 'media/clip.gif', poster: 'media/clip.jpg' }, description: 'A clip.', effects: [{ id: 'chars', label: 'Letters' }, { id: 'karaoke', label: 'Captions' }], groups: ['all'] },
    { id: 'study', title: 'Study', kind: 'Single-effect render', section: 'supporting', duration: 9.6, format: '16:9', source: 'examples/study.html?v=2', media: { mp4: 'media/study.mp4?v=2', gif: 'media/study.gif?v=2', poster: 'media/study.jpg?v=2' }, groups: ['all', 'fluid'] },
  ],
};

test('the repository manifest passes the schema, the catalogue and the source-evidence checks', () => {
  const result = tool.validate();
  assert.equal(result.manifest.version, 2);
  assert.deepEqual(tool.schemaErrors(JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/films-schema.json'), 'utf8')), manifest), []);
});

test('every film has a layer, a tier, card copy and at least one catalogue effect with evidence', () => {
  const catalog = tool.loadCatalog();
  for (const f of manifest.films) {
    assert.ok(f.layer && f.tier && f.card.headline && f.card.description && f.audience, f.id);
    assert.ok(f.effects.length > 0, f.id);
    for (const e of f.effects) {
      assert.ok(catalog.byId.has(e.id), `${f.id}: ${e.id}`);
      assert.equal(tool.evidence(f, e).ok, true, `${f.id}: ${e.id}`);
    }
  }
  assert.equal(manifest.films.filter(f => f.tier === 'hero').length, 1);
});

test('planned changes from the review are recorded on the films they concern', () => {
  const byId = new Map(manifest.films.map(f => [f.id, f]));
  if (byId.has('impact-orbit')) assert.equal(byId.get('impact-orbit').mergeInto, 'dot-battle');
  if (byId.has('shadow-lab')) assert.ok(byId.get('shadow-lab').retire);
  if (byId.has('scene-eras')) assert.equal(byId.get('scene-eras').layer, 'comparison');
  if (byId.has('word-forms') && byId.get('word-forms').layer !== 'use-case') assert.equal(byId.get('word-forms').becomes.layer, 'use-case');
  for (const id of ['optical', 'stacks']) if (byId.has(id)) {
    const f = byId.get(id);
    assert.equal(f.layer, 'effect-film');
    assert.ok(f.effects.length > 1 && f.effects.every(e => e.at), id + ' is a sampler with a segment per effect');
  }
});

test('while films.json is v1, films.next.json keeps every v1 value and is exactly what --migrate writes', { skip: !state.v1 && 'films.json is already v2' }, () => {
  const rows = tool.compareV1(state.v1, manifest);
  assert.deepEqual(rows.filter(r => r.status === 'lost'), []);
  assert.deepEqual(manifest.films.map(f => f.id).sort(), state.v1.films.map(f => f.id).sort());
  assert.equal(tool.formatJSON(tool.migrate(state.v1, manifest)) + '\n', fs.readFileSync(path.join(ROOT, 'examples/films.next.json'), 'utf8'));
});

test('migration maps v1 kinds to layers, keeps v1 values and moves nothing silently', () => {
  const fresh = tool.migrate(sampleV1, null);
  assert.deepEqual(fresh.films.map(f => [f.id, f.layer, f.tier, f.page]), [['clip', 'use-case', 'featured', 'examples/clip.html'], ['study', 'effect-film', 'in-card', 'examples/study.html?v=2']]);
  assert.deepEqual(tool.compareV1(sampleV1, fresh).filter(r => r.status === 'lost'), []);
  // Authored v2 fields survive a re-run; v1 stays authoritative for its own fields; a dropped v1 effect becomes related.
  const authored = copy(fresh);
  authored.films[0].effects = [{ id: 'chars', label: 'Old label' }];
  authored.films[0].card.useFor = 'Short promos.';
  const v1 = copy(sampleV1); v1.films[0].duration = 7;
  const again = tool.migrate(v1, authored);
  assert.equal(again.films[0].duration, 7);
  assert.equal(again.films[0].card.useFor, 'Short promos.');
  assert.deepEqual(again.films[0].effects, [{ id: 'chars', label: 'Letters' }]);
  assert.deepEqual(again.films[0].related, [{ id: 'karaoke', label: 'Captions' }]);
  assert.deepEqual(tool.compareV1(v1, again).filter(r => r.status === 'lost'), []);
});

test('the checker rejects broken structure and broken film rules', () => {
  const cases = [
    [m => { film(m, m.films[0].id).layer = 'supporting'; }, /is not one of/],
    [m => { delete m.films[1].card; }, /missing card/],
    [m => { delete m.films.find(f => f.tier === 'featured').card.useFor; }, /featured card needs useFor/],
    [m => { m.films.find(f => f.layer === 'effect-film').tier = 'listed'; }, /effect films, and only they, play in-card/],
    [m => { m.films.push({ ...copy(m.films[0]), id: 'second-intro' }); }, /exactly one intro|only the intro/],
    [m => { m.films[2].id = m.films[1].id; }, /duplicate id/],
    [m => { m.films[1].effects.push({ id: 'no-such-effect' }); }, /not in the effect catalogue/],
    [m => { const f = m.films[1]; (f.related ||= []).push({ id: f.effects[0].id }); }, /in both effects and related/],
    [m => { const f = m.films[1]; f.effects[0].at = [0, f.duration + 1]; }, /outside 0/],
    [m => { const f = m.films.find(x => x.layer === 'effect-film' && x.effects.length > 1); delete f.effects[0].at; }, /sampler/],
    [m => { m.films[1].mergeInto = 'no-such-film'; }, /cannot merge into/],
    [m => { m.films[1].page = 'examples/no-such-page.html'; }, /missing or outside file/],
    [m => { m.films[1].media.gif = 'media/no-such.gif'; }, /missing or outside file|media\/ differs/],
    // D5: a card plays a silent loop; only the intro keeps a GIF (the README hero); versions and effect films have neither.
    [m => { delete m.films.find(f => f.tier === 'featured').media.preview; }, /needs media.preview/],
    [m => { m.films.find(f => f.layer === 'effect-film').media.preview = 'media/intro.preview.mp4'; }, /only a film with a card \(or the intro\) has media.preview/],
    [m => { m.films.find(f => f.tier === 'featured').media.gif = 'media/intro.gif'; }, /only the intro keeps a GIF/],
    [m => { m.films[1].card.description = 'A | B'; }, /does not match/],
    [m => { m.films[1].groups = ['showcase']; }, /must contain "all"/],
    [m => { m.films.find(f => f.versionOf).versionOf = 'no-such-film'; }, /versionOf no-such-film must name a film with a card/],
    [m => { const v = m.films.find(f => f.versionOf && f.layer === 'use-case'); delete v.versionOf; }, /listed use case must be a version/],
    [m => { m.films.find(f => f.tier === 'featured').versionOf = m.films.find(f => f.tier === 'featured' && f.layer === 'demo').id; }, /only a listed film can be a version/],
  ];
  for (const [change, pattern] of cases) assert.match(errorsAfter(change), pattern, String(change));
});

test('effect evidence needs a named effect on the page or a proof in a file the page loads', () => {
  const f = copy(manifest.films.find(x => x.page.startsWith('examples/')));
  assert.match(tool.evidence(f, { id: 'no-such-effect' }).why, /does not name/);
  assert.match(tool.evidence(f, { id: 'x', proof: ['tools/films.cjs', 'closure'] }).why, /not loaded by/);
  assert.match(tool.evidence(f, { id: 'x', proof: [path.posix.normalize(f.page.split('?')[0]), 'text that is not in the page 9f3c'] }).why, /is not in/);
});

test('the source closure follows script tags, imports and registry directories', () => {
  assert.ok(tool.closure('examples/dot-battle.html').has('fx/studio/battle.js'));
  assert.ok(tool.closure('examples/fight-effects.html').has('fx/studio/dots.js'), 'studio registry resolves modules from fx/studio/');
  const intro = tool.closure('video/intro.html');
  for (const file of ['fx/intro-stories.js', 'fx/material-studies/films.js', 'fx/catalog.js']) assert.ok(intro.has(file), file);
});

test('generated blocks are current and cover every film', () => {
  assert.deepEqual(tool.sync(true), []);
  const list = tool.render.list(manifest);
  for (const f of manifest.films) assert.ok(list.includes(`data-film-index-id="${f.id}"`), f.id);
  const cards = tool.render.cards(manifest, 'use-case') + tool.render.cards(manifest, 'demo');
  assert.equal((cards.match(/<figure /g) || []).length, manifest.films.filter(f => f.tier === 'featured').length);
  for (const f of manifest.films.filter(x => x.tier === 'featured')) assert.ok(cards.includes(`data-film-id="${f.id}"`), f.id);
});

test('every film is reachable from its layer: the hero, a card, a version link on a card, or an effect card', () => {
  const cards = tool.render.cards(manifest, 'use-case') + tool.render.cards(manifest, 'demo') + tool.render.cards(manifest, 'demo', undefined, 'listed') + tool.render.cards(manifest, 'comparison', undefined, 'listed');
  for (const f of manifest.films) {
    if (f.tier === 'hero') assert.match(tool.render.hero(manifest), new RegExp(`data-film-id="${f.id}"`));
    else if (f.tier === 'in-card') assert.equal(f.layer, 'effect-film', f.id);
    else if (f.versionOf) assert.ok(cards.includes(`<a href="${f.media.mp4}">`), f.id + ' is linked from ' + f.versionOf);
    else assert.ok(cards.includes(`data-film-id="${f.id}"`), f.id + ' has a card');
  }
  const readme = tool.render.readmeCards(manifest);
  for (const f of manifest.films.filter(x => ['use-case', 'demo'].includes(x.layer) && tool.hasCard(x))) assert.ok(readme.includes(`<a href="${f.media.mp4}"><img`), f.id);
});

test('the README table keeps the columns tests/media.spec.cjs reads', () => {
  const lines = tool.render.readme(manifest).split('\n');
  for (const f of manifest.films) {
    const row = lines.find(l => l.startsWith('|') && l.includes('[poster]') && l.includes(`](${f.media.mp4})`));
    assert.ok(row, f.id);
    const cells = row.split('|').map(c => c.trim());
    assert.equal(parseFloat(cells[3]), f.duration, f.id);
    assert.equal(cells[4], f.format, f.id);
  }
});

test('count sentences name film counts but no exact effect count (D4)', () => {
  for (const text of [tool.render.count(manifest), tool.render.readme(manifest).split('\n')[0], tool.render.summary(manifest)]) {
    assert.doesNotMatch(text, /\d+\s+(effect families|families|effect techniques|techniques|effects\b|variants)/i, text);
    assert.match(text, new RegExp(String(manifest.films.length) + '|\\d+ use cases?'));
  }
});

test('fx/films-data.js exposes a frozen FXFilms list in manifest order', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'fx/films-data.js'), 'utf8'), { window });
  const films = window.FXFilms;
  assert.equal(films.length, manifest.films.length);
  assert.ok(Object.isFrozen(films) && Object.isFrozen(films[0].effects[0]));
  films.forEach((f, i) => {
    const m = manifest.films[i];
    assert.deepEqual(Object.keys(f), ['id', 'layer', 'tier', 'title', 'duration', 'format', 'page', 'media', 'effects']);
    assert.deepEqual(JSON.parse(JSON.stringify(f)), { id: m.id, layer: m.layer, tier: m.tier, title: m.title, duration: m.duration, format: m.format, page: m.page, media: m.media, effects: m.effects.map(e => e.at ? { id: e.id, at: e.at } : { id: e.id }) });
  });
});

test('the module keeps the interface tools/check-public.cjs depends on', () => {
  assert.equal(typeof tool.validate, 'function');
  assert.equal(typeof tool.sync, 'function');
  assert.equal(tool.films.length, manifest.films.length);
  for (const f of tool.films) assert.equal(f.source, f.page, f.id);
  assert.ok(!Object.keys(tool.films[0]).includes('source'), 'source is a compatibility alias, not manifest data');
});

test('formatJSON round-trips the manifest', () => {
  assert.deepEqual(JSON.parse(tool.formatJSON(manifest)), manifest);
});
