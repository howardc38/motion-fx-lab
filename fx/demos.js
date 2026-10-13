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
  // Entries marked tier: "basic" are motion fundamentals for the gallery's Motion basics area; they are not
  // counted as effect families. Every 2D layout here is authored for a 16:9 stage and centred, and the copy
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

  demo({ id: "chars", tier: "basic", name: "Character pop", kind: "type", stacks: ["css"], chips: ["CSS transform", "engine.js chars"], grade: "A",
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

  demo({ id: "mark", tier: "basic", name: "Highlighter", kind: "type", stacks: ["css"], chips: ["CSS scaleX", "engine.js mark"], grade: "A",
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

  demo({ id: "count", tier: "basic", name: "Counting number", kind: "type", stacks: ["css"], chips: ["JS counter", "tabular-nums"], grade: "A",
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

  demo({ id: "type", tier: "basic", name: "Typewriter", kind: "type", stacks: ["css"], chips: ["JS per character", "CSS caret"], grade: "A",
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

  demo({ id: "stamp", tier: "basic", name: "Red flash + shake + stamp", kind: "type", stacks: ["svg", "css"], chips: ["SVG turbulence ink", "engine.js slam / shake / flash", "dust burst"], grade: "A",
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

  demo({ id: "scan", tier: "basic", name: "Scan and check", kind: "ui", stacks: ["css"], chips: ["CSS gradient", "engine.js scan"], grade: "A",
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

  demo({ id: "sweep", tier: "basic", name: "Light sweep", kind: "ui", stacks: ["css"], chips: ["CSS linear-gradient", "CSS 3D tilt"], grade: "A",
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

  demo({ id: "glass", tier: "basic", name: "Frosted glass card", kind: "ui", stacks: ["css"], chips: ["CSS backdrop-filter"], grade: "A",
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

  demo({ id: "orbs", tier: "basic", name: "Glow orbs", kind: "backdrop", stacks: ["css"], chips: ["CSS radial-gradient", "mix-blend-mode: screen"], grade: "A",
    purpose: "Soft glowing orbs drift and blend into each other behind a title.", period: 8, hero: 2,
    build(s) {
      s.style.background = "#07060b";
      s.innerHTML = [0, 1, 2, 3, 4].map((i) => `<i class="orb o${i}"></i>`).join("") + `<div class="ob-t"><b>Deep focus</b><span>Ambient mix · 45 min</span></div>`;
      const os = qa(s, ".orb");
      return (t) => { const a = (t / 8) * TAU; os.forEach((o, i) => { o.style.transform = `translate(${(Math.cos(a * (i % 2 ? 1 : -1) + i * 1.3) * 26).toFixed(2)}cqw, ${(Math.sin(a * (i % 3 ? 1 : 2) + i) * 12).toFixed(2)}cqw) scale(${(0.85 + 0.3 * Math.sin(a + i)).toFixed(4)})`; }); };
    } });

  demo({ id: "wipe", tier: "basic", name: "0.5 s wipe", kind: "motion", stacks: ["css"], chips: ["CSS clip-path", "engine.js"], grade: "A",
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

  demo({ id: "grain", tier: "basic", name: "Film grain", kind: "backdrop", stacks: ["canvas"], chips: ["Canvas 2D", "per-pixel grain at display size", "new grain every 2 frames"], grade: "A",
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

  // ================= Motion basics, continued (tier: "basic", 16:9, centred) =================
  demo({ id: "hook", tier: "basic", name: "3-second headline hook", kind: "type", stacks: ["css"], chips: ["CSS mask reveal", "transform"], grade: "A",
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

  demo({ id: "karaoke", tier: "basic", name: "Word-synced captions", kind: "type", stacks: ["css", "svg"], chips: ["CSS", "hand-made timing"], grade: "A",
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

  demo({ id: "sticker", tier: "basic", name: "Sticker labels", kind: "type", stacks: ["css"], chips: ["CSS transform", "box-shadow"], grade: "A",
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

  demo({ id: "beat", tier: "basic", name: "Beat sync", kind: "motion", stacks: ["css"], chips: ["music.py beat grid", "engine.js"], grade: "A",
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

  demo({ id: "gradient", tier: "basic", name: "Low-contrast flowing gradient", kind: "backdrop", stacks: ["css"], chips: ["CSS radial-gradient"], grade: "A",
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
  demo({ id: "lut", tier: "basic", name: "Cool vs warm colour grade", kind: "backdrop", stacks: ["css", "svg"], chips: ["CSS colour filters", "soft-light tint", "background glow"], grade: "A",
    purpose: "The same street graded two ways: a cool, flat overcast look against a warm golden-hour look with a soft glow; the divider sweeps between them.", period: 6, hero: 3.2,
    build(s) {
      s.style.background = "#000";
      s.innerHTML = `<div class="wrap lut-l"><div class="wrap lut-cold">${streetScene(uid("lutc"))}</div><i class="wrap lut-ct"></i></div>
        <div class="wrap lut-r"><div class="wrap lut-warm">${streetScene(uid("lutw"))}</div><i class="wrap lut-wt"></i><i class="lut-glow"></i></div>
        <div class="lut-div"><b>◂ ▸</b></div><span class="lut-lab lut-lab-l">COOL · OVERCAST</span><span class="lut-lab lut-lab-r">WARM · GOLDEN HOUR</span>`;
      const r = q(s, ".lut-r"), dv = q(s, ".lut-div");
      return (t) => { const x = 50 + 26 * Math.sin((t / 6) * TAU); r.style.clipPath = `inset(0 0 0 ${x.toFixed(3)}%)`; dv.style.left = `${x.toFixed(3)}%`; };
    } });

  demo({ id: "uifly", tier: "basic", name: "Camera move over real UI", kind: "ui", stacks: ["css"], chips: ["CSS 3D transform", "perspective"], grade: "A",
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

  demo({ id: "ring", tier: "basic", name: "24-hour countdown ring", kind: "ui", stacks: ["svg"], chips: ["SVG stroke-dasharray", "tabular-nums"], grade: "A",
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
    purpose: "A screen-space glass effect bends and splits a background image. This tile uses UV distortion, rather than a thick 3D transparent body.", period: 8, hero: 2,
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
