// Labels and presentation settings for the effect gallery in index.html (read by fx/gallery-page.js).
// The card order and preview defaults between the fx:gallery markers come from fx/manifest.json.
(() => {
  // fx:gallery:start
  // Generated from fx/manifest.json by tools/fx-manifest.cjs; edit the manifest, not this block.
  const GALLERY = {
    order: [
      "signal-motion-fragments", "dialogue-lipsync", "gpuparticles", "domainrep", "optical-foil",
      "fluid-smoke", "liquid", "organic-contours", "studio-depth-dots", "studio-freeze-orbit",
      "design-type-orbit", "water-material", "optical-ribbon", "reaction", "stack-gpu", "clay",
      "optical-moire", "optical-caustic", "dithercharacter", "stack-rapier", "lit3d", "toon",
      "studio-portal", "tunnel", "studio-flight", "vartype", "rhythm", "cardflip", "water-impact",
      "design-surface-ink", "optical-slit", "optical-morph", "studio-particle-lens", "rays",
      "ridgelines", "chrome", "studio-echo", "studio-dot-impact", "studio-skin-cloud",
      "studio-video-dots", "fluid-overflow", "rigid", "smoke", "halftone", "flat", "glitch",
      "dissolve", "studio-time-remap", "design-soft-shadow", "uifly", "whip", "hook", "chars",
      "karaoke", "datachart", "timing", "glass", "coderain", "sweep", "stamp", "beat", "sticker",
      "gradient", "ring", "count", "type", "mark", "scan", "wipe", "lut", "grain", "character-rig",
      "character-style",
    ],
    showcaseOrder: [
      "styles", "studio-themes", "studio-gallery", "water-underwater", "scene-eras",
    ],
    previewDefault: { "lit3d": "cjk-solid", "tunnel": "studio-lowpoly", "studio-depth-dots": "signal-audio-relief", "studio-freeze-orbit": "signal-freeze-orbit" },
    previewHero: { "gpuparticles": 1.5 },
  };
  // fx:gallery:end
  const KINDS = { shader: "Materials & image treatments", sim: "Physics & growth", character: "Characters", motion: "Motion & timing", backdrop: "Backgrounds", ui: "UI & data", type: "Type" };
  // What a tile needs beyond the page itself.
  const NEEDS = { "A": ["Base stack only", "Needs nothing beyond HTML, CSS, SVG, Canvas and the existing three.js core"],
    "A+": ["Plus a three.js add-on", "Uses three.js add-ons, such as post-processing or animated GLB loading"],
    "B": ["Custom shader", "Needs a GLSL shader written for it"], "C": ["Plus a library", "Needs one more library"], "D": ["Offline Blender bake", "Playback uses cached frames; changing the simulation requires Blender"] };
  const STACKS = { blender: "Blender (offline)", css: "HTML/CSS", svg: "SVG", canvas: "Canvas 2D", three: "Three.js", glsl: "Custom GLSL", physics: "Matter.js", flubber: "Flubber", pixi: "PixiJS", rapier: "Rapier", webgpu: "WebGPU / TSL" };
  // Films offered under an effect tile. Which effects a film shows comes from window.FXFilms
  // (examples/films.json); a film is offered when its layer is listed here or its id has a label.
  const TILE_FILM_LAYERS = ["effect-film"];
  const TILE_FILM_LABELS = {
    "character-lipsync": "Watch the 9.6 s lip-sync film with sound",
    "audio-relief": "Watch the 12 s study with sound",
    "motion-fragments": "Watch the 12 s study with sound",
    "impact-orbit": "Watch the 12 s study with sound",
    "dot-story": "Watch the finished film",
    "ink-city": "Watch the related study",
    "shadow-lab": "Watch the related study",
    "fluid-overflow": "Watch the full 9.6 s render",
    "fluid-smoke": "Watch the full 9.6 s render",
    "fluid-viscous": "Watch the archived material study",
    "optical": "Compare six optical treatments",
    "stacks": "Watch the three-operation sampler",
    "scene-eras": "Compare eight room treatments",
  };
  // Old #film-<id> bookmarks for films that left the film list; they now open the related effect.
  const FILM_BOOKMARKS = {
    "film-ink-city": "design-surface-ink", "film-shadow-lab": "design-soft-shadow",
    "film-optical": "optical-foil", "film-stacks": "stack-pixi",
    "film-scene-eras": "scene-eras", "film-fluid-viscous": "fluid-viscous",
  };
  window.FXGalleryMeta = Object.freeze({ ...GALLERY, KINDS, NEEDS, STACKS, TILE_FILM_LAYERS, TILE_FILM_LABELS, FILM_BOOKMARKS });
})();
