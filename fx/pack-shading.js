// Motion FX Lab: the Character shading family. One original 3D explorer robot, built here from
// rounded primitives, performs one choreography in every variant:
//   anticipation (0–0.6 s)   crouches with its back to the camera, lit from behind;
//   impact (0.6–1.6 s)       jumps, turns 180° in the air to face the camera, lands with a squash
//                            and a ring of dust;
//   follow-through (1.6–4.5 s) holds a hero pose while the key light orbits 160° around it, so
//                            the style's bands, dots or dither cells sweep across the body;
//   reset (4.5–5 s)          turns to follow the light round the back, which closes the loop.
// The variants change only how light becomes ink: toon bands with an inverted-hull outline,
// a two-colour halftone print, or a two-ink ordered dither. Outline width, dot pitch and dither
// cell all scale with the render height, so a 1280 × 720 film and a gallery tile match.
// Every frame is a pure function of t. Needs fx/demos.js (FX) and fx/pack-dither.js (FX.dither).
(() => {
  if (!window.FX || !window.THREE) return;
  const { demo, GW, GH, glTile, helpers: { clamp, lin, smooth, inOut } } = window.FX;
  const R3 = window.FX.R3;
  const PERIOD = 5, DEG = Math.PI / 180;

  // ---------- geometry: smooth closed shapes, so inverted-hull outlines have no gaps ----------
  // A box with rounded edges. Half of each axis's segments go to the rounded band, and the
  // normals are exact, so coincident edge vertices share a normal. r = half width gives a capsule.
  function roundBox(w, h, d, r, seg = 14) {
    const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg), half = [w / 2, h / 2, d / 2];
    r = Math.min(r, ...half) * 0.999;
    const pos = g.attributes.position, nor = g.attributes.normal, a = [0, 0, 0], c = [0, 0, 0];
    for (let i = 0; i < pos.count; i++) {
      a[0] = pos.getX(i); a[1] = pos.getY(i); a[2] = pos.getZ(i);
      for (let k = 0; k < 3; k++) {
        const hh = half[k], s = Math.abs(a[k]) / hh, inner = (hh - r) / hh;
        a[k] = Math.sign(a[k]) * hh * (s <= 0.5 ? (s / 0.5) * inner : inner + ((s - 0.5) / 0.5) * (1 - inner));
        c[k] = clamp(a[k], -(hh - r), hh - r);
      }
      let nx = a[0] - c[0], ny = a[1] - c[1], nz = a[2] - c[2];
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      pos.setXYZ(i, c[0] + nx * r, c[1] + ny * r, c[2] + nz * r); nor.setXYZ(i, nx, ny, nz);
    }
    return g;
  }
  // A disc around +y with a rounded rim; `dome` bulges the top face (a lens or a turntable).
  function puck(R, H, r, dome = 0, seg = 48) {
    const p = [new THREE.Vector2(0, -H / 2)];
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); p.push(new THREE.Vector2(R - r + r * Math.cos(a), -H / 2 + r + r * Math.sin(a))); }
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); p.push(new THREE.Vector2(R - r + r * Math.cos(a), H / 2 - r + r * Math.sin(a))); }
    for (let i = 1; i <= 8; i++) { const x = (R - r) * (1 - i / 8); p.push(new THREE.Vector2(Math.max(x, 0), H / 2 + dome * (1 - (x / (R - r)) ** 2))); }
    const g = new THREE.LatheGeometry(p, seg);
    g.computeVertexNormals();
    return g;
  }
  const sphere = (r, w = 40, h = 28) => new THREE.SphereGeometry(r, w, h);

  // ---------- shading: one material source, three outputs ----------
  // MODE 0 writes toon colour. MODE 1 writes halftone inks (r = black, g = red, b = solid line).
  // MODE 2 writes a dither tone (r: 0 paper, 0.5 ink A, 1 ink B; g = solid line).
  const VERT = `varying vec3 vN; varying vec3 vP; varying vec3 vW;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; vN = normalize(normalMatrix * normal);
      vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * mv; }`;
  const FRAG = `uniform vec3 uL; uniform vec3 uAlb; uniform float uEmit; uniform float uGloss; uniform float uK; uniform float uR;
    uniform float uT0; uniform float uT1; uniform float uPool; uniform float uShade; uniform float uRimOn;
    varying vec3 vN; varying vec3 vP; varying vec3 vW;
    float crisp(float edge, float x){ float w = fwidth(x) * 0.75 + 1e-4; return smoothstep(edge - w, edge + w, x); }
    void main(){
      vec3 N = normalize(vN), V = normalize(-vP);
      float ndl = dot(N, uL), fr = 1.0 - clamp(dot(N, V), 0.0, 1.0);
      // rim: a kicker opposite the key lights the edges of the shadow side, and every edge when backlit
      float back = clamp(dot(-V, uL) * 0.8 + 0.2, 0.0, 1.0), kick = clamp(0.35 - ndl * 2.0, 0.0, 1.0);
      float rim = crisp(0.62, fr * mix(kick, 1.0, back)) * uRimOn * (1.0 - uEmit);
      float spec = crisp(0.982, dot(N, normalize(uL + V))) * uGloss * (1.0 - uEmit);
    #if MODE == 0
      vec3 c = mix(uAlb * vec3(0.34, 0.42, 0.78), uAlb * vec3(0.72, 0.78, 0.96), crisp(-0.04, ndl));
      c = mix(c, uAlb * vec3(1.06, 1.01, 0.9), crisp(0.42, ndl));
      c = mix(c, vec3(0.86, 0.97, 1.0), rim * 0.9);
      c = mix(c, vec3(1.0), spec * 0.9);
      gl_FragColor = vec4(mix(c, uAlb, uEmit), 1.0);
    #elif MODE == 1
      float s = smoothstep(-0.5, 0.85, ndl);
      float k = uK + (1.0 - s) * 0.62 * uShade * (1.0 - uK), r = uR * (0.7 + 0.3 * (1.0 - s));
      k *= (1.0 - rim) * (1.0 - spec); r *= (1.0 - rim) * (1.0 - spec);
      gl_FragColor = vec4(mix(k, uK, uEmit), mix(r, uR, uEmit), 0.0, 1.0);
    #else
      float s = smoothstep(-0.3, 0.7, ndl);
      float pool = mix(1.0, 1.0 - smoothstep(0.15, 1.0, length(vW.xz) / 3.0), uPool);
      float T = mix(uT0, uT1, s) * pool;
      T = max(T, rim * 0.98); T = max(T, spec);
      gl_FragColor = vec4(mix(T, uT1, uEmit), 0.0, 0.0, 1.0);
    #endif
    }`;
  // Inverted hull: back faces pushed out along the screen-space normal by uPx target pixels.
  const HULL_VERT = `uniform float uPx; uniform vec2 uRes;
    void main(){
      vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      vec2 d = vec2(projectionMatrix[0][0] * n.x * uRes.x, projectionMatrix[1][1] * n.y * uRes.y);
      float l = length(d); d = l > 1e-6 ? d / l : vec2(0.0);
      clip.xy += d * uPx * 2.0 / uRes * clip.w;
      gl_Position = clip; }`;
  const FLAT_VERT = 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const flatFrag = (v) => `void main(){ gl_FragColor = vec4(${v.map((x) => x.toFixed(4)).join(', ')}); }`;
  const lum = (c) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;

  // A style knows how to paint a part (robot, table or dust), its outline and its cast shadow.
  function makeStyle(mode, shared, { line, shadow }) {
    return {
      part(hex, o = {}) {
        const col = new THREE.Color(hex), L = lum(col), red = clamp((col.r - Math.max(col.g, col.b)) * 1.7);
        return new THREE.ShaderMaterial({
          defines: { MODE: mode }, extensions: { derivatives: true }, vertexShader: VERT, fragmentShader: FRAG,
          uniforms: { uL: shared.uL, uAlb: { value: col }, uEmit: { value: o.emit || 0 }, uGloss: { value: o.gloss ?? 0.5 },
            uK: { value: o.k ?? clamp((1 - L) * (1 - red * 0.85)) }, uR: { value: o.r ?? red }, uT0: { value: o.t0 ?? 0.06 + 0.26 * L }, uT1: { value: o.t1 ?? 0.22 + 0.78 * L },
            uPool: { value: o.pool ? 1 : 0 }, uShade: { value: o.shade ?? 1 }, uRimOn: { value: o.rim ?? 1 } },
        });
      },
      hull: new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: HULL_VERT, fragmentShader: flatFrag(line), uniforms: { uPx: shared.uPx, uRes: shared.uRes } }),
      // Shadows draw only where the table top left stencil 1 and bump it to 2, so overlapping parts
      // never darken twice; uShadow lifts the shadow off the table while the robot is in the air.
      shadow: new THREE.ShaderMaterial({ side: THREE.DoubleSide, depthWrite: false, transparent: true, uniforms: { uShadow: shared.uShadow }, vertexShader: FLAT_VERT,
        fragmentShader: `uniform float uShadow; void main(){ gl_FragColor = vec4(${shadow.slice(0, 3).map((x) => x.toFixed(4)).join(', ')}, uShadow); }`,
        stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.IncrementStencilOp }),
    };
  }

  // ---------- the explorer robot ----------
  const COL = { cream: 0xf3e4c8, teal: 0x3d8e98, dark: 0x3c3f55, gold: 0xf0a63a, scarf: 0xff5a4b, visor: 0x1c2342, eye: 0x9af7ff, amber: 0xffb238 };
  const PELVIS_Y = 1.005, LEG = 0.69, EYE = { emit: 1, k: 0, r: 0, t1: 1 };
  function buildRobot(style) {
    const parts = [];
    const mk = (geo, hex, parent, o = {}) => {
      const m = new THREE.Mesh(geo, style.part(hex, o)); m.frustumCulled = false; parent.add(m);
      if (o.hull !== false) { const h = new THREE.Mesh(geo, style.hull); h.frustumCulled = false; m.add(h); }
      if (o.shadow !== false) parts.push(m);
      return m;
    };
    const G = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
    const root = new THREE.Group();
    const pelvis = G(root, 0, PELVIS_Y, 0);
    mk(roundBox(0.84, 0.38, 0.62, 0.18), COL.teal, pelvis).position.y = 0.03;
    const belt = mk(new THREE.TorusGeometry(0.44, 0.075, 16, 48), COL.cream, pelvis); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.74, 1); belt.position.y = 0.22;
    mk(roundBox(0.22, 0.15, 0.1, 0.045), COL.gold, pelvis, { gloss: 1 }).position.set(0, 0.22, 0.33);
    const legs = [-1, 1].map((sx) => {
      const hip = G(pelvis, 0.25 * sx, 0, 0);
      mk(roundBox(0.3, 0.42, 0.3, 0.15), COL.teal, hip).position.y = -0.18;
      const knee = G(hip, 0, -0.36, 0);
      mk(sphere(0.165), COL.cream, knee).position.set(0, 0, 0.07);
      mk(roundBox(0.32, 0.36, 0.32, 0.16), COL.cream, knee).position.y = -0.17;
      const ankle = G(knee, 0, -0.33, 0);
      mk(roundBox(0.47, 0.32, 0.66, 0.15), COL.cream, ankle).position.set(0, -0.12, 0.08);
      mk(roundBox(0.49, 0.11, 0.68, 0.055), COL.teal, ankle, { hull: false }).position.set(0, -0.05, 0.08);
      mk(roundBox(0.51, 0.11, 0.72, 0.05), COL.dark, ankle).position.set(0, -0.26, 0.08);
      return { sx, hip, knee, ankle };
    });
    const spine = G(pelvis, 0, 0.22, 0);
    mk(roundBox(1.12, 0.94, 0.84, 0.34), COL.teal, spine).position.y = 0.46;
    mk(roundBox(0.74, 0.5, 0.2, 0.09), COL.cream, spine).position.set(0, 0.5, 0.37);
    mk(roundBox(0.28, 0.1, 0.08, 0.04), COL.amber, spine, { emit: 1, hull: false }).position.set(0, 0.57, 0.48);
    [-1, 1].forEach((sx) => mk(sphere(0.045, 12, 8), COL.gold, spine, { hull: false, shadow: false, gloss: 1 }).position.set(0.25 * sx, 0.36, 0.47));
    mk(roundBox(0.8, 0.72, 0.36, 0.14), COL.cream, spine).position.set(0, 0.5, -0.5);
    mk(roundBox(0.84, 0.24, 0.4, 0.09), COL.teal, spine).position.set(0, 0.78, -0.5);
    [-1, 1].forEach((sx) => mk(sphere(0.06, 16, 12), COL.gold, spine, { hull: false, gloss: 1 }).position.set(0.22 * sx, 0.4, -0.69));
    const arms = [-1, 1].map((sx) => {
      const shoulder = G(spine, 0.64 * sx, 0.74, 0);
      mk(sphere(0.25), COL.cream, shoulder).scale.set(1, 0.86, 1);
      mk(roundBox(0.24, 0.42, 0.24, 0.12), COL.teal, shoulder).position.y = -0.2;
      const elbow = G(shoulder, 0, -0.38, 0);
      mk(roundBox(0.3, 0.36, 0.3, 0.15), COL.cream, elbow).position.y = -0.15;
      const hand = mk(sphere(0.175), COL.dark, elbow); hand.position.y = -0.41; hand.scale.set(1, 0.95, 1.05);
      mk(sphere(0.075, 16, 12), COL.dark, elbow).position.set(-0.11 * sx, -0.33, 0.1);
      return { sx, shoulder, elbow };
    });
    const neck = G(spine, 0, 0.93, 0);
    mk(roundBox(0.36, 0.22, 0.36, 0.17), COL.dark, neck, { shadow: false }).position.y = 0.04;
    const scarf = mk(new THREE.TorusGeometry(0.38, 0.135, 18, 48), COL.scarf, neck); scarf.rotation.x = Math.PI / 2 + 0.12; scarf.scale.set(1.05, 0.92, 1); scarf.position.y = 0.05;
    const tail = G(neck, 0.24, -0.02, 0.27);
    mk(roundBox(0.25, 0.44, 0.1, 0.05), COL.scarf, tail).position.y = -0.2;
    const tail2 = G(tail, 0, -0.4, 0);
    mk(roundBox(0.23, 0.34, 0.09, 0.045), COL.scarf, tail2).position.y = -0.15;
    const head = G(neck, 0, 0.18, 0);
    const skull = G(head, 0, 0.82, 0);
    mk(sphere(0.9, 64, 44), COL.cream, skull, { gloss: 0.8 });
    // a raised band from the brow over the crown to the back (arc −25°…140° in the y–z plane)
    const crest = mk(new THREE.TorusGeometry(0.93, 0.11, 16, 64, 2.88), COL.teal, skull);
    crest.rotation.set(0, Math.PI / 2, -0.436); crest.scale.set(1, 1, 2.1);
    const lens = mk(puck(0.6, 0.26, 0.09, 0.15), COL.visor, skull, { gloss: 1, t0: 0, t1: 0.12 }); lens.rotation.x = Math.PI / 2; lens.scale.set(1, 1, 0.8); lens.position.set(0, -0.06, 0.72);
    const eyes = [-1, 1].map((sx) => {
      const e = mk(roundBox(0.18, 0.27, 0.07, 0.075), COL.eye, skull, { ...EYE, hull: false, shadow: false }); e.position.set(0.21 * sx, -0.03, 1.0); e.rotation.y = 0.2 * sx;
      return e;
    });
    const happy = [-1, 1].map((sx) => {
      const e = mk(new THREE.TorusGeometry(0.09, 0.034, 8, 20, Math.PI), COL.eye, skull, { ...EYE, hull: false, shadow: false }); e.position.set(0.21 * sx, -0.07, 1.0); e.rotation.y = 0.2 * sx;
      return e;
    });
    [-1, 1].forEach((sx) => {
      const ear = mk(puck(0.28, 0.22, 0.07), COL.teal, skull); ear.rotation.z = -Math.PI / 2 * sx; ear.position.set(0.86 * sx, -0.02, 0);
      const rim = mk(new THREE.TorusGeometry(0.2, 0.04, 10, 32), COL.gold, skull, { gloss: 1, hull: false, shadow: false }); rim.rotation.y = Math.PI / 2; rim.position.set(0.98 * sx, -0.02, 0);
      const cap = mk(puck(0.12, 0.06, 0.025), COL.cream, skull, { hull: false, shadow: false }); cap.rotation.z = -Math.PI / 2 * sx; cap.position.set(0.985 * sx, -0.02, 0);
    });
    const antenna = G(skull, 0.93, 0.12, -0.05);
    mk(roundBox(0.065, 0.56, 0.065, 0.032), COL.dark, antenna).position.y = 0.28;
    mk(sphere(0.085, 20, 14), COL.amber, antenna, { emit: 1 }).position.y = 0.58;
    return { root, pelvis, spine, legs, arms, neck, head, tail, tail2, eyes, happy, antenna, parts };
  }

  // ---------- choreography: one function of t shared by every variant ----------
  const TAKEOFF = 0.62, LAND = 1.25;
  // Key-light azimuth in degrees (0 = from the camera, −90 = from screen left): it eases from −80°
  // at 1.6 s to +80° at 4.5 s, lingering on the side-lit ends, then eases 200° round the back.
  const W = (2 * Math.PI) / PERIOD, ease = (x) => x * x * (3 - 2 * x);
  const lightAz = (t) => t >= 1.6 && t <= 4.5 ? -80 + 160 * ease(lin(1.6, 4.5, t)) : 80 + 200 * ease(lin(4.5, 6.6, t < 1.6 ? t + PERIOD : t));
  const ELEV = 34 * DEG;
  const mix = (a, b, k) => a + (b - a) * k;
  const mixPose = (a, b, k) => a.map((v, i) => mix(v, b[i], k));
  function pose(t) {
    const crouch = inOut(lin(0.04, 0.58, t)) * (1 - smooth(0.58, 0.68, t));
    const air = lin(TAKEOFF, LAND, t), inAir = t > TAKEOFF && t < LAND, tuck = inAir ? Math.sin(Math.PI * air) : 0;
    const u = t - LAND, land = u > 0 ? Math.exp(-u * 7) * Math.sin(u * 20) : 0, settle = u > 0 ? Math.exp(-u * 4) : 0;
    const hero = smooth(1.36, 1.8, t) * (1 - smooth(4.36, 4.74, t));
    const stretch = Math.exp(-(((t - 0.67) / 0.06) ** 2));
    return {
      t, crouch, tuck, land, settle, hero, az: lightAz(t),
      y: (inAir ? 3.3 * air * (1 - air) : 0) + 0.16 * Math.sin(Math.PI * lin(4.52, 4.92, t)),
      yaw: Math.PI * (1 - inOut(lin(0.66, 1.18, t))) + Math.PI * inOut(lin(4.5, 4.96, t)),
      sy: 1 - 0.08 * crouch + 0.1 * stretch - 0.34 * land + 0.015 * Math.sin(t * W * 4) * hero,
      drop: 0.3 * crouch + 0.22 * Math.max(0, land) + 0.05 * settle,
    };
  }
  function applyPose(R, p) {
    const { t, crouch, tuck, land, hero } = p;
    R.root.position.y = p.y; R.root.rotation.y = p.yaw;
    const sxz = 1 / Math.sqrt(p.sy); R.root.scale.set(sxz, p.sy, sxz);
    R.pelvis.position.y = PELVIS_Y - p.drop;
    const a = Math.acos(clamp(1 - p.drop / LEG, -1, 1));
    for (const L of R.legs) {
      const spread = (0.1 * hero + 0.08 * tuck) * L.sx;
      L.hip.rotation.set(-a - 1.05 * tuck, 0, spread);
      L.knee.rotation.set(2 * a + 1.55 * tuck, 0, 0);
      L.ankle.rotation.set(-a - 0.45 * tuck, 0, -spread);
    }
    R.spine.rotation.set(0.32 * crouch + 0.12 * Math.max(0, land) - 0.07 * hero - 0.14 * tuck, 0, 0.03 * hero);
    const look = clamp(p.az * DEG * 0.45, -0.5, 0.5) * hero;
    R.head.rotation.set(0.14 * crouch - 0.1 * hero + 0.16 * Math.max(0, land) + 0.08 * tuck, look, -0.09 * hero);
    // Arm poses [shoulder x, shoulder z, elbow x, elbow z], blended by priority.
    const airW = smooth(0.6, 0.76, t) * (1 - smooth(1.18, 1.34, t)), landW = smooth(1.18, 1.3, t) * (1 - smooth(1.6, 2.0, t));
    const pump = t > 1.7 ? 0.28 * Math.sin((t - 1.7) * 13) * Math.exp(-(t - 1.7) * 2.6) : 0;
    for (const A of R.arms) {
      const s = A.sx;
      let v = [0, 0.12 * s, -0.15, 0];
      v = mixPose(v, [0.95, 0.22 * s, -0.35, 0], crouch);
      v = mixPose(v, [-1.45, 1.1 * s, -0.35, 0], airW);
      v = mixPose(v, [-0.25, 0.9 * s, -0.55, 0], landW);
      v = mixPose(v, s < 0 ? [-0.25, -2.5, -0.55 - pump, 0] : [0.1, 0.78, 0.05, -1.42], hero);
      A.shoulder.rotation.set(v[0], 0, v[1]); A.elbow.rotation.set(v[2], 0, v[3]);
    }
    const blink = (t > 0.3 && t < 0.42) || (t > 3.2 && t < 3.33);
    const joy = t > 1.27 && t < 1.95;
    R.eyes.forEach((e) => { e.visible = !joy; e.scale.set(1, blink ? 0.14 : 1, 1); });
    R.happy.forEach((e) => { e.visible = joy; });
    const flap = Math.sin(t * 23) * 0.22 * tuck;
    R.tail.rotation.set(-0.42 + 1.5 * tuck - 0.5 * land + 0.32 * crouch - 0.06 * Math.sin(t * 3.1) + flap, 0, 0.18 + 0.4 * tuck);
    R.tail2.rotation.set(0.25 + 0.5 * tuck - 0.5 * land - 0.08 * Math.sin(t * 3.1 - 0.9) + Math.sin(t * 23 - 1.3) * 0.35 * tuck, 0, 0);
    R.antenna.rotation.set(0, 0, -0.18 * crouch + 0.5 * land + 0.22 * tuck * Math.sin(t * 31));
  }

  // ---------- one scene per tile ----------
  const PUFFS = 18, PUFF_LIFE = 0.62;
  const FLOOR = { k: 0, r: 0, shade: 0, t0: 0, t1: 0.42 };
  function stage(mode, opts) {
    const shared = { uL: { value: new THREE.Vector3(0, 0, 1) }, uPx: { value: 2 }, uRes: { value: new THREE.Vector2(GW, GH) }, uShadow: { value: 1 } };
    const style = makeStyle(mode, shared, opts);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(28, GW / GH, 0.1, 100);
    const robot = buildRobot(style); scene.add(robot.root);
    // turntable: the top disc writes stencil 1, so projected shadows stay on it
    const table = new THREE.Mesh(puck(2.7, 0.24, 0.08, 0, 128), style.part(opts.floor, { ...FLOOR, gloss: 0, rim: 0, pool: true }));
    table.position.y = -0.122; table.frustumCulled = false; scene.add(table);
    const tableHull = new THREE.Mesh(table.geometry, style.hull); table.add(tableHull);
    const top = new THREE.Mesh(new THREE.CircleGeometry(2.63, 96), style.part(opts.floor, { ...FLOOR, gloss: 0, rim: 0, pool: true }));
    top.material.stencilWrite = true; top.material.stencilRef = 1; top.material.stencilFunc = THREE.AlwaysStencilFunc; top.material.stencilZPass = THREE.ReplaceStencilOp;
    top.rotation.x = -Math.PI / 2; top.position.y = 0.0005; top.renderOrder = -2; scene.add(top);
    const shadows = robot.parts.map((src) => {
      const m = new THREE.Mesh(src.geometry, style.shadow); m.matrixAutoUpdate = false; m.frustumCulled = false; m.renderOrder = -1; scene.add(m);
      return { m, src };
    });
    const puffs = Array.from({ length: PUFFS }, (_, i) => {
      const m = new THREE.Mesh(sphere(1, 20, 14), style.part(COL.cream, { gloss: 0, shade: 0.55 })); m.frustumCulled = false;
      m.add(new THREE.Mesh(m.geometry, style.hull)); scene.add(m);
      return { m, a: (i / PUFFS) * Math.PI * 2 + 0.2, k: 0.8 + 0.3 * ((i * 7) % 5) / 4, lift: (i * 5) % 3 };
    });
    const S = new THREE.Matrix4(), Ld = new THREE.Vector3();
    function update(t, target) {
      const p = pose(t);
      applyPose(robot, p);
      // camera: follows the jump a little and pushes in during the light sweep
      const push = 0.45 * smooth(1.5, 4.3, t) * (1 - smooth(4.3, 5, t));
      cam.position.set(0, 2.62 + 0.38 * p.y, 12.4 - push); cam.lookAt(0, 2.02 + 0.38 * p.y, 0);
      cam.updateMatrixWorld();
      const az = p.az * DEG;
      Ld.set(Math.sin(az) * Math.cos(ELEV), Math.sin(ELEV), Math.cos(az) * Math.cos(ELEV));
      shared.uL.value.copy(Ld).transformDirection(cam.matrixWorldInverse);
      shared.uRes.value.set(target.w, target.h); shared.uPx.value = target.px; shared.uShadow.value = 1 - smooth(0.04, 0.4, p.y);
      // dust ring: puffs spread from the landing point and fade
      const u = t - LAND;
      for (const f of puffs) {
        const k = u / (PUFF_LIFE * f.k), on = k > 0 && k < 1;
        f.m.visible = on; if (!on) continue;
        const r = 0.6 + 1.7 * (1 - (1 - k) ** 3), s = 0.23 * f.k * Math.sin(Math.PI * Math.pow(k, 0.5));
        f.m.position.set(Math.cos(f.a) * r, 0.08 + (0.22 + 0.12 * f.lift) * k, Math.sin(f.a) * r * 0.9);
        f.m.scale.set(s * 1.25, s * 0.8, s * 1.25);
      }
      // planar shadows on the table top (y = 0.004) along the key light
      scene.updateMatrixWorld(true);
      const y0 = 0.004, { x: lx, y: ly, z: lz } = Ld;
      S.set(ly, -lx, 0, lx * y0, 0, 0, 0, ly * y0, 0, -lz, ly, lz * y0, 0, 0, 0, ly);
      for (const s of shadows) s.m.matrix.multiplyMatrices(S, s.src.matrixWorld);
    }
    return { scene, cam, update };
  }
  const quad = (mat) => { const s = new THREE.Scene(); s.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)); return s; };
  const QCAM = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---------- variants ----------
  const SHARED = { kind: "character", period: PERIOD };
  const CHIPS = ["rounded primitives, no image assets", "orbiting key light", "projected shadow"];

  demo({ ...SHARED, id: "toon", gl: true, grade: "B", stacks: ["three", "glsl"],
    name: "Toon bands + outline",
    chips: ["three-band toon ramp + rim light", "inverted-hull outline sized to the render", ...CHIPS],
    purpose: "Three crisp light bands, a rim light and an inverted-hull outline 2.6 px wide at 1280 × 720 (scaled with the render). As the key light circles the robot, the band edges slide across its helmet and suit.",
    hero: 2.3,
    build(s) {
      s.style.background = "#2bb3f3";
      const blit = glTile(s), st = stage(0, { line: [0.08, 0.1, 0.2, 1], shadow: [0.36, 0.55, 0.78, 1], floor: 0xd6f3ff });
      const px = Math.max(1.2, (2.6 * GH) / 720);
      return (t) => {
        st.update(t, { w: GW, h: GH, px });
        R3.setRenderTarget(null); R3.setClearColor(0x2bb3f3, 1); R3.render(st.scene, st.cam); blit();
      };
    } });

  demo({ ...SHARED, id: "halftone", gl: true, grade: "B", stacks: ["three", "glsl"],
    name: "Two-colour halftone print",
    chips: ["black screen 45° + red screen 15°", "dot pitch 16 px at 720 px high", "solid ink outline", ...CHIPS],
    purpose: "Light becomes ink on newsprint: black dots for shade, red spot-colour dots for the scarf and the sun, both on angled screens. The dots grow and shrink as the light moves round.",
    hero: 2.6,
    build(s) {
      s.style.background = "#efe3c9";
      const blit = glTile(s), st = stage(1, { line: [0, 0, 1, 1], shadow: [0.6, 0, 0, 1], floor: 0xf6eedc });
      const rt = new THREE.WebGLRenderTarget(GW, GH, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, stencilBuffer: true });
      const pitch = (16 * GH) / 720;   // a 30 % dot has radius ≈ 6·H/720
      const mat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
        uniforms: { tInk: { value: rt.texture }, uRes: { value: new THREE.Vector2(GW, GH) }, uPitch: { value: pitch }, uMis: { value: pitch * 0.14 } },
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader: `uniform sampler2D tInk; uniform vec2 uRes; uniform float uPitch; uniform float uMis; varying vec2 vUv;
          float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
          // Amplitude screen in the mid tones; below 30 % ink a seeded share of cells keeps a
          // minimum-size dot instead, so no printed dot shrinks to sub-pixel noise.
          float dotScreen(vec2 px, float ang, float dens){
            vec2 q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * px, cell = floor(q / uPitch);
            dens = clamp(dens, 0.0, 1.0);
            if (dens < 0.3) dens = h21(cell + ang * 31.0) < dens / 0.3 ? 0.3 : 0.0;
            float d = length(q - (cell + 0.5) * uPitch), r = uPitch * 0.72 * sqrt(dens);
            return dens > 0.0 ? 1.0 - smoothstep(r - 0.75, r + 0.75, d) : 0.0;
          }
          void main(){
            vec2 px = vUv * uRes, off = vec2(uMis, -0.6 * uMis);
            vec4 e = texture2D(tInk, vUv), er = texture2D(tInk, (px - off) / uRes);
            // red spot-colour sun behind the robot, denser at its centre
            vec2 sc = (px - vec2(0.5, 0.56) * uRes) / uRes.y;
            float sun = (1.0 - smoothstep(0.395, 0.4, length(sc))) * (0.62 - 0.5 * length(sc));
            float red = er.a < 0.5 ? sun : er.g, black = e.a < 0.5 ? 0.0 : e.r;
            vec3 paper = vec3(0.937, 0.890, 0.788) * (0.97 + 0.05 * h21(floor(px / 2.0) + 0.5));
            vec3 col = paper * mix(vec3(1.0), vec3(0.93, 0.2, 0.17), dotScreen(px - off, 0.2618, red));
            col *= mix(vec3(1.0), vec3(0.12, 0.11, 0.13), dotScreen(px, 0.7854, black));
            col = mix(col, vec3(0.1, 0.09, 0.11), e.a < 0.5 ? 0.0 : e.b);
            gl_FragColor = vec4(col, 1.0);
          }` });
      const pass = quad(mat), px = Math.max(1.4, (3.2 * GH) / 720);
      return (t) => {
        st.update(t, { w: GW, h: GH, px });
        R3.setRenderTarget(rt); R3.setClearColor(0x000000, 0); R3.clear(); R3.render(st.scene, st.cam);
        R3.setRenderTarget(null); R3.render(pass, QCAM); R3.setClearColor(0x000000, 1); blit();
      };
    } });

  demo({ ...SHARED, id: "dithercharacter", gl: true, grade: "B", stacks: ["three", "glsl"],
    name: "Two-ink ordered dither", chips: ["4×4 Bayer dither, paper + two inks", "160 × 90 cell grid at any size", "1-cell outline", ...CHIPS],
    purpose: "A night scene in two inks on dark paper: the key light carves the robot out of the dark in cross-hatched cells, and the turntable glows in a dithered pool around its shadow.",
    hero: 3.0,
    build(s) {
      s.style.background = "#151129";
      if (!window.FX.dither) throw new Error("fx/pack-dither.js must load before fx/pack-shading.js");
      const blit = glTile(s), st = stage(2, { line: [0, 1, 0, 1], shadow: [0, 0, 0, 1], floor: 0x808080 });
      const c = window.FX.dither.cell(GH, 8), grid = new THREE.Vector2(Math.round(GW / c), Math.round(GH / c));
      const rt = new THREE.WebGLRenderTarget(grid.x, grid.y, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, stencilBuffer: true });
      const mat = window.FX.dither.quantizeMaterial({ tone: rt.texture, grid, paper: 0x151129, inkA: 0x5a4cf0, inkB: 0xffd27a, stars: 0.006 });
      const pass = quad(mat);
      return (t) => {
        st.update(t, { w: grid.x, h: grid.y, px: 1 });
        R3.setRenderTarget(rt); R3.setClearColor(0x000000, 0); R3.clear(); R3.render(st.scene, st.cam);
        mat.uniforms.uTime.value = t * W * 2;
        R3.setRenderTarget(null); R3.render(pass, QCAM); R3.setClearColor(0x000000, 1); blit();
      };
    } });
})();
