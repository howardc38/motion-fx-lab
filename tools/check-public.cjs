// Public scope guard. It checks the actual Git candidates (tracked plus untracked, not ignored),
// not a staging directory, against an allowlist, and scans every file for local paths and the
// names of private workspaces on this machine. Run: npm run check:public (also .githooks/pre-push).
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { films, validate, sync } = require('./films.cjs');
const ROOT = path.resolve(__dirname, '..');

// Layout allowlist: these top-level folders, plus exactly these files outside them.
const TOP_DIRS = ['assets', 'examples', 'fx', 'media', 'tests', 'tools', 'video'];
const LISTED_FILES = [
  '.gitignore', 'LICENSE', 'README.md', 'THIRD_PARTY.md', 'index.html', 'package.json', 'package-lock.json',
  'playwright.config.cjs', '.githooks/pre-push',
];
// examples/ holds the pages registered in examples/films.json plus these, listed file by file.
const EXAMPLES_OUTSIDE_FILMS = [
  'examples/films.json', 'examples/character-workbench.html', 'examples/fight-source.html', 'examples/studio.html',
  'examples/stack-lab/index.html', 'examples/stack-lab/app.js', 'examples/stack-lab/style.css',
  'examples/stack-lab/README.md', 'examples/stack-lab/NOTICE',
  // Source pages of films that left the published list (impact-orbit merged into dot-battle, shadow-lab
  // retired, word-forms replaced by the titles use case, scene-eras kept only as a live preset); tests and
  // the family READMEs still open them.
  'examples/impact-orbit.html', 'examples/shadow-lab.html', 'examples/word-forms.html', 'examples/scene-eras.html',
];
// assets/ holds media and data only, each inside a folder (or below one) that has a manifest.json or README.md.
const ASSET_TYPES = /\.(png|jpe?g|webp|avif|gif|svg|mp4|webm|wav|mp3|ogg|m4a|flac|glb|gltf|bin|hdr|ktx2|woff2?|ttf|otf|json|csv|gz|md|txt)$/i;
const ASSET_DOCS = ['manifest.json', 'README.md'];
// Test files are scanned like everything else. A fixture that must contain an absolute-path probe is
// listed here by exact path; it is exempt from the path markers only (private names are still
// checked) and is reported if it no longer contains a probe. The boundary test builds its probes at
// run time, so no fixture needs this today.
const PROBE_FIXTURES = [];

// Production material: folders anywhere in the tree, and planning documents by name.
const PRIVATE_DIRS = /(^|\/)(deliverables|production|local|effect-reference|prompts|notes|archive)\//;
const PLANNING_WORDS = /(^|[^a-z])(prompt(s|ing)?|imagegen|briefs?|storyboards?|creative-direction|production-execution|read-log|shot-?lists?|moodboards?|treatments?|handoffs?)([^a-z]|$)/;
const DOCUMENT_TYPES = /\.(md|markdown|txt|rtf|pdf|docx?|pages|jsonl?|ya?ml|html?|csv)$/i;

// Markers of a machine-local path. Built from parts so this file never contains them itself.
const slashed = name => '/' + name + '/';
const PATH_MARKERS = [slashed('Users'), slashed('home'), ['docs', 'video-creation'].join('/'), ['docs', 'character-animation'].join('/')];
const WINDOWS_HOME = /\b[A-Za-z]:[\\/]+Users[\\/]/;

const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const within = (roots, p) => roots.some(r => p === r || p.startsWith(r + path.sep));

// The checkout itself and, from a linked worktree, the main checkout of the same repository.
function publicRoots(root = ROOT) {
  const real = fs.realpathSync(root);
  const roots = new Set([path.resolve(root), real]);
  try {
    if (fs.realpathSync(git(root, ['rev-parse', '--show-toplevel'])) === real) {
      const common = fs.realpathSync(path.resolve(root, git(root, ['rev-parse', '--git-common-dir'])));
      if (path.basename(common) === '.git') roots.add(path.dirname(common));
    }
  } catch {}
  return [...roots];
}

// Names of private workspaces on this machine, read from ignored links such as deliverables/ -> <private>/deliverables
// (in this checkout and, from a worktree, in the main checkout) and from FX_PROJECT_ROOT / FX_PRIVATE_NAMES,
// so the checker itself never publishes them. Absolute paths are caught separately.
function privateNames(root = ROOT) {
  const names = new Set((process.env.FX_PRIVATE_NAMES || '').split(',').map(s => s.trim()).filter(Boolean));
  if (process.env.FX_PROJECT_ROOT) names.add(path.basename(path.resolve(process.env.FX_PROJECT_ROOT)));
  const roots = publicRoots(root);
  for (const dir of new Set(roots.map(r => fs.realpathSync(r)))) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isSymbolicLink()) continue;
      try {
        const link = path.join(dir, entry.name), next = path.resolve(dir, fs.readlinkSync(link));
        const target = fs.realpathSync(link);
        if (within(roots, next) || within(roots, target)) continue;
        names.add(path.basename(path.basename(target) === entry.name ? path.dirname(target) : target));
      } catch {}
    }
  }
  for (const r of roots) names.delete(path.basename(r));
  names.delete('');
  return [...names];
}

// Every examples/... path that examples/films.json mentions, whatever its schema version.
function filmPages() {
  const pages = new Set();
  (function walk(value) {
    if (typeof value === 'string') { if (value.startsWith('examples/')) pages.add(value.split(/[?#]/)[0]); }
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  })(require('../examples/films.json'));
  return pages;
}
const NAMES = privateNames();
const EXAMPLES = new Set([...filmPages(), ...EXAMPLES_OUTSIDE_FILMS]);

const isText = buffer => !buffer.subarray(0, 8000).includes(0);
// Text is searched as UTF-8; binary files (images, video, audio, archives) also as UTF-16, for embedded metadata.
function contains(buffer, needle, text) {
  return buffer.includes(needle) || (!text && buffer.includes(Buffer.from(needle, 'utf16le')));
}
function assetDocumented(file, listed) {
  const parts = file.split('/');
  for (let end = parts.length - 1; end >= 2; end--) {
    const dir = parts.slice(0, end).join('/');
    if (ASSET_DOCS.some(doc => listed.has(dir + '/' + doc))) return true;
  }
  return false;
}

function inspect(files, root = ROOT, { names = NAMES, probeFixtures = PROBE_FIXTURES } = {}) {
  const errors = [];
  const listed = new Set(files);
  const fixtures = new Set(probeFixtures.filter(f => f.startsWith('tests/')));
  const undocumented = new Set();
  for (const file of files) {
    const parts = file.replace(/\/$/, '').split('/');
    const lower = file.toLowerCase();
    if (!(parts.length > 1 && TOP_DIRS.includes(parts[0])) && !LISTED_FILES.includes(file)) errors.push('Outside the public allowlist: ' + file);
    if (PRIVATE_DIRS.test(file) || parts.slice(0, -1).some(dir => PLANNING_WORDS.test(dir.toLowerCase()))
      || (DOCUMENT_TYPES.test(file) && PLANNING_WORDS.test(path.basename(lower)))
      || names.some(name => file.includes(name))) errors.push('Non-public material: ' + file);
    if (parts[0] === 'examples' && !EXAMPLES.has(file)) errors.push('Unregistered example: ' + file);
    if (parts[0] === 'assets') {
      if (!ASSET_TYPES.test(file)) errors.push('Asset type not allowed: ' + file);
      const dir = parts.slice(0, -1).join('/');
      if (!assetDocumented(file, listed) && !undocumented.has(dir)) {
        undocumented.add(dir);
        errors.push('Asset folder has no manifest.json or README.md (in it or a parent below assets/): ' + file);
      }
    }
    const absolute = path.join(root, file);
    let stat;
    try { stat = fs.lstatSync(absolute); } catch { errors.push('Missing file: ' + file); continue; }
    if (stat.isSymbolicLink()) { errors.push('Symlink cannot be published: ' + file); continue; }
    if (!stat.isFile()) { errors.push('Not a regular file (nested repository?): ' + file); continue; }
    const buffer = fs.readFileSync(absolute), text = isText(buffer);
    const marked = PATH_MARKERS.some(m => contains(buffer, m, text)) || (text && WINDOWS_HOME.test(buffer.toString('utf8')));
    if (fixtures.has(file)) { if (!marked) errors.push('Probe fixture no longer contains a probe; remove it from PROBE_FIXTURES: ' + file); }
    else if (marked) errors.push('Local/private dependency (absolute path): ' + file);
    if (names.some(name => contains(buffer, name, text))) errors.push('Local/private dependency (private workspace name): ' + file);
  }
  return errors;
}

// Local refs that are not branches, tags or remote-tracking refs, e.g. refs/codex/* snapshots or refs/stash.
// They stay on this machine; a mirror or refs/* push would publish them, which .githooks/pre-push refuses.
function nonBranchRefs(root = ROOT) {
  return git(root, ['for-each-ref', '--format=%(refname)']).split('\n').filter(ref => ref && !/^refs\/(heads|tags|remotes)\//.test(ref));
}

function candidates(root = ROOT) {
  return [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))];
}

if (require.main === module) {
  try {
    const refs = nonBranchRefs();
    if (refs.length) console.warn(`Warning: ${refs.length} local ref(s) outside refs/heads, refs/tags and refs/remotes; never push them:\n  ` + refs.join('\n  '));
    const files = candidates();
    const errors = inspect(files);
    if (errors.length) throw new Error(errors.join('\n'));
    validate(); sync(true);
    console.log(`Public scope OK: ${files.length} Git candidates, ${films.length} films, ${films.length * 3} media files.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { inspect, privateNames, publicRoots, nonBranchRefs, candidates, TOP_DIRS, LISTED_FILES, PROBE_FIXTURES };
