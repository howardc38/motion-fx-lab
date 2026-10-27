# Liquid Chrome Type (`fx/chrome-type/`)

Pure WebGL fragment-shader signed-distance raymarcher (`liquid-chrome-type`) with zero external 3D library dependencies. Works on WebGL 1, WebGL 2, and `--use-angle=metal`.

## Architecture

1. **Dynamic Latin & CJK 16-Bit Euclidean Distance Transform (`RGBA8`, `1024 × 256`)**
   - Measures any runtime string (`options.text || window.FX_CUSTOM_TEXT || "MOTION"`) using the bundled vector outlines (`assets/type/motion-cjk.json`) with automatic high-DPI Canvas fallback for arbitrary Unicode characters.
   - Computes an exact separable $O(N)$ Felzenszwalb–Huttenlocher 2D Euclidean Distance Transform in JavaScript, smoothed for $C^1$ curvature continuity and packed at **16-bit precision** into `(R, G)` alongside a coarse wide-range SDF in `B` for fast sphere-tracing.
   - Extrudes the 2D glyph SDF into a rounded-bevel 3D shape (`opExtrusion` + contour inset so adjacent bevels stay separated).

2. **4-Phase Seamless `6.0 s` Liquid-Mercury Choreography (`hero: 2.75`)**
   - `0.0–1.5 s`: Top-down mercury streams, Rayleigh–Plateau tendrils, and satellite droplets pour from `y = +H` with polynomial smooth-minimum (`smin`, `k: 0.42 → 0.06`) while glyphs swell organically out of the mercury pool via internal negative-radius nucleation (`d_glyph + mix(0.28, 0.0, p)`).
   - `1.5–2.3 s`: Analytical underdamped harmonic spring (`zeta = 0.55`, `omega = 18`) snaps puffy liquid bevels into crisp machined 3D chrome lettering.
   - `2.3–4.3 s`: Readable hero hold with periodic camera parallax and a `40°`-tilted studio softbox specular glint sweep across the bevels.
   - `4.3–6.0 s`: Overlap-ordered surface-tension swell and downward gravity drain (`y → -H`) returning cleanly to the exact `t = 0` empty studio cyclorama.

3. **Analytic Studio Cyclorama, 4× RGSS Silhouette AA & Chrome Shading**
   - Linear-calibrated warm terracotta infinity cyclorama (`#D97757 → #B9573A`) with soft overhead contact shadow and glossy floor reflection (`y = -0.82`), paired with a camera-side negative-fill panel, `-6°` tilted horizon strip, overhead/key softboxes, secondary crevice inter-reflection, subtle chromatic Fresnel edge dispersion, and adaptive `4×` rotated-grid supersampling along silhouette and grazing bevel edges.

## Standalone Film

- [`examples/liquid-chrome-type.html`](../../examples/liquid-chrome-type.html) — *"Liquid Mercury Type"* (`12.0 s`, `60 fps`), pouring two consecutive sculpted words (`"LIQUID"` → `"動 · FORM"`) with live `?text=` editing and interactive timeline scrubbing.
