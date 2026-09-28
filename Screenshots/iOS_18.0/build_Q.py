"""Clip Q (2026-09-28): 10 s, second laser in frame 0 -> crash -> debrief. Derived from
build_store916.py (9:16 store montage, clip P's look); source montage_q.mp4 (montage_q.sh).

Source: montage1912.mp4 (montage.sh) = the 28.9 s store cut at native 1912x880, full range,
so clip P's crop/key coordinates apply unchanged.
Timeline (montage seconds):
  0.00-6.40   title + city approach  -> landscape STRIP (full frame, too wide for the panel)
  6.40-24.65  gameplay               -> ship PANEL + live score pill + milestones laid back on
  24.65-28.90 debriefing             -> restacked for 9:16 (left block over right block, one card)
The strip/panel switches sit exactly on montage cuts, so no crossfade is needed.
Score: 3-digit crop (frenzy star + digits) until 1000 at 18.25 s, then a 4-digit crop.
Milestone windows were measured by gold-pixel count in the milestone region, not guessed.
"""
import os, subprocess
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
D = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(D, "montage_q.mp4")
TMP = os.path.join(D, "build")
OUT = os.path.join(os.path.dirname(os.path.dirname(D)), "clip_Q_w635.mp4")
FONT = "/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf"
os.makedirs(TMP, exist_ok=True)

DUR = 10.0
G0, G1 = 0.0, 7.22                       # gameplay window (beam in frame 0 -> crash)
DIG_SWITCH = 0.0                         # 4-digit score throughout
FREEZE_T = 6.60                          # the game blanks the score at death; hold its last frame (1156)
URL_TEXT = "free at flytunl.ch"
PILL = dict(x0=260, y0=250, x1=820, y1=400)
URL_CY = 452
PANEL_Y0, PANEL_H = 498, 1262
FG = (550, 880, 108, 0)
DIG3 = (296, 88, 770, 30)                # frenzy star (x ~780) + 3 digits, stops before the badge
DIG4 = (280, 88, 820, 30)                # 4 digits x 830-1085, badge starts ~1119
DSCALE = 1.12
DIG3_SHIFT = round(((864 + 1043) / 2 - (DIG3[2] + DIG3[0] / 2)) * DSCALE)
DIG4_SHIFT = round(((830 + 1085) / 2 - (DIG4[2] + DIG4[0] / 2)) * DSCALE)
MILE = (640, 190, 640, 190)
MSCALE = 1.2
MILE_Y = 560
MILES = []                               # no milestone in this window
SW = 1020                                # strip width
SH = round(SW * 880 / 1912)
SX, SY = (W - SW) // 2, 760
# debriefing restacked for 9:16: left block (world, score, badge, chips) over the right block
# (BEST, TODAY TOP, stats), inside one card; crops are feathered so they sit on the card fill
CA = (980, 524, 60, 56)                  # left block, source px
CB = (758, 324, 1072, 116)               # right block, source px
CS = 0.96
CAW, CAH = round(CA[0] * CS), round(CA[1] * CS)
CBW, CBH = round(CB[0] * CS), round(CB[1] * CS)
CAX, CAY = (W - CAW) // 2, 668
CBX, CBY = (W - CBW) // 2, CAY + CAH + 14
CARD = dict(x0=46, y0=CAY - 22, x1=W - 46, y1=CBY + CBH + 16, r=30)
PILL_TEXT = [(-2.0, -1.0, "LASER + FRENZY"), (G1, DUR, "HOW FAR DO YOU GET?")]   # no intro

pw = round(FG[0] / FG[1] * PANEL_H)
px0 = (W - pw) // 2
panel = dict(x0=px0, y0=PANEL_Y0, x1=px0 + pw, y1=PANEL_Y0 + PANEL_H, r=40)
strip = dict(x0=SX, y0=SY, x1=SX + SW, y1=SY + SH, r=28)


def rr_mask(w, h, r, path):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    m.save(path)


def glow_png(box, path):
    g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(g).rounded_rectangle([box["x0"] - 3, box["y0"] - 3, box["x1"] + 3, box["y1"] + 3],
                                        radius=box["r"] + 3, outline=(120, 230, 255, 220), width=4)
    out = g.filter(ImageFilter.GaussianBlur(6))
    ImageDraw.Draw(out).rounded_rectangle([box["x0"] - 1, box["y0"] - 1, box["x1"] + 1, box["y1"] + 1],
                                          radius=box["r"] + 1, outline=(180, 240, 255, 235), width=2)
    out.save(path)


def spaced(img, text, font, cy, fill, sp):
    ws = [font.getlength(ch) for ch in text]
    tot = sum(ws) + sp * (len(text) - 1)
    txt = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bb = font.getbbox("HOW0")
    ty = cy - (bb[1] + bb[3]) / 2
    x = (W - tot) / 2
    for ch, w_ in zip(text, ws):
        ImageDraw.Draw(txt).text((x, ty), ch, font=font, fill=fill)
        ImageDraw.Draw(sh).text((x + 2, ty + 3), ch, font=font, fill=(0, 0, 0, 200))
        x += w_ + sp
    img.alpha_composite(txt.filter(ImageFilter.GaussianBlur(7)))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(2)))
    img.alpha_composite(txt)


def feather(w, h, path, inset=10, blur=8):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([inset, inset, w - 1 - inset, h - 1 - inset], radius=18, fill=255)
    m.filter(ImageFilter.GaussianBlur(blur)).save(path)


feather(CAW, CAH, f"{TMP}/mask_ca.png")
feather(CBW, CBH, f"{TMP}/mask_cb.png")
card = Image.new("RGBA", (W, H), (0, 0, 0, 0))
cg = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(cg).rounded_rectangle([CARD["x0"] - 2, CARD["y0"] - 2, CARD["x1"] + 2, CARD["y1"] + 2],
                                     radius=CARD["r"] + 2, outline=(236, 110, 170, 160), width=5)
card.alpha_composite(cg.filter(ImageFilter.GaussianBlur(7)))
ImageDraw.Draw(card).rounded_rectangle([CARD["x0"], CARD["y0"], CARD["x1"], CARD["y1"]], radius=CARD["r"],
                                       fill=(9, 8, 17, 255), outline=(200, 90, 140, 230), width=2)
card.save(f"{TMP}/card.png")
rr_mask(pw, PANEL_H, panel["r"], f"{TMP}/mask_panel.png")
rr_mask(SW, SH, strip["r"], f"{TMP}/mask_strip.png")
glow_png(panel, f"{TMP}/glow_panel.png")
glow_png(strip, f"{TMP}/glow_strip.png")

# always-on layer: top/bottom vignette, the pill, the URL line
ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
vd = ImageDraw.Draw(ov)
for i in range(0, 490):
    a = 245 if i < 160 else int(245 * max(0.0, (490 - i) / 330))
    vd.line([(0, i), (W, i)], fill=(0, 0, 0, a))
for i in range(1764, H):
    vd.line([(0, i), (W, i)], fill=(0, 0, 0, min(245, int(245 * (i - 1764) / 90))))
halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ImageDraw.Draw(halo).rounded_rectangle([PILL["x0"], PILL["y0"], PILL["x1"], PILL["y1"]], radius=75,
                                       outline=(120, 230, 255, 120), width=6)
ov.alpha_composite(halo.filter(ImageFilter.GaussianBlur(9)))
d = ImageDraw.Draw(ov)
d.rounded_rectangle([PILL["x0"], PILL["y0"], PILL["x1"], PILL["y1"]], radius=75, fill=(5, 7, 14, 215))
d.rounded_rectangle([PILL["x0"], PILL["y0"], PILL["x1"], PILL["y1"]], radius=75, outline=(120, 230, 255, 190), width=2)
spaced(ov, URL_TEXT, ImageFont.truetype(FONT, 58), URL_CY, (79, 214, 224, 255), 6)
ov.save(f"{TMP}/common.png")

# static pill texts for the strip phases
pill_cy = (PILL["y0"] + PILL["y1"]) // 2
for k, (_, _, text) in enumerate(PILL_TEXT):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    size = 52
    while ImageFont.truetype(FONT, size).getlength(text) + 3 * len(text) > (PILL["x1"] - PILL["x0"]) - 70:
        size -= 2
    spaced(im, text, ImageFont.truetype(FONT, size), pill_cy, (245, 250, 251, 255), 3)
    im.save(f"{TMP}/pill{k}.png")

G = f"between(t,{G0},{G1})"
S = f"not(between(t,{G0},{G1}))"
INTRO = "0"                              # no intro strip in clip Q
OUTRO = f"between(t,{G1},{DUR})"
fw, fh, fx, fy = FG
mw, mh, mx, my = MILE
n = len(MILES)
gold = "clip((min(r(X,Y),g(X,Y))-b(X,Y)-30)*4,0,255)*gt(g(X,Y),0.78*r(X,Y))"
digkey = ("255*gt(0.3*r(X,Y)+0.59*g(X,Y)+0.11*b(X,Y),165)*lt(g(X,Y)-r(X,Y),30)"
          "*lt(b(X,Y)-g(X,Y),50)*lt(r(X,Y)-g(X,Y),75)")


def dig(label, box, out):
    dw, dh, dx, dy = box
    return (f"[{label}]crop={dw}:{dh}:{dx}:{dy},format=rgba,"
            f"geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='{digkey}',"
            f"scale=iw*{DSCALE}:-1:flags=lanczos[{out}];")


fc = (
    f"[1:v]format=gray[mpan];[2:v]format=gray[mstr];[8:v]format=gray[mca];[9:v]format=gray[mcb];"
    f"[0:v]split={7 + n}[s0][s1][s2][s3][s4][s5][s6]" + "".join(f"[m{i}]" for i in range(n)) + ";"
    f"[s0]scale=4172:1920,crop=1080:1920:(iw-1080)/2:0,boxblur=24:8,split[bga][bgb];"
    f"[bga]eq=brightness=-0.22:saturation=0.7[bgp];"
    f"[bgb]boxblur=40:4,eq=brightness=-0.45:saturation=0.6[bgs];"
    f"[bgp][bgs]overlay=0:0:enable='{S}'[bg];"
    f"[s1]crop={fw}:{fh}:{fx}:{fy},scale={pw}:{PANEL_H}[fgraw];[fgraw][mpan]alphamerge[fgm];"
    f"[bg][fgm]overlay={panel['x0']}:{panel['y0']}:enable='{G}'[a1];"
    f"[s2]scale={SW}:{SH}:flags=lanczos[stw];[stw][mstr]alphamerge[stm];"
    f"[a1][stm]overlay={SX}:{SY}:enable='{INTRO}'[a2a];"
    f"[a2a][10:v]overlay=0:0:enable='{OUTRO}'[a2b];"
    f"[s5]crop={CA[0]}:{CA[1]}:{CA[2]}:{CA[3]},scale={CAW}:{CAH}:flags=lanczos[caw];[caw][mca]alphamerge[cam];"
    f"[s6]crop={CB[0]}:{CB[1]}:{CB[2]}:{CB[3]},scale={CBW}:{CBH}:flags=lanczos[cbw];[cbw][mcb]alphamerge[cbm];"
    f"[a2b][cam]overlay={CAX}:{CAY}:enable='{OUTRO}'[a2c];"
    f"[a2c][cbm]overlay={CBX}:{CBY}:enable='{OUTRO}'[a2];"
    f"[a2][3:v]overlay=0:0:enable='{G}'[a3];"
    f"[a3][4:v]overlay=0:0:enable='{INTRO}'[a4];"
    f"[a4][5:v]overlay=0:0[a5];"
    f"[a5][6:v]overlay=0:0:enable='between(t,{PILL_TEXT[0][0]},{PILL_TEXT[0][1]})'[a6];"
    f"[a6][7:v]overlay=0:0:enable='between(t,{PILL_TEXT[1][0]},{PILL_TEXT[1][1]})'[a7];"
    + dig("s3", DIG3, "d3") + dig("s4", DIG4, "d4") +
    f"[a7][d3]overlay=(W-w)/2-{DIG3_SHIFT}:{pill_cy}-h/2:enable='between(t,{G0},{DIG_SWITCH})'[a8];"
    f"[a8][d4]overlay=(W-w)/2-{DIG4_SHIFT}:{pill_cy}-h/2:enable='between(t,{DIG_SWITCH},{FREEZE_T})'[a9];"
    + dig("11:v", DIG4, "df") +
    f"[a9][df]overlay=(W-w)/2-{DIG4_SHIFT}:{pill_cy}-h/2:enable='between(t,{FREEZE_T},{G1})'[b0];"
)
for i, (t_on, t_off) in enumerate(MILES):
    fc += (f"[m{i}]crop={mw}:{mh}:{mx}:{my},format=rgba,"
           f"geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='{gold}',scale=iw*{MSCALE}:-1:flags=lanczos,split[mt{i}][ms{i}];"
           f"[ms{i}]geq=r=0:g=0:b=0:a='alpha(X,Y)*0.8',boxblur=10:2[msh{i}];"
           f"[b{i}][msh{i}]overlay=(W-w)/2+4:{MILE_Y}+6:enable='between(t,{t_on},{t_off})'[c{i}];"
           f"[c{i}][mt{i}]overlay=(W-w)/2:{MILE_Y}:enable='between(t,{t_on},{t_off})'[b{i + 1}];")
fc += f"[b{n}]format=yuv420p[v];[0:a]afade=t=out:st={DUR - 0.5}:d=0.5[a]"

loop = lambda p: ["-loop", "1", "-t", str(DUR), "-i", p]
subprocess.run(["ffmpeg", "-y", "-v", "error", "-t", str(DUR), "-i", SRC,
                *loop(f"{TMP}/mask_panel.png"), *loop(f"{TMP}/mask_strip.png"),
                *loop(f"{TMP}/glow_panel.png"), *loop(f"{TMP}/glow_strip.png"),
                *loop(f"{TMP}/common.png"), *loop(f"{TMP}/pill0.png"), *loop(f"{TMP}/pill1.png"),
                *loop(f"{TMP}/mask_ca.png"), *loop(f"{TMP}/mask_cb.png"), *loop(f"{TMP}/card.png"),
                *loop(f"{TMP}/q_freeze.png"),
                "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-color_range", "tv",
                "-c:a", "aac", "-b:a", "160k", "-fps_mode", "cfr", "-r", "30", "-movflags", "+faststart", OUT],
               check=True)
print("wrote", OUT)
