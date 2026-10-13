// One catalogue for authoring, gallery registration, films and coverage tests.
// create(id) returns the raw effect shown in the gallery (Apricot, Milo or the
// procedural dancer Juno as subjects). preview(id) keeps the input/effect
// comparison on the COUNTERFORM reference fight (studio.html?compare=1 and the
// "Same fight. Eight treatments." film); create(id, {sourceUrl|modelUrl|legacy})
// returns the reusable footage/GLB treatment from fx/studio/dots.js.
(() => {
  const base = new URL("./studio/", document.currentScript.src);
  const studies = [
    ["portal", "Cross-frame style portal", "motion", "portal", "portal", 6, 3.2, "A",
      "Slanted panels with no gaps, each in its own art direction. One courier flies through them, drawn in two styles at once wherever it crosses a seam."],
    ["themes", "Twenty art directions", "shader", "flight", "themes", 24, 3.8, "A",
      "Twenty original poster, typography, texture and figure treatments of one flying courier."],
    ["gallery", "Art-gallery camera journey", "motion", "flight", "journey", 40.8, 14, "A",
      "Overview, a tracked flight across twenty artworks, and a closing overview."],
    ["lowpoly", "Low-poly flight course", "shader", "course", "course", 6, 2.75, "A",
      "Chase a paper glider down a sunset city canyon: exponential fog, lit windows, gates that flash as they pass, speed lines, banking and an FOV kick."],
    ["video-dots", "Halftone close-up", "shader", "hero2d", "video-dots", 4.8, 2.1, "A",
      "Apricot under a hard moving key light becomes a two-ink halftone: dot size follows brightness, the palette changes on every beat and the camera pushes in to the eye."],
    ["dot-rhythm", "Beat-cut halftone", "shader", "hero2d", "dot-rhythm", 4.8, 1.0, "A",
      "Milo dances while every half beat cuts dot pitch, dot shape, palette and framing at 100 BPM."],
    ["dot-impact", "Local dot impact and recovery", "motion", "hero2d", "dot-impact", 4.8, 1.85, "A",
      "A ball hits Milo: dots near the contact compress, scatter and ripple outward, then settle back into the picture."],
    ["echo", "Time echoes and speed ramps", "motion", "hero2d", "echo", 6, 3.1, "A",
      "Apricot's pounce drives the playback clock through normal, slow, hold, reverse and ramp. Echoes of real earlier frames grow denser in slow motion, fan out during the hold and retract in reverse."],
    ["time-remap", "Speed ramp, hold, reverse and steps", "motion", "hero2d", "time-remap", 6, 2.6, "A",
      "The same pounce with only the source clock changed: the graph shows output time against source time through slow motion, a hold, reverse and six-step playback."],
    ["depth-dots", "Image relief", "shader", "relief", "depth", 6, 2.15, "A",
      "A Milo portrait becomes dots with shallow depth from its silhouette and brightness. Drum hits push the relief out in a ripple; silent bars stay flat while the camera sweeps to a grazing angle."],
    ["skin-cloud", "Skinned point cloud", "shader", "cloud", "skin", 6, 2.3, "B",
      "A scan line turns the solid dancer into surface points that stay attached to her limbs. On the slam the points rush at the lens as depth-of-field bokeh, then reassemble."],
    ["freeze-orbit", "Freeze frame and camera orbit", "motion", "freeze", "orbit", 6, 3.4, "A",
      "The slam is held as the floor breaks: pose, debris, dust and shock ring stop while the camera travels 230° around real 3D geometry, then time resumes."],
    ["particle-lens", "Particle rush and focus pull", "shader", "cloud", "lens", 6, 3.1, "B",
      "Surface points stream off the dancing figure towards the lens while focus racks between the near stream and the body."],
  ].map(([id, name, kind, module, mode, period, hero, grade, purpose]) => ({ id, name, kind, module, mode, period, hero, grade, purpose }));
  // Footage/GLB treatments in dots.js (COUNTERFORM reference subjects).
  const legacy = { "video-dots": "video", "dot-rhythm": "rhythm", "dot-impact": "impact", echo: "echo", "time-remap": "ramp", "depth-dots": "depth", "skin-cloud": "skin", "freeze-orbit": "orbit", "particle-lens": "lens" };
  async function build(id, options) {
    if (id === "dot-battle") return (await import(new URL("battle.js", base))).createBattle();
    if (id === "flight") id = "themes"; // retired: the flying courier lives in the art-direction showcase
    const study = studies.find((s) => s.id === id);
    if (!study) throw new Error("Unknown studio effect: " + id);
    if (legacy[id] && (options.sourceUrl || options.modelUrl || options.legacy))
      return (await import(new URL("dots.js", base))).createDots(legacy[id], options);
    const mod = await import(new URL(study.module + ".js", base));
    switch (study.module) {
      case "flight": return mod.createFlight(study.mode);
      case "portal": return mod.createPortal();
      case "course": return mod.createCourse();
      case "relief": return mod.createRelief(options);
      case "cloud": return mod.createCloud(study.mode);
      case "freeze": return mod.createFreezeOrbit();
      default:
        return {
          "video-dots": mod.createVideoDots, "dot-rhythm": mod.createDotRhythm, "dot-impact": mod.createDotImpact,
          echo: () => mod.createTimeEcho({ echoes: true }), "time-remap": () => mod.createTimeEcho({ echoes: false }),
        }[id]();
    }
  }
  async function create(id, options = {}) {
    const effect = await build(id, options);
    Object.assign(effect.canvas.style, { width: "100%", height: "100%", display: "block" });
    const render = effect.frame.bind(effect);
    let pending = Promise.resolve();
    effect.frame = (t, options) => {
      if (!Number.isFinite(t)) return Promise.reject(new Error("Frame time must be finite"));
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
    return mod.createPreview(id,previews[id],legacy[id]);
  }
  window.FXStudio = { studies, create, previews, preview, legacy };
})();
