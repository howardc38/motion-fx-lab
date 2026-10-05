import * as THREE from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import {
  stage3D,
  surface,
  label,
  smooth,
  clamp,
  mix,
  TAU,
  hash,
  time,
} from "./common.js";
// Authored surfaces and ballistic droplets. This is not a volume-fluid solver.
export function create(mode = "material") {
  const view = stage3D(),
    { scene, camera, canvas, g } = view;
  const water = new THREE.MeshPhysicalMaterial({
    color: "#8fdfec",
    metalness: 0,
    roughness: 0.07,
    transmission: 0.96,
    thickness: 1.1,
    ior: 1.333,
    attenuationColor: "#39a8bb",
    attenuationDistance: 3,
    clearcoat: 1,
    envMapIntensity: 1.8,
    side: THREE.DoubleSide,
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: "#173d4b", roughness: 0.33 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.65;
  scene.add(floor);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 40), water);
  scene.add(sphere);
  const segments = 128,
    rows = 12;
  let field,
    pool,
    crown,
    jet,
    bubbles = [];
  if (mode === "morph") {
    field = new MarchingCubes(38, water, false, false, 60000);
    field.isolation = 0;
    field.scale.setScalar(2.2);
    field.position.y = 1.5;
    scene.add(field);
    sphere.visible = false;
  }
  if (mode === "impact" || mode === "underwater") {
    pool = new THREE.Mesh(new THREE.PlaneGeometry(60, 60, 150, 150), water);
    pool.rotation.x = -Math.PI / 2;
    scene.add(pool);
    const cg = new THREE.BufferGeometry(),
      positions = new Float32Array((segments + 1) * (rows + 1) * 3),
      idx = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < segments; i++) {
        const a = j * (segments + 1) + i,
          b = a + segments + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    cg.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    cg.setIndex(idx);
    crown = new THREE.Mesh(cg, water);
    scene.add(crown);
    jet = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), water);
    scene.add(jet);
    for (let i = 0; i < 32; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), water);
      scene.add(b);
      bubbles.push(b);
    }
  }
  const titles = {
    material: [
      "Light through water.",
      "01 / REFLECTION · REFRACTION · THICKNESS",
    ],
    morph: [
      "A shape that won’t sit still.",
      "02 / SPHERE → BLOCK → RING → DROPLETS",
    ],
    impact: [
      "One drop. A chain of motion.",
      "03 / FALL · CROWN · REBOUND · RIPPLES",
    ],
    underwater: ["Below the surface.", "04 / BUBBLES · REFRACTION · LIGHT"],
  };
  // Stable labels are rasterised once, independently of the previous GPU frame.
  const overlay = surface();
  label(overlay.g, ...titles[mode]);
  let proof;
  function frame(seconds, options = {}) {
    const t = time(seconds),
      u = t % 8,
      angle = 0.24 * Math.sin(t * 0.6);
    camera.position.set(
      5.8 * Math.sin(angle + 0.35),
      3.8,
      9.5 * Math.cos(angle + 0.35),
    );
    camera.lookAt(0, 1, 0);
    scene.background.set("#08202c");
    floor.material.color.set("#173d4b");
    sphere.visible = mode !== "morph";
    if (mode === "material") {
      sphere.position.set(0, 1.5, 0);
      sphere.scale.set(1.55, 1.55, 1.55);
      sphere.rotation.y = t * 0.4;
      // A contrasting curved ribbon behind the body makes transmission legible.
      if (!create.ribbonGeometry)
        create.ribbonGeometry = new THREE.TorusGeometry(2, 0.11, 12, 100);
      if (!view.ribbon) {
        view.ribbon = new THREE.Mesh(
          create.ribbonGeometry,
          new THREE.MeshStandardMaterial({ color: "#ef9d66", roughness: 0.4 }),
        );
        scene.add(view.ribbon);
      }
      view.ribbon.position.set(0, 1.5, -1.5);
      view.ribbon.rotation.set(0.25, t * 0.28, 0.3);
      camera.position.set(Math.sin(t * 0.32) * 4.5, 3.3, 9.5);
      camera.lookAt(0, 1.4, 0);
    }
    if (mode === "morph") {
      const phase = u / 2,
        k = Math.floor(phase),
        a = smooth(phase - k),
        n = field.resolution;
      const sdf = (x, y, z, id) => {
        if (id === 0) return Math.hypot(x, y, z) - 0.64;
        if (id === 1) {
          const q = [
            Math.abs(x) - 0.45,
            Math.abs(y) - 0.45,
            Math.abs(z) - 0.45,
          ];
          return (
            Math.hypot(...q.map((v) => Math.max(v, 0))) +
            Math.min(Math.max(...q), 0) -
            0.1
          );
        }
        if (id === 2) return Math.hypot(Math.hypot(x, y) - 0.46, z) - 0.17;
        let d = 2;
        for (let j = 0; j < 6; j++) {
          const ang = (j * TAU) / 6;
          d = Math.min(
            d,
            Math.hypot(x - 0.55 * Math.cos(ang), y - 0.55 * Math.sin(ang), z) -
              0.19,
          );
        }
        return d;
      };
      // MarchingCubes caches gradients; clear them when replacing the field.
      field.reset();
      for (let z = 0; z < n; z++)
        for (let y = 0; y < n; y++)
          for (let x = 0; x < n; x++) {
            const px = (x - n / 2) / (n / 2),
              py = (y - n / 2) / (n / 2),
              pz = (z - n / 2) / (n / 2);
            field.field[z * n * n + y * n + x] =
              -100 * mix(sdf(px, py, pz, k), sdf(px, py, pz, (k + 1) % 4), a);
          }
      field.update();
      field.rotation.set(0.12, Math.sin(t * 0.4) * 0.55, -0.15);
      camera.lookAt(0, 1.5, 0);
    }
    let impact = 0;
    if (pool) {
      impact = u - 1.35;
      const pos = pool.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i),
          y = pos.getY(i),
          r = Math.hypot(x, y),
          d = r - Math.max(0, impact) * 2.8;
        const wave =
          impact > 0
            ? 0.18 *
              Math.sin(d * 6) *
              Math.exp(-d * d * 0.65) *
              Math.exp(-impact * 0.18)
            : 0;
        pos.setZ(
          i,
          wave +
            0.023 * Math.sin(x * 1.4 + t * 1.2) * Math.cos(y * 1.3 - t * 0.7),
        );
      }
      pos.needsUpdate = true;
      pool.geometry.computeVertexNormals();
      sphere.position.set(
        0,
        u < 1.35 ? 3.5 * (1 - (u / 1.35) ** 2) + 0.22 : 0,
        0,
      );
      sphere.scale.set(0.26, 0.26 * (1 + clamp(u / 1.35) * 0.7), 0.26);
      sphere.visible = u < 1.35;
      const life = clamp(impact / 0.95),
        height = Math.sin(life * Math.PI) * 1.15;
      crown.visible = impact > 0 && impact < 0.95;
      const p = crown.geometry.attributes.position;
      for (let j = 0; j <= rows; j++)
        for (let i = 0; i <= segments; i++) {
          const a = (i / segments) * TAU,
            v = j / rows,
            r = 0.34 + life * 0.65 + v * 0.45,
            y = height * v ** 1.5 * (0.8 + 0.2 * Math.cos(a * 12));
          p.setXYZ(
            j * (segments + 1) + i,
            r * Math.cos(a),
            y - 0.05,
            r * Math.sin(a),
          );
        }
      p.needsUpdate = true;
      crown.geometry.computeVertexNormals();
      const jh = Math.sin(clamp((impact - 0.45) / 1.7) * Math.PI) * 1.6;
      jet.visible = impact > 0.45 && impact < 2.15;
      jet.position.set(0, jh / 2, 0);
      jet.scale.set(0.15, jh / 2, 0.15);
      bubbles.forEach((b, i) => {
        const a = i * 2.399,
          dt = impact - 0.16 - (i % 3) * 0.035,
          r = 0.55 + dt * (0.5 + hash(i) * 0.8);
        b.visible = dt > 0 && dt < 1.1;
        const y = 0.6 + dt * (1.4 + hash(i + 10) * 1.5) - 2.8 * dt * dt;
        b.visible &&= y > 0;
        b.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
        b.scale.setScalar(0.035 + hash(i) * 0.035);
      });
      camera.position.set(5 + Math.sin(t * 0.3), 5, 9.8);
      camera.lookAt(0, 1.0, 0);
      if (mode === "underwater") {
        crown.visible = false;
        jet.visible = false;
        sphere.visible = false;
        const dive = smooth((u - 1.6) / 2.4);
        camera.position.set(3, mix(2.5, -1.5, dive), 7);
        camera.lookAt(0, mix(0, -0.85, dive), 0);
        floor.position.y = -4.4;
        scene.background.set("#073d51");
        floor.material.color.set("#64a9aa");
        bubbles.forEach((b, i) => {
          const y =
            -3.8 + ((t * (0.36 + hash(i) * 0.4) + hash(i + 7) * 4) % 4.1);
          b.visible = true;
          b.position.set((hash(i + 12) - 0.5) * 9, y, (hash(i + 32) - 0.5) * 7);
          b.scale.setScalar(0.055 + hash(i + 51) * 0.1);
        });
        // Analytic projected caustic-like lines, deliberately not ray-traced light transport.
        if (!view.caustic) {
          const tex = surface();
          view.caustic = tex;
          const map = new THREE.CanvasTexture(tex.canvas);
          map.colorSpace = THREE.SRGBColorSpace;
          floor.material.map = map;
          floor.material.needsUpdate = true;
        }
        const c = view.caustic.g;
        c.fillStyle = "#267481";
        c.fillRect(0, 0, 1280, 720);
        c.strokeStyle = "#97d8bd";
        c.lineWidth = 2;
        for (let j = 0; j < 23; j++) {
          c.beginPath();
          for (let x = 0; x <= 1280; x += 8) {
            const y =
              j * 35 +
              16 * Math.sin(x * 0.013 + t + j * 0.7) +
              8 * Math.sin(x * 0.032 - t);
            x ? c.lineTo(x, y) : c.moveTo(x, y);
          }
          c.stroke();
        }
        floor.material.map.needsUpdate = true;
      }
    }
    view.render();
    if (options.labels !== false) g.drawImage(overlay.canvas, 0, 0);
    proof = {
      mode,
      time: t,
      impact,
      liquidSolver: false,
      vertices: field
        ? field.geometry.drawRange.count
        : pool?.geometry.attributes.position.count ||
          sphere.geometry.attributes.position.count,
    };
  }
  return { canvas, frame, proof: () => proof };
}
