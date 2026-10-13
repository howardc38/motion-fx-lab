// Pure 2D animation math. Coordinates use canvas axes: +x right, +y down.
export const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export const lerp = (a, b, u) => a + (b - a) * u;
export const smooth = n => { const u = clamp(n); return u * u * (3 - 2 * u); };
export const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export function point(value, label = 'point') {
  if (!Array.isArray(value) || value.length !== 2 || value.some(n => !Number.isFinite(n))) throw new TypeError(`${label} must be [finite x, finite y]`);
  return value;
}
export function solveIK(root, requested, upper, lower, bend = 1) {
  point(root, 'IK root'); point(requested, 'IK target');
  if (!(upper > 0) || !(lower > 0) || !Number.isFinite(upper + lower) || ![-1, 1].includes(bend)) throw new RangeError('IK lengths must be positive; bend is -1 or 1');
  const actual = distance(root, requested), d = clamp(actual, Math.abs(upper - lower) + 1e-6, upper + lower - 1e-6);
  const direction = actual < 1e-9 ? Math.PI / 2 : Math.atan2(requested[1] - root[1], requested[0] - root[0]);
  const angle = direction + bend * Math.acos(clamp((upper * upper + d * d - lower * lower) / (2 * upper * d), -1, 1));
  return { knee: [root[0] + upper * Math.cos(angle), root[1] + upper * Math.sin(angle)], foot: [root[0] + d * Math.cos(direction), root[1] + d * Math.sin(direction)], reachable: Math.abs(actual - d) < 1e-5 };
}
export function sampleTrack(keys, time, easing = 'smooth') {
  if (!Array.isArray(keys) || keys.length === 0) throw new TypeError('A track requires keyframes');
  for (let i = 0; i < keys.length; i++) {
    if (!Number.isFinite(keys[i].t) || keys[i].t < 0 || i && keys[i].t <= keys[i - 1].t) throw new RangeError('Keyframe times must be finite, non-negative and strictly increasing');
    const v = keys[i].value;
    if (Array.isArray(v)) point(v, 'keyframe value'); else if (!Number.isFinite(v)) throw new TypeError('Keyframe value must be a number or 2D point');
    if (Array.isArray(v) !== Array.isArray(keys[0].value)) throw new TypeError('Track value types must agree');
  }
  if (!Number.isFinite(time)) throw new TypeError('Time must be finite');
  if (time <= keys[0].t) return structuredClone(keys[0].value);
  if (time >= keys.at(-1).t) return structuredClone(keys.at(-1).value);
  let i = 0; while (keys[i + 1].t < time) i++;
  const a = keys[i], b = keys[i + 1], raw = (time - a.t) / (b.t - a.t), u = easing === 'linear' ? raw : smooth(raw);
  return Array.isArray(a.value) ? a.value.map((v, j) => lerp(v, b.value[j], u)) : lerp(a.value, b.value, u);
}
