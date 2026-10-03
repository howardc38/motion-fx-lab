const {test,expect}=require('@playwright/test');
async function open(page){await page.goto('/');await page.waitForFunction(()=>window.galleryAPI);await page.evaluate(()=>galleryAPI.pause());}
test('catalogue owns every demo once; variants and showcases do not inflate technique count',async({page})=>{
 await open(page);
 const p=await page.evaluate(()=>({stats:FXCatalog.stats,ids:FX.DEMOS.map(d=>d.id),groups:FXCatalog.families.map(f=>f.entries.map(d=>d.id)),shows:FXCatalog.showcases.map(f=>f.id),built:galleryAPI.cards.reduce((n,c)=>n+c.instances.size,0)}));
 expect(p.stats).toEqual({techniques:64,variants:10,showcases:3,demos:77});
 const owned=[...p.groups.flat(),...p.shows];expect(new Set(owned).size).toBe(p.ids.length);expect(owned.sort()).toEqual(p.ids.sort());expect(p.built).toBeLessThan(10);
 await page.getByRole('button',{name:'Characters',exact:true}).click();
 await expect(page.locator('#gallery > figure:visible')).toHaveCount(5);
 await page.getByRole('button',{name:'Flubber',exact:true}).click();
 await expect(page.locator('#gallery > figure:visible')).toHaveCount(0);
 await page.locator('#fKind').getByRole('button',{name:'All',exact:true}).click();
 await expect(page.locator('#gallery > figure:visible')).toHaveCount(1);
 await page.evaluate(()=>galleryAPI.draw('morph',2));
 expect(await page.locator('[data-effect-id="optical-morph"] select').inputValue()).toBe('morph');
});
test('all 77 registered demos render in undistorted landscape frames, with distinct family previews',async({page})=>{
 test.setTimeout(240000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 const demos=await page.evaluate(()=>[...FXCatalog.byId.values()].map(d=>({id:d.id,hero:d.hero,period:d.period,role:d.role})));
 const signatures=new Map();
 for(const d of demos){
  const state=await page.evaluate(async d=>{const r=await galleryAPI.draw(d.id,d.hero);const box=r.stage.getBoundingClientRect();return {error:r.stage.querySelector('.oops')?.textContent,ratio:box.width/box.height,canvases:[...r.stage.querySelectorAll('canvas')].filter(c=>!c.closest('.pd-badge')).map(c=>({ratio:c.width/c.height,display:c.getBoundingClientRect().width/c.getBoundingClientRect().height}))};},d);
  expect(state.error,d.id).toBeUndefined();expect(state.ratio,d.id).toBeCloseTo(16/9,2);
  for(const c of state.canvases)expect(c.ratio,c.display+' '+d.id).toBeCloseTo(c.display,2);
  const stage=page.locator(`.stage[data-demo="${d.id}"]:visible`);await stage.scrollIntoViewIfNeeded();
  await page.evaluate(async d=>galleryAPI.draw(d.id,d.hero),d);
  const hero=await stage.screenshot();
  if(d.role==='technique'){const sig=hero.toString('base64');expect(signatures.has(sig),`identical previews: ${d.id} / ${signatures.get(sig)}`).toBe(false);signatures.set(sig,d.id);}
 }
 expect(errors).toEqual([]);
});
test('landscape gallery remains usable at phone width and filters include characters',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.getByRole('button',{name:'Characters',exact:true}).click();
 await page.evaluate(()=>galleryAPI.draw('dithercards',2.4));
 const stage=page.locator('.stage[data-demo="dithercards"]');const b=await stage.boundingBox();expect(b.width/b.height).toBeCloseTo(16/9,2);
 await expect(page.locator('#shown')).toHaveText('5 techniques shown');
});
