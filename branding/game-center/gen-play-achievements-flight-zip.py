# Builds the Play Console bulk-import ZIP for the 2 flight-duration achievements
# (tunl_ach_flight_1min / tunl_ach_flight_2min). Same 3-CSV + icons layout as
# gen-play-achievements-dist-zip.py. Texts from ach_translations_flight.json;
# locale codes remapped from the JSON's ASC-style keys to Play's codes. English is
# the default row in AchievementsMetadata.csv, the other 14 locales go in
# AchievementsLocalizations.csv.
#   python3 gen-play-achievements-flight-zip.py
#   -> ../../.claude-scratch/play-achievements-flight/tunl-achievements-flight.zip
import csv, io, json, os, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(HERE + "/../../.claude-scratch/play-achievements-flight")
ICONS = HERE + "/achievement-icons"
os.makedirs(OUT_DIR, exist_ok=True)

TR = json.load(open(HERE + "/ach_translations_flight.json"))

# JSON key -> Play Console locale code (matches the dist/planet achievement imports)
PLAY_LOCALE = {
    "de-DE": "de-DE", "fr-FR": "fr-FR", "it": "it-IT", "es-ES": "es-ES",
    "pt-BR": "pt-BR", "ru": "ru-RU", "ja": "ja-JP", "ko": "ko-KR",
    "zh-Hant": "zh-TW", "tr": "tr-TR", "pl": "pl-PL", "id": "id",
    "hi": "hi-IN", "ar-SA": "ar",
}

# achievement id -> (english display name, icon file, points, list order)
ACH = [
    ("tunl_ach_flight_1min", "One Minute", "flight_1min.png", 15, 31),
    ("tunl_ach_flight_2min", "Two Minutes", "flight_2min.png", 30, 32),
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

zpath = OUT_DIR + "/tunl-achievements-flight.zip"
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
