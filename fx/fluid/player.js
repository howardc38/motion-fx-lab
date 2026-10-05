import { create } from "./effects.js";
const config = window.fluidFilm,
  canvas = document.getElementById("film"),
  g = canvas.getContext("2d", { willReadFrequently: true });
window.__SIZE = { w: 1280, h: 720 };
window.__DUR = 9.6;
window.__poster = config.poster;
window.__gif = config.gif;
window.__music = [
  [0, "intro"],
  [2.4, "drop"],
  [4.8, "lift"],
  [7.2, "final"],
  [8.4, "tail"],
];
window.__cues = () => config.cues.map(([t, name, gain]) => ({ t, name, gain }));
let effect,
  playing = false,
  recording = false,
  seconds = 0,
  last = 0,
  pending = Promise.resolve();
window.__ready = create(config.id, { film: true }).then((e) => {
  effect = e;
  window.filmEffect = e;
});
window.__render = async (t) => {
  await __ready;
  seconds = Math.max(0, Math.min(9.6, t));
  await effect.frame(seconds);
  g.drawImage(effect.canvas, 0, 0);
  document.getElementById("seek").value = seconds;
  document.getElementById("clock").textContent = seconds.toFixed(2) + " s";
};
function fail(e) {
  playing = false;
  document.getElementById("play").textContent = "Play";
  document.getElementById("error").textContent = e.message;
  console.error(e);
}
function render(t) {
  const job = pending.then(() => __render(t));
  pending = job.catch(fail);
  return job;
}
window.__record = async () => {
  recording = true;
  playing = false;
  await pending;
  await __ready;
  document.body.classList.add("record");
};
document.getElementById("play").onclick = () => {
  playing = !playing;
  document.getElementById("play").textContent = playing ? "Pause" : "Play";
};
document.getElementById("seek").oninput = (e) => {
  playing = false;
  document.getElementById("play").textContent = "Play";
  render(+e.target.value).catch(() => {});
};
async function tick(now) {
  if (recording) return;
  if (playing)
    await render((seconds + Math.min(0.1, (now - last) / 1000)) % 9.6).catch(
      () => {},
    );
  last = now;
  requestAnimationFrame(tick);
}
__ready
  .then(() => (recording ? undefined : render(0)))
  .then(() => {
    if (!recording) requestAnimationFrame(tick);
  })
  .catch(fail);
