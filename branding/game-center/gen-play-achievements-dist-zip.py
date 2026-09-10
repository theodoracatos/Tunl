# Builds the Play Console bulk-import ZIP for the 2 lifetime-distance achievements
# (tunl_ach_dist_moon / tunl_ach_dist_sun). Same 3-CSV + icons layout Play's
# "Erfolge -> Erfolge importieren" expects (no header rows; Incremental must be
# the literal "False"). Texts from ach_translations_dist.json; locale codes
# remapped from the JSON's ASC-style keys to Play's codes. English is the default
# row in AchievementsMetadata.csv, the other 14 locales go in
# AchievementsLocalizations.csv.
#   python3 gen-play-achievements-dist-zip.py
#   -> ../../.claude-scratch/play-achievements-dist/tunl-achievements-dist.zip
import csv, io, json, os, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(HERE + "/../../.claude-scratch/play-achievements-dist")
ICONS = HERE + "/achievement-icons"
os.makedirs(OUT_DIR, exist_ok=True)

TR = json.load(open(HERE + "/ach_translations_dist.json"))

# JSON key -> Play Console locale code (matches the 9.1 planet-achievement import)
PLAY_LOCALE = {
    "de-DE": "de-DE", "fr-FR": "fr-FR", "it": "it-IT", "es-ES": "es-ES",
    "pt-BR": "pt-BR", "ru": "ru-RU", "ja": "ja-JP", "ko": "ko-KR",
    "zh-Hant": "zh-TW", "tr": "tr-TR", "pl": "pl-PL", "id": "id",
    "hi": "hi-IN", "ar-SA": "ar",
}

# achievement id -> (english display name, icon file, points, list order)
ACH = [
    ("tunl_ach_dist_moon", "To the Moon", "dist_moon.png", 25, 9),
    ("tunl_ach_dist_sun",  "To the Sun",  "dist_sun.png",  50, 10),
]


def csv_bytes(rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\r\n")
    for r in rows:
        w.writerow(r)
    return buf.getvalue().encode("utf-8")


meta_rows, loc_rows, icon_rows = [], [], []
for ach_id, en_name, icon, points, order in ACH:
    en_desc = TR["en-US"][ach_id][2]          # pre-earned text = Play's single description
    meta_rows.append([en_name, en_desc, "False", "", "Revealed", points, order])
    icon_rows.append([en_name, icon])
    for jkey, play_code in PLAY_LOCALE.items():
        title, _post, pre = TR[jkey][ach_id]
        loc_rows.append([en_name, title, pre, play_code])

zpath = OUT_DIR + "/tunl-achievements-dist.zip"
with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("AchievementsMetadata.csv", csv_bytes(meta_rows))
    z.writestr("AchievementsLocalizations.csv", csv_bytes(loc_rows))
    z.writestr("AchievementsIconsMappings.csv", csv_bytes(icon_rows))
    for _id, _name, icon, _p, _o in ACH:
        z.write(f"{ICONS}/{icon}", icon)

print("wrote", zpath)
with zipfile.ZipFile(zpath) as z:
    for n in z.namelist():
        print("  ", n, z.getinfo(n).file_size)
