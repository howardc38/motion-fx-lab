// Load flubber@0.4.2 and optical-effects.js before this pack.
// Uses the same build(stage) -> frame(t) interface as the original gallery.
(() => {
  if (!window.FX) return;
  const studies = [
    [
      "moire",
      "Moiré interference",
      "shader",
      ["canvas", "glsl"],
      "B",
      "Two moving wave fields interfere to form an optical pattern.",
      ["shared WebGL", "wave interference"],
    ],
    [
      "slit",
      "Slit-scan typography",
      "type",
      ["canvas"],
      "A",
      "Horizontal slices sample different phases of moving type; every slice is recomputed from time.",
      ["Canvas 2D", "time-offset slices"],
    ],
    [
      "ribbon",
      "Folding paper ribbon",
      "motion",
      ["canvas"],
      "A",
      "A twisting ribbon built from projected faces. Geometric deformation, not a cloth simulation.",
      ["projected geometry", "depth-sorted faces"],
    ],
    [
      "caustic",
      "Caustic light",
      "shader",
      ["canvas", "glsl"],
      "B",
      "Flowing bands of water light. A procedural approximation, not ray-traced optics.",
      ["GLSL", "procedural water light"],
    ],
    [
      "foil",
      "Holographic foil",
      "shader",
      ["canvas", "glsl"],
      "B",
      "A grooved disc with moving spectral highlights. Art-directed interference, not a physical thin-film solver.",
      ["GLSL", "spectral highlights"],
    ],
    [
      "morph",
      "Arbitrary-path morph",
      "motion",
      ["canvas", "flubber"],
      "C",
      "A concave monogram becomes a lightning bolt, then a heart. Flubber interpolates the outer contours; holes are not supported.",
      ["Flubber 0.4.2", "concave contours"],
    ],
  ];
  for (const [mode, name, kind, stacks, grade, purpose, chips] of studies) {
    FX.demo({
      id: "optical-" + mode,
      name,
      kind,
      stacks,
      grade,
      purpose,
      chips,
      aspect: "16 / 9",
      period: 8,
      hero: 2.1,
      build(stage) {
        const canvas = document.createElement("canvas");
        canvas.width = 1120;
        canvas.height = 630;
        canvas.className = "fill";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", name);
        stage.appendChild(canvas);
        return FXOptical.create(canvas, mode);
      },
    });
  }
})();
