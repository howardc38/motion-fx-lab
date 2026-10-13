"""Prepare the exact audio for a film: a verified local score, or generated music/SFX."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import unquote

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PROJECT_ROOT = Path(os.environ.get('FX_PROJECT_ROOT', ROOT)).resolve()


def checked_source(supplied, page_path):
    if not isinstance(supplied, dict) or not isinstance(supplied.get('src'), str) or not isinstance(supplied.get('sha256'), str):
        raise ValueError('Audio requires a local src and sha256')
    src = unquote(supplied['src'])
    source = ((PROJECT_ROOT / src.lstrip('/')) if src.startswith('/') else (page_path.parent / src)).resolve()
    if src.startswith('/') and not source.exists():
        source = (ROOT / src.lstrip('/')).resolve()
    if not any(source.is_relative_to(root) for root in (ROOT, PROJECT_ROOT)) or not source.is_file():
        raise ValueError('Audio must be a file inside this repository')
    if hashlib.sha256(source.read_bytes()).hexdigest() != supplied['sha256']:
        raise ValueError('Audio hash differs from its analysed source')
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-of', 'json', str(source)]))
    return source, float(probe['format']['duration'])


def overlay_layers(spec, page_path, output):
    import math
    layers = spec.get('audioLayers') or []
    if not isinstance(layers, list) or len(layers)>16:
        raise ValueError('Use at most 16 audio layers')
    if not layers: return
    inputs, filters, envelopes = [], [], []
    for i, layer in enumerate(layers, 1):
        source, available = checked_source(layer, page_path)
        at, start, duration, gain, duck = [layer.get(k, d) for k,d in [('at',0),('offset',0),('duration',0),('gain',1),('duck',.2)]]
        if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in [at,start,duration,gain,duck]):
            raise ValueError('Audio layer times and gains must be finite')
        if at<0 or start<0 or duration<=0 or at+duration>spec['dur']+.001 or start+duration>available+.001 or not 0<=gain<=4 or not 0<=duck<=1:
            raise ValueError('Audio layer lies outside its source or timeline')
        inputs += ['-i', str(source)]
        filters.append(f'[{i}:a]atrim=start={start}:duration={duration},asetpts=PTS-STARTPTS,afade=t=in:d=0.006,afade=t=out:st={max(0,duration-.006)}:d=0.006,volume={gain},adelay={round(at*1000)}:all=1[l{i}]')
        envelopes.append(f'(1-{1-duck}*max(0,min(1,min((t-{at-.1})/0.1,({at+duration+.2}-t)/0.2))))')
    filters.insert(0,"[0:a]volume='"+'*'.join(envelopes)+"':eval=frame[bed]")
    filters.append('[bed]'+''.join(f'[l{i}]' for i in range(1,len(layers)+1))+f'amix=inputs={len(layers)+1}:normalize=0:duration=first,alimiter=limit=0.95:level=false:latency=true[out]')
    mixed=output.with_name(output.stem+'-layered.wav')
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(output),*inputs,'-filter_complex',';'.join(filters),'-map','[out]','-ar','48000','-c:a','pcm_f32le',str(mixed)],check=True)
    mixed.replace(output)


def prepare(cues_path, page_path, output):
    spec = json.loads(cues_path.read_text())
    supplied = spec.get('audio')
    if supplied is not None:
        if not isinstance(supplied, dict) or not isinstance(supplied.get('src'), str) or not isinstance(supplied.get('sha256'), str):
            raise ValueError('__audio must contain a local src and sha256')
        src = unquote(supplied['src'])
        source = ((PROJECT_ROOT / src.lstrip('/')) if src.startswith('/') else (page_path.parent / src)).resolve()
        if src.startswith('/') and not source.exists():
            source = (ROOT / src.lstrip('/')).resolve()
        if not any(source.is_relative_to(root) for root in (ROOT, PROJECT_ROOT)) or not source.is_file():
            raise ValueError('The score must be a file inside this repository or the selected project')
        if hashlib.sha256(source.read_bytes()).hexdigest() != supplied['sha256']:
            raise ValueError('Score hash differs from its analysed source; rebuild the signals')
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-of', 'json', str(source)]))
        if float(probe['format']['duration']) + .001 < spec['dur']:
            raise ValueError('Score is shorter than the authored film')
        # The recorder includes a frame at t=duration. Silence keeps -shortest
        # from discarding that endpoint when the score ends exactly at duration.
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(source), '-af', f"atrim=duration={spec['dur']},asetpts=PTS-STARTPTS,apad=pad_dur=1",
                        '-ar', '48000', '-c:a', 'pcm_f32le', str(output)], check=True)
        print('Using the verified analysed score: ' + str(source))
    else:
        music, sfx = output.parent/'music.wav', output.parent/'sfx.wav'
        subprocess.run([sys.executable, str(HERE/'sfx.py'), str(cues_path), str(sfx)], check=True)
        subprocess.run([sys.executable, str(HERE/'music.py'), str(cues_path), str(music)], check=True)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(music), '-i', str(sfx),
                        '-filter_complex', '[0][1]amix=inputs=2:normalize=0,alimiter=limit=0.95:level=false:latency=true',
                        '-ar', '48000', '-c:a', 'pcm_f32le', str(output)], check=True)
    overlay_layers(spec, page_path, output)


if __name__ == '__main__':
    prepare(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve(), Path(sys.argv[3]).resolve())
