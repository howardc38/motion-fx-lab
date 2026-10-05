import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
export const W = 1280,
  H = 720,
  TAU = Math.PI * 2;
export const clamp = (x) => Math.max(0, Math.min(1, x));
export const smooth = (x) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
export const mix = (a, b, t) => a + (b - a) * t;
export const hash = (n) => {
  const x = Math.sin(n * 127.1 + 17.7) * 43758.5453;
  return x - Math.floor(x);
};
export function time(t) {
  if (!Number.isFinite(t)) throw new Error("Frame time must be finite");
  return Math.max(0, t);
}
export function surface() {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  return { canvas, g: canvas.getContext("2d", { willReadFrequently: true }) };
}
export function label(g, title, sub, color = "#eaf3ed") {
  g.fillStyle = color;
  g.textAlign = "left";
  g.font = "600 15px Arial";
  g.fillText(sub.toUpperCase(), 48, 52);
  g.font = "700 38px Arial";
  g.fillText(title, 46, 101);
}
let shared;
export function stage3D() {
  if (!shared) {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const pmrem = new THREE.PMREMGenerator(renderer),
      room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    shared = { renderer, environment: env.texture };
  }
  const scene = new THREE.Scene();
  scene.environment = shared.environment;
  scene.background = new THREE.Color("#08202c");
  const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 120);
  camera.position.set(6, 4, 9);
  camera.lookAt(0, 0.5, 0);
  scene.add(new THREE.HemisphereLight("#e5fbff", "#193b54", 2.8));
  const sun = new THREE.DirectionalLight("#fff2cf", 3.5);
  sun.position.set(-4, 8, 6);
  scene.add(sun);
  const { canvas, g } = surface();
  return {
    scene,
    camera,
    canvas,
    g,
    render() {
      const r = shared.renderer;
      if (r.getContext().isContextLost())
        throw new Error("Material renderer lost its WebGL context");
      r.render(scene, camera);
      g.clearRect(0, 0, W, H);
      g.drawImage(r.domElement, 0, 0);
    },
  };
}
