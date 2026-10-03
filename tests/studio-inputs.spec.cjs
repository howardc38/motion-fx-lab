const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
async function modules(page) {
  await page.goto('/tests/fixtures/async-frame.html');
  await page.addScriptTag({type: 'importmap', content: JSON.stringify({imports: {
    three: 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js',
    'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/',
  }})});
}

test('surface samples decode normalized RGBA colors without mixing alpha into RGB', async ({page}) => {
  await modules(page);
  const colors = await page.evaluate(async () => {
    const THREE = await import('three');
    const {sampleSkin} = await import('/fx/studio/scene.js');
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0], 3));
    g.setAttribute('color', new THREE.Uint8BufferAttribute([255,128,0,20, 255,128,0,90, 255,128,0,255], 4, true));
    const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({color: '#ffffff'}));
    mesh.updateMatrixWorld(true);
    const sampler = sampleSkin(mesh, 12, 5), pos = new Float32Array(36), colors = new Float32Array(36);
    sampler.write(pos, colors);
    return [...colors];
  });
  for (let i = 0; i < colors.length; i += 3) {
    expect(colors[i]).toBeCloseTo(1, 6);
    expect(colors[i + 1]).toBeCloseTo(128 / 255, 6);
    expect(colors[i + 2]).toBe(0);
  }
});

test('reverse starts on the final frame and time remapping follows a custom loop duration', async ({page}) => {
  await modules(page);
  const result = await page.evaluate(async () => {
    const {createDots} = await import('/fx/studio/dots.js');
    const e = await createDots('ramp', {loopDuration: 2});
    const indices = [];
    for (const t of [0, 1/24, 2]) {
      await e.frame(t, {timeMode: 'reverse'}); indices.push(e.proof().sourceIndex);
    }
    await e.frame(2.5); const ramp = e.proof();
    await e.frame(4); const reverse = e.proof();
    return {indices, ramp, reverse};
  });
  expect(result.indices).toEqual([47, 46, 47]);
  expect(result.ramp.remap).toBe('ramp');
  expect(result.reverse.remap).toBe('reverse');
  expect(result.reverse.sourceIndex).toBe(47);
});

test('model and default sequence loading retry after a transient server failure', async ({page}) => {
  await modules(page);
  let modelRequests = 0, manifestRequests = 0;
  await page.route('**/assets/studio/fighter.glb', async route => {
    if (++modelRequests === 1) await route.fulfill({status: 503, body: 'retry'});
    else await route.continue();
  });
  await page.route('**/assets/studio/fight/manifest.json', async route => {
    if (++manifestRequests === 1) await route.fulfill({status: 503, body: 'retry'});
    else await route.continue();
  });
  const results = await page.evaluate(async () => {
    const {actor} = await import('/fx/studio/scene.js');
    const {createDots} = await import('/fx/studio/dots.js');
    const attempts = [];
    for (const load of [() => actor('#ffffff'), () => createDots('rhythm')]) {
      try {await load(); attempts.push('unexpected success');} catch {attempts.push('failed');}
      const result = await load(); attempts.push(!!result);
    }
    return attempts;
  });
  expect(results).toEqual(['failed', true, 'failed', true]);
  expect(modelRequests).toBe(2);
  expect(manifestRequests).toBe(2);
});

test('recording drains an in-flight asynchronous preview hook before frame zero', async ({page}) => {
  await page.goto('/tests/fixtures/async-frame.html');
  await page.setContent('<div id="frame"><div id="stage" data-w="320" data-h="180" data-dur="2"><section class="scene" data-start="0"></section></div></div>');
  await page.evaluate(() => {
    window.events = [];
    let calls = 0;
    window.__renderHooks = [async t => {
      const n = ++calls; events.push(['start', n, t]);
      if (n === 1) await new Promise(resolve => window.releasePreview = resolve);
      events.push(['end', n, t]);
    }];
  });
  await page.addScriptTag({url: '/video/engine.js'});
  await page.waitForFunction(() => !!window.releasePreview);
  const events = await page.evaluate(async () => {
    const recording = window.__record();
    await Promise.resolve();
    const before = events.slice();
    releasePreview(); await recording;
    return {before, after: events};
  });
  expect(events.before).toHaveLength(1);
  expect(events.after.map(e => e.slice(0,2))).toEqual([['start',1], ['end',1], ['start',2], ['end',2]]);
  expect(events.after[2][2]).toBe(0);
});

test('clip importer keys blue padding and preserves transparent padding without a key', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-key-'));
  const run = (cmd, args) => {
    const r = spawnSync(cmd, args, {cwd: root, encoding: 'utf8', timeout: 30000});
    expect(r.status, r.stderr).toBe(0); return r;
  };
  try {
    const clip = path.join(dir, 'source.mkv');
    run('ffmpeg', ['-v','error','-f','lavfi','-i','color=blue:size=32x64:rate=1:duration=1','-vf','drawbox=x=8:y=24:w=16:h=16:color=0x20e030:t=fill','-c:v','ffv1',clip]);
    for (const keyed of [true, false]) {
      const out = path.join(dir, keyed ? 'blue' : 'transparent');
      run('python3', ['video/import-clip.py',clip,out,'--fps','1','--width','64','--height','64',...(keyed ? ['--key','0x0000ff'] : [])]);
      const decoded = spawnSync('ffmpeg', ['-v','error','-i',path.join(out,'frame-000000.png'),'-f','rawvideo','-pix_fmt','rgba','-'], {timeout: 10000});
      expect(decoded.status).toBe(0);
      const rgba = decoded.stdout;
      expect(rgba[(32 * 64 + 2)*4+3]).toBe(0); // aspect-ratio padding
      expect(rgba[(32 * 64 + 32)*4+3]).toBe(255); // foreground survives
      expect(rgba[(32 * 64 + 32)*4+1]).toBeGreaterThan(150); // green subject must not be green-despilled
      expect(rgba[(32 * 64 + 32)*4]).toBeLessThan(90);
      if (keyed) expect(rgba[(4 * 64 + 32)*4+3]).toBe(0); // blue source
    }
  } finally {fs.rmSync(dir, {recursive:true, force:true});}
});

test('removing GIF declarations removes only the named stale output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-gif-'));
  try {
    const cues = path.join(dir,'cues.json'), out = path.join(dir,'film.gif'), other = path.join(dir,'other.gif');
    fs.writeFileSync(cues,'{}'); fs.writeFileSync(out,'stale'); fs.writeFileSync(other,'keep');
    const r = spawnSync('python3',['video/gif.py',cues,'unused.mp4',out],{cwd:root,encoding:'utf8'});
    expect(r.status, r.stderr).toBe(0);
    expect(fs.existsSync(out)).toBe(false);
    expect(fs.readFileSync(other,'utf8')).toBe('keep');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
