import { createCharacterSource, STYLE_PRESETS } from './index.js';
import { sampleMotion } from './motion.js';
import { CharacterScene } from './scene.js';

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
    label('透明角色來源 → 配置動作 → 套用角色畫法', 52, 674, 22);
    return scene.canvas;
  }
  function pairs(t, options = {}) {
    const style = options.style || 'original';
    scene.frame(t, { background: '#f1eee7', actors: [
      { character: 'cat', motion: 'jump', style, x: 355, y: 432, scale: 2.2, travel: false },
      { character: 'robot', motion: 'wave', style, x: 934, y: 418, scale: 1.8, travel: false },
    ] });
    label('同一套模組 · 不同關節結構', 52, 74, 36); floor(589);
    label('四腳 · 跳躍', 210, 640, 24); label('兩腳＋雙臂 · 揮手', 800, 640, 24); return scene.canvas;
  }
  function board(t, options = {}) {
    const id = options.character || 'cat', motion = options.motion || (id === 'cat' ? 'run' : 'wave');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1280, 720); g.fillStyle = '#f1eee7'; g.fillRect(0, 0, 1280, 720);
    label('換畫法，角色本身也一起改變', 36, 54, 28);
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
  function atlas(t) {
    scene.frame(t, { background: '#f1eee7', actors: [
      { character: 'cat', motion: 'walk', x: 330, y: 307, scale: 1.8, travel: false, skeleton: true },
      { character: 'robot', motion: 'wave', x: 940, y: 370, scale: 1.4, travel: false, skeleton: true },
    ] });
    label('素材 + 關節配置 = 可控制的角色', 36, 57, 32);
    label('四腳鏈；步態接觸約束', 85, 460, 24); label('兩腳鏈 + 手臂鏈；揮手', 720, 460, 24);
    for (const [id, x] of [['cat', 55], ['robot', 730]]) {
      const source = sources[id]; const parts = source.rig.parts.filter(p => !p.id.startsWith('leg') || p.id === 'leg0' || p.id === 'leg-left').slice(0, 5);
      for (let i = 0; i < parts.length; i++) { const p = parts[i], im = p.image, scale = Math.min(95 / im.width, 100 / im.height); g.drawImage(im, x + i * 100, 500, im.width * scale, im.height * scale); label(p.id, x + i * 100, 630, 14); }
    }
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
