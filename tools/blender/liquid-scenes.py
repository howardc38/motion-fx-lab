"""Second-edition liquid studies: restrained inflow, legible vessels and studio light.
Run through build.py, or use --quality preview --action bake for a motion test.
"""
import argparse, hashlib, json, math, pathlib, sys
import bpy, bmesh
from mathutils import Vector
P=argparse.ArgumentParser()
P.add_argument('--recipe',choices=['overflow','viscous'],required=True)
P.add_argument('--work',type=pathlib.Path,required=True)
P.add_argument('--quality',choices=['preview','final'],default='preview')
P.add_argument('--action',choices=['scene','bake','stills'],default='scene')
P.add_argument('--frames',default='35,85,140,200,260,289')
a=P.parse_args(sys.argv[sys.argv.index('--')+1:]);WORK=a.work.resolve();WORK.mkdir(parents=True,exist_ok=True)
SOURCE_SHA=hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest();END=289

def active(o):
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o

def material(name,color,metal=0,rough=.25,transmit=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF')
 n.inputs['Base Color'].default_value=(*color,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough;n.inputs['Transmission Weight'].default_value=transmit
 n.inputs['IOR'].default_value=1.333 if transmit else 1.5
 return m

def assign(o,m):o.data.materials.append(m);return o

def cube(name,loc,scale,mat=None):
 bpy.ops.mesh.primitive_cube_add(size=2,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if mat:assign(o,mat)
 return o

def effector(o):
 active(o);m=o.modifiers.new('Fluid obstacle','FLUID');m.fluid_type='EFFECTOR';m.effector_settings.surface_distance=1.0;m.effector_settings.subframes=2
 return o

def smooth(o):
 for p in o.data.polygons:p.use_smooth=True
 return o

def flow(o,behavior,velocity=(0,0,0)):
 m=o.modifiers.new('Liquid source','FLUID');m.fluid_type='FLOW';f=m.flow_settings;f.flow_type='LIQUID';f.flow_behavior=behavior;f.surface_distance=.5;f.subframes=2
 if behavior=='INFLOW':
  f.use_initial_velocity=True;f.velocity_coord=velocity
 o.hide_render=True;o.display_type='WIRE';return f

def source(name,loc,radius,velocity,end):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=radius,location=loc);o=bpy.context.object;o.name=name;f=flow(o,'INFLOW',velocity)
 for frame,on in [(1,True),(end,True),(end+1,False)]:f.use_inflow=on;f.keyframe_insert(data_path='use_inflow',frame=frame)
 return o

def revolve(name,profile,mat):
 n=128;verts=[(r*math.cos(i*2*math.pi/n),r*math.sin(i*2*math.pi/n),z) for r,z in profile for i in range(n)];faces=[]
 for j in range(len(profile)-1):
  for i in range(n):k=j*n+i;l=j*n+(i+1)%n;faces.append((k,l,l+n,k+n))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
 o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);assign(o,mat);smooth(o);return o

def light(name,loc,power,size,target=(0,0,1),color=(1,1,1),height=None):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.size=size
 if height:d.shape='RECTANGLE';d.size_y=height
 o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()

def camera(scene,poses,target,lens):
 bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='Material camera';scene.camera=cam;cam.data.lens=lens
 aim=bpy.data.objects.new('Camera focus',None);scene.collection.objects.link(aim);aim.location=target
 c=cam.constraints.new('TRACK_TO');c.target=aim;c.track_axis='TRACK_NEGATIVE_Z';c.up_axis='UP_Y'
 for frame,loc in poses:cam.location=loc;cam.keyframe_insert(data_path='location',frame=frame)

if a.action=='stills':
 bpy.ops.wm.open_mainfile(filepath=str(WORK/'scene.blend'));scene=bpy.context.scene
else:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.render.resolution_x=640 if a.quality=='preview' else 1280;scene.render.resolution_y=360 if a.quality=='preview' else 720;scene.render.resolution_percentage=100;scene.render.fps=30;scene.frame_start=1;scene.frame_end=END
 scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
 scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.16,.18,.22,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35
 bpy.context.preferences.edit.keyframe_new_interpolation_type='LINEAR'
 ivory=material('Satin ivory ceramic',(.8,.76,.68),0,.2);floor=material('Deep plum studio',(.025,.009,.019),.2,.32)
 effector(cube('Ground',(0,0,-.17),(200,200,.15),floor))
 profile=[(-20,-.02),(3,-.02)]+[(3+3*math.sin(i*math.pi/40),2.98-3*math.cos(i*math.pi/40)) for i in range(1,21)]+[(6,20)]
 verts=[(x,y,z) for y,z in profile for x in [-20,20]];faces=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(profile)-1)]
 mesh=bpy.data.meshes.new('Studio sweep');mesh.from_pydata(verts,[],faces);back=bpy.data.objects.new('Curved studio backdrop',mesh);bpy.context.collection.objects.link(back);assign(back,floor);smooth(back)

 if a.recipe=='overflow':
  water=material('Water',(.96,.99,1),0,.045,1)
  dom=cube('Simulation domain',(0,0,1.05),(1.9,1.9,1.3),water)
  profile=[(0,.12),(.61,.12),(.73,.23),(1.08,1.06),(1.12,1.22),(.94,1.22),(.92,1.05),(.64,.40),(0,.40)]
  effector(revolve('Open vessel',profile,ivory))
  # A real initial liquid volume fits entirely inside the closed vessel.
  bpy.ops.mesh.primitive_cone_add(vertices=96,radius1=.59,radius2=.88,depth=.67,location=(0,0,.755));o=bpy.context.object;o.name='Initial water';flow(o,'GEOMETRY')
  source('Gentle water inflow',(0,0,1.68),.11,(0,0,-1.0),205)
  nozzle=material('Brushed steel spout',(.32,.35,.39),.85,.24)
  revolve('Water inlet',[(.22,1.59),(.22,3.8),(.18,3.8),(.18,1.59),(.22,1.59)],nozzle)
  camera(scene,[(1,(3.7,-5.5,4.0)),(END,(3.0,-5.4,3.4))],(0,0,.91),52)
  light('Large white reflection',(-3,-3,5),650,3.5,height=2.2)
  light('Long rim reflection',(2,2,4),900,3.5,height=.6)
  light('Soft frontal fill',(0,-4,2),220,3)
 else:
  gold=material('Liquid gold',(.83,.49,.105),1,.18);ivory=material('Black glazed ceramic',(.025,.029,.038),0,.21)
  dom=cube('Simulation domain',(0,-.05,1.42),(1.45,.62,1.65),gold)
  bpy.ops.mesh.primitive_torus_add(major_radius=.82,minor_radius=.20,major_segments=128,minor_segments=32,location=(0,0,1.25),rotation=(math.pi/2,0,0));form=bpy.context.object;form.name='Porcelain loop';assign(form,ivory);smooth(form);effector(form);form.modifiers['Fluid obstacle'].effector_settings.surface_distance=.5
  bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=1.3,depth=.30,location=(0,0,.08));ped=bpy.context.object;ped.name='Low display plinth';assign(ped,floor);effector(ped)
  src=source('Fine gold stream',(-.52,-.12,2.70),.105,(0,-.05,-.5),165)
  for frame,x in [(1,-.52),(85,-.05),(165,.42)]:src.location.x=x;src.keyframe_insert(data_path='location',frame=frame)
  camera(scene,[(1,(.35,-6.5,2.8)),(END,(.05,-5.9,2.4))],(0,0,1.25),50)
  light('Tall softbox',(-2,-3,4),600,2.5,height=4)
  light('White edge',(2.2,.8,3),1000,1.0,height=3)
  light('Front strip',(.8,-4,1.4),180,1,height=2.5)
 active(dom);mod=dom.modifiers.new('Mantaflow domain','FLUID');mod.fluid_type='DOMAIN';d=mod.domain_settings;d.domain_type='LIQUID';d.cache_type='MODULAR';d.cache_directory=str(WORK/'cache');d.cache_frame_start=1;d.cache_frame_end=END
 d.resolution_max=(64 if a.recipe=='overflow' else 72) if a.quality=='preview' else (128 if a.recipe=='overflow' else 96);d.cache_data_format='UNI';d.cache_mesh_format='BOBJECT';d.timesteps_min=2;d.timesteps_max=8;d.time_scale=.8 if a.recipe=='overflow' else .7;d.flip_ratio=.97 if a.recipe=='overflow' else .9
 for side in ['front','back','left','right','top']:setattr(d,'use_collision_border_'+side,False)
 d.use_mesh=True;d.mesh_scale=2;d.mesh_particle_radius=1.15;d.mesh_smoothen_pos=2;d.mesh_smoothen_neg=2;d.use_fractions=False
 if a.recipe=='viscous':d.use_viscosity=True;d.viscosity_value=.025
 ng=bpy.data.node_groups.new('Smooth liquid','GeometryNodeTree');ng.interface.new_socket(name='Geometry',in_out='INPUT',socket_type='NodeSocketGeometry');ng.interface.new_socket(name='Geometry',in_out='OUTPUT',socket_type='NodeSocketGeometry');i=ng.nodes.new('NodeGroupInput');s=ng.nodes.new('GeometryNodeSetShadeSmooth');s.inputs['Shade Smooth'].default_value=True;o=ng.nodes.new('NodeGroupOutput');ng.links.new(i.outputs['Geometry'],s.inputs['Geometry']);ng.links.new(s.outputs['Geometry'],o.inputs['Geometry']);dom.modifiers.new('Smooth normals','NODES').node_group=ng
 scene.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'scene.blend'))
 if a.action=='bake':
  active(dom);bpy.ops.fluid.bake_data();bpy.ops.fluid.bake_mesh();bpy.ops.wm.save_as_mainfile(filepath=str(WORK/'scene.blend'))
  receipt={'recipe':a.recipe,'revision':2,'blender':bpy.app.version_string,'fps':30,'frameStart':1,'frameEnd':END,'resolution':d.resolution_max,'domain':'LIQUID','viscosity':d.viscosity_value if d.use_viscosity else None,'bakedData':d.has_cache_baked_data,'script':'tools/blender/liquid-scenes.py','scriptSha256':SOURCE_SHA}
  (WORK/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');print('RECEIPT',json.dumps(receipt),flush=True)
if a.action=='stills':
 scene.cycles.samples=12;scene.cycles.use_denoising=True
 prefs=bpy.context.preferences.addons['cycles'].preferences
 try:
  prefs.compute_device_type='METAL';prefs.get_devices()
  for device in prefs.devices:device.use=device.type=='METAL'
  scene.cycles.device='GPU'
 except (TypeError,RuntimeError):scene.cycles.device='CPU'
 (WORK/'stills').mkdir(exist_ok=True)
 for frame in map(int,a.frames.split(',')):
  scene.frame_set(frame);scene.render.filepath=str(WORK/'stills'/f'{frame:06d}.png');bpy.ops.render.render(write_still=True)
