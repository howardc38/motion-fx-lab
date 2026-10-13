// "The Final Final": a plush bear asks Pip for the launch video; Pip has made it more dramatic.
// The keyboard studio, both performances, the film-within-film and the cuts are functions of the
// absolute time t. Library effects with a story role are listed in EFFECTS and reported by proof().
import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createPlushBear, VISEMES, animator} from '../plush/bear.js';
import {loadPhotoSet} from '../plush/textures.js';
import {withoutFur} from '../plush/fur.js';
import {robot, poseActor, mesh, box, PIP_MOUTHS} from './actors.js';
import {clamp, smooth, lerp, env, spring, hash, mouthAt, turnFor, activeTurn, byGesture, wordTime, wordIndex} from './data.js';
import {drawCaption, label} from './captions.js';
import {drawTrailer, TRAILER, BEATS, percentAt} from './trailer.js';

const material = (c, e = {}) => new T.MeshStandardMaterial({color: c, roughness: .6, ...e});
const back = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
/** Gallery effects that play a part in the story, with the beat that uses them. */
export const EFFECTS = [
  {id: 'plush-fur', name: 'Plush fur', role: 'The bear: shell fur with fins, contact shading and fur that swings with motion.'},
  {id: 'dialogue-lipsync', name: 'Speech and lip sync', role: 'Both faces follow the analysed mouth cues; captions follow the words.'},
  {id: 'rays', name: 'Rays + bloom + dust', role: 'The hook: light bursts behind the screen as LAUNCH lands.'},
  {id: 'stamp', name: 'Flash + shake + stamp', role: 'LAUNCH slams in; later TO BE CONTINUED stamps the trailer.'},
  {id: 'count', name: 'Counting number', role: 'The trailer counts to 99% and stops.'},
  {id: 'sweep', name: 'Light sweep', role: 'Light runs along the progress bar.'},
  {id: 'glitch', name: 'RGB-split glitch', role: 'The trailer breaks up at 99%.'},
  {id: 'cardflip', name: '3D card flip', role: 'Final, final, actually final: three files flip over.'},
  {id: 'ring', name: 'Countdown ring', role: "Pip's face becomes a loading ring."},
];

function scenery(scene) {
  const dark = material('#131e30'), steel = material('#294354', {metalness: .45}), gold = material('#ab7650', {metalness: .45}), keys = [material('#294154'), material('#243547'), material('#203344')];
  box(scene, 22, .30, 17, material('#182331', {roughness: .32}), 0, -.49, 0, .12);
  box(scene, 9.8, .20, 4.3, steel, 0, -.25, .15, .14);
  for (let row = 0; row < 5; row++) for (let col = 0; col < 15; col++) {
    const x = (col - 7) * .615 + (row % 2) * .075, z = (row - 2) * .71 + .2;
    box(scene, .55, .15, .60, keys[(row + col) % 3], x, -.08, z, .055);
    if ((row + col) % 4 === 0) box(scene, .18, .003, .025, gold, x, .001, z - .12, .001);
  }
  box(scene, 3, .16, .58, keys[1], 0, -.08, 2.31, .055);
  const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 900;
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  box(scene, 11.3, 6.5, .35, dark, 0, 3.3, -4.5, .18);
  const screen = mesh(scene, new T.PlaneGeometry(10.7, 6.0), new T.MeshBasicMaterial({map: texture, toneMapped: false}), 0, 3.35, -4.31);
  box(scene, .5, 1.2, .5, steel, 0, .3, -4.45, .05);
  const bulb = material('#ffe0a5', {emissive: '#ffa345', emissiveIntensity: 3});
  for (let i = 0; i < 25; i++) { const side = i % 2 ? 1 : -1; mesh(scene, new T.SphereGeometry(.035 + (i % 4) * .01, 8, 6), bulb, side * (6.1 + (i % 3) * .27), .5 + (i % 9) * .5, -3.8 - (i % 4) * .32); }
  const lamp = new T.Group(); lamp.position.set(-4.9, 0, -1.8); scene.add(lamp);
  box(lamp, .75, .1, .65, gold, 0, 0, 0, .06); mesh(lamp, new T.CylinderGeometry(.045, .045, 3.1, 8), gold, 0, 1.6, 0);
  const shade = mesh(lamp, new T.ConeGeometry(.65, .52, 16, 1, true), gold, .25, 3.05, 0); shade.rotation.z = -.32;
  mesh(lamp, new T.SphereGeometry(.13, 12, 8), bulb, .31, 2.86, 0);
  const mug = material('#b57e58', {roughness: .35}); mesh(scene, new T.CylinderGeometry(.36, .28, .62, 16), mug, 4.7, .12, -1.2); mesh(scene, new T.TorusGeometry(.24, .065, 8, 20), mug, 5, .17, -1.2);
  // Seeded suspended dust; positions come from absolute time in frame().
  const geo = new T.BufferGeometry(), positions = new Float32Array(90 * 3);
  for (let i = 0; i < 90; i++) { positions[i * 3] = Math.sin(i * 127.1) * 7; positions[i * 3 + 1] = (Math.sin(i * 61.7) * .5 + .5) * 5; positions[i * 3 + 2] = Math.sin(i * 31.9) * 5 - 1; }
  geo.setAttribute('position', new T.BufferAttribute(positions, 3));
  const dust = new T.Points(geo, new T.PointsMaterial({color: '#e6b977', size: .018, transparent: true, opacity: .42, depthWrite: false})); scene.add(dust);
  // rays: additive light blades behind the screen (the gallery's rays technique).
  const rc = document.createElement('canvas'); rc.width = 64; rc.height = 512; const rg = rc.getContext('2d');
  const gy = rg.createLinearGradient(0, 0, 0, 512); gy.addColorStop(0, 'rgba(255,255,255,0)'); gy.addColorStop(.5, 'rgba(255,255,255,1)'); gy.addColorStop(1, 'rgba(255,255,255,0)'); rg.fillStyle = gy; rg.fillRect(0, 0, 64, 512);
  const gx = rg.createLinearGradient(0, 0, 64, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); rg.globalCompositeOperation = 'destination-out'; rg.fillStyle = gx; rg.fillRect(0, 0, 64, 512);
  const rayMat = new T.MeshBasicMaterial({map: new T.CanvasTexture(rc), transparent: true, blending: T.AdditiveBlending, depthWrite: false, color: '#ffd9a0', opacity: 0, toneMapped: false});
  const rays = new T.Group(); rays.position.set(0, 3.35, -4.7); scene.add(rays);
  for (let i = 0; i < 18; i++) { const m = new T.Mesh(new T.PlaneGeometry(.35 + hash(i) * .4, 12 + hash(i + 3) * 9), rayMat); m.rotation.z = (i / 18) * Math.PI * 2 + hash(i + 7) * .2; rays.add(m); }
  return {dust, screen, canvas, texture, rays, rayMat};
}

function fileCard(name, colour, front) {
  const c = document.createElement('canvas'); c.width = 360; c.height = 460; const g = c.getContext('2d');
  g.fillStyle = front ? '#f7f2e6' : '#22344a'; g.beginPath(); g.roundRect(0, 0, 360, 460, 28); g.fill();
  if (front) {
    g.fillStyle = colour; g.beginPath(); g.roundRect(26, 26, 308, 250, 18); g.fill();
    g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.moveTo(150, 110); g.lineTo(230, 151); g.lineTo(150, 192); g.closePath(); g.fill();
    g.fillStyle = '#1b2633'; g.font = '800 34px Arial, Helvetica, sans-serif'; g.textAlign = 'center';
    const lines = name.length > 15 ? [name.slice(0, name.indexOf('_') + 1), name.slice(name.indexOf('_') + 1)] : [name];
    lines.forEach((l, i) => g.fillText(l, 180, 340 + i * 42 - (lines.length - 1) * 16));
    g.fillStyle = '#6b7785'; g.font = '600 22px Arial, Helvetica, sans-serif'; g.fillText('MP4 · 00:30', 180, 432);
  } else {
    g.strokeStyle = 'rgba(159,255,224,.5)'; g.lineWidth = 6; g.setLineDash([16, 12]); g.beginPath(); g.roundRect(30, 30, 300, 400, 20); g.stroke();
    g.fillStyle = 'rgba(159,255,224,.75)'; g.font = '800 120px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 180, 230);
  }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}

export async function create(spec, data, {width = 1280, height = 720, mode = 'film'} = {}) {
  const W = width, H = height, S = W / 1280;
  const out = document.createElement('canvas'); out.width = W; out.height = H; const ctx = out.getContext('2d');
  const film = document.createElement('canvas'); film.width = W; film.height = H; const fctx = film.getContext('2d');
  const glitch = document.createElement('canvas'); glitch.width = W; glitch.height = H;
  const renderer = new T.WebGLRenderer({antialias: true, preserveDrawingBuffer: true}); renderer.setSize(W, H); renderer.setPixelRatio(1); renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.17;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene(); scene.background = new T.Color('#101b2b'); scene.fog = new T.FogExp2('#101b2b', .018);
  const pmrem = new T.PMREMGenerator(renderer), envTex = pmrem.fromScene(new RoomEnvironment(), .04).texture; pmrem.dispose(); scene.environment = envTex; scene.environmentIntensity = .25;
  const camera = new T.PerspectiveCamera(36, W / H, .1, 60);
  scene.add(new T.HemisphereLight('#b1d1f0', '#323946', 1.5));
  const key = new T.DirectionalLight('#ffce98', 4.2); key.position.set(-3.5, 5, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, {left: -7, right: 7, top: 6, bottom: -5}); key.shadow.bias = -.0002; key.shadow.normalBias = .025; scene.add(key);
  const rim = new T.DirectionalLight('#72c8ff', 3.6); rim.position.set(3, 4, -4); scene.add(rim);
  const rim2 = new T.DirectionalLight('#ffd6a0', 2.2); rim2.position.set(-3.2, 3.2, -3.5); scene.add(rim2);
  const glow = new T.PointLight('#ffc17a', 12, 12, 2); glow.position.set(-3.5, 2.5, 1); scene.add(glow);
  const set = scenery(scene), sctx = set.canvas.getContext('2d');
  const photo = await loadPhotoSet();
  const bear = createPlushBear({features: 'all', photo, viewHeight: H});
  const bearHolder = new T.Group(); bearHolder.position.set(-1.3, .0, .12); bearHolder.scale.setScalar(.9); bearHolder.add(bear.root); scene.add(bearHolder);
  const pip = robot(scene); pip.root.position.set(1.28, 0, .12);
  // Three file cards that pop out of the screen and flip on each "final".
  const names = [['final.mp4', '#ff9a3d'], ['final_FINAL.mp4', '#d06bff'], ['actually_final.mp4', '#3ec9a7']];
  const cards = names.map(([name, colour], i) => {
    const g = new T.Group(); g.position.set((i - 1) * 1.95, 2.6, -1.1); scene.add(g);
    const geo = new T.PlaneGeometry(1.55, 1.98);
    const front = new T.Mesh(geo, new T.MeshStandardMaterial({map: fileCard(name, colour, true), roughness: .5, emissive: '#ffffff', emissiveIntensity: .18, emissiveMap: null}));
    const backFace = new T.Mesh(geo, new T.MeshStandardMaterial({map: fileCard(name, colour, false), roughness: .5})); backFace.rotation.y = Math.PI;
    front.castShadow = backFace.castShadow = true; g.add(front, backFace); g.visible = false; return g;
  });
  const rt = new T.WebGLRenderTarget(W, H, {type: T.HalfFloatType}); rt.samples = 4;
  const composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new T.Vector2(W, H), .24, .4, .92); composer.addPass(bloom);
  const bokeh = new BokehPass(scene, camera, {focus: 7, aperture: .0022, maxblur: .016});
  // Depth of field needs opaque bodies only: dust and fur layers are skipped in its depth pass.
  const depthRender = bokeh.render.bind(bokeh);
  bokeh.render = (...args) => { set.dust.visible = false; set.rays.visible = false; try { return withoutFur(scene, () => depthRender(...args)); } finally { set.dust.visible = true; set.rays.visible = true; } };
  composer.addPass(bokeh); composer.addPass(new OutputPass());

  // Key times from the manifest.
  const b = spec.beats, t0 = b.trailer[0], tw = (g, p, n) => wordTime(spec, g, p, n);
  const L = Object.fromEntries(spec.turns.map(l => [l.gesture, l]));
  const K = {
    slam: b.hook[0] + .28, jump: b.hook[0] + .55, trailer: t0, full: t0, back: b.trailer[1] - .18,   // hard cut into the trailer on the whoosh
    cards: L.count.start + L.count.words[2].start - .55, flips: [0, 1, 2].map(n => tw('count', 'final', n)),
    loading: b.loading[0], reveal: L.reveal.start, deadpan: L.reveal.end + .05, end: b.end[0],
  };

  function bearPerformance(t) {
    const p = {head: {}, face: {}, arms: [{}, {}], ears: [{}, {}], legs: [{}, {}]}, f = p.face, h = p.head;
    p.turn = .3; p.squash = .012 * Math.sin(t * 2 * Math.PI / 2.6); p.tilt = .015 * Math.sin(t * 2 * Math.PI / 3.9);
    h.nod = .02 * Math.sin(t * 1.3); h.roll = .02 * Math.sin(t * .9 + 1); h.turn = .1; f.smile = .35; f.gazeX = .4;
    for (const bt of [K.jump + .55, L.ask.end + .1, L.doubt.start - .1, L.plead.start - .15, L.question.end + .08, K.deadpan + .55, K.deadpan + 1.25]) f.blink = Math.max(f.blink || 0, Math.exp(-(((t - bt) / (bt > K.deadpan ? .12 : .06)) ** 2)));
    // Hook: startled jump as LAUNCH lands.
    const eek = env(t, K.jump - .08, b.hook[1] + .25, .08, .4);
    f.surprise = eek; f.brow = eek; p.ears.forEach(e => { e.perk = eek * .9 + .4 * spring(t, K.jump, 3, 5); }); f.gazeX = lerp(f.gazeX, -.2, eek); f.gazeY = .6 * eek;
    p.hop = .12 * Math.max(0, spring(t, K.jump, 1.3, 5)); p.squash -= .08 * Math.max(0, spring(t, K.jump, 1.3, 5));
    // ask: head tilt, one paw raised.
    const ask = env(t, L.ask.start - .2, L.ask.end + .3, .25, .3);
    h.roll += .15 * ask; h.turn += .15 * ask; f.brow = Math.max(f.brow, .4 * ask); f.smile = Math.max(f.smile, .6 * ask);
    // Listening to Pip: look over, small nods.
    const listen = env(t, L.proud.start - .1, L.proud.end + .2, .3, .3) + env(t, L.count.start - .1, L.count.end + .2, .3, .3) + env(t, L.reveal.start - .1, b.end[0], .3, .2);
    h.turn += .25 * listen; f.gazeX = lerp(f.gazeX, 1, Math.min(1, listen)); h.nod += .03 * listen * Math.sin(t * 5);
    // doubt: lids down, one brow cocked, a flat smile.
    const doubt = env(t, L.doubt.start - .2, b.trailer[0] + .2, .2, .2);
    f.lid = .5 * doubt; f.lidAsym = .3 * doubt; f.browTilt = .8 * doubt; f.smirk = -.5 * doubt; f.smile -= .5 * doubt; h.nod += .06 * doubt;
    // Back from the trailer: shocked, then pleading with paws together.
    const shock = env(t, K.back, L.plead.start + .4, .06, .3), plead = env(t, L.plead.start - .15, L.plead.end + .35, .25, .3);
    f.surprise = Math.max(f.surprise, shock); p.ears.forEach(e => { e.back = (e.back || 0) + .6 * shock; e.flop = (e.flop || 0) + .5 * plead; });
    f.worry = .9 * plead; f.brow = Math.max(f.brow, .5 * plead); f.surprise = Math.max(f.surprise, .25 * plead); f.smile = lerp(f.smile, 0, plead); p.lean = .08 * plead; h.nod -= .05 * plead;
    // Cards: eyes up and following each flip.
    const cardsLook = env(t, K.cards, L.count.end + .3, .3, .3);
    f.gazeY = Math.max(f.gazeY || 0, .7 * cardsLook); h.nod -= .1 * cardsLook; f.gazeX = lerp(f.gazeX, -1 + Math.min(2, Math.max(0, (t - K.flips[0]) / (K.flips[2] - K.flips[0]))) , cardsLook * .8);
    // question: head tilt, palm up.
    const q = env(t, L.question.start - .15, K.loading + .8, .2, .3);
    h.roll -= .2 * q; f.browTilt = Math.max(f.browTilt || 0, .7 * q); f.brow = Math.max(f.brow, .3 * q);
    // Deadpan after the reveal: lids half down, no smile.
    const dead = env(t, K.deadpan - .1, spec.duration + 1, .4, .1);
    f.lid = Math.max(f.lid || 0, .55 * dead); f.smile = lerp(f.smile, -.15, dead); f.gazeX = lerp(f.gazeX, 0, dead); h.turn = lerp(h.turn, -.15, dead);
    const restL = [-.5, -.12, .2], restR = [.5, -.12, .2];
    const layers = [
      [eek, [-.6, .45, .3], [.6, .45, .3], [0, .2, 1], [0, .2, 1]],
      [ask * (1 - eek), restL, [.4, .32, .42], [0, 0, 1], [-.3, .5, .8]],
      [doubt, [-.13, -.03, .45], [.14, -.07, .46], [.7, 0, .3], [-.7, 0, .3]],
      [shock * (1 - plead), [-.3, .52, .42], [.3, .52, .42], [1, 0, -.2], [-1, 0, -.2]],
      [plead, [-.07, .1, .5], [.07, .1, .5], [1, 0, .2], [-1, 0, .2]],
      [q * (1 - plead), restL, [.42, .05, .46], [0, 0, 1], [0, 1, .3]],
      [dead, [-.13, -.03, .45], [.14, -.07, .46], [.7, 0, .3], [-.7, 0, .3]],
    ];
    let wl = 0; const aL = [0, 0, 0], aR = [0, 0, 0], pL = [0, 0, 0], pR = [0, 0, 0];
    for (const [k, l, r, pl, pr] of layers) if (k > 0) { wl += k; for (let j = 0; j < 3; j++) { aL[j] += l[j] * k; aR[j] += r[j] * k; pL[j] += pl[j] * k; pR[j] += pr[j] * k; } }
    const rw = Math.max(0, 1 - wl), n = Math.max(1, wl);
    p.arms[0] = {target: aL.map((v, j) => (v + restL[j] * rw) / (wl + rw)), palm: wl ? pL.map(v => v / n) : [0, 0, 1], pole: [-.4, .3, -1]};
    p.arms[1] = {target: aR.map((v, j) => (v + restR[j] * rw) / (wl + rw)), palm: wl ? pR.map(v => v / n) : [0, 0, 1], pole: [.4, .3, -1]};
    p.legs[0].lift = .12 * eek; p.legs[1].lift = .1 * eek;
    const m = mouthAt(turnFor(spec, 'bear', t), t, VISEMES); f.mouth = m.value; p.mouthId = m.id; h.nod += .012 * (m.value[0] + m.value[4]) / .155;
    return p;
  }
  const puff = new T.Vector3();
  const poseBear = animator(bear, bearPerformance, {extra: t => puff.set(0, .6 * Math.max(0, spring(t, K.jump - .03, 1.2, 4.5)) + .35 * Math.max(0, spring(t, K.back, 1.2, 4.5)), 0)});

  function pipAt(t) {
    const turn = turnFor(spec, 'pip', t), m = mouthAt(turn, t, PIP_MOUTHS), u = turn ? t - turn.start : 0;
    const proud = env(t, L.proud.start - .2, L.proud.end + .3, .25, .3), dramatic = env(t, tw('proud', 'dramatic') - .05, L.proud.end + .25, .1, .25);
    const count = env(t, L.count.start - .2, L.count.end + .3, .25, .3), reveal = env(t, L.reveal.start - .2, spec.duration + 1, .25, .2);
    const listen = 1 - Math.min(1, proud + count + reveal), jolt = Math.max(0, spring(t, K.slam, 2, 5));
    const ring = t >= K.loading - .05 && t < K.reveal ? (t - K.loading) / (K.reveal - K.loading) : null;
    const nFinal = K.flips.filter(x => t >= x - .05).length;
    const targetR = proud ? [.62, .35 + .2 * dramatic, .3] : count ? [.48, .3 + .12 * Math.sin(u * 7), .35] : reveal ? [.62, .15, .36] : [.61, -.59, .06];
    const targetL = proud ? [-.62, .35 + .2 * dramatic, .3] : reveal ? [-.62, .15, .36] : [-.61, -.59, .06];
    const mix = (a, c, k) => a.map((v, j) => lerp(v, c[j], k));
    poseActor(pip, t, {turn: -.32 + .1 * listen, lean: .04 * proud - .03 * jolt, roll: .08 * Math.sin(u * 2) * proud + .1 * reveal, gaze: -.15 * listen, nod: .02 * Math.sin(t * 4) * listen,
      targetL: mix([-.61, -.59, .06], targetL, Math.max(proud, reveal)), targetR: mix([.61, -.59, .06], targetR, Math.max(proud, count, reveal)), curl: count ? .6 : .32, antenna: .3 * jolt + .2 * dramatic, bob: .04 * jolt});
    pip.face({mouth: m.value, star: dramatic > .5, wide: jolt + env(t, K.slam, K.slam + .8, .05, .4), gazeX: listen > .5 ? -1 : 0, happy: env(t, K.deadpan + .2, spec.duration + 1, .2, .1),
      brow: .5 * proud + .3 * count, browTilt: .6 * reveal, ring, spin: ring == null ? 0 : (t - K.loading) * 1.4, ringLabel: ring == null ? null : '…%', smile: .5 + .3 * proud,
      blink: Math.max(...[L.ask.start + .3, L.doubt.start + .2, L.question.start + .4].map(x => Math.exp(-(((t - x) / .06) ** 2)))), sweat: 0});
    pip.tip.material.emissiveIntensity = .65 + 2 * dramatic + (ring == null ? 0 : 1.5 * (.5 + .5 * Math.sin(t * 12)));
    return {mouth: m.id, nFinal};
  }

  function drawScreen(t) {
    const g = sctx; g.setTransform(1, 0, 0, 1, 0, 0);
    if (t >= K.trailer && t < b.trailer[1]) { g.save(); g.scale(1600 / 1280, 900 / 720); drawTrailer(g, t - K.trailer, null); g.restore(); }
    else if (t >= b.trailer[1]) { g.save(); g.scale(1600 / 1280, 900 / 720); drawTrailer(g, TRAILER.end, null); g.restore(); g.fillStyle = 'rgba(8,12,24,.45)'; g.fillRect(0, 0, 1600, 900); }
    else {
      g.fillStyle = '#101b2b'; g.fillRect(0, 0, 1600, 900); g.fillStyle = '#63cab6'; g.font = '600 25px monospace'; g.fillText('NIGHT SHIFT / MOTION STUDIO', 90, 75);
      const k = clamp((t - K.slam) / .3), s = t < K.slam ? 0 : (k >= 1 ? 1 : back(k)), shake = Math.max(0, 1 - (t - K.slam) / .5) * (t > K.slam ? 1 : 0);
      if (t >= K.slam - .02) {
        g.save(); g.translate(800 + 26 * shake * Math.sin(t * 90), 430 + 18 * shake * Math.cos(t * 70)); g.scale(2.6 - 1.6 * s, 2.6 - 1.6 * s); g.globalAlpha = clamp(k * 4);
        g.shadowColor = '#ffb24d'; g.shadowBlur = 60; g.fillStyle = '#fff1d6'; g.font = '900 250px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LAUNCH', 0, 0);
        g.restore(); g.textAlign = 'center'; g.fillStyle = 'rgba(255,214,150,.85)'; g.font = '700 38px Arial, Helvetica, sans-serif'; g.globalAlpha = smooth((t - K.slam - .3) / .4); g.fillText('The launch video · review copy', 800, 640); g.globalAlpha = 1; g.textAlign = 'left';
        const flash = Math.max(0, .7 * (1 - (t - K.slam) / .3)); if (flash > 0) { g.fillStyle = `rgba(255,236,200,${flash})`; g.fillRect(0, 0, 1600, 900); }
      }
    }
    // Behind dialogue the screen steps down so faces and captions lead; it is darkest behind the cards.
    const dim = t < b.hook[1] ? 0 : t < K.trailer ? .45 * smooth((t - b.hook[1]) / .4) : t >= b.trailer[1] ? .2 + .5 * env(t, K.cards - .3, L.count.end + .5, .3, .3) : 0;
    if (dim > 0) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(6,10,20,${dim})`; g.fillRect(0, 0, 1600, 900); }
    set.texture.needsUpdate = true;
  }

  // Cameras: [pos, target, fov, aperture].
  const cams = {
    screen: t => ({pos: [0, 2.35 + .1 * smooth(t / 1), 6.2 - .5 * smooth(t / 1)], target: [0, 3.1, -4.3], fov: 44, aperture: .0006}),
    bear: (t, d = 0) => ({pos: [-.74 + .04 * Math.sin(t * .4), 1.2, 2.95 - d], target: [-1.3, 1.02, .1], fov: 31, aperture: .0016}),
    pip: t => ({pos: [.86 + .04 * Math.sin(t * .5), 1.36, 3.05], target: [1.25, 1.1, .12], fov: 31, aperture: .0016}),
    two: t => ({pos: [.05, 1.75, 5.6 - .1 * Math.sin(t * .3)], target: [0, 1.25, -.4], fov: 33, aperture: .0012}),
    cards: t => ({pos: [0, 2.0, 6.0], target: [0, 1.9, -1.2], fov: 38, aperture: .0009}),
    push: t => ({pos: [0, 3.0, lerp(3.0, -.6, smooth((t - K.trailer) / .42))], target: [0, 3.3, -4.3], fov: 42, aperture: .0004}),
  };
  function shotAt(t) {
    if (t < K.jump - .05) return ['screen', cams.screen(t)];
    if (t < L.ask.start - .1) return ['bear', cams.bear(t, -.15)];
    if (t < L.proud.start - .12) return ['bear', cams.bear(t)];
    if (t < L.doubt.start - .15) return ['pip', cams.pip(t)];
    if (t < K.trailer) return ['bear', cams.bear(t, .35 * smooth((t - L.doubt.start) / 1.2))];
    if (t < K.full) return ['push', cams.push(t)];
    if (t < K.back) return ['trailer', null];
    if (t < K.cards - .1) return ['bear', cams.bear(t, .1)];
    if (t < L.count.end + .25) return ['cards', cams.cards(t)];
    if (t < K.loading) return ['bear', cams.bear(t, .2)];
    if (t < K.deadpan - .5) return ['pip', cams.pip(t)];
    if (t < K.end) return ['two', cams.two(t)];
    return ['end', null];
  }

  const proof = {};
  function frame(seconds, {captions = true, branding = mode === 'film'} = {}) {
    if (!Number.isFinite(seconds)) throw new Error('Time must be finite');
    const t = clamp(seconds, 0, spec.duration), active = activeTurn(spec, t), [shot, cam] = shotAt(t);
    const bp = poseBear(t), pp = pipAt(t);
    drawScreen(t);
    // rays: a burst behind the screen as LAUNCH lands, then a slow glow.
    const burst = t < K.slam ? 0 : Math.exp(-(t - K.slam) * 1.6) * smooth((t - K.slam) / .08);
    set.rayMat.opacity = .85 * burst + (t < K.trailer ? .06 : 0); set.rays.rotation.z = t * .12; set.rays.scale.setScalar(.9 + .3 * burst);
    bloom.strength = .24 + .9 * burst;
    // Cards pop out and flip on each "final".
    cards.forEach((c, i) => {
      const inK = smooth((t - K.cards - i * .08) / .3), outK = smooth((t - L.count.end - .25) / .3), fl = clamp((t - K.flips[i] + .06) / .32);
      c.visible = inK > 0 && outK < 1; c.scale.setScalar(Math.max(.001, (i === 0 ? 1 : 1) * (.2 + .8 * (inK >= 1 ? 1 : back(inK))) * (1 - outK)));
      c.rotation.y = Math.PI * (1 - (fl >= 1 ? 1 : back(fl))); c.position.y = 2.6 + .18 * Math.sin(Math.PI * fl) + .03 * Math.sin(t * 2 + i);
    });
    set.dust.rotation.y = t * .007;
    if (shot === 'trailer') {
      fctx.setTransform(S, 0, 0, S, 0, 0); drawTrailer(fctx, t - K.trailer, glitch); ctx.drawImage(film, 0, 0);
    } else if (shot === 'end') {
      ctx.fillStyle = '#05080f'; ctx.fillRect(0, 0, W, H);
    } else {
      camera.position.set(...cam.pos); camera.fov = cam.fov; camera.updateProjectionMatrix(); camera.lookAt(...cam.target); camera.updateMatrixWorld();
      bokeh.uniforms.focus.value = camera.position.distanceTo(new T.Vector3(...cam.target)); bokeh.uniforms.aperture.value = cam.aperture;
      composer.render(0); if (renderer.getContext().isContextLost()) throw new Error('Dialogue renderer lost WebGL context');
      ctx.drawImage(renderer.domElement, 0, 0);
      const vg = ctx.createRadialGradient(W / 2, H * .45, H * .25, W / 2, H * .47, H * 1.05); vg.addColorStop(0, '#00000000'); vg.addColorStop(1, '#050a1990'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
    ctx.save(); ctx.scale(S, S);
    const fadeEnd = smooth((t - K.end) / .3);
    if (fadeEnd > 0) {
      ctx.globalAlpha = fadeEnd; ctx.fillStyle = '#05080f'; ctx.fillRect(0, 0, 1280, 720);
      const rise = 14 * (1 - smooth((t - K.end - .1) / .5)); ctx.globalAlpha = smooth((t - K.end - .1) / .4);
      label(ctx, 'THE FINAL FINAL', 640, 238 + rise, {size: 64, align: 'center', colour: '#fff1d6', spacing: 10, weight: 900});
      label(ctx, 'A plush bear, a robot and one very dramatic progress bar.', 640, 296 + rise, {size: 26, align: 'center', colour: '#b9c9d6', weight: 500, spacing: 0});
      const names = EFFECTS.map(e => e.name);
      ctx.globalAlpha = smooth((t - K.end - .45) / .5);
      label(ctx, 'EFFECTS IN THIS FILM', 640, 392, {size: 17, align: 'center', colour: '#ffd166', spacing: 4});
      [names.slice(0, 3), names.slice(3, 6), names.slice(6)].forEach((row, r) => label(ctx, row.join('  ·  '), 640, 440 + r * 40, {size: 25, align: 'center', colour: '#e9eef2', weight: 600, spacing: 0}));
      ctx.globalAlpha = 1;
    }
    if (captions && fadeEnd < 1 && shot !== 'trailer') drawCaption(ctx, active, t, {size: mode === 'tile' ? 50 : 34, y: 690, colour: active?.speaker === 'pip' ? '#8ff0d0' : '#ffd166'});
    if (branding && fadeEnd < 1 && shot !== 'trailer') { label(ctx, 'THE FINAL FINAL', 40, 50, {size: 14}); label(ctx, 'MOTION FX LAB / NIGHT SHIFT', 40, 70, {size: 11, colour: '#a8bdc5', spacing: 2}); }
    ctx.restore();
    Object.assign(proof, {time: t, shot, speaker: active?.speaker || null, word: active ? active.words[wordIndex(active, t)]?.text ?? null : null, bear: {mouth: bp.mouthId, speaking: !!turnFor(spec, 'bear', t)}, pip: {mouth: pp.mouth, speaking: !!turnFor(spec, 'pip', t)},
      effects: effectsAt(t), percent: t >= K.trailer && t < b.trailer[1] ? percentAt(t - K.trailer) : null, flipped: pp.nFinal});
    return out;
  }
  /** Gallery effects playing a story role at time t (their windows are the authored beats). */
  function effectsAt(t) {
    const on = new Set(['plush-fur']);
    if (activeTurn(spec, t)) on.add('dialogue-lipsync');
    if (t >= K.slam && t < b.hook[1] + .6) on.add('rays').add('stamp');
    for (const beat of BEATS) if (t >= K.trailer + beat.from && t < K.trailer + beat.to) on.add(beat.effect);
    if (t >= K.cards && t < L.count.end + .55) on.add('cardflip');
    if (t >= K.loading - .05 && t < K.reveal) on.add('ring');
    return [...on];
  }
  return {canvas: out, spec, data, K, EFFECTS, frame, effectsAt, proof: () => structuredClone(proof),
    dispose() { composer.dispose(); bokeh.dispose(); bloom.dispose(); bear.dispose(); scene.traverse(o => { o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach(m => { m.map?.dispose(); m.dispose(); }); }); envTex.dispose(); renderer.dispose(); }};
}
