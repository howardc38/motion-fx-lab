# Reusable 2D characters

**Images decide how a character looks; JSON decides how its parts join; motion modules decide how it moves; style modules redraw the character every frame; a scene decides where it appears in a video.**

The modules use Canvas 2D; dot sampling reuses `fx/studio/point-field.js`. A character's appearance comes from transparent image parts; its motion comes from the rig configuration and code.

- [Workbench: switch character, motion and drawing style](../../examples/character-workbench.html)

## Inputs and outputs

| Layer | Input | Output / role |
|---|---|---|
| `rig.js` | PNG / atlas + version 1 rig JSON | Assembles the character: rigid rotation, layers and mesh binding |
| `motion.js` | Rig, motion configuration, absolute seconds | Joint pose, character transform, travel and contact information |
| `styles.js` | Transparent character canvas + style | Transparent, stylised character canvas |
| `scene.js` | Character sources + actor time / position / motion / style | A scene canvas ready to composite |
| Menu | Capability description, code entry points and examples | Lets an LLM choose a capability, see it move and check the interface |


## Minimal use

Start a localhost HTTP server at the repository root, then load the ES module:

```js
import { createCharacterSource, CharacterScene } from './fx/character/index.js';

const cat = await createCharacterSource('./assets/characters/apricot-cat/rig.json');
const robot = await createCharacterSource('./assets/characters/explorer-robot/rig.json');
const scene = new CharacterScene({ cat, robot }, { width: 1280, height: 720 });

// Every frame is taken directly at an absolute time, so you can seek anywhere without playing earlier frames.
const frame = scene.frame(1.2, {
  background: '#f1eee7',
  actors: [
    { character: 'cat', motion: 'jump', style: 'poster', x: 330, y: 430, scale: 2, travel: false },
    { character: 'robot', motion: 'wave', style: 'dots', x: 940, y: 420, scale: 1.8 },
  ],
});
document.body.append(frame);
```

Character sources, styles and scenes each reuse their own canvas; the next `frame()` call overwrites it. To keep a frame, copy it to another canvas or export a PNG at once.

`actor.x/y` is the position of the character rig's origin; `scale` applies to the character and to its travel. `start/end` set when it is on screen; `offset/rate` set the motion clock; `flip/rotation/opacity` place the character in the scene. `travel:false` ignores the motion's travel, which suits side-by-side comparisons in place. `camera:[x,y]` pans the whole character scene; the background and floor are kept in step by the video's compositor. A character's `flip` also reverses the direction of its travel in the scene.

`actor.skeleton` overlays the joint chains (`true`, or a line width in rig units); with `parts:false` only the chains are drawn. `scene.frame(t, {clear:false, actors})` draws over what the canvas already holds, which is how the gallery tile fades the chains in over the drawn characters for a moment.

## New character: replace the art and the configuration

Prepare the transparent character parts you need. Compare the [four-legged cat configuration](../../assets/characters/apricot-cat/rig.json) with the [two-legged robot configuration](../../assets/characters/explorer-robot/rig.json): the renderer does not hard-code how many bodies, heads, arms or legs there are, and joint names come from the configuration.

| `rig.json` field | What to write |
|---|---|
| `version` | `1` |
| `canvas` | Positive integer `width/height`, `origin:[x,y]` |
| `assets` | Any asset ID → image path, relative to the rig JSON |
| `joints` | Any joint ID → `[x,y]` relative to the origin; canvas +x is right, +y is down |
| `parts` (all) | A stable `id`, `asset`, source pixel `rect:[x,y,w,h]`, `layer`; optional opacity / canvas filter |
| rigid part | `from` anchor joint, optional `to` direction joint, `pivot` inside the crop, `scale`; `sourceAngle` is the bone direction of the crop itself, in radians |
| mesh part | `mesh.grid`, `bindings`; each binding gives `from/to`, `sourceA/sourceB` inside the crop and an optional `widthScale` |
| mesh blend | With two bones, `blend:{axis,start,end}`; with more, per-vertex `weights`, listed by grid from top to bottom and left to right |
| terminal pin | Optional `mesh.pin`: joint, source point inside the crop, blend axis/start/end, scale; for example to keep a planted foot's orientation |
| `orientation` | `side/sourceSide` for left and right parts, both the character's own anatomical `left/right`; they differ when the part is mirrored. The validator checks that binding and pin mirroring agree |
| `pairs` | Optional list of paired parts: `{id,left:partID,right:partID}`; fill it in for left and right parts |
| `bones` | Optional joint pairs drawn for debugging; they do not decide how parts are bound |
| `legs` | root/knee/foot, upper/lower, bend ±1 and phase used by motions; two, four or any other number |
| `motions` | Motion name → motion spec; list only the motions that suit and are configured for that character |

Crops, pivots, bone lengths and joint positions still have to be configured for new art. A PNG carries no joints; swapping in an arbitrary image does not guarantee natural motion. Different proportions need configuration changes; turning sideways or to the back, or revealing hidden parts, needs extra images.

The character's own left and right are separate from screen left and right: facing the viewer, the character's left hand is on the right of the screen. The robot uses one right-arm image and one left-leg image; the other side is mirrored explicitly, and `pairs` and `orientation` validate the configuration. A negative mesh `widthScale` flips the art across its bone; a negative scale on one axis of a rigid part flips handedness, while negative scale on both axes is a rotation, not a left/right swap.

Validation cannot tell which part of a PNG is the thumb, nor judge whether a new character's art makes sense. Check new art against a complete character reference, a still pose, continuous frames of the key motions and real playback; a new character is not checked just because its labels are filled in and the numeric tests pass.

## New motion: same rig

| type | Configuration | Behaviour |
|---|---|---|
| `keyframes` | duration, loop, joints / transform tracks | Any joint or the whole-body transform; `[{t,value}]`, where value is a point or a scalar and times strictly increase |
| `gait` | legs, speed, cycle, stance, lift, bob | Planted feet stay fixed in world space while lifted feet move forward; a negative speed also flips the facing; reports reachability |
| `jump` | legs, prep, flight, land, height, distance, crouch, tuck | Wind-up, parabolic flight with tucked legs, and landing; can loop |
| `wave` | arm chain, target, raise / lower, duration, amplitude / frequency | Raise the hand, swing it back and forth, lower it; can loop |

```js
import { sampleMotion } from './fx/character/index.js';
const pose = sampleMotion(cat.rig.definition, 'walk', 1.2, { speed: 70 });
const raw = cat.rig.frame(pose);
const styled = cat.styles.frame(raw, 'ink');
```

The pose's joints are in the character's local coordinates and its transform holds local bob, facing and so on; `meta.worldX` is travel in the scene, applied by `CharacterScene`. `meta.contacts` records stance/swing and world foot positions; do not ignore `meta.unreachable`: adjust the stride, bone lengths or target instead.

These are 2D motion methods with contact constraints, not a simulator of collisions, gravity, muscles or whole-body mechanics. Fights, turns, dialogue or special performances need their own keyframes and art; nothing here claims that any motion is ready-made.

## New style: redraw the character itself

There are eight code drawing styles: `original / poster / ink / pixel / dots / ascii / etch / duotone` (Original, Four-colour poster, Ink hatching, Pixel blocks, Halftone dots, ASCII, Cross-hatch etching and Duotone poster). Use a style ID or a custom style object:

```js
const frame = cat.frame(1.2, {
  motion: 'run',
  style: { mode: 'poster', colors: ['#192932', '#975956', '#e3b783', '#fff0d5'] },
});
// Dot density and colour can be configured too.
cat.frame(1.2, { motion: 'run', style: { mode: 'dots', step: 4, ink: '#294f48' } });
```

These change colour, shading, pixels / dots / glyphs and hatching; they do not redraw the character's shapes. To give a character a different stroke, proportions or art style, prepare a consistent new set of parts and load the matching rig, or pass the transparent source on to other Menu treatments. The style presets do not stand for every artist's style.

## Sharing across videos

Characters and motion configurations carry no fixed storyboard. A single-character advert, a two-character exchange, a style switch or any other video can reuse a source and arrange it with actor timing, camera position and the compositor. `studies.js` is demonstration content, not a structure videos must follow. Its `rig` mode is the gallery tile: the cat runs and the robot jumps, then waves, while the joint skeleton fades in briefly mid-loop.

## Checks and rebuilds

```sh
node --test tests/character-math.test.mjs
npx playwright test tests/character.spec.cjs tests/organization.spec.cjs
```
