// Geometric checks use the drawn geometry and world transforms. This is a bounded
// assembly/kinematics audit, not a general mesh collision detector or an FEA solver.
import {DRIVE,signedArea,sectionPolygons} from './model.js';
const dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const point=(obj,p=[0,0,0])=>obj.localToWorld(obj.position.clone().set(...p)).toArray();
export function segmentBoxDistance(a,b,box){
 const at=t=>a.map((x,i)=>x+(b[i]-x)*t),f=t=>at(t).reduce((s,x,i)=>s+Math.max(box.min[i]-x,0,x-box.max[i])**2,0);
 let lo=0,hi=1;for(let i=0;i<45;i++){const x=lo+(hi-lo)/3,y=hi-(hi-lo)/3;if(f(x)<f(y))hi=y;else lo=x}return Math.sqrt(Math.min(f(0),f(1),f((lo+hi)/2)));
}
export function boundaryEdges(position,tolerance=1e-5){
 const key=p=>p.map(x=>Math.round(x/tolerance)).join(','),edges=new Map();
 for(let i=0;i<position.length;i+=9){const a=position.slice(i,i+3),b=position.slice(i+3,i+6),c=position.slice(i+6,i+9),ab=a.map((x,j)=>b[j]-x),ac=a.map((x,j)=>c[j]-x),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];if(Math.hypot(...cross)<tolerance*tolerance)continue;
  const ks=[key(a),key(b),key(c)];for(let k=0;k<3;k++){const e=[ks[k],ks[(k+1)%3]].sort().join('|');if(ks[k]!==ks[(k+1)%3])edges.set(e,(edges.get(e)||0)+1)}
 }
 return[...edges].filter(([,count])=>count!==2);
}
export function auditSection(profile,z){
 const polygons=sectionPolygons(profile,z),errors=[];
 for(const polygon of polygons){if(!polygon.flat().every(Number.isFinite))errors.push('non-finite section');if(Math.abs(signedArea(polygon))<1e-12&&polygon.some(p=>Math.abs(p[0])>1e-6))errors.push('collapsed section');if(polygon.some(p=>Math.abs(p[2]-z)>1e-9))errors.push('section left its plane');}
 return{errors,polygons:polygons.length,area:polygons.reduce((n,p)=>n+Math.abs(signedArea(p)),0)};
}
export function auditEffect(effect,{includeTopology=false}={}){
 const subject=effect.subject,proof=effect.proof(),checks=[];
 subject.root.updateMatrixWorld(true);
 function check(id,value,limit,note){checks.push({id,status:Number.isFinite(value)&&value<=limit?'PASS':'FAIL',value,limit,note});}
 const maxX=Math.max(...proof.bounds.map(p=>Math.abs(p[0]))),maxY=Math.max(...proof.bounds.map(p=>Math.abs(p[1])));
 check('camera.horizontal',maxX,.94,'Projected world bounds, including all separated assemblies');check('camera.vertical',maxY,.83,'Reserved upper and lower bands');
 if(proof.mode==='linkage'){
  const {rod,pin,wrist,driver,output,pistonBody,barrel}=subject;
  const low=point(rod,[0,-DRIVE.rod/2,0]),high=point(rod,[0,DRIVE.rod/2,0]);
  check('link.pin',dist(low,point(pin)),.0001,'Rendered rod eye coincides with the crank pin');
  check('link.wrist',dist(high,point(wrist)),.0001,'Rendered rod eye coincides with the wrist pin');
  check('link.length',Math.abs(dist(low,high)-DRIVE.rod),.00001,'Constant connecting-rod length under the actual mesh transform');
  const r0=subject.root.getObjectByName('20-tooth input').geometry.userData.pitchRadius,r1=subject.root.getObjectByName('40-tooth output').geometry.userData.pitchRadius;
  check('gear.center-distance',Math.abs(dist(point(driver),point(output))-(r0+r1)),.00001,'Pitch circles meet at their actual centre distance');
  check('gear.ratio-phase',Math.abs(driver.rotation.z+Math.PI/20+2*output.rotation.z),.00001,'Opposite 20:40 rotation with a tooth-gap phase offset');
  const needle=subject.needle,np=needle.geometry.attributes.position;let tip=[0,-Infinity,0];for(let i=0;i<np.count;i++)if(np.getY(i)>tip[1])tip=[np.getX(i),np.getY(i),np.getZ(i)];
  const origin=point(needle),end=point(needle,tip),actualAngle=Math.atan2(end[1]-origin[1],end[0]-origin[0]),expectedAngle=Math.PI*1.25-proof.outputRpm/60*Math.PI*1.5;
  check('tachometer.angle',Math.abs(Math.atan2(Math.sin(actualAngle-expectedAngle),Math.cos(actualAngle-expectedAngle))),.0001,'Actual needle tip points to the displayed output RPM on the drawn dial');
  let radius=0;const p=pistonBody.geometry.attributes.position;for(let i=0;i<p.count;i++)radius=Math.max(radius,Math.hypot(p.getX(i),p.getZ(i)));
  const bore=Math.min(...barrel.geometry.userData.profile.map(p=>p[0]));check('piston.bore',radius-bore,-.006,'Positive radial clearance; wrist bosses and intentional front-section protrusions excluded');
  const tubeStart=subject.tube.geometry.userData.curve.getPointAt(0).toArray(),tubeEnd=subject.tube.geometry.userData.curve.getPointAt(1).toArray();
  check('tube.head-port',dist(tubeStart,[.17,2.71,-.03]),.00001,'Tube seats at the cylinder-head fitting');check('tube.gauge-port',dist(tubeEnd,[.86,2.45,-.06]),.00001,'Tube seats at the rear gauge fitting');
  const obstacles=subject.named.filter(m=>['Upright','Bearing plate'].includes(m.name));
  for(const [name,tube,radius] of [['copper',subject.tube,.034],['cable',subject.cable,.023]]){
   const curve=tube.geometry.userData.curve;let clearance=Infinity;
   for(const obstacle of obstacles){obstacle.geometry.computeBoundingBox();const b=obstacle.geometry.boundingBox,min=point(obstacle,b.min.toArray()),max=point(obstacle,b.max.toArray()),box={min:min.map((v,i)=>Math.min(v,max[i])),max:min.map((v,i)=>Math.max(v,max[i]))};
    for(let i=0;i<79;i++){const a=curve.getPointAt(i/80).toArray(),b=curve.getPointAt((i+1)/80).toArray();clearance=Math.min(clearance,segmentBoxDistance(a,b,box)-radius);}
   }
   check('route.'+name,-clearance,.0005,'Tube capsule versus static frame boxes; terminal hardware has named intended contacts');
  }
 }else{
  const angles=subject.fanAngles;check('fan.pitch',Math.max(...angles.map((a,i)=>Math.abs((i===angles.length-1?Math.PI*2:angles[i+1])-a-Math.PI*2/angles.length))),.00001,'The merged nineteen-blade row retains the full twenty-blade pitch');
  // A radial half-shell leaving into its own half-space cannot approach the shaft.
  for(const shell of subject.shells){const sign=shell.userData.shell.sign;check('shell.outward.'+shell.name,-shell.position.z*sign,.00001,'Closed shell half leaves radially into its own half-space');
   if(includeTopology)check('shell.closed.'+shell.name,boundaryEdges(Array.from(shell.geometry.attributes.position.array)).length,0,'Welded triangle-edge incidence, including the actual closing faces');
  }
  const fan=subject.parts.find(p=>p.name==='Fan'),spinner=subject.parts.find(p=>p.name==='Spinner');
  check('service.withdraw-direction',fan.base.y-fan.obj.position.y,.00001,'Fan only withdraws towards the open intake');
  if(fan.obj.position.y-fan.base.y>.02){check('service.outer-first',1-proof.shares.outer,.00001,'Outer halves clear before the fan withdraws');check('service.spinner-first',1-proof.shares.spinner,.00001,'Spinner leaves before the fan');}
  if(spinner.obj.position.y>spinner.base.y+.02)check('service.core-first',1-proof.shares.core,.00001,'Core halves clear before the nose assembly');
  for(const cap of effect.caps){const result=auditSection(cap.profile,proof.cutZ);check('cap.profile',result.errors.length,0,'Section loops are derived from the same radius/axis profile as the housing');
   const p=cap.mesh.geometry.attributes.position;let planeError=0;for(let i=0;i<(p?.count??0);i++)planeError=Math.max(planeError,Math.abs(p.getZ(i)-proof.cutZ-.00015));check('cap.plane',planeError,.000002,'Actual section triangles stay on the declared plane, with the depth offset');}
 }
 return{mode:proof.mode,time:proof.time,checks,failed:checks.filter(c=>c.status==='FAIL'),coverage:['actual transform linkage and pin alignment','gear centre spacing and phase','registered pipe routes and terminals','radial shell travel and service order','closed shell topology','profile-derived section faces','camera bounds'],notClaimed:['general triangle-mesh collision certification','gear-tooth contact stresses or manufacturing tolerance','CFD or FEA','every internal turbofan interface','visual taste or listening quality']};
}
