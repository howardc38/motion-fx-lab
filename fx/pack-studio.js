(() => {
  if (!window.FX || !window.FXStudio) return;
  for (const s of FXStudio.studies)
    FX.demo({
      id: "studio-" + s.id,
      name: FXStudio.previews[s.id]?.title ?? s.name,
      kind: s.kind,
      grade: s.grade,
      purpose: FXStudio.previews[s.id] ? FXStudio.previews[s.id].watch+" "+FXStudio.previews[s.id].note : s.purpose,
      stacks: ["skin-cloud", "freeze-orbit", "particle-lens"].includes(s.id)
        ? ["canvas", "three", "glsl"]
        : ["lowpoly", "depth-dots"].includes(s.id) ? ["canvas", "three"] : ["canvas"],
      chips: [
        s.module === "flight" ? "original art / motion" : "fixed source time",
        s.grade === "A+"
          ? "animated GLB / surface points"
          : "deterministic frame(t)",
      ],
      aspect: "16 / 9",
      period: s.period,
      hero: FXStudio.previews[s.id]?.hero ?? s.hero,
      build(stage) {
        const ready = (FXStudio.previews[s.id] ? FXStudio.preview(s.id) : FXStudio.create(s.id)).then((effect) => {
          effect.canvas.className = "fill";
          effect.canvas.setAttribute("role", "img");
          effect.canvas.setAttribute("aria-label", s.name);
          stage.appendChild(effect.canvas);
          return effect;
        });
        return { ready, frame: async (t) => (await ready).frame(t) };
      },
    });
})();
