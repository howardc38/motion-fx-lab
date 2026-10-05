import { TIMELINES } from "./material-studies/timelines.js";
import { create } from "./material-studies/films.js";
const config = { ...window.materialFilm, ...TIMELINES[window.materialFilm.id] },
  canvas = document.querySelector("#film"),
  g = canvas.getContext("2d", { willReadFrequently: true }),
  seek = document.querySelector("#seek"),
  play = document.querySelector("#play"),
  clock = document.querySelector("#clock");
window.materialTimeline = TIMELINES[config.id];
window.__SIZE = { w: 1280, h: 720 };
window.__DUR = config.duration;
window.__poster = config.poster;
window.__gif = config.gif;
window.__music = [
  [0, "intro"],
  [2.4, "drop"],
  [9.6, "lift"],
  [14.4, "final"],
  [config.duration - 2.4, "tail"],
];
window.__cues = () =>
  config.cuts.map((t) => ({ t, name: "whoosh", gain: 0.45 }));
let effect,
  recording = false,
  playing = false,
  at = 0,
  last = 0,
  pending = Promise.resolve();
window.__ready = create(config.id, { text: config.text }).then((e) => {
  effect = e;
  window.filmEffect = e;
});
window.__render = async (seconds) => {
  await __ready;
  at = Math.max(0, Math.min(config.duration, seconds));
  await effect.frame(at);
  g.drawImage(effect.canvas, 0, 0);
  seek.value = at;
  clock.textContent = at.toFixed(2) + " s";
};
function render(t) {
  const p = pending.then(() => __render(t));
  pending = p.catch(showError);
  return p;
}
function showError(e) {
  console.error(`Film ${config.id}, frame ${at.toFixed(3)} s`, e);
  playing = false;
  document.querySelector("#error").textContent = e.message;
  play.textContent = "Play";
}
window.__record = async () => {
  recording = true;
  playing = false;
  await pending;
  await __ready;
  document.body.classList.add("record");
};
play.onclick = () => {
  playing = !playing;
  play.textContent = playing ? "Pause" : "Play";
};
seek.max = config.duration;
seek.oninput = () => {
  playing = false;
  play.textContent = "Play";
  render(+seek.value).catch(() => {});
};
async function tick(now) {
  if (recording) return;
  if (playing) {
    await render(
      (at + Math.min(0.1, (now - last) / 1000)) % config.duration,
    ).catch(() => {});
  }
  last = now;
  requestAnimationFrame(tick);
}
__ready
  .then(() => (recording ? undefined : render(0)))
  .then(() => {
    if (!recording) requestAnimationFrame(tick);
  })
  .catch(showError);
