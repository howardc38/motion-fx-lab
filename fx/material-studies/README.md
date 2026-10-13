# Material and scene studies

Load the three.js r180 import map from `examples/water-forms.html`, then
`fx/material-effects.js`. `await FXMaterial.create(id)` returns
`{canvas, frame(t, options), proof()}`. The gallery adapter is `fx/pack-materials.js`.
All canvases are 1280 × 720. Times are seconds; negative times clamp to zero and
nonfinite values fail. The impact study loops every four seconds and the other water
studies every eight; direct factory calls allow continuous camera motion. The room
showcase closes on its eighth treatment at 24 seconds.

| ID | Options | Notes |
|---|---|---|
| `water-material` | `labels: false` | A water ball in front of a painted stripe board on a seamless studio sweep. The ball works as a lens: the stripes inside it are magnified and reversed. Its shadow carries a focused caustic. |
| `water-morph` | `labels: false` | Sphere → block → ring → droplets in front of the same stripe board, so the refraction is visible. |
| `water-impact` | `labels: false` | Four-second loop: drop, crown with tip droplets (about 40% of the frame), Worthington jet, pinched drop, secondary splash, ripples. |
| `water-underwater` | `labels: false` | A drop lands, the camera dives: bubbles, light shafts, a caustic floor and the underside of the surface. Fog and sky share one colour function, so there is no band between floor and surface. |
| `cjk-solid` | `text: '光影'` or `'MAKE IT'`, `labels: false` | Gallery mode `reveal`: the flat word spins once while its extrusion punches out of the face with an overshoot and a camera kick; then a band of light sweeps across. Supported: `流動光影文字世界水形態設計`, A–Z, 0–9, full stop and space. Missing outlines fail explicitly. See `assets/type/README.md`. `create()` without a mode keeps the original turntable used by the word film. |
| `organic-contours` | `strength`, `labels: false` | Nested closed parametric curves, not measured topographic data. |
| `frame-glitch` | `source: canvasOrImage`, `strength: 0..1`, `labels: false` | Supply a loaded, origin-clean image or canvas; the input is not modified. Resize/crop to the intended output composition first. |
| `scene-eras` | `style: 0..7` | Override art treatment while retaining the same source time. |

`water-kit.js` holds the shared parts: water material, the painted studio and product
environments (PMREM), sky and underwater domes whose colour also drives the fog, the
caustic shader, crown, jet, polar water surface, bubbles, the bottle profile and its
signed distance, the MarchingCubes wrapper and extruded brand letters. Everything is
authored geometry driven by time; none of it is a fluid solver.

The water studies and the solid lettering share one WebGL renderer. The Canvas studies
share no drawing state with one another. `frame(t)` derives pose, geometry and marks
from time, so backward seeks require no hidden simulation warm-up.

## Film timelines

`timelines.js` owns chapter boundaries, duration, cut cues and (for the advert) its own
sound cues and music sections. `films.js` exports factories reused by
`material-player.js` and the intro. HTML entrypoints own the format, poster selection and,
for a film with a home-page card, the `preview` excerpts of its silent card loop; keep excerpts within the timeline.

### Clear (page `water-forms`, 15 s, 16:9 and 9:16)

A drinks advert for a fictional brand. Edit `BRAND` at the top of `clear.js`: the name,
tagline, detail line, call to action and the three supers. The name also drives the 3D
letters behind the bottle and the bottle label. `examples/water-forms.html` renders
1280 × 720; `examples/water-forms-vertical.html` renders the same film at 720 × 1280
(`materialFilm.format`). Camera framing is written as a box to fit, so both formats
come from one choreography.

| Time | Chapter | Library study | What happens |
|---|---|---|---|
| 0–0.8 | drop | `water-impact` | Backlit drop falls toward the surface |
| 0.8–2.0 | crown | `water-impact` | Crown splash at half speed |
| 2.0–4.5 | form | `water-morph` | The rebound jet and spiralling droplets (metaballs) fill the shape of a bottle from the bottom up |
| 4.5–7.5 | glass | `water-material` | The liquid becomes a glass bottle; the brand letters rise behind it and are bent by the glass; a highlight sweeps across |
| 7.5–10.5 | dive | `water-underwater` | The bottle plunges; bubbles, light shafts and a caustic floor |
| 10.5–12.5 | rise | `water-underwater` | It breaks the surface; the brand name rises out of a waterline |
| 12.5–15 | endcard | — | Tagline, detail line and call-to-action sticker |

### Word and room

| Film | Time | Shot |
|---|---|---|
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

Use `npm run build:materials` for the bundles, or pass one HTML file to
`video/build.sh`. Each declares audio cues, music, poster time and, if it has a card, card-loop excerpts.
