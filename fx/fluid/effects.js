import { FrameSource } from "../studio/frame-source.js";
export const specs = {
  overflow: {
    title: "OVERFLOW",
    subtitle: "A vessel. A stream. A liquid escape.",
    color: "#8ce8f0",
    hero: 6.2,
    start: 3.0,
  },
  viscous: {
    title: "SLOW GOLD",
    subtitle: "Pour. Coat. Let it fall.",
    color: "#f8b66b",
    hero: 5.2,
    start: 3.2,
  },
  smoke: {
    title: "FIND THE FORM",
    subtitle: "Through the cloud. Into the light.",
    color: "#f6d294",
    hero: 5.5,
    start: 2.0,
  },
};
export async function create(id, { film = false } = {}) {
  const spec = specs[id];
  if (!spec) throw new Error("Unknown baked fluid scene: " + id);
  const source = await FrameSource.load(
    new URL("../../assets/fluid/" + id + "/manifest.json", import.meta.url),
  );
  if (
    source.data.width !== 1280 ||
    source.data.height !== 720 ||
    source.data.count !== 289 ||
    source.data.fps !== 30
  )
    throw new Error(
      "Fluid asset metadata does not match the authored timeline",
    );
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  // Cache vector text independently from the image to keep cold/warm glyph edges identical.
  const label = document.createElement("canvas");
  label.width = 1280;
  label.height = 720;
  const h = label.getContext("2d", { willReadFrequently: true });
  h.fillStyle = spec.color;
  h.font = "600 15px Arial";
  h.fillText(id === "smoke" ? "VOLUMETRIC MOTION" : "LIQUID MOTION", 48, 51);
  h.fillStyle = "#f4f1e7";
  h.font = "900 48px Arial";
  if (id !== "smoke") h.fillText(spec.title, 46, 111);
  h.font = "19px Arial";
  h.fillStyle = "#f4f1e7";
  h.shadowColor = "#000";
  h.shadowBlur = 6;
  h.shadowOffsetY = 2;
  h.fillText(spec.subtitle, 48, 673);
  let pending = Promise.resolve(),
    last;
  async function draw(t) {
    if (!Number.isFinite(t)) throw new Error("Frame time must be finite");
    const time = film
      ? Math.min(9.6, Math.max(0, t))
      : spec.start + (Math.max(0, t) % 4.8);
    const frame = await source.at(time);
    g.drawImage(frame, 0, 0, 1280, 720);
    if (film) g.drawImage(label, 0, 0);
    last = {
      sourceIndex: source.indexAt(time),
      sourceTime: time,
      baked: true,
      recipe: id,
    };
  }
  return {
    canvas,
    proof: () => last,
    frame(t) {
      const job = pending.then(() => draw(t));
      pending = job.catch(() => {});
      return job;
    },
  };
}
