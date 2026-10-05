# Optional Blender fluid films

These are original offline simulations for finished films, not browser fluid solvers.
Blender 5.2.2 LTS was used for the shipped assets. Mantaflow is included with Blender.
No Blender binary, external model, stock footage or generated image is bundled.

| Recipe | Film | What changes |
|---|---|---|
| `overflow` | Overflow | Liquid inflow interacts with a sculpted open vessel; sheets and droplets leave the rim. Cycles renders transparent refraction. |
| `viscous` | Slow Gold | The high-viscosity solver produces a thicker stream over a ceramic loop. The finishing camera observes the coated face. |
| `smoke` | Find the Form | Gas flows around solid lettering, then dissipates. Material and light staging reveal the gold form. |

Each scene lasts 9.6 seconds, with 289 full-resolution frames at 30 fps including
the final endpoint. The web films add editable titles and synthesised audio.

## Watch or export without Blender

The checked-in `assets/fluid/<recipe>/` directories contain JPEG frames, metadata,
SHA-256 hashes, bake receipts and sampled simulation evidence. They replay through
`fx/fluid/effects.js` and the existing deterministic `FrameSource` loader.

```sh
npm run render:fluid-films
# Or render just one:
bash video/build.sh examples/fluid-overflow.html
```

The short gallery studies select a 4.8-second range from these same bakes. They do
not claim to run Mantaflow live. `fluid-viscous` is a variant of `fluid-overflow`;
`fluid-smoke` demonstrates volumetric gas. Do not count the finished films again
as additional techniques.

## Change the simulation

Install Blender 5.2 LTS (on macOS: `brew install --cask blender`) and ensure `blender`
is on PATH, or set `BLENDER_BIN` to its executable. Python 3, Node and ffmpeg are
also used by the asset publisher. Normal playback needs none of the Blender tools.

```sh
python3 tools/blender/build.py overflow --replace --keep-work
python3 tools/blender/build.py viscous --replace
python3 tools/blender/build.py smoke --replace
npm run render:fluid-films
```

`--replace` explicitly permits replacing that recipe's published frame directory.
Without it, an existing directory is preserved. Work is built in a new directory
under `.blender-cache/`; incomplete work is retained for diagnosis. `--keep-work`
retains successful work too. Simulation caches and uncompressed frames are ignored
by Git and can be large. Baking and rendering are substantially slower than replay.

- `scenes.py` defines geometry, emitters, collisions, materials and physics. Liquid
  recipes use a meshed Mantaflow domain; the thick stream enables the viscosity
  solver. Smoke uses a gas domain with real density fields and dissolves after its
  emitters turn off. Edit these parameters and rebake to change the motion.
- `inspect-bake.py` verifies completed caches, nonempty liquid meshes / active smoke
  density, and sampled obstacle penetration for the torus recipe. These checks are
  sanity checks, not a scientific validation of the numerical fluid solution.
- `render.py` renders cached motion and applies the final camera/light treatment.
  Changing cameras or materials needs rendering again; it can reuse the simulation.
- `publish-frames.py` validates the sequence and installs it through the existing
  rollback-capable publisher. Output is a full-frame opaque beauty plate. It is
  not a transparent actor cutout or an editable 3D mesh in the browser.

The first Overflow and Find the Form plates were rendered through `scenes.py`'s
render action; their render receipts preserve that actual source path and hash.
The common rebuild command uses `render.py` for all recipes. The two paths use the
same saved scene; Slow Gold additionally applies the coated-face camera treatment.

## Rerender a retained cache

Use `--keep-work` for the initial build. It prints the retained directory, such as
`.blender-cache/overflow-abc123`. Put camera, light or material finishing edits in
`render.py`, which opens the saved scene without changing its baked geometry.
Replace the sample directory below with the printed path:

```sh
blender -b --factory-startup --python-exit-code 2 --python tools/blender/render.py -- --recipe overflow --work .blender-cache/overflow-abc123
python3 tools/blender/publish-frames.py .blender-cache/overflow-abc123 assets/fluid/overflow --replace
bash video/build.sh examples/fluid-overflow.html
```

The same sequence resumes a failed render when its bake and simulation proof are
complete. It rerenders the entire sequence so a partial render cannot mix frames.
If inspection was interrupted, first run
`blender -b --factory-startup --python-exit-code 2 --python tools/blender/inspect-bake.py -- .blender-cache/overflow-abc123`.
An incomplete bake must be rebuilt. Changing `scenes.py` also requires a new bake:
the publisher rejects old receipts whose scene-source hash no longer matches.

## Verification boundary

Bake and render receipts record Blender version, settings and the source-script
hashes. Final simulation resolution is defined only in `scenes.py`; inspection records the actual saved domain resolution and image dimensions, and publication checks that evidence rather than maintaining a second recipe table. `simulation-proof.json` samples actual generated geometry or smoke density.
The frame manifest hashes the published images. The normal browser recorder then
renders and compares every final composite frame on independent browser instances,
and checks video/audio delivery. It does **not** perform a second independent fluid
simulation or claim pixel-identical rebakes across Blender versions or hardware.

Intro embeds only selected shots. Rebuild the intro after changing a shared plate;
also regenerate each changed film's MP4, GIF and poster as one bundle.
