import * as THREE from "three/webgpu";
import {
  Fn,
  If,
  float,
  uint,
  hash,
  instanceIndex,
  instancedArray,
  uniform,
  vec3,
  vec4,
  cos,
  sin,
  mix,
  color,
  uv,
} from "three/tsl";
export async function create() {
  if (!navigator.gpu)
    throw new Error(
      "瀏覽器未提供 WebGPU。請用支援 WebGPU 的 Chrome 開啟；這裡不會用 WebGL 代替。",
    );
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter)
    throw new Error(
      "WebGPU 找不到可用 GPU adapter；此 demo 不會降級成 WebGL。",
    );
  const renderer = new THREE.WebGPURenderer({
    antialias: true,
    forceWebGL: false,
  });
  await renderer.init();
  if (!renderer.backend.isWebGPUBackend)
    throw new Error("未取得真正 WebGPU backend，已停止 demo。");
  renderer.setSize(1280, 720);
  renderer.setClearColor("#06130f");
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(42, 1280 / 720, 0.1, 100);
  camera.position.set(0, 5.3, 8.8);
  camera.lookAt(0, 0, 0);
  const count = 65536,
    positions = instancedArray(count, "vec3"),
    velocities = instancedArray(count, "vec3");
  const spin = uniform(1.8),
    spread = uniform(0),
    center = uniform(new THREE.Vector3(0, 0, 0)),
    phase = uniform(0);
  const initialize = Fn(() => {
    const p = positions.element(instanceIndex),
      v = velocities.element(instanceIndex),
      angle = hash(instanceIndex.add(uint(193))).mul(Math.PI * 2),
      radius = hash(instanceIndex.add(uint(7919)))
        .sqrt()
        .mul(2.8)
        .add(0.25);
    p.assign(
      vec3(
        cos(angle).mul(radius),
        hash(instanceIndex.add(uint(2371)))
          .sub(0.5)
          .mul(0.35),
        sin(angle).mul(radius),
      ),
    );
    v.assign(vec3(sin(angle).negate(), float(0), cos(angle)).mul(0.75));
  })();
  const initCompute = initialize.compute(count);
  const updateCompute = Fn(() => {
    const p = positions.element(instanceIndex),
      v = velocities.element(instanceIndex);
    const target = center.add(
      vec3(
        cos(phase).mul(0.35),
        sin(phase.mul(0.7)).mul(0.25),
        sin(phase).mul(0.35),
      ),
    );
    const delta = target.sub(p).toVar();
    const dist = delta.length().max(0.12);
    const dir = delta.div(dist);
    const gravity = dir.mul(float(2.8).div(dist.mul(dist).add(0.65)));
    const swirl = vec3(delta.z.negate(), float(0), delta.x)
      .mul(spin)
      .div(dist.add(0.6));
    const lift = sin(p.x.mul(2).add(phase)).mul(0.18);
    const force = gravity
      .add(swirl)
      .add(vec3(0, lift, 0))
      .add(p.mul(spread).mul(1.2));
    v.addAssign(force.mul(1 / 120));
    v.mulAssign(0.997);
    If(v.length().greaterThan(5), () => {
      v.assign(v.normalize().mul(5));
    });
    p.addAssign(v.mul(1 / 120));
    If(p.length().greaterThan(5.8), () => {
      p.mulAssign(0.45);
      v.mulAssign(0.15);
    });
  })().compute(count);
  const material = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  material.positionNode = positions.toAttribute();
  material.scaleNode = float(0.024);
  const speed = velocities.toAttribute().length().div(3).clamp();
  material.colorNode = mix(color("#54c896"), color("#fff1a1"), speed);
  material.opacityNode = float(1)
    .sub(uv().sub(0.5).length().mul(2))
    .max(0)
    .pow(2)
    .mul(0.7);
  const particles = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    material,
    count,
  );
  particles.frustumCulled = false;
  scene.add(particles);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.009, 8, 64),
    new THREE.MeshBasicNodeMaterial({ color: "#ddff9e" }),
  );
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
  let t = 0,
    step = 0,
    accum = 0,
    expanded = false,
    dispatches = 0;
  async function reset() {
    await renderer.computeAsync(initCompute);
    t = 0;
    step = 0;
    accum = 0;
    phase.value = 0;
    spread.value = 0;
    center.value.set(0, 0, 0);
    ring.position.set(0, 0, 0);
    expanded = false;
    dispatches = 1;
  }
  await reset();
  function fixed() {
    phase.value = (step / 120) * 0.4;
    renderer.compute(updateCompute);
    step++;
    t = step / 120;
    dispatches++;
  }
  renderer.domElement.addEventListener("pointermove", (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    center.value.set(
      ((e.clientX - r.left) / r.width) * 4 - 2,
      0,
      ((e.clientY - r.top) / r.height) * 3 - 1.5,
    );
  });
  renderer.domElement.addEventListener("pointerleave", () =>
    center.value.set(0, 0, 0),
  );
  return {
    canvas: renderer.domElement,
    backend: "THREE r180 · WEBGPU COMPUTE / TSL",
    get time() {
      return t;
    },
    resize() {},
    update(dt) {
      accum += dt;
      while (accum >= 1 / 120) {
        fixed();
        accum -= 1 / 120;
      }
      ring.position.copy(center.value);
    },
    render() {
      renderer.render(scene, camera);
    },
    reset,
    action() {
      expanded = !expanded;
      spread.value = expanded ? 1 : 0;
      return expanded;
    },
    parameter(v) {
      spin.value = 0.25 + v * 3;
    },
    stats: () =>
      count.toLocaleString("en-US") +
      " PARTICLES · " +
      dispatches +
      " DISPATCHES",
    advanceSteps(n) {
      for (let i = 0; i < n; i++) fixed();
    },
    async proof() {
      const buf = await renderer.getArrayBufferAsync(positions.value);
      const a = new Float32Array(buf);
      return {
        backend: renderer.backend.constructor.name,
        isWebGPU: !!renderer.backend.isWebGPUBackend,
        adapter: adapter.info
          ? {
              vendor: adapter.info.vendor,
              architecture: adapter.info.architecture,
              device: adapter.info.device,
              description: adapter.info.description,
            }
          : null,
        count,
        steps: step,
        dispatches,
        sample: Array.from(a.slice(0, 24)),
        finite: Array.from(a).every(Number.isFinite),
      };
    },
  };
}
