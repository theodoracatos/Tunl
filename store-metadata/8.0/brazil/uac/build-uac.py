#!/usr/bin/env python3
"""Build the Brazil UAC (Google App campaign) creative pack: validate the pt-BR text
assets against Google's limits, write headlines.txt / descriptions.txt, and render
the three image ratios from a real gameplay frame.

Run:  python3 store-metadata/8.0/brazil/uac/build-uac.py
"""

import os
import sys
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = "/Users/theodoracatos/Development/Tunl"
WORDMARK = os.path.join(REPO, "branding/wordmark.svg")
TMP = "/private/tmp/claude-501/-Users-theodoracatos-Development-Tunl/12ae3756-f887-49df-8ceb-4278c1d3a99c/scratchpad"
COURIER = "/System/Library/Fonts/Supplemental/Courier New Bold.ttf"

# Google App campaign: headline <= 30, description <= 90.
HEADLINES = [
    "Uma caverna nova todo dia",
    "Segura pra subir e solta",
    "Ranking mundial ao vivo",
    "Grátis e joga sem internet",
    "Só mais uma partida",
]
DESCRIPTIONS = [
    "Todo dia uma caverna nova, igual pro mundo. Segura pra subir. E o seu ranking hoje?",
    "Um toque, sem tutorial. Grátis, leve e roda sem internet. Corre atrás do seu recorde.",
    "Escudo, ímã, câmera lenta, bomba. Sete power-ups e oito naves pra desbloquear.",
    "Bateu recorde? Manda o cartão no grupo do zap e desafia a galera.",
    "A caverna some à meia-noite. Amanhã tem outra. Bora ver até onde você vai hoje?",
]
# clean gameplay frame (score 26, PB marker visible), from the Brazilian capture set
SHOT = os.path.join(REPO, "Screenshots/iOS_8.0/br",
                    "Simulator Screenshot - iPhone 17 Pro Max - 2026-08-30 at 20.39.12.png")
TOPLINE = "SEGURA PRA SUBIR"
CAPTION = "Uma caverna nova todo dia. A mesma pro mundo."

INK = (234, 240, 255)
VOID = (7, 8, 15)
ACCENT = (255, 205, 70)


def wordmark(width):
    out = os.path.join(TMP, "uac_wm_%d.png" % width)
    subprocess.run(["rsvg-convert", "-w", str(width), WORDMARK, "-o", out], check=True)
    return Image.open(out).convert("RGBA")


def _fit(d, text, px_start, max_w, floor=12):
    size = px_start
    while size > floor:
        f = ImageFont.truetype(COURIER, size)
        if d.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return ImageFont.truetype(COURIER, floor)


def _center(d, cx, y, text, f, fill):
    bb = d.textbbox((0, 0), text, font=f)
    d.text((cx - (bb[2] - bb[0]) / 2 - bb[0], y), text, font=f, fill=fill)
    return bb[3] - bb[1]


def frame(w, h, out):
    img = Image.new("RGBA", (w, h), (*VOID, 255))
    gl = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(gl).ellipse([w * 0.05, h * 0.12, w * 0.95, h * 1.05], fill=(*ACCENT, 30))
    img.alpha_composite(gl.filter(ImageFilter.GaussianBlur(150)))
    d = ImageDraw.Draw(img)

    # wordmark top-centre
    wm = wordmark(int(min(w, h) * 0.30))
    img.alpha_composite(wm, ((w - wm.width) // 2, int(h * 0.045)))
    top_y = int(h * 0.045) + wm.height + int(h * 0.02)

    # top headline
    tf = _fit(d, TOPLINE, int(h * 0.075), w - 80)
    th = _center(d, w / 2, top_y, TOPLINE, tf, ACCENT)
    head_bottom = top_y + th + int(h * 0.03)

    band_h = int(h * 0.13)
    by = h - band_h

    # gameplay shot as a rounded card, centred in the space between headline and band
    shot = Image.open(SHOT).convert("RGB")
    sw = w - int(w * 0.08)
    sh = int(sw * shot.height / shot.width)
    zone = by - head_bottom - int(h * 0.03)
    if sh > zone:
        sh = zone
        sw = int(sh * shot.width / shot.height)
    s = shot.resize((sw, sh), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw - 1, sh - 1], radius=18, fill=255)
    s.putalpha(mask)
    sx = (w - sw) // 2
    sy = head_bottom + (zone - sh) // 2
    img.alpha_composite(s, (sx, sy))
    d.rounded_rectangle([sx, sy, sx + sw - 1, sy + sh - 1], radius=18, outline=(*INK, 220), width=2)

    # caption band
    d.rectangle([0, by, w, h], fill=(6, 6, 14))
    d.rectangle([0, by, w, by + 4], fill=ACCENT)
    cf = _fit(d, CAPTION, int(band_h * 0.34), w - 60)
    cb = d.textbbox((0, 0), CAPTION, font=cf)
    _center(d, w / 2, by + (band_h - (cb[3] - cb[1])) / 2 - cb[1], CAPTION, cf, INK)

    img.convert("RGB").save(out)
    print("wrote", out)


def main():
    bad = []
    for i, s in enumerate(HEADLINES, 1):
        if len(s) > 30:
            bad.append(f"headline {i}: {len(s)}/30")
    for i, s in enumerate(DESCRIPTIONS, 1):
        if len(s) > 90:
            bad.append(f"description {i}: {len(s)}/90")
    with open(os.path.join(HERE, "headlines.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(HEADLINES) + "\n")
    with open(os.path.join(HERE, "descriptions.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(DESCRIPTIONS) + "\n")
    print("headlines:", [len(s) for s in HEADLINES])
    print("descriptions:", [len(s) for s in DESCRIPTIONS])

    frame(1200, 628, os.path.join(HERE, "img-landscape-1200x628.png"))
    frame(1200, 1200, os.path.join(HERE, "img-square-1200x1200.png"))
    frame(960, 1200, os.path.join(HERE, "img-portrait-960x1200.png"))

    if bad:
        print("\nOVER LIMIT:")
        for b in bad:
            print("  " + b)
        sys.exit(1)
    print("all text within limits")


if __name__ == "__main__":
    main()
