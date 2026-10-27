// Sumi-e Ink & Sakuga Impact Pack (0BSD).
// Pure deterministic frame(t) implementations at 1280x720 (16:9).

const W = 1280;
const H = 720;
const TAU = Math.PI * 2;
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const lin = (a, b, x) => clamp((x - a) / (b - a));
const smooth = (a, b, x) => {
  const k = lin(a, b, x);
  return k * k * (3 - 2 * k);
};
const outCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
const outQuart = (x) => 1 - Math.pow(1 - clamp(x), 4);

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

// Pre-rendered warm fibrous Xuan paper (#F3EFE4) for crisp zero-allocation playback
let cachedXuanPaper = null;
function getXuanPaper() {
  if (cachedXuanPaper) return cachedXuanPaper;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  const base = g.createRadialGradient(W * 0.48, H * 0.46, 60, W * 0.5, H * 0.5, W * 0.82);
  base.addColorStop(0, '#F7F3E8');
  base.addColorStop(0.68, '#F3EFE4');
  base.addColorStop(1, '#E5DEC9');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  // Laid bamboo-screen horizontal lines
  g.strokeStyle = 'rgba(138, 124, 98, 0.045)';
  g.lineWidth = 1;
  for (let y = 3; y < H; y += 6) {
    g.beginPath();
    g.moveTo(0, y + 0.5);
    g.lineTo(W, y + 0.5);
    g.stroke();
  }

  // Organic mulberry bark fibers embedded in Xuan paper
  for (let i = 0; i < 3200; i++) {
    const x = hash(i * 1.73) * W;
    const y = hash(i * 3.19 + 4) * H;
    const len = 4 + hash(i * 7.11) * 16;
    const a = hash(i * 5.37) * TAU;
    const cx = x + Math.cos(a) * len * 0.5 + (hash(i * 2.1) - 0.5) * 4;
    const cy = y + Math.sin(a) * len * 0.5 + (hash(i * 9.2) - 0.5) * 4;
    g.strokeStyle = i % 5 === 0 ? 'rgba(122, 104, 78, 0.08)' : 'rgba(255, 255, 255, 0.26)';
    g.lineWidth = 0.7 + hash(i * 4.4) * 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(cx, cy, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }

  cachedXuanPaper = c;
  return c;
}

// ============================================================================
// 1. ink-slash (lead, period: 4.8, hero: 1.55)
// ============================================================================
function buildInkSlash(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const PERIOD = 4.8;
  const paper = getXuanPaper();

  // Sweeping calligraphy slash spine: poised upper-right -> cuts through center -> whips out bottom-left
  function slashSpine(u) {
    const p0 = { x: 1086, y: 132 };
    const p1 = { x: 760, y: 204 };
    const p2 = { x: 512, y: 526 };
    const p3 = { x: 146, y: 584 };
    const v = 1 - u;
    const x = v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x;
    const y = v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y;
    const dx = 3 * v * v * (p1.x - p0.x) + 6 * v * u * (p2.x - p1.x) + 3 * u * u * (p3.x - p2.x);
    const dy = 3 * v * v * (p1.y - p0.y) + 6 * v * u * (p2.y - p1.y) + 3 * u * u * (p3.y - p2.y);
    const len = Math.hypot(dx, dy) || 1;
    return { x, y, tx: dx / len, ty: dy / len, nx: -dy / len, ny: dx / len };
  }

  // Secondary cross counter-flick stroke for dramatic swordsmanship composition
  function counterSpine(u) {
    const p0 = { x: 342, y: 214 };
    const p1 = { x: 584, y: 348 };
    const p2 = { x: 896, y: 492 };
    const v = 1 - u;
    const x = v * v * p0.x + 2 * v * u * p1.x + u * u * p2.x;
    const y = v * v * p0.y + 2 * v * u * p1.y + u * u * p2.y;
    const dx = 2 * v * (p1.x - p0.x) + 2 * u * (p2.x - p1.x);
    const dy = 2 * v * (p1.y - p0.y) + 2 * u * (p2.y - p1.y);
    const len = Math.hypot(dx, dy) || 1;
    return { x, y, tx: dx / len, ty: dy / len, nx: -dy / len, ny: dx / len };
  }

  // Pre-seeded 44 horsehair bristles for Feibai (dry-brush split)
  const bristles = Array.from({ length: 44 }, (_, i) => ({
    offset: (i / 43) * 2 - 1, // -1 .. +1 across brush belly
    splay: (hash(i * 3.7 + 1) - 0.5) * 0.55,
    dryThreshold: 0.36 + hash(i * 7.9) * 0.58,
    freq: 14 + hash(i * 5.3) * 22,
    phase: hash(i * 11.1) * TAU,
    weight: 1.4 + hash(i * 2.3) * 2.8,
  }));

  // Pre-seeded ballistic ink splatter droplets
  const droplets = Array.from({ length: 78 }, (_, i) => {
    const uOrigin = 0.12 + hash(i * 4.3) * 0.82;
    const sp = slashSpine(uOrigin);
    const side = hash(i * 8.1) > 0.48 ? 1 : -1;
    const spread = 0.25 + hash(i * 2.9) * 0.95;
    const dirX = sp.tx * 0.72 + sp.nx * side * spread;
    const dirY = sp.ty * 0.72 + sp.ny * side * spread;
    const dLen = Math.hypot(dirX, dirY) || 1;
    return {
      x0: sp.x + sp.nx * (hash(i * 6.7) - 0.5) * 34,
      y0: sp.y + sp.ny * (hash(i * 5.1) - 0.5) * 34,
      dx: dirX / dLen,
      dy: dirY / dLen,
      dist: 36 + Math.pow(hash(i * 9.4), 1.6) * 240,
      r: 1.8 + Math.pow(hash(i * 12.7), 2.2) * 11.5,
      elong: 1.0 + hash(i * 3.3) * 2.6,
      delay: uOrigin * 0.14,
    };
  });

  function drawFeibaiStroke(ctx, spineFn, prog, maxHalfWidth) {
    if (prog <= 0.005) return;
    const SAMPLES = 96;
    const maxStep = Math.max(2, Math.floor(SAMPLES * prog));

    // 1. Subtle wet Nijimi (water absorbency halo) on entry third of stroke
    ctx.save();
    ctx.beginPath();
    for (let s = 0; s <= Math.min(maxStep, 52); s++) {
      const u = s / SAMPLES;
      const pt = spineFn(u);
      const w = maxHalfWidth * 1.18 * Math.sin(Math.min(1, u * 1.8) * Math.PI * 0.75) * (1 - u * 0.65);
      if (s === 0) ctx.moveTo(pt.x + pt.nx * w, pt.y + pt.ny * w);
      else ctx.lineTo(pt.x + pt.nx * w, pt.y + pt.ny * w);
    }
    for (let s = Math.min(maxStep, 52); s >= 0; s--) {
      const u = s / SAMPLES;
      const pt = spineFn(u);
      const w = maxHalfWidth * 1.18 * Math.sin(Math.min(1, u * 1.8) * Math.PI * 0.75) * (1 - u * 0.65);
      ctx.lineTo(pt.x - pt.nx * w, pt.y - pt.ny * w);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(38, 36, 42, 0.14)';
    ctx.fill();

    // 2. Multi-bristle Sumi ink + Feibai dry-brush white fiber skips
    for (const b of bristles) {
      ctx.beginPath();
      let penDown = false;
      for (let s = 0; s <= maxStep; s++) {
        const u = s / SAMPLES;
        const pt = spineFn(u);
        // Brush pressure envelope: bold press -> swift belly -> splayed dry whip
        const entryTaper = smooth(0.0, 0.07, u);
        const belly = 0.35 + 0.65 * Math.pow(1 - u, 0.55);
        const splayExpand = 1 + Math.pow(u, 1.8) * 0.85;
        const offsetPx = (b.offset + b.splay * Math.pow(u, 1.5)) * maxHalfWidth * entryTaper * belly * splayExpand;

        // Feibai dry-paper skip condition in high-velocity tail
        const paperTooth = 0.5 + 0.5 * Math.sin(u * b.freq + b.phase) * Math.cos(u * 37 + b.phase);
        const dryFactor = u * (0.55 + 0.45 * Math.abs(b.offset));
        const hasInk = dryFactor < b.dryThreshold || paperTooth > (dryFactor - b.dryThreshold) * 1.65;

        const px = pt.x + pt.nx * offsetPx;
        const py = pt.y + pt.ny * offsetPx;
        if (hasInk) {
          if (!penDown) {
            ctx.moveTo(px, py);
            penDown = true;
          } else {
            ctx.lineTo(px, py);
          }
        } else {
          penDown = false;
        }
      }
      const inkAlpha = 0.78 + 0.22 * (1 - Math.abs(b.offset));
      ctx.strokeStyle = `rgba(17, 16, 20, ${inkAlpha.toFixed(3)})`;
      ctx.lineWidth = b.weight * (maxHalfWidth / 34);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnsoShockwave(ctx, cx, cy, u) {
    if (u <= 0) return;
    const expand = outQuart(clamp(u / 1.55));
    const fade = 1 - smooth(1.15, 2.65, u);
    if (fade <= 0.01) return;

    const R = 64 + expand * 218;
    ctx.save();
    ctx.globalAlpha = fade;
    // Multi-strand incomplete Enso ring
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      const aStart = -0.65 + k * 0.04;
      const aSpan = TAU * 0.84 * clamp(u * 4.2, 0, 1);
      for (let i = 0; i <= 64; i++) {
        const f = i / 64;
        const a = aStart + f * aSpan;
        const rad = R + k * (4.2 * (1 - f * 0.65)) + Math.sin(f * 17 + k) * 2.4;
        const px = cx + Math.cos(a) * rad * 1.06;
        const py = cy + Math.sin(a) * rad * 0.94;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = Math.abs(k) >= 3 ? 'rgba(28, 26, 32, 0.26)' : 'rgba(18, 17, 22, 0.52)';
      ctx.lineWidth = (4.8 - Math.abs(k) * 0.8) * (1 - 0.45 * expand);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  // Carved Cinnabar Red Seal Stamp (\u5370 = seal) rendered via crisp carved vector seal strokes
  function drawCinnabarSeal(ctx, x, y, size, slamU) {
    if (slamU <= 0) return;
    const drop = slamU < 0.08 ? lerp(1.65, 1.0, outCubic(slamU / 0.08)) : 1.0;
    const alpha = clamp(slamU * 14);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.045);
    ctx.scale(drop, drop);
    ctx.globalAlpha = alpha;

    const hs = size / 2;
    // Cinnabar vermilion ink block (#C4281C) with weathered rounded corners
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-hs, -hs, size, size, 6);
    else ctx.rect(-hs, -hs, size, size);
    ctx.fillStyle = '#C4281C';
    ctx.fill();

    // Inner carved white border + authentic seal-script glyph strokes for \u5370 (Yin / Seal)
    ctx.strokeStyle = '#F3EFE4';
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.lineWidth = 3.2;
    ctx.strokeRect(-hs + 6.5, -hs + 6.5, size - 13, size - 13);

    // Traditional Zhuwen/Baiwen carved seal-script strokes inside stamp
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    // Left radical of \u5370
    ctx.moveTo(-6, -21);
    ctx.lineTo(-22, -21);
    ctx.lineTo(-22, 20);
    ctx.moveTo(-22, -2);
    ctx.lineTo(-6, -2);
    ctx.moveTo(-22, 18);
    ctx.lineTo(-5, 14);
    // Right kneeling seal radical of \u5370
    ctx.moveTo(5, -20);
    ctx.lineTo(22, -20);
    ctx.lineTo(22, 6);
    ctx.lineTo(12, 6);
    ctx.moveTo(6, -20);
    ctx.lineTo(6, 24);
    ctx.stroke();

    // Stone-carved weathering flecks in Xuan paper tone
    ctx.fillStyle = '#F3EFE4';
    for (let i = 0; i < 18; i++) {
      const fx = (hash(i * 7.1) - 0.5) * (size - 8);
      const fy = (hash(i * 3.9 + 2) - 0.5) * (size - 8);
      ctx.fillRect(fx, fy, 1.8 + hash(i) * 2.5, 1.5 + hash(i * 2) * 2);
    }

    ctx.restore();
  }

  function frame(time) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);

    // Hit-stop & 1.0x -> 1.35x camera punch choreography!
    const tSlash = 0.96;
    const tImpact = 1.08;
    const anticipation = smooth(0.18, 0.94, t) * (1 - smooth(0.94, 1.02, t));

    // Hit-stop zoom punch: spikes cleanly to 1.35x on impact (1.08..1.16s), decays smoothly across hero=1.55s!
    let punchZoom = 1.0 - 0.04 * anticipation;
    if (t >= tImpact) {
      const uImp = t - tImpact;
      // Hold near 1.35x during the 3-frame hit-stop window (0..0.06s), then smooth exponential settle
      const hitHold = uImp < 0.06 ? 1.0 : Math.exp(-(uImp - 0.06) * 2.4);
      const fadeBack = 1 - smooth(3.85, 4.65, t);
      punchZoom = 1.0 + 0.35 * hitHold * fadeBack;
    }

    const shakeEnv = t >= tImpact ? Math.exp(-(t - tImpact) * 11) : 0;
    const sx = shakeEnv * 14 * Math.sin((t - tImpact) * 68);
    const sy = shakeEnv * 9 * Math.cos((t - tImpact) * 54);

    // Apply camera transform around slash nexus (612, 376)
    g.save();
    const pivX = 612, pivY = 376;
    g.translate(pivX + sx, pivY + sy);
    g.scale(punchZoom, punchZoom);
    g.translate(-pivX, -pivY);

    // Draw oversized Xuan paper so 0.96x anticipation & shake never expose borders
    g.drawImage(paper, -90, -60, W + 180, H + 120);

    const washFade = 1 - smooth(4.20, 4.72, t);
    g.globalAlpha = washFade;

    // Coiled pre-slash ink tension line during anticipation (0.25..0.98s)
    if (t > 0.20 && t < 1.05) {
      const coil = smooth(0.20, 0.88, t) * (1 - smooth(0.96, 1.05, t));
      g.save();
      g.globalAlpha *= coil * 0.55;
      g.beginPath();
      g.arc(1086, 132, 10 + 8 * Math.sin(t * 14), 0, TAU);
      g.fillStyle = '#141318';
      g.fill();
      g.restore();
    }

    // 1. Expanding Enso Ink Shockwave Ring
    drawEnsoShockwave(g, 612, 376, t - tImpact);

    // 2. Primary Feibai Dry-Brush Calligraphy Slash + Secondary Cross-Flick
    const mainProg = outQuart(lin(tSlash, tSlash + 0.19, t));
    const crossProg = outQuart(lin(tImpact + 0.05, tImpact + 0.22, t));
    drawFeibaiStroke(g, slashSpine, mainProg, 42);
    drawFeibaiStroke(g, counterSpine, crossProg, 22);

    // 3. Ballistic Sumi Ink Splatter Droplets
    if (t >= tSlash + 0.03) {
      for (const d of droplets) {
        const u = t - (tSlash + d.delay);
        if (u <= 0) continue;
        const fly = 1 - Math.exp(-u * 13);
        const px = d.x0 + d.dx * d.dist * fly;
        const py = d.y0 + d.dy * d.dist * fly;
        const ang = Math.atan2(d.dy, d.dx);

        g.save();
        g.translate(px, py);
        g.rotate(ang);
        // Subtle wet absorbency halo on larger blots
        if (d.r > 5.5) {
          g.beginPath();
          g.ellipse(0, 0, d.r * d.elong * 1.24, d.r * 1.24, 0, 0, TAU);
          g.fillStyle = 'rgba(42, 40, 46, 0.18)';
          g.fill();
        }
        g.beginPath();
        g.ellipse(0, 0, d.r * d.elong, d.r, 0, 0, TAU);
        g.fillStyle = '#141318';
        g.fill();
        g.restore();
      }
    }

    // 4. Cinnabar Red Seal Stamp (\u5370) slams onto lower-right corner at t = 1.32s (crisp at hero = 1.55s!)
    drawCinnabarSeal(g, 1068, 554, 78, t - 1.32);

    g.restore();
    g.restore();
  }

  return { canvas, ready: Promise.resolve(), frame };
}

// ============================================================================
// 2. ink-impact-frame (variant, period: 4.4, hero: 1.32)
// ============================================================================
function buildInkImpactFrame(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const PERIOD = 4.4;

  const CX = 588;
  const CY = 344;

  // Pre-seeded 96 radial speed wedges for binary Sakuga impact frames
  const wedges = Array.from({ length: 96 }, (_, i) => ({
    angle: (i / 96) * TAU + (hash(i * 3.1) - 0.5) * 0.04,
    rInner: 48 + Math.pow(hash(i * 7.7), 1.5) * 210,
    halfSpread: 0.004 + hash(i * 5.3) * 0.022,
    major: i % 5 === 0,
  }));

  // Pre-seeded 11 branching Sakuga Inazuma (lightning) bolts
  const bolts = Array.from({ length: 11 }, (_, b) => {
    const baseA = (b / 11) * TAU + 0.18;
    const pts = [];
    for (let s = 0; s <= 12; s++) {
      const r = 24 + s * 78;
      const jitterA = baseA + (hash(b * 19.3 + s * 4.7) - 0.5) * 0.28;
      pts.push({ x: CX + Math.cos(jitterA) * r, y: CY + Math.sin(jitterA) * r, w: (13 - s) * 1.45 });
    }
    return pts;
  });

  // Pre-seeded 54 ballistic debris shards for post-impact aftermath
  const shards = Array.from({ length: 54 }, (_, i) => {
    const a = hash(i * 2.7 + 1) * TAU;
    const sp = 240 + hash(i * 8.9) * 680;
    return {
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp * 0.78 - 140,
      size: 5 + Math.pow(hash(i * 6.1), 1.8) * 24,
      rot0: hash(i * 3.9) * TAU,
      vrot: (hash(i * 11.3) - 0.5) * 14,
      hot: i % 4 === 0,
    };
  });

  function drawBolt(ctx, pts, color, scaleW = 1) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.lineWidth = Math.max(1.5, pts[i].w * scaleW);
      ctx.stroke();
    }
    ctx.restore();
  }

  function frame(time) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);

    const T_HIT = 1.18;
    const T_FLASH_END = 1.50;

    // ------------------------------------------------------------------------
    // PHASE 2: 3-Frame High-Contrast Binary Sakuga Impact Sequence (1.18..1.50s)
    // Includes hero = 1.32s right in the iconic Stark-White / Pitch-Black flash!
    // ------------------------------------------------------------------------
    if (t >= T_HIT && t < T_FLASH_END) {
      // Sub-frame A (1.18..1.25): White-on-Black
      // Sub-frame B (1.25..1.40, HERO=1.32!): Black-on-Stark-White + Chromatic Shock Ring!
      // Sub-frame C (1.40..1.50): White-on-Black wide shock inversion
      const invertedWhiteGround = t >= 1.25 && t < 1.40;
      const bgCol = invertedWhiteGround ? '#FAF8F2' : '#060609';
      const inkCol = invertedWhiteGround ? '#07070B' : '#FAF8F2';

      g.fillStyle = bgCol;
      g.fillRect(0, 0, W, H);

      const uHit = (t - T_HIT) / (T_FLASH_END - T_HIT);

      // Chromatic Aberration Shockwave Ring expanding out from epicenter!
      const shockR = 115 + uHit * 390;
      g.save();
      // Red/Magenta outer chromatic channel
      g.beginPath();
      g.arc(CX - 7, CY - 3, shockR + 10, 0, TAU);
      g.strokeStyle = invertedWhiteGround ? 'rgba(255, 24, 76, 0.88)' : 'rgba(255, 42, 92, 0.92)';
      g.lineWidth = 14 * (1 - uHit * 0.35);
      g.stroke();

      // Cyan inner chromatic channel
      g.beginPath();
      g.arc(CX + 7, CY + 3, Math.max(10, shockR - 10), 0, TAU);
      g.strokeStyle = invertedWhiteGround ? 'rgba(0, 198, 255, 0.88)' : 'rgba(0, 240, 255, 0.92)';
      g.lineWidth = 12 * (1 - uHit * 0.35);
      g.stroke();

      // Binary core contrast ring
      g.beginPath();
      g.arc(CX, CY, shockR, 0, TAU);
      g.strokeStyle = inkCol;
      g.lineWidth = 6;
      g.stroke();
      g.restore();

      // Razor-sharp Radial Sakuga Speed-Line Wedges
      g.fillStyle = inkCol;
      for (const w of wedges) {
        const rIn = w.rInner * (0.78 + 0.45 * uHit);
        const rOut = 980;
        const spread = w.halfSpread * (w.major ? 1.55 : 0.9);
        g.beginPath();
        g.moveTo(CX + Math.cos(w.angle) * rIn, CY + Math.sin(w.angle) * rIn);
        g.lineTo(CX + Math.cos(w.angle - spread) * rOut, CY + Math.sin(w.angle - spread) * rOut);
        g.lineTo(CX + Math.cos(w.angle + spread) * rOut, CY + Math.sin(w.angle + spread) * rOut);
        g.closePath();
        g.fill();
      }

      // Jagged Radial Inazuma Lightning Bolts (outlined for stark binary legibility)
      for (let bi = 0; bi < bolts.length; bi++) {
        if (bi % 2 === (invertedWhiteGround ? 0 : 1) || bi < 6) {
          drawBolt(g, bolts[bi], bgCol, 1.55);
          drawBolt(g, bolts[bi], inkCol, 0.95);
        }
      }

      // Epicenter Sakuga Starburst Singularity Core
      g.beginPath();
      const spikes = 18;
      for (let s = 0; s < spikes * 2; s++) {
        const a = (s / (spikes * 2)) * TAU + uHit * 0.6;
        const r = s % 2 === 0 ? 96 + (s % 4) * 28 : 34;
        const px = CX + Math.cos(a) * r;
        const py = CY + Math.sin(a) * r;
        if (s === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = inkCol;
      g.fill();

      // Stark inner pinhole inversion dot
      g.beginPath();
      g.arc(CX, CY, 22, 0, TAU);
      g.fillStyle = bgCol;
      g.fill();

      g.restore();
      return;
    }

    // ------------------------------------------------------------------------
    // PHASE 1 (0.0..1.18s: Kinetic Charge) & PHASE 3 (1.50..4.4s: Debris Settle)
    // ------------------------------------------------------------------------
    const postU = t >= T_FLASH_END ? t - T_FLASH_END : -1;
    const shake = postU >= 0 ? Math.exp(-postU * 5.5) * 18 : (t > 0.7 ? smooth(0.7, 1.18, t) * 4 : 0);
    const sx = shake * Math.sin(t * 74);
    const sy = shake * Math.cos(t * 61);

    g.translate(sx, sy);

    // Atmospheric dark anime arena sky + floor perspective
    const sky = g.createRadialGradient(CX, CY, 20, CX, CY, 780);
    sky.addColorStop(0, postU >= 0 ? '#1B243B' : '#162038');
    sky.addColorStop(0.6, '#0B0F1B');
    sky.addColorStop(1, '#05070D');
    g.fillStyle = sky;
    g.fillRect(-30, -30, W + 60, H + 60);

    // Perspective ground grid below horizon (y = 480)
    const horY = 486;
    g.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(0, horY);
    g.lineTo(W, horY);
    for (let i = -8; i <= 8; i++) {
      g.moveTo(CX + i * 42, horY);
      g.lineTo(CX + i * 240, H + 20);
    }
    for (let r = 1; r <= 6; r++) {
      const gy = horY + Math.pow(r / 6, 1.8) * (H - horY);
      g.moveTo(0, gy);
      g.lineTo(W, gy);
    }
    g.stroke();

    if (t < T_HIT) {
      // PHASE 1: Kinetic Energy Charge Spiraling Inward (0.0 .. 1.18s)
      const charge = lin(0.05, T_HIT, t);
      const tighten = 1 - Math.pow(charge, 2.2);

      // Converging Sakuga aura arcs
      for (let i = 0; i < 18; i++) {
        const a0 = (i / 18) * TAU + t * 5.2;
        const r = 42 + tighten * (260 + (i % 3) * 80);
        g.beginPath();
        g.arc(CX, CY, r, a0, a0 + 0.65);
        g.strokeStyle = i % 2 === 0 ? `rgba(56, 189, 248, ${(0.25 + 0.65 * charge).toFixed(3)})` : `rgba(167, 139, 250, ${(0.2 + 0.6 * charge).toFixed(3)})`;
        g.lineWidth = 2.5 + 3.5 * charge;
        g.stroke();
      }

      // Imploding core orb
      const coreR = (18 + 56 * Math.sin(charge * Math.PI * 0.85)) * (charge > 0.88 ? 1 - (charge - 0.88) * 5 : 1);
      const glow = g.createRadialGradient(CX, CY, 2, CX, CY, Math.max(12, coreR * 2.8));
      glow.addColorStop(0, '#FFFFFF');
      glow.addColorStop(0.3, '#38BDF8');
      glow.addColorStop(0.7, 'rgba(99, 102, 241, 0.35)');
      glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(CX, CY, Math.max(12, coreR * 2.8), 0, TAU);
      g.fill();
    } else {
      // PHASE 3: Post-Impact Chromatic Shockwave & Ballistic Debris Settle (1.50 .. 4.40s)
      const fadeEnd = 1 - smooth(3.85, 4.35, t);
      g.globalAlpha = fadeEnd;

      // Dissipating shockwave ring
      const ringProgress = outQuart(clamp(postU / 1.8));
      const ringAlpha = Math.exp(-postU * 1.9);
      if (ringAlpha > 0.02) {
        g.beginPath();
        g.arc(CX, CY, 280 + ringProgress * 420, 0, TAU);
        g.strokeStyle = `rgba(56, 189, 248, ${(ringAlpha * 0.65).toFixed(3)})`;
        g.lineWidth = 8 * ringAlpha;
        g.stroke();
      }

      // Residual glowing crater/core ember
      const coreFade = Math.exp(-postU * 1.4);
      const remGlow = g.createRadialGradient(CX, CY, 4, CX, CY, 180);
      remGlow.addColorStop(0, `rgba(255, 240, 200, ${(0.85 * coreFade).toFixed(3)})`);
      remGlow.addColorStop(0.35, `rgba(255, 90, 54, ${(0.45 * coreFade).toFixed(3)})`);
      remGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      g.fillStyle = remGlow;
      g.beginPath();
      g.arc(CX, CY, 180, 0, TAU);
      g.fill();

      // Ballistic angular debris shards with floor bounce & settle
      const grav = 680;
      for (const sh of shards) {
        const dt = Math.min(postU, 2.6);
        // Damped horizontal drag + gravity with floor plane clamp
        const dragX = (1 - Math.exp(-dt * 1.6)) / 1.6;
        let px = CX + sh.vx * dragX;
        let py = CY + sh.vy * dt + 0.5 * grav * dt * dt;
        const floorY = 540 + (sh.size * 3.2);
        let rot = sh.rot0 + sh.vrot * dragX;
        if (py > floorY) {
          const over = py - floorY;
          py = floorY - Math.abs(Math.sin(over * 0.035)) * Math.exp(-dt * 2.2) * 32;
          rot = sh.rot0 + sh.vrot * 0.55;
        }

        g.save();
        g.translate(px, py);
        g.rotate(rot);
        const s = sh.size;
        g.beginPath();
        g.moveTo(-s, -s * 0.6);
        g.lineTo(s * 0.8, -s * 0.9);
        g.lineTo(s * 1.1, s * 0.5);
        g.lineTo(-s * 0.4, s * 0.85);
        g.closePath();
        g.fillStyle = sh.hot ? '#FF6B4A' : '#1E293B';
        g.fill();
        g.strokeStyle = sh.hot ? '#FEF08A' : '#64748B';
        g.lineWidth = 1.5;
        g.stroke();
        g.restore();
      }
    }

    g.restore();
  }

  return { canvas, ready: Promise.resolve(), frame };
}

// ============================================================================
// 3. ink-bleed-wipe (variant, stacks: ['glsl'], grade: 'B', period: 5.2, hero: 2.4)
// ============================================================================
let sharedInkBleedGL = null;

const BLEED_VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const BLEED_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uPeriod;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 6; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.04 + vec2(17.1, 31.7);
    a *= 0.5;
  }
  return v;
}

// Scene A: Warm Xuan Paper Dawn Mist, Vermilion Sun & Sumi Mountain Ridges
vec3 renderSceneA(vec2 uv, float t) {
  vec2 p = vec2(uv.x * (uRes.x / uRes.y), uv.y);
  // Warm Xuan paper base (#F3EFE4) + subtle laid fiber texture
  float fiber = vnoise(vec2(p.x * 45.0, p.y * 160.0)) * 0.03;
  vec3 col = vec3(0.953, 0.937, 0.894) - fiber;

  // Vermilion dawn sun disc
  vec2 sunPos = vec2(1.18, 0.67 + 0.015 * sin(t * 1.2));
  float dSun = length(p - sunPos);
  float sunDisc = smoothstep(0.148, 0.142, dSun);
  float sunHalo = exp(-max(0.0, dSun - 0.12) * 5.0);
  col = mix(col, vec3(0.96, 0.78, 0.68), sunHalo * 0.35);
  col = mix(col, vec3(0.84, 0.21, 0.15), sunDisc * (0.92 + 0.08 * fbm(p * 18.0)));

  // Layered Sumi-e misty mountain washes
  float m1 = 0.46 + 0.11 * sin(p.x * 2.6 + 0.5) + 0.05 * fbm(vec2(p.x * 4.5, 1.0));
  if (uv.y < m1) {
    float mist = smoothstep(m1 - 0.22, m1, uv.y);
    col = mix(vec3(0.56, 0.58, 0.60), col, 0.35 * (1.0 - mist));
  }

  float m2 = 0.33 + 0.09 * sin(p.x * 3.8 + 2.4) + 0.04 * fbm(vec2(p.x * 6.5, 3.0));
  if (uv.y < m2) {
    float mist2 = smoothstep(m2 - 0.18, m2, uv.y);
    col = mix(vec3(0.24, 0.25, 0.28), vec3(0.75, 0.74, 0.70), 1.0 - mist2 * 0.85);
  }

  float m3 = 0.18 + 0.06 * cos(p.x * 4.4 - 0.6) + 0.025 * fbm(vec2(p.x * 9.0, 5.0));
  if (uv.y < m3) {
    col = vec3(0.09, 0.09, 0.11);
  }

  return col;
}

// Scene B: Nocturnal Prussian-Sumi Moonlit Bamboo & Gold Kintsugi River
vec3 renderSceneB(vec2 uv, float t) {
  vec2 p = vec2(uv.x * (uRes.x / uRes.y), uv.y);
  vec3 sky = mix(vec3(0.04, 0.07, 0.13), vec3(0.10, 0.19, 0.31), smoothstep(0.2, 0.95, uv.y));
  vec3 col = sky;

  // Golden harvest moon
  vec2 moonPos = vec2(0.56, 0.70);
  float dMoon = length(p - moonPos);
  col += vec3(0.98, 0.82, 0.45) * exp(-dMoon * 4.5) * 0.42;
  float moonDisc = smoothstep(0.115, 0.110, dMoon);
  col = mix(col, vec3(0.99, 0.93, 0.72), moonDisc);

  // Shimmering moonlit river below y = 0.28
  if (uv.y < 0.28) {
    vec3 water = mix(vec3(0.02, 0.05, 0.09), vec3(0.07, 0.14, 0.24), uv.y / 0.28);
    float ripple = sin(uv.y * 140.0 + t * 5.0 + sin(p.x * 18.0) * 2.0);
    float reflWidth = 0.06 + (0.28 - uv.y) * 0.55;
    float inRefl = exp(-pow((p.x - moonPos.x) / reflWidth, 2.0));
    water += vec3(0.98, 0.82, 0.42) * inRefl * smoothstep(0.2, 0.9, ripple) * 0.85;
    col = water;
  }

  // Swaying foreground ink bamboo stalks
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float bx = 0.18 + fi * 0.11 + (fi > 2.0 ? 0.72 : 0.0);
    float sway = sin(t * 1.6 + fi * 1.3) * 0.028 * uv.y * uv.y;
    float distStalk = abs(p.x - (bx + sway));
    float width = 0.011 - uv.y * 0.004;
    float stalk = smoothstep(width + 0.002, width - 0.001, distStalk);
    // Bamboo node joints
    float joint = smoothstep(0.008, 0.002, abs(fract(uv.y * 4.2 + fi * 0.3) - 0.5)) * smoothstep(width + 0.006, width, distStalk);
    col = mix(col, vec3(0.03, 0.05, 0.08), clamp(stalk + joint, 0.0, 1.0));
  }

  // Rising golden firefly sparks
  for (int k = 0; k < 8; k++) {
    float fk = float(k);
    vec2 sp = vec2(
      fract(0.13 + fk * 0.21 + 0.03 * sin(t + fk)) * (uRes.x / uRes.y),
      fract(0.15 + fk * 0.17 + t * 0.08)
    );
    float d = length(p - sp);
    col += vec3(1.0, 0.84, 0.38) * exp(-d * 68.0) * 0.9;
  }

  return col;
}

void main() {
  float t = mod(uTime, uPeriod);
  vec2 aspectP = vec2(vUv.x * (uRes.x / uRes.y), vUv.y);

  vec3 sceneA = renderSceneA(vUv, t);
  vec3 sceneB = renderSceneB(vUv, t);

  // Domain-warped multi-octave fBm + anisotropic Xuan paper fiber capillary field
  vec2 q = vec2(fbm(aspectP * 3.1 + vec2(0.0, 1.4)), fbm(aspectP * 3.1 + vec2(5.2, 2.8)));
  vec2 r = vec2(fbm(aspectP * 5.4 + 1.8 * q), fbm(aspectP * 5.4 + 1.8 * q + vec2(3.1, 7.4)));
  float warpNoise = fbm(aspectP * 4.2 + 0.65 * r);
  float capillary = vnoise(vec2(aspectP.x * 48.0, aspectP.y * 24.0 + warpNoise * 6.0));

  // Multi-drop ink impact distance field (starts bleeding at t=0.45s, spans ~58% across frame at hero=2.4s!)
  float d1 = length(aspectP - vec2(0.64, 0.52));
  float d2 = length(aspectP - vec2(0.92, 0.42)) * 1.12;
  float d3 = length(aspectP - vec2(0.48, 0.34)) * 1.18;
  float dField = min(d1, min(d2, d3));

  // Perturb radial distance with domain-warped fBm dendrites & capillary fibers
  float inkMetric = dField - (warpNoise - 0.48) * 0.44 - (capillary - 0.5) * 0.065;

  // Forward Sumi bleed (0.45..3.55s) then clean reverse Xuan wash reset (3.95..5.05s)
  float grow = smoothstep(0.42, 3.52, t) * 1.58;
  float resetGrow = smoothstep(3.92, 5.06, t) * 1.75;

  // Wet outer water-halo ahead of dark Sumi pigment front
  float waterFront = 1.0 - smoothstep(grow - 0.045, grow + 0.035, inkMetric);
  float inkFront = 1.0 - smoothstep(grow - 0.075, grow - 0.012, inkMetric);
  // Concentrated coffee-ring Sumi pigment accumulation along bleeding edge
  float pigmentRim = inkFront * (1.0 - (1.0 - smoothstep(grow - 0.14, grow - 0.055, inkMetric)));

  // Reverse wash back to Scene A near end of loop
  float clearMask = 1.0 - smoothstep(resetGrow - 0.08, resetGrow + 0.02, inkMetric + 0.12);

  float finalB = clamp(inkFront * (1.0 - clearMask), 0.0, 1.0);
  float wetDarken = clamp((waterFront - inkFront) * (1.0 - clearMask), 0.0, 1.0);

  vec3 col = sceneA * (1.0 - 0.10 * wetDarken);
  col = mix(col, sceneB, finalB);
  // Deep pine-soot Sumi rim along dendritic feather boundary
  col = mix(col, vec3(0.03, 0.03, 0.045), clamp(pigmentRim * (1.0 - clearMask) * 0.88, 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
}
`;

function getInkBleedGL(width, height) {
  if (!sharedInkBleedGL || sharedInkBleedGL.gl.isContextLost()) {
    const glCanvas = document.createElement('canvas');
    glCanvas.width = width;
    glCanvas.height = height;
    const gl = glCanvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL unavailable for ink-bleed-wipe');

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh) || 'GLSL compile error');
      }
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, BLEED_VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, BLEED_FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || 'GLSL link error');
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    sharedInkBleedGL = {
      glCanvas,
      gl,
      prog,
      uRes: gl.getUniformLocation(prog, 'uRes'),
      uTime: gl.getUniformLocation(prog, 'uTime'),
      uPeriod: gl.getUniformLocation(prog, 'uPeriod'),
    };
  }
  if (sharedInkBleedGL.glCanvas.width !== width || sharedInkBleedGL.glCanvas.height !== height) {
    sharedInkBleedGL.glCanvas.width = width;
    sharedInkBleedGL.glCanvas.height = height;
  }
  return sharedInkBleedGL;
}

function buildInkBleedWipe(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const PERIOD = 5.2;

  function frame(time) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    const ctxGL = getInkBleedGL(width, height);
    const { gl, prog, glCanvas, uRes, uTime, uPeriod } = ctxGL;

    gl.viewport(0, 0, width, height);
    gl.useProgram(prog);
    gl.uniform2f(uRes, width, height);
    gl.uniform1f(uTime, t);
    gl.uniform1f(uPeriod, PERIOD);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(glCanvas, 0, 0, width, height);
    g.restore();
  }

  return { canvas, ready: Promise.resolve(), frame };
}

export const studies = [
  {
    id: 'ink-slash',
    name: 'Sumi-e dry-brush slash and seal',
    kind: 'motion',
    grade: 'A',
    stacks: ['canvas'],
    period: 4.8,
    hero: 1.55,
    aspect: '16 / 9',
    chips: ['44-bristle Feibai split', '1.35x hit-stop punch', 'Enso ring + cinnabar seal'],
    purpose: 'A dry-brush Sumi calligraphy slash whips across fibrous Xuan paper with a 1.35x hit-stop punch, expanding Enso shockwave, ink droplets and a carved cinnabar seal.',
  },
  {
    id: 'ink-impact-frame',
    name: 'Sakuga binary impact frames',
    kind: 'light',
    grade: 'A',
    stacks: ['canvas'],
    period: 4.4,
    hero: 1.32,
    aspect: '16 / 9',
    chips: ['3-frame binary inversion', 'radial lightning wedges', 'chromatic shockwave + debris'],
    purpose: 'Spiralling charge arcs detonate into a 3-frame high-contrast black-and-white Sakuga radial lightning flash with a chromatic shock ring before ballistic debris settles.',
  },
  {
    id: 'ink-bleed-wipe',
    name: 'Organic Xuan ink-bleed wipe',
    kind: 'motion',
    grade: 'B',
    stacks: ['glsl'],
    period: 5.2,
    hero: 2.4,
    aspect: '16 / 9',
    chips: ['6-octave domain-warped fBm', 'capillary fiber feathering', 'pigment rim wipe'],
    purpose: 'Wet Sumi ink strikes fibrous Xuan paper and bleeds organically via multi-octave domain-warped fBm dendrites to transition between dawn mountain mist and moonlit bamboo.',
  },
];

export async function create(id, options = {}) {
  const builders = {
    'ink-slash': buildInkSlash,
    'ink-impact-frame': buildInkImpactFrame,
    'ink-bleed-wipe': buildInkBleedWipe,
  };
  const fn = builders[id];
  if (!fn) throw new Error('Unknown sakuga demo: ' + id);
  const inst = fn(options);
  await inst.ready;
  return inst;
}
