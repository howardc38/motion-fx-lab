import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldPoint,networkPoints,networkEdges} from '../fx/graphic/fields.js';
test('field has a real neutral control and returns to its registered rest grid',()=>{
 for(const t of [0,.4,2.1,4.3,8.8,9.6]){
  const p=fieldPoint(411,288,t,{strength:0});assert.equal(p.x,411);assert.equal(p.y,288);
 }
 const p=fieldPoint(411,288,9.6);assert.equal(p.x,411);assert.equal(p.y,288);
 const hit=fieldPoint(411,288,2);assert.ok(Math.hypot(hit.x-411,hit.y-288)>3);
});
test('distance graph contains exactly the pairs below the chosen threshold',()=>{
 const pts=[{x:0,y:0},{x:3,y:4},{x:100,y:0}];
 assert.deepEqual(networkEdges(pts,5),[]);assert.deepEqual(networkEdges(pts,6).map(e=>[e.a,e.b]),[[0,1]]);
 assert.deepEqual(networkPoints(2),networkPoints(2));assert.notDeepEqual(networkPoints(2),networkPoints(3));
 for(const e of networkEdges(networkPoints(4),122)){assert.ok(e.d<122);assert.ok(e.alpha>0&&e.alpha<=1)}
});
