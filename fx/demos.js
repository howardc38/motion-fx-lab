// Motion FX Lab: every effect is build(stage) -> frame(t, abs), a pure function of time.
// build() may return the frame function, or { frame, ready } when it waits for fonts.
// 3D tiles share one WebGL renderer (R3) and copy its canvas into their own tile canvas.
// Load order: three.js r128 and its examples (EffectComposer, RenderPass, ShaderPass, UnrealBloomPass), then this file.
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
  // Every 2D layout here is authored for a 16:9 stage and centred, and the copy
  // is fictional and neutral.
  let UID = 0;
  const uid = (p) => `${p}-${++UID}`;
  const decay = (u, k) => (u < 0 ? 0 : Math.exp(-u * k));
  const TAU = Math.PI * 2;
  const mixHex = (a, b, k) => {
    const p = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
    return `rgb(${[0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * clamp(k))).join(",")})`;
  };

  demo({ id: "whip", name: "Whip-in letters + motion blur", kind: "type", stacks: ["svg", "css"], chips: ["SVG feGaussianBlur from velocity", "ghost trail", "spring overshoot + shake"], grade: "A",
    purpose: "Big letters whip in from the side, blurred and trailed along the direction they travel; each overshoots, snaps back and lands with a jolt.", period: 3.2, hero: 0.54,
    build(s) {
      s.style.background = "#f4f1ea";
      const WORD = Array.from("SPRINT"), N = WORD.length, GHOSTS = 4, GAP = 0.012, id = uid("fxw");
      s.innerHTML = `<svg class="defs" aria-hidden="true"><defs>${WORD.map((_, i) => `<filter id="${id}-${i}" x="-200%" y="-10%" width="500%" height="120%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="0 0"/></filter>`).join("")}</defs></svg>
        <div class="wh-streaks">${Array.from({ length: 7 }, () => "<i></i>").join("")}</div>
        <div class="wh-col"><div class="wh-word">${WORD.map((c, i) => `<span class="wh-l">${Array.from({ length: GHOSTS }, () => `<b class="wh-g" style="filter:url(#${id}-${i})">${c}</b>`).join("")}<b class="wh-m" style="filter:url(#${id}-${i})">${c}</b></span>`).join("")}</div>
        <div class="wh-bar"></div><div class="wh-cap">STAGE 4 · 182 KM · FLAT FINISH</div></div>`;
      const col = q(s, ".wh-col"), letters = qa(s, ".wh-l"), blur = qa(s, "feGaussianBlur"), bar = q(s, ".wh-bar"), cap = q(s, ".wh-cap"), streaks = qa(s, ".wh-streaks i");
      // Each letter is a damped spring released from 118cqw to the right: fast arrival, one small overshoot, settle.
      // It stretches along its path while fast and squashes against the overshoot.
      const Z = 0.8, OM = 26, WD = OM * Math.sqrt(1 - Z * Z), X0 = 118;
      const enter = (u) => (u <= 0 ? X0 : Math.exp(-Z * OM * u) * X0 * (Math.cos(WD * u) + ((Z * OM) / WD) * Math.sin(WD * u)));
      const leave = (u) => (u < -0.14 ? 0 : u < 0 ? 2.4 * Math.sin(Math.PI * (u + 0.14) / 0.14) : -160 * Math.pow(Math.min(u, 0.34) / 0.34, 3) - 500 * Math.max(0, u - 0.34));
      const IN = WORD.map((_, i) => 0.05 + i * 0.075), OUT = WORD.map((_, i) => 2.55 + i * 0.045);
      const pos = (i, t) => enter(t - IN[i]) + leave(t - OUT[i]);
      const vel = (i, t) => (pos(i, t) - pos(i, t - 1 / 240)) * 240;
      const shown = (i, t) => t >= IN[i] && t < OUT[i] + 0.42;
      const shape = (i, t) => { const x = pos(i, t), sq = Math.max(-2.5, Math.min(0, x)) * (t < OUT[i] - 0.15 ? 1 : 0), st = Math.min(0.45, Math.abs(vel(i, t)) / 2600);
        return `translateX(${x.toFixed(2)}cqw) scale(${((1 + st) * (1 + 0.075 * sq)).toFixed(4)}, ${((1 - 0.25 * st) * (1 - 0.05 * sq)).toFixed(4)})`; };
      return (t) => {
        const px = (s.clientWidth || 640) / 100;
        let fast = 0;
        letters.forEach((l, i) => {
          const v = vel(i, t), on = shown(i, t);
          fast = Math.max(fast, on ? Math.abs(v) : 0);
          const [m, ...gh] = [l.lastElementChild, ...[...l.children].slice(0, GHOSTS)];
          m.style.transform = shape(i, t); m.style.opacity = on ? 1 : 0;
          blur[i].setAttribute("stdDeviation", `${(Math.min(7, Math.abs(v) * 0.0055) * px).toFixed(1)} 0`);
          gh.forEach((g, j) => {
            const tg = t - (GHOSTS - j) * GAP, vg = Math.abs(vel(i, tg));
            g.style.transform = shape(i, tg);
            g.style.opacity = shown(i, tg) && on ? ((j + 1) / GHOSTS) * 0.5 * clamp((vg - 60) / 420) : 0;
          });
        });
        // Every landing kicks the frame; the last letter kicks hardest.
        let sx = 0, sy = 0;
        IN.forEach((a, i) => {
          const u = t - a - 0.1, amp = i === N - 1 ? 1.5 : 0.35, e = decay(u, 13) * amp;
          sx += e * Math.sin(u * TAU * 17); sy += e * 0.7 * Math.sin(u * TAU * 13 + 1);
        });
        col.style.transform = `translate(calc(-50% + ${sx.toFixed(3)}cqw), calc(-50% + ${sy.toFixed(3)}cqw))`;
        bar.style.transform = `scaleX(${(outCubic(lin(0.62, 0.9, t)) * (1 - inCubic(lin(2.42, 2.6, t)))).toFixed(4)})`;
        cap.style.opacity = lin(0.8, 1.05, t) * (1 - lin(2.38, 2.52, t));
        const sp = clamp((fast - 150) / 700);
        streaks.forEach((e, j) => { e.style.opacity = (sp * (0.35 + 0.1 * (j % 3))).toFixed(3); e.style.transform = `translateX(${(100 - ((t * 520 + j * 47) % 190)).toFixed(2)}cqw)`; });
      };
    } });

  demo({ id: "chars", name: "Character pop", kind: "type", stacks: ["css"], chips: ["CSS transform", "engine.js chars"], grade: "A",
    purpose: "One character at a time, so the eye reads along; the key word changes colour once the line is complete.", period: 4, hero: 2.7,
    build(s) {
      s.style.background = "radial-gradient(120% 95% at 50% 42%, #2c2018, #110c09)";
      const lines = ["Fresh bread,", "every morning."], KEY = 6;
      s.innerHTML = `<div class="ch-box"><div class="ch-lines">${lines.map((l, li) => `<div>${Array.from(l).map((c, ci) => `<span${li === 1 && ci >= KEY ? ' class="ch-k"' : ""}${c === " " ? ' style="white-space:pre"' : ""}>${c}</span>`).join("")}</div>`).join("")}</div><div class="ch-cap">Corner bakery · ovens on at 5:30</div></div>`;
      const sp = qa(s, ".ch-lines span"), keys = qa(s, ".ch-k"), cap = q(s, ".ch-cap");
      return (t) => {
        sp.forEach((e, i) => {
          const a = 0.05 + i * 0.042, k = lin(a, a + 0.3, t), out = lin(3.5 + i * 0.008, 3.74 + i * 0.008, t);
          e.style.opacity = Math.min(1, k * 3) * (1 - out);
          e.style.transform = `translateY(${((1 - k) * 35 - out * 30).toFixed(2)}%) scale(${(0.3 + 0.7 * back(k)).toFixed(4)})`;
        });
        keys.forEach((e, j) => {
          const k = lin(1.42 + j * 0.05, 1.58 + j * 0.05, t);
          e.style.color = mixHex("#f7efe3", "#ffb340", k);
          e.style.transform += ` translateY(${(-6 * Math.sin(Math.PI * k)).toFixed(2)}%)`;
        });
        cap.style.opacity = lin(1.3, 1.6, t) * (1 - lin(3.55, 3.8, t));
      };
    } });

  demo({ id: "mark", name: "Highlighter", kind: "type", stacks: ["css"], chips: ["CSS scaleX", "engine.js mark"], grade: "A",
    purpose: "Draws the eye to one phrase at a time, as a marker pen would; in the sample, the two numbers a baker must not miss.", period: 3.6, hero: 2.5,
    build(s) {
      s.style.background = "#ece6db";
      s.innerHTML = `<div class="mk-card"><div class="mk-h"><span>RECIPE · COUNTRY SOURDOUGH</span><span>STEP 6 OF 8</span></div>
        <p>Bake at <span class="mk"><i></i>230 °C for 20 minutes</span>,</p>
        <p>then <span class="mk"><i></i>lower to 210 °C</span>.</p>
        <p class="mk-dim">Lid off for the last 25 minutes.</p></div>`;
      const card = q(s, ".mk-card"), bars = qa(s, ".mk i");
      return (t) => {
        card.style.transform = `translate(-50%, -50%) scale(${(1 + 0.035 * Math.pow(Math.sin((Math.PI * t) / 3.6), 2)).toFixed(4)})`;
        bars.forEach((b, i) => {
          const a = 0.45 + i * 0.8, k = outCubic(lin(a, a + 0.5, t)), out = inCubic(lin(3.12 + i * 0.08, 3.38 + i * 0.08, t));
          b.style.transform = `scaleX(${(k * (1 - out)).toFixed(4)})`;
        });
      };
    } });

  demo({ id: "count", name: "Counting number", kind: "type", stacks: ["css"], chips: ["JS counter", "tabular-nums"], grade: "A",
    purpose: "A number counts up to its value while a bar fills toward the goal; tabular digits keep its width steady.", period: 3.2, hero: 2.4,
    build(s) {
      s.style.background = "radial-gradient(110% 90% at 50% 40%, #173226, #0b1711)";
      s.innerHTML = `<div class="ct-box"><div class="ct-l">Trees planted along the river this year</div><div class="ct-n"><span>0</span></div>
        <div class="ct-bar"><i></i></div><div class="ct-row"><span>Volunteer planting log · Oct 2026</span><span>Goal 15,000</span></div><div class="ct-chip">+1,120 this month</div></div>`;
      const box = q(s, ".ct-box"), n = q(s, ".ct-n span"), num = q(s, ".ct-n"), fill = q(s, ".ct-bar i"), chip = q(s, ".ct-chip");
      return (t) => {
        const k = outCubic(lin(0.25, 1.75, t));
        n.textContent = Math.round(12480 * k).toLocaleString("en-US");
        fill.style.transform = `scaleX(${(k * 12480 / 15000).toFixed(4)})`;
        num.style.transform = `scale(${(1 + 0.07 * Math.sin(Math.PI * lin(1.75, 1.95, t))).toFixed(4)})`;
        chip.style.transform = `scale(${Math.max(0, back(lin(1.9, 2.15, t))).toFixed(4)})`;
        box.style.opacity = 1 - lin(2.95, 3.15, t);
      };
    } });

  demo({ id: "type", name: "Typewriter", kind: "type", stacks: ["css"], chips: ["JS per character", "CSS caret"], grade: "A",
    purpose: "Shows a reply being written, one character at a time; reads instantly as a chat.", period: 5, hero: 3.6,
    build(s) {
      s.style.background = "linear-gradient(160deg, #dfe7ef, #c5d2df)";
      const txt = Array.from("Yes! Meet at the bridge, I'll bring coffee.");
      s.innerHTML = `<div class="ty-win"><div class="ty-top"><b>MJ</b><span><strong>Maya</strong><em>Riverside cycling club</em></span></div>
        <div class="ty-body"><div class="ty-b ty-them">Still on for the 7:30 ride tomorrow?</div><div class="ty-b ty-me"><span class="ty-t"></span><span class="car"></span></div><div class="ty-tick">Delivered</div></div></div>`;
      const them = q(s, ".ty-them"), me = q(s, ".ty-me"), ty = q(s, ".ty-t"), car = q(s, ".car"), tick = q(s, ".ty-tick");
      return (t) => {
        const out = 1 - lin(4.62, 4.9, t);
        them.style.opacity = lin(0.1, 0.3, t) * out; them.style.transform = `translateY(${((1 - outCubic(lin(0.1, 0.35, t))) * 2).toFixed(2)}cqw)`;
        me.style.opacity = (t > 0.7 ? 1 : 0) * out;
        const n = Math.floor(clamp((t - 0.8) * 13, 0, txt.length));
        ty.textContent = txt.slice(0, n).join("");
        car.style.opacity = n < txt.length || Math.floor(t * 2.5) % 2 === 0 ? 1 : 0;
        tick.style.opacity = lin(4.25, 4.4, t) * out;
      };
    } });

  demo({ id: "stamp", name: "Red flash + shake + stamp", kind: "type", stacks: ["svg", "css"], chips: ["SVG turbulence ink", "engine.js slam / shake / flash", "dust burst"], grade: "A",
    purpose: "An alarm beat: the stamp hovers, slams down with a red flash and a shake, and leaves rough ink, spatter and a puff of dust. In the sample, a cancelled boarding pass.", period: 3.6, hero: 1.25,
    build(s) {
      s.style.background = "radial-gradient(110% 95% at 50% 45%, #2e2924, #110f0d)";
      const id = uid("stp"), TI = 1.04, F = "Archivo, 'Helvetica Neue', Arial, sans-serif", M = "'JetBrains Mono', Menlo, monospace";
      const DUST = Array.from({ length: 48 }, (_, i) => {
        const a = hash(i * 3.1 + 1) * TAU, puff = i < 10;
        return { x: 790 + Math.cos(a) * 440, y: 500 + Math.sin(a) * 125, dx: Math.cos(a), dy: Math.sin(a) * 0.7, sp: puff ? 60 + hash(i * 7.7) * 80 : 120 + hash(i * 7.7) * 260, r: puff ? 34 + hash(i * 5.3) * 30 : 1.6 + hash(i * 5.3) * 3.2, d: hash(i * 2.9) * 0.06, life: puff ? 0.9 + hash(i * 9.1) * 0.4 : 0.4 + hash(i * 9.1) * 0.5, puff };
      });
      const SPLAT = Array.from({ length: 16 }, (_, i) => {
        const a = hash(i * 4.4 + 2) * TAU, r = 1 + hash(i * 6.2) * 0.32;
        return { x: Math.cos(a) * 455 * r, y: Math.sin(a) * 135 * r, r: 3 + Math.pow(hash(i * 8.8), 2) * 14 };
      });
      const field = (x, label, value) => `<text x="${x}" y="606" font-family="${M}" font-size="22" font-weight="700" fill="#8b8273" letter-spacing="2">${label}</text><text x="${x}" y="652" font-family="${F}" font-size="40" font-weight="800" fill="#1d1b1f">${value}</text>`;
      s.innerHTML = `<svg class="svgfill" viewBox="0 0 1600 900" aria-hidden="true"><defs>
          <filter id="${id}-ink" x="-8%" y="-30%" width="116%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" result="d"/><feTurbulence type="fractalNoise" baseFrequency="0.028 0.05" numOctaves="3" seed="11" result="sp"/><feColorMatrix in="sp" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -6 0 0 0 4.5" result="m"/><feComposite in="d" in2="m" operator="in"/></filter>
          <filter id="${id}-soft"><feGaussianBlur stdDeviation="14"/></filter></defs>
        <g class="stp-all"><g class="stp-pass">
          <rect x="230" y="215" width="1140" height="470" rx="30" fill="#f4eee1"/>
          <path d="M260 215 H1340 A30 30 0 0 1 1370 245 V312 H230 V245 A30 30 0 0 1 260 215 Z" fill="#1f3a56"/>
          <text x="282" y="278" font-family="${F}" font-size="38" font-weight="800" letter-spacing="6" fill="#f4eee1">BOARDING PASS</text>
          <text x="1318" y="276" text-anchor="end" font-family="${M}" font-size="24" font-weight="700" letter-spacing="3" fill="#9fc0dd">ECONOMY · ZONE 3</text>
          <line x1="1088" y1="330" x2="1088" y2="672" stroke="#c8bda9" stroke-width="4" stroke-dasharray="10 12"/>
          <text x="290" y="372" font-family="${M}" font-size="22" font-weight="700" fill="#8b8273" letter-spacing="2">FROM</text>
          <text x="282" y="482" font-family="${F}" font-size="124" font-weight="900" fill="#69707d">HKG</text>
          <text x="290" y="528" font-family="${F}" font-size="30" font-weight="600" fill="#5e574c">Hong Kong</text>
          <path d="M572 446 H678 M650 420 L682 446 L650 472" fill="none" stroke="#1f3a56" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
          <text x="728" y="372" font-family="${M}" font-size="22" font-weight="700" fill="#8b8273" letter-spacing="2">TO</text>
          <text x="720" y="482" font-family="${F}" font-size="124" font-weight="900" fill="#69707d">OSL</text>
          <text x="728" y="528" font-family="${F}" font-size="30" font-weight="600" fill="#5e574c">Oslo</text>
          <line x1="290" y1="566" x2="1040" y2="566" stroke="#ddd3c2" stroke-width="3"/>
          ${field(290, "FLIGHT", "208")}${field(480, "DATE", "18 OCT")}${field(700, "BOARDS", "07:45")}${field(900, "GATE", "23")}
          <text x="1126" y="372" font-family="${M}" font-size="22" font-weight="700" fill="#8b8273" letter-spacing="2">SEAT</text>
          <text x="1120" y="470" font-family="${F}" font-size="96" font-weight="900" fill="#1d1b1f">14B</text>
          <g fill="#1d1b1f">${Array.from({ length: 30 }, (_, i) => `<rect x="${1126 + i * 7.4}" y="560" width="${hash(i * 1.7) > 0.5 ? 4.5 : 2.2}" height="96"/>`).join("")}</g>
        </g>
        <g class="stp-st"><g filter="url(#${id}-ink)">
          <rect x="-440" y="-118" width="880" height="236" rx="26" fill="none" stroke="#d7263d" stroke-width="20"/>
          <rect x="-412" y="-90" width="824" height="180" rx="14" fill="none" stroke="#d7263d" stroke-width="6"/>
          <text x="0" y="52" text-anchor="middle" font-family="${F}" font-size="146" font-weight="900" textLength="760" lengthAdjust="spacingAndGlyphs" fill="#d7263d">CANCELLED</text>
          <g class="stp-splat" fill="#d7263d">${SPLAT.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}"/>`).join("")}</g>
        </g></g></g>
        <g class="stp-dust" fill="#e9dfcf">${DUST.map((p) => (p.puff ? `<circle filter="url(#${id}-soft)"/>` : "<circle/>")).join("")}</g></svg><div class="stp-flash"></div>`;
      const all = q(s, ".stp-all"), pass = q(s, ".stp-pass"), st = q(s, ".stp-st"), splat = qa(s, ".stp-splat circle"), dust = qa(s, ".stp-dust circle"), fl = q(s, ".stp-flash"), svg = q(s, "svg");
      return (t) => {
        const kin = outCubic(lin(0, 0.35, t)), u = t - TI;
        // Hover and lift (anticipation), slam, then a small squash.
        let sc = 1, op = 1;
        if (t < 0.68) op = 0;
        else if (t < 0.95) { const k = lin(0.68, 0.95, t); sc = 1.7 + 0.12 * k; op = 0.28 * Math.min(1, k * 3); }
        else if (t < TI) { const k = inCubic(lin(0.95, TI, t)); sc = 1.82 - 0.82 * k; op = 0.35 + 0.65 * k; }
        else sc = 1 - 0.035 * Math.sin(Math.PI * lin(TI, TI + 0.12, t));
        st.setAttribute("transform", `translate(790 500) rotate(-9) scale(${sc.toFixed(4)})`); st.style.opacity = op;
        const e = decay(u, 8.5) * (u >= 0 ? 1 : 0);
        pass.setAttribute("transform", `translate(${(16 * e * Math.sin(u * TAU * 15)).toFixed(2)} ${(40 * (1 - kin) + 10 * e * Math.sin(u * TAU * 11 + 1)).toFixed(2)}) rotate(${(0.7 * e * Math.sin(u * TAU * 9)).toFixed(3)} 800 450)`);
        pass.style.opacity = lin(0, 0.25, t);
        splat.forEach((c, i) => { const k = lin(TI + i * 0.004, TI + 0.06 + i * 0.004, t), p = SPLAT[i]; c.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${k.toFixed(3)}) translate(${(-p.x).toFixed(1)} ${(-p.y).toFixed(1)})`); });
        dust.forEach((c, i) => {
          const p = DUST[i], v = u - p.d, k = v > 0 && v < p.life ? 1 - v / p.life : 0, dd = p.sp * (1 - Math.exp(-Math.max(0, v) * 4.5));
          c.setAttribute("cx", (p.x + p.dx * dd).toFixed(1)); c.setAttribute("cy", (p.y + p.dy * dd - 60 * Math.max(0, v)).toFixed(1));
          c.setAttribute("r", (p.r * (1 + Math.max(0, v) * (p.puff ? 1.4 : 0.3))).toFixed(1)); c.style.opacity = ((p.puff ? 0.22 : 0.85) * k).toFixed(3);
        });
        fl.style.opacity = u >= 0 ? (0.55 * decay(u, 6)).toFixed(3) : 0;
        svg.style.opacity = 1 - lin(3.25, 3.5, t);
        all.setAttribute("transform", `translate(800 450) scale(${(1 + 0.04 * e).toFixed(4)}) translate(-800 -450)`);
      };
    } });

  demo({ id: "scan", name: "Scan and check", kind: "ui", stacks: ["css"], chips: ["CSS gradient", "engine.js scan"], grade: "A",
    purpose: "A scan line passes down a list and ticks each item off as it goes; in the sample, a grocery order checked against stock.", period: 4.4, hero: 2.7,
    build(s) {
      s.style.background = "radial-gradient(110% 90% at 50% 40%, #232032, #110f18)";
      const ROWS = [["Oat milk, 1 L", "× 2", 1], ["Sourdough loaf", "× 1", 1], ["Free-range eggs, 12", "× 1", 1], ["Blueberries, 250 g", "× 1", 0]];
      s.innerHTML = `<div class="sn-card"><div class="sn-h"><span>ORDER #4821</span><span class="sn-st">CHECKING STOCK…</span></div>
        <div class="sn-rows">${ROWS.map((r) => `<div class="sn-r"><span>${r[0]}</span><em>${r[1]}</em><b class="${r[2] ? "sn-ok" : "sn-no"}">${r[2] ? "✓ In stock" : "✗ Sold out"}</b></div>`).join("")}<div class="sn-bar"></div></div>
        <div class="sn-warn">Pick a swap for 1 item</div></div>`;
      const card = q(s, ".sn-card"), bar = q(s, ".sn-bar"), chips = qa(s, ".sn-r b"), rows = qa(s, ".sn-r"), st = q(s, ".sn-st"), warn = q(s, ".sn-warn");
      return (t) => {
        const k = lin(0.3, 1.9, t);
        bar.style.top = `${(k * 100).toFixed(2)}%`; bar.style.opacity = t > 0.3 && t < 1.95 ? 1 : 0;
        chips.forEach((c, i) => { const a = 0.3 + 1.6 * ((i + 0.55) / ROWS.length); c.style.transform = `scale(${Math.max(0, back(lin(a, a + 0.25, t))).toFixed(4)})`; rows[i].classList.toggle("sn-lit", t > a && t < a + 0.35); });
        st.textContent = t < 1.95 ? "CHECKING STOCK…" : "3 OF 4 AVAILABLE";
        warn.style.opacity = lin(2.0, 2.3, t); warn.style.transform = `translateY(${((1 - outCubic(lin(2.0, 2.3, t))) * 1.5).toFixed(2)}cqw)`;
        card.style.opacity = 1 - lin(4.05, 4.35, t);
      };
    } });

  demo({ id: "sweep", name: "Light sweep", kind: "ui", stacks: ["css"], chips: ["CSS linear-gradient", "CSS 3D tilt"], grade: "A",
    purpose: "A band of light sweeps across a card as it tilts, the way light catches a glossy surface.", period: 3, hero: 0.95,
    build(s) {
      s.style.background = "radial-gradient(120% 90% at 50% 30%, #2d2140, #0c0a12)";
      s.innerHTML = `<div class="sw-wrap"><div class="sw-card"><div class="sw-top"><b>LANTERN</b><span>CINEMA CLUB</span></div><i class="sw-chip"></i>
        <div class="sw-no">0418 2207 5531</div><div class="sw-bot"><span>MEMBER SINCE 2019</span><span class="sw-tier">GOLD</span></div><i class="sw-shine"></i></div><i class="sw-shadow"></i></div>`;
      const card = q(s, ".sw-card"), sh = q(s, ".sw-shine"), shadow = q(s, ".sw-shadow");
      return (t) => {
        const ry = -11 * Math.cos((TAU * t) / 3), rx = 4 * Math.sin((TAU * t) / 3);
        card.style.transform = `translate(-50%, -50%) rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg)`;
        sh.style.transform = `translateX(${(-130 + inOut(lin(0.45, 1.35, t)) * 300).toFixed(2)}%) skewX(-20deg)`;
        shadow.style.transform = `translate(calc(-50% + ${(-ry * 0.25).toFixed(3)}cqw), 0) scaleX(${(1 - Math.abs(ry) / 120).toFixed(4)})`;
      };
    } });

  demo({ id: "glass", name: "Frosted glass card", kind: "ui", stacks: ["css"], chips: ["CSS backdrop-filter"], grade: "A",
    purpose: "A frosted card blurs the busy, moving background behind it, so the text on it stays clear.", period: 6, hero: 1.4,
    build(s) {
      s.style.background = "#1a1433";
      const H = [["15:00", "18°"], ["16:00", "17°"], ["17:00", "17°"], ["18:00", "16°"], ["19:00", "15°"]];
      s.innerHTML = `<div class="gs-bg"><div class="gs-mq"><span>RAIN · 18° · RAIN · 18° · </span><span>RAIN · 18° · RAIN · 18° · </span></div>
        <i class="gs-b gs-b1"></i><i class="gs-b gs-b2"></i><i class="gs-b gs-b3"></i><i class="gs-b gs-b4"></i></div>
        <div class="gs-card"><div class="gs-t"><span><small>Harbour district</small>Light rain</span><b>18°</b></div><div class="gs-s">Feels like 16° · wind 12 km/h · umbrella advised</div>
        <div class="gs-hours">${H.map((h) => `<span><i>${h[0]}</i>${h[1]}</span>`).join("")}</div></div>`;
      const bs = qa(s, ".gs-b"), mq = q(s, ".gs-mq");
      return (t) => {
        const a = (t / 6) * TAU;
        bs[0].style.transform = `translate(${(Math.cos(a) * 14).toFixed(2)}cqw, ${(Math.sin(a) * 9).toFixed(2)}cqw)`;
        bs[1].style.transform = `translate(${(Math.cos(a * 2 + 2) * 12).toFixed(2)}cqw, ${(Math.sin(a + 1) * 10).toFixed(2)}cqw) rotate(${(t * 30).toFixed(1)}deg)`;
        bs[2].style.transform = `translate(${(Math.sin(a + 3) * 16).toFixed(2)}cqw, ${(Math.cos(a * 2) * 7).toFixed(2)}cqw)`;
        bs[3].style.transform = `translate(${(Math.cos(a + 4) * 10).toFixed(2)}cqw, ${(Math.sin(a * 2 + 1) * 8).toFixed(2)}cqw)`;
        mq.style.transform = `translateX(${(-50 * (t / 6)).toFixed(3)}%)`;
      };
    } });

  demo({ id: "orbs", name: "Glow orbs", kind: "backdrop", stacks: ["css"], chips: ["CSS radial-gradient", "mix-blend-mode: screen"], grade: "A",
    purpose: "Soft glowing orbs drift and blend into each other behind a title.", period: 8, hero: 2,
    build(s) {
      s.style.background = "#07060b";
      s.innerHTML = [0, 1, 2, 3, 4].map((i) => `<i class="orb o${i}"></i>`).join("") + `<div class="ob-t"><b>Deep focus</b><span>Ambient mix · 45 min</span></div>`;
      const os = qa(s, ".orb");
      return (t) => { const a = (t / 8) * TAU; os.forEach((o, i) => { o.style.transform = `translate(${(Math.cos(a * (i % 2 ? 1 : -1) + i * 1.3) * 26).toFixed(2)}cqw, ${(Math.sin(a * (i % 3 ? 1 : 2) + i) * 12).toFixed(2)}cqw) scale(${(0.85 + 0.3 * Math.sin(a + i)).toFixed(4)})`; }); };
    } });

  demo({ id: "wipe", name: "0.5 s wipe", kind: "motion", stacks: ["css"], chips: ["CSS clip-path", "engine.js"], grade: "A",
    purpose: "Scenes change with a half-second clip-path wipe; a bright edge leads the cut.", period: 4, hero: 1.62,
    build(s) {
      s.innerHTML = `<div class="wp-sc wp-a"><span class="wp-k">OLD ROUTE · TWO BUSES</span><b>42 min</b><span class="wp-s">Riverside → Old Town</span></div>
        <div class="wp-sc wp-b"><span class="wp-k">NEW ROUTE · ONE TRAM</span><b>28 min</b><span class="wp-s">Riverside → Old Town</span></div><i class="wp-edge"></i>`;
      const B = q(s, ".wp-b"), edge = q(s, ".wp-edge");
      return (t) => {
        const k1 = inOut(lin(1.4, 1.9, t)), k2 = inOut(lin(3.4, 3.9, t));
        B.style.clipPath = t < 3.4 ? `inset(0 ${(100 - k1 * 100).toFixed(3)}% 0 0)` : `inset(0 0 0 ${(k2 * 100).toFixed(3)}%)`;
        const x = t < 3.4 ? k1 * 100 : k2 * 100, moving = (t > 1.4 && t < 1.9) || (t > 3.4 && t < 3.9);
        edge.style.left = `${x.toFixed(3)}%`; edge.style.opacity = moving ? 1 : 0;
      };
    } });

  demo({ id: "grain", name: "Film grain", kind: "backdrop", stacks: ["canvas"], chips: ["Canvas 2D", "per-pixel grain at display size", "new grain every 2 frames"], grade: "A",
    purpose: "Fine grain changes over the image to give an animated film texture; it is generated at the display size, so it stays visible in a small preview. Keep it subtle behind text; dense noise increases video bitrate.", period: 4, hero: 1.6,
    build(s) {
      s.style.background = "#000";
      const c = document.createElement("canvas"); c.className = "fill"; s.appendChild(c);
      const g = c.getContext("2d", { willReadFrequently: true });
      let W = 0, H = 0, base = null, img = null, last = null, key = "";
      const scene = () => {
        const sky = g.createLinearGradient(0, 0, 0, H * 0.62); sky.addColorStop(0, "#0d1b29"); sky.addColorStop(0.55, "#2b4656"); sky.addColorStop(1, "#d48a52");
        g.fillStyle = sky; g.fillRect(0, 0, W, H * 0.62);
        g.fillStyle = "#1b2a33"; g.beginPath(); g.moveTo(0, H * 0.62);
        for (let i = 0; i <= 24; i++) { const x = (i / 24) * W; g.lineTo(x, H * (0.58 - 0.035 * Math.sin(i * 0.9) - 0.02 * Math.sin(i * 2.3))); }
        g.lineTo(W, H * 0.62); g.closePath(); g.fill();
        const sea = g.createLinearGradient(0, H * 0.62, 0, H); sea.addColorStop(0, "#3b4a4f"); sea.addColorStop(1, "#090f13");
        g.fillStyle = sea; g.fillRect(0, H * 0.62, W, H * 0.38);
        g.fillStyle = "rgba(255,196,128,.55)";
        for (let i = 0; i < 26; i++) { const y = H * (0.64 + i * 0.013), w = W * (0.02 + 0.05 * hash(i * 3.3)); g.fillRect(W * 0.7 - w / 2 + W * 0.02 * (hash(i) - 0.5), y, w, Math.max(1, H * 0.004)); }
        g.fillStyle = "#06090b"; g.beginPath(); g.moveTo(0, H * 0.8); g.lineTo(W * 0.74, H * 0.7); g.lineTo(W * 0.74, H * 0.72); g.lineTo(0, H * 0.9); g.closePath(); g.fill();
        for (let i = 0; i < 9; i++) { const x = W * (0.04 + i * 0.085), top = H * (0.79 - i * 0.011); g.fillRect(x, top, W * 0.008 * (1 - i * 0.06), H - top); }
        g.fillRect(W * 0.695, H * 0.38, W * 0.006, H * 0.34);
        const lamp = g.createRadialGradient(W * 0.698, H * 0.38, 0, W * 0.698, H * 0.38, W * 0.12); lamp.addColorStop(0, "rgba(255,226,170,1)"); lamp.addColorStop(0.12, "rgba(255,200,130,.7)"); lamp.addColorStop(1, "rgba(255,170,90,0)");
        g.fillStyle = lamp; g.beginPath(); g.arc(W * 0.698, H * 0.38, W * 0.12, 0, TAU); g.fill();
        g.fillStyle = "#f6eee2"; g.textAlign = "center"; g.textBaseline = "alphabetic";
        g.font = `italic 400 ${Math.round(W * 0.09)}px "Instrument Serif", Georgia, serif`; g.fillText("Last ferry, 23:40", W / 2, H * 0.36);
        g.font = `700 ${Math.round(W * 0.017)}px "JetBrains Mono", Menlo, monospace`; g.fillStyle = "rgba(246,238,226,.75)"; g.fillText("PIER 4 · CROSSING TIME 25 MIN", W / 2, H * 0.46);
        base = g.getImageData(0, 0, W, H); img = g.createImageData(W, H);
      };
      const frame = (t) => {
        last = t;
        const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(160, Math.round((s.clientWidth || 640) * dpr)), h = Math.round((w * 9) / 16);
        if (w !== W || h !== H || !base) { W = c.width = w; H = c.height = h; scene(); key = ""; }
        const step = Math.floor(t * 12), reveal = W * (-0.1 + 1.25 * inOut(lin(0.2, 0.9, t))), k2 = `${step}:${Math.round(reveal)}:${W}`;
        if (k2 === key) return; key = k2;
        const cell = Math.max(1, Math.round(W / 700)), cw = Math.ceil(W / cell), src = base.data, out = img.data;
        let seed = (step * 9301 + 49297) | 0;
        const row = new Float32Array(cw);
        for (let cy = 0; cy * cell < H; cy++) {
          for (let i = 0; i < cw; i++) { seed = (Math.imul(seed, 1103515245) + 12345) | 0; const a = (seed >>> 16) & 0xffff; seed = (Math.imul(seed, 1103515245) + 12345) | 0; const b = (seed >>> 16) & 0xffff; row[i] = (a + b) / 65535 - 1; }
          for (let y = cy * cell; y < Math.min(H, (cy + 1) * cell); y++) for (let x = 0; x < W; x++) {
            const p = (y * W + x) * 4, edge = clamp((reveal - x) / (W * 0.04)), r = src[p], gg = src[p + 1], bb = src[p + 2];
            const L = (r * 0.3 + gg * 0.59 + bb * 0.11) / 255, n = row[(x / cell) | 0] * 40 * edge * (0.5 + 2 * L * (1 - L));
            out[p] = r + n; out[p + 1] = gg + n; out[p + 2] = bb + n; out[p + 3] = 255;
          }
        }
        g.putImageData(img, 0, 0);
        g.font = `700 ${Math.max(9, Math.round(W * 0.016))}px "JetBrains Mono", Menlo, monospace`; g.textAlign = "left"; g.fillStyle = "rgba(255,255,255,.8)";
        g.fillText(reveal >= W ? "GRAIN 35% · 12 FPS" : "GRAIN ON →", W * 0.035, H * 0.08);
      };
      const ready = Promise.all([`italic 400 64px "Instrument Serif"`, `700 16px "JetBrains Mono"`].map((f) => document.fonts.load(f))).then(() => { base = null; if (last !== null) frame(last); });
      return { ready, frame };
    } });

  // ================= 3D and shader effects (one shared WebGL renderer) =================
  // A film may request native-size effects; gallery tiles retain their original dimensions.
  const GW = window.FX_RENDER_SIZE?.w || 480, GH = window.FX_RENDER_SIZE?.h || 600;
  let R3 = null;
  try {
    if (window.THREE && THREE.EffectComposer && THREE.UnrealBloomPass) {
      R3 = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      R3.setPixelRatio(1); R3.setSize(GW, GH, false);
      R3.shadowMap.enabled = true; R3.shadowMap.type = THREE.PCFSoftShadowMap;
    }
  } catch (e) { R3 = null; }

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
  function studioLights(scene, spotPos) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.28));
    const key = new THREE.SpotLight(0xffffff, 2.2, 60, 0.55, 0.5, 1.2);
    key.position.set(...spotPos); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005;
    scene.add(key); scene.add(key.target);
    const rim = new THREE.DirectionalLight(0xff90e8, 1.1); rim.position.set(4, 3, -8); scene.add(rim);
    return key;
  }
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };


  demo({ id: "particles", gl: true, name: "Particles into type", kind: "shader", stacks: ["three", "canvas"], chips: ["Three.js Points", "Canvas-sampled text", "UnrealBloomPass"], grade: "A+",
    purpose: "Scattered points assemble into words. Text in any script is drawn on a canvas and sampled, so it works where 3D fonts have no glyphs.", period: 5.5, hero: 3,
    build(s) {
      const blit = glTile(s), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, GW / GH, 0.1, 100), R = rng(515);
      cam.position.set(0, 0, 8);
      const comp = composer(scene, cam, 0.9, 0.5, 0.2);
      let ps = null;
      const ready = document.fonts.load(`900 120px ${LAT}`, "YOUR WORDS").then(() => {
        const cw = 600, ch = 440, c = document.createElement("canvas"); c.width = cw; c.height = ch; const g = c.getContext("2d");
        g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `900 120px ${LAT}`;
        g.fillText("YOUR", cw / 2, ch / 2 - 80); g.fillText("WORDS", cw / 2, ch / 2 + 80);
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

  // Toon, halftone and dithered characters: the Character shading family in fx/pack-shading.js.

  // ================= 2D effects, continued (16:9, centred) =================
  demo({ id: "hook", name: "3-second headline hook", kind: "type", stacks: ["css"], chips: ["CSS mask reveal", "transform"], grade: "A",
    purpose: "A headline revealed by a mask within the first second, with no logo before it.", period: 4, hero: 2.3,
    build(s) {
      s.style.background = "#ffd400";
      const L = ["We tested", "12 rain jackets.", "Only <em>3</em> kept us dry."];
      s.innerHTML = `<div class="hk-box">${L.map((l) => `<div class="hk-m"><span>${l}</span></div>`).join("")}<div class="hk-s">GEAR LAB · EPISODE 14 · 45 S</div></div>`;
      const sp = qa(s, ".hk-m span"), sub = q(s, ".hk-s"), em = q(s, ".hk-m em");
      return (t) => {
        sp.forEach((e, i) => {
          const kin = outCubic(lin(0.05 + i * 0.18, 0.45 + i * 0.18, t)), kout = inCubic(lin(3.55 + i * 0.06, 3.85 + i * 0.06, t));
          e.style.transform = `translateY(${((1 - kin) * 110 - kout * 110).toFixed(2)}%)`;
        });
        em.style.transform = `scale(${(1 + 0.18 * Math.sin(Math.PI * lin(0.75, 1.0, t))).toFixed(4)})`;
        sub.style.opacity = lin(1.0, 1.3, t) * (1 - lin(3.5, 3.7, t));
      };
    } });

  demo({ id: "karaoke", name: "Word-synced captions", kind: "type", stacks: ["css", "svg"], chips: ["CSS", "hand-made timing"], grade: "A",
    purpose: "Readable with the sound off: each word lights up as it is spoken. The timing comes from the script, set by hand rather than by speech recognition.", period: 4.6, hero: 2.3,
    build(s) {
      s.style.background = "#141a26";
      const W = [["Rain", 0.2], ["moved", 0.42], ["in", 0.68], ["just", 0.82], ["after", 1.02], ["six,", 1.3], ["and", 1.78], ["the", 1.95], ["whole", 2.1], ["street", 2.4], ["went", 2.72], ["quiet.", 2.95]], END = 3.6, HOLD = 4.25;
      const id = uid("kar"), DROPS = Array.from({ length: 70 }, (_, i) => ({ x: hash(i * 1.9) * 1700 - 50, y: hash(i * 4.7) * 1000, l: 30 + hash(i * 7.3) * 40, v: 1000 * (2 + Math.floor(hash(i * 2.2) * 2)) / 4.6 }));
      const win = (x0, y0, cols, rows, w, h, gx, gy) => { let o = ""; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const k = hash(x0 * 0.13 + c * 7.1 + r * 3.7); if (k > 0.35) o += `<rect x="${x0 + c * gx}" y="${y0 + r * gy}" width="${w}" height="${h}" fill="${k > 0.8 ? "#ffd38a" : k > 0.6 ? "#f2b36b" : "#6c7aa0"}" opacity="${k > 0.6 ? 0.9 : 0.5}"/>`; } return o; };
      s.innerHTML = `<svg class="svgfill" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
          <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2440"/><stop offset=".5" stop-color="#45496b"/><stop offset=".72" stop-color="#b9786a"/></linearGradient>
          <linearGradient id="${id}-road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f44"/><stop offset="1" stop-color="#0d1019"/></linearGradient>
          <filter id="${id}-blur"><feGaussianBlur stdDeviation="10 26"/></filter></defs>
        <rect width="1600" height="900" fill="url(#${id}-sky)"/>
        <g fill="#141a2b"><rect x="40" y="330" width="250" height="330"/><rect x="300" y="250" width="190" height="410"/><rect x="1120" y="280" width="220" height="380"/><rect x="1350" y="360" width="250" height="300"/><rect x="560" y="430" width="160" height="230"/><rect x="880" y="410" width="200" height="250"/></g>
        ${win(60, 360, 6, 7, 22, 26, 38, 42)}${win(320, 280, 4, 9, 26, 28, 42, 42)}${win(1140, 310, 5, 8, 24, 26, 40, 42)}${win(1370, 390, 6, 6, 22, 24, 38, 42)}${win(580, 455, 3, 4, 26, 26, 46, 44)}${win(900, 440, 4, 5, 24, 26, 44, 42)}
        <rect y="660" width="1600" height="240" fill="url(#${id}-road)"/>
        <g filter="url(#${id}-blur)" opacity=".55"><rect x="90" y="680" width="40" height="160" fill="#f2b36b"/><rect x="380" y="680" width="50" height="190" fill="#ffd38a"/><rect x="1190" y="680" width="50" height="170" fill="#ffd38a"/><rect x="1440" y="680" width="40" height="150" fill="#f2b36b"/><rect x="760" y="680" width="70" height="200" fill="#ff6b5a"/></g>
        <circle cx="795" cy="640" r="11" fill="#ff6b5a"/><rect x="789" y="560" width="12" height="80" fill="#0d1019"/>
        <g class="kr-rain" stroke="#c9d6ff" stroke-opacity=".32" stroke-width="2.4" stroke-linecap="round">${DROPS.map(() => "<line/>").join("")}</g></svg>
        <div class="kr-band"></div><div class="kr-cap">${W.map((w) => `<span>${w[0]}</span>`).join("")}</div>
        <div class="kr-tl">${W.map((w) => `<i style="left:${((w[1] / END) * 100).toFixed(2)}%"></i>`).join("")}<b class="kr-ph"></b></div><div class="kr-tag">HAND-TIMED · ${W.length} WORDS</div>`;
      const sp = qa(s, ".kr-cap span"), ticks = qa(s, ".kr-tl i"), ph = q(s, ".kr-ph"), rain = qa(s, ".kr-rain line");
      return (t) => {
        W.forEach((w, i) => {
          const en = i + 1 < W.length ? W[i + 1][1] : END, on = t >= w[1] && t < en, past = t >= en && t < HOLD;
          sp[i].className = on ? "on" : past ? "past" : ""; ticks[i].className = on ? "on" : t >= w[1] && t < HOLD ? "done" : "";
        });
        ph.style.left = `${(clamp(t / END) * 100).toFixed(2)}%`; ph.style.opacity = t < HOLD ? 1 : 0;
        rain.forEach((l, i) => {
          const d = DROPS[i], y = ((d.y + t * d.v) % 1000) - 60, x = d.x - (y + 60) * 0.18;
          l.setAttribute("x1", x.toFixed(1)); l.setAttribute("y1", y.toFixed(1)); l.setAttribute("x2", (x - d.l * 0.18).toFixed(1)); l.setAttribute("y2", (y + d.l).toFixed(1));
        });
      };
    } });

  demo({ id: "sticker", name: "Sticker labels", kind: "type", stacks: ["css"], chips: ["CSS transform", "box-shadow"], grade: "A",
    purpose: "Rounded labels slap on with a white border and a drop shadow that shrinks as they land, like stickers on a laptop lid.", period: 3.4, hero: 2.3,
    build(s) {
      s.style.background = "radial-gradient(120% 100% at 50% 30%, #efe4d2, #cdbb9f)";
      const ST = [["SHIP IT", -8], ["night<br>owl", 6], ["TYPE SAFE", 4], ["coffee first", -5], ["v2.0", 10]];
      s.innerHTML = `<div class="st-lid"><i class="st-sheen"></i>${ST.map((x, i) => `<div class="st-k st-${i + 1}">${x[0]}</div>`).join("")}</div>`;
      const st = qa(s, ".st-k");
      return (t) => st.forEach((e, i) => {
        const a = 0.25 + i * 0.3, k = lin(a, a + 0.2, t), land = Math.sin(Math.PI * lin(a + 0.2, a + 0.34, t)), out = lin(3.0 + i * 0.03, 3.25 + i * 0.03, t), lift = 1 - outCubic(k);
        e.style.opacity = (k > 0 ? Math.min(1, k * 5) : 0) * (1 - out);
        e.style.transform = `rotate(${(ST[i][1] + lift * 14).toFixed(2)}deg) scale(${(1 + 0.5 * lift - 0.05 * land - 0.06 * out).toFixed(4)})`;
        e.style.boxShadow = `0 ${(0.35 + lift * 2.2).toFixed(2)}cqw ${(0.5 + lift * 3).toFixed(2)}cqw rgba(0,0,0,${(0.3 + 0.15 * lift).toFixed(3)})`;
      });
    } });

  demo({ id: "beat", name: "Beat sync", kind: "motion", stacks: ["css"], chips: ["music.py beat grid", "engine.js"], grade: "A",
    purpose: "Pops land on the beat. The music is synthesised here, so every beat time is already known; no audio analysis.", period: 2.4, hero: 1.85,
    build(s) {
      s.style.background = "radial-gradient(110% 90% at 50% 35%, #261d36, #110d18)";
      const PADS = [["KICK", "#ff5a1f", [0, 6, 8]], ["SNARE", "#ffd400", [4, 12]], ["HAT", "#41d6c3", [0, 2, 4, 6, 8, 10, 12, 14]], ["CLAP", "#b892ff", [12, 15]]], STEP = 0.15;
      s.innerHTML = `<div class="bt-box"><div class="bt-pads">${PADS.map((p) => `<div class="bt-pad" style="--c:${p[1]}"><b>${p[0]}</b><i></i></div>`).join("")}</div>
        <div class="bt-steps">${Array.from({ length: 16 }, (_, i) => `<i class="${i % 4 ? "" : "bt-q"}"></i>`).join("")}</div>
        <div class="bt-foot"><span class="bt-count">${[1, 2, 3, 4].map((n) => `<b>${n}</b>`).join("")}</span><span>♩ = 100 BPM · 0.6 s a beat</span></div></div>`;
      const pads = qa(s, ".bt-pad"), steps = qa(s, ".bt-steps i"), counts = qa(s, ".bt-count b");
      return (t) => {
        const st = Math.floor(t / STEP), beat = Math.floor(t / 0.6), ph = t - beat * 0.6;
        pads.forEach((p, i) => {
          const hits = PADS[i][2].filter((h) => h * STEP <= t), u = hits.length ? t - hits[hits.length - 1] * STEP : 9, e = decay(u, 9);
          p.style.transform = `scale(${(1 + 0.1 * e).toFixed(4)})`; p.style.setProperty("--e", e.toFixed(3));
        });
        steps.forEach((c, i) => c.classList.toggle("on", i === st));
        counts.forEach((c, i) => { const on = i === beat; c.classList.toggle("on", on); c.style.transform = `scale(${on ? (1 + 0.35 * decay(ph, 8)).toFixed(4) : 1})`; });
      };
    } });

  demo({ id: "gradient", name: "Low-contrast flowing gradient", kind: "backdrop", stacks: ["css"], chips: ["CSS radial-gradient"], grade: "A",
    purpose: "Movement that never fights the text; long copy stays readable on top.", period: 12, hero: 3,
    build(s) {
      s.style.background = "#f3e9f1";
      s.innerHTML = `<i class="gl-l" style="background:radial-gradient(40% 45% at 30% 30%, #ffc9ee, transparent 70%)"></i><i class="gl-l" style="background:radial-gradient(38% 42% at 70% 60%, #d9ccff, transparent 70%)"></i><i class="gl-l" style="background:radial-gradient(35% 40% at 40% 80%, #ffe6b8, transparent 70%)"></i>
        <div class="gl-t"><b>Slow down.<br>Breathe in.</b><span>A ten-minute evening stretch, guided step by step.</span></div>`;
      const ls = qa(s, ".gl-l");
      return (t) => { const a = (t / 12) * TAU; ls.forEach((l, i) => { l.style.transform = `translate(${(Math.cos(a + i * 2.1) * 12).toFixed(3)}%, ${(Math.sin(a * (i % 2 ? 1 : -1) + i) * 10).toFixed(3)}%)`; }); };
    } });

  // One street scene, drawn twice: a cool overcast grade on the left and a golden-hour grade on the right.
  function streetScene(id) {
    const VX = 820, VY = 520, lerp = (a, b, k) => a + (b - a) * k;
    const facade = (x0, x1, top0, bot0, fill, win) => {
      const top = (x) => lerp(top0, VY - 120, (x - x0) / (x1 - x0)), bot = (x) => lerp(bot0, VY + 80, (x - x0) / (x1 - x0));
      let o = `<polygon points="${x0},${top0} ${x1},${top(x1)} ${x1},${bot(x1)} ${x0},${bot0}" fill="${fill}"/>`;
      for (let c = 0; c < 6; c++) for (let r = 0; r < 4; r++) {
        const xa = lerp(x0, x1, 0.06 + c * 0.155), xb = lerp(x0, x1, 0.06 + c * 0.155 + 0.08);
        const ya = (x) => lerp(top(x), bot(x), 0.12 + r * 0.19), yb = (x) => lerp(top(x), bot(x), 0.12 + r * 0.19 + 0.11);
        o += `<polygon points="${xa},${ya(xa)} ${xb},${ya(xb)} ${xb},${yb(xb)} ${xa},${yb(xa)}" fill="${win}"/>`;
      }
      return o;
    };
    return `<svg class="svgfill" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
        <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9db3c7"/><stop offset=".55" stop-color="#d9d3c8"/><stop offset=".6" stop-color="#ebdcc4"/></linearGradient>
        <radialGradient id="${id}-sun"><stop offset="0" stop-color="#fff6e2"/><stop offset=".25" stop-color="#fff0d2" stop-opacity=".9"/><stop offset="1" stop-color="#fff0d2" stop-opacity="0"/></radialGradient></defs>
      <rect width="1600" height="900" fill="url(#${id}-sky)"/>
      <circle cx="1010" cy="430" r="230" fill="url(#${id}-sun)"/>
      <g fill="#8e8a88"><rect x="560" y="330" width="80" height="200"/><rect x="650" y="290" width="70" height="240"/><rect x="730" y="360" width="60" height="170"/><rect x="900" y="340" width="70" height="190"/><rect x="980" y="300" width="60" height="230"/></g>
      ${facade(0, 600, 60, 900, "#b39c86", "#5d5650")}${facade(1600, 1050, 120, 900, "#9b8f86", "#4f4a47")}
      <polygon points="260,900 790,600 850,600 1340,900" fill="#6d6966"/>
      <polygon points="0,900 600,600 790,600 260,900" fill="#a59d93"/><polygon points="1340,900 850,600 1050,600 1600,900" fill="#958d85"/>
      <g fill="#e8e1d4">${[0, 1, 2, 3, 4].map((i) => { const k0 = 0.08 + i * 0.2, k1 = k0 + 0.1; const y0 = lerp(600, 900, k0 * k0), y1 = lerp(600, 900, k1 * k1), w0 = lerp(2, 18, k0 * k0), w1 = lerp(2, 18, k1 * k1); return `<polygon points="${820 - w0},${y0} ${820 + w0},${y0} ${820 + w1},${y1} ${820 - w1},${y1}"/>`; }).join("")}</g>
      <rect x="1180" y="420" width="16" height="320" fill="#4a4440"/><circle cx="1188" cy="380" r="120" fill="#6f7a57"/><circle cx="1110" cy="420" r="80" fill="#7c8763"/><circle cx="1260" cy="430" r="90" fill="#66704f"/>
      <rect x="430" y="380" width="10" height="330" fill="#3c3835"/><rect x="400" y="370" width="60" height="16" rx="6" fill="#3c3835"/>
      <g fill="#2d2a28"><circle cx="690" cy="690" r="34" fill="none" stroke="#2d2a28" stroke-width="7"/><circle cx="790" cy="690" r="34" fill="none" stroke="#2d2a28" stroke-width="7"/><path d="M690 690 L730 640 L790 690 M730 640 L770 640" fill="none" stroke="#2d2a28" stroke-width="7"/><circle cx="742" cy="590" r="14"/><path d="M738 604 L728 650 L760 650" fill="none" stroke="#2d2a28" stroke-width="11" stroke-linecap="round"/></g>
    </svg>`;
  }
  demo({ id: "lut", name: "Cool vs warm colour grade", kind: "backdrop", stacks: ["css", "svg"], chips: ["CSS colour filters", "soft-light tint", "background glow"], grade: "A",
    purpose: "The same street graded two ways: a cool, flat overcast look against a warm golden-hour look with a soft glow; the divider sweeps between them.", period: 6, hero: 3.2,
    build(s) {
      s.style.background = "#000";
      s.innerHTML = `<div class="wrap lut-l"><div class="wrap lut-cold">${streetScene(uid("lutc"))}</div><i class="wrap lut-ct"></i></div>
        <div class="wrap lut-r"><div class="wrap lut-warm">${streetScene(uid("lutw"))}</div><i class="wrap lut-wt"></i><i class="lut-glow"></i></div>
        <div class="lut-div"><b>◂ ▸</b></div><span class="lut-lab lut-lab-l">COOL · OVERCAST</span><span class="lut-lab lut-lab-r">WARM · GOLDEN HOUR</span>`;
      const r = q(s, ".lut-r"), dv = q(s, ".lut-div");
      return (t) => { const x = 50 + 26 * Math.sin((t / 6) * TAU); r.style.clipPath = `inset(0 0 0 ${x.toFixed(3)}%)`; dv.style.left = `${x.toFixed(3)}%`; };
    } });

  demo({ id: "uifly", name: "Camera move over real UI", kind: "ui", stacks: ["css"], chips: ["CSS 3D transform", "perspective"], grade: "A",
    purpose: "The camera glides over a real interface card in 3D perspective, then pushes in on the line that matters.", period: 6, hero: 2.3,
    build(s) {
      s.style.background = "radial-gradient(90% 80% at 50% 40%, #27303a, #0b0e12)";
      s.style.perspective = "110cqw";
      s.innerHTML = `<div class="uf-card"><div class="uf-h"><b></b><span>Order #4821</span><em>On its way</em></div>
        <div class="uf-eta"><small>Arriving</small><b>14:20 – 14:40</b></div>
        <div class="uf-track"><i class="on"></i><i class="on"></i><i class="on cur"></i><i></i></div>
        <div class="uf-steps"><span>Placed</span><span>Packed</span><span>On the way</span><span>Delivered</span></div>
        <div class="uf-kb"><span>Track live</span><span>Message rider</span><span>Leave at door</span><span>Change time</span></div></div>`;
      const c = q(s, ".uf-card");
      return (t) => {
        const k = inOut(lin(0.2, 2.0, t)), z = inOut(lin(3.0, 4.2, t)) * (1 - inOut(lin(5.0, 5.8, t)));
        c.style.transform = `translate(-50%, -50%) translateY(${(9 * z).toFixed(3)}cqw) translateZ(${(-60 * (1 - k)).toFixed(3)}cqw) rotateX(${(52 * (1 - k)).toFixed(3)}deg) rotateY(${(-34 * (1 - k)).toFixed(3)}deg) scale(${(1 + 0.5 * z).toFixed(4)})`;
        c.style.opacity = Math.min(1, t * 5) * (1 - lin(5.7, 5.95, t));
      };
    } });

  demo({ id: "ring", name: "24-hour countdown ring", kind: "ui", stacks: ["svg"], chips: ["SVG stroke-dasharray", "tabular-nums"], grade: "A",
    purpose: "A deadline at a glance: the ring empties as time runs out and turns red in the final hours.", period: 5, hero: 2.6,
    build(s) {
      s.style.background = "radial-gradient(100% 90% at 40% 45%, #1d1a2a, #0d0c14)";
      const F = "Archivo, 'Helvetica Neue', Arial, sans-serif", M = "'JetBrains Mono', Menlo, monospace";
      s.innerHTML = `<svg class="svgfill" viewBox="0 0 1600 900" aria-hidden="true">
        <circle cx="520" cy="450" r="300" fill="none" stroke="#2a2733" stroke-width="46"/>
        <g transform="rotate(-90 520 450)"><circle class="rg-arc" cx="520" cy="450" r="300" fill="none" stroke="#ff90e8" stroke-width="46" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1"/></g>
        <circle class="rg-dot" r="16" fill="#fff"/>
        <text class="rg-hms" x="520" y="488" text-anchor="middle" fill="#fff" font-size="128" font-weight="700" font-family="${M}">23:54</text>
        <text x="520" y="556" text-anchor="middle" fill="#9a96a6" font-size="34" font-weight="600" font-family="${F}">hours : minutes left</text>
        <text class="rg-k" x="930" y="318" fill="#ff90e8" font-size="30" font-weight="700" letter-spacing="4" font-family="${M}">PRE-SALE ENDS IN</text>
        <text x="926" y="420" fill="#fff" font-size="92" font-weight="900" font-family="${F}">Riverside</text>
        <text x="926" y="515" fill="#fff" font-size="92" font-weight="900" font-family="${F}">Folk Night</text>
        <text x="930" y="585" fill="#b9b4c6" font-size="34" font-weight="600" font-family="${F}">Pier 7 Hall · Saturday 18 October</text>
        <text class="rg-sold" x="930" y="650" fill="#b9b4c6" font-size="28" font-weight="700" font-family="${M}">EARLY-BIRD SEATS LEFT: 88</text></svg>`;
      const arc = q(s, ".rg-arc"), txt = q(s, ".rg-hms"), dot = q(s, ".rg-dot"), key = q(s, ".rg-k"), sold = q(s, ".rg-sold");
      return (t) => {
        const rem = 23.9 - 22.8 * outCubic(lin(0.2, 4.2, t)), frac = rem / 24, col = rem > 6 ? "#ff90e8" : rem > 2 ? "#ffd400" : "#ff3b4e";
        const pulse = rem <= 2 ? 0.5 + 0.5 * Math.cos(TAU * 2.5 * t) : 0;
        arc.setAttribute("stroke-dasharray", `${frac.toFixed(4)} 1`); arc.setAttribute("stroke", col); arc.setAttribute("stroke-width", (46 + 10 * pulse).toFixed(2));
        const a = -Math.PI / 2 + frac * TAU; dot.setAttribute("cx", (520 + 300 * Math.cos(a)).toFixed(1)); dot.setAttribute("cy", (450 + 300 * Math.sin(a)).toFixed(1));
        const h = Math.floor(rem), m = Math.floor((rem - h) * 60);
        txt.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`; txt.setAttribute("fill", rem <= 2 ? col : "#fff");
        key.setAttribute("fill", col); sold.textContent = `EARLY-BIRD SEATS LEFT: ${Math.max(3, Math.round(88 * frac + 2))}`;
      };
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
  window.FX = { DEMOS, demo, R3, GW, GH, ZH, LAT, NOISE, q, qa, glTile, composer, studioLights, rng,
    helpers: { clamp, lin, smooth, outCubic, inCubic, inOut, back, hash } };
})();
