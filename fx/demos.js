// Motion FX Lab: every effect is build(stage) -> frame(t, abs), a pure function of time.
// build() may return the frame function, or { frame, ready } when it waits for fonts.
// 3D tiles share one WebGL renderer (R3) and copy its canvas into their own tile canvas.
// Load order: three.js r128 and its examples, fx/font-helvetiker-subset.js, then this file.
(() => {
  // ---------- timing helpers ----------
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lin = (a, b, x) => clamp((x - a) / (b - a));
  const smooth = (a, b, x) => { const k = lin(a, b, x); return k * k * (3 - 2 * k); };
  const outCubic = (x) => 1 - Math.pow(1 - x, 3);
  const inCubic = (x) => x * x * x;
  const inOut = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const back = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const q = (s, sel) => s.querySelector(sel);
  const qa = (s, sel) => [...s.querySelectorAll(sel)];
  const ZH = '"Noto Sans TC", "PingFang HK", sans-serif';
  const LAT = '"Archivo", "Helvetica Neue", Arial, sans-serif';

  const DEMOS = [];
  const demo = (o) => DEMOS.push(o);

  // ================= 2D effects =================
  demo({ id: "whip", name: "Whip-in letters + motion blur", kind: "type", stacks: ["svg", "css"], chips: ["SVG feGaussianBlur", "engine.js whip"], grade: "A",
    purpose: "Big letters whip in from the side, blurred along the direction they move.", period: 3.2, hero: 1.7,
    build(s) {
      s.style.background = "#f4f3ee";
      s.innerHTML = `<svg class="defs" aria-hidden="true"><defs>${[0, 1, 2, 3, 4].map((i) => `<filter id="fxw${i}" x="-60%" y="-20%" width="220%" height="140%"><feGaussianBlur stdDeviation="0 0"/></filter>`).join("")}</defs></svg>
        <div class="whip-l1"><span style="filter:url(#fxw0)">I</span><span style="filter:url(#fxw1)">N</span></div>
        <div class="whip-l2"><span style="filter:url(#fxw2)">B</span><span style="filter:url(#fxw3)">O</span><span style="filter:url(#fxw4)">X</span></div>
        <div class="whip-badge">12</div><div class="whip-cap">UNREAD</div>`;
      const sp = qa(s, ".whip-l1 span, .whip-l2 span"), bl = qa(s, "feGaussianBlur"), badge = q(s, ".whip-badge"), cap = q(s, ".whip-cap");
      return (t) => {
        sp.forEach((e, i) => {
          const a = 0.15 + i * 0.13, kin = outCubic(lin(a, a + 0.38, t)), b0 = 2.5 + i * 0.06, kout = inCubic(lin(b0, b0 + 0.3, t));
          e.style.transform = `translateX(${(1 - kin) * 130 - kout * 160}cqw)`;
          bl[i].setAttribute("stdDeviation", `${((1 - kin) * 28 + kout * 28).toFixed(1)} 0`);
          e.style.opacity = t < a ? 0 : 1;
        });
        badge.style.transform = `scale(${Math.max(0, back(lin(0.9, 1.25, t)) * (1 - lin(2.5, 2.7, t)))})`;
        cap.style.opacity = lin(1.1, 1.4, t) * (1 - lin(2.45, 2.6, t));
      };
    } });

  demo({ id: "chars", name: "Character pop", kind: "type", stacks: ["css"], chips: ["CSS transform", "engine.js chars"], grade: "A",
    purpose: "One character at a time, so the eye reads along; the key word changes colour.", period: 4, hero: 2.7,
    build(s) {
      s.style.background = "#0f0d14";
      const lines = ["Every reply,", "signed by", "you."];
      s.innerHTML = `<div class="chars">${lines.map((l, li) => `<div>${Array.from(l).map((c) => `<span class="${li === 2 ? "pk" : ""}"${c === " " ? ' style="white-space:pre"' : ""}>${c}</span>`).join("")}</div>`).join("")}</div>`;
      const sp = qa(s, ".chars span");
      return (t) => sp.forEach((e, i) => {
        const a = 0.15 + i * 0.08, k = lin(a, a + 0.32, t), out = lin(3.3, 3.7, t);
        e.style.opacity = Math.min(1, k * 3) * (1 - out);
        e.style.transform = `translateY(${(1 - k) * 18}%) scale(${0.3 + 0.7 * back(k)})`;
      });
    } });

  demo({ id: "mark", name: "Highlighter", kind: "type", stacks: ["css"], chips: ["CSS scaleX", "engine.js mark"], grade: "A",
    purpose: "Draws the eye to one line, as a marker pen would; in the sample, the line that backs a number.", period: 3.6, hero: 2.5,
    build(s) {
      s.style.background = "#e9e6f2";
      s.innerHTML = `<div class="doc"><div class="doc-h">PLAYBOOK · SAVINGS PLAN A</div><div>Term: <span class="mk"><i></i>5 or 10 years</span></div><div>Yearly: <span class="mk"><i></i>HK$12,000</span></div><div><span class="ph"></span><span class="ph s"></span></div></div>`;
      const bars = qa(s, ".mk i");
      return (t) => bars.forEach((b, i) => { const a = 0.5 + i * 0.8; b.style.transform = `scaleX(${outCubic(lin(a, a + 0.45, t)) * (1 - lin(3.2, 3.5, t))})`; });
    } });

  demo({ id: "count", name: "Counting number", kind: "type", stacks: ["css"], chips: ["JS counter", "tabular-nums"], grade: "A",
    purpose: "A number counts up to its value; tabular digits keep its width steady.", period: 3.2, hero: 2.4,
    build(s) {
      s.style.background = "#101018";
      s.innerHTML = `<div class="cnt"><div class="cnt-l">Yearly premium</div><div class="cnt-n">HK$<span>0</span></div><div class="cnt-s">Source: Playbook · Savings Plan A</div></div>`;
      const box = q(s, ".cnt"), n = q(s, ".cnt-n span"), src = q(s, ".cnt-s");
      return (t) => { n.textContent = Math.round(12000 * outCubic(lin(0.3, 1.6, t))).toLocaleString("en-US"); src.style.opacity = lin(1.6, 1.9, t); box.style.opacity = 1 - lin(2.9, 3.15, t); };
    } });

  demo({ id: "type", name: "Typewriter", kind: "type", stacks: ["css"], chips: ["JS per character", "CSS caret"], grade: "A",
    purpose: "Shows a reply being drafted; reads instantly as a chat.", period: 5, hero: 3.6,
    build(s) {
      s.style.background = "#fff";
      const txt = Array.from("Both! 5 or 10 years. Budget per year?");
      s.innerHTML = `<div class="wrap"><div class="ig-top"><b></b><span>Client</span></div><div class="bub them">5 or 10 years?</div><div class="bub me"><span class="ty"></span><span class="car"></span></div></div>`;
      const w = q(s, ".wrap"), them = q(s, ".them"), me = q(s, ".me"), ty = q(s, ".ty"), car = q(s, ".car");
      return (t) => {
        them.style.opacity = lin(0.1, 0.35, t); me.style.opacity = t > 0.7 ? 1 : 0;
        const n = Math.floor(clamp((t - 0.8) * 12, 0, txt.length));
        ty.textContent = txt.slice(0, n).join("");
        car.style.opacity = n < txt.length || Math.floor(t * 2.5) % 2 === 0 ? 1 : 0;
        w.style.opacity = 1 - lin(4.6, 4.9, t);
      };
    } });

  demo({ id: "stamp", name: "Red flash + shake + stamp", kind: "type", stacks: ["css"], chips: ["CSS transform", "engine.js slam / shake / flash"], grade: "A",
    purpose: "An alarm moment: a red flash, a shake, then a stamp. In the sample, it marks an auto-reply that made up a number.", period: 3.6, hero: 2.2,
    build(s) {
      s.style.background = "#0f0d14";
      s.innerHTML = `<div class="wrap"><div class="bub auto">Auto-reply<b>Guaranteed 6% return!</b></div><div class="stampx">MADE UP!</div></div><div class="flashx"></div>`;
      const w = q(s, ".wrap"), b = q(s, ".auto"), st = q(s, ".stampx"), fl = q(s, ".flashx");
      return (t) => {
        b.style.opacity = lin(0.1, 0.35, t);
        const sh = t > 1.0 && t < 1.6 ? (1 - lin(1.0, 1.6, t)) * 2.2 * Math.sin(t * 90) : 0;
        b.style.transform = `translateX(${sh}cqw)`;
        fl.style.opacity = t > 1.0 ? 0.55 * (1 - lin(1.0, 1.35, t)) : 0;
        const k = lin(1.05, 1.3, t);
        st.style.opacity = k > 0 ? 1 : 0;
        st.style.transform = `translate(-50%, -50%) rotate(-11deg) scale(${2.4 - 1.4 * outCubic(k)})`;
        w.style.opacity = 1 - lin(3.2, 3.5, t);
      };
    } });

  demo({ id: "scan", name: "Scan and check", kind: "ui", stacks: ["css"], chips: ["CSS gradient", "engine.js scan"], grade: "A",
    purpose: "A scan line passes over a list and ticks each item off; in the sample, numbers checked against a source.", period: 4.4, hero: 2.7,
    build(s) {
      s.style.background = "#16131d";
      s.innerHTML = `<div class="wrap"><div class="doc dark"><div class="doc-h">DRAFT</div><div>Terms: <u>5 yrs</u> or <u>10 yrs</u>,</div><div>about <u class="bad">4.5%</u> a year.</div></div><div class="scanbar"></div><div class="chipsx"><span class="ok">✓ 5 yrs</span><span class="ok">✓ 10 yrs</span><span class="no">✗ 4.5%</span></div><div class="warnx">⚠️ Needs your check</div></div>`;
      const w = q(s, ".wrap"), bar = q(s, ".scanbar"), cs = qa(s, ".chipsx span"), warn = q(s, ".warnx");
      return (t) => {
        bar.style.top = `${18 + lin(0.3, 1.8, t) * 42}cqw`; bar.style.opacity = t > 0.3 && t < 1.9 ? 1 : 0;
        cs.forEach((c, i) => { const a = [0.8, 1.05, 1.5][i]; c.style.transform = `scale(${Math.max(0, back(lin(a, a + 0.25, t)))})`; });
        warn.style.opacity = lin(2.0, 2.3, t); w.style.opacity = 1 - lin(4.0, 4.3, t);
      };
    } });

  demo({ id: "sweep", name: "Light sweep", kind: "ui", stacks: ["css"], chips: ["CSS linear-gradient"], grade: "A",
    purpose: "A band of light sweeps across a card.", period: 3, hero: 0.95,
    build(s) {
      s.style.background = "radial-gradient(120% 80% at 30% 20%, #3b1d4a, #0c0a12)";
      s.innerHTML = `<div class="gcard"><div class="gc-h"><b>so</b>social_ops bot</div><div class="gc-q">💬 Concern: the plan's return — “HK$20k a year, what do I get back?”</div><i class="shine"></i></div>`;
      const sh = q(s, ".shine");
      return (t) => { sh.style.transform = `translateX(${-120 + lin(0.5, 1.4, t) * 280}%) skewX(-20deg)`; };
    } });

  demo({ id: "glass", name: "Frosted glass card", kind: "ui", stacks: ["css"], chips: ["CSS backdrop-filter"], grade: "A",
    purpose: "A frosted card blurs the busy background behind it, so the text on it stays clear.", period: 6, hero: 1.4,
    build(s) {
      s.style.background = "#1b1530";
      s.innerHTML = `<i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i><div class="frost"><div class="fr-t">Draft waiting for you</div><div class="fr-k"><span>✏️ Edit</span><span>👤 I'll reply</span></div></div>`;
      const bs = qa(s, ".blob");
      return (t) => {
        const a = (t / 6) * Math.PI * 2;
        bs[0].style.transform = `translate(${Math.cos(a) * 18}cqw, ${Math.sin(a) * 14}cqw)`;
        bs[1].style.transform = `translate(${Math.cos(a * 2 + 2) * 16}cqw, ${Math.sin(a + 1) * 20}cqw)`;
        bs[2].style.transform = `translate(${Math.sin(a + 3) * 20}cqw, ${Math.cos(a * 2) * 12}cqw)`;
      };
    } });

  demo({ id: "orbs", name: "Glow orbs", kind: "backdrop", stacks: ["css"], chips: ["CSS radial-gradient", "mix-blend-mode: screen"], grade: "A",
    purpose: "Soft glowing orbs drift and blend into each other.", period: 8, hero: 2,
    build(s) {
      s.style.background = "#07060b";
      s.innerHTML = [0, 1, 2, 3, 4].map((i) => `<i class="orb o${i}"></i>`).join("") + `<div class="orb-t">Every reply,</div>`;
      const os = qa(s, ".orb");
      return (t) => { const a = (t / 8) * Math.PI * 2; os.forEach((o, i) => { o.style.transform = `translate(${Math.cos(a * (i % 2 ? 1 : -1) + i * 1.3) * 22}cqw, ${Math.sin(a * (i % 3 ? 1 : 2) + i) * 26}cqw) scale(${0.8 + 0.3 * Math.sin(a + i)})`; }); };
    } });

  demo({ id: "wipe", name: "0.5 s wipe", kind: "motion", stacks: ["css"], chips: ["CSS clip-path", "engine.js"], grade: "A",
    purpose: "Scenes change with a half-second clip-path wipe.", period: 4, hero: 1.62,
    build(s) {
      s.innerHTML = `<div class="sc scA"><b>DM FLOOD</b><span>12 unread</span></div><div class="sc scB"><b>DRAFTED</b><span>you sign, then it sends</span></div>`;
      const B = q(s, ".scB");
      return (t) => { const k1 = inOut(lin(1.4, 1.9, t)), k2 = inOut(lin(3.4, 3.9, t)); B.style.clipPath = t < 3.4 ? `inset(0 ${100 - k1 * 100}% 0 0)` : `inset(0 0 0 ${k2 * 100}%)`; };
    } });

  demo({ id: "grain", name: "Film grain", kind: "backdrop", stacks: ["canvas"], chips: ["Canvas 2D", "new grain every 3 frames"], grade: "A",
    purpose: "Film texture that eats bitrate: at the same 2 Mbps, SSIM is 0.865 without grain and 0.742 with it.", period: 2, hero: 0.5,
    build(s) {
      s.style.background = "#000";
      const wide = s.classList.contains("landscape"), W = wide ? 800 : 360, H = 450;
      const c = document.createElement("canvas"); c.width = W; c.height = H; c.className = "fill"; s.appendChild(c);
      const g = c.getContext("2d"), nz = document.createElement("canvas"); nz.width = 180; nz.height = 225;
      const ng = nz.getContext("2d"), img = ng.createImageData(180, 225);
      let last = -1;
      return (t, abs) => {
        const step = Math.floor((abs ?? t) * 20);
        if (step === last) return; last = step;
        const bg = g.createRadialGradient(W/2, 200, 20, W/2, 225, W*.8); bg.addColorStop(0, "#3a2a44"); bg.addColorStop(1, "#050407");
        g.fillStyle = bg; g.fillRect(0, 0, W, H);
        g.fillStyle = "#f4eef8"; g.font = `900 34px ${LAT}`; g.textAlign = "center"; g.fillText("In class.", W/2, 205); g.fillText("DMs waiting.", W/2, 252);
        let seed = step * 9301 + 49297;
        for (let i = 0; i < img.data.length; i += 4) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; const v = seed >>> 23; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
        ng.putImageData(img, 0, 0);
        g.globalAlpha = 0.18; g.globalCompositeOperation = "overlay"; g.drawImage(nz, 0, 0, W, H);
        g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      };
    } });

  // ================= 3D and shader effects (one shared WebGL renderer) =================
  // A film may request native-size effects; gallery tiles retain their original dimensions.
  const GW = window.FX_RENDER_SIZE?.w || 480, GH = window.FX_RENDER_SIZE?.h || 600;
  let R3 = null;
  try {
    if (window.THREE && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.HalftonePass) {
      R3 = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      R3.setPixelRatio(1); R3.setSize(GW, GH, false);
      R3.shadowMap.enabled = true; R3.shadowMap.type = THREE.PCFSoftShadowMap;
    }
  } catch (e) { R3 = null; }
  const FONT = R3 && window.FX_FONT ? new THREE.Font(window.FX_FONT) : null;

  function glTile(s, blend) {
    const c = document.createElement("canvas"); c.width = GW; c.height = GH; c.className = "fill glc" + (blend ? " mult" : ""); s.appendChild(c);
    const g = c.getContext("2d");
    return () => g.drawImage(R3.domElement, 0, 0);
  }
  function composer(scene, cam, strength, radius, threshold) {
    const c = new THREE.EffectComposer(R3); c.setSize(GW, GH);
    c.addPass(new THREE.RenderPass(scene, cam));
    if (strength > 0) { c.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(GW / 2, GH / 2), strength, radius, threshold); c.addPass(c.bloom); }
    return c;
  }
  function text3d(str, size, depth, mat) {
    const g = new THREE.TextGeometry(str, { font: FONT, size, height: depth, curveSegments: 10, bevelEnabled: true, bevelThickness: size * 0.05, bevelSize: size * 0.035, bevelSegments: 4 });
    g.center(); const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
  }
  function studioLights(scene, spotPos) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.28));
    const key = new THREE.SpotLight(0xffffff, 2.2, 60, 0.55, 0.5, 1.2);
    key.position.set(...spotPos); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005;
    scene.add(key); scene.add(key.target);
    const rim = new THREE.DirectionalLight(0xff90e8, 1.1); rim.position.set(4, 3, -8); scene.add(rim);
    return key;
  }
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  demo({ id: "lit3d", gl: true, name: "Lit 3D type + shadow", kind: "shader", stacks: ["three"], chips: ["Three.js TextGeometry", "SpotLight soft shadow", "UnrealBloomPass"], grade: "A+",
    purpose: "Extruded 3D type on a floor, lit by a spotlight that casts a soft shadow.", period: 6, hero: 1.4,
    build(s) {
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, GW / GH, 0.1, 100);
      cam.position.set(0, 2.4, 9); cam.lookAt(0, 1.1, 0);
      const key = studioLights(scene, [-5, 9, 4]); key.target.position.set(0, 1, 0);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.5 }));
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
      const six = text3d("6%", 1.6, 0.55, new THREE.MeshStandardMaterial({ color: 0xff3b4e, metalness: 0.55, roughness: 0.3, emissive: 0x330008 })); scene.add(six);
      const comp = composer(scene, cam, 0.8, 0.55, 0.2);
      return (t) => {
        const pop = t < 0.1 ? 0 : t < 0.6 ? back((t - 0.1) / 0.5) : 1;
        six.scale.setScalar(Math.max(0.001, pop * (1 - smooth(5.6, 6, t))));
        six.position.set(0, 1.3 + 0.08 * Math.sin(t * 1.4), 0);
        six.rotation.set(0.08, 0.6 * Math.sin((t / 6) * Math.PI * 2), 0);
        R3.setClearColor(0x07060b, 1); comp.render(1 / 60); blit();
      };
    } });

  demo({ id: "rays", gl: true, name: "Rays + bloom + dust", kind: "shader", stacks: ["three", "canvas"], chips: ["Three.js additive planes", "UnrealBloomPass", "Canvas ray texture"], grade: "A+",
    purpose: "Light rays fan out behind the scene, with bloom and floating dust.", period: 10, hero: 2,
    build(s) {
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, GW / GH, 0.1, 100), R = rng(9028);
      cam.position.set(0, 0, 10);
      const c = document.createElement("canvas"); c.width = 64; c.height = 512; const g = c.getContext("2d");
      const gy = g.createLinearGradient(0, 0, 0, 512); gy.addColorStop(0, "rgba(255,255,255,0)"); gy.addColorStop(0.5, "rgba(255,255,255,1)"); gy.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gy; g.fillRect(0, 0, 64, 512);
      const gx = g.createLinearGradient(0, 0, 64, 0); gx.addColorStop(0, "rgba(0,0,0,1)"); gx.addColorStop(0.5, "rgba(0,0,0,0)"); gx.addColorStop(1, "rgba(0,0,0,1)");
      g.globalCompositeOperation = "destination-out"; g.fillStyle = gx; g.fillRect(0, 0, 64, 512);
      const rays = new THREE.Group(); scene.add(rays);
      const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffe8f8, opacity: 0.7 });
      for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16 + R() * 0.2, 9 + R() * 8), mat); m.rotation.z = (i / 18) * Math.PI * 2 + R() * 0.2; rays.add(m); }
      const N = 700, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { pos[i * 3] = (R() - 0.5) * 14; pos[i * 3 + 1] = (R() - 0.5) * 18; pos[i * 3 + 2] = -2 - R() * 14; }
      const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(pos, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      scene.add(dust);
      const comp = composer(scene, cam, 1.1, 0.55, 0.2);
      return (t, abs) => {
        rays.rotation.z = abs * 0.12; rays.scale.setScalar(0.9 + 0.08 * Math.sin(abs * 0.9));
        dust.rotation.y = abs * 0.03; dust.position.y = (abs * 0.2) % 2;
        R3.setClearColor(0x07060b, 1); comp.render(1 / 60); blit();
      };
    } });

  demo({ id: "smoke", gl: true, name: "Smoke", kind: "shader", stacks: ["three", "glsl"], chips: ["GLSL fbm noise", "ShaderMaterial"], grade: "B",
    purpose: "Smoke that drifts and curls, computed from noise on every frame; no footage.", period: 20, hero: 6,
    build(s) {
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const u = { uT: { value: 0 } };
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u,
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader: `uniform float uT; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
          float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
          float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*n2(p); p*=2.03; a*=0.5; } return v; }
          void main(){ vec2 p = vUv*vec2(2.2,2.75);
            vec2 q = vec2(fbm(p + uT*0.18), fbm(p + vec2(5.2,1.3) - uT*0.14));
            float f = fbm(p + 2.2*q + vec2(uT*0.06, 0.0));
            float a = smoothstep(0.42,0.9,f);
            vec3 col = mix(vec3(0.03,0.02,0.05), vec3(1.0,0.86,0.96), a) + vec3(0.25,0.05,0.2)*q.x*0.4;
            gl_FragColor = vec4(col, 1.0); }` })));
      const comp = composer(scene, cam, 0.5, 0.6, 0.35);
      return (t, abs) => { u.uT.value = abs; comp.render(1 / 60); blit(); };
    } });

  demo({ id: "particles", gl: true, name: "Particles into type", kind: "shader", stacks: ["three", "canvas"], chips: ["Three.js Points", "Canvas-sampled text", "UnrealBloomPass"], grade: "A+",
    purpose: "Scattered points assemble into words. Text in any script is drawn on a canvas and sampled, so it works where 3D fonts have no glyphs.", period: 5.5, hero: 3,
    build(s) {
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, GW / GH, 0.1, 100), R = rng(515);
      cam.position.set(0, 0, 8);
      const comp = composer(scene, cam, 0.9, 0.5, 0.2);
      let ps = null;
      const ready = document.fonts.load(`900 120px ${LAT}`, "SIGNED BY YOU").then(() => {
        const cw = 600, ch = 440, c = document.createElement("canvas"); c.width = cw; c.height = ch; const g = c.getContext("2d");
        g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `900 120px ${LAT}`;
        g.fillText("SIGNED", cw / 2, ch / 2 - 80); g.fillText("BY YOU", cw / 2, ch / 2 + 80);
        const d = g.getImageData(0, 0, cw, ch).data; let pts = [];
        for (let y = 0; y < ch; y += 4) for (let x = 0; x < cw; x += 4) if (d[(y * cw + x) * 4 + 3] > 120) pts.push([x - cw / 2, ch / 2 - y]);
        if (pts.length > 3800) { const st = pts.length / 3800; pts = Array.from({ length: 3800 }, (_, i) => pts[Math.floor(i * st)]); }
        const N = pts.length, sc = 5.0 / cw, tgt = new Float32Array(N * 3), src = new Float32Array(N * 3), pos = new Float32Array(N * 3), del = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          tgt[i * 3] = pts[i][0] * sc; tgt[i * 3 + 1] = pts[i][1] * sc; tgt[i * 3 + 2] = (R() - 0.5) * 0.12;
          const a = R() * Math.PI * 2, b = (R() - 0.5) * Math.PI, r = 6 + R() * 6;
          src[i * 3] = Math.cos(a) * Math.cos(b) * r; src[i * 3 + 1] = Math.sin(b) * r; src[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r * 0.6; del[i] = R() * 0.7;
        }
        const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffb8ee, size: 0.035, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
        ps = { N, tgt, src, pos, del, geo };
      });
      return { ready, frame: (t) => {
        if (ps) {
          for (let i = 0; i < ps.N; i++) {
            const k = smooth(0.2 + ps.del[i], 1.5 + ps.del[i], t) * (1 - smooth(4.5 + ps.del[i] * 0.3, 5.3 + ps.del[i] * 0.3, t)), ang = (1 - k) * 2.4;
            const x = ps.src[i * 3] + (ps.tgt[i * 3] - ps.src[i * 3]) * k, y = ps.src[i * 3 + 1] + (ps.tgt[i * 3 + 1] - ps.src[i * 3 + 1]) * k;
            ps.pos[i * 3] = x * Math.cos(ang) - y * Math.sin(ang); ps.pos[i * 3 + 1] = x * Math.sin(ang) + y * Math.cos(ang);
            ps.pos[i * 3 + 2] = ps.src[i * 3 + 2] + (ps.tgt[i * 3 + 2] - ps.src[i * 3 + 2]) * k;
          }
          ps.geo.attributes.position.needsUpdate = true;
        }
        R3.setClearColor(0x07060b, 1); comp.render(1 / 60); blit();
      } };
    } });

  const NOISE = `float hash31(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float noise3(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
      return mix(mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x), mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x), mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y), f.z); }`;
  demo({ id: "dissolve", gl: true, name: "Noise dissolve", kind: "shader", stacks: ["three", "glsl"], chips: ["onBeforeCompile shader patch", "3D noise", "UnrealBloomPass"], grade: "B",
    purpose: "Text or a number melts away in noise; in the sample, a figure with no source that will not be sent.", period: 5, hero: 1.7,
    build(s) {
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, GW / GH, 0.1, 100);
      cam.position.set(0, 0.6, 8); cam.lookAt(0, 0, 0);
      studioLights(scene, [-5, 7, 6]);
      const dis = { value: -0.1 }, mat = new THREE.MeshStandardMaterial({ color: 0xff3b4e, metalness: 0.5, roughness: 0.32, emissive: 0x2a0006 });
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uDis = dis;
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vObj;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>\nvarying vec3 vObj;\nuniform float uDis;\n${NOISE}`)
          .replace("#include <dithering_fragment>", "#include <dithering_fragment>\nfloat nn = 0.65*noise3(vObj*2.6) + 0.35*noise3(vObj*7.0);\nif (nn < uDis) discard;\nif (nn < uDis + 0.05) gl_FragColor = vec4(1.0, 0.56, 0.91, 1.0) * 3.0;");
      };
      const four = text3d("4.5%", 1.0, 0.4, mat); scene.add(four);
      const comp = composer(scene, cam, 0.9, 0.5, 0.2);
      return (t) => {
        dis.value = t < 3.8 ? -0.1 + 1.2 * smooth(1.0, 3.0, t) : 1.1 - 1.2 * smooth(3.8, 4.8, t);
        four.rotation.set(0.05, -0.3 + 0.3 * Math.sin((t / 5) * Math.PI * 2), 0);
        four.position.y = 0.06 * Math.sin(t * 2);
        R3.setClearColor(0x07060b, 1); comp.render(1 / 60); blit();
      };
    } });

  demo({ id: "chrome", gl: true, name: "Chrome logo", kind: "shader", stacks: ["three", "canvas"], chips: ["PBR metal", "PMREM environment", "Canvas-painted studio"], grade: "A+",
    purpose: "A logo in polished chrome, reflecting a studio painted on a canvas.", period: 8, hero: 2.6,
    build(s) {
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, GW / GH, 0.1, 100);
      cam.position.set(0, 0, 7);
      const c = document.createElement("canvas"); c.width = 1024; c.height = 512; const g = c.getContext("2d");
      const bg = g.createLinearGradient(0, 0, 0, 512); bg.addColorStop(0, "#1a1420"); bg.addColorStop(0.5, "#07060b"); bg.addColorStop(1, "#140a14"); g.fillStyle = bg; g.fillRect(0, 0, 1024, 512);
      g.filter = "blur(10px)"; g.fillStyle = "#ffffff"; g.fillRect(80, 90, 360, 120); g.fillRect(560, 50, 420, 110); g.fillRect(0, 230, 1024, 26);
      g.fillStyle = "#ff90e8"; g.fillRect(380, 290, 360, 130); g.fillRect(20, 320, 200, 90); g.fillStyle = "#ffe4f8"; g.fillRect(820, 240, 180, 200);
      const tx = new THREE.CanvasTexture(c); tx.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(R3), env = pm.fromEquirectangular(tx).texture; pm.dispose();
      const logo = text3d("social_ops", 0.46, 0.2, new THREE.MeshStandardMaterial({ color: 0xffe0f7, metalness: 1.0, roughness: 0.1, envMap: env, envMapIntensity: 2.2 }));
      scene.add(logo);
      const sweep = new THREE.PointLight(0xffffff, 5, 18, 1.6); scene.add(sweep);
      const comp = composer(scene, cam, 0.4, 0.5, 0.45);
      return (t) => {
        logo.rotation.set(0.12 + 0.06 * Math.sin(t * 0.8), -0.35 * Math.sin((t / 8) * Math.PI * 2), 0);
        sweep.position.set(-6 + 12 * ((t / 3.2) % 1), 2.2, 2.5);
        R3.setClearColor(0x07060b, 1); comp.render(1 / 60); blit();
      };
    } });

  function mascot(scene) {
    const R = rng(515);
    const mat = (c, rough = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0 });
    const skin = mat(0xe4e4e4), hair = mat(0x3c3c3c, 0.95), shirt = mat(0x767676), dark = mat(0x101010, 0.6), paper = mat(0xbdbdbd, 0.7);
    const S = (rad, m, seg = 40) => new THREE.Mesh(new THREE.SphereGeometry(rad, seg, Math.round(seg * 0.7)), m);
    const pivot = new THREE.Group(); scene.add(pivot);
    const bust = new THREE.Group(); bust.position.y = 4.3; pivot.add(bust);
    const torso = S(2.7, shirt, 56); torso.scale.set(1, 0.72, 0.78); torso.position.y = -2.0; bust.add(torso);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 1.1, 32), skin); neck.position.y = 0.05; bust.add(neck);
    const head = new THREE.Group(); head.position.y = 1.85; bust.add(head);
    head.add(S(1.62, skin, 56));
    for (let i = 0; i < 46; i++) {
      const th = R() * 1.15, ph = R() * Math.PI * 2, rr = 1.55;
      if (th > 0.75 && Math.cos(ph) > 0.35) continue;
      const b = S(0.42 + R() * 0.2, hair, 20);
      b.position.set(Math.sin(th) * Math.sin(ph) * rr, Math.cos(th) * rr + 0.1, Math.sin(th) * Math.cos(ph) * rr * 0.9 - 0.1); head.add(b);
    }
    [-1, 1].forEach((sx) => { const ear = S(0.33, skin, 20); ear.position.set(sx * 1.58, -0.05, 0); head.add(ear); });
    const eyes = [-1, 1].map((sx) => { const e = S(0.15, dark, 16); e.position.set(sx * 0.52, 0.12, 1.47); head.add(e); return e; });
    const nose = S(0.2, skin, 16); nose.position.set(0, -0.2, 1.6); head.add(nose);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 10, 32, Math.PI), dark); smile.rotation.z = Math.PI; smile.position.set(0, -0.48, 1.46); head.add(smile);
    const shoulder = new THREE.Group(); shoulder.position.set(-2.25, -1.1, 0.35); bust.add(shoulder);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.58, 2.2, 24), shirt); upper.position.y = -1.1; shoulder.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -2.2; shoulder.add(elbow);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.5, 1.9, 24), skin); fore.position.y = -0.95; elbow.add(fore);
    const hand = S(0.5, skin, 24); hand.position.y = -1.95; elbow.add(hand);
    const doc = new THREE.Group(); doc.position.set(0, -2.6, 0.3); elbow.add(doc); doc.visible = false;
    doc.add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.2, 0.06), paper));
    return { pivot, bust, torso, head, eyes, shoulder, elbow };
  }
  function mascotScene(s) {
    const blit = glTile(s, true), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, GW / GH, 0.1, 100);
    cam.position.set(0, 0.2, 21);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x303030, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.05); key.position.set(-6, 7, 9); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.25); fill.position.set(7, -2, 6); scene.add(fill);
    const comp = new THREE.EffectComposer(R3); comp.setSize(GW, GH); comp.addPass(new THREE.RenderPass(scene, cam));
    comp.addPass(new THREE.HalftonePass(GW, GH, { shape: 1, radius: 4, rotateR: Math.PI / 12, rotateB: Math.PI / 6, rotateG: Math.PI / 4, scatter: 0, blending: 1, blendingMode: 1, greyscale: true, disable: false }));
    const m = mascot(scene); m.pivot.position.set(0.4, -4.9, 0);
    return { m, draw() { R3.setClearColor(0xffffff, 1); comp.render(1 / 60); blit(); } };
  }

  const halftoneDemo = { id: "halftone", gl: true, host: "mascotRow", name: "Halftone mascot", kind: "character", stacks: ["three"], chips: ["Three.js primitives", "HalftonePass", "mix-blend-mode: multiply"], grade: "A+",
    purpose: "An original character built from spheres and cylinders, then halftoned; no AI-generated art. The arm has two joints, so it can wave.", period: 5, hero: 2.3,
    build(s) {
      s.style.background = "#ff90e8";
      const { m, draw } = mascotScene(s);
      return (t) => {
        m.bust.rotation.set(0, -0.32 + 0.07 * Math.sin(t * 1.2), 0);
        m.head.rotation.set(0.05 * Math.sin(t * 1.7), 0.12 * Math.sin(t * 0.9), 0.07 * Math.sin(t * 1.3));
        const blink = [0.6, 3.1].some((b) => t > b && t < b + 0.14);
        m.eyes.forEach((e) => e.scale.set(1, blink ? 0.12 : 1, 1));
        const lift = smooth(0.9, 1.4, t) * (1 - smooth(4.2, 4.7, t)), bend = lift * 0.55 * Math.sin(t * 9);
        m.shoulder.rotation.set(-0.15 * lift, 0, -2.55 * lift + 0.08);
        m.elbow.rotation.set(0, 0, -0.35 * lift + bend);
        draw();
      };
    } };
  demo(halftoneDemo);


  // The agent from option A as a reusable model. paint(colour, map) makes the material of each lit
  // surface and accent(colour, opacity) of each flat detail; outline(mesh, geometry), if given,
  // decorates a mesh. So toon, dither and any other style draw the same character.
  function agentModel(scene, paint, accent, outline) {
    const part = (geo, mat, parent, lined = true) => { const m = new THREE.Mesh(geo, mat); parent.add(m); if (lined && outline) outline(m, geo); return m; };
    const SKIN = 0xf6c9a6, HAIR = 0x2a2230, SUIT = 0x26335c;

    // suit, shirt and tie painted on the jacket; the front of the lathe sits at u = 0.5
    const c = document.createElement("canvas"); c.width = 1024; c.height = 512; const g = c.getContext("2d");
    const Y = (v) => (1 - v) * 512;
    g.fillStyle = "#26335c"; g.fillRect(0, 0, 1024, 512);
    g.fillStyle = "#ffffff"; g.beginPath(); g.moveTo(452, Y(0.98)); g.lineTo(572, Y(0.98)); g.lineTo(512, Y(0.66)); g.closePath(); g.fill();
    g.fillStyle = "#ff4f9a"; g.beginPath(); g.moveTo(503, Y(0.95)); g.lineTo(521, Y(0.95)); g.lineTo(527, Y(0.76)); g.lineTo(512, Y(0.71)); g.lineTo(497, Y(0.76)); g.closePath(); g.fill();
    g.strokeStyle = "#141c36"; g.lineWidth = 9; g.beginPath(); g.moveTo(446, Y(0.99)); g.lineTo(512, Y(0.64)); g.lineTo(578, Y(0.99)); g.stroke();
    g.fillStyle = "#141c36"; [0.55, 0.45].forEach((v) => { g.beginPath(); g.arc(512, Y(v), 8, 0, Math.PI * 2); g.fill(); });
    const suitTex = new THREE.CanvasTexture(c);

    const root = new THREE.Group(); root.position.y = -6.0; scene.add(root);
    const body = new THREE.Group(); body.position.y = 4.4; root.add(body);
    const prof = [];
    for (let i = 0; i <= 28; i++) { const u = i / 28; prof.push(new THREE.Vector2(Math.max(0.001, 2.2 * Math.sqrt(Math.max(0, 1 - Math.pow(u, 4)))), -4.4 + u * 5.02)); }
    const torso = part(new THREE.LatheGeometry(prof, 72, Math.PI, Math.PI * 2), paint(0xffffff, suitTex), body);
    torso.scale.z = 0.72;
    const neck = part(new THREE.CylinderGeometry(0.5, 0.55, 0.9, 32), paint(SKIN), body, false); neck.position.y = 0.8;

    const head = new THREE.Group(); head.position.y = 2.55; body.add(head);
    part(new THREE.SphereGeometry(1.75, 64, 48), paint(SKIN), head).scale.set(1, 1.02, 0.95);
    const hairMat = paint(HAIR); hairMat.side = THREE.DoubleSide;
    const cap = part(new THREE.SphereGeometry(1.86, 64, 32, 0, Math.PI * 2, 0, 1.5), hairMat, head); cap.rotation.x = -0.18; cap.scale.set(1.02, 1, 1.02);
    [-1, 1].forEach((sx) => { const sb = part(new THREE.SphereGeometry(0.5, 24, 16), paint(HAIR), head); sb.scale.set(0.45, 1.0, 0.8); sb.position.set(sx * 1.62, 0.5, 0.25); });
    const fringe = part(new THREE.SphereGeometry(0.9, 32, 24), paint(HAIR), head); fringe.scale.set(1.7, 0.5, 0.75); fringe.position.set(0.35, 1.22, 1.12); fringe.rotation.set(0.3, 0, -0.25);
    [-1, 1].forEach((sx) => { part(new THREE.SphereGeometry(0.36, 24, 16), paint(SKIN), head).position.set(sx * 1.7, -0.05, 0); });
    const eyes = [-1, 1].map((sx) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), accent(0x1a1720)); e.position.set(sx * 0.6, 0.1, 1.58); e.scale.set(1, 1.35, 0.5); head.add(e);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), accent(0xffffff)); hl.position.set(0.07, 0.08, 0.2); e.add(hl);
      return e;
    });
    const brows = [-1, 1].map((sx) => { const b = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.055, 8, 24, Math.PI * 0.8), accent(0x2a2230)); b.position.set(sx * 0.6, 0.55, 1.5); b.rotation.z = Math.PI * 0.1; head.add(b); return b; });
    part(new THREE.SphereGeometry(0.17, 16, 12), paint(SKIN), head, false).position.set(0, -0.18, 1.68);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.065, 8, 24, Math.PI), accent(0x7a1f3a)); mouth.rotation.z = Math.PI; mouth.position.set(0, -0.55, 1.56); head.add(mouth);
    [-1, 1].forEach((sx) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), accent(0xff8fb1, 0.55)); b.scale.set(1, 0.5, 0.25); b.position.set(sx * 1.02, -0.35, 1.32); head.add(b); });

    const capsule = [], r = 0.45, L = 1.9;
    for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2); capsule.push(new THREE.Vector2(Math.max(0.001, r * Math.cos(a)), -L + r * Math.sin(a))); }
    for (let i = 1; i <= 8; i++) { const a = (i / 8) * (Math.PI / 2); capsule.push(new THREE.Vector2(Math.max(0.001, r * Math.cos(a)), r * Math.sin(a))); }
    const arm = (sx) => {
      const sh = new THREE.Group(); sh.position.set(sx * 1.55, 0.05, 0.1); body.add(sh);
      part(new THREE.LatheGeometry(capsule, 32), paint(SUIT), sh);
      const cuff = part(new THREE.CylinderGeometry(0.47, 0.47, 0.2, 24), paint(0xffffff), sh, false); cuff.position.y = -L - 0.05;
      part(new THREE.SphereGeometry(0.5, 32, 24), paint(SKIN), sh).position.y = -L - 0.45;
      return sh;
    };
    const armL = arm(-1), armR = arm(1);
    armR.rotation.z = 0.45;
    return { root, body, torso, neck, head, eyes, brows, mouth, armL, armR };
  }

  demo({ id: "toon", gl: true, host: "mascotRow", name: "3D toon shading + outline", kind: "character", stacks: ["three", "canvas"], chips: ["MeshToonMaterial", "outline (inverted hull)", "Canvas-painted suit"], grade: "A",
    purpose: "Smooth shapes, three-step toon shading, a black outline, a big head on a small body, a suit and tie, and eye highlights.", period: 5, hero: 1.3,
    build(s) {
      s.style.background = "#ffd400";
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, GW / GH, 0.1, 100);
      cam.position.set(0, -0.8, 18); cam.lookAt(0, -0.8, 0);
      scene.add(new THREE.AmbientLight(0xffffff, 0.45));
      const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(-5, 6, 8); scene.add(key);
      const grad = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 185, 185, 185, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
      grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true;
      const toon = (c, map) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad, map: map || null });
      const basic = (c, o) => new THREE.MeshBasicMaterial(o ? { color: c, transparent: true, opacity: o } : { color: c });
      const line = new THREE.MeshBasicMaterial({ color: 0x1a1720, side: THREE.BackSide });
      line.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", "vec3 transformed = position + normal * 0.045;"); };
      const { root, torso, head, eyes, brows, mouth, armL } = agentModel(scene, toon, basic, (m, geo) => m.add(new THREE.Mesh(geo, line)));

      return (t) => {
        const hopP = t < 0.6 ? Math.sin((Math.PI * t) / 0.6) : 0, land = Math.exp(-Math.pow((t - 0.62) / 0.07, 2));
        root.position.y = -6.0 + 0.45 * hopP;
        root.scale.set(1 + 0.06 * land, 1 - 0.08 * land + 0.03 * hopP, 1 + 0.06 * land);
        torso.scale.y = 1 + 0.012 * Math.sin((t * 2 * Math.PI) / 2.5);
        head.rotation.set(0.04 * Math.sin(t * 1.3), 0.18 * Math.sin((t * 2 * Math.PI) / 5), 0.07 * Math.sin((t * 2 * Math.PI) / 5 + 1));
        const blink = [1.4, 3.9].some((b) => t > b && t < b + 0.13);
        eyes.forEach((e) => e.scale.set(1, blink ? 0.15 : 1.35, 0.5));
        const up = smooth(0.4, 0.75, t) * (1 - smooth(2.6, 3.0, t)), wave = t > 0.75 && t < 2.6 ? 0.18 * Math.sin((t - 0.75) * 11) : 0;
        armL.rotation.z = -0.45 + (-2.5 + 0.45) * up + wave * up;
        brows.forEach((b) => { b.position.y = 0.55 + 0.08 * up; });
        mouth.scale.set(1 + 0.15 * up, 1 + 0.25 * up, 1);
        R3.setClearColor(0xffd400, 1); R3.render(scene, cam); blit();
      };
    } });

  demo({ id: "flat", host: "mascotRow", name: "2D flat illustration with a rig", kind: "character", stacks: ["svg"], chips: ["SVG curves", "per-part rig", "flat shadows"], grade: "A",
    purpose: "Drawn curve by curve with an outline and flat shadows, like an app mascot; each part is rigged on its own, so it can wave and blink.", period: 5, hero: 1.3,
    build(s) {
      s.style.background = "#ff90e8";
      const O = "#1a1720", SK = "#f6c9a6", SKS = "#e6a883", HR = "#2a2230", SU = "#26335c", SUS = "#1b2546";
      s.innerHTML = `<svg class="svgfill" viewBox="0 0 400 500" stroke="${O}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
        <defs><clipPath id="mfFace"><ellipse cx="200" cy="200" rx="78" ry="88"/></clipPath><clipPath id="mfMouth"><path d="M168 238 Q200 276 232 238 Q200 250 168 238 Z"/></clipPath></defs>
        <circle cx="200" cy="262" r="150" fill="#ffd400" stroke="none"/>
        <g class="mf-all">
          <g class="mf-arm"><rect x="-22" y="-116" width="44" height="128" rx="22" fill="${SU}"/><rect x="-21" y="-126" width="42" height="16" rx="7" fill="#fff"/><ellipse cx="-20" cy="-146" rx="9" ry="13" fill="${SK}" transform="rotate(-25 -20 -146)"/><ellipse cx="0" cy="-150" rx="24" ry="27" fill="${SK}"/></g>
          <path d="M176 280 L224 280 L227 364 L173 364 Z" fill="${SK}"/>
          <path d="M178 312 L222 312 L222 330 C210 338 190 338 178 330 Z" fill="${SKS}" stroke="none"/>
          <g class="mf-body">
            <path d="M60 530 C62 424 104 372 164 358 L236 358 C296 372 338 424 340 530 Z" fill="${SU}"/>
            <path d="M166 360 L200 424 L234 360 Z" fill="#fff"/>
            <path d="M191 366 L209 366 L205 382 L195 382 Z" fill="#ff4f9a"/>
            <path d="M195 382 L205 382 L211 410 L200 421 L189 410 Z" fill="#ff4f9a"/>
            <path d="M166 360 L200 424 L180 446 L146 376 Z" fill="${SUS}"/>
            <path d="M234 360 L200 424 L220 446 L254 376 Z" fill="${SUS}"/>
            <circle cx="200" cy="464" r="5" fill="${O}" stroke="none"/>
          </g>
          <g class="mf-head">
            <ellipse cx="124" cy="214" rx="16" ry="22" fill="${SK}"/><ellipse cx="276" cy="214" rx="16" ry="22" fill="${SK}"/>
            <ellipse cx="200" cy="200" rx="78" ry="88" fill="${SK}"/>
            <ellipse cx="264" cy="214" rx="42" ry="98" fill="${SKS}" stroke="none" clip-path="url(#mfFace)" opacity=".6"/>
            <ellipse cx="200" cy="200" rx="78" ry="88" fill="none"/>
            <path d="M120 206 C106 118 166 88 214 94 C266 100 298 138 282 208 C272 178 258 160 238 152 C214 170 176 174 148 160 C136 172 126 188 120 206 Z" fill="${HR}"/>
            <path d="M178 116 C198 106 226 108 246 120" stroke="#51445c" stroke-width="6" fill="none"/>
            <g class="mf-brows"><path d="M148 176 Q164 166 180 174" stroke="${HR}" stroke-width="8" fill="none"/><path d="M220 174 Q236 166 252 176" stroke="${HR}" stroke-width="8" fill="none"/></g>
            <g class="mf-eyes"><ellipse cx="166" cy="204" rx="10" ry="13" fill="${O}" stroke="none"/><circle cx="170" cy="199" r="4" fill="#fff" stroke="none"/><ellipse cx="234" cy="204" rx="10" ry="13" fill="${O}" stroke="none"/><circle cx="238" cy="199" r="4" fill="#fff" stroke="none"/></g>
            <path d="M199 214 Q192 228 203 230" stroke="#c98a66" stroke-width="4" fill="none"/>
            <path class="mf-mouth" d="M168 238 Q200 276 232 238 Q200 250 168 238 Z" fill="#7a1f3a"/>
            <ellipse cx="200" cy="262" rx="16" ry="9" fill="#ff7a9c" stroke="none" clip-path="url(#mfMouth)"/>
            <ellipse cx="148" cy="236" rx="15" ry="8" fill="#ff8fb1" stroke="none" opacity=".6"/><ellipse cx="252" cy="236" rx="15" ry="8" fill="#ff8fb1" stroke="none" opacity=".6"/>
          </g>
          <g transform="rotate(10 292 442)"><rect x="262" y="392" width="60" height="100" rx="12" fill="${O}"/><rect x="270" y="404" width="44" height="72" rx="6" fill="#ff90e8" stroke="none"/><path d="M280 440 L289 450 L305 428" stroke="#fff" stroke-width="7" fill="none"/></g>
          <ellipse cx="278" cy="474" rx="22" ry="18" fill="${SK}"/>
        </g>
        <g class="mf-note"><rect x="232" y="318" width="156" height="46" rx="23" fill="#fff"/><text x="310" y="348" text-anchor="middle" font-size="20" font-weight="900" stroke="none" fill="${O}" font-family='${ZH}'>✅ Approved</text></g>
      </svg>`;
      const all = q(s, ".mf-all"), bodyG = q(s, ".mf-body"), headG = q(s, ".mf-head"), eyes = q(s, ".mf-eyes"), brows = q(s, ".mf-brows"), armG = q(s, ".mf-arm"), note = q(s, ".mf-note");
      return (t) => {
        const hopP = t < 0.6 ? Math.sin((Math.PI * t) / 0.6) : 0, land = Math.exp(-Math.pow((t - 0.62) / 0.07, 2));
        const sx = 1 + 0.06 * land, sy = 1 - 0.07 * land + 0.03 * hopP;
        all.setAttribute("transform", `translate(0 ${-18 * hopP}) translate(200 500) scale(${sx} ${sy}) translate(-200 -500)`);
        bodyG.setAttribute("transform", `translate(200 530) scale(1 ${1 + 0.012 * Math.sin((t * 2 * Math.PI) / 2.5)}) translate(-200 -530)`);
        const up = smooth(0.4, 0.75, t) * (1 - smooth(2.6, 3.0, t)), wave = t > 0.75 && t < 2.6 ? 9 * Math.sin((t - 0.75) * 11) : 0;
        headG.setAttribute("transform", `translate(0 32) rotate(${3 * Math.sin((t * 2 * Math.PI) / 5) - 3 * up} 200 330)`);
        const blink = [1.4, 3.9].some((b) => t > b && t < b + 0.13);
        eyes.setAttribute("transform", `translate(0 204) scale(1 ${blink ? 0.12 : 1}) translate(0 -204)`);
        brows.setAttribute("transform", `translate(0 ${-6 * up})`);
        armG.setAttribute("transform", `translate(110 392) rotate(${-165 + 145 * up + wave * up})`);
        const k = Math.max(0, back(lin(3.0, 3.35, t))) * (1 - lin(4.5, 4.8, t));
        note.setAttribute("transform", `translate(310 341) scale(${k}) translate(-310 -341)`);
      };
    } });

  demo({ id: "tunnel", gl: true, name: "Line tunnel", kind: "shader", stacks: ["three"], chips: ["Three.js LineSegments", "Fog", "Points"], grade: "A",
    purpose: "The camera flies down a tunnel of lines, through fog and points of light.", period: 10, hero: 1,
    build(s) {
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(64, GW / GH, 0.1, 200), R = rng(77);
      scene.fog = new THREE.Fog(0x06050a, 10, 90);
      const CELL = 4, LEN = 160, HW = 6, HH = 7.5;
      const face = (p0, u, uLen, uStep) => {
        const pts = [];
        for (let k = 0; k <= uLen + 1e-6; k += uStep) { const x = p0[0] + u[0] * k, y = p0[1] + u[1] * k; pts.push(x, y, 0, x, y, -LEN); }
        for (let z = 0; z >= -LEN; z -= CELL) pts.push(p0[0], p0[1], z, p0[0] + u[0] * uLen, p0[1] + u[1] * uLen, z);
        return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      };
      const tm = new THREE.LineBasicMaterial({ color: 0xff90e8, transparent: true, opacity: 0.45 }), tunnel = new THREE.Group();
      [face([-HW, -HH], [1, 0], 2 * HW, 1.3), face([-HW, HH], [1, 0], 2 * HW, 1.3), face([-HW, -HH], [0, 1], 2 * HH, 1.4), face([HW, -HH], [0, 1], 2 * HH, 1.4)].forEach((g) => tunnel.add(new THREE.LineSegments(g, tm)));
      scene.add(tunnel);
      const NP = 900, base = new Float32Array(NP * 3), pos = new Float32Array(NP * 3);
      for (let i = 0; i < NP; i++) { base[i * 3] = (R() - 0.5) * 2 * HW; base[i * 3 + 1] = (R() - 0.5) * 2 * HH; base[i * 3 + 2] = -R() * LEN; }
      const pg = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.8 })));
      return (t, abs) => {
        tunnel.position.z = (abs * 7) % CELL;
        for (let i = 0; i < NP; i++) { pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = -(((-base[i * 3 + 2]) - abs * 14) % LEN + LEN) % LEN; }
        pg.attributes.position.needsUpdate = true;
        cam.rotation.z = 0.05 * Math.sin(abs * 0.4);
        R3.setClearColor(0x06050a, 1); R3.render(scene, cam); blit();
      };
    } });

  // ================= can add =================
  demo({ id: "hook", name: "3-second headline hook", kind: "type", stacks: ["css"], chips: ["CSS mask reveal", "transform"], grade: "A",
    purpose: "A headline revealed by a mask within the first second, with no logo before it.", period: 4, hero: 2.3,
    build(s) {
      s.style.background = "#ffd400";
      const L = ["12 DMs", "unread.", "Clients ask", "about returns."];
      s.innerHTML = `<div class="hook">${L.map((l) => `<div class="mask"><span>${l}</span></div>`).join("")}<div class="hook-s">FOR LICENSED AGENTS · 45 S</div></div>`;
      const w = q(s, ".hook"), sp = qa(s, ".mask span"), sub = q(s, ".hook-s");
      return (t) => { sp.forEach((e, i) => { e.style.transform = `translateY(${(1 - outCubic(lin(0.1 + i * 0.18, 0.5 + i * 0.18, t))) * 110}%)`; }); sub.style.opacity = lin(1.1, 1.4, t); w.style.opacity = 1 - lin(3.5, 3.8, t); };
    } });

  demo({ id: "karaoke", name: "Word-synced captions", kind: "type", stacks: ["css"], chips: ["CSS", "hand-made timing"], grade: "A",
    purpose: "Readable with the sound off: each word lights up as it is spoken. The timing comes from the script, set by hand rather than by speech recognition.", period: 4.6, hero: 1.4,
    build(s) {
      s.style.background = "linear-gradient(160deg, #2b2f3a, #0e1015)";
      const W = [["The", 0.2], ["client", 0.42], ["asks:", 0.75], ["5", 1.1], ["or", 1.3], ["10", 1.5], ["years?", 1.75], ["One", 2.3], ["tap.", 2.6]];
      s.innerHTML = `<div class="kar-ph">picture</div><div class="kar">${W.map((w) => `<span>${w[0]}</span>`).join("")}</div><div class="kar-tl">${W.map((w) => `<span>${w[1].toFixed(2)}s</span>`).join("")}</div>`;
      const sp = qa(s, ".kar span"), tl = qa(s, ".kar-tl span");
      return (t) => W.forEach((w, i) => {
        const en = i + 1 < W.length ? W[i + 1][1] : 3.4, on = t >= w[1] && t < en, past = t >= en && t < 4.2;
        sp[i].className = on ? "on" : past ? "past" : ""; tl[i].className = on ? "on" : "";
      });
    } });

  demo({ id: "blueprint", name: "Blueprint callouts + dot grid", kind: "ui", stacks: ["svg"], chips: ["SVG stroke-dashoffset", "CSS dot grid"], grade: "A",
    purpose: "Callouts point at a card item by item, on a dot grid, like a manual.", period: 5.2, hero: 3.6,
    build(s) {
      s.style.background = "#0d2744 radial-gradient(rgba(255,255,255,.2) 1px, transparent 1.3px) 0 0 / 5cqw 5cqw";
      const labels = [["Stage → next stage", 132, 96], ["Client's exact words", 182, 176], ["⚠️ Numbers checked", 222, 256], ["✅ ✏️ 👤 🚫 4 buttons", 322, 344]];
      s.innerHTML = `<svg class="svgfill" viewBox="0 0 400 500" fill="none" stroke="#fff" stroke-width="2" font-family='${ZH}'>
        <rect class="dr" pathLength="1" x="30" y="100" width="170" height="270" rx="12"/>
        <rect class="dr" pathLength="1" x="46" y="122" width="100" height="14" rx="4"/>
        <rect class="dr" pathLength="1" x="46" y="156" width="138" height="48" rx="6"/>
        <rect class="dr" pathLength="1" x="46" y="214" width="118" height="14" rx="4"/>
        <rect class="dr" pathLength="1" x="46" y="298" width="64" height="22" rx="5"/><rect class="dr" pathLength="1" x="120" y="298" width="64" height="22" rx="5"/>
        <rect class="dr" pathLength="1" x="46" y="328" width="64" height="22" rx="5"/><rect class="dr" pathLength="1" x="120" y="328" width="64" height="22" rx="5"/>
        ${labels.map((l) => `<g class="ld"><circle cx="196" cy="${l[1]}" r="4" fill="#ffd400" stroke="none"/><path class="ln" pathLength="1" d="M196 ${l[1]} L226 ${l[2]} L240 ${l[2]}" stroke="#ffd400"/><text x="246" y="${l[2] + 5}" fill="#fff" stroke="none" font-size="13" font-weight="700">${l[0]}</text></g>`).join("")}
        <text x="30" y="440" fill="#9ec3ea" stroke="none" font-size="12" font-family="JetBrains Mono, monospace">FIG. 1 · TELEGRAM CARD</text></svg>`;
      const dr = qa(s, ".dr"), ld = qa(s, ".ld");
      dr.forEach((e) => e.setAttribute("stroke-dasharray", "1"));
      ld.forEach((g) => g.querySelector(".ln").setAttribute("stroke-dasharray", "1"));
      return (t) => {
        const out = 1 - lin(4.7, 5.0, t);
        dr.forEach((e, i) => { e.setAttribute("stroke-dashoffset", 1 - outCubic(lin(0.1 + i * 0.06, 0.7 + i * 0.06, t))); e.style.opacity = out; });
        ld.forEach((g, i) => {
          const a = 1.0 + i * 0.5;
          g.querySelector(".ln").setAttribute("stroke-dashoffset", 1 - outCubic(lin(a, a + 0.35, t)));
          g.querySelector("circle").style.opacity = (t > a ? 1 : 0) * out;
          g.querySelector("text").style.opacity = lin(a + 0.3, a + 0.5, t) * out;
          g.querySelector(".ln").style.opacity = out;
        });
      };
    } });

  demo({ id: "drawflow", name: "Self-drawing flow chart", kind: "ui", stacks: ["svg"], chips: ["SVG stroke-dashoffset"], grade: "A",
    purpose: "A four-step flow chart draws its own lines, one step after another.", period: 5.4, hero: 4.2,
    build(s) {
      s.style.background = "#fbfaf7";
      const N = [[110, 92, "💬", "Client DMs"], [290, 196, "✍️", "Drafted"], [110, 300, "✅", "You approve"], [290, 404, "📤", "Sent"]];
      const C = [[110, 136, 110, 170, 250, 150, 290, 152], [290, 240, 290, 280, 150, 250, 110, 256], [110, 344, 110, 380, 250, 360, 290, 360]];
      s.innerHTML = `<svg class="svgfill" viewBox="0 0 400 500" fill="none" stroke="#1a1720" stroke-width="3" stroke-linecap="round" font-family='${ZH}'>
        ${C.map((c) => `<path class="cn" pathLength="1" d="M${c[0]} ${c[1]} C${c[2]} ${c[3]} ${c[4]} ${c[5]} ${c[6]} ${c[7]}"/>`).join("")}
        ${N.map((n) => `<g class="nd"><circle pathLength="1" cx="${n[0]}" cy="${n[1]}" r="42" fill="#fff"/><text x="${n[0]}" y="${n[1] + 12}" text-anchor="middle" font-size="32" stroke="none" fill="#1a1720">${n[2]}</text><text class="lb" x="${n[0] < 200 ? n[0] + 52 : n[0] - 52}" y="${n[1] + 6}" text-anchor="${n[0] < 200 ? "start" : "end"}" font-size="17" font-weight="900" stroke="none" fill="#1a1720">${n[3]}</text></g>`).join("")}</svg>`;
      const nd = qa(s, ".nd"), cn = qa(s, ".cn");
      nd.forEach((g) => g.querySelector("circle").setAttribute("stroke-dasharray", "1"));
      cn.forEach((c) => c.setAttribute("stroke-dasharray", "1"));
      return (t) => {
        const out = 1 - lin(5.0, 5.3, t);
        nd.forEach((g, i) => {
          const a = 0.2 + i * 0.9;
          g.querySelector("circle").setAttribute("stroke-dashoffset", 1 - outCubic(lin(a, a + 0.4, t)));
          g.style.opacity = (t > a ? 1 : 0) * out;
          qa(g, "text").forEach((x) => { x.style.opacity = lin(a + 0.25, a + 0.45, t); });
        });
        cn.forEach((c, i) => { const a = 0.6 + i * 0.9; c.setAttribute("stroke-dashoffset", 1 - outCubic(lin(a, a + 0.4, t))); c.style.opacity = (t > a ? 1 : 0) * out; });
      };
    } });

  demo({ id: "sticker", name: "Sticker labels", kind: "type", stacks: ["css"], chips: ["CSS transform", "box-shadow"], grade: "A",
    purpose: "Rounded labels pop on with a white border and a drop shadow, like stickers.", period: 3.4, hero: 2.3,
    build(s) {
      s.style.background = "#ff90e8";
      s.innerHTML = `<div class="stk s1">Spots limited</div><div class="stk s2">Free set-up help</div><div class="stk s3">WhatsApp us</div>`;
      const st = qa(s, ".stk"), rot = [-6, 4, -3];
      return (t) => st.forEach((e, i) => {
        const a = 0.3 + i * 0.35, k = lin(a, a + 0.35, t), out = 1 - lin(3.0, 3.3, t);
        e.style.opacity = (k > 0 ? 1 : 0) * out;
        e.style.transform = `rotate(${rot[i] - (1 - k) * 25}deg) scale(${Math.max(0, back(k))})`;
      });
    } });

  demo({ id: "beat", name: "Beat sync", kind: "motion", stacks: ["css"], chips: ["music.py beat grid", "engine.js"], grade: "A",
    purpose: "Pops land on the beat. The music is synthesised here, so every beat time is already known; no audio analysis.", period: 2.4, hero: 1.85,
    build(s) {
      s.style.background = "#1a1325";
      s.innerHTML = `<div class="bt-cards"><span>DM in</span><span>Draft</span><span>Approve</span><span>Send</span></div><div class="bt-dots"><i></i><i></i><i></i><i></i></div><div class="bt-bpm">♩ = 100 BPM · 0.6 s a beat</div>`;
      const cs = qa(s, ".bt-cards span"), ds = qa(s, ".bt-dots i");
      return (t) => {
        const b = Math.floor(t / 0.6), ph = (t % 0.6) / 0.6;
        cs.forEach((c, i) => { c.style.opacity = b >= i ? 1 : 0.08; c.style.transform = `scale(${b === i ? 1 + 0.14 * Math.exp(-ph * 6) : 1})`; });
        ds.forEach((d, i) => d.classList.toggle("on", i === b));
      };
    } });

  demo({ id: "gradient", name: "Low-contrast flowing gradient", kind: "backdrop", stacks: ["css"], chips: ["CSS radial-gradient"], grade: "A",
    purpose: "Movement that never fights the text; long copy stays readable on top.", period: 12, hero: 3,
    build(s) {
      s.style.background = "#f3e9f1";
      s.innerHTML = `<i class="gl-l" style="background:radial-gradient(40% 35% at 30% 30%, #ffc9ee, transparent 70%)"></i><i class="gl-l" style="background:radial-gradient(38% 30% at 70% 60%, #d9ccff, transparent 70%)"></i><i class="gl-l" style="background:radial-gradient(35% 30% at 40% 80%, #ffe6b8, transparent 70%)"></i><div class="gl-t"><b>You sign.<br>Then it sends.</b><span>Every draft waits for one tap from you in Telegram.</span></div>`;
      const ls = qa(s, ".gl-l");
      return (t) => { const a = (t / 12) * Math.PI * 2; ls.forEach((l, i) => { l.style.transform = `translate(${Math.cos(a + i * 2.1) * 12}%, ${Math.sin(a * (i % 2 ? 1 : -1) + i) * 10}%)`; }); };
    } });

  demo({ id: "lut", name: "Warm grade + soft glow", kind: "backdrop", stacks: ["css"], chips: ["CSS colour filters", "background glow"], grade: "A",
    purpose: "A warm colour grade with a soft glow on the background; the text stays sharp.", period: 6, hero: 1.5,
    build(s) {
      const scene = () => `<div class="lut-sc"><div class="lut-sun"></div><div class="lut-win"></div><div class="lut-phone"><span>5 or 10 yrs?</span></div></div>`;
      s.innerHTML = `<div class="wrap">${scene()}</div><div class="wrap lut-r"><div class="wrap lut-warm">${scene()}</div><div class="lut-glow"></div></div><div class="lut-div"></div><span class="lut-lab" style="left:3cqw">Before</span><span class="lut-lab" style="right:3cqw">Warm</span>`;
      const r = q(s, ".lut-r"), dv = q(s, ".lut-div");
      return (t) => { const x = 50 + 24 * Math.sin((t / 6) * Math.PI * 2); r.style.clipPath = `inset(0 0 0 ${x}%)`; dv.style.left = `${x}%`; };
    } });

  demo({ id: "uifly", name: "Camera move over real UI", kind: "ui", stacks: ["css"], chips: ["CSS 3D transform", "perspective"], grade: "A",
    purpose: "The camera glides over a real interface card in 3D perspective.", period: 6, hero: 2.3,
    build(s) {
      s.style.background = "radial-gradient(90% 70% at 50% 40%, #2a2233, #0b0a0f)";
      s.style.perspective = "120cqw";
      s.innerHTML = `<div class="tg3"><div class="tg-h"><b>so</b>social_ops bot<span>TELEGRAM</span></div><div class="tg-q">💬 Concern: the plan's return — “HK$20k a year, what do I get back?”</div><div class="tg-kb"><span>✅ Approve (numbers checked)</span><span>✏️ Edit</span><span>👤 I'll reply</span><span>🚫 Not a lead</span></div></div>`;
      const c = q(s, ".tg3");
      return (t) => {
        const k = inOut(lin(0.2, 2.0, t)), z = inOut(lin(3.0, 4.2, t)) * (1 - inOut(lin(5.0, 5.8, t)));
        const rx = 55 * (1 - k), ry = -35 * (1 - k);
        c.style.transform = `translateY(${-30 * z}cqw) translateZ(${-60 * (1 - k)}cqw) rotateX(${rx}deg) rotateY(${ry}deg) scale(${1 + 0.55 * z})`;
        c.style.opacity = Math.min(1, t * 4) * (1 - lin(5.6, 5.95, t));
      };
    } });

  demo({ id: "ring", name: "24-hour countdown ring", kind: "ui", stacks: ["svg"], chips: ["SVG stroke-dasharray", "tabular-nums"], grade: "A",
    purpose: "A deadline at a glance: the ring empties as time runs out. In the sample, Meta's 24-hour window for replying to a DM.", period: 5, hero: 2.6,
    build(s) {
      s.style.background = "#101018";
      s.innerHTML = `<svg class="svgfill" viewBox="0 0 400 500"><circle cx="200" cy="220" r="120" fill="none" stroke="#2a2733" stroke-width="18"/><circle class="arc" cx="200" cy="220" r="120" fill="none" stroke="#ff90e8" stroke-width="18" stroke-linecap="round" pathLength="1" stroke-dasharray="1" transform="rotate(-90 200 220)"/><text class="hms" x="200" y="232" text-anchor="middle" fill="#fff" font-size="40" font-weight="900" font-family="JetBrains Mono, monospace">23:54</text><text x="200" y="266" text-anchor="middle" fill="#9a96a6" font-size="15" font-family='${ZH}'>left to reply</text><text x="200" y="420" text-anchor="middle" fill="#fff" font-size="20" font-weight="900" font-family='${ZH}'>Client DM'd at 23:02</text></svg>`;
      const arc = q(s, ".arc"), txt = q(s, ".hms");
      return (t) => {
        const rem = 23.9 - 22.8 * outCubic(lin(0.2, 4.2, t)), frac = rem / 24;
        arc.setAttribute("stroke-dashoffset", 1 - frac);
        arc.setAttribute("stroke", rem > 6 ? "#ff90e8" : rem > 2 ? "#ffd400" : "#ff3b4e");
        const h = Math.floor(rem), m = Math.floor((rem - h) * 60);
        txt.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      };
    } });

  demo({ id: "bounce", gl: true, host: "mascotRow", name: "Mascot breathing and bounce", kind: "character", stacks: ["three"], chips: ["Three.js", "HalftonePass", "squash and stretch"], grade: "A+",
    purpose: "The same halftone mascot, breathing and hopping with squash and stretch: a character that feels alive between lines.", period: 4, hero: 0.55,
    build(s) {
      s.style.background = "#ffd400";
      const { m, draw } = mascotScene(s);
      return (t) => {
        let y = 0, sy = 1;
        if (t < 2.4) {
          const p = (t % 1.2) / 1.2, edge = Math.min(p, 1 - p);
          y = 1.6 * Math.sin(Math.PI * p);
          sy = 1 - 0.16 * Math.exp(-(edge * edge) / 0.002) + 0.06 * Math.sin(Math.PI * p) * (p < 0.5 ? 1 : 0.4);
        } else sy = 1 + 0.018 * Math.sin((t - 2.4) * 5);
        m.pivot.position.y = -4.9 + y;
        m.pivot.scale.set(1 + (1 - sy) * 0.8, sy, 1 + (1 - sy) * 0.8);
        m.bust.rotation.set(0, -0.2 + 0.05 * Math.sin(t * 1.3), 0);
        m.head.rotation.set(0.06 * Math.sin(t * 2), 0.1 * Math.sin(t * 1.1), 0);
        const blink = t > 3.1 && t < 3.24;
        m.eyes.forEach((e) => e.scale.set(1, blink ? 0.12 : 1, 1));
        m.shoulder.rotation.set(0, 0, 0.08); m.elbow.rotation.set(0, 0, 0);
        draw();
      };
    } });

  demo({ id: "liquid", gl: true, name: "Liquid glass refraction", kind: "shader", stacks: ["three", "glsl", "canvas"], chips: ["custom GLSL refraction", "dispersion"], grade: "B",
    purpose: "Glass that bends and splits what is behind it. three.js r128 has no real refraction, so a custom shader fakes it.", period: 8, hero: 2,
    build(s) {
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const bgc = document.createElement("canvas"); bgc.width = GW; bgc.height = GH; const g = bgc.getContext("2d");
      const tex = new THREE.CanvasTexture(bgc);
      const paint = () => {
        g.fillStyle = "#ff90e8"; g.fillRect(0, 0, GW, GH);
        g.fillStyle = "#ffd400"; for (let i = -GH; i < GW; i += 56) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 26, 0); g.lineTo(i + 26 + GH, GH); g.lineTo(i + GH, GH); g.fill(); }
        g.fillStyle = "#111"; g.textAlign = "center"; g.font = `900 78px ${LAT}`;
        for (let r = 0; r < 6; r++) g.fillText("social_ops", GW / 2 + (r % 2 ? 40 : -40), 90 + r * 100);
        tex.needsUpdate = true;
      };
      paint(); const ready = document.fonts.load(`900 78px ${LAT}`, "social_ops").then(paint);
      const u = { uTex: { value: tex }, uT: { value: 0 }, uAspect: {value: GH/GW} };
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u,
        vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader: `uniform sampler2D uTex; uniform float uT, uAspect; varying vec2 vUv;
          float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0-h); }
          float field(vec2 p){
            vec2 c1 = vec2(0.5 + 0.2*sin(uT*0.7), 0.62 + 0.18*cos(uT*0.9));
            vec2 c2 = vec2(0.5 + 0.18*cos(uT*0.5 + 1.0), 0.6 + 0.22*sin(uT*0.6 + 2.0));
            return smin(length(p - c1) - 0.19, length(p - c2) - 0.13, 0.12); }
          void main(){
            vec2 p = vec2(vUv.x, (vUv.y-.5)*uAspect+.625);
            float d = field(p); vec2 e = vec2(0.002, 0.0);
            vec2 n = vec2(field(p + e.xy) - field(p - e.xy), field(p + e.yx) - field(p - e.yx)) / (2.0*e.x);
            float inside = smoothstep(0.004, -0.004, d);
            float depth = clamp(-d/0.1, 0.0, 1.0);
            vec2 off = n*(1.0 - depth)*0.08 + n*0.02;
            vec3 base = texture2D(uTex, vUv).rgb;
            vec3 glass = vec3(texture2D(uTex, vUv - off).r, texture2D(uTex, vUv - off*1.06).g, texture2D(uTex, vUv - off*1.12).b)*1.04 + 0.05;
            float rim = smoothstep(0.012, 0.0, abs(d))*0.7;
            float spec = pow(max(0.0, dot(normalize(vec3(-n, 0.6)), normalize(vec3(-0.5, 0.6, 0.6)))), 30.0)*inside;
            gl_FragColor = vec4(mix(base, glass, inside) + rim + spec*0.6, 1.0); }` })));
      return { ready, frame: (t, abs) => { u.uT.value = abs; R3.render(scene, cam); blit(); } };
    } });

  demo({ id: "halftonetype", name: "Halftone type", kind: "type", stacks: ["canvas"], chips: ["Canvas 2D", "dot size from ink coverage"], grade: "A",
    purpose: "A word printed as halftone dots whose size breathes from fine to coarse and back. Once the dots grow, thin and dense strokes, such as small Chinese characters, break up.", period: 4, hero: 2,
    build(s) {
      s.style.background = "#ffd400";
      const wide = s.classList.contains("landscape"), W = wide ? 800 : 360, H = 450, c = document.createElement("canvas"); c.width = W; c.height = H; c.className = "fill"; s.appendChild(c);
      const g = c.getContext("2d"), off = document.createElement("canvas"); off.width = W; off.height = H;
      const og = off.getContext("2d", { willReadFrequently: true });
      let ink = null, last = null;
      const prep = () => {
        og.font = `900 100px ${LAT}`;
        const px = Math.floor(100 * (wide ? W*.82 : 300) / (wide ? og.measureText("HALFTONE").width : Math.max(og.measureText("HALF").width, og.measureText("TONE").width)));
        og.clearRect(0, 0, W, H); og.fillStyle = "#000"; og.textAlign = "center"; og.textBaseline = "middle"; og.font = `900 ${px}px ${LAT}`;
        if (wide) og.fillText("HALFTONE", W/2, H/2);
        else { og.fillText("HALF", W / 2, H / 2 - px * 0.52); og.fillText("TONE", W / 2, H / 2 + px * 0.52); }
        const d = og.getImageData(0, 0, W, H).data; ink = new Float32Array(W * H);
        for (let i = 0; i < W * H; i++) ink[i] = d[i * 4 + 3] / 255;
      };
      const frame = (t) => {
        last = t;
        g.fillStyle = "#ffd400"; g.fillRect(0, 0, W, H);
        if (!ink) return;
        const cell = 4 + 8 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 4));
        g.fillStyle = "#111016";
        // Cells tile the canvas without gaps or overlaps: each spans floor(x) to floor(x + cell).
        for (let y = 0; y < H; y += cell) for (let x = 0; x < W; x += cell) {
          const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(W, Math.floor(x + cell)), y1 = Math.min(H, Math.floor(y + cell));
          let a = 0, n = 0;
          for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { a += ink[yy * W + xx]; n++; }
          const r = n ? Math.sqrt(a / n) * cell * 0.62 : 0;
          if (r > 0.25) { g.beginPath(); g.arc(x + cell / 2, y + cell / 2, r, 0, Math.PI * 2); g.fill(); }
        }
        g.font = "700 13px JetBrains Mono, monospace"; g.textAlign = "left"; g.fillText(`dot grid ${cell.toFixed(1)} px`, 18, H - 22);
      };
      const ready = document.fonts.load(`900 100px ${LAT}`, "HALFTONE").then(() => { prep(); if (last !== null) frame(last); });
      return { ready, frame };
    } });

  demo({ id: "glitch", name: "RGB-split glitch", kind: "type", stacks: ["css"], chips: ["CSS transform", "clip-path slices", "mix-blend-mode: screen"], grade: "A",
    purpose: "The red and blue channels split and jitter in bursts while slices of the word jump sideways, like a broken signal. Split edges make thin, dense strokes, such as small Chinese characters, hard to read.", period: 2.4, hero: 0.83,
    build(s) {
      s.style.background = "#0b0a0f";
      s.innerHTML = `<div class="glitch"><span class="g1">GLITCH</span><span class="g2">GLITCH</span><span class="g0">GLITCH</span></div>`;
      const [g1, g2, g0] = qa(s, ".glitch span");
      return (t) => {
        const f = Math.floor(t * 16), strong = t > 0.4 && t < 1.5, amp = strong ? 3.2 : 0.6;
        g1.style.transform = `translate(${(hash(f) - 0.5) * amp}cqw, ${(hash(f + 3) - 0.5) * amp * 0.4}cqw)`;
        g2.style.transform = `translate(${(hash(f + 7) - 0.5) * -amp}cqw, 0)`;
        const a = hash(f + 11) * 70, b = a + 8 + hash(f + 13) * 20;
        g0.style.clipPath = strong ? `polygon(0 0, 100% 0, 100% ${a}%, 0 ${a}%, 0 ${b}%, 100% ${b}%, 100% 100%, 0 100%)` : "none";
        g0.style.transform = strong && hash(f + 5) > 0.5 ? `translateX(${(hash(f + 9) - 0.5) * 6}cqw)` : "none";
      };
    } });

  // Extension files (fx/pack-*.js) register more effects with FX.demo and reuse these building blocks.
  window.FX = { DEMOS, demo, R3, GW, GH, FONT, ZH, LAT, NOISE, q, qa, glTile, composer, text3d, studioLights, rng, mascot, mascotScene, agentModel,
    helpers: { clamp, lin, smooth, outCubic, inCubic, inOut, back, hash } };
})();
