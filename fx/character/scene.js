import { sampleMotion } from './motion.js';

// Scene placement is separate from the character's local joints and drawing style.
// Caller owns cuts, camera movement, backgrounds, sound and story decisions.
export class CharacterScene {
  constructor(sources, { width = 1280, height = 720 } = {}) {
    this.sources = sources;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width; this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
  }
  frame(time, { actors = [], background = null, camera = [0, 0] } = {}) {
    if (!Number.isFinite(time)) throw new TypeError('Scene time must be finite');
    const g = this.ctx; g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (background) { g.fillStyle = background; g.fillRect(0, 0, this.canvas.width, this.canvas.height); }
    for (const actor of actors) {
      if (time < (actor.start ?? 0) || time >= (actor.end ?? Infinity)) continue;
      const source = this.sources[actor.character];
      if (!source) throw new Error(`Unknown scene character: ${actor.character}`);
      const local = (time - (actor.start ?? 0)) * (actor.rate ?? 1) + (actor.offset ?? 0);
      const pose = sampleMotion(source.rig.definition, actor.motion || 'idle', local, actor.overrides);
      const frame = source.styles.frame(source.rig.frame(pose, { skeleton: actor.skeleton }), actor.style || 'original');
      const [ox, oy] = source.rig.definition.canvas.origin, scale = actor.scale ?? 1;
      const travel = actor.travel === false ? 0 : pose.meta.worldX * (actor.flip ? -1 : 1);
      g.save(); g.globalAlpha = actor.opacity ?? 1;
      g.translate((actor.x ?? 0) + travel * scale - camera[0], (actor.y ?? 0) - camera[1]);
      g.rotate(actor.rotation ?? 0); g.scale(scale * (actor.flip ? -1 : 1), scale);
      g.drawImage(frame, -ox, -oy); g.restore();
    }
    return this.canvas;
  }
}
