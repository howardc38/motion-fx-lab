#!/usr/bin/env bash
# Render a timeline page to media/<name>.mp4 (web, at most 15 MB), media/<name>_hq.mp4,
# media/<name>.jpg and, when the page declares window.__gif, media/<name>.gif.
#   bash video/build.sh intro.html          (or video/intro.html; the poster is at window.__poster seconds,
#                                            POSTER_AT=12 overrides it, and a third of the way in is the default)
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
python3 prepare-audio.py "$WORK/cues.json" "$PAGE" "$WORK/mix.wav"

# The recorder renders every frame twice on different browsers and exits with 3 if any frame
# differs. Known history-dependent causes are fixed in engine.js (see README). A mismatch
# is retried; persistent disagreement stops publication. Matching pixels do not prove authored content is correct. Mismatching
# frames stay in video/mismatch/.
for attempt in 1 2 3 4 5; do
  status=0
  node record.cjs video "$PAGE" "$WORK/master.mkv" ${RECORD_ARGS:-} || status=$?
  [ "$status" = 0 ] && break
  [ "$status" = 3 ] || exit "$status"
  [ "$attempt" = 5 ] && { echo "no verified render after 5 attempts" >&2; exit 3; }
  echo "render attempt $attempt did not verify; rendering again" >&2
done

POSTER=${POSTER_AT:-$(python3 -c 'import json, sys; p = json.load(open(sys.argv[1])).get("poster"); print("" if p is None else p)' "$WORK/cues.json")}
mkdir "$WORK/delivery"
python3 deliver.py "$WORK/master.mkv" "$WORK/mix.wav" "$WORK/delivery" "$NAME" ${POSTER:-}
python3 gif.py "$WORK/cues.json" "$WORK/delivery/$NAME.mp4" "$WORK/delivery/$NAME.gif"
# A failed GIF must not leave a new film paired with an old README preview.
ARTIFACTS=("$NAME.mp4" "${NAME}_hq.mp4" "$NAME.jpg")
if [ -f "$WORK/delivery/$NAME.gif" ]; then
  ARTIFACTS+=("$NAME.gif")
else
  ARTIFACTS+=(--remove "$NAME.gif")
fi
node publish.cjs "$WORK/delivery" ../media "${ARTIFACTS[@]}"
