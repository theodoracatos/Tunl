#!/usr/bin/env python3
# itch.io cover (630x500) and devlog cover (1600x900, 16:9) from the Play feature graphic
# (branding/feature-graphic.svg, "Steigflug"): the same violet ground, rays and AMBER F-14.
# The cover is cropped around the ship with the wordmark moved top-left; the devlog cover
# narrows the frame to 16:9 and shifts the ship group left. Re-run after the feature graphic is re-rendered
# (branding/render-ship-mark.mjs). Needs rsvg-convert and Pillow.
#   python3 flytunl-site/itch/make-cover.py
import os, subprocess, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'branding', 'feature-graphic.svg')
SRC_SVG = open(SRC, encoding='utf8').read()


def render(swaps, width, size, out):
    svg = SRC_SVG
    for a, b in swaps:
        if svg.count(a) != 1:
            raise SystemExit('feature-graphic.svg changed shape, update the swaps: ' + a[:60])
        svg = svg.replace(a, b)
    with tempfile.TemporaryDirectory() as tmp:
        s, p = os.path.join(tmp, 'c.svg'), os.path.join(tmp, 'c.png')
        open(s, 'w', encoding='utf8').write(svg)
        subprocess.run(['rsvg-convert', '-w', str(width), s, '-o', p], check=True)
        im = Image.open(p).convert('RGB').resize(size, Image.LANCZOS)
        im.save(out, quality=90) if out.endswith('.jpg') else im.save(out, optimize=True)
    print(out)


BG = '  <rect width="1024" height="500" fill="url(#bgGrd)"/>\n'
render([
    ('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">',
     '<svg xmlns="http://www.w3.org/2000/svg" width="630" height="500" viewBox="380 0 630 500">'),
    ('<g transform="translate(48,186) scale(0.54)">', '<g transform="translate(383,10) scale(0.42)">'),
], 1260, (630, 500), os.path.join(HERE, 'cover.png'))
render([
    ('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">',
     '<svg xmlns="http://www.w3.org/2000/svg" width="889" height="500" viewBox="0 0 889 500">'),
    (BG, BG + '  <g transform="translate(-95,0)">\n'),
    ('  <!-- wordmark -->', '  </g>\n  <!-- wordmark -->'),
    ('<g transform="translate(48,186) scale(0.54)">', '<g transform="translate(30,186) scale(0.50)">'),
], 1600, (1600, 900), os.path.join(HERE, 'devlog-cover.jpg'))
