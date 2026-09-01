#!/usr/bin/env python3
# Generate TUNL 8.1 Play Store metadata:
#   - new short description (Kurzbeschreibung, <=80 code points) per locale
#   - "what's new" changelog (changelogs/22.txt, <=500) per locale, from release-notes.md
# Full description + title + screenshots are unchanged (not touched here).
import os, re, sys

ROOT = "/Users/theodoracatos/Development/Tunl/store-metadata/8.1"
AND = os.path.join(ROOT, "android")
LANGS = ["en","de","fr","it","es","pt","pt-BR","ja","ko","zh","ru","ar","tr","id","vi","hi"]

# --- New 8.1 short descriptions -------------------------------------------------
# New wording vs 8.0. Leads with the one-cave-a-day / everyone-flies-it hook.
# Avoids Play promo-status keywords (no "new/best/#1/free/sale/download").
SHORTS = {
 "en": "Hold to fly through a shrinking cave. One cave a day, the whole world flies it.",
 "de": "Halten und durch die immer engere Höhle fliegen. Eine pro Tag, für alle gleich.",
 "fr": "Maintiens pour voler dans une grotte qui se resserre. Une par jour, pour tous.",
 "it": "Tieni premuto e vola in una grotta che si stringe. Una al giorno, per tutti.",
 "es": "Mantén pulsado y vuela por una cueva que se estrecha. Una al día, para todos.",
 "pt": "Mantém premido e voa por uma gruta que se estreita. Uma por dia, para todos.",
 "pt-BR": "Segura e voa por uma caverna que vai fechando. Uma por dia, a mesma pro mundo.",
 "ja": "押しっぱなしで、狭まる洞窟を飛ぶ。洞窟は1日ひとつ、世界中で同じ。",
 "ko": "누른 채로 좁아지는 동굴을 날아라. 동굴은 하루 하나, 전 세계가 동일.",
 "zh": "按住穿越不斷收窄的洞穴。每天一個洞穴，全世界都一樣。",
 "ru": "Держи и лети через сужающуюся пещеру. Одна пещера в день, одна на всех.",
 "ar": "اضغط مطولاً لتطير عبر كهف يضيق. كهف واحد كل يوم، هو نفسه للجميع.",
 "tr": "Basılı tut ve daralan bir mağarada uç. Günde bir mağara, herkes için aynı.",
 "id": "Tahan untuk terbang menembus gua yang menyempit. Satu gua tiap hari, sama semua.",
 "vi": "Giữ để bay qua hang động đang hẹp dần. Mỗi ngày một hang, chung cho mọi người.",
 "hi": "दबाए रखें और सिकुड़ती गुफा में उड़ें। रोज़ एक गुफा, सबके लिए एक जैसी।",
}

# --- Parse changelogs from release-notes.md -----------------------------------
md = open(os.path.join(ROOT, "release-notes.md"), encoding="utf-8").read()
bodies = {}
for m in re.finditer(r'^## ([a-z-]+)\s*\n+([\s\S]*?)(?=\n## |\n---|\s*$)', md, re.M):
    bodies[m.group(1)] = m.group(2).strip()

check = sys.argv[1:] == ["check"]
fail = False
print("locale | short (cp) | changelog (cp)")
for l in LANGS:
    s = SHORTS[l]
    c = bodies.get(l, "") or bodies.get(l.split("-")[0], "")
    sn, cn = len(s), len(c)
    sflag = "OVER" if sn > 80 else "ok"
    cflag = "OVER" if cn > 500 else ("MISS" if not c else "ok")
    if sn > 80 or cn > 500 or not c:
        fail = True
    print(f"{l:3}    | {sflag:4} {sn:3}  | {cflag:4} {cn:3}")
    if not check:
        d = os.path.join(AND, l)
        os.makedirs(os.path.join(d, "changelogs"), exist_ok=True)
        open(os.path.join(d, "short_description.txt"), "w", encoding="utf-8").write(s + "\n")
        open(os.path.join(d, "changelogs", "22.txt"), "w", encoding="utf-8").write(c + "\n")

if not check:
    print("\nwrote files under", AND)
sys.exit(1 if fail else 0)
