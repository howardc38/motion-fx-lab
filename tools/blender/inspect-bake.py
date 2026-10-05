"""Inspect saved simulation caches without running a new simulation."""
import bpy,sys,pathlib,json,math
work=pathlib.Path(sys.argv[sys.argv.index('--')+1]).resolve();bpy.ops.wm.open_mainfile(filepath=str(work/'scene.blend'));scene=bpy.context.scene;domain=bpy.data.objects['Simulation domain'];d=domain.modifiers['Mantaflow domain'].domain_settings
if not d.has_cache_baked_data:raise RuntimeError('Fluid data was not baked')
if d.domain_type=='LIQUID' and not d.has_cache_baked_mesh:raise RuntimeError('Liquid surface was not baked')
result=[]
for frame in [45,100,180,260]:
 scene.frame_set(frame);dg=bpy.context.evaluated_depsgraph_get();dg.update();obj=domain.evaluated_get(dg)
 if d.domain_type=='LIQUID':
  count=len(obj.data.vertices)
  if count<=8:raise RuntimeError('Liquid surface is empty at '+str(frame))
  sample={'frame':frame,'vertices':count}
  if 'Porcelain loop' in bpy.data.objects:
   obstacle=bpy.data.objects['Porcelain loop'];inv=obstacle.matrix_world.inverted();radii=[math.hypot(v.co.x,v.co.y) for v in obstacle.data.vertices];major=(max(radii)+min(radii))/2;minor=max(abs(v.co.z) for v in obstacle.data.vertices)
   size=max(max(v.co[k] for v in domain.data.vertices)-min(v.co[k] for v in domain.data.vertices) for k in range(3));tolerance=1.5*size/d.resolution_max;inside=0
   for vertex in obj.data.vertices:
    q=inv@(obj.matrix_world@vertex.co);distance=math.hypot(math.hypot(q.x,q.y)-major,q.z)-minor
    if distance < -tolerance:inside+=1
   sample.update({'insideObstacleBeyondTolerance':inside,'collisionTolerance':tolerance})
   if inside:raise RuntimeError('Liquid significantly intersects its solid obstacle')
  result.append(sample)
 else:
  settings=obj.modifiers['Mantaflow domain'].domain_settings;grid=list(settings.density_grid)
  if frame<=100 and (not grid or max(grid)<=0):raise RuntimeError('No smoke density while the emitters are active at '+str(frame))
  result.append({'frame':frame,'densityCells':len(grid),'maxDensity':max(grid,default=0),'nonemptyCells':sum(x>.001 for x in grid)})
(work/'simulation-proof.json').write_text(json.dumps({'domain':d.domain_type,'resolution':d.resolution_max,'width':scene.render.resolution_x*scene.render.resolution_percentage//100,'height':scene.render.resolution_y*scene.render.resolution_percentage//100,'samples':result},indent=2)+'\n');print('SIMULATION_PROOF',json.dumps(result),flush=True)
