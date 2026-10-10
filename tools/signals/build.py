"""Build an original score and measured audio / image-motion caches.

python tools/signals/build.py [--replace] [--source assets/studio/fight]
Use --audio input.wav to analyse an existing score instead of synthesising one.
"""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import tempfile
import wave

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
FPS = 60
DURATION = 12.0


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_wav(path, audio, rate):
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(audio.shape[1] if audio.ndim == 2 else 1)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(np.round(np.clip(audio, -1, 1) * 32767).astype('<i2').tobytes())


def original_score(path):
    """Twelve seconds of percussion, sub bass and pitched metallic strikes."""
    sr = 48000
    out = np.zeros(round(DURATION * sr), dtype=np.float64)
    rng = np.random.default_rng(507)

    def add(at, sound, gain=1):
        i = round(at * sr)
        n = min(len(sound), len(out) - i)
        if i >= 0 and n > 0:
            out[i:i + n] += sound[:n] * gain

    def kick():
        t = np.arange(round(sr * .42)) / sr
        phase = 2 * np.pi * (43 * t + 105 / 31 * (1 - np.exp(-31 * t)))
        return np.sin(phase) * np.exp(-10 * t) * np.minimum(1, t / .002)

    for i in range(20):
        at = i * .6
        # Clear quiet passages make signal-driven geometry easy to distinguish.
        if 4.8 <= at < 6 or 9.6 <= at < 10.8:
            continue
        level = .58 if at < 2.4 else .94
        add(at, kick(), level)
        t = np.arange(round(sr * .32)) / sr
        f = [55, 55, 65.406, 49][(i // 4) % 4]
        bass = (np.sin(2*np.pi*f*t) + .25*np.sin(2*np.pi*f*2*t)) * np.exp(-8*t)
        add(at + .15, bass, .23 * level)
        # Midrange chord body keeps the bass-heavy score audible after mastering.
        u = np.arange(round(sr * .55)) / sr
        pad = (np.sin(2*np.pi*220*u) + .6*np.sin(2*np.pi*330*u) + .4*np.sin(2*np.pi*440*u))
        pad *= np.sin(np.pi*u/.55)**.6 * np.exp(-u*1.8)
        add(at + .025, pad, .16 * level)
        if i % 2:
            t = np.arange(round(sr * .18)) / sr
            noise = rng.uniform(-1, 1, len(t))
            snap = (noise - np.roll(noise, 1)) * np.exp(-30*t)
            add(at, snap, .18)
        t = np.arange(round(sr * .45)) / sr
        bell = sum(np.sin(2*np.pi*440*k*t)*np.exp(-t*(8+k)) / (k*2) for k in [1, 1.503, 2.07])
        add(at + .3, bell, .095)
    for i in range(80):
        at = i * .15
        if 4.8 <= at < 5.7 or 9.6 <= at < 10.5:
            continue
        t = np.arange(round(sr * .045)) / sr
        noise = rng.uniform(-1, 1, len(t))
        add(at, (noise - np.roll(noise, 1)) * np.exp(-95*t), .045 if i % 2 else .08)
    # An audible lift into the two returns, generated from noise and a chirp.
    for at in [5.55, 10.35]:
        t = np.arange(round(sr * .45)) / sr
        add(at, (rng.uniform(-1, 1, len(t))*.12 + np.sin(2*np.pi*(180*t+1200*t*t))*.05) * (t/.45)**2, .4)
    out *= np.minimum(1, (DURATION - np.arange(len(out))/sr) / .24)
    out = np.tanh(out * 1.15) * .85
    write_wav(path, np.column_stack((out, out)), sr)


def read_audio(path):
    duration = float(json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-of', 'json', str(path)]))['format']['duration'])
    if not 0 < duration <= 300:
        raise ValueError('Analyse a score between 0 and 300 seconds')
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '1', '-ar', '48000', '-'])
    y = np.frombuffer(raw, dtype='<f4').copy()
    if not len(y) or not np.isfinite(y).all():
        raise ValueError('Audio is empty or nonfinite')
    return y, 48000


def audio_features(y, sr, fps=FPS):
    duration = len(y) / sr
    nfft = 2048
    window = np.hanning(nfft)
    edges = np.geomspace(40, min(16000, sr / 2), 33)
    frequencies = np.fft.rfftfreq(nfft, 1/sr)
    frames, rms, bands = math.ceil(duration * fps), [], []
    padded = np.pad(y, (nfft // 2, nfft // 2))
    for i in range(frames):
        start = round(i * sr / fps)
        chunk = padded[start:start + nfft]
        if len(chunk) < nfft:
            chunk = np.pad(chunk, (0, nfft-len(chunk)))
        rms.append(float(np.sqrt(np.mean(chunk * chunk))))
        power = np.abs(np.fft.rfft(chunk * window)) ** 2
        bands.append([float(np.sqrt(np.mean(power[(frequencies >= a) & (frequencies < b)])))
                      if np.any((frequencies >= a) & (frequencies < b)) else 0
                      for a, b in zip(edges[:-1], edges[1:])])
    values = np.array(rms)
    scale = max(float(np.quantile(values, .97)), 1e-8)
    spectral = np.array(bands)
    spectral_peak = max(float(np.quantile(spectral, .995)), 1e-8)
    # A shared -50dB..0dB scale preserves relative energy across frequency bands.
    spectral = np.clip(1 + .4 * np.log10(np.maximum(spectral / spectral_peak, 1e-8)), 0, 1)
    envelope = np.clip(values / scale, 0, 1)
    # Positive short-window energy change locates attacks in the measured PCM.
    novelty = np.maximum(0, np.diff(envelope, prepend=0))
    threshold = max(.06, float(np.quantile(novelty, .85)))
    onsets = []
    for i in range(1, frames-1):
        if novelty[i] >= threshold and novelty[i] >= novelty[i-1] and novelty[i] > novelty[i+1]:
            if not onsets or i/fps-onsets[-1] >= .18:
                onsets.append(round(i / fps, 6))
    return {'fps': fps, 'count': frames, 'duration': duration,
            'rmsScale': scale, 'rms': np.round(values, 7).tolist(),
            'envelope': np.round(envelope, 5).tolist(),
            'bands': np.round(np.clip(spectral, 0, 1), 5).tolist(),
            'bandEdgesHz': np.round(edges, 2).tolist(), 'onsets': onsets}


def current_flow(previous, current):
    """Negated backward flow estimates velocity at CURRENT pixel positions."""
    a = cv2.cvtColor(previous[:, :, :3], cv2.COLOR_RGBA2GRAY)
    b = cv2.cvtColor(current[:, :, :3], cv2.COLOR_RGBA2GRAY)
    a[previous[:, :, 3] < 32] = 0
    b[current[:, :, 3] < 32] = 0
    flow = -cv2.calcOpticalFlowFarneback(b, a, None, .5, 4, 21, 4, 7, 1.5, 0)
    flow[current[:, :, 3] < 32] = 0
    return flow


def analyse_frames(source, target, grid_width=160, period=4.8):
    manifest_path = source / 'manifest.json'
    spec = json.loads(manifest_path.read_text())
    width, height, count, fps = (spec[k] for k in ['width', 'height', 'count', 'fps'])
    if min(width, height, count, fps) <= 0 or count > 20000 or '%06d' not in spec['pattern']:
        raise ValueError('Invalid source manifest')
    if not 0 < period <= count / fps:
        raise ValueError('Source loop exceeds the available frames')
    gh = round(grid_width * height / width)
    if grid_width < 1 or gh < 1 or count * gh * grid_width * 8 > 200_000_000:
        raise ValueError('Measured sample cache exceeds the 200MB working budget')
    aw = min(width, 320)
    ah = round(aw * height / width)
    dtype = np.dtype([('rgba', 'u1', (4,)), ('flow', '<i2', (2,))])
    records = np.zeros((count, gh, grid_width), dtype=dtype)
    source_hash = hashlib.sha256(manifest_path.read_bytes())
    previous = None
    energies = []
    for i in range(count):
        path = source / spec['pattern'].replace('%06d', f'{i:06}')
        image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        if image is None or image.shape[:2] != (height, width) or image.shape[2] != 4:
            raise ValueError('Expected fixed-size RGBA source: ' + str(path))
        source_hash.update(path.read_bytes())
        rgba = cv2.cvtColor(image, cv2.COLOR_BGRA2RGBA)
        small = cv2.resize(rgba, (aw, ah), interpolation=cv2.INTER_AREA)
        flow = np.zeros((ah, aw, 2), np.float32) if previous is None else current_flow(previous, small)
        alpha = small[:, :, 3].astype(np.float32) / 255
        weighted = cv2.resize(flow * alpha[:, :, None], (grid_width, gh), interpolation=cv2.INTER_AREA)
        mask = cv2.resize(alpha, (grid_width, gh), interpolation=cv2.INTER_AREA)
        weighted /= np.maximum(mask[:, :, None], .01)
        weighted *= width / aw
        weighted[mask < .3] = 0
        records[i]['rgba'] = cv2.resize(rgba, (grid_width, gh), interpolation=cv2.INTER_AREA)
        records[i]['flow'] = np.round(np.clip(weighted, -127, 127)*256).astype('<i2')
        energies.append(float(np.mean(np.linalg.norm(weighted, axis=2))))
        previous = small
    records.tofile(target)
    return {'fps': fps, 'count': count, 'period': period, 'width': width, 'height': height,
            'gridWidth': grid_width, 'gridHeight': gh, 'stride': 8,
            'layout': 'rgba8-flow2-i16le', 'flowScale': 256,
            'flowUnits': 'source pixels per frame, at current-frame positions',
            'algorithm': 'OpenCV Farneback: negated current-to-previous dense flow',
            'opencvVersion': cv2.__version__, 'sourceSha256': source_hash.hexdigest(),
            'samplesSha256': digest(target), 'motionEnergy': np.round(energies, 5).tolist()}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', type=Path, default=ROOT/'assets/studio/fight')
    p.add_argument('--audio', type=Path)
    p.add_argument('--output', type=Path, default=ROOT/'assets/signals')
    p.add_argument('--period', type=float, default=4.8)
    p.add_argument('--replace', action='store_true')
    args = p.parse_args()
    output = args.output.resolve()
    if output.exists() and not args.replace:
        p.error('Output exists; use --replace to rebuild the complete bundle')
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.signal-build-', dir=output.parent) as folder:
        work = Path(folder)
        bundle = work / output.name
        bundle.mkdir()
        score = bundle / 'score.wav'
        if args.audio:
            info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels', '-show_format', '-of', 'json', str(args.audio)]))
            if not 0 < float(info['format']['duration']) <= 300:
                raise ValueError('Analyse a score between 0 and 300 seconds')
            channels = info['streams'][0]['channels']
            if channels not in (1, 2):
                raise ValueError('Use a mono or stereo source score')
            filters = ['-af', 'pan=stereo|c0=c0|c1=c0'] if channels == 1 else []
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(args.audio), '-map', '0:a:0', *filters, '-ar', '48000', '-c:a', 'pcm_s16le', str(score)], check=True)
        else:
            original_score(score)
        y, sr = read_audio(score)
        audio = audio_features(y, sr)
        audio.update({'file': 'score.wav', 'sha256': digest(score), 'sampleRate': sr, 'channels': 2,
                      'analysis': '2048-sample Hann FFT, shared -50dB spectral scale, RMS and positive energy-change peaks'})
        source = analyse_frames(args.source.resolve(), bundle/'samples.bin', period=args.period)
        packed = bundle/'samples.bin.gz'
        raw = bundle/'samples.bin'
        source['decodedBytes'] = raw.stat().st_size
        packed.write_bytes(gzip.compress(raw.read_bytes(), mtime=0))
        source['compressedSha256'] = digest(packed)
        raw.unlink()
        manifest = {'version': 1, 'audio': audio, 'source': source,
                    'samples': 'samples.bin.gz', 'producerSha256': digest(__file__)}
        (bundle/'manifest.json').write_text(json.dumps(manifest, separators=(',', ':'))+'\n')
        subprocess.run(['node', str(ROOT/'video/publish.cjs'), str(work), str(output.parent), output.name], check=True)
        print(f'Published measured signals: {source["count"]} image frames; {audio["count"]} audio frames; {len(audio["onsets"])} attacks -> {output}')


if __name__ == '__main__':
    main()
