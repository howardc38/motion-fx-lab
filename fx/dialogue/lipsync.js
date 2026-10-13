// "Say it. Mean it.": one generated voice track drives a plush bear's puppet mouth in close-up, then the same
// cues drive Pip's screen face in a split screen. Captions highlight each word as it is spoken and a
// strip shows the current mouth cue. Every value is a function of the absolute time t.
import * as T from 'three';
import {createStage} from '../plush/stage.js';
import {createPlushBear, VISEMES, animator} from '../plush/bear.js';
import {loadPhotoSet} from '../plush/textures.js';
import {robot, poseActor, PIP_MOUTHS, drawPipFace} from './actors.js';
import {clamp, smooth, lerp, env, spring, mouthAt, turnFor, activeTurn, byGesture, wordTime, wordIndex} from './data.js';
import {drawCaption, drawCueStrip, label} from './captions.js';

export async function create(spec, data, {width = 1280, height = 720, mode = 'film'} = {}) {
  const W = width, H = height, S = W / 1280;
  const photo = await loadPhotoSet();
  const stage = createStage({width: W, height: H, set: 'bedroom'});
  const bear = createPlushBear({features: 'all', photo, viewHeight: H});
  stage.scene.add(bear.root); stage.addContact(bear.shared);
  const pip = robot(stage.scene); pip.root.position.set(2.35, 0, .15);
  const pillow = stage.pillow(); pillow.scale.setScalar(.42); pip.torso.add(pillow); pillow.position.set(0, -.5, .58); pillow.rotation.set(.12, 0, .06);
  const out = document.createElement('canvas'); out.width = W; out.height = H; const ctx = out.getContext('2d');

  // Key times, all derived from the analysed speech so a rebuilt voice moves the performance.
  const L0 = byGesture(spec, 'suspect'), L1 = byGesture(spec, 'outburst'), L2 = byGesture(spec, 'smug'), L3 = byGesture(spec, 'split');
  const w = (g, p, n) => wordTime(spec, g, p, n);
  const K = {
    wait: w('suspect', 'wait'), pillow: w('suspect', 'pillow'), brace: L1.start - .22, burst: w('outburst', 'not'), burstEnd: L1.end,
    fine: w('smug', 'fine'), fluff: w('smug', 'fluffiest'), here: w('smug', 'here'), ha: w('smug', 'ha'), smugEnd: L2.end,
    split: L3.start - .38, replay: L3.start, replayEnd: L3.end, flick: L3.end + .45, reveal: spec.beats.end[0] - .62, end: spec.beats.end[0],
  };
  const expressions = {suspicious: 1.0, outburst: K.burst + .12, smug: (K.here + K.ha) / 2};

  function bearPerformance(t) {
    const p = {head: {}, face: {}, arms: [{}, {}], ears: [{}, {}], legs: [{}, {}]}, f = p.face, h = p.head;
    // Idle life: breathing, sway, slow head drift.
    p.squash = .012 * Math.sin(t * 2 * Math.PI / 2.6); p.tilt = .016 * Math.sin(t * 2 * Math.PI / 3.9);
    h.nod = .02 * Math.sin(t * 1.3); h.roll = .025 * Math.sin(t * .9 + 1); h.turn = .03 * Math.sin(t * .7); f.smile = .35;
    for (const b of [K.brace - .12, L2.start - .06, K.replayEnd + .1, K.reveal + .3, K.end + .6]) f.blink = Math.max(f.blink || 0, Math.exp(-(((t - b) / .06) ** 2)));
    // 1 suspicious: one lid low, one brow cocked, side-eye toward Pip's corner.
    const sus = env(t, .05, K.brace + .05, .3, .2);
    f.lid = .5 * sus; f.lidAsym = .3 * sus; f.browTilt = .85 * sus; f.smirk = -.55 * sus; f.smile -= .45 * sus; f.gazeX = .9 * sus * (1 - env(t, K.wait - .1, K.wait + .35, .08, .12));
    h.turn += .16 * sus; h.roll += .07 * sus; p.lean = .05 * sus; h.nod += .05 * sus;
    const waitPaw = env(t, K.wait - .15, K.pillow, .2, .3);
    // 2 brace, then the outburst: stretch up, eyes wide, brows high, arms flung, fur standing.
    const brace = env(t, K.brace, K.burst + .02, .12, .08);
    p.squash += .07 * brace; p.ears.forEach(e => { e.back = .5 * brace; }); f.squint = .4 * brace; h.nod += .08 * brace;
    const burst = env(t, K.burst - .06, K.burstEnd + .12, .07, .32);
    f.surprise = burst; f.brow = burst; f.lid *= 1 - burst; f.lidAsym *= 1 - burst; f.browTilt *= 1 - burst; f.smirk *= 1 - burst; f.smile = lerp(f.smile, .1, burst); f.jaw = .02 * burst;
    p.ears.forEach(e => { e.perk = .9 * burst + .4 * spring(t, K.burst, 3, 5); });
    p.hop = .07 * Math.max(0, spring(t, K.burst - .02, 1.4, 6)); p.squash -= .09 * Math.max(0, spring(t, K.burst - .02, 1.4, 6)) * (burst > 0 ? 1 : 0);
    h.nod -= .12 * burst; p.lean -= .05 * burst;
    // 3 deflate, then smug: lids half down, chin up, a one-sided smile, a pat of the fluff, a laugh.
    const deflate = env(t, K.burstEnd, K.fine + .05, .2, .2);
    p.squash += .05 * deflate; h.nod += .1 * deflate; p.ears.forEach(e => { e.flop = (e.flop || 0) + .3 * deflate; });
    const smug = env(t, K.fine - .12, K.split + .1, .25, .3), pat = env(t, K.fluff - .1, K.here + .05, .15, .15), present = env(t, K.here - .12, K.ha + .05, .15, .12), ha = env(t, K.ha - .05, K.smugEnd + .35, .06, .3);
    f.lid += .45 * smug * (1 - ha); f.smirk += .9 * smug; f.smile = Math.max(f.smile, .85 * smug); h.nod -= .14 * smug; h.roll -= .09 * smug * (1 - ha); h.turn -= .05 * smug;
    f.happy = ha; f.blush = .45 * ha + .15 * smug; h.roll += .12 * ha * Math.sin((t - K.ha) * 2 * Math.PI * 3) * Math.exp(-(t - K.ha) * 2); h.nod -= .08 * ha;
    p.squash += .03 * ha * Math.sin((t - K.ha) * 2 * Math.PI * 5);
    // 4 the replay in split screen: the outburst again, smaller.
    const re = env(t, K.replay - .05, K.replayEnd + .1, .07, .25);
    f.surprise = Math.max(f.surprise, .8 * re); f.brow = Math.max(f.brow || 0, .8 * re); f.lid *= 1 - re; f.smirk *= 1 - re; p.ears.forEach(e => { e.perk = (e.perk || 0) + .7 * re; });
    // 5 the reaction: a slow look at Pip, lids lowering, one brow up, an ear flick.
    const look = env(t, K.replayEnd + .05, K.end + 2, .4, .3);
    f.gazeX = lerp(f.gazeX || 0, 1, look); f.lid = Math.max(f.lid, .5 * look); f.browTilt = Math.max(f.browTilt || 0, .9 * look); f.smile = lerp(f.smile, -.1, look); f.smirk = lerp(f.smirk, -.3, look);
    h.turn += .3 * look; h.roll -= .05 * look;
    p.ears[1].flop = (p.ears[1].flop || 0) + .55 * spring(t, K.flick, 4, 5);
    // Arms: layered torso-space targets with palm directions. Index 0 is the bear's right (-x).
    const restL = [-.5, -.12, .2], restR = [.5, -.12, .2];
    const layers = [
      [waitPaw * (1 - burst), [-.42, .3, .42], restR, [0, .4, 1], [0, 0, 1]],
      [burst + .7 * re, [-.6, .56, .26], [.6, .56, .26], [0, .2, 1], [0, .2, 1]],
      [smug * (1 - pat) * (1 - present) * (1 - ha) * (1 - re), [-.12, -.02, .45], [.13, -.06, .46], [.7, 0, .3], [-.7, 0, .3]],
      [pat, [-.16 + .025 * Math.sin(t * 15), -.12, .44], [.15, -.1 + .02 * Math.sin(t * 15 + 1), .45], [0, 0, -1], [0, 0, -1]],
      [present * (1 - ha), [-.55, .1, .36], [.55, .1, .36], [0, .3, 1], [0, .3, 1]],
      [ha * (1 - re), [-.2, -.05, .44], [.2, .22, .48], [.4, 0, 1], [-.6, .2, .6]],
      [look * (1 - re), [-.14, -.02, .45], [.16, -.06, .45], [.7, 0, .3], [-.7, 0, .3]],
    ];
    let wl = 0; const aL = [0, 0, 0], aR = [0, 0, 0], pL = [0, 0, 0], pR = [0, 0, 0];
    for (const [k, l, r, pl, pr] of layers) if (k > 0) { wl += k; for (let j = 0; j < 3; j++) { aL[j] += l[j] * k; aR[j] += r[j] * k; pL[j] += pl[j] * k; pR[j] += pr[j] * k; } }
    const rw = Math.max(0, 1 - wl), n = Math.max(1, wl);
    p.arms[0] = {target: aL.map((v, j) => (v + restL[j] * rw) / (wl + rw)), palm: wl ? pL.map(v => v / n) : [0, 0, 1], pole: [-.4, .3, -1]};
    p.arms[1] = {target: aR.map((v, j) => (v + restR[j] * rw) / (wl + rw)), palm: wl ? pR.map(v => v / n) : [0, 0, 1], pole: [.4, .3, -1]};
    p.legs[0].lift = .1 * ha * Math.max(0, Math.sin((t - K.ha) * 16)); p.legs[1].lift = .1 * ha * Math.max(0, Math.sin((t - K.ha) * 16 + 2)) + .12 * burst;
    // Speech.
    const m = mouthAt(turnFor(spec, 'bear', t), t, VISEMES); f.mouth = m.value; p.mouthId = m.id;
    h.nod += .012 * (m.value[0] + m.value[4]) / .155;
    return p;
  }
  // Fur stands up on the outburst and settles after: an extra upward force, a function of t.
  const puff = new T.Vector3();
  const poseBear = animator(bear, bearPerformance, {extra: t => puff.set(0, .55 * Math.max(0, spring(t, K.burst - .03, 1.2, 4.5)) + .3 * Math.max(0, spring(t, K.replay - .03, 1.2, 5)), 0)});

  function pipState(t) {
    const turn = turnFor(spec, 'pip', t), m = mouthAt(turn, t, PIP_MOUTHS), guilty = env(t, K.replayEnd + .05, K.end + 2, .3, .3);
    const squeeze = .03 * Math.sin((t - K.replayEnd) * 9) * guilty;
    poseActor(pip, t, {turn: -.42 + .1 * guilty, lean: .04, roll: .06 * guilty, gaze: -.1 * guilty, targetL: [-.34 - squeeze, -.42, .7], targetR: [.34 + squeeze, -.42, .7], curl: .7, antenna: .2 * spring(t, K.replay, 3, 4)});
    pip.face({mouth: m.value, wide: env(t, K.replay - .1, K.replayEnd + .1, .1, .2), gazeX: -1 * guilty, sweat: guilty * (.5 + .5 * Math.sin(t * 3)), smile: .45 + .3 * guilty, brow: .4 * guilty, worry: .7 * guilty,
      blink: Math.exp(-(((t - (K.replayEnd + .75)) / .06) ** 2))});
    return m.id;
  }

  // Cameras. The close-up keeps the mouth in the upper two thirds, above the captions.
  const up = mode === 'tile' ? .035 : 0;
  function bearCam(t) {
    const sm = smooth((t - K.fine) / 1.6), punch = smooth((t - K.burst + .02) / .2) * (1 - smooth((t - K.burstEnd - .25) / .6));
    const x = lerp(-.46 + .06 * smooth(t / 2), -.08, sm), z = lerp(2.62 - .1 * smooth(t / 2.2), 2.48, sm);
    const shake = .012 * Math.max(0, spring(t, K.burst, 6, 7));
    return {pos: [x, 1.26 + up, z], target: [-.02 + x * .1, 1.165 + up + .02 * punch, 0], fov: 30 - 3.2 * punch, roll: shake, aperture: .0013};
  }
  const splitBear = {pos: [.6, 1.26, 2.5], target: [.6, 1.17, 0], fov: 31, aperture: .0013};   // bear centred in the left half
  const splitPip = {pos: [1.72, 1.16, 2.7], target: [1.72, .98, .3], fov: 31, aperture: .0013};   // Pip centred in the right half
  const twoShot = t => ({pos: [1.0 + .05 * smooth((t - K.reveal) / 1.5), 1.32, lerp(5.2, 5.0, smooth((t - K.reveal) / 1.5))], target: [1.12, .98, .1], fov: 31, aperture: .0011});

  // End card: the nine shapes on both faces, rendered once.
  const board = buildBoard();
  function buildBoard() {
    const cw = 120, ch = 92, c = document.createElement('canvas'); c.width = cw * 9; c.height = ch * 2; const g = c.getContext('2d');
    const ids = ['X', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], cam = {pos: [0, 1.05, 1.5], target: [0, 1.0, 0], fov: 20, aperture: .0004};
    const face = document.createElement('canvas'); face.width = 512; face.height = 400; const fg = face.getContext('2d');
    for (const [i, id] of ids.entries()) {
      bear.pose({face: {mouth: VISEMES[id]}}); bear.root.updateMatrixWorld(true); bear.updateOcclusion();
      const src = stage.render(cam), sw = src.width * .34, sh = sw * ch / cw;
      g.drawImage(src, (src.width - sw) / 2, src.height * .56 - sh / 2, sw, sh, i * cw, 0, cw, ch);
      drawPipFace(fg, {mouth: PIP_MOUTHS[id], smile: .4}); g.drawImage(face, 96, 200, 320, 200 * 320 / 340, i * cw + 6, ch + 4, cw - 12, ch - 8);
    }
    return c;
  }

  const proof = {};
  function frame(seconds, {captions = true, branding = mode === 'film'} = {}) {
    if (!Number.isFinite(seconds)) throw new Error('Time must be finite');
    const t = clamp(seconds, 0, spec.duration), endCard = smooth((t - K.end) / .35), split = smooth((t - K.split) / .32) * (1 - smooth((t - K.reveal) / .01));
    const bp = poseBear(t), pipMouth = pipState(t);
    stage.bloom.strength = .22;
    let shot = 'bear';
    if (endCard >= 1) { ctx.fillStyle = '#0d272c'; ctx.fillRect(0, 0, W, H); shot = 'end'; }
    else if (t >= K.reveal) { ctx.drawImage(stage.render(twoShot(t)), 0, 0); shot = 'two'; }
    else if (split > 0) {
      // Split screen: the same cues on two faces. The divider wipes in from the right.
      // The bear camera pans to the left half while Pip's panel slides in.
      const from = bearCam(t), k = smooth(split), mix = (a, b) => a.map((v, j) => lerp(v, b[j], k));
      ctx.drawImage(stage.render({pos: mix(from.pos, splitBear.pos), target: mix(from.target, splitBear.target), fov: lerp(from.fov, splitBear.fov, k), roll: from.roll * (1 - k), aperture: splitBear.aperture}), 0, 0);
      const edge = W - W / 2 * split;
      ctx.drawImage(stage.render(splitPip), W / 2, 0, W / 2, H, edge, 0, W / 2, H);
      ctx.fillStyle = '#ffd166'; ctx.fillRect(edge - 3 * S, 0, 6 * S, H);
      shot = 'split';
    } else ctx.drawImage(stage.render(bearCam(t)), 0, 0);
    // Vignette.
    const vg = ctx.createRadialGradient(W / 2, H * .45, H * .35, W / 2, H / 2, H * .95); vg.addColorStop(0, 'rgba(5,15,20,0)'); vg.addColorStop(1, 'rgba(5,15,20,.42)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.scale(S, S);
    const tile = mode === 'tile', active = activeTurn(spec, t), bearTurn = turnFor(spec, 'bear', t);
    if (split > .5 && t < K.reveal) {
      ctx.globalAlpha = smooth((split - .5) * 2);
      ctx.fillStyle = 'rgba(6,18,24,.72)'; ctx.beginPath(); ctx.roundRect(640 - 330, 22, 660, 44, 22); ctx.fill();
      label(ctx, 'SAME AUDIO · SAME MOUTH CUES · TWO FACES', 640, 52, {size: tile ? 20 : 17, align: 'center', colour: '#ffe7b0'});
      ctx.globalAlpha = 1;
    }
    if (captions && endCard < 1) {
      drawCaption(ctx, active, t, {size: tile ? 54 : 40, y: tile ? 700 : 684, max: tile ? 1180 : 1040});
      drawCueStrip(ctx, bp.mouthId, {x: 1252, y: tile ? 112 : 104, size: tile ? 30 : 22, speaking: !!bearTurn, label: tile ? '' : 'mouth cue'});
    }
    if (branding && endCard < 1) { label(ctx, 'SAY IT. MEAN IT.', 40, 52, {size: 15}); label(ctx, 'MOTION FX LAB · PLUSH FUR + LIP SYNC', 40, 74, {size: 11, colour: '#a8c4c8', spacing: 2}); }
    if (endCard > 0) {
      ctx.globalAlpha = endCard; ctx.fillStyle = '#0d272c'; ctx.fillRect(0, 0, 1280, 720);
      const rise = 18 * (1 - endCard);
      // The tile drops the subtitle and draws the mouth board almost full width, so it reads at 382 px.
      label(ctx, 'SPEECH  →  MOUTH CUES  →  ANY FACE', 640, (tile ? 232 : 150) + rise, {size: tile ? 48 : 34, align: 'center', colour: '#ffe7b0', spacing: 4});
      if (!tile) label(ctx, 'One generated voice, nine analysed mouth shapes, the same timing on a plush bear and a robot.', 640, 196 + rise, {size: 18, align: 'center', colour: '#b9d4d6', weight: 500, spacing: 0});
      const bw = tile ? 1240 : 1080, by = tile ? 282 : 250, bh = bw * board.height / board.width; ctx.drawImage(board, 640 - bw / 2, by + rise, bw, bh);
      ['X', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach((id, i) => label(ctx, id, 640 - bw / 2 + (i + .5) * bw / 9, by + rise + bh + (tile ? 46 : 34), {size: tile ? 36 : 22, align: 'center', colour: '#ffd166'}));
      if (!tile) label(ctx, 'SAY IT. MEAN IT.', 640, 640, {size: 18, align: 'center', colour: '#f1d9b0', spacing: 5});
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    Object.assign(proof, {time: t, shot, speaker: active?.speaker || null, word: active ? active.words[wordIndex(active, t)]?.text ?? null : null, faces: active ? (active.faces || [active.speaker]) : [],
      bear: {mouth: bp.mouthId, speaking: !!bearTurn}, pip: {mouth: pipMouth, speaking: !!turnFor(spec, 'pip', t)},
      expression: Object.entries(expressions).find(([, at]) => Math.abs(t - at) < .35)?.[0] || null});
    return out;
  }
  return {canvas: out, spec, data, K, expressions, frame, bear, stage, proof: () => structuredClone(proof),
    dispose() { bear.dispose(); stage.dispose(); }};
}
