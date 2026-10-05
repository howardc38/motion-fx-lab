// Shared factories for gallery previews, authored films and the intro.
(() => {
  const base = new URL("./material-studies/", document.currentScript.src);
  const studies = [
    [
      "water-material",
      "Water and glass",
      "shader",
      "water",
      "material",
      8,
      2,
      "Reflection, refraction and thickness on a real 3D surface.",
    ],
    [
      "water-morph",
      "Liquid shape changes",
      "motion",
      "water",
      "morph",
      8,
      4.3,
      "An authored transparent surface changes topology: sphere, block, ring and separate droplets.",
    ],
    [
      "water-impact",
      "Drop, crown and rebound",
      "motion",
      "water",
      "impact",
      8,
      1.85,
      "A choreographed fall, crown splash, ballistic droplets, rebound jet and travelling waves.",
    ],
    [
      "water-underwater",
      "Below the surface",
      "shader",
      "water",
      "underwater",
      8,
      5,
      "A composed dive with bubbles, a refracting water surface and projected light patterns.",
    ],
    [
      "cjk-solid",
      "Solid CJK lettering",
      "type",
      "type",
      null,
      8,
      2,
      "Extruded Chinese outlines with bevelled faces and an orbiting view. Replace the text with supported glyphs.",
    ],
    [
      "organic-contours",
      "Organic closed contours",
      "shader",
      "contours",
      null,
      8,
      2,
      "Nested closed curves deform continuously into a flowing coloured field.",
    ],
    [
      "frame-glitch",
      "Whole-frame signal breakup",
      "shader",
      "glitch",
      null,
      8,
      2.7,
      "Block displacement, colour-channel offsets and scan tears operate on the complete source image.",
    ],
    [
      "scene-eras",
      "One scene. Many eras.",
      "motion",
      "eras",
      null,
      24,
      12.5,
      "One continuous cup-lifting action, eight room treatments and stable scene landmarks.",
    ],
  ].map(([id, name, kind, module, mode, duration, hero, description]) => ({
    id,
    name,
    kind,
    module,
    mode,
    duration,
    hero,
    description,
  }));
  async function create(id) {
    const s = studies.find((s) => s.id === id);
    if (!s) throw new Error("Unknown material study: " + id);
    const m = await import(new URL(s.module + ".js", base));
    return m.create(s.mode);
  }
  window.FXMaterial = { studies, create };
})();
