"""Prepare the exact audio for a film: a verified local score, or generated music/SFX."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from urllib.parse import unquote

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def prepare(cues_path, page_path, output):
    spec = json.loads(cues_path.read_text())
    supplied = spec.get('audio')
    if supplied is not None:
        if not isinstance(supplied, dict) or not isinstance(supplied.get('src'), str) or not isinstance(supplied.get('sha256'), str):
            raise ValueError('__audio must contain a local src and sha256')
        src = unquote(supplied['src'])
        source = ((ROOT / src.lstrip('/')) if src.startswith('/') else (page_path.parent / src)).resolve()
        if not source.is_relative_to(ROOT) or not source.is_file():
            raise ValueError('The score must be a file inside this repository')
        if hashlib.sha256(source.read_bytes()).hexdigest() != supplied['sha256']:
            raise ValueError('Score hash differs from its analysed source; rebuild the signals')
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-of', 'json', str(source)]))
        if float(probe['format']['duration']) + .001 < spec['dur']:
            raise ValueError('Score is shorter than the authored film')
        # The recorder includes a frame at t=duration. Silence keeps -shortest
        # from discarding that endpoint when the score ends exactly at duration.
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(source), '-af', f"atrim=duration={spec['dur']},asetpts=PTS-STARTPTS,apad=pad_dur=1",
                        '-ar', '48000', '-c:a', 'pcm_f32le', str(output)], check=True)
        print('Using the verified analysed score: ' + str(source.relative_to(ROOT)))
    else:
        music, sfx = output.parent/'music.wav', output.parent/'sfx.wav'
        subprocess.run([sys.executable, str(HERE/'sfx.py'), str(cues_path), str(sfx)], check=True)
        subprocess.run([sys.executable, str(HERE/'music.py'), str(cues_path), str(music)], check=True)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(music), '-i', str(sfx),
                        '-filter_complex', '[0][1]amix=inputs=2:normalize=0,alimiter=limit=0.95:level=false:latency=true',
                        '-ar', '48000', '-c:a', 'pcm_f32le', str(output)], check=True)


if __name__ == '__main__':
    prepare(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve(), Path(sys.argv[3]).resolve())
