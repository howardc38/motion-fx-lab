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
function caption(g, index, name) {
  text(
    g,
    String(index + 1).padStart(2, "0") + " / " + name.toUpperCase(),
    48,
    680,
    17,
    "#536567",
    "monospace",
  );
}
export function createFlight(mode) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  let last = {};
  const city = mode === "lowpoly" || mode === "journey" ? lowpoly() : null;
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
        mix(gx + 62, 640, u),
        mix(gy + 86, 330 + Math.sin(t * 1.7) * 9, u),
        mix(104, 380, u),
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
      if (mode === "flight") {
        base(g, "#112d40");
        g.fillStyle = "#214956";
        for (let i = 0; i < 22; i++) {
          const x = ((((i * 97 - t * 28) % 1400) + 1400) % 1400) - 80;
          g.fillRect(x, 460 - (i % 5) * 24, 65, 220 + (i % 5) * 24);
        }
        g.strokeStyle = "#4b8792";
        for (let i = 0; i < 11; i++) {
          const y = 160 + i * 29;
          g.beginPath();
          g.moveTo(60, y);
          g.lineTo(220 + 30 * Math.sin(t + i), y);
          g.stroke();
        }
        g.drawImage(flyer(12, t), 240, 170 + Math.sin(t * 2) * 12, 820, 461);
        text(g, "SKY COURIER", 50, 90, 42, "#f4e4b8");
        text(g, "A pose, a cape, a continuous flight.", 50, 650, 22, "#9fc7ca");
      } else if (mode === "portal") {
        const ids = [0, 13, 19],
          hx = -190 + ((t % 6) / 6) * 1660;
        ids.forEach((id, i) => {
          card(id, 55 + i * 400, 74, 370, 494, t, hx, 320);
          text(g, themes[id].name, 55 + i * 400, 606, 23);
        });
        text(g, "CROSS THE FRAME. CHANGE THE INK.", 55, 46, 23, "#b65545");
      } else if (mode === "themes") {
        active =
          options.theme == null
            ? Math.floor(t / 1.2) % 20
            : clamp(Math.floor(options.theme), 0, 19);
        const th = themes[active];
        g.drawImage(poster(active), 645, 52, 444, 592);
        g.drawImage(flyer(active, t), 630, 228, 478, 269);
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
      } else {
        g.drawImage(city(t), 0, 0, W, H);
        text(g, "FLIGHT / LOW POLY", 48, 65, 26, "#ffe597");
        text(
          g,
          "CHECKPOINT " +
            (Math.floor(((t % 6) * 8) / 7) + 1).toString().padStart(2, "0"),
          48,
          654,
          23,
          "#ffe597",
          "monospace",
        );
      }
      last = { mode, active, theme: themes[active].name, time: t };
    },
    proof: () => last,
  };
}
