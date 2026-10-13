// Plush fur family: shell fur with silhouette fins, fur self-shadowing and contact shading, CC0
// photographed pile, soft-toy secondary motion and a path brushed into the pile. The modules live
// in fx/plush/ and load on demand (three.js r180 import map).
(() => {
  const base = new URL('./plush/effect.js', document.currentScript.src);
  window.FXPlush = {create: options => import(base.href).then(m => m.createPlushFur(options))};
  FX.demo({id: 'plush-fur', name: 'Plush fur', kind: 'shader', grade: 'B', stacks: ['three', 'glsl'],
    chips: ['shell fur + silhouette fins', 'fur self-shadow / contact AO', 'brushed pile, motion drag'],
    purpose: 'A backlit plush bear draws a heart in its own belly fur, then giggles and shakes: the pile whips, fluffs back up and settles. Shell fur, edge fins, self-shadowing and a CC0 teddy pile, all in a WebGL shader.',
    period: 6, hero: 2.85, aspect: '16 / 9',
    build(stage) {
      const ready = FXPlush.create({width: 960, height: 540}).then(e => { e.canvas.className = 'fill'; Object.assign(e.canvas.style, {display: 'block', width: '100%', height: '100%'}); stage.append(e.canvas); return e; });
      return {ready, frame: async t => (await ready).frame(t)};
    }});
})();
