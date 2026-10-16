import test from 'node:test';
import assert from 'node:assert/strict';
import {mechanismAt,DRIVE,sectionPolygons,signedArea,assemblyAmount,shares,smoothIntegral} from '../fx/mechanical/model.js';
import {segmentBoxDistance,auditSection,boundaryEdges} from '../fx/mechanical/audit.js';
test('slider-crank pin distance stays constant through revolutions and a speed change',()=>{
 for(let t=0;t<14.4;t+=.017){const p=mechanismAt(t);assert.ok(Math.abs(Math.hypot(p.pin[0]-p.wrist[0],p.pin[1]-p.wrist[1])-DRIVE.rod)<1e-12);assert.ok(p.sliderY>DRIVE.baseY+DRIVE.rod-DRIVE.crank-.001);}
 assert.equal(mechanismAt(7,0).theta,0);assert.equal(mechanismAt(3,60).theta,6*Math.PI);
});
test('speed-ramp angle is continuous and its derivative is the displayed RPM',()=>{
 for(const t of [2.4,3.6,6,9.6,10.2,12.6]){const h=1e-5,p=mechanismAt(t),speed=(mechanismAt(t+h).theta-mechanismAt(t-h).theta)/(2*h)*60/(2*Math.PI);assert.ok(Math.abs(speed-p.rpm)<1e-5);}
 assert.equal(smoothIntegral(10,2,4),7);
});
test('an annular housing section preserves its wall, hole and area',()=>{
 const profile=[[1,0],[1.2,0],[1.2,2],[1,2]],p=sectionPolygons(profile,0);
 assert.ok(Math.abs(p.reduce((n,x)=>n+Math.abs(signedArea(x)),0)-.8)<1e-10);assert.ok(p.every(poly=>poly.every(v=>Math.abs(v[0])>=1)));
 assert.deepEqual(sectionPolygons(profile,2),[]);
 for(let z=-1.3;z<1.3;z+=.013)assert.deepEqual(auditSection(profile,z).errors,[]);
});
test('capsule/frame clearance detects a crossing and a close parallel route',()=>{
 const box={min:[-1,-1,-1],max:[1,1,1]};assert.ok(segmentBoxDistance([-2,0,0],[2,0,0],box)<1e-8);assert.ok(Math.abs(segmentBoxDistance([-2,1.25,0],[2,1.25,0],box)-.25)<1e-8);
});
test('closed-surface topology catches a missing face instead of passing an open shell',()=>{
 const a=[0,0,0],b=[1,0,0],c=[0,1,0],d=[0,0,1],faces=[[a,c,b],[a,b,d],[b,c,d],[c,a,d]];
 assert.equal(boundaryEdges(faces.flat(2)).length,0);assert.ok(boundaryEdges(faces.slice(1).flat(2)).length>0);
});
test('service order closes the fan before the shell and is reversible',()=>{
 for(let t=0;t<=14.4;t+=.013){const q=shares(assemblyAmount(t));if(q.fan>.02){assert.equal(q.outer,1);assert.equal(q.spinner,1)}if(q.spinner>.02)assert.equal(q.core,1);}
 assert.equal(assemblyAmount(0),0);assert.equal(assemblyAmount(14.4),0);
});
