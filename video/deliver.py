"""Turn a silent lossless master and a mix into the two files people see.

    python3 deliver.py master.mkv mix.wav out_dir name [poster_seconds]

  out_dir/name_hq.mp4  high quality for upload: H.264 CRF 18, peaks held under 25 Mbps (Meta's Reels limit)
  out_dir/name.mp4     for the web: the high-quality file if it fits in CAP bytes, else two-pass to CAP
  out_dir/name.jpg     poster frame from the web file (default: a third of the way in)

Publication requires Node.js and the sibling publish.cjs rollback helper.

Audio is limited and then brought to -14 LUFS by a linear gain, with a true peak under -1 dBTP,
as AAC at 128 kbps and 48 kHz, which is Meta's audio ceiling. Video is BT.709, tagged. Everything
is made and checked in a scratch folder and moved into out_dir only when every check has passed.
"""
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from fractions import Fraction

TARGET_I = -14.0      # LUFS; Meta publishes no target, this is the -14 convention
TARGET_TP = -1.5      # first dBTP target handed to loudnorm; the final file must measure <= MAX_TP
MAX_TP = -1.0
I_TOLERANCE = 1.0     # LU either side of TARGET_I, measured on the final file
LIMIT_DBFS = -2.0     # limiter ceiling before loudnorm
HQ_MAX_BPS = 25_000_000
AUDIO_BPS = 128_000
AAC_OUT = ["-c:a", "aac", "-b:a", str(AUDIO_BPS), "-ar", "48000"]
CAP = 15_000_000      # web file ceiling in bytes


def run(*args, capture=False):
    r = subprocess.run(args, capture_output=True, text=True, timeout=3600)
    if r.returncode != 0:
        raise SystemExit(f"FAILED ({r.returncode}): {' '.join(args)}\n{r.stderr[-2000:]}")
    return r.stderr if capture else r.stdout


def probe(path):
    return json.loads(run("ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path))


def loudness(path):
    """Integrated loudness and true peak, read from ebur128 rather than trusted from loudnorm."""
    err = run("ffmpeg", "-hide_banner", "-nostats", "-i", path, "-map", "0:a",
              "-af", "ebur128=peak=true", "-f", "null", "-", capture=True)
    summary = err[err.rindex("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
    tp = float(re.search(r"True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS", summary).group(1))
    return i, tp


def loudnorm_json(err):
    return json.loads(err[err.rindex("{"):err.rindex("}") + 1])


def master_audio(mix, work, tp_target):
    i0, tp0 = loudness(mix)
    # Raising a quiet mix to TARGET_I puts its peaks above 0 dBTP, and loudnorm then drops to dynamic
    # compression without failing. So: overshoot the gain by 1 dB into a limiter that runs at 4x the
    # sample rate (so it sees the peaks between samples), measure, and lower its ceiling until a
    # plain linear gain can reach TARGET_I with the true peak under tp_target.
    gain = TARGET_I - i0 + 1.0
    staged = os.path.join(work, "staged.wav")
    # LRA only matters to loudnorm's dynamic mode; linear mode needs the measured LRA under it.
    base = f"loudnorm=I={TARGET_I}:TP={tp_target}:LRA=20"
    ceiling = LIMIT_DBFS
    for attempt in range(4):
        run("ffmpeg", "-y", "-loglevel", "error", "-i", mix, "-af",
            f"volume={gain:.2f}dB,aresample=192000,alimiter=limit={10 ** (ceiling / 20):.4f}:level=false:latency=true,aresample=48000",
            "-c:a", "pcm_f32le", staged)
        first = loudnorm_json(run("ffmpeg", "-hide_banner", "-nostats", "-i", staged, "-af",
                                  base + ":print_format=json", "-f", "null", "-", capture=True))
        peak_after = float(first["input_tp"]) + (TARGET_I - float(first["input_i"]))
        if peak_after <= tp_target - 0.1:
            break
        ceiling -= peak_after - tp_target + 0.3
    else:
        raise SystemExit(f"could not bring the true peak under {tp_target} dBTP; last ceiling {ceiling:.1f} dBFS, {first}")
    second_args = (f"{base}:measured_I={first['input_i']}:measured_TP={first['input_tp']}"
                   f":measured_LRA={first['input_lra']}:measured_thresh={first['input_thresh']}"
                   f":offset={first['target_offset']}:linear=true:print_format=json")
    out = os.path.join(work, "norm.wav")
    second = loudnorm_json(run("ffmpeg", "-y", "-hide_banner", "-nostats", "-i", staged, "-af", second_args,
                               "-c:a", "pcm_f32le", "-ar", "48000", out, capture=True))
    if second["normalization_type"] != "linear":
        raise SystemExit(f"loudnorm fell back to {second['normalization_type']} normalisation: {second}")
    print(f"audio: {i0:.1f} LUFS / {tp0:.1f} dBTP -> {gain:+.2f} dB into a {ceiling:.1f} dBFS limiter at 4x "
          f"({float(first['input_i']):.1f} LUFS / {float(first['input_tp']):.1f} dBTP, attempt {attempt + 1}) -> loudnorm linear")
    return out


def moov_first_without_editlist(path):
    with open(path, "rb") as f:
        head = f.read(8 << 20)
    moov, mdat = head.find(b"moov"), head.find(b"mdat")
    if moov < 0 or (0 <= mdat < moov):
        return False, "moov is not ahead of mdat"
    size = int.from_bytes(head[moov - 4:moov], "big")
    if b"elst" in head[moov - 4:moov - 4 + size]:
        return False, "moov carries an edit list"
    return True, ""


def peak_video_bps(path, fps):
    """Largest one-second sum of video packet sizes, in bits per second."""
    sizes = [int(x) for x in run("ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                 "packet=size", "-of", "csv=p=0", path).split()]
    window = round(fps)
    running = sum(sizes[:window])
    best = running
    for k in range(window, len(sizes)):
        running += sizes[k] - sizes[k - window]
        best = max(best, running)
    return best * 8


def count_frames(path):
    return int(run("ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets",
                   "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", path).strip())


def check(path, master, cap=None, max_bps=None):
    info = probe(path)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next(s for s in info["streams"] if s["codec_type"] == "audio")
    m = next(s for s in probe(master)["streams"] if s["codec_type"] == "video")
    fps = float(Fraction(v["r_frame_rate"]))
    problems = []
    colour = (v.get("color_space"), v.get("color_primaries"), v.get("color_transfer"), v.get("color_range"))
    if colour != ("bt709", "bt709", "bt709", "tv"):
        problems.append(f"colour tags {colour}, expected BT.709 limited range")
    if v["codec_name"] != "h264" or v["pix_fmt"] != "yuv420p":
        problems.append(f"video {v['codec_name']} {v['pix_fmt']}")
    if (v["width"], v["height"]) != (m["width"], m["height"]) or v["r_frame_rate"] != m["r_frame_rate"]:
        problems.append(f"video {v['width']}x{v['height']} @ {v['r_frame_rate']} vs master "
                        f"{m['width']}x{m['height']} @ {m['r_frame_rate']}")
    frames, master_frames = count_frames(path), count_frames(master)
    if frames != master_frames:
        problems.append(f"{frames} frames vs master {master_frames}")
    if a["codec_name"] != "aac" or int(a["sample_rate"]) != 48000 or int(a["bit_rate"]) > AUDIO_BPS * 1.02:
        problems.append(f"audio {a['codec_name']} {a['sample_rate']} Hz {a['bit_rate']} bps")
    ok, why = moov_first_without_editlist(path)
    if not ok:
        problems.append(why)
    size = os.path.getsize(path)
    if cap and size > cap:
        problems.append(f"{size} bytes > {cap}")
    peak = peak_video_bps(path, fps)
    if max_bps and peak > max_bps:
        problems.append(f"peak video bitrate {peak / 1e6:.1f} Mbps > {max_bps / 1e6:.0f}")
    i, tp = loudness(path)
    if abs(i - TARGET_I) > I_TOLERANCE or tp > MAX_TP:
        problems.append(f"loudness {i:.1f} LUFS / {tp:.1f} dBTP")
    line = (f"{os.path.basename(path)}: {size / 1e6:.2f} MB, {v['codec_name']} {v['width']}x{v['height']} "
            f"{v['r_frame_rate']}, {frames} frames, avg {int(info['format']['bit_rate']) / 1e6:.2f} Mbps, "
            f"peak 1 s {peak / 1e6:.1f} Mbps, aac {int(a['bit_rate']) // 1000} kbps, {i:.1f} LUFS, {tp:.1f} dBTP")
    if problems:
        raise SystemExit(f"CHECK FAILED {line}\n  " + "\n  ".join(problems))
    print("ok  " + line)


# ffmpeg 8.1 drops -color_primaries/-color_trc for libx264, so x264 writes the colour description itself.
COMMON_OUT = ["-pix_fmt", "yuv420p", "-profile:v", "high",
              "-x264-params", "open-gop=0:colorprim=bt709:transfer=bt709:colormatrix=bt709", "-color_range", "tv",
              *AAC_OUT, "-shortest",
              "-use_editlist", "0", "-movflags", "+faststart"]


def aac_true_peak(audio, work):
    """The true peak of the audio once encoded as the delivered AAC, which can sit above its PCM."""
    trial = os.path.join(work, "trial.m4a")
    run("ffmpeg", "-y", "-loglevel", "error", "-i", audio, *AAC_OUT, trial)
    return loudness(trial)[1]


def master_for_aac(mix, work):
    # AAC encoding raised the true peak by 0.2 to 0.7 dB on our videos, depending on the sound (a
    # music-only loop measured -0.9 dBTP from a -1.6 dBTP master). So the encoded audio is measured,
    # and the target lowered by the overshoot until it measures under MAX_TP.
    tp_target = TARGET_TP
    for _ in range(3):
        audio = master_audio(mix, work, tp_target)
        tp = aac_true_peak(audio, work)
        if tp <= MAX_TP - 0.1:
            return audio
        print(f"audio: AAC true peak {tp:.1f} dBTP from a {tp_target:.1f} dBTP master; mastering again lower")
        tp_target -= tp - (MAX_TP - 0.3)
    raise SystemExit(f"the AAC true peak stays above {MAX_TP} dBTP: {tp:.1f} dBTP from a {tp_target:.1f} dBTP target")


def encode_hq(master, audio, out):
    run("ffmpeg", "-y", "-loglevel", "error", "-i", master, "-i", audio, "-map", "0:v", "-map", "1:a",
        "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-maxrate", "20M", "-bufsize", "4M",
        *COMMON_OUT, out)


def encode_preview(master, audio, out, work, dur):
    kbps = int((CAP * 8 / dur) * 0.94 - AUDIO_BPS) // 1000
    for attempt in range(2):
        log = os.path.join(work, "pass")
        v = ["-c:v", "libx264", "-preset", "slow", "-b:v", f"{kbps}k",
             "-maxrate", f"{int(kbps * 1.5)}k", "-bufsize", f"{kbps * 2}k", "-passlogfile", log]
        run("ffmpeg", "-y", "-loglevel", "error", "-i", master, *v, "-pass", "1", "-an", "-f", "mp4", "/dev/null")
        run("ffmpeg", "-y", "-loglevel", "error", "-i", master, "-i", audio, "-map", "0:v", "-map", "1:a",
            *v, "-pass", "2", *COMMON_OUT, out)
        size = os.path.getsize(out)
        if size <= CAP:
            return kbps
        # Two-pass overshoots on short clips; one retry at a proportionally lower rate, then stop.
        print(f"preview {size} bytes > {CAP} at {kbps}k; retrying lower")
        kbps = int(kbps * CAP / size * 0.97)
    raise SystemExit(f"preview still {size} bytes > {CAP} after a retry")


def main():
    master, mix, out_dir, name = sys.argv[1:5]
    work = tempfile.mkdtemp(prefix=f".deliver-{name}-", dir=out_dir)
    try:
        dur = float(probe(master)["format"]["duration"])
        poster_at = sys.argv[5] if len(sys.argv) > 5 else f"{dur / 3:.2f}"
        try:
            poster_seconds = float(poster_at)
        except ValueError:
            raise SystemExit("poster_seconds must be a finite number within the master duration")
        if not math.isfinite(dur) or dur <= 0 or not math.isfinite(poster_seconds) or not 0 <= poster_seconds < dur:
            raise SystemExit("poster_seconds must be a finite number within the master duration")
        audio = master_for_aac(mix, work)
        hq = os.path.join(work, f"{name}_hq.mp4")
        preview = os.path.join(work, f"{name}.mp4")
        poster = os.path.join(work, f"{name}.jpg")
        encode_hq(master, audio, hq)
        check(hq, master, max_bps=HQ_MAX_BPS)
        if os.path.getsize(hq) <= CAP:
            # Flat graphics can meet CRF 18 far below the cap; a cap-sized encode would only be bigger.
            shutil.copyfile(hq, preview)
            print(f"web file is the high-quality file ({os.path.getsize(hq) / 1e6:.2f} MB <= {CAP / 1e6:.0f} MB)")
        else:
            kbps = encode_preview(master, audio, preview, work, dur)
            print(f"web video {kbps}k two-pass")
        check(preview, master, cap=CAP, max_bps=HQ_MAX_BPS)
        run("ffmpeg", "-y", "-loglevel", "error", "-ss", poster_at, "-i", preview, "-frames:v", "1", "-q:v", "3", poster)
        # FFmpeg can exit successfully without producing a frame near EOF.
        if not os.path.isfile(poster) or os.path.getsize(poster) == 0:
            raise SystemExit("poster extraction produced no image")
        # Direct deliver.py callers need the same rollback as build.sh: a late
        # replacement failure must not pair new videos with the previous poster.
        publisher = os.path.join(os.path.dirname(os.path.abspath(__file__)), "publish.cjs")
        run("node", publisher, work, out_dir, *(os.path.basename(f) for f in (hq, preview, poster)))
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
