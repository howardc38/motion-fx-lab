# Film effect settings

PixiJS, Rapier and WebGPU/TSL are three of the gallery's **63 film effects**.
Use this page to preview parameters and scrub the timeline. Their production
implementations live in `fx/stacks/` and all expose an asynchronous `frame(t)`.
The frame recorder awaits completion before capturing each frame.

| Effect | Renderer | Timeline |
|---|---|---|
| Liquid poster | PixiJS 8.22.0, displacement → blur → colour | Original until 1.4 s, then wave distortion |
| Domino chain | Rapier 0.21.0 + three.js r180 | Fixed 120 Hz, one scheduled impulse, scripted camera |
| Orbital particles | three.js r180 / WebGPU / TSL | 65,536 particles at 120 Hz, scripted attractor, dispersion at 4.5 s |

## Render a film

From the repository root:

```sh
npm ci
npx playwright install chromium
npm run render:stacks
```

This calls `bash video/build.sh examples/stacks.html` and produces
`media/stacks.mp4`, `stacks_hq.mp4`, `stacks.jpg`, and `stacks.gif`, with synthesised
audio. Every frame is independently rendered twice and compared; the delivery
pipeline checks codecs, colour tags, frame counts, loudness, peaks and size.
`npm run record:stacks` remains an alias for the same verified render command.
`npm run build:showcase` rebuilds this film, the optical film and the main intro.

The recorder starts a loopback HTTP server for local ES modules and closes it
when done. To preview manually, run `python3 -m http.server 8000` and open
`http://localhost:8000/examples/stacks.html` or this settings page. Dependencies
load from pinned CDNs, so internet access is required. WebGPU needs a real
supported adapter; these films refuse `--cpu` or a missing WebGPU backend.
Original WebGL-only films such as `examples/reel.html` still support `--cpu`.

## Use an effect

Include the r180 import map from `examples/stacks.html`, then
`fx/stack-effects.js`. Create an effect once, mount its canvas and await its frame:

```js
const effect = await FXStack.create("gpu"); // pixi / rapier / gpu
stage.appendChild(effect.canvas);
await effect.frame(5.2, { spin: 1.75 });
```

Options are fixed input to the requested frame: Pixi uses `{strength: 0.45}`,
Rapier `{speed: 1}`, and WebGPU `{spin: 1.75}`. Changing a simulation option or
seeking backward resets and replays fixed steps. Input pointers and wall-clock
time do not drive the exported picture. `proof()` reads body poses or actual GPU
storage for regression checks. Fixed seeds and steps are validated across
independent browsers on the same backend; cross-device pixel equality is not
promised.

`fx/pack-stacks.js` registers `stack-pixi`, `stack-rapier`, and `stack-gpu` using
`build(stage) -> {ready, frame(t)}`. Both gallery and intro use those same modules.
There are no recorded frame atlases in this path. The TSL attribution is in
`NOTICE`; runtime dependency licences are in the root `THIRD_PARTY.md`.
