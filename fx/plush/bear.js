// An original plush-toy bear built in code for three.js r180.
// Shell fur (fur.js), felt pads, a satin-stitch nose, glossy safety eyes with felt lids, running
// stitches and a gingham neckerchief. The talking mouth is a puppet mouth: an embroidered lip line,
// a velvet mouth lining, felt teeth and tongue, and a hinged lower face that drops with the jaw.
// Pose and face are plain objects, so any timeline can drive them; nothing here reads the clock.
import * as T from 'three';
import {furMaterial, furPart, furShared, furFeatures, ellipsoid, limbGeometry, MAX_DEF, MAX_BRUSH} from './fur.js';
import {felt, satin, gingham} from './textures.js';

/** Default look: short milk-tea pile. Override any key in createPlushBear({...}). */
export const LOOK = {
  fur: '#c48e5c', tip: '#fff0dc', root: .42, sheen: '#ffe6c8',
  cream: '#f5e6cc', creamTip: '#fffaf0', blush: '#f19d93', inner: '#f2b2a6', eye: '#1b0f0b', nose: '#4b2a1e', thread: '#5b3527',
  mouth: '#4a1720', tongue: '#e6727c', teeth: '#fbf4e6', lid: '#c99462', scarf: '#80b5dd', scarfBg: '#fbf6ec',
  shells: 26, density: 200, clump: 18, strand: .68,
  length: {head: .043, body: .052, muzzle: .019, ear: .032, arm: .044, leg: .045},
  blushAmount: .62,
};
// Mouth parameters, in muzzle units (the muzzle is .5 wide). Index names:
export const MOUTH = {open: 0, width: 1, round: 2, tongue: 3, jaw: 4, teeth: 5, tongueUp: 6, press: 7, bite: 8};
// Rhubarb / Preston Blair shapes A–H and rest X. Each one differs in size, outline and contents,
// so the nine read apart even as small silhouettes (tests/plush.spec.cjs measures their overlap).
//            open  width round tongue jaw  teeth tUp  press bite
export const VISEMES = {
  X: [0, .13, 0, 0, 0, 0, 0, 0, 0],               // rest: relaxed embroidered smile
  A: [0, .082, 0, 0, 0, 0, 0, 1, 0],              // M B P: lips pressed together
  B: [.03, .17, 0, 0, .006, 1, 0, 0, 0],          // K S T EE: teeth together, wide
  C: [.05, .15, .1, .4, .028, .6, 0, 0, 0],       // EH AE: open, upper teeth and tongue
  D: [.07, .155, .15, .75, .085, .5, 0, 0, 0],    // AA: wide open, jaw dropped
  E: [.066, .078, .6, .3, .05, .2, 0, 0, 0],      // AO ER: tall rounded
  F: [.04, .066, 1, 0, .014, 0, 0, 0, 0],         // UW OW W: puckered ring
  G: [.026, .11, 0, 0, .004, 1, 0, 0, 1],         // F V: upper teeth on the lower lip
  H: [.038, .122, .12, .9, .016, .55, 1, 0, 0],   // L: tongue raised to the teeth
};
const HEAD = [.6, .51, .53], MUZZLE = [.25, .175, .165], BODY = [.47, .5, .41];
const MUZZLE_AT = [0, -.17, .405], MOUTH_Y = -.035, NOSE_Y = .078;
const JAW_BLEND = .034, JAW_BACK = .3;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const surfZ = (r, x, y, off = 0) => r[2] * Math.sqrt(Math.max(0, 1 - (x / r[0]) ** 2 - (y / r[1]) ** 2)) * (r === MUZZLE && y < 0 ? 1 - .12 * ease(-y / MUZZLE[1]) : 1) + off;
/** Jaw weight of an undeformed muzzle point (same function as the shader's furJawW for the muzzle). */
const jawW = y => { const k = clamp((MOUTH_Y - .004 - y) / JAW_BLEND); return k * k * (3 - 2 * k); };

function feltPhoto(ph, color) { const t = ph.felt.tint(color); return new T.MeshPhysicalMaterial({color: '#ffffff', map: t, normalMap: ph.felt.normal, normalScale: new T.Vector2(.9, .9), roughnessMap: ph.felt.rough, roughness: 1, sheen: .8, sheenColor: new T.Color(color).lerp(new T.Color('#ffffff'), .5), sheenRoughness: .6}); }
function feltMatSoft(color, seed = 3) { const f = felt(color, seed); return new T.MeshPhysicalMaterial({color: '#ffffff', map: f.map, bumpMap: f.bump, bumpScale: 1.2, roughness: .96, sheen: .8, sheenColor: new T.Color(color).lerp(new T.Color('#ffffff'), .5), sheenRoughness: .6}); }
function threadMat(color) { return new T.MeshStandardMaterial({color, roughness: .62}); }
function mesh(parent, geometry, material, x = 0, y = 0, z = 0, shadow = true) { const m = new T.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; }
function group(parent, x = 0, y = 0, z = 0) { const g = new T.Group(); g.position.set(x, y, z); parent.add(g); return g; }

/** Running stitches on an ellipse in the XY plane of `parent` (facing +z). */
function stitchRing(parent, rx, ry, z, count, material, {len = .55, radius = .0055, from = 0, to = Math.PI * 2} = {}) {
  const per = (to - from) / count, dashes = new T.InstancedMesh(new T.CapsuleGeometry(radius, 1, 3, 6), material, count);
  const m = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const a = from + (i + .5) * per, p = new T.Vector3(Math.cos(a) * rx, Math.sin(a) * ry, z), tan = new T.Vector3(-Math.sin(a) * rx, Math.cos(a) * ry, 0).normalize();
    const l = Math.hypot(rx, ry) * per * len * .7; q.setFromUnitVectors(up, tan); m.compose(p, q, new T.Vector3(1, l, 1)); dashes.setMatrixAt(i, m);
  }
  dashes.castShadow = false; parent.add(dashes); return dashes;
}
function tube(points, radius, material, segments = 28) { return new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), segments, radius, 6), material); }
/** Planar UVs (object xy) for flat pads, so the photographed felt can be mapped. */
function planarUV(geometry, scale) { const p = geometry.attributes.position, uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) uv.set([p.getX(i) * scale + .5, p.getY(i) * scale + .5], i * 2); geometry.setAttribute('uv', new T.BufferAttribute(uv, 2)); return geometry; }

/**
 * Build the bear. Options: any LOOK key, plus
 *   features   furFeatures() spec or result ('all' by default)
 *   photo      result of loadPhotoSet() when features.photo is on (otherwise procedural felt)
 *   viewHeight output height in pixels (fibre width), brush (allow setBrush on the belly), strandScale.
 */
export function createPlushBear(overrides = {}) {
  const L = {...LOOK, ...overrides, length: {...LOOK.length, ...overrides.length}};
  const F = typeof overrides.features === 'object' && overrides.features?.key ? overrides.features : furFeatures(overrides.features ?? 'all');
  const PH = F.photo ? overrides.photo : null;
  const furParts = [], disposables = [], dynamic = [];
  const shared = furShared({photo: PH?.fur, viewHeight: overrides.viewHeight || 1080});
  const occluders = [];   // {obj, center, radii, id}: ellipsoids for contact occlusion
  const feltMat = (color, seed) => PH ? feltPhoto(PH, color) : feltMatSoft(color, seed);
  const padShape = (rx, ry, rz) => { const g = ellipsoid(rx, ry, rz, null, 40, 30); return PH ? planarUV(g, PH.feltScale || 1.2) : g; };
  const furOpts = (len, extra = {}) => ({color: L.fur, tip: L.tip, root: L.root, sheenColor: L.sheen, length: len, shells: L.shells, density: L.density, clump: L.clump, strand: L.strand, sheen: 1, ...extra});
  const addFur = (parent, geometry, opts, place = {}, meta = {}) => {
    const m = furMaterial({...opts, features: F, shared, selfId: meta.id ?? -10, photo: PH?.furParams});
    const p = furPart(parent, geometry, m, {...place, strands: Math.round((meta.strands || 0) * (L.strandScale ?? 1)), seed: meta.seed || 1}); p.id = meta.id; furParts.push(p);
    if (meta.occ) occluders.push({obj: p.group, center: meta.occ[0], radii: meta.occ[1], id: meta.id});
    return p;
  };

  const root = new T.Group(); root.name = 'plush-bear';
  const hop = group(root);                       // vertical hop / bounce
  const body = group(hop, 0, 0, 0);              // squash, lean and twist pivot at the seat
  const torso = group(body, 0, .47, 0);
  // Body: pear shape with a flat seat; cream belly blended into the fur.
  const bodyGeo = ellipsoid(...BODY, v => { const k = ease((.1 - v.y) / 1.0); v.x *= 1 + .14 * k; v.z *= 1 + .1 * k; if (v.y < -.4) v.y = -.4 + (v.y + .4) * .3; });
  const bodyFur = addFur(torso, bodyGeo, furOpts(L.length.body, {brush: !!overrides.brush, patches: [{center: [0, -.06, .36], radii: [.27, .31, .22], color: L.cream, amount: .92}], seams: [[1, 0, 0, 0]]}), {}, {id: 2, strands: 7000, seed: 11, occ: [[0, -.03, 0], [.52, .52, .45]]});

  // Neckerchief: band, chest flap and knot in gingham cotton.
  const g = gingham(L.scarf, L.scarfBg); g.map.repeat.set(3, 1);
  const cloth = new T.MeshPhysicalMaterial({map: g.map, bumpMap: g.bump, bumpScale: .6, roughness: .82, sheen: .5, sheenColor: new T.Color('#ffffff'), sheenRoughness: .7, side: T.DoubleSide});
  const band = mesh(torso, new T.TorusGeometry(.375, .056, 16, 72), cloth, 0, .345, .02); band.rotation.x = Math.PI / 2 - .1; band.scale.set(1, .93, 1);
  const flapMap = g.map.clone(); flapMap.repeat.set(1.4, 1.4); flapMap.needsUpdate = true; disposables.push(flapMap);
  const alpha = document.createElement('canvas'); alpha.width = alpha.height = 128; { const c = alpha.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(4, 4); c.lineTo(124, 4); c.quadraticCurveTo(76, 96, 64, 122); c.quadraticCurveTo(52, 96, 4, 4); c.fill(); }
  const alphaTex = new T.CanvasTexture(alpha); disposables.push(alphaTex);
  const flapGeo = new T.PlaneGeometry(.42, .27, 24, 16); { const p = flapGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), yy = p.getY(i) + .26 - .055; p.setZ(i, surfZ([BODY[0] + .02, BODY[1], BODY[2] + .03], x, yy, L.length.body * .6)); p.setY(i, yy); } flapGeo.computeVertexNormals(); }
  mesh(torso, flapGeo, new T.MeshPhysicalMaterial({map: flapMap, bumpMap: g.bump, bumpScale: .6, alphaMap: alphaTex, alphaTest: .5, roughness: .82, sheen: .5, sheenColor: new T.Color('#ffffff'), sheenRoughness: .7, side: T.DoubleSide}));
  const uvBall = new T.SphereGeometry(1, 24, 16); // cloth needs UVs for the gingham
  const knot = mesh(torso, uvBall, cloth, .2, .33, .35); knot.scale.set(.055, .05, .045); knot.rotation.z = .4;
  for (const s of [-1, 1]) { const tail = mesh(torso, uvBall, cloth, .2 + s * .045, .25, .365); tail.scale.set(.032, .075, .016); tail.rotation.set(.3, 0, s * .45); }
  // A blank sewn-in fabric tag at the right hip: a toy detail, no text or logo.
  const tag = mesh(torso, new T.BoxGeometry(.075, .11, .006), new T.MeshPhysicalMaterial({color: '#fbfaf5', roughness: .9, sheen: .4, sheenColor: new T.Color('#ffffff')}), -.47, -.3, .1); tag.rotation.set(.1, -.9, -.45);

  // Head with a neck pivot.
  const neck = group(torso, 0, .4, .03), head = group(neck, 0, .36, 0);
  const headGeo = ellipsoid(...HEAD, v => { if (v.y < .05) { const k = ease((.05 - v.y) / .45) * ease((Math.abs(v.x) - .1) / .4); v.x *= 1 + .07 * k; v.z *= 1 + .03 * k; } });
  const eyeX = .215, eyeY = -.015, browY = .125, cheek = [.33, -.15];
  const eyeZ = surfZ(HEAD, eyeX, eyeY);
  const headFur = addFur(head, headGeo, furOpts(L.length.head, {jaw: true,
    holes: [[eyeX, eyeY, eyeZ, .088], [-eyeX, eyeY, eyeZ, .088], [.2, browY, surfZ(HEAD, .2, browY), .045], [-.2, browY, surfZ(HEAD, .2, browY), .045]],
    seams: [[1, 0, 0, 0]], seamWidth: .014,
    patches: [{center: [cheek[0], cheek[1], .4], radii: [.12, .085, .16], color: L.blush, amount: L.blushAmount}, {center: [-cheek[0], cheek[1], .4], radii: [.12, .085, .16], color: L.blush, amount: L.blushAmount}],
  }), {}, {id: 0, strands: 7000, seed: 7, occ: [[0, 0, 0], [.63, .54, .56]]});
  // The chin below the muzzle follows the jaw.
  headFur.uniforms.uJaw.value.set(MUZZLE_AT[1] + MOUTH_Y - .03, .12, 0, .3); headFur.uniforms.uJawB.value.set(.12, .36, JAW_BACK);

  // Ears: fur cup, felt inner, running stitches. [0] = bear's right (-x), [1] = left (+x).
  const ears = [-1, 1].map(s => {
    const pivot = group(head, s * .37, .33, -.05); pivot.rotation.z = -s * .55;
    const geo = ellipsoid(.168, .158, .085, v => { if (v.z > 0) v.z *= .55; }, 48, 36);
    const fur = addFur(pivot, geo, furOpts(L.length.ear, {holes: [[0, -.005, .047, .108]]}), {y: .12}, {id: s < 0 ? 9 : 10, strands: 900, seed: s < 0 ? 21 : 22, occ: [[0, 0, -.01], [.18, .17, .09]]});
    const inner = mesh(fur.group, padShape(.105, .1, .022), feltMat(L.inner, 5), 0, -.005, .04);
    stitchRing(inner, .092, .088, .02, 22, threadMat('#c27a6d'), {radius: .0042});
    return {pivot, fur, inner};
  });
  // A gingham repair patch sewn on the left ear with big cross stitches.
  { const patch = mesh(ears[1].fur.group, new T.PlaneGeometry(.085, .085), new T.MeshPhysicalMaterial({map: g.map.clone(), roughness: .85, sheen: .4, sheenColor: new T.Color('#ffffff')}), .07, .085, .052);
    patch.rotation.set(-.3, .45, .35); patch.material.map.repeat.set(.6, .6); patch.material.map.needsUpdate = true; disposables.push(patch.material.map);
    const tm = threadMat('#fbf7ef'); for (const [x, y] of [[-.036, -.036], [.036, -.036], [-.036, .036], [.036, .036]]) for (const r of [-1, 1]) { const st = mesh(patch, new T.CapsuleGeometry(.0035, .018, 2, 5), tm, x, y, .004, false); st.rotation.z = r * Math.PI / 4; } }

  // Muzzle (short cream fur), satin-stitch nose, embroidered philtrum and the talking mouth.
  const muzzleGeo = ellipsoid(...MUZZLE, v => { if (v.y < 0) v.z *= 1 - .12 * ease(-v.y / MUZZLE[1]); }, 64, 48);
  const muzzleFur = addFur(head, muzzleGeo, furOpts(L.length.muzzle, {color: L.cream, tip: L.creamTip, root: .7, strand: .66, jaw: true,
    holes: [[0, NOSE_Y, surfZ(MUZZLE, 0, NOSE_Y), .07]]}), {x: MUZZLE_AT[0], y: MUZZLE_AT[1], z: MUZZLE_AT[2]}, {id: 1, strands: 1800, seed: 5, occ: [[0, 0, 0], [.26, .185, .175]]});
  muzzleFur.uniforms.uJaw.value.set(MOUTH_Y - .004, JAW_BLEND, 0, 1); muzzleFur.uniforms.uJawB.value.set(-3, -2.9, JAW_BACK);
  const muzzle = muzzleFur.group;
  const sat = satin(L.nose, 18);
  const noseGeo = new T.SphereGeometry(1, 40, 24); { const p = noseGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setXYZ(i, p.getX(i) * .082 * (1 + .32 * y), y * .052, p.getZ(i) * .036); } noseGeo.computeVertexNormals(); }
  const nose = mesh(muzzle, noseGeo, new T.MeshPhysicalMaterial({color: '#ffffff', map: sat.map, bumpMap: sat.bump, bumpScale: 2, roughness: .38, clearcoat: .3, clearcoatRoughness: .4, sheen: .6, sheenColor: new T.Color('#c99a85')}), 0, NOSE_Y, surfZ(MUZZLE, 0, NOSE_Y, -.008));
  nose.rotation.x = -.35;
  const thread = threadMat(L.thread);
  muzzle.add(tube([new T.Vector3(0, NOSE_Y - .045, 0), new T.Vector3(0, (NOSE_Y + MOUTH_Y) / 2 - .012, 0), new T.Vector3(0, MOUTH_Y + .002, 0)].map(v => (v.z = surfZ(MUZZLE, v.x, v.y, .006), v)), .0068, thread));
  const mouthMats = {
    cavity: new T.MeshStandardMaterial({color: L.mouth, roughness: .95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}),
    teeth: new T.MeshPhysicalMaterial({color: L.teeth, roughness: .85, sheen: .5, sheenColor: new T.Color('#ffffff'), polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4}),
    tongue: new T.MeshPhysicalMaterial({color: L.tongue, roughness: .8, sheen: .5, sheenColor: new T.Color('#ffd6da'), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3}),
    lip: thread,
  };
  const mouth = {group: group(muzzle), parts: [], state: null};

  // Glossy safety eyes, felt lids, happy-eye arcs and embroidered brows.
  const eyeMat = new T.MeshPhysicalMaterial({color: L.eye, roughness: .08, metalness: 0, clearcoat: 1, clearcoatRoughness: .03, envMapIntensity: 1.5});
  const glint = new T.MeshBasicMaterial({color: '#ffffff'});
  const lidMat = new T.MeshPhysicalMaterial({color: L.lid, roughness: .9, sheen: .9, sheenColor: new T.Color(L.tip), sheenRoughness: .5});
  const EYE = {r: .074, h: .08, d: .045};
  const eyes = [-1, 1].map(s => {
    const n = new T.Vector3(s * eyeX / HEAD[0] ** 2, eyeY / HEAD[1] ** 2, eyeZ / HEAD[2] ** 2).normalize();
    const holder = group(head, s * eyeX, eyeY, eyeZ - .012); holder.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), n);
    const ball = mesh(holder, new T.SphereGeometry(.072, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), eyeMat, 0, 0, 0, false);
    ball.rotation.x = Math.PI / 2; ball.scale.set(1, .62, 1.08); ball.userData.h = 1.08; // local y = depth, local z = height
    const spark = mesh(holder, new T.CircleGeometry(.017, 16), glint, -.022, .027, .047, false), spark2 = mesh(holder, new T.CircleGeometry(.008, 10), glint, .021, -.02, .046, false);
    const arc = tube(Array.from({length: 9}, (_, i) => { const a = Math.PI * (.12 + .76 * i / 8); return new T.Vector3(Math.cos(a) * .058, Math.sin(a) * .045 - .022, .03); }), .0115, thread);
    holder.add(arc); arc.visible = false;
    const lid = new T.Mesh(new T.BufferGeometry(), lidMat); lid.castShadow = false; holder.add(lid); lid.visible = false;
    const lash = new T.Mesh(new T.BufferGeometry(), thread); holder.add(lash); lash.visible = false;
    const brow = tube([new T.Vector3(-.055, -.006, 0), new T.Vector3(0, .012, 0), new T.Vector3(.055, -.004, 0)], .0085, thread);
    const browHolder = group(head, s * .2, browY, surfZ(HEAD, .2, browY, .016)); browHolder.add(brow); browHolder.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(s * .2 / HEAD[0] ** 2, browY / HEAD[1] ** 2, surfZ(HEAD, .2, browY) / HEAD[2] ** 2).normalize());
    dynamic.push(lid, lash);
    return {holder, ball, spark, spark2, arc, brow, browHolder, lid, lash, s};
  });

  // Arms: shoulder -> elbow -> paw with a felt pad. Two-bone IK in torso space.
  const padMat = feltMat(L.cream, 9), padStitch = threadMat('#cfae86');
  const ARM = {upper: .25, lower: .23};
  const arms = [-1, 1].map(s => {
    const shoulder = group(torso, s * .34, .24, .05);
    addFur(shoulder, limbGeometry(.112, .2, {tip: 1.02}), furOpts(L.length.arm), {}, {id: s < 0 ? 3 : 4, strands: 700, seed: s < 0 ? 31 : 32, occ: [[0, -.13, 0], [.125, .2, .125]]});
    const elbow = group(shoulder, 0, -ARM.upper, 0);
    addFur(elbow, limbGeometry(.118, .13, {tip: 1.14}), furOpts(L.length.arm, {holes: [[0, -.226, .111, .08]]}), {}, {id: s < 0 ? 5 : 6, strands: 800, seed: s < 0 ? 41 : 42, occ: [[0, -.14, 0], [.135, .19, .135]]});
    const pad = mesh(elbow, padShape(.07, .06, .018), padMat, 0, -.226, .118); pad.rotation.x = .61;
    stitchRing(pad, .058, .05, .016, 16, padStitch, {radius: .0035});
    return {shoulder, elbow, pad, s};
  });
  // Legs: from the hip forward along +z; a flat felt sole with stitches faces the camera.
  const legs = [-1, 1].map(s => {
    const hip = group(hop, s * .23, .17, .16); hip.rotation.order = 'YXZ';
    addFur(hip, limbGeometry(.148, .22, {tip: 1.1, cut: .35}), furOpts(L.length.leg, {holes: [[0, -.338, 0, .135]]}), {}, {id: s < 0 ? 7 : 8, strands: 1100, seed: s < 0 ? 51 : 52, occ: [[0, -.17, 0], [.165, .24, .165]]});
    const sole = group(hip, 0, -.336, 0); sole.rotation.x = Math.PI / 2;
    const pad = mesh(sole, padShape(.112, .125, .02), padMat, 0, 0, 0); stitchRing(pad, .1, .112, .018, 26, padStitch, {radius: .004});
    return {hip, sole, pad, s};
  });

  // ---- mouth --------------------------------------------------------------------------------
  // The opening is drawn in undeformed muzzle space and then dropped with the same jaw function as
  // the fur shader, so the lining, teeth, tongue and lips stay on the moving surface.
  const place = (x, y, off, jaw) => { const w = jawW(y) * jaw; return new T.Vector3(x, y - w, surfZ(MUZZLE, x, y, off) - w * JAW_BACK); };
  /** A strip between two curves over xs, subdivided in rows so the jaw drop bends it smoothly. */
  function strip(xs, hi, lo, off, jaw, rows = 10) {
    const pos = [], idx = [], C = xs.length;
    for (let r = 0; r <= rows; r++) for (const x of xs) { const a = hi(x), b = Math.min(a, lo(x)), v = place(x, a + (b - a) * r / rows, off, jaw); pos.push(v.x, v.y, v.z); }
    for (let r = 0; r < rows; r++) for (let i = 0; i < C - 1; i++) { const q = r * C + i; idx.push(q, q + C, q + 1, q + 1, q + C, q + C + 1); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
  }
  function addMouth(geometry, material) { const m = new T.Mesh(geometry, material); m.userData.mouthRole = Object.keys(mouthMats).find(k => mouthMats[k] === material); m.castShadow = false; m.receiveShadow = true; mouth.group.add(m); mouth.parts.push(m); return m; }
  function setMouth(shape = VISEMES.X, {smile = .35, smirk = 0, jaw: extraJaw = 0} = {}) {
    const key = shape.map(v => v.toFixed(4)).join(',') + `|${smile.toFixed(3)}|${smirk.toFixed(3)}|${extraJaw.toFixed(4)}`;
    if (key === mouth.state) return; mouth.state = key;
    for (const m of mouth.parts) { mouth.group.remove(m); m.geometry.dispose(); } mouth.parts = [];
    const [open0, width, round, tongue, jaw0, teeth, tongueUp, press, bite] = shape;
    const jaw = jaw0 + extraJaw, open = Math.max(0, open0), y0 = MOUTH_Y;
    muzzleFur.uniforms.uJaw.value.z = jaw; headFur.uniforms.uJaw.value.z = jaw;
    const w = width * (1 + smile * .1), half = w / 2;
    // Corners: a smile lifts both, a smirk lifts one side; pressing pulls them level.
    const sk = smirk * (1 - .75 * ease(open / .03));   // an open mouth stays level; the smirk shows in the corners when closed
    const cornerL = (smile * .028 + sk * .022) * (1 - press * .6) - round * .004, cornerR = (smile * .028 - sk * .022) * (1 - press * .6) - round * .004;
    const dip = .02 * (1 - round * .7) * (1 - press * .85);
    const N = 22, xs = Array.from({length: N + 1}, (_, i) => -half + w * i / N);
    const corner = x => (x < 0 ? cornerR : cornerL) * ease(Math.abs(x) / half);
    const lipR = .0074 * (1 + press * .55 + round * .7);
    if (open < .004) {
      // Closed: the embroidered omega line (rest) or a short level seam (pressed lips).
      const pts = xs.map(x => { const u = Math.abs(x) / half; return [x, y0 - dip * Math.sin(Math.min(1, u) * Math.PI) + corner(x)]; });
      addMouth(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(([x, y]) => place(x, y, .012, jaw))), 40, lipR, 6), mouthMats.lip);
      if (press > .3) { const pts2 = xs.filter((_, i) => i % 2 === 0).map(x => [x * .8, y0 - .011 * press + corner(x) * .5]);
        addMouth(new T.TubeGeometry(new T.CatmullRomCurve3(pts2.map(([x, y]) => place(x, y, .011, jaw))), 24, lipR * .75, 6), mouthMats.lip); }
      setHole(0, y0 - .004, half + .016, .022);
      return;
    }
    // Open: the omega flattens into an arched upper lip; the lower lip hangs below on the jaw.
    const ow = w * (1 - round * .2), oh = ow / 2, dipO = dip * (1 - ease(open / .022));
    const xo = Array.from({length: N + 1}, (_, i) => -oh + ow * i / N);
    const top = x => { const u = Math.min(1, Math.abs(x) / oh); return y0 - dipO * Math.sin(u * Math.PI) * (1 - round) + (round * .012 + .004) * (1 - u * u) + corner(x); };
    const pw = 2 - round * .6;    // outline exponent: 2 = ellipse, lower = rounder sides
    const bot = x => { const u = Math.min(1, Math.abs(x) / oh); return top(x) - open * Math.pow(Math.max(0, 1 - Math.pow(u, 2.2 - round)), 1 / pw) - .002; };
    addMouth(strip(xo, top, bot, .006, jaw), mouthMats.cavity);
    // Tongue: rests wide on the jaw, or rises narrow and tall to the teeth for L.
    if (tongue > .05 && open > .018) {
      const t0 = top(0), b0 = bot(0), span = t0 - b0;
      const up = tongueUp > .5, tw = oh * (up ? .4 : .5 + .2 * tongue), ty = up ? t0 - span * .45 : b0 + span * .2, th2 = span * (up ? .5 : .28) * (.75 + .25 * tongue);
      const xs2 = Array.from({length: 25}, (_, i) => tw * (Math.cos(Math.PI * (1 - i / 24)))), h = x => th2 * Math.sqrt(Math.max(0, 1 - (x / tw) ** 2));
      addMouth(strip(xs2, x => Math.min(top(x) - .001, ty + h(x)), x => Math.max(bot(x) + .001, ty - h(x)), .007, jaw, 8), mouthMats.tongue);
    }
    // Teeth: soft felt under the upper lip. Clenched (B): upper and lower rows with a dark seam.
    // Biting (G): the upper row covers the tucked lower lip.
    if (teeth > .05) {
      const tw = oh * (bite ? .8 : .86), xt = xo.filter(x => Math.abs(x) <= tw), taper = x => 1 - .3 * (Math.abs(x) / tw) ** 2;
      if (bite) {
        addMouth(strip(xt, x => top(x) - .001, x => bot(x) - .006 * taper(x), .009, 0), mouthMats.teeth);
      } else if (teeth > .9 && open < .04) {
        const mid = x => (top(x) + bot(x)) / 2, gap = .0035;
        addMouth(strip(xt, x => top(x) - .001, x => mid(x) + gap, .0085, 0), mouthMats.teeth);
        addMouth(strip(xt, x => mid(x) - gap, x => bot(x) + .001, .0085, jaw), mouthMats.teeth);
      } else {
        const th = Math.min(.024, Math.max(.01, open * .4)) * Math.min(1, teeth * 1.6);
        addMouth(strip(xt, x => top(x) - .001, x => top(x) - th * taper(x), .0085, 0), mouthMats.teeth);   // upper teeth stay with the upper jaw
      }
    }
    // Lips: the embroidered outline of the opening.
    const upper = xo.map(x => [x, top(x) + .001]);
    const ext = [[-half, top(-oh) + .002 + corner(-half) * .3], ...upper, [half, top(oh) + .002 + corner(half) * .3]];
    addMouth(new T.TubeGeometry(new T.CatmullRomCurve3(ext.map(([x, y]) => place(x, y, .012, 0))), 48, lipR, 6), mouthMats.lip);
    const lower = bite ? xo.filter((_, i) => i % 2 === 0).map(x => [x * .92, bot(x) - .007]) : xo.map(x => [x, bot(x) - .001]);
    addMouth(new T.TubeGeometry(new T.CatmullRomCurve3(lower.map(([x, y]) => place(x, y, .012, bite ? 0 : jaw))), 40, lipR * (round > .5 ? 1 : .85), 6), mouthMats.lip);
    setHole(0, (top(0) + bot(0)) / 2, oh + .02, (top(0) - bot(0)) / 2 + .026);
  }
  function setHole(x, y, rx, ry) { muzzleFur.uniforms.uMouthHole.value.set(x, y, rx, ry); }

  // ---- eyelids ------------------------------------------------------------------------------
  function setLid(e, amount, slant) {
    const vis = amount > .03; e.lid.visible = e.lash.visible = vis; if (!vis) return;
    const r = EYE.r * 1.07, h = EYE.h * 1.08, d = EYE.d * 1.3 + .006, N = 14, M = 12;
    const cut = x => h * (1 - 1.55 * amount) + slant * x;
    const pos = [], idx = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= M; i++) {
      const xr = -r + 2 * r * i / M, yTop = h * Math.sqrt(Math.max(0, 1 - (xr / r) ** 2)), y = yTop + (cut(xr) - yTop) * j / N, yy = Math.min(y, yTop);
      pos.push(xr, yy, d * Math.sqrt(Math.max(0, 1 - (xr / r) ** 2 - (yy / h) ** 2)) + .002);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < M; i++) { const a = j * (M + 1) + i, b = a + M + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    e.lid.geometry.dispose(); e.lid.geometry = geo;
    const edge = []; for (let i = 0; i <= M; i++) { const j = N * (M + 1) + i; edge.push(new T.Vector3(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2] + .002)); }
    const kept = edge.filter((v, i) => i === 0 || i === M || v.y < h * Math.sqrt(Math.max(0, 1 - (v.x / r) ** 2)) - .002);
    e.lash.geometry.dispose(); e.lash.geometry = kept.length > 2 ? new T.TubeGeometry(new T.CatmullRomCurve3(kept), 20, .0055, 5) : new T.BufferGeometry();
  }

  // ---- pose ---------------------------------------------------------------------------------
  const tmp = {a: new T.Vector3(), b: new T.Vector3(), down: new T.Vector3(0, -1, 0), q1: new T.Quaternion(), q2: new T.Quaternion()};
  function aim(arm, target, pole) {
    const S = arm.shoulder.position, P = tmp.a.set(...target).sub(S), d = Math.min(ARM.upper + ARM.lower - .002, Math.max(.05, P.length())), dir = P.normalize();
    const side = tmp.b.set(...pole).addScaledVector(dir, -tmp.b.set(...pole).dot(dir)).normalize();
    const along = (ARM.upper ** 2 - ARM.lower ** 2 + d * d) / (2 * d), bend = Math.sqrt(Math.max(0, ARM.upper ** 2 - along * along));
    const upper = dir.clone().multiplyScalar(along).addScaledVector(side, bend), lower = dir.clone().multiplyScalar(d).sub(upper);
    tmp.q1.setFromUnitVectors(tmp.down, upper.normalize()); tmp.q2.setFromUnitVectors(tmp.down, lower.normalize());
    arm.shoulder.quaternion.copy(tmp.q1); arm.elbow.quaternion.copy(tmp.q1.clone().invert().multiply(tmp.q2));
  }
  const REST_ARMS = [[-.5, -.12, .2], [.5, -.12, .2]], REST_POLE = s => [s * .4, .3, -1];

  /**
   * Apply a pose. Every key is optional:
   *   hop, squash (+ flattens, - stretches), lean, tilt, twist, turn, x, z
   *   head {nod, turn, roll}; ears [{perk, flop, back}, ...] ([0] = bear's right, -x)
   *   arms [{target:[x,y,z], palm:[x,y,z], pole, twist}, ...] in torso space; legs [{lift, spread}, ...]
   *   face {blink, happy, wink, surprise, squint, lid, lidAsym, lidSlant, brow, worry, browTilt, blush,
   *         smile, smirk, jaw, gazeX, gazeY, mouth: VISEMES.D (or a blend of the arrays)}
   *   soft (secondary motion from softMotion())
   */
  function pose(p = {}) {
    const f = p.face || {};
    root.position.set(p.x || 0, 0, p.z || 0); root.rotation.y = p.turn || 0;
    hop.position.y = Math.max(0, p.hop || 0);
    const sq = p.squash || 0; body.scale.set(1 + sq * .5, 1 - sq, 1 + sq * .5);
    body.rotation.set(p.lean || 0, p.twist || 0, p.tilt || 0);
    const h = p.head || {}; neck.rotation.set(h.nod || 0, h.turn || 0, h.roll || 0, 'YXZ');
    ears.forEach((e, i) => { const k = p.ears?.[i] || {}, s = i ? 1 : -1; e.pivot.rotation.set(-(k.perk || 0) * .5 + (k.back || 0) * .4, 0, -s * (.55 + (k.flop || 0) * .6)); });
    applySoft(F.soft ? p.soft : null);
    arms.forEach((arm, i) => {
      const a = p.arms?.[i]; aim(arm, a?.target || REST_ARMS[i], a?.pole || REST_POLE(arm.s));
      // Twist the forearm about its own axis so the felt palm faces `palm` (torso space).
      const q = arm.shoulder.quaternion.clone().multiply(arm.elbow.quaternion), d = new T.Vector3(...(a?.palm || [0, 0, 1])).applyQuaternion(q.invert());
      arm.elbow.rotateY(Math.atan2(d.x, d.z) + (a?.twist || 0));
    });
    legs.forEach((leg, i) => { const l = p.legs?.[i] || {}; leg.hip.rotation.set(-Math.PI / 2 + .1 + (l.lift || 0), leg.s * (.36 + (l.spread || 0)), 0); });
    // Face.
    const blink = clamp(f.blink || 0), happy = clamp(f.happy || 0);
    eyes.forEach((e, i) => {
      const open = (1 - blink) * (1 - happy) * (1 + (f.surprise || 0) * .18) * (1 - (f.squint || 0) * .35);
      e.ball.scale.set(1 + (f.surprise || 0) * .08, .62, e.ball.userData.h * Math.max(.04, open)); e.ball.visible = open > .03;
      const lid = clamp((f.lid || 0) + (f.lidAsym || 0) * (i ? 1 : -1) * .5) * (open > .2 ? 1 : 0);
      e.spark.visible = e.spark2.visible = open > .45 && lid < .5; e.spark.position.set(-.022 + (f.gazeX || 0) * .012, .027 * Math.max(.4, open) + (f.gazeY || 0) * .008, .047);
      e.spark2.position.set(.021 + (f.gazeX || 0) * .008, -.02 + (f.gazeY || 0) * .006, .046);
      e.arc.visible = happy > .5; e.arc.scale.set(1, .6 + .4 * happy, 1);
      headFur.uniforms.uHoles.value[i].w = .088 * Math.max(.3, Math.min(1, open * 1.6));   // fur closes over a shut eye
      if (f.wink !== undefined && i === 1) { const w = clamp(f.wink); e.ball.visible = w < .5 && open > .03; e.arc.visible = w >= .5 || happy > .5; if (w >= .5) { headFur.uniforms.uHoles.value[i].w = .088 * .3; e.spark.visible = e.spark2.visible = false; } }
      setLid(e, e.ball.visible ? lid : 0, (f.lidSlant || 0) * e.s * -.5);
      const lift = (f.brow || 0) * .045 - lid * .012, worry = (f.worry || 0) * .38 * -e.s;
      e.browHolder.position.y = browY + lift + (f.browTilt || 0) * e.s * .018; e.brow.rotation.z = worry + (f.browTilt || 0) * e.s * .25;
    });
    for (const fp of [headFur]) { const u = fp.uniforms.uPatchAmt.value; u[0] = u[1] = Math.min(1, L.blushAmount + (f.blush || 0)); }
    setMouth(f.mouth || VISEMES.X, {smile: f.smile ?? .35, smirk: f.smirk || 0, jaw: f.jaw || 0});
  }

  // ---- soft plush: ear lag and surface deformers (cheeks, belly, squeeze dents) ---------------
  function setDef(part, i, c, r, d = [0, 0, 0], push = 0) { const u = part.uniforms; u.uDefC.value[i].set(c[0], c[1], c[2], r); u.uDefD.value[i].set(d[0], d[1], d[2], push); }
  function applySoft(s) {
    for (const fp of [headFur, bodyFur]) for (let i = 0; i < MAX_DEF; i++) fp.uniforms.uDefC.value[i].w = 0;
    if (!s) return;
    ears.forEach((e, i) => { const k = s.ears?.[i]; if (k) { e.pivot.rotation.x += k.x || 0; e.pivot.rotation.z += k.z || 0; } });
    for (const sgn of [-1, 1]) setDef(headFur, sgn < 0 ? 0 : 1, [sgn * .3, -.16, .37], .14, [sgn * .004 * (s.cheek || 0), 0, 0], .026 * (s.cheek || 0));
    setDef(bodyFur, 0, [0, -.12, .32], .24, [0, .03 * (s.belly || 0), 0], .018 * (s.bellyPush || 0) + .03 * (s.hug || 0));   // belly squeezed out below the arms
    const hug = s.hug || 0;
    for (const sgn of [-1, 1]) {
      setDef(bodyFur, sgn < 0 ? 1 : 2, [sgn * .1, .08, .36], .13, [0, 0, 0], -.045 * hug);
      setDef(bodyFur, sgn < 0 ? 3 : 4, [sgn * .4, -.08, .08], .2, [sgn * .012 * hug, 0, 0], .02 * hug);
    }
  }
  /** World-space ellipsoid occluders for contact occlusion: call after the world matrices are updated. */
  const occM = new T.Matrix4(), occV = new T.Vector3();
  function updateOcclusion() {
    const M = shared.uOccM.value, C = shared.uOccC.value; let n = 0;
    for (const o of occluders) {
      if (n >= M.length) break;
      occM.makeTranslation(...o.center).scale(occV.set(...o.radii)).premultiply(o.obj.matrixWorld);
      M[n].copy(occM).invert(); occV.set(...o.center).applyMatrix4(o.obj.matrixWorld); C[n].set(occV.x, occV.y, occV.z, o.id); n++;
    }
    for (; n < M.length; n++) C[n].w = -1;
  }
  /** Set the world-space fur force (gravity + motion drag) for every furry part. Reserved for any fur solver. */
  function setFurForce(fn) { for (const fp of furParts) fp.uniforms.uForce.value.copy(fn(fp)); }
  /** A path drawn through the belly pile: points [[x,y,z,t]...] in torso space (t = when drawn), now, radius, strength. */
  function setBrush(points = [], {now = 0, radius = .05, strength = 1} = {}) {
    const u = bodyFur.uniforms, n = Math.min(points.length, MAX_BRUSH);
    for (let i = 0; i < MAX_BRUSH; i++) { const p = points[Math.min(i, n - 1)]; if (p && i < n) u.uBrushP.value[i].set(p[0], p[1], p[2], p[3]); else u.uBrushP.value[i].set(0, 0, 0, 1e6); }
    u.uBrush.value.set(radius, strength, now, n);
  }
  pose({});
  return {root, torso, head, neck, muzzle, mouth: mouth.group, ears, eyes, arms, legs, furParts, look: L, features: F, shared, occluders, updateOcclusion, visemes: VISEMES, pose, setMouth, setFurForce, setBrush,
    dispose() { root.traverse(o => { o.geometry?.dispose(); const ms = o.material ? [].concat(o.material) : []; ms.forEach(m => { for (const k of ['map', 'bumpMap', 'alphaMap']) m[k]?.dispose(); m.dispose(); }); }); disposables.forEach(d => d.dispose()); }};
}

/**
 * Plush secondary motion as a pure function of time: each channel is the performance passed through
 * a damped spring, evaluated as a convolution over the last 1.2 s of `performance(t)`. Any frame
 * can be rendered on its own; no state is carried from the previous frame.
 */
export function softMotion(performance, {window = 1.2, dt = 1 / 60} = {}) {
  const N = Math.round(window / dt);
  function kernel(f, zeta) {
    const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - zeta * zeta), h = []; let sum = 0;
    for (let k = 0; k <= N; k++) { const v = Math.exp(-zeta * w * k * dt) * Math.sin(wd * k * dt); h.push(v); sum += v; }
    return h.map(v => v / sum);
  }
  const KS = {ear: kernel(2.4, .2), belly: kernel(3.2, .22), cheek: kernel(5.5, .4), hug: kernel(2.6, .28), head: kernel(2.8, .3)};
  const cache = new Map();
  function drivers(tau) {
    tau = Math.max(0, tau); const key = tau.toFixed(5); let d = cache.get(key); if (d) return d;
    const p = performance(tau), h = p.head || {}, m = p.face?.mouth || VISEMES.X, open = (m[0] + m[4]) / .155;
    d = [(h.roll || 0) + (p.tilt || 0), (h.nod || 0) + (p.lean || 0), (p.hop || 0) - .9 * (p.squash || 0), open * (.75 + .5 * m[2]), p.drive?.squeeze || 0];
    cache.set(key, d); return d;
  }
  return function softAt(t) {
    if (cache.size > 4000) cache.clear();
    const D = Array.from({length: N + 1}, (_, k) => drivers(t - k * dt));
    const filt = (K, j) => { let y = 0; for (let k = 0; k <= N; k++) y += K[k] * D[k][j]; return y; };
    const lag = (K, j) => filt(K, j) - D[0][j];
    const roll = lag(KS.ear, 0), nod = lag(KS.ear, 1), vert = lag(KS.ear, 2), bv = lag(KS.belly, 2);
    return {
      ears: [-1, 1].map(s => ({z: 2.2 * roll - s * 2.6 * vert, x: 1.6 * nod - 1.4 * vert})),
      belly: 7 * bv, bellyPush: -5 * bv, cheek: Math.max(0, filt(KS.cheek, 3)), hug: filt(KS.hug, 4), headNod: 1.1 * lag(KS.head, 2),
    };
  };
}

/**
 * Pose the bear for time t from a performance function, with fur that trails its motion: each
 * part's velocity is measured against the pose 50 ms earlier (also a function of t) and the fur is
 * pushed the other way, plus gravity and an optional extra force (a gust, a shake).
 */
export function animator(bear, performance, {gravity = .38, drag = .45, extra = null} = {}) {
  const soft = bear.features.soft ? softMotion(performance) : null;
  const full = t => { const p = performance(t); if (soft) { p.soft = soft(t); p.head = p.head || {}; p.head.nod = (p.head.nod || 0) + p.soft.headNod; } return p; };
  const prev = new Map(), G = new T.Vector3(0, -gravity, 0), v = new T.Vector3();
  return function poseAt(t) {
    bear.pose(full(Math.max(0, t - .05))); bear.root.updateMatrixWorld(true);
    for (const fp of bear.furParts) prev.set(fp, fp.group.getWorldPosition(new T.Vector3()));
    const p = full(t); bear.pose(p); bear.root.updateMatrixWorld(true);
    const add = extra?.(t, p);
    bear.setFurForce(fp => { fp.group.getWorldPosition(v); v.sub(prev.get(fp)).multiplyScalar(-1 / .05 * drag); v.clampLength(0, .9); v.add(G); if (add) v.add(add); return v; });
    if (bear.features.shadow) bear.updateOcclusion();
    return p;
  };
}
