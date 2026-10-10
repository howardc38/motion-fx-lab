import * as THREE from 'three';
export {THREE};
export const W=1280,H=720;
let renderer;
export function stage(){
  if(!renderer){renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(W,H);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;}
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  // Mixed WebGL/Canvas frames use one consistent GPU-backed compositor.
  const g=canvas.getContext('2d',{willReadFrequently:false}),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(43,W/H,.1,100);
  return{canvas,g,scene,camera,render(){if(renderer.getContext().isContextLost())throw new Error('Signal renderer lost its context');renderer.setRenderTarget(null);renderer.render(scene,camera);g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.clearRect(0,0,W,H);g.drawImage(renderer.domElement,0,0);}};
}
const texts=new Map();
export function text(g,value,x,y,size=24,color='#ffffff',weight=800,align='left'){
  const key=[value,size,color,weight].join('|');let item=texts.get(key);
  if(!item){const c=document.createElement('canvas'),h=c.getContext('2d',{willReadFrequently:true});h.font=`${weight} ${size}px Arial`;const width=Math.ceil(h.measureText(value).width);c.width=width+10;c.height=Math.ceil(size*1.4);h.font=`${weight} ${size}px Arial`;h.fillStyle=color;h.fillText(value,5,size);item={c,width};texts.set(key,item);}
  g.drawImage(item.c,x-5-(align==='center'?item.width/2:align==='right'?item.width:0),y-size);
}
export function spectrum(g,signal,color='#ffffff',height=60){
  g.fillStyle=color;for(let i=0;i<64;i++){const v=signal.bands[Math.min(31,Math.floor(i/2))],h=2+height*v;g.fillRect(40+i*19,684-h,3,h);}
}
export const PALETTES=[
  {bg:'#143bef',accent:'#d8ff57',light:'#fff3dd',shadow:'#061e58'},
  {bg:'#d0edcc',accent:'#ec522d',light:'#fff9cf',shadow:'#203c30'},
  {bg:'#e64a2d',accent:'#d8eff2',light:'#fff3d1',shadow:'#352458'},
  {bg:'#07191e',accent:'#a9f36a',light:'#f2ede0',shadow:'#153454'},
];
