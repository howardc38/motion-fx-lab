"""Original instrumental and drawing foley. Fixed seed; no remote API or samples."""
from pathlib import Path
import hashlib
import json
import wave
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parents[2] / 'assets/spark-form'
SR, DUR = 48000, 16.8
rng = np.random.default_rng(1551)
mix = np.zeros((round(SR * DUR), 2), dtype=np.float64)

def add(y, at, gain=1, pan=0):
    off = round(at * SR)
    if off < 0:
        y = y[-off:]
        off = 0
    y = y[: len(mix) - off]
    if len(y):
        mix[off:off+len(y), 0] += y * gain * np.sqrt((1-pan)/2)
        mix[off:off+len(y), 1] += y * gain * np.sqrt((1+pan)/2)

def tone(f, dur, decay, brightness=.1):
    t = np.arange(round(SR*dur))/SR
    env = (1-np.exp(-t*180))*np.exp(-t*decay)
    return (np.sin(2*np.pi*f*t)+brightness*np.sin(2*np.pi*f*2*t))*env

for i, at in enumerate(np.arange(0, DUR-.2, .6)):
    energy = .55 if at < 4.8 else 1 if at < 9.6 else .45 if at < 14.4 else .9
    t = np.arange(round(SR*.35))/SR
    phase = 2*np.pi*(48*t+95*(1-np.exp(-t*35))/35)
    add(np.sin(phase)*np.exp(-t*14)*(1-np.exp(-t*500)), at, .28*energy)
    add(tone([73.416,65.406,55,65.406][i//4%4], .55, 6, .2), at+.005, .20*energy, -.1)
    # Soft mechanical subdivisions, with a short room tail; no notification tones.
    for j in range(4):
        noise = rng.normal(0,1,round(SR*.045))
        n = sosfilt(butter(2,[2000,6800],btype='bandpass',fs=SR,output='sos'), noise)
        n *= np.exp(-np.arange(len(n))/SR*145)
        add(n,at+j*.15,.023*energy*(.65 if j%2 else 1),.4*(-1)**j)
    if i%2:
        nt = np.arange(round(SR*.14))/SR
        n = sosfilt(butter(2,[900,4800],btype='bandpass',fs=SR,output='sos'),rng.normal(0,1,len(nt)))
        add(n*np.exp(-nt*38),at,.045*energy,.12)

for i, f in enumerate([146.832,174.614,220,261.626]):
    t = np.arange(len(mix))/SR
    pad = (np.sin(2*np.pi*f*t+.002*np.sin(2*np.pi*.2*t))+.22*np.sin(2*np.pi*f*2.001*t))
    env = np.minimum(1,t/1.5)*np.minimum(1,(DUR-t)/2.2)
    add(pad*env,0,.019,(-.65,.65,-.3,.3)[i])

# Continuous pen contact; spectral changes follow the drawing and shutter dive.
t = np.arange(len(mix))/SR
contact = sosfilt(butter(2,[750,5200],btype='bandpass',fs=SR,output='sos'),rng.normal(0,1,len(t)))
env = np.clip((t-.1)/.2,0,1)*np.clip((4.6-t)/.4,0,1)
env *= .6+.2*np.sin(t*14)+.2*np.sin(t*25.3)
add(contact*env,0,.04,.1)
for at in [4.8,9.6,14.4]:
    dt = np.arange(round(SR*.72))/SR
    air = sosfilt(butter(2,[220,4500],btype='bandpass',fs=SR,output='sos'),rng.normal(0,1,len(dt)))
    add(air*np.exp(-dt*10),at,.08)
    add(tone(49,.8,9,.25),at,.21)

mix *= np.minimum(1,np.arange(len(mix))/SR/.018)[:,None]
mix *= np.minimum(1,(DUR-np.arange(len(mix))/SR)/.65)[:,None]
mix = np.tanh(mix*1.3)
mix *= .83/max(np.abs(mix).max(),1e-8)
output = ROOT/'score.wav'
with wave.open(str(output),'wb') as out:
    out.setnchannels(2)
    out.setsampwidth(2)
    out.setframerate(SR)
    out.writeframes(np.round(mix*32767).astype('<i2').tobytes())
(ROOT/'score.json').write_text(json.dumps({'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'duration':DUR,'bpm':100,'source':'Original fixed-seed synthesis; no vocals, samples or source soundtrack.'},indent=2)+'\n')
print(output)
