// Sumi-e Ink & Sakuga Impact Pack registration pack (0BSD).
(() => {
  if (!window.FX) return;
  const base = new URL('./sakuga/index.js', document.currentScript.src);
  const entries = [
    {
      id: 'ink-slash',
      name: 'Sumi-e dry-brush slash and seal',
      kind: 'motion',
      grade: 'A',
      stacks: ['canvas'],
      period: 4.8,
      hero: 1.55,
      aspect: '16 / 9',
      chips: ['44-bristle Feibai split', '1.35x hit-stop punch', 'Enso ring + cinnabar seal'],
      purpose: 'A dry-brush Sumi calligraphy slash whips across fibrous Xuan paper with a 1.35x hit-stop punch, expanding Enso shockwave, ink droplets and a carved cinnabar seal.',
    },
    {
      id: 'ink-impact-frame',
      name: 'Sakuga binary impact frames',
      kind: 'light',
      grade: 'A',
      stacks: ['canvas'],
      period: 4.4,
      hero: 1.32,
      aspect: '16 / 9',
      chips: ['3-frame binary inversion', 'radial lightning wedges', 'chromatic shockwave + debris'],
      purpose: 'Spiralling charge arcs detonate into a 3-frame high-contrast black-and-white Sakuga radial lightning flash with a chromatic shock ring before ballistic debris settles.',
    },
    {
      id: 'ink-bleed-wipe',
      name: 'Organic Xuan ink-bleed wipe',
      kind: 'motion',
      grade: 'B',
      stacks: ['glsl'],
      period: 5.2,
      hero: 2.4,
      aspect: '16 / 9',
      chips: ['6-octave domain-warped fBm', 'capillary fiber feathering', 'pigment rim wipe'],
      purpose: 'Wet Sumi ink strikes fibrous Xuan paper and bleeds organically via multi-octave domain-warped fBm dendrites to transition between dawn mountain mist and moonlit bamboo.',
    },
  ];

  window.FXSakuga = {
    studies: entries,
    create: (id, options = {}) => import(base.href).then((m) => m.create(id, options)),
  };

  for (const entry of entries) {
    FX.demo({
      ...entry,
      build(stage) {
        let inst = null;
        const ready = window.FXSakuga.create(entry.id).then((e) => {
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
