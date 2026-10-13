// "Plush fur" gallery effect: a backlit plush bear draws a heart in its own belly fur, giggles and
// shakes, and the pile whips, fluffs back up and settles. Anticipation (rim light rises, paw lifts),
// impact (the shake), aftermath (fur settles). frame(t) is a pure function of t within the loop.
import * as T from 'three';
import {createStage} from './stage.js';
import {createPlushBear, animator} from './bear.js';
import {loadPhotoSet} from './textures.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const env = (t, t0, t1, a = .25, b = .3) => smooth((t - t0) / a) * (1 - smooth((t - (t1 - b)) / b));
const spring = (t, t0, f = 3, d = 4) => t < t0 ? 0 : Math.sin((t - t0) * f * 2 * Math.PI) * Math.exp(-(t - t0) * d);
export const PERIOD = 6;
export const TIMING = {lift: .6, draw: [1.1, 2.4], shake: [3.05, 3.8], settle: 3.8};   // the paw lifts away before the shake to show the heart
const BODY = [.47, .5, .41];

/** Points of a heart on the belly, in torso space, each with the time the paw passes it. */
function heartPath(n = 30) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    // A heart on the bear's right side of the belly, where its short arm reaches.
    const a = Math.PI * 2 * i / (n - 1), x = .115 * Math.sin(a) ** 3 - .1, y = .0105 * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) - .06;
    const k = smooth((.1 - y) / 1), z = BODY[2] * (1 + .1 * k) * Math.sqrt(Math.max(0, 1 - (x / (BODY[0] * (1 + .14 * k))) ** 2 - (y / BODY[1]) ** 2));
    pts.push([x, y, z, lerp(TIMING.draw[0], TIMING.draw[1], i / (n - 1))]);
  }
  return pts;
}

export async function createPlushFur({width = 1280, height = 720, features = 'all'} = {}) {
  const W = width, H = height;
  const photo = await loadPhotoSet();
  const stage = createStage({width: W, height: H, set: 'studio', exposure: 1.05});
  const bear = createPlushBear({features, photo, viewHeight: H, brush: true});
  stage.scene.add(bear.root); stage.addContact(bear.shared);
  const path = heartPath(), out = document.createElement('canvas'); out.width = W; out.height = H; const ctx = out.getContext('2d');

  function performance(t) {
    const p = {head: {}, face: {}, arms: [{}, {}], ears: [{}, {}], legs: [{}, {}]}, f = p.face, h = p.head;
    p.squash = .012 * Math.sin(t * 2 * Math.PI / 3); h.nod = .02 * Math.sin(t * 2 * Math.PI / 3 + 1); f.smile = .45;
    // Anticipation: look down at the belly as the paw lifts.
    const look = env(t, TIMING.lift - .2, TIMING.shake[0] + .1, .4, .2), draw = env(t, TIMING.draw[0] - .3, TIMING.draw[1] + .15, .3, .15);
    h.nod += .26 * look; h.turn = -.08 * look; f.gazeY = -.9 * look; f.squint = .25 * draw; f.smile = Math.max(f.smile, .7 * draw); f.blush = .35 * draw;
    // The paw follows the heart, a little in front of the fur.
    const u = clamp((t - TIMING.draw[0]) / (TIMING.draw[1] - TIMING.draw[0])), i = Math.min(path.length - 2, Math.floor(u * (path.length - 1))), k = u * (path.length - 1) - i;
    const at = path[i].map((v, j) => lerp(v, path[i + 1][j], k)), nrm = [at[0] / BODY[0] ** 2, at[1] / BODY[1] ** 2, at[2] / BODY[2] ** 2], nl = Math.hypot(...nrm), tip = at.slice(0, 3).map((v, j) => v + nrm[j] / nl * .09);
    const reach = env(t, TIMING.lift, TIMING.draw[1] + .35, .4, .35);
    p.arms[0] = {target: [lerp(-.5, tip[0], reach), lerp(-.12, tip[1], reach), lerp(.2, tip[2], reach)], palm: [lerp(0, .3, reach), 0, lerp(1, -1, reach)], pole: [-.4, .3, -1]};
    // Impact: a giggling shake. Twist, squash, ears and fur follow.
    const shake = env(t, TIMING.shake[0], TIMING.shake[1], .06, .3), s = Math.sin((t - TIMING.shake[0]) * 2 * Math.PI * 5.5);
    p.twist = .2 * shake * s; p.tilt = .07 * shake * Math.sin((t - TIMING.shake[0]) * 2 * Math.PI * 5.5 + 1); p.squash += .07 * shake * Math.abs(s) - .03 * shake;
    p.hop = .05 * Math.max(0, spring(t, TIMING.shake[0], 1.6, 5)); h.roll = .12 * shake * s;
    f.happy = env(t, TIMING.shake[0] - .05, PERIOD - .2, .1, .5); f.blush = Math.max(f.blush, .5 * f.happy);
    p.ears.forEach((e, j) => { e.flop = .4 * shake * Math.sin((t - TIMING.shake[0]) * 30 + j * 2); e.perk = .3 * f.happy; });
    p.arms[1] = {target: [.5 - .1 * shake, -.12 + .12 * shake, .2 + .14 * shake], palm: [0, 0, 1], pole: [.4, .3, -1]};
    p.legs[0].lift = .12 * shake * Math.max(0, s); p.legs[1].lift = .12 * shake * Math.max(0, -s);
    return p;
  }
  // The shake also throws the pile sideways; a gust lifts it in the anticipation.
  const extra = new T.Vector3();
  const poseAt = animator(bear, performance, {drag: .6, extra: t => {
    const shake = env(t, TIMING.shake[0], TIMING.shake[1] + .4, .05, .5);
    return extra.set(2.2 * shake * Math.sin((t - TIMING.shake[0]) * 2 * Math.PI * 5.5 - .8), .9 * Math.max(0, spring(t, TIMING.shake[0], 1.2, 3)), .12 * Math.sin(t * 1.7));
  }});
  const proof = {};
  function frame(seconds, {camera} = {}) {
    if (!Number.isFinite(seconds)) throw new Error('Time must be finite');
    const t = ((seconds % PERIOD) + PERIOD) % PERIOD;
    poseAt(t);
    // The drawn path stays laid down until the shake fluffs it back up.
    const strength = 1 - smooth((t - TIMING.shake[0] - .05) / .55);
    // A wide track, so the heart still reads in a 382 px gallery tile.
    bear.setBrush(path, {now: t, radius: .075, strength: t < TIMING.draw[0] ? 0 : strength});
    // Rim light builds through the anticipation and flares on the shake.
    const flare = Math.max(0, spring(t, TIMING.shake[0], .8, 2.5));
    stage.lights.rim.intensity = 3.2 + 2.6 * smooth(t / 2.2) * (1 - smooth((t - 5.2) / .8)) + 2.5 * flare;
    stage.lights.rim2.intensity = 2.4 + 1.6 * smooth(t / 2.2) * (1 - smooth((t - 5.2) / .8));
    stage.bloom.strength = .22 + .25 * flare;
    const push = smooth((t - .2) / 2.2) * (1 - smooth((t - 3.6) / 1.8)), punch = .25 * Math.max(0, spring(t, TIMING.shake[0], 3, 6));
    // The push-in frames the heart on the belly with the ears still in shot.
    const cam = {pos: [lerp(.55, .45, push), lerp(1.12, 1.16, push), lerp(3.25, 3.1, push) - punch * .2], target: [lerp(0, -.04, push), lerp(.98, .96, push), .1], fov: 30, aperture: .0012, roll: .01 * Math.sin((t - TIMING.shake[0]) * 30) * env(t, TIMING.shake[0], TIMING.shake[1], .05, .3)};
    ctx.drawImage(stage.render(camera || cam), 0, 0);
    const vg = ctx.createRadialGradient(W / 2, H * .5, H * .3, W / 2, H * .5, H * .95); vg.addColorStop(0, 'rgba(4,12,16,0)'); vg.addColorStop(1, 'rgba(4,12,16,.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    Object.assign(proof, {time: t, brush: t < TIMING.draw[0] ? 0 : strength, drawn: clamp((t - TIMING.draw[0]) / (TIMING.draw[1] - TIMING.draw[0])), phase: t < TIMING.shake[0] ? 'anticipation' : t < TIMING.settle ? 'impact' : 'aftermath', rim: stage.lights.rim.intensity});
    return out;
  }
  return {canvas: out, frame, proof: () => ({...proof}), bear, stage, dispose() { bear.dispose(); stage.dispose(); }};
}
