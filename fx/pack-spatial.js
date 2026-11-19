// Spatial 3D Portals, Extruded Code Slab, Canopy Parting & Multi-Device Flythrough pack (0BSD).
(() => {
  if (!window.FX) return;
  const base = new URL('./spatial/index.js', document.currentScript.src);
  const entries = [
    {
      id: 'wireframe-portal',
      name: '3D wireframe portal title',
      kind: 'space',
      grade: 'A',
      stacks: ['three', 'canvas'],
      period: 6.0,
      hero: 2.8,
      aspect: '16 / 9',
      chips: ['nested chamfer portals', 'perspective depth fog', 'floating focal title', 'FX_CUSTOM_TEXT'],
      purpose: 'The camera glides through eighteen nested architectural wireframe portal frames along a perspective guide corridor toward a suspended glowing title.',
    },
    {
      id: 'code-3d-extrude',
      name: '3D extruded syntax code slab',
      kind: 'type',
      grade: 'A',
      stacks: ['three', 'canvas'],
      period: 6.0,
      hero: 2.9,
      aspect: '16 / 9',
      chips: ['ExtrudeGeometry bevel', 'syntax-highlighted Retina face', 'sweeping execution beam', 'FX_CUSTOM_TEXT'],
      purpose: 'A machined dark-anodized 3D beveled slab displays crisp syntax-highlighted code with a live execution beam as studio rim lights orbit its edges.',
    },
    {
      id: 'canopy-part-title',
      name: 'Botanical canopy parting and bokeh reveal',
      kind: 'motion',
      grade: 'A',
      stacks: ['canvas'],
      period: 5.6,
      hero: 2.75,
      aspect: '16 / 9',
      chips: ['3-plane veined foliage', 'progressive foreground bokeh', 'sunlit dust motes', 'FX_CUSTOM_TEXT'],
      purpose: 'Multi-plane veined tropical leaves with progressive depth-of-field blur sweep apart on damped spring arcs, revealing an editorial serif title in warm sunlight.',
    },
    {
      id: 'device-flythrough',
      name: '3D multi-device UI flythrough',
      kind: 'ui',
      grade: 'A',
      stacks: ['three', 'canvas'],
      period: 6.4,
      hero: 3.1,
      aspect: '16 / 9',
      chips: ['desktop · tablet · phone 3D', 'luminous Catmull-Rom orb', 'live procedural screens', 'FX_CUSTOM_TEXT'],
      purpose: 'A glowing guide orb connects floating 3D desktop, tablet and smartphone frames in continuous depth space while live dashboards and approval states play across every screen.',
    },
  ];

  window.FXSpatial = {
    studies: entries,
    create: (id, options = {}) => import(base.href).then((m) => m.create(id, options)),
  };

  for (const entry of entries) {
    FX.demo({
      ...entry,
      build(stage) {
        let inst = null;
        const ready = window.FXSpatial.create(entry.id).then((e) => {
          inst = e;
          e.canvas.className = 'fill';
          Object.assign(e.canvas.style, { width: '100%', height: '100%', display: 'block' });
          stage.append(e.canvas);
          return e;
        });
        return {
          ready,
          frame: (t, opts) => (inst ? inst.frame(t, opts) : ready.then((e) => e.frame(t, opts))),
        };
      },
    });
  }
})();
