// Cross-frame style portal: the frame is cut into slanted panels with no gaps.
// One large courier flies through all of them; each panel draws the same pose
// in its own art direction, so the figure crosses two worlds in a single frame.
import { themes, poster, flyer } from "./themes.js";

const W = 1280, H = 720, WORLDS = [0, 13, 12];
const SCALE = 2.6, PERIOD = 6;
export function portalCourier(t) {
  const u = (((t % PERIOD) + PERIOD) % PERIOD) / PERIOD;
  return { x: -345 + u * (W + 690), y: 350 + Math.sin(u * Math.PI * 2) * 38 - Math.sin(u * Math.PI) * 30 };
}
// Panel edges: slanted lines that sway slowly (period 6 s, so the loop closes).
function edges(t) {
  const s = Math.sin(((t % PERIOD) / PERIOD) * Math.PI * 2);
  return [
    { top: 520 + 26 * s, bottom: 340 + 18 * s },
    { top: 980 - 22 * s, bottom: 790 - 30 * s },
  ];
}
export function createPortal() {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  let last = {};
  function panel(i, e) {
    const L = i === 0 ? null : e[i - 1], R = i === WORLDS.length - 1 ? null : e[i];
    g.beginPath();
    g.moveTo(L ? L.top : 0, 0);
    g.lineTo(R ? R.top : W, 0);
    g.lineTo(R ? R.bottom : W, H);
    g.lineTo(L ? L.bottom : 0, H);
    g.closePath();
  }
  return {
    canvas,
    proof: () => last,
    frame(time) {
      if (!Number.isFinite(time)) throw new Error("Frame time must be finite");
      const t = Math.max(0, time), e = edges(t), c = portalCourier(t);
      const spans = [];
      WORLDS.forEach((id, i) => {
        const th = themes[id], left = i ? (e[i - 1].top + e[i - 1].bottom) / 2 : 0, right = i < WORLDS.length - 1 ? (e[i].top + e[i].bottom) / 2 : W;
        g.save();
        panel(i, e);
        g.clip();
        g.fillStyle = th.bg;
        g.fillRect(0, 0, W, H);
        // The last panel is narrow at the top: its poster is drawn a little smaller and further right so
        // the headline (FLIGHT!) clears the slanted edge instead of being cut by it.
        const last = i === WORLDS.length - 1, art = poster(id, last ? 1.1 : 1.3), cx = last ? W - 148 : (left + right) / 2;
        if (last) g.drawImage(art, cx - art.width / 2, 40, art.width, art.height);
        else g.drawImage(art, cx - art.width / 2, 0, art.width, H);
        const sprite = flyer(id, t, SCALE);
        g.drawImage(sprite, c.x - 153 * SCALE, c.y - 90 * SCALE);
        g.restore();
        // Panel extent at the courier's height versus its body (−124..126 sprite units).
        const at = (edge) => edge.top + (edge.bottom - edge.top) * (c.y / H), x0 = i ? at(e[i - 1]) : 0, x1 = i < WORLDS.length - 1 ? at(e[i]) : W;
        if (c.x + 126 * SCALE > x0 && c.x - 124 * SCALE < x1) spans.push(th.name);
      });
      g.strokeStyle = "rgba(255,255,255,.75)";
      g.lineWidth = 3;
      for (const edge of e) {
        g.beginPath();
        g.moveTo(edge.top, 0);
        g.lineTo(edge.bottom, H);
        g.stroke();
      }
      g.textAlign = "left";
      g.font = "800 22px Arial";
      g.fillStyle = "#fff6e0";
      g.shadowColor = "rgba(0,0,0,.55)";
      g.shadowBlur = 8;
      g.fillText("CROSS THE FRAME. CHANGE THE INK.", 40, 48);
      g.shadowBlur = 0;
      last = { mode: "portal", time: t, worlds: WORLDS.map((id) => themes[id].name), courier: [c.x, c.y], spans };
    },
  };
}
