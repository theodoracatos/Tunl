"""
Generates challenge-beat-my-score.jpg - the App Store Connect Game Center
challenge image for "Beat My Score" (challenge id tunl_challenge_alltime).

Same visual language as the generated Game Center leaderboard / achievement
icons (the laurel-medal / trophy / glyph set): dark navy field, faint radial
glow, a bold glowing shape with a coloured outer glow and a soft white core -
here extended to the challenge slot's 3840x2160 landscape.

Motif, no text: a platinum chevron climbing from below the dashed gold
"record line" (the in-game personal-best marker) toward a gold chevron sitting
on the line - the score to beat - with a coin-style spark at its apex. Gold is
the daily-leaderboard trophy hue, platinum the all-time-medal hue.

Output spec matches ASC's challenge image: exactly 3840x2160, JPEG, sRGB, no
alpha (PIL writes no ICC profile, so it is read as sRGB - a tagged BT.709
profile is what makes ASC reject video-derived PNGs, see the console-automation
notes in the release memories).

Run: python3 branding/game-center/gen-challenge-image.py   (needs numpy + Pillow)
"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SS = 2                                  # supersample, downscaled at the end
W, H = 3840 * SS, 2160 * SS
OUT = os.path.dirname(os.path.abspath(__file__))

GOLD      = (255, 196, 54)
GOLD_DEEP = (255, 140, 40)
PLATINUM  = (208, 225, 255)
CYAN      = (120, 210, 255)


def radial_bg():
    """Navy field, feature-graphic palette (#161c48 -> #080b22 -> #03040c), off-centre."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = W * 0.42, H * 0.44
    d = np.clip(np.sqrt(((xx - cx) / (W * 0.98)) ** 2 + ((yy - cy) / (H * 0.98)) ** 2), 0, 1)
    c0, c1, c2 = (np.array(c, np.float32) for c in ((22, 30, 72), (8, 11, 34), (3, 4, 12)))
    t1 = np.clip(d / 0.5, 0, 1)[..., None]
    t2 = np.clip((d - 0.5) / 0.5, 0, 1)[..., None]
    col = (c0 * (1 - t1) + c1 * t1) * (1 - t2) + c2 * t2
    return Image.fromarray(col.astype(np.uint8), "RGB")


def add_glow(base, mask_L, color, blur, strength):
    """Screen a blurred coloured copy of mask_L onto base."""
    ga = np.asarray(mask_L.filter(ImageFilter.GaussianBlur(blur)), np.float32) / 255.0 * strength
    b = np.asarray(base, np.float32)
    out = b + (255.0 - b) * ga[..., None] * (np.array(color, np.float32) / 255.0)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def paint(base, mask_L, color, white_core=0.18):
    """Lay a solid coloured shape over base, with a soft white core highlight."""
    m = np.asarray(mask_L, np.float32) / 255.0
    b = np.asarray(base, np.float32)
    out = b * (1 - m[..., None]) + np.array(color, np.float32) * m[..., None]
    if white_core:
        core = np.asarray(mask_L.filter(ImageFilter.GaussianBlur(4 * SS)), np.float32) / 255.0
        core = (core ** 1.7) * white_core
        out = out * (1 - core[..., None]) + 255.0 * core[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def layer(draw_fn):
    m = Image.new("L", (W, H), 0)
    draw_fn(ImageDraw.Draw(m))
    return m


def chevron(d, cx, cy, w, h, thick, double=True):
    """Upward chevron(s) centred at (cx, cy) - reads as 'climb / advance / rank up'."""
    def one(oy, t):
        pts = [(cx - w / 2, cy + h / 2 + oy), (cx, cy - h / 2 + oy), (cx + w / 2, cy + h / 2 + oy)]
        d.line(pts, fill=255, width=int(t), joint="curve")
        for px, py in pts:                       # round the corners/tips
            d.ellipse([px - t / 2, py - t / 2, px + t / 2, py + t / 2], fill=255)
    one(0, thick)
    if double:
        one(h * 0.62, thick * 0.82)


def corridor_waves(d):
    """The cave's own top/bottom wave lines, faint - the only nod to the game world."""
    for base_y, amp, freq, ph in [(H * 0.14, H * 0.045, 2.0, 0.4),
                                  (H * 0.87, H * 0.05, 1.7, 1.3)]:
        pts = []
        for i in range(0, W + 1, 6 * SS):
            x = i / W
            y = (base_y + math.sin(x * math.pi * 2 * freq + ph) * amp
                        + math.sin(x * math.pi * 2 * freq * 2.4 + 1.1) * amp * 0.32)
            pts.append((i, y))
        d.line(pts, fill=140, width=3 * SS, joint="curve")


def record_line(d, y):
    """Dashed horizontal line - the in-game personal-best marker."""
    dash, gap, w = 52 * SS, 34 * SS, 10 * SS
    x = int(W * 0.04)
    while x < W * 0.96:
        d.line([(x, y), (min(x + dash, int(W * 0.96)), y)], fill=255, width=int(w))
        x += dash + gap


def sparkle(d, cx, cy, R):
    """In-game coin burst: 4 long cardinal rays + 4 short diagonals, rounded, hollow centre."""
    for k in range(8):
        ang = math.radians(k * 45)
        long = R if k % 2 == 0 else R * 0.46
        inr = R * (0.30 if k % 2 == 0 else 0.24)
        wdt = (9 if k % 2 == 0 else 5) * SS
        x0, y0 = cx + math.cos(ang) * inr, cy + math.sin(ang) * inr
        x1, y1 = cx + math.cos(ang) * long, cy + math.sin(ang) * long
        d.line([(x0, y0), (x1, y1)], fill=255, width=int(wdt))
        d.ellipse([x1 - wdt / 2, y1 - wdt / 2, x1 + wdt / 2, y1 + wdt / 2], fill=255)
    d.ellipse([cx - R * 0.12, cy - R * 0.12, cx + R * 0.12, cy + R * 0.12], fill=255)


# ---------------------------------------------------------------------- compose
img = radial_bg()

cw = layer(corridor_waves)
img = add_glow(img, cw, (110, 150, 255), blur=10 * SS, strength=0.30)
img = paint(img, cw.point(lambda p: int(p * 0.30)), (150, 180, 255), white_core=0)

line_y = int(H * 0.47)
chase_c = (int(W * 0.50), int(H * 0.615))
lead_c = (int(W * 0.50), int(H * 0.285))
chev_w, chev_h = int(W * 0.205), int(H * 0.16)

rl = layer(lambda d: record_line(d, line_y))
img = add_glow(img, rl, GOLD, blur=20 * SS, strength=0.5)
img = paint(img, rl, (255, 224, 150), white_core=0.10)

# chaser chevron ("you", still below the line, climbing)
cm = layer(lambda d: chevron(d, *chase_c, chev_w, chev_h, 46 * SS))
img = add_glow(img, cm, PLATINUM, blur=46 * SS, strength=0.85)
img = add_glow(img, cm, CYAN, blur=100 * SS, strength=0.3)
img = paint(img, cm, PLATINUM, white_core=0.16)

# lead chevron ("the score to beat", sitting on the line)
lm = layer(lambda d: chevron(d, *lead_c, int(chev_w * 0.9), int(chev_h * 0.9), 42 * SS))
img = add_glow(img, lm, GOLD, blur=50 * SS, strength=0.95)
img = add_glow(img, lm, GOLD_DEEP, blur=120 * SS, strength=0.42)
img = paint(img, lm, GOLD, white_core=0.18)

# coin spark at the lead chevron's apex
sp = layer(lambda d: sparkle(d, lead_c[0], lead_c[1] - chev_h * 0.5, int(W * 0.045)))
img = add_glow(img, sp, (255, 236, 195), blur=13 * SS, strength=0.75)
img = paint(img, sp, (255, 247, 224), white_core=0.32)

# vignette to pull the eye to the centre
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
vg = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
vg = np.clip((vg - 0.62) / 0.6, 0, 1) * 0.55
img = Image.fromarray(
    np.clip(np.asarray(img, np.float32) * (1 - vg[..., None]), 0, 255).astype(np.uint8), "RGB")

img = img.resize((3840, 2160), Image.LANCZOS)
dst = os.path.join(OUT, "challenge-beat-my-score.jpg")
img.save(dst, quality=93, subsampling=0)
print("wrote", dst)
