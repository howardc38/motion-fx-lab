// Check rendered model transforms, registered geometry, service order and reverse seeks.
// The report keeps the measured coverage and limitations. Positive controls mutate the
// actual objects after posing: a failed control makes the checker itself fail.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('@playwright/test');
const {serve}=require('../video/serve.cjs');
async function main(){
 const at=process.argv.indexOf('--out'),out=path.resolve(at>=0?process.argv[at+1]:'video/stills/mechanical-review/geometry.json');
 const server=await serve(),browser=await chromium.launch({args:['--use-angle=metal']}),reports=[];
 try{
  for(const mode of ['assembly','cutaway','linkage']){
   const page=await browser.newPage({viewport:{width:1920,height:1080}});await page.goto(server.origin+'/examples/mechanical-'+mode+'.html');await page.evaluate(()=>window.__ready);
   const report=await page.evaluate(async()=>{
    const {auditEffect}=await import('/fx/mechanical/audit.js'),e=window.__effect,failures=[],worst={},controls=[];
    const times=[...Array.from({length:145},(_,i)=>i/10),...[1.8,2.4,4.8,6.6,9,12.6].flatMap(t=>[t-.01,t+.01])].sort((a,b)=>a-b);
    for(const [i,t] of times.entries()){
     e.frame(t,{auditOnly:true});const r=auditEffect(e,{includeTopology:i===0});
     for(const c of r.checks){if(!worst[c.id]||c.value>worst[c.id].value)worst[c.id]={...c,time:t};if(c.status==='FAIL')failures.push({...c,time:t});}
    }
    // Geometry and readings must be independent of the previous requested time.
    e.frame(7.2,{auditOnly:true});const a=JSON.stringify(e.proof());e.frame(1.1,{auditOnly:true});e.frame(13.8,{auditOnly:true});e.frame(7.2,{auditOnly:true});
    const replay=JSON.stringify(e.proof())===a;if(!replay)failures.push({id:'reverse-seek',status:'FAIL'});
    const initial=auditEffect(e);
    if(initial.mode==='linkage'){
     e.subject.rod.position.x+=.08;const r=auditEffect(e);controls.push({fault:'rod displaced 80 mm',caught:r.failed.some(c=>c.id.startsWith('link.'))});e.subject.rod.position.x-=.08;
     e.subject.output.position.x+=.04;const q=auditEffect(e);controls.push({fault:'gear centres displaced 40 mm',caught:q.failed.some(c=>c.id==='gear.center-distance')});e.subject.output.position.x-=.04;
     e.subject.needle.rotation.z+=.2;controls.push({fault:'tachometer needle miscalibrated',caught:auditEffect(e).failed.some(c=>c.id==='tachometer.angle')});e.subject.needle.rotation.z-=.2;
    }else{
     const shell=e.subject.shells.find(s=>s.userData.shell.sign===1),saved=shell.position.z;shell.position.z=-.1;controls.push({fault:'near shell moves through centreline',caught:auditEffect(e).failed.some(c=>c.id.startsWith('shell.outward'))});shell.position.z=saved;
     if(initial.mode==='cutaway'){const cap=e.caps.find(c=>c.mesh.visible),p=cap.mesh.geometry.attributes.position,old=p.getZ(0);p.setZ(0,old+.02);controls.push({fault:'section vertex leaves the cut plane',caught:auditEffect(e).failed.some(c=>c.id==='cap.plane')});p.setZ(0,old);}
    }
    return{mode:initial.mode,samples:times.length,reverseSeek:replay,worst,failures,positiveControls:controls,coverage:initial.coverage,notClaimed:initial.notClaimed};
   });
   reports.push(report);console.log(`${mode}: ${report.samples} poses, ${report.failures.length} failures, ${report.positiveControls.filter(x=>x.caught).length}/${report.positiveControls.length} positive controls caught`);await page.close();
  }
 }finally{await browser.close();await server.close();}
 const passed=reports.every(r=>!r.failures.length&&r.reverseSeek&&r.positiveControls.every(c=>c.caught));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({passed,reports},null,2)+'\n');console.log(out);if(!passed)process.exitCode=1;
}
main().catch(e=>{console.error(e.stack);process.exitCode=1});
