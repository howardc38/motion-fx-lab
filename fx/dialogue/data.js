// Timeline data shared by the dialogue films: the checked manifest, mouth cues, words and beats.
// Every function here maps an absolute time to a value; nothing depends on the previous frame.
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const lerp = (a, b, t) => a + (b - a) * t;
/** 0 -> 1 -> 0 envelope: rises over `a` seconds from t0, holds, falls over `b` seconds ending at t1. */
export const env = (t, t0, t1, a = .25, b = .3) => smooth((t - t0) / a) * (1 - smooth((t - (t1 - b)) / b));
/** Damped spring response to an impulse at t0 (0 before t0). */
export const spring = (t, t0, freq = 3, damp = 4) => t < t0 ? 0 : Math.sin((t - t0) * freq * 2 * Math.PI) * Math.exp(-(t - t0) * damp);
export const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

let dataPromise;
export function loadData() {
  return dataPromise ??= fetch(new URL('../../assets/dialogue/manifest.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('Dialogue manifest failed'); return r.json(); })
    .then(d => { if (d.version !== 1 || !d.films) throw new Error('Unsupported dialogue manifest'); return d; });
}
/** Faces a turn drives: its speaker, or every face listed for a replayed line. */
export const facesOf = turn => turn.faces || [turn.speaker];
export function activeTurn(spec, t) { return spec.turns.find(l => t >= l.start && t < l.end); }
export function turnFor(spec, face, t) { return spec.turns.find(l => facesOf(l).includes(face) && t >= l.start && t < l.end); }
/** Blended mouth shape at absolute time t from a table of shapes (arrays), with 45 ms transitions. */
export function mouthAt(turn, t, shapes) {
  if (!turn || t < turn.start || t >= turn.end) return {value: shapes.X, id: 'X'};
  const s = t - turn.start, cs = turn.mouth, i = cs.findIndex(c => s >= c.start && s < c.end);
  if (i < 0) return {value: shapes.X, id: 'X'};
  const c = cs[i], a = shapes[c.value], prev = shapes[cs[i - 1]?.value || 'X'], u = smooth((s - c.start) / Math.min(.045, (c.end - c.start) * .4));
  return {value: a.map((v, j) => lerp(prev[j], v, u)), id: c.value};
}
/** Index of the word being spoken at t (or the last one finished), -1 before the first. */
export function wordIndex(turn, t) {
  if (!turn?.words) return -1; const s = t - turn.start; let k = -1;
  turn.words.forEach((w, i) => { if (s >= w.start - .02) k = i; });
  return k;
}
/** Time of the n-th word (case-insensitive prefix match) of the first turn with this gesture. */
export function wordTime(spec, gesture, prefix, n = 0) {
  const turn = spec.turns.find(l => l.gesture === gesture); if (!turn) return null;
  const hits = turn.words.filter(w => w.text.toLowerCase().startsWith(prefix)); const w = hits[n];
  return w ? turn.start + w.start : null;
}
export const byGesture = (spec, g) => spec.turns.find(l => l.gesture === g);
