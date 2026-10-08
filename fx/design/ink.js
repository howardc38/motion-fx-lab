import {THREE,stage} from './common.js';
import {C,W,H,TAU,hash,time,title,text,phase,mix} from './math.js';
const vertex=`varying vec3 vObject;varying vec3 vLocalNormal;varying vec3 vViewNormal;varying float vDepth;void main(){vObject=position;vLocalNormal=normal;vViewNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);vDepth=-p.z;gl_Position=projectionMatrix*p;}`;
const fragment=`
varying vec3 vObject;varying vec3 vLocalNormal;varying vec3 vViewNormal;varying float vDepth;
uniform vec3 ink;uniform vec3 paper;uniform vec3 lightView;uniform vec3 dimensions;uniform float strength;uniform float frequency;uniform float debugPattern;uniform float facade;
float stripe(float x,float width){float d=abs(fract(x)-.5),aa=max(fwidth(x),.008);return 1.-smoothstep(width-aa,width+aa,d);}
float hatch(vec2 p,float darkness){float a=stripe((p.x+p.y)*frequency,.07),b=stripe((p.x-p.y)*frequency,.055);return max(a*smoothstep(.08,.5,darkness),b*smoothstep(.48,.85,darkness));}
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
export function create(){
 const s=stage(C.paper),material=inkMaterial(),group=new THREE.Group();s.scene.add(group);group.scale.setScalar(1.3);
 const knot=new THREE.Mesh(new THREE.TorusKnotGeometry(.82,.27,128,24),material);group.add(knot);const light=new THREE.Vector3(),baseCamera=new THREE.Vector3(3.4,2.2,6.3);let proof;
 return{canvas:s.canvas,proof:()=>proof,frame(t,o={}){t=time(t);const a=o.objectAngle??t*.24,ca=o.cameraAngle??0,la=o.lightAngle??(t*.55+2.2);
  group.rotation.set(0,a,0);s.camera.position.copy(baseCamera).applyAxisAngle(new THREE.Vector3(0,1,0),ca);s.camera.lookAt(0,0,0);s.camera.updateMatrixWorld();light.set(Math.cos(la)*3,4,Math.sin(la)*3);setInk(material,s.camera,light,o);s.render();
  if(o.labels!==false){title(s.g,'Light writes on the surface.','Object-space hatching');text(s.g,'The camera moves. The marks belong to the object.',48,670,22,C.muted);}
  proof={objectAngle:a,cameraAngle:ca,lightAngle:la,patternSpace:'object',strength:o.strength??1};
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
 const aerial=new THREE.Vector3(13,9,16),entry=new THREE.Vector3(1.6,4.8,12),exit=new THREE.Vector3(1.6,4.8,-8),finish=new THREE.Vector3(15,15,18);
 let proof;
 return{canvas:s.canvas,proof:()=>proof,frame(t,o={}){t=time(t);const grown=phase(t,2.4,6),travel=phase(t,6,15.6),end=phase(t,15.6,18.4);
  buildings.forEach((b,i)=>{const isHero=i===12;const u=isHero?1:phase(t,2.6+hash(i)*1.0,5.2+hash(i)*1.1);b.scale.set(1,Math.max(.001,u),1);b.visible=u>.001;});
  const start=new THREE.Vector3(8,6,10),target=new THREE.Vector3(0,2,0);
  if(t<6)s.camera.position.copy(start).lerp(aerial,grown);
  else if(t<8){const u=phase(t,6,8);s.camera.position.copy(aerial).lerp(entry,u);target.lerp(new THREE.Vector3(1.6,4.1,8),u);}
  else if(t<14.4){const u=(t-8)/6.4;s.camera.position.copy(entry).lerp(exit,u);target.set(1.6,4.1,s.camera.position.z-4);}
  else{s.camera.position.copy(finish).applyAxisAngle(new THREE.Vector3(0,1,0),(t-14.4)*.045);target.set(0,1,0);}
  s.camera.lookAt(target);s.camera.updateMatrixWorld();light.set(Math.cos(t*.23)*4,7,Math.sin(t*.23)*4);
  for(const m of materials)setInk(m,s.camera,light,{strength:phase(t,.7,2.2),frequency:10});s.render();
  if(o.labels!==false){if(t<6||t>17){title(s.g,t<2.4?'A block takes the light.':t<6?'A city grows from it.':'INK / CITY','One block. A drawn city.');}else{s.g.fillStyle=C.paper;s.g.fillRect(32,24,190,48);text(s.g,'INK / CITY',48,57,25);}}
  proof={buildings:buildings.filter(b=>b.visible).length,travel,inkStrength:phase(t,.7,2.2),light:[light.x,light.y,light.z]};
 }};
}
