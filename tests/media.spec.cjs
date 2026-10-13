const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
// examples/films.json (version 2) via tools/films.cjs, whose film objects also answer to the old .source name.
const {films}=require('../tools/films.cjs');
const ratio=({w,h})=>w===h?'1:1':w*5===h*4?'4:5':w>h?'16:9':'9:16';
const probe=(file,count=false)=>JSON.parse(execFileSync('ffprobe',['-v','error',...(count?['-count_frames']:[]),'-show_streams','-show_format','-of','json',file],{encoding:'utf8',timeout:30000}));
for(const film of films){const name=film.id;test(`published ${name} bundle agrees with its authoring metadata`,async({page})=>{
 await page.goto('/'+film.page);
 await page.waitForFunction(()=>window.__DUR&&window.__SIZE);
 const spec=await page.evaluate(()=>({duration:__DUR,size:__SIZE,gif:window.__gif||[],poster:window.__poster??__DUR/3}));
 const readme=fs.readFileSync(path.resolve(__dirname,'../README.md'),'utf8');
 const row=readme.split('\n').find(line=>line.startsWith('|')&&line.includes('[poster]')&&[...line.matchAll(/\]\(([^)]+)\)/g)].some(([,href])=>new URL(href,'https://local.test/').pathname==='/media/'+name+'.mp4'));
 expect(row,`README published row for ${name}`).toBeTruthy();
 const cells=row.split('|').map(c=>c.trim());expect(parseFloat(cells[3])).toBeCloseTo(spec.duration,2);
 expect(cells[4]).toBe(ratio(spec.size));expect(film.format).toBe(ratio(spec.size));expect(film.duration).toBeCloseTo(spec.duration,2);
 const media=path.resolve(__dirname,'../media'),movie=probe(path.join(media,name+'.mp4'));
 const v=movie.streams.find(s=>s.codec_type==='video'),a=movie.streams.find(s=>s.codec_type==='audio');
 expect([v.width,v.height]).toEqual([spec.size.w,spec.size.h]);expect(v.codec_name).toBe('h264');expect(v.r_frame_rate).toBe('30/1');
 expect(Number(v.nb_frames)).toBe(Math.round(spec.duration*30)+1);
 expect([v.color_space,v.color_transfer,v.color_primaries]).toEqual(['bt709','bt709','bt709']);
 expect(a.codec_name).toBe('aac');expect(Number(a.bit_rate)).toBeLessThanOrEqual(128000);expect(Number(movie.format.size)).toBeLessThanOrEqual(15000000);
 const poster=probe(path.join(media,name+'.jpg')).streams[0];expect([poster.width,poster.height]).toEqual([spec.size.w,spec.size.h]);
 expect(spec.poster).toBeGreaterThanOrEqual(0);expect(spec.poster).toBeLessThan(spec.duration);
 const gif=path.join(media,name+'.gif');expect(fs.existsSync(gif)).toBe(spec.gif.length>0);
 if(spec.gif.length){
  const info=probe(gif,true),g=info.streams[0];let seconds=0;
  for(const [start,end] of spec.gif){expect(start).toBeGreaterThanOrEqual(0);expect(end).toBeGreaterThan(start);expect(end).toBeLessThanOrEqual(spec.duration);seconds+=end-start;}
  expect(g.width).toBe(800);expect(g.width/g.height).toBeCloseTo(spec.size.w/spec.size.h,2);
  expect(Math.abs(Number(g.nb_read_frames)-Math.round(seconds*12))).toBeLessThanOrEqual(1);
  expect(Math.abs(Number(info.format.duration)-seconds)).toBeLessThan(.12);
 }
});}
