# Material and scene studies

Load the three.js r180 import map from `examples/water-forms.html`, then
`fx/material-effects.js`. `await FXMaterial.create(id)` returns
`{canvas, frame(t, options), proof()}`. The gallery adapter is `fx/pack-materials.js`.
All canvases are 1280 × 720. Times are seconds; negative times clamp to zero and
nonfinite values fail. The gallery restarts water previews after eight seconds; direct factory calls allow
continuous camera motion and are not promised to be seamless loops. The room
showcase closes on its eighth treatment at 24 seconds.

| ID | Options | Notes |
|---|---|---|
| `water-material`, `water-morph`, `water-impact`, `water-underwater` | `labels: false` | Authored geometry, not volume-fluid simulation. The 3D renderer is shared and copies each result to its own canvas. |
| `cjk-solid` | `text: '光影'`, `labels: false` | 1–12 supported characters. Missing outlines fail explicitly. See `assets/type/README.md`. |
| `organic-contours` | `strength`, `labels: false` | Nested closed parametric curves, not measured topographic data. |
| `frame-glitch` | `source: canvasOrImage`, `strength: 0..1`, `labels: false` | Supply a loaded, origin-clean image or canvas; the input is not modified. Resize/crop to the intended output composition first. |
| `scene-eras` | `style: 0..7` | Override art treatment while retaining the same source time. |

The water and solid-text modules share one WebGL renderer. The Canvas studies
share no drawing state with one another. `frame(t)` derives pose, geometry and
marks from time, so backward seeks require no hidden simulation warm-up.

## Film timelines

`timelines.js` owns chapter boundaries, duration and cut cues; edit chapter durations there.
`films.js` exports factories reused by `material-player.js` and the intro.
HTML entrypoints own text, poster selection and GIF excerpts; keep excerpts within the timeline.

| Film | Time | Shot |
|---|---|---|
| Water, 21.6 s | 0–5.4 | Fall, crown, rebound and travelling ripples |
| | 5.4–13.4 | Sphere → block → ring → separate drops → sphere |
| | 13.4–16.2 | Light and a curved ribbon through a transparent sphere |
| | 16.2–21.6 | Descend through the water surface, bubbles and projected light |
| Word, 21.6 s | 0–5.4 | Solid bevelled Chinese lettering turns in space |
| | 5.4–9 | Strokes scatter into particles and return |
| | 9–12.6 | Moving coloured contours fill the same glyphs |
| | 12.6–15.6 | Whole-frame channel offsets, block shifts and scan tears |
| | 15.6–19.2 | Particles gather and settle into the word |
| | 19.2–21.6 | Clean, readable word holds |
| Room, 24 s | Eight 3 s shots | Ochre wall, painted papyrus, tesserae, woodblock, small brush strokes, geometric planes, comic and neon |

The room has a continuous six-second cup-lifting action across style wipes.
Art names describe original treatments inspired by visual traditions, not exact
historical reconstructions. The intro keeps its 55.2-second timeline, selects audio-driven relief, motion-driven fragments, spatial type and volumetric smoke in its montage, and samples the complete word film
at 3× speed.

Use `npm run build:materials` for all three bundles, or pass one HTML file to
`video/build.sh`. Each declares audio cues, music, poster time and GIF excerpts.
