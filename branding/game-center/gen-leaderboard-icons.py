"""
Generates the two Game Center / Play Games leaderboard icons:

  leaderboard-daily.png    - "TUNL Highscore"     (tunl_highscore, daily reset)
  leaderboard-alltime.png  - "Ewige Bestenliste"  (tunl_highscore_alltime_v2)

Same visual language as gen-challenge-image.py and the achievement-icon set:
dark navy field, faint radial glow, the cave's own top/bottom wave lines as the
only nod to the game world, then a bold glowing motif with a coloured outer glow
and a soft white core.

Colour split matches the challenge image's own doc:
  gold      = the daily-leaderboard trophy hue
  platinum  = the all-time-medal hue

Motifs (no text):
  daily    - a gold trophy cup on the dashed gold "record line", coin spark at
             the rim - the day's best.
  alltime  - a platinum laurel wreath around an upward chevron with a star at its
             apex - a standing, permanent honour (a wreath, not a daily cup).

Output spec matches ASC's leaderboard image slot: 1024x1024, PNG, sRGB, no alpha
(PIL writes no ICC profile, so it reads as sRGB). Play Games accepts the same
file. Run: python3 branding/game-center/gen-leaderboard-icons.py   (numpy + Pillow)
"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SS = 2                                  # supersample, downscaled at the end
S = 1024 * SS
OUT = os.path.dirname(os.path.abspath(__file__))

GOLD      = (255, 196, 54)
GOLD_DEEP = (255, 140, 40)
GOLD_PALE = (255, 224, 150)
PLATINUM  = (208, 225, 255)
PLAT_PALE = (232, 240, 255)
CYAN      = (120, 210, 255)
LEAF      = (150, 210, 190)


def radial_bg():
    """Navy field, feature-graphic palette (#161c48 -> #080b22 -> #03040c), slightly high."""
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    cx, cy = S * 0.5, S * 0.44
    d = np.clip(np.sqrt(((xx - cx) / (S * 0.95)) ** 2 + ((yy - cy) / (S * 0.95)) ** 2), 0, 1)
    c0, c1, c2 = (np.array(c, np.float32) for c in ((22, 30, 72), (8, 11, 34), (3, 4, 12)))
    t1 = np.clip(d / 0.5, 0, 1)[..., None]
    t2 = np.clip((d - 0.5) / 0.5, 0, 1)[..., None]
    col = (c0 * (1 - t1) + c1 * t1) * (1 - t2) + c2 * t2
    return Image.fromarray(col.astype(np.uint8), "RGB")


def add_glow(base, mask_L, color, blur, strength):
    ga = np.asarray(mask_L.filter(ImageFilter.GaussianBlur(blur)), np.float32) / 255.0 * strength
    b = np.asarray(base, np.float32)
    out = b + (255.0 - b) * ga[..., None] * (np.array(color, np.float32) / 255.0)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def paint(base, mask_L, color, white_core=0.18):
    m = np.asarray(mask_L, np.float32) / 255.0
    b = np.asarray(base, np.float32)
    out = b * (1 - m[..., None]) + np.array(color, np.float32) * m[..., None]
    if white_core:
        core = np.asarray(mask_L.filter(ImageFilter.GaussianBlur(4 * SS)), np.float32) / 255.0
        core = (core ** 1.7) * white_core
        out = out * (1 - core[..., None]) + 255.0 * core[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def layer(draw_fn):
    m = Image.new("L", (S, S), 0)
    draw_fn(ImageDraw.Draw(m))
    return m


def corridor_waves(d):
    """The cave's own top/bottom wave lines, faint - the only nod to the game world."""
    for base_y, amp, freq, ph in [(S * 0.10, S * 0.040, 2.0, 0.4),
                                  (S * 0.905, S * 0.045, 1.7, 1.3)]:
        pts = []
        for i in range(0, S + 1, 6 * SS):
            x = i / S
            y = (base_y + math.sin(x * math.pi * 2 * freq + ph) * amp
                        + math.sin(x * math.pi * 2 * freq * 2.4 + 1.1) * amp * 0.32)
            pts.append((i, y))
        d.line(pts, fill=140, width=3 * SS, joint="curve")


def record_line(d, y, x0=0.10, x1=0.90, w=9):
    dash, gap = 46 * SS, 30 * SS
    x = int(S * x0)
    while x < S * x1:
        d.line([(x, y), (min(x + dash, int(S * x1)), y)], fill=255, width=int(w * SS))
        x += dash + gap


def sparkle(d, cx, cy, R):
    """In-game coin burst: 4 long cardinal rays + 4 short diagonals, rounded, hollow centre."""
    for k in range(8):
        ang = math.radians(k * 45)
        long = R if k % 2 == 0 else R * 0.46
        inr = R * (0.30 if k % 2 == 0 else 0.24)
        wdt = (10 if k % 2 == 0 else 6) * SS
        x0, y0 = cx + math.cos(ang) * inr, cy + math.sin(ang) * inr
        x1, y1 = cx + math.cos(ang) * long, cy + math.sin(ang) * long
        d.line([(x0, y0), (x1, y1)], fill=255, width=int(wdt))
        d.ellipse([x1 - wdt / 2, y1 - wdt / 2, x1 + wdt / 2, y1 + wdt / 2], fill=255)
    d.ellipse([cx - R * 0.12, cy - R * 0.12, cx + R * 0.12, cy + R * 0.12], fill=255)


def star(d, cx, cy, R, pts=5, inner=0.42, rot=-math.pi / 2):
    poly = []
    for i in range(pts * 2):
        ang = rot + i * math.pi / pts
        r = R if i % 2 == 0 else R * inner
        poly.append((cx + math.cos(ang) * r, cy + math.sin(ang) * r))
    d.polygon(poly, fill=255)


def chevron(d, cx, cy, w, h, thick, double=True):
    def one(oy, t):
        p = [(cx - w / 2, cy + h / 2 + oy), (cx, cy - h / 2 + oy), (cx + w / 2, cy + h / 2 + oy)]
        d.line(p, fill=255, width=int(t), joint="curve")
        for px, py in p:
            d.ellipse([px - t / 2, py - t / 2, px + t / 2, py + t / 2], fill=255)
    one(0, thick)
    if double:
        one(h * 0.66, thick * 0.80)


# ---------------------------------------------------------------------- trophy
def trophy(d, cx, cy, scale):
    """A classic two-handled cup: bowl + handles + stem + foot."""
    u = scale
    # bowl: wide rounded rim tapering to the stem
    rim_w, rim_y = 2.30 * u, cy - 2.05 * u
    bowl = [
        (cx - rim_w / 2, rim_y),
        (cx + rim_w / 2, rim_y),
        (cx + rim_w / 2 * 0.92, rim_y + 0.55 * u),
        (cx + 0.62 * u, cy + 0.30 * u),
        (cx - 0.62 * u, cy + 0.30 * u),
        (cx - rim_w / 2 * 0.92, rim_y + 0.55 * u),
    ]
    d.polygon(bowl, fill=255)
    d.pieslice([cx - 1.28 * u, cy - 0.95 * u, cx + 1.28 * u, cy + 0.95 * u], 5, 175, fill=255)
    d.rectangle([cx - rim_w / 2, rim_y - 0.16 * u, cx + rim_w / 2, rim_y + 0.16 * u], fill=255)
    # handles: open C-curves off each shoulder
    hw = 0.52 * u
    for sgn in (-1, 1):
        hx = cx + sgn * (rim_w / 2 - 0.05 * u)
        d.arc([hx - 1.15 * u if sgn > 0 else hx - hw,
               rim_y - 0.10 * u,
               hx + hw if sgn > 0 else hx + 1.15 * u,
               rim_y + 1.55 * u],
              -95 if sgn > 0 else 85, 85 if sgn > 0 else 265, fill=255, width=int(0.28 * u))
    # stem
    d.rectangle([cx - 0.26 * u, cy + 0.20 * u, cx + 0.26 * u, cy + 1.00 * u], fill=255)
    d.ellipse([cx - 0.46 * u, cy + 0.86 * u, cx + 0.46 * u, cy + 1.30 * u], fill=255)
    # foot
    d.polygon([(cx - 0.42 * u, cy + 1.18 * u), (cx + 0.42 * u, cy + 1.18 * u),
               (cx + 0.80 * u, cy + 1.66 * u), (cx - 0.80 * u, cy + 1.66 * u)], fill=255)
    d.rounded_rectangle([cx - 1.16 * u, cy + 1.60 * u, cx + 1.16 * u, cy + 1.94 * u],
                        radius=0.16 * u, fill=255)


def trophy_star_cut(d, cx, cy, scale):
    """Punch a star out of the bowl face (drawn as 0 on a separate mask)."""
    star(d, cx, cy - 0.72 * scale, 0.72 * scale)


# ------------------------------------------------------------------- laurel
def _leaf(mask, x, y, length, width, deg):
    """A rotated pointed-ellipse leaf, screened onto an L mask."""
    pad = int(max(length, width)) + 4
    tile = Image.new("L", (pad * 2, pad * 2), 0)
    td = ImageDraw.Draw(tile)
    td.ellipse([pad - length, pad - width, pad + length, pad + width], fill=255)
    # taper one end to a point
    td.polygon([(pad + length * 0.2, pad - width), (pad + length * 1.15, pad),
                (pad + length * 0.2, pad + width)], fill=255)
    tile = tile.rotate(-deg, resample=Image.BICUBIC, expand=False)
    box = (int(x - pad), int(y - pad))
    region = mask.crop((box[0], box[1], box[0] + pad * 2, box[1] + pad * 2))
    mask.paste(ImageChops.lighter(region, tile), box)


def laurel_mask(cx, cy, R):
    """Two mirrored vines of leaves opening upward - a laurel wreath, tips near the top."""
    m = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(m)
    for sgn in (-1, 1):
        th0, th1, n = math.radians(86), math.radians(-58), 9
        vpts = []
        for i in range(40):
            th = th0 + (th1 - th0) * i / 39
            vpts.append((cx + sgn * math.cos(th) * R, cy + math.sin(th) * R))
        d.line(vpts, fill=255, width=int(R * 0.032), joint="curve")
        for i in range(n):
            t = i / (n - 1)
            th = th0 + (th1 - th0) * t
            px = cx + sgn * math.cos(th) * R
            py = cy + math.sin(th) * R
            radial = math.degrees(math.atan2(math.sin(th), sgn * math.cos(th)))
            flare = 40 * (1 - 0.35 * t)               # tilt from radial toward the top
            _leaf(m, px, py, R * (0.29 - 0.12 * t), R * (0.11 - 0.035 * t),
                  radial - sgn * flare)
    return m


# ---------------------------------------------------------------------- compose
def compose_daily():
    img = radial_bg()

    cw = layer(corridor_waves)
    img = add_glow(img, cw, (110, 150, 255), blur=10 * SS, strength=0.28)
    img = paint(img, cw.point(lambda p: int(p * 0.30)), (150, 180, 255), white_core=0)

    cx, cy = S * 0.5, S * 0.505
    scale = S * 0.118
    line_y = int(cy + 1.98 * scale)

    rl = layer(lambda d: record_line(d, line_y))
    img = add_glow(img, rl, GOLD, blur=18 * SS, strength=0.5)
    img = paint(img, rl, GOLD_PALE, white_core=0.10)

    tm = layer(lambda d: trophy(d, cx, cy, scale))
    cut = layer(lambda d: trophy_star_cut(d, cx, cy, scale))
    tm = Image.fromarray(np.minimum(np.asarray(tm, np.int16),
                                    255 - np.asarray(cut, np.int16)).clip(0, 255).astype(np.uint8))
    img = add_glow(img, tm, GOLD, blur=44 * SS, strength=0.9)
    img = add_glow(img, tm, GOLD_DEEP, blur=110 * SS, strength=0.4)
    img = paint(img, tm, GOLD, white_core=0.17)

    sp = layer(lambda d: sparkle(d, cx + 1.02 * scale, cy - 2.02 * scale, int(S * 0.055)))
    img = add_glow(img, sp, GOLD_PALE, blur=13 * SS, strength=0.8)
    img = paint(img, sp, (255, 247, 224), white_core=0.34)

    return finish_vignette(img)


def compose_alltime():
    img = radial_bg()

    cw = layer(corridor_waves)
    img = add_glow(img, cw, (110, 150, 255), blur=10 * SS, strength=0.28)
    img = paint(img, cw.point(lambda p: int(p * 0.30)), (150, 180, 255), white_core=0)

    cx, cy = S * 0.5, S * 0.55
    R = S * 0.315

    lm = laurel_mask(cx, cy, R)
    img = add_glow(img, lm, LEAF, blur=40 * SS, strength=0.42)
    img = add_glow(img, lm, PLATINUM, blur=90 * SS, strength=0.22)
    img = paint(img, lm, PLATINUM, white_core=0.05)

    ch_w, ch_h = S * 0.30, S * 0.235
    cm = layer(lambda d: chevron(d, cx, cy - S * 0.03, ch_w, ch_h, 42 * SS))
    img = add_glow(img, cm, PLATINUM, blur=46 * SS, strength=0.85)
    img = add_glow(img, cm, CYAN, blur=110 * SS, strength=0.3)
    img = paint(img, cm, PLATINUM, white_core=0.18)

    sm = layer(lambda d: star(d, cx, cy - S * 0.165, S * 0.062))
    img = add_glow(img, sm, PLAT_PALE, blur=16 * SS, strength=0.85)
    img = add_glow(img, sm, CYAN, blur=54 * SS, strength=0.3)
    img = paint(img, sm, (244, 248, 255), white_core=0.34)

    return finish_vignette(img)


def finish_vignette(img):
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    vg = np.sqrt(((xx - S / 2) / (S / 2)) ** 2 + ((yy - S / 2) / (S / 2)) ** 2)
    vg = np.clip((vg - 0.60) / 0.55, 0, 1) * 0.5
    out = np.clip(np.asarray(img, np.float32) * (1 - vg[..., None]), 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGB").resize((1024, 1024), Image.LANCZOS)


for name, fn in [("leaderboard-daily", compose_daily), ("leaderboard-alltime", compose_alltime)]:
    dst = os.path.join(OUT, name + ".png")
    fn().save(dst)
    print("wrote", dst)

# contact sheet for review
cs = Image.new("RGB", (1024 * 2 + 24, 1024), (18, 18, 22))
cs.paste(Image.open(os.path.join(OUT, "leaderboard-daily.png")), (0, 0))
cs.paste(Image.open(os.path.join(OUT, "leaderboard-alltime.png")), (1024 + 24, 0))
cs.save(os.path.join(OUT, "_leaderboard_contact_sheet.png"))
print("wrote", os.path.join(OUT, "_leaderboard_contact_sheet.png"))
