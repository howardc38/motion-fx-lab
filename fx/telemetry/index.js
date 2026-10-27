// 3D-Tracked CAD Callout & Industrial Telemetry HUD effects (0BSD).
// Pure deterministic frame(t) implementations at 1280x720 (16:9).

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

function springValue(u, zeta = 0.52, omega = 18) {
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

async function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  const sample = 'BESbswy0123456789 ·θ±°³+//';
  await Promise.allSettled([
    document.fonts.load(`500 14px ${SANS}`, sample),
    document.fonts.load(`600 14px ${SANS}`, sample),
    document.fonts.load(`700 24px ${SANS}`, sample),
    document.fonts.load(`800 24px ${SANS}`, sample),
    document.fonts.load(`500 11px ${MONO}`, sample),
    document.fonts.load(`600 9.5px ${MONO}`, sample),
    document.fonts.load(`600 11px ${MONO}`, sample),
    document.fonts.load(`700 11px ${MONO}`, sample),
    document.fonts.load(`700 14px ${MONO}`, sample),
    document.fonts.load(`800 20px ${MONO}`, sample),
    document.fonts.load(`800 22px ${MONO}`, sample),
  ]);
  if (document.fonts.ready) await document.fonts.ready;
}

let cachedThreePromise = null;
async function getThree() {
  if (typeof globalThis !== 'undefined' && globalThis.THREE && globalThis.THREE.WebGLRenderer) {
    return globalThis.THREE;
  }
  if (!cachedThreePromise) {
    cachedThreePromise = import('three');
  }
  return cachedThreePromise;
}

// Shared Three.js WebGLRenderer so multiple gallery instances never exhaust WebGL contexts.
let sharedThreeRenderer = null;
function getSharedThreeRenderer(THREE, width, height) {
  if (!sharedThreeRenderer || sharedThreeRenderer.getContext().isContextLost()) {
    sharedThreeRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    sharedThreeRenderer.setPixelRatio(1);
    if ('SRGBColorSpace' in THREE) sharedThreeRenderer.outputColorSpace = THREE.SRGBColorSpace;
    else if ('sRGBEncoding' in THREE) sharedThreeRenderer.outputEncoding = THREE.sRGBEncoding;
  }
  if (sharedThreeRenderer.domElement.width !== width || sharedThreeRenderer.domElement.height !== height) {
    sharedThreeRenderer.setSize(width, height, false);
  }
  return sharedThreeRenderer;
}

// ============================================================================
// 1. cad-telemetry-hud (lead, period: 6.4, hero: 2.8)
// ============================================================================
async function buildCadTelemetryHud(options = {}) {
  const THREE = await getThree();
  await ensureFonts();

  const width = options.width || W;
  const height = options.height || H;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const PERIOD = 6.4;

  // Build precision 3D Turbine + Dual-Gimbal Gyroscope Assembly
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);

  scene.add(new THREE.AmbientLight(0x94a3b8, 0.65));
  const keyLight = new THREE.DirectionalLight(0xf8fafc, 1.9);
  keyLight.position.set(5, 6, 7);
  scene.add(keyLight);
  const cyanRim = new THREE.DirectionalLight(0x38bdf8, 1.65);
  cyanRim.position.set(-6, 2, -4);
  scene.add(cyanRim);
  const amberFill = new THREE.DirectionalLight(0xf59e0b, 0.75);
  amberFill.position.set(2, -5, 4);
  scene.add(amberFill);

  const rootAssembly = new THREE.Group();
  rootAssembly.scale.setScalar(0.84);
  scene.add(rootAssembly);

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x8ea0b8,
    metalness: 0.78,
    roughness: 0.26,
  });
  const darkAlloyMat = new THREE.MeshStandardMaterial({
    color: 0x263244,
    metalness: 0.82,
    roughness: 0.34,
  });
  const rotorAlloyMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.86,
    roughness: 0.18,
  });
  const copperCoreMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.75,
    roughness: 0.28,
  });
  const cadLineMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.32,
  });

  function addCadEdges(mesh, threshold = 24) {
    const edges = new THREE.EdgesGeometry(mesh.geometry, threshold);
    const line = new THREE.LineSegments(edges, cadLineMat);
    mesh.add(line);
  }

  // Outer machined gimbal ring + flange lugs
  const outerGimbal = new THREE.Group();
  rootAssembly.add(outerGimbal);

  const outerRingMesh = new THREE.Mesh(new THREE.TorusGeometry(2.12, 0.095, 20, 72), titaniumMat);
  addCadEdges(outerRingMesh, 28);
  outerGimbal.add(outerRingMesh);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.30), darkAlloyMat);
    lug.position.set(Math.cos(a) * 2.12, Math.sin(a) * 2.12, 0);
    lug.rotation.z = a;
    addCadEdges(lug);
    outerGimbal.add(lug);
  }

  // Stator Shroud Cylinder (open-ended machined casing)
  const shroudGroup = new THREE.Group();
  outerGimbal.add(shroudGroup);
  const shroudOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(1.74, 1.66, 0.92, 48, 1, true),
    darkAlloyMat
  );
  shroudOuter.rotation.x = Math.PI / 2;
  addCadEdges(shroudOuter, 18);
  shroudGroup.add(shroudOuter);

  const frontLip = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.065, 16, 64), titaniumMat);
  frontLip.position.z = 0.46;
  shroudGroup.add(frontLip);

  const rearLip = new THREE.Mesh(new THREE.TorusGeometry(1.66, 0.055, 16, 64), titaniumMat);
  rearLip.position.z = -0.46;
  shroudGroup.add(rearLip);

  // Stator guide struts
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.26;
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.14), titaniumMat);
    strut.position.set(Math.cos(a) * 1.92, Math.sin(a) * 1.92, 0);
    strut.rotation.z = a + Math.PI / 2;
    outerGimbal.add(strut);
  }

  // High-speed 16-blade Aero-Turbine Rotor Stage
  const rotorStage = new THREE.Group();
  shroudGroup.add(rotorStage);

  const BLADE_COUNT = 16;
  for (let i = 0; i < BLADE_COUNT; i++) {
    const a = (i / BLADE_COUNT) * TAU;
    const bladeHolder = new THREE.Group();
    bladeHolder.rotation.z = a;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.02, 0.042), rotorAlloyMat);
    blade.position.y = 1.08;
    blade.rotation.y = 0.58; // 33-deg airfoil pitch
    blade.rotation.x = 0.08;
    addCadEdges(blade);
    bladeHolder.add(blade);
    rotorStage.add(bladeHolder);
  }

  // Secondary counter-angled compressor stage
  const rearStage = new THREE.Group();
  rearStage.position.z = -0.34;
  shroudGroup.add(rearStage);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.12;
    const holder = new THREE.Group();
    holder.rotation.z = a;
    const vane = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.94, 0.035), titaniumMat);
    vane.position.y = 1.02;
    vane.rotation.y = -0.48;
    holder.add(vane);
    rearStage.add(holder);
  }

  // Central Combustor Hub + Precision Nose Cone + Shaft
  const coreGroup = new THREE.Group();
  shroudGroup.add(coreGroup);

  const centerHub = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 1.18, 36), copperCoreMat);
  centerHub.rotation.x = Math.PI / 2;
  addCadEdges(centerHub, 20);
  coreGroup.add(centerHub);

  const noseCone = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.58, 0.68, 32), rotorAlloyMat);
  noseCone.rotation.x = Math.PI / 2;
  noseCone.position.z = 0.88;
  addCadEdges(noseCone, 20);
  coreGroup.add(noseCone);

  const shaftRod = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.85, 20), rotorAlloyMat);
  shaftRod.rotation.x = Math.PI / 2;
  coreGroup.add(shaftRod);

  // Inner telemetry reference wireframe ring
  const innerRefRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.18, 0.02, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
  );
  innerRefRing.position.z = 0.52;
  shroudGroup.add(innerRefRing);

  // 4 Real 3D Local Anchor Points attached to actual moving 3D parts (ndc = P * V * M * p_local)
  const anchors = [
    {
      id: 'rpm',
      parent: shroudGroup,
      local: new THREE.Vector3(-1.12, 1.02, 0.42),
      side: -1,
      laneY: 164,
      code: 'CH-01 // ROTOR KINEMATICS',
      accent: '#38BDF8',
      valueFn: (t) => `RPM ${(14760 + Math.round(60 + 48 * Math.sin((TAU * t) / PERIOD * 2))).toLocaleString('en-US')}`,
      sub: 'STAGE 01 · SYNC LOCKED',
    },
    {
      id: 'clearance',
      parent: shroudGroup,
      local: new THREE.Vector3(1.22, 1.22, 0.46),
      side: 1,
      laneY: 148,
      code: 'CH-02 // BLADE TIP GAP',
      accent: '#2DD4BF',
      valueFn: (t) => `CLEARANCE ${(0.040 + 0.002 * Math.cos((TAU * t) / PERIOD * 3)).toFixed(3)} MM`,
      sub: 'OPTICAL PROBE · PASS',
    },
    {
      id: 'alloy',
      parent: outerGimbal,
      local: new THREE.Vector3(-1.50, -1.50, 0.14),
      side: -1,
      laneY: 506,
      code: 'CH-03 // GIMBAL TRUNNION',
      accent: '#A78BFA',
      valueFn: () => 'TI-6AL-4V',
      sub: 'GRADE 5 BILLET · 312 MPa',
    },
    {
      id: 'temp',
      parent: coreGroup,
      local: new THREE.Vector3(0.32, 0.16, 0.88),
      side: 1,
      laneY: 312,
      code: 'CH-04 // CORE STATOR',
      accent: '#F59E0B',
      valueFn: (t) => `TEMP ${Math.round(640 + 4 * Math.sin((TAU * t) / PERIOD))} K`,
      sub: 'THERMAL DELTA +1.8 K',
    },
  ];

  const worldVec = new THREE.Vector3();
  const ndcVec = new THREE.Vector3();

  function projectAnchor(parent, localVec) {
    worldVec.copy(localVec).applyMatrix4(parent.matrixWorld);
    ndcVec.copy(worldVec).project(camera);
    return {
      x: (ndcVec.x * 0.5 + 0.5) * W,
      y: (-ndcVec.y * 0.5 + 0.5) * H,
      ndcX: ndcVec.x,
      ndcY: ndcVec.y,
      ndcZ: ndcVec.z,
    };
  }

  function drawVernierRulers(ctx, cxProj, cyProj, t) {
    // Top precision horizontal Vernier ruler
    ctx.save();
    ctx.fillStyle = 'rgba(11, 17, 29, 0.82)';
    ctx.fillRect(0, 0, W, 38);
    ctx.fillRect(0, H - 34, W, 34);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 38.5);
    ctx.lineTo(W, 38.5);
    ctx.moveTo(0, H - 34.5);
    ctx.lineTo(W, H - 34.5);
    ctx.stroke();

    ctx.font = `600 9.5px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let x = 40; x <= W - 40; x += 10) {
      const major = x % 100 === 0;
      const mid = x % 50 === 0;
      const tickH = major ? 13 : mid ? 8 : 4.5;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 38);
      ctx.lineTo(x + 0.5, 38 - tickH);
      ctx.strokeStyle = major ? 'rgba(125, 211, 252, 0.7)' : 'rgba(148, 163, 184, 0.32)';
      ctx.stroke();
      if (major) {
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(`${(x - 640) >= 0 ? '+' : ''}${x - 640}`, x, 8);
      }
    }

    // Sliding Vernier cursor tracking projected 3D assembly X centroid!
    const vx = clamp(cxProj, 160, W - 160);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.fillRect(vx - 36, 0, 72, 38);
    ctx.strokeStyle = '#38BDF8';
    ctx.beginPath();
    ctx.moveTo(vx, 22);
    ctx.lineTo(vx, 45);
    ctx.stroke();
    // Vernier sub-ticks
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      ctx.moveTo(vx + k * 9, 38);
      ctx.lineTo(vx + k * 9, 32);
      ctx.stroke();
    }

    // Left vertical Vernier edge scale
    for (let y = 70; y <= H - 60; y += 10) {
      const major = y % 80 === 0;
      const tickW = major ? 12 : y % 40 === 0 ? 7 : 4;
      ctx.beginPath();
      ctx.moveTo(18, y + 0.5);
      ctx.lineTo(18 + tickW, y + 0.5);
      ctx.strokeStyle = major ? 'rgba(125, 211, 252, 0.6)' : 'rgba(148, 163, 184, 0.25)';
      ctx.stroke();
    }
    const vy = clamp(cyProj, 100, H - 100);
    ctx.strokeStyle = '#2DD4BF';
    ctx.beginPath();
    ctx.moveTo(12, vy);
    ctx.lineTo(36, vy);
    ctx.stroke();

    // Bottom telemetry status bar
    ctx.font = `700 11px ${MONO}`;
    ctx.fillStyle = '#7DD3FC';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('CAD // TURBO-GIMBAL ASSY REV 4.8   ·   PROJ: NDC = P·V·M·p', 28, H - 17);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`SYNC T+${t.toFixed(2)}S   ·   TOL ±0.002 MM`, W - 28, H - 17);
    ctx.restore();
  }

  function drawPolarProtractor(ctx, cx, cy, gimbalDeg, t) {
    const R = 248;
    ctx.save();
    // Subtle outer polar ring
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Sweeping active protractor arc (-75 deg to +75 deg + animated sweep)
    const sweepStart = -Math.PI * 0.42;
    const sweepEnd = sweepStart + (Math.PI * 0.84) * (0.62 + 0.38 * Math.sin((TAU * t) / PERIOD));
    ctx.beginPath();
    ctx.arc(cx, cy, R + 8, sweepStart, sweepEnd);
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.65)';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Degree ticks around polar circle
    for (let deg = 0; deg < 360; deg += 5) {
      const rad = (deg * Math.PI) / 180;
      const major = deg % 30 === 0;
      const mid = deg % 15 === 0;
      const r0 = R - (major ? 10 : mid ? 6 : 3);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * r0, cy + Math.sin(rad) * r0);
      ctx.lineTo(cx + Math.cos(rad) * R, cy + Math.sin(rad) * R);
      ctx.strokeStyle = major ? 'rgba(125, 211, 252, 0.52)' : 'rgba(148, 163, 184, 0.20)';
      ctx.lineWidth = major ? 1.3 : 0.8;
      ctx.stroke();
    }

    // Live gimbal inclination readout on top of protractor arc
    ctx.font = `700 11px ${MONO}`;
    ctx.fillStyle = '#2DD4BF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`GIMBAL θ ${gimbalDeg >= 0 ? '+' : ''}${gimbalDeg.toFixed(1)}°`, cx, cy - R - 14);
    ctx.restore();
  }

  function drawRadialGauge270(ctx, t) {
    // Bottom-right 270-degree damped-spring radial gauge
    const gx = 1072, gy = 548, gr = 74;
    const panelX = 948, panelY = 442, panelW = 286, panelH = 212;
    ctx.save();
    rrect(ctx, panelX, panelY, panelW, panelH, 14);
    ctx.fillStyle = 'rgba(12, 19, 33, 0.86)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = `700 10.5px ${MONO}`;
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('THRUST LOAD · 270° GAUGE', panelX + 18, panelY + 22);

    // Damped-spring load response with impulse step at t=0.6s and harmonic modulation
    const baseLoad = 0.56 + 0.28 * clamp(springValue(t - 0.45, 0.44, 13), 0, 1.22) * (1 - smooth(5.5, 6.2, t))
      + 0.035 * Math.sin((TAU * t) / PERIOD * 2);
    const load = clamp(baseLoad, 0.12, 0.96);

    const startA = (135 * Math.PI) / 180;
    const spanA = (270 * Math.PI) / 180;
    const endA = startA + spanA;
    const valA = startA + spanA * load;

    // Background 270° track
    ctx.beginPath();
    ctx.arc(gx, gy, gr, startA, endA);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.65)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Active 270° arc
    const arcGrad = ctx.createLinearGradient(gx - gr, gy, gx + gr, gy);
    arcGrad.addColorStop(0, '#38BDF8');
    arcGrad.addColorStop(0.65, '#2DD4BF');
    arcGrad.addColorStop(1, '#F59E0B');
    ctx.beginPath();
    ctx.arc(gx, gy, gr, startA, valA);
    ctx.strokeStyle = arcGrad;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Radial tick marks around 270° gauge
    for (let i = 0; i <= 18; i++) {
      const a = startA + (i / 18) * spanA;
      const major = i % 3 === 0;
      const rIn = gr - 16;
      const rOut = gr - (major ? 9 : 12);
      ctx.beginPath();
      ctx.moveTo(gx + Math.cos(a) * rIn, gy + Math.sin(a) * rIn);
      ctx.lineTo(gx + Math.cos(a) * rOut, gy + Math.sin(a) * rOut);
      ctx.strokeStyle = major ? '#CBD5E1' : 'rgba(148,163,184,0.4)';
      ctx.lineWidth = major ? 1.5 : 1;
      ctx.stroke();
    }

    // Needle
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + Math.cos(valA) * (gr - 14), gy + Math.sin(valA) * (gr - 14));
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(gx, gy, 5, 0, TAU);
    ctx.fillStyle = '#38BDF8';
    ctx.fill();

    // Center & side numeric telemetry
    ctx.font = `800 22px ${MONO}`;
    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'center';
    ctx.fillText(`${(load * 100).toFixed(1)}%`, gx, gy + 28);
    ctx.font = `600 10px ${MONO}`;
    ctx.fillStyle = '#2DD4BF';
    ctx.fillText('NOMINAL N1', gx, gy + 46);
    ctx.restore();
  }

  function drawCallout(ctx, anchor, proj, t, idx) {
    const enterK = smooth(0.08 + idx * 0.08, 0.48 + idx * 0.08, t);
    if (enterK <= 0.01) return;

    const badgeW = 248, badgeH = 72;
    const bx = anchor.side < 0 ? 52 : W - 52 - badgeW;
    // Gently track anchor Y within dedicated lane so 45-degree elbow never crosses siblings
    const targetMidY = anchor.laneY + clamp((proj.y - anchor.laneY) * 0.22, -26, 26);
    const by = targetMidY - badgeH / 2;
    const attachX = anchor.side < 0 ? bx + badgeW : bx;
    const attachY = targetMidY;

    // Exact 45-degree diagonal + horizontal shelf leader routing:
    // Segment 1 from (proj.x, proj.y) moves at exact 45° until reaching attachY, then horizontal to attachX!
    const dy = attachY - proj.y;
    const dirX = Math.sign(attachX - proj.x) || anchor.side;
    const maxDiag = Math.max(12, Math.abs(attachX - proj.x) - 18);
    const diagRun = Math.min(Math.abs(dy), maxDiag);
    const elbowX = proj.x + dirX * diagRun;
    const elbowY = proj.y + Math.sign(dy || 1) * diagRun;

    ctx.save();
    ctx.globalAlpha = enterK;

    // 3D Projected Target Reticle at exact (proj.x, proj.y)
    const pulse = 1 + 0.22 * Math.sin(t * 6 + idx * 1.7);
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 9.5 * pulse, 0, TAU);
    ctx.strokeStyle = anchor.accent;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 3.4, 0, TAU);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // 45° Elbow Leader Line
    ctx.beginPath();
    ctx.moveTo(proj.x, proj.y);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(attachX, attachY);
    ctx.strokeStyle = anchor.accent;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Elbow vertex node dot
    ctx.beginPath();
    ctx.arc(elbowX, elbowY, 2.6, 0, TAU);
    ctx.fillStyle = anchor.accent;
    ctx.fill();

    // Technical Callout Badge
    rrect(ctx, bx, by, badgeW, badgeH, 10);
    ctx.fillStyle = 'rgba(10, 16, 28, 0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Accent side bar
    const barX = anchor.side < 0 ? bx + badgeW - 4 : bx;
    rrect(ctx, barX, by + 10, 4, badgeH - 20, 2);
    ctx.fillStyle = anchor.accent;
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `700 9.5px ${MONO}`;
    ctx.fillStyle = anchor.accent;
    ctx.fillText(anchor.code, bx + 16, by + 17);

    ctx.font = `800 20px ${MONO}`;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(anchor.valueFn(t), bx + 16, by + 40);

    ctx.font = `600 10.5px ${MONO}`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(anchor.sub, bx + 16, by + 59);

    ctx.restore();
  }

  let lastProof = null;

  function frame(time) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    const phase = (TAU * t) / PERIOD;

    // 1. Update deterministic 3D transforms (seamless periodic angles over PERIOD)
    camera.position.set(0.35 * Math.sin(phase), 0.28 * Math.cos(phase), 7.65);
    camera.lookAt(0, -0.06, 0);

    const gimbalY = 0.56 * Math.sin(phase - 0.35) + 0.22;
    const gimbalX = 0.32 * Math.cos(phase + 0.25) - 0.14;
    rootAssembly.rotation.set(gimbalX, gimbalY, 0.08 * Math.sin(phase));
    shroudGroup.rotation.x = 0.16 * Math.sin(phase * 2);
    rotorStage.rotation.z = phase * 5; // exact integer harmonic revolutions per period!
    rearStage.rotation.z = -phase * 3;
    coreGroup.rotation.z = phase * 2;

    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    if (camera.matrixWorldInverse?.copy) {
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    }
    camera.projectionMatrixWorld = camera.projectionMatrix;

    // 2. Render 3D assembly via shared WebGLRenderer
    const renderer = getSharedThreeRenderer(THREE, width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);

    // 3. Composite onto 1280x720 CAD Blueprint + Telemetry Canvas
    g.save();
    g.setTransform(width / W, 0, 0, height / H, 0, 0);

    const bg = g.createRadialGradient(W * 0.5, H * 0.48, 30, W * 0.5, H * 0.5, W * 0.72);
    bg.addColorStop(0, '#101B2E');
    bg.addColorStop(0.58, '#09101D');
    bg.addColorStop(1, '#050811');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // Engineering millimeter blueprint grid
    g.strokeStyle = 'rgba(56, 189, 248, 0.055)';
    g.lineWidth = 1;
    for (let x = 64; x < W; x += 64) {
      g.beginPath();
      g.moveTo(x, 38);
      g.lineTo(x, H - 34);
      g.stroke();
    }
    for (let y = 72; y < H - 34; y += 64) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }

    const centerProj = projectAnchor(rootAssembly, new THREE.Vector3(0, 0, 0));
    drawPolarProtractor(g, centerProj.x, centerProj.y, (gimbalY * 180) / Math.PI, t);

    // Draw 3D rendered assembly
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(renderer.domElement, 0, 0, width, height);
    g.restore();

    // Project 4 real 3D anchors and draw zero-lag 45° leader lines + technical callouts
    const projected = anchors.map((a) => projectAnchor(a.parent, a.local));
    anchors.forEach((a, idx) => drawCallout(g, a, projected[idx], t, idx));

    drawVernierRulers(g, centerProj.x, centerProj.y, t);
    drawRadialGauge270(g, t);

    g.restore();
    lastProof = { t, anchors: projected };
    return lastProof;
  }

  return { canvas, ready: Promise.resolve(), frame, proof: () => lastProof };
}

// ============================================================================
// 2. ferrofluid-orb (variant, stacks: ['glsl'], grade: 'B', period: 5.6, hero: 1.9)
// ============================================================================
let sharedFerroGL = null;

const FERRO_VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FERRO_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uPeriod;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

// Impulse ringdown envelope: sharp magnetic strike + damped harmonic ringdown
float impulseEnv(float t, float t0, float decayRate, float freq) {
  float u = t - t0;
  if (u <= 0.0) return 0.0;
  float rise = 1.0 - exp(-u * 26.0);
  float ring = 0.62 + 0.38 * cos(u * freq);
  return rise * exp(-u * decayRate) * ring;
}

// Spherical harmonic + icosahedral magnetic spike displacement
float spikeField(vec3 n, float t) {
  float phase = TAU * t / uPeriod;
  // Rotate magnetic carrier slowly for 360-deg periodic seamlessness
  float ca = cos(phase), sa = sin(phase);
  vec3 q = vec3(ca * n.x + sa * n.z, n.y, -sa * n.x + ca * n.z);

  // Three timed harmonic magnetic impulses across the 5.6s period (impulse 2 peaks across hero = 1.9s!)
  float imp1 = impulseEnv(t, 0.24, 2.35, 15.0);
  float imp2 = impulseEnv(t, 1.56, 1.55, 17.5);
  float imp3 = impulseEnv(t, 3.32, 2.25, 16.0);
  float amp = clamp(imp1 * 0.78 + imp2 * 1.12 + imp3 * 0.85, 0.0, 1.25);

  // Base breathing carrier so liquid chrome is alive even at rest
  float baseWave = 0.028 * pow(max(0.0, sin(3.0 * q.x + phase) * cos(3.0 * q.y - phase)), 3.0)
                 + 0.022 * sin(4.0 * q.y + 2.0 * phase) * cos(4.0 * q.z);

  // Multi-pole sin^3 spherical-harmonic ferrofluid crown spikes
  float theta = acos(clamp(q.y, -1.0, 1.0));
  float phi = atan(q.z, q.x);

  float sh1 = pow(max(0.0, sin(5.0 * theta + 0.4 * sin(phase * 2.0)) * cos(6.0 * phi + phase * 2.0)), 3.0);
  float sh2 = pow(max(0.0, cos(6.0 * theta - 0.5) * sin(5.0 * phi - phase * 3.0)), 3.0);

  // Discrete magnetic pole needles (icosahedral-inspired directions)
  float poles = 0.0;
  poles += pow(max(0.0, dot(q, normalize(vec3(0.0, 1.0, 0.25)))), 14.0);
  poles += pow(max(0.0, dot(q, normalize(vec3(0.86, 0.42, 0.28)))), 14.0);
  poles += pow(max(0.0, dot(q, normalize(vec3(-0.86, 0.42, 0.28)))), 14.0);
  poles += pow(max(0.0, dot(q, normalize(vec3(0.52, -0.55, 0.65)))), 14.0);
  poles += pow(max(0.0, dot(q, normalize(vec3(-0.52, -0.55, 0.65)))), 14.0);
  poles += pow(max(0.0, dot(q, normalize(vec3(0.0, -0.88, -0.46)))), 14.0);
  poles += pow(max(0.0, dot(q, normalize(vec3(0.75, 0.12, -0.64)))), 14.0);
  poles += pow(max(0.0, dot(q, normalize(vec3(-0.75, 0.12, -0.64)))), 14.0);

  return baseWave + amp * (0.28 * sh1 + 0.24 * sh2 + 0.34 * poles);
}

float mapSDF(vec3 p, float t) {
  float r = length(p);
  if (r > 2.55) return r - 2.05;
  vec3 dir = p / max(r, 1e-4);
  float disp = spikeField(dir, t);
  return (r - (1.02 + disp)) * 0.36;
}

vec3 calcNormal(vec3 p, float t) {
  vec2 e = vec2(0.0025, 0.0);
  return normalize(vec3(
    mapSDF(p + e.xyy, t) - mapSDF(p - e.xyy, t),
    mapSDF(p + e.yxy, t) - mapSDF(p - e.yxy, t),
    mapSDF(p + e.yyx, t) - mapSDF(p - e.yyx, t)
  ));
}

// Procedural studio softbox + telemetry neon environment reflection
vec3 envReflection(vec3 rd) {
  float y = rd.y;
  vec3 base = mix(vec3(0.015, 0.024, 0.045), vec3(0.08, 0.13, 0.22), smoothstep(-0.6, 0.8, y));
  // Overhead crisp softbox strip
  float softbox1 = smoothstep(0.76, 0.92, dot(rd, normalize(vec3(-0.35, 0.82, 0.45))));
  float softbox2 = smoothstep(0.84, 0.96, dot(rd, normalize(vec3(0.65, 0.45, 0.60))));
  // Cyan & amber telemetry containment rim lights
  float cyanRim = pow(max(0.0, dot(rd, normalize(vec3(-0.92, 0.15, -0.35)))), 7.0);
  float tealBand = exp(-pow((rd.y - 0.12) * 7.5, 2.0)) * smoothstep(-0.2, 0.8, -rd.z);
  float amberRim = pow(max(0.0, dot(rd, normalize(vec3(0.88, -0.35, -0.30)))), 9.0);

  vec3 col = base;
  col += vec3(0.95, 0.98, 1.0) * softbox1 * 1.45;
  col += vec3(0.80, 0.90, 1.0) * softbox2 * 0.95;
  col += vec3(0.12, 0.78, 0.98) * (cyanRim * 1.35 + tealBand * 0.42);
  col += vec3(0.98, 0.62, 0.16) * amberRim * 1.05;
  return col;
}

void main() {
  vec2 aspectUv = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float t = mod(uTime, uPeriod);

  // Background industrial containment chamber + subtle blueprint grid
  float rad = length(aspectUv);
  vec3 bg = mix(vec3(0.055, 0.085, 0.145), vec3(0.018, 0.026, 0.048), smoothstep(0.0, 0.95, rad));
  vec2 grid = abs(fract(aspectUv * 14.0) - 0.5);
  float gridLine = smoothstep(0.485, 0.5, max(grid.x, grid.y));
  bg += vec3(0.08, 0.26, 0.42) * gridLine * 0.16;

  // Industrial Telemetry Reticle (SDF rings, ticks, crosshairs & harmonic bars)
  float ring1 = smoothstep(0.0032, 0.0008, abs(rad - 0.395));
  float ring2 = smoothstep(0.0025, 0.0006, abs(rad - 0.435));
  float ang = atan(aspectUv.y, aspectUv.x);
  float tickMask = smoothstep(0.382, 0.386, rad) * smoothstep(0.408, 0.404, rad)
                 * smoothstep(0.92, 0.98, cos(ang * 36.0));
  float sweepArc = smoothstep(0.004, 0.001, abs(rad - 0.435))
                 * smoothstep(0.15, 0.20, sin(ang * 2.0 - TAU * t / uPeriod * 2.0));

  // Crosshair fiducials outside central sphere
  float crossH = smoothstep(0.0022, 0.0005, abs(aspectUv.y)) * step(0.41, abs(aspectUv.x)) * step(abs(aspectUv.x), 0.56);
  float crossV = smoothstep(0.0022, 0.0005, abs(aspectUv.x)) * step(0.41, abs(aspectUv.y)) * step(abs(aspectUv.y), 0.47);

  bg += vec3(0.22, 0.74, 0.97) * (ring1 * 0.35 + tickMask * 0.45 + crossH * 0.45 + crossV * 0.45);
  bg += vec3(0.18, 0.88, 0.76) * (ring2 * 0.18 + sweepArc * 0.72);

  // Raymarch Ferrofluid Metallic Sphere
  vec3 ro = vec3(0.0, 0.0, 4.78);
  vec3 rd = normalize(vec3(aspectUv, -1.55));

  float dist = 0.0;
  float hit = 0.0;
  float minD = 99.0;
  for (int i = 0; i < 112; i++) {
    vec3 p = ro + rd * dist;
    float d = mapSDF(p, t);
    minD = min(minD, d);
    if (d < 0.0012) {
      hit = 1.0;
      break;
    }
    dist += d;
    if (dist > 6.8) break;
  }

  vec3 col = bg;
  // Magnetic containment halo glow around spikes
  float halo = exp(-max(0.0, minD) * 15.0);
  col += vec3(0.10, 0.55, 0.85) * halo * 0.26;

  if (hit > 0.5) {
    vec3 pos = ro + rd * dist;
    vec3 n = calcNormal(pos, t);
    vec3 v = -rd;
    float ndotv = max(0.0, dot(n, v));

    // Schlick Fresnel for liquid ferrofluid-chrome
    vec3 f0 = vec3(0.62, 0.67, 0.74);
    vec3 fresnel = f0 + (1.0 - f0) * pow(1.0 - ndotv, 4.0);

    vec3 reflDir = reflect(rd, n);
    vec3 envCol = envReflection(reflDir);

    // Valley cavity occlusion (troughs look deep oily black, spike tips gleam chrome!)
    float radiusNorm = clamp((length(pos) - 0.98) / 0.34, 0.0, 1.0);
    float ao = mix(0.32, 1.08, smoothstep(0.0, 0.75, radiusNorm));

    // Specular key highlight
    vec3 keyDir = normalize(vec3(-0.42, 0.75, 0.52));
    vec3 hVec = normalize(keyDir + v);
    float spec = pow(max(0.0, dot(n, hVec)), 96.0);

    vec3 darkOil = vec3(0.015, 0.022, 0.035);
    col = mix(darkOil, envCol * ao, fresnel) + vec3(1.0, 0.99, 0.96) * spec * 1.35;
    // Cyan rim accent on spike silhouettes
    col += vec3(0.16, 0.82, 0.98) * pow(1.0 - ndotv, 4.5) * (0.35 + 0.55 * radiusNorm);
  }

  // Subtle tone-map & gamma polish
  col = col / (1.0 + col * 0.28);
  col = pow(max(col, 0.0), vec3(0.92));
  gl_FragColor = vec4(col, 1.0);
}
`;

function getFerroGL(width, height) {
  if (!sharedFerroGL || sharedFerroGL.gl.isContextLost()) {
    const glCanvas = document.createElement('canvas');
    glCanvas.width = width;
    glCanvas.height = height;
    const gl = glCanvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL unavailable for ferrofluid-orb');

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
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, FERRO_VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FERRO_FRAG));
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

    sharedFerroGL = {
      glCanvas,
      gl,
      prog,
      uRes: gl.getUniformLocation(prog, 'uRes'),
      uTime: gl.getUniformLocation(prog, 'uTime'),
      uPeriod: gl.getUniformLocation(prog, 'uPeriod'),
    };
  }
  if (sharedFerroGL.glCanvas.width !== width || sharedFerroGL.glCanvas.height !== height) {
    sharedFerroGL.glCanvas.width = width;
    sharedFerroGL.glCanvas.height = height;
  }
  return sharedFerroGL;
}

async function buildFerrofluidOrb(options = {}) {
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const PERIOD = 5.6;

  function impulseReadout(t, t0, decay) {
    const u = t - t0;
    return u <= 0 ? 0 : (1 - Math.exp(-u * 26)) * Math.exp(-u * decay);
  }

  function frame(time) {
    const t = ((Number.isFinite(time) ? Math.max(0, time) : 0) % PERIOD);
    const ctxGL = getFerroGL(width, height);
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

    // Crisp corner industrial reticle fiducials
    g.setTransform(width / W, 0, 0, height / H, 0, 0);
    const flux = 0.65 + 1.45 * (
      0.78 * impulseReadout(t, 0.24, 2.35) +
      1.12 * impulseReadout(t, 1.56, 1.55) +
      0.85 * impulseReadout(t, 3.32, 2.25)
    );

    // Corner bracket marks
    g.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    g.lineWidth = 1.6;
    const corners = [[44, 44, 1, 1], [W - 44, 44, -1, 1], [44, H - 44, 1, -1], [W - 44, H - 44, -1, -1]];
    for (const [cx, cy, sx, sy] of corners) {
      g.beginPath();
      g.moveTo(cx, cy + sy * 22);
      g.lineTo(cx, cy);
      g.lineTo(cx + sx * 22, cy);
      g.stroke();
    }

    g.font = `700 12px ${MONO}`;
    g.fillStyle = '#7DD3FC';
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText('MAG-CONTAINMENT // FERROFLUID HARMONIC RESPONSE', 64, 52);
    g.font = `600 11px ${MONO}`;
    g.fillStyle = '#94A3B8';
    g.fillText('SPHERICAL MODE  l = 6, m = 5  ·  SIN³ LOBE ENVELOPE', 64, 72);

    g.textAlign = 'right';
    g.font = `800 20px ${MONO}`;
    g.fillStyle = '#F8FAFC';
    g.fillText(`B-FLUX ${flux.toFixed(2)} T`, W - 64, 50);
    g.font = `600 11px ${MONO}`;
    g.fillStyle = '#2DD4BF';
    g.fillText(`RINGDOWN  T+${t.toFixed(2)}S`, W - 64, 76);

    // Bottom harmonic spectrum strip
    const bx0 = 64, by0 = H - 62;
    for (let i = 0; i < 16; i++) {
      const hVal = 0.2 + 0.8 * Math.abs(Math.sin(t * 7.5 + i * 0.55)) * clamp((flux - 0.5) / 1.4, 0.18, 1);
      const bh = 6 + hVal * 24;
      g.fillStyle = i % 3 === 0 ? '#2DD4BF' : 'rgba(56, 189, 248, 0.65)';
      g.fillRect(bx0 + i * 11, by0 - bh, 6, bh);
    }
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    g.font = `600 11px ${MONO}`;
    g.fillStyle = '#94A3B8';
    g.fillText('ELASTIC SPECTRUM · Q = 14.2', bx0 + 190, by0 - 2);

    g.restore();
  }

  return { canvas, ready: Promise.resolve(), frame };
}

export const studies = [
  {
    id: 'cad-telemetry-hud',
    name: '3D-tracked CAD telemetry HUD',
    kind: 'ui',
    grade: 'A',
    stacks: ['three', 'canvas'],
    period: 6.4,
    hero: 2.8,
    aspect: '16 / 9',
    chips: ['NDC = P·V·M·p projection', '45° elbow callouts', 'Vernier + 270° spring gauge'],
    purpose: 'Four real 3D anchor points on a rotating turbine-gimbal assembly project directly to screen space to drive zero-lag 45° CAD callouts, Vernier rulers and a 270° radial gauge.',
  },
  {
    id: 'ferrofluid-orb',
    name: 'Harmonic ferrofluid containment orb',
    kind: 'shader',
    grade: 'B',
    stacks: ['glsl'],
    period: 5.6,
    hero: 1.9,
    aspect: '16 / 9',
    chips: ['raymarched SDF spikes', 'sin³ spherical harmonics', 'damped elastic ringdown'],
    purpose: 'A liquid-chrome ferrofluid sphere inside an industrial telemetry reticle erupts into sin³ spherical-harmonic spike lobes under timed magnetic impulses and rings down elastically.',
  },
];

export async function create(id, options = {}) {
  if (id === 'cad-telemetry-hud') return buildCadTelemetryHud(options);
  if (id === 'ferrofluid-orb') return buildFerrofluidOrb(options);
  throw new Error('Unknown telemetry demo: ' + id);
}
