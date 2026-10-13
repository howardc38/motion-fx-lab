// Audio-driven solid relief. Each image cell of the portrait is a lit solid column whose
// height is the measured loudness (RMS envelope) of the score at that instant, shaped by
// the cell's brightness, its distance inside the silhouette and one measured frequency band.
// Silence gives a flat picture; the camera swings to a grazing angle to expose the depth.
import {THREE,stage,text} from './stage.js';
import {Signals,clamp,finiteTime} from './data.js';

export const LOOK={background:'#14202b',ink:'#f3ead8',muted:'#8fa3ad',wave:'#e9b44c'};
export const RELIEF={height:1.6,base:.03,gain:1.1};
const PX=1/100,smooth=(a,b,x)=>{x=clamp((x-a)/(b-a));return x*x*(3-2*x);};

// Camera yaw/pitch (radians) as a pure function of film time.
export function reliefCamera(t){
  const k=smooth;
  const yaw=.34*k(1,3,t)+.16*k(3,5.6,t)+.45*k(5.85,6.45,t)+.05*k(6.45,7.6,t)-.75*k(7.6,9.4,t)-.25*k(9.4,10.2,t)+.26*k(10.2,11.1,t)-.08*k(11.1,12,t);
  const pitch=.12*k(5.85,6.5,t)*(1-k(7.4,9.4,t))+.04*k(10.2,11.2,t);
  const zoom=1+.06*k(5.85,6.5,t)*(1-k(7.6,9.6,t));
  return{yaw,pitch,zoom};
}

export async function createRelief({signalsUrl}={}){
  const data=await Signals.load(signalsUrl??new URL('../../assets/signals-relief/manifest.json',import.meta.url));
  const s=stage(),src=data.source,gw=src.gridWidth,gh=src.gridHeight,cell=1280/gw*PX;
  // Subject cells and their shape terms.
  const inside=new Uint8Array(gw*gh),cells=[];
  for(let i=0;i<gw*gh;i++){const p=data.sample(0,i);if(p.alpha>.5){inside[i]=1;cells.push({i,color:p.color});}}
  if(!cells.length)throw new Error('Relief source has no visible subject');
  // Chamfer distance to the silhouette edge rounds the relief like a bas-relief.
  const dist=new Float32Array(gw*gh);for(let i=0;i<dist.length;i++)dist[i]=inside[i]?1e9:0;
  for(let pass=0;pass<2;pass++){const ys=pass?[...Array(gh).keys()].reverse():[...Array(gh).keys()],xs=pass?[...Array(gw).keys()].reverse():[...Array(gw).keys()],d=pass?1:-1;
    for(const y of ys)for(const x of xs){const i=y*gw+x;if(!dist[i])continue;for(const [dx,dy,w] of [[d,0,1],[0,d,1],[d,d,1.414],[-d,d,1.414]]){const X=x+dx,Y=y+dy,v=X<0||Y<0||X>=gw||Y>=gh?0:dist[Y*gw+X];dist[i]=Math.min(dist[i],v+w);}}}
  let far=1,minX=Infinity,maxX=-Infinity;for(const c of cells){far=Math.max(far,dist[c.i]);minX=Math.min(minX,c.i%gw);maxX=Math.max(maxX,c.i%gw);}
  const width=(maxX-minX+1)*cell,centre=((minX+maxX+1)/2/gw-.5)*12.8;
  for(const c of cells){const [r,g,b]=c.color,lum=.2126*r+.7152*g+.0722*b;c.shape=.2+.5*Math.pow(lum,.45)+.3*Math.sqrt(dist[c.i]/far);
    c.x=((c.i%gw+.5)/gw-.5)*12.8;c.y=(.5-(Math.floor(c.i/gw)+.5)/gh)*7.2;c.band=Math.round(2+26*(1-Math.floor(c.i/gw)/(gh-1)));}
  // Column sides are darker than their image-coloured tops, so the picture stays readable
  // and every extruded cell reads as a separate pin at a grazing angle.
  const material=new THREE.MeshStandardMaterial({roughness:.5,metalness:.06});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vTop;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTop=abs(normal.z);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vTop;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(.4,1.,vTop);');
  };
  material.customProgramCacheKey=()=>'signal-relief-pins';
  const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,cells.length);
  mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
  const color=new THREE.Color();cells.forEach((c,k)=>mesh.setColorAt(k,color.setRGB(...c.color)));s.scene.add(mesh);
  // An unlit wall in the background colour, with a shadow-only layer just in front of it.
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshBasicMaterial({color:LOOK.background}));wall.position.z=-.002;s.scene.add(wall);
  const shade=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.ShadowMaterial({opacity:.55}));shade.receiveShadow=true;s.scene.add(shade);
  s.scene.add(new THREE.HemisphereLight('#fff6e8','#2b3440',1.25));
  const key=new THREE.DirectionalLight('#fff1dc',2.1);key.position.set(-6,7,9);key.castShadow=true;
  Object.assign(key.shadow.camera,{left:-8,right:8,top:6,bottom:-6,near:1,far:40});key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.0004;key.shadow.normalBias=.01;
  s.scene.add(key,key.target);const rim=new THREE.DirectionalLight('#9fd8ff',.7);rim.position.set(8,2,3);s.scene.add(rim);
  s.renderer.shadowMap.enabled=true;s.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),sc=new THREE.Vector3();
  let proof;
  function frame(seconds,o={}){
    const t=clamp(finiteTime(seconds),0,12),audioTime=o.audioTime??t,gain=o.audioGain??RELIEF.gain;
    if(!(Number.isFinite(gain)&&gain>=0&&gain<=3))throw new Error('Signal gains must be between 0 and 3');
    const a=data.audio(audioTime);let sum=0,max=0;
    for(let k=0;k<cells.length;k++){const c=cells[k],ext=RELIEF.height*gain*a.envelope*c.shape*(.72+.28*a.bands[c.band]);sum+=ext;max=Math.max(max,ext);
      // Flat cells touch (a clean picture); extruded cells narrow slightly into separate pins.
      const h=RELIEF.base+ext,w=cell*(1-.14*clamp(ext/.25));m.compose(v.set(c.x,c.y,h/2),q,sc.set(w,w,h));mesh.setMatrixAt(k,m);}
    mesh.instanceMatrix.needsUpdate=true;
    const cam=o.cameraAngle!=null?{yaw:o.cameraAngle,pitch:0,zoom:1}:reliefCamera(t),d=12.6/cam.zoom,target=new THREE.Vector3(centre*.6,.15,.5*max);
    if(!Number.isFinite(cam.yaw))throw new Error('Camera angle must be finite');
    s.scene.background=new THREE.Color(LOOK.background);
    s.camera.fov=32;s.camera.updateProjectionMatrix();
    s.camera.position.set(target.x+Math.sin(cam.yaw)*Math.cos(cam.pitch)*d,target.y+Math.sin(cam.pitch)*d,target.z+Math.cos(cam.yaw)*Math.cos(cam.pitch)*d);s.camera.lookAt(target);s.camera.updateMatrixWorld();
    s.render();
    if(o.labels!==false){
      // A small waveform of the measured RMS envelope; its right end is "now".
      const g=s.g,w=280,x0=930,y0=672,span=3,fps=data.audioSpec.fps;g.save();g.fillStyle=LOOK.wave;g.globalAlpha=.85;
      for(let i=0;i<w;i+=3){const at=audioTime-span+span*i/w;if(at<0)continue;const e=data.audio(at).envelope,h=1+e*26;g.fillRect(x0+i,y0-h,2,h*2);}
      g.globalAlpha=1;g.fillStyle=LOOK.ink;g.beginPath();g.arc(x0+w+6,y0,4,0,Math.PI*2);g.fill();g.restore();
      if(t>10.2){g.save();g.globalAlpha=smooth(10.2,10.8,t);text(g,'Loud is deep.',56,548,44,LOOK.ink,800);text(g,'Silence is flat.',56,600,44,LOOK.ink,800);text(g,'Height follows the measured',58,640,20,LOOK.muted,600);text(g,'loudness of the track.',58,666,20,LOOK.muted,600);g.restore();}
    }
    const yawDeg=Math.abs(cam.yaw)*180/Math.PI;
    proof={mode:'audio-relief',time:t,sourceIndex:0,audioIndex:a.index,rms:a.rms,envelope:a.envelope,audioGain:gain,meanExtrusion:sum/cells.length,maxExtrusion:max,
      subjectWidth:width,cells:cells.length,cameraYaw:yawDeg,cameraPitch:cam.pitch*180/Math.PI,camera:s.camera.position.toArray(),
      geometry:'instanced solid columns',sourceHash:data.source.sourceSha256,audioHash:data.audioSpec.sha256};
  }
  return{canvas:s.canvas,data,proof:()=>proof,frame};
}
