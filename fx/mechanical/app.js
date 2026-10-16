import {THREE} from './vendor.js';
import {createStage} from './stage.js';
import {createTurbofan} from './turbofan.js';
import {createMechanism} from './mechanism.js';
import {capGeometry,sectionMaterial} from './geometry.js';
import {validTime,phase,assemblyAmount,assemblyOffset,shares,DURATION,TAU} from './model.js';
export const FILMS={
 'mechanical-assembly':{title:'Apart. Together.',duration:DURATION,poster:7.8},
 'mechanical-cutaway':{title:'Inside the machine.',duration:DURATION,poster:7.2},
 'mechanical-linkage':{title:'One turn. Everything moves.',duration:DURATION,poster:6.6},
};
const MODES={'mechanical-assembly':'assembly','mechanical-cutaway':'cutaway','mechanical-linkage':'linkage'};
export function create(id,options={}){
 const mode=MODES[id]||id;if(!['assembly','cutaway','linkage'].includes(mode))throw Error('Unknown mechanical operation '+id);
 const s=createStage({paper:true,...options}),subject=mode==='linkage'?createMechanism():createTurbofan();s.scene.add(subject.root);
 subject.root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
 const caps=[],plane=new THREE.Plane(new THREE.Vector3(0,0,-1),2.1),clipMaterials=new Set();
 let flow,flowPositions,flowColor,proof,lastCut;
 if(mode==='cutaway'){
  const profiles=new Map();
  for(const shell of subject.shells)shell.traverse(o=>{if(!o.isMesh)return;
   const mat=o.material;mat.clippingPlanes=[plane];mat.clipShadows=true;clipMaterials.add(mat);
   if(o.userData.shell){const p=o.userData.shell.profile;profiles.set(JSON.stringify(p),p);}
  });
  for(const profile of profiles.values()){
   const mesh=new THREE.Mesh(new THREE.BufferGeometry(),sectionMaterial());mesh.castShadow=true;subject.eng.add(mesh);caps.push({mesh,profile});
  }
  const count=360;flowPositions=new Float32Array(count*3);flowColor=new Float32Array(count*3);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(flowPositions,3));geo.setAttribute('color',new THREE.BufferAttribute(flowColor,3));
  flow=new THREE.Points(geo,new THREE.PointsMaterial({size:.026,vertexColors:true,transparent:true,opacity:.75,depthWrite:false}));subject.eng.add(flow);
 }
 const triangleCount=()=>{let n=0;subject.root.traverse(o=>{if(o.isMesh)n+=(o.geometry.index?.count??o.geometry.attributes.position?.count??0)/3});return Math.round(n)};
 const triangles=triangleCount();
 function updateCut(z){
  plane.constant=z;if(z===lastCut)return;lastCut=z;
  for(const cap of caps){cap.mesh.geometry.dispose();cap.mesh.geometry=capGeometry(cap.profile,z);cap.mesh.visible=(cap.mesh.geometry.attributes.position?.count??0)>0;}
 }
 function annotate(t,state){
  const meta=FILMS[id]||Object.values(FILMS).find(x=>x.title===({assembly:'Apart. Together.',cutaway:'Inside the machine.',linkage:'One turn. Everything moves.'})[mode]);
  const ink=s.paper?'#262b2d':'#eee9df',muted=s.paper?'#62676a':'#a9b1b6',accent=s.paper?'#9b4e29':'#e4ab72';
  s.text('MOTION FX LAB / MECHANICAL STUDIES',88,65,17,muted,'mono');
  s.text(meta.title,84,145,mode==='linkage'?63:76,ink,'serif');
  const sub=mode==='assembly'?'Every assembly has a way out.':mode==='cutaway'?'A moving section. A working core.':'20 → 40 teeth. One connected mechanism.';
  s.text(sub,88,192,24,muted);
  const tag=mode==='assembly'?(state.amount<.08?'THE WHOLE':t<8.8?'TAKE IT APART':'BRING IT HOME'):mode==='cutaway'?(state.cutZ>.9?'THE OUTSIDE':'THE INSIDE'):'THE SAME CLOCK, EVERY PART';
  s.text(tag,88,1005,18,accent,'mono');
  if(mode==='linkage'){s.text('INPUT   '+state.rpm.toFixed(1)+' RPM',1832,958,20,ink,'mono','right');s.text('OUTPUT  '+state.outputRpm.toFixed(1)+' RPM',1832,999,20,accent,'mono','right');}
  else s.text(mode==='assembly'?'SPLIT / WITHDRAW / REASSEMBLE':'20 FAN BLADES / 10 COMPRESSOR STAGES',1832,1005,17,muted,'mono','right');
 }
 function frame(seconds,o={}){
  const t=validTime(seconds);let state;
  if(mode==='linkage')state=subject.pose(t,o);
  else{
   const amount=o.explode??(mode==='assembly'?assemblyAmount(t):0),q=shares(amount);
   for(const part of subject.parts){const off=assemblyOffset(part.name,q);part.obj.position.copy(part.base).add(new THREE.Vector3(...off));}
   // Slow the spools only while they are being serviced. Each angle is absolute, not accumulated.
   subject.lp.rotation.y=mode==='assembly'?.7*Math.sin(t*.38)*(1-phase(amount,0,.2)):t*TAU*.62;
   subject.hp.rotation.y=mode==='assembly'?-t*.3*(1-phase(amount,0,.2)):-t*TAU*.95;
   const heat=phase(t,2,5)*(1-phase(t,10.5,13));subject.flameM.emissiveIntensity=mode==='cutaway'?.8+heat*1.5:.35;
   for(const m of [subject.hptTBC,subject.lptNi,subject.liner,subject.plugM])m.userData.heat.value=850+600*heat;
   const cutZ=o.cutZ??(2.05-2.25*phase(t,1.8,4.8)*(1-phase(t,10.2,12.8)));
   if(mode==='cutaway'){
    updateCut(cutZ);flow.visible=heat>.01;
    for(let i=0;i<flowPositions.length/3;i++){
     const u=((i*.61803398875+t*.24)%1+1)%1,a=i*2.399963,r=i%3===0?.48:.93+.17*Math.sin(i*3.7),ax=-.6+5.9*u;
     flowPositions.set([r*Math.cos(a),2.45-ax,r*Math.sin(a)],i*3);
     const hot=phase(u,.48,.65);flowColor.set([.17+.83*hot,.48-.12*hot,.95-.83*hot],i*3);
    }flow.geometry.attributes.position.needsUpdate=true;flow.geometry.attributes.color.needsUpdate=true;
   }
   state={amount,shares:q,cutZ,heat};
  }
  const az=mode==='assembly'?.55+.55*phase(state.amount,.1,.8)+.2*Math.sin(t*.4):mode==='cutaway'?.36+.28*Math.sin(t/DURATION*TAU-.3):.12+.40*Math.sin(t/DURATION*TAU-.3);
  const el=mode==='linkage'?.15+.08*Math.sin(t*.45):.24+.06*Math.sin(t*.32);
  const fitting=s.fit(subject.root,{az:o.cameraAngle??az,el,fill:.87,verticalFill:o.labels===false?.86:.67});if(!o.auditOnly)s.render();
  if(o.labels!==false&&!o.auditOnly)annotate(t,state);
  const corners=fitting.points.map(p=>p.clone().project(s.camera).toArray());
  proof={mode,time:t,...state,triangles,caps:mode==='cutaway'?caps.filter(c=>c.mesh.visible).length:0,fanBlades:mode==='linkage'?undefined:20,compressorStages:mode==='linkage'?undefined:10,bounds:corners,sourceClock:'absolute time',materialCount:clipMaterials.size};
  return proof;
 }
 return{canvas:s.canvas,frame,proof:()=>proof,subject,stage:s,caps,plane};
}
