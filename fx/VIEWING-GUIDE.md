# Choosing effects and films

The site and the README use one set of words:

| Word | Meaning |
|---|---|
| Use case | A familiar video format with editable copy, data or brand, such as a shop promo, drinks advert or event countdown |
| Demo film | A finished short film or multi-treatment study built around one subject, story or choreography |
| Effect | One distinct visible operation or material response, shown on its own gallery card under Unique effects |
| Variant | Another version of an effect, chosen in that card's selector |
| Effect film | The full render of one effect; it plays from that effect's card |

Counts are not written here: the gallery and the film list count themselves from the catalogue and from `examples/films.json`.

## What counts as an effect?

An effect demonstrates a distinct visible operation or material response with a useful editing control. A new source image, palette, composition or rendering library alone does not earn another effect; it becomes a variant in an existing card. This is an editorial classification, not a claim that every effect is an unrelated algorithm.

| Shared operation | Effect | Variants kept in its selector |
|---|---|---|
| Displace a flat image | `liquid` — Image displacement | Glass-like distortion; the PixiJS filtered poster (`stack-pixi`) |
| Sample an image into screen-space dots | `studio-video-dots` — Image and footage halftone dots | Halftone close-up; beat-cut halftone (`studio-dot-rhythm`) |
| Shade one 3D character | `toon` — Character shading | Toon bands; two-colour halftone (`halftone`); two-ink dither (`dithercharacter`) |
| Shatter where motion is fast | `signal-motion-fragments` — Motion shatter and reassemble | Local dot impact and recovery (`studio-dot-impact`) |
| Change the playback clock | `studio-echo` — Time echoes and speed ramps | Speed ramp, hold, reverse and steps (`studio-time-remap`) |

Some similar-looking previews stay separate for a reason:

- **Glyph interiors / image displacement:** one keeps the glyph silhouette and moves its fill; the other warps image coordinates through a moving lens.
- **Graphic long shadow / soft cast shadow:** one extends a flat silhouette in a chosen direction; the other computes occlusion from geometry and a light source.
- **Proximity connections / orbital particles:** one changes graph edges by measured distance; the other moves particles along orbital trajectories.
- **Force-field lattice / image displacement:** one moves registered points away from their rest positions and recovers them; the other samples a distorted image.
- **2D image displacement / 3D transmission:** one moves image coordinates; the other shows refraction, thickness and reflection on three-dimensional geometry.
- **Image halftone / shaded character:** sampled source pixels versus a shading response on a three-dimensional figure.
- **2.5D relief / skinned surface points:** brightness displaces a shallow plane; real rigged geometry supplies the sides, back and moving limbs of the latter.
- **Time echoes / frozen orbit:** changing source playback versus moving a camera around a held three-dimensional pose.
- **Particle flow into type / orbital particles:** particles forming readable glyphs versus an orbiting, dispersing particle field.
- **Freeze frame and camera orbit / skinned point cloud:** both use the same 3D dancer; one holds time while the camera travels round her, the other turns her surface into points that follow her limbs.

[catalog.js](catalog.js) owns which demo belongs to which card. Old links to merged or removed demos (`#demo-<id>`) open the card that replaced them; the aliases live in [gallery-meta.js](gallery-meta.js). Comparing screenshot hashes catches identical frames but cannot prove that two effects differ in meaning; grouping also requires looking at motion and its controls.

## Where each film lives

Every published film has one layer. Use cases and demo films get cards in their own sections, and effect films play from their effect cards. Versions of a film (another ratio or brand from the same page) are linked from their parent's card. The full list on the site groups every film by layer and links each effect to the seconds where it appears.

<!-- films:guide:start -->
| Film | Layer | Role | Placement |
|---|---|---|---|
| Intro | Intro | A guided overview: editable use cases, a voiced character, force fields, glyph fills, connected particles, graphic shadows and spatial lettering, art direction, Spark / Form and mechanical inspection, then a one-line edit rendered to MP4. | Top of the page |
| This weekend only | Use case | A 9:16 weekend promo for a small shop: hook, product, offer and call to action inside every app’s safe area. | Card in Use cases |
| This weekend only (bakery) | Use case | Bakery version of This weekend only, rendered from the same page. | Linked from the This weekend only card |
| This weekend only (yoga studio) | Use case | Yoga studio version of This weekend only, rendered from the same page. | Linked from the This weekend only card |
| Feature launch in 15 seconds | Use case | One new feature from problem to result: the pile-up, the feature at work, the time saved and the call to action. | Card in Use cases |
| Feature launch in 15 seconds (square) | Use case | Square version of Feature launch in 15 seconds, rendered from the same page. | Linked from the Feature launch in 15 seconds card |
| Year in numbers | Use case | Figures build into counters, a goal ring and charts; every page ends on a sentence computed from the data. | Card in Use cases |
| Year in numbers (vertical) | Use case | Vertical version of Year in numbers, rendered from the same page. | Linked from the Year in numbers card |
| Background loops in place | Use case | Seamless loops shown where they are used: behind an opening title, an interview and a “starting soon” screen. | Card in Use cases |
| Titles & logo stings | Use case | Three 6-second openers for one name: solid type with light rays, particles flowing into the word, and contour lines with a glitch hit. | Card in Use cases |
| Titles & logo stings (vertical) | Use case | Vertical version of Titles & logo stings, rendered from the same page. | Linked from the Titles & logo stings card |
| Event countdown | Use case | A 15-second countdown locked to the beat: a draining ring, info chips, a hard 3-2-1 and a chrome logo reveal on the drop. | Card in Use cases |
| Event countdown (vertical) | Use case | Vertical version of Event countdown, rendered from the same page. | Linked from the Event countdown card |
| Product spotlight | Use case | A code-drawn product drops in, gains three callouts, changes colourway and ends on price and call to action. | Card in Use cases |
| Product spotlight (vertical) | Use case | Vertical version of Product spotlight, rendered from the same page. | Linked from the Product spotlight card |
| Product spotlight (square) | Use case | Square version of Product spotlight, rendered from the same page. | Linked from the Product spotlight card |
| Clear | Use case | A 15-second drinks advert: a drop crowns, rises into a glass bottle, dives underwater and surfaces as the brand. | Card in Use cases |
| Clear (9:16) | Use case | The Clear drinks advert recomposed for 9:16 from the same page. | Linked from the Clear card |
| Every Stroke Is Code | Demo film | Over 1,000 stroke-sliced Latin and CJK vectors swarm into a Bento mural, invert polarity from one expanding dot and loop seamlessly. | Card in Demo films |
| Liquid Mercury Type | Demo film | A top-down studio raymarcher pours liquid mercury into Latin and CJK letterforms, settles with specular glints and melts cleanly back into the cyclorama. | Card in Demo films |
| The Final Final | Demo film | The plush bear asks for the launch video; Pip has made one small, dramatic improvement. Nine library effects play a part in the story. | Card in Demo films |
| COUNTERFORM | Demo film | A complete fight with authored action and contact timing, and a 1.2 s freeze-orbit at the climax. | Card in Demo films |
| Inside the machine. | Demo film | A section plane opens closed housings while the detailed core keeps moving; real cap geometry preserves wall thickness. | Card in Demo films |
| Apart. Together. | Demo film | A detailed turbofan opens into seven service assemblies and returns along their ordered paths. | Card in Demo films |
| Spark / Form | Demo film | An ember traces a construction drawing, the camera enters its O, and the same word resolves as engraved three-dimensional lettering. | Card in Demo films |
| One flight. Twenty worlds. | Demo film | One character travels through twenty art directions. | Card in Demo films |
| One block. A drawn city. | Demo film | Surface hatching, staged construction and camera travel in one scene. | Card in Demo films |
| One dot. Many roles. | Demo film | One orange dot becomes a switch, a letter, a spring trace and a reveal before returning to the start. | Card in Demo films |
| Same fight. Eight treatments. | Demo film | Compare eight operations on the same choreography. | Card in Demo films |
| Find the Form | Effect film | An extended rendered example of volumetric smoke. | Effect card: Volumetric smoke around geometry |
| Overflow | Effect film | Partly filled bowl → rising water → overflow → settling. | Effect card: Fluid flow and overflow |
| Slow Gold | Effect film | Inspect liquid contact, stretching and drainage over a ring. | Effect card: Fluid flow and overflow |
| Pulse / Form | Effect film | Measured loudness pushes Milo’s portrait out into solid pins; silence is flat. | Effect card: Image relief |
| Motion / Release | Effect film | Apricot shatters only where measured motion is fast and reassembles when she lands. | Effect card: Motion shatter and reassemble |
| Say it. Mean it. | Effect film | The plush bear in close-up: three named expressions, a split-screen line and the nine mouth shapes. | Effect cards: Speech, expression and lip sync, Plush fur and soft-body physics |
| One turn. Everything moves. | Effect film | A 20:40 gear pair drives a crank, rod, piston and tachometer from one analytic model. | Effect card: Geared slider-crank mechanism |
| Pull. Warp. Return. | Effect film | A dot lattice pulls into an authored force field, recovers, then becomes a perspective wave floor. | Effect card: Force-field dot deformation |
| Inside the letters. | Effect film | One glyph silhouette contains moving stripes, an authored liquid level and a two-tone boundary. | Effect card: Animated glyph interiors |
| Near enough to connect. | Effect film | Distance changes which particles connect; pulses travel along the surviving links. | Effect card: Proximity particle connections |
| A different kind of depth. | Effect film | The same flat word gains a long graphic shadow whose direction and length keep changing. | Effect card: Graphic long-shadow type |
<!-- films:guide:end -->

The effect links on a film name the catalogue effects its source actually runs; `tools/films.cjs --check` finds each one in the film's code. Effects that only inspired a film are listed as related, not as effects.

## Ordering by visual impact

The gallery order lives in `gallery.order` in [manifest.json](manifest.json) (`npm run sync:fx` writes it into the page). It is judged on tile screenshots: effects with the strongest look in a 16:9 tile come first, and neighbouring cards should differ in colour, subject and kind. Quieter lighting effects and everyday building-block moves come later in the same gallery. Filters keep the same order.

This is a viewing order, not a quality certification. Re-check it with screenshots whenever an effect is added, rebuilt or merged.
