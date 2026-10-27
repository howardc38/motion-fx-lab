import { themes, poster, flyer } from "./themes.js";
import { clamp, smooth, mix } from "./time.js";
import { lowpoly } from "./scene.js";
const W = 1280,
  H = 720;
function text(
  g,
  s,
  x,
  y,
  size,
  color = "#233332",
  font = "Arial",
  align = "left",
) {
  g.font = `700 ${size}px ${font}`;
  g.textAlign = align;
  g.fillStyle = color;
  g.fillText(s, x, y);
}
function base(g, bg = "#f2eee4") {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
}
export function createFlight(mode) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  let last = {};
  const city = mode === "journey" ? lowpoly() : null;
  function card(i, x, y, w, h, t, hx, hy, heroWidth = 380) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    if (i === 17 && city) g.drawImage(city(t), 371, 0, 538, 720, x, y, w, h);
    else g.drawImage(poster(i), x, y, w, h);
    if (hx != null)
      g.drawImage(
        flyer(i, t),
        hx - heroWidth / 2,
        hy - (heroWidth * 90) / 320,
        heroWidth,
        (heroWidth * 180) / 320,
      );
    g.restore();
  }
  function layout(t, u, offset = 0) {
    g.save();
    g.globalAlpha = 1 - u;
    text(g, "ONE FLIGHT.", 50, 280, 61);
    text(g, "20 WORLDS.", 50, 350, 61, "#c05946");
    text(g, "A courier through visual history.", 54, 403, 22);
    text(
      g,
      "Original artwork · shared motion",
      54,
      446,
      16,
      "#667374",
      "monospace",
    );
    g.restore();
    for (let i = 0; i < 20; i++) {
      const gx = 550 + (i % 5) * 135,
        gy = 30 + Math.floor(i / 5) * 162,
        x = mix(gx, 430 + i * 430 - offset, u),
        y = mix(gy, 88, u),
        w = mix(118, 380, u),
        h = mix(157, 507, u);
      if (x > 1280 || x + w < 0) continue;
      card(
        i,
        x,
        y,
        w,
        h,
        t,
        x + w * 0.53,
        mix(gy + 84, y + h * 0.52 + Math.sin(t * 1.9 + i * 0.35) * 9, u),
        mix(98, 326, u),
      );
      if (u > 0.5) {
        g.save();
        g.globalAlpha = (u - 0.5) * 2;
        text(
          g,
          String(i + 1).padStart(2, "0") + " " + themes[i].name,
          x,
          y + h + 34,
          19,
        );
        g.restore();
      }
    }
  }
  return {
    canvas,
    frame(t, options = {}) {
      base(g);
      let active = 0;
      if (mode === "themes") {
        active =
          options.theme == null
            ? Math.floor(t / 1.2) % 20
            : clamp(Math.floor(options.theme), 0, 19);
        const th = themes[active];
        g.save();
        g.beginPath();
        g.rect(645, 52, 444, 592);
        g.clip();
        g.drawImage(poster(active), 645, 52, 444, 592);
        // Drawn at 1.5× inside safe poster margins so the courier is crisp and never clipped.
        g.drawImage(flyer(active, t, 1.5), 676, 238, 396, 223);
        g.restore();
        text(
          g,
          String(active + 1).padStart(2, "0") + " / 20",
          60,
          205,
          30,
          "#b65545",
          "monospace",
        );
        let y = 288;
        for (const word of th.name.toUpperCase().split(" ")) {
          text(g, word, 60, y, 48);
          y += 57;
        }
        text(
          g,
          "MATERIAL / LETTERING / MOTION",
          60,
          550,
          16,
          "#657572",
          "monospace",
        );
      } else if (mode === "journey") {
        if (t < 1.2) layout(t, 0);
        else if (t < 2.4) layout(t, smooth((t - 1.2) / 1.2));
        else if (t < 37.2) {
          const progress = clamp((t - 2.4) / 34.8);
          active = Math.min(19, Math.floor(progress * 20));
          layout(t, 1, progress * 19 * 430);
          text(
            g,
            "SKY COURIER / TWENTY VISUAL LANGUAGES",
            48,
            44,
            17,
            "#78837a",
            "monospace",
          );
        } else layout(t, 1 - smooth((t - 37.2) / 2.4), 19 * 430);
      } else throw new Error("Unknown flight mode: " + mode);
      last = { mode, active, theme: themes[active].name, time: t };
    },
    proof: () => last,
  };
}
