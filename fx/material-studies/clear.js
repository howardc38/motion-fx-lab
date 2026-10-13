// "Clear" — a 15-second drinks advert assembled from the water studies.
// Fictional brand. Edit BRAND below: every on-screen word, the 3D letters behind
// the bottle and the bottle label read from this one object.
import * as THREE from "three";
import * as K from "./water-kit.js";
import { clamp, smooth, mix, hash, TAU } from "./common.js";
import { TIMELINES, chapterAt } from "./timelines.js";

export const BRAND = Object.freeze({
  name: "CLEAR",
  tagline: "Nothing to hide.",
  detail: "Sparkling spring water · 330 ml",
  cta: "Taste it ice-cold  →",
  supers: Object.freeze(["Every bottle starts with a drop.", "Pure spring water. Nothing added.", "Naturally sparkling."]),
});

// Which library effect each chapter is built from (catalogue ids):
//   drop, crown  -> "water-impact"     createCrown, ripple, createSurface
//   form         -> "water-morph"      createLiquid metaballs collecting into bottleSDF
//   glass        -> "water-material"   transmission bottle refracting the brand letters
//   dive, rise   -> "water-underwater" caustic floor, light rays, bubbles, Snell window
export const EFFECTS = Object.freeze(["water-impact", "water-morph", "water-material", "water-underwater"]);

const FORMATS = { "16:9": { w: 1280, h: 720, fov: 30 }, "9:16": { w: 720, h: 1280, fov: 47 } };
const SLOW = 0.5; // crown chapter plays at half speed
const BOTTLE_CAP = K.BOTTLE.neckTop + 0.07;

// Time-aware cubic Hermite through keyframes: C1 continuous, no stops at keys.
function spline(keys, t, pick) {
  if (t <= keys[0].t) return pick(keys[0]);
  const n = keys.length;
  if (t >= keys[n - 1].t) return pick(keys[n - 1]);
  let i = 0;
  while (t > keys[i + 1].t) i++;
  const k0 = keys[Math.max(0, i - 1)],
    k1 = keys[i],
    k2 = keys[i + 1],
    k3 = keys[Math.min(n - 1, i + 2)],
    h = k2.t - k1.t,
    u = (t - k1.t) / h;
  const p1 = pick(k1),
    p2 = pick(k2),
    p0 = pick(k0),
    p3 = pick(k3);
  const m1 = p1.map((v, j) => (k2.t === k0.t ? 0 : ((p2[j] - p0[j]) / (k2.t - k0.t)) * h)),
    m2 = p2.map((v, j) => (k3.t === k1.t ? 0 : ((p3[j] - p1[j]) / (k3.t - k1.t)) * h));
  const u2 = u * u,
    u3 = u2 * u;
  return p1.map((v, j) => (2 * u3 - 3 * u2 + 1) * v + (u3 - 2 * u2 + u) * m1[j] + (-2 * u3 + 3 * u2) * p2[j] + (u3 - u2) * m2[j]);
}

// Camera keys. `aim` is the look-at point, `dir` points from it to the camera,
// `fit` is the [width, height] that must fit in frame; `pfit` overrides it in 9:16.
// `shift` moves the subject on screen (fraction of the frame) for type layouts.
// The fits keep the whole bottle and its cap in frame (with headroom for the cap
// dropping on and the hop before the dive), above water and below it.
const CAMERA = [
  { t: 0, aim: [0, 0.6, 0], dir: [0.12, 0.05, 1], fit: [1.7, 1.3], pfit: [1.1, 1.8] },
  { t: 0.8, aim: [0, 0.5, 0], dir: [0.1, 0.07, 1], fit: [3.2, 1.8], pfit: [2.4, 2.8] },
  { t: 2.0, aim: [0, 0.75, 0], dir: [0.16, 0.12, 1], fit: [4.0, 2.4], pfit: [3.0, 3.4] },
  { t: 3.2, aim: [0, 1.35, 0], dir: [0.2, 0.1, 1], fit: [3.8, 3.6], pfit: [2.6, 3.8] },
  { t: 4.5, aim: [0, 1.5, -0.2], dir: [0.05, 0.06, 1], fit: [5.0, 4.0], pfit: [2.8, 3.8] },
  { t: 5.6, aim: [0, 1.38, -0.6], dir: [-0.24, 0.05, 1], fit: [6.4, 3.9], pfit: [3.4, 4.0] },
  { t: 7.3, aim: [0, 1.38, -0.6], dir: [0.26, 0.06, 1], fit: [6.4, 3.9], pfit: [3.4, 4.0] },
  { t: 7.9, aim: [0, 1.15, 0], dir: [0.16, 0.12, 1], fit: [4.6, 4.1], pfit: [2.8, 4.2] },
  { t: 8.5, aim: [0, -0.85, 0], dir: [0.12, 0.06, 1], fit: [4.0, 4.1], pfit: [2.5, 4.2] },
  { t: 10.3, aim: [0, -1.85, 0], dir: [-0.22, -0.02, 1], fit: [4.6, 4.5], pfit: [2.8, 4.6] },
  { t: 11.0, aim: [0, -1.05, 0], dir: [-0.1, -0.12, 1], fit: [4.0, 4.0], pfit: [2.6, 4.4] },
  { t: 11.7, aim: [0, 1.2, 0], dir: [0.02, 0.05, 1], fit: [4.4, 4.0], pfit: [2.6, 4.4] },
  { t: 12.6, aim: [0, 1.25, 0], dir: [0.06, 0.07, 1], fit: [5.0, 3.5], pfit: [2.9, 5.7], shift: 1 },
  { t: 15, aim: [0, 1.25, 0], dir: [0.14, 0.09, 1], fit: [4.6, 3.3], pfit: [2.8, 5.4], shift: 1 },
];
// The widest the brand word behind the bottle may be (scene units). In 9:16 it is set smaller, so
// every letter stays inside the narrow frame while the camera swings round the bottle.
const WORD_WIDTH = { "16:9": 6.4, "9:16": 2.6 };
// The cap drops onto the bottle from here (bottle space), inside the frame in both formats.
const CAP_DROP = 3.0;

function bottleBase(t) {
  // Where the bottle stands (y of its base) and how it tilts, from formation to the end card.
  if (t < 7.55) return { y: 0.02 + 0.03 * Math.sin(Math.max(0, t - 4.5) * 2.2), tilt: 0 };
  if (t < 7.7) return { y: 0.05 + 0.18 * smooth((t - 7.55) / 0.15), tilt: 0 };
  if (t < 8.5) {
    const u = (t - 7.7) / 0.8;
    return { y: mix(0.23, -2.5, u * u * (2.2 - 1.2 * u)), tilt: 0.12 * u };
  }
  if (t < 10.5) {
    const u = (t - 8.5) / 2;
    return { y: mix(-2.5, -3.5, smooth(u)), tilt: 0.12 + 0.1 * Math.sin(u * 3) };
  }
  if (t < 11.75) {
    const u = (t - 10.5) / 1.25;
    return { y: mix(-3.5, 0.32, u ** 2.1), tilt: 0.2 * (1 - u) };
  }
  const u = t - 11.75;
  return { y: 0.06 + 0.26 * Math.exp(-u * 3.2) * Math.cos(u * 7), tilt: 0.03 * Math.exp(-u * 2) * Math.sin(u * 6) };
}

function rounded(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function fitFont(g, text, weight, size, maxWidth, family = "Arial") {
  g.font = `${weight} ${size}px ${family}`;
  const w = g.measureText(text).width;
  if (w > maxWidth) {
    size = Math.floor((size * maxWidth) / w);
    g.font = `${weight} ${size}px ${family}`;
  }
  return size;
}
const pop = (p) => (p <= 0 ? 0 : 1 - Math.exp(-6.5 * p) * Math.cos(9 * p));

export async function createClearFilm({ format = "16:9", brand = BRAND } = {}) {
  const F = FORMATS[format];
  if (!F) throw new Error("Unknown format: " + format);
  const W = F.w,
    H = F.h,
    portrait = H > W,
    spec = TIMELINES.water;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d", { willReadFrequently: true });

  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(F.fov, W / H, 0.05, 200);
  scene.environment = K.studioEnvironment(renderer);
  scene.environmentRotation = new THREE.Euler();
  const sky = K.skyUniforms();
  scene.add(K.createDome(sky));
  scene.fog = new THREE.FogExp2(K.horizonColor(false), 0.05);
  scene.add(new THREE.HemisphereLight("#d6f7ff", "#0b3247", 1.1));
  const rim = new THREE.DirectionalLight("#ffffff", 3.2);
  rim.position.set(-3, 5, -6);
  const fill = new THREE.DirectionalLight("#fff3e0", 1.1);
  fill.position.set(4, 3, 7);
  scene.add(rim, fill);

  // water-impact: surface, crown, drop
  const water = K.waterMaterial({ thickness: 1.1, attenuationDistance: 3.2 }),
    sheet = K.waterMaterial({ side: THREE.DoubleSide, thickness: 0.3 }),
    pool = K.createSurface(K.waterMaterial({ thickness: 0.12, attenuationDistance: 2.4, color: "#cdeff2", attenuationColor: "#137a8f" }));
  const under = new THREE.Mesh(pool.geometry, K.underSurfaceMaterial(sky));
  const floor = K.createCausticFloor(sky, { y: -6.2, scale: 0.55 });
  const crown = K.createCrown(sheet),
    drop = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), K.waterMaterial({ thickness: 0.3, attenuationDistance: 6, color: "#eefcff", env: 2.4 }));
  scene.add(pool.mesh, under, floor.mesh, crown.mesh, ...crown.droplets, drop);
  // water-morph: metaballs that collect into the bottle
  const liquid = K.createLiquid(K.waterMaterial({ thickness: 1.2, attenuationDistance: 3 }), { resolution: 56, half: 1.6, maxPolys: 160000 });
  liquid.mesh.position.set(0, 1.35, 0);
  scene.add(liquid.mesh);
  // water-material: the product bottle
  const bottle = new THREE.Group(),
    glass = new THREE.MeshPhysicalMaterial({
      color: "#f3fdff",
      transmission: 1,
      thickness: 1.7,
      ior: 1.42,
      roughness: 0.015,
      metalness: 0,
      attenuationColor: "#8fdbe3",
      attenuationDistance: 7,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMap: K.productEnvironment(renderer),
      envMapIntensity: 2.4,
      specularIntensity: 1,
    });
  const body = new THREE.Mesh(K.bottleGeometry(128), glass);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.215, 0.215, 0.22, 48),
    new THREE.MeshPhysicalMaterial({ color: K.PALETTE.accent, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
  );
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 1024;
  labelCanvas.height = 256;
  {
    const lg = labelCanvas.getContext("2d", { willReadFrequently: true });
    lg.clearRect(0, 0, 1024, 256);
    lg.fillStyle = "#ffffff";
    lg.textAlign = "center";
    lg.textBaseline = "middle";
    fitFont(lg, brand.name, 900, 120, 420);
    lg.fillText(brand.name, 256, 112);
    lg.font = "700 26px Arial";
    lg.fillText("SPARKLING SPRING WATER", 256, 196);
    lg.fillRect(126, 160, 260, 3);
  }
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  labelTex.anisotropy = 4;
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.545, 0.545, 0.52, 96, 1, true),
    new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false, side: THREE.FrontSide }),
  );
  label.position.y = 0.86;
  label.renderOrder = 4;
  bottle.add(body, cap, label);
  scene.add(bottle);
  const fizz = K.createBubbles(46);
  fizz.mesh.material = fizz.mesh.material.clone();
  fizz.mesh.material.depthTest = false;
  fizz.mesh.renderOrder = 5;
  bottle.add(fizz.mesh);
  // Brand letters behind the bottle: the refraction proof.
  const letterMat = new THREE.MeshPhysicalMaterial({ color: K.PALETTE.accent, roughness: 0.34, clearcoat: 0.6, emissive: K.PALETTE.accent, emissiveIntensity: 0.32 });
  const word = await K.extrudedWord(brand.name, letterMat, { height: 1.45, depth: 0.32 });
  word.group.position.set(0, -2, -2.35);
  const wordScale = Math.min(1, WORD_WIDTH[format] / word.width);
  word.group.scale.setScalar(wordScale);
  const LETTER_Y = 0.86; // letter centre: the word stands from the waterline to the bottle shoulder
  scene.add(word.group);
  // water-underwater
  const bubbles = K.createBubbles(110),
    rays = K.createLightRays(sky, 9);
  scene.add(bubbles.mesh, rays.group);

  let proof;
  const supers = [
    [2.55, 4.35, brand.supers[0]],
    [4.95, 7.35, brand.supers[1]],
    [8.6, 10.35, brand.supers[2]],
  ];

  function setUnderwater(on) {
    sky.underwater.value = on ? 1 : 0;
    scene.fog.color.copy(K.horizonColor(on));
    scene.fog.density = on ? 0.06 : 0.05;
    sky.fogDensity.value = on ? 0.06 : 0.05;
  }

  function placeCamera(t) {
    const aim = spline(CAMERA, t, (k) => k.aim),
      dir = new THREE.Vector3(...spline(CAMERA, t, (k) => k.dir)).normalize(),
      fit = spline(CAMERA, t, (k) => (portrait ? k.pfit : k.fit)),
      shift = spline(CAMERA, t, (k) => [k.shift ?? 0])[0];
    const vf = THREE.MathUtils.degToRad(F.fov) / 2,
      hf = Math.atan(Math.tan(vf) * (W / H)),
      dist = Math.max(fit[0] / (2 * Math.tan(hf)), fit[1] / (2 * Math.tan(vf)));
    camera.position.set(aim[0] + dir.x * dist, aim[1] + dir.y * dist, aim[2] + dir.z * dist);
    camera.lookAt(aim[0], aim[1], aim[2]);
    // Lens shift leaves room for the end-card type without changing perspective.
    if (shift > 0) camera.setViewOffset(W, H, portrait ? 0 : -W * 0.2 * shift, portrait ? -H * 0.1 * shift : 0, W, H);
    else camera.clearViewOffset();
    camera.updateMatrixWorld();
    return { dist, shift };
  }

  // Signed distance of the forming liquid (water-morph). The rebound jet becomes the
  // base, droplets spiral down onto the rising liquid, and the liquid fills the bottle
  // shape from the bottom up. By 4.45 s the field is exactly the bottle.
  function formField(t) {
    const fillY = 2.66 * smooth((t - 2.25) / 1.85),
      jl = clamp((t - 2.0) / 0.9),
      jetTop = 0.2 + 0.85 * Math.sin(jl * Math.PI * 0.85),
      jetR = 0.17 * (1 - smooth((t - 2.55) / 0.4)),
      settle = smooth((t - 3.95) / 0.45),
      appear = smooth((t - 2.02) / 0.3),
      blobs = [];
    for (let k = 0; k < 12; k++) {
      const ph = (k / 12 + (t - 2) * 0.7 + 0.3 * hash(k)) % 1,
        h = Math.min(2.5, fillY + 0.08 + (1 - ph) * 1.05),
        ang = (k / 12) * TAU * 2 + (t - 2) * 4.2,
        rad = K.bottleRadius(Math.max(0.05, Math.min(2.6, h))) + 0.24,
        r = (0.075 + 0.05 * hash(k + 7)) * appear * (1 - settle) * Math.min(1, ph * 6);
      if (r > 0.004) blobs.push([Math.cos(ang) * rad, h, Math.sin(ang) * rad, r]);
    }
    const wob = 0.035 * (1 - settle);
    return (x, y, z) => {
      y += 1.35; // MarchingCubes samples around the mesh centre; the bottle base is at y = 0
      const th = Math.atan2(z, x);
      let d = Math.max(K.bottleSDF(x, y, z), y - fillY - wob * Math.sin(th * 3 + t * 9));
      if (jetR > 0.003) {
        const yc = Math.max(-0.3, Math.min(jetTop, y));
        d = K.smin(d, Math.hypot(x, y - yc, z) - jetR, 0.14);
      }
      for (const [bx, by, bz, br] of blobs) d = K.smin(d, Math.hypot(x - bx, y - by, z - bz) - br, 0.16);
      return d;
    };
  }

  function frame(seconds) {
    const { chapter, time: t } = chapterAt(spec, seconds);
    const cam = placeCamera(t);
    const camUnder = camera.position.y < 0;
    setUnderwater(camUnder);
    under.visible = camUnder; // a steep crater wall must not show the underside from above
    floor.mesh.visible = camUnder; // from above, the surface shows the deep dome instead
    floor.uniforms.time.value = t;
    under.material.uniforms.time.value = t;
    // Crown clock: half speed in the crown chapter, then real time.
    const impactS = t < 0.8 ? -1 : t < 2.0 ? (t - 0.8) * SLOW : 0.6 + (t - 2.0);
    // drop
    drop.visible = t < 0.8;
    if (drop.visible) {
      const k = t / 0.8;
      drop.position.set(0, 1.18 - 1.06 * k ** 1.7, 0);
      const wob = 0.06 * Math.sin(t * 26);
      drop.scale.set(0.16 * (1 - wob), 0.16 * (1.28 + wob), 0.16 * (1 - wob));
    }
    // crowns: main impact, plunge and breach
    const base = bottleBase(t),
      plungeS = t - 7.82,
      breachS = t - 11.38;
    if (impactS >= 0 && impactS < 0.62) crown.update(clamp(impactS / 0.6), impactS, { scale: 0.8, wobble: 0.4 });
    else if (plungeS > 0 && plungeS < 0.7) crown.update(clamp(plungeS / 0.7), plungeS, { scale: 1.3, wobble: 1.7 });
    else if (breachS > 0 && breachS < 0.6) crown.update(clamp(breachS / 0.6), breachS, { scale: 1.05, wobble: 2.9 });
    else crown.update(0, 0);
    // liquid formation
    const forming = t >= 2.0 && t < 4.5;
    liquid.mesh.visible = forming;
    if (forming) liquid.fill(formField(t));
    // glass bottle
    const glassOn = t >= 4.5;
    bottle.visible = glassOn;
    bottle.position.set(0, base.y, 0);
    // Spins while it is shown off, then settles with the label facing the camera.
    bottle.rotation.set(base.tilt * 0.6, -Math.PI / 2 + 4 * Math.PI * (1 - smooth((t - 4.5) / 8.7)) + 0.12 * Math.sin(Math.max(0, t - 13.2) * 1.6), base.tilt);
    const capIn = smooth((t - 4.45) / 0.35);
    cap.position.y = mix(CAP_DROP, BOTTLE_CAP, capIn);
    cap.rotation.y = (1 - capIn) * 4;
    // The label stays off while the glass shows the letters through it; it arrives with the end card.
    label.material.opacity = smooth((t - 11.9) / 0.6);
    for (let i = 0; i < 46; i++) {
      const sp = 0.22 + hash(i + 2) * 0.35,
        y = 0.12 + ((t * sp + hash(i + 9) * 2) % 1.9),
        r = 0.08 + 0.3 * hash(i + 4),
        a = hash(i + 6) * TAU + t * 0.4;
      fizz.set(i, Math.cos(a) * r, y, Math.sin(a) * r, glassOn ? 0.012 + 0.014 * hash(i + 8) : 0);
    }
    fizz.commit();
    // brand letters rise behind the bottle, then sink before the dive
    const ly = t < 7.45 ? mix(-2.1, LETTER_Y, smooth((t - 4.3) / 0.65)) : mix(LETTER_Y, -2.3, smooth((t - 7.45) / 0.6));
    word.group.position.y = ly;
    word.group.visible = ly > -2.05 && !camUnder;
    // the highlight band sweeps across the glass
    scene.environmentRotation.y = mix(-0.9, 1.4, smooth((t - 4.7) / 2.4)) + 0.2 * Math.sin(t * 0.3);
    // surface: ripples from every event
    pool.update((x, z, r) => {
      let h = K.swell(x, z, t, 0.012);
      if (impactS > 0) h += K.ripple(r, impactS, { amplitude: 0.11, speed: 1.3, wavelength: 0.48, decay: 0.55 });
      if (impactS > 0 && impactS < 0.6) h -= 0.1 * Math.sin((Math.PI * impactS) / 0.6) * Math.exp(-r * r * 6);
      if (t > 4.5 && t < 7.7) h += 0.02 * Math.sin(r * 9 - t * 4) * Math.exp(-((r - 0.6) ** 2) * 2);
      if (plungeS > 0) h += K.ripple(r, plungeS, { amplitude: 0.16, speed: 1.6, wavelength: 0.6, decay: 0.5 });
      if (breachS > 0) h += K.ripple(r, breachS, { amplitude: 0.13, speed: 1.4, wavelength: 0.55, decay: 0.5 });
      if (t > 11.9) h += 0.018 * Math.sin(r * 8 - t * 3.6) * Math.exp(-((r - 0.75) ** 2) * 1.5);
      return h;
    });
    // bubbles: plunge trail, columns around the bottle, ambient
    const bubbleOn = t > 7.75 && t < 12.2;
    bubbles.mesh.visible = bubbleOn;
    if (bubbleOn) {
      for (let i = 0; i < 110; i++) {
        let x, y, z, r;
        if (i < 40) {
          // released along the plunge path, rising and spreading
          const born = 7.8 + (i / 40) * 0.7,
            age = t - born,
            by = bottleBase(born).y + 0.4 + hash(i) * 1.6;
          r = age > 0 ? 0.03 + 0.05 * hash(i + 1) : 0;
          y = by + age * (0.7 + hash(i + 2) * 0.7);
          x = (hash(i + 3) - 0.5) * 0.8 + Math.sin(age * 3 + i) * 0.12 * age;
          z = (hash(i + 4) - 0.5) * 0.8;
        } else if (i < 80) {
          // helix around the sinking bottle
          const k = i - 40,
            sp = 0.6 + hash(i) * 0.5,
            phase = (t * sp * 0.45 + hash(i + 5)) % 1,
            a = hash(i + 6) * TAU + t * 1.3;
          r = 0.035 + 0.05 * hash(i + 7);
          y = base.y - 0.3 + phase * 4.2;
          x = Math.cos(a) * (0.75 + 0.35 * hash(k));
          z = Math.sin(a) * (0.75 + 0.35 * hash(k + 1));
        } else {
          const sp = 0.4 + hash(i) * 0.5;
          r = 0.03 + 0.07 * hash(i + 8);
          y = -6.2 + ((t * sp + hash(i + 9) * 6.2) % 6.2);
          x = (hash(i + 10) - 0.5) * 11;
          z = (hash(i + 11) - 0.5) * 8 - 1.5;
        }
        bubbles.set(i, x, Math.min(-0.04, y), z, y < -0.04 ? r : 0, 1.08);
      }
      bubbles.commit();
    }
    rays.group.visible = camUnder;
    if (camUnder) rays.update(t, camera, { centerX: 0.4, centerZ: -2.2, spread: 9, top: 0, length: 8, strength: 1 });
    renderer.render(scene, camera);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.drawImage(renderer.domElement, 0, 0);
    overlays(t);
    const mid = new THREE.Vector3(0, base.y + 0.85, 0).project(camera);
    // Screen rectangles (pixels) of the cap and the brand letters, so tests can prove nothing is cropped.
    const rect = (object) => {
      const box = new THREE.Box3().setFromObject(object),
        r = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (let i = 0; i < 8; i++) {
        const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera),
          x = ((p.x + 1) / 2) * W,
          y = ((1 - p.y) / 2) * H;
        r.x0 = Math.min(r.x0, x);
        r.x1 = Math.max(r.x1, x);
        r.y0 = Math.min(r.y0, y);
        r.y1 = Math.max(r.y1, y);
      }
      return r;
    };
    proof = {
      chapter: chapter.id,
      bottleScreen: glassOn ? { x: ((mid.x + 1) / 2) * W, y: ((1 - mid.y) / 2) * H } : null,
      effect: chapter.effect ?? null,
      time: t,
      format,
      size: { w: W, h: H },
      underwater: camUnder,
      cameraY: camera.position.y,
      cameraDistance: cam.dist,
      bottle: forming ? "liquid" : glassOn ? "glass" : "none",
      lettersVisible: word.group.visible,
      wordWidth: word.width * wordScale,
      capRect: glassOn ? rect(cap) : null,
      wordRect: word.group.visible ? rect(word.group) : null,
      liquidVertices: forming ? liquid.mesh.geometry.drawRange.count : 0,
      liquidSolver: false,
    };
  }

  const vignette = (() => {
    const v = document.createElement("canvas");
    v.width = W;
    v.height = H;
    const vg = v.getContext("2d", { willReadFrequently: true }),
      rg = vg.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.3, W / 2, H * 0.48, Math.hypot(W, H) * 0.62);
    rg.addColorStop(0, "rgba(1,10,18,0)");
    rg.addColorStop(1, "rgba(1,10,18,0.55)");
    vg.fillStyle = rg;
    vg.fillRect(0, 0, W, H);
    return v;
  })();
  function overlays(t) {
    g.drawImage(vignette, 0, 0);
    // the liquid-to-glass moment gets a soft flash
    const flash = Math.exp(-(((t - 4.5) / 0.09) ** 2));
    if (flash > 0.01) {
      const rg = g.createRadialGradient(W * (portrait ? 0.5 : 0.5), H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.6);
      rg.addColorStop(0, `rgba(235,253,255,${0.75 * flash})`);
      rg.addColorStop(1, "rgba(235,253,255,0)");
      g.fillStyle = rg;
      g.fillRect(0, 0, W, H);
    }
    g.textBaseline = "alphabetic";
    for (const [a, b, line] of supers) {
      const k = smooth((t - a) / 0.35) * (1 - smooth((t - (b - 0.35)) / 0.35));
      if (k <= 0) continue;
      g.save();
      g.globalAlpha = k;
      g.fillStyle = "#ffffff";
      g.shadowColor = "rgba(0,20,35,.55)";
      g.shadowBlur = 12;
      fitFont(g, line, 700, portrait ? 34 : 30, W - 96);
      g.textAlign = portrait ? "center" : "left";
      g.fillText(line, portrait ? W / 2 : 64, H - (portrait ? 150 : 58) + (1 - k) * 10);
      g.restore();
    }
    // brand reveal: letters rise out of a waterline
    if (t >= 11.85) {
      const nameSize = portrait ? 132 : 148,
        x0 = portrait ? W / 2 : 92,
        yName = portrait ? 236 : 318;
      g.save();
      g.letterSpacing = "6px";
      const size = fitFont(g, brand.name, 900, nameSize, portrait ? W - 80 : W * 0.48);
      const width = g.measureText(brand.name).width;
      const left = portrait ? x0 - width / 2 : x0;
      // clip to a gently waving waterline that drops away as the name rises
      const reveal = smooth((t - 11.85) / 0.75);
      g.beginPath();
      g.moveTo(left - 20, yName - size - 40);
      g.lineTo(left + width + 30, yName - size - 40);
      const waterline = yName + 18 - (1 - reveal) * 0 + 4;
      for (let x = left + width + 30; x >= left - 20; x -= 12) g.lineTo(x, waterline + 6 * Math.sin(x * 0.03 + t * 6) * (1 - reveal));
      g.closePath();
      g.clip();
      g.fillStyle = "#ffffff";
      g.shadowColor = "rgba(0,25,45,.45)";
      g.shadowBlur = 18;
      const chars = [...brand.name];
      let x = left;
      chars.forEach((ch, i) => {
        const k = smooth((t - 11.85 - i * 0.06) / 0.55);
        g.globalAlpha = k;
        g.textAlign = "left";
        g.fillText(ch, x, yName + (1 - k) * size * 0.9);
        x += g.measureText(ch).width + 6;
      });
      g.restore();
      const k2 = smooth((t - 12.45) / 0.45);
      if (k2 > 0) {
        g.save();
        g.globalAlpha = k2;
        g.fillStyle = "#ffffff";
        g.shadowColor = "rgba(0,25,45,.45)";
        g.shadowBlur = 12;
        g.textAlign = portrait ? "center" : "left";
        fitFont(g, brand.tagline, 700, portrait ? 44 : 46, portrait ? W - 80 : W * 0.46);
        g.fillText(brand.tagline, portrait ? W / 2 : x0 + 4, yName + (portrait ? 70 : 72) + (1 - k2) * 12);
        g.globalAlpha = smooth((t - 12.75) / 0.45);
        fitFont(g, brand.detail, 600, portrait ? 26 : 24, portrait ? W - 80 : W * 0.46);
        g.fillStyle = "rgba(230,250,255,.92)";
        g.fillText(brand.detail, portrait ? W / 2 : x0 + 4, yName + (portrait ? 116 : 116));
        g.restore();
      }
      // CTA sticker pops in, with a slight tilt
      const sp = t - 13.15;
      if (sp > 0) {
        const s = pop(sp / 0.9),
          tilt = -0.05 + 0.03 * Math.exp(-sp * 3) * Math.sin(sp * 12);
        g.save();
        g.font = `800 ${portrait ? 34 : 30}px Arial`;
        const tw = g.measureText(brand.cta).width,
          pw = tw + 64,
          ph = portrait ? 78 : 70,
          cx = portrait ? W / 2 : x0 + pw / 2,
          cy = portrait ? H - 128 : yName + 196;
        g.translate(cx, cy);
        g.rotate(tilt);
        g.scale(s, s);
        g.shadowColor = "rgba(0,20,35,.4)";
        g.shadowBlur = 18;
        g.shadowOffsetY = 6;
        g.fillStyle = K.PALETTE.accent;
        rounded(g, -pw / 2, -ph / 2, pw, ph, ph / 2);
        g.fill();
        g.shadowColor = "transparent";
        g.lineWidth = 4;
        g.strokeStyle = "#ffffff";
        g.stroke();
        g.fillStyle = "#ffffff";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(brand.cta, 0, 2);
        g.restore();
      }
    }
  }
  return { canvas, frame, proof: () => proof, size: { w: W, h: H }, brand };
}
