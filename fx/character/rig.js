import { point, distance, clamp, lerp, smooth } from './math.js';

function number(n, name, positive = false) {
  if (!Number.isFinite(n) || positive && n <= 0) throw new TypeError(`${name} must be ${positive ? 'positive and ' : ''}finite`);
}
export function validateRig(d) {
  if (!d || d.version !== 1) throw new TypeError('Rig version must be 1');
  if (!d.canvas || !Number.isInteger(d.canvas.width) || !Number.isInteger(d.canvas.height) || d.canvas.width < 1 || d.canvas.height < 1) throw new TypeError('Rig canvas requires positive integer width/height');
  point(d.canvas.origin, 'canvas.origin');
  if (!d.assets || !d.joints || !Array.isArray(d.parts) || d.parts.length === 0) throw new TypeError('Rig requires assets, joints and parts');
  for (const [id, p] of Object.entries(d.joints)) point(p, `joint ${id}`);
  const joint = id => { if (!Object.hasOwn(d.joints, id)) throw new Error(`Unknown joint: ${id}`); };
  for (const bone of d.bones || []) {
    if (!Array.isArray(bone) || bone.length !== 2) throw new Error('Debug bones must name two joints');
    bone.forEach(joint);
  }
  const names = new Set();
  for (const p of d.parts) {
    if (!p.id || names.has(p.id)) throw new Error(`Missing/duplicate part ID: ${p.id}`); names.add(p.id);
    if (!Object.hasOwn(d.assets, p.asset)) throw new Error(`Unknown asset for ${p.id}: ${p.asset}`);
    if (!Array.isArray(p.rect) || p.rect.length !== 4 || p.rect.some(v => !Number.isInteger(v)) || p.rect[0] < 0 || p.rect[1] < 0 || p.rect[2] < 1 || p.rect[3] < 1) throw new TypeError(`Invalid crop rect: ${p.id}`);
    number(p.layer ?? 0, `layer ${p.id}`);
    if (p.mesh) {
      const m = p.mesh, grid = m.grid || [8, 12];
      if (grid.length !== 2 || grid.some(v => !Number.isInteger(v) || v < 1 || v > 64)) throw new RangeError(`Invalid mesh grid: ${p.id}`);
      if (!Array.isArray(m.bindings) || m.bindings.length === 0) throw new Error(`Mesh needs bindings: ${p.id}`);
      for (const b of m.bindings) {
        joint(b.from); joint(b.to); point(b.sourceA, 'sourceA'); point(b.sourceB, 'sourceB');
        if (b.from === b.to || distance(b.sourceA, b.sourceB) < 1e-6) throw new Error(`Collapsed binding: ${p.id}`);
        if (b.widthScale != null) { number(b.widthScale, 'widthScale'); if (b.widthScale === 0) throw new RangeError('widthScale cannot be zero'); }
      }
      if (m.bindings.length > 1 && !m.weights && !(m.bindings.length === 2 && m.blend)) throw new Error(`Multiple bindings need explicit weights or a two-binding blend: ${p.id}`);
      if (m.blend && (!['x', 'y'].includes(m.blend.axis) || !(m.blend.end > m.blend.start))) throw new Error(`Invalid blend: ${p.id}`);
      if (m.weights) {
        if (m.weights.length !== (grid[0] + 1) * (grid[1] + 1)) throw new Error(`Wrong weight vertex count: ${p.id}`);
        for (const row of m.weights) if (row.length !== m.bindings.length || row.some(v => !Number.isFinite(v) || v < 0) || row.reduce((a, b) => a + b, 0) <= 0) throw new Error(`Invalid skin weights: ${p.id}`);
      }
      if (m.pin) {
        joint(m.pin.joint); point(m.pin.source, 'pin.source');
        if (!['x', 'y'].includes(m.pin.axis) || !(m.pin.end > m.pin.start)) throw new Error('Invalid terminal pin');
        const scale = Array.isArray(m.pin.scale) ? m.pin.scale : [m.pin.scale ?? 1, m.pin.scale ?? 1];
        point(scale, 'pin scale'); if (scale.some(v => v === 0)) throw new RangeError('Pin scale cannot be zero');
      }
    } else {
      joint(p.from); if (p.to) joint(p.to); point(p.pivot, `pivot ${p.id}`);
      const scale = Array.isArray(p.scale) ? p.scale : [p.scale ?? 1, p.scale ?? 1];
      point(scale, 'part scale'); if (scale.some(v => v === 0)) throw new RangeError('Part scale cannot be zero');
    }
    if (p.orientation) {
      const o = p.orientation;
      if (!['left', 'right'].includes(o.side) || !['left', 'right'].includes(o.sourceSide)) throw new Error(`Orientation requires anatomical side/sourceSide: ${p.id}`);
      const expectedMirror = o.side !== o.sourceSide;
      const signs = p.mesh ? p.mesh.bindings.map(b => (b.widthScale ?? 1) < 0) : [Array.isArray(p.scale) ? p.scale[0] * p.scale[1] < 0 : false];
      if (signs.some(mirrored => mirrored !== expectedMirror)) throw new Error(`Handedness mismatch between source side and binding mirror: ${p.id}`);
      if (p.mesh?.pin) {
        const s = p.mesh.pin.scale ?? 1, mirrored = Array.isArray(s) ? s[0] * s[1] < 0 : false;
        if (mirrored !== expectedMirror) throw new Error(`Terminal pin mirror conflicts with part handedness: ${p.id}`);
      }
    }
  }
  for (const pair of d.pairs || []) {
    const left = d.parts.find(p => p.id === pair.left), right = d.parts.find(p => p.id === pair.right);
    if (!left || !right || left === right) throw new Error(`Paired parts must identify distinct loaded parts: ${pair.id}`);
    if (left.orientation?.side !== 'left' || right.orientation?.side !== 'right') throw new Error(`Paired part identity does not match anatomical left/right: ${pair.id}`);
  }
  return d;
}
export function restPose(d) { return { joints: structuredClone(d.joints), transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, meta: {} }; }

function makeCanvas(w, h) {
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(w, h);
  c.width = w; c.height = h; return c;
}
function mapping(v, binding, joints) {
  const a = binding.sourceA, b = binding.sourceB, A = joints[binding.from], B = joints[binding.to];
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy), ex = B[0] - A[0], ey = B[1] - A[1], n = Math.hypot(ex, ey);
  const u = ((v[0] - a[0]) * dx + (v[1] - a[1]) * dy) / (l * l), off = ((v[1] - a[1]) * dx - (v[0] - a[0]) * dy) / l;
  const s = binding.widthScale ?? n / l, nx = n > 1e-8 ? -ey / n : -dy / l, ny = n > 1e-8 ? ex / n : dx / l;
  return [A[0] + u * ex + off * s * nx, A[1] + u * ey + off * s * ny];
}
export function skinVertex(v, mesh, joints, index = 0) {
  let weights = mesh.weights?.[index];
  if (!weights) {
    if (mesh.bindings.length === 1) weights = [1];
    else { const b = mesh.blend, u = smooth((v[b.axis === 'x' ? 0 : 1] - b.start) / (b.end - b.start)); weights = [1 - u, u]; }
  }
  const total = weights.reduce((a, b) => a + b, 0), P = [0, 0];
  for (let i = 0; i < weights.length; i++) { const q = mapping(v, mesh.bindings[i], joints); P[0] += q[0] * weights[i] / total; P[1] += q[1] * weights[i] / total; }
  if (mesh.pin) {
    const pin = mesh.pin, u = smooth((v[pin.axis === 'x' ? 0 : 1] - pin.start) / (pin.end - pin.start));
    const scale = Array.isArray(pin.scale) ? pin.scale : [pin.scale ?? 1, pin.scale ?? 1], anchor = joints[pin.joint];
    P[0] = lerp(P[0], anchor[0] + (v[0] - pin.source[0]) * scale[0], u);
    P[1] = lerp(P[1], anchor[1] + (v[1] - pin.source[1]) * scale[1], u);
  }
  return P;
}
function triangle(ctx, image, source, target) {
  const [p0, p1, p2] = source, [q0, q1, q2] = target;
  const a = p1[0] - p0[0], b = p1[1] - p0[1], c = p2[0] - p0[0], d = p2[1] - p0[1], det = a * d - b * c;
  if (Math.abs(det) < 1e-9) return;
  const A = ((q1[0] - q0[0]) * d - (q2[0] - q0[0]) * b) / det, B = ((q1[1] - q0[1]) * d - (q2[1] - q0[1]) * b) / det;
  const C = ((q2[0] - q0[0]) * a - (q1[0] - q0[0]) * c) / det, D = ((q2[1] - q0[1]) * a - (q1[1] - q0[1]) * c) / det;
  ctx.save(); ctx.beginPath(); ctx.moveTo(...q0); ctx.lineTo(...q1); ctx.lineTo(...q2); ctx.closePath(); ctx.clip();
  ctx.transform(A, B, C, D, q0[0] - A * p0[0] - C * p0[1], q0[1] - B * p0[0] - D * p0[1]); ctx.drawImage(image, 0, 0); ctx.restore();
}
export class CutoutRig {
  constructor(definition, assets) {
    validateRig(definition); this.definition = structuredClone(definition);
    this.canvas = makeCanvas(definition.canvas.width, definition.canvas.height); this.ctx = this.canvas.getContext('2d');
    this.parts = definition.parts.map(p => {
      const asset = assets[p.asset]; if (!asset) throw new Error(`Asset not loaded: ${p.asset}`);
      const [x, y, w, h] = p.rect;
      if (x + w > (asset.naturalWidth || asset.width) || y + h > (asset.naturalHeight || asset.height)) throw new RangeError(`Crop exceeds image: ${p.id}`);
      const image = makeCanvas(w, h); image.getContext('2d').drawImage(asset, x, y, w, h, 0, 0, w, h);
      return { ...p, image };
    }).sort((a, b) => (a.layer || 0) - (b.layer || 0));
  }
  // parts:false draws only the skeleton (with skeleton:true), for an overlay over an already drawn character.
  draw(ctx, pose = restPose(this.definition), { skeleton = false, parts = true } = {}) {
    const joints = { ...this.definition.joints, ...pose.joints }, tr = pose.transform || {}, origin = this.definition.canvas.origin;
    for (const [id, p] of Object.entries(joints)) point(p, `pose joint ${id}`);
    for (const [k, v] of Object.entries(tr)) number(v, `transform ${k}`);
    ctx.save(); ctx.translate(origin[0] + (tr.x || 0), origin[1] + (tr.y || 0)); ctx.rotate(tr.rotation || 0); ctx.scale(tr.scaleX ?? 1, tr.scaleY ?? 1);
    for (const p of parts === false ? [] : this.parts) {
      ctx.save(); ctx.globalAlpha *= p.opacity ?? 1; if (p.filter) ctx.filter = p.filter;
      if (p.mesh) {
        const [nx, ny] = p.mesh.grid || [8, 12], vertices = [];
        for (let y = 0; y <= ny; y++) for (let x = 0; x <= nx; x++) { const s = [x * p.image.width / nx, y * p.image.height / ny]; vertices.push({ s, d: skinVertex(s, p.mesh, joints, vertices.length) }); }
        for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { const a = vertices[y * (nx + 1) + x], b = vertices[y * (nx + 1) + x + 1], c = vertices[(y + 1) * (nx + 1) + x], d = vertices[(y + 1) * (nx + 1) + x + 1]; triangle(ctx, p.image, [a.s, b.s, d.s], [a.d, b.d, d.d]); triangle(ctx, p.image, [a.s, d.s, c.s], [a.d, d.d, c.d]); }
      } else {
        const A = joints[p.from], B = p.to ? joints[p.to] : null, scale = Array.isArray(p.scale) ? p.scale : [p.scale ?? 1, p.scale ?? 1];
        ctx.translate(...A); ctx.rotate((B ? Math.atan2(B[1] - A[1], B[0] - A[0]) - (p.sourceAngle || 0) : 0) + (p.rotation || 0)); ctx.scale(...scale); ctx.drawImage(p.image, -p.pivot[0], -p.pivot[1]);
      }
      ctx.restore();
    }
    if (skeleton) {
      ctx.strokeStyle = '#17aa91'; ctx.lineWidth = typeof skeleton === 'number' ? skeleton : 2;
      for (const b of this.definition.bones || []) { ctx.beginPath(); ctx.moveTo(...joints[b[0]]); ctx.lineTo(...joints[b[1]]); ctx.stroke(); }
      const r = typeof skeleton === 'number' ? skeleton * 1.75 : 3.5;
      // Joints that no bone uses (aim targets, helpers) are left out, so only the chains show.
      const used = new Set((this.definition.bones || []).flat());
      for (const [id, p] of Object.entries(joints)) { if (used.size && !used.has(id)) continue; ctx.fillStyle = '#ff765f'; ctx.beginPath(); ctx.arc(...p, r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore(); return this;
  }
  frame(pose, options) { this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.draw(this.ctx, pose, options); return this.canvas; }
  getPart(id) { const p = this.parts.find(p => p.id === id); if (!p) throw new Error(`Unknown part: ${id}`); return p.image; }
}
export async function loadRig(input, { baseURL } = {}) {
  const url = typeof input === 'string' || input instanceof URL ? new URL(input, baseURL || document.baseURI) : null;
  let definition = input;
  if (url) { const r = await fetch(url); if (!r.ok) throw new Error(`Rig fetch failed (${r.status}): ${url}`); definition = await r.json(); }
  validateRig(definition); const base = url || new URL(baseURL || document.baseURI), assets = {};
  await Promise.all(Object.entries(definition.assets).map(async ([id, path]) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.src = new URL(path, base).href; try { await im.decode(); } catch { throw new Error(`Image decode failed: ${id} (${im.src})`); } assets[id] = im; }));
  return new CutoutRig(definition, assets);
}
