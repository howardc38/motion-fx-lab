(() => {
  for (const s of FXFluid.studies)
    FX.demo({
      id: "fluid-" + s.id,
      name: s.name,
      kind: s.kind,
      stacks: ["blender", "canvas"],
      grade: "D",
      chips: ["Blender / Mantaflow", "baked frame sequence"],
      purpose:
        s.purpose +
        " Edit the Blender recipe to change the simulation; this preview replays the baked result.",
      aspect: "16 / 9",
      period: 4.8,
      hero: 2.6,
      build(stage) {
        const ready = FXFluid.create(s.id).then((e) => {
          e.canvas.className = "fill";
          Object.assign(e.canvas.style, {
            width: "100%",
            height: "100%",
            display: "block",
          });
          e.canvas.setAttribute("role", "img");
          e.canvas.setAttribute("aria-label", s.name);
          stage.appendChild(e.canvas);
          return e;
        });
        return { ready, frame: async (t) => (await ready).frame(t) };
      },
    });
})();
