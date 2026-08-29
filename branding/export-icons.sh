#!/bin/bash
# Regenerate every applied TUNL icon/favicon from the branding masters and
# wire them into iOS, Android and the flytunl.ch site.
# Masters: branding/icon-mark.svg (full-bleed), branding/icon-adaptive-foreground.svg,
#          branding/feature-graphic.svg
set -euo pipefail
cd "$(dirname "$0")/.."
MARK=branding/icon-mark.svg
FG=branding/icon-adaptive-foreground.svg
FEAT=branding/feature-graphic.svg
TMP=$(mktemp -d)

# render MARK at size $1 to $2, flattened to opaque RGB on #04040e (no alpha)
rgb () { # size out
  rsvg-convert -w "$1" -h "$1" -b '#04040e' "$MARK" -o "$TMP/r.png"
  python3 -c "from PIL import Image; Image.open('$TMP/r.png').convert('RGB').save('$2')"
  echo "  $2 (${1}x${1})"
}

# render MARK at size $1 to $2 as an RGBA circle (transparent corners) - for
# Android's legacy pre-API-26 round launcher icon
round () { # size out
  rsvg-convert -w "$1" -h "$1" -b '#04040e' "$MARK" -o "$TMP/r.png"
  python3 -c "
from PIL import Image, ImageDraw
s=$1
im=Image.open('$TMP/r.png').convert('RGBA')
m=Image.new('L',(s,s),0); ImageDraw.Draw(m).ellipse([0,0,s-1,s-1],fill=255)
im.putalpha(m); im.save('$2')"
  echo "  $2 (${1}x${1}, round)"
}

echo "iOS app icon (Assets.xcassets/AppIcon.appiconset, linked via ASSETCATALOG_COMPILER_APPICON_NAME):"
rgb 1024 Tunl/Tunl/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png

echo "Android launcher (manifest: android:icon=@mipmap/ic_launcher, android:roundIcon=@mipmap/ic_launcher_round):"
for d in "mdpi 48" "hdpi 72" "xhdpi 96" "xxhdpi 144" "xxxhdpi 192"; do
  set -- $d
  rgb   "$2" "Tunl.Android/app/src/main/res/mipmap-$1/ic_launcher.png"
  round "$2" "Tunl.Android/app/src/main/res/mipmap-$1/ic_launcher_round.png"
done

echo "Android adaptive-icon foreground (RGBA; ic_launcher.xml + ic_launcher_round.xml reference @drawable/ic_launcher_foreground):"
rsvg-convert -w 432 -h 432 "$FG" -o Tunl.Android/app/src/main/res/drawable-xxxhdpi/ic_launcher_foreground.png
echo "  Tunl.Android/app/src/main/res/drawable-xxxhdpi/ic_launcher_foreground.png (432x432)"

echo "Play Store listing icon:"
rgb 512 Screenshots/Android/play_icon_512.png

echo "Web favicons (branding/web - reference copy):"
rgb 512 branding/web/favicon-512.png
rgb 192 branding/web/favicon-192.png
rgb 180 branding/web/apple-touch-icon-180.png
rgb 32  branding/web/favicon-32.png
rgb 16  branding/web/favicon-16.png
cp "$MARK" branding/web/favicon.svg
echo "  branding/web/favicon.svg (copied master)"

echo "Web favicons (flytunl-site/site - deployed; linked from every page head + site.webmanifest):"
rgb 512 flytunl-site/site/favicon-512.png
rgb 192 flytunl-site/site/favicon-192.png
rgb 180 flytunl-site/site/apple-touch-icon-180.png
rgb 32  flytunl-site/site/favicon-32.png
rgb 16  flytunl-site/site/favicon-16.png
cp "$MARK" flytunl-site/site/favicon.svg
echo "  flytunl-site/site/favicon.svg (copied master)"

echo "Feature graphic PNG (og:image / twitter:image on the site):"
rsvg-convert -w 1024 -h 500 -b '#04040e' "$FEAT" -o "$TMP/f.png"
python3 -c "
from PIL import Image
i=Image.open('$TMP/f.png').convert('RGB')
for p in ('branding/web/feature-graphic-1024x500.png',
          'flytunl-site/site/feature-graphic-1024x500.png',
          'Screenshots/Android/feature_graphic_1024x500.png'):
    i.save(p)"
echo "  branding/web/feature-graphic-1024x500.png (1024x500)"
echo "  flytunl-site/site/feature-graphic-1024x500.png (1024x500)"
echo "  Screenshots/Android/feature_graphic_1024x500.png (1024x500, Play Console upload)"

rm -rf "$TMP"
echo "done."
