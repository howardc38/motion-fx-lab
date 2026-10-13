// Page glue for the dialogue films: play with sound, seek, and the recorder hooks
// (__ready, __render, __record, __DUR, __SIZE, __audio, __poster, __gif). Sound uses the audio clock;
// capture uses the recorder's clock. The WAV is hashed and must match the manifest its cues came from.
import {createFilm} from './scene.js';
const name = window.dialogueFilm;
const canvas = document.querySelector('#film'), g = canvas.getContext('2d'), seek = document.querySelector('#seek'), play = document.querySelector('#play'), audio = document.querySelector('audio');
window.__SIZE = {w: canvas.width, h: canvas.height}; window.__cues = () => [];
let effect, spec, t = 0, playing = false, recording = false, pending = Promise.resolve();
function stop() { playing = false; audio.pause(); play.textContent = 'Play with sound'; }
function fail(error) { stop(); document.querySelector('#error').textContent = error.message; console.error(error); }
window.__ready = createFilm(name, {width: canvas.width, height: canvas.height}).then(async e => {
  effect = e; window.dialogueEffect = e; spec = e.spec; window.__DUR = spec.duration; seek.max = spec.duration;
  const b = spec.beats;
  if (name === 'character-dialogue') { window.__poster = b.trailer[0] + 4.25; window.__gif = [[b.trailer[0] + 2.2, b.trailer[0] + 4.6], [b.hook[0], b.hook[1] + 1.2], [e.K.cards - .3, e.K.cards + 2.4]]; }
  else { window.__poster = e.K.burst + .14; window.__gif = [[e.K.brace - .3, e.K.burstEnd + .2], [e.K.split, e.K.replayEnd + .6]]; }
  const url = new URL('../../assets/dialogue/' + spec.audio.file, import.meta.url); url.searchParams.set('v', spec.audio.sha256);
  const response = await fetch(url); if (!response.ok) throw new Error('Speech asset failed');
  const bytes = await response.arrayBuffer(), hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
  if (hash !== spec.audio.sha256) throw new Error('Speech and mouth cues are from different builds');
  audio.src = url.href; window.__audio = {src: url.pathname, sha256: hash};
});
window.__render = async seconds => {
  await window.__ready; if (!Number.isFinite(seconds)) throw new Error('Frame time must be finite');
  t = Math.max(0, Math.min(spec.duration, seconds)); await effect.frame(t); g.drawImage(effect.canvas, 0, 0);
  seek.value = t; document.querySelector('#clock').textContent = t.toFixed(2) + ' s';
};
function render(s) { const work = pending.then(() => window.__render(s)); pending = work.catch(fail); return work; }
window.__record = async () => { recording = true; stop(); await pending; await window.__ready; document.body.classList.add('record'); };
seek.oninput = () => { stop(); audio.currentTime = +seek.value; render(+seek.value).catch(() => {}); };
play.onclick = async () => {
  try { await window.__ready; if (playing) stop(); else { audio.currentTime = t >= spec.duration ? 0 : t; await audio.play(); playing = true; play.textContent = 'Pause'; } } catch (error) { fail(error); }
};
audio.onended = stop;
async function tick() {
  if (recording) return;
  if (playing) { await render(Math.min(spec.duration, audio.currentTime)).catch(() => {}); if (audio.currentTime >= spec.duration) stop(); }
  requestAnimationFrame(tick);
}
window.__ready.then(() => recording ? undefined : render(0)).then(() => { if (!recording) requestAnimationFrame(tick); }).catch(fail);
