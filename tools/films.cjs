// examples/films.json (version 2) is the only source for published films: layer, tier, card copy and the
// catalogue effects each film's source runs. This tool validates it against tools/films-schema.json and the
// repository, regenerates every marked film block and fx/films-data.js, and migrates a version 1 manifest.
// It never adds media.
//
//   node tools/films.cjs --check            validate; fail if a generated block or fx/films-data.js is stale
//   node tools/films.cjs --write            validate, then regenerate them (npm run sync:films)
//   node tools/films.cjs --verify           list where each film's source runs each listed effect
//   node tools/films.cjs --migrate          write examples/films.next.json from a v1 examples/films.json
//   node tools/films.cjs build <id|group>   render through video/build.sh
//
// While examples/films.json is still version 1, the generator reads examples/films.next.json and requires it
// to carry every v1 value unchanged; replacing films.json with films.next.json ends that transition.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = 'examples/films.json', NEXT = 'examples/films.next.json', SCHEMA = 'tools/films-schema.json', DATA = 'fx/films-data.js';
const clean = value => String(value).split(/[?#]/)[0];
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const readJSON = (file, root = ROOT) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const num = n => String(+(+n).toFixed(2));
const cap = s => s[0].toUpperCase() + s.slice(1);
// Featured films get a large card in their layer's section; other listed demo films and comparisons get a smaller
// one. A version of another film (versionOf: another cut, ratio or brand) is linked from its parent's card.
const CARD_LAYERS = ['use-case', 'demo', 'comparison'];
const hasCard = f => f.tier === 'featured' || (f.tier === 'listed' && f.versionOf === undefined && CARD_LAYERS.includes(f.layer));
// Media policy (D5): a film with a card, and the intro, has a silent loop (media.preview, cut by video/preview.py
// from window.__preview clips); only the intro keeps a GIF, the README hero. Versions and effect films have neither.
const needsPreview = f => f.tier === 'hero' || hasCard(f);

// ---------------------------------------------------------------- JSON Schema (the subset the schema uses)
function schemaErrors(schema, value, at = '$', root = schema) {
  if (schema.$ref) {
    const target = schema.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o[k], root);
    const rest = { ...schema }; delete rest.$ref;
    return [...schemaErrors(target, value, at, root), ...schemaErrors(rest, value, at, root)];
  }
  const errors = [], type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  if (schema.type && schema.type !== type && !(schema.type === 'integer' && Number.isInteger(value))) return [`${at}: expected ${schema.type}`];
  if ('const' in schema && JSON.stringify(schema.const) !== JSON.stringify(value)) errors.push(`${at}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: ${JSON.stringify(value)} is not one of ${schema.enum.join(', ')}`);
  if (type === 'string') {
    if (schema.minLength && value.length < schema.minLength) errors.push(`${at}: empty`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errors.push(`${at}: ${JSON.stringify(value)} does not match ${schema.pattern}`);
  }
  if (type === 'number') {
    if ('minimum' in schema && value < schema.minimum) errors.push(`${at}: below ${schema.minimum}`);
    if ('exclusiveMinimum' in schema && value <= schema.exclusiveMinimum) errors.push(`${at}: must exceed ${schema.exclusiveMinimum}`);
  }
  if (type === 'array') {
    if ('minItems' in schema && value.length < schema.minItems) errors.push(`${at}: needs at least ${schema.minItems} item(s)`);
    if ('maxItems' in schema && value.length > schema.maxItems) errors.push(`${at}: allows at most ${schema.maxItems} item(s)`);
    if (schema.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) errors.push(`${at}: items repeat`);
    if (schema.contains && !value.some(v => !schemaErrors(schema.contains, v, at, root).length)) errors.push(`${at}: must contain ${JSON.stringify(schema.contains.const)}`);
    if (schema.items) value.forEach((v, i) => errors.push(...schemaErrors(schema.items, v, `${at}[${i}]`, root)));
  }
  if (type === 'object') {
    for (const key of schema.required || []) if (!(key in value)) errors.push(`${at}: missing ${key}`);
    for (const [key, v] of Object.entries(value)) {
      if (schema.properties && key in schema.properties) errors.push(...schemaErrors(schema.properties[key], v, `${at}.${key}`, root));
      else if (schema.additionalProperties === false) errors.push(`${at}: unknown field ${key}`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------- effect catalogue
// Runs the registry scripts that index.html loads before fx/catalog.js in a stub browser, so ids, roles and card
// names come from the same code as the gallery. Builders are never called.
const catalogs = new Map();
function loadCatalog(root = ROOT) {
  if (catalogs.has(root)) return catalogs.get(root);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="(fx\/[^"]+)"/g)].map(m => clean(m[1]));
  const last = scripts.indexOf('fx/catalog.js');
  if (last < 0) throw new Error('index.html does not load fx/catalog.js');
  const any = new Proxy(function () {}, { get: (_, key) => key === Symbol.toPrimitive ? () => 0 : key === 'then' || typeof key === 'symbol' ? undefined : any, apply: () => any, construct: () => any });
  const document = new Proxy({ currentScript: { src: 'http://localhost/' } }, { get: (target, key) => key in target ? target[key] : any });
  const sandbox = { URL, console: { log() {}, info() {}, warn() {}, error() {} }, document, THREE: any, Matter: any, flubber: any, PIXI: any, navigator: { userAgent: '' }, location: { href: 'http://localhost/', search: '', hash: '' }, performance: { now: () => 0 }, devicePixelRatio: 1, requestAnimationFrame: () => 0, cancelAnimationFrame() {}, setTimeout: () => 0, clearTimeout() {}, addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }), getComputedStyle: () => any, fetch: () => any, Image: any, OffscreenCanvas: any, HTMLCanvasElement: any, customElements: any };
  sandbox.window = sandbox.self = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of scripts.slice(0, last + 1)) {
    document.currentScript = { src: 'http://localhost/' + file };
    try { vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file }); }
    catch (error) { throw new Error(`Cannot load the effect catalogue (${file}): ${error.message}`); }
  }
  const { byId: entries, families, showcases, basics = [] } = sandbox.FXCatalog;
  const cards = new Map([...families, ...basics, ...showcases].map(f => [f.id, f.name]));
  const byId = new Map([...entries.values()].map(e => [e.id, { id: e.id, role: e.role, familyId: e.familyId, name: e.name, card: cards.get(e.familyId) || e.name }]));
  const catalog = { byId };
  catalogs.set(root, catalog);
  return catalog;
}

// ---------------------------------------------------------------- source closure and effect evidence
// Files a film page can load: <script src>, static and literal dynamic imports, and every module in a directory
// that a registry resolves at run time (new URL('./dir/', document.currentScript.src)).
function closure(page, root = ROOT) {
  const files = new Set(), queue = [clean(page)];
  while (queue.length) {
    const file = queue.shift();
    if (files.has(file) || file.startsWith('..') || !fs.existsSync(path.join(root, file)) || !fs.statSync(path.join(root, file)).isFile()) continue;
    files.add(file);
    const text = fs.readFileSync(path.join(root, file), 'utf8'), dir = path.posix.dirname(file);
    const resolve = spec => spec.startsWith('/') ? path.posix.normalize(clean(spec).slice(1)) : path.posix.normalize(path.posix.join(dir, clean(spec)));
    const add = (spec, bare = false) => { if (/^[a-z]+:|^\/\//i.test(spec) || (!bare && !/^\.{0,2}\//.test(spec))) return; queue.push(resolve(spec)); };
    for (const m of text.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)) add(m[1], true);
    // Render wrappers for a format variant embed the film page itself (e.g. product.html?format=square).
    for (const m of text.matchAll(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/g)) add(m[1], true);
    for (const m of text.matchAll(/\b(?:import|export)\s+(?:[\w$*{}\s,]+?\s+from\s+)?["']([^"']+)["']/g)) add(m[1]);
    for (const m of text.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) add(m[1]);
    for (const m of text.matchAll(/new URL\(\s*["']([^"']+)["']\s*,\s*(?:document\.currentScript\.src|import\.meta\.url)/g)) {
      if (!m[1].endsWith('/')) { add(m[1]); continue; }
      const folder = resolve(m[1]);
      if (fs.existsSync(path.join(root, folder))) for (const name of fs.readdirSync(path.join(root, folder)).sort()) if (/\.m?js$/.test(name)) queue.push(path.posix.join(folder, name));
    }
  }
  return files;
}
const PREFIXES = ['studio-', 'design-', 'signal-', 'fluid-', 'stack-', 'optical-', 'dialogue-'];
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
// Evidence that the film's source runs an effect: an explicit [file, text] proof in a file the page loads, or
// the page itself naming the effect (data-fx, data-demo, or the quoted id with or without its family prefix).
// Registry files are never searched by default because they name every id. Runtime proofs are not executed here.
function evidence(film, effect, root = ROOT, files = closure(film.page, root)) {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  if (effect.proof) {
    const [file, token] = effect.proof;
    if (!files.has(file)) return { ok: false, why: `${file} is not loaded by ${clean(film.page)}` };
    const text = read(file), index = text.indexOf(token);
    return index < 0 ? { ok: false, why: `${JSON.stringify(token)} is not in ${file}` } : { ok: true, how: 'proof', file, line: lineOf(text, index), token };
  }
  const page = clean(film.page), text = read(page), id = effect.id;
  const short = PREFIXES.reduce((s, p) => s.startsWith(p) ? s.slice(p.length) : s, id);
  for (const token of [`data-fx="${id}"`, `data-demo="${id}"`, `'${id}'`, `"${id}"`, ...(short === id ? [] : [`'${short}'`, `"${short}"`])]) {
    const index = text.indexOf(token);
    if (index >= 0) return { ok: true, how: 'page', file: page, line: lineOf(text, index), token };
  }
  return { ok: false, why: `${page} does not name ${id}; add "proof": [file, text]` };
}

// ---------------------------------------------------------------- loading and validation
function load(root = ROOT) {
  const raw = readJSON(MANIFEST, root);
  if (raw.version === 2) return { manifest: raw, from: MANIFEST };
  if (raw.version !== 1) throw new Error(`${MANIFEST}: unknown version ${raw.version}`);
  if (!fs.existsSync(path.join(root, NEXT))) return { manifest: migrate(raw, null), from: null, v1: raw };
  return { manifest: readJSON(NEXT, root), from: NEXT, v1: raw };
}
function validateManifest(manifest, { root = ROOT, catalog = loadCatalog(root) } = {}) {
  const schema = readJSON(SCHEMA, root), errors = schemaErrors(schema, manifest);
  if (errors.length) return errors;
  const layerIds = manifest.layers.map(l => l.id), allLayers = schema.$defs.layer.enum;
  if (new Set(layerIds).size !== layerIds.length || allLayers.some(l => !layerIds.includes(l))) errors.push('layers: list each of ' + allLayers.join(', ') + ' once');
  const byId = new Map();
  for (const film of manifest.films) {
    const where = 'film ' + film.id;
    if (byId.has(film.id)) errors.push(where + ': duplicate id');
    byId.set(film.id, film);
    if ((film.layer === 'intro') !== (film.tier === 'hero')) errors.push(where + ': only the intro uses the hero tier, and the intro is the hero');
    if ((film.layer === 'effect-film') !== (film.tier === 'in-card')) errors.push(where + ': effect films, and only they, play in-card');
    if (film.tier === 'featured' && !['use-case', 'demo'].includes(film.layer)) errors.push(where + ': only use cases and demo films have featured cards');
    if (film.tier === 'featured' && !(film.card.useFor && film.card.relation)) errors.push(where + ': a featured card needs useFor and relation');
    if (film.versionOf !== undefined && film.tier !== 'listed') errors.push(where + ': only a listed film can be a version of another film');
    if (film.tier === 'listed' && film.layer === 'use-case' && film.versionOf === undefined) errors.push(where + ': a listed use case must be a version (versionOf) of a use case with a card');
    const ids = new Set(film.effects.map(e => e.id));
    if (film.layer === 'effect-film' && ids.size > 1 && film.effects.some(e => !e.at)) errors.push(where + ': a sampler gives every effect its [start, end]');
    for (const effect of film.effects) {
      if (effect.at && !(effect.at[0] < effect.at[1] && effect.at[1] <= film.duration + 1e-9)) errors.push(`${where}: ${effect.id} at [${effect.at}] is outside 0–${film.duration} s`);
      const same = film.effects.filter(e => e.id === effect.id);
      if (same.length > 1 && (same.some(e => !e.at) || same.some(e => e !== effect && e.at[0] < effect.at[1] && effect.at[0] < e.at[1]))) errors.push(`${where}: ${effect.id} repeats without separate [start, end] spans`);
    }
    for (const entry of [...film.effects, ...(film.related || [])]) if (!catalog.byId.has(entry.id)) errors.push(`${where}: ${entry.id} is not in the effect catalogue`);
    for (const entry of film.related || []) if (ids.has(entry.id)) errors.push(`${where}: ${entry.id} is in both effects and related`);
    if (film.becomes && film.becomes.layer === film.layer) errors.push(where + ': becomes names its current layer');
    if (film.mergeInto && !(film.retire === undefined && film.becomes === undefined)) errors.push(where + ': choose one of mergeInto, retire and becomes');
    if (film.retire && film.becomes) errors.push(where + ': choose one of mergeInto, retire and becomes');
    if (needsPreview(film) !== (film.media.preview !== undefined)) errors.push(where + (needsPreview(film) ? ': a film with a card (or the intro) needs media.preview, its silent loop' : ': only a film with a card (or the intro) has media.preview'));
    if (film.media.gif !== undefined && film.tier !== 'hero') errors.push(where + ': only the intro keeps a GIF (the README hero); cards play media.preview');
    const files = [film.page, ...Object.values(film.media), ...(film.card.guide ? [film.card.guide] : [])];
    for (const file of files) {
      const target = path.resolve(root, clean(file));
      if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) errors.push(`${where}: missing or outside file ${file}`);
    }
    if (fs.existsSync(path.join(root, clean(film.page)))) {
      const reach = closure(film.page, root);
      for (const effect of film.effects) { const found = evidence(film, effect, root, reach); if (!found.ok) errors.push(`${where}: ${effect.id}: ${found.why}`); }
    }
  }
  if (manifest.films.filter(f => f.layer === 'intro').length !== 1) errors.push('films: exactly one intro');
  for (const film of manifest.films) if (film.mergeInto && (!byId.has(film.mergeInto) || film.mergeInto === film.id || byId.get(film.mergeInto).mergeInto)) errors.push(`film ${film.id}: cannot merge into ${film.mergeInto}`);
  for (const film of manifest.films) if (film.versionOf !== undefined) {
    const parent = byId.get(film.versionOf);
    if (!parent || parent.layer !== film.layer || !hasCard(parent)) errors.push(`film ${film.id}: versionOf ${film.versionOf} must name a film with a card in the same layer`);
  }
  const expected = manifest.films.flatMap(f => Object.values(f.media).map(clean)).sort();
  if (fs.existsSync(path.join(root, 'media'))) {
    const actual = fs.readdirSync(path.join(root, 'media')).filter(n => !n.startsWith('.') && !n.endsWith('_hq.mp4')).map(n => 'media/' + n).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push('media/ differs from the published film manifest: ' + [...actual.filter(f => !expected.includes(f)).map(f => '+' + f), ...expected.filter(f => !actual.includes(f)).map(f => '-' + f)].join(' '));
  }
  return errors;
}
function validate(root = ROOT) {
  const state = load(root), errors = [];
  if (state.v1 && !state.from) errors.push(`${MANIFEST} is version 1 and ${NEXT} is missing: run node tools/films.cjs --migrate`);
  if (state.v1 && state.from) {
    errors.push(...compareV1(state.v1, state.manifest).filter(r => r.status === 'lost').map(r => `${NEXT} loses ${r.id}.${r.field} from ${MANIFEST}`));
    if (formatJSON(migrate(state.v1, state.manifest)) !== formatJSON(state.manifest)) errors.push(`${NEXT} is stale against ${MANIFEST}: run node tools/films.cjs --migrate`);
  }
  errors.push(...validateManifest(state.manifest, { root }));
  if (errors.length) throw new Error(errors.join('\n'));
  return state;
}

// ---------------------------------------------------------------- migration from version 1
const DEFAULT_LAYERS = [
  { id: 'intro', title: 'Intro', singular: 'intro', description: 'What the repository makes and how a page becomes an MP4.' },
  { id: 'use-case', title: 'Use cases', singular: 'use case', description: 'Start from a familiar video format and replace its copy, data or brand.' },
  { id: 'demo', title: 'Demo films', singular: 'demo film', description: 'Finished pieces that combine several effects around one subject or story.' },
  { id: 'comparison', title: 'Comparisons', singular: 'comparison', description: 'The same input under different treatments, for choosing an effect.' },
  { id: 'effect-film', title: 'Effect films', singular: 'effect film', description: 'Full renders of one effect; each also plays inside its effect card.' },
];
const KIND_LAYER = { Overview: 'intro', 'Use case': 'use-case', Sequence: 'demo', Comparison: 'comparison' };
const FIELD_ORDER = ['id', 'layer', 'tier', 'versionOf', 'title', 'summary', 'duration', 'format', 'page', 'media', 'card', 'audience', 'effects', 'related', 'groups', 'mergeInto', 'retire', 'becomes', 'plan'];
const ordered = (object, keys) => Object.fromEntries(keys.filter(k => object[k] !== undefined).map(k => [k, object[k]]));
// v1 owns title, duration, format, source (now page), media, groups and description (now summary) until the
// swap; everything else comes from the previous v2 entry or, for a new film, from its v1 kind and section.
function migrate(v1, previous) {
  const old = new Map((previous?.films || []).map(f => [f.id, f]));
  const rank = id => old.has(id) ? [...old.keys()].indexOf(id) : old.size + v1.films.findIndex(f => f.id === id);
  const films = [...v1.films].sort((a, b) => rank(a.id) - rank(b.id)).map(f => {
    const prior = old.get(f.id);
    const layer = prior?.layer ?? KIND_LAYER[f.kind] ?? 'effect-film';
    const tier = prior?.tier ?? (layer === 'intro' ? 'hero' : layer === 'effect-film' ? 'in-card' : f.section === 'uses' ? 'featured' : 'listed');
    const effects = (prior?.effects ?? (f.effects || []).map(e => ({ id: e.id }))).map(e => ({ ...e }));
    const related = (prior?.related ?? []).map(e => ({ ...e }));
    for (const e of f.effects || []) {
      const target = effects.find(x => x.id === e.id) || related.find(x => x.id === e.id);
      if (target) target.label = e.label; else related.push({ id: e.id, label: e.label });
    }
    const film = {
      ...prior, id: f.id, layer, tier, title: f.title, summary: f.description ?? prior?.summary ?? f.title,
      duration: f.duration, format: f.format, page: f.source, media: { ...f.media },
      card: prior?.card ?? { headline: f.title, description: f.description ?? f.title },
      audience: prior?.audience ?? '', groups: [...f.groups],
      effects: effects.map(e => ordered(e, ['id', 'at', 'label', 'proof'])),
      related: related.length ? related.map(e => ordered(e, ['id', 'label'])) : undefined,
    };
    film.card = ordered(film.card, ['headline', 'description', 'useFor', 'relation', 'guide']);
    film.media = ordered(film.media, ['mp4', 'poster', 'preview', 'gif']);
    return ordered(film, FIELD_ORDER);
  });
  return { $schema: '../tools/films-schema.json', version: 2, layers: previous?.layers ?? DEFAULT_LAYERS, films };
}
// One row per v1 field: where its value lives in v2 and whether it is unchanged.
function compareV1(v1, v2) {
  const rows = [], next = new Map(v2.films.map(f => [f.id, f]));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const f of v1.films) {
    const g = next.get(f.id);
    if (!g) { rows.push({ id: f.id, field: 'film', status: 'lost' }); continue; }
    for (const [field, to, value] of [['title', 'title', g.title], ['duration', 'duration', g.duration], ['format', 'format', g.format], ['source', 'page', g.page], ['media', 'media', g.media], ['groups', 'groups', g.groups], ...(f.description === undefined ? [] : [['description', 'summary', g.summary]])])
      rows.push({ id: f.id, field, to, status: field === 'media' ? (Object.entries(f.media).every(([k, v]) => g.media[k] === v) ? 'kept' : 'lost') : same(f[field], value) ? 'kept' : 'lost' });
    rows.push({ id: f.id, field: 'kind/section', to: 'layer/tier', status: 'mapped', detail: `${f.kind}/${f.section} → ${g.layer}/${g.tier}` });
    for (const e of f.effects || []) {
      const inEffects = g.effects.find(x => x.id === e.id), inRelated = (g.related || []).find(x => x.id === e.id), hit = inEffects || inRelated;
      rows.push({ id: f.id, field: 'effects.' + e.id, to: inEffects ? 'effects' : inRelated ? 'related' : null, status: hit && hit.label === e.label ? 'kept' : 'lost', detail: e.label });
    }
  }
  for (const g of v2.films) if (!v1.films.some(f => f.id === g.id)) rows.push({ id: g.id, field: 'film', status: 'added' });
  return rows;
}
// JSON with short arrays and small flat objects on one line, so diffs of films.json stay readable.
function formatJSON(value, indent = '') {
  const flat = v => v === null || typeof v !== 'object' || (Array.isArray(v) && v.every(x => x === null || typeof x !== 'object'));
  if (flat(value)) return Array.isArray(value) ? '[' + value.map(v => JSON.stringify(v)).join(', ') + ']' : JSON.stringify(value);
  const inner = indent + '  ';
  if (!Array.isArray(value) && Object.values(value).every(flat)) {
    const line = '{' + Object.entries(value).map(([k, v]) => JSON.stringify(k) + ': ' + formatJSON(v)).join(', ') + '}';
    if (line.length + inner.length <= 160) return line;
  }
  const parts = Array.isArray(value) ? value.map(v => inner + formatJSON(v, inner)) : Object.entries(value).map(([k, v]) => inner + JSON.stringify(k) + ': ' + formatJSON(v, inner));
  return (Array.isArray(value) ? '[\n' : '{\n') + parts.join(',\n') + '\n' + indent + (Array.isArray(value) ? ']' : '}');
}

// ---------------------------------------------------------------- generated blocks
function context(manifest, root = ROOT) {
  const catalog = loadCatalog(root), layers = new Map(manifest.layers.map(l => [l.id, l])), byId = new Map(manifest.films.map(f => [f.id, f]));
  const repo = readJSON('package.json', root).repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
  const source = file => `${repo}/blob/main/${clean(file)}`;
  const label = e => e.label || catalog.byId.get(e.id)?.name || e.id;
  const span = (film, e) => e.at ? `${num(e.at[0])}–${num(e.at[1])} s` : '';
  const grouped = manifest.layers.map(l => [l, manifest.films.filter(f => f.layer === l.id)]);
  const plan = f => f.mergeInto ? `to be merged into ${byId.get(f.mergeInto).title}` : f.retire ? 'to be retired' : f.becomes ? `to become a ${layers.get(f.becomes.layer).singular}: ${f.becomes.headline}` : '';
  const placement = (f, inList = false) => {
    const base = f.tier === 'hero' ? 'Top of the page' : hasCard(f) ? `Card in ${layers.get(f.layer).title}` : f.versionOf ? `Linked from the ${byId.get(f.versionOf).title} card`
      : f.tier === 'listed' ? (inList ? 'This list only' : 'Film list only')
      : (cards => `Effect card${cards.length > 1 ? 's' : ''}: ${cards.join(', ')}`)([...new Set(f.effects.map(e => catalog.byId.get(e.id).card))]);
    return base + (plan(f) ? '; ' + plan(f) : '');
  };
  const parts = grouped.map(([l, list]) => `${list.length} ${list.length === 1 ? l.singular : l.title.toLowerCase()}`);
  return { catalog, layers, byId, source, label, span, grouped, plan, placement, parts };
}
// "Clear (9:16)" and "Titles (vertical)" → "9:16"; "This weekend only (bakery)" → "bakery, 9:16".
const FORMAT_WORDS = { vertical: '9:16', square: '1:1', portrait: '4:5', landscape: '16:9' };
const versionLabel = v => {
  const m = v.title.match(/\(([^)]+)\)\s*$/), label = m ? m[1] : v.title;
  return label === v.format || FORMAT_WORDS[label] === v.format ? v.format : `${label}, ${v.format}`;
};
// Cards for one layer: tier 'featured' gives the large cards, 'listed' the smaller ones (versions are links on their parent).
// The card plays its silent loop only while on screen (fx/gallery-page.js); preload="none" keeps the page from
// fetching loops it never shows, and with reduced motion the loop stays on its poster.
function renderCards(manifest, layer, root = ROOT, tier = 'featured') {
  const c = context(manifest, root);
  return manifest.films.filter(f => f.layer === layer && f.tier === tier && hasCard(f)).map(f => {
    const meta = `${num(f.duration)} s · ${f.format}`, title = esc(f.card.headline);
    const loop = f.media.preview ? `<video class="film-loop" muted loop playsinline preload="none" data-poster="${esc(f.media.poster)}" src="${esc(f.media.preview)}" aria-hidden="true"></video>`
      : `<img src="${esc(f.media.poster)}" alt="${title} poster" loading="lazy">`;
    const guide = f.card.guide ? `<a href="${esc(c.source(f.card.guide))}">Edit guide</a>` : `<a href="${esc(c.source(f.page))}">View source</a>`;
    // Explore links carry the title of the card they open, once per card (a variant opens its family's card).
    const cardOf = e => c.catalog.byId.get(e.id).card;
    const explore = f.effects.filter((e, i, all) => all.findIndex(x => cardOf(x) === cardOf(e)) === i).map(e => `<a href="#demo-${e.id}">${esc(cardOf(e))}</a>`).join(' · ');
    const versions = manifest.films.filter(v => v.versionOf === f.id).map(v => `<a href="${esc(v.media.mp4)}">${esc(versionLabel(v))}</a>`).join(' · ');
    return `      <figure id="film-${f.id}" data-film-id="${f.id}"${f.tier === 'featured' ? '' : ' class="compact"'}>
        <div class="film-preview">${loop}<button type="button" aria-label="Play ${title} video">▶ Play with sound</button><video hidden controls playsinline preload="none" data-poster="${esc(f.media.poster)}" src="${esc(f.media.mp4)}" aria-label="${title}, ${meta}, with sound"></video></div>
        <figcaption><b>${title}</b><span class="film-meta">${meta}</span><p>${esc(f.card.description)}</p>${f.card.useFor ? `<p><strong>Use for:</strong> ${esc(f.card.useFor)}</p>` : ''}${f.card.relation ? `<p class="film-relation">${esc(f.card.relation)}</p>` : ''}${versions ? `<p class="film-versions">Also rendered: ${versions}</p>` : ''}<p class="film-links"><a href="${esc(f.page)}">Scrub timeline</a> · ${guide}</p><p class="film-effects">Explore: ${explore}</p></figcaption>
      </figure>`;
  }).join('\n');
}
const FOLD_EFFECTS = 12;
function renderList(manifest, root = ROOT) {
  const c = context(manifest, root);
  return c.grouped.filter(([, list]) => list.length).map(([layer, list]) => {
    const rows = list.map(f => {
      const ownElement = f.tier === 'hero' || hasCard(f);
      const effects = f.effects.map(e => `<a href="#demo-${e.id}">${esc(c.label(e))}</a>${e.at ? ` <a href="${esc(f.media.mp4)}#t=${num(e.at[0])},${num(e.at[1])}">${c.span(f, e)}</a>` : ''}`).join(' · ');
      const listed = f.effects.length > FOLD_EFFECTS ? `<details class="film-effects"><summary>Effects · ${f.effects.length} uses</summary><p>${effects}</p></details>` : `<p class="film-effects">Effects: ${effects}</p>`;
      const related = (f.related || []).map(e => `<a href="#demo-${e.id}">${esc(c.label(e))}</a>`).join(' · ');
      const watch = [`<a href="${esc(f.media.mp4)}">Play MP4</a>`, `<a href="${esc(f.page)}">Scrub timeline</a>`, ...(f.media.gif ? [`<a href="${esc(f.media.gif)}">GIF</a>`] : [])].join(' · ');
      return `<tr${ownElement ? '' : ` id="film-${f.id}"`} data-film-index-id="${f.id}" data-film-layer="${f.layer}" data-film-tier="${f.tier}"><td>${esc(c.placement(f, true))}</td><td><b>${esc(f.title)}</b><span class="film-meta">${num(f.duration)} s · ${f.format}</span><p>${esc(f.summary)}</p>${listed}${related ? `<p class="film-effects">Related, not in this film: ${related}</p>` : ''}</td><td>${watch}</td></tr>`;
    }).join('\n');
    return `<section class="film-index-group" data-film-kind="${layer.id}"><h3>${esc(layer.title)} · ${list.length}</h3><p class="note">${esc(layer.description)}</p>\n<div class="scroll"><table><thead><tr><th>Where</th><th>Film and purpose</th><th>Watch / edit</th></tr></thead><tbody>\n${rows}\n</tbody></table></div></section>`;
  }).join('\n');
}
function renderHero(manifest) {
  const f = manifest.films.find(x => x.tier === 'hero');
  return `    <video id="film-${f.id}" class="intro" data-film-id="${f.id}" controls playsinline preload="metadata" poster="${esc(f.media.poster)}" src="${esc(f.media.mp4)}" aria-label="${esc(f.title)} video, ${Math.round(f.duration)} seconds, with sound"></video>`;
}
const renderSummary = manifest => `All ${manifest.films.length} films by layer`;
function renderCount(manifest, root = ROOT) {
  return `${context(manifest, root).parts.join(' · ')}. Effect films also play inside their effect cards. Effect links name the library operations each film’s source runs; related links name operations it does not run.`;
}
function renderReadme(manifest, root = ROOT) {
  const c = context(manifest, root), parts = c.parts;
  const rows = c.grouped.flatMap(([layer, list]) => list.map(f => {
    const preview = [...(f.media.preview ? [`[loop](${f.media.preview})`] : []), ...(f.media.gif ? [`[GIF](${f.media.gif})`] : []), `[poster](${f.media.poster})`].join(' · ');
    return `| ${cap(layer.singular)}${c.plan(f) ? ' · ' + c.plan(f) : ''} | [${f.title}](${f.media.mp4}) | ${num(f.duration)} s | ${f.format} | ${preview} | [HTML](${f.page}) |`;
  }));
  return [`${manifest.films.length} published films: ${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}. Effect films also play inside their effect cards.`, '',
    '| Layer | Film | Authored length | Format | Preview | Source |', '|---|---|---:|---|---|---|', ...rows].join('\n');
}
// README overview: every use case and demo film that has a card on the site, three to a row.
function renderReadmeCards(manifest, root = ROOT) {
  const c = context(manifest, root), out = [];
  for (const layer of manifest.layers.filter(l => ['use-case', 'demo'].includes(l.id))) {
    const list = manifest.films.filter(f => f.layer === layer.id && hasCard(f));
    if (!list.length) continue;
    const cells = list.map(f => {
      const still = f.media.poster, versions = manifest.films.filter(v => v.versionOf === f.id).map(v => `<a href="${esc(v.media.mp4)}">${esc(versionLabel(v))}</a>`).join(' · ');
      return `<td width="33%" valign="top"><a href="${esc(f.media.mp4)}"><img src="${esc(still)}" alt="${esc(f.card.headline)}" width="100%"></a><br><b>${esc(f.card.headline)}</b> · ${num(f.duration)} s · ${f.format}<br>${esc(f.card.description)}${f.card.useFor ? `<br><sub><b>Use for:</b> ${esc(f.card.useFor)}</sub>` : ''}${versions ? `<br><sub>Also rendered: ${versions}</sub>` : ''}<br><a href="${esc(f.page)}">Source</a>${f.card.guide ? ` · <a href="${esc(f.card.guide)}">edit guide</a>` : ''}</td>`;
    });
    const rows = [];
    for (let i = 0; i < cells.length; i += 3) rows.push('<tr>\n' + cells.slice(i, i + 3).join('\n') + '\n</tr>');
    out.push(`**${layer.title}**`, '', '<table>', ...rows, '</table>', '');
  }
  return out.join('\n').trim();
}
function renderGuide(manifest, root = ROOT) {
  const c = context(manifest, root);
  return ['| Film | Layer | Role | Placement |', '|---|---|---|---|', ...c.grouped.flatMap(([layer, list]) => list.map(f => `| ${f.title} | ${cap(layer.singular)} | ${f.summary} | ${c.placement(f)} |`))].join('\n');
}
function renderData(manifest) {
  const rows = manifest.films.map(f => '    ' + JSON.stringify({ id: f.id, layer: f.layer, tier: f.tier, title: f.title, duration: f.duration, format: f.format, page: f.page, media: f.media, effects: f.effects.map(e => ordered({ id: e.id, at: e.at }, ['id', 'at'])) }));
  return `// Generated by tools/films.cjs from examples/films.json. Do not edit; run npm run sync:films.
// Every published film with the catalogue effects its source runs ([start, end] in seconds where a film shows an
// effect in one segment). The gallery derives its effect → film links from this list.
(() => {
  const films = [
${rows.join(',\n')}
  ];
  const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  window.FXFilms = freeze(films);
})();
`;
}
const BLOCKS = [
  { file: 'index.html', name: 'films:hero', render: renderHero },
  { file: 'index.html', name: 'films:uses', render: (m, r) => renderCards(m, 'use-case', r) },
  { file: 'index.html', name: 'films:demos', render: (m, r) => renderCards(m, 'demo', r) },
  { file: 'index.html', name: 'films:demos-more', render: (m, r) => renderCards(m, 'demo', r, 'listed') },
  { file: 'index.html', name: 'films:comparisons', render: (m, r) => renderCards(m, 'comparison', r, 'listed') },
  { file: 'index.html', name: 'films:summary', inline: true, render: renderSummary },
  { file: 'index.html', name: 'films:count', inline: true, render: renderCount },
  { file: 'index.html', name: 'films', render: renderList },
  { file: 'README.md', name: 'films:cards', render: renderReadmeCards },
  { file: 'README.md', name: 'films', render: renderReadme },
  { file: 'fx/VIEWING-GUIDE.md', name: 'films:guide', render: renderGuide },
];
function replaceBlock(text, { file, name, inline }, body) {
  const start = `<!-- ${name}:start -->`, end = `<!-- ${name}:end -->`, from = text.indexOf(start), to = text.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Missing generated film markers ${start} … ${end} in ${file}`);
  if (inline) return text.slice(0, from + start.length) + body + text.slice(to);
  const lineStart = text.lastIndexOf('\n', to) + 1, indent = /^\s*$/.test(text.slice(lineStart, to)) ? text.slice(lineStart, to) : '';
  return text.slice(0, from + start.length) + '\n' + body + '\n' + indent + text.slice(to);
}
function sync(check = false, root = ROOT) {
  const { manifest } = load(root), stale = [], outputs = new Map();
  for (const block of BLOCKS) {
    const file = path.join(root, block.file), before = outputs.get(file) ?? fs.readFileSync(file, 'utf8');
    const after = replaceBlock(before, block, block.render(manifest, root));
    if (after !== before) stale.push(`${block.file} ${block.name}`);
    outputs.set(file, after);
  }
  const data = path.join(root, DATA), body = renderData(manifest);
  if (!fs.existsSync(data) || fs.readFileSync(data, 'utf8') !== body) stale.push(DATA);
  outputs.set(data, body);
  if (check && stale.length) throw new Error('Stale generated film output (run npm run sync:films): ' + stale.join(', '));
  if (!check) for (const [file, text] of outputs) if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);
  return stale;
}

// Compatibility for consumers of the v1 shape (tools/check-public.cjs reads film.source).
const withSource = list => list.map(f => Object.defineProperty({ ...f }, 'source', { value: f.page, enumerable: false }));
const films = withSource(load().manifest.films);

if (require.main === module) {
  try {
    const [command, selection] = process.argv.slice(2);
    if (command === '--migrate') {
      const raw = readJSON(MANIFEST);
      if (raw.version !== 1) throw new Error(`${MANIFEST} is already version ${raw.version}; edit it directly`);
      const previous = fs.existsSync(path.join(ROOT, NEXT)) ? readJSON(NEXT) : null, next = migrate(raw, previous);
      fs.writeFileSync(path.join(ROOT, NEXT), formatJSON(next) + '\n');
      const rows = compareV1(raw, next);
      for (const r of rows) console.log(`${r.status.padEnd(6)} ${r.id.padEnd(19)} ${r.field}${r.to && r.to !== r.field ? ' → ' + r.to : ''}${r.detail ? '  (' + r.detail + ')' : ''}`);
      const lost = rows.filter(r => r.status === 'lost');
      console.log(`Wrote ${NEXT}: ${next.films.length} films; ${rows.filter(r => r.status === 'kept').length} v1 values kept, ${lost.length} lost. Run --check next.`);
      if (lost.length) process.exitCode = 1;
    } else if (command === '--verify') {
      const { manifest } = validate();
      for (const film of manifest.films) {
        const reach = closure(film.page);
        for (const e of film.effects) { const r = evidence(film, e, ROOT, reach); console.log(`${film.id.padEnd(19)} ${e.id.padEnd(24)} ${(e.at ? '[' + e.at.map(num).join(', ') + ']' : '').padEnd(12)} ${r.how.padEnd(5)} ${r.file}:${r.line}  ${r.token}`); }
      }
    } else if (command === 'build') {
      const chosen = films.filter(f => f.id === selection || f.groups.includes(selection));
      if (!chosen.length) throw new Error('Unknown film/group: ' + selection);
      validate();
      for (const film of chosen) {
        const result = spawnSync('bash', ['video/build.sh', clean(film.page)], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, FX_FILM_NAME: film.id } });
        if (result.status !== 0) process.exit(result.status || 1);
      }
    } else if (command === '--check' || command === '--write') {
      const state = validate(), stale = sync(command === '--check');
      const m = state.manifest, c = context(m);
      console.log(`${m.films.length} films (${c.parts.join(' · ')}); ${m.films.filter(f => f.tier === 'featured').length} featured; ${m.films.reduce((n, f) => n + f.effects.length, 0)} effect links with source evidence; ${m.films.reduce((n, f) => n + Object.keys(f.media).length, 0)} media files; manifest ${state.from}${state.v1 ? ` (${MANIFEST} is v1: replace it with ${NEXT})` : ''}${command === '--write' && stale.length ? '; updated ' + stale.join(', ') : ''}`);
    } else throw new Error('Usage: node tools/films.cjs --check | --write | --verify | --migrate | build <id|group>');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { films, needsPreview, validate, sync, load, migrate, compareV1, validateManifest, schemaErrors, loadCatalog, closure, evidence, formatJSON, render: { hero: renderHero, cards: renderCards, list: renderList, summary: renderSummary, count: renderCount, readme: renderReadme, readmeCards: renderReadmeCards, guide: renderGuide, data: renderData }, BLOCKS, hasCard };
