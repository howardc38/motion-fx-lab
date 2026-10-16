# Measured sound, image motion and held impacts

Three studies, each driven by real measurements of its own source and its own original
synthesised score; no two share a soundtrack. Two are published as 12-second effect films
that also play inside their effect cards. The third, the held-impact orbit, is published as
the freeze-orbit climax of COUNTERFORM (`examples/dot-battle.html`, 12–13.2 s); its own
12-second page, `examples/impact-orbit.html`, is kept as a source page for tests and editing
and is no longer a published film.

| Study | Subject | What actually drives it | Catalogue role | Published |
|---|---|---|---|---|
| [Motion / Release](../../examples/motion-fragments.html) | Apricot the cat (`assets/characters/apricot-cat`) | Measured optical flow decides where the cat breaks, which way the pieces fly and when they return | `signal-motion-fragments`: the **Motion shatter and reassemble** family | effect film `motion-fragments` |
| [Pulse / Form](../../examples/audio-relief.html) | Milo the explorer robot (`assets/characters/explorer-robot`) | Measured RMS loudness (and one frequency band per row) sets the height of solid image pins | `signal-audio-relief`: variant of `studio-depth-dots` | effect film `audio-relief` |
| [Impact / Orbit](../../examples/impact-orbit.html) | Counterform fighters | Measured music attacks cue authored impact poses; camera, lights and surface treatment keep moving | `signal-freeze-orbit`: variant of `studio-freeze-orbit` | inside the demo film `dot-battle` (COUNTERFORM) |

| Bundle | Used by | Contents |
|---|---|---|
| `assets/signals-fragments/` | Motion / Release | 321 measured frames of the cat clip (200×90 cells, 30 fps), film cues, own score |
| `assets/signals-relief/` | Pulse / Form | one measured portrait frame (256×144 cells), own score |
| `assets/signals/` | Impact / Orbit and the COUNTERFORM freeze-orbit | Counterform footage measurements and the original Counterform score (unchanged) |

## Motion shatter and reassemble

**Still is whole, fast motion breaks, stillness rebuilds.** `fragments.js` precomputes a
fragment history once from the measured cache, so every frame is still a pure function
of film time:

- Each subject cell's measured speed (stage px per source frame) is compared with
  `RULES.lo/hi`. Slow walking stays below `lo`, so the cat walks without breaking; the
  sprinting legs, the take-off and the tail whip exceed it.
- A sudden speed increase (`burst`) releases most pieces. When most of the body moves
  together, the leading edge (the head on the leap) holds and the rear breaks away.
- Each released cell becomes four solid shards in its own colour, launched along its
  measured velocity with drag, so the pieces trail the movement. A share of the cut
  faces carries the single accent colour.
- Every piece keeps a *home*: the same material point, advanced frame by frame with
  the measured flow. When the measured speed at the home falls below `RULES.settle`
  (walking pace: the cat has landed or the tail is still), or after `RULES.maxFlight`
  seconds, the piece flies straight back and snaps in. The distance to home only
  decreases during a return.
- The hole a piece leaves is fully open at the break and closes over `RULES.scar`
  seconds, so the impact reads as broken while the body stays readable under its trail;
  it is closed before a returning piece is `RULES.heal` of the way home, so reassembly
  shows no cracks. Shards that come to rest on the floor crumble to a third of their size
  and regain it on the way back.
- The gallery card loops film seconds 1–8 (`gallery.previewWindow` in
  `fx/manifest.json`); the film and the intro play the whole 12 s timeline.
- The leap's apex is a time-remap (`performance.js` `REMAP`, 0.25×). Fragments are
  evaluated in source time, so they hang in the air with the cat.
- The background changes only on the measured impact (±2 frames); the score's shatter
  attack is placed on the same frame.

The cat's pose comes from `fx/character` (read-only). `performance.js` authors the
performance (idle → sprint → leap → land → tail flick → slow walk) and the film's time
remap; the same function renders the measured RGBA clip and the full-resolution cat
shown in the browser.

## Audio-driven solid relief

Every visible cell of the Milo portrait is a lit solid column (`relief.js`). Its height is
`RELIEF.height × audioGain × measured envelope × shape × band`, where shape mixes the
cell's brightness with its distance inside the silhouette, and band is the measured
frequency band for that row (low at the bottom, high at the top). With silence the
picture is exactly flat; the camera swings to a grazing angle at the drop so the depth
reads. A small waveform of the same measured envelope sits bottom right.

## Rebuild or replace the inputs

Normal playback and MP4 export use checked-in assets; Playwright and OpenCV are only
needed when rebuilding measurements. The browser renderer remains Three.js r180/GLSL/Canvas.

```sh
python3 -m venv /tmp/motion-signal-env
/tmp/motion-signal-env/bin/pip install -r tools/signals/requirements.txt
W=$(mktemp -d)
# Motion / Release: render the cat clip (PNG-in-MOV with alpha) and its film cues,
# import it at fixed FPS, then measure flow and synthesise the score on those cues.
node tools/signals/render-source.cjs fragments "$W"
python3 video/import-clip.py "$W/cat.mov" "$W/cat-frames" --fps 30 --width 800 --height 360
/tmp/motion-signal-env/bin/python tools/signals/build.py --source "$W/cat-frames" \
  --period 10.7 --grid-width 200 --analysis-width 400 --score fragments \
  --cues "$W/cues.json" --output assets/signals-fragments --replace
# Pulse / Form: one portrait frame and the relief score.
node tools/signals/render-source.cjs relief "$W"
python3 video/import-clip.py "$W/portrait.mov" "$W/portrait-frames" --fps 24 --width 1280 --height 720
/tmp/motion-signal-env/bin/python tools/signals/build.py --source "$W/portrait-frames" \
  --period 0.041666 --grid-width 256 --analysis-width 640 --score relief \
  --output assets/signals-relief --replace
bash video/build.sh examples/motion-fragments.html
bash video/build.sh examples/audio-relief.html
```

`build.py` without `--score` keeps the Counterform defaults (`assets/studio/fight`,
160-cell grid, original score) used by `assets/signals/`. Change `performance.js`, the
rules or the score together with the bundle: the fragments film reads its impact,
landing and walk cues from the bundle's `source.cues`.

To analyse your own indexed RGBA footage and score:

```sh
python3 video/import-clip.py my-source.mp4 assets/my-source --fps 24
/tmp/motion-signal-env/bin/python tools/signals/build.py \
  --source assets/my-source --period 4.8 --audio my-score.wav \
  --output assets/my-signals
```

Pass `{signalsUrl:'../assets/my-signals/manifest.json'}` to `FXSignal.create(id, options)`
(or set `window.signalOptions` before loading the player). `--period` is the intended
source duration and must fit its frame manifest. The fragments study additionally needs
`--cues` (impact, land, walk, …) in film seconds. Film timelines are 12 seconds: a
replacement score must be at least 12 seconds; longer scores are trimmed. For the
impact study, edit `orbitClock()`'s cue windows/pose choices when changing the
soundtrack; it rejects a score without measured attacks in its two cue windows, and its
actor loading and framing are authored for Amber/Teal.

`build.py` writes a complete temporary bundle and publishes it atomically. Existing
output requires `--replace`. A failed analysis leaves the previous bundle intact.
The manifest records source-image fingerprints, producer fingerprint, score hash,
compressed/decoded sample hashes, frame rate, period, grid and units. Maximum decoded
sample data is 200 MB (the cat clip decodes to about 46 MB, 3.4 MB compressed).

## Frame contract and edit owners

Pass `audio-relief`, `motion-fragments` or `freeze-orbit` to `FXSignal.create()`.
Gallery IDs add `signal-`; the orbit's standalone source page is `impact-orbit.html`.

```js
const effect = await FXSignal.create('motion-fragments');
await effect.frame(3.5, { motionGain: 1, labels: false });
// effect.canvas is 1280×720; effect.proof() reports particles, holes, returns,
// background, measured flow and clocks; effect.timeline() lists births per source frame.
```

- `data.js` validates and loads a cache; source time and audio time are independent.
- `fragments.js`: `sourceTime` overrides the remapped source clock; `motionGain` scales
  release probability and launch speed, zero suppresses fragments.
- `relief.js`: `audioTime`, `audioGain` (visual gain, not volume) and `cameraAngle`
  (fixed yaw) allow separate checks.
- `orbit.js` owns impact pose selection, held intervals, camera travel and lighting.
- `performance.js` owns the cat performance, the time remap, the film cues and the
  portrait pose; `tools/signals/source.html` renders them for measurement.
- `films.js` owns film metadata and poster times (effect films publish no card loop or
  GIF); `player.js` owns sound playback and recorder hooks. `stage.js` owns the shared renderer and text helper.

## Analysis and geometry boundaries

Audio RMS is measured directly from decoded PCM. A 2048-sample Hann FFT supplies 32
logarithmic bands on one shared −50 dB..0 dB scale. Positive energy changes locate
attacks. This is not speech recognition or a general beat/downbeat classifier.

OpenCV Farneback estimates current-to-previous image motion; its negation is used
as a current-position velocity estimate. Vectors are stored at 1/256 of a source
pixel per frame. Transparent background samples are suppressed. This measures
apparent pixel movement; it does not infer joints, forces or true 3D trajectories.
Fragment homes follow the measured flow, so tracking drift can return a piece a few
pixels from where it left; its hole has already closed by then.

Relief and fragments use real solid geometry but remain 2.5D reconstructions of image
samples: brightness and silhouette distance give depth, not recovered anatomy. The
freeze study uses the actual skinned GLB and can show its sides and back.

## Export the same score

The pages declare `__audio = {src, sha256}` using their manifest-relative score URL.
`record.cjs` carries that metadata to `prepare-audio.py`, which verifies the local
file hash and sufficient duration before passing it to the normal delivery chain.
Mastering may change overall loudness/dynamics; the source recording and timing
are the ones analysed.

```sh
/tmp/motion-signal-env/bin/python tools/signals/test_analysis.py
npx playwright test tests/signals.spec.cjs
```
