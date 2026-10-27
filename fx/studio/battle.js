// Original joint-space fight choreography; no borrowed footage or motion assets.
// Film time and story (choreography) time differ: the cold open skips one beat
// so the film starts on the first contact, and at the climax story time holds
// for a 1.2 s freeze-orbit of the volumetric fighters (fx/signals/orbit.js).
export const STORY_DURATION = 19.2;
export const COLD_OPEN = 0.6;
export const FREEZE = { film: 12.0, story: 12.6, duration: 1.2, pose: 3.05 };
export const BATTLE_DURATION = Math.round((STORY_DURATION - COLD_OPEN + FREEZE.duration) * 1000) / 1000;
export function storyTime(f) {
  if (f < FREEZE.film) return f + COLD_OPEN;
  if (f < FREEZE.film + FREEZE.duration) return FREEZE.story;
  return f + COLD_OPEN - FREEZE.duration;
}
const filmTime = (s) => Math.round((s < FREEZE.story ? s - COLD_OPEN : s - COLD_OPEN + FREEZE.duration) * 1e6) / 1e6;
export const BATTLE_MUSIC = [
  [0, "build"],
  [2.4, "drop"],
  [7.2, "break"],
  [9.6, "final"],
  [FREEZE.film, "break"],
  [FREEZE.film + FREEZE.duration, "final"],
  [filmTime(18), "tail"],
];
// The card's silent loop (window.__preview).
export const BATTLE_PREVIEW = [
  [0, 1],
  [2.05, 3.05],
  [5.5, 6.5],
  [11.8, 13.6],
  [14.4, 15.4],
];
export const BATTLE_POSTER = 2.44;
// One authored event list drives contact, sound and local particle displacement.
// A miss has a travelling hand/foot, but no impact sound, shake or burst.
export const BATTLE_BEATS = [
  [.6, "block", 0, 6, 6], [1.8, "hit", 1, 6, 2],
  [3, "hit", 0, 10, 2], [4.2, "dodge", 1, 10, 2],
  [5.4, "block", 0, 6, 6], [6.6, "dodge", 1, 10, 10],
  [7.8, "block", 0, 6, 6], [10.2, "block", 0, 10, 6],
  [11.4, "dodge", 0, 6, 2], [12.6, "hit", 0, 10, 2],
  [13.2, "block", 0, 6, 6], [13.8, "hit", 1, 6, 2],
  [15, "clash", 0, 10, 10], [16.2, "block", 1, 6, 6],
  [17.4, "block", 0, 6, 6],
].map(([t, kind, actor, limb, target]) => ({t, kind, actor, limb, target}));
// Cues are in film time. The climax hit lands when time resumes after the orbit;
// the freeze itself is marked by a low thump and a riser under the held frame.
export const battleCues = () => BATTLE_BEATS.flatMap(e => {
  const climax = e.t === FREEZE.story;
  return [
    {t:filmTime(e.t-.18), name:"whoosh", gain:e.kind === "dodge" ? .8 : .5},
    ...(climax ? [{t:FREEZE.film, name:"thump", gain:.5}, {t:FREEZE.film+.15, name:"riser", gain:.45}] : []),
    ...(e.kind === "dodge" ? [] : [{t:climax ? FREEZE.film + FREEZE.duration : filmTime(e.t), name:e.kind === "block" ? "thump" : "impact", gain:e.kind === "block" ? .45 : climax ? .8 : .65}]),
  ];
}).filter(c => c.t >= 0); // the cold open starts on the first contact, after its wind-up

const mix=(a,b,t)=>a+(b-a)*t;
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>x*x*(3-2*x);
export function createChoreography() {
  // Every pose is authored in joint-space: hip, shoulder, head, rear elbow/hand,
  // front elbow/hand, rear knee/ankle, front knee/ankle. No motion-capture asset.
  const P = {
    guard: [
      0, 412, 12, 294, 12, 236, 24, 376, 48, 292, 66, 340, 110, 276, -46, 504,
      -92, 602, 68, 502, 113, 602,
    ],
    load: [
      -26, 428, -38, 314, -36, 255, -112, 382, -38, 350, 24, 356, 68, 312, -68,
      515, -121, 602, 52, 516, 109, 602,
    ],
    jab: [
      36, 418, 90, 304, 108, 249, 68, 396, 108, 322, 169, 286, 248, 278, -17,
      508, -123, 602, 117, 512, 154, 602,
    ],
    recoil: [
      35, 441, -32, 328, -71, 279, -112, 394, -36, 362, 9, 366, 60, 333, -39,
      515, -78, 602, 102, 530, 155, 602,
    ],
    block: [
      -3, 442, -12, 320, -14, 264, 48, 356, 74, 268, 63, 347, 85, 271, -65, 512,
      -111, 602, 58, 528, 104, 602,
    ],
    duck: [
      -13, 494, 69, 427, 123, 394, -29, 468, 36, 428, 101, 459, 153, 421, -78,
      543, -129, 602, 76, 546, 143, 602,
    ],
    kickload: [
      -10, 437, -45, 322, -52, 269, -118, 386, -46, 358, 15, 339, 75, 304, -56,
      513, -75, 602, 67, 429, 43, 491,
    ],
    kick: [
      30, 410, -74, 314, -98, 270, -148, 376, -68, 378, 3, 333, 62, 305, -48,
      500, -63, 602, 94, 352, 232, 290,
    ],
    sweep: [
      -25, 522, -91, 454, -105, 404, -148, 514, -177, 585, -38, 473, 27, 454,
      -82, 559, -115, 603, 91, 554, 225, 602,
    ],
    jump: [
      8, 317, 34, 221, 54, 167, -56, 278, 26, 258, 101, 256, 148, 190, -34, 410,
      -104, 416, 103, 354, 143, 442,
    ],
    fly: [
      10, 334, -75, 237, -98, 190, -148, 298, -185, 256, -22, 264, 33, 190,
      -67, 411, -146, 475, 94, 330, 236, 279,
    ],
    fall: [
      16, 400, -73, 338, -119, 307, -138, 396, -188, 348, -25, 332, -49, 258,
      62, 482, 146, 519, -40, 494, -55, 583,
    ],
    upperload: [
      -25, 482, -6, 374, 22, 322, -82, 434, -18, 396, 53, 437, 98, 410, -74,
      532, -131, 602, 59, 540, 131, 602,
    ],
    upper: [
      38, 406, 68, 285, 48, 231, 32, 372, 77, 342, 125, 360, 185, 250, -30, 508,
      -113, 602, 112, 497, 119, 602,
    ],
    land: [
      8, 495, 73, 393, 91, 342, -8, 466, 62, 432, 116, 461, 177, 499, -74, 548,
      -137, 602, 99, 542, 162, 602,
    ],
    finish: [
      0, 408, 7, 290, 0, 232, -64, 368, 12, 332, 65, 334, 112, 286, -46, 504,
      -88, 602, 56, 504, 94, 602,
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
    [8.4, "guard", 400],
    [9.1, "kickload", 380],
    [9.6, "kickload", 340],
    [10.2, "fly", 451],
    [10.3, "fly", 451],
    [10.65, "land", 457],
    [11.1, "load", 422],
    [11.4, "jab", 480],
    [11.49, "jab", 480],
    // The climax repeats the 3.0 s kick, a pose the volumetric fighters also hold.
    [12, "kickload", 400],
    [12.32, "kickload", 412],
    [12.6, "kick", 454],
    [12.69, "kick", 454],
    [12.96, "guard", 440],
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
    [1.14, "guard", 760],
    [1.5, "load", 690],
    [1.8, "jab", 570],
    [1.9, "jab", 570],
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
    [7.8, "block", 775],
    [8.4, "guard", 850],
    [9.1, "block", 850],
    [9.6, "guard", 867],
    [10.2, "block", 799],
    [10.3, "block", 799],
    [10.7, "recoil", 833],
    [11.1, "load", 861],
    [11.4, "duck", 820],
    [11.5, "duck", 820],
    [12, "guard", 808],
    [12.6, "recoil", 655],
    [12.72, "fall", 685],
    [12.98, "guard", 820],
    [13.2, "block", 811],
    [13.29, "block", 811],
    [13.55, "load", 730],
    [13.8, "jab", 630],
    [14.2, "load", 870],
    [14.7, "kickload", 845],
    [15, "kick", 918],
    [15.1, "kick", 918],
    [15.65, "guard", 837],
    [16.2, "jab", 763],
    [16.29, "jab", 763],
    [16.8, "load", 846],
    [17.4, "block", 814],
    [17.52, "block", 814],
    [18, "finish", 882],
    [19.2, "finish", 882],
  ];
  // Solve a two-link limb, choosing the bend nearest the authored silhouette.
  function solve(root, end, hint, upper, lower) {
    let dx=end[0]-root[0], dy=end[1]-root[1], dist=Math.hypot(dx,dy);
    const reach=Math.max(Math.abs(upper-lower)+.01, Math.min(upper+lower-.01,dist));
    const ux=dx/(dist||1), uy=dy/(dist||1);
    end=[root[0]+ux*reach,root[1]+uy*reach];
    const along=(upper*upper-lower*lower+reach*reach)/(2*reach);
    const bend=Math.sqrt(Math.max(0,upper*upper-along*along));
    const a=[root[0]+ux*along-uy*bend,root[1]+uy*along+ux*bend];
    const b=[root[0]+ux*along+uy*bend,root[1]+uy*along-ux*bend];
    const near=q=>Math.hypot(q[0]-hint[0],q[1]-hint[1]);
    return {joint:near(a)<near(b)?a:b,end};
  }
  function state(track, t) {
    let k=0;
    while(k<track.length-2 && t>=track[k+1][0]) k++;
    const a=track[k],b=track[k+1],u=clamp((t-a[0])/(b[0]-a[0])),v=ease(u);
    const x=mix(a[2],b[2],v),p=P[a[1]].map((n,i)=>mix(n,P[b[1]][i],v));
    // Front foot lands first; trailing foot follows. Grounded feet travel through
    // an arc, rather than skating along the floor with the pelvis.
    for(const foot of [8,10]) {
      const i=foot*2;
      if(P[a[1]][i+1]>590 && P[b[1]][i+1]>590) {
        const face=track===B?-1:1;
        const ax=a[2]+face*P[a[1]][i],bx=b[2]+face*P[b[1]][i],travel=Math.abs(bx-ax);
        if(travel>14) {
          const step=foot===10?clamp(u/.65):clamp((u-.3)/.7);
          p[i]=face*(mix(ax,bx,ease(step))-x);
          p[i+1]=602-Math.sin(step*Math.PI)*Math.min(54,travel*.3);
        }
      }
    }
    const limb=(base,joint,end,up,low)=>{
      const r=solve(base,p.slice(end*2,end*2+2),p.slice(joint*2,joint*2+2),up,low);
      p.splice(joint*2,2,...r.joint);p.splice(end*2,2,...r.end);
    };
    limb([p[2]-18,p[3]+10],3,4,85,85);
    limb([p[2]+17,p[3]+10],5,6,85,85);
    limb([p[0]-13,p[1]],7,8,105,117);
    limb([p[0]+13,p[1]],9,10,105,117);
    return {p,x};
  }
  const world=(st,id,index)=>[st.x+(id?-1:1)*st.p[index*2],st.p[index*2+1]];
  function contact(e) {
    const attacker=state(e.actor?B:A,e.t),defender=state(e.actor?A:B,e.t);
    const from=world(attacker,e.actor,e.limb),to=world(defender,1-e.actor,e.target);
    return {...e,from,to,point:from.map((n,i)=>(n+to[i])/2),distance:Math.hypot(from[0]-to[0],from[1]-to[1])};
  }
  const events=BATTLE_BEATS.map(contact);

  const sourceTime=t=>t>=7.8 && t<8.4?7.8:t>=8.4 && t<9.6?7.8+(t-8.4)*1.5:t;
  return {pose:(id,t)=>state(id?B:A,Math.max(0,Math.min(19.2,t))),events,sourceTime};
}

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
  const {pose,events,sourceTime}=createChoreography();
  const impactAt=t=>events.find(e=>e.kind!=="dodge" && t>=e.t && t<e.t+.2);
  function poly(points, color) {
    g.fillStyle = color;
    g.beginPath();
    points.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p)));
    g.closePath();
    g.fill();
  }
  function segPoly(a, b, r0f, r0b, rmf, rmb, r1f, r1b, color, midT = 0.38) {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy) || 1;
    const ux = dx / len,
      uy = dy / len,
      nx = -uy,
      ny = ux;
    const at = (u, rf, rb) => [
      [a[0] + ux * len * u + nx * rf, a[1] + uy * len * u + ny * rf],
      [a[0] + ux * len * u - nx * rb, a[1] + uy * len * u - ny * rb],
    ];
    const [p0f, p0b] = at(0, r0f, r0b);
    const [p1f, p1b] = at(midT * 0.5, (r0f + rmf) * 0.52, (r0b + rmb) * 0.52);
    const [pmf, pmb] = at(midT, rmf, rmb);
    const [p2f, p2b] = at(mix(midT, 1, 0.55), (rmf + r1f) * 0.52, (rmb + r1b) * 0.5);
    const [p3f, p3b] = at(1, r1f, r1b);
    const capA = [a[0] - ux * (r0f + r0b) * 0.38, a[1] - uy * (r0f + r0b) * 0.38];
    const capB = [b[0] + ux * (r1f + r1b) * 0.38, b[1] + uy * (r1f + r1b) * 0.38];
    poly([capA, p0f, p1f, pmf, p2f, p3f, capB, p3b, p2b, pmb, p1b, p0b], color);
  }
  function boot(ankle, knee, mainCol, soleCol) {
    const dx = ankle[0] - knee[0],
      dy = ankle[1] - knee[1],
      ang = clamp((Math.atan2(dx, Math.max(20, dy)) ) * 0.35);
    g.save();
    g.translate(ankle[0], ankle[1]);
    g.rotate(-ang * 0.35);
    poly(
      [
        [-11, -12],
        [10, -12],
        [14, -2],
        [30, 3],
        [32, 9],
        [-14, 9],
        [-15, 0],
      ],
      mainCol,
    );
    poly(
      [
        [-14, 6],
        [32, 6],
        [31, 10],
        [-14, 10],
      ],
      soleCol,
    );
    g.restore();
  }
  function glove(hand, elbow, mainCol, trimCol) {
    const dx = hand[0] - elbow[0],
      dy = hand[1] - elbow[1],
      ang = Math.atan2(dy, dx);
    g.save();
    g.translate(hand[0], hand[1]);
    g.rotate(ang);
    poly(
      [
        [-12, -8],
        [-3, -9],
        [-3, 9],
        [-12, 8],
      ],
      trimCol,
    );
    g.fillStyle = mainCol;
    g.beginPath();
    g.ellipse(4, 0, 13, 10.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = trimCol;
    g.beginPath();
    g.ellipse(6, -3.5, 7, 3.2, 0.15, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  function fighter(st, face, id, t, override, cutout = false) {
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
    const ink = override || "#102331",
      cloth = override || (id ? "#1f8796" : "#ea683c"),
      light = override || (id ? "#7ce2e6" : "#ffc085"),
      darkSuit = override || (id ? "#164e5b" : "#9c3922"),
      visor = override || "#fff8ea";
    g.save();
    g.translate(st.x, 0);
    g.scale(face, 1);

    // 1. Rear leg & rear arm (athletic quad/calf taper + martial-arts boot & glove)
    const rHip = [hip[0] - 13, hip[1]];
    segPoly(rHip, rearK, 19, 17, 20, 17, 13, 12, ink, 0.4);
    segPoly(rearK, rearF, 12.5, 13, 12, 15.5, 8.5, 8.5, darkSuit, 0.32);
    boot(rearF, rearK, ink, light);

    const rSh = [sh[0] - 18, sh[1] + 10];
    segPoly(rSh, rearE, 13, 12, 12.5, 11.5, 9.5, 9, ink, 0.42);
    segPoly(rearE, rearH, 9.5, 9.5, 10, 9.5, 7, 7, darkSuit, 0.32);
    glove(rearH, rearE, ink, light);

    // 2. Torso: athletic pelvis, narrow waist, broad V-tapered chest & ribcage
    const sdx = sh[0] - hip[0],
      sdy = sh[1] - hip[1],
      slen = Math.hypot(sdx, sdy) || 1;
    const ux = sdx / slen,
      uy = sdy / slen,
      fx = -uy,
      fy = ux;
    const torsoPt = (u, fOff) => [
      hip[0] + ux * slen * u + fx * fOff,
      hip[1] + uy * slen * u + fy * fOff,
    ];
    // Pelvis / compression shorts base
    poly(
      [
        torsoPt(-0.1, -18),
        torsoPt(-0.1, 19),
        torsoPt(0.22, 16),
        torsoPt(0.22, -15),
      ],
      ink,
    );
    // Broad V-tapered upper torso (waist 31px -> chest/lats 50px -> collar 28px)
    poly(
      [
        torsoPt(0.2, -15),
        torsoPt(0.2, 16),
        torsoPt(0.55, 25),
        torsoPt(0.82, 27),
        torsoPt(1.03, 15),
        torsoPt(1.03, -15),
        torsoPt(0.78, -23),
        torsoPt(0.48, -19),
      ],
      cloth,
    );
    // Sculpted chest / sternum armor panel for high-contrast halftone read
    poly(
      [
        torsoPt(0.32, 4),
        torsoPt(0.32, 17),
        torsoPt(0.8, 26),
        torsoPt(0.96, 13),
        torsoPt(0.84, -4),
        torsoPt(0.54, 1),
      ],
      light,
    );
    // Crisp martial-arts waist belt (no protruding tail/sash)
    poly(
      [
        torsoPt(0.14, -17.5),
        torsoPt(0.14, 18.5),
        torsoPt(0.25, 17.5),
        torsoPt(0.25, -16.5),
      ],
      ink,
    );
    poly(
      [
        torsoPt(0.155, 6),
        torsoPt(0.155, 18.5),
        torsoPt(0.235, 18),
        torsoPt(0.235, 6),
      ],
      light,
    );

    // 3. Front leg (quad sweep, knee cap, sculpted shin guard & crisp boot)
    const fHip = [hip[0] + 13, hip[1]];
    segPoly(fHip, frontK, 21, 18, 22, 18.5, 13.5, 12.5, cloth, 0.4);
    segPoly(frontK, frontF, 13, 13.5, 13, 16.5, 9, 9, cloth, 0.32);
    // Shin-guard front plate + knee pad
    segPoly(
      [mix(frontK[0], frontF[0], 0.06), mix(frontK[1], frontF[1], 0.06)],
      [mix(frontK[0], frontF[0], 0.82), mix(frontK[1], frontF[1], 0.82)],
      8,
      -2,
      8.5,
      -2,
      6.5,
      -1,
      light,
      0.4,
    );
    g.fillStyle = ink;
    g.beginPath();
    g.arc(frontK[0] + 2, frontK[1], 10.5, 0, Math.PI * 2);
    g.fill();
    boot(frontF, frontK, ink, light);

    // 4. Neck & sleek cyber-martial-artist helmet (1:7.5 human head-to-height ratio)
    const neckBase = torsoPt(1.0, 1);
    const headCtr = [head[0] + 2, head[1] + 5];
    segPoly(neckBase, [headCtr[0] - 2, headCtr[1] + 10], 8.5, 8.5, 8, 8, 7.5, 7.5, ink, 0.5);
    // Collar ring
    poly(
      [
        torsoPt(0.96, -13),
        torsoPt(0.96, 15),
        torsoPt(1.06, 13),
        torsoPt(1.06, -11),
      ],
      ink,
    );
    // Rounded human helmet shell ( ~48px tall for ~365px standing figure )
    const hx = headCtr[0],
      hy = headCtr[1];
    g.fillStyle = ink;
    g.beginPath();
    g.ellipse(hx, hy - 1, 21.5, 24, -0.06, 0, Math.PI * 2);
    g.fill();
    // Clean human jawline / chin guard (no snout!)
    poly(
      [
        [hx + 6, hy - 6],
        [hx + 22, hy + 2],
        [hx + 19, hy + 15],
        [hx + 9, hy + 23],
        [hx - 7, hy + 18],
        [hx - 12, hy + 6],
      ],
      ink,
    );
    // Subtle crown trim differentiating the two strikers (zero spikes or tails)
    if (id) {
      g.strokeStyle = light;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(hx - 1, hy - 2, 20, -Math.PI * 0.82, -Math.PI * 0.18);
      g.stroke();
      g.fillStyle = cloth;
      g.beginPath();
      g.arc(hx - 4, hy + 2, 6.5, 0, Math.PI * 2);
      g.fill();
    } else {
      poly(
        [
          [hx - 17, hy - 17],
          [hx - 3, hy - 27],
          [hx + 14, hy - 22],
          [hx + 18, hy - 14],
          [hx - 12, hy - 12],
        ],
        cloth,
      );
    }
    // Glowing wrap-around visor slit + negative-space notch on solid-ink shots
    poly(
      [
        [hx + 1, hy - 6],
        [hx + 22.5, hy - 4],
        [hx + 21.5, hy + 3.5],
        [hx + 3, hy + 2.5],
      ],
      visor,
    );
    if (cutout) {
      g.save();
      g.globalCompositeOperation = "destination-out";
      poly(
        [
          [hx + 4, hy - 4.5],
          [hx + 22.5, hy - 3],
          [hx + 22, hy + 1.2],
          [hx + 5, hy + 0.5],
        ],
        "#000",
      );
      g.restore();
    }

    // 5. Sculpted front deltoid cap, tapered front arm, forearm bracer & striking glove
    const fSh = [sh[0] + 17, sh[1] + 10];
    g.fillStyle = cloth;
    g.beginPath();
    g.ellipse(fSh[0] - 2, fSh[1] - 1, 15.5, 14, -0.2, 0, Math.PI * 2);
    g.fill();
    segPoly(fSh, frontE, 14, 13, 13.5, 12, 10, 9.5, cloth, 0.42);
    segPoly(frontE, frontH, 10.5, 10, 11, 10, 7.5, 7.5, cloth, 0.32);
    // Forearm bracer accent
    segPoly(
      [mix(frontE[0], frontH[0], 0.25), mix(frontE[1], frontH[1], 0.25)],
      [mix(frontE[0], frontH[0], 0.82), mix(frontE[1], frontH[1], 0.82)],
      9.5,
      8.5,
      9,
      8,
      7.5,
      7,
      light,
      0.45,
    );
    glove(frontH, frontE, ink, light);
    g.restore();
  }
  const shots = [
    // Cream shots use darker, larger dots so the figures hold contrast against the paper.
    {at:0,end:2.4,z:1.06,y:386,bg:"#efe7d2",ink:"#0d1e2c",step:5,heavy:true},
    {at:2.4,end:4.8,z:1.14,y:365,bg:"#f06c40",ink:"#122c39",step:5},
    {at:4.8,end:7.8,z:1.03,y:389,bg:"#122638",ink:null,step:4},
    {at:7.8,end:8.4,z:1.28,y:346,bg:"#efe7d2",ink:"#0d1e2c",step:4,heavy:true},
    {at:8.4,end:9.6,z:1.05,y:384,bg:"#efe7d2",ink:"#0d1e2c",step:5,heavy:true},
    {at:9.6,end:12,z:1.09,y:362,bg:"#eecb52",ink:"#172e3e",step:5},
    {at:12,end:14.4,z:1.13,y:368,bg:"#122638",ink:null,step:4},
    {at:14.4,end:17.4,z:1.06,y:360,bg:"#efe7d2",ink:"#0d1e2c",step:5,heavy:true},
    {at:17.4,end:19.2,z:1.14,y:375,bg:"#f06c40",ink:"#122c39",step:4},
  ];
  const shotAt=t=>shots.find(s=>t<s.end)||shots.at(-1);
  function camera(t) {
    const shot=shotAt(t),u=clamp((t-shot.at)/(shot.end-shot.at));
    let z=shot.z+.025*u,x=640,y=shot.y,rot=.012*Math.sin(u*Math.PI);
    if(t>=7.8 && t<8.4) {z+=.12*u;rot=-.025+.05*u;x+=35*u;}
    const hit=impactAt(t);
    if(hit) {const age=t-hit.t,e=Math.exp(-age*22);x+=Math.sin(age*90)*7*e;y+=Math.sin(age*75)*4*e;}
    return {z,x,y,rot};
  }
  function project(point,t) {
    const cam=camera(t),x=(point[0]-cam.x)*cam.z,y=(point[1]-cam.y)*cam.z;
    return [640+x*Math.cos(cam.rot)-y*Math.sin(cam.rot),360+x*Math.sin(cam.rot)+y*Math.cos(cam.rot)];
  }
  function source(t,ghost=0,outputTime=t,cutout=false) {
    g.clearRect(0,0,W,H);
    const cam=camera(outputTime),poseTime=Math.max(0,t-ghost);
    g.save();g.translate(W/2,H/2);g.rotate(cam.rot);g.scale(cam.z,cam.z);g.translate(-cam.x,-cam.y);
    fighter(pose(0,poseTime),1,0,poseTime,undefined,cutout);fighter(pose(1,poseTime),-1,1,poseTime,undefined,cutout);g.restore();
    return g.getImageData(0,0,W,H).data;
  }
  function dots(data,t,spacing,solid,alpha=1,heavy=false) {
    ctx.globalAlpha=alpha;
    const event=impactAt(t),age=event?t-event.t:0;
    const burst=event?Math.sin(clamp(age/.2)*Math.PI):0;
    const point=event?project(event.point,t):[0,0];
    for(let y=2;y<H;y+=spacing) for(let x=2;x<W;x+=spacing) {
      const k=(y*W+x)*4;if(data[k+3]<100)continue;
      const lum=(data[k]*.299+data[k+1]*.587+data[k+2]*.114)/255;
      let r=spacing*(heavy?.36+.17*(1-lum):solid?.30+.18*(1-lum):.43),px=x,py=y;
      const near=Math.max(0,1-Math.hypot(x-point[0],y-point[1])/90),kick=burst*near;
      px+=Math.sin(k)*kick*17;py+=Math.cos(k)*kick*12;
      ctx.fillStyle=solid||`rgb(${Math.max(70,data[k])},${Math.max(94,data[k+1])},${Math.max(115,data[k+2])})`;
      ctx.beginPath();ctx.ellipse(px,py,r,r*(1-kick*.3),0,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  function drawStory(t) {
    t=Math.max(0,Math.min(STORY_DURATION,t));
    const shot=shotAt(t),motionTime=sourceTime(t),poses=[pose(0,motionTime),pose(1,motionTime)];
    const closing=clamp((t-18)/.55);
    ctx.fillStyle=shot.bg;ctx.fillRect(0,0,W,H);
    // Ground contact and jump height remain legible even when the ink changes.
    ctx.fillStyle=shot.ink||"#c0d7de";
    for(let id=0;id<2;id++) {
      const q=project([poses[id].x,606],t);
      ctx.globalAlpha=.12*(1-closing);ctx.beginPath();ctx.ellipse(q[0],q[1],100,9,0,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    // Echoes belong to fast attacks, not every idle breath or held pose.
    const trail=events.some(e=>t>e.t-.18 && t<e.t+.045) && !(t>=7.8&&t<8.4);
    if(trail) for(let n=3;n>0;n--) dots(source(motionTime,n*.055,t,true),t,shot.step,["#ea9576","#61a5b5","#a4b4b0"][n-1],.17+(3-n)*.06);
    dots(source(motionTime,0,t,!!shot.ink),t,shot.step,shot.ink,1-closing*.85,shot.heavy);
    const event=impactAt(t);
    if(event) {
      const u=clamp((t-event.t)/.16),[x,y]=project(event.point,t);
      ctx.strokeStyle=shot.ink||"#f5d6a3";ctx.globalAlpha=(1-u)*.85;ctx.lineWidth=2*(1-u);
      for(let n=0;n<10;n++) {const a=n/10*Math.PI*2,r=14+u*44;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);ctx.lineTo(x+Math.cos(a)*(r+12),y+Math.sin(a)*(r+12));ctx.stroke();}
      ctx.globalAlpha=1;
    }
    ctx.fillStyle=shot.ink||"#d9e7e7";ctx.font="600 14px Arial";ctx.textAlign="left";ctx.fillText("COUNTERFORM",44,40);
    ctx.textAlign="right";ctx.font="12px Arial";ctx.fillText("ORIGINAL CHOREOGRAPHY",1236,40);ctx.textAlign="left";
    if(t>=18) {
      ctx.globalAlpha=closing;ctx.fillStyle="#142b3a";ctx.textAlign="center";
      ctx.font="900 94px Arial";ctx.fillText("COUNTERFORM",640,340+(1-closing)*24);
      ctx.font="18px Arial";ctx.letterSpacing="6px";ctx.fillText("A FIGHT IN DOTS",640,386+(1-closing)*24);
      ctx.letterSpacing="0px";ctx.textAlign="left";ctx.globalAlpha=1;
    }
    lastProof={t,sourceTime:motionTime,poses,spacing:shot.step,camera:camera(t),contacts:events,activeImpact:event?.t??null,dimension:"2D illustration",hold:t>=7.8&&t<8.4};
  }

  // The climax insert: the volumetric fighters held at the same kick, as a 3D dot
  // cloud, while the camera makes one full turn and returns to the film's view.
  let orbitWork;
  const orbit = () => (orbitWork ||= import("../signals/orbit.js").then((m) => m.createOrbit()).catch((error) => { orbitWork = undefined; throw error; }));
  async function freezeFrame(u) {
    const o = await orbit(), k = clamp(u / FREEZE.duration), e = k * k * (3 - 2 * k);
    // 2.3 s on the orbit study's clock is inside its held, dot-cloud look; 5.2 s of
    // its score is silent, so the measured-audio bars and scatter stay at rest.
    o.frame(2.3, { sourceTime: FREEZE.pose, cameraAngle: Math.PI * 2 * e, lightTime: 1 + u, audioTime: 5.2, labels: false });
    ctx.drawImage(o.canvas, 0, 0, W, H);
    ctx.fillStyle = "#123b33"; ctx.font = "600 14px Arial"; ctx.textAlign = "left"; ctx.fillText("COUNTERFORM", 44, 40);
    ctx.textAlign = "right"; ctx.font = "12px Arial"; ctx.fillText("HELD · " + Math.round(e * 360) + "°", 1236, 40); ctx.textAlign = "left";
    const p = o.proof();
    lastProof = { t: FREEZE.story, sourceTime: FREEZE.story, poses: [pose(0, FREEZE.story), pose(1, FREEZE.story)], contacts: events, activeImpact: null, dimension: "3D freeze-orbit insert", hold: true, orbit: { camera: p.camera, sourcePose: p.sourcePose, held: p.held, glbTime: FREEZE.pose } };
  }
  async function frame(f) {
    if(!Number.isFinite(f))throw new Error("Frame time must be finite");
    f=Math.max(0,Math.min(BATTLE_DURATION,f));
    const freeze=f>=FREEZE.film&&f<FREEZE.film+FREEZE.duration;
    if(freeze) await freezeFrame(f-FREEZE.film); else drawStory(storyTime(f));
    lastProof={...lastProof,filmTime:f,storyTime:storyTime(f),freeze};
  }
  return {
    canvas: c,
    duration: BATTLE_DURATION,
    frame: async (t) => frame(t),
    proof: () => lastProof,
  };
}
