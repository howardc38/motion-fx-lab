// Deterministic timeline: render(t) is a pure function of t, so an exported frame is exact.
// Page: #frame > #stage[data-w][data-h][data-dur] > section.scene[data-start] (data-trans="cut" for no wipe;
// a child .edge draws the wipe's edge). Elements in a scene declare:
//   data-fx     one of FX below; data-at (s after the scene starts), data-dur, data-out (fade out at),
//               data-on (adds class "on" from), data-base (a transform kept after the effect's own)
//   per effect  count: data-to · move: data-x0 data-y0 data-x1 data-y1 · chars: data-stagger ·
//               whip: data-dx · mark: data-mark-h · drift/blurin: data-amt · spin: data-speed ·
//               bgpan: data-vx data-vy · shake/pulse/float: data-amp, pulse/float: data-period ·
//               pathtext: data-from data-to data-ease="linear"
//   sound       data-sfx (a name from sfx.py), data-sfx-at, data-sfx-gain, data-sfx-repeat, data-sfx-every
// window.__renderHooks may hold functions called with t after each render.
(() => {
  const stage = document.getElementById("stage");
  const W = +stage.dataset.w, H = +stage.dataset.h, DUR = +stage.dataset.dur;
  const WIPE = 0.5;
  const DEFAULT_DUR = { up: 0.5, down: 0.5, fade: 0.4, pop: 0.42, left: 0.5, right: 0.5, zoom: 0.5, type: 1, count: 1.4, mark: 0.45, grow: 0.35, move: 0.6, ring: 0.5, chars: 0.34, slam: 0.38, whip: 0.45, blurin: 0.6, sweep: 0.9, orb: 1.2, flash: 0.35, scan: 0.8, shake: 0.5 };
  const FX = new Set(["up", "down", "left", "right", "fade", "zoom", "pop", "grow", "mark", "type", "count", "move", "ring",
    "chars", "slam", "drift", "spin", "bgpan", "shake", "pulse", "float", "flash", "blink", "pathtext", "whip", "sweep", "orb", "blurin", "scan"]);
  let filterId = 0;
  const scenes = [...stage.querySelectorAll(".scene")].map((el) => ({ el, start: +el.dataset.start, edge: el.querySelector(".edge") }));

  const items = [];
  const cues = [];
  scenes.forEach((s, i) => {
    if (i > 0) cues.push({ t: s.start, name: "whoosh", gain: 1 });
    s.el.querySelectorAll("[data-fx],[data-on],[data-out],[data-sfx]").forEach((el) => {
      const d = el.dataset;
      if (d.fx && !FX.has(d.fx)) throw new Error(`unknown data-fx="${d.fx}"; known: ${[...FX].join(", ")}`);
      const it = {
        el, s, fx: d.fx || null,
        at: +(d.at || 0),
        dur: +(d.dur || DEFAULT_DUR[d.fx] || 0.5),
        out: d.out != null ? +d.out : null,
        on: d.on != null ? +d.on : null,
        base: d.base || "",
        last: null,
      };
      if (it.fx === "type") it.text = Array.from(el.textContent.trim());
      if (it.fx === "count") it.to = +d.to;
      if (it.fx === "move") Object.assign(it, { x0: +d.x0, y0: +d.y0, x1: +d.x1, y1: +d.y1 });
      if (it.fx === "whip") {
        let defs = document.getElementById("__fxdefs");
        if (!defs) {
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.style.position = "absolute";
          defs = document.createElementNS("http://www.w3.org/2000/svg", "defs"); defs.id = "__fxdefs";
          svg.appendChild(defs); stage.appendChild(svg);
        }
        const id = `__mb${filterId++}`;
        const f = document.createElementNS("http://www.w3.org/2000/svg", "filter");
        f.id = id; f.setAttribute("x", "-60%"); f.setAttribute("width", "220%"); f.setAttribute("y", "-10%"); f.setAttribute("height", "120%");
        const g = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
        g.setAttribute("stdDeviation", "0 0"); f.appendChild(g); defs.appendChild(f);
        el.style.filter = `url(#${id})`;
        it.fe = g; it.dx = +(d.dx || 320);
      }
      if (it.fx === "chars") {
        // Kinetic type: every character becomes its own staggered item.
        const stagger = +(d.stagger || 0.045);
        const chars = Array.from(el.textContent);
        el.textContent = "";
        chars.forEach((c, i) => {
          const sp = document.createElement("span");
          sp.textContent = c;
          sp.style.display = "inline-block";
          if (c === " ") sp.style.whiteSpace = "pre";
          el.appendChild(sp);
          items.push({ el: sp, s, fx: "charpop", at: it.at + i * stagger, dur: it.dur, out: it.out, on: null, base: "", last: null });
        });
        it.fx = null;
      }
      if (it.fx || it.out != null || it.on != null) items.push(it);
      if (d.sfx) {
        const at = s.start + (d.sfxAt != null ? +d.sfxAt : it.at);
        const gain = +(d.sfxGain || 1);
        if (d.sfx === "type") {
          for (let k = 0; k < it.dur; k += 0.07) cues.push({ t: at + k, name: "type", gain });
        } else if (d.sfxRepeat) {
          for (let k = 0; k < +d.sfxRepeat; k++) cues.push({ t: at + k * +(d.sfxEvery || 0.5), name: d.sfx, gain });
        } else cues.push({ t: at, name: d.sfx, gain });
      }
    });
  });
  cues.sort((a, b) => a.t - b.t);

  const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const eo = (x) => 1 - Math.pow(1 - x, 3);
  const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const back = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

  function render(t) {
    const live = new Set();
    scenes.forEach((s, i) => {
      const next = scenes[i + 1];
      const vis = t >= s.start && (!next || t < next.start + (next.el.dataset.trans === "cut" ? 0 : WIPE));
      s.el.style.visibility = vis ? "visible" : "hidden";
      if (!vis) return;
      live.add(s);
      const w = i === 0 || s.el.dataset.trans === "cut" ? 0 : 1 - eio(clamp((t - s.start) / WIPE));
      s.el.style.clipPath = w > 0 ? `inset(0 0 0 ${w * 100}%)` : "none";
      if (s.edge) { s.edge.style.left = `${w * 100}%`; s.edge.style.opacity = w > 0 && w < 1 ? 1 : 0; }
    });

    for (const it of items) {
      if (!live.has(it.s)) continue;
      const local = t - it.s.start;
      const el = it.el;
      if (it.on != null) el.classList.toggle("on", local >= it.on);
      if (!it.fx && it.out == null) continue;

      const p = it.fx ? clamp((local - it.at) / it.dur) : 1;
      const e = eo(p);
      let op = 1, tf = "";
      switch (it.fx) {
        case "up": op = e; tf = `translateY(${(1 - e) * 48}px)`; break;
        case "down": op = e; tf = `translateY(${(1 - e) * -48}px)`; break;
        case "left": op = e; tf = `translateX(${(1 - e) * -70}px)`; break;
        case "right": op = e; tf = `translateX(${(1 - e) * 70}px)`; break;
        case "fade": op = e; break;
        case "zoom": op = e; tf = `scale(${1.12 - 0.12 * e})`; break;
        case "pop": op = clamp(p * 3); tf = `scale(${0.6 + 0.4 * (p >= 1 ? 1 : back(p))})`; break;
        case "grow": tf = `scaleX(${e})`; break;
        case "mark": el.style.backgroundSize = `${e * 100}% ${el.dataset.markH || 40}%`; break;
        case "type": {
          const n = Math.round(p * it.text.length);
          if (n !== it.last) { el.textContent = it.text.slice(0, n).join(""); it.last = n; }
          el.classList.toggle("caret", p > 0 && p < 1);
          break;
        }
        case "count": {
          const v = Math.round(e * it.to);
          if (v !== it.last) { el.textContent = v.toLocaleString("en-US"); it.last = v; }
          op = clamp(p * 4);
          break;
        }
        case "move": {
          const m = eio(p);
          el.style.left = `${it.x0 + (it.x1 - it.x0) * m}px`;
          el.style.top = `${it.y0 + (it.y1 - it.y0) * m}px`;
          op = clamp((local - it.at + 0.3) / 0.3);
          break;
        }
        case "ring": op = p <= 0 || p >= 1 ? 0 : 1 - p; tf = `scale(${0.4 + 1.3 * e})`; break;
        // --- continuous and emphasis motion (all pure functions of t) ---
        case "charpop": op = clamp(p * 2.5); tf = `translateY(${(1 - e) * 0.5}em) scale(${0.4 + 0.6 * (p >= 1 ? 1 : back(p))})`; break;
        case "slam": op = clamp(p * 4); tf = `scale(${1.9 - 0.9 * (p >= 1 ? 1 : back(p))})`; break;
        case "drift": tf = `scale(${1 + +(el.dataset.amt || 0.05) * p})`; break;
        case "spin": tf = `rotate(${+(el.dataset.speed || 12) * local}deg)`; break;
        case "bgpan": el.style.backgroundPosition = `${+(el.dataset.vx || 0) * local}px ${+(el.dataset.vy || 0) * local}px`; break;
        case "shake": {
          if (local >= it.at && local <= it.at + it.dur) {
            const a = +(el.dataset.amp || 14) * (1 - p);
            tf = `translate(${a * Math.sin(local * 95)}px, ${a * Math.cos(local * 73)}px)`;
          } else tf = "translate(0,0)";
          break;
        }
        case "pulse": {
          const x = Math.max(0, local - it.at);
          tf = `scale(${1 + +(el.dataset.amp || 0.04) * Math.sin((2 * Math.PI * x) / +(el.dataset.period || 1.1))})`;
          break;
        }
        case "float": tf = `translateY(${+(el.dataset.amp || 10) * Math.sin((2 * Math.PI * local) / +(el.dataset.period || 2.4))}px)`; break;
        case "flash": op = p <= 0 || p >= 1 ? 0 : p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8; break;
        case "blink": op = local < it.at ? 0 : Math.floor((local - it.at) * 2.5) % 2 === 0 ? 1 : 0.35; break;
        case "pathtext": el.setAttribute("startOffset", `${+(el.dataset.from || 100) + (+(el.dataset.to || -100) - +(el.dataset.from || 100)) * (el.dataset.ease === "linear" ? p : e)}%`); op = p <= 0 ? 0 : 1; break;
        case "whip": {
          const v = p <= 0 || p >= 1 ? 0 : 3 * (1 - p) * (1 - p);
          it.fe.setAttribute("stdDeviation", `${Math.min(46, (Math.abs(it.dx) * v) / 18).toFixed(1)} 0`);
          op = clamp(p * 3); tf = `translateX(${(1 - e) * it.dx}px)`;
          break;
        }
        case "sweep": op = p <= 0 || p >= 1 ? 0 : 1; tf = `translateX(${-160 + 420 * e}%) skewX(-18deg)`; break;
        case "orb": op = p <= 0 ? 0 : p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3; tf = `scale(${0.15 + 3.9 * e})`; break;
        case "blurin": el.style.filter = `blur(${((1 - e) * +(el.dataset.amt || 24)).toFixed(1)}px)`; op = e; tf = `scale(${1.06 - 0.06 * e})`; break;
        case "scan": {
          const on = p > 0 && p < 1;
          el.style.backgroundPosition = `0 ${on ? -60 + 190 * p : -400}%`;
          break;
        }
      }
      if (it.out != null) op *= 1 - eo(clamp((local - it.out) / 0.3));
      el.style.opacity = op;
      if (tf || it.base) el.style.transform = `${tf} ${it.base}`.trim();
    }
    if (window.__renderHooks) for (const h of window.__renderHooks) h(t);
  }

  // ---------- local preview (space pauses, click restarts) ----------
  const frame = document.getElementById("frame");
  let t0 = performance.now(), paused = false, pausedAt = 0, recording = false;
  function fit() {
    if (recording) return;
    const s = Math.min((innerWidth - 32) / W, (innerHeight - 32) / H);
    frame.style.width = `${W * s}px`; frame.style.height = `${H * s}px`;
    stage.style.transform = `scale(${s})`;
  }
  function loop(now) {
    if (recording) return;
    if (!paused) render(((now - t0) / 1000) % (DUR + 1));
    requestAnimationFrame(loop);
  }
  addEventListener("resize", fit);
  addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;
    e.preventDefault();
    if (paused) { t0 = performance.now() - pausedAt * 1000; paused = false; }
    else { pausedAt = ((performance.now() - t0) / 1000) % (DUR + 1); paused = true; }
  });
  frame.addEventListener("click", () => { t0 = performance.now(); paused = false; });
  fit();
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(loop));

  window.__render = render;
  window.__DUR = DUR;
  window.__SIZE = { w: W, h: H };
  window.__cues = () => cues;
  // Recording shows the stage at its own size: the preview's fit() may have shrunk the frame.
  window.__record = () => {
    recording = true; document.body.classList.add("record");
    frame.style.width = `${W}px`; frame.style.height = `${H}px`;
    render(0);
  };
})();
