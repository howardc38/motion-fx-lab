// One catalogue for authoring, gallery registration, films and coverage tests.
(() => {
  const base = new URL("./studio/", document.currentScript.src);
  const studies = [
    [
      "flight",
      "Flying courier and cape",
      "character",
      "flight",
      "flight",
      6,
      2,
      "A",
      "One pose, layered limbs and a continuously deforming cape.",
    ],
    [
      "portal",
      "Cross-frame style portal",
      "motion",
      "flight",
      "portal",
      6,
      3,
      "A",
      "A shared pose is clipped into three independently styled frames.",
    ],
    [
      "themes",
      "Twenty art directions",
      "shader",
      "flight",
      "themes",
      24,
      3.8,
      "A",
      "Twenty original poster, typography, texture and figure treatments.",
    ],
    [
      "gallery",
      "Art-gallery camera journey",
      "motion",
      "flight",
      "journey",
      40.8,
      14,
      "A",
      "Overview, a tracked flight across twenty artworks, and a closing overview.",
    ],
    [
      "lowpoly",
      "Low-poly flight course",
      "shader",
      "flight",
      "lowpoly",
      6,
      2,
      "A",
      "Real 3D city blocks, perspective rings and a scripted forward camera.",
    ],
    [
      "video-dots",
      "Video to animated dots",
      "shader",
      "dots",
      "video",
      4.8,
      1.2,
      "A",
      "Fixed-FPS RGBA footage becomes a colored or two-ink screen-space dot field.",
    ],
    [
      "dot-rhythm",
      "Beat-driven dot styles",
      "shader",
      "dots",
      "rhythm",
      4.8,
      0.9,
      "A",
      "Dot spacing and ink palettes change on a 100 BPM half-beat grid.",
    ],
    [
      "dot-impact",
      "Dot impact and recovery",
      "motion",
      "dots",
      "impact",
      4.8,
      1.5,
      "A",
      "Local compression, deterministic scattering and recovery on a hit cue.",
    ],
    [
      "echo",
      "Colored temporal echoes",
      "motion",
      "dots",
      "echo",
      4.8,
      1.6,
      "A",
      "Five actual source times overlap as differently colored motion trails.",
    ],
    [
      "time-remap",
      "Source-time remapping",
      "motion",
      "dots",
      "ramp",
      19.2,
      7.5,
      "A",
      "Normal playback, a speed ramp and hold, reverse, and six-step-per-second motion.",
    ],
    [
      "depth-dots",
      "2.5D dot relief",
      "shader",
      "dots",
      "depth",
      6,
      2,
      "A",
      "Luminance supplies a shallow depth displacement; this is not recovered 3D anatomy.",
    ],
    [
      "skin-cloud",
      "Animated skinned point cloud",
      "shader",
      "dots",
      "skin",
      4.8,
      1.2,
      "A+",
      "Stable surface samples follow a real animated GLB skeleton.",
    ],
    [
      "freeze-orbit",
      "Frozen action, moving camera",
      "motion",
      "dots",
      "orbit",
      6,
      3.2,
      "A+",
      "Hold the skeletal pose while the camera travels a complete three-dimensional orbit.",
    ],
    [
      "particle-lens",
      "Particle rush and depth of field",
      "shader",
      "dots",
      "lens",
      6,
      3,
      "A+",
      "Geometry-bound particles scatter towards a moving camera with depth-dependent bokeh.",
    ],
  ].map(([id, name, kind, module, mode, period, hero, grade, purpose]) => ({
    id,
    name,
    kind,
    module,
    mode,
    period,
    hero,
    grade,
    purpose,
  }));
  async function create(id, options = {}) {
    const study =
      studies.find((s) => s.id === id) ||
      (id === "dot-battle" ? { module: "dots", mode: "battle" } : null);
    if (!study) throw new Error("Unknown studio effect: " + id);
    const mod = await import(new URL(study.module + ".js", base));
    const effect =
      study.module === "flight"
        ? mod.createFlight(study.mode)
        : await mod.createDots(study.mode, options);
    Object.assign(effect.canvas.style, {
      width: "100%",
      height: "100%",
      display: "block",
    });
    const render = effect.frame.bind(effect);
    let pending = Promise.resolve();
    effect.frame = (t, options) => {
      if (!Number.isFinite(t))
        return Promise.reject(new Error("Frame time must be finite"));
      const work = pending.then(() => render(Math.max(0, t), options));
      pending = work.catch(() => {});
      return work;
    };
    return effect;
  }
  window.FXStudio = { studies, create };
})();
