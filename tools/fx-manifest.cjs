// fx/manifest.json owns how the effect library loads: each code family's scripts in load order,
// its ?v= cache tag, the demos it registers with their source files, and the gallery order.
// This tool writes the generated blocks in index.html, video/intro.html, fx/gallery-meta.js and the README's
// effect overview (names by kind in gallery order, plus the code-family guides).
//   node tools/fx-manifest.cjs --check   fail when the manifest disagrees with the code or a block is stale
//   node tools/fx-manifest.cjs --write   rewrite the generated blocks
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = 'fx/manifest.json';
const GALLERY_FILE = 'fx/gallery-meta.js';
const SCRIPT_MARKERS = ['<!-- fx:scripts:start -->', '<!-- fx:scripts:end -->'];
const GALLERY_MARKERS = ['// fx:gallery:start', '// fx:gallery:end'];
const GALLERY_KEYS = ['order', 'showcaseOrder', 'previewDefault', 'previewHero', 'previewWindow'];
const README_FILE = 'README.md';
const README_MARKERS = ['<!-- fx:effects:start -->', '<!-- fx:effects:end -->'];
const isUrl = file => /^https:\/\//.test(file);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function load(root = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, MANIFEST), 'utf8'));
}

// Every script in load order: the families, then the catalogue that groups their demos.
function scripts(manifest) {
  return [...manifest.families, { id: 'catalog', ...manifest.catalog }].flatMap(group => group.scripts.map(file => ({
    file, family: group.id, src: isUrl(file) || !group.cacheTag ? file : `${file}?v=${group.cacheTag}`,
  })));
}

function renderScripts(manifest, page) {
  const up = path.posix.relative(path.posix.dirname(page), '.');
  return ['<!-- Generated from fx/manifest.json by tools/fx-manifest.cjs; edit the manifest, not these lines. -->',
    ...scripts(manifest).map(s => `<script src="${isUrl(s.src) || !up ? s.src : up + '/' + s.src}"></script>`)].join('\n');
}

function renderGallery(gallery) {
  const wrap = (items, indent) => {
    const lines = [];
    for (const item of items.map(x => JSON.stringify(x) + ',')) {
      if (lines.length && lines[lines.length - 1].length + item.length < 100) lines[lines.length - 1] += ' ' + item;
      else lines.push(indent + item);
    }
    return lines.join('\n');
  };
  const body = GALLERY_KEYS.map(key => Array.isArray(gallery[key])
    ? `    ${key}: [\n${wrap(gallery[key], '      ')}\n    ],`
    : `    ${key}: { ${Object.entries(gallery[key]).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} },`);
  return ['  // Generated from fx/manifest.json by tools/fx-manifest.cjs; edit the manifest, not this block.',
    '  const GALLERY = {', ...body, '  };'].join('\n');
}

// Keep both marker lines and replace everything between them.
function replaceBlock(text, [start, end], body, file) {
  const a = text.indexOf(start), b = text.indexOf(end);
  if (a < 0 || b < a || text.indexOf(start, a + 1) >= 0 || text.indexOf(end, b + 1) >= 0) throw new Error(`${file}: needs exactly one ${start} … ${end} block`);
  const afterStart = text.indexOf('\n', a) + 1, endLine = text.lastIndexOf('\n', b) + 1;
  return text.slice(0, afterStart) + body + '\n' + text.slice(endLine);
}

// README table of effect names by gallery kind, in gallery order, each linking to its live card; Motion basics last.
// No counts: the list grows and shrinks with the catalogue.
function renderReadmeEffects(manifest, root = ROOT) {
  const reg = registry(manifest, root), site = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).homepage.replace(/\/?$/, '/');
  const rank = id => manifest.gallery.order.indexOf(id), cell = text => String(text).replace(/\|/g, '\\|');
  const list = cards => [...cards].sort((a, b) => rank(a.id) - rank(b.id)).map(c => `[${cell(c.name)}](${site}#demo-${c.id})`).join(' · ');
  const rows = Object.entries(reg.kinds).map(([kind, label]) => [label, reg.cards.filter(c => !c.basic && c.kind === kind)]).filter(([, cards]) => cards.length);
  rows.push(['Motion basics', reg.cards.filter(c => c.basic)]);
  const guides = manifest.families.filter(f => f.readme).map(f => `[${f.id}](${f.readme})`).join(' · ');
  return ['| Kind | Effects, in gallery order |', '|---|---|', ...rows.map(([label, cards]) => `| ${cell(label)} | ${list(cards)} |`), '', `Code families with their own guide: ${guides}.`].join('\n');
}

function sync(check = false, root = ROOT, manifest = load(root)) {
  const targets = [...manifest.pages.map(page => [page, SCRIPT_MARKERS, renderScripts(manifest, page)]),
    [GALLERY_FILE, GALLERY_MARKERS, renderGallery(manifest.gallery)]];
  // The README block needs the full registry, so it is only written where the README carries its markers.
  const readme = path.join(root, README_FILE);
  if (fs.existsSync(readme) && fs.readFileSync(readme, 'utf8').includes(README_MARKERS[0])) targets.push([README_FILE, README_MARKERS, renderReadmeEffects(manifest, root)]);
  const stale = [];
  for (const [file, markers, body] of targets) {
    const absolute = path.join(root, file), old = fs.readFileSync(absolute, 'utf8'), next = replaceBlock(old, markers, body, file);
    if (old === next) continue;
    stale.push(file);
    if (!check) fs.writeFileSync(absolute, next);
  }
  if (check && stale.length) throw new Error(`Generated fx blocks are stale in ${stale.join(', ')}; run node tools/fx-manifest.cjs --write`);
  return stale;
}

// A browser-shaped global in which the registries can run their load-time code.
// Nothing is rendered: build() is never called, timers never fire and fetches never settle.
function sandbox() {
  const inert = new Proxy(function () {}, {
    get: (_, key) => key === Symbol.toPrimitive ? () => '' : key === Symbol.iterator ? function* () {} : key === 'then' ? undefined : inert,
    apply: () => inert, construct: () => inert, set: () => true,
  });
  const documentState = { currentScript: null };
  const context = vm.createContext({
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
    document: new Proxy(documentState, { get: (target, key) => own(target, key) ? target[key] : inert }),
    navigator: { userAgent: 'fx-manifest', language: 'en', hardwareConcurrency: 1 },
    location: new URL('https://fx.invalid/'),
    URL, URLSearchParams, TextEncoder, TextDecoder,
    devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720,
    performance: { now: () => 0 }, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: () => 0, cancelAnimationFrame() {}, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    addEventListener() {}, removeEventListener() {}, fetch: () => new Promise(() => {}),
    Image: inert, HTMLCanvasElement: inert, OffscreenCanvas: inert, ResizeObserver: inert, IntersectionObserver: inert,
    // Pinned CDN libraries are skipped below; packs that guard on window.THREE etc. still register.
    THREE: inert, Matter: inert, flubber: inert, PIXI: inert,
  });
  vm.runInContext('var window = globalThis, self = globalThis;', context);
  return { context, documentState };
}

// Load every local script in manifest order and record which script registered each FX.demo.
function registry(manifest = load(), root = ROOT) {
  const { context, documentState } = sandbox();
  const owner = new Map();
  for (const script of scripts(manifest)) {
    if (isUrl(script.file)) continue; // Pinned libraries are only used inside build().
    const before = context.FX ? context.FX.DEMOS.length : 0;
    documentState.currentScript = { src: 'https://fx.invalid/' + script.src };
    try {
      vm.runInContext(fs.readFileSync(path.join(root, script.file), 'utf8'), context, { filename: script.file });
    } catch (error) {
      throw new Error(`${script.file} failed while loading the registry: ${error.message}`);
    }
    for (const demo of context.FX ? context.FX.DEMOS.slice(before) : []) {
      if (!owner.has(demo.id)) owner.set(demo.id, { family: script.family, file: script.file });
    }
  }
  const catalog = context.FXCatalog;
  if (!catalog) throw new Error('FXCatalog was not defined; the catalogue must load last');
  // Kind labels live with the other gallery labels.
  let kinds = {};
  if (fs.existsSync(path.join(root, GALLERY_FILE))) {
    vm.runInContext(fs.readFileSync(path.join(root, GALLERY_FILE), 'utf8'), context, { filename: GALLERY_FILE });
    kinds = { ...(context.FXGalleryMeta?.KINDS || {}) };
  }
  return {
    kinds,
    cards: [...catalog.families.map(f => ({ id: f.id, name: f.name, kind: f.kind, basic: false })), ...(catalog.basics || []).map(f => ({ id: f.id, name: f.name, kind: f.kind, basic: true }))],
    owner,
    demos: [...catalog.byId.values()].map(d => ({ id: d.id, period: d.period, hero: d.hero, role: d.role, familyId: d.familyId })),
    // Motion basics are gallery cards too; they share the one order list with the effect families.
    families: [...catalog.families, ...(catalog.basics || [])].map(f => ({ id: f.id, entries: f.entries.map(e => e.id) })),
    showcases: catalog.showcases.map(f => f.id),
    stats: { ...catalog.stats },
  };
}

const keyOf = (family, id) => family.prefix && id.startsWith(family.prefix) ? id.slice(family.prefix.length) : id;
const anchorText = (family, id) => family.anchor.replaceAll('{id}', id).replaceAll('{key}', keyOf(family, id));
const lineAt = (text, offset) => text.slice(0, offset).split('\n').length;

// [{path, line}] for a demo: line is where the first source registers it (when the family has an
// anchor), otherwise 1. The private authoring menu can read this instead of hard-coding paths.
function sourceRefs(id, manifest = load(), root = ROOT) {
  const family = manifest.families.find(f => own(f.sources, id));
  if (!family) throw new Error('No fx/manifest.json sources for demo: ' + id);
  return family.sources[id].map((file, i) => {
    if (i || !family.anchor) return { path: file, line: 1 };
    const text = fs.readFileSync(path.join(root, file), 'utf8'), offset = text.indexOf(anchorText(family, id));
    if (offset < 0) throw new Error(`${id}: anchor ${anchorText(family, id)} not found in ${file}`);
    return { path: file, line: lineAt(text, offset) };
  });
}

function validateShape(manifest, root) {
  const errors = [];
  const inRepo = file => typeof file === 'string' && !path.isAbsolute(file) && !file.split('/').includes('..') && fs.existsSync(path.join(root, file)) && fs.statSync(path.join(root, file)).isFile();
  if (manifest.version !== 1) errors.push('version must be 1');
  if (!Array.isArray(manifest.families) || !manifest.families.length) return [...errors, 'families must be a non-empty array'];
  if (!isObject(manifest.catalog) || !Array.isArray(manifest.catalog.scripts)) errors.push('catalog.scripts must be an array');
  if (!Array.isArray(manifest.pages) || !manifest.pages.every(inRepo)) errors.push('pages must list existing HTML files');
  if (!isObject(manifest.gallery) || !GALLERY_KEYS.every(key => own(manifest.gallery, key))) errors.push(`gallery needs ${GALLERY_KEYS.join(', ')}`);
  const familyIds = new Set(), files = new Set();
  for (const group of [...manifest.families, { id: 'catalog', ...manifest.catalog }]) {
    const name = 'family ' + group.id;
    if (typeof group.id !== 'string' || !/^[a-z0-9-]+$/.test(group.id) || familyIds.has(group.id)) errors.push(`${name}: invalid or duplicate id`);
    familyIds.add(group.id);
    if (!Array.isArray(group.scripts) || !group.scripts.length) { errors.push(`${name}: scripts must be a non-empty array`); continue; }
    for (const file of group.scripts) {
      if (files.has(file)) errors.push(`${name}: ${file} is listed more than once`);
      files.add(file);
      if (!isUrl(file) && !(inRepo(file) && file.endsWith('.js'))) errors.push(`${name}: missing script ${file}`);
    }
    if (group.cacheTag !== null && !(typeof group.cacheTag === 'string' && /^[A-Za-z0-9._-]+$/.test(group.cacheTag))) errors.push(`${name}: cacheTag must be null or a short tag`);
    if (group.id === 'catalog') continue;
    if (group.readme !== null && !inRepo(group.readme)) errors.push(`${name}: missing readme ${group.readme}`);
    if (own(group, 'prefix') && !(typeof group.prefix === 'string' && group.prefix)) errors.push(`${name}: prefix must be a non-empty string`);
    if (own(group, 'anchor') && !(typeof group.anchor === 'string' && /\{(id|key)\}/.test(group.anchor))) errors.push(`${name}: anchor must contain {id} or {key}`);
    if (!isObject(group.sources)) { errors.push(`${name}: sources must map demo ids to files`); continue; }
    for (const [id, list] of Object.entries(group.sources)) {
      if (!Array.isArray(list) || !list.length || new Set(list).size !== list.length) errors.push(`${name}: ${id} needs a non-empty list of distinct files`);
      else for (const file of list) if (!inRepo(file)) errors.push(`${name}: ${id} source ${file} does not exist`);
    }
  }
  return errors;
}

// All problems as messages; an empty array means the manifest matches the code.
function validate(manifest = load(), root = ROOT) {
  const errors = validateShape(manifest, root);
  if (errors.length) return errors;
  let reg;
  try { reg = registry(manifest, root); } catch (error) { return [error.message]; }
  const claims = new Map();
  for (const family of manifest.families) for (const id of Object.keys(family.sources)) claims.set(id, [...(claims.get(id) || []), family.id]);
  for (const [id, { family, file }] of reg.owner) {
    const claimed = claims.get(id) || [];
    if (claimed.length !== 1) errors.push(`${id} (registered by ${file}) must belong to exactly one family; claimed by ${claimed.join(', ') || 'none'}`);
    else if (claimed[0] !== family) errors.push(`${id} is registered by ${file} in family ${family} but listed under ${claimed[0]}`);
  }
  for (const id of claims.keys()) if (!reg.owner.has(id)) errors.push(`${id} is listed in sources but no script registers it`);
  for (const family of manifest.families) {
    if (!family.anchor) continue;
    for (const id of Object.keys(family.sources)) {
      try { sourceRefs(id, manifest, root); } catch (error) { errors.push(error.message); }
    }
  }
  const { order, showcaseOrder, previewDefault, previewHero, previewWindow } = manifest.gallery;
  const ordered = (list, ids, name) => {
    if (!Array.isArray(list)) return errors.push(`gallery.${name} must be an array`);
    const seen = new Set();
    for (const id of list) {
      if (seen.has(id)) errors.push(`gallery.${name} repeats ${id}`);
      else if (!ids.includes(id)) errors.push(`gallery.${name} lists ${id}, which is not a gallery card of that kind`);
      seen.add(id);
    }
    for (const id of ids) if (!seen.has(id)) errors.push(`gallery.${name} is missing ${id}`);
  };
  ordered(order, reg.families.map(f => f.id), 'order');
  ordered(showcaseOrder, reg.showcases, 'showcaseOrder');
  const cards = new Map([...reg.families.map(f => [f.id, f.entries]), ...reg.showcases.map(id => [id, [id]])]);
  for (const [card, id] of Object.entries(isObject(previewDefault) ? previewDefault : {})) {
    if (!cards.has(card) || !cards.get(card).includes(id)) errors.push(`gallery.previewDefault: ${id} is not a variant of ${card}`);
  }
  const demos = new Map(reg.demos.map(d => [d.id, d]));
  for (const [id, t] of Object.entries(isObject(previewHero) ? previewHero : {})) {
    if (!demos.has(id)) errors.push(`gallery.previewHero: unknown demo ${id}`);
    else if (!(Number.isFinite(t) && t >= 0 && t <= demos.get(id).period)) errors.push(`gallery.previewHero: ${id} needs a time within its ${demos.get(id).period} s period`);
  }
  for (const [id, span] of Object.entries(isObject(previewWindow) ? previewWindow : {})) {
    const ok = Array.isArray(span) && span.length === 2 && span.every(Number.isFinite) && span[0] >= 0 && span[0] < span[1];
    if (!demos.has(id)) errors.push(`gallery.previewWindow: unknown demo ${id}`);
    else if (!ok || span[1] > demos.get(id).period) errors.push(`gallery.previewWindow: ${id} needs [start, end] within its ${demos.get(id).period} s period`);
  }
  if (!isObject(previewDefault) || !isObject(previewHero) || !isObject(previewWindow)) errors.push('gallery.previewDefault, gallery.previewHero and gallery.previewWindow must be objects');
  return errors;
}

if (require.main === module) {
  try {
    const command = process.argv[2];
    if (!['--check', '--write'].includes(command)) throw new Error('Usage: node tools/fx-manifest.cjs --check | --write');
    const manifest = load(), errors = validate(manifest);
    if (errors.length) throw new Error('fx/manifest.json does not match the code:\n- ' + errors.join('\n- '));
    const changed = sync(command === '--check', ROOT, manifest), { stats } = registry(manifest);
    console.log(`fx manifest OK: ${manifest.families.length} code families register ${stats.demos} demos in ${stats.techniques} effect families, ${stats.basics ?? 0} motion basics and ${stats.showcases} comparison and scene presets` +
      (command === '--write' ? `; ${changed.length ? 'updated ' + changed.join(', ') : 'nothing to update'}` : ''));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { load, scripts, renderScripts, renderGallery, renderReadmeEffects, registry, sourceRefs, validate, sync };
