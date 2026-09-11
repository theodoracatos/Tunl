# Generates the 2 flight-duration achievement icons (src/constants.js
# FLIGHT_ACHIEVEMENTS): "One Minute" (tunl_ach_flight_1min) and "Two Minutes"
# (tunl_ach_flight_2min). Same visual language as gen-distance-achievement-icons.py
# (shared radial glow / body-glow / ship helpers) but the "body" is a glowing
# stopwatch dial instead of a moon/sun sphere, with the sweep hand/arc showing
# one full lap for 1min vs two overlapping laps for 2min - so the pair reads as a
# tier at a glance, same as the moon-vs-sun size/color escalation. 512x512 RGB
# PNG, no alpha (ASC / Play Console requirement).
# Run: python3 gen-flight-achievement-icons.py
# -> achievement-icons/flight_1min.png, flight_2min.png + _flight_contact_sheet.png
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
    """Dashed quadratic arc from p0 to the dial centre p2, brighter near the ship."""
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


CX = CY = SIZE / 2
SHIP_POS = (SIZE * 0.185, SIZE * 0.83)


def dial_face(cx, cy, R, rim_color, face_color):
    """Stopwatch dial: dark face, glowing rim ring, 12 tick marks."""
    ov = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    od.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(face_color[0], face_color[1], face_color[2], 255))
    ring_w = R * 0.075
    od.ellipse([cx - R, cy - R, cx + R, cy + R], outline=rim_color, width=int(ring_w))
    for i in range(12):
        a = i / 12 * 2 * math.pi - math.pi / 2
        r0 = R * (0.82 if i % 3 else 0.72)
        r1 = R * 0.90
        od.line([(cx + math.cos(a) * r0, cy + math.sin(a) * r0),
                 (cx + math.cos(a) * r1, cy + math.sin(a) * r1)],
                fill=mix(rim_color, (255, 255, 255), 0.3), width=int(R * (0.035 if i % 3 else 0.05)))
    # stem/crown at top
    stem_w = R * 0.16
    od.rounded_rectangle([cx - stem_w / 2, cy - R * 1.16, cx + stem_w / 2, cy - R * 0.92],
                          radius=stem_w * 0.4, fill=rim_color)
    return ov


def sweep_hand(cx, cy, R, laps, hue):
    """A glowing arc sweeping clockwise from 12 o'clock - `laps` full turns,
    drawn as `laps` overlapping trails so 2min visibly reads as "twice around"."""
    ov = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    for lap in range(laps):
        od = ImageDraw.Draw(ov)
        N = 60
        for i in range(N):
            t0 = i / N
            t1 = (i + 0.8) / N
            a0 = t0 * 2 * math.pi - math.pi / 2
            a1 = t1 * 2 * math.pi - math.pi / 2
            r = R * (0.62 - lap * 0.10)
            p0 = (cx + math.cos(a0) * r, cy + math.sin(a0) * r)
            p1 = (cx + math.cos(a1) * r, cy + math.sin(a1) * r)
            alpha = int(70 + 170 * t0)
            od.line([p0, p1], fill=(hue[0], hue[1], hue[2], alpha), width=int(R * 0.045))
        # hand pointer at the lap's current end
        a_end = 2 * math.pi - math.pi / 2 if lap < laps - 1 else -math.pi / 2 + 0.001
        r = R * (0.62 - lap * 0.10)
        hx, hy = cx + math.cos(a_end) * r, cy + math.sin(a_end) * r
        od.ellipse([hx - R * 0.05, hy - R * 0.05, hx + R * 0.05, hy + R * 0.05],
                   fill=mix(hue, (255, 255, 255), 0.5) + (255,))
    od = ImageDraw.Draw(ov)
    od.ellipse([cx - R * 0.06, cy - R * 0.06, cx + R * 0.06, cy + R * 0.06],
               fill=mix(hue, (255, 255, 255), 0.6) + (255,))
    ov = ov.filter(ImageFilter.GaussianBlur(SIZE * 0.003))
    return ov


def build(name, laps, hue, glow_c, face_c):
    body_c = (SIZE * 0.685, SIZE * 0.305)
    R = SIZE * 0.185
    canvas = radial_bg(mix(BG_DARK, glow_c, 0.30), glow_strength=0.55,
                       center=body_c, r=SIZE * 0.32, blur=0.22).convert("RGBA")
    canvas = body_glow(canvas, body_c, R, glow_c, reach=2.3, strength=0.55, blur=0.06)
    canvas = trajectory(canvas, SHIP_POS, body_c, mix(glow_c, (255, 255, 255), 0.25), ctrl=(0.29, 0.34))
    face = dial_face(body_c[0], body_c[1], R, glow_c, face_c)
    canvas.alpha_composite(face)
    canvas.alpha_composite(sweep_hand(body_c[0], body_c[1], R, laps, hue))
    hx, hy = bezier(SHIP_POS, (SIZE * 0.29, SIZE * 0.34), body_c, 0.05)
    canvas = ship(canvas, SHIP_POS, math.atan2(hy - SHIP_POS[1], hx - SHIP_POS[0]), mix(hue, (255, 255, 255), 0.35))
    canvas.convert("RGB").save(f"{OUT}/{name}.png")


# 1min: fresh cyan/teal, single lap. 2min: deeper violet/magenta, two laps - same
# "rarer = richer/hotter" escalation as dist_moon (silver) -> dist_sun (gold/orange).
build("flight_1min", 1, hue=(140, 235, 255), glow_c=(60, 190, 220), face_c=(10, 22, 34))
build("flight_2min", 2, hue=(220, 150, 255), glow_c=(150, 70, 220), face_c=(20, 10, 34))

cs = Image.new("RGB", (SIZE * 2, SIZE), (20, 20, 20))
for i, n in enumerate(["flight_1min", "flight_2min"]):
    cs.paste(Image.open(f"{OUT}/{n}.png"), (i * SIZE, 0))
cs.save(f"{OUT}/_flight_contact_sheet.png")
print("wrote flight_1min.png, flight_2min.png to", OUT)
