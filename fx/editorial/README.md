# Editorial emphasis: proofreader revisions, display type and hand-drawn marks

One editorial markup technique (`type-editorial-strike`) and four typographic and
table-annotation variants operate deterministically in `16:9` (`1280×720` Canvas or
`1600×900` SVG) and honour `window.FX_CUSTOM_TEXT` when non-empty.

| Demo ID | Role | Kind | Stacks | Period | Hero | Highlights |
|---|---|---|---|---:|---:|---|
| `type-editorial-strike` | Lead technique | `type` | `canvas` | 5.2 s | 2.6 s | Multi-strand vermilion marker slash across printed broadsheet copy, caret insertion mark and tilted italic revision (`claim -> fix` or custom text) |
| `type-cipher` | Variant | `type` | `canvas` | 4.8 s | 2.1 s | Deterministic four-strata cryptographic glyph scramble locking left-to-right with phosphor bloom |
| `type-split-cut` | Variant | `type` | `canvas` | 4.8 s | 1.8 s | Diagonal laser midline slicing display lettering into two clipped half-planes that shear apart and snap shut |
| `type-knockout` | Variant | `type` | `canvas` | 5.6 s | 2.5 s | Condensed display lettering masking a moving golden-hour ocean vista before zooming through the centre counter to full bleed |
| `svg-hand-circle` | Variant | `ui` | `svg`, `css` | 4.8 s | 2.4 s | Double-loop Bézier marker circle, underline and curved margin arrow over an audited cohort table |

## Usage

```js
import { create } from './index.js';

const effect = await create('type-editorial-strike', { width: 1280, height: 720 });
document.body.append(effect.canvas);
effect.frame(2.6, { text: 'SLIDE DECKS -> WORKING CODE.' });
```

Every `frame(t, options)` call is pure and order-independent. Code: 0BSD.
