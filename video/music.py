"""A dark electronic bed at 100 BPM, synthesised here from oscillators and noise (no samples).

    python3 music.py cues.json out.wav

cues.json is what `node record.cjs cues page.html cues.json` exports: the duration, and in
"music" the sections the page declares in window.__music as [[start_seconds, name], ...].
One bar is 2.4 s. Sections:
  intro  heartbeat and a ticking clock
  build  a bass pulse joins, its filter opening; a snare roll in the bar before the drop
  drop   four-on-the-floor, off-beat hats, bass and pad on Am-F-C-G
  lift   the same with claps
  break  pad and heartbeat only
  final  full again, with claps
  tail   the pad fades out
"""
import json
import math
import random
import struct
import sys
import wave

SR = 48_000
BEAT = 0.6
BAR = 2.4
rng = random.Random(11)


def n(sec):
    return int(sec * SR)


def kick():
    out, ph = [], 0.0
    for i in range(n(0.4)):
        t = i / SR
        f = 45 + 95 * math.exp(-t * 28)
        ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * math.exp(-t * 9) * (1 if t > 0.002 else t / 0.002))
    return out


def noise_burst(dur, decay, hp=True, lp=0.9):
    out, y, prev = [], 0.0, 0.0
    for i in range(n(dur)):
        x = rng.uniform(-1, 1)
        y += lp * (x - y)
        v = (y - prev) if hp else y
        prev = y
        out.append(v * math.exp(-i / SR * decay))
    return out


def clap():
    base = noise_burst(0.25, 22, hp=True, lp=0.5)
    out = [0.0] * len(base)
    for off in (0.0, 0.011, 0.023):
        for i, v in enumerate(base):
            j = i + n(off)
            if j < len(out):
                out[j] += v * (0.6 if off else 1.0)
    return out


def heartbeat():
    b = []
    for i in range(n(0.3)):
        t = i / SR
        b.append(math.sin(2 * math.pi * 52 * t) * math.exp(-t * 14))
    out = [0.0] * n(0.55)
    for i, v in enumerate(b):
        out[i] += v
        if i + n(0.19) < len(out):
            out[i + n(0.19)] += 0.6 * v
    return out


def add(dst, src, at, g):
    s = n(at)
    for i, v in enumerate(src):
        j = s + i
        if j >= len(dst):
            break
        dst[j] += v * g


def saw(ph):
    return 2.0 * (ph - math.floor(ph + 0.5))


CHORDS = [  # Am, F, C, G -- (bass root, triad)
    (55.00, (220.00, 261.63, 329.63)),
    (43.65, (174.61, 220.00, 261.63)),
    (65.41, (261.63, 329.63, 392.00)),
    (49.00, (196.00, 246.94, 293.66)),
]


PLAN = []


def section(t):
    name = PLAN[0][1]
    for start, s in PLAN:
        if t >= start:
            name = s
    return name


def starts(name, default):
    return next((s for s, n in PLAN if n == name), default)


def main(cues_path, out_path):
    spec = json.load(open(cues_path))
    dur = float(spec["dur"])
    if not spec.get("music"):
        raise SystemExit(f"{cues_path} has no music sections: declare window.__music in the page")
    PLAN[:] = sorted((float(s), n) for s, n in spec["music"])
    B0 = starts("build", 0.0)
    D0 = starts("drop", B0 + 4.8)
    T0 = starts("tail", dur)
    N = n(dur + 1.0)
    mix = [0.0] * N
    K, CL, HB = kick(), clap(), heartbeat()
    HAT, OHAT, TICK = noise_burst(0.05, 70), noise_burst(0.18, 16), noise_burst(0.02, 180)

    # drums, on the beat grid
    steps = int(dur / (BEAT / 4)) + 1
    for s in range(steps):
        t = s * BEAT / 4
        sec = section(t)
        on_beat, eighth = s % 4 == 0, s % 2 == 0
        beat_in_bar = (s // 4) % 4
        if sec in ("intro", "break"):
            if on_beat and beat_in_bar in (0, 2):
                add(mix, HB, t, 0.9)
            add(mix, TICK, t, 0.10 if on_beat else 0.05)
        if sec == "build":
            if on_beat:
                add(mix, K, t, 0.55 + 0.35 * (t - B0) / (D0 - B0))
            add(mix, TICK, t, 0.07)
            if t >= D0 - 2.4:  # snare roll into the drop, accelerating
                rate = 2 if t < D0 - 1.2 else 1
                if s % rate == 0:
                    add(mix, noise_burst(0.12, 30, lp=0.6), t, 0.12 + 0.25 * (t - (D0 - 2.4)) / 2.4)
        if sec in ("drop", "lift", "final"):
            if on_beat:
                add(mix, K, t, 1.0)
            if s % 4 == 2:
                add(mix, OHAT, t, 0.16)
            elif not eighth:
                add(mix, HAT, t, 0.08)
            if sec in ("lift", "final") and on_beat and beat_in_bar in (1, 3):
                add(mix, CL, t, 0.45)
        if sec == "tail" and t < T0 + 0.2 and on_beat:
            add(mix, K, t, 0.6)

    # bass, pad and drone, sample by sample
    y_b = y_p = y_d = 0.0
    phb = 0.0
    php = [0.0] * 6
    phd = [0.0, 0.0]
    for i in range(N):
        t = i / SR
        sec = section(t)
        root, triad = CHORDS[int(t / BAR) % 4] if t >= D0 else CHORDS[0]
        # bass: eighth-note pulse with a short pluck envelope
        env8 = math.exp(-((t % (BEAT / 2)) * 9))
        bass_on = {"intro": 0, "build": 0.7, "drop": 1, "lift": 1, "break": 0, "final": 1.1, "tail": 0}[sec]
        cutoff = 180 + (900 * (t - B0) / (D0 - B0) if sec == "build" else 900 if bass_on else 0)
        phb += root * 2 / SR
        a = 1 - math.exp(-2 * math.pi * cutoff / SR)
        y_b += a * (saw(phb) - y_b)
        b = y_b * env8 * bass_on * 0.55
        # pad: detuned saws, slow attack each bar, dark filter
        pad_on = {"intro": 0, "build": 0, "drop": 0.6, "lift": 0.7, "break": 1.0, "final": 0.8, "tail": 0.8}[sec]
        if sec == "tail":
            pad_on *= max(0.0, 1 - (t - T0) / 2.2)
        pv = 0.0
        for k, f in enumerate(triad):
            for dtn, idx in ((0.998, 2 * k), (1.003, 2 * k + 1)):
                php[idx] += f * dtn / SR
                pv += saw(php[idx])
        att = min(1.0, (t % BAR) / 0.35) if t >= D0 else 1.0
        ap = 1 - math.exp(-2 * math.pi * (700 if sec != "break" else 450) / SR)
        y_p += ap * (pv / 6 - y_p)
        p = y_p * pad_on * att * 0.5
        # drone: low fifth under the intro, build and break
        drone_on = {"intro": 1, "build": 1, "drop": 0.3, "lift": 0.3, "break": 1, "final": 0.3, "tail": 0.5}[sec]
        phd[0] += 55.0 / SR
        phd[1] += 82.41 / SR
        ad = 1 - math.exp(-2 * math.pi * 260 / SR)
        y_d += ad * ((saw(phd[0]) + 0.7 * saw(phd[1])) / 1.7 - y_d)
        d = y_d * drone_on * 0.45 * (0.8 + 0.2 * math.sin(2 * math.pi * 0.25 * t))
        mix[i] += b + p + d

    peak = max(abs(v) for v in mix) or 1.0
    g = 0.5 / peak
    with wave.open(out_path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for v in mix:
            x = int(max(-1.0, min(1.0, v * g)) * 32767)
            frames += struct.pack("<hh", x, x)
        w.writeframes(bytes(frames))
    print(f"music {dur}s peak {peak:.2f} -> {out_path}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
