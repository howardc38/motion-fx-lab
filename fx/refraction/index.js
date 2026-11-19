// Refractive Glass, Voronoi Shard Title & Procedural Optical Shaders (0BSD).
// Pure deterministic frame(t, options) on shared WebGL1 + Canvas 2D, zero external deps.

const W = 1280;
const H = 720;
const TAU = Math.PI * 2;
const SANS = '"Archivo", "Helvetica Neue", -apple-system, Arial, sans-serif';
const SERIF = '"Instrument Serif", Georgia, "Times New Roman", serif';
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const outCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
const outQuint = (x) => 1 - Math.pow(1 - clamp(x), 5);
const spring = (u, zeta = 0.62, omega = 18) => {
  if (u <= 0) return 0;
  const wd = omega * Math.sqrt(Math.max(0.001, 1 - zeta * zeta));
  const env = Math.exp(-zeta * omega * u);
  return 1 - env * (Math.cos(wd * u) + ((zeta * omega) / wd) * Math.sin(wd * u));
};
const hash1 = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};

async function ensureFonts() {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
}

function getCustomText(options, fallback) {
  const raw =
    (options && typeof options.text === 'string' && options.text.trim()) ||
    (typeof window !== 'undefined' && typeof window.FX_CUSTOM_TEXT === 'string' && window.FX_CUSTOM_TEXT.trim()) ||
    '';
  return raw || fallback;
}

// ============================================================================
// Shared WebGL1 fullscreen-quad runner (prevents WebGL context exhaustion)
// ============================================================================
let sharedGL = null;

function getSharedGL(width, height) {
  if (!sharedGL || sharedGL.gl.isContextLost()) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('WebGL unavailable for fx/refraction');

    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const programs = new Map();
    sharedGL = { canvas, gl, quadBuf, programs };
  }
  if (sharedGL.canvas.width !== width || sharedGL.canvas.height !== height) {
    sharedGL.canvas.width = width;
    sharedGL.canvas.height = height;
  }
  return sharedGL;
}

const VERT_SRC = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

function compileProgram(ctxObj, key, fragSrc) {
  if (ctxObj.programs.has(key)) return ctxObj.programs.get(key);
  const { gl } = ctxObj;
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(`Shader compile error (${key}): ${log}`);
    }
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
  const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`Program link error (${key}): ${log}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  const uniforms = {};
  const entry = { prog, aPos, uniforms };
  ctxObj.programs.set(key, entry);
  return entry;
}

function uni(gl, entry, name) {
  if (!(name in entry.uniforms)) {
    entry.uniforms[name] = gl.getUniformLocation(entry.prog, name);
  }
  return entry.uniforms[name];
}

function drawQuad(ctxObj, entry, width, height) {
  const { gl, quadBuf } = ctxObj;
  gl.viewport(0, 0, width, height);
  gl.useProgram(entry.prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.enableVertexAttribArray(entry.aPos);
  gl.vertexAttribPointer(entry.aPos, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function uploadCanvasTexture(gl, tex, sourceCanvas) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
}

// ============================================================================
// 1. glass-shard-title (lead, kind: shader, period: 6.0, hero: 2.85)
// Voronoi 3D refractive glass shards with chromatic dispersion & studio HDR
// ============================================================================
const GLASS_SHARD_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform float uBurst;
uniform float uSweep;
uniform sampler2D uPoster;

vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

vec3 studioEnv(vec3 r) {
  // Analytic studio HDR environment: obsidian cyclorama + 3 crisp softboxes + warm rim
  float up = clamp(r.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 base = mix(vec3(0.03, 0.035, 0.05), vec3(0.09, 0.11, 0.16), up);
  float sb1 = smoothstep(0.76, 0.96, dot(r, normalize(vec3(-0.45, 0.68, 0.58))));
  float sb2 = smoothstep(0.80, 0.98, dot(r, normalize(vec3(0.62, 0.42, 0.66))));
  float sb3 = smoothstep(0.84, 0.99, dot(r, normalize(vec3(0.0, -0.55, 0.83))));
  float band = exp(-pow((r.y - 0.06) * 9.0, 2.0)) * 0.45;
  vec3 col = base;
  col += sb1 * vec3(1.55, 1.65, 1.85);
  col += sb2 * vec3(1.35, 1.15, 0.98);
  col += sb3 * vec3(0.55, 0.85, 1.35);
  col += band * vec3(0.45, 0.62, 0.95);
  return col;
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  // Glass plate bounds in aspect-corrected space
  vec2 plateHalf = vec2(0.76, 0.34);
  vec2 q = abs(p) - plateHalf;
  float plateSdf = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.022;

  // Voronoi fracture grid over the glass plate
  vec2 scale = vec2(6.5, 4.2);
  vec2 g = p * scale;
  vec2 ig = floor(g);
  vec2 fg = fract(g);

  float minD = 8.0;
  float secD = 8.0;
  vec2 bestId = vec2(0.0);
  vec2 bestVec = vec2(0.0);
  vec2 secVec = vec2(0.0);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 nb = vec2(float(x), float(y));
      vec2 cellId = ig + nb;
      vec2 rnd = hash22(cellId + 17.3);
      vec2 site = nb + 0.18 + 0.64 * rnd;
      vec2 diff = site - fg;
      float d = length(diff);
      if (d < minD) {
        secD = minD;
        secVec = bestVec;
        minD = d;
        bestId = cellId;
        bestVec = diff;
      } else if (d < secD) {
        secD = d;
        secVec = diff;
      }
    }
  }

  // Exact Euclidean distance to Voronoi seam
  float seamDist = dot(0.5 * (bestVec + secVec), normalize(secVec - bestVec + 1e-5));
  vec2 cellRand = hash22(bestId + 91.7);
  vec2 cellRand2 = hash22(bestId + 213.1);

  // Per-shard radial explosion and 3D tilt angle
  vec2 cellCenterP = (bestId + 0.5) / scale;
  float radial = length(cellCenterP);
  float shardDelay = clamp((radial * 0.55 + cellRand.x * 0.35), 0.0, 0.65);
  float localBurst = clamp((uBurst - shardDelay * 0.35) / (1.0 - shardDelay * 0.35), 0.0, 1.0);
  localBurst = localBurst * localBurst * (3.0 - 2.0 * localBurst);

  // Outward shift & facet tilt per shard (kept tight so refracted title stays unmistakably legible)
  vec2 outDir = normalize(cellCenterP + vec2(0.001, 0.002));
  vec2 shardShift = outDir * localBurst * (0.018 + 0.024 * cellRand.y)
                  + vec2(cellRand2.x - 0.5, cellRand2.y - 0.5) * localBurst * 0.014;

  // Faceted shard surface normal (tilts dramatically during burst, flattens cleanly at rest)
  vec2 tilt = (cellRand2 - 0.5) * 2.0 * (0.032 + 0.42 * localBurst);
  vec2 bevelNormal = normalize(bestVec - secVec + 1e-5) * smoothstep(0.095, 0.005, seamDist) * (0.16 + 0.58 * localBurst);
  vec3 N = normalize(vec3(tilt.x + bevelNormal.x, tilt.y + bevelNormal.y, 1.0));
  vec3 V = normalize(vec3(-p * 0.35, 1.0));

  // Shard gap opens cleanly along seams during burst
  float seamGap = mix(0.003, 0.036, localBurst);
  float shardMask = smoothstep(seamGap, seamGap + 0.014, seamDist);
  float inPlate = smoothstep(0.012, -0.008, plateSdf - localBurst * 0.045);
  float glassAlpha = inPlate * mix(1.0, shardMask, smoothstep(0.02, 0.25, localBurst));

  // Refined chromatic Snell refraction into the poster texture beneath
  float iorSpread = 0.003 + 0.009 * localBurst + 0.006 * smoothstep(0.075, 0.0, seamDist);
  vec2 refractBase = uv + shardShift * vec2(1.0 / aspect, 1.0) + N.xy * (0.014 + 0.024 * localBurst);
  float rCh = texture2D(uPoster, clamp(refractBase + N.xy * iorSpread * 1.15, 0.002, 0.998)).r;
  float gCh = texture2D(uPoster, clamp(refractBase, 0.002, 0.998)).g;
  float bCh = texture2D(uPoster, clamp(refractBase - N.xy * iorSpread * 1.25, 0.002, 0.998)).b;
  vec3 refracted = vec3(rCh, gCh, bCh);

  // Studio environment reflection + Fresnel + grazing bevel fire
  vec3 R = reflect(-V, N);
  vec3 envCol = studioEnv(R);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.2);

  // Diagonal studio sweep highlight across the intact & fracturing glass
  float diag = p.x * 0.85 + p.y * 0.52 - uSweep;
  float glint = exp(-pow(diag * 7.0, 2.0)) * (0.30 + 0.72 * fresnel);

  // Sharp beveled facet edge highlight (prismatic cyan-violet-amber rim)
  float edgeBand = smoothstep(seamGap + 0.045, seamGap + 0.005, seamDist) * shardMask;
  vec3 prismEdge = mix(vec3(0.48, 0.90, 1.0), vec3(1.0, 0.76, 0.96), cellRand.x) * edgeBand * (0.28 + 1.25 * localBurst);

  // Subtle plate bevel frame highlight
  float frameRim = smoothstep(0.022, 0.0, abs(plateSdf)) * (1.0 - localBurst * 0.75);

  vec3 glassCol = mix(refracted * 1.12, envCol, clamp(0.14 + fresnel * 0.66, 0.0, 0.84));
  glassCol += prismEdge + glint * vec3(1.0, 0.98, 0.95) + frameRim * vec3(0.75, 0.88, 1.0) * 0.62;

  // Clean obsidian cyclorama behind open cracks (no duplicate un-refracted text ghosting)
  float vig = 1.0 - 0.38 * dot(p, p);
  vec3 bg = mix(vec3(0.022, 0.028, 0.048), vec3(0.055, 0.072, 0.125), smoothstep(-0.5, 0.5, -p.y)) * vig;
  float crackGlow = (1.0 - shardMask) * inPlate * smoothstep(0.05, 0.45, localBurst);
  bg += crackGlow * vec3(0.24, 0.56, 0.98) * 0.34;

  vec3 finalCol = mix(bg, glassCol, glassAlpha);

  // Gentle filmic tone curve
  finalCol = finalCol / (finalCol + vec3(0.85)) * 1.62;
  gl_FragColor = vec4(clamp(finalCol, 0.0, 1.0), 1.0);
}
`;

async function buildGlassShardTitle(options = {}) {
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 6.0;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  // Offscreen high-contrast editorial poster texture refracted through Voronoi glass
  const posterCanvas = document.createElement('canvas');
  posterCanvas.width = 1280;
  posterCanvas.height = 720;
  const pg = posterCanvas.getContext('2d');
  let cachedText = null;

  const ctxObj = getSharedGL(width, height);
  const prog = compileProgram(ctxObj, 'glass-shard-title', GLASS_SHARD_FRAG);
  const tex = ctxObj.gl.createTexture();

  function drawPoster(textStr, localT) {
    pg.save();
    pg.clearRect(0, 0, 1280, 720);
    // Rich midnight studio backdrop with calibrated luminous radial pockets for refraction
    const bg = pg.createLinearGradient(0, 0, 1280, 720);
    bg.addColorStop(0, '#070912');
    bg.addColorStop(0.5, '#101528');
    bg.addColorStop(1, '#090b14');
    pg.fillStyle = bg;
    pg.fillRect(0, 0, 1280, 720);

    // Soft chromatic studio backlights behind glass
    const shift = Math.sin(localT * TAU / PERIOD) * 90;
    const drawOrb = (x, y, r, c0, c1) => {
      const rg = pg.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, c0);
      rg.addColorStop(1, c1);
      pg.fillStyle = rg;
      pg.fillRect(x - r, y - r, r * 2, r * 2);
    };
    drawOrb(340 + shift, 260, 340, 'rgba(72, 168, 255, 0.42)', 'rgba(72, 168, 255, 0)');
    drawOrb(950 - shift, 440, 360, 'rgba(232, 120, 218, 0.36)', 'rgba(232, 120, 218, 0)');
    drawOrb(640, 360, 280, 'rgba(255, 224, 178, 0.16)', 'rgba(255, 224, 178, 0)');

    // Subtle Swiss architectural hairlines
    pg.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    pg.lineWidth = 1;
    pg.strokeRect(110, 128, 1060, 464);

    // Eyebrow metadata
    pg.fillStyle = 'rgba(176, 214, 255, 0.85)';
    pg.font = `700 16px ${MONO}`;
    pg.textAlign = 'center';
    pg.textBaseline = 'middle';
    pg.fillText('OPTICAL VORONOI TESSELLATION  //  IOR 1.52', 640, 224);

    // Main serif/sans hero headline
    const cleanText = textStr.slice(0, 24);
    let fontSize = cleanText.length > 14 ? 86 : cleanText.length > 9 ? 116 : 148;
    pg.font = `900 ${fontSize}px ${SANS}`;
    while (pg.measureText(cleanText).width > 940 && fontSize > 48) {
      fontSize -= 6;
      pg.font = `900 ${fontSize}px ${SANS}`;
    }
    const tg = pg.createLinearGradient(0, 290, 0, 430);
    tg.addColorStop(0, '#ffffff');
    tg.addColorStop(0.55, '#eef5ff');
    tg.addColorStop(1, '#b6cde8');
    pg.fillStyle = tg;
    pg.fillText(cleanText, 640, 366);

    // Sub-line
    pg.fillStyle = 'rgba(226, 232, 248, 0.72)';
    pg.font = `400 italic 30px ${SERIF}`;
    pg.fillText('Faceted chromatic refraction — reassembled to zero-seam clarity', 640, 470);
    pg.restore();
  }

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const textStr = getCustomText(opts, 'CRYSTAL');

    // 4-phase seamless choreography:
    // 0.0-1.15s: intact shimmering glass slab -> 1.15-2.65s: Voronoi 3D shatter outward ->
    // 2.65-3.45s: suspended tumbling crystal hold (hero=2.85) -> 3.45-5.15s: magnetic reassembly -> 5.15-6.0s: clean hold
    let burst = 0;
    if (t < 1.1) {
      burst = 0;
    } else if (t < 2.55) {
      burst = outCubic((t - 1.1) / 1.45);
    } else if (t < 3.45) {
      burst = 1.0 - 0.04 * Math.sin(((t - 2.55) / 0.9) * Math.PI);
    } else if (t < 5.05) {
      const p = (t - 3.45) / 1.6;
      burst = Math.max(0, 1.0 - spring(p, 0.72, 11.5));
    } else {
      burst = 0;
    }

    const sweep = lerp(-1.35, 1.35, smooth(0.15, 5.85, t));

    drawPoster(textStr, t);
    cachedText = textStr;

    const c = getSharedGL(width, height);
    const gl = c.gl;
    gl.activeTexture(gl.TEXTURE0);
    uploadCanvasTexture(gl, tex, posterCanvas);

    gl.useProgram(prog.prog);
    gl.uniform2f(uni(gl, prog, 'uRes'), width, height);
    gl.uniform1f(uni(gl, prog, 'uTime'), t);
    gl.uniform1f(uni(gl, prog, 'uBurst'), burst);
    gl.uniform1f(uni(gl, prog, 'uSweep'), sweep);
    gl.uniform1i(uni(gl, prog, 'uPoster'), 0);
    drawQuad(c, prog, width, height);

    g.clearRect(0, 0, width, height);
    g.drawImage(c.canvas, 0, 0, width, height);
  }

  frame(2.85, options);
  return {
    canvas,
    frame,
    period: PERIOD,
    hero: 2.85,
    dispose() {
      if (sharedGL && !sharedGL.gl.isContextLost()) sharedGL.gl.deleteTexture(tex);
    },
  };
}

// ============================================================================
// 2. liquid-glass-ui (lead, kind: ui, period: 6.0, hero: 2.9)
// True Snell-law SDF refractive Liquid Glass UI widgets over moving typography
// ============================================================================
const LIQUID_GLASS_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec4 uCardA; // cx, cy, hw, hh in aspect-normalized coords
uniform vec4 uCardB;
uniform vec4 uPill;
uniform sampler2D uBg;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

vec2 calcGrad(vec2 p, vec2 c, vec2 b, float r) {
  float e = 0.0025;
  float dx = sdRoundBox(p - c + vec2(e, 0.0), b, r) - sdRoundBox(p - c - vec2(e, 0.0), b, r);
  float dy = sdRoundBox(p - c + vec2(0.0, e), b, r) - sdRoundBox(p - c - vec2(0.0, e), b, r);
  return normalize(vec2(dx, dy) + 1e-6);
}

vec3 sampleBlurred(sampler2D tex, vec2 uv, float radius) {
  vec3 acc = texture2D(tex, clamp(uv, 0.002, 0.998)).rgb * 0.28;
  acc += texture2D(tex, clamp(uv + vec2(radius, 0.0), 0.002, 0.998)).rgb * 0.12;
  acc += texture2D(tex, clamp(uv - vec2(radius, 0.0), 0.002, 0.998)).rgb * 0.12;
  acc += texture2D(tex, clamp(uv + vec2(0.0, radius), 0.002, 0.998)).rgb * 0.12;
  acc += texture2D(tex, clamp(uv - vec2(0.0, radius), 0.002, 0.998)).rgb * 0.12;
  float d = radius * 0.707;
  acc += texture2D(tex, clamp(uv + vec2(d, d), 0.002, 0.998)).rgb * 0.06;
  acc += texture2D(tex, clamp(uv + vec2(-d, d), 0.002, 0.998)).rgb * 0.06;
  acc += texture2D(tex, clamp(uv + vec2(d, -d), 0.002, 0.998)).rgb * 0.06;
  acc += texture2D(tex, clamp(uv + vec2(-d, -d), 0.002, 0.998)).rgb * 0.06;
  return acc;
}

vec4 shadeGlassLens(vec2 p, vec2 uv, float aspect, vec2 c, vec2 b, float r, vec3 tint) {
  float d = sdRoundBox(p - c, b, r);
  // Soft elevation shadow outside lens
  float shadow = exp(-max(d, 0.0) * 18.0) * 0.34;
  if (d > 0.004) return vec4(0.0, 0.0, 0.0, shadow);

  float inside = -d;
  // Curved meniscus edge profile (strong optical bend near rim, gentle magnification at center)
  float rimZone = smoothstep(0.095, 0.0, inside);
  vec2 grad = calcGrad(p, c, b, r);
  vec2 bendDir = grad * (0.012 + 0.052 * pow(rimZone, 1.55));
  vec2 uvOffset = vec2(bendDir.x / aspect, bendDir.y);

  // Chromatic dispersion (R bends slightly less than B)
  float blurAmt = 0.0042 * (1.0 - 0.55 * rimZone);
  float cr = sampleBlurred(uBg, uv - uvOffset * 0.86, blurAmt).r;
  float cg = sampleBlurred(uBg, uv - uvOffset * 1.00, blurAmt).g;
  float cb = sampleBlurred(uBg, uv - uvOffset * 1.18, blurAmt).b;
  vec3 refr = vec3(cr, cg, cb);

  // Subtle internal light lift + directional specular caustic rim
  vec2 lightDir = normalize(vec2(-0.55, 0.84));
  float specTop = pow(max(dot(grad, lightDir), 0.0), 3.0) * smoothstep(0.028, 0.0, inside);
  float specBot = pow(max(dot(grad, -lightDir), 0.0), 4.0) * smoothstep(0.022, 0.0, inside);
  float innerRim = smoothstep(0.012, 0.001, inside);
  float sheen = smoothstep(0.35, -0.25, (p.y - c.y) / b.y - (p.x - c.x) * 0.35) * 0.09;

  vec3 glass = mix(refr, tint, 0.14) + sheen;
  glass += specTop * vec3(1.0, 0.99, 0.97) * 0.92;
  glass += specBot * vec3(0.65, 0.86, 1.0) * 0.42;
  glass += innerRim * vec3(0.92, 0.96, 1.0) * 0.32;

  float aa = smoothstep(0.004, -0.003, d);
  return vec4(glass, aa);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  vec3 col = texture2D(uBg, uv).rgb;

  // Apply three overlapping Liquid Glass optical lenses
  vec4 gA = shadeGlassLens(p, uv, aspect, uCardA.xy, uCardA.zw, 0.068, vec3(0.95, 0.97, 1.0));
  if (sdRoundBox(p - uCardA.xy, uCardA.zw, 0.068) <= 0.004) col = mix(col, gA.rgb, gA.a);
  else col *= (1.0 - gA.a * 0.48);

  vec4 gB = shadeGlassLens(p, uv, aspect, uCardB.xy, uCardB.zw, 0.064, vec3(0.92, 0.96, 1.0));
  if (sdRoundBox(p - uCardB.xy, uCardB.zw, 0.064) <= 0.004) col = mix(col, gB.rgb, gB.a);
  else col *= (1.0 - gB.a * 0.46);

  vec4 gP = shadeGlassLens(p, uv, aspect, uPill.xy, uPill.zw, uPill.w, vec3(1.0, 0.98, 0.96));
  if (sdRoundBox(p - uPill.xy, uPill.zw, uPill.w) <= 0.004) col = mix(col, gP.rgb, gP.a);
  else col *= (1.0 - gP.a * 0.42);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

async function buildLiquidGlassUI(options = {}) {
  await ensureFonts();
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 6.0;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = 1280;
  bgCanvas.height = 720;
  const bgCtx = bgCanvas.getContext('2d');

  const ctxObj = getSharedGL(width, height);
  const prog = compileProgram(ctxObj, 'liquid-glass-ui', LIQUID_GLASS_FRAG);
  const tex = ctxObj.gl.createTexture();

  function drawBackdrop(t, customWord) {
    bgCtx.save();
    // Vibrant daylight editorial gradient + bold kinetic ribbons underneath glass so refraction pops!
    const grad = bgCtx.createLinearGradient(0, 0, 1280, 720);
    grad.addColorStop(0, '#f4efe6');
    grad.addColorStop(0.45, '#e8effa');
    grad.addColorStop(1, '#fbe6dc');
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, 1280, 720);

    const drift = Math.sin((t / PERIOD) * TAU);
    const drawBlob = (x, y, r, c0, c1) => {
      const rg = bgCtx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, c0);
      rg.addColorStop(1, c1);
      bgCtx.fillStyle = rg;
      bgCtx.beginPath();
      bgCtx.arc(x, y, r, 0, TAU);
      bgCtx.fill();
    };
    drawBlob(280 + drift * 95, 220 + Math.cos((t / PERIOD) * TAU) * 45, 310, 'rgba(255, 102, 74, 0.72)', 'rgba(255, 102, 74, 0)');
    drawBlob(960 - drift * 80, 290 - Math.cos((t / PERIOD) * TAU) * 55, 340, 'rgba(46, 128, 255, 0.75)', 'rgba(46, 128, 255, 0)');
    drawBlob(640 + drift * 70, 560, 320, 'rgba(138, 72, 255, 0.56)', 'rgba(138, 72, 255, 0)');

    // High-contrast scrolling giant editorial typography directly behind the glass lenses
    const scrollX = (t / PERIOD) * 640;
    bgCtx.fillStyle = '#141724';
    bgCtx.font = `900 184px ${SANS}`;
    bgCtx.textBaseline = 'middle';
    bgCtx.textAlign = 'left';
    const word = (customWord || 'OPTICAL').toUpperCase();
    const row1 = `${word}  ·  REFRACTION  ·  ${word}  ·  REFRACTION`;
    const row2 = `GLASS  ·  DEPTH  ·  GLASS  ·  DEPTH  ·  GLASS`;
    bgCtx.fillText(row1, -scrollX - 80, 200);
    bgCtx.fillStyle = 'rgba(20, 23, 36, 0.82)';
    bgCtx.fillText(row2, scrollX - 660, 415);

    // Vivid diagonal graphic stripes so lens bending is unmistakably visible
    bgCtx.strokeStyle = 'rgba(15, 23, 42, 0.14)';
    bgCtx.lineWidth = 3;
    for (let x = -200; x < 1480; x += 64) {
      bgCtx.beginPath();
      bgCtx.moveTo(x + (scrollX % 64), 0);
      bgCtx.lineTo(x + (scrollX % 64) + 180, 720);
      bgCtx.stroke();
    }
    bgCtx.restore();
  }

  function drawWidgetChrome(t, cardA, cardB, pill, customWord) {
    const aspect = width / height;
    const toPx = (cx, cy, hw, hh) => ({
      x: (cx / aspect + 0.5) * width,
      y: (0.5 - cy) * height,
      w: (hw * 2 / aspect) * width,
      h: hh * 2 * height,
    });
    const A = toPx(...cardA);
    const B = toPx(...cardB);
    const P = toPx(...pill);
    const sc = width / 1280;

    g.save();
    // Card A: Live Optical Telemetry Card (crisp dark/light vector ink over refracted glass)
    const ax0 = A.x - A.w / 2;
    const ay0 = A.y - A.h / 2;
    g.fillStyle = 'rgba(15, 20, 32, 0.72)';
    g.font = `700 ${13 * sc}px ${MONO}`;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText('LIQUID GLASS · SNELL IOR 1.48', ax0 + 28 * sc, ay0 + 26 * sc);

    const metricVal = Math.round(lerp(82, 99, 0.5 + 0.5 * Math.sin((t / PERIOD) * TAU - 0.6)));
    g.fillStyle = '#0e1320';
    g.font = `900 ${62 * sc}px ${SANS}`;
    g.fillText(`${metricVal}.4%`, ax0 + 26 * sc, ay0 + 54 * sc);

    g.fillStyle = 'rgba(15, 20, 32, 0.66)';
    g.font = `600 ${16 * sc}px ${SANS}`;
    g.fillText((customWord || 'Specular Clarity') + ' · Real-Time Lens', ax0 + 28 * sc, ay0 + 128 * sc);

    // Mini sparkline inside Card A
    g.beginPath();
    const pts = 24;
    for (let i = 0; i < pts; i++) {
      const u = i / (pts - 1);
      const px = ax0 + 28 * sc + u * (A.w - 56 * sc);
      const py = ay0 + A.h - 46 * sc - Math.sin(u * 5.2 + t * 2.2) * 18 * sc - u * 16 * sc;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokeStyle = '#0f172a';
    g.lineWidth = 3 * sc;
    g.lineCap = 'round';
    g.stroke();

    // Card B: Circular Optical Ring Gauge inside second glass card
    const bx0 = B.x - B.w / 2;
    const by0 = B.y - B.h / 2;
    const ringR = 56 * sc;
    const rcx = B.x;
    const rcy = B.y - 8 * sc;
    g.beginPath();
    g.arc(rcx, rcy, ringR, 0, TAU);
    g.strokeStyle = 'rgba(15, 23, 42, 0.16)';
    g.lineWidth = 10 * sc;
    g.stroke();
    const sweep = 0.25 + 0.62 * (0.5 + 0.5 * Math.sin((t / PERIOD) * TAU));
    g.beginPath();
    g.arc(rcx, rcy, ringR, -Math.PI / 2, -Math.PI / 2 + sweep * TAU);
    g.strokeStyle = '#111827';
    g.lineWidth = 10 * sc;
    g.lineCap = 'round';
    g.stroke();

    g.fillStyle = '#0f172a';
    g.font = `800 ${26 * sc}px ${MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(`${Math.round(sweep * 100)}`, rcx, rcy);
    g.font = `700 ${12 * sc}px ${MONO}`;
    g.fillStyle = 'rgba(15, 23, 42, 0.68)';
    g.fillText('DISPERSION', rcx, by0 + B.h - 26 * sc);

    // Floating Capsule Pill: animated playhead dot + label
    g.fillStyle = '#0e1320';
    g.beginPath();
    g.arc(P.x - P.w / 2 + 28 * sc, P.y, 7 * sc, 0, TAU);
    g.fill();
    g.font = `700 ${15 * sc}px ${SANS}`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('Adaptive Refractive Surface', P.x - P.w / 2 + 46 * sc, P.y);
    g.restore();
  }

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const customWord = getCustomText(opts, '');
    const ph = (t / PERIOD) * TAU;

    // Smooth sinusoidal orbital gliding of the 3 refractive glass widgets across typography
    const cardA = [-0.24 + Math.sin(ph) * 0.08, 0.04 + Math.cos(ph) * 0.045, 0.34, 0.21];
    const cardB = [0.36 + Math.cos(ph) * 0.065, 0.06 - Math.sin(ph) * 0.05, 0.19, 0.20];
    const pill = [Math.sin(ph * 1.0 + 0.8) * 0.24, -0.28 + Math.cos(ph * 2.0) * 0.025, 0.26, 0.056];

    drawBackdrop(t, customWord);

    const c = getSharedGL(width, height);
    const gl = c.gl;
    gl.activeTexture(gl.TEXTURE0);
    uploadCanvasTexture(gl, tex, bgCanvas);

    gl.useProgram(prog.prog);
    gl.uniform2f(uni(gl, prog, 'uRes'), width, height);
    gl.uniform1f(uni(gl, prog, 'uTime'), t);
    gl.uniform4fv(uni(gl, prog, 'uCardA'), cardA);
    gl.uniform4fv(uni(gl, prog, 'uCardB'), cardB);
    gl.uniform4fv(uni(gl, prog, 'uPill'), pill);
    gl.uniform1i(uni(gl, prog, 'uBg'), 0);
    drawQuad(c, prog, width, height);

    g.clearRect(0, 0, width, height);
    g.drawImage(c.canvas, 0, 0, width, height);
    drawWidgetChrome(t, cardA, cardB, pill, customWord);
  }

  frame(2.9, options);
  return {
    canvas,
    frame,
    period: PERIOD,
    hero: 2.9,
    dispose() {
      if (sharedGL && !sharedGL.gl.isContextLost()) sharedGL.gl.deleteTexture(tex);
    },
  };
}

// ============================================================================
// 3. aurora-shaders (+ 3 variants: prism-frost, nebula-plasma, marble-obsidian)
// Pure WebGL1 procedural GLSL worlds — zero WebGPU requirement, seamless loop
// ============================================================================
const SHADER_WORLD_FRAG = `
precision highp float;
#define TAU 6.28318530718
varying vec2 vUv;
uniform vec2 uRes;
uniform float uPhase; // 0..TAU periodic
uniform int uMode;    // 0=aurora, 1=prism-frost, 2=nebula-plasma, 3=marble-obsidian

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.03 + vec2(13.1, 7.7);
    a *= 0.5;
  }
  return v;
}

vec3 renderAurora(vec2 p, vec2 uv, float ph) {
  vec3 sky = mix(vec3(0.015, 0.03, 0.07), vec3(0.04, 0.08, 0.16), smoothstep(-0.4, 0.6, p.y));
  // Subtle twinkling starfield
  vec2 starGrid = floor(uv * vec2(120.0, 68.0));
  float st = hash(starGrid);
  if (st > 0.986) {
    vec2 cell = fract(uv * vec2(120.0, 68.0)) - 0.5;
    float tw = 0.55 + 0.45 * sin(ph * 2.0 + st * 90.0);
    sky += smoothstep(0.24, 0.02, length(cell)) * tw * vec3(0.85, 0.92, 1.0) * smoothstep(-0.2, 0.35, p.y);
  }
  vec3 col = sky;
  // 4 layered undulating vertical aurora curtains
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float wave = sin(p.x * (2.2 + fi * 0.55) + ph + fi * 1.4) * 0.14
               + sin(p.x * 4.5 - ph * 2.0 + fi * 2.1) * 0.05;
    float baseLine = -0.08 + fi * 0.09 + wave;
    float dy = p.y - baseLine;
    float verticalEnv = exp(-max(dy, 0.0) * (3.2 - fi * 0.32)) * smoothstep(-0.08, 0.05, dy);
    float rays = 0.55 + 0.45 * noise(vec2(p.x * (10.0 + fi * 3.0) + sin(ph + fi) * 0.7, dy * 1.8 - cos(ph) * 0.4));
    float shimmer = pow(rays, 1.8) * verticalEnv;
    vec3 cLow = mix(vec3(0.08, 0.96, 0.64), vec3(0.14, 0.78, 1.0), fi / 3.0);
    vec3 cHigh = mix(vec3(0.56, 0.24, 0.98), vec3(0.95, 0.28, 0.68), fi / 3.0);
    vec3 bandCol = mix(cLow, cHigh, smoothstep(0.02, 0.48, dy));
    col += bandCol * shimmer * (0.48 - fi * 0.06);
  }
  // Calm glacial mountain ridge silhouette at bottom
  float ridge = -0.34 + 0.075 * noise(vec2(p.x * 2.8 + 4.2, 1.0)) + 0.025 * noise(vec2(p.x * 9.0, 2.0));
  float mtn = smoothstep(ridge + 0.008, ridge - 0.006, p.y);
  col = mix(col, vec3(0.012, 0.018, 0.032) + col * 0.08, mtn);
  return col;
}

vec3 renderPrismFrost(vec2 p, float ph) {
  vec2 q = p * 3.8 + vec2(sin(ph) * 0.35, cos(ph) * 0.25);
  vec2 ig = floor(q);
  vec2 fg = fract(q);
  float d1 = 8.0, d2 = 8.0;
  vec2 bestId = vec2(0.0);
  vec2 bestVec = vec2(0.0);
  vec2 secVec = vec2(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 nb = vec2(float(x), float(y));
      vec2 id = ig + nb;
      vec2 o = hash2(id);
      o = 0.5 + 0.38 * sin(ph + TAU * o);
      vec2 diff = nb + o - fg;
      float d = length(diff);
      if (d < d1) {
        d2 = d1; secVec = bestVec;
        d1 = d; bestVec = diff; bestId = id;
      } else if (d < d2) {
        d2 = d; secVec = diff;
      }
    }
  }
  float edge = dot(0.5 * (bestVec + secVec), normalize(secVec - bestVec + 1e-5));
  float frostNoise = fbm(p * 11.0 + vec2(cos(ph) * 0.3, sin(ph) * 0.3));
  vec2 n2 = normalize(bestVec - secVec + 1e-4) * smoothstep(0.18, 0.0, edge);
  vec3 N = normalize(vec3(n2.x * 0.8 + (frostNoise - 0.5) * 0.35, n2.y * 0.8 + (frostNoise - 0.5) * 0.35, 1.0));
  vec3 L = normalize(vec3(cos(ph) * 0.7, sin(ph) * 0.5 + 0.4, 0.8));
  float spec = pow(max(dot(reflect(-L, N), vec3(0.0, 0.0, 1.0)), 0.0), 18.0);
  float hue = fract(hash(bestId) + p.x * 0.25 + sin(ph) * 0.15 + edge * 0.6);
  vec3 prism = 0.55 + 0.45 * cos(TAU * (hue + vec3(0.0, 0.33, 0.67)));
  vec3 iceBase = mix(vec3(0.05, 0.11, 0.22), vec3(0.28, 0.58, 0.86), frostNoise);
  vec3 col = mix(iceBase, prism * 0.95, 0.38 + 0.42 * smoothstep(0.16, 0.0, edge));
  col += smoothstep(0.045, 0.0, edge) * vec3(0.85, 0.97, 1.0) * 0.95;
  col += spec * vec3(1.0, 0.96, 1.0) * 1.15;
  return col;
}

vec3 renderNebulaPlasma(vec2 p, float ph) {
  vec2 loopOff = vec2(cos(ph), sin(ph)) * 0.38;
  vec2 q = vec2(fbm(p * 2.2 + loopOff), fbm(p * 2.2 + vec2(5.2, 1.3) - loopOff));
  vec2 r = vec2(fbm(p * 2.4 + 2.8 * q + vec2(1.7, 9.2) + loopOff * 0.6),
                fbm(p * 2.4 + 2.8 * q + vec2(8.3, 2.8) - loopOff * 0.6));
  float f = fbm(p * 1.9 + 2.6 * r);
  vec3 c0 = vec3(0.025, 0.018, 0.06);
  vec3 c1 = vec3(0.22, 0.08, 0.44);
  vec3 c2 = vec3(0.92, 0.22, 0.52);
  vec3 c3 = vec3(0.18, 0.78, 0.96);
  vec3 c4 = vec3(1.0, 0.82, 0.46);
  vec3 col = mix(c0, c1, smoothstep(0.18, 0.55, f));
  col = mix(col, c2, smoothstep(0.35, 0.78, length(q)));
  col = mix(col, c3, smoothstep(0.42, 0.82, r.x));
  float core = exp(-dot(p - vec2(sin(ph) * 0.14, cos(ph) * 0.08), p - vec2(sin(ph) * 0.14, cos(ph) * 0.08)) * 3.8);
  col += c4 * core * (0.45 + 0.65 * f);
  // Bright plasma filament ridges
  float ridge = pow(1.0 - abs(f * 2.0 - 1.0), 5.0);
  col += vec3(1.0, 0.78, 0.92) * ridge * 0.55;
  return col;
}

vec3 renderMarbleObsidian(vec2 p, float ph) {
  vec2 w1 = vec2(fbm(p * 2.4 + vec2(cos(ph) * 0.4, sin(ph) * 0.4)),
                 fbm(p * 2.4 + vec2(4.1, 2.7) + vec2(sin(ph) * 0.4, -cos(ph) * 0.4)));
  float v = sin((p.x * 3.4 + p.y * 1.8) + 4.8 * w1.x + 2.6 * w1.y);
  float vein = pow(1.0 - abs(v), 7.0);
  float fineVein = pow(1.0 - abs(sin((p.x * 7.2 - p.y * 4.5) + 6.0 * w1.y)), 12.0);
  // Rippling obsidian surface normal for dark studio reflection
  float eps = 0.01;
  float vx = sin(((p.x + eps) * 3.4 + p.y * 1.8) + 4.8 * w1.x + 2.6 * w1.y);
  float vy = sin((p.x * 3.4 + (p.y + eps) * 1.8) + 4.8 * w1.x + 2.6 * w1.y);
  vec3 N = normalize(vec3((v - vx) * 14.0, (v - vy) * 14.0, 1.0));
  vec3 L = normalize(vec3(sin(ph) * 0.7, 0.65, 0.75));
  float spec = pow(max(dot(reflect(-L, N), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  vec3 obsidian = mix(vec3(0.035, 0.038, 0.048), vec3(0.11, 0.13, 0.17), 0.5 + 0.5 * v);
  vec3 gold = vec3(0.98, 0.76, 0.36);
  vec3 silk = vec3(0.84, 0.87, 0.92);
  vec3 col = obsidian;
  col = mix(col, silk, smoothstep(0.45, 0.92, vein) * 0.62);
  col += gold * fineVein * 0.95;
  col += spec * vec3(0.95, 0.88, 0.78) * 0.68;
  return col;
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  vec3 col = vec3(0.0);
  if (uMode == 0) col = renderAurora(p, uv, uPhase);
  else if (uMode == 1) col = renderPrismFrost(p, uPhase);
  else if (uMode == 2) col = renderNebulaPlasma(p, uPhase);
  else col = renderMarbleObsidian(p, uPhase);
  // Subtle cinematic vignette
  col *= 1.0 - 0.24 * dot(p, p);
  col = col / (col + vec3(0.82)) * 1.56;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const SHADER_MODES = {
  'aurora-shaders': { mode: 0, label: 'AURORA BOREALIS', sub: 'Volumetric Curtain Rays · Periodic GLSL', hero: 3.2 },
  'shader-prism-frost': { mode: 1, label: 'PRISM FROST', sub: 'Voronoi Crystal Facets · Spectral Dispersion', hero: 2.6 },
  'shader-nebula-plasma': { mode: 2, label: 'NEBULA PLASMA', sub: 'Domain-Warped FBM · Ionized Filaments', hero: 3.0 },
  'shader-marble-obsidian': { mode: 3, label: 'OBSIDIAN MARBLE', sub: 'Curl Veining · Gold Inlay · Specular Relief', hero: 2.8 },
};

async function buildShaderWorld(id, options = {}) {
  await ensureFonts();
  const spec = SHADER_MODES[id] || SHADER_MODES['aurora-shaders'];
  const width = options.width || W;
  const height = options.height || H;
  const PERIOD = 7.2;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');

  const ctxObj = getSharedGL(width, height);
  const prog = compileProgram(ctxObj, 'shader-world', SHADER_WORLD_FRAG);

  function frame(rawT, opts = {}) {
    const t = ((Number(rawT) || 0) % PERIOD + PERIOD) % PERIOD;
    const phase = (t / PERIOD) * TAU;
    const c = getSharedGL(width, height);
    const gl = c.gl;

    gl.useProgram(prog.prog);
    gl.uniform2f(uni(gl, prog, 'uRes'), width, height);
    gl.uniform1f(uni(gl, prog, 'uPhase'), phase);
    gl.uniform1i(uni(gl, prog, 'uMode'), spec.mode);
    drawQuad(c, prog, width, height);

    g.clearRect(0, 0, width, height);
    g.drawImage(c.canvas, 0, 0, width, height);

    // Optional minimal editorial caption (suppressed when opts.clean === true for full-bleed film backdrops)
    if (!opts.clean) {
      const sc = width / 1280;
      const title = getCustomText(opts, spec.label);
      g.save();
      g.fillStyle = 'rgba(255, 255, 255, 0.92)';
      g.font = `900 ${54 * sc}px ${SANS}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = 'rgba(0, 0, 0, 0.45)';
      g.shadowBlur = 24 * sc;
      g.fillText(title, width * 0.5, height * 0.48);

      g.shadowBlur = 0;
      g.fillStyle = 'rgba(232, 240, 255, 0.74)';
      g.font = `600 ${15 * sc}px ${MONO}`;
      g.fillText(spec.sub, width * 0.5, height * 0.56);
      g.restore();
    }
  }

  frame(spec.hero, options);
  return {
    canvas,
    frame,
    period: PERIOD,
    hero: spec.hero,
  };
}

export async function create(id, options = {}) {
  if (id === 'glass-shard-title') return buildGlassShardTitle(options);
  if (id === 'liquid-glass-ui') return buildLiquidGlassUI(options);
  if (id in SHADER_MODES) return buildShaderWorld(id, options);
  throw new Error(`Unknown refraction effect id: ${id}`);
}
