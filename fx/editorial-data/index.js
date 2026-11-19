// Editorial Dual-Axis Charts, Animated Decision Trees & Vector Bézier Construction (0BSD).
// Pure deterministic frame(t, options) on 1280x720 (16:9) Canvas 2D.

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
const spring = (u, zeta = 0.66, omega = 18) => {
  if (u <= 0) return 0;
  const wd = omega * Math.sqrt(Math.max(0.001, 1 - zeta * zeta));
  const env = Math.exp(-zeta * omega * u);
  return 1 - env * (Math.cos(wd * u) + ((zeta * omega) / wd) * Math.sin(wd * u));
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

function drawPolylineProgress(g, pts, progress) {
  if (progress <= 0 || pts.length < 2) return pts[0];
  let total = 0;
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segs.push(len);
    total += len;
  }
  const target = total * clamp(progress);
  let acc = 0;
  let tip = pts[0];
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const len = segs[i - 1];
    if (acc + len <= target) {
      g.lineTo(pts[i].x, pts[i].y);
      acc += len;
      tip = pts[i];
    } else {
      const u = len > 1e-6 ? (target - acc) / len : 0;
      tip = { x: lerp(pts[i - 1].x, pts[i].x, u), y: lerp(pts[i - 1].y, pts[i].y, u) };
      g.lineTo(tip.x, tip.y);
      break;
    }
  }
  g.stroke();
  return tip;
}

// ============================================================================
// 1. nyt-dual-chart (lead, kind: ui, period: 6.0, hero: 3.6)
// Broadsheet editorial dual-axis chart: staggered bars + synced rate curve
// ============================================================================
async function buildNytDualChart(options = {}) {
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 6.0;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  const DATA = [
    { q: 'Q1 ’24', rev: 18.4, conv: 2.1 },
    { q: 'Q2 ’24', rev: 23.8, conv: 2.4 },
    { q: 'Q3 ’24', rev: 29.2, conv: 2.9 },
    { q: 'Q4 ’24', rev: 36.5, conv: 3.3 },
    { q: 'Q1 ’25', rev: 41.0, conv: 3.6 },
    { q: 'Q2 ’25', rev: 49.6, conv: 4.1 },
    { q: 'Q3 ’25', rev: 58.2, conv: 4.5 },
    { q: 'Q4 ’25', rev: 67.4, conv: 4.8 },
  ];

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const sc = width / W;
    const headline = getCustomText(opts, 'Quarterly revenue triples while conversion climbs');

    g.save();
    g.scale(sc, sc);

    const outro = smooth(5.0, 5.92, t);
    const keep = 1 - outro;

    // Warm archival newsprint paper
    g.fillStyle = '#F7F4ED';
    g.fillRect(0, 0, W, H);

    // Editorial top bar rule
    const topBarP = outCubic(clamp(t / 0.45)) * keep;
    g.fillStyle = '#121212';
    g.fillRect(72, 46, 1136 * topBarP, 4);

    // Header block
    const headAlpha = smooth(0.08, 0.55, t);
    g.save();
    g.globalAlpha = headAlpha;
    g.fillStyle = '#B93822';
    g.font = `700 13px ${MONO}`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText('QUARTERLY BRIEFING  ·  DUAL-AXIS EDITORIAL CHART', 72, 62);

    g.fillStyle = '#141414';
    let hSize = headline.length > 42 ? 36 : 44;
    g.font = `400 ${hSize}px ${SERIF}`;
    g.fillText(headline, 72, 84);

    g.fillStyle = '#55524B';
    g.font = `500 16px ${SANS}`;
    g.fillText('Gross quarterly revenue ($M, bars) paired with checkout conversion rate (%, cobalt line)', 72, 138);
    g.restore();

    // Legend swatches (top right)
    const legAlpha = smooth(0.25, 0.7, t);
    g.save();
    g.globalAlpha = legAlpha;
    g.fillStyle = '#D9CFC0';
    g.fillRect(910, 140, 18, 14);
    g.fillStyle = '#1E1D1B';
    g.font = `700 13px ${SANS}`;
    g.fillText('Revenue ($M)', 936, 141);

    g.strokeStyle = '#1D5DA0';
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(1058, 147);
    g.lineTo(1082, 147);
    g.stroke();
    g.fillStyle = '#1D5DA0';
    g.beginPath();
    g.arc(1070, 147, 4.5, 0, TAU);
    g.fill();
    g.fillStyle = '#1E1D1B';
    g.fillText('Conversion (%)', 1090, 141);
    g.restore();

    // Chart plot geometry
    const plotL = 112;
    const plotR = 1164;
    const plotT = 198;
    const plotB = 594;
    const plotW = plotR - plotL;
    const plotH = plotB - plotT;

    // Horizontal dotted gridlines + left/right axis ticks
    const gridAlpha = smooth(0.2, 0.7, t);
    g.save();
    g.globalAlpha = gridAlpha;
    for (let i = 0; i <= 4; i++) {
      const u = i / 4;
      const y = lerp(plotB, plotT, u);
      g.strokeStyle = i === 0 ? '#181818' : 'rgba(24, 24, 24, 0.14)';
      g.lineWidth = i === 0 ? 2 : 1;
      g.setLineDash(i === 0 ? [] : [4, 5]);
      g.beginPath();
      g.moveTo(plotL, y);
      g.lineTo(plotR, y);
      g.stroke();

      g.setLineDash([]);
      g.fillStyle = '#5F5B53';
      g.font = `600 13px ${MONO}`;
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      g.fillText(`$${Math.round(u * 96)}M`, plotL - 14, y);

      g.fillStyle = '#1D5DA0';
      g.textAlign = 'left';
      g.fillText(`${(u * 5.6).toFixed(1)}%`, plotR + 14, y);
    }
    g.restore();

    // Subtle shaded forecast / breakthrough window on last two quarters
    const bandAlpha = smooth(2.4, 3.0, t);
    if (bandAlpha > 0.01) {
      g.fillStyle = `rgba(29, 93, 160, ${(0.065 * bandAlpha).toFixed(3)})`;
      g.fillRect(plotL + plotW * 0.745, plotT, plotW * 0.255, plotH);
      g.fillStyle = `rgba(29, 93, 160, ${(0.86 * bandAlpha).toFixed(3)})`;
      g.font = `700 11px ${MONO}`;
      g.textAlign = 'center';
      g.fillText('NEW CHECKOUT', plotL + plotW * 0.872, plotT + 18);
    }

    // Bars (staggered damped spring rise)
    const slotW = plotW / DATA.length;
    const barW = slotW * 0.56;
    const curvePts = [];

    DATA.forEach((d, idx) => {
      const cx = plotL + slotW * (idx + 0.5);
      const start = 0.45 + idx * 0.15;
      const grow = clamp(spring((t - start) / 0.85, 0.70, 14), 0, 1.06);
      const bh = (d.rev / 96) * plotH * grow;
      const bx = cx - barW / 2;
      const by = plotB - bh;
      const isPeak = idx === DATA.length - 1;

      g.fillStyle = isPeak ? '#B93822' : idx >= 6 ? '#D68975' : '#D5CBB8';
      g.fillRect(bx, by, barW, Math.max(0, bh));

      // Top crisp accent cap on bars
      g.fillStyle = isPeak ? '#7F1D10' : '#9B907D';
      g.fillRect(bx, by, barW, Math.min(3, Math.max(0, bh)));

      // Direct tabular bar value label tucked cleanly inside the bar top so it never collides with curve above
      const lblA = smooth(start + 0.25, start + 0.65, t);
      if (lblA > 0.01 && bh > 28) {
        g.save();
        g.globalAlpha = lblA;
        g.fillStyle = isPeak ? '#FFF7EB' : '#262420';
        g.font = `700 13px ${MONO}`;
        g.textAlign = 'center';
        g.textBaseline = 'top';
        g.fillText(`$${d.rev.toFixed(1)}`, cx, by + 10);
        g.restore();
      }

      // X-axis quarter label
      g.fillStyle = '#3A3834';
      g.font = `600 13px ${SANS}`;
      g.textAlign = 'center';
      g.textBaseline = 'top';
      g.fillText(d.q, cx, plotB + 12);

      // Conversion line point floats cleanly above all bar tops
      const cy = plotB - (d.conv / 5.6) * plotH;
      curvePts.push({ x: cx, y: cy, d });
    });

    // Secondary-axis conversion line draws smoothly left-to-right
    const lineProg = smooth(1.25, 3.35, t);
    if (lineProg > 0.005) {
      g.save();
      // White halo behind cobalt line for editorial legibility over bars
      g.strokeStyle = '#F7F4ED';
      g.lineWidth = 8;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      drawPolylineProgress(g, curvePts, lineProg);

      g.strokeStyle = '#1D5DA0';
      g.lineWidth = 3.8;
      const tip = drawPolylineProgress(g, curvePts, lineProg);

      // Nodes appear as line passes each quarter
      curvePts.forEach((pt, idx) => {
        const threshold = idx / (curvePts.length - 1);
        const pop = clamp(spring((lineProg - threshold + 0.02) / 0.14, 0.65, 16), 0, 1.15);
        if (pop > 0.02) {
          g.fillStyle = '#F7F4ED';
          g.beginPath();
          g.arc(pt.x, pt.y, 6.5 * pop, 0, TAU);
          g.fill();
          g.fillStyle = '#1D5DA0';
          g.beginPath();
          g.arc(pt.x, pt.y, 4.2 * pop, 0, TAU);
          g.fill();
        }
      });

      // Live tracking pulse at drawing tip
      if (lineProg < 0.995 && tip) {
        g.fillStyle = 'rgba(29, 93, 160, 0.25)';
        g.beginPath();
        g.arc(tip.x, tip.y, 13, 0, TAU);
        g.fill();
      }
      g.restore();
    }

    // Editorial peak callout pin positioned cleanly in open space left of the shaded band
    const calloutA = smooth(3.15, 3.65, t);
    if (calloutA > 0.01) {
      const peak = curvePts[curvePts.length - 1];
      const boxX = plotL + plotW * 0.44;
      const boxY = plotT + 20;
      const boxW = 248;
      const boxH = 56;
      g.save();
      g.globalAlpha = calloutA;
      g.strokeStyle = '#141414';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(peak.x - 10, peak.y - 2);
      g.lineTo(boxX + boxW + 24, boxY + boxH * 0.5);
      g.lineTo(boxX + boxW, boxY + boxH * 0.5);
      g.stroke();

      rrect(g, boxX, boxY, boxW, boxH, 6);
      g.fillStyle = '#141414';
      g.fill();
      g.fillStyle = '#F7F4ED';
      g.font = `700 14px ${MONO}`;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText('PEAK 4.8% (+128% YoY)', boxX + 16, boxY + 20);
      g.fillStyle = '#FCA5A5';
      g.font = `600 12px ${SANS}`;
      g.fillText('$67.4M quarterly record', boxX + 16, boxY + 40);
      g.restore();
    }

    // Footer source note
    g.fillStyle = '#757067';
    g.font = `500 12px ${MONO}`;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText('SOURCE: ILLUSTRATIVE SAMPLE COHORT DATA · TABULAR PROJECTION', 72, 668);
    g.textAlign = 'right';
    g.fillText(`T = ${t.toFixed(2)}s`, 1208, 668);
    if (outro > 0.001) {
      g.fillStyle = `rgba(247, 244, 237, ${outro.toFixed(3)})`;
      g.fillRect(0, 0, W, H);
    }
    g.restore();
  }

  frame(3.6, options);
  return { canvas, frame, period: PERIOD, hero: 3.6 };
}

// ============================================================================
// 2. decision-tree (variant of nyt-dual-chart, kind: ui, period: 5.8, hero: 3.4)
// Orthogonal 3-tier branching decision tree with winning-path illumination
// ============================================================================
async function buildDecisionTree(options = {}) {
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 5.8;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  // 3-tier tree layout in 1280x720 space
  const NODES = {
    root: { x: 640, y: 158, w: 300, h: 72, title: 'Traffic Spike > 2.5×?', tag: 'GATE 01', active: true, at: 0.2 },
    l1: { x: 350, y: 344, w: 268, h: 70, title: 'Cache Hit > 90%?', tag: 'YES · 68%', active: true, at: 1.35 },
    r1: { x: 930, y: 344, w: 268, h: 70, title: 'Origin CPU > 75%?', tag: 'NO · 32%', active: false, at: 1.35 },
    ll: { x: 200, y: 544, w: 212, h: 74, title: 'Serve Edge', tag: '12 ms · OPTIMAL', active: true, win: true, at: 2.55 },
    lr: { x: 500, y: 544, w: 212, h: 74, title: 'Warm Pool', tag: '42 ms · SCALE', active: false, at: 2.55 },
    rl: { x: 780, y: 544, w: 212, h: 74, title: 'Burst Nodes', tag: '85 ms · QUEUE', active: false, at: 2.55 },
    rr: { x: 1080, y: 544, w: 212, h: 74, title: 'Failover DR', tag: '140 ms · SAFE', active: false, at: 2.55 },
  };

  const EDGES = [
    { from: 'root', to: 'l1', midY: 250, label: 'YES', active: true, start: 0.65, end: 1.35 },
    { from: 'root', to: 'r1', midY: 250, label: 'NO', active: false, start: 0.65, end: 1.35 },
    { from: 'l1', to: 'll', midY: 444, label: 'YES', active: true, start: 1.85, end: 2.55 },
    { from: 'l1', to: 'lr', midY: 444, label: 'NO', active: false, start: 1.85, end: 2.55 },
    { from: 'r1', to: 'rl', midY: 444, label: 'YES', active: false, start: 1.85, end: 2.55 },
    { from: 'r1', to: 'rr', midY: 444, label: 'NO', active: false, start: 1.85, end: 2.55 },
  ];

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const sc = width / W;
    const customRoot = getCustomText(opts, '');

    g.save();
    g.scale(sc, sc);

    // Clean technical light blueprint canvas
    g.fillStyle = '#F4F6FA';
    g.fillRect(0, 0, W, H);
    // Subtle dot grid
    g.fillStyle = 'rgba(15, 23, 42, 0.08)';
    for (let y = 32; y < H; y += 32) {
      for (let x = 32; x < W; x += 32) {
        g.fillRect(x, y, 2, 2);
      }
    }

    // Header
    g.fillStyle = '#0F172A';
    g.font = `900 26px ${SANS}`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(customRoot || 'AUTOMATED ROUTING DECISION TREE', 60, 42);
    g.fillStyle = '#64748B';
    g.font = `600 13px ${MONO}`;
    g.fillText('DETERMINISTIC BRANCH EVALUATION  ·  ACTIVE PATH LOCK', 60, 76);

    const focusLock = smooth(3.0, 3.65, t);

    // Draw orthogonal elbow connectors
    for (const edge of EDGES) {
      const a = NODES[edge.from];
      const b = NODES[edge.to];
      const prog = smooth(edge.start, edge.end, t);
      if (prog <= 0.005) continue;

      const pts = [
        { x: a.x, y: a.y + a.h / 2 },
        { x: a.x, y: edge.midY },
        { x: b.x, y: edge.midY },
        { x: b.x, y: b.y - b.h / 2 },
      ];
      const dim = edge.active ? 1 : lerp(1, 0.25, focusLock);

      g.save();
      g.globalAlpha = dim;
      g.strokeStyle = edge.active ? '#2563EB' : '#94A3B8';
      g.lineWidth = edge.active ? lerp(3, 4.5, focusLock) : 2.5;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      drawPolylineProgress(g, pts, prog);

      // Branch YES/NO pill badge
      if (prog > 0.55) {
        const bx = lerp(a.x, b.x, 0.55);
        const by = edge.midY;
        rrect(g, bx - 26, by - 12, 52, 24, 12);
        g.fillStyle = edge.active ? '#2563EB' : '#E2E8F0';
        g.fill();
        g.fillStyle = edge.active ? '#FFFFFF' : '#475569';
        g.font = `700 11px ${MONO}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(edge.label, bx, by + 0.5);
      }
      g.restore();
    }

    // Draw nodes with damped spring pop
    for (const [key, n] of Object.entries(NODES)) {
      const pop = clamp(spring((t - n.at) / 0.65, 0.65, 16), 0, 1.12);
      if (pop <= 0.01) continue;
      const dim = n.active ? 1 : lerp(1, 0.30, focusLock);

      g.save();
      g.globalAlpha = dim;
      g.translate(n.x, n.y);
      g.scale(pop, pop);

      // Soft cast shadow
      g.shadowColor = n.win && focusLock > 0.2 ? 'rgba(16, 185, 129, 0.28)' : 'rgba(15, 23, 42, 0.12)';
      g.shadowBlur = n.win ? 26 : 16;
      g.shadowOffsetY = 8;

      rrect(g, -n.w / 2, -n.h / 2, n.w, n.h, 14);
      g.fillStyle = n.win ? '#064E3B' : n.active ? '#FFFFFF' : '#F8FAFC';
      g.fill();
      g.shadowBlur = 0;
      g.shadowOffsetY = 0;

      g.strokeStyle = n.win ? '#10B981' : n.active ? '#2563EB' : '#CBD5E1';
      g.lineWidth = n.active ? 2.8 : 1.8;
      g.stroke();

      // Tag eyebrow
      g.fillStyle = n.win ? '#6EE7B7' : n.active ? '#2563EB' : '#64748B';
      g.font = `700 11px ${MONO}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(n.tag, 0, -14);

      // Node title
      g.fillStyle = n.win ? '#FFFFFF' : '#0F172A';
      g.font = `800 ${key === 'root' ? 20 : 18}px ${SANS}`;
      g.fillText(n.title, 0, 11);

      // Winning checkmark halo badge
      if (n.win && focusLock > 0.05) {
        const badgeS = clamp(spring((t - 3.1) / 0.55, 0.58, 18), 0, 1.2);
        g.save();
        g.translate(n.w / 2 - 4, -n.h / 2 + 4);
        g.scale(badgeS, badgeS);
        g.fillStyle = '#10B981';
        g.beginPath();
        g.arc(0, 0, 16, 0, TAU);
        g.fill();
        g.strokeStyle = '#FFFFFF';
        g.lineWidth = 3;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(-6, 0);
        g.lineTo(-1.5, 4.5);
        g.lineTo(6.5, -4.5);
        g.stroke();
        g.restore();
      }
      g.restore();
    }

    g.restore();
  }

  frame(3.4, options);
  return { canvas, frame, period: PERIOD, hero: 3.4 };
}

// ============================================================================
// 3. vector-bezier-draw (lead, kind: motion, period: 6.0, hero: 3.1)
// Precision vector pen tool, Bézier control levers, width caliper & enamel fill
// ============================================================================
async function buildVectorBezierDraw(options = {}) {
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 6.0;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  // Seeded subtle paper print grain tile for enamel poster finish
  const grainTile = document.createElement('canvas');
  grainTile.width = 64;
  grainTile.height = 64;
  const gg = grainTile.getContext('2d');
  const img = gg.createImageData(64, 64);
  let seed = 1337;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = (seed >>> 24) & 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 26;
  }
  gg.putImageData(img, 0, 0);

  function cubicPt(p0, p1, p2, p3, u) {
    const v = 1 - u;
    return {
      x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x,
      y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y,
    };
  }

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const sc = width / W;
    const customLabel = getCustomText(opts, 'PAPERWING');

    g.save();
    g.scale(sc, sc);

    // Phase progress values:
    // 0.0-2.0s: Pen draws symmetric Bézier wing contour + pulls handles
    // 2.0-3.6s: Variable-width caliper swells stroke profile (hero=3.1)
    // 3.6-5.2s: Enamel gradient flood & color-picker dial reveal
    // 5.2-6.0s: Clean dissolve back to drafting sheet
    const drawP = smooth(0.15, 1.95, t);
    const widthP = smooth(2.05, 3.35, t);
    const fillP = smooth(3.45, 4.45, t) * (1 - smooth(5.35, 5.95, t));
    const uiFade = 1 - smooth(3.85, 4.55, t) + smooth(5.45, 5.95, t);

    // Warm cream drafting artboard -> dark velvet poster shift during enamel reveal
    g.fillStyle = '#F5F2EA';
    g.fillRect(0, 0, W, H);
    if (fillP > 0.01) {
      g.save();
      g.globalAlpha = fillP;
      const bg = g.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#1B142E');
      bg.addColorStop(1, '#2E1E4A');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      g.restore();
    }

    // Subtle CAD drafting grid (visible during construction)
    if (uiFade > 0.02) {
      g.save();
      g.globalAlpha = 0.42 * uiFade;
      g.strokeStyle = 'rgba(37, 99, 235, 0.14)';
      g.lineWidth = 1;
      for (let x = 80; x < W; x += 64) {
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
      }
      for (let y = 56; y < H; y += 64) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
      }
      // Symmetry center axis
      g.strokeStyle = 'rgba(239, 68, 68, 0.35)';
      g.setLineDash([6, 6]);
      g.beginPath(); g.moveTo(W / 2, 70); g.lineTo(W / 2, H - 70); g.stroke();
      g.setLineDash([]);
      g.restore();
    }

    // Symmetrical winged emblem geometry around (640, 340)
    const cx = 640, cy = 340;
    const handleSpread = lerp(0.35, 1.0, outCubic(clamp((t - 0.55) / 1.4)));
    // Right wing upper cubic curve + lower return cubic curve
    const A0 = { x: cx, y: cy - 30 };
    const C1 = { x: cx + 110 * handleSpread, y: cy - 220 * handleSpread };
    const C2 = { x: cx + 335 * handleSpread, y: cy - 175 * handleSpread };
    const A1 = { x: cx + 310, y: cy - 20 };
    const C3 = { x: cx + 285 * handleSpread, y: cy + 120 * handleSpread };
    const C4 = { x: cx + 115 * handleSpread, y: cy + 165 * handleSpread };
    const A2 = { x: cx, y: cy + 108 };

    // Sample dense curve points for progressive draw & variable-width taper
    const seg1 = [];
    const seg2 = [];
    for (let i = 0; i <= 40; i++) {
      seg1.push(cubicPt(A0, C1, C2, A1, i / 40));
      seg2.push(cubicPt(A1, C3, C4, A2, i / 40));
    }
    const rightLoop = [...seg1, ...seg2.slice(1)];

    // Draw mirrored enamel fills when fillP > 0
    if (fillP > 0.01) {
      g.save();
      g.globalAlpha = fillP;
      for (const sgn of [1, -1]) {
        g.save();
        g.translate(cx, 0);
        g.scale(sgn, 1);
        g.translate(-cx, 0);
        g.beginPath();
        g.moveTo(A0.x, A0.y);
        g.bezierCurveTo(C1.x, C1.y, C2.x, C2.y, A1.x, A1.y);
        g.bezierCurveTo(C3.x, C3.y, C4.x, C4.y, A2.x, A2.y);
        g.closePath();
        const eg = g.createLinearGradient(cx, cy - 180, cx + 320, cy + 140);
        eg.addColorStop(0, '#FFE47A');
        eg.addColorStop(0.52, '#FF7B54');
        eg.addColorStop(1, '#5B50F0');
        g.fillStyle = eg;
        g.fill();

        // Inner sunlit inlay wing facet
        g.beginPath();
        g.moveTo(cx + 26, cy - 10);
        g.bezierCurveTo(cx + 110, cy - 135, cx + 240, cy - 105, cx + 236, cy - 16);
        g.bezierCurveTo(cx + 200, cy + 56, cx + 92, cy + 84, cx + 26, cy + 48);
        g.closePath();
        g.fillStyle = 'rgba(255, 248, 206, 0.42)';
        g.fill();
        g.restore();
      }
      g.restore();
    }

    // Draw progressive variable-width vector contour (mirrored left + right)
    const maxStrokeW = lerp(3.5, 16, widthP);
    for (const sgn of [1, -1]) {
      g.save();
      g.translate(cx, 0);
      g.scale(sgn, 1);
      g.translate(-cx, 0);
      const count = Math.max(2, Math.floor(rightLoop.length * drawP));
      for (let i = 1; i < count; i++) {
        const u = i / (rightLoop.length - 1);
        const taper = 0.28 + 0.72 * Math.sin(u * Math.PI);
        g.strokeStyle = fillP > 0.5 ? '#FFF4C8' : '#111827';
        g.lineWidth = lerp(3.2, maxStrokeW * taper, widthP);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(rightLoop[i - 1].x, rightLoop[i - 1].y);
        g.lineTo(rightLoop[i].x, rightLoop[i].y);
        g.stroke();
      }
      g.restore();
    }

    // Center diamond spine
    const spinePop = clamp(spring((t - 1.55) / 0.6, 0.62, 16), 0, 1.15);
    if (spinePop > 0.02) {
      g.save();
      g.translate(cx, cy + 28);
      g.scale(spinePop, spinePop);
      g.beginPath();
      g.moveTo(0, -108);
      g.lineTo(18, 0);
      g.lineTo(0, 108);
      g.lineTo(-18, 0);
      g.closePath();
      g.fillStyle = fillP > 0.4 ? '#FFE999' : '#111827';
      g.fill();
      g.restore();
    }

    // Interactive Vector UI overlays (Bézier handles, anchor squares, width caliper)
    if (uiFade > 0.02) {
      g.save();
      g.globalAlpha = clamp(uiFade, 0, 1);
      const drawHandle = (a, c) => {
        g.strokeStyle = '#2563EB';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(c.x, c.y); g.stroke();
        g.fillStyle = '#FFFFFF';
        g.beginPath(); g.arc(c.x, c.y, 6, 0, TAU); g.fill();
        g.stroke();
      };
      if (drawP > 0.15) {
        drawHandle(A0, C1);
        drawHandle(A1, C2);
      }
      if (drawP > 0.55) {
        drawHandle(A1, C3);
        drawHandle(A2, C4);
      }
      // Crisp anchor node squares
      for (const pt of [A0, A1, A2]) {
        g.fillStyle = '#FFFFFF';
        g.strokeStyle = '#2563EB';
        g.lineWidth = 2.4;
        g.fillRect(pt.x - 6, pt.y - 6, 12, 12);
        g.strokeRect(pt.x - 6, pt.y - 6, 12, 12);
      }

      // Live variable-width caliper indicator along upper wing crest during Phase 2
      if (t >= 1.95 && t <= 4.1) {
        const calIdx = Math.floor(lerp(10, 32, widthP));
        const cp = rightLoop[clamp(calIdx, 0, rightLoop.length - 1)];
        const span = lerp(16, 46, widthP);
        g.strokeStyle = '#EF4444';
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(cp.x, cp.y - span);
        g.lineTo(cp.x, cp.y + span);
        g.stroke();
        for (const dy of [-span, span]) {
          g.fillStyle = '#EF4444';
          g.beginPath();
          g.arc(cp.x, cp.y + dy, 5.5, 0, TAU);
          g.fill();
        }
        rrect(g, cp.x + 18, cp.y - 16, 108, 30, 6);
        g.fillStyle = '#111827';
        g.fill();
        g.fillStyle = '#F8FAFC';
        g.font = `700 12px ${MONO}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(`W: ${maxStrokeW.toFixed(1)} px`, cp.x + 72, cp.y - 1);
      }

      // Live drafting pen cursor following drawing tip in Phase 1
      if (drawP > 0.01 && drawP < 0.99) {
        const idx = Math.min(rightLoop.length - 1, Math.floor(drawP * (rightLoop.length - 1)));
        const tip = rightLoop[idx];
        g.save();
        g.translate(tip.x, tip.y);
        g.fillStyle = '#111827';
        g.strokeStyle = '#FFFFFF';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(22, 12);
        g.lineTo(14, 16);
        g.lineTo(10, 24);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
      }
      g.restore();
    }

    // Color dial widget during Phase 3 transition
    const dialA = smooth(3.2, 3.6, t) * (1 - smooth(4.75, 5.15, t));
    if (dialA > 0.02) {
      g.save();
      g.globalAlpha = dialA;
      rrect(g, 82, 474, 210, 174, 16);
      g.fillStyle = 'rgba(255, 255, 255, 0.94)';
      g.fill();
      g.fillStyle = '#1E1B4B';
      g.font = `700 11px ${MONO}`;
      g.textAlign = 'left';
      g.fillText('ENAMEL SHADER DIAL', 102, 498);
      // Mini spectrum ring
      const dx = 187, dy = 568, dr = 42;
      for (let a = 0; a < 36; a++) {
        const ang0 = (a / 36) * TAU;
        const ang1 = ((a + 1.2) / 36) * TAU;
        g.strokeStyle = `hsl(${a * 10}, 86%, 60%)`;
        g.lineWidth = 10;
        g.beginPath();
        g.arc(dx, dy, dr, ang0, ang1);
        g.stroke();
      }
      const knobA = lerp(-2.2, 0.85, fillP);
      g.fillStyle = '#1E1B4B';
      g.beginPath();
      g.arc(dx + Math.cos(knobA) * dr, dy + Math.sin(knobA) * dr, 8, 0, TAU);
      g.fill();
      g.restore();
    }

    // Print grain overlay + editorial title footer
    if (fillP > 0.1) {
      g.save();
      g.globalAlpha = fillP * 0.45;
      const pat = g.createPattern(grainTile, 'repeat');
      if (pat) {
        g.fillStyle = pat;
        g.fillRect(0, 0, W, H);
      }
      g.restore();
    }

    g.fillStyle = fillP > 0.45 ? '#FFE999' : '#111827';
    g.font = `900 40px ${SANS}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(customLabel.toUpperCase(), W * 0.5, 608);

    g.fillStyle = fillP > 0.45 ? 'rgba(255, 233, 153, 0.72)' : '#64748B';
    g.font = `600 13px ${MONO}`;
    g.fillText('CUBIC BÉZIER HANDLES  ·  VARIABLE WIDTH CALIPER  ·  ENAMEL FILL', W * 0.5, 650);

    g.restore();
  }

  frame(3.1, options);
  return { canvas, frame, period: PERIOD, hero: 3.1 };
}

export async function create(id, options = {}) {
  if (id === 'nyt-dual-chart') return buildNytDualChart(options);
  if (id === 'decision-tree') return buildDecisionTree(options);
  if (id === 'vector-bezier-draw') return buildVectorBezierDraw(options);
  throw new Error(`Unknown editorial-data effect id: ${id}`);
}
