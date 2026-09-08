# Generates the 2 lifetime-distance achievement icons (src/constants.js
# DIST_ACHIEVEMENTS): "To the Moon" (tunl_ach_dist_moon) and "To the Sun"
# (tunl_ach_dist_sun). Same visual language as gen-planet-achievement-icons.py -
# shaded body on the shared dark-navy glow background - but with a dashed curved
# trajectory arc and a small ship at its near end, so they read as "you travelled
# all this way" rather than "you flew this world". 512x512 RGB PNG, no alpha
# (ASC / Play Console requirement). Run: python3 gen-distance-achievement-icons.py
# -> achievement-icons/dist_moon.png, dist_sun.png + _dist_contact_sheet.png
import math, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SIZE = 512
OUT = os.path.dirname(os.path.abspath(__file__)) + "/achievement-icons"
os.makedirs(OUT, exist_ok=True)

BG_DARK = (7, 9, 27)


def clamp(c):
    return tuple(max(0, min(255, int(v))) for v in c)


def mix(a, b, t):
    return clamp((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t))


def radial_bg(glow_rgb, glow_strength=0.42, center=None, r=None, blur=0.18):
    cx, cy = center or (SIZE / 2, SIZE / 2)
    r = r if r is not None else SIZE * 0.62
    im = Image.new("RGB", (SIZE, SIZE), BG_DARK)
    glow = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(glow).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(SIZE * blur))
    color_layer = Image.new("RGB", (SIZE, SIZE), glow_rgb)
    return Image.composite(Image.blend(im, color_layer, glow_strength), im, glow)


def body_glow(canvas, center, R, color, reach=2.6, strength=0.8, blur=0.06):
    """A focused halo so the body reads as the light source in the frame."""
    m = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(m).ellipse([center[0] - R * reach, center[1] - R * reach,
                               center[0] + R * reach, center[1] + R * reach], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(SIZE * blur))
    return soft_glow_layer(canvas.convert("RGB"), m, color, blur=SIZE * blur, strength=strength).convert("RGBA")


def soft_glow_layer(canvas, shape_mask, color, blur=30, strength=0.85):
    glow = shape_mask.filter(ImageFilter.GaussianBlur(blur))
    color_layer = Image.new("RGB", canvas.size, color)
    return Image.composite(color_layer, canvas, glow.point(lambda p: int(p * strength)))


def lit_sphere(color, cx, cy, R, light=(-0.45, -0.5), ambient=0.28):
    ss = 2
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
            lam = max(0.0, dx * lx + dy * ly + nz * lz)
            shade = ambient + (1 - ambient) * lam
            if shade < 0.5:
                col = mix(lo, color, shade / 0.5)
            else:
                col = mix(color, hi, (shade - 0.5) / 0.5 * 0.9)
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


def scatter(n, seed, spread=0.6, rmin=0.05, rmax=0.13, sep=0.9):
    rnd = random.Random(seed)
    out, tries = [], 0
    while len(out) < n and tries < n * 60:
        tries += 1
        a = rnd.uniform(0, 2 * math.pi)
        rad = spread * math.sqrt(rnd.random())
        rx, ry = math.cos(a) * rad, math.sin(a) * rad
        cr = rnd.uniform(rmin, rmax)
        if all((rx - ox) ** 2 + (ry - oy) ** 2 > (sep * (cr + orr)) ** 2 for ox, oy, orr in out):
            out.append((rx, ry, cr))
    return out


def craters(cx, cy, R, base, n, seed):
    dark = mix(base, BG_DARK, 0.5)
    light = mix(base, (255, 255, 255), 0.5)
    rnd = random.Random(seed * 7 + 1)
    ov = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for rx, ry, cr in scatter(n, seed, rmin=0.05, rmax=0.13):
        x, y, rad = cx + rx * R, cy + ry * R, cr * R
        od.ellipse([x - rad, y - rad, x + rad, y + rad], fill=(dark[0], dark[1], dark[2], rnd.randint(85, 130)))
        od.ellipse([x - rad * 0.5, y - rad * 0.5, x + rad * 0.1, y + rad * 0.1],
                   fill=(light[0], light[1], light[2], 26))
    ov = ov.filter(ImageFilter.GaussianBlur(SIZE * 0.010))
    ov.putalpha(ImageChops.multiply(ov.split()[3], disc_mask(cx, cy, R - 3)))
    return ov


def bezier(p0, p1, p2, t):
    u = 1 - t
    return (u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])


def trajectory(canvas, p0, p2, color, ctrl=(0.30, 0.30)):
    """Dashed quadratic arc from p0 to the body centre p2, brighter near the ship."""
    p1 = (SIZE * ctrl[0], SIZE * ctrl[1])
    ov = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    N = 15
    for i in range(N):
        t0 = (i + 0.12) / N
        t1 = (i + 0.72) / N
        a0 = bezier(p0, p1, p2, t0)
        a1 = bezier(p0, p1, p2, t1)
        f = i / (N - 1)                       # 0 near ship .. 1 near body
        alpha = int(235 - 150 * f)
        w = max(3, int(7 - 3.5 * f))
        c = mix(color, (255, 255, 255), 0.25 - 0.15 * f)
        od.line([a0, a1], fill=(c[0], c[1], c[2], alpha), width=w)
    ov = ov.filter(ImageFilter.GaussianBlur(SIZE * 0.004))
    glow = ov.split()[3].filter(ImageFilter.GaussianBlur(SIZE * 0.02))
    canvas = soft_glow_layer(canvas.convert("RGB"), glow, color, blur=SIZE * 0.02, strength=0.5).convert("RGBA")
    canvas.alpha_composite(ov)
    return canvas, p1


def ship(canvas, pos, heading, hue):
    """Small sleek dart pointing along `heading` (radians), with an exhaust streak."""
    L, Wd = SIZE * 0.085, SIZE * 0.042
    ca, sa = math.cos(heading), math.sin(heading)

    def R(x, y):
        return (pos[0] + x * ca - y * sa, pos[1] + x * sa + y * ca)

    body = [R(L * 0.62, 0), R(-L * 0.42, Wd * 0.5), R(-L * 0.28, 0), R(-L * 0.42, -Wd * 0.5)]
    ov = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    # exhaust streak
    for k in range(6):
        tt = k / 5
        ex = R(-L * (0.42 + tt * 1.5), 0)
        od.ellipse([ex[0] - (7 - k), ex[1] - (7 - k), ex[0] + (7 - k), ex[1] + (7 - k)],
                   fill=(mix(hue, (255, 255, 255), 0.3) + (int(150 * (1 - tt)),)))
    ov = ov.filter(ImageFilter.GaussianBlur(SIZE * 0.006))
    od = ImageDraw.Draw(ov)
    od.polygon(body, fill=(245, 248, 255, 255))
    od.polygon([R(L * 0.62, 0), R(L * 0.05, Wd * 0.28), R(L * 0.05, -Wd * 0.28)],
               fill=(mix(hue, (255, 255, 255), 0.5) + (255,)))
    sil = ov.split()[3].point(lambda p: 255 if p > 60 else 0)
    canvas = soft_glow_layer(canvas.convert("RGB"), sil, mix(hue, (255, 255, 255), 0.4),
                             blur=SIZE * 0.03, strength=0.8).convert("RGBA")
    canvas.alpha_composite(ov)
    return canvas


CX = CY = SIZE / 2
SHIP_POS = (SIZE * 0.185, SIZE * 0.83)


def build_moon():
    hue = (226, 228, 240)
    tint = (150, 174, 232)
    body_c = (SIZE * 0.70, SIZE * 0.31)
    R = SIZE * 0.195
    canvas = radial_bg(mix(BG_DARK, tint, 0.30), glow_strength=0.55,
                       center=body_c, r=SIZE * 0.30, blur=0.22).convert("RGBA")
    canvas = body_glow(canvas, body_c, R, hue, reach=2.1, strength=0.42, blur=0.055)
    canvas, _ = trajectory(canvas, SHIP_POS, body_c, mix(tint, (255, 255, 255), 0.25), ctrl=(0.29, 0.34))
    ball = lit_sphere(hue, body_c[0], body_c[1], R)
    ball.alpha_composite(craters(body_c[0], body_c[1], R, hue, 9, 47))
    canvas.alpha_composite(ball)
    hx, hy = bezier(SHIP_POS, (SIZE * 0.29, SIZE * 0.34), body_c, 0.05)
    canvas = ship(canvas, SHIP_POS, math.atan2(hy - SHIP_POS[1], hx - SHIP_POS[0]), (170, 195, 255))
    canvas.convert("RGB").save(f"{OUT}/dist_moon.png")


def build_sun():
    core = (255, 240, 190)
    glow_c = (255, 168, 58)
    body_c = (SIZE * 0.71, SIZE * 0.30)
    R = SIZE * 0.140
    canvas = radial_bg(mix(BG_DARK, (60, 34, 12), 0.7), glow_strength=0.5,
                       center=body_c, r=SIZE * 0.24, blur=0.24).convert("RGBA")
    canvas = body_glow(canvas, body_c, R, glow_c, reach=3.0, strength=0.9, blur=0.08)
    canvas = body_glow(canvas, body_c, R, mix(core, glow_c, 0.3), reach=1.7, strength=0.85, blur=0.035)
    # short sharp rays
    rays = Image.new("L", (SIZE, SIZE), 0)
    rd = ImageDraw.Draw(rays)
    for i in range(16):
        a = i / 16 * 2 * math.pi + 0.2
        r0, r1 = R * 1.15, R * (1.7 + 0.5 * (i % 2))
        rd.line([(body_c[0] + math.cos(a) * r0, body_c[1] + math.sin(a) * r0),
                 (body_c[0] + math.cos(a) * r1, body_c[1] + math.sin(a) * r1)], fill=210, width=7)
    rays = rays.filter(ImageFilter.GaussianBlur(SIZE * 0.012))
    canvas = soft_glow_layer(canvas.convert("RGB"), rays, mix(core, glow_c, 0.35),
                             blur=SIZE * 0.01, strength=0.9).convert("RGBA")
    canvas, _ = trajectory(canvas, SHIP_POS, body_c, mix(glow_c, (255, 232, 160), 0.55), ctrl=(0.30, 0.35))
    disc = lit_sphere(core, body_c[0], body_c[1], R, light=(0.0, 0.0), ambient=1.0)
    hs = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(hs).ellipse([body_c[0] - R * 0.55, body_c[1] - R * 0.55,
                                body_c[0] + R * 0.55, body_c[1] + R * 0.55], fill=(255, 253, 240, 255))
    disc.alpha_composite(hs.filter(ImageFilter.GaussianBlur(SIZE * 0.028)))
    canvas.alpha_composite(disc)
    hx, hy = bezier(SHIP_POS, (SIZE * 0.30, SIZE * 0.35), body_c, 0.05)
    canvas = ship(canvas, SHIP_POS, math.atan2(hy - SHIP_POS[1], hx - SHIP_POS[0]), (255, 214, 150))
    canvas.convert("RGB").save(f"{OUT}/dist_sun.png")


build_moon()
build_sun()

cs = Image.new("RGB", (SIZE * 2, SIZE), (20, 20, 20))
for i, n in enumerate(["dist_moon", "dist_sun"]):
    cs.paste(Image.open(f"{OUT}/{n}.png"), (i * SIZE, 0))
cs.save(f"{OUT}/_dist_contact_sheet.png")
print("wrote dist_moon.png, dist_sun.png to", OUT)
