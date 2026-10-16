import * as THREE from 'three';
import {W,H,C,TAU,clock,font,word,wordPath,surface,output,furniture} from './common.js';
export async function create(options={}){
 const data=await font(),out=output(options),renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:false});
 renderer.setPixelRatio(1);renderer.setSize(out.canvas.width,out.canvas.height);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
 window.__fxRenderers=window.__fxRenderers||[];window.__fxRenderers.push(renderer);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,W/H,.05,120),groups={},meshes=[];
 scene.add(new THREE.HemisphereLight('#ffffff','#555047',2.2));const key=new THREE.DirectionalLight('#ffffff',2);key.position.set(4,4,8);scene.add(key);
 function texture(message,color,{outline=false}={}){
  const s=surface(2048,512),p={width:1900,height:450,x:1024,y:440};
  if(outline){s.g.lineWidth=7;s.g.strokeStyle=color;s.g.stroke(wordPath(data,message,p));}
  else word(s.g,data,message,p,color);
  const t=new THREE.CanvasTexture(s.canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;
 }
 function plane(tex,w,h,parent){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true,alphaTest:.02,side:THREE.DoubleSide,depthWrite:true}));
  parent.add(mesh);meshes.push(mesh);return mesh;
 }
 const cylinder=new THREE.Group();groups.cylinder=cylinder;scene.add(cylinder);
 for(let r=0;r<5;r++){
  const tex=texture(r%2?'WORLD':'MOVE',r%2?C.orange:C.ink);tex.wrapS=THREE.RepeatWrapping;tex.repeat.x=4;
  const m=new THREE.Mesh(new THREE.CylinderGeometry(3.15,3.15,.82,128,1,true),new THREE.MeshStandardMaterial({map:tex,transparent:true,alphaTest:.02,side:THREE.FrontSide,roughness:.9}));
  m.position.y=(r-2)*.89;cylinder.add(m);m.userData.row=r;
 }
 const core=new THREE.Mesh(new THREE.CylinderGeometry(3.14,3.14,4.55,128),new THREE.MeshBasicMaterial({color:C.paper}));cylinder.add(core);
 const tunnel=new THREE.Group();groups.tunnel=tunnel;scene.add(tunnel);
 const outline=texture('MOVE',C.paper,{outline:true}),solid=texture('MOVE',C.mint);
 for(let i=0;i<22;i++){const m=plane(i%4===0?solid:outline,10,3.4,tunnel);m.position.z=-i*2.6;m.userData.i=i;}
 const corridor=new THREE.Group();groups.corridor=corridor;scene.add(corridor);
 const phrases=[texture('MAKE IT MOVE',C.paper),texture('FLOW STATE',C.acid)];
 for(let i=0;i<18;i++)for(let side=-1;side<=1;side+=2)for(let row=-1;row<=1;row++){
  const m=plane(phrases[(i+row+3)%2],5.9,1.2,corridor);m.position.set(side*5,row*1.55,-i*6);m.rotation.y=side<0?Math.PI/2:-Math.PI/2;
 }
 const grid=new THREE.GridHelper(120,40,'#687331','#303a26');grid.position.set(0,-2.5,-45);corridor.add(grid);
 let proof={};
 return{canvas:out.canvas,proof:()=>proof,frame(time,o={}){
  const t=clock(time)%9.6,mode=o.mode??(['cylinder','tunnel','corridor'][Math.floor(t/3.2)]),q=t%3.2;
  if(!groups[mode])throw Error('Unknown spatial mode '+mode);for(const [id,g] of Object.entries(groups))g.visible=id===mode;
  const paper=mode==='cylinder';scene.background=new THREE.Color(paper?C.paper:C.ink);scene.fog=new THREE.Fog(paper?C.paper:C.ink,mode==='cylinder'?14:8,mode==='cylinder'?26:58);
  if(mode==='cylinder'){
   camera.position.set(.35*Math.sin(q),.4,9.5);camera.lookAt(0,0,0);cylinder.rotation.z=-.11;
   for(const m of cylinder.children.filter(m=>m.userData.row!=null))m.rotation.y=(m.userData.row%2?1:-1)*q*.88+m.userData.row*.16;
  }else if(mode==='tunnel'){
   camera.position.set(.38*Math.sin(q*1.7),.12*Math.cos(q),4-q*3.2);camera.lookAt(0,0,-50);
   for(const m of tunnel.children){m.rotation.z=.06*Math.sin(q*1.6+m.userData.i*.18);m.scale.setScalar(1+m.userData.i*.018)}
  }else{
   camera.position.set(.5*Math.sin(q*1.5),.25*Math.sin(q*1.9),4-q*6.3);camera.lookAt(.25*Math.sin(q*1.2),0,-70);camera.rotation.z=.045*Math.sin(q*1.7);
  }
  if(renderer.getContext().isContextLost())throw Error('Spatial renderer lost context');renderer.render(scene,camera);out.begin(C.ink);out.g.drawImage(renderer.domElement,0,0,W,H);
  furniture(out.g,'SPACE / '+mode.toUpperCase(),'WORDS HAVE SIDES. AND ANOTHER SIDE.',t,{paper,labels:o.labels});
  proof={mode,camera:camera.position.toArray(),meshes:mode==='cylinder'?5:mode==='tunnel'?22:108,geometry:'three-dimensional textured geometry',clock:t};
 },dispose(){for(const m of meshes){m.geometry.dispose();m.material.dispose()}renderer.dispose();renderer.forceContextLoss()}};
}
