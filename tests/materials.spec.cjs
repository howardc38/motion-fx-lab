const { test, expect } = require("@playwright/test");
async function gallery(page) {
  await page.goto("/");
  await page.waitForFunction(() => window.galleryAPI);
  await page.evaluate(() => galleryAPI.pause());
}
test("material families survive arbitrary seeks and shared-renderer interleaving", async ({
  page,
}) => {
  await gallery(page);
  const results = await page.evaluate(async () => {
    const entries = await Promise.all(
        FXMaterial.studies.map(async (s) => ({
          s,
          e: await FXMaterial.create(s.id),
        })),
      ),
      out = [];
    for (const { s, e } of entries) {
      await e.frame(s.hero);
      const first = e.canvas.toDataURL();
      await e.frame(s.hero + 1.2);
      const later = e.canvas.toDataURL();
      for (const other of entries) await other.e.frame(4.9);
      await e.frame(s.hero);
      out.push({
        id: s.id,
        repeat: first === e.canvas.toDataURL(),
        moves: first !== later,
      });
    }
    return out;
  });
  for (const r of results) {
    expect(r.repeat, r.id).toBe(true);
    expect(r.moves, r.id).toBe(true);
  }
});
test("CJK outlines create real solids, allow replacements, and reject missing glyphs", async ({
  page,
}) => {
  await gallery(page);
  const p = await page.evaluate(async () => {
    const e = await FXMaterial.create("cjk-solid");
    e.frame(1, { text: "流動" });
    const first = e.canvas.toDataURL();
    e.frame(1, { text: "光影" });
    const second = e.canvas.toDataURL();
    const alternate = e.proof();
    e.frame(1, { text: "流動" });
    let missing;
    try {
      e.frame(1, { text: "🐈" });
    } catch (err) {
      missing = err.message;
    }
    return {
      changed: first !== second,
      repeat: first === e.canvas.toDataURL(),
      alternate,
      missing,
    };
  });
  expect(p.changed).toBe(true);
  expect(p.repeat).toBe(true);
  expect(p.alternate).toMatchObject({ text: "光影", meshes: 2, depth: 190 });
  expect(p.missing).toContain("Missing outline");
});
test("solid lettering accepts Latin words with spaces, grows its extrusion and sweeps a light", async ({ page }) => {
  await gallery(page);
  const p = await page.evaluate(async () => {
    const e = await FXMaterial.create("cjk-solid"), out = [];
    for (const t of [0.1, 3, 5.5]) { e.frame(t, { text: "MAKE IT", labels: false }); out.push(e.proof()); }
    return out;
  });
  expect(p[0]).toMatchObject({ text: "MAKE IT", meshes: 6 });
  expect(p[0].grow).toBeLessThan(0.1);
  expect(p[1].grow).toBeGreaterThan(0.99);
  expect(p[1].sweep).toBeGreaterThan(0.5);
  expect(p[2].sweep).toBeGreaterThan(0.5);
});
test("full-frame glitch accepts an external image and does not mutate it", async ({
  page,
}) => {
  await gallery(page);
  const p = await page.evaluate(async () => {
    const e = await FXMaterial.create("frame-glitch"),
      c = document.createElement("canvas");
    c.width = 640;
    c.height = 360;
    const g = c.getContext("2d");
    g.fillStyle = "#f23e48";
    g.fillRect(0, 0, 640, 360);
    g.fillStyle = "#1436cd";
    g.fillRect(120, 80, 300, 200);
    const before = c.toDataURL();
    e.frame(2, { source: c, strength: 0, labels: false });
    const clean = e.canvas.toDataURL();
    e.frame(2, { source: c, strength: 1, labels: false });
    const broken = e.canvas.toDataURL();
    e.frame(2, { source: c, strength: 0, labels: false });
    return {
      mutated: before !== c.toDataURL(),
      changed: clean !== broken,
      repeat: clean === e.canvas.toDataURL(),
    };
  });
  expect(p).toEqual({ mutated: false, changed: true, repeat: true });
});
test("room styles preserve the action clock and layout across treatment changes", async ({
  page,
}) => {
  await gallery(page);
  const p = await page.evaluate(async () => {
    const e = await FXMaterial.create("scene-eras"),
      out = [];
    for (let style = 0; style < 8; style++) {
      e.frame(2.2, { style });
      out.push({ proof: e.proof(), pixels: e.canvas.toDataURL() });
    }
    e.frame(0.2, { style: 0 });
    return { out, early: e.proof() };
  });
  expect(new Set(p.out.map((x) => x.pixels)).size).toBe(8);
  for (const { proof } of p.out) {
    expect(proof.hand).toEqual(p.out[0].proof.hand);
    expect(proof.landmarks).toEqual(p.out[0].proof.landmarks);
  }
  expect(p.early.hand).not.toEqual(p.out[0].proof.hand);
});
for (const [name,expected] of [
 ['water-forms',['drop','crown','form','glass','dive','rise','endcard']],
 ['water-forms-vertical',['drop','crown','form','glass','dive','rise','endcard']],
 ['word-forms',['solid','particles','contours','glitch','assemble','resolved']],
 ['scene-eras',Array.from({length:8},(_,i)=>'style-'+i)],
]) test(`${name} exports every chapter, including its final frame`, async ({page}) => {
 await page.goto('/examples/'+name+'.html');
 const p=await page.evaluate(async()=>{
  await __ready;await __record();const samples=[];
  for(const chapter of materialTimeline.chapters){
   const t=chapter.start+chapter.duration*.45;await __render(t);
   samples.push({id:chapter.id,duration:chapter.duration,proof:filmEffect.proof(),pixels:document.querySelector('#film').toDataURL()});
  }
  await __render(__DUR);const end=filmEffect.proof();
  await __render(materialTimeline.chapters[0].duration*.45);
  return {samples,end,size:__SIZE,duration:__DUR,repeat:samples[0].pixels===document.querySelector('#film').toDataURL()};
 });
 expect(p.samples.map(s=>s.id)).toEqual(expected);expect(p.repeat).toBe(true);
 expect(new Set(p.samples.map(s=>s.pixels)).size).toBe(expected.length);
 if(name==='word-forms'){expect(p.samples.map(s=>s.proof.phase)).toEqual(expected);expect(p.end.phase).toBe('resolved');}
 if(name==='scene-eras'){expect(p.samples.map(s=>s.proof.styleIndex)).toEqual([0,1,2,3,4,5,6,7]);expect(p.end.styleIndex).toBe(7);}
 if(name.startsWith('water-forms')){
  expect(p.duration).toBe(15);for(const s of p.samples)expect(s.duration).toBeLessThanOrEqual(3.5);
  expect(p.samples.map(s=>s.proof.chapter)).toEqual(expected);
  expect(p.samples.map(s=>s.proof.bottle)).toEqual(['none','none','liquid','glass','glass','glass','glass']);
  expect(p.samples.map(s=>s.proof.effect)).toEqual(['water-impact','water-impact','water-morph','water-material','water-underwater','water-underwater',null]);
  expect(p.size).toEqual(name==='water-forms'?{w:1280,h:720}:{w:720,h:1280});
 }
});

test("Clear: the brand is set in one place and the glass bends the letters behind it for over two seconds", async ({ page }) => {
 await page.goto('/examples/water-forms.html');
 const p=await page.evaluate(async()=>{
  await __ready;await __record();const {BRAND,EFFECTS}=await import('/fx/material-studies/clear.js');const c=document.querySelector('#film'),g=c.getContext('2d'),rows=[];
  // Inside the bottle's silhouette, refracted letter colour (the accent) must show up while the letters stand behind it.
  for(let t=4.9;t<=7.31;t+=.2){await __render(t);const pr=filmEffect.proof(),b=pr.bottleScreen,d=g.getImageData(Math.round(b.x-45),Math.round(b.y-90),90,180).data;let accent=0;for(let i=0;i<d.length;i+=4)if(d[i]>170&&d[i+1]<150&&d[i+2]<140)accent++;rows.push({t,letters:pr.lettersVisible,accent});}
  const html=document.documentElement.outerHTML;
  return {rows,brand:BRAND,effects:EFFECTS,pageMentionsBrand:html.includes(BRAND.tagline)};
 });
 expect(p.brand.name).toBe('CLEAR');expect(p.pageMentionsBrand).toBe(false);
 expect(p.effects).toEqual(['water-impact','water-morph','water-material','water-underwater']);
 const bent=p.rows.filter(r=>r.letters&&r.accent>150);
 expect(bent.length*.2).toBeGreaterThanOrEqual(2);
});

test("water studies: the crown fills about 40% of the frame and loops in four seconds", async ({ page }) => {
 await gallery(page);
 const p=await page.evaluate(async()=>{const s=FXMaterial.studies.find(s=>s.id==='water-impact'),e=await FXMaterial.create('water-impact');e.frame(s.hero,{labels:false});const hero=e.proof();e.frame(0,{labels:false});const a=e.canvas.toDataURL();e.frame(4,{labels:false});return{period:s.duration,hero,loop:a===e.canvas.toDataURL()};});
 expect(p.period).toBe(4);expect(p.loop).toBe(true);expect(p.hero.crownWidthFraction).toBeGreaterThanOrEqual(.38);
});

test("liquid shape lighting is independent of earlier frames in another instance", async ({
  page,
}) => {
  await gallery(page);
  const p = await page.evaluate(async () => {
    const a = await FXMaterial.create("water-morph"),
      b = await FXMaterial.create("water-morph");
    a.frame(3.3);
    const cold = a.canvas.toDataURL();
    for (const t of [0, 0.8, 1.6, 2.4, 4.2, 7.1]) b.frame(t);
    b.frame(3.3);
    return { same: cold === b.canvas.toDataURL() };
  });
  expect(p.same).toBe(true);
});

test("transparent external glitch sources do not inherit the previous image", async ({
  page,
}) => {
  await gallery(page);
  const p = await page.evaluate(async () => {
    const a = await FXMaterial.create("frame-glitch"),
      b = await FXMaterial.create("frame-glitch"),
      c = document.createElement("canvas");
    c.width = 1280;
    c.height = 720;
    const g = c.getContext("2d");
    g.fillStyle = "#f00";
    g.fillRect(0, 0, 1280, 720);
    a.frame(1, { source: c, labels: false });
    g.clearRect(0, 0, 1280, 720);
    g.fillStyle = "#0af";
    g.fillRect(200, 200, 100, 100);
    a.frame(2, { source: c, labels: false });
    b.frame(2, { source: c, labels: false });
    return a.canvas.toDataURL() === b.canvas.toDataURL();
  });
  expect(p).toBe(true);
});
test("every film card opens its own playable video", async ({ page }) => {
  await gallery(page);
  const cards = page.locator(".film-preview");
  const { cards: byLayer } = require("./fixtures/expected-counts.json").films;
  expect(await cards.count()).toBe(Object.values(byLayer).flat().length);
  for (let i = 0; i < (await cards.count()); i++) {
    const c = cards.nth(i);
    await c.locator("button").click();
    await expect(c.locator("video")).toBeVisible();
    await expect(c.locator("img")).toBeHidden();
  }
});

test('the first room frame matches a repeated and independently warmed frame',async({page})=>{
 await gallery(page);expect(await page.evaluate(async()=>{const a=await FXMaterial.create('scene-eras'),b=await FXMaterial.create('scene-eras');a.frame(12.5);const cold=a.canvas.toDataURL();a.frame(12.5);const repeat=a.canvas.toDataURL();b.frame(0);b.frame(22);b.frame(12.5);return cold===repeat&&cold===b.canvas.toDataURL();})).toBe(true);
});
test('zero glitch strength preserves resized and semitransparent source pixels',async({page})=>{
 await gallery(page);const p=await page.evaluate(async()=>{const e=await FXMaterial.create('frame-glitch'),c=document.createElement('canvas');c.width=1280;c.height=720;const g=c.getContext('2d');g.fillStyle='rgba(255,0,0,.5)';g.fillRect(0,0,1280,720);g.fillStyle='#345acd';g.fillRect(200,200,300,200);const expected=c.toDataURL();e.frame(2,{source:c,strength:0,labels:false});const canvasMatch=e.canvas.toDataURL()===expected;const img=new Image();img.src=expected;await img.decode();img.width=320;img.height=180;e.frame(2,{source:img,strength:0,labels:false});return {canvasMatch,imageMatch:e.canvas.toDataURL()===expected};});expect(p).toEqual({canvasMatch:true,imageMatch:true});
});
test('changing a chapter duration moves subsequent cuts and the export end together',async({page})=>{
 await gallery(page);const p=await page.evaluate(async()=>{const {timeline,chapterAt}=await import('/fx/material-studies/timelines.js');const spec=timeline([{id:'a',duration:2},{id:'b',duration:5},{id:'c',duration:1}]);return {duration:spec.duration,cuts:spec.cuts,at:chapterAt(spec,6).chapter.id,end:chapterAt(spec,8).chapter.id};});expect(p).toEqual({duration:8,cuts:[2,7],at:'b',end:'c'});
});
