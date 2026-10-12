const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/dialogue/manifest.json')));

test('bundled speech, cue ranges and independent speaker tracks agree',async()=>{
 for(const spec of Object.values(data.films)){
  const bytes=fs.readFileSync(path.join(__dirname,'../assets/dialogue',spec.audio.file));
  expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(spec.audio.sha256);
  let end=0;const shapes=new Set();
  for(const turn of spec.turns){
   expect(turn.start).toBeGreaterThanOrEqual(end);expect(turn.end).toBeGreaterThan(turn.start);expect(turn.end).toBeLessThan(spec.duration);
   let cueEnd=0;for(const c of turn.mouth){expect(c.start).toBeGreaterThanOrEqual(cueEnd-.001);expect(c.end).toBeGreaterThan(c.start);expect(c.end).toBeLessThanOrEqual(turn.end-turn.start+.1);expect('ABCDEFGHX').toContain(c.value);cueEnd=c.end;shapes.add(c.value);}end=turn.end;
  }
  expect(shapes.size).toBeGreaterThanOrEqual(6);
 }
});

for(const name of ['character-lipsync','character-dialogue'])test(`${name} seeks deterministically and rests the silent mouth`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`/examples/${name}.html`);await page.evaluate(async()=>{await __ready;await __record()});
 const result=await page.evaluate(async()=>{
  const e=dialogueEffect,l=e.spec.turns[0],t=l.start+.6;
  await __render(t);const before=document.querySelector('#film').toDataURL(),proof=e.proof();
  await __render(__DUR-.1);const silent=e.proof();await __render(0);await __render(t);
  return{same:before===document.querySelector('#film').toDataURL(),proof,silent,audio:__audio,dur:__DUR,size:__SIZE};
 });
 expect(result.same).toBe(true);expect(result.proof.mira.speaking).toBe(true);expect(result.proof.pip).toEqual({mouth:'X',speaking:false});expect(result.silent.mira.mouth).toBe('X');expect(result.silent.pip.mouth).toBe('X');expect(result.audio.sha256).toBe(data.films[name].audio.sha256);expect(result.size).toEqual({w:1280,h:720});expect(errors).toEqual([]);
});

test('play, pause and seek use the voice audio clock',async({page})=>{
 await page.goto('/examples/character-dialogue.html');await page.evaluate(()=>__ready);await page.getByRole('button',{name:'Play with sound'}).click();
 await page.waitForFunction(()=>document.querySelector('audio').currentTime>.3);await page.getByRole('button',{name:'Pause',exact:true}).click();
 const t=await page.evaluate(()=>document.querySelector('audio').currentTime);await page.waitForTimeout(160);expect(await page.evaluate(()=>document.querySelector('audio').currentTime)).toBe(t);
 await page.locator('#seek').fill('12');await page.waitForFunction(()=>dialogueEffect.proof().time===12);expect(await page.evaluate(()=>document.querySelector('audio').paused)).toBe(true);await expect(page.locator('#clock')).toHaveText('12.00 s');
});

test('changed speech rejects stale mouth cues before playback',async({page})=>{
 await page.route('**/assets/dialogue/character-lipsync.wav*',r=>r.fulfill({body:Buffer.from('changed audio')}));await page.goto('/examples/character-lipsync.html');await expect(page.locator('#error')).toContainText('different builds');
});

test('intro speech and image excerpts share the same source time',async({page})=>{
 await page.goto('/video/intro.html');await page.evaluate(async()=>{await __ready;await __record();await __render(19.7)});
 const p=await page.evaluate(async()=>({layers:__audioLayers,proof:(await introProof()).dialogue}));
 expect(p.layers[0]).toMatchObject({at:16.8,offset:.45,duration:4.8,sha256:data.films['character-dialogue'].audio.sha256});expect(p.proof.time).toBeCloseTo(3.35,6);expect(p.proof.speaker).toBe('pip');
});
