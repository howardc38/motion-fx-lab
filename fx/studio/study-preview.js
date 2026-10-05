// Comparison presentation only. Raw effect factories remain usable by authored films.
import { createDots } from "./dots.js";
import { createChoreography } from "./battle.js";
const W = 1280,
  H = 720,
  contact = createChoreography().events.find((e) => e.kind !== "dodge");
export async function createPreview(id, spec, mode) {
  if (!mode) throw new Error("Unknown comparison: " + id);
  const effect = await createDots(mode),
    reference = await createDots(
      ["video", "rhythm", "depth"].includes(mode)
        ? "source"
        : ["echo", "impact", "ramp"].includes(mode)
          ? "video"
          : mode,
    );
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  const labels = document.createElement("canvas");
  labels.width = W;
  labels.height = H;
  const h = labels.getContext("2d", { willReadFrequently: true });
  h.fillStyle = "#efe9d8";
  h.font = "700 36px Arial";
  h.fillText(spec.title, 38, 59);
  h.font = "22px Arial";
  h.fillStyle = "#b6cccb";
  h.fillText(spec.watch, 40, 104);
  h.font = "700 23px Arial";
  h.fillStyle = "#efe9d8";
  h.fillText(spec.before, 40, 188);
  h.fillStyle = "#efa77e";
  h.fillText(spec.after, 664, 188);
  h.strokeStyle = "#596d78";
  h.lineWidth = 1;
  h.strokeRect(39.5, 211.5, 577, 325);
  h.strokeRect(663.5, 211.5, 577, 325);
  h.fillStyle = "#b6cccb";
  h.font = "20px Arial";
  h.fillText(spec.note, 40, 640);
  // Inputs were pixel-identical, but directly scaling a read-frequent Canvas
  // could produce different cold/warm samples in Chromium. Stage the pixels in
  // a default-context Canvas before resizing; never read back from this staging
  // context, so it does not switch to the inconsistent CPU sampling path.
  const rasters = [0, 1].map(() => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    return { canvas: c, g: c.getContext("2d") };
  });
  function pane(input, x, crop) {
    const raster = rasters[x === 40 ? 0 : 1];
    raster.g.putImageData(
      input.getContext("2d").getImageData(0, 0, W, H),
      0,
      0,
    );
    input = raster.canvas;
    if (crop) {
      g.drawImage(input, crop[0], crop[1], crop[2], crop[3], x, 212, 576, 324);
    } else g.drawImage(input, 0, 0, W, H, x, 212, 576, 324);
  }
  let last,
    pending = Promise.resolve();
  async function draw(t, options = {}) {
    if (!Number.isFinite(t)) throw new Error("Frame time must be finite");
    t = Math.max(0, t);
    const phase = t % 4.8;
    let source = phase,
      referenceTime = phase,
      fxOptions = { labels: false },
      refOptions = { labels: false },
      crop = null;
    if (mode === "impact") {
      source = referenceTime = contact.t - 0.35 + (phase / 4.8) * 1.05;
      crop = [contact.point[0] - 256, contact.point[1] - 144, 512, 288];
    }
    if (mode === "ramp") {
      source = t;
      fxOptions.timeMode = options.timeMode;
    }
    if (mode === "orbit") {
      source = t % 6;
      referenceTime = 0;
    }
    if (mode === "skin") {
      source = referenceTime = t % 4.8;
      refOptions.solid = true;
    }
    if (mode === "lens") {
      source = referenceTime = t % 6;
      refOptions.treatment = false;
    }
    if (mode === "depth") {
      source = referenceTime = 1.8;
      fxOptions.cameraAngle = Math.sin((t / 6) * Math.PI * 2) * 1.1;
    }
    await reference.frame(referenceTime, refOptions);
    await effect.frame(source, fxOptions);
    g.fillStyle = "#102638";
    g.fillRect(0, 0, W, H);
    pane(reference.canvas, 40, crop);
    pane(effect.canvas, 664, crop);
    g.drawImage(labels, 0, 0);
    const a = reference.proof(),
      b = effect.proof();
    const clock = (p) =>
      Number.isFinite(p.sourceTime)
        ? p.sourceTime
        : Number.isFinite(p.sourceIndex)
          ? p.sourceIndex / 24
          : null;
    const clockLabel = (p) =>
      clock(p) === null ? "" : `SOURCE ${clock(p).toFixed(2)} s`;
    g.font = "18px monospace";
    g.fillStyle = "#b6cccb";
    g.fillText(clockLabel(a), 40, 574);
    g.fillStyle = "#efa77e";
    g.fillText(
      clockLabel(b) + (b.remap ? " / " + b.remap.toUpperCase() : ""),
      664,
      574,
    );
    last = { id, reference: a, effect: b, outputTime: t, crop };
  }
  return {
    canvas,
    proof: () => last,
    frame(t, options) {
      const job = pending.then(() => draw(t, options));
      pending = job.catch(() => {});
      return job;
    },
  };
}
