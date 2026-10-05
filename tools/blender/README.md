# Optional Blender fluid films

These are original offline simulations for finished films, not browser fluid solvers.
Blender 5.2.2 LTS was used for the shipped assets. Mantaflow is included with Blender.
No Blender binary, external model, stock footage or generated image is bundled.

| Recipe | Film | What changes |
|---|---|---|
| `overflow` | Overflow | A low-height inlet adds water to a partly filled vessel. The level rises to the rim and excess water runs down the outside. |
| `viscous` | Slow Gold | A moving gold-coloured stream lays a viscous sheet over a dark ceramic loop, stretches and drains onto the plinth. |
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

- `liquid-scenes.py` defines the current liquid recipes: vessel/loop geometry,
  inflow, collisions, viscosity, lights and cameras. `scenes.py` supplies smoke
  with a gas domain that dissolves after its emitters turn off. Edit the relevant
  recipe and rebake to change motion. Both liquid films use Cycles; smoke uses Eevee.
- `finish-mesh.py` reconstructs the final liquid surface from the completed data
  cache. Its overlapping particle radius reduces gaps in the draft surface;
  `mesh-receipt.json` records this separate stage. No physics is rebaked.
- `inspect-bake.py` verifies completed caches, nonempty liquid meshes / active smoke
  density, and sampled obstacle penetration for the torus recipe. The revised
  Overflow also checks retained water volume and a pool surface that reaches the
  rim. This caught severe volume loss in an earlier obstacle configuration. These
  are sanity checks, not a proof of exact mass conservation or scientific accuracy.
- `render.py` renders cached motion and applies the final camera/light treatment.
  Changing cameras or materials needs rendering again; it can reuse the simulation.
- `publish-frames.py` validates the sequence and installs it through the existing
  rollback-capable publisher. Output is a full-frame opaque beauty plate. It is
  not a transparent actor cutout or an editable 3D mesh in the browser.

The smoke plate was rendered through `scenes.py`'s render action; its receipt
preserves that source path and hash. The first liquid recipes remain in that file
for provenance, but `build.py` selects `liquid-scenes.py` for current liquid rebuilds.
The common finishing renderer is `render.py`; it supports retained legacy scenes too.

## Rerender a retained cache

Use `--keep-work` for the initial build. It prints the retained directory, such as
`.blender-cache/overflow-abc123`. Put camera, light or material finishing edits in
`render.py`, which opens the saved scene without changing its baked geometry.
Replace the sample directory below with the printed path. Check representative
frames before rendering a complete movie:

```sh
blender -b --factory-startup --python-exit-code 2 --python tools/blender/render.py -- --recipe overflow --work .blender-cache/overflow-abc123 --stills 35,100,180,260
blender -b --factory-startup --python-exit-code 2 --python tools/blender/render.py -- --recipe overflow --work .blender-cache/overflow-abc123
python3 tools/blender/publish-frames.py .blender-cache/overflow-abc123 assets/fluid/overflow --replace
bash video/build.sh examples/fluid-overflow.html
```

Stills go to `stills-final/` and do not create a completed-render receipt. To change
only mesh reconstruction, run `finish-mesh.py` on the retained work directory, then
rerun `inspect-bake.py` and the render/publication sequence. It invalidates old
inspection and render receipts because the geometry changed.

The same sequence resumes a failed render when its bake and simulation proof are
complete. It rerenders the entire sequence so a partial render cannot mix frames.
If inspection was interrupted, first run
`blender -b --factory-startup --python-exit-code 2 --python tools/blender/inspect-bake.py -- .blender-cache/overflow-abc123`.
An incomplete bake must be rebuilt. Changing the recipe source also requires a new bake:
the publisher rejects old receipts whose scene-source hash no longer matches.

## Verification boundary

Bake and render receipts record Blender version, settings and the source-script
hashes. Final simulation resolution is defined in the selected recipe source; inspection records the actual saved domain resolution and image dimensions, and publication checks that evidence rather than maintaining a second recipe table. `simulation-proof.json` samples actual generated geometry or smoke density.
The frame manifest hashes the published images and versions frame URLs by their combined fingerprint, so a replacement cannot reuse old cached images. The normal browser recorder then
renders and compares every final composite frame on independent browser instances,
and checks video/audio delivery. It does **not** perform a second independent fluid
simulation or claim pixel-identical rebakes across Blender versions or hardware.

Intro embeds only selected shots. Rebuild the intro after changing a shared plate;
also regenerate each changed film's MP4, GIF and poster as one bundle.
