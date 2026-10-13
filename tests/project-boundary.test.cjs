const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { serve, ROOT } = require('../video/serve.cjs');
const { inspect, privateNames } = require('../tools/check-public.cjs');

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
