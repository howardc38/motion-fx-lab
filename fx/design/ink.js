import {THREE,stage} from './common.js';
import {C,W,H,TAU,hash,time,title,text,phase,mix} from './math.js';
const vertex=`varying vec3 vObject;varying vec3 vLocalNormal;varying vec3 vViewNormal;varying float vDepth;void main(){vObject=position;vLocalNormal=normal;vViewNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);vDepth=-p.z;gl_Position=projectionMatrix*p;}`;
const fragment=`
varying vec3 vObject;varying vec3 vLocalNormal;varying vec3 vViewNormal;varying float vDepth;
uniform vec3 ink;uniform vec3 paper;uniform vec3 lightView;uniform vec3 dimensions;uniform float strength;uniform float frequency;uniform float debugPattern;uniform float facade;
float stripe(float x,float width){float d=abs(fract(x)-.5),aa=max(fwidth(x),.008);return 1.-smoothstep(width-aa,width+aa,d);}
float hatch(vec2 p,float darkness){float a=stripe((p.x+p.y)*frequency,.105),b=stripe((p.x-p.y)*frequency,.083);return max(a*smoothstep(.08,.5,darkness),b*smoothstep(.48,.85,darkness));}
void main(){
 float light=clamp(dot(normalize(vViewNormal),normalize(lightView))*.55+.46,0.,1.);float dark=mix(1.-light,.72,debugPattern);
 vec3 weights=pow(abs(normalize(vLocalNormal)),vec3(8.));weights/=max(dot(weights,vec3(1.)),.001);
 float marks=dot(vec3(hatch(vObject.yz,dark),hatch(vObject.xz,dark),hatch(vObject.xy,dark)),weights);
 vec3 base=paper*(.62+.38*light),printed=mix(paper,ink,marks);vec3 col=mix(base,printed,strength);
 if(debugPattern>.5)col=mix(vec3(.92),vec3(.04),marks);
 if(facade>.5&&abs(vLocalNormal.y)<.3){vec2 p=abs(vLocalNormal.z)>.5?vObject.xy+dimensions.xy*.5:vObject.zy+dimensions.zy*.5;vec2 q=fract(p/vec2(.65,.85));float win=step(.2,q.x)*step(q.x,.72)*step(.2,q.y)*step(q.y,.74)*step(.35,p.y);col=mix(col,ink,win*.92);}
 col=mix(col,paper,smoothstep(20.,65.,vDepth)*.6);gl_FragColor=vec4(col,1.);
 #include <colorspace_fragment>
}`;
export function inkMaterial(paper=C.paper,{facade=false,dimensions=[1,1,1]}={}){
 return new THREE.ShaderMaterial({uniforms:{ink:{value:new THREE.Color(C.ink)},paper:{value:new THREE.Color(paper)},lightView:{value:new THREE.Vector3()},dimensions:{value:new THREE.Vector3(...dimensions)},strength:{value:1},frequency:{value:7},debugPattern:{value:0},facade:{value:facade?1:0}},vertexShader:vertex,fragmentShader:fragment});
}
function setInk(material,camera,light,o={}){material.uniforms.lightView.value.copy(light).transformDirection(camera.matrixWorldInverse);material.uniforms.strength.value=o.strength??1;material.uniforms.debugPattern.value=o.debugPattern?1:0;material.uniforms.frequency.value=o.frequency??7;}
function edges(mesh){const l=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,26),new THREE.LineBasicMaterial({color:C.ink}));mesh.add(l);return mesh;}
// A turned vase: curved surfaces show how the hatching follows the form.
function vaseGeometry(){
 const prof=[[.001,-1.25],[.36,-1.25],[.42,-1.17],[.38,-1.04],[.52,-.86],[.8,-.48],[.92,-.1],[.86,.26],[.66,.56],[.42,.82],[.31,1.],[.33,1.13],[.46,1.24],[.47,1.3],[.001,1.3]];
 const curve=new THREE.SplineCurve(prof.map(([r,y])=>new THREE.Vector2(r,y)));
 return new THREE.LatheGeometry(curve.getPoints(90).map(p=>new THREE.Vector2(Math.max(.001,p.x),p.y)),96);
}
function inkHull(geometry,width=.022){
 return new THREE.Mesh(geometry,new THREE.ShaderMaterial({side:THREE.BackSide,uniforms:{ink:{value:new THREE.Color(C.ink)}},vertexShader:`void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*${width.toFixed(3)},1.);}`,fragmentShader:'uniform vec3 ink;void main(){gl_FragColor=vec4(ink,1.);\n#include <colorspace_fragment>\n}'}));
}
export function create(){
 const s=stage(C.paper),material=inkMaterial(),group=new THREE.Group();s.scene.add(group);group.scale.setScalar(1.3);
 const geo=vaseGeometry(),vase=new THREE.Mesh(geo,material);group.add(vase,inkHull(geo));
 // The lamp is in the scene: its position is the light the hatching responds to.
 const lamp=new THREE.Mesh(new THREE.SphereGeometry(.13,32,20),new THREE.MeshBasicMaterial({color:C.orange}));s.scene.add(lamp);
 const light=new THREE.Vector3(),baseCamera=new THREE.Vector3(0,1.9,7.4);let proof;
 return{canvas:s.canvas,proof:()=>proof,frame(t,o={}){t=time(t);const a=o.objectAngle??t*.24,ca=o.cameraAngle??.35*Math.sin(t*TAU/8),la=o.lightAngle??(t*TAU/8+2.2);
  group.rotation.set(0,a,0);s.camera.position.copy(baseCamera).applyAxisAngle(new THREE.Vector3(0,1,0),ca);s.camera.lookAt(0,.15,0);s.camera.updateMatrixWorld();
  light.set(Math.cos(la)*2.7,1.5+.6*Math.sin(la*2),Math.sin(la)*2.7);lamp.position.copy(light);lamp.visible=!o.debugPattern;
  setInk(material,s.camera,light,{frequency:6,...o});s.render();
  if(lamp.visible){
   // hand-drawn rays around the bulb, hidden when the vase is in front of it
   const v=light.clone().project(s.camera),x=(v.x+1)*W/2,y=(1-v.y)*H/2,front=light.clone().applyMatrix4(s.camera.matrixWorldInverse).z>-s.camera.position.length()+.3||Math.abs(x-W/2)>150;
   if(front){s.g.save();s.g.strokeStyle=C.ink;s.g.lineWidth=4;s.g.lineCap='round';for(let i=0;i<10;i++){const r=i*TAU/10+t*.6;s.g.beginPath();s.g.moveTo(x+Math.cos(r)*30,y+Math.sin(r)*30);s.g.lineTo(x+Math.cos(r)*(46+6*Math.sin(t*3+i)),y+Math.sin(r)*(46+6*Math.sin(t*3+i)));s.g.stroke();}s.g.restore();}
  }
  if(o.labels!==false){title(s.g,'Light writes on the surface.','Object-space hatching');text(s.g,'Move the lamp: the ink follows the light. The marks stay on the vase.',48,670,22,C.muted);}
  proof={objectAngle:a,cameraAngle:ca,lightAngle:la,lamp:light.toArray(),patternSpace:'object',strength:o.strength??1,subject:'lathe vase'};
 }};
}
function box(parent,materials,w,h,d,x,y,z,color,facade=false){const mat=inkMaterial(color,{facade,dimensions:[w,h,d]});materials.push(mat);const m=edges(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat));m.position.set(x,y,z);parent.add(m);return m;}
function sign(parent,label,w,h,x,y,z,ry=0,bg=C.ink,fg=C.paper){const c=document.createElement('canvas');c.width=512;c.height=192;const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,512,192);g.fillStyle=fg;g.font='900 104px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(label,256,102);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));p.position.set(x,y,z);p.rotation.y=ry;parent.add(p);}
// The film's words sit on a printed caption box (paper, ink rule, offset ink shadow), so the towers
// that grow up behind them never run through the type.
function caption(g,w,h){g.save();g.fillStyle=C.ink;g.fillRect(38,30,w,h);g.fillStyle=C.paper;g.fillRect(30,22,w,h);g.lineWidth=3;g.strokeStyle=C.ink;g.strokeRect(31.5,23.5,w-3,h-3);g.restore();}
let measure;const textWidth=(str,size)=>{measure??=document.createElement('canvas').getContext('2d');measure.font=`700 ${size}px Arial`;return Math.ceil(measure.measureText(str).width);};
export function createCity(){
 const s=stage(C.paper),materials=[],buildings=[],light=new THREE.Vector3(),ground=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.MeshBasicMaterial({color:'#e5dfd1'}));ground.rotation.x=-Math.PI/2;s.scene.add(ground);
 const grid=new THREE.GridHelper(68,68,C.ink,C.ink);grid.position.y=.003;grid.material.transparent=true;grid.material.opacity=.09;s.scene.add(grid);
 // Vermilion sun disc + ink halo ring framing the grand boulevard vista
 const sunGroup=new THREE.Group();sunGroup.position.set(2.25,10.2,-42);s.scene.add(sunGroup);
 sunGroup.add(new THREE.Mesh(new THREE.CircleGeometry(4.1,64),new THREE.MeshBasicMaterial({color:C.orange})));
 sunGroup.add(new THREE.Mesh(new THREE.RingGeometry(4.45,4.68,64),new THREE.MeshBasicMaterial({color:C.ink})));
 for(let z=-2;z<=2;z++)for(let x=-2;x<=2;x++){
  const i=(z+2)*5+x+2,group=new THREE.Group();
  // Widen the grand avenue between x=0 and x=1 so the street sweep frames stepped towers + open sky/road
  const bx=x*3.35+(x>=1?1.55:-.30),bz=z*3.55;
  const hTotal=2.0+hash(i+7)*4.8,w=1.52+hash(i+27)*.54,d=1.48+hash(i+88)*.48;
  const podiumH=hTotal*.56,midH=hTotal*.30,crownH=hTotal*.18;
  const isAccent=i%5===0||i===8||i===18;
  group.position.set(bx,0,bz);s.scene.add(group);buildings.push(group);
  // Stepped Art-Deco podium + cornice
  box(group,materials,w,podiumH,d,0,podiumH/2,0,i%5===0?C.orange:C.paper,true);
  box(group,materials,w+.10,.12,d+.10,0,podiumH+.06,0,C.ink);
  // Setback mid-tier + cornice + vermilion spandrel accent
  const mw=w*.76,md=d*.76,my=podiumH+.12;
  box(group,materials,mw,midH,md,0,my+midH/2,0,isAccent&&i%5!==0?C.orange:C.paper,true);
  box(group,materials,mw+.08,.10,md+.08,0,my+midH+.05,0,C.ink);
  // Stepped crown lantern + spire / water tower
  const cw=w*.46,cd=d*.48,cy=my+midH+.10;
  box(group,materials,cw,crownH,cd,.08,cy+crownH/2,0,C.paper);
  if(i%3===0){const tankMat=inkMaterial(C.paper);materials.push(tankMat);const tank=edges(new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.58,16),tankMat));tank.position.set(-.30,cy+.34,.18);group.add(tank);}
  else if(i%3===1&&hTotal>4.2){box(group,materials,.09,.95,.09,.08,cy+crownH+.47,0,C.ink);}
  const word=['INK','MOVE','TYPE','STUDIO','DRAW','LINE'][i%6];
  if(i%4===0)sign(group,word,w*.84,.50,0,podiumH*.68,d/2+.025,0,i%8===0?C.orange:C.ink,C.paper);
  if(x===0)sign(group,word,d*.76,.46,w/2+.025,podiumH*.66,0,Math.PI/2,i%2===0?C.orange:C.ink,C.paper);
  if(x===1)sign(group,word,d*.76,.46,-w/2-.025,podiumH*.66,0,-Math.PI/2,i%2===1?C.orange:C.ink,C.paper);
 }
 // Grow the city, sweep along the wide sunlit boulevard (sky + vermilion sun above, open avenue below), bank round the corner, rise wide.
 const PATH=[[0,[5.9,3.6,7.2],[-.3,2.6,0]],[2.4,[11.2,8.6,14.2],[.4,1.6,0]],[4.2,[5.8,4.0,13.4],[2.25,2.3,3.5]],[5.2,[2.10,1.55,11.2],[2.25,2.45,1.2]],[6.2,[2.38,1.50,6.6],[2.20,2.65,-3.6]],[7.2,[2.12,1.50,1.8],[2.28,2.80,-8.4]],[8.2,[2.28,1.55,-2.8],[2.25,2.95,-13.0]],[9,[2.35,2.2,-8.8],[6.8,2.5,-6.4]],[9.8,[7.8,4.8,-11.8],[3.2,2.2,-2]],[10.8,[13.6,8.8,-11.4],[2.2,1.5,-1]],[12,[16.0,11.8,-12.8],[.6,1.1,0]]];
 const posCurve=new THREE.CatmullRomCurve3(PATH.map(k=>new THREE.Vector3(...k[1])),false,'centripetal'),aimCurve=new THREE.CatmullRomCurve3(PATH.map(k=>new THREE.Vector3(...k[2])),false,'centripetal');
 function u(t){if(t<=0)return 0;if(t>=12)return 1;let i=0;while(t>PATH[i+1][0])i++;const k=(t-PATH[i][0])/(PATH[i+1][0]-PATH[i][0]);return(i+k)/(PATH.length-1);}
 let proof;
 return{canvas:s.canvas,proof:()=>proof,frame(t,o={}){t=time(t);const travel=phase(t,5.2,9);
  buildings.forEach((b,i)=>{const isHero=i===12;const g=isHero?1:phase(t,-.25+hash(i)*1.2,1.1+hash(i)*1.6);b.scale.set(1,Math.max(.001,g),1);b.visible=g>.001;});
  sunGroup.visible=t>3.6&&t<9.5;
  const p=u(Math.min(12,t));s.camera.fov=38+12*phase(t,4.6,5.4)*(1-phase(t,8.4,9.6));s.camera.updateProjectionMatrix();s.camera.position.copy(posCurve.getPoint(p));s.camera.lookAt(aimCurve.getPoint(p));s.camera.updateMatrixWorld();light.set(Math.cos(t*.35+.4)*4.6,6.8,Math.sin(t*.35+.4)*4.6);
  for(const m of materials)setInk(m,s.camera,light,{strength:1,frequency:9.5});s.render();
  if(o.labels!==false){if(t<2.6||t>10.4){const head=t<2.6?'A city grows from one block.':'INK / CITY',sub='One block. A drawn city.';caption(s.g,Math.max(textWidth(head,38),textWidth(sub.toUpperCase(),15))+38,100);title(s.g,head,sub);}else{caption(s.g,textWidth('INK / CITY',25)+38,58);text(s.g,'INK / CITY',48,61,25);}}
  proof={buildings:buildings.filter(b=>b.visible).length,travel,inkStrength:1,camera:s.camera.position.toArray(),street:t>5.2&&t<9,light:[light.x,light.y,light.z]};
 }};
}
