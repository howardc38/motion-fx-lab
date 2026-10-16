import {font as loadFont,create as createSolidType} from './material-studies/type.js?v=engraved-1';
/* Drawing, ember tracing, camera travel and engraved type, using the
 * public library's Noto Sans TC outline asset. */
(() => {
'use strict';
const W=1920,H=1080,D=16.8,TAU=Math.PI*2;
const canvas=document.getElementById('film'),g=canvas.getContext('2d',{alpha:false});
const work=document.createElement('canvas');work.width=W;work.height=H;
const c=work.getContext('2d',{alpha:false});
const C={ink:'#111211',bone:'#e9e3d4',ash:'#b8b2a3',orange:'#f36027',red:'#933f25'};
const cl=x=>Math.max(0,Math.min(1,x)),sm=x=>{x=cl(x);return x*x*(3-2*x)},out=x=>1-(1-cl(x))**4,lerp=(a,b,p)=>a+(b-a)*p;
const hash=n=>{const x=Math.sin(n*127.1+31.17)*43758.5453;return x-Math.floor(x)};
const noise=document.createElement('canvas');noise.width=480;noise.height=270;
const ng=noise.getContext('2d'),im=ng.createImageData(480,270);
for(let i=0;i<480*270;i++){const v=Math.floor(hash(i)*255);im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=v;im.data[i*4+3]=255}ng.putImageData(im,0,0);
let letters=[],all=[],total=0,solidType;
function txt(s,x,y,size=18,color=C.bone,font='mono',align='left'){
 c.fillStyle=color;c.font=(font==='serif'?'italic '+size+'px Baskerville,Georgia,serif':font==='sans'?'700 '+size+'px Arial,sans-serif':size+'px "Courier New",monospace');c.textAlign=align;c.fillText(s,x,y);c.textAlign='left';
}
function line(points,color=C.bone,width=1,alpha=1,close=false){if(points.length<2)return;c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(...points[0]);for(let i=1;i<points.length;i++)c.lineTo(...points[i]);if(close)c.closePath();c.stroke();c.globalAlpha=1}
function circle(x,y,r,color=C.bone,alpha=.4,width=1){c.globalAlpha=alpha;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.arc(x,y,r,0,TAU);c.stroke();c.globalAlpha=1}
function cross(x,y,r=7,color=C.bone,a=.5){line([[x-r,y],[x+r,y]],color,1,a);line([[x,y-r],[x,y+r]],color,1,a)}
function rule(x,y,len,color=C.bone,a=.3){line([[x,y],[x+len,y]],color,1,a)}
function dim(x,y,x2,y2,label,paper=false){const col=paper?C.ink:C.bone;line([[x,y],[x2,y2]],col,.9,.44);const a=Math.atan2(y2-y,x2-x),dx=Math.cos(a+1)*7,dy=Math.sin(a+1)*7;line([[x-dx,y-dy],[x+dx,y+dy]],col,1,.6);line([[x2-dx,y2-dy],[x2+dx,y2+dy]],col,1,.6);txt(label,(x+x2)/2,(y+y2)/2-10,15,col,'mono','center')}
function grid(paper=false,a=1){const col=paper?'#615b50':'#b8b2a3';c.save();c.globalAlpha=a;
 for(let x=0;x<=W;x+=40)line([[x,0],[x,H]],col,x%200===0?.9:.65,x%200===0?.13:.065);
 for(let y=0;y<=H;y+=40)line([[0,y],[W,y]],col,y%200===0?.9:.65,y%200===0?.13:.065);c.restore();
}
function frame(t,paper=false,plate='01',name='THE DRAWING'){
 const col=paper?C.ink:C.bone;
 rule(76,74,1768,col,.3);rule(76,1005,1768,col,.3);
 txt('S / F     STUDIES IN TRANSFORMATION',80,56,15,col);txt('PLATE '+plate+'  /  '+name,1840,56,15,col,'mono','right');
 txt('A LINE. A WORLD.',80,1039,15,col);txt('MOTION STUDY     '+String(Math.floor(t*60)).padStart(4,'0'),1840,1039,15,col,'mono','right');
 for(const [x,y,dx,dy] of [[76,95,1,1],[1844,95,-1,1],[76,984,1,-1],[1844,984,-1,-1]]){line([[x+16*dx,y],[x,y],[x,y+16*dy]],col,1,.55)}
}
function spark(x,y,t,life=1,size=1){
 if(life<=0)return;c.save();c.globalCompositeOperation='screen';
 const halo=c.createRadialGradient(x,y,0,x,y,70*size);halo.addColorStop(0,'#f9b15d');halo.addColorStop(.07,'#e87930');halo.addColorStop(.25,'#57311d');halo.addColorStop(1,'#000000');c.globalAlpha=life;c.fillStyle=halo;c.fillRect(x-70*size,y-70*size,140*size,140*size);
 for(let i=0;i<32;i++){const age=(t*1.7+hash(i*3.2))%1,ang=hash(i*9.8)*TAU,vel=15+hash(i*2.7)*64,px=x+Math.cos(ang)*age*vel*size-22*age*size,py=y+Math.sin(ang)*age*vel*size+26*age*age*size;
 line([[px,py],[px-Math.cos(ang)*3*size,py-Math.sin(ang)*3*size]],i%3?C.orange:'#ffe5b0',(1-age)*1.7,life*(1-age)**2)}
 c.fillStyle='#fff3cd';c.beginPath();c.arc(x,y,2.6*size,0,TAU);c.fill();c.restore();
}
function traces(points,progress,color=C.bone,width=1.4){if(progress<=0)return;const n=points.length,at=cl(progress)*(n-1),k=Math.floor(at);const ps=points.slice(0,k+1);if(k<n-1)ps.push([lerp(points[k][0],points[k+1][0],at-k),lerp(points[k][1],points[k+1][1],at-k)]);line(ps,color,width,.92);return ps[ps.length-1]}
const bp={x:135,y:710,s:.405};
function blueprint(t){
 c.fillStyle=C.ink;c.fillRect(0,0,W,H);
 const dive=sm((t-4.5)/.75),pan=out((t-4.4)/.5),zoom=1+.018*t+8*dive,focus=[536,560];
 c.save();c.translate(W/2,H/2);c.scale(zoom,zoom);c.translate(-lerp(W/2,focus[0],pan),-lerp(H/2,focus[1],pan));
 grid(false,.8);const enter=sm(t/.65);
 // Construction circles and guides are a drawing, not a screenshot overlay.
 c.save();c.globalAlpha=enter;
 [210,420,630,840,1050,1260].forEach((x,i)=>{line([[x,180],[x,815]],C.bone,.8,.14);txt(String(i+1).padStart(2,'0'),x-6,835,12,C.ash)});
 [405,710].forEach(y=>line([[100,y],[1440,y]],C.bone,.8,.35));
 circle(552,557,166,C.bone,.21);circle(552,557,120,C.bone,.16);cross(552,557,186,C.bone,.2);
 dim(135,330,1300,330,'2 953 / 1 000');dim(1390,405,1390,710,'0.75 EM');
 rule(1450,325,316,C.bone,.4);txt('ONE CONTINUOUS LINE',1450,304,15,C.bone);
 txt('01',1450,383,70,C.bone,'serif');txt('Form follows',1450,431,29,C.bone,'serif');txt('a moving point.',1450,468,29,C.bone,'serif');
 for(let k=0;k<5;k++){txt(['TRACE','WIDTH','DEPTH','LIGHT','STATE'][k],1452,537+k*38,13,C.ash);txt(['0.75 pt','1 : 1','0.00','EMBER',t>3.8?'RESOLVED':'DRAWING'][k],1750,537+k*38,13,C.bone,'mono','right');rule(1450,547+k*38,316,C.bone,.13)}
 // Tiny Cartesian plot in the lower left balances the large lettering.
 line([[142,930],[142,838],[697,838]],C.bone,.8,.25);const graph=Array.from({length:220},(_,i)=>{const x=i/219;return[142+x*555,910-45*Math.sin(x*TAU)*Math.exp(-x*1.4)-32*x]});
 traces(graph,sm((t-2.8)/1.4),C.orange,1.1);txt('POSITION / TIME',720,891,12,C.ash);txt('The smallest spark can change the whole picture.',1790,915,27,C.bone,'serif','right');
 c.restore();
 let run=cl((t-.12)/3.72)*total,head=null;
 for(const l of letters)for(const contour of l.contours){const pts=contour.map(p=>[bp.x+p[0]*bp.s,bp.y-p[1]*bp.s]);line(pts,C.bone,.95,.14);
 const len=pts.length;const p=cl(run/len);const h=traces(pts,p,C.bone,1.7);if(run>=0&&run<len)head=h;run-=len;}
 if(t>=4)head=[1322,710];if(head){const tail=sm((4.65-t)/.4);spark(...head,t,tail,1.1)}
 c.restore();frame(t,false,'01','THE DRAWING');
 const flash=Math.exp(-(((t-5.22)/.075)**2));if(flash>.001){c.globalAlpha=flash*.8;c.fillStyle=C.bone;c.fillRect(0,0,W,H);c.globalAlpha=1}
}
function portal(t){
 c.fillStyle=C.ink;c.fillRect(0,0,W,H);const u=t-5.25,p=cl(u/4.35),roll=-.15+.27*sm(p),cam=24+u*150+130*sm((u-3.5)/.8);
 const a=sm(u/.2);c.save();c.globalAlpha=a;
 function project(x,y,z){const dep=z-cam+140,k=900/dep,xx=x*Math.cos(roll)-y*Math.sin(roll),yy=x*Math.sin(roll)+y*Math.cos(roll);return[960+xx*k,540+yy*k,k,dep]}
 function path3(ps,col,width,alpha){const q=ps.map(p=>project(...p));if(q.some(p=>p[3]<35))return;line(q.map(p=>p.slice(0,2)),col,width,alpha)}
 // Sweeping structural portals. Distance and occlusion come from projection.
 for(let z=2200;z>=0;z-=70){if(z-cam+140<45)continue;const fade=cl(1-(z-cam)/1700),turn=Math.sin(z*.0017)*.16;
 const poly=Array.from({length:121},(_,i)=>{const an=i/120*TAU;const x=Math.sign(Math.cos(an))*Math.abs(Math.cos(an))**.4*340,y=Math.sign(Math.sin(an))*Math.abs(Math.sin(an))**.4*226;return[x*Math.cos(turn)-y*Math.sin(turn),x*Math.sin(turn)+y*Math.cos(turn),z]});
 path3(poly,z%280===0?C.orange:C.bone,z%280===0?1.7:.85,.12+fade*.7);
 for(let j=0;j<12;j++){const x=-325+j*59;path3([[x,-245,z],[x,-245,z+60]],C.bone,.75,.12+fade*.25);path3([[x,245,z],[x,245,z+60]],C.bone,.75,.12+fade*.25)}
 }
 for(let j=0;j<40;j++){const theta=j/40*TAU;path3([[340*Math.cos(theta),225*Math.sin(theta),cam-60],[340*Math.cos(theta),225*Math.sin(theta),2200]],C.bone,.65,.1)}
 const rail=Array.from({length:210},(_,i)=>{const z=cam+45+i*6;return [135*Math.sin(z*.006),85*Math.cos(z*.004),z]});path3(rail,C.orange,2,.9);
 const pt=project(...rail[4]);spark(pt[0],pt[1],t,.75,.8);
 // Lyrics are part of the moving space, with clear staged words.
 const words=[['A LINE',.25,1.4],['BECOMES',1.65,2.9],['A WORLD',3.05,4.35]];
 for(const [word,a,b] of words){const v=u-a;if(v<0||u>b)continue;const k=out(v/.24),fade=1-sm((u-(b-.2))/.2);c.save();c.globalAlpha=k*fade;const s=1+.08*v;c.translate(960,550);c.scale(s,s);txt(word,0,0,112,C.bone,'sans','center');rule(-155,41,310,C.orange,.9);c.restore()}
 c.restore();frame(t,false,'02','THE PASSAGE');
}
function solid(t){
 const u=t-9.6;c.fillStyle=C.bone;c.fillRect(0,0,W,H);grid(true,.65);
 // These are the actual cjk-solid geometry and design-surface-ink material implementations.
 solidType.frame(u,{text:'FORM',labels:false,cameraAngle:-.53+.73*sm(u/4.8)});
 c.drawImage(solidType.canvas,0,0,W,H);
 const points=solidType.proof().bounds,x0=Math.min(...points.map(p=>p[0])),x1=Math.max(...points.map(p=>p[0])),y0=Math.min(...points.map(p=>p[1])),y1=Math.max(...points.map(p=>p[1]));
 line([[x0,y1],[150,850],[150,890]],C.ink,.8,.5);circle(x0,y1,5,C.orange,1,1.5);txt('01 / THE FACE',150,921,14,C.ink);
 line([[x1,y0],[1670,258],[1780,258]],C.ink,.8,.5);circle(x1,y0,5,C.orange,1,1.5);txt('02 / THE VOLUME',1780,232,14,C.ink,'mono','right');
 dim(Math.max(220,x0),Math.min(956,y1+70),Math.min(1690,x1),Math.min(956,y1+70),'A SINGLE LINE, GIVEN DEPTH',true);
 txt('From a point',125,169,44,C.ink,'serif');txt('to a world.',125,220,44,C.ink,'serif');
 txt('FORM / IN MOTION',1780,956,22,C.ink,'mono','right');
 frame(t,true,'03','THE FORM');
 const flash=Math.exp(-(((t-9.6)/.055)**2));if(flash>.001){c.globalAlpha=flash*.5;c.fillStyle='#fff';c.fillRect(0,0,W,H);c.globalAlpha=1}
}
function end(t){
 c.fillStyle=C.ink;c.fillRect(0,0,W,H);grid(false,.3);const u=t-14.4,k=out(u/.4),shake=Math.sin(u*50)*Math.exp(-u*15)*7;
 c.save();c.translate(960+shake,574);const s=lerp(1.12,1,k);c.scale(s,s);txt('FORM',0,0,340,C.bone,'sans','center');c.restore();
 const sx=lerp(220,1700,out(u/1.7));line([[220,672],[sx,672]],C.orange,2,1);spark(sx,672,t,1-sm((u-1.6)/.65),.9);
 const textA=sm((u-.25)/.3);c.save();c.globalAlpha=textA;txt('A line. A world.',960,779,48,C.bone,'serif','center');c.restore();
 txt('POINT  →  LINE  →  SPACE',960,908,17,C.ash,'mono','center');frame(t,false,'04','IN MOTION');
}
function draw(t){t=Math.max(0,Math.min(D,t));if(t<5.25)blueprint(t);else if(t<9.6)portal(t);else if(t<14.4)solid(t);else end(t);
 // Restrained grain is stationary across subframes and browser histories.
 c.save();c.globalCompositeOperation='soft-light';c.globalAlpha=.075;c.drawImage(noise,0,0,W,H);c.restore();
 const vignette=c.createRadialGradient(960,510,350,960,540,1220);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.2)');c.fillStyle=vignette;c.fillRect(0,0,W,H);
}
async function render(t){
 // True shutter samples for the rapid camera dive and passage, crisp holds elsewhere.
 const samples=t>4.45&&t<9.6?3:1;g.globalCompositeOperation='source-over';
 for(let i=0;i<samples;i++){draw(t+(i-(samples-1)/2)/60*.4);g.globalAlpha=1/(i+1);g.drawImage(work,0,0)}g.globalAlpha=1;
}
window.__SIZE={w:W,h:H};window.__DUR=D;window.__render=render;window.__FPS=60;
window.__poster=12.45;window.__preview=[[1.2,3.6],[5.7,7.3],[10.9,13.1]];
window.__cues=()=>[];window.__record=async()=>{record=true;playing=false;document.body.classList.add('record');audio.pause()};
let record=false,playing=false,at=0,last=0;const audio=document.getElementById('sound'),scrub=document.getElementById('scrub'),button=document.getElementById('play');
button.onclick=async()=>{if(playing){playing=false;audio.pause();button.textContent='Play with sound'}else{if(at>=D)at=0;audio.currentTime=at;await audio.play();playing=true;last=performance.now();button.textContent='Pause'}};
scrub.oninput=()=>{at=+scrub.value;audio.currentTime=at;render(at)};
window.__ready=(async()=>{
 const [font,meta]=await Promise.all([loadFont(),fetch(new URL('../assets/spark-form/score.json',import.meta.url)).then(r=>r.json())]);
 let x=0;for(const ch of 'FORM'){const spec=font.glyphs[ch],contours=[];
 for(const d of spec.path.match(/M[^M]+/g)){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);const length=path.getTotalLength(),n=Math.ceil(length/6),points=[];for(let i=0;i<=n;i++){const p=path.getPointAtLength(i/n*length);points.push([p.x+x,p.y])}contours.push(points);all.push(points);total+=points.length}
 letters.push({ch,x,contours});x+=spec.advance;}
 solidType=await createSolidType('engraved',{width:W,height:H,alpha:true});window.__audio={src:'../assets/spark-form/score.wav',sha256:meta.sha256};await document.fonts.ready;await render(0);
 requestAnimationFrame(function tick(now){if(!record&&playing){at=audio.currentTime;if(at>=D){at=D;playing=false;audio.pause();button.textContent='Play again'}render(at);scrub.value=at;document.getElementById('time').textContent=at.toFixed(1)+' / '+D}last=now;requestAnimationFrame(tick)});
})();
})();
