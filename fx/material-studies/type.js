import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { stage3D, surface, label, time } from "./common.js";
let fontPromise;
export function font() {
  return (fontPromise ||= fetch(
    new URL("../../assets/type/motion-cjk.json", import.meta.url),
  ).then((r) => {
    if (!r.ok) throw new Error("CJK outline asset failed to load");
    return r.json();
  }));
}
export function glyphs(data, word) {
  if (typeof word !== "string" || !word || Array.from(word).length > 12)
    throw new Error("Use 1–12 supported characters");
  return Array.from(word).map((c) => {
    if (!data.glyphs[c])
      throw new Error(
        `Missing outline: ${c}. Rebuild assets/type/motion-cjk.json with tools/build-cjk-font.py.`,
      );
    return data.glyphs[c];
  });
}
export function mask(data, word = "流動") {
  const { canvas, g } = surface(),
    letters = glyphs(data, word),
    width = letters.reduce((n, a) => n + a.advance, 0),
    scale = Math.min(800 / width, 0.3);
  g.fillStyle = "#fff";
  g.translate(640 - (width * scale) / 2, 465);
  g.scale(scale, -scale);
  let x = 0;
  for (const a of letters) {
    g.save();
    g.translate(x, 0);
    g.fill(new Path2D(a.path));
    g.restore();
    x += a.advance;
  }
  return canvas;
}
export async function create() {
  const data = await font(),
    view = stage3D(),
    { canvas, g, scene, camera } = view;
  scene.background.set("#30214f");
  const group = new THREE.Group();
  scene.add(group);
  const face = new THREE.MeshStandardMaterial({
      color: "#ffe3a0",
      metalness: 0.22,
      roughness: 0.28,
    }),
    side = new THREE.MeshStandardMaterial({
      color: "#c5598e",
      metalness: 0.4,
      roughness: 0.27,
    });
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: "#30214f", roughness: 1 }),
  );
  back.position.z = -2;
  scene.add(back);
  const head = surface();
  label(
    head.g,
    "Give words another dimension.",
    "EDITABLE CJK / SOLID GEOMETRY",
  );
  let current, proof;
  function setText(word) {
    if (word === current) return;
    const letters = glyphs(data, word);
    for (const c of [...group.children]) {
      c.geometry.dispose();
      group.remove(c);
    }
    let x = 0;
    for (const a of letters) {
      const svg = new SVGLoader().parse(
        `<svg xmlns="http://www.w3.org/2000/svg"><path d="${a.path}"/></svg>`,
      );
      const shapes = svg.paths.flatMap((p) => SVGLoader.createShapes(p));
      const geom = new THREE.ExtrudeGeometry(shapes, {
        depth: 190,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 5,
        bevelThickness: 5,
        curveSegments: 8,
      });
      const mesh = new THREE.Mesh(geom, [face, side]);
      mesh.position.x = x;
      group.add(mesh);
      x += a.advance;
    }
    const box = new THREE.Box3().setFromObject(group),
      center = box.getCenter(new THREE.Vector3());
    for (const c of group.children) c.position.sub(center);
    current = word;
  }
  return {
    canvas,
    frame(t, o = {}) {
      t = time(t);
      group.rotation.set(0, 0, 0);
      group.position.set(0, 0, 0);
      group.scale.setScalar(1);
      setText(o.text ?? "流動"); // normalization below is independent of prior transforms
      const box = new THREE.Box3().setFromObject(group),
        size = box.getSize(new THREE.Vector3());
      group.scale.setScalar(Math.min(7.6 / size.x, 3 / size.y));
      group.rotation.set(
        0.08 * Math.sin(t * 0.7),
        0.48 * Math.sin(t * 0.72),
        0.045 * Math.sin(t * 0.4),
      );
      group.position.y = 0.1;
      camera.position.set(0, 1.2, 12.5);
      camera.lookAt(0, 0, 0);
      view.render();
      if (o.labels !== false) g.drawImage(head.canvas, 0, 0);
      proof = {
        text: current,
        meshes: group.children.length,
        depth: 190,
        rotation: group.rotation.y,
      };
    },
    proof: () => proof,
  };
}
