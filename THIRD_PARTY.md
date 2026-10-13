# Third-party material

The code in this repository is under the 0BSD licence (see `LICENSE`). The following is not ours
and keeps its own terms.

## Loaded at run time, not bundled

| What | From | Licence |
|---|---|---|
| three.js r128 and its `examples/js` post-processing files | cdnjs, jsDelivr | MIT |
| Matter.js 0.20.0 (the rigid-body tile) | cdnjs | MIT |
| Flubber 0.4.2 (arbitrary outer-contour morph) | jsDelivr | MIT |
| PixiJS 8.22.0 (PixiJS film filter pipeline) | jsDelivr | MIT |
| Rapier 0.21.0, `@dimforge/rapier3d-compat` (3D domino film effect) | jsDelivr | Apache-2.0 |
| three.js r180 and `examples/jsm` helpers (film effects and asset tools) | jsDelivr | MIT |
| Archivo, Instrument Serif, JetBrains Mono, Noto Sans TC | Google Fonts | SIL Open Font License 1.1 |
| Playwright (development dependency) | npm | Apache-2.0 |

The WebGPU film effect's TSL implementation follows the three.js r180 attractor
example's storage-buffer / compute / sprite pattern. Its MIT notice and upstream
source are retained in [`examples/stack-lab/NOTICE`](examples/stack-lab/NOTICE).
No new third-party runtime library binaries are bundled. The CJK outline asset is documented below; film frames are rendered from
the procedural effects in this repository.

## Drawn by the operating system

Emoji and a few symbols in the tiles and the intro (for example ✓ ★) are not in the web fonts
above, so the browser draws them with the system's fonts at render time. On macOS, where
`media/intro.mp4` was rendered, these were Apple Color Emoji, Lucida Grande and PingFang HK. No
system font is bundled; renders on other systems use that system's glyphs.

## Made here

The intro's music and sound effects are synthesised by `video/music.py` and
`video/sfx.py`. It also includes generated character speech, with its music
ducked underneath. Motion, models and scores are authored in code. The two
character image atlases and the generated speech are described below; their
respective offline tools are separate from the browser renderer.

## Original studio assets

`assets/studio/fighter.glb`, `fight-source.mp4` and the transparent frame sequence
are produced by `tools/build-studio-assets.cjs`, `fx/studio/fighter-asset.js` and
`examples/fight-source.html`. The geometry, rig and animation are original.
The courier, twenty art-direction backgrounds and figure treatments are drawn
by `fx/studio/themes.js`. No artwork, character models or motion data from the
reference posts is bundled. Three.js r180 add-ons used by the asset/film tools
include GLTFLoader, GLTFExporter, SkeletonUtils and BufferGeometryUtils, under
the same MIT licence as the existing runtime dependency.

## Noto Sans TC vector outlines

`assets/type/motion-cjk.json` contains 50 glyph outlines derived from Noto Sans TC,
with its weight axis instantiated at 850. Copyright 2014–2021 Adobe, with Reserved Font Name “Source”, as specified by the upstream notice in
[`assets/type/OFL.txt`](assets/type/OFL.txt). The outlines remain under SIL OFL 1.1;
the repository's 0BSD licence does not replace their terms. Source and regeneration
instructions are in [`assets/type/README.md`](assets/type/README.md).

fontTools 4.60.1 is an optional offline build dependency under MIT. It is not
loaded by the gallery or needed to render the checked-in films.

## Optional offline Blender tool

Blender 5.2 LTS and its built-in Mantaflow system are external build tools, not
bundled runtimes. Blender is distributed under the GNU GPL; see
[Blender's licence information](https://www.blender.org/about/license/). The Python
scene recipes, primitive geometry, lighting and animation authored here are original.
Blender's built-in Bfont supplies the rendered FORM lettering; no font file is copied
into this repository. The cached frames are rendered scene outputs, not downloaded
footage. Cycles denoising is part of rendering; no generative-image model is used.

## Offline audio and motion measurements

The signal-study preprocessing optionally installs NumPy 2.2.6 (BSD-3-Clause) and
OpenCV-Python headless 4.12.0.88 (Apache-2.0 for OpenCV; package dependencies keep
their notices). These tools are not loaded by the website. Versions are pinned in
`tools/signals/requirements.txt`. The score, source image sequence and GLB are
original repository assets; no reference-post footage or audio is bundled.

## AI-generated character images

`assets/characters/apricot-cat/atlas.png` and `assets/characters/explorer-robot/atlas.png` are original
images generated with an AI image model for the configurable character effect, as each folder's
`manifest.json` records. They are used unchanged; the crop rectangles, joints and pivots are in
`rig.json`, and all motion and styling come from `fx/character/`.

## Generated character speech and mouth analysis

The plush bear (`fx/plush/`), Pip, their gestures, the scripts and the sets are authored in this repository; no character model, voice recording, video or dialogue is copied from elsewhere. Included English speech was generated offline with [Kokoro-82M v1.0](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0 model), using `af_jessica` (the bear) and `bm_george` (Pip), through [kokoro-onnx 0.5.0](https://github.com/thewh1teagle/kokoro-onnx) (MIT) and [ONNX Runtime 1.31.0](https://github.com/microsoft/onnxruntime) (MIT); `assets/dialogue/manifest.json` records the voices, speeds and generator. Its optional phonemizer uses eSpeak NG (GPL-3.0); model weights and executables are not distributed in this repository. [Rhubarb Lip Sync 1.14.0](https://github.com/DanielSWolf/rhubarb-lip-sync) (MIT) produces the bundled mouth-cue JSON. SoundFile 0.13.1 (BSD-3-Clause) and NumPy 2.5.4 (BSD-3-Clause) are offline build dependencies. Browser playback and MP4 export need only the checked-in WAV/JSON assets and existing rendering tools.

## Plush fur textures (Poly Haven, CC0)

`assets/plush/` holds five 1k texture maps from [Poly Haven](https://polyhaven.com), downloaded unchanged:
[Curly Teddy Natural](https://polyhaven.com/a/curly_teddy_natural) (colour and normal) for the fur pile and
[Caban](https://polyhaven.com/a/caban) (colour, normal and roughness) for the felt pads. Photography by
colormass, processing by Rico Cilliers. They are dedicated to the public domain under
[CC0 1.0](https://polyhaven.com/license); attribution is not required and is given for credit.
`assets/plush/manifest.json` lists each file's source URL, authors, licence and SHA-256.
