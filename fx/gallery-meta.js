// Labels and presentation settings for the effect gallery in index.html (read by fx/gallery-page.js).
// The card order and preview defaults between the fx:gallery markers come from fx/manifest.json.
(() => {
  // fx:gallery:start
  // Generated from fx/manifest.json by tools/fx-manifest.cjs; edit the manifest, not this block.
  const GALLERY = {
    order: [
      "optical-foil", "mechanical-cutaway", "domainrep", "plush-fur", "fluid-smoke", "reaction",
      "mechanical-assembly", "studio-lowpoly", "gpuparticles", "studio-freeze-orbit",
      "organic-contours", "dissolve", "mechanical-linkage", "dialogue-lipsync", "studio-skin-cloud",
      "studio-echo", "rays", "stack-gpu", "design-type-orbit", "studio-video-dots", "chrome",
      "optical-slit", "clay", "water-material", "toon", "signal-motion-fragments", "cjk-solid",
      "studio-depth-dots", "optical-moire", "studio-portal", "optical-caustic", "optical-morph",
      "water-impact", "rhythm", "vartype", "optical-ribbon", "glitch", "cardflip", "fluid-overflow",
      "liquid", "ridgelines", "rigid", "character-rig", "design-surface-ink", "whip", "uifly",
      "hook", "chars", "karaoke", "datachart", "timing", "glass", "sweep", "stamp", "beat",
      "sticker", "gradient", "ring", "count", "type", "mark", "scan", "wipe", "lut",
      "design-soft-shadow", "grain",
    ],
    showcaseOrder: [
      "styles", "studio-themes", "studio-gallery", "water-underwater", "scene-eras",
    ],
    previewDefault: { "glitch": "frame-glitch", "studio-depth-dots": "signal-audio-relief" },
    previewHero: { "gpuparticles": 1.5 },
    previewWindow: { "signal-motion-fragments": [1,8], "dialogue-lipsync": [0,10.7], "mechanical-assembly": [1.8,12.8], "mechanical-cutaway": [1.8,12.8], "mechanical-linkage": [1.8,12.8] },
  };
  // fx:gallery:end
  const KINDS = { shader: "Materials & surfaces", light: "Light & image treatments", space: "3D space & particles", sim: "Physics & growth", character: "Characters", motion: "Motion & timing", backdrop: "Backgrounds", ui: "UI & data", type: "Type" };
  // What a tile needs beyond the page itself.
  const NEEDS = { "A": ["Base stack only", "Needs nothing beyond HTML, CSS, SVG, Canvas and the existing three.js core"],
    "A+": ["Plus a three.js add-on", "Uses three.js add-ons, such as post-processing or animated GLB loading"],
    "B": ["Custom shader", "Needs a GLSL shader written for it"], "C": ["Plus a library", "Needs one more library"], "D": ["Offline Blender bake", "Playback uses cached frames; changing the simulation requires Blender"] };
  const STACKS = { blender: "Blender (offline)", css: "HTML/CSS", svg: "SVG", canvas: "Canvas 2D", three: "Three.js", glsl: "Custom GLSL", physics: "Matter.js", flubber: "Flubber", pixi: "PixiJS", rapier: "Rapier", webgpu: "WebGPU / TSL" };
  // Films offered under an effect tile. Which effects a film shows comes from window.FXFilms
  // (examples/films.json); a film is offered when its layer is listed here or its id has a label.
  const TILE_FILM_LAYERS = ["effect-film"];
  const TILE_FILM_LABELS = {
    "character-lipsync": "Watch the 11.6 s lip-sync film with sound",
    "audio-relief": "Watch the 12 s effect film with sound",
    "motion-fragments": "Watch the 12 s effect film with sound",
    "dot-story": "Watch the demo film that uses it",
    "dot-battle": "Watch COUNTERFORM, the fight film that uses it",
    "ink-city": "Watch the full render",
    "fluid-overflow": "Watch the full 9.6 s render",
    "fluid-smoke": "Watch the full 9.6 s render",
    "fluid-viscous": "Watch the full 9.6 s render",
    "optical": "Watch the optical sampler",
    "stacks": "Watch the three-operation sampler",
  };
  // Old #film-<id> bookmarks that open an effect card: effect films that play there, and retired or merged films.
  // scene-eras is no longer a published film (most of it held still); its bookmark opens the live preset.
  const FILM_BOOKMARKS = {
    "film-ink-city": "design-surface-ink", "film-shadow-lab": "design-soft-shadow",
    "film-optical": "optical-foil", "film-stacks": "stack-pixi",
    "film-fluid-viscous": "fluid-viscous",
    "film-impact-orbit": "signal-freeze-orbit",
    "film-scene-eras": "scene-eras",
  };
  // Old #film-<id> bookmarks for films replaced by another film.
  const FILM_RENAMES = { "film-word-forms": "film-titles" };
  // Old #demo-<id> links for demos that were merged or removed; each opens the card (or variant) that replaced it.
  const DEMO_ALIASES = {
    bounce: "halftone", dithercards: "dithercharacter", ditherpeek: "dithercharacter", ditheravatar: "dithercharacter",
    lit3d: "cjk-solid", smoke: "fluid-smoke", tunnel: "studio-lowpoly", halftonetype: "studio-video-dots",
    coderain: "type", blueprint: "datachart", drawflow: "datachart",
    "studio-flight": "studio-themes", "design-spring-response": "timing",
    // The flat SVG suit-and-phone mascot variant was retired; the cutout character rig replaces it.
    flat: "character-rig",
  };
  window.FXGalleryMeta = Object.freeze({ ...GALLERY, KINDS, NEEDS, STACKS, TILE_FILM_LAYERS, TILE_FILM_LABELS, FILM_BOOKMARKS, FILM_RENAMES, DEMO_ALIASES });
})();
