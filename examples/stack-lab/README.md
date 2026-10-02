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
