"""Original synthesised scores for the two re-cast signal studies.

Each study owns its own score so that measured audio drives only its own film:
- fragments(path, cues): Motion / Release. Cues are film seconds written by
  tools/signals/render-source.cjs; the shatter attack lands on the first moving frame.
- relief(path, cues=None): Pulse / Form. A kick-driven beat with true silences, so the
  measured RMS has clear zero passages for the flat relief.
All sounds are generated here from sine waves and seeded noise.
"""
import wave

import numpy as np

SR = 48000
DURATION = 12.0


def _write(path, left, right):
    stereo = np.column_stack((left, right))
    with wave.open(str(path), 'wb') as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(SR)
        out.writeframes(np.round(np.clip(stereo, -1, 1) * 32767).astype('<i2').tobytes())


class Mix:
    def __init__(self, seed):
        self.l = np.zeros(round(DURATION * SR))
        self.r = np.zeros_like(self.l)
        self.rng = np.random.default_rng(seed)

    def add(self, at, sound, gain=1.0, pan=0.0):
        i = round(at * SR)
        if i < 0:
            sound, i = sound[-i:], 0
        n = min(len(sound), len(self.l) - i)
        if n <= 0:
            return
        # Equal-power pan, -1 left .. 1 right.
        a = (pan + 1) * np.pi / 4
        self.l[i:i + n] += sound[:n] * gain * np.cos(a)
        self.r[i:i + n] += sound[:n] * gain * np.sin(a)

    def noise(self, seconds):
        return self.rng.uniform(-1, 1, round(seconds * SR))

    def finish(self, path, drive=1.2, level=.86):
        fade = np.minimum(1, (DURATION - np.arange(len(self.l)) / SR) / .24)
        peak = max(np.max(np.abs(self.l)), np.max(np.abs(self.r)), 1e-9)
        left, right = (np.tanh(x / peak * drive) / np.tanh(drive) * level * fade for x in (self.l, self.r))
        _write(path, left, right)


def t_(seconds):
    return np.arange(round(seconds * SR)) / SR


def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be an array (time-varying)."""
    cutoff = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    k = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y, acc = np.empty_like(x), 0.0
    for i in range(len(x)):
        acc += k[i] * (x[i] - acc)
        y[i] = acc
    return y


def boom(f0=120, f1=38, seconds=.7, decay=6):
    t = t_(seconds)
    phase = 2 * np.pi * (f1 * t + (f0 - f1) / 18 * (1 - np.exp(-18 * t)))
    return np.sin(phase) * np.exp(-decay * t) * np.minimum(1, t / .0015)


def ping(f, seconds, decay):
    t = t_(seconds)
    return (np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * f * 2.76 * t)) * np.exp(-decay * t) * np.minimum(1, t / .0008)


def fragments(path, cues):
    m = Mix(1017)
    impact, (slow0, slow1), land = cues['impact'], cues['slow'], cues['land']
    rebuild = land + .58
    # Warm two-chord bed that drops out for the slow motion and returns once the cat is whole.
    for start, end, notes, gain, out in [(0, impact - .06, [220, 277.18, 329.63], .03, .3), (rebuild - .1, DURATION, [196, 246.94, 293.66, 392], .03, .5)]:
        t = t_(end - start)
        env = np.minimum(1, t / .6) * np.minimum(1, (end - start - t) / out)
        m.add(start, sum(np.sin(2 * np.pi * f * t) * .5 ** k for k, f in enumerate(notes)) * env, gain)
    # Run: paw taps on the gait and a whoosh that rises into the take-off.
    r0, r1 = cues['run']
    k = 0
    for at in np.arange(r0 + .15, r1, cues['runCycle'] / 2):
        tap = lowpass(m.noise(.05), 2400) * np.exp(-70 * t_(.05))
        m.add(at, tap, .22 + .1 * (at - r0) / (r1 - r0), pan=-.25 if k % 2 else .25)
        k += 1
    # The whoosh stops 60 ms early: a short gap makes the shatter attack read as one hit.
    span = impact - .06 - r0
    w = m.noise(span)
    u = t_(span) / span
    whoosh = lowpass(w, 300 + 4200 * u ** 2) * u ** 2.4 * np.minimum(1, (1 - u) * span / .03)
    m.add(r0, whoosh, .2)
    # Impact: sub boom, a broadband crack and a spray of glassy pings panned with the fragments.
    m.add(impact, boom(), 1.0)
    m.add(impact, m.noise(.03) * np.exp(-140 * t_(.03)), .75)
    for i in range(70):
        delay = m.rng.exponential(.09)
        f = m.rng.uniform(2600, 8200)
        m.add(impact + .004 + delay, ping(f, .25, m.rng.uniform(22, 60)), .07 * np.exp(-delay * 4), pan=m.rng.uniform(-.9, .9))
    # Slow motion: a low suspended drone and slowed, lower pings hanging in the air.
    t = t_(slow1 - slow0 + .4)
    env = np.minimum(1, t / .35) * np.minimum(1, (len(t) / SR - t) / .45)
    drone = (np.sin(2 * np.pi * 55 * t) + .6 * np.sin(2 * np.pi * 82.4 * t + np.sin(2 * np.pi * .7 * t)) + .25 * np.sin(2 * np.pi * 110.3 * t)) * env
    m.add(slow0, drone, .05)
    for i in range(14):
        at = slow0 + .1 + m.rng.uniform(0, slow1 - slow0 - .2)
        m.add(at, ping(m.rng.uniform(700, 1900), .9, m.rng.uniform(4, 8)), .035, pan=m.rng.uniform(-.7, .7))
    # Landing thump, then the pieces rush back (reversed pings) and lock with a click.
    m.add(land, boom(95, 45, .35, 14), .45)
    back = np.zeros(round((rebuild - land) * SR))
    for i in range(40):
        p = ping(m.rng.uniform(1800, 6000), .2, m.rng.uniform(25, 50))[::-1]
        end = round(len(back) * m.rng.uniform(.55, 1.0))
        start = max(0, end - len(p))
        back[start:end] += p[len(p) - (end - start):] * (end / len(back)) ** 2
    m.add(land, back, .07)
    m.add(rebuild, m.noise(.012) * np.exp(-300 * t_(.012)), .4)
    m.add(rebuild, ping(1318.5, .6, 7), .12)
    # Tail flick: a short swish, a few small pings and their return click.
    flick = cues['flick']
    sw = m.noise(.22)
    u = t_(.22) / .22
    m.add(flick - .1, lowpass(sw, 6000 - 4500 * u) * np.sin(np.pi * u) ** 2, .35, pan=-.3)
    for i in range(10):
        m.add(flick + m.rng.uniform(0, .12), ping(m.rng.uniform(3000, 7000), .2, 40), .04, pan=m.rng.uniform(-.6, 0))
    m.add(flick + .55, m.noise(.01) * np.exp(-300 * t_(.01)), .18)
    # Slow walk: quiet steps; slow movement keeps the cat whole.
    w0, w1 = cues['walk']
    for i, at in enumerate(np.arange(w0 + .2, w1 - .2, cues['walkCycle'] / 2)):
        m.add(at, lowpass(m.noise(.06), 1500) * np.exp(-60 * t_(.06)), .12, pan=.15 if i % 2 else -.05)
    m.finish(path)


def kick(level=1.0):
    return boom(150, 45, .45, 9) * level


def relief(path, cues=None):
    m = Mix(2210)
    beat = .5
    # 0-1 s silence; 1-3 s kicks; 3-6 s build; 6 s drop; 7-9.4 s breakdown; 9.4-10.2 s silence; final hits.
    for i, at in enumerate(np.arange(1.0, 6.0, beat)):
        level = .38 if at < 3 else .38 + .4 * (at - 3) / 3
        m.add(at, kick(level), 1)
        m.add(at + beat / 2, lowpass(m.noise(.04), 9000) * np.exp(-90 * t_(.04)), .06 + .05 * (at > 3), pan=.3)
    # Rising filtered saw sweep through the build: energy moves from low to high bands.
    span = 3.0
    t = t_(span)
    u = t / span
    f = 55 * 2 ** (3 * u)
    saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    m.add(3.0, lowpass(saw, 200 + 7000 * u ** 2) * u ** 1.5, .28)
    snare_times = list(np.arange(5.0, 5.5, .125)) + list(np.arange(5.5, 6.0, .0625))
    for at in snare_times:
        m.add(at, (lowpass(m.noise(.09), 5000) * np.exp(-35 * t_(.09))), .1 + .12 * (at - 5), pan=-.2)
    # Drop.
    m.add(6.0, kick(1.0), 1.2)
    m.add(6.0, boom(70, 32, 1.4, 2.4), .7)
    crash = lowpass(m.noise(1.6), 9000) * np.exp(-2.6 * t_(1.6))
    m.add(6.0, crash, .25, pan=.2)
    for at in np.arange(6.5, 7.01, beat):
        m.add(at, kick(.95), 1.1)
        m.add(at, boom(70, 35, .5, 5), .35)
    # Breakdown: a soft pad with lighter, thinning kicks; then a clean silence.
    t = t_(2.4)
    env = np.minimum(1, t / .3) * np.minimum(1, (2.4 - t) / .6)
    pad = sum(np.sin(2 * np.pi * fr * t) * g for fr, g in [(220, .5), (261.6, .35), (329.6, .3), (440, .15)]) * env
    m.add(7.0, pad, .12)
    for at, level in [(7.5, .6), (8.0, .45), (8.5, .4), (9.0, .3)]:
        m.add(at, kick(level), 1)
    for at, level in [(10.2, .7), (10.7, .55), (11.2, .9)]:
        m.add(at, kick(level), 1.1)
    m.add(11.2, boom(70, 32, .7, 4), .4)
    # Hard silence windows (the relief must be flat there).
    for a, b in [(0, 1.0), (9.45, 10.2)]:
        m.l[round(a * SR):round(b * SR)] = 0
        m.r[round(a * SR):round(b * SR)] = 0
    m.finish(path, drive=1.1)
