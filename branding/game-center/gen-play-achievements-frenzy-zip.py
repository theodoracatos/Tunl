# Builds the Play Console bulk-import ZIP for the 2 Frenzy achievements (18.x):
# tunl_ach_frenzy_first and tunl_ach_frenzy_double. Same 3-CSV + icons layout as
# gen-play-achievements-v11-zip.py, which this copies.
# Texts from ach_translations_frenzy.json; locale codes
# remapped from the JSON's ASC-style keys to Play's codes. English is the
# default row in AchievementsMetadata.csv, the other 14 locales go in
# AchievementsLocalizations.csv. List order continues on from v11's 42.
#   python3 gen-play-achievements-frenzy-zip.py
#   -> ../../.claude-scratch/play-achievements-frenzy/tunl-achievements-frenzy.zip
import csv, io, json, os, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(HERE + "/../../.claude-scratch/play-achievements-frenzy")
ICONS = HERE + "/achievement-icons"
os.makedirs(OUT_DIR, exist_ok=True)

# JSON key -> Play Console locale code (matches the dist/flight/planet imports)
PLAY_LOCALE = {
    "de-DE": "de-DE", "fr-FR": "fr-FR", "it": "it-IT", "es-ES": "es-ES",
    "pt-BR": "pt-BR", "ru": "ru-RU", "ja": "ja-JP", "ko": "ko-KR",
    "zh-Hant": "zh-TW", "tr": "tr-TR", "pl": "pl-PL", "id": "id",
    "hi": "hi-IN", "ar-SA": "ar", "el": "el-GR",
}

TR = json.load(open(HERE + "/ach_translations_frenzy.json"))

# achievement id -> (source json, english display name, icon file, points, list order)
ACH = [
    ("tunl_ach_frenzy_first",  TR, "First Frenzy",  "frenzy_first.png",  20, 43),
    ("tunl_ach_frenzy_double", TR, "Double Frenzy", "frenzy_double.png", 50, 44),
]


def csv_bytes(rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n")
    for r in rows:
        w.writerow(r)
    return buf.getvalue().encode("utf-8")


meta_rows, loc_rows, icon_rows = [], [], []
for ach_id, tr, en_name, icon, points, order in ACH:
    en_desc = tr["en-US"][ach_id][2]          # pre-earned text = Play's single description
    meta_rows.append([en_name, en_desc, "False", "", "Revealed", points, order])
    icon_rows.append([en_name, icon])
    for jkey, play_code in PLAY_LOCALE.items():
        title, _post, pre = tr[jkey][ach_id]
        loc_rows.append([en_name, title, pre, play_code])

zpath = OUT_DIR + "/tunl-achievements-frenzy.zip"
with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("AchievementsMetadata.csv", csv_bytes(meta_rows))
    z.writestr("AchievementsLocalizations.csv", csv_bytes(loc_rows))
    z.writestr("AchievementsIconsMappings.csv", csv_bytes(icon_rows))
    for _id, _tr, _name, icon, _p, _o in ACH:
        z.write(f"{ICONS}/{icon}", icon)

print("wrote", zpath)
with zipfile.ZipFile(zpath) as z:
    for n in z.namelist():
        print("  ", n, z.getinfo(n).file_size)
