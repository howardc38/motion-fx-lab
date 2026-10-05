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
      0.6,
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
      0.7,
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
      0.55,
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
      0.6,
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
      0.4,
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
      3.35,
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
      (id === "dot-battle" ? { module: "battle", mode: "battle" } : null);
    if (!study) throw new Error("Unknown studio effect: " + id);
    const mod = await import(new URL(study.module + ".js", base));
    const effect =
      study.module === "battle"
        ? mod.createBattle()
        : study.module === "flight"
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
  const previews = {
    'video-dots': {title:'Footage → halftone dots',before:'Original colour footage',after:'Dots sampled from the footage',watch:'Watch the picture become a flat field of changing dots.',note:'2D pixels become dots. No new 3D geometry is created.',hero:1.8},
    'dot-rhythm': {title:'Dot spacing and palette',before:'Original colour footage',after:'Beat-driven dot treatment',watch:'Watch the dot size and ink colours change on the beat.',note:'A variation of footage halftone, using the same input frames.',hero:.9},
    'echo': {title:'Motion trails from earlier frames',before:'One source frame',after:'Five different source times',watch:'Watch the earlier poses remain behind the moving fighter.',note:'Time-layering, not a different dot material.',hero:2.8},
    'dot-impact': {title:'Local impact and recovery',before:'Unchanged dots at the contact',after:'Compressed, scattered, recovered',watch:'A close-up slows one contact so the local deformation is visible.',note:'Only the contact region deforms; both panes use the same source time.',hero:2.2},
    'time-remap': {title:'Change the playback clock',before:'Normal source speed',after:'Remapped source speed',watch:'Compare the pose and the source clocks: slow, hold, reverse or step.',note:'The drawing stays the same. The sampled source time changes.',hero:7.5},
    'depth-dots': {title:'A flat image becomes shallow relief',before:'One held image',after:'2.5D relief seen from an angle',watch:'The image stays still while the viewing angle exposes its shallow depth.',note:'Brightness supplies depth. Hidden sides of the body are not reconstructed.',hero:1.5},
    'skin-cloud': {title:'Points attached to a 3D character',before:'Solid animated 3D character',after:'The same surface sampled as points',watch:'Watch points keep their place on the moving limbs.',note:'Real rigged geometry supplies the surface, rather than a flat image.',hero:2.8},
    'freeze-orbit': {title:'Hold the pose. Move the camera.',before:'Held pose / fixed camera',after:'Same held pose / orbiting camera',watch:'The source clock holds while the camera travels around the figures.',note:'A real 3D orbit reveals sides and backs without changing the pose.',hero:1.8},
    'particle-lens': {title:'Depth scatter and focus',before:'Sharp points / same moving camera',after:'Particles rush forward and blur',watch:'Near-camera particles grow soft as they scatter out of the surface.',note:'Both panes share the pose and camera; scattering and focus differ.',hero:3.35},
  };
  async function preview(id){
    if(!previews[id])return create(id);
    const mod=await import(new URL('study-preview.js',base));
    return mod.createPreview(id,previews[id],studies.find(s=>s.id===id).mode);
  }
  window.FXStudio = { studies, create, previews, preview };
})();
