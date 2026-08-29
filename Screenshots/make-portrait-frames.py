#!/usr/bin/env python3
"""Build App Store portrait (1320x2868) screenshots from TUNL's landscape sim shots.

The game is landscape-only, so the raw simulator captures are 2868x1320. The App
Store renders everything portrait, so each landscape shot is dropped into a
portrait "cave corridor" frame: converging wavy rock walls (the game's own look),
a Courier-New headline up top, the shot as a rounded card in the corridor middle,
and the TUNL wordmark at the base.
"""

import math
import os
import random
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1320, 2868

FONT_BOLD = "/System/Library/Fonts/Supplemental/Courier New Bold.ttf"
REPO = "/Users/theodoracatos/Development/Tunl"
WORDMARK_SVG = os.path.join(REPO, "branding/wordmark.svg")

INK = (234, 240, 255)
DIM = (150, 167, 200)
CYAN = (63, 224, 255)
PURPLE = (167, 91, 255)
GOLD = (255, 205, 70)
ROCK_HI = (78, 74, 48)
ROCK_LO = (34, 32, 20)
VOID = (5, 5, 12)


def font(px):
    return ImageFont.truetype(FONT_BOLD, px)


def wordmark_png(width):
    out = "/tmp/tunl_wordmark_%d.png" % width
    subprocess.run(["rsvg-convert", "-w", str(width), WORDMARK_SVG, "-o", out],
                   check=True)
    return Image.open(out).convert("RGBA")


def wall_x(edge, y, seed):
    """Horizontal position of a corridor wall at height y.

    edge='L' or 'R'. The walls bow inward toward the vertical centre (the
    corridor narrows a touch mid-page, same 'it got tighter' read as the run
    card) and ride two offset sine waves so the rock line is never a clean arc.
    """
    t = y / H
    pinch = math.sin(t * math.pi) * 40            # inward bulge, 0 at top/bottom
    wob = (math.sin(y * 0.0042 + seed) * 40
           + math.sin(y * 0.0111 + seed * 2.0) * 20)
    base = 150 if edge == "L" else W - 150
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

    # Rock fill outside each wall, vertical gradient per scanline, with a
    # darker band hugging the wall edge so the rim light reads.
    for y in ys:
        col = _rock_shade(y, 1.0)
        edge_col = _rock_shade(y, 0.45)
        lx = wall_x("L", y, seed)
        rx = wall_x("R", y, seed)
        d.rectangle([0, y, lx - 26, y + step], fill=col)
        d.rectangle([lx - 26, y, lx, y + step], fill=edge_col)
        d.rectangle([rx, y, rx + 26, y + step], fill=edge_col)
        d.rectangle([rx + 26, y, W, y + step], fill=col)

    # Grain on the rock.
    for _ in range(2600):
        y = rnd.randint(0, H)
        lx, rx = wall_x("L", y, seed), wall_x("R", y, seed)
        if rnd.random() < 0.5:
            x = rnd.uniform(0, lx)
        else:
            x = rnd.uniform(rx, W)
        b = rnd.randint(-14, 16)
        base = _rock_shade(y, 1.0)
        d.point((x, y), fill=tuple(max(0, min(255, c + b)) for c in base))

    # Stalactite / stalagmite spikes rooted on the walls.
    for _ in range(11):
        y = rnd.randint(120, H - 120)
        edge = rnd.choice(["L", "R"])
        wx = wall_x(edge, y, seed)
        length = rnd.randint(80, 190)
        half = rnd.randint(30, 46)
        tip = wx + length if edge == "L" else wx - length
        d.polygon([(wx, y - half), (wx, y + half), (tip, y)],
                  fill=_rock_shade(y, 0.8), outline=(*CYAN, 150))

    # Cyan rim light along both wall lines (drawn after spikes so it caps them).
    for edge in ("L", "R"):
        pts = [(wall_x(edge, y, seed), y) for y in ys]
        d.line(pts, fill=(*CYAN, 90), width=10)
        d.line(pts, fill=(*CYAN, 220), width=4)

    # Stars inside the corridor void.
    for _ in range(300):
        y = rnd.randint(0, H)
        lx, rx = wall_x("L", y, seed), wall_x("R", y, seed)
        x = rnd.uniform(lx + 14, rx - 14)
        a = rnd.randint(40, 170)
        s = rnd.choice([1, 1, 1, 2, 2])
        d.ellipse([x, y, x + s, y + s], fill=(205, 218, 255, a))


def draw_ship(img, cx, cy, scale, seed):
    """The in-game needle-delta ship in a ~28-degree climb, with a thrust cone
    and a short trail of gold coin diamonds - straight from the icon language."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ang = math.radians(-28)
    ca, sa = math.cos(ang), math.sin(ang)

    def pt(px, py):
        return (cx + (px * ca - py * sa) * scale,
                cy + (px * sa + py * ca) * scale)

    # thrust cone
    d.polygon([pt(-42, -14), pt(-42, 14), pt(-120, 0)], fill=(120, 200, 255, 130))
    d.polygon([pt(-42, -8), pt(-42, 8), pt(-92, 0)], fill=(220, 245, 255, 190))
    # hull
    d.polygon([pt(60, 0), pt(-40, -26), pt(-30, 0), pt(-40, 26)],
              fill=(238, 244, 255, 255), outline=(150, 200, 255, 255))

    layer = layer.filter(ImageFilter.GaussianBlur(0.6))
    aura = layer.filter(ImageFilter.GaussianBlur(16))
    img.alpha_composite(aura)
    img.alpha_composite(layer)

    d2 = ImageDraw.Draw(img, "RGBA")
    rnd = random.Random(seed)
    for i in range(3):
        gx = cx - 140 * scale - i * 104 * scale + rnd.uniform(-18, 18)
        gy = cy + 78 * scale + i * 62 * scale + rnd.uniform(-14, 14)
        r = 17 * scale
        d2.polygon([(gx, gy - r), (gx + r * 0.7, gy), (gx, gy + r), (gx - r * 0.7, gy)],
                   fill=(*GOLD, 235), outline=(255, 240, 200, 255))


def vignette(img):
    # Darken the edges: start opaque black, punch a soft bright hole in the
    # middle, blur, and use that as the alpha of a black overlay.
    hole = Image.new("L", (W, H), 255)
    ImageDraw.Draw(hole).ellipse([-W * 0.35, H * 0.16, W * 1.35, H * 0.9], fill=60)
    hole = hole.filter(ImageFilter.GaussianBlur(220))
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    overlay.putalpha(hole)
    img.alpha_composite(overlay)


def rounded_card(shot, target_w, radius=26):
    ratio = shot.height / shot.width
    tw = target_w
    th = int(round(tw * ratio))
    s = shot.resize((tw, th), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (tw, th), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, tw - 1, th - 1], radius=radius, fill=255)
    s.putalpha(mask)

    pad = 60
    canvas = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    # drop shadow
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [pad, pad + 12, pad + tw, pad + th + 12], radius=radius, fill=(0, 0, 0, 170))
    sh = sh.filter(ImageFilter.GaussianBlur(26))
    canvas.alpha_composite(sh)
    # cyan glow
    gl = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(gl).rounded_rectangle(
        [pad - 3, pad - 3, pad + tw + 3, pad + th + 3], radius=radius + 3,
        outline=(*CYAN, 220), width=6)
    gl = gl.filter(ImageFilter.GaussianBlur(9))
    canvas.alpha_composite(gl)
    canvas.alpha_composite(s, (pad, pad))
    ImageDraw.Draw(canvas).rounded_rectangle(
        [pad, pad, pad + tw - 1, pad + th - 1], radius=radius,
        outline=(*INK, 230), width=2)
    return canvas


def center_text(d, cx, y, text, fnt, fill):
    bb = d.textbbox((0, 0), text, font=fnt)
    d.text((cx - (bb[2] - bb[0]) / 2 - bb[0], y), text, font=fnt, fill=fill)
    return bb[3] - bb[1]


def build(shot_path, out_path, headline_lines, accent_idx, subhead, seed):
    img = Image.new("RGBA", (W, H), (*VOID, 255))
    draw_corridor(img, seed)
    vignette(img)
    d = ImageDraw.Draw(img)

    # Headline (Courier New Bold, like the in-game title). Auto-shrink so the
    # widest line clears the corridor walls.
    size = 100
    while size > 60:
        hf = font(size)
        widest = max(d.textlength(l, font=hf) for l in headline_lines)
        if widest <= 1090:
            break
        size -= 3
    lh = int(size * 1.22)
    y = 210
    for i, line in enumerate(headline_lines):
        col = CYAN if i == accent_idx else INK
        center_text(d, W / 2, y, line, hf, col)
        y += lh
    head_bottom = y

    # Screenshot card, sitting in the corridor a touch above centre.
    card = rounded_card(Image.open(shot_path).convert("RGB"), 1236)
    cx = (W - card.width) // 2
    cy = int(head_bottom + 150)
    img.alpha_composite(card, (cx, cy))

    # Subhead under the card (auto-shrink to clear the walls).
    ssize = 44
    while ssize > 26:
        sf = font(ssize)
        if d.textlength(subhead, font=sf) <= 1090:
            break
        ssize -= 2
    center_text(d, W / 2, cy + card.height + 44, subhead, sf, DIM)

    # Ship climbing through the lower corridor to fill the run-out space.
    draw_ship(img, W * 0.62, H * 0.735, 1.9, seed)

    # Wordmark at the base.
    wm = wordmark_png(400)
    img.alpha_composite(wm, ((W - wm.width) // 2, H - wm.height - 96))
    tf = font(29)
    center_text(d, W / 2, H - 70, "flytunl.ch", tf, (120, 134, 162, 255))

    img.convert("RGB").save(out_path, "PNG")
    print("wrote", out_path)


EN = [
    ("23.15.03", (["One cave.", "Every player.", "Every day."], 1,
                  "One daily corridor for the whole world")),
    ("23.15.33", (["Hold to climb.", "Release to fall.", "Go deep."], 0,
                  "One button. That is the whole game")),
    ("23.16.09", (["Seven power-ups.", "One corridor", "that keeps shrinking."], 1,
                  "Shield, magnet, slow-time, bombs and more")),
    ("23.16.17", (["Die. Check your", "world rank.", "Go again."], 1,
                  "Live daily leaderboard the moment you crash")),
    ("23.16.28", (["Fifteen languages.", "No tutorial.", "Just fly."], 0,
                  "Pick up and play in seconds")),
]

BR = [
    ("23.17.42", (["Uma caverna.", "Todo jogador.", "Todo dia."], 1,
                  "Um corredor diario para o mundo inteiro")),
    ("23.17.58", (["Segure e suba.", "Solte e caia.", "Vai fundo."], 0,
                  "Um botao, e o jogo inteiro")),
    ("23.18.40", (["Sete power-ups.", "Um corredor", "que so encolhe."], 1,
                  "Escudo, ima, lentidao, bombas e mais")),
    ("23.18.49", (["Morra. Veja seu", "rank mundial.", "Jogue de novo."], 1,
                  "Ranking diario ao vivo quando voce morre")),
    ("23.18.44", (["Quinze idiomas.", "Sem tutorial.", "So voar."], 0,
                  "Pegue e jogue em segundos")),
]
# Swap in proper Brazilian accents at load (Courier New Bold has the glyphs).
_ACC = {"diario": "diário", "botao": "botão", "ima": "ímã", "lentidao": "lentidão",
        "So voar.": "Só voar.", "que so encolhe.": "que só encolhe.",
        "voce": "você"}
def _acc(s):
    for k, v in _ACC.items():
        s = s.replace(k, v)
    return s
BR = [(st, ([_acc(l) for l in ls], a, _acc(sub))) for st, (ls, a, sub) in BR]


def run(group, src_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    files = {}
    for n in os.listdir(src_dir):
        if n.lower().endswith(".png"):
            for stamp, _ in group:
                if stamp in n:
                    files[stamp] = os.path.join(src_dir, n)
    for idx, (stamp, (lines, accent, sub)) in enumerate(group, 1):
        if stamp not in files:
            print("!! missing", stamp, "in", src_dir)
            continue
        build(files[stamp], os.path.join(out_dir, "%02d_portrait.png" % idx),
              lines, accent, sub, seed=idx * 3 + 1)


if __name__ == "__main__":
    desktop = os.path.expanduser("~/Desktop")
    run(EN, os.path.join(desktop, "iOS_7.0"),
        os.path.join(REPO, "Screenshots/iOS_7.0/AppStore_portrait_en"))
    run(BR, os.path.join(desktop, "iOS_7.0_br"),
        os.path.join(REPO, "Screenshots/iOS_7.0/AppStore_portrait_pt-BR"))
