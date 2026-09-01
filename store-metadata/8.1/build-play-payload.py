#!/usr/bin/env python3
# Build the single Play Console "Versionshinweise" textarea payload for 8.1 (versionCode 22)
# and a per-locale short-description map for the store-listing step.
import re, json

ROOT = "/Users/theodoracatos/Development/Tunl/store-metadata/8.1"
md = open(f"{ROOT}/release-notes.md", encoding="utf-8").read()
bodies = {}
for m in re.finditer(r'^## ([a-z-]+)\s*\n+([\s\S]*?)(?=\n## |\n---|\s*$)', md, re.M):
    bodies[m.group(1)] = m.group(2).strip()

# repo-code -> Play Console locale code
PLAY = {"en":"en-US","ar":"ar","de":"de-DE","es":"es-ES","fr":"fr-FR","hi":"hi-IN",
        "id":"id","it":"it-IT","ja":"ja-JP","ko":"ko-KR","pt":"pt-BR","ru":"ru-RU",
        "tr":"tr-TR","vi":"vi","zh":"zh-TW"}
ORDER = ["en","ar","de","es","fr","hi","id","it","ja","ko","pt","ru","tr","vi","zh"]

blocks = []
shorts = {}
for l in ORDER:
    pc = PLAY[l]
    blocks.append(f"<{pc}>\n{bodies[l]}\n</{pc}>")
    d = "pt-BR" if pc == "pt-BR" else l
    shorts[pc] = open(f"{ROOT}/android/{d}/short_description.txt", encoding="utf-8").read().strip()

open(f"{ROOT}/play-release-notes-22.txt", "w", encoding="utf-8").write("\n".join(blocks) + "\n")
open(f"{ROOT}/play-short-descriptions.json", "w", encoding="utf-8").write(
    json.dumps(shorts, ensure_ascii=False, indent=2) + "\n")
print("wrote play-release-notes-22.txt and play-short-descriptions.json")
print("\n".join(f"{k}: {v}" for k, v in shorts.items()))
