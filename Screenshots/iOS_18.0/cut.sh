#!/usr/bin/env bash
# 18.0 store/web cut from one 79s web-build run (score 1156, World 635).
set -euo pipefail
SRC=${SRC:-$HOME/Downloads/tunl-20260927-w635-1156pts.mp4}
OUT=${1:?outdir}; mkdir -p "$OUT"
# segments: start end  (source seconds)
SEGS=( "0.0 5.5"  "27.4 32.4"  "43.8 49.6"  "59.8 63.5"  "66.0 69.75"  "72.75 77.0" )
F=""; C=""; i=0
for s in "${SEGS[@]}"; do
  set -- $s; a=$1; b=$2
  F+="[0:v]trim=$a:$b,setpts=PTS-STARTPTS[v$i];"
  F+="[0:a]atrim=$a:$b,asetpts=PTS-STARTPTS,afade=t=in:d=0.06,areverse,afade=t=in:d=0.12,areverse[a$i];"
  C+="[v$i][a$i]"; i=$((i+1))
done
F+="${C}concat=n=$i:v=1:a=1[cv][ca];"
# hold the title frame 0.9s (tpad clone), matching the 15.0 cut
F+="[cv]tpad=start_duration=0.9:start_mode=clone,scale=1920:-2:flags=lanczos:in_range=full:out_range=limited,setsar=1,fps=30,format=yuv420p,split=2[p1][p2];"
F+="[ca]adelay=900|900,aresample=48000,asplit=2[q1][q2];"
T=$(printf "%s\n" "${SEGS[@]}" | awk '{t+=$2-$1} END{printf "%.3f", t+0.9}')
FO=$(python3 -c "print(round($T-0.5,3))")
F+="[p1]pad=1920:886:0:(886-ih)/2:color=black,fade=t=out:st=$FO:d=0.5[o1];"
F+="[p2]pad=1920:1080:0:(1080-ih)/2:color=black,fade=t=out:st=$FO:d=0.5[o2];"
F+="[q1]afade=t=out:st=$FO:d=0.5,aresample=44100[r1];[q2]afade=t=out:st=$FO:d=0.5[r2]"
X264="-c:v libx264 -profile:v high -level 4.0 -preset slow -pix_fmt yuv420p -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709"
ffmpeg -v error -y -i "$SRC" -filter_complex "$F" \
  -map "[o1]" -map "[r1]" $X264 -crf 19 -c:a aac -b:a 160k -movflags +faststart "$OUT/app-preview-1920x886.mp4" \
  -map "[o2]" -map "[r2]" $X264 -crf 20 -c:a aac -b:a 192k -movflags +faststart "$OUT/youtube-1920x1080.mp4"
echo "total $T s"
