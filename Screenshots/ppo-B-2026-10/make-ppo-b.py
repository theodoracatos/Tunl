#!/usr/bin/env python3
"""TUNL App Store product-page test (Produktseitenoptimierung), treatment B, 2026-10.

The first three portrait slides rebuilt from three dense captures in three day palettes
(star on Io/teal, laser on Mars/orange, star on Rhodia/pink) so the search card shows
action and "a new cave every day" at a glance. Same template as make-store-portraits.py
(imported, per-slide palette/zoom/copy overrides). Slides 4-6 stay the control's.
Captures: raw/ (headless capture tool, days 20261001 / 20260929 / 20260927).
Run: python3 Screenshots/ppo-B-2026-10/make-ppo-b.py
"""
import importlib.util, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('msp', os.path.join(HERE, '..', 'make-store-portraits.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
PAL = {  # constants.js WEEKDAY_PALETTES: wall, stal, stalEdge, wallBase
    'io':     ((15, 15, 21), (12, 12, 17), (122, 255, 210), (112, 255, 206)),
    'mars':   ((60, 36, 22), (51, 32, 15), (255, 162, 92), (255, 148, 72)),
    'rhodia': ((48, 22, 34), (40, 18, 28), (255, 140, 190), (255, 122, 176)),
}
SLIDES = [('star-io', 'io', (700, 800, 1150)), ('laser-mars', 'mars', (1100, 640, 1240)), ('star-rhodia', 'rhodia', (1000, 660, 1240))]
COPY = {
    'en': [(["Tap to fly.", "Smash through."], "One button. A new cave every day."),
           (["Burn through", "the rock."], "Lasers, shields, magnets and more"),
           (["One cave a day.", "Same for everyone."], "Who flies the furthest today?")],
    'de': [(["Tippen. Fliegen.", "Alles zerlegen."], "Ein Knopf. Jeden Tag eine neue Höhle."),
           (["Brenn dich durch", "den Fels."], "Laser, Schilde, Magnete und mehr"),
           (["Eine Höhle pro Tag.", "Für alle dieselbe."], "Wer fliegt heute am weitesten?")],
}
for loc, copy in COPY.items():
    for size in ('portrait-6.9in', 'portrait-6.5in'):
        os.makedirs(os.path.join(HERE, loc, size), exist_ok=True)
    for i, (cap, pal, zoom) in enumerate(SLIDES):
        m.H = 2868
        m.WALL, m.STAL, m.ROSE_EDGE, m.ROSE = PAL[pal]
        m.ZOOM = [zoom] * 6; m.ACCENT = [1] * 6; m.COPY = {loc: [copy[i]] * 6}
        shot = Image.open(os.path.join(HERE, 'raw', 'capture-%s.png' % cap)).convert('RGB')
        im = m.build(shot, i, loc)
        im.save(os.path.join(HERE, loc, 'portrait-6.9in', '%02d.png' % (i + 1)), optimize=True)
        m.to_65(im).save(os.path.join(HERE, loc, 'portrait-6.5in', '%02d.png' % (i + 1)), optimize=True)
print('done')
