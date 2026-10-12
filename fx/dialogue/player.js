import {createFilm} from './scene.js';
let spec;const name=window.dialogueFilm;
const canvas=document.querySelector('#film'),g=canvas.getContext('2d',{willReadFrequently:false}),seek=document.querySelector('#seek'),play=document.querySelector('#play'),audio=document.querySelector('audio');
window.__SIZE={w:1280,h:720};window.__cues=()=>[];
let effect,t=0,playing=false,recording=false,pending=Promise.resolve();
function fail(error){playing=false;audio.pause();play.textContent='Play with sound';document.querySelector('#error').textContent=error.message;console.error(error);}
window.__ready=createFilm(name).then(async e=>{effect=e;window.dialogueEffect=e;spec=e.spec;window.__DUR=spec.duration;window.__poster=name==='character-dialogue'?6.3:2.4;window.__gif=name==='character-dialogue'?[[.5,2.0],[3.2,4.7],[5.6,6.6],[10.5,12],[19.2,21.2]]:[[.6,3.6],[6.55,8.0]];seek.max=spec.duration;const url=new URL('../../assets/dialogue/'+spec.audio.file,import.meta.url);url.searchParams.set('v',spec.audio.sha256);const response=await fetch(url);if(!response.ok)throw new Error('Speech asset failed');const bytes=await response.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==spec.audio.sha256)throw new Error('Speech and mouth cues are from different builds');audio.src=url.href;window.__audio={src:url.pathname,sha256:hash};});
window.__render=async seconds=>{await __ready;if(!Number.isFinite(seconds))throw new Error('Frame time must be finite');t=Math.max(0,Math.min(spec.duration,seconds));await effect.frame(t);g.drawImage(effect.canvas,0,0);seek.value=t;document.querySelector('#clock').textContent=t.toFixed(2)+' s';};
function render(t){const work=pending.then(()=>__render(t));pending=work.catch(fail);return work;}
window.__record=async()=>{recording=true;playing=false;audio.pause();await pending;await __ready;document.body.classList.add('record');};
seek.oninput=()=>{playing=false;audio.pause();play.textContent='Play with sound';audio.currentTime=+seek.value;render(+seek.value).catch(()=>{});};
play.onclick=async()=>{try{await __ready;if(playing){playing=false;audio.pause();play.textContent='Play with sound';}else{audio.currentTime=t>=spec.duration?0:t;await audio.play();playing=true;play.textContent='Pause';}}catch(error){fail(error);}};
audio.onended=()=>{playing=false;play.textContent='Play with sound';};
async function tick(){if(recording)return;if(playing){await render(Math.min(spec.duration,audio.currentTime)).catch(()=>{});if(audio.currentTime>=spec.duration){playing=false;audio.pause();play.textContent='Play with sound';}}requestAnimationFrame(tick);}
__ready.then(()=>recording?undefined:render(0)).then(()=>{if(!recording)requestAnimationFrame(tick);}).catch(fail);
