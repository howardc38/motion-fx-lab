import {W,H,C,surface,text,disc,phase,mix,time,pointOnCurve} from './math.js';
import {drawLetters,letterDot,drawSpring,springPoint,masked} from './flat.js';
import {create as orbit} from './orbit.js';
import {createCity} from './ink.js';
import {create as lighting} from './lighting.js';
export const FILMS={
 'dot-story':{title:'One dot. Many roles.',duration:19.2,poster:12.9,gif:[[1.3,2.6],[5.8,7.2],[12.3,14.1],[15.7,17.5]],cuts:[1.2,4.8,9.6,12,14.4,18]},
 'ink-city':{title:'One block. A drawn city.',duration:19.2,poster:18.4,gif:[[1,2.4],[4.8,6.2],[9.8,11.4],[15.6,17.4]],cuts:[2.4,6,14.4]},
 'shadow-lab':{title:'One light. Different edges.',duration:9.6,poster:6.8,gif:[[1,2.4],[3.2,4.6],[6.4,8.4]],cuts:[.8,5.2],music:[[0,'intro'],[2.4,'drop'],[4.8,'lift'],[7.2,'tail']]},
};
// One owner for the film's plotted curve and moving dot.
const DOT_SPRING={damping:.43,frequency:8,x0:215,x1:1065,y0:535,target:310,duration:3.2};
export function dotAt(t){
 const end={x:912,y:449};
 if(t<1.2)return{x:mix(910,974,phase(t,.35,.75)),y:360,r:42};
 if(t<2.4)return{...pointOnCurve({x:974,y:360},{x:1050,y:140},letterDot,phase(t,1.2,2.4)),r:mix(42,15,phase(t,1.2,2.4))};
 if(t<4.8)return{...letterDot,r:15};
 if(t<5.4)return{...pointOnCurve(letterDot,{x:350,y:100},springPoint(0,DOT_SPRING),phase(t,4.8,5.4)),r:15};
 if(t<8.8)return{...springPoint(Math.min(DOT_SPRING.duration,t-5.4),DOT_SPRING),r:15};
 if(t<9.6)return{...pointOnCurve(springPoint(DOT_SPRING.duration,DOT_SPRING),{x:1200,y:560},{x:640,y:360},phase(t,8.8,9.6)),r:15};
 if(t<11.2)return{x:640,y:360,r:mix(15,1000,phase(t,9.6,10.4))};
 if(t<12)return{x:640,y:360,r:mix(1000,15,phase(t,11.2,12))};
 if(t<16.4)return{x:640,y:360,r:15};
 if(t<17.2)return{x:mix(640,end.x,phase(t,16.4,17.2)),y:mix(360,end.y,phase(t,16.4,17.2)),r:15};
 if(t<18)return{...end,r:15};
 return{...pointOnCurve(end,{x:1150,y:540},{x:910,y:360},phase(t,18,19.2)),r:mix(15,42,phase(t,18,19.2))};
}
function cursor(g,t){const u=phase(t,0,.55),x=mix(1140,980,u),y=mix(575,380,u),press=phase(t,.55,.67)*(1-phase(t,.67,.8));g.save();g.translate(x,y);g.scale(1-press*.18,1-press*.18);g.beginPath();g.moveTo(0,0);g.lineTo(5,49);g.lineTo(17,36);g.lineTo(30,58);g.lineTo(41,51);g.lineTo(28,30);g.lineTo(46,25);g.closePath();g.fillStyle=C.paper;g.fill();g.lineWidth=4;g.strokeStyle=C.ink;g.stroke();g.restore();}
function toggle(g,t,alpha=1){g.save();g.globalAlpha=alpha;text(g,'Make motion',220,398,92,C.ink,'left',900);g.fillStyle=C.ink;g.beginPath();g.roundRect(850,296,188,128,64);g.fill();text(g,'ONE DOT. MANY ROLES.',48,60,19,C.muted);text(g,'A small action starts something bigger.',48,670,23,C.muted);cursor(g,t);g.restore();}
function createDotStory(){
 // Keep this mixed Canvas/WebGL compositor GPU-backed from its first frame.
 // A CPU preference can promote mid-film and change rounded-edge antialiasing on seeks.
 const out=surface({willReadFrequently:false}),g=out.g,ring=orbit(),before=surface(),after=surface(),mask=surface().canvas;let proof;
 ring.frame(2.4,{wrap:1,dot:false,labels:false});before.g.drawImage(ring.canvas,0,0);
 after.g.fillStyle=C.paper;after.g.fillRect(0,0,W,H);text(after.g,'MAKE IT',640,305,112,C.ink,'center',900);text(after.g,'MOVE',620,468,164,C.ink,'center',900);text(after.g,'An idea with somewhere to go.',640,565,27,C.muted,'center');text(after.g,'MOTION FX LAB',48,60,19,C.muted);
 return{canvas:out.canvas,proof:()=>proof,frame(seconds){const t=time(seconds)%19.2,dot=dotAt(t);g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.fillStyle=t>=10.4&&t<16.8?C.ink:C.paper;g.fillRect(0,0,W,H);
  if(t<1.8)toggle(g,t,1-phase(t,1.2,1.8));
  if(t>=1.2&&t<5.4){g.save();g.globalAlpha=phase(t,1.2,1.6)*(1-phase(t,4.8,5.4));drawLetters(g,phase(t,1.2,2.4));text(g,'A dot becomes a letter.',48,670,23,C.muted);g.restore();}
  if(t>=4.8&&t<9.6){g.save();g.globalAlpha=phase(t,4.8,5.4)*(1-phase(t,8.8,9.6));drawSpring(g,Math.max(0,Math.min(DOT_SPRING.duration,t-5.4)),DOT_SPRING);text(g,'Then the movement becomes a curve.',48,60,28);g.restore();}
  if(t>=12&&t<14.4){ring.frame(t-12,{wrap:phase(t,12,12.65),dot:false,labels:false});g.save();g.globalAlpha=phase(t,12,12.25);g.drawImage(ring.canvas,0,0);g.restore();text(g,'WORDS, IN ORBIT',48,62,24,C.paper);}
  if(t>=14.4&&t<16.8)masked(g,before.canvas,after.canvas,mask,phase(t,14.4,16.4));
  if(t>=16.8){g.save();g.globalAlpha=1-phase(t,18,18.6);g.drawImage(after.canvas,0,0);g.restore();}
  if(t>=18)toggle(g,0,phase(t,18.5,19.2));
  if((t>=1.2&&t<2.4)||(t>=4.8&&t<5.4)||(t>=8.8&&t<9.6)){for(let j=5;j>0;j--){const p=dotAt(Math.max(0,t-j*.025));g.save();g.globalAlpha=(6-j)*.035;disc(g,p.x,p.y,Math.min(15,p.r));g.restore();}}
  disc(g,dot.x,dot.y,dot.r);
  if(t>=10&&t<11.5){const p=phase(t,10,11.2),scale=phase(t,10,10.35)*(1-phase(t,11.2,11.5));g.save();g.translate(640,360);g.scale(scale,scale);g.rotate((1-p)*Math.PI/4);g.fillStyle=C.ink;const w=mix(240,520,p),h=mix(240,136,p);g.beginPath();g.roundRect(-w/2,-h/2,w,h,mix(30,68,p));g.fill();g.restore();}
  proof={time:t,dot,phase:t<1.2?'toggle':t<4.8?'letters':t<9.6?'spring':t<12?'shape':t<14.4?'orbit':t<16.8?'reveal':t<18?'card':'return'};
 }};
}
export function createFilm(id){
 if(id==='dot-story')return createDotStory();
 if(id==='ink-city')return createCity();
 if(id==='shadow-lab'){const e=lighting(),g=e.canvas.getContext('2d');return{canvas:e.canvas,proof:e.proof,frame(t){t=time(t);e.frame(t,{lightSize:.1+2.7*phase(t,.8,4.2),height:1.15+.65*phase(t,5.2,8.8),labels:false});text(g,'ONE LIGHT. DIFFERENT EDGES.',48,55,20);text(g,t<4.8?'Change the source.':'Lift the object.',48,106,43);text(g,'Same geometry. Different penumbra.',48,664,25,C.muted);}};}
 throw new Error('Unknown design film: '+id);
}
