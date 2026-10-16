import {W,H,C,TAU,clamp,mix,phase,smooth,clock,surface,output,font,wordPath,word,disc,line,text,rounded,furniture} from './common.js';
export async function create(mode,options={}){
 const data=await font(),out=output(options),g=out.g,layer=surface(),lg=layer.g,ink=surface(),ig=ink.g;let proof={};
 const cache=new Map();
 function mask(message){if(cache.has(message))return cache.get(message);const m=surface();m.g.fillStyle='#fff';m.g.fill(wordPath(data,message,{height:290,width:1110,y:460}));cache.set(message,m.canvas);return m.canvas}
 function clipped(message,draw){
  lg.setTransform(1,0,0,1,0,0);lg.globalCompositeOperation='source-over';lg.clearRect(0,0,W,H);draw(lg);
  lg.globalCompositeOperation='destination-in';lg.drawImage(mask(message),0,0);lg.globalCompositeOperation='source-over';g.drawImage(layer.canvas,0,0);
 }
 return{canvas:out.canvas,proof:()=>proof,frame(time,o={}){
  const t=clock(time),q=t%9.6,strength=o.strength??1,message=o.text??(mode==='fill'?'流動':mode==='shadow'?'FORM':'MOVE');
  if(mode==='fill'){
   const style=o.mode??(q<3.2?'stripe':q<6.4?'liquid':'split');out.begin(style==='liquid'?C.ink:C.paper);
   const p=wordPath(data,message,{height:290,width:1110,y:460});g.strokeStyle=style==='liquid'?'#5c5c59':'#b9b6ae';g.lineWidth=1.5;g.stroke(p);
   clipped(message,l=>{
    if(style==='stripe'){
     l.fillStyle=C.ink;l.fillRect(0,0,W,H);l.save();l.translate(640,360);l.rotate(-.39);
     for(let x=-1100;x<1200;x+=68){l.fillStyle=C.orange;l.fillRect(x+(q*160*strength)%68,-800,31,1600)}l.restore();
    }else if(style==='liquid'){
     const local=q-3.2,level=o.fill??(.18+.72*(.5-.5*Math.cos(local*1.85)));
     l.fillStyle=C.mint;l.beginPath();l.moveTo(0,H);
     for(let x=0;x<=W;x+=5)l.lineTo(x,510-level*330+strength*(15*Math.sin(x*.017-local*4)+8*Math.sin(x*.031+local*2.5)));
     l.lineTo(W,H);l.closePath();l.fill();
     l.fillStyle=C.paper;for(let i=0;i<22;i++){const x=(i*97+local*25)%W,y=520-((i*57+local*76)%330);disc(l,x,y,2+i%3,C.paper)}
    }else{
     l.fillStyle=C.ink;l.fillRect(0,0,W,H);l.save();l.translate(640+380*Math.sin((q-6.4)*2),360);l.rotate(-.55);l.fillStyle=C.orange;l.fillRect(0,-1200,1800,2400);l.restore();
    }
   });
   if(o.labels!==false){text(g,style==='stripe'?'01  PATTERN':style==='liquid'?'02  LIQUID':'03  TWO TONES',640,561,15,style==='liquid'?C.mint:C.ink,'center')}
   furniture(g,'02 / TYPE AS MATERIAL','SAME LETTERS. A DIFFERENT INTERIOR.',q,{paper:style!=='liquid',labels:o.labels});proof={mode,style,message,strength,maskSize:[W,H]};
  }else if(mode==='shadow'){
   out.begin(C.orange);const angle=o.angle??(-.2+q*.7),length=o.length??(95+115*(.5+.5*Math.sin(q*1.1))),dx=Math.cos(angle)*length,dy=Math.sin(angle)*length;
   const shape=mask(message);
   ig.clearRect(0,0,W,H);ig.fillStyle=C.ink;ig.fillRect(0,0,W,H);ig.globalCompositeOperation='destination-in';ig.drawImage(shape,0,0);ig.globalCompositeOperation='source-over';
   for(let s=1;s>=0;s-=1/100)g.drawImage(ink.canvas,dx*s*strength,dy*s*strength);
   g.fillStyle=C.paper;g.fill(wordPath(data,message,{height:290,width:1110,y:460}));
   furniture(g,'04 / LONG SHADOW','CHANGE THE DIRECTION. CHANGE THE WEIGHT.',q,{paper:true,labels:o.labels});proof={mode,angle,length,strength,message,offset:[dx*strength,dy*strength]};
  }else if(mode==='flap'){
   out.begin(C.ink);const words=['MOVE','FLOW','PLAY','FORM'],cycle=Math.floor(t/1.2),a=words[cycle%4],b=words[(cycle+1)%4];
   for(let i=0;i<4;i++){
    const x=180+i*233,y=205,w=218,h=270,u=clamp((t%1.2-i*.065-.12)/.5),rot=Math.PI*u;
    rounded(g,x,y,w,h,9,'#28292c');
    function face(ch,top,color){g.save();g.beginPath();g.rect(x,y+(top?0:h/2),w,h/2);g.clip();rounded(g,x,y,w,h,9,color);word(g,data,ch,{x:x+w/2,y:y+224,width:170,height:234},C.paper);g.restore()}
    face(b[i],true,'#323337');face(a[i],false,'#242528');
    g.save();g.translate(x+w/2,y+h/2);g.scale(1,Math.abs(Math.cos(rot)));g.translate(-x-w/2,-y-h/2);
    face(u<.5?a[i]:b[i],u<.5,'#303135');g.restore();
    g.fillStyle='rgba(0,0,0,'+(.45*Math.sin(rot))+')';g.fillRect(x,y+h/2,w,h/2);
    line(g,x,y+h/2,x+w,y+h/2,C.ink,3);for(const xx of [x+10,x+w-18])rounded(g,xx,y+h/2-11,8,22,2,'#66686a');
   }
   text(g,'NEXT / '+b,640,563,18,C.orange,'center');furniture(g,'FLIP / DEPARTURE','FOUR LETTERS. ONE PRECISE LANDING.',q,{labels:o.labels});
   proof={mode,from:a,to:b,cycle};
  }else if(mode==='reels'){
   const letters=o.mode==='letters'||(o.mode==null&&q>=4.8),chars=letters?'FLOW':'0123456789',n=letters?4:6,w=letters?218:144,gap=12,total=n*w+(n-1)*gap,x0=(W-total)/2,y=217,h=250;out.begin(C.paper);
   const value=o.value??(128400+q*q*1374),settle=phase(q%4.8,3.55,4.45),position=letters?(q-4.8)*4.4*(1-settle)+12*settle:value;
   const shown=[];
   for(let i=0;i<n;i++){
    const x=x0+i*(w+gap);rounded(g,x,y,w,h,8,C.ink);g.save();g.beginPath();g.rect(x,y,w,h);g.clip();
    let p=letters?mix((q-4.8)*4.4+i*.9,16+i,settle):Math.floor(position/10**(n-i-1))+(position%10**(n-i-1)>10**(n-i-1)-1?position%1:0);
    const base=Math.floor(p),f=p-base;shown.push(chars[((base%chars.length)+chars.length)%chars.length]);
    for(let k=-1;k<=1;k++){const ch=chars[((base+k)%chars.length+chars.length)%chars.length];word(g,data,ch,{x:x+w/2,y:y+207+(k-f)*h,width:w-24,height:218},C.paper)}
    const shade=g.createLinearGradient(0,y,0,y+h);shade.addColorStop(0,'rgba(0,0,0,.8)');shade.addColorStop(.24,'rgba(0,0,0,0)');shade.addColorStop(.76,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(0,0,0,.8)');g.fillStyle=shade;g.fillRect(x,y,w,h);g.restore();
    line(g,x,y+h/2,x+w,y+h/2,'#46474a',1);
   }
   furniture(g,'ROLL / '+(letters?'WORDS':'NUMBERS'),letters?'SPIN. BRAKE. READ.':'EVERY CARRY HAS A PLACE.',q,{paper:true,labels:o.labels});proof={mode,letters,value,shown:shown.join(''),settle};
  }else if(mode==='bands'){
   const style=o.mode??(['scroll','vertical','cross'][Math.floor(q/3.2)]),local=q%3.2;out.begin(style==='vertical'?C.orange:C.paper);
   g.save();g.beginPath();g.rect(0,86,W,548);g.clip();
   if(style==='scroll'){
    for(let r=0;r<4;r++){const y=155+r*128,off=(local*230*(r%2?1:-1))%650;
     for(let c=-2;c<4;c++){const p=wordPath(data,'MAKE IT MOVE',{x:c*720+off,y,width:690,height:158});g.lineWidth=2;g.strokeStyle=C.ink;if(r%2)g.stroke(p);else{g.fillStyle=C.ink;g.fill(p)}}}
   }else if(style==='vertical'){
    for(let c=0;c<8;c++)for(let r=-2;r<8;r++){const x=100+c*156,y=r*123+(c%2?1:-1)*(local*170%123);word(g,data,['流','動','世','界'][(r+8)%4],{x,y,width:102,height:112},c%3===0?C.paper:C.ink)}
   }else{
    for(let r=0;r<4;r++){g.save();g.translate(640,170+r*127);g.rotate(r%2?.21:-.21);g.fillStyle=r%2?C.ink:C.acid;g.fillRect(-1100,-76,2200,118);
     for(let i=-3;i<4;i++)word(g,data,'MAKE IT MOVE',{x:i*585+((r%2?1:-1)*local*190)%585,y:19,width:555,height:100},r%2?C.paper:C.ink);g.restore()}
   }
   g.restore();furniture(g,'TYPE / '+style.toUpperCase(),'ONE RHYTHM. DIFFERENT DIRECTIONS.',q,{paper:true,labels:o.labels});proof={mode,style,local};
  }else if(mode==='led'){
   out.begin(C.ink);const message=o.text??'MOVE',m=mask(message),sample=m.getContext('2d').getImageData(0,0,W,H).data,step=o.spacing??14;let lit=0;
   const offset=(t*118)%W;
   for(let y=120;y<590;y+=step)for(let x=35;x<1250;x+=step){const xx=Math.floor((x+offset)%W),a=sample[(Math.floor(y)*W+xx)*4+3],r=step*.32;disc(g,x,y,r,a>80?C.acid:'#25272a');if(a>80){lit++;disc(g,x,y,r*.38,C.paper)}}
   furniture(g,'LIGHT / LETTERS','A WORD WRITTEN IN LIGHT.',q,{labels:o.labels});proof={mode,message,spacing:step,lit};
  }else if(mode==='echo'){
   out.begin(C.ink);const delays=[.56,.42,.28,.14,0],colors=[C.violet,C.orange,C.mint,C.acid,C.paper];
   const pose=s=>({x:640+295*Math.sin(s*1.9),y:445+100*Math.sin(s*2.8),angle:.17*Math.sin(s*1.7)});
   for(let i=0;i<delays.length;i++){const p=pose(t-delays[i]*(o.delay??1));g.save();g.translate(p.x,p.y);g.rotate(p.angle);g.globalAlpha=.3+i*.175;word(g,data,o.text??'MOVE',{x:0,y:0,width:640,height:200},colors[i]);g.restore()}g.globalAlpha=1;
   furniture(g,'TIME / ECHO','ONE WORD. FIVE REAL SOURCE TIMES.',q,{labels:o.labels});proof={mode,sourceTimes:delays.map(d=>t-d*(o.delay??1)),poses:delays.map(d=>pose(t-d*(o.delay??1)))};
  }else throw Error('Unknown graphic type '+mode);
 }};
}
