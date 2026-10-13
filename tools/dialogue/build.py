#!/usr/bin/env python3
"""Generate the original dialogue, analyse its mouth cues and word timing, mix it, publish one bundle.

    python tools/dialogue/build.py --model kokoro-v1.0.onnx --voices voices-v1.0.bin --rhubarb rhubarb

Each line is spoken by Kokoro, trimmed, analysed by Rhubarb with the exact script as a hint, and
timed word by word from Kokoro's own phoneme durations (see speak). Sound effects are generated from video/sfx.py and placed on
the same timeline as the beats the films animate. WAV and JSON publish together, or not at all.
"""
import argparse, hashlib, importlib.util, json, math, pathlib, re, subprocess, tempfile
import numpy as np
import onnxruntime
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = pathlib.Path(__file__).resolve().parents[2]
SR = 24000
# Speaker -> (Kokoro voice, language, speed). The bear uses af_jessica: of twelve stock voices it had
# the highest median pitch with a wide range (212 Hz, 11 semitones p10-p90), which suits a small,
# excitable plush; Pip keeps bm_george, a lower, drier voice that contrasts with it.
VOICES = {'bear': ('af_jessica', 'en-us', .97), 'pip': ('bm_george', 'en-gb', 1.0)}
# A line: speaker, text, gesture, pause after. A beat: a named silent stretch the picture fills.
FILMS = {
    'character-lipsync': {
        'title': 'Say it. Mean it.', 'lead': .42, 'tail': 1.75,
        'script': [
            ('bear', 'Wait. Who moved my pillow?', 'suspect', .18),
            ('bear', 'Not my pillow!', 'outburst', .38),
            ('bear', "Fine. I'm the fluffiest pillow here anyway. Ha!", 'smug', .42),
            {'replay': 1, 'faces': ['bear', 'pip'], 'gesture': 'split', 'pause': 1.55},
        ],
    },
    'character-dialogue': {
        'title': 'The Final Final', 'lead': 0, 'tail': 2.1,
        'script': [
            {'beat': 'hook', 'duration': 1.35},
            ('bear', 'Pip. Is the launch video ready?', 'ask', .22),
            ('pip', 'Yes. I made it more dramatic.', 'proud', .25),
            ('bear', 'How dramatic?', 'doubt', .15),
            {'beat': 'trailer', 'duration': 4.7},
            ('bear', 'Please tell me you kept the original.', 'plead', .22),
            ('pip', 'Of course. Final. Final. Actually final.', 'count', .25),
            ('bear', 'Which one is it?', 'question', .05),
            {'beat': 'loading', 'duration': 1.0},
            ('pip', "That's the cliffhanger.", 'reveal', .25),
            {'beat': 'end', 'duration': 0},
        ],
    },
}


TARGET_LUFS = -16.0


def lufs(path):
    """Integrated loudness (EBU R128) as measured by ffmpeg."""
    err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-af', 'ebur128', '-f', 'null', '-'], check=True, capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', err)[-1])


def emphasise(cues, samples):
    """Open the mouth further on stressed syllables, as an animator would.

    Rhubarb shows most short vowels as B (teeth almost closed). A B or C cue of at least 0.1 s whose
    level reaches 70% of the line's loudest cue opens one step (B -> C, C -> D). Cue timing and the
    other shapes are kept; the raw analysis is stored beside the result as `analysis`.
    """
    def rms(c):
        a, b = int(c['start'] * SR), max(int(c['start'] * SR) + 1, int(c['end'] * SR))
        return float(np.sqrt(np.mean(samples[a:b] ** 2)))
    peak = max(rms(c) for c in cues)
    out = []
    for c in cues:
        v = c['value']
        if v in 'BC' and c['end'] - c['start'] >= .099 and rms(c) >= .7 * peak: v = {'B': 'C', 'C': 'D'}[v]
        out.append({**c, 'value': v})
    return out


def run(*args):
    subprocess.run([str(a) for a in args], check=True, stdout=subprocess.DEVNULL)


def load_sfx():
    """The repository's generated sound library, resampled from 48 kHz to the speech rate."""
    spec = importlib.util.spec_from_file_location('sfx', ROOT / 'video/sfx.py'); mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    out = {}
    for name, samples in mod.build().items():
        x = np.asarray(samples, dtype=np.float64)
        x = np.convolve(x, [.25, .5, .25], mode='same')[::2]   # gentle low-pass, then decimate 2:1
        out[name] = x * mod.LEVEL.get(name, .3)
    rng = np.random.default_rng(1013)
    t = np.arange(int(.5 * SR)) / SR
    # Original extra sounds: a soft breath, a digital glitch, a springy ear flick and a card flip.
    breath = rng.normal(size=len(t)); breath = np.convolve(breath, np.ones(40) / 40, mode='same') * np.sin(np.pi * np.minimum(1, t / .42)) ** 2
    out['breath'] = .05 * breath / np.max(np.abs(breath))
    g = np.zeros(int(.6 * SR))
    for k in range(9):
        a = int(rng.uniform(0, .52) * SR); n = int(rng.uniform(.02, .07) * SR)
        crush = np.round(rng.normal(size=n) * 3) / 3 * .5 + np.sign(np.sin(2 * np.pi * rng.uniform(180, 900) * np.arange(n) / SR)) * .35
        g[a:a + n] += crush[:len(g) - a]
    out['glitch'] = .16 * g / np.max(np.abs(g))
    tt = np.arange(int(.35 * SR)) / SR
    out['boing'] = .1 * np.sin(2 * np.pi * (260 * tt + 900 * tt ** 2) + 3 * np.sin(2 * np.pi * 14 * tt)) * np.exp(-tt * 9)
    tf = np.arange(int(.14 * SR)) / SR
    flip = rng.normal(size=len(tf)) * np.exp(-tf * 30); flip = np.convolve(flip, np.ones(6) / 6, mode='same')
    out['flip'] = .12 * flip / np.max(np.abs(flip)) + .05 * np.sin(2 * np.pi * 1400 * tf) * np.exp(-tf * 50)
    return out


HOP = 600   # samples per Kokoro duration frame at 24 kHz


def _varint(n):
    out = bytearray()
    while True:
        b = n & 0x7f; n >>= 7; out.append(b | (0x80 if n else 0))
        if not n: return bytes(out)


def _read_varint(buf, i):
    shift = n = 0
    while True:
        b = buf[i]; i += 1; n |= (b & 0x7f) << shift; shift += 7
        if not b & 0x80: return n, i


def with_duration_output(model_bytes, name='/encoder/Round_output_0'):
    """The Kokoro graph with its rounded per-phoneme durations exposed as a second output.

    Only the ModelProto's graph field gains one output entry (protobuf wire format, so no onnx
    package is needed); the computation and the audio are unchanged.
    """
    field = lambda num, payload: _varint(num << 3 | 2) + _varint(len(payload)) + payload
    value_info = field(1, name.encode()) + field(2, field(1, _varint(1 << 3) + _varint(1)))   # float tensor
    out, i = bytearray(), 0
    while i < len(model_bytes):
        start = i; key, i = _read_varint(model_bytes, i); num, wire = key >> 3, key & 7
        if wire == 0: _, i = _read_varint(model_bytes, i)
        elif wire == 1: i += 8
        elif wire == 5: i += 4
        elif wire == 2:
            n, j = _read_varint(model_bytes, i); payload = model_bytes[j:j + n]; i = j + n
            if num == 7: out += field(7, bytes(payload) + field(12, value_info)); continue
        else: raise ValueError('Unexpected ONNX field')
        out += model_bytes[start:i]
    return bytes(out)


def speak(kokoro, session, text, voice, lang, speed):
    """Audio plus word spans (seconds from the start of the audio) from Kokoro's own phoneme durations."""
    batches = kokoro._split_phonemes(kokoro.tokenizer.phonemize(text, lang))
    if len(batches) != 1: raise ValueError('Line too long for one Kokoro pass: ' + text)
    phonemes = batches[0]; tokens = kokoro.tokenizer.tokenize(phonemes)
    if len(tokens) != len(phonemes): raise ValueError('Phoneme tokens do not map one to one')
    style = np.array(kokoro.voices[voice][len(tokens)], dtype=np.float32)
    audio, frames = session.run(None, {'tokens': [[0, *tokens, 0]], 'style': style, 'speed': np.ones(1, dtype=np.float32) * speed})
    frames = np.asarray(frames).reshape(-1).astype(int)
    if frames.sum() * HOP != len(audio): raise ValueError('Duration output does not match the audio length')
    edge = np.concatenate([[0], np.cumsum(frames)]) * HOP / SR     # edge[i] = start of token i (0 is the pad)
    words, spans, i = text.split(), [], 0
    groups = [m for m in re.finditer(r'[^ ]+', phonemes)]
    if len(groups) != len(words): raise ValueError(f'{len(words)} words but {len(groups)} phoneme groups: {phonemes}')
    for w, g in zip(words, groups):
        body = g.group(0).rstrip('.,?!;:')
        spans.append({'text': w, 'start': float(edge[g.start() + 1]), 'end': float(edge[g.start() + len(body) + 1])})
    return np.asarray(audio, dtype=np.float32), spans


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--model', type=pathlib.Path, required=True)
    parser.add_argument('--voices', type=pathlib.Path, required=True)
    parser.add_argument('--rhubarb', type=pathlib.Path, required=True)
    parser.add_argument('--keep', type=pathlib.Path, help='also copy each spoken clip and its analysis here, for review')
    args = parser.parse_args()
    kokoro = Kokoro(str(args.model), str(args.voices))
    session = onnxruntime.InferenceSession(with_duration_output(args.model.read_bytes()), providers=['CPUExecutionProvider'])
    sfx = load_sfx()
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp)
        manifest = {'version': 1, 'generator': 'Kokoro 1.0 / kokoro-onnx 0.5.0; Rhubarb 1.14.0; word spans from Kokoro phoneme durations',
                    'voices': {k: {'kokoro': v[0], 'lang': v[1], 'speed': v[2]} for k, v in VOICES.items()}, 'films': {}}
        for name, film in FILMS.items():
            clips, turns, beats, at = [], [], {}, film['lead']
            for i, item in enumerate(film['script']):
                if isinstance(item, dict) and 'beat' in item:
                    beats[item['beat']] = [round(at, 4), round(at + item['duration'], 4)]; at += item['duration']; continue
                if isinstance(item, dict) and 'replay' in item:
                    src = turns[item['replay']]; samples = clips[item['replay']][1]; duration = src['end'] - src['start']
                    turns.append({**src, 'faces': item['faces'], 'gesture': item['gesture'], 'replayOf': item['replay'], 'start': round(at, 5), 'end': round(at + duration, 5)})
                    clips.append((at, samples)); at += duration + item['pause']; continue
                speaker, words, gesture, pause = item
                voice, lang, speed = VOICES[speaker]
                samples, spans = speak(kokoro, session, words, voice, lang, speed)
                # Trim only silence, retaining small attack/release pads before analysis.
                active = np.flatnonzero(np.abs(samples) > .004)
                if not len(active): raise ValueError('Silent speech')
                a0 = max(0, active[0] - int(.035 * SR))
                samples = samples[a0:min(len(samples), active[-1] + int(.09 * SR))]
                timed = [{'text': w['text'], 'start': round(max(0, w['start'] - a0 / SR), 3), 'end': round(min(len(samples) / SR, w['end'] - a0 / SR), 3)} for w in spans]
                samples = samples / max(.2, float(np.max(np.abs(samples)))) * .56
                wav, cue, script = (out / f'{name}-{i}.{ext}' for ext in ['wav', 'json', 'txt'])
                sf.write(wav, samples, SR, subtype='PCM_16'); script.write_text(words)
                run(args.rhubarb, '-f', 'json', '--extendedShapes', 'GHX', '--dialogFile', script, '-o', cue, wav)
                analysis = json.loads(cue.read_text())['mouthCues']
                duration = len(samples) / SR
                if not analysis or not all(0 <= c['start'] < c['end'] <= duration + .1 for c in analysis): raise ValueError('Invalid mouth analysis')
                turns.append({'speaker': speaker, 'text': words, 'gesture': gesture, 'start': round(at, 5), 'end': round(at + duration, 5),
                              'mouth': emphasise(analysis, samples), 'analysis': [c['value'] for c in analysis], 'words': timed})
                if args.keep:
                    args.keep.mkdir(parents=True, exist_ok=True)
                    sf.write(args.keep / wav.name, samples, SR, subtype='PCM_16'); (args.keep / (wav.stem + '.json')).write_text(json.dumps(turns[-1], indent=1))
                clips.append((at, samples)); at += duration + pause
                print(name, i, speaker, round(duration, 2), round(at, 2), flush=True)
            beats.setdefault('end', [round(at, 4), round(at, 4)])
            duration = math.ceil((at + film['tail']) * 10) / 10
            beats['end'][1] = duration
            mix = np.zeros(round(duration * SR) + SR, dtype=np.float64)
            for start, samples in clips:
                s0 = round(start * SR); mix[s0:s0 + len(samples)] += samples
            effects = sound_design(name, turns, beats, duration)
            for at_s, sound, gain in effects:
                x = sfx[sound] * gain; s0 = max(0, round(at_s * SR)); mix[s0:s0 + len(x)] += x[:len(mix) - s0]
            # A quiet original plucked bed under everything.
            notes = [110, 138.59, 164.81, 207.65] if name == 'character-dialogue' else [261.63, 329.63, 392.0, 329.63]
            for beat in np.arange(0, duration, .5):
                n = min(int(.48 * SR), len(mix) - int(beat * SR)); t = np.arange(n) / SR
                f = notes[int(beat * 2) % 4]
                mix[int(beat * SR):int(beat * SR) + n] += (.009 if name == 'character-dialogue' else .006) * np.sin(2 * np.pi * f * t) * np.exp(-t * 10) * (1 - np.exp(-t * 100))
            mix = mix[:round(duration * SR)]
            fade = np.minimum(1, np.arange(len(mix)) / (SR * .05)) * np.minimum(1, (len(mix) - 1 - np.arange(len(mix))) / (SR * .5))
            mix = mix * fade
            audio = out / f'{name}.wav'
            sf.write(audio, np.stack([mix, mix], axis=1) * .7071, SR, subtype='FLOAT')
            gain = 10 ** ((TARGET_LUFS - lufs(audio)) / 20)
            stereo = np.stack([mix, mix], axis=1) * .7071 * gain
            peak = np.max(np.abs(stereo))
            if peak > .7: stereo = np.where(np.abs(stereo) < .7, stereo, np.sign(stereo) * (.7 + .19 * np.tanh((np.abs(stereo) - .7) / .19)))   # soft knee: peaks stay under 0.89
            sf.write(audio, stereo, SR, subtype='PCM_16')
            manifest['films'][name] = {'title': film['title'], 'duration': duration, 'beats': beats, 'sfx': [[round(a, 3), s] for a, s, _ in effects],
                                       'turns': turns, 'audio': {'file': audio.name, 'sha256': hashlib.sha256(audio.read_bytes()).hexdigest()}}
        (out / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
        run('node', ROOT / 'video/publish.cjs', out, ROOT / 'assets/dialogue', 'manifest.json', 'character-dialogue.wav', 'character-lipsync.wav')
        print({k: v['duration'] for k, v in manifest['films'].items()})


def sound_design(name, turns, beats, duration):
    """(seconds, sound, gain) cues; the films read the same beats and word times, so they agree."""
    word = lambda turn, k: turn['start'] + turn['words'][k]['start']
    if name == 'character-lipsync':
        cues = [(0.0, 'breath', 1), (turns[1]['start'] - .04, 'pop', .7), (turns[2]['end'] - .1, 'boing', .8)]
        split = turns[3]['start']
        cues += [(split - .32, 'whoosh', .9), (turns[3]['end'] + .45, 'boing', .7), (duration - 1.25, 'chime', .55)]
        return cues
    h0, h1 = beats['hook']; t0, t1 = beats['trailer']; l0, l1 = beats['loading']
    cues = [(h0 + .28, 'impact', 1.0), (h0 + .3, 'stamp', .8), (h0 + .55, 'pop', .5)]
    cues += [(t0, 'whoosh', 1.0), (t0 + .55, 'riser', .9)]
    cues += [(t0 + .6 + k * .19, 'tick', .45) for k in range(11)]
    cues += [(t0 + 2.75, 'tick', .5), (t0 + 3.1, 'tick', .5), (t0 + 3.35, 'glitch', 1.0), (t0 + 3.95, 'impact', .9), (t0 + 3.97, 'stamp', 1.0), (t1 - .1, 'whoosh', .6)]
    count = next(t for t in turns if t['gesture'] == 'count')
    finals = [k for k, w in enumerate(count['words']) if w['text'].lower().startswith('final')]
    cues += [(word(count, k) - .05, 'flip', 1.0) for k in finals]
    cues += [(l0 + .05 + k * .24, 'tick', .35) for k in range(4)]
    cues += [(beats['end'][0] + .05, 'impact', .6), (beats['end'][0] + .35, 'chime', .5)]
    return cues


if __name__ == '__main__':
    main()
