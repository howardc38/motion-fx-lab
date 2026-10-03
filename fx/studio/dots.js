import { PointField } from "./point-field.js";
import { FrameSource } from "./frame-source.js";
import { duel, surface } from "./scene.js";
import * as THREE from "three";
import { timeAt, impact } from "./time.js";
import {createChoreography} from "./battle.js";
const fightContacts=createChoreography().events.filter(e=>e.kind!=="dodge"&&e.t<4.8);
let sourcePromise;
const source = () =>
  (sourcePromise ||= FrameSource.load(
    new URL("../../assets/studio/fight/manifest.json", import.meta.url),
  ).catch((error) => {
    sourcePromise = undefined;
    throw error;
  }));
const palettes = [
  ["#f5eedc", "#1c3150"],
  ["#f7d837", "#162b33"],
  ["#f17743", "#23314d"],
  ["#07111b", null],
];
export async function createDots(mode, options = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  const input = options.sourceUrl
      ? await FrameSource.load(new URL(options.sourceUrl, document.baseURI))
      : await source(),
    period =
      options.loopDuration ??
      (options.sourceUrl ? input.data.count / input.data.fps : 4.8),
    sample = document.createElement("canvas");
  if (!Number.isFinite(period) || period <= 0)
    throw new Error("Loop duration must be positive and finite");
  const lastTime = Math.max(0, Math.min(input.data.count - 1, Math.ceil(period * input.data.fps) - 1) / input.data.fps);
  sample.width = 640;
  sample.height = 360;
  const sg = sample.getContext("2d", { willReadFrequently: true });
  const rig = ["skin", "orbit", "lens", "battle"].includes(mode)
    ? await duel(true, { assetUrl: options.modelUrl })
    : null;
  let depth;
  if (mode === "depth" || mode === "battle") {
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(38, 1280 / 720, 0.1, 50),
      geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(9216 * 3), 3),
    );
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(9216 * 3), 3),
    );
    const texture = document.createElement("canvas");
    texture.width = texture.height = 32;
    const tg = texture.getContext("2d");
    tg.fillStyle = "#ffffff";
    tg.beginPath();
    tg.arc(16, 16, 14, 0, Math.PI * 2);
    tg.fill();
    const mat = new THREE.PointsMaterial({
      size: 0.13,
      map: new THREE.CanvasTexture(texture),
      transparent: true,
      alphaTest: 0.1,
      vertexColors: true,
      depthWrite: true,
    });
    const points = new THREE.Points(geometry, mat);
    points.frustumCulled = false;
    scene.add(points);
    depth = { scene, camera, geometry };
  }
  let last = {};
  const field = new PointField();
  async function pixels(t) {
    const image = await input.at(Math.max(0, t) % period);
    sg.clearRect(0, 0, 640, 360);
    sg.drawImage(image, 0, 0, 640, 360);
    return sg.getImageData(0, 0, 640, 360).data;
  }
  async function draw2D(t, kind, outputTime = t) {
    const phase =
      kind === "rhythm"
        ? Math.floor(outputTime / 0.3) % 4
        : kind === "battle"
          ? Math.floor(outputTime / 0.6) % 4
          : 0;
    const [bg, ink] = palettes[phase];
    g.fillStyle = bg;
    g.fillRect(0, 0, 1280, 720);
    const spacing =
      kind === "rhythm" ? [3, 5, 8, 4][phase] : 3;
    const hit=fightContacts.find(e=>outputTime%period>=e.t&&outputTime%period<e.t+.35);
    const age=hit?outputTime%period-hit.t:0;
    const event=hit?Math.sin(age/.35*Math.PI)*Math.exp(-age*2):0;
    const center=hit?hit.point:[640,330];
    const copies = kind === "echo" ? 5 : 1;
    let amount = 0;
    for (let layer = copies - 1; layer >= 0; layer--) {
      const data = await pixels(t - layer * 0.1);
      g.globalAlpha = copies > 1 ? 1 - layer * 0.16 : 1;
      const points = field.sample(data, 640, 360, spacing);
      for (let i = 0; i < points.count; i++) {
        const [sx, sy] = points.xy(i),
          k = (sy * 640 + sx) * 4;
        const luminance =
          (data[k] * 0.299 + data[k + 1] * 0.587 + data[k + 2] * 0.114) / 255;
        let x = sx * 2,
          y = sy * 2,
          r = spacing * (ink ? 0.35 + 0.55 * Math.sqrt(1 - luminance) : 0.86);
        const localImpact=kind==="impact"?event*Math.exp(-((x-center[0])**2+(y-center[1])**2)/19000):0;
        if (kind === "impact") {
          const near = Math.exp(-((x - center[0]) ** 2 + (y - center[1]) ** 2) / 19000),
            burst = event * near;
          x =
            center[0] +
            (x - center[0]) * (1 + 0.28 * localImpact) +
            Math.sin(sx * 17 + sy * 31) * burst * 65;
          y =
            center[1] +
            (y - center[1]) * (1 - 0.5 * localImpact) +
            Math.cos(sx * 19 + sy * 13) * burst * 42;
        }
        const col =
          copies > 1 && layer > 0
            ? ["#ea7097", "#559ebd", "#94bdae", "#ba9be2"][layer - 1]
            : ink || `rgb(${data[k]},${data[k + 1]},${data[k + 2]})`;
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(
          640 + (x - 640) * 1.35 + layer * 12,
          360 + (y - 360) * 1.35,
          r * 1.35,
          r * 1.35 * (1 - localImpact * 0.65),
          0,
          0,
          Math.PI * 2,
        );
        g.fill();
        amount++;
      }
    }
    g.globalAlpha = 1;
    last = {
      sourceIndex: input.indexAt(t % period),
      dots: amount,
      phase,
      event,
    };
  }
  async function drawDepth(t, options = {}) {
    const data = await pixels(t),
      pos = [],
      colors = [],
      fillLight = new THREE.Color("#c8def0");
    let depthData = null;
    if (options.depthFrame) {
      sg.clearRect(0, 0, 640, 360);
      sg.drawImage(options.depthFrame, 0, 0, 640, 360);
      depthData = sg.getImageData(0, 0, 640, 360).data;
    }
    for (let y = 0; y < 360; y += 5)
      for (let x = 0; x < 640; x += 5) {
        const k = (y * 640 + x) * 4;
        if (data[k + 3] < 100) continue;
        const lum = depthData
          ? depthData[k] / 255
          : (data[k] + data[k + 1] + data[k + 2]) / 765;
        pos.push((x - 320) / 105, (180 - y) / 105, (lum - 0.5) * 1.2);
        const co = new THREE.Color(
          `rgb(${data[k]},${data[k + 1]},${data[k + 2]})`,
        ).lerp(fillLight, 0.55);
        colors.push(co.r, co.g, co.b);
      }
    depth.geometry.attributes.position.array.set(pos);
    depth.geometry.attributes.color.array.set(colors);
    depth.geometry.attributes.position.needsUpdate = true;
    depth.geometry.attributes.color.needsUpdate = true;
    depth.geometry.setDrawRange(0, pos.length / 3);
    // The source has pale clothing: a dark field and closer framing keep the
    // surface readable instead of losing it against the cream page palette.
    depth.scene.background = new THREE.Color("#10233b");
    depth.camera.position.set(Math.sin(t * 0.8) * 1.1, 0, 4.1);
    depth.camera.lookAt(0, 0, 0);
    surface().render(depth.scene, depth.camera);
    g.drawImage(surface().domElement, 0, 0);
    last = {
      dots: pos.length / 3,
      depth: depthData
        ? "provided depth map"
        : "luminance relief, not recovered geometry",
      sourceIndex: input.indexAt(t % period),
    };
  }
  return {
    canvas,
    async frame(t, options = {}) {
      if (mode === "depth") {
        await drawDepth(t, options);
      } else if (["skin", "orbit", "lens"].includes(mode)) {
        g.drawImage(
          rig.frame(t, {
            mode,
            background: "#102638",
          }),
          0,
          0,
        );
        last = rig.proof();
      } else if (mode === "battle") {
        if (t < 2.4) {
          g.fillStyle = "#f5eedc";
          g.fillRect(0, 0, 1280, 720);
          const image = await input.at(t);
          g.drawImage(image, 0, 0, 1280, 720);
          last = { section: "original source" };
        } else if (t < 7.2) await draw2D(t, "rhythm", t);
        else if (t < 12) await draw2D(t, "impact", t);
        else if (t < 16.8) await draw2D(t, "echo", t);
        else if (t < 21.6) {
          await draw2D(timeAt((t - 16.8) % period, "ramp", period, lastTime), "ramp", t);
          last.section = "source-time ramp and hold";
        } else if (t < 26.4) {
          await drawDepth(t - 21.6);
          last.section = "2.5D luminance relief";
        } else if (t < 31.2) {
          g.drawImage(
            rig.frame(t - 26.4, { mode: "skin", background: "#f5eedc" }),
            0,
            0,
          );
          last = { ...rig.proof(), section: "animated GLB surface" };
        } else if (t < 36) {
          g.drawImage(
            rig.frame((t - 31.2) * 1.25, {
              mode: "orbit",
              background: "#f5eedc",
            }),
            0,
            0,
          );
          last = { ...rig.proof(), section: "true 3D freeze orbit" };
        } else {
          g.drawImage(
            rig.frame(t - 36, { mode: "lens", background: "#09121a" }),
            0,
            0,
          );
          last = { ...rig.proof(), section: "lens and depth of field" };
        }
      } else {
        const remap =
          options.timeMode ||
          ["normal", "ramp", "reverse", "steps"][Math.floor(t / period) % 4];
        const src = mode === "ramp" ? timeAt(t % period, remap, period, lastTime) : t;
        await draw2D(src, mode, t);
        if (mode === "ramp") last.remap = remap;
      }
      g.font = "500 17px monospace";
      g.textAlign = "left";
      g.fillStyle =
        ["lens", "depth", "skin", "orbit"].includes(mode) || (mode === "battle" && (t >= 36 || (t >= 21.6 && t < 26.4)))
          ? "#dbe7ee"
          : "#41505c";
      g.fillText(
        mode === "depth"
          ? "2.5D RELIEF / NOT A RECONSTRUCTED BODY"
          : mode === "orbit"
            ? "MOTION HELD / CAMERA MOVING"
            : mode === "skin"
              ? "ANIMATED GLB / SKINNED SURFACE POINTS"
              : mode === "battle"
                ? [
                    "ORIGINAL MOTION",
                    "DOT RHYTHM",
                    "IMPACT / RECOVERY",
                    "TEMPORAL ECHO",
                    "SLOW / HOLD / ACCELERATE",
                    "2.5D RELIEF",
                    "ANIMATED GLB POINT CLOUD",
                    "FREEZE / ORBIT",
                    "PARTICLE LENS",
                  ][t < 2.4 ? 0 : Math.min(8, 1 + Math.floor((t - 2.4) / 4.8))]
                : mode === "ramp"
                  ? "SOURCE CLOCK / " + last.remap.toUpperCase()
                  : "DOT STUDY / " + mode.toUpperCase(),
        36,
        42,
      );
    },
    proof: () => last,
  };
}
