// Presentation catalogue. Registered demo IDs stay stable for existing films.
// A technique owns its variants; collections and finished combinations are not
// counted as additional techniques merely because they have another demo ID.
(() => {
  const variants = {
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
  const collections = new Set(['styles', 'studio-themes', 'studio-gallery']);
  const names = {
    dithercharacter: 'Dithered character',
    halftone: 'Halftone character',
    'studio-video-dots': 'Footage halftone dots',
    datachart: 'Stroke reveal and diagrams',
    gpuparticles: 'Particle flow into type',
    'optical-morph': 'Shape morphing',
    tunnel: 'Camera flythrough',
  };
  const descriptions = {
    dithercharacter: 'Three-ink character rendering. Choose a portrait, card fan, logo ending or narrator composition.',
    halftone: 'A halftone-shaded character, with waving and squash-and-stretch motion variants.',
    'studio-video-dots': 'Sample footage into a dot field. Choose steady ink or beat-driven spacing and palettes.',
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
