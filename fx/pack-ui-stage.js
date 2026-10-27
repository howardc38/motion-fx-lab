// SaaS Product & Cursor Stage registration pack (0BSD).
(() => {
  if (!window.FX) return;
  const base = new URL('./ui-stage/index.js', document.currentScript.src);
  const entries = [
    {
      id: 'ui-cursor-loupe',
      name: 'Cursor spline and optical loupe',
      kind: 'ui',
      grade: 'A',
      stacks: ['canvas'],
      period: 6.0,
      hero: 2.6,
      aspect: '16 / 9',
      chips: ['piecewise Hermite cursor', '2.2x vector optical loupe', 'spring click ripple'],
      purpose: 'A virtual cursor follows a piecewise-Hermite spline across a SaaS dashboard, clicking controls while a 2.2x circular optical loupe magnifies live UI states.',
    },
    {
      id: 'ui-cmd-palette',
      name: 'Command palette choreography',
      kind: 'ui',
      grade: 'A',
      stacks: ['canvas'],
      period: 5.6,
      hero: 2.3,
      aspect: '16 / 9',
      chips: ['spring modal pop', 'fuzzy match highlight', 'FX_CUSTOM_TEXT'],
      purpose: 'A command palette springs over a recessed workspace, types a deterministic query, glides across fuzzy-ranked matches and confirms with a deployment toast.',
    },
    {
      id: 'ui-flip-modal',
      name: 'FLIP bento inspector modal',
      kind: 'ui',
      grade: 'A',
      stacks: ['canvas'],
      period: 5.4,
      hero: 2.4,
      aspect: '16 / 9',
      chips: ['FLIP box + radius morph', 'recessed sibling cards', 'cohort detail reveal'],
      purpose: 'A selected bento card expands via deterministic FLIP geometry and corner-radius interpolation into a full revenue inspector while sibling cards recess.',
    },
    {
      id: 'ui-chat-flow',
      name: 'Streaming copilot thread',
      kind: 'ui',
      grade: 'A',
      stacks: ['canvas'],
      period: 6.4,
      hero: 3.8,
      aspect: '16 / 9',
      chips: ['3-dot typing wave', 'spring scroll displacement', 'inline metric chip'],
      purpose: 'A two-party AI incident thread scrolls upward on damped springs as typing indicators morph into structured replies, inline telemetry chips and read ticks.',
    },
  ];

  window.FXUiStage = {
    studies: entries,
    create: (id, options = {}) => import(base.href).then((m) => m.create(id, options)),
  };

  for (const entry of entries) {
    FX.demo({
      ...entry,
      build(stage) {
        let inst = null;
        const ready = window.FXUiStage.create(entry.id).then((e) => {
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
