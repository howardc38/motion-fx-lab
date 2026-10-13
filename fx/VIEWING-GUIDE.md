# Choosing effects and films

The collection contains **71 effect families, 22 selectable variants and five
combined showcases**: 98 callable demo IDs. The main film shortlist contains **13 videos**; the repository retains **24 video bundles**, including the separate intro and ten supporting studies.
These are different counts: a film can reuse several families, several films can
reuse one family, and a study can export only one effect.

## What counts as a family?

A family demonstrates a distinct visible operation or material response with a
useful editing control. A new source, palette, composition or rendering library
alone does not earn another family. This is an editorial classification, not a
claim of 71 unrelated algorithms or 71 equally spectacular results.

| Shared operation | Family | Variations kept in its selector |
|---|---|---|
| Displace a flat image | `liquid` — Image displacement | Glass-like distortion; the PixiJS filtered poster (`stack-pixi`) |
| Sample an image into screen-space dots | `studio-video-dots` — Image and footage halftone dots | Footage; rhythmic dot palettes; halftone lettering (`halftonetype`) |
| Move soft fields of colour | `gradient` — Soft colour fields | Quiet colour wash; glowing orbs (`orbs`) |

These three consolidations changed the displayed count from 72 to 69. The later motion-driven fragment family brings the total to 70; speech mouth animation brings it to 71; audio relief and impact orbit are variations. Every
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

The main shortlist contains six sequences, four use-case templates, one comparison and two single-effect films. All 24 bundles are kept as editable examples; the intro stays above the shortlist and ten supporting studies are linked from the related effects.
The three featured sequences cover art direction, voiced character performance and
materials. Newness and technical complexity do not determine prominence.

<!-- films:guide:start -->
| Film | Layer | Role | Placement |
|---|---|---|---|
| Intro | Intro | A guided overview that deliberately repeats selected uses and techniques. | Top of the page |
| Social clips | Use case | Hook, interaction and call to action. | Card in Use cases |
| Product demos | Use case | One interface interaction, explained. | Card in Use cases |
| Infographics | Use case | Turn figures into a data story. | Card in Use cases |
| Animated backgrounds | Use case | Three reusable background loops. | Card in Use cases |
| One flight. Twenty worlds. | Demo film | One character travels through twenty art directions. | Card in Demo films |
| The Final Final | Demo film | A two-character conversation with speech, gestures, reaction holds and a closing joke. | Card in Demo films |
| One drop. Many forms. | Demo film | Authored drop, splash, morph and underwater chapters. | Card in Demo films |
| One dot. Many roles. | Demo film | One orange dot becomes a switch, a letter, a spring trace and a reveal before returning to the start. | Film list only |
| One word. Many forms. | Demo film | A word changes form and returns to a readable title. | Film list only; to become a use case: Titles & logo stings |
| COUNTERFORM | Demo film | A complete fight with authored action and contact timing. | Film list only |
| Same fight. Eight treatments. | Comparison | Compare eight operations on the same choreography. | Film list only |
| One scene. Many eras. | Comparison | The same room/action under eight art treatments. | Film list only |
| Find the Form | Effect film | An extended rendered example of volumetric smoke. | Effect card: Volumetric smoke around geometry |
| Overflow | Effect film | Partly filled bowl → rising water → overflow → settling. | Effect card: Fluid flow and overflow |
| Slow Gold | Effect film | Inspect liquid contact, stretching and drainage over a ring. | Effect card: Fluid flow and overflow |
| One block. A drawn city. | Effect film | Surface hatching, staged construction and camera travel in one scene. | Effect card: Light-responsive surface hatching |
| One light. Different edges. | Effect film | Inspect source size and object height against the shadow. | Effect card: Source size and soft shadows; to be retired |
| Six optical treatments | Effect film | Six independent looks for choosing a treatment. | Effect cards: Moiré interference, Slit-scan typography, Folding paper ribbon, Caustic light, Holographic foil, Shape morphing |
| Image distortion, collisions and particles | Effect film | Three unrelated operations with separate settings. | Effect cards: Image displacement, 3D domino chain, Orbital particles |
| Pulse / Form | Effect film | Measured audio changes solid image-cell depth. | Effect card: Image relief |
| Motion / Release | Effect film | Measured image movement emits and directs fragments. | Effect card: Motion-driven fragments |
| Impact / Orbit | Effect film | A measured score attack cues an authored held 3D pose and animated lighting. | Effect card: Freeze frame and camera orbit; to be merged into COUNTERFORM |
| Say it. Mean it. | Effect film | Recorded speech, expressive mouth shapes and authored gestures. | Effect card: Speech, expression and lip sync |
<!-- films:guide:end -->

The index links each film to related effects. This does not assert that every
film imports those exact factories: some author their own versions of the same
operation. MP4, timeline and GIF links for the selected films remain in the shortlist. The ten supporting studies keep those links on their effect cards, and the README source archive retains all eleven excluded bundles including the intro. No video files are removed or stitched into another sampler.

## Ordering by visual impact

The default effect gallery leads with motion-driven fragments, expressive speech, dense particle motion, repeated depth,
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
