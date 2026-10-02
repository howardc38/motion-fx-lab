const $ = (s) => document.querySelector(s);
const stage = $("#stage"),
  loading = $("#loading"),
  play = $("#play"),
  reset = $("#reset"),
  action = $("#action"),
  slider = $("#parameter");
const catalog = {
  pixi: {
    module: "pixi",
    name: "PixiJS",
    title: "PixiJS · Liquid poster",
    art: "01 / LIQUID POSTER",
    description:
      "真正的 PixiJS DisplacementFilter → BlurFilter → ColorMatrixFilter。用「比較原圖」睇同一張海報經濾鏡前後嘅分別。",
    parameter: "扭曲程度",
    value: 60,
    action: "比較原圖",
  },
  rapier: {
    module: "rapier",
    name: "Rapier",
    title: "Rapier · Chain reaction",
    art: "02 / CHAIN REACTION",
    description:
      "Rapier WASM 計算 48 塊骨牌嘅重力、旋轉、摩擦及相互碰撞；Three.js 負責畫面。拖動畫面可轉動視角。",
    parameter: "播放速度",
    value: 50,
    action: "重新推倒",
  },
  gpu: {
    module: "gpu",
    name: "WebGPU / TSL",
    title: "WebGPU / TSL · Orbital matter",
    art: "03 / ORBITAL MATTER",
    description:
      "65,536 粒粒子嘅位置同速度保留喺 GPU storage buffer，由 TSL compute 更新。移動滑鼠改變吸引中心；按「散開」改變力場。",
    parameter: "旋轉強度",
    value: 60,
    action: "散開",
  },
};
const demos = new Map();
let current = null,
  selected = "pixi",
  playing = !matchMedia("(prefers-reduced-motion: reduce)").matches,
  busy = false,
  last = 0,
  token = 0;
function playbackUI() {
  play.textContent = playing ? "暫停" : "播放";
}
async function select(id) {
  if (!Object.hasOwn(catalog, id)) throw new Error("Unknown stack demo: " + id);
  const request = ++token;
  selected = id;
  current = null;
  loading.hidden = false;
  loading.textContent = "載入 " + catalog[id].name + "…";
  $("#error").textContent = "";
  [play, reset, action, slider].forEach((x) => (x.disabled = true));
  document
    .querySelectorAll("[data-demo]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.demo === id)),
    );
  const c = catalog[id];
  $("#title").textContent = c.title;
  $("#description").textContent = c.description;
  $("#art-title").textContent = c.art;
  $("#backend").textContent = "INITIALIZING";
  $("#stats").textContent = "—";
  $("#parameter-label").firstChild.textContent = c.parameter + " ";
  slider.value = c.value;
  $("#value").textContent = c.value + "%";
  action.textContent = c.action;
  action.setAttribute("aria-pressed", "false");
  try {
    while (busy) await new Promise(requestAnimationFrame);
    if (request !== token) return;
    if (!demos.has(id))
      demos.set(
        id,
        import("./" + c.module + ".js").then((mod) => mod.create()),
      );
    const demo = await demos.get(id);
    if (request !== token) return;
    await demo.reset();
    if (request !== token) return;
    current = demo;
    stage.replaceChildren(demo.canvas);
    demo.parameter(Number(slider.value) / 100);
    demo.resize();
    await demo.render();
    $("#backend").textContent = demo.backend;
    loading.hidden = true;
    [play, reset, action, slider].forEach((x) => (x.disabled = false));
    playbackUI();
    history.replaceState(null, "", "#" + id);
  } catch (e) {
    if (request !== token) return;
    current = null;
    demos.delete(id);
    loading.textContent = "此環境未能啟動 " + c.name;
    $("#error").textContent = e.message;
    $("#backend").textContent = "UNAVAILABLE — NO FALLBACK";
    console.error(e);
  }
}
document
  .querySelectorAll("[data-demo]")
  .forEach((b) => b.addEventListener("click", () => select(b.dataset.demo)));
play.addEventListener("click", () => {
  playing = !playing;
  playbackUI();
});
reset.addEventListener("click", async () => {
  if (busy || !current) return;
  const demo = current,
    request = token;
  busy = true;
  try {
    await demo.reset();
    if (request !== token) return;
    action.textContent = catalog[selected].action;
    action.setAttribute("aria-pressed", "false");
    await demo.render();
  } catch (e) {
    if (request === token) $("#error").textContent = e.message;
  } finally {
    busy = false;
  }
});
action.addEventListener("click", async () => {
  if (busy || !current) return;
  const demo = current,
    request = token;
  busy = true;
  try {
    const state = await demo.action();
    if (request !== token) return;
    action.setAttribute("aria-pressed", String(!!state));
    if (selected === "gpu") action.textContent = state ? "聚合" : "散開";
    await demo.render();
  } catch (e) {
    if (request === token) $("#error").textContent = e.message;
  } finally {
    busy = false;
  }
});
slider.addEventListener("input", () => {
  if (current) current.parameter(Number(slider.value) / 100);
  $("#value").textContent = slider.value + "%";
});
new ResizeObserver(() => current?.resize()).observe(stage);
async function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
  last = now;
  if (current && !busy && !document.hidden) {
    const demo = current,
      request = token;
    busy = true;
    try {
      if (playing) await demo.update(dt);
      await demo.render();
      if (request === token) {
        $("#clock").textContent = demo.time.toFixed(2).padStart(5, "0") + " s";
        $("#stats").textContent = demo.stats();
      }
    } catch (e) {
      if (request === token) {
        current = null;
        demos.delete(selected);
        [play, reset, action, slider].forEach((x) => (x.disabled = true));
        $("#error").textContent = e.message;
        $("#backend").textContent = "RENDER FAILED";
        console.error(e);
      }
    } finally {
      busy = false;
    }
  }
  requestAnimationFrame(tick);
}
window.demoLab = {
  select,
  pause: () => {
    playing = false;
    playbackUI();
  },
  play: () => {
    playing = true;
    playbackUI();
  },
  get current() {
    return current;
  },
  get selected() {
    return selected;
  },
  get busy() {
    return busy;
  },
  catalog,
};
await select(
  Object.hasOwn(catalog, location.hash.slice(1))
    ? location.hash.slice(1)
    : "pixi",
);
requestAnimationFrame(tick);
