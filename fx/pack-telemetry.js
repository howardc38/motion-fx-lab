// 3D-Tracked CAD Callout & Industrial Telemetry HUD registration pack (0BSD).
(() => {
  if (!window.FX) return;
  const base = new URL('./telemetry/index.js', document.currentScript.src);
  const entries = [
    {
      id: 'cad-telemetry-hud',
      name: '3D-tracked CAD telemetry HUD',
      kind: 'ui',
      grade: 'A',
      stacks: ['three', 'canvas'],
      period: 6.4,
      hero: 2.8,
      aspect: '16 / 9',
      chips: ['NDC = P·V·M·p projection', '45° elbow callouts', 'Vernier + 270° spring gauge'],
      purpose: 'Four real 3D anchor points on a rotating turbine-gimbal assembly project directly to screen space to drive zero-lag 45° CAD callouts, Vernier rulers and a 270° radial gauge.',
    },
    {
      id: 'ferrofluid-orb',
      name: 'Harmonic ferrofluid containment orb',
      kind: 'shader',
      grade: 'B',
      stacks: ['glsl'],
      period: 5.6,
      hero: 1.9,
      aspect: '16 / 9',
      chips: ['raymarched SDF spikes', 'sin³ spherical harmonics', 'damped elastic ringdown'],
      purpose: 'A liquid-chrome ferrofluid sphere inside an industrial telemetry reticle erupts into sin³ spherical-harmonic spike lobes under timed magnetic impulses and rings down elastically.',
    },
  ];

  window.FXTelemetry = {
    studies: entries,
    create: (id, options = {}) => import(base.href).then((m) => m.create(id, options)),
  };

  for (const entry of entries) {
    FX.demo({
      ...entry,
      build(stage) {
        let inst = null;
        const ready = window.FXTelemetry.create(entry.id).then((e) => {
          inst = e;
          e.canvas.className = 'fill';
          Object.assign(e.canvas.style, { width: '100%', height: '100%', display: 'block' });
          stage.append(e.canvas);
          return e;
        });
        return {
          ready,
          frame: (t, opts) => (inst ? inst.frame(t, opts) : ready.then((e) => e.frame(t, opts))),
        };
      },
    });
  }
})();
