"""Render cached physics with the final camera/lighting treatment; no rebake."""
import bpy,sys,pathlib,argparse,json,hashlib,time
from mathutils import Vector
def frame_list(value):
 try:frames=[int(x.strip()) for x in value.split(',')]
 except ValueError:raise argparse.ArgumentTypeError('Specify one or more integer frame numbers')
 if not frames or any(f<1 or f>289 for f in frames):raise argparse.ArgumentTypeError('Still frames must be between 1 and 289')
 return frames
p=argparse.ArgumentParser();p.add_argument('--work',type=pathlib.Path,required=True);p.add_argument('--recipe',choices=['overflow','viscous','smoke'],required=True);p.add_argument('--stills',type=frame_list,help='Comma-separated frame numbers; no completed-render receipt is written');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);work=a.work.resolve()
source_sha=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(work/'scene.blend'));scene=bpy.context.scene;receipt=json.loads((work/'receipt.json').read_text())
if not receipt['bakedData'] or receipt['recipe']!=a.recipe:raise RuntimeError('Baked recipe does not match the render request')
if (scene.render.resolution_x,scene.render.resolution_y)!=(1280,720):raise RuntimeError('Render the final-quality scene')
if receipt.get('revision')==2:
 # The curved backdrop is the visible floor. Keep the coincident collision slab
 # out of beauty rays to avoid z-fighting; its baked collisions are unchanged.
 bpy.data.objects['Ground'].hide_render=True
 if a.recipe=='viscous':
  cam=scene.camera;cam.animation_data_clear();cam.data.lens=54
  for frame,loc in [(1,(3.9,-6.4,3.1)),(289,(3.0,-5.5,2.6))]:cam.location=loc;cam.keyframe_insert(data_path='location',frame=frame)
if a.recipe=='overflow' or (a.recipe=='viscous' and receipt.get('revision')==2):
 scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True;scene.cycles.max_bounces=10;scene.cycles.transmission_bounces=8
 prefs=bpy.context.preferences.addons['cycles'].preferences
 try:
  prefs.compute_device_type='METAL';prefs.get_devices();devices=[d for d in prefs.devices if d.type=='METAL']
  if not devices:raise RuntimeError('No Metal device')
  for device in prefs.devices:device.use=device.type=='METAL'
  scene.cycles.device='GPU'
 except (TypeError,RuntimeError):scene.cycles.device='CPU'
if a.recipe=='viscous' and receipt.get('revision')!=2:
 # Observe the coated face. Only camera, lights and the visual backdrop change;
 # the object, inflow and all cached fluid positions remain untouched.
 bpy.context.preferences.edit.keyframe_new_interpolation_type='LINEAR'
 cam=scene.camera;cam.animation_data_clear();target=bpy.data.objects.new('Camera target',None);scene.collection.objects.link(target);target.location=(0,0,1.6)
 constraint=cam.constraints.new('TRACK_TO');constraint.target=target;constraint.track_axis='TRACK_NEGATIVE_Z';constraint.up_axis='UP_Y'
 for frame,loc in [(1,(4.5,7.6,3.8)),(289,(-2.8,6.8,2.9))]:cam.location=loc;cam.keyframe_insert(data_path='location',frame=frame)
 for ob in scene.objects:
  if ob.type=='LIGHT':ob.location.y*=-1;ob.rotation_euler=(Vector((0,0,1))-ob.location).to_track_quat('-Z','Y').to_euler()
 bpy.data.objects['Seamless studio'].scale.y=-1
scene.frame_start=receipt['frameStart'];scene.frame_end=receipt['frameEnd'];scene.frame_step=1;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
if a.stills is not None:
 (work/'stills-final').mkdir(exist_ok=True)
 for frame in a.stills:
  scene.frame_set(frame);scene.render.filepath=str(work/'stills-final'/f'{frame:06d}.png');bpy.ops.render.render(write_still=True)
else:
 (work/'frames').mkdir(exist_ok=True);scene.render.filepath=str(work/'frames'/'frame-');scene.render.use_overwrite=True
 (work/'render-receipt.json').unlink(missing_ok=True);started=time.time_ns()
 if bpy.ops.render.render(animation=True)!={'FINISHED'}:raise RuntimeError('Animation render did not complete')
 (work/'render-receipt.json').write_text(json.dumps({'script':'tools/blender/render.py','scriptSha256':source_sha,'engine':scene.render.engine,'width':1280,'height':720,'frames':289,'fps':30,'startedAtNs':started},indent=2)+'\n')
