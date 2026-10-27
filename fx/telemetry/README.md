# 3D-tracked CAD callouts and industrial telemetry HUD

One 3D-tracked engineering HUD technique (`cad-telemetry-hud`) and one raymarched
harmonic surface variant (`ferrofluid-orb`) run deterministically at `1280×720` (`16:9`).

| Demo ID | Role | Grade | Stacks | Period | Hero | Highlights |
|---|---|---|---:|---:|---:|---|
| `cad-telemetry-hud` | Lead technique | A | `three`, `canvas` | 6.4 s | 2.8 s | Four world-space anchors projected via `ndc = P · V · M · p_local` into `45°` elbow leader lines, technical badges, Vernier edge scales, polar protractor and a `270°` spring gauge |
| `ferrofluid-orb` | Variant | B | `glsl` | 5.6 s | 1.9 s | Raymarched metallic ferrofluid sphere driven by `sin³` spherical-harmonic spike lobes and damped elastic ringdown inside a containment reticle |

## Usage

```js
import { create } from './index.js';

const effect = await create('cad-telemetry-hud', { width: 1280, height: 720 });
document.body.append(effect.canvas);
effect.frame(2.8);
```

Both demonstrations evaluate `frame(t)` purely from `t` with zero frame-to-frame lag
or state drift, sharing module-level WebGL contexts cleanly across multiple views. Code: 0BSD.
