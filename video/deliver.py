"""Turn a silent lossless master and a mix into the two files people see.

    python3 deliver.py master.mkv mix.wav out_dir name [poster_seconds]

  out_dir/name_hq.mp4  high quality for upload: H.264 CRF 18, peaks held under 25 Mbps (Meta's Reels limit)
  out_dir/name.mp4     for the web: the high-quality file if it fits in CAP bytes, else two-pass to CAP
  out_dir/name.jpg     poster frame from the web file

Audio is brought to -14 LUFS with a true peak under -1 dBTP, and AAC 128 kbps at 48 kHz,
which is Meta's audio ceiling. Every check that fails raises; nothing is written half-checked.
"""
import json
import os
import re
import shutil
import subprocess
import sys

TARGET_I = -14.0      # LUFS; Meta publishes no target, this is the -14 convention
TARGET_TP = -1.5      # dBTP handed to loudnorm; the final file must measure <= MAX_TP
MAX_TP = -1.0
I_TOLERANCE = 1.0     # LU either side of TARGET_I, measured on the final file
LIMIT_DBFS = -2.0     # limiter ceiling before loudnorm
HQ_MAX_BPS = 25_000_000
AUDIO_BPS = 128_000
CAP = 15_000_000      # web file ceiling in bytes


def run(*args, capture=False):
    r = subprocess.run(args, capture_output=True, text=True)
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


def master_audio(mix, work):
    i0, tp0 = loudness(mix)
    # Raising a quiet mix to TARGET_I puts its peaks above 0 dBTP, and loudnorm then drops to dynamic
    # compression without failing. So: overshoot the gain by 1 dB into a limiter that runs at 4x the
    # sample rate (so it sees the peaks between samples), measure, and lower its ceiling until a
    # plain linear gain can reach TARGET_I with the true peak under TARGET_TP.
    gain = TARGET_I - i0 + 1.0
    staged = os.path.join(work, "staged.wav")
    base = f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA=11"
    ceiling = LIMIT_DBFS
    for attempt in range(4):
        run("ffmpeg", "-y", "-loglevel", "error", "-i", mix, "-af",
            f"volume={gain:.2f}dB,aresample=192000,alimiter=limit={10 ** (ceiling / 20):.4f}:level=false:latency=true,aresample=48000",
            "-c:a", "pcm_f32le", staged)
        first = loudnorm_json(run("ffmpeg", "-hide_banner", "-nostats", "-i", staged, "-af",
                                  base + ":print_format=json", "-f", "null", "-", capture=True))
        peak_after = float(first["input_tp"]) + (TARGET_I - float(first["input_i"]))
        if peak_after <= TARGET_TP - 0.1:
            break
        ceiling -= peak_after - TARGET_TP + 0.3
    else:
        raise SystemExit(f"could not bring the true peak under {TARGET_TP} dBTP; last ceiling {ceiling:.1f} dBFS, {first}")
    second_args = (f"{base}:measured_I={first['input_i']}:measured_TP={first['input_tp']}"
                   f":measured_LRA={first['input_lra']}:measured_thresh={first['input_thresh']}"
                   f":offset={first['target_offset']}:linear=true:print_format=json")
    out = os.path.join(work, "norm.wav")
    second = loudnorm_json(run("ffmpeg", "-y", "-hide_banner", "-nostats", "-i", staged, "-af", second_args,
                               "-c:a", "pcm_f32le", "-ar", "48000", out, capture=True))
    if second["normalization_type"] != "linear":
        raise SystemExit(f"loudnorm fell back to {second['normalization_type']} normalisation: {second}")
    print(f"audio: {i0:.1f} LUFS / {tp0:.1f} dBTP -> +{gain:.2f} dB into a {ceiling:.1f} dBFS limiter at 4x "
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
    fps = eval(v["r_frame_rate"])
    problems = []
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


COMMON_OUT = ["-pix_fmt", "yuv420p", "-profile:v", "high", "-x264-params", "open-gop=0",
              "-c:a", "aac", "-b:a", str(AUDIO_BPS), "-ar", "48000", "-shortest",
              "-use_editlist", "0", "-movflags", "+faststart"]


def encode_hq(master, audio, out):
    run("ffmpeg", "-y", "-loglevel", "error", "-i", master, "-i", audio, "-map", "0:v", "-map", "1:a",
        "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-maxrate", "20M", "-bufsize", "40M",
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
    poster_at = sys.argv[5] if len(sys.argv) > 5 else "1"
    work = os.path.join(out_dir, f".deliver-{name}")
    os.makedirs(work, exist_ok=True)
    try:
        dur = float(probe(master)["format"]["duration"])
        audio = master_audio(mix, work)
        hq = os.path.join(out_dir, f"{name}_hq.mp4")
        preview = os.path.join(out_dir, f"{name}.mp4")
        encode_hq(master, audio, hq)
        check(hq, master, max_bps=HQ_MAX_BPS)
        if os.path.getsize(hq) <= CAP:
            # Flat graphics can meet CRF 18 far below the cap; a cap-sized encode would only be bigger.
            shutil.copyfile(hq, preview)
            print(f"web file is the high-quality file ({os.path.getsize(hq) / 1e6:.2f} MB <= {CAP / 1e6:.0f} MB)")
        else:
            kbps = encode_preview(master, audio, preview, work, dur)
            print(f"web video {kbps}k two-pass")
        check(preview, master, cap=CAP)
        run("ffmpeg", "-y", "-loglevel", "error", "-ss", poster_at, "-i", preview, "-frames:v", "1", "-q:v", "3",
            os.path.join(out_dir, f"{name}.jpg"))
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
