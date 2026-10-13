// Raw 2D studio effects with the public Apricot and Milo subjects. Every frame
// is a function of t: poses, light, palette, clocks and dot geometry are all
// computed from the requested time; caches only memoise those results.
import { loadSubject, catPounce, catPortrait, robotGroove, robotBonk, CAT_CLIP } from "./subjects.js";
import { rigRenderer } from "./rig-gl.js";

const W = 1280, H = 720;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const mix = (a, b, u) => a + (b - a) * u;
function canvas(w = W, h = H) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
const finite = (t) => {
  if (!Number.isFinite(t)) throw new Error("Frame time must be finite");
  return Math.max(0, t);
};
function label(g, text, x, y, size, color, weight = 700, align = "left", font = "Arial") {
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align;
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.textAlign = "left";
}

// ---------------------------------------------------------------------------
// Halftone close-up (video-dots) and beat-cut halftone (dot-rhythm)
// ---------------------------------------------------------------------------
const PITCH = 12; // 1280-wide frame: 12 px = 3.6 CSS px in a 382 px tile.
const HALF_PALETTES = [
  { paper: "#f4ead5", ink: "#18284a" },
  { paper: "#ffd23f", ink: "#2a1840" },
  { paper: "#13213a", ink: "#ffd9a8", invert: true },
  { paper: "#ff6b4a", ink: "#1b1530" },
  { paper: "#9be3d1", ink: "#2d1e4f" },
  { paper: "#1c0f2e", ink: null, invert: true },
  { paper: "#f7f1e3", ink: "#c4302b" },
  { paper: "#1a2e5c", ink: "#7af0ff", invert: true },
];
// Render the posed subject at half resolution and read its (premultiplied) RGBA.
function sampleSubject(rig, pose, x, y, s) {
  const R = rigRenderer();
  R.begin(W / 2, H / 2);
  R.draw(rig, pose, x / 2, y / 2, s / 2);
  return R.read();
}
function lum(d, k) { const a = d[k + 3] / 255 || 1; return (d[k] * 0.299 + d[k + 1] * 0.587 + d[k + 2] * 0.114) / 255 / a; }
// Individual fills batch well on a GPU canvas; one Path2D with thousands of
// sub-paths has to be tessellated as a single complex shape and is far slower.
function dotShape(path, shape, x, y, r) {
  if (r <= 0.15) return;
  path.beginPath();
  if (shape === "square") { path.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8); return; }
  if (shape === "diamond") { path.moveTo(x, y - r * 1.2); path.lineTo(x + r * 1.2, y); path.lineTo(x, y + r * 1.2); path.lineTo(x - r * 1.2, y); path.closePath(); return; }
  if (shape === "bar") { path.rect(x - r * 1.25, y - r * 0.45, r * 2.5, r * 0.9); return; }
  path.arc(x, y, r, 0, Math.PI * 2);
}
function dot(g, shape, x, y, r) {
  if (r <= 0.15) return;
  dotShape(g, shape, x, y, r);
  g.fill();
}

export async function createVideoDots() {
  const cat = await loadSubject("cat"), out = canvas(), g = out.getContext("2d");
  const P = 4.8, BEAT = 0.6;
  let proof = {};
  return {
    canvas: out,
    proof: () => proof,
    async frame(time) {
      const t = finite(time), u = (t % P) / P;
      const beat = Math.floor((t % P) / BEAT), pal = HALF_PALETTES[beat % HALF_PALETTES.length];
      // Push in from Apricot's whole body to the eye, then return for the loop.
      const push = 0.5 - 0.5 * Math.cos(u * Math.PI * 2), zoom = mix(2.9, 6.4, smooth(push));
      const focus = [mix(30, 102, smooth(push)), mix(-14, -54, smooth(push))];
      const pose = catPortrait(cat.definition, t);
      const data = sampleSubject(cat, pose, 640 - focus[0] * zoom, 372 - focus[1] * zoom, zoom), sw = W / 2;
      // A hard key light sweeps over the subject; the rest of the face falls into shadow.
      const lx = 640 + 470 * Math.cos(u * Math.PI * 2 + 0.6), ly = 300 + 170 * Math.sin(u * Math.PI * 4);
      const kick = Math.exp(-((t % BEAT) / BEAT) * 5);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = pal.paper;
      g.fillRect(0, 0, W, H);
      const inked = [], shade = [], colored = [], tones = [], lit = [];
      let rmin = Infinity, rmax = 0, dots = 0;
      for (let y = PITCH / 2; y < H; y += PITCH)
        for (let x = PITCH / 2; x < W; x += PITCH) {
          const k = ((y >> 1) * sw + (x >> 1)) * 4, spot = Math.exp(-((x - lx) ** 2 + (y - ly) ** 2) / (2 * 250 ** 2));
          if (data[k + 3] < 110) {
            // The light cone is visible on the paper as a faint halftone.
            const r = PITCH * 0.26 * (pal.invert ? spot : 1 - spot) * (0.6 + 0.4 * kick);
            if (r > 0.6) shade.push(x, y, r);
            continue;
          }
          const L = clamp(lum(data, k) * (0.1 + 1.25 * spot + 0.18 * kick));
          tones.push(L);
          lit.push(x, y, data[k] * (0.25 + 1.1 * spot), data[k + 1] * (0.25 + 1.1 * spot), data[k + 2] * (0.25 + 1.1 * spot));
        }
      // Exposure: stretch this frame's subject tones (2nd–98th percentile) over the
      // full dot range, so highlights stay small and shadows stay large wherever the light is.
      const sorted = Float32Array.from(tones).sort(), lo = sorted[Math.floor(sorted.length * 0.02)] ?? 0, hi = sorted[Math.floor(sorted.length * 0.98)] ?? 1;
      for (let i = 0; i < tones.length; i++) {
        const L = clamp((tones[i] - lo) / Math.max(0.05, hi - lo)), v = pal.invert ? L : 1 - L, r = PITCH * (0.07 + 0.55 * v ** 0.85);
        rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); dots++;
        if (pal.ink) inked.push(lit[i * 5], lit[i * 5 + 1], r);
        else colored.push(lit[i * 5], lit[i * 5 + 1], r, lit[i * 5 + 2], lit[i * 5 + 3], lit[i * 5 + 4]);
      }
      g.globalAlpha = 0.28;
      g.fillStyle = pal.ink || "#f6c1a3";
      for (let i = 0; i < shade.length; i += 3) dot(g, "circle", shade[i], shade[i + 1], shade[i + 2]);
      g.globalAlpha = 1;
      g.fillStyle = pal.ink || "#000";
      for (let i = 0; i < inked.length; i += 3) dot(g, "circle", inked[i], inked[i + 1], inked[i + 2]);
      for (let i = 0; i < colored.length; i += 6) {
        g.fillStyle = `rgb(${colored[i + 3] | 0},${colored[i + 4] | 0},${colored[i + 5] | 0})`;
        g.beginPath();
        g.arc(colored[i], colored[i + 1], colored[i + 2], 0, Math.PI * 2);
        g.fill();
      }
      const text = pal.invert ? pal.ink || "#f6c1a3" : pal.ink;
      label(g, "HALFTONE", 44, 58, 30, text, 900);
      label(g, `BEAT ${beat + 1} / 8 · DOT ${PITCH}px`, 44, 92, 18, text, 600, "left", "monospace");
      proof = { mode: "video-dots", subject: "Apricot", beat, palette: beat % HALF_PALETTES.length, pitch: PITCH, dots, radius: [rmin, rmax], diameterRatio: rmax / Math.max(1e-6, rmin), zoom, light: [lx, ly] };
    },
  };
}

const RHYTHM = {
  pitch: [12, 18, 12, 26, 14, 20, 12, 30],
  shape: ["circle", "square", "circle", "diamond", "circle", "bar", "square", "circle"],
  palette: [
    { paper: "#ffd23f", ink: "#25123a" }, { paper: "#25123a", ink: null }, { paper: "#ff4f6e", ink: "#fff3d6" },
    { paper: "#0f2442", ink: "#ffd23f" }, { paper: "#f4ead5", ink: "#1b2f5c" }, { paper: "#2de0c2", ink: "#1b1530" },
    { paper: "#1b1530", ink: null }, { paper: "#ff8a3d", ink: "#1b1530" },
  ],
  frame: ["wide", "mid", "close", "mid"],
};
export async function createDotRhythm() {
  const robot = await loadSubject("robot"), out = canvas(), g = out.getContext("2d");
  const HALF = 0.3;
  let proof = {};
  return {
    canvas: out,
    proof: () => proof,
    async frame(time) {
      const t = finite(time), local = t % 4.8, cut = Math.floor(local / HALF), k = cut % 8, age = local - cut * HALF;
      const pitch = RHYTHM.pitch[k], shape = RHYTHM.shape[k], pal = RHYTHM.palette[(cut * 3) % 8], framing = RHYTHM.frame[Math.floor(cut / 2) % 4];
      const punch = 1 + 0.07 * Math.exp(-age * 14);
      const zoom = { wide: 2.05, mid: 3.2, close: 5.0 }[framing] * punch, focus = { wide: [0, -52], mid: [0, -85], close: [0, -125] }[framing];
      const pose = robotGroove(robot.definition, t);
      const data = sampleSubject(robot, pose, 640 - focus[0] * zoom, 372 - focus[1] * zoom, zoom), sw = W / 2;
      g.fillStyle = pal.paper;
      g.fillRect(0, 0, W, H);
      const colored = [];
      if (pal.ink) g.fillStyle = pal.ink;
      for (let y = pitch / 2; y < H; y += pitch)
        for (let x = pitch / 2; x < W; x += pitch) {
          const sx = Math.min(sw - 1, Math.round(x) >> 1), sy = Math.min(H / 2 - 1, Math.round(y) >> 1), q = (sy * sw + sx) * 4;
          if (data[q + 3] < 110) continue;
          const L = lum(data, q), r = pitch * (pal.ink ? 0.1 + 0.48 * (1 - L) ** 0.8 : 0.42);
          if (pal.ink) dot(g, shape, x, y, r);
          else colored.push(x, y, r, q);
        }
      for (let i = 0; i < colored.length; i += 4) {
        const q = colored[i + 3], a = data[q + 3] / 255 || 1;
        g.fillStyle = `rgb(${data[q] / a | 0},${data[q + 1] / a | 0},${data[q + 2] / a | 0})`;
        dot(g, shape, colored[i], colored[i + 1], colored[i + 2]);
      }
      const text = pal.ink || "#ffd23f";
      label(g, ["1", "&", "2", "&", "3", "&", "4", "&"][cut % 8], 1210, 92, 64, text, 900, "right");
      label(g, `100 BPM · ½ BEAT · ${pitch}px ${shape.toUpperCase()}`, 44, 680, 20, text, 700, "left", "monospace");
      proof = { mode: "dot-rhythm", subject: "Milo", cut, pitch, shape, palette: pal.paper, framing };
    },
  };
}

// ---------------------------------------------------------------------------
// Time echoes and speed ramps (echo) and the clock-only variant (time-remap)
// ---------------------------------------------------------------------------
// Speed profile knots [output seconds, playback speed]; the final speed is
// solved so the source clock reaches the end of the clip exactly at 6 s.
function speedProfile(knots, end = 6, clip = CAT_CLIP, rampOut = 0.3) {
  const pts = knots.map((k) => [...k]);
  const area = (a, b) => (b[0] - a[0]) * (a[1] + b[1]) / 2;
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += area(pts[i - 1], pts[i]);
  const last = pts.at(-1), v = (clip - s - rampOut * last[1] / 2) / (rampOut / 2 + (end - last[0] - rampOut));
  pts.push([last[0] + rampOut, v], [end, v]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + area(pts[i - 1], pts[i]));
  return {
    knots: pts,
    final: v,
    speed(t) {
      t = clamp(t, 0, end);
      for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) return mix(pts[i - 1][1], pts[i][1], (t - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0] || 1));
      return v;
    },
    source(t) {
      t = clamp(t, 0, end);
      for (let i = 1; i < pts.length; i++)
        if (t <= pts[i][0]) {
          const a = pts[i - 1], b = pts[i], d = t - a[0], slope = (b[1] - a[1]) / (b[0] - a[0] || 1);
          return clamp(cum[i - 1] + a[1] * d + slope * d * d / 2, 0, clip);
        }
      return clip;
    },
  };
}
const ECHO_CLOCK = speedProfile([[0, 1], [1, 1], [1.4, 0.35], [2.2, 0.35], [2.4, 0], [3.4, 0], [3.6, -0.6], [4.2, -0.6]]);
const ECHO_STATES = [
  { at: 0, end: 1, name: "NORMAL", color: "#9fe8ff" },
  { at: 1, end: 2.4, name: "SLOW", color: "#ffd23f" },
  { at: 2.4, end: 3.4, name: "HOLD", color: "#ff4f8b" },
  { at: 3.4, end: 4.2, name: "REVERSE", color: "#b28cff" },
  { at: 4.2, end: 6, name: "RAMP", color: "#5dffb0" },
];
const REMAP_CLOCK = speedProfile([[0, 1], [0.9, 1], [1.2, 0.3], [2.1, 0.3], [2.2, 0], [3.0, 0], [3.1, -0.8], [3.7, -0.8]]);
const REMAP_STATES = [
  { at: 0, end: 0.9, name: "NORMAL", color: "#9fe8ff" },
  { at: 0.9, end: 2.2, name: "SLOW", color: "#ffd23f" },
  { at: 2.2, end: 3.0, name: "HOLD", color: "#ff4f8b" },
  { at: 3.0, end: 3.7, name: "REVERSE", color: "#b28cff" },
  { at: 3.7, end: 6, name: "STEPS", color: "#5dffb0" },
];
// Echo count and spacing (source seconds) for each output time.
function echoSpec(t) {
  const n = t < 1 ? 3 : t < 1.4 ? mix(3, 10, smooth((t - 1) / 0.4)) : t < 3.4 ? 10 : t < 4.2 ? 10 : t < 4.6 ? mix(10, 4, smooth((t - 4.2) / 0.4)) : 4;
  let gap;
  if (t < 1) gap = 0.05;
  else if (t < 2.4) gap = mix(0.05, 0.045, smooth((t - 1) / 0.4));
  else if (t < 3.4) gap = mix(0.045, 0.11, smooth((t - 2.45) / 0.75)); // hold: the trail opens into a fan
  else if (t < 4.2) gap = mix(0.11, 0.004, smooth((t - 3.4) / 0.7)); // reverse: the trail retracts
  else gap = mix(0.004, 0.04, smooth((t - 4.2) / 0.5));
  return { count: Math.round(n), gap };
}
const CAT_SCALE = 1.4, CAT_X0 = -10 - 150 * CAT_SCALE, CAT_GROUND = 548, CAT_Y0 = CAT_GROUND - 70 * CAT_SCALE;
function hsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
}
function stateAt(states, t) { return states.find((s) => t < s.end) || states.at(-1); }

export async function createTimeEcho({ echoes = true } = {}) {
  const cat = await loadSubject("cat"), out = canvas(), g = out.getContext("2d");
  const clock = echoes ? ECHO_CLOCK : REMAP_CLOCK, states = echoes ? ECHO_STATES : REMAP_STATES;
  let proof = {};
  const place = (pose) => [CAT_X0 + pose.meta.worldX * CAT_SCALE, CAT_Y0];
  function backdrop(state) {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#1b0f38");
    sky.addColorStop(0.72, "#3a1758");
    sky.addColorStop(1, "#120a24");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(255,255,255,.06)";
    for (let x = -40; x < W; x += 80) g.fillRect(x, CAT_GROUND + 4, 2, 70);
    g.fillStyle = state.color;
    g.globalAlpha = 0.5;
    g.fillRect(0, CAT_GROUND + 2, W, 3);
    g.globalAlpha = 1;
  }
  function hud(t, state, speed, src) {
    const x0 = 60, x1 = 1220, y = 668;
    g.fillStyle = "rgba(10,6,22,.72)";
    g.fillRect(0, 600, W, 120);
    for (const st of states) {
      const a = mix(x0, x1, st.at / 6), b = mix(x0, x1, st.end / 6), on = st === state;
      g.fillStyle = st.color;
      g.globalAlpha = on ? 1 : 0.35;
      g.fillRect(a + 2, y - 8, b - a - 4, 16);
      label(g, st.name, (a + b) / 2, y - 22, on ? 22 : 17, st.color, on ? 900 : 700, "center");
    }
    g.globalAlpha = 1;
    // The playback-speed curve sits under the track; the playhead marks output time.
    g.strokeStyle = "rgba(255,255,255,.55)";
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i <= 120; i++) {
      const tt = (i / 120) * 6, px = mix(x0, x1, tt / 6), py = y + 30 - clock.speed(tt) * 10;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
    const px = mix(x0, x1, t / 6);
    g.fillStyle = "#ffffff";
    g.fillRect(px - 2, y - 16, 4, 52);
    label(g, state.name, 44, 72, 54, state.color, 900);
    const rate = state.name === "HOLD" ? "0×" : state.name === "STEPS" ? "6 fps" : (speed < 0 ? "−" : "") + Math.abs(speed).toFixed(2) + "×";
    label(g, `PLAYBACK ${rate}   SOURCE ${src.toFixed(2)} s`, 46, 108, 22, "#efe6ff", 700, "left", "monospace");
  }
  function graph(t, src) {
    const x = 890, y = 112, w = 330, h = 170;
    g.fillStyle = "rgba(10,6,22,.6)";
    g.fillRect(x - 16, y - 46, w + 32, h + 76);
    label(g, "SOURCE CLOCK", x, y - 18, 18, "#cbbdf2", 800, "left", "monospace");
    g.strokeStyle = "rgba(255,255,255,.25)";
    g.lineWidth = 1;
    g.strokeRect(x, y, w, h);
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x + w, y);
    g.setLineDash([4, 6]);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = "#ffffff";
    g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i <= 180; i++) {
      const tt = (i / 180) * 6, ss = mappedSource(tt), px = x + (tt / 6) * w, py = y + h - (ss / CAT_CLIP) * h;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
    const st = stateAt(states, t);
    g.fillStyle = st.color;
    g.beginPath();
    g.arc(x + (t / 6) * w, y + h - (src / CAT_CLIP) * h, 9, 0, Math.PI * 2);
    g.fill();
    label(g, "output time →", x + w, y + h + 22, 15, "#cbbdf2", 600, "right", "monospace");
  }
  function mappedSource(t) {
    if (!echoes && t >= 3.7) return clock.source(3.7 + Math.floor((t - 3.7) * 6) / 6);
    return clock.source(t);
  }
  return {
    canvas: out,
    proof: () => proof,
    async frame(time) {
      const t = finite(time) % 6, src = mappedSource(t), state = stateAt(states, t), speed = clock.speed(t);
      backdrop(state);
      const pose = catPounce(cat.definition, src), [px, py] = place(pose);
      const spec = echoes ? echoSpec(t) : { count: 0, gap: 0 };
      let farthest = 0;
      // Oldest echo first; each is a solid tinted silhouette of a real earlier source time.
      const R = rigRenderer();
      R.begin(W, H);
      for (let i = spec.count; i >= 1; i--) {
        const es = src - i * spec.gap;
        if (es < 0) continue;
        const ep = catPounce(cat.definition, es), [ex, ey] = place(ep), f = (i - 1) / Math.max(1, spec.count - 1);
        farthest = Math.max(farthest, Math.hypot(ex - px, (ep.transform.y - pose.transform.y) * CAT_SCALE));
        R.draw(cat, ep, ex, ey, CAT_SCALE, { tint: hsl(mix(325, 185, f), 0.95, state.name === "HOLD" ? 0.64 : 0.6), alpha: mix(0.92, 0.32, f) });
      }
      R.draw(cat, pose, px, py, CAT_SCALE);
      R.blit(g);
      if (echoes) hud(t, state, speed, src);
      else { hud(t, state, speed, src); graph(t, src); }
      const subjectWidth = 330 * CAT_SCALE;
      proof = { mode: echoes ? "echo" : "time-remap", subject: "Apricot", state: state.name, speed, sourceTime: src, layers: spec.count, gap: spec.gap, farthest, subjectWidth, remap: state.name.toLowerCase() };
    },
  };
}
export const ECHO_TIMELINE = ECHO_STATES.map((s) => ({ ...s }));
export const REMAP_TIMELINE = REMAP_STATES.map((s) => ({ ...s }));

// ---------------------------------------------------------------------------
// Local dot impact and recovery (dot-impact)
// ---------------------------------------------------------------------------
export async function createDotImpact() {
  const robot = await loadSubject("robot"), out = canvas(), g = out.getContext("2d");
  const P = 4.8, HIT = 1.6, SCALE = 2.1, X = 560, Y = 470, PITCH_I = 11;
  const contactRig = [50, -140];
  let proof = {};
  function ball(t) {
    const cx = X + contactRig[0] * SCALE + 46, cy = Y + contactRig[1] * SCALE - 8;
    if (t < HIT) { const u = (t - (HIT - 0.55)) / 0.55; return u < 0 ? null : [mix(1380, cx, u), mix(cy - 160, cy, u) - 90 * Math.sin(Math.PI * u) * 0.4]; }
    const a = t - HIT;
    return a > 1.4 ? null : [cx + 620 * a, cy - 420 * a + 520 * a * a];
  }
  return {
    canvas: out,
    proof: () => proof,
    async frame(time) {
      const t = finite(time) % P, age = t - HIT, pose = robotBonk(robot.definition, t, HIT);
      const data = sampleSubject(robot, pose, X, Y, SCALE), sw = W / 2, b = ball(t);
      const c = [X + contactRig[0] * SCALE, Y + contactRig[1] * SCALE];
      const u = age / 0.75, e = u < 0 || u > 1 ? 0 : Math.sin(Math.PI * u) * Math.exp(-2.2 * u), ring = age > 0 && age < 0.9 ? 40 + age * 620 : -1;
      g.fillStyle = "#0e1a30";
      g.fillRect(0, 0, W, H);
      let moved = 0;
      for (let y = PITCH_I / 2; y < H; y += PITCH_I)
        for (let x = PITCH_I / 2; x < W; x += PITCH_I) {
          const q = ((y >> 1) * sw + (x >> 1)) * 4, inBall = b && Math.hypot(x - b[0], y - b[1]) < 44;
          if (data[q + 3] < 110 && !inBall) continue;
          const dx = x - c[0], dy = y - c[1], d = Math.hypot(dx, dy) || 1, near = Math.exp(-(d * d) / (2 * 120 ** 2));
          const push = e * near, wave = ring > 0 ? Math.exp(-((d - ring) ** 2) / (2 * 26 ** 2)) * (1 - age / 0.9) : 0;
          const jitter = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1;
          const px = x + (dx / d) * push * 150 + jitter * push * 70, py = y + (dy / d) * push * 110 + (jitter - 0.5) * push * 50;
          const r = PITCH_I * (0.42 * (1 - 0.55 * push) + 0.22 * wave);
          if (push > 0.02) moved++;
          const hot = clamp(push * 1.6 + wave);
          const base = inBall ? (Math.hypot(x - b[0] + 14, y - b[1] + 15) < 13 ? [255, 208, 216] : [255, 59, 92]) : [data[q], data[q + 1], data[q + 2]].map((v) => v * 255 / data[q + 3]);
          const col = base.map((v, i) => Math.round(mix(v, [255, 92, 112][i], hot * 0.7)));
          g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
          dot(g, "circle", px, py, r);
        }
      label(g, age >= 0 && age < 1.2 ? "IMPACT · RECOVER" : "LOCAL IMPACT", 44, 64, 30, "#ffd0d8", 900);
      proof = { mode: "dot-impact", subject: "Milo", hit: HIT, event: e, displaced: moved, ring };
    },
  };
}
