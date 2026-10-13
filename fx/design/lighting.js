import {THREE,stage} from './common.js';
import {C,W,H,TAU,time,title,text,clamp} from './math.js';
// The emitter is a horizontal rectangle at (LIGHT.x, lightHeight, LIGHT.z): a pinpoint
// spotlight at the small end of its range, a large skylight window at the other.
export const LIGHT={x:-2.2,z:-1.6};
const vertex='varying vec3 vWorld;void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}';
const fragment=`
varying vec3 vWorld;uniform vec3 lightPosition;uniform vec3 ballPosition;uniform float lightSize;uniform float radius;uniform vec3 paperColor;
float noise(float n){return fract(sin(n*127.1+13.7)*43758.5453);}
float h2(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
void main(){
 // 10 x 10 stratified samples; a per-pixel offset inside each cell turns banding into fine grain.
 float visibility=0.;vec2 jitter=vec2(h2(floor(gl_FragCoord.xy)),h2(floor(gl_FragCoord.yx)+7.));
 for(int i=0;i<100;i++){
  float f=float(i);vec2 cell=(vec2(mod(f,10.),floor(f/10.))+mix(vec2(.5),jitter,.9))/10.-.5;
  vec3 l=lightPosition+vec3(cell.x*lightSize,0.,cell.y*lightSize),ray=l-vWorld;float distance=length(ray);ray/=distance;
  vec3 oc=vWorld-ballPosition;float b=dot(oc,ray),c=dot(oc,oc)-radius*radius,det=b*b-c;float hit=det>0.?-b-sqrt(max(det,0.)):-1.;
  visibility+=hit>.001&&hit<distance?0.:1.;
 }
 visibility/=100.;
 vec3 lit=vec3(.97,.9,.79),shade=vec3(.24,.3,.37);
 float pool=exp(-dot(vWorld.xz-lightPosition.xz,vWorld.xz-lightPosition.xz)/70.);
 vec3 col=mix(shade,lit,visibility)*(.72+.38*pool);
 float far=smoothstep(13.,24.,length(vWorld-cameraPosition));
 col=mix(col,paperColor,far);
 gl_FragColor=vec4(col,1.);
 #include <colorspace_fragment>
}`;
function windowTexture(){
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
 const rg=g.createRadialGradient(128,128,10,128,128,180);rg.addColorStop(0,'#fffdf5');rg.addColorStop(1,'#ffe7b8');g.fillStyle=rg;g.fillRect(0,0,256,256);
 g.fillStyle='#2b3134';g.fillRect(0,0,256,10);g.fillRect(0,246,256,10);g.fillRect(0,0,10,256);g.fillRect(246,0,10,256);g.fillRect(123,0,10,256);g.fillRect(0,123,256,10);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
function ballTexture(){
 const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');
 g.fillStyle=C.orange;g.fillRect(0,0,512,256);g.fillStyle='#fff3e2';g.fillRect(0,112,512,32);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export function create(){
 const s=stage(C.paper);s.camera.fov=40;s.camera.updateProjectionMatrix();
 const uniforms={lightPosition:{value:new THREE.Vector3(LIGHT.x,5,LIGHT.z)},ballPosition:{value:new THREE.Vector3(0,1.3,0)},lightSize:{value:1},radius:{value:.8},paperColor:{value:new THREE.Color(C.paper)}};
 const mat=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment});
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),mat);floor.rotation.x=-Math.PI/2;s.scene.add(floor);
 const sphere=new THREE.Mesh(new THREE.SphereGeometry(.8,64,40),new THREE.MeshStandardMaterial({map:ballTexture(),roughness:.3,metalness:.05}));s.scene.add(sphere);
 s.scene.add(new THREE.HemisphereLight('#dfe8f0','#8a7a66',1.25));const point=new THREE.PointLight('#fff1dc',90,60,2);s.scene.add(point);
 // emitter: a glowing window that shrinks to a bare bulb in a dark housing
 const pane=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:windowTexture(),side:THREE.DoubleSide,toneMapped:false}));pane.rotation.x=Math.PI/2;s.scene.add(pane);
 const housing=new THREE.Mesh(new THREE.CylinderGeometry(.16,.3,.36,32,1,true),new THREE.MeshStandardMaterial({color:'#22292c',roughness:.5,side:THREE.DoubleSide}));s.scene.add(housing);
 const bulb=new THREE.Mesh(new THREE.CircleGeometry(.12,32),new THREE.MeshBasicMaterial({color:'#fffbe8',toneMapped:false,side:THREE.DoubleSide}));bulb.rotation.x=Math.PI/2;s.scene.add(bulb);
 s.camera.position.set(5.0,2.6,7.8);s.camera.lookAt(-.6,2.2,-.4);
 let proof;
 return{canvas:s.canvas,proof:()=>proof,project(p){const v=new THREE.Vector3(...p).project(s.camera);return{x:(v.x+1)*W/2,y:(1-v.y)*H/2};},frame(t,o={}){
  t=time(t);const cycle=.5-.5*Math.cos(TAU*t/6),grow=cycle*cycle*(3-2*cycle);
  const size=o.lightSize??(.03+3.87*grow),height=o.height??(1.45+.2*Math.sin(TAU*t/3)),ly=o.lightHeight??5;
  if(![size,height,ly].every(Number.isFinite)||size<.02||size>4||height<.59||height>2||ly<3||ly>8)throw new Error('Light size/height outside the study range');
  uniforms.lightSize.value=size;uniforms.ballPosition.value.set(0,height,0);uniforms.lightPosition.value.set(LIGHT.x,ly,LIGHT.z);
  sphere.position.copy(uniforms.ballPosition.value);sphere.rotation.set(.35,t*.6,.2);
  point.position.set(LIGHT.x,ly-.05,LIGHT.z);
  const big=clamp((size-.25)/.6);
  pane.position.set(LIGHT.x,ly,LIGHT.z);pane.scale.set(Math.max(.001,size),Math.max(.001,size),1);pane.visible=size>.12;
  housing.position.set(LIGHT.x,ly+.16,LIGHT.z);housing.visible=big<.99;housing.scale.setScalar(1-big);
  bulb.position.set(LIGHT.x,ly-.01,LIGHT.z);bulb.visible=size<=.3;bulb.scale.setScalar(Math.max(.25,size/.24));
  s.render();
  if(o.labels!==false){title(s.g,'The source shapes the shadow.','Sampled area-light visibility');text(s.g,size<.5?'A SPOTLIGHT: A HARD EDGE':'A WINDOW: A SOFT EDGE',48,630,22);text(s.g,`SOURCE WIDTH  ${size.toFixed(2)}`,48,666,22);}
  const k=height/(ly-height);
  proof={lightSize:size,height,lightHeight:ly,samples:100,method:'deterministic rectangular-emitter visibility / sphere occluder',shadowCenter:[-LIGHT.x*k,0,-LIGHT.z*k],penumbraWorld:size*k,source:size<.5?'spotlight':'window'};
 }};
}
