// Pip, the studio robot: faceted mint body, articulated arms and fingers, and a screen face drawn
// on a canvas each frame (eyes, brows, nine mouth shapes, a loading ring). Pose and face come from
// plain objects, so the films decide everything from time.
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const mat = (color, extra = {}) => new T.MeshStandardMaterial({color, roughness: .68, flatShading: true, ...extra});
export function mesh(parent, geometry, material, x = 0, y = 0, z = 0) { const m = new T.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
export function box(p, w, h, d, m, x = 0, y = 0, z = 0, r = .025) { return mesh(p, new RoundedBoxGeometry(w, h, d, 1, r), m, x, y, z); }
const ico = (p, r, m, x = 0, y = 0, z = 0, detail = 1) => mesh(p, new T.IcosahedronGeometry(r, detail), m, x, y, z);
const group = (p, x = 0, y = 0, z = 0) => { const g = new T.Group(); g.position.set(x, y, z); p.add(g); return g; };
const rod = (p, r1, r2, h, m, y) => mesh(p, new T.CylinderGeometry(r1, r2, h, 8), m, 0, y, 0);
export const palette = () => ({mint: mat('#52baa7', {metalness: .22, roughness: .35}), metal: mat('#304e59', {metalness: .6}), shirt: mat('#edf0dc'),
  glow: mat('#caffdd', {emissive: '#70ffcf', emissiveIntensity: .65})});

// Screen-face mouths, in face-canvas pixels: [width, height, round, teeth, tongue, tongueUp, bite].
export const PIP_MOUTHS = {
  X: [96, 10, 0, 0, 0, 0, 0], A: [72, 7, 0, 0, 0, 0, 0], B: [186, 36, 0, 1, 0, 0, 0], C: [176, 74, .1, .6, .5, 0, 0], D: [180, 128, .15, .5, .85, 0, 0],
  E: [104, 104, .7, .2, .3, 0, 0], F: [64, 64, 1, 0, 0, 0, 0], G: [146, 40, 0, 1, 0, 0, 1], H: [132, 66, .1, .5, .9, 1, 0],
};
const FACE = {w: 512, h: 400};

/** Draw Pip's face. f: {mouth (PIP_MOUTHS array), blink, happy, wide, squint, gazeX, gazeY, brow, worry, browTilt, sweat, star, ring (0-1 or null), ringLabel, glow} */
export function drawPipFace(g, f = {}) {
  const {w, h} = FACE, ink = '#9fffe0', dark = '#04211f';
  g.save(); g.clearRect(0, 0, w, h);
  const bg = g.createRadialGradient(w / 2, h * .45, 30, w / 2, h / 2, w * .62); bg.addColorStop(0, '#0b3a37'); bg.addColorStop(1, '#03110f'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.globalAlpha = .08; g.fillStyle = '#9fffe0'; for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 2); g.globalAlpha = 1;
  g.shadowColor = '#5dffd0'; g.shadowBlur = 18 * (f.glow ?? 1);
  if (f.ring != null) {
    // Loading ring: the stroke empties around a percentage, as in the gallery's countdown ring.
    const p = Math.max(0, Math.min(1, f.ring)), cx = w / 2, cy = h / 2 - 6, r = 120, spin = (f.spin || 0) * Math.PI * 2;
    g.lineCap = 'round'; g.lineWidth = 24; g.strokeStyle = 'rgba(159,255,224,.18)'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = ink; g.beginPath(); g.arc(cx, cy, r, spin - Math.PI / 2, spin - Math.PI / 2 + Math.PI * 2 * Math.max(.04, p)); g.stroke();
    g.fillStyle = ink; g.font = '700 64px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(f.ringLabel ?? Math.round(p * 100) + '%', cx, cy + 4);
    g.restore(); return;
  }
  const eyeY = 150 + (f.gazeY || 0) * 10, gx = (f.gazeX || 0) * 22;
  for (const s of [-1, 1]) {
    const cx = w / 2 + s * 112 + gx, open = Math.max(0, 1 - (f.blink || 0)) * (1 + (f.wide || 0) * .35) * (1 - (f.squint || 0) * .55);
    g.fillStyle = ink; g.strokeStyle = ink; g.lineCap = 'round';
    if (f.star) { star(g, cx, eyeY, 46, 20, 5); g.fill(); }
    else if ((f.happy || 0) > .5 || open < .12) {   // closed or happy arcs
      g.lineWidth = 14; g.beginPath(); if ((f.happy || 0) > .5) g.arc(cx, eyeY + 18, 40, Math.PI * 1.15, Math.PI * 1.85); else { g.moveTo(cx - 40, eyeY); g.lineTo(cx + 40, eyeY); } g.stroke();
    } else {
      const ew = 62 * (1 + (f.wide || 0) * .12), eh = 92 * open;
      g.beginPath(); g.roundRect(cx - ew / 2, eyeY - eh / 2, ew, eh, Math.min(ew, eh) * .45); g.fill();
      g.shadowBlur = 0; g.fillStyle = dark; g.beginPath(); g.arc(cx - ew * .18 + gx * .2, eyeY - eh * .22, Math.min(11, eh * .2), 0, Math.PI * 2); g.fill(); g.shadowBlur = 18 * (f.glow ?? 1);
    }
    // Brows: lift, inner worry, one-sided tilt.
    const by = eyeY - 78 - (f.brow || 0) * 24 - (f.browTilt || 0) * s * 14, tilt = (f.worry || 0) * s * -.35 + (f.browTilt || 0) * s * .18;
    g.save(); g.translate(cx, by); g.rotate(tilt); g.lineWidth = 13; g.beginPath(); g.moveTo(-40, 0); g.lineTo(40, 0); g.stroke(); g.restore();
  }
  if (f.sweat) { g.fillStyle = '#7fd8ff'; g.shadowColor = '#7fd8ff'; const y = 70 + f.sweat * 40; g.beginPath(); g.moveTo(w - 70, y - 30); g.quadraticCurveTo(w - 50, y, w - 70, y + 14); g.quadraticCurveTo(w - 90, y, w - 70, y - 30); g.fill(); g.shadowColor = '#5dffd0'; }
  drawPipMouth(g, f.mouth || PIP_MOUTHS.X, w / 2, 292, f.smile ?? .4);
  g.restore();
}
function star(g, x, y, R, r, n) { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); }
function drawPipMouth(g, m, cx, cy, smile) {
  const [mw, mh, round, teeth, tongue, tongueUp, bite] = m, ink = '#9fffe0';
  g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
  if (mh < 14) {   // closed: a smile line, or a short pressed line
    g.lineWidth = 12 + (14 - mh) * .4; g.beginPath(); g.moveTo(cx - mw / 2, cy - smile * 14); g.quadraticCurveTo(cx, cy + smile * 22 * (mw / 96), cx + mw / 2, cy - smile * 14); g.stroke(); return;
  }
  const rw = mw / 2, rh = mh / 2, top = cy - 12, r = Math.min(rw, rh) * (.35 + .65 * round);
  g.save(); g.beginPath(); g.roundRect(cx - rw, top, mw, mh, [r * .6, r * .6, r, r]); g.closePath();
  g.fillStyle = '#021512'; g.fill(); g.clip();
  if (tongue > .05) { g.fillStyle = '#ff8f9c'; g.shadowColor = '#ff8f9c'; const ty = tongueUp > .5 ? top + mh * .38 : top + mh * .92; g.beginPath(); g.ellipse(cx, ty, rw * (tongueUp > .5 ? .38 : .55), mh * (tongueUp > .5 ? .34 : .3), 0, 0, Math.PI * 2); g.fill(); g.shadowColor = '#5dffd0'; }
  if (teeth > .05) {
    g.fillStyle = '#dffff4'; const th = bite ? mh * .78 : Math.min(26, mh * (teeth > .9 ? .42 : .3));
    g.fillRect(cx - rw * .86, top, mw * .86, th);
    if (teeth > .9 && !bite) { g.fillRect(cx - rw * .86, top + mh - th, mw * .86, th); }
  }
  g.restore();
  g.lineWidth = 9; g.beginPath(); g.roundRect(cx - rw, top, mw, mh, [r * .6, r * .6, r, r]); g.stroke();
}

export function robot(scene) {
  const p = palette(), root = group(scene), hips = group(root, 0, .5, 0), torso = group(hips, 0, .59, 0);
  box(torso, 1.08, 1.07, .73, p.mint, 0, 0, 0, .10);
  box(torso, .90, .73, .055, p.metal, 0, .075, .38, .07);
  const canvas = document.createElement('canvas'); canvas.width = FACE.w; canvas.height = FACE.h;
  const faceTex = new T.CanvasTexture(canvas); faceTex.colorSpace = T.SRGBColorSpace; faceTex.anisotropy = 4;
  const screen = new T.Mesh(new T.PlaneGeometry(.84, .656), new T.MeshStandardMaterial({map: faceTex, emissive: '#ffffff', emissiveMap: faceTex, emissiveIntensity: 1.25, roughness: .25, metalness: 0}));
  screen.position.set(0, .075, .4105); torso.add(screen);
  const head = group(torso, 0, .075, .034);
  for (const s of [-1, 1]) {
    ico(torso, .075, p.metal, s * .49, -.40, .37, 0); box(torso, .055, .09, .019, p.shirt, s * .49, -.40, .43, .008);
    box(torso, .13, .35, .38, p.metal, s * .55, 0, 0, .04);
  }
  const antenna = group(torso, .26, .52, 0); rod(antenna, .028, .035, .31, p.metal, .155); const tip = ico(antenna, .082, p.glow, 0, .34, 0);
  box(torso, .39, .08, .03, p.metal, 0, -.39, .387, .018);
  for (let i = 0; i < 4; i++) box(torso, .044, .028, .02, p.glow, -.105 + i * .07, -.39, .41, .004);
  const arms = [arm(torso, -1, p), arm(torso, 1, p)], legs = [];
  for (const s of [-1, 1]) { const leg = group(hips, s * .30, -.05, 0); rod(leg, .07, .07, .27, p.metal, -.13); const knee = group(leg, 0, -.25, 0); rod(knee, .07, .07, .22, p.metal, -.11); const foot = group(knee, 0, -.19, .04); box(foot, .32, .15, .43, p.mint, 0, 0, .07, .045); legs.push({leg, knee, foot}); }
  const g = canvas.getContext('2d');
  function face(f) { drawPipFace(g, f); faceTex.needsUpdate = true; }
  face({});
  return {root, hips, torso, head, arms, legs, antenna, tip, screen, face, faceCanvas: canvas, type: 'pip'};
}
function hand(parent, s, p) {
  const h = group(parent, 0, -.37, 0), skin = p.mint;
  box(h, .16, .19, .10, skin, 0, -.05, 0, .026);
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const f = group(h, (i - 1.5) * .045, -.13, .008), len = [.092, .118, .112, .087][i];
    box(f, .041, len, .047, skin, 0, -len / 2, 0, .017);
    const tip = group(f, 0, -len, 0); box(tip, .037, len * .67, .041, skin, 0, -len * .33, .002, .014); fingers.push({f, tip});
  }
  const thumb = group(h, s * .094, -.01, .012); thumb.rotation.z = s * .7;
  box(thumb, .063, .12, .067, skin, 0, -.05, 0, .02);
  return {root: h, fingers, thumb};
}
function arm(parent, s, p) {
  const root = group(parent, s * .57, .13, 0);
  rod(root, .065, .07, .40, p.metal, -.20);
  const elbow = group(root, 0, -.40, 0); ico(elbow, .09, p.metal);
  rod(elbow, .06, .06, .32, p.metal, -.16);
  return {root, elbow, hand: hand(elbow, s, p)};
}

/** Pose Pip: {y, turn, lean, tilt, nod, gaze, roll, targetL, targetR (torso space), wrist, curl, crouch, bob}. */
export function poseActor(a, t, pose = {}) {
  const p = pose, breath = Math.sin(t * 2.5 + 1);
  a.root.position.y = p.y || 0; a.root.rotation.y = p.turn || 0;
  a.hips.position.y = .5 + (p.crouch || 0) * -.13 + breath * .008 + (p.bob || 0);
  a.torso.rotation.set(p.lean || 0, 0, p.tilt || 0);
  a.head.rotation.set((p.nod || 0) + breath * .008, p.gaze || 0, p.roll || 0);
  const v = new T.Vector3();
  a.arms.forEach((arm, i) => {
    const s = i ? 1 : -1, target = i ? p.targetR : p.targetL;
    arm.root.rotation.set(.05, 0, s * .10); arm.elbow.rotation.set(-.18, 0, 0);
    if (target) {
      const start = arm.root.position.clone(), delta = v.set(...target).sub(start), d = Math.min(.765, Math.max(.05, delta.length())), dir = delta.normalize().clone();
      const side = new T.Vector3(s, 0, .25).addScaledVector(dir, -new T.Vector3(s, 0, .25).dot(dir)).normalize();
      const along = (.4 * .4 - .37 * .37 + d * d) / (2 * d), bend = Math.sqrt(Math.max(0, .16 - along * along));
      const upper = dir.clone().multiplyScalar(along).addScaledVector(side, bend), lower = dir.clone().multiplyScalar(d).sub(upper);
      const down = new T.Vector3(0, -1, 0), q1 = new T.Quaternion().setFromUnitVectors(down, upper.normalize()), q2 = new T.Quaternion().setFromUnitVectors(down, lower.normalize());
      arm.root.quaternion.copy(q1); arm.elbow.quaternion.copy(q1.clone().invert().multiply(q2));
    }
    arm.hand.root.rotation.set(p.wrist || 0, 0, s * .04);
    arm.hand.fingers.forEach(({f, tip}, j) => { const c = p.curl ?? .32; f.rotation.x = c + (j * .035); tip.rotation.x = c * .8; });
  });
  a.legs.forEach(({leg, knee, foot}, i) => { leg.rotation.x = 0; leg.rotation.z = (i ? 1 : -1) * .035; knee.rotation.x = 0; foot.rotation.x = 0; });
  if (a.antenna) a.antenna.rotation.z = .07 * Math.sin(t * 4) + (p.roll || 0) * -.7 + (p.antenna || 0);
}
