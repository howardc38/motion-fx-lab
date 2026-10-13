"""Cut the silent looping preview that a film card plays, from the finished video, without rendering again.

    python3 preview.py cues.json video.mp4 out.preview.mp4

The page lists the clips in window.__preview as [[start_seconds, end_seconds], ...]; record.cjs exports
them into cues.json (tools/make-previews.cjs does the same for films already in media/). Without clips it
removes only the specified stale output.

The preview is H.264 without sound, fitted inside 800 x 450 (the card frame: 800 px wide for 16:9),
30 fps, BT.709, with the index ahead of the data so it starts playing while it downloads. It is encoded
at CRF 26; a preview larger than TARGET_BYTES is encoded again at a higher CRF, and one still larger
than MAX_BYTES fails, which leaves any earlier preview in place.
"""
import json
import math
import os
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

BOX = (800, 450)
TARGET_BYTES = 1_000_000
MAX_BYTES = 2_000_000
CRFS = (26, 28, 30)


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path],
                       capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        raise SystemExit(f"ffprobe failed on {path}: {r.stderr[-500:]}")
    return json.loads(r.stdout)


def fitted(width, height, box=BOX):
    """The largest even size with the film's aspect ratio inside the box, never larger than the film."""
    scale = min(box[0] / width, box[1] / height, 1)
    return max(2, round(width * scale / 2) * 2), max(2, round(height * scale / 2) * 2)


def clip_frames(clips, fps, frames):
    """[first, end) frame indices; a delivered file's first frame is stamped 0.0667 s, so timestamps would
    start each clip two frames early."""
    out = []
    for a, b in clips:
        first, end = math.floor(a * fps + 0.5), math.floor(b * fps + 0.5)   # halves round up, as in the tests (JS Math.round)
        if not 0 <= first < end <= frames:
            raise SystemExit(f"preview clip [{a}, {b}] is outside the film (0-{frames / fps:.2f} s)")
        out.append((first, end))
    return out


def encode(video, frames, size, crf, out):
    parts = [f"[0:v]trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS[c{i}]" for i, (a, b) in enumerate(frames)]
    joined = "".join(f"[c{i}]" for i in range(len(frames)))
    graph = ";".join(parts) + f";{joined}concat=n={len(frames)}:v=1:a=0,scale={size[0]}:{size[1]}:flags=lanczos,format=yuv420p[v]"
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-filter_complex", graph, "-map", "[v]", "-an",
                        "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-profile:v", "high", "-pix_fmt", "yuv420p",
                        "-x264-params", "colorprim=bt709:transfer=bt709:colormatrix=bt709", "-color_range", "tv",
                        "-movflags", "+faststart", out], capture_output=True, text=True, timeout=1800)
    if r.returncode != 0:
        raise SystemExit(f"preview failed: {r.stderr[-1500:]}")
    return os.path.getsize(out)


def check(path, size, frame_count):
    info = probe(path)
    streams = info["streams"]
    problems = []
    if any(s["codec_type"] == "audio" for s in streams):
        problems.append("has sound")
    v = next((s for s in streams if s["codec_type"] == "video"), None)
    if not v or v["codec_name"] != "h264" or v["pix_fmt"] != "yuv420p":
        problems.append(f"video {v and v['codec_name']} {v and v['pix_fmt']}")
    elif (v["width"], v["height"]) != size:
        problems.append(f"{v['width']}x{v['height']}, expected {size[0]}x{size[1]}")
    elif int(v["nb_frames"]) != frame_count:
        problems.append(f"{v['nb_frames']} frames, expected {frame_count}")
    with open(path, "rb") as f:
        head = f.read(1 << 20)
    moov, mdat = head.find(b"moov"), head.find(b"mdat")
    if moov < 0 or (0 <= mdat < moov):
        problems.append("moov is not ahead of mdat")
    if problems:
        raise SystemExit(f"preview check failed for {path}: " + "; ".join(problems))


def make(clips, video, out):
    """Write out from video; returns (bytes, crf, (w, h), seconds)."""
    info = probe(video)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    fps = float(Fraction(v["r_frame_rate"]))
    total = int(v.get("nb_frames") or round(float(info["format"]["duration"]) * fps))
    frames = clip_frames(clips, fps, total)
    size = fitted(v["width"], v["height"])
    work = Path(out).with_name("." + Path(out).name + ".partial.mp4")
    try:
        for crf in CRFS:
            got = encode(video, frames, size, crf, str(work))
            if got <= TARGET_BYTES:
                break
            print(f"preview: {got / 1e6:.2f} MB at CRF {crf} > {TARGET_BYTES / 1e6:.0f} MB target")
        if got > MAX_BYTES:
            raise SystemExit(f"preview still {got} bytes > {MAX_BYTES} at CRF {crf}; declare shorter clips in window.__preview")
        check(str(work), size, sum(b - a for a, b in frames))
        os.replace(work, out)
    finally:
        work.unlink(missing_ok=True)
    return got, crf, size, sum(b - a for a, b in frames) / fps


def main(cues_path, video, out):
    clips = json.load(open(cues_path)).get("preview")
    if not clips:
        # Only the caller's generated output is stale; never sweep sibling files.
        Path(out).unlink(missing_ok=True)
        print("no preview clips declared (window.__preview); removed stale preview output")
        return
    got, crf, size, seconds = make(clips, video, out)
    print(f"preview: {len(clips)} clips, {seconds:.1f} s, {size[0]}x{size[1]}, CRF {crf}, {got / 1e6:.2f} MB -> {out}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
