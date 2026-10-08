import * as THREE from 'three';
import {W,H,surface} from './math.js';
export {THREE};
let renderer;
export function stage(background='#f2eee5'){
 if(!renderer){renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(W,H);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;}
 const scene=new THREE.Scene();scene.background=new THREE.Color(background);
 const camera=new THREE.PerspectiveCamera(38,W/H,.1,150),out=surface();
 return{...out,scene,camera,render(){if(renderer.getContext().isContextLost())throw new Error('Design renderer lost its context');renderer.setRenderTarget(null);renderer.render(scene,camera);out.g.clearRect(0,0,W,H);out.g.drawImage(renderer.domElement,0,0);}};
}
