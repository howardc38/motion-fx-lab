// The film inside "The Final Final": Pip's "more dramatic" launch video, drawn on a 2D canvas in
// 1280 x 720 design units. Each beat uses the technique of a gallery effect, named in BEATS:
//   count  (tabular counter), sweep (light band), glitch (RGB split + slices), stamp (flash, shake,
//   stamped label). u is seconds since the trailer began; the drawing is a pure function of u.
import {clamp, smooth, hash} from './data.js';
const FONT = 'Arial, Helvetica, sans-serif';
export const TRAILER = {fill: [.35, 2.55], stuck: [2.55, 3.35], glitch: [3.35, 3.95], stamp: 3.95, end: 4.7};
export const BEATS = [
  {effect: 'count', from: TRAILER.fill[0], to: TRAILER.glitch[0], role: 'The percentage counts up to 99 and stops.'},
  {effect: 'sweep', from: TRAILER.fill[0] + .2, to: TRAILER.glitch[0], role: 'Light sweeps the bar while it fills.'},
  {effect: 'glitch', from: TRAILER.glitch[0], to: TRAILER.glitch[1], role: 'At 99% the picture breaks up.'},
  {effect: 'stamp', from: TRAILER.stamp, to: TRAILER.end, role: 'A red flash, a shake and the TO BE CONTINUED stamp.'},
];
const spare = new Map();
/** A second canvas the size of `like`, reused per role. */
function canvasLike(like, role) {
  const key = role + like.width + 'x' + like.height; let c = spare.get(key);
  if (!c) { c = document.createElement('canvas'); c.width = like.width; c.height = like.height; spare.set(key, c); }
  return c;
}
const back = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
export const percentAt = u => u < TRAILER.fill[0] ? 0 : u < TRAILER.fill[1] ? Math.floor(99 * (1 - (1 - (u - TRAILER.fill[0]) / (TRAILER.fill[1] - TRAILER.fill[0])) ** 2.2)) : 99;

/** Draw the trailer at u seconds into g (a 1280 x 720 design canvas; scale the context first). */
export function drawTrailer(g, u, scratch) {
  const pct = percentAt(u);
  const shakeK = u > TRAILER.stamp ? Math.max(0, 1 - (u - TRAILER.stamp) / .6) : 0;
  const sx = shakeK * 16 * Math.sin(u * 95), sy = shakeK * 12 * Math.cos(u * 73);
  g.save(); g.translate(sx, sy);
  // Background: deep cinema blues with drifting light shafts.
  const bg = g.createLinearGradient(0, 0, 0, 720); bg.addColorStop(0, '#0b0f2a'); bg.addColorStop(.55, '#1c1238'); bg.addColorStop(1, '#07060f');
  g.fillStyle = bg; g.fillRect(-40, -40, 1360, 800);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const x = 640 + Math.sin(i * 2.1 + u * .35) * 520, w = 60 + 40 * hash(i);
    const s = g.createLinearGradient(x - w, 0, x + w, 0); s.addColorStop(0, 'rgba(120,90,255,0)'); s.addColorStop(.5, `rgba(150,120,255,${.06 + .05 * hash(i + 3)})`); s.addColorStop(1, 'rgba(120,90,255,0)');
    g.fillStyle = s; g.save(); g.translate(x, 360); g.rotate(-.25 + .1 * hash(i + 7)); g.fillRect(-w, -600, w * 2, 1200); g.restore();
  }
  g.globalCompositeOperation = 'source-over';
  // Title.
  const title = 1;   // on screen from the cut
  g.globalAlpha = title; g.textAlign = 'center'; g.fillStyle = '#c9b8ff'; g.font = `700 22px ${FONT}`; g.letterSpacing = '8px';
  g.fillText('THE LAUNCH VIDEO', 640, 176); g.letterSpacing = '0px';
  g.fillStyle = '#ffffff'; g.font = `800 34px ${FONT}`; g.fillText(u < TRAILER.stuck[0] ? 'Rendering final frames…' : 'Almost there…', 640, 222);
  // count: the big tabular percentage.
  const pulse = u > TRAILER.stuck[0] && u < TRAILER.glitch[0] ? 1 + .04 * Math.sin((u - TRAILER.stuck[0]) * 18) : 1;
  g.save(); g.translate(640, 380); g.scale(pulse, pulse); g.font = `900 176px ${FONT}`;
  g.shadowColor = 'rgba(255,196,90,.75)'; g.shadowBlur = 40; g.fillStyle = '#fff4d8'; g.textBaseline = 'middle'; g.fillText(pct + '%', 0, 0); g.restore();
  // The bar and its fill.
  const bx = 230, by = 500, bw = 820, bh = 26, fw = bw * pct / 100;
  g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.roundRect(bx, by, bw, bh, 13); g.fill();
  if (fw > 0) {
    const fill = g.createLinearGradient(bx, 0, bx + bw, 0); fill.addColorStop(0, '#ff9a3d'); fill.addColorStop(1, '#ffd66b');
    g.fillStyle = fill; g.shadowColor = '#ffb04a'; g.shadowBlur = 24; g.beginPath(); g.roundRect(bx, by, fw, bh, 13); g.fill(); g.shadowBlur = 0;
    // sweep: a skewed band of light crossing the filled part, every 0.9 s.
    if (u > TRAILER.fill[0] + .2 && u < TRAILER.glitch[0]) {
      const k = ((u - TRAILER.fill[0] - .2) % .9) / .9, x = bx - 120 + (fw + 240) * k;
      g.save(); g.beginPath(); g.roundRect(bx, by, fw, bh, 13); g.clip();
      // The gradient is read in the skewed space the band is filled in, so it spans the band itself.
      const sx = x + by * .6, s = g.createLinearGradient(sx - 70, 0, sx + 70, 0); s.addColorStop(0, 'rgba(255,255,255,0)'); s.addColorStop(.5, 'rgba(255,255,255,.9)'); s.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = s; g.transform(1, 0, -.6, 1, 0, 0); g.fillRect(sx - 70, by, 140, bh); g.restore();
    }
    // Sparks from the leading edge, seeded by birth time.
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const born = TRAILER.fill[0] + i * .045, age = u - born; if (age < 0 || age > .9 || born > TRAILER.glitch[0]) continue;
      const x0 = bx + bw * percentAt(born) / 100, vx = -120 - 200 * hash(i), vy = -160 - 160 * hash(i + 9);
      const x = x0 + vx * age, y = by + bh / 2 + vy * age + 300 * age * age, a = 1 - age / .9;
      g.fillStyle = `rgba(255,${190 + 50 * hash(i + 4)},120,${a})`; g.beginPath(); g.arc(x, y, 2 + 2.5 * hash(i + 2), 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
  g.globalAlpha = title * .7; g.fillStyle = '#c9b8ff'; g.font = `600 18px ${FONT}`; g.fillText(u < TRAILER.stuck[0] ? 'final_frames.mov' : 'final_frames.mov · 1 frame left', 640, 566); g.globalAlpha = 1;
  // Letterbox bars.
  g.fillStyle = '#000'; g.fillRect(-40, -40, 1360, 96); g.fillRect(-40, 664, 1360, 96);
  g.restore();
  // glitch: RGB split and displaced slices, seeded per 1/24 s.
  if (u >= TRAILER.glitch[0] && u < TRAILER.glitch[1] && scratch) {
    const k = Math.floor(u * 24), amp = 10 + 22 * smooth((u - TRAILER.glitch[0]) / .4);
    const s = scratch.getContext('2d'); s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, scratch.width, scratch.height); s.drawImage(g.canvas, 0, 0);
    const W = g.canvas.width, H = g.canvas.height, S = W / 1280;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const tint = canvasLike(scratch, 'tint'), tg = tint.getContext('2d');
    g.globalCompositeOperation = 'lighter';
    for (const [dx, colour] of [[-amp * (hash(k) + .3), '#ff0000'], [amp * (hash(k + 5) + .3), '#00ffff'], [0, '#000000']]) {
      if (colour === '#000000') continue;
      tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, W, H); tg.drawImage(scratch, dx * S, 0);
      tg.globalCompositeOperation = 'multiply'; tg.fillStyle = colour; tg.fillRect(0, 0, W, H);
      g.drawImage(tint, 0, 0);
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 7; i++) {
      const y = hash(k * 7 + i) * H, h = (8 + 40 * hash(k * 3 + i)) * S, dx = (hash(k + i * 13) - .5) * 120 * S;
      g.drawImage(scratch, 0, y, W, h, dx, y, W, h);
    }
    g.fillStyle = `rgba(255,255,255,${.08 * hash(k + 1)})`; for (let y = 0; y < H; y += 4 * S) g.fillRect(0, y, W, S);
    g.restore();
  }
  // stamp: red flash, then the label slams down and stays.
  if (u >= TRAILER.stamp) {
    const v = u - TRAILER.stamp, flash = Math.max(0, .6 * (1 - v / .35)), k = clamp(v / .25);
    g.save(); g.fillStyle = `rgba(255,30,60,${flash})`; g.fillRect(-40, -40, 1360, 800);
    g.translate(640 + sx * .4, 380 + sy * .4); g.rotate(-.14); g.scale(2.4 - 1.4 * (k >= 1 ? 1 : back(k)), 2.4 - 1.4 * (k >= 1 ? 1 : back(k))); g.globalAlpha = k > 0 ? 1 : 0;
    g.strokeStyle = '#ff3150'; g.lineWidth = 12; g.fillStyle = 'rgba(40,0,10,.55)'; g.beginPath(); g.roundRect(-430, -92, 860, 184, 20); g.fill(); g.stroke();
    g.fillStyle = '#ff3a58'; g.font = `900 92px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff2040'; g.shadowBlur = 24;
    g.fillText('TO BE CONTINUED…', 0, 6); g.restore();
  }
}
