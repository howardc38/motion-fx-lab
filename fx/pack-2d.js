// Motion FX Lab: 2D effects. Registers tiles with FX.demo; see fx/demos.js for the building blocks.
// Ideas seen in a Threads video by @designer.riven, rebuilt from scratch. Every frame is a pure function of t:
// seeded randomness is drawn once in build(), and each canvas tile repaints everything on every frame.
(() => {
  const { demo, q, qa, rng, LAT, helpers } = window.FX;
  const { clamp, lin, outCubic, inOut, back } = helpers;
  const SEEN = "Threads · @designer.riven";
  const INK = "#111016", CREAM = "#f2efe8", ORANGE = "#ff5a1f", BLUE = "#2b4bff", YELLOW = "#ffd400";
  const SERIF = '"Instrument Serif", Georgia, serif';
  const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
  const TAU = Math.PI * 2;
  let uid = 0;
  const nid = (p) => `p2-${p}-${++uid}`;
  const f2 = (x) => x.toFixed(2);

  if (!document.getElementById("p2-style")) {
    const st = document.createElement("style");
    st.id = "p2-style";
    st.textContent = `
  .p2-fill { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .p2-vt-bg { position: absolute; inset: -1cqw 0; overflow: clip; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-start; }
  .p2-vt-row { width: max-content; white-space: nowrap; font: 800 12cqw/1 var(--lat); font-stretch: 100%; color: transparent; -webkit-text-stroke: .22cqw rgba(242,239,232,.3); }
  .p2-vt-row span { display: inline-block; padding-right: .3em; }
  .p2-vt-row.p2-y { -webkit-text-stroke-color: rgba(255,212,0,.75); }
  .p2-vt-word { position: absolute; left: 0; right: 0; top: 50%; display: flex; justify-content: center; transform: translateY(-50%); font: 400 18cqw/1 var(--lat); color: #f2efe8; }
  .p2-vt-word span { display: inline-block; }
  .p2-vt-read { position: absolute; left: 6cqw; right: 6cqw; bottom: 5cqw; display: flex; justify-content: space-between; font: 500 3.1cqw var(--mono); color: #f2efe8; letter-spacing: .04em; }
  .p2-vt-read b { font-weight: 700; color: #ffd400; font-variant-numeric: tabular-nums; }
  .p2-cr-h { position: absolute; left: 8cqw; right: 6cqw; top: 50%; transform: translateY(-58%); font: 900 15cqw/.98 var(--lat); font-stretch: 108%; letter-spacing: -.01em; color: #f2efe8; white-space: pre; }
  .p2-cr-h em { font-style: normal; color: #ff5a1f; }
  .p2-cr-car { display: inline-block; width: .09em; height: .82em; background: #ff5a1f; vertical-align: -.06em; margin-left: .04em; }
  .p2-cr-sub { position: absolute; left: 8cqw; top: 76cqw; font: 500 3.3cqw var(--mono); color: #ffd400; letter-spacing: .02em; }
  .p2-cf-head { position: absolute; left: 11cqw; right: 11cqw; top: 6cqw; display: flex; justify-content: space-between; align-items: baseline; color: #111016; }
  .p2-cf-head b { font: italic 400 8.5cqw/1 "Instrument Serif", Georgia, serif; }
  .p2-cf-head span { font: 500 2.8cqw var(--mono); letter-spacing: .06em; color: #5b5750; }
  .p2-cf-grid { position: absolute; left: 11cqw; right: 11cqw; top: 20cqw; display: grid; grid-template-columns: repeat(3, 1fr); gap: 3cqw; }
  .p2-cf-card { aspect-ratio: 4 / 5; perspective: 80cqw; }
  .p2-cf-in { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; }
  .p2-cf-f, .p2-cf-b { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 2.2cqw; padding: 2.4cqw; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 .8cqw 1.6cqw rgba(17,16,22,.18); }
  .p2-cf-f { background: #111016; color: #f2efe8; }
  .p2-cf-f i, .p2-cf-b i { font: 700 2.6cqw var(--mono); font-style: normal; }
  .p2-cf-f i { color: #ff5a1f; }
  .p2-cf-f b { font: 800 4.5cqw/1 var(--lat); font-stretch: 86%; letter-spacing: .02em; }
  .p2-cf-b { transform: rotateY(180deg); }
  .p2-cf-b b { font: italic 400 7.4cqw/1 "Instrument Serif", Georgia, serif; }
  .p2-cf-b i { align-self: flex-end; }
`;
    document.head.appendChild(st);
  }

  const canvas2d = (s, w, h) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; c.className = "p2-fill"; s.appendChild(c);
    return c.getContext("2d");
  };
  // A canvas tile that uses web fonts: waits for them, then repaints the last requested t with the right faces.
  const withFonts = (specs, paint) => {
    let last = null;
    const ready = Promise.all(specs.map((f) => document.fonts.load(f))).then(() => { if (last) paint(last[0], last[1]); });
    return { ready, frame: (t, abs) => { last = [t, abs]; paint(t, abs); } };
  };

  // Classic improved Perlin noise in 3D, with a permutation table shuffled by a seed.
  function perlin3(seed) {
    const R = rng(seed), perm = Array.from({ length: 256 }, (_, i) => i), p = new Uint8Array(512);
    for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const fade = (x) => x * x * x * (x * (x * 6 - 15) + 10);
    const mix = (a, b, k) => a + (b - a) * k;
    const grad = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
    return (x, y, z) => {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
      x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
      const u = fade(x), v = fade(y), w = fade(z);
      const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
      return mix(
        mix(mix(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), mix(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
        mix(mix(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), mix(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v), w);
    };
  }

  // ---------- 1. Timing: a bouncing ball and its height curve ----------
  demo({ id: "timing", name: "Timing: squash and stretch with its graph", kind: "motion", stacks: ["svg"], chips: ["SVG graph + playhead", "closed-form bounce", "squash and stretch"], grade: "A",
    purpose: "Shows why timing matters: the bounce and its height curve play side by side, and the playhead marks the frame you see.",
    seen: SEEN, period: 4.8, hero: 1.28,
    build(s) {
      s.style.background = CREAM;
      const P = 4.8, M0 = 0.25, TOT = 3.2, H0 = 150, R = 20, FLOOR = 214, X0 = 58, X1 = 342, RATIO = 0.42, NB = 6;
      // Bounce in closed form: a fall from H0, then NB arcs, each apex RATIO times the last.
      const qq = Math.sqrt(RATIO);
      let sum = 1; for (let i = 1; i <= NB; i++) sum += 2 * Math.pow(qq, i);
      const T0 = TOT / sum, G = 2 * H0 / (T0 * T0), VMAX = G * T0;
      const segs = [{ s: 0, half: T0, fall: true }];
      let at = T0;
      for (let i = 1; i <= NB; i++) { const half = T0 * Math.pow(qq, i); segs.push({ s: at, half }); at += 2 * half; }
      const lands = segs.map((g, i) => ({ at: g.fall ? g.half : g.s + 2 * g.half, v: G * g.half, i }));
      const heightAt = (tm) => {
        if (tm <= 0) return [H0, 0];
        if (tm >= at) return [0, 0];
        for (let i = segs.length - 1; i >= 0; i--) {
          const g = segs[i];
          if (tm >= g.s) {
            const u = tm - g.s;
            return g.fall ? [H0 - 0.5 * G * u * u, -G * u] : [G * g.half * u - 0.5 * G * u * u, G * g.half - G * u];
          }
        }
        return [H0, 0];
      };
      const ball = (t) => {
        const tm = t - M0, [h, v] = heightAt(tm);
        let c = 0, imp = 0;
        for (const L of lands) {
          const dt = tm - L.at, k = dt < 0 ? Math.max(0, 1 + dt / 0.03) : Math.max(0, 1 - dt / 0.07);
          if (k > c) { c = k; imp = L.v / VMAX; }
        }
        const sq = 0.5 * c * imp, str = 0.32 * (Math.abs(v) / VMAX) * (1 - c);
        const u = clamp(tm / at);
        return { x: X0 + (X1 - X0) * (1 - Math.pow(1 - u, 1.7)), h, he: h * (1 - c), sx: (1 + 0.9 * sq) / (1 + str), sy: (1 - sq) * (1 + str) };
      };
      // Graph editor: time 0..P across, height 0..H0 up.
      const GX0 = 44, GX1 = 364, GY0 = 398, GY1 = 298;
      const gx = (t) => GX0 + (GX1 - GX0) * (t / P), gy = (h) => GY0 - (GY0 - GY1) * (h / H0);
      let d = "";
      for (let i = 0; i <= 480; i++) { const t = (i / 480) * P; d += `${i ? "L" : "M"}${f2(gx(t))} ${f2(gy(heightAt(t - M0)[0]))}`; }
      const keys = [[M0, H0]];
      segs.forEach((g, i) => { if (i) keys.push([M0 + g.s + g.half, G * g.half * g.half * 0.5]); });
      lands.forEach((L) => keys.push([M0 + L.at, 0]));
      const clip = nid("tmclip");
      const ticks = [0, 24, 48, 72, 96, 120, 144];
      s.innerHTML = `<svg class="p2-fill" viewBox="0 0 400 500" aria-hidden="true">
        <defs><clipPath id="${clip}"><rect class="p2-tm-cr" x="${GX0 - 4}" y="${GY1 - 12}" width="0" height="${GY0 - GY1 + 24}"/></clipPath></defs>
        <text x="372" y="40" text-anchor="end" font-family="${MONO.replace(/"/g, "'")}" font-size="10" font-weight="700" letter-spacing="1.4" fill="${INK}" opacity=".55">BALL · 144 FRAMES @ 30 FPS</text>
        <line x1="24" y1="${FLOOR}" x2="376" y2="${FLOOR}" stroke="${INK}" stroke-width="2"/>
        <ellipse class="p2-tm-sh" cx="0" cy="${FLOOR + 1}" rx="18" ry="3.5" fill="${INK}" opacity=".2"/>
        ${[3, 2, 1].map(() => `<g class="p2-tm-gh"><circle cy="${-R}" r="${R}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-dasharray="3 3"/></g>`).join("")}
        <g class="p2-tm-ball"><circle cy="${-R}" r="${R}" fill="${ORANGE}"/></g>
        <rect x="20" y="244" width="360" height="182" rx="14" fill="${INK}"/>
        <text x="36" y="268" font-family="${MONO.replace(/"/g, "'")}" font-size="9.5" font-weight="700" letter-spacing="1.2" fill="${CREAM}" opacity=".55">GRAPH EDITOR</text>
        <rect x="302" y="260" width="8" height="8" rx="1.5" fill="${ORANGE}"/>
        <text x="316" y="268" font-family="${MONO.replace(/"/g, "'")}" font-size="9.5" fill="${CREAM}" opacity=".8">ball.y</text>
        ${[0, 0.5, 1].map((k) => `<line x1="${GX0}" x2="${GX1}" y1="${f2(GY0 - (GY0 - GY1) * k)}" y2="${f2(GY0 - (GY0 - GY1) * k)}" stroke="${CREAM}" stroke-opacity=".1" stroke-dasharray="2 4"/>`).join("")}
        ${ticks.map((f) => `<line x1="${f2(gx(f / 30))}" x2="${f2(gx(f / 30))}" y1="${GY0 + 2}" y2="${GY0 + 6}" stroke="${CREAM}" stroke-opacity=".35"/><text x="${f2(gx(f / 30))}" y="${GY0 + 18}" text-anchor="middle" font-family="${MONO.replace(/"/g, "'")}" font-size="9.5" fill="${CREAM}" fill-opacity=".5">${f}</text>`).join("")}
        <path d="${d}" fill="none" stroke="${CREAM}" stroke-opacity=".22" stroke-width="2" stroke-linejoin="round"/>
        <path d="${d}" fill="none" stroke="${ORANGE}" stroke-width="2.6" stroke-linejoin="round" clip-path="url(#${clip})"/>
        ${keys.map(([kt, kh]) => `<rect x="-3.2" y="-3.2" width="6.4" height="6.4" fill="${CREAM}" transform="translate(${f2(gx(kt))} ${f2(gy(kh))}) rotate(45)"/>`).join("")}
        <line class="p2-tm-ph" y1="${GY1 - 12}" y2="${GY0 + 2}" stroke="${YELLOW}" stroke-width="1.4"/>
        <path class="p2-tm-pt" d="M-5 ${GY1 - 18} L5 ${GY1 - 18} L0 ${GY1 - 11} Z" fill="${YELLOW}"/>
        <circle class="p2-tm-pd" r="5" fill="${YELLOW}" stroke="${INK}" stroke-width="2"/>
        <text class="p2-tm-cap" x="200" y="474" text-anchor="middle" font-family="'Instrument Serif', Georgia, serif" font-style="italic" font-size="40" fill="${INK}">Timing is everything.</text>
      </svg>`;
      const bg = q(s, ".p2-tm-ball"), gh = qa(s, ".p2-tm-gh"), sh = q(s, ".p2-tm-sh"), cr = q(s, ".p2-tm-cr");
      const ph = q(s, ".p2-tm-ph"), pt = q(s, ".p2-tm-pt"), pd = q(s, ".p2-tm-pd"), cap = q(s, ".p2-tm-cap");
      const place = (el, b) => el.setAttribute("transform", `translate(${f2(b.x)} ${f2(FLOOR - b.he)}) scale(${b.sx.toFixed(3)} ${b.sy.toFixed(3)})`);
      return (t) => {
        const vis = lin(0, 0.15, t) * (1 - lin(4.4, 4.7, t)), b = ball(t);
        place(bg, b); bg.style.opacity = vis;
        gh.forEach((g, i) => { const k = 3 - i, bt = t - k * 0.07; place(g, ball(bt)); g.style.opacity = (t - k * 0.07 > M0 && t - M0 < at + 0.2 ? 0.5 - k * 0.12 : 0) * vis; });
        sh.setAttribute("cx", f2(b.x)); sh.setAttribute("rx", f2(18 * (0.45 + 0.55 * (1 - b.he / H0)))); sh.style.opacity = vis;
        const x = gx(t);
        cr.setAttribute("width", f2(Math.max(0, x - GX0 + 4)));
        ph.setAttribute("x1", f2(x)); ph.setAttribute("x2", f2(x)); pt.setAttribute("transform", `translate(${f2(x)} 0)`);
        pd.setAttribute("cx", f2(x)); pd.setAttribute("cy", f2(gy(b.h)));
        const k = outCubic(lin(1.0, 1.6, t));
        cap.style.opacity = k * (1 - lin(4.4, 4.7, t)); cap.setAttribute("transform", `translate(0 ${f2((1 - k) * 10)})`);
      };
    } });

  // ---------- 2. Variable-font kinetic type ----------
  demo({ id: "vartype", name: "Variable-font kinetic type", kind: "type", stacks: ["css"], chips: ["font-stretch 62–125%", "font-weight 400–900", "-webkit-text-stroke"], grade: "A",
    purpose: "Moves one word by changing its width and weight, so the type carries the motion without any extra graphics.",
    seen: SEEN, period: 4, hero: 0.7,
    build(s) {
      s.style.background = BLUE;
      const P = 4, M = 6, ROWS = 9;
      s.innerHTML = `<div class="p2-vt-bg">${Array.from({ length: ROWS }, (_, r) => `<div class="p2-vt-row${r === 2 || r === 6 ? " p2-y" : ""}">${"<span>MOTION</span>".repeat(M)}</div>`).join("")}</div>
        <div class="p2-vt-word">${Array.from("MOTION").map((c) => `<span>${c}</span>`).join("")}</div>
        <div class="p2-vt-read"><span>ARCHIVO · wdth · wght</span><span>M <b class="p2-vt-w"></b>% · <b class="p2-vt-g"></b></span></div>`;
      const rows = qa(s, ".p2-vt-row"), ls = qa(s, ".p2-vt-word span"), rw = q(s, ".p2-vt-w"), rg = q(s, ".p2-vt-g");
      return (t) => {
        const ph = t / P, a = TAU * 2 * ph;
        rows.forEach((r, i) => {
          const k = i % 3 === 1 ? 2 : 1, off = (i % 2 ? 1 - ph : ph) * k;
          r.style.transform = `translateX(${(-off / M * 100).toFixed(3)}%)`;
        });
        ls.forEach((e, i) => {
          const w = 0.5 + 0.5 * Math.sin(a - i * 0.8), wd = 62 + 63 * w, wg = Math.round(400 + 500 * w);
          e.style.fontStretch = `${wd.toFixed(1)}%`; e.style.fontWeight = wg;
          e.style.transform = `translateY(${f2(Math.sin(a - i * 0.8 - 1.3) * 3.5)}cqw)`;
          if (i === 0) { rw.textContent = String(Math.round(wd)).padStart(3, " "); rg.textContent = wg; }
        });
      };
    } });

  // ---------- 3. Polar shape morph with a spring ----------
  demo({ id: "morph", name: "Polar shape morph with a spring", kind: "motion", stacks: ["svg"], chips: ["polar resampling, N = 180", "closed-form spring", "SVG path"], grade: "A",
    purpose: "Turns one shape into the next without tangled edges, because every shape is sampled at the same angles; the spring adds the overshoot.",
    seen: SEEN, period: 6, hero: 2.05,
    build(s) {
      s.style.background = INK;
      const P = 6, SEG = 1.5, HOLD = 0.35, DUR = SEG - HOLD, N = 180, CX = 200, CY = 236, Z = 0.36, W = 12, WD = W * Math.sqrt(1 - Z * Z);
      const polyR = (V, th) => {
        const dx = Math.cos(th), dy = Math.sin(th); let best = Infinity;
        for (let i = 0; i < V.length; i++) {
          const [ax, ay] = V[i], [bx, by] = V[(i + 1) % V.length], ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex;
          if (Math.abs(den) < 1e-9) continue;
          const tt = (ax * ey - ay * ex) / den, u = (ax * dy - ay * dx) / den;
          if (tt > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, tt);
        }
        return best;
      };
      const ring = (n, r0, r1) => Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (i / n) * TAU, r = i % 2 ? r1 : r0; return [r * Math.cos(a), r * Math.sin(a)]; });
      const SQ = [[-88, -88], [88, -88], [88, 88], [-88, 88]];
      const TRI = [0, 1, 2].map((i) => { const a = -Math.PI / 2 + (i / 3) * TAU; return [128 * Math.cos(a), 128 * Math.sin(a)]; });
      const STAR = ring(10, 128, 56);
      const SHAPES = [(th) => 100, (th) => polyR(SQ, th), (th) => polyR(TRI, th), (th) => polyR(STAR, th), (th) => 100];
      const NAMES = ["circle", "square", "triangle", "star", "circle"];
      const ROT = [0, 1, 2, 3, 4].map((k) => k * Math.PI / 2);
      // Shape k is sampled in the frame it will be rotated into, so it stands upright when its morph lands.
      const RAD = SHAPES.map((f, k) => Float64Array.from({ length: N }, (_, j) => f((j / N) * TAU + ROT[k])));
      const sp = (u) => 1 - Math.exp(-Z * W * u) * (Math.cos(WD * u) + (Z * W / WD) * Math.sin(WD * u));
      const END = sp(DUR);
      const ease = (u) => (u <= 0 ? 0 : u >= DUR ? 1 : sp(u) + (1 - END) * (u / DUR));
      const state = (t) => {
        const tt = ((t % P) + P) % P, k = Math.min(3, Math.floor(tt / SEG)), u = tt - k * SEG - HOLD, m = ease(u);
        return { k, u, m, rot: ROT[k] + (ROT[k + 1] - ROT[k]) * m };
      };
      const pts = (st, dx, dy) => {
        const A = RAD[st.k], B = RAD[st.k + 1], out = new Array(N);
        for (let j = 0; j < N; j++) { const r = A[j] + (B[j] - A[j]) * st.m, a = (j / N) * TAU + st.rot; out[j] = [CX + dx + r * Math.cos(a), CY + dy + r * Math.sin(a)]; }
        return out;
      };
      const pathOf = (p) => "M" + p.map((v) => `${v[0].toFixed(1)} ${v[1].toFixed(1)}`).join("L") + "Z";
      const M = MONO.replace(/"/g, "'");
      s.innerHTML = `<svg class="p2-fill" viewBox="0 0 400 500" aria-hidden="true">
        <g stroke="${CREAM}" stroke-opacity=".09" fill="none">
          <circle cx="${CX}" cy="${CY}" r="100" stroke-dasharray="3 5"/><circle cx="${CX}" cy="${CY}" r="150" stroke-dasharray="3 5"/>
          ${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * TAU; return `<line x1="${CX}" y1="${CY}" x2="${f2(CX + 172 * Math.cos(a))}" y2="${f2(CY + 172 * Math.sin(a))}"/>`; }).join("")}
        </g>
        <path class="p2-mo-b" fill="${BLUE}"/><path class="p2-mo-o" fill="${ORANGE}"/><path class="p2-mo-m" fill="${CREAM}"/>
        <path class="p2-mo-s" fill="none" stroke="${INK}" stroke-opacity=".4" stroke-width="1.2"/>
        <circle cx="${CX}" cy="${CY}" r="3" fill="${INK}"/>
        <text x="28" y="44" font-family="${M}" font-size="10" font-weight="700" letter-spacing="1.4" fill="${CREAM}" fill-opacity=".6">POLAR MORPH · r(θ)</text>
        <text class="p2-mo-l" x="28" y="468" font-family="${M}" font-size="12" font-weight="700" fill="${CREAM}"></text>
        <text x="372" y="468" text-anchor="end" font-family="${M}" font-size="10" fill="${CREAM}" fill-opacity=".5">N=${N} · ζ=${Z} · ω=${W}</text>
      </svg>`;
      const pb = q(s, ".p2-mo-b"), po = q(s, ".p2-mo-o"), pm = q(s, ".p2-mo-m"), ps = q(s, ".p2-mo-s"), lb = q(s, ".p2-mo-l");
      return (t) => {
        const st = state(t), main = pts(st, 0, 0);
        pb.setAttribute("d", pathOf(pts(state(t - 0.12), -9, 7)));
        po.setAttribute("d", pathOf(pts(state(t - 0.06), 9, -7)));
        pm.setAttribute("d", pathOf(main));
        let sd = "";
        for (let j = 0; j < N; j += 15) sd += `M${CX} ${CY}L${main[j][0].toFixed(1)} ${main[j][1].toFixed(1)}`;
        ps.setAttribute("d", sd);
        lb.textContent = st.u <= 0 ? NAMES[st.k] : st.u >= DUR * 0.75 ? NAMES[st.k + 1] : `${NAMES[st.k]} → ${NAMES[st.k + 1]}`;
      };
    } });

  // ---------- 4. Bauhaus tile rhythm ----------
  demo({ id: "rhythm", name: "Bauhaus tile rhythm", kind: "backdrop", stacks: ["canvas"], chips: ["Canvas 2D", "diagonal stagger", "seeded motifs"], grade: "A",
    purpose: "A pattern that turns in waves from corner to corner; a lively backdrop that still leaves room for one word.",
    seen: SEEN, period: 6, hero: 0.72,
    build(s) {
      s.style.background = INK;
      const g = canvas2d(s, 800, 1000), P = 6, COLS = 6, ROWS = 8, S = 60, OX = 20, OY = 10, h = S / 2;
      const R = rng(1919), PAL = [CREAM, CREAM, CREAM, INK, INK, INK, ORANGE, ORANGE, BLUE, BLUE, YELLOW];
      const KINDS = ["quarter", "half", "circle", "triangle", "square"];
      const tiles = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const bgc = PAL[Math.floor(R() * PAL.length)];
        let fg; do { fg = PAL[Math.floor(R() * PAL.length)]; } while (fg === bgc);
        tiles.push({ r, c, bg: bgc, fg, kind: KINDS[Math.floor(R() * KINDS.length)], rot: Math.floor(R() * 4) * 90 });
      }
      const WAVES = [{ at: 0.3, kind: "rot", deg: 90, rev: false }, { at: 1.7, kind: "flip", rev: true }, { at: 3.1, kind: "rot", deg: 90, rev: false }, { at: 4.5, kind: "rot", deg: 180, rev: true }];
      const motif = (kind) => {
        g.beginPath();
        if (kind === "quarter") { g.moveTo(-h, h); g.arc(-h, h, S, -Math.PI / 2, 0); g.closePath(); }
        else if (kind === "half") { g.arc(0, h, h, Math.PI, 0); g.closePath(); }
        else if (kind === "circle") { g.arc(0, 0, h * 0.64, 0, TAU); }
        else if (kind === "triangle") { g.moveTo(-h, -h); g.lineTo(h, h); g.lineTo(-h, h); g.closePath(); }
        else { g.rect(-h * 0.52, -h * 0.52, h * 1.04, h * 1.04); }
        g.fill();
      };
      const paint = (t) => {
        g.setTransform(2, 0, 0, 2, 0, 0);
        g.fillStyle = INK; g.fillRect(0, 0, 400, 500);
        for (const tl of tiles) {
          let rot = tl.rot, sx = 1;
          for (const w of WAVES) {
            const d = (w.rev ? (COLS - 1 - tl.c) + (ROWS - 1 - tl.r) : tl.c + tl.r) * 0.05, k = lin(w.at + d, w.at + d + 0.55, t);
            if (w.kind === "rot") rot += w.deg * back(k); else sx *= Math.cos(TAU * inOut(k));
          }
          const x = OX + tl.c * S, y = OY + tl.r * S;
          g.save();
          g.beginPath(); g.rect(x, y, S, S); g.clip();
          g.fillStyle = tl.bg; g.fillRect(x, y, S, S);
          g.translate(x + h, y + h); g.rotate((rot * Math.PI) / 180); g.scale(sx, 1);
          g.fillStyle = tl.fg; motif(tl.kind);
          g.restore();
        }
        g.fillStyle = CREAM; g.fillRect(0, 216, 400, 68);
        g.fillStyle = INK; g.fillRect(0, 216, 400, 2.5); g.fillRect(0, 281.5, 400, 2.5);
        g.font = `italic 400 64px ${SERIF}`; g.textAlign = "center"; g.textBaseline = "alphabetic";
        g.fillText("rhythm", 200, 267);
        g.font = `700 9px ${MONO}`; g.textAlign = "left"; g.fillStyle = ORANGE; g.fillText("6 × 8", 22, 253);
        g.textAlign = "right"; g.fillText("50 MS", 378, 253);
      };
      return withFonts([`italic 400 64px ${SERIF}`, `700 9px ${MONO}`], paint);
    } });

  // ---------- 5. Noise ridgelines ----------
  demo({ id: "ridgelines", name: "Noise ridgelines", kind: "backdrop", stacks: ["canvas"], chips: ["Canvas 2D", "seeded Perlin noise", "painter's order"], grade: "A",
    purpose: "Stacked lines of noise read as terrain or a sound wave; a calm, endless backdrop for a single word.",
    seen: SEEN, period: 8, hero: 1.6,
    build(s) {
      s.style.background = INK;
      const g = canvas2d(s, 800, 1000), P = 8, LINES = 40, NS = 120, X0 = 40, X1 = 360, Y0 = 104, Y1 = 446;
      const noise = perlin3(7), xs = new Float64Array(NS + 1), env = new Float64Array(NS + 1), py = new Float64Array(NS + 1);
      for (let j = 0; j <= NS; j++) { xs[j] = X0 + (X1 - X0) * (j / NS); env[j] = Math.exp(-Math.pow((xs[j] - 200) / 78, 2)); }
      const paint = (t) => {
        g.setTransform(2, 0, 0, 2, 0, 0);
        g.fillStyle = INK; g.fillRect(0, 0, 400, 500);
        // Time runs around a circle in two noise dimensions, so t = 0 and t = P meet exactly.
        const a = (TAU * t) / P, cy = Math.cos(a) * 0.85, cz = Math.sin(a) * 0.85;
        g.lineWidth = 1.25; g.lineJoin = "round"; g.strokeStyle = CREAM;
        for (let i = 0; i < LINES; i++) {
          const y = Y0 + (Y1 - Y0) * (i / (LINES - 1));
          for (let j = 0; j <= NS; j++) {
            const x = xs[j], n = noise(x * 0.021, i * 0.17 + cy, cz) + 0.5 * noise(x * 0.05 + 17.3, i * 0.29 + cy * 1.4, cz * 1.4 + 3.1);
            py[j] = y - (env[j] * 70 * Math.max(0, n + 0.18) + 2.2 * n);
          }
          g.beginPath(); g.moveTo(xs[0], py[0]);
          for (let j = 1; j <= NS; j++) g.lineTo(xs[j], py[j]);
          g.lineTo(X1, 500); g.lineTo(X0, 500); g.closePath();
          g.fillStyle = INK; g.fill();
          g.beginPath(); g.moveTo(xs[0], py[0]);
          for (let j = 1; j <= NS; j++) g.lineTo(xs[j], py[j]);
          g.stroke();
        }
        g.font = `italic 400 104px ${SERIF}`; g.textAlign = "center"; g.textBaseline = "alphabetic";
        g.lineWidth = 14; g.strokeStyle = INK; g.strokeText("flow", 200, 296);
        g.fillStyle = ORANGE; g.fillText("flow", 200, 296);
        g.font = `700 9px ${MONO}`; g.fillStyle = "rgba(242,239,232,.55)";
        g.textAlign = "left"; g.fillText("40 LINES · NOISE(x, i, t)", X0, 58);
        g.textAlign = "right"; g.fillText("SEED 7", X1, 58);
        g.textAlign = "left"; g.fillText(`t = ${(Math.floor(t * 10) / 10).toFixed(1)} s`, X0, 478);
      };
      return withFonts([`italic 400 104px ${SERIF}`, `700 9px ${MONO}`], paint);
    } });

  // ---------- 6. Code-rain backdrop ----------
  demo({ id: "coderain", name: "Code-rain backdrop", kind: "backdrop", stacks: ["canvas", "css"], chips: ["Canvas 2D text", "looping scroll", "typed headline"], grade: "A",
    purpose: "Lines of code scroll behind a headline that types itself.",
    seen: SEEN, period: 6, hero: 2.4,
    build(s) {
      s.style.background = INK;
      const g = canvas2d(s, 800, 1000), P = 6, R = rng(4242);
      const WORDS = ["frame(t)", "render(t)", "t => f(t)", "pure", "0x1F", "lerp(a, b)", "ease(t)", "return", "const t", "spring()", "clamp(x)", "draw()", "t % 6", "noise(x, t)", "30 fps", "seed = 7", "0xFF5A1F", "=> {", "}", "sin(t)", "f(t) = f(t)", "no state"];
      // Seven columns; each picks only fragments that fit its width (JetBrains Mono advances 0.6 em a character).
      const cols = [], CW = 400 / 7;
      for (let k = 0; k < 7; k++) {
        const size = [8, 9, 10, 11.5][Math.floor(R() * 4)], lh = size * 2.1, n = Math.ceil(500 / lh) + 3;
        const fit = WORDS.filter((w) => w.length * (0.6 * size + 0.4) <= CW - 8);
        const items = Array.from({ length: n }, () => {
          const r = R();
          return { w: fit[Math.floor(R() * fit.length)], col: r < 0.08 ? ORANGE : r < 0.13 ? YELLOW : CREAM, a: (r < 0.13 ? 0.42 : 0.1 + (size - 8) * 0.03) + R() * 0.08 };
        });
        cols.push({ x: k * CW + 5, size, lh, H: n * lh, loops: 1 + Math.floor(R() * 3), items });
      }
      s.insertAdjacentHTML("beforeend", `<div class="p2-cr-h"><span class="p2-cr-t"></span><em class="p2-cr-d"></em><i class="p2-cr-car"></i></div><div class="p2-cr-sub">// every frame is f(t)</div>`);
      const head = q(s, ".p2-cr-h"), tx = q(s, ".p2-cr-t"), dot = q(s, ".p2-cr-d"), car = q(s, ".p2-cr-car"), sub = q(s, ".p2-cr-sub");
      const TEXT = "Written\nin code.";
      const paint = (t) => {
        g.setTransform(2, 0, 0, 2, 0, 0);
        g.fillStyle = INK; g.fillRect(0, 0, 400, 500);
        g.textAlign = "left"; g.textBaseline = "top";
        g.letterSpacing = "0.4px"; // any letter spacing turns off JetBrains Mono's ligatures, so "=>" stays two characters
        for (const c of cols) {
          g.font = `500 ${c.size}px ${MONO}`;
          const off = ((t / P) * c.loops * c.H) % c.H;
          c.items.forEach((it, j) => {
            const y = ((j * c.lh + off) % c.H) - c.lh;
            if (y < -c.lh || y > 500) return;
            g.globalAlpha = it.a; g.fillStyle = it.col; g.fillText(it.w, c.x, y);
          });
        }
        g.globalAlpha = 1; g.letterSpacing = "0px";
        const band = g.createLinearGradient(0, 140, 0, 420);
        band.addColorStop(0, "rgba(17,16,22,0)"); band.addColorStop(0.3, "rgba(17,16,22,.9)"); band.addColorStop(0.72, "rgba(17,16,22,.9)"); band.addColorStop(1, "rgba(17,16,22,0)");
        g.fillStyle = band; g.fillRect(0, 140, 400, 280);
        const n = Math.floor(clamp((t - 0.5) * 13, 0, TEXT.length)), typed = TEXT.slice(0, n), done = n === TEXT.length;
        tx.textContent = typed.endsWith(".") ? typed.slice(0, -1) : typed; dot.textContent = typed.endsWith(".") ? "." : "";
        car.style.opacity = !done || Math.floor(t * 2.5) % 2 === 0 ? 1 : 0;
        const out = 1 - lin(5.4, 5.8, t);
        head.style.opacity = (t >= 0.35 ? 1 : 0) * out;
        sub.style.opacity = lin(2.0, 2.4, t) * out;
      };
      return withFonts([`500 12px ${MONO}`], paint);
    } });

  // ---------- 7. 3D card flip grid ----------
  demo({ id: "cardflip", name: "3D card flip grid", kind: "ui", stacks: ["css"], chips: ["CSS 3D transform", "backface-visibility", "diagonal stagger"], grade: "A",
    purpose: "Reveals nine items in turn without changing the layout: each card shows its other side, then flips back.",
    seen: SEEN, period: 5, hero: 1.05,
    build(s) {
      s.style.background = CREAM;
      const L = ["EASE", "SPRING", "TYPE", "DEPTH", "FRAME", "RHYTHM", "GRID", "LOOP", "GLITCH"];
      const BACK = [[ORANGE, INK], [BLUE, CREAM], [YELLOW, INK]];
      s.innerHTML = `<div class="p2-cf-head"><b>The toolkit</b><span>rotateY · 120 ms</span></div>
        <div class="p2-cf-grid">${L.map((l, i) => { const [bgc, fg] = BACK[i % 3]; const n = String(i + 1).padStart(2, "0");
          return `<div class="p2-cf-card"><div class="p2-cf-in"><div class="p2-cf-f"><i>${n}</i><b>${l}</b></div><div class="p2-cf-b" style="background:${bgc};color:${fg}"><b>${l.toLowerCase()}</b><i>${n}</i></div></div></div>`; }).join("")}</div>`;
      const cs = qa(s, ".p2-cf-in");
      return (t) => cs.forEach((e, i) => {
        const d = (Math.floor(i / 3) + (i % 3)) * 0.12, k1 = lin(0.5 + d, 1.3 + d, t), k2 = lin(2.9 + d, 3.7 + d, t);
        const ang = 180 * back(k1) - 180 * back(k2), lift = Math.sin(Math.PI * k1) + Math.sin(Math.PI * k2);
        e.style.transform = `translateZ(${f2(lift * 3)}cqw) rotateY(${f2(ang)}deg)`;
      });
    } });

  // ---------- 8. Self-drawing data chart ----------
  demo({ id: "datachart", name: "Self-drawing data chart", kind: "ui", stacks: ["svg"], chips: ["SVG stroke-dashoffset", "gradient area", "stroke-dasharray ring"], grade: "A",
    purpose: "Builds a line, its bars and a goal ring in order, so the eye reads the numbers in the order they matter.",
    seen: SEEN, period: 6, hero: 3.6,
    build(s) {
      s.style.background = INK;
      const DATA = [22, 30, 27, 38, 35, 46, 44, 55, 52, 63, 70, 78], VOL = [40, 52, 45, 60, 48, 66, 58, 72, 64, 70, 80, 74];
      const X0 = 44, X1 = 368, Y0 = 188, Y1 = 446, M = MONO.replace(/"/g, "'");
      const px = (i) => X0 + (i / 11) * (X1 - X0), py = (v) => Y1 - (v / 100) * (Y1 - Y0);
      const P0 = DATA.map((v, i) => [px(i), py(v)]);
      // Catmull-Rom through the data, sampled finely; arc length is measured here so the dash and the dot agree.
      const pts = [];
      for (let i = 0; i < 11; i++) {
        const a = P0[Math.max(0, i - 1)], b = P0[i], c = P0[i + 1], d = P0[Math.min(11, i + 2)];
        for (let k = 0; k < 20; k++) {
          const u = k / 20, u2 = u * u, u3 = u2 * u;
          pts.push([0, 1].map((z) => 0.5 * (2 * b[z] + (-a[z] + c[z]) * u + (2 * a[z] - 5 * b[z] + 4 * c[z] - d[z]) * u2 + (-a[z] + 3 * b[z] - 3 * c[z] + d[z]) * u3)));
        }
      }
      pts.push(P0[11]);
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const LEN = cum[cum.length - 1];
      const at = (p) => {
        const L = p * LEN; let i = 1;
        while (i < cum.length - 1 && cum[i] < L) i++;
        const k = (L - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
        return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
      };
      const line = "M" + pts.map((p) => `${f2(p[0])} ${f2(p[1])}`).join("L");
      const gid = nid("dcgrad"), cid = nid("dcclip");
      const RC = [334, 76, 34];
      s.innerHTML = `<svg class="p2-fill" viewBox="0 0 400 500" aria-hidden="true">
        <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ORANGE}" stop-opacity=".5"/><stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/></linearGradient>
          <clipPath id="${cid}"><rect class="p2-dc-cr" x="${X0 - 2}" y="${Y0 - 40}" width="0" height="${Y1 - Y0 + 42}"/></clipPath></defs>
        <g class="p2-dc-all">
          <g class="p2-dc-ti"><text x="28" y="72" font-family="Archivo, sans-serif" font-weight="800" font-size="31" fill="${CREAM}" style="font-stretch:92%">Data in motion</text>
            <text x="28" y="96" font-family="${M}" font-size="10" fill="${CREAM}" fill-opacity=".5" letter-spacing=".6">MONTHLY ACTIVE USERS · 2026</text></g>
          ${[0, 25, 50, 75, 100].map((v) => `<line x1="${X0}" x2="${X1}" y1="${f2(py(v))}" y2="${f2(py(v))}" stroke="${CREAM}" stroke-opacity="${v ? 0.08 : 0.3}" ${v ? 'stroke-dasharray="2 4"' : ""}/><text x="${X0 - 8}" y="${f2(py(v) + 3)}" text-anchor="end" font-family="${M}" font-size="9" fill="${CREAM}" fill-opacity=".45">${v}</text>`).join("")}
          ${VOL.map((v, i) => `<rect class="p2-dc-bar" x="${f2(px(i) - 8)}" width="16" rx="2" fill="${BLUE}" fill-opacity=".75"/>`).join("")}
          ${"JFMAMJJASOND".split("").map((m, i) => `<text x="${f2(px(i))}" y="${Y1 + 18}" text-anchor="middle" font-family="${M}" font-size="10" fill="${CREAM}" fill-opacity=".5">${m}</text>`).join("")}
          <path d="${line}L${X1} ${Y1}L${X0} ${Y1}Z" fill="url(#${gid})" clip-path="url(#${cid})"/>
          <path class="p2-dc-ln" d="${line}" fill="none" stroke="${ORANGE}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${f2(LEN)} ${f2(LEN + 10)}"/>
          <circle class="p2-dc-halo" r="11" fill="${YELLOW}" fill-opacity=".22"/><circle class="p2-dc-dot" r="5.5" fill="${YELLOW}" stroke="${INK}" stroke-width="2"/>
          <text class="p2-dc-v" text-anchor="middle" font-family="${M}" font-size="11" font-weight="700" fill="${CREAM}"></text>
          <circle cx="${RC[0]}" cy="${RC[1]}" r="${RC[2]}" fill="none" stroke="${CREAM}" stroke-opacity=".12" stroke-width="8"/>
          <circle class="p2-dc-ring" cx="${RC[0]}" cy="${RC[1]}" r="${RC[2]}" fill="none" stroke="${YELLOW}" stroke-width="8" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" transform="rotate(-90 ${RC[0]} ${RC[1]})"/>
          <text class="p2-dc-n" x="${RC[0]}" y="${RC[1] + 6}" text-anchor="middle" font-family="${M}" font-size="17" font-weight="700" fill="${CREAM}">0%</text>
          <text x="${RC[0]}" y="${RC[1] + RC[2] + 22}" text-anchor="middle" font-family="${M}" font-size="9.5" fill="${CREAM}" fill-opacity=".55">OF GOAL</text>
        </g></svg>`;
      const all = q(s, ".p2-dc-all"), ti = q(s, ".p2-dc-ti"), bars = qa(s, ".p2-dc-bar"), ln = q(s, ".p2-dc-ln"), cr = q(s, ".p2-dc-cr");
      const halo = q(s, ".p2-dc-halo"), dot = q(s, ".p2-dc-dot"), val = q(s, ".p2-dc-v"), ringEl = q(s, ".p2-dc-ring"), num = q(s, ".p2-dc-n");
      return (t) => {
        all.style.opacity = lin(0, 0.25, t) * (1 - lin(5.4, 5.85, t));
        const kt = outCubic(lin(0.1, 0.6, t));
        ti.style.opacity = kt; ti.setAttribute("transform", `translate(0 ${f2((1 - kt) * 12)})`);
        bars.forEach((b, i) => {
          const hgt = (VOL[i] / 100) * (Y1 - Y0) * 0.62 * outCubic(lin(0.3 + i * 0.06, 0.9 + i * 0.06, t));
          b.setAttribute("y", f2(Y1 - hgt)); b.setAttribute("height", f2(hgt));
        });
        const p = inOut(lin(0.8, 3.2, t)), [dx, dy] = at(p);
        ln.setAttribute("stroke-dashoffset", f2(LEN * (1 - p)));
        cr.setAttribute("width", f2(dx - X0 + 2));
        const on = t >= 0.8 ? 1 : 0;
        [halo, dot].forEach((c) => { c.setAttribute("cx", f2(dx)); c.setAttribute("cy", f2(dy)); c.style.opacity = on; });
        halo.setAttribute("r", f2(11 + 3 * Math.sin(TAU * t * 1.5)));
        const v = Math.round(((Y1 - dy) / (Y1 - Y0)) * 100);
        val.textContent = String(v); val.setAttribute("x", f2(Math.min(dx, X1 - 10))); val.setAttribute("y", f2(dy - 16)); val.style.opacity = on;
        const kr = outCubic(lin(1.0, 3.2, t));
        ringEl.setAttribute("stroke-dashoffset", (1 - 0.65 * kr).toFixed(4));
        ringEl.style.opacity = kr > 0 ? 1 : 0;
        num.textContent = `${Math.round(65 * kr)}%`;
      };
    } });
})();
