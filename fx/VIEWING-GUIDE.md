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
| This weekend only | Use case | A 9:16 weekend promo for a small shop: hook, product, offer and call to action inside every app’s safe area. | Card in Use cases |
| This weekend only (bakery) | Use case | Bakery version of This weekend only, rendered from the same page. | Film list only |
| This weekend only (yoga studio) | Use case | Yoga studio version of This weekend only, rendered from the same page. | Film list only |
| Feature launch in 15 seconds | Use case | One new feature from problem to result: the pile-up, the feature at work, the time saved and the call to action. | Card in Use cases |
| Feature launch in 15 seconds (square) | Use case | Square version of Feature launch in 15 seconds, rendered from the same page. | Film list only |
| Year in numbers | Use case | Figures build into counters, a goal ring and charts; every page ends on a sentence computed from the data. | Card in Use cases |
| Year in numbers (vertical) | Use case | Vertical version of Year in numbers, rendered from the same page. | Film list only |
| Background loops in place | Use case | Seamless loops shown where they are used: behind an opening title, an interview and a “starting soon” screen. | Card in Use cases |
| Titles & logo stings | Use case | Three 6-second openers for one name: solid type with light rays, particles flowing into the word, and contour lines with a glitch hit. | Card in Use cases |
| Titles & logo stings (vertical) | Use case | Vertical version of Titles & logo stings, rendered from the same page. | Film list only |
| Event countdown | Use case | A 15-second countdown locked to the beat: a draining ring, info chips, a hard 3-2-1 and a chrome logo reveal on the drop. | Card in Use cases |
| Event countdown (vertical) | Use case | Vertical version of Event countdown, rendered from the same page. | Film list only |
| Product spotlight | Use case | A code-drawn product drops in, gains three callouts, changes colourway and ends on price and call to action. | Card in Use cases |
| Product spotlight (vertical) | Use case | Vertical version of Product spotlight, rendered from the same page. | Film list only |
| Product spotlight (square) | Use case | Square version of Product spotlight, rendered from the same page. | Film list only |
| One flight. Twenty worlds. | Demo film | One character travels through twenty art directions. | Card in Demo films |
| The Final Final | Demo film | The plush bear asks for the launch video; Pip has made one small, dramatic improvement. Nine library effects play a part in the story. | Card in Demo films |
| Clear | Demo film | A 15-second drinks advert: a drop crowns, rises into a glass bottle, dives underwater and surfaces as the brand. | Card in Demo films |
| Clear (9:16) | Demo film | The Clear drinks advert recomposed for 9:16 from the same page. | Film list only |
| One dot. Many roles. | Demo film | One orange dot becomes a switch, a letter, a spring trace and a reveal before returning to the start. | Film list only |
| COUNTERFORM | Demo film | A complete fight with authored action and contact timing, and a 1.2 s freeze-orbit at the climax. | Film list only |
| Same fight. Eight treatments. | Comparison | Compare eight operations on the same choreography. | Film list only |
| One scene. Many eras. | Comparison | The same room/action under eight art treatments. | Film list only |
| Find the Form | Effect film | An extended rendered example of volumetric smoke. | Effect card: Volumetric smoke around geometry |
| Overflow | Effect film | Partly filled bowl → rising water → overflow → settling. | Effect card: Fluid flow and overflow |
| Slow Gold | Effect film | Inspect liquid contact, stretching and drainage over a ring. | Effect card: Fluid flow and overflow |
| One block. A drawn city. | Effect film | Surface hatching, staged construction and camera travel in one scene. | Effect card: Light-responsive surface hatching |
| Optical effects | Effect film | A sampler of six optical effects; each segment plays inside its own effect card. | Effect cards: Holographic foil, Slit-scan typography, Moiré interference, Folding paper ribbon, Caustic light, Shape morphing |
| Image distortion, collisions and particles | Effect film | Three unrelated operations with separate settings. | Effect cards: Image displacement, Rigid bodies with Matter.js, Orbital particles |
| Pulse / Form | Effect film | Measured loudness pushes Milo’s portrait out into solid pins; silence is flat. | Effect card: Image relief |
| Motion / Release | Effect film | Apricot shatters only where measured motion is fast and reassembles when she lands. | Effect card: Motion shatter and reassemble |
| Say it. Mean it. | Effect film | The plush bear in close-up: three named expressions, a split-screen line and the nine mouth shapes. | Effect cards: Speech, expression and lip sync, Plush fur |
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
