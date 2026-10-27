// Pure WebGL fragment-shader SDF raymarcher for "liquid-chrome-type".
// Dynamically bakes any Latin/CJK string into a 16-bit-encoded Euclidean Distance Transform (EDT)
// RGBA8 texture, extrudes it into a rounded-bevel 3D SDF, and executes a 4-phase seamless 6.0s
// liquid-mercury pour -> negative-radius glyph nucleation -> underdamped spring settle -> gravity drain loop.

const SDF_W = 1024;
const SDF_H = 256;
const WORLD_HALF_X = 2.4;
const WORLD_HALF_Y = 0.6;
const MAX_GLYPHS = 10;

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

let outlinePromise = null;
function loadBundledOutlines() {
  if (!outlinePromise) {
    outlinePromise = fetch(new URL("../../assets/type/motion-cjk.json", import.meta.url))
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return outlinePromise;
}

// Felzenszwalb & Huttenlocher O(N) exact 1D squared Euclidean Distance Transform.
function edt1d(f, d, v, z, n) {
  let k = 0;
  v[0] = 0;
  z[0] = -1e20;
  z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dx = q - v[k];
    d[q] = dx * dx + f[v[k]];
  }
}

function edt2d(grid, w, h) {
  const maxDim = Math.max(w, h);
  const f = new Float64Array(maxDim);
  const d = new Float64Array(maxDim);
  const v = new Int32Array(maxDim);
  const z = new Float64Array(maxDim + 1);

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, d, v, z, h);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) f[x] = grid[row + x];
    edt1d(f, d, v, z, w);
    for (let x = 0; x < w; x++) grid[row + x] = d[x];
  }
}

// Separable [0.25, 0.5, 0.25] smoothing pass on Float32Array SDF for mirror-grade curvature normals.
function smoothField(src, tmp, w, h) {
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const xm = x > 0 ? x - 1 : 0;
      const xp = x + 1 < w ? x + 1 : w - 1;
      tmp[row + x] = 0.25 * src[row + xm] + 0.5 * src[row + x] + 0.25 * src[row + xp];
    }
  }
  for (let y = 0; y < h; y++) {
    const ym = (y > 0 ? y - 1 : 0) * w;
    const yc = y * w;
    const yp = (y + 1 < h ? y + 1 : h - 1) * w;
    for (let x = 0; x < w; x++) {
      src[yc + x] = 0.25 * tmp[ym + x] + 0.5 * tmp[yc + x] + 0.25 * tmp[yp + x];
    }
  }
}

// Render any Latin/CJK string and bake a 16-bit fine + 8-bit wide SDF texture plus per-glyph centers.
function bakeTextSdf(textRaw, outlines) {
  const clean = String(textRaw || "MOTION").trim().slice(0, 14) || "MOTION";
  const chars = [...clean];

  const cv = document.createElement("canvas");
  cv.width = SDF_W;
  cv.height = SDF_H;
  const g = cv.getContext("2d", { willReadFrequently: true });
  g.clearRect(0, 0, SDF_W, SDF_H);

  // Measure each character using bundled Noto Sans TC / display outlines first, Canvas fallback second
  const tracking = 76; // Generous tracking so 3D rounded bevels never fuse adjacent glyphs
  const spaceAdv = 310;
  const items = chars.map((ch) => {
    if (ch === " ") return { ch, space: true, advance: spaceAdv };
    if (ch === "·" || ch === "•" || ch === "-") {
      return { ch, dot: true, advance: 340 };
    }
    const spec = outlines?.glyphs?.[ch] || outlines?.glyphs?.[ch.toUpperCase()];
    if (spec) return { ch, spec, advance: spec.advance };
    return { ch, fallback: true, advance: ch.charCodeAt(0) > 255 ? 1000 : 680 };
  });

  let totalAdv = 0;
  items.forEach((it, idx) => {
    totalAdv += it.advance;
    if (idx + 1 < items.length) totalAdv += tracking;
  });
  totalAdv = Math.max(600, totalAdv);

  const availW = SDF_W * 0.84;
  const availH = SDF_H * 0.64;
  const scale = Math.min(availW / totalAdv, availH / 820);
  const startX = (SDF_W - totalAdv * scale) * 0.5;
  const baselineY = SDF_H * 0.5 + 365 * scale;

  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "alphabetic";

  const glyphMeta = [];
  let cursor = 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const x0 = startX + cursor * scale;
    const wPx = it.advance * scale;
    const cxPx = x0 + wPx * 0.5;

    if (!it.space) {
      if (it.dot) {
        g.beginPath();
        g.arc(cxPx, baselineY - 365 * scale, Math.max(8, 105 * scale), 0, Math.PI * 2);
        g.fill();
      } else if (it.spec) {
        const p = new Path2D();
        p.addPath(new Path2D(it.spec.path), new DOMMatrix([scale, 0, 0, -scale, x0, baselineY]));
        g.fill(p);
      } else {
        const fontPx = Math.round(790 * scale);
        g.font = `900 ${fontPx}px "Noto Sans TC", "Archivo Black", "Helvetica Neue", Arial, sans-serif`;
        g.fillText(it.ch, cxPx, baselineY);
      }

      if (glyphMeta.length < MAX_GLYPHS) {
        const worldX = ((cxPx / SDF_W) * 2 - 1) * WORLD_HALF_X;
        const worldHalfW = Math.max(0.06, (wPx / SDF_W) * WORLD_HALF_X);
        const areaW = it.dot ? 0.42 : clamp(it.advance / 780, 0.55, 1.28);
        glyphMeta.push([worldX, worldHalfW, areaW, 0]);
      }
    }
    cursor += it.advance + tracking;
  }

  if (!glyphMeta.length) glyphMeta.push([0, 0.25, 1.0, 0]);
  for (let i = 0; i < glyphMeta.length; i++) {
    glyphMeta[i][3] = glyphMeta.length > 1 ? i / (glyphMeta.length - 1) : 0.5;
  }

  const rgba = g.getImageData(0, 0, SDF_W, SDF_H).data;
  const N = SDF_W * SDF_H;
  const INF = 1e12;
  const gridOut = new Float64Array(N);
  const gridIn = new Float64Array(N);
  const alphaArr = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const a = rgba[i * 4 + 3] / 255;
    alphaArr[i] = a;
    gridOut[i] = a >= 0.5 ? 0 : INF;
    gridIn[i] = a < 0.5 ? 0 : INF;
  }

  edt2d(gridOut, SDF_W, SDF_H);
  edt2d(gridIn, SDF_W, SDF_H);

  // Convert pixel distance to world units (1 px = (2 * WORLD_HALF_X) / SDF_W)
  const pxToWorld = (2 * WORLD_HALF_X) / SDF_W;
  const sdfWorld = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const dOut = Math.sqrt(gridOut[i]);
    const dIn = Math.sqrt(gridIn[i]);
    // Sub-pixel contour refinement right along anti-aliased silhouette boundary
    let signedPx;
    if (dOut <= 1.05 && dIn <= 1.05) {
      signedPx = 0.5 - alphaArr[i];
    } else {
      signedPx = dOut > 0 ? dOut - 0.5 : -(dIn - 0.5);
    }
    sdfWorld[i] = signedPx * pxToWorld;
  }

  const scratch = new Float32Array(N);
  smoothField(sdfWorld, scratch, SDF_W, SDF_H);
  smoothField(sdfWorld, scratch, SDF_W, SDF_H);

  // Encode into RGBA8 (flipped Y so v=0 is bottom -WORLD_HALF_Y, v=1 is top +WORLD_HALF_Y):
  // R, G = 16-bit unsigned fine SDF in [-0.24, +0.36] world units
  // B    = 8-bit coarse wide SDF in [-0.30, +2.20] world units
  // A    = closest glyph normalized index [0..1]
  const texData = new Uint8Array(N * 4);
  for (let y = 0; y < SDF_H; y++) {
    const srcRow = (SDF_H - 1 - y) * SDF_W;
    const dstRow = y * SDF_W;
    for (let x = 0; x < SDF_W; x++) {
      const d = sdfWorld[srcRow + x];
      const fineNorm = clamp((d + 0.24) / 0.6, 0, 1);
      const u16 = Math.round(fineNorm * 65535);
      const wideNorm = clamp((d + 0.3) / 2.5, 0, 1);

      const wx = ((x + 0.5) / SDF_W * 2 - 1) * WORLD_HALF_X;
      let bestIdx = 0;
      let bestDist = 1e9;
      for (let gi = 0; gi < glyphMeta.length; gi++) {
        const gd = Math.abs(wx - glyphMeta[gi][0]);
        if (gd < bestDist) {
          bestDist = gd;
          bestIdx = gi;
        }
      }
      const charNorm = glyphMeta[bestIdx][3];

      const o = (dstRow + x) * 4;
      texData[o] = (u16 >> 8) & 255;
      texData[o + 1] = u16 & 255;
      texData[o + 2] = Math.round(wideNorm * 255);
      texData[o + 3] = Math.round(charNorm * 255);
    }
  }

  return { texData, glyphMeta, text: clean };
}

const VERT_SRC = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform sampler2D uSdfTex;
uniform int uGlyphCount;
uniform vec4 uGlyphs[10];

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
const vec2 TEX_SIZE = vec2(1024.0, 256.0);
const vec2 HALF_EXT = vec2(2.4, 0.6);
const float FLOOR_Y = -0.82;

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / max(k, 0.0001), 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float smax(float a, float b, float k) {
  return -smin(-a, -b, k);
}

float sdCapsuleY(vec3 p, float y0, float y1, float r0, float r1) {
  float lo = min(y0, y1);
  float hi = max(y0, y1);
  float h = clamp((p.y - lo) / max(hi - lo, 0.0001), 0.0, 1.0);
  float r = mix(y0 < y1 ? r0 : r1, y0 < y1 ? r1 : r0, h);
  vec3 q = vec3(p.x, p.y - mix(lo, hi, h), p.z);
  return length(q) - r;
}

float decode16(vec4 tx) {
  float u = (tx.r * 65280.0 + tx.g * 255.0) / 65535.0;
  return u * 0.6 - 0.24;
}

// Sub-texel Hermite interpolation of 16-bit RG-packed SDF (mirror-smooth normals on any WebGL1/2 GPU).
vec2 sampleSdf2D(vec2 xy) {
  vec2 uv = (xy / HALF_EXT) * 0.5 + 0.5;
  vec2 clampedUv = clamp(uv, vec2(0.001), vec2(0.999));
  vec2 outside = max(abs(xy) - HALF_EXT, vec2(0.0));
  float outDist = length(outside);

  // Fast coarse lookup when clearly outside glyph bounds
  if (outDist > 0.20) {
    vec4 c = texture2D(uSdfTex, clampedUv);
    float wide = c.b * 2.5 - 0.3;
    return vec2(wide + outDist, c.a);
  }

  vec4 coarseTap = texture2D(uSdfTex, clampedUv);
  float coarseD = coarseTap.b * 2.5 - 0.3;
  if (coarseD > 0.33) {
    return vec2(coarseD + outDist, coarseTap.a);
  }

  vec2 coord = clampedUv * TEX_SIZE - 0.5;
  vec2 base = floor(coord);
  vec2 f = coord - base;
  // Smooth Hermite texel blend for C1 continuous chrome reflection curvature
  vec2 sf = f * f * (3.0 - 2.0 * f);

  vec2 uv00 = (base + vec2(0.5, 0.5)) / TEX_SIZE;
  vec2 uv10 = (base + vec2(1.5, 0.5)) / TEX_SIZE;
  vec2 uv01 = (base + vec2(0.5, 1.5)) / TEX_SIZE;
  vec2 uv11 = (base + vec2(1.5, 1.5)) / TEX_SIZE;

  vec4 t00 = texture2D(uSdfTex, uv00);
  vec4 t10 = texture2D(uSdfTex, uv10);
  vec4 t01 = texture2D(uSdfTex, uv01);
  vec4 t11 = texture2D(uSdfTex, uv11);

  float d0 = mix(decode16(t00), decode16(t10), sf.x);
  float d1 = mix(decode16(t01), decode16(t11), sf.x);
  float fineD = mix(d0, d1, sf.y);
  float blended = mix(fineD, coarseD, smoothstep(0.24, 0.33, coarseD));
  return vec2(blended + outDist, t00.a);
}

// Analytical underdamped harmonic spring: zeta = 0.55, omega = 18.0
float springWave(float u) {
  if (u <= 0.0) return 1.0;
  float zeta = 0.55;
  float omega = 18.0;
  float wd = 15.03296; // omega * sqrt(1 - zeta^2)
  return exp(-zeta * omega * u) * (cos(wd * u) + (zeta * omega / wd) * sin(wd * u));
}

// Complete 4-phase 6.0s liquid-mercury SDF
float mapMercury(vec3 p) {
  float t = clamp(uTime, 0.0, 6.0);

  // Seamless empty cyclorama guard at t = 0 and t = 6.0
  if (t <= 0.025 || t >= 5.93) return 10.0;

  // Global phase envelopes
  float meltStart = smoothstep(4.30, 4.78, t);
  float drainProg = clamp((t - 4.62) / 1.24, 0.0, 1.0);

  // Smooth-min radius k tightens 0.42 -> 0.06 during pour, loosens 0.06 -> 0.36 during surface-tension melt
  float kPour = mix(0.42, 0.06, smoothstep(0.12, 1.52, t));
  float kActive = mix(kPour, 0.35, meltStart);

  // Per-character local timing from nearest horizontal coordinate
  float charNorm = clamp((p.x + 1.85) / 3.7, 0.0, 1.0);
  float stagger = charNorm * 0.22;

  // Underdamped spring settle (1.5s - 2.3s, zeta = 0.55, omega = 18)
  float sprU = max(0.0, t - (1.36 + stagger * 0.65));
  float spr = springWave(sprU) * (1.0 - smoothstep(2.32, 2.55, t));

  // Bevel puffs during liquid pour & melt, snaps to crisp 0.028 during spring settle & hero hold
  float bevel = 0.028 + 0.040 * max(0.0, spr) + 0.038 * (1.0 - smoothstep(0.95, 1.62, t)) + 0.044 * meltStart;
  float halfDepth = 0.106 + 0.022 * spr;

  // Subtle elastic vertical bounce during spring settle + downward slump during melt
  float slumpY = -0.095 * smoothstep(4.30, 4.95, t) - 1.85 * pow(drainProg, 2.15);
  float bounceY = -0.052 * spr * step(1.25, t);
  vec3 pg = p - vec3(0.0, bounceY + slumpY * 0.28, 0.0);

  // Evaluate 3D rounded-bevel extruded glyph SDF (opExtrusion + bevel rounding)
  float dGlyph = 10.0;
  float nucIn = smoothstep(0.46 + stagger * 0.7, 1.44 + stagger * 0.45, t);
  float nucOut = smoothstep(4.62 + (1.0 - charNorm) * 0.16, 5.16 + (1.0 - charNorm) * 0.16, t);

  if (nucIn > 0.001 && nucOut < 0.999) {
    vec2 s2 = sampleSdf2D(pg.xy);
    // Inset 2D contour by 0.62 * bevel so adjacent letter bevels stay cleanly separated
    float d2 = s2.x + bevel * 0.62;
    vec2 w = vec2(d2, abs(pg.z) - (halfDepth - bevel));
    float d3 = min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - bevel;

    // Internal negative-radius glyph nucleation: d_glyph + mix(0.28, 0.0, p)
    // Plus overlap-ordered melt retraction so droplets regrow BEFORE glyph SDF recedes
    float negOffset = mix(0.28, 0.0, nucIn) + mix(0.0, 0.30, nucOut);
    dGlyph = d3 + negOffset;

    // Damp surface liquid ripple cleanly to 0 during hero hold (2.3s - 4.3s)
    float ripAmp = 0.016 * (1.0 - smoothstep(1.35, 2.15, t)) + 0.020 * smoothstep(4.32, 4.80, t);
    if (ripAmp > 0.0002 && abs(dGlyph) < 0.25) {
      dGlyph += ripAmp * sin(pg.x * 9.5 + t * 8.0) * cos(pg.y * 11.0 - t * 9.5);
    }
  }

  // Top-down mercury stream + tendrils + droplets (0.0 - 1.65s) & downward gravity drain (4.35 - 5.92s)
  float dLiquid = 10.0;
  bool pourActive = t < 1.78;
  bool meltActive = t > 4.30;

  if (pourActive || meltActive) {
    for (int i = 0; i < 10; i++) {
      if (i >= uGlyphCount) break;
      vec4 gm = uGlyphs[i];
      float gx = gm.x;
      float gw = gm.y;
      float area = gm.z;
      float giNorm = gm.w;
      float fi = float(i);

      if (pourActive) {
        float st = 0.03 + giNorm * 0.22;
        float uHead = clamp((t - st) / 0.62, 0.0, 1.0);
        float uTail = clamp((t - (st + 0.34)) / 0.96, 0.0, 1.0);

        if (uHead > 0.001 && uTail < 0.999) {
          // Stream pours from y = +H (+2.38) onto glyph baseline y = 0.0
          float yHead = mix(2.38, -0.04, pow(uHead, 1.45));
          float yTail = mix(2.48, 0.02, pow(uTail, 1.85));
          float pinch = 1.0 - smoothstep(0.75, 1.0, uTail);
          float rStream = (0.068 + 0.045 * area) * pinch;

          float sway = 0.035 * sin(p.y * 3.8 - t * 9.0 + fi * 1.9) * (1.0 - uTail);
          vec3 ps = p - vec3(gx + sway, 0.0, 0.02 * cos(fi * 2.3));
          float dCol = sdCapsuleY(ps, yHead, yTail, rStream * 1.18, rStream * 0.58);
          // Rayleigh-Plateau liquid-mercury beading along the falling stream
          dCol += 0.014 * sin(p.y * 13.0 + t * 16.0 + fi * 2.7) * pinch;
          dLiquid = smin(dLiquid, dCol, 0.22);

          // Trailing satellite droplet & lateral tendril
          float uDrop = clamp((t - (st + 0.18)) / 0.92, 0.0, 1.0);
          if (uDrop > 0.0 && uDrop < 1.0) {
            float dy = mix(2.42, 0.04, pow(uDrop, 1.65));
            float dx = gx + (mod(fi, 2.0) == 0.0 ? 1.0 : -1.0) * gw * 0.48 * (1.0 - uDrop * 0.7);
            float rDrop = 0.078 * area * sin(uDrop * PI);
            vec3 pd = (p - vec3(dx, dy, 0.0)) * vec3(1.0, 0.68, 1.0); // velocity-aligned vertical stretch
            dLiquid = smin(dLiquid, length(pd) - rDrop, 0.24);
          }
        }
      }

      if (meltActive) {
        // Overlap-ordered reverse melt: regrow mercury mass inside glyph at 4.32s, then accelerate y -> -H (-2.45)
        float mst = 4.32 + (1.0 - giNorm) * 0.14;
        float uGrow = smoothstep(mst, mst + 0.34, t);
        float uFall = clamp((t - (mst + 0.22)) / 1.18, 0.0, 1.0);

        if (uGrow > 0.001 && uFall < 0.999) {
          float fallY = -2.55 * pow(uFall, 2.15);
          float tailY = -2.55 * pow(clamp(uFall - 0.22, 0.0, 1.0), 2.0);
          float vanish = 1.0 - smoothstep(0.80, 1.0, uFall);
          float rDrain = (0.095 + 0.055 * area) * uGrow * vanish;

          vec3 pm = p - vec3(gx + 0.025 * sin(fi * 3.1 + t * 5.0), 0.0, 0.0);
          float dRibbon = sdCapsuleY(pm, fallY, min(0.06, tailY + 0.18 * (1.0 - uFall)), rDrain * 1.12, rDrain * 0.52);
          dRibbon += 0.013 * sin(p.y * 12.0 + t * 14.0 + fi) * vanish;
          dLiquid = smin(dLiquid, dRibbon, 0.24);

          // Secondary trailing droplet pinching off above main falling drop
          float uTrail = clamp((t - (mst + 0.38)) / 1.02, 0.0, 1.0);
          if (uTrail > 0.0 && uTrail < 1.0) {
            float ty = 0.08 - 2.48 * pow(uTrail, 2.2);
            float tx = gx + (mod(fi, 2.0) == 0.0 ? -0.35 : 0.35) * gw;
            float rT = 0.068 * area * sin(uTrail * PI);
            vec3 pt = (p - vec3(tx, ty, 0.0)) * vec3(1.0, 0.72, 1.0);
            dLiquid = smin(dLiquid, length(pt) - rT, 0.20);
          }
        }
      }
    }
  }

  return smin(dGlyph, dLiquid, kActive);
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.0024, -0.0024);
  return normalize(
    e.xyy * mapMercury(p + e.xyy) +
    e.yyx * mapMercury(p + e.yyx) +
    e.yxy * mapMercury(p + e.yxy) +
    e.xxx * mapMercury(p + e.xxx)
  );
}

// Ray-AABB intersection to skip empty cyclorama space immediately.
vec2 intersectAABB(vec3 ro, vec3 rd, vec3 bMin, vec3 bMax) {
  vec3 inv = 1.0 / rd;
  vec3 t0 = (bMin - ro) * inv;
  vec3 t1 = (bMax - ro) * inv;
  vec3 tSmaller = min(t0, t1);
  vec3 tBigger = max(t0, t1);
  float tNear = max(max(tSmaller.x, tSmaller.y), tSmaller.z);
  float tFar = min(min(tBigger.x, tBigger.y), tBigger.z);
  return vec2(tNear, tFar);
}

// Exact linear-light terracotta cyclorama (#D97757 -> #B9573A in sRGB after 1/2.2 gamma)
const vec3 TERRA_LIGHT = vec3(0.701, 0.188, 0.094); // linear #D97757
const vec3 TERRA_DEEP  = vec3(0.493, 0.094, 0.039); // linear #B9573A
const vec3 TERRA_GLOW  = vec3(0.840, 0.305, 0.155); // linear warm key center

vec3 studioBackdrop(vec3 rd) {
  float radial = length(vec2(rd.x * 0.80, rd.y - 0.02));
  vec3 cyc = mix(TERRA_LIGHT, TERRA_DEEP, smoothstep(0.05, 0.56, radial));
  float keyGlow = exp(-dot(vec2(rd.x + 0.06, rd.y - 0.13), vec2(rd.x + 0.06, rd.y - 0.13)) * 10.5);
  return cyc + (TERRA_GLOW - TERRA_LIGHT) * keyGlow * 0.55;
}

// Analytic high-contrast photo-studio dome reflected by the liquid-mirror mercury chrome:
// Obsidian negative-fill front panel + -6 deg tilted horizon strip + overhead/key softboxes +
// terracotta #D97757/#B9573A cyclorama bounce + travelling 40-deg hero specular glint!
vec3 studioReflection(vec3 R, float t) {
  float elev = asin(clamp(R.y, -1.0, 1.0)); // radians
  float azim = atan(R.x, R.z);              // 0 = toward camera (+Z), +-PI = behind subject (-Z)

  // Base studio dome: deep obsidian negative fill on camera side so chrome reads as liquid metal,
  // transitioning to rich terracotta cyclorama behind & to the sides
  float rearMask = smoothstep(0.68, 2.08, abs(azim));
  vec3 env = mix(vec3(0.018, 0.020, 0.026), mix(TERRA_DEEP, TERRA_LIGHT, 0.65), rearMask);

  // Crisp cool-silver sky gradient across upper camera hemisphere
  env += vec3(0.16, 0.17, 0.195) * smoothstep(-0.18, 0.56, R.y) * (1.0 - rearMask * 0.55);

  // -6 degree (-0.1047 rad) tilted studio horizon strip across camera-side panel (critical chrome cue!)
  float tiltedElev = elev + 0.1047 + R.x * (-0.105);
  float horizonBand = exp(-pow(tiltedElev / 0.052, 2.0)) * smoothstep(1.48, 0.42, abs(azim));
  env = mix(env, vec3(1.12, 1.10, 1.08), horizonBand * 0.90);
  // Secondary crisp silver lower hairline under the horizon band
  float subStrip = exp(-pow((tiltedElev + 0.185) / 0.025, 2.0)) * smoothstep(1.38, 0.35, abs(azim));
  env += vec3(0.58, 0.55, 0.52) * subStrip;

  // Overhead studio softbox (crisp white speculars on top bevels)
  float topBox = smoothstep(0.50, 0.70, R.y) * smoothstep(0.88, 0.30, abs(R.x)) * smoothstep(0.92, 0.25, abs(R.z));
  env += vec3(2.85, 2.82, 2.78) * topBox;

  // Upper-left key softbox
  vec3 keyDir = normalize(vec3(-0.52, 0.68, 0.51));
  float keyBox = smoothstep(0.81, 0.95, dot(R, keyDir));
  env += vec3(3.10, 3.02, 2.94) * keyBox;

  // Warm #D97757 terracotta rim strip & right bevel kicker
  vec3 rimDir = normalize(vec3(0.74, 0.28, -0.61));
  float rimKicker = smoothstep(0.64, 0.92, dot(R, rimDir));
  env += TERRA_LIGHT * 2.55 * rimKicker;

  vec3 leftRim = normalize(vec3(-0.78, 0.18, -0.59));
  env += TERRA_DEEP * 2.10 * smoothstep(0.68, 0.93, dot(R, leftRim));

  // Travelling 40-degree tilted softbox specular glint across hero hold (1.9s -> 4.15s, centered near hero = 2.75s)
  if (t > 1.75 && t < 4.30) {
    float gProg = clamp((t - 1.85) / 2.25, 0.0, 1.0);
    float gEnv = sin(gProg * PI);
    float sweepCenter = mix(-0.48, 0.52, gProg);
    float diag = R.x * 0.766 + R.y * 0.643 - sweepCenter;
    float glint = exp(-pow(diag / 0.028, 2.0)) * smoothstep(-0.15, 0.65, R.z) * gEnv;
    env += vec3(2.90, 2.80, 2.66) * glint;
  }

  // Lower warm terracotta floor bounce on downward normals
  if (R.y < -0.04) {
    float floorBounce = smoothstep(-0.04, -0.52, R.y);
    env = mix(env, mix(TERRA_LIGHT, vec3(0.82, 0.44, 0.28), 0.32), floorBounce * 0.76);
  }

  return env;
}

float softFloorShadow(vec3 ro, vec3 rd) {
  vec2 hit = intersectAABB(ro, rd, vec3(-2.45, FLOOR_Y, -0.45), vec3(2.45, 2.42, 0.45));
  if (hit.y < 0.0 || hit.x > hit.y) return 1.0;
  float t = max(0.03, hit.x);
  float res = 1.0;
  for (int i = 0; i < 24; i++) {
    vec3 p = ro + rd * t;
    if (p.y > 2.38 || t > hit.y) break;
    float h = mapMercury(p);
    res = min(res, 6.2 * h / max(t, 0.12));
    t += clamp(h, 0.035, 0.24);
    if (res < 0.02) break;
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}

// Primary raymarch returning vec2(tHit, minAngularCone) so near-miss silhouette rays trigger 4x RGSS.
vec2 traceMercury(vec3 ro, vec3 rd, float tFloor) {
  vec2 box = intersectAABB(ro, rd, vec3(-2.5, FLOOR_Y - 0.02, -0.45), vec3(2.5, 2.45, 0.45));
  if (box.y <= 0.0 || box.x >= box.y || box.x >= tFloor) {
    return vec2(-1.0, 1e6);
  }
  float tm = max(0.0, box.x);
  float tLimit = min(box.y, tFloor);
  float minCone = 1e6;
  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * tm;
    float h = mapMercury(p);
    minCone = min(minCone, h / max(tm, 0.5));
    if (h < 0.00034 * tm) {
      return vec2(tm, 0.0);
    }
    tm += h * 0.80;
    if (tm > tLimit) break;
  }
  return vec2(-1.0, minCone);
}

// Shade hit mercury surface with Schlick Fresnel, chromatic edge dispersion, and crevice inter-reflection.
vec4 shadeMercury(vec3 ro, vec3 rd, float tHit, vec3 uu, float t, vec3 bgCol) {
  vec3 pos = ro + rd * tHit;
  vec3 nor = calcNormal(pos);
  float ndv = max(dot(-rd, nor), 0.0);

  // Schlick Fresnel for liquid mercury (F0 = 0.935) + subtle chromatic Fresnel edge dispersion!
  float fres = 0.935 + 0.065 * pow(1.0 - ndv, 5.0);
  float edgeDisp = pow(1.0 - ndv, 3.0) * 0.034;

  vec3 reflC = reflect(rd, nor);
  vec3 reflR = normalize(reflect(rd, normalize(nor + uu * edgeDisp)));
  vec3 reflB = normalize(reflect(rd, normalize(nor - uu * edgeDisp)));

  vec3 envC = studioReflection(reflC, t);
  vec3 envR = studioReflection(reflR, t);
  vec3 envB = studioReflection(reflB, t);
  vec3 specCol = vec3(envR.r, envC.g, envB.b);

  // Secondary inter-reflection check inside tight liquid-mercury crevices
  vec2 secBox = intersectAABB(pos + nor * 0.006, reflC, vec3(-2.45, FLOOR_Y, -0.42), vec3(2.45, 2.2, 0.42));
  if (secBox.y > 0.0 && secBox.x < secBox.y && secBox.y < 1.8) {
    float ts = max(0.012, secBox.x);
    for (int j = 0; j < 20; j++) {
      vec3 sp = pos + nor * 0.006 + reflC * ts;
      float sh = mapMercury(sp);
      if (sh < 0.002) {
        vec3 sn = calcNormal(sp);
        vec3 bounceEnv = studioReflection(reflect(reflC, sn), t);
        specCol = mix(specCol, bounceEnv * vec3(0.92, 0.90, 0.88), 0.78);
        break;
      }
      ts += max(sh, 0.02);
      if (ts > min(secBox.y, 1.4)) break;
    }
  }

  // Subtle cavity ambient occlusion in smin necks
  float occ = clamp(0.5 + 0.5 * (mapMercury(pos + nor * 0.06) / 0.06), 0.28, 1.0);
  vec3 mCol = specCol * fres * mix(0.70, 1.0, occ);

  // Smooth meniscus blend right at the studio floor during gravity drain
  float floorSeam = smoothstep(FLOOR_Y, FLOOR_Y + 0.035, pos.y);
  return vec4(mix(bgCol * 0.88, mCol, floorSeam), ndv);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = mod(uTime, 6.0);

  // Subtle periodic camera parallax (smoothly zeroed at t = 0 and t = 6.0 for seamless loop!)
  float camEnv = sin((t / 6.0) * PI);
  float holdPush = smoothstep(1.3, 2.5, t) * (1.0 - smoothstep(4.2, 5.5, t));
  float orbitYaw = 0.095 * sin((t / 6.0) * TAU) * camEnv;
  float camDist = 5.45 - 0.28 * holdPush;
  float camY = 0.10 + 0.05 * sin((t / 6.0) * TAU) * camEnv;

  vec3 ro = vec3(sin(orbitYaw) * camDist, camY, cos(orbitYaw) * camDist);
  vec3 ta = vec3(0.0, -0.05, 0.0);
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  // ~30 degree vertical lens
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.86 * ww);

  // Evaluate background cyclorama + studio floor contact shadow & mirror bounce
  vec3 bgCol = studioBackdrop(rd);
  float tFloor = rd.y < -0.001 ? (FLOOR_Y - ro.y) / rd.y : 1e6;

  if (tFloor < 16.0) {
    vec3 fPos = ro + rd * tFloor;
    float floorFade = exp(-max(0.0, length(fPos.xz * vec2(0.45, 0.85)) - 0.6) * 0.85) * smoothstep(4.2, 1.6, fPos.z);

    if (floorFade > 0.004 && t > 0.03 && t < 5.91) {
      vec3 lightDir = normalize(vec3(-0.18, 1.35, 0.22));
      float sh = softFloorShadow(fPos + vec3(0.0, 0.006, 0.0), lightDir);
      float dAbove = mapMercury(fPos + vec3(0.0, 0.14, 0.0));
      float contactAo = clamp(dAbove / 0.36, 0.0, 1.0);
      float shadowFactor = mix(1.0, sh * mix(0.56, 1.0, contactAo), floorFade * 0.64);
      bgCol *= shadowFactor;

      // Glossy studio floor reflection (12% mirror bounce of the pouring chrome letters)
      vec3 fRefl = reflect(rd, vec3(0.0, 1.0, 0.0));
      vec2 rBox = intersectAABB(fPos + vec3(0.0, 0.005, 0.0), fRefl, vec3(-2.45, FLOOR_Y, -0.45), vec3(2.45, 2.35, 0.45));
      if (rBox.y > 0.0 && rBox.x < rBox.y) {
        float tr = max(0.01, rBox.x);
        for (int k = 0; k < 28; k++) {
          vec3 rp = fPos + vec3(0.0, 0.005, 0.0) + fRefl * tr;
          float rh = mapMercury(rp);
          if (rh < 0.003) {
            vec3 rn = calcNormal(rp);
            vec3 rCol = studioReflection(reflect(fRefl, rn), t);
            float rDistFade = exp(-tr * 0.82);
            bgCol = mix(bgCol, rCol, 0.13 * floorFade * rDistFade);
            break;
          }
          tr += max(rh, 0.025);
          if (tr > rBox.y) break;
        }
      }
    }
  }

  // Primary raymarch + adaptive 4x Rotated-Grid Supersampling (RGSS) strictly along silhouette & grazing bevel edges!
  vec2 hit0 = traceMercury(ro, rd, tFloor);
  vec3 col = bgCol;
  bool needEdgeAA = false;
  float pxAng = 1.0 / (1.86 * uRes.y);

  if (hit0.x > 0.0) {
    vec4 sh0 = shadeMercury(ro, rd, hit0.x, uu, t, bgCol);
    col = sh0.rgb;
    needEdgeAA = sh0.a < 0.38;
  } else {
    needEdgeAA = hit0.y < pxAng * 2.6;
  }

  if (needEdgeAA) {
    vec2 offs[3];
    offs[0] = vec2(-0.375, 0.125);
    offs[1] = vec2(0.125, 0.375);
    offs[2] = vec2(0.375, -0.125);
    vec3 acc = col;
    for (int s = 0; s < 3; s++) {
      vec2 suv = (gl_FragCoord.xy + offs[s] - 0.5 * uRes) / uRes.y;
      vec3 srd = normalize(suv.x * uu + suv.y * vv + 1.86 * ww);
      float stFloor = srd.y < -0.001 ? (FLOOR_Y - ro.y) / srd.y : 1e6;
      vec2 sh = traceMercury(ro, srd, stFloor);
      if (sh.x > 0.0) {
        acc += shadeMercury(ro, srd, sh.x, uu, t, bgCol).rgb;
      } else {
        acc += bgCol;
      }
    }
    col = acc * 0.25;
  }

  // Filmic studio shoulder tone-mapping (pure linear below 0.72 so terracotta #D97757 stays exact, smooth chrome highlight roll-off)
  vec3 x = max(col, vec3(0.0));
  vec3 mapped = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  col = mix(x, mapped, smoothstep(0.72, 1.45, max(x.r, max(x.g, x.b))));

  // Subtle calibrated studio vignette + deterministic sub-LSB dither to prevent 8-bit sky banding
  float vig = 1.0 - 0.075 * dot(uv, uv);
  col *= vig;
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)) + dither / 255.0;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

function compileShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("ChromeType GLSL compile error: " + info);
  }
  return sh;
}

export async function createChromeType(options = {}) {
  const width = options.width || 1280;
  const height = options.height || 720;
  const canvas = options.canvas || document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const glAttrs = { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true };
  const gl = canvas.getContext("webgl2", glAttrs) || canvas.getContext("webgl", glAttrs);
  if (!gl) throw new Error("WebGL is unavailable for liquid-chrome-type");

  const outlines = await loadBundledOutlines();
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("ChromeType GLSL link error: " + gl.getProgramInfoLog(prog));
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(prog, "aPos");
  const uRes = gl.getUniformLocation(prog, "uRes");
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uSdfTex = gl.getUniformLocation(prog, "uSdfTex");
  const uGlyphCount = gl.getUniformLocation(prog, "uGlyphCount");
  const uGlyphLocs = Array.from({ length: MAX_GLYPHS }, (_, i) => gl.getUniformLocation(prog, `uGlyphs[${i}]`));

  const sdfTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, sdfTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const bakeCache = new Map();
  let uploadedText = null;
  let activeMeta = [];

  function ensureTextBaked(rawText) {
    const target = String(rawText || "MOTION").trim() || "MOTION";
    if (uploadedText === target) return;
    let baked = bakeCache.get(target);
    if (!baked) {
      if (bakeCache.size > 10) bakeCache.clear();
      baked = bakeTextSdf(target, outlines);
      bakeCache.set(target, baked);
    }
    gl.bindTexture(gl.TEXTURE_2D, sdfTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SDF_W, SDF_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, baked.texData);
    uploadedText = target;
    activeMeta = baked.glyphMeta;
  }

  const initialText =
    options.text || (typeof window !== "undefined" && window.FX_CUSTOM_TEXT ? String(window.FX_CUSTOM_TEXT) : "MOTION");
  ensureTextBaked(initialText);

  let lastProof = { text: uploadedText, glyphCount: activeMeta.length, time: 0 };

  function frame(t, frameOpts = {}) {
    if (!Number.isFinite(t)) throw new Error("frame(t) requires finite time");
    const desiredText =
      frameOpts.text ??
      options.text ??
      (typeof window !== "undefined" && window.FX_CUSTOM_TEXT ? String(window.FX_CUSTOM_TEXT) : "MOTION");
    ensureTextBaked(desiredText);

    const localT = ((Math.max(0, t) % 6.0) + 6.0) % 6.0;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sdfTex);
    gl.uniform1i(uSdfTex, 0);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, localT);
    gl.uniform1i(uGlyphCount, activeMeta.length);

    for (let i = 0; i < MAX_GLYPHS; i++) {
      const m = activeMeta[i] || [0, 0.2, 1, 0];
      gl.uniform4f(uGlyphLocs[i], m[0], m[1], m[2], m[3]);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    lastProof = { text: uploadedText, glyphCount: activeMeta.length, time: +localT.toFixed(3) };
    return lastProof;
  }

  function resize(w, h) {
    canvas.width = w;
    canvas.height = h;
  }

  function destroy() {
    bakeCache.clear();
    gl.deleteTexture(sdfTex);
    gl.deleteBuffer(quadBuf);
    gl.deleteProgram(prog);
  }

  return { canvas, frame, resize, destroy, proof: () => lastProof };
}

export default createChromeType;
