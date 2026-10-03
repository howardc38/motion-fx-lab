"""Create fixed-FPS RGBA frames for deterministic sampling.
python3 video/import-clip.py source.mp4 assets/studio/fight --fps 24 --key 0x00ff00
Writes atomically to a new directory; refuses to overwrite without --replace.
"""
import argparse, json, pathlib, subprocess, tempfile, shutil, hashlib

def main():
    p=argparse.ArgumentParser();p.add_argument('source',type=pathlib.Path);p.add_argument('output',type=pathlib.Path)
    p.add_argument('--fps',type=int,default=24);p.add_argument('--width',type=int,default=640);p.add_argument('--height',type=int,default=360)
    p.add_argument('--key');p.add_argument('--replace',action='store_true');a=p.parse_args()
    if not a.source.is_file() or min(a.fps,a.width,a.height)<=0:p.error('Source and dimensions must be valid')
    if a.output.exists() and not a.replace:p.error('Output exists; use --replace to rebuild')
    a.output.parent.mkdir(parents=True,exist_ok=True)
    work=pathlib.Path(tempfile.mkdtemp(prefix='.frames-',dir=a.output.parent))
    try:
        filters=[f'fps={a.fps}',f'scale={a.width}:{a.height}:force_original_aspect_ratio=decrease',f'pad={a.width}:{a.height}:(ow-iw)/2:(oh-ih)/2:color=0x00ff00' if a.key else f'pad={a.width}:{a.height}:(ow-iw)/2:(oh-ih)/2:color=black@0']
        if a.key:filters += [f'chromakey={a.key}:0.12:0.04','despill=green']
        filters+=['format=rgba']
        subprocess.run(['ffmpeg','-y','-v','error','-i',str(a.source),'-vf',','.join(filters),'-start_number','0',str(work/'frame-%06d.png')],check=True,timeout=300)
        frames=sorted(work.glob('frame-*.png'))
        if not frames:raise ValueError('No frames decoded')
        data={'fps':a.fps,'count':len(frames),'width':a.width,'height':a.height,'pattern':'frame-%06d.png','sourceSha256':hashlib.sha256(a.source.read_bytes()).hexdigest(),'alpha':'keyed' if a.key else 'preserved'}
        (work/'manifest.json').write_text(json.dumps(data,indent=2)+'\n')
        backup=None
        if a.output.exists():
            backup=pathlib.Path(tempfile.mkdtemp(prefix='.previous-frames-',dir=a.output.parent));backup.rmdir();a.output.rename(backup)
        try:work.rename(a.output)
        except BaseException:
            if backup:backup.rename(a.output)
            raise
        if backup:shutil.rmtree(backup)
        print(f'{len(frames)} RGBA frames at {a.fps} fps -> {a.output}')
    finally:
        if work.exists():shutil.rmtree(work)

if __name__=='__main__':main()
