import { createCharacterSource, STYLE_PRESETS } from './index.js';
import { sampleMotion } from './motion.js';
import { CharacterScene } from './scene.js';
import { smooth } from './math.js';

export const CHARACTER_FILES = {
  cat: new URL('../../assets/characters/apricot-cat/rig.json', import.meta.url),
  robot: new URL('../../assets/characters/explorer-robot/rig.json', import.meta.url),
};
export async function createStudies() {
  const sources = Object.fromEntries(await Promise.all(Object.entries(CHARACTER_FILES).map(async ([id, url]) => [id, await createCharacterSource(url)])));
  const scene = new CharacterScene(sources), g = scene.ctx;
  function label(text, x, y, size = 28, color = '#273e44') { g.font = `600 ${size}px system-ui,sans-serif`; g.fillStyle = color; g.fillText(text, x, y); }
  function floor(y, camera = 0) {
    g.strokeStyle = '#ccd1c7'; g.lineWidth = 2; g.beginPath(); g.moveTo(36, y); g.lineTo(1244, y); g.stroke();
    g.fillStyle = '#ccd1c7'; for (let x = 40 - camera % 90; x < 1280; x += 90) g.fillRect(x, y + 16, 20, 3);
  }
  function single(t, options) {
    const id = options.character || 'cat', motion = options.motion || 'idle', style = options.style || 'original';
    const source = sources[id], pose = sampleMotion(source.rig.definition, motion, t), scale = id === 'cat' ? 3 : 1.75;
    const ground = id === 'cat' ? 70 : 95, y = 588 - ground * scale, cameraX = pose.meta.worldX * scale;
    scene.frame(t, { background: STYLE_PRESETS.find(s => s.id === style)?.background || '#f1eee7', camera: [cameraX, 0], actors: [{ character: id, motion, style, x: 640, y, scale, skeleton: options.skeleton }] });
    floor(588, cameraX); label(source.rig.definition.name, 52, 74, 34); label(`${motion}  /  ${style}`, 52, 119, 24);
    label('Transparent character source → configured motion → drawing style', 52, 674, 22);
    return scene.canvas;
  }
  function pairs(t, options = {}) {
    const style = options.style || 'original';
    scene.frame(t, { background: '#f1eee7', actors: [
      { character: 'cat', motion: 'jump', style, x: 355, y: 432, scale: 2.2, travel: false },
      { character: 'robot', motion: 'wave', style, x: 934, y: 418, scale: 1.8, travel: false },
    ] });
    label('One module, two joint layouts', 52, 74, 36); floor(589);
    label('Four legs · jump', 230, 640, 24); label('Two legs + two arms · wave', 790, 640, 24); return scene.canvas;
  }
  function board(t, options = {}) {
    const id = options.character || 'cat', motion = options.motion || (id === 'cat' ? 'run' : 'wave');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1280, 720); g.fillStyle = '#f1eee7'; g.fillRect(0, 0, 1280, 720);
    label('Change the drawing style and the character itself changes', 36, 54, 28);
    for (let i = 0; i < STYLE_PRESETS.length; i++) {
      const s = STYLE_PRESETS[i], x = 20 + i % 4 * 315, y = 82 + Math.floor(i / 4) * 309;
      g.fillStyle = s.background; g.fillRect(x, y, 295, 285);
      const source = sources[id], frame = source.frame(t, { motion, style: s.id }), [ox, oy] = source.rig.definition.canvas.origin;
      const scale = id === 'cat' ? 1.17 : .72, ground = id === 'cat' ? 70 : 95;
      g.save(); g.beginPath(); g.rect(x, y, 295, 285); g.clip();
      g.drawImage(frame, x + 147 - ox * scale, y + 231 - (oy + ground) * scale, frame.width * scale, frame.height * scale); g.restore();
      label(s.name, x + 18, y + 35, 20);
    }
    return scene.canvas;
  }
  // The gallery tile: the cat runs and the robot jumps twice, then waves. Mid-loop the joint chains
  // that drive them fade in over the art for about a second, then fade out again (period 4 s).
  const RIG_PERIOD = 4, XRAY = [1.45, 2.65];
  function robotMotion(t) {
    if (t < 2.4) return { motion: 'jump', offset: t % 1.2 };
    return { motion: 'wave', offset: t - 2.4, overrides: { duration: 1.6, raise: .4, lower: .4 } };
  }
  function atlas(time) {
    const t = ((time % RIG_PERIOD) + RIG_PERIOD) % RIG_PERIOD, groundY = 560;
    const cat = { character: 'cat', motion: 'run', x: 370, y: groundY - 70 * 2, scale: 2, travel: false };
    const r = robotMotion(t), robot = { character: 'robot', motion: r.motion, offset: r.offset, overrides: r.overrides, x: 965, y: groundY - 95 * 1.7, scale: 1.7, travel: false };
    // Each actor runs on its own local clock (offset), so give both the same scene time 0.
    const local = a => ({ ...a, start: 0, offset: a === cat ? t : a.offset });
    scene.frame(0, { background: '#f1eee7', actors: [local(cat), local(robot)] });
    // Ground: the cat's floor scrolls at its running speed so it reads as running, the robot's stays put.
    const run = sources.cat.rig.definition.motions.run.speed * 2 * t;
    g.strokeStyle = '#ccd1c7'; g.lineWidth = 3; g.beginPath(); g.moveTo(40, groundY); g.lineTo(600, groundY); g.moveTo(700, groundY); g.lineTo(1240, groundY); g.stroke();
    g.fillStyle = '#ccd1c7';
    g.save(); g.beginPath(); g.rect(40, groundY, 560, 30); g.clip();
    for (let x = 40 - run % 80; x < 600; x += 80) g.fillRect(x, groundY + 14, 28, 4);
    g.restore();
    // X-ray: veil the art a little and draw only the joint chains on top.
    const k = smooth((t - XRAY[0]) / .25) * (1 - smooth((t - XRAY[1] + .25) / .25));
    if (k > 0) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(241,238,231,${.45 * k})`; g.fillRect(0, 0, 1280, 720);
      scene.frame(0, { clear: false, actors: [local(cat), local(robot)].map(a => ({ ...a, skeleton: 3, parts: false, opacity: k })) });
      g.globalAlpha = k; label('JOINT CHAINS', 1236 - 170, 68, 22, '#17806f'); g.globalAlpha = 1;
    }
    label('Image parts + joints = a character you can direct', 44, 68, 30);
    label('Four leg chains · foot contact', 160, 622, 24); label('Two legs + an arm chain · jump, wave', 780, 622, 24);
    return scene.canvas;
  }
  return { sources, scene, canvas: scene.canvas, frame(t, mode = 'single', options = {}) {
    if (mode === 'pairs') return pairs(t, options);
    if (mode === 'board') return board(t, options);
    if (mode === 'rig') return atlas(t);
    if (mode === 'reel') {
      if (t < 3) return pairs(t);
      if (t < 6) return single(t - 3, { character: 'cat', motion: 'run', style: STYLE_PRESETS[Math.floor((t - 3) / .75) + 1].id });
      if (t < 9) return single(t - 6, { character: 'robot', motion: 'wave', style: STYLE_PRESETS[Math.floor((t - 6) / .75) + 2].id });
      return board(t - 9, { character: t < 10.5 ? 'cat' : 'robot' });
    }
    return single(t, options);
  } };
}
