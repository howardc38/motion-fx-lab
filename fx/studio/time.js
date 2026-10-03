export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (v) => {
  v = clamp(v);
  return v * v * (3 - 2 * v);
};
export const mix = (a, b, t) => a + (b - a) * t;
export function seeded(seed = 17) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function timeAt(t, mode = "normal") {
  t = Math.max(0, t);
  if (mode === "freeze") return Math.min(t, 1.35);
  if (mode === "reverse") return Math.max(0, 4.8 - t);
  if (mode === "steps") return Math.floor(t * 6) / 6;
  if (mode === "ramp")
    return t < 1.2
      ? t
      : t < 2.4
        ? 1.2 + (t - 1.2) * 0.2
        : t < 3.6
          ? 1.44
          : 1.44 + (t - 3.6) * 2;
  return t;
}
export function impact(t, at = 2, duration = 0.7) {
  const u = (t - at) / duration;
  return u < 0 || u > 1 ? 0 : Math.sin(Math.PI * u) * Math.exp(-2 * u);
}
export function checkedTime(t) {
  if (!Number.isFinite(t)) throw new Error("Frame time must be finite");
  return Math.max(0, t);
}
