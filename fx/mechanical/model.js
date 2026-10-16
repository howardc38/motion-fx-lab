// Absolute-time motion shared by geometry, instruments and geometric checks.
export const TAU=Math.PI*2;
export const clamp=x=>Math.max(0,Math.min(1,x));
export const phase=(t,a,b)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u)};
export const mix=(a,b,u)=>a+(b-a)*u;
export const DURATION=14.4;
export function validTime(t){if(!Number.isFinite(t))throw Error('Time must be finite');return Math.max(0,Math.min(DURATION,t));}
export function assemblyAmount(t){return phase(t,1.8,6.6)*(1-phase(t,9,12.6));}
export function shares(amount){
 return {outer:phase(amount,0,.25),core:phase(amount,.27,.47),spinner:phase(amount,.49,.65),fan:phase(amount,.68,.88),plug:phase(amount,.55,.86)};
}
export function assemblyOffset(name,q){
 if(name.startsWith('Nacelle'))return[0,0,(name.endsWith('near')?1:-1)*2.35*q.outer];
 if(name.startsWith('Core cowl'))return[0,0,(name.endsWith('near')?1:-1)*1.35*q.core];
 if(name==='Spinner')return[0,2.2*q.spinner,0];
 if(name==='Fan')return[0,1.4*q.fan,0];
 if(name==='Exhaust plug')return[0,-1.8*q.plug,0];
 return[0,0,0];
}
// Integral of smoothstep: changing speed never teleports the rotating mechanisms.
export function smoothIntegral(t,a,b){if(t<=a)return 0;if(t>=b)return t-b+(b-a)/2;const u=(t-a)/(b-a);return(b-a)*(u*u*u-.5*u*u*u*u);}
export const DRIVE={teeth:[20,40],module:.021,crank:.26,rod:1.02,baseY:1.05,bore:.232,piston:.219};
export function mechanismAt(t,rpm){
 const turns=rpm===undefined?(18*t+36*smoothIntegral(t,2.4,6)-34*smoothIntegral(t,9.6,12.6))/60:rpm*t/60;
 const speed=rpm??(18+36*phase(t,2.4,6)-34*phase(t,9.6,12.6));
 const theta=turns*TAU,crankAngle=-theta/2,px=-DRIVE.crank*Math.sin(crankAngle),py=DRIVE.baseY+DRIVE.crank*Math.cos(crankAngle);
 const sliderY=py+Math.sqrt(DRIVE.rod**2-px**2);
 return{theta,crankAngle,rpm:speed,outputRpm:speed/2,pin:[px,py,0],wrist:[0,sliderY,0],sliderY,stroke:DRIVE.crank*2,ratio:2};
}
// Clip a revolved profile against r >= |z|, then map it to its exact longitudinal section.
// The boundary is densified before the nonlinear mapping, preserving the curved cut at the ends.
export function sectionPolygons(profile,z,subdivisions=10){
 if(!profile.every(p=>p.length===2&&p.every(Number.isFinite)))throw Error('Invalid revolved profile');
 const d=Math.abs(z),dense=[];
 for(let i=0;i<profile.length;i++){const a=profile[i],b=profile[(i+1)%profile.length];for(let j=0;j<subdivisions;j++)dense.push([mix(a[0],b[0],j/subdivisions),mix(a[1],b[1],j/subdivisions)]);}
 const clipped=[];for(let i=0;i<dense.length;i++){
  const a=dense[i],b=dense[(i+1)%dense.length],ia=a[0]>=d,ib=b[0]>=d;
  if(ia)clipped.push(a);if(ia!==ib){const f=(d-a[0])/(b[0]-a[0]);clipped.push([d,mix(a[1],b[1],f)]);}
 }
 if(clipped.length<3)return[];
 const positive=clipped.map(([r,y])=>[Math.sqrt(Math.max(0,r*r-d*d)),y,z]);
 return[positive,positive.map(([x,y,z])=>[-x,y,z]).reverse()];
}
export function signedArea(points){return points.reduce((a,p,i)=>{const q=points[(i+1)%points.length];return a+p[0]*q[1]-q[0]*p[1]},0)/2;}
