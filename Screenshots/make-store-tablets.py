#!/usr/bin/env python3
"""TUNL 15.0 Google Play TABLET screenshots (7" and 10" slots), 1920x1080.

The phone set (make-store-portraits.py) is portrait; Play's tablet slots want
16:9 landscape, and TUNL is landscape-only anyway, so here the raw capture is the
hero: the FULL 2868x1320 capture, nothing cropped, inset under a one-line headline
in the same faces, palette and copy as the phone set (its `COPY["en"]`), so the
listing reads as one system. The in-game UI stays English.

Tablet slots exist only on the DEFAULT (en-US) Play listing - the 14 translations
inherit them - so this writes one English set. It replaces the 12.x frames (Courier
caption under a small inset), which were the last stale images on the listing.

Inputs : Screenshots/iOS_15.0/capture-*.png (same six raw captures, same order).
Output : Screenshots/iOS_15.0/en/play-tablet-16x9/0N.png (1920x1080). The same six
         files go into BOTH the 7" and the 10" slot (both accept 1920x1080).

Run: python3 Screenshots/make-store-tablets.py
Needs Pillow and rsvg-convert (branding/wordmark.svg).
"""

import importlib.util
import os
import random

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("portraits", os.path.join(HERE, "make-store-portraits.py"))
P = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(P)      # main() is behind __name__ == "__main__", so this only loads helpers

W, H = 1920, 1080
OUT = os.path.join(P.SRC_DIR, "en", "play-tablet-16x9")

HEAD_PX, SUB_PX = 66, 30
SHOT_Y = 214                      # top of the capture
SHOT_H = H - SHOT_Y - 44          # leave the bottom margin symmetric-ish
RADIUS = 30


def backdrop(seed):
    """Void with a soft accent bloom behind the capture and a little dust."""
    img = Image.new("RGBA", (W, H), (*P.VOID, 255))
    bloom = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(bloom).ellipse([W * 0.12, H * 0.34, W * 0.88, H * 1.10], fill=(*P.ROSE, 46))
    img.alpha_composite(bloom.filter(ImageFilter.GaussianBlur(120)))
    d = ImageDraw.Draw(img, "RGBA")
    rnd = random.Random(seed)
    for _ in range(190):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        s = rnd.choice([1, 1, 2])
        d.ellipse([x, y, x + s, y + s], fill=(220, 215, 255, rnd.randint(28, 120)))
    return img


def header(img, lines, accent, sub):
    """One line, the accent segment in the day colour, centred; subhead under it."""
    d = ImageDraw.Draw(img)
    f = P.fnt("en", HEAD_PX)
    gap = d.textlength(" ", font=f) * 1.15
    widths = [d.textlength(l, font=f) for l in lines]
    total = sum(widths) + gap * (len(lines) - 1)
    x = (W - total) / 2
    y = 44
    for i, line in enumerate(lines):
        if i == accent:
            gl = Image.new("RGBA", img.size, (0, 0, 0, 0))
            ImageDraw.Draw(gl).text((x, y), line, font=f, fill=(*P.ROSE, 150), anchor="la")
            img.alpha_composite(gl.filter(ImageFilter.GaussianBlur(14)))
        d.text((x, y), line, font=f, fill=P.ROSE if i == accent else P.INK, anchor="la")
        x += widths[i] + gap
    sf = P.fnt("en", SUB_PX, True)
    d.text((W / 2, y + HEAD_PX + 22), sub, font=sf, fill=P.DIM, anchor="ma")


def build(shot, idx):
    img = backdrop(idx * 7 + 3)
    lines, sub = P.COPY["en"][idx]
    header(img, lines, P.ACCENT[idx], sub)

    sw = round(SHOT_H * shot.width / shot.height)
    scaled = shot.resize((sw, SHOT_H), Image.LANCZOS)
    x0 = (W - sw) // 2
    box = (x0, SHOT_Y, x0 + sw, SHOT_Y + SHOT_H)
    P.shadow(img, box, RADIUS, blur=34, alpha=190, dy=18)
    P.glow_rect(img, box, RADIUS, width=6, blur=22, alpha=150)
    img.alpha_composite(P.rounded(scaled, RADIUS), (x0, SHOT_Y))
    ImageDraw.Draw(img).rounded_rectangle(box, radius=RADIUS, outline=(*P.ROSE_EDGE, 200), width=2)

    wm = P.wordmark(180)
    img.alpha_composite(wm, (72, 56))
    return img.convert("RGB")


def main():
    os.makedirs(OUT, exist_ok=True)
    shots = P.load_captures()
    for i, shot in enumerate(shots):
        path = os.path.join(OUT, "%02d.png" % (i + 1))
        build(shot, i).save(path, optimize=True)
        print(path, os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    main()
