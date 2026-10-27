# Business data diagrams and flowing architecture

One system-architecture graph family (`data-node-flow`) and three quantitative and
cartographic diagram variants run deterministically at `1280×720` (`16:9`) on Canvas 2D.

| Demo ID | Role | Period | Hero | Highlights |
|---|---|---:|---:|---|
| `data-node-flow` | Lead technique | 6.0 s | 2.8 s | Directed four-stage pipeline (`Ingest -> Vector Router -> Model Pool -> Verified Output`) with cubic Bézier port packets, arrival rings and tabular counters |
| `data-donut` | Variant | 5.4 s | 2.7 s | Five-segment categorical donut with staggered spring sweeps, radially exploded hero slice, `45°` callouts and synchronized tabular-numeral legend |
| `data-map-route` | Variant | 5.8 s | 3.1 s | Stylized Pacific-Rim graticule and coastline map with radar-pulsing `HKG -> TYO -> SFO` hubs, geodesic arc draw and live flight distance badge |
| `data-timeline` | Variant | 6.0 s | 3.4 s | Smoothly panning `2022 -> 2026` causal milestone spine with sequential spring node rings and alternating milestone cards |

## Usage

```js
import { create } from './index.js';

const effect = await create('data-node-flow', { width: 1280, height: 720 });
document.body.append(effect.canvas);
effect.frame(2.8);
```

Every `frame(t)` call computes all positions, packet phases and tabular readouts
purely from `t`. Code: 0BSD.
