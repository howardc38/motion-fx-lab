# Choosing effects and films

The collection contains **69 effect families, 20 selectable variants and five
combined showcases**: 94 callable demo IDs. The film index contains **19 videos**.
These are different counts: a film can reuse several families, several films can
reuse one family, and a study can export only one effect.

## What counts as a family?

A family demonstrates a distinct visible operation or material response with a
useful editing control. A new source, palette, composition or rendering library
alone does not earn another family. This is an editorial classification, not a
claim of 69 unrelated algorithms or 69 equally spectacular results.

| Shared operation | Family | Variations kept in its selector |
|---|---|---|
| Displace a flat image | `liquid` — Image displacement | Glass-like distortion; the PixiJS filtered poster (`stack-pixi`) |
| Sample an image into screen-space dots | `studio-video-dots` — Image and footage halftone dots | Footage; rhythmic dot palettes; halftone lettering (`halftonetype`) |
| Move soft fields of colour | `gradient` — Soft colour fields | Quiet colour wash; glowing orbs (`orbs`) |

These three consolidations changed the displayed count from 72 to 69. Every
previous demo ID and deep link remains usable. The category and renderer filters
can select a matching variant even if its parent uses another renderer.

Some similar-looking previews remain separate for a reason:

- **2D image displacement / 3D transmission:** one moves image coordinates; the
  other shows refraction, thickness and reflection on three-dimensional geometry.
- **Image halftone / shaded halftone character:** sampled source pixels versus
  a dot shading response on a three-dimensional figure.
- **2.5D relief / skinned surface points:** brightness displaces a shallow plane;
  actual rigged geometry supplies the latter's sides, back and moving limbs.
- **Time remapping / frozen orbit:** changing source playback versus moving a
  camera around a held three-dimensional pose.
- **Echoes / impact / depth scatter:** previous poses remain, a contact region
  deforms, or surface points scatter with depth-dependent focus.
- **Particle-to-type / orbital particles:** formation of readable glyphs versus
  an orbiting, dispersing particle field. The library choice alone is not the
  distinction; these sequences demonstrate different motion controls.
- **Noise smoke / baked volumetric smoke:** a procedural image field versus a
  gas volume interacting with scene geometry.

The catalogue in [catalog.js](catalog.js) owns family/variant relationships.
Comparing screenshot hashes catches identical frames, but cannot prove semantic
uniqueness; grouping also requires looking at motion and its controls.

## Which films are worth watching?

All 19 are kept as editable examples. They are not all portfolio centrepieces.
The three featured sequences cover art direction, connected graphic motion and
materials. Newness and technical complexity do not determine prominence.

| Film | Role and reason to keep it | Placement |
|---|---|---|
| One flight. Twenty worlds. | A continuous character journey through contrasting art directions | Featured sequence |
| One dot. Many roles. | A visual cue connects type, timing, depth and a reveal; closes its loop | Featured sequence |
| One drop. Many forms. | A material-led journey from a splash through changing forms to an underwater view | Featured sequence; authored surfaces, not a fluid solver |
| One word. Many forms. | A replaceable CJK title passes through solid, particle, contour and signal treatments | Sequence index |
| COUNTERFORM | Original action choreography, contact holds and framing | Sequence index; related fight studies share its action |
| One block. A drawn city. | Surface hatching, staged construction and camera travel in one scene | Sequence index; less visual variety than the featured pieces |
| Social clips | Hook → interaction → closing action in a vertical ad | Use-case template |
| Product demos | One interface interaction explained closely | Use-case template; intentionally shares the social example's app |
| Infographics | Counting figures become bars, a ring and a trend | Use-case template |
| Animated backgrounds | Three reusable loops plus an example title overlay | Use-case template; its own source includes the network loop |
| Same fight. Eight treatments. | A common source makes eight different operations comparable | Comparison |
| One scene. Many eras. | The same room/action under eight art treatments | Comparison, not eight additional effects or a new narrative |
| Six optical treatments | Six independent looks for choosing a treatment | Sampler |
| Image distortion, collisions and particles | Three unrelated operations with separate settings | Sampler, not one connected motion story |
| Find the Form | Inspect baked volumetric smoke around lettering | Single-effect study |
| One light. Different edges. | Inspect source size and object height against the shadow | Single-effect study; useful explanation rather than a showreel lead |
| Overflow | Inspect filling, spill and drainage of a partly filled bowl | Single-effect study |
| Slow Gold | Inspect liquid contact, stretching and drainage over a ring | Single-effect study and a variation of liquid flow |
| Intro | A guided overview that deliberately repeats selected uses and techniques | Overview |

The index links each film to related effects. This does not assert that every
film imports those exact factories: some author their own versions of the same
operation. MP4, timeline, GIF and source links remain available in the index.

## Ordering by visual impact

The default effect gallery leads with dense particle motion, repeated depth,
spectral material, volumetric smoke, image displacement and flowing contours.
Materials, colour, depth and changes in form come before restrained lighting
explanations and small UI/text utilities. Filters preserve that curated order.
Solid lettering starts with the larger CJK variation; camera travel starts with
the low-poly course. Original variations remain selectable.

This is a viewing order, not a quality certification. The main improvement
priorities are richer architectural variety and less repetitive close passes in
Ink City; clearer surface/contact detail and less sheet-like breakup in Slow
Gold; and better material readability in Overflow. Their current studies remain
useful for inspecting behaviour, but they should not be promoted as the strongest
cinematic examples. Adding another long sampler would add less value than
improving those existing shots.
