// PointsMaterial attenuation: pixels = size × (canvas height / 2) / depth.
// Image relief: a large Milo portrait becomes a field of dots whose depth comes
// from the picture (a soft silhouette dome plus brightness). Authored drum hits
// push the dots out in a ripple from the face centre; silent bars stay flat.
// The camera sweeps to a grazing angle so the shallow depth is visible.
// This is 2.5D relief from one image, not reconstructed geometry.
import * as THREE from "three";
import { loadSubject } from "./subjects.js";
import { stageRenderer } from "./figure.js";

const W = 1280, H = 720, PITCH = 7, PX = 1 / 200;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const mix = (a, b, u) => a + (b - a) * u;
export const RELIEF_PERIOD = 6;
// Kick/snare pattern for one 6 s loop: [time, gain]. The tail of the loop is silent.
export const RELIEF_HITS = [[0.8, 0.55], [1.4, 0.62], [2.0, 0.72], [2.3, 0.5], [2.6, 0.78], [3.2, 1.0]];
const pulse = (tau) => (tau < 0 ? 0 : (1 - Math.exp(-tau / 0.025)) * Math.exp(-tau / 0.42));
export function reliefAmount(t, rho = 0) {
  const gate = 1 - smooth((t - 3.95) / 0.7);
  let a = 0;
  for (const [at, gain] of RELIEF_HITS) a = Math.max(a, gain * pulse(t - at - 0.22 * rho));
  return a * gate;
}
export function reliefAngle(t) {
  if (t < 0.6) return 0;
  if (t < 2.5) return 56 * smooth((t - 0.6) / 1.9);
  if (t < 4.3) return mix(56, -38, smooth((t - 2.9) / 1.4));
  return mix(-38, 0, smooth((t - 4.4) / 1.1));
}

export async function createRelief({ background = "#1d2bc4" } = {}) {
  const robot = await loadSubject("robot"), head = robot.getPart("head"), renderer = stageRenderer();
  // Portrait raster: the head fills about 70% of the frame height.
  const tall = Math.round(H * 0.72), wide = Math.round((head.width / head.height) * tall);
  const src = document.createElement("canvas");
  src.width = wide; src.height = tall;
  const sg = src.getContext("2d", { willReadFrequently: true });
  sg.drawImage(head, 0, 0, wide, tall);
  const rgba = sg.getImageData(0, 0, wide, tall).data;
  sg.clearRect(0, 0, wide, tall);
  sg.filter = "blur(26px)";
  sg.drawImage(head, 0, 0, wide, tall);
  sg.filter = "none";
  const soft = sg.getImageData(0, 0, wide, tall).data;
  const cols = Math.floor(wide / PITCH), rows = Math.floor(tall / PITCH), idx = new Int32Array(cols * rows).fill(-1);
  const base = [], color = [], depth = [], rho = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = c * PITCH + PITCH / 2, y = r * PITCH + PITCH / 2, k = ((y | 0) * wide + (x | 0)) * 4;
      if (rgba[k + 3] < 140) continue;
      const lum = (rgba[k] * 0.299 + rgba[k + 1] * 0.587 + rgba[k + 2] * 0.114) / 255, dome = Math.sqrt(soft[k + 3] / 255);
      idx[r * cols + c] = base.length / 3;
      base.push((x - wide / 2) * PX, (tall / 2 - y) * PX, 0);
      const lin = new THREE.Color().setRGB(rgba[k] / 255, rgba[k + 1] / 255, rgba[k + 2] / 255, THREE.SRGBColorSpace);
      color.push(lin.r, lin.g, lin.b);
      depth.push(0.62 * dome + 0.38 * lum);
      rho.push(Math.hypot(x - wide / 2, y - tall * 0.45) / (wide / 2));
    }
  const N = depth.length, grad = new Float32Array(N * 2);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = idx[r * cols + c];
      if (i < 0) continue;
      const at = (rr, cc) => { const j = rr >= 0 && rr < rows && cc >= 0 && cc < cols ? idx[rr * cols + cc] : -1; return j < 0 ? depth[i] * 0.4 : depth[j]; };
      grad[i * 2] = (at(r, c + 1) - at(r, c - 1)) / (2 * PITCH * PX);
      grad[i * 2 + 1] = (at(r - 1, c) - at(r + 1, c)) / (2 * PITCH * PX);
    }
  const headWidth = wide * PX, DEPTH = headWidth * 0.3;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 60);
  scene.background = new THREE.Color(background);
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const sp = sprite.getContext("2d");
  sp.fillStyle = "#fff"; sp.beginPath(); sp.arc(32, 32, 29, 0, Math.PI * 2); sp.fill();
  const tex = new THREE.CanvasTexture(sprite);
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: (PITCH * 1.02 * 6.1) / 360, map: tex, alphaTest: 0.4, vertexColors: true, sizeAttenuation: true, toneMapped: false }));
  points.frustumCulled = false;
  scene.add(points);
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  const g = out.getContext("2d");
  const L = new THREE.Vector3(-0.55, 0.55, 0.65).normalize();
  let proof = {};
  return {
    canvas: out,
    proof: () => proof,
    async frame(time, options = {}) {
      if (!Number.isFinite(time)) throw new Error("Frame time must be finite");
      const t = Math.max(0, time) % RELIEF_PERIOD;
      let maxZ = 0;
      for (let i = 0; i < N; i++) {
        const a = options.amount ?? reliefAmount(t, rho[i]), z = a * depth[i] * DEPTH;
        pos[i * 3] = base[i * 3]; pos[i * 3 + 1] = base[i * 3 + 1]; pos[i * 3 + 2] = z;
        maxZ = Math.max(maxZ, z);
        const nx = -a * DEPTH * grad[i * 2], ny = -a * DEPTH * grad[i * 2 + 1], n = Math.hypot(nx, ny, 1);
        const lit = 0.62 + 0.55 * Math.max(0, (nx * L.x + ny * L.y + L.z) / n) - 0.17 + 0.5 * (z / DEPTH);
        col[i * 3] = Math.min(1, color[i * 3] * lit); col[i * 3 + 1] = Math.min(1, color[i * 3 + 1] * lit); col[i * 3 + 2] = Math.min(1, color[i * 3 + 2] * lit);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      const angle = options.cameraAngle ?? (reliefAngle(t) * Math.PI) / 180;
      if (!Number.isFinite(angle)) throw new Error("Camera angle must be finite");
      const dist = 6.1;
      camera.position.set(Math.sin(angle) * dist, 0.35, Math.cos(angle) * dist);
      camera.lookAt(0, 0.05, 0.12);
      renderer.localClippingEnabled = false;
      renderer.render(scene, camera);
      g.drawImage(renderer.domElement, 0, 0, W, H);
      // Beat strip: each authored hit lights while it pushes the relief.
      g.font = "800 28px Arial"; g.fillStyle = "#fff4e8"; g.fillText("IMAGE RELIEF", 44, 58);
      g.font = "700 18px monospace"; g.fillText("DRUM HITS PUSH DEPTH · 2.5D, NOT RECONSTRUCTED", 46, 88);
      RELIEF_HITS.forEach(([at, gain], k) => {
        const on = pulse(t - at) * gain;
        g.fillStyle = `rgba(255,244,232,${0.25 + 0.75 * clamp(on * 1.6)})`;
        g.fillRect(46 + k * 34, 660 - 40 * gain, 24, 40 * gain);
      });
      const amount = options.amount ?? reliefAmount(t);
      proof = { mode: "depth-dots", subject: "Milo", dots: N, amount, extrusion: maxZ / headWidth, flat: maxZ < 1e-4, cameraAngle: (angle * 180) / Math.PI, depth: "luminance and silhouette relief, not recovered geometry" };
    },
  };
}
