import {W,H,C,TAU,surface,text,title,disc,clamp,mix,phase,spring,time} from './math.js';
export function letterLayout(word,size=150){const c=document.createElement('canvas'),g=c.getContext('2d');g.font=`900 ${size}px Arial`;const widths=[...word].map(c=>g.measureText(c).width),total=widths.reduce((a,b)=>a+b,0);let x=(W-total)/2;return [...word].map((char,i)=>{const p={char,x:x+widths[i]/2,width:widths[i]};x+=widths[i];return p;});}
const letters=letterLayout('Motion');
export const letterDot={x:letters[3].x,y:281};
// A ripple that runs along the settled word; letter 3 carries the dot.
export function waveOffset(i,w){return -22*Math.sin(Math.PI*clamp((w-i*.1)/.5));}
export function drawLetters(g,p,{y=420,color=C.ink,exit=0,wave=0}={}){
 p=clamp(p);exit=clamp(exit);let dot={...letterDot,y:y-139};
 for(let i=0;i<letters.length;i++){const l=letters[i],u=phase(p,i*.04,.72+i*.04),x=mix(110+i*176,l.x,u),yy=y+Math.sin(i*.9+p*TAU)*(1-u)*100;
  // exit: letters lift off in turn, curling away upwards
  const e=phase(exit,i*.07,.5+i*.07),ex=(i-2.5)*46*e+Math.sin(e*Math.PI)*24*(i%2?1:-1),ey=-560*e*e+36*Math.sin(e*Math.PI)+(wave?waveOffset(i,wave):0),er=(i%2?1:-1)*1.3*e;
  if(i===3)dot={x:x+ex,y:yy+ey-139};
  g.save();g.translate(x+ex,yy+ey);g.rotate((1-u)*Math.sin(i+1)*.8+er);text(g,l.char==='i'?'ı':l.char,0,0,150,color,'center',900);g.restore();}
 if(p<.8){g.save();g.globalAlpha*=1-phase(p,.15,.7);text(g,'MAKE',640,210-130*phase(p,0,.8),60,color,'center',900);g.restore();}
 return dot;
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
// Two pictures with the same layout and opposite palettes: the reveal reads as day <-> night.
const hashN=n=>{const x=Math.sin(n*91.7+3.1)*43758.5453;return x-Math.floor(x);};
function landscape(g,day){
 const sky=g.createLinearGradient(0,0,0,H);
 if(day){sky.addColorStop(0,'#ff8a4c');sky.addColorStop(.55,'#ffc76a');sky.addColorStop(1,'#ffe3a3');}else{sky.addColorStop(0,'#081631');sky.addColorStop(.6,'#1b2d58');sky.addColorStop(1,'#2a3f6e');}
 g.fillStyle=sky;g.fillRect(0,0,W,H);
 if(!day)for(let i=0;i<140;i++){const x=hashN(i)*W,y=hashN(i+300)*H*.6,r=.6+hashN(i+600)*1.6;disc(g,x,y,r,'rgba(242,238,229,'+(.35+hashN(i+900)*.6).toFixed(2)+')');}
 disc(g,930,200,day?104:86,day?'#fff6dc':'#f2eee5');
 if(!day)disc(g,962,182,78,'#1b2d58');
 const layers=day?['#f06a4f','#c84a45','#2f7f86']:['#16264a','#101c38','#0a1226'];
 layers.forEach((c,k)=>{g.fillStyle=c;g.beginPath();g.moveTo(0,H);for(let x=0;x<=W;x+=16){const y=330+k*95+60*Math.sin(x*.006+k*1.7)+28*Math.sin(x*.017+k*3.1)+14*Math.sin(x*.041+k);g.lineTo(x,y);}g.lineTo(W,H);g.closePath();g.fill();});
 // a small cabin keeps the eye anchored across the swap
 g.fillStyle=day?'#fff3e2':'#0d1730';g.fillRect(236,540,120,82);g.beginPath();g.moveTo(222,546);g.lineTo(296,488);g.lineTo(370,546);g.closePath();g.fillStyle=day?'#7a2f2a':'#060c1b';g.fill();
 g.fillStyle=day?'#2f7f86':'#ffc14d';g.fillRect(262,566,30,30);g.fillRect(304,566,30,30);
 text(g,day?'DAY':'NIGHT',W-48,H-40,30,day?'rgba(23,35,41,.75)':'rgba(242,238,229,.8)','right',900);
}
export function create(mode){
 const {canvas,g}=surface(),mask=surface().canvas,a=surface(),b=surface();let proof;
 if(mode==='reveal'){landscape(a.g,false);landscape(b.g,true);}
 return{canvas,proof:()=>proof,frame(t,options={}){t=time(t);g.globalAlpha=1;g.fillStyle=C.paper;g.fillRect(0,0,W,H);
  if(mode==='letters'){
   // in (0.15-1.8 s), a short read (under 1 s), out (2.3-4.75 s), then the next entry
   const q=t%4.8,p=phase(q,.15,1.8),exit=phase(q,2.3,4.75);g.save();g.globalAlpha=phase(q,0,.3);const dot=drawLetters(g,p,{exit});disc(g,dot.x,dot.y,15);g.restore();
   if(options.labels!==false)title(g,'Letters find their places.','Curve-guided letter reflow');proof={mode,progress:p,exit};}
  else if(mode==='reveal'){
   // night -> day from the centre, then day -> night from the sun
   const q=t%4.8,forward=q<2.4,manual=options.progress!=null;
   const p=manual?options.progress:forward?phase(q,.3,2.1):phase(q,2.7,4.5);
   const from=options.from||(forward?a.canvas:b.canvas),to=options.to||(forward?b.canvas:a.canvas);
   const center=options.center??(manual||forward?undefined:{x:930,y:200});
   masked(g,from,to,mask,p,center);if(options.labels!==false)title(g,'One field reveals another frame.','Radial dot mask',C.paper);proof={mode,progress:p,direction:forward?'night-to-day':'day-to-night'};}
  else throw new Error('Unknown flat study: '+mode);
 }};
}
