import {W,H,C,TAU,clamp,mix,smooth,phase,hash,clock,output,disc,line,text,furniture} from './common.js';
export function attractor(t){return{x:640+302*Math.sin(t*.91),y:360+138*Math.sin(t*1.43+.3)}}
export function fieldPoint(x,y,t,{strength=1,radius=250}={}){
 const a=attractor(t),dx=a.x-x,dy=a.y-y,d=Math.hypot(dx,dy),envelope=phase(t,0,.7)*(1-phase(t,3.3,4.6));
 const weight=Math.exp(-d*d/(radius*radius)),twist=Math.sin(t*1.5)*.38;
 return{x:x+envelope*strength*weight*(dx*.64-dy*twist),y:y+envelope*strength*weight*(dy*.64+dx*twist),weight,envelope};
}
export function networkPoints(t){
 return Array.from({length:64},(_,i)=>{const a=hash(i+8)*TAU,r=100+hash(i+300)*265;
 return{x:640+Math.cos(a+t*(.11+hash(i+700)*.12))*r*1.4+28*Math.sin(t*1.7+i),y:365+Math.sin(a+t*(.13+hash(i+800)*.15))*r*.72+20*Math.cos(t*1.2+i),r:2.1+hash(i+900)*2.5}});
}
export function networkEdges(points,threshold){
 const out=[];for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){const d=Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y);if(d<threshold)out.push({a:i,b:j,d,alpha:1-d/threshold})}return out;
}
export function create(mode,options={}){
 const out=output(options),g=out.g;let proof={};
 return{canvas:out.canvas,proof:()=>proof,frame(time,o={}){
  const t=clock(time)%9.6,strength=o.strength??1;
  if(mode==='field'){
   out.begin(C.acid);const wave=o.mode==='wave'||(o.mode==null&&t>=4.8),pts=[],a=attractor(t);
   if(!wave){
    const cols=35,rows=16,step=33;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const x=79+c*step,y=112+r*step,p=fieldPoint(x,y,t,{strength,radius:o.radius??250});pts.push(p);disc(g,p.x,p.y,2.5+4.4*p.weight*p.envelope*strength,C.ink)}
    g.strokeStyle=C.ink;g.lineWidth=1.2;g.beginPath();g.arc(a.x,a.y,23+4*Math.sin(t*6),0,TAU);g.stroke();
    line(g,a.x-35,a.y,a.x+35,a.y,C.ink);line(g,a.x,a.y-35,a.x,a.y+35,C.ink);
    proof={mode:'attract',count:pts.length,maxDisplacement:Math.max(...pts.map((p,i)=>Math.hypot(p.x-(79+i%cols*step),p.y-(112+Math.floor(i/cols)*step)))),strength};
   }else{
    const q=t-4.8,angle=.13*Math.sin(q*.7);
    for(let r=27;r>=0;r--)for(let c=0;c<47;c++){
     const x=(c-23)*.43,z=r*.5+1.5,h=strength*(Math.sin(x*1.15-z*.95+q*3.5)*.5+Math.sin(x*.8+z*1.2-q*2.4)*.2);
     const xx=x*Math.cos(angle)+z*Math.sin(angle),zz=2+z*Math.cos(angle)-x*Math.sin(angle),scale=790/zz;
     const px=640+xx*scale,py=148+(2.1+h*.8)*scale;disc(g,px,py,mix(1.2,5.7,1-r/28),C.ink);pts.push({px,py,h});
    }
    proof={mode:'wave',count:pts.length,strength,heightRange:Math.max(...pts.map(p=>p.h))-Math.min(...pts.map(p=>p.h))};
   }
   furniture(g,'01 / FIELD','PULL. WARP. RETURN.',t,{paper:true,labels:o.labels});
  }else if(mode==='network'){
   out.begin(C.ink);const threshold=o.threshold??(122+42*Math.sin(t*.9))*strength,points=networkPoints(t),edges=networkEdges(points,threshold);
   for(const e of edges){const a=points[e.a],b=points[e.b];line(g,a.x,a.y,b.x,b.y,'rgba(241,238,228,'+(.08+.52*e.alpha)+')',.7+e.alpha*1.1);
    if((e.a*7+e.b)%13===0){const u=(t*.7+hash(e.a*64+e.b))%1;disc(g,mix(a.x,b.x,u),mix(a.y,b.y,u),2.7,C.orange)}
   }
   for(let i=0;i<points.length;i++){const p=points[i];if(i%11===0){g.strokeStyle='#ff6036';g.lineWidth=1;g.beginPath();g.arc(p.x,p.y,11+3*Math.sin(t*4+i),0,TAU);g.stroke()}disc(g,p.x,p.y,p.r,i%5===0?C.orange:C.paper)}
   if(o.labels!==false){text(g,String(edges.length).padStart(3,'0'),71,578,64,C.orange);text(g,'CONNECTIONS',74,604,12,C.paper)}
   furniture(g,'03 / NETWORK','NEAR ENOUGH TO CONNECT.',t,{labels:o.labels});
   proof={mode,threshold,nodes:points.length,edges:edges.length,maxEdge:Math.max(0,...edges.map(e=>e.d)),positions:points.slice(0,3)};
  }else throw Error('Unknown field '+mode);
 }};
}
