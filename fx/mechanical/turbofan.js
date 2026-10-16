// Detailed turbofan geometry adapted from AirsupHQ/machine-skill (MIT); see NOTICE.
import {THREE,GEO,MAT,clamp,lerp} from './vendor.js';
import {heatGlow,closedLathe} from './geometry.js';
export function createTurbofan(){
const CL=2.05;
const root=new THREE.Group(),parts=[];
const lab={add(obj,o={}){(o.parent||root).add(obj);parts.push({obj,name:o.name,base:obj.position.clone(),off:new THREE.Vector3(...(o.explode||[0,0,0])),count:o.count});return obj;}};
// engine frame: axis along local +Y, intake lip at y = Y(0), s = metres aft of the lip
const eng = new THREE.Group()
eng.rotation.z = -Math.PI / 2           // local +Y (forward) -> world +X
eng.position.set(0.25, CL, 0)
lab.add(eng, { name: 'Engine', count: 0 })
const LIP = 2.45
const Y = (s) => LIP - s
const P = (pts) => pts.map(([r, s]) => [r, Y(s)])

// ------------------------------------------------------------------ materials
const paintNacelle = MAT.paint({ color: [0.78, 0.78, 0.77], roughness: 0.3, clearcoat: 0.8 })
const lipAl = MAT.aluminiumMachined({ roughness: 0.16 })
const fanTi = MAT.titanium({ roughness: 0.2, color: [0.6, 0.57, 0.53] })
const casing = MAT.steelDark({ color: [0.3, 0.3, 0.31], roughness: 0.46 })
const cowl = MAT.aluminium({ color: [0.62, 0.63, 0.64], roughness: 0.36 })
const compTi = MAT.titanium({ roughness: 0.26 })
const compNi = MAT.steel({ color: [0.6, 0.58, 0.55], roughness: 0.3 })
const vaneSteel = MAT.stainless({ roughness: 0.3 })
const drum = MAT.steel({ roughness: 0.24 })
const hptTBC = heatGlow(MAT.ceramic({ color: [0.86, 0.78, 0.6], roughness: 0.45 }), 900)
const lptNi = heatGlow(MAT.inconel({ roughness: 0.38 }), 700)
const liner = heatGlow(MAT.inconel({ color: [0.52, 0.47, 0.42], roughness: 0.5 }), 900)
const plugM = heatGlow(MAT.inconel({ color: [0.5, 0.46, 0.42], roughness: 0.34 }), 700)
const standPaint = MAT.paint({ color: [0.07, 0.075, 0.08], roughness: 0.5, clearcoat: 0.3 })
const pinSteel = MAT.chrome({ roughness: 0.12 })
const rubber = MAT.rubber()

// spinner with the white spiral every big fan has (ground crews see at a glance that it turns)
const spiralTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d')
  g.fillStyle = '#1a1b1d'; g.fillRect(0, 0, 512, 512)
  g.strokeStyle = '#f2f1ed'; g.lineWidth = 46
  for (const o of [-512, 0, 512]) { g.beginPath(); g.moveTo(o, 512); g.bezierCurveTo(o + 120, 330, o + 300, 120, o + 512, 0); g.stroke() }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t
})()
const spinnerM = MAT.paint({ color: [1, 1, 1], map: spiralTex, roughness: 0.25, clearcoat: 1, finish: null })

// ------------------------------------------------------------------ flowpath (radii in m against s)
const nacOuter = [[1.5, 0], [1.575, 0.035], [1.635, 0.12], [1.685, 0.3], [1.715, 0.62], [1.722, 1.0], [1.70, 1.6], [1.66, 2.1], [1.585, 2.6], [1.49, 3.06]]
const nacInner = [[1.468, 3.08], [1.452, 2.6], [1.462, 2.0], [1.465, 1.45], [1.458, 1.05], [1.452, 0.82], [1.432, 0.5], [1.402, 0.22], [1.412, 0.09], [1.452, 0.02]]
const cowlOut = [[0.6, 1.04], [0.69, 1.2], [0.8, 1.6], [0.86, 2.2], [0.85, 2.9], [0.8, 3.55], [0.73, 3.95], [0.585, 4.16]]
const cowlIn = [[0.563, 4.13], [0.69, 3.97], [0.67, 3.6], [0.52, 3.25], [0.485, 3.2], [0.485, 2.99], [0.53, 2.95], [0.53, 2.6], [0.445, 2.56], [0.445, 1.66], [0.47, 1.6], [0.575, 1.5], [0.585, 1.12], [0.596, 1.06]]
const tipCore = (s) => s < 1.5 ? lerp(0.585, 0.565, (s - 1.1) / 0.4) : s < 1.66 ? lerp(0.565, 0.44, (s - 1.5) / 0.16) : s < 2.56 ? lerp(0.44, 0.435, (s - 1.66) / 0.9) : s < 3.22 ? 0.48 : lerp(0.5, 0.685, (s - 3.25) / 0.72)
const hubCore = (s) => s < 1.5 ? lerp(0.42, 0.43, (s - 1.1) / 0.4) : s < 1.66 ? lerp(0.43, 0.3, (s - 1.5) / 0.16) : s < 2.56 ? lerp(0.3, 0.385, (s - 1.66) / 0.9) : s < 3.22 ? 0.385 : lerp(0.39, 0.42, (s - 3.25) / 0.72)

// ------------------------------------------------------------------ static structure
const interpOuter = (sx) => { for (let i = 1; i < nacOuter.length; i++) if (sx <= nacOuter[i][1]) return lerp(nacOuter[i - 1][0], nacOuter[i][0], (sx - nacOuter[i - 1][1]) / (nacOuter[i][1] - nacOuter[i - 1][1])); return nacOuter[nacOuter.length - 1][0] }
const shells=[];
function shellPair(profile,material,name){
 for(const sign of [1,-1]){
  const obj=new THREE.Mesh(closedLathe(P(profile),128,sign>0?-Math.PI/2:Math.PI/2,Math.PI),material.clone());
  lab.add(obj,{name:name+(sign>0?' / near':' / far'),parent:eng,explode:[0,0,sign*(name==='Nacelle'?2.35:1.35)]});
  obj.userData.shell={profile:P(profile),sign,name};shells.push(obj);
 }
}
shellPair([...nacOuter,...nacInner],paintNacelle,'Nacelle');
shellPair([...cowlOut,...cowlIn],cowl,'Core cowl');
// Raised machined intake and exhaust lips are closed partial solids, with the shell they belong to.
for(const shell of shells){
 if(shell.userData.shell.name!=='Nacelle')continue;
 const sign=shell.userData.shell.sign,phi=sign>0?-Math.PI/2:Math.PI/2;
 const lip=new THREE.Mesh(closedLathe(P([[1.452,.02],[1.5,-.003],[1.578,.034],[1.64,.13],[1.672,.24],[1.66,.25],[1.62,.15],[1.565,.06],[1.505,.03],[1.46,.045]]),128,phi,Math.PI),lipAl.clone());shell.add(lip);lip.userData.shell={profile:P([[1.452,.02],[1.5,-.003],[1.578,.034],[1.64,.13],[1.672,.24],[1.66,.25],[1.62,.15],[1.565,.06],[1.505,.03],[1.46,.045]]),sign,name:'Lip'};
 for(const sx of [.74,1.95]){const r=interpOuter(sx),seam=new THREE.Mesh(closedLathe(P([[r-.006,sx-.006],[r+.002,sx-.006],[r+.002,sx+.006],[r-.006,sx+.006]]),128,phi,Math.PI),MAT.satin());shell.add(seam);}
}
// outlet guide vanes in the bypass duct, and the core frame struts
const ogv = new THREE.Mesh(GEO.rotor({ count: 46, axis: 'y', r0: 0.79, r1: 1.47, chord: 0.2, thick: 0.06, camber: 0.06, twist: 0, pitch: 0.18, nS: 6, nC: 10 }), vaneSteel)
ogv.position.y = Y(1.68)
lab.add(ogv, { name: 'Outlet guide vanes', parent: eng, explode: [0, 0, 0], count: 46 })

// stator rows: booster, HPC, turbine nozzles (they come off with the casing)
const stators = new THREE.Group()
const statorRow = (s, n, chord, mat, pitch = -0.35) => { const m = new THREE.Mesh(GEO.rotor({ count: n, axis: 'y', r0: hubCore(s) + 0.004, r1: tipCore(s) + 0.006, chord, thick: 0.08, camber: 0.08, twist: 0.1, pitch, nS: 4, nC: 7 }), mat); m.position.y = Y(s); stators.add(m); return n }
let nStat = 0
for (let i = 0; i < 3; i++) nStat += statorRow(1.24 + i * 0.12, 64, 0.05, compTi)
nStat += statorRow(1.69, 40, 0.06, compTi, -0.2) // variable inlet guide vanes
for (let i = 0; i < 10; i++) nStat += statorRow(1.79 + i * 0.083, 70 + i * 4, lerp(0.045, 0.026, i / 9), i < 5 ? compTi : compNi)
nStat += statorRow(2.99, 36, 0.06, hptTBC, -0.9)
nStat += statorRow(3.13, 40, 0.05, hptTBC, -0.9)
for (let i = 0; i < 6; i++) nStat += statorRow(3.3 + i * 0.12, 80 + i * 6, 0.05, lptNi, -0.8)
lab.add(stators, { name: 'Stator vanes', parent: eng, explode: [0, 0, 0], count: nStat })

// combustor: annular liners, dome, 22 fuel nozzles; the flame ring glows with T4
const comb = new THREE.Group()
comb.add(new THREE.Mesh(GEO.shell(P([[0.43, 2.95], [0.49, 2.86], [0.505, 2.7], [0.48, 2.62]]).reverse(), 0.008, 96), liner))
comb.add(new THREE.Mesh(GEO.shell(P([[0.37, 2.95], [0.385, 2.86], [0.39, 2.7], [0.40, 2.62]]).reverse(), 0.008, 96, false), liner))
comb.add(new THREE.Mesh(GEO.lathe(P([[0.395, 2.6], [0.485, 2.6], [0.485, 2.635], [0.395, 2.635]]), 96), liner))
const nozzleG = GEO.merge(Array.from({ length: 22 }, (_, i) => { const a = (i / 22) * Math.PI * 2; const g = GEO.lathe([[0, 0], [0.018, 0], [0.022, 0.02], [0.012, 0.08], [0.008, 0.16], [0, 0.16]], 16); g.rotateZ(Math.PI); g.translate(0.44 * Math.cos(a), Y(2.58) + 0.0, 0.44 * Math.sin(a)); return g }))
comb.add(new THREE.Mesh(nozzleG, MAT.brass({ roughness: 0.3 })))
const flameM = MAT.glow({ emissive: [1.0, 0.42, 0.12], emissiveIntensity: 0 })
const flame = new THREE.Mesh(GEO.lathe(P([[0.405, 2.64], [0.47, 2.64], [0.48, 2.78], [0.45, 2.93], [0.41, 2.93], [0.395, 2.78]]), 96), flameM)
flame.userData.noAO = true; flame.castShadow = false
comb.add(flame)
lab.add(comb, { name: 'Combustor', parent: eng, explode: [0, 0, 0], count: 26 })

// exhaust plug
const plug = new THREE.Mesh(GEO.lathe(P([[0, 3.98], [0.39, 3.98], [0.385, 4.1], [0.33, 4.4], [0.2, 4.75], [0.06, 4.98], [0, 5.02]]), 96), plugM)
lab.add(plug, { name: 'Exhaust plug', parent: eng, explode: [0, -1.1, 0] })

// ------------------------------------------------------------------ LP spool: spinner, fan, booster, shaft, LPT
const lp = new THREE.Group(); eng.add(lp)
const spinner = new THREE.Mesh(GEO.lathe(P([[0, 0.34], [0.09, 0.38], [0.2, 0.48], [0.32, 0.62], [0.41, 0.78], [0.43, 0.88], [0.43, 0.96], [0, 0.96]]), 96), spinnerM)
lab.add(spinner, { name: 'Spinner', parent: lp, explode: [0, 1.2, 0] })
const fanOpts = { axis: 'y', r0: 0.41, r1: 1.445, chord: [0.36, 0.5], thick: [0.11, 0.035], camber: [0.09, 0.03], twist: -0.62, pitch: 0.82, sweep: -0.12, nS: 18, nC: 18 }
const FAN_N = 20
const fan = new THREE.Group()
// N-1 blades use the N-blade angular pitch. Re-spacing nineteen blades over a full
// turn and adding the twentieth at zero would leave an overlapping blade pair.
const fanBlade=GEO.rotor({count:1,...fanOpts});
const fanAngles=Array.from({length:FAN_N},(_,i)=>i*Math.PI*2/FAN_N);
const fanRing = new THREE.Mesh(GEO.merge(fanAngles.slice(1).map(a=>fanBlade.clone().rotateY(a))), fanTi)
const oneBlade = new THREE.Mesh(GEO.rotor({ count: 1, ...fanOpts }), fanTi)
fan.add(fanRing, oneBlade)
fan.add(new THREE.Mesh(GEO.lathe(P([[0.12, 0.72], [0.43, 0.72], [0.43, 1.02], [0.12, 1.02]]), 96), drum))
fan.position.y = Y(0.86)
fan.children[2].position.y = -Y(0.86)
lab.add(fan, { name: 'Fan', parent: lp, explode: [0, 0.8, 0], count: FAN_N + 1 })

const booster = new THREE.Group()
booster.add(new THREE.Mesh(GEO.lathe(P([[0.2, 1.1], [0.42, 1.1], [0.432, 1.5], [0.2, 1.5]]), 96), drum))
let nBoost = 0
for (let i = 0; i < 3; i++) { const s = 1.18 + i * 0.12, n = 58; const m = new THREE.Mesh(GEO.rotor({ count: n, axis: 'y', r0: hubCore(s) - 0.004, r1: tipCore(s) - 0.004, chord: 0.055, thick: 0.07, camber: 0.07, twist: -0.4, pitch: 0.7, nS: 5, nC: 7 }), compTi); m.position.y = Y(s); booster.add(m); nBoost += n }
lab.add(booster, { name: 'Booster', parent: lp, explode: [0, 0, 0], count: nBoost + 1 })

const shaft = new THREE.Mesh(GEO.lathe(P([[0, 0.9], [0.075, 0.9], [0.075, 4.0], [0, 4.0]]), 48), MAT.steel({ roughness: 0.2 }))
lab.add(shaft, { name: 'LP shaft', parent: lp })

const lpt = new THREE.Group()
let nLpt = 0
for (let i = 0; i < 6; i++) {
  const s = 3.36 + i * 0.12, n = 110 + i * 8
  const m = new THREE.Mesh(GEO.rotor({ count: n, axis: 'y', r0: hubCore(s), r1: tipCore(s) - 0.005, chord: 0.055, thick: 0.1, camber: 0.12, twist: -0.3, pitch: -0.9, nS: 5, nC: 7 }), lptNi)
  m.position.y = Y(s); lpt.add(m); nLpt += n
  lpt.add(new THREE.Mesh(GEO.lathe(P([[0.075, s - 0.03], [0.2, s - 0.03], [0.24, s - 0.015], [hubCore(s), s - 0.03], [hubCore(s), s + 0.03], [0.24, s + 0.015], [0.2, s + 0.03], [0.075, s + 0.03]]), 96), drum))
}
lab.add(lpt, { name: 'LP turbine', parent: lp, explode: [0, 0, 0], count: nLpt + 6 })

// ------------------------------------------------------------------ HP spool: 10 stage compressor, 2 stage turbine
const hp = new THREE.Group(); eng.add(hp)
const hpc = new THREE.Group()
hpc.add(new THREE.Mesh(GEO.lathe(P([[0.14, 1.7], [0.3, 1.7], [0.385, 2.58], [0.3, 2.62], [0.2, 2.98], [0.14, 2.98]]), 128), drum))
let nHpc = 0
for (let i = 0; i < 10; i++) {
  const s = 1.74 + i * 0.083, n = 38 + i * 5
  const m = new THREE.Mesh(GEO.rotor({ count: n, axis: 'y', r0: hubCore(s), r1: tipCore(s) - 0.004, chord: lerp(0.05, 0.028, i / 9), thick: 0.06, camber: 0.07, twist: -0.35, pitch: 0.75, nS: 4, nC: 7 }), i < 5 ? compTi : compNi)
  m.position.y = Y(s); hpc.add(m); nHpc += n
}
lab.add(hpc, { name: 'HP compressor', parent: hp, count: nHpc + 1 })
const hpt = new THREE.Group()
let nHpt = 0
for (const [k, s] of [[0, 3.06], [1, 3.19]]) {
  const n = 72 + k * 4
  const m = new THREE.Mesh(GEO.rotor({ count: n, axis: 'y', r0: 0.385, r1: 0.475, chord: 0.06, thick: 0.16, camber: 0.14, twist: -0.2, pitch: -0.95, nS: 4, nC: 8 }), hptTBC)
  m.position.y = Y(s); hpt.add(m); nHpt += n
  hpt.add(new THREE.Mesh(GEO.lathe(P([[0.09, s - 0.035], [0.2, s - 0.05], [0.3, s - 0.03], [0.385, s - 0.03], [0.385, s + 0.03], [0.3, s + 0.03], [0.2, s + 0.05], [0.09, s + 0.035]]), 96), drum))
}
lab.add(hpt, { name: 'HP turbine', parent: hp, explode: [0, 0, 0], count: nHpt + 2 })

// ------------------------------------------------------------------ ground run stand
const stand = new THREE.Group()
const beam = (len, w, h) => GEO.rbox(len, h, w, 0.01)
for (const z of [-1.3, 1.3]) {
  const r = new THREE.Mesh(beam(4.6, 0.16, 0.22), standPaint); r.position.set(0.15, 0.17, z); stand.add(r)
  for (const x of [-1.9, 2.2]) { const w = new THREE.Mesh(GEO.disc(0.11, 0.07, 0.01, 32), rubber); w.rotation.x = Math.PI / 2; w.position.set(x, 0.11, z * 1.08); stand.add(w); const hub = new THREE.Mesh(GEO.disc(0.05, 0.08, 0.006, 24), pinSteel); hub.rotation.x = Math.PI / 2; hub.position.copy(w.position); stand.add(hub) }
}
for (const x of [-2.0, -0.95, 1.25, 2.3]) { const c = new THREE.Mesh(beam(0.14, 2.7, 0.18), standPaint); c.position.set(x, 0.17, 0); stand.add(c) }
// cradles: a yoke under the fan case, a yoke under the turbine case, each on two posts
const yoke = (x, R, w) => {
  const g = GEO.lathe([[R, -w / 2], [R + 0.1, -w / 2], [R + 0.1, w / 2], [R, w / 2]], 96, { phi0: Math.PI * 1.19, phiLen: Math.PI * 0.62 })
  const m = new THREE.Mesh(g, standPaint); m.rotation.z = Math.PI / 2; m.position.set(x, CL, 0); stand.add(m)
  const a = Math.PI * 0.31, h = CL - (R + 0.05) * Math.cos(a) - 0.28
  for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(GEO.rbox(0.15, h, 0.15, 0.012), standPaint); post.position.set(x, 0.28 + h / 2, sz * (R + 0.05) * Math.sin(a)); stand.add(post)
    const pin = new THREE.Mesh(GEO.disc(0.05, 0.22, 0.006, 24), pinSteel); pin.rotation.z = Math.PI / 2; pin.position.set(x, 0.28 + h - 0.06, post.position.z); stand.add(pin)
  }
}
yoke(1.25, 1.725, 0.18)
yoke(-0.95, 0.815, 0.15)
lab.add(stand, { name: 'Ground run stand', count: 24 })


return {root,eng,parts,shells,lp,hp,fanAngles,flameM,hptTBC,lptNi,liner,plugM,profiles:{nacelle:P([...nacOuter,...nacInner]),core:P([...cowlOut,...cowlIn])},counts:{fan:FAN_N,hpc:nHpc,stator:nStat,lpt:nLpt,hpt:nHpt}};
}
