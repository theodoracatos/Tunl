# Generates the 10 new v11.0 achievement icons: 2 dodge (near-miss), 1 pacifist,
# 3 runs-played, and 4 "skill" achievements (sprint / no_hit / no_bonus /
# boulder_meister). Same visual language as gen-distance-/gen-flight-achievement-
# icons.py - shared dark-navy radial glow background, a glowing "body" as the
# achievement's motif, and the small dashed-trajectory ship arriving at it from
# the bottom-left corner - so all ~28 TUNL achievement icons read as one family
# despite each motif being different. 512x512 RGB PNG, no alpha (ASC / Play
# Console requirement).
# Run: python3 gen-v11-achievement-icons.py
# -> achievement-icons/{dodge_100,dodge_1000,pacifist,runs_10,runs_100,runs_1000,
#    sprint,no_hit,no_bonus,boulder_meister}.png + _v11_contact_sheet.png
import math, os
from PIL import Image, ImageDraw, ImageFilter

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


def soft_glow_layer(canvas, shape_mask, color, blur=30, strength=0.85):
    glow = shape_mask.filter(ImageFilter.GaussianBlur(blur))
    color_layer = Image.new("RGB", canvas.size, color)
    return Image.composite(color_layer, canvas, glow.point(lambda p: int(p * strength)))


def body_glow(canvas, center, R, color, reach=2.6, strength=0.8, blur=0.06):
    m = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(m).ellipse([center[0] - R * reach, center[1] - R * reach,
                               center[0] + R * reach, center[1] + R * reach], fill=255)
    m = m.filter(ImageFilter.GaussianBlur(SIZE * blur))
    return soft_glow_layer(canvas.convert("RGB"), m, color, blur=SIZE * blur, strength=strength).convert("RGBA")


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
        f = i / (N - 1)
        alpha = int(235 - 150 * f)
        w = max(3, int(7 - 3.5 * f))
        c = mix(color, (255, 255, 255), 0.25 - 0.15 * f)
        od.line([a0, a1], fill=(c[0], c[1], c[2], alpha), width=w)
    ov = ov.filter(ImageFilter.GaussianBlur(SIZE * 0.004))
    glow = ov.split()[3].filter(ImageFilter.GaussianBlur(SIZE * 0.02))
    canvas = soft_glow_layer(canvas.convert("RGB"), glow, color, blur=SIZE * 0.02, strength=0.5).convert("RGBA")
    canvas.alpha_composite(ov)
    return canvas


def ship(canvas, pos, heading, hue):
    L, Wd = SIZE * 0.085, SIZE * 0.042
    ca, sa = math.cos(heading), math.sin(heading)

    def R(x, y):
        return (pos[0] + x * ca - y * sa, pos[1] + x * sa + y * ca)

    body = [R(L * 0.62, 0), R(-L * 0.42, Wd * 0.5), R(-L * 0.28, 0), R(-L * 0.42, -Wd * 0.5)]
    ov = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
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


def diamond_coin(cx, cy, R, color, slash=False):
    """The game's own coin silhouette: faceted diamond + sparkle rays (draw.js's
    shared coin render path), optionally crossed out for 'no bonus'/'pacifist'."""
    ov = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    pts = [(cx, cy - R), (cx + R * 0.62, cy), (cx, cy + R), (cx - R * 0.62, cy)]
    od.polygon(pts, fill=(color[0], color[1], color[2], 235))
    inner = mix(color, (255, 255, 255), 0.55)
    od.polygon([(cx, cy - R * 0.5), (cx + R * 0.30, cy), (cx, cy + R * 0.5), (cx - R * 0.30, cy)],
               fill=(inner[0], inner[1], inner[2], 220))
    for a in range(0, 360, 45):
        rad = math.radians(a)
        r0, r1 = R * 1.05, R * 1.55
        x0, y0 = cx + math.cos(rad) * r0, cy + math.sin(rad) * r0
        x1, y1 = cx + math.cos(rad) * r1, cy + math.sin(rad) * r1
        od.line([(x0, y0), (x1, y1)], fill=(255, 255, 255, 140), width=3)
    if slash:
        sc = (235, 70, 70, 255)
        od.line([(cx - R * 1.3, cy - R * 1.3), (cx + R * 1.3, cy + R * 1.3)], fill=sc, width=int(R * 0.16))
        od.line([(cx - R * 1.3, cy - R * 1.3), (cx + R * 1.3, cy + R * 1.3)],
                 fill=(255, 255, 255, 200), width=int(R * 0.05))
    ov = ov.filter(ImageFilter.GaussianBlur(SIZE * 0.002))
    return ov


def stal_spike(x, y, length, half_w, color, from_top):
    """A stalactite/stalagmite triangle, matching the game's own obstacle shape."""
    ov = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    if from_top:
        pts = [(x - half_w, y), (x + half_w, y), (x, y + length)]
    else:
        pts = [(x - half_w, y), (x + half_w, y), (x, y - length)]
    od.polygon(pts, fill=(color[0], color[1], color[2], 255))
    edge = mix(color, (255, 255, 255), 0.35)
    od.line([pts[2], pts[0]], fill=edge, width=3)
    return ov


CX = CY = SIZE / 2
SHIP_POS = (SIZE * 0.185, SIZE * 0.83)
BODY_C = (SIZE * 0.685, SIZE * 0.305)


def base_canvas(glow_c, strength=0.55, r=SIZE * 0.32, blur=0.22):
    return radial_bg(mix(BG_DARK, glow_c, 0.30), glow_strength=strength,
                      center=BODY_C, r=r, blur=blur).convert("RGBA")


def add_ship(canvas, hue, ctrl=(0.29, 0.34)):
    canvas = trajectory(canvas, SHIP_POS, BODY_C, mix(hue, (255, 255, 255), 0.25), ctrl=ctrl)
    hx, hy = bezier(SHIP_POS, (SIZE * ctrl[0], SIZE * ctrl[1]), BODY_C, 0.05)
    return ship(canvas, SHIP_POS, math.atan2(hy - SHIP_POS[1], hx - SHIP_POS[0]),
                mix(hue, (255, 255, 255), 0.35))


def save(canvas, name):
    canvas.convert("RGB").save(f"{OUT}/{name}.png")


# ── Dodge (near-miss / "Ausweichen") ─────────────────────────────────────────
# A chicane of two spikes with the trajectory grazing the gap between them -
# the whole point of a near-miss is "close, but clean". dodge_1000 tightens the
# gap and turns up the heat (amber -> crimson), same escalation shape as
# flight_1min -> flight_2min.
def build_dodge(name, glow_c, hue, half_gap_frac):
    canvas = base_canvas(glow_c)
    canvas = body_glow(canvas, BODY_C, SIZE * 0.16, glow_c, reach=2.4, strength=0.5, blur=0.06)
    half_gap = SIZE * half_gap_frac
    spike_len = SIZE * 0.16
    spike_c = mix(glow_c, (40, 20, 20), 0.4)
    # bases sit outside the gap, tips point inward and stop AT the gap edge -
    # never past it, so the opening between the two tips stays a clean slot.
    top = stal_spike(BODY_C[0], BODY_C[1] - half_gap - spike_len, spike_len, SIZE * 0.075, spike_c, True)
    bot = stal_spike(BODY_C[0], BODY_C[1] + half_gap + spike_len, spike_len, SIZE * 0.075, spike_c, False)
    canvas.alpha_composite(top)
    canvas.alpha_composite(bot)
    canvas = add_ship(canvas, hue, ctrl=(0.30, 0.42))
    save(canvas, name)


# ── Pacifist ─────────────────────────────────────────────────────────────────
# The game's own gold coin, ghosted pale and crossed out - flown past, never
# collected. Serene teal/mint instead of any hazard color: restraint, not danger.
def build_pacifist():
    glow_c = (70, 210, 175)
    canvas = base_canvas(glow_c, r=SIZE * 0.34)
    canvas = body_glow(canvas, BODY_C, SIZE * 0.13, glow_c, reach=2.6, strength=0.45, blur=0.07)
    coin = diamond_coin(BODY_C[0], BODY_C[1], SIZE * 0.135, mix(glow_c, (255, 255, 255), 0.4), slash=True)
    coin.putalpha(coin.split()[3].point(lambda p: int(p * 0.55)))  # ghosted / uncollected
    canvas.alpha_composite(coin)
    canvas = add_ship(canvas, (170, 255, 225), ctrl=(0.30, 0.55))  # trajectory passes below the coin
    save(canvas, "pacifist")


# ── Runs played ───────────────────────────────────────────────────────────────
# Concentric orbit rings, one more per tier, escalating bronze -> silver -> gold -
# the same "grind ladder" reading as the score/distance tiers elsewhere.
def build_runs(name, rings, ring_color):
    canvas = base_canvas(ring_color, r=SIZE * 0.30)
    canvas = body_glow(canvas, BODY_C, SIZE * 0.10, ring_color, reach=2.8, strength=0.5, blur=0.05)
    ov = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for i in range(rings):
        r = SIZE * (0.10 + i * 0.055)
        w = max(2, int(SIZE * 0.012))
        c = mix(ring_color, (255, 255, 255), 0.15 + i * 0.1)
        od.ellipse([BODY_C[0] - r, BODY_C[1] - r, BODY_C[0] + r, BODY_C[1] + r], outline=c, width=w)
    # small ship silhouette at the centre, orbit hub
    od.ellipse([BODY_C[0] - SIZE * 0.045, BODY_C[1] - SIZE * 0.045,
                BODY_C[0] + SIZE * 0.045, BODY_C[1] + SIZE * 0.045],
               fill=mix(ring_color, (255, 255, 255), 0.55) + (255,))
    ov = ov.filter(ImageFilter.GaussianBlur(SIZE * 0.002))
    canvas.alpha_composite(ov)
    canvas = add_ship(canvas, mix(ring_color, (255, 255, 255), 0.3))
    save(canvas, name)


# ── Sprint ────────────────────────────────────────────────────────────────────
# A bright lightning bolt with radiating speed lines - pace, not distance.
def build_sprint():
    glow_c = (255, 225, 90)
    canvas = base_canvas(glow_c, r=SIZE * 0.30)
    canvas = body_glow(canvas, BODY_C, SIZE * 0.15, glow_c, reach=2.6, strength=0.6, blur=0.06)
    ov = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    R = SIZE * 0.15
    bolt = [(-0.15, -0.85), (0.35, -0.10), (0.02, -0.05), (0.25, 0.85),
            (-0.35, 0.05), (-0.02, 0.0)]
    pts = [(BODY_C[0] + x * R, BODY_C[1] + y * R) for x, y in bolt]
    od.polygon(pts, fill=(255, 250, 225, 255))
    for i in range(5):
        a = -0.55 + i * 0.28
        r0, r1 = R * 1.3, R * (1.9 + 0.3 * (i % 2))
        x0, y0 = BODY_C[0] + math.sin(a) * r0, BODY_C[1] - math.cos(a) * r0
        x1, y1 = BODY_C[0] + math.sin(a) * r1, BODY_C[1] - math.cos(a) * r1
        od.line([(x0, y0), (x1, y1)], fill=(255, 255, 255, 160), width=4)
    ov = ov.filter(ImageFilter.GaussianBlur(SIZE * 0.002))
    canvas.alpha_composite(ov)
    canvas = add_ship(canvas, (255, 235, 150), ctrl=(0.30, 0.42))
    save(canvas, "sprint")


# ── No-Hit Run ────────────────────────────────────────────────────────────────
# A pristine hexagonal shield, untouched - cool blue/white, nothing scorched it.
def build_no_hit():
    glow_c = (110, 175, 255)
    canvas = base_canvas(glow_c, r=SIZE * 0.30)
    canvas = body_glow(canvas, BODY_C, SIZE * 0.15, glow_c, reach=2.4, strength=0.55, blur=0.06)
    ov = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    R = SIZE * 0.145
    hexpts = [(BODY_C[0] + math.cos(math.radians(a)) * R, BODY_C[1] + math.sin(math.radians(a)) * R)
              for a in range(-90, 271, 60)]
    od.polygon(hexpts, fill=(mix(glow_c, (255, 255, 255), 0.35) + (235,)))
    inner = [(BODY_C[0] + math.cos(math.radians(a)) * R * 0.68, BODY_C[1] + math.sin(math.radians(a)) * R * 0.68)
              for a in range(-90, 271, 60)]
    od.polygon(inner, outline=(255, 255, 255, 200), width=4)
    ov = ov.filter(ImageFilter.GaussianBlur(SIZE * 0.0015))
    canvas.alpha_composite(ov)
    canvas = add_ship(canvas, (190, 220, 255), ctrl=(0.29, 0.36))
    save(canvas, "no_hit")


# ── No Bonus ──────────────────────────────────────────────────────────────────
# The same gold coin as pacifist's motif, crossed out, but muted/steel-grey
# instead of teal - "denied", not "serene" (pacifist forgoes ALL coins;
# no_bonus specifically forgoes gold, so it reads as a colder, more clinical
# refusal than pacifist's calm one).
def build_no_bonus():
    glow_c = (150, 165, 190)
    canvas = base_canvas(glow_c, r=SIZE * 0.30)
    canvas = body_glow(canvas, BODY_C, SIZE * 0.13, glow_c, reach=2.4, strength=0.45, blur=0.06)
    coin = diamond_coin(BODY_C[0], BODY_C[1], SIZE * 0.135, (255, 205, 70), slash=True)
    canvas.alpha_composite(coin)
    canvas = add_ship(canvas, (200, 210, 230), ctrl=(0.30, 0.55))
    save(canvas, "no_bonus")


# ── Boulder Meister ───────────────────────────────────────────────────────────
# The game's own boulder (large rounded rock) with the trajectory threading its
# narrow pass close along the rim, plus 5 small tick marks for the 5 threaded
# boulders the achievement demands. Warm stone body, hot rim light on the pass
# side so the "squeeze" reads immediately.
def build_boulder_meister():
    glow_c = (190, 150, 100)
    canvas = base_canvas(glow_c, r=SIZE * 0.32)
    R = SIZE * 0.155
    canvas = body_glow(canvas, BODY_C, R, glow_c, reach=2.3, strength=0.4, blur=0.06)
    ov = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    rock = mix(glow_c, BG_DARK, 0.35)
    od.ellipse([BODY_C[0] - R, BODY_C[1] - R * 0.9, BODY_C[0] + R * 0.95, BODY_C[1] + R],
               fill=(rock[0], rock[1], rock[2], 255))
    hi = mix(glow_c, (255, 240, 210), 0.55)
    od.ellipse([BODY_C[0] - R * 0.55, BODY_C[1] - R * 0.7, BODY_C[0] + R * 0.15, BODY_C[1] - R * 0.05],
               fill=(hi[0], hi[1], hi[2], 90))
    # bright rim on the lower-left edge -- the "narrow pass" the ship threads
    rim = mix(glow_c, (255, 255, 255), 0.6)
    od.arc([BODY_C[0] - R, BODY_C[1] - R * 0.9, BODY_C[0] + R * 0.95, BODY_C[1] + R],
           110, 200, fill=rim, width=6)
    ov = ov.filter(ImageFilter.GaussianBlur(SIZE * 0.002))
    canvas.alpha_composite(ov)
    # 5 tally ticks arcing below the rock
    ticks = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    td = ImageDraw.Draw(ticks)
    for i in range(5):
        a = math.radians(150 + i * 12)
        r0, r1 = R * 1.35, R * 1.55
        x0, y0 = BODY_C[0] + math.cos(a) * r0, BODY_C[1] + math.sin(a) * r0
        x1, y1 = BODY_C[0] + math.cos(a) * r1, BODY_C[1] + math.sin(a) * r1
        td.line([(x0, y0), (x1, y1)], fill=(255, 220, 170, 230), width=5)
    canvas.alpha_composite(ticks)
    canvas = add_ship(canvas, (255, 210, 160), ctrl=(0.30, 0.50))
    save(canvas, "boulder_meister")


build_dodge("dodge_100", (220, 150, 60), (255, 220, 160), 0.085)
build_dodge("dodge_1000", (230, 60, 60), (255, 170, 170), 0.050)
build_pacifist()
build_runs("runs_10", 1, (190, 120, 70))
build_runs("runs_100", 2, (205, 210, 220))
build_runs("runs_1000", 3, (255, 205, 90))
build_sprint()
build_no_hit()
build_no_bonus()
build_boulder_meister()

names = ["dodge_100", "dodge_1000", "pacifist", "runs_10", "runs_100", "runs_1000",
         "sprint", "no_hit", "no_bonus", "boulder_meister"]
cs = Image.new("RGB", (SIZE * 5, SIZE * 2), (20, 20, 20))
for i, n in enumerate(names):
    cs.paste(Image.open(f"{OUT}/{n}.png"), ((i % 5) * SIZE, (i // 5) * SIZE))
cs.save(f"{OUT}/_v11_contact_sheet.png")
print("wrote", ", ".join(n + ".png" for n in names), "to", OUT)
