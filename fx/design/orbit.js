import {THREE,stage} from './common.js';
import {W,H,C,TAU,phase,mix,time,title,disc} from './math.js';
export function create(){
 const s=stage(C.ink),group=new THREE.Group();s.scene.add(group);s.camera.position.set(0,2.8,10.4);s.camera.lookAt(0,0,0);
 const message='MOTION · SHAPE · RHYTHM · ',glyphs=[],textures=new Map();
 const measure=document.createElement('canvas').getContext('2d');measure.font='900 104px Arial';const advances=[...message].map(ch=>measure.measureText(ch).width+5),total=advances.reduce((a,b)=>a+b,0),unit=TAU*2.8/total;let cursor=0;
 for(let i=0;i<message.length;i++){
  const ch=message[i],along=cursor+advances[i]/2;cursor+=advances[i];if(ch===' ')continue;
  if(!textures.has(ch)){const c=document.createElement('canvas');c.width=128;c.height=160;const g=c.getContext('2d');g.font='900 104px Arial';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#fff';g.fillText(ch,64,82);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;textures.set(ch,tex);}
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{glyph:{value:textures.get(ch)}},vertexShader:'varying vec2 vUv;varying float vZ;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vZ=w.z;gl_Position=projectionMatrix*viewMatrix*w;}',fragmentShader:'uniform sampler2D glyph;varying vec2 vUv;varying float vZ;void main(){float a=texture2D(glyph,vUv).a;if(a<.01)discard;vec3 c=mix(vec3(.24,.30,.31),vec3(.98,.94,.84),smoothstep(-2.8,2.8,vZ));gl_FragColor=vec4(c,a);#include <colorspace_fragment>}'.replace(';#include',';\n#include')});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(128*unit,160*unit),mat);group.add(mesh);glyphs.push({mesh,along});
 }
 let proof;
 return{canvas:s.canvas,proof:()=>proof,frame(t,o={}){t=time(t);const q=t%8,wrap=o.wrap??(phase(q,.4,2)*(1-phase(q,5.8,7.6))),spin=o.spin??t*.48;
  group.scale.setScalar(o.scale??1);group.rotation.set(0,0,0);
  for(const {mesh,along} of glyphs){const a=along/total*TAU+spin;mesh.position.set(mix((along-total/2)*unit*.55,Math.sin(a)*2.8,wrap),mix(.3,0,wrap),Math.cos(a)*2.8*wrap);mesh.rotation.set(0,a*wrap,0);mesh.scale.setScalar(mix(.55,1,wrap));}
  s.render();if(o.dot!==false&&wrap>.15)disc(s.g,W/2,H/2,15,C.orange);
  if(o.labels!==false)title(s.g,'Words take up space.','Line → ring → line',C.paper);
  proof={wrap,depthRange:5.6*wrap,glyphCount:glyphs.length,spin};
 }};
}
