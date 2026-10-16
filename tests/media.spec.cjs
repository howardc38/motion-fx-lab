const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
// examples/films.json (version 2) via tools/films.cjs, whose film objects also answer to the old .source name.
const {films,needsPreview}=require('../tools/films.cjs');
const ratio=({w,h})=>w===h?'1:1':w*5===h*4?'4:5':w>h?'16:9':'9:16';
const probe=(file,count=false)=>JSON.parse(execFileSync('ffprobe',['-v','error',...(count?['-count_frames']:[]),'-show_streams','-show_format','-of','json',file],{encoding:'utf8',timeout:30000}));
// Size budgets (D5): a card loop at most 2 MB (1 MB is the target), the README hero GIF at most 3 MB, a poster at most 300 KB.
const BUDGET={preview:2_000_000,gif:3_000_000,poster:300_000};
// Small RGB thumbnails, to compare a poster with the film frames around the one it should be. A JPEG
// never matches the decoded film exactly (range and chroma conversion), so the poster must match its own
// frame best, not two frames earlier, as deliver.py's former -ss seek gave.
const SIZE=64*36*3;
const thumbs=(file,frames)=>{const raw=execFileSync('ffmpeg',['-v','error','-i',file,'-vf',`select=${frames.map(n=>`eq(n\\,${n})`).join('+')},scale=64:36:flags=area,format=rgb24`,'-fps_mode','passthrough','-frames:v',String(frames.length),'-f','rawvideo','-'],{timeout:120000,maxBuffer:1<<22});return frames.map((_,i)=>raw.subarray(i*SIZE,(i+1)*SIZE));};
const still=file=>execFileSync('ffmpeg',['-v','error','-i',file,'-vf','scale=64:36:flags=area,format=rgb24','-frames:v','1','-f','rawvideo','-'],{timeout:60000,maxBuffer:1<<20});
const meanDiff=(a,b)=>a.reduce((s,x,i)=>s+Math.abs(x-b[i]),0)/a.length;
const frames=(clips,fps)=>clips.reduce((n,[a,b])=>n+Math.round(b*fps)-Math.round(a*fps),0);
for(const film of films){const name=film.id;test(`published ${name} bundle agrees with its authoring metadata`,async({page})=>{
 await page.goto('/'+film.page);
 await page.waitForFunction(()=>window.__DUR&&window.__SIZE);
 const spec=await page.evaluate(()=>({duration:__DUR,size:__SIZE,fps:window.__FPS??30,gif:window.__gif||[],preview:window.__preview||[],poster:window.__poster??__DUR/3}));
 const fps=film.fps??30;expect(spec.fps).toBe(fps);
 const readme=fs.readFileSync(path.resolve(__dirname,'../README.md'),'utf8');
 const row=readme.split('\n').find(line=>line.startsWith('|')&&line.includes('[poster]')&&[...line.matchAll(/\]\(([^)]+)\)/g)].some(([,href])=>new URL(href,'https://local.test/').pathname==='/media/'+name+'.mp4'));
 expect(row,`README published row for ${name}`).toBeTruthy();
 const cells=row.split('|').map(c=>c.trim());expect(parseFloat(cells[3])).toBeCloseTo(spec.duration,2);
 expect(cells[4]).toBe(ratio(spec.size));expect(film.format).toBe(ratio(spec.size));expect(film.duration).toBeCloseTo(spec.duration,2);
 const media=path.resolve(__dirname,'../media'),mp4=path.join(media,name+'.mp4'),movie=probe(mp4);
 const v=movie.streams.find(s=>s.codec_type==='video'),a=movie.streams.find(s=>s.codec_type==='audio');
 expect([v.width,v.height]).toEqual([spec.size.w,spec.size.h]);expect(v.codec_name).toBe('h264');expect(v.r_frame_rate).toBe(fps+'/1');
 expect(Number(v.nb_frames)).toBe(Math.round(spec.duration*fps)+1);
 expect([v.color_space,v.color_transfer,v.color_primaries]).toEqual(['bt709','bt709','bt709']);
 expect(a.codec_name).toBe('aac');expect(Number(a.bit_rate)).toBeLessThanOrEqual(128000);expect(Number(movie.format.size)).toBeLessThanOrEqual(15000000);
 // The poster is the frame the film shows at window.__poster (deliver.py picks it by index, not by -ss).
 const jpg=path.join(media,name+'.jpg'),poster=probe(jpg).streams[0];expect([poster.width,poster.height]).toEqual([spec.size.w,spec.size.h]);
 expect(fs.statSync(jpg).size,`${name}.jpg size`).toBeLessThanOrEqual(BUDGET.poster);
 expect(spec.poster).toBeGreaterThanOrEqual(0);expect(spec.poster).toBeLessThan(spec.duration);
 const n=Math.round(spec.poster*fps),cand=[n-2,n,n+2].filter(k=>k>=0&&k<Number(v.nb_frames)),got=still(jpg);
 const d=thumbs(mp4,cand).map(t=>meanDiff(got,t)),own=d[cand.indexOf(n)];
 expect(own,`${name}.jpg looks like a frame of this film`).toBeLessThan(8);
 cand.forEach((k,i)=>{if(k!==n)expect(own,`${name}.jpg is the frame at ${spec.poster} s, not frame ${k}`).toBeLessThanOrEqual(d[i]+.25);});
 // The card loop: present exactly when the page declares window.__preview and films.json lists it.
 const loop=path.join(media,name+'.preview.mp4');
 expect(fs.existsSync(loop),`${name}.preview.mp4`).toBe(spec.preview.length>0);
 expect(spec.preview.length>0,`${name}: window.__preview for a film with a card`).toBe(needsPreview(film));
 if(spec.preview.length){
  for(const [start,end] of spec.preview){expect(start).toBeGreaterThanOrEqual(0);expect(end).toBeGreaterThan(start);expect(end).toBeLessThanOrEqual(spec.duration);}
  const info=probe(loop),lv=info.streams.find(s=>s.codec_type==='video');
  expect(info.streams.some(s=>s.codec_type==='audio'),`${name} loop is silent`).toBe(false);
  expect([lv.codec_name,lv.pix_fmt]).toEqual(['h264','yuv420p']);
  expect(lv.width).toBeLessThanOrEqual(800);expect(lv.height).toBeLessThanOrEqual(450);expect(Math.max(lv.width/800,lv.height/450)).toBeGreaterThan(.99);
  expect(lv.width/lv.height).toBeCloseTo(spec.size.w/spec.size.h,1);
  expect(Number(lv.nb_frames)).toBe(frames(spec.preview,fps));
  expect(Number(info.format.size),`${name}.preview.mp4 size`).toBeLessThanOrEqual(BUDGET.preview);
  const head=fs.readFileSync(loop).subarray(0,1<<16).toString('latin1');expect(head.indexOf('moov'),'faststart').toBeGreaterThan(0);expect(head.indexOf('moov')).toBeLessThan(head.indexOf('mdat')<0?Infinity:head.indexOf('mdat'));
 }
 // Only the intro keeps a GIF: the README hero.
 const gif=path.join(media,name+'.gif');expect(fs.existsSync(gif)).toBe(spec.gif.length>0);
 expect(spec.gif.length>0,`${name}: only the intro declares window.__gif`).toBe(film.tier==='hero');
 if(spec.gif.length){
  const info=probe(gif,true),g=info.streams[0];let seconds=0;
  for(const [start,end] of spec.gif){expect(start).toBeGreaterThanOrEqual(0);expect(end).toBeGreaterThan(start);expect(end).toBeLessThanOrEqual(spec.duration);seconds+=end-start;}
  expect(g.width).toBeLessThanOrEqual(800);expect(g.width).toBeGreaterThanOrEqual(480);expect(g.width/g.height).toBeCloseTo(spec.size.w/spec.size.h,2);
  expect(Math.abs(Number(g.nb_read_frames)-Math.round(seconds*12))).toBeLessThanOrEqual(1);
  expect(Math.abs(Number(info.format.duration)-seconds)).toBeLessThan(.12);
  expect(fs.statSync(gif).size,`${name}.gif size`).toBeLessThanOrEqual(BUDGET.gif);
 }
});}

test('media/ holds only budgeted previews: loops, one hero GIF and posters',()=>{
 const media=path.resolve(__dirname,'../media'),names=fs.readdirSync(media).filter(n=>!n.startsWith('.')&&!n.endsWith('_hq.mp4'));
 const over=[];
 for(const n of names){const size=fs.statSync(path.join(media,n)).size,limit=n.endsWith('.preview.mp4')?BUDGET.preview:n.endsWith('.gif')?BUDGET.gif:n.endsWith('.jpg')?BUDGET.poster:null;if(limit&&size>limit)over.push(`${n} ${size} > ${limit}`);}
 expect(over).toEqual([]);
 expect(names.filter(n=>n.endsWith('.gif'))).toEqual(films.filter(f=>f.tier==='hero').map(f=>f.id+'.gif'));
 expect(names.filter(n=>n.endsWith('.preview.mp4')).sort()).toEqual(films.filter(needsPreview).map(f=>f.id+'.preview.mp4').sort());
});
