#!/usr/bin/env python3
"""Generate original dialogue, analyse its mouth cues, then publish one bundle."""
import argparse, hashlib, json, math, pathlib, subprocess, tempfile
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = pathlib.Path(__file__).resolve().parents[2]
LINES = [
    ('mira', 'Pip. Is the launch video ready?', 'ask', .55),
    ('pip', 'Yes. I made it more dramatic.', 'proud', .45),
    ('mira', 'How dramatic?', 'doubt', .35),
    ('pip', 'The progress bar has a cliffhanger.', 'explain', .85),
    ('mira', 'Please tell me you kept the original.', 'plead', .55),
    ('pip', 'Of course. Final. Final. Actually final.', 'count', .85),
    ('mira', 'Which one is it?', 'question', 1.05),
    ('pip', "That's the cliffhanger.", 'reveal', 1.55),
]
DEMO = [('mira', "Big plans. Small buttons. One very brave robot. Ready? Let's make some noise!", 'perform', .55), ('mira', 'Oh. You meant quiet.', 'doubt', 1.0)]

def run(*args):
    subprocess.run([str(a) for a in args], check=True, stdout=subprocess.DEVNULL)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', type=pathlib.Path, required=True)
    parser.add_argument('--voices', type=pathlib.Path, required=True)
    parser.add_argument('--rhubarb', type=pathlib.Path, required=True)
    args = parser.parse_args()
    kokoro = Kokoro(str(args.model), str(args.voices))
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp)
        manifest = {'version':1, 'generator':'Kokoro 1.0 / kokoro-onnx 0.5.0; Rhubarb 1.14.0', 'films':{}}
        for name, lines in [('character-dialogue', LINES), ('character-lipsync', DEMO)]:
            clips, turns, at = [], [], .45
            for i, (speaker, words, gesture, pause) in enumerate(lines):
                samples, sr = kokoro.create(words, voice='af_heart' if speaker=='mira' else 'bm_george', speed=.90 if speaker=='mira' else .97, lang='en-us' if speaker=='mira' else 'en-gb')
                # Trim only silence, retaining small attack/release pads before analysis.
                active = np.flatnonzero(np.abs(samples)>.004)
                if not len(active): raise ValueError('Silent speech')
                samples = samples[max(0,active[0]-int(.035*sr)):min(len(samples),active[-1]+int(.09*sr))]
                samples = samples / max(.2,float(np.max(np.abs(samples)))) * .56
                wav, cue, script = (out/f'{name}-{i}.{ext}' for ext in ['wav','json','txt'])
                sf.write(wav,samples,sr,subtype='PCM_16'); script.write_text(words)
                run(args.rhubarb, '-f','json','--extendedShapes','GHX','--dialogFile',script,'-o',cue,wav)
                mouth = json.loads(cue.read_text())['mouthCues']
                duration = len(samples)/sr
                if not mouth or not all(0<=c['start']<c['end']<=duration+.1 for c in mouth): raise ValueError('Invalid mouth analysis')
                turns.append({'speaker':speaker,'text':words,'gesture':gesture,'start':round(at,5),'end':round(at+duration,5),'mouth':mouth})
                clips.append((at,samples,sr));at += duration+pause
                print(name,i,speaker,round(duration,2),round(at,2),flush=True)
            duration = max(9.6 if name.endswith('lipsync') else 0,math.ceil(at*2)/2)
            sr=24000; mix=np.zeros((round(duration*sr),2),dtype=np.float64)
            for at, samples, rate in clips:
                assert rate==sr
                start=round(at*sr);mix[start:start+len(samples)]+=samples[:,None]*.7071
            # Quiet original plucked bed, keyboard clicks and the closing two-note sting.
            rng=np.random.default_rng(2709)
            for beat in np.arange(0,duration,.5):
                n=min(int(.48*sr),len(mix)-int(beat*sr));t=np.arange(n)/sr
                f=[110,138.59,164.81,207.65][int(beat*2)%4]
                sound=.009*np.sin(2*np.pi*f*t)*np.exp(-t*10)*(1-np.exp(-t*100))
                mix[int(beat*sr):int(beat*sr)+n]+=sound[:,None]
            for turn in turns:
                start=round(max(0,turn['start']-.16)*sr);n=int(.035*sr)
                click=.016*rng.normal(size=n)*np.exp(-np.arange(n)/(sr*.006))
                mix[start:start+n]+=click[:,None]
            fade=np.minimum(1,np.arange(len(mix))/(sr*.2))*np.minimum(1,(len(mix)-1-np.arange(len(mix)))/(sr*.6))
            mix*=fade[:,None]
            audio=out/f'{name}.wav';sf.write(audio,mix,sr,subtype='PCM_16')
            manifest['films'][name]={'duration':duration,'turns':turns,'audio':{'file':audio.name,'sha256':hashlib.sha256(audio.read_bytes()).hexdigest()},'title':'The Final Final' if name.endswith('dialogue') else 'Say it. Mean it.'}
        (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
        run('node', ROOT/'video/publish.cjs', out, ROOT/'assets/dialogue', 'manifest.json','character-dialogue.wav','character-lipsync.wav')
        print({k:v['duration'] for k,v in manifest['films'].items()})

if __name__ == '__main__': main()
