// Editorial Emphasis & Hand-Drawn Marks effects (0BSD).
// Pure deterministic frame(t) implementations at 16:9, supporting window.FX_CUSTOM_TEXT.

const W = 1280;
const H = 720;
const TAU = Math.PI * 2;
const SANS = '"Archivo", "Helvetica Neue", -apple-system, Arial, sans-serif';
const SERIF = '"Instrument Serif", Georgia, "Times New Roman", serif';
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const CJK_SANS = '"Archivo", "Noto Sans TC", "PingFang HK", sans-serif';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const lin = (a, b, x) => clamp((x - a) / (b - a));
const smooth = (a, b, x) => {
  const k = lin(a, b, x);
  return k * k * (3 - 2 * k);
};
const outCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
const inOutCubic = (x) => {
  const k = clamp(x);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
};

function springValue(u, zeta = 0.62, omega = 22) {
  if (u <= 0) return 0;
  const wd = omega * Math.sqrt(Math.max(0.001, 1 - zeta * zeta));
  const env = Math.exp(-zeta * omega * u);
  return 1 - env * (Math.cos(wd * u) + ((zeta * omega) / wd) * Math.sin(wd * u));
}

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function getCustomText(opts, maxLen = 32) {
  const direct = typeof opts?.text === 'string' ? opts.text.trim() : '';
  if (direct) return direct.slice(0, maxLen);
  const globalText = typeof globalThis !== 'undefined' && typeof globalThis.FX_CUSTOM_TEXT === 'string'
    ? globalThis.FX_CUSTOM_TEXT.trim()
    : '';
  return globalText ? globalText.slice(0, maxLen) : '';
}

async function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  await Promise.allSettled([
    document.fonts.load(`400 20px ${SANS}`),
    document.fonts.load(`600 20px ${SANS}`),
    document.fonts.load(`700 32px ${SANS}`),
    document.fonts.load(`900 96px ${SANS}`),
    document.fonts.load(`700 48px ${CJK_SANS}`),
    document.fonts.load(`900 96px ${CJK_SANS}`),
    document.fonts.load(`400 24px ${SERIF}`),
    document.fonts.load(`500 20px ${SERIF}`),
    document.fonts.load(`italic 400 72px ${SERIF}`),
    document.fonts.load(`500 14px ${MONO}`),
    document.fonts.load(`700 24px ${MONO}`),
  ]);
  if (document.fonts.ready) await document.fonts.ready;
}

function fitFontSize(g, text, weight, family, maxWidth, baseSize, minSize = 34) {
  let size = baseSize;
  g.font = `${weight} ${size}px ${family}`;
  const measured = g.measureText(text).width;
  if (measured > maxWidth && measured > 0) {
    size = Math.max(minSize, Math.floor((baseSize * maxWidth) / measured));
  }
  return size;
}

// Pre-baked warm cotton editorial paper texture for zero per-frame noise overhead
let cachedEditorialPaper = null;
function getEditorialPaper() {
  if (cachedEditorialPaper) return cachedEditorialPaper;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(W * 0.5, H * 0.45, 80, W * 0.5, H * 0.5, W * 0.78);
  grad.addColorStop(0, '#F8F4EB');
  grad.addColorStop(0.7, '#F2ECE0');
  grad.addColorStop(1, '#E6DEC9');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // Subtle cotton fibers and editorial print speckles
  for (let i = 0; i < 2400; i++) {
    const x = hash(i * 1.37) * W;
    const y = hash(i * 2.91 + 7) * H;
    const len = 3 + hash(i * 5.13) * 11;
    const ang = hash(i * 8.71) * TAU;
    g.strokeStyle = i % 2 === 0 ? 'rgba(120, 108, 90, 0.045)' : 'rgba(255, 255, 255, 0.22)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }
  cachedEditorialPaper = c;
  return c;
}

// ============================================================================
// 1. type-editorial-strike (lead, period: 5.2, hero: 2.6) + FX_CUSTOM_TEXT
// ============================================================================
function buildEditorialStrike(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const PERIOD = 5.2;
  const paper = getEditorialPaper();

  function parsePair(raw) {
    if (!raw) return { claim: 'MORE MEETINGS', fix: 'Ship the work.' };
    const sep = raw.match(/\s*(?:->|\/|\|)\s*/);
    if (sep) {
      const parts = raw.split(sep[0]).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) return { claim: parts[0].toUpperCase(), fix: parts[1] };
    }
    return { claim: 'MORE MEETINGS', fix: raw };
  }

  // Draw organic pressure-varied felt-marker stroke from (x0, y0) to (x1, y1)
  function drawMarkerStrike(ctx, x0, y0, x1, y1, prog) {
    if (prog <= 0.005) return;
    const steps = Math.max(4, Math.floor(84 * prog));
    ctx.save();
    for (let strand = -2; strand <= 2; strand++) {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = (i / 84);
        const wobble = Math.sin(u * 19 + strand * 1.4) * 1.8 + (hash(i * 3.1 + strand * 17) - 0.5) * 1.4;
        const arch = -Math.sin(u * Math.PI) * 7.5;
        const x = lerp(x0, x1, u);
        const y = lerp(y0, y1, u) + arch + strand * 3.1 + wobble;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      // Pressure profile: thick initial press, slightly faster middle, crisp dry lift
      const baseW = strand === 0 ? 11.5 : Math.abs(strand) === 1 ? 8.2 : 4.2;
      ctx.strokeStyle = Math.abs(strand) === 2 ? 'rgba(220, 38, 26, 0.52)' : 'rgba(220, 38, 26, 0.90)';
      ctx.lineWidth = baseW;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Initial felt-tip ink press blot + tiny spatter droplets
    ctx.beginPath();
    ctx.ellipse(x0 + 4, y0 + 1, 11, 8.5, -0.2, 0, TAU);
    ctx.fillStyle = 'rgba(208, 32, 22, 0.88)';
    ctx.fill();

    const spatterCount = Math.floor(prog * 14);
    for (let s = 0; s < spatterCount; s++) {
      const su = 0.15 + hash(s * 5.7) * 0.82;
      if (su > prog) continue;
      const sx = lerp(x0, x1, su) + (hash(s * 9.3) - 0.5) * 44;
      const sy = lerp(y0, y1, su) + (hash(s * 2.7) - 0.5) * 38;
      const sr = 1.2 + hash(s * 11.1) * 2.8;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, TAU);
      ctx.fillStyle = 'rgba(216, 36, 24, 0.72)';
      ctx.fill();
    }
    ctx.restore();
  }

  function frame(time, opts = {}) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    const { claim, fix } = parsePair(getCustomText(opts, 42));

    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);
    g.drawImage(paper, 0, 0, W, H);

    const fadeOut = 1 - smooth(4.65, 5.10, t);
    const joltEnv = t >= 0.86 ? Math.exp(-(t - 0.86) * 14) : 0;
    const jx = joltEnv * 4.5 * Math.sin((t - 0.86) * 55);
    const jy = joltEnv * 2.8 * Math.cos((t - 0.86) * 42);

    g.translate(jx, jy);
    g.globalAlpha = fadeOut;

    // Editorial broadsheet running head & crop marks
    g.strokeStyle = '#1C1B20';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(88, 78);
    g.lineTo(W - 88, 78);
    g.moveTo(88, H - 72);
    g.lineTo(W - 88, H - 72);
    g.stroke();

    g.lineWidth = 0.75;
    g.beginPath();
    g.moveTo(88, 83);
    g.lineTo(W - 88, 83);
    g.stroke();

    g.font = `700 12px ${MONO}`;
    g.fillStyle = '#4A463F';
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    g.fillText('THE EDITORIAL DESK  ·  GALLEY PROOF NO. 04', 88, 69);
    g.textAlign = 'right';
    g.fillText('MARKUP // VERMILION', W - 88, 69);

    // 1. Printed Original Claim (centered slightly below midline so correction sits proudly above)
    const claimIn = outCubic(lin(0.05, 0.45, t));
    const claimY = 442;
    const strikeK = outCubic(lin(0.84, 1.26, t));

    g.save();
    g.globalAlpha *= claimIn;
    const claimSize = fitFontSize(g, claim, '900', CJK_SANS, 980, 94, 44);
    g.font = `900 ${claimSize}px ${CJK_SANS}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // Slight ink desaturation once struck out so eye jumps to correction while keeping claim readable
    g.fillStyle = strikeK > 0.5 ? '#2B2930' : '#151419';
    g.fillText(claim, W / 2, claimY);
    const claimW = Math.min(1020, g.measureText(claim).width);

    // Supporting sub-deck line underneath printed claim
    g.font = `500 18px ${SERIF}`;
    g.fillStyle = '#6E685E';
    g.fillText('Draft 1: Schedule six cross-functional alignment syncs before prototyping.', W / 2, claimY + 78);
    g.restore();

    // 2. Energetic Vermilion Red Marker Strike across Claim
    drawMarkerStrike(
      g,
      W / 2 - claimW * 0.54,
      claimY + 8,
      W / 2 + claimW * 0.54,
      claimY - 12,
      strikeK
    );

    // 3. Proofreader's Caret Insertion Mark (^) below left-center of correction
    const caretK = outCubic(lin(1.28, 1.54, t));
    if (caretK > 0.01) {
      const cx = W / 2 - Math.min(220, claimW * 0.24);
      const cy = claimY - 58;
      g.save();
      g.strokeStyle = '#DC261A';
      g.lineWidth = 5.5;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(cx - 18, cy + 20);
      const p1 = clamp(caretK * 2);
      g.lineTo(lerp(cx - 18, cx, p1), lerp(cy + 20, cy - 6, p1));
      if (caretK > 0.5) {
        const p2 = clamp((caretK - 0.5) * 2);
        g.lineTo(lerp(cx, cx + 19, p2), lerp(cy - 6, cy + 20, p2));
      }
      g.stroke();
      g.restore();
    }

    // 4. Tilted Handwritten / Editorial Serif Correction ("Ship the work.") animating in above!
    const corrK = inOutCubic(lin(1.48, 2.22, t));
    if (corrK > 0.01) {
      g.save();
      const corrX = W / 2 + 12;
      const corrY = 262;
      g.translate(corrX, corrY);
      g.rotate(-0.072); // -4.1 deg energetic editorial tilt

      const corrSize = fitFontSize(g, fix, 'italic 400', `${SERIF}, ${CJK_SANS}`, 940, 112, 48);
      g.font = `italic 400 ${corrSize}px ${SERIF}, ${CJK_SANS}`;
      const corrW = g.measureText(fix).width + 60;

      // Progressive left-to-right write-on clip mask
      g.beginPath();
      g.rect(-corrW / 2 - 20, -corrSize, (corrW + 40) * corrK, corrSize * 2.1);
      g.clip();

      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#D9261C';
      g.fillText(fix, 0, 0);
      // Slight double-ink offset for fountain/marker richness
      g.globalAlpha *= 0.35;
      g.fillText(fix, 1.2, 0.8);
      g.restore();

      // Energetic double underline flourish under correction
      const underK = outCubic(lin(2.05, 2.48, t));
      if (underK > 0.01) {
        g.save();
        g.translate(corrX, corrY);
        g.rotate(-0.072);
        const uw = Math.min(720, corrW * 0.84);
        g.strokeStyle = '#DC261A';
        g.lineWidth = 4.2;
        g.lineCap = 'round';
        g.beginPath();
        const steps = Math.max(2, Math.floor(40 * underK));
        for (let i = 0; i <= steps; i++) {
          const u = i / 40;
          const ux = lerp(-uw * 0.48, uw * 0.48, u);
          const uy = 54 - Math.sin(u * Math.PI) * 5 + Math.sin(u * 12) * 1.2;
          if (i === 0) g.moveTo(ux, uy);
          else g.lineTo(ux, uy);
        }
        g.stroke();
        g.restore();
      }
    }

    // Margin proofreader stamp pill
    const noteK = smooth(2.15, 2.50, t);
    if (noteK > 0.01) {
      g.save();
      g.globalAlpha *= noteK;
      g.font = `700 12px ${MONO}`;
      g.fillStyle = '#DC261A';
      g.textAlign = 'left';
      g.fillText('REV. APPROVED // FINAL', 88, H - 86);
      g.textAlign = 'right';
      g.fillStyle = '#57524A';
      g.fillText('SET IN 96 PT DISPLAY + ITALIC SERIF', W - 88, H - 86);
      g.restore();
    }

    g.restore();
  }

  return { canvas, ready: ensureFonts(), frame };
}

// ============================================================================
// 2. type-cipher (variant, period: 4.8, hero: 2.1) + FX_CUSTOM_TEXT
// ============================================================================
function buildTypeCipher(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const PERIOD = 4.8;

  // Pure ASCII escaped glyph strata: Blocks, Hex, Katakana, Technical Symbols
  const BLOCKS = '\u2593\u2592\u2591\u2588\u2584\u2580';
  const HEX = '0123456789ABCDEF';
  const KANA = '\u30A2\u30A6\u30AA\u30AB\u30AD\u30AF\u30B1\u30B3\u30B5\u30B7\u30B9\u30BF\u30C4\u30CA\u30CF\u30DB\u30DE\u30E4\u30E9\u30EA\u30EF\u30F3';
  const SYM = '#$%&*+<>?/=\\~^';

  function cipherGlyph(charIdx, step, progressToLock) {
    const r = Math.floor(hash(charIdx * 31.7 + step * 13.3) * 1000);
    if (progressToLock < 0.32) return BLOCKS[r % BLOCKS.length];
    if (progressToLock < 0.62) return KANA[r % KANA.length];
    if (progressToLock < 0.85) return HEX[r % HEX.length];
    return SYM[r % SYM.length];
  }

  function frame(time, opts = {}) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    const target = (getCustomText(opts, 22) || 'SIGNAL LOCK').toUpperCase();
    const chars = Array.from(target);
    const N = chars.length;

    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);

    // Deep CRT phosphor obsidian backdrop
    const bg = g.createRadialGradient(W * 0.5, H * 0.5, 40, W * 0.5, H * 0.5, W * 0.75);
    bg.addColorStop(0, '#0D1520');
    bg.addColorStop(0.65, '#070B11');
    bg.addColorStop(1, '#04060A');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // Subtle horizontal CRT scanlines
    g.fillStyle = 'rgba(148, 163, 184, 0.025)';
    for (let y = 0; y < H; y += 4) {
      g.fillRect(0, y, W, 1);
    }

    const fadeOut = 1 - smooth(4.32, 4.72, t);
    g.globalAlpha = fadeOut;

    // Top & bottom cryptographic framing rails
    g.strokeStyle = 'rgba(45, 212, 191, 0.25)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(76, 86);
    g.lineTo(W - 76, 86);
    g.moveTo(76, H - 86);
    g.lineTo(W - 76, H - 86);
    g.stroke();

    const step24 = Math.floor(t * 24);
    g.font = `700 12px ${MONO}`;
    g.fillStyle = '#2DD4BF';
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    g.fillText('CIPHER // SHA-384 STREAM DECRYPT', 76, 74);

    // Lock progression left-to-right: tuned so at hero=2.1 ~72% is locked, active char phosphor-flashes, tail scrambles!
    const lockFirst = 0.62;
    const lockLast = 2.48;
    let lockedCount = 0;

    // Calculate cell layout centered on 1280x720
    const maxTotalW = 1080;
    const fontSize = clamp(Math.floor(maxTotalW / (Math.max(6, N) * 0.72)), 42, 108);
    const cellW = Math.min(98, Math.floor(maxTotalW / Math.max(1, N)));
    const totalW = cellW * N;
    const startX = (W - totalW) / 2 + cellW / 2;
    const centerY = H / 2 - 4;

    chars.forEach((ch, i) => {
      const cx = startX + i * cellW;
      const appearT = 0.08 + (i / Math.max(1, N)) * 0.28;
      if (t < appearT) return;

      const lockT = lerp(lockFirst, lockLast, i / Math.max(1, N - 1));
      const isSpace = ch === ' ';
      const locked = isSpace || t >= lockT;
      if (locked) lockedCount++;

      if (isSpace) return;

      const dtLock = t - lockT;
      const flash = locked ? Math.exp(-Math.max(0, dtLock) * 9.5) : 0;
      const progToLock = clamp((t - appearT) / Math.max(0.05, lockT - appearT));

      // Phosphor vertical bloom column on lock instant
      if (flash > 0.04) {
        const bloom = g.createLinearGradient(cx, centerY - fontSize * 0.9, cx, centerY + fontSize * 0.9);
        bloom.addColorStop(0, 'rgba(52, 211, 153, 0)');
        bloom.addColorStop(0.5, `rgba(110, 231, 183, ${(0.42 * flash).toFixed(3)})`);
        bloom.addColorStop(1, 'rgba(52, 211, 153, 0)');
        g.fillStyle = bloom;
        g.fillRect(cx - cellW * 0.46, centerY - fontSize * 0.9, cellW * 0.92, fontSize * 1.8);
      }

      // Active scramble cell bracket box
      if (!locked) {
        g.strokeStyle = progToLock > 0.65 ? 'rgba(52, 211, 153, 0.48)' : 'rgba(56, 189, 248, 0.28)';
        g.lineWidth = 1.2;
        g.strokeRect(cx - cellW * 0.42, centerY - fontSize * 0.58, cellW * 0.84, fontSize * 1.12);
      }

      g.save();
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (locked) {
        g.font = `900 ${fontSize}px ${CJK_SANS}`;
        if (flash > 0.15) {
          g.shadowColor = '#6EE7B7';
          g.shadowBlur = 26 * flash;
          g.fillStyle = flash > 0.55 ? '#ECFDF5' : '#F8FAFC';
        } else {
          g.fillStyle = '#F8FAFC';
        }
        g.fillText(ch, cx, centerY);
      } else {
        const scr = cipherGlyph(i, step24, progToLock);
        g.font = `700 ${Math.round(fontSize * 0.82)}px ${MONO}, ${CJK_SANS}`;
        g.fillStyle = progToLock > 0.62 ? '#34D399' : progToLock > 0.32 ? '#38BDF8' : '#64748B';
        g.fillText(scr, cx, centerY);
      }
      g.restore();

      // Per-slot hex index tag underneath
      g.font = `600 10px ${MONO}`;
      g.textAlign = 'center';
      g.textBaseline = 'top';
      const hexByte = locked
        ? ch.codePointAt(0).toString(16).toUpperCase().padStart(2, '0').slice(-2)
        : Math.floor(hash(i * 19 + step24) * 255).toString(16).toUpperCase().padStart(2, '0');
      g.fillStyle = locked ? 'rgba(52, 211, 153, 0.72)' : 'rgba(100, 116, 139, 0.55)';
      g.fillText(`0x${hexByte}`, cx, centerY + fontSize * 0.66);
    });

    // Right header lock progress telemetry
    const pct = Math.round((lockedCount / Math.max(1, N)) * 100);
    g.font = `700 12px ${MONO}`;
    g.textAlign = 'right';
    g.textBaseline = 'bottom';
    g.fillStyle = pct === 100 ? '#34D399' : '#38BDF8';
    g.fillText(pct === 100 ? 'STATUS: VERIFIED PLAINTEXT [100%]' : `LOCKING GLYPHS [${String(pct).padStart(3, ' ')}%]`, W - 76, 74);

    // Bottom strata legend
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.font = `600 11px ${MONO}`;
    g.fillStyle = '#64748B';
    g.fillText('STRATA: [01] BLOCK DENSITY   [02] KATAKANA   [03] HEXADECIMAL   [04] LOCKED DISPLAY', 76, H - 72);

    g.restore();
  }

  return { canvas, ready: ensureFonts(), frame };
}

// ============================================================================
// 3. type-split-cut (variant, period: 4.8, hero: 1.8) + FX_CUSTOM_TEXT
// ============================================================================
function buildTypeSplitCut(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const PERIOD = 4.8;

  function frame(time, opts = {}) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    const word = (getCustomText(opts, 20) || 'RAZOR EDGE').toUpperCase();

    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);

    // Dramatic dark studio title background
    const bg = g.createRadialGradient(W * 0.5, H * 0.5, 40, W * 0.5, H * 0.5, W * 0.8);
    bg.addColorStop(0, '#17151C');
    bg.addColorStop(0.7, '#0D0C11');
    bg.addColorStop(1, '#07060A');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // Diagonal laser cut geometry: passes through (W/2, H/2) at -5.8 deg
    const cutAngle = -0.102;
    const cosA = Math.cos(cutAngle);
    const sinA = Math.sin(cutAngle);
    const cx = W / 2;
    const cy = H / 2;

    // Timing phases:
    // 0.0..0.55: Bold display type enters
    // 0.68..1.02: Laser beam slices left-to-right
    // 0.96..2.85: Upper & lower halves shear apart along cut tangent + gap normal (held crisply across hero=1.8!)
    // 2.95..3.35: Halves snap shut magnetically with impact flash
    const enterK = outCubic(lin(0.04, 0.46, t));
    const fadeOut = 1 - smooth(4.32, 4.72, t);

    const openShear = springValue(t - 0.96, 0.56, 19);
    const snapShut = springValue(t - 2.95, 0.68, 28);
    const splitK = clamp(openShear - snapShut, 0, 1.25);

    const snapFlash = t >= 3.06 ? Math.exp(-(t - 3.06) * 14) : 0;
    const sliceShake = (t >= 0.94 ? Math.exp(-(t - 0.94) * 12) : 0) + snapFlash * 0.8;
    const sx = sliceShake * 5 * Math.sin(t * 70);
    const sy = sliceShake * 3 * Math.cos(t * 58);

    g.translate(sx, sy);
    g.globalAlpha = enterK * fadeOut;

    const fontSize = fitFontSize(g, word, '900', CJK_SANS, 1060, 148, 56);

    function drawWordBody(fillStyle) {
      g.font = `900 ${fontSize}px ${CJK_SANS}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = fillStyle;
      g.fillText(word, cx, cy + 4);
    }

    // Tangential shear + normal separation in cut coordinate space
    const shearDist = 44 * splitK;
    const gapDist = 11 * splitK;

    // Upper Half-Plane (local Y < 0 in rotated cut frame)
    g.save();
    g.beginPath();
    g.translate(cx, cy);
    g.rotate(cutAngle);
    g.rect(-W, -H, W * 2, H);
    g.rotate(-cutAngle);
    g.translate(-cx, -cy);
    g.clip();

    g.translate(
      cosA * shearDist + sinA * gapDist,
      sinA * shearDist - cosA * gapDist
    );
    drawWordBody('#F6F2EA');
    g.restore();

    // Lower Half-Plane (local Y >= 0 in rotated cut frame)
    g.save();
    g.beginPath();
    g.translate(cx, cy);
    g.rotate(cutAngle);
    g.rect(-W, 0, W * 2, H);
    g.rotate(-cutAngle);
    g.translate(-cx, -cy);
    g.clip();

    g.translate(
      -cosA * shearDist - sinA * gapDist,
      -sinA * shearDist + cosA * gapDist
    );
    drawWordBody(splitK > 0.05 ? '#E5DFD3' : '#F6F2EA');
    g.restore();

    // Razor-thin glowing Laser Midline + Residual Hot Cut Seam
    const beamSweep = outCubic(lin(0.66, 1.00, t));
    const seamGlow = clamp(
      smooth(0.66, 0.82, t) * (1 - smooth(2.92, 3.22, t)) * (0.52 + 0.48 * Math.exp(-Math.max(0, t - 0.98) * 1.4))
      + snapFlash * 0.9
    );

    if (beamSweep > 0.01 && seamGlow > 0.01) {
      g.save();
      g.translate(cx, cy);
      g.rotate(cutAngle);

      const xStart = -720;
      const xEnd = lerp(-720, 720, beamSweep);

      // Wide hot-orange anamorphic glow
      const glowGrad = g.createLinearGradient(0, -28, 0, 28);
      glowGrad.addColorStop(0, 'rgba(255, 59, 31, 0)');
      glowGrad.addColorStop(0.5, `rgba(255, 72, 32, ${(0.55 * seamGlow).toFixed(3)})`);
      glowGrad.addColorStop(1, 'rgba(255, 59, 31, 0)');
      g.fillStyle = glowGrad;
      g.fillRect(xStart, -28, xEnd - xStart, 56);

      // Razor incandescent core line
      g.beginPath();
      g.moveTo(xStart, 0);
      g.lineTo(xEnd, 0);
      g.strokeStyle = `rgba(255, 245, 235, ${(0.95 * seamGlow).toFixed(3)})`;
      g.lineWidth = 2.4 + 2.5 * snapFlash;
      g.stroke();

      // Leading laser flare tip during initial cut
      if (beamSweep < 0.99) {
        const tipGlow = g.createRadialGradient(xEnd, 0, 1, xEnd, 0, 64);
        tipGlow.addColorStop(0, 'rgba(255, 255, 255, 1)');
        tipGlow.addColorStop(0.25, 'rgba(255, 96, 42, 0.85)');
        tipGlow.addColorStop(1, 'rgba(255, 59, 31, 0)');
        g.fillStyle = tipGlow;
        g.beginPath();
        g.arc(xEnd, 0, 64, 0, TAU);
        g.fill();
      }

      // Hot ember sparks along sheared cut gap
      for (let i = 0; i < 18; i++) {
        const su = (t - 0.92) - hash(i * 4.1) * 0.18;
        if (su <= 0 || su > 1.6) continue;
        const life = 1 - su / 1.6;
        const sx0 = (hash(i * 9.7) - 0.5) * 860;
        const vx = (hash(i * 2.3) - 0.5) * 140 + (i % 2 ? 90 : -90);
        const vy = (hash(i * 6.9) - 0.5) * 95;
        g.fillStyle = `rgba(255, 168, 92, ${(life * seamGlow).toFixed(3)})`;
        g.fillRect(sx0 + vx * su, vy * su, 5 + 8 * life, 2);
      }

      g.restore();
    }

    // Editorial framing metadata
    g.font = `700 12px ${MONO}`;
    g.fillStyle = 'rgba(246, 242, 234, 0.48)';
    g.textAlign = 'left';
    g.fillText('TITLE STUDY 03 // SHEAR-PLANE SPLIT', 76, 68);
    g.textAlign = 'right';
    g.fillStyle = splitK > 0.2 ? '#FF5A36' : 'rgba(246, 242, 234, 0.48)';
    g.fillText(splitK > 0.2 ? `SHEAR ΔX ${shearDist.toFixed(1)} PX · -5.8°` : 'AXIS LOCKED · 0.0 PX', W - 76, 68);

    g.restore();
  }

  return { canvas, ready: ensureFonts(), frame };
}

// ============================================================================
// 4. type-knockout (variant, period: 5.6, hero: 2.5) + FX_CUSTOM_TEXT
// ============================================================================
function buildTypeKnockout(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  // Offscreen mask canvas for crisp ultra-heavy knockout lettering
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = W;
  maskCanvas.height = H;
  const mg = maskCanvas.getContext('2d');
  const PERIOD = 5.6;

  function drawProceduralCinema(ctx, t) {
    const phase = (TAU * t) / PERIOD;
    // Rich golden-hour anamorphic ocean + mountain ridge vista
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.66);
    sky.addColorStop(0, '#132442');
    sky.addColorStop(0.36, '#3B426E');
    sky.addColorStop(0.68, '#D96B43');
    sky.addColorStop(1, '#FCD37D');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Moving solar disc + warm atmospheric bloom
    const sunX = W * 0.5 + Math.sin(phase) * 48;
    const sunY = H * 0.44 - Math.cos(phase) * 18;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 16, sunX, sunY, 320);
    sunGlow.addColorStop(0, 'rgba(255, 250, 224, 1)');
    sunGlow.addColorStop(0.18, 'rgba(255, 214, 130, 0.88)');
    sunGlow.addColorStop(0.55, 'rgba(249, 115, 62, 0.32)');
    sunGlow.addColorStop(1, 'rgba(249, 115, 62, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, W, H);

    ctx.beginPath();
    ctx.arc(sunX, sunY, 54, 0, TAU);
    ctx.fillStyle = '#FFFBEB';
    ctx.fill();

    // Drifting sunlit cloud bands
    for (let c = 0; c < 7; c++) {
      const cx = ((c * 240 + t * (28 + c * 5)) % (W + 360)) - 180;
      const cy = 110 + (c % 4) * 52;
      const cw = 190 + (c % 3) * 85;
      const ch = 16 + (c % 2) * 10;
      ctx.fillStyle = c % 2 ? 'rgba(255, 224, 178, 0.26)' : 'rgba(254, 178, 132, 0.22)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, ch, 0, 0, TAU);
      ctx.fill();
    }

    // Layered parallax mountain silhouettes
    const layers = [
      { yBase: 418, amp: 58, freq: 0.0045, speed: 18, col: '#2D3252' },
      { yBase: 454, amp: 42, freq: 0.0068, speed: 34, col: '#1B223B' },
    ];
    for (const L of layers) {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 16) {
        const xw = x + t * L.speed;
        const y = L.yBase
          - Math.abs(Math.sin(xw * L.freq)) * L.amp
          - Math.sin(xw * L.freq * 2.3 + 1.2) * (L.amp * 0.35);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = L.col;
      ctx.fill();
    }

    // Shimmering golden-hour ocean below horizon
    const seaY = 468;
    const sea = ctx.createLinearGradient(0, seaY, 0, H);
    sea.addColorStop(0, '#C2593F');
    sea.addColorStop(0.38, '#30395C');
    sea.addColorStop(1, '#0B1326');
    ctx.fillStyle = sea;
    ctx.fillRect(0, seaY, W, H - seaY);

    // Animated specular water glitter paths
    for (let r = 0; r < 34; r++) {
      const u = r / 34;
      const ry = seaY + 6 + u * u * (H - seaY - 12);
      const spread = 50 + u * 340;
      const rx = sunX + Math.sin(t * 3.8 + r * 1.9) * spread * 0.32;
      const rw = (28 + hash(r * 7.1) * 110) * (0.4 + u * 0.9);
      ctx.fillStyle = `rgba(255, 232, 168, ${(0.68 - u * 0.42).toFixed(3)})`;
      ctx.fillRect(rx - rw / 2, ry, rw, 2 + u * 3.5);
    }

    // Soaring silhouette birds across sun disc
    for (let b = 0; b < 5; b++) {
      const bx = ((380 + b * 74 + t * 62) % (W + 120)) - 60;
      const by = 270 + b * 22 + Math.sin(t * 3 + b) * 12;
      const wing = Math.sin(t * 9 + b * 1.4) * 7;
      ctx.strokeStyle = '#141829';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(bx - 11, by - wing);
      ctx.quadraticCurveTo(bx - 4, by - 4, bx, by);
      ctx.quadraticCurveTo(bx + 4, by - 4, bx + 11, by - wing);
      ctx.stroke();
    }
  }

  function frame(time, opts = {}) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    const custom = getCustomText(opts, 20);
    const word = (custom || 'SCOPE').toUpperCase();

    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);

    // 1. Live moving procedural cinema footage full-frame
    drawProceduralCinema(g, t);

    // 2. Knockout mask zoom schedule:
    // 0.0..2.80s: Slow cinematic push (1.00x -> 1.14x); at hero=2.5s giant bold SCOPE frames vivid sunset ocean!
    // 2.80..4.25s: Exponential zoom-through center counter ('O') to full-bleed cinema (1.14x -> 30x)!
    // 4.25..5.10s: Full-bleed vista holds open, then cleanly resets by 5.6s.
    const slowPush = lin(0.0, 2.80, t) * 0.14;
    const zoomBurst = Math.pow(inOutCubic(lin(2.80, 4.22, t)), 2.5) * 30;
    const returnMask = smooth(5.05, 5.52, t);
    const zoom = (1.0 + slowPush + zoomBurst) * (1 - returnMask) + 1.0 * returnMask;
    const maskOpacity = clamp(1 - smooth(9.0, 24.0, zoom) * (1 - returnMask));

    if (maskOpacity > 0.005) {
      mg.save();
      mg.setTransform(1, 0, 0, 1, 0, 0);
      mg.clearRect(0, 0, W, H);
      mg.globalCompositeOperation = 'source-over';
      mg.fillStyle = '#09090D';
      mg.fillRect(0, 0, W, H);

      const fontSize = fitFontSize(mg, word, '900', CJK_SANS, 1110, 268, 84);
      mg.font = `900 ${fontSize}px ${CJK_SANS}`;
      mg.textAlign = 'center';
      mg.textBaseline = 'middle';

      // Cut transparent lettering window out of the matte black mask
      mg.globalCompositeOperation = 'destination-out';
      mg.fillStyle = '#000000';
      mg.fillText(word, W / 2, H / 2 + 8);

      // Subtle editorial framing subtitles cut out while at 1x..1.5x
      mg.globalCompositeOperation = 'source-over';
      const metaFade = clamp(1 - lin(2.75, 3.15, t) + returnMask);
      if (metaFade > 0.01) {
        mg.globalAlpha = metaFade;
        mg.font = `700 13px ${MONO}`;
        mg.fillStyle = 'rgba(248, 250, 252, 0.62)';
        mg.textAlign = 'left';
        mg.fillText('ANAMORPHIC 65MM // LIVE KNOCKOUT APERTURE', 78, 72);
        mg.textAlign = 'right';
        mg.fillText('COUNTER ZOOM 1.0X → FULL BLEED', W - 78, 72);

        mg.textAlign = 'center';
        mg.fillStyle = 'rgba(252, 211, 125, 0.78)';
        mg.fillText('THROUGH THE LETTERING INTO THE FRAME', W / 2, H - 68);
      }
      mg.restore();

      // Draw zoomed knockout mask around frame center
      g.save();
      g.globalAlpha = maskOpacity;
      g.translate(W / 2, H / 2);
      g.scale(zoom, zoom);
      g.translate(-W / 2, -H / 2);
      g.drawImage(maskCanvas, 0, 0, W, H);
      g.restore();
    }

    g.restore();
  }

  return { canvas, ready: ensureFonts(), frame };
}

// ============================================================================
// 5. svg-hand-circle (variant, stacks: ['svg', 'css'], period: 4.8, hero: 2.4)
// ============================================================================
let svgStyleInjected = false;
function injectSvgHandStyles() {
  if (svgStyleInjected || typeof document === 'undefined') return;
  svgStyleInjected = true;
  const st = document.createElement('style');
  st.id = 'fx-editorial-svg-style';
  st.textContent = `
    .fx-ehc-wrap { position: relative; width: 100%; height: 100%; overflow: hidden; background: #fbf3e8; display: block; }
    .fx-ehc-svg { width: 100%; height: 100%; display: block; }
    .fx-ehc-row-hi { transition: opacity 0.1s linear; }
  `;
  document.head.appendChild(st);
}

function buildSvgHandCircle() {
  injectSvgHandStyles();
  const PERIOD = 4.8;
  const root = document.createElement('div');
  root.className = 'fill fx-ehc-wrap';

  const rows = [
    ['Net Dollar Retention', '118.2%', '124.6%', '129.1%', '134.8%', '+16.6 pts', true],
    ['Subscription Gross Margin', '78.4%', '79.9%', '81.1%', '82.4%', '+4.0 pts', false],
    ['CAC Payback Period', '9.4 mo', '7.8 mo', '6.1 mo', '5.2 mo', '-4.2 mo', false],
    ['Free Cash Flow Margin', '14.0%', '19.5%', '24.2%', '29.6%', '+15.6 pts', false],
  ];

  // Organic double-loop hand-drawn marker path around "134.8%" cell (center ~ 1126, 392)
  const circlePathD = [
    'M 1034 366',
    'C 1068 334, 1188 332, 1218 368',
    'C 1244 400, 1212 438, 1128 442',
    'C 1044 446, 1010 408, 1032 372',
    'C 1054 338, 1194 340, 1224 376',
    'C 1242 398, 1216 432, 1152 438',
  ].join(' ');

  // Hand-drawn double underline beneath "82.4%" (center ~ 1126, 490)
  const underlinePathD = 'M 1050 518 Q 1126 511 1204 517 M 1058 528 Q 1130 523 1196 527';

  // Curved margin arrow from right-hand margin note (1410, 250) to circled 134.8% (1228, 356)
  const arrowShaftD = 'M 1425 262 C 1396 312, 1328 344, 1242 358';
  const arrowHeadD = 'M 1266 338 L 1238 359 L 1272 372';

  root.innerHTML = `
    <svg class="svgfill fx-ehc-svg" viewBox="0 0 1600 900" aria-hidden="true">
      <rect width="1600" height="900" fill="#FBF3E8"/>
      <rect x="76" y="68" width="1448" height="764" rx="18" fill="#FFFDF9" stroke="#E5D8C5" stroke-width="2"/>

      <text x="128" y="138" font-family="'JetBrains Mono', monospace" font-size="20" font-weight="700" fill="#8C7A65" letter-spacing="2">OPERATING BRIEF · Q3 UNIT ECONOMICS</text>
      <text class="fx-ehc-title" x="128" y="198" font-family="'Instrument Serif', Georgia, serif" font-size="56" fill="#1B1917">Enterprise Cohort Expansion</text>
      <line x1="128" y1="228" x2="1472" y2="228" stroke="#1B1917" stroke-width="2.5"/>

      <!-- Column headers -->
      <g font-family="'JetBrains Mono', monospace" font-size="19" font-weight="700" fill="#786B59">
        <text x="128" y="284">METRIC</text>
        <text x="650" y="284" text-anchor="end">Q4 25</text>
        <text x="820" y="284" text-anchor="end">Q1 26</text>
        <text x="990" y="284" text-anchor="end">Q2 26</text>
        <text x="1185" y="284" text-anchor="end" fill="#1B1917">Q3 26</text>
        <text x="1390" y="284" text-anchor="end">YOY DELTA</text>
      </g>
      <line x1="128" y1="308" x2="1472" y2="308" stroke="#D9CBB7" stroke-width="1.5"/>

      <!-- Hero row warm highlight wash -->
      <rect class="fx-ehc-wash" x="116" y="338" width="1308" height="86" rx="12" fill="#FEF2E4" opacity="0"/>

      ${rows.map((r, i) => {
        const y = 392 + i * 98;
        const sepY = y + 48;
        return `
          <g class="fx-ehc-r">
            <text x="128" y="${y}" font-family="'Archivo', sans-serif" font-size="28" font-weight="${r[6] ? '800' : '600'}" fill="#1B1917">${r[0]}</text>
            <text x="650" y="${y}" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="26" fill="#6E6253">${r[1]}</text>
            <text x="820" y="${y}" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="26" fill="#6E6253">${r[2]}</text>
            <text x="990" y="${y}" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="26" fill="#6E6253">${r[3]}</text>
            <text x="1185" y="${y}" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="31" font-weight="700" fill="#1B1917">${r[4]}</text>
            <text x="1390" y="${y}" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="24" font-weight="700" fill="#15803D">${r[5]}</text>
            ${i < rows.length - 1 ? `<line x1="128" y1="${sepY}" x2="1472" y2="${sepY}" stroke="#EDE3D5" stroke-width="1.5"/>` : ''}
          </g>
        `;
      }).join('')}

      <!-- Hand-drawn translucent chisel-marker under-glow + crisp variable-feel core strokes -->
      <path class="fx-ehc-c-hi" d="${circlePathD}" fill="none" stroke="rgba(220, 38, 26, 0.24)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>
      <path class="fx-ehc-c-core" d="${circlePathD}" fill="none" stroke="#D9261C" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>

      <path class="fx-ehc-u-hi" d="${underlinePathD}" fill="none" stroke="rgba(220, 38, 26, 0.22)" stroke-width="13" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>
      <path class="fx-ehc-u-core" d="${underlinePathD}" fill="none" stroke="#D9261C" stroke-width="5" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>

      <path class="fx-ehc-a-shaft" d="${arrowShaftD}" fill="none" stroke="#1D4ED8" stroke-width="5.5" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>
      <path class="fx-ehc-a-head" d="${arrowHeadD}" fill="none" stroke="#1D4ED8" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>

      <g class="fx-ehc-note" transform="translate(1415 218) rotate(-5)" opacity="0">
        <rect x="-148" y="-38" width="236" height="58" rx="10" fill="#EFF6FF" stroke="#93C5FD" stroke-width="2"/>
        <text class="fx-ehc-note-txt" x="-30" y="-1" text-anchor="middle" font-family="'Instrument Serif', Georgia, serif" font-style="italic" font-size="34" fill="#1D4ED8">Record expansion!</text>
      </g>

      <text x="128" y="794" font-family="'JetBrains Mono', monospace" font-size="18" fill="#8C7A65">AUDITED LEDGER · TABULAR NUMERALS</text>
      <text x="1472" y="794" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="18" fill="#D9261C">HAND-MARKED REVIEW</text>
    </svg>
  `;

  const q = (sel) => root.querySelector(sel);
  const cHi = q('.fx-ehc-c-hi');
  const cCore = q('.fx-ehc-c-core');
  const uHi = q('.fx-ehc-u-hi');
  const uCore = q('.fx-ehc-u-core');
  const aShaft = q('.fx-ehc-a-shaft');
  const aHead = q('.fx-ehc-a-head');
  const wash = q('.fx-ehc-wash');
  const note = q('.fx-ehc-note');
  const noteTxt = q('.fx-ehc-note-txt');

  function setDraw(el, k) {
    const clamped = clamp(k);
    el.setAttribute('stroke-dashoffset', (1 - clamped).toFixed(4));
    el.style.opacity = clamped > 0.002 ? '1' : '0';
  }

  function frame(time, opts = {}) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    const custom = getCustomText(opts, 24);
    noteTxt.textContent = custom || 'Record expansion!';

    const eraseK = inOutCubic(lin(4.18, 4.68, t));
    const keep = 1 - eraseK;

    // 1. Double-loop vermilion marker circle (0.45..1.35s)
    const circleK = inOutCubic(lin(0.45, 1.35, t)) * keep;
    setDraw(cHi, circleK);
    setDraw(cCore, circleK);
    wash.setAttribute('opacity', (0.85 * smooth(0.45, 0.95, t) * keep).toFixed(3));

    // 2. Double-stroke hand underline beneath 82.4% (1.42..1.92s)
    const underK = outCubic(lin(1.42, 1.92, t)) * keep;
    setDraw(uHi, underK);
    setDraw(uCore, underK);

    // 3. Margin note pop + curved cobalt arrow (1.88..2.34s -> fully crisp at hero=2.4!)
    const noteK = clamp(springValue(t - 1.82, 0.68, 22), 0, 1.1) * keep;
    note.setAttribute('opacity', clamp(noteK * 1.2).toFixed(3));
    note.setAttribute(
      'transform',
      `translate(1415 ${(218 + (1 - noteK) * 18).toFixed(1)}) rotate(-5) scale(${(0.85 + 0.15 * noteK).toFixed(3)})`
    );

    const shaftK = outCubic(lin(1.94, 2.24, t)) * keep;
    const headK = outCubic(lin(2.18, 2.36, t)) * keep;
    setDraw(aShaft, shaftK);
    setDraw(aHead, headK);
  }

  return { element: root, canvas: root, ready: ensureFonts(), frame };
}

export const studies = [
  {
    id: 'type-editorial-strike',
    name: 'Editorial marker strike and revision',
    kind: 'type',
    grade: 'A',
    stacks: ['canvas'],
    period: 5.2,
    hero: 2.6,
    aspect: '16 / 9',
    chips: ['pressure-varied marker', 'caret + tilted serif', 'FX_CUSTOM_TEXT'],
    purpose: 'On warm cotton broadsheet paper, a vermilion felt-marker slashes through a printed claim while a proofreader caret and tilted italic correction write in above it.',
  },
  {
    id: 'type-cipher',
    name: 'Cryptographic glyph lock',
    kind: 'type',
    grade: 'A',
    stacks: ['canvas'],
    period: 4.8,
    hero: 2.1,
    aspect: '16 / 9',
    chips: ['4-strata glyph scramble', 'left-to-right phosphor lock', 'FX_CUSTOM_TEXT'],
    purpose: 'Characters cycle deterministically through block density, Katakana, hex and symbol strata before locking left-to-right with an emerald phosphor flash.',
  },
  {
    id: 'type-split-cut',
    name: 'Laser midline split and shear',
    kind: 'type',
    grade: 'A',
    stacks: ['canvas'],
    period: 4.8,
    hero: 1.8,
    aspect: '16 / 9',
    chips: ['half-plane polygon clip', 'spring shear recoil', 'FX_CUSTOM_TEXT'],
    purpose: 'An incandescent diagonal laser slices heavy display type in two, shearing upper and lower half-planes apart with spring recoil before snapping shut.',
  },
  {
    id: 'type-knockout',
    name: 'Live cinema knockout and counter zoom',
    kind: 'type',
    grade: 'A',
    stacks: ['canvas'],
    period: 5.6,
    hero: 2.5,
    aspect: '16 / 9',
    chips: ['destination-out type mask', 'procedural golden-hour vista', 'counter zoom-through'],
    purpose: 'Heavy condensed display lettering acts as a live knockout aperture onto a moving golden-hour ocean vista before zooming through the centre counter to full bleed.',
  },
  {
    id: 'svg-hand-circle',
    name: 'Hand-drawn financial table marks',
    kind: 'ui',
    grade: 'A',
    stacks: ['svg', 'css'],
    period: 4.8,
    hero: 2.4,
    aspect: '16 / 9',
    chips: ['double-loop Bézier circle', 'dual-layer marker stroke', 'curved margin arrow'],
    purpose: 'Organic double-loop marker circles, underlines and a curved margin arrow draw progressively over key cohort figures on an editorial financial table.',
  },
];

export async function create(id, options = {}) {
  const builders = {
    'type-editorial-strike': buildEditorialStrike,
    'type-cipher': buildTypeCipher,
    'type-split-cut': buildTypeSplitCut,
    'type-knockout': buildTypeKnockout,
    'svg-hand-circle': buildSvgHandCircle,
  };
  const fn = builders[id];
  if (!fn) throw new Error('Unknown editorial demo: ' + id);
  const inst = fn(options);
  await inst.ready;
  return inst;
}
