import {createFilm,FILMS} from './films.js';
const spec=FILMS[window.designFilm],canvas=document.querySelector('#film'),g=canvas.getContext('2d',{willReadFrequently:true}),seek=document.querySelector('#seek'),play=document.querySelector('#play');
if(!spec)throw new Error('Unknown design film');
window.__SIZE={w:1280,h:720};window.__DUR=spec.duration;window.__poster=spec.poster;window.__gif=spec.gif;
window.__music=spec.music??[[0,'intro'],[2.4,'drop'],[spec.duration/2,'lift'],[spec.duration-4.8,'final'],[spec.duration-2.4,'tail']];
window.__cues=()=>spec.cuts.map(t=>({t,name:'whoosh',gain:.23}));
let effect,playing=false,recording=false,t=0,last=0,pending=Promise.resolve();
window.__ready=Promise.resolve().then(()=>{effect=createFilm(window.designFilm);window.filmEffect=effect;});
window.__render=async seconds=>{await __ready;t=Math.max(0,Math.min(spec.duration,seconds));await effect.frame(t);g.drawImage(effect.canvas,0,0);seek.value=t;document.querySelector('#clock').textContent=t.toFixed(2)+' s';};
function fail(e){playing=false;play.textContent='Play';document.querySelector('#error').textContent=e.message;console.error(e);}
function render(t){const p=pending.then(()=>__render(t));pending=p.catch(fail);return p;}
window.__record=async()=>{recording=true;playing=false;await pending;await __ready;document.body.classList.add('record');};
seek.max=spec.duration;seek.oninput=()=>{playing=false;play.textContent='Play';render(+seek.value).catch(()=>{});};play.onclick=()=>{playing=!playing;play.textContent=playing?'Pause':'Play';};
async function tick(now){if(recording)return;if(playing)await render((t+Math.min(.1,(now-last)/1000))%spec.duration).catch(()=>{});last=now;requestAnimationFrame(tick);}
__ready.then(()=>recording?undefined:render(0)).then(()=>{if(!recording)requestAnimationFrame(tick);}).catch(fail);
