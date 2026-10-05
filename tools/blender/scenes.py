"""Original offline fluid scenes. Run with Blender 5.2 LTS, not system Python.
blender -b --factory-startup --python tools/blender/scenes.py -- --recipe overflow --work .blender-cache/overflow --quality preview --action bake
"""
import bpy, math, json, argparse, sys, pathlib, hashlib, time
from mathutils import Vector
from math import sin,cos,pi
FPS=30; END=289
SOURCE_SHA=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()
p=argparse.ArgumentParser();p.add_argument('--recipe',choices=['overflow','viscous','smoke'],required=True);p.add_argument('--work',type=pathlib.Path,required=True);p.add_argument('--quality',choices=['preview','final'],default='preview');p.add_argument('--action',choices=['scene','bake','stills','render','probe'],default='scene');p.add_argument('--frames',default='45,110,180,250');p.add_argument('--step',type=int,default=1);a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
WORK=a.work.resolve();WORK.mkdir(parents=True,exist_ok=True);SCENE=WORK/'scene.blend'

def active(o):
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o

def material(name,color,metal=0,rough=.3,transmit=0,emission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough;n.inputs['Transmission Weight'].default_value=transmit;n.inputs['IOR'].default_value=1.333
 n.inputs['Coat Weight'].default_value=.35;n.inputs['Coat Roughness'].default_value=.15
 if emission:n.inputs['Emission Color'].default_value=(*color,1);n.inputs['Emission Strength'].default_value=emission
 return m

def assign(o,m):o.data.materials.append(m);return o

def cube(name,loc,scale,mat=None,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=2,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:b=o.modifiers.new('Rounded edges','BEVEL');b.width=bevel;b.segments=3
 if mat:assign(o,mat)
 return o

def sphere(name,loc,r,mat=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,radius=r,location=loc);o=bpy.context.object;o.name=name
 for poly in o.data.polygons:poly.use_smooth=True
 if mat:assign(o,mat)
 return o

def torus(name,loc,major,minor,mat,rot=(0,0,0)):
 bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=96,minor_segments=16,location=loc,rotation=rot);o=bpy.context.object;o.name=name;assign(o,mat)
 for poly in o.data.polygons:poly.use_smooth=True
 return o

def collision(o):
 active(o);m=o.modifiers.new('Mantaflow collision','FLUID');m.fluid_type='EFFECTOR';m.effector_settings.surface_distance=.001;m.effector_settings.subframes=2;return o

def light(name,loc,color,power,size,target=(0,0,1),shape='DISK',size_y=None):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape=shape;d.size=size
 if size_y and hasattr(d,'size_y'):d.size_y=size_y
 o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();return o

def animate(o,key,frame,value):
 setattr(o,key,value);o.keyframe_insert(data_path=key,frame=frame)

def domain(kind,loc,scale,mat):
 o=cube('Simulation domain',loc,scale,mat);active(o);m=o.modifiers.new('Mantaflow domain','FLUID');m.fluid_type='DOMAIN';d=m.domain_settings;d.domain_type=kind;d.cache_type='MODULAR';d.cache_directory=str(WORK/'cache');d.cache_frame_start=1;d.cache_frame_end=END;d.resolution_max=48 if a.quality=='preview' else (64 if a.recipe=='viscous' else 80);d.cache_data_format='UNI';d.cache_mesh_format='BOBJECT';d.timesteps_min=2;d.timesteps_max=6;d.time_scale=.65
 if kind=='LIQUID':
  for side in ['front','back','right','left','top']:setattr(d,'use_collision_border_'+side,False)
  d.use_mesh=True;d.mesh_scale=1 if a.quality=='preview' else 2;d.mesh_particle_radius=1.7;d.mesh_smoothen_pos=2;d.mesh_smoothen_neg=2;d.use_fractions=True;d.flip_ratio=.92
  ng=bpy.data.node_groups.new('Smooth liquid surface','GeometryNodeTree');ng.interface.new_socket(name='Geometry',in_out='INPUT',socket_type='NodeSocketGeometry');ng.interface.new_socket(name='Geometry',in_out='OUTPUT',socket_type='NodeSocketGeometry');i=ng.nodes.new('NodeGroupInput');sm=ng.nodes.new('GeometryNodeSetShadeSmooth');sm.inputs['Shade Smooth'].default_value=True;out=ng.nodes.new('NodeGroupOutput');ng.links.new(i.outputs['Geometry'],sm.inputs['Geometry']);ng.links.new(sm.outputs['Geometry'],out.inputs['Geometry']);mod=o.modifiers.new('Smooth liquid normals','NODES');mod.node_group=ng
 return o,d

def inflow(name,loc,r,kind,vel,end_frame=200):
 o=sphere(name,loc,r);m=o.modifiers.new('Mantaflow inflow','FLUID');m.fluid_type='FLOW';f=m.flow_settings;f.flow_type=kind;f.flow_behavior='INFLOW';f.use_initial_velocity=True;f.velocity_coord=vel;f.surface_distance=1.5;f.subframes=2;o.hide_render=True;o.display_type='WIRE'
 f.use_inflow=True;f.keyframe_insert(data_path='use_inflow',frame=1);f.keyframe_insert(data_path='use_inflow',frame=end_frame);f.use_inflow=False;f.keyframe_insert(data_path='use_inflow',frame=end_frame+1)
 return o,f

def cup(mat):
 import bmesh
 profile=[(0,.13),(.8,.13),(.9,.3),(1.28,1.12),(1.3,1.35),(1.1,1.35),(1.04,1.12),(.72,.42),(0,.42)];n=96;verts=[(r*cos(i*2*pi/n),r*sin(i*2*pi/n),z) for r,z in profile for i in range(n)];faces=[]
 for j in range(len(profile)-1):
  for i in range(n):k=j*n+i;l=j*n+(i+1)%n;faces.append((k,l,l+n,k+n))
 mesh=bpy.data.meshes.new('Closed vessel geometry');mesh.from_pydata(verts,[],faces);mesh.update();bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.0001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();o=bpy.data.objects.new('Open vessel',mesh);bpy.context.collection.objects.link(o);assign(o,mat)
 for face in mesh.polygons:face.use_smooth=True
 bevel=o.modifiers.new('Soft ceramic rim','BEVEL');bevel.width=.04;bevel.segments=3;return collision(o)

def setup():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=640 if a.quality=='preview' else 1280;scene.render.resolution_y=360 if a.quality=='preview' else 720;scene.render.resolution_percentage=100;scene.render.fps=FPS;scene.frame_start=1;scene.frame_end=END;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.film_transparent=False
 scene.world.color=(.02,.02,.02);scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.018,.026,.044,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.25
 scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.25
 scene.eevee.taa_render_samples=24 if a.quality=='preview' else 48
 if hasattr(scene.eevee,'use_raytracing'):scene.eevee.use_raytracing=True
 bpy.context.preferences.edit.keyframe_new_interpolation_type='LINEAR'
 dark=material('Obsidian stage',(.016,.024,.038),.45,.23);gold=material('Warm titanium',(.7,.37,.10),.8,.22);white=material('Porcelain',(.72,.78,.8),.1,.22);cyan=material('Cyan luminous edge',(.02,.55,.8),.3,.2,emission=3)
 floor=collision(cube('Collision floor',(0,0,-.2),(20,20,.15)));floor.hide_render=True
 profile=[(-20,-.05),(4,-.05)]+[(4+4*sin(i*pi/40),3.95-4*cos(i*pi/40)) for i in range(1,21)]+[(8,25)]
 verts=[(x,y,z) for y,z in profile for x in [-30,30]];faces=[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(profile)-1)];mesh=bpy.data.meshes.new('Cyclorama');mesh.from_pydata(verts,[],faces);back=bpy.data.objects.new('Seamless studio',mesh);bpy.context.collection.objects.link(back);assign(back,dark)
 for face in mesh.polygons:face.use_smooth=True
 if a.recipe=='overflow':
  liq=material('Clear cyan liquid',(.3,.72,.85),0,.07,1);liq.node_tree.nodes['Principled BSDF'].inputs['Coat Weight'].default_value=0
  dom,d=domain('LIQUID',(0,0,2.1),(2.9,2.9,2.4),liq)
  cup(white);torus('Luminous lip',(0,0,1.34),1.29,.025,cyan);torus('Outer gold ring',(0,0,.14),2.45,.027,gold)
  # The pedestal and vessel are real fluid obstacles.
  collision(cube('Round plinth',(0,0,-.025),(1.75,1.75,.14),dark,.14))
  src,f=inflow('Falling liquid',(-.8,0,3.65),.27,'LIQUID',(.7,0,-2.2),220)
  for fr,x,y in [(1,-.8,0),(85,-.45,.2),(165,-.75,-.1),(END,-.4,0)]:animate(src,'location',fr,(x,y,3.65))
  cam_start=(6.1,-8.2,7.2);cam_end=(3.5,-7.8,4.8);target=(0,0,1.45)
 elif a.recipe=='viscous':
  liq=material('Rose-gold lacquer',(.65,.23,.045),.72,.15,0)
  dom,d=domain('LIQUID',(0,0,2.05),(2.45,2.45,2.25),liq);d.time_scale=.48;d.use_viscosity=True;d.viscosity_value=.035
  form=torus('Porcelain loop',(0,0,1.45),.95,.28,white,(pi/2,0,.18));collision(form)
  collision(cube('Product pedestal',(0,0,.08),(1.55,1.1,.18),dark,.12));torus('Gold stage rim',(0,0,.24),1.7,.025,gold)
  src,f=inflow('Lacquer stream',(-.25,0,3.6),.18,'LIQUID',(0,0,-1.2),195)
  for fr,x,y in [(1,-.25,0),(100,.3,.06),(195,-.12,-.06),(END,-.12,-.06)]:animate(src,'location',fr,(x,y,3.6))
  cam_start=(4.5,-7.6,3.8);cam_end=(-2.8,-6.8,2.9);target=(0,0,1.6)
 else:
  smoke=bpy.data.materials.new('Lit volumetric smoke');smoke.use_nodes=True;nodes=smoke.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');v=nodes.new('ShaderNodeVolumePrincipled');v.inputs['Color'].default_value=(.32,.5,.65,1);v.inputs['Density'].default_value=3;v.inputs['Anisotropy'].default_value=.2;smoke.node_tree.links.new(v.outputs['Volume'],out.inputs['Volume'])
  dom,d=domain('GAS',(0,.2,2.1),(4.4,2.5,2.45),smoke);d.cache_data_format='OPENVDB';d.vorticity=1.3;d.alpha=.2;d.beta=1.5;d.use_dissolve_smoke=True;d.dissolve_speed=38;d.use_dissolve_smoke_log=False
  bpy.ops.object.text_add(location=(0,-.1,1.05),rotation=(pi/2,0,0));word=bpy.context.object;word.name='FORM letter obstacle';word.data.body='FORM';word.data.align_x='CENTER';word.data.size=1.5;word.data.extrude=.18;word.data.bevel_depth=.035;word.data.bevel_resolution=3;assign(word,gold.copy());wm=word.data.materials[0].node_tree.nodes['Principled BSDF'];wm.inputs['Base Color'].default_value=(.008,.018,.025,1);wm.inputs['Base Color'].keyframe_insert(data_path='default_value',frame=1);wm.inputs['Base Color'].keyframe_insert(data_path='default_value',frame=135);wm.inputs['Base Color'].default_value=(.7,.37,.1,1);wm.inputs['Base Color'].keyframe_insert(data_path='default_value',frame=205);bpy.ops.object.convert(target='MESH');collision(bpy.context.object)
  for i,x in enumerate([-1.7,0,1.7]):
   src,f=inflow('Smoke jet '+str(i),(x,.55,.55),.36,'SMOKE',(0,-.65,1.4),135);f.density=1;f.temperature=1.3;f.smoke_color=(.2,.45,.7)
  bpy.ops.object.effector_add(type='TURBULENCE',location=(0,0,1.5));bpy.context.object.field.strength=1.4;bpy.context.object.field.size=1.3;bpy.context.object.field.seed=19
  torus('Set halo',(0,1,1.6),2.4,.024,cyan,(pi/2,0,0));cam_start=(4,-10,3.8);cam_end=(.4,-8,2.1);target=(0,0,1.6)
 light('Key softbox',(-3,-4,7),(1,.8,.55),1300,5)
 light('Cyan rim',(3,3,5),(.12,.65,1),1800,4)
 light('Warm strip',(-4,1,3),(1,.25,.07),1100,4,shape='RECTANGLE',size_y=.7)
 light('Front sheen',(0,-5,2),(.65,.85,1),450,3)
 bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='Hero camera';scene.camera=cam;cam.data.lens=52;cam.data.clip_end=300
 for fr,loc in [(1,cam_start),(END,cam_end)]:animate(cam,'location',fr,loc);cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.keyframe_insert(data_path='rotation_euler',frame=fr)
 nt=bpy.data.node_groups.new('Filmic glow','CompositorNodeTree');scene.compositing_node_group=nt;nt.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor');r=nt.nodes.new('CompositorNodeRLayers');glow=nt.nodes.new('CompositorNodeGlare');glow.inputs['Type'].default_value='Fog Glow';glow.inputs['Quality'].default_value='High';glow.inputs['Threshold'].default_value=1.8;glow.inputs['Strength'].default_value=.2;out=nt.nodes.new('NodeGroupOutput');nt.links.new(r.outputs['Image'],glow.inputs['Image']);nt.links.new(glow.outputs['Image'],out.inputs['Image'])
 scene.frame_set(1);active(dom);bpy.ops.wm.save_as_mainfile(filepath=str(SCENE));return dom

def render_device(scene):
 if a.recipe=='overflow':
  scene.render.engine='CYCLES';scene.cycles.samples=16 if a.quality=='preview' else 24;scene.cycles.use_denoising=True;scene.cycles.max_bounces=8;scene.cycles.transmission_bounces=6
  prefs=bpy.context.preferences.addons['cycles'].preferences
  try:
   prefs.compute_device_type='METAL';prefs.get_devices()
   gpu=[d for d in prefs.devices if d.type=='METAL']
   if not gpu:raise RuntimeError('No Metal device')
   for device in prefs.devices:device.use=device.type=='METAL'
   scene.cycles.device='GPU'
  except (TypeError,RuntimeError):scene.cycles.device='CPU'

def existing():
 if not SCENE.exists():raise RuntimeError('Build the scene before baking/rendering')
 bpy.ops.wm.open_mainfile(filepath=str(SCENE));return bpy.data.objects['Simulation domain']

def write_receipt(dom):
 d=dom.modifiers['Mantaflow domain'].domain_settings;data={'recipe':a.recipe,'blender':bpy.app.version_string,'fps':FPS,'frameStart':1,'frameEnd':END,'resolution':d.resolution_max,'domain':d.domain_type,'viscosity':d.viscosity_value if d.use_viscosity else None,'bakedData':d.has_cache_baked_data,'scriptSha256':SOURCE_SHA}
 (WORK/'receipt.json').write_text(json.dumps(data,indent=2)+'\n');print('RECEIPT',json.dumps(data),flush=True)

if a.action in ['scene','bake']:
 dom=setup()
 if a.action=='bake':
  active(dom);print('BAKE START',a.recipe,a.quality,flush=True);bpy.ops.fluid.bake_data();d=dom.modifiers['Mantaflow domain'].domain_settings
  if d.domain_type=='LIQUID':bpy.ops.fluid.bake_mesh()
  bpy.ops.wm.save_as_mainfile(filepath=str(SCENE));write_receipt(dom)
else:
 dom=existing();scene=bpy.context.scene;render_device(scene)
 if a.action=='probe':
  probes=[]
  for frame in map(int,a.frames.split(',')):
   scene.frame_set(frame);deps=bpy.context.evaluated_depsgraph_get();obj=dom.evaluated_get(deps);probes.append({'frame':frame,'vertices':len(obj.data.vertices) if obj.type=='MESH' else None})
  print('PROBES',json.dumps(probes),flush=True)
 elif a.action=='stills':
  (WORK/'stills').mkdir(exist_ok=True)
  for frame in map(int,a.frames.split(',')):
   scene.frame_set(frame);scene.render.filepath=str(WORK/'stills'/f'{frame:06d}.png');bpy.ops.render.render(write_still=True)
 else:
  (WORK/'frames').mkdir(exist_ok=True);scene.frame_step=a.step;scene.render.filepath=str(WORK/'frames'/'frame-');bpy.ops.render.render(animation=True)
