import {THREE,GEO} from './vendor.js';
import {sectionPolygons} from './model.js';
// Closed angular halves have actual planar end faces. They can leave radially without
// pulling an intact ring through a rotor, as an arbitrary explode vector would do.
export function closedLathe(profile,segments=96,phi=-Math.PI/2,span=Math.PI){
 const base=GEO.lathe(profile,segments,{phi0:phi,phiLen:span});
 const poly=profile.map(([r,y])=>new THREE.Vector2(r,y)),tri=THREE.ShapeUtils.triangulateShape(poly,[]),caps=[];
 for(const [angle,reverse] of [[phi,false],[phi+span,true]]){
  const pos=[];for(const face of tri)for(const k of reverse?[face[2],face[1],face[0]]:face){const[r,y]=profile[k];pos.push(r*Math.sin(angle),y,r*Math.cos(angle));}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(pos.flatMap((v,i)=>i%3===2?[]:[v]),2));g.computeVertexNormals();caps.push(g);
 }
 const geometry=GEO.merge([base,...caps]);geometry.userData.profile=profile.map(p=>[...p]);base.dispose();caps.forEach(g=>g.dispose());return geometry;
}
export function capGeometry(profile,z){
 const pos=[];for(const polygon of sectionPolygons(profile,z)){
  const points=polygon.map(([x,y])=>new THREE.Vector2(x,y)),tri=THREE.ShapeUtils.triangulateShape(points,[]);
  for(const face of tri)for(const k of face){const p=polygon[k];pos.push(p[0],p[1],z+.00015);}
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.computeVertexNormals();return geo;
}
export function heatGlow(material,T=800){
 const heat={value:T};material.userData.heat=heat;material.onBeforeCompile=sh=>{
  sh.uniforms.mechanicalHeat=heat;
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float mechanicalHeat;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.,.24,.045) * pow(max(0.,(mechanicalHeat-750.)/1200.),2.) * .7;');
 };material.customProgramCacheKey=()=> 'mechanical-heat-1';return material;
}
export function sectionMaterial(){
 const mat=new THREE.MeshStandardMaterial({color:'#e15c38',roughness:.48,metalness:.4,side:THREE.DoubleSide});
 mat.onBeforeCompile=sh=>{
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 sectionPoint;').replace('#include <begin_vertex>','#include <begin_vertex>\nsectionPoint=position;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 sectionPoint;').replace('#include <color_fragment>','#include <color_fragment>\nfloat h=abs(fract((sectionPoint.x+sectionPoint.y)*32.)-.5);diffuseColor.rgb*=mix(.62,1.,smoothstep(.08,.16,h));');
 };mat.customProgramCacheKey=()=> 'mechanical-section-1';return mat;
}
export function linkBetween(mesh,a,b){const aa=new THREE.Vector3(...a),bb=new THREE.Vector3(...b);mesh.position.copy(aa).add(bb).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bb.clone().sub(aa).normalize());mesh.scale.y=aa.distanceTo(bb);}
