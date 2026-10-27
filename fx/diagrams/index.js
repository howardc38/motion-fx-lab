// Business Data Diagrams & Flowing Architecture effects (0BSD).
// Pure deterministic frame(t) implementations on a 1280x720 (16:9) Canvas 2D stage.

const W = 1280;
const H = 720;
const TAU = Math.PI * 2;
const SANS = '"Archivo", "Helvetica Neue", -apple-system, Arial, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

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

function springValue(u, zeta = 0.68, omega = 20) {
  if (u <= 0) return 0;
  const wd = omega * Math.sqrt(Math.max(0.001, 1 - zeta * zeta));
  const env = Math.exp(-zeta * omega * u);
  return 1 - env * (Math.cos(wd * u) + ((zeta * omega) / wd) * Math.sin(wd * u));
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

function cubicPoint(p0, p1, p2, p3, u) {
  const v = 1 - u;
  const b0 = v * v * v;
  const b1 = 3 * v * v * u;
  const b2 = 3 * v * u * u;
  const b3 = u * u * u;
  return {
    x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
    y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
  };
}

function quadPoint(p0, p1, p2, u) {
  const v = 1 - u;
  return {
    x: v * v * p0.x + 2 * v * u * p1.x + u * u * p2.x,
    y: v * v * p0.y + 2 * v * u * p1.y + u * u * p2.y,
  };
}

function quadTangent(p0, p1, p2, u) {
  return {
    dx: 2 * (1 - u) * (p1.x - p0.x) + 2 * u * (p2.x - p1.x),
    dy: 2 * (1 - u) * (p1.y - p0.y) + 2 * u * (p2.y - p1.y),
  };
}

async function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  const sample = 'BESbswy0123456789 ·$%+–→°';
  await Promise.allSettled([
    document.fonts.load(`500 14px ${SANS}`, sample),
    document.fonts.load(`600 16px ${SANS}`, sample),
    document.fonts.load(`700 20px ${SANS}`, sample),
    document.fonts.load(`800 36px ${SANS}`, sample),
    document.fonts.load(`600 12px ${MONO}`, sample),
    document.fonts.load(`700 16px ${MONO}`, sample),
    document.fonts.load(`800 22px ${MONO}`, sample),
  ]);
  if (document.fonts.ready) await document.fonts.ready;
}

function makeSurface(width = W, height = H) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, g: canvas.getContext('2d') };
}

// ============================================================================
// 1. data-node-flow (lead, period: 6.0, hero: 2.8)
// ============================================================================
function buildDataNodeFlow(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const { canvas, g } = makeSurface(width, height);
  const PERIOD = 6.0;

  const nodes = {
    ingest: { id: 'ingest', x: 64, y: 292, w: 204, h: 136, title: 'Ingest Gateway', tag: 'STAGE 01', accent: '#38BDF8', enter: 0.05 },
    router: { id: 'router', x: 348, y: 278, w: 216, h: 164, title: 'Vector Router', tag: 'STAGE 02', accent: '#818CF8', enter: 0.16 },
    m0: { id: 'm0', x: 656, y: 146, w: 228, h: 108, title: 'Fast-8B Lane', tag: 'POOL · 01', accent: '#2DD4BF', util: 0.84, enter: 0.28 },
    m1: { id: 'm1', x: 656, y: 306, w: 228, h: 108, title: 'Reason-70B Lane', tag: 'POOL · 02', accent: '#A78BFA', util: 0.68, enter: 0.34 },
    m2: { id: 'm2', x: 656, y: 466, w: 228, h: 108, title: 'Vision-VL Lane', tag: 'POOL · 03', accent: '#F59E0B', util: 0.56, enter: 0.40 },
    output: { id: 'output', x: 972, y: 272, w: 244, h: 176, title: 'Verified Output', tag: 'STAGE 04', accent: '#34D399', enter: 0.50 },
  };

  function makeEdge(x0, y0, x3, y3, targetId, color, phaseOffset, speed = 1.0) {
    const dx = (x3 - x0) * 0.52;
    return {
      p0: { x: x0, y: y0 },
      p1: { x: x0 + dx, y: y0 },
      p2: { x: x3 - dx, y: y3 },
      p3: { x: x3, y: y3 },
      targetId,
      color,
      phaseOffset,
      speed,
    };
  }

  const edges = [
    makeEdge(268, 360, 348, 360, 'router', '#38BDF8', 0.00, 1.5),
    makeEdge(564, 326, 656, 200, 'm0', '#2DD4BF', 0.22, 1.25),
    makeEdge(564, 360, 656, 360, 'm1', '#A78BFA', 0.48, 1.15),
    makeEdge(564, 394, 656, 520, 'm2', '#F59E0B', 0.72, 1.05),
    makeEdge(884, 200, 972, 328, 'output', '#2DD4BF', 0.55, 1.25),
    makeEdge(884, 360, 972, 360, 'output', '#A78BFA', 0.80, 1.15),
    makeEdge(884, 520, 972, 392, 'output', '#34D399', 0.12, 1.05),
  ];

  // Deterministic node pulse computed analytically from packet arrival phases
  function nodePulse(nodeId, t) {
    let best = 0;
    for (const e of edges) {
      if (e.targetId !== nodeId) continue;
      // Packets cycle at exact integer frequency (2 or 3 cycles per 6.0s period) for seamless loop!
      const cycles = e.targetId === 'router' ? 4 : 3;
      const u = ((t / PERIOD) * cycles + e.phaseOffset) % 1;
      // Arrival occurs as u wraps past 0.96 -> 0.0
      const sinceArrival = u < 0.35 ? u / cycles * PERIOD : 99;
      best = Math.max(best, Math.exp(-sinceArrival * 7.5));
    }
    return best;
  }

  function drawPortSocket(ctx, x, y, color) {
    ctx.beginPath();
    ctx.arc(x, y, 5.2, 0, TAU);
    ctx.fillStyle = '#0B101D';
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function frame(time) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);

    // Architectural dark studio backdrop
    const bg = g.createRadialGradient(W * 0.52, H * 0.48, 40, W * 0.5, H * 0.5, W * 0.78);
    bg.addColorStop(0, '#121A2E');
    bg.addColorStop(0.62, '#0A0F1C');
    bg.addColorStop(1, '#060911');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // Fine engineering grid
    g.strokeStyle = 'rgba(148, 163, 184, 0.05)';
    g.lineWidth = 1;
    for (let x = 40; x < W; x += 40) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    for (let y = 40; y < H; y += 40) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }

    // Header telemetry bar
    g.font = `700 12px ${MONO}`;
    g.fillStyle = '#38BDF8';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('SYSTEM TOPOLOGY // INFERENCE ROUTING PIPELINE', 64, 54);
    g.font = `800 26px ${SANS}`;
    g.fillStyle = '#F8FAFC';
    g.fillText('Live Multi-Model Dataflow', 64, 86);

    const totalTok = (14.2 + 0.9 * Math.sin((TAU * t) / PERIOD * 2)).toFixed(1);
    fillRRect(g, W - 316, 48, 252, 46, 12, 'rgba(16, 185, 129, 0.12)');
    strokeRRect(g, W - 316, 48, 252, 46, 12, 'rgba(52, 211, 153, 0.36)', 1);
    g.font = `700 13px ${MONO}`;
    g.fillStyle = '#34D399';
    g.textAlign = 'center';
    g.fillText(`● ${totalTok}k tok/s  ·  99.94% SLA`, W - 190, 71.5);
    g.textAlign = 'left';

    // Model Pool enclosing cluster boundary
    g.save();
    g.setLineDash([6, 6]);
    strokeRRect(g, 636, 114, 268, 480, 18, 'rgba(148, 163, 184, 0.22)', 1.2);
    g.setLineDash([]);
    g.font = `700 10.5px ${MONO}`;
    g.fillStyle = '#94A3B8';
    g.fillText('MODEL POOL CLUSTER · 3 SPECIALISTS', 654, 130);
    g.restore();

    // 1. Cubic Bézier Port Edges + Glowing Comet Packets
    for (const e of edges) {
      const drawProg = smooth(0.18, 0.72, t);
      g.save();
      g.beginPath();
      const segs = Math.max(2, Math.floor(40 * drawProg));
      for (let i = 0; i <= segs; i++) {
        const pt = cubicPoint(e.p0, e.p1, e.p2, e.p3, i / 40);
        if (i === 0) g.moveTo(pt.x, pt.y);
        else g.lineTo(pt.x, pt.y);
      }
      g.strokeStyle = 'rgba(148, 163, 184, 0.26)';
      g.lineWidth = 2.2;
      g.stroke();

      // Active packet + comet tail (integer cycles per period for seamless loop!)
      if (t >= 0.45) {
        const cycles = e.targetId === 'router' ? 4 : 3;
        for (let pkt = 0; pkt < 2; pkt++) {
          const u = ((t / PERIOD) * cycles + e.phaseOffset + pkt * 0.5) % 1;
          // Comet tail
          for (let s = 8; s >= 1; s--) {
            const us = clamp(u - s * 0.018, 0, 1);
            const tp = cubicPoint(e.p0, e.p1, e.p2, e.p3, us);
            g.beginPath();
            g.arc(tp.x, tp.y, 4.8 * (1 - s / 10), 0, TAU);
            g.fillStyle = e.color;
            g.globalAlpha = (1 - s / 9) * 0.42;
            g.fill();
          }
          g.globalAlpha = 1;
          const head = cubicPoint(e.p0, e.p1, e.p2, e.p3, u);
          const glow = g.createRadialGradient(head.x, head.y, 1, head.x, head.y, 16);
          glow.addColorStop(0, '#FFFFFF');
          glow.addColorStop(0.35, e.color);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = glow;
          g.beginPath();
          g.arc(head.x, head.y, 16, 0, TAU);
          g.fill();
        }
      }
      g.restore();
    }

    // 2. Render Architecture Nodes + Activation Ring Pulses + Live Counters
    for (const key of Object.keys(nodes)) {
      const n = nodes[key];
      const enter = clamp(springValue(t - n.enter, 0.72, 22), 0, 1.06);
      if (enter <= 0.01) continue;
      const pulse = t > 0.6 ? nodePulse(n.id, t) : 0;

      g.save();
      const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
      g.translate(cx, cy);
      const sc = 0.86 + 0.14 * enter + 0.018 * pulse;
      g.scale(sc, sc);
      g.translate(-cx, -cy);

      // Expanding activation shock ring on packet arrival
      if (pulse > 0.08) {
        const expand = (1 - pulse) * 18;
        strokeRRect(g, n.x - expand, n.y - expand, n.w + expand * 2, n.h + expand * 2, 16 + expand * 0.6, n.accent, 1.8 * pulse);
      }

      g.save();
      g.shadowColor = 'rgba(0,0,0,0.52)';
      g.shadowBlur = 28;
      g.shadowOffsetY = 12;
      fillRRect(g, n.x, n.y, n.w, n.h, 15, '#131B2E');
      g.restore();

      const surf = g.createLinearGradient(n.x, n.y, n.x, n.y + n.h);
      surf.addColorStop(0, '#18233B');
      surf.addColorStop(1, '#101728');
      fillRRect(g, n.x, n.y, n.w, n.h, 15, surf);
      strokeRRect(g, n.x, n.y, n.w, n.h, 15, pulse > 0.25 ? n.accent : 'rgba(255,255,255,0.11)', 1.2 + pulse * 0.8);

      // Top accent strip
      fillRRect(g, n.x + 16, n.y, 54, 3, 1.5, n.accent);

      g.font = `700 10px ${MONO}`;
      g.fillStyle = n.accent;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      g.fillText(n.tag, n.x + 18, n.y + 24);

      g.font = `700 16.5px ${SANS}`;
      g.fillStyle = '#F8FAFC';
      g.fillText(n.title, n.x + 18, n.y + 49);

      // Node-specific live telemetry interior
      if (n.id === 'ingest') {
        const rps = (28.4 + 1.4 * Math.sin((TAU * t) / PERIOD * 2)).toFixed(1);
        g.font = `800 24px ${MONO}`;
        g.fillStyle = '#E2E8F0';
        g.fillText(`${rps}k`, n.x + 18, n.y + 88);
        g.font = `600 11px ${MONO}`;
        g.fillStyle = '#94A3B8';
        g.fillText('REQ/S · TLS 1.3', n.x + 18, n.y + 113);
      } else if (n.id === 'router') {
        g.font = `600 11.5px ${MONO}`;
        g.fillStyle = '#CBD5E1';
        g.fillText('COSINE TOP-K = 3', n.x + 18, n.y + 82);
        // 3 mini lane bars
        [0.88, 0.72, 0.58].forEach((lv, li) => {
          const ly = n.y + 102 + li * 16;
          fillRRect(g, n.x + 18, ly, n.w - 36, 8, 4, '#0B101D');
          const dyn = clamp(lv + 0.08 * Math.sin(t * 5 + li * 2), 0.1, 1);
          fillRRect(g, n.x + 18, ly, (n.w - 36) * dyn, 8, 4, ['#2DD4BF', '#A78BFA', '#F59E0B'][li]);
        });
      } else if (n.util != null) {
        const dynUtil = Math.round((n.util + 0.05 * Math.sin((TAU * t) / PERIOD * 3 + n.y)) * 100);
        g.font = `700 12px ${MONO}`;
        g.fillStyle = '#CBD5E1';
        g.fillText(`GPU UTIL ${dynUtil}%`, n.x + 18, n.y + 76);
        fillRRect(g, n.x + 18, n.y + 90, n.w - 36, 7, 3.5, '#0B101D');
        fillRRect(g, n.x + 18, n.y + 90, ((n.w - 36) * dynUtil) / 100, 7, 3.5, n.accent);
      } else if (n.id === 'output') {
        const count = 48210 + Math.floor(((t / PERIOD) * 180));
        g.font = `800 26px ${MONO}`;
        g.fillStyle = '#34D399';
        g.fillText(count.toLocaleString('en-US'), n.x + 18, n.y + 92);
        g.font = `600 11px ${MONO}`;
        g.fillStyle = '#94A3B8';
        g.fillText('VERIFIED PAYLOADS', n.x + 18, n.y + 120);
        fillRRect(g, n.x + 18, n.y + 136, 138, 24, 12, 'rgba(16, 185, 129, 0.16)');
        g.fillStyle = '#6EE7B7';
        g.font = `700 10.5px ${MONO}`;
        g.fillText('✓ SCHEMA VALID', n.x + 30, n.y + 148.5);
      }

      g.restore();
    }

    // Port sockets drawn crisp on top
    for (const e of edges) {
      drawPortSocket(g, e.p0.x, e.p0.y, e.color);
      drawPortSocket(g, e.p3.x, e.p3.y, e.color);
    }

    // Bottom footnote bar
    g.font = `600 11px ${MONO}`;
    g.fillStyle = '#64748B';
    g.fillText('CUBIC BEZIER PORT ROUTING   ·   ZERO-DROP BACKPRESSURE   ·   TABULAR TELEMETRY', 64, H - 36);

    g.restore();
  }

  return { canvas, ready: ensureFonts(), frame };
}

// ============================================================================
// 2. data-donut (variant, period: 5.4, hero: 2.7)
// ============================================================================
function buildDataDonut(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const { canvas, g } = makeSurface(width, height);
  const PERIOD = 5.4;

  const slices = [
    { label: 'Compute GPU Clusters', share: 0.42, amount: '$2.02M', delta: '+18.4%', color: '#4F7CFF', heroSlice: true },
    { label: 'Vector & Object Storage', share: 0.24, amount: '$1.16M', delta: '+9.2%', color: '#2DD4BF', heroSlice: false },
    { label: 'Global Anycast Edge', share: 0.16, amount: '$0.77M', delta: '+14.1%', color: '#F59E0B', heroSlice: false },
    { label: 'Observability & Traces', share: 0.11, amount: '$0.53M', delta: '+4.8%', color: '#A78BFA', heroSlice: false },
    { label: 'Failover Capacity Reserve', share: 0.07, amount: '$0.34M', delta: '0.0%', color: '#64748B', heroSlice: false },
  ];

  function drawDonutSegment(ctx, cx, cy, rIn, rOut, a0, a1, fill) {
    if (a1 - a0 <= 0.002) return;
    ctx.beginPath();
    ctx.arc(cx, cy, rOut, a0, a1);
    ctx.arc(cx, cy, rIn, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function frame(time) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);

    // Executive dark slate canvas
    const bg = g.createRadialGradient(W * 0.35, H * 0.5, 40, W * 0.5, H * 0.5, W * 0.8);
    bg.addColorStop(0, '#141C2F');
    bg.addColorStop(0.65, '#0B101C');
    bg.addColorStop(1, '#070A12');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    const retract = smooth(4.72, 5.28, t);
    const keep = 1 - retract;

    // Header
    g.font = `700 12px ${MONO}`;
    g.fillStyle = '#60A5FA';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('CAPITAL ALLOCATION // FY26 CLOUD INFRASTRUCTURE', 76, 62);
    g.font = `800 30px ${SANS}`;
    g.fillStyle = '#F8FAFC';
    g.fillText('Annualized Compute & Edge Spend', 76, 98);

    const cx = 334, cy = 406, rOut = 176, rIn = 106;
    const gap = 0.024;
    const explodeK = clamp(springValue(t - 1.48, 0.58, 19), 0, 1.2) * keep;

    // Subtle track ring
    g.beginPath();
    g.arc(cx, cy, (rOut + rIn) / 2, 0, TAU);
    g.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    g.lineWidth = rOut - rIn;
    g.stroke();

    let cursorAngle = -Math.PI * 0.62;
    const computed = [];

    slices.forEach((s, idx) => {
      const span = s.share * TAU;
      const staggerStart = 0.14 + idx * 0.13;
      const sweep = clamp(springValue(t - staggerStart, 0.76, 17), 0, 1) * keep;
      const a0 = cursorAngle + gap * 0.5;
      const a1 = cursorAngle + Math.max(gap * 0.5, (span - gap * 0.5) * sweep);
      const midA = cursorAngle + span * 0.5;
      cursorAngle += span;

      const det = s.heroSlice ? 20 * explodeK : 0;
      const scx = cx + Math.cos(midA) * det;
      const scy = cy + Math.sin(midA) * det;

      g.save();
      if (s.heroSlice && explodeK > 0.05) {
        g.shadowColor = 'rgba(79, 124, 255, 0.45)';
        g.shadowBlur = 28 * explodeK;
      }
      drawDonutSegment(g, scx, scy, rIn, s.heroSlice ? rOut + 6 * clamp(explodeK) : rOut, a0, a1, s.color);
      g.restore();

      computed.push({ ...s, midA, scx, scy, sweep });
    });

    // Center Hole KPI Readout
    const countK = outCubic(lin(0.18, 1.55, t)) * keep;
    g.textAlign = 'center';
    g.font = `700 11px ${MONO}`;
    g.fillStyle = '#94A3B8';
    g.fillText('TOTAL BUDGET', cx, cy - 26);
    g.font = `800 38px ${MONO}`;
    g.fillStyle = '#F8FAFC';
    g.fillText(`$${(4.82 * countK).toFixed(2)}M`, cx, cy + 10);
    g.font = `700 12px ${MONO}`;
    g.fillStyle = '#34D399';
    g.fillText('+13.8% YoY', cx, cy + 40);

    // Leader Callouts for Hero Slice (0) & Storage Slice (1) routed cleanly into open margins
    const calloutK = smooth(1.62, 2.12, t) * keep;
    if (calloutK > 0.01) {
      [computed[0], computed[1]].forEach((cs) => {
        const rAnchor = cs.heroSlice ? rOut + 6 : rOut;
        // Anchor hero slice on upper-right arc (-0.52 rad) so badge sits cleanly above-left of legend
        const anchorAng = cs.heroSlice ? -0.52 : cs.midA;
        const ax = cs.scx + Math.cos(anchorAng) * rAnchor;
        const ay = cs.scy + Math.sin(anchorAng) * rAnchor;
        const dirX = 1;
        const dirY = cs.heroSlice ? -1 : 1;
        const ex = ax + dirX * 24;
        const ey = ay + dirY * (cs.heroSlice ? 34 : 24);
        const tx = ex + dirX * 26;

        g.save();
        g.globalAlpha = calloutK;
        g.beginPath();
        g.arc(ax, ay, 3.5, 0, TAU);
        g.fillStyle = '#FFFFFF';
        g.fill();
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(ex, ey);
        g.lineTo(tx, ey);
        g.strokeStyle = cs.color;
        g.lineWidth = 2;
        g.stroke();

        const bw = 136, bh = 46;
        const bx = Math.min(736 - bw - 22, tx + 6);
        const by = ey - bh / 2;
        fillRRect(g, bx, by, bw, bh, 9, 'rgba(15, 23, 42, 0.94)');
        strokeRRect(g, bx, by, bw, bh, 9, cs.color, 1.2);
        g.font = `800 15px ${MONO}`;
        g.fillStyle = '#F8FAFC';
        g.textAlign = 'center';
        g.fillText(`${Math.round(cs.share * 100)}% · ${cs.amount}`, bx + bw / 2, by + 18);
        g.font = `600 10px ${MONO}`;
        g.fillStyle = '#94A3B8';
        g.fillText(cs.heroSlice ? 'HERO ALLOCATION' : 'TIER 2 STORAGE', bx + bw / 2, by + 35);
        g.restore();
      });
    }

    // Right-hand Synchronized Tabular-Numeral Legend Panel
    const lx = 736, ly = 166, lw = 468, lh = 468;
    fillRRect(g, lx, ly, lw, lh, 20, 'rgba(19, 27, 46, 0.88)');
    strokeRRect(g, lx, ly, lw, lh, 20, 'rgba(255,255,255,0.09)', 1);

    g.textAlign = 'left';
    g.font = `700 11px ${MONO}`;
    g.fillStyle = '#94A3B8';
    g.fillText('CATEGORY BREAKDOWN', lx + 28, ly + 36);
    g.textAlign = 'right';
    g.fillText('SHARE     SPEND', lx + lw - 28, ly + 36);

    g.beginPath();
    g.moveTo(lx + 24, ly + 56);
    g.lineTo(lx + lw - 24, ly + 56);
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.stroke();

    computed.forEach((s, i) => {
      const ry = ly + 76 + i * 74;
      const rowIn = smooth(0.25 + i * 0.11, 0.65 + i * 0.11, t) * keep;
      g.save();
      g.globalAlpha = rowIn;

      if (s.heroSlice && explodeK > 0.1) {
        fillRRect(g, lx + 14, ry - 12, lw - 28, 60, 12, `rgba(79, 124, 255, ${(0.15 * clamp(explodeK)).toFixed(3)})`);
        strokeRRect(g, lx + 14, ry - 12, lw - 28, 60, 12, `rgba(79, 124, 255, ${(0.45 * clamp(explodeK)).toFixed(3)})`, 1);
      }

      // Color swatch
      fillRRect(g, lx + 28, ry + 4, 14, 28, 4, s.color);

      g.textAlign = 'left';
      g.font = `700 16px ${SANS}`;
      g.fillStyle = '#F8FAFC';
      g.fillText(s.label, lx + 54, ry + 11);

      g.font = `600 11.5px ${MONO}`;
      g.fillStyle = s.delta.startsWith('+') ? '#34D399' : '#94A3B8';
      g.fillText(`YoY ${s.delta}`, lx + 54, ry + 31);

      // Animated tabular share & dollar columns
      const curPct = (s.share * 100 * s.sweep).toFixed(1).padStart(4, ' ');
      g.textAlign = 'right';
      g.font = `700 17px ${MONO}`;
      g.fillStyle = '#CBD5E1';
      g.fillText(`${curPct}%`, lx + lw - 124, ry + 18);

      g.font = `800 17px ${MONO}`;
      g.fillStyle = '#F8FAFC';
      g.fillText(s.amount, lx + lw - 28, ry + 18);

      g.restore();
    });

    g.restore();
  }

  return { canvas, ready: ensureFonts(), frame };
}

// ============================================================================
// 3. data-map-route (variant, period: 5.8, hero: 3.1)
// ============================================================================
function buildDataMapRoute(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const { canvas, g } = makeSurface(width, height);
  const PERIOD = 5.8;

  // Stylized Pacific-Rim landmass polygons in logical 1280x720 map coordinates
  const landmasses = [
    // East Asian Mainland + Kamchatka
    [
      [40, 580], [96, 560], [156, 536], [204, 502], [238, 466], [262, 412],
      [246, 362], [278, 332], [308, 354], [326, 314], [368, 258], [442, 208],
      [524, 168], [588, 178], [566, 224], [542, 232], [520, 198], [456, 236],
      [398, 294], [358, 296], [332, 336], [286, 376], [292, 434], [254, 498],
      [196, 538], [164, 594], [124, 636], [40, 640],
    ],
    // Japan Archipelago (Honshu + Hokkaido + Kyushu stylized)
    [
      [386, 424], [412, 404], [438, 382], [454, 344], [468, 312],
      [448, 304], [428, 346], [404, 384], [376, 408],
    ],
    [
      [458, 296], [492, 274], [504, 292], [472, 308],
    ],
    // Taiwan + Luzon
    [
      [268, 514], [282, 504], [286, 528], [272, 534],
    ],
    [
      [278, 566], [298, 558], [306, 598], [284, 606],
    ],
    // Alaska + North American West Coast (BC -> Seattle -> SFO -> Baja)
    [
      [718, 174], [792, 146], [886, 152], [958, 198], [998, 252],
      [1024, 312], [1038, 364], [1068, 422], [1118, 486], [1166, 548],
      [1240, 590], [1240, 120], [696, 120], [662, 188], [698, 194],
    ],
  ];

  const hubs = {
    hkg: { code: 'HKG', city: 'Hong Kong', coords: '22.3°N 114.2°E', x: 214, y: 498 },
    tyo: { code: 'TYO', city: 'Tokyo Haneda', coords: '35.5°N 139.8°E', x: 438, y: 376 },
    sfo: { code: 'SFO', city: 'San Francisco', coords: '37.6°N 122.4°W', x: 1036, y: 364 },
  };

  const leg1 = {
    p0: { x: hubs.hkg.x, y: hubs.hkg.y },
    p1: { x: 304, y: 386 },
    p2: { x: hubs.tyo.x, y: hubs.tyo.y },
    km: 2960,
  };
  const leg2 = {
    p0: { x: hubs.tyo.x, y: hubs.tyo.y },
    p1: { x: 734, y: 176 }, // True North-Pacific great-circle arch!
    p2: { x: hubs.sfo.x, y: hubs.sfo.y },
    km: 8280,
  };

  function drawAircraftChevron(ctx, x, y, dx, dy, color) {
    const ang = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(-8, -7.5);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 7.5);
    ctx.closePath();
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }

  function drawHubPin(ctx, hub, activeK, pulsePhase, align = 'left') {
    ctx.save();
    // Radar pulsing concentric rings
    for (let r = 0; r < 2; r++) {
      const u = ((pulsePhase + r * 0.5) % 1);
      const rad = 8 + u * 44 * activeK;
      ctx.beginPath();
      ctx.arc(hub.x, hub.y, rad, 0, TAU);
      ctx.strokeStyle = `rgba(56, 189, 248, ${((1 - u) * 0.65 * activeK).toFixed(3)})`;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    // Core beacon pin
    ctx.beginPath();
    ctx.arc(hub.x, hub.y, 6.5, 0, TAU);
    ctx.fillStyle = activeK > 0.2 ? '#38BDF8' : '#64748B';
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#F8FAFC';
    ctx.stroke();

    // Label callout pill
    const bw = 132, bh = 48;
    const bx = align === 'right' ? hub.x - bw - 16 : align === 'top' ? hub.x - bw / 2 : hub.x + 16;
    const by = align === 'top' ? hub.y + 16 : hub.y - bh / 2;
    fillRRect(ctx, bx, by, bw, bh, 9, 'rgba(9, 17, 30, 0.90)');
    strokeRRect(ctx, bx, by, bw, bh, 9, activeK > 0.2 ? 'rgba(56, 189, 248, 0.55)' : 'rgba(148, 163, 184, 0.25)', 1.2);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `800 16px ${MONO}`;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(hub.code, bx + 12, by + 17);
    ctx.font = `600 10px ${MONO}`;
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('HUB', bx + 58, by + 17);
    ctx.font = `500 11px ${SANS}`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(hub.city, bx + 12, by + 35);
    ctx.restore();
  }

  function drawGreatCircleLeg(ctx, leg, prog, dashOffset) {
    if (prog <= 0.005) return null;
    const steps = Math.max(2, Math.floor(64 * prog));

    // Subtle sea-surface shadow arc underneath elevated geodesic arc
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = i / 64;
      const sx = lerp(leg.p0.x, leg.p2.x, u);
      const sy = lerp(leg.p0.y, leg.p2.y, u) + Math.sin(u * Math.PI) * 12;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = 'rgba(2, 6, 14, 0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Glowing base route spline
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const pt = quadPoint(leg.p0, leg.p1, leg.p2, i / 64);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.34)';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Crisp animated dashed great-circle line
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = -dashOffset;
    ctx.strokeStyle = '#7DD3FC';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const uHead = steps / 64;
    const pos = quadPoint(leg.p0, leg.p1, leg.p2, uHead);
    const tan = quadTangent(leg.p0, leg.p1, leg.p2, uHead);
    return { ...pos, ...tan };
  }

  function frame(time) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);

    // Deep abyssal cartographic navy ocean
    const sea = g.createRadialGradient(W * 0.5, H * 0.45, 60, W * 0.5, H * 0.5, W * 0.8);
    sea.addColorStop(0, '#0D1E36');
    sea.addColorStop(0.65, '#081222');
    sea.addColorStop(1, '#040913');
    g.fillStyle = sea;
    g.fillRect(0, 0, W, H);

    // Cartographic Lat/Lon Graticule Grid + Degree Labels
    g.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    g.lineWidth = 1;
    g.font = `600 10px ${MONO}`;
    g.fillStyle = 'rgba(148, 163, 184, 0.42)';
    const lonLabels = ['110°E', '130°E', '150°E', '170°E', '170°W', '150°W', '130°W', '110°W'];
    for (let i = 0; i < 8; i++) {
      const x = 110 + i * 150;
      g.beginPath();
      g.moveTo(x, 84);
      g.lineTo(x, H - 56);
      g.stroke();
      g.textAlign = 'center';
      g.fillText(lonLabels[i], x, H - 38);
    }
    const latLabels = ['60°N', '45°N', '30°N', '15°N'];
    for (let j = 0; j < 4; j++) {
      const y = 160 + j * 136;
      g.beginPath();
      g.moveTo(40, y);
      g.lineTo(W - 40, y);
      g.stroke();
      g.textAlign = 'left';
      g.fillText(latLabels[j], 48, y - 6);
    }

    // Stylized Coastline Contours + Landmass Fills
    for (const poly of landmasses) {
      g.beginPath();
      poly.forEach(([px, py], idx) => {
        if (idx === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      });
      g.closePath();
      g.fillStyle = '#13263E';
      g.fill();
      g.strokeStyle = 'rgba(94, 234, 212, 0.32)';
      g.lineWidth = 1.5;
      g.stroke();
    }

    const fadeReset = 1 - smooth(5.25, 5.70, t);
    g.globalAlpha = fadeReset;

    // Route progression:
    // Leg 1 (HKG -> TYO): 0.35s .. 1.68s
    // Leg 2 (TYO -> SFO): 1.72s .. 3.85s (at hero=3.1s, aircraft is 72% across North Pacific!)
    const p1 = inOutCubic(lin(0.35, 1.68, t));
    const p2 = inOutCubic(lin(1.72, 3.85, t));
    const dashOff = t * 42;

    const head1 = drawGreatCircleLeg(g, leg1, p1, dashOff);
    const head2 = drawGreatCircleLeg(g, leg2, p2, dashOff);

    const pulsePhase = (t / PERIOD) * 4;
    drawHubPin(g, hubs.hkg, smooth(0.05, 0.35, t), pulsePhase, 'top');
    drawHubPin(g, hubs.tyo, smooth(1.45, 1.80, t) * 0.8 + 0.2, pulsePhase + 0.3, 'top');
    drawHubPin(g, hubs.sfo, smooth(3.65, 4.00, t) * 0.8 + 0.2, pulsePhase + 0.6, 'right');

    // Leading aircraft chevron
    if (p1 > 0.01 && p1 < 0.995 && head1) {
      drawAircraftChevron(g, head1.x, head1.y, head1.dx, head1.dy, '#38BDF8');
    } else if (p2 > 0.01 && p2 < 0.995 && head2) {
      drawAircraftChevron(g, head2.x, head2.y, head2.dx, head2.dy, '#2DD4BF');
    }

    // Top-left Cartographic Header + Bottom-right Live Flight Telemetry Card
    fillRRect(g, 52, 42, 436, 74, 14, 'rgba(9, 17, 30, 0.88)');
    strokeRRect(g, 52, 42, 436, 74, 14, 'rgba(56, 189, 248, 0.28)', 1);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.font = `700 11px ${MONO}`;
    g.fillStyle = '#38BDF8';
    g.fillText('TRANS-PACIFIC LOGISTICS CORRIDOR', 74, 64);
    g.font = `800 22px ${SANS}`;
    g.fillStyle = '#F8FAFC';
    g.fillText('HKG  ▸  TYO  ▸  SFO', 74, 93);

    // Distance & Flight Telemetry Badge
    const kmCovered = Math.round(leg1.km * p1 + leg2.km * p2);
    const tx = W - 384, ty = 548, tw = 332, th = 104;
    fillRRect(g, tx, ty, tw, th, 14, 'rgba(9, 17, 30, 0.92)');
    strokeRRect(g, tx, ty, tw, th, 14, 'rgba(45, 212, 191, 0.42)', 1.2);

    g.font = `700 10.5px ${MONO}`;
    g.fillStyle = '#2DD4BF';
    g.fillText('GREAT-CIRCLE TELEMETRY · LIVE', tx + 20, ty + 24);

    g.font = `800 28px ${MONO}`;
    g.fillStyle = '#F8FAFC';
    g.fillText(`${kmCovered.toLocaleString('en-US')} KM`, tx + 20, ty + 58);

    g.font = `600 11.5px ${MONO}`;
    g.fillStyle = '#94A3B8';
    const statusStr = p2 >= 0.99 ? 'ARRIVED SFO · 11,240 KM' : p1 >= 0.99 ? 'LEG 02 · MACH 0.85 · FL390' : 'LEG 01 · MACH 0.84 · FL370';
    g.fillText(statusStr, tx + 20, ty + 84);

    g.restore();
  }

  return { canvas, ready: ensureFonts(), frame };
}

// ============================================================================
// 4. data-timeline (variant, period: 6.0, hero: 3.4)
// ============================================================================
function buildDataTimeline(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const { canvas, g } = makeSurface(width, height);
  const PERIOD = 6.0;

  const milestones = [
    { year: '2022', tag: 'PHASE 01', title: 'Deterministic Core', kpi: '60 FPS Lock', desc: 'Pure frame(t) clock replaces stateful tween queues.', x: 240, side: -1, at: 0.30, accent: '#2563EB' },
    { year: '2023', tag: 'PHASE 02', title: 'Shader & Vector Kit', kpi: '14 Shaders', desc: 'Unified Canvas 2D, SVG and WebGL surface pipeline.', x: 600, side: 1, at: 1.05, accent: '#0891B2' },
    { year: '2024', tag: 'PHASE 03', title: 'Edge Render Mesh', kpi: '3.2x Faster', desc: 'Parallel chunk encoding with verified audio sync.', x: 960, side: -1, at: 1.85, accent: '#4F46E5' },
    { year: '2025', tag: 'PHASE 04', title: 'Rigged & CAD Packs', kpi: '0.0 ms Lag', desc: '3D-projected callouts and articulated joint rigs.', x: 1320, side: 1, at: 2.55, accent: '#EA580C' },
    { year: '2026', tag: 'PHASE 05 · GA', title: 'Autonomous Studio', kpi: '99.98% Pass', desc: 'Full-catalogue authoring with verified gates.', x: 1680, side: -1, at: 3.15, accent: '#059669' },
  ];

  function frame(time) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);

    // Warm architectural editorial background
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#F7F5EF');
    bg.addColorStop(1, '#ECE8DD');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // Subtle millimeter tick rules
    g.strokeStyle = 'rgba(20, 22, 29, 0.05)';
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 64) {
      g.beginPath();
      g.moveTo(x, 96);
      g.lineTo(x, H - 64);
      g.stroke();
    }

    const fadeOut = 1 - smooth(5.45, 5.90, t);
    g.globalAlpha = fadeOut;

    // Header (fixed in viewport)
    g.font = `700 12px ${MONO}`;
    g.fillStyle = '#2563EB';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('ARCHITECTURE ROADMAP // CAUSAL MILESTONE SPINE', 72, 54);
    g.font = `800 28px ${SANS}`;
    g.fillStyle = '#111827';
    g.fillText('2022 — 2026 Evolution', 72, 86);

    // Smooth camera pan tracking causal spine head across world X (240..1680)
    // At hero=3.4s, camX settles around 660 so 2023, 2024, 2025, and 2026 frame cleanly!
    const panProgress = inOutCubic(lin(0.55, 3.55, t));
    const camX = lerp(0, 660, panProgress);
    const spineY = 382;

    const headWorldX = lerp(180, 1740, inOutCubic(lin(0.15, 3.45, t)));

    g.save();
    g.translate(-camX, 0);

    // Unlit full spine track
    g.beginPath();
    g.moveTo(140, spineY);
    g.lineTo(1820, spineY);
    g.strokeStyle = '#D6D1C4';
    g.lineWidth = 4;
    g.stroke();

    // Minor year-quarter ticks along spine
    for (let tx = 240; tx <= 1680; tx += 90) {
      g.beginPath();
      g.moveTo(tx, spineY - 7);
      g.lineTo(tx, spineY + 7);
      g.strokeStyle = '#C2BCB0';
      g.lineWidth = 1.5;
      g.stroke();
    }

    // Illuminated progressing causal spine
    const spineGrad = g.createLinearGradient(180, spineY, headWorldX, spineY);
    spineGrad.addColorStop(0, '#2563EB');
    spineGrad.addColorStop(0.65, '#4F46E5');
    spineGrad.addColorStop(1, '#059669');
    g.beginPath();
    g.moveTo(180, spineY);
    g.lineTo(headWorldX, spineY);
    g.strokeStyle = spineGrad;
    g.lineWidth = 5.5;
    g.lineCap = 'round';
    g.stroke();

    // Glowing leading playhead orb on spine
    const headGlow = g.createRadialGradient(headWorldX, spineY, 2, headWorldX, spineY, 24);
    headGlow.addColorStop(0, 'rgba(5, 150, 105, 0.85)');
    headGlow.addColorStop(1, 'rgba(5, 150, 105, 0)');
    g.fillStyle = headGlow;
    g.beginPath();
    g.arc(headWorldX, spineY, 24, 0, TAU);
    g.fill();

    // Render dated milestone nodes + cards sequentially as spine arrives
    milestones.forEach((m) => {
      const pop = clamp(springValue(t - m.at, 0.66, 20), 0, 1.12);
      const reached = pop > 0.01;

      // Base node ring (dim before arrival, crisp & colored after)
      g.beginPath();
      g.arc(m.x, spineY, reached ? 11 * clamp(pop, 0.5, 1.1) : 7, 0, TAU);
      g.fillStyle = reached ? '#FFFFFF' : '#E5E0D5';
      g.fill();
      g.lineWidth = reached ? 4 : 2;
      g.strokeStyle = reached ? m.accent : '#A8A29E';
      g.stroke();

      if (!reached) {
        g.font = `700 13px ${MONO}`;
        g.fillStyle = '#78716C';
        g.textAlign = 'center';
        g.fillText(m.year, m.x, spineY + (m.side < 0 ? 28 : -26));
        return;
      }

      // Vertical connector stem + Milestone Card
      const stemLen = 64 * clamp(pop, 0, 1);
      const stemEndY = spineY + m.side * stemLen;
      g.beginPath();
      g.moveTo(m.x, spineY + m.side * 12);
      g.lineTo(m.x, stemEndY);
      g.strokeStyle = m.accent;
      g.lineWidth = 2.2;
      g.stroke();

      const cw = 286, ch = 152;
      const cx = m.x - cw / 2;
      const cy = m.side < 0 ? stemEndY - ch : stemEndY;

      g.save();
      const cardMidY = cy + ch / 2;
      g.translate(m.x, cardMidY);
      const sc = 0.82 + 0.18 * pop;
      g.scale(sc, sc);
      g.translate(-m.x, -cardMidY);
      g.globalAlpha *= clamp(pop * 1.25);

      g.save();
      g.shadowColor = 'rgba(17, 24, 39, 0.11)';
      g.shadowBlur = 24;
      g.shadowOffsetY = 10;
      fillRRect(g, cx, cy, cw, ch, 16, '#FFFFFF');
      g.restore();
      strokeRRect(g, cx, cy, cw, ch, 16, 'rgba(17, 24, 39, 0.10)', 1.2);

      // Year badge + KPI pill
      fillRRect(g, cx + 18, cy + 16, 68, 26, 8, m.accent);
      g.font = `800 13px ${MONO}`;
      g.fillStyle = '#FFFFFF';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(m.year, cx + 52, cy + 29.5);

      fillRRect(g, cx + cw - 122, cy + 16, 104, 26, 13, '#F3F4F6');
      g.font = `700 11px ${MONO}`;
      g.fillStyle = m.accent;
      g.fillText(m.kpi, cx + cw - 70, cy + 29.5);

      g.textAlign = 'left';
      g.font = `800 19px ${SANS}`;
      g.fillStyle = '#111827';
      g.fillText(m.title, cx + 18, cy + 68);

      g.font = `500 13.5px ${SANS}`;
      g.fillStyle = '#4B5563';
      // Two-line wrap for description
      const words = m.desc.split(' ');
      let line1 = '', line2 = '';
      for (const w of words) {
        if ((line1 + ' ' + w).trim().length <= 30) line1 = (line1 + ' ' + w).trim();
        else line2 = (line2 + ' ' + w).trim();
      }
      g.fillText(line1, cx + 18, cy + 98);
      if (line2) g.fillText(line2, cx + 18, cy + 118);

      g.restore();
    });

    g.restore(); // end world camera transform

    // Bottom progress rail indicator
    g.font = `600 11px ${MONO}`;
    g.fillStyle = '#57534E';
    g.textAlign = 'left';
    g.fillText('CAMERA TRACKING // SMOOTH CAUSAL PAN', 72, H - 34);
    g.textAlign = 'right';
    g.fillText(`VIEWPORT X+${Math.round(camX)} PX`, W - 72, H - 34);

    g.restore();
  }

  return { canvas, ready: ensureFonts(), frame };
}

export const studies = [
  {
    id: 'data-node-flow',
    name: 'Directed architecture node flow',
    kind: 'ui',
    grade: 'A',
    stacks: ['canvas'],
    period: 6.0,
    hero: 2.8,
    aspect: '16 / 9',
    chips: ['cubic Bézier ports', 'comet data packets', 'node arrival pulses'],
    purpose: 'A four-stage inference architecture graph routes glowing comet packets along cubic Bézier ports, firing node activation pulses and live tabular throughput counters.',
  },
  {
    id: 'data-donut',
    name: 'Exploded categorical donut chart',
    kind: 'ui',
    grade: 'A',
    stacks: ['canvas'],
    period: 5.4,
    hero: 2.7,
    aspect: '16 / 9',
    chips: ['staggered spring arcs', 'radial slice explode', 'tabular-nums legend'],
    purpose: 'Five categorical budget segments sweep open on staggered springs before the hero slice detaches radially with 45° leader callouts and a synchronized tabular legend.',
  },
  {
    id: 'data-map-route',
    name: 'Great-circle cartographic route',
    kind: 'ui',
    grade: 'A',
    stacks: ['canvas'],
    period: 5.8,
    hero: 3.1,
    aspect: '16 / 9',
    chips: ['geodesic arc draw', 'radar hub beacons', 'live distance telemetry'],
    purpose: 'Across a stylized Pacific-Rim coastline and graticule map, dashed great-circle arcs connect radar-pulsing HKG, TYO and SFO hubs with live flight telemetry.',
  },
  {
    id: 'data-timeline',
    name: 'Panning causal milestone spine',
    kind: 'ui',
    grade: 'A',
    stacks: ['canvas'],
    period: 6.0,
    hero: 3.4,
    aspect: '16 / 9',
    chips: ['horizontal camera pan', 'sequential spring nodes', '2022–2026 causal spine'],
    purpose: 'A horizontal camera pans along a progressing 2022–2026 causal spine as dated milestone rings and alternating detail cards pop sequentially into place.',
  },
];

export async function create(id, options = {}) {
  const builders = {
    'data-node-flow': buildDataNodeFlow,
    'data-donut': buildDataDonut,
    'data-map-route': buildDataMapRoute,
    'data-timeline': buildDataTimeline,
  };
  const fn = builders[id];
  if (!fn) throw new Error('Unknown diagrams demo: ' + id);
  const inst = fn(options);
  await inst.ready;
  return inst;
}
