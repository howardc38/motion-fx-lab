# Refractive Glass & Optical Shaders (`fx/refraction/`)

Pure WebGL1 GLSL + Canvas 2D optical effects (`0BSD`, zero external 3D dependencies, shared single WebGL context for gallery safety).

| Demo ID | Role | Period | Hero | Highlights |
|---|---|---:|---:|---|
| `glass-shard-title` | Lead technique | 6.0 s | 2.85 s | Seeded Voronoi 3D shard shatter, Snell chromatic refraction, analytic studio HDR softboxes (`FX_CUSTOM_TEXT`) |
| `liquid-glass-ui` | Lead technique | 6.0 s | 2.90 s | SDF rounded-squircle meniscus lensing, RGB dispersion rim, floating metric & gauge cards (`FX_CUSTOM_TEXT`) |
| `aurora-shaders` | Lead technique | 7.2 s | 3.20 s | Seamless periodic 4-layer vertical ray aurora borealis over a polar horizon |
| `shader-prism-frost` | Variant | 7.2 s | 2.60 s | Voronoi cellular ice crystal facets with spectral edge dispersion |
| `shader-nebula-plasma` | Variant | 7.2 s | 3.00 s | Dual-stage domain-warped FBM nebula clouds and luminous plasma filaments |
| `shader-marble-obsidian` | Variant | 7.2 s | 2.80 s | Curl-warped silk marble veining with metallic gold seams and specular obsidian relief |

## Standalone Films

- [`examples/glass-refraction.html`](../../examples/glass-refraction.html) — *"Crystal & Liquid Glass"* (`12.0 s`, `60 fps`), combining Voronoi shard title fracture, Liquid Glass interactive widgets, and Aurora shader backdrops.
- [`examples/aurora-worlds.html`](../../examples/aurora-worlds.html) — *"Four Shader Worlds"* (`9.6 s`, `60 fps`), effect film cycling all four periodic GLSL backdrop worlds.
