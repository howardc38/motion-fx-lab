import {THREE,stage} from './common.js';
import {C,W,H,TAU,time,title,text,clamp} from './math.js';
const vertex='varying vec3 vWorld;void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}';
const fragment=`
varying vec3 vWorld;uniform vec3 lightPosition;uniform vec3 ballPosition;uniform float lightSize;uniform float radius;
float noise(float n){return fract(sin(n*127.1+13.7)*43758.5453);}
void main(){
 float visibility=0.;
 for(int i=0;i<64;i++){
  float f=float(i);vec2 cell=(vec2(mod(f,8.),floor(f/8.))+vec2(.15+.7*noise(f),.15+.7*noise(f+83.)))/8.-.5;
  vec3 l=lightPosition+vec3(cell.x*lightSize,0.,cell.y*lightSize),ray=l-vWorld;float distance=length(ray);ray/=distance;
  vec3 oc=vWorld-ballPosition;float b=dot(oc,ray),c=dot(oc,oc)-radius*radius,det=b*b-c;float hit=det>0.?-b-sqrt(max(det,0.)):-1.;
  visibility+=hit>.001&&hit<distance?0.:1.;
 }
 visibility/=64.;vec3 paper=vec3(.885,.853,.795),ink=vec3(.035,.052,.06);vec2 grid=abs(fract(vWorld.xz*.5-.5)-.5)/max(fwidth(vWorld.xz*.5),vec2(.001));float line=1.-clamp(min(grid.x,grid.y),0.,1.);
 vec3 col=mix(ink,paper,.12+.88*visibility);col*=1.-line*.055;gl_FragColor=vec4(col,1.);
 #include <colorspace_fragment>
}`;
export function create(){
 const s=stage(C.paper);s.camera.position.set(7.3,6.3,10.2);s.camera.lookAt(0,2.2,0);
 const uniforms={lightPosition:{value:new THREE.Vector3(-2.6,5,1.7)},ballPosition:{value:new THREE.Vector3(0,1.15,0)},lightSize:{value:1},radius:{value:.58}};
 const mat=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment});
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),mat);floor.rotation.x=-Math.PI/2;s.scene.add(floor);
 const sphere=new THREE.Mesh(new THREE.SphereGeometry(.58,48,32),new THREE.MeshStandardMaterial({color:C.orange,roughness:.34,metalness:.15}));s.scene.add(sphere);
 s.scene.add(new THREE.AmbientLight('#fff1db',1.7));const point=new THREE.PointLight('#fff1dc',65,50,2);s.scene.add(point);
 const lamp=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:'#fa613d',side:THREE.DoubleSide}));lamp.rotation.x=-Math.PI/2;s.scene.add(lamp);
 const rim=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,.03,1)),new THREE.LineBasicMaterial({color:C.ink}));s.scene.add(rim);
 const guideGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);const guide=new THREE.Line(guideGeo,new THREE.LineDashedMaterial({color:C.orange,dashSize:.08,gapSize:.07,transparent:true,opacity:.5}));s.scene.add(guide);
 let proof;
 return{canvas:s.canvas,proof:()=>proof,project(p){const v=new THREE.Vector3(...p).project(s.camera);return{x:(v.x+1)*W/2,y:(1-v.y)*H/2};},frame(t,o={}){
  t=time(t);const size=o.lightSize??(.08+2.72*(.5-.5*Math.cos(TAU*t/6))),height=o.height??1.15,ly=o.lightHeight??5;
  if(![size,height,ly].every(Number.isFinite)||size<.02||size>4||height<.59||height>2||ly<3||ly>8)throw new Error('Light size/height outside the study range');
  uniforms.lightSize.value=size;uniforms.ballPosition.value.set(0,height,0);uniforms.lightPosition.value.set(-2.6,ly,1.7);sphere.position.copy(uniforms.ballPosition.value);point.position.copy(uniforms.lightPosition.value);lamp.position.copy(point.position);lamp.scale.set(size,size,1);rim.position.copy(point.position);rim.scale.set(size,1,size);
  const arr=guideGeo.attributes.position;arr.setXYZ(0,0,height,0);arr.setXYZ(1,0,0,0);arr.needsUpdate=true;guide.computeLineDistances();s.render();
  if(o.labels!==false){title(s.g,'The source shapes the shadow.','Sampled area-light visibility');text(s.g,`SOURCE WIDTH  ${size.toFixed(2)}`,48,630,22);text(s.g,`OBJECT HEIGHT  ${height.toFixed(2)}`,48,666,22);}
  proof={lightSize:size,height,lightHeight:ly,samples:64,method:'deterministic rectangular-emitter visibility / sphere occluder',shadowCenter:[2.6*height/(ly-height),0,-1.7*height/(ly-height)]};
 }};
}
