(() => {
  const base = new URL("./fluid/effects.js", document.currentScript.src);
  const studies = [
    {
      id: "overflow",
      name: "Fluid flow and overflow",
      kind: "sim",
      purpose:
        "Baked liquid responds to gravity and the vessel walls, pours into the bowl and throws sheets and drops across its rim.",
    },
    {
      id: "viscous",
      name: "Viscous coating and drips",
      kind: "sim",
      purpose:
        "A thicker simulated liquid coats a curved object, gathers and drips. A viscosity variant of fluid flow.",
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
