#!/usr/bin/env python3
"""TUNL 19.0 App Store screenshots for the iPhone Duo (2026-10-08), 16 locales.

The Duo is the first iPhone with two screenshot sizes, one per display. Raw frames
come from the headless capture at the Duo's own canvas (Screenshots/README.md):

  node Screenshots/capture/capture.mjs Screenshots/iOS_19.0/duo-inner 951x669   # 2853x2007
  node Screenshots/capture/capture.mjs Screenshots/iOS_19.0/duo-outer 678x466   # 2034x1398

Inner display, LANDSCAPE 2853x2007: unfolded, the App Store lays out like a small
iPad, where landscape shots read fine - so the capture is the hero, as in the Play
tablet frames (make-store-tablets.py): one-line headline, the full capture under it
(type ~1.3x the tablet frame's, which read too small at this size).
Drawn at the target size, not scaled up, so the type stays sharp.

Outer display, PORTRAIT 1398x2034: folded, the Duo is a plain iPhone, whose search
card needs a portrait asset (the 15.0 reason for the portrait set). Same frame as
make-store-portraits.py (corridor, headline block, edge-to-edge strip, wordmark),
but the 1.45 aspect leaves no room for its zoom panel, so the full capture sits
centred between headline and wordmark. Laid out at 1320 wide, scaled by 1.06.

Copy, palette, fonts and slide order are make-store-portraits.py's (COPY, ACCENT),
so the Duo sets read as the same listing as the iPhone sets.

Outputs: Screenshots/iOS_19.0/<locale>/duo-inner-landscape/0N.png (2853x2007)
         Screenshots/iOS_19.0/<locale>/duo-outer-portrait/0N.png  (1398x2034)
Run: python3 Screenshots/make-store-duo.py [locale,locale,...]
Needs Pillow (with raqm for ar/hi) and rsvg-convert.
"""

import glob
import importlib.util
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("portraits", os.path.join(HERE, "make-store-portraits.py"))
P = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(P)      # main() is behind __name__ == "__main__", so this only loads helpers

SRC = os.path.join(HERE, "iOS_19.0")
INNER = (2853, 2007)
OUTER = (1398, 2034)


def load(kind, size):
    files = sorted(glob.glob(os.path.join(SRC, kind, "capture-*.png")))
    if len(files) != len(P.ZOOM):
        sys.exit("expected %d captures in %s/%s, found %d" % (len(P.ZOOM), SRC, kind, len(files)))
    shots = [Image.open(f).convert("RGB") for f in files]
    for f, s in zip(files, shots):
        if s.size != size:
            sys.exit("%s is %dx%d, expected %dx%d" % (f, *s.size, *size))
    return shots


# ------------------------------------------------------------ inner, landscape
def inner(shot, idx, loc):
    W, H = INNER
    k = W / 1920                                   # the tablet frame's scale
    img = Image.new("RGBA", (W, H), (*P.VOID, 255))
    bloom = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(bloom).ellipse([W * 0.12, H * 0.34, W * 0.88, H * 1.10], fill=(*P.ROSE, 46))
    img.alpha_composite(bloom.filter(ImageFilter.GaussianBlur(120 * k)))
    d = ImageDraw.Draw(img, "RGBA")
    rnd = random.Random(idx * 7 + 3)
    for _ in range(260):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        s = rnd.choice([1, 2, 2, 3])
        d.ellipse([x, y, x + s, y + s], fill=(220, 215, 255, rnd.randint(28, 120)))

    # wordmark top-left, headline centred in the width it leaves free on both sides
    P._WM = None                                   # wordmark() caches one width
    wm = P.wordmark(round(180 * k))
    wx, wy = round(72 * k), round(56 * k)
    img.alpha_composite(wm, (wx, wy))
    maxw = W - 2 * (wx + wm.width + 40 * k)

    lines, sub = P.COPY[loc][idx]
    dr = P.direction(loc)
    head = round((P.FONTS[loc][4] * 86 / 122) if loc in P.FONTS else 86) * k
    head = round(head)
    while True:
        f = P.fnt(loc, head)
        gap = d.textlength(" ", font=f) * 1.15
        widths = [d.textlength(l, font=f, direction=dr) for l in lines]
        total = sum(widths) + gap * (len(lines) - 1)
        if total <= maxw or head <= 72:
            break
        head -= 2
    y = round(44 * k)
    x = (W - total) / 2
    # Right to left for ar: the first segment sits rightmost.
    order = list(range(len(lines)))
    if dr == "rtl":
        order.reverse()
    for i in order:
        line = lines[i]
        if i == P.ACCENT[idx]:
            gl = Image.new("RGBA", img.size, (0, 0, 0, 0))
            ImageDraw.Draw(gl).text((x, y), line, font=f, fill=(*P.ROSE, 150), anchor="la", direction=dr)
            img.alpha_composite(gl.filter(ImageFilter.GaussianBlur(14 * k)))
        d.text((x, y), line, font=f, fill=P.ROSE if i == P.ACCENT[idx] else P.INK, anchor="la", direction=dr)
        x += widths[i] + gap
    sp = round(40 * k)
    while sp > 30 and d.textlength(sub, font=P.fnt(loc, sp, True), direction=dr) > maxw:
        sp -= 2
    d.text((W / 2, y + head + 26 * k), sub, font=P.fnt(loc, sp, True), fill=P.DIM, anchor="ma", direction=dr)

    # the full capture, nothing cropped
    shot_y, bottom = round(262 * k), round(44 * k)
    sh = H - shot_y - bottom
    sw = round(sh * shot.width / shot.height)
    scaled = shot.resize((sw, sh), Image.LANCZOS)
    x0 = (W - sw) // 2
    box = (x0, shot_y, x0 + sw, shot_y + sh)
    r = round(30 * k)
    P.shadow(img, box, r, blur=34 * k, alpha=190, dy=18 * k)
    P.glow_rect(img, box, r, width=round(6 * k), blur=22 * k, alpha=150)
    img.alpha_composite(P.rounded(scaled, r), (x0, shot_y))
    ImageDraw.Draw(img).rounded_rectangle(box, radius=r, outline=(*P.ROSE_EDGE, 200), width=3)
    return img.convert("RGB")


# ------------------------------------------------------------ outer, portrait
def outer(shot, idx, loc):
    P.W, P.H = 1320, round(1320 * OUTER[1] / OUTER[0])     # corridor/text_block read these
    W, H = P.W, P.H
    lines, sub = P.COPY[loc][idx]
    img = P.corridor(seed=(idx + 1) * 5 + 2)
    bottom = P.text_block(img, loc, lines, P.ACCENT[idx], sub, 120)

    P._WM = None
    wm = P.wordmark()
    wm_top = H - 56 - wm.height
    sh = round(W * shot.height / shot.width)
    sy = bottom + max(50, (wm_top - bottom - sh) // 2)
    P.shadow(img, [0, sy, W, sy + sh], 0, blur=30, alpha=220, dy=14)
    img.alpha_composite(shot.resize((W, sh), Image.LANCZOS).convert("RGBA"), (0, sy))
    d = ImageDraw.Draw(img, "RGBA")
    d.line([(0, sy), (W, sy)], fill=(*P.ROSE_EDGE, 220), width=3)
    d.line([(0, sy + sh), (W, sy + sh)], fill=(*P.ROSE_EDGE, 220), width=3)
    img.alpha_composite(wm, ((W - wm.width) // 2, wm_top))
    return img.convert("RGB").resize(OUTER, Image.LANCZOS)


def main():
    locales = sys.argv[1].split(",") if len(sys.argv) > 1 else list(P.COPY)
    ins, outs = load("duo-inner", INNER), load("duo-outer", OUTER[::-1])   # raw outer is landscape
    for loc in locales:
        di = os.path.join(SRC, loc, "duo-inner-landscape")
        do = os.path.join(SRC, loc, "duo-outer-portrait")
        os.makedirs(di, exist_ok=True)
        os.makedirs(do, exist_ok=True)
        for i in range(len(ins)):
            inner(ins[i], i, loc).save(os.path.join(di, "%02d.png" % (i + 1)), optimize=True)
            outer(outs[i], i, loc).save(os.path.join(do, "%02d.png" % (i + 1)), optimize=True)
        print("wrote", loc)


if __name__ == "__main__":
    main()
