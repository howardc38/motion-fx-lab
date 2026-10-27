// SaaS Product & Cursor Stage effects (0BSD).
// Pure deterministic frame(t) implementations on a 1280x720 (16:9) stage.

const W = 1280;
const H = 720;
const TAU = Math.PI * 2;
const SANS = '"Archivo", "Helvetica Neue", -apple-system, Arial, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';
const SERIF = '"Instrument Serif", Georgia, serif';

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

function springValue(u, zeta = 0.68, omega = 22) {
  if (u <= 0) return 0;
  const wd = omega * Math.sqrt(Math.max(0.001, 1 - zeta * zeta));
  const env = Math.exp(-zeta * omega * u);
  return 1 - env * (Math.cos(wd * u) + ((zeta * omega) / wd) * Math.sin(wd * u));
}

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function getCustomText(opts) {
  const direct = typeof opts?.text === 'string' ? opts.text.trim() : '';
  if (direct) return direct.slice(0, 36);
  const globalText = typeof globalThis !== 'undefined' && typeof globalThis.FX_CUSTOM_TEXT === 'string'
    ? globalThis.FX_CUSTOM_TEXT.trim()
    : '';
  return globalText ? globalText.slice(0, 36) : '';
}

function rrect(g, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  g.beginPath();
  if (g.roundRect) {
    g.roundRect(x, y, w, h, rad);
  } else {
    g.moveTo(x + rad, y);
    g.arcTo(x + w, y, x + w, y + h, rad);
    g.arcTo(x + w, y + h, x, y + h, rad);
    g.arcTo(x, y + h, x, y, rad);
    g.arcTo(x, y, x + w, y, rad);
    g.closePath();
  }
}

function fillRRect(g, x, y, w, h, r, fill) {
  rrect(g, x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
}

function strokeRRect(g, x, y, w, h, r, stroke, lw = 1) {
  rrect(g, x, y, w, h, r);
  g.strokeStyle = stroke;
  g.lineWidth = lw;
  g.stroke();
}

// Piecewise Cubic Hermite (Catmull-Rom tangent) spline evaluation.
function evalHermitePath(waypoints, t) {
  const n = waypoints.length;
  if (t <= waypoints[0].t) return { x: waypoints[0].x, y: waypoints[0].y, vx: 0, vy: 0 };
  if (t >= waypoints[n - 1].t) return { x: waypoints[n - 1].x, y: waypoints[n - 1].y, vx: 0, vy: 0 };
  let i = 0;
  while (i < n - 2 && t >= waypoints[i + 1].t) i++;
  const p0 = waypoints[Math.max(0, i - 1)];
  const p1 = waypoints[i];
  const p2 = waypoints[i + 1];
  const p3 = waypoints[Math.min(n - 1, i + 2)];
  const dt = Math.max(1e-4, p2.t - p1.t);
  const rawU = clamp((t - p1.t) / dt);
  // Smooth ease within segment while preserving Hermite curvature
  const u = rawU * rawU * (3 - 2 * rawU);
  const tension = 0.42;
  const m1x = p1.hold ? 0 : tension * (p2.x - p0.x);
  const m1y = p1.hold ? 0 : tension * (p2.y - p0.y);
  const m2x = p2.hold ? 0 : tension * (p3.x - p1.x);
  const m2y = p2.hold ? 0 : tension * (p3.y - p1.y);
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  const x = h00 * p1.x + h10 * m1x + h01 * p2.x + h11 * m2x;
  const y = h00 * p1.y + h10 * m1y + h01 * p2.y + h11 * m2y;
  const du = (6 * rawU * (1 - rawU)) / dt;
  const vx = ((6 * u2 - 6 * u) * (p1.x - p2.x) + (3 * u2 - 4 * u + 1) * m1x + (3 * u2 - 2 * u) * m2x) * du;
  const vy = ((6 * u2 - 6 * u) * (p1.y - p2.y) + (3 * u2 - 4 * u + 1) * m1y + (3 * u2 - 2 * u) * m2y) * du;
  return { x, y, vx, vy };
}

function drawPointerCursor(g, x, y, press = 0, scaleMul = 1) {
  g.save();
  g.translate(x, y);
  const s = scaleMul * (1 - 0.16 * press);
  g.scale(s, s);
  g.shadowColor = 'rgba(0, 0, 0, 0.48)';
  g.shadowBlur = 12 * (1 - 0.4 * press);
  g.shadowOffsetX = 2;
  g.shadowOffsetY = 5 * (1 - 0.4 * press);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 26);
  g.lineTo(6.8, 20.2);
  g.lineTo(11.6, 30.2);
  g.lineTo(15.8, 28.1);
  g.lineTo(11.1, 18.2);
  g.lineTo(19.2, 18.2);
  g.closePath();
  g.fillStyle = '#0F131C';
  g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 2.1;
  g.lineJoin = 'round';
  g.strokeStyle = '#FFFFFF';
  g.stroke();
  g.restore();
}

function drawClickRipple(g, x, y, u, color = '56, 189, 248') {
  if (u <= 0 || u > 0.75) return;
  const k = u / 0.75;
  const r1 = 8 + 56 * outCubic(k);
  const a1 = Math.pow(1 - k, 1.8) * 0.75;
  g.save();
  g.beginPath();
  g.arc(x, y, r1, 0, TAU);
  g.strokeStyle = `rgba(${color}, ${a1.toFixed(3)})`;
  g.lineWidth = 2.6 * (1 - 0.55 * k);
  g.stroke();
  if (u > 0.06) {
    const k2 = clamp((u - 0.06) / 0.65);
    g.beginPath();
    g.arc(x, y, 5 + 34 * outCubic(k2), 0, TAU);
    g.strokeStyle = `rgba(255, 255, 255, ${(Math.pow(1 - k2, 2) * 0.55).toFixed(3)})`;
    g.lineWidth = 1.5;
    g.stroke();
  }
  g.restore();
}

function makeSurface(width = W, height = H) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  return { canvas, g };
}

async function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  const sample = 'BESbswy0123456789 ·⌘⇧↵↑↓✓▸⚡◈⇄⊕';
  await Promise.allSettled([
    document.fonts.load(`400 16px ${SANS}`, sample),
    document.fonts.load(`500 14px ${SANS}`, sample),
    document.fonts.load(`500 18px ${SANS}`, sample),
    document.fonts.load(`600 16px ${SANS}`, sample),
    document.fonts.load(`600 18px ${SANS}`, sample),
    document.fonts.load(`700 15px ${SANS}`, sample),
    document.fonts.load(`700 32px ${SANS}`, sample),
    document.fonts.load(`800 46px ${SANS}`, sample),
    document.fonts.load(`900 32px ${SANS}`, sample),
    document.fonts.load(`500 13px ${MONO}`, sample),
    document.fonts.load(`600 13px ${MONO}`, sample),
    document.fonts.load(`700 11px ${MONO}`, sample),
    document.fonts.load(`700 16px ${MONO}`, sample),
    document.fonts.load(`800 28px ${MONO}`, sample),
    document.fonts.load(`400 24px ${SERIF}`, sample),
    document.fonts.load(`italic 400 32px ${SERIF}`, sample),
  ]);
  if (document.fonts.ready) await document.fonts.ready;
}

// ============================================================================
// 1. ui-cursor-loupe (lead, period: 6.0, hero: 2.6)
// ============================================================================
function buildCursorLoupe(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const { canvas, g } = makeSurface(width, height);
  const PERIOD = 6.0;

  const waypoints = [
    { t: 0.0, x: 260, y: 540, hold: true },
    { t: 0.85, x: 520, y: 390, hold: false },
    { t: 1.38, x: 836, y: 246, hold: true },
    { t: 2.55, x: 792, y: 252, hold: false },
    { t: 3.35, x: 928, y: 520, hold: true },
    { t: 4.35, x: 642, y: 422, hold: false },
    { t: 5.35, x: 260, y: 540, hold: true },
    { t: 6.0, x: 260, y: 540, hold: true },
  ];

  const baseSeries = [0.34, 0.39, 0.36, 0.45, 0.43, 0.51, 0.49, 0.56, 0.54, 0.61, 0.59, 0.64];
  const boostSeries = [0.38, 0.44, 0.46, 0.58, 0.63, 0.72, 0.75, 0.84, 0.86, 0.91, 0.94, 0.97];

  function paintDashboard(ctx, t, inLoupe = false) {
    // Studio dark backdrop
    const bg = ctx.createRadialGradient(W * 0.52, H * 0.28, 30, W * 0.5, H * 0.5, W * 0.78);
    bg.addColorStop(0, '#161D2F');
    bg.addColorStop(0.55, '#0C101B');
    bg.addColorStop(1, '#070910');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle precision dot matrix
    ctx.fillStyle = 'rgba(148, 163, 184, 0.09)';
    const step = 32;
    for (let y = 24; y < H; y += step) {
      for (let x = 24; x < W; x += step) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    const tClick1 = 1.42;
    const tClick2 = 3.42;
    const resetK = smooth(5.15, 5.65, t);
    const routed = clamp(springValue(t - tClick1, 0.68, 22), 0, 1.15) * (1 - resetK);
    const routedClamped = clamp(routed, 0, 1);
    const published = clamp(springValue(t - tClick2, 0.72, 24), 0, 1.12) * (1 - resetK);
    const pubClamped = clamp(published, 0, 1);

    // Ambient accent aura behind SaaS card
    const aura = ctx.createRadialGradient(780, 260, 10, 780, 260, 340);
    aura.addColorStop(0, `rgba(45, 212, 191, ${(0.08 + 0.14 * routedClamped).toFixed(3)})`);
    aura.addColorStop(0.55, `rgba(59, 130, 246, ${(0.08 + 0.08 * pubClamped).toFixed(3)})`);
    aura.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(140, 40, 1000, 620);

    // Main SaaS Product Card
    const cx = 190, cy = 96, cw = 900, ch = 528;
    if (!inLoupe) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.58)';
      ctx.shadowBlur = 48;
      ctx.shadowOffsetY = 24;
      fillRRect(ctx, cx, cy, cw, ch, 22, '#111623');
      ctx.restore();
    } else {
      fillRRect(ctx, cx, cy, cw, ch, 22, '#111623');
    }

    const cardGrad = ctx.createLinearGradient(cx, cy, cx, cy + ch);
    cardGrad.addColorStop(0, '#161C2C');
    cardGrad.addColorStop(1, '#0F131F');
    fillRRect(ctx, cx, cy, cw, ch, 22, cardGrad);
    strokeRRect(ctx, cx + 0.5, cy + 0.5, cw - 1, ch - 1, 21.5, 'rgba(255,255,255,0.09)', 1);

    // Window top chrome bar
    ctx.beginPath();
    ctx.moveTo(cx, cy + 54);
    ctx.lineTo(cx + cw, cy + 54);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const dots = [['#FF5F56', 0], ['#FFBD2E', 20], ['#27C93F', 40]];
    for (const [col, dx] of dots) {
      ctx.beginPath();
      ctx.arc(cx + 28 + dx, cy + 27, 5.5, 0, TAU);
      ctx.fillStyle = col;
      ctx.fill();
    }

    ctx.font = `600 13px ${MONO}`;
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('northstar.cloud / edge-routing / prod-us-east', cx + 96, cy + 27);

    // Status pill in chrome bar
    const pillText = pubClamped > 0.5 ? 'LIVE · v4.2 ACTIVE' : 'STAGED · v4.2';
    fillRRect(ctx, cx + cw - 184, cy + 14, 160, 26, 13, pubClamped > 0.5 ? 'rgba(16, 185, 129, 0.16)' : 'rgba(56, 189, 248, 0.13)');
    strokeRRect(ctx, cx + cw - 184, cy + 14, 160, 26, 13, pubClamped > 0.5 ? 'rgba(52, 211, 153, 0.45)' : 'rgba(56, 189, 248, 0.35)', 1);
    ctx.beginPath();
    ctx.arc(cx + cw - 168, cy + 27, 4, 0, TAU);
    ctx.fillStyle = pubClamped > 0.5 ? '#34D399' : '#38BDF8';
    ctx.fill();
    ctx.font = `700 11px ${MONO}`;
    ctx.fillStyle = pubClamped > 0.5 ? '#A7F3D0' : '#BAE6FD';
    ctx.fillText(pillText, cx + cw - 156, cy + 27.5);

    // Header Row: Title + KPI + Smart Routing Toggle Card
    ctx.fillStyle = '#94A3B8';
    ctx.font = `600 12px ${MONO}`;
    ctx.fillText('GLOBAL EDGE THROUGHPUT', cx + 38, cy + 92);

    const kpiVal = lerp(18.4, 25.6, routedClamped) + 1.8 * pubClamped;
    ctx.fillStyle = '#F8FAFC';
    ctx.font = `800 46px ${SANS}`;
    ctx.fillText(`${kpiVal.toFixed(1)}k`, cx + 38, cy + 136);
    ctx.fillStyle = '#64748B';
    ctx.font = `600 18px ${SANS}`;
    ctx.fillText('req / sec', cx + 172, cy + 141);

    // Delta pill next to KPI
    const deltaPct = lerp(12.4, 38.4, routedClamped);
    fillRRect(ctx, cx + 264, cy + 119, 98, 28, 14, 'rgba(16, 185, 129, 0.16)');
    strokeRRect(ctx, cx + 264, cy + 119, 98, 28, 14, 'rgba(52, 211, 153, 0.38)', 1);
    ctx.font = `700 13px ${MONO}`;
    ctx.fillStyle = '#34D399';
    ctx.fillText(`+${deltaPct.toFixed(1)}%`, cx + 280, cy + 133.5);

    // Smart Routing interactive control panel (right side, hero target for 2.2x Loupe!)
    const tx = cx + 506, ty = cy + 84, tw = 356, th = 124;
    fillRRect(ctx, tx, ty, tw, th, 16, '#182034');
    strokeRRect(ctx, tx, ty, tw, th, 16, routedClamped > 0.2 ? 'rgba(45, 212, 191, 0.45)' : 'rgba(255,255,255,0.09)', 1.2);

    ctx.fillStyle = '#F1F5F9';
    ctx.font = `700 17px ${SANS}`;
    ctx.fillText('Smart Anycast Routing', tx + 22, ty + 34);
    ctx.fillStyle = '#94A3B8';
    ctx.font = `500 13px ${SANS}`;
    ctx.fillText(routedClamped > 0.5 ? 'Zero-hop PoP selection · 11.2 ms p99' : 'Standard regional round-robin', tx + 22, ty + 58);

    // Sub-badges inside Smart Routing card
    fillRRect(ctx, tx + 22, ty + 78, 118, 26, 8, 'rgba(15, 23, 42, 0.75)');
    strokeRRect(ctx, tx + 22, ty + 78, 118, 26, 8, 'rgba(148, 163, 184, 0.22)', 1);
    ctx.font = `700 11px ${MONO}`;
    ctx.fillStyle = routedClamped > 0.5 ? '#2DD4BF' : '#94A3B8';
    ctx.fillText(routedClamped > 0.5 ? 'SLA 99.99%' : 'SLA 99.90%', tx + 34, ty + 91.5);

    fillRRect(ctx, tx + 150, ty + 78, 126, 26, 8, 'rgba(15, 23, 42, 0.75)');
    strokeRRect(ctx, tx + 150, ty + 78, 126, 26, 8, 'rgba(148, 163, 184, 0.22)', 1);
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText(`P99 ${lerp(28.4, 11.2, routedClamped).toFixed(1)} MS`, tx + 162, ty + 91.5);

    // Toggle Switch (centered around x = 836, y = 246 -> cx+646, cy+150 => wait: cy=96, ty=180, ty+36=216! Let's align!)
    // Note: cx=190, tx=696, toggle at tx+278 = 974 or let's put toggle at (818, 244) so waypoint (836, 246) hits it squarely!
    // Let's place Smart Routing card at tx = 548, ty = 204? No, let's check layout:
    // cy = 96. Header KPI is at x=228..550, y=188..240.
    // Right card at tx = 566, ty = 194, tw = 486, th = 114 -> toggle at tx + 404 = 970? Or let's put toggle at x = 836, y = 246 by setting tx = 532, ty = 196, tw = 368, toggle at x = 812..866, y = 230..260!
    // Wait: let's check cx + cw = 190 + 900 = 1090! So tx = 540, tw = 512 (ends at 1052), ty = 196:
    // Let's re-verify: above we drew at tx = cx + 506 = 696, ty = cy + 84 = 180, tw = 356 (ends at 1052), th = 124 (180..304).
    // Then toggle inside that card at (tx + 280 = 976, ty + 34 = 214) OR at (tx + 286, ty + 62 = 242)!
    // Let's put the toggle right at (tx + 282 = 978? No, let's match waypoints to exact control centers!).
    // Even better: let's compute exact control coordinates as constants!
    const swW = 56, swH = 30;
    const swX = tx + tw - swW - 22; // 696 + 356 - 56 - 22 = 974
    const swY = ty + 22;            // 180 + 22 = 202
    const press1 = Math.sin(Math.PI * lin(tClick1 - 0.06, tClick1 + 0.10, t));
    fillRRect(ctx, swX, swY, swW, swH, 15, routedClamped > 0.35 ? '#10B981' : '#334155');
    strokeRRect(ctx, swX, swY, swW, swH, 15, 'rgba(255,255,255,0.22)', 1);
    const knobW = 24 + 4 * Math.max(0, press1);
    const knobX = lerp(swX + 3, swX + swW - 3 - knobW, clamp(routed, 0, 1));
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 6;
    fillRRect(ctx, knobX, swY + 3, knobW, 24, 12, '#FFFFFF');
    ctx.restore();

    // Live Sparkline & Telemetry Chart Area
    const gx = cx + 38, gy = cy + 230, gw = cw - 76, gh = 196;
    fillRRect(ctx, gx, gy, gw, gh, 16, '#0B0F1A');
    strokeRRect(ctx, gx, gy, gw, gh, 16, 'rgba(255,255,255,0.06)', 1);

    // Horizontal chart grid lines
    for (let r = 1; r <= 3; r++) {
      const ly = gy + (gh * r) / 4;
      ctx.beginPath();
      ctx.moveTo(gx + 18, ly);
      ctx.lineTo(gx + gw - 18, ly);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Smooth spline through chart points
    const pts = baseSeries.map((b, idx) => {
      const target = boostSeries[idx];
      const wave = 0.018 * Math.sin(t * 2.4 + idx * 0.65);
      const val = clamp(lerp(b, target, routedClamped) + wave + 0.04 * pubClamped, 0.1, 0.98);
      return {
        x: gx + 28 + (idx / (baseSeries.length - 1)) * (gw - 56),
        y: gy + gh - 26 - val * (gh - 54),
      };
    });

    // Area fill under curve
    const areaGrad = ctx.createLinearGradient(0, gy + 16, 0, gy + gh);
    areaGrad.addColorStop(0, routedClamped > 0.4 ? 'rgba(45, 212, 191, 0.34)' : 'rgba(56, 189, 248, 0.28)');
    areaGrad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
    ctx.beginPath();
    ctx.moveTo(pts[0].x, gy + gh - 20);
    ctx.lineTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) * 0.5;
      const my = (pts[i].y + pts[i + 1].y) * 0.5;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.lineTo(pts[pts.length - 1].x, gy + gh - 20);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Glowing chart stroke
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) * 0.5;
      const my = (pts[i].y + pts[i + 1].y) * 0.5;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.strokeStyle = routedClamped > 0.4 ? '#2DD4BF' : '#38BDF8';
    ctx.lineWidth = 3.2;
    ctx.stroke();

    // Data vertices
    for (let i = 0; i < pts.length; i += 2) {
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, i === pts.length - 2 ? 5.2 : 3.6, 0, TAU);
      ctx.fillStyle = '#0B0F1A';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = routedClamped > 0.4 ? '#5EEAD4' : '#7DD3FC';
      ctx.stroke();
    }

    // Bottom Action Footer Bar
    const fy = cy + 448;
    ctx.fillStyle = '#94A3B8';
    ctx.font = `500 14px ${SANS}`;
    ctx.fillText('34 global PoPs healthy · Zero packet loss in last 60m', cx + 38, fy + 28);

    // Secondary button
    fillRRect(ctx, cx + 560, fy + 6, 134, 44, 11, '#1B2336');
    strokeRRect(ctx, cx + 560, fy + 6, 134, 44, 11, 'rgba(255,255,255,0.10)', 1);
    ctx.fillStyle = '#CBD5E1';
    ctx.font = `600 14px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('Inspect Logs', cx + 627, fy + 28.5);

    // Primary Publish Button (cx + 708 .. cx + 862 => x = 898..1052, center 975, y = 550..594, center 572)
    const bx = cx + 708, by = fy + 6, bw = 154, bh = 44;
    const press2 = Math.max(0, Math.sin(Math.PI * lin(tClick2 - 0.05, tClick2 + 0.12, t)));
    ctx.save();
    const bCenterX = bx + bw / 2, bCenterY = by + bh / 2;
    ctx.translate(bCenterX, bCenterY);
    const bScale = 1 - 0.055 * press2;
    ctx.scale(bScale, bScale);
    const btnGrad = ctx.createLinearGradient(-bw / 2, -bh / 2, bw / 2, bh / 2);
    if (pubClamped > 0.5) {
      btnGrad.addColorStop(0, '#10B981');
      btnGrad.addColorStop(1, '#059669');
    } else {
      btnGrad.addColorStop(0, '#3B82F6');
      btnGrad.addColorStop(1, '#2563EB');
    }
    fillRRect(ctx, -bw / 2, -bh / 2, bw, bh, 11, btnGrad);
    strokeRRect(ctx, -bw / 2, -bh / 2, bw, bh, 11, 'rgba(255,255,255,0.28)', 1);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 14px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pubClamped > 0.5 ? 'Published v4.2' : 'Publish v4.2', 0, 0.5);
    ctx.restore();
    ctx.textAlign = 'left';

    // Click ripples rendered inside scene so they also magnify cleanly!
    drawClickRipple(ctx, swX + swW * 0.5, swY + swH * 0.5, t - tClick1, '45, 212, 191');
    drawClickRipple(ctx, bCenterX, bCenterY, t - tClick2, '59, 130, 246');
  }

  // Update waypoints to hit exact centers of controls:
  // Toggle switch center: x = 190 + 506 + 356 - 56 - 22 + 28 = 1002, y = 96 + 84 + 22 + 15 = 217
  // Smart Routing SLA/P99 inspection sweet-spot at hero t=2.6: (838, 252) -> shows Smart Routing title, SLA 99.99%, P99 11.2 MS, and green ON switch!
  // Publish button center: x = 190 + 708 + 77 = 975, y = 96 + 448 + 28 = 572
  waypoints[0] = { t: 0.0, x: 310, y: 520, hold: true };
  waypoints[1] = { t: 0.78, x: 640, y: 365, hold: false };
  waypoints[2] = { t: 1.42, x: 1002, y: 217, hold: true };
  waypoints[3] = { t: 2.60, x: 848, y: 244, hold: false };
  waypoints[4] = { t: 3.42, x: 975, y: 572, hold: true };
  waypoints[5] = { t: 4.35, x: 685, y: 410, hold: false };
  waypoints[6] = { t: 5.45, x: 310, y: 520, hold: true };
  waypoints[7] = { t: 6.00, x: 310, y: 520, hold: true };

  function frame(time) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);

    // 1. Base dashboard pass
    paintDashboard(g, t, false);

    // 2. Cursor state along Hermite spline
    const cur = evalHermitePath(waypoints, t);
    const press1 = Math.max(0, Math.sin(Math.PI * lin(1.37, 1.54, t)));
    const press2 = Math.max(0, Math.sin(Math.PI * lin(3.37, 3.54, t)));
    const press = Math.max(press1, press2);

    // Base cursor (shown faintly when loupe is active, full when loupe retracts)
    const loupePresence = smooth(0.45, 0.95, t) * (1 - smooth(4.45, 4.92, t));
    if (loupePresence < 0.98) {
      g.save();
      g.globalAlpha = 1 - loupePresence * 0.85;
      drawPointerCursor(g, cur.x, cur.y, press, 1);
      g.restore();
    }

    // 3. 2.2x Circular Optical Magnifier Loupe
    if (loupePresence > 0.02) {
      const MAG = 2.2;
      const R = 126 * (0.65 + 0.35 * backEase(loupePresence));
      // Offset loupe slightly from cursor tip so lens frames both cursor and surrounding UI cleanly
      const lx = clamp(cur.x - 18, R + 28, W - R - 28);
      const ly = clamp(cur.y + 8, R + 28, H - R - 28);

      g.save();
      g.globalAlpha = clamp(loupePresence * 1.25);

      // Deep optical drop shadow
      g.save();
      g.shadowColor = 'rgba(0, 0, 0, 0.68)';
      g.shadowBlur = 42;
      g.shadowOffsetX = 0;
      g.shadowOffsetY = 20;
      g.beginPath();
      g.arc(lx, ly, R, 0, TAU);
      g.fillStyle = '#0B0F19';
      g.fill();
      g.restore();

      // Clipped 2.2x vector scene + magnified cursor inside circular lens
      g.save();
      g.beginPath();
      g.arc(lx, ly, R, 0, TAU);
      g.clip();

      g.save();
      g.translate(lx, ly);
      g.scale(MAG, MAG);
      g.translate(-cur.x + 14, -cur.y - 6);
      paintDashboard(g, t, true);
      drawPointerCursor(g, cur.x, cur.y, press, 0.92);
      g.restore();

      // Subtle optical edge vignette & barrel refraction sheen inside lens
      const lensVignette = g.createRadialGradient(lx, ly, R * 0.62, lx, ly, R);
      lensVignette.addColorStop(0, 'rgba(255,255,255,0)');
      lensVignette.addColorStop(0.84, 'rgba(14, 22, 38, 0.14)');
      lensVignette.addColorStop(0.95, 'rgba(56, 189, 248, 0.16)');
      lensVignette.addColorStop(1, 'rgba(2, 6, 16, 0.48)');
      g.fillStyle = lensVignette;
      g.fillRect(lx - R, ly - R, R * 2, R * 2);

      // Diagonal glass surface reflection band
      const glassSweep = g.createLinearGradient(lx - R, ly - R, lx + R * 0.6, ly + R * 0.6);
      glassSweep.addColorStop(0, 'rgba(255,255,255,0.18)');
      glassSweep.addColorStop(0.28, 'rgba(255,255,255,0.04)');
      glassSweep.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.fillStyle = glassSweep;
      g.fillRect(lx - R, ly - R, R * 2, R * 2);
      g.restore();

      // Machined glass rim + specular highlight arcs
      g.beginPath();
      g.arc(lx, ly, R + 2.5, 0, TAU);
      g.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      g.lineWidth = 6;
      g.stroke();

      const rimGrad = g.createLinearGradient(lx - R, ly - R, lx + R, ly + R);
      rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      rimGrad.addColorStop(0.35, 'rgba(148, 163, 184, 0.35)');
      rimGrad.addColorStop(0.75, 'rgba(56, 189, 248, 0.45)');
      rimGrad.addColorStop(1, 'rgba(255, 255, 255, 0.55)');
      g.beginPath();
      g.arc(lx, ly, R + 0.5, 0, TAU);
      g.strokeStyle = rimGrad;
      g.lineWidth = 2.6;
      g.stroke();

      // Crisp 45-degree specular rim highlight
      g.beginPath();
      g.arc(lx, ly, R - 4, -Math.PI * 0.84, -Math.PI * 0.36);
      g.strokeStyle = 'rgba(255, 255, 255, 0.52)';
      g.lineWidth = 2.2;
      g.lineCap = 'round';
      g.stroke();

      // Tiny 2.2x optical magnification pill tag on rim
      fillRRect(g, lx - 32, ly + R - 13, 64, 22, 11, '#0F172A');
      strokeRRect(g, lx - 32, ly + R - 13, 64, 22, 11, 'rgba(255,255,255,0.28)', 1);
      g.font = `700 11px ${MONO}`;
      g.fillStyle = '#E2E8F0';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('2.2x OPT', lx, ly + R - 1.5);
      g.restore();
    }

    g.restore();
  }

  function backEase(x) {
    const k = clamp(x);
    const c1 = 1.45, c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  }

  return { canvas, ready: ensureFonts(), frame };
}

// ============================================================================
// 2. ui-cmd-palette (variant, period: 5.6, hero: 2.3) + FX_CUSTOM_TEXT
// ============================================================================
function buildCmdPalette(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const { canvas, g } = makeSurface(width, height);
  const PERIOD = 5.6;

  const baseCommands = [
    { icon: '▸', title: 'Deploy edge preview to 34 PoPs', cat: 'Deployments', kbd: '⌘ E', tags: 'deploy edge preview prod' },
    { icon: '⚡', title: 'Purge global CDN & edge KV cache', cat: 'Edge Network', kbd: '⇧ ⌘ K', tags: 'deploy edge cache purge' },
    { icon: '◈', title: 'Inspect edge worker tail logs', cat: 'Observability', kbd: '⌘ L', tags: 'deploy edge logs trace' },
    { icon: '⇄', title: 'Switch active workspace theme', cat: 'Preferences', kbd: '⌘ T', tags: 'theme ui dark' },
    { icon: '⊕', title: 'Invite team member to studio', cat: 'Organization', kbd: '⌘ I', tags: 'team invite member' },
  ];

  function drawHighlightedText(ctx, text, query, x, y) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const qLower = query.toLowerCase().trim();
    if (!qLower) {
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(text, x, y);
      return;
    }
    // Highlight characters matching tokens of query
    const tokens = qLower.split(/\s+/).filter(Boolean);
    const hitMask = new Uint8Array(text.length);
    const tLower = text.toLowerCase();
    for (const tok of tokens) {
      const idx = tLower.indexOf(tok);
      if (idx >= 0) {
        for (let k = idx; k < idx + tok.length; k++) hitMask[k] = 1;
      }
    }
    let curX = x;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      ctx.fillStyle = hitMask[i] ? '#38BDF8' : '#E2E8F0';
      ctx.fillText(ch, curX, y);
      curX += ctx.measureText(ch).width;
    }
  }

  function frame(time, opts = {}) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    const custom = getCustomText(opts);
    const queryTarget = custom || 'deploy edge';

    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);

    // 1. Underlying recessed SaaS workspace app
    const bgGrad = g.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0E1320');
    bgGrad.addColorStop(1, '#090C14');
    g.fillStyle = bgGrad;
    g.fillRect(0, 0, W, H);

    const openK = clamp(springValue(t - 0.24, 0.72, 26), 0, 1.12);
    const closeK = smooth(3.45, 3.82, t);
    const modalVis = clamp(openK * (1 - closeK), 0, 1.08);
    const recess = clamp(modalVis, 0, 1);

    // Draw background app layout (recesses slightly when modal opens)
    g.save();
    g.translate(W / 2, H / 2);
    const bgScale = 1 - 0.032 * recess;
    g.scale(bgScale, bgScale);
    g.translate(-W / 2, -H / 2);
    g.globalAlpha = 1 - 0.42 * recess;

    // App sidebar + kanban rows
    fillRRect(g, 76, 68, 1128, 598, 18, '#131929');
    strokeRRect(g, 76, 68, 1128, 598, 18, 'rgba(255,255,255,0.07)', 1);
    fillRRect(g, 76, 68, 224, 598, 18, '#0F1422');
    for (let i = 0; i < 6; i++) {
      fillRRect(g, 98, 122 + i * 44, i === 1 ? 176 : 142, 26, 7, i === 1 ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.04)');
    }
    g.font = `700 18px ${SANS}`;
    g.fillStyle = '#CBD5E1';
    g.textAlign = 'left';
    g.fillText('Release Pipeline · Q4', 336, 118);
    for (let r = 0; r < 5; r++) {
      fillRRect(g, 336, 148 + r * 84, 824, 66, 12, '#182034');
      strokeRRect(g, 336, 148 + r * 84, 824, 66, 12, 'rgba(255,255,255,0.05)', 1);
      fillRRect(g, 360, 171 + r * 84, 220 + (r % 3) * 70, 18, 6, 'rgba(226,232,240,0.16)');
      fillRRect(g, 1030, 167 + r * 84, 98, 26, 13, 'rgba(56,189,248,0.12)');
    }
    g.restore();

    // Translucent dark backdrop scrim
    if (recess > 0.01) {
      g.fillStyle = `rgba(5, 8, 16, ${(0.58 * recess).toFixed(3)})`;
      g.fillRect(0, 0, W, H);
    }

    // Initial ⌘K shortcut trigger flash (0.04..0.34s)
    const hkAlpha = smooth(0.02, 0.10, t) * (1 - smooth(0.24, 0.38, t));
    if (hkAlpha > 0.01) {
      g.save();
      g.globalAlpha = hkAlpha;
      fillRRect(g, W / 2 - 68, H / 2 - 28, 136, 56, 14, '#1E293B');
      strokeRRect(g, W / 2 - 68, H / 2 - 28, 136, 56, 14, 'rgba(56,189,248,0.55)', 1.5);
      g.font = `700 24px ${MONO}`;
      g.fillStyle = '#F8FAFC';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('⌘ K', W / 2, H / 2);
      g.restore();
    }

    // 2. Command Palette Modal
    if (modalVis > 0.01) {
      // Deterministic typing cadence between t = 0.52 and t = 1.78
      const totalChars = queryTarget.length;
      let typedLen = 0;
      for (let i = 0; i < totalChars; i++) {
        const jitter = (hash(i * 7.3 + 1.9) - 0.5) * 0.035;
        const charTime = 0.52 + ((i + 0.5) / Math.max(1, totalChars)) * 1.22 + jitter;
        if (t >= charTime) typedLen = i + 1;
      }
      const typed = queryTarget.slice(0, typedLen);

      // Build filtered rows dynamically (supports FX_CUSTOM_TEXT seamlessly!)
      let rows = baseCommands;
      if (typedLen >= 3) {
        if (custom) {
          rows = [
            { icon: '▸', title: `Run "${custom}" on edge cluster`, cat: 'Custom Action', kbd: '↵', tags: custom },
            { icon: '⚡', title: `Search "${custom}" across deployments`, cat: 'Global Search', kbd: '⌘ F', tags: custom },
            baseCommands[0],
          ];
        } else {
          rows = baseCommands.slice(0, 3);
        }
      }

      // Highlight row glide: starts row 0, glides to row 1 at 1.82s, back to hero row 0 at 2.10s (held at hero=2.3!)
      const glideDown = clamp(springValue(t - 1.80, 0.78, 28), 0, 1);
      const glideHero = clamp(springValue(t - 2.04, 0.74, 28), 0, 1);
      const activeIdxFloat = rows.length > 1 ? glideDown * (1 - glideHero) : 0;

      // Enter key confirmation flash at t = 3.02s
      const enterHit = t >= 3.00 ? Math.exp(-(t - 3.00) * 6.5) : 0;

      const mw = 756;
      const mh = 118 + rows.length * 60 + 46;
      const mx = (W - mw) / 2;
      const my = 136;

      g.save();
      g.translate(W / 2, my + mh / 2);
      const mScale = 0.88 + 0.12 * modalVis;
      g.scale(mScale, mScale);
      g.translate(-W / 2, -(my + mh / 2));
      g.globalAlpha = clamp(modalVis * 1.15);

      // Shadow + Surface
      g.save();
      g.shadowColor = 'rgba(0, 0, 0, 0.68)';
      g.shadowBlur = 56;
      g.shadowOffsetY = 28;
      fillRRect(g, mx, my, mw, mh, 20, '#141A29');
      g.restore();

      const surf = g.createLinearGradient(mx, my, mx, my + mh);
      surf.addColorStop(0, '#192134');
      surf.addColorStop(1, '#111624');
      fillRRect(g, mx, my, mw, mh, 20, surf);
      strokeRRect(g, mx + 0.5, my + 0.5, mw - 1, mh - 1, 19.5, 'rgba(255,255,255,0.13)', 1);

      // Top search input bar
      ctx.SearchIcon(g, mx + 34, my + 38);
      g.font = `500 21px ${SANS}`;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      if (typed.length === 0) {
        g.fillStyle = '#64748B';
        g.fillText('Type a command or search...', mx + 64, my + 39);
      } else {
        g.fillStyle = '#F8FAFC';
        g.fillText(typed, mx + 64, my + 39);
      }

      // Glowing input caret
      const textW = g.measureText(typed).width;
      const caretBlink = typedLen < totalChars ? 1 : (Math.sin(t * 14) > -0.2 ? 1 : 0.25);
      fillRRect(g, mx + 66 + textW, my + 24, 2.5, 29, 1, `rgba(56, 189, 248, ${caretBlink.toFixed(2)})`);

      // ESC badge & match count badge
      fillRRect(g, mx + mw - 156, my + 24, 72, 28, 8, 'rgba(56, 189, 248, 0.12)');
      g.font = `700 11px ${MONO}`;
      g.fillStyle = '#7DD3FC';
      g.textAlign = 'center';
      g.fillText(`${rows.length} MATCH`, mx + mw - 120, my + 38.5);

      fillRRect(g, mx + mw - 72, my + 24, 48, 28, 8, 'rgba(255,255,255,0.06)');
      strokeRRect(g, mx + mw - 72, my + 24, 48, 28, 8, 'rgba(255,255,255,0.12)', 1);
      g.fillStyle = '#94A3B8';
      g.fillText('ESC', mx + mw - 48, my + 38.5);

      // Divider
      g.beginPath();
      g.moveTo(mx, my + 74);
      g.lineTo(mx + mw, my + 74);
      g.strokeStyle = 'rgba(255,255,255,0.08)';
      g.lineWidth = 1;
      g.stroke();

      // Section label
      g.font = `700 11px ${MONO}`;
      g.fillStyle = '#64748B';
      g.textAlign = 'left';
      g.fillText(typedLen >= 3 ? 'BEST MATCHES · FUZZY RANKED' : 'SUGGESTED COMMANDS', mx + 26, my + 96);

      // Gliding active selection pill
      const rowY0 = my + 112;
      const selY = rowY0 + activeIdxFloat * 60;
      const selGrad = g.createLinearGradient(mx + 14, selY, mx + mw - 14, selY);
      selGrad.addColorStop(0, `rgba(56, 189, 248, ${(0.18 + 0.35 * enterHit).toFixed(3)})`);
      selGrad.addColorStop(1, `rgba(99, 102, 241, ${(0.12 + 0.28 * enterHit).toFixed(3)})`);
      fillRRect(g, mx + 14, selY, mw - 28, 54, 12, selGrad);
      strokeRRect(g, mx + 14, selY, mw - 28, 54, 12, `rgba(56, 189, 248, ${(0.42 + 0.5 * enterHit).toFixed(3)})`, 1.2);
      // Left electric accent bar on active row
      fillRRect(g, mx + 14, selY + 11, 3.5, 32, 2, '#38BDF8');

      // Render command rows
      rows.forEach((row, i) => {
        const ry = rowY0 + i * 60;
        const isSel = Math.abs(i - activeIdxFloat) < 0.45;
        fillRRect(g, mx + 28, ry + 11, 32, 32, 8, isSel ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255,255,255,0.05)');
        g.font = `700 15px ${SANS}`;
        g.fillStyle = isSel ? '#7DD3FC' : '#94A3B8';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(row.icon, mx + 44, ry + 27.5);

        g.font = `600 16px ${SANS}`;
        drawHighlightedText(g, row.title, typed, mx + 74, ry + 27.5);

        // Category label + KBD badge
        g.font = `500 12px ${SANS}`;
        g.fillStyle = isSel ? '#BAE6FD' : '#64748B';
        g.textAlign = 'right';
        g.fillText(row.cat, mx + mw - 108, ry + 27.5);

        const kbdText = isSel && t > 2.08 ? '↵ RUN' : row.kbd;
        const kw = Math.max(46, kbdText.length * 9 + 18);
        const kx = mx + mw - 28 - kw;
        const kPress = isSel && t >= 2.98 && t <= 3.16 ? 2 : 0;
        fillRRect(g, kx, ry + 13 + kPress, kw, 28, 7, isSel ? 'rgba(56, 189, 248, 0.24)' : 'rgba(255,255,255,0.06)');
        strokeRRect(g, kx, ry + 13 + kPress, kw, 28, 7, isSel ? 'rgba(125, 211, 252, 0.55)' : 'rgba(255,255,255,0.12)', 1);
        g.font = `700 11px ${MONO}`;
        g.fillStyle = isSel ? '#F0F9FF' : '#94A3B8';
        g.textAlign = 'center';
        g.fillText(kbdText, kx + kw / 2, ry + 27.5 + kPress);
      });

      // Footer bar inside palette
      const footY = rowY0 + rows.length * 60 + 8;
      g.beginPath();
      g.moveTo(mx, footY);
      g.lineTo(mx + mw, footY);
      g.strokeStyle = 'rgba(255,255,255,0.07)';
      g.stroke();
      g.font = `600 11px ${MONO}`;
      g.fillStyle = '#64748B';
      g.textAlign = 'left';
      g.fillText('↑↓ NAVIGATE   ·   ↵ EXECUTE   ·   ⌘K COMMAND STAGE', mx + 26, footY + 21);
      g.restore();
    }

    // 3. Post-confirmation floating Toast Pill (3.52 .. 5.25s)
    const toastIn = clamp(springValue(t - 3.52, 0.66, 24), 0, 1.15);
    const toastOut = smooth(5.05, 5.45, t);
    const toastK = toastIn * (1 - toastOut);
    if (toastK > 0.01) {
      const tw = 468, th = 54;
      const tx = (W - tw) / 2;
      const ty = lerp(-70, 14, toastK);
      g.save();
      g.globalAlpha = clamp(toastK * 1.2);
      g.shadowColor = 'rgba(0,0,0,0.5)';
      g.shadowBlur = 32;
      g.shadowOffsetY = 12;
      fillRRect(g, tx, ty, tw, th, 27, '#111C24');
      g.shadowColor = 'transparent';
      strokeRRect(g, tx, ty, tw, th, 27, 'rgba(52, 211, 153, 0.55)', 1.4);

      g.beginPath();
      g.arc(tx + 30, ty + 27, 12, 0, TAU);
      g.fillStyle = 'rgba(16, 185, 129, 0.24)';
      g.fill();
      g.strokeStyle = '#34D399';
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(tx + 24.5, ty + 27.5);
      g.lineTo(tx + 28.5, ty + 31.5);
      g.lineTo(tx + 36, ty + 23);
      g.stroke();

      g.font = `700 15px ${SANS}`;
      g.fillStyle = '#F8FAFC';
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      const toastLabel = custom ? `Executed "${custom}" · 38 ms` : 'Deployed edge preview to 34 PoPs · 38 ms';
      g.fillText(toastLabel, tx + 54, ty + 27.5);
      g.restore();
    }

    g.restore();
  }

  const ctx = {
    SearchIcon(gg, cx, cy) {
      gg.save();
      gg.strokeStyle = '#38BDF8';
      gg.lineWidth = 2.2;
      gg.beginPath();
      gg.arc(cx - 2, cy - 2, 7.5, 0, TAU);
      gg.stroke();
      gg.beginPath();
      gg.moveTo(cx + 3.5, cy + 3.5);
      gg.lineTo(cx + 9.5, cy + 9.5);
      gg.lineCap = 'round';
      gg.stroke();
      gg.restore();
    },
  };

  return { canvas, ready: ensureFonts(), frame };
}

// ============================================================================
// 3. ui-flip-modal (variant, period: 5.4, hero: 2.4)
// ============================================================================
function buildFlipModal(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const { canvas, g } = makeSurface(width, height);
  const PERIOD = 5.4;

  const cards = [
    {
      tag: 'LATENCY · GLOBAL',
      title: 'Edge Inference',
      metric: '18.4 ms',
      delta: '-24% p95',
      accent: '#0EA5E9',
      bars: [0.68, 0.62, 0.54, 0.49, 0.44, 0.39],
    },
    {
      tag: 'REVENUE RUN-RATE',
      title: 'Annualized ARR',
      metric: '$2.48M',
      delta: '+41.2% YoY',
      accent: '#4F46E5',
      bars: [0.32, 0.44, 0.53, 0.67, 0.81, 0.95],
    },
    {
      tag: 'CLUSTER HEALTH',
      title: 'Active Regions',
      metric: '16 / 16',
      delta: '99.99% Up',
      accent: '#10B981',
      bars: [0.92, 0.95, 0.94, 0.98, 0.97, 1.0],
    },
  ];

  // Grid geometry (First) and Expanded Inspector Modal geometry (Last)
  const slots = [
    { x: 112, y: 178, w: 328, h: 388, r: 18 },
    { x: 476, y: 178, w: 328, h: 388, r: 18 },
    { x: 840, y: 178, w: 328, h: 388, r: 18 },
  ];
  const modalBox = { x: 196, y: 98, w: 888, h: 524, r: 26 };

  function drawSiblingCard(ctx, idx, recessK) {
    const s = slots[idx];
    const c = cards[idx];
    ctx.save();
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    ctx.translate(cx, cy);
    const sc = 1 - 0.065 * recessK;
    ctx.scale(sc, sc);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = 1 - 0.55 * recessK;

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.09)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    fillRRect(ctx, s.x, s.y, s.w, s.h, s.r, '#FFFFFF');
    ctx.restore();
    strokeRRect(ctx, s.x, s.y, s.w, s.h, s.r, 'rgba(15, 23, 42, 0.08)', 1);

    ctx.font = `700 11px ${MONO}`;
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.tag, s.x + 28, s.y + 38);

    ctx.font = `700 22px ${SANS}`;
    ctx.fillStyle = '#0F172A';
    ctx.fillText(c.title, s.x + 28, s.y + 72);

    ctx.font = `800 44px ${SANS}`;
    ctx.fillStyle = '#0F172A';
    ctx.fillText(c.metric, s.x + 28, s.y + 132);

    fillRRect(ctx, s.x + 28, s.y + 166, 108, 26, 13, 'rgba(15, 23, 42, 0.05)');
    ctx.font = `700 12px ${MONO}`;
    ctx.fillStyle = c.accent;
    ctx.fillText(c.delta, s.x + 42, s.y + 179.5);

    // Mini bar chart at bottom of card
    const bx0 = s.x + 28, by0 = s.y + 340, bw = 34, gap = 10;
    c.bars.forEach((v, bi) => {
      const bh = v * 110;
      fillRRect(ctx, bx0 + bi * (bw + gap), by0 - bh, bw, bh, 6, bi === c.bars.length - 1 ? c.accent : '#E2E8F0');
    });

    ctx.restore();
  }

  function frame(time) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);

    // Warm crisp SaaS light canvas
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#F6F7FB');
    bg.addColorStop(1, '#EAEEF6');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // FLIP progress: expand at t=0.88s, collapse at t=3.85s
    const openSpring = springValue(t - 0.88, 0.74, 21);
    const closeSpring = springValue(t - 3.85, 0.78, 21);
    const flipK = clamp(openSpring - closeSpring, 0, 1.06);
    const flipClamped = clamp(flipK, 0, 1);

    // Top workspace header
    g.save();
    g.globalAlpha = 1 - 0.65 * flipClamped;
    g.font = `700 12px ${MONO}`;
    g.fillStyle = '#64748B';
    g.textAlign = 'left';
    g.fillText('EXECUTIVE OVERVIEW · BENTO METRICS', 112, 92);
    g.font = `800 30px ${SANS}`;
    g.fillStyle = '#0F172A';
    g.fillText('Platform Telemetry', 112, 128);
    g.restore();

    // Sibling cards recess into background
    drawSiblingCard(g, 0, flipClamped);
    drawSiblingCard(g, 2, flipClamped);

    // Depth-blur / frosted dim scrim behind expanded modal
    if (flipClamped > 0.01) {
      const scrim = g.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7);
      scrim.addColorStop(0, `rgba(15, 23, 42, ${(0.22 * flipClamped).toFixed(3)})`);
      scrim.addColorStop(1, `rgba(15, 23, 42, ${(0.42 * flipClamped).toFixed(3)})`);
      g.fillStyle = scrim;
      g.fillRect(0, 0, W, H);
    }

    // Selected Hero Card 1 -> FLIP interpolates geometry & corner radius!
    const first = slots[1];
    const hoverLift = smooth(0.32, 0.72, t) * (1 - smooth(0.86, 0.96, t));
    const x = lerp(first.x, modalBox.x, flipK);
    const y = lerp(first.y - 6 * hoverLift, modalBox.y, flipK);
    const w = lerp(first.w, modalBox.w, flipK);
    const h = lerp(first.h, modalBox.h, flipK);
    const rad = lerp(first.r, modalBox.r, flipClamped);

    g.save();
    g.shadowColor = `rgba(15, 23, 42, ${(0.12 + 0.20 * flipClamped).toFixed(3)})`;
    g.shadowBlur = 28 + 36 * flipClamped;
    g.shadowOffsetY = 12 + 18 * flipClamped;
    fillRRect(g, x, y, w, h, rad, '#FFFFFF');
    g.restore();
    strokeRRect(g, x, y, w, h, rad, 'rgba(79, 70, 229, 0.18)', 1.2);

    // Clip interior to FLIP container
    g.save();
    rrect(g, x, y, w, h, rad);
    g.clip();

    // Shared persistent header elements morphing position smoothly inside FLIP box!
    const padX = lerp(28, 44, flipClamped);
    const padY = lerp(38, 42, flipClamped);

    g.font = `700 12px ${MONO}`;
    g.fillStyle = '#4F46E5';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('REVENUE RUN-RATE · COHORT INSPECTOR', x + padX, y + padY);

    g.font = `800 ${Math.round(lerp(44, 54, flipClamped))}px ${SANS}`;
    g.fillStyle = '#0F172A';
    g.fillText('$2.48M', x + padX, y + lerp(132, 98, flipClamped));

    // +41.2% YoY badge
    const badgeX = lerp(x + 28, x + 252, flipClamped);
    const badgeY = lerp(y + 166, y + 83, flipClamped);
    fillRRect(g, badgeX, badgeY, 118, 30, 15, 'rgba(79, 70, 229, 0.10)');
    g.font = `700 13px ${MONO}`;
    g.fillStyle = '#4F46E5';
    g.fillText('+41.2% YoY', badgeX + 14, badgeY + 15.5);

    // Compact card content fades out as modal detail fades in
    const compactAlpha = clamp(1 - flipClamped * 2.2);
    if (compactAlpha > 0.01) {
      g.save();
      g.globalAlpha = compactAlpha;
      g.font = `700 22px ${SANS}`;
      g.fillStyle = '#0F172A';
      g.fillText('Annualized ARR', x + 28, y + 72);
      const bx0 = x + 28, by0 = y + 340;
      cards[1].bars.forEach((v, bi) => {
        const bh = v * 110;
        fillRRect(g, bx0 + bi * 44, by0 - bh, 34, bh, 6, bi === 5 ? '#4F46E5' : '#E2E8F0');
      });
      g.restore();
    }

    // Expanded Inspector Modal rich detail content
    const detailAlpha = smooth(0.32, 0.88, flipClamped);
    if (detailAlpha > 0.01) {
      g.save();
      g.globalAlpha = detailAlpha;

      // Top-right modal controls ("Export CSV" + Close X pill)
      fillRRect(g, x + w - 188, y + 28, 112, 34, 10, '#F1F5F9');
      strokeRRect(g, x + w - 188, y + 28, 112, 34, 10, '#CBD5E1', 1);
      g.font = `600 13px ${SANS}`;
      g.fillStyle = '#334155';
      g.textAlign = 'center';
      g.fillText('Export CSV', x + w - 132, y + 45.5);

      fillRRect(g, x + w - 64, y + 28, 34, 34, 10, '#F1F5F9');
      g.font = `700 15px ${SANS}`;
      g.fillStyle = '#475569';
      g.fillText('×', x + w - 47, y + 45.5);
      g.textAlign = 'left';

      // Divider
      g.beginPath();
      g.moveTo(x + 44, y + 138);
      g.lineTo(x + w - 44, y + 138);
      g.strokeStyle = '#E2E8F0';
      g.lineWidth = 1;
      g.stroke();

      // Three KPI mini-cards row
      const kpis = [
        ['NET RETENTION', '136.4%', '+8.2 pts'],
        ['ENTERPRISE SHARE', '68.0%', '142 seats'],
        ['GROSS MARGIN', '84.2%', 'Audited'],
      ];
      kpis.forEach(([kLabel, kVal, kSub], ki) => {
        const kx = x + 44 + ki * 274;
        const ky = y + 158;
        fillRRect(g, kx, ky, 252, 88, 14, '#F8FAFC');
        strokeRRect(g, kx, ky, 252, 88, 14, '#E2E8F0', 1);
        g.font = `700 11px ${MONO}`;
        g.fillStyle = '#64748B';
        g.fillText(kLabel, kx + 18, ky + 26);
        g.font = `800 28px ${SANS}`;
        g.fillStyle = '#0F172A';
        g.fillText(kVal, kx + 18, ky + 60);
        g.font = `600 12px ${MONO}`;
        g.fillStyle = '#10B981';
        g.textAlign = 'right';
        g.fillText(kSub, kx + 234, ky + 62);
        g.textAlign = 'left';
      });

      // Quarterly Cohort Revenue Bar + Spline Chart
      const cx0 = x + 44, cy0 = y + 268, cw0 = w - 88, ch0 = 216;
      fillRRect(g, cx0, cy0, cw0, ch0, 16, '#0F172A');
      g.font = `700 11px ${MONO}`;
      g.fillStyle = '#94A3B8';
      g.fillText('QUARTERLY EXPANSION COHORTS · Q1 25 — Q4 26', cx0 + 24, cy0 + 28);

      const qLabels = ['Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26', 'Q2 26', 'Q3 26', 'Q4 26'];
      const qVals = [0.28, 0.36, 0.45, 0.54, 0.65, 0.76, 0.88, 0.98];
      const barGrow = outCubic(lin(1.15, 2.05, t));

      qVals.forEach((qv, qi) => {
        const slotW = (cw0 - 64) / qVals.length;
        const bx = cx0 + 36 + qi * slotW + 12;
        const bw = slotW - 26;
        const bh = qv * 124 * barGrow;
        const by = cy0 + ch0 - 36 - bh;
        const bGrad = g.createLinearGradient(bx, by, bx, cy0 + ch0 - 36);
        bGrad.addColorStop(0, qi >= 6 ? '#38BDF8' : '#6366F1');
        bGrad.addColorStop(1, qi >= 6 ? '#2563EB' : '#312E81');
        fillRRect(g, bx, by, bw, Math.max(4, bh), 7, bGrad);

        g.font = `600 11px ${MONO}`;
        g.fillStyle = '#94A3B8';
        g.textAlign = 'center';
        g.fillText(qLabels[qi], bx + bw / 2, cy0 + ch0 - 18);
      });
      g.textAlign = 'left';

      g.restore();
    }

    g.restore();

    // Virtual cursor choreography: clicks Card 2 at 0.85s, clicks Close X at 3.82s
    const cPath = [
      { t: 0.0, x: 260, y: 560, hold: true },
      { t: 0.75, x: 640, y: 360, hold: true },
      { t: 2.40, x: 760, y: 420, hold: false },
      { t: 3.76, x: modalBox.x + modalBox.w - 47, y: modalBox.y + 45, hold: true },
      { t: 4.85, x: 260, y: 560, hold: true },
      { t: 5.40, x: 260, y: 560, hold: true },
    ];
    const cp = evalHermitePath(cPath, t);
    const cPress = Math.max(
      Math.sin(Math.PI * lin(0.80, 0.96, t)),
      Math.sin(Math.PI * lin(3.76, 3.92, t))
    );
    drawClickRipple(g, 640, 360, t - 0.84, '79, 70, 229');
    drawClickRipple(g, modalBox.x + modalBox.w - 47, modalBox.y + 45, t - 3.82, '100, 116, 139');
    drawPointerCursor(g, cp.x, cp.y, Math.max(0, cPress), 1);

    g.restore();
  }

  return { canvas, ready: ensureFonts(), frame };
}

// ============================================================================
// 4. ui-chat-flow (variant, period: 6.4, hero: 3.8)
// ============================================================================
function buildChatFlow(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const { canvas, g } = makeSurface(width, height);
  const PERIOD = 6.4;

  function drawReadChecks(ctx, x, y, readProgress) {
    ctx.save();
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const col = readProgress > 0.5 ? '#38BDF8' : '#94A3B8';
    ctx.strokeStyle = col;
    // First checkmark
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4, y + 4);
    ctx.lineTo(x + 11, y - 4);
    ctx.stroke();
    // Second checkmark (appears when delivered/read)
    if (readProgress > 0.15) {
      ctx.globalAlpha = clamp((readProgress - 0.15) / 0.35);
      ctx.beginPath();
      ctx.moveTo(x + 6, y);
      ctx.lineTo(x + 10, y + 4);
      ctx.lineTo(x + 17, y - 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function frame(time) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);

    // Studio dark backdrop with soft indigo/teal ambient glow
    const bg = g.createRadialGradient(W * 0.5, H * 0.2, 40, W * 0.5, H * 0.55, W * 0.72);
    bg.addColorStop(0, '#161F35');
    bg.addColorStop(0.6, '#0B0F1A');
    bg.addColorStop(1, '#06080F');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    const fadeOut = 1 - smooth(5.85, 6.32, t);
    g.globalAlpha = fadeOut;

    // Centered Conversation Window
    const wx = 230, wy = 68, ww = 820, wh = 584;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 48;
    g.shadowOffsetY = 24;
    fillRRect(g, wx, wy, ww, wh, 24, '#111624');
    g.restore();
    strokeRRect(g, wx + 0.5, wy + 0.5, ww - 1, wh - 1, 23.5, 'rgba(255,255,255,0.10)', 1);

    // Header Bar
    fillRRect(g, wx, wy, ww, 68, 24, '#151C2E');
    g.fillStyle = '#151C2E';
    g.fillRect(wx, wy + 40, ww, 28);
    g.beginPath();
    g.moveTo(wx, wy + 68);
    g.lineTo(wx + ww, wy + 68);
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.stroke();

    // Copilot avatar + live indicator
    const avGrad = g.createLinearGradient(wx + 28, wy + 16, wx + 64, wy + 52);
    avGrad.addColorStop(0, '#38BDF8');
    avGrad.addColorStop(1, '#6366F1');
    fillRRect(g, wx + 28, wy + 16, 36, 36, 11, avGrad);
    g.font = `800 15px ${MONO}`;
    g.fillStyle = '#FFFFFF';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('AI', wx + 46, wy + 34.5);

    g.textAlign = 'left';
    g.font = `700 16px ${SANS}`;
    g.fillStyle = '#F8FAFC';
    g.fillText('Northstar SRE Copilot', wx + 78, wy + 26);
    g.font = `500 12px ${MONO}`;
    g.fillStyle = '#34D399';
    g.fillText('● INCIDENT #402 · STREAMING TELEMETRY', wx + 78, wy + 46);

    // Clip message stream viewport
    g.save();
    g.beginPath();
    g.rect(wx + 1, wy + 69, ww - 2, wh - 138);
    g.clip();

    // Spring upward scroll displacement as new messages arrive
    const s1 = springValue(t - 1.15, 0.76, 20) * 44;
    const s2 = springValue(t - 2.15, 0.76, 18) * 86;
    const s3 = springValue(t - 3.25, 0.78, 20) * 46;
    const scrollY = s1 + s2 + s3;

    const baseBottom = wy + 332 - scrollY;

    // Message 1: User bubble (right-aligned, enters at t=0.18s)
    const m1 = clamp(springValue(t - 0.18, 0.72, 24), 0, 1.08);
    if (m1 > 0.01) {
      const bw = 468, bh = 62;
      const bx = wx + ww - 34 - bw;
      const by = baseBottom - 160 + (1 - m1) * 36;
      g.save();
      g.globalAlpha *= clamp(m1 * 1.2);
      const uGrad = g.createLinearGradient(bx, by, bx + bw, by + bh);
      uGrad.addColorStop(0, '#3B82F6');
      uGrad.addColorStop(1, '#4F46E5');
      fillRRect(g, bx, by, bw, bh, 18, uGrad);
      g.font = `600 16px ${SANS}`;
      g.fillStyle = '#FFFFFF';
      g.fillText('Why did p99 latency drop 42% at 14:00 UTC?', bx + 22, by + 31.5);

      // Timestamp + crisp read-receipt checkmarks
      const readK = smooth(0.55, 1.05, t);
      g.font = `500 11px ${MONO}`;
      g.fillStyle = '#94A3B8';
      g.textAlign = 'right';
      g.fillText('14:02 UTC', bx + bw - 26, by + bh + 16);
      drawReadChecks(g, bx + bw - 20, by + bh + 15, readK);
      g.textAlign = 'left';
      g.restore();
    }

    // Message 2a: Bouncing 3-dot typing indicator (1.15s .. 2.15s)
    const typIn = clamp(springValue(t - 1.15, 0.72, 24), 0, 1.1);
    const typOut = smooth(2.08, 2.24, t);
    const typVis = typIn * (1 - typOut);
    if (typVis > 0.01) {
      const bx = wx + 34, by = baseBottom - 54 + (1 - typIn) * 26;
      g.save();
      g.globalAlpha *= clamp(typVis * 1.3);
      fillRRect(g, bx, by, 96, 48, 18, '#1B2438');
      strokeRRect(g, bx, by, 96, 48, 18, 'rgba(255,255,255,0.09)', 1);
      for (let d = 0; d < 3; d++) {
        const bounce = Math.sin((t - 1.15) * 11 - d * 0.85);
        const dy = -5.5 * Math.max(0, bounce);
        g.beginPath();
        g.arc(bx + 28 + d * 20, by + 25 + dy, 4.8, 0, TAU);
        g.fillStyle = bounce > 0.2 ? '#38BDF8' : '#94A3B8';
        g.fill();
      }
      g.restore();
    }

    // Message 2b: Rich AI Reply + Inline Code/Metric Telemetry Chip (2.15s+)
    const m2 = clamp(springValue(t - 2.15, 0.74, 22), 0, 1.06);
    if (m2 > 0.01) {
      const bw = 596, bh = 188;
      const bx = wx + 34;
      const by = baseBottom - 54 + (1 - m2) * 28;
      g.save();
      g.globalAlpha *= clamp(m2 * 1.2);
      fillRRect(g, bx, by, bw, bh, 20, '#182134');
      strokeRRect(g, bx, by, bw, bh, 20, 'rgba(56, 189, 248, 0.24)', 1.2);

      const replyLine = 'Edge KV pre-warming shifted 98.7% of reads to local memory:';
      const streamChars = Math.floor(clamp((t - 2.20) * 85, 0, replyLine.length));
      g.font = `500 16px ${SANS}`;
      g.fillStyle = '#F1F5F9';
      g.fillText(replyLine.slice(0, streamChars), bx + 22, by + 34);

      // Inline Code / Metric Telemetry Chip
      const chipK = clamp(springValue(t - 2.55, 0.74, 22), 0, 1.05);
      if (chipK > 0.01) {
        const cx = bx + 22, cy = by + 60, cw = bw - 44, ch = 104;
        g.save();
        g.globalAlpha *= clamp(chipK);
        fillRRect(g, cx, cy, cw, ch, 13, '#0D1320');
        strokeRRect(g, cx, cy, cw, ch, 13, 'rgba(45, 212, 191, 0.35)', 1);

        // Code badge header
        fillRRect(g, cx + 14, cy + 14, 178, 24, 6, 'rgba(45, 212, 191, 0.14)');
        g.font = `700 12px ${MONO}`;
        g.fillStyle = '#2DD4BF';
        g.fillText('edge_kv.hit_ratio', cx + 24, cy + 26.5);

        g.font = `800 28px ${MONO}`;
        g.fillStyle = '#F8FAFC';
        g.fillText('98.7%', cx + 16, cy + 72);

        g.font = `700 13px ${MONO}`;
        g.fillStyle = '#34D399';
        g.fillText('▲ +14.2%  ·  11.2 ms p99', cx + 126, cy + 74);

        // Mini sparkline inside metric chip
        const spPts = [0.22, 0.25, 0.24, 0.58, 0.84, 0.92, 0.96];
        g.beginPath();
        spPts.forEach((sv, si) => {
          const sx = cx + cw - 154 + si * 22;
          const sy = cy + 82 - sv * 54;
          if (si === 0) g.moveTo(sx, sy);
          else g.lineTo(sx, sy);
        });
        g.strokeStyle = '#2DD4BF';
        g.lineWidth = 2.6;
        g.stroke();
        g.restore();
      }
      g.restore();
    }

    // Message 3: User crisp confirmation reply + double read ticks (3.25s+, visible at hero=3.8!)
    const m3 = clamp(springValue(t - 3.25, 0.72, 24), 0, 1.08);
    if (m3 > 0.01) {
      const bw = 342, bh = 54;
      const bx = wx + ww - 34 - bw;
      const by = baseBottom + 154 + (1 - m3) * 32;
      g.save();
      g.globalAlpha *= clamp(m3 * 1.2);
      const uGrad = g.createLinearGradient(bx, by, bx + bw, by + bh);
      uGrad.addColorStop(0, '#3B82F6');
      uGrad.addColorStop(1, '#4F46E5');
      fillRRect(g, bx, by, bw, bh, 18, uGrad);
      g.font = `600 15.5px ${SANS}`;
      g.fillStyle = '#FFFFFF';
      g.fillText('Lock rollout across all regions.', bx + 22, by + 27.5);

      const read3 = smooth(3.48, 3.74, t);
      g.font = `500 11px ${MONO}`;
      g.fillStyle = '#94A3B8';
      g.textAlign = 'right';
      g.fillText('Read · 14:02 UTC', bx + bw - 26, by + bh + 16);
      drawReadChecks(g, bx + bw - 20, by + bh + 15, read3);
      g.textAlign = 'left';
      g.restore();
    }

    g.restore(); // end message clip

    // Bottom composer input bar
    fillRRect(g, wx + 22, wy + wh - 56, ww - 44, 40, 12, '#0B0F1A');
    strokeRRect(g, wx + 22, wy + wh - 56, ww - 44, 40, 12, 'rgba(255,255,255,0.08)', 1);
    g.font = `500 13px ${SANS}`;
    g.fillStyle = '#64748B';
    g.fillText('Ask Copilot or run /rollout...', wx + 40, wy + wh - 35.5);
    fillRRect(g, wx + ww - 88, wy + wh - 50, 58, 28, 8, 'rgba(56,189,248,0.16)');
    g.font = `700 11px ${MONO}`;
    g.fillStyle = '#38BDF8';
    g.textAlign = 'center';
    g.fillText('SEND', wx + ww - 59, wy + wh - 35.5);

    g.restore();
  }

  return { canvas, ready: ensureFonts(), frame };
}

export const studies = [
  {
    id: 'ui-cursor-loupe',
    name: 'Cursor spline and optical loupe',
    kind: 'ui',
    grade: 'A',
    stacks: ['canvas'],
    period: 6.0,
    hero: 2.6,
    aspect: '16 / 9',
    chips: ['piecewise Hermite cursor', '2.2x vector optical loupe', 'spring click ripple'],
    purpose: 'A virtual cursor follows a piecewise-Hermite spline across a SaaS dashboard, clicking controls while a 2.2x circular optical loupe magnifies live UI states.',
  },
  {
    id: 'ui-cmd-palette',
    name: 'Command palette choreography',
    kind: 'ui',
    grade: 'A',
    stacks: ['canvas'],
    period: 5.6,
    hero: 2.3,
    aspect: '16 / 9',
    chips: ['spring modal pop', 'fuzzy match highlight', 'FX_CUSTOM_TEXT'],
    purpose: 'A command palette springs over a recessed workspace, types a deterministic query, glides across fuzzy-ranked matches and confirms with a deployment toast.',
  },
  {
    id: 'ui-flip-modal',
    name: 'FLIP bento inspector modal',
    kind: 'ui',
    grade: 'A',
    stacks: ['canvas'],
    period: 5.4,
    hero: 2.4,
    aspect: '16 / 9',
    chips: ['FLIP box + radius morph', 'recessed sibling cards', 'cohort detail reveal'],
    purpose: 'A selected bento card expands via deterministic FLIP geometry and corner-radius interpolation into a full revenue inspector while sibling cards recess.',
  },
  {
    id: 'ui-chat-flow',
    name: 'Streaming copilot thread',
    kind: 'ui',
    grade: 'A',
    stacks: ['canvas'],
    period: 6.4,
    hero: 3.8,
    aspect: '16 / 9',
    chips: ['3-dot typing wave', 'spring scroll displacement', 'inline metric chip'],
    purpose: 'A two-party AI incident thread scrolls upward on damped springs as typing indicators morph into structured replies, inline telemetry chips and read ticks.',
  },
];

export async function create(id, options = {}) {
  const builders = {
    'ui-cursor-loupe': buildCursorLoupe,
    'ui-cmd-palette': buildCmdPalette,
    'ui-flip-modal': buildFlipModal,
    'ui-chat-flow': buildChatFlow,
  };
  const fn = builders[id];
  if (!fn) throw new Error('Unknown ui-stage demo: ' + id);
  const inst = fn(options);
  await inst.ready;
  return inst;
}
