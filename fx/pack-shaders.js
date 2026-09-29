// Motion FX Lab: shader effects. Registers tiles with FX.demo; see fx/demos.js for the building blocks.
// Four GPU tiles after effects seen in a Threads video by @designer.riven: clay shapes ray-marched from
// distance functions, an endless lattice made by domain repetition, one object in five post-shader styles,
// and 200,000 particles placed by the vertex shader. Each frame is a pure function of t, like every tile.
(() => {
  const FX = window.FX;
  const { demo, glTile, rng, GW, GH, LAT } = FX;
  const { lin, smooth, inOut } = FX.helpers;
  const SEEN = "Threads · @designer.riven";
  const MONO = '"JetBrains Mono", Menlo, monospace';
  const TAU = Math.PI * 2;

  // A full-screen quad with its own orthographic camera. The fragment shader reads gl_FragCoord.
  function fullscreen(fragmentShader, uniforms) {
    const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mat = new THREE.ShaderMaterial({ uniforms, fragmentShader, depthTest: false, depthWrite: false,
      vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }" });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; scene.add(quad);
    return { scene, cam };
  }
  // Every GL tile shares FX.R3, so a frame sets each piece of renderer state it relies on.
  function toCanvas(scene, cam) {
    const R3 = FX.R3;
    R3.setRenderTarget(null); R3.setScissorTest(false); R3.autoClear = true; R3.setClearColor(0x000000, 1);
    R3.render(scene, cam);
  }
  // A caption drawn into the tile's own canvas after the blit, so it is part of the frame's pixels.
  function tag(g, text, x, y) {
    g.font = `700 19px ${MONO}`; g.textBaseline = "middle"; g.textAlign = "left";
    const w = Math.ceil(g.measureText(text).width) + 26, h = 34, r = 17;
    g.fillStyle = "rgba(14, 12, 18, 0.84)";
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill();
    g.fillStyle = "#ffffff"; g.fillText(text, x + 13, y + h / 2 + 1);
  }
  const labelFont = () => document.fonts.load(`700 19px ${MONO}`, "sdSphere(mix) 1/5 ASCII");

  const SDF = `
    float sdRoundBox(vec3 p, vec3 b, float r){ vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
    float sdTorus(vec3 p, vec2 t){ return length(vec2(length(p.xy) - t.x, p.z)) - t.y; }
    float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0 - h); }`;

  // ---------- 1. clay shapes, ray-marched ----------
  const CLAY_P = 10;
  demo({ id: "clay", gl: true, name: "Clay 3D by ray marching", status: "add", stacks: ["three", "glsl"],
    chips: ["GLSL ray marching", "signed distance fields", "smooth union", "soft shadow + AO"], grade: "B",
    purpose: "Soft, hand-made-looking 3D with no model at all: every pixel marches a ray through distance functions, so shapes morph and melt into each other for free. Good for a playful product or topic intro.",
    seen: SEEN, period: CLAY_P, hero: 7.9,
    build(s) {
      const blit = glTile(s), g = s.lastElementChild.getContext("2d");
      const u = { uRes: { value: new THREE.Vector2(GW, GH) }, uCam: { value: new THREE.Vector3() }, uTgt: { value: new THREE.Vector3(0, -0.2, 0) },
        uW: { value: new THREE.Vector4(1, 0, 0, 0) }, uRot: { value: new THREE.Matrix3() }, uLift: { value: 0 }, uBlob: { value: new THREE.Vector3() } };
      const { scene, cam } = fullscreen(`
        uniform vec2 uRes; uniform vec3 uCam, uTgt, uBlob; uniform vec4 uW; uniform mat3 uRot; uniform float uLift;
        ${FX.NOISE}
        ${SDF}
        const float FLOOR = -1.4;
        // The four shapes share one distance function; uW blends them (weights sum to 1), which is how they morph.
        float clay(vec3 p){
          vec3 q = uRot * (p - vec3(0.0, uLift, 0.0));
          float d = 0.0;
          if (uW.x > 0.0) d += uW.x * (length(q) - 0.9);
          if (uW.y > 0.0) d += uW.y * sdRoundBox(q, vec3(0.54), 0.2);
          if (uW.z > 0.0) d += uW.z * sdTorus(q, vec2(0.72, 0.3));
          if (uW.w > 0.0) d += uW.w * smin(length(q - uBlob) - 0.56, length(q + uBlob) - 0.47, 0.45);
          if (d < 0.08) d += 0.014 * (noise3(q * 4.5) - 0.5);   // thumb-pressed dents, only near the surface
          return d;
        }
        vec3 normal(vec3 p){ vec2 e = vec2(0.0015, -0.0015);
          return normalize(e.xyy*clay(p + e.xyy) + e.yyx*clay(p + e.yyx) + e.yxy*clay(p + e.yxy) + e.xxx*clay(p + e.xxx)); }
        float shadow(vec3 ro, vec3 rd){ float res = 1.0, t = 0.04;
          for (int i = 0; i < 40; i++){ float h = clay(ro + rd*t); res = min(res, 7.0*h/t); t += clamp(h, 0.02, 0.35); if (res < 0.003 || t > 7.0) break; }
          res = clamp(res, 0.0, 1.0); return res*res*(3.0 - 2.0*res); }
        float occlusion(vec3 p, vec3 n){ float o = 0.0, w = 1.0;
          for (int i = 0; i < 5; i++){ float h = 0.02 + 0.11*float(i); float d = min(clay(p + n*h), p.y + n.y*h - FLOOR); o += (h - d)*w; w *= 0.85; }
          return clamp(1.0 - 2.4*o, 0.0, 1.0); }
        void main(){
          vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / uRes.y;
          vec3 ww = normalize(uTgt - uCam), uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0))), vv = cross(uu, ww);
          vec3 ro = uCam, rd = normalize(uv.x*uu + uv.y*vv + 1.6*ww);
          vec3 L = normalize(vec3(-0.62, 0.9, 0.42));
          vec3 bg = mix(vec3(0.006, 0.005, 0.008), vec3(0.02, 0.017, 0.024), smoothstep(-0.5, 0.5, uv.y));
          float tF = rd.y < 0.0 ? (FLOOR - ro.y) / rd.y : 1e5;
          // march only inside the sphere that bounds the clay
          float tO = -1.0; vec3 oc = ro - vec3(0.0, uLift, 0.0);
          float b = dot(oc, rd), c = dot(oc, oc) - 4.4, disc = b*b - c;
          if (disc > 0.0){
            float t = max(-b - sqrt(disc), 0.0), t1 = min(-b + sqrt(disc), tF);
            for (int i = 0; i < 100; i++){ float h = clay(ro + rd*t); if (h < 0.0004*t){ tO = t; break; } t += h; if (t > t1) break; }
          }
          vec3 col = bg; float tHit = 1e5;
          if (tO > 0.0){
            vec3 p = ro + rd*tO, n = normal(p); tHit = tO;
            vec3 q = uRot * (p - vec3(0.0, uLift, 0.0));
            float sh = shadow(p + n*0.01, L), ao = occlusion(p, n);
            float dif = clamp(dot(n, L), 0.0, 1.0), wrap = clamp(0.5 + 0.5*dot(n, L), 0.0, 1.0);
            float sky = clamp(0.5 + 0.5*n.y, 0.0, 1.0), fre = pow(clamp(1.0 + dot(n, rd), 0.0, 1.0), 2.5);
            float spe = pow(clamp(dot(n, normalize(L - rd)), 0.0, 1.0), 18.0) * dif * sh;
            vec3 alb = vec3(0.85, 0.16, 0.035) * (0.88 + 0.24*noise3(q*7.0));
            vec3 li = 2.0*dif*sh*vec3(1.0, 0.9, 0.8) + 0.42*sky*ao*vec3(0.45, 0.5, 0.72)
                    + 0.34*wrap*wrap*ao*vec3(1.0, 0.42, 0.22) + 0.4*fre*ao*vec3(1.0, 0.68, 0.5);
            col = alb*li + 0.16*spe*vec3(1.0, 0.95, 0.9);
          } else if (tF < 1e4){
            vec3 p = ro + rd*tF; tHit = tF;
            float sh = shadow(p + vec3(0.0, 0.01, 0.0), L);
            float ao = mix(0.3, 1.0, smoothstep(0.0, 1.0, clay(p + vec3(0.0, 0.2, 0.0))));
            float pool = exp(-0.11*dot(p.xz, p.xz));
            col = vec3(0.03, 0.026, 0.034) * (0.25 + 2.2*sh*pool*L.y) * ao;
            col += vec3(0.06, 0.012, 0.003) * exp(-2.2*max(clay(p), 0.0)) * pool;   // warm bounce from the clay
          }
          col = mix(col, bg, 1.0 - exp(-0.0022*tHit*tHit));
          col = clamp(col*(2.51*col + 0.03) / (col*(2.43*col + 0.59) + 0.14), 0.0, 1.0);
          col = pow(col, vec3(0.4545));
          col *= 1.0 - 0.35*dot(uv, uv);
          gl_FragColor = vec4(col, 1.0);
        }`, u);
      const NAMES = ["sdSphere", "sdRoundBox", "sdTorus", "smin(a, b)"];
      const rot = new THREE.Matrix4(), eul = new THREE.Euler();
      const draw = (t) => {
        const a = smooth(1.6, 2.5, t), b = smooth(4.1, 5.0, t), c = smooth(6.1, 7.0, t), d = smooth(8.8, 9.7, t);
        u.uW.value.set(1 - a + d, a * (1 - b), b * (1 - c), c * (1 - d));
        const ph = (t / CLAY_P) * TAU;
        rot.makeRotationFromEuler(eul.set(0.38 + 0.12 * Math.sin(ph), ph + 0.5, 0.1 * Math.sin(2 * ph)));
        u.uRot.value.setFromMatrix4(rot).transpose();   // world to object space
        u.uLift.value = 0.07 * Math.sin(3 * ph);
        // the blobs start on the torus ring (radius 0.72, plane z = 0), so the ring gathers into them, then they merge
        const sep = 0.72 - 0.46 * smooth(7.0, 8.8, t), ba = 1.6 + 0.5 * (t - 6.1);
        u.uBlob.value.set(Math.cos(ba) * sep, Math.sin(ba) * sep, 0);
        const az = 0.5 + 0.32 * Math.sin(ph);
        u.uCam.value.set(5.7 * Math.sin(az), 1.5 + 0.15 * Math.sin(2 * ph), 5.7 * Math.cos(az));
        toCanvas(scene, cam); blit();
        // the caption names the distance function on screen, or the morph between two of them
        const k = [a, b, c, d], i = k.findIndex((x) => x > 0 && x < 1), held = k.lastIndexOf(1) + 1;
        tag(g, i >= 0 ? `mix(${NAMES[i]}, ${NAMES[(i + 1) % 4]}, ${k[i].toFixed(2)})` : NAMES[d === 1 ? 0 : held], 22, GH - 56);
      };
      return { ready: labelFont(), frame: draw };
    } });

  // ---------- 2. an endless lattice by domain repetition ----------
  const GRID_P = 8, CELL = 2, SPEED = 2;   // SPEED * GRID_P is a whole number of cells, so the loop is seamless
  demo({ id: "domainrep", gl: true, name: "Infinite grid by domain repetition", status: "add", stacks: ["three", "glsl"],
    chips: ["GLSL ray marching", "mod() domain repetition", "thin-film iridescence", "distance fog"], grade: "B",
    purpose: "One rounded box, repeated forever by a single mod(), and a camera flying through the lattice. The colours are thin-film interference, like soap or a beetle shell, and shift with the viewing angle. A title background that never runs out.",
    seen: SEEN, period: GRID_P, hero: 2.2,
    build(s) {
      const blit = glTile(s);
      const u = { uRes: { value: new THREE.Vector2(GW, GH) }, uCam: { value: new THREE.Vector3() }, uView: { value: new THREE.Matrix3() } };
      const { scene, cam } = fullscreen(`
        uniform vec2 uRes; uniform vec3 uCam; uniform mat3 uView;
        ${FX.NOISE}
        ${SDF}
        const float C = ${CELL.toFixed(1)};
        // mod() folds all of space into one cell, so one box is every box
        float map(vec3 p){ vec3 q = mod(p + 0.5*C, C) - 0.5*C; return sdRoundBox(q, vec3(0.3), 0.15); }
        vec3 normal(vec3 p){ vec2 e = vec2(0.001, -0.001);
          return normalize(e.xyy*map(p + e.xyy) + e.yyx*map(p + e.yyx) + e.yxy*map(p + e.yxy) + e.xxx*map(p + e.xxx)); }
        // reflectance of a thin film (index 1.33, thickness nm) in air, per RGB wavelength
        vec3 film(float cosI, float nm){
          float cosT = sqrt(1.0 - (1.0 - cosI*cosI) / 1.7689);
          return 0.5 - 0.5*cos(6.2831853 * 2.0*1.33*nm*cosT / vec3(650.0, 540.0, 455.0));
        }
        vec3 render(vec2 fc){
          vec2 uv = (fc - 0.5*uRes) / uRes.y;
          vec3 ro = uCam, rd = normalize(uView * vec3(uv, -1.15));
          float glow = pow(max(-rd.z, 0.0), 12.0);
          vec3 fogc = vec3(0.004, 0.004, 0.012) + vec3(0.08, 0.022, 0.12)*glow;
          float t = 0.02, hit = -1.0;
          for (int i = 0; i < 128; i++){ float h = map(ro + rd*t); if (h < 0.0006*t + 0.0004){ hit = t; break; } t += h; if (t > 34.0) break; }
          vec3 col = fogc;
          if (hit > 0.0){
            vec3 p = ro + rd*hit, n = normal(p);
            vec3 cell = floor((p + 0.5*C) / C);
            vec3 key = vec3(cell.xy, mod(cell.z, ${(SPEED * GRID_P / CELL).toFixed(1)}));   // colours repeat with the cells one loop flies past
            vec3 q = p - cell*C;
            float cosI = clamp(dot(n, -rd), 0.0, 1.0);
            float nm = 180.0 + 300.0*hash31(key + 0.37) + 160.0*(noise3(q*1.8 + key*3.1) - 0.5);
            vec3 irid = film(cosI, nm);
            vec3 r = reflect(rd, n);
            // a dark studio to reflect: a soft light above and the glow at the end of the corridor
            float env = 0.1 + 1.1*pow(clamp(0.5 + 0.5*r.y, 0.0, 1.0), 3.0) + 1.4*pow(max(-r.z, 0.0), 6.0);
            float fre = 0.3 + 0.7*pow(1.0 - cosI, 3.0);
            float ao = clamp(0.3 + 0.7*map(p + n*0.3)/0.3, 0.0, 1.0);
            float spe = pow(clamp(dot(r, normalize(vec3(-0.3, 0.8, -0.4))), 0.0, 1.0), 60.0);
            col = vec3(0.006, 0.005, 0.01) + 1.2*irid*env*fre*ao + 1.2*spe*vec3(1.0, 0.95, 1.0);
            col = mix(col, fogc, 1.0 - exp(-0.14*hit));
          }
          return col;
        }
        void main(){
          // four rays a pixel on a rotated grid: the far lattice is finer than a pixel and shimmers without them
          vec2 fc = gl_FragCoord.xy, uv = (fc - 0.5*uRes) / uRes.y;
          vec3 col = 0.25*(render(fc + vec2(0.125, 0.375)) + render(fc + vec2(0.375, -0.125)) + render(fc + vec2(-0.125, -0.375)) + render(fc + vec2(-0.375, 0.125)));
          col = clamp(col*(2.51*col + 0.03) / (col*(2.43*col + 0.59) + 0.14), 0.0, 1.0);
          col = pow(col, vec3(0.4545));
          col *= 1.0 - 0.3*dot(uv, uv);
          gl_FragColor = vec4(col, 1.0);
        }`, u);
      const m4 = new THREE.Matrix4(), eul = new THREE.Euler(0, 0, 0, "YXZ");
      return (t) => {
        const ph = (t / GRID_P) * TAU;
        // the camera flies down the gap between boxes; t = GRID_P lands on the view of t = 0
        u.uCam.value.set(CELL / 2 + 0.24 * Math.sin(ph), CELL / 2 + 0.2 * Math.sin(2 * ph + 0.7), -SPEED * t);
        m4.makeRotationFromEuler(eul.set(0.12 * Math.sin(ph + 1.1), 0.26 * Math.sin(ph), 0.35 * Math.sin(ph + 2.2)));
        u.uView.value.setFromMatrix4(m4);
        toCanvas(scene, cam); blit();
      };
    } });

  // ---------- 3. one object, five shader styles ----------
  const STYLES = ["BAYER DITHER", "HALFTONE", "ASCII", "PIXEL SORT", "RISOGRAPH"], SLOT = 1.5;
  const GLYPHS = " .:-=+*#%@";
  demo({ id: "styles", gl: true, name: "One object, five shader styles", status: "add", stacks: ["three", "glsl", "canvas"],
    chips: ["WebGLRenderTarget", "post-process ShaderMaterial", "Bayer matrix", "Canvas glyph atlas"], grade: "B",
    purpose: "A lit torus knot is drawn once into an offscreen target, then one post shader turns it into ordered dither, halftone dots, ASCII, pixel sort or a two-ink risograph. These styles suit shapes and backgrounds, not dense CJK text: see the tile “Halftone or dither on CJK text”.",
    seen: SEEN, period: STYLES.length * SLOT, hero: 3.75,
    build(s) {
      const blit = glTile(s), g = s.lastElementChild.getContext("2d");
      const rt = new THREE.WebGLRenderTarget(GW, GH, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      const kScene = new THREE.Scene(), kCam = new THREE.PerspectiveCamera(35, GW / GH, 0.1, 50);
      kCam.position.set(0, 0, 8.2);
      const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.0, 0.34, 256, 40, 2, 3),
        new THREE.MeshStandardMaterial({ color: 0xf2dcec, roughness: 0.4, metalness: 0.05 }));
      knot.material.toneMapped = false; kScene.add(knot);
      kScene.add(new THREE.AmbientLight(0xffffff, 0.05));
      const warm = new THREE.DirectionalLight(0xff8a4c, 0.95); warm.position.set(-4, 3, 4); kScene.add(warm);
      const cool = new THREE.DirectionalLight(0x3f6bff, 0.9); cool.position.set(5, -2, 2); kScene.add(cool);
      const top = new THREE.DirectionalLight(0xffffff, 0.35); top.position.set(1, 5, 6); kScene.add(top);

      // glyph atlas: ten characters from light to dense, 16 x 24 px each, twice the 8 x 12 cell they fill on screen
      const atlas = document.createElement("canvas"); atlas.width = 16 * GLYPHS.length; atlas.height = 24;
      const ag = atlas.getContext("2d"), glyphTex = new THREE.CanvasTexture(atlas);
      glyphTex.minFilter = glyphTex.magFilter = THREE.LinearFilter; glyphTex.generateMipmaps = false;
      const paintAtlas = () => {
        ag.fillStyle = "#000"; ag.fillRect(0, 0, atlas.width, atlas.height);
        ag.fillStyle = "#fff"; ag.font = `700 21px ${MONO}`; ag.textAlign = "center"; ag.textBaseline = "middle";
        [...GLYPHS].forEach((ch, i) => ag.fillText(ch, i * 16 + 8, 13));
        glyphTex.needsUpdate = true;
      };
      paintAtlas();
      const ready = Promise.all([labelFont(), document.fonts.load(`700 21px ${MONO}`, GLYPHS).then(paintAtlas)]);

      const u = { uRes: { value: new THREE.Vector2(GW, GH) }, uScene: { value: rt.texture }, uGlyphs: { value: glyphTex },
        uCur: { value: 0 }, uNext: { value: 1 }, uWipe: { value: 0 }, uAge: { value: 0 } };
      const post = fullscreen(`
        uniform vec2 uRes; uniform sampler2D uScene, uGlyphs; uniform float uCur, uNext, uWipe, uAge;
        float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
        float hash21(vec2 p){ vec2 q = fract(p*vec2(0.1293, 0.1571) + vec2(0.31, 0.77)); q += dot(q, q.yx + 23.17); return fract(q.x*q.y*41.3); }
        // the rendered knot over a backdrop with a soft centre light; bgA in the middle, bgB at the edges
        vec3 src(vec2 fc, vec3 bgA, vec3 bgB){
          vec4 s = texture2D(uScene, fc / uRes);
          vec2 d = (fc / uRes - vec2(0.5, 0.56)) * vec2(1.0, 1.25);
          return mix(mix(bgA, bgB, smoothstep(0.05, 0.75, length(d))), s.rgb, s.a);
        }
        float bayer2(vec2 a){ a = floor(a); return fract(a.x*0.5 + a.y*a.y*0.75); }
        float bayer8(vec2 a){ return bayer2(0.25*a)*0.0625 + bayer2(0.5*a)*0.25 + bayer2(a); }
        vec3 dither(vec2 fc){
          vec2 cell = floor(fc / 3.0);
          float l = clamp(lum(src(cell*3.0 + 1.5, vec3(0.3, 0.26, 0.36), vec3(0.05, 0.04, 0.07)))*1.15, 0.0, 1.0);
          float k = floor(l*3.0 + bayer8(cell) + 1.0/128.0);
          return k < 0.5 ? vec3(0.08, 0.05, 0.14) : k < 1.5 ? vec3(0.42, 0.18, 0.55) : k < 2.5 ? vec3(1.0, 0.44, 0.7) : vec3(1.0, 0.92, 0.78);
        }
        vec3 halftone(vec2 fc){
          const float S = 10.0; const float CA = 0.7071068;
          vec2 r = mat2(CA, CA, -CA, CA) * fc, cell = floor(r / S) + 0.5;
          vec2 ctr = mat2(CA, -CA, CA, CA) * (cell*S);
          float ink = 1.0 - lum(src(ctr, vec3(1.0), vec3(0.86)));
          float rad = sqrt(clamp(ink, 0.0, 1.0)) * S * 0.74;
          float cov = 1.0 - smoothstep(rad - 0.7, rad + 0.7, length(r - cell*S));
          return mix(vec3(1.0, 0.83, 0.0), vec3(0.1, 0.09, 0.13), cov);
        }
        vec3 ascii(vec2 fc){
          vec2 CS = vec2(8.0, 12.0), cell = floor(fc / CS), f = fract(fc / CS);
          vec3 c = src((cell + 0.5)*CS, vec3(0.2, 0.17, 0.26), vec3(0.03, 0.03, 0.04));
          float gi = floor(clamp(lum(c)*1.2, 0.0, 0.999) * 10.0);
          float a = texture2D(uGlyphs, vec2((gi + f.x) / 10.0, f.y)).r;
          return mix(vec3(0.02, 0.02, 0.03), c*1.35 + vec3(0.12, 0.1, 0.12), a);
        }
        // one pass, no sorting: each pixel looks up the column for a brighter pixel whose streak reaches it
        vec3 pixelsort(vec2 fc){
          vec3 BA = vec3(0.14, 0.1, 0.2), BB = vec3(0.03, 0.02, 0.05);
          vec3 best = src(fc, BA, BB); float bl = lum(best);
          float grow = smoothstep(0.0, 0.9, uAge), colLen = 270.0 * (0.2 + 0.9*hash21(vec2(floor(fc.x / 2.0), 7.0)));
          for (int i = 1; i <= 64; i++){
            float d = float(i) * 4.0;
            vec3 s = src(fc + vec2(0.0, d), BA, BB); float ls = lum(s);
            float len = colLen * grow * smoothstep(0.18, 0.7, ls);
            if (d < len){ vec3 v = mix(s, s*0.45, d / len); float lv = lum(v); if (lv > bl){ best = v; bl = lv; } }
          }
          return best;
        }
        vec3 riso(vec2 fc){
          vec3 PAPER = vec3(0.95, 0.93, 0.87), PINK = vec3(1.0, 0.28, 0.62), BLUE = vec3(0.12, 0.33, 0.72);
          vec3 a = src(fc + vec2(2.5, -1.5), vec3(0.95), vec3(0.8)), b = src(fc + vec2(-2.0, 2.0), vec3(0.95), vec3(0.8));
          float dp = clamp((a.r - a.b)*0.9 + (1.0 - lum(a))*0.55, 0.0, 1.0);
          float db = clamp((1.0 - lum(b))*1.1 - 0.12 + (b.b - b.r)*0.5, 0.0, 1.0);
          vec2 gcell = floor(fc / 2.0);
          float cp = smoothstep(0.0, 0.25, dp - hash21(gcell)), cb = smoothstep(0.0, 0.25, db - hash21(gcell + 71.3));
          vec3 col = PAPER * (0.94 + 0.06*hash21(fc*1.7 + 3.1));
          col *= mix(vec3(1.0), PINK, cp*0.92); col *= mix(vec3(1.0), BLUE, cb*0.88);
          return col;
        }
        vec3 style(float id, vec2 fc){
          if (id < 0.5) return dither(fc);
          if (id < 1.5) return halftone(fc);
          if (id < 2.5) return ascii(fc);
          if (id < 3.5) return pixelsort(fc);
          return riso(fc);
        }
        void main(){
          vec2 fc = gl_FragCoord.xy;
          float s = (fc.x + (uRes.y - fc.y)*0.5) / (uRes.x + uRes.y*0.5), e = uWipe*1.08 - 0.04;
          vec3 col = s < e ? style(uNext, fc) : style(uCur, fc);
          col = mix(col, vec3(1.0, 0.56, 0.91), (1.0 - smoothstep(0.0, 0.005, abs(s - e))) * step(0.001, uWipe) * step(uWipe, 0.999));
          gl_FragColor = vec4(col, 1.0);
        }`, u);
      return { ready, frame: (t) => {
        const slot = Math.min(STYLES.length - 1, Math.floor(t / SLOT)), local = t - slot * SLOT, wipe = inOut(lin(SLOT - 0.3, SLOT, local));
        u.uCur.value = slot; u.uNext.value = (slot + 1) % STYLES.length; u.uWipe.value = wipe; u.uAge.value = local;
        const ph = (t / (STYLES.length * SLOT)) * TAU;
        knot.rotation.set(0.5 + 0.25 * Math.sin(ph), ph, 0.15 * Math.sin(2 * ph));
        const R3 = FX.R3;
        R3.setScissorTest(false); R3.autoClear = true;
        R3.setRenderTarget(rt); R3.setClearColor(0x000000, 0); R3.render(kScene, kCam);
        R3.setRenderTarget(null); R3.setClearColor(0x000000, 1); R3.render(post.scene, post.cam);
        blit();
        const k = wipe > 0.5 ? (slot + 1) % STYLES.length : slot;
        tag(g, `${k + 1}/${STYLES.length} ${STYLES[k]}`, 22, GH - 56);
      } };
    } });

  // ---------- 4. 200,000 particles placed by the vertex shader ----------
  const NOISE_D = `
    // gradient noise with its analytic derivative: returns (value, d/dx, d/dy, d/dz)
    vec3 grad3(vec3 c){
      vec3 p = fract(c * vec3(0.1537, 0.1291, 0.1873) + vec3(0.137, 0.581, 0.391));
      p += dot(p, p.zxy + 21.17);
      return fract(vec3(p.x*p.y, p.y*p.z, p.z*p.x) * 57.31 + p.zxy) * 2.0 - 1.0;
    }
    vec4 gnoise(vec3 x){
      vec3 i = floor(x), f = fract(x);
      vec3 u = f*f*f*(f*(f*6.0 - 15.0) + 10.0), du = 30.0*f*f*(f*(f - 2.0) + 1.0);
      vec3 ga = grad3(i), gb = grad3(i + vec3(1.0, 0.0, 0.0)), gc = grad3(i + vec3(0.0, 1.0, 0.0)), gd = grad3(i + vec3(1.0, 1.0, 0.0));
      vec3 ge = grad3(i + vec3(0.0, 0.0, 1.0)), gf = grad3(i + vec3(1.0, 0.0, 1.0)), gg = grad3(i + vec3(0.0, 1.0, 1.0)), gh = grad3(i + vec3(1.0, 1.0, 1.0));
      float va = dot(ga, f), vb = dot(gb, f - vec3(1.0, 0.0, 0.0)), vc = dot(gc, f - vec3(0.0, 1.0, 0.0)), vd = dot(gd, f - vec3(1.0, 1.0, 0.0));
      float ve = dot(ge, f - vec3(0.0, 0.0, 1.0)), vf = dot(gf, f - vec3(1.0, 0.0, 1.0)), vg = dot(gg, f - vec3(0.0, 1.0, 1.0)), vh = dot(gh, f - vec3(1.0, 1.0, 1.0));
      float k1 = vb - va, k2 = vc - va, k3 = ve - va, k4 = va - vb - vc + vd, k5 = va - vc - ve + vg, k6 = va - vb - ve + vf, k7 = -va + vb + vc - vd + ve - vf - vg + vh;
      float v = va + k1*u.x + k2*u.y + k3*u.z + k4*u.x*u.y + k5*u.y*u.z + k6*u.z*u.x + k7*u.x*u.y*u.z;
      vec3 g = ga + u.x*(gb - ga) + u.y*(gc - ga) + u.z*(ge - ga) + u.x*u.y*(ga - gb - gc + gd) + u.y*u.z*(ga - gc - ge + gg)
             + u.z*u.x*(ga - gb - ge + gf) + u.x*u.y*u.z*(-ga + gb + gc - gd + ge - gf - gg + gh);
      g += du * vec3(k1 + k4*u.y + k6*u.z + k7*u.y*u.z, k2 + k5*u.z + k4*u.x + k7*u.z*u.x, k3 + k6*u.x + k5*u.y + k7*u.x*u.y);
      return vec4(v, g);
    }
    // curl of a vector potential made of three noises: a divergence-free flow, so particles swirl instead of bunching
    vec3 curl(vec3 p){
      vec4 a = gnoise(p), b = gnoise(p + vec3(31.4, 12.7, 7.1)), c = gnoise(p + vec3(-5.9, 47.3, 23.3));
      return vec3(c.z - b.w, a.w - c.y, b.y - a.z);
    }`;
  const GP_P = 8;
  demo({ id: "gpuparticles", gl: true, name: "200,000 GPU particles", status: "add", stacks: ["three", "glsl", "canvas"],
    chips: ["Points + ShaderMaterial", "curl noise in the vertex shader", "Canvas-sampled text", "UnrealBloomPass"], grade: "B",
    purpose: "Fifty times the points of the CPU particle tile: each vertex works out its own position from t, streaming along a torus knot, then flowing through curl noise into the letters and back. Nothing is stored between frames, so any moment renders on its own.",
    seen: SEEN, period: GP_P, hero: 4.7,
    build(s) {
      const N = 200000, blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, GW / GH, 0.1, 100);
      const R = rng(4242), tube = new Float32Array(N * 3), seed = new Float32Array(N * 4), text = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        for (let k = 0; k < 3; k++) tube[i * 3 + k] = (R() + R() + R() - 1.5) * 0.15;
        for (let k = 0; k < 4; k++) seed[i * 4 + k] = R();
      }
      // targets: random points inside the letters "FX", drawn on a canvas and read back
      const cw = 900, ch = 600, tc = document.createElement("canvas"); tc.width = cw; tc.height = ch;
      const tg = tc.getContext("2d", { willReadFrequently: true });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(tube, 3));
      geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
      geo.setAttribute("aText", new THREE.BufferAttribute(text, 3));
      const sampleText = () => {
        tg.clearRect(0, 0, cw, ch); tg.fillStyle = "#fff"; tg.textAlign = "center"; tg.textBaseline = "middle";
        tg.font = `900 440px ${LAT}`; tg.fillText("FX", cw / 2, ch / 2);
        const d = tg.getImageData(0, 0, cw, ch).data, px = [];
        let x0 = cw, x1 = 0, y0 = ch, y1 = 0;
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 127) {
          px.push(x, y); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        const T = rng(99), n = px.length / 2, sc = 3.5 / Math.max(1, x1 - x0), cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;
        for (let i = 0; i < N; i++) {
          const k = Math.floor(T() * n) * 2;
          text[i * 3] = (px[k] + T() - cx) * sc; text[i * 3 + 1] = (cy - px[k + 1] - T()) * sc; text[i * 3 + 2] = (T() - 0.5) * 0.35;
        }
        geo.attributes.aText.needsUpdate = true;
      };
      sampleText();
      const ready = document.fonts.load(`900 440px ${LAT}`, "FX").then(sampleText);
      const u = { uT: { value: 0 }, uP: { value: GP_P } };
      const pts = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `
          attribute vec4 aSeed; attribute vec3 aText;
          uniform float uT, uP;
          varying vec3 vCol; varying float vA;
          ${NOISE_D}
          vec3 knot(float s){ float r = 1.0 + 0.45*cos(3.0*s); return vec3(r*cos(2.0*s), r*sin(2.0*s), 0.45*sin(3.0*s)) * 1.2; }
          void main(){
            float ph = uT / uP * 6.2831853;
            // on the knot: each particle streams once round the curve per loop, while the knot turns
            float s = aSeed.x*6.2831853 + ph;
            vec3 k = knot(s) + position;
            float cz = cos(ph), sz = sin(ph), cy = cos(0.5*sin(ph)), sy = sin(0.5*sin(ph));
            k = vec3(cz*k.x - sz*k.y, sz*k.x + cz*k.y, k.z);
            k = vec3(cy*k.x + sy*k.z, k.y, -sy*k.x + cy*k.z);
            float dl = aSeed.y*0.7;
            float m = smoothstep(2.3 + dl, 3.5 + dl, uT) * (1.0 - smoothstep(5.9 + dl, 7.1 + dl, uT));
            float swirl = 4.0*m*(1.0 - m);
            vec3 p = mix(k, aText, m);
            // three short steps through the curl field, from a start that depends on t alone
            vec3 drift = vec3(cos(ph), sin(ph), 0.0) * 1.2;
            float amp = (mix(0.045, 0.025, m) + 0.65*swirl) * (0.6 + 0.8*aSeed.z);
            for (int i = 0; i < 3; i++) p += curl(p*0.8 + drift) * amp * 0.33;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (1.1 + 1.2*aSeed.z) * 7.4 / -mv.z;
            vec3 pink = vec3(1.0, 0.45, 0.88), violet = vec3(0.5, 0.34, 1.0), pale = vec3(1.0, 0.86, 0.96), cyan = vec3(0.35, 0.88, 1.0);
            vCol = mix(mix(mix(violet, pink, aSeed.w), mix(pink, pale, aSeed.w), m), cyan, swirl*0.7*aSeed.z);
            vA = 0.07 + 0.035*m + 0.1*swirl;
          }`,
        fragmentShader: `
          varying vec3 vCol; varying float vA;
          void main(){ vec2 c = gl_PointCoord - 0.5; float r = dot(c, c); if (r > 0.25) discard; gl_FragColor = vec4(vCol, vA*(1.0 - 3.0*r)); }` }));
      pts.frustumCulled = false; scene.add(pts);
      const comp = FX.composer(scene, cam, 0.55, 0.35, 0.45);
      return { ready, frame: (t) => {
        u.uT.value = t;
        const ph = (t / GP_P) * TAU, yaw = 0.3 * Math.sin(ph);
        cam.position.set(7.4 * Math.sin(yaw), 0.35 * Math.sin(2 * ph), 7.4 * Math.cos(yaw)); cam.lookAt(0, 0, 0);
        const R3 = FX.R3;
        R3.setRenderTarget(null); R3.setScissorTest(false); R3.autoClear = true; R3.setClearColor(0x07060b, 1);
        comp.render(1 / 60); R3.setRenderTarget(null); blit();
      } };
    } });
})();
