(() => {
  if (!window.FX) return;
  const entries = [
    { id: 'character-rig', name: 'Configurable cutout character', purpose: 'Transparent image parts bound to named joints: the cat runs, the robot jumps and waves, and for a moment the joint chains that drive them show through.', mode: 'rig', period: 4, hero: 2 },
    { id: 'character-motion', name: 'Character motion presets', purpose: 'Sample configured leg chains, foot contact, jumps and arm waves. The scene places the same transparent source in different videos.', mode: 'pairs', period: 3, hero: 1 },
    { id: 'character-style', name: 'Subject drawing styles', purpose: 'Apply eight drawing treatments to the character itself at the same pose time: original, poster, ink, pixels, dots, ASCII, etching and duotone.', mode: 'board', period: 3, hero: 1 },
  ];
  for (const entry of entries) FX.demo({
    ...entry, kind: 'character', grade: 'A', stacks: ['canvas'], chips: ['image parts + JSON rig', 'deterministic frame(t)'], aspect: '16 / 9',
    build(stage) {
      const ready = import('./character/studies.js').then(m => m.createStudies()).then(s => {
        s.canvas.className = 'fill'; s.canvas.setAttribute('role', 'img'); s.canvas.setAttribute('aria-label', entry.name); stage.append(s.canvas); return s;
      });
      return { ready, frame: async t => (await ready).frame(t, entry.mode) };
    },
  });
})();
