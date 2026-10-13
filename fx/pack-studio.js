(() => {
  if (!window.FX || !window.FXStudio) return;
  // Effects render a 1280×720 master frame. A tile shows it through a canvas
  // sized to the tile's device pixels and a high-quality downscale, so dot
  // fields do not alias into moiré at gallery size.
  function display(stage, effect, label) {
    const out = document.createElement("canvas");
    out.className = "fill";
    out.setAttribute("role", "img");
    out.setAttribute("aria-label", label);
    Object.assign(out.style, { width: "100%", height: "100%", display: "block" });
    out.width = 1280;
    out.height = 720;
    stage.appendChild(out);
    const g = out.getContext("2d");
    return () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1), css = stage.clientWidth || 1280;
      const w = Math.max(320, Math.min(1280, Math.round((css * dpr) / 16) * 16)), h = (w * 9) / 16;
      if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(effect.canvas, 0, 0, w, h);
    };
  }
  for (const s of FXStudio.studies)
    FX.demo({
      id: "studio-" + s.id,
      name: s.name,
      kind: s.kind,
      grade: s.grade,
      purpose: s.purpose,
      stacks: ["skin-cloud", "particle-lens"].includes(s.id)
        ? ["canvas", "three", "glsl"]
        : ["lowpoly", "depth-dots", "freeze-orbit"].includes(s.id) ? ["canvas", "three"] : ["canvas"],
      chips: [
        { portal: "art-direction presets", themes: "art-direction presets", gallery: "art-direction presets", lowpoly: "three.js scene", "depth-dots": "image relief", "skin-cloud": "procedural 3D dancer", "freeze-orbit": "procedural 3D dancer", "particle-lens": "procedural 3D dancer" }[s.id] || "fx/character subject",
        "deterministic frame(t)",
      ],
      aspect: "16 / 9",
      period: s.period,
      hero: s.hero,
      build(stage) {
        let show;
        const ready = FXStudio.create(s.id).then((effect) => {
          show = display(stage, effect, s.name);
          return effect;
        });
        return { ready, frame: async (t) => { const effect = await ready; await effect.frame(t); show(); } };
      },
    });
})();
