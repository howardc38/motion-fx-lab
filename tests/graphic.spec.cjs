const {test,expect}=require('@playwright/test');
const IDS=['graphic-field','graphic-fill','graphic-network','graphic-shadow','graphic-flap','graphic-reels','graphic-bands','graphic-spatial','graphic-tiles','graphic-led','graphic-echo'];
test('a preview RAF timestamp before engine startup cannot send negative time to B-roll hooks',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const raf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=callback=>raf(()=>callback(0));
  window.__previewTestTimes=[];
  window.__renderHooks=[t=>window.__previewTestTimes.push(t)];
 });
 await page.goto('/examples/broll.html');
 await page.waitForFunction(()=>window.__previewTestTimes.length>=2);
 expect(await page.evaluate(()=>Math.min(...__previewTestTimes))).toBeGreaterThanOrEqual(0);
 expect(errors).toEqual([]);
});
test('all graphic operations move and repeat after backwards seeks and interleaving',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>window.FXGraphic);const rows=await page.evaluate(async ids=>{
  const effects=await Promise.all(ids.map(id=>FXGraphic.create(id))),out=[];
  for(let i=0;i<effects.length;i++){const e=effects[i];e.frame(1.63,{labels:false});const a=e.canvas.toDataURL();e.frame(2.78,{labels:false});const b=e.canvas.toDataURL();effects[(i+1)%effects.length].frame(5.3);e.frame(1.63,{labels:false});out.push({id:ids[i],moves:a!==b,repeat:a===e.canvas.toDataURL(),proof:e.proof()})}return out;
 },IDS);
 for(const r of rows){expect(r.moves,r.id).toBe(true);expect(r.repeat,r.id).toBe(true)}
});
test('fills preserve counters, the graph obeys distance, and echoes use distinct source times',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>window.FXGraphic);
 const r=await page.evaluate(async()=>{
  const fill=await FXGraphic.create('graphic-fill');fill.frame(1,{text:'O',labels:false});
  const px=fill.canvas.getContext('2d').getImageData(640,320,1,1).data;
  const net=await FXGraphic.create('graphic-network');net.frame(2,{threshold:50});const low=net.proof();net.frame(2,{threshold:180});const high=net.proof();
  const echo=await FXGraphic.create('graphic-echo');echo.frame(2);return{counter:[...px],low,high,echo:echo.proof()};
 });
 expect(r.counter.slice(0,3)).toEqual([241,238,228]);expect(r.low.edges).toBeLessThan(r.high.edges);expect(r.high.maxEdge).toBeLessThan(180);
 expect(new Set(r.echo.sourceTimes).size).toBe(5);expect(new Set(r.echo.poses.map(p=>p.x)).size).toBe(5);
});
test('spatial modes have different geometry and a moving perspective camera',async({page})=>{
 await page.goto('/examples/graphic-extensions.html');const rows=await page.evaluate(async()=>{
  await __ready;await __record();const out=[];for(const t of [15,17.2,20.6]){await __render(t);out.push({...graphicProof})}return out;
 });
 expect(rows.map(r=>r.mode)).toEqual(['cylinder','tunnel','corridor']);expect(new Set(rows.map(r=>r.meshes)).size).toBe(3);
});
for(const id of ['graphic-field','graphic-fill','graphic-network','graphic-shadow','graphic-extensions'])test(id+' uses its canonical source and recording ignores manual controls',async({page})=>{
 await page.goto('/examples/'+id+'.html');await page.evaluate(()=>__ready);
 await page.evaluate(()=>__render(2));const original=await page.locator('#picture canvas').evaluate(c=>c.toDataURL());
 await page.locator('#strength').evaluate(el=>{el.value='.5';el.dispatchEvent(new Event('input',{bubbles:true}))});
 await page.evaluate(async()=>{await __record();await __render(2)});expect(await page.locator('#picture canvas').evaluate(c=>c.toDataURL())===original).toBe(true);
 const p=await page.evaluate(async()=>{await __render(6.1);await __render(2);return{size:__SIZE,duration:__DUR,fps:__FPS,proof:graphicProof,cues:__cues(),music:__music}});
 expect(p.size).toEqual({w:1920,h:1080});expect(p.fps).toBe(60);expect(p.cues.length).toBeGreaterThan(5);expect(p.music.length).toBeGreaterThan(2);
});
