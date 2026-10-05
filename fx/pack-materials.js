(() => {
  for (const s of FXMaterial.studies)
    FX.demo({
      id: s.id,
      name: s.name,
      kind: s.kind,
      stacks:
        s.module === "water" || s.module === "type"
          ? ["three", "canvas"]
          : ["canvas"],
      grade: ["water", "type"].includes(s.module) ? "A+" : "A",
      chips: [
        s.module === "water"
          ? "Authored water surfaces"
          : s.module === "type"
            ? "Bundled CJK outlines"
            : "Time-driven drawing",
      ],
      purpose: s.description,
      aspect: "16 / 9",
      period: s.duration,
      hero: s.hero,
      build(stage) {
        const ready = FXMaterial.create(s.id).then((e) => {
          e.canvas.className = "fill";
          e.canvas.setAttribute("role", "img");
          e.canvas.setAttribute("aria-label", s.name);
          Object.assign(e.canvas.style, {
            width: "100%",
            height: "100%",
            display: "block",
          });
          stage.appendChild(e.canvas);
          return e;
        });
        return {
          ready,
          frame: async (t) =>
            (await ready).frame(t, { text: stage.dataset.solidText }),
        };
      },
    });
})();
