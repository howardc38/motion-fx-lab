import {THREE,studioEnvironment} from './vendor.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
const cache=new Map();
export function createStage({width=1280,height=720,paper=false}={}){
 const key=width+'x'+height+paper;
 let shared=cache.get(key);
 if(!shared){
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});renderer.setPixelRatio(1);renderer.setSize(width,height);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1;renderer.localClippingEnabled=true;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
  shared={renderer,env:studioEnvironment(renderer,paper?'paper':'night')};cache.set(key,shared);
  (window.__fxRenderers ||= []).push(renderer);
 }
 const {renderer}=shared,scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,width/height,.05,200);
 scene.background=new THREE.Color(paper?'#eae7df':'#111519');scene.environment=shared.env;
 scene.environmentIntensity=paper?.82:.9;
 scene.add(new THREE.HemisphereLight('#ffffff',paper?'#d9d5cc':'#202020',paper?.22:.18));
 const keyLight=new THREE.DirectionalLight('#fff0d6',2.4);keyLight.position.set(-4,9,6);keyLight.castShadow=true;keyLight.shadow.mapSize.set(2048,2048);keyLight.shadow.radius=7;keyLight.shadow.blurSamples=16;keyLight.shadow.camera.left=-7;keyLight.shadow.camera.right=7;keyLight.shadow.camera.top=7;keyLight.shadow.camera.bottom=-7;keyLight.shadow.normalBias=.018;keyLight.shadow.bias=-.00015;scene.add(keyLight,keyLight.target);
 const rim=new THREE.DirectionalLight('#c8ddf5',.9);rim.position.set(6,4,-5);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshBasicMaterial({color:paper?'#eae7df':'#111519',toneMapped:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-.009;floor.userData.noAO=true;scene.add(floor);
 const contact=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.ShadowMaterial({opacity:paper?.40:.5,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=-.008;contact.receiveShadow=true;contact.userData.noAO=true;scene.add(contact);
 const target=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,samples:4}),composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
 // Three's AO noise is seeded at construction; no history-dependent temporal noise.
 const random=Math.random;let seed=761;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 let ao;try{ao=new GTAOPass(scene,camera,width,height)}finally{Math.random=random}
 ao.blendIntensity=.88;ao.updateGtaoMaterial({radius:.28,distanceExponent:1.6,thickness:.65,scale:1,samples:16});ao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:5,rings:2,samples:16});
 // A global normal override would restore the removed casing in the AO buffer.
 // Match each mesh's clipping planes so the moving section shades the visible geometry.
 const normals=new WeakMap();
 ao._renderOverride=(r,ignored,rt,clear,alpha)=>{
  const oldColor=r.getClearColor(new THREE.Color()),oldAlpha=r.getClearAlpha(),oldAuto=r.autoClear,swaps=[],hidden=[];
  scene.traverse(obj=>{if(!obj.isMesh)return;if(obj.userData.noAO&&obj.visible){obj.visible=false;hidden.push(obj);return}const original=obj.material;
   const normal=m=>{let n=normals.get(m);if(!n){n=new THREE.MeshNormalMaterial({side:m.side,clippingPlanes:m.clippingPlanes,clipIntersection:m.clipIntersection});normals.set(m,n)}return n};swaps.push([obj,original]);obj.material=Array.isArray(original)?original.map(normal):normal(original);
  });
  try{r.setRenderTarget(rt);r.autoClear=false;r.setClearColor(clear??0x7777ff,alpha??1);r.clear();r.render(scene,camera)}finally{for(const[obj,mat]of swaps)obj.material=mat;for(const obj of hidden)obj.visible=true;r.autoClear=oldAuto;r.setClearColor(oldColor,oldAlpha)}
 };
 composer.addPass(ao);composer.addPass(new OutputPass());
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const g=canvas.getContext('2d');
 function fit(root,{az=.8,el=.25,fill=.85,verticalFill=.67}={}){
  root.updateMatrixWorld(true);const box=new THREE.Box3(),points=[];
  root.traverseVisible(obj=>{if(!obj.isMesh)return;const geo=obj.geometry;if(!geo.attributes.position?.count)return;if(!geo.boundingBox)geo.computeBoundingBox();const b=geo.boundingBox;
   for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new THREE.Vector3(x,y,z).applyMatrix4(obj.matrixWorld);points.push(p);box.expandByPoint(p)}
  });const center=box.getCenter(new THREE.Vector3());
  const direction=new THREE.Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right),tan=Math.tan(camera.fov*Math.PI/360);
  let distance=0;for(const world of points){
   const p=world.clone().sub(center),d=p.dot(direction);distance=Math.max(distance,d+Math.abs(p.dot(right))/(tan*camera.aspect*fill),d+Math.abs(p.dot(up))/(tan*verticalFill));
  }
  camera.position.copy(center).addScaledVector(direction,distance*1.04);camera.lookAt(center);camera.updateMatrixWorld();
  return{box,center,points,distance,framing:box.min.toArray().every(Number.isFinite)};
 }
 function render(){if(renderer.getContext().isContextLost())throw Error('Mechanical renderer lost its context');renderer.setRenderTarget(null);composer.render(0);g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.drawImage(renderer.domElement,0,0);}
 function text(str,x,y,size=22,color=paper?'#242725':'#ece8df',font='sans',align='left'){
  g.fillStyle=color;g.textAlign=align;g.font=(font==='serif'?'italic ':font==='sans'?'600 ':'')+size*width/1920+'px '+(font==='mono'?'"Courier New",monospace':font==='serif'?'Baskerville,Georgia,serif':'Arial,sans-serif');g.fillText(str,x*width/1920,y*height/1080);g.textAlign='left';
 }
 return{scene,camera,canvas,g,renderer,fit,render,text,width,height,paper};
}
