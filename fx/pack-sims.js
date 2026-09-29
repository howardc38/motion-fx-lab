// Motion FX Lab: simulation effects. Registers tiles with FX.demo; see fx/demos.js for the building blocks.
// A simulation has no closed form in t, so each tile here runs a FIXED step from a FIXED initial state, and
// frame(t) shows the state after exactly round(t * steps per second) steps. A forward cache keeps the last
// state and its step count; asking for an earlier t resets to the initial state and simulates again. That
// keeps every frame a function of t alone, so a video can still be rendered by several browsers in parallel.
(() => {
  const FX = window.FX;
  if (!FX) return;
  const { demo, R3, GW, GH, LAT, rng, glTile } = FX;
  const { lin, smooth, inOut } = FX.helpers;
  const SEEN = "Threads · @designer.riven";

  // ================= Gray–Scott reaction–diffusion on the GPU =================
  const RD_W = 240, RD_H = 300, RD_SPS = 900, RD_PERIOD = 10;
  const RD_F = 0.0545, RD_K = 0.062;   // "coral" feed and kill rates, with Du = 1, Dv = 0.5, dt = 1
  const VERT = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

  demo({ id: "reaction", gl: true, name: "Reaction–diffusion growing from text", kind: "sim", stacks: ["three", "glsl", "canvas"],
    chips: ["Gray–Scott on the GPU", "ping-pong half-float targets", `fixed ${RD_SPS} steps/s`], grade: "B",
    purpose: "A word grows into coral: two chemicals react and diffuse on a 240×300 grid seeded by the letters. Organic texture from maths, no footage.",
    seen: SEEN, period: RD_PERIOD, hero: 6,
    build(s) {
      const blit = glTile(s), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), geo = new THREE.PlaneGeometry(2, 2);
      const target = () => new THREE.WebGLRenderTarget(RD_W, RD_H, { type: THREE.HalfFloatType, format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
      const rts = [target(), target()];
      const pass = (uniforms, fragmentShader) => {
        const scene = new THREE.Scene();
        scene.add(new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader,
          depthTest: false, depthWrite: false, blending: THREE.NoBlending })));
        return scene;
      };
      // The seed: the word rasterised on the CPU (willReadFrequently keeps it off the GPU), thresholded, plus seeded noise.
      const seedData = new Uint8Array(RD_W * RD_H * 4);
      const seedTex = new THREE.DataTexture(seedData, RD_W, RD_H, THREE.RGBAFormat, THREE.UnsignedByteType);
      seedTex.minFilter = seedTex.magFilter = THREE.NearestFilter; seedTex.generateMipmaps = false;
      const init = pass({ uSeed: { value: seedTex } }, `uniform sampler2D uSeed; varying vec2 vUv;
        void main(){ vec4 m = texture2D(uSeed, vUv); float a = step(0.5, m.r);
          gl_FragColor = vec4(1.0 - 0.5*a, a*(0.2 + 0.1*m.g), 0.0, 1.0); }`);
      const stepU = { uS: { value: null }, uPx: { value: new THREE.Vector2(1 / RD_W, 1 / RD_H) }, uF: { value: RD_F }, uK: { value: RD_K } };
      const stepS = pass(stepU, `uniform sampler2D uS; uniform vec2 uPx; uniform float uF, uK; varying vec2 vUv;
        vec2 at(float x, float y){ return texture2D(uS, vUv + vec2(x, y)*uPx).rg; }
        void main(){
          vec2 c = at(0.0, 0.0);
          vec2 l = 0.2*(at(1.0,0.0) + at(-1.0,0.0) + at(0.0,1.0) + at(0.0,-1.0))
                 + 0.05*(at(1.0,1.0) + at(-1.0,-1.0) + at(1.0,-1.0) + at(-1.0,1.0)) - c;
          float r = c.x*c.y*c.y;
          float u = c.x + (l.x - r + uF*(1.0 - c.x));
          float v = c.y + (0.5*l.y + r - (uF + uK)*c.y);
          gl_FragColor = vec4(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0), 0.0, 1.0); }`);
      const showU = { uS: { value: rts[0].texture }, uRes: { value: new THREE.Vector2(RD_W, RD_H) }, uOn: { value: 0 }, uFade: { value: 1 } };
      const show = pass(showU, `uniform sampler2D uS; uniform vec2 uRes; uniform float uOn, uFade; varying vec2 vUv;
        vec2 S(vec2 p){   // bilinear by hand, so the simulation targets can stay NEAREST
          vec2 x = p*uRes - 0.5, i = floor(x), f = x - i, a = (i + 0.5)/uRes, d = 1.0/uRes;
          vec2 s00 = texture2D(uS, a).rg, s10 = texture2D(uS, a + vec2(d.x, 0.0)).rg;
          vec2 s01 = texture2D(uS, a + vec2(0.0, d.y)).rg, s11 = texture2D(uS, a + d).rg;
          return mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y); }
        void main(){
          vec3 bg = vec3(0.028, 0.032, 0.065);
          vec2 e = 0.75/uRes;
          vec2 c = mix(vec2(1.0, 0.0), S(vUv), uOn);
          float gx = S(vUv + vec2(e.x, 0.0)).g - S(vUv - vec2(e.x, 0.0)).g, gy = S(vUv + vec2(0.0, e.y)).g - S(vUv - vec2(0.0, e.y)).g;
          float k = clamp(c.y * 3.2, 0.0, 1.0), used = clamp(1.0 - c.x, 0.0, 1.0);   // V peaks, and the food U already eaten
          vec3 col = mix(bg, vec3(0.10, 0.20, 0.85), smoothstep(0.02, 0.35, used));
          col = mix(col, vec3(1.0, 0.36, 0.12), smoothstep(0.5, 0.9, k));
          vec3 n = normalize(vec3(-vec2(gx, gy) * 9.0 * uOn, 1.0));
          float lam = max(0.0, dot(n, normalize(vec3(-0.45, 0.55, 0.7))));
          col *= 0.62 + 0.5*lam;
          col += vec3(1.0, 0.85, 0.7) * pow(lam, 18.0) * 0.35 * smoothstep(0.3, 0.8, k);
          gl_FragColor = vec4(mix(bg, col, uFade), 1.0); }`);

      let seeded = false, cur = 0, stepN = -1, lastT = null;
      const run = (scene, rt) => { R3.setRenderTarget(rt); R3.render(scene, cam); };
      const ready = document.fonts.load(`900 64px ${LAT}`, "GROW").then(() => {
        const c = document.createElement("canvas"); c.width = RD_W; c.height = RD_H;
        const g = c.getContext("2d", { willReadFrequently: true });
        g.fillStyle = "#000"; g.fillRect(0, 0, RD_W, RD_H);
        g.font = `900 64px ${LAT}`; const w = g.measureText("GROW").width, px = Math.floor(64 * 216 / w);
        g.font = `900 ${px}px ${LAT}`; const m = g.measureText("GROW");
        g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "alphabetic";
        g.fillText("GROW", RD_W / 2, Math.round(RD_H / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2));
        const d = g.getImageData(0, 0, RD_W, RD_H).data, R = rng(2718);
        for (let y = 0; y < RD_H; y++) for (let x = 0; x < RD_W; x++) {
          const i = (y * RD_W + x) * 4, o = ((RD_H - 1 - y) * RD_W + x) * 4;   // canvas rows run down, texture rows run up
          seedData[o] = d[i] > 127 ? 255 : 0; seedData[o + 1] = Math.floor(R() * 256); seedData[o + 2] = 0; seedData[o + 3] = 255;
        }
        seedTex.needsUpdate = true; seeded = true; stepN = -1;
        if (lastT !== null) frame(lastT);   // a frame asked for before the font arrived is drawn again
      });
      const frame = (t) => {
        lastT = t;
        const auto = R3.autoClear;
        R3.autoClear = false; R3.setScissorTest(false);
        if (seeded) {
          const n = Math.max(0, Math.round(t * RD_SPS));
          if (stepN < 0 || n < stepN) { run(init, rts[0]); cur = 0; stepN = 0; }
          for (; stepN < n; stepN++) { stepU.uS.value = rts[cur].texture; cur = 1 - cur; run(stepS, rts[cur]); }
        }
        showU.uS.value = rts[cur].texture; showU.uOn.value = seeded ? 1 : 0;
        showU.uFade.value = smooth(0, 0.35, t) * (1 - smooth(RD_PERIOD - 0.8, RD_PERIOD - 0.15, t));
        R3.setRenderTarget(null); R3.setViewport(0, 0, GW, GH); R3.render(show, cam);
        R3.autoClear = auto;
        blit();
      };
      return { ready, frame };
    } });

  // ================= Rigid bodies with Matter.js =================
  const RB_HZ = 240, RB_PERIOD = 8, RB_W = 480, RB_H = 600;
  const INK = "#111016", CREAM = "#f2efe8", ORANGE = "#ff5a1f", BLUE = "#2b4bff", YELLOW = "#ffd400";
  const MONO = '"JetBrains Mono", monospace';
  const RB_FONT = 110;   // glyph boxes below are Archivo 900 ink boxes at this size; physics never measures a font
  // Spawned in this order at these times (seconds), just above the tile.
  const RB_SPAWN = [
    { k: "M", x: 118, at: 0.15 }, { k: "circle", r: 30, x: 350, at: 0.35, col: ORANGE }, { k: "O", x: 250, at: 0.5 },
    { k: "tri", r: 42, x: 400, at: 0.7, col: BLUE }, { k: "T", x: 170, at: 0.85 }, { k: "circle", r: 22, x: 62, at: 1.0, col: YELLOW },
    { k: "I", x: 300, at: 1.15 }, { k: "tri", r: 34, x: 205, at: 1.3, col: ORANGE }, { k: "O", x: 395, at: 1.45 },
    { k: "circle", r: 26, x: 250, at: 1.6, col: BLUE }, { k: "N", x: 110, at: 1.75 }, { k: "tri", r: 30, x: 340, at: 1.9, col: YELLOW },
  ];
  const FLOOR_L = 540, FLOOR_T = 24, HINGE = { x: -8, y: 500 }, TILT = 0.6, TILT_AT = 5.0;
  const tiltAt = (t) => TILT * (inOut(lin(TILT_AT, TILT_AT + 1.2, t)) - inOut(lin(7.1, 7.7, t)));

  demo({ id: "rigid", name: "Rigid bodies with Matter.js", kind: "sim", stacks: ["physics", "canvas"],
    chips: ["Matter.js 0.20.0", "fixed 240 Hz steps", "Canvas 2D"], grade: "C",
    purpose: "Letters and shapes fall, collide and pile up with real weight, then the floor tips and everything slides away. Physics you never keyframe by hand.",
    seen: SEEN, period: RB_PERIOD, hero: 4.6,
    build(s) {
      if (!window.Matter) throw new Error("Matter.js did not load");
      const { Engine, Bodies, Body, Composite } = window.Matter;
      s.style.background = CREAM;
      const c = document.createElement("canvas"); c.width = RB_W; c.height = RB_H; c.className = "fill"; s.appendChild(c);
      const g = c.getContext("2d");
      const mat = { friction: 0.35, frictionStatic: 0.6, restitution: 0.15, density: 0.0012 };

      const letterBody = (k, x, y) => {
        if (k === "O") return Bodies.circle(x, y, 40, mat);
        if (k === "T") {   // a compound body: the bar and the stem
          const bar = Bodies.rectangle(x, y - 38 + 10.5, 74, 21, mat), stem = Bodies.rectangle(x, y + 10.5, 24, 55, mat);
          return Body.create({ ...mat, parts: [bar, stem] });
        }
        const w = { M: 91, I: 24, N: 75 }[k];
        return Bodies.rectangle(x, y, w, 76, mat);
      };
      // Every body, in a fixed order, from a fixed initial state. Called at step 0 and whenever t goes backwards.
      const reset = () => {
        const engine = Engine.create({ gravity: { x: 0, y: 2, scale: 0.001 }, positionIterations: 10, velocityIterations: 8, enableSleeping: false });
        engine.timing.timeScale = 1; engine.timing.timestamp = 0;
        const wall = (x, bottom) => Bodies.rectangle(x, (bottom - 900) / 2, 60, bottom + 900, { isStatic: true, friction: 0.1 });
        const floor = Bodies.rectangle(HINGE.x + FLOOR_L / 2, HINGE.y, FLOOR_L, FLOOR_T, { isStatic: true, friction: 0.25, frictionStatic: 0.3 });
        Composite.add(engine.world, [wall(-30, HINGE.y - FLOOR_T / 2), wall(RB_W + 30, HINGE.y - FLOOR_T / 2), floor]);
        const R = rng(8111), items = RB_SPAWN.map((o) => {
          const y = -70;
          const b = o.k === "circle" ? Bodies.circle(o.x, y, o.r, mat) : o.k === "tri" ? Bodies.polygon(o.x, y, 3, o.r, mat) : letterBody(o.k, o.x, y);
          const glyph = { x: o.x - b.position.x, y: y - b.position.y };   // where the glyph's ink centre sits, in body space
          Body.setAngle(b, (R() - 0.5) * 0.7);
          Body.setVelocity(b, { x: (R() - 0.5) * 1.2, y: 2 + R() * 2 });
          Body.setAngularVelocity(b, (R() - 0.5) * 0.04);
          return { o, b, glyph, step: Math.round(o.at * RB_HZ), live: false };
        });
        return { engine, floor, items, n: 0 };
      };
      const stepOnce = (sim) => {
        for (const it of sim.items) if (!it.live && it.step === sim.n) { Composite.add(sim.engine.world, it.b); it.live = true; }
        const a = tiltAt((sim.n + 1) / RB_HZ);
        sim.floor.friction = sim.n >= TILT_AT * RB_HZ ? 0 : 0.25;   // Matter's friction is sticky on slopes; an icy floor lets the pile slide
        Body.setAngle(sim.floor, a, true);
        Body.setPosition(sim.floor, { x: HINGE.x + Math.cos(a) * FLOOR_L / 2, y: HINGE.y + Math.sin(a) * FLOOR_L / 2 }, true);
        Engine.update(sim.engine, 1000 / RB_HZ);
        sim.n++;
      };

      let sim = null, lastT = null, glyphBox = null;
      const ready = Promise.all([document.fonts.load(`900 ${RB_FONT}px ${LAT}`, "MOTION"), document.fonts.load(`700 15px ${MONO}`, "MATTER.JS · 240 HZ")])
        .then(() => { glyphBox = null; if (lastT !== null) frame(lastT); });   // drawing waits for the fonts; the physics never does
      const glyphs = () => {   // ink centres from the loaded font; used for drawing only
        g.font = `900 ${RB_FONT}px ${LAT}`;
        const out = {};
        for (const ch of "MOTIN") { const m = g.measureText(ch); out[ch] = { x: (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2, y: (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2 }; }
        return out;
      };
      const path = (vs) => { g.beginPath(); g.moveTo(vs[0].x, vs[0].y); for (let i = 1; i < vs.length; i++) g.lineTo(vs[i].x, vs[i].y); g.closePath(); };
      const draw = () => {
        g.fillStyle = CREAM; g.fillRect(0, 0, RB_W, RB_H);
        g.fillStyle = "rgba(17,16,22,0.45)"; g.font = `700 15px ${MONO}`; g.textAlign = "left"; g.textBaseline = "alphabetic";
        g.fillText("MATTER.JS · 240 HZ", 24, 40);
        if (!glyphBox) glyphBox = glyphs();
        g.font = `900 ${RB_FONT}px ${LAT}`; g.textAlign = "left"; g.textBaseline = "alphabetic";
        for (const it of sim.items) {
          if (!it.live) continue;
          const b = it.b;
          if (b.position.y > RB_H + 200) continue;
          if (it.o.k === "circle") { g.fillStyle = it.o.col; g.beginPath(); g.arc(b.position.x, b.position.y, it.o.r, 0, Math.PI * 2); g.fill(); continue; }
          if (it.o.k === "tri") {
            g.fillStyle = it.o.col; g.lineJoin = "round"; g.lineWidth = 6; g.strokeStyle = it.o.col;
            path(b.vertices); g.fill(); g.stroke(); continue;
          }
          const gb = glyphBox[it.o.k];
          g.save(); g.translate(b.position.x, b.position.y); g.rotate(b.angle); g.translate(it.glyph.x, it.glyph.y);
          g.fillStyle = INK; g.fillText(it.o.k, -gb.x, -gb.y); g.restore();
        }
        const f = sim.floor;
        g.save(); g.translate(f.position.x, f.position.y); g.rotate(f.angle);
        g.fillStyle = INK; g.fillRect(-FLOOR_L / 2, -FLOOR_T / 2, FLOOR_L, FLOOR_T); g.restore();
        g.fillStyle = CREAM; g.beginPath(); g.arc(HINGE.x + 30 * Math.cos(f.angle), HINGE.y + 30 * Math.sin(f.angle), 5, 0, Math.PI * 2); g.fill();
      };
      const frame = (t) => {
        lastT = t;
        const n = Math.max(0, Math.round(t * RB_HZ));
        if (!sim || n < sim.n) sim = reset();
        while (sim.n < n) stepOnce(sim);
        draw();
      };
      return { ready, frame };
    } });
})();
