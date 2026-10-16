# Mechanical effects

Three distinct operations, each with one gallery card and one full effect film:

| Effect | Control | Film |
|---|---|---|
| `mechanical-assembly` | `explode` from 0 to 1 | [Apart. Together.](../../examples/mechanical-assembly.html) |
| `mechanical-cutaway` | `cutZ` from 2.1 to −0.3 metres | [Inside the machine.](../../examples/mechanical-cutaway.html) |
| `mechanical-linkage` | input `rpm` from 0 to 90 | [One turn. Everything moves.](../../examples/mechanical-linkage.html) |

The first two intentionally use the same detailed turbofan. The operation changes, not the source model.
`Spark / Form` is a separate **demo film**, combining existing lettering and hatching with authored transitions;
it is not another mechanical effect or four new techniques.

## Use and export

These modules use the existing pinned three.js r180 import map. No additional browser library is required.

```js
const effect = await FXMechanical.create('mechanical-cutaway', {width:1920,height:1080});
host.append(effect.canvas);
effect.frame(7.2, {cutZ:-0.2, labels:false});
console.log(effect.proof());
```

Or import `create` from `app.js`. Options are `width`, `height` and `paper`; per-frame options are
`explode`, `cutZ`, `rpm`, `cameraAngle`, `labels` and `auditOnly`. Omitted operation controls follow the
14.4-second authored timeline. Every pose, angle and reading is calculated from absolute time.
`rpm:0` holds the geared mechanism; time may move backwards or be requested out of order.

```sh
node tools/films.cjs build mechanical
npm run check:mechanical
```

Film pages have a scrub bar and one operation control. Recording hides those controls and renders the
same geometry at native 1920×1080 and 60 fps (declared in the film manifest). The finished films add
synthesised music and sound effects. The studio uses seeded GTAO with a per-material clipped normal
pass, soft variance shadows, an HDR target and the procedural softbox environment.
Changing a preview parameter starts a new take at zero; Play keeps that parameter. Use film timeline
restores the authored changes. Recording always uses the authored timeline, independent of preview controls.

## Geometry and movement

- The turbofan retains twisted airfoil blades, twenty fan blades, ten compressor rotor stages,
  stator rows, an annular combustor, two turbine spools and a ground-run stand. Geometry, material
  presets, procedural finishes and studio lighting are adapted from Machine Skill under MIT;
  [NOTICE](NOTICE) and [LICENSE-MIT.txt](LICENSE-MIT.txt) identify the source and scope.
- Seven service assemblies move: two nacelle halves, two core-cowl halves, spinner, fan module
  and exhaust plug. A closed circular casing is **not** dragged radially through the rotor.
  The shells are physically split into closed halves. Shells clear first; spinner and fan withdraw
  afterwards. The return follows the reverse sequence. Internal stages remain supported as one core.
- A section through a revolved housing is generated from the **same radius/axis profile** as its
  surface. The cap has real triangles, wall thickness and depth, with a machined hatch. It is not
  a colour painted on a surviving back face. This is a longitudinal section of registered revolved
  housings, not a general CSG cutter for arbitrary meshes. Internal stages remain uncut for inspection.
- The original geared demonstrator has 20:40 teeth, a 0.26 m crank, a 1.02 m connecting rod, a
  0.232 m bore radius and a 0.219 m piston radius. Its gear phases, crank pin, wrist pin, rod and
  tachometer share the analytic slider-crank solution. Speed ramps integrate RPM into angle;
  changing speed does not teleport the mechanism. Tooth outlines are illustrative, not manufactured gear profiles.
- Turbofan rotation is slowed for inspection. Flow streaks and heat are authored visual cues;
  these films do not claim measured performance, a Brayton-cycle solution, CFD or FEA.

## Geometric checks

`audit.js` checks the drawn objects and their world transforms. `tools/check-mechanical.cjs` sweeps
157 poses per film, checks a backward/out-of-order seek, and saves a JSON report. Positive controls
displace the real connecting rod, gear centres, a shell and a section vertex. A missed control fails
the checker. The geometry checks cover:

- rod eye ↔ crank/wrist pin alignment and constant link length;
- gear pitch-centre spacing, ratio and phase;
- piston/body-to-bore radial clearance;
- registered tube terminal seating and capsule clearance against static frame boxes;
- outward shell motion, shell triangle-edge closure and service order;
- section loops and actual cap vertices on the cut plane;
- projected camera bounds, including the separated assemblies.

The report names its coverage and exclusions. It is not a general triangle-mesh collision certificate,
does not prove every internal turbofan interface, and does not replace watching the moving film.
Geometry that is not registered is not silently certified. New subjects need their own meaningful
ports, envelopes and constraints. See the positive-control unit tests in
[`mechanical-model.test.mjs`](../../tests/mechanical-model.test.mjs).

## Files

`model.js` owns dimensions and clocks; `geometry.js` closes shell halves and constructs sections;
`turbofan.js` and `mechanism.js` build the subjects; `stage.js` owns the studio and framing;
`app.js` composes poses; `player.js` supplies the film/recorder interface. The gallery registration is
in `../mechanical-effects.js` and `../pack-mechanical.js`.
