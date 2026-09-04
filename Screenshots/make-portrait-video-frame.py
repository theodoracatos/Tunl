#!/usr/bin/env python3
"""Build a 9:16 short-form video frame for TUNL 8.x - the video counterpart to
make-portrait-frames-8.0.py's screenshot pipeline. Same cave-corridor portrait
frame (corridor render, headline, climbing ship, wordmark) as the App Store
portrait screenshots, but sized for TikTok/Reels/Shorts (1080x2340) instead of
an App Store device frame, and with a transparent rounded "hole" where the
landscape gameplay clip shows through instead of a static screenshot.

This script only renders the still frame overlay (frame.png, RGBA - opaque
corridor art everywhere, alpha=0 inside the rounded hole). Compositing the
actual video into that hole is a separate ffmpeg pass - see the printed
command at the end, or Screenshots/build-portrait-video.sh.

Run:  python3 Screenshots/make-portrait-video-frame.py
"""

import math
import os
import random
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 2340   # 9:16 (2340 = 1080 * 16/9), native TikTok/Reels/Shorts canvas
REPO = "/Users/theodoracatos/Development/Tunl"
WORDMARK_SVG = os.path.join(REPO, "branding/wordmark.svg")
OUT_DIR = os.path.join(REPO, "Screenshots/iOS_8.0/en")
TMP = os.environ.get("TUNL_TMP", "/tmp")
os.makedirs(TMP, exist_ok=True)

COURIER = "/System/Library/Fonts/Supplemental/Courier New Bold.ttf"

INK = (234, 240, 255)
DIM = (150, 167, 200)
CYAN = (63, 224, 255)
GOLD = (255, 205, 70)
ROCK_HI = (78, 74, 48)
ROCK_LO = (34, 32, 20)
VOID = (5, 5, 12)

_FONT_CACHE = {}


def font(px):
    key = px
    if key not in _FONT_CACHE:
        _FONT_CACHE[key] = ImageFont.truetype(COURIER, px)
    return _FONT_CACHE[key]


def wordmark_png(width):
    out = os.path.join(TMP, "tunl_wordmark_%d.png" % width)
    subprocess.run(["rsvg-convert", "-w", str(width), WORDMARK_SVG, "-o", out], check=True)
    return Image.open(out).convert("RGBA")


def wall_x(edge, y, seed):
    t = y / H
    pinch = math.sin(t * math.pi) * 34
    wob = (math.sin(y * 0.0042 + seed) * 34 + math.sin(y * 0.0111 + seed * 2.0) * 17)
    base = 120 if edge == "L" else W - 120
    return base + pinch + wob if edge == "L" else base - pinch + wob


def _rock_shade(y, k):
    f = y / H
    m = 0.55 + 0.60 * math.sin(f * math.pi)
    return tuple(min(255, int(ROCK_LO[i] + (ROCK_HI[i] - ROCK_LO[i]) * m * k)) for i in range(3))


def draw_corridor(img, seed):
    d = ImageDraw.Draw(img, "RGBA")
    step = 4
    ys = list(range(-step, H + step, step))
    rnd = random.Random(seed * 7 + 3)
    for y in ys:
        col = _rock_shade(y, 1.0)
        edge_col = _rock_shade(y, 0.45)
        lx = wall_x("L", y, seed)
        rx = wall_x("R", y, seed)
        d.rectangle([0, y, lx - 22, y + step], fill=col)
        d.rectangle([lx - 22, y, lx, y + step], fill=edge_col)
        d.rectangle([rx, y, rx + 22, y + step], fill=edge_col)
        d.rectangle([rx + 22, y, W, y + step], fill=col)
    for _ in range(2200):
        y = rnd.randint(0, H)
        lx, rx = wall_x("L", y, seed), wall_x("R", y, seed)
        x = rnd.uniform(0, lx) if rnd.random() < 0.5 else rnd.uniform(rx, W)
        b = rnd.randint(-14, 16)
        base = _rock_shade(y, 1.0)
        d.point((x, y), fill=tuple(max(0, min(255, c + b)) for c in base))
    for _ in range(9):
        y = rnd.randint(120, H - 120)
        edge = rnd.choice(["L", "R"])
        wx = wall_x(edge, y, seed)
        length = rnd.randint(70, 160)
        half = rnd.randint(26, 40)
        tip = wx + length if edge == "L" else wx - length
        d.polygon([(wx, y - half), (wx, y + half), (tip, y)],
                  fill=_rock_shade(y, 0.8), outline=(*CYAN, 150))
    for edge in ("L", "R"):
        pts = [(wall_x(edge, y, seed), y) for y in ys]
        d.line(pts, fill=(*CYAN, 90), width=9)
        d.line(pts, fill=(*CYAN, 220), width=4)
    for _ in range(260):
        y = rnd.randint(0, H)
        lx, rx = wall_x("L", y, seed), wall_x("R", y, seed)
        x = rnd.uniform(lx + 12, rx - 12)
        a = rnd.randint(40, 170)
        s = rnd.choice([1, 1, 1, 2, 2])
        d.ellipse([x, y, x + s, y + s], fill=(205, 218, 255, a))


def draw_ship(img, cx, cy, scale, seed):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ang = math.radians(-28)
    ca, sa = math.cos(ang), math.sin(ang)

    def pt(px, py):
        return (cx + (px * ca - py * sa) * scale, cy + (px * sa + py * ca) * scale)

    d.polygon([pt(-42, -14), pt(-42, 14), pt(-120, 0)], fill=(120, 200, 255, 130))
    d.polygon([pt(-42, -8), pt(-42, 8), pt(-92, 0)], fill=(220, 245, 255, 190))
    d.polygon([pt(60, 0), pt(-40, -26), pt(-30, 0), pt(-40, 26)],
              fill=(238, 244, 255, 255), outline=(150, 200, 255, 255))
    layer = layer.filter(ImageFilter.GaussianBlur(0.6))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(16)))
    img.alpha_composite(layer)
    d2 = ImageDraw.Draw(img, "RGBA")
    rnd = random.Random(seed)
    for i in range(3):
        gx = cx - 120 * scale - i * 90 * scale + rnd.uniform(-16, 16)
        gy = cy + 66 * scale + i * 54 * scale + rnd.uniform(-12, 12)
        r = 15 * scale
        d2.polygon([(gx, gy - r), (gx + r * 0.7, gy), (gx, gy + r), (gx - r * 0.7, gy)],
                   fill=(*GOLD, 235), outline=(255, 240, 200, 255))


def vignette(img):
    hole = Image.new("L", (W, H), 255)
    ImageDraw.Draw(hole).ellipse([-W * 0.35, H * 0.16, W * 1.35, H * 0.9], fill=60)
    hole = hole.filter(ImageFilter.GaussianBlur(200))
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    overlay.putalpha(hole)
    img.alpha_composite(overlay)


def center_text(d, cx, y, text, fnt, fill):
    bb = d.textbbox((0, 0), text, font=fnt)
    d.text((cx - (bb[2] - bb[0]) / 2 - bb[0], y), text, fill=fill, font=fnt)
    return bb[3] - bb[1]


# ---------------------------------------------------------------- the frame
# Source clip: Screenshots/iOS_8.0/en/app-preview-6.9.mp4, 2796x1290. Cropped
# (not squeezed) before it reaches the card - dropping the full 2.17:1 landscape
# frame into a 9:16 card leaves the card barely 20% of the canvas tall, and
# everything below it (the static corridor art) reads as dead air for a full
# 20s clip. Cropping tighter around the player's fixed screen position (PX =
# W*0.22 in the real game, src/constants.js) keeps the ship and the oncoming
# obstacles in frame while dropping the far-right runway the portrait canvas
# has no room for anyway - and the taller resulting aspect lets the card fill
# roughly half the frame instead of a fifth of it. See CROP_* below; keep in
# sync with build-portrait-video.sh's ffmpeg crop filter.
CROP_W, CROP_H, CROP_X, CROP_Y = 1300, 1290, 460, 0   # out of the source's 2796x1290
# (a first pass at 1075 wide cut the score/BEST readout at the top-center of
# the HUD; 1300 wide, shifted right, keeps both the ship and the full HUD
# text in frame - see the hud-crop check this was tuned against.)
SRC_RATIO = CROP_H / CROP_W
CARD_PAD = 34
CARD_RADIUS = 30


def build():
    img = Image.new("RGBA", (W, H), (*VOID, 255))
    draw_corridor(img, seed=5)
    vignette(img)
    d = ImageDraw.Draw(img)

    # Headline - reuses the same voice as CAPS["en"][1] in the screenshot
    # pipeline (the gameplay-frame caption), trimmed to 2 lines for the
    # flatter 9:16 canvas.
    lines = ["Hold to climb.", "Release to fall."]
    accent_idx = 0
    size = 92
    while size > 50:
        hf = font(size)
        widest = max(d.textlength(l, font=hf) for l in lines)
        if widest <= W - 100:
            break
        size -= 3
    hf = font(size)
    lh = int(size * 1.22)
    y = 96
    for i, line in enumerate(lines):
        col = CYAN if i == accent_idx else INK
        center_text(d, W / 2, y, line, hf, col)
        y += lh
    head_bottom = y + 14

    # Card chrome (shadow + cyan glow border + inner stroke) around the hole
    # the gameplay clip will show through - no image content drawn here,
    # ffmpeg fills the hole at composite time (see build-portrait-video.sh).
    card_w = int(W * 0.90)
    card_h = int(card_w * SRC_RATIO)
    cx = (W - card_w) // 2
    cy = head_bottom + 46

    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [cx, cy + 14, cx + card_w, cy + card_h + 14], radius=CARD_RADIUS, fill=(0, 0, 0, 180))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(28)))

    gl = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(gl).rounded_rectangle(
        [cx - 4, cy - 4, cx + card_w + 4, cy + card_h + 4], radius=CARD_RADIUS + 4,
        outline=(*CYAN, 220), width=7)
    img.alpha_composite(gl.filter(ImageFilter.GaussianBlur(10)))

    # Punch the transparent hole (RGBA alpha=0) - this is what lets the
    # composited video show through once ffmpeg lays this frame over it.
    hole_mask = Image.new("L", img.size, 255)
    ImageDraw.Draw(hole_mask).rounded_rectangle(
        [cx, cy, cx + card_w, cy + card_h], radius=CARD_RADIUS, fill=0)
    r, g, b, a = img.split()
    a = Image.composite(a, Image.new("L", img.size, 0), hole_mask)
    img = Image.merge("RGBA", (r, g, b, a))
    d = ImageDraw.Draw(img)  # re-bind after merge

    ImageDraw.Draw(img).rounded_rectangle(
        [cx, cy, cx + card_w, cy + card_h], radius=CARD_RADIUS, outline=(*INK, 230), width=2)

    # Subhead under the card.
    sub = "One button. That is the whole game."
    ssize = 46
    while ssize > 26:
        sf = font(ssize)
        if d.textlength(sub, font=sf) <= W - 120:
            break
        ssize -= 2
    center_text(d, W / 2, cy + card_h + 40, sub, font(ssize), DIM)

    # Ship + wordmark + URL in the lower third, same proportions as the
    # screenshot pipeline (ship at ~62%W/73%H, wordmark just above the base).
    draw_ship(img, W * 0.62, H * 0.85, 1.7, seed=5)
    wm = wordmark_png(320)
    img.alpha_composite(wm, ((W - wm.width) // 2, H - wm.height - 90))
    center_text(d, W / 2, H - 58, "flytunl.ch", font(26), (120, 134, 162, 255))

    out_path = os.path.join(OUT_DIR, "portrait-video-frame.png")
    img.save(out_path, "PNG")
    print("wrote", out_path)
    print("hole rect (px, for ffmpeg): x=%d y=%d w=%d h=%d" % (cx, cy, card_w, card_h))
    return cx, cy, card_w, card_h


if __name__ == "__main__":
    build()
