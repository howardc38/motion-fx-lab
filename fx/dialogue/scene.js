// Entry point for the dialogue films. createFilm(name, {width, height, mode}) resolves to
// {canvas, spec, frame(seconds, {captions, branding}), proof(), dispose()}; frame() renders
// directly from absolute time, so any frame can be rendered first.
//   character-lipsync   "Say it. Mean it."  (lipsync.js)
//   character-dialogue  "The Final Final"   (final.js)
// mode 'tile' enlarges captions and the cue strip for small gallery previews.
import {loadData, mouthAt, activeTurn} from './data.js';
export {loadData, mouthAt, activeTurn};
export const W = 1280, H = 720;

export async function createFilm(name = 'character-dialogue', options = {}) {
  const data = await loadData(), spec = data.films[name];
  if (!spec) throw new Error('Unknown dialogue film');
  const mod = name === 'character-lipsync' ? await import('./lipsync.js') : await import('./final.js');
  return mod.create(spec, data, {width: W, height: H, ...options});
}
