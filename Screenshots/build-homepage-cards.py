#!/usr/bin/env python3
"""Rebuild the flytunl.ch homepage's five "Screenshots" gallery cards.

Reuses make-portrait-frames.py's build() (same corridor/card/wordmark look as
the App Store portrait shots) with fresh 12.1-era source captures instead of
the stale 7.0/8.0 ones baked into that script's own __main__. See CLAUDE.md
"do not revert" notes on the ship hull (12.0) and the frosted-glass menus
(12.1, this same session) for what was stale about the old cards.

Output: 1320x2868 PNGs (same as the App Store portrait format), then a 900x1956
webp per card for the actual homepage embed (home.src.html references these at
/Screenshots/12.1/0N.webp - same convention as the old /Screenshots/8.0/ set).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from importlib import import_module
mpf = import_module("make-portrait-frames".replace("-", "_")) if False else None
# make-portrait-frames.py has a hyphen, not importable as a normal module name -
# load it by path instead.
import importlib.util
spec = importlib.util.spec_from_file_location(
    "make_portrait_frames", os.path.join(os.path.dirname(__file__), "make-portrait-frames.py"))
mpf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mpf)

REPO = "/Users/theodoracatos/Development/Tunl"
SRC_12 = os.path.join(REPO, "Screenshots/iOS_12.0")
OUT = os.path.join(REPO, "Screenshots/homepage-12.1")
os.makedirs(OUT, exist_ok=True)

CARDS = [
    (
        "Simulator Screenshot - iPhone 17 Pro Max - 2026-09-13 at 14.28.21.png",
        ["One cave.", "Every player.", "Every day."], 1,
        "One daily corridor for the whole world",
    ),
    (
        "Simulator Screenshot - iPhone 17 Pro Max - 2026-09-13 at 14.28.33.png",
        ["Hold to climb.", "Release to fall.", "Go deep."], 0,
        "One button. That is the whole game",
    ),
    (
        "Simulator Screenshot - iPhone 17 Pro Max - 2026-09-13 at 14.28.47.png",
        # "Seven" dropped (2026-09-14) - the coin roster has grown/shifted since
        # the 7.0-era copy this replaces, and pinning a number here means
        # re-editing marketing copy every time the roster changes. Qualitative,
        # like the buff/nerf rule (CLAUDE.md "Marketing: no stat numbers").
        ["Power-ups.", "One corridor", "that keeps shrinking."], 1,
        "Shield, magnet, slow-time, bombs and more",
    ),
    (
        "Simulator Screenshot - iPhone 17 Pro Max - 2026-09-13 at 14.28.54.png",
        ["Die. Check your", "world rank.", "Go again."], 1,
        "Live daily leaderboard the moment you crash",
    ),
    (
        "/tmp/settings.png",  # captured live from the web build itself (frosted-glass panel)
        ["Fifteen languages.", "No tutorial.", "Just fly."], 0,
        "Pick up and play in seconds",
    ),
]

for idx, (fname, lines, accent, sub) in enumerate(CARDS, 1):
    shot = fname if os.path.isabs(fname) else os.path.join(SRC_12, fname)
    out_path = os.path.join(OUT, "%02d.png" % idx)
    mpf.build(shot, out_path, lines, accent, sub, seed=idx * 3 + 1)
