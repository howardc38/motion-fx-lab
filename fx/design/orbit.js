import {THREE,stage} from './common.js';
import {W,H,C,TAU,phase,mix,time,title,disc,clamp} from './math.js';
export const MESSAGE='MAKE IT MOVE · MAKE IT MOVE · ';
// Camera loop for the gallery: front, push in, through the ring's centre, crane up, back.
const PATH=[
 {t:0,pos:[0,2.1,7.7],aim:[0,.15,0]},
 {t:1.6,pos:[.6,1.4,6.6],aim:[0,.1,0]},
 {t:3.2,pos:[.25,.45,3.9],aim:[0,.2,0]},
 {t:4.3,pos:[0,.32,.2],aim:[0,.28,-3]},
 {t:5.6,pos:[0,4.4,2.6],aim:[0,0,-.2]},
 {t:8,pos:[0,2.1,7.7],aim:[0,.15,0]},
];
function along(t,key){
 t=((t%8)+8)%8;let i=0;while(i<PATH.length-2&&t>PATH[i+1].t)i++;
 const a=PATH[i],b=PATH[i+1],p0=PATH[(i+PATH.length-2)%(PATH.length-1)],p3=i+2<PATH.length?PATH[i+2]:PATH[1],h=b.t-a.t,u=(t-a.t)/h;
 return a[key].map((v,j)=>{const m1=(b[key][j]-p0[key][j])*.5,m2=(p3[key][j]-v)*.5,u2=u*u,u3=u2*u;return(2*u3-3*u2+1)*v+(u3-2*u2+u)*m1+(-2*u3+3*u2)*b[key][j]+(u3-u2)*m2;});
}
export function create({message=MESSAGE}={}){
 const s=stage(C.ink),group=new THREE.Group();s.scene.add(group);
 const glyphs=[],textures=new Map();
 const measure=document.createElement('canvas').getContext('2d');measure.font='900 104px Arial';const advances=[...message].map(ch=>measure.measureText(ch).width+5),total=advances.reduce((a,b)=>a+b,0),unit=TAU*2.8/total;let cursor=0;
 const uniforms={camPos:{value:new THREE.Vector3()},center:{value:new THREE.Vector3()},radius:{value:2.8},rim:{value:new THREE.Vector3(-.6,.5,-.6).normalize()}};
 for(let i=0;i<message.length;i++){
  const ch=message[i],at=cursor+advances[i]/2;cursor+=advances[i];if(ch===' ')continue;
  if(!textures.has(ch)){const c=document.createElement('canvas');c.width=128;c.height=160;const g=c.getContext('2d');g.font='900 104px Arial';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#fff';g.fillText(ch,64,82);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;textures.set(ch,tex);}
  // Front glyphs are warm paper with a rim light on their edges; glyphs on the far
  // side of the ring (from wherever the camera is) fall back into a soft blue haze.
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{glyph:{value:textures.get(ch)},...uniforms},
   vertexShader:'varying vec2 vUv;varying vec3 vW;varying vec3 vN;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*vec3(0.,0.,1.));gl_Position=projectionMatrix*viewMatrix*w;}',
   fragmentShader:`uniform sampler2D glyph;uniform vec3 camPos;uniform vec3 center;uniform float radius;uniform vec3 rim;varying vec2 vUv;varying vec3 vW;varying vec3 vN;
void main(){
 vec2 uv=vUv;
 float back=smoothstep(-.15,1.,(length(vW-camPos)-length(center-camPos))/radius);
 float a=texture2D(glyph,uv,back*3.2).a;if(a<.01)discard;
 float edge=clamp(a-texture2D(glyph,uv+vec2(.05,-.04),back*3.2).a,0.,1.);
 vec3 n=normalize(gl_FrontFacing?vN:-vN);vec3 v=normalize(camPos-vW);
 float grazing=pow(1.-abs(dot(n,v)),2.);float lit=max(dot(n,rim),0.);
 vec3 front=vec3(.98,.94,.84),haze=vec3(.2,.29,.33);
 vec3 c=mix(front,haze,back*.85);
 // warm rim on the glyph edges that face the key light, stronger as letters turn edge-on
 c=mix(c,vec3(1.,.47,.22),clamp(edge*(.75+.8*lit)+grazing*.45,0.,1.)*(1.-back*.8));
 gl_FragColor=vec4(c,a*(1.-.5*back));
#include <colorspace_fragment>
}`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(128*unit,160*unit),mat);group.add(mesh);glyphs.push({mesh,along:at,mat});
 }
 let proof;
 return{canvas:s.canvas,proof:()=>proof,frame(t,o={}){t=time(t);const q=t%8,wrap=o.wrap??(phase(q,.3,1.4)*(1-phase(q,6.6,7.8))),spin=o.spin??t*.48;
  group.scale.setScalar(o.scale??1);group.rotation.set(0,0,0);
  for(const {mesh,along:a0} of glyphs){const a=a0/total*TAU+spin;mesh.position.set(mix((a0-total/2)*unit*.55,Math.sin(a)*2.8,wrap),mix(.3,0,wrap),Math.cos(a)*2.8*wrap);mesh.rotation.set(0,a*wrap,0);mesh.scale.setScalar(mix(.55,1,wrap));}
  // `fly` follows the gallery camera path; films pass `fly:false` for the fixed view.
  if(o.fly===false){s.camera.position.set(0,2.8,10.4);s.camera.lookAt(0,0,0);}
  else{const p=along(q,'pos'),m=along(q,'aim');s.camera.position.set(...p);s.camera.lookAt(...m);}
  s.camera.updateMatrixWorld();uniforms.camPos.value.copy(s.camera.position);uniforms.center.value.set(0,0,0);uniforms.radius.value=2.8*(o.scale??1);
  s.render();if((o.dot??o.fly===false)&&wrap>.15)disc(s.g,W/2,H/2,15,C.orange);
  if(o.labels!==false)title(s.g,'Words take up space.','Line → ring → through the centre',C.paper);
  const inside=Math.hypot(s.camera.position.x,s.camera.position.z)<2.8*(o.scale??1)&&Math.abs(s.camera.position.y)<1;
  proof={wrap,depthRange:5.6*wrap,glyphCount:glyphs.length,spin,camera:s.camera.position.toArray(),inside,message};
 }};
}
