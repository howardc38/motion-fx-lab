#!/usr/bin/env bash
# Render a timeline page to media/<name>.mp4 (web, at most 15 MB) and media/<name>_hq.mp4.
#   bash video/build.sh intro.html          (POSTER_AT=12 sets the poster frame, in seconds)
# Add --cpu to record.cjs below on a machine without a GPU; never mix backends in one run.
set -euo pipefail
cd "$(dirname "$0")"
PAGE=${1:-intro.html}
NAME=$(basename "$PAGE" .html)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

node record.cjs cues "$PAGE" "$WORK/cues.json"
python3 sfx.py "$WORK/cues.json" "$WORK/sfx.wav"
python3 music.py "$WORK/cues.json" "$WORK/music.wav"
ffmpeg -y -loglevel error -i "$WORK/music.wav" -i "$WORK/sfx.wav" \
  -filter_complex "[0][1]amix=inputs=2:normalize=0,alimiter=limit=0.95:level=false" -ar 48000 "$WORK/mix.wav"
# The recorder renders every frame twice on different browsers and fails if any frame differs.
# Now and then one browser draws web-font text wrongly for a stretch (see README), so try again.
for attempt in 1 2 3; do
  if node record.cjs video "$PAGE" "$WORK/master.mkv"; then break; fi
  [ "$attempt" = 3 ] && { echo "no verified render after 3 attempts" >&2; exit 1; }
  echo "render attempt $attempt did not verify; rendering again" >&2
done
python3 deliver.py "$WORK/master.mkv" "$WORK/mix.wav" ../media "$NAME" "${POSTER_AT:-12}"
