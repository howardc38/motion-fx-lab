import { surface, label, hash, time, clamp } from "./common.js";
export function create() {
  const { canvas, g } = surface(),
    source = surface(),
    head = surface();
  label(
    head.g,
    "Break the whole frame.",
    "BLOCK DISPLACEMENT / CHANNEL OFFSETS / SCAN TEARS",
  );
  function poster(t) {
    const c = source.g;
    c.fillStyle = "#f2cf67";
    c.fillRect(0, 0, 1280, 720);
    c.fillStyle = "#203345";
    c.fillRect(740, 0, 540, 720);
    c.fillStyle = "#ed694e";
    c.beginPath();
    c.arc(886 + Math.sin(t) * 110, 380, 240, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#c8ebdd";
    c.lineWidth = 16;
    for (let i = 0; i < 7; i++) {
      c.beginPath();
      c.arc(1010, 350, 90 + i * 32, t * 0.3, t * 0.3 + 4);
      c.stroke();
    }
    c.fillStyle = "#203345";
    c.font = "900 118px Arial";
    c.fillText("SIGNAL", 50, 350);
    c.fillText("LOST", 50, 477);
    c.font = "23px Arial";
    c.fillText("IMAGE / TYPE / MOTION", 54, 560);
    c.fillStyle = "#f2cf67";
    c.fillRect(900, 570, 200, 26);
    return source.canvas;
  }
  let proof;
  return {
    canvas,
    frame(t, o = {}) {
      t = time(t);
      const input = o.source || poster(t),
        amount = clamp(o.strength ?? 0.2 + 0.8 * Math.sin(t * 1.8) ** 8),
        seed = Math.floor(t * 18);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
      g.clearRect(0, 0, 1280, 720);
      g.drawImage(input, 0, 0, 1280, 720);
      const sourceWidth = input.naturalWidth || input.width,
        sourceHeight = input.naturalHeight || input.height;
      if (!(sourceWidth > 0 && sourceHeight > 0))
        throw new Error("Load the source image before drawing a glitch frame");
      for (let i = 0; amount > 0 && i < 32; i++) {
        const y = Math.floor(hash(seed * 17 + i) * 690),
          h = 4 + hash(i * 3 + seed) * 65,
          dx = Math.round((hash(i * 7 + seed) - 0.5) * 210 * amount);
        g.drawImage(
          input,
          0,
          (y * sourceHeight) / 720,
          sourceWidth,
          (h * sourceHeight) / 720,
          dx,
          y,
          1280,
          h,
        );
      }
      // Separate actual sampled RGB channels, including internal image edges.
      if (amount > 0) {
        const sourcePixels = g.getImageData(0, 0, 1280, 720),
          out = g.createImageData(1280, 720),
          src = sourcePixels.data,
          dst = out.data,
          shift = Math.round(12 * amount);
        for (let y = 0; y < 720; y++)
          for (let x = 0; x < 1280; x++) {
            const k = (y * 1280 + x) * 4,
              r = (y * 1280 + Math.max(0, x - shift)) * 4,
              b = (y * 1280 + Math.min(1279, x + shift)) * 4;
            dst[k] = src[r];
            dst[k + 1] = src[k + 1];
            dst[k + 2] = src[b + 2];
            dst[k + 3] = Math.max(src[r + 3], src[k + 3], src[b + 3]);
          }
        g.putImageData(out, 0, 0);
      }
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
      g.fillStyle = `rgba(5,10,28,${0.25 * amount})`;
      for (let y = 0; y < 720; y += 4) g.fillRect(0, y, 1280, 1);
      for (let i = 0; i < 12; i++) {
        const x = hash(i + seed * 12) * 1200,
          y = hash(i * 5 + seed) * 720;
        g.fillStyle = i % 2 ? "#13cee4" : "#ed526e";
        g.globalAlpha = 0.22 * amount;
        g.fillRect(x, y, 30 + hash(i + 7) * 160, 4 + hash(i) * 40);
      }
      g.globalAlpha = 1;
      if (o.labels !== false) {
        g.fillStyle = "rgba(8,18,31,.9)";
        g.fillRect(0, 0, 1280, 124);
        g.drawImage(head.canvas, 0, 0);
      }
      proof = { seed, strength: amount, sourceWidth: sourceWidth };
    },
    proof: () => proof,
  };
}
