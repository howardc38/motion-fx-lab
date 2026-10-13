// Low-poly flight course: a chase camera follows a glider down a city canyon at
// sunset. Exponential fog, lit windows, gates that flash as they pass, streaking
// speed lines, banking and an FOV kick sell the speed. The course repeats every
// 6 s of travel, so the loop has no seam.
import * as THREE from "three";
import { stageRenderer } from "./figure.js";

const W = 1280, H = 720, PERIOD = 6, SPEED = 26, LOOP = SPEED * PERIOD, GATE = LOOP / 8;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const smooth = (v) => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
const path = (z) => [Math.sin((z / LOOP) * Math.PI * 4) * 2.2, 4.2 + Math.sin((z / LOOP) * Math.PI * 6) * 0.9];

function sky() {
  const c = document.createElement("canvas");
  c.width = 16; c.height = 512;
  const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, "#160f3d"); gr.addColorStop(0.42, "#5b2a7a"); gr.addColorStop(0.62, "#ff6f6a"); gr.addColorStop(0.72, "#ffb86b"); gr.addColorStop(1, "#ffd48a");
  g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function windows() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 128; y += 12) for (let x = 6; x < 64; x += 14) if (hash(x * 7 + y) > 0.45) { g.fillStyle = hash(x + y * 3) > 0.5 ? "#ffd27a" : "#7fe8ff"; g.fillRect(x, y, 7, 6); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function createCourse() {
  const renderer = stageRenderer(), out = document.createElement("canvas");
  out.width = W; out.height = H;
  const g = out.getContext("2d");
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(64, W / H, 0.1, 140);
  scene.background = sky();
  scene.fog = new THREE.FogExp2("#ff8f73", 0.026);
  scene.add(new THREE.HemisphereLight("#ffd6b0", "#2a1846", 1.4));
  const sun = new THREE.DirectionalLight("#ffc38a", 2.4); sun.position.set(-6, 8, -20); scene.add(sun);
  // Buildings: two copies of one LOOP-long canyon so the view ahead never runs out.
  const count = 150, box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8, emissive: "#ffffff", emissiveMap: windows(), emissiveIntensity: 0.9 });
  const blocks = new THREE.InstancedMesh(box, mat, count * 2);
  const m = new THREE.Matrix4(), palette = ["#3b7d8c", "#6a4c9c", "#e0705a", "#2f5c7a", "#8a5ba8", "#d9a05b"].map((c) => new THREE.Color(c));
  for (let copy = 0; copy < 2; copy++)
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1, z = -(i / count) * LOOP - copy * LOOP, h = 3 + hash(i) ** 1.5 * 16, w = 2 + hash(i + 7) * 3, d = 2 + hash(i + 9) * 4;
      const x = side * (7.2 + w / 2 + hash(i + 3) * 9) + path(-z)[0];
      m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      blocks.setMatrixAt(copy * count + i, m);
      blocks.setColorAt(copy * count + i, palette[i % palette.length]);
    }
  blocks.frustumCulled = false;
  scene.add(blocks);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, LOOP * 3), new THREE.MeshStandardMaterial({ color: "#241a3d", roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -LOOP; scene.add(ground);
  // Gates along the flight path.
  const gates = [];
  for (let copy = 0; copy < 2; copy++)
    for (let i = 0; i < 8; i++) {
      const z = -(i + 0.5) * GATE - copy * LOOP, [x, y] = path(-z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.12, 6, 10), new THREE.MeshStandardMaterial({ color: "#ffcf4a", emissive: "#ffb11f", emissiveIntensity: 0.6, flatShading: true, metalness: 0.2, roughness: 0.4 }));
      ring.position.set(x, y, z);
      ring.rotation.z = (i * Math.PI) / 10;
      scene.add(ring);
      gates.push(ring);
    }
  // The glider the camera chases.
  const glider = new THREE.Group();
  const wing = new THREE.BufferGeometry();
  // A paper-plane glider with dihedral, so it reads from the chase camera above.
  const N0 = [0, 0, -1.2], LT = [-1.3, 0.32, 0.5], RT = [1.3, 0.32, 0.5], CT = [0, 0.04, 0.42], KB = [0, -0.26, 0.38];
  wing.setAttribute("position", new THREE.Float32BufferAttribute([...N0, ...LT, ...CT, ...N0, ...CT, ...RT, ...N0, ...KB, ...CT], 3));
  wing.computeVertexNormals();
  glider.add(new THREE.Mesh(wing, new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true, side: THREE.DoubleSide, emissive: "#ffd9c4", emissiveIntensity: 0.55, fog: false })));
  glider.scale.setScalar(1.7);
  scene.add(glider);
  // Speed lines: streaks around the camera axis moving faster than the camera.
  const LINES = 160, linePos = new Float32Array(LINES * 6), lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: "#fff3df", transparent: true, opacity: 0.75, fog: false }));
  lines.frustumCulled = false;
  scene.add(lines);
  let proof = {};
  return {
    canvas: out,
    proof: () => proof,
    frame(time) {
      if (!Number.isFinite(time)) throw new Error("Frame time must be finite");
      const t = Math.max(0, time) % PERIOD, travel = t * SPEED, z = -travel, [px, py] = path(travel);
      const [ax, ay] = path(travel + 6), bank = (ax - px) * 0.22;
      // Gate passing: brightness spike and an FOV kick as the camera flies through.
      let pass = 0, passed = 0;
      for (const ring of gates) {
        const dz = ring.position.z - (z - 3);
        const k = Math.exp(-(dz * dz) / 6);
        ring.material.emissiveIntensity = 0.6 + 3.2 * k;
        pass = Math.max(pass, k);
        if (ring.position.z > z - 3 && ring.position.z > -LOOP) passed++;
      }
      camera.fov = 64 + 9 * pass;
      camera.updateProjectionMatrix();
      camera.position.set(px - Math.sin(bank) * 0.6, py + 1.25, z + 4.4);
      camera.up.set(Math.sin(bank * 1.4), Math.cos(bank * 1.4), 0);
      camera.lookAt(ax, ay + 0.3, z - 10);
      glider.position.set(px, py - 0.15, z - 2.6);
      glider.rotation.set(-0.08 + (ay - py) * 0.08, 0, -bank * 2.2);
      for (let i = 0; i < LINES; i++) {
        // Relative speeds are whole multiples of span per loop, so streaks wrap seamlessly at 6 s.
        const a = hash(i) * Math.PI * 2, r = 1.8 + hash(i + 50) * 5.5, span = 40, speed = ((5 + Math.floor(hash(i + 90) * 4)) * span) / LOOP;
        const lz = z - 34 + ((t * SPEED * speed + hash(i + 130) * span) % span), len = 2.5 + 5 * hash(i + 170);
        const x = px + Math.cos(a) * r, y = py + 0.8 + Math.sin(a) * r * 0.75;
        linePos.set([x, y, lz, x, y, lz + len], i * 6);
      }
      lineGeo.attributes.position.needsUpdate = true;
      renderer.localClippingEnabled = false;
      renderer.render(scene, camera);
      g.drawImage(renderer.domElement, 0, 0, W, H);
      g.font = "800 28px Arial"; g.fillStyle = "#fff1dc"; g.fillText("FLIGHT / LOW POLY", 44, 58);
      const gate = (Math.floor((travel + GATE / 2) / GATE) % 8) + 1;
      g.font = "700 22px monospace"; g.fillText(`GATE ${String(gate).padStart(2, "0")} / 08   ${Math.round(SPEED * 3.6 * 2)} km/h`, 46, 676);
      proof = { mode: "lowpoly", travel, gate, fov: camera.fov, bank, fog: scene.fog.density, speedLines: LINES };
    },
  };
}
