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
  const ink='#142b3a',cloth=id?'#258b99':'#eb7044',accent=id?'#69c4c9':'#f9b079',skin='#f7d4a4';
  function joint(name,sample){const b=new THREE.Bone();b.name=prefix+'_'+name;root.add(b);bones.push(b);descriptors.push({b,sample});return b;}
  function piece(b,geo,pos,scale,color){
   geo=geo.index?geo.toNonIndexed():geo;geo.scale(...scale);geo.translate(...pos);
   const n=geo.attributes.position.count,indices=new Uint16Array(n*4),weights=new Float32Array(n*4),colors=new Float32Array(n*3),c=new THREE.Color(color);
   for(let i=0;i<n;i++){indices[i*4]=bones.indexOf(b);weights[i*4]=1;colors.set([c.r,c.g,c.b],i*3);}
   geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));parts.push(geo);
  }
  const sphere=()=>new THREE.SphereGeometry(1,12,8),cylinder=(a=1,b=1)=>new THREE.CylinderGeometry(a,b,1,10,1);
  const point=(pose,index,z=0,dx=0,dy=0)=>new THREE.Vector3((pose.x+(id?-1:1)*(pose.p[index*2]+dx)-640)/160,(602-pose.p[index*2+1]-dy)/160,z);
  const face=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),id?Math.PI:0);
  const at=(index,z=0)=>pose=>({position:point(pose,index,z),quaternion:face,scale:[1,1,1]});
  function segment(name,from,to,width,color,z,offset=0){
   const bone=joint(name,pose=>{const a=point(pose,from,z,offset),b=point(pose,to,z),v=b.clone().sub(a);return {position:a.clone().add(b).multiplyScalar(.5),quaternion:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()),scale:[1,v.length(),1]};});
   piece(bone,cylinder(.85,1),[0,0,0],[width,1,width*.8],color);
   piece(bone,sphere(),[0,.47,0],[width*.85,.055,width*.7],color);
   piece(bone,sphere(),[0,-.47,0],[width,.055,width*.8],color);
   return bone;
  }
  segment('rear_thigh',0,7,.175,ink,-.12,-13);segment('rear_shin',7,8,.125,cloth,-.12);
  segment('front_thigh',0,9,.195,cloth,.13,13);segment('front_shin',9,10,.13,cloth,.13);
  segment('rear_arm',1,3,.105,ink,-.15,-18);segment('rear_forearm',3,4,.085,skin,-.15);
  segment('body',0,1,.225,cloth,0);
  segment('neck',1,2,.07,skin,.02);
  const belt=joint('belt',at(0));piece(belt,new THREE.BoxGeometry(1,1,1),[0,0,0],[.51,.12,.33],ink);
  const sash=joint('sash',pose=>({position:point(pose,0,-.02),quaternion:face.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.sin(pose.p[0]*.02)*.15)),scale:[1,1,1]}));
  const shape=new THREE.Shape();shape.moveTo(-.16,0);shape.lineTo(-.6,.13);shape.lineTo(-.95,.28);shape.lineTo(-.77,-.04);shape.lineTo(-.3,-.12);shape.closePath();
  piece(sash,new THREE.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:false}),[0,0,0],[1,1,1],accent);
  segment('front_arm',1,5,.125,cloth,.19,17);const fore=segment('front_forearm',5,6,.095,skin,.19);
  piece(fore,cylinder(),[0,.3,0],[.10,.24,.085],accent);
  for(const [name,index,z] of [['rear_hand',4,-.15],['front_hand',6,.19]]){const b=joint(name,at(index,z));piece(b,sphere(),[0,0,0],[.10,.10,.095],skin);}
  for(const [name,index,z] of [['rear_boot',8,-.12],['front_boot',10,.13]]){const b=joint(name,at(index,z));piece(b,sphere(),[.04,.02,0],[.19,.075,.12],ink);}
  const head=joint('head',at(2,.025));piece(head,sphere(),[.035,0,0],[.185,.23,.17],skin);
  piece(head,sphere(),[.21,-.015,0],[.065,.05,.10],skin);
  piece(head,new THREE.BoxGeometry(1,1,1),[0,.075,0],[.39,.045,.34],accent);
  piece(head,sphere(),[-.035,.14,0],[.20,.16,.18],ink);
  if(id){piece(head,sphere(),[-.18,.24,0],[.10,.11,.11],ink);piece(head,sphere(),[-.28,.02,0],[.065,.24,.08],ink);}
  else for(let j=0;j<6;j++){const geo=new THREE.ConeGeometry(.08,.24,5);geo.rotateZ((j-2.5)*-.20);piece(head,geo,[-.18+j*.065,.27+(j%2)*.04,0],[1,1,1],ink);}
  piece(head,new THREE.BoxGeometry(1,1,1),[.13,.005,.154],[.055,.025,.025],ink);
  const mesh=new THREE.SkinnedMesh(mergeGeometries(parts),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85}));mesh.name=prefix;mesh.userData.counterform=id;mesh.add(root);mesh.bind(new THREE.Skeleton(bones));scene.add(mesh);
  const times=Array.from({length:145},(_,i)=>i/30);
  for(const {b,sample} of descriptors){const pos=[],rot=[],sc=[];
   for(const t of times){const v=sample(motion.pose(id,t));pos.push(...v.position.toArray());rot.push(...v.quaternion.toArray());sc.push(...v.scale);}
   tracks.push(new THREE.VectorKeyframeTrack(b.name+'.position',times,pos),new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,rot),new THREE.VectorKeyframeTrack(b.name+'.scale',times,sc));
  }
  clips.push(new THREE.AnimationClip(prefix,4.8,tracks));
 }
 return {scene,clips,clip:clips[0]};
}
