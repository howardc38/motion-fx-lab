# Spatial type, surface ink and connected motion

These studies use the existing Three.js r180, Canvas 2D and GLSL. No additional
runtime library, external artwork, video or model is needed.

## Films

**Spark / Form** is a finished demo film, not a new technique family. Its source is
[`../spark-form.js`](../spark-form.js), played by [`examples/spark-form.html`](../../examples/spark-form.html).
An authored ember draws the construction lettering, the camera enters its O, and the paper scene
actually calls `material-studies/type.js` in `engraved` mode with the existing `inkMaterial` from
`design/ink.js`. The catalogue links therefore name solid lettering and surface hatching. The
hand-drawn reveal and corridor are authored transitions; related gallery capabilities are marked
as related rather than claimed to run. The 16.8-second film renders at 60 fps, has its own original
score, and publishes an MP4 card loop rather than another GIF.

The four-letter word and O counter are part of this composition. To change them, update the
letter outline source, the `text:'FORM'` solid-word call, the end card, and the dive's `focus` point;
other word lengths need a layout pass. Edit drawing/camera timing in `blueprint`, `portal` and
`solid`; it remains a pure function of time. Optional score regeneration is documented by
`tools/spark-form/make-score.py` and its pinned requirements. Build with
`node tools/films.cjs build spark-form`.

| Film | Timeline | Story |
|---|---:|---|
| [One dot. Many roles.](../../examples/dot-story.html) | 14.1 s | Toggle → letter (with a ripple) → a 1.2 s spring trace → shape → spatial type → dot reveal → title held 1.5 s → return to toggle. |
| [One block. A drawn city.](../../examples/ink-city.html) | 12 s | The city grows from the first second → drop to street level → fly the street with sky above and road below → bank round the far corner → wide view. |
| [One light. Different edges.](../../examples/shadow-lab.html) | 9.6 s | Enlarge the emitter, then raise the occluder; compare shadow edge width. |

The first two are composed sequences. The third is a single-effect render.
None is an extra technique. The catalogue adds two effect families, one Motion basic (the soft-shadow study, a lighting
fundamental listed with the basics and not counted as an effect) and two variants:

| Family / variant | Module | Editable controls |
|---|---|---|
| Spatial type (`design-type-orbit`) | `orbit.js` | `wrap`, `spin`, `scale`, `dot`, `fly`, `curl`, `labels`; with `curl` (the gallery default) the line rolls up into the ring along arcs, so letters never cross; films pass `fly: false` and keep the straight blend; `create({message})` sets the ring lettering (default `MAKE IT MOVE`). The gallery camera flies through the ring's centre; `fly: false` keeps the fixed film view. Edge rim light; the far side of the ring is hazed and blurred. |
| Soft-shadow study (`design-soft-shadow`) | `lighting.js` | `lightSize` .02–4 (a bare spotlight at the small end, a four-pane window at the large end), `height` .59–2 for the floating ball, `lightHeight` 3–8, `labels`. |
| Surface hatching (`design-surface-ink`) | `ink.js` | `objectAngle`, `cameraAngle`, `lightAngle` (moves the visible lamp), `strength`, `frequency`, `debugPattern` (fixed density, lamp hidden), `labels`. The subject is a turned vase with an ink outline. |
| Letter reflow (variant of `chars`) | `flat.js` | Edit `letterLayout` and `drawLetters` for the word, its entry paths, `exit` (letters lift away in turn) and `wave`. The supplied dotless-i treatment is authored for “Motion”. |
| Radial dot reveal (variant of `wipe`) | `flat.js` | `progress`, `from`, `to`, `center`, `labels`; `from` and `to` are canvas-compatible image sources. The gallery loop turns a night landscape into day and back. |

The spring-response variant was retired from the gallery. `springPoint` and
`drawSpring` stay in `flat.js` because the dot film still draws its curve with them.

## Editing and rendering

`design-effects.js` owns gallery metadata and module loading; `pack-design.js`
adapts it to the gallery. `films.js` owns film durations, poster times, card-loop windows (`preview`, for films with a card),
cues and choreography. `player.js` owns playback, seeking and recorder hooks.
`ink.js:createCity` owns the city camera and layout. Film copy lives in those
source modules, not in the player controls.

```js
const effect = await FXDesign.create('soft-shadow');
effect.frame(2.4, {lightSize: 2.8, height: 1.4, labels: false});
// Use effect.canvas as a 1280 × 720 frame.
const ring = await FXDesign.create('type-orbit', {message: 'YOUR WORDS HERE · '});
// The second argument reaches the module's own create(); type-orbit takes the ring's words.
```

On a standalone module page, import `create` from the specific module and use the
same `frame(seconds, options)` interface. Include the Three.js import map from
one of the example HTML pages. Each instance owns its output canvas; the shared
renderer completes one render before copying pixels. There is no simulation
history to reset when seeking backwards.

```sh
npm run render:design-films
npx playwright test tests/design.spec.cjs
```

The build creates sound-enabled MP4s, still posters and, for films with a home-page card, a silent card loop.
HTML timeline previews are silent. Every exported frame is rendered in two
independent browser passes and compared before delivery.

## What the shaders actually do

- **Type:** flat glyph planes occupy a three-dimensional ring. Perspective,
  a rim light sampled from the glyph's own edge, and haze plus mip blur on the far
  side provide the spatial treatment; letters are not extruded solids.
- **Shadow:** 100 stratified samples on a horizontal rectangular emitter test analytic
  ray–sphere intersections at each ground pixel; a fixed per-pixel offset inside each
  cell turns sample bands into fine grain. Source size and separation change
  visibility and penumbra (edge about 1 px for the spotlight, over 60 px for the
  window). This is a geometry-based shadow study, not a general lighting solver: only
  the sphere occludes the ground; sphere shading uses a point-light approximation.
- **Ink:** triplanar object coordinates attach the marks to surfaces. Transformed
  normals and light direction vary mark density. It is separate from the repo's
  screen-space halftone/ASCII/poster filters. It does not add global illumination
  or cast shadows to the city. `debugPattern` fixes density for attachment tests.

The lettering, city, timings, shaders and synthesised soundtrack are authored in this repository.
