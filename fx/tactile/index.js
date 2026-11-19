// Tactile Particle Dissolve, Sticker Peel, Paper Diorama & Kinetic Shutter Typography (0BSD).
// Pure deterministic frame(t, options) on 1280x720 (16:9) Canvas 2D, zero external deps.

const W = 1280;
const H = 720;
const TAU = Math.PI * 2;
const SANS = '"Archivo", "Helvetica Neue", -apple-system, Arial, sans-serif';
const SERIF = '"Instrument Serif", Georgia, "Times New Roman", serif';
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const outCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
const inOutCubic = (x) => {
  const k = clamp(x);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};
const spring = (u, zeta = 0.62, omega = 18) => {
  if (u <= 0) return 0;
  const wd = omega * Math.sqrt(Math.max(0.001, 1 - zeta * zeta));
  const env = Math.exp(-zeta * omega * u);
  return 1 - env * (Math.cos(wd * u) + ((zeta * omega) / wd) * Math.sin(wd * u));
};
const hash2 = (x, y, seed = 1) => {
  let v = Math.imul(x + seed, 374761393) + Math.imul(y, 668265263);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
};

async function ensureFonts() {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
}

function getCustomText(options, fallback) {
  const raw =
    (options && typeof options.text === 'string' && options.text.trim()) ||
    (typeof window !== 'undefined' && typeof window.FX_CUSTOM_TEXT === 'string' && window.FX_CUSTOM_TEXT.trim()) ||
    '';
  return raw || fallback;
}

function rrect(g, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, rad);
  else {
    g.moveTo(x + rad, y);
    g.arcTo(x + w, y, x + w, y + h, rad);
    g.arcTo(x + w, y + h, x, y + h, rad);
    g.arcTo(x, y + h, x, y, rad);
    g.arcTo(x, y, x + w, y, rad);
    g.closePath();
  }
}

// ============================================================================
// 1. particle-dissolve (lead, kind: motion, period: 5.6, hero: 2.45)
// Energy-preserving deterministic pixel-sampled particle dissolve & reassembly
// ============================================================================
async function buildParticleDissolve(options = {}) {
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 5.6;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  // Source subject artwork baked at 640x360 for fast deterministic pixel sampling
  const SW = 640, SH = 360;
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = SW;
  srcCanvas.height = SH;
  const sg = srcCanvas.getContext('2d', { willReadFrequently: true });

  const intactCanvas = document.createElement('canvas');
  intactCanvas.width = SW;
  intactCanvas.height = SH;
  const ig = intactCanvas.getContext('2d');

  const PITCH = 4;
  const COLS = Math.ceil(SW / PITCH);
  const ROWS = Math.ceil(SH / PITCH);
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = COLS;
  maskCanvas.height = ROWS;
  const mg = maskCanvas.getContext('2d');
  const maskData = mg.createImageData(COLS, ROWS);

  let cachedWord = null;
  let cellRelease = [];
  let particles = [];

  function rebuildSubject(word) {
    sg.clearRect(0, 0, SW, SH);

    // Bold high-contrast chromatic geometric badge + wordmark
    const badgeG = sg.createLinearGradient(110, 70, 530, 290);
    badgeG.addColorStop(0, '#FF5A36');
    badgeG.addColorStop(0.5, '#FF90E8');
    badgeG.addColorStop(1, '#38BDF8');

    // Outer geometric ring emblem
    sg.strokeStyle = badgeG;
    sg.lineWidth = 10;
    rrect(sg, 72, 68, 496, 224, 34);
    sg.stroke();

    // Accent corner diamond marks
    sg.fillStyle = '#FFD400';
    sg.beginPath();
    sg.arc(106, 102, 12, 0, TAU);
    sg.fill();
    sg.fillStyle = '#38BDF8';
    sg.beginPath();
    sg.arc(534, 258, 12, 0, TAU);
    sg.fill();

    // Crisp hero wordmark inside badge
    const clean = word.slice(0, 18).toUpperCase();
    let fSize = clean.length > 10 ? 54 : clean.length > 7 ? 72 : 92;
    sg.font = `900 ${fSize}px ${SANS}`;
    while (sg.measureText(clean).width > 430 && fSize > 32) {
      fSize -= 4;
      sg.font = `900 ${fSize}px ${SANS}`;
    }
    sg.fillStyle = badgeG;
    sg.textAlign = 'center';
    sg.textBaseline = 'middle';
    sg.fillText(clean, SW / 2, SH / 2 - 6);

    sg.fillStyle = '#F8FAFC';
    sg.font = `700 13px ${MONO}`;
    sg.fillText('ENERGY-CONSERVING PARTICLE FIELD', SW / 2, SH / 2 + 64);

    // Sample pixels deterministically into energy-weighted cells
    const px = sg.getImageData(0, 0, SW, SH).data;
    cellRelease = new Float32Array(COLS * ROWS);
    particles = [];

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cx = (col + 0.5) * PITCH;
        const cy = (row + 0.5) * PITCH;
        // Diagonal release wave + cluster coherence
        const wave = (cx / SW) * 0.62 + (1 - cy / SH) * 0.20;
        const cluster = hash2(Math.floor(col / 3), Math.floor(row / 3), 11);
        const rel = clamp(wave * 0.72 + cluster * 0.22 + hash2(col, row, 19) * 0.08, 0, 1);
        cellRelease[row * COLS + col] = rel;

        const ix = Math.min(SW - 1, Math.floor(cx));
        const iy = Math.min(SH - 1, Math.floor(cy));
        const off = (iy * SW + ix) * 4;
        const r = px[off], gr = px[off + 1], b = px[off + 2], a = px[off + 3];
        if (a < 28) continue;

        // Deterministic velocity drift up-right with gentle turbulence
        const ang = -0.45 + (hash2(col, row, 31) - 0.5) * 0.95;
        const spd = 85 + hash2(col, row, 47) * 140;
        const size = 2.6 + hash2(col, row, 59) * 3.8;
        const lum = (0.299 * r + 0.587 * gr + 0.114 * b) / 255;
        // Energy conservation factor so enlarged glowing particles don't blow out brightness
        const areaRatio = (PITCH * PITCH) / (Math.PI * size * size * 0.65);
        const energyAlpha = clamp((a / 255) * Math.min(1.0, areaRatio * (0.75 + 0.35 * lum)), 0.18, 0.96);

        particles.push({
          x: cx,
          y: cy,
          rel,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 24,
          ax: 28 + hash2(col, row, 71) * 48,
          ay: -22 - hash2(col, row, 83) * 36,
          size,
          life: 0.75 + hash2(col, row, 97) * 0.55,
          energyAlpha,
          color: `rgb(${r},${gr},${b})`,
        });
      }
    }
    cachedWord = word;
  }

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const word = getCustomText(opts, 'DISPERSE');
    if (word !== cachedWord) rebuildSubject(word);

    // Seamless mirror wave: 0..0.55s intact -> 0.55..3.05s dissolve outward -> 3.05..5.15s reassemble -> 5.15..5.6s intact
    let wavePos = 0;
    if (t < 0.55) wavePos = -0.25;
    else if (t < 3.05) wavePos = lerp(-0.18, 1.48, (t - 0.55) / 2.5);
    else if (t < 5.15) wavePos = lerp(1.48, -0.18, inOutCubic((t - 3.05) / 2.1));
    else wavePos = -0.25;

    // Update intact subject erosion mask
    const softness = 0.085;
    const md = maskData.data;
    for (let i = 0; i < cellRelease.length; i++) {
      const intactA = clamp((cellRelease[i] - wavePos) / softness + 0.5);
      const p = i * 4;
      md[p] = 255; md[p + 1] = 255; md[p + 2] = 255;
      md[p + 3] = Math.round(intactA * 255);
    }
    mg.putImageData(maskData, 0, 0);

    ig.clearRect(0, 0, SW, SH);
    ig.drawImage(srcCanvas, 0, 0);
    ig.globalCompositeOperation = 'destination-in';
    ig.drawImage(maskCanvas, 0, 0, SW, SH);
    ig.globalCompositeOperation = 'source-over';

    // Render onto full canvas
    const scX = width / SW;
    const scY = height / SH;
    const bg = g.createRadialGradient(width * 0.5, height * 0.48, 40, width * 0.5, height * 0.5, width * 0.72);
    bg.addColorStop(0, '#141726');
    bg.addColorStop(1, '#080910');
    g.fillStyle = bg;
    g.fillRect(0, 0, width, height);

    g.drawImage(intactCanvas, 0, 0, width, height);

    // Draw released particles with 3-sample motion-blur trails and energy conservation
    g.save();
    g.scale(scX, scY);
    g.globalCompositeOperation = 'lighter';
    const SAMPLES = 3;
    const TRAIL_DT = 0.045;

    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      const age = wavePos - pt.rel;
      if (age <= -0.02 || age >= pt.life) continue;
      const clampedAge = Math.max(0, age);
      const fadeIn = clamp((age + 0.02) / 0.09);
      const fadeOut = clamp((pt.life - clampedAge) / 0.42);
      const grow = 1 + clampedAge * 0.55;
      const rad = pt.size * 0.5 * grow;
      // Preserve total luminous flux as radius expands
      const areaScale = 1 / (grow * grow);
      const alpha = (pt.energyAlpha * fadeIn * fadeOut * areaScale) / SAMPLES;
      if (alpha < 0.008) continue;

      g.fillStyle = pt.color;
      g.globalAlpha = alpha;
      for (let s = 0; s < SAMPLES; s++) {
        const dt = (s / (SAMPLES - 1) - 0.5) * TRAIL_DT;
        const sa = Math.max(0, clampedAge + dt);
        const px = pt.x + pt.vx * sa + 0.5 * pt.ax * sa * sa;
        const py = pt.y + pt.vy * sa + 0.5 * pt.ay * sa * sa;
        g.beginPath();
        g.arc(px, py, rad, 0, TAU);
        g.fill();
      }
    }
    g.restore();
  }

  frame(1.65, options);
  return { canvas, frame, period: PERIOD, hero: 1.65 };
}

// ============================================================================
// 2. sticker-peel (lead, kind: motion, period: 5.2, hero: 1.65)
// Analytical diagonal corner peel with shaded paper backing & cast drop shadow
// ============================================================================
async function buildStickerPeel(options = {}) {
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 5.2;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  // Offscreen Scene A (top sheet being peeled) & Scene B (revealed underneath)
  const sceneA = document.createElement('canvas');
  sceneA.width = W; sceneA.height = H;
  const gA = sceneA.getContext('2d');

  const sceneB = document.createElement('canvas');
  sceneB.width = W; sceneB.height = H;
  const gB = sceneB.getContext('2d');

  let cachedText = null;

  function paintScenes(customWord) {
    // Scene A: Punchy Vermilion-Orange Drop Poster
    gA.fillStyle = '#F2542D';
    gA.fillRect(0, 0, W, H);
    // Bold halftone dot accent band
    gA.fillStyle = 'rgba(20, 14, 12, 0.12)';
    for (let y = 40; y < H; y += 36) {
      for (let x = 40; x < W; x += 36) {
        gA.beginPath(); gA.arc(x, y, 4.5, 0, TAU); gA.fill();
      }
    }
    // Outer frame border
    gA.strokeStyle = 'rgba(255, 244, 232, 0.35)';
    gA.lineWidth = 4;
    gA.strokeRect(42, 42, W - 84, H - 84);

    gA.fillStyle = '#191311';
    gA.font = `700 18px ${MONO}`;
    gA.textAlign = 'left';
    gA.fillText('ISSUE 01  ·  PEEL CORNER TO REVEAL', 88, 108);

    const wA = (customWord || 'PEEL BACK').toUpperCase();
    gA.fillStyle = '#FFF7EB';
    gA.font = `900 ${wA.length > 10 ? 108 : 148}px ${SANS}`;
    gA.textAlign = 'center';
    gA.textBaseline = 'middle';
    gA.fillText(wA, W * 0.5, H * 0.47);

    // Die-cut vinyl badge on Scene A
    gA.save();
    gA.translate(975, 535);
    gA.rotate(-0.14);
    rrect(gA, -124, -40, 248, 80, 40);
    gA.fillStyle = '#FFF7EB';
    gA.fill();
    rrect(gA, -114, -30, 228, 60, 30);
    gA.fillStyle = '#191311';
    gA.fill();
    gA.fillStyle = '#FFD400';
    gA.font = `900 26px ${SANS}`;
    gA.fillText('NEW DROP ↘', 0, 2);
    gA.restore();

    // Scene B: Deep Teal & Warm Cream Revealed Poster Underneath
    gB.fillStyle = '#0E6B66';
    gB.fillRect(0, 0, W, H);
    // Warm cream central card
    rrect(gB, 84, 84, W - 168, H - 168, 28);
    gB.fillStyle = '#F6F1E5';
    gB.fill();

    gB.fillStyle = '#0E6B66';
    gB.font = `700 17px ${MONO}`;
    gB.textAlign = 'center';
    gB.textBaseline = 'middle';
    gB.fillText('LAYER 02  ·  UNCOVERED BENEATH THE FOLD', W * 0.5, 224);

    gB.fillStyle = '#122220';
    gB.font = `900 132px ${SANS}`;
    gB.fillText('UNWRAPPED', W * 0.5, 360);

    // Two crisp die-cut sticker badges on Scene B
    const drawSticker = (sx, sy, rot, bgCol, textCol, lbl) => {
      gB.save();
      gB.translate(sx, sy);
      gB.rotate(rot);
      gB.shadowColor = 'rgba(12, 24, 22, 0.24)';
      gB.shadowBlur = 18;
      gB.shadowOffsetY = 8;
      rrect(gB, -128, -36, 256, 72, 36);
      gB.fillStyle = '#FFFFFF';
      gB.fill();
      gB.shadowBlur = 0; gB.shadowOffsetY = 0;
      rrect(gB, -118, -26, 236, 52, 26);
      gB.fillStyle = bgCol;
      gB.fill();
      gB.fillStyle = textCol;
      gB.font = `900 22px ${SANS}`;
      gB.fillText(lbl, 0, 1);
      gB.restore();
    };
    drawSticker(445, 512, -0.07, '#F2542D', '#FFF7EB', 'VINYL GLOSS');
    drawSticker(820, 508, 0.06, '#122220', '#FFD400', 'PURE f(t) CODE');

    cachedText = customWord;
  }

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const customWord = getCustomText(opts, '');
    if (customWord !== cachedText) paintScenes(customWord);

    const sc = width / W;

    // Seamless peel cycle: 0..0.4s intact A -> 0.4..2.9s diagonal peel across (hero=1.65 right at 50%!) ->
    // 2.9..3.45s hold B -> 3.45..4.95s unpeel back -> 4.95..5.2s intact A
    let peel = 0;
    if (t < 0.4) peel = 0;
    else if (t < 2.9) peel = inOutCubic((t - 0.4) / 2.5);
    else if (t < 3.45) peel = 1;
    else if (t < 4.95) peel = 1 - inOutCubic((t - 3.45) / 1.5);
    else peel = 0;

    g.save();
    g.scale(sc, sc);
    g.clearRect(0, 0, W, H);

    // Base layer: Scene B underneath
    g.drawImage(sceneB, 0, 0);

    if (peel <= 0.001) {
      g.drawImage(sceneA, 0, 0);
      g.restore();
      return;
    }
    if (peel >= 0.999) {
      g.restore();
      return;
    }

    // Diagonal peel fold axis from bottom-right corner (dot = -1449) to top-left corner (dot = 0)
    const nx = -0.78;
    const ny = -0.6257;
    const minD = W * nx + H * ny; // -1448.9
    const foldD = lerp(minD - 8, 24, peel);
    const tx = -ny;
    const ty = nx;

    const fx = nx * foldD;
    const fy = ny * foldD;
    const BIG = 3000;

    // 1) Draw remaining UNPEELED portion of Scene A (half-plane dot(p, n) >= foldD, i.e., top-left side)
    g.save();
    g.beginPath();
    g.moveTo(fx - tx * BIG, fy - ty * BIG);
    g.lineTo(fx + tx * BIG, fy + ty * BIG);
    g.lineTo(fx + tx * BIG + nx * BIG, fy + ty * BIG + ny * BIG);
    g.lineTo(fx - tx * BIG + nx * BIG, fy - ty * BIG + ny * BIG);
    g.closePath();
    g.clip();
    g.drawImage(sceneA, 0, 0);
    g.restore();

    // 2) Soft cast drop shadow from lifted sticker onto Scene B along the fold line
    g.save();
    g.translate(fx, fy);
    const angle = Math.atan2(ny, nx);
    g.rotate(angle);
    const shadowW = lerp(42, 130, Math.sin(peel * Math.PI));
    const shGrad = g.createLinearGradient(0, 0, -shadowW, 0);
    shGrad.addColorStop(0, 'rgba(8, 18, 16, 0.46)');
    shGrad.addColorStop(0.55, 'rgba(8, 18, 16, 0.16)');
    shGrad.addColorStop(1, 'rgba(8, 18, 16, 0)');
    g.fillStyle = shGrad;
    g.fillRect(-shadowW, -BIG, shadowW, BIG * 2);
    g.restore();

    // 3) Curled paper backing flap (exact mirror reflection of the peeled corner across the fold line)
    g.save();
    g.beginPath();
    g.moveTo(fx - tx * BIG, fy - ty * BIG);
    g.lineTo(fx + tx * BIG, fy + ty * BIG);
    g.lineTo(fx + tx * BIG + nx * BIG, fy + ty * BIG + ny * BIG);
    g.lineTo(fx - tx * BIG + nx * BIG, fy - ty * BIG + ny * BIG);
    g.closePath();
    g.clip();

    const r00 = 1 - 2 * nx * nx;
    const r01 = -2 * nx * ny;
    const r10 = -2 * nx * ny;
    const r11 = 1 - 2 * ny * ny;
    const rtx = 2 * nx * foldD;
    const rty = 2 * ny * foldD;

    g.save();
    g.transform(r00, r10, r01, r11, rtx, rty);
    g.beginPath();
    g.rect(0, 0, W, H);
    g.clip();

    // Warm off-white cylindrical-shaded paper backing
    g.save();
    g.setTransform(sc, 0, 0, sc, 0, 0);
    g.translate(fx, fy);
    g.rotate(angle);
    const curlDepth = lerp(95, 360, Math.sin(peel * Math.PI));
    const backGrad = g.createLinearGradient(0, 0, curlDepth, 0);
    backGrad.addColorStop(0.0, '#ACA190');
    backGrad.addColorStop(0.14, '#E8E1D4');
    backGrad.addColorStop(0.36, '#FBF8F1');
    backGrad.addColorStop(0.72, '#EFE9DC');
    backGrad.addColorStop(1.0, '#D8CEBE');
    g.fillStyle = backGrad;
    g.fillRect(0, -BIG, BIG, BIG * 2);

    g.restore();
    g.globalAlpha = 0.08;
    g.drawImage(sceneA, 0, 0);
    g.globalAlpha = 1;

    g.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    g.lineWidth = 4;
    g.strokeRect(2, 2, W - 4, H - 4);
    g.restore();

    g.save();
    g.translate(fx, fy);
    g.rotate(angle);
    const creaseG = g.createLinearGradient(0, 0, 28, 0);
    creaseG.addColorStop(0, 'rgba(30, 22, 16, 0.28)');
    creaseG.addColorStop(1, 'rgba(30, 22, 16, 0)');
    g.fillStyle = creaseG;
    g.fillRect(0, -BIG, 28, BIG * 2);
    g.restore();

    g.restore();
    g.restore();
  }

  frame(1.65, options);
  return { canvas, frame, period: PERIOD, hero: 1.65 };
}

// ============================================================================
// 3. paper-diorama (variant of sticker-peel, kind: motion, period: 6.0, hero: 3.0)
// 6-layer handcrafted cut-paper depth planes with directional shadow & camera push
// ============================================================================
async function buildPaperDiorama(options = {}) {
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 6.0;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const ph = (t / PERIOD) * TAU;
    const push = 0.5 - 0.5 * Math.cos(ph); // 0 -> 1 -> 0 smooth parallax push-in
    const panX = Math.sin(ph) * 28;
    const title = getCustomText(opts, 'HARBOUR DUSK');
    const sc = width / W;

    g.save();
    g.scale(sc, sc);

    // Plane 0: Warm dusk watercolor paper sky
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#D97B4A');
    sky.addColorStop(0.42, '#EEAF78');
    sky.addColorStop(0.75, '#F6DDB2');
    sky.addColorStop(1, '#E6C296');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    // Cut-paper sun disc tucked behind hills
    g.save();
    g.shadowColor = 'rgba(130, 56, 22, 0.22)';
    g.shadowBlur = 18;
    g.shadowOffsetY = 8;
    g.fillStyle = '#FFF6DF';
    g.beginPath();
    g.arc(640 - panX * 0.25, 232 - push * 14, 78 * lerp(1.0, 1.06, push), 0, TAU);
    g.fill();
    g.restore();

    const drawPaperPlane = (depth, fillCol, drawPathFn) => {
      const planeScale = 1 + push * (0.04 + depth * 0.085);
      const planeX = -panX * (0.25 + depth * 0.45);
      const planeY = push * depth * 18;
      g.save();
      g.translate(W / 2 + planeX, H * 0.58 + planeY);
      g.scale(planeScale, planeScale);
      g.translate(-W / 2, -H * 0.58);
      g.shadowColor = 'rgba(20, 15, 18, 0.34)';
      g.shadowBlur = 14 + depth * 4;
      g.shadowOffsetY = -8; // upward cast shadow onto sky/planes behind (lightbox diorama feel)
      g.fillStyle = fillCol;
      g.beginPath();
      drawPathFn(g);
      g.closePath();
      g.fill();
      // Subtle bright top paper cut edge
      g.shadowBlur = 0; g.shadowOffsetY = 0;
      g.strokeStyle = 'rgba(255, 248, 234, 0.24)';
      g.lineWidth = 1.6;
      g.stroke();
      g.restore();
    };

    // Plane 1: Far pastel mountain ridge
    drawPaperPlane(0.4, '#C68F75', (c) => {
      c.moveTo(-120, H + 80);
      c.lineTo(-120, 355);
      c.lineTo(130, 290);
      c.lineTo(340, 338);
      c.lineTo(540, 268);
      c.lineTo(780, 330);
      c.lineTo(1040, 274);
      c.lineTo(1400, 345);
      c.lineTo(1400, H + 80);
    });

    // Plane 2: Mid slate-teal terraced hills
    drawPaperPlane(0.85, '#728B8C', (c) => {
      c.moveTo(-140, H + 80);
      c.lineTo(-140, 420);
      c.quadraticCurveTo(180, 340, 460, 412);
      c.quadraticCurveTo(790, 470, 1060, 376);
      c.quadraticCurveTo(1240, 330, 1420, 398);
      c.lineTo(1420, H + 80);
    });

    // Plane 3: Terracotta harbour village silhouette
    drawPaperPlane(1.3, '#B77858', (c) => {
      c.moveTo(-140, H + 100);
      c.lineTo(-140, 475);
      const buildings = [
        [20, 445, 76], [96, 412, 64], [160, 448, 84], [244, 396, 58], [302, 434, 72],
        [835, 428, 72], [907, 386, 62], [969, 418, 74], [1043, 372, 68], [1111, 424, 96], [1207, 452, 200],
      ];
      c.lineTo(20, 475);
      for (const [bx, by, bw] of buildings) {
        c.lineTo(bx, by);
        c.lineTo(bx + bw * 0.5, by - 14);
        c.lineTo(bx + bw, by);
      }
      c.lineTo(1420, H + 100);
    });

    // Plane 4: Twilight sea & cut-paper scalloped wave band
    drawPaperPlane(1.75, '#2C5466', (c) => {
      c.moveTo(-160, H + 120);
      c.lineTo(-160, 522);
      for (let x = -160; x <= 1440; x += 80) {
        c.quadraticCurveTo(x + 40, 504 + Math.sin(x * 0.02 + ph) * 6, x + 80, 522);
      }
      c.lineTo(1440, H + 120);
    });

    // Plane 5: Foreground dark-indigo cut-paper proscenium frame & viaduct arches
    drawPaperPlane(2.3, '#1A2636', (c) => {
      c.moveTo(-160, H + 140);
      c.lineTo(-160, 586);
      c.lineTo(160, 586);
      c.lineTo(210, 540);
      c.lineTo(1070, 540);
      c.lineTo(1120, 586);
      c.lineTo(1440, 586);
      c.lineTo(1440, H + 140);
    });

    // Crisp editorial storybook caption floating cleanly in upper dusk sky
    g.save();
    g.fillStyle = '#332018';
    g.font = `700 13px ${MONO}`;
    g.textAlign = 'center';
    g.fillText('CUT-PAPER DIORAMA  ·  6 DEPTH PLANES', W * 0.5, 92);
    g.font = `400 72px ${SERIF}`;
    g.fillText(title, W * 0.5, 146);
    g.restore();

    // Foreground framing paper vignette arch (pushing outward as camera enters diorama)
    const archScale = 1 + push * 0.16;
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(archScale, archScale);
    g.translate(-W / 2, -H / 2);
    g.shadowColor = 'rgba(8, 10, 16, 0.45)';
    g.shadowBlur = 24;
    g.fillStyle = '#141B26';
    g.beginPath();
    g.rect(-120, -120, W + 240, H + 240);
    rrect(g, 36, 36, W - 72, H - 72, 42);
    g.fill('evenodd');
    g.restore();

    g.restore();
  }

  frame(3.0, options);
  return { canvas, frame, period: PERIOD, hero: 3.0 };
}

// ============================================================================
// 4. kinetic-shutter (lead, kind: type, period: 5.4, hero: 1.35)
// Staggered horizontal color-shutter slats sweeping cleanly across typography
// ============================================================================
async function buildKineticShutter(options = {}) {
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 5.4;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  const BANDS = 7;
  const ACCENTS = ['#FF4D2E', '#FFD400', '#38BDF8', '#FF90E8', '#34D399', '#A855F7', '#FF4D2E'];

  function drawSlide(ctx, mode, customWord) {
    const isAlt = mode === 1;
    ctx.fillStyle = isAlt ? '#F5F2EA' : '#0E0E12';
    ctx.fillRect(0, 0, W, H);

    // Subtle graphic accent rule
    ctx.fillStyle = isAlt ? '#FF4D2E' : '#FFD400';
    ctx.fillRect(96, 118, 92, 8);

    ctx.fillStyle = isAlt ? '#57534E' : '#94A3B8';
    ctx.font = `700 17px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(isAlt ? '02 // POLARITY SWITCH · 7-BLADE SHUTTER' : '01 // KINETIC SHUTTER BANDS', 96, 162);

    const headline = isAlt ? (customWord || 'SHARP CUT').toUpperCase() : (customWord || 'FAST FRAME').toUpperCase();
    let fSize = headline.length > 10 ? 114 : 154;
    ctx.font = `900 ${fSize}px ${SANS}`;
    while (ctx.measureText(headline).width > W - 180 && fSize > 56) {
      fSize -= 6;
      ctx.font = `900 ${fSize}px ${SANS}`;
    }
    ctx.fillStyle = isAlt ? '#0E0E12' : '#F8FAFC';
    ctx.fillText(headline, 92, 372);

    ctx.fillStyle = isAlt ? '#FF4D2E' : '#38BDF8';
    ctx.font = `700 28px ${SANS}`;
    ctx.fillText(isAlt ? 'Staggered blades swap colour and copy on beat.' : 'Velocity-lagged slats sweep cleanly edge to edge.', 96, 512);
  }

  const buf0 = document.createElement('canvas'); buf0.width = W; buf0.height = H;
  const buf1 = document.createElement('canvas'); buf1.width = W; buf1.height = H;
  let cachedW = null;

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const customWord = getCustomText(opts, '');
    if (customWord !== cachedW) {
      drawSlide(buf0.getContext('2d'), 0, customWord);
      drawSlide(buf1.getContext('2d'), 1, customWord);
      cachedW = customWord;
    }

    const sc = width / W;
    g.save();
    g.clearRect(0, 0, width, height);
    g.scale(sc, sc);

    // Wipe 1 (0.55..2.05s): Slide 0 -> Slide 1 (left-to-right); Wipe 2 (3.25..4.75s): Slide 1 -> Slide 0 (right-to-left)
    const isSecond = t >= 2.7;
    const localT = isSecond ? t - 2.7 : t;
    const fromBuf = isSecond ? buf1 : buf0;
    const toBuf = isSecond ? buf0 : buf1;
    const dir = isSecond ? -1 : 1;

    for (let i = 0; i < BANDS; i++) {
      const y0 = Math.round((i * H) / BANDS);
      const y1 = Math.round(((i + 1) * H) / BANDS);
      const bandH = y1 - y0;
      const delay = 0.55 + (isSecond ? (BANDS - 1 - i) : i) * 0.085;
      const p = smooth(delay, delay + 0.92, localT);

      const bladeW = 240;
      const head = lerp(-bladeW, W + bladeW, p);
      const xHead = Math.round(dir > 0 ? head : W - head);

      g.save();
      g.beginPath();
      g.rect(0, y0, W, bandH);
      g.clip();

      if (dir > 0) {
        g.drawImage(toBuf, 0, y0, W, bandH, 0, y0, W, bandH);
        const remX = clamp(xHead, 0, W);
        if (remX < W) {
          g.drawImage(fromBuf, remX, y0, W - remX, bandH, remX, y0, W - remX, bandH);
        }
        if (p > 0.005 && p < 0.995) {
          g.fillStyle = ACCENTS[i % ACCENTS.length];
          g.fillRect(xHead - bladeW, y0, bladeW, bandH);
        }
      } else {
        g.drawImage(toBuf, 0, y0, W, bandH, 0, y0, W, bandH);
        const remW = clamp(xHead, 0, W);
        if (remW > 0) {
          g.drawImage(fromBuf, 0, y0, remW, bandH, 0, y0, remW, bandH);
        }
        if (p > 0.005 && p < 0.995) {
          g.fillStyle = ACCENTS[i % ACCENTS.length];
          g.fillRect(xHead, y0, bladeW, bandH);
        }
      }
      g.restore();
    }
    g.restore();
  }

  frame(1.35, options);
  return { canvas, frame, period: PERIOD, hero: 1.35 };
}

// ============================================================================
// 5. split-slot-type (variant of kinetic-shutter, kind: type, period: 5.4, hero: 2.65)
// Sliced headline recoils open to reveal a spinning vertical verb slot-reel
// ============================================================================
async function buildSplitSlotType(options = {}) {
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 5.4;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const sc = width / W;
    const customVerb = getCustomText(opts, 'SHIP');
    const verbs = ['DESIGN', 'SCRIPT', 'RENDER', 'VERIFY', customVerb.toUpperCase().slice(0, 12)];

    g.save();
    g.scale(sc, sc);

    // Rich charcoal editorial backdrop
    g.fillStyle = '#0D0E13';
    g.fillRect(0, 0, W, H);

    // Subtle horizontal drafting rules
    g.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(80, 120); g.lineTo(W - 80, 120);
    g.moveTo(80, H - 120); g.lineTo(W - 80, H - 120);
    g.stroke();

    // Split opening amount: closed -> springs apart (0.45..1.4s) -> holds open while slot spins (1.4..4.2s) -> snaps shut
    let split = 0;
    if (t < 0.45) split = 0;
    else if (t < 1.35) split = spring((t - 0.45) / 0.9, 0.58, 15);
    else if (t < 4.25) split = 1;
    else if (t < 5.05) split = 1 - inOutCubic((t - 4.25) / 0.8);
    else split = 0;

    const gap = split * 116;
    const midY = H * 0.5;

    // Draw the vertical slot-machine aperture revealed inside the split gap
    if (gap > 2) {
      g.save();
      const slotH = gap * 1.48;
      g.beginPath();
      g.rect(140, midY - slotH / 2, W - 280, slotH);
      g.clip();

      // Vivid accent slot chamber
      const sg = g.createLinearGradient(0, midY - slotH / 2, 0, midY + slotH / 2);
      sg.addColorStop(0, '#D93B1E');
      sg.addColorStop(0.5, '#FF5A36');
      sg.addColorStop(1, '#D93B1E');
      g.fillStyle = sg;
      g.fillRect(140, midY - slotH / 2, W - 280, slotH);

      // Spinning slot index with realistic fast roll + damped detent brake onto final verb
      const spinU = smooth(0.85, 3.05, t);
      const brakeOvershoot = t > 2.85 ? Math.sin(clamp((t - 2.85) / 0.6) * Math.PI) * 0.08 * Math.exp(-(t - 2.85) * 4) : 0;
      const reelPos = (verbs.length - 1 + 4) * outCubic(spinU) + brakeOvershoot;
      const itemStep = 132;

      g.fillStyle = '#FFF9F0';
      g.font = `900 108px ${SANS}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (let k = -2; k <= 10; k++) {
        const y = midY + (k - reelPos) * itemStep;
        if (y < midY - slotH - 80 || y > midY + slotH + 80) continue;
        const word = verbs[((k % verbs.length) + verbs.length) % verbs.length];
        g.fillText(word, W * 0.5, y);
      }

      // Top & bottom drum shading inside slot aperture
      const topShade = g.createLinearGradient(0, midY - slotH / 2, 0, midY - slotH / 2 + 28);
      topShade.addColorStop(0, 'rgba(0,0,0,0.45)');
      topShade.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = topShade;
      g.fillRect(140, midY - slotH / 2, W - 280, 28);

      const botShade = g.createLinearGradient(0, midY + slotH / 2 - 28, 0, midY + slotH / 2);
      botShade.addColorStop(0, 'rgba(0,0,0,0)');
      botShade.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = botShade;
      g.fillRect(140, midY + slotH / 2 - 28, W - 280, 28);
      g.restore();
    }

    // Sliced giant headline halves ("MOTION CODE") recoiling up & down
    const drawHalf = (isTop) => {
      g.save();
      const shiftY = isTop ? -gap * 0.74 : gap * 0.74;
      g.translate(0, shiftY);
      g.beginPath();
      if (isTop) g.rect(0, 0, W, midY);
      else g.rect(0, midY, W, H - midY);
      g.clip();
      g.fillStyle = '#F8FAFC';
      g.font = `900 156px ${SANS}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('MOTION CODE', W * 0.5, midY);
      g.restore();
    };
    drawHalf(true);
    drawHalf(false);

    // Header & Footer metadata
    g.fillStyle = '#94A3B8';
    g.font = `700 14px ${MONO}`;
    g.textAlign = 'left';
    g.fillText('SPLIT-SLOT KINETIC TYPE  ·  DETENT REEL', 84, 86);
    g.textAlign = 'right';
    g.fillStyle = '#FF5A36';
    g.fillText(`ACTIVE VERB // ${verbs[verbs.length - 1]}`, W - 84, 86);
    g.restore();
  }

  frame(2.65, options);
  return { canvas, frame, period: PERIOD, hero: 2.65 };
}

// ============================================================================
// 6. corner-brackets (variant of kinetic-shutter, kind: type, period: 5.8, hero: 2.85)
// Four architectural L-brackets glide with spring dynamics & live telemetry lock
// ============================================================================
async function buildCornerBrackets(options = {}) {
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 5.8;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  const TARGETS = [
    { x: 112, y: 158, w: 392, h: 256, code: '01 · ENGINE', val: '4.0 ms', sub: 'ANGLE Metal GPU capture', accent: '#38BDF8' },
    { x: 564, y: 140, w: 604, h: 242, code: '02 · VERIFY', val: '0 DIFF', sub: 'Dual-browser pixel parity', accent: '#FF4D2E' },
    { x: 356, y: 446, w: 568, h: 176, code: '03 · DELIVER', val: '-14 LUFS', sub: 'BT.709 tagged master MP4', accent: '#34D399' },
  ];

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const sc = width / W;
    const customLabel = getCustomText(opts, '');

    g.save();
    g.scale(sc, sc);

    // Matte dark studio grid
    g.fillStyle = '#090B10';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    g.lineWidth = 1;
    for (let x = 64; x < W; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 64; y < H; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

    // Determine active segment & spring interpolation between targets (0 -> 1 -> 2 -> 0)
    const segDur = PERIOD / 3;
    const segIdx = Math.floor(t / segDur) % 3;
    const segLocal = t - segIdx * segDur;
    const prev = TARGETS[segIdx];
    const next = TARGETS[(segIdx + 1) % 3];
    const moveP = segLocal < 0.72 ? clamp(spring(segLocal / 0.72, 0.68, 17), 0, 1.08) : 1;
    const fromT = TARGETS[(segIdx + 2) % 3];
    const cur = {
      x: lerp(fromT.x, prev.x, moveP),
      y: lerp(fromT.y, prev.y, moveP),
      w: lerp(fromT.w, prev.w, moveP),
      h: lerp(fromT.h, prev.h, moveP),
    };
    const lockFlash = segLocal >= 0.42 && segLocal < 0.92 ? Math.exp(-(segLocal - 0.42) * 8) : 0;

    // Draw the 3 target panels
    TARGETS.forEach((card, idx) => {
      const isFocused = idx === segIdx;
      const focusAmt = isFocused ? smooth(0.18, 0.55, segLocal) : 0;
      g.save();
      rrect(g, card.x, card.y, card.w, card.h, 16);
      g.fillStyle = isFocused ? '#131826' : '#0E121C';
      g.fill();
      g.strokeStyle = isFocused ? `rgba(255,255,255,${lerp(0.12, 0.34, focusAmt).toFixed(3)})` : 'rgba(255,255,255,0.08)';
      g.lineWidth = 1.5;
      g.stroke();

      g.fillStyle = isFocused ? card.accent : '#64748B';
      g.font = `700 14px ${MONO}`;
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillText(card.code, card.x + 28, card.y + 26);

      g.fillStyle = isFocused ? '#F8FAFC' : '#94A3B8';
      g.font = `900 ${card.h > 200 ? 74 : 58}px ${SANS}`;
      const displayVal = idx === 1 && customLabel ? customLabel.toUpperCase().slice(0, 10) : card.val;
      g.fillText(displayVal, card.x + 28, card.y + (card.h > 200 ? 68 : 54));

      g.fillStyle = isFocused ? '#CBD5E1' : '#64748B';
      g.font = `500 18px ${SANS}`;
      g.fillText(card.sub, card.x + 28, card.y + card.h - 46);
      g.restore();
    });

    // Draw precision gliding 4-corner L-brackets around interpolated bounding box
    const pad = 16;
    const bx = cur.x - pad;
    const by = cur.y - pad;
    const bw = cur.w + pad * 2;
    const bh = cur.h + pad * 2;
    const arm = 34;

    g.save();
    // Subtle luminous lock fill flash
    if (lockFlash > 0.01) {
      g.fillStyle = `rgba(255, 255, 255, ${(0.09 * lockFlash).toFixed(3)})`;
      rrect(g, bx, by, bw, bh, 18);
      g.fill();
    }

    g.strokeStyle = prev.accent;
    g.lineWidth = 4.5;
    g.lineCap = 'square';
    g.shadowColor = prev.accent;
    g.shadowBlur = 18;

    const corners = [
      [bx, by, 1, 1],
      [bx + bw, by, -1, 1],
      [bx, by + bh, 1, -1],
      [bx + bw, by + bh, -1, -1],
    ];
    for (const [cx, cy, dx, dy] of corners) {
      g.beginPath();
      g.moveTo(cx, cy + dy * arm);
      g.lineTo(cx, cy);
      g.lineTo(cx + dx * arm, cy);
      g.stroke();
    }

    // Center autofocus crosshair reticle on lock
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 1.5;
    const rcx = bx + bw / 2, rcy = by + bh / 2;
    g.beginPath();
    g.moveTo(rcx - 10, rcy); g.lineTo(rcx + 10, rcy);
    g.moveTo(rcx, rcy - 10); g.lineTo(rcx, rcy + 10);
    g.stroke();

    // Live bounding-box coordinate telemetry tag
    rrect(g, bx, by - 36, 268, 26, 6);
    g.fillStyle = prev.accent;
    g.fill();
    g.fillStyle = '#090B10';
    g.font = `700 12px ${MONO}`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(`AF LOCK  X:${Math.round(bx)} Y:${Math.round(by)}  ${Math.round(bw)}×${Math.round(bh)}`, bx + 12, by - 23);
    g.restore();

    // Top bar status
    g.fillStyle = '#94A3B8';
    g.font = `700 13px ${MONO}`;
    g.textAlign = 'left';
    g.fillText('CORNER VIEWFINDER BRACKETS  ·  SPRING TRACKING', 64, 48);
    g.textAlign = 'right';
    g.fillText(`TARGET 0${segIdx + 1} / 03`, W - 64, 48);
    g.restore();
  }

  frame(2.85, options);
  return { canvas, frame, period: PERIOD, hero: 2.85 };
}

export async function create(id, options = {}) {
  if (id === 'particle-dissolve') return buildParticleDissolve(options);
  if (id === 'sticker-peel') return buildStickerPeel(options);
  if (id === 'paper-diorama') return buildPaperDiorama(options);
  if (id === 'kinetic-shutter') return buildKineticShutter(options);
  if (id === 'split-slot-type') return buildSplitSlotType(options);
  if (id === 'corner-brackets') return buildCornerBrackets(options);
  throw new Error(`Unknown tactile effect id: ${id}`);
}
