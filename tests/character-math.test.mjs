import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { solveIK, sampleTrack, distance } from '../fx/character/math.js';
import { validateRig, restPose, skinVertex } from '../fx/character/rig.js';
import { sampleMotion } from '../fx/character/motion.js';
import { quantizeRGBA } from '../fx/character/palette.js';

const rig = name => JSON.parse(readFileSync(new URL(`../assets/characters/${name}/rig.json`, import.meta.url)));
const cat = rig('apricot-cat'), robot = rig('explorer-robot');
const close = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

test('IK preserves bone lengths, handles folded and unreachable targets', () => {
  for (const target of [[20, 30], [1000, 0], [0, 0]]) for (const bend of [-1, 1]) {
    const p = solveIK([0, 0], target, 40, 30, bend);
    close(distance([0, 0], p.knee), 40); close(distance(p.knee, p.foot), 30);
    assert.ok([...p.knee, ...p.foot].every(Number.isFinite));
    assert.equal(p.reachable, target[0] === 20);
  }
  assert.throws(() => solveIK([0, 0], [1, 2], 0, 3), /positive/);
});

test('keyframes interpolate points/scalars and reject malformed tracks', () => {
  assert.deepEqual(sampleTrack([{ t: 0, value: [0, 20] }, { t: 2, value: [10, 0] }], 1), [5, 10]);
  close(sampleTrack([{ t: 0, value: 0 }, { t: 2, value: 10 }], .5, 'linear'), 2.5);
  assert.throws(() => sampleTrack([{ t: 1, value: 0 }, { t: 1, value: 2 }], 1), /strictly increasing/);
  assert.throws(() => sampleTrack([{ t: 0, value: 0 }, { t: 1, value: [1, 2] }], .5), /types must agree/);
});

test('different rig topologies validate; missing bindings and wrong skin weights fail', () => {
  assert.equal(validateRig(cat).legs.length, 4); assert.equal(validateRig(robot).legs.length, 2);
  const broken = structuredClone(cat); broken.parts[0].mesh.bindings[0].to = 'missing';
  assert.throws(() => validateRig(broken), /Unknown joint/);
  const weights = structuredClone(cat); weights.parts[0].mesh.weights = [[1, 0]];
  assert.throws(() => validateRig(weights), /vertex count/);
  const bones = structuredClone(cat); bones.bones.push(['body', 'absent']);
  assert.throws(() => validateRig(bones), /Unknown joint/);
});

test('skin binding maps both bone anchors and terminal pin to declared joints', () => {
  const mesh = { bindings: [{ sourceA: [0, 0], sourceB: [0, 10], from: 'a', to: 'b' }] };
  const joints = { a: [30, 40], b: [50, 40], foot: [90, 60] };
  assert.deepEqual(skinVertex([0, 0], mesh, joints), [30, 40]);
  assert.deepEqual(skinVertex([0, 10], mesh, joints), [50, 40]);
  mesh.pin = { joint: 'foot', source: [0, 10], axis: 'y', start: 5, end: 10, scale: .5 };
  assert.deepEqual(skinVertex([2, 12], mesh, joints), [91, 61]);
});

test('paired part identity and source handedness reject swapped or unmirrored limbs', () => {
  const p = structuredClone(robot), left = p.parts.find(p => p.id === 'arm-left');
  left.mesh.bindings[0].widthScale *= -1;
  assert.throws(() => validateRig(p), /Handedness mismatch/);
  const swapped = structuredClone(robot); swapped.pairs[0].left = 'arm-right'; swapped.pairs[0].right = 'arm-left';
  assert.throws(() => validateRig(swapped), /identity/);
  const pin = structuredClone(robot), leg = pin.parts.find(p => p.id === 'leg-right');
  leg.mesh.pin.scale[0] *= -1;
  assert.throws(() => validateRig(pin), /Terminal pin mirror/);
});

test('planted feet do not slide in actual world coordinates, including reversed travel', () => {
  for (const speed of [85, -85]) {
    for (const l of cat.legs) {
      const t = (1 - l.phase + .15) * cat.motions.walk.cycle;
      const a = sampleMotion(cat, 'walk', t, { speed }), b = sampleMotion(cat, 'walk', t + .08, { speed });
      assert.ok(a.meta.contacts[l.foot].contact && b.meta.contacts[l.foot].contact);
      const world = p => [p.meta.worldX + p.joints[l.foot][0] * p.transform.scaleX, p.joints[l.foot][1] + p.transform.y];
      const A = world(a), B = world(b);
      close(A[0], B[0]); close(A[1], B[1]); close(A[1], cat.joints[l.foot][1]);
      close(A[0], a.meta.contacts[l.foot].world[0]);
      assert.notEqual(a.joints[l.foot][0], b.joints[l.foot][0]);
      assert.equal(a.transform.scaleX, Math.sign(speed));
    }
  }
});

test('jump body and feet are continuous at takeoff and landing; crouch feet stay on ground', () => {
  const s = cat.motions.jump, end = s.prep + s.flight, eps = 1e-8;
  for (const boundary of [s.prep, end]) {
    const a = sampleMotion(cat, 'jump', boundary - eps), b = sampleMotion(cat, 'jump', boundary + eps);
    close(a.transform.y, b.transform.y, 1e-4);
    for (const l of cat.legs) close(a.joints[l.foot][1] + a.transform.y, b.joints[l.foot][1] + b.transform.y, 1e-4);
  }
  const prep = sampleMotion(cat, 'jump', s.prep / 2), apex = sampleMotion(cat, 'jump', s.prep + s.flight / 2);
  for (const l of cat.legs) close(prep.joints[l.foot][1] + prep.transform.y, cat.joints[l.foot][1]);
  assert.equal(apex.meta.state, 'airborne'); close(apex.transform.y, -s.height);
});

test('all configured actions remain reachable and deterministic through backward seeks', () => {
  for (const d of [cat, robot]) for (const motion of Object.keys(d.motions)) {
    const before = sampleMotion(d, motion, .74); sampleMotion(d, motion, 2.8);
    assert.deepEqual(sampleMotion(d, motion, .74), before);
    for (let t = 0; t < 3; t += 1 / 30) assert.deepEqual(sampleMotion(d, motion, t).meta.unreachable, [], `${d.name}: ${motion} at ${t}`);
  }
  assert.throws(() => sampleMotion(robot, 'run', 1), /not configured/);
  assert.throws(() => sampleMotion(cat, 'walk', NaN), /finite/);
  assert.throws(() => sampleMotion(cat, 'idle', 0, { duration: Infinity }), /finite/);
  const p = restPose(cat); p.joints.body[0] = 100; assert.equal(cat.joints.body[0], 0);
});

test('palette mapping preserves alpha and produces actual palette colors', () => {
  const source = new Uint8ClampedArray([10, 20, 30, 0, 150, 150, 150, 127, 255, 255, 255, 255]);
  const out = quantizeRGBA(source, 'poster');
  assert.deepEqual([out[3], out[7], out[11]], [0, 127, 255]);
  assert.deepEqual([...out.slice(0, 3)], [34, 55, 73]);
  assert.deepEqual([...out.slice(8, 11)], [242, 221, 175]);
  assert.throws(() => quantizeRGBA(source, { mode: 'poster', colors: ['red'] }), /four/);
});
