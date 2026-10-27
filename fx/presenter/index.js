// Die-cut vinyl sticker presenter stage with 3-plane 2.5D parallax, damped spring pose swaps,
// morphological kiss-cut white contour baking and safe-zone callout choreography (Canvas 2D, 0BSD).
// Every frame is a pure deterministic function of time t; no Math.random is used.

import { loadRig, restPose } from '../character/rig.js';
import { solveIK } from '../character/math.js';

const TAU = Math.PI * 2;
const LAT = '"Archivo", "Noto Sans TC", "Helvetica Neue", Arial, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
const SERIF = '"Instrument Serif", Georgia, serif';

export const PERIOD = 7.2;
export const POSE_KEYS = Object.freeze([
  'thinking',
  'pointing_up',
  'explain',
  'surprised',
  'celebrate',
  'confident',
]);

export const PALETTES = Object.freeze({
  studio: {
    bgTop: '#161b26',
    bgBottom: '#0d1018',
    grid: 'rgba(232, 238, 252, 0.055)',
    gridMajor: 'rgba(232, 238, 252, 0.11)',
    glowA: 'rgba(56, 128, 255, 0.20)',
    glowB: 'rgba(245, 158, 66, 0.16)',
    card: '#f8f4ec',
    cardAlt: '#efe9dc',
    cardInk: '#151922',
    cardMuted: '#5b6270',
    cardRule: 'rgba(21, 25, 34, 0.12)',
    accent: '#2356e8',
    warm: '#e8522e',
    amber: '#f0a224',
    mint: '#149a74',
    vinyl: '#fffdf9',
    vinylEdge: 'rgba(20, 24, 34, 0.24)',
    badgeBg: '#1d2433',
    badgeInk: '#f7f9fc',
  },
  editorial: {
    bgTop: '#efe7d8',
    bgBottom: '#dfd3be',
    grid: 'rgba(26, 30, 38, 0.055)',
    gridMajor: 'rgba(26, 30, 38, 0.11)',
    glowA: 'rgba(35, 86, 232, 0.12)',
    glowB: 'rgba(232, 82, 46, 0.12)',
    card: '#fffdf9',
    cardAlt: '#f3ede0',
    cardInk: '#16181e',
    cardMuted: '#5b5f69',
    cardRule: 'rgba(22, 24, 30, 0.12)',
    accent: '#1d4ed8',
    warm: '#dc3d24',
    amber: '#d98a16',
    mint: '#128362',
    vinyl: '#ffffff',
    vinylEdge: 'rgba(22, 24, 30, 0.20)',
    badgeBg: '#191d26',
    badgeInk: '#fffdf9',
  },
});

const DEFAULT_SCRIPT = Object.freeze([
  {
    pose: 'thinking',
    at: 0.0,
    tag: 'BEAT 01 · QUESTION',
    callout: 'Why do flat slides lose eyes at 3 s?',
    focusBar: 1,
    metric: '3.0 s',
  },
  {
    pose: 'pointing_up',
    at: 1.2,
    tag: 'BEAT 02 · SIGNAL',
    callout: 'Depth + eye-line guide visual priority',
    focusBar: 2,
    metric: '+28%',
  },
  {
    pose: 'explain',
    at: 2.25,
    tag: 'BEAT 03 · EVIDENCE',
    callout: 'Anchor each claim to live stage proof',
    focusBar: 3,
    metric: '+42%',
  },
  {
    pose: 'surprised',
    at: 3.75,
    tag: 'BEAT 04 · SPIKE',
    callout: '3.4× recall jump on synchronized cues!',
    focusBar: 4,
    metric: '3.4×',
  },
  {
    pose: 'celebrate',
    at: 4.95,
    tag: 'BEAT 05 · LOCKED',
    callout: 'Three parallax planes, zero flat clutter',
    focusBar: 4,
    metric: '98.4',
  },
  {
    pose: 'confident',
    at: 6.1,
    tag: 'BEAT 06 · SUMMARY',
    callout: 'Clean kiss-cut stage ready for next cue',
    focusBar: 4,
    metric: 'READY',
  },
]);

const DEFAULT_ROBOT_URL = new URL('../../assets/characters/explorer-robot/rig.json', import.meta.url);

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (x) => {
  const k = clamp(x);
  return k * k * (3 - 2 * k);
};

function makeCanvas(w, h) {
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : new OffscreenCanvas(w, h);
  c.width = w;
  c.height = h;
  return c;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

// Damped underdamped spring response (0 -> 1 with lively overshoot and clean settle).
function springStep(u, damping = 0.54, frequency = 11.5) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const q = Math.sqrt(Math.max(1e-4, 1 - damping * damping));
  const w = frequency * q;
  return 1 - Math.exp(-damping * frequency * u) * (Math.cos(w * u) + (damping / q) * Math.sin(w * u));
}

// Impulse envelope for squash/stretch on pose swap: peaks around u = 0.08 and settles smoothly to 0.
function swapSquash(dt) {
  if (dt < 0 || dt > 0.65) return 0;
  return Math.sin(dt * 19.5) * Math.exp(-dt * 7.8);
}

// Exact 2D squared Euclidean Distance Transform (Felzenszwalb & Huttenlocher separable O(W*H)).
// Computes distance in pixels from every pixel to the nearest pixel with alpha >= threshold.
function alphaDistanceField(alphaMask, w, h) {
  const INF = 1e12;
  const f = new Float64Array(Math.max(w, h));
  const z = new Float64Array(Math.max(w, h) + 1);
  const v = new Int32Array(Math.max(w, h));
  const grid = new Float64Array(w * h);

  for (let i = 0; i < w * h; i++) {
    grid[i] = alphaMask[i] ? 0 : INF;
  }

  const edt1d = (len, read, write) => {
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 0; q < len; q++) f[q] = read(q);
    for (let q = 1; q < len; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      const dx = q - v[k];
      write(q, dx * dx + f[v[k]]);
    }
  };

  for (let x = 0; x < w; x++) {
    edt1d(h, (y) => grid[y * w + x], (y, val) => { grid[y * w + x] = val; });
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    edt1d(w, (x) => grid[row + x], (x, val) => { grid[row + x] = val; });
  }

  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dist[i] = Math.sqrt(grid[i]);
  return dist;
}

// Bakes a genuine die-cut thick white vinyl sticker sheet + kiss-cut edge bevel + soft offset drop shadow
// around any transparent character pose sprite once at setup time.
export function bakeDieCutSticker(sourceCanvas, {
  border = 16,
  shadowOffset = [10, 16],
  shadowBlur = 18,
  shadowAlpha = 0.34,
  vinylHex = '#fffdf9',
} = {}) {
  const pad = Math.ceil(border + shadowBlur + Math.max(Math.abs(shadowOffset[0]), Math.abs(shadowOffset[1])) + 10);
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;
  const w = sw + pad * 2;
  const h = sh + pad * 2;

  const subject = makeCanvas(w, h);
  const sctx = subject.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(sourceCanvas, pad, pad);
  const img = sctx.getImageData(0, 0, w, h);
  const data = img.data;

  const mask = new Uint8Array(w * h);
  let minX = w, minY = h, maxX = 0, maxY = 0, anyOpaque = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (data[i * 4 + 3] >= 36) {
        mask[i] = 1;
        anyOpaque = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!anyOpaque) {
    return { canvas: subject, anchorX: w * 0.5, anchorY: h * 0.85 };
  }

  const dist = alphaDistanceField(mask, w, h);
  const out = makeCanvas(w, h);
  const octx = out.getContext('2d');
  const outImg = octx.createImageData(w, h);
  const od = outImg.data;

  const vh = vinylHex.replace('#', '');
  const vr = parseInt(vh.slice(0, 2), 16);
  const vg = parseInt(vh.slice(2, 4), 16);
  const vb = parseInt(vh.slice(4, 6), 16);

  const sx = Math.round(shadowOffset[0]);
  const sy = Math.round(shadowOffset[1]);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const d = dist[idx];

      // Sample offset distance for drop shadow behind the vinyl backing.
      const qx = clamp(x - sx, 0, w - 1);
      const qy = clamp(y - sy, 0, h - 1);
      const sd = dist[qy * w + qx];
      const shCov = 1 - smooth((sd - border) / Math.max(1, shadowBlur));
      const shA = shCov * shCov * shadowAlpha;

      // Crisp kiss-cut vinyl border coverage + outer bevel hairline.
      const vinylCov = 1 - smooth((d - border) / 1.35);
      const rimBand = smooth((d - (border - 1.7)) / 1.1) * (1 - smooth((d - (border + 0.6)) / 1.1));

      // Subtle diagonal paper-vinyl sheen across the die-cut backing.
      const sheen = 0.035 * Math.max(0, Math.sin((x * 0.72 - y * 0.68) * 0.032));
      const cr = clamp((vr / 255) * (1 - 0.14 * rimBand) + sheen, 0, 1);
      const cg = clamp((vg / 255) * (1 - 0.14 * rimBand) + sheen, 0, 1);
      const cb = clamp((vb / 255) * (1 - 0.12 * rimBand) + sheen, 0, 1);

      // Composite shadow under vinyl backing (premultiplied-clean Porter-Duff over).
      const bgA = shA * (1 - vinylCov);
      const totA = vinylCov + bgA;
      if (totA > 1e-4) {
        const shR = 10 / 255, shG = 14 / 255, shB = 24 / 255;
        od[idx * 4] = Math.round(((cr * vinylCov + shR * bgA) / totA) * 255);
        od[idx * 4 + 1] = Math.round(((cg * vinylCov + shG * bgA) / totA) * 255);
        od[idx * 4 + 2] = Math.round(((cb * vinylCov + shB * bgA) / totA) * 255);
        od[idx * 4 + 3] = Math.round(clamp(totA, 0, 1) * 255);
      }
    }
  }

  octx.putImageData(outImg, 0, 0);
  // Crisp original character artwork sits cleanly atop the vinyl backing.
  octx.drawImage(sourceCanvas, pad, pad);

  return {
    canvas: out,
    anchorX: (minX + maxX) * 0.5,
    anchorY: maxY + border * 0.35,
    bounds: { minX, minY, maxX, maxY },
  };
}

function setArmIK(pose, side, target, bend = 1) {
  const root = side === 'right' ? 'rightShoulder' : 'leftShoulder';
  const knee = side === 'right' ? 'rightElbow' : 'leftElbow';
  const foot = side === 'right' ? 'rightHand' : 'leftHand';
  const solved = solveIK(pose.joints[root], target, 44, 44, bend);
  pose.joints[knee] = solved.knee;
  pose.joints[foot] = solved.foot;
  return solved;
}

function setLegIK(pose, side, target, bend) {
  const root = side === 'right' ? 'rightHip' : 'leftHip';
  const knee = side === 'right' ? 'rightKnee' : 'leftKnee';
  const foot = side === 'right' ? 'rightFoot' : 'leftFoot';
  const solved = solveIK(pose.joints[root], target, 41, 47, bend);
  pose.joints[knee] = solved.knee;
  pose.joints[foot] = solved.foot;
  return solved;
}

function drawFourPointStar(ctx, cx, cy, outerR, innerR, rot = 0, fill = '#f6b73c', stroke = '#1c2230') {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / 4;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
}

// Renders Milo (explorer-robot) in 6 unmistakable presenter poses with expressive props included inside
// the sprite so the kiss-cut white vinyl border wraps around both character and prop!
function buildRobotPoseSprites(rig) {
  const W = 500, H = 520;
  const ox = 255, oy = 330;
  const sprites = {};

  for (const key of POSE_KEYS) {
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const pose = restPose(rig.definition);
    pose.transform = {
      x: ox - rig.definition.canvas.origin[0],
      y: oy - rig.definition.canvas.origin[1],
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };

    if (key === 'thinking') {
      pose.joints.up = [-4, -125];
      pose.joints.look = [86, -101];
      pose.joints.scarfTip = [96, -76];
      setArmIK(pose, 'right', [-14, -76], -1);
      setArmIK(pose, 'left', [56, -12], -1);
      setLegIK(pose, 'right', [-24, 95], 1);
      setLegIK(pose, 'left', [28, 95], -1);
    } else if (key === 'pointing_up') {
      pose.joints.up = [3, -126];
      pose.joints.look = [92, -106];
      pose.joints.scarfTip = [106, -72];
      setArmIK(pose, 'left', [64, -148], -1);
      setArmIK(pose, 'right', [-56, -12], 1);
      setLegIK(pose, 'right', [-28, 95], 1);
      setLegIK(pose, 'left', [26, 95], -1);
    } else if (key === 'explain') {
      pose.joints.up = [-6, -125];
      pose.joints.look = [88, -90];
      pose.joints.scarfTip = [110, -68];
      setArmIK(pose, 'right', [-116, -64], -1);
      setArmIK(pose, 'left', [80, -34], 1);
      setLegIK(pose, 'right', [-30, 95], 1);
      setLegIK(pose, 'left', [26, 95], -1);
    } else if (key === 'surprised') {
      pose.joints.up = [8, -126];
      pose.joints.look = [88, -96];
      pose.joints.scarfTip = [112, -96];
      setArmIK(pose, 'right', [-86, -96], -1);
      setArmIK(pose, 'left', [88, -96], 1);
      setLegIK(pose, 'right', [-34, 92], 1);
      setLegIK(pose, 'left', [34, 92], -1);
    } else if (key === 'celebrate') {
      pose.joints.up = [0, -130];
      pose.joints.look = [90, -102];
      pose.joints.scarfTip = [116, -62];
      setArmIK(pose, 'right', [-78, -144], -1);
      setArmIK(pose, 'left', [80, -146], 1);
      setLegIK(pose, 'right', [-32, 84], 1);
      setLegIK(pose, 'left', [32, 82], -1);
    } else if (key === 'confident') {
      pose.joints.up = [2, -127];
      pose.joints.look = [92, -90];
      pose.joints.scarfTip = [104, -74];
      setArmIK(pose, 'right', [-56, -14], 1);
      setArmIK(pose, 'left', [56, -14], -1);
      setLegIK(pose, 'right', [-34, 95], 1);
      setLegIK(pose, 'left', [34, 95], -1);
    }

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(1.34, 1.34);
    ctx.translate(-ox, -oy);
    rig.draw(ctx, pose, { skeleton: false, parts: true });
    ctx.restore();

    // Expressive editorial sticker props drawn before kiss-cut contour baking so they share the die-cut vinyl!
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (key === 'thinking') {
      const dots = [[166, 148, 7], [148, 124, 10]];
      for (const [dx, dy, dr] of dots) {
        ctx.beginPath();
        ctx.arc(dx, dy, dr, 0, TAU);
        ctx.fillStyle = '#ffd166';
        ctx.fill();
        ctx.lineWidth = 3.2;
        ctx.strokeStyle = '#1d2433';
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(124, 88, 24, 0, TAU);
      ctx.fillStyle = '#ffd166';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#1d2433';
      ctx.stroke();
      ctx.font = `900 30px ${LAT}`;
      ctx.fillStyle = '#1d2433';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 124, 90);
    } else if (key === 'pointing_up') {
      drawFourPointStar(ctx, 344, 96, 24, 9, 0.15, '#ffb703', '#1d2433');
      drawFourPointStar(ctx, 376, 126, 13, 5, -0.2, '#3b82f6', '#1d2433');
    } else if (key === 'explain') {
      // Sleek presenter pointer baton extending from Milo's extended right hand toward the evidence card!
      ctx.beginPath();
      ctx.moveTo(98, 242);
      ctx.lineTo(36, 206);
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#1d2433';
      ctx.stroke();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#f8f4ec';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(34, 205, 9, 0, TAU);
      ctx.fillStyle = '#e8522e';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1d2433';
      ctx.stroke();
    } else if (key === 'surprised') {
      const rays = [[-36, -6, -54, -28], [0, -12, 0, -40], [36, -6, 54, -28]];
      for (const [x0, y0, x1, y1] of rays) {
        ctx.beginPath();
        ctx.moveTo(255 + x0, 108 + y0);
        ctx.lineTo(255 + x1, 108 + y1);
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#1d2433';
        ctx.stroke();
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#ff6b4a';
        ctx.stroke();
      }
    } else if (key === 'celebrate') {
      drawFourPointStar(ctx, 132, 106, 20, 8, -0.2, '#ffb703', '#1d2433');
      drawFourPointStar(ctx, 376, 104, 22, 8.5, 0.25, '#22c55e', '#1d2433');
      drawFourPointStar(ctx, 256, 72, 15, 6, 0, '#3b82f6', '#1d2433');
    } else if (key === 'confident') {
      ctx.beginPath();
      ctx.arc(356, 148, 22, 0, TAU);
      ctx.fillStyle = '#149a74';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#1d2433';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(346, 148);
      ctx.lineTo(353, 156);
      ctx.lineTo(367, 140);
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = '#fffdf9';
      ctx.stroke();
    }
    ctx.restore();

    sprites[key] = c;
  }
  return sprites;
}

// Clean geometric mascot fallback in case external asset fetching is disabled in a sandboxed test.
function buildProceduralMascotSprites() {
  const W = 460, H = 500;
  const sprites = {};
  for (const key of POSE_KEYS) {
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.translate(230, 290);
    ctx.strokeStyle = '#1a202c';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Legs
    ctx.fillStyle = '#3b6f7c';
    roundRectPath(ctx, -46, 56, 30, 82, 14); ctx.fill(); ctx.stroke();
    roundRectPath(ctx, 16, 56, 30, 82, 14); ctx.fill(); ctx.stroke();

    // Torso
    ctx.fillStyle = '#f3ead8';
    roundRectPath(ctx, -64, -46, 128, 114, 28); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8522e';
    roundRectPath(ctx, -70, -54, 140, 24, 12); ctx.fill(); ctx.stroke();

    // Arms per pose
    const rArm = key === 'explain' ? [-128, -42] : key === 'celebrate' ? [-106, -126] : key === 'surprised' ? [-104, -84] : key === 'thinking' ? [-32, -66] : [-88, 12];
    const lArm = key === 'pointing_up' ? [102, -138] : key === 'celebrate' ? [106, -126] : key === 'surprised' ? [104, -84] : [88, 12];
    for (const [sx, tx, ty] of [[-58, rArm[0], rArm[1]], [58, lArm[0], lArm[1]]]) {
      ctx.beginPath();
      ctx.moveTo(sx, -24);
      ctx.quadraticCurveTo((sx + tx) * 0.5, Math.min(-24, ty) + 22, tx, ty);
      ctx.lineWidth = 22; ctx.strokeStyle = '#1a202c'; ctx.stroke();
      ctx.lineWidth = 12; ctx.strokeStyle = '#3b6f7c'; ctx.stroke();
      ctx.beginPath(); ctx.arc(tx, ty, 14, 0, TAU);
      ctx.fillStyle = '#f3ead8'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#1a202c'; ctx.stroke();
    }

    // Head
    ctx.lineWidth = 6;
    ctx.fillStyle = '#f5eee0';
    roundRectPath(ctx, -78, -162, 156, 112, 46); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1e2636';
    roundRectPath(ctx, -54, -136, 108, 60, 24); ctx.fill();
    ctx.fillStyle = '#ffb703';
    ctx.beginPath(); ctx.arc(-24, -106, 10, 0, TAU); ctx.arc(24, -106, 10, 0, TAU); ctx.fill();
    ctx.restore();
    sprites[key] = c;
  }
  return sprites;
}

async function normalizeCustomPose(input, targetHeight = 420) {
  let img = input;
  if (typeof input === 'string' || input instanceof URL) {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.src = String(input);
    await el.decode();
    img = el;
  }
  const iw = img.naturalWidth || img.width || 320;
  const ih = img.naturalHeight || img.height || 420;
  const s = targetHeight / Math.max(1, ih);
  const cw = Math.max(64, Math.round(iw * s) + 32);
  const ch = Math.max(64, Math.round(ih * s) + 32);
  const c = makeCanvas(cw, ch);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 16, 16, Math.round(iw * s), Math.round(ih * s));
  return c;
}

function fitHeadlineFont(ctx, text, maxWidth, basePx = 44, minPx = 22) {
  let size = basePx;
  while (size > minPx) {
    ctx.font = `900 ${size}px ${LAT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

export async function createStickerStage(options = {}) {
  const W = options.width || 1280;
  const H = options.height || 720;
  const stageEl = options.stage || null;
  const pal = typeof options.palette === 'object' && options.palette
    ? { ...PALETTES.studio, ...options.palette }
    : (PALETTES[options.palette] || PALETTES.studio);
  const stickerBorder = Number.isFinite(options.stickerBorder) ? options.stickerBorder : 15;
  const script = Array.isArray(options.script) && options.script.length ? options.script : DEFAULT_SCRIPT;

  // Load built-in explorer-robot mascot (or procedural fallback) + optional custom runtime poses map.
  let rawSprites = null;
  if (options.mascot === 'geometric') {
    rawSprites = buildProceduralMascotSprites();
  } else {
    try {
      const rig = await loadRig(options.rigUrl || DEFAULT_ROBOT_URL);
      rawSprites = buildRobotPoseSprites(rig);
    } catch {
      rawSprites = buildProceduralMascotSprites();
    }
  }

  if (options.poses && typeof options.poses === 'object') {
    for (const [key, src] of Object.entries(options.poses)) {
      if (!src) continue;
      rawSprites[key] = await normalizeCustomPose(src, 420);
    }
  }

  const bakedPoses = {};
  for (const [key, sprite] of Object.entries(rawSprites)) {
    bakedPoses[key] = bakeDieCutSticker(sprite, {
      border: stickerBorder,
      shadowOffset: [10, 16],
      shadowBlur: 18,
      shadowAlpha: 0.34,
      vinylHex: pal.vinyl,
    });
  }

  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const resolveHeadline = (frameOpts) => {
    const custom = frameOpts?.text
      ?? options.customText
      ?? options.headline
      ?? stageEl?.dataset?.customText
      ?? (typeof window !== 'undefined' ? window.FX_CUSTOM_TEXT : '');
    const trimmed = typeof custom === 'string' ? custom.trim() : '';
    return trimmed || 'VISUAL PROOF STAGE';
  };

  function activeBeat(t) {
    let idx = 0;
    for (let i = 0; i < script.length; i++) {
      if (t >= script[i].at) idx = i;
    }
    const cur = script[idx];
    const prev = script[(idx - 1 + script.length) % script.length];
    const dt = idx === 0 && t < cur.at + 0.001 ? 99 : (t - cur.at);
    return { idx, cur, prev, dt };
  }

  // Plane 1 (0.22x parallax): Studio architectural grid, drafting ticks, soft keylight pools & floating shapes.
  function drawBackgroundPlane(t, camX, camY, camZoom) {
    const px = camX * 0.22;
    const py = camY * 0.22;
    const pz = 1 + (camZoom - 1) * 0.22;

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, pal.bgTop);
    bg.addColorStop(1, pal.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W * 0.5 + px, H * 0.5 + py);
    ctx.scale(pz, pz);
    ctx.translate(-W * 0.5, -H * 0.5);

    // Dual studio keylight pools
    const g1 = ctx.createRadialGradient(W * 0.34, H * 0.42, 20, W * 0.34, H * 0.42, W * 0.48);
    g1.addColorStop(0, pal.glowA);
    g1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(-160, -120, W + 320, H + 240);

    const g2 = ctx.createRadialGradient(W * 0.78, H * 0.52, 20, W * 0.78, H * 0.52, W * 0.38);
    g2.addColorStop(0, pal.glowB);
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(-160, -120, W + 320, H + 240);

    // Architectural grid
    const step = 48;
    ctx.lineWidth = 1;
    for (let x = -step * 3; x <= W + step * 3; x += step) {
      ctx.strokeStyle = x % (step * 4) === 0 ? pal.gridMajor : pal.grid;
      ctx.beginPath();
      ctx.moveTo(x, -96);
      ctx.lineTo(x, H + 96);
      ctx.stroke();
    }
    for (let y = -step * 2; y <= H + step * 2; y += step) {
      ctx.strokeStyle = y % (step * 4) === 0 ? pal.gridMajor : pal.grid;
      ctx.beginPath();
      ctx.moveTo(-144, y);
      ctx.lineTo(W + 144, y);
      ctx.stroke();
    }

    // Subtle floating architectural rings & registration crosshairs
    const drift = Math.sin((TAU * t) / PERIOD);
    ctx.strokeStyle = pal.gridMajor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(980 + drift * 12, 230 - drift * 8, 178, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(980 + drift * 12, 230 - drift * 8, 214, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = `600 11px ${MONO}`;
    ctx.fillStyle = pal.gridMajor;
    ctx.textAlign = 'left';
    ctx.fillText('STAGE PLANE Z-0 · PARALLAX 0.22× · SAFE FRAME 16:9', 68, 42);
    ctx.restore();
  }

  // Plane 2A (1.0x parallax): Editorial Evidence Card synchronized to the presenter's pose beats.
  function drawEvidenceCard(t, headline, beat) {
    const cx = 66, cy = 104, cw = 612, ch = 508;

    // Die-cut paper backing & drop shadow for the evidence board
    ctx.save();
    ctx.shadowColor = 'rgba(6, 10, 18, 0.36)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 16;
    roundRectPath(ctx, cx - 7, cy - 7, cw + 14, ch + 14, 22);
    ctx.fillStyle = pal.vinyl;
    ctx.fill();
    ctx.restore();

    roundRectPath(ctx, cx, cy, cw, ch, 16);
    ctx.fillStyle = pal.card;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = pal.cardRule;
    ctx.stroke();

    // Top studio header strip
    ctx.save();
    roundRectPath(ctx, cx, cy, cw, ch, 16);
    ctx.clip();
    ctx.fillStyle = pal.cardAlt;
    ctx.fillRect(cx, cy, cw, 50);
    ctx.strokeStyle = pal.cardRule;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 50);
    ctx.lineTo(cx + cw, cy + 50);
    ctx.stroke();

    // Window dots + eyebrow tag
    const dotColors = [pal.warm, pal.amber, pal.mint];
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(cx + 26 + i * 18, cy + 25, 5.5, 0, TAU);
      ctx.fillStyle = dotColors[i];
      ctx.fill();
    }
    ctx.font = `700 12px ${MONO}`;
    ctx.fillStyle = pal.cardMuted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('EVIDENCE DECK · COHORT RETENTION STUDY', cx + 88, cy + 25);

    ctx.textAlign = 'right';
    ctx.fillStyle = pal.accent;
    ctx.fillText(`SYNC · ${beat.cur.pose.toUpperCase()}`, cx + cw - 24, cy + 25);

    // Custom-text-aware main headline
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const fontSize = fitHeadlineFont(ctx, headline, cw - 64, 42, 22);
    ctx.font = `900 ${fontSize}px ${LAT}`;
    ctx.fillStyle = pal.cardInk;
    ctx.fillText(headline, cx + 32, cy + 108);

    // Animated marker underline beneath headline
    const uProg = clamp(0.35 + 0.65 * springStep(clamp((t + 0.15) / 0.8)));
    ctx.fillStyle = pal.amber;
    roundRectPath(ctx, cx + 32, cy + 120, Math.min(cw - 64, ctx.measureText(headline).width) * uProg, 6, 3);
    ctx.fill();

    ctx.font = `500 15px ${LAT}`;
    ctx.fillStyle = pal.cardMuted;
    ctx.fillText('Viewer recall across 5 presentation formats (n = 1,240 sessions)', cx + 32, cy + 150);

    // Comparative bar chart panel
    const gx = cx + 32, gy = cy + 174, gw = cw - 64, gh = 236;
    roundRectPath(ctx, gx, gy, gw, gh, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = pal.cardRule;
    ctx.stroke();

    const bars = [
      { label: 'TEXT SLIDE', val: 0.28, note: '28%' },
      { label: 'STATIC CHART', val: 0.39, note: '39%' },
      { label: 'VOICE + DECK', val: 0.56, note: '56%' },
      { label: 'CUTOUT RIG', val: 0.74, note: '74%' },
      { label: 'STICKER 2.5D', val: 0.94, note: '94%' },
    ];

    for (let r = 1; r <= 3; r++) {
      const ly = gy + gh - 38 - ((gh - 66) * r) / 3;
      ctx.strokeStyle = 'rgba(21, 25, 34, 0.07)';
      ctx.beginPath();
      ctx.moveTo(gx + 20, ly);
      ctx.lineTo(gx + gw - 20, ly);
      ctx.stroke();
    }

    const slotW = (gw - 48) / bars.length;
    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];
      const bx = gx + 28 + i * slotW + slotW * 0.14;
      const bw = slotW * 0.72;
      const isFocus = beat.cur.focusBar === i;
      const focusPulse = isFocus ? springStep(clamp(beat.dt / 0.45), 0.48, 12) : 0;
      const hMax = gh - 74;
      const bh = hMax * b.val * (isFocus ? (0.94 + 0.06 * focusPulse) : 1);
      const by = gy + gh - 38 - bh;

      roundRectPath(ctx, bx, by, bw, bh, 8);
      ctx.fillStyle = i === 4 ? pal.accent : isFocus ? pal.warm : 'rgba(28, 36, 52, 0.16)';
      ctx.fill();

      if (isFocus || i === 4) {
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = pal.cardInk;
        ctx.stroke();
      }

      ctx.font = `800 14px ${MONO}`;
      ctx.fillStyle = i === 4 || isFocus ? pal.cardInk : pal.cardMuted;
      ctx.textAlign = 'center';
      ctx.fillText(b.note, bx + bw * 0.5, by - 10);

      ctx.font = `700 10.5px ${MONO}`;
      ctx.fillStyle = pal.cardMuted;
      ctx.fillText(b.label, bx + bw * 0.5, gy + gh - 16);
    }

    // Trend curve overlay connecting top of bars
    ctx.beginPath();
    for (let i = 0; i < bars.length; i++) {
      const bx = gx + 28 + i * slotW + slotW * 0.5;
      const by = gy + gh - 38 - (gh - 74) * bars[i].val;
      if (i === 0) ctx.moveTo(bx, by);
      else ctx.lineTo(bx, by);
    }
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = pal.amber;
    ctx.stroke();

    // Bottom evidence summary strip + verified seal on celebrate/confident beats
    const fy = cy + ch - 74;
    roundRectPath(ctx, gx, fy, gw, 52, 10);
    ctx.fillStyle = pal.cardAlt;
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `700 12px ${MONO}`;
    ctx.fillStyle = pal.accent;
    ctx.fillText('KEY FINDING', gx + 18, fy + 19);
    ctx.font = `600 14px ${LAT}`;
    ctx.fillStyle = pal.cardInk;
    ctx.fillText('Die-cut presenter eye-line + parallax planes lift retention 3.4×.', gx + 18, fy + 37);

    if (beat.idx >= 4) {
      const stampK = springStep(clamp((t - script[4].at) / 0.42), 0.46, 13);
      ctx.save();
      ctx.translate(gx + gw - 74, fy + 26);
      ctx.rotate(-0.11 + (1 - stampK) * 0.25);
      ctx.scale(0.6 + 0.4 * stampK, 0.6 + 0.4 * stampK);
      roundRectPath(ctx, -54, -16, 108, 32, 7);
      ctx.fillStyle = pal.mint;
      ctx.fill();
      ctx.font = `800 12px ${MONO}`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText('VERIFIED ✓', 0, 1);
      ctx.restore();
    }

    ctx.restore();
  }

  // Plane 2B (1.0x parallax): Die-cut vinyl presenter with damped spring squash/stretch & peel on pose swaps.
  function drawPresenterSticker(t, beat) {
    const sticker = bakedPoses[beat.cur.pose] || bakedPoses.explain || Object.values(bakedPoses)[0];
    if (!sticker) return { headX: 980, headY: 220 };

    const osc = swapSquash(beat.dt);
    const hop = beat.dt >= 0 && beat.dt < 0.42 ? Math.sin(Math.PI * (beat.dt / 0.42)) * 22 : 0;
    const breath = Math.sin((TAU * t) / (PERIOD / 3)) * 0.012;

    const scaleBase = 0.92;
    const sx = scaleBase * (1 - 0.13 * osc + breath);
    const sy = scaleBase * (1 + 0.15 * osc - breath);
    const peelTilt = osc * 0.065 + Math.sin((TAU * t) / PERIOD) * 0.015;

    const footX = 1030;
    const footY = 636 - hop;

    // Ground contact shadow ellipse on the studio floor
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(footX, 640, 108 * (1 - hop * 0.005), 18 * (1 - hop * 0.005), 0, 0, TAU);
    ctx.fillStyle = 'rgba(6, 9, 16, 0.34)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(footX, footY);
    ctx.rotate(peelTilt);
    ctx.scale(sx, sy);
    ctx.drawImage(sticker.canvas, -sticker.anchorX, -sticker.anchorY);
    ctx.restore();

    return {
      headX: footX - 48,
      headY: footY - (sticker.anchorY - sticker.bounds.minY) * sy * 0.76,
    };
  }

  // Safe-zone-aware animated die-cut callout bubble: clamped inside title-safe bounds, never overlaps face or edges.
  function drawSafeCallout(t, beat, anchor) {
    const pop = beat.idx === 0 && t < 0.35
      ? springStep(clamp(t / 0.35), 0.55, 11)
      : springStep(clamp(beat.dt / 0.38), 0.52, 12);

    ctx.save();
    ctx.font = `700 17px ${LAT}`;
    const textW = ctx.measureText(beat.cur.callout).width;
    const bw = clamp(Math.ceil(textW + 44), 258, 336);
    const bh = 82;

    // Position callout in the open studio corridor (x >= 696) between evidence card (right=678) and presenter head!
    const safeMinX = 696;
    const safeMaxX = W - 64 - bw;
    const safeMinY = 126;
    const safeMaxY = H - 90 - bh;
    const bx = clamp(anchor.headX - bw + 34, safeMinX, safeMaxX);
    const by = clamp(anchor.headY - 178, safeMinY, Math.min(safeMaxY, 138));

    const cx = bx + bw * 0.5;
    const cy = by + bh * 0.5;
    ctx.translate(cx, cy);
    ctx.scale(0.82 + 0.18 * pop, 0.82 + 0.18 * pop);
    ctx.translate(-cx, -cy);

    // Die-cut speech bubble with pointer tail angled down-right toward presenter
    ctx.shadowColor = 'rgba(8, 12, 22, 0.32)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 10;

    ctx.fillStyle = pal.vinyl;
    ctx.strokeStyle = pal.cardInk;
    ctx.lineWidth = 3;

    ctx.beginPath();
    const r = 18;
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
    ctx.lineTo(bx + bw, by + bh - r);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
    ctx.lineTo(bx + bw - 34, by + bh);
    ctx.lineTo(bx + bw - 14, by + bh + 18);
    ctx.lineTo(bx + bw - 56, by + bh);
    ctx.lineTo(bx + r, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();

    // Tag pill inside bubble
    roundRectPath(ctx, bx + 16, by + 12, 148, 21, 10.5);
    ctx.fillStyle = pal.accent;
    ctx.fill();
    ctx.font = `800 10.5px ${MONO}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(beat.cur.tag, bx + 26, by + 22.5);

    // Main callout line (auto-fit if long)
    let cSize = 17;
    while (cSize > 12) {
      ctx.font = `700 ${cSize}px ${LAT}`;
      if (ctx.measureText(beat.cur.callout).width <= bw - 32) break;
      cSize -= 1;
    }
    ctx.fillStyle = pal.cardInk;
    ctx.fillText(beat.cur.callout, bx + 16, by + 56);
    ctx.restore();
  }

  // Plane 3 (1.7x foreground parallax): Floating die-cut metric badges framing the studio stage.
  function drawForegroundPlane(t, beat, camX, camY, camZoom) {
    const px = camX * 1.7;
    const py = camY * 1.7;
    const pz = 1 + (camZoom - 1) * 1.7;
    const bobA = Math.sin((TAU * t) / (PERIOD * 0.5)) * 5;
    const bobB = Math.cos((TAU * t) / (PERIOD * 0.5) + 0.9) * 5;

    ctx.save();
    ctx.translate(W * 0.5 + px, H * 0.5 + py);
    ctx.scale(pz, pz);
    ctx.translate(-W * 0.5, -H * 0.5);

    const drawStickerBadge = (x, y, w, h, rot, pillColor, label, value) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.shadowColor = 'rgba(5, 8, 16, 0.38)';
      ctx.shadowBlur = 22;
      ctx.shadowOffsetX = 6;
      ctx.shadowOffsetY = 12;
      roundRectPath(ctx, -w * 0.5 - 6, -h * 0.5 - 6, w + 12, h + 12, 20);
      ctx.fillStyle = pal.vinyl;
      ctx.fill();
      ctx.shadowColor = 'transparent';

      roundRectPath(ctx, -w * 0.5, -h * 0.5, w, h, 15);
      ctx.fillStyle = pal.badgeBg;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(-w * 0.5 + 24, 0, 9, 0, TAU);
      ctx.fillStyle = pillColor;
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `700 10px ${MONO}`;
      ctx.fillStyle = 'rgba(247, 249, 252, 0.68)';
      ctx.fillText(label, -w * 0.5 + 42, -9);

      ctx.font = `900 18px ${LAT}`;
      ctx.fillStyle = pal.badgeInk;
      ctx.fillText(value, -w * 0.5 + 42, 11);
      ctx.restore();
    };

    drawStickerBadge(
      232,
      646 + bobA,
      224,
      54,
      -0.03,
      pal.warm,
      'LIVE DELTA · FG 1.7×',
      `${beat.cur.metric} RECALL`,
    );

    drawStickerBadge(
      1088,
      74 + bobB,
      208,
      52,
      0.028,
      pal.mint,
      'DIE-CUT VINYL',
      `${stickerBorder} PX CONTOUR`,
    );

    ctx.restore();
  }

  function frame(seconds, frameOpts = {}) {
    if (!Number.isFinite(seconds)) throw new TypeError('Frame time must be finite');
    const t = ((seconds % PERIOD) + PERIOD) % PERIOD;
    const beat = activeBeat(t);
    const headline = resolveHeadline(frameOpts);

    // Periodic 2.5D studio camera pan, tilt and push-in across the 7.2 s loop (seamless at t = 0 / 7.2).
    const phase = (TAU * t) / PERIOD;
    const camX = -28 * Math.sin(phase) + 12 * Math.sin(phase * 2);
    const camY = 11 * Math.sin(phase - 0.6);
    const camZoom = 1 + 0.045 * (0.5 - 0.5 * Math.cos(phase));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 0.22x Background Plane
    drawBackgroundPlane(t, camX, camY, camZoom);

    // 1.0x Main Editorial + Die-Cut Presenter Plane
    ctx.save();
    ctx.translate(W * 0.5 + camX, H * 0.5 + camY);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-W * 0.5, -H * 0.5);
    drawEvidenceCard(t, headline, beat);
    const headAnchor = drawPresenterSticker(t, beat);
    drawSafeCallout(t, beat, headAnchor);
    ctx.restore();

    // 1.7x Foreground Floating Metric Badges Plane
    drawForegroundPlane(t, beat, camX, camY, camZoom);

    return canvas;
  }

  frame(0);
  return {
    canvas,
    frame,
    period: PERIOD,
    poses: Object.keys(bakedPoses),
    dispose() {},
  };
}
