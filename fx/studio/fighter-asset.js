// Original, deliberately stylised mannequin. No downloaded character or motion data.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
export function makeFighter() {
  const bones = [],
    parts = [];
  function bone(name, parent, x, y, z) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    if (parent) parent.add(b);
    bones.push(b);
    return b;
  }
  const root = bone("root", null, 0, 0, 0),
    hips = bone("hips", root, 0, 1.03, 0),
    chest = bone("chest", hips, 0, 0.48, 0),
    head = bone("head", chest, 0, 0.48, 0);
  const joints = { root, hips, chest, head };
  for (const side of ["L", "R"]) {
    const s = side === "L" ? -1 : 1;
    joints["arm" + side] = bone("arm" + side, chest, s * 0.34, 0.28, 0);
    joints["fore" + side] = bone(
      "fore" + side,
      joints["arm" + side],
      0,
      -0.43,
      0,
    );
    joints["leg" + side] = bone("leg" + side, hips, s * 0.17, -0.08, 0);
    joints["shin" + side] = bone(
      "shin" + side,
      joints["leg" + side],
      0,
      -0.48,
      0,
    );
  }
  root.updateMatrixWorld(true);
  function piece(b, g, pos, scale, color) {
    g = g.toNonIndexed();
    g.scale(...scale);
    g.translate(...pos);
    g.applyMatrix4(b.matrixWorld);
    const n = g.attributes.position.count,
      skin = new Uint16Array(n * 4),
      weights = new Float32Array(n * 4),
      colors = new Float32Array(n * 3),
      c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      skin[i * 4] = bones.indexOf(b);
      weights[i * 4] = 1;
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skin, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    parts.push(g);
  }
  const ball = () => new THREE.SphereGeometry(1, 12, 8),
    limb = () => new THREE.CylinderGeometry(1, 1, 1, 10, 2);
  piece(hips, ball(), [0, 0, 0], [0.27, 0.23, 0.19], "#abb9c5");
  piece(chest, ball(), [0, 0.02, 0], [0.33, 0.43, 0.2], "#f3e8d8");
  piece(head, ball(), [0, 0.03, 0], [0.205, 0.26, 0.19], "#f3e8d8");
  piece(
    head,
    new THREE.BoxGeometry(1, 1, 1),
    [0, 0.09, 0.17],
    [0.31, 0.055, 0.06],
    "#172330",
  );
  for (const side of ["L", "R"]) {
    piece(
      joints["arm" + side],
      limb(),
      [0, -0.215, 0],
      [0.095, 0.43, 0.095],
      "#f3e8d8",
    );
    piece(
      joints["fore" + side],
      limb(),
      [0, -0.19, 0],
      [0.08, 0.38, 0.08],
      "#c8d1d6",
    );
    piece(
      joints["fore" + side],
      ball(),
      [0, -0.42, 0],
      [0.12, 0.14, 0.12],
      "#172330",
    );
    piece(
      joints["leg" + side],
      limb(),
      [0, -0.24, 0],
      [0.13, 0.48, 0.13],
      "#abb9c5",
    );
    piece(
      joints["shin" + side],
      limb(),
      [0, -0.22, 0],
      [0.105, 0.44, 0.105],
      "#abb9c5",
    );
    piece(
      joints["shin" + side],
      ball(),
      [0, -0.45, 0.08],
      [0.13, 0.09, 0.23],
      "#172330",
    );
  }
  const geometry = mergeGeometries(parts),
    material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.7,
    });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = "CourierFighter";
  mesh.add(root);
  mesh.bind(new THREE.Skeleton(bones));
  const times = Array.from({ length: 49 }, (_, i) => i * 0.1),
    tracks = [];
  for (const name of [
    "hips",
    "chest",
    "head",
    "armL",
    "armR",
    "foreL",
    "foreR",
    "legL",
    "legR",
    "shinL",
    "shinR",
  ]) {
    const values = [];
    for (const t of times) {
      const cycle = (t / 4.8) * Math.PI * 2,
        punch = Math.pow(Math.max(0, Math.sin(cycle)), 6),
        kick = Math.pow(Math.max(0, -Math.sin(cycle)), 8);
      let x = 0,
        y = 0,
        z = 0;
      if (name === "hips") {
        x = 0.08 * Math.sin(cycle);
        y = 0.08 * Math.sin(cycle * 2);
      }
      if (name === "chest") {
        y = -0.35 * punch + 0.12 * Math.sin(cycle);
        x = -0.13 * punch;
      }
      if (name === "head") {
        y = 0.15 * punch;
        x = 0.04 * Math.sin(cycle * 2);
      }
      if (name === "armR") {
        x = -0.65 - 1.05 * punch;
        z = -0.2;
      }
      if (name === "armL") {
        x = -0.9 + 0.3 * punch;
        z = 0.15;
      }
      if (name.startsWith("fore")) x = -0.8 * (1 - punch);
      if (name === "legL") {
        x = -0.12 - 1.35 * kick;
        z = -0.12;
      }
      if (name === "legR") {
        x = 0.18 + 0.13 * punch;
        z = 0.1;
      }
      if (name === "shinL") x = 0.2 + 0.45 * (1 - kick);
      if (name === "shinR") x = 0.2;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(
      new THREE.QuaternionKeyframeTrack(name + ".quaternion", times, values),
    );
  }
  return { scene: mesh, clip: new THREE.AnimationClip("Spar", 4.8, tracks) };
}
