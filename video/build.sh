#!/usr/bin/env bash
# Render a timeline page to media/<name>.mp4 (web, at most 15 MB), media/<name>_hq.mp4,
# media/<name>.jpg and, when the page declares window.__gif, media/<name>.gif.
#   bash video/build.sh intro.html          (or video/intro.html; POSTER_AT=12 sets the poster, in seconds)
#   RECORD_ARGS="--cpu --workers 2" bash video/build.sh intro.html   (no Metal GPU: render on SwiftShader)
set -euo pipefail
ARG=${1:-intro.html}
if [ -f "$ARG" ]; then PAGE="$(cd "$(dirname "$ARG")" && pwd)/$(basename "$ARG")"; else PAGE=$ARG; fi
cd "$(dirname "$0")"
[ -f "$PAGE" ] || { echo "page not found: $ARG" >&2; exit 1; }
case " ${RECORD_ARGS:-} " in *" --no-verify "*) echo "build.sh always verifies; run record.cjs directly to skip it" >&2; exit 1;; esac
NAME=$(basename "$PAGE" .html)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

node record.cjs cues "$PAGE" "$WORK/cues.json" ${RECORD_ARGS:-}
python3 sfx.py "$WORK/cues.json" "$WORK/sfx.wav"
python3 music.py "$WORK/cues.json" "$WORK/music.wav"
ffmpeg -y -loglevel error -i "$WORK/music.wav" -i "$WORK/sfx.wav" \
  -filter_complex "[0][1]amix=inputs=2:normalize=0,alimiter=limit=0.95:level=false:latency=true" \
  -ar 48000 -c:a pcm_f32le "$WORK/mix.wav"

# The recorder renders every frame twice on different browsers and exits with 3 if any frame
# differs. Now and then one browser draws web-font text wrongly for a stretch (see README), so a
# mismatch is rendered again; any other failure stops here. Mismatching frames stay in video/mismatch/.
for attempt in 1 2 3 4 5; do
  status=0
  node record.cjs video "$PAGE" "$WORK/master.mkv" ${RECORD_ARGS:-} || status=$?
  [ "$status" = 0 ] && break
  [ "$status" = 3 ] || exit "$status"
  [ "$attempt" = 5 ] && { echo "no verified render after 5 attempts" >&2; exit 3; }
  echo "render attempt $attempt did not verify; rendering again" >&2
done

python3 deliver.py "$WORK/master.mkv" "$WORK/mix.wav" ../media "$NAME" ${POSTER_AT:-}
python3 gif.py "$WORK/cues.json" "../media/$NAME.mp4" "../media/$NAME.gif"
