import {W,H,C,TAU,surface,text,title,disc,clamp,mix,phase,spring,time} from './math.js';
export function letterLayout(word,size=150){const c=document.createElement('canvas'),g=c.getContext('2d');g.font=`900 ${size}px Arial`;const widths=[...word].map(c=>g.measureText(c).width),total=widths.reduce((a,b)=>a+b,0);let x=(W-total)/2;return [...word].map((char,i)=>{const p={char,x:x+widths[i]/2,width:widths[i]};x+=widths[i];return p;});}
const letters=letterLayout('Motion');
export const letterDot={x:letters[3].x,y:281};
export function drawLetters(g,p,{y=420,color=C.ink}={}){
 p=clamp(p);
 for(let i=0;i<letters.length;i++){const l=letters[i],u=phase(p,i*.04,.72+i*.04),x=mix(110+i*176,l.x,u),yy=y+Math.sin(i*.9+p*TAU)*(1-u)*100;g.save();g.translate(x,yy);g.rotate((1-u)*Math.sin(i+1)*.8);text(g,l.char==='i'?'ı':l.char,0,0,150,color,'center',900);g.restore();}
 if(p<.8){g.save();g.globalAlpha=1-phase(p,.15,.7);text(g,'MAKE',640,210-130*phase(p,0,.8),60,color,'center',900);g.restore();}
 return {...letterDot,y:y-139};
}
export function springPoint(elapsed,{damping=.43,frequency=8,x0=215,x1=1065,y0=535,target=310,duration=3.2}={}){
 const at=clamp(elapsed/duration),value=spring(Math.min(duration,Math.max(0,elapsed)),{damping,frequency});return{x:mix(x0,x1,at),y:mix(y0,target,value),value};
}
export function drawSpring(g,elapsed,{damping=.43,frequency=8,labels=true,x0=215,x1=1065,y0=535,target=310,duration=3.2}={}){
 const at=clamp(elapsed/duration);
 g.strokeStyle=C.line;g.lineWidth=2;g.beginPath();g.moveTo(x0,y0+20);g.lineTo(x0,target-100);g.moveTo(x0-20,y0);g.lineTo(x1+20,y0);g.stroke();g.setLineDash([7,8]);g.beginPath();g.moveTo(x0,target);g.lineTo(x1,target);g.stroke();g.setLineDash([]);
 g.strokeStyle=C.ink;g.lineWidth=4;g.beginPath();for(let i=0;i<=180*at;i++){const u=i/180;const {x,y}=springPoint(u*duration,{damping,frequency,x0,x1,y0,target,duration});i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();
 const dot=springPoint(elapsed,{damping,frequency,x0,x1,y0,target,duration});
 if(labels){const overshoot=damping===1?0:Math.exp(-Math.PI*damping/Math.sqrt(1-damping*damping));text(g,`+${Math.round(overshoot*100)}% overshoot`,720,205,40);text(g,'Same function. Same motion.',215,608,23,C.muted);}
 return dot;
}
export function revealMask(mask,p,center={x:640,y:360}){
 const g=mask.getContext('2d');g.clearRect(0,0,W,H);g.fillStyle='#fff';const step=30;
 for(let y=15;y<H;y+=step)for(let x=15;x<W;x+=step){const d=Math.hypot(x-center.x,y-center.y)/760,u=clamp((p-d*.43)/.57),r=step*.74*phase(u,0,1);if(r>0)disc(g,x,y,r,'#fff');}
 if(p>=1)g.fillRect(0,0,W,H);
}
export function masked(g,a,b,mask,p,center){g.drawImage(a,0,0);revealMask(mask,p,center);const layer=mask._layer||(mask._layer=surface());layer.g.globalCompositeOperation='source-over';layer.g.clearRect(0,0,W,H);layer.g.drawImage(b,0,0);layer.g.globalCompositeOperation='destination-in';layer.g.drawImage(mask,0,0);layer.g.globalCompositeOperation='source-over';g.drawImage(layer.canvas,0,0);}
export function create(mode){
 const {canvas,g}=surface(),mask=surface().canvas,a=surface(),b=surface();let proof;
 a.g.fillStyle=C.ink;a.g.fillRect(0,0,W,H);text(a.g,'BEFORE',640,420,130,C.paper,'center',900);
 b.g.fillStyle=C.paper;b.g.fillRect(0,0,W,H);text(b.g,'AFTER',640,420,130,C.ink,'center',900);
 return{canvas,proof:()=>proof,frame(t,options={}){t=time(t);g.globalAlpha=1;g.fillStyle=C.paper;g.fillRect(0,0,W,H);
  if(mode==='letters'){const p=phase(t%4.8,.25,2.5),dot=drawLetters(g,p);disc(g,dot.x,dot.y,15);if(options.labels!==false)title(g,'Letters find their places.','Curve-guided letter reflow');proof={mode,progress:p};}
  else if(mode==='spring'){const d=options.damping??.43,at=Math.min(3.2,t%4.8);const point=drawSpring(g,at,{damping:d,labels:options.labels!==false});disc(g,point.x,point.y,17);if(options.labels!==false)title(g,'Motion draws its own curve.','Closed-form spring response');proof={mode,sourceTime:at,damping:d,value:point.value,dot:point};}
  else if(mode==='reveal'){const p=options.progress??phase(t%4.8,.4,3.7);masked(g,options.from||a.canvas,options.to||b.canvas,mask,p,options.center);if(options.labels!==false)title(g,'One field reveals another frame.','Radial dot mask',p<.3?C.paper:C.ink);proof={mode,progress:p};}
  else throw new Error('Unknown flat study: '+mode);
 }};
}
