export const W=1280,H=720,TAU=Math.PI*2;
export const C={ink:'#101115',paper:'#f1eee4',orange:'#ff6036',mint:'#42dcc1',acid:'#d3f54b',violet:'#ae91f5'};
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const mix=(a,b,u)=>a+(b-a)*u;
export const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
export const phase=(t,a,b)=>smooth((t-a)/(b-a));
export const hash=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n)};
export const clock=t=>{if(!Number.isFinite(t))throw Error('Time must be finite');return Math.max(0,t)};
export function surface(w=W,h=H){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return{canvas,g:canvas.getContext('2d',{willReadFrequently:true})}}
export function output({width=W,height=H}={}){const out=surface(width,height);return{...out,begin(bg){out.g.setTransform(width/W,0,0,height/H,0,0);out.g.globalAlpha=1;out.g.globalCompositeOperation='source-over';out.g.fillStyle=bg;out.g.fillRect(0,0,W,H)}}}
let outlines;
export async function font(){return outlines||=await fetch(new URL('../../assets/type/motion-cjk.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('Outline asset unavailable');return r.json()})}
export function glyphWidth(data,word){return [...word].reduce((n,ch)=>n+(ch===' '?320:data.glyphs[ch]?.advance??(()=>{throw Error('Unsupported outline '+ch)})()),0)}
export function wordPath(data,word,{width=1060,height=240,x=640,y=424}={}){
 const letters=[...word],advance=glyphWidth(data,word),scale=Math.min(width/advance,height/1000),path=new Path2D();let at=x-advance*scale/2;
 for(const ch of letters){if(ch===' '){at+=320*scale;continue}const glyph=data.glyphs[ch];path.addPath(new Path2D(glyph.path),new DOMMatrix([scale,0,0,-scale,at,y]));at+=glyph.advance*scale}
 return path;
}
export function word(g,data,message,o={},color=C.paper){g.fillStyle=color;g.fill(wordPath(data,message,o))}
export function disc(g,x,y,r,color){if(r<=0)return;g.beginPath();g.arc(x,y,r,0,TAU);g.fillStyle=color;g.fill()}
export function line(g,x1,y1,x2,y2,color,width=1){g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.strokeStyle=color;g.lineWidth=width;g.stroke()}
export function text(g,s,x,y,size=14,color=C.paper,align='left'){g.font='700 '+size+'px Arial,sans-serif';g.textAlign=align;g.textBaseline='alphabetic';g.fillStyle=color;g.fillText(s,x,y)}
export function furniture(g,title,sub,t,{paper=false,labels=true}={}){
 if(!labels)return;const color=paper?C.ink:C.paper;
 text(g,title,48,49,14,color);text(g,'MOTION / STUDIES',W-48,49,12,color,'right');
 line(g,48,72,W-48,72,paper?'#c9c7bf':'#3b3c40');
 text(g,sub,48,H-39,13,color);text(g,Math.min(9.6,t).toFixed(2).padStart(5,'0'),W-48,H-39,13,color,'right');
}
export function rounded(g,x,y,w,h,r,color){g.beginPath();g.roundRect(x,y,w,h,r);g.fillStyle=color;g.fill()}
