// Tactile Dissolve, Sticker Peel, Cut-Paper Diorama & Kinetic Shutter Typography pack (0BSD).
(() => {
  if (!window.FX) return;
  const base = new URL('./tactile/index.js', document.currentScript.src);
  const entries = [
    {
      id: 'particle-dissolve',
      name: 'Energy-preserving particle dissolve',
      kind: 'motion',
      grade: 'A',
      stacks: ['canvas'],
      period: 5.6,
      hero: 1.65,
      aspect: '16 / 9',
      chips: ['luminance energy conservation', '3-sample motion trail', 'seamless reassembly', 'FX_CUSTOM_TEXT'],
      purpose: 'Pixel-sampled artwork dissolves along a cluster-coherent diagonal wave into drifting motion-blurred sparks with conserved luminous flux before reassembling cleanly.',
    },
    {
      id: 'sticker-peel',
      name: 'Curled sticker peel transition',
      kind: 'motion',
      grade: 'A',
      stacks: ['canvas'],
      period: 5.2,
      hero: 1.65,
      aspect: '16 / 9',
      chips: ['Householder fold reflection', 'shaded paper backing', 'cast crease shadow', 'FX_CUSTOM_TEXT'],
      purpose: 'A vivid poster sheet peels diagonally from the corner like a vinyl sticker, revealing cylindrically shaded paper backing, fold shadow and the uncovered scene beneath.',
    },
    {
      id: 'paper-diorama',
      name: 'Layered cut-paper diorama push',
      kind: 'motion',
      grade: 'A',
      stacks: ['canvas'],
      period: 6.0,
      hero: 3.0,
      aspect: '16 / 9',
      chips: ['6 cut-paper depth planes', 'soft directional shadows', 'parallax camera push', 'FX_CUSTOM_TEXT'],
      purpose: 'Six handcrafted cut-paper depth planes — dusk sky, mountain peaks, harbour village, scalloped sea and proscenium arch — glide past one another with parallax depth.',
    },
    {
      id: 'kinetic-shutter',
      name: 'Shutter colour bands and type switch',
      kind: 'type',
      grade: 'A',
      stacks: ['canvas'],
      period: 5.4,
      hero: 1.35,
      aspect: '16 / 9',
      chips: ['7 staggered colour slats', 'polarity flip wipe', 'bidirectional loop', 'FX_CUSTOM_TEXT'],
      purpose: 'Seven staggered horizontal colour-shutter blades sweep cleanly across the frame to invert polarity and swap display headlines behind each closing slat.',
    },
    {
      id: 'split-slot-type',
      name: 'Sliced typography and slot-machine reel',
      kind: 'type',
      grade: 'A',
      stacks: ['canvas'],
      period: 5.4,
      hero: 2.65,
      aspect: '16 / 9',
      chips: ['midline shear aperture', 'detent-braked verb reel', 'drum shading', 'FX_CUSTOM_TEXT'],
      purpose: 'Heavy display lettering splits horizontally and recoils apart to open a mechanical slot aperture cycling bold verbs before braking with overshoot onto the target word.',
    },
    {
      id: 'corner-brackets',
      name: 'Precision corner viewfinder brackets',
      kind: 'type',
      grade: 'A',
      stacks: ['canvas'],
      period: 5.8,
      hero: 2.85,
      aspect: '16 / 9',
      chips: ['4-corner spring framing', 'autofocus lock reticle', 'live bounding telemetry', 'FX_CUSTOM_TEXT'],
      purpose: 'Four architectural L-brackets glide with spring physics between editorial cards, resizing dynamically with autofocus lock flashes and live bounding-box telemetry.',
    },
  ];

  window.FXTactile = {
    studies: entries,
    create: (id, options = {}) => import(base.href).then((m) => m.create(id, options)),
  };

  for (const entry of entries) {
    FX.demo({
      ...entry,
      build(stage) {
        let inst = null;
        const ready = window.FXTactile.create(entry.id).then((e) => {
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
