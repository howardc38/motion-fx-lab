// Editorial Dual-Axis Charts, Decision Trees & Vector Bézier Construction pack (0BSD).
(() => {
  if (!window.FX) return;
  const base = new URL('./editorial-data/index.js', document.currentScript.src);
  const entries = [
    {
      id: 'nyt-dual-chart',
      name: 'Editorial dual-axis revenue and rate chart',
      kind: 'ui',
      grade: 'A',
      stacks: ['canvas'],
      period: 6.0,
      hero: 3.6,
      aspect: '16 / 9',
      chips: ['staggered spring bars', 'synced secondary curve', 'broadsheet typography', 'FX_CUSTOM_TEXT'],
      purpose: 'Broadsheet editorial charting on warm newsprint: quarterly bars rise on staggered springs alongside a synchronized secondary-axis conversion curve and peak callout pin.',
    },
    {
      id: 'decision-tree',
      name: 'Animated branching decision tree',
      kind: 'ui',
      grade: 'A',
      stacks: ['canvas'],
      period: 5.8,
      hero: 3.4,
      aspect: '16 / 9',
      chips: ['orthogonal elbow draw', 'active path illumination', 'outcome badge pop', 'FX_CUSTOM_TEXT'],
      purpose: 'Three-tier orthogonal decision tree draws elbow connectors down each branch, illuminating the winning route with latency telemetry while receding alternate branches dim.',
    },
    {
      id: 'vector-bezier-draw',
      name: 'Vector pen, Bézier handles and width construction',
      kind: 'motion',
      grade: 'A',
      stacks: ['canvas'],
      period: 6.0,
      hero: 3.1,
      aspect: '16 / 9',
      chips: ['live Bézier levers', 'variable-width caliper', 'enamel dial fill', 'FX_CUSTOM_TEXT'],
      purpose: 'A drafting pen places symmetrical Bézier anchors and pulls tangent handles, a variable-width caliper sculpts the stroke taper, and a color dial floods the finished emblem with enamel gradients.',
    },
  ];

  window.FXEditorialData = {
    studies: entries,
    create: (id, options = {}) => import(base.href).then((m) => m.create(id, options)),
  };

  for (const entry of entries) {
    FX.demo({
      ...entry,
      build(stage) {
        let inst = null;
        const ready = window.FXEditorialData.create(entry.id).then((e) => {
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
