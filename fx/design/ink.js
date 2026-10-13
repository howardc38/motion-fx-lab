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
function sign(parent,label,w,h,x,y,z){const c=document.createElement('canvas');c.width=512;c.height=192;const g=c.getContext('2d');g.fillStyle=C.ink;g.fillRect(0,0,512,192);g.fillStyle=C.paper;g.font='900 108px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(label,256,104);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex}));p.position.set(x,y,z);parent.add(p);}
export function createCity(){
 const s=stage(C.paper),materials=[],buildings=[],light=new THREE.Vector3(),ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshBasicMaterial({color:'#e5dfd1'}));ground.rotation.x=-Math.PI/2;s.scene.add(ground);
 const grid=new THREE.GridHelper(60,60,C.ink,C.ink);grid.position.y=.003;grid.material.transparent=true;grid.material.opacity=.09;s.scene.add(grid);
 for(let z=-2;z<=2;z++)for(let x=-2;x<=2;x++){
  const i=(z+2)*5+x+2,group=new THREE.Group(),height=1.8+hash(i+7)*4.3,w=1.55+hash(i+27)*.55,d=1.5+hash(i+88)*.5;
  group.position.set(x*3.2,0,z*3.2);s.scene.add(group);buildings.push(group);
  box(group,materials,w,height,d,0,height/2,0,i%5===0?C.orange:C.paper,true);
  box(group,materials,w+.08,.14,d+.08,0,height+.07,0,C.ink);
  box(group,materials,w*.42,.45,d*.5,.15,height+.38,0,C.paper);
  if(i%3===0){const tankMat=inkMaterial(C.paper);materials.push(tankMat);const tank=edges(new THREE.Mesh(new THREE.CylinderGeometry(.27,.27,.6,16),tankMat));tank.position.set(-.35,height+.45,.2);group.add(tank);}
  if(i%4===0)sign(group,['INK','MOVE','TYPE','STUDIO'][Math.floor(i/4)%4],w*.86,.55,0,height*.65,d/2+.025);
 }
 // Grow the city, drop into a street (sky above, road below), bank round the far corner, rise wide.
 const PATH=[[0,[6.2,3.6,7.2],[0,2.6,0]],[2.4,[11,8.5,14],[0,1.5,0]],[4.2,[5.6,4.2,13],[1.6,2,4]],[5.2,[1.6,1.3,10.5],[1.6,2.2,2]],[6.2,[1.6,1.25,6],[1.6,2.4,-3]],[7.2,[1.6,1.25,1.5],[1.6,2.5,-7.5]],[8.2,[1.6,1.3,-3],[1.6,2.6,-12]],[9,[1.6,2,-8.8],[6.4,2.4,-6.4]],[9.8,[7.2,4.6,-11.5],[3,2.2,-2]],[10.8,[13,8.5,-11],[2,1.5,-1]],[12,[15.5,11.5,-12.5],[0,1,0]]];
 const posCurve=new THREE.CatmullRomCurve3(PATH.map(k=>new THREE.Vector3(...k[1])),false,'centripetal'),aimCurve=new THREE.CatmullRomCurve3(PATH.map(k=>new THREE.Vector3(...k[2])),false,'centripetal');
 function u(t){if(t<=0)return 0;if(t>=12)return 1;let i=0;while(t>PATH[i+1][0])i++;const k=(t-PATH[i][0])/(PATH[i+1][0]-PATH[i][0]);return(i+k)/(PATH.length-1);}
 let proof;
 return{canvas:s.canvas,proof:()=>proof,frame(t,o={}){t=time(t);const travel=phase(t,5.2,9);
  buildings.forEach((b,i)=>{const isHero=i===12;const g=isHero?1:phase(t,-.25+hash(i)*1.2,1.1+hash(i)*1.6);b.scale.set(1,Math.max(.001,g),1);b.visible=g>.001;});
  const p=u(Math.min(12,t));s.camera.fov=38+14*phase(t,4.6,5.4)*(1-phase(t,8.4,9.6));s.camera.updateProjectionMatrix();s.camera.position.copy(posCurve.getPoint(p));s.camera.lookAt(aimCurve.getPoint(p));s.camera.updateMatrixWorld();light.set(Math.cos(t*.35)*4,7,Math.sin(t*.35)*4);
  for(const m of materials)setInk(m,s.camera,light,{strength:1,frequency:10});s.render();
  if(o.labels!==false){if(t<2.6||t>10.4){title(s.g,t<2.6?'A city grows from one block.':'INK / CITY','One block. A drawn city.');}else{s.g.fillStyle=C.paper;s.g.fillRect(32,24,190,48);text(s.g,'INK / CITY',48,57,25);}}
  proof={buildings:buildings.filter(b=>b.visible).length,travel,inkStrength:1,camera:s.camera.position.toArray(),street:t>5.2&&t<9,light:[light.x,light.y,light.z]};
 }};
}
