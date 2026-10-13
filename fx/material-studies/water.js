import * as THREE from "three";
import { stage3D, surface, label, smooth, clamp, mix, TAU, hash, time } from "./common.js";
import * as K from "./water-kit.js";
// Authored surfaces and ballistic droplets. This is not a volume-fluid solver.

// A seamless studio sweep (floor curving into wall) with a painted stripe board,
// the object's shadow and its focused caustic. Opaque, so transmission sees it.
function createCyclorama(sky, { floorY = 0, wallZ = -3.4, radius = 2.4, top = 14, width = 70, near = 26 } = {}) {
  const prof = [];
  for (let i = 0; i <= 24; i++) prof.push([floorY, near - (i / 24) * (near - (wallZ + radius))]);
  for (let i = 1; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2);
    prof.push([floorY + radius - Math.cos(a) * radius, wallZ + radius - Math.sin(a) * radius]);
  }
  for (let i = 1; i <= 16; i++) prof.push([floorY + radius + (i / 16) * (top - radius), wallZ]);
  const cols = 64,
    pos = [],
    idx = [];
  for (const [y, z] of prof) for (let i = 0; i <= cols; i++) pos.push((i / cols - 0.5) * width, y, z);
  for (let j = 0; j < prof.length - 1; j++)
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i,
        b = a + cols + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const uniforms = {
    ...sky,
    time: { value: 0 },
    objPos: { value: new THREE.Vector3(0, 1.4, 0) },
    objRadius: { value: 1.2 },
    lightDir: { value: new THREE.Vector3(-0.45, 1, 0.5).normalize() },
    floorY: { value: floorY },
    stripeA: { value: new THREE.Color(K.PALETTE.accent) },
    stripeB: { value: new THREE.Color(K.PALETTE.cream) },
    stripeC: { value: new THREE.Color("#ffc94a") },
    base: { value: new THREE.Color("#1b4c5c") },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vWorld;varying vec3 vN;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `${K.SKY_GLSL}${K.CAUSTIC_GLSL}
uniform float time;uniform vec3 objPos;uniform float objRadius;uniform vec3 lightDir;uniform float floorY;uniform vec3 stripeA;uniform vec3 stripeB;uniform vec3 stripeC;uniform vec3 base;uniform float fogDensity;
varying vec3 vWorld;varying vec3 vN;
void main(){
  vec3 n=normalize(vN);vec3 L=normalize(lightDir);
  float spot=exp(-dot(vWorld.xz-objPos.xz,vWorld.xz-objPos.xz)/60.);
  vec3 col=base*(.45+.55*max(dot(n,L),0.))*(.55+.75*spot);
  col*=mix(1.,.55,smoothstep(3.,11.,vWorld.y));
  // stripe board painted on the sweep behind the subject
  vec2 q=vWorld.xy;float onWall=smoothstep(.6,-.6,vWorld.z+.6);
  float panel=smoothstep(3.9,3.3,abs(q.x))*smoothstep(.05,.45,q.y-floorY)*smoothstep(3.6,3.0,q.y-floorY)*onWall;
  float s=(q.x+q.y)/.62;float w=fwidth(s)*.75;
  float m=clamp((abs(fract(s)-.5)-.25)/max(w,1e-4)+.5,0.,1.);
  vec3 stripes=mix(stripeA,stripeB,m);
  stripes=mix(stripes,stripeC,(1.-m)*step(.66,fract(floor(s)*.618)));
  col=mix(col,stripes*(.78+.3*max(dot(n,L),0.)),panel);
  // shadow and focused caustic on the floor
  float onFloor=step(vWorld.y,floorY+.02);
  vec3 sc=objPos-L*(objPos.y-floorY)/L.y;
  vec2 d=(vWorld.xz-sc.xz)/vec2(objRadius*1.05,objRadius*1.25);
  float r=length(d);
  float shadow=1.-.6*smoothstep(1.15,.55,r);
  float web=caustic(vWorld.xz*1.15+objPos.xz,time*.8);
  float focus=exp(-r*r*7.)*1.25+web*smoothstep(1.05,.2,r)*.45;
  col=mix(col,col*shadow+vec3(.85,1.,.95)*focus*.6,onFloor);
  float dist=length(vWorld-cameraPosition);float fog=1.-exp(-fogDensity*fogDensity*dist*dist);
  col=mix(col,skyColor(vWorld-cameraPosition),clamp(fog,0.,1.));
  gl_FragColor=vec4(col,1.);
#include <colorspace_fragment>
}`,
  });
  return { mesh: new THREE.Mesh(geo, mat), uniforms };
}

export function create(mode = "material") {
  const view = stage3D(),
    { scene, camera, canvas, g } = view;
  scene.background = null;
  scene.environment = K.studioEnvironment(view.renderer);
  const sky = K.skyUniforms();
  scene.add(K.createDome(sky));
  scene.fog = new THREE.FogExp2(K.horizonColor(false), 0.03);
  const water = K.waterMaterial(mode === "material" ? { thickness: 3.2, attenuationDistance: 9, color: "#e8fbfb", attenuationColor: "#7fd8e0" } : { thickness: 1.5, attenuationDistance: 5, color: "#e3f8f8" }),
    sheet = K.waterMaterial({ side: THREE.DoubleSide, thickness: 0.35 });
  let cyc, sphere, liquid, pool, under, floor, crown, drop, jet, pinch, bubbles, rays;
  if (mode === "material" || mode === "morph") {
    cyc = createCyclorama(sky);
    scene.add(cyc.mesh);
    sky.fogDensity.value = 0.012;
  }
  if (mode === "material") {
    sphere = new THREE.Mesh(new THREE.SphereGeometry(1.25, 96, 64), water);
    scene.add(sphere);
  }
  if (mode === "morph") {
    liquid = K.createLiquid(water, { resolution: 40, half: 1.6, maxPolys: 90000 });
    scene.add(liquid.mesh);
  }
  if (mode === "impact" || mode === "underwater") {
    // Small thickness: a large screen-space offset on a flat surface samples past
    // the frame edge and smears into vertical streaks.
    pool = K.createSurface(K.waterMaterial({ thickness: 0.12, attenuationDistance: 2.2, color: "#cdeff2", attenuationColor: "#137a8f" }));
    scene.add(pool.mesh);
    under = new THREE.Mesh(pool.geometry, K.underSurfaceMaterial(sky));
    scene.add(under);
    floor = K.createCausticFloor(sky, { y: mode === "impact" ? -2.4 : -4.8, scale: mode === "impact" ? 0.9 : 0.6 });
    scene.add(floor.mesh);
    crown = K.createCrown(sheet);
    scene.add(crown.mesh, ...crown.droplets);
    drop = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), water);
    jet = K.createLathe(water, { rows: 56, segments: 64 });
    pinch = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), water);
    scene.add(drop, jet.mesh, pinch);
    bubbles = K.createBubbles(70);
    scene.add(bubbles.mesh);
    rays = K.createLightRays(sky, 8);
    scene.add(rays.group);
  }
  const titles = {
    material: ["Light through water.", "01 / REFLECTION · REFRACTION · THICKNESS"],
    morph: ["A shape that won’t sit still.", "02 / SPHERE → BLOCK → RING → DROPLETS"],
    impact: ["One drop. A chain of motion.", "03 / FALL · CROWN · REBOUND · RIPPLES"],
    underwater: ["Below the surface.", "04 / BUBBLES · REFRACTION · LIGHT"],
  };
  // Stable labels are rasterised once, independently of the previous GPU frame.
  const overlay = surface();
  label(overlay.g, ...titles[mode]);
  let proof;
  const period = mode === "impact" ? 4 : 8;

  function setUnderwater(on) {
    sky.underwater.value = on ? 1 : 0;
    scene.fog.color.copy(K.horizonColor(on));
    const haze = mode === "impact" || mode === "underwater" ? 0.075 : 0.02;
    scene.fog.density = on ? 0.07 : haze;
    sky.fogDensity.value = on ? 0.07 : haze;
  }

  // Drop, crown, jet and ripples for one impact at u = 0 of a 4 s loop. The next
  // drop is already falling during the last half second, so the loop is seamless.
  function splash(u, t) {
    const s = u,
      fallStart = period - 0.5;
    drop.visible = u > fallStart;
    if (drop.visible) {
      const k = (u - fallStart) / 0.5,
        y = 0.18 + 3.1 * (1 - k * k);
      drop.position.set(0, y, 0);
      drop.scale.set(0.17, 0.17 * (1 + 0.55 * k), 0.17);
    }
    // the pinched drop falls back at `back` and throws a smaller crown
    const back = s - 1.62,
      main = s < 1.2;
    const life = main ? clamp(s / 0.8) : clamp(back / 0.5),
      c = crown.update(main ? life : back > 0 ? life : 0, main ? s : Math.max(0, back), { scale: main ? 1.25 : 0.5, wobble: main ? 0.6 : 2.1 });
    // Worthington jet: rises from the crater, its bulb pinches off and falls back.
    const jl = clamp((s - 0.45) / 1.1),
      jh = Math.sin(jl * Math.PI) * 1.5,
      ps = s - 0.9,
      pinched = ps > 0;
    jet.mesh.visible = jl > 0 && jl < 1 && jh > 0.04;
    if (jet.mesh.visible) jet.update(K.jetProfile(jh, 0.075 + 0.04 * (1 - jl), pinched ? 0 : 1));
    const py = 1.47 + 1.1 * ps - 4.9 * ps * ps;
    pinch.visible = pinched && back < 0;
    pinch.position.set(0, Math.max(0.05, py), 0);
    pinch.scale.set(0.13, 0.13 * (1 + 0.25 * Math.exp(-ps * 8)), 0.13);
    pool.update((x, z, r) => {
      let h = K.swell(x, z, u, 0.012, period);
      for (const k of [0, period]) {
        h += K.ripple(r, s + k, { amplitude: 0.13, speed: 1.35, wavelength: 0.5, decay: 0.75 });
        h += K.ripple(r, back + k, { amplitude: 0.06, speed: 1.1, wavelength: 0.32, decay: 1.1 });
      }
      if (s < 0.8) h -= 0.12 * Math.sin(Math.PI * clamp(s / 0.8)) * Math.exp(-r * r * 6);
      return h;
    });
    return { s, life, crownHeight: c.height, crownRadius: c.radius, stage: s < 0.9 ? "crown" : back < 0 ? "jet" : back < 0.6 ? "rebound" : u > fallStart ? "fall" : "ripples" };
  }

  function frame(seconds, options = {}) {
    const t = time(seconds),
      u = t % period;
    let detail = {};
    floor && (floor.uniforms.time.value = t);
    cyc && (cyc.uniforms.time.value = t);
    under && (under.material.uniforms.time.value = t);
    camera.clearViewOffset();
    camera.fov = 36;
    if (mode === "material") {
      setUnderwater(false);
      const bob = 0.08 * Math.sin((t * TAU) / 8);
      sphere.position.set(0, 1.42 + bob, 0);
      sphere.rotation.y = t * 0.4;
      cyc.uniforms.objPos.value.copy(sphere.position);
      cyc.uniforms.objRadius.value = 1.25;
      const la = 0.6 * Math.sin((t * TAU) / 8);
      cyc.uniforms.lightDir.value.set(-0.45 + la, 1, 0.5).normalize();
      const a = 0.32 * Math.sin((t * TAU) / 8 + 0.7);
      camera.position.set(Math.sin(a) * 6.6, 1.75, Math.cos(a) * 6.6);
      camera.lookAt(0, 1.45, 0);
      detail = { lens: "ball", radius: 1.25, thickness: water.thickness };
    }
    if (mode === "morph") {
      setUnderwater(false);
      const phase = u / 2,
        k = Math.floor(phase),
        a = smooth(phase - k);
      const sdf = (x, y, z, id) => {
        if (id === 0) return Math.hypot(x, y, z) - 0.95;
        if (id === 1) {
          const q = [Math.abs(x) - 0.68, Math.abs(y) - 0.68, Math.abs(z) - 0.68];
          return Math.hypot(...q.map((v) => Math.max(v, 0))) + Math.min(Math.max(...q), 0) - 0.14;
        }
        if (id === 2) return Math.hypot(Math.hypot(x, y) - 0.7, z) - 0.26;
        let d = 3;
        for (let j = 0; j < 6; j++) {
          const ang = (j * TAU) / 6;
          d = Math.min(d, Math.hypot(x - 0.82 * Math.cos(ang), y - 0.82 * Math.sin(ang), z) - 0.29);
        }
        return d;
      };
      // MarchingCubes caches gradients; fill() resets them when replacing the field.
      liquid.fill((x, y, z) => mix(sdf(x, y, z, k), sdf(x, y, z, (k + 1) % 4), a));
      liquid.mesh.position.set(0, 1.55, 0);
      liquid.mesh.rotation.set(0.12, Math.sin(t * 0.4) * 0.55, -0.15);
      cyc.uniforms.objPos.value.set(0, 1.55, 0);
      cyc.uniforms.objRadius.value = 1.05;
      const ca = 0.25 * Math.sin((t * TAU) / 8);
      camera.position.set(Math.sin(ca) * 6.8, 1.9, Math.cos(ca) * 6.8);
      camera.lookAt(0, 1.5, 0);
      detail = { shape: ["sphere", "block", "ring", "droplets"][k], blend: a };
    }
    if (mode === "impact") {
      setUnderwater(false);
      bubbles.mesh.visible = false;
      rays.group.visible = false;
      under.visible = false;
      floor.mesh.visible = false;
      detail = splash(u, t);
      const drift = 0.18 * Math.sin((u / period) * TAU);
      camera.position.set(Math.sin(0.3 + drift) * 5.2, 0.95, Math.cos(0.3 + drift) * 5.2);
      camera.lookAt(0, 0.6, 0);
    }
    if (mode === "underwater") {
      // Above the surface a drop lands; the camera follows it down into the bubbles.
      const s = splash(u, t);
      const dive = smooth((u - 1.8) / 2.0),
        cy = mix(1.6, -2.2, dive);
      setUnderwater(cy < 0);
      // From above, the surface shows the deep dome; the floor and underside only exist below.
      under.visible = cy < 0;
      floor.mesh.visible = cy < 0;
      const look = mix(0.1, -1.6, dive);
      camera.position.set(mix(4.2, 2.6, dive), cy, mix(6.8, 5.6, dive));
      camera.lookAt(0, look, 0);
      const plume = Math.max(0, u - 1.1);
      for (let i = 0; i < 70; i++) {
        const lane = i < 26,
          speed = 0.45 + hash(i) * 0.55,
          y = lane
            ? -0.3 - (1 - ((t * speed * 0.6 + hash(i + 3)) % 1)) * Math.min(4.5, 0.4 + plume * 2.2)
            : -4.8 + ((t * speed + hash(i + 7) * 4.7) % 4.7),
          x = lane ? (hash(i + 11) - 0.5) * 0.7 + 0.12 * Math.sin(t * 2 + i) : (hash(i + 12) - 0.5) * 12,
          z = lane ? (hash(i + 19) - 0.5) * 0.7 : (hash(i + 32) - 0.5) * 9 - 1,
          r = lane ? 0.03 + hash(i + 5) * 0.06 : 0.035 + hash(i + 51) * 0.09;
        bubbles.set(i, x, Math.min(-0.05, y), z, r, 1.1);
      }
      bubbles.commit();
      bubbles.mesh.visible = cy < 0.4;
      rays.group.visible = cy < 0;
      rays.update(t, camera, { centerX: 0.5, centerZ: -2.5, spread: 10, top: 0, length: 8, strength: dive });
      detail = { dive, cameraY: cy, splash: s.s };
    }
    view.render();
    if (mode === "impact" && detail.crownRadius) {
      // Width of the crown on screen, as a fraction of the frame width.
      camera.updateMatrixWorld();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion),
        a = right.clone().multiplyScalar(detail.crownRadius).add(new THREE.Vector3(0, 0.4, 0)).project(camera),
        b = right.clone().multiplyScalar(-detail.crownRadius).add(new THREE.Vector3(0, 0.4, 0)).project(camera);
      detail.crownWidthFraction = crown.mesh.visible ? Math.abs(a.x - b.x) / 2 : 0;
    }
    if (options.labels !== false) g.drawImage(overlay.canvas, 0, 0);
    proof = {
      mode,
      time: t,
      period,
      liquidSolver: false,
      ...detail,
      vertices: liquid ? liquid.mesh.geometry.drawRange.count : pool ? pool.geometry.attributes.position.count : sphere.geometry.attributes.position.count,
    };
  }
  return { canvas, frame, proof: () => proof };
}
