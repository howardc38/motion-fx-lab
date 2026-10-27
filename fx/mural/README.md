# Stroke Mural & Dot-Iris Polarity (`fx/mural/`)

Pure Canvas 2D typographic assembly and polarity-wipe effects built on the bundled Noto Sans TC / display Latin vector outline asset (`assets/type/motion-cjk.json`), with deterministic absolute-time rendering (`frame(t)`).

## Effects

1. **`graphic-stroke-mural`** (`kind: "type"`, `grade: "A"`, `period: 7.2`, `hero: 3.4`, `aspect: "16 / 9"`)
   - Decomposes an asymmetric `0° / +90° / -90° / 180°` full-bleed Swiss/Bento typographic mural of CJK (`動`, `態`, `光`, `影`, `形`, `設`, `計`, `水`, `流`, `世`, `界`) and display Latin (`EVERY FRAME IS CODE`, `MOTION`, `FORM`, `1024+`, `60FPS`) into **1,000+ convex Voronoi / anatomical contour shards**.
   - During ballistic flight (`u < 1`), each fragment travels along a curved quadratic Bezier arc with spin, `1px` velocity leader lines and caliper ticks, and a `0.65px` outward seam-bleed expansion.
   - At `u >= 1`, each glyph switches seamlessly to its unsplit `Path2D` (`nonzero` OpenType winding), guaranteeing **zero internal hairline cracks** and solid stroke intersections, while a deterministic Risograph stipple-grain highlight band sweeps strictly inside the welded glyph interiors.
   - Reads `options.text` and `window.FX_CUSTOM_TEXT` live (with automatic raster-trapezoid fallback for characters outside the bundled glyph set).

2. **`wipe-dot-polarity`** (`kind: "motion"`, `grade: "A"`, `period: 4.8`, `hero: 1.9`, `aspect: "16 / 9"`)
   - Off-center `(x0, y0)` exponential dot-iris polarity inversion between `#0D0D0F` obsidian and `#F5F3EE` warm Swiss cream with `#FF4D2E` vermilion optical rims.
   - Uses `Path2D` `evenodd` clipping so typography flips cleanly across concentric circular wavefronts at mid-wipe (`hero: 1.9`) and collapses back into the exact punctuation period `.` (`r = r0`) at loop end for a seamless Frame-0 join.

## Standalone Film

- [`examples/stroke-mural.html`](../../examples/stroke-mural.html) — *"Every Stroke Is Code"* (`12.0 s`, `60 fps`), combining `graphic-stroke-mural` and `wipe-dot-polarity` across three polarity-flipping acts with a Frame-0 period loop.
