import {create,STUDIES,EXTENSIONS} from './app.js';
const id=document.body.dataset.film,isSampler=id==='graphic-extensions',spec=STUDIES.find(s=>s.id===id);
if(!isSampler&&!spec)throw Error('Unknown graphic film');
const duration=isSampler?33.6:9.6,picture=document.getElementById('picture'),bar=document.getElementById('scrub'),play=document.getElementById('play'),mode=document.getElementById('mode'),strength=document.getElementById('strength');
window.__SIZE={w:1920,h:1080};window.__DUR=duration;window.__FPS=60;window.__poster=isSampler?16.6:spec.hero;
window.__music=[[0,'build'],[2.4,'drop'],[Math.min(7.2,duration-2.4),'lift'],[duration-1.2,'tail']];
window.__cues=()=>Array.from({length:Math.floor(duration/1.2)},(_,i)=>({t:i*1.2+.1,name:i%4===0?'thump':i%2?'tick':'pop',gain:i%4===0?.36:.17}));
let effects,record=false,playing=false,at=0,start=0,manual=false,current;
window.__ready=(async()=>{effects=new Map(await Promise.all((isSampler?EXTENSIONS.map(s=>s.id):[id]).map(async key=>[key,await create(key,{width:1920,height:1080})])));await document.fonts.ready;await render(0)})();
async function render(t){
 const shot=isSampler?EXTENSIONS.find(s=>t>=s.at[0]&&t<s.at[1])??EXTENSIONS.at(-1):null,key=shot?.id??id,e=effects.get(key);
 let local=shot?t-shot.at[0]+shot.offset:t;
 // Explicit source-time cuts keep each setting readable within the sampler.
 if(shot?.id==='graphic-reels'){const l=t-shot.at[0];local=l<1?2.8+l:5.6+l-1}
 if(shot?.id==='graphic-bands')local=t-shot.at[0]<1.6?t-shot.at[0]:t-shot.at[0]<3.2?3.2+(t-shot.at[0]-1.6):6.4+(t-shot.at[0]-3.2);
 if(shot?.id==='graphic-spatial')local=(t-shot.at[0])*4/3;
 if(shot?.id==='graphic-tiles')local=(t-shot.at[0])*2;
 const o=manual&&!record?{strength:+strength.value,...(mode.value?{mode:mode.value}:{})}:{};
 e.frame(local,o);if(current!==key){picture.replaceChildren(e.canvas);current=key}
 bar.value=t;document.getElementById('time').textContent=t.toFixed(1)+' / '+duration.toFixed(1);window.graphicProof={id:key,time:local,...e.proof()};
}
window.__render=async t=>{await window.__ready;await render(t)};
window.__record=async()=>{record=true;playing=false;document.body.classList.add('record')};
bar.max=duration;bar.oninput=()=>{playing=false;play.textContent='Play';at=+bar.value;window.__render(at)};
strength.oninput=mode.onchange=()=>{manual=true;playing=false;at=0;play.textContent='Play';window.__render(at)};
document.getElementById('timeline').onclick=()=>{manual=false;mode.value='';strength.value=1;window.__render(at)};
if(mode.options.length===1)mode.closest('label').hidden=true;
if(isSampler){strength.closest('label').hidden=true;document.getElementById('timeline').hidden=true}
play.onclick=()=>{playing=!playing;if(at>=duration)at=0;start=performance.now()-at*1000;play.textContent=playing?'Pause':'Play'};
let busy=false;async function tick(now){if(playing&&!record&&!busy){busy=true;at=Math.min(duration,(now-start)/1000);await window.__render(at);busy=false;if(at>=duration){playing=false;play.textContent='Play again'}}requestAnimationFrame(tick)}requestAnimationFrame(tick);
