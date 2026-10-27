# Plush fur

Shell-texture fur for three.js r180 in plain WebGL, and an original plush-toy bear built with it.
The gallery tile (`plush-fur`) shows a backlit bear drawing a heart in its own belly fur, then
giggling and shaking: the pile whips, fluffs back up and settles. The same bear stars in the
[dialogue films](../dialogue/README.md).

## Fur (`fur.js`)

Each furry part is an opaque base mesh plus an instanced stack of shells pushed out along the
normal. The fragment shader keeps only tapered strands placed by 3D cellular noise on the
undisplaced position, so shells line up and there is no UV seam. Options are uniforms, so a frame
depends only on the pose set for it. Features (`furFeatures('all' | 'none' | 'fins,shadow' ...)`):

| Feature | What it adds | Cost (measured on the bear, 1080 × 1920) |
|---|---|---|
| `fins` | Edge quads that appear where the surface turns edge-on, filled with the same strands: silhouettes read as hair, not layers | about +8–16% per frame, the largest |
| `strands` | A few thousand fibre ribbons (alpha-to-coverage below one pixel), a two-lobe Kajiya-Kay highlight and light through backlit tips | about +2% |
| `shadow` | Fur self-shadowing of direct light, depth and clump AO, round strands, contact occlusion from ellipsoid occluders (neck, arms, floor) | within measurement noise |
| `soft` | Gaussian surface deformers (cheeks, belly, squeeze) that move base, shells, fins and strands together | within noise; CPU about 0.7 ms |
| `photo` | A CC0 photographed teddy pile, triplanar: tuft layout, mottling and pile direction (see `assets/plush/manifest.json`) | within noise; 3.4 MB of images |

`strands` stays on: it is cheap and it carries the highlight and backlit tips that make the rim
light read as fur. Two per-part extras compile only where requested: `jaw` (a hinged lower face
that drops with the mouth) and `brush` (a path drawn through the pile, which stays laid down until
it is fluffed up again).

`furPart(parent, geometry, furMaterial(options), place)` adds a part; `ellipsoid`, `blobGeometry`
and `limbGeometry` make seamless shapes for it. Rendering needs a multisampled target (the fur uses
alpha-to-coverage). Leave fur layers out of depth-only passes: `withoutFur(scene, render)`.
Fragment inputs are clamped, because multisampling can evaluate thin triangles outside their area;
an unclamped value once produced NaN, which bloom spread over the whole frame.

## Bear (`bear.js`)

```js
import {createPlushBear, VISEMES, animator} from './fx/plush/bear.js';
import {loadPhotoSet} from './fx/plush/textures.js';
const bear = createPlushBear({features: 'all', photo: await loadPhotoSet(), viewHeight: 1080});
scene.add(bear.root);                       // seated at y = 0, facing +z; wrap it in a Group to place or scale it
bear.pose({
  hop, squash, lean, tilt, twist, turn,
  head: {nod, turn, roll}, ears: [{perk, flop, back}, {...}],   // [0] is the bear's right (-x)
  arms: [{target: [x, y, z], palm: [x, y, z], pole}, {...}],     // torso space, two-bone IK
  legs: [{lift, spread}, {...}],
  face: {blink, happy, wink, surprise, squint, lid, lidAsym, lidSlant, brow, worry, browTilt,
         blush, smile, smirk, jaw, gazeX, gazeY, mouth: VISEMES.D},
});
bear.setFurForce(part => force);            // world-space push on each part's fur (any solver can drive it)
const poseAt = animator(bear, t => performance(t));   // fur drag from motion + soft secondary motion, from t alone
```

The puppet mouth has an embroidered lip line, a velvet lining, felt teeth and tongue, and a lower
face that drops with the jaw (the fur, the lining and the lips use the same jaw function). The nine
shapes (`VISEMES`, Rhubarb A–H and rest X) differ in size, outline and contents; `board.js` renders
their label masks so a new table can be checked (the tests require pairwise overlap below 0.7 at
gallery-tile size and a wide-open D of at least 20 px). Lids, brows and gaze give named expressions.

`textures.js` draws felt, satin stitch, gingham, knit and wall procedurally from a seed, and loads
the optional CC0 photographs. `stage.js` provides two sets: `bedroom` (teal dusk, fairy-light bokeh)
and `studio` (dark sweep with strong back rims). `effect.js` is the `plush-fur` gallery tile.

## Interactive Verlet Fur Physics (`webgpu.js` · `plush-webgpu`)

`createPlushWebGPU(options)` upgrades every furry part with a `240 Hz` Verlet guide-strand solver in
raw WebGPU compute (`WGSL`) while keeping the exact WebGL2 shell, silhouette-fin, fibre-strand and
post-processing pipeline:

```js
import {createPlushWebGPU} from './fx/plush/webgpu.js';

const plush = await createPlushWebGPU({
  width: 1280,
  height: 720,
  set: 'bedroom',        // 'bedroom' | 'studio'
  interactive: true,     // live pointer-drag pressing in addition to scripted choreography
});

document.body.append(plush.canvas);
await plush.frame(2.6);  // deterministic random-access seek via 0.5 s GPU state checkpoints
```

- **Guide strands & soft-body denting**: each base-mesh vertex of the 11 furry parts (~23,300 guides) owns a 5-node guide (`node 0` = dented skin, `nodes 1..4` = inextensible follow-the-leader pile). Forearm capsules and a studio tactile presser cushion dent the body, head and muzzle inward with a damped spring rebound (`skinK`, `skinDamp`), analytical rim-normal tilt and contact-compression shading (`vSimComp`), while dragging adjacent strands by friction.
- **Deterministic `0.5 s` state checkpoints**: simulation state (`X`, `Xp`, `D`, `Out` and previous capsule transforms) is snapshotted on the GPU every `120` steps (`0.5 s`), keeping backward or random-access `frame(t)` seeks fast and bit-reproducible across forward, reverse and chunked playback orders.
- **Seamless fallback**: when `navigator.gpu` or a hardware adapter is unavailable, `createPlushWebGPU` falls back automatically to a deterministic `240 Hz` CPU Verlet + `FUR_SOFT` Gaussian dent solver on Three.js WebGL2 (and a 2D Canvas emergency fallback if WebGL2 is unavailable) without uncaught errors.

## Limits

Shell fur remains an approximation: very close or edge-on views can still show shell layers when
pressed nearly flat; guide strands collide against analytic limb capsules, body ellipsoids and the
blanket rather than strand-to-strand within the same part; whole-body `squash` remains an affine
scale rather than volume-preserving tetrahedral FEM.

