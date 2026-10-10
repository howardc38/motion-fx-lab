import {THREE,stage,text,spectrum,PALETTES,W,H} from './stage.js';
import {Signals,clamp,ease,hash,finiteTime,mix} from './data.js';

const tileVertex=`
attribute vec2 aHome;attribute vec3 aColor;attribute vec2 aFlow;attribute float aAlpha;
uniform float uTime,uEnergy,uGain,uMotion,uRelief,uCell;uniform float uBands[32];
varying vec3 vColor,vNormal,vLocal;varying float vVisible;
void main(){
 float lum=dot(aColor,vec3(.299,.587,.114));float band=uBands[int(clamp((aHome.x+7.4)/14.8*31.,0.,31.))];
 float body=step(.3,aAlpha),speed=length(aFlow),fast=smoothstep(.7,5.,speed)*uMotion;
 float relief=.14+uGain*uEnergy*(.35+body*(.8+pow(lum,.4)*1.9)+band*.6);
 float height=mix(.10+lum*.22,relief,uRelief);
 vec3 p=position*vec3(uCell*.94,uCell*.94,height);p.xy+=aHome;p.z+=height*.5;
 p.z+=fast*.35*(1.-uRelief);
 vVisible=mix(aAlpha*(1.-fast*.35),1.,uRelief);
 float pattern=.5+.5*sin(length(aHome*vec2(1.,1.5))*2.1-uTime*.8);
 vec3 bg=mix(vec3(.045,.075,.9),vec3(.45,.85,.035),smoothstep(.25,.95,pattern));
 vColor=mix(bg,mix(aColor,vec3(.95),.07),body);vNormal=normalize(normalMatrix*normal);vLocal=position;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const litFragment=`
uniform vec3 uLight,uAccent;uniform float uTheme;varying vec3 vColor,vNormal,vLocal;varying float vVisible;
void main(){if(vVisible<.2)discard;float diffuse=max(0.,dot(normalize(vNormal),normalize(uLight)));
 float edge=1.-smoothstep(.465,.5,max(abs(vLocal.x),abs(vLocal.y)));
 vec3 c=vColor;if(uTheme>.5)c=mix(c,uAccent*dot(c,vec3(.3,.6,.1))*1.5,.58);
 c*=.26+.74*diffuse;c*=.7+.3*edge;
 gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}`;
const shardVertex=`
attribute vec3 aCenter,aColor;attribute float aSize,aAge,aSeed;
uniform float uTime;varying vec3 vColor,vNormal,vLocal;varying float vVisible;
mat3 rot(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
void main(){mat3 r=rot(aSeed*6.283+aAge*(2.+aSeed*8.));vec3 p=r*(position*aSize)+aCenter;
 vNormal=normalize(normalMatrix*r*normal);vColor=aColor;vLocal=position;vVisible=1.;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`;
function geometry(base,count){const g=new THREE.InstancedBufferGeometry();g.index=base.index;g.attributes.position=base.attributes.position;g.attributes.normal=base.attributes.normal;g.attributes.uv=base.attributes.uv;g.instanceCount=count;return g;}
function attribute(g,name,array,size){const a=new THREE.InstancedBufferAttribute(array,size);a.setUsage(THREE.DynamicDrawUsage);g.setAttribute(name,a);return a;}
function material(vertex,extra={}){return new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uLight:{value:new THREE.Vector3(-.4,.7,1)},uAccent:{value:new THREE.Color('#ff563a')},uTheme:{value:0},...extra},vertexShader:vertex,fragmentShader:litFragment});}

export async function createField(mode,{signalsUrl}={}){
  if(!['audio-relief','motion-fragments'].includes(mode))throw new Error('Unknown signal field');
  const data=await Signals.load(signalsUrl),s=stage(),n=data.cells,gw=data.source.gridWidth,gh=data.source.gridHeight,cell=14.8/gw;
  const colors=new Float32Array(n*3),flow=new Float32Array(n*2),alpha=new Float32Array(n),homes=new Float32Array(n*2);
  for(let i=0;i<n;i++){homes[i*2]=((i%gw+.5)/gw-.5)*14.8;homes[i*2+1]=(.5-(Math.floor(i/gw)+.5)/gh)*14.8*gh/gw;}
  const g=geometry(new THREE.BoxGeometry(1,1,1),n);attribute(g,'aHome',homes,2);attribute(g,'aColor',colors,3);attribute(g,'aFlow',flow,2);attribute(g,'aAlpha',alpha,1);
  const relief=mode==='audio-relief',mat=material(tileVertex,{uEnergy:{value:0},uGain:{value:1},uMotion:{value:0},uRelief:{value:relief?1:0},uCell:{value:cell},uBands:{value:Array(32).fill(0)}});
  const tiles=new THREE.Mesh(g,mat);tiles.frustumCulled=false;s.scene.add(tiles);tiles.scale.setScalar(1.1);
  const maxBirths=Math.ceil(.8*data.source.fps),stride=9,maxShards=maxBirths*Math.ceil(n/stride),centers=new Float32Array(maxShards*3),shardColors=new Float32Array(maxShards*3),sizes=new Float32Array(maxShards),ages=new Float32Array(maxShards),seeds=new Float32Array(maxShards);
  const sg=geometry(new THREE.BoxGeometry(1,1,1),0);attribute(sg,'aCenter',centers,3);attribute(sg,'aColor',shardColors,3);attribute(sg,'aSize',sizes,1);attribute(sg,'aAge',ages,1);attribute(sg,'aSeed',seeds,1);
  const sm=material(shardVertex),shards=new THREE.Mesh(sg,sm);shards.frustumCulled=false;s.scene.add(shards);shards.scale.setScalar(1.1);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(3.3,.024,6,144),new THREE.MeshBasicMaterial({color:'#edfbda'}));ring.position.z=-1.2;s.scene.add(ring);ring.visible=!relief;
  const spokes=new THREE.Group();for(let i=0;i<48;i++){const a=i/48*Math.PI*2,bar=new THREE.Mesh(new THREE.BoxGeometry(.016,1, .025),new THREE.MeshBasicMaterial({color:'#447367'}));bar.position.set(Math.sin(a)*4.7,Math.cos(a)*4.7,-1.5);bar.rotation.z=-a;spokes.add(bar);}s.scene.add(spokes);spokes.visible=!relief;
  let current=-1,proof;
  return{canvas:s.canvas,data,proof:()=>proof,frame(seconds,o={}){
    const t=clamp(finiteTime(seconds),0,12),phaseTime=Math.min(t,12-1e-6),audioTime=o.audioTime??t,sourceTime=o.sourceTime??t;
    const audio=data.audio(audioTime),index=data.index(sourceTime),gain=o.audioGain??1.1,motion=o.motionGain??1;
    if(![gain,motion].every(v=>Number.isFinite(v)&&v>=0&&v<=3))throw new Error('Signal gains must be between 0 and 3');
    if(index!==current){data.frame(index,colors,flow,alpha);for(const key of ['aColor','aFlow','aAlpha'])g.attributes[key].needsUpdate=true;current=index;}
    const palette=PALETTES[relief?Math.floor(phaseTime/4.8)%3:[3,0,2,3][Math.floor(phaseTime/3)]],angle=o.cameraAngle??(relief?Math.sin(t*.55)*.36:Math.sin(t*.65)*.18);
    if(!Number.isFinite(angle))throw new Error('Camera angle must be finite');
    s.scene.background=new THREE.Color(palette.bg);s.camera.position.set(Math.sin(angle)*12.8,relief?1.5+Math.sin(t*.3)*.45:.65,Math.cos(angle)*12.8);s.camera.lookAt(0,0,relief?1:0);s.camera.updateMatrixWorld();
    mat.uniforms.uTime.value=t;mat.uniforms.uEnergy.value=audio.envelope;mat.uniforms.uGain.value=gain;mat.uniforms.uMotion.value=relief?0:motion;mat.uniforms.uBands.value=audio.bands;
    const light=new THREE.Vector3(Math.sin(t*.5)*.7,.7,1).transformDirection(s.camera.matrixWorldInverse);
    for(const m of [mat,sm]){m.uniforms.uTime.value=t;m.uniforms.uLight.value.copy(light);m.uniforms.uTheme.value=relief&&phaseTime>=4.8?1:0;m.uniforms.uAccent.value.set(palette.accent);}
    let count=0,fastCells=0,maxFlow=0;
    for(let i=0;i<n;i++){const speed=Math.hypot(flow[i*2],flow[i*2+1]);if(alpha[i]>.3&&speed>1)fastCells++;maxFlow=Math.max(maxFlow,speed);}
    if(!relief&&motion>0){
      const step=Math.floor(t*data.source.fps+1e-7);
      for(let b=0;b<maxBirths;b++){
        const born=(step-b)/data.source.fps;if(born<0)continue;const age=t-born,life=.8-age;if(life<=0)continue;
        const frame=data.index(Math.max(0,sourceTime-age)),start=(step-b)%stride;
        for(let i=start;i<n;i+=stride){const p=data.sample(frame,i),speed=Math.hypot(p.vx,p.vy);if(p.alpha<.4||speed<1.1)continue;
          const seed=hash(i+(step-b)*3181),power=clamp((speed-1.1)/5)*motion,fade=Math.min(1,life/.2),x=homes[i*2],y=homes[i*2+1];
          const velocityScale=data.source.fps*14.8/data.source.width;
          centers.set([x+p.vx*velocityScale*age*motion,y-p.vy*velocityScale*age*motion-age*age*.7,.15+age*(2.3+power*6)*(1+audio.envelope*.25*gain)],count*3);
          shardColors.set(p.color,count*3);sizes[count]=cell*(.7+seed*2.1)*fade*(.5+power*.7);ages[count]=age;seeds[count]=seed;count++;
        }
      }
    }
    sg.instanceCount=count;for(const key of ['aCenter','aColor','aSize','aAge','aSeed'])sg.attributes[key].needsUpdate=true;
    ring.rotation.z=t*.18;ring.scale.setScalar(1+audio.envelope*.08);ring.material.color.set(palette.accent);spokes.rotation.z=-t*.06;
    s.render();
    if(o.labels!==false){
      const ink=relief&&phaseTime>=4.8&&phaseTime<9.6?'#172d25':'#f4f1dd';
      s.g.fillStyle='#07191e';s.g.fillRect(27,19,relief?180:260,40);text(s.g,relief?'PULSE / FORM':'MOTION / RELEASE',42,48,19,'#f4f1dd');
      spectrum(s.g,audio,ink,45);
      const q=phaseTime,head=relief?'TURN IT UP.':'MOVE. BREAK. RETURN.';
      if(q<1.1){s.g.save();s.g.globalAlpha=1-ease(q,.3,1.1);text(s.g,head,640,378,relief?90:65,ink,900,'center');s.g.restore();}
      if(q>10.8){s.g.save();s.g.globalAlpha=ease(q,10.8,11.35);text(s.g,relief?'FEEL THE FRAME.':'MOTION LEAVES A MARK.',640,609,relief?54:44,ink,900,'center');s.g.restore();}
    }
    proof={mode,sourceIndex:index,audioIndex:audio.index,rms:audio.rms,envelope:audio.envelope,audioGain:gain,motionGain:motion,activeMotionCells:fastCells,maxFlow,particles:count,camera:s.camera.position.toArray(),geometry:'instanced solid boxes',sourceHash:data.source.sourceSha256,audioHash:data.audioSpec.sha256};
  }};
}
