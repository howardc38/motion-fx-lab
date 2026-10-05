"""Publish a complete Blender beauty-frame sequence for deterministic browser replay.
python3 tools/blender/publish-frames.py .blender-cache/overflow-final assets/fluid/overflow
Only generated output is replaced, and only after validation. Caches stay outside Git.
"""
import argparse,json,pathlib,subprocess,tempfile,hashlib,shutil,struct,zlib,math
ROOT=pathlib.Path(__file__).resolve().parents[2]

def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for part in iter(lambda:f.read(1024*1024),b''):h.update(part)
 return h.hexdigest()

def validate_png(path):
 """Check each source before ffmpeg can rescale or conceal a damaged frame."""
 with path.open('rb') as f:
  if f.read(8)!=b'\x89PNG\r\n\x1a\n':raise ValueError(f'{path.name}: invalid PNG signature')
  first=True
  while True:
   header=f.read(8)
   if len(header)!=8:raise ValueError(f'{path.name}: truncated PNG chunk')
   length,kind=struct.unpack('>I4s',header);data=f.read(length);checksum=f.read(4)
   if len(data)!=length or len(checksum)!=4:raise ValueError(f'{path.name}: truncated {kind!r} chunk')
   if zlib.crc32(kind+data)&0xffffffff!=struct.unpack('>I',checksum)[0]:raise ValueError(f'{path.name}: damaged {kind!r} chunk')
   if first:
    if kind!=b'IHDR' or length!=13:raise ValueError(f'{path.name}: missing PNG header')
    size=struct.unpack('>II',data[:8])
    if size!=(1280,720):raise ValueError(f'{path.name}: expected 1280x720, found {size[0]}x{size[1]}')
    first=False
   if kind==b'IEND':break

def main():
 p=argparse.ArgumentParser();p.add_argument('work',type=pathlib.Path);p.add_argument('output',type=pathlib.Path);p.add_argument('--replace',action='store_true');a=p.parse_args();a.work=a.work.resolve();a.output=a.output.resolve()
 receipt=json.loads((a.work/'receipt.json').read_text());expected=receipt['frameEnd']-receipt['frameStart']+1
 if not receipt.get('bakedData'):p.error('A completed simulation bake is required')
 proof=json.loads((a.work/'simulation-proof.json').read_text())
 render=json.loads((a.work/'render-receipt.json').read_text())
 # Resolution belongs to scenes.py. Inspect the actual saved scene instead of
 # duplicating recipe settings here and rejecting an edited recipe after hours.
 if proof.get('resolution')!=receipt.get('resolution') or (proof.get('width'),proof.get('height'))!=(1280,720):p.error('Simulation proof must match the baked resolution and full-resolution scene')
 if (render['width'],render['height'],render['frames'],render['fps'])!=(1280,720,expected,30):p.error('Render receipt does not match the requested source')
 if len(proof.get('samples',[]))!=4:p.error('Simulation proof is missing')
 if receipt['fps']!=30 or expected!=289:p.error('Unexpected simulation timeline')
 expected_domain='GAS' if receipt['recipe']=='smoke' else 'LIQUID'
 if proof.get('domain')!=expected_domain:p.error('Simulation proof has the wrong domain')
 if expected_domain=='LIQUID' and any(x.get('vertices',0)<=8 for x in proof['samples']):p.error('Liquid mesh evidence is empty')
 if expected_domain=='GAS' and any(x.get('maxDensity',0)<=0 for x in proof['samples'][:2]):p.error('Smoke density evidence is empty')
 if receipt['recipe']=='viscous' and any(x.get('insideObstacleBeyondTolerance',1)>0 for x in proof['samples']):p.error('Obstacle collision check is missing or failed')
 scene_script=receipt.get('script','tools/blender/scenes.py')
 if scene_script not in ['tools/blender/scenes.py','tools/blender/liquid-scenes.py']:p.error('Unknown scene source')
 if sha(ROOT/scene_script)!=receipt['scriptSha256']:p.error('The scene source changed after baking; rebuild from the current recipe')
 mesh=None
 if receipt.get('revision')==2:
  mesh=json.loads((a.work/'mesh-receipt.json').read_text())
  if mesh.get('script')!='tools/blender/finish-mesh.py' or mesh.get('scriptSha256')!=sha(ROOT/'tools/blender/finish-mesh.py'):p.error('Mesh reconstruction source changed or is missing')
  if mesh.get('particleRadius')!=proof.get('meshParticleRadius'):p.error('Mesh reconstruction and inspection settings disagree')
 if receipt.get('revision')==2 and receipt['recipe']=='overflow':
  initial=proof.get('initialWaterVolume',0)
  finite=lambda x:isinstance(x,(int,float)) and math.isfinite(x)
  if not finite(initial) or initial<.5 or any(not finite(s.get('meshVolume')) or s['meshVolume']<initial*.7 or not finite(s.get('poolHeight')) or s['poolHeight']<=.8 for s in proof['samples']) or proof['samples'][-1]['poolHeight']<1.17:p.error('Water retention or rim-height evidence is missing or failed')
 if render.get('script') not in ['tools/blender/scenes.py','tools/blender/render.py']:p.error('Unknown render source')
 if sha(ROOT/render['script'])!=render['scriptSha256']:p.error('The render source changed after rendering')
 if a.output.exists() and not a.replace:p.error('Output exists; use --replace to replace this generated asset')
 frames=sorted((a.work/'frames').glob('frame-*.png'))
 if len(frames)!=expected:p.error(f'Expected {expected} source frames, found {len(frames)}')
 completed=(a.work/'render-receipt.json').stat().st_mtime_ns
 scene_changed=max((a.work/'scene.blend').stat().st_mtime_ns,render.get('startedAtNs',0))
 for frame in frames:
  changed=frame.stat().st_mtime_ns
  if not scene_changed <= changed <= completed:p.error(f'{frame.name}: timestamp {changed} outside completed render [{scene_changed}, {completed}]; do not publish a partial rerender')
 for i,frame in enumerate(frames,receipt['frameStart']):
  if frame.name!=f'frame-{i:04d}.png':p.error(f'{frame.name}: expected contiguous source frame frame-{i:04d}.png')
  try:validate_png(frame)
  except ValueError as e:p.error(str(e))
 a.output.parent.mkdir(parents=True,exist_ok=True);tmp=pathlib.Path(tempfile.mkdtemp(prefix='.fluid-',dir=a.output.parent))
 try:
  subprocess.run(['ffmpeg','-y','-v','error','-xerror','-err_detect','explode','-start_number',str(receipt['frameStart']),'-i',str(a.work/'frames/frame-%04d.png'),'-fps_mode','passthrough','-c:v','mjpeg','-q:v','2','-pix_fmt','yuvj444p','-start_number','0',str(tmp/'frame-%06d.jpg')],check=True,timeout=1800)
  files=sorted(tmp.glob('frame-*.jpg'))
  if len(files)!=expected:raise RuntimeError('Web frame conversion count mismatch')
  info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-of','json',str(files[0])]))['streams'][0]
  if (info['width'],info['height'])!=(1280,720):raise RuntimeError('Only full-resolution 1280x720 renders can be published')
  hashes={f.name:sha(f) for f in files};version=hashlib.sha256(json.dumps(hashes,sort_keys=True).encode()).hexdigest()[:16]
  data={'fps':receipt['fps'],'count':expected,'width':1280,'height':720,'pattern':'frame-%06d.jpg?v='+version,'version':version,'alpha':'opaque','recipe':receipt['recipe'],'blender':receipt['blender'],'sourceScript':scene_script,'sourceScriptSha256':receipt['scriptSha256'],'renderSource':render,'bakeResolution':receipt['resolution'],'sceneSha256':sha(a.work/'scene.blend'),'sourceFrameHashes':hashes}
  if mesh:data['meshSource']=mesh;shutil.copy2(a.work/'mesh-receipt.json',tmp/'mesh-receipt.json')
  (tmp/'manifest.json').write_text(json.dumps(data,indent=2)+'\n');shutil.copy2(a.work/'receipt.json',tmp/'receipt.json');shutil.copy2(a.work/'simulation-proof.json',tmp/'simulation-proof.json');shutil.copy2(a.work/'render-receipt.json',tmp/'render-receipt.json')
  # The existing publisher installs files/directories with rollback on failure.
  driver="const {publishBundle}=require('./video/publish.cjs');publishBundle(process.argv[1],process.argv[2],[process.argv[3]]).catch(e=>{console.error(e);process.exit(1)});"
  bundle=tmp.parent/(tmp.name+'-bundle');bundle.mkdir();tmp.rename(bundle/a.output.name)
  try:subprocess.run(['node','-e',driver,str(bundle),str(a.output.parent),a.output.name],cwd=ROOT,check=True,timeout=120)
  finally:shutil.rmtree(bundle,ignore_errors=True)
  print(f'Published {expected} validated frames to {a.output}')
 finally:shutil.rmtree(tmp,ignore_errors=True)
if __name__=='__main__':main()
