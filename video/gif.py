"""Cut a looping GIF from a finished video, using the clips the page declares.

    python3 gif.py cues.json video.mp4 out.gif

The page lists the clips in window.__gif as [[start_seconds, end_seconds], ...]; record.cjs exports
them into cues.json. Without clips it removes only the specified stale GIF output. The GIF has no sound,
12 fps, and 800 px wide unless that exceeds MAX_BYTES; then it is made narrower, and it fails if even
the narrowest of WIDTHS does not fit. Only the README hero declares a GIF; cards use preview.py's silent MP4 loops.
"""
import json
import math
import os
import subprocess
import sys
from pathlib import Path

MAX_BYTES = 3_000_000
WIDTHS = (800, 720, 640, 560, 480)
FPS = 12


def clip_frames(clips, fps):
    """Clips as [first, end) frame indices of the film, so a clip starts on the frame the film shows at
    its start time. Timestamps would not do: a delivered file's first frame is stamped 0.0667 s."""
    return [(math.floor(a * fps + 0.5), math.floor(b * fps + 0.5)) for a, b in clips]   # halves round up


def video_fps(video):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate",
                          "-of", "csv=p=0", video], capture_output=True, text=True, check=True, timeout=60).stdout.strip()
    num, den = out.split("/")
    return int(num) / int(den)


def encode(video, frames, width, out):
    parts = [f"[0:v]trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS[c{i}]" for i, (a, b) in enumerate(frames)]
    joined = "".join(f"[c{i}]" for i in range(len(frames)))
    graph = ";".join(parts) + (f";{joined}concat=n={len(frames)}:v=1[v];[v]fps={FPS},scale={width}:-1:flags=lanczos,split[x][y];"
                               "[x]palettegen=max_colors=128:stats_mode=diff[p];[y][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle")
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-filter_complex", graph, "-loop", "0", out],
                       capture_output=True, text=True, timeout=1800)
    if r.returncode != 0:
        raise SystemExit(f"GIF failed: {r.stderr[-1500:]}")
    return os.path.getsize(out)


def main(cues_path, video, out):
    clips = json.load(open(cues_path)).get("gif")
    if not clips:
        # Only the caller's generated output is stale; never sweep sibling files.
        Path(out).unlink(missing_ok=True)
        print("no GIF clips declared (window.__gif); removed stale GIF output")
        return
    frames = clip_frames(clips, video_fps(video))
    for width in WIDTHS:
        size = encode(video, frames, width, out)
        if size <= MAX_BYTES:
            break
        print(f"gif: {size / 1e6:.2f} MB at {width} px > {MAX_BYTES / 1e6:.0f} MB; trying narrower")
    else:
        Path(out).unlink(missing_ok=True)
        raise SystemExit(f"GIF still {size} bytes > {MAX_BYTES} at {WIDTHS[-1]} px; declare shorter clips in window.__gif")
    seconds = sum(b - a for a, b in clips)
    print(f"gif: {len(clips)} clips, {seconds:.1f} s, {width} px, {size / 1e6:.2f} MB -> {out}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
