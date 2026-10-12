import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {human,robot,mesh,box,poseActor,poseFace,MOUTHS} from './actors.js';

export const W=1280,H=720;
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const lerp=(a,b,t)=>a+(b-a)*t;
const material=(c,e={})=>new T.MeshStandardMaterial({color:c,roughness:.6,...e});
let dataPromise;
export function loadData(){return dataPromise??=fetch(new URL('../../assets/dialogue/manifest.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error('Dialogue manifest failed');return r.json();}).then(d=>{if(d.version!==1||!d.films)throw new Error('Unsupported dialogue manifest');return d;});}
export function mouthAt(turn,t){
 if(!turn||t<turn.start||t>=turn.end)return{value:MOUTHS.X,id:'X'};
 const s=t-turn.start,cs=turn.mouth;let i=cs.findIndex(c=>s>=c.start&&s<c.end);if(i<0)return{value:MOUTHS.X,id:'X'};
 const c=cs[i],a=MOUTHS[c.value],prev=MOUTHS[cs[i-1]?.value||'X'],blend=ease((s-c.start)/Math.min(.045,(c.end-c.start)*.4));
 return{value:a.map((v,j)=>lerp(prev[j],v,blend)),id:c.value};
}
export function activeTurn(spec,t){return spec.turns.find(l=>t>=l.start&&t<l.end);}

function scenery(scene){
 const dark=material('#131e30'),steel=material('#294354',{metalness:.45}),gold=material('#ab7650',{metalness:.45}),keys=[material('#294154'),material('#243547'),material('#203344')];
 box(scene,22,.30,17,material('#182331',{roughness:.32}),0,-.49,0,.12);
 box(scene,9.8,.20,4.3,steel,0,-.25,.15,.14);
 for(let row=0;row<5;row++)for(let col=0;col<15;col++){
  const x=(col-7)*.615+(row%2)*.075,z=(row-2)*.71+.2;
  box(scene,.55,.15,.60,keys[(row+col)%3],x,-.08,z,.055);
  if((row+col)%4===0)box(scene,.18,.003,.025,gold,x,.001,z-.12,.001);
 }
 box(scene,.96,.52,.7,keys[1],-1.27,.18,-.46,.065);
 // A few foreground keys frame the stage without obstructing the actors.
 box(scene,3,.16,.58,keys[1],0,-.08,2.31,.055);
 const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;const g=canvas.getContext('2d');
 g.fillStyle='#101b2b';g.fillRect(0,0,1600,900);g.fillStyle='#63cab6';g.font='600 25px monospace';g.fillText('NIGHT SHIFT / MOTION STUDIO',90,75);
 const labels=['LAUNCH / DELIVERY','RENDER QUEUE','PROJECT FILES','THE FINAL FINAL'];
 for(let i=0;i<4;i++){
  const x=70+(i%2)*760,y=120+Math.floor(i/2)*365;g.fillStyle='#19283b';g.beginPath();g.roundRect(x,y,700,325,24);g.fill();g.strokeStyle='#34475c';g.stroke();
  g.fillStyle='#bad3d5';g.font='bold 25px monospace';g.fillText(labels[i],x+35,y+48);
  g.fillStyle=i===3?'#d79c52':'#75b5b9';g.font='23px monospace';
  const texts=i===0?['Sequence_08 / composite','Colour / approved','Delivery / almost there']:i===1?['Rendering final frames...','99%','Just one more moment.']:i===2?['final.mp4','final_final.mp4','actually_final.mp4']:['Director: Mira','Assistant: Pip','Deadline: yesterday'];
  texts.forEach((str,j)=>g.fillText(str,x+35,y+110+j*55));
  if(i===1){g.fillStyle='#304658';g.fillRect(x+35,y+270,600,9);g.fillStyle='#d59851';g.fillRect(x+35,y+270,589,9);}
 }
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
 box(scene,11.3,6.5,.35,dark,0,3.3,-4.5,.18);
 mesh(scene,new T.PlaneGeometry(10.7,6.0),new T.MeshBasicMaterial({map:texture}),0,3.35,-4.31);
 box(scene,.5,1.2,.5,steel,0,.3,-4.45,.05);
 // Practical lights and their defocused reflections create depth around the screen.
 const bulb=material('#ffe0a5',{emissive:'#ffa345',emissiveIntensity:3});
 for(let i=0;i<25;i++){
  const side=i%2?1:-1;const x=side*(6.1+(i%3)*.27),y=.5+(i%9)*.5,z=-3.8-(i%4)*.32;
  mesh(scene,new T.SphereGeometry(.035+(i%4)*.01,8,6),bulb,x,y,z);
 }
 const lamp=new T.Group();lamp.position.set(-4.9,0,-1.8);scene.add(lamp);
 box(lamp,.75,.1,.65,gold,0,0,0,.06);mesh(lamp,new T.CylinderGeometry(.045,.045,3.1,8),gold,0,1.6,0);
 const shade=mesh(lamp,new T.ConeGeometry(.65,.52,16,1,true),gold,.25,3.05,0);shade.rotation.z=-.32;
 mesh(lamp,new T.SphereGeometry(.13,12,8),bulb,.31,2.86,0);
 const mug=material('#b57e58',{roughness:.35});mesh(scene,new T.CylinderGeometry(.36,.28,.62,16),mug,4.7,.12,-1.2);mesh(scene,new T.TorusGeometry(.24,.065,8,20),mug,5,.17,-1.2);
 // Seeded suspended dust; positions are authored from absolute time in frame().
 const geo=new T.BufferGeometry(),positions=new Float32Array(90*3);for(let i=0;i<90;i++){positions[i*3]=Math.sin(i*127.1)*7;positions[i*3+1]=(Math.sin(i*61.7)*.5+.5)*5;positions[i*3+2]=Math.sin(i*31.9)*5-1;}
 geo.setAttribute('position',new T.BufferAttribute(positions,3));const dust=new T.Points(geo,new T.PointsMaterial({color:'#e6b977',size:.018,transparent:true,opacity:.42,depthWrite:false}));scene.add(dust);
 return{dust};
}

const gestures={
 ask:{targetL:[-.62,-.02,.25],targetR:[.68,.15,.36],brow:.3,roll:-.07},
 proud:{targetL:[-.77,.08,.30],targetR:[.72,.39,.30],brow:.6,tilt:-.035},
 doubt:{targetL:[-.43,.78,.24],targetR:[.53,-.15,.1],brow:-.1,asym:1,roll:.13},
 explain:{targetL:[-.67,-.08,.30],targetR:[.73,.42,.24],brow:.45,roll:-.08},
 plead:{targetL:[-.23,.13,.57],targetR:[.23,.13,.57],worry:.7,brow:.2,lean:-.08},
 count:{targetL:[-.79,.0,.19],targetR:[.43,.63,.30],brow:.35,roll:.065},
 question:{targetL:[-.68,.14,.40],targetR:[.68,.14,.4],asym:.7,brow:-.15,roll:-.10},
 reveal:{targetL:[-.62,-.15,.2],targetR:[.70,.25,.35],brow:.4,tilt:.04},
 perform:{targetL:[-.63,.06,.35],targetR:[.62,.42,.35],brow:.45,roll:-.05},
};
function animation(actor,spec,t){
 const isM=actor.type==='mira',rest={turn:isM?.18:-.22,gaze:isM?.12:-.16,nod:0,roll:0,brow:0,curl:.20};
 const turn=spec.turns.find(l=>l.speaker===actor.type&&t>=l.start-.22&&t<l.end+.35);
 if(turn){
  const a=gestures[turn.gesture],u=t-turn.start,w=ease((u+.22)/.35)*(1-ease((t-turn.end)/.35)),beat=Math.sin(u*5.4)*.035;
  for(const k of ['brow','roll','asym','worry','tilt','lean'])rest[k]=(a[k]||0)*w;
  rest.nod=beat*w;rest.gaze*=1-w*.6;
  for(const [key,s] of [['targetL',-1],['targetR',1]]){
   const base=[s*(isM?.44:.61),isM?-.44:-.59,.06];rest[key]=a[key].map((v,i)=>lerp(base[i],v+(i===1?beat:0),w));
  }
  rest.wrist=-.25*w;rest.curl=.24+.06*Math.sin(u*2);rest.surprise=turn.gesture==='question'?.25:0;
  if(turn.gesture==='count'){rest.targetR[1]+=.05*Math.sin(u*8);rest.curl=.6;}
  if(turn.gesture==='perform'){rest.targetR[0]+=.1*Math.sin(u*2);rest.asym=.25*Math.sin(u*1.7);rest.surprise=.2*Math.max(0,Math.sin(u*2));}
 }else{
  // Listening is authored too: look at the speaker, anticipate, then let a reaction land.
  const current=activeTurn(spec,t);rest.nod=.012*Math.sin(t*3);rest.asym=isM?.28:0;
  if(current?.gesture==='explain'&&isM){rest.roll=.12;rest.squint=.4;rest.brow=-.3;}
  if(current?.gesture==='count'&&isM){rest.targetL=[-.44,.78,.25];rest.roll=-.12;rest.worry=.5;rest.nod=.08;}
  if(t>spec.turns.at(-1).start&&isM&&spec.turns.length>1){rest.roll=-.06;rest.gaze=lerp(.22,-.18,ease((t-spec.turns.at(-1).end)/.6));rest.squint=.5;rest.asym=1;rest.nod=.04;}
 }
 return rest;
}

export async function createFilm(name='character-dialogue'){
 const data=await loadData(),spec=data.films[name];if(!spec)throw new Error('Unknown dialogue film');
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d',{willReadFrequently:false});
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.17;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 const scene=new T.Scene();scene.background=new T.Color('#101b2b');scene.fog=new T.FogExp2('#101b2b',.018);
 const camera=new T.PerspectiveCamera(36,W/H,.1,60);
 scene.add(new T.HemisphereLight('#b1d1f0','#323946',1.6));
 const key=new T.DirectionalLight('#ffce98',4.4);key.position.set(-3.5,5,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-7;key.shadow.camera.right=7;key.shadow.camera.top=6;key.shadow.camera.bottom=-5;key.shadow.bias=-.0002;key.shadow.normalBias=.025;scene.add(key);
 const rim=new T.DirectionalLight('#72c8ff',3.2);rim.position.set(3,4,-4);scene.add(rim);
 const glow=new T.PointLight('#ffc17a',12,12,2);glow.position.set(-3.5,2.5,1);scene.add(glow);
 const set=scenery(scene),mira=human(scene),pip=robot(scene);mira.root.position.x=-1.27;pip.root.position.x=1.25;pip.root.position.z=.12;
 const rt=new T.WebGLRenderTarget(W,H,{type:T.HalfFloatType});rt.samples=4;const composer=new EffectComposer(renderer,rt);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new T.Vector2(W,H),.24,.4,.92);composer.addPass(bloom);
 const bokeh=new BokehPass(scene,camera,{focus:7,aperture:.0022,maxblur:.016});// Dust is transparent and must not be rendered with the mesh-only depth
 // override. MeshDepthMaterial does not define a point size for Points.
 const depthRender=bokeh.render.bind(bokeh);bokeh.render=(...args)=>{set.dust.visible=false;try{return depthRender(...args);}finally{set.dust.visible=true;}};
 composer.addPass(bokeh);composer.addPass(new OutputPass());
 const proof={};
 function frame(seconds,{captions=true,branding=true,cameraMode}={}){
  if(!Number.isFinite(seconds))throw new Error('Time must be finite');const t=clamp(seconds,0,spec.duration),active=activeTurn(spec,t),single=name==='character-lipsync';
  for(const actor of [mira,pip]){
   const pose=animation(actor,spec,t);if(!single&&actor.type==='mira'){const down=spec.turns[4].start-.3,up=spec.turns[6].start-.5;pose.sit=ease((t-down)/.5)*(1-ease((t-up)/.55));pose.y=-.32*pose.sit;pose.lean=(pose.lean||0)+pose.sit*.09;}poseActor(actor,t,pose);const turn=spec.turns.find(l=>l.speaker===actor.type&&t>=l.start&&t<l.end),mouth=mouthAt(turn,t);poseFace(actor.face,mouth.value,pose,t,pose.gaze*3);proof[actor.type]={mouth:mouth.id,speaking:!!turn};
  }
  pip.root.visible=!single;
  // Deliberate cuts: establish space, question, answer, reaction, final two-shot.
  let shot='wide',progress=0;
  if(single)shot='mira';
  else if(t>.65){let i=spec.turns.findIndex(l=>t<l.end+.17);if(i<0)i=spec.turns.length-1;const line=spec.turns[i];shot=line.speaker;progress=clamp((t-line.start)/(line.end-line.start));if(i===4||t>spec.turns.at(-1).end+.22)shot='wide';}
  if(cameraMode)shot=cameraMode;
  const pos=shot==='mira'?[-1.12- .1*progress,2.08,4.17-.14*progress]:shot==='pip'?[1.88,1.72,3.44-.12*progress]:[.24,2.32,6.75-.13*ease(t/spec.duration)];
  const target=shot==='mira'?[-1.25,1.80+mira.root.position.y*.75,0]:shot==='pip'?[1.25,1.11,.08]:[0,1.30,0];
  if(single){pos[0]=-1.2+Math.sin(t*.3)*.1;pos[2]=3.5;target[1]=1.92;}
  camera.position.set(...pos);camera.lookAt(...target);camera.updateMatrixWorld();
  bokeh.uniforms.focus.value=camera.position.distanceTo(new T.Vector3(...target));set.dust.rotation.y=t*.007;
  composer.render(0);if(renderer.getContext().isContextLost())throw new Error('Dialogue renderer lost WebGL context');
  ctx.clearRect(0,0,W,H);ctx.drawImage(renderer.domElement,0,0);
  const vignette=ctx.createRadialGradient(640,320,180,640,340,760);vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#050a1990');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
  if(branding){ctx.fillStyle='#f1d9b0';ctx.font='600 14px Arial';ctx.letterSpacing='3px';ctx.fillText(single?'SAY IT. MEAN IT.':'THE FINAL FINAL',48,45);ctx.letterSpacing='0px';ctx.fillStyle='#a8bdc5';ctx.font='12px Arial';ctx.fillText('MOTION FX LAB / NIGHT SHIFT',48,66);}
  if(captions&&active){
   const lines=wrap(ctx,active.text,980,28),h=lines.length*36+30,y=H-42-h;
   ctx.fillStyle='#071321cb';ctx.beginPath();ctx.roundRect(640-Math.min(1050,Math.max(...lines.map(l=>ctx.measureText(l).width))+74)/2,y,Math.min(1050,Math.max(...lines.map(l=>ctx.measureText(l).width))+74),h,14);ctx.fill();
   ctx.fillStyle=active.speaker==='mira'?'#ffdc9e':'#b1f4dd';ctx.textAlign='center';ctx.font='600 28px Arial';lines.forEach((l,i)=>ctx.fillText(l,640,y+36+i*36));ctx.textAlign='left';
  }
  Object.assign(proof,{time:t,shot,speaker:active?.speaker||null});return canvas;
 }
 return{canvas,spec,data,frame,proof:()=>structuredClone(proof),dispose(){composer.dispose();bokeh.dispose();bloom.dispose();scene.traverse(o=>{o.geometry?.dispose();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>{m.map?.dispose();m.dispose();});}});renderer.dispose();}};
}
function wrap(ctx,value,max,size){ctx.font=`600 ${size}px Arial`;const lines=[''];for(const w of value.split(' ')){const i=lines.length-1,next=lines[i]?lines[i]+' '+w:w;if(ctx.measureText(next).width>max&&lines[i])lines.push(w);else lines[i]=next;}return lines;}
