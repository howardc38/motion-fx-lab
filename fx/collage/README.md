# Cut-Paper Editorial Collage (`fx/collage`)

Deterministic 2D Canvas cut-paper collage and duotone newsprint halftone module inspired by mid-century Saul Bass title sheets and archival press proofs. Every texture, torn paper fibre edge, masking tape strip, brass pushpin and rubber stamp distress pattern is generated from a seeded Perlin field (`perlin3(seed)`), so `frame(t)` is a pure, bit-reproducible function of time with no external image dependencies.

## Gallery Demos (`fx/pack-collage.js`)

| Demo ID | Role | Kind | Period / Hero | What it shows |
|---|---|---|---|---|
| `paper-collage` | Lead technique | `type` | `6.4 s` / `2.6 s` | Multi-layer scissored & deckle-torn paper stocks, snipping cut-out scissors emblem, ransom/editorial display plates (`"CUT & PASTE"`), four crinkled masking tape strips slapping down on beat, brass pushpins, distressed ink stamp and `zdoc` 3-plane parallax camera push & tilt |
| `collage-halftone` | Variant | `light` | `6.0 s` / `2.4 s` | Two-angle (`45°` Prussian cobalt + `15°` press ink) rotary halftone screen over a sweeping sunbeam observatory plate, diagonal torn kraft paper reveal, spun-brass pin mount, `8×` halftone rosette magnifier card and stamped vermilion ink seal |

## Minimal Usage

```js
import { createPaperCollage } from './fx/collage/index.js';

const collage = createPaperCollage({
  mode: 'editorial',          // 'editorial' | 'halftone'
  headline: 'CUT & PASTE',
  subhead: 'SCISSORED STOCK · TORN FIBRE · MASKING TAPE',
  stamp: 'STUDIO CUT',
  palette: 'bass',            // 'bass' | 'newsprint' | 'bauhaus' | custom colour map
  seed: 17,
  width: 1280,
  height: 720,
});

document.body.append(collage.canvas);
collage.frame(2.6);           // deterministic random-access seek at any timestamp
```

From classic non-module scripts, load `fx/pack-collage.js` and call `await FXCollage.create(options)`.

## Custom Text & Options

- `headline` / `customText` (or `stage.dataset.customText` / `window.FX_CUSTOM_TEXT`, or per-frame `frame(t, { text })`): replaces the cut-paper headline plates and automatically scales the font size to fit inside each scissored plate (supports both Latin display type and CJK glyphs via `Noto Sans TC`).
- `subhead`, `stamp`: customises the bottom registration line and the distressed rubber stamp.
- `palette`: choose `'bass'`, `'newsprint'`, `'bauhaus'`, or pass `{ mat, cream, bone, kraft, vermilion, cobalt, ink, tape, brass }` overrides.
- `seed`: integer seed controlling paper fibre grain, `cutPolygonPoints` scissor wobble, deckle-edge tear contours and ink-starvation blotches.

## Limits

- Paper elevation, shadows and tape slaps are 2D affine layers with `zdoc` camera parallax (`0.22× / 1.0× / 1.7×`), not 3D cloth or bending-sheet mesh simulation.
- Very long multi-sentence headlines shrink to fit the cut-paper plates; keep headlines concise (1–4 short words or 2–8 CJK characters) for strong poster legibility.
