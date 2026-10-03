(() => {
  if (!window.FX || !window.FXStudio) return;
  for (const s of FXStudio.studies)
    FX.demo({
      id: "studio-" + s.id,
      name: s.name,
      kind: s.kind,
      grade: s.grade,
      purpose: s.purpose,
      stacks:
        s.module === "flight" && s.id !== "lowpoly"
          ? ["canvas"]
          : ["canvas", "three"],
      chips: [
        s.module === "flight" ? "original art / motion" : "fixed source time",
        s.grade === "A+"
          ? "animated GLB / surface points"
          : "deterministic frame(t)",
      ],
      aspect: "16 / 9",
      period: s.period,
      hero: s.hero,
      build(stage) {
        const ready = FXStudio.create(s.id).then((effect) => {
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
