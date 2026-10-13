// Mouth inspection for the plush bear: a label mask of the mouth parts as the camera sees them, and
// a "viseme board" that renders all nine shapes. Used by tests and for checking a new mouth table.
import * as T from 'three';
import {VISEMES} from './bear.js';

export const ROLES = {cavity: 1, teeth: 2, tongue: 3, lip: 4};
const COLORS = {cavity: [1, 0, 0], teeth: [0, 1, 0], tongue: [0, 0, 1], lip: [1, 1, 1]};
const LAYER = 7;

/**
 * Render only the mouth parts, in flat colours, from `camera` into a w x h buffer.
 * Returns {labels: Uint8Array (0 none, 1 lining, 2 teeth, 3 tongue, 4 lip), w, h}.
 * Rows are top-down. The bear must already be posed and its world matrices updated.
 */
export function mouthMask(renderer, camera, bear, w, h) {
  const parts = [], saved = [];
  bear.mouth.traverse(o => { if (o.isMesh && o.userData.mouthRole) parts.push(o); });
  const basic = Object.fromEntries(Object.entries(COLORS).map(([k, c]) => [k, new T.MeshBasicMaterial({color: new T.Color(...c), toneMapped: false})]));
  for (const p of parts) {
    saved.push([p, p.material, p.layers.mask]);
    const m = basic[p.userData.mouthRole], src = p.material;
    m.polygonOffset = src.polygonOffset; m.polygonOffsetFactor = src.polygonOffsetFactor; m.polygonOffsetUnits = src.polygonOffsetUnits;
    p.material = m; p.layers.enable(LAYER);
  }
  const target = new T.WebGLRenderTarget(w, h), mask = camera.layers.mask, prevTarget = renderer.getRenderTarget(), clear = renderer.getClearColor(new T.Color()), alpha = renderer.getClearAlpha();
  const scene = bear.root.parent; const bg = scene.background, fog = scene.fog;
  try {
    camera.layers.set(LAYER); scene.background = null; scene.fog = null;
    renderer.setRenderTarget(target); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera);
    const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(target, 0, 0, w, h, px);
    const labels = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = ((h - 1 - y) * w + x) * 4, r = px[i] > 127, g = px[i + 1] > 127, b = px[i + 2] > 127;
      labels[y * w + x] = r && g && b ? 4 : r ? 1 : g ? 2 : b ? 3 : 0;
    }
    return {labels, w, h};
  } finally {
    camera.layers.mask = mask; scene.background = bg; scene.fog = fog;
    renderer.setRenderTarget(prevTarget); renderer.setClearColor(clear, alpha);
    for (const [p, m, l] of saved) { p.material = m; p.layers.mask = l; }
    Object.values(basic).forEach(m => m.dispose()); target.dispose();
  }
}

/** Overlap of two masks: binary silhouettes, and labels that must also agree. */
export function maskIoU(a, b) {
  let bothAny = 0, eitherAny = 0, bothSame = 0;
  for (let i = 0; i < a.labels.length; i++) {
    const x = a.labels[i], y = b.labels[i];
    if (x || y) eitherAny++;
    if (x && y) { bothAny++; if (x === y) bothSame++; }
  }
  return {silhouette: eitherAny ? bothAny / eitherAny : 1, labelled: eitherAny ? bothSame / eitherAny : 1};
}

/** Pixel extent of a mask: bounding box, area, and the tallest opening (lining + teeth + tongue) in one column. */
export function maskStats(m) {
  let x0 = m.w, y0 = m.h, x1 = -1, y1 = -1, area = 0, open = 0;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.labels[y * m.w + x]) { area++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (let x = 0; x < m.w; x++) { let top = -1, bottom = -1; for (let y = 0; y < m.h; y++) { const l = m.labels[y * m.w + x]; if (l && l !== 4) { if (top < 0) top = y; bottom = y; } } if (top >= 0) open = Math.max(open, bottom - top + 1); }
  return {area, open, box: x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1]};
}

/**
 * Viseme board: the nine shapes rendered from one camera into a 3 x 3 canvas with their letters.
 * render(cam) must render the stage and return its canvas; pose(face) poses the bear.
 */
export function visemeBoard(render, pose, cam, {cell = [360, 240], crop = null, font = '600 22px Arial'} = {}) {
  const [cw, ch] = cell, out = document.createElement('canvas'); out.width = cw * 3; out.height = ch * 3; const g = out.getContext('2d');
  Object.keys(VISEMES).sort((a, b) => 'XABCDEFGH'.indexOf(a) - 'XABCDEFGH'.indexOf(b)).forEach((id, i) => {
    pose({mouth: VISEMES[id]});
    const src = render(cam), [sx, sy, sw, sh] = crop || [0, 0, src.width, src.height];
    g.drawImage(src, sx, sy, sw, sh, (i % 3) * cw, Math.floor(i / 3) * ch, cw, ch);
    g.fillStyle = 'rgba(8,20,24,.75)'; g.fillRect((i % 3) * cw + 10, Math.floor(i / 3) * ch + 10, 40, 34);
    g.fillStyle = '#ffe9a8'; g.font = font; g.textAlign = 'center'; g.fillText(id, (i % 3) * cw + 30, Math.floor(i / 3) * ch + 35);
  });
  return out;
}
