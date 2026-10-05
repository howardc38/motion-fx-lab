"""Render cached physics with the final camera/lighting treatment; no rebake."""
import bpy,sys,pathlib,argparse,json,hashlib
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--work',type=pathlib.Path,required=True);p.add_argument('--recipe',choices=['overflow','viscous','smoke'],required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);work=a.work.resolve()
source_sha=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(work/'scene.blend'));scene=bpy.context.scene;receipt=json.loads((work/'receipt.json').read_text())
if not receipt['bakedData'] or receipt['recipe']!=a.recipe:raise RuntimeError('Baked recipe does not match the render request')
if (scene.render.resolution_x,scene.render.resolution_y)!=(1280,720):raise RuntimeError('Render the final-quality scene')
if a.recipe=='overflow':
 scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.cycles.max_bounces=8;scene.cycles.transmission_bounces=6
 prefs=bpy.context.preferences.addons['cycles'].preferences
 try:
  prefs.compute_device_type='METAL';prefs.get_devices();devices=[d for d in prefs.devices if d.type=='METAL']
  if not devices:raise RuntimeError('No Metal device')
  for device in prefs.devices:device.use=device.type=='METAL'
  scene.cycles.device='GPU'
 except (TypeError,RuntimeError):scene.cycles.device='CPU'
if a.recipe=='viscous':
 # Observe the coated face. Only camera, lights and the visual backdrop change;
 # the object, inflow and all cached fluid positions remain untouched.
 bpy.context.preferences.edit.keyframe_new_interpolation_type='LINEAR'
 cam=scene.camera;cam.animation_data_clear();target=bpy.data.objects.new('Camera target',None);scene.collection.objects.link(target);target.location=(0,0,1.6)
 constraint=cam.constraints.new('TRACK_TO');constraint.target=target;constraint.track_axis='TRACK_NEGATIVE_Z';constraint.up_axis='UP_Y'
 for frame,loc in [(1,(4.5,7.6,3.8)),(289,(-2.8,6.8,2.9))]:cam.location=loc;cam.keyframe_insert(data_path='location',frame=frame)
 for ob in scene.objects:
  if ob.type=='LIGHT':ob.location.y*=-1;ob.rotation_euler=(Vector((0,0,1))-ob.location).to_track_quat('-Z','Y').to_euler()
 bpy.data.objects['Seamless studio'].scale.y=-1
scene.frame_start=receipt['frameStart'];scene.frame_end=receipt['frameEnd'];scene.frame_step=1;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';(work/'frames').mkdir(exist_ok=True);scene.render.filepath=str(work/'frames'/'frame-');bpy.ops.render.render(animation=True)
(work/'render-receipt.json').write_text(json.dumps({'script':'tools/blender/render.py','scriptSha256':source_sha,'engine':scene.render.engine,'width':1280,'height':720,'frames':289,'fps':30},indent=2)+'\n')
