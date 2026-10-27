# Die-Cut Sticker Presenter Stage (`fx/presenter`)

Deterministic 2D Canvas presenter stage that bakes an exact Euclidean-distance-transform (EDT) white vinyl kiss-cut contour and offset drop shadow around transparent character poses, then directs them across a 3-plane (`0.22× / 1.0× / 1.7×`) 2.5D parallax studio stage alongside an editorial evidence card and safe-zone-clamped callout bubble.

## Gallery Demo (`fx/pack-presenter.js`)

| Demo ID | Kind | Grade | Period / Hero | What it shows |
|---|---|---|---|---|
| `sticker-stage` | `character` | `A` | `7.2 s` / `2.5 s` | Six built-in articulated explorer-robot mascot poses (`thinking`, `pointing_up`, `explain`, `surprised`, `celebrate`, `confident`) wrapped in a `15 px` kiss-cut white vinyl contour, damped squash-and-stretch spring swaps, synchronized bar-chart evidence card, safe-zone speech callout and `1.7×` foreground metric badges |

## Minimal Usage

```js
import { createStickerStage } from './fx/presenter/index.js';

const stage = await createStickerStage({
  headline: 'VISUAL PROOF STAGE',
  palette: 'studio',       // 'studio' | 'editorial' | custom colour overrides
  stickerBorder: 15,       // white vinyl contour thickness in pixels
  poses: {                 // optional custom pose URLs or Image/Canvas elements
    // explain: './custom-mascot-pose.svg',
  },
  width: 1280,
  height: 720,
});

document.body.append(stage.canvas);
stage.frame(2.5);          // deterministic random-access seek at any timestamp
```

From classic scripts, load `fx/pack-presenter.js` and call `await FXPresenter.create(options)`.

## Custom Poses, Headline & Options

- `poses`: optional `{ thinking, pointing_up, explain, surprised, celebrate, confident }` map accepting image URLs, `HTMLImageElement`, `HTMLCanvasElement` or `ImageBitmap` sources. Each pose is normalized and baked once through `bakeDieCutSticker()` with an anti-aliased white vinyl backing, subtle bevel rim and soft drop shadow. When omitted, `createStickerStage` poses the built-in `explorer-robot` rig (`assets/characters/explorer-robot/rig.json`) with inverse-kinematics limb targets and falls back to a geometric vector mascot when offline.
- `headline` / `customText` (or `stage.dataset.customText`, `window.FX_CUSTOM_TEXT`, or `frame(t, { text })`): sets the main title on the editorial evidence card with automatic font-size fitting for Latin and CJK display copy.
- `script`: optional array of `{ pose, at, tag, callout, focusBar, metric }` cue objects overriding the 6-beat `7.2 s` loop.
- `palette`: `'studio'` (dark slate architectural stage) or `'editorial'` (warm paper drafting stage), or a custom colour object.

## Limits

- Pose transitions swap discrete baked 2D vinyl sprites with damped spring squash/stretch and hop arcs rather than interpolating 3D skeletal meshes between poses.
- Callout bubbles clamp strictly inside the `16:9` title-safe frame and automatically shrink copy down to `13 px`; keep callouts concise (under ~45 characters) for crisp distance legibility.
