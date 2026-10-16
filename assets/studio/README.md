# Original studio assets and effect factories

The courier artwork, twenty poster treatments, Amber/Teal fighter geometry and 4.8-second
skeletal fight excerpt are original procedural assets. The code and original assets use
the repository's 0BSD licence.

## Effect catalogue

The table lists factory IDs: pass these bare IDs to `FXStudio.create()` or `FXStudio.preview()`. Gallery registrations and `data-demo` attributes add the `studio-` prefix; for example, `FXStudio.create("video-dots")` corresponds to `data-demo="studio-video-dots"`. [The catalogue](../../fx/catalog.js) decides which IDs are effects, which are variants inside another effect's card, and which are presets in the site's Comparisons section. Twenty art directions are presets of `themes`, not twenty more effects.

Gallery cards show the raw effect from `FXStudio.create(id)`. The 2D effects use the public Apricot (cat) and Milo (explorer robot) characters from `fx/character`, drawn by `rig-gl.js`; the 3D effects use Juno, an original procedural dancer (`figure.js`). The input / effect comparisons on the COUNTERFORM fight come from `FXStudio.preview(id)` (see below), and the footage or GLB treatments from `FXStudio.create(id, {legacy | sourceUrl | modelUrl})`.

| ID | On the site | Subject | What it does |
|---|---|---|---|
| `portal` | Effect: Cross-frame style portal | Courier | Slanted panels with no gaps, each in its own art direction; the courier crosses a seam and is drawn in two styles at once |
| `themes` | Preset: Twenty art directions | Courier | Typography, motifs, material texture and figure treatment of one flying courier |
| `gallery` | Preset: Art-gallery camera journey | Courier | Overview, a tracked flight across twenty artworks and a closing overview |
| `lowpoly` | Effect: Low-poly flight course | Paper glider | A sunset city canyon with fog, lit windows, flashing gates, speed lines, banking and an FOV kick |
| `video-dots` | Effect: Image and footage halftone dots | Apricot | A hard moving key light turns the cat into a two-ink halftone; dot size follows brightness and the palette changes on every beat |
| `dot-rhythm` | Variant of `video-dots` | Milo | Every half beat cuts dot pitch, dot shape, palette and framing at 100 BPM |
| `dot-impact` | Variant of Motion shatter and reassemble (`signal-motion-fragments`) | Milo | A ball hits; dots near the contact compress, scatter and ripple outward, then settle |
| `echo` | Effect: Time echoes and speed ramps | Apricot | The pounce runs through normal, slow, hold, reverse and ramp; echoes of real earlier frames grow, fan out and retract |
| `time-remap` | Variant of `echo` | Apricot | Only the source clock changes, with a graph of output time against source time and a six-step mode |
| `depth-dots` | Effect: Image relief | Milo | Shallow depth from silhouette and brightness; drum hits push the relief out, silent bars stay flat |
| `skin-cloud` | Effect: Skinned point cloud | Juno | A scan line turns the solid dancer into surface points that follow her limbs; on the slam they rush the lens as bokeh, then reassemble |
| `particle-lens` | Variant of `skin-cloud` | Juno | Surface points stream towards the lens while focus racks between the stream and the body |
| `freeze-orbit` | Effect: Freeze frame and camera orbit | Juno | The slam is held as the floor breaks; debris, dust and shock ring stop while the camera travels 230° round real 3D geometry, then time resumes |

`FXStudio.create("flight")` still works and returns `themes`: the flying courier lives in the art directions.

The twenty treatments are petroglyph, tomb painting, mosaic, stained glass,
illuminated initial, proportion study, silhouette, ukiyo-e, cross-stitch,
strongman bill, constructivism, art deco, golden-age comic, neon, silkscreen,
line printer, handheld pixels, low poly, stencil, and embroidered patch.
They are stylised procedural interpretations, not automatic historical-style
transfer for arbitrary photographs.

In the comparisons and the footage treatments, the dot conversion, temporal echoes, impact,
time remapping and relief sample the rendered fight excerpt, and the skin, orbit and lens
treatments use the actual 3D Amber/Teal geometry. The orbit comparison holds the block at 0.6 s;
lens particles leave the kick contact while most of the figure remains intact. Every effect
keeps its own operation instead of replaying the finished fight film.

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
`build:studio` delivers the 40.8-second art-direction film, the 19.8-second
COUNTERFORM fight and a 38.4-second eight-treatment comparison, with sound, posters
and the silent card loops. Use `npm run render:fight-effects` for the comparison alone. The fight uses a separate original
2D illustrated rig in `fx/studio/battle.js`: anticipation, attack, contact holds,
recoil, kicks and counterattacks. At 12.0–13.2 s story time stops and the camera circles
the fighters as a 3D point cloud (`fx/signals/orbit.js`, the `signal-freeze-orbit` variant).
The dedicated `freeze-orbit` effect remains a true orbit around animated 3D geometry.
`build:showcase` also rebuilds the other effect films and the main intro.

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

## Input / effect comparisons

`FXStudio.preview(id)` returns the same awaited `{canvas, frame(t), proof()}` contract
as `create`, but places a reference from the COUNTERFORM fight beside the effect, for the
nine dot-related IDs (including the palette/spacing variant). The gallery cards show the raw
effect; the [studio player](../../examples/studio.html?compare=1#video-dots) switches
between the two presentations, and each card links to its comparison.
`fx/studio/study-preview.js` owns the comparison layout and source-time selections; it is
not an additional effect registration.

| ID | What the viewer compares | Why it is a separate operation |
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
eight chapters of 4.8 seconds, using the same comparison factory as the studio player.
It excludes the dot-rhythm variant and demonstrates ramp/hold in the time-remap
chapter; the short comparison also cycles through normal, reverse and stepped playback.
It deliberately reuses COUNTERFORM choreography. COUNTERFORM itself remains the
19.8-second authored fight film, rather than a catalogue of processing methods.

## Signal-driven variants

The [signal-driven effects](../../fx/signals/README.md) measure their own sources:
`signal-motion-fragments` (Apricot) and `signal-audio-relief` (Milo) have their own
measured bundles, while the cinematic `signal-freeze-orbit` variant reuses this fight
footage and rig, holding a kick (3.2 s) and a block (0.6 s) with camera and lighting on
independent clocks. COUNTERFORM's freeze-orbit climax uses the same orbit module.

After regenerating the fight footage, rebuild `assets/signals` with
`tools/signals/build.py --replace` in the documented analysis environment, then
run `npm run render:signal-films` and rebuild the intro. The measured cache is a
self-contained snapshot of its recorded source; it does not silently follow later
changes to the original frames.
