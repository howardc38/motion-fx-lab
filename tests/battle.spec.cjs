const {test,expect}=require('@playwright/test');
async function open(page){await page.goto('/examples/dot-battle.html');await page.evaluate(async()=>{await __ready;await __record();});}
test('misses have no impact cues; actual contacts meet the opposing body or guard',async({page})=>{
 await open(page);const p=await page.evaluate(async()=>{await __render(.6);return {events:filmEffect.proof().contacts,cues:__cues()};});
 for(const e of p.events){
  const at=p.cues.filter(c=>Math.abs(c.t-e.t)<1e-5);
  if(e.kind==='dodge'){expect(e.distance).toBeGreaterThan(80);expect(at).toEqual([]);}
  else {expect(e.distance,`contact at ${e.t}`).toBeLessThan(45);expect(at).toHaveLength(1);}
 }
 for(const t of [4.2,6.6,11.4]){const v=await page.evaluate(async t=>{await __render(t);return filmEffect.proof().activeImpact;},t);expect(v).toBeNull();}
});
test('contact hold decouples camera time and pose time; limb lengths stay fixed through steps',async({page})=>{
 await open(page);const p=await page.evaluate(async()=>{
  await __render(7.9);const a=filmEffect.proof();await __render(8.25);const b=filmEffect.proof();
  const m=await import('/fx/studio/battle.js'),motion=m.createChoreography(),lengths=[];
  for(let t=0;t<18;t+=.11)for(let id=0;id<2;id++){
   const {p}=motion.pose(id,t),d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
   lengths.push([d([p[0]+13,p[1]],p.slice(18,20)),d(p.slice(18,20),p.slice(20,22)),d([p[2]+17,p[3]+10],p.slice(10,12)),d(p.slice(10,12),p.slice(12,14))]);
  }
  const planted=[.26,.30].map(t=>{const v=motion.pose(1,t);return {x:v.x-v.p[20],y:v.p[21]};});
  return {a,b,lengths,planted};
 });
 p.planted.forEach(foot=>{expect(foot.x).toBeCloseTo(805,5);expect(foot.y).toBeCloseTo(602,5);});
 expect(p.a.sourceTime).toBe(7.8);expect(p.a.poses).toEqual(p.b.poses);expect(p.a.camera).not.toEqual(p.b.camera);
 for(const l of p.lengths)l.forEach((v,i)=>expect(v).toBeCloseTo([105,117,85,85][i],4));
});
test('all eight dot demos use the rebuilt fight and keep their distinct temporal or spatial operation',async({page})=>{
 await page.goto('/examples/studio.html');await page.waitForFunction(()=>window.studio?.current);
 const p=await page.evaluate(async()=>{
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const asset=await new GLTFLoader().loadAsync('/assets/studio/fighter.glb');
  const names=[];asset.scene.traverse(o=>{if(o.isSkinnedMesh)names.push(o.name);});
  const ids=['video-dots','freeze-orbit','echo','particle-lens','dot-impact','time-remap','depth-dots','skin-cloud'],out=[];
  for(const id of ids){const e=await FXStudio.create(id);await e.frame(.7);const first=e.canvas.toDataURL();await e.frame(3.35);const later=e.canvas.toDataURL();await e.frame(.7);out.push({id,moves:first!==later,repeat:first===e.canvas.toDataURL(),proof:e.proof()});}
  return {names,clips:asset.animations.map(c=>c.name),out};
 });
 expect(p.names.sort()).toEqual(['Amber','Teal']);expect(p.clips.sort()).toEqual(['Amber','Teal']);
 for(const r of p.out){expect(r.moves,r.id).toBe(true);expect(r.repeat,r.id).toBe(true);}
 for(const id of ['freeze-orbit','particle-lens','skin-cloud'])expect(p.out.find(e=>e.id===id).proof.choreography).toBe('COUNTERFORM');
});
test('eight-treatment film is exportable and seeks every chapter without stale canvases',async({page})=>{
 await page.goto('/examples/fight-effects.html');
 const p=await page.evaluate(async()=>{await __ready;await __record();const frames=[];for(const t of [.7,3.7,6.7,9.7,12.7,15.7,18.7,21.7]){await __render(t);frames.push(document.querySelector('#film').toDataURL());}await __render(.7);return {duration:__DUR,cues:__cues().length,unique:new Set(frames).size,repeat:frames[0]===document.querySelector('#film').toDataURL()};});
 expect(p).toEqual({duration:24,cues:7,unique:8,repeat:true});
});
test('the full 3D orbit keeps both fighters inside the camera frame',async({page})=>{
 await page.goto('/examples/studio.html');await page.waitForFunction(()=>window.studio?.current);
 const bounds=await page.evaluate(async()=>{const {duel}=await import('/fx/studio/scene.js');const THREE=await import('three');const rig=await duel(true);const out=[];for(let t=0;t<6;t+=.375){rig.frame(t,{mode:'orbit'});const cloud=rig.scene.children.find(o=>o.isPoints),a=cloud.geometry.attributes.position,v=new THREE.Vector3();let maxX=0,maxY=0;for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).project(rig.camera);maxX=Math.max(maxX,Math.abs(v.x));maxY=Math.max(maxY,Math.abs(v.y));}out.push({t,maxX,maxY});}return out;});
 for(const b of bounds){expect(b.maxX,`horizontal crop at ${b.t}`).toBeLessThan(.98);expect(b.maxY,`vertical crop at ${b.t}`).toBeLessThan(.98);}
});
