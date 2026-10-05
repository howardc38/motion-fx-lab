import { TIMELINES, chapterAt } from "./timelines.js";
import { surface, label, smooth, hash, TAU, time } from "./common.js";
export const eras = [
  {
    name: "Ochre wall",
    mode: "cave",
    bg: "#b58354",
    ink: "#492b27",
    accent: "#723c2c",
    skin: "#d0a16a",
    sky: "#c69b69",
  },
  {
    name: "Painted papyrus",
    mode: "egypt",
    bg: "#e1cc8d",
    ink: "#213d49",
    accent: "#be5540",
    skin: "#bb7945",
    sky: "#629999",
  },
  {
    name: "Tesserae",
    mode: "mosaic",
    bg: "#dcd2af",
    ink: "#30434b",
    accent: "#658f87",
    skin: "#d6a778",
    sky: "#729fa9",
  },
  {
    name: "Woodblock afternoon",
    mode: "wood",
    bg: "#ece2bc",
    ink: "#233c4b",
    accent: "#c85942",
    skin: "#edc79d",
    sky: "#8bb8be",
  },
  {
    name: "Light in small strokes",
    mode: "paint",
    bg: "#c9d5bb",
    ink: "#3f5571",
    accent: "#9276a4",
    skin: "#e5bb91",
    sky: "#a6c6d4",
  },
  {
    name: "Planes of colour",
    mode: "cube",
    bg: "#d5b78d",
    ink: "#3c3c4a",
    accent: "#bd624d",
    skin: "#e0b46c",
    sky: "#759b9b",
  },
  {
    name: "Sunday comic",
    mode: "comic",
    bg: "#f4d54b",
    ink: "#182942",
    accent: "#ef6858",
    skin: "#f5b27c",
    sky: "#73bfcd",
  },
  {
    name: "After-hours neon",
    mode: "neon",
    bg: "#12172e",
    ink: "#83e8e0",
    accent: "#e57fb6",
    skin: "#dea1ac",
    sky: "#292c59",
  },
];
function path(points) {
  const p = new Path2D();
  points.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  return p;
}
function oval(x, y, rx, ry) {
  const p = new Path2D();
  p.ellipse(x, y, rx, ry, 0, 0, TAU);
  return p;
}
// Shared landmarks and pose are re-drawn with different geometry and mark-making.
// No reference image, footage, screen-space colour filter or random draw state.
function painter(g, th) {
  g.lineJoin = "round";
  g.lineCap = "round";
  function shape(p, color, box, seed = 1) {
    g.fillStyle = color;
    g.strokeStyle = th.ink;
    g.lineWidth = th.mode === "comic" ? 5 : th.mode === "neon" ? 2 : 2.4;
    if (th.mode === "cave") {
      g.globalAlpha = 0.55;
      g.fill(p);
      g.globalAlpha = 1;
      g.stroke(p);
    } else {
      g.fill(p);
      g.stroke(p);
    }
    if (!box) return;
    const [x, y, w, h] = box;
    g.save();
    g.clip(p);
    if (th.mode === "mosaic") {
      for (let yy = y; yy < y + h; yy += 12)
        for (let xx = x; xx < x + w; xx += 13) {
          g.globalAlpha = 0.13 + hash(xx + yy * 17 + seed) * 0.22;
          g.fillStyle = hash(xx * 3 + yy + seed) > 0.5 ? "#fff5d7" : "#192d35";
          g.fillRect(xx + 2, yy + 2, 10, 9);
          g.globalAlpha = 0.4;
          g.strokeStyle = th.bg;
          g.lineWidth = 1;
          g.strokeRect(xx, yy, 13, 12);
        }
    } else if (th.mode === "paint") {
      for (let i = 0; i < (w * h) / 160; i++) {
        const xx = x + hash(i * 7 + seed) * w,
          yy = y + hash(i * 13 + seed) * h;
        g.globalAlpha = 0.25;
        g.strokeStyle = i % 3 ? "#f1dc9c" : "#637ec0";
        g.lineWidth = 3 + hash(i) * 4;
        g.beginPath();
        g.moveTo(xx, yy);
        g.lineTo(xx + 8 + hash(i + 2) * 10, yy - 4);
        g.stroke();
      }
    } else if (th.mode === "comic") {
      g.globalAlpha = 0.2;
      g.fillStyle = th.ink;
      for (let yy = y; yy < y + h; yy += 9)
        for (let xx = x; xx < x + w; xx += 9) {
          g.beginPath();
          g.arc(xx + (yy % 18 ? 4 : 0), yy, 1.3, 0, TAU);
          g.fill();
        }
    } else if (th.mode === "wood" || th.mode === "cave") {
      g.globalAlpha = 0.24;
      g.lineWidth = 1;
      for (let yy = y; yy < y + h; yy += 7) {
        g.beginPath();
        g.moveTo(x, yy);
        g.lineTo(x + w, yy - 18);
        g.stroke();
      }
    } else if (th.mode === "cube") {
      g.globalAlpha = 0.25;
      g.fillStyle = th.ink;
      g.fill(
        path([
          [x, y],
          [x + w * 0.7, y + h * 0.45],
          [x + w, y + h],
          [x + w * 0.2, y + h * 0.8],
        ]),
      );
    } else if (th.mode === "neon") {
      g.globalAlpha = 0.2;
      g.fillStyle = "#b584fd";
      g.fill(
        path([
          [x, y],
          [x + w * 0.5, y],
          [x + w, y + h],
          [x + w * 0.7, y + h],
        ]),
      );
    }
    g.restore();
    g.globalAlpha = 1;
  }
  const poly = (pts, c, seed) => {
    const xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]);
    shape(
      path(pts),
      c,
      [
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
      ],
      seed,
    );
  };
  const ellipse = (x, y, rx, ry, c, s) =>
    shape(oval(x, y, rx, ry), c, [x - rx, y - ry, rx * 2, ry * 2], s);
  const line = (pts, col = th.ink, width = 4) => {
    g.strokeStyle = col;
    g.lineWidth = width;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p)));
    g.stroke();
  };
  return { shape, poly, ellipse, line };
}
function background(th) {
  const { canvas, g } = surface(),
    { poly, ellipse, line } = painter(g, th);
  g.fillStyle = th.bg;
  g.fillRect(0, 0, 1280, 720);
  poly(
    [
      [0, 560],
      [1280, 510],
      [1280, 720],
      [0, 720],
    ],
    th.mode === "neon" ? "#252c48" : "#b9a18a",
  );
  for (let i = 0; i < 11; i++)
    line(
      [
        [640 + (i - 5) * 90, 530],
        [640 + (i - 5) * 240, 720],
      ],
      th.ink,
      1,
    );
  // Architectural marks change with the room treatment, beyond a palette swap.
  if (th.mode === "cave") {
    for (let i = 0; i < 9; i++) {
      const x = 70 + i * 150,
        y = 155 + hash(i) * 290;
      poly(
        [
          [x, y],
          [x + 90, y - 40],
          [x + 160, y + 55],
          [x + 70, y + 140],
        ],
        i % 2 ? "#af784d" : "#bc8d5f",
        i,
      );
    }
    line(
      [
        [900, 226],
        [967, 206],
        [1000, 226],
        [993, 259],
        [920, 265],
        [900, 226],
      ],
      th.ink,
      5,
    );
    line(
      [
        [927, 263],
        [924, 292],
      ],
      th.ink,
      4,
    );
    line(
      [
        [974, 262],
        [979, 292],
      ],
      th.ink,
      4,
    );
    line(
      [
        [996, 225],
        [1020, 208],
        [1047, 216],
      ],
      th.ink,
      4,
    );
  } else if (th.mode === "egypt") {
    for (const y of [127, 503]) {
      g.fillStyle = th.ink;
      g.fillRect(0, y, 1280, 4);
      for (let x = 18; x < 1280; x += 32) {
        poly(
          [
            [x, y + 9],
            [x + 13, y + 28],
            [x + 26, y + 9],
          ],
          th.accent,
        );
      }
    }
    for (let x = 880; x < 1060; x += 45) {
      line(
        [
          [x, 203],
          [x, 379],
        ],
        th.ink,
        3,
      );
      for (let y = 214; y < 379; y += 32) ellipse(x, y, 8, 5, th.accent);
    }
  } else if (th.mode === "mosaic") {
    for (let i = 0; i < 27; i++) {
      const a = Math.PI + (i / 26) * Math.PI;
      ellipse(
        286 + 172 * Math.cos(a),
        164 + 30 * Math.sin(a),
        8,
        9,
        th.accent,
        i,
      );
    }
    for (let x = 30; x < 1280; x += 28)
      poly(
        [
          [x, 494],
          [x + 12, 480],
          [x + 24, 494],
          [x + 12, 508],
        ],
        th.accent,
        x,
      );
  } else if (th.mode === "wood") {
    for (let i = 0; i < 7; i++)
      line(
        [
          [40, 126 + i * 4],
          [465, 126 + i * 4],
        ],
        th.ink,
        1,
      );
    for (let i = 0; i < 5; i++)
      poly(
        [
          [868 + i * 18, 175],
          [871 + i * 18, 175],
          [871 + i * 18, 390],
          [868 + i * 18, 390],
        ],
        th.ink,
      );
  } else if (th.mode === "paint") {
    g.globalAlpha = 0.22;
    for (let i = 0; i < 1200; i++) {
      const x = hash(i + 90) * 1280,
        y = hash(i + 930) * 540;
      g.strokeStyle = i % 2 ? "#ffecb3" : "#729997";
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 25, y - 12);
      g.stroke();
    }
    g.globalAlpha = 1;
    poly(
      [
        [153, 433],
        [422, 433],
        [1050, 600],
        [620, 637],
      ],
      "#e5dbaa",
      20,
    );
  } else if (th.mode === "cube") {
    poly(
      [
        [0, 118],
        [650, 172],
        [527, 507],
        [0, 558],
      ],
      "#bda388",
      1,
    );
    poly(
      [
        [828, 129],
        [1280, 108],
        [1280, 540],
        [1009, 457],
      ],
      "#be7863",
      2,
    );
    poly(
      [
        [468, 120],
        [587, 160],
        [430, 533],
      ],
      "#e9cc94",
      3,
    );
  } else if (th.mode === "comic") {
    for (let i = 0; i < 13; i++) {
      const x = 880 + i * 20;
      line(
        [
          [920, 252],
          [x, 126],
        ],
        th.accent,
        2,
      );
    }
    poly(
      [
        [880, 355],
        [1000, 355],
        [1000, 406],
        [934, 406],
        [911, 424],
        [915, 406],
        [880, 406],
      ],
      "#fff6d6",
    );
    g.fillStyle = th.ink;
    g.font = "900 21px Arial";
    g.fillText("SLOW DAY.", 889, 386);
  } else if (th.mode === "neon") {
    for (let i = 0; i < 8; i++) {
      const x = 860 + i * 25,
        y = 210 + hash(i) * 120;
      poly(
        [
          [x, y],
          [x + 17, y],
          [x + 17, 443],
          [x, 443],
        ],
        i % 2 ? "#393568" : "#28305e",
      );
      for (let yy = y + 10; yy < 443; yy += 18) {
        g.fillStyle = th.accent;
        g.fillRect(x + 5, yy, 5, 4);
      }
    }
  }
  // The window stays in the same place; its construction changes with the art direction.
  poly(
    [
      [140, 154],
      [435, 154],
      [435, 446],
      [140, 446],
    ],
    th.ink,
  );
  poly(
    [
      [153, 167],
      [422, 167],
      [422, 433],
      [153, 433],
    ],
    th.sky,
    3,
  );
  ellipse(345, 226, 36, 36, th.mode === "neon" ? "#e798c5" : "#f3d592");
  poly(
    [
      [153, 382],
      [230, 310],
      [302, 381],
      [368, 302],
      [422, 348],
      [422, 433],
      [153, 433],
    ],
    th.accent,
    2,
  );
  if (th.mode === "egypt") {
    for (let i = 0; i < 8; i++) {
      ellipse(172 + i * 33, 188, 4, 8, th.ink);
      line(
        [
          [172 + i * 33, 198],
          [172 + i * 33, 210],
        ],
        th.ink,
        2,
      );
    }
  } else if (th.mode === "cube") {
    poly(
      [
        [153, 167],
        [320, 167],
        [251, 433],
        [153, 433],
      ],
      "#af8c72",
      4,
    );
  } else if (th.mode !== "cave") {
    line(
      [
        [286, 165],
        [286, 436],
      ],
      th.ink,
      9,
    );
    line(
      [
        [151, 306],
        [424, 306],
      ],
      th.ink,
      9,
    );
  }
  poly(
    [
      [508, 174],
      [676, 174],
      [676, 296],
      [508, 296],
    ],
    th.ink,
  );
  poly(
    [
      [518, 184],
      [666, 184],
      [666, 286],
      [518, 286],
    ],
    th.bg,
  );
  ellipse(590, 234, 31, 31, th.accent);
  // Plant silhouette, pot and framed picture are common layout anchors.
  for (let i = 0; i < 6; i++) {
    const y = 315 + i * 32;
    line(
      [
        [1101, 536],
        [1101, y],
      ],
      th.ink,
      4,
    );
    ellipse(1080 + (i % 2) * 42, y, 25, 11, th.accent, i);
  }
  poly(
    [
      [1062, 526],
      [1140, 526],
      [1125, 585],
      [1077, 585],
    ],
    th.accent,
  );
  for (let i = 0; i < 250; i++) {
    g.fillStyle = th.mode === "neon" ? "#e6e1bc" : "#6f513f";
    g.globalAlpha = 0.09;
    const x = hash(i) * 1280,
      y = hash(i + 713) * 720;
    g.fillRect(x, y, 1 + hash(i + 9) * 3, 1);
  }
  g.globalAlpha = 1;
  return canvas;
}
export function create() {
  const { canvas, g } = surface(),
    backs = eras.map(background),
    captions = eras.map((th) => {
      const c = surface();
      label(
        c.g,
        "One scene. Many eras.",
        th.name,
        th.mode === "neon" ? "#dbebe8" : "#283c46",
      );
      return c.canvas;
    });
  let proof;
  function scene(id, t) {
    const th = eras[id],
      { poly, ellipse, line } = painter(g, th);
    g.drawImage(backs[id], 0, 0);
    const phase = t % 6,
      lift = smooth((phase - 0.7) / 1.2) * (1 - smooth((phase - 3) / 1.3)),
      hand = [752 - 18 * lift, 423 - 116 * lift],
      headX = 726 + lift * 6;
    // Chair, grounded legs, coat, face and articulated arm.
    poly(
      [
        [651, 337],
        [684, 331],
        [700, 485],
        [672, 491],
      ],
      th.accent,
      7,
    );
    poly(
      [
        [674, 480],
        [688, 480],
        [678, 628],
        [662, 628],
      ],
      th.ink,
    );
    poly(
      [
        [677, 470],
        [813, 470],
        [813, 488],
        [677, 488],
      ],
      th.accent,
    );
    poly(
      [
        [708, 472],
        [778, 476],
        [818, 513],
        [808, 593],
        [848, 604],
        [849, 622],
        [780, 622],
        [778, 545],
        [736, 526],
        [728, 585],
        [745, 608],
        [713, 618],
        [695, 596],
        [698, 517],
      ],
      th.mode === "neon" ? "#414b73" : "#506270",
      6,
    );
    poly(
      [
        [693, 330],
        [752, 326],
        [799, 468],
        [699, 474],
        [677, 400],
      ],
      th.accent,
      8,
    );
    if (th.mode === "cube")
      poly(
        [
          [699, 338],
          [746, 331],
          [764, 430],
          [713, 408],
        ],
        "#e4bb63",
        9,
      );
    ellipse(headX, 282, 38, 48, th.skin, 9);
    poly(
      [
        [headX - 36, 276],
        [headX - 40, 245],
        [headX - 13, 229],
        [headX + 22, 237],
        [headX + 36, 260],
        [headX + 21, 268],
        [headX - 10, 254],
        [headX - 14, 283],
      ],
      th.ink,
    );
    line(
      [
        [headX + 20, 284],
        [headX + 27, 285],
      ],
      th.ink,
      3,
    );
    line(
      [
        [headX + 26, 301],
        [headX + 35, 298],
      ],
      th.ink,
      2,
    );
    const elbow = [793 - 12 * lift, 410 - 18 * lift];
    line([[737, 354], elbow, hand], th.ink, 34);
    line([[737, 354], elbow], th.accent, 28);
    line([elbow, hand], th.skin, 22);
    ellipse(...hand, 12, 12, th.skin);
    // The cup follows the hand through every style change, rather than resetting at cuts.
    poly(
      [
        [hand[0] - 5, hand[1] - 32],
        [hand[0] + 33, hand[1] - 32],
        [hand[0] + 29, hand[1] + 5],
        [hand[0] + 1, hand[1] + 5],
      ],
      th.bg,
      13,
    );
    g.strokeStyle = th.ink;
    g.lineWidth = 4;
    g.stroke(oval(hand[0] + 35, hand[1] - 16, 10, 10));
    // A narrow table leaves the reaching arm readable.
    poly(
      [
        [469, 457],
        [638, 437],
        [905, 457],
        [840, 487],
        [469, 484],
      ],
      th.mode === "neon" ? "#38465b" : "#c69a66",
      15,
    );
    poly(
      [
        [502, 483],
        [517, 483],
        [504, 643],
        [489, 643],
      ],
      th.ink,
    );
    poly(
      [
        [834, 482],
        [849, 480],
        [869, 640],
        [853, 640],
      ],
      th.ink,
    );
    ellipse(600, 466, 36, 9, th.bg);
    poly(
      [
        [566, 456],
        [595, 448],
        [624, 456],
        [596, 464],
      ],
      th.accent,
    );
    // Original sleeping cat: breathing body, ear triangles and a moving tail.
    const breath = Math.sin(t * 1.8) * 2;
    ellipse(982, 625, 69, 30 + breath, th.accent, 23);
    ellipse(937, 613, 27, 25, th.accent, 24);
    poly(
      [
        [916, 602],
        [915, 577],
        [934, 590],
        [948, 581],
        [955, 603],
      ],
      th.accent,
      25,
    );
    line(
      [
        [919, 615],
        [927, 618],
        [935, 615],
      ],
      th.ink,
      2,
    );
    line(
      [
        [1040, 625],
        [1070, 607 + Math.sin(t) * 8],
        [1054, 588],
      ],
      th.accent,
      13,
    );
    if (th.mode === "comic") {
      g.font = "900 20px Arial";
      g.fillStyle = th.ink;
      g.fillText("SIP.", 808, 300);
    }
    g.drawImage(captions[id], 0, 0);
    proof = {
      style: th.name,
      styleIndex: id,
      sourceTime: t,
      hand,
      cup: [...hand],
      landmarks: { window: [140, 154], table: [469, 457], cat: [982, 625] },
    };
  }
  return {
    canvas,
    frame(seconds, o = {}) {
      const selected = chapterAt(TIMELINES.eras, seconds),
        t = selected.time,
        id = o.style ?? selected.chapter.style;
      if (!Number.isInteger(id) || !eras[id])
        throw new Error("Unknown room style");
      scene(id, t);
      if (o.style === undefined && id < eras.length - 1) {
        const u = selected.progress;
        if (u > 0.86) {
          g.save();
          g.beginPath();
          g.rect(1280 * (1 - smooth((u - 0.86) / 0.14)), 0, 1280, 720);
          g.clip();
          scene(id + 1, t);
          g.restore();
        }
      }
    },
    proof: () => proof,
  };
}
