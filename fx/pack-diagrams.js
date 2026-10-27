// Business Data Diagrams & Flowing Architecture registration pack (0BSD).
(() => {
  if (!window.FX) return;
  const base = new URL('./diagrams/index.js', document.currentScript.src);
  const entries = [
    {
      id: 'data-node-flow',
      name: 'Directed architecture node flow',
      kind: 'ui',
      grade: 'A',
      stacks: ['canvas'],
      period: 6.0,
      hero: 2.8,
      aspect: '16 / 9',
      chips: ['cubic Bézier ports', 'comet data packets', 'node arrival pulses'],
      purpose: 'A four-stage inference architecture graph routes glowing comet packets along cubic Bézier ports, firing node activation pulses and live tabular throughput counters.',
    },
    {
      id: 'data-donut',
      name: 'Exploded categorical donut chart',
      kind: 'ui',
      grade: 'A',
      stacks: ['canvas'],
      period: 5.4,
      hero: 2.7,
      aspect: '16 / 9',
      chips: ['staggered spring arcs', 'radial slice explode', 'tabular-nums legend'],
      purpose: 'Five categorical budget segments sweep open on staggered springs before the hero slice detaches radially with 45° leader callouts and a synchronized tabular legend.',
    },
    {
      id: 'data-map-route',
      name: 'Great-circle cartographic route',
      kind: 'ui',
      grade: 'A',
      stacks: ['canvas'],
      period: 5.8,
      hero: 3.1,
      aspect: '16 / 9',
      chips: ['geodesic arc draw', 'radar hub beacons', 'live distance telemetry'],
      purpose: 'Across a stylized Pacific-Rim coastline and graticule map, dashed great-circle arcs connect radar-pulsing HKG, TYO and SFO hubs with live flight telemetry.',
    },
    {
      id: 'data-timeline',
      name: 'Panning causal milestone spine',
      kind: 'ui',
      grade: 'A',
      stacks: ['canvas'],
      period: 6.0,
      hero: 3.4,
      aspect: '16 / 9',
      chips: ['horizontal camera pan', 'sequential spring nodes', '2022–2026 causal spine'],
      purpose: 'A horizontal camera pans along a progressing 2022–2026 causal spine as dated milestone rings and alternating detail cards pop sequentially into place.',
    },
  ];

  window.FXDiagrams = {
    studies: entries,
    create: (id, options = {}) => import(base.href).then((m) => m.create(id, options)),
  };

  for (const entry of entries) {
    FX.demo({
      ...entry,
      build(stage) {
        let inst = null;
        const ready = window.FXDiagrams.create(entry.id).then((e) => {
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
