// Stroke mural & dot-iris polarity pack: registers "graphic-stroke-mural" and "wipe-dot-polarity"
// with FX.demo and lazily imports fx/mural/index.js when visible.
(() => {
  const scriptSrc = (document.currentScript && document.currentScript.src) || location.href;
  const modUrl = new URL("./mural/index.js", scriptSrc);

  window.FXMural = {
    create(id, options = {}) {
      return import(modUrl.href).then((m) => m.create(id, options));
    },
  };

  FX.demo({
    id: "graphic-stroke-mural",
    name: "Stroke-swarm Bento mural",
    kind: "type",
    grade: "A",
    stacks: ["canvas"],
    chips: ["1,000+ Voronoi glyph shards", "zero-crack Path2D weld", "Risograph stipple sweep", "CJK + Latin 0°/±90°/180°"],
    purpose:
      "Over a thousand anatomical stroke and Voronoi-sliced CJK and Latin glyph fragments fly along curved ballistic arcs with 1 px velocity leader lines, weld into a crack-free asymmetric Swiss/Bento poster mural, and catch a travelling Risograph stipple-grain highlight band.",
    period: 7.2,
    hero: 3.4,
    aspect: "16 / 9",
    build(stage) {
      const ready = window.FXMural.create("graphic-stroke-mural", { width: 1280, height: 720 }).then((e) => {
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

  FX.demo({
    id: "wipe-dot-polarity",
    name: "Dot-iris polarity wipe",
    kind: "motion",
    grade: "A",
    stacks: ["canvas"],
    chips: ["off-center exponential iris", "even-odd polarity flip", "period . loop return"],
    purpose:
      "An off-center punctuation period expands exponentially into an even-odd circular wavefront, inverting obsidian and warm cream typography cleanly across the moving arc before collapsing back into the period for an exact Frame-0 loop.",
    period: 4.8,
    hero: 1.9,
    aspect: "16 / 9",
    build(stage) {
      const ready = window.FXMural.create("wipe-dot-polarity", { width: 1280, height: 720 }).then((e) => {
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
