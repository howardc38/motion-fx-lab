const {test,expect}=require('@playwright/test');
async function open(page){await page.goto('/');await page.waitForFunction(()=>window.galleryAPI);await page.evaluate(()=>galleryAPI.pause());}
test('design studies move, seek backwards and survive interleaved renderer use',async({page})=>{
 await open(page);const rows=await page.evaluate(async()=>{
 const effects=await Promise.all(FXDesign.studies.map(s=>FXDesign.create(s.id))),out=[];
 for(let i=0;i<effects.length;i++){const e=effects[i];e.frame(1.1);const a=e.canvas.toDataURL();e.frame(2.6);const b=e.canvas.toDataURL();effects[(i+1)%effects.length].frame(4);e.frame(1.1);out.push({id:FXDesign.studies[i].id,moves:a!==b,repeats:a===e.canvas.toDataURL()});}return out;});
 for(const r of rows){expect(r.moves,r.id).toBe(true);expect(r.repeats,r.id).toBe(true);}
});
test('hatching stays on the object and responds independently to the light',async({page})=>{
 await open(page);const p=await page.evaluate(async()=>{const e=await FXDesign.create('surface-ink'),pixels=()=>e.canvas.getContext('2d').getImageData(0,0,1280,720).data;
 e.frame(0,{objectAngle:0,cameraAngle:0,debugPattern:true,labels:false});const a=pixels();e.frame(0,{objectAngle:.8,cameraAngle:.8,debugPattern:true,labels:false});const b=pixels();let changed=0,dark=0;for(let i=0;i<a.length;i+=4){if(a[i]<160)dark++;if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>40)changed++;}
 e.frame(0,{objectAngle:0,lightAngle:0,labels:false});const c=e.canvas.toDataURL();e.frame(0,{objectAngle:0,lightAngle:3,labels:false});return{changed,dark,relights:c!==e.canvas.toDataURL()};});
 expect(p.dark).toBeGreaterThan(1000);expect(p.changed).toBeLessThan(1000);expect(p.relights).toBe(true);
});
test('larger light source creates a wider partially occluded ground band',async({page})=>{
 await open(page);const p=await page.evaluate(async()=>{const e=await FXDesign.create('soft-shadow'),out=[];
 for(const size of [.08,2.8]){e.frame(0,{lightSize:size,height:1.4,labels:false});const g=e.canvas.getContext('2d');let partial=0,shadow=0;for(let i=0;i<400;i++){const x=2.6*1.4/3.6-1.4+i/400*2.8,z=-1.7*1.4/3.6;const pt=e.project([x,.001,z]);const v=g.getImageData(Math.round(pt.x),Math.round(pt.y),1,1).data;if(v[0]>135&&v[0]<223)partial++;if(v[0]<135)shadow++;}out.push({partial,shadow});}return out;});
 expect(p[0].shadow).toBeGreaterThan(20);expect(p[1].partial).toBeGreaterThan(p[0].partial+30);
});
test('radial reveal transfers actual input pixels and reaches both endpoints',async({page})=>{
 await open(page);const p=await page.evaluate(async()=>{const e=await FXDesign.create('dot-reveal'),sources=['#e02020','#2040e0'].map(color=>{const c=document.createElement('canvas');c.width=1280;c.height=720;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,1280,720);return c;});let ends=[];
 for(const progress of [0,1]){e.frame(0,{progress,from:sources[0],to:sources[1],labels:false});ends.push(e.canvas.toDataURL()===sources[progress].toDataURL());}
 e.frame(0,{progress:.35,from:sources[0],to:sources[1],labels:false});const pixels=e.canvas.getContext('2d').getImageData(0,0,1280,720).data;let red=0,blue=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]>200)red++;if(pixels[i+2]>200)blue++;}return{ends,red,blue};});
 expect(p.ends).toEqual([true,true]);expect(p.red).toBeGreaterThan(10000);expect(p.blue).toBeGreaterThan(10000);
});
test('dot choreography is continuous and the spring has one sampler',async({page})=>{
 await open(page);const p=await page.evaluate(async()=>{const {dotAt}=await import('/fx/design/films.js'),{springPoint,drawSpring}=await import('/fx/design/flat.js');const jumps=[1.2,2.4,4.8,5.4,8.8,9.6,11.2,12,16.4,17.2,18,19.2].map(t=>{const a=dotAt(t-.0001),b=t===19.2?dotAt(0):dotAt(t+.0001);return Math.hypot(a.x-b.x,a.y-b.y,a.r-b.r);});const c=document.createElement('canvas');c.width=1280;c.height=720;const config={damping:.8,x0:100,x1:800,y0:600,target:200,duration:2.4,labels:false};const a=springPoint(1,config),b=drawSpring(c.getContext('2d'),1,config);return{jumps,a,b};});
 expect(Math.max(...p.jumps)).toBeLessThan(1);expect(p.a).toEqual(p.b);
});
for(const id of ['dot-story','ink-city','shadow-lab'])test(`${id} film seeks exactly with valid sound sections`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`/examples/${id}.html`);const p=await page.evaluate(async()=>{await __ready;await __record();const c=document.querySelector('#film');await __render(1.1);const a=c.toDataURL();await __render(__DUR*.75);const b=c.toDataURL();await __render(1.1);let repeat=a===c.toDataURL();for(const t of [6.5,12.6,14.4,16.8]){await __render(Math.min(t,__DUR));await __render(1.1);repeat=repeat&&a===c.toDataURL();}await __render(0);const first=c.toDataURL();await __render(__DUR);return{repeat,moves:a!==b,loop:first===c.toDataURL(),sections:__music.map(x=>x[0]),duration:__DUR};});
 expect(p.repeat).toBe(true);expect(p.moves).toBe(true);expect(new Set(p.sections).size).toBe(p.sections.length);expect(p.sections).toEqual([...p.sections].sort((a,b)=>a-b));expect(Math.max(...p.sections)).toBeLessThan(p.duration);if(id==='dot-story')expect(p.loop).toBe(true);expect(errors).toEqual([]);
});
