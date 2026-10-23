#!/usr/bin/env bash
# Render every lesson whose out/Lxx.mp4 is missing or older than public/Lxx/timeline.json.
# Usage: bash tools/render_stale.sh [L00 L03 ...]   (default: all seventeen, in order)
# One retry at --concurrency 1 (the compositor sometimes fails with "No frame found at position").
cd "$(dirname "$0")/.." || exit 1
CHROME="C:/Program Files/Google/Chrome/Application/chrome.exe"
ALL="L00 L01 L02 L03 L04 L05 L06 L07 L08 L09 L10 L11 L12 L13 L14 L15 L16"
for L in ${@:-$ALL}; do
  tl="public/$L/timeline.json"; mp4="out/$L.mp4"
  [ -f "$tl" ] || { echo "$L: no timeline"; continue; }
  if [ -f "$mp4" ] && [ "$mp4" -nt "$tl" ]; then continue; fi
  for try in 1 2; do
    extra=""; [ "$try" = 2 ] && extra="--concurrency 1"
    npx remotion render src/index.ts "$L" "$mp4" --browser-executable "$CHROME" --log=error $extra > "out/render-$L.log" 2>&1
    echo "$L try$try exit=$? $(date +%H:%M)"
    [ -f "$mp4" ] && [ "$mp4" -nt "$tl" ] && break
  done
done
echo "done $(date +%H:%M): $(ls out/L*.mp4 2>/dev/null | wc -l) mp4"
