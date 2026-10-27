const {test,expect}=require('@playwright/test');
const COUNTS=require('./fixtures/expected-counts.json'),C=COUNTS.catalog;
async function open(page){await page.goto('/');await page.waitForFunction(()=>window.galleryAPI);await page.evaluate(()=>galleryAPI.pause());}
const available=f=>`${f.demos} ${f.demos===1?'preview matches':'previews match'} these filters${f.variants?`, including ${f.variants} variant${f.variants===1?'':'s'} in the card selectors`:''}.`;
async function filter(page,f){
 await page.locator('#fKind').getByRole('button',{name:f.kind,exact:true}).click();
 await page.locator('#fStack').getByRole('button',{name:f.stack,exact:true}).click();
}
test('catalogue owns every demo once; variants and showcases do not inflate the effect count',async({page})=>{
 await open(page);
 const all=COUNTS.filters[0];
 await expect(page.locator('#shown')).toHaveText(`${C.techniques} / ${C.techniques} effects shown`);
 await expect(page.locator('#available')).toHaveText(available(all));
 await expect(page.locator('#showcase-count')).toHaveText('Scene presets below ↘');
 const p=await page.evaluate(()=>({stats:FXCatalog.stats,ids:FX.DEMOS.map(d=>d.id),groups:FXCatalog.families.map(f=>f.entries.map(d=>d.id)),shows:FXCatalog.showcases.map(f=>f.id),
  uiIds:[...document.querySelectorAll('#gallery > figure, #showcaseGallery > figure')].flatMap(card=>card.querySelector('select')?[...card.querySelectorAll('option')].map(o=>o.value):[card.dataset.effectId]),
  galleryCards:[...document.querySelectorAll('#gallery > figure')].map(f=>f.dataset.effectId),familyIds:FXCatalog.families.map(f=>f.id),
  tiers:[...FXCatalog.byId.values()].filter(d=>d.role!=='showcase').map(d=>[d.id,d.tier,FXCatalog.byId.get(d.familyId).tier]),
  effectTiers:FXCatalog.families.map(f=>f.tier),
  built:galleryAPI.cards.reduce((n,c)=>n+c.instances.size,0)}));
 expect(p.stats).toEqual(C);
 const owned=[...p.groups.flat(),...p.shows];expect(new Set(owned).size).toBe(p.ids.length);expect(owned.sort()).toEqual(p.ids.sort());expect(p.built).toBeLessThan(10);expect(p.uiIds.sort()).toEqual(p.ids.sort());
 expect([...p.galleryCards].sort()).toEqual([...p.familyIds].sort());expect(p.familyIds).toHaveLength(C.techniques);
 expect(new Set(p.effectTiers)).toEqual(new Set(['effect']));
 for(const [id,tier,family] of p.tiers)expect(tier,id).toBe(family);
 for(const f of COUNTS.filters.slice(1)){
  await filter(page,f);
  await expect(page.locator('#gallery > figure:visible'),f.kind+' + '+f.stack).toHaveCount(f.families);
  await expect(page.locator('#available')).toHaveText(available(f));
 }
 await filter(page,{kind:'All',stack:'Flubber'});
 await page.evaluate(()=>galleryAPI.draw('morph',2));
 expect(await page.locator('[data-effect-id="optical-morph"] select').inputValue()).toBe('morph');
});
test(`all ${C.demos} registered demos render in undistorted landscape frames, with distinct family previews`,async({page})=>{
 test.setTimeout(300000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
 const demos=await page.evaluate(()=>[...FXCatalog.byId.values()].map(d=>({id:d.id,hero:d.hero,period:d.period,role:d.role})));
 expect(demos).toHaveLength(C.demos);
 const signatures=new Map();
 for(const d of demos){
  const state=await page.evaluate(async d=>{const r=await galleryAPI.draw(d.id,d.hero);const box=r.stage.getBoundingClientRect();return {error:r.stage.querySelector('.oops')?.textContent,ratio:box.width/box.height,canvases:[...r.stage.querySelectorAll('canvas')].map(c=>({ratio:c.width/c.height,display:c.getBoundingClientRect().width/c.getBoundingClientRect().height}))};},d);
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
 await page.evaluate(()=>galleryAPI.draw('dithercharacter',2.4));
 const stage=page.locator('.stage[data-demo="dithercharacter"]');const b=await stage.boundingBox();expect(b.width/b.height).toBeCloseTo(16/9,2);
 await expect(page.locator('#shown')).toHaveText(`${COUNTS.filters[1].families} / ${C.techniques} effects shown`);
});

test('counts include a matching variant when its parent does not match the filter, and custom text updates previews',async({page})=>{
 await open(page);
 const f=COUNTS.filters.find(x=>x.stack==='PixiJS');
 await filter(page,f);
 await expect(page.locator('#shown')).toHaveText(`${f.families} / ${C.techniques} effects shown`);
 await expect(page.locator('#available')).toHaveText(available(f));
 await expect(page.locator('[data-effect-id="liquid"] select')).toHaveValue('stack-pixi');
 await expect(page.locator('#showcase-count')).toHaveAttribute('href','#composition-presets');
 await filter(page,{kind:'All',stack:'All'});
 const changed=await page.evaluate(async()=>{
  const a=(await galleryAPI.draw('graphic-stroke-mural',1.8)).stage.querySelector('canvas').toDataURL();
  galleryAPI.setCustomText('NOVA');
  const b=(await galleryAPI.draw('graphic-stroke-mural',1.8)).stage.querySelector('canvas').toDataURL();
  galleryAPI.setCustomText('');
  return{input:document.getElementById('customText').value,changed:a!==b};
 });
 expect(changed).toEqual({input:'',changed:true});
});

test('old demo links for merged or removed effects open the card that replaced them',async({page})=>{
 for(const [old,card,variant] of [['lit3d','cjk-solid','cjk-solid'],['bounce','toon','halftone'],['ditherpeek','toon','dithercharacter'],['studio-flight','studio-themes','studio-themes'],['tunnel','studio-lowpoly','studio-lowpoly'],['coderain','type','type'],['blueprint','datachart','datachart'],['design-spring-response','timing','timing'],['smoke','fluid-smoke','fluid-smoke']]){
  await page.goto('/#demo-'+old);await page.waitForFunction(()=>window.galleryAPI);
  await expect(page,old).toHaveURL(new RegExp('#demo-'+variant+'$'));
  const fig=page.locator(`[data-effect-id="${card}"]`);await expect(fig,old).toBeVisible();
  if(await fig.locator('select').count())await expect(fig.locator('select'),old).toHaveValue(variant);
 }
});
