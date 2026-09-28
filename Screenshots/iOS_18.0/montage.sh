#!/usr/bin/env bash
set -euo pipefail
SRC=~/Downloads/tunl-20260927-w635-1156pts.mp4
SEGS=( "0.0 5.5"  "27.4 32.4"  "43.8 49.6"  "59.8 63.5"  "66.0 69.75"  "72.75 77.0" )
F=""; C=""; i=0
for s in "${SEGS[@]}"; do set -- $s
  F+="[0:v]trim=$1:$2,setpts=PTS-STARTPTS[v$i];[0:a]atrim=$1:$2,asetpts=PTS-STARTPTS,afade=t=in:d=0.06,areverse,afade=t=in:d=0.12,areverse[a$i];"
  C+="[v$i][a$i]"; i=$((i+1)); done
F+="${C}concat=n=$i:v=1:a=1[cv][ca];[cv]tpad=start_duration=0.9:start_mode=clone,fps=30[v];[ca]adelay=900|900,aresample=48000[a]"
ffmpeg -v error -y -i $SRC -filter_complex "$F" -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 12 -pix_fmt yuvj420p -c:a aac -b:a 192k montage1912.mp4
