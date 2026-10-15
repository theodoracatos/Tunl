#!/usr/bin/env python3
# itch.io cover (630x500) from the Play feature graphic (branding/feature-graphic.svg,
# "Steigflug"): the same violet ground, rays and AMBER F-14, cropped around the ship
# and the wordmark moved top-left. Re-run after the feature graphic is re-rendered
# (branding/render-ship-mark.mjs). Needs rsvg-convert and Pillow.
#   python3 flytunl-site/itch/make-cover.py
import os, subprocess, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'branding', 'feature-graphic.svg')
OUT = os.path.join(HERE, 'cover.png')

svg = open(SRC, encoding='utf8').read()
swaps = [
    ('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">',
     '<svg xmlns="http://www.w3.org/2000/svg" width="630" height="500" viewBox="380 0 630 500">'),
    ('<g transform="translate(48,186) scale(0.54)">', '<g transform="translate(383,10) scale(0.42)">'),
]
for a, b in swaps:
    if svg.count(a) != 1:
        raise SystemExit('feature-graphic.svg changed shape, update the swaps: ' + a[:60])
    svg = svg.replace(a, b)

with tempfile.TemporaryDirectory() as tmp:
    s, p = os.path.join(tmp, 'c.svg'), os.path.join(tmp, 'c.png')
    open(s, 'w', encoding='utf8').write(svg)
    subprocess.run(['rsvg-convert', '-w', '1260', s, '-o', p], check=True)
    Image.open(p).convert('RGB').resize((630, 500), Image.LANCZOS).save(OUT, optimize=True)
print(OUT)
