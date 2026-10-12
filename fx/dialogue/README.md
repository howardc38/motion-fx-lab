# Speech and character performance

Two original faceted 3D characters share a miniature keyboard studio. Mira has
articulated fingers, a layered jacket, facial features and seated/standing poses;
Pip has an illuminated face, articulated arms and an antenna. Models, lighting,
camera positions, performance and dialogue are editable source, not video textures.

| Film | Length | Purpose |
|---|---:|---|
| [Say it. Mean it.](../../examples/character-lipsync.html) | 9.6 s | A close-up of speech shapes, expressions and gestures, followed by a quiet reaction. |
| [The Final Final](../../examples/character-dialogue.html) | 22.5 s | Two speakers, a misunderstanding, a seated plea, a pause and a closing joke. |

The gallery adds one family, `dialogue-lipsync`. Character designs, poses, shots
and the complete conversation are not additional effects. The latter is a
featured sequence; the focused lip-sync film stays on the effect card.

## Files and controls

- `actors.js`: faceted meshes, limb hierarchy, two-bone arm targets, fingers,
  eyebrows, gaze, blink and nine Rhubarb mouth shapes (A–H and resting X).
- `scene.js`: keyboard set, lights, shadows, bloom, depth of field, gestures,
  listening reactions and camera cuts. `frame(seconds, {captions, branding,
  cameraMode})` renders directly from absolute time. `cameraMode` may be
  `mira`, `pip` or `wide`; omit it for the authored cuts.
- `assets/dialogue/manifest.json`: speaker, text, start/end, gesture, mouth cues
  and the hash of each film's audio. The same timing drives captions and lips.
- `player.js`: play/pause/seek and export hooks. Sound uses the audio clock;
  capture uses the recorder's clock. The player rejects a changed WAV unless
  its matching manifest is rebuilt.

```js
import {createFilm} from './fx/dialogue/scene.js';
const film = await createFilm('character-dialogue');
film.frame(10.9, {captions: true, branding: false});
document.body.append(film.canvas); // 1280 × 720
film.dispose(); // when no longer needed
```

Use the Three.js r180 import map from either example page. Mouth cues come from
analysis of each actual voice recording. They are not derived from volume alone.
The other performance tracks are authored; the code does not infer emotions,
gestures or camera direction from arbitrary speech. Short mouth transitions are
blended, and the silent listener's mouth rests. Two-bone arm targeting is a
posing tool, not whole-body physics or automatic contact simulation.

## Rebuild speech, then render

Playback and rendering need no TTS model or lip-analysis executable. To regenerate
the included English lines, create an isolated Python environment and install
`tools/dialogue/requirements.txt`. Download the Kokoro v1.0 model and voices from
the [kokoro-onnx instructions](https://github.com/thewh1teagle/kokoro-onnx), and
[Rhubarb 1.14.0](https://github.com/DanielSWolf/rhubarb-lip-sync/releases/tag/v1.14.0).
Keep these external files outside the repository.

```sh
python tools/dialogue/build.py --model /path/kokoro-v1.0.onnx \
  --voices /path/voices-v1.0.bin --rhubarb /path/rhubarb
npm run render:dialogue-films
bash video/build.sh video/intro.html
```

`LINES` and `DEMO` in the builder hold the script, gestures and pauses. Each voice
is generated independently, trimmed, then analysed with the exact script as a
recognition hint. An original quiet plucked bed and keyboard clicks are mixed
with the speech. WAV and JSON publish together only after both films succeed.
The current voices are `af_heart` and `bm_george`; this is generated speech, not
a recording or clone of anyone in the reference. For a recorded voice, run
Rhubarb against that WAV and supply its cues and exact clip timing in the manifest;
recompute the final mix hash. Do not keep old cues after changing the audio.

After changing line lengths, review camera and gesture timing, poster/GIF windows,
intro excerpt and public durations. The included intro takes source 0.45–5.25 s
at 16.8–21.6 s, with the same voice audio and the intro music ducked beneath it.
`__audioLayers` declares hashed local WAV segments using `at`, `offset`, `duration`,
`gain` and `duck`; `prepare-audio.py` validates and mixes them for export.

Every output frame is rendered twice in independent browsers. Transparent dust is excluded from the mesh-only depth pass; otherwise an undefined point size can corrupt the focus buffer on ANGLE Metal. MP4,
poster and GIF are published as a checked bundle. A silent gallery preview
demonstrates the motion; open the film to hear it.

The visual direction was inspired by [base.learn's reel](https://www.instagram.com/reels/DeXCbYDS3vi/): faceted characters, miniature staging, expressive dialogue and reaction cuts. The script, character designs, scene and audio here are original. See [THIRD_PARTY.md](../../THIRD_PARTY.md) for offline-tool licences.
