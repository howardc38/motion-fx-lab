// Refractive Glass, Liquid Glass UI & Procedural Optical Shader Worlds pack (0BSD).
(() => {
  if (!window.FX) return;
  const base = new URL('./refraction/index.js', document.currentScript.src);
  const entries = [
    {
      id: 'glass-shard-title',
      name: 'Voronoi 3D glass shard title',
      kind: 'shader',
      grade: 'B',
      stacks: ['glsl', 'canvas'],
      period: 6.0,
      hero: 2.85,
      aspect: '16 / 9',
      chips: ['Voronoi fracture shards', 'chromatic Snell refraction', 'studio HDR glints', 'FX_CUSTOM_TEXT'],
      purpose: 'A beveled title glass plate fractures along seeded Voronoi seams into tumbling 3D refractive shards with prismatic dispersion and studio softbox glints before reassembling seamlessly.',
    },
    {
      id: 'liquid-glass-ui',
      name: 'Liquid glass optical UI widgets',
      kind: 'ui',
      grade: 'B',
      stacks: ['glsl', 'canvas'],
      period: 6.0,
      hero: 2.9,
      aspect: '16 / 9',
      chips: ['SDF meniscus refraction', 'RGB edge dispersion', 'specular caustic rim', 'FX_CUSTOM_TEXT'],
      purpose: 'Curved squircle glass UI cards and capsules optically bend and disperse bold moving editorial typography beneath them with Snell meniscus lensing and specular rim caustics.',
    },
    {
      id: 'aurora-shaders',
      name: 'Curtain aurora borealis shader',
      kind: 'backdrop',
      grade: 'B',
      stacks: ['glsl'],
      period: 7.2,
      hero: 3.2,
      aspect: '16 / 9',
      chips: ['4-layer ray curtains', 'periodic seamless loop', 'pure WebGL1 GLSL'],
      purpose: 'Four undulating vertical aurora curtains shimmer across a starry polar horizon in a seamless periodic GLSL fragment shader.',
    },
    {
      id: 'shader-prism-frost',
      name: 'Prismatic frost and Voronoi caustics',
      kind: 'backdrop',
      grade: 'B',
      stacks: ['glsl'],
      period: 7.2,
      hero: 2.6,
      aspect: '16 / 9',
      chips: ['Voronoi crystal facets', 'spectral dispersion', 'periodic seamless loop'],
      purpose: 'Animated cellular crystal facets refract directional studio light into frosted ice textures and prismatic chromatic seams.',
    },
    {
      id: 'shader-nebula-plasma',
      name: 'Deep-space nebula and solar plasma',
      kind: 'backdrop',
      grade: 'B',
      stacks: ['glsl'],
      period: 7.2,
      hero: 3.0,
      aspect: '16 / 9',
      chips: ['domain-warped FBM', 'luminous plasma ridges', 'periodic seamless loop'],
      purpose: 'Dual-stage domain-warped FBM clouds sculpt cosmic dust filaments and luminous ionized plasma ridges around a glowing core.',
    },
    {
      id: 'shader-marble-obsidian',
      name: 'Liquid marble and obsidian ripples',
      kind: 'backdrop',
      grade: 'B',
      stacks: ['glsl'],
      period: 7.2,
      hero: 2.8,
      aspect: '16 / 9',
      chips: ['silk curl veining', 'gold inlay seams', 'specular dark relief'],
      purpose: 'Curl-warped silk marble veins and metallic gold seams ripple across a dark specular obsidian surface.',
    },
  ];

  window.FXRefraction = {
    studies: entries,
    create: (id, options = {}) => import(base.href).then((m) => m.create(id, options)),
  };

  for (const entry of entries) {
    FX.demo({
      ...entry,
      build(stage) {
        let inst = null;
        const ready = window.FXRefraction.create(entry.id).then((e) => {
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
