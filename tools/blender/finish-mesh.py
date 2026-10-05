"""Reconstruct a connected beauty surface from an existing liquid data cache.
This changes mesh extraction only; it does not rerun or alter fluid motion.
"""
import bpy,sys,pathlib,json,hashlib
SOURCE_SHA=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()
work=pathlib.Path(sys.argv[sys.argv.index('--')+1]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(work/'scene.blend'))
receipt=json.loads((work/'receipt.json').read_text())
if receipt.get('revision')!=2 or receipt['recipe'] not in ['overflow','viscous']:raise RuntimeError('Expected a current liquid data bake')
domain=bpy.data.objects['Simulation domain'];d=domain.modifiers['Mantaflow domain'].domain_settings
if not d.has_cache_baked_data:raise RuntimeError('Completed data cache required')
bpy.ops.object.select_all(action='DESELECT');domain.select_set(True);bpy.context.view_layer.objects.active=domain
# A small reconstruction radius leaves voids between FLIP samples. Use overlap
# at the surface, then retain symmetric smoothing rather than shrinking volume.
if d.has_cache_baked_mesh:bpy.ops.fluid.free_mesh()
d.mesh_scale=2;d.mesh_particle_radius=1.7;d.mesh_smoothen_pos=2;d.mesh_smoothen_neg=2
(work/'render-receipt.json').unlink(missing_ok=True)
(work/'simulation-proof.json').unlink(missing_ok=True)
if bpy.ops.fluid.bake_mesh()!={'FINISHED'}:raise RuntimeError('Mesh reconstruction was interrupted')
if not d.has_cache_baked_mesh:raise RuntimeError('Mesh reconstruction failed')
cache=pathlib.Path(bpy.path.abspath(d.cache_directory))
for frame in range(receipt['frameStart'],receipt['frameEnd']+1):
 if not (cache/'mesh'/f'fluid_mesh_{frame:04d}.bobj.gz').is_file():raise RuntimeError('Missing reconstructed mesh at frame '+str(frame))
bpy.ops.wm.save_as_mainfile(filepath=str(work/'scene.blend'))
data={'script':'tools/blender/finish-mesh.py','scriptSha256':SOURCE_SHA,'scale':d.mesh_scale,'particleRadius':d.mesh_particle_radius,'smoothPositive':d.mesh_smoothen_pos,'smoothNegative':d.mesh_smoothen_neg}
(work/'mesh-receipt.json').write_text(json.dumps(data,indent=2)+'\n');print('MESH_RECEIPT',json.dumps(data),flush=True)
