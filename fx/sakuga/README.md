# Sumi-e brushwork and Sakuga impact frames

One calligraphy and hit-stop motion technique (`ink-slash`) and two impact and
transition variants (`ink-impact-frame`, `ink-bleed-wipe`) run deterministically at
`1280×720` (`16:9`).

| Demo ID | Role | Kind | Grade | Stacks | Period | Hero | Highlights |
|---|---|---|---|---|---:|---:|---|
| `ink-slash` | Lead technique | `motion` | A | `canvas` | 4.8 s | 1.55 s | 44-bristle *Feibai* dry-brush split on laid Xuan paper (`#F3EFE4`), `1.0× -> 1.35×` hit-stop punch, *Enso* shockwave, splatters and carved cinnabar seal |
| `ink-impact-frame` | Variant | `light` | A | `canvas` | 4.4 s | 1.32 s | Converging charge arcs into a 3-frame binary black-and-white radial lightning flash, RGB shock ring and ballistic debris settle |
| `ink-bleed-wipe` | Variant | `motion` | B | `glsl` | 5.2 s | 2.4 s | Six-octave domain-warped fBm capillary ink bloom wiping organically between dawn mountain mist and moonlit bamboo |

## Usage

```js
import { create } from './index.js';

const effect = await create('ink-slash', { width: 1280, height: 720 });
document.body.append(effect.canvas);
effect.frame(1.55);
```

All three effects evaluate `frame(t)` purely from `t`. Code: 0BSD.
