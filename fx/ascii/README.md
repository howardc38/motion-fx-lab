# Spine-articulated boids ASCII renderer

One biomechanical schooling simulation (`ascii-spine-boids`) runs deterministically
at `1280×720` (`16:9`) on Canvas 2D.

| Demo ID | Role | Kind | Grade | Stacks | Period | Hero | Highlights |
|---|---|---|---|---|---:|---:|---|
| `ascii-spine-boids` | Lead technique | `sim` | A | `canvas` | 8.0 s | 3.2 s | Six 20-node reef sharks and 40 7-node baitfish steered by Couzin repulsion, orientation and attraction zones, rendered via a dual-pass slope-aware ASCII shader |

## Architecture

1. **Pre-warmed deterministic trajectory table**: Seeded Couzin boid steering and
   inextensible 20-node spine kinematics (`theta_i` travelling sinusoidal caudal wave
   plus joint-bend limits) are pre-warmed and loop-closed once at build time so
   `frame(t)` is pure and order-independent.
2. **Dual-pass slope-aware ASCII rasterizer**: Pass 1 supersamples 3D cylindrical
   capsule luminance and depth at `2×2` sub-cell resolution; Pass 2 maps interior
   luminance onto `- = + * % @ #` and selects silhouette characters from
   `/ \ | _ - ( ) < > , . '` according to sub-cell occupancy bitmasks and edge slope.

## Usage

```js
import { create } from './index.js';

const effect = await create('ascii-spine-boids', { width: 1280, height: 720 });
document.body.append(effect.canvas);
effect.frame(3.2, { labels: false });
```

Code: 0BSD.
