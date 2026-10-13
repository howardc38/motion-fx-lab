// Shared parts for the water studies and the "Clear" film: materials, a painted
// studio environment, sky/underwater domes, caustics, crown splash, bubbles and
// the bottle profile used by both the liquid (metaball) and glass versions.
// Everything here is authored geometry driven by time; it is not a fluid solver.
import * as THREE from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import { clamp, smooth, mix, hash, TAU } from "./common.js";

export const PALETTE = Object.freeze({
  zenith: "#020a12",
  sky: "#05243a",
  horizon: "#1f6b80",
  glow: "#d4f8ff",
  underTop: "#5fd0d6",
  underMid: "#0f6f86",
  underDeep: "#022233",
  sand: "#5fb7b0",
  accent: "#ff6b57",
  cream: "#fff2dc",
});

// ---------- materials ----------
export function waterMaterial(o = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: o.color ?? "#c6f4f6",
    metalness: 0,
    roughness: o.roughness ?? 0.035,
    transmission: 1,
    thickness: o.thickness ?? 1.2,
    ior: o.ior ?? 1.333,
    attenuationColor: o.attenuationColor ?? "#36b5c3",
    attenuationDistance: o.attenuationDistance ?? 2.8,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    specularIntensity: 1,
    envMapIntensity: o.env ?? 1.7,
    side: o.side ?? THREE.FrontSide,
  });
}

// ---------- painted studio environment (PMREM) ----------
const paletteRGB = (hex) => new THREE.Color(hex);
function gradientStops(g, w, h, stops) {
  const lg = g.createLinearGradient(0, 0, 0, h);
  for (const [at, c] of stops) lg.addColorStop(at, c);
  g.fillStyle = lg;
  g.fillRect(0, 0, w, h);
}
function softbox(g, x, y, w, h, color, alpha) {
  // Feathered rectangle built from two gradients; no canvas filters.
  g.save();
  g.globalAlpha = alpha;
  const cx = x + w / 2,
    cy = y + h / 2;
  const rg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) / 2);
  rg.addColorStop(0, color);
  rg.addColorStop(0.55, color);
  rg.addColorStop(1, "rgba(255,255,255,0)");
  g.translate(cx, cy);
  g.scale(w / Math.max(w, h), h / Math.max(w, h));
  g.translate(-cx, -cy);
  g.fillStyle = rg;
  g.fillRect(cx - Math.max(w, h) / 2, cy - Math.max(w, h) / 2, Math.max(w, h), Math.max(w, h));
  g.restore();
}
const envCache = new WeakMap();
// One cached environment per renderer. Equirectangular: x = longitude, y = latitude.
export function studioEnvironment(renderer) {
  let env = envCache.get(renderer);
  if (env) return env;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d", { willReadFrequently: true });
  gradientStops(g, 1024, 512, [
    [0, "#2c6e88"],
    [0.3, "#0b3047"],
    [0.5, PALETTE.horizon],
    [0.56, "#154f61"],
    [1, "#020c14"],
  ]);
  // Softboxes stay above ~40° so water at grazing angles reflects only the gradient.
  softbox(g, 300, 8, 420, 70, "#ffffff", 0.95); // overhead
  softbox(g, 40, 40, 110, 80, "#ffffff", 0.9); // left
  softbox(g, 560, 46, 90, 70, "#ffffff", 0.85); // behind
  softbox(g, 860, 50, 130, 70, PALETTE.glow, 0.8); // kicker
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  env = pm.fromEquirectangular(tex).texture;
  pm.dispose();
  tex.dispose();
  envCache.set(renderer, env);
  return env;
}

// Product-shot lighting for glass: a dark room with two tall strip lights behind
// the subject (they draw its edges) and one overhead box. Equirect u = 0.25 is -z.
const productCache = new WeakMap();
export function productEnvironment(renderer) {
  let env = productCache.get(renderer);
  if (env) return env;
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d", { willReadFrequently: true });
  gradientStops(g, 1024, 512, [
    [0, "#10354a"],
    [0.45, "#04121c"],
    [0.55, "#0b3a4a"],
    [1, "#01060a"],
  ]);
  for (const u of [0.135, 0.365]) {
    const x = u * 1024;
    const lg = g.createLinearGradient(x - 26, 0, x + 26, 0);
    lg.addColorStop(0, "rgba(255,255,255,0)");
    lg.addColorStop(0.35, "rgba(255,255,255,1)");
    lg.addColorStop(0.65, "rgba(255,255,255,1)");
    lg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = lg;
    g.fillRect(x - 26, 70, 52, 300);
  }
  softbox(g, 380, 6, 260, 60, "#ffffff", 0.9);
  softbox(g, 700, 200, 120, 110, "#bff4ff", 0.35); // faint front fill
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  env = pm.fromEquirectangular(tex).texture;
  pm.dispose();
  tex.dispose();
  productCache.set(renderer, env);
  return env;
}

// ---------- domes and fog that agree with each other ----------
// The dome colour and the fog colour come from the same function of view
// direction, so distant water and floor dissolve without a horizon band.
export const SKY_GLSL = `
uniform vec3 skyZenith;uniform vec3 skyMid;uniform vec3 skyHorizon;uniform vec3 skyGlow;uniform vec3 glowDir;uniform float glowAmount;
uniform vec3 underTop;uniform vec3 underMid;uniform vec3 underDeep;uniform float underwater;
vec3 skyColor(vec3 d){
  d=normalize(d);
  if(underwater>.5){
    float k=clamp(d.y*.5+.5,0.,1.);
    vec3 c=mix(underDeep,underMid,smoothstep(.0,.62,k));
    c=mix(c,underTop,smoothstep(.55,1.,k));
    float sun=pow(max(dot(d,normalize(vec3(.15,1.,-.25))),0.),12.);
    return c+underTop*sun*.35;
  }
  float y=d.y;
  // Haze owns the horizon: distant water fogs to exactly this colour.
  vec3 c=mix(skyHorizon,skyMid,smoothstep(.03,.42,y));
  c=mix(c,skyZenith,smoothstep(.4,.98,y));
  float a=max(dot(d,normalize(glowDir)),0.);
  float g=(pow(a,28.)+.25*pow(a,6.))*smoothstep(.0,.22,y);
  return c+skyGlow*g*glowAmount;
}`;
export function skyUniforms() {
  return {
    skyZenith: { value: paletteRGB(PALETTE.zenith) },
    skyMid: { value: paletteRGB(PALETTE.sky) },
    skyHorizon: { value: paletteRGB(PALETTE.horizon) },
    skyGlow: { value: paletteRGB(PALETTE.glow) },
    glowDir: { value: new THREE.Vector3(0, 0.3, -1) },
    glowAmount: { value: 0.75 },
    underTop: { value: paletteRGB(PALETTE.underTop) },
    underMid: { value: paletteRGB(PALETTE.underMid) },
    underDeep: { value: paletteRGB(PALETTE.underDeep) },
    underwater: { value: 0 },
    fogDensity: { value: 0.03 },
  };
}
const VERT_WORLD = `varying vec3 vWorld;varying vec3 vNormalW;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;vNormalW=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`;
export function createDome(sky) {
  const mat = new THREE.ShaderMaterial({
    uniforms: sky,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: VERT_WORLD,
    fragmentShader: `${SKY_GLSL}varying vec3 vWorld;void main(){gl_FragColor=vec4(skyColor(vWorld-cameraPosition),1.);
#include <colorspace_fragment>
}`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(90, 48, 24), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  // Centre on the camera of the pass being drawn. The world matrix must be refreshed here:
  // three.js reads it right after this hook, and a stale one would carry the previous
  // frame's camera position into this frame (a history-dependent image).
  dome.onBeforeRender = (r, s, camera) => {
    dome.position.copy(camera.position);
    dome.updateMatrixWorld();
  };
  return dome;
}
// Linear fog colour at the horizon, for MeshPhysicalMaterial objects that use scene.fog.
export function horizonColor(underwater) {
  return underwater ? paletteRGB(PALETTE.underMid) : paletteRGB(PALETTE.horizon);
}

// ---------- caustics (original cellular formulation) ----------
export const CAUSTIC_GLSL = `
vec2 cHash(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p)*43758.5453);}
float cEdge(vec2 p,float t){
  vec2 cell=floor(p),f=fract(p);float d1=8.,d2=8.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
    vec2 g=vec2(float(i),float(j)),o=cHash(cell+g);
    o=.5+.42*sin(t*vec2(.9,1.13)+6.2831*o);
    vec2 r=g+o-f;float d=dot(r,r);
    if(d<d1){d2=d1;d1=d;}else if(d<d2){d2=d;}
  }
  return sqrt(d2)-sqrt(d1);
}
float caustic(vec2 p,float t){
  // Two warped cellular webs; thin gaussian lines with bright knots where they cross.
  vec2 w=p+.45*vec2(sin(p.y*1.3+t*.7+sin(p.x*.7)),sin(p.x*1.1-t*.6+sin(p.y*.9)));
  vec2 w2=p*1.63+3.7+.35*vec2(sin(p.y*2.1-t*.9),sin(p.x*1.9+t*.8));
  float a=cEdge(w,t*.9),b=cEdge(w2,t*1.17);
  float l1=exp(-a*a*70.),l2=exp(-b*b*110.);
  return .75*l1+.45*l2+1.2*l1*l2;
}`;

// Sandy floor seen through or under water: caustic web, gentle dunes, direction-matched fog.
export function createCausticFloor(sky, { size = 160, y = -6, scale = 0.55 } = {}) {
  const uniforms = {
    ...sky,
    time: { value: 0 },
    sand: { value: paletteRGB(PALETTE.sand) },
    causticScale: { value: scale },
    causticGain: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT_WORLD,
    fragmentShader: `${SKY_GLSL}${CAUSTIC_GLSL}
uniform float time;uniform vec3 sand;uniform float causticScale;uniform float causticGain;uniform float fogDensity;varying vec3 vWorld;
void main(){
  vec2 p=vWorld.xz;
  float dune=.5+.5*sin(p.x*.9+sin(p.y*.6)*1.4)*sin(p.y*.7+.6);
  vec3 col=sand*(.55+.25*dune);
  float c=caustic(p*causticScale,time);
  col+=vec3(.75,1.,.95)*c*.85*causticGain;
  float dist=length(vWorld-cameraPosition);
  float fog=1.-exp(-fogDensity*fogDensity*dist*dist);
  col=mix(col,skyColor(vWorld-cameraPosition),clamp(fog,0.,1.));
  gl_FragColor=vec4(col,1.);
#include <colorspace_fragment>
}`,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = y;
  return { mesh: floor, uniforms };
}

// Underside of the water surface: Snell's window overhead, mirror-dark outside it.
export function underSurfaceMaterial(sky) {
  return new THREE.ShaderMaterial({
    uniforms: { ...sky, time: { value: 0 } },
    side: THREE.BackSide,
    vertexShader: VERT_WORLD,
    fragmentShader: `${SKY_GLSL}uniform float time;uniform float fogDensity;varying vec3 vWorld;varying vec3 vNormalW;
void main(){
  vec3 v=normalize(vWorld-cameraPosition);
  vec3 n=normalize(-vNormalW);
  float up=clamp(v.y,0.,1.);
  float window=smoothstep(.62,.8,up+.25*(n.x*v.x+n.z*v.z));
  float rip=.5+.5*sin(vWorld.x*3.1+time*1.7+sin(vWorld.z*2.3-time))*sin(vWorld.z*2.7-time*1.3);
  vec3 inside=mix(vec3(.75,.97,1.),vec3(1.),rip*.5);
  vec3 outside=mix(underMid,underTop,.35+.4*rip);
  vec3 col=mix(outside,inside,window);
  float dist=length(vWorld-cameraPosition);
  float fog=1.-exp(-fogDensity*fogDensity*dist*dist);
  col=mix(col,skyColor(vWorld-cameraPosition),clamp(fog,0.,1.));
  gl_FragColor=vec4(col,1.);
#include <colorspace_fragment>
}`,
  });
}

// Soft additive shafts of light below the surface.
export function createLightRays(sky, count = 7) {
  const group = new THREE.Group(),
    rays = [];
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
  geo.translate(0, -0.5, 0);
  for (let i = 0; i < count; i++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { strength: { value: 0 }, fogDensity: sky.fogDensity },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv;varying float vDist;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vDist=length(w.xyz-cameraPosition);gl_Position=projectionMatrix*viewMatrix*w;}`,
      fragmentShader: `uniform float strength;uniform float fogDensity;varying vec2 vUv;varying float vDist;void main(){float edge=smoothstep(0.,.5,vUv.x)*smoothstep(1.,.5,vUv.x);float fall=pow(vUv.y,1.6);float fog=exp(-fogDensity*fogDensity*vDist*vDist*.35);gl_FragColor=vec4(vec3(.62,.95,.92)*edge*fall*strength*fog,1.);}`,
    });
    const m = new THREE.Mesh(geo, mat);
    group.add(m);
    rays.push(m);
  }
  return {
    group,
    update(t, camera, { centerX = 0, centerZ = -3, spread = 9, top = 0, length = 9, strength = 1 } = {}) {
      rays.forEach((m, i) => {
        const x = centerX + (hash(i + 3) - 0.5) * spread + Math.sin(t * 0.35 + i) * 0.4,
          z = centerZ + (hash(i + 13) - 0.5) * spread * 0.8;
        m.position.set(x, top, z);
        const w = 0.6 + hash(i + 23) * 1.4;
        m.scale.set(w, length * (0.7 + hash(i + 31) * 0.5), 1);
        m.rotation.set(0, Math.atan2(camera.position.x - x, camera.position.z - z), 0.18 + 0.06 * Math.sin(t * 0.4 + i));
        m.material.uniforms.strength.value = strength * (0.08 + 0.07 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.7)));
      });
    },
  };
}

// ---------- bubbles ----------
export function createBubbles(count) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { opacity: { value: 1 } },
    vertexShader: `varying vec3 vN;varying vec3 vV;void main(){vec4 p=vec4(position,1.);vec3 n=normal;
#ifdef USE_INSTANCING
p=instanceMatrix*p;n=mat3(instanceMatrix)*n;
#endif
vec4 w=modelMatrix*p;vN=normalize(mat3(modelMatrix)*n);vV=normalize(cameraPosition-w.xyz);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform float opacity;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.2);vec3 h=normalize(normalize(vV)+normalize(vec3(-.3,1.,.4)));float s=pow(max(dot(normalize(vN),h),0.),60.);vec3 c=mix(vec3(.55,.92,.95),vec3(1.),f)+s;gl_FragColor=vec4(c,(.1+.85*f+s)*opacity);}`,
  });
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 18, 12), mat, count);
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    s = new THREE.Vector3(),
    p = new THREE.Vector3();
  return {
    mesh,
    set(i, x, y, z, r, stretch = 1) {
      p.set(x, y, z);
      s.set(r / Math.sqrt(stretch), r * stretch, r / Math.sqrt(stretch));
      m.compose(p, q, r > 0 ? s : s.set(0, 0, 0));
      mesh.setMatrixAt(i, m);
    },
    commit() {
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// ---------- crown splash ----------
// A thin flared wall whose rim breaks into spikes; tip droplets detach on ballistic paths.
export function createCrown(material, { segments = 180, rows = 20, spikes = 18 } = {}) {
  const geo = new THREE.BufferGeometry(),
    positions = new Float32Array((segments + 1) * (rows + 1) * 3),
    idx = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i,
        b = a + segments + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  const droplets = Array.from({ length: spikes }, () => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), material);
    return d;
  });
  function shape(life) {
    const L = clamp(life),
      grow = 1 - (1 - L) ** 2.2,
      height = 1.05 * Math.sin(Math.PI * Math.min(1, L * 1.05)) ** 0.75,
      base = 0.3 + 0.72 * grow;
    return { L, grow, height, base };
  }
  function rimPoint(a, life, out = new THREE.Vector3()) {
    const { grow, height, base } = shape(life),
      v = 1,
      r = base + 0.34 * v ** 1.6 * (0.35 + grow),
      spike = 0.26 * Math.max(0, Math.cos(spikes * a)) ** 6 * Math.min(1, life * 2.5);
    return out.set(r * Math.cos(a), height * v + spike * height, r * Math.sin(a));
  }
  return {
    mesh,
    droplets,
    rimPoint,
    // life 0..1 shapes the wall; time since impact drives detached tip droplets.
    update(life, seconds, { scale = 1, wobble = 0 } = {}) {
      const { L, grow, height, base } = shape(life),
        p = geo.attributes.position;
      mesh.visible = life > 0 && life < 1;
      for (let j = 0; j <= rows; j++)
        for (let i = 0; i <= segments; i++) {
          const a = (i / segments) * TAU,
            v = j / rows,
            wav = 1 + 0.035 * Math.sin(a * 7 + wobble) + 0.02 * Math.sin(a * 13 - wobble * 0.7),
            r = (base + 0.34 * v ** 1.6 * (0.35 + grow)) * wav,
            spike = 0.26 * v ** 6 * Math.max(0, Math.cos(spikes * a)) ** 6 * Math.min(1, life * 2.5),
            y = height * v + spike * height - 0.04;
          p.setXYZ(j * (segments + 1) + i, r * Math.cos(a) * scale, y * scale, r * Math.sin(a) * scale);
        }
      p.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      const detach = 0.32;
      droplets.forEach((d, k) => {
        const a = (k / spikes) * TAU + 0.0001,
          tip = rimPoint(a, Math.min(life, detach)).multiplyScalar(scale),
          dt = seconds - 0.75 * detach * 0.95,
          r = (0.045 + 0.03 * hash(k + 4)) * scale;
        if (life <= 0.06) {
          d.visible = false;
          return;
        }
        if (dt <= 0) {
          d.visible = true;
          d.position.copy(rimPoint(a, life).multiplyScalar(scale));
          d.position.y += r * 0.6;
          d.scale.set(r, r * 1.5, r);
          return;
        }
        const out = (0.75 + 0.6 * hash(k + 9)) * scale,
          up = (1.2 + 0.9 * hash(k + 17)) * scale,
          x = tip.x + Math.cos(a) * out * dt,
          z = tip.z + Math.sin(a) * out * dt,
          y = tip.y + up * dt - 4.9 * scale * dt * dt;
        d.visible = y > -0.02;
        d.position.set(x, y, z);
        d.scale.set(r, r * (1.15 + 0.4 * Math.min(1, dt * 3)), r);
      });
      return { L, height: height * scale, radius: (base + 0.34 * (0.35 + grow)) * scale };
    },
  };
}

// ---------- dynamic lathe: profile(v) -> [radius, y] for v in 0..1 ----------
export function createLathe(material, { rows = 48, segments = 64 } = {}) {
  const geo = new THREE.BufferGeometry(),
    pos = new Float32Array((rows + 1) * (segments + 1) * 3),
    idx = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i,
        b = a + segments + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  return {
    mesh,
    update(profile) {
      const p = geo.attributes.position;
      for (let j = 0; j <= rows; j++) {
        const [r, y] = profile(j / rows);
        for (let i = 0; i <= segments; i++) {
          const a = (i / segments) * TAU;
          p.setXYZ(j * (segments + 1) + i, r * Math.cos(a), y, r * Math.sin(a));
        }
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    },
  };
}
// Worthington jet: flared foot, tapering column and a bulb that will pinch off.
export function jetProfile(height, width, bulb = 1) {
  return (v) => {
    const y = v * height,
      foot = 1 + 2.6 * (1 - v) ** 5,
      top = Math.sqrt(Math.max(0, 1 - ((v - 0.86) / 0.14) ** 2)),
      neck = v < 0.86 ? 1 - 0.25 * Math.exp(-(((v - 0.74) / 0.07) ** 2)) * bulb : top * (1 + 0.55 * bulb);
    return [Math.max(0.0005, width * foot * neck), y - 0.02];
  };
}

// ---------- surface: a polar grid so ripples stay fine near the impact ----------
export function createSurface(material, { rings = 130, segments = 256, inner = 0.02, outer = 60 } = {}) {
  const geo = new THREE.BufferGeometry(),
    count = (rings + 1) * segments + 1,
    pos = new Float32Array(count * 3),
    radius = new Float32Array(count),
    idx = [];
  const k = Math.log(outer / inner) / rings;
  pos.set([0, 0, 0], 0);
  for (let j = 0; j <= rings; j++)
    for (let i = 0; i < segments; i++) {
      const r = inner * Math.exp(k * j),
        a = (i / segments) * TAU,
        n = 1 + j * segments + i;
      pos.set([r * Math.cos(a), 0, r * Math.sin(a)], n * 3);
      radius[n] = r;
    }
  for (let i = 0; i < segments; i++) idx.push(0, 1 + ((i + 1) % segments), 1 + i);
  for (let j = 0; j < rings; j++)
    for (let i = 0; i < segments; i++) {
      const a = 1 + j * segments + i,
        b = 1 + j * segments + ((i + 1) % segments),
        c = a + segments,
        d = b + segments;
      idx.push(a, b, c, b, d, c);
    }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  return {
    mesh,
    geometry: geo,
    // height(x, z, r) returns the surface offset at a vertex.
    update(height) {
      const p = geo.attributes.position;
      for (let n = 0; n < count; n++) p.setY(n, height(p.getX(n), p.getZ(n), radius[n]));
      p.needsUpdate = true;
      geo.computeVertexNormals();
    },
  };
}
// A decaying travelling wave packet from an impact `s` seconds ago at distance r.
export function ripple(r, s, { amplitude = 0.08, speed = 1.6, wavelength = 0.55, decay = 0.9 } = {}) {
  if (s <= 0) return 0;
  const front = speed * s,
    d = r - front,
    k = TAU / wavelength,
    env = Math.exp(-((d / (0.5 + 0.35 * s)) ** 2)) * (d < 0 ? 1 : Math.exp(-d * 4));
  return (amplitude * Math.exp(-s * decay) * Math.sin(k * d) * env) / Math.sqrt(1 + r * 1.5);
}
// Background swell. With a period, every component repeats exactly (seamless loops).
export function swell(x, z, t, amount = 0.018, period = 0) {
  const [a, b, c] = period ? [TAU / period, TAU / period, TAU / period] : [1.1, 0.8, 0.6];
  return amount * (Math.sin(x * 1.3 + t * a) * Math.cos(z * 1.1 - t * b) + 0.6 * Math.sin(x * 0.45 - z * 0.7 + t * c));
}

// ---------- bottle ----------
export const BOTTLE = Object.freeze({ height: 2.62, body: 0.56, neck: 0.19, shoulder: [1.5, 2.06], neckTop: 2.44 });
export function bottleRadius(y) {
  const { body, neck, shoulder, neckTop } = BOTTLE;
  if (y < 0 || y > BOTTLE.height) return 0;
  if (y < 0.1) return body - 0.07 + 0.07 * Math.sqrt(1 - ((0.1 - y) / 0.1) ** 2);
  if (y < shoulder[0]) return body - 0.028 * Math.sin((Math.PI * (y - 0.1)) / (shoulder[0] - 0.1));
  if (y < shoulder[1]) {
    const u = (y - shoulder[0]) / (shoulder[1] - shoulder[0]);
    return mix(body, neck, 0.5 - 0.5 * Math.cos(Math.PI * u));
  }
  if (y < neckTop) return neck;
  if (y < neckTop + 0.05) return neck + 0.03;
  return neck + 0.02;
}
// Signed distance (approximate) in bottle space; base on y = 0.
export function bottleSDF(x, y, z) {
  const yy = Math.max(0.001, Math.min(BOTTLE.height - 0.001, y)),
    r = bottleRadius(yy),
    slope = (bottleRadius(Math.min(BOTTLE.height - 0.001, yy + 0.01)) - bottleRadius(Math.max(0.001, yy - 0.01))) / 0.02,
    radial = (Math.hypot(x, z) - r) / Math.sqrt(1 + slope * slope);
  return Math.max(radial, -y, y - BOTTLE.height);
}
export function bottleGeometry(segments = 96) {
  const pts = [new THREE.Vector2(0.0001, 0)];
  for (let i = 0; i <= 120; i++) {
    const y = (i / 120) * BOTTLE.height;
    pts.push(new THREE.Vector2(Math.max(0.0001, bottleRadius(Math.min(BOTTLE.height - 1e-4, Math.max(1e-4, y)))), y));
  }
  pts.push(new THREE.Vector2(0.0001, BOTTLE.height));
  const g = new THREE.LatheGeometry(pts, segments);
  g.computeVertexNormals();
  return g;
}
export function smin(a, b, k) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k);
  return mix(b, a, h) - k * h * (1 - h);
}

// ---------- liquid field ----------
// MarchingCubes wrapper: fill(fn) samples a signed distance in world units over the box.
export function createLiquid(material, { resolution = 48, half = 1.5, maxPolys = 140000 } = {}) {
  const field = new MarchingCubes(resolution, material, false, false, maxPolys);
  field.isolation = 0;
  field.scale.setScalar(half);
  return {
    mesh: field,
    fill(sdf) {
      const n = field.resolution,
        h = n / 2,
        f = field.field;
      field.reset();
      for (let z = 0; z < n; z++) {
        const pz = ((z - h) / h) * half;
        for (let y = 0; y < n; y++) {
          const py = ((y - h) / h) * half;
          for (let x = 0; x < n; x++) f[z * n * n + y * n + x] = -100 * sdf(((x - h) / h) * half, py, pz);
        }
      }
      field.update();
    },
  };
}

// ---------- 3D brand letters from the bundled outline asset ----------
export async function extrudedWord(word, material, { height = 1.4, depth = 0.35 } = {}) {
  const [{ font, glyphs }, { SVGLoader }] = await Promise.all([import("./type.js"), import("three/addons/loaders/SVGLoader.js")]);
  const data = await font(),
    letters = glyphs(data, word),
    group = new THREE.Group();
  let x = 0;
  for (const a of letters) {
    if (a.path) {
      const shapes = new SVGLoader()
        .parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${a.path}"/></svg>`)
        .paths.flatMap((p) => SVGLoader.createShapes(p));
      const geo = new THREE.ExtrudeGeometry(shapes, { depth: 120, bevelEnabled: true, bevelSize: 6, bevelThickness: 6, bevelSegments: 3, curveSegments: 10 });
      const m = new THREE.Mesh(geo, material);
      m.position.x = x;
      group.add(m);
    }
    x += a.advance;
  }
  const box = new THREE.Box3().setFromObject(group),
    size = box.getSize(new THREE.Vector3()),
    center = box.getCenter(new THREE.Vector3());
  for (const c of group.children) c.position.sub(center);
  const s = height / size.y,
    holder = new THREE.Group();
  group.scale.set(s, s, (depth / size.z) * 1);
  holder.add(group);
  return { group: holder, width: size.x * s, height };
}
