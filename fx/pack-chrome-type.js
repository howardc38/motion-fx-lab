// Liquid chrome type pack: registers "liquid-chrome-type" with FX.demo
// and lazily imports fx/chrome-type/index.js when visible.
(() => {
  const scriptSrc = (document.currentScript && document.currentScript.src) || location.href;
  const modUrl = new URL("./chrome-type/index.js", scriptSrc);

  window.FXChromeType = {
    create(options = {}) {
      return import(modUrl.href).then((m) => m.createChromeType(options));
    },
  };

  FX.demo({
    id: "liquid-chrome-type",
    name: "Liquid mercury chrome lettering",
    kind: "shader",
    grade: "B",
    stacks: ["glsl"],
    chips: ["GLSL SDF raymarcher", "16-bit dynamic EDT text", "smin negative-radius pour", "terracotta studio cyc"],
    purpose:
      "Molten mercury streams and droplets pour from above into a warm terracotta studio cyclorama, nucleating any Latin or CJK word from negative radius via smooth-minimum blending before springing into crisp bevelled 3D chrome and draining seamlessly back to empty frame 0.",
    period: 6.0,
    hero: 2.75,
    aspect: "16 / 9",
    build(stage) {
      const ready = window.FXChromeType.create({ width: 960, height: 540 }).then((e) => {
        e.canvas.className = "fill";
        Object.assign(e.canvas.style, { display: "block", width: "100%", height: "100%" });
        stage.append(e.canvas);
        return e;
      });
      return {
        ready,
        frame: async (t) => (await ready).frame(t),
      };
    },
  });
})();
