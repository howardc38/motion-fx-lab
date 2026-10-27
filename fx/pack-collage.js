// Cut-paper editorial collage family: scissored & deckle-torn paper stocks, translucent masking tape
// slaps, brass pin mounts, duotone newsprint halftone screens and deterministic zdoc camera motion.
(() => {
  if (!window.FX) return;
  const base = new URL('./collage/index.js', document.currentScript.src);
  const waitFonts = () => (document.fonts?.ready
    ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 600))])
    : Promise.resolve());

  window.FXCollage = {
    create: async (options = {}) => {
      await waitFonts();
      const m = await import(base.href);
      return m.createPaperCollage(options);
    },
  };

  const mount = (stage, label, options) => {
    const ready = window.FXCollage.create({ width: 1280, height: 720, stage, ...options }).then(effect => {
      effect.canvas.className = 'fill';
      effect.canvas.setAttribute('role', 'img');
      effect.canvas.setAttribute('aria-label', label);
      Object.assign(effect.canvas.style, { display: 'block', width: '100%', height: '100%' });
      stage.append(effect.canvas);
      return effect;
    });
    return { ready, frame: async t => (await ready).frame(t) };
  };

  FX.demo({
    id: 'paper-collage',
    name: 'Cut-paper editorial collage',
    kind: 'type',
    grade: 'A',
    stacks: ['canvas'],
    chips: ['scissored + deckle-torn paper', 'masking tape + brass pins', 'zdoc parallax camera'],
    purpose: 'Multi-layer cream, kraft, vermilion and cobalt paper stocks assemble with hand-scissored facets and exposed cotton deckle edges: masking tape strips slap down on beat, a cut-paper headline punches in and a 2.5D camera pushes across the spread.',
    period: 6.4,
    hero: 2.6,
    aspect: '16 / 9',
    build: stage => mount(stage, 'Cut-paper editorial collage', { mode: 'editorial' }),
  });

  FX.demo({
    id: 'collage-halftone',
    name: 'Duotone newsprint halftone',
    kind: 'light',
    grade: 'A',
    stacks: ['canvas'],
    chips: ['45° / 15° duotone dot screen', 'torn kraft reveal', 'distressed ink seal + brass pin'],
    purpose: 'A kraft cover sheet tears diagonally back to reveal a two-angle cobalt and black halftone print pinned to the board, paired with an 8× rosette magnifier card and a distressed red press-proof stamp.',
    period: 6.0,
    hero: 2.4,
    aspect: '16 / 9',
    build: stage => mount(stage, 'Duotone newsprint halftone', { mode: 'halftone' }),
  });
})();
