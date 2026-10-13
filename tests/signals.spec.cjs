const {test,expect}=require('@playwright/test');
async function ready(page,id='audio-relief'){await page.goto('/examples/'+id+'.html');await page.evaluate(async()=>{await __ready;await __record();});}
const FPS=30;
// Every film frame's proof, collected once per page (frame(t) is a pure function of t).
async function proofs(page){return page.evaluate(async fps=>{const e=signalEffect,rows=[];for(let i=0;i<=12*fps;i++){await e.frame(i/fps,{labels:false});rows.push(e.proof());}return rows;},FPS);}
const pearson=(a,b)=>{const n=a.length,ma=a.reduce((x,y)=>x+y)/n,mb=b.reduce((x,y)=>x+y)/n;let s=0,sa=0,sb=0;for(let i=0;i<n;i++){s+=(a[i]-ma)*(b[i]-mb);sa+=(a[i]-ma)**2;sb+=(b[i]-mb)**2;}return s/Math.sqrt(sa*sb);};

test('signal fields reproduce frames after arbitrary seeks and shared-renderer interleaving',async({page})=>{
 await ready(page);const rows=await page.evaluate(async()=>{const {create}=await import('/fx/signals/films.js'),ids=['audio-relief','motion-fragments','freeze-orbit'],effects=await Promise.all(ids.map(id=>create(id)));const rows=[];
 for(let i=0;i<effects.length;i++){const e=effects[i];await e.frame(3.5);const a=e.canvas.toDataURL();await e.frame(7.7);const b=e.canvas.toDataURL();await effects[(i+1)%3].frame(4.4);await e.frame(3.5);rows.push({id:ids[i],moves:a!==b,repeat:a===e.canvas.toDataURL()});}return rows;});
 for(const row of rows){expect(row.moves,row.id).toBe(true);expect(row.repeat,row.id).toBe(true);}
});

test('relief: measured loudness extrudes the portrait, silence is flat, zero visual gain removes the dependence',async({page})=>{
 await ready(page);const r=await page.evaluate(async()=>{const e=signalEffect,o={cameraAngle:.7,labels:false};
  e.frame(6.02,{...o,audioTime:6.02,audioGain:1});const loud=e.canvas.toDataURL(),a=e.proof();e.frame(6.02,{...o,audioTime:9.8,audioGain:1});const quiet=e.canvas.toDataURL(),b=e.proof();
  e.frame(6.02,{...o,audioTime:6.02,audioGain:0});const flat=e.canvas.toDataURL();e.frame(6.02,{...o,audioTime:9.8,audioGain:0});const flatSame=flat===e.canvas.toDataURL();
  const silent=[];for(const t of [0,.5,.95,9.6,9.8,10.1]){e.frame(t,{labels:false});silent.push(e.proof());}
  return{a,b,deforms:loud!==quiet,flatSame,silent};});
 expect(r.a.envelope).toBeGreaterThan(.9);expect(r.b.rms).toBe(0);expect(r.b.maxExtrusion).toBe(0);expect(r.deforms).toBe(true);expect(r.flatSame).toBe(true);
 // Peak extrusion is at least 15% of the subject's width.
 expect(r.a.maxExtrusion).toBeGreaterThanOrEqual(.15*r.a.subjectWidth);
 for(const p of r.silent){expect(p.rms,String(p.time)).toBe(0);expect(p.maxExtrusion,String(p.time)).toBe(0);}
});

test('relief: height follows measured RMS (r ≥ 0.8) and the camera reaches a grazing angle',async({page})=>{
 await ready(page);const rows=await proofs(page);
 const r=pearson(rows.map(p=>p.meanExtrusion),rows.map(p=>p.rms));
 expect(r).toBeGreaterThanOrEqual(.8);
 for(const p of rows)if(p.rms===0)expect(p.maxExtrusion).toBe(0);
 expect(Math.max(...rows.map(p=>p.cameraYaw))).toBeGreaterThanOrEqual(40);
 expect(rows[0].cameraYaw).toBe(0);
 const hero=await page.evaluate(()=>__poster);expect(rows[Math.round(hero*30)].cameraYaw).toBeGreaterThanOrEqual(35);
});

test('fragments: still is whole, the measured burst shatters, pieces return, background and sound mark the impact',async({page})=>{
 await ready(page,'motion-fragments');
 const meta=await page.evaluate(()=>({cues:signalEffect.cues,onsets:signalEffect.data.audioSpec.onsets,timeline:signalEffect.timeline()}));
 const rows=await proofs(page),impact=Math.round(meta.cues.impact*FPS),base=rows[0].background;
 // 1. At least half of the film shows the complete subject with no fragments or holes.
 const whole=rows.filter(p=>p.particles===0&&p.holes===0);expect(whole.length/rows.length).toBeGreaterThanOrEqual(.5);
 for(const p of rows.filter(p=>p.time<=1||p.time>=8))expect(p.particles,String(p.time)).toBe(0);
 // Slow walking moves the cat (measured flow > 0) without breaking it.
 const walk=rows.filter(p=>p.time>=meta.cues.walk[0]+.4&&p.time<=meta.cues.walk[1]-.4);expect(Math.max(...walk.map(p=>p.maxFlow))).toBeGreaterThan(3);for(const p of walk)expect(p.particles).toBe(0);
 // 2. The impact frame releases at least 1,500 pieces, ≥70% from the fastest-moving cells.
 const hit=rows[impact];expect(hit.particles).toBeGreaterThanOrEqual(1500);expect(hit.fastShare).toBeGreaterThanOrEqual(.7);
 // Fragment births follow the measured motion: the biggest burst is the take-off frame, none while still.
 const births=meta.timeline.births,stats=meta.timeline.stats,peak=births.indexOf(Math.max(...births));
 expect(Math.abs(peak-hit.sourceIndex)).toBeLessThanOrEqual(1);
 births.forEach((b,k)=>{if(stats[k].maxSpeed<14)expect(b,'frame '+k).toBe(0);});
 // Faster measured motion releases more pieces per frame: still < moving < fast.
 const bucket=(lo,hi)=>{const b=births.filter((x,k)=>stats[k].maxSpeed>=lo&&stats[k].maxSpeed<hi);return b.reduce((x,y)=>x+y,0)/Math.max(1,b.length);};
 expect(bucket(0,14)).toBe(0);expect(bucket(14,34)).toBeGreaterThan(0);expect(bucket(34,1e9)).toBeGreaterThan(2*bucket(14,34));
 // 3. Reassembly after landing: mean distance to home falls monotonically to zero.
 const land=Math.round(meta.cues.land*FPS),end=rows.findIndex((p,i)=>i>land&&p.particles===0);
 expect(end).toBeGreaterThan(land);expect(end).toBeLessThanOrEqual(Math.round(5.6*FPS));
 const start=rows.findIndex((p,i)=>i>land&&p.pieces>0&&p.returning===p.pieces);expect(start).toBeGreaterThan(land);
 // Pieces that have arrived count as distance 0, so the cohort's mean distance is sum / cohort size.
 const cohort=rows[start].pieces,mean=i=>rows[i].returnDistanceSum/cohort;expect(cohort).toBeGreaterThan(300);
 for(let i=start+1;i<=end;i++)expect(mean(i),'frame '+i).toBeLessThanOrEqual(mean(i-1)+1e-6);
 expect(mean(end)).toBe(0);
 // 4. The background changes only within two frames of the impact.
 rows.forEach((p,i)=>expect(p.background!==base,'frame '+i).toBe(Math.abs(i-impact)<=2));
 // 5. The measured sound attack is within one frame of the impact frame.
 const nearest=Math.min(...meta.onsets.map(x=>Math.abs(x-impact/FPS)));expect(nearest).toBeLessThanOrEqual(1/FPS+1e-6);
});

test('fragments: motion gain and a still source frame suppress emission',async({page})=>{
 await ready(page,'motion-fragments');const r=await page.evaluate(()=>{const e=signalEffect;e.frame(3.5,{labels:false});const moving=e.canvas.toDataURL(),a=e.proof();e.frame(3.5,{motionGain:0,labels:false});const disabled=e.canvas.toDataURL(),b=e.proof();e.frame(3.5,{sourceTime:0,labels:false});const c=e.proof();return{a,b,c,changes:moving!==disabled};});
 expect(r.a.particles).toBeGreaterThan(1000);expect(r.a.activeMotionCells).toBeGreaterThan(100);expect(r.b.particles).toBe(0);expect(r.c.particles).toBe(0);expect(r.c.maxFlow).toBe(0);expect(r.changes).toBe(true);
});

test('impact orbit holds real skeletal pose while moving camera and lights; missing attacks fail explicitly',async({page})=>{
 await ready(page,'impact-orbit');const r=await page.evaluate(async()=>{const e=signalEffect;e.frame(1.8);const a=e.proof();e.frame(3.4);const b=e.proof();e.frame(5.4);const c=e.proof();let error;try{(await import('/fx/signals/orbit.js')).orbitClock(1.3,[]);}catch(e){error=e.message;}return{a,b,c,error};});
 expect(r.a.held).toBe(true);expect(r.b.held).toBe(true);expect(r.a.sourceTime).toBe(r.b.sourceTime);expect(r.a.sourcePose).toEqual(r.b.sourcePose);expect(r.a.camera).not.toEqual(r.b.camera);expect(r.a.light).not.toEqual(r.b.light);expect(r.c.held).toBe(false);expect(r.c.sourcePose).not.toEqual(r.a.sourcePose);expect(r.error).toContain('needs measured attacks');
});

const SCORES={'audio-relief':'/assets/signals-relief/score.wav','motion-fragments':'/assets/signals-fragments/score.wav','impact-orbit':'/assets/signals/score.wav'};
for(const id of Object.keys(SCORES))test(`${id} exports a complete final frame and its own analysed score`,async({page})=>{
 await ready(page,id);const p=await page.evaluate(async()=>{await __render(11.99);const a=signalEffect.proof();await __render(12);const b=signalEffect.proof();return{a,b,dur:__DUR,audio:__audio,gif:__gif,poster:__poster,count:signalEffect.data.audioSpec.count};});
 expect(p.dur).toBe(12);expect(p.audio.src).toBe(SCORES[id]);expect(p.audio.sha256).toMatch(/^[a-f0-9]{64}$/);expect(p.b.audioIndex).toBe(p.count-1);expect(p.a.sourceTime??p.a.sourceIndex).toBeCloseTo(p.b.sourceTime??p.b.sourceIndex,1);
 expect(p.poster).toBeGreaterThan(0);expect(p.poster).toBeLessThan(12);
 for(const [a,b] of p.gif){expect(a).toBeGreaterThanOrEqual(0);expect(b).toBeLessThan(12);expect(b).toBeGreaterThan(a);}
});
test('each signal film plays its own score',async({page})=>{
 const rows=[];for(const id of Object.keys(SCORES)){await ready(page,id);rows.push(await page.evaluate(()=>__audio.sha256));}
 expect(new Set(rows).size).toBe(rows.length);
});
test('browser playback ends at the film duration even with a longer score element',async({page})=>{
 await page.goto('/examples/audio-relief.html');await page.evaluate(async()=>{await __ready;const a=document.querySelector('audio');Object.defineProperty(a,'currentTime',{configurable:true,get:()=>13,set:()=>{}});a.play=async()=>{};a.pause=()=>{window.didPause=true;};});await page.locator('#play').click();await expect(page.locator('#clock')).toHaveText('12.00 s');await expect(page.locator('#play')).toHaveText('Play with sound');expect(await page.evaluate(()=>window.didPause)).toBe(true);
});
test('catalogue keeps two signal variants and the motion shatter family, linked to their own studies',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>window.galleryAPI);await page.evaluate(()=>galleryAPI.pause());
 const p=await page.evaluate(()=>['signal-audio-relief','signal-motion-fragments','signal-freeze-orbit'].map(id=>{const d=FXCatalog.byId.get(id);return{id,role:d.role,parent:d.familyId};}));
 expect(p).toEqual([{id:'signal-audio-relief',role:'variant',parent:'studio-depth-dots'},{id:'signal-motion-fragments',role:'technique',parent:'signal-motion-fragments'},{id:'signal-freeze-orbit',role:'variant',parent:'studio-freeze-orbit'}]);
 expect(await page.evaluate(()=>FXCatalog.families.find(f=>f.id==='signal-motion-fragments').name)).toBe('Motion shatter and reassemble');
 for(const [demo,parent,film] of [['signal-audio-relief','studio-depth-dots','audio-relief'],['signal-motion-fragments','signal-motion-fragments','motion-fragments'],['signal-freeze-orbit','studio-freeze-orbit','dot-battle']]){await page.evaluate(id=>galleryAPI.selectVariant(id),demo);await expect(page.locator('[data-effect-id="'+parent+'"] .preview-link a').first()).toHaveAttribute('href','media/'+film+'.mp4');}
 await expect(page.locator('[data-film-index-id]')).toHaveCount(require('./fixtures/expected-counts.json').films.total);
});
