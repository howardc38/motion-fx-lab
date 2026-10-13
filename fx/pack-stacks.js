// Three more movie effects using the same build -> {ready, frame(t)} contract.
(() => {
  if (!window.FX || !window.FXStack) return;
  // Gallery framing per study. The domino chain is shown close to its falling front with the continuous
  // tracking camera; film pages call FXStack.create directly and pass their own options.
  const GALLERY_OPTIONS = { rapier: { camera: "track" } };
  for (const study of FXStack.studies)
    FX.demo({
      id: "stack-" + study.id,
      name: study.name,
      kind: study.kind,
      stacks: study.stacks,
      grade: "C",
      chips: [
        study.id === "gpu" ? "WebGPU / TSL" : study.stacks[0],
        "await frame(t)",
      ],
      purpose: study.description,
      aspect: "16 / 9",
      period: study.duration,
      hero: study.hero,
      build(stage) {
        const ready = FXStack.create(study.id).then((effect) => {
          effect.canvas.className = "fill";
          effect.canvas.setAttribute("role", "img");
          effect.canvas.setAttribute("aria-label", study.name);
          stage.appendChild(effect.canvas);
          return effect;
        });
        return { ready, frame: async (t) => (await ready).frame(t, GALLERY_OPTIONS[study.id]) };
      },
    });
})();
