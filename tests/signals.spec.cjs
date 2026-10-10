const {test,expect}=require('@playwright/test');
async function ready(page,id='audio-relief'){await page.goto('/examples/'+id+'.html');await page.evaluate(async()=>{await __ready;await __record();});}
test('signal fields reproduce frames after arbitrary seeks and shared-renderer interleaving',async({page})=>{
 await ready(page);const rows=await page.evaluate(async()=>{const {create}=await import('/fx/signals/films.js'),ids=['audio-relief','motion-fragments','freeze-orbit'],effects=await Promise.all(ids.map(id=>create(id)));const rows=[];
 for(let i=0;i<effects.length;i++){const e=effects[i];await e.frame(2.43);const a=e.canvas.toDataURL();await e.frame(7.7);const b=e.canvas.toDataURL();await effects[(i+1)%3].frame(4.4);await e.frame(2.43);rows.push({id:ids[i],moves:a!==b,repeat:a===e.canvas.toDataURL()});}return rows;});
 for(const row of rows){expect(row.moves,row.id).toBe(true);expect(row.repeat,row.id).toBe(true);}
});
test('actual measured audio changes the relief while a zero visual gain removes that dependence',async({page})=>{
 await ready(page);const r=await page.evaluate(async()=>{const e=signalEffect,o={sourceTime:.6,cameraAngle:.4,labels:false};e.frame(2.4,{...o,audioTime:0,audioGain:1});const loud=e.canvas.toDataURL(),a=e.proof();e.frame(2.4,{...o,audioTime:5.2,audioGain:1});const quiet=e.canvas.toDataURL(),b=e.proof();e.frame(2.4,{...o,audioTime:0,audioGain:0});const flat=e.canvas.toDataURL();e.frame(2.4,{...o,audioTime:5.2,audioGain:0});return{a,b,deforms:loud!==quiet,flatSame:flat===e.canvas.toDataURL()};});
 expect(r.a.sourceIndex).toBe(r.b.sourceIndex);expect(r.a.envelope).toBeGreaterThan(r.b.envelope+.3);expect(r.deforms).toBe(true);expect(r.flatSame).toBe(true);
});
test('motion vectors drive emitted geometry and the held first source frame emits nothing',async({page})=>{
 await ready(page,'motion-fragments');const r=await page.evaluate(()=>{const e=signalEffect;e.frame(3.3,{labels:false});const moving=e.canvas.toDataURL(),a=e.proof();e.frame(3.3,{motionGain:0,labels:false});const disabled=e.canvas.toDataURL(),b=e.proof();e.frame(3.3,{sourceTime:0,labels:false});const c=e.proof();return{a,b,c,changes:moving!==disabled};});
 expect(r.a.particles).toBeGreaterThan(100);expect(r.a.activeMotionCells).toBeGreaterThan(100);expect(r.b.particles).toBe(0);expect(r.c.particles).toBe(0);expect(r.c.maxFlow).toBe(0);expect(r.changes).toBe(true);
});
test('impact orbit holds real skeletal pose while moving camera and lights; missing attacks fail explicitly',async({page})=>{
 await ready(page,'impact-orbit');const r=await page.evaluate(async()=>{const e=signalEffect;e.frame(1.8);const a=e.proof();e.frame(3.4);const b=e.proof();e.frame(5.4);const c=e.proof();let error;try{(await import('/fx/signals/orbit.js')).orbitClock(1.3,[]);}catch(e){error=e.message;}return{a,b,c,error};});
 expect(r.a.held).toBe(true);expect(r.b.held).toBe(true);expect(r.a.sourceTime).toBe(r.b.sourceTime);expect(r.a.sourcePose).toEqual(r.b.sourcePose);expect(r.a.camera).not.toEqual(r.b.camera);expect(r.a.light).not.toEqual(r.b.light);expect(r.c.held).toBe(false);expect(r.c.sourcePose).not.toEqual(r.a.sourcePose);expect(r.error).toContain('needs measured attacks');
});
for(const id of ['audio-relief','motion-fragments','impact-orbit'])test(`${id} exports a complete final frame and the analysed score`,async({page})=>{
 await ready(page,id);const p=await page.evaluate(async()=>{await __render(11.99);const a=signalEffect.proof();await __render(12);const b=signalEffect.proof();return{a,b,dur:__DUR,audio:__audio,gif:__gif,count:signalEffect.data.audioSpec.count};});
 expect(p.dur).toBe(12);expect(p.audio.src).toBe('/assets/signals/score.wav');expect(p.audio.sha256).toMatch(/^[a-f0-9]{64}$/);expect(p.b.audioIndex).toBe(p.count-1);expect(p.a.sourceIndex??p.a.sourceTime).toBeCloseTo(p.b.sourceIndex??p.b.sourceTime,3);for(const [a,b] of p.gif){expect(a).toBeGreaterThanOrEqual(0);expect(b).toBeLessThan(12);expect(b).toBeGreaterThan(a);}
});
test('browser playback ends at the film duration even with a longer score element',async({page})=>{
 await page.goto('/examples/audio-relief.html');await page.evaluate(async()=>{await __ready;const a=document.querySelector('audio');Object.defineProperty(a,'currentTime',{configurable:true,get:()=>13,set:()=>{}});a.play=async()=>{};a.pause=()=>{window.didPause=true;};});await page.locator('#play').click();await expect(page.locator('#clock')).toHaveText('12.00 s');await expect(page.locator('#play')).toHaveText('Play with sound');expect(await page.evaluate(()=>window.didPause)).toBe(true);
});
test('catalogue keeps two signal variants and one new motion family, linked to their own studies',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>window.galleryAPI);await page.evaluate(()=>galleryAPI.pause());
 const p=await page.evaluate(()=>['signal-audio-relief','signal-motion-fragments','signal-freeze-orbit'].map(id=>{const d=FXCatalog.byId.get(id);return{id,role:d.role,parent:d.familyId};}));
 expect(p).toEqual([{id:'signal-audio-relief',role:'variant',parent:'studio-depth-dots'},{id:'signal-motion-fragments',role:'technique',parent:'signal-motion-fragments'},{id:'signal-freeze-orbit',role:'variant',parent:'studio-freeze-orbit'}]);
 for(const [demo,parent,film] of [['signal-audio-relief','studio-depth-dots','audio-relief'],['signal-motion-fragments','signal-motion-fragments','motion-fragments'],['signal-freeze-orbit','studio-freeze-orbit','impact-orbit']]){await page.evaluate(id=>galleryAPI.selectVariant(id),demo);await expect(page.locator('[data-effect-id="'+parent+'"] .preview-link a').first()).toHaveAttribute('href','media/'+film+'.mp4');}
 await expect(page.locator('[data-film-index-id]')).toHaveCount(12);
});
