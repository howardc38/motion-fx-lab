export const W=1280,H=720,TAU=Math.PI*2;
export const clamp=x=>Math.max(0,Math.min(1,x));
export const mix=(a,b,t)=>a+(b-a)*t;
export const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const phase=(t,a,b)=>smooth((t-a)/(b-a));
export function time(t){if(!Number.isFinite(t))throw new Error('Frame time must be finite');return Math.max(0,t);}
export const hash=n=>{const x=Math.sin(n*127.1+43.9)*43758.5453;return x-Math.floor(x);};
export const C={paper:'#f2eee5',ink:'#172329',orange:'#fa613d',muted:'#69716d',line:'#d6d0c4'};
export function surface({willReadFrequently=true}={}){const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;return{canvas,g:canvas.getContext('2d',{willReadFrequently})};}
const typeCache=new Map();
// Rasterize text once at its final size; moving it never changes glyph cache state.
export function text(g,str,x,y,size=24,color=C.ink,align='left',weight=700){
 const key=[str,size,color,weight].join('|');let item=typeCache.get(key);
 if(!item){const c=document.createElement('canvas'),h=c.getContext('2d',{willReadFrequently:true});h.font=`${weight} ${size}px Arial`;const width=Math.ceil(h.measureText(str).width);c.width=Math.max(1,width+8);c.height=Math.ceil(size*1.5);h.font=`${weight} ${size}px Arial`;h.fillStyle=color;h.textBaseline='alphabetic';h.fillText(str,4,size);item={c,width};typeCache.set(key,item);}
 g.drawImage(item.c,x-4-(align==='center'?item.width/2:align==='right'?item.width:0),y-size);
}
export function title(g,heading,sub,color=C.ink){text(g,sub.toUpperCase(),48,50,15,color);text(g,heading,46,99,38,color);}
export function disc(g,x,y,r,color=C.orange){g.fillStyle=color;g.beginPath();g.arc(x,y,Math.max(0,r),0,TAU);g.fill();}
export function spring(t,{damping=.43,frequency=8}={}){
 if(!(damping>0&&damping<=1&&frequency>0))throw new Error('Spring damping must be in (0,1], frequency >0');
 t=Math.max(0,t);
 if(damping===1)return 1-(1+frequency*t)*Math.exp(-frequency*t);
 const q=Math.sqrt(1-damping*damping),w=frequency*q;
 return 1-Math.exp(-damping*frequency*t)*(Math.cos(w*t)+damping/q*Math.sin(w*t));
}
export function pointOnCurve(a,b,c,t){return{x:(1-t)**2*a.x+2*(1-t)*t*b.x+t*t*c.x,y:(1-t)**2*a.y+2*(1-t)*t*b.y+t*t*c.y};}
