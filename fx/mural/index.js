// Asymmetric Swiss/Bento stroke-swarm mural ("graphic-stroke-mural") and
// off-center exponential dot-iris polarity inversion ("wipe-dot-polarity").
// Pure Canvas 2D, 100% deterministic frame(t), zero external runtime dependencies.

const W = 1920;
const H = 1080;
const TAU = Math.PI * 2;

export const PALETTE = Object.freeze({
  obsidian: "#0D0D0F",
  cream: "#F5F3EE",
  vermilion: "#FF4D2E",
  obsidianSoft: "#1B1C20",
  creamRule: "rgba(13,13,15,0.16)",
  obsidianRule: "rgba(245,243,238,0.16)",
});

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (x) => {
  const t = clamp(x);
  return t * t * (3 - 2 * t);
};
const outExpo = (x) => {
  const t = clamp(x);
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
};
const inExpo = (x) => {
  const t = clamp(x);
  return t <= 0 ? 0 : Math.pow(2, 10 * (t - 1));
};
const inOutExpo = (x) => {
  const t = clamp(x);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t < 0.5 ? 0.5 * Math.pow(2, 20 * t - 10) : 1 - 0.5 * Math.pow(2, -20 * t + 10);
};
const outQuint = (x) => 1 - Math.pow(1 - clamp(x), 5);
const inCubic = (x) => {
  const t = clamp(x);
  return t * t * t;
};
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};
const hash2 = (a, b) => {
  const x = Math.sin(a * 127.1 + b * 311.7 + 74.7) * 43758.5453123;
  return x - Math.floor(x);
};

let outlinePromise = null;
export function loadOutlines() {
  if (!outlinePromise) {
    outlinePromise = fetch(new URL("../../assets/type/motion-cjk.json", import.meta.url)).then((r) => {
      if (!r.ok) throw new Error("Failed to load bundled motion-cjk.json outlines");
      return r.json();
    });
  }
  return outlinePromise;
}

// Parse bundled SVG path strings (M, L, H, V, Q, Z) into dense closed 2D polygon rings in font coordinates.
function parseSvgRings(d, curveSteps = 6) {
  const tokens = d.match(/[MLHVQZ]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
  const rings = [];
  let ring = null;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let cmd = "";
  let i = 0;
  const pushPt = (x, y) => {
    if (!ring) ring = [];
    const last = ring[ring.length - 1];
    if (!last || Math.hypot(x - last[0], y - last[1]) > 0.05) ring.push([x, y]);
    cx = x;
    cy = y;
  };
  while (i < tokens.length) {
    const tk = tokens[i];
    if (/^[A-Za-z]$/.test(tk)) {
      cmd = tk.toUpperCase();
      i++;
      if (cmd === "Z") {
        if (ring && ring.length >= 3) rings.push(ring);
        ring = null;
        cx = sx;
        cy = sy;
      }
      continue;
    }
    if (cmd === "M") {
      const x = +tokens[i++];
      const y = +tokens[i++];
      if (ring && ring.length >= 3) rings.push(ring);
      ring = [[x, y]];
      cx = sx = x;
      cy = sy = y;
      cmd = "L";
    } else if (cmd === "L") {
      pushPt(+tokens[i++], +tokens[i++]);
    } else if (cmd === "H") {
      pushPt(+tokens[i++], cy);
    } else if (cmd === "V") {
      pushPt(cx, +tokens[i++]);
    } else if (cmd === "Q") {
      const qx = +tokens[i++];
      const qy = +tokens[i++];
      const ex = +tokens[i++];
      const ey = +tokens[i++];
      const x0 = cx;
      const y0 = cy;
      for (let s = 1; s <= curveSteps; s++) {
        const u = s / curveSteps;
        const mu = 1 - u;
        pushPt(mu * mu * x0 + 2 * mu * u * qx + u * u * ex, mu * mu * y0 + 2 * mu * u * qy + u * u * ey);
      }
    } else {
      i++;
    }
  }
  if (ring && ring.length >= 3) rings.push(ring);
  return rings;
}

// Clip a convex/simple polygon against half-plane (x - px)*nx + (y - py)*ny <= 0 (Sutherland-Hodgman).
function clipHalfPlane(poly, px, py, nx, ny) {
  const n = poly.length;
  if (!n) return poly;
  const out = [];
  let prev = poly[n - 1];
  let prevD = (prev[0] - px) * nx + (prev[1] - py) * ny;
  for (let i = 0; i < n; i++) {
    const curr = poly[i];
    const currD = (curr[0] - px) * nx + (curr[1] - py) * ny;
    if (currD <= 0) {
      if (prevD > 0) {
        const t = prevD / (prevD - currD);
        out.push([prev[0] + (curr[0] - prev[0]) * t, prev[1] + (curr[1] - prev[1]) * t]);
      }
      out.push(curr);
    } else if (prevD <= 0) {
      const t = prevD / (prevD - currD);
      out.push([prev[0] + (curr[0] - prev[0]) * t, prev[1] + (curr[1] - prev[1]) * t]);
    }
    prev = curr;
    prevD = currD;
  }
  return out;
}

// Build convex Voronoi cells inside [x0, y0, x1, y1] from deterministic site seeds.
function buildVoronoiCells(bounds, sites) {
  const [x0, y0, x1, y1] = bounds;
  const baseBox = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  return sites.map((s, idx) => {
    let cell = baseBox;
    for (let j = 0; j < sites.length; j++) {
      if (j === idx || cell.length < 3) continue;
      const o = sites[j];
      const mx = 0.5 * (s[0] + o[0]);
      const my = 0.5 * (s[1] + o[1]);
      const dx = o[0] - s[0];
      const dy = o[1] - s[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-5) continue;
      cell = clipHalfPlane(cell, mx, my, dx / len, dy / len);
    }
    return cell;
  });
}

// Decompose non-zero-winding polygon rings (OpenType outlines with overlapping strokes & counter holes) into fine interior quads.
function decomposeRingsNonZero(rings, strips = 48) {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const r of rings) {
    for (const [x, y] of r) {
      if (x < xMin) xMin = x;
      if (y < yMin) yMin = y;
      if (x > xMax) xMax = x;
      if (y > yMax) yMax = y;
    }
  }
  if (!Number.isFinite(xMin) || yMax - yMin < 1e-3) return { bounds: [0, 0, 0, 0], quads: [] };

  const intervalsAt = (y) => {
    const events = [];
    for (const r of rings) {
      const m = r.length;
      for (let i = 0; i < m; i++) {
        const a = r[i];
        const b = r[(i + 1) % m];
        if (a[1] <= y && b[1] > y) {
          const t = (y - a[1]) / (b[1] - a[1]);
          events.push([a[0] + (b[0] - a[0]) * t, 1]);
        } else if (b[1] <= y && a[1] > y) {
          const t = (y - a[1]) / (b[1] - a[1]);
          events.push([a[0] + (b[0] - a[0]) * t, -1]);
        }
      }
    }
    events.sort((p, q) => p[0] - q[0]);
    const spans = [];
    let winding = 0;
    let spanStart = 0;
    for (let i = 0; i < events.length; i++) {
      const prev = winding;
      winding += events[i][1];
      if (prev === 0 && winding !== 0) {
        spanStart = events[i][0];
      } else if (prev !== 0 && winding === 0) {
        if (events[i][0] - spanStart > 0.05) spans.push([spanStart, events[i][0]]);
      }
    }
    return spans;
  };

  const quads = [];
  const dy = (yMax - yMin) / strips;
  for (let s = 0; s < strips; s++) {
    const ya = yMin + s * dy;
    const yb = ya + dy;
    const eps = dy * 0.04;
    const sa = intervalsAt(ya + eps);
    const sb = intervalsAt(yb - eps);
    if (sa.length >= 1 && sa.length === sb.length) {
      for (let k = 0; k < sa.length; k++) {
        quads.push([
          [sa[k][0], ya],
          [sa[k][1], ya],
          [sb[k][1], yb],
          [sb[k][0], yb],
        ]);
      }
    } else {
      const sm = intervalsAt(0.5 * (ya + yb));
      for (let k = 0; k < sm.length; k++) {
        quads.push([
          [sm[k][0], ya],
          [sm[k][1], ya],
          [sm[k][1], yb],
          [sm[k][0], yb],
        ]);
      }
    }
  }
  return { bounds: [xMin, yMin, xMax, yMax], quads };
}

// Raster fallback for custom user characters not present in bundled motion-cjk.json.
const fallbackGlyphCache = new Map();
function getFallbackGlyph(ch) {
  if (fallbackGlyphCache.has(ch)) return fallbackGlyphCache.get(ch);
  const S = 240;
  const pad = 24;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const g = cv.getContext("2d", { willReadFrequently: true });
  g.clearRect(0, 0, S, S);
  g.fillStyle = "#fff";
  g.font = `900 ${S - pad * 2}px "Noto Sans TC", "Archivo Black", "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.fillText(ch, S * 0.5, S * 0.8);
  const img = g.getImageData(0, 0, S, S).data;
  const scale = 1000 / (S - pad * 2);
  let xMin = S, xMax = 0;
  const quads = [];
  const step = 3;
  for (let py = 0; py < S; py += step) {
    let inRun = false;
    let rStart = 0;
    for (let px = 0; px <= S; px++) {
      const on = px < S && img[(py * S + px) * 4 + 3] > 118;
      if (on && !inRun) {
        inRun = true;
        rStart = px;
      } else if (!on && inRun) {
        inRun = false;
        if (rStart < xMin) xMin = rStart;
        if (px > xMax) xMax = px;
        const fx0 = (rStart - pad) * scale;
        const fx1 = (px - pad) * scale;
        const fy0 = (S * 0.8 - (py + step)) * scale;
        const fy1 = (S * 0.8 - py) * scale;
        quads.push([
          [fx0, fy0],
          [fx1, fy0],
          [fx1, fy1],
          [fx0, fy1],
        ]);
      }
    }
  }
  if (xMax <= xMin) {
    xMin = S * 0.25;
    xMax = S * 0.75;
  }
  const shiftX = (xMin - pad) * scale - 40;
  const advance = Math.max(360, (xMax - xMin) * scale + 80);
  const path = new Path2D();
  for (const q of quads) {
    q[0][0] -= shiftX;
    q[1][0] -= shiftX;
    q[2][0] -= shiftX;
    q[3][0] -= shiftX;
    path.moveTo(q[0][0], q[0][1] - 0.35);
    path.lineTo(q[1][0] + 0.35, q[1][1] - 0.35);
    path.lineTo(q[2][0] + 0.35, q[2][1] + 0.35);
    path.lineTo(q[3][0], q[3][1] + 0.35);
    path.closePath();
  }
  const entry = { advance, exactPath2D: path, quads, bounds: [0, -140, advance, 860] };
  fallbackGlyphCache.set(ch, entry);
  return entry;
}

const parsedFontGlyphCache = new WeakMap();
function getParsedGlyph(fontData, ch) {
  let map = parsedFontGlyphCache.get(fontData);
  if (!map) {
    map = new Map();
    parsedFontGlyphCache.set(fontData, map);
  }
  if (map.has(ch)) return map.get(ch);
  const spec = fontData.glyphs[ch] || fontData.glyphs[ch.toUpperCase()];
  if (!spec) {
    const fb = getFallbackGlyph(ch);
    map.set(ch, fb);
    return fb;
  }
  const rings = parseSvgRings(spec.path, 6);
  const { bounds, quads } = decomposeRingsNonZero(rings, 46);
  const entry = {
    advance: spec.advance,
    svgPath: spec.path,
    exactPath2D: new Path2D(spec.path),
    quads,
    bounds,
  };
  map.set(ch, entry);
  return entry;
}

// Transform font-space [x, y] to mural canvas [X, Y] for a cell rotated by angle around (cx, cy).
function makeTransform(cx, cy, angle, sx, sy, localOx, localOy) {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  return {
    pt(fx, fy) {
      const lx = localOx + fx * sx;
      const ly = localOy - fy * sy;
      return [cx + lx * ca - ly * sa, cy + lx * sa + ly * ca];
    },
    matrix() {
      // Canvas DOMMatrix: translate(cx,cy) * rotate(angle) * translate(localOx, localOy) * scale(sx, -sy)
      const a = ca * sx;
      const b = sa * sx;
      const c = sa * sy;
      const d = -ca * sy;
      const e = cx + localOx * ca - localOy * sa;
      const f = cy + localOx * sa + localOy * ca;
      return new DOMMatrix([a, b, c, d, e, f]);
    },
  };
}

// Slice a single positioned glyph into K convex Voronoi polygon fragments in canvas coordinates,
// baking a 0.6px outward seam-bleed into each fragment's flightPath while keeping exactPath crack-free.
function sliceGlyphToFragments(glyphInfo, tf, shardCount, seedBase, meta) {
  const [bx0, by0, bx1, by1] = glyphInfo.bounds;
  const pad = 18;
  const bounds = [bx0 - pad, by0 - pad, bx1 + pad, by1 + pad];
  const bw = Math.max(10, bounds[2] - bounds[0]);
  const bh = Math.max(10, bounds[3] - bounds[1]);

  // Stratified jittered Voronoi sites for balanced, organic stone/stroke shards.
  const cols = Math.max(1, Math.round(Math.sqrt(shardCount * (bw / bh))));
  const rows = Math.max(1, Math.ceil(shardCount / cols));
  const sites = [];
  let sIdx = 0;
  for (let r = 0; r < rows && sites.length < shardCount; r++) {
    for (let c = 0; c < cols && sites.length < shardCount; c++) {
      const jx = 0.16 + 0.68 * hash(seedBase + sIdx * 13.7 + 1.1);
      const jy = 0.16 + 0.68 * hash(seedBase + sIdx * 29.3 + 5.7);
      sites.push([bounds[0] + ((c + jx) / cols) * bw, bounds[1] + ((r + jy) / rows) * bh]);
      sIdx++;
    }
  }
  const cells = buildVoronoiCells(bounds, sites);
  const fragments = [];

  for (let k = 0; k < cells.length; k++) {
    const cell = cells[k];
    if (cell.length < 3) continue;
    // Build half-planes of convex Voronoi cell k (CCW or CW independent via centroid test)
    let scx = 0, scy = 0;
    for (const p of cell) {
      scx += p[0];
      scy += p[1];
    }
    scx /= cell.length;
    scy /= cell.length;

    const planes = [];
    for (let e = 0; e < cell.length; e++) {
      const a = cell[e];
      const b = cell[(e + 1) % cell.length];
      let nx = b[1] - a[1];
      let ny = -(b[0] - a[0]);
      const nl = Math.hypot(nx, ny);
      if (nl < 1e-5) continue;
      nx /= nl;
      ny /= nl;
      if ((scx - a[0]) * nx + (scy - a[1]) * ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      planes.push([a[0], a[1], nx, ny]);
    }

    const worldPolys = [];
    let wxSum = 0;
    let wySum = 0;
    let wCount = 0;

    for (let qi = 0; qi < glyphInfo.quads.length; qi++) {
      let poly = glyphInfo.quads[qi];
      for (let pi = 0; pi < planes.length; pi++) {
        const pl = planes[pi];
        poly = clipHalfPlane(poly, pl[0], pl[1], pl[2], pl[3]);
        if (poly.length < 3) break;
      }
      if (poly.length >= 3) {
        const wp = poly.map(([fx, fy]) => tf.pt(fx, fy));
        worldPolys.push(wp);
        for (const p of wp) {
          wxSum += p[0];
          wySum += p[1];
          wCount++;
        }
      }
    }
    if (!wCount) continue;

    const homeX = wxSum / wCount;
    const homeY = wySum / wCount;
    const flightPath = new Path2D();
    const bleed = 0.65; // 0.6px+ outward seam bleed during ballistic assembly

    for (const wp of worldPolys) {
      let pcx = 0, pcy = 0;
      for (const p of wp) {
        pcx += p[0];
        pcy += p[1];
      }
      pcx /= wp.length;
      pcy /= wp.length;

      for (let vi = 0; vi < wp.length; vi++) {
        const vx = wp[vi][0] - homeX;
        const vy = wp[vi][1] - homeY;
        const dx = wp[vi][0] - pcx;
        const dy = wp[vi][1] - pcy;
        const dl = Math.hypot(dx, dy) || 1;
        const ex = vx + (dx / dl) * bleed;
        const ey = vy + (dy / dl) * bleed;
        if (vi === 0) flightPath.moveTo(ex, ey);
        else flightPath.lineTo(ex, ey);
      }
      flightPath.closePath();
    }

    fragments.push(makeFragmentFlight(homeX, homeY, flightPath, seedBase + k * 19.37, meta));
  }
  return fragments;
}

function makeFragmentFlight(homeX, homeY, flightPath, seed, meta) {
  const dirAngle = Math.atan2(homeY - meta.originY, homeX - meta.originX) + (hash(seed + 1.3) - 0.5) * 0.95;
  const dist = 760 + 980 * hash(seed + 2.7);
  const startX = homeX + Math.cos(dirAngle) * dist;
  const startY = homeY + Math.sin(dirAngle) * dist;
  // Curved ballistic arc control point perpendicular to radial path
  const perp = dirAngle + (hash(seed + 4.1) > 0.5 ? 1 : -1) * (Math.PI * 0.5);
  const arcMag = (180 + 380 * hash(seed + 5.9)) * (hash(seed + 7.3) > 0.5 ? 1 : -1);
  const ctrlX = 0.5 * (startX + homeX) + Math.cos(perp) * arcMag;
  const ctrlY = 0.5 * (startY + homeY) + Math.sin(perp) * arcMag;
  const spin = (hash(seed + 8.9) - 0.5) * Math.PI * 2.8;
  const delay = clamp(meta.baseDelay + hash(seed + 11.4) * meta.staggerSpan, 0, 1.45);
  const dur = 0.62 + 0.34 * hash(seed + 13.8);
  const outDelay = clamp(meta.outBase + hash(seed + 17.2) * 0.48, 0, 1.6);
  const outDur = 0.52 + 0.28 * hash(seed + 19.6);
  return {
    homeX,
    homeY,
    startX,
    startY,
    ctrlX,
    ctrlY,
    spin,
    delay,
    dur,
    outDelay,
    outDur,
    flightPath,
    accent: !!meta.accent,
    showTick: hash(seed + 23.1) > 0.36,
    tickLen: 20 + 48 * hash(seed + 29.4),
  };
}

// Create a solid rhythm disc cell ("●") sliced into pie shards for flight + exact arc when welded.
function buildDotItem(cx, cy, r, shards, seedBase, meta) {
  const exactPath = new Path2D();
  exactPath.arc(cx, cy, r, 0, TAU);
  const fragments = [];
  for (let k = 0; k < shards; k++) {
    const a0 = (k / shards) * TAU;
    const a1 = ((k + 1) / shards) * TAU;
    const mid = 0.5 * (a0 + a1);
    const hx = cx + Math.cos(mid) * r * 0.48;
    const hy = cy + Math.sin(mid) * r * 0.48;
    const fp = new Path2D();
    const bleedA = 0.028;
    const rr = r + 0.65;
    fp.moveTo(cx - hx, cy - hy);
    fp.arc(cx - hx, cy - hy, rr, a0 - bleedA, a1 + bleedA);
    fp.closePath();
    fragments.push(makeFragmentFlight(hx, hy, fp, seedBase + k * 11.7, meta));
  }
  return { exactPath, fragments, accent: !!meta.accent, endTime: Math.max(...fragments.map((f) => f.delay + f.dur)), outStart: Math.min(...fragments.map((f) => f.outDelay)) };
}

// Position a text block inside box [x, y, w, h] at rotation deg (0, 90, -90, 180) and slice into shards.
function buildTextCell(fontData, textStr, box, deg, shardsPerGlyph, seedBase, meta) {
  const chars = [...textStr].filter((c) => c.trim().length > 0 || c === " ");
  if (!chars.length) return [];
  const rad = (deg * Math.PI) / 180;
  const swapped = Math.abs(deg) === 90;
  const availW = swapped ? box.h : box.w;
  const availH = swapped ? box.w : box.h;
  const tracking = box.tracking ?? -18;

  const glyphs = chars.map((ch) => (ch === " " ? { ch, space: true, advance: 270 } : { ch, space: false, info: getParsedGlyph(fontData, ch) }));
  let totalAdv = 0;
  for (let i = 0; i < glyphs.length; i++) {
    totalAdv += glyphs[i].space ? glyphs[i].advance : glyphs[i].info.advance;
    if (i + 1 < glyphs.length) totalAdv += tracking;
  }
  totalAdv = Math.max(200, totalAdv);

  const capH = 770;
  const sx = (availW / totalAdv) * (box.fillX ?? 0.98);
  const sy = (availH / capH) * (box.fillY ?? 0.94);

  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.5;
  const startLocalX = -0.5 * totalAdv * sx;
  const baselineLocalY = 0.5 * capH * sy + (box.baselineShift ?? 0);

  const items = [];
  let cursor = 0;
  for (let gi = 0; gi < glyphs.length; gi++) {
    const g = glyphs[gi];
    const adv = g.space ? g.advance : g.info.advance;
    if (!g.space) {
      const tf = makeTransform(cx, cy, rad, sx, sy, startLocalX + cursor * sx, baselineLocalY);
      const exactPath = new Path2D();
      exactPath.addPath(g.info.exactPath2D, tf.matrix());
      const charProgress = glyphs.length > 1 ? gi / (glyphs.length - 1) : 0.5;
      const gMeta = {
        ...meta,
        baseDelay: meta.baseDelay + charProgress * (meta.wordSpread ?? 0.18),
        outBase: meta.outBase + (1 - charProgress) * 0.14,
      };
      const fragments = sliceGlyphToFragments(g.info, tf, shardsPerGlyph, seedBase + gi * 97.3, gMeta);
      if (fragments.length) {
        items.push({
          exactPath,
          fragments,
          accent: !!meta.accent,
          endTime: Math.max(...fragments.map((f) => f.delay + f.dur)),
          outStart: Math.min(...fragments.map((f) => f.outDelay)),
        });
      }
    }
    cursor += adv + tracking;
  }
  return items;
}

// Build deterministic Risograph stipple-grain highlight tile via seeded hash.
let risoTile = null;
function getRisoStippleTile() {
  if (risoTile) return risoTile;
  const TW = 384;
  const TH = 384;
  const dark = document.createElement("canvas");
  dark.width = TW;
  dark.height = TH;
  const light = document.createElement("canvas");
  light.width = TW;
  light.height = TH;
  const gd = dark.getContext("2d");
  const gl = light.getContext("2d");

  // 2,600 deterministic organic mezzo/Risograph stipple grains
  for (let i = 0; i < 2600; i++) {
    const x = hash(i * 3.17 + 0.4) * TW;
    const y = hash(i * 7.91 + 1.9) * TH;
    const r = 0.65 + 1.45 * Math.pow(hash(i * 13.3 + 4.2), 1.8);
    const a = 0.22 + 0.58 * hash(i * 19.7 + 8.5);
    gd.fillStyle = `rgba(245,243,238,${a.toFixed(3)})`;
    gl.fillStyle = `rgba(13,13,15,${a.toFixed(3)})`;
    for (const ox of [-TW, 0, TW]) {
      for (const oy of [-TH, 0, TH]) {
        if (x + ox + r < 0 || x + ox - r > TW || y + oy + r < 0 || y + oy - r > TH) continue;
        gd.beginPath();
        gd.arc(x + ox, y + oy, r, 0, TAU);
        gd.fill();
        gl.beginPath();
        gl.arc(x + ox, y + oy, r, 0, TAU);
        gl.fill();
      }
    }
  }
  risoTile = { dark, light, TW, TH };
  return risoTile;
}

// Parse centerpiece hero text into [line1, line2] for the asymmetric Bento mural.
function parseHeroLines(rawText, fallback1 = "EVERY FRAME", fallback2 = "IS CODE") {
  const cleaned = String(rawText || "").trim();
  if (!cleaned) return [fallback1, fallback2];
  if (cleaned.includes("|")) {
    const [a, b] = cleaned.split("|").map((s) => s.trim());
    return [a || fallback1, b || fallback2];
  }
  if (cleaned.includes("\n")) {
    const [a, b] = cleaned.split("\n").map((s) => s.trim());
    return [a || fallback1, b || fallback2];
  }
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  }
  const single = words[0];
  return [single, single.length <= 4 ? "60FPS · CODE" : "MOTION"];
}

// Assemble full-bleed asymmetric 0°/+90°/-90°/180° Swiss/Bento mural layout (>= 1,024 fragments).
function compileMuralScene(fontData, heroInput, variant = 0) {
  const [heroTop, heroBot] = parseHeroLines(
    heroInput,
    variant === 1 ? "1024 STROKES" : variant === 2 ? "ZERO CRACKS" : "EVERY FRAME",
    variant === 1 ? "MOTION" : variant === 2 ? "60 FPS." : "IS CODE"
  );
  const originX = variant === 1 ? 470 : variant === 2 ? 1488 : 960;
  const originY = variant === 1 ? 684 : variant === 2 ? 706 : 540;

  const cells = [
    // Top full-bleed cropped architectural marquee (0°)
    { type: "text", text: variant === 1 ? "EVERYFRAMEISCODE" : "MOTIONGRAPHICS", box: { x: -34, y: -56, w: 1988, h: 194, tracking: -26, fillX: 1.0, fillY: 1.04 }, deg: 0, shards: 16, baseDelay: 0.02, staggerSpan: 0.26, outBase: 0.42 },

    // Left Bento vertical CJK & -90° Latin stack
    { type: "text", text: "動態", box: { x: -18, y: 152, w: 132, h: 356, tracking: -10, fillX: 0.96, fillY: 0.96 }, deg: -90, shards: 20, baseDelay: 0.08, staggerSpan: 0.28, outBase: 0.34 },
    { type: "text", text: "光影", box: { x: 122, y: 152, w: 112, h: 256, tracking: -12, fillX: 0.95, fillY: 0.95 }, deg: 90, shards: 18, baseDelay: 0.12, staggerSpan: 0.25, outBase: 0.32 },
    { type: "text", text: "60FPS", box: { x: 242, y: 152, w: 72, h: 256, tracking: -18, fillX: 0.96, fillY: 0.92 }, deg: -90, shards: 12, baseDelay: 0.16, staggerSpan: 0.22, outBase: 0.30 },
    { type: "text", text: "設計", box: { x: -16, y: 522, w: 238, h: 382, tracking: -22, fillX: 0.98, fillY: 0.96 }, deg: 90, shards: 22, baseDelay: 0.14, staggerSpan: 0.28, outBase: 0.30 },

    // Upper-center Swiss sub-header (0° + 180° counterpoint)
    { type: "text", text: variant === 1 ? "SWISS BENTO · CJK" : "FORM · 1000+ SHARDS", box: { x: 326, y: 152, w: 690, h: 116, tracking: -18, fillX: 0.98, fillY: 0.92 }, deg: 0, shards: 12, baseDelay: 0.18, staggerSpan: 0.26, outBase: 0.24 },
    { type: "text", text: "MOTION.60", box: { x: 1030, y: 152, w: 386, h: 116, tracking: -18, fillX: 0.97, fillY: 0.92 }, deg: 180, shards: 12, baseDelay: 0.2, staggerSpan: 0.24, outBase: 0.26, accent: true },

    // HERO CENTERPIECE LOCKUP (0° — driven by options.text / FX_CUSTOM_TEXT)
    { type: "text", text: heroTop, box: { x: 326, y: 282, w: 1092, h: 258, tracking: -24, fillX: 0.985, fillY: 0.98 }, deg: 0, shards: 28, baseDelay: 0.36, staggerSpan: 0.34, wordSpread: 0.22, outBase: 0.04 },
    { type: "text", text: heroBot, box: { x: 326, y: 550, w: 1092, h: 254, tracking: -24, fillX: 0.985, fillY: 0.98 }, deg: 0, shards: 28, baseDelay: 0.46, staggerSpan: 0.34, wordSpread: 0.22, outBase: 0.0, accent: variant === 2 },

    // Right Bento monumental CJK & +90°/-90° interlocking columns
    { type: "text", text: "形勢".replace("勢", "計"), box: { x: 1434, y: 152, w: 504, h: 318, tracking: -28, fillX: 0.99, fillY: 0.98 }, deg: 0, shards: 24, baseDelay: 0.15, staggerSpan: 0.28, outBase: 0.28 },
    { type: "text", text: "MOTION", box: { x: 1434, y: 484, w: 356, h: 128, tracking: -20, fillX: 0.98, fillY: 0.95 }, deg: 0, shards: 14, baseDelay: 0.22, staggerSpan: 0.24, outBase: 0.22 },
    { type: "text", text: "水流", box: { x: 1802, y: 484, w: 134, h: 420, tracking: -16, fillX: 0.96, fillY: 0.96 }, deg: 90, shards: 18, baseDelay: 0.19, staggerSpan: 0.26, outBase: 0.32 },
    { type: "text", text: "FORM", box: { x: 1434, y: 626, w: 168, h: 278, tracking: -20, fillX: 0.96, fillY: 0.94 }, deg: -90, shards: 15, baseDelay: 0.25, staggerSpan: 0.24, outBase: 0.20, accent: variant === 1 },
    { type: "text", text: "世界", box: { x: 1614, y: 626, w: 176, h: 278, tracking: -18, fillX: 0.96, fillY: 0.95 }, deg: 180, shards: 20, baseDelay: 0.24, staggerSpan: 0.25, outBase: 0.24 },

    // Lower inverted 180° + 0° full-bleed anchor strip
    { type: "text", text: "EVERY", box: { x: 326, y: 818, w: 410, h: 122, tracking: -20, fillX: 0.98, fillY: 0.94 }, deg: 180, shards: 14, baseDelay: 0.22, staggerSpan: 0.24, outBase: 0.26 },
    { type: "text", text: "文字光影", box: { x: 752, y: 818, w: 560, h: 122, tracking: -14, fillX: 0.98, fillY: 0.94 }, deg: 0, shards: 16, baseDelay: 0.24, staggerSpan: 0.26, outBase: 0.24 },
    { type: "text", text: variant === 2 ? "60FPS · LOOP" : "CODE · 1024+", box: { x: -26, y: 952, w: 1972, h: 184, tracking: -24, fillX: 1.0, fillY: 1.02 }, deg: 0, shards: 16, baseDelay: 0.05, staggerSpan: 0.28, outBase: 0.40 },
  ];

  // Graphic Swiss rhythm dots ("●") tucked into Bento joints
  const dots = [
    [276, 456, 32, true],
    [276, 530, 32, false],
    [276, 604, 32, false],
    [276, 868, 40, true],
    [1366, 876, 36, true],
    [1488, 108, 36, true],
    [68, 922, 26, false],
    [132, 922, 26, false],
    [196, 922, 26, true],
  ];

  const items = [];
  let seed = 100 + variant * 911;
  for (const c of cells) {
    const built = buildTextCell(fontData, c.text, c.box, c.deg, c.shards, seed, {
      originX,
      originY,
      baseDelay: c.baseDelay,
      staggerSpan: c.staggerSpan,
      wordSpread: c.wordSpread ?? 0.16,
      outBase: c.outBase,
      accent: c.accent,
    });
    items.push(...built);
    seed += 1337;
  }
  for (let di = 0; di < dots.length; di++) {
    const [dx, dy, dr, acc] = dots[di];
    items.push(
      buildDotItem(dx, dy, dr, 8, seed + di * 71, {
        originX,
        originY,
        baseDelay: 0.14 + di * 0.03,
        staggerSpan: 0.18,
        outBase: 0.22 + di * 0.02,
        accent: acc,
      })
    );
  }

  let fragmentCount = 0;
  for (const it of items) fragmentCount += it.fragments.length;

  return { items, fragmentCount, originX, originY, heroTop, heroBot };
}

// Render the compiled mural at normalized assembly/fracture timeline onto target 2D context g (in 1920x1080 coords).
export function drawMuralFrame(g, scene, localTime, options = {}) {
  const period = options.period ?? 7.2;
  const dark = !!options.dark;
  const bg = options.bg ?? (dark ? PALETTE.obsidian : PALETTE.cream);
  const ink = options.ink ?? (dark ? PALETTE.cream : PALETTE.obsidian);
  const accent = options.accent ?? PALETTE.vermilion;
  const ruleCol = dark ? PALETTE.obsidianRule : PALETTE.creamRule;

  // Seamless periodic time in [0, period)
  const raw = ((localTime % period) + period) % period;
  const assemblePhase = options.assembleOnly ? localTime : raw;
  const isFracturing = !options.noExit && raw > 5.18;
  const exitClock = raw - 5.18; // 0 .. 2.02s

  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Subtle Swiss architectural Bento hairlines (fade cleanly at loop endpoints for exact Frame-0 match)
  const gridAlpha = options.noExit
    ? smooth(assemblePhase / 0.45)
    : smooth(raw / 0.4) * (1 - smooth((raw - 6.72) / 0.42));

  if (gridAlpha > 0.002) {
    g.save();
    g.globalAlpha = gridAlpha;
    g.strokeStyle = ruleCol;
    g.lineWidth = 1.2;
    g.beginPath();
    for (const y of [144, 274, 810, 944]) {
      g.moveTo(0, y);
      g.lineTo(W, y);
    }
    for (const x of [318, 1426]) {
      g.moveTo(x, 144);
      g.lineTo(x, 944);
    }
    g.stroke();
    g.restore();
  }

  // Seed registration reticle at (originX, originY): exact at t=0 and t=period, tucked away during welded hold
  const seedDotR = options.seedRadius ?? 11;
  if (seedDotR > 0) {
    const seedVis = options.noExit
      ? 1 - smooth((assemblePhase - 0.85) / 0.55)
      : (1 - smooth((raw - 0.95) / 0.55)) + smooth((raw - 5.65) / 0.65);
    const rEff = seedDotR * clamp(seedVis, 0, 1);
    if (rEff > 0.25) {
      g.fillStyle = accent;
      g.beginPath();
      g.arc(scene.originX, scene.originY, rEff, 0, TAU);
      g.fill();
    }
  }

  const weldedInkPath = new Path2D();
  const weldedAccentPath = new Path2D();
  const risoClipPath = new Path2D();
  let landedCount = 0;

  // Velocity leader lines batched into single crisp 1px stroke paths
  const leaderInk = new Path2D();
  const leaderAccent = new Path2D();

  for (let ii = 0; ii < scene.items.length; ii++) {
    const item = scene.items[ii];
    const colPath = item.accent ? weldedAccentPath : weldedInkPath;

    const allLanded = !isFracturing && assemblePhase >= item.endTime;
    const noneExitedYet = isFracturing && exitClock <= item.outStart;

    if (allLanded || noneExitedYet) {
      // Exact unsplit vector Path2D: 100% zero internal hairline cracks!
      colPath.addPath(item.exactPath);
      risoClipPath.addPath(item.exactPath);
      landedCount += item.fragments.length;
      continue;
    }

    // Fragment-level ballistic flight (u < 1)
    const frags = item.fragments;
    for (let fi = 0; fi < frags.length; fi++) {
      const f = frags[fi];
      let u = 0;
      let exiting = false;

      if (!isFracturing) {
        if (assemblePhase <= f.delay) continue;
        u = clamp((assemblePhase - f.delay) / f.dur);
      } else {
        exiting = true;
        if (exitClock >= f.outDelay + f.outDur) continue;
        const v = clamp((exitClock - f.outDelay) / f.outDur);
        u = 1 - inCubic(v);
      }

      if (u >= 0.9999) {
        landedCount++;
        g.save();
        g.translate(f.homeX, f.homeY);
        g.fillStyle = f.accent ? accent : ink;
        g.fill(f.flightPath);
        g.restore();
        continue;
      }

      const ease = exiting ? u : outQuint(u);
      const inv = 1 - ease;
      // Quadratic ballistic Bezier arc
      const px = inv * inv * f.startX + 2 * inv * ease * f.ctrlX + ease * ease * f.homeX;
      const py = inv * inv * f.startY + 2 * inv * ease * f.ctrlY + ease * ease * f.homeY;
      // Analytic tangent velocity for crisp 1px leader lines & ticks
      const vx = 2 * inv * (f.ctrlX - f.startX) + 2 * ease * (f.homeX - f.ctrlX);
      const vy = 2 * inv * (f.ctrlY - f.startY) + 2 * ease * (f.homeY - f.ctrlY);
      const vLen = Math.hypot(vx, vy) || 1;
      const nx = vx / vLen;
      const ny = vy / vLen;

      const rot = f.spin * inv * inv;
      const scale = 0.68 + 0.32 * smooth(u * 1.35);

      g.save();
      g.translate(px, py);
      g.rotate(rot);
      g.scale(scale, scale);
      g.fillStyle = f.accent ? accent : ink;
      g.fill(f.flightPath);
      g.restore();

      if (f.showTick && inv > 0.035 && ease > 0.04) {
        const tail = f.tickLen * Math.min(1, inv * 2.4);
        const tx = px - nx * tail;
        const ty = py - ny * tail;
        const lp = f.accent ? leaderAccent : leaderInk;
        lp.moveTo(px, py);
        lp.lineTo(tx, ty);
        // Perpendicular 1px caliper tick at tail end
        lp.moveTo(tx - ny * 3.8, ty + nx * 3.8);
        lp.lineTo(tx + ny * 3.8, ty - nx * 3.8);
      }
    }
  }

  // Fill all welded glyphs in two batched non-zero-winding vector calls (zero cracks, zero stroke-overlap XOR cutouts)
  g.fillStyle = ink;
  g.fill(weldedInkPath);
  g.fillStyle = accent;
  g.fill(weldedAccentPath);

  // Stroke crisp 1px ballistic velocity leader lines & caliper ticks
  g.save();
  g.lineWidth = 1.25;
  g.globalAlpha = 0.82;
  g.strokeStyle = ink;
  g.stroke(leaderInk);
  g.globalAlpha = 0.94;
  g.strokeStyle = accent;
  g.stroke(leaderAccent);
  g.restore();

  // Travelling Risograph stipple-grain highlight band strictly clipped inside welded glyph interiors!
  const risoWindow = options.risoProgress ?? clamp((raw - 1.85) / 3.15);
  const risoStrength = Math.sin(clamp(risoWindow) * Math.PI);
  if (risoStrength > 0.01 && landedCount > 60) {
    const tile = getRisoStippleTile();
    const bandX = lerp(-420, W + 420, risoWindow);
    const bandHalfW = 360;

    g.save();
    g.clip(risoClipPath);
    g.translate(bandX, H * 0.5);
    g.rotate(-0.42);

    // Mask stipple tile smoothly across the travelling highlight band
    const pat = g.createPattern(dark ? tile.light : tile.dark, "repeat");
    g.globalAlpha = 0.78 * risoStrength;
    g.fillStyle = pat;
    g.fillRect(-bandHalfW * 0.75, -H, bandHalfW * 1.5, H * 2);

    // Subtle secondary narrower core shimmer
    g.globalAlpha = 0.34 * risoStrength;
    g.fillRect(-bandHalfW * 0.28, -H, bandHalfW * 0.56, H * 2);
    g.restore();
  }

  return { fragmentCount: scene.fragmentCount, landedCount, heroTop: scene.heroTop, heroBot: scene.heroBot };
}

// Create standalone/gallery "graphic-stroke-mural" engine instance.
export async function createStrokeMural(options = {}) {
  const width = options.width || 1280;
  const height = options.height || 720;
  const canvas = options.canvas || document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  const fontData = await loadOutlines();

  const sceneCache = new Map();
  const getScene = (textKey, variant = 0) => {
    const key = `${variant}::${textKey}`;
    if (!sceneCache.has(key)) {
      if (sceneCache.size > 12) sceneCache.clear();
      sceneCache.set(key, compileMuralScene(fontData, textKey, variant));
    }
    return sceneCache.get(key);
  };

  let lastProof = { fragmentCount: 0, landedCount: 0, text: "" };

  function frame(t, frameOpts = {}) {
    if (!Number.isFinite(t)) throw new Error("frame(t) requires finite time");
    const custom =
      frameOpts.text ??
      options.text ??
      (typeof window !== "undefined" && window.FX_CUSTOM_TEXT ? String(window.FX_CUSTOM_TEXT) : "");
    const variant = frameOpts.variant ?? options.variant ?? 0;
    const scene = getScene(custom, variant);

    g.save();
    g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    const stats = drawMuralFrame(g, scene, Math.max(0, t), {
      period: frameOpts.period ?? options.period ?? 7.2,
      dark: frameOpts.dark ?? options.dark ?? false,
      noExit: frameOpts.noExit ?? false,
      assembleOnly: frameOpts.assembleOnly ?? false,
      risoProgress: frameOpts.risoProgress,
      seedRadius: frameOpts.seedRadius ?? 11,
    });
    g.restore();

    lastProof = { ...stats, text: custom || `${scene.heroTop} / ${scene.heroBot}` };
    return lastProof;
  }

  function resize(w, h) {
    canvas.width = w;
    canvas.height = h;
  }

  function destroy() {
    sceneCache.clear();
  }

  return { canvas, frame, resize, destroy, proof: () => lastProof };
}

// Render one world (obsidian or warm cream) of the Swiss kinetic poster for "wipe-dot-polarity".
function drawPolarityWorld(g, fontData, inverted, tNorm, customText, dotOrigin) {
  const bg = inverted ? PALETTE.cream : PALETTE.obsidian;
  const fg = inverted ? PALETTE.obsidian : PALETTE.cream;
  const subCol = inverted ? "rgba(13,13,15,0.58)" : "rgba(245,243,238,0.58)";
  const ruleCol = inverted ? "rgba(13,13,15,0.18)" : "rgba(245,243,238,0.18)";

  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Precision Swiss architectural grid & Vernier edge ticks
  g.strokeStyle = ruleCol;
  g.lineWidth = 1.25;
  g.beginPath();
  g.moveTo(84, 108);
  g.lineTo(W - 84, 108);
  g.moveTo(84, H - 108);
  g.lineTo(W - 84, H - 108);
  g.moveTo(1260, 108);
  g.lineTo(1260, H - 108);
  for (let x = 120; x <= W - 120; x += 60) {
    const h = x % 300 === 0 ? 14 : 7;
    g.moveTo(x, 108);
    g.lineTo(x, 108 + h);
    g.moveTo(x, H - 108);
    g.lineTo(x, H - 108 - h);
  }
  g.stroke();

  // Header & footer Swiss telemetry
  g.fillStyle = fg;
  g.font = '700 20px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.fillText(inverted ? "POLARITY B  ·  WARM SWISS CREAM (#F5F3EE)" : "POLARITY A  ·  OBSIDIAN STAGE (#0D0D0F)", 84, 84);
  g.textAlign = "right";
  g.fillText(`ORIGIN (${Math.round(dotOrigin.x)}, ${Math.round(dotOrigin.y)})  ·  EVEN-ODD IRIS`, W - 84, 84);

  g.textAlign = "left";
  g.fillStyle = subCol;
  g.fillText("OFF-CENTER EXPONENTIAL DOT WIPE  ·  FRAME-0 PERIOD RETURN", 84, H - 64);
  g.textAlign = "right";
  g.fillStyle = PALETTE.vermilion;
  g.fillText(inverted ? "● INVERTED STATE" : "○ BASELINE STATE", W - 84, H - 64);

  // Subtle periodic kinetic breathing that vanishes identically at tNorm = 0 and tNorm = 1
  const breathe = Math.sin(tNorm * TAU) * 8 * Math.sin(tNorm * Math.PI);

  // Giant left headline rendered from exact bundled vector outlines
  const rawHeadline = (customText || "").trim().toUpperCase();
  const topWord = rawHeadline ? rawHeadline.replace(/\.+$/, "") : "POLARITY";
  const botWord = inverted ? "INVERTED" : "CONTRAST";

  const drawVectorLine = (wordStr, xLeft, yBase, maxW, maxH, color) => {
    const chars = [...wordStr];
    const glyphs = chars.map((c) => (c === " " ? { space: true, advance: 260 } : { space: false, info: getParsedGlyph(fontData, c) }));
    const track = -20;
    let advSum = 0;
    glyphs.forEach((gl, idx) => {
      advSum += gl.space ? gl.advance : gl.info.advance;
      if (idx + 1 < glyphs.length) advSum += track;
    });
    const scale = Math.min(maxW / Math.max(200, advSum), maxH / 760);
    const p = new Path2D();
    let cur = xLeft;
    for (const gl of glyphs) {
      const adv = gl.space ? gl.advance : gl.info.advance;
      if (!gl.space) {
        p.addPath(gl.info.exactPath2D, new DOMMatrix([scale, 0, 0, -scale, cur, yBase]));
      }
      cur += (adv + track) * scale;
    }
    g.fillStyle = color;
    g.fill(p);
    return cur;
  };

  drawVectorLine(topWord, 84, 442 + breathe * 0.5, 1110, 232, fg);
  const endX = drawVectorLine(botWord, 84, 718 - breathe * 0.5, 1020, 232, fg);

  // Right Bento CJK monument column ("光影" / "動態")
  const cjkPair = inverted ? ["動", "態"] : ["光", "影"];
  for (let i = 0; i < 2; i++) {
    const info = getParsedGlyph(fontData, cjkPair[i]);
    const s = 0.305;
    const p = new Path2D();
    p.addPath(info.exactPath2D, new DOMMatrix([s, 0, 0, -s, 1330, 456 + i * 338]));
    g.fillStyle = i === 0 && inverted ? PALETTE.vermilion : fg;
    g.fill(p);
  }

  // Rotated -90° Swiss index label along vertical divider
  g.save();
  g.translate(1234, 540);
  g.rotate(-Math.PI * 0.5);
  g.fillStyle = PALETTE.vermilion;
  g.font = '800 22px "Helvetica Neue", Arial, sans-serif';
  g.textAlign = "center";
  g.fillText(inverted ? "EVEN-ODD MASK · CREAM" : "EVEN-ODD MASK · OBSIDIAN", 0, 0);
  g.restore();

  // Crosshair callout around the punctuation period anchor (dotOrigin)
  g.strokeStyle = ruleCol;
  g.lineWidth = 1.1;
  g.beginPath();
  g.arc(dotOrigin.x, dotOrigin.y, dotOrigin.r0 * 2.15, 0, TAU);
  g.stroke();

  return endX;
}

// Compute even-odd concentric dot-iris radii for "wipe-dot-polarity" (period = 4.8s, hero = 1.9s).
// At t = 0 and t = 4.8, R_outer === r0 (the exact punctuation period "." of the headline!).
export function computePolarityIris(localTime, period = 4.8, r0 = 28, rMax = 2160) {
  const t = ((localTime % period) + period) % period;

  let rMain = r0;
  let rEchoOuter = 0;
  let rEchoInner = 0;

  if (t < 0.42) {
    // Subtle anticipation compression on the punctuation period "." before exponential burst
    const u = t / 0.42;
    rMain = r0 * (1 - 0.18 * Math.sin(u * Math.PI));
  } else if (t < 2.48) {
    // Off-center exponential expansion tuned so t = 1.90s slices dramatically across the giant typography (~1090px)
    const u = clamp((t - 0.42) / 2.06);
    const shaped = 0.58 * Math.pow(u, 2.25) + 0.42 * inOutExpo(u);
    rMain = lerp(r0, rMax, clamp(shaped));
    // Trailing even-odd polarity echo band active across mid-wipe (including hero = 1.9s), fusing cleanly before 2.48s
    const ringEnv = Math.sin(clamp((u - 0.18) / 0.76) * Math.PI);
    if (ringEnv > 0.01) {
      const gap = 82 * ringEnv;
      const band = 56 * ringEnv;
      rEchoOuter = Math.max(r0, rMain - gap);
      rEchoInner = Math.max(r0, rEchoOuter - band);
    }
  } else if (t < 3.44) {
    // Full warm-cream inverted hold
    rMain = rMax;
  } else {
    // Exponential collapse straight back into the exact punctuation period "." (r0) at (x0, y0)
    const u = clamp((t - 3.44) / (period - 3.44));
    const collapse = 1 - outExpo(u);
    // Damped terminal settle onto r0 with zero seam error at u = 1
    const settle = Math.sin(u * Math.PI) * Math.sin(u * TAU * 2) * (1 - u) * 6;
    rMain = Math.max(r0 * 0.85, lerp(r0, rMax, collapse) + settle);
    if (u > 0.995) rMain = r0;
  }

  return { rMain, rEchoOuter, rEchoInner, tNorm: t / period };
}

// Create standalone/gallery "wipe-dot-polarity" engine instance.
export async function createDotPolarity(options = {}) {
  const width = options.width || 1280;
  const height = options.height || 720;
  const canvas = options.canvas || document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");

  const worldB = document.createElement("canvas");
  worldB.width = W;
  worldB.height = H;
  const gb = worldB.getContext("2d");

  const fontData = await loadOutlines();
  const dotOrigin = {
    x: options.originX ?? 1168,
    y: options.originY ?? 690,
    r0: options.periodRadius ?? 28,
  };
  const rMax = Math.hypot(Math.max(dotOrigin.x, W - dotOrigin.x), Math.max(dotOrigin.y, H - dotOrigin.y)) + 48;

  let lastProof = { irisRadius: dotOrigin.r0, polarity: "obsidian" };

  function frame(t, frameOpts = {}) {
    if (!Number.isFinite(t)) throw new Error("frame(t) requires finite time");
    const period = frameOpts.period ?? options.period ?? 4.8;
    const custom =
      frameOpts.text ??
      options.text ??
      (typeof window !== "undefined" && window.FX_CUSTOM_TEXT ? String(window.FX_CUSTOM_TEXT) : "");

    const { rMain, rEchoOuter, rEchoInner, tNorm } = computePolarityIris(Math.max(0, t), period, dotOrigin.r0, rMax);

    g.save();
    g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);

    // 1. Draw baseline Obsidian World A directly
    drawPolarityWorld(g, fontData, false, tNorm, custom, dotOrigin);

    // 2. Render inverted Warm Cream World B offscreen
    drawPolarityWorld(gb, fontData, true, tNorm, custom, dotOrigin);

    // 3. Build off-center even-odd circular iris mask path
    const maskPath = new Path2D();
    maskPath.arc(dotOrigin.x, dotOrigin.y, rMain, 0, TAU);
    if (rEchoOuter > rEchoInner + 1.5) {
      maskPath.moveTo(dotOrigin.x + rEchoOuter, dotOrigin.y);
      maskPath.arc(dotOrigin.x, dotOrigin.y, rEchoOuter, 0, TAU);
      maskPath.moveTo(dotOrigin.x + rEchoInner, dotOrigin.y);
      maskPath.arc(dotOrigin.x, dotOrigin.y, rEchoInner, 0, TAU);
    }

    // 4. Composite World B through the even-odd mask so type flips razor-sharp across every arc!
    g.save();
    g.clip(maskPath, "evenodd");
    g.drawImage(worldB, 0, 0, W, H);
    g.restore();

    // 5. Vermilion punctuation period "." & crisp optical rim along active iris wavefront
    const atRestPeriod = clamp(1 - (rMain - dotOrigin.r0) / 90);
    if (atRestPeriod > 0.01) {
      g.save();
      g.globalAlpha = atRestPeriod;
      g.fillStyle = PALETTE.vermilion;
      g.beginPath();
      g.arc(dotOrigin.x, dotOrigin.y, dotOrigin.r0, 0, TAU);
      g.fill();
      g.restore();
    }

    if (rMain > dotOrigin.r0 + 2 && rMain < rMax - 4) {
      g.save();
      g.strokeStyle = PALETTE.vermilion;
      g.lineWidth = 3.2;
      g.beginPath();
      g.arc(dotOrigin.x, dotOrigin.y, rMain, 0, TAU);
      if (rEchoOuter > rEchoInner + 1.5) {
        g.moveTo(dotOrigin.x + rEchoOuter, dotOrigin.y);
        g.arc(dotOrigin.x, dotOrigin.y, rEchoOuter, 0, TAU);
        g.moveTo(dotOrigin.x + rEchoInner, dotOrigin.y);
        g.arc(dotOrigin.x, dotOrigin.y, rEchoInner, 0, TAU);
      }
      g.stroke();
      g.restore();
    }

    g.restore();

    lastProof = {
      irisRadius: +rMain.toFixed(2),
      polarity: rMain > rMax * 0.5 ? "cream" : "obsidian",
      origin: [dotOrigin.x, dotOrigin.y],
    };
    return lastProof;
  }

  function resize(w, h) {
    canvas.width = w;
    canvas.height = h;
  }

  return { canvas, frame, resize, destroy() {}, proof: () => lastProof, dotOrigin, rMax };
}

export function create(id, options = {}) {
  if (id === "graphic-stroke-mural") return createStrokeMural(options);
  if (id === "wipe-dot-polarity") return createDotPolarity(options);
  throw new Error("Unknown mural effect id: " + id);
}
