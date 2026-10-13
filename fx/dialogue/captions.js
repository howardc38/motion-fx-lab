// Word-highlighted captions and a mouth-cue strip, drawn on a 2D canvas in 1280 x 720 design units
// (the caller scales the context). Both read the same manifest as the mouths, so they cannot drift.
import {clamp, smooth, wordIndex} from './data.js';

const FONT = 'Arial, Helvetica, sans-serif';
/**
 * Draw the caption of `turn` at time t. Spoken words are white, the current word sits on a coloured
 * pill, coming words are dim. opts: {size, y (bottom), colour, max (line width), box}.
 */
export function drawCaption(ctx, turn, t, {size = 40, y = 676, colour = '#ffd166', max = 1040, box = 'rgba(6,18,24,.78)', ink = '#132026'} = {}) {
  if (!turn) return null;
  const a = smooth((t - turn.start + .08) / .14) * (1 - smooth((t - turn.end - .18) / .18));
  if (a <= 0) return null;
  const words = turn.words || turn.text.split(' ').map(text => ({text, start: 0, end: 0}));
  const current = wordIndex(turn, t), live = t < turn.end + .02 ? current : words.length - 1;
  ctx.save(); ctx.globalAlpha = a; ctx.font = `700 ${size}px ${FONT}`; ctx.textBaseline = 'middle';
  const space = ctx.measureText(' ').width, pad = size * .22;
  // Lay the words out in lines.
  const lines = [[]]; let width = 0;
  for (const [i, w] of words.entries()) {
    const ww = ctx.measureText(w.text).width;
    if (lines.at(-1).length && width + space + ww > max) { lines.push([]); width = 0; }
    lines.at(-1).push({i, w, ww}); width += (lines.at(-1).length > 1 ? space : 0) + ww;
  }
  const lh = size * 1.32, widths = lines.map(l => l.reduce((s, x) => s + x.ww, 0) + space * (l.length - 1));
  const bw = Math.max(...widths) + size * 1.3, bh = lines.length * lh + size * .55, top = y - bh;
  ctx.fillStyle = box; ctx.beginPath(); ctx.roundRect(640 - bw / 2, top, bw, bh, size * .45); ctx.fill();
  let hit = null;
  lines.forEach((line, row) => {
    let x = 640 - widths[row] / 2; const cy = top + size * .275 + lh * (row + .5);
    for (const {i, w, ww} of line) {
      if (i === live && t < turn.end + .02) {
        const k = smooth((t - turn.start - w.start + .02) / .08);
        ctx.fillStyle = colour; ctx.globalAlpha = a * (.55 + .45 * k);
        ctx.beginPath(); ctx.roundRect(x - pad, cy - size * .62, ww + pad * 2, size * 1.24, size * .3); ctx.fill();
        ctx.globalAlpha = a; ctx.fillStyle = ink; ctx.fillText(w.text, x, cy + 1); hit = {i, x, y: cy, w: ww};
      } else {
        ctx.fillStyle = i <= live ? '#ffffff' : 'rgba(255,255,255,.42)'; ctx.fillText(w.text, x, cy + 1);
      }
      x += ww + space;
    }
  });
  ctx.restore();
  return hit;
}

const LETTERS = ['X', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
/** Nine mouth-cue letters with the current one lit. (x, y) is the right/bottom corner. */
export function drawCueStrip(ctx, id, {x = 1240, y = 700, size = 24, label = 'mouth cue', speaking = true} = {}) {
  const cell = size * 1.18, w = cell * LETTERS.length + size * .5, h = size * 1.75;
  ctx.save(); ctx.font = `700 ${size * .72}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(6,18,24,.7)'; ctx.beginPath(); ctx.roundRect(x - w, y - h, w, h, size * .35); ctx.fill();
  LETTERS.forEach((l, i) => {
    const cx = x - w + size * .25 + cell * (i + .5), cy = y - h / 2 + size * .08, on = l === id && (speaking || l === 'X');
    if (on) { ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.roundRect(cx - cell * .44, cy - size * .52, cell * .88, size * 1.04, size * .22); ctx.fill(); }
    ctx.fillStyle = on ? '#132026' : 'rgba(255,255,255,.55)'; ctx.fillText(l, cx, cy + 1);
  });
  if (label) { ctx.font = `600 ${size * .5}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText(label.toUpperCase(), x - size * .3, y - h - size * .4); }
  ctx.restore();
}

/** Small spaced capitals, used for titles and labels. */
export function label(ctx, text, x, y, {size = 14, colour = '#f1d9b0', align = 'left', weight = 700, spacing = 3} = {}) {
  ctx.save(); ctx.font = `${weight} ${size}px ${FONT}`; ctx.letterSpacing = spacing + 'px'; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = colour; ctx.fillText(text, x, y); ctx.restore();
}
export {FONT, clamp};
