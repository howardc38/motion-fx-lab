import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.68,flatShading:true,...extra});
export function mesh(parent,geometry,material,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function box(p,w,h,d,m,x=0,y=0,z=0,r=.025){return mesh(p,new RoundedBoxGeometry(w,h,d,1,r),m,x,y,z);}
const ico=(p,r,m,x=0,y=0,z=0,detail=1)=>mesh(p,new T.IcosahedronGeometry(r,detail),m,x,y,z);
const group=(p,x=0,y=0,z=0)=>{const g=new T.Group();g.position.set(x,y,z);p.add(g);return g;};
const oval=(p,w,h,m,x,y,z)=>{const a=mesh(p,new T.SphereGeometry(1,16,10),m,x,y,z);a.scale.set(w,h,.023);return a;};
const rod=(p,r1,r2,h,m,y)=>mesh(p,new T.CylinderGeometry(r1,r2,h,8),m,0,y,0);
const palette={skin:mat('#dba07a'),hair:mat('#352432'),coat:mat('#d49540'),shirt:mat('#edf0dc'),pants:mat('#263949'),shoe:mat('#19212d'),seam:mat('#97612e'),dark:mat('#30202a'),white:mat('#fff7df'),tongue:mat('#c45b68'),mint:mat('#52baa7',{metalness:.22,roughness:.35}),metal:mat('#304e59',{metalness:.6}),screen:mat('#072b36',{roughness:.24}),glow:mat('#caffdd',{emissive:'#70ffcf',emissiveIntensity:.65})};

function face(head,robot=false){
 const p=palette,z=robot?.407:.51, eyes=[],brows=[];
 for(const s of [-1,1]){
  const eye=group(head,s*(robot?.215:.205),robot?.065:.045,z);
  // Flat dark eyes keep the faceted face readable, with one small catchlight.
  const pupil=oval(eye,robot?.07:.065,robot?.112:.087,robot?p.glow:p.dark,0,0,.023);
  if(!robot)oval(pupil,.2,.2,p.white,-.28,.35,1.2);
  eyes.push({eye,pupil});
  const brow=box(head,.22,.046,.038,robot?p.metal:p.hair,s*.21,robot?.245:.245,z,.012);brows.push(brow);
 }
 const mouth=group(head,0,robot?-.195:-.25,z+.015);
 const cavity=oval(mouth,1,1,p.dark,0,0,0);
 const tooth=box(mouth,.2,.038,.02,p.white,0,.035,.032,.012);
 const tongue=oval(mouth,.08,.027,p.tongue,0,-.045,.03);
 // All nine Rhubarb shapes share a face-space position; teeth are independently posed.
 return{eyes,brows,mouth,cavity,tooth,tongue,robot};
}
export const MOUTHS={X:[.11,.014,0,0],A:[.13,.012,0,0],B:[.17,.032,1,0],C:[.17,.075,.8,.2],D:[.16,.125,.7,1],E:[.11,.077,.3,.5],F:[.064,.06,0,.3],G:[.13,.032,.9,0],H:[.15,.065,.7,.7]};
export function poseFace(f,shape,expression,t,gaze=0){
 const q=shape||MOUTHS.X;
 f.cavity.scale.set(q[0],q[1],.023);f.tooth.visible=q[2]>.12;f.tooth.scale.x=Math.min(1,q[0]/.14);f.tooth.position.y=q[1]*.55;f.tooth.scale.y=.6+q[2]*.5;
 f.tongue.visible=q[3]>.15;f.tongue.position.y=-q[1]*.55;f.tongue.scale.x=.08*(.7+q[3]*.4);
 const blink=Math.max(...[1.7,4.2,8.6,12.15,17.2,21.6,24.4,28.1].map(v=>Math.exp(-(((t-v)/.075)**2))));
 f.eyes.forEach(({eye,pupil},i)=>{eye.scale.y=Math.max(.06,(1-blink)*(1+(expression.surprise||0)*.32-(expression.squint||0)*.3));pupil.position.x=gaze*.035;pupil.position.y=(expression.eyeY||0)*.02;});
 f.brows.forEach((b,i)=>{b.position.y=(f.robot?.245:.245)+(expression.brow||0)*.1+(i===0?(expression.asym||0)*.05:0);b.rotation.z=(i?1:-1)*(expression.worry||0)*.3+(expression.asym||0)*.08;});
}
function hand(parent,s,robot=false){
 const p=palette,h=group(parent,0,-.37,0),skin=robot?p.mint:p.skin;
 box(h,.16,.19,.10,skin,0,-.05,0,.026);
 const fingers=[];
 for(let i=0;i<4;i++){
  const f=group(h,(i-1.5)*.045,-.13,.008),len=[.092,.118,.112,.087][i];
  box(f,.041,len,.047,skin,0,-len/2,0,.017);
  const tip=group(f,0,-len,0);box(tip,.037,len*.67,.041,skin,0,-len*.33,.002,.014);fingers.push({f,tip});
 }
 const thumb=group(h,s*.094,-.01,.012);thumb.rotation.z=s*.7;
 box(thumb,.063,.12,.067,skin,0,-.05,0,.02);
 return{root:h,fingers,thumb};
}
function arm(p,s,robot=false){
 const pal=palette,root=group(p,s*(robot?.57:.37),robot?.13:.29,0),sleeve=robot?pal.metal:pal.coat;
 rod(root,robot?.065:.128,robot?.07:.10,.40,sleeve,-.20);
 if(!robot){const seam=box(root,.11,.055,.14,pal.seam,0,-.36,0);}
 const elbow=group(root,0,-.40,0);ico(elbow,robot?.09:.10,robot?pal.metal:pal.coat);
 rod(elbow,robot?.06:.10,robot?.06:.085,.32,sleeve,-.16);
 if(!robot)rod(elbow,.087,.085,.052,pal.shirt,-.315);
 return{root,elbow,hand:hand(elbow,s,robot)};
}
export function human(scene){
 const p=palette,root=group(scene),hips=group(root,0,.81,0),torso=group(hips,0,.47,0);
 const jacket=mesh(torso,new T.CylinderGeometry(.30,.36,.70,8),p.coat,0,0,0);jacket.scale.z=.62;
 box(torso,.31,.59,.065,p.shirt,0,.02,.22,.016);
 for(const s of [-1,1]){
  const lapel=box(torso,.16,.41,.07,p.seam,s*.18,.10,.26,.018);lapel.rotation.z=s*-.26;
  box(torso,.17,.105,.032,p.seam,s*.225,-.19,.237,.012);
  for(let i=0;i<2;i++)ico(torso,.023,p.dark,s*.12,-.13-i*.15,.28,0);
 }
 const scarf=box(torso,.19,.28,.08,p.mint,.045,.27,.29,.028);scarf.rotation.z=-.12;
 rod(torso,.13,.15,.20,p.skin,.47);
 const head=group(torso,0,.91,0);
 const skull=ico(head,.59,p.skin);skull.scale.set(.92,1.03,.84);
 for(const s of [-1,1]){const ear=ico(head,.135,p.skin,s*.52,-.035,0);ear.scale.set(.6,1,.7);ico(head,.026,p.mint,s*.57,-.095,.07,0);}
 const hair=mesh(head,new T.SphereGeometry(.615,12,6,0,Math.PI*2,0,1.20),p.hair,0,.07,-.018);hair.scale.set(.97,1,.87);
 for(let i=0;i<6;i++){
  const tuft=mesh(head,new T.ConeGeometry(.125,.23+(.5+.5*Math.sin(i*1.8))*.11,4),p.hair,-.34+i*.13,.49+Math.sin(i*.8)*.07,.25);
  tuft.rotation.set(.55,0,-.65);tuft.scale.z=.68;
 }
 for(const s of [-1,1]){const side=box(head,.12,.31,.17,p.hair,s*.46,.07,.13);side.rotation.z=s*-.12;}
 const nose=mesh(head,new T.ConeGeometry(.085,.19,4),p.skin,0,-.075,.535);nose.rotation.x=Math.PI/2;
 const f=face(head),arms=[arm(torso,-1),arm(torso,1)],legs=[];
 for(const s of [-1,1]){
  const leg=group(hips,s*.19,-.12,0);rod(leg,.12,.105,.35,p.pants,-.175);const knee=group(leg,0,-.35,0);rod(knee,.105,.087,.34,p.pants,-.17);const foot=group(knee,0,-.30,.07);
  box(foot,.25,.17,.40,p.shoe,0,-.025,.075,.05);box(foot,.255,.04,.405,p.shirt,0,-.09,.075,.012);legs.push({leg,knee,foot});
 }
 return{root,hips,torso,head,face:f,arms,legs,type:'mira'};
}
export function robot(scene){
 const p=palette,root=group(scene),hips=group(root,0,.5,0),torso=group(hips,0,.59,0);
 box(torso,1.08,1.07,.73,p.mint,0,0,0,.10);
 box(torso,.90,.73,.055,p.metal,0,.075,.38,.07);
 box(torso,.84,.66,.032,p.screen,0,.075,.416,.065);
 const head=group(torso,0,.075,.034),f=face(head,true);
 for(const s of [-1,1]){
  ico(torso,.075,p.metal,s*.49,-.40,.37,0);box(torso,.055,.09,.019,p.shirt,s*.49,-.40,.43,.008);
  box(torso,.13,.35,.38,p.metal,s*.55,0,0,.04);
 }
 const antenna=group(torso,.26,.52,0);rod(antenna,.028,.035,.31,p.metal,.155);const tip=ico(antenna,.082,p.glow,0,.34,0);
 box(torso,.39,.08,.03,p.metal,0,-.39,.387,.018);
 for(let i=0;i<4;i++)box(torso,.044,.028,.02,p.glow,-.105+i*.07,-.39,.41,.004);
 const arms=[arm(torso,-1,true),arm(torso,1,true)],legs=[];
 for(const s of [-1,1]){const leg=group(hips,s*.30,-.05,0);rod(leg,.07,.07,.27,p.metal,-.13);const knee=group(leg,0,-.25,0);rod(knee,.07,.07,.22,p.metal,-.11);const foot=group(knee,0,-.19,.04);box(foot,.32,.15,.43,p.mint,0,0,.07,.045);legs.push({leg,knee,foot});}
 return{root,hips,torso,head,face:f,arms,legs,antenna,type:'pip'};
}

export function poseActor(a,t,pose={}){
 const p=pose,breath=Math.sin(t*2.5+(a.type==='pip'?1:0));
 a.root.position.y=p.y||0;a.root.rotation.y=p.turn||0;
 a.hips.position.y=(a.type==='pip'?.5:.81)+(p.crouch||0)*-.13+breath*.008;
 a.torso.rotation.set(p.lean||0,0,p.tilt||0);
 a.head.rotation.set((p.nod||0)+breath*.008,p.gaze||0,p.roll||0);
 a.arms.forEach((arm,i)=>{
  const s=i?1:-1,ap=(i?p.right:p.left)||[.05,s*.10,-.18,0];
  arm.root.rotation.set(ap[0],0,ap[1]);arm.elbow.rotation.set(ap[2],0,ap[3]||0);
  const target=(i?p.targetR:p.targetL);
  if(target){
   const start=arm.root.position.clone(),delta=new T.Vector3(...target).sub(start),d=Math.min(.765,Math.max(.05,delta.length())),dir=delta.normalize();
   const side=new T.Vector3(s,0,.25).addScaledVector(dir,-new T.Vector3(s,0,.25).dot(dir)).normalize();
   const along=(.4*.4-.37*.37+d*d)/(2*d),bend=Math.sqrt(Math.max(0,.16-along*along));
   const upper=dir.clone().multiplyScalar(along).addScaledVector(side,bend),lower=dir.clone().multiplyScalar(d).sub(upper);
   const down=new T.Vector3(0,-1,0),q1=new T.Quaternion().setFromUnitVectors(down,upper.normalize()),q2=new T.Quaternion().setFromUnitVectors(down,lower.normalize());
   arm.root.quaternion.copy(q1);arm.elbow.quaternion.copy(q1.clone().invert().multiply(q2));
  }
  arm.hand.root.rotation.set(p.wrist||0,0,s*.04);
  arm.hand.fingers.forEach(({f,tip},j)=>{const c=p.curl??.32;f.rotation.x=c+(j*.035);tip.rotation.x=c*.8;});
 });
 a.legs.forEach(({leg,knee,foot},i)=>{leg.rotation.x=(p.sit||0)*-1.27;leg.rotation.z=(i?1:-1)*.035;knee.rotation.x=(p.sit||0)*1.4;foot.rotation.x=(p.sit||0)*-.1;});
 if(a.antenna)a.antenna.rotation.z=.07*Math.sin(t*4)+(p.roll||0)*-.7;
}
