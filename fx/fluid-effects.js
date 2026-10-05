(() => {
  const base = new URL("./fluid/effects.js", document.currentScript.src);
  base.search = new URL(document.currentScript.src).search;
  const studies = [
    {
      id: "overflow",
      name: "Fluid flow and overflow",
      kind: "sim",
      purpose:
        "A low-height inlet raises the water level in a partly filled bowl. Excess water passes over the rim and runs down the outside.",
    },
    {
      id: "viscous",
      name: "Viscous coating and drips",
      kind: "sim",
      purpose:
        "A moving golden stream lays a viscous sheet over a dark ceramic ring, stretches and drains onto its plinth. A viscosity variant of fluid flow.",
    },
    {
      id: "smoke",
      name: "Volumetric smoke around geometry",
      kind: "sim",
      purpose:
        "A baked gas volume moves around solid lettering, then dissipates to reveal the form.",
    },
  ];
  window.FXFluid = {
    studies,
    create: async (id, options) => (await import(base)).create(id, options),
  };
})();
