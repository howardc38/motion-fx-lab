// Original volumetric versions of the two COUNTERFORM fighters. Both clips are
// baked from the same joint-space choreography used by the 2D film.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createChoreography} from './battle.js';

export function makeFighter(){
 const scene=new THREE.Group();scene.name='CounterformDuel';
 const motion=createChoreography(),clips=[];
 for(let id=0;id<2;id++){
  const prefix=id?'Teal':'Amber',bones=[],parts=[],tracks=[],descriptors=[];
  const root=new THREE.Bone();root.name=prefix+'_root';bones.push(root);
  const ink='#102331',cloth=id?'#1f8796':'#ea683c',accent=id?'#7ce2e6':'#ffc085',darkSuit=id?'#164e5b':'#9c3922',visor='#fff8ea';
  const fSign=id?-1:1;
  function joint(name,sample){const b=new THREE.Bone();b.name=prefix+'_'+name;root.add(b);bones.push(b);descriptors.push({b,sample});return b;}
  function piece(b,geo,pos,scale,color){
   geo=geo.index?geo.toNonIndexed():geo.clone();
   geo.scale(...scale);geo.translate(...pos);geo.computeVertexNormals();
   const n=geo.attributes.position.count,indices=new Uint16Array(n*4),weights=new Float32Array(n*4),colors=new Float32Array(n*3),c=new THREE.Color(color);
   const bi=bones.indexOf(b);
   for(let i=0;i<n;i++){indices[i*4]=bi;weights[i*4]=1;colors.set([c.r,c.g,c.b],i*3);}
   geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
   geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
   geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
   parts.push(geo);
  }
  const sphere=()=>new THREE.SphereGeometry(1,16,12);
  const box=()=>new THREE.BoxGeometry(1,1,1);
  // Anatomical lathe segment from y = -0.5 (proximal joint) to y = +0.5 (distal joint).
  function muscleProfile(radii){
   const pts=radii.map(([y,r])=>new THREE.Vector2(Math.max(1e-4,r),y));
   return new THREE.LatheGeometry(pts,14);
  }
  const point=(pose,index,z=0,dx=0,dy=0)=>new THREE.Vector3((pose.x+(id?-1:1)*(pose.p[index*2]+dx)-640)/160,(602-pose.p[index*2+1]-dy)/160,z);
  const face=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),id?Math.PI:0);
  const at=(index,z=0)=>pose=>({position:point(pose,index,z),quaternion:face,scale:[1,1,1]});
  function limbBone(name,from,to,z,offset=0){
   return joint(name,pose=>{
    const a=point(pose,from,z,offset),b=point(pose,to,z),v=b.clone().sub(a);
    return {position:a.clone().add(b).multiplyScalar(.5),quaternion:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()),scale:[1,v.length(),1]};
   });
  }

  // Keep bones[1..4] as rear_thigh, rear_shin, front_thigh, front_shin for proof compatibility.
  const rThigh=limbBone('rear_thigh',0,7,-.11,-5);
  piece(rThigh,muscleProfile([[-.5,.15],[-.42,.95],[-.1,1.06],[.25,.84],[.46,.66],[.5,.12]]),[0,0,0],[.128,1,.118],ink);

  const rShin=limbBone('rear_shin',7,8,-.11);
  piece(rShin,muscleProfile([[-.5,.15],[-.42,.92],[-.18,1.05],[.18,.78],[.46,.62],[.5,.12]]),[0,0,0],[.086,1,.086],darkSuit);

  const fThigh=limbBone('front_thigh',0,9,.11,5);
  piece(fThigh,muscleProfile([[-.5,.15],[-.42,.96],[-.08,1.08],[.25,.85],[.46,.66],[.5,.12]]),[0,0,0],[.134,1,.122],cloth);

  const fShin=limbBone('front_shin',9,10,.11);
  piece(fShin,muscleProfile([[-.5,.15],[-.42,.94],[-.18,1.06],[.18,.80],[.46,.63],[.5,.12]]),[0,0,0],[.09,1,.088],cloth);
  // Sculpted front shin-guard plate & knee cap
  piece(fShin,box(),[fSign*.058,-.02,0],[.042,.72,.11],accent);
  piece(fShin,sphere(),[fSign*.035,-.44,0],[.078,.09,.082],ink);

  // Rear arm & forearm
  const rArm=limbBone('rear_arm',1,3,-.16,-6);
  piece(rArm,muscleProfile([[-.5,.18],[-.38,1.02],[-.05,.96],[.38,.76],[.5,.14]]),[0,0,0],[.084,1,.082],ink);
  piece(rArm,sphere(),[0,-.34,-.015],[.095,.18,.102],darkSuit);

  const rFore=limbBone('rear_forearm',3,4,-.16);
  piece(rFore,muscleProfile([[-.5,.16],[-.36,1.0],[-.08,1.02],[.35,.74],[.5,.14]]),[0,0,0],[.068,1,.066],darkSuit);
  piece(rFore,new THREE.CylinderGeometry(.82,.92,1,12),[0,.16,0],[.072,.44,.07],accent);

  // Athletic V-tapered torso (from hip y=-0.5 up to broad chest/shoulders y=+0.5)
  const body=limbBone('body',0,1,0);
  piece(body,muscleProfile([
   [-.52,.15],[-.44,.78],[-.24,.74],[.0,.86],[.26,1.02],[.42,.98],[.51,.62],[.55,.15]
  ]),[0,0,0],[.178,1,.215],cloth);
  // Sculpted pectoral / sternum armor plate on chest front
  piece(body,box(),[fSign*.115,.16,0],[.09,.44,.32],accent);
  piece(body,box(),[fSign*.13,.34,0],[.065,.12,.36],ink);

  // Neck & high collar
  const neck=limbBone('neck',1,2,.01);
  piece(neck,new THREE.CylinderGeometry(.058,.068,1,12),[0,-.12,0],[1,.68,1],ink);
  piece(neck,new THREE.CylinderGeometry(.095,.105,1,14),[0,-.36,0],[.9,.22,1.05],ink);

  // Pelvis compression shorts & crisp martial-arts belt (NO protruding sash/tail!)
  const belt=joint('belt',at(0));
  piece(belt,sphere(),[0,-.02,0],[.158,.118,.178],ink);
  piece(belt,new THREE.CylinderGeometry(1,1,1,16),[0,.04,0],[.160,.075,.184],ink);
  piece(belt,box(),[.152,.04,0],[.035,.068,.11],accent);

  // Front arm, deltoid pad & forearm bracer
  const fArm=limbBone('front_arm',1,5,.17,6);
  piece(fArm,muscleProfile([[-.5,.18],[-.38,1.04],[-.05,.98],[.38,.76],[.5,.14]]),[0,0,0],[.086,1,.086],cloth);
  piece(fArm,sphere(),[0,-.34,.018],[.102,.19,.108],cloth);
  piece(fArm,box(),[fSign*.04,-.34,.055],[.09,.06,.08],accent);

  const fFore=limbBone('front_forearm',5,6,.17);
  piece(fFore,muscleProfile([[-.5,.16],[-.36,1.0],[-.08,1.04],[.35,.74],[.5,.14]]),[0,0,0],[.072,1,.07],cloth);
  piece(fFore,new THREE.CylinderGeometry(.82,.94,1,12),[0,.16,0],[.076,.46,.074],accent);

  // Striking MMA / boxing gloves
  for(const [name,index,z] of [['rear_hand',4,-.16],['front_hand',6,.17]]){
   const b=joint(name,at(index,z));
   piece(b,sphere(),[.02,0,0],[.092,.078,.078],ink);
   piece(b,box(),[-.045,0,0],[.045,.072,.076],accent);
  }

  // Crisp martial-arts boots with flat grounded sole & accent trim
  for(const [name,index,z] of [['rear_boot',8,-.11],['front_boot',10,.11]]){
   const b=joint(name,at(index,z));
   piece(b,new THREE.CylinderGeometry(.058,.068,.10,12),[-.01,.062,0],[1,1,1],ink);
   piece(b,sphere(),[.055,.024,0],[.138,.054,.076],ink);
   piece(b,box(),[.05,-.012,0],[.265,.022,.136],accent);
  }

  // Sleek rounded human helmet (1:7.5 head-to-height ratio) + glowing visor slit
  const head=joint('head',at(2,.01));
  piece(head,sphere(),[.01,-.015,0],[.142,.156,.134],ink);
  // Sculpted jawline / chin guard (no snout!)
  piece(head,sphere(),[.04,-.065,0],[.108,.092,.112],ink);
  // Wrap-around bright visor slit
  piece(head,box(),[.108,-.008,0],[.082,.046,.225],visor);
  piece(head,box(),[.114,-.008,0],[.076,.028,.215],accent);
  // Subtle low-profile crown detail (zero spikes or tails)
  if(id){
   piece(head,new THREE.CylinderGeometry(.042,.042,.285,12).rotateX(Math.PI*.5),[-.01,-.01,0],[1,1,1],accent);
   piece(head,box(),[-.01,.132,0],[.18,.026,.09],cloth);
  }else{
   piece(head,box(),[.01,.136,0],[.20,.032,.052],cloth);
   piece(head,box(),[.02,.148,0],[.16,.02,.032],accent);
  }

  const mesh=new THREE.SkinnedMesh(mergeGeometries(parts),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,metalness:.06}));
  mesh.name=prefix;mesh.userData.counterform=id;mesh.add(root);mesh.bind(new THREE.Skeleton(bones));scene.add(mesh);
  const times=Array.from({length:145},(_,i)=>i/30);
  for(const {b,sample} of descriptors){
   const pos=[],rot=[],sc=[];
   for(const t of times){const v=sample(motion.pose(id,t));pos.push(...v.position.toArray());rot.push(...v.quaternion.toArray());sc.push(...v.scale);}
   tracks.push(new THREE.VectorKeyframeTrack(b.name+'.position',times,pos),new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,rot),new THREE.VectorKeyframeTrack(b.name+'.scale',times,sc));
  }
  clips.push(new THREE.AnimationClip(prefix,4.8,tracks));
 }
 return {scene,clips,clip:clips[0]};
}
