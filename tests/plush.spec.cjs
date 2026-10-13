const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.join(__dirname,'..');
// A blank page with the three.js r180 import map; modules are imported inside page.evaluate.
const HARNESS='<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"}}</script><body style="margin:0;background:#000">';
async function harness(page){await page.route('**/__plush-harness.html',r=>r.fulfill({contentType:'text/html',body:HARNESS}));await page.goto('/__plush-harness.html');}

test('CC0 textures match their manifest',()=>{
 const m=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/plush/manifest.json')));
 expect(m.files.length).toBe(5);
 for(const f of m.files){
  expect(f.license).toBe('CC0 1.0');expect(f.url).toMatch(/^https:\/\/dl\.polyhaven\.org\//);
  expect(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'assets/plush',f.file))).digest('hex')).toBe(f.sha256);
 }
});

test('nine mouth shapes stay distinct at gallery-tile size, with a large face and a wide-open D',async({page})=>{
 await harness(page);
 const r=await page.evaluate(async()=>{
  const T=await import('three'),{createStage}=await import('/fx/plush/stage.js'),{createPlushBear,VISEMES}=await import('/fx/plush/bear.js'),{loadPhotoSet}=await import('/fx/plush/textures.js'),{mouthMask,maskIoU,maskStats}=await import('/fx/plush/board.js');
  const W=382,H=215,stage=createStage({width:W,height:H,set:'bedroom'}),bear=createPlushBear({features:'all',photo:await loadPhotoSet(),viewHeight:H});stage.scene.add(bear.root);
  // The lip-sync film's close-up framing (fx/dialogue/lipsync.js bearCam at rest).
  const cam=stage.camera;cam.position.set(-.46,1.26,2.62);cam.fov=30;cam.aspect=W/H;cam.updateProjectionMatrix();cam.lookAt(-.066,1.165,0);cam.updateMatrixWorld();
  const ids=Object.keys(VISEMES),masks={},stats={};
  for(const id of ids){bear.pose({face:{mouth:VISEMES[id]}});bear.root.updateMatrixWorld(true);masks[id]=mouthMask(stage.renderer,cam,bear,W,H);stats[id]=maskStats(masks[id]);}
  let worst={v:0},worstLabelled=0;
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const o=maskIoU(masks[ids[i]],masks[ids[j]]);if(o.silhouette>worst.v)worst={v:o.silhouette,pair:ids[i]+ids[j]};worstLabelled=Math.max(worstLabelled,o.labelled);}
  // Face height: the head's top and chin projected through the same camera.
  bear.pose({});bear.root.updateMatrixWorld(true);const head=bear.head.getWorldPosition(new T.Vector3());
  const y=v=>(1-v.project(cam).y)/2*H,top=y(head.clone().add(new T.Vector3(0,.51,0))),chin=y(head.clone().add(new T.Vector3(0,-.51,0)));
  stage.dispose();bear.dispose();
  return{worst,worstLabelled,stats,face:(chin-top)/H,count:ids.length};
 });
 expect(r.count).toBe(9);
 expect(r.worst.v,JSON.stringify(r.worst)).toBeLessThan(.7);expect(r.worstLabelled).toBeLessThan(.7);
 expect(r.face).toBeGreaterThanOrEqual(.45);
 expect(r.stats.D.open).toBeGreaterThanOrEqual(20);
 for(const k of 'BCDEFGH')expect(r.stats[k].open,k).toBeGreaterThan(0);
 expect(r.stats.X.open+r.stats.A.open).toBe(0);
});

test('plush-fur effect: seekable, never blank, and anticipation, impact, aftermath in order',async({page})=>{
 await harness(page);
 const r=await page.evaluate(async()=>{
  const {createPlushFur,TIMING,PERIOD}=await import('/fx/plush/effect.js'),e=await createPlushFur({width:320,height:180});
  const g=document.createElement('canvas').getContext('2d',{willReadFrequently:true});g.canvas.width=320;g.canvas.height=180;
  const mean=()=>{g.drawImage(e.canvas,0,0);const d=g.getImageData(0,0,320,180).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2];return s/(d.length/4*3);};
  const means=[],phases=[];for(let t=0;t<PERIOD;t+=.25){e.frame(t);means.push(mean());phases.push(e.proof().phase);}
  e.frame(2.85);const a=e.canvas.toDataURL(),hero=e.proof();e.frame(3.4);e.frame(.3);e.frame(2.85);const b=e.canvas.toDataURL();
  e.frame(4.6);const after=e.proof();e.frame(PERIOD+2.85);const wrapped=e.canvas.toDataURL();
  // The fur force is exposed for other solvers: setting it changes the uniform.
  const fp=e.bear.furParts[0];e.bear.setFurForce(()=>({x:1,y:2,z:3,isVector3:true}));const set=fp.uniforms.uForce.value.toArray();
  e.dispose();
  return{min:Math.min(...means),same:a===b,wrapped:a===wrapped,hero,after,phases,shake:TIMING.shake,set};
 });
 expect(r.min).toBeGreaterThan(15);expect(r.same).toBe(true);expect(r.wrapped).toBe(true);
 expect(r.hero.brush).toBe(1);expect(r.hero.drawn).toBe(1);expect(r.after.brush).toBe(0);
 const order=[...new Set(r.phases)];expect(order).toEqual(['anticipation','impact','aftermath']);
 expect(r.set).toEqual([1,2,3]);
});

test('fur features switch independently and the shader compiles for each',async({page})=>{
 await harness(page);
 const r=await page.evaluate(async()=>{
  const T=await import('three'),{furFeatures,furMaterial,furPart,ellipsoid}=await import('/fx/plush/fur.js');
  const renderer=new T.WebGLRenderer();renderer.setSize(64,64);const scene=new T.Scene(),cam=new T.PerspectiveCamera(30,1,.1,10);cam.position.z=3;scene.add(new T.DirectionalLight('#fff',2));
  const keys=[];for(const spec of ['none','fins','strands','shadow','soft','all']){const f=furFeatures(spec);keys.push(f.key);const p=furPart(scene,ellipsoid(.5,.5,.5,null,24,18),furMaterial({features:f,jaw:true,brush:true}),{strands:200});renderer.render(scene,cam);scene.remove(p.group);}
  const gl=renderer.getContext(),err=gl.getError();renderer.dispose();return{keys,err};
 });
 expect(r.keys).toEqual(['base','fins','strands','shadow','soft','fins+strands+shadow+soft+photo']);expect(r.err).toBe(0);
});

test('plush-fur is registered as a gallery demo when its pack is loaded',async({page})=>{
 await page.goto('/');await page.waitForFunction(()=>window.galleryAPI);
 const registered=await page.evaluate(()=>FX.DEMOS.some(d=>d.id==='plush-fur'));
 test.skip(!registered,'index.html does not load fx/pack-plush.js yet (registration is left to the integration step)');
 await page.evaluate(()=>galleryAPI.pause());
 const r=await page.evaluate(async()=>{const {stage}=await galleryAPI.draw('plush-fur',2.85);const c=stage.querySelector('canvas');return{width:stage.getBoundingClientRect().width,ratio:c.width/c.height,error:stage.querySelector('.oops')?.textContent||null};});
 expect(r.error).toBe(null);expect(r.ratio).toBeCloseTo(16/9,2);
});
