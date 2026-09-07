# Generates the 8 Game Center / Play Games achievement icons added in 9.1: one
# per weekday world (src/constants.js PLANET_ACHIEVEMENTS / WEEKDAY_PALETTES) plus
# the Grand Tour capstone. Each is a shaded sphere in that world's wallBase hue on
# the shared dark-navy glow background the other 18 achievement icons use, with a
# per-world surface treatment (craters / maria / crescent / lumpy asteroid /
# veins) so they don't read as 8 plain coloured discs. 512x512 RGB PNG, no alpha
# (ASC / Play Console requirement). Run: python3 gen-planet-achievement-icons.py
# -> achievement-icons/planet_*.png + _contact_sheet.png
import math, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SIZE = 512
OUT = os.path.dirname(os.path.abspath(__file__)) + "/achievement-icons"
os.makedirs(OUT, exist_ok=True)

BG_DARK = (7, 9, 27)  # matches TUNL app-icon navy / the other 18 achievement icons

# wallBase colors from src/constants.js WEEKDAY_PALETTES (the hue each world reads as)
PLANETS = {
    "ceres":  (150, 178, 210),
    "mars":   (255, 148, 72),
    "luna":   (222, 222, 234),
    "io":     (112, 255, 206),
    "ianthe": (182, 122, 255),
    "pallas": (196, 228, 96),
    "rhodia": (255, 122, 176),
}


def radial_bg(glow_rgb, glow_strength=0.42):
    im = Image.new("RGB", (SIZE, SIZE), BG_DARK)
    glow = Image.new("L", (SIZE, SIZE), 0)
    gd = ImageDraw.Draw(glow)
    r = SIZE * 0.62
    gd.ellipse([SIZE / 2 - r, SIZE / 2 - r, SIZE / 2 + r, SIZE / 2 + r], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(SIZE * 0.18))
    color_layer = Image.new("RGB", (SIZE, SIZE), glow_rgb)
    return Image.composite(Image.blend(im, color_layer, glow_strength), im, glow)


def soft_glow_layer(canvas, shape_mask, color, blur=30, strength=0.85):
    glow = shape_mask.filter(ImageFilter.GaussianBlur(blur))
    color_layer = Image.new("RGB", canvas.size, color)
    return Image.composite(color_layer, canvas, glow.point(lambda p: int(p * strength)))


def clamp(c):
    return tuple(max(0, min(255, int(v))) for v in c)


def mix(a, b, t):
    return clamp((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t))


def lit_sphere(color, cx, cy, R, light=(-0.45, -0.5), ambient=0.28, sharp=False):
    """A shaded ball: Lambert term from a fixed light dir, dark navy terminator."""
    ss = 2  # supersample
    S = SIZE * ss
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    px = layer.load()
    lx, ly = light
    lz = math.sqrt(max(0.0, 1 - lx * lx - ly * ly))
    hi = mix(color, (255, 255, 255), 0.55)
    lo = mix(color, BG_DARK, 0.82)
    Rs = R * ss
    cxs, cys = cx * ss, cy * ss
    x0, x1 = int(cxs - Rs - 2), int(cxs + Rs + 2)
    y0, y1 = int(cys - Rs - 2), int(cys + Rs + 2)
    for y in range(max(0, y0), min(S, y1)):
        for x in range(max(0, x0), min(S, x1)):
            dx = (x - cxs) / Rs
            dy = (y - cys) / Rs
            d2 = dx * dx + dy * dy
            if d2 > 1.0:
                continue
            nz = math.sqrt(1 - d2)
            lam = dx * lx + dy * ly + nz * lz
            lam = max(0.0, lam)
            shade = ambient + (1 - ambient) * lam
            if shade < 0.5:
                col = mix(lo, color, shade / 0.5)
            else:
                col = mix(color, hi, (shade - 0.5) / 0.5 * 0.9)
            # rim light on the dark limb
            rim = max(0.0, (math.sqrt(d2) - 0.82) / 0.18)
            if rim > 0:
                col = mix(col, mix(color, (255, 255, 255), 0.4), rim * 0.5)
            a = 255
            edge = (1.0 - d2)
            if edge < 0.03:
                a = int(255 * (edge / 0.03))
            px[x, y] = (col[0], col[1], col[2], a)
    return layer.resize((SIZE, SIZE), Image.LANCZOS)


def disc_mask(cx, cy, R):
    m = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(m).ellipse([cx - R, cy - R, cx + R, cy + R], fill=255)
    return m


def spots(layer, cx, cy, R, seed, specs, blur=0.006):
    """specs: list of (rel_x, rel_y, rel_r, color, alpha). Clipped to the disc."""
    ov = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for rx, ry, rr, col, alpha in specs:
        x = cx + rx * R
        y = cy + ry * R
        rad = rr * R
        od.ellipse([x - rad, y - rad, x + rad, y + rad], fill=(col[0], col[1], col[2], alpha))
    ov = ov.filter(ImageFilter.GaussianBlur(SIZE * blur))
    m = disc_mask(cx, cy, R - 3)
    ov.putalpha(ImageChops.multiply(ov.split()[3], m))
    layer = layer.convert("RGBA")
    layer.alpha_composite(ov)
    return layer


def scatter(n, seed, spread=0.62, rmin=0.05, rmax=0.13, sep=0.9):
    """Poisson-ish scattered (rx, ry, radius) inside the disc."""
    rnd = random.Random(seed)
    out = []
    tries = 0
    while len(out) < n and tries < n * 60:
        tries += 1
        a = rnd.uniform(0, 2 * math.pi)
        rad = spread * math.sqrt(rnd.random())
        rx, ry = math.cos(a) * rad, math.sin(a) * rad
        cr = rnd.uniform(rmin, rmax)
        if all((rx - ox) ** 2 + (ry - oy) ** 2 > (sep * (cr + orr)) ** 2 for ox, oy, orr in out):
            out.append((rx, ry, cr))
    return out


def craters(cx, cy, R, base, n, seed, rmin=0.05, rmax=0.13, rim=False):
    """Soft dark surface dabs (read as maria / mottling at icon size)."""
    dark = mix(base, BG_DARK, 0.5)
    light = mix(base, (255, 255, 255), 0.5)
    rnd = random.Random(seed * 7 + 1)
    specs = []
    for rx, ry, cr in scatter(n, seed, rmin=rmin, rmax=rmax):
        specs.append((rx, ry, cr, dark, rnd.randint(80, 130)))
        if rim:
            specs.append((rx - cr * 0.4, ry - cr * 0.4, cr * 0.45, light, 28))
    return specs


def finish(name, color, sphere_layer, extra_glyph_mask=None):
    base = radial_bg(color)
    # planet's own soft glow from its silhouette
    sil = sphere_layer.split()[3].point(lambda p: 255 if p > 40 else 0)
    if extra_glyph_mask is not None:
        sil = ImageChops.lighter(sil, extra_glyph_mask)
    out = soft_glow_layer(base, sil, color, blur=38, strength=0.7).convert("RGBA")
    out.alpha_composite(sphere_layer.convert("RGBA"))
    out.convert("RGB").save(f"{OUT}/planet_{name}.png")


# ---- individual planets -------------------------------------------------------
CX = CY = SIZE / 2

def build(name):
    color = PLANETS[name]
    if name == "pallas":
        # Pallas is a lumpy asteroid, not a sphere: irregular blobby silhouette.
        rnd = random.Random(42)
        R = SIZE * 0.30
        pts = []
        for i in range(13):
            a = i / 13 * 2 * math.pi
            rr = R * (0.78 + 0.32 * rnd.random())
            pts.append((CX + math.cos(a) * rr, CY + math.sin(a) * rr))
        shape = Image.new("L", (SIZE, SIZE), 0)
        ImageDraw.Draw(shape).polygon(pts, fill=255)
        # shade it with the sphere renderer, then clip to the rocky outline
        ball = lit_sphere(color, CX, CY, R * 1.15)
        ball.putalpha(ImageChops.multiply(ball.split()[3], shape))
        ball = spots(ball, CX, CY, R * 1.15, 7, craters(CX, CY, R, color, 9, 7, 0.05, 0.13))
        # re-clip after blur bleed
        a = ImageChops.multiply(ball.split()[3], shape.filter(ImageFilter.GaussianBlur(1)))
        ball.putalpha(a)
        finish(name, color, ball)
        return

    R = SIZE * 0.30
    ball = lit_sphere(color, CX, CY, R)

    if name == "ceres":
        ball = spots(ball, CX, CY, R, 3, craters(CX, CY, R, color, 7, 31, 0.05, 0.11), blur=0.010)
    elif name == "luna":
        ball = spots(ball, CX, CY, R, 11, craters(CX, CY, R, color, 10, 47, 0.045, 0.14), blur=0.010)
    elif name == "mars":
        dark = mix(color, BG_DARK, 0.42)
        specs = [(rx, ry, cr * 1.6, dark, 78)
                 for rx, ry, cr in scatter(6, 12, spread=0.6, rmin=0.08, rmax=0.19, sep=0.35)]
        ball = spots(ball, CX, CY, R, 5, specs, blur=0.013)
    elif name == "io":
        dark = mix(color, (120, 40, 20), 0.55)
        sulfur = mix(color, (255, 235, 130), 0.75)
        specs = []
        for i, (rx, ry, cr) in enumerate(scatter(7, 5, spread=0.6, rmin=0.05, rmax=0.11, sep=1.1)):
            specs.append((rx, ry, cr, dark if i % 3 else sulfur, 130 if i % 3 else 80))
        ball = spots(ball, CX, CY, R, 9, specs)
    elif name == "ianthe":
        # a small moon, waning gibbous: shadow bites only the leftmost third of the limb
        shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).ellipse(
            [CX - R * 2.4, CY - R * 1.15, CX - R * 0.35, CY + R * 1.15],
            fill=(BG_DARK[0], BG_DARK[1], BG_DARK[2], 225))
        shadow = shadow.filter(ImageFilter.GaussianBlur(SIZE * 0.035))
        shadow.putalpha(ImageChops.multiply(shadow.split()[3], disc_mask(CX, CY, R - 3)))
        ball = ball.convert("RGBA")
        ball.alpha_composite(shadow)
        ball = spots(ball, CX, CY, R, 2, craters(CX, CY, R, color, 3, 9, 0.05, 0.09), blur=0.010)
    elif name == "rhodia":
        vein = mix(color, BG_DARK, 0.55)
        # a few thin wandering dark rhodonite veins
        ov = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        for pts in ([(-0.78, -0.05), (-0.3, -0.18), (0.2, -0.05), (0.7, -0.22)],
                    [(-0.5, 0.55), (-0.15, 0.3), (0.35, 0.45), (0.7, 0.28)]):
            od.line([(CX + x * R, CY + y * R) for x, y in pts],
                    fill=(vein[0], vein[1], vein[2], 95), width=4, joint="curve")
        ov = ov.filter(ImageFilter.GaussianBlur(SIZE * 0.009))
        ov.putalpha(ImageChops.multiply(ov.split()[3], disc_mask(CX, CY, R - 3)))
        ball = ball.convert("RGBA")
        ball.alpha_composite(ov)

    finish(name, color, ball)


for n in PLANETS:
    build(n)

# ---- Grand Tour: an orbital system -----------------------------------------
GOLD = (255, 210, 110)
base = radial_bg(GOLD, glow_strength=0.5)
glyph = Image.new("L", (SIZE, SIZE), 0)
gd = ImageDraw.Draw(glyph)
# three elliptical orbit rings
for i, (rw, rh) in enumerate([(0.20, 0.20), (0.32, 0.24), (0.44, 0.30)]):
    gd.ellipse([CX - SIZE * rw, CY - SIZE * rh, CX + SIZE * rw, CY + SIZE * rh],
               outline=255, width=6)
sphere_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
# central star
star = lit_sphere(mix(GOLD, (255, 255, 255), 0.3), CX, CY, SIZE * 0.11, light=(0, 0), ambient=1.0)
sphere_layer.alpha_composite(star)
# 7 worlds spaced around the rings, one per weekday world colour
cols = list(PLANETS.values())
ring = [(0.20, 0.20), (0.20, 0.20), (0.32, 0.24), (0.32, 0.24), (0.44, 0.30), (0.44, 0.30), (0.44, 0.30)]
ang = [20, 200, 90, 285, 150, 20, 250]
for c, (rw, rh), a in zip(cols, ring, ang):
    ar = math.radians(a)
    x = CX + math.cos(ar) * SIZE * rw
    y = CY + math.sin(ar) * SIZE * rh
    sphere_layer.alpha_composite(lit_sphere(c, x, y, SIZE * 0.045, light=(-0.4, -0.5)))
glyph_glow = ImageChops.lighter(glyph, sphere_layer.split()[3].point(lambda p: 255 if p > 40 else 0))
out = soft_glow_layer(base, glyph_glow, GOLD, blur=30, strength=0.7).convert("RGBA")
# paint the rings
ring_rgb = Image.new("RGB", (SIZE, SIZE), mix(GOLD, (255, 255, 255), 0.25))
out = Image.composite(ring_rgb.convert("RGBA"), out, glyph)
out.alpha_composite(sphere_layer)
out.convert("RGB").save(f"{OUT}/planet_grand_tour.png")

# ---- contact sheet (for review) -----------------------------------------
names = [f"planet_{n}" for n in PLANETS] + ["planet_grand_tour"]
cs = Image.new("RGB", (SIZE * 4, SIZE * 2), (20, 20, 20))
for i, n in enumerate(names):
    im = Image.open(f"{OUT}/{n}.png")
    cs.paste(im, ((i % 4) * SIZE, (i // 4) * SIZE))
cs.save(f"{OUT}/_contact_sheet.png")
print("wrote", len(names), "planet icons to", OUT)
