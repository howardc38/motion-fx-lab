// Local preview server: byte ranges (so <video> can seek and Safari plays MP4), HEAD, MIME types,
// and the path restrictions the recorder and the private workspace rely on.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { serve, byteRange, ROOT } = require('../video/serve.cjs');

const SIZE = 1000;
const bytes = Buffer.from(Array.from({ length: SIZE }, (_, i) => (i * 37 + 11) & 255));
let project, outside, server;

before(async () => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-serve-'));
  outside = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-serve-outside-'));
  fs.mkdirSync(path.join(project, 'media'));
  fs.mkdirSync(path.join(project, 'docs'));
  fs.mkdirSync(path.join(project, 'node_modules'));
  fs.writeFileSync(path.join(project, 'media', 'clip.mp4'), bytes);
  fs.writeFileSync(path.join(project, 'media', 'empty.txt'), '');
  fs.writeFileSync(path.join(project, 'docs', 'guide.md'), '# Guide\n');
  fs.writeFileSync(path.join(project, 'docs', 'index.html'), '<p>docs</p>');
  fs.writeFileSync(path.join(project, '.env'), 'SECRET=1');
  fs.writeFileSync(path.join(project, 'node_modules', 'x.js'), '1');
  fs.writeFileSync(path.join(outside, 'private.txt'), 'private');
  // The public checkout keeps a gitignored deliverables link to the private workspace.
  fs.symlinkSync(outside, path.join(project, 'deliverables'));
  fs.symlinkSync(path.join(outside, 'private.txt'), path.join(project, 'media', 'linked.txt'));
  server = await serve({ projectRoot: project });
});

after(async () => {
  await server?.close();
  fs.rmSync(project, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

// Raw request: no URL normalisation and no automatic headers, like curl.
function request(urlPath, { method = 'GET', headers = {} } = {}) {
  const { hostname, port } = new URL(server.origin);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname, port, path: urlPath, method, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

test('byteRange parses single ranges, suffixes and unsatisfiable requests', () => {
  assert.equal(byteRange(undefined, SIZE), undefined);
  assert.deepEqual(byteRange('bytes=0-99', SIZE), { start: 0, end: 99 });
  assert.deepEqual(byteRange('bytes=900-', SIZE), { start: 900, end: 999 });
  assert.deepEqual(byteRange('bytes=-100', SIZE), { start: 900, end: 999 });
  assert.deepEqual(byteRange('bytes=-5000', SIZE), { start: 0, end: 999 });
  assert.deepEqual(byteRange('bytes=500-99999', SIZE), { start: 500, end: 999 });
  assert.deepEqual(byteRange('bytes=999-999', SIZE), { start: 999, end: 999 });
  assert.equal(byteRange('bytes=1000-', SIZE), null);
  assert.equal(byteRange('bytes=-0', SIZE), null);
  assert.equal(byteRange('bytes=5-2', SIZE), null);
  assert.equal(byteRange('bytes=-', SIZE), null);
  assert.equal(byteRange('bytes=abc', SIZE), null);
  assert.equal(byteRange('bytes=0-', 0), null);
  // Several ranges or another unit: the whole file is sent instead.
  assert.equal(byteRange('bytes=0-1,5-6', SIZE), undefined);
  assert.equal(byteRange('items=0-1', SIZE), undefined);
});

test('a whole file is sent with its length and an Accept-Ranges header', async () => {
  const res = await request('/media/clip.mp4');
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'video/mp4');
  assert.equal(res.headers['accept-ranges'], 'bytes');
  assert.equal(res.headers['content-length'], String(SIZE));
  assert.equal(res.headers['content-range'], undefined);
  assert.deepEqual(res.body, bytes);
});

test('curl -r style ranges return 206 with the exact bytes', async () => {
  const cases = [
    ['bytes=0-99', 0, 99],
    ['bytes=100-199', 100, 199],
    ['bytes=990-', 990, 999],
    ['bytes=-100', 900, 999],
    ['bytes=-5000', 0, 999],
    ['bytes=950-5000', 950, 999],
  ];
  for (const [range, start, end] of cases) {
    const res = await request('/media/clip.mp4', { headers: { Range: range } });
    assert.equal(res.status, 206, range);
    assert.equal(res.headers['content-range'], `bytes ${start}-${end}/${SIZE}`, range);
    assert.equal(res.headers['content-length'], String(end - start + 1), range);
    assert.equal(res.headers['accept-ranges'], 'bytes', range);
    assert.equal(res.headers['content-type'], 'video/mp4', range);
    assert.deepEqual(res.body, bytes.subarray(start, end + 1), range);
  }
  // fetch() as a browser page would use it.
  const res = await fetch(server.origin + '/media/clip.mp4', { headers: { Range: 'bytes=0-99' } });
  assert.equal(res.status, 206);
  assert.equal((await res.arrayBuffer()).byteLength, 100);
});

test('unsatisfiable ranges return 416 with the file size', async () => {
  for (const range of ['bytes=1000-', 'bytes=5000-6000', 'bytes=-0', 'bytes=5-2']) {
    const res = await request('/media/clip.mp4', { headers: { Range: range } });
    assert.equal(res.status, 416, range);
    assert.equal(res.headers['content-range'], `bytes */${SIZE}`, range);
    assert.equal(res.body.length, 0, range);
  }
  const empty = await request('/media/empty.txt', { headers: { Range: 'bytes=0-' } });
  assert.equal(empty.status, 416);
  assert.equal(empty.headers['content-range'], 'bytes */0');
});

test('several ranges or a different unit fall back to the whole file', async () => {
  for (const range of ['bytes=0-1,5-6', 'items=0-10']) {
    const res = await request('/media/clip.mp4', { headers: { Range: range } });
    assert.equal(res.status, 200, range);
    assert.deepEqual(res.body, bytes, range);
  }
});

test('HEAD returns the GET headers without a body', async () => {
  const whole = await request('/media/clip.mp4', { method: 'HEAD' });
  assert.equal(whole.status, 200);
  assert.equal(whole.headers['content-length'], String(SIZE));
  assert.equal(whole.headers['accept-ranges'], 'bytes');
  assert.equal(whole.headers['content-type'], 'video/mp4');
  assert.equal(whole.body.length, 0);
  const part = await request('/media/clip.mp4', { method: 'HEAD', headers: { Range: 'bytes=0-99' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers['content-length'], '100');
  assert.equal(part.headers['content-range'], `bytes 0-99/${SIZE}`);
  assert.equal(part.body.length, 0);
  const empty = await request('/media/empty.txt');
  assert.equal(empty.status, 200);
  assert.equal(empty.headers['content-length'], '0');
  assert.equal((await request('/media/clip.mp4', { method: 'POST' })).status, 405);
});

test('Markdown and other documents carry their MIME types', async () => {
  const md = await request('/docs/guide.md');
  assert.equal(md.status, 200);
  assert.equal(md.headers['content-type'], 'text/markdown; charset=utf-8');
  assert.equal(md.body.toString(), '# Guide\n');
  const dir = await request('/docs/');
  assert.equal(dir.headers['content-type'], 'text/html');
  assert.equal(dir.body.toString(), '<p>docs</p>');
  const publicReadme = await request('/_fxlab/README.md', { method: 'HEAD' });
  assert.equal(publicReadme.status, 200);
  assert.equal(publicReadme.headers['content-type'], 'text/markdown; charset=utf-8');
  assert.equal(publicReadme.headers['content-length'], String(fs.statSync(path.join(ROOT, 'README.md')).size));
});

test('links out of the served root, dot paths and node_modules stay forbidden, also for ranges', async () => {
  for (const urlPath of ['/deliverables/', '/deliverables/private.txt', '/media/linked.txt', '/.env', '/%2eenv',
    '/node_modules/x.js', '/media/%2e%2e%2f%2e%2e%2fetc/hosts', '/media/..%2f..%2fetc/hosts', '/_fxlab/.git/config', '/_fxlab/%2egit/config']) {
    for (const headers of [{}, { Range: 'bytes=0-9' }]) {
      const res = await request(urlPath, { headers });
      assert.equal(res.status, 403, `${urlPath} ${JSON.stringify(headers)}`);
      assert.equal(res.body.length, 0, urlPath);
    }
    assert.equal((await request(urlPath, { method: 'HEAD' })).status, 403, urlPath);
  }
  // A path the URL parser normalises back inside the root is served or missing, never escaping.
  const climbed = await request('/../../media/clip.mp4', { headers: { Range: 'bytes=0-99' } });
  assert.equal(climbed.status, 206);
  assert.equal((await request('/missing.mp4', { headers: { Range: 'bytes=0-99' } })).status, 404);
  assert.equal((await request('/%E0%A4%A')).status, 404);
});

test('the public library root also refuses its private compatibility link', async () => {
  const pub = await serve({ projectRoot: ROOT });
  try {
    const res = await fetch(pub.origin + '/deliverables/', { headers: { Range: 'bytes=0-9' } });
    assert.ok([403, 404].includes(res.status));
    const readme = await fetch(pub.origin + '/README.md', { headers: { Range: 'bytes=0-9' } });
    assert.equal(readme.status, 206);
    assert.equal((await readme.arrayBuffer()).byteLength, 10);
  } finally { await pub.close(); }
});
