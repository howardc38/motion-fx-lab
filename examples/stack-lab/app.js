const $ = (s) => document.querySelector(s);
const studyById = Object.fromEntries(FXStack.studies.map((s) => [s.id, s]));
const defaults = { pixi: 45, rapier: 50, gpu: 50 };
const descriptions = {
  pixi: "Wave displacement, blur and colour grading ramp up on schedule: untouched until 1.4 s, then progressively warped.",
  rapier:
    "48 dominoes step at a fixed 120 Hz; the camera move is authored on the timeline and backward seeks replay from rest.",
  gpu: "65,536 GPU particles advance in fixed compute steps and disperse at 4.5 s while the attractor follows an authored path.",
};
let current,
  selected = "pixi",
  clock = 0,
  playing = false,
  busy = false,
  token = 0,
  last = 0;
const cache = new Map();
function options() {
  const v = Number($("#parameter").value) / 100;
  return selected === "pixi"
    ? { strength: v }
    : selected === "rapier"
      ? { speed: 0.25 + v * 1.5 }
      : { spin: 0.25 + v * 3 };
}
function playback() {
  $("#play").textContent = playing ? "Pause" : "Play";
}
async function draw() {
  if (!current || busy) return;
  busy = true;
  const effect = current,
    request = token,
    t = clock,
    settings = options();
  try {
    await effect.frame(t, settings);
    if (request === token) {
      $("#clock").textContent = t.toFixed(2) + " s";
      $("#seek").value = t;
      $("#stats").textContent = effect.stats();
    }
  } catch (e) {
    if (request === token) {
      playing = false;
      playback();
      $("#error").textContent = e.message;
    }
  } finally {
    busy = false;
  }
}
async function select(id) {
  if (!Object.hasOwn(studyById, id)) throw new Error("Unknown effect");
  const request = ++token;
  current = null;
  selected = id;
  clock = 0;
  playing = false;
  playback();
  const study = studyById[id];
  $("#loading").hidden = false;
  $("#loading").textContent = "Loading " + study.name + "…";
  $("#error").textContent = "";
  $("#backend").textContent = "INITIALIZING";
  document
    .querySelectorAll("[data-demo]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.demo === id)),
    );
  $("#title").textContent = study.name;
  $("#art-title").textContent = study.name.toUpperCase();
  $("#description").textContent = descriptions[id];
  $("#seek").max = study.duration;
  $("#seek").value = 0;
  $("#parameter-label").firstChild.textContent =
    { pixi: "Distortion strength", rapier: "Simulation speed", gpu: "Swirl intensity" }[id] + " ";
  $("#parameter").value = defaults[id];
  $("#value").textContent = defaults[id] + "%";
  for (const s of ["#play", "#reset", "#action", "#parameter", "#seek"])
    $(s).disabled = true;
  try {
    while (busy) await new Promise(requestAnimationFrame);
    if (!cache.has(id)) cache.set(id, FXStack.create(id));
    const effect = await cache.get(id);
    if (request !== token) return;
    current = effect;
    $("#stage").replaceChildren(effect.canvas);
    await draw();
    $("#backend").textContent = effect.backend;
    $("#loading").hidden = true;
    for (const s of ["#play", "#reset", "#action", "#parameter", "#seek"])
      $(s).disabled = false;
    history.replaceState(null, "", "#" + id);
  } catch (e) {
    if (request === token) {
      current = null;
      cache.delete(id);
      $("#backend").textContent = "UNAVAILABLE — NO FALLBACK";
      $("#loading").textContent = "Effect unavailable";
      $("#error").textContent = e.message;
    }
  }
}
document
  .querySelectorAll("[data-demo]")
  .forEach((b) => (b.onclick = () => select(b.dataset.demo)));
$("#play").onclick = () => {
  playing = !playing;
  playback();
};
$("#reset").onclick = () => {
  clock = 0;
  draw();
};
$("#action").onclick = () => {
  location.href = "../../index.html#effects";
};
$("#seek").oninput = () => {
  playing = false;
  playback();
  clock = Number($("#seek").value);
};
$("#parameter").oninput = () => {
  $("#value").textContent = $("#parameter").value + "%";
};
let signature = "";
async function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
  last = now;
  if (playing && current) clock = (clock + dt) % studyById[selected].duration;
  const key = selected + ":" + clock + ":" + $("#parameter").value;
  if (current && key !== signature && !busy) {
    await draw();
    signature = key;
  }
  requestAnimationFrame(tick);
}
window.demoLab = {
  select,
  get current() {
    return current;
  },
  get busy() {
    return busy;
  },
  pause() {
    playing = false;
    playback();
  },
  get selected() {
    return selected;
  },
};
await select(
  Object.hasOwn(studyById, location.hash.slice(1))
    ? location.hash.slice(1)
    : "pixi",
);
requestAnimationFrame(tick);
