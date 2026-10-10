import {THREE,stage,text,spectrum,PALETTES} from './stage.js';
import {Signals,clamp,mix,ease,finiteTime} from './data.js';
import {actor,sampleSkin} from '../studio/scene.js';

export function orbitClock(t,onsets){
  const first=onsets.find(x=>x>=1.1&&x<2),second=onsets.find(x=>x>=6&&x<6.6);
  if(first===undefined||second===undefined)throw new Error('Impact / Orbit needs measured attacks in 1.1–2.0s and 6.0–6.6s; edit the cue windows for this score.');
  let sourceTime,held=false,angle;
  if(t<first){sourceTime=2.6+.6*t/first;angle=-.12*(1-t/first);}
  else if(t<4.8){sourceTime=3.2;held=true;angle=Math.PI*2*ease(t,first,4.8);}
  else if(t<second){sourceTime=mix(0,.6,ease(t,4.8,second));angle=Math.PI*2;}
  else if(t<9.6){sourceTime=.6;held=true;angle=Math.PI*2+2.2*ease(t,second,9.6);}
  else{sourceTime=mix(.6,2.2,ease(t,9.6,12));angle=Math.PI*2+mix(2.2,.35,ease(t,9.6,12));}
  return{sourceTime,held,angle,first,second};
}
export async function createOrbit({signalsUrl}={}){
  const data=await Signals.load(signalsUrl),s=stage(),fighters=await Promise.all([actor('#ff7b3e',31,undefined,0),actor('#61dee3',91,undefined,1)]);
  fighters.forEach(f=>s.scene.add(f.root));
  const gradient=new THREE.DataTexture(new Uint8Array([30,30,30,255,135,135,135,255,255,255,255,255]),3,1);gradient.magFilter=gradient.minFilter=THREE.NearestFilter;gradient.needsUpdate=true;
  const materials=[];
  for(const f of fighters)for(const mesh of f.meshes){
    const lit=mesh.material;lit.roughness=.34;lit.metalness=.18;
    const cel=new THREE.MeshToonMaterial({color:'#fff7e0',vertexColors:true,gradientMap:gradient});
    const mono=new THREE.MeshToonMaterial({color:'#fff5d4',gradientMap:gradient});
    materials.push({mesh,lit,cel,mono});
  }
  const ambient=new THREE.HemisphereLight('#d9f0fb','#162033',1.1);s.scene.add(ambient);
  const key=new THREE.DirectionalLight('#fff5d9',3.6),rim=new THREE.DirectionalLight('#56e0ff',3);s.scene.add(key,rim);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshBasicMaterial({color:'#163be9'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.08;s.scene.add(floor);
  const grid=new THREE.GridHelper(40,40,'#83a6ff','#83a6ff');grid.position.y=-.075;grid.material.transparent=true;grid.material.opacity=.2;s.scene.add(grid);
  const circle=new THREE.Mesh(new THREE.TorusGeometry(3.45,.028,6,180),new THREE.MeshBasicMaterial({color:'#d4ff6d'}));circle.position.set(0,1.4,-.3);s.scene.add(circle);
  const bars=[];
  for(let i=0;i<48;i++){const bar=new THREE.Mesh(new THREE.BoxGeometry(.035,1,.035),new THREE.MeshBasicMaterial({color:'#cbff63'}));bar.position.set((i/47-.5)*11,.5,-3.2);s.scene.add(bar);bars.push(bar);}
  // A long cast-looking contact ellipse is deliberately graphic, not a fluid or shadow simulation.
  for(const x of [-1.5,1.5]){const disc=new THREE.Mesh(new THREE.CircleGeometry(.9,48),new THREE.MeshBasicMaterial({color:'#061b66',transparent:true,opacity:.28,depthWrite:false}));disc.rotation.x=-Math.PI/2;disc.position.set(x,-.07,0);disc.scale.y=.55;s.scene.add(disc);}
  const samples=[];let sampleCount=0;
  for(const f of fighters){f.pose(0);for(const mesh of f.meshes){const sample=sampleSkin(mesh,1800,71+sampleCount);samples.push({sample,offset:sampleCount});sampleCount+=sample.count;}}
  const positions=new Float32Array(sampleCount*3),colors=new Float32Array(sampleCount*3);
  const coat=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.048,0),new THREE.MeshStandardMaterial({roughness:.48,metalness:.22}),sampleCount);
  coat.frustumCulled=false;s.scene.add(coat);
  const transform=new THREE.Object3D(),color=new THREE.Color();
  let proof;
  return{canvas:s.canvas,data,proof:()=>proof,frame(seconds,o={}){
    const t=clamp(finiteTime(seconds),0,12),audio=data.audio(o.audioTime??t),clock=orbitClock(t,data.audioSpec.onsets),pose=o.sourceTime??clock.sourceTime,angle=o.cameraAngle??clock.angle,lightTime=o.lightTime??t;
    if(![pose,angle,lightTime].every(Number.isFinite))throw new Error('Orbit clocks must be finite');
    fighters.forEach(f=>f.pose(pose));
    const phase=Math.floor(t/1.2)%4,palette=PALETTES[phase];
    s.scene.background=new THREE.Color(palette.bg);floor.material.color.set(palette.bg).multiplyScalar(.64);circle.material.color.set(palette.accent);
    for(const m of materials)m.mesh.material=phase===3?m.mono:phase===1?m.cel:m.lit;
    ambient.intensity=phase===3?.35:1.1;
    samples.forEach(({sample,offset})=>sample.write(positions,colors,offset));
    const age=clock.held?t-(t<4.8?clock.first:clock.second):0;
    for(let i=0;i<sampleCount;i++){
      const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2],near=Math.exp(-(x*x+(y-1.45)**2+z*z)/1.3);
      const scatter=clock.held&&i%4===0?near*Math.min(1,age*3)*(.15+.65*audio.envelope):0;
      transform.position.set(x+Math.sin(i*13.1)*scatter,y+Math.cos(i*7.7)*scatter,z+Math.sin(i*5.3)*scatter);
      transform.rotation.set(i*.17+age,i*.31+age*.7,i*.13);transform.scale.setScalar((phase===1?1.3:.65)+scatter*1.2);transform.updateMatrix();coat.setMatrixAt(i,transform.matrix);
      color.fromArray(colors,i*3);coat.setColorAt(i,color);
    }
    coat.instanceMatrix.needsUpdate=true;coat.instanceColor.needsUpdate=true;
    coat.visible=clock.held;fighters.forEach(f=>f.root.visible=phase!==1||!clock.held);
    const radius=6.4-.28*audio.envelope;
    s.camera.position.set(Math.sin(angle)*radius,2.2+Math.sin(angle*.7)*.7,Math.cos(angle)*radius);s.camera.lookAt(0,1.35,0);
    key.position.set(Math.cos(lightTime*.9)*4,5,Math.sin(lightTime*.9)*4);key.color.set(palette.light);key.intensity=phase===3?1.0:3.4+audio.envelope*.8;
    rim.position.set(-key.position.x,2.8,-key.position.z);rim.color.set(palette.accent);rim.intensity=phase===3?.5:2.8;
    bars.forEach((bar,i)=>{const height=.08+audio.bands[Math.floor(i/48*32)]*2.7;bar.scale.y=height;bar.position.y=height/2;bar.material.color.set(palette.accent);});
    circle.rotation.y=Math.sin(t*.4)*.12;
    s.render();
    if(o.labels!==false){const ink=phase===1?'#153934':'#fff8e4';text(s.g,'IMPACT / ORBIT',42,48,19,ink);spectrum(s.g,audio,ink,35);
      text(s.g,clock.held?'HOLD THE HIT.':t<1.2?'MAKE CONTACT.':'LET IT GO.',44,627,52,ink,900);
      if(clock.held)text(s.g,'MOVE THE WORLD.',1234,625,26,ink,800,'right');
    }
    proof={mode:'freeze-orbit',sourceTime:pose,held:clock.held,camera:s.camera.position.toArray(),light:key.position.toArray(),look:phase,sourcePose:fighters.flatMap(f=>f.meshes[0].skeleton.bones[4].quaternion.toArray()),onsets:[clock.first,clock.second],audioIndex:audio.index,rms:audio.rms,geometry:'animated skinned GLB; source pose held independently of camera and lights'};
  }};
}
