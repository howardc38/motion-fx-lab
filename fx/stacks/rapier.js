import * as THREE from "three";
import RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.21.0/dist/rapier.mjs";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
export async function create() {
  await RAPIER.init();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(1280, 720);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor("#d9e5d3");
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(36, 1280 / 720, 0.1, 100);
  camera.position.set(13, 17, 19);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight("#ffffff", "#657b51", 2.7));
  const sun = new THREE.DirectionalLight("#fffbe4", 3.6);
  sun.position.set(-5, 14, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -13,
    right: 13,
    top: 10,
    bottom: -10,
  });
  sun.shadow.normalBias = 0.025;
  scene.add(sun);
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(23, 0.35, 13),
    new THREE.MeshStandardMaterial({ color: "#d9e5d3", roughness: 1 }),
  );
  ground.position.y = -0.22;
  ground.receiveShadow = true;
  scene.add(ground);
  const caption = document.createElement("canvas");
  caption.width = 1024;
  caption.height = 256;
  const cg = caption.getContext("2d");
  cg.fillStyle = "#355238";
  cg.font = "600 105px Arial";
  cg.fillText("ONE SMALL PUSH.", 10, 120);
  cg.font = "28px monospace";
  cg.fillText("48 DOMINOES / A REAL CHAIN REACTION", 16, 185);
  const ct = new THREE.CanvasTexture(caption);
  ct.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.5),
    new THREE.MeshBasicMaterial({
      map: ct,
      transparent: true,
      depthWrite: false,
    }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(1, -0.032, 4.6);
  scene.add(label);
  const geom = new RoundedBoxGeometry(0.18, 1.25, 0.66, 2, 0.06);
  const dots = new THREE.SphereGeometry(0.045, 8, 8),
    dotmat = new THREE.MeshStandardMaterial({
      color: "#eaffd9",
      roughness: 0.8,
    });
  const meshes = [],
    path = [];
  for (let i = 0; i < 48; i++) {
    const x = -9.87 + i * 0.42,
      z = 1.45 * Math.sin((x + 9.87) * 0.42);
    const tangent = new THREE.Vector3(
      1,
      0,
      0.609 * Math.cos((x + 9.87) * 0.42),
    ).normalize();
    const yaw = -Math.atan2(tangent.z, tangent.x);
    path.push({ x, z, tangent, yaw });
    const color = new THREE.Color().setHSL(
      0.4 - (i / 48) * 0.15,
      0.38,
      0.25 + (i / 48) * 0.28,
    );
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.36,
        metalness: 0.08,
      }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.add(mesh);
    for (const sy of [-0.28, 0.28]) {
      const dot = new THREE.Mesh(dots, dotmat);
      dot.position.set(0.096, sy, 0);
      dot.scale.x = 0.2;
      group.add(dot);
    }
    scene.add(group);
    meshes.push(group);
  }
  let world,
    bodies = [],
    t = 0,
    step = 0,
    speed = 1;
  function reset() {
    if (world) world.free();
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 120;
    world.numSolverIterations = 8;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(11.5, 0.175, 6.5)
        .setTranslation(0, -0.22, 0)
        .setFriction(0.65),
    );
    bodies = path.map((p) => {
      const q = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        p.yaw,
      );
      const b = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(p.x, 0.61, p.z)
          .setRotation(q)
          .setCanSleep(true)
          .setCcdEnabled(true),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.09, 0.625, 0.33)
          .setFriction(0.55)
          .setRestitution(0.04)
          .setDensity(2),
        b,
      );
      return b;
    });
    t = 0;
    step = 0;
    sync();
  }
  function sync() {
    bodies.forEach((b, i) => {
      meshes[i].position.copy(b.translation());
      meshes[i].quaternion.copy(b.rotation());
    });
  }
  function fixed() {
    if (step === 70) {
      const p = path[0];
      bodies[0].applyImpulseAtPoint(
        { x: p.tangent.x * 0.24, y: 0, z: p.tangent.z * 0.24 },
        { x: p.x, y: 1.12, z: p.z },
        true,
      );
    }
    world.step();
    step++;
    t = step / 120;
  }
  reset();
  function fallen() {
    return bodies.filter((b) => {
      const q = b.rotation();
      return 1 - 2 * (q.x * q.x + q.z * q.z) < 0.65;
    }).length;
  }
  return {
    canvas: renderer.domElement,
    async frame(seconds, options = {}) {
      if (!Number.isFinite(seconds)) throw new Error("Invalid frame time");
      const desiredSpeed = Math.max(0.25, Math.min(2, options.speed ?? 1));
      if (desiredSpeed !== speed) reset();
      speed = desiredSpeed;
      const target = Math.round(Math.max(0, seconds) * speed * 120);
      if (target < step) reset();
      while (step < target) fixed();
      sync();
      const a = Math.max(0, seconds) * 0.045;
      camera.position.set(
        13 * Math.cos(a) + 19 * Math.sin(a),
        17,
        19 * Math.cos(a) - 13 * Math.sin(a),
      );
      camera.lookAt(0, 0.3, 0);
      renderer.render(scene, camera);
    },

    backend: "RAPIER " + RAPIER.version() + " · WASM / THREE WEBGL",
    get time() {
      return t;
    },
    stats: () => fallen() + " / 48 FALLEN · FIXED STEP 120 Hz",
    proof: () => ({
      version: RAPIER.version(),
      steps: step,
      fallen: fallen(),
      positions: bodies.map((b) => {
        const p = b.translation(),
          q = b.rotation();
        return [p.x, p.y, p.z, q.x, q.y, q.z, q.w];
      }),
    }),
  };
}
