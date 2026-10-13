// Motion FX Lab: light and surface treatments. Registers tiles with FX.demo; see fx/demos.js for the building blocks.
//   chrome   — a heavy bevelled monogram reflecting three sharp softboxes; a turn sweeps the bands across every bevel.
//   dissolve — a burn front crosses a plaster word, sheds embers, and a new word assembles behind it.
//   rays     — light behind a stencilled wall; louvres open and beams scatter through dust toward the camera.
//   liquid   — a glass lens crosses a composed poster, magnifying the headline and splitting colour at its rim.
// Every frame is a pure function of t. Lettering comes from the bundled outlines in assets/type/motion-cjk.json
// (Noto Sans TC, SIL OFL 1.1), so no 3D font file or remote font is needed. Pixel sizes scale with the render size.
(() => {
  const FX = window.FX;
  if (!FX) return;
  const { demo, GW, GH, LAT, glTile, composer, rng, NOISE } = FX;
  const { clamp, lin, smooth, outCubic, inOut, back } = FX.helpers;
  const PX = GH / 720;   // one pixel of a 1280×720 frame, in render pixels
  const MONO = '"JetBrains Mono", Menlo, monospace';

  // ---------- bundled outlines → THREE shapes ----------
  const OUTLINES = new URL("../assets/type/motion-cjk.json", document.currentScript.src);
  let outlines = null;
  const loadOutlines = () => (outlines ||= fetch(OUTLINES).then((r) => {
    if (!r.ok) throw new Error("Outline asset failed to load: assets/type/motion-cjk.json");
    return r.json();
  }));
  // Absolute SVG path data (M L H V Q C Z, as written by tools/build-cjk-font.py) → closed polylines in font units.
  function contours(d, seg) {
    const tok = d.match(/[MLHVQCZ]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi), out = [];
    let cur = null, cmd = null, x = 0, y = 0, i = 0;
    const num = () => +tok[i++];
    while (i < tok.length) {
      if (/[a-z]/i.test(tok[i])) cmd = tok[i++].toUpperCase();
      if (cmd === "Z") { if (cur) out.push(cur); cur = null; cmd = null; continue; }
      if (cmd === "M") { x = num(); y = num(); if (cur) out.push(cur); cur = [[x, y]]; cmd = "L"; }
      else if (cmd === "L") { x = num(); y = num(); cur.push([x, y]); }
      else if (cmd === "H") { x = num(); cur.push([x, y]); }
      else if (cmd === "V") { y = num(); cur.push([x, y]); }
      else if (cmd === "Q") {
        const cx = num(), cy = num(), ex = num(), ey = num();
        for (let k = 1; k <= seg; k++) { const s = k / seg, a = (1 - s) * (1 - s), b = 2 * (1 - s) * s, c = s * s; cur.push([a * x + b * cx + c * ex, a * y + b * cy + c * ey]); }
        x = ex; y = ey;
      } else if (cmd === "C") {
        const c1x = num(), c1y = num(), c2x = num(), c2y = num(), ex = num(), ey = num();
        for (let k = 1; k <= seg; k++) { const s = k / seg, r = 1 - s; cur.push([r * r * r * x + 3 * r * r * s * c1x + 3 * r * s * s * c2x + s * s * s * ex, r * r * r * y + 3 * r * r * s * c1y + 3 * r * s * s * c2y + s * s * s * ey]); }
        x = ex; y = ey;
      } else throw new Error("Unsupported outline command: " + cmd);
    }
    if (cur) out.push(cur);
    for (const c of out) { const a = c[0], b = c[c.length - 1]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) c.pop(); }
    return out.filter((c) => c.length > 2);
  }
  const signedArea = (c) => { let a = 0; for (let i = 0; i < c.length; i++) { const p = c[i], q = c[(i + 1) % c.length]; a += p.x * q.y - q.x * p.y; } return a / 2; };
  const contains = (c, x, y) => {
    let r = false;
    for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
      const a = c[i], b = c[j];
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) r = !r;
    }
    return r;
  };
  // A word laid out by advance width, scaled so its ink is `cap` world units tall and centred on the origin.
  // Returns THREE.Shapes with holes, the raw outer and hole contours, its size and an even-odd ink test.
  function wordShapes(data, text, cap, seg = 6) {
    let x = 0; const raw = [];
    for (const ch of text) {
      const g = data.glyphs[ch];
      if (!g) throw new Error(`Missing outline: ${ch}. Rebuild assets/type/motion-cjk.json with tools/build-cjk-font.py.`);
      for (const c of contours(g.path, seg)) raw.push(c.map(([px, py]) => [px + x, py]));
      x += g.advance;
    }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of raw) for (const [px, py] of c) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    const s = cap / (y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const pts = raw.map((c) => c.map(([px, py]) => new THREE.Vector2((px - cx) * s, (py - cy) * s)));
    const areas = pts.map(signedArea);
    let big = 0; areas.forEach((a, i) => { if (Math.abs(a) > Math.abs(areas[big])) big = i; });
    const sign = Math.sign(areas[big]), outers = [], holes = [];
    pts.forEach((c, i) => (Math.sign(areas[i]) === sign ? outers : holes).push({ c, a: Math.abs(areas[i]) }));
    const shapes = outers.map((o) => ({ o, shape: new THREE.Shape(o.c) }));
    for (const h of holes) {
      const host = shapes.filter((sh) => contains(sh.o.c, h.c[0].x, h.c[0].y)).sort((a, b) => a.o.a - b.o.a)[0];
      if (host) host.shape.holes.push(new THREE.Path(h.c));
    }
    const all = pts;
    return {
      shapes: shapes.map((sh) => sh.shape), outers: outers.map((o) => o.c), holes: holes.map((h) => h.c),
      width: (x1 - x0) * s, height: cap,
      ink: (px, py) => { let n = 0; for (const c of all) if (contains(c, px, py)) n++; return n % 2 === 1; },
    };
  }
  // Points inside the ink of a word, from a seeded generator.
  function inkSamples(word, n, R) {
    const out = [];
    for (let tries = 0; out.length < n && tries < n * 40; tries++) {
      const x = (R() - 0.5) * word.width, y = (R() - 0.5) * word.height;
      if (word.ink(x, y)) out.push([x, y]);
    }
    return out;
  }
  const canvasTexture = (w, h, paint) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; paint(c.getContext("2d"), w, h);
    return new THREE.CanvasTexture(c);
  };
  // The shared renderer keeps state between tiles, so each frame sets what it relies on.
  const prepare = (clear) => { const R3 = FX.R3; R3.setRenderTarget(null); R3.setScissorTest(false); R3.autoClear = true; R3.setClearColor(clear, 1); return R3; };
  const VERT_UV = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  const pulse = (t, a, rise, fall) => (t < a ? 0 : t < a + rise ? (t - a) / rise : Math.exp(-(t - a - rise) / fall));

  // ================= Chrome monogram =================
  // Environment: an equirectangular studio painted on a canvas. u = 0.75 faces the camera, u = 0.5 is +x, v = 1 is up.
  function paintStudio(g, W, H) {
    const sky = g.createLinearGradient(0, 0, 0, H / 2);
    sky.addColorStop(0, "#0d1d3a"); sky.addColorStop(0.75, "#081226"); sky.addColorStop(1, "#05080f");
    g.fillStyle = sky; g.fillRect(0, 0, W, H / 2);
    const floor = g.createLinearGradient(0, H / 2, 0, H);
    floor.addColorStop(0, "#090b11"); floor.addColorStop(1, "#020306");
    g.fillStyle = floor; g.fillRect(0, H / 2, W, H / 2);
    // warm horizon: a thin hot line with a glow above it, all the way round
    const glow = g.createLinearGradient(0, H * 0.43, 0, H * 0.5);
    glow.addColorStop(0, "rgba(255,120,40,0)"); glow.addColorStop(1, "rgba(255,140,60,0.55)");
    g.fillStyle = glow; g.fillRect(0, H * 0.43, W, H * 0.07);
    g.fillStyle = "#ffb070"; g.fillRect(0, H * 0.497, W, H * 0.012);
    // three sharp softboxes: a long overhead strip, and tall strips on either side of the badge
    const box = (u0, u1, e0, e1, col) => { const y0 = (0.5 - e1 / 180) * H, y1 = (0.5 - e0 / 180) * H; g.fillStyle = col; g.fillRect(u0 * W, y0, (u1 - u0) * W, y1 - y0); };
    g.filter = "blur(1.5px)";
    box(0.56, 0.94, 50, 57, "#f4f7ff");      // overhead strip: every top bevel
    box(0.535, 0.565, -4, 62, "#f4f8ff");    // right strip: right-facing bevels as the badge turns
    box(0.03, 0.06, -4, 58, "#f4f8ff");      // left strip
    box(0.62, 0.88, 6.5, 9, "#e8f0ff");      // low card behind the camera: a crisp band across the faces
    box(0.66, 0.84, 24, 30, "#c9d8ff");      // and a dimmer one above it
    g.filter = "none";
  }
  function glintTexture() {
    return canvasTexture(512, 512, (g, W, H) => {
      const core = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.14);
      core.addColorStop(0, "rgba(255,255,255,1)"); core.addColorStop(0.3, "rgba(255,244,225,0.55)"); core.addColorStop(1, "rgba(255,230,200,0)");
      g.fillStyle = core; g.fillRect(0, 0, W, H);
      const streak = (len, thick, angle, alpha) => {
        g.save(); g.translate(W / 2, H / 2); g.rotate(angle);
        const s = g.createLinearGradient(-len / 2, 0, len / 2, 0);   // bright along most of its length, so the streak reads long
        s.addColorStop(0, "rgba(255,255,255,0)"); s.addColorStop(0.12, `rgba(255,255,255,${alpha * 0.55})`); s.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
        s.addColorStop(0.88, `rgba(255,255,255,${alpha * 0.55})`); s.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = s; g.beginPath(); g.ellipse(0, 0, len / 2, thick, 0, 0, Math.PI * 2); g.fill(); g.restore();
      };
      streak(W, 4.2, 0, 1); streak(W * 0.42, 2.6, Math.PI / 2, 0.9); streak(W * 0.2, 1.6, Math.PI / 4, 0.6); streak(W * 0.2, 1.6, -Math.PI / 4, 0.6);
    });
  }

  const CH_P = 8;
  demo({ id: "chrome", gl: true, name: "Chrome monogram", kind: "shader", stacks: ["three", "canvas"],
    chips: ["PBR metal", "PMREM softbox environment", "mirrored floor reflection", "UnrealBloomPass"], grade: "A+",
    purpose: "A heavy bevelled monogram in polished chrome. Three sharp softboxes and a warm horizon are painted on a canvas; when the badge turns, their reflections sweep across every bevel and a star glint flares.",
    period: CH_P, hero: 1.3,
    build(s) {
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, GW / GH, 0.1, 100);
      scene.background = canvasTexture(16, 256, (g, W, H) => {
        const b = g.createLinearGradient(0, 0, 0, H); b.addColorStop(0, "#0b1a36"); b.addColorStop(0.62, "#050912"); b.addColorStop(1, "#020306");
        g.fillStyle = b; g.fillRect(0, 0, W, H);
      });
      const studio = canvasTexture(2048, 1024, paintStudio); studio.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(FX.R3), env = pm.fromEquirectangular(studio).texture; pm.dispose();
      const metal = new THREE.MeshStandardMaterial({ color: 0xf3f5f9, metalness: 1, roughness: 0.13, envMap: env, envMapIntensity: 0.1 });
      const rim = new THREE.DirectionalLight(0xcfe0ff, 2.8); rim.position.set(1.5, 5, -6); scene.add(rim);
      const rim2 = new THREE.DirectionalLight(0xffc89a, 1.6); rim2.position.set(-6, 3, -2); scene.add(rim2);
      const rim3 = new THREE.DirectionalLight(0x9fc0ff, 1.2); rim3.position.set(-2, 6, -5); scene.add(rim3);
      // A dark glossy floor: the mirrored copy shows through it, fading with distance.
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false,
        map: canvasTexture(512, 512, (g, W, H) => {
          const r = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
          r.addColorStop(0, "rgba(6,10,20,0.5)"); r.addColorStop(0.09, "rgba(6,10,20,0.66)"); r.addColorStop(0.3, "rgba(4,6,12,0.97)"); r.addColorStop(1, "rgba(2,3,6,1)");
          g.fillStyle = r; g.fillRect(0, 0, W, H);
        }) }));
      floor.rotation.x = -Math.PI / 2; floor.renderOrder = 1; scene.add(floor);
      const holder = new THREE.Group(), mirror = new THREE.Group(); mirror.scale.y = -1; scene.add(holder, mirror);
      const glints = [];
      const CAP = 2.6, LIFT = 0.07;
      const ready = loadOutlines().then((data) => {
        const word = wordShapes(data, "FX", CAP, 10);
        const bevel = 0.13;
        const geo = new THREE.ExtrudeGeometry(word.shapes, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.16, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 3, curveSegments: 10, steps: 1 });
        geo.center(); geo.translate(0, CAP / 2 + LIFT, 0);
        holder.add(new THREE.Mesh(geo, metal)); mirror.add(new THREE.Mesh(geo, metal));
        const tex = glintTexture();
        for (const [x, y] of [[-word.width / 2 + 0.08, CAP + LIFT - 0.06], [word.width / 2 - 0.12, CAP + LIFT - 0.1]]) {
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
          sp.position.set(x, y, 0.45); sp.visible = false; holder.add(sp); glints.push(sp);
        }
      });
      const comp = composer(scene, cam, 0.32, 0.35, 0.82);
      // Turn: hold with only the rims lit, a fast 35° turn on the cue, then a slow turntable back to the start.
      const yaw = (t) => {
        const a0 = -0.33, a1 = a0 + 0.61;
        if (t < 0.8) return a0 + 0.015 * Math.sin(t * 2.2);
        if (t < 1.6) return a0 + 0.61 * back(lin(0.8, 1.6, t));
        return a1 - 0.61 * inOut(lin(1.6, CH_P, t)) + 0.05 * Math.sin((t - 1.6) * 0.9) * (1 - lin(6.5, CH_P, t));
      };
      return { ready, frame: (t) => {
        const on = smooth(0.78, 0.98, t) * (1 - smooth(7.25, 7.95, t));
        const flash = pulse(t, 0.8, 0.12, 0.35) + 0.7 * pulse(t, 5.0, 0.1, 0.3);
        metal.envMapIntensity = 0.1 + 1.18 * on + 0.35 * flash;
        rim.intensity = 2.8 + 1.5 * flash;
        rim3.position.set(-7 + 12 * smooth(-0.2, 1.0, t < 4 ? t : t - CH_P), 6, -5);   // a rim light slides across while the studio is dark
        const a = yaw(t), tilt = -0.06 + 0.02 * Math.sin(t * 0.7);
        holder.rotation.set(tilt, a, 0); mirror.rotation.set(-tilt, a, 0);
        glints.forEach((g, i) => {
          const at = i === 0 ? 0.95 : 5.05, k = pulse(t, at, 0.09, 0.22) * (t < at + 0.9 ? 1 : 0);
          g.visible = k > 0.01; g.scale.setScalar(3.8 * (0.4 + 0.6 * k));
          g.material.opacity = Math.min(1, k * 1.2); g.material.rotation = 0.06 * Math.sin(t * 3 + i);
        });
        const z = 10.6 - 1.5 * inOut(lin(0, 7.25, t)) + 1.5 * inOut(lin(7.25, CH_P, t));
        cam.position.set(0.35 * Math.sin(t * 0.4), 0.72, z); cam.lookAt(0, 1.38, 0);
        comp.bloom.strength = 0.3 + 0.3 * flash;
        prepare(0x020306); comp.render(1 / 60); blit();
      } };
    } });

  // ================= Burn dissolve =================
  const DS_P = 6;
  // Fronts in "burn coordinate" d (≈ 0 at the lower-left corner of the word, ≈ 1 at the upper-right).
  const sweep = (a, b, t) => { const x = lin(a, b, t); return -0.06 + 1.16 * (0.55 * x + 0.45 * x * x * (3 - 2 * x)); };
  const burnLo = (t) => sweep(0.7, 2.4, t);             // GONE burns away from the lower-left corner
  const buildHi = (t) => sweep(1.0, 2.7, t) - 0.015;    // BACK assembles 0.3 s behind the fire
  const swapAt = (t) => -0.06 + 1.16 * smooth(4.95, 5.8, t);   // for the loop, one cold front turns BACK into GONE
  const invert = (f, d, a, b) => { let lo = a, hi = b; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (f(m) < d) lo = m; else hi = m; } return (lo + hi) / 2; };
  demo({ id: "dissolve", gl: true, name: "Burn dissolve", kind: "shader", stacks: ["three", "glsl"],
    chips: ["onBeforeCompile shader patch", "directional noise threshold", "GPU embers", "UnrealBloomPass"], grade: "B",
    purpose: "A burn front crosses a plaster word from one corner: white-hot, then orange, then char. Embers lift off the edge, and a new word assembles behind the fire with a cold cyan edge.",
    period: DS_P, hero: 1.55,
    build(s) {
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, GW / GH, 0.1, 100);
      scene.background = canvasTexture(256, 144, (g, W, H) => {
        const b = g.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.5, W * 0.62);
        b.addColorStop(0, "#26201f"); b.addColorStop(0.55, "#121014"); b.addColorStop(1, "#060508");
        g.fillStyle = b; g.fillRect(0, 0, W, H);
      });
      scene.add(new THREE.HemisphereLight(0xbfcbe8, 0x2a1c16, 0.42));
      const key = new THREE.DirectionalLight(0xfff0d8, 0.78); key.position.set(-4, 5, 5); scene.add(key);
      const side = new THREE.DirectionalLight(0x9fb4ff, 0.22); side.position.set(6, -1, 2); scene.add(side);
      const fire = new THREE.PointLight(0xff6a1a, 0, 5, 2); scene.add(fire);
      const group = new THREE.Group(); scene.add(group);
      const DIR = new THREE.Vector2(), ORIGIN = new THREE.Vector2(); let LEN = 1;
      const plaster = (u) => {
        const m = new THREE.MeshStandardMaterial({ color: 0xddd2c0, roughness: 0.9, metalness: 0 });
        m.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, u);
          sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vObj;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
          sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>\nvarying vec3 vObj;\nuniform float uLo, uHi, uFireLo, uLen;\nuniform vec2 uOrigin, uDir;\n${NOISE}`)
            .replace("#include <dithering_fragment>", `#include <dithering_fragment>
              float u = dot(vObj.xy - uOrigin, uDir) / uLen;
              float d = 0.8*u + 0.2*(0.65*noise3(vObj*1.6) + 0.35*noise3(vObj*4.8));
              float eLo = d - uLo, eHi = uHi - d;
              if (eLo < 0.0 || eHi < 0.0) discard;
              vec3 col = gl_FragColor.rgb;
              vec3 cyan = vec3(0.35, 0.92, 1.0), ice = vec3(0.86, 1.0, 1.0);
              if (uFireLo > 0.5) {
                col = mix(col, col*vec3(0.12, 0.08, 0.07), 1.0 - smoothstep(0.022, 0.06, eLo));
                col = mix(col, vec3(1.0, 0.42, 0.07), 1.0 - smoothstep(0.009, 0.026, eLo));
                col = mix(col, vec3(1.0, 0.95, 0.82), 1.0 - smoothstep(0.0, 0.009, eLo));
              } else {
                col = mix(col, cyan, 1.0 - smoothstep(0.0, 0.026, eLo));
                col = mix(col, ice, 1.0 - smoothstep(0.0, 0.007, eLo));
              }
              col = mix(col, cyan, 1.0 - smoothstep(0.0, 0.026, eHi));
              col = mix(col, ice, 1.0 - smoothstep(0.0, 0.007, eHi));
              gl_FragColor.rgb = col;`);
        };
        return m;
      };
      const common = { uOrigin: { value: ORIGIN }, uDir: { value: DIR }, uLen: { value: 1 } };
      const uGone = { ...common, uLo: { value: -1 }, uHi: { value: 2 }, uFireLo: { value: 1 } };
      const uBack = { ...common, uLo: { value: -1 }, uHi: { value: -1 }, uFireLo: { value: 0 } };
      // Embers (kind 0) lift off the burning edge; cyan motes (kind 1) fly into each assembling edge.
      const emberGeo = new THREE.BufferGeometry();
      const eu = { uT: { value: 0 }, uPx: { value: PX } };
      const embers = new THREE.Points(emberGeo, new THREE.ShaderMaterial({ uniforms: eu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `attribute vec3 aStart; attribute vec4 aSeed; attribute vec2 aTime; uniform float uT, uPx; varying vec3 vCol; varying float vA;
          void main(){
            float kind = aTime.y, age = uT - aTime.x, ash = step(0.78, aSeed.w), life = kind < 0.5 ? mix(0.7 + 0.8*aSeed.x, 2.4 + 0.9*aSeed.x, ash) : 0.75;
            vec3 p = aStart; vA = 0.0; vCol = vec3(0.0);
            if (kind < 0.5) {
              if (age >= 0.0 && age <= life) {
                float a = age * mix(1.0, 0.42, ash);   // a fifth of them are slow ash that lingers after the fire
                p += vec3(0.9 + 1.3*aSeed.y, 1.0 + 1.4*aSeed.z, 1.2*(aSeed.w - 0.25)) * a * (1.0 - 0.22*a);
                p += vec3(sin(a*4.1 + aSeed.z*6.283), cos(a*3.3 + aSeed.w*6.283), sin(a*2.7 + aSeed.y*6.283)) * 0.3 * a;
                p.y += 0.7*a*a;
                float h = 1.0 - a/life;
                vCol = mix(vec3(0.85, 0.12, 0.03), mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.93, 0.7), smoothstep(0.55, 0.95, h)), smoothstep(0.1, 0.5, h));
                vA = h*h*(0.55 + 0.45*sin(a*23.0 + aSeed.x*40.0)*0.5 + 0.25);
              }
            } else {
              float k = -age / 0.6;                 // > 0 before arrival
              if (k > 0.0 && k < 1.0) {
                vec3 off = normalize(vec3(aSeed.y - 0.15, aSeed.z - 0.35, aSeed.w - 0.5) + 0.001) * (0.6 + 1.1*aSeed.x);
                p += off * k*k;
                vCol = vec3(0.45, 0.95, 1.0); vA = (1.0 - k)*0.9;
              } else if (age >= 0.0 && age < 0.25) { vCol = vec3(0.8, 1.0, 1.0); vA = 1.0 - age/0.25; }
            }
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = vA > 0.0 ? (2.2 + 3.4*aSeed.x) * uPx * 10.0 / -mv.z : 0.0;
          }`,
        fragmentShader: `varying vec3 vCol; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float r = dot(c, c); if (r > 0.25 || vA <= 0.0) discard; gl_FragColor = vec4(vCol, vA*(1.0 - 3.2*r)); }` }));
      embers.frustumCulled = false;
      const ignite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
        map: canvasTexture(128, 128, (g, W) => { const r = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); r.addColorStop(0, "rgba(255,240,210,1)"); r.addColorStop(0.25, "rgba(255,140,40,0.7)"); r.addColorStop(1, "rgba(255,80,20,0)"); g.fillStyle = r; g.fillRect(0, 0, W, W); }) }));
      let gone = null, backWord = null;
      const ready = loadOutlines().then((data) => {
        const CAP = 1.72, DEPTH = 0.5, extrude = { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelOffset: -0.03, bevelSegments: 2, curveSegments: 8 };
        const wa = wordShapes(data, "GONE", CAP), wb = wordShapes(data, "BACK", CAP);
        const scale = 8.2 / wa.width;   // GONE is 8.2 world units wide; BACK uses the same letter height
        const mk = (w, u) => { const g = new THREE.ExtrudeGeometry(w.shapes, extrude); g.translate(0, 0, -DEPTH / 2); g.scale(scale, scale, 1); const m = new THREE.Mesh(g, plaster(u)); group.add(m); return m; };
        gone = mk(wa, uGone); backWord = mk(wb, uBack);
        const W = Math.max(wa.width, wb.width) * scale, H = CAP * scale;
        ORIGIN.set(-W / 2, -H / 2); DIR.set(W, H * 1.6).normalize(); LEN = DIR.x * W + DIR.y * H; common.uLen.value = LEN;
        // Particle set: embers on GONE, motes into BACK, motes into GONE for the loop.
        const R = rng(6011), dOf = (x, y) => 0.8 * ((x - ORIGIN.x) * DIR.x + (y - ORIGIN.y) * DIR.y) / LEN + 0.2 * (0.3 + 0.4 * R());
        const start = [], seed = [], time = [];
        const add = (w, n, kind, front, a, b, z) => {
          for (const [x, y] of inkSamples(w, n, R)) {
            const px = x * scale, py = y * scale, d = dOf(px, py);
            start.push(px, py, z); seed.push(R(), R(), R(), R());
            time.push(invert(front, d, a, b) + (kind ? 0 : 0.02 * R()), kind);
          }
        };
        add(wa, 1500, 0, burnLo, 0.7, 2.4, DEPTH / 2 + 0.02);
        add(wb, 650, 1, buildHi, 1.0, 2.7, DEPTH / 2 + 0.02);
        add(wa, 420, 1, swapAt, 4.95, 5.8, DEPTH / 2 + 0.02);
        emberGeo.setAttribute("position", new THREE.Float32BufferAttribute(start, 3));
        emberGeo.setAttribute("aStart", new THREE.Float32BufferAttribute(start, 3));
        emberGeo.setAttribute("aSeed", new THREE.Float32BufferAttribute(seed, 4));
        emberGeo.setAttribute("aTime", new THREE.Float32BufferAttribute(time, 2));
        group.add(embers);
        const corner = new THREE.Vector3(ORIGIN.x + 0.25, ORIGIN.y + 0.2, DEPTH / 2 + 0.05);
        ignite.position.copy(corner); group.add(ignite); fire.position.set(corner.x, corner.y, 1.2);
      });
      const comp = composer(scene, cam, 0.7, 0.45, 0.86);
      return { ready, frame: (t) => {
        const loop = t >= 4.5;
        uGone.uLo.value = loop ? -1 : burnLo(t); uGone.uHi.value = loop ? swapAt(t) : 2; uGone.uFireLo.value = 1;
        uBack.uLo.value = loop ? swapAt(t) : -1; uBack.uHi.value = loop ? 2 : buildHi(t);
        eu.uT.value = t;
        // ignition: a flickering ember at the corner, a flash on the cue, then the fire travels with the front
        const flick = 0.55 + 0.45 * Math.sin(t * 31) * Math.sin(t * 17.3 + 1.1);
        const flash = pulse(t, 0.7, 0.06, 0.28);
        const pre = 1 - lin(0.68, 0.8, t);
        ignite.scale.setScalar((0.35 + 0.25 * flick) * pre + 1.5 * flash);
        ignite.material.opacity = Math.min(1, 0.75 * pre * (0.6 + 0.4 * flick) + 0.9 * flash);
        const lo = burnLo(t), along = clamp(lo, 0, 1) * LEN / 0.8;
        if (gone) fire.position.set(ORIGIN.x + DIR.x * along, ORIGIN.y + DIR.y * along, 1.1);
        fire.intensity = (t < 0.7 ? 0.35 * flick : t < 2.5 ? 0.9 + 1.4 * flash : 0.9 * (1 - lin(2.5, 2.9, t))) * (loop ? 0 : 1);
        group.rotation.set(0.05 + 0.03 * Math.sin(t * 0.8), -0.12 + 0.08 * Math.sin((t / DS_P) * Math.PI * 2), 0);
        // after the fire the camera drifts round the new word and the key light follows, then both return for the loop
        const u = t < 0.7 ? t + DS_P : t, orbit = smooth(2.3, 4.9, u) - smooth(4.9, DS_P + 0.7, u);   // the return runs on into the next loop's wait
        cam.position.set(-1.4 + 2.8 * orbit, 0.25 + 0.5 * orbit, 10.4 - 0.5 * Math.sin((t / DS_P) * Math.PI)); cam.lookAt(0, 0.08, 0);
        key.position.set(-4 + 7 * orbit, 5 - 1.5 * orbit, 5);
        comp.bloom.strength = 0.65 + 0.9 * flash;
        prepare(0x060508); comp.render(1 / 60); blit();
      } };
    } });

  // ================= Light through a stencilled wall =================
  const RY_P = 8;
  const LV0 = 0.42, LV1 = 1.3;   // louvre angle closed (a sliver of light leaks past each slat) and open, radians
  const louvre = (t) => LV0 + (LV1 - LV0) * (outCubic(lin(1.0, 1.4, t)) - inOut(lin(6.7, 7.6, t)));
  demo({ id: "rays", gl: true, name: "Light through a stencil", kind: "shader", stacks: ["three", "glsl", "canvas"],
    chips: ["occlusion pass + radial blur (light scattering)", "UnrealBloomPass", "depth-tested dust lit by the beams"], grade: "B",
    purpose: "Light waits behind a wall with the word OPEN cut through it. The louvres behind the letters snap open, beams scatter toward the camera, and dust drifts through them.",
    period: RY_P, hero: 2.4,
    build(s) {
      const blit = glTile(s), R3 = FX.R3, cam = new THREE.PerspectiveCamera(40, GW / GH, 0.1, 100);
      const scene = new THREE.Scene(), occ = new THREE.Scene();
      scene.background = canvasTexture(256, 144, (g, W, H) => {
        const b = g.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.45, W * 0.7);
        b.addColorStop(0, "#1d4a56"); b.addColorStop(0.55, "#0c222a"); b.addColorStop(1, "#040a0d");
        g.fillStyle = b; g.fillRect(0, 0, W, H);
      });
      const hw = Math.ceil(GW / 2), hh = Math.ceil(GH / 2);
      const occRT = new THREE.WebGLRenderTarget(hw, hh), rayRT = new THREE.WebGLRenderTarget(hw, hh);
      const LIGHT = new THREE.Vector3(0.4, 1.9, -5);
      const glowTex = canvasTexture(256, 256, (g, W) => {
        const r = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
        r.addColorStop(0, "rgba(255,246,220,1)"); r.addColorStop(0.18, "rgba(255,196,110,1)"); r.addColorStop(0.55, "rgba(255,138,40,0.65)"); r.addColorStop(1, "rgba(255,110,30,0)");
        g.fillStyle = r; g.fillRect(0, 0, W, W);
      });
      const lampMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false });
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), lampMat); lamp.position.copy(LIGHT); scene.add(lamp);
      const lampOcc = new THREE.Mesh(lamp.geometry, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false })); lampOcc.position.copy(LIGHT); occ.add(lampOcc);
      const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
      scene.add(new THREE.HemisphereLight(0x6ab4c8, 0x0a1418, 1.0));
      const leak = new THREE.PointLight(0xffa04a, 0, 9, 1.4); leak.position.set(0.3, 0.8, -2.2); scene.add(leak);
      const grime = canvasTexture(512, 288, (g, W, H) => {
        const R = rng(31); g.fillStyle = "#3a4347"; g.fillRect(0, 0, W, H);
        for (let i = 0; i < 2600; i++) { const v = 40 + R() * 40; g.fillStyle = `rgba(${v},${v + 8},${v + 12},${0.08 + R() * 0.1})`; g.fillRect(R() * W, R() * H, 1 + R() * 3, 1 + R() * 3); }
        for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(10,14,16,${0.05 + R() * 0.08})`; g.fillRect(R() * W, R() * H * 0.2 + R() * H, 2 + R() * 3, 20 + R() * 120); }
      });
      grime.wrapS = grime.wrapT = THREE.RepeatWrapping;
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xc4d6da, map: grime, roughness: 0.92, metalness: 0 });
      const slatMat = new THREE.MeshStandardMaterial({ color: 0x2c2520, roughness: 0.7 });
      const slats = [], slatsOcc = [];
      const SLATS = 17, SPAN = 3.1, PITCH = SPAN / SLATS;
      for (let i = 0; i < SLATS; i++) {
        const geo = new THREE.BoxGeometry(11.5, PITCH * 0.97, 0.035), y = -SPAN / 2 + (i + 0.5) * PITCH;
        const a = new THREE.Mesh(geo, slatMat), b = new THREE.Mesh(geo, black);
        a.position.set(0, y, -0.95); b.position.copy(a.position); scene.add(a); occ.add(b); slats.push(a); slatsOcc.push(b);
      }
      // Dust: drifting points, bright only where a beam passes (they read the scattered-light buffer).
      const N = 1100, R = rng(808), pos = new Float32Array(N * 3), seed = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) { pos[i * 3] = (R() - 0.5) * 15; pos[i * 3 + 1] = (R() - 0.5) * 8.5; pos[i * 3 + 2] = 0.4 + R() * 7.5; for (let k = 0; k < 4; k++) seed[i * 4 + k] = R(); }
      const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); dustGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
      const du = { uT: { value: 0 }, uPx: { value: PX }, tRays: { value: rayRT.texture }, uRes: { value: new THREE.Vector2(GW, GH) }, uOpen: { value: 0 } };
      const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({ uniforms: du, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `attribute vec4 aSeed; uniform float uT, uPx; varying float vS;
          void main(){
            vec3 p = position;
            p.x += 0.35*sin(uT*(0.25 + 0.3*aSeed.x) + aSeed.y*6.283) + 0.12*uT;
            p.y += 0.3*sin(uT*(0.2 + 0.25*aSeed.z) + aSeed.w*6.283) - 0.05*uT;
            p.z += 0.2*sin(uT*0.3 + aSeed.x*9.0);
            vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
            vS = aSeed.y;
            gl_PointSize = (2.0 + 4.5*aSeed.x*aSeed.x) * uPx * 11.0 / -mv.z;
          }`,
        fragmentShader: `uniform sampler2D tRays; uniform vec2 uRes; uniform float uOpen; varying float vS;
          void main(){ vec2 c = gl_PointCoord - 0.5; float r = dot(c, c); if (r > 0.25) discard;
            vec3 ray = texture2D(tRays, gl_FragCoord.xy / uRes).rgb;
            float lit = 0.1 + 3.2*dot(ray, vec3(0.33));
            gl_FragColor = vec4(vec3(1.0, 0.82, 0.55)*lit, (1.0 - 3.6*r)*(0.45 + 0.55*vS)); }` }));
      dust.frustumCulled = false; scene.add(dust);
      // Radial blur of the occlusion buffer toward the light's screen position.
      const blurU = { tOcc: { value: occRT.texture }, uLight: { value: new THREE.Vector2(0.5, 0.6) }, uDecay: { value: 0.982 }, uWeight: { value: 0.038 }, uDensity: { value: 1.0 } };
      const blurScene = new THREE.Scene(), ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const blurQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: blurU, vertexShader: VERT_UV, depthTest: false, depthWrite: false,
        fragmentShader: `uniform sampler2D tOcc; uniform vec2 uLight; uniform float uDecay, uWeight, uDensity; varying vec2 vUv;
          void main(){ vec2 uv = vUv, step = (vUv - uLight) * uDensity / 90.0; float w = 1.0; vec3 acc = vec3(0.0);
            for (int i = 0; i < 90; i++) { uv -= step; acc += texture2D(tOcc, uv).rgb * w; w *= uDecay; }
            gl_FragColor = vec4(acc * uWeight, 1.0); }` }));
      blurQuad.frustumCulled = false; blurScene.add(blurQuad);
      const comp = composer(scene, cam, 0.7, 0.5, 0.55);
      const mixPass = new THREE.ShaderPass({ uniforms: { tDiffuse: { value: null }, tRays: { value: rayRT.texture }, uGain: { value: 1 } }, vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: `uniform sampler2D tDiffuse, tRays; uniform float uGain; varying vec2 vUv;
          void main(){ vec3 base = texture2D(tDiffuse, vUv).rgb, ray = texture2D(tRays, vUv).rgb * uGain;
            vec3 air = vec3(0.025, 0.07, 0.085)*(1.15 - 0.6*vUv.y);   // teal haze, so the amber beams have a cold room to cross
            gl_FragColor = vec4(base + air + ray*vec3(1.0, 0.68, 0.33) + ray*ray*0.18, 1.0); }` });
      mixPass.uniforms.tRays.value = rayRT.texture;   // ShaderPass clones its uniforms, which would copy the target texture
      comp.insertPass(mixPass, 1);
      let ready = loadOutlines().then((data) => {
        const word = wordShapes(data, "OPEN", 2.55, 8);
        const wall = new THREE.Shape([new THREE.Vector2(-14, -9), new THREE.Vector2(14, -9), new THREE.Vector2(14, 9), new THREE.Vector2(-14, 9)]);
        for (const o of word.outers) wall.holes.push(new THREE.Path(o));
        const islands = word.holes.map((h) => new THREE.Shape(h));   // the counters of O and P stay in the wall
        const geo = new THREE.ExtrudeGeometry([wall, ...islands], { depth: 0.32, bevelEnabled: false, curveSegments: 8 });
        geo.translate(0, 0, -0.16);
        const uvScale = 1 / 9; const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale, uv.getY(i) * uvScale);
        scene.add(new THREE.Mesh(geo, wallMat)); occ.add(new THREE.Mesh(geo, black));
      });
      const proj = new THREE.Vector3();
      return { ready, frame: (t, abs = t) => {
        const open = (louvre(t) - LV0) / (LV1 - LV0), burst = pulse(t, 1.0, 0.18, 0.45);
        slats.forEach((m, i) => { const a = louvre(t) + 0.04 * Math.sin(t * 1.3 + i * 0.4) * open; m.rotation.x = a; slatsOcc[i].rotation.x = a; });
        // the light behind sways a little, so the beams breathe
        const lx = LIGHT.x + 0.5 * Math.sin(t * 0.55), ly = LIGHT.y + 0.25 * Math.sin(t * 0.8 + 1);
        lamp.position.set(lx, ly, LIGHT.z); lampOcc.position.copy(lamp.position);
        const warm = (1 - open) * smooth(0.1, 0.9, t) * (0.5 + 0.5 * Math.sin(t * 23) * Math.sin(t * 7.1));   // the light behind stirs before the louvres open
        const glow = 0.55 + 0.45 * open + 0.6 * burst + 0.35 * warm;
        lampOcc.material.color.setScalar(glow); lampMat.color.setScalar(0.5 + 0.5 * open);
        leak.intensity = 0.35 + 3.2 * open + 3 * burst + 1.2 * warm;
        // the word sits in the upper half of the frame, so the beams have the lower half to pour through
        cam.position.set(0.9 * Math.sin((t / RY_P) * Math.PI * 2 - 0.6), -0.7 + 0.15 * Math.sin((t / RY_P) * Math.PI * 4), 11.2 - 0.5 * open); cam.lookAt(0, -1.25, 0);
        cam.updateMatrixWorld(); proj.copy(lamp.position).project(cam);
        blurU.uLight.value.set(proj.x * 0.5 + 0.5, proj.y * 0.5 + 0.5);
        du.uT.value = t; du.uOpen.value = open;
        mixPass.uniforms.uGain.value = 0.8 + 0.6 * burst;
        comp.bloom.strength = 0.6 + 1.3 * burst;
        R3.setScissorTest(false); R3.autoClear = true; R3.setClearColor(0x000000, 1);
        R3.setRenderTarget(occRT); R3.render(occ, cam);
        R3.setRenderTarget(rayRT); R3.render(blurScene, ortho);
        prepare(0x03080a); comp.render(1 / 60); blit();
      } };
    } });

  // ================= Liquid glass over a poster =================
  const LQ_P = 8;
  const HEAD_Y = 352;   // where the lens travels, in pixels of a 720-high poster
  function paintPoster(g, W, H) {
    const u = H / 720;
    g.fillStyle = "#f2eee5"; g.fillRect(0, 0, W, H);
    // twelve-column grid and baseline ticks
    g.strokeStyle = "rgba(30,30,40,0.12)"; g.lineWidth = Math.max(1, u);
    for (let i = 0; i <= 12; i++) { const x = 60 * u + i * (W - 120 * u) / 12; g.beginPath(); g.moveTo(x, 40 * u); g.lineTo(x, H - 40 * u); g.stroke(); }
    for (let y = 40 * u; y < H - 30 * u; y += 30 * u) { g.beginPath(); g.moveTo(52 * u, y); g.lineTo(60 * u, y); g.stroke(); }
    g.fillStyle = "#ff4b2b"; g.beginPath(); g.arc(W - 262 * u, 190 * u, 118 * u, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#111014"; g.textBaseline = "alphabetic";
    g.font = `700 ${17 * u}px ${MONO}`; g.textAlign = "left";
    g.fillText("OPTICS SERIES — NO. 07", 62 * u, 82 * u);
    g.textAlign = "right"; g.fillText("REFRACTION · DISPERSION · FOCUS", W - 62 * u, 82 * u);
    // the headline and the line the lens reads across
    g.textAlign = "center"; g.font = `900 ${206 * u}px ${LAT}`;
    g.fillText("LIQUID", W / 2, 318 * u);
    g.font = `800 ${40 * u}px ${LAT}`; g.letterSpacing = `${3 * u}px`;
    g.fillText("BENDS · MAGNIFIES · SPLITS LIGHT", W / 2, 398 * u); g.letterSpacing = "0px";
    g.fillStyle = "#1f4bff"; g.fillRect(60 * u, 470 * u, W - 120 * u, 8 * u);
    g.fillStyle = "#111014";
    g.font = `800 ${46 * u}px ${LAT}`; g.textAlign = "left"; g.fillText("GLASS", 62 * u, 560 * u);
    g.font = `500 ${17 * u}px ${MONO}`;
    g.fillText("A lens magnifies the type beneath it", 262 * u, 538 * u);
    g.fillText("and splits red, green and blue at its rim.", 262 * u, 562 * u);
    g.textAlign = "right"; g.font = `800 ${46 * u}px ${LAT}`; g.fillText("1.45×", W - 62 * u, 560 * u);
    g.font = `700 ${15 * u}px ${MONO}`; g.textAlign = "left";
    g.fillText("01", 62 * u, H - 52 * u); g.textAlign = "right"; g.fillText("MOTION FX LAB · LIGHT", W - 62 * u, H - 52 * u);
  }
  demo({ id: "liquid", gl: true, name: "Liquid glass lens", kind: "shader", stacks: ["three", "glsl", "canvas"], chips: ["custom GLSL refraction", "height-field lens", "dispersion"], grade: "B",
    purpose: "Two drops of glass slide over a poster, merge on the headline and magnify it, splitting red, green and blue at the rim. A screen-space height field bends the image; there is no 3D transparent body.",
    period: LQ_P, hero: 2.3,
    build(s) {
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const bgc = document.createElement("canvas"); bgc.width = GW; bgc.height = GH; const g = bgc.getContext("2d");
      const tex = new THREE.CanvasTexture(bgc); tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      const paint = () => { paintPoster(g, GW, GH); tex.needsUpdate = true; };
      paint();
      const ready = Promise.all([document.fonts.load(`900 100px ${LAT}`, "LIQUID"), document.fonts.load(`800 46px ${LAT}`, "GLASS BENDS"), document.fonts.load(`700 17px ${MONO}`, "OPTICS")]).then(paint);
      const u = { uTex: { value: tex }, uAspect: { value: GH / GW }, uC1: { value: new THREE.Vector3() }, uC2: { value: new THREE.Vector3() }, uMag: { value: 1.45 }, uRim: { value: 0 } };
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT_UV,
        fragmentShader: `uniform sampler2D uTex; uniform float uAspect, uMag, uRim; uniform vec3 uC1, uC2; varying vec2 vUv;
          float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0 - h); }
          float sd1(vec2 p){ return length(p - uC1.xy) - uC1.z; }
          float sd2(vec2 p){ return length(p - uC2.xy) - uC2.z; }
          float field(vec2 p){ return smin(sd1(p), sd2(p), 0.09); }
          vec2 toUv(vec2 p){ return vec2(p.x, (p.y - 0.5)/uAspect + 0.5); }
          vec3 tap(vec2 p){ return texture2D(uTex, toUv(p)).rgb; }
          void main(){
            vec2 p = vec2(vUv.x, (vUv.y - 0.5)*uAspect + 0.5);   // width units, so drops stay round
            float d = field(p);
            float inside = smoothstep(0.0025, -0.0025, d);
            vec2 e = vec2(0.0015, 0.0);
            vec2 n = normalize(vec2(field(p + e.xy) - field(p - e.xy), field(p + e.yx) - field(p - e.yx)) + 1e-6);
            // optical centre: the nearer drop's centre, blended across the neck when they merge
            float w1 = exp(-28.0*sd1(p)), w2 = exp(-28.0*sd2(p));
            vec2 c = (w1*uC1.xy + w2*uC2.xy) / (w1 + w2);
            float depth = clamp(-d/0.075, 0.0, 1.0), edge = (1.0 - depth)*(1.0 - depth);
            // magnify about the centre; near the rim the thick edge pulls the image further in, per channel
            vec2 r = p - c, pull = n*edge*0.034;
            vec3 glass = vec3(tap(c + r/(uMag*0.965) - pull*0.9).r, tap(c + r/uMag - pull).g, tap(c + r/(uMag*1.035) - pull*1.12).b);
            glass = glass*(0.95 + 0.07*depth) + vec3(0.015, 0.025, 0.045)*(1.0 - depth);
            vec3 base = texture2D(uTex, vUv).rgb;
            float rim = smoothstep(0.006, 0.0, abs(d))*(0.55 + 0.45*uRim);
            vec3 nn = normalize(vec3(n*(1.0 - depth)*1.3, 1.0));
            float spec = pow(max(0.0, dot(nn, normalize(vec3(-0.45, 0.55, 0.7)))), 70.0)*inside;
            float spec2 = pow(max(0.0, dot(nn, normalize(vec3(0.5, -0.45, 0.75)))), 22.0)*inside*0.3;
            float sh = smoothstep(0.035, -0.01, field(p - vec2(0.012, -0.018)))*(1.0 - inside)*0.2;   // soft contact shadow
            vec3 col = mix(base*(1.0 - sh), glass, inside) + rim*0.8 + (spec + spec2)*0.9;
            gl_FragColor = vec4(col, 1.0); }` })));
      // Path: two drops slide in along the headline, merge with a wobble, drift, then split and slide out.
      const headY = 0.5 + (0.5 - HEAD_Y / 720) * (GH / GW);   // the lens path, in the shader's width units
      const pos = (t) => {
        const inK = smooth(0, 1.55, t), outK = smooth(6.1, LQ_P, t), merged = smooth(1.35, 1.75, t) * (1 - smooth(5.9, 6.4, t));
        const drift = 0.2 * Math.sin(((t - 1.7) / 4.4) * Math.PI) * merged;
        const sep = 0.035 + 0.02 * Math.sin(t * 1.7) * merged;
        let x1 = 0.08 + (0.4 - 0.08) * inK, x2 = 0.92 - (0.92 - 0.6) * inK;
        x1 = x1 + (0.5 - sep + drift - x1) * merged; x2 = x2 + (0.5 + sep + drift - x2) * merged;
        x1 += (0.08 - x1) * outK; x2 += (0.92 - x2) * outK;
        return [x1, x2];
      };
      return { ready, frame: (t) => {
        const [x1, x2] = pos(t);
        const wob = t > 1.6 ? Math.exp(-(t - 1.6) * 4.2) * Math.sin((t - 1.6) * 26) : 0;
        const r1 = 0.112 * (1 + 0.1 * wob), r2 = 0.094 * (1 - 0.1 * wob);
        const bob = 0.012 * Math.sin(t * 1.3);
        u.uC1.value.set(x1, headY + bob, r1); u.uC2.value.set(x2, headY - bob * 0.6, r2);
        u.uMag.value = 1.45 + 0.28 * Math.max(0, wob) * (t < 3 ? 1 : 0) + 0.12 * pulse(t, 1.55, 0.12, 0.4);
        u.uRim.value = pulse(t, 1.55, 0.1, 0.35);
        prepare(0x000000).render(scene, cam); blit();
      } };
    } });
})();
