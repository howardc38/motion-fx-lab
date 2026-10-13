// 2D image sources for the studio dot and time effects. The art and rigs are the
// public fx/character subjects (read-only); this module only authors poses for
// them. rig-gl.js draws the posed rigs (fast enough for many redraws per frame).
import { loadRig, restPose } from "../character/rig.js";
import { sampleMotion } from "../character/motion.js";
import { solveIK } from "../character/math.js";

const FILES = {
  cat: new URL("../../assets/characters/apricot-cat/rig.json", import.meta.url),
  robot: new URL("../../assets/characters/explorer-robot/rig.json", import.meta.url),
};
const rigs = new Map();
export function loadSubject(id) {
  if (!FILES[id]) throw new Error("Unknown studio subject: " + id);
  if (!rigs.has(id)) {
    const work = loadRig(FILES[id]);
    rigs.set(id, work);
    work.catch(() => rigs.delete(id));
  }
  return rigs.get(id);
}

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (v) => { v = clamp(v); return v * v * (3 - 2 * v); };
const mix = (a, b, u) => a + (b - a) * u;
function blend(a, b, u) {
  const out = structuredClone(a);
  for (const id of Object.keys(out.joints)) out.joints[id] = out.joints[id].map((v, i) => mix(v, b.joints[id][i], u));
  for (const k of Object.keys(out.transform)) out.transform[k] = mix(a.transform[k], b.transform[k], u);
  out.meta = { ...a.meta, ...b.meta, worldX: mix(a.meta.worldX || 0, b.meta.worldX || 0, u) };
  return out;
}
const rotate = (p, c, a) => {
  const x = p[0] - c[0], y = p[1] - c[1], s = Math.sin(a), k = Math.cos(a);
  return [c[0] + x * k - y * s, c[1] + x * s + y * k];
};

// Apricot's dash, pounce and landing, authored in source seconds (0..CAT_CLIP).
// worldX is in rig units; the caller places it in a frame.
export const CAT_CLIP = 3;
const RUN = { speed: 300, cycle: 0.3, stance: 0.48, lift: 30, bob: 3 };
const LEAP = { height: 150, distance: 470, flight: 0.7, prep: 0.2, land: 0.3, tuck: 26, loop: false };
const T_LEAP = 1.0, T_AIR = T_LEAP + LEAP.prep, T_LAND = T_AIR + LEAP.flight, T_RUN = T_LAND + LEAP.land;
export function catPounce(def, s) {
  s = clamp(s, 0, CAT_CLIP);
  const runPose = (u) => sampleMotion(def, "run", u, RUN);
  let pose, phase;
  if (s < T_LEAP) { pose = runPose(s); phase = "run"; }
  else if (s < T_RUN) {
    pose = sampleMotion(def, "jump", s - T_LEAP, LEAP);
    pose.meta.worldX += RUN.speed * T_LEAP;
    phase = s < T_AIR ? "load" : s < T_LAND ? "air" : "land";
    if (s < T_LEAP + 0.12) {
      const a = runPose(s);
      pose = blend(a, pose, smooth((s - T_LEAP) / 0.12));
    }
    if (phase === "air") {
      const q = (s - T_AIR) / LEAP.flight;
      pose.transform.rotation = -0.32 * Math.cos(Math.PI * q);
      pose.transform.scaleX = 1 + 0.14 * Math.sin(Math.PI * q);
      pose.transform.scaleY = 1 - 0.07 * Math.sin(Math.PI * q);
      // Front legs reach for the landing, hind legs trail the take-off.
      pose.joints.look = [134, -30 + 22 * Math.cos(Math.PI * q)];
      pose.joints.tailTip = [-166, -2 + 40 * Math.sin(Math.PI * q)];
    } else if (phase === "load") {
      const q = (s - T_LEAP) / LEAP.prep;
      pose.transform.scaleY = 1 - 0.1 * Math.sin(Math.PI * q);
      pose.transform.scaleX = 1 + 0.05 * Math.sin(Math.PI * q);
    } else {
      const q = (s - T_LAND) / LEAP.land;
      pose.transform.scaleY = 1 - 0.12 * Math.sin(Math.PI * q);
      pose.transform.scaleX = 1 + 0.08 * Math.sin(Math.PI * q);
    }
  } else {
    pose = runPose(s - T_RUN);
    pose.meta.worldX += RUN.speed * T_LEAP + LEAP.distance;
    phase = "run";
    if (s < T_RUN + 0.12) {
      const a = sampleMotion(def, "jump", LEAP.prep + LEAP.flight + LEAP.land - 1e-6, LEAP);
      a.meta.worldX += RUN.speed * T_LEAP;
      pose = blend(a, pose, smooth((s - T_RUN) / 0.12));
    }
  }
  pose.meta.phase = phase;
  return pose;
}

// Apricot holding still for a portrait: breathing, ear-and-head turns, tail swish.
export function catPortrait(def, t) {
  const pose = restPose(def);
  pose.meta = { worldX: 0 };
  const look = Math.sin(t * Math.PI * 2 / 4.8);
  pose.joints.look = [134, -30 - 26 * smooth(0.5 + 0.5 * look) + 6];
  pose.joints.neck = [44 + 3 * Math.sin(t * 2.6), -30 + 2 * Math.sin(t * 2.6)];
  pose.joints.tailTip = [-166 + 18 * Math.sin(t * 2.2), -2 - 50 * (0.5 + 0.5 * Math.sin(t * 2.2 + 1))];
  pose.transform.scaleY = 1 + 0.012 * Math.sin(t * 3.1);
  return pose;
}

// Milo the explorer robot: a two-step groove with arm pumps for the beat study.
function arm(pose, side, target, bend) {
  const s = pose.joints[side + "Shoulder"], r = solveIK(s, target, 44, 44, bend);
  pose.joints[side + "Elbow"] = r.knee;
  pose.joints[side + "Hand"] = r.foot;
}
function leg(pose, side, target, bend) {
  const h = pose.joints[side + "Hip"], r = solveIK(h, target, 41, 47, bend);
  pose.joints[side + "Knee"] = r.knee;
  pose.joints[side + "Foot"] = r.foot;
}
const UPPER = ["up", "neck", "look", "scarf", "scarfTip", "rightShoulder", "rightElbow", "rightHand", "leftShoulder", "leftElbow", "leftHand"];
export function robotGroove(def, t, beat = 0.6) {
  const pose = restPose(def);
  pose.meta = { worldX: 0 };
  const b = t / beat, ph = b % 1, step = Math.floor(b) % 2 ? -1 : 1;
  const dip = Math.sin(Math.PI * ph) ** 2, bounce = 9 * (1 - Math.abs(Math.cos(Math.PI * b)));
  pose.transform.y = bounce;
  // Hips sway; the upper body counter-rotates around the pelvis.
  const sway = 0.12 * Math.sin(Math.PI * b);
  for (const id of UPPER) pose.joints[id] = rotate(pose.joints[id], [0, 10], sway);
  pose.joints.body = rotate(pose.joints.body, [0, 10], sway * 0.6);
  pose.joints.look = rotate([90, -88], pose.joints.neck, -0.25 * Math.sin(Math.PI * b * 2) + sway);
  pose.joints.look = [pose.joints.look[0], pose.joints.look[1]];
  const up = Math.sin(Math.PI * 2 * (b / 2));
  arm(pose, "left", [pose.joints.leftShoulder[0] + 30 + 22 * step, pose.joints.leftShoulder[1] - 50 - 34 * dip * (step > 0 ? 1 : 0.3)], 1);
  arm(pose, "right", [pose.joints.rightShoulder[0] - 30 + 22 * step, pose.joints.rightShoulder[1] - 50 - 34 * dip * (step < 0 ? 1 : 0.3)], -1);
  leg(pose, "left", [26 + 6 * up, 95 - bounce - (step > 0 ? 14 * dip : 0)], -1);
  leg(pose, "right", [-26 + 6 * up, 95 - bounce - (step < 0 ? 14 * dip : 0)], 1);
  pose.joints.scarfTip = [pose.joints.scarf[0] + 100, pose.joints.scarf[1] + 10 * Math.sin(t * 7)];
  return pose;
}

// Milo is hit on the head by a ball and recovers.
export function robotBonk(def, t, hit) {
  const pose = restPose(def);
  pose.meta = { worldX: 0 };
  const age = t - hit, k = age > 0 ? Math.exp(-age * 3.2) * Math.sin(age * 15) : 0;
  const reel = age > 0 ? smooth(age / 0.12) * (1 - smooth((age - 0.5) / 0.9)) : 0;
  const tilt = -0.32 * reel + 0.08 * k;
  for (const id of UPPER) pose.joints[id] = rotate(pose.joints[id], [0, 10], tilt * 0.45);
  pose.joints.look = rotate(pose.joints.look, pose.joints.neck, tilt);
  pose.transform.y = 7 * reel;
  const rub = age > 0.55 ? smooth((age - 0.55) / 0.3) * (1 - smooth((age - 1.9) / 0.4)) : 0;
  const head = pose.joints.neck;
  arm(pose, "left", [mix(57, head[0] + 30, rub) + 5 * Math.sin(t * 18) * rub, mix(8, head[1] - 40, rub)], 1);
  arm(pose, "right", [-57 - 18 * reel, 8 - 20 * reel], -1);
  leg(pose, "left", [26 + 6 * reel, 95 - 7 * reel], -1);
  leg(pose, "right", [-26 - 4 * reel, 95 - 7 * reel], 1);
  return pose;
}
