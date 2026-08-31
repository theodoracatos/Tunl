#!/usr/bin/env python3
"""Build App Store portrait screenshots for TUNL 8.0, all 16 store locales.

Same cave-frame pipeline as make-portrait-frames.py (the 7.0 builder): the game
is landscape-only so the raw sim captures are 2868x1320, and the App Store renders
portrait, so each landscape shot is dropped into a portrait "cave corridor" frame
with a headline up top, the shot as a rounded card, a climbing ship, and the TUNL
wordmark at the base.

Sizes written per locale:
  6.9"  1320x2868  ->  Screenshots/iOS_8.0/<loc>/portrait/
  6.5"  1242x2688  ->  Screenshots/iOS_8.0/<loc>/portrait-6.5/

Locales:
  en     - English gameplay captures + English captions
  pt-BR  - Brazilian-Portuguese gameplay captures (br/) + pt-BR captions
  13 more (de fr it es pt ru tr id vi ja ko zh ar hi) - reuse the ENGLISH gameplay
           captures (user has no time for native landscape captures per language;
           the gameplay HUD is language-agnostic numbers) with TRANSLATED captions.
           Frames 1 (title) and 5 (settings) still show some English game UI in
           these; frames 2-4 read fully localized.

Latin/Cyrillic captions use Courier New Bold (the 7.0 look). ja/ko/zh/ar/hi use
per-script system fonts; ar/hi render through Pillow's RAQM layout engine (needs
Pillow built against libraqm - `brew install libraqm` then
`pip install --force-reinstall --no-binary :all: pillow`).

Run:  python3 Screenshots/make-portrait-frames-8.0.py
"""

import math
import os
import random
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

try:
    RAQM = ImageFont.Layout.RAQM
    BASIC = ImageFont.Layout.BASIC
except AttributeError:                       # very old Pillow
    RAQM = BASIC = None

W, H = 1320, 2868
SIX_FIVE = (1242, 2688)

REPO = "/Users/theodoracatos/Development/Tunl"
WORDMARK_SVG = os.path.join(REPO, "branding/wordmark.svg")
TMP = os.environ.get("TUNL_TMP", "/tmp")
os.makedirs(TMP, exist_ok=True)

COURIER = "/System/Library/Fonts/Supplemental/Courier New Bold.ttf"
# locale -> (path, ttc index, layout is RAQM, direction)
FONT = {
    "_latin": (COURIER, 0, False, "ltr"),
    "ja": ("/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc", 0, False, "ltr"),
    "ko": ("/System/Library/Fonts/AppleSDGothicNeo.ttc", 4, False, "ltr"),
    "zh": ("/System/Library/Fonts/STHeiti Medium.ttc", 0, False, "ltr"),
    "ar": ("/System/Library/Fonts/Supplemental/GeezaPro.ttc", 1, True, "rtl"),
    "hi": ("/System/Library/Fonts/Kohinoor.ttc", 3, True, "ltr"),
}

INK = (234, 240, 255)
DIM = (150, 167, 200)
CYAN = (63, 224, 255)
GOLD = (255, 205, 70)
ROCK_HI = (78, 74, 48)
ROCK_LO = (34, 32, 20)
VOID = (5, 5, 12)

_FONT_CACHE = {}


def fontspec(loc):
    return FONT.get(loc, FONT["_latin"])


def font(loc, px):
    path, idx, raqm, _ = fontspec(loc)
    key = (path, idx, px, raqm)
    if key not in _FONT_CACHE:
        kw = {"index": idx}
        if raqm and RAQM is not None:
            kw["layout_engine"] = RAQM
        _FONT_CACHE[key] = ImageFont.truetype(path, px, **kw)
    return _FONT_CACHE[key]


def wordmark_png(width):
    out = os.path.join(TMP, "tunl_wordmark_%d.png" % width)
    subprocess.run(["rsvg-convert", "-w", str(width), WORDMARK_SVG, "-o", out], check=True)
    return Image.open(out).convert("RGBA")


def wall_x(edge, y, seed):
    t = y / H
    pinch = math.sin(t * math.pi) * 40
    wob = (math.sin(y * 0.0042 + seed) * 40 + math.sin(y * 0.0111 + seed * 2.0) * 20)
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
    for y in ys:
        col = _rock_shade(y, 1.0)
        edge_col = _rock_shade(y, 0.45)
        lx = wall_x("L", y, seed)
        rx = wall_x("R", y, seed)
        d.rectangle([0, y, lx - 26, y + step], fill=col)
        d.rectangle([lx - 26, y, lx, y + step], fill=edge_col)
        d.rectangle([rx, y, rx + 26, y + step], fill=edge_col)
        d.rectangle([rx + 26, y, W, y + step], fill=col)
    for _ in range(2600):
        y = rnd.randint(0, H)
        lx, rx = wall_x("L", y, seed), wall_x("R", y, seed)
        x = rnd.uniform(0, lx) if rnd.random() < 0.5 else rnd.uniform(rx, W)
        b = rnd.randint(-14, 16)
        base = _rock_shade(y, 1.0)
        d.point((x, y), fill=tuple(max(0, min(255, c + b)) for c in base))
    for _ in range(11):
        y = rnd.randint(120, H - 120)
        edge = rnd.choice(["L", "R"])
        wx = wall_x(edge, y, seed)
        length = rnd.randint(80, 190)
        half = rnd.randint(30, 46)
        tip = wx + length if edge == "L" else wx - length
        d.polygon([(wx, y - half), (wx, y + half), (tip, y)],
                  fill=_rock_shade(y, 0.8), outline=(*CYAN, 150))
    for edge in ("L", "R"):
        pts = [(wall_x(edge, y, seed), y) for y in ys]
        d.line(pts, fill=(*CYAN, 90), width=10)
        d.line(pts, fill=(*CYAN, 220), width=4)
    for _ in range(300):
        y = rnd.randint(0, H)
        lx, rx = wall_x("L", y, seed), wall_x("R", y, seed)
        x = rnd.uniform(lx + 14, rx - 14)
        a = rnd.randint(40, 170)
        s = rnd.choice([1, 1, 1, 2, 2])
        d.ellipse([x, y, x + s, y + s], fill=(205, 218, 255, a))


def draw_ship(img, cx, cy, scale, seed):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ang = math.radians(-28)
    ca, sa = math.cos(ang), math.sin(ang)

    def pt(px, py):
        return (cx + (px * ca - py * sa) * scale, cy + (px * sa + py * ca) * scale)

    d.polygon([pt(-42, -14), pt(-42, 14), pt(-120, 0)], fill=(120, 200, 255, 130))
    d.polygon([pt(-42, -8), pt(-42, 8), pt(-92, 0)], fill=(220, 245, 255, 190))
    d.polygon([pt(60, 0), pt(-40, -26), pt(-30, 0), pt(-40, 26)],
              fill=(238, 244, 255, 255), outline=(150, 200, 255, 255))
    layer = layer.filter(ImageFilter.GaussianBlur(0.6))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(16)))
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
    hole = Image.new("L", (W, H), 255)
    ImageDraw.Draw(hole).ellipse([-W * 0.35, H * 0.16, W * 1.35, H * 0.9], fill=60)
    hole = hole.filter(ImageFilter.GaussianBlur(220))
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    overlay.putalpha(hole)
    img.alpha_composite(overlay)


def rounded_card(shot, target_w, radius=26):
    ratio = shot.height / shot.width
    tw, th = target_w, int(round(target_w * ratio))
    s = shot.resize((tw, th), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (tw, th), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, tw - 1, th - 1], radius=radius, fill=255)
    s.putalpha(mask)
    pad = 60
    canvas = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([pad, pad + 12, pad + tw, pad + th + 12],
                                        radius=radius, fill=(0, 0, 0, 170))
    canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(26)))
    gl = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(gl).rounded_rectangle([pad - 3, pad - 3, pad + tw + 3, pad + th + 3],
                                        radius=radius + 3, outline=(*CYAN, 220), width=6)
    canvas.alpha_composite(gl.filter(ImageFilter.GaussianBlur(9)))
    canvas.alpha_composite(s, (pad, pad))
    ImageDraw.Draw(canvas).rounded_rectangle([pad, pad, pad + tw - 1, pad + th - 1],
                                             radius=radius, outline=(*INK, 230), width=2)
    return canvas


def center_text(d, cx, y, text, fnt, fill, direction):
    kw = {"font": fnt}
    if direction == "rtl":
        kw["direction"] = "rtl"
    bb = d.textbbox((0, 0), text, **kw)
    d.text((cx - (bb[2] - bb[0]) / 2 - bb[0], y), text, fill=fill, **kw)
    return bb[3] - bb[1]


def build(loc, shot_path, out_path, headline_lines, accent_idx, subhead, seed):
    _, _, _, direction = fontspec(loc)
    img = Image.new("RGBA", (W, H), (*VOID, 255))
    draw_corridor(img, seed)
    vignette(img)
    d = ImageDraw.Draw(img)

    size = 100
    while size > 54:
        hf = font(loc, size)
        widest = max(d.textlength(l, font=hf,
                                  **({"direction": "rtl"} if direction == "rtl" else {}))
                     for l in headline_lines)
        if widest <= 1090:
            break
        size -= 3
    lh = int(size * 1.24)
    y = 210
    for i, line in enumerate(headline_lines):
        col = CYAN if i == accent_idx else INK
        center_text(d, W / 2, y, line, hf, col, direction)
        y += lh

    head_bottom = 210 + len(headline_lines) * int(100 * 1.24)
    card = rounded_card(Image.open(shot_path).convert("RGB"), 1236)
    cx = (W - card.width) // 2
    cy = int(head_bottom + 140)
    img.alpha_composite(card, (cx, cy))

    ssize = 44
    while ssize > 24:
        sf = font(loc, ssize)
        if d.textlength(subhead, font=sf,
                        **({"direction": "rtl"} if direction == "rtl" else {})) <= 1120:
            break
        ssize -= 2
    center_text(d, W / 2, cy + card.height + 44, subhead, sf, DIM, direction)

    draw_ship(img, W * 0.62, H * 0.735, 1.9, seed)
    wm = wordmark_png(400)
    img.alpha_composite(wm, ((W - wm.width) // 2, H - wm.height - 96))
    center_text(d, W / 2, H - 70, "flytunl.ch", font("_latin", 29), (120, 134, 162, 255), "ltr")

    rgb = img.convert("RGB")
    rgb.save(out_path, "PNG")
    print("wrote", out_path)
    return rgb


# ---------------------------------------------------------------- captions
# Each locale: 5 x (headline lines [3], accent line idx, subhead).
# Order matches the EN capture stamps below: title / gameplay / power-ups /
# death+rank / settings.
CAPS = {
"en": [
 (["One cave.", "Every player.", "Every day."], 1, "One daily corridor for the whole world"),
 (["Hold to climb.", "Release to fall.", "Go deep."], 0, "One button. That is the whole game"),
 (["Seven power-ups.", "One corridor", "that keeps shrinking."], 1, "Shield, magnet, slow-time, bombs and more"),
 (["Die. Check your", "world rank.", "Go again."], 1, "Live daily leaderboard the moment you crash"),
 (["Fifteen languages.", "No tutorial.", "Just fly."], 0, "Pick up and play in seconds"),
],
"de": [
 (["Eine Höhle.", "Alle Spieler.", "Jeden Tag."], 1, "Ein Tageskorridor für die ganze Welt"),
 (["Halten steigt.", "Loslassen fällt.", "Geh tief."], 0, "Ein Knopf. Das ganze Spiel"),
 (["Sieben Power-ups.", "Ein Korridor,", "der enger wird."], 1, "Schild, Magnet, Zeitlupe, Bomben und mehr"),
 (["Stirb. Sieh deinen", "Weltrang.", "Nochmal."], 1, "Live-Weltrangliste im Moment des Absturzes"),
 (["15 Sprachen.", "Kein Tutorial.", "Einfach fliegen."], 0, "In Sekunden startklar"),
],
"fr": [
 (["Une grotte.", "Tous les joueurs.", "Chaque jour."], 1, "Un couloir quotidien pour le monde entier"),
 (["Maintiens, ça monte.", "Relâche, ça tombe.", "Va au fond."], 0, "Un bouton. Tout le jeu"),
 (["Sept bonus.", "Un couloir", "qui rétrécit."], 1, "Bouclier, aimant, ralenti, bombes et plus"),
 (["Meurs. Vois ton", "rang mondial.", "Recommence."], 1, "Classement mondial en direct dès l'écrasement"),
 (["15 langues.", "Aucun tutoriel.", "Vole, c'est tout."], 0, "Prêt à jouer en quelques secondes"),
],
"it": [
 (["Una grotta.", "Tutti i giocatori.", "Ogni giorno."], 1, "Un corridoio al giorno per tutto il mondo"),
 (["Tieni, sale.", "Lascia, scende.", "Vai a fondo."], 0, "Un tasto. Tutto il gioco"),
 (["Sette bonus.", "Un corridoio", "che si stringe."], 1, "Scudo, calamita, rallenta, bombe e altro"),
 (["Muori. Vedi il", "rango mondiale.", "Riprova."], 1, "Classifica mondiale dal vivo appena ti schianti"),
 (["15 lingue.", "Nessun tutorial.", "Vola e basta."], 0, "Pronti al volo in pochi secondi"),
],
"es": [
 (["Una cueva.", "Todos los jugadores.", "Cada día."], 1, "Un pasillo diario para todo el mundo"),
 (["Mantén, sube.", "Suelta, cae.", "Baja a fondo."], 0, "Un botón. Todo el juego"),
 (["Siete potenciadores.", "Un pasillo", "que se estrecha."], 1, "Escudo, imán, cámara lenta, bombas y más"),
 (["Muere. Mira tu", "rango mundial.", "Otra vez."], 1, "Clasificación mundial en vivo al estrellarte"),
 (["15 idiomas.", "Sin tutorial.", "Solo vuela."], 0, "Listo para jugar en segundos"),
],
"pt": [
 (["Uma gruta.", "Todos os jogadores.", "Todos os dias."], 1, "Um corredor diário para o mundo inteiro"),
 (["Segura, sobe.", "Larga, cai.", "Vai fundo."], 0, "Um botão. O jogo todo"),
 (["Sete bónus.", "Um corredor", "que só aperta."], 1, "Escudo, íman, câmara lenta, bombas e mais"),
 (["Morre. Vê o teu", "rank mundial.", "Outra vez."], 1, "Classificação mundial ao vivo quando bates"),
 (["15 idiomas.", "Sem tutorial.", "Só voar."], 0, "Pronto a jogar em segundos"),
],
"pt-BR": [
 (["Uma caverna.", "Todo jogador.", "Todo dia."], 1, "Um corredor diário para o mundo inteiro"),
 (["Segure, sobe.", "Solte, cai.", "Vai fundo."], 0, "Um botão, e o jogo inteiro"),
 (["Sete power-ups.", "Um corredor", "que só encolhe."], 1, "Escudo, ímã, lentidão, bombas e mais"),
 (["Morra. Veja seu", "rank mundial.", "Jogue de novo."], 1, "Ranking diário ao vivo quando você morre"),
 (["Quinze idiomas.", "Sem tutorial.", "Só voar."], 0, "Pegue e jogue em segundos"),
],
"ru": [
 (["Одна пещера.", "Все игроки.", "Каждый день."], 1, "Один коридор в день на весь мир"),
 (["Держишь - вверх.", "Отпустил - вниз.", "Ныряй глубже."], 0, "Одна кнопка. Вот и вся игра"),
 (["Семь бонусов.", "Один коридор,", "что всё уже."], 1, "Щит, магнит, замедление, бомбы и другое"),
 (["Разбился. Смотри", "мировой ранг.", "Ещё раз."], 1, "Живая мировая таблица в момент краха"),
 (["15 языков.", "Без обучения.", "Просто лети."], 0, "Играй через пару секунд"),
],
"tr": [
 (["Bir mağara.", "Tüm oyuncular.", "Her gün."], 1, "Tüm dünya için günde bir koridor"),
 (["Basınca yükselir.", "Bırakınca düşer.", "Derine in."], 0, "Tek tuş. Oyunun tamamı"),
 (["Yedi güç.", "Gitgide daralan", "tek bir koridor."], 1, "Kalkan, mıknatıs, yavaşlatma, bomba ve daha fazlası"),
 (["Öl. Dünya", "sıralamana bak.", "Yeniden dene."], 1, "Çarptığın anda canlı dünya sıralaması"),
 (["15 dil.", "Eğitim yok.", "Sadece uç."], 0, "Saniyeler içinde oyna"),
],
"id": [
 (["Satu gua.", "Semua pemain.", "Setiap hari."], 1, "Satu lorong harian untuk seluruh dunia"),
 (["Tahan, naik.", "Lepas, turun.", "Terus ke dalam."], 0, "Satu tombol. Itu seluruh gimnya"),
 (["Tujuh power-up.", "Satu lorong", "yang terus menyempit."], 1, "Perisai, magnet, gerak lambat, bom, dan lainnya"),
 (["Menabrak. Cek", "peringkat dunia.", "Ulangi."], 1, "Papan peringkat dunia langsung saat menabrak"),
 (["15 bahasa.", "Tanpa tutorial.", "Terbang saja."], 0, "Siap main dalam hitungan detik"),
],
"vi": [
 (["Một hang động.", "Mọi người chơi.", "Mỗi ngày."], 1, "Một hành lang mỗi ngày cho cả thế giới"),
 (["Giữ thì lên.", "Thả thì xuống.", "Vào sâu hơn."], 0, "Một nút. Cả trò chơi"),
 (["Bảy vật phẩm.", "Một hành lang", "cứ hẹp dần."], 1, "Khiên, nam châm, làm chậm, bom và hơn nữa"),
 (["Đâm. Xem thứ hạng", "thế giới.", "Chơi lại."], 1, "Bảng xếp hạng thế giới trực tiếp khi bạn đâm"),
 (["15 ngôn ngữ.", "Không hướng dẫn.", "Chỉ việc bay."], 0, "Sẵn sàng chơi trong vài giây"),
],
"ja": [
 (["洞窟は1つ。", "全プレイヤー。", "毎日更新。"], 1, "世界共通の1日1本の洞窟"),
 (["押すと上昇。", "離すと落下。", "奥へ。"], 0, "ボタン1つ。それだけ"),
 (["7つのパワーアップ。", "狭くなり続ける", "1本の洞窟。"], 1, "シールド、マグネット、スロー、ボム他"),
 (["墜落。世界順位を", "チェック。", "もう1回。"], 1, "墜落した瞬間のライブ世界ランキング"),
 (["15言語対応。", "チュートリアルなし。", "ただ飛ぶ。"], 0, "数秒で遊べる"),
],
"ko": [
 (["동굴은 하나.", "모든 플레이어.", "매일 갱신."], 1, "전 세계 공통, 하루 한 동굴"),
 (["누르면 상승.", "놓으면 하강.", "깊이 들어가라."], 0, "버튼 하나. 그게 전부"),
 (["7가지 파워업.", "계속 좁아지는", "하나의 통로."], 1, "방패, 자석, 슬로우, 폭탄 등"),
 (["추락. 세계 순위", "확인.", "다시 한 판."], 1, "추락하는 순간 라이브 세계 순위표"),
 (["15개 언어.", "튜토리얼 없음.", "그냥 날아라."], 0, "몇 초면 시작"),
],
"zh": [
 (["一個洞穴。", "所有玩家。", "每天更新。"], 1, "全世界共用的每日洞穴"),
 (["按住上升。", "放開下墜。", "往深處飛。"], 0, "一個按鍵，就是全部"),
 (["七種道具。", "不斷變窄的", "一條通道。"], 1, "護盾、磁鐵、慢動作、炸彈等"),
 (["撞毀。查看你的", "世界排名。", "再來一局。"], 1, "撞毀瞬間的即時世界排行榜"),
 (["15 種語言。", "沒有教學。", "直接起飛。"], 0, "幾秒就能上手"),
],
"ar": [
 (["كهف واحد.", "كل اللاعبين.", "كل يوم."], 1, "ممر واحد يوميا للعالم كله"),
 (["اضغط ترتفع.", "ارفع تسقط.", "انزل عميقا."], 0, "زر واحد. اللعبة كلها"),
 (["سبع قدرات.", "ممر واحد", "يضيق باستمرار."], 1, "درع، مغناطيس، إبطاء، قنابل وغيرها"),
 (["اصطدم. تحقق من", "ترتيبك العالمي.", "أعد الكرة."], 1, "لوحة متصدري العالم مباشرة لحظة اصطدامك"),
 (["15 لغة.", "بلا شرح.", "فقط طر."], 0, "جاهز للعب في ثوان"),
],
"hi": [
 (["एक गुफा।", "हर खिलाड़ी।", "रोज़ नई।"], 1, "पूरी दुनिया के लिए एक दैनिक गलियारा"),
 (["दबाओ, ऊपर।", "छोड़ो, नीचे।", "गहरे जाओ।"], 0, "एक बटन। पूरा खेल"),
 (["सात पावर-अप।", "एक गलियारा", "जो सिकुड़ता जाए।"], 1, "शील्ड, मैग्नेट, स्लो, बम और बहुत कुछ"),
 (["मरो। वर्ल्ड रैंक", "देखो।", "फिर से।"], 1, "टकराते ही लाइव वर्ल्ड लीडरबोर्ड"),
 (["15 भाषाएँ।", "कोई ट्यूटोरियल नहीं।", "बस उड़ो।"], 0, "सेकंडों में खेलना शुरू"),
],
}

# EN capture stamps (en/) - reused by every locale except pt-BR.
EN_STAMPS = ["20.36.20", "20.38.30", "20.39.43", "20.39.50", "20.36.42"]
# pt-BR capture stamps (br/) - Portuguese game UI.
BR_STAMPS = ["20.37.05", "20.39.12", "20.40.21", "20.40.31", "20.37.19"]


def find(src_dir, stamp):
    for n in os.listdir(src_dir):
        if n.lower().endswith(".png") and stamp in n:
            return os.path.join(src_dir, n)
    return None


def run(loc):
    src = os.path.join(REPO, "Screenshots/iOS_8.0", "br" if loc == "pt-BR" else "en")
    stamps = BR_STAMPS if loc == "pt-BR" else EN_STAMPS
    out_dir = os.path.join(REPO, "Screenshots/iOS_8.0", loc, "portrait")
    out65 = os.path.join(REPO, "Screenshots/iOS_8.0", loc, "portrait-6.5")
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(out65, exist_ok=True)
    for i, ((lines, accent, sub), stamp) in enumerate(zip(CAPS[loc], stamps), 1):
        p = find(src, stamp)
        if not p:
            print("!! missing", stamp, "in", src)
            continue
        rgb = build(loc, p, os.path.join(out_dir, "%02d.png" % i),
                    lines, accent, sub, seed=i * 3 + 1)
        rgb.resize(SIX_FIVE, Image.LANCZOS).save(os.path.join(out65, "%02d.png" % i), "PNG")
        print("wrote", os.path.join(out65, "%02d.png" % i))


# ---------------------------------------------------------------- Play (landscape 16:9)
PW, PH = 2208, 1242            # Play phone screenshot, inside the 9:16..16:9 window


def _play_bg(img, accent_rgb, seed):
    """Clean landscape ground: vertical wash from near-black to a faint accent,
    a soft accent glow behind where the card sits, and a light star dust."""
    top = (8, 9, 16)
    bot = tuple(int(a * 0.16 + b * 0.84) for a, b in zip(accent_rgb, (6, 6, 13)))
    base = Image.new("RGB", (1, PH))
    for y in range(PH):
        f = y / PH
        base.putpixel((0, y), tuple(int(top[i] + (bot[i] - top[i]) * f) for i in range(3)))
    img.paste(base.resize((PW, PH)), (0, 0))
    glow = Image.new("RGBA", (PW, PH), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([PW * 0.12, -PH * 0.3, PW * 0.88, PH * 0.9],
                                 fill=(*accent_rgb, 30))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(160)))
    d = ImageDraw.Draw(img, "RGBA")
    rnd = random.Random(seed * 13 + 5)
    for _ in range(220):
        x, y = rnd.uniform(0, PW), rnd.uniform(0, PH)
        a = rnd.randint(25, 120)
        s = rnd.choice([1, 1, 2])
        d.ellipse([x, y, x + s, y + s], fill=(205, 218, 255, a))


def build_play(loc, shot_path, out_path, oneliner, accent_rgb, seed):
    _, _, _, direction = fontspec(loc)
    img = Image.new("RGBA", (PW, PH), (*VOID, 255))
    _play_bg(img, accent_rgb, seed)

    band_h = 176
    by = PH - band_h

    shot = Image.open(shot_path).convert("RGB")
    card = rounded_card(shot, int(PW * 0.82), radius=22)
    cx = (PW - card.width) // 2
    cy = int((by - card.height) / 2) + 6
    img.alpha_composite(card, (cx, cy))

    band = Image.new("RGBA", (PW, band_h), (0, 0, 0, 0))
    ImageDraw.Draw(band).rectangle([0, 0, PW, band_h], fill=(6, 6, 14, 236))
    ImageDraw.Draw(band).rectangle([0, 0, PW, 5], fill=(*accent_rgb, 255))
    img.alpha_composite(band, (0, by))

    d = ImageDraw.Draw(img)
    size = 60
    while size > 34:
        f = font(loc, size)
        kw = {"direction": "rtl"} if direction == "rtl" else {}
        if d.textlength(oneliner, font=f, **kw) <= PW - 300:
            break
        size -= 2
    center_text(d, PW / 2, by + (band_h - int(size * 1.15)) / 2, oneliner,
                font(loc, size), INK, direction)

    wm = wordmark_png(210)
    img.alpha_composite(wm, ((PW - wm.width) // 2, 34))

    img.convert("RGB").save(out_path, "PNG")
    print("wrote", out_path)


DAY_ACCENT = [(63, 224, 255), (120, 200, 255), (255, 205, 70),
              (167, 91, 255), (99, 224, 160)]


def run_play(loc):
    src = os.path.join(REPO, "Screenshots/iOS_8.0", "br" if loc == "pt-BR" else "en")
    stamps = BR_STAMPS if loc == "pt-BR" else EN_STAMPS
    out_dir = os.path.join(REPO, "Screenshots/Android_8.0", loc, "phone")
    os.makedirs(out_dir, exist_ok=True)
    for i, ((lines, _accent, _sub), stamp) in enumerate(zip(CAPS[loc], stamps), 1):
        p = find(src, stamp)
        if not p:
            print("!! missing", stamp, "in", src)
            continue
        oneliner = " ".join(lines)
        build_play(loc, p, os.path.join(out_dir, "%02d.png" % i),
                   oneliner, DAY_ACCENT[(i - 1) % len(DAY_ACCENT)], seed=i * 3 + 1)


# ------------------------------------------------ Play (portrait 9:16, 1242x2208)
# Play rejects screenshots whose long side exceeds 2x the short side, so the App
# Store portrait sizes (1320x2868 / 1242x2688, ~2.16:1) can't be reused. This
# reuses the exact iOS portrait pipeline (corridor frame, headline, gameplay card,
# ship, wordmark) at a Play-legal 9:16 canvas by swapping the module W/H globals
# that draw_corridor / vignette / draw_ship / build all read.
PLAY_PORTRAIT = (1242, 2208)


def run_play_portrait(loc):
    global W, H
    src = os.path.join(REPO, "Screenshots/iOS_8.0", "br" if loc == "pt-BR" else "en")
    stamps = BR_STAMPS if loc == "pt-BR" else EN_STAMPS
    out_dir = os.path.join(REPO, "Screenshots/Android_8.0", loc, "phone-portrait")
    os.makedirs(out_dir, exist_ok=True)
    saved = (W, H)
    W, H = PLAY_PORTRAIT
    try:
        for i, ((lines, accent, sub), stamp) in enumerate(zip(CAPS[loc], stamps), 1):
            p = find(src, stamp)
            if not p:
                print("!! missing", stamp, "in", src)
                continue
            build(loc, p, os.path.join(out_dir, "%02d.png" % i),
                  lines, accent, sub, seed=i * 3 + 1)
    finally:
        W, H = saved


if __name__ == "__main__":
    import sys
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    for loc in CAPS:
        print("== %s ==" % loc)
        if which in ("all", "ios"):
            run(loc)
        if which in ("all", "play"):
            run_play(loc)
        if which in ("all", "play-portrait"):
            run_play_portrait(loc)
