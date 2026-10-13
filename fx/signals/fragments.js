// Motion shatter and reassemble. Measured optical flow decides where the subject breaks:
// still or slow regions stay whole, fast regions release solid fragments that trail the
// movement, and once the measured motion under a fragment's home settles it flies back.
// Every frame is a pure function of film time; the fragment history is precomputed once
// from the fixed measurements, so seeking never depends on previously rendered frames.
import {THREE,stage,text} from './stage.js';
import {Signals,clamp,hash,finiteTime} from './data.js';
import {STAGE,CAT,createCat,sourceTime,playbackRate} from './performance.js';

export const LOOK={background:'#e4ecef',flash:'#2340d0',accent:'#2340d0',ink:'#1d2b33',shadow:'#5b6f78'};
// Stage px per source frame. Slow walking measures below LO; a sprint's legs, the
// take-off and the tail whip exceed it. A sudden speed increase (BURST) releases the most.
// A piece starts home once the flow under it drops below SETTLE (walking pace) or after MAXFLIGHT s.
export const RULES={lo:14,hi:34,burstLo:18,burstHi:40,base:.03,localBase:.28,burst:.9,settle:11,minAge:.3,returnTime:.45,maxFlight:1.7,drag:3.0,carry:.75,launch:45,shards:4,lead:1,heal:.55,scar:.7};
const PX=1/100; // world units per stage px
// Returns accelerate into place and stop on arrival: a snap rather than a drift.
const ease=x=>{x=clamp(x);return x*x*(2.2-1.2*x);};
const smooth=(a,b,x)=>{x=clamp((x-a)/(b-a));return x*x*(3-2*x);};

// Deterministic fragment history derived only from the measured cache.
export function simulate(data,motion=1){
  const s=data.source,gw=s.gridWidth,gh=s.gridHeight,n=gw*gh,fps=s.fps,N=s.count,toStage=STAGE.width/s.width,cell=STAGE.width/gw,R=RULES;
  const bytes=data.bytes,view=data.view,scale=toStage/s.flowScale;
  const alphaAt=(k,i)=>bytes[(k*n+i)*8+3]/255,vxAt=(k,i)=>view.getInt16((k*n+i)*8+4,true)*scale,vyAt=(k,i)=>view.getInt16((k*n+i)*8+6,true)*scale;
  // Flow at a stage position, weighted by subject coverage so homes follow the body.
  function flowAt(k,x,y){
    const gx=x/cell-.5,gy=y/cell-.5,x0=Math.floor(gx),y0=Math.floor(gy);let w=0,vx=0,vy=0;
    for(let dy=-1;dy<=2;dy++)for(let dx=-1;dx<=2;dx++){const cx=x0+dx,cy=y0+dy;if(cx<0||cy<0||cx>=gw||cy>=gh)continue;const i=cy*gw+cx,a=alphaAt(k,i);if(a<=0)continue;const q=Math.max(0,1.6-Math.hypot(cx-gx,cy-gy))*a;if(q<=0)continue;w+=q;vx+=vxAt(k,i)*q;vy+=vyAt(k,i)*q;}
    return w>1e-4?[vx/w,vy/w]:[0,0];
  }
  const speed=new Float32Array(n),prev=new Float32Array(n),fx=new Float32Array(n),fy=new Float32Array(n),occupied=new Uint8Array(n);
  const pieces=[],active=[],births=new Uint16Array(N),alive=new Uint16Array(N),stats=[];
  for(let k=0;k<N;k++){
    // Advance homes with this frame's measured flow; a home that has settled starts its return.
    occupied.fill(0);
    for(let j=active.length-1;j>=0;j--){
      const p=active[j];
      if(k>p.kb){const [vx,vy]=flowAt(k,p.hx,p.hy);p.hx+=vx;p.hy+=vy;const age=(k-p.kb)/fps;
        if(p.kr<0&&((Math.hypot(vx,vy)<R.settle&&age>=R.minAge)||age>=R.maxFlight)){p.kr=k;p.ke=k+Math.round(R.returnTime*fps);}
        p.track.push(p.hx,p.hy);}
      if(p.ke>=0&&k>=p.ke){active.splice(j,1);continue;}
      const cx=Math.floor(p.hx/cell),cy=Math.floor(p.hy/cell);if(cx>=0&&cy>=0&&cx<gw&&cy<gh)occupied[cy*gw+cx]=1;
    }
    let fast=0,cxs=0,cys=0,dxs=0,dys=0,maxSpeed=0,sum=0,count=0;
    for(let i=0;i<n;i++){const a=alphaAt(k,i);fx[i]=vxAt(k,i);fy[i]=vyAt(k,i);speed[i]=a>.5?Math.hypot(fx[i],fy[i]):-1;
      if(a>.5){count++;sum+=speed[i];maxSpeed=Math.max(maxSpeed,speed[i]);}
      if(speed[i]>R.lo){fast++;cxs+=i%gw;cys+=Math.floor(i/gw);dxs+=fx[i];dys+=fy[i];}}
    // When most of the body moves together, its leading edge (the head on a leap) holds together.
    let dirx=0,diry=0,lo=0,hi=1,bias=0;
    if(fast){const l=Math.hypot(dxs,dys)||1;dirx=dxs/l;diry=dys/l;cxs/=fast;cys/=fast;lo=Infinity;hi=-Infinity;
      for(let i=0;i<n;i++)if(speed[i]>R.lo){const q=(i%gw-cxs)*dirx+(Math.floor(i/gw)-cys)*diry;lo=Math.min(lo,q);hi=Math.max(hi,q);}
      bias=smooth(.3,.7,fast/Math.max(1,count));}
    let born=0;
    if(motion>0&&k>0)for(let i=0;i<n;i++){
      const v=speed[i];if(v<=0||occupied[i])continue;
      // A cell that was empty last frame has no previous speed to compare with.
      const burst=prev[i]>=0?Math.max(0,v-prev[i]):0;
      // Local motion (a leg, the tail) sheds steadily; a whole-body move sheds mainly on its burst.
      let p=(R.localBase+(R.base-R.localBase)*bias)*smooth(R.lo,R.hi,v)+R.burst*smooth(R.burstLo,R.burstHi,burst)*smooth(R.lo*.5,R.lo,v);
      if(p<=0)continue;
      if(bias>0){const q=((i%gw-cxs)*dirx+(Math.floor(i/gw)-cys)*diry-lo)/Math.max(1e-6,hi-lo);p*=1-R.lead*bias*smooth(.35,.62,q);}
      if(hash(i*7.31+k*1013.7)>=p*Math.min(1,motion))continue;
      const x=(i%gw+.5)*cell,y=(Math.floor(i/gw)+.5)*cell,c=data.sample(k,i).color;
      const piece={kb:k,kr:-1,ke:-1,x,y,vx:fx[i]*motion,vy:fy[i]*motion,hx:x,hy:y,color:c,seed:hash(i*3.17+k*71.3),speed:v,frameMax:maxSpeed,track:[x,y]};
      active.push(piece);pieces.push(piece);occupied[i]=1;born++;
    }
    births[k]=born;alive[k]=active.length;stats.push({maxSpeed,meanSpeed:count?sum/count:0,fastCells:fast,cells:count});
    prev.set(speed);
  }
  for(const p of active){if(p.kr<0){p.kr=N-1;p.ke=N-1+Math.round(R.returnTime*fps);}}
  for(const p of pieces){while(p.track.length/2<p.ke-p.kb+1)p.track.push(p.track[p.track.length-2],p.track[p.track.length-1]);p.track=Float32Array.from(p.track);}
  return{pieces,births,alive,stats,cell,fps,count:N};
}

const shardVertex=`
attribute vec3 aPos,aColor,aDir;attribute vec4 aSpin;attribute float aSize,aAccent;
uniform vec3 uLight;varying vec3 vColor,vNormal;varying float vSide,vShade;
vec3 rotate(vec3 v,vec4 q){vec3 k=normalize(q.xyz);float c=cos(q.w),s=sin(q.w);return v*c+cross(k,v)*s+k*dot(k,v)*(1.-c);}
void main(){
 vec3 local=position*vec3(aSize,aSize,aSize*.42);vec3 p=rotate(local,aSpin);
 vec2 d=aDir.xy;p.xy+=d*dot(p.xy,d)*aDir.z;
 vNormal=normalize(normalMatrix*rotate(normal,aSpin));vSide=(1.-step(.5,abs(normal.z)))*aAccent;vShade=1.-step(.5,abs(normal.z));vColor=aColor;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p+aPos,1.);}`;
const shardFragment=`
uniform vec3 uLight,uAccent;varying vec3 vColor,vNormal;varying float vSide,vShade;
void main(){float diffuse=max(0.,dot(normalize(vNormal),normalize(uLight)));
 // Cut faces: one accent colour on a share of the pieces, a darker body colour on the rest.
 vec3 base=mix(vColor*mix(1.,.62,vShade),uAccent,vSide);gl_FragColor=vec4(base*(.5+.62*diffuse),1.);
 #include <colorspace_fragment>
}`;
const catVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const catFragment=`
uniform sampler2D uCat,uHoles;uniform vec3 uAccent;varying vec2 vUv;
void main(){vec4 c=texture2D(uCat,vUv);if(c.a<.004)discard;
 float h=texture2D(uHoles,vUv).r;if(h>.5)discard;
 // A thin rim of the accent colour marks the broken edge of the remaining body.
 vec3 col=mix(c.rgb,c.rgb*.5,smoothstep(.3,.45,h));gl_FragColor=vec4(col,c.a);
 #include <colorspace_fragment>
}`;

// Film camera: centre (stage px), zoom and yaw are pure functions of film time.
function camera(t,impact){
  const k=(a,b)=>smooth(a,b,t);
  const cx=600+270*k(2.4,4.9)+190*k(8.0,11.2),cy=360-70*k(2.55,3.4)*(1-k(4.0,4.9));
  const zoom=1+.17*k(2.6,3.6)*(1-k(4.1,4.9))+.05*k(8.6,12);
  const yaw=.16*k(2.7,3.7)*(1-k(4.0,4.9));
  const kick=t>=impact&&t<impact+.2?Math.exp(-(t-impact)*22)*Math.sin((t-impact)*90):0;
  return{cx:cx+kick*9,cy:cy-kick*6,zoom,yaw};
}

export async function createFragments({signalsUrl}={}){
  const data=await Signals.load(signalsUrl??new URL('../../assets/signals-fragments/manifest.json',import.meta.url));
  const s=stage(),cat=await createCat(),cues=data.source.cues||{};
  if(!(cues.impact>0))throw new Error('Motion / Release needs a fragments bundle with film cues (tools/signals/build.py --cues)');
  const sims=new Map(),sim=m=>{if(!sims.has(m))sims.set(m,simulate(data,m));return sims.get(m);};
  const gw=data.source.gridWidth,gh=data.source.gridHeight,cell=STAGE.width/gw;
  // Full-resolution cat, redrawn for each frame at the same source time the flow was measured.
  const canvas=document.createElement('canvas');canvas.width=STAGE.width;canvas.height=STAGE.height;const cg=canvas.getContext('2d');
  const catTexture=new THREE.CanvasTexture(canvas);catTexture.colorSpace=THREE.SRGBColorSpace;catTexture.minFilter=THREE.LinearFilter;catTexture.generateMipmaps=false;
  const holes=new Uint8Array(gw*gh),holeTexture=new THREE.DataTexture(holes,gw,gh,THREE.RedFormat);holeTexture.magFilter=holeTexture.minFilter=THREE.LinearFilter;holeTexture.needsUpdate=true;
  const accent=new THREE.Color(LOOK.accent);
  const catMat=new THREE.ShaderMaterial({uniforms:{uCat:{value:catTexture},uHoles:{value:holeTexture},uAccent:{value:accent}},vertexShader:catVertex,fragmentShader:catFragment,transparent:true,depthWrite:false});
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(STAGE.width*PX,STAGE.height*PX),catMat);plane.renderOrder=2;s.scene.add(plane);
  // Soft contact shadow under the cat; it shrinks and fades when the cat is airborne.
  const sc=document.createElement('canvas');sc.width=256;sc.height=64;const sg=sc.getContext('2d'),grad=sg.createRadialGradient(128,32,0,128,32,128);
  grad.addColorStop(0,'rgba(40,58,66,.34)');grad.addColorStop(1,'rgba(40,58,66,0)');sg.fillStyle=grad;sg.setTransform(1,0,0,.25,0,24);sg.fillRect(0,0,256,256);
  const shadowTexture=new THREE.CanvasTexture(sc);shadowTexture.colorSpace=THREE.SRGBColorSpace;
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));shadow.renderOrder=1;shadow.position.z=-.02;s.scene.add(shadow);
  const max=(Math.max(...sim(1).alive)+256)*RULES.shards*2;
  const g=new THREE.InstancedBufferGeometry(),box=new THREE.BoxGeometry(1,1,1);g.index=box.index;for(const key of ['position','normal','uv'])g.setAttribute(key,box.attributes[key]);
  const attrs={};for(const [name,size] of [['aPos',3],['aColor',3],['aDir',3],['aSpin',4],['aSize',1],['aAccent',1]]){const a=new THREE.InstancedBufferAttribute(new Float32Array(max*size),size);a.setUsage(THREE.DynamicDrawUsage);g.setAttribute(name,a);attrs[name]=a;}
  const shardMat=new THREE.ShaderMaterial({uniforms:{uLight:{value:new THREE.Vector3(-.45,.7,1)},uAccent:{value:accent}},vertexShader:shardVertex,fragmentShader:shardFragment});
  const shards=new THREE.Mesh(g,shardMat);shards.frustumCulled=false;shards.renderOrder=3;s.scene.add(shards);
  const world=(x,y)=>[(x-STAGE.width/2)*PX,(STAGE.height/2-y)*PX];
  let proof;
  function frame(seconds,o={}){
    const t=clamp(finiteTime(seconds),0,12),motion=o.motionGain??1;
    if(!(Number.isFinite(motion)&&motion>=0&&motion<=3))throw new Error('Signal gains must be between 0 and 3');
    const tau=o.sourceTime??sourceTime(t);if(!Number.isFinite(tau)||tau<0)throw new Error('Source time must be finite');
    const r=sim(motion),fps=r.fps,raw=tau*fps,kf=Math.min(Math.abs(raw-Math.round(raw))<1e-4?Math.round(raw):raw,r.count-1),index=Math.floor(kf),R=RULES;
    // Cat image at this source instant.
    cg.setTransform(1,0,0,1,0,0);cg.clearRect(0,0,canvas.width,canvas.height);const pose=cat.draw(cg,tau);catTexture.needsUpdate=true;
    const lift=-Math.min(0,pose.pose.transform.y||0)*CAT.scale,[sx,sy]=world(pose.x+5*CAT.scale,CAT.ground);
    shadow.position.set(sx,sy,-.02);shadow.scale.set(4.4*(1-.35*clamp(lift/220)),.7,1);shadow.material.opacity=1-.6*clamp(lift/220);
    holes.fill(0);let count=0,pieces=0,returning=0,distance=0,fastPieces=0,births=0;
    const A=attrs,pos=A.aPos.array,col=A.aColor.array,dir=A.aDir.array,spin=A.aSpin.array,size=A.aSize.array,accentShare=A.aAccent.array;
    for(const p of r.pieces){
      if(p.kb>kf||kf>=p.ke||count+R.shards>max)continue;
      const age=(kf-p.kb)/fps,returnAge=p.kr>=0?(p.kr-p.kb)/fps:Infinity,ret=Math.max(0,(kf-p.kr)/fps),Rw=age>=returnAge?ease(ret/R.returnTime):0;
      if(Rw>=1)continue;
      pieces++;if(Math.floor(kf)===p.kb)births++;if(p.speed>=.75*p.frameMax)fastPieces++;
      const ti=Math.min(p.track.length/2-1,kf-p.kb),i0=Math.floor(ti),i1=Math.min(p.track.length/2-1,i0+1),u=ti-i0;
      const hx=p.track[i0*2]+(p.track[i1*2]-p.track[i0*2])*u,hy=p.track[i0*2+1]+(p.track[i1*2+1]-p.track[i0*2+1])*u;
      // The hole a piece leaves is fully open at the break and closes over R.scar seconds, so the
      // impact reads as broken while the body stays readable as its shards trail behind; it is also
      // closed by the time a returning piece is R.heal of the way home (no white cracks on reassembly).
      const scar=1-Math.min(1,age/R.scar)**2,hc=Math.floor(hx/cell),hr=Math.floor(hy/cell),open=Math.round(255*Math.min(scar,1-Math.min(1,Rw/R.heal)));
      if(open>0&&hc>=0&&hr>=0&&hc<gw&&hr<gh){const hi=(gh-1-hr)*gw+hc;if(open>holes[hi])holes[hi]=open;}
      // Launch speed is capped so a very fast whip cannot throw pieces out of the frame.
      const lv=Math.hypot(p.vx,p.vy),cap=Math.min(1,R.launch/Math.max(lv,1e-6)),v=lv*cap*fps;
      for(let q=0;q<R.shards;q++){
        const h1=hash(p.seed*91.7+q*13.1),h2=hash(p.seed*37.3+q*5.7),h3=hash(p.seed*11.9+q*29.3),h4=hash(p.seed*53.1+q*3.3);
        const ox=((q&1)-.5)*cell*.5,oy=((q>>1)-.5)*cell*.5,nx=-p.vy,ny=p.vx,nl=Math.hypot(nx,ny)||1;
        const carry=R.carry*cap*(1+.3*(h1-.5)),jx=p.vx*fps*carry+nx/nl*v*.18*(h2-.5),jy=p.vy*fps*carry+ny/nl*v*.18*(h2-.5),vz=v*(.05+.25*h3);
        const travel=a=>(1-Math.exp(-R.drag*a))/R.drag;
        // Pieces get a half-frame head start so the impact frame already shows the break.
        // Pieces that fall settle on the (invisible) floor line instead of sinking below it.
        const fa=Math.min(age,returnAge)+.5/fps,fx=p.x+ox+jx*travel(fa),rawY=p.y+oy+jy*travel(fa),floorY=Math.max(p.y+oy,CAT.ground+4+8*h1),fy=Math.min(rawY,floorY),fz=vz*travel(fa);
        // A shard that has come to rest on the floor crumbles to a third of its size (the further its free
        // path would have carried it, the longer it has lain there), and regains its size flying home.
        const crumble=.65*smooth(0,60,rawY-floorY)*(1-Rw);
        let x=fx,y=fy,z=fz;
        if(Rw>0){const rx=hx+ox,ry=hy+oy;x=rx+(fx-rx)*(1-Rw);y=ry+(fy-ry)*(1-Rw);z=fz*(1-Rw);}
        if(q===0){if(Rw>0)returning++;distance+=Math.hypot(x-hx-ox,y-hy-oy);}
        const [wx,wy]=world(x,y),c=count*3;pos[c]=wx;pos[c+1]=wy;pos[c+2]=.03+z*PX;
        col[c]=p.color[0];col[c+1]=p.color[1];col[c+2]=p.color[2];
        const cur=Math.hypot(jx,jy)*Math.exp(-R.drag*fa)*(1-Rw),dl=Math.hypot(jx,jy)||1;dir[c]=jx/dl;dir[c+1]=-jy/dl;dir[c+2]=clamp(cur/900)*1.6;
        const sp=count*4;spin[sp]=h2-.5;spin[sp+1]=h3-.5;spin[sp+2]=.6+h1;spin[sp+3]=(h4-.5)*(1-Rw)*fa*(4+h1*9);
        size[count]=cell*PX*(.5+.45*h4)*(1-crumble);accentShare[count]=h3<.35?1:0;count++;
      }
    }
    for(const a of Object.values(A))a.needsUpdate=true;g.instanceCount=count;holeTexture.needsUpdate=true;
    // Background changes only within two frames of the measured impact.
    const flash=Math.abs(t-cues.impact)<=2/30+1e-6,bg=flash?LOOK.flash:LOOK.background;s.scene.background=new THREE.Color(bg);
    const cam=camera(t,cues.impact),dist=12.8/(2*Math.tan(THREE.MathUtils.degToRad(15))*(1280/720))/cam.zoom,[cx,cy]=world(cam.cx,cam.cy);
    s.camera.fov=30;s.camera.updateProjectionMatrix();s.camera.position.set(cx+Math.sin(cam.yaw)*dist,cy,Math.cos(cam.yaw)*dist);s.camera.lookAt(cx,cy,0);s.camera.updateMatrixWorld();
    s.render();
    if(o.labels!==false&&t>9.9){const k=smooth(9.9,10.6,t);s.g.save();s.g.globalAlpha=k;text(s.g,'Fast motion breaks it. Stillness rebuilds it.',64,640,40,LOOK.ink,800);text(s.g,'Fragments come from measured optical flow.',66,684,22,LOOK.shadow,600);s.g.restore();}
    const st=r.stats[Math.min(r.count-1,Math.floor(kf))];
    proof={mode:'motion-fragments',time:t,sourceTime:tau,rate:o.sourceTime==null?playbackRate(t):null,sourceIndex:index,audioIndex:data.audio(t).index,envelope:data.audio(t).envelope,
      particles:count,pieces,returning,returnDistance:pieces?distance/pieces:0,returnDistanceSum:distance,fastShare:pieces?fastPieces/pieces:0,births,holes:holes.reduce((a,b)=>a+(b>0),0),
      background:bg,flash,maxFlow:st.maxSpeed,meanFlow:st.meanSpeed,activeMotionCells:st.fastCells,motionGain:motion,camera:s.camera.position.toArray(),
      geometry:'instanced solid shards',sourceHash:data.source.sourceSha256,audioHash:data.audioSpec.sha256};
  }
  return{canvas:s.canvas,data,cues,proof:()=>proof,frame,timeline:(m=1)=>{const r=sim(m);return{births:[...r.births],stats:r.stats,fps:r.fps};}};
}
