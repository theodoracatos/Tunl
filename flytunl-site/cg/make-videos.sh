#!/usr/bin/env bash
# CrazyGames preview videos from the 18.0 store cut (Screenshots/iOS_18.0/youtube-1920x1080.mp4,
# a 1920x886 picture letterboxed to 1080). CrazyGames wants 15-20 s, no sound, no black bars,
# 1080p in 16:9 and in 2:3, and the static cover as the first frame (make-covers.mjs).
# The first 17.2 s of the cut are the title, the city, a star and the laser.
#   bash flytunl-site/cg/make-videos.sh
set -euo pipefail
cd "$(dirname "$0")"
SRC=../../Screenshots/iOS_18.0/youtube-1920x1080.mp4
LEN=17.2      # seconds of the cut used
COVER=1.0     # seconds the cover stands before the cut fades in
X264="-c:v libx264 -profile:v high -preset slow -crf 19 -pix_fmt yuv420p -r 30 -movflags +faststart -an"
# The picture is rows 97..983. 16:9: 1575 wide, centred. 2:3: 591 wide from x 250, which
# keeps the ship (PX, about a fifth of the width) in the left third with the cave ahead of it.
ffmpeg -v error -y -loop 1 -t $COVER -i cover-landscape.png -t $LEN -i "$SRC" -filter_complex \
  "[0:v]scale=1920:1080,setsar=1,fps=30,format=yuv420p[c];\
   [1:v]crop=1575:886:172:97,scale=1920:1080:flags=lanczos,setsar=1,fps=30,format=yuv420p[g];\
   [c][g]xfade=transition=fade:duration=0.3:offset=$(python3 -c "print($COVER-0.3)"),fade=t=out:st=$(python3 -c "print($COVER+$LEN-0.3-0.5)"):d=0.5[v]" \
  -map "[v]" $X264 preview-landscape-1920x1080.mp4
ffmpeg -v error -y -loop 1 -t $COVER -i video-cover-portrait.png -t $LEN -i "$SRC" -filter_complex \
  "[0:v]scale=1080:1620,setsar=1,fps=30,format=yuv420p[c];\
   [1:v]crop=591:886:250:97,scale=1080:1620:flags=lanczos,setsar=1,fps=30,format=yuv420p[g];\
   [c][g]xfade=transition=fade:duration=0.3:offset=$(python3 -c "print($COVER-0.3)"),fade=t=out:st=$(python3 -c "print($COVER+$LEN-0.3-0.5)"):d=0.5[v]" \
  -map "[v]" $X264 preview-portrait-1080x1620.mp4
for f in preview-landscape-1920x1080.mp4 preview-portrait-1080x1620.mp4; do
  echo "$f $(ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$f")"
done
