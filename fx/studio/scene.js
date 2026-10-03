import * as THREE from "three";
import { seeded, timeAt, impact } from "./time.js";
let renderer;
const models = new Map();
let rigTools;
export function surface() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(1280, 720);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  return renderer;
}
export async function actor(color, seed = 8, assetUrl, role = 0) {
  rigTools ||= Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/utils/SkeletonUtils.js')]).catch((error) => {
    rigTools = undefined;
    throw error;
  });
  const [{ GLTFLoader }, { clone }] = await rigTools;
  const url = assetUrl
    ? new URL(assetUrl, document.baseURI).href
    : new URL("../../assets/studio/fighter.glb", import.meta.url).href;
  if (!models.has(url)) {
    const pending = new GLTFLoader().loadAsync(url).catch((error) => {
      if (models.get(url) === pending) models.delete(url);
      throw error;
    });
    models.set(url, pending);
  }
  const gltf = await models.get(url),
    root = clone(gltf.scene),
    mixer = new THREE.AnimationMixer(root);
  if (!gltf.animations.length)
    throw new Error("The GLB needs a skeletal animation clip");
  const authored=gltf.animations.some(c=>c.name==='Amber')&&gltf.animations.some(c=>c.name==='Teal');
  const clip=authored?gltf.animations.find(c=>c.name===(role?'Teal':'Amber')):gltf.animations[0];
  if(authored){const remove=[];root.traverse(o=>{if(o.isSkinnedMesh&&o.userData.counterform!==role)remove.push(o);});remove.forEach(o=>o.removeFromParent());}
  const duration = Math.round(clip.duration * 1e6) / 1e6;
  if (!(duration > 0))
    throw new Error("The animation must have positive duration");
  mixer.clipAction(clip).play();
  const meshes = [];
  root.traverse((o) => {
    if (o.isSkinnedMesh) {
      o.material = o.material.clone();
      o.material.color.set(authored?"#ffffff":color);
      meshes.push(o);
    }
  });
  if (!meshes.length) throw new Error("The GLB needs a skinned mesh");
  return {
    root,
    meshes,
    mixer,
    duration,
    pose(t) {
      mixer.setTime(t % duration);
      root.updateMatrixWorld(true);
      meshes.forEach((m) => m.skeleton.update());
    },
    seed, authored,
  };
}
// Area-weighted barycentric samples retain triangle identity while the skin moves.
// Resampling random points each frame would make the figure flicker.
export function sampleSkin(mesh, count, seed) {
  const g = mesh.geometry,
    p = g.attributes.position,
    index = g.index,
    triCount = (index ? index.count : p.count) / 3,
    R = seeded(seed),
    cdf = [];
  let sum = 0;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  const vi = (f, k) => (index ? index.getX(f * 3 + k) : f * 3 + k);
  for (let f = 0; f < triCount; f++) {
    a.fromBufferAttribute(p, vi(f, 0));
    b.fromBufferAttribute(p, vi(f, 1));
    c.fromBufferAttribute(p, vi(f, 2));
    sum += b.sub(a).cross(c.sub(a)).length() * 0.5;
    cdf.push(sum);
  }
  const triangles = new Uint32Array(count * 3),
    weights = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const target = R() * sum;
    let lo = 0,
      hi = triCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const u = Math.sqrt(R()),
      v = R();
    triangles.set([vi(lo, 0), vi(lo, 1), vi(lo, 2)], i * 3);
    weights.set([1 - u, u * (1 - v), u * v], i * 3);
  }
  const posed = new Float32Array(p.count * 3),
    point = new THREE.Vector3(),
    col = g.attributes.color;
  return {
    triangles,
    weights,
    count,
    write(positions, colors, offset = 0) {
      for (let i = 0; i < p.count; i++) {
        mesh.getVertexPosition(i, point);
        point.applyMatrix4(mesh.matrixWorld);
        posed.set([point.x, point.y, point.z], i * 3);
      }
      const tint = mesh.material.color.toArray();
      for (let i = 0; i < count; i++) {
        const out = (offset + i) * 3;
        for (let k = 0; k < 3; k++) {
          let v = 0,
            cv = 0;
          for (let j = 0; j < 3; j++) {
            const vertex = triangles[i * 3 + j],
              w = weights[i * 3 + j];
            v += posed[vertex * 3 + k] * w;
            // Accessors honor normalized integer, RGBA and interleaved attributes.
            cv += (col ? col.getComponent(vertex, k) : 1) * w;
          }
          positions[out + k] = v;
          colors[out + k] = cv * tint[k];
        }
      }
    },
  };
}
const VERT = `attribute vec3 color; varying vec3 vColor; varying float vBlur;uniform float uSize,uFocus,uDOF;void main(){vec4 p=modelViewMatrix*vec4(position,1.);float d=max(.1,-p.z);vBlur=clamp(abs(d-uFocus)*uDOF,0.,14.);gl_PointSize=clamp(uSize*540./d+vBlur,1.,70.);gl_Position=projectionMatrix*p;vColor=color;}`;
const FRAG = `varying vec3 vColor;varying float vBlur;void main(){float r=length(gl_PointCoord-.5)*2.;float alpha=(1.-smoothstep(.55,1.,r))/(1.+vBlur*.08);if(alpha<.01)discard;gl_FragColor=vec4(max(vColor,vec3(.045,.055,.07)),alpha);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`;
export async function duel(points = false, { assetUrl } = {}) {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(38, 1280 / 720, 0.1, 100);
  const sourceCamera=new THREE.OrthographicCamera(-4,4,2.25,-2.25,.1,100);
  sourceCamera.position.set(0,1.5125,10);sourceCamera.lookAt(0,1.5125,0);
  camera.position.set(3.1, 2.35, 5.4);
  camera.lookAt(0, 1.05, 0);
  scene.add(new THREE.HemisphereLight("#ffffff", "#72859a", 2.3));
  const key = new THREE.DirectionalLight("#fff0ce", 3);
  key.position.set(-3, 6, 4);
  scene.add(key);
  const fighters = await Promise.all([
    actor("#f28a61", 31, assetUrl),
    actor("#68c7ce", 91, assetUrl, 1),
  ]);
  const authored=fighters.every(f=>f.authored);
  if(!authored){
    fighters[0].root.position.x=-.7;fighters[1].root.position.x=.7;
    fighters[0].root.rotation.y=Math.PI/2;fighters[1].root.rotation.y=-Math.PI/2;
  }
  fighters.forEach((f) => scene.add(f.root));
  let cloud,
    samplers = [],
    positions,
    colors,
    material;
  if (points) {
    let offset = 0;
    for (const f of fighters) {
      f.pose(0);
      for (const m of f.meshes) {
        const sample = sampleSkin(
          m,
          Math.max(1, Math.floor(8000 / f.meshes.length)),
          f.seed,
        );
        samplers.push({ sample, offset });
        offset += sample.count;
      }
      f.root.visible = false;
    }
    positions = new Float32Array(offset * 3);
    colors = new Float32Array(offset * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSize: { value: 0.044 },
        uFocus: { value: 7 },
        uDOF: { value: 0 },
      },
    });
    cloud = new THREE.Points(geo, material);
    cloud.frustumCulled = false;
    scene.add(cloud);
  }
  let lastProof;
  return {
    scene,
    camera,
    frame(t, { mode = "source", background = "#00ff00" } = {}) {
      const src = mode === "orbit" ? (authored ? .6 : timeAt(t, "freeze")) : mode === "lens" && authored ? Math.min(t,3) : t;
      fighters.forEach((f, i) => f.pose(src + (authored?0:(i * f.duration) / 2)));
      if (points) {
        for (const { sample, offset } of samplers)
          sample.write(positions, colors, offset);
        cloud.geometry.attributes.position.needsUpdate = true;
        cloud.geometry.attributes.color.needsUpdate = true;
        material.depthWrite = mode !== "lens";
        material.uniforms.uDOF.value = mode === "lens" ? (t<2.5?.5:3.5) : 0;
        material.uniforms.uFocus.value =
          mode === "lens" ? 5.1 - Math.sin(t)*.5 : 7;
        if (mode === "lens") {
          const burst = impact(t, 3.2, 0.65) * 2.2;
          for (let i = 0; i < positions.length; i += 3) {
            const near=Math.exp(-((positions[i]-.4)**2+(positions[i+1]-2)**2)/.9);
            const spray=(i/3)%7<2?burst*near:0;
            positions[i] += Math.sin(i * 12.989) * spray;
            positions[i + 1] += Math.cos(i * 4.13) * spray * 0.5;
            positions[i + 2] += spray*2.8;
          }
        }
      }
      if (mode === "orbit") {
        const angle = (t / 6) * Math.PI * 2;
        const radius=authored?6.6:4.8;
        camera.position.set(Math.sin(angle)*radius,2.4,Math.cos(angle)*radius);
      } else if (mode === "lens")
        camera.position.set(
          0.8,
          1.8,
          6.8 - 2.2 * (0.5 - 0.5 * Math.cos((t * Math.PI) / 3)),
        );
      else if(authored) camera.position.set(0,1.4,5.5);
      else camera.position.set(3.1, 2.35, 5.4);
      camera.lookAt(0, authored?1.35:1.05, 0);
      scene.background = new THREE.Color(background);
      surface().render(scene, authored && mode === "source" ? sourceCamera : camera);
      lastProof = {
        sourceTime: src,
        choreography:authored?"COUNTERFORM":"custom GLB",
        points: positions ? positions.length / 3 : 0,
        camera: camera.position.toArray(),
        sample: positions
          ? Array.from(positions.slice(0, 24))
          : fighters[0].meshes[0].skeleton.bones[4].quaternion.toArray(),
      };
      return surface().domElement;
    },
    proof: () => lastProof,
  };
}
export function lowpoly() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#112c40");
  scene.fog = new THREE.Fog("#112c40", 12, 48);
  const camera = new THREE.PerspectiveCamera(58, 1280 / 720, 0.1, 100),
    R = seeded(25);
  scene.add(new THREE.HemisphereLight("#fff6d7", "#204b6b", 3));
  const sun = new THREE.DirectionalLight("#ffd577", 3);
  sun.position.set(-5, 10, 4);
  scene.add(sun);
  for (let i = 0; i < 90; i++) {
    const h = 0.6 + R() * 6;
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(1 + R(), h, 1 + R()),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(
          0.48 + R() * 0.13,
          0.25,
          0.2 + R() * 0.3,
        ),
        flatShading: true,
      }),
    );
    b.position.set((i % 2 ? 1 : -1) * (3 + R() * 10), h / 2, -i * 0.7);
    scene.add(b);
  }
  for (let i = 0; i < 9; i++) {
    const r = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.11, 5, 12),
      new THREE.MeshStandardMaterial({
        color: "#f7cd52",
        metalness: 0.3,
        roughness: 0.4,
      }),
    );
    r.position.set(Math.sin(i * 0.8) * 0.8, 3, -i * 7);
    scene.add(r);
  }
  return (t) => {
    camera.position.set(Math.sin(t * 0.7) * 0.6, 3, -(t % 6) * 8 + 4);
    camera.lookAt(Math.sin(t * 0.7) * 0.6, 3, camera.position.z - 10);
    surface().render(scene, camera);
    return surface().domElement;
  };
}
