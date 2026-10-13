import { clamp, lerp, smooth, solveIK, sampleTrack, distance } from './math.js';
import { restPose } from './rig.js';

function resolve(rig, spec) {
  const s = typeof spec === 'string' ? rig.motions?.[spec] : spec;
  if (!s) throw new Error(`Motion is not configured for ${rig.name || 'this rig'}: ${spec}`);
  return s;
}
function chain(rig, leg) {
  for (const id of [leg.root, leg.knee, leg.foot]) if (!rig.joints[id]) throw new Error(`Motion references unknown joint: ${id}`);
  return { ...leg, upper: leg.upper ?? distance(rig.joints[leg.root], rig.joints[leg.knee]), lower: leg.lower ?? distance(rig.joints[leg.knee], rig.joints[leg.foot]), bend: leg.bend ?? 1 };
}
function place(pose, c, target) {
  const s = solveIK(pose.joints[c.root], target, c.upper, c.lower, c.bend);
  pose.joints[c.knee] = s.knee; pose.joints[c.foot] = s.foot;
  if (!s.reachable) pose.meta.unreachable.push(c.foot);
  return s;
}
export function sampleMotion(rig, nameOrSpec, time, overrides = {}) {
  if (!Number.isFinite(time)) throw new TypeError('Motion time must be finite');
  const spec = { ...resolve(rig, nameOrSpec), ...overrides }, pose = restPose(rig);
  pose.meta = { type: spec.type, worldX: 0, contacts: {}, unreachable: [] };
  const t = Math.max(0, time);
  if (spec.type === 'keyframes') {
    if (!(spec.duration > 0) || !Number.isFinite(spec.duration)) throw new RangeError('Keyframe motion requires finite positive duration');
    const at = spec.loop ? t % spec.duration : Math.min(t, spec.duration);
    for (const [id, keys] of Object.entries(spec.joints || {})) { if (!rig.joints[id]) throw new Error(`Unknown keyed joint: ${id}`); pose.joints[id] = sampleTrack(keys, at, spec.easing); }
    for (const [id, keys] of Object.entries(spec.transform || {})) { if (!Object.hasOwn(pose.transform, id)) throw new Error(`Unknown transform: ${id}`); pose.transform[id] = sampleTrack(keys, at, spec.easing); }
    return pose;
  }
  const legs = (spec.legs || rig.legs || []).map(l => chain(rig, l));
  if (spec.type === 'gait') {
    if (!legs.length || !(spec.cycle > 0) || !Number.isFinite(spec.cycle) || !(spec.stance > 0 && spec.stance < 1) || !Number.isFinite(spec.speed)) throw new RangeError('Gait requires leg chains, finite speed/cycle and stance (0..1)');
    const speed = Math.abs(spec.speed), direction = spec.speed < 0 ? -1 : 1, stride = speed * spec.cycle, bodyX = speed * t;
    const bob = -(spec.bob ?? 2) * Math.sin(t / spec.cycle * Math.PI * 4) ** 2;
    pose.transform.y = bob; pose.transform.scaleX = direction; pose.meta.worldX = spec.speed * t;
    for (const leg of legs) {
      const phase = leg.phase || 0, total = t / spec.cycle + phase, cycle = Math.floor(total), u = total - cycle;
      const resting = rig.joints[leg.foot], planted = resting[0] + (cycle - phase) * stride + stride * spec.stance / 2;
      const contact = u < spec.stance, swing = clamp((u - spec.stance) / (1 - spec.stance));
      const x = contact ? planted : lerp(planted, planted + stride, smooth(swing));
      const y = resting[1] - (contact ? 0 : (spec.lift ?? 23) * Math.sin(Math.PI * swing));
      const result = place(pose, leg, [x - bodyX, y - bob]);
      pose.meta.contacts[leg.foot] = { contact, phase: contact ? 'stance' : 'swing', world: [direction * (bodyX + result.foot[0]), result.foot[1] + bob], reachable: result.reachable };
    }
    return pose;
  }
  if (spec.type === 'jump') {
    if (!legs.length) throw new Error('Jump requires leg chains');
    const pre = spec.prep ?? .18, air = spec.flight ?? .5, post = spec.land ?? .28, duration = pre + air + post;
    if (!(pre > 0 && air > 0 && post > 0) || !Number.isFinite(duration)) throw new RangeError('Jump intervals must be finite and positive');
    const at = spec.loop ? t % duration : Math.min(t, duration), H = spec.height ?? 60, D = spec.distance ?? 120, crouch = spec.crouch ?? 10;
    if (!(H >= 0 && crouch >= 0) || !Number.isFinite(H + D + crouch)) throw new RangeError('Jump height, distance and crouch must be finite; height/crouch nonnegative');
    let q = 0, offset = 0, tuck = 0, contact = true;
    if (at < pre) offset = crouch * Math.sin(at / pre * Math.PI / 2);
    else if (at < pre + air) { q = (at - pre) / air; offset = crouch * (1 - q) - 4 * (H + crouch / 2) * q * (1 - q); tuck = Math.sin(Math.PI * q) * (spec.tuck ?? 20) + crouch * (1 - q); contact = false; }
    else { q = clamp((at - pre - air) / post); offset = crouch * Math.sin(Math.PI * q); }
    pose.transform.y = offset; pose.meta.worldX = at < pre ? 0 : at < pre + air ? D * (at - pre) / air : D;
    pose.meta.state = at < pre ? 'load' : !contact ? 'airborne' : 'landing';
    pose.meta.gravity = 8 * (H + crouch / 2) / (air * air);
    for (const leg of legs) {
      const base = rig.joints[leg.foot], target = [base[0] + (!contact ? (leg.reach || 0) * Math.sin(Math.PI * q) : 0), base[1] - (contact ? offset : tuck)];
      const result = place(pose, leg, target);
      pose.meta.contacts[leg.foot] = { contact, world: [pose.meta.worldX + result.foot[0], result.foot[1] + offset], reachable: result.reachable };
    }
    return pose;
  }
  if (spec.type === 'wave') {
    const c = chain(rig, spec.arm), duration = spec.duration ?? 3, at = spec.loop ? t % duration : Math.min(t, duration);
    if (!(duration > 0 && (spec.raise ?? .45) > 0 && (spec.lower ?? .5) > 0) || !Number.isFinite(duration)) throw new RangeError('Wave duration/raise/lower must be positive; duration finite');
    const amount = smooth(at / (spec.raise ?? .45)) * (1 - smooth((at - duration + (spec.lower ?? .5)) / (spec.lower ?? .5)));
    const start = rig.joints[c.foot], target = spec.target || [rig.joints[c.root][0] + 24, rig.joints[c.root][1] - c.upper - c.lower + 20];
    const wiggle = (spec.amplitude ?? 10) * Math.sin(at * Math.PI * 2 * (spec.frequency ?? 2));
    place(pose, c, [lerp(start[0], target[0] + wiggle, amount), lerp(start[1], target[1], amount)]);
    return pose;
  }
  throw new Error(`Unknown motion type: ${spec.type}`);
}
