import {W,H,C,surface,text,disc,phase,mix,time,pointOnCurve,clamp} from './math.js';
import {drawLetters,letterDot,drawSpring,springPoint,masked,waveOffset} from './flat.js';
import {create as orbit} from './orbit.js';
import {createCity} from './ink.js';
import {create as lighting} from './lighting.js';
export const FILMS={
 'dot-story':{title:'One dot. Many roles.',duration:14.1,poster:8,preview:[[1.3,2.6],[3,4.3],[6.9,8.4],[9.1,10.6]],cuts:[1.2,3,5,6.8,9,12.9]},
 'ink-city':{title:'One block. A drawn city.',duration:12,poster:2.5,cuts:[5.2,9]},
 'shadow-lab':{title:'One light. Different edges.',duration:9.6,poster:6.8,cuts:[.8,5.2],music:[[0,'intro'],[2.4,'drop'],[4.8,'lift'],[7.2,'tail']]},
};
// One owner for the film's plotted curve and moving dot.
const DOT_SPRING={damping:.43,frequency:8,x0:215,x1:1065,y0:535,target:310,duration:3.2};
// Story beats (seconds). The spring beat is 1.2 s from leaving the letter to the end of the trace.
export const BEATS={toggle:1.2,letters:2.4,read:3,leap:3.3,trace:4.2,center:5,grow:5.6,hold:6.2,shape:6.8,orbit:9,reveal:11,settle:11.3,card:12.8,end:14.1};
const B=BEATS,TRACE=B.trace-B.leap;
const WAVE=t=>phase(t,2.3,3.05);
export function dotAt(t){
 const end={x:912,y:449};
 if(t<B.toggle)return{x:mix(910,974,phase(t,.35,.75)),y:360,r:42};
 if(t<B.letters)return{...pointOnCurve({x:974,y:360},{x:1050,y:140},letterDot,phase(t,B.toggle,B.letters)),r:mix(42,15,phase(t,B.toggle,B.letters))};
 if(t<B.read){const w=WAVE(t);return{x:letterDot.x,y:letterDot.y+waveOffset(3,w)*2.2,r:15};}
 if(t<B.leap)return{...pointOnCurve(letterDot,{x:350,y:100},springPoint(0,DOT_SPRING),phase(t,B.read,B.leap)),r:15};
 if(t<B.trace)return{...springPoint((t-B.leap)/TRACE*DOT_SPRING.duration,DOT_SPRING),r:15};
 if(t<B.center)return{...pointOnCurve(springPoint(DOT_SPRING.duration,DOT_SPRING),{x:1200,y:560},{x:640,y:360},phase(t,B.trace,B.center)),r:15};
 if(t<B.hold)return{x:640,y:360,r:mix(15,1000,phase(t,B.center,B.grow))};
 if(t<B.shape)return{x:640,y:360,r:mix(1000,15,phase(t,B.hold,B.shape))};
 if(t<B.reveal)return{x:640,y:360,r:15};
 if(t<B.settle)return{x:mix(640,end.x,phase(t,B.reveal,B.settle)),y:mix(360,end.y,phase(t,B.reveal,B.settle)),r:15};
 if(t<B.card)return{...end,r:15};
 return{...pointOnCurve(end,{x:1150,y:540},{x:910,y:360},phase(t,B.card,B.end)),r:mix(15,42,phase(t,B.card,B.end))};
}
function cursor(g,t){const u=phase(t,0,.55),x=mix(1140,980,u),y=mix(575,380,u),press=phase(t,.55,.67)*(1-phase(t,.67,.8));g.save();g.translate(x,y);g.scale(1-press*.18,1-press*.18);g.beginPath();g.moveTo(0,0);g.lineTo(5,49);g.lineTo(17,36);g.lineTo(30,58);g.lineTo(41,51);g.lineTo(28,30);g.lineTo(46,25);g.closePath();g.fillStyle=C.paper;g.fill();g.lineWidth=4;g.strokeStyle=C.ink;g.stroke();g.restore();}
function toggle(g,t,alpha=1){g.save();g.globalAlpha=alpha;text(g,'Make motion',220-34*phase(t,.55,1.5),398,92,C.ink,'left',900);g.fillStyle=C.ink;g.beginPath();g.roundRect(850,296,188,128,64);g.fill();text(g,'ONE DOT. MANY ROLES.',48,60,19,C.muted);text(g,'A small action starts something bigger.',48,670,23,C.muted);cursor(g,t);g.restore();}
function createDotStory(){
 // Keep this mixed Canvas/WebGL compositor GPU-backed from its first frame.
 // A CPU preference can promote mid-film and change rounded-edge antialiasing on seeks.
 const out=surface({willReadFrequently:false}),g=out.g,ring=orbit(),after=surface(),card=surface(),mask=surface().canvas;let proof;
 after.g.fillStyle=C.paper;after.g.fillRect(0,0,W,H);text(after.g,'MAKE IT',640,305,112,C.ink,'center',900);text(after.g,'MOVE',620,468,164,C.ink,'center',900);text(after.g,'An idea with somewhere to go.',640,565,27,C.muted,'center');text(after.g,'MOTION FX LAB',48,60,19,C.muted);
 // The title card eases in from a slight zoom while it is revealed, then holds still.
 function zoomCard(t){const z=1+.04*(1-phase(t,9.4,11.55));card.g.setTransform(1,0,0,1,0,0);card.g.fillStyle=C.paper;card.g.fillRect(0,0,W,H);card.g.setTransform(z,0,0,z,W/2*(1-z),H/2*(1-z));card.g.drawImage(after.canvas,0,0);card.g.setTransform(1,0,0,1,0,0);return card.canvas;}
 return{canvas:out.canvas,proof:()=>proof,frame(seconds){const t=time(seconds)%B.end,dot=dotAt(t);g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.fillStyle=t>=B.grow&&t<B.reveal?C.ink:C.paper;g.fillRect(0,0,W,H);
  if(t<1.8)toggle(g,t,1-phase(t,B.toggle,1.8));
  // the click sends a ripple out of the switch
  if(t>=.62&&t<1.4){const u=phase(t,.62,1.4);g.save();g.globalAlpha=.55*(1-u);g.strokeStyle=C.orange;g.lineWidth=6;g.beginPath();g.arc(dot.x,dot.y,42+120*u,0,Math.PI*2);g.stroke();g.restore();}
  if(t>=B.toggle&&t<B.leap){g.save();g.globalAlpha=phase(t,B.toggle,1.6)*(1-phase(t,B.read,B.leap));drawLetters(g,phase(t,B.toggle,B.letters),{wave:WAVE(t)});text(g,'A dot becomes a letter.',48,670,23,C.muted);g.restore();}
  // The spring beat: the dot leaves the letter and draws its own curve, fast.
  if(t>=B.read&&t<B.center){g.save();g.globalAlpha=phase(t,B.read,B.leap)*(1-phase(t,B.trace,4.6));drawSpring(g,Math.max(0,Math.min(DOT_SPRING.duration,(t-B.leap)/TRACE*DOT_SPRING.duration)),{...DOT_SPRING,labels:false});text(g,'Motion draws its own curve.',48,60,28);g.restore();}
  if(t>=B.shape&&t<B.reveal){const live=t-B.shape;ring.frame(live,{wrap:phase(t,B.shape,7.45),dot:false,labels:false,fly:false});
   if(t<B.orbit){g.save();g.globalAlpha=phase(t,B.shape,7.05);g.drawImage(ring.canvas,0,0);g.restore();text(g,'WORDS, IN ORBIT',48,62,24,C.paper);}
   else masked(g,ring.canvas,zoomCard(t),mask,phase(t,B.orbit,10.8));}
  if(t>=B.reveal){g.save();g.globalAlpha=1-phase(t,B.card,13.5);g.drawImage(zoomCard(t),0,0);g.restore();}
  if(t>=B.card)toggle(g,0,phase(t,13.4,B.end));
  if((t>=B.toggle&&t<B.letters)||(t>=B.read&&t<B.trace)||(t>=B.trace&&t<B.center)){for(let j=5;j>0;j--){const p=dotAt(Math.max(0,t-j*.025));g.save();g.globalAlpha=(6-j)*.035;disc(g,p.x,p.y,Math.min(15,p.r));g.restore();}}
  disc(g,dot.x,dot.y,dot.r);
  if(t>=5.3&&t<6.42){const p=phase(t,5.3,6.4),scale=phase(t,5.3,5.56)*(1-phase(t,6.2,6.42));g.save();g.translate(640,360);g.scale(scale,scale);g.rotate((1-p)*Math.PI/4);g.fillStyle=C.ink;const w=mix(240,520,p),h=mix(240,136,p);g.beginPath();g.roundRect(-w/2,-h/2,w,h,mix(30,68,p));g.fill();g.restore();}
  proof={time:t,dot,phase:t<B.toggle?'toggle':t<B.read?'letters':t<B.center?'spring':t<B.shape?'shape':t<B.orbit?'orbit':t<B.reveal?'reveal':t<B.card?'card':'return'};
 }};
}
export function createFilm(id){
 if(id==='dot-story')return createDotStory();
 if(id==='ink-city')return createCity();
 if(id==='shadow-lab'){const e=lighting(),g=e.canvas.getContext('2d');return{canvas:e.canvas,proof:e.proof,frame(t){t=time(t);e.frame(t,{lightSize:.1+2.7*phase(t,.8,4.2),height:1.15+.65*phase(t,5.2,8.8),labels:false});text(g,'ONE LIGHT. DIFFERENT EDGES.',48,55,20);text(g,t<4.8?'Change the source.':'Lift the object.',48,106,43);text(g,'Same geometry. Different penumbra.',48,664,25,C.muted);}};}
 throw new Error('Unknown design film: '+id);
}
