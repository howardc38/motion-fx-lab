// Cut-paper editorial collage and duotone newsprint halftone treatments (Canvas 2D, 0BSD).
// Every frame is a pure deterministic function of time t and integer seed; no Math.random is used.

const TAU = Math.PI * 2;
const LAT = '"Archivo", "Noto Sans TC", "Helvetica Neue", Arial, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const SERIF = '"Instrument Serif", Georgia, serif';

export const PERIODS = Object.freeze({ editorial: 6.4, halftone: 6.0 });

export const PALETTES = Object.freeze({
  bass: {
    mat: '#151311',
    matGrid: 'rgba(244, 236, 220, 0.065)',
    cream: '#f4ecdc',
    bone: '#fffdf7',
    kraft: '#d49a3a',
    kraftSoft: '#cbb48c',
    vermilion: '#e03b2b',
    cobalt: '#1e4fd6',
    ink: '#151619',
    inkSoft: '#2b2927',
    tape: 'rgba(246, 236, 206, 0.76)',
    brass: '#dda63a',
    glow: '#e8a849',
  },
  newsprint: {
    mat: '#161412',
    matGrid: 'rgba(241, 231, 208, 0.06)',
    cream: '#efe5ce',
    bone: '#fffdf8',
    kraft: '#c7aa7b',
    kraftSoft: '#dfd2b7',
    vermilion: '#d63426',
    cobalt: '#1844a8',
    ink: '#141312',
    inkSoft: '#35312c',
    tape: 'rgba(244, 233, 202, 0.74)',
    brass: '#d8a138',
    glow: '#d99b3c',
  },
  bauhaus: {
    mat: '#121418',
    matGrid: 'rgba(245, 241, 232, 0.06)',
    cream: '#f5f0e4',
    bone: '#ffffff',
    kraft: '#eab026',
    kraftSoft: '#d8ccb4',
    vermilion: '#d92b2b',
    cobalt: '#1847c7',
    ink: '#111216',
    inkSoft: '#2b2d34',
    tape: 'rgba(247, 239, 214, 0.75)',
    brass: '#e0ad3b',
    glow: '#eab026',
  },
});

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const lin = (a, b, x) => clamp((x - a) / (b - a));
const smooth = (x) => { const k = clamp(x); return k * k * (3 - 2 * k); };
const outCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
const inCubic = (x) => Math.pow(clamp(x), 3);
const inOut = (x) => { const k = clamp(x); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function spring(u, damping = 0.52, frequency = 9.5) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const q = Math.sqrt(Math.max(1e-4, 1 - damping * damping));
  const w = frequency * q;
  return 1 - Math.exp(-damping * frequency * u) * (Math.cos(w * u) + (damping / q) * Math.sin(w * u));
}

function sprAt(t, delay, dur = 0.54, damping = 0.52, frequency = 9.5) {
  return spring(clamp((t - delay) / dur), damping, frequency);
}

function hexRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex, alpha) {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${clamp(alpha)})`;
}

// Seeded 3D Perlin noise for deterministic paper fibres, torn deckle edges and stamp distress.
export function perlin3(seed = 11) {
  let s = (seed >>> 0) || 1;
  const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const perm = Array.from({ length: 256 }, (_, i) => i);
  const p = new Uint8Array(512);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
  }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = (x) => x * x * x * (x * (x * 6 - 15) + 10);
  const grad = (h, x, y, z) => {
    const k = h & 15;
    const u = k < 8 ? x : y;
    const v = k < 4 ? y : (k === 12 || k === 14 ? x : z);
    return ((k & 1) ? -u : u) + ((k & 2) ? -v : v);
  };
  return (x, y, z = 0) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(
      lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w,
    );
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// Straight scissored segments with slight hand-cut facet wobble around [-w/2..w/2, -h/2..h/2].
export function cutPolygonPoints(w, h, { seed = 3, jitter = 5.5, segs = 4 } = {}) {
  const hw = w / 2, hh = h / 2;
  const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  const pts = [];
  for (let e = 0; e < 4; e++) {
    const a = corners[e], b = corners[(e + 1) % 4];
    for (let i = 0; i < segs; i++) {
      const u = i / segs;
      const jx = (hash(seed * 31.7 + e * 19 + i * 3.7) - 0.5) * jitter;
      const jy = (hash(seed * 47.3 + e * 29 + i * 5.3 + 71) - 0.5) * jitter;
      pts.push([lerp(a[0], b[0], u) + jx, lerp(a[1], b[1], u) + jy]);
    }
  }
  return pts;
}

function tracePoly(g, pts) {
  g.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) g.moveTo(pts[i][0], pts[i][1]);
    else g.lineTo(pts[i][0], pts[i][1]);
  }
  g.closePath();
}

function makeStockPattern(ctx, hex, noise, seedOff = 0, { contrast = 0.085, specks = 85 } = {}) {
  const size = 224;
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const [br, bg, bb] = hexRgb(hex);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n1 = noise(x * 0.042 + seedOff, y * 0.042 + seedOff, 0.5) * 0.5;
      const n2 = noise(x * 0.24 + seedOff, y * 0.055 + seedOff, 2.1) * 0.35;
      const weave = Math.sin((x + y * 1.9) * 0.38) * 0.018;
      const m = 1 + (n1 + n2) * contrast + weave;
      const idx = (y * size + x) * 4;
      img.data[idx] = clamp(Math.round(br * m), 0, 255);
      img.data[idx + 1] = clamp(Math.round(bg * m), 0, 255);
      img.data[idx + 2] = clamp(Math.round(bb * m), 0, 255);
      img.data[idx + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < specks; i++) {
    const sx = hash(seedOff * 13 + i * 3.1) * size;
    const sy = hash(seedOff * 17 + i * 7.3) * size;
    const len = 1.5 + hash(seedOff + i * 11.9) * 6.5;
    const ang = hash(seedOff + i * 5.7) * TAU;
    g.strokeStyle = i % 3 === 0 ? 'rgba(255,252,244,0.06)' : 'rgba(30,24,18,0.055)';
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
    g.stroke();
  }
  return ctx.createPattern(c, 'repeat');
}

function makeGrainTile(seed = 19) {
  const size = 192;
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  let s = (seed * 747796405 + 2891336453) >>> 0;
  for (let i = 0; i < size * size; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const v = (s >>> 24) & 255;
    const p = i * 4;
    const lum = v > 128 ? 250 : 18;
    img.data[p] = lum;
    img.data[p + 1] = lum - 4;
    img.data[p + 2] = lum - 10;
    img.data[p + 3] = Math.abs(v - 128) > 84 ? 18 : 0;
  }
  g.putImageData(img, 0, 0);
  return c;
}

function drawScissoredSheet(g, pts, fill, { lift = 1, border = 'rgba(255,253,247,0.34)', keyline = 'rgba(18,17,16,0.14)' } = {}) {
  g.save();
  g.shadowColor = `rgba(0, 0, 0, ${clamp(0.26 + 0.14 * lift, 0, 0.55)})`;
  g.shadowBlur = 16 + 22 * lift;
  g.shadowOffsetX = 4 + 6 * lift;
  g.shadowOffsetY = 10 + 14 * lift;
  tracePoly(g, pts);
  g.fillStyle = fill;
  g.fill();
  g.restore();

  g.save();
  tracePoly(g, pts);
  g.clip();
  g.strokeStyle = border;
  g.lineWidth = 2.2;
  tracePoly(g, pts);
  g.stroke();
  g.strokeStyle = keyline;
  g.lineWidth = 1.1;
  g.stroke();
  g.restore();
}

// Torn paper card with exposed white cotton deckle fringe along the top and bottom edges.
function drawTornSheet(g, w, h, fill, coreColor, noise, seed, { lift = 1, deckle = 6.5 } = {}) {
  const hw = w / 2, hh = h / 2, steps = 44;
  const buildPoly = (offsetY) => {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, x = lerp(-hw, hw, u);
      const n = noise(u * 7.5 + seed, seed * 0.37, 0.2) * deckle + noise(u * 23 + seed, 1.4, 0.8) * (deckle * 0.42);
      pts.push([x, -hh + n + offsetY]);
    }
    for (let i = 1; i < 6; i++) {
      const u = i / 6;
      pts.push([hw + (hash(seed + i * 9) - 0.5) * 4, lerp(-hh, hh, u)]);
    }
    for (let i = steps; i >= 0; i--) {
      const u = i / steps, x = lerp(-hw, hw, u);
      const n = noise(u * 7.8 + seed + 9.2, seed * 0.71, 1.1) * deckle + noise(u * 21 + seed + 4, 2.7, 0.4) * (deckle * 0.42);
      pts.push([x, hh + n - offsetY * 0.85]);
    }
    for (let i = 5; i >= 1; i--) {
      const u = i / 6;
      pts.push([-hw + (hash(seed + 41 + i * 7) - 0.5) * 4, lerp(-hh, hh, u)]);
    }
    return pts;
  };

  const outer = buildPoly(-3.8);
  const inner = buildPoly(1.4);

  g.save();
  g.shadowColor = `rgba(0, 0, 0, ${clamp(0.28 + 0.14 * lift, 0, 0.56)})`;
  g.shadowBlur = 18 + 20 * lift;
  g.shadowOffsetX = 4 + 5 * lift;
  g.shadowOffsetY = 12 + 12 * lift;
  tracePoly(g, outer);
  g.fillStyle = coreColor;
  g.fill();
  g.restore();

  g.save();
  tracePoly(g, inner);
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = 'rgba(20, 18, 15, 0.10)';
  g.lineWidth = 1;
  g.stroke();
  g.restore();
}

// Semi-translucent crinkled masking tape strip with serrated zig-zag ends that slaps onto paper.
function drawMaskingTape(g, { x, y, w = 118, h = 32, rot = -14, progress = 1, color = 'rgba(246, 236, 206, 0.76)', seed = 5 }) {
  if (progress <= 0.001) return;
  const p = clamp(progress);
  const slap = spring(p, 0.56, 11);
  const lift = Math.max(0, 1 - slap);
  g.save();
  g.translate(x, y - lift * 22);
  g.rotate((rot + lift * 6) * Math.PI / 180);
  g.scale(0.88 + 0.12 * slap, 1 + lift * 0.12);
  g.globalAlpha = clamp(p * 3.2);

  const hw = (w * clamp(p * 1.15)) / 2, hh = h / 2;
  const teeth = 6;
  g.beginPath();
  g.moveTo(-hw, -hh);
  g.lineTo(hw, -hh);
  for (let i = 0; i <= teeth; i++) {
    const ty = lerp(-hh, hh, i / teeth);
    const jag = (i % 2 === 0 ? 3.5 : -2.5) + (hash(seed + i * 3.1) - 0.5) * 1.6;
    g.lineTo(hw + jag, ty);
  }
  g.lineTo(-hw, hh);
  for (let i = teeth; i >= 0; i--) {
    const ty = lerp(-hh, hh, i / teeth);
    const jag = (i % 2 === 0 ? -3.5 : 2.5) + (hash(seed + 19 + i * 2.7) - 0.5) * 1.6;
    g.lineTo(-hw + jag, ty);
  }
  g.closePath();

  g.save();
  g.shadowColor = `rgba(0, 0, 0, ${0.14 + 0.16 * lift})`;
  g.shadowBlur = 4 + 10 * lift;
  g.shadowOffsetY = 2 + 6 * lift;
  g.fillStyle = color;
  g.fill();
  g.restore();

  g.save();
  g.clip();
  g.strokeStyle = 'rgba(255, 253, 245, 0.42)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 5; i++) {
    const yy = lerp(-hh + 4, hh - 4, hash(seed * 7 + i * 5.1));
    g.beginPath();
    g.moveTo(-hw - 6, yy);
    g.quadraticCurveTo(0, yy + (hash(seed + i * 13) - 0.5) * 5, hw + 6, yy + (hash(seed + i * 17) - 0.5) * 3);
    g.stroke();
  }
  g.strokeStyle = 'rgba(40, 32, 18, 0.14)';
  g.lineWidth = 1;
  g.strokeRect(-hw - 6, -hh + 0.5, hw * 2 + 12, h - 1);
  g.restore();
  g.restore();
}

// Spun-brass pushpin mount with needle cast shadow and specular highlight.
function drawBrassPin(g, x, y, brassColor, progress = 1) {
  if (progress <= 0.001) return;
  const s = spring(clamp(progress), 0.48, 12);
  const drop = Math.max(0, 1 - s);
  g.save();
  g.translate(x, y);
  g.globalAlpha = clamp(progress * 4);

  // Needle & pinhead cast shadow on paper
  g.fillStyle = 'rgba(12, 10, 8, 0.28)';
  g.beginPath();
  g.ellipse(5 + drop * 8, 8 + drop * 10, 9.5, 6.5, 0.35, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(12, 10, 8, 0.34)';
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(0, 1);
  g.lineTo(5 + drop * 8, 8 + drop * 10);
  g.stroke();

  g.translate(0, -drop * 18);
  g.scale(0.65 + 0.35 * s, 0.65 + 0.35 * s);
  const r = 10.5;
  const grad = g.createRadialGradient(-3.5, -3.8, 1.2, 0, 0, r);
  grad.addColorStop(0, '#fff6d6');
  grad.addColorStop(0.38, brassColor);
  grad.addColorStop(0.82, '#8e6118');
  grad.addColorStop(1, '#4c320a');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.fill();

  g.strokeStyle = 'rgba(255, 248, 220, 0.55)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(0, 0, r - 2.6, 0, TAU);
  g.stroke();

  g.fillStyle = 'rgba(255, 255, 255, 0.75)';
  g.beginPath();
  g.arc(-3.2, -3.4, 2.1, 0, TAU);
  g.fill();
  g.restore();
}

// Distressed woodblock / rubber ink stamp cached once per label so every frame stays fast and crisp.
function buildStampSprite(text, subtext, color, noise, seed = 23) {
  const w = 310, h = 136;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.translate(w / 2, h / 2);

  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 5.5;
  g.strokeRect(-136, -48, 272, 96);
  g.lineWidth = 2;
  g.strokeRect(-127, -39, 254, 78);

  g.font = `900 34px ${LAT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let fontSize = 34;
  const measured = g.measureText(text).width;
  if (measured > 232) {
    fontSize = Math.max(18, Math.floor(34 * (232 / measured)));
    g.font = `900 ${fontSize}px ${LAT}`;
  }
  g.fillText(text, 0, subtext ? -8 : 1);

  if (subtext) {
    g.font = `700 12px ${MONO}`;
    g.fillText(subtext, 0, 23);
  }

  // Ink-starvation grain via destination-out Perlin blotches
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const aIdx = (y * w + x) * 4 + 3;
      if (d[aIdx] === 0) continue;
      const n = noise(x * 0.14 + seed, y * 0.14 + seed, 1.9);
      const streak = noise(x * 0.035, y * 0.32 + seed, 3.4);
      if (n > 0.34 || streak > 0.42) d[aIdx] = Math.round(d[aIdx] * 0.22);
      else d[aIdx] = Math.round(d[aIdx] * clamp(0.84 + n * 0.35, 0.45, 1));
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Saul Bass cut-paper tailor scissors + angular paper shard emblem.
function drawScissorsEmblem(g, pal, snipAngle = 0.28) {
  g.save();
  // Vermilion angular cut shard behind blades
  const shard = [[-68, -74], [58, -92], [82, -16], [12, 86], [-76, 48]];
  tracePoly(g, shard);
  g.fillStyle = pal.vermilion;
  g.fill();

  // Cream paper triangle slice separating on snip
  const sep = (0.34 - snipAngle) * 28;
  g.save();
  g.translate(16 + sep * 0.5, -34 - sep * 0.4);
  g.rotate(0.14 * (1 - snipAngle));
  tracePoly(g, [[-12, -48], [62, -42], [26, 22]]);
  g.fillStyle = pal.bone;
  g.fill();
  g.restore();

  // Scissors blades + finger rings in matte ink stock
  g.fillStyle = pal.ink;
  g.strokeStyle = pal.ink;
  for (const sgn of [-1, 1]) {
    g.save();
    g.rotate(sgn * snipAngle);
    // Blade polygon
    tracePoly(g, [[-8, -6], [96, -15 * sgn], [8, 9 * sgn], [-48, 8 * sgn]]);
    g.fill();
    // Handle stem & finger loop
    g.lineWidth = 8.5;
    g.beginPath();
    g.moveTo(-10, 0);
    g.lineTo(-56, sgn * 24);
    g.stroke();
    g.lineWidth = 7.5;
    g.beginPath();
    g.ellipse(-74, sgn * 34, 21, 15, sgn * 0.35, 0, TAU);
    g.stroke();
    g.restore();
  }
  // Brass pivot screw
  g.fillStyle = pal.brass;
  g.beginPath();
  g.arc(0, 0, 6.2, 0, TAU);
  g.fill();
  g.strokeStyle = pal.bone;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-3.5, -2);
  g.lineTo(3.5, 2);
  g.stroke();
  g.restore();
}

function splitHeadlineTokens(headline) {
  const clean = String(headline || 'CUT & PASTE').trim() || 'CUT & PASTE';
  if (clean.includes('&')) {
    const idx = clean.indexOf('&');
    const left = clean.slice(0, idx).trim();
    const right = clean.slice(idx + 1).trim();
    if (left && right) return [left, '&', right];
  }
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 3) return [words[0], words[1], words.slice(2).join(' ')];
  if (words.length === 2) return [words[0], '·', words[1]];
  const chars = Array.from(clean);
  if (chars.length >= 4 && chars.length <= 8 && /[^\x00-\x7f]/.test(clean)) {
    const mid = Math.ceil(chars.length / 2);
    return [chars.slice(0, mid).join(''), '×', chars.slice(mid).join('')];
  }
  return [clean];
}

function fitFont(g, text, maxW, maxPx, weight = 900, family = LAT) {
  let px = maxPx;
  g.font = `${weight} ${px}px ${family}`;
  const w = g.measureText(text).width;
  if (w > maxW && w > 0) {
    px = Math.max(20, Math.floor(maxPx * (maxW / w)));
    g.font = `${weight} ${px}px ${family}`;
  }
  return { px, width: g.measureText(text).width };
}

// Procedural tonal field for the halftone photo frame: an architectural observatory & skyline under sweeping sunbeams.
function sampleObservatoryTone(u, v, beamPhase, noise) {
  // u in [0,1] left-to-right, v in [0,1] top-to-bottom; returns 0 (deepest ink) .. 1 (brightest highlight).
  let lum = lerp(0.18, 0.84, Math.pow(clamp(1 - v * 0.95), 0.82));

  // Sweeping volumetric sunbeam from upper-left window/sky
  const srcX = 0.20 + 0.08 * Math.sin(beamPhase), srcY = -0.08;
  const dx = u - srcX, dy = v - srcY;
  const ang = Math.atan2(dy, dx);
  const beamCenter = 0.92 + 0.16 * Math.sin(beamPhase);
  const beam = Math.exp(-Math.pow((ang - beamCenter) / 0.22, 2)) * clamp(1.15 - Math.hypot(dx, dy) * 0.55);
  const rays = (0.5 + 0.5 * Math.sin(ang * 26 - beamPhase * 2)) * Math.exp(-Math.pow((ang - beamCenter) / 0.34, 2));
  lum += beam * 0.42 + rays * 0.14;

  // Soft chiaroscuro clouds
  const cloud = noise(u * 3.8 + 1.2, v * 2.6 + 0.4, 0.7);
  if (v < 0.62) lum += cloud * 0.16 * (1 - v / 0.62);

  // Distant modernist stepped skyline towers
  const towers = [
    [0.04, 0.15, 0.54], [0.16, 0.26, 0.46], [0.72, 0.83, 0.44], [0.84, 0.96, 0.52],
  ];
  for (const [x0, x1, topY] of towers) {
    if (u >= x0 && u <= x1 && v >= topY) {
      const litEdge = u < x0 + 0.022 ? 0.68 : 0.24;
      const win = (Math.floor((u - x0) * 110) % 3 === 0 && Math.floor((v - topY) * 75) % 3 === 1) ? 0.22 : 0;
      lum = litEdge + win;
    }
  }

  // Foreground hill ridge
  const ridgeY = 0.73 + 0.045 * Math.sin(u * 5.2 + 0.6) - 0.03 * Math.cos(u * 9.1);
  if (v >= ridgeY) {
    lum = 0.08 + 0.08 * clamp((u - 0.15) * 0.7) * Math.exp(-(v - ridgeY) * 9);
  }

  // Central iconic observatory dome + slit + radio mast (lit dramatically from upper-left)
  const cx = 0.48, cy = 0.72, rx = 0.23, ry = 0.31;
  const ex = (u - cx) / rx, ey = (v - cy) / ry;
  if (ey <= 0 && ex * ex + ey * ey <= 1) {
    const nz = Math.sqrt(Math.max(0, 1 - ex * ex - ey * ey));
    const ndotl = clamp(-ex * 0.68 - ey * 0.52 + nz * 0.52, 0, 1);
    lum = 0.10 + 0.82 * Math.pow(ndotl, 1.15);
    // Observatory shutter slit
    if (Math.abs(ex - 0.10) < 0.085 && ey < -0.18) lum = 0.06;
    // Meridional rib lines
    if (Math.abs(Math.abs(ex) - 0.52) < 0.02) lum *= 0.62;
  }
  // Cylindrical base drum under the dome
  if (Math.abs(u - cx) <= rx * 1.04 && v >= cy - 0.01 && v <= ridgeY + 0.06) {
    const shade = clamp(0.5 - (u - cx) / (rx * 1.35), 0, 1);
    lum = 0.10 + 0.66 * shade;
    if (Math.abs(v - (cy + 0.02)) < 0.012) lum = 0.85;
    // Arched colonnade niches
    const archX = ((u - (cx - rx)) / (rx * 2 / 6)) % 1;
    if (v > cy + 0.045 && archX > 0.24 && archX < 0.76) lum = 0.07;
  }
  // Telescope barrel emerging from dome slit toward upper-left sky
  {
    const ax = cx + 0.02, ay = cy - 0.18, bx = cx - 0.16, by = cy - 0.40;
    const abx = bx - ax, aby = by - ay, tProj = clamp(((u - ax) * abx + (v - ay) * aby) / (abx * abx + aby * aby));
    const dist = Math.hypot(u - (ax + abx * tProj), v - (ay + aby * tProj));
    if (dist < 0.021) lum = dist < 0.009 ? 0.76 : 0.12;
  }

  return clamp(lum, 0.02, 0.98);
}

function drawHalftoneWindow(g, w, h, pal, beamPhase, regOffset, noise) {
  const hw = w / 2, hh = h / 2;
  g.save();
  g.beginPath();
  g.rect(-hw, -hh, w, h);
  g.clip();

  // Warm newsprint stock base
  g.fillStyle = pal.cream;
  g.fillRect(-hw, -hh, w, h);

  // Subtle warm sepia paper wash in midtones
  const wash = g.createLinearGradient(-hw, -hh, hw, hh);
  wash.addColorStop(0, 'rgba(255, 249, 234, 0.45)');
  wash.addColorStop(1, 'rgba(205, 180, 136, 0.28)');
  g.fillStyle = wash;
  g.fillRect(-hw, -hh, w, h);

  const renderScreen = (angleDeg, step, color, gamma, threshold, ox, oy) => {
    const rad = angleDeg * Math.PI / 180;
    const ca = Math.cos(rad), sa = Math.sin(rad);
    const diag = Math.hypot(hw, hh) + step * 2;
    g.fillStyle = color;
    g.beginPath();
    for (let sy = -diag; sy <= diag; sy += step) {
      for (let sx = -diag; sx <= diag; sx += step) {
        const px = sx * ca - sy * sa + ox;
        const py = sx * sa + sy * ca + oy;
        if (px < -hw - step || px > hw + step || py < -hh - step || py > hh + step) continue;
        const u = clamp((px + hw) / w), v = clamp((py + hh) / h);
        const lum = sampleObservatoryTone(u, v, beamPhase, noise);
        const darkness = clamp((threshold - lum) / threshold, 0, 1);
        if (darkness <= 0.02) continue;
        const r = step * 0.58 * Math.pow(darkness, gamma);
        if (r < 0.35) continue;
        g.moveTo(px + r, py);
        g.arc(px, py, r, 0, TAU);
      }
    }
    g.fill();
  };

  // Screen 1: Prussian Cobalt shadow/midtone plate at 45 deg
  renderScreen(45, 7.6, rgba(pal.cobalt, 0.86), 0.78, 0.94, -regOffset * 10, regOffset * 6);
  // Screen 2: Warm Press Ink key plate at 15 deg
  renderScreen(15, 7.6, rgba(pal.ink, 0.90), 0.92, 0.64, regOffset * 8, -regOffset * 5);

  // Inner press plate frame rule
  g.strokeStyle = rgba(pal.ink, 0.32);
  g.lineWidth = 1.5;
  g.strokeRect(-hw + 1, -hh + 1, w - 2, h - 2);
  g.restore();
}

export function createPaperCollage(options = {}) {
  const W = Math.max(160, Math.round(options.width || 1280));
  const H = Math.max(90, Math.round(options.height || 720));
  const mode = options.mode === 'halftone' ? 'halftone' : 'editorial';
  const period = Number.isFinite(options.period) && options.period > 0 ? options.period : PERIODS[mode];
  const seed = (options.seed ?? (mode === 'halftone' ? 29 : 17)) | 0;
  const basePal = PALETTES[typeof options.palette === 'string' ? options.palette : (mode === 'halftone' ? 'newsprint' : 'bass')] || PALETTES.bass;
  const pal = typeof options.palette === 'object' && options.palette ? { ...basePal, ...options.palette } : { ...basePal };

  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const noise = perlin3(seed);
  const grainTile = makeGrainTile(seed + 5);
  const grainPattern = ctx.createPattern(grainTile, 'repeat');

  const stocks = {
    cream: makeStockPattern(ctx, pal.cream, noise, 1.1, { contrast: 0.085, specks: 95 }),
    bone: makeStockPattern(ctx, pal.bone, noise, 3.7, { contrast: 0.045, specks: 45 }),
    kraft: makeStockPattern(ctx, pal.kraft, noise, 7.3, { contrast: 0.11, specks: 120 }),
    kraftSoft: makeStockPattern(ctx, pal.kraftSoft, noise, 11.9, { contrast: 0.095, specks: 110 }),
    vermilion: makeStockPattern(ctx, pal.vermilion, noise, 15.5, { contrast: 0.09, specks: 70 }),
    cobalt: makeStockPattern(ctx, pal.cobalt, noise, 21.3, { contrast: 0.09, specks: 70 }),
    ink: makeStockPattern(ctx, pal.ink, noise, 27.1, { contrast: 0.12, specks: 60 }),
  };

  // Pre-computed scissored polygon shapes in design coordinates (1280 x 720 space)
  const shapes = {
    kraftBack: cutPolygonPoints(920, 496, { seed: seed + 2, jitter: 7.5, segs: 5 }),
    cobaltBlock: cutPolygonPoints(386, 434, { seed: seed + 5, jitter: 6.5, segs: 4 }),
    vermilionWedge: [[-205, -188], [218, -206], [192, 198], [-174, 172]],
    kickerStrip: cutPolygonPoints(356, 38, { seed: seed + 11, jitter: 2.6, segs: 3 }),
    sideSpec: cutPolygonPoints(226, 150, { seed: seed + 17, jitter: 4.2, segs: 4 }),
    photoMount: cutPolygonPoints(644, 486, { seed: seed + 31, jitter: 5.2, segs: 5 }),
    loupeCard: cutPolygonPoints(308, 344, { seed: seed + 37, jitter: 4.8, segs: 4 }),
    tabLabel: cutPolygonPoints(284, 38, { seed: seed + 41, jitter: 2.2, segs: 3 }),
  };

  const stampCache = new Map();
  const getStamp = (main, sub) => {
    const key = `${main}|${sub}`;
    if (!stampCache.has(key)) {
      stampCache.set(key, buildStampSprite(main, sub, pal.vermilion, noise, seed + 23));
    }
    return stampCache.get(key);
  };

  let lastProof = {};

  function resolveCopy(overrides = {}) {
    const stageText = options.stage?.dataset?.customText || globalThis.FX_CUSTOM_TEXT || '';
    const rawHead = overrides.text ?? overrides.headline ?? (stageText.trim() || options.customText || options.headline);
    if (mode === 'halftone') {
      return {
        headline: rawHead ? String(rawHead).trim() : 'PRESS PROOF',
        subhead: overrides.subhead ?? options.subhead ?? '65 LPI DUOTONE HALFTONE · ROTARY EDITION',
        stamp: overrides.stamp ?? options.stamp ?? 'PRESS PROOF',
        stampSub: 'VERIFIED INK PLATE · NO. 24',
      };
    }
    return {
      headline: rawHead ? String(rawHead).trim() : 'CUT & PASTE',
      subhead: overrides.subhead ?? options.subhead ?? 'SCISSORED STOCK · TORN FIBRE · MASKING TAPE',
      stamp: overrides.stamp ?? options.stamp ?? 'STUDIO CUT',
      stampSub: 'HAND-MOUNTED EDITION · 04',
    };
  }

  // Deterministic zdoc camera: smooth loop-periodic drift + push-in + impact shakes.
  function computeCamera(t, impacts) {
    const u = t / period;
    const push = Math.pow(Math.sin(Math.PI * clamp((u - 0.06) / 0.86)), 1.35);
    let x = 22 * Math.sin(TAU * u - 0.5);
    let y = 11 * Math.cos(TAU * u);
    let z = 1.0 + (mode === 'editorial' ? 0.068 : 0.058) * push;
    let rot = (mode === 'editorial' ? 0.85 : 0.65) * Math.sin(TAU * u + 0.4);

    for (const [at, amp] of impacts) {
      const dt = t - at;
      if (dt >= 0 && dt < 0.46) {
        const decay = Math.exp(-dt * 13) * amp;
        x += Math.sin(dt * TAU * 17) * decay;
        y += Math.cos(dt * TAU * 13) * decay * 0.72;
        rot += Math.sin(dt * TAU * 11) * decay * 0.032;
      }
    }
    return { x, y, z, rot };
  }

  function applyPlaneTransform(cam, factor) {
    const sx = W / 1280, sy = H / 720, s = Math.min(sx, sy);
    const scale = 1 + (cam.z - 1) * factor;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(W / 2 - cam.x * factor * s, H / 2 - cam.y * factor * s);
    ctx.rotate((cam.rot * factor * Math.PI) / 180);
    ctx.scale(s * scale, s * scale);
  }

  function drawMatBackground(cam, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = pal.mat;
    ctx.fillRect(0, 0, W, H);

    applyPlaneTransform(cam, 0.22);

    // Overhead studio drafting lamp glow
    const lampX = 60 * Math.sin((TAU * t) / period), lampY = -50;
    const glow = ctx.createRadialGradient(lampX, lampY, 30, lampX, lampY, 760);
    glow.addColorStop(0, rgba(pal.glow, 0.20));
    glow.addColorStop(0.55, rgba(pal.glow, 0.05));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-900, -600, 1800, 1200);

    // Calibrated studio cutting-mat grid + registration marks
    ctx.strokeStyle = pal.matGrid;
    ctx.lineWidth = 1;
    for (let x = -720; x <= 720; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, -460); ctx.lineTo(x, 460); ctx.stroke();
    }
    for (let y = -420; y <= 420; y += 60) {
      ctx.beginPath(); ctx.moveTo(-760, y); ctx.lineTo(760, y); ctx.stroke();
    }
    ctx.strokeStyle = rgba(pal.cream, 0.16);
    ctx.lineWidth = 1.4;
    for (const [cx, cy] of [[-560, -295], [560, -295], [-560, 295], [560, 295]]) {
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy); ctx.lineTo(cx + 14, cy);
      ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy + 14);
      ctx.stroke();
    }

    // Background cut-paper silhouette shapes drifting gently at 0.22x parallax
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.translate(-470 + 14 * Math.sin((TAU * t) / period), -190);
    ctx.rotate(-0.18);
    ctx.fillStyle = stocks.cobalt;
    ctx.fillRect(-160, -140, 320, 280);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.translate(490 - 12 * Math.cos((TAU * t) / period), 185);
    ctx.rotate(0.14);
    ctx.fillStyle = stocks.vermilion;
    ctx.fillRect(-170, -120, 340, 240);
    ctx.restore();
  }

  function drawForegroundScraps(cam, t, exit) {
    applyPlaneTransform(cam, 1.7);
    const u = t / period;
    const scraps = [
      [-555, -265, 58, 22, -26, stocks.vermilion],
      [565, -250, 48, 20, 21, stocks.kraft],
      [-540, 268, 64, 24, 15, stocks.cobalt],
      [552, 265, 54, 18, -19, stocks.cream],
    ];
    for (let i = 0; i < scraps.length; i++) {
      const [bx, by, sw, sh, rot, fill] = scraps[i];
      const enter = sprAt(t, 0.18 + i * 0.08, 0.55, 0.55, 8.5);
      const vis = clamp(enter) * (1 - exit * 0.85);
      if (vis <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha = 0.88 * vis;
      ctx.translate(
        bx + Math.sin(TAU * u + i * 1.7) * 14 + (1 - enter) * (bx < 0 ? -90 : 90),
        by + Math.cos(TAU * u + i * 2.3) * 10,
      );
      ctx.rotate(((rot + 6 * Math.sin(TAU * u + i)) * Math.PI) / 180);
      ctx.shadowColor = 'rgba(0,0,0,0.34)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(-sw / 2, -sh / 2);
      ctx.lineTo(sw / 2, -sh * 0.36);
      ctx.lineTo(sw * 0.42, sh / 2);
      ctx.lineTo(-sw * 0.46, sh * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function finishOverlay(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Stepped 12 fps archival grain + gentle edge vignette
    const step = Math.floor(t * 12);
    const gx = (step * 73) % 192, gy = (step * 41) % 192;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.fillStyle = grainPattern;
    ctx.fillRect(-gx, -gy, W, H);
    ctx.restore();

    const vg = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.30, W / 2, H * 0.5, H * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(8,7,6,0.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function renderEditorial(t, copy) {
    const impacts = [[0.72, 7], [1.28, 6], [1.48, 5], [2.05, 11]];
    const cam = computeCamera(t, impacts);
    const exit = inCubic(lin(period - 0.72, period - 0.04, t));

    drawMatBackground(cam, t);
    applyPlaneTransform(cam, 1.0);

    // 1. Kraft backing card (angled editorial base)
    {
      const k = sprAt(t, 0.02, 0.58, 0.56, 8.8);
      const lift = clamp(1 - k) + exit * 0.8;
      ctx.save();
      ctx.translate(-12 + (1 - k) * -140 - exit * 120, 8 + (1 - k) * 45 + exit * 35);
      ctx.rotate((-3.1 + (1 - k) * -5 - exit * 4) * Math.PI / 180);
      ctx.globalAlpha = clamp(0.32 + 0.68 * k) * (1 - exit * 0.75);
      drawScissoredSheet(ctx, shapes.kraftBack, stocks.kraft, { lift: 0.4 + lift });
      // Subtle editorial crop lines on kraft sheet
      ctx.strokeStyle = rgba(pal.ink, 0.18);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-432, -222, 864, 444);
      ctx.restore();
    }

    // 2. Cobalt left counter-block & Vermilion right cut-paper wedge
    {
      const kc = sprAt(t, 0.14, 0.56, 0.52, 9.2);
      ctx.save();
      ctx.translate(-258 + (1 - kc) * -220 - exit * 190, -14 + (1 - kc) * -30);
      ctx.rotate((2.6 + (1 - kc) * 7) * Math.PI / 180);
      ctx.globalAlpha = clamp(t / 0.14) * (1 - exit * 0.9);
      drawScissoredSheet(ctx, shapes.cobaltBlock, stocks.cobalt, { lift: 0.55 + (1 - kc) });
      ctx.restore();

      const kv = sprAt(t, 0.22, 0.56, 0.52, 9.2);
      ctx.save();
      ctx.translate(256 + (1 - kv) * 230 + exit * 190, 22 + (1 - kv) * 40);
      ctx.rotate((-4.2 + (1 - kv) * -8) * Math.PI / 180);
      ctx.globalAlpha = clamp((t - 0.06) / 0.14) * (1 - exit * 0.9);
      drawScissoredSheet(ctx, shapes.vermilionWedge, stocks.vermilion, { lift: 0.55 + (1 - kv) });
      ctx.restore();
    }

    // 3. Main Cream Cotton Rag torn-edge spread
    const tapeFlatten = smooth(lin(1.25, 1.9, t));
    {
      const km = sprAt(t, 0.28, 0.6, 0.54, 9.0);
      const sheetLift = clamp(0.85 - 0.55 * tapeFlatten + (1 - km), 0.2, 1.8);
      ctx.save();
      ctx.translate(4, -2 + (1 - km) * 95 + exit * -85);
      ctx.rotate((-1.25 + (1 - km) * 3.5) * Math.PI / 180);
      ctx.globalAlpha = clamp((t - 0.12) / 0.16) * (1 - exit * 0.92);
      drawTornSheet(ctx, 796, 408, stocks.cream, pal.bone, noise, seed + 9, { lift: sheetLift, deckle: 7 });

      // Top editorial kicker cut-out strip
      const kk = sprAt(t, 0.48, 0.46, 0.55, 10);
      ctx.save();
      ctx.translate(-172 + (1 - kk) * -70, -148);
      ctx.rotate(-0.8 * Math.PI / 180);
      ctx.globalAlpha *= clamp((t - 0.44) / 0.12);
      drawScissoredSheet(ctx, shapes.kickerStrip, stocks.ink, { lift: 0.25 });
      ctx.fillStyle = pal.cream;
      ctx.font = `700 13.5px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ISSUE 04 · ANALOGUE CUT-PAPER', 0, 1);
      ctx.restore();

      // Left Saul Bass Scissored Emblem (snips closed at t = 0.72s!)
      const ke = sprAt(t, 0.44, 0.52, 0.5, 9.5);
      const snip = 0.36 - 0.25 * smooth(lin(0.56, 0.76, t)) + 0.05 * Math.sin(t * 2.6);
      ctx.save();
      ctx.translate(-272, 14);
      ctx.scale(0.82 + 0.18 * ke, 0.82 + 0.18 * ke);
      ctx.rotate((-8 + (1 - ke) * -18) * Math.PI / 180);
      ctx.globalAlpha *= clamp((t - 0.40) / 0.14);
      drawScissorsEmblem(ctx, pal, snip);
      ctx.restore();

      //Bold Cut-Paper Headline Plates ("CUT" + "&" + "PASTE" or custom text)
      const tokens = splitHeadlineTokens(copy.headline);
      if (tokens.length === 3) {
        const [w1, mid, w2] = tokens;
        // Word 1 plate (Cream/Kraft ransom cut or heavy ink display)
        const k1 = sprAt(t, 0.56, 0.48, 0.5, 10.2);
        ctx.save();
        ctx.translate(-24 + (1 - k1) * 70, -48 + (1 - k1) * -35);
        ctx.rotate(-1.6 * Math.PI / 180);
        ctx.scale(0.75 + 0.25 * k1, 0.75 + 0.25 * k1);
        ctx.globalAlpha *= clamp((t - 0.54) / 0.10);
        const f1 = fitFont(ctx, w1, 310, 92, 900, LAT);
        const pw1 = Math.max(150, f1.width + 44);
        drawScissoredSheet(ctx, cutPolygonPoints(pw1, 98, { seed: seed + 51, jitter: 4.2, segs: 4 }), stocks.ink, { lift: 0.35 });
        ctx.fillStyle = pal.bone;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(w1, 0, 3);
        ctx.restore();

        // Connector badge ("&")
        const k2 = sprAt(t, 0.68, 0.46, 0.46, 11);
        ctx.save();
        ctx.translate(178, -42);
        ctx.rotate((7.5 + (1 - k2) * 18) * Math.PI / 180);
        ctx.scale(0.5 + 0.5 * k2, 0.5 + 0.5 * k2);
        ctx.globalAlpha *= clamp((t - 0.66) / 0.09);
        drawScissoredSheet(ctx, cutPolygonPoints(78, 80, { seed: seed + 57, jitter: 3.5, segs: 3 }), stocks.vermilion, { lift: 0.42 });
        ctx.fillStyle = pal.bone;
        ctx.font = `italic 400 56px ${SERIF}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(mid, 0, 3);
        ctx.restore();

        // Word 2 plate (Vermilion/Cobalt high-impact cut strip)
        const k3 = sprAt(t, 0.76, 0.50, 0.5, 10.2);
        ctx.save();
        ctx.translate(62 + (1 - k3) * 95, 56 + (1 - k3) * 35);
        ctx.rotate(1.4 * Math.PI / 180);
        ctx.scale(0.76 + 0.24 * k3, 0.76 + 0.24 * k3);
        ctx.globalAlpha *= clamp((t - 0.73) / 0.10);
        const f2 = fitFont(ctx, w2, 410, 92, 900, LAT);
        const pw2 = Math.max(210, f2.width + 52);
        drawScissoredSheet(ctx, cutPolygonPoints(pw2, 98, { seed: seed + 63, jitter: 4.4, segs: 4 }), stocks.cobalt, { lift: 0.38 });
        ctx.fillStyle = pal.bone;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(w2, 0, 3);
        ctx.restore();
      } else {
        const k1 = sprAt(t, 0.58, 0.52, 0.5, 10);
        ctx.save();
        ctx.translate(58, 2 + (1 - k1) * 45);
        ctx.rotate(-1.2 * Math.PI / 180);
        ctx.scale(0.76 + 0.24 * k1, 0.76 + 0.24 * k1);
        ctx.globalAlpha *= clamp((t - 0.55) / 0.12);
        const f1 = fitFont(ctx, tokens[0], 460, 96, 900, LAT);
        const pw = Math.max(240, f1.width + 58);
        drawScissoredSheet(ctx, cutPolygonPoints(pw, 124, { seed: seed + 51, jitter: 4.5, segs: 4 }), stocks.ink, { lift: 0.38 });
        ctx.fillStyle = pal.bone;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tokens[0], 0, 4);
        ctx.restore();
      }

      // Red registration rule + subhead along bottom of cream spread
      const ruleK = outCubic(lin(0.92, 1.38, t));
      ctx.fillStyle = pal.vermilion;
      ctx.fillRect(-344, 128, 688 * ruleK, 4.5);

      const subAlpha = lin(1.04, 1.36, t);
      ctx.save();
      ctx.globalAlpha *= subAlpha;
      ctx.fillStyle = pal.ink;
      fitFont(ctx, copy.subhead, 520, 15.5, 700, MONO);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(copy.subhead, -344, 156);
      ctx.fillStyle = pal.inkSoft;
      ctx.font = `700 13px ${MONO}`;
      ctx.textAlign = 'right';
      ctx.fillText('FIG. 01 / ZDOC', 344, 156);
      ctx.restore();

      ctx.restore();
    }

    // 4. Side specimen index card + brass pin + red registration thread
    {
      const ks = sprAt(t, 0.96, 0.52, 0.52, 9.5);
      if (ks > 0.001) {
        ctx.save();
        ctx.translate(432 + (1 - ks) * 110 + exit * 120, -172 + (1 - ks) * -40);
        ctx.rotate((5.5 + (1 - ks) * 8) * Math.PI / 180);
        ctx.globalAlpha = clamp((t - 0.94) / 0.14) * (1 - exit * 0.92);
        drawScissoredSheet(ctx, shapes.sideSpec, stocks.kraftSoft, { lift: 0.45 });
        ctx.fillStyle = pal.ink;
        ctx.font = `700 11.5px ${MONO}`;
        ctx.textAlign = 'left';
        ctx.fillText('STOCK SPECIMEN', -94, -46);
        ctx.fillStyle = pal.vermilion;
        ctx.fillRect(-94, -32, 38, 22);
        ctx.fillStyle = pal.cobalt;
        ctx.fillRect(-50, -32, 38, 22);
        ctx.fillStyle = pal.kraft;
        ctx.fillRect(-6, -32, 38, 22);
        ctx.fillStyle = pal.ink;
        ctx.fillRect(38, -32, 38, 22);
        ctx.font = `800 22px ${LAT}`;
        ctx.fillText('320 GSM', -94, 18);
        ctx.font = `500 12px ${MONO}`;
        ctx.fillStyle = pal.inkSoft;
        ctx.fillText('COTTON RAG + KRAFT', -94, 42);
        drawBrassPin(ctx, 0, -64, pal.brass, lin(1.12, 1.48, t));
        ctx.restore();
      }
    }

    // 5. Four translucent masking tape strips slapping down on beat!
    const tapes = [
      { x: -376, y: -196, w: 132, h: 34, rot: -26, at: 1.24, seed: 11 },
      { x: 378, y: -182, w: 124, h: 32, rot: 22, at: 1.42, seed: 17 },
      { x: -368, y: 196, w: 128, h: 33, rot: 19, at: 1.60, seed: 23 },
      { x: 356, y: 198, w: 136, h: 34, rot: -21, at: 1.78, seed: 29 },
    ];
    for (const tp of tapes) {
      const prog = lin(tp.at, tp.at + 0.34, t) * (1 - exit);
      drawMaskingTape(ctx, { ...tp, progress: prog, color: pal.tape });
    }

    // Brass pin on upper-left kicker corner
    drawBrassPin(ctx, -334, -152, pal.brass, lin(1.18, 1.52, t) * (1 - exit));

    // 6. Distressed red ink rubber stamp slamming at t = 2.05s
    const stampIn = lin(2.02, 2.26, t);
    if (stampIn > 0.001) {
      const sp = spring(stampIn, 0.44, 12);
      const scale = (1.55 - 0.55 * sp) * (1 - exit * 0.15);
      const sprite = getStamp(copy.stamp, copy.stampSub);
      ctx.save();
      ctx.translate(-258, 134);
      ctx.rotate((-9.5 + (1 - sp) * 6) * Math.PI / 180);
      ctx.scale(scale, scale);
      ctx.globalAlpha = clamp(stampIn * 4) * 0.92 * (1 - exit);
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      ctx.restore();
    }

    drawForegroundScraps(cam, t, exit);
    finishOverlay(t);

    lastProof = { mode, time: t, headline: copy.headline, camera: cam, taped: tapeFlatten > 0.9 };
  }

  function renderHalftone(t, copy) {
    const impacts = [[1.15, 5], [1.62, 12]];
    const cam = computeCamera(t, impacts);
    const exit = inCubic(lin(period - 0.68, period - 0.04, t));
    const beamPhase = (TAU * t) / period;
    const regOffset = Math.max(0, 1 - outCubic(lin(0.22, 0.95, t)));

    drawMatBackground(cam, t);
    applyPlaneTransform(cam, 1.0);

    // Backing kraft folder sheet behind the archival print
    {
      const kb = sprAt(t, 0.02, 0.55, 0.56, 8.8);
      ctx.save();
      ctx.translate(-115 + (1 - kb) * -120 - exit * 120, 14);
      ctx.rotate((-4.2 + (1 - kb) * -4) * Math.PI / 180);
      ctx.globalAlpha = clamp(0.35 + 0.65 * kb) * (1 - exit * 0.8);
      drawScissoredSheet(ctx, cutPolygonPoints(676, 502, { seed: seed + 33, jitter: 6.5, segs: 5 }), stocks.kraftSoft, { lift: 0.45 });
      ctx.restore();
    }

    // 1. Main Duotone Newsprint Photo Frame (left-center hero)
    {
      const kp = sprAt(t, 0.10, 0.58, 0.54, 9.0);
      ctx.save();
      ctx.translate(-122 + (1 - kp) * -90 - exit * 100, 4 + (1 - kp) * 50);
      ctx.rotate((-1.8 + (1 - kp) * 4) * Math.PI / 180);
      ctx.globalAlpha = clamp(t / 0.14) * (1 - exit * 0.92);

      // Outer scissored Polaroid/newsprint card
      drawScissoredSheet(ctx, shapes.photoMount, stocks.cream, { lift: 0.65 });

      // Header metadata above halftone window
      ctx.fillStyle = pal.inkSoft;
      ctx.font = `700 12px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.fillText('PLATE IV · ARCHIVAL DUOTONE PRINT', -292, -214);
      ctx.textAlign = 'right';
      ctx.fillText('65 LPI · 45° / 15°', 292, -214);

      // Halftone window (584 x 362) centered at y = -16
      ctx.save();
      ctx.translate(0, -16);
      drawHalftoneWindow(ctx, 584, 362, pal, beamPhase, regOffset, noise);

      // Diagonal Torn Paper Edge Reveal! Kraft cover sheet tears diagonally from left to right (0.20s -> 1.32s)
      const tear = inOut(lin(0.18, 1.32, t));
      const tearX = lerp(-340, 265, tear);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-292, -181, 584, 362);
      ctx.clip();

      // White cotton deckle core along the diagonal tear line + kraft cover remnant on the right/corner
      const buildCover = (shift) => {
        ctx.beginPath();
        ctx.moveTo(310, -195);
        ctx.lineTo(310, 195);
        ctx.lineTo(tearX + 145 + shift, 195);
        for (let i = 28; i >= 0; i--) {
          const u = i / 28;
          const py = lerp(-195, 195, u);
          const px = lerp(tearX + 35, tearX + 145, u) + shift
            + noise(u * 8.5 + seed, 1.3, 0.5) * 14
            + noise(u * 24 + seed, 3.1, 0.9) * 5.5;
          ctx.lineTo(px, py);
        }
        ctx.closePath();
      };

      ctx.shadowColor = 'rgba(0,0,0,0.32)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetX = -5;
      ctx.shadowOffsetY = 5;
      buildCover(-7);
      ctx.fillStyle = pal.bone;
      ctx.fill();

      ctx.shadowColor = 'transparent';
      buildCover(0);
      ctx.fillStyle = stocks.kraft;
      ctx.fill();
      ctx.restore();
      ctx.restore();

      // Red editorial caption tab + headline along bottom margin of photo card
      ctx.save();
      ctx.translate(-148, 196);
      ctx.rotate(-1.2 * Math.PI / 180);
      drawScissoredSheet(ctx, shapes.tabLabel, stocks.vermilion, { lift: 0.2 });
      ctx.fillStyle = pal.bone;
      fitFont(ctx, copy.headline, 256, 20, 900, LAT);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(copy.headline, 0, 1);
      ctx.restore();

      ctx.fillStyle = pal.inkSoft;
      ctx.font = `600 12.5px ${MONO}`;
      ctx.textAlign = 'right';
      ctx.fillText('NEG. 1962-B · COBALT / INK', 292, 201);

      // Masking tape on lower-left corner + Brass pin mount at top center!
      drawMaskingTape(ctx, { x: -286, y: 212, w: 118, h: 30, rot: 24, progress: lin(0.75, 1.08, t), color: pal.tape, seed: 41 });
      drawBrassPin(ctx, 0, -228, pal.brass, lin(1.08, 1.42, t));

      // Stamped Red Ink Seal slamming onto bottom-right of print at t = 1.62s!
      const stampIn = lin(1.58, 1.84, t);
      if (stampIn > 0.001) {
        const sp = spring(stampIn, 0.42, 12.5);
        const scale = 1.6 - 0.6 * sp;
        const sprite = getStamp(copy.stamp, copy.stampSub);
        ctx.save();
        ctx.translate(152, 128);
        ctx.rotate((-11 + (1 - sp) * 8) * Math.PI / 180);
        ctx.scale(scale, scale);
        ctx.globalAlpha = clamp(stampIn * 4) * 0.94;
        ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
        ctx.restore();
      }

      ctx.restore();
    }

    // 2. Right-side 8x Halftone Rosette Loupe Card + Leader Line
    {
      const kl = sprAt(t, 0.46, 0.56, 0.52, 9.2);
      ctx.save();
      ctx.translate(382 + (1 - kl) * 140 + exit * 130, -12 + (1 - kl) * 35);
      ctx.rotate((2.8 + (1 - kl) * 6) * Math.PI / 180);
      ctx.globalAlpha = clamp((t - 0.42) / 0.16) * (1 - exit * 0.92);

      drawScissoredSheet(ctx, shapes.loupeCard, stocks.bone, { lift: 0.55 });
      ctx.fillStyle = pal.ink;
      ctx.font = `700 11.5px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText('8× SCREEN MAGNIFIER', 0, -142);

      // Circular magnified halftone rosette loupe
      const lr = 104, ly = -16;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, ly, lr, 0, TAU);
      ctx.clip();
      ctx.fillStyle = pal.cream;
      ctx.fillRect(-lr, ly - lr, lr * 2, lr * 2);

      const drawLoupeDots = (deg, col, thr, gam) => {
        const rad = deg * Math.PI / 180, ca = Math.cos(rad), sa = Math.sin(rad), st = 24;
        ctx.fillStyle = col;
        for (let sy = -140; sy <= 140; sy += st) {
          for (let sx = -140; sx <= 140; sx += st) {
            const px = sx * ca - sy * sa, py = sx * sa + sy * ca;
            const u = clamp(0.38 + px / 900), v = clamp(0.44 + py / 900);
            const lum = sampleObservatoryTone(u, v, beamPhase, noise);
            const dk = clamp((thr - lum) / thr, 0, 1);
            const r = st * 0.56 * Math.pow(dk, gam);
            if (r > 0.6) {
              ctx.beginPath();
              ctx.arc(px, ly + py, r, 0, TAU);
              ctx.fill();
            }
          }
        }
      };
      drawLoupeDots(45, rgba(pal.cobalt, 0.85), 0.95, 0.78);
      drawLoupeDots(15, rgba(pal.ink, 0.88), 0.68, 0.9);
      ctx.restore();

      // Brass-rimmed loupe bezel
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, ly, lr, 0, TAU); ctx.stroke();
      ctx.strokeStyle = pal.brass;
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(0, ly, lr - 4, 0, TAU); ctx.stroke();

      ctx.fillStyle = pal.ink;
      ctx.font = `800 18px ${LAT}`;
      ctx.fillText('DUOTONE ROSETTE', 0, 118);
      ctx.fillStyle = pal.inkSoft;
      ctx.font = `500 11.5px ${MONO}`;
      ctx.fillText('COBALT 45° + INK 15°', 0, 140);

      drawMaskingTape(ctx, { x: 88, y: -158, w: 104, h: 28, rot: 18, progress: lin(0.92, 1.25, t), color: pal.tape, seed: 53 });
      ctx.restore();

      // Vermilion callout leader line linking Dome slit on print to the 8x Loupe
      const lead = outCubic(lin(0.82, 1.28, t)) * (1 - exit);
      if (lead > 0.01) {
        const ax = -128, ay = -68, bx = lerp(ax, 258, lead), by = lerp(ay, -28, lead);
        ctx.save();
        ctx.strokeStyle = pal.vermilion;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.fillStyle = pal.bone;
        ctx.beginPath(); ctx.arc(ax, ay, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = pal.vermilion;
        ctx.beginPath(); ctx.arc(ax, ay, 3.5, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }

    drawForegroundScraps(cam, t, exit);
    finishOverlay(t);

    lastProof = { mode, time: t, headline: copy.headline, camera: cam, tearComplete: t >= 1.32 };
  }

  function frame(seconds = 0, overrides = {}) {
    if (!Number.isFinite(seconds)) throw new TypeError('frame(t) requires a finite time in seconds');
    const t = ((seconds % period) + period) % period;
    const copy = resolveCopy(overrides);
    if (mode === 'halftone') renderHalftone(t, copy);
    else renderEditorial(t, copy);
    return canvas;
  }

  return {
    canvas,
    mode,
    period,
    palette: pal,
    frame,
    proof: () => ({ ...lastProof }),
    dispose() { stampCache.clear(); },
  };
}
