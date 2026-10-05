import { surface, label, TAU, time } from "./common.js";
export function drawContours(g, t, { background = true, strength = 1 } = {}) {
  if (background) {
    g.fillStyle = "#10132b";
    g.fillRect(0, 0, 1280, 720);
  }
  for (let i = 70; i >= 0; i--) {
    const r = 28 + i * 5.1;
    g.strokeStyle = `hsl(${180 + i * 2.3 + t * 12} 82% ${55 + (i % 3) * 5}%)`;
    g.lineWidth = 1.5;
    g.beginPath();
    for (let k = 0; k <= 240; k++) {
      const a = (k / 240) * TAU,
        warp =
          strength *
          (18 * Math.sin(a * 3 + t + i * 0.035) +
            12 * Math.sin(a * 5 - t * 0.7 + i * 0.08)),
        rr = r + warp;
      const x =
          640 +
          Math.cos(a) * rr * 1.48 +
          Math.sin(a * 2 + t * 0.5) * strength * 36,
        y = 378 + Math.sin(a) * rr * 0.72 + Math.sin(a * 3 - t) * strength * 22;
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.stroke();
  }
}
export function create() {
  const { canvas, g } = surface(),
    head = surface();
  label(head.g, "Follow the contour.", "CONTINUOUS CLOSED CURVES");
  return {
    canvas,
    frame(t, o = {}) {
      t = time(t);
      drawContours(g, t, o);
      if (o.labels !== false) g.drawImage(head.canvas, 0, 0);
    },
    proof: () => ({ closedCurves: 71 }),
  };
}
