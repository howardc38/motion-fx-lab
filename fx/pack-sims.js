// Motion FX Lab: simulation effects. Registers tiles with FX.demo; see fx/demos.js for the building blocks.
// A simulation has no closed form in t, so each tile here runs a FIXED step from a FIXED initial state, and
// frame(t) shows the state after exactly round(t * steps per second) steps. A forward cache keeps the last
// state and its step count; asking for an earlier t resets to the initial state and simulates again. That
// keeps every frame a function of t alone, so a video can still be rendered by several browsers in parallel.
(() => {
  const FX = window.FX;
  if (!FX) return;
  const { demo, R3, GW, GH, LAT, rng, glTile } = FX;
  const { lin, smooth, hash } = FX.helpers;
  const SEEN = "Threads · @designer.riven";

  // ================= Gray–Scott reaction–diffusion on the GPU =================
  const RD_W = 240, RD_H = Math.round(RD_W * GH / GW), RD_SPS = 900, RD_PERIOD = 10;
  const RD_F = 0.0545, RD_K = 0.062;   // "coral" feed and kill rates, with Du = 1, Dv = 0.5, dt = 1
  const VERT = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

  demo({ id: "reaction", gl: true, name: "Reaction–diffusion growing from text", kind: "sim", stacks: ["three", "glsl", "canvas"],
    chips: ["Gray–Scott on the GPU", "ping-pong half-float targets", `fixed ${RD_SPS} steps/s`], grade: "B",
    purpose: "A word grows into coral: two chemicals react and diffuse on a seeded simulation grid seeded by the letters. Organic texture from maths, no footage.",
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
  // STACK: five heavy letters drop in one by one and stand as a word; a heavy ball smashes it apart.
  // The physics world is a 1280×720 frame drawn at the render size; letter bodies are the convex hulls
  // of the bundled outlines in assets/type/motion-cjk.json (Noto Sans TC, SIL OFL 1.1).
  const RB_HZ = 240, RB_PERIOD = 8, RB_W = 1280, RB_H = 720, RB_FLOOR = 600;
  const INK = "#111016", CREAM = "#f2efe8", ORANGE = "#ff5a1f";
  const MONO = '"JetBrains Mono", monospace';
  const RB_CAP = 214, RB_GAP = 16, RB_WORD = "STACK";
  const RB_DROP = [0, 0.3, 0.6, 0.9, 1.2];                                   // when each letter is released
  const RB_BALL = { at: 2.7, x: -150, y: 380, vx: 40, vy: 8, r: 84, density: 0.02 };   // thrown in from the left; velocity in px per 1/60 s (Matter's unit)
  const RB_WIPE = 7.6;
  const OUTLINES = new URL("../assets/type/motion-cjk.json", document.currentScript.src);
  // Every on-curve and flattened point of an outline, in font units (y up). Enough for a hull and a box.
  function outlinePoints(d) {
    const tok = d.match(/[MLHVQCZ]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi), pts = [];
    let cmd = null, x = 0, y = 0, i = 0;
    const num = () => +tok[i++];
    while (i < tok.length) {
      if (/[a-z]/i.test(tok[i])) cmd = tok[i++].toUpperCase();
      if (cmd === "Z") { cmd = null; continue; }
      if (cmd === "M") { x = num(); y = num(); cmd = "L"; }
      else if (cmd === "L") { x = num(); y = num(); }
      else if (cmd === "H") x = num();
      else if (cmd === "V") y = num();
      else if (cmd === "Q") {
        const cx = num(), cy = num(), ex = num(), ey = num();
        for (const s of [0.25, 0.5, 0.75]) pts.push({ x: (1 - s) * (1 - s) * x + 2 * (1 - s) * s * cx + s * s * ex, y: (1 - s) * (1 - s) * y + 2 * (1 - s) * s * cy + s * s * ey });
        x = ex; y = ey;
      } else throw new Error("Unsupported outline command: " + cmd);
      pts.push({ x, y });
    }
    return pts;
  }
  const rbEase = (x) => x * x * (3 - 2 * x);

  demo({ id: "rigid", name: "Rigid bodies with Matter.js", kind: "sim", stacks: ["physics", "canvas"],
    chips: ["Matter.js 0.20.0", "fixed 240 Hz steps", "convex hulls of real glyphs", "Canvas 2D"], grade: "C",
    purpose: "Five heavy letters drop in one by one and stand as STACK; then a heavy ball smashes the word apart. Weight, collisions and the last letter's wobble all come from the simulation, never from keyframes.",
    seen: SEEN, period: RB_PERIOD, hero: 3.2,
    build(s) {
      if (!window.Matter) throw new Error("Matter.js did not load");
      const { Engine, Bodies, Body, Composite, Events, Vertices } = window.Matter;
      s.style.background = CREAM;
      const c = document.createElement("canvas"); c.width = GW; c.height = GH; c.className = "fill"; s.appendChild(c);
      const g = c.getContext("2d"), k = GW / RB_W;
      let letters = null, sim = null, lastT = null;
      const mat = { friction: 0.55, frictionStatic: 0.9, restitution: 0.1, density: 0.002 };
      // Glyph geometry is fixed by the bundled outlines, so the simulation never depends on font loading.
      const prepare = (data) => {
        const glyphs = Array.from(RB_WORD).map((ch) => {
          const gl = data.glyphs[ch], pts = outlinePoints(gl.path);
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
          for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
          return { ch, path: new Path2D(gl.path), pts, x0, x1, y0, y1 };
        });
        const sc = RB_CAP / Math.max(...glyphs.map((q) => q.y1 - q.y0));
        let total = -RB_GAP;
        for (const q of glyphs) { q.w = (q.x1 - q.x0) * sc; q.h = (q.y1 - q.y0) * sc; total += q.w + RB_GAP; }
        let x = (RB_W - total) / 2;
        for (const q of glyphs) {
          const bx = (q.x0 + q.x1) / 2, by = (q.y0 + q.y1) / 2;
          q.hull = Vertices.hull(q.pts.map((p) => ({ x: (p.x - bx) * sc, y: -(p.y - by) * sc })));
          q.centre = Vertices.centre(q.hull);         // where Matter puts the body position, relative to the box centre
          q.restX = x + q.w / 2; q.restY = RB_FLOOR - q.h / 2; x += q.w + RB_GAP;
          q.sc = sc; q.bx = bx; q.by = by;
        }
        return glyphs;
      };
      // Every body, in a fixed order, from a fixed initial state. Called at step 0 and whenever t goes backwards.
      const reset = () => {
        const engine = Engine.create({ gravity: { x: 0, y: 2, scale: 0.001 }, positionIterations: 10, velocityIterations: 8, enableSleeping: false });
        engine.timing.timeScale = 1; engine.timing.timestamp = 0;
        const floor = Bodies.rectangle(RB_W / 2, RB_FLOOR + 100, RB_W + 1200, 200, { isStatic: true, friction: 0.6, frictionStatic: 0.9 });
        const right = Bodies.rectangle(RB_W + 40, RB_FLOOR - 700, 80, 1600, { isStatic: true, friction: 0.2 });
        const left = Bodies.rectangle(-300, RB_FLOOR - 700, 80, 1600, { isStatic: true, friction: 0.2 });
        Composite.add(engine.world, [floor, right, left]);
        const items = letters.map((q, i) => {
          const b = Bodies.fromVertices(q.restX + q.centre.x, -q.h / 2 - 20 + q.centre.y, [q.hull], mat);
          Body.setVelocity(b, { x: 0, y: 6 });
          return { q, b, step: Math.round(RB_DROP[i] * RB_HZ), live: false, landed: null };
        });
        const ball = { b: Bodies.circle(RB_BALL.x, RB_BALL.y, RB_BALL.r, { density: RB_BALL.density, friction: 0.08, frictionStatic: 0.2, restitution: 0.35 }), step: Math.round(RB_BALL.at * RB_HZ), live: false };
        const sim = { engine, floor, items, ball, n: 0, impact: null, events: [] };
        Events.on(engine, "collisionStart", (ev) => {
          for (const pair of ev.pairs) {
            const a = pair.bodyA.parent, b = pair.bodyB.parent;
            for (const it of items) {
              if (it.landed === null && ((a === it.b && b === floor) || (b === it.b && a === floor))) {
                it.landed = sim.n; sim.events.push({ n: sim.n, x: it.b.position.x, y: RB_FLOOR, size: 1 });
              }
              if (!sim.impact && ((a === it.b && b === ball.b) || (b === it.b && a === ball.b))) {
                sim.impact = { n: sim.n, x: ball.b.position.x + RB_BALL.r * 0.7, y: ball.b.position.y };
                sim.events.push({ n: sim.n, x: sim.impact.x, y: sim.impact.y, size: 2.6 });
              }
            }
          }
        });
        return sim;
      };
      const stepOnce = (sim) => {
        for (const it of sim.items) if (!it.live && it.step === sim.n) { Composite.add(sim.engine.world, it.b); it.live = true; }
        if (!sim.ball.live && sim.ball.step === sim.n) { Composite.add(sim.engine.world, sim.ball.b); Body.setVelocity(sim.ball.b, { x: RB_BALL.vx, y: RB_BALL.vy }); Body.setAngularVelocity(sim.ball.b, 0.25); sim.ball.live = true; }
        Engine.update(sim.engine, 1000 / RB_HZ);
        sim.n++;
      };
      const airborne = () => sim ? sim.items.filter((it) => it.live && it.landed !== null && it.b.bounds.max.y < RB_FLOOR - 8 && Math.hypot(it.b.velocity.x, it.b.velocity.y) > 0.5).length : 0;
      // The simulation's measured state, for tests and reviews: letters in the air, landing and impact times, boxes.
      c.proof = () => ({ step: sim && sim.n, airborne: airborne(), landed: sim && sim.items.map((it) => it.landed === null ? null : it.landed / RB_HZ), impact: sim && sim.impact && sim.impact.n / RB_HZ,
        boxes: sim && sim.items.map((it) => ({ x0: it.b.bounds.min.x, x1: it.b.bounds.max.x, y0: it.b.bounds.min.y, y1: it.b.bounds.max.y })) });
      const puff = (e, t) => {   // dust from a landing or the impact: soft grey puffs that spread and fade
        const age = t - e.n / RB_HZ, life = 0.45 + 0.35 * e.size;
        if (age < 0 || age > life) return;
        const f = age / life;
        for (let j = 0; j < 9 + 7 * e.size; j++) {
          const h1 = hash(e.n * 13.1 + j * 7.7), h2 = hash(e.n * 3.7 + j * 1.9), side = j % 2 ? 1 : -1;
          const dx = side * (20 + 90 * h1) * e.size * Math.pow(f, 0.5), dy = -(10 + 60 * h2) * e.size * Math.pow(f, 0.6);
          g.fillStyle = `rgba(150,138,124,${(0.2 * (1 - f) * (0.5 + 0.5 * h2)).toFixed(3)})`;
          g.beginPath(); g.arc(e.x + dx, e.y + dy - 6, (10 + 18 * h1) * (0.6 + f) * Math.sqrt(e.size), 0, Math.PI * 2); g.fill();
        }
      };
      const glyph = (q, x, y, angle) => {
        g.save(); g.translate(x, y); g.rotate(angle); g.translate(-q.centre.x, -q.centre.y);
        g.scale(q.sc, -q.sc); g.translate(-q.bx, -q.by); g.fill(q.path); g.restore();
      };
      const stage = () => {
        g.fillStyle = CREAM; g.fillRect(0, 0, RB_W, RB_H);
        g.fillStyle = INK; g.fillRect(-20, RB_FLOOR, RB_W + 40, RB_H - RB_FLOOR + 20);
        g.fillStyle = "rgba(17,16,22,0.42)"; g.font = `700 17px ${MONO}`; g.textAlign = "left"; g.textBaseline = "alphabetic";
        g.fillText("MATTER.JS · 240 HZ", 40, 52);
      };
      const draw = (t) => {
        const wipeIn = rbEase(lin(RB_WIPE, RB_WIPE + 0.16, t)), wipeOut = rbEase(lin(RB_WIPE + 0.24, RB_PERIOD, t));
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, GW, GH);
        let sx = 0, sy = 0;
        if (sim.impact) { const a = t - sim.impact.n / RB_HZ; if (a > 0) { const e = 4 * Math.exp(-a * 9); sx = e * Math.sin(a * 95); sy = 0.75 * e * Math.sin(a * 120 + 1); } }
        for (const it of sim.items) if (it.landed !== null) { const a = t - it.landed / RB_HZ; if (a > 0 && a < 0.3) sy += 1.5 * Math.exp(-a * 18) * Math.sin(a * 110); }
        g.setTransform(k, 0, 0, k, sx * k, sy * k);
        stage();
        if (wipeOut === 0) {
          for (const e of sim.events) puff(e, t);
          g.fillStyle = INK;
          for (const it of sim.items) if (it.live && it.b.position.y < RB_H + 300) glyph(it.q, it.b.position.x, it.b.position.y, it.b.angle);
          if (sim.ball.live) {
            const b = sim.ball.b, r = RB_BALL.r, hg = g.createRadialGradient(b.position.x - r * 0.35, b.position.y - r * 0.4, r * 0.1, b.position.x, b.position.y, r);
            hg.addColorStop(0, "#ff9a66"); hg.addColorStop(0.55, ORANGE); hg.addColorStop(1, "#c93a0c");
            g.fillStyle = hg; g.beginPath(); g.arc(b.position.x, b.position.y, r, 0, Math.PI * 2); g.fill();
          }
        }
        // reset: an orange panel sweeps across and leaves an empty stage for the next drop
        if (t >= RB_WIPE) { g.fillStyle = ORANGE; g.fillRect(RB_W * (1 - wipeIn) - (RB_W + 2) * wipeOut, 0, RB_W + 2, RB_H); }
      };
      const frame = (t) => {
        lastT = t;
        if (!letters) { g.setTransform(k, 0, 0, k, 0, 0); stage(); return; }
        const n = Math.max(0, Math.round(Math.min(t, RB_WIPE + 0.2) * RB_HZ));
        if (!sim || n < sim.n) sim = reset();
        while (sim.n < n) stepOnce(sim);
        draw(t);
      };
      const ready = Promise.all([fetch(OUTLINES).then((r) => { if (!r.ok) throw new Error("Outline asset failed to load: assets/type/motion-cjk.json"); return r.json(); }),
        document.fonts.load(`700 17px ${MONO}`, "MATTER.JS · 240 HZ")])
        .then(([data]) => { letters = prepare(data); sim = null; if (lastT !== null) frame(lastT); });
      return { ready, frame };
    } });
})();
