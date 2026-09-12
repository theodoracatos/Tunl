# Builds the Play Console bulk-import ZIP for the 10 new v11.0 achievements:
# 3 runs-played, 2 dodge (near-miss), 1 pacifist, 4 skill (sprint/no_hit/
# no_bonus/boulder_meister). Same 3-CSV + icons layout as
# gen-play-achievements-dist-zip.py / gen-play-achievements-flight-zip.py.
# Texts from ach_translations_{runs,dodge,pacifist,skill}.json; locale codes
# remapped from the JSON's ASC-style keys to Play's codes. English is the
# default row in AchievementsMetadata.csv, the other 14 locales go in
# AchievementsLocalizations.csv. List order continues on from flight's 31/32.
#   python3 gen-play-achievements-v11-zip.py
#   -> ../../.claude-scratch/play-achievements-v11/tunl-achievements-v11.zip
import csv, io, json, os, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(HERE + "/../../.claude-scratch/play-achievements-v11")
ICONS = HERE + "/achievement-icons"
os.makedirs(OUT_DIR, exist_ok=True)

# JSON key -> Play Console locale code (matches the dist/flight/planet imports)
PLAY_LOCALE = {
    "de-DE": "de-DE", "fr-FR": "fr-FR", "it": "it-IT", "es-ES": "es-ES",
    "pt-BR": "pt-BR", "ru": "ru-RU", "ja": "ja-JP", "ko": "ko-KR",
    "zh-Hant": "zh-TW", "tr": "tr-TR", "pl": "pl-PL", "id": "id",
    "hi": "hi-IN", "ar-SA": "ar",
}

TR_RUNS = json.load(open(HERE + "/ach_translations_runs.json"))
TR_DODGE = json.load(open(HERE + "/ach_translations_dodge.json"))
TR_PACIFIST = json.load(open(HERE + "/ach_translations_pacifist.json"))
TR_SKILL = json.load(open(HERE + "/ach_translations_skill.json"))

# achievement id -> (source json, english display name, icon file, points, list order)
ACH = [
    ("tunl_ach_runs_10",          TR_RUNS,     "10 Runs",           "runs_10.png",          10, 33),
    ("tunl_ach_runs_100",         TR_RUNS,     "100 Runs",          "runs_100.png",         25, 34),
    ("tunl_ach_runs_1000",        TR_RUNS,     "1000 Runs",         "runs_1000.png",        50, 35),
    ("tunl_ach_dodge_100",        TR_DODGE,    "100 Near Misses",   "dodge_100.png",        15, 36),
    ("tunl_ach_dodge_1000",       TR_DODGE,    "1000 Near Misses",  "dodge_1000.png",       30, 37),
    ("tunl_ach_pacifist",         TR_PACIFIST, "Pacifist",          "pacifist.png",         40, 38),
    ("tunl_ach_sprint",           TR_SKILL,    "Perfect Sprint",    "sprint.png",           30, 39),
    ("tunl_ach_no_hit",           TR_SKILL,    "No-Hit Run",        "no_hit.png",           35, 40),
    ("tunl_ach_no_bonus",         TR_SKILL,    "No Bonus",          "no_bonus.png",         35, 41),
    ("tunl_ach_boulder_meister",  TR_SKILL,    "Boulder Meister",   "boulder_meister.png",  30, 42),
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

zpath = OUT_DIR + "/tunl-achievements-v11.zip"
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
