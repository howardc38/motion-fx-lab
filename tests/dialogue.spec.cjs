const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/dialogue/manifest.json')));
const LIBRARY=['rays','stamp','count','sweep','glitch','cardflip','ring'];

test('bundled speech, cues, words and beats agree',async()=>{
 for(const [name,spec] of Object.entries(data.films)){
  const bytes=fs.readFileSync(path.join(__dirname,'../assets/dialogue',spec.audio.file));
  expect(crypto.createHash('sha256').update(bytes).digest('hex')).toBe(spec.audio.sha256);
  let end=0;const shapes=new Set();
  for(const turn of spec.turns){
   expect(turn.start).toBeGreaterThanOrEqual(end);expect(turn.end).toBeGreaterThan(turn.start);expect(turn.end).toBeLessThan(spec.duration);
   let cueEnd=0;for(const c of turn.mouth){expect(c.start).toBeGreaterThanOrEqual(cueEnd-.001);expect(c.end).toBeGreaterThan(c.start);expect(c.end).toBeLessThanOrEqual(turn.end-turn.start+.1);expect('ABCDEFGHX').toContain(c.value);cueEnd=c.end;shapes.add(c.value);}
   // Word timing from the voice model: one span per written word, in order, inside the line.
   expect(turn.words.map(w=>w.text)).toEqual(turn.text.split(' '));
   let w0=0;for(const w of turn.words){expect(w.start).toBeGreaterThanOrEqual(w0-.001);expect(w.end).toBeGreaterThan(w.start);expect(w.end).toBeLessThanOrEqual(turn.end-turn.start+.001);w0=w.end;}
   end=turn.end;
  }
  expect(shapes.size).toBeGreaterThanOrEqual(name==='character-lipsync'?9:8);
  for(const [k,[a,b]] of Object.entries(spec.beats))expect(b,k).toBeGreaterThanOrEqual(a);
 }
});

test('lip-sync film: open shapes lead, closed shapes stay a minority, every shape is held',()=>{
 const spec=data.films['character-lipsync'],count={};let frames=0;const held={};
 for(const turn of spec.turns){
  for(let k=0;k<Math.round((turn.end-turn.start)*30);k++){const s=k/30,c=turn.mouth.find(c=>s>=c.start&&s<c.end)?.value||'X';count[c]=(count[c]||0)+1;frames++;}
  for(const c of turn.mouth)held[c.value]=Math.max(held[c.value]||0,(c.end-c.start)*30);
 }
 const share=k=>(count[k]||0)/frames;
 expect(share('X')+share('A')).toBeLessThanOrEqual(.4);
 expect(share('C')+share('D')).toBeGreaterThanOrEqual(.2);
 for(const k of 'XABCDEFGH')expect(held[k],k).toBeGreaterThanOrEqual(2);
 // While the lines play, no stretch longer than 0.6 s is without speech or a sound effect;
 // the silent reaction after them is checked for motion in the browser test below.
 const last=spec.turns.at(-1).end,sounds=[...spec.turns.map(t=>[t.start,t.end]),...spec.sfx.map(([t])=>[t,t+.35])].sort((a,b)=>a[0]-b[0]);let reach=0,gap=0;
 for(const [a,b] of sounds){if(a<last)gap=Math.max(gap,a-reach);reach=Math.max(reach,b);}
 expect(gap).toBeLessThanOrEqual(.6);
});

for(const name of ['character-lipsync','character-dialogue'])test(`${name} seeks deterministically, highlights the spoken word and rests silent mouths`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`/examples/${name}.html`);await page.evaluate(async()=>{await __ready;await __record()});
 const result=await page.evaluate(async()=>{
  const e=dialogueEffect,l=e.spec.turns.find(t=>t.speaker==='bear'),w=l.words[1],t=l.start+w.start+.03;
  await __render(t);const before=document.querySelector('#film').toDataURL(),proof=e.proof();
  await __render(__DUR-.1);const silent=e.proof();await __render(1.234);await __render(t);
  return{same:before===document.querySelector('#film').toDataURL(),proof,word:w.text,silent,audio:__audio,dur:__DUR,size:__SIZE};
 });
 expect(result.same).toBe(true);expect(result.proof.bear.speaking).toBe(true);expect(result.proof.pip).toEqual({mouth:'X',speaking:false});expect(result.proof.word).toBe(result.word);
 expect(result.silent.bear.mouth).toBe('X');expect(result.silent.pip.mouth).toBe('X');expect(result.audio.sha256).toBe(data.films[name].audio.sha256);
 expect(result.size).toEqual({w:1920,h:1080});expect(errors).toEqual([]);
});

test('Say it. Mean it.: named expressions, and one replayed line drives both faces',async({page})=>{
 await page.goto('/examples/character-lipsync.html');await page.evaluate(async()=>{await __ready;await __record()});
 const p=await page.evaluate(async()=>{
  const e=dialogueEffect,out={};
  for(const [name,at] of Object.entries(e.expressions)){await __render(at);out[name]={at,shown:e.proof().expression};}
  const replay=e.spec.turns.find(t=>t.faces),mid=[];
  for(const c of replay.mouth.filter(c=>c.end-c.start>.08)){await __render(replay.start+(c.start+c.end)/2);const q=e.proof();mid.push([q.bear.mouth,q.pip.mouth,q.shot]);}
  // The silent reaction keeps moving: every 0.3 s step changes the picture.
  const small=document.createElement('canvas');small.width=160;small.height=90;const g=small.getContext('2d',{willReadFrequently:true});let prev=null,still=0;
  for(let t=replay.end;t<e.K.end;t+=.3){await __render(t);g.drawImage(document.querySelector('#film'),0,0,160,90);const d=g.getImageData(0,0,160,90).data;if(prev){let s=0;for(let i=0;i<d.length;i+=4)s+=Math.abs(d[i]-prev[i]);if(s/(d.length/4)<.6)still++;}prev=d;}
  return{out,mid,faces:replay.faces,still};
 });
 expect(p.out.suspicious.at).toBeCloseTo(1,0);expect(p.out.outburst.at).toBeGreaterThan(2.2);expect(p.out.outburst.at).toBeLessThan(3);expect(p.out.smug.at).toBeGreaterThan(5.4);expect(p.out.smug.at).toBeLessThan(6.6);
 for(const [k,v] of Object.entries(p.out))expect(v.shown,k).toBe(k);
 expect(p.faces).toEqual(['bear','pip']);expect(p.mid.length).toBeGreaterThan(3);
 for(const [bear,pip,shot] of p.mid){expect(pip).toBe(bear);expect(shot).toBe('split');}
 expect(p.still).toBe(0);
});

test('The Final Final: library effects carry the story and the trailer reaches 99% before the stamp',async({page})=>{
 await page.goto('/examples/character-dialogue.html');await page.evaluate(async()=>{await __ready;await __record()});
 const p=await page.evaluate(async()=>{
  const e=dialogueEffect,b=e.spec.beats,seen=new Set(),pct=[];
  for(let t=0;t<__DUR;t+=.1)e.effectsAt(t).forEach(x=>seen.add(x));
  for(const u of [1.5,2.6,3.2,3.6,4.2]){await __render(b.trailer[0]+u);const q=e.proof();pct.push([q.percent,q.effects,q.shot]);}
  const flips=[];for(const t of e.K.flips){await __render(t+.2);flips.push(e.proof().flipped);}
  return{seen:[...seen],pct,flips,effects:e.EFFECTS.map(x=>x.id)};
 });
 const used=LIBRARY.filter(id=>p.seen.includes(id));expect(used.length).toBeGreaterThanOrEqual(4);
 expect(p.pct.map(x=>x[2])).toEqual(['trailer','trailer','trailer','trailer','trailer']);
 expect(p.pct[1][0]).toBe(99);expect(p.pct[1][1]).toContain('count');expect(p.pct[3][1]).toContain('glitch');expect(p.pct[4][1]).toContain('stamp');
 expect(p.flips).toEqual([1,2,3]);
 // Every library effect named in the film is a registered gallery demo.
 await page.goto('/');await page.waitForFunction(()=>window.FX&&window.FXCatalog);
 const ids=await page.evaluate(()=>FX.DEMOS.map(d=>d.id));for(const id of p.effects.filter(id=>id!=='plush-fur'))expect(ids).toContain(id);
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

test('gallery tile: large face, word highlight and cue strip readable at tile size',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>window.galleryAPI);await page.evaluate(()=>galleryAPI.pause());
 const spec=data.films['character-lipsync'],turn=spec.turns.find(t=>t.gesture==='outburst'),t=turn.start+turn.words[0].start+.04;
 const r=await page.evaluate(async t=>{
  const {stage}=await galleryAPI.draw('dialogue-lipsync',t),c=stage.querySelector('canvas'),box=stage.getBoundingClientRect(),g=c.getContext('2d'),d=g.getImageData(0,0,c.width,c.height).data;
  let hi=0;for(let y=Math.floor(c.height*.8);y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(Math.abs(d[i]-255)<30&&Math.abs(d[i+1]-209)<35&&Math.abs(d[i+2]-102)<45)hi++;}
  return{width:box.width,highlight:hi/(c.width*c.height)};
 },t);
 expect(r.width).toBeGreaterThan(300);expect(r.highlight).toBeGreaterThan(.004);
});

test('intro speech and image excerpts share the same source time',async({page})=>{
 await page.goto('/video/intro.html');await page.evaluate(async()=>{await __ready;await __record();await __render(19.7)});
 const p=await page.evaluate(async()=>({layers:__audioLayers,proof:(await introProof()).dialogue}));
 const layer=p.layers[0],spec=data.films['character-dialogue'],source=layer.offset+(19.7-layer.at);
 expect(layer.sha256).toBe(spec.audio.sha256);expect(p.proof.time).toBeCloseTo(source,6);
 expect(p.proof.speaker).toBe(spec.turns.find(t=>source>=t.start&&source<t.end)?.speaker||null);
});
