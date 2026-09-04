#!/usr/bin/env bash
# ============================================================
#  build-portrait-video.sh - the video counterpart to
#  make-portrait-frames-8.0.py's screenshot pipeline.
# ============================================================
#  1. Renders the cave-corridor frame (headline, ship, wordmark, and a
#     rounded transparent hole shaped to the source clip's own aspect ratio)
#     via make-portrait-video-frame.py.
#  2. Scales the FULL source landscape clip (no horizontal crop) into that
#     hole and composites it with ffmpeg.
#
#  Usage:  Screenshots/build-portrait-video.sh [source.mp4] [output.mp4] [locale]
#  Defaults to this repo's current 8.0 App Store preview footage. `locale`
#  picks the headline/subhead text (TEXT dict in make-portrait-video-frame.py,
#  e.g. "en" or "pt-BR") and defaults to "en".
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="${1:-Screenshots/iOS_8.0/en/app-preview-6.9.mp4}"
OUT="${2:-Screenshots/iOS_8.0/en/tunl-portrait-teaser.mp4}"
export TUNL_LOCALE="${3:-en}"
FRAME="$(dirname "$OUT")/portrait-video-frame.png"

# No horizontal crop: an earlier version cropped a fixed strip tuned to keep
# just the ship + score HUD in frame, but the clip also pans over full-width
# screens (title, ship shop) that strip cut text off both edges of. Showing
# the full frame instead means the hole must be shaped to the clip's own
# (wide) aspect ratio rather than the old tall/square card - see SRC_RATIO in
# make-portrait-video-frame.py, which is driven by these same TUNL_CROP_*
# vars set to the full frame here.
read -r SRC_W SRC_H <<<"$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$SRC" | tr x ' ')"
export TUNL_FRAME_OUT_DIR="$(dirname "$OUT")"
export TUNL_CROP_W=$SRC_W TUNL_CROP_H=$SRC_H TUNL_CROP_X=0 TUNL_CROP_Y=0

echo "Rendering frame overlay (source ${SRC_W}x${SRC_H}, full width, no crop)..."
HOLE=$(python3 Screenshots/make-portrait-video-frame.py | tee /dev/stderr | grep "hole rect")
# "hole rect (px, for ffmpeg): x=54 y=380 w=972 h=448"
X=$(echo "$HOLE" | sed -E 's/.*x=([0-9]+).*/\1/')
Y=$(echo "$HOLE" | sed -E 's/.*y=([0-9]+).*/\1/')
CW=$(echo "$HOLE" | sed -E 's/.*w=([0-9]+).*/\1/')
CH=$(echo "$HOLE" | sed -E 's/.*h=([0-9]+).*/\1/')

echo "Compositing full width of $SRC into the hole (scale to ${CW}x${CH} at ${X},${Y})..."
ffmpeg -y \
  -i "$SRC" \
  -loop 1 -i "$FRAME" \
  -filter_complex "\
[0:v]scale=${CW}:${CH}:flags=lanczos[vid]; \
[vid]pad=1080:2340:${X}:${Y}:color=black@0[padded]; \
[padded][1:v]overlay=0:0:shortest=1,format=yuv420p[out]" \
  -map "[out]" -map "0:a?" \
  -c:v libx264 -crf 18 -preset medium \
  -c:a aac -b:a 160k \
  -shortest "$OUT"

echo "wrote $OUT"
