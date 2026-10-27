// Spine-Articulated Boids ASCII Renderer registration pack (0BSD).
(() => {
  if (!window.FX) return;
  const base = new URL('./ascii/index.js', document.currentScript.src);
  const entries = [
    {
      id: 'ascii-spine-boids',
      name: 'Spine-articulated boids ASCII shader',
      kind: 'sim',
      grade: 'A',
      stacks: ['canvas'],
      period: 8.0,
      hero: 3.2,
      aspect: '16 / 9',
      chips: ['20-node caudal spine chain', 'Couzin boid schooling', 'dual-pass slope ASCII'],
      purpose: 'Reef sharks and schooling baitfish swim via pre-warmed Couzin steering and 20-node sinusoidal spine chains, rasterized through a dual-pass slope-aware ASCII shader.',
    },
  ];

  window.FXAscii = {
    studies: entries,
    create: (id, options = {}) => import(base.href).then((m) => m.create(id, options)),
  };

  for (const entry of entries) {
    FX.demo({
      ...entry,
      build(stage) {
        let inst = null;
        const ready = window.FXAscii.create(entry.id).then((e) => {
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
