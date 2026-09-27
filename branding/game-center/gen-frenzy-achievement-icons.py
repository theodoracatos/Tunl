# Generates the 2 Frenzy achievement icons (18.x, src/constants.js FRENZY_ACH_*):
# frenzy_first (the first star) and frenzy_double (two stars in one run). Same family as
# gen-v11-achievement-icons.py - its helpers are loaded from that file, without running
# its builds - with the game's own faceted five-point star (draw.js _coinFrenzy) as the
# body: facets lit from above, a white-hot core. 512x512 RGB PNG, no alpha.
# Run: python3 gen-frenzy-achievement-icons.py
# -> achievement-icons/{frenzy_first,frenzy_double}.png + _frenzy_contact_sheet.png
import math, os
from PIL import Image, ImageDraw, ImageFilter

_here = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(_here, "gen-v11-achievement-icons.py")).read()
exec(_src[:_src.index("\nbuild_dodge(")], globals())


def star(cx, cy, R, color):
    """draw.js _coinFrenzy: ten facets around the centre, the upper ones lit, a white core."""
    ov = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    r = R * 0.42
    P = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        q = r if i % 2 else R
        P.append((cx + math.cos(a) * q, cy + math.sin(a) * q))
    tone = lambda k: mix(color, (255, 255, 255), k) if k >= 0 else mix(color, (0, 0, 0), -k)
    for i in range(10):
        a, b = P[i], P[(i + 1) % 10]
        up = (a[1] + b[1]) / 2 < cy
        k = (0.55 if i % 2 else 0.3) if up else (-0.1 if i % 2 else -0.35)
        c = tone(k)
        od.polygon([(cx, cy), a, b], fill=(c[0], c[1], c[2], 255))
    edge = tone(0.5)
    od.line(P + [P[0]], fill=(edge[0], edge[1], edge[2], 255), width=max(2, int(R * 0.03)), joint="curve")
    ov = ov.filter(ImageFilter.GaussianBlur(SIZE * 0.0015))
    core = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(core).ellipse([cx - r * 0.6, cy - r * 0.6, cx + r * 0.6, cy + r * 0.6], fill=(255, 255, 255, 235))
    core = core.filter(ImageFilter.GaussianBlur(SIZE * 0.006))
    ov.alpha_composite(core)
    return ov


def build_first():
    glow_c = (112, 230, 255)
    canvas = base_canvas(glow_c, strength=0.6)
    R = SIZE * 0.16
    canvas = body_glow(canvas, BODY_C, R, glow_c, reach=2.2, strength=0.55, blur=0.06)
    canvas.alpha_composite(star(BODY_C[0], BODY_C[1], R, glow_c))
    canvas = add_ship(canvas, (190, 245, 255))
    save(canvas, "frenzy_first")


def build_double():
    glow_c = (200, 140, 255)
    canvas = base_canvas(glow_c, strength=0.62, r=SIZE * 0.36)
    R = SIZE * 0.15
    c1 = (BODY_C[0] + SIZE * 0.035, BODY_C[1] - SIZE * 0.02)
    c2 = (BODY_C[0] - SIZE * 0.13, BODY_C[1] + SIZE * 0.10)
    canvas = body_glow(canvas, c1, R, glow_c, reach=2.2, strength=0.5, blur=0.06)
    canvas.alpha_composite(star(c2[0], c2[1], R * 0.62, mix(glow_c, (255, 255, 255), 0.15)))
    canvas.alpha_composite(star(c1[0], c1[1], R, glow_c))
    canvas = add_ship(canvas, (230, 200, 255), ctrl=(0.26, 0.40))
    save(canvas, "frenzy_double")


build_first()
build_double()
names = ["frenzy_first", "frenzy_double"]
cs = Image.new("RGB", (SIZE * 2, SIZE), (20, 20, 20))
for i, n in enumerate(names):
    cs.paste(Image.open(f"{OUT}/{n}.png"), (i * SIZE, 0))
cs.save(f"{OUT}/_frenzy_contact_sheet.png")
print("wrote", ", ".join(n + ".png" for n in names), "to", OUT)
