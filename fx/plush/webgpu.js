// Interactive & scripted 240 Hz Verlet plush fur physics with soft-body contact denting (0BSD).
// Uses hardware WebGPU compute (WGSL guide strands + 0.5 s deterministic GPU state checkpoints) when
// available, and falls back seamlessly to Three.js WebGL2 soft-deformer + CPU Verlet checkpoints
// (or 2D Canvas if WebGL2 is unavailable) with zero uncaught errors.

import * as T from 'three';
import { createStage } from './stage.js';
import { createPlushBear, VISEMES } from './bear.js';
import { loadPhotoSet } from './textures.js';

export const PERIOD = 6;
export const SPS = 240;
export const CHECKPOINT_SECONDS = 0.5;
export const CHECKPOINT_STEPS = Math.round(SPS * CHECKPOINT_SECONDS); // 120 steps
const K = 4;
const NODES = K + 1;
const PREROLL = 120;
const SIMW = 2048;
const NP = 11;
const NC = 7; // 6 bear limb capsules + 1 tactile studio presser capsule
const NE = 3; // body, head, muzzle ellipsoids
const STEP_BYTES = 2640; // (11*44 + 7*16 + 3*20 + 4) * 4 bytes
const STRIDE = 2816; // 2640 rounded up to 256-byte uniform dynamic offset alignment
const MAXB = 240;

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (x) => {
  const k = clamp(x);
  return k * k * (3 - 2 * k);
};
const env = (t, t0, t1, a = 0.24, b = 0.28) => smooth((t - t0) / a) * (1 - smooth((t - (t1 - b)) / b));
const springWave = (t, t0, f = 2.6, d = 5.2) => (t < t0 ? 0 : Math.sin((t - t0) * f * Math.PI * 2) * Math.exp(-(t - t0) * d));

const ID_TO_KEY = Object.freeze({
  0: 'head',
  1: 'muzzle',
  2: 'body',
  3: 'upperArmR',
  4: 'upperArmL',
  5: 'lowerArmR',
  6: 'lowerArmL',
  7: 'legR',
  8: 'legL',
  9: 'earR',
  10: 'earL',
});

const CAP = Object.freeze({
  upperArmR: 0,
  lowerArmR: 1,
  upperArmL: 2,
  lowerArmL: 3,
  legR: 4,
  legL: 5,
  probe: 6,
});

const ELL = Object.freeze({ body: 0, head: 1, muzzle: 2 });

const limbSpec = (r, len, tip) => ({ ya: -0.15 * r, yb: -len - 0.15 * r, ra: r, rb: r * tip });
const LIMBS = Object.freeze({
  upperArm: limbSpec(0.112, 0.2, 1.02),
  lowerArm: { ...limbSpec(0.118, 0.13, 1.14), rb: 0.154 },
  leg: limbSpec(0.148, 0.22, 1.1),
});
const ELLIPSOIDS = Object.freeze({
  body: [0.47, 0.5, 0.41],
  head: [0.6, 0.51, 0.53],
  muzzle: [0.25, 0.175, 0.165],
});

const bit = (...ids) => ids.reduce((m, i) => m | (1 << i), 0);
const PRESSERS = bit(CAP.lowerArmR, CAP.lowerArmL, CAP.probe);

const PART_CFG = Object.freeze({
  body:      { skin: PRESSERS, furCaps: bit(0, 1, 2, 3, 6), ground: true, maxDent: 0.105 },
  head:      { skin: PRESSERS, furCaps: PRESSERS, maxDent: 0.068 },
  earR:      { furCaps: PRESSERS },
  earL:      { furCaps: PRESSERS },
  muzzle:    { skin: PRESSERS, furCaps: PRESSERS, maxDent: 0.045 },
  upperArmR: { furCaps: bit(CAP.upperArmL, CAP.lowerArmL, CAP.probe), furElls: bit(ELL.body) },
  lowerArmR: { furCaps: bit(CAP.upperArmL, CAP.lowerArmL, CAP.probe), furElls: bit(ELL.body, ELL.head, ELL.muzzle), dented: true, own: CAP.lowerArmR, ground: true },
  upperArmL: { furCaps: bit(CAP.upperArmR, CAP.lowerArmR, CAP.probe), furElls: bit(ELL.body) },
  lowerArmL: { furCaps: bit(CAP.upperArmR, CAP.lowerArmR, CAP.probe), furElls: bit(ELL.body, ELL.head, ELL.muzzle), dented: true, own: CAP.lowerArmL, ground: true },
  legR:      { furCaps: bit(CAP.legL, CAP.probe), ground: true },
  legL:      { furCaps: bit(CAP.legR, CAP.probe), ground: true },
});

export const SIM_PARAMS = Object.freeze({
  c: 0.28,
  kShape: 0.03,
  dInt: 0.10,
  dAir: 0.125,
  gravity: 8.0,
  groom: 0.38,
  friction: 0.58,
  bury: 0.35,
  minH: 0.075,
  skinK: 0.018,
  skinDamp: 0.078,
  rim: 0.048,
});

function buildWGSL(NG) {
  return /* wgsl */`
const K: u32 = ${K}u;
const NODES: u32 = ${NODES}u;
const NG: u32 = ${NG}u;

struct Part { M: mat4x4f, Minv: mat4x4f, N: mat3x3f };
struct Cap { a: vec4f, b: vec4f, da: vec4f, db: vec4f };
struct Ell { inv: mat4x4f, r: vec4f };
struct Step { parts: array<Part, ${NP}>, caps: array<Cap, ${NC}>, ells: array<Ell, ${NE}>, info: vec4f };
struct PartCfg { a: vec4f, b: vec4f, m: vec4u };
struct Cfg { parts: array<PartCfg, ${NP}>, capThick: array<vec4f, 2>, p: vec4f, q: vec4f };
struct Guide { rest: vec4f, nrm: vec4f };

@group(0) @binding(0) var<uniform> S: Step;
@group(0) @binding(1) var<uniform> C: Cfg;
@group(0) @binding(2) var<storage, read> guides: array<Guide>;
@group(0) @binding(3) var<storage, read_write> X: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> Xp: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> D: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> Out: array<vec4f>;

fn capThick(c: u32) -> f32 { return C.capThick[c / 4u][c % 4u]; }

struct Hit { d: f32, g: vec3f, u: f32 };

fn capHit(p: vec3f, c: Cap) -> Hit {
  let ab = c.b.xyz - c.a.xyz;
  let u = clamp(dot(p - c.a.xyz, ab) / max(dot(ab, ab), 1e-8), 0., 1.);
  let dv = p - (c.a.xyz + ab * u);
  let l = length(dv);
  var g = vec3f(0., 1., 0.);
  if (l > 1e-7) { g = dv / l; }
  return Hit(l - mix(c.a.w, c.b.w, u), g, u);
}

fn ease(x: f32) -> f32 {
  let y = clamp(x, 0., 1.);
  return y * y * (3. - 2. * y);
}

fn ellHit(p: vec3f, e: Ell, id: u32) -> Hit {
  var q = (e.inv * vec4f(p, 1.)).xyz;
  if (id == 0u) {
    let k = ease(.1 - q.y);
    q.x /= 1. + .14 * k;
    q.z /= 1. + .1 * k;
    if (q.y < -.4) { q.y = -.4 + (q.y + .4) / .3; }
  } else if (id == 1u) {
    if (q.y < .05) { q.x /= 1. + .07 * ease((.05 - q.y) / .45); }
  } else {
    if (q.y < 0.) { q.z /= 1. - .12 * ease(-q.y / .175); }
  }
  let r = e.r.xyz;
  let k0 = length(q / r);
  let k1 = length(q / (r * r));
  let gl = q / (r * r);
  let gw = normalize(transpose(mat3x3f(e.inv[0].xyz, e.inv[1].xyz, e.inv[2].xyz)) * gl);
  return Hit(k0 * (k0 - 1.) / max(k1, 1e-6) * e.r.w, gw, 0.);
}

fn groundY(x: f32, z: f32, wave: f32) -> f32 {
  if (wave < .5) { return 0.; }
  let zl = z - 1.;
  return .025 * sin(x * 2.1 + zl * .7) + .018 * sin(zl * 3.3 - x * 1.2) - .02;
}

fn restNode(skin: vec3f, n: vec3f, L: f32, h: f32) -> vec3f {
  let gd = vec3f(0., -C.p.y, 0.);
  let droop = gd - min(dot(gd, n), 0.) * n * .9;
  return skin + (n * h + droop * h * h) * L;
}

fn exportGuide(g: u32, pi: u32, n: vec3f, comp: f32, dent: f32) {
  let P = S.parts[pi];
  let base = g * NODES;
  let nl = normalize(transpose(mat3x3f(P.M[0].xyz, P.M[1].xyz, P.M[2].xyz)) * n);
  var extra = array<f32, ${NODES}>(nl.x, nl.y, nl.z, comp, dent);
  for (var j = 0u; j < NODES; j++) {
    Out[base + j] = vec4f((P.Minv * vec4f(X[base + j].xyz, 1.)).xyz, extra[j]);
  }
}

@compute @workgroup_size(64) fn init(@builtin(global_invocation_id) id: vec3u) {
  let g = id.x;
  if (g >= NG) { return; }
  let G = guides[g];
  let pi = u32(G.rest.w);
  let P = S.parts[pi];
  let skin = (P.M * vec4f(G.rest.xyz, 1.)).xyz;
  let n = normalize(P.N * G.nrm.xyz);
  let base = g * NODES;
  for (var j = 0u; j < NODES; j++) {
    let r = restNode(skin, n, G.nrm.w, f32(j) / f32(K));
    X[base + j] = vec4f(r, 0.);
    Xp[base + j] = vec4f(r, 0.);
  }
  D[g] = vec4f(0.);
  exportGuide(g, pi, n, 0., 0.);
}

@compute @workgroup_size(64) fn step(@builtin(global_invocation_id) id: vec3u) {
  let g = id.x;
  if (g >= NG) { return; }
  let G = guides[g];
  let pi = u32(G.rest.w);
  let P = S.parts[pi];
  let pc = C.parts[pi];
  let L = G.nrm.w;
  let cSelf = pc.a.x * L;
  let dt = S.info.x;
  let wave = S.info.z;
  let base = g * NODES;
  let rootRest = (P.M * vec4f(G.rest.xyz, 1.)).xyz;
  let n0 = normalize(P.N * G.nrm.xyz);

  // Soft-body inward skin dent along -n0 with damped spring rebound and smooth rim tilt.
  var phi = 0.;
  var gradPhi = vec3f(0.);
  let W = pc.b.z;
  for (var c = 0u; c < ${NC}u; c++) {
    if ((pc.m.x & (1u << c)) == 0u) { continue; }
    let h = capHit(rootRest, S.caps[c]);
    let pen = .35 * cSelf + capThick(c) - h.d;
    var f = 0.;
    var df = 0.;
    if (pen >= W) {
      f = pen;
      df = 1.;
    } else if (pen > -W) {
      f = (pen + W) * (pen + W) / (4. * W);
      df = (pen + W) / (2. * W);
    }
    if (f > phi) {
      phi = f;
      gradPhi = -h.g * df;
    }
  }
  let maxDent = pc.a.w;
  phi = min(phi, maxDent);
  let dd = D[g];
  var dn = dd.x + (dd.x - dd.y) * (1. - pc.b.y) - pc.b.x * dd.x;
  dn = clamp(max(dn, phi), -.38 * maxDent, maxDent);
  D[g] = vec4f(dn, dd.x, 0., 0.);

  var n = n0;
  if (phi > 1e-5) {
    let gT = gradPhi - n0 * dot(gradPhi, n0);
    n = normalize(n0 + gT * clamp(dn / phi, 0., 1.) * 1.35);
  }
  let skin = rootRest - n0 * dn;
  let skinPrev = X[base].xyz;
  X[base] = vec4f(skin, 0.);
  Xp[base] = vec4f(skinPrev, 0.);
  let vRoot = skin - skinPrev;

  // 240 Hz Verlet guide nodes with root-stiffened shape spring, inextensible follow-the-leader & collisions.
  var prevNode = skin;
  var prevRest = skin;
  var tipH = 0.;
  var restTipH = 1e-6;
  for (var j = 1u; j <= K; j++) {
    let hj = f32(j) / f32(K);
    let rest = restNode(skin, n, L, hj);
    let segL = length(rest - prevRest);
    let x = X[base + j].xyz;
    let xp = Xp[base + j].xyz;
    let v = x - xp;
    let vRel = (v - vRoot) * (1. - pc.a.z);
    var xn = x + vRoot + vRel - v * C.p.w + vec3f(0., -C.p.x * dt * dt, 0.);
    xn += (rest - xn) * pc.a.y * (1.25 - .5 * hj);
    var dir = xn - prevNode;
    if (dot(dir, dir) < 1e-14) { dir = rest - prevRest; }
    xn = prevNode + normalize(dir) * segL;

    for (var c = 0u; c < ${NC}u; c++) {
      if ((pc.m.y & (1u << c)) == 0u) { continue; }
      let cap = S.caps[c];
      if (capHit(skin, cap).d < -C.p.z * L) { continue; }
      let h = capHit(xn, cap);
      let pen = capThick(c) - h.d;
      if (pen > 0.) {
        xn += h.g * pen;
        let disp = mix(cap.da.xyz, cap.db.xyz, h.u);
        xn += (disp - h.g * dot(disp, h.g)) * C.q.x;
      }
    }

    let own = (pc.m.w >> 8u) & 255u;
    let dented = (pc.m.w & 2u) != 0u;
    for (var e = 0u; e < ${NE}u; e++) {
      if ((pc.m.z & (1u << e)) == 0u) { continue; }
      let he = ellHit(xn, S.ells[e], e);
      if (dented) {
        let ho = capHit(xn, S.caps[own]);
        let b = cSelf - ho.d;
        if (max(he.d, b) < 0.) {
          if (he.d >= b) { xn += he.g * (-he.d); } else { xn += ho.g * b; }
        }
      } else {
        if (ellHit(skin, S.ells[e], e).d < -C.p.z * L) { continue; }
        if (he.d < 0.) { xn += he.g * (-he.d); }
      }
    }

    if ((pc.m.w & 1u) != 0u) {
      let gy = groundY(xn.x, xn.z, wave) + .004;
      if (skin.y > groundY(skin.x, skin.z, wave) - .01 && xn.y < gy) {
        xn.y = gy;
        xn = vec3f(mix(xn.x, x.x, .5), xn.y, mix(xn.z, x.z, .5));
      }
    }

    let hgt = dot(xn - skin, n);
    let minH = pc.b.w * hj * L;
    if (hgt < minH) { xn += n * (minH - hgt); }
    Xp[base + j] = vec4f(x, 0.);
    X[base + j] = vec4f(xn, 0.);
    prevNode = xn;
    prevRest = rest;
    if (j == K) {
      tipH = dot(xn - skin, n);
      restTipH = max(dot(rest - skin, n), 1e-6);
    }
  }
  exportGuide(g, pi, n, clamp(1. - tipH / restTipH, 0., 1.), dn);
}`;
}

function scaleOfMatrix(m) {
  const e = m.elements;
  return (Math.hypot(e[0], e[1], e[2]) + Math.hypot(e[4], e[5], e[6]) + Math.hypot(e[8], e[9], e[10])) / 3;
}

function collectColliders(bear, probeCap) {
  const caps = [];
  const ells = [];
  const pushLimb = (obj, L) => {
    const M = obj.matrixWorld;
    const s = scaleOfMatrix(M);
    caps.push({
      a: new T.Vector3(0, L.ya, 0).applyMatrix4(M),
      b: new T.Vector3(0, L.yb, 0).applyMatrix4(M),
      ra: L.ra * s,
      rb: L.rb * s,
    });
  };
  for (const arm of bear.arms) {
    pushLimb(arm.shoulder, LIMBS.upperArm);
    pushLimb(arm.elbow, LIMBS.lowerArm);
  }
  for (const leg of bear.legs) pushLimb(leg.hip, LIMBS.leg);
  caps.push(probeCap);

  const pushEll = (obj, r) => ells.push({
    inv: obj.matrixWorld.clone().invert(),
    r,
    s: scaleOfMatrix(obj.matrixWorld),
  });
  pushEll(bear.torso, ELLIPSOIDS.body);
  pushEll(bear.head, ELLIPSOIDS.head);
  pushEll(bear.muzzle, ELLIPSOIDS.muzzle);
  return { caps, ells };
}

function cloneCaps(caps) {
  if (!caps) return null;
  return caps.map((c) => ({ a: c.a.clone(), b: c.b.clone(), ra: c.ra, rb: c.rb }));
}

// Attaches WebGPU guide-strand sampling (uSim, uSimBase, uSimOn) onto a plush bear instance's
// shell, fin and strand materials without modifying shared fur.js or bear.js modules.
function installSimShaderBridge(bear) {
  const quantKey = (x, y, z) => `${Math.round(x * 1e5)},${Math.round(y * 1e5)},${Math.round(z * 1e5)}`;

  for (const fp of bear.furParts) {
    fp.key = ID_TO_KEY[fp.id] || `part${fp.id}`;
    fp.uniforms.uSim = { value: null };
    fp.uniforms.uSimBase = { value: 0 };
    fp.uniforms.uSimOn = { value: 0 };

    const basePos = fp.base.geometry.attributes.position;
    const vMap = new Map();
    for (let i = 0; i < basePos.count; i++) {
      vMap.set(quantKey(basePos.getX(i), basePos.getY(i), basePos.getZ(i)), i);
    }

    if (fp.fins) {
      const fPos = fp.fins.geometry.attributes.position;
      const finVids = new Float32Array(fPos.count);
      for (let i = 0; i < fPos.count; i++) {
        finVids[i] = vMap.get(quantKey(fPos.getX(i), fPos.getY(i), fPos.getZ(i))) ?? 0;
      }
      fp.fins.geometry.setAttribute('aSimVid', new T.BufferAttribute(finVids, 1));
    }

    if (fp.strands) {
      const roots = fp.strands.geometry.attributes.iRoot;
      const nInst = roots.count;
      const strandVids = new Float32Array(nInst);
      const strandRest = new Float32Array(nInst * 3);
      for (let i = 0; i < nInst; i++) {
        const rx = roots.getX(i), ry = roots.getY(i), rz = roots.getZ(i);
        let best = 0, bestD2 = Infinity;
        // Fast stride scan + local refinement keeps init < 2 ms across all parts.
        const step = Math.max(1, Math.floor(basePos.count / 180));
        for (let j = 0; j < basePos.count; j += step) {
          const dx = basePos.getX(j) - rx, dy = basePos.getY(j) - ry, dz = basePos.getZ(j) - rz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < bestD2) { bestD2 = d2; best = j; }
        }
        const lo = Math.max(0, best - step * 2), hi = Math.min(basePos.count - 1, best + step * 2);
        for (let j = lo; j <= hi; j++) {
          const dx = basePos.getX(j) - rx, dy = basePos.getY(j) - ry, dz = basePos.getZ(j) - rz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < bestD2) { bestD2 = d2; best = j; }
        }
        strandVids[i] = best;
        strandRest[i * 3] = basePos.getX(best);
        strandRest[i * 3 + 1] = basePos.getY(best);
        strandRest[i * 3 + 2] = basePos.getZ(best);
      }
      fp.strands.geometry.setAttribute('iSimVid', new T.InstancedBufferAttribute(strandVids, 1));
      fp.strands.geometry.setAttribute('iSimRest', new T.InstancedBufferAttribute(strandRest, 3));
    }

    const patchMat = (mat, tag) => {
      if (!mat) return;
      const prevCompile = mat.onBeforeCompile;
      mat.onBeforeCompile = (shader, renderer) => {
        prevCompile?.call(mat, shader, renderer);
        shader.uniforms.uSim = fp.uniforms.uSim;
        shader.uniforms.uSimBase = fp.uniforms.uSimBase;
        shader.uniforms.uSimOn = fp.uniforms.uSimOn;

        const simHeader = /* glsl */`
uniform highp sampler2D uSim;
uniform int uSimBase;
uniform float uSimOn;
varying float vSimComp;
#ifdef FUR_FIN
attribute float aSimVid;
#endif
#ifdef FUR_STRAND
attribute float iSimVid;
attribute vec3 iSimRest;
#endif
int furSimVid() {
  #if defined(FUR_FIN)
    return int(aSimVid + 0.5);
  #elif defined(FUR_STRAND)
    return int(iSimVid + 0.5);
  #else
    return gl_VertexID;
  #endif
}
vec4 furSimNode(int j) {
  int idx = (uSimBase + furSimVid()) * ${NODES} + j;
  return texelFetch(uSim, ivec2(idx % ${SIMW}, idx / ${SIMW}), 0);
}
`;
        shader.vertexShader = simHeader + '\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          `#ifdef FUR_STRAND
vec3 objectNormal = normalize(iNormal);
#else
vec3 objectNormal = vec3(normal);
#endif`,
          `#ifdef FUR_STRAND
vec3 objectNormal = normalize(iNormal);
#else
vec3 objectNormal = vec3(normal);
#endif
vec4 furS0 = vec4(0.0), furS1 = vec4(0.0), furS2 = vec4(0.0), furS3 = vec4(0.0), furS4 = vec4(0.0);
if (uSimOn > 0.5) {
  furS0 = furSimNode(0); furS1 = furSimNode(1); furS2 = furSimNode(2); furS3 = furSimNode(3); furS4 = furSimNode(4);
  vec3 simDN = vec3(furS0.w, furS1.w, furS2.w);
  if (dot(simDN, simDN) > 1e-6) objectNormal = normalize(simDN);
}`,
        );
        shader.vertexShader = shader.vertexShader.replace(
          'vH = furH; vBase = furP; vBaseN = furN;',
          `if (uSimOn > 0.5) furN = objectNormal;
vH = furH; vBase = furP; vBaseN = furN;`,
        );

        const simReplaceTarget = 'vFurT = normalize(mat3(modelViewMatrix) * normalize(furN + 2. * furBend * min(furH, 1.)));';
        const simDisplace = /* glsl */`
vFurT = normalize(mat3(modelViewMatrix) * normalize(furN + 2. * furBend * min(furH, 1.)));
vSimComp = 0.0;
if (uSimOn > 0.5) {
  float hClamp = clamp(furH, 0.0, 1.45);
  float fk = min(hClamp, 1.0) * 4.0;
  vec3 simP = fk < 1.0 ? mix(furS0.xyz, furS1.xyz, fk)
            : fk < 2.0 ? mix(furS1.xyz, furS2.xyz, fk - 1.0)
            : fk < 3.0 ? mix(furS2.xyz, furS3.xyz, fk - 2.0)
            : mix(furS3.xyz, furS4.xyz, fk - 3.0);
  vec3 segTan = furS4.xyz - furS3.xyz;
  if (hClamp > 1.0) simP += segTan * ((hClamp - 1.0) * 4.0);
  vec3 simJaw = vec3(0.0);
  #ifdef FUR_JAW
    { float jw = furJawW(furP); simJaw = vec3(0.0, -uJaw.z, -uJaw.z * uJawB.z) * jw; }
  #endif
  #ifdef FUR_STRAND
    vec3 skinBase = furS0.xyz + (furP - iSimRest) + simJaw;
    vec3 guideVec = (simP - furS0.xyz) * furM + iTan * iRand.y * furH2 * uLen * furM;
    transformed = skinBase + guideVec;
  #else
    vec3 skinBase = furS0.xyz + simJaw;
    vec3 guideVec = (simP - furS0.xyz) * furM;
    float minSep = 0.05 * furH * uLen * furM;
    float curSep = dot(guideVec, objectNormal);
    transformed = skinBase + guideVec + objectNormal * max(0.0, minSep - curSep);
  #endif
  vec3 guideDir = fk < 1.0 ? (furS1.xyz - furS0.xyz) : (simP - furS0.xyz);
  if (dot(guideDir, guideDir) > 1e-8) {
    vFurT = normalize(mat3(modelViewMatrix) * normalize(guideDir));
  }
  vSimComp = clamp(furS3.w, 0.0, 1.0);
}`;
        shader.vertexShader = shader.vertexShader.replace(simReplaceTarget, simDisplace);

        shader.fragmentShader = 'varying float vSimComp;\n' + shader.fragmentShader.replace(
          'diffuseColor.rgb = furCol;',
          'furCol *= 1.0 - 0.24 * clamp(vSimComp, 0.0, 1.0);\n  diffuseColor.rgb = furCol;',
        );
      };
      const prevKey = mat.customProgramCacheKey?.bind(mat);
      mat.customProgramCacheKey = () => `${prevKey ? prevKey() : 'fur'}-wgpu-${tag}`;
      mat.needsUpdate = true;
    };

    patchMat(fp.material, 'shell');
    patchMat(fp.fins?.material, 'fin');
    patchMat(fp.strands?.material, 'strand');
  }
}

// Builds a soft studio plush-tester cushion wand mesh with rounded capsule handle that presses into the belly.
function createTactileProbeMesh() {
  const root = new T.Group();
  const tipMat = new T.MeshPhysicalMaterial({
    color: '#fbf3e4',
    roughness: 0.72,
    sheen: 0.9,
    sheenColor: new T.Color('#ffffff'),
    sheenRoughness: 0.45,
    clearcoat: 0.12,
  });
  const collarMat = new T.MeshStandardMaterial({ color: '#d7a24b', roughness: 0.34, metalness: 0.78 });
  const shaftMat = new T.MeshStandardMaterial({ color: '#6b4735', roughness: 0.50, metalness: 0.08 });

  const tip = new T.Mesh(new T.SphereGeometry(0.115, 32, 24), tipMat);
  tip.castShadow = true;
  tip.receiveShadow = true;
  root.add(tip);

  const collar = new T.Mesh(new T.CylinderGeometry(0.046, 0.058, 0.046, 24), collarMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.z = 0.106;
  collar.castShadow = true;
  root.add(collar);

  const shaft = new T.Mesh(new T.CapsuleGeometry(0.035, 0.48, 8, 20), shaftMat);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.37;
  shaft.castShadow = true;
  root.add(shaft);

  return {
    root,
    dispose() {
      root.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    },
  };
}

// Hardware WebGPU 240 Hz Verlet fur simulator with 0.5 s GPU state checkpoints.
async function tryCreateWebGPUSim(bear, poseFast, groundWave, params = {}) {
  if (typeof navigator === 'undefined' || !navigator.gpu) return null;
  let adapter = null;
  try {
    adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  if (!adapter || adapter.isFallbackAdapter || adapter.info?.isFallbackAdapter) return null;

  let device = null;
  try {
    device = await adapter.requestDevice();
  } catch {
    return null;
  }

  let lost = null;
  device.lost.then((info) => { lost = info?.message || 'device lost'; });
  device.addEventListener?.('uncapturederror', (e) => { lost = lost || e.error?.message || 'uncaptured WebGPU error'; });

  const P = { ...SIM_PARAMS, ...params };
  const parts = bear.furParts;
  const counts = parts.map((fp) => fp.base.geometry.attributes.position.count);
  const NG = counts.reduce((a, b) => a + b, 0);
  const guideData = new Float32Array(NG * 8);
  let gi = 0;
  parts.forEach((fp, pi) => {
    const pos = fp.base.geometry.attributes.position;
    const nor = fp.base.geometry.attributes.normal;
    const L = fp.uniforms.uLen.value;
    fp.uniforms.uSimBase.value = gi;
    for (let i = 0; i < pos.count; i++, gi++) {
      guideData.set([pos.getX(i), pos.getY(i), pos.getZ(i), pi, nor.getX(i), nor.getY(i), nor.getZ(i), L], gi * 8);
    }
  });

  const cfg = new ArrayBuffer(NP * 48 + 32 + 32);
  const cf = new Float32Array(cfg);
  const cu = new Uint32Array(cfg);
  parts.forEach((fp, pi) => {
    const c = PART_CFG[fp.key] || {};
    cf.set([P.c, P.kShape, P.dInt, c.maxDent || 0, P.skinK, P.skinDamp, P.rim, P.minH], pi * 12);
    cu.set([c.skin || 0, c.furCaps || 0, c.furElls || 0, (c.ground ? 1 : 0) | (c.dented ? 2 : 0) | ((c.own ?? 0) << 8)], pi * 12 + 8);
  });
  const armThick = P.c * (parts.find((p) => p.key === 'lowerArmR')?.uniforms.uLen.value ?? 0.044);
  const legThick = P.c * (parts.find((p) => p.key === 'legR')?.uniforms.uLen.value ?? 0.045);
  const probeThick = 0.012;
  cf.set([armThick, armThick, armThick, armThick, legThick, legThick, probeThick, 0], NP * 12);
  cf.set([P.gravity, P.groom, P.bury, P.dAir, P.friction, 0, 0, 0], NP * 12 + 8);

  const U = GPUBufferUsage;
  const makeBuf = (size, usage, initBytes = null) => {
    const b = device.createBuffer({ size, usage, mappedAtCreation: !!initBytes });
    if (initBytes) {
      new Uint8Array(b.getMappedRange()).set(new Uint8Array(initBytes.buffer || initBytes));
      b.unmap();
    }
    return b;
  };

  const stateBytes = NG * NODES * 16;
  const dentBytes = NG * 16;
  const stepBuf = makeBuf(STRIDE * MAXB, U.UNIFORM | U.COPY_DST);
  const cfgBuf = makeBuf(cfg.byteLength, U.UNIFORM, cfg);
  const guideBuf = makeBuf(guideData.byteLength, U.STORAGE, guideData);
  const X = makeBuf(stateBytes, U.STORAGE | U.COPY_SRC | U.COPY_DST);
  const Xp = makeBuf(stateBytes, U.STORAGE | U.COPY_SRC | U.COPY_DST);
  const D = makeBuf(dentBytes, U.STORAGE | U.COPY_SRC | U.COPY_DST);
  const Out = makeBuf(stateBytes, U.STORAGE | U.COPY_SRC | U.COPY_DST);
  const readBuf = makeBuf(stateBytes, U.MAP_READ | U.COPY_DST);

  const module = device.createShaderModule({ code: buildWGSL(NG) });
  if (module.getCompilationInfo) {
    const info = await module.getCompilationInfo();
    if (info.messages.some((m) => m.type === 'error')) {
      device.destroy();
      return null;
    }
  }

  const layout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: STEP_BYTES } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      ...[3, 4, 5, 6].map((binding) => ({ binding, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } })),
    ],
  });
  const pipeLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
  const [initP, stepP] = await Promise.all(
    ['init', 'step'].map((entryPoint) => device.createComputePipelineAsync({ layout: pipeLayout, compute: { module, entryPoint } })),
  );
  const bind = device.createBindGroup({
    layout,
    entries: [
      { binding: 0, resource: { buffer: stepBuf, size: STEP_BYTES } },
      { binding: 1, resource: { buffer: cfgBuf } },
      { binding: 2, resource: { buffer: guideBuf } },
      { binding: 3, resource: { buffer: X } },
      { binding: 4, resource: { buffer: Xp } },
      { binding: 5, resource: { buffer: D } },
      { binding: 6, resource: { buffer: Out } },
    ],
  });

  const rows = Math.ceil((NG * NODES) / SIMW);
  const texData = new Float32Array(SIMW * rows * 4);
  const texture = new T.DataTexture(texData, SIMW, rows, T.RGBAFormat, T.FloatType);
  texture.minFilter = texture.magFilter = T.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  for (const fp of parts) {
    fp.uniforms.uSim.value = texture;
    fp.uniforms.uSimOn.value = 1;
  }

  const slices = new ArrayBuffer(STRIDE * MAXB);
  const sf = new Float32Array(slices);
  const nm = new T.Matrix3();
  const inv = new T.Matrix4();
  const groups = Math.ceil(NG / 64);

  let prevCaps = null;
  let cur = -1;
  const checkpoints = new Map(); // stepIndex (multiple of 120 = 0.5 s) -> { X, Xp, D, Out, prevCaps }

  function packSlot(slot, tau, stepIdx, pointerProbe) {
    const probeCap = poseFast(tau, pointerProbe);
    const o = (slot * STRIDE) / 4;
    parts.forEach((fp, i) => {
      const M = fp.group.matrixWorld;
      const b = o + i * 44;
      sf.set(M.elements, b);
      sf.set(inv.copy(M).invert().elements, b + 16);
      const n = nm.getNormalMatrix(M).elements;
      sf.set([n[0], n[1], n[2], 0, n[3], n[4], n[5], 0, n[6], n[7], n[8], 0], b + 32);
    });
    const { caps, ells } = collectColliders(bear, probeCap);
    const cb = o + NP * 44;
    caps.forEach((c, i) => {
      const p = prevCaps?.[i] || c;
      const b = cb + i * 16;
      sf.set([
        c.a.x, c.a.y, c.a.z, c.ra,
        c.b.x, c.b.y, c.b.z, c.rb,
        c.a.x - p.a.x, c.a.y - p.a.y, c.a.z - p.a.z, 0,
        c.b.x - p.b.x, c.b.y - p.b.y, c.b.z - p.b.z, 0,
      ], b);
    });
    prevCaps = caps;
    const eb = cb + NC * 16;
    ells.forEach((e, i) => {
      sf.set(e.inv.elements, eb + i * 20);
      sf.set([e.r[0], e.r[1], e.r[2], e.s], eb + i * 20 + 16);
    });
    sf.set([1 / SPS, stepIdx, groundWave ? 1 : 0, 0], eb + NE * 20);
  }

  function submitBatch(list) {
    const maxSlot = list.reduce((m, item) => Math.max(m, item[1]), 0);
    device.queue.writeBuffer(stepBuf, 0, slices, 0, (maxSlot + 1) * STRIDE);
    const enc = device.createCommandEncoder();
    const pass = enc.beginComputePass();
    for (const [pipe, slot] of list) {
      pass.setPipeline(pipe);
      pass.setBindGroup(0, bind, [slot * STRIDE]);
      pass.dispatchWorkgroups(groups);
    }
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  function saveCheckpoint(stepIdx) {
    if (checkpoints.has(stepIdx)) return;
    const cp = {
      X: makeBuf(stateBytes, U.COPY_SRC | U.COPY_DST),
      Xp: makeBuf(stateBytes, U.COPY_SRC | U.COPY_DST),
      D: makeBuf(dentBytes, U.COPY_SRC | U.COPY_DST),
      Out: makeBuf(stateBytes, U.COPY_SRC | U.COPY_DST),
      prevCaps: cloneCaps(prevCaps),
    };
    const enc = device.createCommandEncoder();
    enc.copyBufferToBuffer(X, 0, cp.X, 0, stateBytes);
    enc.copyBufferToBuffer(Xp, 0, cp.Xp, 0, stateBytes);
    enc.copyBufferToBuffer(D, 0, cp.D, 0, dentBytes);
    enc.copyBufferToBuffer(Out, 0, cp.Out, 0, stateBytes);
    device.queue.submit([enc.finish()]);
    checkpoints.set(stepIdx, cp);
  }

  function restoreCheckpoint(stepIdx) {
    const cp = checkpoints.get(stepIdx);
    const enc = device.createCommandEncoder();
    enc.copyBufferToBuffer(cp.X, 0, X, 0, stateBytes);
    enc.copyBufferToBuffer(cp.Xp, 0, Xp, 0, stateBytes);
    enc.copyBufferToBuffer(cp.D, 0, D, 0, dentBytes);
    enc.copyBufferToBuffer(cp.Out, 0, Out, 0, stateBytes);
    device.queue.submit([enc.finish()]);
    prevCaps = cloneCaps(cp.prevCaps);
    cur = stepIdx;
  }

  function ensureZeroCheckpoint() {
    if (checkpoints.has(0)) return;
    prevCaps = null;
    packSlot(0, 0, 0, null);
    submitBatch([[initP, 0], ...Array.from({ length: PREROLL }, () => [stepP, 0])]);
    cur = 0;
    saveCheckpoint(0);
  }

  const stats = { guides: NG, checkpoints: 0, lastSteps: 0, resets: 0 };

  async function advanceTo(t, pointerProbe = null) {
    if (lost) throw new Error(lost);
    const target = Math.max(0, Math.round(t * SPS));

    if (!pointerProbe) {
      ensureZeroCheckpoint();
      let bestCp = 0;
      for (const k of checkpoints.keys()) {
        if (k <= target && k > bestCp) bestCp = k;
      }
      if (cur < 0 || target < cur || bestCp > cur) {
        restoreCheckpoint(bestCp);
        stats.resets++;
      }
      let stepsRun = 0;
      while (cur < target) {
        const nextBoundary = (Math.floor(cur / CHECKPOINT_STEPS) + 1) * CHECKPOINT_STEPS;
        const end = Math.min(target, nextBoundary, cur + MAXB);
        const n = end - cur;
        const list = [];
        for (let i = 0; i < n; i++) {
          const s = cur + 1 + i;
          packSlot(i, s / SPS, s, null);
          list.push([stepP, i]);
        }
        submitBatch(list);
        cur = end;
        stepsRun += n;
        if (cur % CHECKPOINT_STEPS === 0) saveCheckpoint(cur);
      }
      stats.checkpoints = checkpoints.size;
      stats.lastSteps = stepsRun;
    } else {
      // Live interactive pointer drag steps forward smoothly without polluting deterministic checkpoints.
      if (cur < 0) {
        ensureZeroCheckpoint();
        restoreCheckpoint(0);
      }
      packSlot(0, t, cur + 1, pointerProbe);
      submitBatch([[stepP, 0], [stepP, 0], [stepP, 0], [stepP, 0]]);
      cur = -1; // next scripted frame(t) restores cleanly from nearest 0.5 s checkpoint
    }

    const enc = device.createCommandEncoder();
    enc.copyBufferToBuffer(Out, 0, readBuf, 0, stateBytes);
    device.queue.submit([enc.finish()]);
    await readBuf.mapAsync(GPUMapMode.READ);
    texData.set(new Float32Array(readBuf.getMappedRange(), 0, NG * NODES * 4));
    readBuf.unmap();
    texture.needsUpdate = true;
  }

  function fingerprint() {
    let h = 0x811c9dc5;
    const b = new Uint8Array(texData.buffer, 0, stateBytes);
    for (let i = 0; i < b.length; i++) {
      h ^= b[i];
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  function dispose() {
    for (const cp of checkpoints.values()) {
      cp.X.destroy(); cp.Xp.destroy(); cp.D.destroy(); cp.Out.destroy();
    }
    checkpoints.clear();
    for (const b of [stepBuf, cfgBuf, guideBuf, X, Xp, D, Out, readBuf]) b.destroy();
    texture.dispose();
    device.destroy();
  }

  return { backend: 'webgpu', advanceTo, stats, fingerprint, dispose };
}

// Deterministic 240 Hz CPU Verlet + 0.5 s checkpoint fallback driving Three.js WebGL2 FUR_SOFT dents & fur inertia
// when navigator.gpu is unavailable (zero uncaught errors, 100% deterministic frame(t)).
function createWebGLFallbackSim(bear, poseFast) {
  for (const fp of bear.furParts) fp.uniforms.uSimOn.value = 0;
  const headFur = bear.furParts.find((p) => p.id === 0);
  const bodyFur = bear.furParts.find((p) => p.id === 2);

  const checkpoints = new Map();
  const makeState = () => ({
    bellyDent: 0,
    bellyPrev: 0,
    cheekDent: 0,
    cheekPrev: 0,
    partPos: bear.furParts.map(() => new T.Vector3()),
    partVel: bear.furParts.map(() => new T.Vector3()),
    tipOff: bear.furParts.map(() => new T.Vector3()),
    tipPrev: bear.furParts.map(() => new T.Vector3()),
    inited: false,
  });
  const cloneState = (s) => ({
    bellyDent: s.bellyDent,
    bellyPrev: s.bellyPrev,
    cheekDent: s.cheekDent,
    cheekPrev: s.cheekPrev,
    partPos: s.partPos.map((v) => v.clone()),
    partVel: s.partVel.map((v) => v.clone()),
    tipOff: s.tipOff.map((v) => v.clone()),
    tipPrev: s.tipPrev.map((v) => v.clone()),
    inited: s.inited,
  });

  let cur = -1;
  let state = makeState();
  const tmpW = new T.Vector3();
  const tmpLocal = new T.Vector3();

  function stepOnce(tau, pointerProbe) {
    const probe = poseFast(tau, pointerProbe);
    if (!state.inited) {
      bear.furParts.forEach((fp, i) => fp.group.getWorldPosition(state.partPos[i]));
      state.inited = true;
    }

    // Measure probe penetration into belly in torso local space
    tmpLocal.copy(probe.a).applyMatrix4(bear.torso.matrixWorld.clone().invert());
    const dBelly = Math.hypot(tmpLocal.x / 0.47, tmpLocal.y / 0.5, tmpLocal.z / 0.41);
    const penBelly = clamp((1.0 - dBelly) * 0.44 + probe.ra * 0.55, 0, 0.105);

    const nextBelly = clamp(
      Math.max(penBelly, state.bellyDent + (state.bellyDent - state.bellyPrev) * 0.922 - 0.018 * state.bellyDent),
      -0.035,
      0.105,
    );
    state.bellyPrev = state.bellyDent;
    state.bellyDent = nextBelly;

    // Right paw cheek rub penetration
    const rubEnv = env(tau % PERIOD, 0.12, 1.18, 0.22, 0.25) * 0.055;
    const nextCheek = clamp(
      Math.max(rubEnv, state.cheekDent + (state.cheekDent - state.cheekPrev) * 0.92 - 0.02 * state.cheekDent),
      -0.022,
      0.068,
    );
    state.cheekPrev = state.cheekDent;
    state.cheekDent = nextCheek;

    bear.furParts.forEach((fp, i) => {
      fp.group.getWorldPosition(tmpW);
      state.partVel[i].copy(tmpW).sub(state.partPos[i]);
      state.partPos[i].copy(tmpW);

      const x = state.tipOff[i];
      const xp = state.tipPrev[i];
      const vx = (x.x - xp.x) * 0.89 - state.partVel[i].x * 0.42 - x.x * 0.032;
      const vy = (x.y - xp.y) * 0.89 - state.partVel[i].y * 0.42 - (x.y + 0.36) * 0.032;
      const vz = (x.z - xp.z) * 0.89 - state.partVel[i].z * 0.42 - x.z * 0.032;
      xp.copy(x);
      x.set(clamp(x.x + vx, -0.95, 0.95), clamp(x.y + vy, -1.05, 0.85), clamp(x.z + vz, -0.95, 0.95));
    });
  }

  function ensureZero() {
    if (checkpoints.has(0)) return;
    state = makeState();
    for (let i = 0; i < PREROLL; i++) stepOnce(0, null);
    cur = 0;
    checkpoints.set(0, cloneState(state));
  }

  async function advanceTo(t, pointerProbe = null) {
    const target = Math.max(0, Math.round(t * SPS));
    if (!pointerProbe) {
      ensureZero();
      let bestCp = 0;
      for (const k of checkpoints.keys()) if (k <= target && k > bestCp) bestCp = k;
      if (cur < 0 || target < cur || bestCp > cur) {
        state = cloneState(checkpoints.get(bestCp));
        cur = bestCp;
      }
      while (cur < target) {
        cur++;
        stepOnce(cur / SPS, null);
        if (cur % CHECKPOINT_STEPS === 0 && !checkpoints.has(cur)) {
          checkpoints.set(cur, cloneState(state));
        }
      }
    } else {
      stepOnce(t, pointerProbe);
      cur = -1;
    }

    // Apply soft-body dent deformers & Verlet fur force onto the Three.js WebGL2 plush shader
    if (bodyFur) {
      const probe = poseFast(t, pointerProbe);
      tmpLocal.copy(probe.a).applyMatrix4(bear.torso.matrixWorld.clone().invert());
      bodyFur.uniforms.uDefC.value[5].set(clamp(tmpLocal.x, -0.25, 0.25), clamp(tmpLocal.y, -0.25, 0.25), 0.36, 0.16);
      bodyFur.uniforms.uDefD.value[5].set(0, 0, 0, -state.bellyDent * 1.15);
    }
    if (headFur) {
      headFur.uniforms.uDefC.value[4].set(-0.28, -0.14, 0.38, 0.15);
      headFur.uniforms.uDefD.value[4].set(0, 0, 0, -state.cheekDent * 1.15);
    }
    bear.setFurForce((fp) => {
      const idx = bear.furParts.indexOf(fp);
      return state.tipOff[idx] || new T.Vector3(0, -0.36, 0);
    });
  }

  function fingerprint() {
    const v = `${state.bellyDent.toFixed(6)}|${state.cheekDent.toFixed(6)}|${state.tipOff[0]?.y.toFixed(6) ?? '0'}`;
    let h = 0x811c9dc5;
    for (let i = 0; i < v.length; i++) {
      h ^= v.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }

  return { backend: 'webgl2-cpu-verlet', advanceTo, stats: { checkpoints: checkpoints.size }, fingerprint, dispose() { checkpoints.clear(); } };
}

// Pure 2D Canvas emergency fallback if WebGL2 context creation itself is unavailable.
function createCanvasEmergencyFallback(W, H) {
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');
  function frame(seconds) {
    const t = (((seconds % PERIOD) + PERIOD) % PERIOD);
    const press = env(t, 1.45, 2.8, 0.3, 0.25);
    const hop = t > 3.4 && t < 4.0 ? Math.sin(((t - 3.4) / 0.6) * Math.PI) * 34 : 0;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#16343a');
    g.addColorStop(1, '#0b181d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W * 0.5, H * 0.58 - hop);
    ctx.fillStyle = '#c48e5c';
    ctx.beginPath(); ctx.ellipse(0, 60, 128 + press * 14, 134 - press * 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5e6cc';
    ctx.beginPath(); ctx.ellipse(0, 72, 78 - press * 8, 86 - press * 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c48e5c';
    ctx.beginPath(); ctx.ellipse(0, -98, 124, 106, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return out;
  }
  frame(0);
  return { canvas: out, frame, backend: 'canvas2d', proof: () => ({ backend: 'canvas2d' }), dispose() {} };
}

export async function createPlushWebGPU(options = {}) {
  const W = options.width || 1280;
  const H = options.height || 720;
  const set = options.set || 'bedroom';

  let stage = null;
  let photo = null;
  try {
    photo = await loadPhotoSet();
    stage = createStage({ width: W, height: H, set, exposure: 1.05 });
  } catch {
    return createCanvasEmergencyFallback(W, H);
  }

  // Boost rim lights so Kajiya-Kay fur tips & parted dent crowns read vividly.
  if (stage.lights.rim) stage.lights.rim.intensity = set === 'bedroom' ? 4.4 : 5.4;
  if (stage.lights.rim2) stage.lights.rim2.intensity = set === 'bedroom' ? 2.6 : 3.6;

  const bear = createPlushBear({ features: options.features ?? 'all', photo, viewHeight: H });
  installSimShaderBridge(bear);
  stage.scene.add(bear.root);
  stage.addContact(bear.shared);

  const probeMesh = createTactileProbeMesh();
  stage.scene.add(probeMesh.root);

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');

  // Scripted 6.0 s tactile performance:
  // 0.0–1.25 s: right paw rubs left cheek/muzzle (cheek dent + friction drag)
  // 1.35–2.85 s: studio presser + left paw press deep dimples into cream belly (hero = 2.6 s!), then spring back
  // 3.35–4.55 s: joyful hop + landing squash & 240 Hz Verlet crown/ear inertia bounce
  // 4.65–6.00 s: cozy chest pat & calm settle to loop origin
  function scriptedProbe(t) {
    const approach = env(t, 1.30, 2.86, 0.34, 0.24);
    const deep = env(t, 1.68, 2.72, 0.28, 0.16);
    const swirlX = 0.028 * Math.sin((t - 1.6) * 5.2) * deep;
    const swirlY = 0.022 * Math.cos((t - 1.6) * 5.2) * deep;
    const px = lerp(0.68, 0.125 + swirlX, approach);
    const py = lerp(0.58, 0.43 + swirlY, approach);
    const pz = lerp(1.08, 0.34 - 0.092 * deep, approach);
    const a = new T.Vector3(px, py, pz);
    const b = new T.Vector3(px + 0.17, py - 0.02, pz + 0.26);
    return { a, b, ra: 0.115, rb: 0.094, visible: approach > 0.005, approach, deep };
  }

  function performance(t, fastOnly = false) {
    const p = { head: {}, face: {}, arms: [{}, {}], ears: [{}, {}], legs: [{}, {}] };
    const f = p.face;
    const h = p.head;

    const loopPhase = (t * Math.PI * 2) / PERIOD;
    p.squash = 0.012 * Math.sin(loopPhase * 2);
    p.tilt = 0.016 * Math.sin(loopPhase);
    h.nod = 0.02 * Math.sin(loopPhase * 2 + 0.7);
    h.roll = 0.025 * Math.sin(loopPhase);
    f.smile = 0.48;

    // Beat 1 (0.10 - 1.25 s): Cheek rub & muzzle press
    const rub = env(t, 0.08, 1.25, 0.22, 0.28);
    h.roll += -0.14 * rub;
    h.turn = -0.14 * rub;
    p.lean = 0.06 * rub;

    // Beat 2 (1.35 - 2.95 s): Curious belly press & rebound watch (hero at 2.6 s)
    const watch = env(t, 1.32, 3.05, 0.32, 0.28);
    const pressPeak = env(t, 1.65, 2.75, 0.26, 0.18);
    h.nod += 0.22 * watch;
    h.turn = (h.turn || 0) + 0.08 * watch;
    p.lean = (p.lean || 0) - 0.03 * pressPeak;
    p.squash += 0.022 * pressPeak;

    // Beat 3 (3.35 - 4.65 s): Hop & landing Verlet inertia bounce
    const hopT0 = 3.42, hopLand = 3.98;
    const prep = env(t, 3.22, 3.46, 0.10, 0.08);
    if (t > hopT0 && t < hopLand) {
      const u = (t - hopT0) / (hopLand - hopT0);
      p.hop = 0.18 * 4 * u * (1 - u);
    }
    const landBounce = springWave(t, hopLand, 2.4, 5.8);
    p.squash += 0.055 * prep + 0.165 * Math.max(0, landBounce) - 0.065 * Math.max(0, -landBounce);
    const cheer = env(t, 3.38, 4.55, 0.18, 0.32);
    h.nod -= 0.09 * cheer;
    p.ears[0].perk = 0.48 * cheer + 0.32 * Math.max(0, landBounce);
    p.ears[1].perk = 0.52 * cheer + 0.32 * Math.max(0, landBounce);
    p.ears[0].flop = 0.30 * Math.max(0, -landBounce);
    p.ears[1].flop = 0.30 * Math.max(0, -landBounce);

    // Beat 4 (4.65 - 5.85 s): Cozy chest pat & settle
    const pat = env(t, 4.65, 5.72, 0.25, 0.32);
    p.tilt += 0.04 * pat * Math.sin((t - 4.65) * 9.0);

    // Layered arm IK targets (index 0 = bear's right arm -x, index 1 = bear's left arm +x)
    const restR = [-0.5, -0.12, 0.2];
    const restL = [0.5, -0.12, 0.2];
    const armLayers = [
      // Cheek rub: right paw presses into bear's right/front cheek & muzzle
      [rub, [-0.27 + 0.025 * Math.cos(t * 8.5), 0.56 + 0.025 * Math.sin(t * 8.5), 0.46], restL, [1, 0.2, -0.45], [0, 0, 1]],
      // Belly press: right paw presses left belly while studio probe presses right belly; left arm stays open
      [watch, [-0.16, -0.07, 0.43], [0.48, 0.04, 0.28], [0.25, 0.1, -1], [0.2, 0.2, 1]],
      // Hop cheer: arms flung wide joyfully
      [cheer, [-0.56, 0.48, 0.22], [0.56, 0.48, 0.22], [0, 0, 1], [0, 0, 1]],
      // Cozy pat: both paws pat chest gently
      [pat, [-0.15, 0.08 + 0.02 * Math.sin(t * 12), 0.43], [0.15, 0.08 - 0.02 * Math.sin(t * 12), 0.43], [0.4, 0, -1], [-0.4, 0, -1]],
    ];

    let wSum = 0;
    const tR = [0, 0, 0], tL = [0, 0, 0], pR = [0, 0, 0], pL = [0, 0, 0];
    for (const [w, r, l, pr, pl] of armLayers) {
      if (w > 0) {
        wSum += w;
        for (let j = 0; j < 3; j++) {
          tR[j] += r[j] * w; tL[j] += l[j] * w;
          pR[j] += pr[j] * w; pL[j] += pl[j] * w;
        }
      }
    }
    const rw = Math.max(0, 1 - wSum);
    const tot = wSum + rw;
    const pNorm = Math.max(1e-4, wSum);
    p.arms[0] = { target: tR.map((v, j) => (v + restR[j] * rw) / tot), palm: wSum > 0.01 ? pR.map((v) => v / pNorm) : [0, 0, 1], pole: [-0.4, 0.3, -1] };
    p.arms[1] = { target: tL.map((v, j) => (v + restL[j] * rw) / tot), palm: wSum > 0.01 ? pL.map((v) => v / pNorm) : [0, 0, 1], pole: [0.4, 0.3, -1] };

    p.legs[0].lift = 0.11 * cheer;
    p.legs[1].lift = 0.11 * cheer;

    if (!fastOnly) {
      f.happy = Math.max(0.75 * rub, 0.9 * cheer);
      f.blush = Math.max(0.35 * rub, 0.45 * pressPeak, 0.5 * cheer);
      f.gazeY = -0.85 * watch;
      f.gazeX = 0.22 * watch - 0.25 * rub;
      f.brow = 0.45 * watch + 0.55 * cheer;
      f.smile = Math.max(0.48, 0.85 * pressPeak, 0.95 * cheer);
      for (const b of [1.22, 3.12, 5.55]) {
        f.blink = Math.max(f.blink || 0, Math.exp(-(((t - b) / 0.065) ** 2)));
      }
      f.mouth = cheer > 0.45 ? VISEMES.D : pressPeak > 0.4 ? VISEMES.C : VISEMES.X;
    } else {
      f.mouth = VISEMES.X;
    }

    return p;
  }

  function poseFast(tau, pointerProbe = null) {
    const tLoop = ((tau % PERIOD) + PERIOD) % PERIOD;
    bear.pose(performance(tLoop, true));
    bear.root.updateMatrixWorld(true);
    return pointerProbe || scriptedProbe(tLoop);
  }

  const sim = options.forceFallback
    ? createWebGLFallbackSim(bear, poseFast)
    : ((await tryCreateWebGPUSim(bear, poseFast, set !== 'studio', options.simParams)) || createWebGLFallbackSim(bear, poseFast));

  // Optional live pointer pressing (active ONLY while user holds pointer down on canvas; never alters scripted frame(t)).
  let pointerProbe = null;
  const raycaster = new T.Raycaster();
  const ndc = new T.Vector2();
  if (options.interactive !== false && typeof window !== 'undefined') {
    const updatePointer = (ev) => {
      const rect = out.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, stage.camera);
      const targets = bear.furParts.map((fp) => fp.base);
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length) {
        const hit = hits[0];
        const nrm = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize() : new T.Vector3(0, 0, 1);
        const a = hit.point.clone().addScaledVector(nrm, -0.055);
        const b = a.clone().addScaledVector(nrm, 0.24);
        pointerProbe = { a, b, ra: 0.115, rb: 0.094, visible: true };
      }
    };
    out.addEventListener('pointerdown', (ev) => { updatePointer(ev); });
    out.addEventListener('pointermove', (ev) => { if (ev.buttons) updatePointer(ev); });
    const clearPointer = () => { pointerProbe = null; };
    out.addEventListener('pointerup', clearPointer);
    out.addEventListener('pointercancel', clearPointer);
    out.addEventListener('pointerleave', clearPointer);
  }

  const proof = {};
  let pending = Promise.resolve();

  async function renderFrame(seconds, frameOpts = {}) {
    if (!Number.isFinite(seconds)) throw new TypeError('Frame time must be finite');
    const t = ((seconds % PERIOD) + PERIOD) % PERIOD;
    const activeProbe = frameOpts.deterministic ? null : pointerProbe;

    await sim.advanceTo(t, activeProbe);

    // Apply full facial expression, mouth viseme & occlusion for render
    bear.pose(performance(t, false));
    bear.root.updateMatrixWorld(true);
    bear.updateOcclusion();

    const pr = activeProbe || scriptedProbe(t);
    probeMesh.root.visible = !!pr.visible;
    if (pr.visible) {
      probeMesh.root.position.copy(pr.a);
      probeMesh.root.lookAt(pr.b);
      probeMesh.root.updateMatrixWorld(true);
    }

    // Push in during the tactile belly press (hero = 2.6 s) while keeping both ears and paws in shot!
    const pressFocus = env(t, 1.25, 3.05, 0.45, 0.40);
    const hopWide = env(t, 3.25, 4.55, 0.30, 0.35);
    const cam = frameOpts.camera || {
      pos: [
        lerp(0.30, 0.48, pressFocus) * (1 - 0.35 * hopWide),
        lerp(1.10, 1.07, pressFocus) + 0.10 * hopWide,
        lerp(3.92, 3.60, pressFocus) + 0.38 * hopWide,
      ],
      target: [
        lerp(0.0, 0.02, pressFocus),
        lerp(0.90, 0.88, pressFocus) + 0.10 * hopWide,
        0.08,
      ],
      fov: 31,
      aperture: 0.0014,
      roll: 0.006 * Math.sin((t * Math.PI * 2) / PERIOD),
    };

    ctx.drawImage(stage.render(cam), 0, 0);
    const vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.32, W / 2, H * 0.5, H * 0.96);
    vg.addColorStop(0, 'rgba(6, 14, 18, 0)');
    vg.addColorStop(1, 'rgba(6, 14, 18, 0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    Object.assign(proof, {
      time: t,
      backend: sim.backend,
      fingerprint: sim.fingerprint(),
      checkpoints: sim.stats?.checkpoints ?? 0,
    });
    return out;
  }

  function frame(seconds, frameOpts) {
    const res = pending.then(() => renderFrame(seconds, frameOpts));
    pending = res.catch(() => {});
    return res;
  }

  await frame(0);

  return {
    canvas: out,
    frame,
    period: PERIOD,
    backend: sim.backend,
    fingerprint: () => sim.fingerprint(),
    proof: () => ({ ...proof }),
    bear,
    stage,
    dispose() {
      sim.dispose();
      probeMesh.dispose();
      bear.dispose();
      stage.dispose();
    },
  };
}
