import { seeded } from "./time.js";
// Art-direction presets: backgrounds, typography, motifs AND figure treatment.
export const themes = [
  ["Petroglyph", "#49302a", "#d8b589", "#af7550", "Georgia", "hatch"],
  ["Tomb painting", "#dfc37d", "#233f58", "#bd4d33", "Georgia", "flat"],
  ["Mosaic", "#e5dfbd", "#294455", "#76969d", "Georgia", "mosaic"],
  ["Stained glass", "#142947", "#f2ce63", "#dd465b", "Georgia", "glass"],
  ["Illuminated initial", "#ece0bb", "#222d48", "#bc3c3d", "Georgia", "flat"],
  ["Proportion study", "#e7d6ad", "#514b40", "#8a6150", "Georgia", "outline"],
  ["Silhouette", "#233c32", "#131a17", "#e5d6b5", "Georgia", "silhouette"],
  ["Ukiyo-e", "#ede2bc", "#254e70", "#c95d42", "Georgia", "hatch"],
  ["Cross-stitch", "#e8dfc6", "#9d4444", "#718b79", "monospace", "stitch"],
  ["Strongman bill", "#e5d9b1", "#262823", "#b74736", "Georgia", "hatch"],
  ["Constructivism", "#ede4cd", "#191c1d", "#df3a2f", "Arial", "flat"],
  ["Art deco", "#122f47", "#e1bc66", "#427786", "Georgia", "outline"],
  ["Golden-age comic", "#f6cf4a", "#142533", "#d74431", "Arial", "dots"],
  ["Neon", "#101427", "#ef73e6", "#70dcf1", "Arial", "neon"],
  ["Silkscreen", "#ee779e", "#413d78", "#f0dc55", "Arial", "flat"],
  ["Line printer", "#e2eadb", "#2d4f42", "#93b49e", "monospace", "ascii"],
  ["Handheld pixels", "#aec447", "#23382b", "#668a3a", "monospace", "pixel"],
  ["Low poly", "#244b5d", "#f3d366", "#70a4a6", "Arial", "facet"],
  ["Stencil", "#a3a39a", "#202a2e", "#d7533d", "Arial", "silhouette"],
  ["Embroidered patch", "#203954", "#f0caa0", "#e2684f", "monospace", "stitch"],
].map(([name, bg, ink, accent, font, mode], id) => ({
  id,
  name,
  bg,
  ink,
  accent,
  font,
  mode,
}));
const cache = new Map(),
  sprites = new Map();
function poly(g, pts, fill, stroke) {
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p)));
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.stroke();
  }
}
function circle(g, x, y, r, fill, stroke) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.stroke();
  }
}
function line(g, x1, y1, x2, y2, col, w = 1) {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}
function word(g, s, x, y, size, col, font = "Arial", align = "center") {
  g.font = `700 ${size}px ${font}`;
  g.fillStyle = col;
  g.textAlign = align;
  g.fillText(s, x, y);
}
export function poster(id) {
  if (cache.has(id)) return cache.get(id);
  const th = themes[id],
    c = document.createElement("canvas");
  c.width = 420;
  c.height = 560;
  const g = c.getContext("2d"),
    R = seeded(id + 13);
  g.fillStyle = th.bg;
  g.fillRect(0, 0, 420, 560);
  g.globalAlpha = 0.15;
  for (let i = 0; i < 1100; i++) {
    g.fillStyle = i % 2 ? th.ink : th.accent;
    g.fillRect(R() * 420, R() * 560, 1 + R() * 2, 1 + R() * 2);
  }
  g.globalAlpha = 1;
  switch (id) {
    case 0:
      for (let j = 0; j < 5; j++) {
        const x = 50 + j * 78;
        circle(g, x, 68, 12, null, th.ink);
        for (let a = 0; a < 8; a++) {
          const q = (a * Math.PI) / 4;
          line(
            g,
            x + Math.cos(q) * 18,
            68 + Math.sin(q) * 18,
            x + Math.cos(q) * 26,
            68 + Math.sin(q) * 26,
            th.ink,
            2,
          );
        }
      }
      for (let j = 0; j < 6; j++) {
        const x = 35 + j * 66;
        circle(g, x, 467, 7, th.ink);
        line(g, x, 474, x, 500, th.ink, 3);
        line(g, x - 15, 482, x + 15, 482, th.ink, 3);
        line(g, x, 500, x - 13, 520, th.ink, 3);
        line(g, x, 500, x + 13, 520, th.ink, 3);
      }
      word(g, "FLIGHT / 3000 BCE", 210, 140, 18, th.ink);
      break;
    case 1:
      for (let i = 0; i < 21; i++) {
        g.fillStyle = ["#294c61", "#bb5337", "#efcf74"][i % 3];
        g.fillRect(i * 20, 0, 16, 27);
        g.fillRect(i * 20, 533, 16, 27);
      }
      circle(g, 210, 108, 40, th.accent, th.ink);
      circle(g, 210, 108, 31, th.bg, th.ink);
      for (let y = 160; y < 510; y += 52) {
        word(g, "⊙", 30, y, 28, th.ink);
        poly(
          g,
          [
            [380, y - 20],
            [370, y + 4],
            [390, y + 4],
          ],
          null,
          th.ink,
        );
        line(g, 380, y + 4, 380, y + 18, th.ink, 2);
      }
      break;
    case 2:
      for (let y = 18; y < 540; y += 11)
        for (let x = 18; x < 410; x += 11) {
          g.fillStyle =
            y > 400 - 45 * Math.sin(x * 0.02)
              ? R() > 0.5
                ? "#547b8a"
                : "#8fa89f"
              : R() > 0.6
                ? "#d5ccb1"
                : "#efe8cf";
          g.fillRect(x + R() * 2, y + R() * 2, 8, 8);
        }
      for (let y = 8; y < 555; y += 16) {
        g.fillStyle = th.ink;
        g.fillRect(6, y, 8, 8);
        g.fillRect(406, y, 8, 8);
      }
      word(g, "SKY COURIER", 210, 68, 25, th.ink, "Georgia");
      break;
    case 3:
      for (let y = 0; y < 560; y += 70)
        for (let x = 0; x < 420; x += 70) {
          const colors = [
            "#1e428a",
            "#326caf",
            "#b53650",
            "#dba64b",
            "#2e897e",
          ];
          poly(
            g,
            [
              [x, y],
              [x + 70, y],
              [x + 35 + R() * 30, y + 70],
            ],
            colors[Math.floor(R() * 5)],
            "#101825",
          );
          poly(
            g,
            [
              [x, y],
              [x + 35 + R() * 30, y + 70],
              [x, y + 70],
            ],
            colors[Math.floor(R() * 5)],
            "#101825",
          );
        }
      g.lineWidth = 12;
      g.strokeStyle = "#e6c678";
      g.beginPath();
      g.moveTo(38, 535);
      g.lineTo(38, 190);
      g.quadraticCurveTo(38, 90, 210, 25);
      g.quadraticCurveTo(382, 90, 382, 190);
      g.lineTo(382, 535);
      g.stroke();
      break;
    case 4:
      word(g, "F", 74, 125, 116, "#b44447", "Georgia");
      g.strokeStyle = "#ba9144";
      g.lineWidth = 4;
      g.strokeRect(19, 18, 382, 524);
      for (let y = 46; y < 530; y += 18) {
        word(
          g,
          "A courier of the sky, a journey in ink.",
          230,
          y,
          10,
          th.ink,
          "Georgia",
        );
        circle(g, 29, y, 3, "#4c7253");
        circle(g, 390, y, 3, "#b44447");
      }
      break;
    case 5:
      g.strokeStyle = th.ink;
      g.lineWidth = 1;
      g.strokeRect(58, 130, 304, 304);
      circle(g, 210, 282, 175, null, th.ink);
      line(g, 210, 70, 210, 490, th.ink);
      line(g, 20, 282, 400, 282, th.ink);
      for (let y = 145; y < 440; y += 20) line(g, 45, y, 52, y, th.ink);
      word(g, "STUDY OF FLIGHT", 210, 66, 23, th.ink, "Georgia");
      word(
        g,
        "measure • movement • proportion",
        210,
        511,
        13,
        th.ink,
        "Georgia",
      );
      break;
    case 6:
      g.fillStyle = th.accent;
      g.beginPath();
      g.ellipse(210, 282, 156, 225, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#b89c60";
      g.lineWidth = 9;
      g.stroke();
      word(g, "The Courier", 210, 481, 22, th.ink, "Georgia");
      break;
    case 7:
      circle(g, 300, 108, 48, th.accent);
      for (let j = 0; j < 5; j++) {
        const y = 330 + j * 49;
        g.beginPath();
        g.moveTo(0, 560);
        g.lineTo(0, y);
        g.bezierCurveTo(120, y - 140, 210, y + 80, 420, y - 110);
        g.lineTo(420, 560);
        g.fillStyle = j % 2 ? "#3f708d" : "#244b6c";
        g.fill();
        g.strokeStyle = "#f6ecd3";
        g.lineWidth = 3;
        g.stroke();
      }
      word(g, "THE GREAT FLIGHT", 198, 55, 22, th.ink, "Georgia");
      break;
    case 8:
      for (let y = 12; y < 548; y += 8)
        for (let x = 12; x < 412; x += 8) {
          if (y < 45 || y > 505 || x < 40 || x > 375) {
            const co =
              (Math.floor(x / 16) + Math.floor(y / 16)) % 3
                ? th.ink
                : th.accent;
            line(g, x, y, x + 5, y + 5, co);
            line(g, x + 5, y, x, y + 5, co);
          }
        }
      word(g, "FLIGHT ABC", 210, 100, 30, th.ink, "monospace");
      word(g, "HOMEWARD / 1843", 210, 480, 20, th.ink, "monospace");
      break;
    case 9:
      g.fillStyle = th.accent;
      g.fillRect(15, 20, 390, 35);
      word(g, "ONE WEEK ONLY", 210, 45, 19, th.bg, "Georgia");
      word(g, "THE SKY", 210, 120, 51, th.ink, "Georgia");
      word(g, "COURIER", 210, 175, 56, th.accent, "Georgia");
      word(g, "SEE THE WORLD IN FLIGHT", 210, 475, 21, th.ink, "Georgia");
      word(g, "DAILY • 2 & 8", 210, 520, 26, th.accent, "Georgia");
      break;
    case 10:
      circle(g, 245, 135, 123, th.accent);
      poly(
        g,
        [
          [0, 460],
          [420, 120],
          [420, 190],
          [0, 530],
        ],
        th.ink,
      );
      word(g, "FORWARD", 218, 520, 42, th.accent, "Arial");
      g.save();
      g.translate(50, 275);
      g.rotate(-Math.PI / 2);
      word(g, "MOVE / 1920", 0, 0, 31, th.ink);
      g.restore();
      break;
    case 11:
      for (let i = 0; i < 25; i++) {
        const a = -Math.PI + (i / 24) * Math.PI;
        line(
          g,
          210,
          430,
          210 + Math.cos(a) * 650,
          430 + Math.sin(a) * 650,
          "#3d6473",
          3,
        );
      }
      for (let i = 0; i < 11; i++) {
        const h = 50 + R() * 190;
        g.fillStyle = i % 2 ? "#315a70" : "#1c405c";
        g.fillRect(i * 40, 440 - h, 34, h);
        for (let y = 450 - h; y < 430; y += 15)
          for (let x = i * 40 + 5; x < i * 40 + 28; x += 10) {
            g.fillStyle = th.ink;
            g.fillRect(x, y, 3, 5);
          }
      }
      word(g, "METROPOLIS", 210, 485, 40, th.ink, "Georgia");
      word(g, "CITY OF TOMORROW", 210, 512, 14, th.ink);
      break;
    case 12:
      for (let y = 0; y < 560; y += 7)
        for (let x = 0; x < 420; x += 7) circle(g, x, y, 0.7, "#d89631");
      g.fillStyle = th.accent;
      g.fillRect(12, 15, 396, 65);
      word(g, "FLIGHT!", 210, 66, 52, th.ink);
      g.fillStyle = th.bg;
      g.fillRect(22, 91, 88, 42);
      word(g, "NO. 1", 66, 120, 21, th.ink);
      word(g, "A NEW ADVENTURE", 210, 514, 24, th.ink);
      break;
    case 13:
      for (let y = 0; y < 560; y += 24)
        for (let x = -50; x < 420; x += 80) {
          g.strokeStyle = "#29314a";
          g.strokeRect(x + (y % 48 ? 40 : 0), y, 80, 24);
        }
      g.shadowColor = th.accent;
      g.shadowBlur = 18;
      g.strokeStyle = th.accent;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(150, 150);
      g.lineTo(280, 150);
      g.lineTo(240, 200);
      g.lineTo(180, 200);
      g.closePath();
      g.stroke();
      word(g, "FLY ALL NIGHT", 210, 450, 30, th.ink);
      g.shadowBlur = 0;
      break;
    case 14:
      ["#f18c51", "#57b8a7", "#dd5d9f", "#e2db5a"].forEach((co, i) => {
        g.fillStyle = co;
        g.fillRect((i % 2) * 210, Math.floor(i / 2) * 280, 210, 280);
        word(
          g,
          "F",
          (i % 2) * 210 + 105,
          Math.floor(i / 2) * 280 + 200,
          155,
          ["#df4978", "#355d98", "#6b416b", "#348f94"][i],
        );
      });
      break;
    case 15:
      for (let y = 0; y < 560; y += 24) {
        g.fillStyle = y % 48 ? "#d5e4d2" : "#edf1e5";
        g.fillRect(0, y, 420, 24);
      }
      for (let y = 14; y < 555; y += 24) {
        circle(g, 10, y, 3, th.ink);
        circle(g, 410, y, 3, th.ink);
      }
      word(g, "SYSTEM / FLIGHT", 210, 65, 23, th.ink, "monospace");
      word(g, "READY >", 90, 507, 21, th.ink, "monospace");
      break;
    case 16:
      g.strokeStyle = th.ink;
      g.lineWidth = 9;
      g.strokeRect(8, 8, 404, 544);
      word(g, "SCORE 01984", 132, 46, 21, th.ink, "monospace");
      for (let i = 0; i < 14; i++) {
        const h = 30 + Math.floor(R() * 18) * 8;
        g.fillStyle = th.ink;
        g.fillRect(i * 32, 438 - h, 24, h);
      }
      g.strokeRect(16, 452, 388, 90);
      word(g, "IT'S THE COURIER!", 210, 504, 20, th.ink, "monospace");
      break;
    case 17:
      for (let i = 0; i < 24; i++) {
        const x = R() * 420,
          y = R() * 560;
        poly(
          g,
          [
            [x, y],
            [x + R() * 180, y + 30],
            [x + 20, y + R() * 150],
          ],
          ["#3c6476", "#729b91", "#356579"][i % 3],
        );
      }
      for (let i = 3; i > 0; i--) {
        g.lineWidth = 6;
        circle(g, 210, 270, 30 * i, null, th.ink);
      }
      word(g, "FLY THROUGH", 210, 515, 27, th.ink);
      break;
    case 18:
      for (let x = 0; x < 420; x += 85) line(g, x, 0, x, 560, "#777d78");
      for (let y = 0; y < 560; y += 110) line(g, 0, y, 420, y, "#777d78");
      for (let i = 0; i < 180; i++)
        circle(g, R() * 420, R() * 560, R() * 2, "#767a73");
      word(g, "UPWARD", 280, 500, 34, th.ink);
      break;
    case 19:
      for (let i = -560; i < 420; i += 5)
        line(g, i, 0, i + 560, 560, "#355271", 1);
      for (let i = 0; i < 100; i++)
        line(g, 15 + i * 4, 20, 17 + i * 4, 25, "#b48d6c", 2);
      g.strokeStyle = th.accent;
      g.lineWidth = 6;
      g.setLineDash([3, 5]);
      g.strokeRect(25, 25, 370, 510);
      g.setLineDash([]);
      word(g, "SKY COURIER", 210, 488, 26, th.accent, "monospace");
      word(g, "FLIGHT CLUB", 210, 516, 13, th.ink, "monospace");
      break;
  }
  cache.set(id, c);
  return c;
}
export function flyer(id, t) {
  const th = themes[id];
  if (!sprites.has(id)) {
    const c = document.createElement("canvas");
    c.width = 320;
    c.height = 180;
    sprites.set(id, c);
  }
  const c = sprites.get(id),
    g = c.getContext("2d", { willReadFrequently: true });
  g.clearRect(0, 0, 320, 180);
  g.save();
  g.translate(153, 90);
  g.rotate(Math.sin(t * 1.6) * 0.025);
  const outline = th.mode === "outline" || th.mode === "neon",
    ink = th.ink,
    body = th.mode === "silhouette" ? ink : id === 16 ? "#355238" : "#2b6982",
    cape = th.mode === "silhouette" ? (id === 18 ? th.accent : ink) : th.accent;
  if (th.mode === "neon") {
    g.shadowColor = th.accent;
    g.shadowBlur = 10;
  }
  const shape = (pts, co) =>
    poly(g, pts, outline ? null : co, outline ? ink : "#15272d");
  g.lineWidth = outline ? 2.5 : 1.2;
  const cap = [];
  for (let i = 0; i <= 20; i++) {
    const u = i / 20;
    cap.push([25 - u * 146, -24 + u * 10 + Math.sin(t * 4 - u * 7) * u * 16]);
  }
  for (let i = 20; i >= 0; i--) {
    const u = i / 20;
    cap.push([
      25 - u * 146,
      22 + u * 18 + Math.sin(t * 4 - u * 7 + 1) * u * 17,
    ]);
  }
  shape(cap, cape);
  shape(
    [
      [-24, 1],
      [-105, 28],
      [-124, 27],
      [-119, 36],
      [-100, 37],
      [-15, 23],
    ],
    body,
  );
  shape(
    [
      [-21, 7],
      [-97, 3],
      [-119, -1],
      [-127, 8],
      [-103, 15],
      [-8, 28],
    ],
    body,
  );
  shape(
    [
      [-30, -13],
      [25, -25],
      [48, -14],
      [36, 20],
      [-17, 29],
    ],
    body,
  );
  shape(
    [
      [18, -20],
      [64, -26],
      [102, -30],
      [126, -25],
      [126, -17],
      [106, -16],
      [65, -12],
      [34, -4],
    ],
    body,
  );
  shape(
    [
      [9, 0],
      [39, 17],
      [69, 14],
      [74, 24],
      [34, 33],
      [-1, 18],
    ],
    body,
  );
  circle(
    g,
    49,
    -14,
    14,
    outline ? null : th.mode === "silhouette" ? ink : "#f1c79b",
    ink,
  );
  shape(
    [
      [36, -25],
      [45, -32],
      [58, -27],
      [63, -20],
      [47, -23],
    ],
    ink,
  );
  if (!outline && th.mode !== "silhouette") {
    g.fillStyle = th.bg;
    g.fillRect(53, -17, 6, 2);
    word(g, "F", 10, 9, 16, th.bg);
  }
  g.restore();
  g.shadowBlur = 0;
  if (
    [
      "mosaic",
      "stitch",
      "ascii",
      "pixel",
      "dots",
      "hatch",
      "glass",
      "facet",
    ].includes(th.mode)
  ) {
    const image = g.getImageData(0, 0, 320, 180),
      step =
        th.mode === "ascii"
          ? 6
          : th.mode === "pixel"
            ? 5
            : th.mode === "mosaic"
              ? 5
              : th.mode === "stitch"
                ? 4
                : th.mode === "dots"
                  ? 4
                  : 7;
    g.clearRect(0, 0, 320, 180);
    for (let y = 0; y < 180; y += step)
      for (let x = 0; x < 320; x += step) {
        const k = (y * 320 + x) * 4;
        if (image.data[k + 3] < 80) continue;
        const col = `rgb(${image.data[k]},${image.data[k + 1]},${image.data[k + 2]})`;
        if (th.mode === "stitch") {
          line(g, x, y, x + 3, y + 3, col, 1.5);
          line(g, x + 3, y, x, y + 3, col, 1.5);
        } else if (th.mode === "ascii") {
          // Dense glyphs represent dark source areas; cell coordinates stepped
          // by six previously selected '@' everywhere from a six-glyph ramp.
          const ramp = "@#%*+:";
          const luminance = 0.2126 * image.data[k] + 0.7152 * image.data[k + 1] + 0.0722 * image.data[k + 2];
          word(g, ramp[Math.min(ramp.length - 1, Math.floor(luminance / 256 * ramp.length))], x, y + 5, 6, th.ink, "monospace");
        } else if (th.mode === "dots") circle(g, x + 2, y + 2, 1.8, col);
        else if (th.mode === "hatch") {
          g.fillStyle = col;
          g.fillRect(x, y, step, step);
          line(g, x, y + 6, x + 6, y, th.ink, 0.6);
        } else if (th.mode === "glass" || th.mode === "facet")
          poly(
            g,
            [
              [x, y],
              [x + step, y],
              [x + step, y + step],
            ],
            col,
            th.mode === "glass" ? th.ink : null,
          );
        else {
          g.fillStyle = col;
          g.fillRect(
            x,
            y,
            step - (th.mode === "mosaic" ? 1 : 0),
            step - (th.mode === "mosaic" ? 1 : 0),
          );
        }
      }
  }
  return c;
}
