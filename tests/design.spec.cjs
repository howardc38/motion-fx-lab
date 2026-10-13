const {test,expect}=require('@playwright/test');
async function open(page){await page.goto('/');await page.waitForFunction(()=>window.galleryAPI);await page.evaluate(()=>galleryAPI.pause());}
test('design studies move, seek backwards and survive interleaved renderer use',async({page})=>{
 await open(page);const rows=await page.evaluate(async()=>{
 const effects=await Promise.all(FXDesign.studies.map(s=>FXDesign.create(s.id))),out=[];
 for(let i=0;i<effects.length;i++){const e=effects[i];e.frame(1.1);const a=e.canvas.toDataURL();e.frame(2.6);const b=e.canvas.toDataURL();effects[(i+1)%effects.length].frame(4);e.frame(1.1);out.push({id:FXDesign.studies[i].id,moves:a!==b,repeats:a===e.canvas.toDataURL()});}return out;});
 for(const r of rows){expect(r.moves,r.id).toBe(true);expect(r.repeats,r.id).toBe(true);}
});
test('the spring-response variant is retired; its sampler stays for the dot film',async({page})=>{
 await open(page);const p=await page.evaluate(async()=>{const flat=await import('/fx/design/flat.js');return{ids:FXDesign.studies.map(s=>s.id),registered:FX.DEMOS.some(d=>d.id==='design-spring-response'),sampler:typeof flat.springPoint==='function'&&typeof flat.drawSpring==='function'};});
 expect(p.ids).not.toContain('spring-response');expect(p.registered).toBe(false);expect(p.sampler).toBe(true);
});
test('hatching stays on the object and responds independently to the light',async({page})=>{
 await open(page);const p=await page.evaluate(async()=>{const e=await FXDesign.create('surface-ink'),pixels=()=>e.canvas.getContext('2d').getImageData(0,0,1280,720).data;
 e.frame(0,{objectAngle:0,cameraAngle:0,debugPattern:true,labels:false});const a=pixels();e.frame(0,{objectAngle:.8,cameraAngle:.8,debugPattern:true,labels:false});const b=pixels();let changed=0,dark=0;for(let i=0;i<a.length;i+=4){if(a[i]<160)dark++;if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>40)changed++;}
 e.frame(0,{objectAngle:0,lightAngle:0,labels:false});const c=e.canvas.toDataURL();e.frame(0,{objectAngle:0,lightAngle:3,labels:false});return{changed,dark,relights:c!==e.canvas.toDataURL(),proof:e.proof()};});
 expect(p.dark).toBeGreaterThan(1000);expect(p.changed).toBeLessThan(1000);expect(p.relights).toBe(true);expect(p.proof.subject).toBe('lathe vase');
});
test('a spotlight casts a hard edge and a window a soft one (edge width in pixels)',async({page})=>{
 await open(page);const p=await page.evaluate(async()=>{const e=await FXDesign.create('soft-shadow'),out=[];
 for(const size of [.03,4]){e.frame(0,{lightSize:size,height:1.4,labels:false});const sc=e.proof().shadowCenter,g=e.canvas.getContext('2d'),row=[];
  // walk outwards from the shadow centre along +x on the floor; record brightness and screen position
  for(let i=0;i<=600;i++){const x=sc[0]+i/600*3.2,pt=e.project([x,.001,sc[2]]);row.push({x:pt.x,y:pt.y,v:g.getImageData(Math.round(pt.x),Math.round(pt.y),1,1).data[0]});}
  const lo=Math.min(...row.map(r=>r.v)),hi=Math.max(...row.map(r=>r.v)),a=row.find(r=>r.v>lo+.1*(hi-lo)),b=row.find(r=>r.v>lo+.9*(hi-lo));
  out.push({size,width:Math.hypot(b.x-a.x,b.y-a.y),contrast:hi-lo,source:e.proof().source});}return out;});
 expect(p[0].source).toBe('spotlight');expect(p[1].source).toBe('window');
 expect(p[0].contrast).toBeGreaterThan(60);expect(p[0].width).toBeLessThanOrEqual(4);expect(p[1].width).toBeGreaterThanOrEqual(60);
});
test('radial reveal transfers actual input pixels and reaches both endpoints',async({page})=>{
 await open(page);const p=await page.evaluate(async()=>{const e=await FXDesign.create('dot-reveal'),sources=['#e02020','#2040e0'].map(color=>{const c=document.createElement('canvas');c.width=1280;c.height=720;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,1280,720);return c;});let ends=[];
 for(const progress of [0,1]){e.frame(0,{progress,from:sources[0],to:sources[1],labels:false});ends.push(e.canvas.toDataURL()===sources[progress].toDataURL());}
 e.frame(0,{progress:.35,from:sources[0],to:sources[1],labels:false});const pixels=e.canvas.getContext('2d').getImageData(0,0,1280,720).data;let red=0,blue=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]>200)red++;if(pixels[i+2]>200)blue++;}
 // the gallery loop goes night -> day -> night
 const dirs=[];for(const t of [1,3.5]){e.frame(t,{labels:false});dirs.push(e.proof().direction);}return{ends,red,blue,dirs};});
 expect(p.ends).toEqual([true,true]);expect(p.red).toBeGreaterThan(10000);expect(p.blue).toBeGreaterThan(10000);expect(p.dirs).toEqual(['night-to-day','day-to-night']);
});
test('letter reflow never holds still for more than a second',async({page})=>{
 await open(page);const longest=await page.evaluate(async()=>{const e=await FXDesign.create('letter-flow');let prev=null,run=0,max=0;
  for(let i=0;i<=96;i++){e.frame(i*.05,{labels:false});const d=e.canvas.toDataURL();if(d===prev){run+=.05;max=Math.max(max,run);}else run=0;prev=d;}return max;});
 expect(longest).toBeLessThanOrEqual(1);
});
test('type ring: the camera passes through the centre of the ring',async({page})=>{
 await open(page);const p=await page.evaluate(async()=>{const e=await FXDesign.create('type-orbit'),out=[];for(const t of [2.4,4.3,6]){e.frame(t,{labels:false});out.push(e.proof());}return out;});
 expect(p[0].wrap).toBeGreaterThan(.99);expect(p[0].inside).toBe(false);expect(p[1].inside).toBe(true);expect(p[2].inside).toBe(false);
});
test('FXDesign.create passes options through: type-orbit takes its own words',async({page})=>{
 await open(page);const p=await page.evaluate(async()=>{const e=await FXDesign.create('type-orbit',{message:'HELLO RING · '});e.frame(2.4,{labels:false});const d=await FXDesign.create('type-orbit');d.frame(2.4,{labels:false});return [e.proof().message,d.proof().message];});
 expect(p[0]).toBe('HELLO RING · ');expect(p[1]).not.toBe(p[0]);
});
test('dot choreography is continuous and the spring has one sampler',async({page})=>{
 await open(page);const p=await page.evaluate(async()=>{const {dotAt,BEATS}=await import('/fx/design/films.js'),{springPoint,drawSpring}=await import('/fx/design/flat.js');const times=Object.values(BEATS);const jumps=times.map(t=>{const a=dotAt(t-.0001),b=t===BEATS.end?dotAt(0):dotAt(t+.0001);return Math.hypot(a.x-b.x,a.y-b.y,a.r-b.r);});const c=document.createElement('canvas');c.width=1280;c.height=720;const config={damping:.8,x0:100,x1:800,y0:600,target:200,duration:2.4,labels:false};const a=springPoint(1,config),b=drawSpring(c.getContext('2d'),1,config);return{jumps,a,b,BEATS};});
 expect(Math.max(...p.jumps)).toBeLessThan(1);expect(p.a).toEqual(p.b);
 expect(p.BEATS.trace-p.BEATS.read).toBeLessThanOrEqual(1.2+1e-9);expect(p.BEATS.card-p.BEATS.settle).toBeCloseTo(1.5,5);expect(p.BEATS.end).toBeGreaterThan(13.5);expect(p.BEATS.end).toBeLessThan(14.5);
});
for(const id of ['dot-story','ink-city','shadow-lab'])test(`${id} film seeks exactly with valid sound sections`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`/examples/${id}.html`);const p=await page.evaluate(async()=>{await __ready;await __record();const c=document.querySelector('#film');await __render(1.1);const a=c.toDataURL();await __render(__DUR*.75);const b=c.toDataURL();await __render(1.1);let repeat=a===c.toDataURL();for(const t of [6.5,12.6,14.4,16.8]){await __render(Math.min(t,__DUR));await __render(1.1);repeat=repeat&&a===c.toDataURL();}await __render(0);const first=c.toDataURL();await __render(__DUR);return{repeat,moves:a!==b,loop:first===c.toDataURL(),sections:__music.map(x=>x[0]),duration:__DUR};});
 expect(p.repeat).toBe(true);expect(p.moves).toBe(true);expect(new Set(p.sections).size).toBe(p.sections.length);expect(p.sections).toEqual([...p.sections].sort((a,b)=>a-b));expect(Math.max(...p.sections)).toBeLessThan(p.duration);if(id==='dot-story')expect(p.loop).toBe(true);
 if(id==='dot-story')expect(p.duration).toBeCloseTo(14.1,5);if(id==='ink-city')expect(p.duration).toBe(12);expect(errors).toEqual([]);
});
test('dot story shows no overshoot readout; ink city starts growing at once and keeps sky and street in the run',async({page})=>{
 await page.goto('/');const p=await page.evaluate(async()=>{const {createFilm}=await import('/fx/design/films.js');const city=createFilm('ink-city');const at=t=>{city.frame(t);return city.proof();};
  const start=[at(0).buildings,at(.6).buildings];const street=[];for(let t=5.4;t<=8.6;t+=.4){city.frame(t);const g=city.canvas.getContext('2d');const top=g.getImageData(480,0,320,200).data,bottom=g.getImageData(480,620,320,100).data;const clean=d=>{let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>205)n++;return n/(d.length/4);};street.push({t,inStreet:city.proof().street,sky:clean(top),ground:clean(bottom)});}
  const src=await (await fetch('/fx/design/films.js')).text();return{start,street,overshoot:/overshoot/.test(src.slice(src.indexOf('function createDotStory')))};});
 expect(p.overshoot).toBe(false);expect(p.start[1]).toBeGreaterThan(p.start[0]);
 // open sky in the top centre and open road in the bottom centre throughout the street run
 for(const s of p.street){expect(s.inStreet,String(s.t)).toBe(true);expect(s.sky,`sky at ${s.t}`).toBeGreaterThan(.4);expect(s.ground,`road at ${s.t}`).toBeGreaterThan(.6);}
});
test('ink city: the title sits on its own caption box, so no tower runs through it',async({page})=>{
 await page.goto('/');const p=await page.evaluate(async()=>{const {createFilm}=await import('/fx/design/films.js');const city=createFilm('ink-city'),g=city.canvas.getContext('2d'),rows=[];
  // The caption's left margin (inside the box, left of the words): plain paper while the towers rise behind it.
  for(const t of [.3,1,1.5,2,2.5,6,10.6,11.2,11.9]){city.frame(t);const d=g.getImageData(34,40,10,30).data;let paper=0;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-242)<6&&Math.abs(d[i+1]-238)<6&&Math.abs(d[i+2]-229)<6)paper++;rows.push({t,paper:paper/(d.length/4)});}
  return rows;});
 for(const r of p)expect(r.paper,`caption margin at ${r.t} s`).toBeGreaterThan(.98);
});
