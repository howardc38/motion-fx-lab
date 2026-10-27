// Spine-Articulated Boids ASCII Renderer (0BSD).
// Pure deterministic frame(t) simulation & dual-pass slope-aware ASCII shader at 1280x720 (16:9).

const W = 1280;
const H = 720;
const TAU = Math.PI * 2;
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;

function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

function lerpAngle(a, b, k) {
  return a + wrapAngle(b - a) * k;
}

async function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  const sample = 'BESbswy0123456789 ·-=+*%@#/\\|_()<>';
  await Promise.allSettled([
    document.fonts.load(`700 11px ${MONO}`, sample),
    document.fonts.load(`700 14px ${MONO}`, sample),
  ]);
  if (document.fonts.ready) await document.fonts.ready;
}

// Anatomical 20-node reef shark half-width profile (snout -> gill/pectoral -> torso -> peduncle -> tail tip)
const SHARK_NODES = 20;
const SHARK_PROFILE = new Float32Array([
  0.18, 0.45, 0.72, 0.91, 1.00, 0.99, 0.93, 0.84, 0.74, 0.64,
  0.54, 0.44, 0.35, 0.27, 0.21, 0.16, 0.13, 0.12, 0.10, 0.07,
]);

const BAIT_NODES = 7;
const BAIT_PROFILE = new Float32Array([0.35, 0.85, 1.00, 0.86, 0.62, 0.36, 0.18]);

// Pre-warmed, loop-closed Couzin boids + 20-node spine trajectory cache
let cachedSim = null;

function buildSimulationTable() {
  if (cachedSim) return cachedSim;

  const rand = mulberry32(808713);
  const PERIOD = 8.0;
  const FPS = 60;
  const DT = 1 / FPS;
  const WARMUP = 210;
  const FRAMES = Math.round(PERIOD * FPS); // 480 frames
  const BLEND_FRAMES = 84; // smooth 1.4s periodic loop closure
  const TOTAL_STEPS = WARMUP + FRAMES + BLEND_FRAMES;

  const NUM_SHARKS = 6;
  const NUM_BAIT = 40;

  // Initialize 6 sleek Reef Sharks at distinct depth layers
  const sharks = Array.from({ length: NUM_SHARKS }, (_, i) => {
    const isHero = i === 0;
    const scale = isHero ? 1.28 : 0.76 + rand() * 0.34;
    const segLen = 13.5 * scale;
    const baseRadius = 21.0 * scale;
    const x0 = isHero ? 260 : 180 + rand() * (W - 360);
    const y0 = isHero ? 420 : 140 + rand() * (H - 280);
    const heading = isHero ? -0.18 : (rand() - 0.5) * TAU;
    const sx = new Float32Array(SHARK_NODES);
    const sy = new Float32Array(SHARK_NODES);
    const stheta = new Float32Array(SHARK_NODES);
    for (let k = 0; k < SHARK_NODES; k++) {
      sx[k] = x0 - Math.cos(heading) * k * segLen;
      sy[k] = y0 - Math.sin(heading) * k * segLen;
      stheta[k] = heading;
    }
    return {
      isHero,
      scale,
      segLen,
      baseRadius,
      depth: isHero ? 0.96 : 0.35 + (i / NUM_SHARKS) * 0.55,
      speed: isHero ? 158 : 118 + rand() * 38,
      tailFreq: isHero ? TAU * 1.25 : TAU * (1.25 + (i % 2) * 0.25), // integer-ish wave harmonics
      tailPhase: rand() * TAU,
      sx,
      sy,
      stheta,
      turnRate: 0,
      orbitPhase: ((i + 0.38) / NUM_SHARKS) * TAU,
    };
  });

  // Initialize 40 schooling Baitfish driven by Couzin repulsion/orientation/attraction zones
  const baits = Array.from({ length: NUM_BAIT }, (_, i) => {
    const clusterAngle = (i / NUM_BAIT) * TAU;
    const x0 = W * 0.56 + Math.cos(clusterAngle) * (80 + rand() * 160);
    const y0 = H * 0.46 + Math.sin(clusterAngle) * (50 + rand() * 110);
    const heading = clusterAngle + Math.PI * 0.5;
    const segLen = 4.6;
    const sx = new Float32Array(BAIT_NODES);
    const sy = new Float32Array(BAIT_NODES);
    for (let k = 0; k < BAIT_NODES; k++) {
      sx[k] = x0 - Math.cos(heading) * k * segLen;
      sy[k] = y0 - Math.sin(heading) * k * segLen;
    }
    return {
      segLen,
      radius: 3.4 + (i % 3) * 0.65,
      heading,
      speed: 145 + (i % 5) * 11,
      tailPhase: rand() * TAU,
      sx,
      sy,
    };
  });

  // Storage for recorded frames + blend tail
  const REC_LEN = FRAMES + BLEND_FRAMES;
  const sharkRec = new Float32Array(REC_LEN * NUM_SHARKS * SHARK_NODES * 3); // x, y, theta
  const baitRec = new Float32Array(REC_LEN * NUM_BAIT * BAIT_NODES * 2);     // x, y

  function stepSpineChain(sx, sy, stheta, count, segLen, simTime, tailFreq, tailPhase, waveAmp, maxBend) {
    for (let k = 1; k < count; k++) {
      const dx = sx[k - 1] - sx[k];
      const dy = sy[k - 1] - sy[k];
      let targetTheta = Math.atan2(dy, dx);

      // Travelling sinusoidal caudal propulsion wave increasing quadratically toward tail!
      const frac = k / (count - 1);
      const caudalWave = waveAmp * Math.pow(frac, 1.75) * Math.sin(tailFreq * simTime - k * 0.44 + tailPhase);
      targetTheta += caudalWave;

      // Biomechanical joint bend constraint relative to parent vertebra
      if (stheta) {
        const diff = clamp(wrapAngle(targetTheta - stheta[k - 1]), -maxBend, maxBend);
        targetTheta = stheta[k - 1] + diff;
        stheta[k] = targetTheta;
      }

      sx[k] = sx[k - 1] - Math.cos(targetTheta) * segLen;
      sy[k] = sy[k - 1] - Math.sin(targetTheta) * segLen;
    }
  }

  for (let step = 0; step < TOTAL_STEPS; step++) {
    const simTime = step * DT;
    const recTime = (step - WARMUP) * DT;

    // 1. Update Reef Sharks (Couzin inter-shark spacing + reef current patrol)
    for (let i = 0; i < NUM_SHARKS; i++) {
      const s = sharks[i];
      const hx = s.sx[0];
      const hy = s.sy[0];

      // Elliptical reef current guide; Hero shark sweeps cleanly through center frame around t = 3.2s!
      let goalX, goalY;
      if (s.isHero) {
        const p = (TAU * (recTime - 2.65)) / PERIOD;
        goalX = W * 0.50 + Math.sin(p) * 395;
        goalY = H * 0.48 - Math.cos(p) * 92;
      } else {
        const p = (TAU * simTime) / PERIOD + s.orbitPhase * 1.15;
        const rx = 430 + (i % 3) * 65;
        const ry = 225 + (i % 2) * 52;
        goalX = W * 0.5 + Math.cos(p) * rx;
        goalY = H * 0.5 + Math.sin(p * (i % 2 ? 1 : -1)) * ry;
      }

      let fx = (goalX - hx) * (s.isHero ? 1.85 : 1.05);
      let fy = (goalY - hy) * (s.isHero ? 1.85 : 1.05);

      // Couzin Separation + Alignment among sharks
      for (let j = 0; j < NUM_SHARKS; j++) {
        if (i === j) continue;
        const o = sharks[j];
        const dx = hx - o.sx[0];
        const dy = hy - o.sy[0];
        const d = Math.hypot(dx, dy) || 1;
        if (d < 315) {
          const push = ((315 - d) / 315) * 460;
          fx += (dx / d) * push;
          fy += (dy / d) * push;
        } else if (d < 460 && !s.isHero) {
          fx += Math.cos(o.stheta[0]) * 35;
          fy += Math.sin(o.stheta[0]) * 35;
        }
      }

      const desiredHeading = Math.atan2(fy, fx);
      const turnDelta = clamp(wrapAngle(desiredHeading - s.stheta[0]), -2.1 * DT, 2.1 * DT);
      s.stheta[0] = wrapAngle(s.stheta[0] + turnDelta);
      s.sx[0] += Math.cos(s.stheta[0]) * s.speed * DT;
      s.sy[0] += Math.sin(s.stheta[0]) * s.speed * DT;

      stepSpineChain(s.sx, s.sy, s.stheta, SHARK_NODES, s.segLen, simTime, s.tailFreq, s.tailPhase, 0.22, 0.21);
    }

    // 2. Update Baitfish School (Couzin Repulsion / Orientation / Attraction + Shark Evasion!)
    for (let i = 0; i < NUM_BAIT; i++) {
      const b = baits[i];
      const bx = b.sx[0];
      const by = b.sy[0];

      let repX = 0, repY = 0, repN = 0;
      let oriX = 0, oriY = 0, attX = 0, attY = 0, socN = 0;

      for (let j = 0; j < NUM_BAIT; j++) {
        if (i === j) continue;
        const o = baits[j];
        const dx = o.sx[0] - bx;
        const dy = o.sy[0] - by;
        const d2 = dx * dx + dy * dy;
        if (d2 < 26 * 26 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          repX -= dx / d;
          repY -= dy / d;
          repN++;
        } else if (d2 < 155 * 155) {
          const d = Math.sqrt(d2);
          oriX += Math.cos(o.heading);
          oriY += Math.sin(o.heading);
          attX += dx / d;
          attY += dy / d;
          socN++;
        }
      }

      let dirX = Math.cos(b.heading) * 0.5;
      let dirY = Math.sin(b.heading) * 0.5;
      if (repN > 0) {
        dirX += repX * 2.2;
        dirY += repY * 2.2;
      } else if (socN > 0) {
        dirX += (oriX / socN) * 1.15 + (attX / socN) * 0.95;
        dirY += (oriY / socN) * 1.15 + (attY / socN) * 0.95;
      }

      // Gentle school center patrol attractor
      const schoolPhase = (TAU * simTime) / PERIOD;
      const gx = W * 0.52 + Math.cos(schoolPhase + 0.9) * 280;
      const gy = H * 0.48 + Math.sin(schoolPhase * 2 + 0.4) * 130;
      dirX += (gx - bx) * 0.0048;
      dirY += (gy - by) * 0.0048;

      // Acute predator evasion away from nearby shark heads & mid-bodies!
      let burst = 1.0;
      for (let si = 0; si < NUM_SHARKS; si++) {
        const sh = sharks[si];
        for (const nodeIdx of [0, 4, 9]) {
          const dx = bx - sh.sx[nodeIdx];
          const dy = by - sh.sy[nodeIdx];
          const d = Math.hypot(dx, dy) || 1;
          const safeR = 175 * sh.scale;
          if (d < safeR) {
            const panic = Math.pow(1 - d / safeR, 1.5);
            dirX += (dx / d) * panic * 5.8;
            dirY += (dy / d) * panic * 5.8;
            burst = Math.max(burst, 1.0 + panic * 0.85);
          }
        }
      }

      // Soft screen boundary containment
      const margin = 95;
      if (bx < margin) dirX += (margin - bx) * 0.04;
      if (bx > W - margin) dirX -= (bx - (W - margin)) * 0.04;
      if (by < margin) dirY += (margin - by) * 0.04;
      if (by > H - margin) dirY -= (by - (H - margin)) * 0.04;

      const targetH = Math.atan2(dirY, dirX);
      b.heading = wrapAngle(b.heading + clamp(wrapAngle(targetH - b.heading), -5.8 * DT, 5.8 * DT));
      b.sx[0] += Math.cos(b.heading) * b.speed * burst * DT;
      b.sy[0] += Math.sin(b.heading) * b.speed * burst * DT;

      stepSpineChain(b.sx, b.sy, null, BAIT_NODES, b.segLen, simTime, TAU * 3.5, b.tailPhase, 0.28, 0.45);
    }

    // Record post-warmup frames
    if (step >= WARMUP) {
      const rIdx = step - WARMUP;
      for (let i = 0; i < NUM_SHARKS; i++) {
        const s = sharks[i];
        const base = (rIdx * NUM_SHARKS + i) * SHARK_NODES * 3;
        for (let k = 0; k < SHARK_NODES; k++) {
          sharkRec[base + k * 3] = s.sx[k];
          sharkRec[base + k * 3 + 1] = s.sy[k];
          sharkRec[base + k * 3 + 2] = s.stheta[k];
        }
      }
      for (let i = 0; i < NUM_BAIT; i++) {
        const b = baits[i];
        const base = (rIdx * NUM_BAIT + i) * BAIT_NODES * 2;
        for (let k = 0; k < BAIT_NODES; k++) {
          baitRec[base + k * 2] = b.sx[k];
          baitRec[base + k * 2 + 1] = b.sy[k];
        }
      }
    }
  }

  // Smooth Hermite loop closure over the final BLEND_FRAMES into frame 0..BLEND_FRAMES
  // while re-enforcing exact spine segment lengths so bodies never stretch!
  const finalSharks = new Float32Array(FRAMES * NUM_SHARKS * SHARK_NODES * 3);
  const finalBaits = new Float32Array(FRAMES * NUM_BAIT * BAIT_NODES * 2);

  // Shift by BLEND_FRAMES so frames [0..FRAMES-1] use [BLEND_FRAMES .. FRAMES+BLEND_FRAMES-1]
  // with the seam blended smoothly over the tail!
  for (let f = 0; f < FRAMES; f++) {
    const srcA = f + BLEND_FRAMES;
    const blendZone = f >= FRAMES - BLEND_FRAMES;
    const rawU = blendZone ? (f - (FRAMES - BLEND_FRAMES)) / BLEND_FRAMES : 0;
    const u = rawU * rawU * (3 - 2 * rawU);
    const srcB = f - (FRAMES - BLEND_FRAMES);

    for (let i = 0; i < NUM_SHARKS; i++) {
      const s = sharks[i];
      const outBase = (f * NUM_SHARKS + i) * SHARK_NODES * 3;
      const baseA = (srcA * NUM_SHARKS + i) * SHARK_NODES * 3;
      if (!blendZone) {
        for (let k = 0; k < SHARK_NODES * 3; k++) finalSharks[outBase + k] = sharkRec[baseA + k];
      } else {
        const baseB = (srcB * NUM_SHARKS + i) * SHARK_NODES * 3;
        finalSharks[outBase] = lerp(sharkRec[baseA], sharkRec[baseB], u);
        finalSharks[outBase + 1] = lerp(sharkRec[baseA + 1], sharkRec[baseB + 1], u);
        finalSharks[outBase + 2] = lerpAngle(sharkRec[baseA + 2], sharkRec[baseB + 2], u);
        for (let k = 1; k < SHARK_NODES; k++) {
          const mx = lerp(sharkRec[baseA + k * 3], sharkRec[baseB + k * 3], u);
          const my = lerp(sharkRec[baseA + k * 3 + 1], sharkRec[baseB + k * 3 + 1], u);
          const px = finalSharks[outBase + (k - 1) * 3];
          const py = finalSharks[outBase + (k - 1) * 3 + 1];
          const ang = Math.atan2(py - my, px - mx);
          finalSharks[outBase + k * 3] = px - Math.cos(ang) * s.segLen;
          finalSharks[outBase + k * 3 + 1] = py - Math.sin(ang) * s.segLen;
          finalSharks[outBase + k * 3 + 2] = ang;
        }
      }
    }

    for (let i = 0; i < NUM_BAIT; i++) {
      const b = baits[i];
      const outBase = (f * NUM_BAIT + i) * BAIT_NODES * 2;
      const baseA = (srcA * NUM_BAIT + i) * BAIT_NODES * 2;
      if (!blendZone) {
        for (let k = 0; k < BAIT_NODES * 2; k++) finalBaits[outBase + k] = baitRec[baseA + k];
      } else {
        const baseB = (srcB * NUM_BAIT + i) * BAIT_NODES * 2;
        finalBaits[outBase] = lerp(baitRec[baseA], baitRec[baseB], u);
        finalBaits[outBase + 1] = lerp(baitRec[baseA + 1], baitRec[baseB + 1], u);
        for (let k = 1; k < BAIT_NODES; k++) {
          const mx = lerp(baitRec[baseA + k * 2], baitRec[baseB + k * 2], u);
          const my = lerp(baitRec[baseA + k * 2 + 1], baitRec[baseB + k * 2 + 1], u);
          const px = finalBaits[outBase + (k - 1) * 2];
          const py = finalBaits[outBase + (k - 1) * 2 + 1];
          const ang = Math.atan2(py - my, px - mx);
          finalBaits[outBase + k * 2] = px - Math.cos(ang) * b.segLen;
          finalBaits[outBase + k * 2 + 1] = py - Math.sin(ang) * b.segLen;
        }
      }
    }
  }

  cachedSim = { PERIOD, FRAMES, NUM_SHARKS, NUM_BAIT, sharks, baits, finalSharks, finalBaits };
  return cachedSim;
}

// ============================================================================
// Dual-Pass Slope-Aware ASCII Shader
// ============================================================================
function buildAsciiSpineBoids(options = {}) {
  const width = options.width || W;
  const height = options.height || H;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  const sim = buildSimulationTable();
  const { PERIOD, FRAMES, NUM_SHARKS, NUM_BAIT, sharks, baits, finalSharks, finalBaits } = sim;

  // Monospace character grid: 142 cols x 48 rows (cell = 9.014 x 15 px at 1280x720)
  const COLS = 142;
  const ROWS = 48;
  const CELL_W = W / COLS;
  const CELL_H = H / ROWS;

  // 2x2 supersampled sub-cell raster buffer (284 x 96)
  const SW = COLS * 2;
  const SH = ROWS * 2;
  const subType = new Uint8Array(SW * SH);   // 0 = abyss, 1 = baitfish, 2 = shark
  const subLum = new Float32Array(SW * SH);  // 0..1 shaded body luminance
  const subDepth = new Float32Array(SW * SH);

  const VOLUME_RAMP = '-=+*%@#';

  // Color palette buckets to batch fillStyle changes efficiently
  const SHARK_PALETTE = [
    '#0E7490', // 0: deep abyssal belly shadow
    '#0891B2', // 1: lower flank
    '#06B6D4', // 2: mid cyan musculature
    '#22D3EE', // 3: bright cyan lateral ridge
    '#34D399', // 4: bioluminescent emerald dorsal
    '#6EE7B7', // 5: sunlit seafoam crest
    '#ECFEFF', // 6: razor-sharp specular highlight & edge contour
  ];

  // Rasterize a lit tapered 3D capsule segment into the 2x2 sub-cell buffer
  function rasterCapsule(x0, y0, r0, x1, y1, r1, depth, kind, causticPhase) {
    const maxR = Math.max(r0, r1) + 1.5;
    const minSX = Math.max(0, Math.floor(((Math.min(x0, x1) - maxR) / W) * SW));
    const maxSX = Math.min(SW - 1, Math.ceil(((Math.max(x0, x1) + maxR) / W) * SW));
    const minSY = Math.max(0, Math.floor(((Math.min(y0, y1) - maxR) / H) * SH));
    const maxSY = Math.min(SH - 1, Math.ceil(((Math.max(y0, y1) + maxR) / H) * SH));

    const vx = x1 - x0;
    const vy = y1 - y0;
    const len2 = vx * vx + vy * vy || 1e-4;

    for (let sy = minSY; sy <= maxSY; sy++) {
      const py = ((sy + 0.5) / SH) * H;
      for (let sx = minSX; sx <= maxSX; sx++) {
        const idx = sy * SW + sx;
        if (subDepth[idx] > depth) continue;

        const px = ((sx + 0.5) / SW) * W;
        const u = clamp(((px - x0) * vx + (py - y0) * vy) / len2, 0, 1);
        const cx = x0 + vx * u;
        const cy = y0 + vy * u;
        const rad = r0 + (r1 - r0) * u;
        if (rad <= 0.4) continue;

        const dx = px - cx;
        const dy = py - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > rad * rad) continue;

        // 3D cylindrical normal for overhead sunlight + bioluminescent rim shading
        const invR = 1 / rad;
        const nx = dx * invR;
        const ny = dy * invR;
        const nz = Math.sqrt(Math.max(0.02, 1 - nx * nx - ny * ny));

        // Overhead underwater sun direction (-0.25, -0.82, 0.52)
        const sun = Math.max(0, -0.25 * nx - 0.82 * ny + 0.52 * nz);
        const rim = Math.pow(1 - nz, 1.8) * 0.42;
        const caustic = 0.14 * Math.max(0, Math.sin(px * 0.045 + py * 0.025 + causticPhase) * Math.cos(px * 0.028 - causticPhase * 1.3));
        const depthBoost = 0.58 + 0.42 * depth;

        subType[idx] = kind;
        subDepth[idx] = depth;
        subLum[idx] = clamp((0.14 + 0.72 * sun + rim + caustic) * depthBoost, 0.06, 1.0);
      }
    }
  }

  // Select razor-sharp slope-aware edge character from 2x2 sub-cell bitmask & local gradient
  function selectSlopeEdgeChar(mask, gx, gy) {
    // Bitmask: 1=TL, 2=TR, 4=BL, 8=BR
    switch (mask) {
      case 1: return "'";
      case 2: return "'";
      case 4: return ',';
      case 8: return '.';
      case 3: return '-';  // Top half occupied -> crisp upper belly/tail underside
      case 12: return '_'; // Bottom half occupied -> crisp dorsal entry edge
      case 5: return '|';  // Left half occupied
      case 10: return '|'; // Right half occupied
      case 6: return '/';  // TR + BL diagonal
      case 9: return '\\'; // TL + BR diagonal
      default: break;
    }
    // 3-of-4 occupied boundary cells (7, 11, 13, 14) or silhouette perimeter: use local slope tangent!
    const ax = Math.abs(gx);
    const ay = Math.abs(gy);
    if (ay > ax * 2.1) return gy > 0 ? '_' : '-';
    if (ax > ay * 2.1) return gx > 0 ? '(' : ')';
    // Diagonal slope sign: if gx and gy have same sign, contour runs '/' else '\'
    if (mask === 7 || mask === 14) return gx * gy >= 0 ? '/' : '\\';
    if (ax > ay * 1.25) return gx > 0 ? '<' : '>';
    return gx * gy >= 0 ? '/' : '\\';
  }

  const interpX = new Float32Array(SHARK_NODES);
  const interpY = new Float32Array(SHARK_NODES);
  const interpT = new Float32Array(SHARK_NODES);

  // Sort sharks back-to-front by depth once
  const sharkOrder = Array.from({ length: NUM_SHARKS }, (_, i) => i).sort((a, b) => sharks[a].depth - sharks[b].depth);

  function frame(time, opts = {}) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    const fExact = (t / PERIOD) * FRAMES;
    const f0 = Math.floor(fExact) % FRAMES;
    const f1 = (f0 + 1) % FRAMES;
    const frac = fExact - Math.floor(fExact);
    const causticPhase = (TAU * t) / PERIOD * 2;

    // Clear 2x2 supersampled raster buffers
    subType.fill(0);
    subLum.fill(0);
    subDepth.fill(0);

    // 1. Pass 1A: Rasterize Baitfish School (depth = 0.25)
    for (let bi = 0; bi < NUM_BAIT; bi++) {
      const b = baits[bi];
      const b0 = (f0 * NUM_BAIT + bi) * BAIT_NODES * 2;
      const b1 = (f1 * NUM_BAIT + bi) * BAIT_NODES * 2;
      let px = lerp(finalBaits[b0], finalBaits[b1], frac);
      let py = lerp(finalBaits[b0 + 1], finalBaits[b1 + 1], frac);
      for (let k = 1; k < BAIT_NODES; k++) {
        const nx = lerp(finalBaits[b0 + k * 2], finalBaits[b1 + k * 2], frac);
        const ny = lerp(finalBaits[b0 + k * 2 + 1], finalBaits[b1 + k * 2 + 1], frac);
        rasterCapsule(
          px, py, b.radius * BAIT_PROFILE[k - 1],
          nx, ny, b.radius * BAIT_PROFILE[k],
          0.25, 1, causticPhase
        );
        px = nx;
        py = ny;
      }
    }

    // 2. Pass 1B: Rasterize 20-Node Reef Sharks + Pectoral, Dorsal & Caudal Fins
    for (const si of sharkOrder) {
      const s = sharks[si];
      const s0 = (f0 * NUM_SHARKS + si) * SHARK_NODES * 3;
      const s1 = (f1 * NUM_SHARKS + si) * SHARK_NODES * 3;

      for (let k = 0; k < SHARK_NODES; k++) {
        interpX[k] = lerp(finalSharks[s0 + k * 3], finalSharks[s1 + k * 3], frac);
        interpY[k] = lerp(finalSharks[s0 + k * 3 + 1], finalSharks[s1 + k * 3 + 1], frac);
        interpT[k] = lerpAngle(finalSharks[s0 + k * 3 + 2], finalSharks[s1 + k * 3 + 2], frac);
      }

      // Swept Pectoral Fins anchored at spine node 4
      const pecX = interpX[4];
      const pecY = interpY[4];
      const pecHeading = interpT[4];
      const pecLen = 58 * s.scale;
      for (const side of [-1, 1]) {
        const finAng = pecHeading + side * 2.08;
        const midX = pecX + Math.cos(finAng) * pecLen * 0.55;
        const midY = pecY + Math.sin(finAng) * pecLen * 0.55;
        const tipAng = finAng + side * 0.28;
        const tipX = midX + Math.cos(tipAng) * pecLen * 0.52;
        const tipY = midY + Math.sin(tipAng) * pecLen * 0.52;
        rasterCapsule(pecX, pecY, 11.5 * s.scale, midX, midY, 6.8 * s.scale, s.depth - 0.02, 2, causticPhase);
        rasterCapsule(midX, midY, 6.8 * s.scale, tipX, tipY, 1.8 * s.scale, s.depth - 0.02, 2, causticPhase);
      }

      // Pelvic fins at node 11
      const pelX = interpX[11];
      const pelY = interpY[11];
      const pelH = interpT[11];
      for (const side of [-1, 1]) {
        const fa = pelH + side * 2.25;
        rasterCapsule(
          pelX, pelY, 5.5 * s.scale,
          pelX + Math.cos(fa) * 22 * s.scale, pelY + Math.sin(fa) * 22 * s.scale, 1.5 * s.scale,
          s.depth - 0.02, 2, causticPhase
        );
      }

      // 20-Node Articulated Torso Capsules
      for (let k = 0; k < SHARK_NODES - 1; k++) {
        rasterCapsule(
          interpX[k], interpY[k], s.baseRadius * SHARK_PROFILE[k],
          interpX[k + 1], interpY[k + 1], s.baseRadius * SHARK_PROFILE[k + 1],
          s.depth, 2, causticPhase
        );
      }

      // Iconic Dorsal Fin projecting upward/sideways from spine nodes 6..8
      const dorBaseX = interpX[6], dorBaseY = interpY[6];
      const dorAng = interpT[6] - Math.PI * 0.5 * (Math.cos(interpT[6]) >= 0 ? 1 : -1) * 0.85 - 0.35;
      const dorTipX = interpX[8] + Math.cos(dorAng) * 34 * s.scale;
      const dorTipY = interpY[8] + Math.sin(dorAng) * 34 * s.scale;
      rasterCapsule(dorBaseX, dorBaseY, 9.5 * s.scale, dorTipX, dorTipY, 2.2 * s.scale, s.depth + 0.01, 2, causticPhase);

      // Sweeping Crescent Heterocercal Caudal Tail Lobes at spine node 18..19
      const tailX = interpX[18], tailY = interpY[18];
      const tailAng = interpT[18] + Math.PI; // points backward from tail
      const upperLobeLen = 48 * s.scale;
      const lowerLobeLen = 34 * s.scale;
      rasterCapsule(
        tailX, tailY, 6.2 * s.scale,
        tailX + Math.cos(tailAng - 0.58) * upperLobeLen,
        tailY + Math.sin(tailAng - 0.58) * upperLobeLen,
        1.6 * s.scale, s.depth, 2, causticPhase
      );
      rasterCapsule(
        tailX, tailY, 5.2 * s.scale,
        tailX + Math.cos(tailAng + 0.64) * lowerLobeLen,
        tailY + Math.sin(tailAng + 0.64) * lowerLobeLen,
        1.5 * s.scale, s.depth, 2, causticPhase
      );
    }

    // 3. Pass 2: Slope-Aware ASCII Glyph & Bioluminescent Color Rasterization
    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);

    // Crisp terminal abyssal black with subtle deep-water vertical tone
    const abyss = g.createLinearGradient(0, 0, 0, H);
    abyss.addColorStop(0, '#040B13');
    abyss.addColorStop(0.55, '#02060B');
    abyss.addColorStop(1, '#010306');
    g.fillStyle = abyss;
    g.fillRect(0, 0, W, H);

    g.font = `700 13.5px ${MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';

    // Batch glyphs by fillStyle so Canvas 2D draws all 6,800 cells in < 2ms!
    const batches = new Map();
    const pushGlyph = (color, ch, px, py) => {
      let arr = batches.get(color);
      if (!arr) {
        arr = [];
        batches.set(color, arr);
      }
      arr.push(ch, px, py);
    };

    for (let cy = 0; cy < ROWS; cy++) {
      const sy0 = cy * 2;
      const sy1 = sy0 + 1;
      const drawY = (cy + 0.52) * CELL_H;

      for (let cx = 0; cx < COLS; cx++) {
        const sx0 = cx * 2;
        const sx1 = sx0 + 1;
        const drawX = (cx + 0.5) * CELL_W;

        const iTL = sy0 * SW + sx0;
        const iTR = sy0 * SW + sx1;
        const iBL = sy1 * SW + sx0;
        const iBR = sy1 * SW + sx1;

        const tTL = subType[iTL], tTR = subType[iTR], tBL = subType[iBL], tBR = subType[iBR];
        const mask = (tTL ? 1 : 0) | (tTR ? 2 : 0) | (tBL ? 4 : 0) | (tBR ? 8 : 0);

        if (mask === 0) {
          // Sparse abyssal caustic rays & drifting plankton motes
          const diagWave = Math.sin(cx * 0.14 - cy * 0.09 + causticPhase * 0.5) * Math.cos(cx * 0.07 + cy * 0.11 - causticPhase * 0.5);
          if (diagWave > 0.84 && (cx + cy * 3) % 4 === 0) {
            pushGlyph('#0B2E3D', diagWave > 0.92 ? ':' : '.', drawX, drawY);
          } else if (((cx * 73 + cy * 137) % 197) === 0) {
            pushGlyph('#134E5E', "'", drawX, drawY);
          }
          continue;
        }

        const isShark = tTL === 2 || tTR === 2 || tBL === 2 || tBR === 2;
        let lumSum = 0, occCount = 0;
        if (tTL) { lumSum += subLum[iTL]; occCount++; }
        if (tTR) { lumSum += subLum[iTR]; occCount++; }
        if (tBL) { lumSum += subLum[iBL]; occCount++; }
        if (tBR) { lumSum += subLum[iBR]; occCount++; }
        const avgLum = lumSum / occCount;

        // Check if cell lies on silhouette boundary via 2x2 mask or 4-connected neighbor check
        let isEdge = mask !== 15;
        if (!isEdge && cx > 0 && cx < COLS - 1 && cy > 0 && cy < ROWS - 1) {
          const nUp = subType[(sy0 - 1) * SW + sx0] && subType[(sy0 - 1) * SW + sx1];
          const nDn = subType[(sy1 + 1) * SW + sx0] && subType[(sy1 + 1) * SW + sx1];
          const nLt = subType[sy0 * SW + (sx0 - 1)] && subType[sy1 * SW + (sx0 - 1)];
          const nRt = subType[sy0 * SW + (sx1 + 1)] && subType[sy1 * SW + (sx1 + 1)];
          if (!nUp || !nDn || !nLt || !nRt) isEdge = true;
        }

        let glyph;
        if (isEdge) {
          // Compute local sub-cell occupancy gradient (gx, gy) across 4x4 window for exact slope!
          let gx = (tTR ? 1 : 0) + (tBR ? 1 : 0) - (tTL ? 1 : 0) - (tBL ? 1 : 0);
          let gy = (tBL ? 1 : 0) + (tBR ? 1 : 0) - (tTL ? 1 : 0) - (tTR ? 1 : 0);
          if (sx0 > 0 && sx1 < SW - 1 && sy0 > 0 && sy1 < SH - 1) {
            gx += 0.65 * ((subType[sy0 * SW + sx1 + 1] ? 1 : 0) + (subType[sy1 * SW + sx1 + 1] ? 1 : 0)
                        - (subType[sy0 * SW + sx0 - 1] ? 1 : 0) - (subType[sy1 * SW + sx0 - 1] ? 1 : 0));
            gy += 0.65 * ((subType[(sy1 + 1) * SW + sx0] ? 1 : 0) + (subType[(sy1 + 1) * SW + sx1] ? 1 : 0)
                        - (subType[(sy0 - 1) * SW + sx0] ? 1 : 0) - (subType[(sy0 - 1) * SW + sx1] ? 1 : 0));
          }
          glyph = selectSlopeEdgeChar(mask, gx, gy);
        } else {
          // Interior shaded body volume ramp: - = + * % @ #
          const rIdx = clamp(Math.floor(avgLum * VOLUME_RAMP.length), 0, VOLUME_RAMP.length - 1);
          glyph = VOLUME_RAMP[rIdx];
        }

        if (!isShark) {
          // Baitfish bioluminescent mint/seafoam palette
          const bCol = isEdge ? '#99F6E4' : avgLum > 0.62 ? '#CCFBF1' : '#2DD4BF';
          pushGlyph(bCol, glyph, drawX, drawY);
        } else {
          // Reef Shark bioluminescent cyan/emerald/ice-white palette; crisp rim boost on silhouette edges!
          const boosted = isEdge ? clamp(avgLum + 0.24, 0.35, 1.0) : avgLum;
          const pIdx = clamp(Math.floor(boosted * SHARK_PALETTE.length), 0, SHARK_PALETTE.length - 1);
          pushGlyph(SHARK_PALETTE[pIdx], glyph, drawX, drawY);
        }
      }
    }

    for (const [color, items] of batches.entries()) {
      g.fillStyle = color;
      for (let i = 0; i < items.length; i += 3) {
        g.fillText(items[i], items[i + 1], items[i + 2]);
      }
    }

    // Minimalist terminal HUD header/footer (supports opts.labels === false)
    if (opts.labels !== false) {
      g.fillStyle = 'rgba(2, 8, 15, 0.78)';
      g.fillRect(0, 0, W, 32);
      g.fillRect(0, H - 30, W, 30);

      g.font = `700 11px ${MONO}`;
      g.textAlign = 'left';
      g.fillStyle = '#22D3EE';
      g.fillText('ASCII_REEF // 20-NODE SPINE KINEMATICS + COUZIN BOIDS', 24, 16.5);
      g.textAlign = 'right';
      g.fillStyle = '#34D399';
      g.fillText(`GRID ${COLS}x${ROWS} · DUAL-PASS SLOPE SHADER · T+${t.toFixed(2)}S`, W - 24, 16.5);

      g.textAlign = 'left';
      g.fillStyle = '#0891B2';
      g.fillText('VOLUME RAMP [ - = + * % @ # ]   ·   SLOPE EDGES [ / \\ | _ - ( ) < > , . \' ]', 24, H - 14.5);
      g.textAlign = 'right';
      g.fillStyle = '#5EEAD4';
      g.fillText('6 REEF SHARKS · 40 BAITFISH · PURE FRAME(T)', W - 24, H - 14.5);
    }

    g.restore();
  }

  return { canvas, ready: ensureFonts(), frame };
}

export const studies = [
  {
    id: 'ascii-spine-boids',
    name: 'Spine-articulated boids ASCII shader',
    kind: 'sim',
    grade: 'A',
    stacks: ['canvas'],
    period: 8.0,
    hero: 3.2,
    aspect: '16 / 9',
    chips: ['20-node caudal spine chain', 'Couzin boid schooling', 'dual-pass slope ASCII'],
    purpose: 'Reef sharks and schooling baitfish swim via pre-warmed Couzin steering and 20-node sinusoidal spine chains, rasterized through a dual-pass slope-aware ASCII shader.',
  },
];

export async function create(id, options = {}) {
  if (id !== 'ascii-spine-boids') throw new Error('Unknown ascii demo: ' + id);
  const inst = buildAsciiSpineBoids(options);
  await inst.ready;
  return inst;
}
