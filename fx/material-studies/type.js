import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { stage3D, surface, label, time } from "./common.js?v=material-2";
import {inkMaterial} from '../design/ink.js';
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
    // A space is an advance with no outline, so Latin phrases such as "MAKE IT" work.
    if (c === " ") return { advance: (data.unitsPerEm || 1000) * 0.3, path: "" };
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
    if (a.path) {
      g.save();
      g.translate(x, 0);
      g.fill(new Path2D(a.path));
      g.restore();
    }
    x += a.advance;
  }
  return canvas;
}
// mode "reveal" (gallery): the flat word spins into depth with an overshoot and a camera kick, then a
// light sweeps across the faces. No mode keeps the original turntable used by the word film.
export async function create(mode, options={}) {
  const data = await font(),
    view = stage3D(options),
    { canvas, g, scene, camera } = view;
  scene.background.set("#30214f");
  const group = new THREE.Group();
  scene.add(group);
  const face = mode==='engraved'?inkMaterial('#e9e3d4'):new THREE.MeshStandardMaterial({
      color: "#ffe3a0",
      metalness: 0.22,
      roughness: 0.28,
    }),
    side = mode==='engraved'?inkMaterial('#757770'):new THREE.MeshStandardMaterial({
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
  if(mode==='engraved'){
    back.visible=false;scene.background=null;
    for(const m of [face,side]){m.uniforms.frequency.value=.095;m.uniforms.strength.value=1;}
  }
  const head = surface();
  label(
    head.g,
    "Give words another dimension.",
    mode === "reveal" ? "EDITABLE CJK + LATIN / SOLID GEOMETRY" : "EDITABLE CJK / SOLID GEOMETRY",
  );
  const sweep = new THREE.PointLight("#fff1d6", 0, 5.5, 1.8);
  sweep.visible = mode === "reveal"; // the word film keeps its original lighting
  const sweepUniforms = { sweepX: { value: -99 }, sweepAmount: { value: 0 } };
  if (mode === "reveal") {
    // An unlit backdrop, so the sweeping light only plays across the letters.
    back.visible = false;
    scene.background.set("#5b4790");
    face.color.set("#f2c36e");
    face.metalness = 0.45;
    // A narrow band of light travels across faces and sides in world x.
    for (const m of [face, side])
      m.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, sweepUniforms);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying float vSweepX;")
          .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvSweepX=(modelMatrix*vec4(transformed,1.)).x;");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying float vSweepX;uniform float sweepX;uniform float sweepAmount;")
          .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.,.96,.86)*sweepAmount*exp(-pow((vSweepX-sweepX)/.32,2.));");
      };
  }
  scene.add(sweep);
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
      if (!a.path) {
        x += a.advance;
        continue;
      }
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
  const TAU = Math.PI * 2,
    backOut = (x) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;
  const phase = (x, a, b) => {
    const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return u * u * (3 - 2 * u);
  };
  return {
    canvas,
    frame(t, o = {}) {
      t = time(t);
      group.rotation.set(0, 0, 0);
      group.position.set(0, 0, 0);
      group.scale.setScalar(1);
      setText(o.text ?? "流動"); // normalization below is independent of prior transforms
      const box = new THREE.Box3().setFromObject(group),
        size = box.getSize(new THREE.Vector3()),
        fit = Math.min(7.6 / size.x, 3 / size.y);
      let grow = 1,
        light = 0;
      if (mode === "reveal") {
        const q = t % 8;
        // Impact (0.15–1.0 s): the flat word spins once round its vertical axis while the extrusion
        // punches out of the face, overshoots and settles with a camera kick. Then light sweeps and a
        // slow orbit show the depth; at the end the word spins away and folds back flat (seamless at 8 s).
        const kick = Math.max(0, q - 0.15),
          punch = q < 0.15 ? 0 : 1 - Math.exp(-6 * kick) * Math.cos(9 * kick), // a damped spring: 12% overshoot
          spinIn = backOut(Math.max(0, Math.min(1, (q - 0.15) / 0.85))),
          spinOut = phase(q, 6.9, 7.8);
        grow = Math.max(0.02, punch * (1 - phase(q, 6.6, 7.8)));
        // the extrusion grows backwards from a fixed front face
        const pop = 1 + 0.1 * Math.exp(-(((q - 0.62) / 0.12) ** 2));
        group.scale.set(fit * pop, fit * pop, fit * grow * pop);
        group.position.set(0, 0.1, (size.z / 2) * fit * (1 - grow));
        group.rotation.y = -TAU * (1 - spinIn) + TAU * spinOut * spinOut;
        group.rotation.x = 0.18 * Math.sin(Math.PI * Math.min(1, Math.max(0, (q - 0.15) / 0.85)));
        const orbit = 0.55 * phase(q, 0.9, 2.4) - 1.0 * phase(q, 3.8, 6.4) + 0.45 * phase(q, 6.4, 7.8);
        const shake = q > 0.95 ? Math.exp(-(q - 0.95) * 9) * Math.sin((q - 0.95) * 75) * 0.18 : 0;
        camera.position.set(Math.sin(orbit) * 12.5 + shake, 1.2 + 1.4 * Math.sin(orbit * 2) * 0.5 - shake * 0.6, Math.cos(orbit) * 12.5);
        camera.lookAt(0, 0, 0);
        const s1 = phase(q, 2.2, 3.8),
          s2 = phase(q, 4.8, 6.3),
          flash = Math.exp(-(((q - 0.55) / 0.22) ** 2));
        light = Math.sin(Math.PI * s1) + Math.sin(Math.PI * s2);
        const sx = q < 1.6 ? 0 : q < 4.3 ? -6.5 + 13 * s1 : 6.5 - 13 * s2;
        sweep.position.set(sx, 0.9, 1.6);
        sweep.intensity = 120 * Math.min(1, light + flash);
        sweepUniforms.sweepX.value = q < 1.6 ? 0 : sx * 0.62;
        sweepUniforms.sweepAmount.value = q < 1.6 ? 2.4 * flash : 1.6 * Math.min(1, light);
      } else if(mode==='engraved'){
        group.scale.setScalar(fit*1.2);group.position.y=-.35;
        const angle=o.cameraAngle??(-.5+.65*phase(t,0,4.8));
        camera.position.set(Math.sin(angle)*12.5,3.2,Math.cos(angle)*12.5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
        const direction=new THREE.Vector3(-3.5,5,6).normalize().transformDirection(camera.matrixWorldInverse);
        for(const m of [face,side]){m.uniforms.lightView.value.copy(direction);m.uniforms.debugPattern.value=0;m.uniforms.frequency.value=o.frequency??.095;}
        sweep.intensity=0;
      } else {
        group.scale.setScalar(fit);
        group.rotation.set(
          0.08 * Math.sin(t * 0.7),
          0.48 * Math.sin(t * 0.72),
          0.045 * Math.sin(t * 0.4),
        );
        group.position.y = 0.1;
        camera.position.set(0, 1.2, 12.5);
        camera.lookAt(0, 0, 0);
        sweep.intensity = 0;
      }
      view.render();
      if (o.labels !== false) g.drawImage(head.canvas, 0, 0);
      proof = {
        text: current,
        meshes: group.children.length,
        depth: 190,
        grow,
        sweep: light,
        rotation: group.rotation.y,
      };
      if(mode==='engraved'){
        const b=new THREE.Box3().setFromObject(group),points=[];
        for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);points.push([(p.x+1)*canvas.width/2,(1-p.y)*canvas.height/2]);}
        proof.bounds=points;proof.material='object-space surface hatching';
      }
    },
    proof: () => proof,
  };
}
