// Timeline factories shared by gallery, preview player and video pages.
// Consumers provide the pinned three.js r180 import map (see examples/stacks.html).
(() => {
  const base = new URL("./stacks/", document.currentScript.src);
  const studies = [
    {
      id: "pixi",
      name: "Liquid poster",
      kind: "shader",
      stacks: ["pixi", "canvas"],
      duration: 7,
      hero: 3,
      description:
        "PixiJS displacement, blur and colour filters, driven by time.",
    },
    {
      id: "rapier",
      name: "3D domino chain",
      kind: "sim",
      stacks: ["rapier", "three"],
      duration: 9,
      hero: 4,
      description:
        "48 Rapier rigid bodies at a fixed 120 Hz, with a scripted camera move.",
    },
    {
      id: "gpu",
      name: "Orbital particles",
      kind: "shader",
      stacks: ["webgpu", "three"],
      duration: 8,
      hero: 3,
      description:
        "65,536 particles computed with WebGPU/TSL at 120 Hz, then dispersed on cue.",
    },
  ];
  async function create(id) {
    if (!studies.some((s) => s.id === id))
      throw new Error("Unknown film effect: " + id);
    const mod = await import(new URL(id + ".js", base));
    const effect = await mod.create({ timeline: true });
    // three.js setSize() writes pixel CSS sizes. Fit the host while retaining
    // the 1280x720 drawing buffer, otherwise gallery/intro tiles crop the scene.
    Object.assign(effect.canvas.style, { width: "100%", height: "100%", display: "block" });
    // Callers may seek quickly; serialize GPU work instead of racing resets.
    const frame = effect.frame.bind(effect);
    let pending = Promise.resolve();
    effect.frame = (t, options) => {
      const result = pending.then(() => frame(t, options));
      pending = result.catch(() => {});
      return result;
    };
    return effect;
  }
  window.FXStack = { studies, create };
})();
