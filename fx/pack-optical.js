// Load flubber@0.4.2 and optical-effects.js before this pack.
// Uses the same build(stage) -> frame(t) interface as the original gallery.
// The canvas follows window.FX_RENDER_SIZE, so a film-size render draws native pixels
// and the gallery tile draws at its own size; every effect scales its lines to the canvas.
(() => {
  if (!window.FX) return;
  const studies = [
    [
      "moire",
      "Moiré interference",
      "shader",
      ["canvas", "glsl"],
      "B",
      "A second line grating slides over the first. Their beat bursts into broad fringes and reveals a word hidden in the top layer, which disappears again when the layers rest aligned.",
      ["GLSL", "two line gratings", "hidden word"],
      2.6,
    ],
    [
      "slit",
      "Slit-scan typography",
      "type",
      ["canvas"],
      "A",
      "Column x shows the source at time t − (x / W) · Δ. A spinning word and a swinging light become a twisted time ribbon, then snap back into place when Δ returns to zero.",
      ["Canvas 2D", "one time offset per pixel column"],
      3.2,
    ],
    [
      "ribbon",
      "Folding paper ribbon",
      "motion",
      ["canvas"],
      "A",
      "A printed paper strip flies in, snaps along seven creases into an octagonal loop and floats over its own shadow. Kinematic folds, not cloth physics.",
      ["Canvas 2D", "folded panels", "cast shadow"],
      2.3,
    ],
    [
      "caustic",
      "Caustic light",
      "shader",
      ["canvas", "glsl"],
      "B",
      "Flowing bands of water light. A procedural approximation, not ray-traced optics.",
      ["GLSL", "procedural water light"],
      2.1,
    ],
    [
      "foil",
      "Holographic foil",
      "shader",
      ["canvas", "glsl"],
      "B",
      "A holographic trading card flicks in the hand: a full-spectrum band sweeps across embossed facets and glitter flashes at its own angles. Art-directed diffraction, not a thin-film solver.",
      ["GLSL", "perspective card", "angle-keyed glitter"],
      1.2,
    ],
    [
      "morph",
      "Arbitrary-path morph",
      "motion",
      ["canvas", "flubber"],
      "C",
      "A concave monogram becomes a lightning bolt, then a heart. Flubber interpolates the outer contours; holes are not supported.",
      ["Flubber 0.4.2", "concave contours"],
      2.1,
    ],
  ];
  for (const [mode, name, kind, stacks, grade, purpose, chips, hero] of studies) {
    FX.demo({
      id: "optical-" + mode,
      name,
      kind,
      stacks,
      grade,
      purpose,
      chips,
      aspect: "16 / 9",
      period: FXOptical.periods[mode],
      hero,
      build(stage) {
        const canvas = document.createElement("canvas");
        canvas.width = window.FX_RENDER_SIZE?.w || 1120;
        canvas.height = window.FX_RENDER_SIZE?.h || 630;
        canvas.className = "fill";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", name);
        stage.appendChild(canvas);
        const frame = FXOptical.create(canvas, mode);
        // Gallery frames receive (localTime, absoluteTime); optical's second
        // argument is strength, so keep its default when adapting the callback.
        return (t) => frame(t);
      },
    });
  }
})();
