// Cut the card loops (media/<id>.preview.mp4), and the intro's README GIF, again from films already in
// media/, without rendering. video/build.sh makes them for every new render; this is for films rendered
// before, or after a change to a page's window.__preview or window.__gif clips. Each page's clips and
// poster time are read the way build.sh reads them (node video/record.cjs cues), so one browser opens per
// film, one at a time.
//
//   node tools/make-previews.cjs                 every film whose card or hero plays a loop
//   node tools/make-previews.cjs reel titles     only these films
//   node tools/make-previews.cjs --posters ...   also take each poster again at window.__poster
//
// The films that need a loop are listed in examples/films.json (media.preview); RECORD_ARGS="--cpu" is
// passed on to the recorder as in build.sh.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const { load } = require('./films.cjs');
const clean = value => String(value).split(/[?#]/)[0];

function run(command, args) {
  const r = spawnSync(command, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${r.status})`);
  return r.stdout;
}

function main(argv) {
  const posters = argv.includes('--posters'), ids = argv.filter(a => !a.startsWith('--'));
  const films = load().manifest.films.filter(f => ids.length ? ids.includes(f.id) : f.media.preview);
  const unknown = ids.filter(id => !films.some(f => f.id === id));
  if (unknown.length) throw new Error('Unknown film: ' + unknown.join(', '));
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'make-previews-'));
  try {
    for (const film of films) {
      const cues = path.join(work, film.id + '.json'), mp4 = path.join(ROOT, clean(film.media.mp4));
      run(process.execPath, ['video/record.cjs', 'cues', path.join(ROOT, clean(film.page)), cues, ...(process.env.RECORD_ARGS || '').split(/\s+/).filter(Boolean)]);
      const spec = JSON.parse(fs.readFileSync(cues, 'utf8'));
      if (film.media.preview) {
        if (!spec.preview) throw new Error(`${film.id}: films.json lists ${film.media.preview} but ${clean(film.page)} declares no window.__preview`);
        process.stdout.write(`${film.id.padEnd(20)} ` + run('python3', ['video/preview.py', cues, mp4, path.join(ROOT, clean(film.media.preview))]));
      } else if (spec.preview) throw new Error(`${film.id}: ${clean(film.page)} declares window.__preview; add media.preview to examples/films.json`);
      if (film.media.gif) process.stdout.write(`${film.id.padEnd(20)} ` + run('python3', ['video/gif.py', cues, mp4, path.join(ROOT, clean(film.media.gif))]));
      if (posters) {
        const at = spec.poster ?? spec.dur / 3;
        run('python3', ['video/deliver.py', '--poster', mp4, String(at), path.join(ROOT, clean(film.media.poster))]);
        console.log(`${film.id.padEnd(20)} poster: frame at ${at} s -> ${clean(film.media.poster)}`);
      }
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
