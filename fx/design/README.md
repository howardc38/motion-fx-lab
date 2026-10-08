# Spatial type, surface ink and connected motion

These studies use the existing Three.js r180, Canvas 2D and GLSL. No additional
runtime library, external artwork, video or model is needed.

## Films

| Film | Timeline | Story |
|---|---:|---|
| [One dot. Many roles.](../../examples/dot-story.html) | 19.2 s | Toggle → letter → spring trace → shape → spatial type → dot reveal → title → return to toggle. |
| [One block. A drawn city.](../../examples/ink-city.html) | 19.2 s | Shaded block → surface ink → growing city → camera flight → wide closing view. |
| [One light. Different edges.](../../examples/shadow-lab.html) | 9.6 s | Enlarge the emitter, then raise the occluder; compare shadow edge width. |

The first two are composed sequences. The third is a single-effect render.
None is an extra technique. The catalogue adds three families and three variants:

| Family / variant | Module | Editable controls |
|---|---|---|
| Spatial type (`design-type-orbit`) | `orbit.js` | `wrap`, `spin`, `scale`, `dot`, `labels`. Edit `message` for the ring lettering. Glyph spacing comes from measured advance widths. |
| Soft-shadow study (`design-soft-shadow`) | `lighting.js` | `lightSize` .02–4, `height` .59–2, `lightHeight` 3–8, `labels`. |
| Surface hatching (`design-surface-ink`) | `ink.js` | `objectAngle`, `cameraAngle`, `lightAngle`, `strength`, `frequency`, `labels`. |
| Letter reflow (variant of `chars`) | `flat.js` | Edit `letterLayout` and `drawLetters` for the word and its entry paths. The supplied dotless-i treatment is authored for “Motion”. |
| Spring response (variant of `timing`) | `flat.js`, `math.js` | `damping` in (0,1]. `springPoint` owns the dot/curve sampling; `drawSpring` also accepts frequency, bounds and duration. |
| Radial dot reveal (variant of `wipe`) | `flat.js` | `progress`, `from`, `to`, `center`, `labels`; `from` and `to` are canvas-compatible image sources. |

## Editing and rendering

`design-effects.js` owns gallery metadata and module loading; `pack-design.js`
adapts it to the gallery. `films.js` owns film durations, poster/GIF windows,
cues and choreography. `player.js` owns playback, seeking and recorder hooks.
`ink.js:createCity` owns the city camera and layout. Film copy lives in those
source modules, not in the player controls.

```js
const effect = await FXDesign.create('soft-shadow');
effect.frame(2.4, {lightSize: 2.8, height: 1.4, labels: false});
// Use effect.canvas as a 1280 × 720 frame.
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

The build creates sound-enabled MP4s, still posters and silent GIF selections.
HTML timeline previews are silent. Every exported frame is rendered in two
independent browser passes and compared before delivery.

## What the shaders actually do

- **Type:** flat glyph planes occupy a three-dimensional ring. Perspective and
  front/back depth shading provide the spatial treatment; letters are not
  extruded solids.
- **Shadow:** 64 fixed samples on a horizontal rectangular emitter test analytic
  ray–sphere intersections at each ground pixel. Source size and separation
  change visibility and penumbra. This is a geometry-based shadow study, not a
  general lighting solver: only the sphere occludes the ground; sphere shading
  uses a point-light approximation. Finite sample bands may appear at close range.
- **Ink:** triplanar object coordinates attach the marks to surfaces. Transformed
  normals and light direction vary mark density. It is separate from the repo's
  screen-space halftone/ASCII/poster filters. It does not add global illumination
  or cast shadows to the city. `debugPattern` fixes density for attachment tests.

The direction was inspired by the motion sequence in
[@ai.finds_daily's post](https://www.threads.com/@ai.finds_daily/post/DeM1yjVkiHR)
and the ink/lighting examples in
[@__laochen's post](https://www.threads.com/@__laochen/post/DeMxZIVE-__). The lettering,
city, timings, shaders and synthesized soundtrack here are original code; no
reference footage or assets are bundled.
