const {test,expect}=require('@playwright/test');
for(const [mode,key,low,high]of [['assembly','explode',0,1],['cutaway','cutZ',2.1,-.2],['linkage','rpm',0,54]]){
 test(`${mode}: its control changes the picture and an out-of-order seek restores it`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/examples/mechanical-'+mode+'.html');await page.evaluate(()=>window.__ready);
  const result=await page.evaluate(({key,low,high})=>{
   const e=window.__effect,copy=document.createElement('canvas');copy.width=96;copy.height=54;const g=copy.getContext('2d',{willReadFrequently:true});
   const pixels=()=>{g.clearRect(0,0,96,54);g.drawImage(e.canvas,0,0,96,54);return Array.from(g.getImageData(0,0,96,54).data)};
   e.frame(3.17,{[key]:low,labels:false});const a=pixels(),pa=e.proof();e.frame(3.17,{[key]:high,labels:false});const b=pixels(),pb=e.proof();
   e.frame(12.3);e.frame(.2);e.frame(3.17,{[key]:low,labels:false});const c=pixels();let changed=0,error=0;
   for(let i=0;i<a.length;i+=4){if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>30)changed++;error+=Math.abs(a[i]-c[i])+Math.abs(a[i+1]-c[i+1])+Math.abs(a[i+2]-c[i+2]);}
   return{changed,meanRepeatError:error/(96*54*3),pa,pb,fps:window.__FPS};
  },{key,low,high});
  expect(result.changed).toBeGreaterThan(35);expect(result.meanRepeatError).toBeLessThan(.1);expect(result.fps).toBe(60);
  if(mode==='cutaway'){expect(result.pa.caps).toBe(0);expect(result.pb.caps).toBeGreaterThan(0)}
  if(mode==='assembly'){expect(result.pa.amount).toBe(0);expect(result.pb.amount).toBe(1)}
  if(mode==='linkage'){expect(result.pa.outputRpm).toBe(0);expect(result.pb.outputRpm).toBe(27)}
  const field=mode==='assembly'?'amount':key,chosen=mode==='assembly'?1:mode==='cutaway'?2.1:90;
  await page.locator('#parameter').press('End');await page.locator('#play').click();
  await expect.poll(()=>page.evaluate(field=>window.__effect.proof()[field],field)).toBe(chosen);
  await page.evaluate(async()=>{await window.__record();await window.__render(6)});await expect(page.locator('nav')).toBeHidden();
  expect(await page.evaluate(field=>window.__effect.proof()[field],field)).not.toBe(chosen);expect(errors).toEqual([]);
 });
}
