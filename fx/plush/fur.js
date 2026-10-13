// Shell-texture fur for three.js r180, with no extra dependency.
//
// A furry part is one opaque base mesh (it casts shadows and shows the backing fabric) plus one
// InstancedMesh whose instances are the shells. Shell i is pushed out along the normal by (i+1)/N
// of the fur length; the fragment shader keeps only the pixels that lie inside a tapered strand.
// Strands are placed with 3D cellular noise on the *undisplaced* object-space position, so every
// shell of a strand lines up and there is no UV pole pinching. Every value is a function of the
// uniforms, so a frame depends only on the pose that was set for it.
//
// Optional features (furFeatures):
//   fins     extra quads on every mesh edge, shown only where the surface turns edge-on and filled
//            with the same strands as the shells, so silhouettes read as hair instead of layers.
//   strands  a few thousand instanced fibre ribbons (alpha-to-coverage below one pixel), a two-lobe
//            Kajiya-Kay highlight along the strand tangent and light through backlit tips.
//   shadow   fur self-shadowing of direct light, depth and clump AO, round strand shading and
//            contact occlusion from analytic ellipsoids (head over neck, arms over body, floor).
//   soft     Gaussian deformers on the base surface (cheek puff, belly jiggle, squeeze dents) that
//            move the base, shells, fins and strands together.
//   photo    a photographed CC0 pile texture, triplanar on the undisplaced position: tuft layout,
//            albedo mottling and pile direction (nap) from its normal map.
// Two per-part extras are compiled only where requested: `jaw` (a hinged lower face that opens
// with the mouth) and `brush` (a path a paw has drawn through the pile, which stays flattened).
import * as T from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

export const MAX_HOLES = 8, MAX_SEAMS = 3, MAX_PATCHES = 4, MAX_OCC = 14, MAX_DEF = 6, MAX_BRUSH = 32;
export const FEATURES = ['fins', 'strands', 'shadow', 'soft', 'photo'];
/** 'all' | 'none' | 'fins,shadow' | {fins:true,...} -> {fins, strands, shadow, soft, photo, key} */
export function furFeatures(spec = 'all') {
  let on;
  if (spec && typeof spec === 'object') on = new Set(FEATURES.filter(k => spec[k]));
  else {
    const s = String(spec).toLowerCase().trim();
    on = s === 'all' ? new Set(FEATURES) : new Set(s.split(/[\s,+]+/).filter(k => FEATURES.includes(k)));
  }
  const f = Object.fromEntries(FEATURES.map(k => [k, on.has(k)]));
  return {...f, key: FEATURES.filter(k => on.has(k)).join('+') || 'base'};
}

/** Smooth closed blob: unit sphere -> deform(p) -> merged, smooth normals, no UV seam. */
export function blobGeometry(deform, widthSegments = 72, heightSegments = 54) {
  let g = new T.SphereGeometry(1, widthSegments, heightSegments);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-5);
  const p = g.attributes.position, v = new T.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); deform(v); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
/** Ellipsoid with optional extra deformation applied after scaling. */
export const ellipsoid = (rx, ry, rz, extra, w = 72, h = 54) => blobGeometry(v => { v.set(v.x * rx, v.y * ry, v.z * rz); extra?.(v); }, w, h);
/** Capsule along -Y from the origin (a limb hanging from its joint), optionally tapered. */
export function limbGeometry(radius, length, {tip = 1, flatten = 1, cut = 0, radial = 28, caps = 10} = {}) {
  let g = new T.CapsuleGeometry(radius, length, caps, radial, 6);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-5);
  const p = g.attributes.position, v = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = T.MathUtils.clamp((length / 2 - v.y) / length, 0, 1), s = 1 + (tip - 1) * k; // thicker towards the paw
    const y = Math.max(v.y - length / 2 - radius * .15, -length - radius * 1.15 + radius * cut); // optional flat end (a sole)
    p.setXYZ(i, v.x * s, y, v.z * s * flatten);
  }
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------------------------
// Shaders. Variants: base + shells (default), FUR_FIN (silhouette fins), FUR_STRAND (fibres).
const vertexHead = /* glsl */`
uniform float uLen, uShells; uniform vec3 uForce; uniform vec4 uHoles[${MAX_HOLES}]; uniform vec4 uSeams[${MAX_SEAMS}]; uniform float uSeamW;
uniform vec4 uMouthHole;
varying vec3 vBase; varying float vH; varying float vLenMask; varying vec3 vBaseN; varying vec3 vFurT; varying float vOcc; varying float vBrush;
float furLenMask(vec3 p){
  float m=1.;
  for(int i=0;i<${MAX_HOLES};i++){vec4 h=uHoles[i];if(h.w>0.)m*=smoothstep(h.w*.72,h.w*1.28,distance(p,h.xyz));}
  for(int i=0;i<${MAX_SEAMS};i++){vec4 s=uSeams[i];if(dot(s.xyz,s.xyz)>.5)m*=mix(.3,1.,smoothstep(0.,uSeamW,abs(dot(p,s.xyz)-s.w)));}
  if(uMouthHole.z>0.&&p.z>0.){vec2 d=(p.xy-uMouthHole.xy)/uMouthHole.zw;m*=smoothstep(.85,1.3,length(d));}
  return m;
}
#ifdef FUR_SOFT
uniform vec4 uDefC[${MAX_DEF}]; uniform vec4 uDefD[${MAX_DEF}];
vec3 furSoft(vec3 p, vec3 n){
  vec3 d=vec3(0.);
  for(int i=0;i<${MAX_DEF};i++){vec4 c=uDefC[i];if(c.w<=0.)continue;vec3 q=p-c.xyz;float w=exp(-dot(q,q)/(c.w*c.w));d+=(uDefD[i].xyz+n*uDefD[i].w)*w;}
  return d;
}
#endif
#ifdef FUR_JAW
// x: hinge height, y: blend distance below it, z: drop, w: half-width; uJawB: front z range and backward pull.
uniform vec4 uJaw; uniform vec3 uJawB;
float furJawW(vec3 p){
  return smoothstep(uJaw.x, uJaw.x-uJaw.y, p.y)*exp(-(p.x*p.x)/(uJaw.w*uJaw.w))*smoothstep(uJawB.x,uJawB.y,p.z);
}
#endif
#ifdef FUR_BRUSH
// Path drawn through the pile (xyz object space, w = time it was drawn); uBrush: radius, strength, now, count.
uniform vec4 uBrushP[${MAX_BRUSH}]; uniform vec4 uBrush;
vec4 furBrush(vec3 p){
  vec3 dir=vec3(0.); float best=0.;
  for(int i=0;i<${MAX_BRUSH - 1};i++){
    if(float(i)>=uBrush.w-1.) break;
    vec4 a=uBrushP[i], b=uBrushP[i+1];
    if(a.w>uBrush.z) break;
    float k=clamp((uBrush.z-a.w)/max(b.w-a.w,1e-4),0.,1.);
    vec3 e=mix(a.xyz,b.xyz,k), s=e-a.xyz; float l2=dot(s,s);
    if(l2<1e-8) continue;
    float u=clamp(dot(p-a.xyz,s)/l2,0.,1.); float d=distance(p,a.xyz+s*u);
    float w=1.-smoothstep(uBrush.x*.55,uBrush.x,d);
    if(w>best){best=w;dir=normalize(b.xyz-a.xyz);}
  }
  return vec4(dir,best*uBrush.y);
}
#endif
#ifdef FUR_SHADOW
uniform mat4 uOccM[${MAX_OCC}]; uniform vec4 uOccC[${MAX_OCC}]; uniform float uSelfId; uniform vec2 uOccK;
float furOcclusion(vec3 wp, vec3 wn){
  float o=1.;
  for(int i=0;i<${MAX_OCC};i++){
    vec4 c=uOccC[i]; if(c.w<0.||abs(c.w-uSelfId)<.5) continue;
    vec3 q=(uOccM[i]*vec4(wp,1.)).xyz; float l2=max(dot(q,q),1.);
    float k=clamp(dot(wn,normalize(c.xyz-wp))*.75+.25,0.,1.)/l2;   // cosine-ish x solid angle of a unit sphere
    o*=1.-uOccK.x*k*k;
  }
  return mix(1.,o,uOccK.y);
}
#endif
#ifdef FUR_FIN
attribute vec4 finA; attribute vec4 finB; attribute vec3 finE; uniform vec2 uFinEdge;
varying float vFinFade; varying vec3 vFinN;
#endif
#ifdef FUR_STRAND
attribute vec3 iRoot; attribute vec3 iNormal; attribute vec3 iTan; attribute vec4 iRand; attribute vec2 strandUV;
uniform float uViewH; uniform float uStrandW;
varying float vCov; varying float vStrandRnd;
#endif`;
const vertexNormal = /* glsl */`
#ifdef FUR_STRAND
vec3 objectNormal = normalize(iNormal);
#else
vec3 objectNormal = vec3(normal);
#endif
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif`;
const vertexBody = /* glsl */`
#ifdef FUR_STRAND
  vec3 furP = iRoot; vec3 furN = normalize(iNormal);
  float furH = strandUV.x * iRand.x;
#else
  vec3 furP = vec3(position); vec3 furN = normalize(normal);
  #if defined(FUR_FIN)
    float furH = finA.w;
  #elif defined(USE_INSTANCING)
    float furH = (float(gl_InstanceID) + 1.) / uShells;
  #else
    float furH = 0.;
  #endif
#endif
vH = furH; vBase = furP; vBaseN = furN;
float furM = furLenMask(furP); vLenMask = furM;
vec3 transformed = furP;
#ifdef FUR_SOFT
  transformed += furSoft(furP, furN);
#endif
#ifdef FUR_JAW
  { float jw = furJawW(furP); transformed += vec3(0., -uJaw.z, -uJaw.z * uJawB.z) * jw; }
#endif
mat3 furM3 = mat3(modelMatrix);
vec3 furF = transpose(furM3) * uForce / max(length(furM3[0]), 1e-4);
furF -= min(dot(furF, furN), 0.) * furN * .9;          // strands bend, they do not sink into the body
vec3 furBend = furF; float furUp = 1.;
vBrush = 0.;
#ifdef FUR_BRUSH
  { vec4 br = furBrush(furP); vec3 bt = br.xyz - furN * dot(br.xyz, furN);
    furBend += bt * br.w * 3.; furUp = 1. - .75 * br.w; vBrush = br.w; }
#endif
#ifdef FUR_STRAND
  furBend += iTan * iRand.y;
  furM *= step(.12, furM);
  float furH2 = furH * min(furH, 1.);
#else
  float furH2 = furH * furH;
#endif
transformed += (furN * furH * furUp + furBend * furH2) * uLen * furM;
vFurT = normalize(mat3(modelViewMatrix) * normalize(furN + 2. * furBend * min(furH, 1.)));
#ifdef FUR_SHADOW
  { vec4 wp = modelMatrix * vec4(transformed, 1.); vOcc = furOcclusion(wp.xyz, normalize(furM3 * furN)); }
#else
  vOcc = 1.;
#endif
#ifdef FUR_FIN
{
  vec3 e0 = finB.w > .5 ? finE : furP, e1 = finB.w > .5 ? furP : finE;   // canonical edge direction
  vec3 nAvg = normalize(finA.xyz + finB.xyz);
  vec3 mid = (modelViewMatrix * vec4(.5 * (e0 + e1), 1.)).xyz, V = normalize(-mid);
  vec3 n1 = normalize(normalMatrix * finA.xyz), n2 = normalize(normalMatrix * finB.xyz), nv = normalize(normalMatrix * nAvg);
  float sil = dot(n1, V) * dot(n2, V) <= 0. ? 1. : 0.;
  float edgeOn = 1. - abs(dot(nv, V));
  vFinN = normalize(cross(e1 - e0, nAvg));
  float facing = abs(dot(normalize(normalMatrix * vFinN), V));
  vFinFade = max(sil, smoothstep(uFinEdge.x, uFinEdge.y, edgeOn)) * smoothstep(.1, .4, facing);
}
#endif
#ifdef FUR_STRAND
  vCov = 1.; vStrandRnd = iRand.z;
#endif
#ifdef USE_ALPHAHASH
  vPosition = vec3(position);
#endif`;
const vertexProject = /* glsl */`
#include <project_vertex>
#ifdef FUR_FIN
  if (vFinFade < .01) gl_Position = vec4(0., 0., 2., 1.);    // whole fin culled (every vertex agrees)
#endif
#ifdef FUR_STRAND
{
  vec3 tv = vFurT, side = normalize(cross(tv, normalize(-mvPosition.xyz)));
  float pix = 2. * (-mvPosition.z) / (projectionMatrix[1][1] * uViewH);
  float w = uStrandW * iRand.w * (1. - .75 * strandUV.x), wd = max(w, pix * 1.05);
  vCov = w / wd;
  mvPosition.xyz += side * (strandUV.y * .5 * wd);
  gl_Position = projectionMatrix * mvPosition;
}
#endif`;

const noise = /* glsl */`
vec3 furHash33(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}
float furHash13(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
vec2 furCell(vec3 p){
  vec3 c=floor(p),f=fract(p);float d=9.,id=0.;
  for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec3 g=vec3(float(x),float(y),float(z)),r=g+furHash33(c+g)*.9+.05-f;float dd=dot(r,r);
    if(dd<d){d=dd;id=furHash13(c+g+17.31);}
  }
  return vec2(sqrt(d),id);
}
float furValue(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(furHash13(i),furHash13(i+vec3(1,0,0)),f.x),mix(furHash13(i+vec3(0,1,0)),furHash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(furHash13(i+vec3(0,0,1)),furHash13(i+vec3(1,0,1)),f.x),mix(furHash13(i+vec3(0,1,1)),furHash13(i+vec3(1,1,1)),f.x),f.y),f.z);}`;
const fragmentHead = /* glsl */`
uniform float uLen; uniform float uDensity, uClump, uRoot, uStrand, uVariation; uniform vec3 uTip;
uniform vec3 uPatchC[${MAX_PATCHES}], uPatchR[${MAX_PATCHES}], uPatchCol[${MAX_PATCHES}]; uniform float uPatchAmt[${MAX_PATCHES}];
varying vec3 vBase; varying float vH; varying float vLenMask; varying vec3 vBaseN; varying vec3 vFurT; varying float vOcc; varying float vBrush;
float furStrandRnd = .5, furDepthN = 0., furContact = 1., furAO = 1., fH = 0.;
vec3 furSafeN(vec3 v, vec3 fb){ float l = length(v); return l > 1e-5 ? v / l : fb; }
#ifdef FUR_FINS_ON
uniform vec2 uFinEdge; uniform float uShellThin;
#endif
#ifdef FUR_FIN
uniform float uFinSlab; varying float vFinFade; varying vec3 vFinN;
#endif
#ifdef FUR_STRAND
varying float vCov; varying float vStrandRnd;
#endif
#ifdef FUR_SHADOW
uniform vec4 uAO; uniform vec2 uSelf;
#endif
#ifdef FUR_KK
uniform vec4 uKK; uniform vec4 uKKShift; uniform vec3 uKKColor;
#endif
#ifdef FUR_PHOTO
uniform sampler2D uPhotoA; uniform vec4 uPhoto; uniform float uPhotoMean;
// uPhotoA packs the photographed pile: rg = normal-map xy, b = albedo luminance (one fetch per plane).
vec3 furTriW(vec3 n){vec3 w=pow(abs(n),vec3(6.));return w/(w.x+w.y+w.z);}
void furTri(vec3 p, vec3 w, out float lum, out vec3 nap){
  lum=0.; nap=vec3(0.);
  if(w.x>.02){vec3 t=texture2D(uPhotoA,p.yz).rgb; lum+=t.b*w.x; nap+=vec3(0.,t.r*2.-1.,t.g*2.-1.)*w.x;}
  if(w.y>.02){vec3 t=texture2D(uPhotoA,p.xz).rgb; lum+=t.b*w.y; nap+=vec3(t.r*2.-1.,0.,t.g*2.-1.)*w.y;}
  if(w.z>.02){vec3 t=texture2D(uPhotoA,p.xy).rgb; lum+=t.b*w.z; nap+=vec3(t.r*2.-1.,t.g*2.-1.,0.)*w.z;}
}
#endif` + noise;

const fragmentBody = /* glsl */`
#include <color_fragment>
{
  // MSAA can run this outside thin fin/strand triangles (extrapolated varyings): keep every input in range.
  fH = clamp(vH, 0., 2.);
  float fB = clamp(vBrush, 0., 1.);
  vec3 furCol = diffuseColor.rgb;
  for(int i=0;i<${MAX_PATCHES};i++){
    if(uPatchAmt[i]>0.){float e=length((vBase-uPatchC[i])/uPatchR[i]);furCol=mix(furCol,uPatchCol[i],(1.-smoothstep(.62,1.,e))*uPatchAmt[i]);}
  }
  vec3 furQ = vBase; float furLum = 1.;
#ifdef FUR_PHOTO
  { vec3 w = furTriW(furSafeN(vBaseN, vec3(0., 0., 1.))), pq = vBase * uPhoto.x, nap;
    furTri(pq, w, furLum, nap); furLum /= uPhotoMean;
    furQ -= nap * min(fH, 1.) * uLen * uPhoto.w; }
#endif
  float a = 1., clump, len, strandR = 1., cellD = 0.;
#ifdef FUR_STRAND
  clump = furValue(vBase * uClump);
  len = 1.;
  furStrandRnd = vStrandRnd;
  a = clamp(vCov, 0., 1.) * (1. - smoothstep(.75, 1., fH / 1.7));
  furCol *= (1. + (vStrandRnd - .5) * uVariation * 1.5) * .94;
#else
  vec2 cell = furCell(furQ * uDensity);
  clump = furValue(furQ * uClump);
#ifdef FUR_PHOTO
  clump = mix(clump, clamp((furLum - 1.) * uPhoto.z + .5, 0., 1.), step(.001, uPhoto.z));
#endif
  len = mix(.55, 1., cell.y) * mix(.62, 1., clump);
  furStrandRnd = cell.y;
  if (fH > 0.) {
    float r = uStrand * pow(max(0., 1. - fH / len), .62);
#ifdef FUR_FIN
    // A fin shows the strands of a thin slab around its plane (the strands seen along the silhouette).
    float fade = clamp(vFinFade, 0., 1.);
    float best = r * fade - cell.x;
    for (int k = -1; k <= 1; k += 2) {
      vec3 pp = furQ + furSafeN(vFinN, vec3(0.)) * (float(k) * uFinSlab);
      vec2 c2 = furCell(pp * uDensity); float cl2 = furValue(pp * uClump);
      float l2 = mix(.55, 1., c2.y) * mix(.62, 1., cl2);
      float s2 = fH > l2 ? -1. : uStrand * pow(max(0., 1. - fH / l2), .62) * fade - c2.x;
      if (s2 > best) { best = s2; cell = c2; clump = cl2; len = l2; }
    }
    a = (vLenMask < .12 || fH > len) ? 0. : .5 + best * 2.2;
    strandR = r * fade;
#else
#ifdef FUR_FINS_ON
    float edgeOn = 1. - abs(dot(furSafeN(vNormal, vec3(0., 0., 1.)), furSafeN(vViewPosition, vec3(0., 0., 1.))));
    r *= mix(1., uShellThin, smoothstep(uFinEdge.x, uFinEdge.y, edgeOn));
#endif
    r *= 1. + .35 * fB;                                   // flattened pile shows the side of each strand
    a = (vLenMask < .12 || fH > len) ? 0. : .5 + (r - cell.x) * 2.2;
    strandR = r;
#endif
  }
  cellD = cell.x;
  furCol *= 1. + (cell.y - .5) * uVariation + (clump - .5) * uVariation * .8;
#endif
#ifdef FUR_PHOTO
  furCol *= mix(1., furLum, uPhoto.y * clamp(uLen / .045, .3, 1.));
#endif
#ifdef FUR_SHADOW
  float rootDark = mix(uRoot, 1., .45);    // light (AO / self-shadow) shades the roots instead of paint
#else
  float rootDark = uRoot;
#endif
  furCol *= mix(mix(1., rootDark, smoothstep(.1, .6, vLenMask)), 1., pow(min(fH, 1.), .75));   // bald spots show light backing fabric
  furCol = mix(furCol, furCol * uTip, min(fH * fH, 1.));
  furCol *= mix(vec3(1.), vec3(.24, .15, .11), fB);       // pressed pile: the track shows deeper, warmer shade
#ifdef FUR_SHADOW
  { float canopy = mix(.62, 1., clump);
    furDepthN = clamp((canopy - fH) / canopy, 0., 1.) * clamp(vLenMask * 1.4, 0., 1.)   // short fur (seams, holes, muzzle) hides less light
              * clamp(uLen / .045, .4, 1.) * (1. - .7 * fB);
    float occ = clamp(vOcc, 0., 1.);
    furDepthN = max(furDepthN, 0.);
    furAO = occ * (1. - uAO.x * pow(furDepthN, 1.5)) * (1. - uAO.y * (1. - clump) * (1. - clump));
    furContact = mix(1., occ, uAO.w);
    // Light that bounces between fibres picks up their colour: shadowed fur is warmer, not grey.
    furCol *= mix(vec3(1.), furCol / max(max(furCol.r, furCol.g), max(furCol.b, 1e-3)) * 1.25, (1. - furAO) * .6);
    furCol *= 1. + uSelf.x * .3 * (1. - furDepthN);   // fibre-to-fibre scattering keeps the outer pile bright
#ifndef FUR_STRAND
    if (fH > 0.) furCol *= mix(1. - uAO.z, 1., sqrt(max(0., 1. - pow(cellD / max(strandR, 1e-3), 2.))));   // round strands
#endif
  }
#endif
  diffuseColor.rgb = furCol;
  diffuseColor.a = a;
}`;
// Direct light: self-shadow and Kajiya-Kay, injected into the physical lighting model.
const lightFns = /* glsl */`
float furDirect(vec3 N, vec3 L) {
  float s = furContact;
#ifdef FUR_SHADOW
  s *= exp(-uSelf.x * pow(furDepthN, 1.3) / max(dot(N, L) * .75 + .25, uSelf.y));
#endif
  return s;
}
#ifdef FUR_KK
void furKK(const in IncidentLight light, const in vec3 N, const in vec3 V, const in vec3 albedo, inout ReflectedLight rl) {
  if (fH <= 0.) return;
  vec3 Tn = furSafeN(vFurT, N), L = light.direction, H = furSafeN(L + V, N);
  float sh = (furStrandRnd - .5) * uKKShift.z;
  vec3 T1 = furSafeN(Tn + N * (uKKShift.x + sh), N), T2 = furSafeN(Tn + N * (uKKShift.y + sh), N);
  float d1 = dot(T1, H), d2 = dot(T2, H);
  float s1 = pow(sqrt(max(0., 1. - d1 * d1)), uKK.y) * smoothstep(-1., 0., d1);
  float s2 = pow(sqrt(max(0., 1. - d2 * d2)), uKK.w) * smoothstep(-1., 0., d2);
  float wrap = clamp(dot(N, L) * .6 + .4, 0., 1.), tipW = min(fH, 1.);
  float vis = furDirect(N, L) * wrap * tipW;
  rl.directSpecular += light.color * vis * (uKK.x * s1 * uKKColor + uKK.z * s2 * albedo);
  // Backlit tips: light passing through thin fibres towards the camera.
  float back = pow(clamp(dot(-V, L), 0., 1.), 3.) * (1. - abs(dot(N, V)));
  rl.directDiffuse += light.color * albedo * back * tipW * tipW * uKKShift.w * furContact;
}
#endif
`;
function lightsChunk() {
  let c = T.ShaderChunk.lights_physical_pars_fragment;
  const a = 'vec3 irradiance = dotNL * directLight.color;', b = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n}';
  if (!c.includes(a) || !c.includes(b)) throw new Error('three.js lighting chunk changed; fur lighting patch needs updating');
  c = c.replace(a, 'vec3 irradiance = dotNL * directLight.color * furDirect( geometryNormal, directLight.direction );');
  c = c.replace(b, 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\n#ifdef FUR_KK\n\tfurKK( directLight, geometryNormal, geometryViewDir, material.diffuseColor, reflectedLight );\n#endif\n}');
  return lightFns + c;
}
const aoChunk = /* glsl */`
#include <aomap_fragment>
#ifdef FUR_SHADOW
  reflectedLight.indirectDiffuse *= furAO; reflectedLight.indirectSpecular *= furAO;
  reflectedLight.directDiffuse *= mix(1., furAO, .35);
#ifdef USE_SHEEN
  sheenSpecularIndirect *= furAO;
#endif
#endif`;

/** Uniforms shared by every furry part of one character (occluders, photo texture, look constants). */
export function furShared({photo = null, viewHeight = 1080} = {}) {
  return {
    uOccM: {value: Array.from({length: MAX_OCC}, () => new T.Matrix4())},
    uOccC: {value: Array.from({length: MAX_OCC}, () => new T.Vector4(0, 0, 0, -1))},
    uOccK: {value: new T.Vector2(.55, 1)},             // strength per occluder, overall mix
    uAO: {value: new T.Vector4(.36, .2, .12, .5)},       // depth AO, clump-valley AO, strand roundness, contact on direct light
    uSelf: {value: new T.Vector2(.5, .3)},               // self-shadow density, min cos
    uKK: {value: new T.Vector4(.16, 90, .2, 18)},        // primary strength, exponent, secondary strength, exponent
    uKKShift: {value: new T.Vector4(-.12, .22, .35, .9)}, // primary shift, secondary shift, per-strand jitter, backlit tip gain
    uKKColor: {value: new T.Color('#fff4e6')},
    uFinEdge: {value: new T.Vector2(.62, .9)}, uShellThin: {value: .45}, uFinSlab: {value: .005},
    uViewH: {value: viewHeight}, uStrandW: {value: .0008},
    uPhotoA: {value: photo?.packed || null}, uPhotoMean: {value: photo?.mean || 1},
  };
}

/**
 * MeshPhysicalMaterial with fur shells. Options (all optional):
 * color, length (object units), shells, density (strands per unit), clump (clump frequency),
 * strand (strand radius in cells, 0.4–0.75), root (root darkening 0–1), tip (tip tint multiplier),
 * variation, sheen, sheenColor, sheenRoughness, roughness, holes [[x,y,z,r]...], seams [[nx,ny,nz,d]...],
 * seamWidth, patches [{center:[x,y,z], radii:[x,y,z], color, amount}], features (furFeatures result),
 * shared (furShared()), selfId (occluder owner id), photo [scale, albedo, tuft contrast, nap],
 * jaw (compile the hinged-jaw deformer), brush (compile the brushed-pile path).
 */
export function furMaterial(o = {}) {
  const v4 = (list, n) => Array.from({length: n}, (_, i) => new T.Vector4(...(list?.[i] || [0, 0, 0, 0])));
  const patches = o.patches || [];
  const uniforms = {
    uLen: {value: o.length ?? .04}, uShells: {value: o.shells ?? 24}, uForce: {value: new T.Vector3(0, -(o.gravity ?? .35), 0)},
    uHoles: {value: v4(o.holes, MAX_HOLES)}, uSeams: {value: v4(o.seams, MAX_SEAMS)}, uSeamW: {value: o.seamWidth ?? .012},
    uMouthHole: {value: new T.Vector4(0, 0, 0, 1)},
    uDensity: {value: o.density ?? 150}, uClump: {value: o.clump ?? 22}, uRoot: {value: o.root ?? .5}, uTip: {value: new T.Color(o.tip ?? '#ffffff')},
    uStrand: {value: o.strand ?? .6}, uVariation: {value: o.variation ?? .12},
    uPatchC: {value: Array.from({length: MAX_PATCHES}, (_, i) => new T.Vector3(...(patches[i]?.center || [0, 0, 0])))},
    uPatchR: {value: Array.from({length: MAX_PATCHES}, (_, i) => new T.Vector3(...(patches[i]?.radii || [1, 1, 1])))},
    uPatchCol: {value: Array.from({length: MAX_PATCHES}, (_, i) => new T.Color(patches[i]?.color || '#ffffff'))},
    uPatchAmt: {value: Array.from({length: MAX_PATCHES}, (_, i) => patches[i]?.amount ?? 0)},
    uSelfId: {value: o.selfId ?? -10},
    uDefC: {value: Array.from({length: MAX_DEF}, () => new T.Vector4(0, 0, 0, 0))},
    uDefD: {value: Array.from({length: MAX_DEF}, () => new T.Vector4(0, 0, 0, 0))},
    uPhoto: {value: new T.Vector4(...(o.photo || [1.6, .5, 1.6, 1.5]))},
    uJaw: {value: new T.Vector4(0, .04, 0, .2)}, uJawB: {value: new T.Vector3(-3, -2.9, 0)},
    uBrushP: {value: Array.from({length: MAX_BRUSH}, () => new T.Vector4(0, 0, 0, 1e6))}, uBrush: {value: new T.Vector4(.05, 0, 0, 0)},
  };
  Object.assign(uniforms, o.shared || furShared());
  const features = o.features || furFeatures('all');
  const m = makeMaterial(o, uniforms, features, 'shell');
  m.userData.fur = uniforms; m.userData.furOpts = {...o, features};
  return m;
}
/** Another material over the same uniforms: 'fin' or 'strand'. */
export function furVariant(material, variant) {
  const o = material.userData.furOpts, m = makeMaterial(o, material.userData.fur, o.features, variant);
  m.userData.fur = material.userData.fur; return m;
}
function makeMaterial(o, uniforms, f, variant) {
  const m = new T.MeshPhysicalMaterial({
    color: o.color ?? '#c8925f', roughness: o.roughness ?? .92, metalness: 0,
    sheen: o.sheen ?? 1, sheenColor: new T.Color(o.sheenColor ?? '#fff1dc'), sheenRoughness: o.sheenRoughness ?? .42,
    alphaTest: variant === 'strand' ? 0 : .5, alphaToCoverage: true,
  });
  const defines = {};
  if (f.fins) defines.FUR_FINS_ON = '';
  if (f.strands) defines.FUR_KK = '';
  if (f.shadow) defines.FUR_SHADOW = '';
  if (f.soft) defines.FUR_SOFT = '';
  if (f.photo && uniforms.uPhotoA.value) defines.FUR_PHOTO = '';
  if (o.jaw) defines.FUR_JAW = '';
  if (o.brush && variant !== 'strand') defines.FUR_BRUSH = '';
  if (variant === 'fin') defines.FUR_FIN = '';
  if (variant === 'strand') defines.FUR_STRAND = '';
  m.defines = defines;
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = vertexHead + '\n' + shader.vertexShader
      .replace('#include <beginnormal_vertex>', vertexNormal)
      .replace('#include <begin_vertex>', vertexBody)
      .replace('#include <project_vertex>', vertexProject);
    shader.fragmentShader = fragmentHead + '\n' + shader.fragmentShader
      .replace('#include <color_fragment>', fragmentBody)
      .replace('#include <lights_physical_pars_fragment>', lightsChunk())
      .replace('#include <aomap_fragment>', aoChunk);
  };
  m.customProgramCacheKey = () => `plush-fur-${variant}-${Object.keys(defines).sort().join('.')}`;
  return m;
}

/** Fin quads for every interior edge of an indexed geometry: rows along the fur height. */
export function finGeometry(geometry, rows = 3) {
  const pos = geometry.attributes.position, idx = geometry.index, nor = geometry.attributes.normal;
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), e1 = new T.Vector3(), e2 = new T.Vector3();
  const edges = new Map(), N = pos.count;
  for (let f = 0; f < idx.count; f += 3) {
    const i0 = idx.getX(f), i1 = idx.getX(f + 1), i2 = idx.getX(f + 2);
    if (i0 === i1 || i1 === i2 || i0 === i2) continue;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    const n = e1.subVectors(b, a).cross(e2.subVectors(c, a)); if (n.lengthSq() < 1e-24) continue; n.normalize();
    for (const [p, q] of [[i0, i1], [i1, i2], [i2, i0]]) {
      const lo = Math.min(p, q), hi = Math.max(p, q), key = lo * N + hi, e = edges.get(key);
      if (e) { if (!e.n2) e.n2 = n.toArray(); } else edges.set(key, {lo, hi, n1: n.toArray(), n2: null});
    }
  }
  const E = edges.size, V = E * 2 * rows;
  const P = new Float32Array(V * 3), Nn = new Float32Array(V * 3), A = new Float32Array(V * 4), B = new Float32Array(V * 4), Ee = new Float32Array(V * 3);
  const index = new Uint32Array(E * (rows - 1) * 6);
  let v = 0, k = 0;
  for (const {lo, hi, n1, n2} of edges.values()) {
    const m2 = n2 || n1, base = v;
    for (let r = 0; r < rows; r++) for (let s = 0; s < 2; s++) {
      const i = s ? hi : lo, o = s ? lo : hi;
      P.set([pos.getX(i), pos.getY(i), pos.getZ(i)], v * 3); Nn.set([nor.getX(i), nor.getY(i), nor.getZ(i)], v * 3);
      A.set([...n1, r / (rows - 1)], v * 4); B.set([...m2, s], v * 4); Ee.set([pos.getX(o), pos.getY(o), pos.getZ(o)], v * 3);
      v++;
    }
    for (let r = 0; r < rows - 1; r++) { const q = base + r * 2; index.set([q, q + 1, q + 3, q, q + 3, q + 2], k); k += 6; }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('normal', new T.BufferAttribute(Nn, 3));
  g.setAttribute('finA', new T.BufferAttribute(A, 4)); g.setAttribute('finB', new T.BufferAttribute(B, 4)); g.setAttribute('finE', new T.BufferAttribute(Ee, 3));
  g.setIndex(new T.BufferAttribute(index, 1)); g.boundingSphere = geometry.boundingSphere?.clone() || null;
  return g;
}

/** Seeded instanced fibre ribbons rooted on the surface (area-weighted). */
export function strandGeometry(geometry, count, seed = 1, {segments = 5, long = .07} = {}) {
  let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const pos = geometry.attributes.position, nor = geometry.attributes.normal, idx = geometry.index;
  const tris = [], cum = []; let total = 0;
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), e1 = new T.Vector3(), e2 = new T.Vector3();
  for (let f = 0; f < idx.count; f += 3) {
    const i0 = idx.getX(f), i1 = idx.getX(f + 1), i2 = idx.getX(f + 2);
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    const area = e1.subVectors(b, a).cross(e2.subVectors(c, a)).length() / 2; if (area < 1e-12) continue;
    tris.push([i0, i1, i2]); total += area; cum.push(total);
  }
  const root = new Float32Array(count * 3), normal = new Float32Array(count * 3), tan = new Float32Array(count * 3), rand = new Float32Array(count * 4);
  const p = new T.Vector3(), n = new T.Vector3(), t = new T.Vector3(), tmp = new T.Vector3(), na = new T.Vector3(), nb = new T.Vector3(), nc = new T.Vector3();
  for (let i = 0; i < count; i++) {
    const x = rnd() * total; let lo = 0, hi = cum.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < x) lo = mid + 1; else hi = mid; }
    const [i0, i1, i2] = tris[lo]; let u = rnd(), w = rnd(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    p.copy(a).multiplyScalar(1 - u - w).addScaledVector(b, u).addScaledVector(c, w);
    na.fromBufferAttribute(nor, i0); nb.fromBufferAttribute(nor, i1); nc.fromBufferAttribute(nor, i2);
    n.copy(na).multiplyScalar(1 - u - w).addScaledVector(nb, u).addScaledVector(nc, w).normalize();
    tmp.set(rnd() - .5, rnd() - .5, rnd() - .5); t.copy(tmp).addScaledVector(n, -tmp.dot(n)).normalize();
    root.set(p.toArray(), i * 3); normal.set(n.toArray(), i * 3); tan.set(t.toArray(), i * 3);
    const flyaway = rnd() < long;
    rand.set([flyaway ? 1.2 + rnd() * .45 : .85 + rnd() * .3, (flyaway ? .1 : .04) + rnd() * .22, rnd(), .7 + rnd() * .6], i * 4);
  }
  const g = new T.InstancedBufferGeometry();
  const verts = (segments + 1) * 2, uv = new Float32Array(verts * 2), zero = new Float32Array(verts * 3), index = [];
  for (let k = 0; k <= segments; k++) { uv.set([k / segments, -1, k / segments, 1], k * 4); if (k < segments) { const q = k * 2; index.push(q, q + 1, q + 3, q, q + 3, q + 2); } }
  g.setAttribute('position', new T.BufferAttribute(zero, 3)); g.setAttribute('normal', new T.BufferAttribute(zero.slice(), 3));
  g.setAttribute('strandUV', new T.BufferAttribute(uv, 2)); g.setIndex(index);
  g.setAttribute('iRoot', new T.InstancedBufferAttribute(root, 3)); g.setAttribute('iNormal', new T.InstancedBufferAttribute(normal, 3));
  g.setAttribute('iTan', new T.InstancedBufferAttribute(tan, 3)); g.setAttribute('iRand', new T.InstancedBufferAttribute(rand, 4));
  g.instanceCount = count; g.boundingSphere = geometry.boundingSphere?.clone() || null;
  return g;
}

/** Adds a furry part (base + shells [+ fins, strands]) under parent. Returns {group, base, shells, fins, strands, material, uniforms}. */
export function furPart(parent, geometry, material, {x = 0, y = 0, z = 0, castShadow = true, name, strands = 0, seed = 1} = {}) {
  const group = new T.Group(); group.position.set(x, y, z); if (name) group.name = name; parent.add(group);
  const base = new T.Mesh(geometry, material); base.castShadow = castShadow; base.receiveShadow = true; group.add(base);
  const n = material.userData.fur.uShells.value;
  const shells = new T.InstancedMesh(geometry, material, n); shells.castShadow = false; shells.receiveShadow = true;
  shells.frustumCulled = false; shells.userData.furShells = true; group.add(shells);
  const f = material.userData.furOpts?.features; let fins = null, hair = null;
  if (f?.fins) {
    fins = new T.Mesh(finGeometry(geometry), furVariant(material, 'fin')); fins.castShadow = false; fins.receiveShadow = true;
    fins.frustumCulled = false; fins.userData.furShells = true; group.add(fins);
  }
  if (f?.strands && strands > 0) {
    hair = new T.Mesh(strandGeometry(geometry, strands, seed), furVariant(material, 'strand')); hair.castShadow = false; hair.receiveShadow = true;
    hair.frustumCulled = false; hair.userData.furShells = true; group.add(hair);
  }
  return {group, base, shells, fins, strands: hair, material, uniforms: material.userData.fur};
}

/** Contact occlusion from a character's ellipsoid occluders on any physical/standard material (per fragment). */
export function addContactOcclusion(material, shared, strength = 1) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.call(material, shader, r);
    Object.assign(shader.uniforms, {uOccM: shared.uOccM, uOccC: shared.uOccC, uOccGround: {value: strength}});
    shader.vertexShader = 'varying vec3 vOccW;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvOccW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    shader.fragmentShader = `varying vec3 vOccW; uniform mat4 uOccM[${MAX_OCC}]; uniform vec4 uOccC[${MAX_OCC}]; uniform float uOccGround;\n` +
      shader.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
      { float o = 1.; vec3 wn = vec3(0., 1., 0.);
        for (int i = 0; i < ${MAX_OCC}; i++) { vec4 c = uOccC[i]; if (c.w < 0.) continue;
          vec3 q = (uOccM[i] * vec4(vOccW, 1.)).xyz; float l2 = max(dot(q, q), 1.);
          float k = clamp(dot(wn, normalize(c.xyz - vOccW)) * .75 + .25, 0., 1.) / l2; o *= 1. - .6 * k * k; }
        o = mix(1., o, uOccGround);
        reflectedLight.indirectDiffuse *= o; reflectedLight.directDiffuse *= mix(1., o, .5); }`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (key ? key() : '') + '-contact-ao';
  material.needsUpdate = true;
}

/** Hide the fur layers while a depth-only pass renders (depth of field needs the opaque bodies only). */
export function withoutFur(scene, fn) {
  const hidden = []; scene.traverse(o => { if (o.userData.furShells && o.visible) { o.visible = false; hidden.push(o); } });
  try { return fn(); } finally { hidden.forEach(o => (o.visible = true)); }
}
