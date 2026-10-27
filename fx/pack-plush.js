// Plush fur family: shell fur with silhouette fins, fur self-shadowing and contact shading, CC0
// photographed pile, soft-toy secondary motion, brushed pile tracks, and 240 Hz WebGPU Verlet
// fur physics with soft-body contact denting. Loaded on demand (three.js r180 import map).
(() => {
  if (!window.FX) return;
  const furBase = new URL('./plush/effect.js', document.currentScript.src);
  const gpuBase = new URL('./plush/webgpu.js', document.currentScript.src);

  window.FXPlush = {
    create: (options) => import(furBase.href).then((m) => m.createPlushFur(options)),
    createWebGPU: (options) => import(gpuBase.href).then((m) => m.createPlushWebGPU(options)),
  };

  FX.demo({
    id: 'plush-fur',
    name: 'Plush fur',
    kind: 'shader',
    grade: 'B',
    stacks: ['three', 'glsl'],
    chips: ['shell fur + silhouette fins', 'fur self-shadow / contact AO', 'brushed pile, motion drag'],
    purpose: 'A backlit plush bear draws a heart in its own belly fur, then giggles and shakes: the pile whips, fluffs back up and settles. Shell fur, edge fins, self-shadowing and a CC0 teddy pile, all in a WebGL shader.',
    period: 6,
    hero: 2.85,
    aspect: '16 / 9',
    build(stage) {
      const ready = FXPlush.create({ width: 960, height: 540 }).then((e) => {
        e.canvas.className = 'fill';
        e.canvas.setAttribute('role', 'img');
        e.canvas.setAttribute('aria-label', 'Plush fur');
        Object.assign(e.canvas.style, { display: 'block', width: '100%', height: '100%' });
        stage.append(e.canvas);
        return e;
      });
      return { ready, frame: async (t) => (await ready).frame(t) };
    },
  });

  FX.demo({
    id: 'plush-webgpu',
    name: 'Interactive Verlet fur physics (WebGPU)',
    kind: 'sim',
    grade: 'B',
    stacks: ['three', 'webgpu'],
    chips: ['240 Hz WGSL Verlet guides', 'soft-body contact dent + rebound', '0.5 s state checkpoints + WebGL2 fallback'],
    purpose: 'Over 23,000 guide strands simulated at 240 Hz in WebGPU compute part, flatten and drag under paw rubs and a tactile belly presser while the plush skin dents inward and springs back, then whips and overshoots on a joyful hop.',
    period: 6,
    hero: 2.6,
    aspect: '16 / 9',
    build(stage) {
      const ready = FXPlush.createWebGPU({ width: 960, height: 540 }).then((e) => {
        e.canvas.className = 'fill';
        e.canvas.setAttribute('role', 'img');
        e.canvas.setAttribute('aria-label', 'Interactive Verlet fur physics (WebGPU)');
        Object.assign(e.canvas.style, { display: 'block', width: '100%', height: '100%' });
        stage.append(e.canvas);
        return e;
      });
      return { ready, frame: async (t, opts) => (await ready).frame(t, opts) };
    },
  });
})();
