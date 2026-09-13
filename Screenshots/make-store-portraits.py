#!/usr/bin/env python3
"""TUNL 12.0 App Store portrait screenshots - layout "B" (strip + zoom).

TUNL is landscape-only, so every raw capture is a 2868x1320 iPhone 17 Pro Max
simulator shot. Each portrait frame shows:

  - a headline block (Courier New Bold for Latin/Cyrillic, a system font for
    ja/ko/zh/ar/hi) with one accent line in the day colour,
  - the FULL landscape capture as an edge-to-edge strip (nothing cropped),
  - a big zoom panel on the one thing that slide is about (ship, warp, shield,
    score), linked to a lens rectangle on the strip,
  - the TUNL wordmark.

Colours are the Rhodia day palette (constants.js WEEKDAY_PALETTES) - the same
rose as the in-game PLAY AGAIN button, because every raw capture is a Rhodia
day. Replaced the 7.0-10.x "cave corridor" frames (make-portrait-frames.py):
those showed the landscape shot at ~20% of the canvas and drew the pre-12.0
needle ship by hand.

Inputs : Screenshots/iOS_12.0/Simulator Screenshot*.png, in filename (= capture
         time) order - that order IS the App Store order.
Outputs: Screenshots/iOS_12.0/<locale>/portrait-6.9in/0N.png (1320x2868)
         Screenshots/iOS_12.0/<locale>/portrait-6.5in/0N.png (1284x2778)
         Screenshots/iOS_12.0/<locale>/play-9x16/0N.png     (1080x1920)
Google Play only accepts exactly 16:9 / 9:16 phone screenshots, so the Play set
is laid out on a shorter 1320x2347 canvas (smaller zoom panel) and scaled down,
not squashed from the App Store frames.

The in-game UI inside the captures stays English in every locale; only the
headline + subhead are localized.

Run: python3 Screenshots/make-store-portraits.py [locale,locale,...]
Needs Pillow (with raqm for ar/hi) and rsvg-convert.
"""

import glob
import math
import os
import random
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
SRC_DIR = os.path.join(HERE, "iOS_12.0")
W, H = 1320, 2868

VOID = (6, 5, 12)
WALL = (48, 22, 34)          # Rhodia rock
STAL = (40, 18, 28)
ROSE = (255, 122, 176)       # Rhodia wallBase
ROSE_EDGE = (255, 140, 190)  # Rhodia stalEdge
INK = (240, 238, 248)
DIM = (170, 160, 190)

COURIER = "/System/Library/Fonts/Supplemental/Courier New Bold.ttf"
RAQM = ImageFont.Layout.RAQM
FONTS = {  # locale -> (path, ttc index, layout engine, direction, headline px)
    "ja": ("/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc", 0, None, None, 96),
    "ko": ("/System/Library/Fonts/AppleSDGothicNeo.ttc", 4, None, None, 98),
    "zh": ("/System/Library/Fonts/STHeiti Medium.ttc", 0, None, None, 98),
    "ar": ("/System/Library/Fonts/GeezaPro.ttc", 1, RAQM, "rtl", 100),
    "hi": ("/System/Library/Fonts/Kohinoor.ttc", 3, RAQM, "ltr", 92),
}

# Per-slide zoom region in capture pixels: (centre x, centre y, width). Height
# follows from the panel aspect. Tuned against the five 2026-09-13 captures -
# re-check them if the raw shots are replaced.
ZOOM = [
    (1719, 745, 880),    # title: the ship in its selector ring
    (640, 880, 560),     # launch: ship climbing + coin pickup
    (1060, 600, 1180),   # warp: ship, speed streaks, score + milestone
    (700, 560, 640),     # deep: shield bubble + ammo
    (700, 640, 1180),    # debriefing: score, bar, flown profile
]
# The 9:16 Play canvas has a wider, shorter zoom panel, so a few regions need
# re-centring to keep their subject (ring, score, WORLD header) inside it.
ZOOM_COMPACT = {0: (1719, 778, 1180), 2: (1060, 470, 1180), 4: (700, 505, 1180)}
ACCENT = [1, 0, 0, 1, 1]   # which headline line is rose

COPY = {
    "en": [
        (["One cave.", "Every player.", "Every day."], "A brand-new world every day"),
        (["Hold to climb.", "Let go to fall."], "One touch. That's the whole game."),
        (["Hit the warp.", "Feel the rush."], "Fly through the ring for pure speed"),
        (["Shields up.", "Go deeper."], "Shields, ammo, magnets and more"),
        (["Crash.", "Check your rank.", "Go again."], "The whole world flies the same cave"),
    ],
    "de": [
        (["Eine Höhle.", "Alle Spieler.", "Jeden Tag."], "Jeden Tag eine brandneue Welt"),
        (["Halten zum Steigen.", "Loslassen zum Fallen."], "Ein Finger. Mehr braucht es nicht."),
        (["Ab in den Warp.", "Spür den Rausch."], "Durch den Ring zu purem Tempo"),
        (["Schilde hoch.", "Tiefer rein."], "Schilde, Munition, Magnete und mehr"),
        (["Crash.", "Rang checken.", "Nochmal."], "Die ganze Welt fliegt dieselbe Höhle"),
    ],
    "fr": [
        (["Une grotte.", "Tous les joueurs.", "Chaque jour."], "Un monde tout neuf chaque jour"),
        (["Maintiens pour monter.", "Relâche pour tomber."], "Un doigt. C'est tout le jeu."),
        (["Prends le warp.", "Sens la vitesse."], "Traverse l'anneau à pleine vitesse"),
        (["Boucliers levés.", "Va plus loin."], "Boucliers, munitions, aimants et plus"),
        (["Crash.", "Vois ton rang.", "Rejoue."], "Le monde entier vole dans la même grotte"),
    ],
    "it": [
        (["Una grotta.", "Tutti i giocatori.", "Ogni giorno."], "Un mondo nuovo ogni giorno"),
        (["Tieni per salire.", "Lascia per scendere."], "Un dito. Tutto qui."),
        (["Entra nel warp.", "Senti la velocità."], "Attraversa l'anello a tutta velocità"),
        (["Scudi attivi.", "Vai più a fondo."], "Scudi, munizioni, magneti e altro"),
        (["Schianto.", "Guarda la classifica.", "Riprova."], "Tutto il mondo vola nella stessa grotta"),
    ],
    "es": [
        (["Una cueva.", "Todos los jugadores.", "Cada día."], "Un mundo nuevo cada día"),
        (["Mantén para subir.", "Suelta para caer."], "Un dedo. Así de simple."),
        (["Entra en el warp.", "Siente la velocidad."], "Cruza el anillo a toda velocidad"),
        (["Escudos arriba.", "Más profundo."], "Escudos, munición, imanes y más"),
        (["Choca.", "Mira tu ranking.", "Otra vez."], "Todo el mundo vuela la misma cueva"),
    ],
    "pt-BR": [
        (["Uma caverna.", "Todos os jogadores.", "Todo dia."], "Um mundo novo todo dia"),
        (["Segure para subir.", "Solte para cair."], "Um toque. É o jogo inteiro."),
        (["Entre no warp.", "Sinta a velocidade."], "Atravesse o anel a toda velocidade"),
        (["Escudos ativos.", "Vá mais fundo."], "Escudos, munição, ímãs e mais"),
        (["Bateu.", "Veja seu ranking.", "Jogue de novo."], "O mundo inteiro voa na mesma caverna"),
    ],
    "ja": [
        (["洞窟はひとつ。", "世界中で同じ。", "毎日新しく。"], "毎日まったく新しい世界"),
        (["押して上昇。", "離して降下。"], "指一本。それだけのゲーム。"),
        (["ワープに飛び込め。", "スピードを感じろ。"], "リングをくぐって一気に加速"),
        (["シールド全開。", "もっと奥へ。"], "シールド、弾薬、マグネットなど"),
        (["墜落。", "ランクを確認。", "もう一回。"], "世界中が同じ洞窟を飛ぶ"),
    ],
    "ko": [
        (["동굴 하나.", "모든 플레이어.", "매일."], "매일 완전히 새로운 세계"),
        (["누르면 상승.", "떼면 하강."], "손가락 하나면 충분하다"),
        (["워프로 돌진.", "속도를 느껴라."], "고리를 통과해 폭발적인 가속"),
        (["실드 가동.", "더 깊이."], "실드, 탄약, 자석 그리고 더"),
        (["추락.", "랭킹 확인.", "다시 도전."], "전 세계가 같은 동굴을 난다"),
    ],
    "zh": [
        (["一個洞窟。", "所有玩家。", "每一天。"], "每天一個全新世界"),
        (["按住上升。", "放開下降。"], "一根手指，就是整個遊戲"),
        (["衝進傳送環。", "感受速度。"], "穿越光環，瞬間加速"),
        (["護盾啟動。", "飛得更深。"], "護盾、彈藥、磁鐵等等"),
        (["墜毀。", "查看排名。", "再飛一次。"], "全世界飛同一個洞窟"),
    ],
    "ru": [
        (["Одна пещера.", "Все игроки.", "Каждый день."], "Каждый день новый мир"),
        (["Держи - взлетай.", "Отпусти - падай."], "Один палец. Вот и вся игра."),
        (["Влетай в варп.", "Почувствуй скорость."], "Сквозь кольцо на полной скорости"),
        (["Щиты подняты.", "Глубже."], "Щиты, патроны, магниты и не только"),
        (["Разбился.", "Глянь рейтинг.", "Ещё раз."], "Весь мир летит по одной пещере"),
    ],
    "ar": [
        (["كهف واحد.", "كل اللاعبين.", "كل يوم."], "عالم جديد كليًا كل يوم"),
        (["اضغط للصعود.", "اترك للهبوط."], "إصبع واحد. هذه هي اللعبة كلها."),
        (["انطلق عبر البوابة.", "اشعر بالسرعة."], "اعبر الحلقة بسرعة خاطفة"),
        (["الدروع جاهزة.", "تعمّق أكثر."], "دروع وذخيرة ومغناطيس والمزيد"),
        (["تحطمت.", "شاهد ترتيبك.", "حاول مجددًا."], "العالم كله يطير في الكهف نفسه"),
    ],
    "tr": [
        (["Tek mağara.", "Tüm oyuncular.", "Her gün."], "Her gün yepyeni bir dünya"),
        (["Basılı tut, yüksel.", "Bırak, düş."], "Tek parmak. Oyunun hepsi bu."),
        (["Warp'a gir.", "Hızı hisset."], "Halkadan geç, tam gaz ilerle"),
        (["Kalkanlar açık.", "Daha derine."], "Kalkan, cephane, mıknatıs ve fazlası"),
        (["Çarptın.", "Sıralamana bak.", "Tekrar uç."], "Tüm dünya aynı mağarada uçuyor"),
    ],
    "id": [
        (["Satu gua.", "Semua pemain.", "Setiap hari."], "Dunia baru setiap hari"),
        (["Tahan untuk naik.", "Lepas untuk turun."], "Satu jari. Itu seluruh gamenya."),
        (["Masuk ke warp.", "Rasakan lajunya."], "Tembus cincin dengan kecepatan penuh"),
        (["Perisai aktif.", "Terbang lebih dalam."], "Perisai, amunisi, magnet, dan lainnya"),
        (["Tabrakan.", "Cek peringkatmu.", "Coba lagi."], "Seluruh dunia terbang di gua yang sama"),
    ],
    "pl": [
        (["Jedna jaskinia.", "Wszyscy gracze.", "Każdego dnia."], "Każdego dnia zupełnie nowy świat"),
        (["Trzymaj, by wznosić.", "Puść, by opadać."], "Jeden palec. To cała gra."),
        (["Wleć w warp.", "Poczuj prędkość."], "Przez pierścień na pełnej prędkości"),
        (["Tarcze w górę.", "Leć głębiej."], "Tarcze, amunicja, magnesy i więcej"),
        (["Rozbity.", "Sprawdź ranking.", "Leć jeszcze raz."], "Cały świat lata w tej samej jaskini"),
    ],
    "hi": [
        (["एक गुफा।", "हर खिलाड़ी।", "हर दिन।"], "हर दिन एक नई दुनिया"),
        (["दबाएं, ऊपर जाएं।", "छोड़ें, नीचे आएं।"], "एक उंगली। बस यही पूरा खेल है।"),
        (["वार्प में घुसें।", "रफ़्तार महसूस करें।"], "रिंग से गुज़रें, पूरी रफ़्तार से"),
        (["शील्ड चालू।", "और गहराई में।"], "शील्ड, गोला-बारूद, मैग्नेट और बहुत कुछ"),
        (["टकरा गए।", "अपनी रैंक देखें।", "फिर से उड़ें।"], "पूरी दुनिया एक ही गुफा में उड़ती है"),
    ],
}


# ------------------------------------------------------------------ captures
def load_captures():
    files = sorted(glob.glob(os.path.join(SRC_DIR, "Simulator Screenshot*.png")))
    if len(files) != 5:
        sys.exit("expected 5 raw captures in %s, found %d" % (SRC_DIR, len(files)))
    return [remove_island(Image.open(f).convert("RGB")) for f in files]


def remove_island(img):
    """Paint out the Dynamic Island pill (landscape: right edge, vertically
    centred). Interpolates across it from clean pixels just outside - vertically
    when a vertical line (the debriefing card border) runs through it, otherwise
    horizontally so speed streaks and walls stay continuous."""
    a = np.array(img).astype(float)
    y0, y1, x0, x1 = 460, 860, 2698, 2846
    region = a[y0:y1, x0:x1]
    if (region.sum(axis=2) < 6).sum() < 2000:      # no pill (e.g. already cleaned)
        return img
    col_std = a[y0 - 40:y0, x0:x1].std(axis=0).mean()
    row_std = a[y0 - 40:y0, x0:x1].std(axis=1).mean()
    if col_std < row_std:                        # structure is vertical
        top, bot = a[y0 - 1, x0:x1].copy(), a[y1 + 1, x0:x1].copy()
        for y in range(y0, y1 + 1):
            t = (y - y0) / (y1 - y0)
            a[y, x0:x1] = top * (1 - t) + bot * t
    else:
        left, right = a[y0:y1 + 1, x0 - 1].copy(), a[y0:y1 + 1, x1].copy()
        for x in range(x0, x1):
            t = (x - x0) / (x1 - x0)
            a[y0:y1 + 1, x] = left * (1 - t) + right * t
    return Image.fromarray(a.clip(0, 255).astype("uint8"))


# ------------------------------------------------------------------ drawing
def fnt(locale, px):
    if locale in FONTS:
        path, idx, engine, _, _ = FONTS[locale]
        return ImageFont.truetype(path, px, index=idx, layout_engine=engine or ImageFont.Layout.BASIC)
    return ImageFont.truetype(COURIER, px)


def direction(locale):
    return FONTS[locale][3] if locale in FONTS else None


def wall_x(side, y, seed, inset):
    wob = math.sin(y * 0.0031 + seed) * 26 + math.sin(y * 0.0093 + seed * 1.7) * 12
    return inset + wob if side == "L" else W - inset + wob


def corridor(seed, inset=58, spikes=7):
    img = Image.new("RGBA", (W, H), (*VOID, 255))
    d = ImageDraw.Draw(img, "RGBA")
    rnd = random.Random(seed)
    for y in range(0, H + 3, 3):
        d.rectangle([0, y, wall_x("L", y, seed, inset), y + 3], fill=(*WALL, 255))
        d.rectangle([wall_x("R", y, seed, inset), y, W, y + 3], fill=(*WALL, 255))
    for _ in range(spikes):
        y = rnd.randint(200, H - 200)
        side = rnd.choice("LR")
        wx = wall_x(side, y, seed, inset)
        ln, hw = rnd.randint(60, 150), rnd.randint(22, 34)
        tip = wx + ln if side == "L" else wx - ln
        d.polygon([(wx, y - hw), (wx, y + hw), (tip, y)], fill=(*STAL, 255))
        d.line([(wx, y - hw), (tip, y), (wx, y + hw)], fill=(*ROSE_EDGE, 120), width=3)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    for side in "LR":
        g.line([(wall_x(side, y, seed, inset), y) for y in range(0, H + 12, 12)],
               fill=(*ROSE, 150), width=14)
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(14)))
    for side in "LR":
        d.line([(wall_x(side, y, seed, inset), y) for y in range(0, H + 12, 12)],
               fill=(*ROSE_EDGE, 210), width=3)
    for _ in range(260):
        x, y = rnd.uniform(inset + 40, W - inset - 40), rnd.uniform(0, H)
        s = rnd.choice([1, 1, 2])
        d.ellipse([x, y, x + s, y + s], fill=(220, 215, 255, rnd.randint(30, 140)))
    return img


def text_block(img, locale, lines, accent, sub, top, maxw=1110):
    d = ImageDraw.Draw(img)
    dr = direction(locale)
    size = FONTS[locale][4] if locale in FONTS else 104
    while size > 60 and max(d.textlength(l, font=fnt(locale, size), direction=dr) for l in lines) > maxw:
        size -= 2
    f = fnt(locale, size)
    lh = int(size * 1.22)
    y = top
    for i, line in enumerate(lines):
        if i == accent:
            gl = Image.new("RGBA", img.size, (0, 0, 0, 0))
            ImageDraw.Draw(gl).text((W / 2, y), line, font=f, fill=(*ROSE, 160), anchor="ma", direction=dr)
            img.alpha_composite(gl.filter(ImageFilter.GaussianBlur(18)))
        d.text((W / 2, y), line, font=f, fill=ROSE if i == accent else INK, anchor="ma", direction=dr)
        y += lh
    ss = 42
    while ss > 28 and d.textlength(sub, font=fnt(locale, ss), direction=dr) > maxw:
        ss -= 2
    d.text((W / 2, y + 22), sub, font=fnt(locale, ss), fill=DIM, anchor="ma", direction=dr)
    return y + 22 + int(ss * 1.25)


def rounded(im, r):
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=r, fill=255)
    out = im.convert("RGBA")
    out.putalpha(m)
    return out


def glow_rect(img, box, r, width=8, blur=26, alpha=170):
    gl = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(gl).rounded_rectangle(box, radius=r, outline=(*ROSE, alpha), width=width)
    img.alpha_composite(gl.filter(ImageFilter.GaussianBlur(blur)))


def shadow(img, box, r, blur=40, alpha=200, dy=24):
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    x0, y0, x1, y1 = box
    ImageDraw.Draw(sh).rounded_rectangle([x0, y0 + dy, x1, y1 + dy], radius=r, fill=(0, 0, 0, alpha))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))


_WM = None


def wordmark(width=280):
    global _WM
    if _WM is None:
        out = "/tmp/tunl_store_wordmark_%d.png" % width
        subprocess.run(["rsvg-convert", "-w", str(width), os.path.join(REPO, "branding/wordmark.svg"),
                        "-o", out], check=True)
        _WM = Image.open(out).convert("RGBA")
    return _WM


def build(shot, idx, locale):
    compact = H < 2500          # the 9:16 Play canvas
    lines, sub = COPY[locale][idx]
    img = corridor(seed=(idx + 1) * 5 + 2)
    bottom = text_block(img, locale, lines, ACCENT[idx], sub, 110 if compact else 150)
    sy = bottom + 50 if compact else max(bottom + 70, 640)

    # full capture, edge to edge
    sh = int(round(W * shot.height / shot.width))
    shadow(img, [0, sy, W, sy + sh], 0, blur=30, alpha=220, dy=14)
    img.alpha_composite(shot.resize((W, sh), Image.LANCZOS).convert("RGBA"), (0, sy))
    d = ImageDraw.Draw(img, "RGBA")
    d.line([(0, sy), (W, sy)], fill=(*ROSE_EDGE, 220), width=3)
    d.line([(0, sy + sh), (W, sy + sh)], fill=(*ROSE_EDGE, 220), width=3)

    # zoom panel - fills whatever is left between the strip and the wordmark
    pw = 1180
    py0 = sy + sh + (80 if compact else 110)
    ph = min(1250, H - (165 if compact else 190) - py0)
    cx, cy, zw = ZOOM_COMPACT.get(idx, ZOOM[idx]) if compact else ZOOM[idx]
    zh = int(zw * ph / pw)
    zx0 = max(0, min(shot.width - zw, cx - zw // 2))
    zy0 = max(0, min(shot.height - zh, cy - zh // 2))
    k = W / shot.width
    lens = [zx0 * k, sy + zy0 * k, (zx0 + zw) * k, sy + (zy0 + zh) * k]
    px0 = (W - pw) // 2
    panel = [px0, py0, px0 + pw, py0 + ph]
    cone = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(cone).polygon([(lens[0], lens[3]), (lens[2], lens[3]),
                                  (panel[2], panel[1]), (panel[0], panel[1])], fill=(*ROSE, 38))
    img.alpha_composite(cone)
    d.line([(lens[0], lens[3]), (panel[0], panel[1])], fill=(*ROSE_EDGE, 140), width=2)
    d.line([(lens[2], lens[3]), (panel[2], panel[1])], fill=(*ROSE_EDGE, 140), width=2)
    d.rounded_rectangle(lens, radius=10, outline=(*ROSE_EDGE, 255), width=4)
    crop = shot.crop((zx0, zy0, zx0 + zw, zy0 + zh)).resize((pw, ph), Image.LANCZOS)
    shadow(img, panel, 36)
    glow_rect(img, panel, 36)
    img.alpha_composite(rounded(crop, 36), (px0, py0))
    ImageDraw.Draw(img).rounded_rectangle(panel, radius=36, outline=(*ROSE_EDGE, 230), width=3)

    wm = wordmark()
    img.alpha_composite(wm, ((W - wm.width) // 2, H - (45 if compact else 60) - wm.height))
    return img.convert("RGB")


def to_65(img):
    """6.9" 1320x2868 -> 6.5" 1284x2778: scale to width, trim the (background-
    only) excess evenly top and bottom."""
    h = int(round(img.height * 1284 / img.width))
    s = img.resize((1284, h), Image.LANCZOS)
    t = (h - 2778) // 2
    return s.crop((0, t, 1284, t + 2778))


def main():
    global H
    locales = sys.argv[1].split(",") if len(sys.argv) > 1 else list(COPY)
    shots = load_captures()
    for loc in locales:
        H = 2347                                   # 1320 * 16/9 -> Play 9:16
        dpl = os.path.join(SRC_DIR, loc, "play-9x16")
        os.makedirs(dpl, exist_ok=True)
        for i, shot in enumerate(shots):
            build(shot, i, loc).resize((1080, 1920), Image.LANCZOS).save(
                os.path.join(dpl, "%02d.png" % (i + 1)), optimize=True)
        H = 2868
        d69 = os.path.join(SRC_DIR, loc, "portrait-6.9in")
        d65 = os.path.join(SRC_DIR, loc, "portrait-6.5in")
        os.makedirs(d69, exist_ok=True)
        os.makedirs(d65, exist_ok=True)
        for i, shot in enumerate(shots):
            im = build(shot, i, loc)
            im.save(os.path.join(d69, "%02d.png" % (i + 1)), optimize=True)
            to_65(im).save(os.path.join(d65, "%02d.png" % (i + 1)), optimize=True)
        print("wrote", loc)


if __name__ == "__main__":
    main()
