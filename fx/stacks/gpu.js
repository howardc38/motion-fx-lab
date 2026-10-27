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
  cos,
  sin,
  mix,
  color,
  uv,
} from "three/tsl";
export async function create() {
  if (!navigator.gpu)
    throw new Error(
      "WebGPU is not available in this browser. Open in a WebGPU-capable browser such as Chrome; this demo does not fall back to WebGL.",
    );
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter)
    throw new Error(
      "WebGPU could not find a compatible GPU adapter; this demo does not fall back to WebGL.",
    );
  const renderer = new THREE.WebGPURenderer({
    antialias: true,
    forceWebGL: false,
  });
  await renderer.init();
  if (!renderer.backend.isWebGPUBackend)
    throw new Error("A native WebGPU backend was not acquired; stopping demo.");
  renderer.setSize(1280, 720);
  renderer.setClearColor("#04050c");
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
    phase = uniform(0),
    kick = uniform(0),
    flash = uniform(0);
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
    // dispersal cue: one radial kick, outward from the attractor and slightly up
    v.addAssign(delta.negate().div(dist).add(vec3(0, 0.35, 0)).mul(kick));
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
  material.scaleNode = float(0.024).mul(flash.mul(0.6).add(1));
  // high contrast on a near-black ground: slow particles cyan, fast ones hot pink, all of them white on the cue
  const speed = velocities.toAttribute().length().div(3).clamp();
  material.colorNode = mix(
    mix(color("#19b8ff"), color("#ff3d8b"), speed),
    color("#ffffff"),
    flash.mul(0.75),
  ).mul(flash.mul(1.6).add(1));
  material.opacityNode = float(1)
    .sub(uv().sub(0.5).length().mul(2))
    .max(0)
    .pow(2)
    .mul(0.75);
  const particles = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    material,
    count,
  );
  particles.frustumCulled = false;
  scene.add(particles);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.009, 8, 64),
    new THREE.MeshBasicNodeMaterial({ color: "#ffffff" }),
  );
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
  const DISPERSE = 540; // step of the dispersal cue (4.5 s at 120 Hz)
  let t = 0,
    step = 0,
    dispatches = 0;
  async function reset() {
    await renderer.computeAsync(initCompute);
    t = 0;
    step = 0;
    phase.value = 0;
    spread.value = 0;
    kick.value = 0;
    center.value.set(0, 0, 0);
    ring.position.set(0, 0, 0);
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
  return {
    canvas: renderer.domElement,
    async frame(seconds, options = {}) {
      if (!Number.isFinite(seconds)) throw new Error("Invalid frame time");
      const strength = Math.max(0.25, Math.min(3.25, options.spin ?? 1.75));
      if (spin.value !== strength) await reset();
      spin.value = strength;
      const target = Math.round(Math.max(0, seconds) * 120);
      if (target < step) await reset();
      while (step < target) {
        const at = step / 120;
        center.value.set(
          Math.sin(at * 0.55) * 0.45,
          0,
          Math.sin(at * 0.38) * 0.3,
        );
        spread.value = at >= 4.5 ? 1 : 0;
        kick.value = step === DISPERSE ? 3.2 : 0;
        fixed();
      }
      kick.value = 0;
      // The marker, flash and camera also depend only on requested time, not pointer input.
      const s = Math.max(0, seconds),
        since = s - DISPERSE / 120;
      flash.value = since >= 0 ? Math.exp(-since / 0.18) : 0;
      ring.position.copy(center.value);
      ring.scale.setScalar(1 + 5 * (since >= 0 ? (1 - Math.exp(-since / 0.25)) * Math.exp(-since / 0.9) : 0));
      // push in while the disc winds up, kick back on the cue, then ease out to the start for the loop
      const ease = (x) => x * x * (3 - 2 * x),
        push = ease(Math.min(1, s / 4.5)) * (1 - ease(Math.max(0, Math.min(1, (s - 4.5) / 3.5)))),
        jolt = since >= 0 ? 0.22 * Math.exp(-since / 0.35) : 0,
        dist = 1 - 0.36 * push + jolt;
      camera.position.set(0, 5.3 * dist, 8.8 * dist);
      camera.lookAt(0, 0, 0);
      await renderer.renderAsync(scene, camera);
      await renderer.backend.device.queue.onSubmittedWorkDone();
    },

    backend: "THREE r180 · WEBGPU COMPUTE / TSL",
    get time() {
      return t;
    },
    stats: () =>
      count.toLocaleString("en-US") +
      " PARTICLES · " +
      dispatches +
      " DISPATCHES",
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
