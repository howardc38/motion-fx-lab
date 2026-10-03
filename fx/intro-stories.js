// Authored intro sequences, not extra catalogue techniques.
import {themes, poster, flyer} from './studio/themes.js';
const W=1280,H=720,clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
const hash=n=>{const x=Math.sin(n*127.1+19.7)*43758.5453;return x-Math.floor(x);};
function surface(){const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;return {canvas,g:canvas.getContext('2d',{willReadFrequently:true})};}
function text(g,str,x,y,size,color='#f4ecd8',align='left'){g.fillStyle=color;g.font=`900 ${size}px Arial`;g.textAlign=align;g.fillText(str,x,y);g.textAlign='left';}
export function createWorlds(){
 const {canvas,g}=surface(),picked=[7,3,12,13,16,19];let proof;
 function world(id,t){const th=themes[id];g.fillStyle=th.bg;g.fillRect(0,0,W,H);g.globalAlpha=.58;g.drawImage(poster(id),0,85,420,360,0,0,W,H);g.globalAlpha=1;g.drawImage(flyer(id,t),155,132+Math.sin(t*2)*12,970,546);text(g,'One flight. Twenty worlds.',48,76,42,th.ink);text(g,th.name.toUpperCase(),48,672,23,th.ink);}
 return {canvas,frame(t){
   t=Math.max(0,Math.min(7.2,t));g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;
   if(t<5.4){const k=Math.min(5,Math.floor(t/.9)),u=(t-k*.9)/.9;world(picked[k],t);if(k<5&&u>.76){const wipe=ease((u-.76)/.24);g.save();g.beginPath();g.rect(W*(1-wipe),0,W*wipe,H);g.clip();world(picked[k+1],t);g.restore();}proof={phase:'flight',theme:picked[k],poseTime:t};}
   else {const u=ease((t-5.4)/.8);g.fillStyle='#eee7d5';g.fillRect(0,0,W,H);g.globalAlpha=u;
    text(g,'ONE FLIGHT.',48,278,48,'#173746');text(g,'20 WORLDS.',48,341,48,'#be6249');text(g,'One continuous character.',50,410,20,'#173746');
    for(let id=0;id<20;id++){const x=450+id%5*160,y=35+Math.floor(id/5)*169;g.drawImage(poster(id),x,y,120,160);g.drawImage(flyer(id,t),x-10,y+45,145,82);}
    g.globalAlpha=1;if(u<1){g.save();g.translate(mix(0,1090,u),mix(0,588,u));g.scale(mix(1,120/W,u),mix(1,120/W,u));world(19,t);g.restore();}proof={phase:'overview',count:20,poseTime:t};}
 },proof:()=>proof};
}
export function createWordforms(){
 const {canvas,g}=surface(),mask=surface(),m=mask.g;
 m.fillStyle='#fff';m.font='900 260px Arial';m.textAlign='center';m.fillText('FLOW',640,440);
 const pixels=m.getImageData(0,0,W,H).data,points=[];
 for(let y=210;y<470;y+=6)for(let x=150;x<1130;x+=6)if(pixels[(y*W+x)*4+3]>128)points.push({x,y,angle:hash(x+y*W)*Math.PI*2,r:160+hash(x*3+y)*700});
 let proof;
 return {canvas,frame(t){
  t=Math.max(0,Math.min(7.2,t));const phase=t<1.2?'type':t<2.4?'slices':t<3.6?'dots':t<4.8?'scatter':t<6.4?'assemble':'resolved';
  const paper=t>=2.4&&t<3.6,bg=paper?'#f0d36a':'#142a39',ink=paper?'#172d3b':'#f1e9d5';g.fillStyle=bg;g.fillRect(0,0,W,H);
  text(g,'One word. Many forms.',48,76,42,ink);
  if(phase==='type'||phase==='resolved'){g.globalAlpha=phase==='type'?ease(t/.28):1;g.drawImage(mask.canvas,0,0);g.globalAlpha=1;}
  else if(phase==='slices'){const u=(t-1.2)/1.2;for(let y=205;y<478;y+=13){const dx=Math.sin(y*.055+u*13)*75*Math.sin(u*Math.PI);g.drawImage(mask.canvas,0,y,W,13,dx,y,W,13);}}
  else {
   const amount=phase==='dots'?0:phase==='scatter'?ease((t-3.6)/1.2):1-ease((t-4.8)/1.6);
   for(const p of points){const spin=amount*1.4;const x=p.x+Math.cos(p.angle+spin)*p.r*amount,y=p.y+Math.sin(p.angle+spin)*p.r*amount*.65;
    g.fillStyle=amount>.1?(hash(p.x+p.y)<.35?'#f08b65':'#b9dbe1'):ink;g.beginPath();g.arc(x,y,phase==='dots'?2.4:2.2,0,Math.PI*2);g.fill();}
  }
  text(g,'Titles. Brands. Transitions.',48,669,23,ink);proof={phase,word:'FLOW',points:points.length};
 },proof:()=>proof};
}
export function createEditStory(){
 const {canvas,g}=surface();let proof;
 return {canvas,frame(t){
  t=Math.max(0,Math.min(4.8,t));const edited=t>=1.8,word=edited?'FLOW':'WAVE';
  const seek=t<1.4?mix(2.7,.9,ease(t/1.4)):t<2.5?.9:mix(.9,2.7,ease((t-2.5)/1));
  g.fillStyle='#eee7d5';g.fillRect(0,0,W,H);text(g,'Change a word. Keep the motion.',48,76,44,'#172d3b');
  g.fillStyle='#142a39';g.fillRect(80,124,1120,377);text(g,word,640+Math.sin(seek*2)*65,354,170,'#f1e9d5','center');
  g.fillStyle=edited?'#d0e2cf':'#fff';g.fillRect(80,523,295,54);text(g,`TEXT  ${word}`,99,558,23,'#173746');
  g.fillStyle='#142a39';g.fillRect(982,523,218,54);text(g,t<3.5?'EXPORT MP4':'MP4 READY',1091,558,21,'#f1e9d5','center');
  g.strokeStyle='#9ba4a2';g.lineWidth=3;g.beginPath();g.moveTo(80,628);g.lineTo(1200,628);g.stroke();
  for(let i=0;i<=8;i++){const x=80+i*140;g.beginPath();g.moveTo(x,619);g.lineTo(x,639);g.stroke();text(g,(i*.5).toFixed(1)+'s',x,667,14,'#62716f','center');}
  const px=80+seek/4*1120;g.fillStyle='#ce6449';g.fillRect(px-3,601,6,48);g.beginPath();g.moveTo(px-9,593);g.lineTo(px+9,593);g.lineTo(px,605);g.fill();
  if(t<1.4){g.fillStyle='#173746';g.beginPath();g.moveTo(px+8,631);g.lineTo(px+11,662);g.lineTo(px+21,650);g.lineTo(px+34,649);g.fill();}
  if(t>=1.4&&t<1.8){g.strokeStyle='#ce6449';g.lineWidth=3;g.strokeRect(169,531,145,37);}
  proof={word,sourceTime:seek,exported:t>=3.5};
 },proof:()=>proof};
}
