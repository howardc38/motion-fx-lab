// Presentation catalogue. Registered demo IDs stay stable for existing films.
// A technique owns its variants; collections and finished combinations are not
// counted as additional techniques merely because they have another demo ID.
// Families whose lead demo is registered with tier: "basic" are Motion basics:
// listed separately (FXCatalog.basics) and not counted as effect families.
(() => {
  const variants = {
    'signal-audio-relief': 'studio-depth-dots',
    'signal-freeze-orbit': 'studio-freeze-orbit',
    'studio-time-remap': 'studio-echo',
    'studio-particle-lens': 'studio-skin-cloud',
    'studio-dot-impact': 'signal-motion-fragments',
    'stack-pixi': 'liquid',
    orbs: 'gradient',
    'design-letter-flow': 'chars',
    'design-dot-reveal': 'wipe',
    'character-motion': 'character-rig',
    'character-style': 'character-rig',
    'fluid-viscous': 'fluid-overflow',
    'water-morph': 'clay',
    'stack-rapier': 'rigid',
    'frame-glitch': 'glitch',
    halftone: 'toon',
    dithercharacter: 'toon',
    'studio-dot-rhythm': 'studio-video-dots',
    particles: 'gpuparticles',
    morph: 'optical-morph',
  };
  const collections = new Set(['styles', 'studio-themes', 'studio-gallery', 'water-underwater', 'scene-eras']);
  const names = {
    'studio-depth-dots': 'Image relief',
    'studio-freeze-orbit': 'Freeze frame and camera orbit',
    'studio-echo': 'Time echoes and speed ramps',
    'studio-skin-cloud': 'Skinned point cloud',
    liquid: 'Image displacement',
    gradient: 'Soft colour fields',
    ring: 'Countdown ring',
    chars: 'Staggered letter animation',
    clay: "3D shape blending",
    'cjk-solid': "Solid lettering",
    glitch: "Signal breakup",
    toon: 'Character shading',
    'studio-video-dots': 'Image and footage halftone dots',
    datachart: 'Stroke reveal',
    gpuparticles: 'Particle flow into type',
    'optical-morph': 'Shape morphing',
    'character-rig': 'Rigged 2D character',
  };
  const descriptions = {
    'studio-depth-dots': 'Turn image samples into shallow depth. Compare a dot surface with solid cells driven by measured sound energy.',
    'studio-freeze-orbit': 'Hold the instant of impact while the camera travels round real 3D geometry, then let time resume. Choose a slam frozen with its debris, dust and shock ring, or the measured fighters as a point cloud.',
    liquid: 'Warp a flat image with a moving displacement field. Choose glass-like distortion or the filtered poster variation.',
    gradient: 'Animate soft fields of colour behind readable text. Choose a low-contrast wash or drifting glow orbs.',
    ring: 'A radial progress stroke and numeric countdown show time remaining.',
    chars: 'Stagger letter entry and settle into a readable word. Choose a pop or a curved reflow.',
    dissolve: 'A burn front crosses a plaster word, glowing white to orange to char and shedding embers; a new word assembles behind it.',
    rigid: 'Simulated gravity, collisions and stacking: heavy letters drop, a ball knocks them apart and they settle. Compare the 2D Matter.js stack with a 3D Rapier domino chain.',
    reaction: 'A seeded reaction–diffusion field grows organic patterns out of lettering.',
    sticker: 'Labels enter with staggered scale and rotation, outlined borders and shadows.',
    mark: 'A moving highlight draws attention to a chosen line of text.',
    scan: 'A scan line moves over a list and reveals each item’s check state.',
    stamp: 'Combine a flash, shake and stamped label for a short impact beat.',
    clay: "Blend implicit 3D forms and split or merge their surfaces. Compare opaque ray-marched clay with a transparent reconstructed mesh.",
    'cjk-solid': "Extruded lettering with lit faces and depth: the flat word whips round once as its extrusion punches out of the face and overshoots, then a light band sweeps the bevels. Bundled CJK outlines plus Latin capitals and digits.",
    glitch: "Displace slices and colour channels. Choose a text-only treatment or a full-frame image effect.",
    toon: 'One 3D explorer robot jumps, turns to camera and lands; then the key light circles it so the shading sweeps across its body. Choose toon bands with an outline, a two-colour halftone print or a two-ink dither.',
    'studio-video-dots': 'Sample an image into a screen-space dot field. Compare footage, rhythmic palettes or letter shapes; changing the source does not add a new family.',
    datachart: 'Progressive stroke reveals, shown as a self-drawing data chart.',
    gpuparticles: 'Particles flow into sampled lettering. Compare the dense curl-field version with the lighter point animation.',
    'optical-morph': 'Interpolate shape contours. Compare arbitrary concave paths with a spring-driven polar morph.',
    'character-rig': 'Bind transparent image parts to named joints and drive them with motion presets: a four-legged cat and a two-legged robot share one renderer. Compare motion presets and eight drawing styles applied to the character itself.',
  };
  // Gallery kind (the Kind filter and the README grouping) where it differs from the registering pack's
  // broad 'shader': flights, particles and point clouds read as 3D space; light and image treatments
  // are kept apart from materials and surfaces; a field of contours is a background.
  const kinds = {
    domainrep: 'space', gpuparticles: 'space', particles: 'space', 'stack-gpu': 'space', 'studio-lowpoly': 'space',
    'studio-skin-cloud': 'space', 'studio-particle-lens': 'space',
    rays: 'light', liquid: 'light', 'stack-pixi': 'light', 'optical-moire': 'light', 'optical-caustic': 'light',
    'studio-video-dots': 'light', 'studio-dot-rhythm': 'light', 'studio-depth-dots': 'light', 'signal-audio-relief': 'light', 'organic-contours': 'backdrop',
  };
  const byId = new Map();
  for (const demo of FX.DEMOS) {
    if (byId.has(demo.id)) throw new Error('Duplicate demo ID: ' + demo.id);
    const entry = { ...demo, kind: kinds[demo.id] || demo.kind, role: collections.has(demo.id) ? 'showcase' : variants[demo.id] ? 'variant' : 'technique', familyId: variants[demo.id] || demo.id };
    if (['studio-video-dots', 'studio-dot-rhythm', 'studio-dot-impact', 'studio-echo', 'studio-time-remap'].includes(demo.id)) entry.stacks = ['canvas'];
    if (['studio-skin-cloud', 'studio-particle-lens'].includes(demo.id)) entry.stacks = ['canvas', 'three', 'glsl'];
    byId.set(entry.id, entry);
  }
  for (const id of Object.keys(kinds)) if (!byId.has(id)) throw new Error('Unknown kind override: ' + id);
  for (const [id, parent] of Object.entries(variants)) {
    if (!byId.has(id) || !byId.has(parent)) throw new Error('Unknown catalogue relation: ' + id + ' → ' + parent);
  }
  for (const id of collections) if (!byId.has(id)) throw new Error('Unknown showcase: ' + id);
  // A family takes its tier from its lead demo; variants follow their family.
  for (const entry of byId.values()) entry.tier = byId.get(entry.familyId).tier === 'basic' ? 'basic' : 'effect';
  const groups = [...byId.values()].filter(e => e.role === 'technique').map(entry => ({
    id: entry.id,
    name: names[entry.id] || entry.name,
    purpose: descriptions[entry.id] || entry.purpose,
    kind: entry.kind,
    tier: entry.tier,
    entries: [entry, ...[...byId.values()].filter(e => e.role === 'variant' && e.familyId === entry.id)],
  }));
  const families = groups.filter(f => f.tier !== 'basic'), basics = groups.filter(f => f.tier === 'basic');
  const showcases = [...byId.values()].filter(e => e.role === 'showcase').map(entry => ({ id: entry.id, name: entry.name, purpose: entry.purpose, kind: entry.kind, entries: [entry] }));
  const stats = Object.freeze({ techniques: families.length, basics: basics.length, variants: Object.keys(variants).length, showcases: showcases.length, demos: byId.size });
  window.FXCatalog = { families, basics, showcases, byId, stats };
})();
