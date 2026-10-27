// Presentation catalogue. Registered demo IDs stay stable for existing films.
// A technique owns its variants; collections and finished combinations are not
// counted as additional techniques merely because they have another demo ID.
// Families whose lead demo is registered with tier: "basic" are Motion basics:
// listed separately (FXCatalog.basics) and not counted as effect families.
(() => {
  const variants = {
    'graphic-flap': 'cardflip',
    'graphic-spatial': 'design-type-orbit',
    'graphic-tiles': 'rhythm',
    'graphic-led': 'studio-video-dots',
    'graphic-echo': 'studio-echo',
    'signal-audio-relief': 'studio-depth-dots',
    'signal-freeze-orbit': 'studio-freeze-orbit',
    'studio-time-remap': 'studio-echo',
    'studio-particle-lens': 'studio-skin-cloud',
    'studio-dot-impact': 'signal-motion-fragments',
    'stack-pixi': 'liquid',
    orbs: 'gradient',
    'character-motion': 'character-rig',
    'character-style': 'character-rig',
    'fluid-viscous': 'fluid-overflow',
    'water-morph': 'clay',
    'frame-glitch': 'glitch',
    halftone: 'toon',
    dithercharacter: 'toon',
    'studio-dot-rhythm': 'studio-video-dots',
    particles: 'gpuparticles',
    morph: 'optical-morph',
    'collage-halftone': 'paper-collage',
    'plush-webgpu': 'plush-fur',
    'ui-cmd-palette': 'ui-cursor-loupe',
    'ui-flip-modal': 'ui-cursor-loupe',
    'ui-chat-flow': 'ui-cursor-loupe',
    'ferrofluid-orb': 'cad-telemetry-hud',
    'type-cipher': 'type-editorial-strike',
    'type-split-cut': 'type-editorial-strike',
    'type-knockout': 'type-editorial-strike',
    'svg-hand-circle': 'type-editorial-strike',
    'data-donut': 'data-node-flow',
    'data-map-route': 'data-node-flow',
    'data-timeline': 'data-node-flow',
    'ink-impact-frame': 'ink-slash',
    'ink-bleed-wipe': 'ink-slash',
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
    chars: 'Staggered letter pop',
    clay: "3D shape blending",
    'cjk-solid': "Solid lettering",
    glitch: "Signal breakup",
    toon: 'Character shading',
    'studio-video-dots': 'Image and footage halftone dots',
    datachart: 'Stroke reveal',
    gpuparticles: 'Particle flow into type',
    'optical-morph': 'Shape morphing',
    'character-rig': 'Rigged 2D character',
    'paper-collage': 'Scissor-cut paper collage',
    'plush-fur': 'Plush fur and soft-body physics',
    'ui-cursor-loupe': 'SaaS product and cursor stage',
    'cad-telemetry-hud': '3D-tracked CAD telemetry HUD',
    'type-editorial-strike': 'Editorial markup and kinetic type',
    'data-node-flow': 'Flowing architecture and data diagrams',
    'ink-slash': 'Sumi-e dry-brush and Sakuga impact',
  };
  const descriptions = {
    'studio-depth-dots': 'Turn image samples into shallow depth. Compare a dot surface with solid cells driven by measured sound energy.',
    'studio-freeze-orbit': 'Hold the instant of impact while the camera travels round real 3D geometry, then let time resume. Choose a slam frozen with its debris, dust and shock ring, or the measured fighters as a point cloud.',
    liquid: 'Warp a flat image with a moving displacement field. Choose glass-like distortion or the filtered poster variation.',
    gradient: 'Animate soft fields of colour behind readable text. Choose a low-contrast wash or drifting glow orbs.',
    ring: 'A radial progress stroke and numeric countdown show time remaining.',
    chars: 'Stagger each letter into place so the word settles cleanly on beat.',
    dissolve: 'A burn front crosses a plaster word, glowing white to orange to char and shedding embers; a new word assembles behind it.',
    rigid: 'Simulated 2D gravity, collisions and stacking: heavy letters drop, a ball knocks them apart and they settle.',
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
    'paper-collage': 'Tactile deckle-edged paper cutouts, ransom-note letter plates and CMYK halftone zine clippings unfold with crisp cast shadows.',
    'plush-fur': 'Shell-and-strand plush fur with stitched seams and velvet ears. Compare the warm studio turnaround with interactive 240 Hz Verlet fur and soft-body paw press physics.',
    'ui-cursor-loupe': 'Crisp interface choreography for product launches: a Hermite-spline cursor with a 2.2× optical magnifier loupe, a ⌘K command palette, a FLIP card-to-modal expansion and a live chat stream.',
    'cad-telemetry-hud': 'Real 3D anchor points project zero-lag elbow callouts, Vernier rulers and radial gauges around precision hardware or a harmonic ferrofluid sphere.',
    'type-editorial-strike': 'Authoritative editorial typography: pressure-varied marker strike-throughs, cryptographic glyph locks, laser split-cuts, live cinema knockouts and hand-drawn margin circles.',
    'data-node-flow': 'Structured system and business diagrams: packet-routed architecture graphs, spring-swept donut rings, cartographic great-circle routes and causal milestone timelines.',
    'ink-slash': 'Eastern dry-brush Feibai calligraphy slashes with cinnabar seals, three-frame binary Sakuga impact flashes and fibrous Xuan-paper ink-bleed transitions.',
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
