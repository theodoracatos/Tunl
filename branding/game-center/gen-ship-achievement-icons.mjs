// Recipe for the 7 ship-unlock achievement icons (tunl_ach_ship_*), one per paid
// SKINS entry. Emits SVG masters; branding/export-icons.sh's rsvg-convert is what
// turns them into the 512x512 RGB PNGs App Store Connect and Play Console want.
//
// ── Why this file exists ─────────────────────────────────────────────────────
// All 40 achievement icons are live on both stores, but 18 of them were uploaded
// without their generator ever being committed, so they existed only as pixels
// (recovered from Apple's CDN on 2026-09-14 - see branding/README.md for that
// walk). These 7 are the subset worth a real recipe rather than a stored PNG,
// because they are the only ones derived from something that MOVES: the hull.
// After the 12.0 hull rework the app icon, both splash screens and every favicon
// still showed the pre-12.0 needle for weeks, precisely because they were
// hand-maintained copies of that geometry. These 7 were the last such copies left.
// The other 11 (first_flight, ace_pilot, master_fleet, ghost_hunter, new_legend,
// on_fire, score_*, streak_*) are bespoke motifs with nothing to drift against;
// they stay as committed PNGs and are documented as artifacts without a recipe.
//
// ── Why JavaScript, when the other three generators are Python ───────────────
// gen-planet-/gen-distance-/gen-flight-achievement-icons.py build their motifs
// with PIL, and matching them would mean a Python port of SHIP_OUTLINE,
// SHIP_FACETS and the facet tone maths - a THIRD hand-maintained copy of the
// exact geometry whose duplication caused the stale-icon problem above. Instead
// this imports shipGlyph() from ../gen-ship-glyph.mjs, which already mirrors
// src/draw.js and already feeds the four brand masters. The price is that the
// family's background has to be re-expressed as an SVG gradient instead of
// reusing radial_bg() from the Python side: ~15 lines, against duplicating the
// hull. That trade is the whole point of the file.
//
// ── The background, RECOVERED from the live icons, not guessed ───────────────
// The family is less uniform than the Python generators' comments claim: the v11
// batch (dodge_100) sits at (8,10,27), essentially BG_DARK, while the ship batch
// carries a full-bleed wash in the skin's own hue and never reaches it. So this
// mirrors the SHIP batch.
//
// The wash turned out to be exactly reconstructible. Every shipped ship icon's
// corner pixel is a straight mix of that skin's colour toward BG_DARK, and the
// implied mix is the same for all three channels and across ships:
//     amber 0.744  void 0.746  toxic 0.744  crimson 0.754  electric 0.734
//     (nova 0.668 and solaris 0.641 sit lower; nova is white, so its channel fit
//      is nearly degenerate, and solaris is the one genuine outlier - both are
//      within what one shared value can carry, and one system beats seven.)
// Sampling straight up from the centre, clear of the hull, the field is FLAT at
// 0.61 from the frame edge inward and only darkens in the corners - (80,55,117)
// identical at y=4, y=20 and y=40 on ship_void. So it is a flat wash plus a corner
// vignette, not a centre-out gradient, and the stops below say exactly that.
// Re-measure with: mix t solved per channel from corner pixel vs SKINS colour.
//
// ── Running it ───────────────────────────────────────────────────────────────
//   node branding/game-center/gen-ship-achievement-icons.mjs            (dry run)
//   node branding/game-center/gen-ship-achievement-icons.mjs --write    (SVG masters)
//   node branding/game-center/gen-ship-achievement-icons.mjs --print=ship_void
// The dry run writes NOTHING and prints the derived palette per ship, so the
// recipe can be reviewed without touching the icons that are currently live.
//
// **The generated output is not pixel-identical to the icons on the stores.**
// It cannot be: the originals came from an unknown script. Treat the shipped PNGs
// as reference, not as a target to match to the pixel. Whenever this is run for
// real, its output becomes the source of truth and must be UPLOADED to ASC and
// Play - otherwise the repo and the stores disagree, which is worse than having
// no generator at all.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shipGlyph } from '../gen-ship-glyph.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT  = join(HERE, 'svg');

const SIZE = 512;

// Shared navy every achievement icon is mixed toward. Same value the Python
// generators use as BG_DARK, and the app icon's own ground.
const BG_DARK = [7, 9, 27];
// How far the background is mixed from the skin colour toward BG_DARK. Both are
// measured off the shipped icons (see the header), not chosen by eye: a flat field
// at BG_BASE_MIX out to VIGNETTE_START of the corner distance, then darkening to
// BG_CORNER_MIX in the corners.
const BG_BASE_MIX     = 0.61;
const BG_CORNER_MIX   = 0.745;
const VIGNETTE_START  = 0.70;
// The hull's radius in the 512 frame. The glyph's own halo reaches ~1.6r, so this
// keeps the wingtips and the halo clear of the edge at icon sizes.
const SHIP_R = 132;
// Damping of the shadow-side facets. Same reason gen-ship-glyph.mjs damps them for
// the brand marks: against a dark ground a facet mixed far toward near-black
// disappears and the silhouette loses its lower wing at small sizes. The ship
// batch sits on a LIGHTER, hue-washed ground than the app icon, so it needs less
// damping than the marks' 0.62.
const DARK_MIX = 0.74;

// Mirrored from src/constants.js SKINS (indices 1..7; index 0 is PEARL, the free
// starter ship, which has no unlock achievement - hence no entry here). The
// achievement ids are src/constants.js SKIN_ACHIEVEMENTS, index-aligned with SKINS.
// Kept as an explicit table rather than parsed out of constants.js: a silent
// re-order there should fail loudly at review, not quietly repaint seven icons.
const SHIPS = [
    { id: 'ship_amber',    name: 'AMBER',    base: '#ffaa00', glow: [255, 155, 0] },
    { id: 'ship_crimson',  name: 'CRIMSON',  base: '#ff1a33', glow: [255,  30, 55] },
    { id: 'ship_electric', name: 'ELECTRIC', base: '#00ccff', glow: [0,   190, 255] },
    { id: 'ship_toxic',    name: 'TOXIC',    base: '#99ff00', glow: [140, 255, 0] },
    { id: 'ship_void',     name: 'VOID',     base: '#c080ff', glow: [180,  90, 255] },
    { id: 'ship_nova',     name: 'NOVA',     base: '#ffffff', glow: [255, 255, 255] },
    { id: 'ship_solaris',  name: 'SOLARIS',  base: '#ff6600', glow: [255, 100, 0] },
];

const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
const lerpClr  = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgbStr   = c => `rgb(${c[0]},${c[1]},${c[2]})`;

// One icon's SVG. Background wash, then the glyph on top, nose-right like every
// other surface that shows the ship.
function iconSvg(ship) {
    const base   = hexToRgb(ship.base);
    const field  = lerpClr(base, BG_DARK, BG_BASE_MIX);
    const corner = lerpClr(base, BG_DARK, BG_CORNER_MIX);
    const p      = ship.id.replace(/[^a-z]/g, '');
    const body   = shipGlyph({
        r: SHIP_R,
        prefix: p,
        base,
        glow: ship.glow,
        darkMix: DARK_MIX,
        haloBlur: SHIP_R * 0.14,   // a touch wider than the marks: more room here
    }).split('\n').map(l => (l ? '    ' + l : l)).join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <!-- ${ship.name} unlock achievement (tunl_ach_${ship.id}).
       Generated by branding/game-center/gen-ship-achievement-icons.mjs - do not
       hand-edit; the hull comes from src/draw.js via gen-ship-glyph.mjs. -->
  <defs>
    <!-- r=71% so the gradient's 100% lands on the CORNER (the corner sits at
         70.7% of the frame's half-width). Flat to VIGNETTE_START, then the
         corner falloff - which is what the shipped icons actually do. -->
    <radialGradient id="${p}Bg" cx="50%" cy="50%" r="71%">
      <stop offset="0%"                    stop-color="${rgbStr(field)}"/>
      <stop offset="${VIGNETTE_START * 100}%" stop-color="${rgbStr(field)}"/>
      <stop offset="100%"                  stop-color="${rgbStr(corner)}"/>
    </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#${p}Bg)"/>
  <g transform="translate(${SIZE / 2} ${SIZE / 2})">
${body}
  </g>
</svg>
`;
}

const argv = process.argv.slice(2);
const one  = (argv.find(a => a.startsWith('--print=')) || '').split('=')[1];

if (one) {
    const s = SHIPS.find(x => x.id === one);
    if (!s) { console.error(`unknown ship: ${one}`); process.exit(1); }
    console.log(iconSvg(s));
} else if (argv.includes('--write')) {
    mkdirSync(OUT, { recursive: true });
    for (const s of SHIPS) {
        writeFileSync(join(OUT, `${s.id}.svg`), iconSvg(s), 'utf8');
        console.log(`  wrote svg/${s.id}.svg`);
    }
    console.log(`\nRasterise with:`);
    console.log(`  for f in ${OUT}/*.svg; do rsvg-convert -w 512 -h 512 "$f" -o "\${f%.svg}.png"; done`);
    console.log(`then flatten to RGB (ASC/Play reject alpha) and re-upload to BOTH stores -`);
    console.log(`the generated art is the source of truth once it ships, see this file's header.`);
} else {
    // Dry run: nothing is written. Prints the derived palette so the recipe can be
    // checked against the live icons' measured corners without regenerating them.
    console.log('Dry run - no files written. Pass --write to emit the SVG masters.\n');
    console.log('ship           base      field          corner         live corner (measured)  delta');
    // Corner pixel of each SHIPPED icon, read off the recovered PNGs on 2026-09-14.
    const LIVE = { ship_amber: [70,50,20], ship_crimson: [70,13,33], ship_electric: [5,59,85],
                   ship_toxic: [44,72,20], ship_void: [54,39,85], ship_nova: [87,88,107],
                   ship_solaris: [94,42,17] };
    for (const s of SHIPS) {
        const base = hexToRgb(s.base);
        const f = lerpClr(base, BG_DARK, BG_BASE_MIX), k = lerpClr(base, BG_DARK, BG_CORNER_MIX);
        const live = LIVE[s.id];
        const d = live ? Math.round(Math.max(...k.map((v, i) => Math.abs(v - live[i])))) : '';
        console.log(
            `${s.id.padEnd(14)} ${s.base}  ${rgbStr(f).padEnd(14)} ${rgbStr(k).padEnd(14)} ` +
            `${(live ? rgbStr(live) : '').padEnd(16)} ${d === '' ? '' : 'max ' + d}`);
    }
    console.log(`\n${SHIPS.length} icons, hull r=${SHIP_R} in a ${SIZE}px frame, darkMix=${DARK_MIX}.`);
    console.log('Geometry comes from src/draw.js SHIP_OUTLINE/SHIP_FACETS via gen-ship-glyph.mjs,');
    console.log('so a hull change reaches these icons by re-running this - that is the point.');
}
