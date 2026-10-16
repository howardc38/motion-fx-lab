import {THREE,GEO,MAT} from './vendor.js';
import {closedLathe} from './geometry.js';
import {DRIVE,mechanismAt,TAU} from './model.js';
// A complete, original geared reciprocating demonstrator. Pin centres and the
// rendered rod use the same dimensions as the analytic slider-crank model.
export function createMechanism(){
 const root=new THREE.Group(),named=[];
 const steel=MAT.steel({roughness:.24}),brass=MAT.brass({roughness:.24}),chrome=MAT.chrome({roughness:.15}),dark=MAT.anodised({color:[.085,.105,.12]}),al=MAT.aluminiumMachined({roughness:.27}),red=MAT.paint({color:[.7,.10,.045]}),copper=MAT.copper({roughness:.27});
 function mesh(g,m,parent=root,name){const o=new THREE.Mesh(g,m);parent.add(o);o.castShadow=true;o.receiveShadow=true;if(name){o.name=name;named.push(o)}return o;}
 function disc(r,h,m,x,y,z,parent=root,axis='z'){const o=mesh(GEO.disc(r,h,Math.min(.008,h*.12),64),m,parent);o.position.set(x,y,z);if(axis==='z')o.rotation.x=Math.PI/2;return o;}
 function hex(x,y,z,r=.026,h=.035,parent=root){const o=mesh(new THREE.CylinderGeometry(r,r,h,6),chrome,parent);o.rotation.x=Math.PI/2;o.position.set(x,y,z);const recess=disc(r*.42,h*.16,dark,x,y,z+h*.55,parent);return o;}
 function bolts(cx,cy,z,n,r,parent=root){for(let i=0;i<n;i++){const a=i/n*TAU;hex(cx+r*Math.cos(a),cy+r*Math.sin(a),z,.022,.036,parent)}}
 const base=mesh(GEO.rbox(2.7,.16,1.22,.055),dark,root,'Base');base.position.set(-.05,.16,-.05);
 const top=mesh(GEO.rbox(2.56,.035,1.10,.035),al);top.position.copy(base.position).add(new THREE.Vector3(0,.097,0));
 for(const x of [-1.12,1.05])for(const z of [-.48,.40]){const f=mesh(GEO.disc(.085,.13,.015,48),MAT.rubber());f.position.set(x,.065,z);hex(x,.275,z,.035,.045);}
 for(const x of [-.98,.96]){
  const beam=mesh(GEO.rbox(.16,2.32,.20,.025),al,root,'Upright');beam.position.set(x,1.44,-.36);
  const foot=mesh(GEO.rbox(.34,.12,.44,.02),dark);foot.position.set(x,.32,-.32);
  for(let i=0;i<2;i++)hex(x+(i-.5)*.19,.33,.05,.028,.04);
 }
 const cross=mesh(GEO.rbox(2.13,.15,.23,.025),al);cross.position.set(-.01,2.69,-.36);
 const deck=mesh(GEO.rbox(1.84,1.18,.10,.045),dark,root,'Bearing plate');deck.position.set(-.11,1.03,-.18);
 for(const [x,y] of [[-.63,DRIVE.baseY],[0,DRIVE.baseY]]){
  disc(.135,.16,al,x,y,-.05);disc(.097,.18,chrome,x,y,.01);disc(.061,.20,brass,x,y,.04);bolts(x,y,.08,6,.115);
 }
 const driver=new THREE.Group();driver.position.set(-.63,DRIVE.baseY,.10);root.add(driver);
 const output=new THREE.Group();output.position.set(0,DRIVE.baseY,.10);root.add(output);
 mesh(GEO.gear({teeth:20,module:DRIVE.module,width:.085,bore:.052,rim:.035,spokes:4}),steel,driver,'20-tooth input');
 mesh(GEO.gear({teeth:40,module:DRIVE.module,width:.095,bore:.064,rim:.055,spokes:6}),brass,output,'40-tooth output');
 disc(.083,.13,chrome,0,0,0,driver);disc(.10,.14,steel,0,0,0,output);
 for(const parent of [driver,output])bolts(0,0,.09,6,.075,parent);
 const flywheel=disc(.155,.08,dark,-.63,DRIVE.baseY,-.34);bolts(-.63,DRIVE.baseY,-.4,8,.12);
 // Piston barrel: a closed half-section with fins and an actual bore wall.
 const barrel=mesh(closedLathe([[.232,1.66],[.32,1.66],[.32,2.60],[.232,2.60]],96,Math.PI/2,Math.PI),al,root,'Sectioned cylinder');
 for(let i=0;i<12;i++)mesh(closedLathe([[.319,1.75+i*.067],[.385,1.75+i*.067],[.385,1.774+i*.067],[.319,1.774+i*.067]],96,Math.PI/2,Math.PI),i%3?al:dark);
 const head=mesh(GEO.disc(.34,.12,.014,96),al,root,'Cylinder head');head.position.set(0,2.65,0);
 for(let i=0;i<6;i++){const a=i/6*TAU;const bolt=mesh(new THREE.CylinderGeometry(.028,.028,.05,6),chrome);bolt.position.set(.282*Math.cos(a),2.735,.282*Math.sin(a));}
 const piston=new THREE.Group();root.add(piston);piston.name='Piston';
 const pistonBody=mesh(GEO.lathe([[0,-.13],[.205,-.13],[.219,-.10],[.219,.09],[.208,.13],[0,.13]],96),al,piston);
 for(let i=0;i<3;i++){const ring=mesh(GEO.tube(.223,.216,.013,96),steel,piston);ring.position.y=.058-i*.031;}
 disc(.072,.46,chrome,0,-.035,.02,piston);
 const wrist=disc(.095,.06,brass,0,-.035,.26,piston);bolts(0,-.035,.301,4,.064,piston);
 // Machined I-section rod, with two real bored eyes and shoulders, not a stretched cuboid.
 const L=DRIVE.rod,r=.105,w=.057,shape=new THREE.Shape();
 shape.moveTo(-r,-L/2);shape.absarc(0,-L/2,r,Math.PI,0,false);shape.lineTo(w,L/2-.11);shape.absarc(0,L/2,r,0,Math.PI,false);shape.lineTo(-w,-L/2+.11);shape.closePath();
 for(const y of [-L/2,L/2]){const hole=new THREE.Path();hole.absarc(0,y,.055,0,TAU,true);shape.holes.push(hole);}
 const rod=mesh(GEO.extrude(shape,.075,.009),al,root,'Connecting rod');
 for(const y of [-L/2,L/2]){disc(.074,.09,brass,0,y,0,rod);disc(.045,.11,chrome,0,y,.01,rod);}
 const pin=disc(.069,.12,chrome,0,0,.16,output);pin.position.y=DRIVE.crank;disc(.045,.13,red,0,DRIVE.crank,.19,output);
 // Input motor: turned housing, vent ribs, visible cabling and routed copper pipe.
 const motor=mesh(GEO.disc(.24,.34,.025,96),dark,root,'Drive motor');motor.rotation.x=Math.PI/2;motor.position.set(-.63,DRIVE.baseY,-.53);
 for(let i=0;i<9;i++){const fin=disc(.255,.018,al,-.63,DRIVE.baseY,-.69+i*.038);}
 const cablePts=[[-.78,.94,-.68],[-1.15,.78,-.70],[-1.19,.50,-.52],[-1.19,.42,-.36],[-1.094,.42,-.36]];
 const cable=mesh(GEO.pipe(cablePts,.023,{seg:64,radial:12}),MAT.rubber());
 const grommet=mesh(GEO.disc(.059,.035,.004,48),dark);grommet.rotation.z=Math.PI/2;grommet.position.set(-1.075,.42,-.36);
 const tubePts=[[.17,2.71,-.03],[.40,2.89,-.08],[.72,2.87,-.11],[.86,2.69,-.15],[.86,2.45,-.15],[.86,2.45,-.06]];
 const tube=mesh(GEO.pipe(tubePts,.034,{seg:80,radial:16}),copper,root,'Copper instrument line');
 disc(.064,.085,brass,...tubePts[0],root,'y');disc(.053,.12,brass,.86,2.45,-.12);
 // Output tachometer with enamel face, calibrated tick marks and a real moving needle.
 const dial=new THREE.Group();dial.position.set(.86,2.28,.02);root.add(dial);
 disc(.30,.16,dark,0,0,0,dial);disc(.278,.025,chrome,0,0,.1,dial);
 const texCanvas=document.createElement('canvas');texCanvas.width=texCanvas.height=1024;const cg=texCanvas.getContext('2d');cg.fillStyle='#ece9dc';cg.fillRect(0,0,1024,1024);cg.strokeStyle='#222722';cg.textAlign='center';cg.textBaseline='middle';
 for(let i=0;i<=60;i++){const a=Math.PI*1.25-i/60*Math.PI*1.5,r0=i%10===0?350:i%5===0?375:392,r1=420;cg.lineWidth=i%10===0?8:3;cg.beginPath();cg.moveTo(512+Math.cos(a)*r0,512-Math.sin(a)*r0);cg.lineTo(512+Math.cos(a)*r1,512-Math.sin(a)*r1);cg.stroke();if(i%10===0){cg.font='52px Arial';cg.fillText(String(i),512+Math.cos(a)*290,512-Math.sin(a)*290)}}
 cg.font='42px Arial';cg.fillText('OUTPUT',512,630);cg.font='32px Arial';cg.fillText('RPM  /  2:1',512,686);
 const tex=new THREE.CanvasTexture(texCanvas);tex.colorSpace=THREE.SRGBColorSpace;
 const face=mesh(new THREE.CircleGeometry(.258,96),new THREE.MeshBasicMaterial({map:tex}),dial);face.position.z=.121;
 const needle=mesh(new THREE.ConeGeometry(.012,.225,3),red,dial);needle.position.z=.14;needle.geometry.translate(0,.095,0);disc(.031,.022,chrome,0,0,.16,dial);
 // A small etched scale follows the piston travel.
 const ruler=mesh(GEO.rbox(.075,.93,.018,.004),al);ruler.position.set(.48,2.14,.02);
 for(let i=0;i<31;i++){const tick=mesh(new THREE.BoxGeometry(i%5===0?.049:.024,.003,.003),dark);tick.position.set(.48,1.70+i*.028,.032);}
 function pose(t,o={}){
  const s=mechanismAt(t,o.rpm);driver.rotation.z=s.theta-Math.PI/20;output.rotation.z=s.crankAngle;flywheel.rotation.y=s.theta;
  piston.position.set(0,s.sliderY+.035,0);
  const a=new THREE.Vector3(...s.pin),b=new THREE.Vector3(...s.wrist);rod.position.copy(a).add(b).multiplyScalar(.5);rod.position.z=.26;rod.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());
  needle.rotation.z=(Math.PI*1.25-s.outputRpm/60*Math.PI*1.5)-Math.PI/2;
  return s;
 }
 root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
 return{root,driver,output,piston,pistonBody,rod,pin,wrist,needle,barrel,head,grommet,tube,cable,named,tubePts,cablePts,pose,drive:DRIVE};
}
