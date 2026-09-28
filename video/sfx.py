"""Synthesise the sound effects and mix them onto the cue list a page exported.

    python3 sfx.py cues.json out.wav

Everything is generated here from sine waves and filtered noise, so the track
carries no third-party audio.
"""
import json
import math
import random
import struct
import sys
import wave

SR = 48_000
rng = random.Random(7)


def n(sec):
    return int(sec * SR)


def env_exp(i, rate, attack=0.004):
    t = i / SR
    a = min(1.0, t / attack) if attack > 0 else 1.0
    return a * math.exp(-t * rate)


def tone(freqs, dur, rate, partials=((1, 1.0),), attack=0.004, glide_to=None):
    out = [0.0] * n(dur)
    for f0, amp in freqs:
        phase = 0.0
        for i in range(len(out)):
            f = f0 if glide_to is None else f0 + (glide_to - f0) * (i / len(out))
            phase += 2 * math.pi * f / SR
            s = sum(pa * math.sin(phase * k) for k, pa in partials)
            out[i] += amp * s * env_exp(i, rate, attack)
    return out


def noise(dur, lp_from, lp_to=None, hp=False):
    out, y, prev = [], 0.0, 0.0
    total = n(dur)
    for i in range(total):
        a = lp_from if lp_to is None else lp_from + (lp_to - lp_from) * (i / total)
        x = rng.uniform(-1, 1)
        y += a * (x - y)
        v = (y - prev) if hp else y
        prev = y
        out.append(v)
    return out


def place(dst, src, at, gain=1.0):
    for i, v in enumerate(src):
        j = at + i
        if j >= len(dst):
            break
        dst[j] += v * gain


def normalise(x, peak=1.0):
    m = max(abs(v) for v in x) or 1.0
    return [v * peak / m for v in x]


def seq(parts):
    total = max(n(at) + len(p) for at, p in parts)
    out = [0.0] * total
    for at, p in parts:
        place(out, p, n(at))
    return out


def build():
    s = {}
    s["ping"] = normalise(tone([(1318.5, 1.0), (1975.5, 0.55)], 0.6, 7, partials=((1, 1), (2, 0.18))))
    s["tg"] = normalise(seq([(0, tone([(1046.5, 1)], 0.28, 14, partials=((1, 1), (2, 0.3)))),
                             (0.075, tone([(1396.9, 1)], 0.32, 12, partials=((1, 1), (2, 0.3))))]))
    body = noise(0.24, 0.02, 0.35)
    envd = [v * math.sin(math.pi * i / len(body)) for i, v in enumerate(body)]
    s["send"] = normalise([a + b for a, b in zip(normalise(envd, 0.8),
                                                 tone([(520, 0.35)], 0.24, 9, glide_to=1150))])
    s["bonk"] = normalise(seq([(0, tone([(392.0, 1)], 0.34, 6, partials=((1, 1), (3, 0.11)))),
                               (0.2, tone([(293.7, 1)], 0.5, 5, partials=((1, 1), (3, 0.11))))]))
    s["tick"] = normalise([a + b for a, b in zip(tone([(1900, 1)], 0.08, 60, attack=0.001),
                                                 tone([(950, 0.6)], 0.08, 40, attack=0.001))])
    click = noise(0.02, 0.9, hp=True)
    click = [v * math.exp(-i / SR * 300) for i, v in enumerate(click)]
    s["tap"] = normalise([a + b for a, b in zip(click + [0.0] * n(0.08), tone([(1200, 0.5)], 0.1, 80, attack=0.001))])
    s["pop"] = normalise(tone([(900, 1)], 0.09, 40, attack=0.002, glide_to=480))
    beep = tone([(880, 1)], 0.1, 4, partials=((1, 1), (3, 0.2)), attack=0.005)
    s["alert"] = normalise(seq([(0, beep), (0.15, beep)]))
    notes = [(0, 1046.5), (0.07, 1318.5), (0.14, 1568.0), (0.21, 2093.0)]
    s["chime"] = normalise(seq([(at, tone([(f, 1)], 0.9, 5, partials=((1, 1), (2, 0.25)))) for at, f in notes]))
    hi = noise(0.5, 0.18)
    lo = noise(0.5, 0.025)
    band = [a - b for a, b in zip(hi, lo)]
    s["whoosh"] = normalise([v * math.sin(math.pi * i / len(band)) ** 2 for i, v in enumerate(band)])
    typ = noise(0.025, 0.95, hp=True)
    s["type"] = normalise([v * math.exp(-i / SR * 450) for i, v in enumerate(typ)])
    # impact: a low boom with a short dark noise hit on top
    boom = tone([(72, 1)], 0.8, 5, attack=0.002, glide_to=36)
    hit = noise(0.08, 0.08) + [0.0] * (len(boom) - n(0.08))
    s["impact"] = normalise([a + 0.5 * b * math.exp(-i / SR * 40) for i, (a, b) in enumerate(zip(boom, hit))])
    # riser: 1.2 s of opening noise and a climbing tone, loudest at its end
    rn = noise(1.2, 0.01, 0.3)
    rt = tone([(300, 0.3)], 1.2, 0, attack=0.001, glide_to=1300)
    s["riser"] = normalise([(a + b) * (i / len(rn)) ** 2 for i, (a, b) in enumerate(zip(rn, rt))])
    # stamp: a short thud with a click
    thud = tone([(130, 1)], 0.2, 22, attack=0.001, glide_to=60)
    clk = noise(0.012, 0.9, hp=True) + [0.0] * (len(thud) - n(0.012))
    s["stamp"] = normalise([a + 0.6 * b for a, b in zip(thud, clk)])
    # scan: a soft upward sweep
    sc = tone([(700, 1)], 0.6, 0, attack=0.001, glide_to=1500)
    s["scan"] = normalise([v * math.sin(math.pi * i / len(sc)) for i, v in enumerate(sc)])
    # thump: a heartbeat pair
    beat = tone([(55, 1)], 0.25, 14, attack=0.003, partials=((1, 1), (2, 0.25)))
    s["thump"] = normalise(seq([(0, beat), (0.18, [v * 0.6 for v in beat])]))
    # ding: an approval bell
    s["ding"] = normalise(tone([(1568, 1.0), (2349, 0.5)], 0.7, 6, partials=((1, 1), (2, 0.15))))
    return s


LEVEL = {"ping": 0.32, "tg": 0.3, "send": 0.26, "bonk": 0.34, "tick": 0.26, "tap": 0.34,
         "pop": 0.18, "alert": 0.24, "chime": 0.26, "whoosh": 0.2, "type": 0.07,
         "impact": 0.5, "riser": 0.2, "stamp": 0.38, "scan": 0.14, "thump": 0.42, "ding": 0.26}

# Every effects track is normalised to the same peak before mixing; deliver.py sets the loudness.
TARGET_PEAK = 0.63


def main(cues_path, out_path):
    data = json.load(open(cues_path))
    sounds = build()
    track = [0.0] * n(data["dur"] + 1.0)
    unknown = sorted({c["name"] for c in data["cues"]} - set(LEVEL))
    if unknown:
        raise SystemExit(f"unknown sound cue(s) {unknown}; available: {sorted(LEVEL)}")
    early = [c for c in data["cues"] if c["t"] < 0]
    if early:
        raise SystemExit(f"cue(s) before t=0: {early[:3]}")
    for c in data["cues"]:
        name = c["name"]
        gain = LEVEL[name] * c.get("gain", 1)
        if name == "type":
            gain *= rng.uniform(0.7, 1.0)
        place(track, sounds[name], n(c["t"]), gain)
    peak = max(abs(v) for v in track)
    scale = TARGET_PEAK / peak if peak > 0 else 1.0
    with wave.open(out_path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = bytearray()
        for v in track:
            x = int(max(-1.0, min(1.0, v * scale)) * 32767)
            frames += struct.pack("<hh", x, x)
        w.writeframes(bytes(frames))
    print(f"{len(data['cues'])} cues, peak {peak:.2f}, scale {scale:.2f} -> {out_path}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
