// "Juno": an original procedural 3D dancer for the studio's 3D effects. The
// routine is authored as 3D targets (hands in chest space, feet in pelvis
// space, root yaw/pitch/roll, spine and head angles) and solved with two-bone
// IK, so limbs separate in depth and a side view never collapses into a line.
// Every pose is a pure function of routine time.
import * as THREE from "three";

export const ROUTINE = 6;
export const SLAM_AT = 2.05;
const D = Math.PI / 180;
const UPPER = 0.28, FORE = 0.26, THIGH = 0.43, SHIN = 0.43;
export const PALETTE = {
  skin: "#c98b62", hair: "#24163d", goggles: "#3ee6ff", jacket: "#ffcd3c", trim: "#ff8a1f",
  shirt: "#ff4f7b", pants: "#5236d6", shoe: "#f6f2ea", sole: "#ff4f7b", glove: "#24163d", scarf: "#ff3d73",
};

// Keys: t, root [x, y, z], yaw/pitch/roll (deg), spine [bend, side, twist], head [nod, tilt, turn],
// hands {L, R} in chest space, feet {L, R} in pelvis space, ground (0 airborne .. 1 planted).
const K = (t, root, [yaw, pitch, roll], spine, head, L, R, fL, fR, ground) => ({ t, root, yaw, pitch, roll, spine, head, hands: { L, R }, feet: { L: fL, R: fR }, ground });
const KEYS = [
  K(0.0, [0, 0.93, 0], [0, 0, 0], [8, 0, 0], [0, 0, 0], [0.27, -0.08, 0.26], [-0.25, -0.04, 0.3], [0.13, -0.84, 0.05], [-0.13, -0.84, -0.05], 1),
  K(0.4, [0.08, 0.93, 0], [-15, 0, 4], [5, -6, 10], [-5, 6, -10], [0.45, 0.2, 0.2], [-0.2, -0.25, 0.25], [0.13, -0.84, 0.05], [-0.13, -0.84, -0.05], 1),
  K(0.85, [0, 0.7, 0.05], [-30, 18, 0], [25, 0, -15], [-15, 0, 0], [0.32, -0.35, -0.25], [-0.32, -0.35, -0.25], [0.18, -0.55, 0.25], [-0.16, -0.55, -0.2], 1),
  K(1.15, [0, 1.25, 0.12], [20, -5, 0], [-5, 0, 25], [-10, 0, 0], [0.35, 0.55, 0.15], [-0.3, 0.5, 0.1], [0.1, -0.8, -0.05], [-0.1, -0.85, -0.12], 0.5),
  K(1.5, [0, 1.75, 0.25], [200, 0, 15], [-8, 10, 20], [0, -10, 0], [0.68, 0.08, 0.05], [-0.66, 0.12, -0.12], [0.12, -0.35, 0.62], [-0.08, -0.78, -0.42], 0),
  K(1.82, [0, 1.2, 0.35], [330, 25, 0], [30, 0, 0], [-20, 0, 0], [0.55, 0.3, -0.3], [-0.1, -0.6, 0.45], [0.22, -0.55, 0.3], [-0.2, -0.7, -0.25], 0),
  K(2.05, [0, 0.5, 0.4], [360, 30, 0], [35, -5, 0], [-25, 0, 0], [0.5, 0.38, -0.45], [-0.12, -0.75, 0.42], [0.62, -0.42, -0.3], [-0.16, -0.48, 0.25], 1),
  K(2.4, [0, 0.45, 0.4], [360, 36, 0], [38, -5, 0], [-28, 0, 0], [0.55, 0.3, -0.4], [-0.12, -0.72, 0.4], [0.64, -0.4, -0.3], [-0.16, -0.46, 0.25], 1),
  K(2.9, [0, 0.85, 0.3], [360, 10, 0], [10, 0, -20], [-5, 0, 10], [0.6, 0.2, 0.2], [-0.4, 0.4, 0.25], [0.35, -0.7, -0.15], [-0.15, -0.75, 0.1], 1),
  K(3.5, [0, 0.95, 0.2], [380, 22, 0], [-10, 0, 0], [-10, 0, 0], [0.1, 0.45, 0.5], [-0.65, 0.15, -0.05], [0.1, -0.35, -0.75], [-0.08, -0.86, 0.05], 1),
  K(4.2, [0, 1.0, 0.1], [520, 0, 0], [0, 0, 0], [0, 0, 0], [0.12, -0.05, 0.35], [-0.12, -0.05, 0.35], [-0.02, -0.45, 0.14], [-0.1, -0.87, 0.02], 1),
  K(4.75, [0, 0.95, 0.05], [650, -6, 0], [-8, 0, 0], [12, 0, 0], [0.55, 0.5, 0.1], [-0.55, 0.5, 0.1], [0.22, -0.82, 0], [-0.22, -0.82, 0], 1),
  K(5.4, [-0.06, 0.93, 0], [700, 0, -4], [5, 6, -10], [-5, -6, 10], [0.2, -0.25, 0.25], [-0.45, 0.2, 0.2], [0.13, -0.84, 0.05], [-0.13, -0.84, -0.05], 1),
  K(6.0, [0, 0.93, 0], [720, 0, 0], [8, 0, 0], [0, 0, 0], [0.27, -0.08, 0.26], [-0.25, -0.04, 0.3], [0.13, -0.84, 0.05], [-0.13, -0.84, -0.05], 1),
];
// Centripetal-free uniform Catmull–Rom with clamped ends: smooth, deterministic.
function cr(p0, p1, p2, p3, u) {
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}
function sampleKeys(s) {
  s = Math.max(0, Math.min(ROUTINE, s));
  let i = 0;
  while (i < KEYS.length - 2 && s > KEYS[i + 1].t) i++;
  const a = KEYS[Math.max(0, i - 1)], b = KEYS[i], c = KEYS[i + 1], d = KEYS[Math.min(KEYS.length - 1, i + 2)];
  const u = (s - b.t) / (c.t - b.t);
  const f = (get) => {
    const A = get(a), B = get(b), C = get(c), E = get(d);
    return Array.isArray(B) ? B.map((_, j) => cr(A[j], B[j], C[j], E[j], u)) : cr(A, B, C, E, u);
  };
  return {
    root: f((k) => k.root), yaw: f((k) => k.yaw), pitch: f((k) => k.pitch), roll: f((k) => k.roll),
    spine: f((k) => k.spine), head: f((k) => k.head), hL: f((k) => k.hands.L), hR: f((k) => k.hands.R),
    fL: f((k) => k.feet.L), fR: f((k) => k.feet.R), ground: Math.max(0, Math.min(1, f((k) => k.ground))),
  };
}
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const euler = (x, y, z, order = "YXZ") => new THREE.Quaternion().setFromEuler(new THREE.Euler(x * D, y * D, z * D, order));
function ik(A, T, a, b, pole) {
  const dir = T.clone().sub(A), dist = Math.max(Math.abs(a - b) + 1e-3, Math.min(a + b - 1e-3, dir.length()));
  dir.normalize();
  const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (p.lengthSq() < 1e-8) p.set(0, 0, 1).sub(dir.clone().multiplyScalar(dir.z));
  p.normalize();
  const cos = (a * a + dist * dist - b * b) / (2 * a * dist), sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  return { mid: A.clone().add(dir.clone().multiplyScalar(a * cos)).add(p.multiplyScalar(a * sin)), end: A.clone().add(dir.multiplyScalar(dist)) };
}
// Joint positions and frames for routine time s.
export function solvePose(s) {
  const k = sampleKeys(s);
  const qr = euler(k.pitch, k.yaw, k.roll), qc = qr.clone().multiply(euler(k.spine[0], k.spine[2], k.spine[1])), qh = qc.clone().multiply(euler(k.head[0], k.head[2], k.head[1]));
  const P = V(...k.root), at = (o, q, x, y, z) => o.clone().add(V(x, y, z).applyQuaternion(q));
  const waist = at(P, qr, 0, 0.12, 0), chest = at(waist, qc, 0, 0.2, 0), neck = at(chest, qc, 0, 0.2, 0), head = at(neck, qh, 0, 0.13, 0);
  const j = { pelvis: P, waist, chest, neck, head, qr, qc, qh };
  for (const [side, sx] of [["L", 1], ["R", -1]]) {
    const shoulder = at(chest, qc, 0.19 * sx, 0.14, 0), hand = at(chest, qc, ...k["h" + side]);
    const arm = ik(shoulder, hand, UPPER, FORE, V(0.35 * sx, -0.2, -1).applyQuaternion(qc));
    const hip = at(P, qr, 0.1 * sx, -0.06, 0), foot = at(P, qr, ...k["f" + side]);
    const leg = ik(hip, foot, THIGH, SHIN, V(0.15 * sx, 0, 1).applyQuaternion(qr));
    Object.assign(j, { ["shoulder" + side]: shoulder, ["elbow" + side]: arm.mid, ["hand" + side]: arm.end, ["hip" + side]: hip, ["knee" + side]: leg.mid, ["ankle" + side]: leg.end });
  }
  // Planted keys rest the lowest contact (sole, knee or fist) on the floor.
  const low = Math.min(j.ankleL.y - 0.075, j.ankleR.y - 0.075, j.kneeL.y - 0.07, j.kneeR.y - 0.07, j.handL.y - 0.05, j.handR.y - 0.05);
  const lift = k.ground * -low;
  for (const v of Object.values(j)) if (v.isVector3) v.y += lift;
  j.forward = V(0, 0, 1).applyQuaternion(qr);
  j.ground = k.ground;
  return j;
}

function taper(r0, r1, len, seg = 14) {
  const pts = [];
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r0 + 1e-4, Math.sin(a) * r0)); }
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); pts.push(new THREE.Vector2(Math.cos(a) * r1 + 1e-4, len + Math.sin(a) * r1)); }
  return new THREE.LatheGeometry(pts, seg);
}
const UP = V(0, 1, 0);
// The figure: meshes placed per frame from solved joints; stable surface samples.
export function createFigure() {
  const group = new THREE.Group(), parts = [], mats = new Map();
  const mat = (c, extra = {}) => {
    const key = c + JSON.stringify(extra);
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.02, ...extra }));
    return mats.get(key);
  };
  function part(name, geo, color, place, extra) {
    const mesh = new THREE.Mesh(geo, mat(color, extra));
    mesh.name = name;
    mesh.userData.color = new THREE.Color(color);
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    parts.push({ mesh, place });
    return mesh;
  }
  const seg = (a, b) => (j, m) => {
    const A = j[a], B = j[b];
    m.compose(A, new THREE.Quaternion().setFromUnitVectors(UP, B.clone().sub(A).normalize()), V(1, 1, 1));
  };
  const frame = (o, q, x = 0, y = 0, z = 0, extraQ = null) => (j, m) => {
    const qq = extraQ ? j[q].clone().multiply(extraQ) : j[q];
    m.compose(j[o].clone().add(V(x, y, z).applyQuaternion(j[q])), qq, V(1, 1, 1));
  };
  const C = PALETTE;
  // Torso, hips and head.
  part("pelvis", new THREE.SphereGeometry(1, 20, 14).scale(0.165, 0.12, 0.12), C.pants, frame("pelvis", "qr", 0, -0.01, 0));
  part("waist", taper(0.125, 0.15, 0.16, 18), C.shirt, frame("pelvis", "qr", 0, 0.04, 0));
  part("chest", new THREE.SphereGeometry(1, 22, 16).scale(0.21, 0.2, 0.135), C.jacket, frame("chest", "qc", 0, 0.05, 0));
  part("zip", new THREE.BoxGeometry(0.025, 0.3, 0.03), C.trim, frame("chest", "qc", 0, 0.03, 0.128));
  part("collar", new THREE.TorusGeometry(0.085, 0.035, 10, 20).rotateX(Math.PI / 2), C.jacket, frame("neck", "qc", 0, -0.03, 0));
  part("neck", taper(0.045, 0.045, 0.08, 10), C.skin, frame("neck", "qc", 0, -0.02, 0));
  part("head", new THREE.SphereGeometry(0.115, 24, 18).scale(0.98, 1.08, 1), C.skin, frame("head", "qh"));
  part("hair", new THREE.SphereGeometry(0.125, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.62).rotateX(-0.42), C.hair, frame("head", "qh", 0, 0.012, -0.012));
  part("bun", new THREE.SphereGeometry(0.056, 14, 10).scale(1.1, 0.85, 0.95), C.hair, frame("head", "qh", 0, 0.085, -0.095));
  part("headset", new THREE.CylinderGeometry(0.034, 0.034, 0.238, 12).rotateZ(Math.PI / 2), C.trim, frame("head", "qh", 0, 0.01, -0.005));
  part("goggles", new THREE.TorusGeometry(0.121, 0.016, 8, 28).rotateX(Math.PI / 2 - 0.1), C.goggles, frame("head", "qh", 0, 0.028, 0), { emissive: C.goggles, emissiveIntensity: 0.38 });
  part("lens", new THREE.BoxGeometry(0.155, 0.046, 0.032), C.goggles, frame("head", "qh", 0, 0.03, 0.11), { emissive: C.goggles, emissiveIntensity: 0.62, roughness: 0.18 });
  for (const [s, sx] of [["L", 1], ["R", -1]]) {
    part("deltoid" + s, new THREE.SphereGeometry(0.072, 14, 10).scale(0.95, 1.08, 0.95), C.jacket, frame("shoulder" + s, "qc", 0.01 * sx, -0.015, 0));
    part("upper" + s, taper(0.062, 0.05, UPPER), C.jacket, seg("shoulder" + s, "elbow" + s));
    part("cuff" + s, taper(0.052, 0.05, 0.05), C.trim, (j, m) => { seg("elbow" + s, "hand" + s)(j, m); m.multiply(new THREE.Matrix4().makeTranslation(0, FORE * 0.62, 0)); });
    part("fore" + s, taper(0.05, 0.04, FORE * 0.62), C.jacket, seg("elbow" + s, "hand" + s));
    part("hand" + s, new THREE.SphereGeometry(0.05, 14, 10).scale(1, 1.15, 0.9), C.glove, frame("hand" + s, "qc"));
    part("thigh" + s, taper(0.085, 0.066, THIGH), C.pants, seg("hip" + s, "knee" + s));
    part("shin" + s, taper(0.066, 0.05, SHIN), C.pants, seg("knee" + s, "ankle" + s));
    part("shoe" + s, new THREE.CapsuleGeometry(0.058, 0.13, 6, 14).rotateX(Math.PI / 2).translate(0, -0.03, 0.05), C.shoe, (j, m) => shoe(j, m, s));
    part("sole" + s, new THREE.BoxGeometry(0.11, 0.025, 0.26).translate(0, -0.075, 0.05), C.sole, (j, m) => shoe(j, m, s));
  }
  function shoe(j, m, s) {
    const shin = j["ankle" + s].clone().sub(j["knee" + s]).normalize();
    const f = j.forward.clone().sub(shin.clone().multiplyScalar(j.forward.dot(shin)));
    if (f.lengthSq() < 1e-6) f.set(0, 0, 1);
    f.normalize();
    const up = shin.clone().negate(), x = up.clone().cross(f).normalize(), z = x.clone().cross(up).normalize();
    m.makeBasis(x, up, z).setPosition(j["ankle" + s]);
  }
  // Scarf ribbon: its centreline follows where the neck was over the last 0.5 s.
  const SCARF = 16, scarfGeo = new THREE.PlaneGeometry(1, 1, 1, SCARF - 1);
  const scarf = new THREE.Mesh(scarfGeo, new THREE.MeshStandardMaterial({ color: C.scarf, roughness: 0.7, side: THREE.DoubleSide }));
  scarf.name = "scarf";
  scarf.userData.color = new THREE.Color(C.scarf);
  scarf.frustumCulled = false;
  group.add(scarf);
  function scarfLine(s) {
    const pts = [];
    for (let i = 0; i < SCARF; i++) {
      const back = solvePose(s - i * 0.035), q = i / (SCARF - 1);
      const p = back.neck.clone().add(V(0, -0.04, -0.09).applyQuaternion(back.qc)).add(back.forward.clone().multiplyScalar(-0.06 * i));
      p.y -= 0.0035 * i * i * (1 - Math.min(1, back.ground * 0.2));
      p.x += Math.sin(s * 9 + i * 0.7) * 0.012 * i * q;
      pts.push(p);
    }
    return pts;
  }
  function updateScarf(s, j) {
    const pts = scarfLine(s), pos = scarfGeo.attributes.position;
    for (let i = 0; i < SCARF; i++) {
      const t = (pts[Math.min(SCARF - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)])).normalize();
      const side = t.clone().cross(V(0, 1, 0));
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize().multiplyScalar(0.055 * (1 - (i / SCARF) * 0.3));
      const a = pts[i].clone().add(side), b = pts[i].clone().sub(side);
      pos.setXYZ(i * 2, a.x, a.y, a.z);
      pos.setXYZ(i * 2 + 1, b.x, b.y, b.z);
    }
    pos.needsUpdate = true;
    scarfGeo.computeVertexNormals();
  }
  let current = null;
  return {
    group,
    parts,
    scarf,
    pose(s) {
      const j = solvePose(s);
      for (const p of parts) p.place(j, p.mesh.matrix);
      group.updateMatrixWorld(true);
      updateScarf(s, j);
      current = j;
      return j;
    },
    get joints() { return current; },
    // Area-weighted samples with fixed triangle identity on every rigid part and
    // the scarf. write() fills world positions, normals and colours.
    sampler(count, seed = 7) {
      let state = seed >>> 0;
      const R = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
      const meshes = [...parts.map((p) => p.mesh), scarf], areas = [], tris = [];
      for (const mesh of meshes) {
        const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry, p = g.attributes.position, list = [];
        let total = 0;
        const a = V(), b = V(), c = V();
        for (let i = 0; i < p.count; i += 3) {
          a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
          const area = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
          total += area;
          list.push(total);
        }
        areas.push(total);
        tris.push({ mesh, list, index: mesh === scarf ? null : g, total });
      }
      const sum = areas.reduce((x, y) => x + y, 0), samples = [];
      for (const tri of tris) {
        const n = Math.max(8, Math.round((count * tri.total) / sum)), out = [];
        for (let i = 0; i < n; i++) {
          const target = R() * tri.total;
          let lo = 0, hi = tri.list.length - 1;
          while (lo < hi) { const mid = (lo + hi) >> 1; if (tri.list[mid] < target) lo = mid + 1; else hi = mid; }
          const u = Math.sqrt(R()), v = R();
          out.push([lo, 1 - u, u * (1 - v), u * v]);
        }
        samples.push({ ...tri, out });
      }
      const total = samples.reduce((n, s) => n + s.out.length, 0);
      const positions = new Float32Array(total * 3), normals = new Float32Array(total * 3), colors = new Float32Array(total * 3), parts2 = new Uint8Array(total);
      const a = V(), b = V(), c = V(), na = V(), nb = V(), nc = V(), nm = new THREE.Matrix3();
      return {
        count: total, positions, normals, colors, part: parts2,
        write() {
          let o = 0;
          samples.forEach((sm, si) => {
            const g = sm.index || sm.mesh.geometry, p = g.attributes.position, nAttr = g.attributes.normal, mw = sm.mesh.matrixWorld, col = sm.mesh.userData.color;
            nm.getNormalMatrix(mw);
            const scarfIndex = sm.mesh === scarf ? scarfGeo.index : null;
            for (const [f, w0, w1, w2] of sm.out) {
              const vi = (k) => (scarfIndex ? scarfIndex.getX(f * 3 + k) : f * 3 + k);
              a.fromBufferAttribute(p, vi(0)).applyMatrix4(mw); b.fromBufferAttribute(p, vi(1)).applyMatrix4(mw); c.fromBufferAttribute(p, vi(2)).applyMatrix4(mw);
              na.fromBufferAttribute(nAttr, vi(0)); nb.fromBufferAttribute(nAttr, vi(1)); nc.fromBufferAttribute(nAttr, vi(2));
              const x = a.x * w0 + b.x * w1 + c.x * w2, y = a.y * w0 + b.y * w1 + c.y * w2, z = a.z * w0 + b.z * w1 + c.z * w2;
              const n = V(na.x * w0 + nb.x * w1 + nc.x * w2, na.y * w0 + nb.y * w1 + nc.y * w2, na.z * w0 + nb.z * w1 + nc.z * w2).applyMatrix3(nm).normalize();
              positions[o * 3] = x; positions[o * 3 + 1] = y; positions[o * 3 + 2] = z;
              normals[o * 3] = n.x; normals[o * 3 + 1] = n.y; normals[o * 3 + 2] = n.z;
              colors[o * 3] = col.r; colors[o * 3 + 1] = col.g; colors[o * 3 + 2] = col.b;
              parts2[o] = si;
              o++;
            }
          });
        },
      };
    },
  };
}

// One WebGL renderer shared by the studio 3D effects (gallery pages already hold many contexts).
let renderer;
export function stageRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    renderer.setPixelRatio(1);
    renderer.setSize(1280, 720, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
  }
  return renderer;
}
// Soft round floor shadow (a texture, not a shadow map: cheap and stable).
export function blobShadow(color = "#000000", opacity = 0.45) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, "rgba(0,0,0,1)");
  gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c), m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  return m;
}
