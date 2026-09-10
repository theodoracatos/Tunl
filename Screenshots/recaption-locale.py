#!/usr/bin/env python3
"""Recaption an existing locale's portrait screenshots into a new locale by
translating only the headline + subhead text, reusing the same underlying
card (gameplay capture), corridor art, ship, and wordmark pixel-for-pixel.

For a locale that doesn't get its own dedicated simulator capture session
(see the README's "Regenerating a portrait set" section for a real capture,
which is the higher-fidelity option when it's worth the effort), this is the
fast path: it only requires the target locale's caption translations, not a
new recording. The in-game UI text baked into the card itself stays in the
source locale's language -- acceptable for a secondary/long-tail locale, not
a substitute for a real capture on a locale that deserves one.

Usage: fill in SRC (5 source PNGs named 01.png..05.png, e.g. downloaded at
full resolution from an existing App Store Connect locale via the iris/v1
appScreenshotSets API), OUT, and CAPTIONS below, then run. Geometry
(HEADLINE_Y/SUBHEAD_Y/etc.) is tuned for the 1320x2868 (6.7") frame that
make-portrait-frames.py produces -- re-measure per make-portrait-frames.py's
build() layout (or by scanning for INK/CYAN/DIM pixel rows the way this file
was written) if the source screenshots come from a different template.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import random, os

SRC = os.path.expanduser("~/Desktop/recaption-src")     # 01.png..05.png in, full-res EN
OUT = "Screenshots/iOS_10.2/pl/portrait"                 # edit per release/locale

FONT_BOLD = "/System/Library/Fonts/Supplemental/Courier New Bold.ttf"
INK = (234, 240, 255)
CYAN = (63, 224, 255)
DIM = (150, 167, 200)
W = 1320

HEADLINE_Y = (100, 620)    # zone to erase + redraw headline into (text measured at y<=560)
SUBHEAD_Y  = (1410, 1520)  # zone to erase + redraw subhead into (text measured at y=1466-1498)
ZONE_X = (40, 1280)        # erase width (covers any headline/subhead text position)
SAMPLE_X = (450, 870)      # narrower strip to sample bg color from -- wall_x() in
                            # make-portrait-frames.py never reaches this far in
                            # (base 150, pinch+wob <= 100), so this stays pure
                            # void/starfield, no rock-texture bias
SAMPLE_BAND = 14           # thickness of the clean reference bands at each zone edge
FEATHER = 28               # px of blend ramp at each zone edge, avoids a seam

CAPTIONS = {
    # "01.png": (["line1", "line2", "line3"], accent_line_index, "subhead text"),
}


def font(px):
    return ImageFont.truetype(FONT_BOLD, px)


def clean_zone(arr, y0, y1, x0, x1, seed):
    """Erase by interpolating between two clean reference bands taken from
    just outside the zone's actual text extent (HEADLINE_Y/SUBHEAD_Y already
    carry a margin past the measured text) rather than a per-row median -- a
    per-row median computed *inside* the zone gets pulled toward the text
    color at cap-height/baseline rows, where every monospace glyph's stroke
    aligns and can cover >50% of even a narrow sample strip, producing
    visible horizontal ghost lines. Sampling truly text-free bands avoids
    that failure mode entirely."""
    rnd = random.Random(seed)
    orig = arr[y0:y1, x0:x1].copy().astype(np.float32)
    sx0, sx1 = SAMPLE_X
    top_band = arr[y0:y0 + SAMPLE_BAND, sx0:sx1].reshape(-1, 3)
    bot_band = arr[y1 - SAMPLE_BAND:y1, sx0:sx1].reshape(-1, 3)
    top_col = np.median(top_band, axis=0)
    bot_col = np.median(bot_band, axis=0)
    h = y1 - y0
    lerp_t = np.linspace(0, 1, h)[:, None]
    filled_row = top_col[None, :] * (1 - lerp_t) + bot_col[None, :] * lerp_t
    filled = np.broadcast_to(filled_row[:, None, :], orig.shape).astype(np.float32)
    t = np.ones(h, dtype=np.float32)
    ramp = np.linspace(0, 1, FEATHER)
    t[:FEATHER] = ramp
    t[-FEATHER:] = ramp[::-1]
    t = t[:, None, None]
    blended = orig * (1 - t) + filled * t
    arr[y0:y1, x0:x1] = blended.astype(np.uint8)
    # sparse stars, kept away from the feather bands so they don't get cut off
    n_stars = int((y1 - y0) * (x1 - x0) / 9000)
    for _ in range(n_stars):
        y = rnd.randint(y0 + FEATHER, y1 - FEATHER - 1)
        x = rnd.randint(x0, x1 - 1)
        s = rnd.choice([1, 1, 1, 2])
        col = (205, 218, 255)
        for dy in range(s):
            for dx in range(s):
                if y + dy < arr.shape[0] and x + dx < arr.shape[1]:
                    arr[y + dy, x + dx] = col


def center_text(d, cx, y, text, fnt, fill):
    bb = d.textbbox((0, 0), text, font=fnt)
    d.text((cx - (bb[2] - bb[0]) / 2 - bb[0], y), text, font=fnt, fill=fill)
    return bb[3] - bb[1]


def draw_headline(img, lines, accent_idx):
    d = ImageDraw.Draw(img)
    size = 100
    while size > 50:
        hf = font(size)
        widest = max(d.textlength(l, font=hf) for l in lines)
        if widest <= 1090:
            break
        size -= 3
    lh = int(size * 1.22)
    y = 210
    for i, line in enumerate(lines):
        col = CYAN if i == accent_idx else INK
        center_text(d, W / 2, y, line, hf, col)
        y += lh


def draw_subhead(img, text):
    d = ImageDraw.Draw(img)
    ssize = 44
    while ssize > 24:
        sf = font(ssize)
        if d.textlength(text, font=sf) <= 1090:
            break
        ssize -= 2
    center_text(d, W / 2, SUBHEAD_Y[0] + 44, text, sf, DIM)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for fname, (lines, accent, subhead) in CAPTIONS.items():
        img = Image.open(os.path.join(SRC, fname)).convert("RGB")
        arr = np.array(img)
        clean_zone(arr, *HEADLINE_Y, *ZONE_X, seed=hash(fname) & 0xffff)
        clean_zone(arr, *SUBHEAD_Y, *ZONE_X, seed=(hash(fname) >> 8) & 0xffff)
        img = Image.fromarray(arr)
        draw_headline(img, lines, accent)
        draw_subhead(img, subhead)
        out_path = os.path.join(OUT, fname)
        img.save(out_path, "PNG")
        print("wrote", out_path)
