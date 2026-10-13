const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { serve, ROOT } = require('../video/serve.cjs');
const { inspect, privateNames, nonBranchRefs, LISTED_FILES, PROBE_FIXTURES } = require('../tools/check-public.cjs');

// Probe strings are assembled at run time so this file itself passes the scan without an exemption.
const slashed = name => '/' + name + '/';
const LEAK = slashed('Users') + 'someone/Projects/secret/clip.mov';
const WINDOWS_LEAK = ['C:', 'Users', 'someone', 'clip.mov'].join('\\');
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
// Git child processes must never inherit GIT_DIR and friends from a hook that runs these tests.
const gitEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
const GIT_ID = ['-c', 'user.name=Probe', '-c', 'user.email=probe@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', '-c', 'core.hooksPath=/dev/null'];
const gitIn = (cwd, ...args) => execFileSync('git', [...GIT_ID, ...args], { cwd, env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function withTree(files, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-probe-'));
  try {
    for (const [file, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), content);
    }
    return run(root, Object.keys(files));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const check = (files, options = {}) => withTree(files, (root, list) => inspect(list, root, { names: [], ...options }));

test('external project resolves its own assets and shared effects without file URLs or escaping roots', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-project-'));
  fs.mkdirSync(path.join(root, 'assets'));
  fs.writeFileSync(path.join(root, 'index.html'), 'project');
  fs.writeFileSync(path.join(root, 'assets', 'own.txt'), 'owned');
  fs.writeFileSync(path.join(root, 'assets', 'chart.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.symlinkSync(os.tmpdir(), path.join(root, 'escape'));
  const server = await serve({ projectRoot: root });
  try {
    assert.equal(await (await fetch(server.origin)).text(), 'project');
    assert.equal(await (await fetch(server.origin + '/assets/own.txt')).text(), 'owned');
    assert.equal((await fetch(server.origin + '/fx/catalog.js')).status, 200);
    assert.equal((await fetch(server.origin + '/_fxlab/index.html')).status, 200);
    assert.equal((await fetch(server.origin + '/assets/chart.svg')).headers.get('content-type'), 'image/svg+xml');
    assert.equal((await fetch(server.origin + '/escape/')).status, 403);
    assert.equal((await fetch(server.origin + '/_fxlab/%2egit/config')).status, 403);
    assert.equal(server.urlFor(path.join(root, 'index.html')), server.origin + '/index.html');
    assert.match(server.urlFor(path.join(ROOT, 'index.html')), /\/_fxlab\/index.html$/);
    assert.throws(() => server.urlFor('/etc/hosts'), /outside/);
  } finally { await server.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('public server refuses the local compatibility symlink', async () => {
  const server = await serve({ projectRoot: ROOT });
  try {
    const response = await fetch(server.origin + '/deliverables/');
    assert.ok([403, 404].includes(response.status));
  } finally { await server.close(); }
});

test('external recorder rejects writes to public media before launching a browser', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-project-'));
  fs.writeFileSync(path.join(root, 'page.html'), '<html></html>');
  try {
    const result = spawnSync(process.execPath, ['video/record.cjs', 'cues', path.join(root, 'page.html'), path.join(ROOT, 'media', 'forbidden.json')], { cwd: ROOT, env: { ...process.env, FX_PROJECT_ROOT: root }, encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /cannot write outputs/);
    assert.equal(fs.existsSync(path.join(ROOT, 'media', 'forbidden.json')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('scope checker rejects a production film even if it has a normal HTML extension', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-scope-'));
  fs.mkdirSync(path.join(root, 'examples')); fs.writeFileSync(path.join(root, 'examples', 'private-film.html'), '<html></html>');
  try { assert.match(inspect(['examples/private-film.html'], root).join('\n'), /Unregistered example/); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('scope checker learns private workspace names from local links instead of storing them', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-names-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-studio-'));
  fs.mkdirSync(path.join(outside, 'deliverables'));
  fs.symlinkSync(path.join(outside, 'deliverables'), path.join(root, 'deliverables'));
  fs.symlinkSync(path.join(root, 'deliverables'), path.join(root, 'inside-link'));
  try {
    assert.deepEqual(privateNames(root), [path.basename(fs.realpathSync(outside))]);
    assert.equal(fs.readFileSync(path.join(ROOT, 'tools', 'check-public.cjs'), 'utf8').includes(path.basename(outside)), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true }); }
});

// R1 review 5.3: every probe the old checker let through, plus the ones it already caught.
const PROBES = [
  ['tools/leak.cjs', 'module.exports = ' + JSON.stringify(LEAK), /absolute path/],
  ['fx/leak.mjs', 'export const clip = ' + JSON.stringify(LEAK), /absolute path/],
  ['fx/leak.css', `body { background: url("file://${LEAK}"); }`, /absolute path/],
  ['tools/notes.txt', 'source: ' + LEAK, /absolute path/],
  ['media/x.svg', `<svg xmlns="http://www.w3.org/2000/svg"><image href="${LEAK}"/></svg>`, /absolute path/],
  ['tests/leak.spec.cjs', 'const clip = ' + JSON.stringify(LEAK), /absolute path/],
  ['notes/plan.md', '# plan', /Outside the public allowlist/],
  ['templates/promo.html', '<html></html>', /Outside the public allowlist/],
  ['runtime/model.bin', 'weights', /Outside the public allowlist/],
  ['archive/old.md', '# old', /Outside the public allowlist/],
  ['assets/brief.pdf', '%PDF-1.4', /Asset type not allowed/],
  ['examples/stack-lab/private-film.html', '<html></html>', /Unregistered example/],
  ['video/prompt-v2.md', '# prompt', /Non-public material/],
  ['fx/storyboard.md', '# boards', /Non-public material/],
  ['docs/x.md', '# doc', /Outside the public allowlist/],
  // Beyond the review's table: unknown extensions, Windows paths, binaries, nested folders, wider names.
  ['tools/settings.conf', 'root=' + LEAK, /absolute path/],
  ['fx/win.js', 'const clip = ' + JSON.stringify(WINDOWS_LEAK), /absolute path/],
  ['media/poster.png', Buffer.concat([PNG_HEAD, Buffer.from('tEXtSource\0' + LEAK)]), /absolute path/],
  ['media/clip.mp4', Buffer.concat([PNG_HEAD, Buffer.from('XMP ' + LEAK, 'utf16le')]), /absolute path/],
  ['fx/notes/todo.js', '//', /Non-public material/],
  ['tools/deliverables/cut.py', '#', /Non-public material/],
  ['tools/client-brief.txt', 'brief', /Non-public material/],
  ['fx/shot-list.md', 'shots', /Non-public material/],
  ['examples/creative-direction.html', '<html></html>', /Non-public material/],
  ['tools/imagegen-prompts.jsonl', '{}', /Non-public material/],
  ['fx/storyboards/frame-01.png', PNG_HEAD, /Non-public material/],
  ['secrets.env', 'TOKEN=1', /Outside the public allowlist/],
  ['.github/workflows/publish.yml', 'on: push', /Outside the public allowlist/],
];

for (const [file, content, expected] of PROBES) {
  test(`scope checker blocks probe ${file}`, () => {
    assert.match(check({ [file]: content }).join('\n'), expected);
  });
}

test('the brief.pdf probe fails on type, missing manifest and name at once', () => {
  const errors = check({ 'assets/brief.pdf': '%PDF-1.4' }).join('\n');
  for (const expected of [/Asset type not allowed/, /no manifest/, /Non-public material/]) assert.match(errors, expected);
});

test('scope checker accepts the allowlisted layout', () => {
  assert.deepEqual(check({
    'README.md': '# Motion FX Lab', '.githooks/pre-push': '#!/bin/sh\n', 'fx/a.js': 'export {}', 'tools/a.cjs': '',
    'tests/fixtures/frame.html': '<html></html>', 'assets/group/manifest.json': '{}', 'assets/group/a.png': PNG_HEAD,
    'assets/group/sub/b.wav': Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0]), 'assets/type/README.md': '# Fonts', 'assets/type/OFL.txt': 'license',
    'examples/stack-lab/index.html': '<html></html>', 'examples/films.json': '{}',
  }), []);
});

test('assets need a known type and a manifest or README in their folder or a parent below assets/', () => {
  assert.match(check({ 'assets/a.png': PNG_HEAD }).join('\n'), /no manifest/);
  assert.match(check({ 'assets/group/a.png': PNG_HEAD }).join('\n'), /no manifest/);
  assert.match(check({ 'assets/README.md': '# all', 'assets/group/a.png': PNG_HEAD }).join('\n'), /no manifest[^]*assets\/group\/a.png/);
  assert.match(check({ 'assets/group/README.md': '#', 'assets/group/run.js': '' }).join('\n'), /Asset type not allowed: assets\/group\/run.js/);
  assert.match(check({ 'assets/group/README.md': '#', 'assets/group/scene.blend': PNG_HEAD }).join('\n'), /Asset type not allowed/);
  assert.deepEqual(check({ 'assets/group/README.md': '#', 'assets/group/deep/er/a.jpg': PNG_HEAD }), []);
  // A manifest that exists on disk but is not a Git candidate does not count.
  withTree({ 'assets/group/manifest.json': '{}', 'assets/group/a.png': PNG_HEAD }, root => {
    assert.match(inspect(['assets/group/a.png'], root, { names: [] }).join('\n'), /no manifest/);
  });
});

test('scope checker finds private workspace names in paths, text and binary files', () => {
  const name = 'studio-' + process.pid + '-probe';
  assert.match(check({ ['fx/' + name + '.js']: '' }, { names: [name] }).join('\n'), /Non-public material/);
  assert.match(check({ 'fx/a.js': `import x from "../${name}/x.js";` }, { names: [name] }).join('\n'), /private workspace name/);
  assert.match(check({ 'media/a.jpg': Buffer.concat([PNG_HEAD, Buffer.from(name)]) }, { names: [name] }).join('\n'), /private workspace name/);
});

test('tests/ is scanned; only listed probe fixtures skip the path markers, and only while they hold a probe', () => {
  assert.ok(PROBE_FIXTURES.every(file => file.startsWith('tests/')));
  const fixture = 'tests/fixtures/probe.txt', name = 'studio-' + process.pid + '-probe';
  assert.deepEqual(check({ [fixture]: LEAK }, { probeFixtures: [fixture] }), []);
  assert.match(check({ [fixture]: 'nothing here' }, { probeFixtures: [fixture] }).join('\n'), /no longer contains a probe/);
  assert.match(check({ [fixture]: LEAK + ' ' + name }, { probeFixtures: [fixture], names: [name] }).join('\n'), /private workspace name/);
  assert.match(check({ 'tests/other.spec.cjs': LEAK }, { probeFixtures: [fixture] }).join('\n'), /absolute path/);
  assert.match(check({ 'fx/probe.txt': LEAK }, { probeFixtures: ['fx/probe.txt'] }).join('\n'), /absolute path/);
});

test('the current tracked tree passes and every listed root file exists', () => {
  const tracked = execFileSync('git', ['ls-files', '--cached', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  assert.deepEqual(inspect(tracked), []);
  for (const file of LISTED_FILES) assert.ok(tracked.includes(file), 'listed but not tracked: ' + file);
});

test('a linked worktree learns private names from the main checkout and ignores links back into it', () => {
  const main = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-public-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-studio-'));
  try {
    fs.mkdirSync(path.join(outside, 'deliverables'));
    fs.mkdirSync(path.join(main, 'node_modules'));
    fs.writeFileSync(path.join(main, 'README.md'), '#');
    fs.symlinkSync(path.join(outside, 'deliverables'), path.join(main, 'deliverables'));
    gitIn(main, 'init', '-q', '-b', 'main');
    gitIn(main, 'add', 'README.md');
    gitIn(main, 'commit', '-q', '-m', 'init');
    const worktree = path.join(main, '.claude', 'worktrees', 'probe');
    gitIn(main, 'worktree', 'add', '-q', '-b', 'probe', worktree);
    fs.symlinkSync(path.join(main, 'node_modules'), path.join(worktree, 'node_modules'));
    const expected = [path.basename(fs.realpathSync(outside))];
    assert.deepEqual(privateNames(main), expected);
    assert.deepEqual(privateNames(worktree), expected);
  } finally { fs.rmSync(main, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true }); }
});

test('refs outside heads, tags and remotes are reported', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-refs-'));
  try {
    gitIn(repo, 'init', '-q', '-b', 'main');
    gitIn(repo, 'commit', '-q', '--allow-empty', '-m', 'init');
    gitIn(repo, 'tag', 'v1');
    gitIn(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
    assert.deepEqual(nonBranchRefs(repo), []);
    gitIn(repo, 'update-ref', 'refs/codex/snapshot', 'HEAD');
    assert.deepEqual(nonBranchRefs(repo), ['refs/codex/snapshot']);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('pre-push hook sends only commits and tags to branches and tags, never deletes, and runs the scope check', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-hook-'));
  const work = path.join(base, 'work'), remote = path.join(base, 'remote.git');
  try {
    gitIn(base, 'init', '-q', '--bare', remote);
    gitIn(base, 'init', '-q', '-b', 'main', work);
    fs.mkdirSync(path.join(work, 'tools'));
    // Stand-in scope check: proves the hook ran it, and fails while a FAIL file exists.
    fs.writeFileSync(path.join(work, 'tools', 'check-public.cjs'), "console.log('stub scope check ran'); process.exitCode = require('fs').existsSync(__dirname + '/../FAIL') ? 1 : 0;\n");
    gitIn(work, 'add', '.');
    gitIn(work, 'commit', '-q', '-m', 'init');
    gitIn(work, 'tag', '-a', 'v1', '-m', 'v1');
    gitIn(work, 'tag', 'light');
    gitIn(work, 'update-ref', 'refs/codex/snapshot', 'HEAD');
    const blob = gitIn(work, 'hash-object', '-w', 'tools/check-public.cjs');
    const push = (args, env = {}) => spawnSync('git', [...GIT_ID, '-c', 'core.hooksPath=' + path.join(ROOT, '.githooks'), 'push', remote, ...args], { cwd: work, env: { ...gitEnv, ...env }, encoding: 'utf8' });
    const remoteRefs = () => gitIn(remote, 'for-each-ref', '--format=%(refname)').split('\n').filter(Boolean).sort();

    let result = push(['HEAD:refs/heads/main']);
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /stub scope check ran/);
    result = push(['refs/tags/v1', 'refs/tags/light']);
    assert.equal(result.status, 0, result.stderr);
    for (const [args, message] of [
      [['refs/codex/snapshot:refs/codex/snapshot'], /only branches and tags/],
      [['HEAD:refs/notes/commits'], /only branches and tags/],
      [['--mirror'], /only branches and tags/],
      [[':refs/heads/main'], /refusing to delete remote refs\/heads\/main/],
      [['--delete', 'refs/tags/v1'], /refusing to delete remote refs\/tags\/v1/],
      [[blob + ':refs/tags/blob'], /refusing to push blob object/],
    ]) {
      result = push(args);
      assert.notEqual(result.status, 0, args.join(' ')); assert.match(result.stderr, message, args.join(' '));
    }
    assert.deepEqual(remoteRefs(), ['refs/heads/main', 'refs/tags/light', 'refs/tags/v1']);

    fs.writeFileSync(path.join(work, 'FAIL'), '');
    result = push(['HEAD:refs/heads/next']);
    assert.notEqual(result.status, 0); assert.match(result.stderr, /public scope check failed/);
    assert.deepEqual(remoteRefs(), ['refs/heads/main', 'refs/tags/light', 'refs/tags/v1']);
    result = push(['HEAD:refs/heads/next'], { ALLOW_ANY_PUSH: '1' });
    assert.equal(result.status, 0, result.stderr);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('install-hooks points core.hooksPath at .githooks, is idempotent and will not silently replace another path', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-install-'));
  try {
    gitIn(repo, 'init', '-q', '-b', 'main');
    fs.mkdirSync(path.join(repo, 'tools')); fs.mkdirSync(path.join(repo, '.githooks'));
    fs.copyFileSync(path.join(ROOT, 'tools', 'install-hooks.cjs'), path.join(repo, 'tools', 'install-hooks.cjs'));
    fs.copyFileSync(path.join(ROOT, '.githooks', 'pre-push'), path.join(repo, '.githooks', 'pre-push'));
    fs.chmodSync(path.join(repo, '.githooks', 'pre-push'), 0o644);
    fs.mkdirSync(path.join(repo, '.git', 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.git', 'hooks', 'pre-push'), '#!/bin/sh\n');
    const install = (...args) => spawnSync(process.execPath, ['tools/install-hooks.cjs', ...args], { cwd: repo, env: gitEnv, encoding: 'utf8' });
    const hooksPath = () => spawnSync('git', ['config', '--local', '--get', 'core.hooksPath'], { cwd: repo, env: gitEnv, encoding: 'utf8' }).stdout.trim();

    let result = install();
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Hooks installed[^]*\.git[\\/]hooks[\\/]pre-push/);
    assert.equal(hooksPath(), '.githooks');
    assert.equal(fs.statSync(path.join(repo, '.githooks', 'pre-push')).mode & 0o111, 0o111);
    result = install();
    assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /already installed/);
    assert.equal(hooksPath(), '.githooks');
    gitIn(repo, 'config', '--local', 'core.hooksPath', 'other-hooks');
    result = install();
    assert.equal(result.status, 1); assert.match(result.stderr, /--force/); assert.equal(hooksPath(), 'other-hooks');
    result = install('--force');
    assert.equal(result.status, 0, result.stderr); assert.equal(hooksPath(), '.githooks');
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});
