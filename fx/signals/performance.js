// Authored sources for the two signal studies. The optical flow and colours used by the
// fragments are measured offline from the RGBA clip this module renders
// (tools/signals/render-source.cjs); the browser redraws the same pose at full resolution.
import {loadRig,sampleMotion} from '../character/index.js';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);},lerp=(a,b,u)=>a+(b-a)*u;

// ---- Motion / Release: Apricot runs, leaps, lands, flicks its tail and walks slowly. ----
// Source seconds. The stage is wider than the film frame so the film camera can follow.
export const STAGE={width:1600,height:720,fps:30};
export const CAT={scale:2.3,ground:640,x0:420,creep:50};
const RUN={type:'gait',speed:230,cycle:.30,stance:.5,lift:34,bob:3};
const JUMP={type:'jump',height:95,distance:220,flight:.70,prep:.20,land:.30,crouch:18,tuck:26,loop:false};
const WALK={type:'gait',speed:40,cycle:.85,stance:.62,lift:14,bob:1};
export const BEATS={runIn:1.0,run:1.25,prep:2.30,takeoff:2.50,land:3.20,settle:3.50,flick:5.20,flickEnd:5.80,walk:6.60,walkEnd:9.00,end:10.60};
const X1=CAT.x0+CAT.creep+JUMP.distance*CAT.scale,WALK_PX=WALK.speed*CAT.scale;
// One fast whip of the tail tip; the idle track supplies the rest pose either side.
const FLICK=[{t:0,value:[-166,-2]},{t:.16,value:[-118,-104]},{t:.29,value:[-150,62]},{t:.42,value:[-176,-36]},{t:.6,value:[-166,-2]}];

function blend(a,b,w){
  if(w<=0)return a;if(w>=1)return b;
  const joints={};for(const id of Object.keys(a.joints))joints[id]=[lerp(a.joints[id][0],b.joints[id][0],w),lerp(a.joints[id][1],b.joints[id][1],w)];
  const transform={};for(const k of Object.keys(a.transform))transform[k]=lerp(a.transform[k],b.transform[k]??a.transform[k],w);
  return{joints,transform,meta:b.meta};
}
// Cat pose and its stage position for source time tau (seconds).
export function catPose(rig,tau){
  const d=rig.definition,B=BEATS,idle=t=>sampleMotion(d,'idle',t),run=t=>sampleMotion(d,RUN,t-B.runIn),jump=t=>sampleMotion(d,JUMP,t-B.prep),walk=t=>sampleMotion(d,WALK,t-B.walk);
  const creep=CAT.x0+CAT.creep*smooth((tau-B.runIn)/(B.prep-B.runIn));
  let pose,x=CAT.x0;
  if(tau<B.runIn)pose=idle(tau);
  else if(tau<B.prep){pose=blend(idle(tau),run(tau),smooth((tau-B.runIn)/(B.run-B.runIn)));x=creep;}
  else if(tau<B.settle){const j=jump(tau);pose=blend(run(tau),j,smooth((tau-B.prep)/.12));x=CAT.x0+CAT.creep+j.meta.worldX*CAT.scale;}
  else if(tau<B.walk){
    pose=blend(jump(tau),idle(tau),smooth((tau-B.settle)/.2));x=X1;
    if(tau>=B.flick&&tau<B.flickEnd){const at=Math.min(tau-B.flick,.6);pose.joints.tailTip=sampleMotion(d,{type:'keyframes',duration:.6,joints:{tailTip:FLICK}},at).joints.tailTip;}
  }else{
    // Slow walk: speed ramps in and out, and the gait blends in over the same interval.
    const u=tau-B.walk,len=B.walkEnd-B.walk,ramp=.3,dist=u<ramp?u*u/(2*ramp):u<len-ramp?u-ramp/2:len-ramp-Math.max(0,len-u)**2/(2*ramp);
    x=X1+WALK_PX*Math.min(dist,len-ramp);
    pose=blend(idle(tau),walk(tau),smooth(u/ramp)*(1-smooth((u-len+ramp)/ramp)));
  }
  return{pose,x,y:CAT.ground-70*CAT.scale,airborne:pose.meta?.state==='airborne'};
}
// Film time -> source time. The apex plays at 0.25x (a smooth speed ramp, not a cut).
export const REMAP=[[0,1],[2.56,1],[2.72,.25],[4.40,.25],[4.60,1]];
export function sourceTime(t){
  let tau=0;
  for(let i=0;i<REMAP.length;i++){
    const [ta,ra]=REMAP[i],next=REMAP[i+1];
    if(!next){tau+=Math.max(0,t-ta)*ra;break;}
    const [tb,rb]=next,L=tb-ta;
    // Integral of a smoothstep-blended playback rate between two knots.
    if(t<tb){const x=clamp((t-ta)/L);tau+=L*(ra*x+(rb-ra)*(x**3-x**4/2));break;}
    tau+=L*(ra+rb)/2;
  }
  return tau;
}
export function playbackRate(t){
  for(let i=0;i<REMAP.length-1;i++){const [ta,ra]=REMAP[i],[tb,rb]=REMAP[i+1];if(t<tb)return ra+(rb-ra)*smooth((t-ta)/(tb-ta));}
  return REMAP[REMAP.length-1][1];
}
export function filmTime(tau){let a=0,b=20;for(let i=0;i<60;i++){const m=(a+b)/2;if(sourceTime(m)<tau)a=m;else b=m;}return (a+b)/2;}
// Sound cues in film seconds, shared with tools/signals/scores.py through the render script.
export function fragmentCues(){
  const B=BEATS;
  // Flow is measured between frames, so the burst appears on the first frame after take-off.
  return{impact:filmTime(B.takeoff+1/STAGE.fps),slow:[REMAP[2][0],REMAP[3][0]],land:filmTime(B.land),flick:filmTime(B.flick+.16),flickSnap:filmTime(B.flick+.29),
    run:[filmTime(B.runIn),filmTime(B.prep)],runCycle:RUN.cycle,walk:[filmTime(B.walk),filmTime(B.walkEnd)],walkCycle:WALK.cycle,duration:12};
}
export async function createCat(base=new URL('../../assets/characters/apricot-cat/rig.json',import.meta.url)){
  const rig=await loadRig(base.href??base);
  const [ox,oy]=rig.definition.canvas.origin;
  return{rig,pose:tau=>catPose(rig,tau),
    // Draws stage coordinates through the 2D transform already set on ctx.
    draw(ctx,tau){const p=catPose(rig,tau);ctx.save();ctx.translate(p.x,p.y);ctx.scale(CAT.scale,CAT.scale);ctx.translate(-ox,-oy);rig.draw(ctx,p.pose);ctx.restore();return p;}};
}

// ---- Pulse / Form: a large Milo portrait for the audio relief. ----
export const PORTRAIT={width:1280,height:720,scale:3.0,x:610,y:600,wave:1.25};
export async function createPortrait(base=new URL('../../assets/characters/explorer-robot/rig.json',import.meta.url)){
  const rig=await loadRig(base.href??base),[ox,oy]=rig.definition.canvas.origin;
  return{rig,draw(ctx,motion='wave',t=PORTRAIT.wave){const pose=sampleMotion(rig.definition,motion,t);ctx.save();ctx.translate(PORTRAIT.x,PORTRAIT.y);ctx.scale(PORTRAIT.scale,PORTRAIT.scale);ctx.translate(-ox,-oy);rig.draw(ctx,pose);ctx.restore();}};
}
