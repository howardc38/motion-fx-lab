// Die-cut vinyl sticker presenter stage registration pack (0BSD).
(() => {
  if (!window.FX) return;
  const base = new URL('./presenter/index.js', document.currentScript.src);
  const waitFonts = () => (document.fonts?.ready
    ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 600))])
    : Promise.resolve());

  window.FXPresenter = {
    create: async (options = {}) => {
      await waitFonts();
      const mod = await import(base.href);
      return mod.createStickerStage(options);
    },
  };

  FX.demo({
    id: 'sticker-stage',
    name: 'Die-cut sticker presenter stage',
    kind: 'character',
    grade: 'A',
    stacks: ['canvas'],
    chips: ['kiss-cut vinyl contour', '0.22× / 1.0× / 1.7× parallax', 'spring pose swaps'],
    purpose: 'An articulated mascot presenter baked with a thick die-cut white vinyl contour and soft drop shadow guides an editorial evidence card across a 3-plane 2.5D parallax stage, swapping poses with damped squash-and-stretch springs and safe-zone callout bubbles.',
    period: 7.2,
    hero: 2.5,
    aspect: '16 / 9',
    build(stage) {
      let inst = null;
      const ready = window.FXPresenter.create({ width: 1280, height: 720, stage }).then((effect) => {
        inst = effect;
        effect.canvas.className = 'fill';
        effect.canvas.setAttribute('role', 'img');
        effect.canvas.setAttribute('aria-label', 'Die-cut sticker presenter stage');
        Object.assign(effect.canvas.style, { display: 'block', width: '100%', height: '100%' });
        stage.append(effect.canvas);
        return effect;
      });
      return {
        ready,
        frame: (t, opts) => (inst ? inst.frame(t, opts) : ready.then((e) => e.frame(t, opts))),
      };
    },
  });
})();
