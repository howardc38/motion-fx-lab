// Geometry, material presets, microfinish textures and studio environment adapted from
// AirsupHQ/machine-skill, e0bd066ac5beaf48512935de2fc0f0e55636853a (MIT).
// Copyright (c) 2026 Air Supply Technologies Inc. (Airsup). See NOTICE and LICENSE-MIT.txt.
// The UI, runtime clock, dynamics, camera and section-cap implementation are not included.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
export {THREE};
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const lerp = (a, b, t) => a + (b - a) * t
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
export const ease = {
  lin: (t) => t,
  io: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  expo: (t) => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  back: (t) => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2) },
}
/** first order lag toward target with time constant tau (s): spool-up, thermal mass, filters */
export const approach = (v, target, tau, dt) => target + (v - target) * Math.exp(-dt / Math.max(1e-6, tau))
/** piecewise linear table lookup: xs ascending */
export function table(xs, ys, x) {
  if (x <= xs[0]) return ys[0]
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return lerp(ys[i - 1], ys[i], (x - xs[i - 1]) / (xs[i] - xs[i - 1]))
  return ys[ys.length - 1]
}
/** one RK4 step of dy/dt = f(t, y) for an array state */
export function rk4(f, t, y, h) {
  const add = (a, b, k) => a.map((v, i) => v + b[i] * k)
  const k1 = f(t, y), k2 = f(t + h / 2, add(y, k1, h / 2)), k3 = f(t + h / 2, add(y, k2, h / 2)), k4 = f(t + h, add(y, k3, h))
  return y.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
}
/** number formatting with thin grouping: fmt(144712) = "144,712", fmt(3.14159, 2) = "3.14" */
export function fmt(v, digits = 0) {
  if (!isFinite(v)) return '--'
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
/** seeded random, so films are deterministic */
export function rng(seed = 1) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }
/** blackbody colour (approximate, linear rgb) for a temperature in kelvin */
export function blackbody(T) {
  const t = clamp(T, 800, 12000) / 100
  let r, g, b
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04 }
  else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255 }
  return new THREE.Color(clamp(r / 255), clamp(g / 255), clamp(b / 255)).convertSRGBToLinear()
}

// ---------------------------------------------------------------- procedural textures

function canvasTex(size, draw, { repeat = [1, 1], color = false } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size
  const g = c.getContext('2d'); draw(g, size)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 8
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  return t
}
const TEX = {}
function tex(kind) {
  if (TEX[kind]) return TEX[kind]
  const R = rng(kind.length * 977)
  const S = 512
  const make = {
    // turning marks: fine rings along v (lathe u wraps around the axis, so rings run circumferentially)
    turned: (g) => { g.fillStyle = '#808080'; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y++) { const v = 112 + R() * 40 + Math.sin(y * 0.9) * 10; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, S, 1) } },
    // brushed: long streaks along u
    brushed: (g) => { g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, S, S); for (let i = 0; i < 2600; i++) { const v = 90 + R() * 80; g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.fillRect(R() * S, R() * S, 30 + R() * 220, 1) } },
    // cast / bead blasted: soft blotches plus grain
    cast: (g) => { g.fillStyle = '#808080'; g.fillRect(0, 0, S, S); for (let i = 0; i < 380; i++) { const v = 100 + R() * 60, r = 6 + R() * 40; const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, `rgba(${v},${v},${v},0.25)`); gr.addColorStop(1, 'rgba(128,128,128,0)'); g.save(); g.translate(R() * S, R() * S); g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r); g.restore() } const d = g.getImageData(0, 0, S, S); for (let i = 0; i < d.data.length; i += 4) { const n = (R() - 0.5) * 26; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n } g.putImageData(d, 0, 0) },
    // carbon twill weave (colour)
    carbon: (g) => { const n = 16, w = S / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const on = ((i + j) >> 1) % 2 === 0; const gr = on ? g.createLinearGradient(i * w, 0, i * w + w, 0) : g.createLinearGradient(0, j * w, 0, j * w + w); gr.addColorStop(0, '#0d0e10'); gr.addColorStop(0.5, on ? '#3a3d42' : '#2a2c30'); gr.addColorStop(1, '#0d0e10'); g.fillStyle = gr; g.fillRect(i * w, j * w, w, w) } },
    // knurl diamonds (bump)
    knurl: (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.strokeStyle = '#fff'; g.lineWidth = 6; for (let i = -S; i < 2 * S; i += 24) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke(); g.beginPath(); g.moveTo(i, S); g.lineTo(i + S, 0); g.stroke() } },
    // smudges and dust for glossy parts
    smudge: (g) => { g.fillStyle = '#4a4a4a'; g.fillRect(0, 0, S, S); for (let i = 0; i < 90; i++) { const r = 10 + R() * 60, v = 70 + R() * 50; const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, `rgba(${v},${v},${v},0.3)`); gr.addColorStop(1, 'rgba(74,74,74,0)'); g.save(); g.translate(R() * S, R() * S); g.scale(1, 0.4 + R()); g.fillStyle = gr; g.fillRect(-r, -r, 2 * r, 2 * r); g.restore() } },
  }[kind]
  TEX[kind] = canvasTex(S, make, { color: kind === 'carbon' })
  return TEX[kind]
}


export const MAT = {
  steel: (o) => mat({ color: [0.56, 0.57, 0.58], metalness: 1, roughness: 0.3, finish: 'turned', ...o }),
  steelDark: (o) => mat({ color: [0.24, 0.245, 0.25], metalness: 1, roughness: 0.42, finish: 'cast', ...o }),
  stainless: (o) => mat({ color: [0.67, 0.66, 0.64], metalness: 1, roughness: 0.2, finish: 'brushed', ...o }),
  chrome: (o) => mat({ color: [0.78, 0.79, 0.8], metalness: 1, roughness: 0.06, finish: null, ...o }),
  aluminium: (o) => mat({ color: [0.88, 0.89, 0.9], metalness: 1, roughness: 0.38, finish: 'cast', ...o }),
  aluminiumMachined: (o) => mat({ color: [0.9, 0.9, 0.91], metalness: 1, roughness: 0.22, finish: 'turned', ...o }),
  anodised: (o) => mat({ color: o?.color ?? [0.08, 0.09, 0.1], metalness: 0.85, roughness: 0.34, finish: 'cast', clearcoat: 0.2, ...o }),
  titanium: (o) => mat({ color: [0.54, 0.5, 0.45], metalness: 1, roughness: 0.32, finish: 'brushed', ...o }),
  inconel: (o) => mat({ color: [0.47, 0.44, 0.41], metalness: 1, roughness: 0.42, finish: 'cast', ...o }),
  copper: (o) => mat({ color: [0.95, 0.64, 0.54], metalness: 1, roughness: 0.28, finish: 'turned', ...o }),
  brass: (o) => mat({ color: [0.91, 0.78, 0.42], metalness: 1, roughness: 0.24, finish: 'turned', ...o }),
  gold: (o) => mat({ color: [1.0, 0.77, 0.34], metalness: 1, roughness: 0.18, finish: 'brushed', ...o }),
  bluedSteel: (o) => mat({ color: [0.08, 0.16, 0.5], metalness: 1, roughness: 0.16, finish: null, ...o }),
  castIron: (o) => mat({ color: [0.3, 0.3, 0.3], metalness: 0.9, roughness: 0.62, finish: 'cast', ...o }),
  paint: (o) => mat({ color: o?.color ?? [0.8, 0.8, 0.8], metalness: 0, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2, finish: 'smudge', ...o }),
  satin: (o) => mat({ color: o?.color ?? [0.04, 0.04, 0.045], metalness: 0, roughness: 0.55, finish: 'cast', ...o }),
  plastic: (o) => mat({ color: o?.color ?? [0.05, 0.05, 0.055], metalness: 0, roughness: 0.42, finish: 'cast', ...o }),
  rubber: (o) => mat({ color: [0.025, 0.025, 0.027], metalness: 0, roughness: 0.82, finish: 'cast', ...o }),
  ceramic: (o) => mat({ color: [0.82, 0.8, 0.76], metalness: 0, roughness: 0.5, finish: 'cast', ...o }),
  carbon: (o) => mat({ color: [1, 1, 1], map: tex('carbon'), metalness: 0.2, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.05, finish: null, rep: [6, 6], ...o }),
  glass: (o) => mat({ color: [1, 1, 1], metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.004, ior: 1.5, transparent: true, finish: null, noCap: true, ...o }),
  sapphire: (o) => mat({ color: [0.96, 0.97, 1], metalness: 0, roughness: 0.0, transmission: 1, thickness: 0.002, ior: 1.77, transparent: true, finish: null, noCap: true, ...o }),
  ruby: (o) => mat({ color: [0.9, 0.08, 0.15], metalness: 0, roughness: 0.05, transmission: 0.6, thickness: 0.001, ior: 1.77, finish: null, ...o }),
  enamel: (o) => mat({ color: [0.93, 0.92, 0.88], metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, finish: null, ...o }),
  fluid: (o) => mat({ color: o?.color ?? [0.3, 0.12, 0.05], metalness: 0, roughness: 0.08, clearcoat: 1, finish: null, ...o }),
  glow: (o) => mat({ color: [0, 0, 0], emissive: o?.emissive ?? [1, 0.5, 0.15], emissiveIntensity: o?.emissiveIntensity ?? 4, metalness: 0, roughness: 1, finish: null, ...o }),
}

function col(c) { return Array.isArray(c) ? new THREE.Color(c[0], c[1], c[2]) : new THREE.Color(c) }

/** build a material from a preset description (see MAT) */
export function mat(o) {
  const { finish, rep, cap, noCap, capRough, color, emissive, ...rest } = o
  const m = new THREE.MeshPhysicalMaterial({ ...rest })
  m.color = col(color ?? [0.8, 0.8, 0.8])
  if (emissive !== undefined) m.emissive = col(emissive)
  if (finish) {
    const t = tex(finish).clone(); t.needsUpdate = true
    t.repeat.set(...(rep ?? (finish === 'turned' ? [1, 24] : finish === 'brushed' ? [2, 6] : [3, 3])))
    m.roughnessMap = t
    if (finish === 'knurl') { m.bumpMap = t; m.bumpScale = 0.6 }
  }
  m.envMapIntensity = rest.envMapIntensity ?? 1;
  m.side = THREE.DoubleSide;
  return m;
}

export const GEO = {
  /**
   * closed solid of revolution around +Y from [r, y] points (a closed profile; the last point joins the first).
   * Any winding works (it is made counter clockwise so faces point out), and corners sharper than
   * `crease` degrees stay crisp while gentle curves shade smooth.
   */
  lathe(pts, seg = 96, { crease = 32, phi0 = 0, phiLen = Math.PI * 2 } = {}) {
    let p = pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y))
    if (p[0].distanceTo(p[p.length - 1]) < 1e-9) p.pop()
    let area = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; area += a.x * b.y - b.x * a.y }
    if (area < 0) p.reverse()
    // start at a crease (the open start and end of the profile then shade separately, as they should),
    // and duplicate every other crease point so each side gets its own normal (zero length segments add no area)
    const cosT = Math.cos(THREE.MathUtils.degToRad(crease)), n0 = p.length
    const isCrease = (i) => { const a = p[(i - 1 + n0) % n0], b = p[i], c = p[(i + 1) % n0]; return b.clone().sub(a).normalize().dot(c.clone().sub(b).normalize()) < cosT }
    let s0 = 0; for (let i = 0; i < n0; i++) if (isCrease(i)) { s0 = i; break }
    p = [...p.slice(s0), ...p.slice(0, s0)]
    const out = [p[0].clone()]
    for (let i = 1; i < n0; i++) { out.push(p[i].clone()); if (isCrease(i)) out.push(p[i].clone()) }
    out.push(p[0].clone())
    const g = new THREE.LatheGeometry(out, seg, phi0, phiLen)
    g.computeVertexNormals()
    if (phiLen >= Math.PI * 2 - 1e-6) {
      // weld the seam normals
      const n = g.attributes.normal, P = out.length
      for (let j = 0; j < P; j++) { const a = j, b = seg * P + j; const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize(); n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z) }
    }
    return g
  },
  /**
   * a wall of thickness t following an open profile [[r, y], ...] (a nozzle, a casing, a cowl):
   * the outer line, then the same line offset inward, closed at both ends. Real solids cut cleanly.
   */
  shell(pts, t, seg = 96, inward = true) {
    const out = pts.map((p) => new THREE.Vector2(p[0], p[1]))
    const inn = out.map((p, i) => {
      const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)]
      const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1
      const nx = ty / l, ny = -tx / l // outward normal for a profile running in +y
      const s = inward ? -1 : 1
      return new THREE.Vector2(Math.max(0, p.x + s * nx * t), p.y + s * ny * t)
    })
    return GEO.lathe([...out.map((v) => [v.x, v.y]), ...inn.reverse().map((v) => [v.x, v.y])], seg)
  },
  /** hollow cylinder along +Y */
  tube(rOut, rIn, h, seg = 96, y0 = -h / 2) {
    return GEO.lathe([[rIn, y0], [rOut, y0], [rOut, y0 + h], [rIn, y0 + h]], seg)
  },
  /** cylinder with chamfered edges along +Y */
  disc(r, h, ch = Math.min(r, h) * 0.08, seg = 96, rIn = 0) {
    return GEO.lathe([[rIn, -h / 2], [r - ch, -h / 2], [r, -h / 2 + ch], [r, h / 2 - ch], [r - ch, h / 2], [rIn, h / 2]], seg)
  },
  rbox(w, h, d, r = Math.min(w, h, d) * 0.08, s = 4) { return new RoundedBoxGeometry(w, h, d, s, r) },
  /** spur or helical gear around +Z, with an involute-like tooth (enough for a convincing mesh), centred on z */
  gear({ teeth = 24, module = 0.002, width = 0.008, bore = 0, helix = 0, rim = 0, spokes = 0 } = {}) {
    const rp = (teeth * module) / 2, ra = rp + module, rf = rp - 1.25 * module
    const da = (Math.PI * 2) / teeth, steps = 6
    // half tooth width (as a fraction of the angular pitch) from root to tip: convex, involute-like flank
    const hw = (r) => da * lerp(0.31, 0.13, Math.pow(clamp((r - rf) / (ra - rf)), 0.85))
    const pts = []
    for (let i = 0; i < teeth; i++) {
      const c = (i + 0.5) * da
      pts.push([rf, i * da])
      for (let k = 0; k <= steps; k++) { const r = lerp(rf, ra, k / steps); pts.push([r, c - hw(r)]) }
      for (let k = 1; k < 3; k++) pts.push([ra, c - hw(ra) + (2 * hw(ra) * k) / 3])
      for (let k = steps; k >= 0; k--) { const r = lerp(rf, ra, k / steps); pts.push([r, c + hw(r)]) }
    }
    const sh = new THREE.Shape()
    pts.forEach(([r, a], k) => { const x = r * Math.cos(a), y = r * Math.sin(a); k ? sh.lineTo(x, y) : sh.moveTo(x, y) })
    sh.closePath()
    if (bore > 0) { const h = new THREE.Path(); h.absarc(0, 0, bore, 0, Math.PI * 2, true); sh.holes.push(h) }
    if (spokes > 0 && rim > 0) {
      const ri = rf - rim, rh = Math.max(bore * 1.9, rp * 0.28)
      for (let s = 0; s < spokes; s++) {
        const w = 0.22 * (rp / Math.max(ri, 1e-6))
        const a0 = (s / spokes) * Math.PI * 2 + w, a1 = ((s + 1) / spokes) * Math.PI * 2 - w
        const h = new THREE.Path(); h.absarc(0, 0, ri, a0, a1, false); h.absarc(0, 0, rh, a1 - w * 0.4, a0 + w * 0.4, true); h.closePath(); sh.holes.push(h)
      }
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: true, bevelThickness: module * 0.15, bevelSize: module * 0.12, bevelSegments: 2, curveSegments: 24, steps: helix ? 6 : 1 })
    g.translate(0, 0, -width / 2)
    if (helix) {
      const p = g.attributes.position
      for (let i = 0; i < p.count; i++) { const z = p.getZ(i), a = (z / width) * helix, x = p.getX(i), y = p.getY(i); p.setXY(i, x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)) }
      g.computeVertexNormals()
    }
    g.userData.pitchRadius = rp
    return g
  },
  /**
   * one blade as a closed cambered, twisted airfoil solid, spanning radius r0..r1 along +Y,
   * chord along the axis (Z) by default. twist in rad root to tip, chord can be [root, tip].
   */
  blade({ r0 = 0.1, r1 = 0.5, chord = 0.08, thick = 0.08, camber = 0.06, twist = 0.6, pitch = 0.4, sweep = 0, nS = 14, nC = 16, lean = 0 } = {}) {
    const c0 = Array.isArray(chord) ? chord[0] : chord, c1 = Array.isArray(chord) ? chord[1] : chord
    const pos = [], idx = []
    const ring = nC * 2
    for (let s = 0; s <= nS; s++) {
      const u = s / nS, r = lerp(r0, r1, u), c = lerp(c0, c1, u), ang = pitch + twist * (u - 0.5) * -1
      const tk = Array.isArray(thick) ? lerp(thick[0], thick[1], u) : thick, cb = Array.isArray(camber) ? lerp(camber[0], camber[1], u) : camber
      for (let k = 0; k < ring; k++) {
        const top = k < nC, j = top ? k : ring - 1 - k, x = j / (nC - 1) // 0 leading .. 1 trailing
        const th = 5 * tk * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4)
        const yc = 4 * cb * x * (1 - x)
        const yy = (yc + (top ? th : -th)) * c, xx = (x - 0.35) * c
        // rotate the section by the blade angle in the chord plane (z = axial, x = tangential)
        const z = xx * Math.cos(ang) - yy * Math.sin(ang) + sweep * u * u
        const tx = xx * Math.sin(ang) + yy * Math.cos(ang) + lean * u * u
        pos.push(tx, r, z)
      }
    }
    for (let s = 0; s < nS; s++) for (let k = 0; k < ring; k++) {
      const a = s * ring + k, b = s * ring + ((k + 1) % ring), c = a + ring, d = b + ring
      idx.push(a, c, b, b, c, d)
    }
    // end caps
    const cap = (s, flip) => { const base = s * ring, cIdx = pos.length / 3; let cx = 0, cy = 0, cz = 0; for (let k = 0; k < ring; k++) { cx += pos[(base + k) * 3]; cy += pos[(base + k) * 3 + 1]; cz += pos[(base + k) * 3 + 2] } pos.push(cx / ring, cy / ring, cz / ring); for (let k = 0; k < ring; k++) { const a = base + k, b = base + ((k + 1) % ring); flip ? idx.push(cIdx, b, a) : idx.push(cIdx, a, b) } }
    cap(0, false); cap(nS, true)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx)
    g.computeVertexNormals()
    // uv: span along v, chord along u
    const uv = []; for (let i = 0; i < pos.length / 3; i++) uv.push((i % ring) / ring, Math.floor(i / ring) / nS)
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    return g
  },
  /**
   * a bladed row: n blades around an axis. axis 'z' = blades radial in XY, chord along Z.
   * axis 'y' = blades radial in XZ, chord along Y (an engine built along Y). Same options as blade().
   */
  rotor({ count = 24, axis = 'y', phase = 0, ...b } = {}) {
    const one = GEO.blade(b)
    if (axis === 'y') one.applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1))
    if (axis === 'x') one.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1))
    return count === 1 ? one : GEO.ring(one, count, axis, phase)
  },
  /** volume (m3) and centroid of a closed mesh: for real masses (m = rho V) and inertias */
  volume(geo) {
    const p = geo.attributes.position, idx = geo.index ? geo.index.array : null, n = idx ? idx.length : p.count
    let V = 0; const c = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3()
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx[i] : i, i1 = idx ? idx[i + 1] : i + 1, i2 = idx ? idx[i + 2] : i + 2
      a.fromBufferAttribute(p, i0); b.fromBufferAttribute(p, i1); d.fromBufferAttribute(p, i2)
      const v = a.dot(b.clone().cross(d)) / 6; V += v
      c.addScaledVector(a.clone().add(b).add(d), v / 4)
    }
    return { V: Math.abs(V), centroid: c.divideScalar(V || 1) }
  },
  /** n copies of a geometry rotated around an axis ('y' or 'z'), merged */
  ring(geo, n, axis = 'z', phase = 0) {
    const out = []
    for (let i = 0; i < n; i++) { const g = geo.clone(); const m = new THREE.Matrix4(); const a = phase + (i / n) * Math.PI * 2; axis === 'y' ? m.makeRotationY(a) : axis === 'x' ? m.makeRotationX(a) : m.makeRotationZ(a); g.applyMatrix4(m); out.push(g) }
    return BGU.mergeGeometries(out)
  },
  merge(list) { return BGU.mergeGeometries(list.map((g) => g.index ? g.toNonIndexed() : g)) },
  /** a pipe through points (closed solid wall, ends capped) */
  pipe(points, r, { seg = 64, radial = 16, tension = 0.5 } = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', tension)
    const g = new THREE.TubeGeometry(curve, seg, r, radial, false)
    // cap both ends so the pipe is a closed solid
    const caps = []
    for (const [t, s] of [[0, -1], [1, 1]]) {
      const c = new THREE.CircleGeometry(r, radial)
      const tan = curve.getTangentAt(t).multiplyScalar(s)
      c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan))
      c.translate(...curve.getPointAt(t).toArray())
      caps.push(c)
    }
    const m = GEO.merge([g, ...caps]); m.userData.curve = curve
    return m
  },
  /** hex bolt heads (or socket caps) on a circle around +Y at height y, merged */
  bolts(n, R, size, h, { y = 0, socket = false, phase = 0 } = {}) {
    const one = socket ? GEO.lathe([[0, 0], [size, 0], [size, h * 0.9], [size * 0.92, h], [size * 0.45, h], [size * 0.45, h * 0.55], [0, h * 0.55]], 24) : new THREE.CylinderGeometry(size, size, h, 6).translate(0, h / 2, 0)
    const out = []
    for (let i = 0; i < n; i++) { const a = phase + (i / n) * Math.PI * 2; out.push(one.clone().translate(R * Math.cos(a), y, R * Math.sin(a))) }
    return GEO.merge(out)
  },
  /** coil spring along +Y */
  spring(R, wire, turns, len, seg = 400) {
    const pts = []
    for (let i = 0; i <= seg; i++) { const t = i / seg, a = t * turns * Math.PI * 2; pts.push(new THREE.Vector3(R * Math.cos(a), t * len, R * Math.sin(a))) }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, wire, 10, false)
  },
  /** extruded 2D outline (THREE.Shape) along +Z, with a small bevel */
  extrude(shape, depth, bevel = depth * 0.06) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 32 })
    g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g
  },
}


export function studioEnvironment(renderer, theme) {
  // a softbox studio: big top light, a key strip, two rim strips, and black flags so metals keep contrast
  const paper = theme === 'paper'
  const s = new THREE.Scene()
  const room = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: paper ? 0x9c9a95 : 0x0a0b0d, side: THREE.BackSide }))
  s.add(room)
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshBasicMaterial({ color: paper ? 0xd8d6d0 : 0x141517 }))
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2; s.add(floor)
  const box = (w, h, x, y, z, k, tint = [1, 1, 1]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...tint).multiplyScalar(k), side: THREE.DoubleSide }))
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m)
  }
  box(14, 10, 0, 14, 2, paper ? 2.6 : 3.2)                  // overhead soft box
  box(4, 14, -12, 4, 8, paper ? 4.5 : 6, [1, 0.96, 0.9])    // warm key strip, front left
  box(2.2, 14, 13, 5, -6, paper ? 6 : 9, [0.88, 0.94, 1])   // cool rim, back right
  box(2.2, 14, -11, 5, -9, paper ? 3.5 : 5)                 // second rim, back left
  box(8, 3, 6, 1.5, 12, paper ? 1.4 : 1.6)                  // low front fill
  // black flags: long dark reflections give metal its shape on a white set
  box(5, 16, 12, 4, 7, 0.02); box(4, 16, -13, 4, -2, 0.02); box(16, 3, 0, -1, -14, 0.03)
  const pm = new THREE.PMREMGenerator(renderer)
  const rt = pm.fromScene(s, 0.02)
  pm.dispose()
  return rt.texture
}
