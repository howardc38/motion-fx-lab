import {FILMS,create} from './films.js';
const spec=FILMS[window.signalFilm];if(!spec)throw new Error('Unknown signal film');
const canvas=document.querySelector('#film'),g=canvas.getContext('2d',{willReadFrequently:false}),seek=document.querySelector('#seek'),play=document.querySelector('#play'),audio=document.querySelector('audio');
window.__SIZE={w:1280,h:720};window.__DUR=spec.duration;window.__poster=spec.poster;window.__gif=spec.gif;window.__cues=()=>[];
let effect,t=0,playing=false,recording=false,pending=Promise.resolve();
function fail(error){playing=false;audio.pause();play.textContent='Play with sound';document.querySelector('#error').textContent=error.message;console.error(error);}
window.__ready=create(spec.effect,window.signalOptions).then(e=>{effect=e;window.signalEffect=e;const url=new URL(e.data.audioSpec.file,e.data.url);url.searchParams.set('v',e.data.audioSpec.sha256);audio.src=url.href;if(url.origin!==location.origin)throw new Error('The exported score must be a local same-origin asset');if(e.data.audioSpec.duration+.001<spec.duration)throw new Error('Score is shorter than this film; supply at least '+spec.duration+' seconds');window.__audio={src:url.pathname,sha256:e.data.audioSpec.sha256};});
window.__render=async seconds=>{await __ready;if(!Number.isFinite(seconds))throw new Error('Frame time must be finite');t=Math.max(0,Math.min(spec.duration,seconds));await effect.frame(t);g.drawImage(effect.canvas,0,0);seek.value=t;document.querySelector('#clock').textContent=t.toFixed(2)+' s';};
function render(t){const work=pending.then(()=>__render(t));pending=work.catch(fail);return work;}
window.__record=async()=>{recording=true;playing=false;audio.pause();await pending;await __ready;document.body.classList.add('record');};
seek.max=spec.duration;seek.oninput=()=>{playing=false;audio.pause();play.textContent='Play with sound';audio.currentTime=+seek.value;render(+seek.value).catch(()=>{});};
play.onclick=async()=>{try{await __ready;if(playing){playing=false;audio.pause();play.textContent='Play with sound';}else{audio.currentTime=t>=spec.duration?0:t;await audio.play();playing=true;play.textContent='Pause';}}catch(error){fail(error);}};
audio.onended=()=>{playing=false;play.textContent='Play with sound';};
async function tick(){if(recording)return;if(playing){await render(Math.min(spec.duration,audio.currentTime)).catch(()=>{});if(audio.currentTime>=spec.duration){playing=false;audio.pause();play.textContent='Play with sound';}}requestAnimationFrame(tick);}
__ready.then(()=>recording?undefined:render(0)).then(()=>{if(!recording)requestAnimationFrame(tick);}).catch(fail);
