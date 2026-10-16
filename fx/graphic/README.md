# Graphic motion: type, fields and patterns

Four independent operations extend the catalogue. Seven additional demonstrations
are variants of existing effects, not seven more effect families.

| Operation | Gallery id | Film |
|---|---|---|
| Attract and recover a dot lattice; send a wave through its points | `graphic-field` | [Pull. Warp. Return.](../../examples/graphic-field.html) |
| Move a fill inside a fixed glyph silhouette | `graphic-fill` | [Inside the letters.](../../examples/graphic-fill.html) |
| Connect particles below a distance threshold | `graphic-network` | [Near enough to connect.](../../examples/graphic-network.html) |
| Extend a glyph into a flat graphic shadow | `graphic-shadow` | [A different kind of depth.](../../examples/graphic-shadow.html) |

Each is a 9.6-second effect film, played from its effect card. The
[33.6-second extension sampler](../../examples/graphic-extensions.html) gives each
variant its own segment inside the corresponding existing card:

| Segment | Variant | Parent |
|---|---|---|
| 0–4.8 s | `graphic-flap`: split-flap letters | `cardflip` |
| 4.8–9.6 s | `graphic-reels`: carrying digits and braking word reels | `count` (Motion basics) |
| 9.6–14.4 s | `graphic-bands`: scrolling, vertical and crossed type | `chars` (Motion basics) |
| 14.4–21.6 s | `graphic-spatial`: cylinder, word tunnel and corridor | `design-type-orbit` |
| 21.6–26.4 s | `graphic-tiles`: fill, row shifts and triangular tiles | `rhythm` |
| 26.4–30 s | `graphic-led`: sampled LED lettering | `studio-video-dots` |
| 30–33.6 s | `graphic-echo`: lettering at five source times | `studio-echo` |

## Use and edit

No new runtime dependency is needed: Canvas 2D and the existing pinned three.js
r180 suffice. Latin capitals, digits and the supported CJK characters use the
existing bundled vector outlines in `assets/type/`, with its retained OFL notice.
Finished films are 1920×1080 at 60 fps with synthesised sound.
The HTML timeline is a silent visual preview.

```js
import {create} from './app.js';
const effect = await create('graphic-fill', {width:1920, height:1080});
host.append(effect.canvas);
effect.frame(4.8, {text:'流動', mode:'liquid', strength:.8, labels:false});
console.log(effect.proof());
```

Call `frame(seconds, options)` at any nonnegative time, in any order. There is no
accumulated simulation or previous-frame buffer. The field's `strength:0` removes
displacement; its `radius` controls the falloff. `graphic-network` takes `threshold`
in logical 1280×720 pixels. `graphic-shadow` takes `angle` in radians, `length` in
logical pixels and `text`. `graphic-fill` takes `mode: stripe | liquid | split`;
`fill` sets the liquid level from 0 to 1. All support `labels:false`.

Variants accept `mode` where appropriate: reels `letters | digits`, bands
`scroll | vertical | cross`, spatial `cylinder | tunnel | corridor`, tiles
`fill | shift | triangle`. LED takes `text` and `spacing`; echoes take `text`
and a `delay` multiplier. Film preview controls retain the chosen setting during
Play; recording always renders the authored film timeline.

The lattice is an analytic deformation, not a force-integrated physical
simulation. The dot floor has projected three-dimensional positions. The three
spatial text scenes use real three.js geometry, perspective and depth testing.
The glyph's liquid is a two-dimensional animated mask, not Mantaflow. The graphic
shadow is a deliberately flat silhouette extrusion, not a physical cast shadow.
These distinctions are intentional and are kept in the catalogue copy.

```sh
node tools/films.cjs build graphic
npx playwright test tests/graphic.spec.cjs
npm run sync:fx
npm run sync:films
```

`common.js` owns glyph paths, colours and shared drawing; `fields.js` owns the
lattice and distance graph; `type.js` owns flat type treatments; `tiles.js` owns
the seeded pattern; `spatial.js` owns the 3D scenes; `app.js` owns the study and
sampler timing; `player.js` provides the recorder contract. Film metadata and
publication placement belong only to `examples/films.json`.

The visual research is the author's [40 text treatments](https://www.threads.com/@ai_yunon_ai/post/DeihhttDe26)
and [40 backgrounds](https://www.threads.com/@ai_yunon_ai/post/DejRnDMAeNJ).
The compositions, animation, geometry and sound here are newly authored; no
reference footage, music, prompts or source code is bundled.
