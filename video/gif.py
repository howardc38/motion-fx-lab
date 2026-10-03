"""Cut a looping GIF preview from a finished video, using the clips the page declares.

    python3 gif.py cues.json video.mp4 out.gif

The page lists the clips in window.__gif as [[start_seconds, end_seconds], ...]; record.cjs exports
them into cues.json. Without clips it removes only the specified stale GIF output. The GIF has no sound, 800 px wide, 12 fps.
"""
import json
import subprocess
import sys
from pathlib import Path


def main(cues_path, video, out):
    clips = json.load(open(cues_path)).get("gif")
    if not clips:
        # Only the caller's generated output is stale; never sweep sibling files.
        Path(out).unlink(missing_ok=True)
        print("no GIF clips declared (window.__gif); removed stale GIF output")
        return
    parts = [f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS[c{i}]" for i, (a, b) in enumerate(clips)]
    joined = "".join(f"[c{i}]" for i in range(len(clips)))
    graph = ";".join(parts) + (f";{joined}concat=n={len(clips)}:v=1[v];[v]fps=12,scale=800:-1:flags=lanczos,split[x][y];"
                               "[x]palettegen=max_colors=128:stats_mode=diff[p];[y][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle")
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-filter_complex", graph, "-loop", "0", out],
                       capture_output=True, text=True, timeout=1800)
    if r.returncode != 0:
        raise SystemExit(f"GIF failed: {r.stderr[-1500:]}")
    seconds = sum(b - a for a, b in clips)
    print(f"gif: {len(clips)} clips, {seconds:.1f} s -> {out}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
