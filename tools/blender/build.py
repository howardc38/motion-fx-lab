"""Optional offline rebuild. Never needed to watch/export the checked-in film plates.
python3 tools/blender/build.py overflow [--replace]
"""
import argparse,pathlib,subprocess,shutil,os,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('recipe',choices=['overflow','viscous','smoke']);p.add_argument('--replace',action='store_true');p.add_argument('--keep-work',action='store_true');a=p.parse_args()
blender=os.environ.get('BLENDER_BIN') or shutil.which('blender')
if not blender:p.error('Blender 5.2 LTS is required only for rebuilding: install Blender or set BLENDER_BIN')
output=ROOT/'assets/fluid'/a.recipe
if output.exists() and not a.replace:p.error('Published frames exist; pass --replace to rebuild them')
cache=ROOT/'.blender-cache';cache.mkdir(exist_ok=True);work=pathlib.Path(tempfile.mkdtemp(prefix=a.recipe+'-',dir=cache))
scene_script='liquid-scenes.py' if a.recipe in ['overflow','viscous'] else 'scenes.py'
base=[blender,'-b','--factory-startup','--python-exit-code','2','--python',str(ROOT/'tools/blender'/scene_script),'--','--recipe',a.recipe,'--work',str(work),'--quality','final']
try:
 subprocess.run([*base,'--action','bake'],cwd=ROOT,check=True)
 if a.recipe in ['overflow','viscous']:
  subprocess.run([blender,'-b','--factory-startup','--python-exit-code','2','--python',str(ROOT/'tools/blender/finish-mesh.py'),'--',str(work)],cwd=ROOT,check=True)
 subprocess.run([blender,'-b','--factory-startup','--python-exit-code','2','--python',str(ROOT/'tools/blender/inspect-bake.py'),'--',str(work)],cwd=ROOT,check=True)
 subprocess.run([blender,'-b','--factory-startup','--python-exit-code','2','--python',str(ROOT/'tools/blender/render.py'),'--','--recipe',a.recipe,'--work',str(work)],cwd=ROOT,check=True)
 subprocess.run(['python3',str(ROOT/'tools/blender/publish-frames.py'),str(work),str(output),*(['--replace'] if a.replace else [])],cwd=ROOT,check=True)
 if not a.keep_work:shutil.rmtree(work)
 else:print('Completed cache retained for rerendering:',work)
 print('Frame asset is ready. Render the HTML film with video/build.sh.')
except BaseException:
 print('Incomplete work retained for diagnosis:',work)
 raise
