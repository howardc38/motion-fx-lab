// Authored intro sequences, not extra catalogue techniques.
import {themes, poster, flyer} from './studio/themes.js';
const W=1280,H=720,clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
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
