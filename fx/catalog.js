// Presentation catalogue. Registered demo IDs stay stable for existing films.
// A technique owns its variants; collections and finished combinations are not
// counted as additional techniques merely because they have another demo ID.
(() => {
  const variants = {
    'signal-audio-relief': 'studio-depth-dots',
    'signal-freeze-orbit': 'studio-freeze-orbit',
    'stack-pixi': 'liquid',
    halftonetype: 'studio-video-dots',
    orbs: 'gradient',
    'design-letter-flow': 'chars',
    'design-spring-response': 'timing',
    'design-dot-reveal': 'wipe',
    'fluid-viscous': 'fluid-overflow',
    'water-morph': 'clay',
    'cjk-solid': 'lit3d',
    'frame-glitch': 'glitch',
    dithercards: 'dithercharacter',
    ditherpeek: 'dithercharacter',
    ditheravatar: 'dithercharacter',
    bounce: 'halftone',
    'studio-dot-rhythm': 'studio-video-dots',
    blueprint: 'datachart',
    drawflow: 'datachart',
    particles: 'gpuparticles',
    morph: 'optical-morph',
    'studio-lowpoly': 'tunnel',
  };
  const collections = new Set(['styles', 'studio-themes', 'studio-gallery', 'water-underwater', 'scene-eras']);
  const names = {
    'studio-depth-dots': 'Image relief',
    'studio-freeze-orbit': 'Freeze frame and camera orbit',
    liquid: 'Image displacement',
    gradient: 'Soft colour fields',
    ring: 'Countdown ring',
    chars: 'Staggered letter animation',
    clay: "3D shape blending",
    lit3d: "Solid lettering",
    glitch: "Signal breakup",
    dithercharacter: 'Dithered character',
    halftone: 'Halftone character',
    'studio-video-dots': 'Image and footage halftone dots',
    datachart: 'Stroke reveal and diagrams',
    gpuparticles: 'Particle flow into type',
    'optical-morph': 'Shape morphing',
    tunnel: 'Camera flythrough',
  };
  const descriptions = {
    'studio-depth-dots': 'Turn image samples into shallow depth. Compare a dot surface with solid cells driven by measured sound energy.',
    'studio-freeze-orbit': 'Hold a real 3D pose while the camera moves. Choose a direct comparison or an impact sequence with changing lights and surface treatment.',
    liquid: 'Warp a flat image with a moving displacement field. Choose glass-like distortion or the filtered poster variation.',
    gradient: 'Animate soft fields of colour behind readable text. Choose a low-contrast wash or drifting glow orbs.',
    ring: 'A radial progress stroke and numeric countdown show time remaining.',
    chars: 'Stagger letter entry and settle into a readable word. Choose a pop or a curved reflow.',
    dissolve: 'Noise erodes a lit text surface; a bright edge travels across it before it disappears.',
    rigid: 'Simulated gravity, collisions and stacking, followed by a tilting floor.',
    reaction: 'A seeded reaction–diffusion field grows organic patterns out of lettering.',
    sticker: 'Labels enter with staggered scale and rotation, outlined borders and shadows.',
    mark: 'A moving highlight draws attention to a chosen line of text.',
    scan: 'A scan line moves over a list and reveals each item’s check state.',
    stamp: 'Combine a flash, shake and stamped label for a short impact beat.',
    clay: "Blend implicit 3D forms and split or merge their surfaces. Compare opaque ray-marched clay with a transparent reconstructed mesh.",
    lit3d: "Extruded lettering with lit faces and depth. Compare Latin samples with bevelled CJK outlines.",
    glitch: "Displace slices and colour channels. Choose a text-only treatment or a full-frame image effect.",
    dithercharacter: 'Three-ink character rendering. Choose a portrait, card fan, logo ending or narrator composition.',
    halftone: 'A halftone-shaded character, with waving and squash-and-stretch motion variants.',
    'studio-video-dots': 'Sample an image into a screen-space dot field. Compare footage, rhythmic palettes or letter shapes; changing the source does not add a new family.',
    datachart: 'Progressive stroke reveals, shown as a data chart, annotated diagram or process flow.',
    gpuparticles: 'Particles flow into sampled lettering. Compare the dense curl-field version with the lighter point animation.',
    'optical-morph': 'Interpolate shape contours. Compare arbitrary concave paths with a spring-driven polar morph.',
    tunnel: 'Travel through a three-dimensional scene. Choose a line tunnel or a low-poly city course.',
  };
  const byId = new Map();
  for (const demo of FX.DEMOS) {
    if (byId.has(demo.id)) throw new Error('Duplicate demo ID: ' + demo.id);
    const entry = { ...demo, role: collections.has(demo.id) ? 'showcase' : variants[demo.id] ? 'variant' : 'technique', familyId: variants[demo.id] || demo.id };
    if (['studio-video-dots', 'studio-dot-rhythm', 'studio-dot-impact', 'studio-echo', 'studio-time-remap'].includes(demo.id)) entry.stacks = ['canvas'];
    if (['studio-skin-cloud', 'studio-freeze-orbit', 'studio-particle-lens'].includes(demo.id)) entry.stacks = ['canvas', 'three', 'glsl'];
    if (demo.id === 'lut') { entry.grade = 'A'; entry.chips = ['CSS colour filters', 'background glow']; }
    byId.set(entry.id, entry);
  }
  for (const [id, parent] of Object.entries(variants)) {
    if (!byId.has(id) || !byId.has(parent)) throw new Error('Unknown catalogue relation: ' + id + ' → ' + parent);
  }
  for (const id of collections) if (!byId.has(id)) throw new Error('Unknown showcase: ' + id);
  const families = [...byId.values()].filter(e => e.role === 'technique').map(entry => ({
    id: entry.id,
    name: names[entry.id] || entry.name,
    purpose: descriptions[entry.id] || entry.purpose,
    kind: entry.kind,
    entries: [entry, ...[...byId.values()].filter(e => e.role === 'variant' && e.familyId === entry.id)],
  }));
  const showcases = [...byId.values()].filter(e => e.role === 'showcase').map(entry => ({ id: entry.id, name: entry.name, purpose: entry.purpose, kind: entry.kind, entries: [entry] }));
  const stats = Object.freeze({ techniques: families.length, variants: Object.keys(variants).length, showcases: showcases.length, demos: byId.size });
  window.FXCatalog = { families, showcases, byId, stats };
})();
