// Skinned point cloud: the solid dancer is scanned into surface points that stay
// attached to the moving limbs, rush towards the lens as depth-of-field bokeh,
// then reassemble. The particle-lens variant streams points continuously and
// pulls focus between the stream and the body.
import * as THREE from "three";
import { createFigure, stageRenderer, blobShadow, ROUTINE, SLAM_AT } from "./figure.js";

const W = 1280, H = 720;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const mix = (a, b, u) => a + (b - a) * u;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

const VERT = `attribute vec3 color; attribute float aAlpha; attribute float aGlow;
uniform float uSize, uScale, uFocus, uAperture, uCut, uCutOn; uniform vec3 uKey;
varying vec3 vColor; varying float vAlpha; varying float vBlur;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  float d = max(.05, -mv.z), base = uSize * uScale / d, coc = uAperture * abs(1. / d - 1. / uFocus) * uScale;
  float size = clamp(base + coc, 1., 140.);
  gl_PointSize = size; gl_Position = projectionMatrix * mv;
  vec3 n = normalize(normal), v = normalize(cameraPosition - position);
  float lam = max(0., dot(n, normalize(uKey))), rim = pow(1. - max(0., dot(n, v)), 2.4);
  vColor = color * (.32 + .9 * lam + aGlow) + vec3(.35, .8, 1.) * rim * .55 * (1. - min(1., aGlow * 8.));
  float vis = uCutOn > .5 ? step(position.y, uCut) : 1.;
  vColor += uCutOn > .5 ? exp(-pow((position.y - uCut) / .035, 2.)) * vec3(.5, 1., 1.) : vec3(0.);
  vAlpha = clamp(pow(base / size, 1.6), .035, 1.) * vis * aAlpha;
  vBlur = clamp(coc / size, 0., 1.);
}`;
const FRAG = `varying vec3 vColor; varying float vAlpha; varying float vBlur;
void main(){
  float r = length(gl_PointCoord - .5) * 2.;
  float disc = 1. - smoothstep(mix(.55, .86, vBlur), 1., r);
  float ring = mix(1., .82 + .38 * smoothstep(.55, .92, r), vBlur);
  float a = disc * vAlpha * ring;
  if (a < .008) discard;
  gl_FragColor = vec4(vColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function gradientBackground(top, bottom, glow) {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 256;
  const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top); gr.addColorStop(0.62, glow); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function floorPool(color) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 8, 128, 128, 126);
  gr.addColorStop(0, color); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 1.5;
  for (let r = 30; r < 128; r += 24) { g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

export async function createCloud(mode = "skin") {
  const lens = mode === "lens", renderer = stageRenderer();
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  const g = out.getContext("2d");
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(lens ? 42 : 36, W / H, 0.05, 60);
  scene.background = gradientBackground(lens ? "#06121f" : "#0a1022", lens ? "#05070d" : "#06070f", lens ? "#123a4f" : "#2a1a4a");
  scene.add(new THREE.HemisphereLight("#d9e8ff", "#2b1d4a", 1.15));
  const key = new THREE.DirectionalLight("#fff0d8", 2.8); key.position.set(-2.5, 4.5, 3.5); scene.add(key);
  const rim = new THREE.DirectionalLight("#5ee0ff", 2.4); rim.position.set(3, 2.5, -3.5); scene.add(rim);
  const figure = createFigure();
  scene.add(figure.group);
  const pool = floorPool(lens ? "rgba(70,190,220,.45)" : "rgba(160,110,255,.5)"); scene.add(pool);
  const shadow = blobShadow("#000000", 0.5); scene.add(shadow);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  figure.group.traverse((o) => { if (o.material) o.material.clippingPlanes = [plane]; });
  const sampler = figure.sampler(lens ? 16000 : 14000, lens ? 23 : 11), N = sampler.count;
  const geo = new THREE.BufferGeometry(), draw = new Float32Array(N * 3), alpha = new Float32Array(N).fill(1), glow = new Float32Array(N);
  geo.setAttribute("position", new THREE.BufferAttribute(draw, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(sampler.normals, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(sampler.colors, 3));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute("aGlow", new THREE.BufferAttribute(glow, 1));
  const uniforms = { uSize: { value: 0.024 }, uScale: { value: 620 }, uFocus: { value: 4.6 }, uAperture: { value: 0.05 }, uCut: { value: 10 }, uCutOn: { value: 0 }, uKey: { value: key.position.clone() } };
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false });
  const cloud = new THREE.Points(geo, material);
  cloud.frustumCulled = false;
  scene.add(cloud);
  // Fixed per-point flight: a direction towards the lens with spread, a length and a delay.
  const dir = new Float32Array(N * 3), len = new Float32Array(N), delay = new Float32Array(N), phase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = hash(i * 3 + 1) * Math.PI * 2, b = hash(i * 3 + 2) * 2 - 1, r = Math.sqrt(1 - b * b);
    dir.set([Math.cos(a) * r, b, Math.sin(a) * r], i * 3);
    // Most points travel a short way; a few reach the lens and become large bokeh.
    len[i] = 0.12 + 0.86 * hash(i * 7 + 5) ** 2.6;
    delay[i] = hash(i * 11 + 3);
    phase[i] = hash(i * 13 + 9);
  }
  function cameraAt(t, pelvisY = 0.93) {
    if (lens) {
      const lift = Math.max(0, pelvisY - 0.95) * 0.8;
      const az = (12 + 40 * Math.sin((t / ROUTINE) * Math.PI * 2)) * Math.PI / 180, dist = 3.7 + 0.35 * Math.cos((t / ROUTINE) * Math.PI * 4);
      return { pos: new THREE.Vector3(Math.sin(az) * dist, 0.62 + lift * 0.6, Math.cos(az) * dist), look: new THREE.Vector3(0, 1.0 + lift, 0.2) };
    }
    const rush = smooth((t - 2.0) / 0.9) * (1 - smooth((t - 4.0) / 1.2)), lift = Math.max(0, pelvisY - 0.95) * 0.75;
    const az = (28 + 26 * Math.sin((t / ROUTINE) * Math.PI * 2)) * Math.PI / 180, dist = 4.9 - 0.6 * rush;
    return { pos: new THREE.Vector3(Math.sin(az) * dist, 1.3 - 0.2 * rush + lift * 0.5, Math.cos(az) * dist), look: new THREE.Vector3(0, 0.98 - 0.1 * rush + lift, 0.2) };
  }
  // Scatter amount for point i at time t (skin mode): staggered release at the slam,
  // a drifting hang, then a staggered return onto the moving surface.
  const RELEASE = SLAM_AT, BACK = 3.95;
  function amount(i, t) {
    const d = delay[i];
    if (phase[i] > 0.42) return 0.04 * smooth((t - RELEASE) / 0.3) * (1 - smooth((t - BACK - 0.6) / 0.5));
    const out = smooth((t - RELEASE - d * 0.45) / 0.75), back = smooth((t - BACK - (1 - d) * 0.35) / 0.65);
    return out * (1 - back);
  }
  let proof = {};
  return {
    canvas: out,
    proof: () => proof,
    async frame(time) {
      if (!Number.isFinite(time)) throw new Error("Frame time must be finite");
      const t = Math.max(0, time) % ROUTINE;
      const j = figure.pose(t);
      sampler.write();
      const cam = cameraAt(t, j.pelvis.y);
      camera.position.copy(cam.pos);
      camera.lookAt(cam.look);
      camera.updateMatrixWorld();
      const lensPoint = camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.4));
      const src = sampler.positions;
      let scattered = 0;
      // Scan line between solid and points (skin mode only).
      let cut = 10, solid = false, label = "";
      if (!lens) {
        if (t < 0.55) { solid = true; cut = -0.2; label = "SOLID"; }
        else if (t < 1.15) { solid = true; cut = mix(-0.1, 2.3, smooth((t - 0.55) / 0.6)); label = "SCAN → POINTS"; }
        else if (t < 5.35) { cut = 10; label = t < RELEASE ? "SURFACE POINTS" : t < BACK + 0.3 ? "RUSH · BOKEH" : "REASSEMBLE"; }
        else { solid = true; cut = mix(2.3, -0.1, smooth((t - 5.35) / 0.6)); label = "POINTS → SOLID"; }
      } else label = "LENS RUSH · FOCUS PULL";
      for (let i = 0; i < N; i++) {
        let x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2], a = 1, k = 0, glowing = 0;
        if (lens) {
          const u = (t * 0.42 + phase[i]) % 1, flying = u < 0.3;
          if (flying) { k = smooth(u / 0.3) ; a = 1 - smooth((u - 0.22) / 0.08); }
        } else k = amount(i, t);
        if (k > 0) {
          // Fly towards a point just in front of the lens, with spread and a swirl.
          const tx = lensPoint.x - x, ty = lensPoint.y - y, tz = lensPoint.z - z, reach = len[i] * (lens ? 1.05 : 0.98);
          const spread = 0.9 * (1 - len[i] * 0.6), sw = Math.sin(t * 2.2 + delay[i] * 9) * 0.25 * k;
          x += (tx * reach + dir[i * 3] * spread + sw) * k;
          y += (ty * reach + dir[i * 3 + 1] * spread * 0.7) * k;
          z += (tz * reach + dir[i * 3 + 2] * spread - sw) * k;
          glowing = k * 0.08;
          if (k > 0.05) scattered++;
        }
        draw[i * 3] = x; draw[i * 3 + 1] = y; draw[i * 3 + 2] = z;
        alpha[i] = a; glow[i] = glowing;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.normal.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
      geo.attributes.aGlow.needsUpdate = true;
      const focusBody = camera.position.distanceTo(j.chest);
      uniforms.uFocus.value = lens ? mix(focusBody, 1.25, smooth(0.5 + 0.5 * Math.sin((t / ROUTINE) * Math.PI * 4 - 1.2) * 1.6)) : focusBody;
      uniforms.uAperture.value = lens ? 0.11 : 0.085;
      uniforms.uCut.value = cut;
      uniforms.uCutOn.value = solid ? 1 : 0;
      plane.constant = -cut;
      figure.group.visible = solid;
      cloud.visible = !solid || cut > -0.1;
      shadow.position.set(j.pelvis.x, 0.003, j.pelvis.z);
      shadow.scale.setScalar(1.3 - 0.35 * clamp(j.pelvis.y - 0.9));
      renderer.localClippingEnabled = true;
      renderer.render(scene, camera);
      g.drawImage(renderer.domElement, 0, 0, W, H);
      g.font = "800 30px Arial"; g.fillStyle = "#f1ecff"; g.fillText(lens ? "PARTICLE LENS" : "SKINNED POINT CLOUD", 44, 60);
      g.font = "700 20px monospace"; g.fillStyle = lens ? "#7fe3ff" : "#c5a8ff"; g.fillText(label, 46, 92);
      // Bokeh measure: mean sprite diameter of the nearest 5% versus the farthest half.
      const view = camera.matrixWorldInverse, v = new THREE.Vector3(), sizes = [];
      for (let i = 0; i < N; i += 7) {
        v.set(draw[i * 3], draw[i * 3 + 1], draw[i * 3 + 2]).applyMatrix4(view);
        const d = Math.max(0.05, -v.z), base = (uniforms.uSize.value * uniforms.uScale.value) / d;
        sizes.push([d, Math.min(140, base + uniforms.uAperture.value * Math.abs(1 / d - 1 / uniforms.uFocus.value) * uniforms.uScale.value)]);
      }
      sizes.sort((p, q) => p[0] - q[0]);
      const mean = (list) => list.reduce((s, p) => s + p[1], 0) / Math.max(1, list.length);
      const near = mean(sizes.slice(0, Math.ceil(sizes.length * 0.05))), far = mean(sizes.slice(Math.floor(sizes.length / 2)));
      proof = { mode: lens ? "particle-lens" : "skin-cloud", figure: "Juno", routineTime: t, points: N, solid, scattered: scattered / N, bokeh: { near, far, ratio: near / far }, camera: camera.position.toArray(), sample: Array.from(sampler.positions.slice(0, 9)), choreography: "Juno routine" };
    },
  };
}
