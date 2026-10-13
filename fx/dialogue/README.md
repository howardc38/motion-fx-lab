# Speech and character performance

A plush bear (from [fx/plush/](../plush/README.md)) and Pip, a studio robot with a screen face,
perform two voiced films. One recording drives nine analysed mouth shapes; captions highlight each
word as it is spoken. Models, lighting, performance, cameras and the film-within-the-film are
editable source, not video textures.

| Film | Length | Purpose |
|---|---:|---|
| [Say it. Mean it.](../../examples/character-lipsync.html) | 11.6 s | Close-up lip sync with three named expressions (suspicious, outburst, smug), then the same cues on Pip's face in a split screen. |
| [The Final Final](../../examples/character-dialogue.html) | 23.8 s | The bear asks for the launch video; Pip has made it "more dramatic". The trailer, the file cards and Pip's loading face are built from gallery effects. |

The gallery adds one family, `dialogue-lipsync` (its tile plays the first film with enlarged
captions and the mouth-cue strip). Characters, poses, shots and the finished story are not
additional effects.

## Files

- `scene.js`: `createFilm(name, {width, height, mode})` returns `{canvas, spec, frame(t, {captions,
  branding}), proof(), dispose()}`. `frame()` renders directly from absolute time. Films default to
  1280 × 720; the example pages render at 1920 × 1080. `mode: 'tile'` enlarges captions for small previews.
- `lipsync.js`, `final.js`: the two films (performance, cameras, compositing).
- `trailer.js`: the launch video inside The Final Final, drawn on a 2D canvas. Its beats name the
  gallery technique each one uses (count, sweep, glitch, stamp); `final.js` adds rays, card flip and
  ring. `effectsAt(t)` and `proof().effects` report which gallery effects are on screen.
- `actors.js`: Pip (faceted body, two-bone arms, fingers) and its canvas screen face with nine mouth
  shapes, eyes, brows and a loading ring.
- `data.js`: manifest loading, mouth-cue blending (45 ms transitions), word and beat lookup.
- `captions.js`: word-highlighted captions and the mouth-cue strip.
- `player.js`: play, pause, seek and export hooks. Sound uses the audio clock; capture uses the
  recorder's clock. A changed WAV is rejected unless its manifest is rebuilt.
- `assets/dialogue/manifest.json`: per film, the lines (speaker, text, gesture, start/end, mouth
  cues, the raw Rhubarb shapes as `analysis`, word spans), named beats, sound-effect cues and the
  hash of the mix. A replayed line lists every face it drives in `faces`.

```js
import {createFilm} from './fx/dialogue/scene.js';
const film = await createFilm('character-lipsync', {width: 1280, height: 720});
film.frame(2.42, {captions: true, branding: false});
document.body.append(film.canvas);
```

Use the three.js r180 import map from either example page. Mouth cues come from analysis of each
actual recording, not from volume alone. Expressions, gestures and camera direction are authored
against the analysed words and beats, so a rebuilt voice moves them with the speech; the code does
not infer emotion from arbitrary audio.

## Rebuild speech, then render

Playback and rendering need no TTS model or lip-analysis executable. To regenerate the English
lines, create an isolated Python environment with `tools/dialogue/requirements.txt`, download the
Kokoro v1.0 model and voices from the [kokoro-onnx instructions](https://github.com/thewh1teagle/kokoro-onnx)
and [Rhubarb 1.14.0](https://github.com/DanielSWolf/rhubarb-lip-sync/releases/tag/v1.14.0).
Keep these files outside the repository.

```sh
python tools/dialogue/build.py --model /path/kokoro-v1.0.onnx \
  --voices /path/voices-v1.0.bin --rhubarb /path/rhubarb
bash video/build.sh examples/character-lipsync.html
bash video/build.sh examples/character-dialogue.html
```

`FILMS` in the builder holds the script, gestures, pauses and silent beats; `sound_design()` places
the effects (from `video/sfx.py` plus a breath, a glitch, an ear-flick and a card flip generated in
the builder). Each line is generated once, trimmed and analysed by Rhubarb with its exact text as a
hint. Word spans come from Kokoro's own phoneme durations: the builder exposes the model's rounded
duration tensor as a second output (the audio is unchanged), so captions and speech share one
timing. Rhubarb shows most short vowels as B; a B or C cue of at least 0.1 s at 70% or more of the
line's peak level opens one step (B → C, C → D), as an animator would on a stressed syllable. The
raw shapes are kept in `analysis`. Mixes are set to −16 LUFS; `deliver.py` sets the delivered level.

Voices: the bear is Kokoro `af_jessica` at 0.97 speed. Of twelve stock voices auditioned with the
bear's lines it had the highest median pitch with a wide range (about 212 Hz, 11 semitones between
the 10th and 90th percentile), which suits a small, excitable plush toy. Pip keeps `bm_george`.
This is generated speech, not a recording or clone of anyone. For a recorded voice, run Rhubarb
against that WAV and supply its cues, word spans and clip timing in the manifest, then recompute the
mix hash. Do not keep old cues after changing the audio.

After changing line lengths, review the beats, poster and GIF windows and any intro excerpt. Every
output frame is rendered twice in independent browsers. Fur layers and dust are left out of the
depth-of-field depth pass. MP4, poster and GIF are published as a checked bundle; a silent gallery
preview shows the motion and captions; open the film to hear it.

The original Mira design and the earlier faceted look were replaced by the plush bear. Script,
character designs, scenes and audio here are original. See [THIRD_PARTY.md](../../THIRD_PARTY.md)
for offline-tool licences.
