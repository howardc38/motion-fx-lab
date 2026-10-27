# SaaS product stage: cursor splines, loupes and interface choreography

One UI staging family (`ui-cursor-loupe`) and three interface choreography variants
render deterministic product motion at `1280×720` (`16:9`) on Canvas 2D.

| Demo ID | Role | Period | Hero | Highlights |
|---|---|---:|---:|---|
| `ui-cursor-loupe` | Lead technique | 6.0 s | 2.6 s | Piecewise-Hermite cursor spline, spring click depression, expanding ring ripples and a `2.2×` circular vector optical magnifier loupe |
| `ui-cmd-palette` | Variant | 5.6 s | 2.3 s | `⌘K` spring modal over a recessed workspace, deterministic keystroke typing, fuzzy-ranked highlight glide and toast confirmation (`FX_CUSTOM_TEXT`) |
| `ui-flip-modal` | Variant | 5.4 s | 2.4 s | Three-card bento layout where the centre card interpolates bounding geometry and corner radius (`FLIP`) into a detailed cohort inspector |
| `ui-chat-flow` | Variant | 6.4 s | 3.8 s | Two-party copilot thread with a phase-offset 3-dot typing wave, spring upward scroll, inline metric sparkline chip and read checkmarks |

## Usage

```js
import { create } from './index.js';

const effect = await create('ui-cursor-loupe', { width: 1280, height: 720 });
document.body.append(effect.canvas);
effect.frame(2.6);
```

Every `frame(t, options)` call is a pure function of `t`: seeking forward, backward
or out of order produces identical pixels without accumulated state. `ui-cmd-palette`
reads `options.text` or `window.FX_CUSTOM_TEXT` when non-empty. Code: 0BSD.
