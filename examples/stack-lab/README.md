# Stack experiments

Three live demos, linked from the main gallery. Run `python3 -m http.server 8000`
at the repository root and open `http://localhost:8000/examples/stack-lab/`.
There is no build step or npm runtime installation. The browser imports pinned
dependencies from jsDelivr; an internet connection is required on first load.

| Demo | Actual implementation | Controls |
|---|---|---|
| Liquid poster | PixiJS 8.22.0, `DisplacementFilter` → `BlurFilter` → `ColorMatrixFilter` | Original/filtered comparison, displacement strength |
| Chain reaction | Rapier 0.21.0 WASM, 48 dynamic bodies, fixed 120 Hz; three.js r180 draws meshes | Replay, speed, drag to orbit |
| Orbital matter | three.js r180 WebGPU, TSL compute, position and velocity storage buffers for 65,536 particles | Attract/disperse, swirl strength, pointer-controlled centre |

WebGPU requires a supported browser and HTTPS or localhost. If a real WebGPU
backend cannot initialize, the demo shows an error; it never substitutes WebGL
particles. Other demos remain selectable. The main gallery still uses r128.

These are interactive experiments, **not recorder adapters**. Their live clock,
camera and pointer input are not exposed as `window.__render(t)`. Rapier and GPU
compute use fixed simulation steps, but this does not make browser pixels equal
across devices. `preview.mp4` is a 24-second browser recording, not a verified
frame-exact export. The six optical studies at `../optical.html` do provide the
recorder contract.

Each module exports `create()` and returns its canvas, `update(dt)`, `render()`,
`reset()`, `action()`, `parameter(value)`, and `proof()`. The latter reports live
library/backend state; Rapier also exposes body poses, and WebGPU reads positions
back from its GPU buffer. Browser regression tests use these to verify actual
filter use, collision propagation, repeatable physics resets, and GPU updates.

The artwork is drawn in code. See `NOTICE` for the three.js example attribution
and the repository's `THIRD_PARTY.md` for runtime dependencies.

## Rebuild the recording

From the repository root, install the development dependency and Chromium once:

```sh
npm ci
npx playwright install chromium
npm run record:stacks
```

The command needs ffmpeg/ffprobe, internet access to the pinned CDNs, and a real
WebGPU adapter. It serves the repo on an ephemeral localhost port and closes its
server and browser on completion. On macOS it uses ANGLE Metal. It records a
1280×720 canvas at 30 fps: PixiJS for 7 seconds (original, then filters), Rapier
for 9 seconds, and WebGPU for 8 seconds (orbit, then dispersion). Each segment
starts from a reset state; it waits for the runtime and checks physics/GPU output.

The script encodes a silent H.264 web preview, checks its 720 frames / 24 seconds,
extracts the poster at 19 seconds, and creates three 480×270 frame atlases at
10 fps. `capture.json` describes the recording and runtime proof; `capture.js`
provides the same manifest to the intro when opened over `file:`. These are
generated files, not hand-edited source. Only validated capture outputs replace
the existing files. To write elsewhere, use
`npm run record:stacks -- --out-dir /absolute/output/path`.

The intro samples the checked-in atlases by timeline time, so seeking the intro
is repeatable without claiming that the underlying interactive simulations are
recorder adapters. After changing any stack demo, run `npm run build:showcase` to
refresh its recording, the optical film and the intro (including posters/GIFs).
