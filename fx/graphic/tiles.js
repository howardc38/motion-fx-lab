import {C,TAU,hash,phase,clock,output,rounded,furniture} from './common.js';
export function create(options={}){
 const out=output(options),g=out.g;let proof={};
 return{canvas:out.canvas,proof:()=>proof,frame(time,o={}){
  const t=clock(time)%9.6,mode=o.mode??(['fill','shift','triangle'][Math.floor(t/3.2)]),local=t%3.2;out.begin(C.ink);const size=67,cols=18,rows=8;
  if(mode==='shift')for(let r=0;r<rows;r++){const y=92+r*size,u=phase(local,r*.07,.65+r*.07),v=phase(local,1.55+r*.07,2.5+r*.07),dx=(r%2?1:-1)*size*2.6*(u-v);g.save();g.beginPath();g.rect(38,y,cols*size,size);g.clip();for(let c=-4;c<cols+4;c++){const col=((c%cols)+cols)%cols,color=[C.paper,C.acid,C.orange][Math.floor(hash(r*cols+col+300)*3)];rounded(g,38+c*size+dx+3,y+3,size-6,size-6,4,color)}g.restore()}
  if(mode!=='shift')for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
   const i=r*cols+c,x=38+c*size,y=92+r*size,delay=(c+r)*.032,u=phase(local,delay,delay+.7),v=phase(local,1.7+delay,2.5+delay),pulse=u-v;
   const color=[C.paper,C.acid,C.orange][Math.floor(hash(i+300)*3)];
   g.save();g.beginPath();g.rect(x,y,size,size);g.clip();
   if(mode==='fill'){const s=.13+.87*pulse;rounded(g,x+3,y+3,(size-6)*s,size-6,7,pulse>.2?color:'#27292b')}
   else if(mode==='shift'){
    const dx=(r%2?1:-1)*size*2.6*pulse;g.fillStyle='#2b2d30';g.fillRect(x+2,y+2,size-4,size-4);
    for(let k=-3;k<=3;k++){g.fillStyle=color;g.fillRect(x+dx+k*size+3,y+3,size-6,size-6)}
   }else{g.translate(x+size/2,y+size/2);g.rotate(Math.PI*(u+v)+Math.floor(hash(i)*4)*Math.PI/2);g.fillStyle=color;g.beginPath();g.moveTo(-size/2,-size/2);g.lineTo(size/2,size/2);g.lineTo(-size/2,size/2);g.closePath();g.fill()}
   g.restore();
  }
  furniture(g,'GRID / '+mode.toUpperCase(),'FILL. SLIDE. TURN.',t,{labels:o.labels});proof={mode,cells:cols*rows,local};
 }};
}
