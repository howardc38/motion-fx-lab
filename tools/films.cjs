// examples/films.json owns the published film inventory. This tool never adds media.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const { films } = require('../examples/films.json');
const clean = value => value.split('?')[0];
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sections = [
  ['sequences', 'Finished sequences', 'Sequences built around a subject, performance and continuous motion.'],
  ['uses', 'Use-case templates', 'Start here for a social ad, interface walkthrough, data story or reusable background.'],
  ['comparisons', 'Effect comparison', 'Compare eight operations against the same choreography.'],
  ['studies', 'Single-effect films', 'Longer exports for inspecting material, lighting or simulation behaviour.'],
];
function validate(root = ROOT) {
  const ids = new Set();
  for (const f of films) {
    if (ids.has(f.id) || !/^[a-z0-9-]+$/.test(f.id)) throw new Error('Invalid/duplicate film: ' + f.id);
    ids.add(f.id);
    if (![...sections.map(s => s[0]), 'supporting'].includes(f.section)) throw new Error('Invalid section: ' + f.id);
    for (const file of [f.source, ...Object.values(f.media)]) {
      const target = path.resolve(root, clean(file));
      if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) throw new Error('Missing/outside film file: ' + file);
    }
  }
  const expected = films.flatMap(f => Object.values(f.media).map(clean)).sort();
  const actual = fs.readdirSync(path.join(root, 'media')).filter(n => !n.startsWith('.') && !n.endsWith('_hq.mp4')).map(n => 'media/' + n).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('media/ differs from the published film manifest');
}
function renderIndex() {
  const featured = new Set(['reel','product','infographic','broll','style-journey','character-dialogue','water-forms']);
  return sections.map(([key, title, description]) => {
    const entries = films.filter(f => f.section === key);
    const rows = entries.map(f => `<tr${featured.has(f.id) ? '' : ` id="film-${f.id}"`} data-film-index-id="${f.id}"><td>${esc(f.kind)}</td><td><b>${esc(f.title)}</b><span class="film-meta">${f.duration} s</span><p>${esc(f.description)}</p><p class="film-effects">Related: ${f.effects.map(e => `<a href="#demo-${e.id}">${esc(e.label)}</a>`).join(' · ')}</p></td><td><a href="${esc(f.media.mp4)}">Play MP4</a> · <a href="${esc(f.source)}">Timeline</a> · <a href="${esc(f.media.gif)}">GIF</a></td></tr>`).join('\n');
    return `<section class="film-index-group" data-film-kind="${key}"><h3>${title} · ${entries.length}</h3><p class="note">${description}</p>\n<div class="scroll"><table><thead><tr><th>Type</th><th>Film and purpose</th><th>Watch / edit</th></tr></thead><tbody>\n${rows}\n</tbody></table></div></section>`;
  }).join('\n');
}
function renderReadme() {
  const table = entries => ['| Type | Film | Authored length | Format | Preview | Source |','|---|---|---:|---|---|---|',...entries.map(f => `| ${f.kind} | [${f.title}](${f.media.mp4}) | ${f.duration} s | ${f.format} | [GIF](${f.media.gif}) · [poster](${f.media.poster}) | [HTML](${f.source}) |`)].join('\n');
  return [...sections.map(([key, title]) => `### ${title} · ${films.filter(f => f.section === key).length}\n\n${table(films.filter(f => f.section === key))}`), `<details>\n<summary>Supporting studies and intro — ${films.filter(f => f.section === 'supporting').length} bundles</summary>\n\n${table(films.filter(f => f.section === 'supporting'))}\n\n</details>`].join('\n\n');
}
function sync(check = false) {
  for (const [name, body] of [['index.html',renderIndex()], ['README.md',renderReadme()]]) {
    const file = path.join(ROOT, name), old = fs.readFileSync(file, 'utf8');
    const start = name.endsWith('.html') ? '<!-- films:start -->' : '<!-- films:start -->';
    const end = '<!-- films:end -->';
    if (!old.includes(start) || !old.includes(end)) throw new Error('Missing generated film markers: ' + name);
    const next = old.slice(0, old.indexOf(start) + start.length) + '\n' + body + '\n' + old.slice(old.indexOf(end));
    if (check && old !== next) throw new Error(name + ' film list is stale; run npm run sync:films');
    if (!check && old !== next) fs.writeFileSync(file, next);
  }
}
if (require.main === module) {
  try {
    validate();
    const [command, selection] = process.argv.slice(2);
    if (command === 'build') {
      const chosen = films.filter(f => f.id === selection || f.groups.includes(selection));
      if (!chosen.length) throw new Error('Unknown film/group: ' + selection);
      for (const film of chosen) {
        const result = spawnSync('bash', ['video/build.sh', clean(film.source)], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, FX_FILM_NAME: film.id } });
        if (result.status !== 0) process.exit(result.status || 1);
      }
    } else if (command === '--check' || command === '--write') {
      sync(command === '--check');
      console.log(`${films.length} public films; ${films.filter(f => f.section !== 'supporting').length} selected; ${films.length * 3} media files`);
    } else throw new Error('Usage: node tools/films.cjs --check | --write | build <id|group>');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { films, validate, sync };
