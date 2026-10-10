# Original studio assets and effect factories

The courier artwork, twenty poster treatments, Amber/Teal fighter geometry and 4.8-second
skeletal fight excerpt are original procedural assets. No reference-post images,
characters, downloaded motion capture, generated-human footage or external music
are bundled. The results demonstrate the techniques, not a shot-for-shot copy of
the reference videos. The code and original assets use the repository's 0BSD licence.

Technique references: [the art-direction journey](https://www.threads.com/@ai_cpocoder/post/Dd_nuqND8R-)
and [the dot-animation study](https://www.threads.com/@more.yu_/post/DeBkaXOE6y6).

## Effect catalogue

The table lists factory IDs: pass these bare IDs to `FXStudio.create()` or `FXStudio.preview()`. Gallery registrations and `data-demo` attributes add the `studio-` prefix; for example, `FXStudio.create("video-dots")` corresponds to `data-demo="studio-video-dots"`. The main gallery groups
variants inside technique cards and puts collections in a separate showcase
section; [the catalogue](../../fx/catalog.js) defines that relationship. Twenty art
directions are presets of `themes`, not twenty additional techniques.

| ID | Film effect | Implementation |
|---|---|---|
| `flight` | Flying courier and cape | Shared pose with layered limbs and a deforming cape |
| `portal` | Cross-frame style portal | One pose clipped into independently styled panels |
| `themes` | Twenty art directions | Typography, motifs, material texture and figure treatment |
| `gallery` | Art-gallery camera journey | Layout/scale interpolation, tracked horizontal travel, pull-out |
| `lowpoly` | Low-poly flight course | Actual 3D city geometry and perspective rings |
| `video-dots` | Video to animated dots | Deterministic RGBA frame sampling and luminance-dependent dot radius |
| `dot-rhythm` | Beat-driven dot styles | Palette and spacing changes every 0.3 s at 100 BPM |
| `dot-impact` | Dot impact and recovery | Compression, seeded offsets and a short recovery envelope |
| `echo` | Colored temporal echoes | Five distinct earlier source frames, not RGB channel splitting |
| `time-remap` | Source-time remapping | Normal, ramp/hold, reverse, stepped source clocks |
| `depth-dots` | 2.5D dot relief | Shallow luminance-derived depth or a supplied depth image |
| `skin-cloud` | Animated skinned point cloud | 16,000 stable barycentric samples attached to animated GLB geometry |
| `freeze-orbit` | Frozen action, moving camera | Hold the real 3D pose; orbit the camera through 360 degrees |
| `particle-lens` | Particle rush and depth of field | Geometry-bound scatter and depth-dependent soft point sprites |

The twenty treatments are petroglyph, tomb painting, mosaic, stained glass,
illuminated initial, proportion study, silhouette, ukiyo-e, cross-stitch,
strongman bill, constructivism, art deco, golden-age comic, neon, silkscreen,
line printer, handheld pixels, low poly, stencil, and embroidered patch.
They are stylised procedural interpretations, not automatic historical-style
transfer for arbitrary photographs.

The dot conversion, temporal echoes, impact, time remapping and relief sample the
same newly rendered fight excerpt. The skin, orbit and lens demos use the actual
3D Amber/Teal geometry. The original orbit comparison holds the block at 0.6 s; lens particles leave
the kick contact while most of the figure remains intact. Every effect keeps its
own operation instead of replaying the finished fight film.

## Reproduce the assets and films

```sh
npm ci
npx playwright install chromium
npm run build:studio-assets
npm run build:studio
bash video/build.sh video/intro.html
```

The asset command exports `fighter.glb` with two skinned fighters and separate
Amber/Teal animation clips, baked from `createChoreography()` in `battle.js`. It
renders `examples/fight-source.html` twice at 24 fps, encodes `fight-source.mp4`,
and imports it into `fight/frame-*.png` plus `fight/manifest.json`. The shipped
frames are small enough to check in; a normal film rebuild can reuse them.
`build:studio` delivers the 40.8-second art-direction film, the 19.2-second
COUNTERFORM fight and a 38.4-second eight-treatment comparison, with sound, posters
and GIFs. Use `npm run render:fight-effects` for the comparison alone. The fight uses a separate original
2D illustrated rig in `fx/studio/battle.js`: anticipation, attack, contact holds,
recoil, kicks and counterattacks. Its short held shot is a 2D camera push. The dedicated
`freeze-orbit` technique remains a true orbit around animated GLB geometry.
`build:showcase` also rebuilds the earlier films and the main intro.

The asset tool uses Three.js r180 GLTFExporter and BufferGeometryUtils; playback
uses GLTFLoader, SkeletonUtils and AnimationMixer. These are existing Three.js
add-ons/core facilities, not a new rendering framework. Blender, AE and a depth
estimation model are not required by these examples.

## Use your own footage

```sh
python3 video/import-clip.py input.mp4 assets/my-clip --fps 24 --width 640 --height 360
# For an evenly lit green background, add: --key 0x00ff00
# Use --replace only when intentionally rebuilding an existing frame directory.
```

Import completes in a temporary sibling directory before replacing a prior
sequence. Its manifest records dimensions, frame rate, count and source hash.
Alpha is preserved, or produced by chroma key and despill. A decoded frame cache
is bounded; seeking backward does not depend on the last decoded frame.

With the r180 import map from `examples/studio.html` and `fx/studio-effects.js`:

```js
const effect = await FXStudio.create('video-dots', {
  sourceUrl: '/assets/my-clip/manifest.json'
});
stage.appendChild(effect.canvas);
await effect.frame(1.2);
```

Imported frames are normalized to a 640×360 sampling grid. The built-in source
loops at 4.8 s; custom sources default to their manifest duration, or accept an
explicit `loopDuration`. `FrameSource` and `PointField` can also be used directly.
For `themes`, pass `{theme: 0..19}` to `frame`; for `time-remap`, pass
`{timeMode: 'normal'|'ramp'|'reverse'|'steps'}`. `depth-dots` accepts a decoded
grayscale image as `{depthFrame}`; absent one it uses a labeled luminance relief.
The three 3D point effects also accept `{modelUrl}` at creation, for an
uncompressed GLB with a skinned mesh and at least one animation clip. Normalize
custom models to the original metre-scale duel scene. For ordinary custom GLBs the
first clip is used. The bundled Counterform model selects Amber/Teal clips and
the matching mesh, preserving their authored world positions;
point colors come from vertex/material colors, rather than texture UV sampling.

## Six reusable capabilities

- `frame-source.js` + `video/import-clip.py`: indexed footage, alpha and bounded decode cache.
- `themes.js`: shared-pose art-direction treatments, motifs and typography.
- `point-field.js`: deterministic screen-grid identity, color and visibility.
- `time.js`: independent source clocks, seeded randomness, beat/hit envelopes.
- `scene.js`: animated GLB loading and stable, skin-aware surface samples.
- `scene.js` point material: camera-relative point size, focus and soft bokeh.

The 2.5D relief does not infer hidden anatomy. True orbit uses the actual 3D
fighters, including their unseen sides and backs. Surface samples retain their triangle
and barycentric coordinates as the skin moves; they are not randomly regenerated
each frame. Impact times are authored cues, not an automatic collision detector.
Depth of field is an art-directed point-sprite approximation, not a physical lens
solver. Every exported frame remains a function of time and fixed input assets.

## Read the short studies as comparisons

The gallery uses `FXStudio.preview(id)` for the nine dot-related study IDs
(including the palette/spacing variant). It returns the same awaited
`{canvas, frame(t), proof()}` contract, but places a reference beside the effect.
`FXStudio.create(id)` still returns the raw reusable output for authored films.
The [studio player](../../examples/studio.html?compare=1#video-dots) can switch
between these presentations. `fx/studio/study-preview.js` owns the comparison
layout and source-time selections; it is not an additional effect registration.

| Study | What the viewer compares | Why it is a separate operation |
|---|---|---|
| Footage dots | Colour footage / dot rendering of the same frame | Samples 2D pixels into dots |
| Dot rhythm | Original footage / beat-controlled dots | A variant of footage dots, not a new family |
| Temporal echoes | One dot frame / several earlier dot frames | Layers different source times |
| Dot impact | Unchanged / deformed contact region | Local compression, scattering and recovery; shown in slow close-up |
| Time remapping | Normal / remapped source clock | Changes playback time without changing the drawing method |
| Image relief | Held image / angled shallow dot surface | Brightness produces 2.5D depth, not hidden anatomy |
| Skinned points | Solid rig / sampled surface of that rig | Points stay attached to real animated geometry |
| Frozen orbit | Fixed / orbiting camera on the same held pose | Camera time advances while pose time holds |
| Particle lens | Sharp / scattered soft points with identical camera and pose | Changes spatial scatter and depth-dependent focus |

The long **Same Fight, Eight Treatments** comparison runs for 38.4 seconds:
eight chapters of 4.8 seconds, using the same comparison factory as the gallery.
It excludes the dot-rhythm variant and demonstrates ramp/hold in the time-remap
chapter; the short study also cycles through normal, reverse and stepped playback.
It deliberately reuses COUNTERFORM choreography. COUNTERFORM itself remains the
19.2-second authored fight film, rather than a catalogue of processing methods.

## Signal-driven studies

The additional [signal studies](../../fx/signals/README.md) reuse these assets.
`audio-relief` and `motion-fragments` measure the indexed RGBA footage; the cinematic
`freeze-orbit` variation holds the real rig at a kick (3.2 s) and block (0.6 s),
with camera and lighting on independent clocks. The original studio factory and
its input/effect comparison remain available.

After regenerating the fight footage, rebuild `assets/signals` with
`tools/signals/build.py --replace` in the documented analysis environment, then
run `npm run render:signal-films` and rebuild the intro. The measured cache is a
self-contained snapshot of its recorded source; it does not silently follow later
changes to the original frames.
