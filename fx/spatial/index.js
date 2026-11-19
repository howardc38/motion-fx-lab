// Spatial 3D Portals, Extruded Code Slabs, Canopy Depth Reveal & Multi-Device Flythrough (0BSD).
// Pure deterministic frame(t, options) on shared Three.js WebGLRenderer + Canvas 2D.

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
const spring = (u, zeta = 0.65, omega = 16) => {
  if (u <= 0) return 0;
  const wd = omega * Math.sqrt(Math.max(0.001, 1 - zeta * zeta));
  const env = Math.exp(-zeta * omega * u);
  return 1 - env * (Math.cos(wd * u) + ((zeta * omega) / wd) * Math.sin(wd * u));
};
const hash1 = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
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

// Single shared Three.js renderer to prevent exceeding Chromium's WebGL context cap.
let sharedRenderer = null;
function getSharedRenderer(THREE, width, height) {
  if (!sharedRenderer || sharedRenderer.getContext().isContextLost()) {
    sharedRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    sharedRenderer.setPixelRatio(1);
    if ('SRGBColorSpace' in THREE) sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
    else if ('sRGBEncoding' in THREE) sharedRenderer.outputEncoding = THREE.sRGBEncoding;
  }
  if (sharedRenderer.domElement.width !== width || sharedRenderer.domElement.height !== height) {
    sharedRenderer.setSize(width, height, false);
  }
  return sharedRenderer;
}

function makeRoundedRectShape(THREE, w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function setTexColorSpace(THREE, tex) {
  if ('SRGBColorSpace' in THREE) tex.colorSpace = THREE.SRGBColorSpace;
  else if ('sRGBEncoding' in THREE) tex.encoding = THREE.sRGBEncoding;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// 1. wireframe-portal (lead, kind: space, period: 6.0, hero: 2.8)
// Nested architectural wireframe portal chamber + glowing focal title
// ============================================================================
async function buildWireframePortal(options = {}) {
  const THREE = await getThree();
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 6.0;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x060811, 0.042);
  const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 140);

  // Build 18 nested chamfered architectural wireframe portals along -Z
  const portals = [];
  const FRAME_COUNT = 18;
  const SPACING = 2.15;

  function makeChamferLoop(hw, hh, ch) {
    const pts = [
      new THREE.Vector3(-hw + ch, hh, 0),
      new THREE.Vector3(hw - ch, hh, 0),
      new THREE.Vector3(hw, hh - ch, 0),
      new THREE.Vector3(hw, -hh + ch, 0),
      new THREE.Vector3(hw - ch, -hh, 0),
      new THREE.Vector3(-hw + ch, -hh, 0),
      new THREE.Vector3(-hw, -hh + ch, 0),
      new THREE.Vector3(-hw, hh - ch, 0),
      new THREE.Vector3(-hw + ch, hh, 0),
    ];
    return new THREE.BufferGeometry().setFromPoints(pts);
  }

  const outerGeo = makeChamferLoop(3.6, 2.15, 0.42);
  const innerGeo = makeChamferLoop(3.22, 1.82, 0.36);

  // Perspective floor & ceiling guide rails
  const railPts = [];
  for (let i = -4; i <= 4; i++) {
    const x = i * 1.15;
    railPts.push(new THREE.Vector3(x, -2.55, 6), new THREE.Vector3(x, -2.55, -46));
    railPts.push(new THREE.Vector3(x, 2.55, 6), new THREE.Vector3(x, 2.55, -46));
  }
  const railGeo = new THREE.BufferGeometry().setFromPoints(railPts);
  const railMat = new THREE.LineBasicMaterial({ color: 0x253864, transparent: true, opacity: 0.45 });
  scene.add(new THREE.LineSegments(railGeo, railMat));

  for (let i = 0; i < FRAME_COUNT; i++) {
    const grp = new THREE.Group();
    const tNorm = i / (FRAME_COUNT - 1);
    const colOuter = new THREE.Color().setHSL(lerp(0.56, 0.84, tNorm), 0.85, 0.62);
    const colInner = new THREE.Color().setHSL(lerp(0.52, 0.78, tNorm), 0.72, 0.78);
    const l1 = new THREE.Line(outerGeo, new THREE.LineBasicMaterial({ color: colOuter, transparent: true, opacity: 0.85 }));
    const l2 = new THREE.Line(innerGeo, new THREE.LineBasicMaterial({ color: colInner, transparent: true, opacity: 0.42 }));

    // Corner tick struts connecting outer & inner frames
    const strutPts = [
      new THREE.Vector3(-3.18, 2.15, 0), new THREE.Vector3(-2.86, 1.82, 0),
      new THREE.Vector3(3.18, 2.15, 0), new THREE.Vector3(2.86, 1.82, 0),
      new THREE.Vector3(3.18, -2.15, 0), new THREE.Vector3(2.86, -1.82, 0),
      new THREE.Vector3(-3.18, -2.15, 0), new THREE.Vector3(-2.86, -1.82, 0),
    ];
    const struts = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(strutPts),
      new THREE.LineBasicMaterial({ color: colOuter, transparent: true, opacity: 0.65 })
    );
    grp.add(l1, l2, struts);
    scene.add(grp);
    portals.push({ grp, index: i, matOuter: l1.material, matInner: l2.material });
  }

  // Floating geometric particles along corridor walls
  const pCount = 260;
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    const ang = hash1(i * 3.1) * TAU;
    const rad = 2.6 + hash1(i * 5.7) * 3.4;
    pPos[i * 3] = Math.cos(ang) * rad * 1.35;
    pPos[i * 3 + 1] = Math.sin(ang) * rad * 0.72;
    pPos[i * 3 + 2] = -hash1(i * 9.3) * 42;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0x99d6ff, size: 0.09, transparent: true, opacity: 0.72 });
  const dust = new THREE.Points(pGeo, pMat);
  scene.add(dust);

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const u = t / PERIOD;
    const title = getCustomText(opts, 'PORTAL');

    // Continuous cyclic corridor travel + subtle camera roll and breath
    const travel = u * SPACING * 6;
    const chamberDepth = FRAME_COUNT * SPACING;
    for (let i = 0; i < FRAME_COUNT; i++) {
      const p = portals[i];
      let z = -i * SPACING + travel;
      while (z > 4.2) z -= chamberDepth;
      while (z < 4.2 - chamberDepth) z += chamberDepth;
      p.grp.position.z = z;
      // Progressive architectural twist wave traveling down the tunnel
      const twist = Math.sin(z * 0.16 + u * TAU) * 0.11;
      const scale = 1.0 + 0.04 * Math.sin(z * 0.25 - u * TAU);
      p.grp.rotation.z = twist;
      p.grp.scale.setScalar(scale);
      const fadeNear = smooth(4.0, 1.4, z);
      const fadeFar = smooth(-34.0, -14.0, z);
      p.matOuter.opacity = clamp(0.92 * fadeNear * fadeFar, 0, 0.95);
      p.matInner.opacity = clamp(0.42 * fadeNear * fadeFar, 0, 0.5);
    }

    dust.position.z = (u * 14) % 14;
    camera.position.set(Math.sin(u * TAU) * 0.32, Math.cos(u * TAU) * 0.16, 4.6);
    camera.lookAt(Math.sin(u * TAU + 0.5) * 0.18, Math.cos(u * TAU) * 0.08, -16);
    camera.rotation.z = Math.sin(u * TAU) * 0.045;

    const renderer = getSharedRenderer(THREE, width, height);
    renderer.setClearColor(0x060811, 1);
    renderer.render(scene, camera);

    // Composite onto 2D canvas with volumetric center portal glow + crisp focal title
    g.clearRect(0, 0, width, height);
    g.drawImage(renderer.domElement, 0, 0, width, height);

    const sc = width / 1280;
    // Luminous central horizon core bloom
    const rg = g.createRadialGradient(width * 0.5, height * 0.5, 10 * sc, width * 0.5, height * 0.5, 420 * sc);
    rg.addColorStop(0, 'rgba(92, 196, 255, 0.26)');
    rg.addColorStop(0.45, 'rgba(138, 92, 246, 0.11)');
    rg.addColorStop(1, 'rgba(6, 8, 17, 0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, width, height);

    // Focal dimensional headline emerging & locking cleanly in portal center
    const enter = spring(clamp((t - 0.35) / 1.35), 0.65, 11);
    const exit = 1 - smooth(4.85, 5.75, t);
    const vis = clamp(enter * exit, 0, 1);

    if (vis > 0.01) {
      g.save();
      g.globalAlpha = vis;
      g.translate(width * 0.5, height * 0.5);
      const s = lerp(0.84, 1.0, enter) * lerp(1.0, 1.14, 1 - exit);
      g.scale(s, s);

      // Eyebrow telemetry
      g.fillStyle = '#7dd3fc';
      g.font = `700 ${14 * sc}px ${MONO}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(`SECTOR Z-${(100 + u * 240).toFixed(1)}  ·  WIREFRAME CORRIDOR`, 0, -76 * sc);

      // Clean glowing title
      let fSize = title.length > 14 ? 72 : title.length > 9 ? 98 : 124;
      g.font = `900 ${fSize * sc}px ${SANS}`;
      while (g.measureText(title).width > width * 0.72 && fSize > 42) {
        fSize -= 6;
        g.font = `900 ${fSize * sc}px ${SANS}`;
      }
      g.shadowColor = 'rgba(80, 185, 255, 0.55)';
      g.shadowBlur = 32 * sc;
      g.fillStyle = '#f8fafc';
      g.fillText(title, 0, 2 * sc);

      // Subtitle
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(203, 213, 225, 0.8)';
      g.font = `500 ${18 * sc}px ${MONO}`;
      g.fillText('DEPTH-TRACKED ARCHITECTURAL SPACE', 0, 74 * sc);
      g.restore();
    }

    // Minimal corner reticle hairlines
    g.save();
    g.strokeStyle = 'rgba(125, 211, 252, 0.34)';
    g.lineWidth = 1.5 * sc;
    const m = 34 * sc, len = 24 * sc;
    for (const [cx, cy, dx, dy] of [
      [m, m, 1, 1], [width - m, m, -1, 1], [m, height - m, 1, -1], [width - m, height - m, -1, -1],
    ]) {
      g.beginPath();
      g.moveTo(cx, cy + dy * len);
      g.lineTo(cx, cy);
      g.lineTo(cx + dx * len, cy);
      g.stroke();
    }
    g.restore();
  }

  frame(2.8, options);
  return { canvas, frame, period: PERIOD, hero: 2.8 };
}

// ============================================================================
// 2. code-3d-extrude (lead, kind: type, period: 6.0, hero: 2.9)
// Machined 3D beveled syntax-highlighted code slab with orbital lighting
// ============================================================================
async function buildCode3DExtrude(options = {}) {
  const THREE = await getThree();
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 6.0;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  // High-DPI offscreen syntax-highlighted code plate texture
  const texCanvas = document.createElement('canvas');
  texCanvas.width = 1440;
  texCanvas.height = 880;
  const tg = texCanvas.getContext('2d');

  function drawCodeTexture(t, customTitle) {
    tg.save();
    // Deep slate anodized surface
    const bg = tg.createLinearGradient(0, 0, 1440, 880);
    bg.addColorStop(0, '#0f1320');
    bg.addColorStop(1, '#090c15');
    tg.fillStyle = bg;
    tg.fillRect(0, 0, 1440, 880);

    // Top window chrome bar
    tg.fillStyle = '#171d2f';
    tg.fillRect(0, 0, 1440, 76);
    tg.fillStyle = 'rgba(255,255,255,0.08)';
    tg.fillRect(0, 75, 1440, 2);

    const dots = ['#ff5f57', '#febc2e', '#28c840'];
    dots.forEach((c, i) => {
      tg.fillStyle = c;
      tg.beginPath();
      tg.arc(54 + i * 32, 38, 9, 0, TAU);
      tg.fill();
    });

    const fnName = (customTitle || 'renderFrame').replace(/[^A-Za-z0-9_$-]/g, '') || 'renderFrame';
    tg.fillStyle = '#94a3b8';
    tg.font = `700 22px ${MONO}`;
    tg.textAlign = 'center';
    tg.textBaseline = 'middle';
    tg.fillText(`${fnName}.ts — Deterministic Motion Kernel`, 720, 38);

    // Execution highlight line sweeping cleanly through code lines
    const activeLine = Math.floor(((t / PERIOD) * 11) % 11);
    const lineY0 = 136;
    const lineH = 62;

    // Glowing active execution row
    const hlGrad = tg.createLinearGradient(0, 0, 1440, 0);
    hlGrad.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
    hlGrad.addColorStop(0.75, 'rgba(139, 92, 246, 0.14)');
    hlGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    tg.fillStyle = hlGrad;
    tg.fillRect(0, lineY0 + activeLine * lineH - 26, 1440, lineH);
    tg.fillStyle = '#38bdf8';
    tg.fillRect(0, lineY0 + activeLine * lineH - 26, 8, lineH);

    // Structured syntax-colored token rows
    const lines = [
      [['export ', '#c084fc'], ['function ', '#c084fc'], [fnName, '#38bdf8'], ['(t: ', '#e2e8f0'], ['number', '#fbbf24'], [') {', '#e2e8f0']],
      [['  const ', '#c084fc'], ['phase', '#f8fafc'], [' = ', '#94a3b8'], ['clamp', '#38bdf8'], ['(t / ', '#e2e8f0'], ['6.0', '#fb923c'], [', ', '#94a3b8'], ['0', '#fb923c'], [', ', '#94a3b8'], ['1', '#fb923c'], [');', '#e2e8f0']],
      [['  const ', '#c084fc'], ['spring', '#f8fafc'], [' = ', '#94a3b8'], ['dampedHarmonic', '#38bdf8'], ['(phase, ', '#e2e8f0'], ['0.62', '#fb923c'], [', ', '#94a3b8'], ['18', '#fb923c'], [');', '#e2e8f0']],
      [['  const ', '#c084fc'], ['camera', '#f8fafc'], [' = ', '#94a3b8'], ['orbitArc', '#38bdf8'], ['({ ', '#e2e8f0'], ['yaw', '#7dd3fc'], [': spring * ', '#e2e8f0'], ['0.48', '#fb923c'], [' });', '#e2e8f0']],
      [['', '#fff']],
      [['  // Zero accumulated state: f(t) is pixel-exact', '#64748b']],
      [['  return ', '#c084fc'], ['composeLayer', '#38bdf8'], ['({', '#e2e8f0']],
      [['    mesh', '#7dd3fc'], [': ', '#94a3b8'], ['extrudeBevel', '#34d399'], ['(slab, ', '#e2e8f0'], ['0.28', '#fb923c'], [' ),', '#e2e8f0']],
      [['    light', '#7dd3fc'], [': ', '#94a3b8'], ['softboxSweep', '#34d399'], ['(t, ', '#e2e8f0'], ['"BT.709"', '#fde047'], [' ),', '#e2e8f0']],
      [['    verify', '#7dd3fc'], [': ', '#94a3b8'], ['dualBrowserDiff', '#34d399'], ['(frameA, frameB)', '#e2e8f0']],
      [['  });', '#e2e8f0']],
    ];

    tg.font = `600 28px ${MONO}`;
    tg.textAlign = 'left';
    tg.textBaseline = 'middle';
    lines.forEach((tokens, rowIdx) => {
      const y = lineY0 + rowIdx * lineH;
      // Line number gutter
      tg.fillStyle = rowIdx === activeLine ? '#38bdf8' : '#475569';
      tg.textAlign = 'right';
      tg.fillText(String(rowIdx + 1).padStart(2, '0'), 92, y);
      tg.textAlign = 'left';
      let x = 132;
      for (const [str, col] of tokens) {
        tg.fillStyle = col;
        tg.fillText(str, x, y);
        x += tg.measureText(str).width;
      }
    });

    // Subtle specular reflection sweep across glass face
    const sweepX = lerp(-400, 1800, (t / PERIOD));
    const sw = tg.createLinearGradient(sweepX - 180, 0, sweepX + 180, 880);
    sw.addColorStop(0, 'rgba(255,255,255,0)');
    sw.addColorStop(0.5, 'rgba(186,230,253,0.08)');
    sw.addColorStop(1, 'rgba(255,255,255,0)');
    tg.fillStyle = sw;
    tg.fillRect(0, 0, 1440, 880);
    tg.restore();
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 80);

  // Studio 3-point lighting for machined aluminum bevel highlights
  scene.add(new THREE.AmbientLight(0x8fa8c8, 0.72));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(5, 6, 7);
  scene.add(key);
  const rimCyan = new THREE.DirectionalLight(0x38bdf8, 2.1);
  rimCyan.position.set(-7, 3, -3);
  scene.add(rimCyan);
  const rimWarm = new THREE.DirectionalLight(0xf472b6, 1.3);
  rimWarm.position.set(6, -4, -4);
  scene.add(rimWarm);

  const slabGroup = new THREE.Group();
  scene.add(slabGroup);

  const slabW = 5.6;
  const slabH = 3.42;
  const shape = makeRoundedRectShape(THREE, slabW, slabH, 0.24);
  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.085,
    bevelSize: 0.075,
    bevelSegments: 5,
    curveSegments: 16,
  });
  extrudeGeo.center();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.86,
    roughness: 0.24,
  });
  const slabMesh = new THREE.Mesh(extrudeGeo, bodyMat);
  slabGroup.add(slabMesh);

  // Illuminated cyan perimeter rim ring on the extruded edge
  const edgeLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(extrudeGeo, 28),
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.48 })
  );
  slabGroup.add(edgeLines);

  // Front syntax code screen inlaid flush into the beveled slab
  const codeTex = setTexColorSpace(THREE, new THREE.CanvasTexture(texCanvas));
  const faceGeo = new THREE.PlaneGeometry(slabW - 0.18, slabH - 0.18);
  const faceMat = new THREE.MeshBasicMaterial({ map: codeTex });
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.position.z = 0.298;
  slabGroup.add(faceMesh);

  // Floating glowing satellite telemetry chips orbiting subtly behind the slab
  const chipGeo = new THREE.BoxGeometry(0.92, 0.24, 0.08);
  const chipMatA = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.45, metalness: 0.6, roughness: 0.2 });
  const chipMatB = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x7e22ce, emissiveIntensity: 0.45, metalness: 0.6, roughness: 0.2 });
  const chip1 = new THREE.Mesh(chipGeo, chipMatA);
  const chip2 = new THREE.Mesh(chipGeo, chipMatB);
  chip1.position.set(-3.35, 1.35, -0.55);
  chip2.position.set(3.25, -1.25, -0.45);
  slabGroup.add(chip1, chip2);

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const ph = (t / PERIOD) * TAU;
    const customTitle = getCustomText(opts, '');

    drawCodeTexture(t, customTitle);
    codeTex.needsUpdate = true;

    // Dramatic machined 3D tilt-and-orbit choreography (seamless loop)
    slabGroup.rotation.y = Math.sin(ph) * 0.44 - 0.12 * Math.cos(ph);
    slabGroup.rotation.x = Math.sin(ph * 0.5) * 0.18 - 0.08;
    slabGroup.rotation.z = Math.cos(ph) * 0.035;
    slabGroup.position.y = Math.sin(ph * 2) * 0.08;

    chip1.position.y = 1.32 + Math.sin(ph + 0.8) * 0.16;
    chip2.position.y = -1.24 + Math.cos(ph + 0.4) * 0.16;

    key.position.set(Math.cos(ph) * 7.5, 5.5, 6.5);
    camera.position.set(0, 0.25, 8.15 - Math.sin(ph) * 0.45);
    camera.lookAt(0, 0, 0);

    const renderer = getSharedRenderer(THREE, width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);

    // Rich studio gradient backdrop behind transparent Three.js slab
    const bg = g.createRadialGradient(width * 0.5, height * 0.46, 40, width * 0.5, height * 0.5, width * 0.72);
    bg.addColorStop(0, '#162038');
    bg.addColorStop(0.55, '#0b1020');
    bg.addColorStop(1, '#05070e');
    g.fillStyle = bg;
    g.fillRect(0, 0, width, height);

    // Floor reflection glow under slab
    const fl = g.createRadialGradient(width * 0.5, height * 0.86, 10, width * 0.5, height * 0.86, width * 0.36);
    fl.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
    fl.addColorStop(1, 'rgba(56, 189, 248, 0)');
    g.fillStyle = fl;
    g.fillRect(0, height * 0.65, width, height * 0.35);

    g.drawImage(renderer.domElement, 0, 0, width, height);
  }

  frame(2.9, options);
  return { canvas, frame, period: PERIOD, hero: 2.9 };
}

// ============================================================================
// 3. canopy-part-title (lead, kind: motion, period: 5.6, hero: 2.75)
// Multi-depth veined botanical leaves sweep apart with progressive bokeh reveal
// ============================================================================
async function buildCanopyPartTitle(options = {}) {
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 5.6;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  // Pre-bake 3 reusable high-detail veined botanical frond sprites (sharp & soft-bokeh)
  function bakeLeafSprite(palette, sizeW, sizeH, blurPx, variant) {
    const c = document.createElement('canvas');
    c.width = sizeW;
    c.height = sizeH;
    const ctx = c.getContext('2d');
    ctx.save();
    if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
    ctx.translate(sizeW * 0.5, sizeH * 0.92);

    const len = sizeH * 0.80;
    const maxW = sizeW * 0.40;
    const lg = ctx.createLinearGradient(0, 0, 0, -len);
    lg.addColorStop(0, palette[0]);
    lg.addColorStop(0.55, palette[1]);
    lg.addColorStop(1, palette[2]);

    // Organic tapered botanical blade with scalloped lobes
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const steps = 28;
    for (let i = 1; i <= steps; i++) {
      const u = i / steps;
      const env = Math.sin(Math.pow(u, 0.72) * Math.PI);
      const lobe = variant === 0 ? 1 - 0.14 * Math.pow(Math.sin(u * Math.PI * 5), 2) : 1 + 0.06 * Math.sin(u * Math.PI * 7);
      const x = maxW * env * lobe;
      const y = -u * len;
      ctx.lineTo(x, y);
    }
    for (let i = steps - 1; i >= 0; i--) {
      const u = i / steps;
      const env = Math.sin(Math.pow(u, 0.72) * Math.PI);
      const lobe = variant === 0 ? 1 - 0.14 * Math.pow(Math.sin(u * Math.PI * 5), 2) : 1 + 0.06 * Math.sin(u * Math.PI * 7);
      const x = -maxW * env * lobe;
      const y = -u * len;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = lg;
    ctx.fill();

    // Sunlit specular edge rim
    ctx.strokeStyle = 'rgba(218, 245, 178, 0.28)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Central midrib + curved lateral veins
    ctx.strokeStyle = 'rgba(214, 242, 168, 0.36)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -len * 0.96);
    ctx.stroke();

    ctx.lineWidth = 1.6;
    for (let v = 1; v <= 9; v++) {
      const u = v / 10.5;
      const y0 = -u * len;
      const span = maxW * Math.sin(Math.pow(u, 0.72) * Math.PI) * 0.85;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.quadraticCurveTo(sgn * span * 0.45, y0 - len * 0.035, sgn * span, y0 - len * 0.09);
        ctx.stroke();
      }
    }
    ctx.restore();
    return c;
  }

  const sprites = [
    bakeLeafSprite(['#102e24', '#1d543e', '#488253'], 360, 560, 0, 0),
    bakeLeafSprite(['#0c241c', '#164231', '#386b45'], 360, 560, 3, 1),
    bakeLeafSprite(['#071712', '#103125', '#275234'], 380, 580, 9, 0),
  ];

  // Deterministic 14-frond canopy layout (left & right clusters across 3 depth planes)
  const fronds = [];
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const layer = i < 4 ? 0 : i < 10 ? 1 : 2; // 0=far sharp, 1=mid, 2=near bokeh
    const seed = i * 17.3 + 4.1;
    fronds.push({
      side,
      layer,
      sprite: sprites[layer],
      anchorX: side < 0 ? lerp(0.06, 0.34, hash1(seed)) : lerp(0.66, 0.94, hash1(seed)),
      anchorY: lerp(0.42, 1.08, hash1(seed + 1)),
      closedAngle: side * lerp(0.32, 0.95, hash1(seed + 2)),
      openShiftX: side * lerp(0.18, 0.28, hash1(seed + 3)) * (0.95 + layer * 0.16),
      openRot: side * lerp(0.34, 0.56, hash1(seed + 4)),
      scale: lerp(0.84, 1.24, hash1(seed + 5)) * (0.88 + layer * 0.16),
      delay: layer * 0.10 + hash1(seed + 6) * 0.12,
    });
  }

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const title = getCustomText(opts, 'SOLSTICE');
    const sc = width / 1280;

    // 4-phase parting choreography: closed -> spring part -> calm sunlit hold (hero=2.75) -> gentle close
    let open = 0;
    if (t < 0.45) open = 0;
    else if (t < 2.15) open = spring((t - 0.45) / 1.7, 0.72, 9.5);
    else if (t < 3.65) open = 1.0 + 0.025 * Math.sin(((t - 2.15) / 1.5) * Math.PI);
    else if (t < 5.25) open = 1.0 - inOutCubic((t - 3.65) / 1.6);
    else open = 0;

    // Warm sunlit conservatory backdrop
    const bg = g.createRadialGradient(width * 0.5, height * 0.42, 20 * sc, width * 0.5, height * 0.5, width * 0.72);
    bg.addColorStop(0, '#fbf6ea');
    bg.addColorStop(0.58, '#ede2cc');
    bg.addColorStop(1, '#c8b99c');
    g.fillStyle = bg;
    g.fillRect(0, 0, width, height);

    // Warm diagonal golden sunbeams filtering through the parting canopy
    g.save();
    g.globalCompositeOperation = 'screen';
    for (let b = 0; b < 3; b++) {
      const bx = width * (0.28 + b * 0.22) + Math.sin(t * 0.6 + b) * 28 * sc;
      const beam = g.createLinearGradient(bx - 80 * sc, 0, bx + 160 * sc, height);
      beam.addColorStop(0, `rgba(255, 241, 198, ${(0.22 * open).toFixed(3)})`);
      beam.addColorStop(1, 'rgba(255, 241, 198, 0)');
      g.fillStyle = beam;
      g.beginPath();
      g.moveTo(bx - 70 * sc, 0);
      g.lineTo(bx + 70 * sc, 0);
      g.lineTo(bx + 260 * sc, height);
      g.lineTo(bx + 40 * sc, height);
      g.closePath();
      g.fill();
    }
    g.restore();

    // Layer 0 (far foliage behind title)
    const drawLayer = (targetLayer) => {
      for (const f of fronds) {
        if (f.layer !== targetLayer) continue;
        const localOpen = clamp((open - f.delay * 0.45) / (1 - f.delay * 0.45), 0, 1.15);
        const breeze = Math.sin(t * 1.45 + f.delay * 12) * 0.035;
        const px = (f.anchorX + f.openShiftX * localOpen) * width;
        const py = f.anchorY * height;
        const rot = -f.closedAngle + f.openRot * localOpen + breeze;
        const sw = f.sprite.width * f.scale * sc;
        const sh = f.sprite.height * f.scale * sc;

        g.save();
        g.translate(px, py);
        g.rotate(rot);
        if (targetLayer >= 1) {
          g.shadowColor = 'rgba(12, 24, 18, 0.34)';
          g.shadowBlur = (18 + targetLayer * 10) * sc;
          g.shadowOffsetX = -f.side * 12 * sc;
          g.shadowOffsetY = 14 * sc;
        }
        g.drawImage(f.sprite, -sw * 0.5, -sh * 0.92, sw, sh);
        g.restore();
      }
    };

    drawLayer(0);

    // Focal sharp editorial serif title sitting cleanly in the parted clearing
    const titleReveal = smooth(0.18, 0.85, open);
    g.save();
    g.globalAlpha = lerp(0.35, 1.0, titleReveal);
    g.translate(width * 0.5, height * 0.5);
    const titleScale = lerp(0.92, 1.0, titleReveal);
    g.scale(titleScale, titleScale);

    g.fillStyle = '#5c6b54';
    g.font = `700 ${14 * sc}px ${MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('DEPTH-OF-FIELD CANOPY REVEAL  ·  F/1.4', 0, -82 * sc);

    let fSize = title.length > 14 ? 86 : title.length > 9 ? 116 : 148;
    g.font = `400 ${fSize * sc}px ${SERIF}`;
    while (g.measureText(title).width > width * 0.68 && fSize > 52) {
      fSize -= 6;
      g.font = `400 ${fSize * sc}px ${SERIF}`;
    }
    g.fillStyle = '#15251c';
    g.fillText(title, 0, -2 * sc);

    g.fillStyle = '#5b4d37';
    g.font = `500 italic ${26 * sc}px ${SERIF}`;
    g.fillText('Foreground occlusion clears into golden focus', 0, 74 * sc);
    g.restore();

    // Floating golden bokeh dust motes catching sunlight
    g.save();
    for (let i = 0; i < 28; i++) {
      const mx = (hash1(i * 3.7) + Math.sin(t * 0.4 + i) * 0.04) * width;
      const my = ((hash1(i * 9.1) - t * 0.035 + 1) % 1) * height;
      const r = (2.5 + hash1(i * 5.3) * 6.5) * sc;
      const a = (0.18 + 0.35 * Math.sin(t * 2.1 + i * 1.9) ** 2) * open;
      g.fillStyle = `rgba(255, 245, 206, ${a.toFixed(3)})`;
      g.beginPath();
      g.arc(mx, my, r, 0, TAU);
      g.fill();
    }
    g.restore();

    // Mid & near foreground bokeh fronds parting outward
    drawLayer(1);
    drawLayer(2);
  }

  frame(2.75, options);
  return { canvas, frame, period: PERIOD, hero: 2.75 };
}

// ============================================================================
// 4. device-flythrough (lead, kind: ui, period: 6.4, hero: 3.1)
// 3D Multi-device spatial UI flythrough (Desktop -> Tablet -> Phone + guide orb)
// ============================================================================
async function buildDeviceFlythrough(options = {}) {
  const THREE = await getThree();
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 6.4;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  // Helper to paint crisp procedural UI screens onto textures
  function makeScreenTex(w, h, drawFn) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const tex = setTexColorSpace(THREE, new THREE.CanvasTexture(c));
    return { canvas: c, ctx, tex, update: (t, word) => { drawFn(ctx, w, h, t, word); tex.needsUpdate = true; } };
  }

  const desktopScreen = makeScreenTex(960, 600, (ctx, w, h, t, word) => {
    ctx.fillStyle = '#0e1322';
    ctx.fillRect(0, 0, w, h);
    // Sidebar
    ctx.fillStyle = '#151c31';
    ctx.fillRect(0, 0, 210, h);
    ctx.fillStyle = '#38bdf8';
    ctx.font = `800 22px ${SANS}`;
    ctx.fillText(word || 'WORKSPACE', 26, 48);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i === 1 ? 'rgba(56,189,248,0.22)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(20, 88 + i * 54, 170, 38);
      ctx.fillStyle = i === 1 ? '#e0f2fe' : '#64748b';
      ctx.fillRect(36, 102 + i * 54, 90 + (i % 3) * 20, 10);
    }
    // Main KPI cards
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#172038';
      ctx.fillRect(244 + i * 228, 36, 206, 128);
      ctx.fillStyle = ['#38bdf8', '#a78bfa', '#34d399'][i];
      ctx.font = `900 42px ${MONO}`;
      const val = [98.4, 12.6, 4.2][i] + Math.sin(t * 2 + i) * 0.4;
      ctx.fillText(`${val.toFixed(1)}${['%', 'k', 'ms'][i]}`, 264 + i * 228, 108);
      ctx.fillStyle = '#94a3b8';
      ctx.font = `700 14px ${MONO}`;
      ctx.fillText(['SYNC RATE', 'ACTIVE NODES', 'LATENCY'][i], 264 + i * 228, 142);
    }
    // Live multi-bar chart
    ctx.fillStyle = '#151d33';
    ctx.fillRect(244, 192, 680, 368);
    for (let i = 0; i < 12; i++) {
      const bh = 80 + 170 * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.62 + t * 0.9)));
      const bg = ctx.createLinearGradient(0, 520 - bh, 0, 520);
      bg.addColorStop(0, '#38bdf8');
      bg.addColorStop(1, '#6366f1');
      ctx.fillStyle = bg;
      ctx.fillRect(284 + i * 51, 520 - bh, 32, bh);
    }
  });

  const tabletScreen = makeScreenTex(720, 540, (ctx, w, h, t, word) => {
    ctx.fillStyle = '#f8f7f3';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.font = `900 32px ${SANS}`;
    ctx.fillText(`${word || 'STUDIO'} · BOARD`, 42, 68);
    // 3 collaborative colored cards
    const cols = ['#3b82f6', '#ec4899', '#10b981'];
    for (let i = 0; i < 3; i++) {
      const yOff = Math.sin(t * 1.8 + i * 1.1) * 8;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(42 + i * 218, 118 + yOff, 198, 250);
      ctx.fillStyle = cols[i];
      ctx.fillRect(42 + i * 218, 118 + yOff, 198, 92);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(60 + i * 218, 238 + yOff, 132, 14);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(60 + i * 218, 268 + yOff, 152, 10);
      ctx.fillRect(60 + i * 218, 290 + yOff, 118, 10);
    }
    // Live curved sync progress bar
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(42, 434, 636, 22);
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(42, 434, 636 * (0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.2))), 22);
  });

  const phoneScreen = makeScreenTex(420, 780, (ctx, w, h, t, word) => {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#12182b');
    bg.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // Dynamic island pill
    ctx.fillStyle = '#020617';
    ctx.fillRect(145, 22, 130, 28);
    ctx.fillStyle = '#f8fafc';
    ctx.font = `900 44px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText(word || 'SYNCED', 210, 150);
    ctx.fillStyle = '#93c5fd';
    ctx.font = `700 18px ${MONO}`;
    ctx.fillText('LIVE HANDOFF READY', 210, 194);
    // Pulsing approval circle
    const pulse = 1 + 0.08 * Math.sin(t * 3.5);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(210, 385, 92 * pulse, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(166, 388);
    ctx.lineTo(198, 418);
    ctx.lineTo(258, 352);
    ctx.stroke();
    // Action button
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(54, 620, 312, 74);
    ctx.fillStyle = '#082f49';
    ctx.font = `800 24px ${SANS}`;
    ctx.fillText('APPROVE & SHIP', 210, 666);
    ctx.textAlign = 'left';
  });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
  scene.add(new THREE.AmbientLight(0xb8c8e8, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(6, 7, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x38bdf8, 1.6);
  rim.position.set(-7, 3, 2);
  scene.add(rim);

  function buildDeviceMesh(dw, dh, depth, radius, screenObj) {
    const grp = new THREE.Group();
    const shape = makeRoundedRectShape(THREE, dw, dh, radius);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 });
    geo.center();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x263147, metalness: 0.82, roughness: 0.25 });
    grp.add(new THREE.Mesh(geo, frameMat));
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(dw - 0.16, dh - 0.16),
      new THREE.MeshBasicMaterial({ map: screenObj.tex })
    );
    face.position.z = depth * 0.5 + 0.045;
    grp.add(face);
    return grp;
  }

  const desktop = buildDeviceMesh(4.4, 2.75, 0.14, 0.14, desktopScreen);
  desktop.position.set(-3.1, 0.35, -2.4);
  desktop.rotation.set(0.05, 0.38, 0);

  const tablet = buildDeviceMesh(2.9, 2.18, 0.11, 0.14, tabletScreen);
  tablet.position.set(0.2, -0.05, 0.2);
  tablet.rotation.set(-0.04, -0.14, 0.02);

  const phone = buildDeviceMesh(1.38, 2.55, 0.10, 0.16, phoneScreen);
  phone.position.set(3.15, 0.15, 2.2);
  phone.rotation.set(0.04, -0.44, -0.03);

  scene.add(desktop, tablet, phone);

  // Connecting 3D luminous Catmull-Rom ribbon + specular guide orb
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.2, 0.9, -2.8),
    new THREE.Vector3(-2.6, 0.55, -1.6),
    new THREE.Vector3(-0.7, 0.95, -0.5),
    new THREE.Vector3(0.45, 0.15, 0.9),
    new THREE.Vector3(2.0, -0.45, 1.8),
    new THREE.Vector3(3.15, 0.35, 2.8),
  ]);
  const tubeGeo = new THREE.TubeGeometry(curve, 80, 0.032, 10, false);
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.75, roughness: 0.2 });
  scene.add(new THREE.Mesh(tubeGeo, tubeMat));

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 24, 24),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7dd3fc, emissiveIntensity: 1.4, metalness: 0.2, roughness: 0.1 })
  );
  scene.add(orb);

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const u = t / PERIOD;
    const ph = u * TAU;
    const word = getCustomText(opts, '');

    desktopScreen.update(t, word);
    tabletScreen.update(t, word);
    phoneScreen.update(t, word);

    // Subtle floating hover on each device
    desktop.position.y = 0.35 + Math.sin(ph) * 0.10;
    tablet.position.y = -0.05 + Math.sin(ph + 1.4) * 0.11;
    phone.position.y = 0.15 + Math.sin(ph + 2.8) * 0.10;

    // Guide orb glides back & forth seamlessly along the device chain
    const orbU = 0.5 - 0.5 * Math.cos(ph);
    const orbPos = curve.getPointAt(clamp(orbU, 0.02, 0.98));
    orb.position.copy(orbPos);

    // Camera glides smoothly across the 3-device constellation (Desktop -> Tablet -> Phone -> Overview)
    const camX = lerp(-2.4, 2.4, 0.5 - 0.5 * Math.cos(ph));
    const camY = 0.65 + Math.sin(ph) * 0.35;
    const camZ = 8.4 + Math.cos(ph * 2) * 0.85;
    camera.position.set(camX, camY, camZ);
    camera.lookAt(camX * 0.38, 0.05, lerp(-0.8, 0.9, 0.5 - 0.5 * Math.cos(ph)));

    const renderer = getSharedRenderer(THREE, width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);

    const bg = g.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#0a0f1f');
    bg.addColorStop(0.5, '#131932');
    bg.addColorStop(1, '#0b1121');
    g.fillStyle = bg;
    g.fillRect(0, 0, width, height);

    // Soft atmospheric radial glow behind the active device zone
    const gx = lerp(width * 0.28, width * 0.72, orbU);
    const rg = g.createRadialGradient(gx, height * 0.48, 20, gx, height * 0.48, width * 0.45);
    rg.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
    rg.addColorStop(0.6, 'rgba(129, 140, 248, 0.10)');
    rg.addColorStop(1, 'rgba(10, 15, 31, 0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, width, height);

    g.drawImage(renderer.domElement, 0, 0, width, height);
  }

  frame(3.1, options);
  return { canvas, frame, period: PERIOD, hero: 3.1 };
}

export async function create(id, options = {}) {
  if (id === 'wireframe-portal') return buildWireframePortal(options);
  if (id === 'code-3d-extrude') return buildCode3DExtrude(options);
  if (id === 'canopy-part-title') return buildCanopyPartTitle(options);
  if (id === 'device-flythrough') return buildDeviceFlythrough(options);
  throw new Error(`Unknown spatial effect id: ${id}`);
}
