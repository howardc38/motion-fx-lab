// Editorial Emphasis & Hand-Drawn Marks registration pack (0BSD).
(() => {
  if (!window.FX) return;
  const base = new URL('./editorial/index.js', document.currentScript.src);
  const entries = [
    {
      id: 'type-editorial-strike',
      name: 'Editorial marker strike and revision',
      kind: 'type',
      grade: 'A',
      stacks: ['canvas'],
      period: 5.2,
      hero: 2.6,
      aspect: '16 / 9',
      chips: ['pressure-varied marker', 'caret + tilted serif', 'FX_CUSTOM_TEXT'],
      purpose: 'On warm cotton broadsheet paper, a vermilion felt-marker slashes through a printed claim while a proofreader caret and tilted italic correction write in above it.',
    },
    {
      id: 'type-cipher',
      name: 'Cryptographic glyph lock',
      kind: 'type',
      grade: 'A',
      stacks: ['canvas'],
      period: 4.8,
      hero: 2.1,
      aspect: '16 / 9',
      chips: ['4-strata glyph scramble', 'left-to-right phosphor lock', 'FX_CUSTOM_TEXT'],
      purpose: 'Characters cycle deterministically through block density, Katakana, hex and symbol strata before locking left-to-right with an emerald phosphor flash.',
    },
    {
      id: 'type-split-cut',
      name: 'Laser midline split and shear',
      kind: 'type',
      grade: 'A',
      stacks: ['canvas'],
      period: 4.8,
      hero: 1.8,
      aspect: '16 / 9',
      chips: ['half-plane polygon clip', 'spring shear recoil', 'FX_CUSTOM_TEXT'],
      purpose: 'An incandescent diagonal laser slices heavy display type in two, shearing upper and lower half-planes apart with spring recoil before snapping shut.',
    },
    {
      id: 'type-knockout',
      name: 'Live cinema knockout and counter zoom',
      kind: 'type',
      grade: 'A',
      stacks: ['canvas'],
      period: 5.6,
      hero: 2.5,
      aspect: '16 / 9',
      chips: ['destination-out type mask', 'procedural golden-hour vista', 'counter zoom-through'],
      purpose: 'Heavy condensed display lettering acts as a live knockout aperture onto a moving golden-hour ocean vista before zooming through the centre counter to full bleed.',
    },
    {
      id: 'svg-hand-circle',
      name: 'Hand-drawn financial table marks',
      kind: 'ui',
      grade: 'A',
      stacks: ['svg', 'css'],
      period: 4.8,
      hero: 2.4,
      aspect: '16 / 9',
      chips: ['double-loop Bézier circle', 'dual-layer marker stroke', 'curved margin arrow'],
      purpose: 'Organic double-loop marker circles, underlines and a curved margin arrow draw progressively over key cohort figures on an editorial financial table.',
    },
  ];

  window.FXEditorial = {
    studies: entries,
    create: (id, options = {}) => import(base.href).then((m) => m.create(id, options)),
  };

  for (const entry of entries) {
    FX.demo({
      ...entry,
      build(stage) {
        let inst = null;
        const ready = window.FXEditorial.create(entry.id).then((e) => {
          inst = e;
          const node = e.element || e.canvas;
          if (!node.classList.contains('fill')) node.classList.add('fill');
          Object.assign(node.style, { width: '100%', height: '100%', display: 'block' });
          stage.append(node);
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
