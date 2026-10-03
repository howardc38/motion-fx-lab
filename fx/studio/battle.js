// Original joint-space fight choreography; no borrowed footage or motion assets.
export const BATTLE_DURATION = 19.2;
export const BATTLE_MUSIC = [
  [0, "build"],
  [2.4, "drop"],
  [8.4, "break"],
  [9.6, "final"],
  [18, "tail"],
];
export const BATTLE_GIF = [
  [0.35, 1.3],
  [2.65, 3.65],
  [6.1, 7.1],
  [10, 11],
  [15.1, 16.1],
];
export const BATTLE_POSTER = 3.04;
const hits = [
  0.6, 1.8, 3, 4.2, 5.4, 6.6, 7.8, 10.2, 11.4, 12.6, 13.2, 13.8, 15, 16.2, 17.4,
];
export const battleCues = () =>
  hits.flatMap((t, i) => [
    { t: t - 0.22, name: "whoosh", gain: 0.6 },
    { t, name: i % 3 ? "stamp" : "impact", gain: 0.65 },
  ]);

export function createBattle() {
  const W = 1280,
    H = 720,
    c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true }),
    src = document.createElement("canvas");
  src.width = W;
  src.height = H;
  const g = src.getContext("2d", { willReadFrequently: true });
  let lastProof = null;
  const mix = (a, b, t) => a + (b - a) * t,
    clamp = (x) => Math.max(0, Math.min(1, x)),
    ease = (x) => x * x * (3 - 2 * x),
    rnd = (n) => {
      let q = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return q - Math.floor(q);
    };
  // Every pose is authored in joint-space: hip, shoulder, head, rear elbow/hand,
  // front elbow/hand, rear knee/ankle, front knee/ankle. No motion-capture asset.
  const P = {
    guard: [
      0, 430, 12, 308, 12, 249, -45, 332, 35, 296, 66, 329, 110, 283, -52, 511,
      -92, 602, 68, 508, 113, 602,
    ],
    load: [
      -28, 454, -40, 334, -38, 273, -107, 333, -95, 277, 20, 357, 65, 326, -75,
      520, -121, 602, 47, 527, 109, 602,
    ],
    jab: [
      36, 418, 90, 304, 108, 249, 32, 338, 59, 293, 169, 286, 248, 278, -17,
      508, -123, 602, 117, 512, 154, 602,
    ],
    recoil: [
      35, 441, -32, 328, -71, 279, -73, 336, -103, 274, 9, 366, 60, 333, -39,
      515, -78, 602, 102, 530, 155, 602,
    ],
    block: [
      -3, 442, -12, 320, -14, 264, 15, 312, 79, 244, 63, 347, 85, 271, -65, 512,
      -111, 602, 58, 528, 104, 602,
    ],
    duck: [
      -13, 494, 69, 427, 123, 394, -29, 432, 32, 405, 101, 459, 153, 421, -78,
      543, -129, 602, 76, 546, 143, 602,
    ],
    kickload: [
      -10, 437, -45, 322, -52, 269, -91, 318, -38, 274, 15, 339, 75, 304, -56,
      513, -75, 602, 67, 429, 43, 491,
    ],
    kick: [
      -18, 410, -74, 314, -98, 270, -120, 345, -58, 378, 3, 333, 62, 305, -48,
      500, -63, 602, 94, 352, 232, 290,
    ],
    sweep: [
      -25, 522, -91, 454, -105, 404, -148, 514, -177, 585, -38, 473, 27, 454,
      -82, 559, -115, 603, 91, 554, 225, 602,
    ],
    jump: [
      8, 317, 34, 221, 54, 167, -29, 207, 16, 153, 101, 236, 148, 190, -34, 410,
      -104, 416, 103, 354, 143, 442,
    ],
    fly: [
      -20, 334, -75, 237, -98, 190, -145, 279, -185, 234, -22, 244, 33, 190,
      -67, 411, -146, 475, 94, 330, 236, 279,
    ],
    fall: [
      16, 400, -73, 338, -119, 307, -130, 372, -188, 318, -25, 310, -49, 258,
      62, 482, 146, 519, -40, 494, -55, 583,
    ],
    upperload: [
      -25, 482, -6, 374, 22, 322, -75, 389, -27, 342, 53, 437, 98, 410, -74,
      532, -131, 602, 59, 540, 131, 602,
    ],
    upper: [
      38, 406, 68, 285, 48, 231, 7, 325, 77, 342, 141, 266, 153, 171, -30, 508,
      -113, 602, 112, 497, 119, 602,
    ],
    land: [
      8, 495, 73, 393, 91, 342, -20, 405, 10, 341, 116, 461, 177, 499, -74, 548,
      -137, 602, 99, 542, 162, 602,
    ],
    finish: [
      0, 430, 7, 308, 0, 249, -55, 347, -92, 302, 65, 329, 112, 300, -56, 515,
      -104, 602, 57, 515, 98, 602,
    ],
  };
  // Root displacement and asymmetric counterattacks make contact readable.
  const A = [
    [0, "guard", 320],
    [0.32, "load", 300],
    [0.6, "jab", 440],
    [0.69, "jab", 440],
    [1.12, "guard", 387],
    [1.48, "block", 391],
    [1.8, "recoil", 381],
    [1.9, "recoil", 379],
    [2.35, "kickload", 374],
    [2.74, "kickload", 402],
    [3, "kick", 454],
    [3.1, "kick", 454],
    [3.54, "guard", 423],
    [3.9, "duck", 441],
    [4.2, "duck", 430],
    [4.36, "duck", 432],
    [4.82, "upperload", 410],
    [5.12, "load", 414],
    [5.4, "jab", 470],
    [5.5, "jab", 470],
    [5.98, "guard", 408],
    [6.35, "jump", 423],
    [6.6, "jump", 438],
    [6.76, "land", 455],
    [7.2, "load", 364],
    [7.8, "jab", 442],
    [8.4, "jab", 442],
    [9.1, "jab", 442],
    [9.6, "kickload", 340],
    [10.2, "fly", 451],
    [10.3, "fly", 451],
    [10.65, "land", 457],
    [11.1, "load", 422],
    [11.4, "jab", 480],
    [11.49, "jab", 480],
    [12, "upperload", 428],
    [12.6, "upper", 468],
    [12.69, "upper", 468],
    [12.96, "guard", 456],
    [13.2, "jab", 478],
    [13.29, "jab", 478],
    [13.55, "block", 451],
    [13.8, "recoil", 439],
    [14.25, "load", 358],
    [14.76, "jump", 388],
    [15, "fly", 446],
    [15.1, "fly", 446],
    [15.6, "land", 440],
    [16.2, "block", 439],
    [16.29, "block", 439],
    [16.85, "load", 422],
    [17.4, "jab", 464],
    [17.52, "jab", 464],
    [18, "finish", 414],
    [19.2, "finish", 414],
  ];
  const B = [
    [0, "guard", 940],
    [0.36, "guard", 918],
    [0.6, "block", 784],
    [0.69, "block", 784],
    [1.14, "load", 856],
    [1.5, "load", 836],
    [1.8, "jab", 700],
    [1.9, "jab", 700],
    [2.36, "guard", 851],
    [2.75, "block", 840],
    [3, "recoil", 655],
    [3.12, "recoil", 655],
    [3.62, "kickload", 845],
    [3.95, "kickload", 818],
    [4.2, "kick", 787],
    [4.35, "kick", 787],
    [4.82, "guard", 835],
    [5.15, "guard", 815],
    [5.4, "block", 808],
    [5.5, "block", 808],
    [6, "sweep", 809],
    [6.6, "sweep", 794],
    [6.72, "sweep", 794],
    [7.2, "load", 874],
    [7.8, "jab", 777],
    [8.4, "jab", 777],
    [9.1, "jab", 777],
    [9.6, "guard", 867],
    [10.2, "block", 799],
    [10.3, "block", 799],
    [10.7, "recoil", 833],
    [11.1, "load", 861],
    [11.4, "duck", 820],
    [11.5, "duck", 820],
    [12, "guard", 808],
    [12.6, "fall", 647],
    [12.72, "fall", 647],
    [12.98, "guard", 820],
    [13.2, "block", 811],
    [13.29, "block", 811],
    [13.55, "load", 827],
    [13.8, "jab", 713],
    [14.2, "load", 870],
    [14.7, "kickload", 845],
    [15, "kick", 788],
    [15.1, "kick", 788],
    [15.65, "guard", 837],
    [16.2, "jab", 763],
    [16.29, "jab", 763],
    [16.8, "load", 846],
    [17.4, "block", 814],
    [17.52, "block", 814],
    [18, "finish", 882],
    [19.2, "finish", 882],
  ];
  function state(track, t) {
    let k = 0;
    while (k < track.length - 2 && t >= track[k + 1][0]) k++;
    let a = track[k],
      b = track[k + 1],
      u = ease(clamp((t - a[0]) / (b[0] - a[0])));
    return {
      p: P[a[1]].map((v, i) => mix(v, P[b[1]][i], u)),
      x: mix(a[2], b[2], u),
    };
  }
  function poly(points, color) {
    g.fillStyle = color;
    g.beginPath();
    points.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p)));
    g.closePath();
    g.fill();
  }
  function limb(a, b, c, w1, w2, col) {
    g.strokeStyle = col;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = w1;
    g.beginPath();
    g.moveTo(...a);
    g.lineTo(...b);
    g.stroke();
    g.lineWidth = w2;
    g.beginPath();
    g.moveTo(...b);
    g.lineTo(...c);
    g.stroke();
  }
  function fighter(st, face, id, t, override) {
    const p = st.p,
      pt = (i) => [p[i * 2], p[i * 2 + 1]],
      hip = pt(0),
      sh = pt(1),
      head = pt(2),
      rearE = pt(3),
      rearH = pt(4),
      frontE = pt(5),
      frontH = pt(6),
      rearK = pt(7),
      rearF = pt(8),
      frontK = pt(9),
      frontF = pt(10);
    let ink = override || "#142b3a",
      cloth = override || (id ? "#258b99" : "#eb7044"),
      light = override || (id ? "#69c4c9" : "#f9b079"),
      skin = override || "#f7d4a4";
    g.save();
    g.translate(st.x, 0);
    g.scale(face, 1);
    // Loose trousers, split wrap jacket, forearm wraps, and a flowing waist sash.
    limb([hip[0] - 13, hip[1]], rearK, rearF, 57, 39, ink);
    limb([sh[0] - 18, sh[1] + 10], rearE, rearH, 34, 25, ink);
    limb([hip[0] + 13, hip[1]], frontK, frontF, 66, 42, cloth);
    poly(
      [
        [hip[0] - 34, hip[1] + 12],
        [hip[0] + 42, hip[1] + 15],
        [sh[0] + 33, sh[1] - 8],
        [sh[0] - 34, sh[1] - 6],
      ],
      cloth,
    );
    poly(
      [
        [sh[0] - 30, sh[1]],
        [sh[0] - 9, sh[1] - 14],
        [hip[0] + 26, hip[1] - 3],
        [hip[0] + 9, hip[1] + 6],
      ],
      light,
    );
    poly(
      [
        [hip[0] - 44, hip[1] - 7],
        [hip[0] + 42, hip[1] - 7],
        [hip[0] + 43, hip[1] + 13],
        [hip[0] - 44, hip[1] + 14],
      ],
      ink,
    );
    const flow = Math.sin(t * 12 + id) * 20;
    poly(
      [
        [hip[0] - 28, hip[1]],
        [hip[0] - 82, hip[1] - 12],
        [hip[0] - 141, hip[1] + flow - 38],
        [hip[0] - 105, hip[1] + flow + 10],
        [hip[0] - 62, hip[1] + 27],
      ],
      light,
    );
    limb([sh[0] + 17, sh[1] + 10], frontE, frontH, 42, 29, cloth);
    limb(
      [mix(frontE[0], frontH[0], 0.6), mix(frontE[1], frontH[1], 0.6)],
      frontH,
      frontH,
      25,
      25,
      skin,
    );
    // Sculpted jaw and windswept hair create an identifiable human silhouette.
    g.strokeStyle = skin;
    g.lineWidth = 23;
    g.beginPath();
    g.moveTo(sh[0], sh[1]);
    g.lineTo(head[0], head[1] + 22);
    g.stroke();
    g.fillStyle = skin;
    g.beginPath();
    g.ellipse(head[0] + 6, head[1], 29, 37, -0.1, 0, Math.PI * 2);
    g.fill();
    poly(
      [
        [head[0] + 20, head[1] - 17],
        [head[0] + 40, head[1] + 5],
        [head[0] + 24, head[1] + 10],
        [head[0] + 17, head[1] + 30],
        [head[0] - 17, head[1] + 27],
      ],
      skin,
    );
    const hair = [
      [-30, 19],
      [-40, -7],
      [-51, -17],
      [-32, -22],
      [-45, -43],
      [-21, -36],
      [-18, -57],
      [-5, -38],
      [15, -51],
      [14, -29],
      [34, -34],
      [28, -11],
      [13, -16],
      [-5, 0],
      [-8, 22],
    ].map(([x, y]) => [head[0] + x, head[1] + y]);
    poly(hair, ink);
    g.fillStyle = ink;
    g.fillRect(head[0] + 18, head[1] - 5, 13, 5);
    g.strokeStyle = ink;
    g.lineWidth = 18;
    g.lineCap = "round";
    for (const f of [rearF, frontF]) {
      g.beginPath();
      g.moveTo(f[0] - 12, f[1]);
      g.lineTo(f[0] + 27, f[1]);
      g.stroke();
    }
    // Folds and wrist bands survive the dot conversion as high-contrast detail.
    g.strokeStyle = light;
    g.lineWidth = 5;
    for (let j = 0; j < 3; j++) {
      g.beginPath();
      g.moveTo(frontK[0] - 16, frontK[1] + j * 12);
      g.lineTo(frontK[0] + 17, frontK[1] + j * 12 - 8);
      g.stroke();
    }
    g.restore();
  }
  const palettes = [
    ["#efe7d2", "#142b3a"],
    ["#f96939", "#122c39"],
    ["#12212e", null],
    ["#f1ca38", "#142738"],
    ["#ede6d6", "#183145"],
    ["#102634", null],
    ["#f37046", "#142d3a"],
    ["#f3e8d2", "#142b3a"],
  ];
  function camera(t) {
    let z = 1.04,
      x = 640,
      y = 385,
      rot = 0;
    if (t < 0.36) {
      z = mix(1.34, 1.05, t / 0.36);
    } else if (t < 1.2) {
      z = 1.3;
      x = 640;
      y = 353;
      rot = -0.025;
    } else if (t < 2.4) {
      z = 1.14;
      rot = 0.022;
    } else if (t < 3.6) {
      z = 1.22;
      y = 356;
      rot = -0.05;
    } else if (t < 4.8) {
      z = 1.12;
      rot = 0.04;
    } else if (t < 6) {
      z = 1.4;
      x = 642;
      y = 366;
    } else if (t < 7.2) {
      z = 1.03;
      y = 397;
      rot = -0.03;
    } else if (t < 8.4) {
      z = 1.2;
      y = 344;
    } else if (t < 9.6) {
      z = 1.55;
      y = 314;
      rot = (t - 9) * 0.16;
    } else if (t < 10.8) {
      z = 1.15;
      y = 315;
      rot = -0.04;
    } else if (t < 12) {
      z = 1.35;
      y = 382;
      rot = 0.045;
    } else if (t < 13.2) {
      z = 1.25;
      y = 320;
      rot = -0.04;
    } else if (t < 14.4) {
      z = 1.4;
      y = 333;
    } else if (t < 15.6) {
      z = 1.1;
      y = 313;
      rot = 0.035;
    } else if (t < 16.8) {
      z = 1.22;
      y = 364;
    } else {
      z = 1.14;
      y = 365;
    }
    let hit = hits.find((v) => t >= v && t < v + 0.2);
    if (hit !== undefined) {
      let e = Math.exp(-(t - hit) * 20);
      x += Math.sin((t - hit) * 100) * 12 * e;
      y += Math.cos((t - hit) * 75) * 8 * e;
      z += 0.055 * e;
    }
    return { z, x, y, rot };
  }
  function source(t, ghost = 0, override = null) {
    g.clearRect(0, 0, W, H);
    const cam = camera(t);
    g.save();
    g.translate(W / 2, H / 2);
    g.rotate(cam.rot);
    g.scale(cam.z, cam.z);
    g.translate(-cam.x, -cam.y);
    fighter(state(A, Math.max(0, t - ghost)), 1, 0, t, override);
    fighter(state(B, Math.max(0, t - ghost)), -1, 1, t, override);
    g.restore();
    return g.getImageData(0, 0, W, H).data;
  }
  function dots(data, t, spacing, solid, alpha = 1, ghost = 0) {
    ctx.globalAlpha = alpha;
    const last = hits.filter((x) => t >= x).at(-1),
      age = t - last,
      burst = age >= 0 && age < 0.22 ? Math.sin((age / 0.22) * Math.PI) : 0;
    const freeze = t >= 8.4 && t < 9.6;
    const theta = ((t - 8.4) / 1.2) * Math.PI * 0.28;
    for (let y = 2; y < H; y += spacing)
      for (let x = 2; x < W; x += spacing) {
        let k = (y * W + x) * 4;
        if (data[k + 3] < 100) continue;
        let r =
            spacing *
            (0.28 + (0.17 * (data[k] + data[k + 1] + data[k + 2])) / 765),
          px = x,
          py = y;
        const dist = Math.hypot(x - 655, y - 315);
        if (dist < 130 && burst) {
          px += Math.sin(k) * burst * 23;
          py += Math.cos(k) * burst * 18;
          r *= 1 - 0.25 * burst;
        }
        if (freeze) {
          const depth = ((data[k] + data[k + 1] + data[k + 2]) / 765) * 65;
          px = 640 + (x - 640) * Math.cos(theta) + depth * Math.sin(theta);
          py = y + (x - 640) * Math.sin(theta) * 0.11;
        }
        ctx.fillStyle =
          solid || `rgb(${data[k]},${data[k + 1]},${data[k + 2]})`;
        ctx.beginPath();
        ctx.ellipse(
          px,
          py,
          r,
          r * (burst && dist < 130 ? 0.65 : 1),
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    ctx.globalAlpha = 1;
  }
  function frame(t) {
    if (!Number.isFinite(t)) throw new Error("Frame time must be finite");
    t = Math.min(19.2, Math.max(0, t));
    const pi = Math.floor(t / 1.2) % palettes.length,
      pal = palettes[pi],
      bg = t >= 18 ? "#112937" : pal[0];
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // Fine registration lines and minimal editorial typography anchor the frame.
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = pal[1] || "#bcdad7";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(44, 662);
    ctx.lineTo(1236, 662);
    ctx.stroke();
    ctx.globalAlpha = 1;
    const spacing =
      t < 1.2
        ? 5
        : t < 2.4
          ? 7
          : t < 3.6
            ? 5
            : t < 4.8
              ? 6
              : t < 6
                ? 4
                : t < 7.2
                  ? 6
                  : t < 8.4
                    ? 5
                    : t < 9.6
                      ? 5
                      : t < 10.8
                        ? 6
                        : t < 12
                          ? 4
                          : t < 13.2
                            ? 5
                            : t < 14.4
                              ? 6
                              : 5;
    let motionTime = t >= 8.4 && t < 9.6 ? 7.8 : t;
    const trail =
      (t >= 4.8 && t < 7.2) || (t >= 10.8 && t < 12) || (t >= 13.2 && t < 16.8);
    if (trail) {
      for (let n = 3; n > 0; n--) {
        dots(
          source(motionTime, n * 0.065),
          t,
          spacing,
          n === 3 ? "#ebae67" : n === 2 ? "#e87179" : "#518fb0",
          0.19 + (3 - n) * 0.08,
          n,
        );
      }
    }
    if (t < 18) dots(source(motionTime), t, spacing, pal[1]);
    else {
      let u = clamp((t - 18) / 0.65);
      dots(source(18), t, 7, "#f3dec2", (1 - u) * 0.38);
      ctx.fillStyle = "#f0e6d1";
      ctx.textAlign = "center";
      ctx.font = "900 96px Arial";
      ctx.fillText("COUNTERFORM", 640, 344);
      ctx.font = "18px Arial";
      ctx.letterSpacing = "7px";
      ctx.fillText("A FIGHT IN DOTS", 640, 393);
      ctx.letterSpacing = "0px";
      ctx.textAlign = "left";
    }
    // Short radial marks are tied to authored contact, never a long full-frame explosion.
    for (const h of hits) {
      const d = t - h;
      if (d < 0 || d > 0.16) continue;
      let u = d / 0.16;
      const cp = {
        0.6: [688, 278],
        1.8: [458, 278],
        3: [687, 284],
        4.2: [551, 310],
        5.4: [718, 278],
        6.6: [550, 562],
        7.8: [639, 278],
        10.2: [688, 279],
        11.4: [694, 391],
        12.6: [621, 247],
        13.2: [726, 278],
        13.8: [465, 278],
        15: [640, 288],
        16.2: [519, 278],
        17.4: [712, 278],
      }[String(h)] || [688, 278];
      const cc = camera(t),
        dx = (cp[0] - cc.x) * cc.z,
        dy = (cp[1] - cc.y) * cc.z,
        cx = 640 + dx * Math.cos(cc.rot) - dy * Math.sin(cc.rot),
        cy = 360 + dx * Math.sin(cc.rot) + dy * Math.cos(cc.rot);
      ctx.strokeStyle = pal[1] || "#f5d6a3";
      ctx.lineWidth = 3 * (1 - u);
      ctx.globalAlpha = (1 - u) * 0.8;
      for (let n = 0; n < 18; n++) {
        const a = (n / 18) * Math.PI * 2,
          r = 28 + u * 100;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.lineTo(cx + Math.cos(a) * (r + 16), cy + Math.sin(a) * (r + 16));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = t >= 18 ? "#b7cbc9" : pal[1] || "#dbd9c7";
    ctx.font = "600 13px Arial";
    ctx.fillText("COUNTERFORM", 44, 40);
    ctx.textAlign = "right";
    ctx.font = "12px Arial";
    ctx.fillText("ORIGINAL MOTION / 2026", 1236, 40);
    ctx.fillText(
      `${String(Math.min(16, Math.floor(t / 1.2) + 1)).padStart(2, "0")} / 16`,
      1236,
      688,
    );
    ctx.textAlign = "left";
    if (t < 0.36) {
      ctx.fillStyle = pal[1] || "#f4e6cb";
      ctx.font = "900 52px Arial";
      ctx.fillText("READY?", 44, 630);
    }
    lastProof = {
      t,
      poses: [state(A, motionTime), state(B, motionTime)],
      spacing,
      dimension: t >= 8.4 && t < 9.6 ? "2.5D relief" : "2D illustration",
    };
  }

  return {
    canvas: c,
    duration: BATTLE_DURATION,
    frame: async (t) => frame(t),
    proof: () => lastProof,
  };
}
