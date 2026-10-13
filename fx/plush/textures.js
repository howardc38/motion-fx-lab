// Fabric textures for the plush family. Procedural ones are Canvas 2D drawn from a seed, so every
// browser draws the same pixels; the optional photographed set is CC0 (see assets/plush/manifest.json).
import * as T from 'three';

export function rng(seed = 1) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, {repeat = [1, 1], color = true} = {}) {
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...repeat);
  if (color) t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t;
}

/** Felt: soft fibres in a near-flat colour. Returns {map, bump}. */
export function felt(color = '#f1dcc0', seed = 3) {
  const [c, g] = canvas(256, 256), [b, h] = canvas(256, 256), r = rng(seed);
  g.fillStyle = color; g.fillRect(0, 0, 256, 256); h.fillStyle = '#808080'; h.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = r() * 256, y = r() * 256, a = r() * Math.PI, l = 3 + r() * 9, light = r() > .5;
    g.strokeStyle = light ? 'rgba(255,255,255,.06)' : 'rgba(60,30,20,.03)'; g.lineWidth = .7;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    h.strokeStyle = light ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.18)'; h.lineWidth = .8;
    h.beginPath(); h.moveTo(x, y); h.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); h.stroke();
  }
  return {map: tex(c), bump: tex(b, {color: false})};
}

/** Satin-stitch embroidery: parallel glossy threads (horizontal bands in v). */
export function satin(color = '#3a2219', threads = 22) {
  const [c, g] = canvas(64, 512), [b, h] = canvas(64, 512), step = 512 / threads, base = new T.Color(color);
  g.fillStyle = color; g.fillRect(0, 0, 64, 512);
  for (let i = 0; i < threads; i++) {
    const y = i * step, grad = g.createLinearGradient(0, y, 0, y + step), hi = base.clone().lerp(new T.Color('#ffffff'), .28).getStyle();
    grad.addColorStop(0, base.clone().multiplyScalar(.6).getStyle()); grad.addColorStop(.45, hi); grad.addColorStop(1, base.clone().multiplyScalar(.55).getStyle());
    g.fillStyle = grad; g.fillRect(0, y, 64, step);
    const hg = h.createLinearGradient(0, y, 0, y + step); hg.addColorStop(0, '#202020'); hg.addColorStop(.5, '#ffffff'); hg.addColorStop(1, '#202020');
    h.fillStyle = hg; h.fillRect(0, y, 64, step);
  }
  return {map: tex(c), bump: tex(b, {color: false})};
}

/** Gingham cotton check with a visible plain weave. */
export function gingham(a = '#7fb6df', bg = '#fbf7ef', checks = 8) {
  const S = 512, [c, g] = canvas(S, S), [b, h] = canvas(S, S), cell = S / checks;
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  const col = new T.Color(a);
  for (let i = 0; i < checks; i++) for (let j = 0; j < checks; j++) {
    const v = (i % 2) + (j % 2); if (!v) continue;
    g.fillStyle = col.clone().lerp(new T.Color(bg), v === 1 ? .45 : 0).getStyle(); g.fillRect(i * cell, j * cell, cell, cell);
  }
  h.fillStyle = '#808080'; h.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x += 4) {
    const over = ((x + y) / 4) % 2;
    g.fillStyle = over ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)'; g.fillRect(x, y, 4, 2);
    h.fillStyle = over ? '#b0b0b0' : '#505050'; h.fillRect(x, y, 4, 2); h.fillStyle = over ? '#606060' : '#a8a8a8'; h.fillRect(x, y + 2, 4, 2);
  }
  return {map: tex(c), bump: tex(b, {color: false})};
}

/** Chunky knit: rows of V stitches. */
export function knit(color = '#efe2cc', seed = 8) {
  const W = 256, H = 256, [c, g] = canvas(W, H), [b, h] = canvas(W, H), r = rng(seed), base = new T.Color(color);
  g.fillStyle = base.clone().multiplyScalar(.72).getStyle(); g.fillRect(0, 0, W, H); h.fillStyle = '#202020'; h.fillRect(0, 0, W, H);
  const cw = 32, ch = 24;
  for (let row = -1; row < H / ch + 1; row++) for (let col = 0; col < W / cw; col++) {
    const x = col * cw + cw / 2, y = row * ch, shade = .9 + r() * .14;
    for (const s of [-1, 1]) {
      const grd = g.createRadialGradient(x + s * 7, y + 14, 1, x + s * 7, y + 14, 15);
      grd.addColorStop(0, base.clone().multiplyScalar(shade * 1.06).getStyle()); grd.addColorStop(1, base.clone().multiplyScalar(shade * .8).getStyle());
      g.fillStyle = grd; h.fillStyle = '#ffffff';
      for (const ctx of [g, h]) {
        ctx.save(); ctx.translate(x + s * 7, y + 14); ctx.rotate(s * -.55); ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
  }
  return {map: tex(c), bump: tex(b, {color: false})};
}

/** Soft wall with a faint painted texture. */
export function wall(top = '#dfe8d6', bottom = '#c9d8c0', seed = 4) {
  const [c, g] = canvas(512, 512), r = rng(seed), grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, top); grad.addColorStop(1, bottom); g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${r() * .035})`; g.fillRect(r() * 512, r() * 512, 2 + r() * 6, 1 + r() * 3); }
  return tex(c);
}

// Photographed CC0 fabric (Poly Haven; sources, licence and hashes in assets/plush/manifest.json).
// Decoded once and used only as pixel data. The fur uses the luminance and normal map (tufts,
// mottling, pile direction) under the character colours; felt pads are re-tinted to those colours,
// so the photographs add fibres, not colour.
async function loadImage(url) {
  const img = new Image(); img.decoding = 'sync'; img.src = url; await img.decode(); return img;
}
function pixels(img) {
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d', {willReadFrequently: true}); g.drawImage(img, 0, 0); return [c, g, g.getImageData(0, 0, c.width, c.height)];
}
function dataTex(canvasOrImg, srgb) {
  const t = canvasOrImg instanceof HTMLCanvasElement ? new T.CanvasTexture(canvasOrImg) : new T.Texture(canvasOrImg);
  t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8; t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace; t.needsUpdate = true; return t;
}
const photoCache = new Map();
/** Load the photographed pile and felt once per base URL. Returns {fur, furParams, felt, feltScale}. */
export function loadPhotoSet(base = new URL('../../assets/plush/', import.meta.url)) {
  const key = String(base);
  if (!photoCache.has(key)) photoCache.set(key, buildPhotoSet(base));
  return photoCache.get(key);
}
async function buildPhotoSet(base) {
  const at = f => new URL(f, base).href;
  const [teddyA, teddyN, feltA, feltN, feltR] = await Promise.all([
    'curly_teddy_natural/curly_teddy_natural_diff_1k.jpg', 'curly_teddy_natural/curly_teddy_natural_nor_gl_1k.jpg',
    'caban/caban_diff_1k.jpg', 'caban/caban_nor_gl_1k.jpg', 'caban/caban_rough_1k.jpg'].map(f => loadImage(at(f))));
  // Pack the pile into one texture: rg = normal-map xy, b = albedo luminance (raw sRGB numbers).
  const [, , td] = pixels(teddyA), [pc, pg, tn] = pixels(teddyN); let sum = 0;
  if (tn.width !== td.width || tn.height !== td.height) throw new Error('Pile maps differ in size');
  for (let i = 0; i < td.data.length; i += 4) { const l = (.299 * td.data[i] + .587 * td.data[i + 1] + .114 * td.data[i + 2]) / 255; sum += l; tn.data[i + 2] = Math.round(l * 255); tn.data[i + 3] = 255; }
  pg.putImageData(tn, 0, 0);
  const mean = sum / (td.data.length / 4), packed = dataTex(pc, false); packed.anisotropy = 1;
  // Felt: luminance relative to its mean, re-tinted per colour (cached), mild contrast.
  const [, , fd] = pixels(feltA); let fs = 0; const lum = new Float32Array(fd.data.length / 4);
  for (let i = 0; i < lum.length; i++) { lum[i] = (.299 * fd.data[i * 4] + .587 * fd.data[i * 4 + 1] + .114 * fd.data[i * 4 + 2]) / 255; fs += lum[i]; }
  const fmean = fs / lum.length, tints = new Map();
  const tint = color => {
    if (tints.has(color)) return tints.get(color);
    const c = document.createElement('canvas'); c.width = feltA.naturalWidth; c.height = feltA.naturalHeight;
    const g = c.getContext('2d'), out = g.createImageData(c.width, c.height), col = new T.Color(color).convertLinearToSRGB(), srgb = [col.r, col.g, col.b];
    for (let i = 0; i < lum.length; i++) { const k = Math.pow(lum[i] / fmean, 1.6) * .85 + .15; for (let j = 0; j < 3; j++) out.data[i * 4 + j] = Math.max(0, Math.min(255, Math.round(srgb[j] * 255 * k))); out.data[i * 4 + 3] = 255; }
    g.putImageData(out, 0, 0); const t = dataTex(c, true); tints.set(color, t); return t;
  };
  return {
    fur: {packed, mean},
    furParams: [1.6, .35, 1.4, 1.5],          // repeats per unit, albedo mottling, tuft contrast, nap lean (x fur length)
    felt: {tint, normal: dataTex(feltN, false), rough: dataTex(feltR, false)}, feltScale: 1.4,
  };
}
