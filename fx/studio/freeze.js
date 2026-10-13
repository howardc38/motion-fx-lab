// Freeze frame and camera orbit: Juno's slam is held at the instant the floor
// breaks. Source time stops (pose, debris, dust, shock ring) while the camera
// travels 230° around real 3D geometry; then time resumes and the camera
// completes the turn so the loop closes without a cut.
import * as THREE from "three";
import { createFigure, solvePose, stageRenderer, blobShadow, SLAM_AT } from "./figure.js";

const W = 1280, H = 720;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const mix = (a, b, u) => a + (b - a) * u;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const FREEZE = { start: 2.25, end: 5.0, period: 6 };
// Output time → source time: real time, a hold, then real time again.
export function freezeClock(t) {
  t = ((t % FREEZE.period) + FREEZE.period) % FREEZE.period;
  if (t < FREEZE.start) return { source: t, held: false };
  if (t < FREEZE.end) return { source: FREEZE.start, held: true };
  return { source: FREEZE.start + (t - FREEZE.end), held: false };
}
// One full camera turn per loop: a slow drift, 230° during the hold, a whip back.
export function orbitAngle(t) {
  t = ((t % FREEZE.period) + FREEZE.period) % FREEZE.period;
  if (t < FREEZE.start) return mix(-38, -22, t / FREEZE.start);
  if (t < FREEZE.end) return mix(-22, 208, smooth((t - FREEZE.start) / (FREEZE.end - FREEZE.start)));
  return mix(208, 322, smooth((t - FREEZE.end) / (FREEZE.period - FREEZE.end)));
}

function tileTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#7f7a73"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${hash(i) > 0.5 ? 255 : 0},${hash(i) > 0.5 ? 255 : 0},${hash(i) > 0.5 ? 255 : 0},${0.04 + 0.05 * hash(i + 3)})`; g.fillRect(hash(i + 1) * 256, hash(i + 2) * 256, 2, 2); }
  g.strokeStyle = "#55504a"; g.lineWidth = 3; g.strokeRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 30); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function crackTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  g.strokeStyle = "#1b1612"; g.lineCap = "round";
  for (let k = 0; k < 13; k++) {
    let x = 256, y = 256, a = (k / 13) * Math.PI * 2 + hash(k) * 0.4, w = 7;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 9; s++) { a += (hash(k * 17 + s) - 0.5) * 0.7; x += Math.cos(a) * 26; y += Math.sin(a) * 26; g.lineWidth = w; g.lineTo(x, y); w *= 0.8; }
    g.stroke();
  }
  const gr = g.createRadialGradient(256, 256, 4, 256, 256, 90);
  gr.addColorStop(0, "rgba(20,16,12,.85)"); gr.addColorStop(1, "rgba(20,16,12,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function createFreezeOrbit() {
  const renderer = stageRenderer(), out = document.createElement("canvas");
  out.width = W; out.height = H;
  const g = out.getContext("2d");
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 80);
  const bg = new THREE.Color("#16202e");
  scene.background = bg;
  scene.fog = new THREE.Fog(bg, 8, 22);
  scene.add(new THREE.HemisphereLight("#dfe9ff", "#3b2a2a", 1.0));
  const key = new THREE.DirectionalLight("#ffe7c9", 3.0); key.position.set(-3, 6, 4); scene.add(key);
  const rim = new THREE.DirectionalLight("#53e1ff", 2.6); rim.position.set(3.5, 3, -4); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.92 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const figure = createFigure(); scene.add(figure.group);
  const shadow = blobShadow("#000000", 0.55); scene.add(shadow);
  const slam = solvePose(SLAM_AT), impact = new THREE.Vector3(slam.handR.x, 0, slam.handR.z);
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: crackTexture(), transparent: true, depthWrite: false }));
  crack.rotation.x = -Math.PI / 2; crack.position.set(impact.x, 0.004, impact.z); scene.add(crack);
  // Debris: chunks of floor tile with fixed launch velocities (a pure ballistic path).
  const CHUNKS = 46, chunkGeo = new THREE.IcosahedronGeometry(1, 0);
  const chunks = new THREE.InstancedMesh(chunkGeo, new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), CHUNKS);
  chunks.frustumCulled = false; scene.add(chunks);
  const fly = [];
  for (let i = 0; i < CHUNKS; i++) {
    const a = mix(-0.35, Math.PI + 0.35, hash(i * 3 + 1)), r0 = 0.25 * hash(i * 5 + 2), vh = mix(1.6, 5.2, hash(i * 7 + 3)), vy = mix(2.2, 6.8, hash(i * 11 + 4));
    const size = mix(0.035, 0.12, hash(i * 13 + 5) ** 1.6);
    fly.push({ p: new THREE.Vector3(impact.x + Math.cos(a) * r0, size, impact.z + Math.sin(a) * r0), v: new THREE.Vector3(Math.cos(a) * vh, vy, Math.sin(a) * vh), size, scale: new THREE.Vector3(mix(0.8, 1.6, hash(i + 9)), mix(0.45, 0.9, hash(i + 19)), mix(0.8, 1.4, hash(i + 29))), spin: new THREE.Vector3(hash(i + 41) - 0.5, hash(i + 51) - 0.5, hash(i + 61) - 0.5).normalize(), w: mix(6, 16, hash(i + 71)) });
    chunks.setColorAt(i, new THREE.Color().setHSL(0.08, 0.07, mix(0.5, 0.78, hash(i * 17 + 6))));
  }
  // Dust: soft sprites, slower and lower.
  const DUST = 520, dustGeo = new THREE.BufferGeometry(), dustPos = new Float32Array(DUST * 3);
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const sprite = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const q = c.getContext("2d"), gr = q.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); q.fillStyle = gr; q.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const dustMat = new THREE.PointsMaterial({ size: 0.09, map: sprite, color: "#d9cbb8", transparent: true, depthWrite: false, opacity: 0.8 });
  const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; scene.add(dust);
  // Shock ring on the floor plus a thin vertical halo ring.
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.022, 8, 96), new THREE.MeshBasicMaterial({ color: "#a8f4ff", transparent: true, depthWrite: false }));
  ring.rotation.x = Math.PI / 2; scene.add(ring);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: "#ffd98a", transparent: true, depthWrite: false }));
  scene.add(halo);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  function debris(age) {
    let visible = 0;
    for (let i = 0; i < CHUNKS; i++) {
      const f = fly[i], a = Math.max(0, age);
      pos.copy(f.p).addScaledVector(f.v, a);
      pos.y += -4.9 * a * a;
      if (pos.y < f.size * 0.5) pos.y = f.size * 0.5;
      q.setFromAxisAngle(f.spin, f.w * a);
      scl.copy(f.scale).multiplyScalar(age > 0 ? f.size : 0.0001);
      m.compose(pos, q, scl);
      chunks.setMatrixAt(i, m);
      if (age > 0) visible++;
    }
    chunks.instanceMatrix.needsUpdate = true;
    if (chunks.instanceColor) chunks.instanceColor.needsUpdate = true;
    for (let i = 0; i < DUST; i++) {
      const a = mix(-0.4, Math.PI + 0.4, hash(i * 3 + 101)), vh = mix(0.6, 2.6, hash(i * 5 + 102)), vy = mix(0.4, 2.4, hash(i * 7 + 103)), drag = 1 - Math.exp(-Math.max(0, age) * 2.2);
      const d = drag / 2.2;
      dustPos[i * 3] = impact.x + Math.cos(a) * vh * d + (hash(i + 7) - 0.5) * 0.2;
      dustPos[i * 3 + 1] = 0.05 + vy * d * (1 - d * 0.6);
      dustPos[i * 3 + 2] = impact.z + Math.sin(a) * vh * d + (hash(i + 8) - 0.5) * 0.2;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dust.visible = age > 0;
    dustMat.opacity = 0.75 * Math.exp(-Math.max(0, age - 0.3) * 1.4);
    const r = 0.3 + 7 * age * Math.exp(-2 * age);
    ring.visible = halo.visible = age > 0;
    ring.position.set(impact.x, 0.02, impact.z); ring.scale.setScalar(r);
    ring.material.opacity = Math.exp(-age * 1.2);
    halo.position.set(impact.x, 0.35 + r * 0.25, impact.z); halo.scale.setScalar(r * 0.55);
    halo.rotation.set(Math.PI / 2 - 0.35, 0, 0);
    halo.material.opacity = 0.75 * Math.exp(-age * 2.2);
    crack.visible = age > 0;
    crack.material.opacity = smooth(age / 0.06);
    return visible;
  }
  function place(t, pelvisY = 0.9) {
    const az = (orbitAngle(t) * Math.PI) / 180, hold = freezeClock(t).held ? smooth((t - FREEZE.start) / (FREEZE.end - FREEZE.start)) : 0;
    const lift = Math.sin(Math.PI * hold), air = Math.max(0, pelvisY - 0.9), dist = 4.9 - 0.9 * lift + 1.1 * air, height = 1.25 + 1.35 * lift + 0.45 * air;
    camera.position.set(impact.x * 0.5 + Math.sin(az) * dist, height, impact.z * 0.5 + Math.cos(az) * dist);
    camera.lookAt(impact.x * 0.5, 0.62 + 0.12 * lift + 0.75 * air, impact.z * 0.5);
    camera.updateMatrixWorld();
    return { azimuth: orbitAngle(t), height, distance: dist };
  }
  let proof = {};
  const api = {
    canvas: out,
    proof: () => proof,
    async frame(time) {
      if (!Number.isFinite(time)) throw new Error("Frame time must be finite");
      const t = Math.max(0, time) % FREEZE.period, clock = freezeClock(t), j = figure.pose(clock.source), age = clock.source - SLAM_AT;
      const debrisCount = debris(age), cam = place(t, j.pelvis.y);
      shadow.position.set(j.pelvis.x, 0.003, j.pelvis.z); shadow.scale.setScalar(1.5 - 0.5 * clamp(j.pelvis.y - 0.9));
      renderer.localClippingEnabled = false;
      renderer.render(scene, camera);
      g.drawImage(renderer.domElement, 0, 0, W, H);
      if (clock.held) {
        const v = g.createRadialGradient(640, 360, 260, 640, 360, 780);
        v.addColorStop(0, "rgba(10,20,40,0)"); v.addColorStop(1, "rgba(10,20,40,.55)");
        g.fillStyle = v; g.fillRect(0, 0, W, H);
      }
      g.font = "800 30px Arial"; g.fillStyle = "#f2f5ff"; g.fillText("FREEZE · ORBIT", 44, 60);
      g.font = "700 20px monospace"; g.fillStyle = clock.held ? "#a8f4ff" : "#ffd98a";
      g.fillText(clock.held ? `TIME HELD ${clock.source.toFixed(2)} s · CAMERA ${Math.round(cam.azimuth + 38)}°` : `TIME ${clock.source.toFixed(2)} s`, 46, 92);
      // Orbit dial: the arc travelled so far.
      g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 4; g.beginPath(); g.arc(1192, 640, 38, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = "#a8f4ff"; g.beginPath(); g.arc(1192, 640, 38, -Math.PI / 2, -Math.PI / 2 + ((cam.azimuth + 38) / 360) * Math.PI * 2); g.stroke();
      proof = { mode: "freeze-orbit", figure: "Juno", choreography: "Juno routine", sourceTime: clock.source, held: clock.held, debris: debrisCount, camera: camera.position.toArray(), azimuth: cam.azimuth, sample: j.handR.toArray().concat(j.ankleL.toArray()) };
    },
    // Silhouette check for a held frame at camera azimuth `deg`: area of the figure,
    // of the debris, and how much of the debris lies on top of the figure.
    measure(deg, size = [320, 180]) {
      const t = FREEZE.start + ((deg + 22) / 230) * (FREEZE.end - FREEZE.start);
      const clock = freezeClock(t);
      const jj = figure.pose(clock.source); debris(clock.source - SLAM_AT); place(t, jj.pelvis.y);
      const target = new THREE.WebGLRenderTarget(size[0], size[1]), white = new THREE.MeshBasicMaterial({ color: "#ffffff" }), px = new Uint8Array(size[0] * size[1] * 4);
      const keep = scene.background, fog = scene.fog;
      scene.background = new THREE.Color("#000000"); scene.fog = null;
      const others = [floor, shadow, crack, dust, ring, halo];
      others.forEach((o) => (o.userData.v = o.visible, o.visible = false));
      const read = (showFigure, showDebris) => {
        figure.group.visible = showFigure; chunks.visible = showDebris;
        scene.overrideMaterial = white;
        renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.readRenderTargetPixels(target, 0, 0, size[0], size[1], px); renderer.setRenderTarget(null);
        return Uint8Array.from({ length: size[0] * size[1] }, (_, i) => (px[i * 4] > 127 ? 1 : 0));
      };
      const fig = read(true, false), deb = read(false, true);
      scene.overrideMaterial = null; figure.group.visible = true; chunks.visible = true;
      others.forEach((o) => (o.visible = o.userData.v));
      scene.background = keep; scene.fog = fog; target.dispose(); white.dispose();
      let a = 0, b = 0, both = 0;
      for (let i = 0; i < fig.length; i++) { a += fig[i]; b += deb[i]; both += fig[i] & deb[i]; }
      return { azimuth: deg, figure: a, debris: b, overlap: both / Math.max(1, b) };
    },
  };
  return api;
}
