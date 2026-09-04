#!/usr/bin/env bash
# ============================================================
#  build-portrait-video.sh - the video counterpart to
#  make-portrait-frames-8.0.py's screenshot pipeline.
# ============================================================
#  1. Renders the cave-corridor frame (headline, ship, wordmark, and a
#     rounded transparent hole) via make-portrait-video-frame.py.
#  2. Crops the source landscape clip around the player's fixed screen
#     position (see CROP_* in that script) and composites it into the hole
#     with ffmpeg.
#
#  Usage:  Screenshots/build-portrait-video.sh [source.mp4] [output.mp4]
#  Defaults to this repo's current 8.0 App Store preview footage.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="${1:-Screenshots/iOS_8.0/en/app-preview-6.9.mp4}"
OUT="${2:-Screenshots/iOS_8.0/en/tunl-portrait-teaser.mp4}"
FRAME="Screenshots/iOS_8.0/en/portrait-video-frame.png"

echo "Rendering frame overlay..."
HOLE=$(python3 Screenshots/make-portrait-video-frame.py | tee /dev/stderr | grep "hole rect")
# "hole rect (px, for ffmpeg): x=54 y=380 w=972 h=448"
X=$(echo "$HOLE" | sed -E 's/.*x=([0-9]+).*/\1/')
Y=$(echo "$HOLE" | sed -E 's/.*y=([0-9]+).*/\1/')
CW=$(echo "$HOLE" | sed -E 's/.*w=([0-9]+).*/\1/')
CH=$(echo "$HOLE" | sed -E 's/.*h=([0-9]+).*/\1/')

# Keep in sync with CROP_W/CROP_H/CROP_X/CROP_Y in make-portrait-video-frame.py.
CROP_W=1300
CROP_H=1290
CROP_X=460
CROP_Y=0

echo "Compositing $SRC into the hole (crop ${CROP_W}x${CROP_H}+${CROP_X}+${CROP_Y} -> ${CW}x${CH} at ${X},${Y})..."
ffmpeg -y \
  -i "$SRC" \
  -loop 1 -i "$FRAME" \
  -filter_complex "\
[0:v]crop=${CROP_W}:${CROP_H}:${CROP_X}:${CROP_Y},scale=${CW}:${CH}:flags=lanczos[vid]; \
[vid]pad=1080:2340:${X}:${Y}:color=black@0[padded]; \
[padded][1:v]overlay=0:0:shortest=1,format=yuv420p[out]" \
  -map "[out]" -map "0:a?" \
  -c:v libx264 -crf 18 -preset medium \
  -c:a aac -b:a 160k \
  -shortest "$OUT"

echo "wrote $OUT"
