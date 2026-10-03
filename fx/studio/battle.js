// Original joint-space fight choreography; no borrowed footage or motion assets.
export const BATTLE_DURATION = 19.2;
export const BATTLE_MUSIC = [
  [0, "build"],
  [2.4, "drop"],
  [7.8, "break"],
  [9.6, "final"],
  [18, "tail"],
];
export const BATTLE_GIF = [
  [0.35, 1.3],
  [2.65, 3.65],
  [6.1, 7.1],
  [10, 11],
  [14.6, 15.6],
];
export const BATTLE_POSTER = 3.04;
// One authored event list drives contact, sound and local particle displacement.
// A miss has a travelling hand/foot, but no impact sound, shake or burst.
export const BATTLE_BEATS = [
  [.6, "block", 0, 6, 6], [1.8, "hit", 1, 6, 2],
  [3, "hit", 0, 10, 2], [4.2, "dodge", 1, 10, 2],
  [5.4, "block", 0, 6, 6], [6.6, "dodge", 1, 10, 10],
  [7.8, "block", 0, 6, 6], [10.2, "block", 0, 10, 6],
  [11.4, "dodge", 0, 6, 2], [12.6, "hit", 0, 6, 2],
  [13.2, "block", 0, 6, 6], [13.8, "hit", 1, 6, 2],
  [15, "clash", 0, 10, 10], [16.2, "block", 1, 6, 6],
  [17.4, "block", 0, 6, 6],
].map(([t, kind, actor, limb, target]) => ({t, kind, actor, limb, target}));
export const battleCues = () => BATTLE_BEATS.flatMap(e => [
  {t:e.t-.18, name:"whoosh", gain:e.kind === "dodge" ? .8 : .5},
  ...(e.kind === "dodge" ? [] : [{t:e.t, name:e.kind === "block" ? "thump" : "impact", gain:e.kind === "block" ? .45 : .65}]),
]);

const mix=(a,b,t)=>a+(b-a)*t;
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>x*x*(3-2*x);
export function createChoreography() {
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
      30, 410, -74, 314, -98, 270, -120, 345, -58, 378, 3, 333, 62, 305, -48,
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
      10, 334, -75, 237, -98, 190, -145, 279, -185, 234, -22, 244, 33, 190,
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
      38, 406, 68, 285, 48, 231, 7, 325, 77, 342, 125, 360, 185, 250, -30, 508,
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
    [8.4, "guard", 400],
    [9.1, "kickload", 380],
    [9.6, "kickload", 340],
    [10.2, "fly", 451],
    [10.3, "fly", 451],
    [10.65, "land", 457],
    [11.1, "load", 422],
    [11.4, "jab", 480],
    [11.49, "jab", 480],
    [12, "upperload", 428],
    [12.6, "upper", 525],
    [12.69, "upper", 525],
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
    [12.6, "recoil", 650],
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
    if(id) {
      g.fillStyle=ink;g.beginPath();g.ellipse(head[0]-5,head[1]-17,34,27,-.2,0,Math.PI*2);g.fill();
      g.beginPath();g.arc(head[0]-32,head[1]-35,17,0,Math.PI*2);g.fill();
      poly([[head[0]-36,head[1]-34],[head[0]-69,head[1]-9],[head[0]-62,head[1]+30],[head[0]-43,head[1]+8]],ink);
    } else poly(hair, ink);
    g.strokeStyle=light;g.lineWidth=7;g.beginPath();g.moveTo(head[0]-25,head[1]-11);g.lineTo(head[0]+25,head[1]-14);g.stroke();
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
  const shots = [
    {at:0,end:2.4,z:1.06,y:386,bg:"#efe7d2",ink:"#142b3a",step:5},
    {at:2.4,end:4.8,z:1.14,y:365,bg:"#f06c40",ink:"#122c39",step:5},
    {at:4.8,end:7.8,z:1.03,y:389,bg:"#122638",ink:null,step:4},
    {at:7.8,end:8.4,z:1.28,y:346,bg:"#efe7d2",ink:"#142b3a",step:4},
    {at:8.4,end:9.6,z:1.05,y:384,bg:"#efe7d2",ink:"#142b3a",step:5},
    {at:9.6,end:12,z:1.09,y:362,bg:"#eecb52",ink:"#172e3e",step:5},
    {at:12,end:14.4,z:1.13,y:368,bg:"#122638",ink:null,step:4},
    {at:14.4,end:17.4,z:1.06,y:360,bg:"#efe7d2",ink:"#142b3a",step:5},
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
  function source(t,ghost=0,outputTime=t) {
    g.clearRect(0,0,W,H);
    const cam=camera(outputTime),poseTime=Math.max(0,t-ghost);
    g.save();g.translate(W/2,H/2);g.rotate(cam.rot);g.scale(cam.z,cam.z);g.translate(-cam.x,-cam.y);
    fighter(pose(0,poseTime),1,0,poseTime);fighter(pose(1,poseTime),-1,1,poseTime);g.restore();
    return g.getImageData(0,0,W,H).data;
  }
  function dots(data,t,spacing,solid,alpha=1) {
    ctx.globalAlpha=alpha;
    const event=impactAt(t),age=event?t-event.t:0;
    const burst=event?Math.sin(clamp(age/.2)*Math.PI):0;
    const point=event?project(event.point,t):[0,0];
    for(let y=2;y<H;y+=spacing) for(let x=2;x<W;x+=spacing) {
      const k=(y*W+x)*4;if(data[k+3]<100)continue;
      const lum=(data[k]*.299+data[k+1]*.587+data[k+2]*.114)/255;
      let r=spacing*(solid?.30+.18*(1-lum):.43),px=x,py=y;
      const near=Math.max(0,1-Math.hypot(x-point[0],y-point[1])/90),kick=burst*near;
      px+=Math.sin(k)*kick*17;py+=Math.cos(k)*kick*12;
      ctx.fillStyle=solid||`rgb(${Math.max(70,data[k])},${Math.max(94,data[k+1])},${Math.max(115,data[k+2])})`;
      ctx.beginPath();ctx.ellipse(px,py,r,r*(1-kick*.3),0,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  function frame(t) {
    if(!Number.isFinite(t))throw new Error("Frame time must be finite");
    t=Math.max(0,Math.min(BATTLE_DURATION,t));
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
    if(trail) for(let n=3;n>0;n--) dots(source(motionTime,n*.055,t),t,shot.step,["#ea9576","#61a5b5","#a4b4b0"][n-1],.17+(3-n)*.06);
    dots(source(motionTime,0,t),t,shot.step,shot.ink,1-closing*.85);
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

  return {
    canvas: c,
    duration: BATTLE_DURATION,
    frame: async (t) => frame(t),
    proof: () => lastProof,
  };
}
