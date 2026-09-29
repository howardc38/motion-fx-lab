// Motion FX Lab: dithered-pixel character effects. Registers tiles with FX.demo; see fx/demos.js for the building blocks.
// Seen in a TixFox promo by Berlin (@ox8erlin on Threads); redone here on our own character.
(() => {
  const { demo, R3, GW, GH, glTile, agentModel, rng, helpers: { clamp, lin, smooth, outCubic, back } } = window.FX;
  const SEEN = "Threads · @ox8erlin (TixFox)";
  const PX = 4, LW = GW / PX, LH = GH / PX;        // one dither pixel is 4 × 4 canvas pixels: a 120 × 150 grid
  const INK = 0x15121c;

  const style = document.createElement("style");
  style.textContent = `
    .pd-bubble { position: absolute; padding: 2.4cqw 3.6cqw; background: #fff; color: #15121c; font: 700 5.4cqw var(--mono);
      border: 1.1cqw solid #15121c; box-shadow: 1.4cqw 1.4cqw 0 #15121c; transform-origin: 90% 100%; white-space: nowrap; }
    .pd-cards { position: absolute; left: 50%; top: 58%; width: 0; height: 0; }
    .pd-card { position: absolute; left: -12cqw; top: -17cqw; width: 24cqw; height: 32cqw; border-radius: 2.4cqw; border: 0.8cqw solid #15121c;
      padding: 2.6cqw; display: flex; flex-direction: column; justify-content: space-between; transform-origin: 50% 120%;
      font: 800 3.4cqw/1.1 var(--lat); color: #15121c; box-shadow: 0 1.6cqw 3cqw rgba(0, 0, 0, .35); }
    .pd-card b { font: 700 3.2cqw var(--mono); }
    .pd-card i { font-style: normal; align-self: flex-start; font: 700 2.8cqw var(--mono); background: #fff; border: 0.5cqw solid #15121c; border-radius: 1.4cqw; padding: .4cqw 1.4cqw; }
    .pd-logo { position: absolute; left: 0; right: 0; top: 60%; bottom: 0; background: #f2efe8; display: flex; flex-direction: column; align-items: center; gap: 2cqw; padding-top: 1cqw; }
    .pd-logo b { font: 900 15cqw/1 var(--lat); font-stretch: 112%; letter-spacing: -.02em; color: #15121c; }
    .pd-logo b span { color: #ff5a1f; }
    .pd-logo i { font-style: normal; font: 700 3.4cqw var(--mono); color: #15121c; background: #ff5a1f; padding: 1cqw 2.6cqw; border-radius: 1.2cqw; }
    .pd-slide { position: absolute; inset: 0; padding: 12cqw 8cqw; font: 900 10.5cqw/1.05 var(--lat); color: #15121c; }
    .pd-slide mark { background: #15121c; color: #fff; padding: 0 1.4cqw; }
    .pd-badge { position: absolute; left: 6cqw; bottom: 6cqw; width: 30cqw; height: 30cqw; border-radius: 50%; overflow: hidden;
      border: 1.1cqw solid #15121c; background: #fff; box-shadow: 1.2cqw 1.2cqw 0 #15121c; z-index: 5; }
    .pd-badge canvas { position: absolute; inset: 0; width: 100% !important; height: 100% !important; object-fit: cover; }
    .pd-tag { position: absolute; left: 39cqw; bottom: 12cqw; font: 700 3.4cqw var(--mono); color: #15121c; z-index: 5; }
  `;
  document.head.appendChild(style);

  // Pass 1 draws each part in its flat colour, pass 2 draws only light (white Lambert), both on the
  // 120 × 150 grid; pass 3 turns them into three-colour pixels with a 4 × 4 ordered dither.
  const FRAG = `uniform sampler2D tBase; uniform sampler2D tLight; uniform vec2 uLow;
    uniform vec3 uInk; uniform vec3 uWhite; uniform vec3 uBg; uniform float uShadow; uniform float uHigh; uniform float uSpread;
    varying vec2 vUv;
    float bayer2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
    float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    void main(){
      vec2 cell = floor(vUv * uLow);
      vec2 uv = (cell + 0.5) / uLow;
      vec4 base = texture2D(tBase, uv);
      if (base.a < 0.5) { gl_FragColor = vec4(uBg, 1.0); return; }
      float light = texture2D(tLight, uv).r;
      float d = bayer4(cell) - 0.5;
      vec3 c = base.rgb;
      if (light < uShadow + d * uSpread) c = uInk;
      else if (light > uHigh + d * uSpread) c = uWhite;
      gl_FragColor = vec4(c, 1.0);
    }`;
  function ditherRig(scene, bg) {
    const opts = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    const rtBase = new THREE.WebGLRenderTarget(LW, LH, opts), rtLight = new THREE.WebGLRenderTarget(LW, LH, opts);
    const u = { tBase: { value: rtBase.texture }, tLight: { value: rtLight.texture }, uLow: { value: new THREE.Vector2(LW, LH) },
      uInk: { value: new THREE.Color(INK) }, uWhite: { value: new THREE.Color(0xffffff) }, uBg: { value: new THREE.Color(bg) },
      uShadow: { value: 0.5 }, uHigh: { value: 0.86 }, uSpread: { value: 0.3 } };
    const quad = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u, depthTest: false, depthWrite: false,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }", fragmentShader: FRAG })));
    const lit = new THREE.MeshLambertMaterial({ color: 0xffffff }), litBoth = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const flat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.7, 0.7) });   // details get no dots
    let meshes = null;
    return (cam) => {
      if (!meshes) {
        meshes = [];
        scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
        for (const m of meshes) {
          m.userData.base = m.material;
          m.userData.light = m.material.userData.flat ? flat : m.material.side === THREE.DoubleSide ? litBoth : lit;
        }
      }
      for (const m of meshes) m.material = m.userData.base;
      R3.setRenderTarget(rtBase); R3.setClearColor(0x000000, 0); R3.clear(); R3.render(scene, cam);
      for (const m of meshes) m.material = m.userData.light;
      R3.setRenderTarget(rtLight); R3.setClearColor(0x808080, 1); R3.clear(); R3.render(scene, cam);
      for (const m of meshes) m.material = m.userData.base;
      R3.setRenderTarget(null); R3.setClearColor(bg, 1); R3.clear(); R3.render(quad, quadCam);
    };
  }
  // The agent in flat colours: lit surfaces are shaded by the dither, flat details are not.
  function flatAgent(scene) {
    const paint = (c, map) => new THREE.MeshBasicMaterial({ color: map ? 0xffffff : c, map: map || null });
    const accent = (c, o) => { const m = new THREE.MeshBasicMaterial(o ? { color: c, transparent: true, opacity: o } : { color: c }); m.userData.flat = true; return m; };
    // Lambert light stays under 1 so only the brightest spots pass the highlight threshold.
    scene.add(new THREE.AmbientLight(0xffffff, 0.34));
    const key = new THREE.DirectionalLight(0xffffff, 0.56); key.position.set(-5, 6, 8); scene.add(key);
    return agentModel(scene, paint, accent);
  }
  const squint = (A, k) => {
    A.eyes.forEach((e) => e.scale.set(1, 1.35 - 0.8 * k, 0.5));
    A.brows.forEach((b, i) => { b.position.y = 0.55 - 0.16 * k; b.rotation.z = Math.PI * 0.1 + (i ? -0.25 : 0.25) * k; });
  };

  demo({ id: "dithercharacter", gl: true, host: "mascotRow2", name: "Dithered pixel character", status: "add", stacks: ["three", "glsl"],
    chips: ["two-pass render: colour + light", "4×4 Bayer dither", "nearest-neighbour pixels"], grade: "B", seen: SEEN,
    purpose: "The same agent in three-colour pixels: a flat colour for each part, black dots for shadow and white dots for light. It turns, narrows its eyes and whispers.",
    period: 5, hero: 2.8,
    build(s) {
      s.style.background = "#f2efe8";
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, GW / GH, 0.1, 100);
      cam.position.set(-1.1, -0.7, 20); cam.lookAt(-1.1, -0.7, 0);
      const A = flatAgent(scene), draw = ditherRig(scene, 0xf2efe8);
      A.armR.rotation.z = 0.45; A.armL.rotation.z = -0.45;
      const bubble = document.createElement("div"); bubble.className = "pd-bubble"; bubble.style.left = "7cqw"; bubble.style.top = "16cqw"; bubble.textContent = "psst…";
      s.appendChild(bubble);
      return (t) => {
        const turn = smooth(1.0, 1.6, t) * (1 - smooth(3.8, 4.4, t));
        A.head.rotation.set(0.05 * Math.sin(t * 1.4), -0.6 + 0.6 * turn, 0.05 * Math.sin(t * 1.1));
        A.body.rotation.y = -0.25 + 0.2 * turn;
        A.torso.scale.y = 1 + 0.012 * Math.sin((t * 2 * Math.PI) / 2.5);
        const sq = smooth(2.0, 2.3, t) * (1 - smooth(3.3, 3.6, t)), blink = t > 4.55 && t < 4.68;
        squint(A, sq);
        if (blink) A.eyes.forEach((e) => e.scale.set(1, 0.15, 0.5));
        const k = back(lin(0.35, 0.6, t)) * (1 - lin(1.8, 2.0, t)), k2 = back(lin(2.3, 2.55, t)) * (1 - lin(3.4, 3.6, t));
        bubble.textContent = t < 2.1 ? "psst…" : "just a draft.";
        const kk = t < 2.1 ? k : k2;
        bubble.style.transform = `scale(${Math.max(0, kk)})`; bubble.style.opacity = kk > 0.01 ? 1 : 0;
        draw(cam); blit();
      };
    } });

  demo({ id: "dithercards", gl: true, host: "mascotRow2", name: "Holds up a fan of cards", status: "add", stacks: ["three", "glsl", "css"],
    chips: ["dithered 3D character", "crisp CSS cards in front", "staggered fan"], grade: "B", seen: SEEN,
    purpose: "Pixel character, sharp interface: the agent raises a fan of step cards, so the product's steps arrive in the character's hands.",
    period: 5, hero: 2.4,
    build(s) {
      s.style.background = "#141218";
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, GW / GH, 0.1, 100);
      cam.position.set(0, -0.6, 17); cam.lookAt(0, -0.6, 0);
      const A = flatAgent(scene), draw = ditherRig(scene, 0x141218);
      const holder = document.createElement("div"); holder.className = "pd-cards";
      const cards = [["#ff5a1f", "Draft", "01"], ["#ffd400", "Check", "02"], ["#6fa8ff", "Approve", "03"], ["#c9b4ff", "Send", "04"]];
      holder.innerHTML = cards.map(([c, word, n]) => `<div class="pd-card" style="background:${c}"><b>${n}</b>${word}<i>one tap</i></div>`).join("");
      s.appendChild(holder);
      const els = [...holder.children];
      return (t) => {
        const raise = smooth(0.2, 0.8, t) * (1 - smooth(4.3, 4.8, t));
        A.armL.rotation.set(-1.15 * raise, 0, -0.45 + 0.1 * raise); A.armR.rotation.set(-1.15 * raise, 0, 0.45 - 0.1 * raise);
        A.head.rotation.set(0.12 * raise + 0.04 * Math.sin(t * 1.3), 0.12 * Math.sin(t * 0.9), -0.08 * Math.sin(t * 1.6) * raise);
        A.torso.scale.y = 1 + 0.012 * Math.sin((t * 2 * Math.PI) / 2.5);
        const blink = t > 3.3 && t < 3.43;
        A.eyes.forEach((e) => e.scale.set(1, blink ? 0.15 : 1.35, 0.5));
        els.forEach((e, i) => {
          const up = outCubic(lin(0.5 + i * 0.1, 1.0 + i * 0.1, t)) * (1 - lin(4.2, 4.6, t));
          const fan = back(lin(1.1, 1.6, t)) * (1 - lin(4.0, 4.4, t));
          const off = i - 1.5, sway = 1.5 * Math.sin(t * 1.6 + i * 0.7) * fan;
          e.style.transform = `translate(${off * 13 * fan}cqw, ${(1 - up) * 70 + Math.abs(off) * 2.2 * fan}cqw) rotate(${off * 11 * fan + sway}deg)`;
          e.style.opacity = up > 0.01 ? 1 : 0;
        });
        draw(cam); blit();
      };
    } });

  demo({ id: "ditherpeek", gl: true, host: "mascotRow2", name: "Peeks over the logo in a coin rain", status: "add", stacks: ["three", "glsl", "css"],
    chips: ["dithered 3D", "tumbling coins, seeded", "logo mask in CSS"], grade: "B", seen: SEEN,
    purpose: "An ending: the agent rises from behind the wordmark and looks around while dithered coins tumble past.",
    period: 6, hero: 3.2,
    build(s) {
      s.style.background = "#f2efe8";
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, GW / GH, 0.1, 100);
      cam.position.set(0, 0.4, 18); cam.lookAt(0, 0.4, 0);
      const A = flatAgent(scene), draw = ditherRig(scene, 0xf2efe8), R = rng(3107);
      A.armL.rotation.z = -0.45; A.armR.rotation.z = 0.45;
      const coinGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.16, 28), coinMat = new THREE.MeshBasicMaterial({ color: 0xffa51f });
      const rimGeo = new THREE.TorusGeometry(0.62, 0.07, 6, 28), rimMat = new THREE.MeshBasicMaterial({ color: 0xd9641a });
      const coins = Array.from({ length: 14 }, () => {
        const g = new THREE.Group(); g.add(new THREE.Mesh(coinGeo, coinMat));
        const rim = new THREE.Mesh(rimGeo, rimMat); rim.rotation.x = Math.PI / 2; g.add(rim);
        scene.add(g);
        return { g, x: (R() - 0.5) * 9.5, z: -1.5 - R() * 3, speed: 1.6 + R() * 1.4, phase: R() * 12, spin: 1.5 + R() * 2.5, tilt: R() * Math.PI };
      });
      const logo = document.createElement("div"); logo.className = "pd-logo";
      logo.innerHTML = `<b>social<span>_</span>ops</b><i>Start free</i>`;
      s.appendChild(logo);
      return (t) => {
        const rise = back(lin(0.4, 1.2, t)) * (1 - smooth(5.3, 5.8, t));
        A.root.position.y = -9.6 + 2.9 * rise;
        const look = t < 2.2 ? 0 : t < 3.4 ? -1 : t < 4.4 ? 1 : 0;
        A.eyes.forEach((e, i) => { e.position.x = (i ? 0.6 : -0.6) + 0.14 * look; e.scale.set(1, 1.35, 0.5); });
        A.head.rotation.set(-0.08, 0.18 * look, 0);
        squint(A, look === 1 ? 0.6 : 0);
        if (t > 1.5 && t < 1.63) A.eyes.forEach((e) => e.scale.set(1, 0.15, 0.5));
        for (const c of coins) {
          const span = 13, y = 6.5 - (((t + 6 - 0) * c.speed + c.phase) % span);
          c.g.position.set(c.x, y, c.z);
          c.g.rotation.set(c.tilt + t * c.spin, t * c.spin * 0.7, 0.3);
        }
        draw(cam); blit();
      };
    } });

  demo({ id: "ditheravatar", gl: true, host: "mascotRow2", name: "Narrator avatar badge", status: "add", stacks: ["three", "glsl", "css"],
    chips: ["dithered 3D in a CSS circle", "reacts on each slide"], grade: "B", seen: SEEN,
    purpose: "The character stays in the corner of every slide and reacts to each one, so a whole video has one voice.",
    period: 6, hero: 2.3,
    build(s) {
      const slides = [["#ff8a4c", "12 DMs<br><mark>unread.</mark>"], ["#8fa2ff", "Drafted<br>in <mark>seconds.</mark>"], ["#7fe0b0", "You sign.<br><mark>It sends.</mark>"]];
      s.innerHTML = slides.map(([c, h]) => `<div class="pd-slide" style="background:${c}">${h}</div>`).join("") +
        `<div class="pd-badge"></div><div class="pd-tag">// your agent</div>`;
      const els = [...s.querySelectorAll(".pd-slide")], badge = s.querySelector(".pd-badge");
      const blit = glTile(badge), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, GW / GH, 0.1, 100);
      cam.position.set(0, 0.7, 12.5); cam.lookAt(0, 0.7, 0);
      const A = flatAgent(scene), draw = ditherRig(scene, 0xffffff);
      A.armL.rotation.z = -0.45; A.armR.rotation.z = 0.45;
      return (t) => {
        const i = Math.min(2, Math.floor(t / 2)), local = t - i * 2;
        els.forEach((e, k) => { e.style.clipPath = k < i ? "inset(0 100% 0 0)" : k === i ? `inset(0 ${k === 0 ? 0 : 100 - 100 * outCubic(clamp(local / 0.35))}% 0 0)` : "inset(0 0 0 100%)"; e.style.zIndex = k === i ? 1 : 0; });
        const react = Math.exp(-Math.pow((local - 0.35) / 0.18, 2));
        A.head.rotation.set(0.25 * react * Math.sin(local * 18) * (i === 2 ? 1 : 0.4), [0.25, -0.2, 0][i], 0.08 * Math.sin(t * 1.3));
        squint(A, i === 0 ? 0.55 : 0);
        A.brows.forEach((b) => { b.position.y += i === 1 ? 0.12 * react : 0; });
        const blink = local > 1.4 && local < 1.53;
        if (blink) A.eyes.forEach((e) => e.scale.set(1, 0.15, 0.5));
        draw(cam); blit();
      };
    } });
})();
