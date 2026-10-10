# Measured sound, image motion and held impacts

Three 12-second studies use the original Counterform footage/rig and an original
synthesised score. They borrow the energy and visual direction of
[the reference film](https://www.threads.com/@aicreataro/post/DeQIT_0Ed93), without
bundling its footage, artwork or music.

| Study | What actually drives it | Catalogue role |
|---|---|---|
| [Pulse / Form](../../examples/audio-relief.html) | Measured RMS and 32 frequency bands raise solid image cells | `signal-audio-relief`: variant of `studio-depth-dots` |
| [Motion / Release](../../examples/motion-fragments.html) | Measured optical-flow direction/speed emits and directs solid fragments; audio adds depth | `signal-motion-fragments`: one new motion family |
| [Impact / Orbit](../../examples/impact-orbit.html) | Measured music attacks cue authored impact poses; camera, lights and surface treatment keep moving | `signal-freeze-orbit`: variant of `studio-freeze-orbit` |

These are linked from effect cards and the README source archive. The main film
shortlist stays at 12. The existing dot-relief and simple freeze comparisons remain
selectable. Intro excerpts demonstrate the cached source studies under the intro's
own soundtrack; each full study plays the score used for its measurements.

## Rebuild or replace the inputs

The shipped score is centred stereo PCM. Mono replacements are converted to centred stereo; existing stereo recordings keep both channels. Analysis is limited to 300 seconds of audio.

Normal playback and MP4 export use checked-in assets; OpenCV is only needed when
rebuilding measurements. The browser renderer remains Three.js r180/GLSL/Canvas.

```sh
python3 -m venv /tmp/motion-signal-env
/tmp/motion-signal-env/bin/pip install -r tools/signals/requirements.txt
/tmp/motion-signal-env/bin/python tools/signals/build.py --replace
npm run render:signal-films
```

To analyse your own indexed RGBA footage and score:

```sh
python3 video/import-clip.py my-source.mp4 assets/my-source --fps 24
/tmp/motion-signal-env/bin/python tools/signals/build.py \
  --source assets/my-source --period 4.8 --audio my-score.wav \
  --output assets/my-signals
```

Set `window.signalOptions = {signalsUrl:'../assets/my-signals/manifest.json'}` before
loading the player, or pass that option to `FXSignal.create(id, options)`. `--period`
is the intended source-loop duration and must fit its frame manifest. The bundled
film timelines are 12 seconds: replacement audio must be at least 12 seconds; longer
scores are trimmed to the film duration in preview and export. For the impact
study, edit `orbitClock()`'s cue windows/pose choices when changing the soundtrack.
Its actor loading and framing are authored for Amber/Teal; adapt `createOrbit()`
along with the pose choices when substituting a different rig. It rejects a score without measured attacks in its two cue windows, rather
than substituting a pretend detected beat. The supplied score has attacks at 1.2 s
and 6.0 s. Impact poses are authored choices, not automatic collision detection.

`build.py` writes a complete temporary bundle and publishes it atomically. Existing
output requires `--replace`. A failed analysis leaves the previous bundle intact.
The manifest records source-image fingerprints, producer fingerprint, score hash,
compressed/decoded sample hashes, frame rate, period, grid and units. The compressed
cache is about 1.4 MB and decodes to about 13.4 MB for the supplied source; it is shared
between instances. Maximum decoded sample data is 200 MB. Regenerate the signals
when changing the source footage, score or analysis code.

## Frame contract and edit owners

Pass `audio-relief`, `motion-fragments` or `freeze-orbit` to `FXSignal.create()`.
Gallery IDs add `signal-`; the cinematic orbit entry page is `impact-orbit.html`.

```js
const effect = await FXSignal.create('audio-relief');
await effect.frame(2.4, {
  sourceTime: .6, audioTime: 2.4,
  audioGain: 1.55, cameraAngle: .4, labels: false
});
// effect.canvas is 1280×720; effect.proof() describes clocks and measurements.
```

- `data.js` validates and loads the cache; source time and audio time are independent.
- `field.js` owns solid-cell relief and the bounded history of moving fragments.
  Both support `sourceTime`, `audioTime`, `audioGain`, `cameraAngle`, `labels`.
  `motionGain` scales motion emission/velocity; zero suppresses emitted fragments.
  `audioGain` is a visual gain, not an audio-volume control.
- `orbit.js` owns impact pose selection, held intervals, camera travel and lighting.
  `sourceTime`, `cameraAngle`, `lightTime`, `audioTime`, `labels` allow separate checks.
  The old studio comparison remains independent of this cinematic variation.
- `films.js` owns film metadata, poster and GIF selections; `player.js` owns sound
  playback and recorder hooks. These authored stories end at 12 seconds; retiming
  them requires updating their shot timing and metadata together.
- `stage.js` owns shared rendering and graphic overlays. Every frame is derived
  from fixed assets and explicit time; no elapsed-time particle simulation is kept.

## Analysis and geometry boundaries

Audio RMS is measured directly from decoded PCM. A 2048-sample Hann FFT supplies 32
logarithmic bands on one shared −50 dB..0 dB scale, preserving relative spectral
energy. Positive energy changes locate attacks. This is not speech recognition or
a general beat/downbeat classifier. No microphone input or live FFT is required.

OpenCV Farneback estimates current-to-previous image motion; its negation is used
as a current-position velocity estimate. Vectors are stored at 1/256 of a source
pixel per frame and converted using source FPS and image scale. Transparent
background samples are suppressed. Faster visible regions emit fragments from a
bounded 0.8-second history of source samples. This measures apparent pixel movement,
including camera motion; it does not infer joints, forces or true 3D trajectories.
Cuts, occlusion and low-texture areas can produce imperfect flow.

Relief and motion fragments use real solid geometry but remain 2.5D reconstructions
of image samples. Brightness/energy determines depth, not recovered anatomy. The
freeze study uses the actual skinned GLB and can show its sides and back. Its contact
ellipses are graphic staging, not physically solved shadows.

## Export the same score

The pages declare `__audio = {src, sha256}` using their manifest-relative score URL.
`record.cjs` carries that metadata to `prepare-audio.py`, which verifies the local
file hash and sufficient duration before passing it to the normal delivery chain.
It trims to the authored duration and adds a silent guard tail, preserving the
recorder’s endpoint frame when delivery uses `-shortest`.
Mastering may change overall loudness/dynamics; the source recording and timing
are the ones analysed. Pages without `__audio` retain generated music and SFX.
MP4, poster and GIF are published together only after the normal frame verification.

```sh
/tmp/motion-signal-env/bin/python tools/signals/test_analysis.py
npx playwright test tests/signals.spec.cjs
```
