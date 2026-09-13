// TUNL brand ship glyph generator.
//
// The icon identity is the player ship, so the branding masters have to carry the
// SAME hull the game draws - which since 12.0 is the faceted K5 "Facette + Licht"
// ship (src/draw.js SHIP_OUTLINE / SHIP_FACETS / drawShip). The old masters still
// held the pre-12.0 needle (nose 1.72r, span 0.92r, smooth white fill), so the
// app icon, both splash screens, every favicon and the Play feature graphic showed
// a ship that no longer exists in the game.
//
// Hand-maintaining 14 facet polygons across four SVG files is how they drift apart
// again, so this script is the single source: it prints the ship as a self-contained
// SVG fragment (own <defs>, id-prefixed) in r units, nose pointing +x, centred on
// the origin. Each master keeps its own outer transform and background; only the
// fragment between the BEGIN/END markers is generated.
//
//   node branding/gen-ship-glyph.mjs --list        # show the targets
//   node branding/gen-ship-glyph.mjs --write       # rewrite all masters in place
//   node branding/gen-ship-glyph.mjs --r=130       # print one fragment to stdout
//
// After --write, re-run branding/export-icons.sh to push the rasters into iOS,
// Android and the site.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Geometry, mirrored from src/draw.js (keep in sync) ────────────────────────
const SHIP_OUTLINE = (() => {
    const top = [[1.40,0],[0.95,-0.13],[0.30,-0.20],[-0.60,-0.98],[-0.72,-0.94],
                 [-1.00,-0.24],[-1.22,-0.38],[-1.04,-0.10],[-0.92,0]];
    return top.concat(top.slice(1, -1).reverse().map(p => [p[0], -p[1]]));
})();
const SHIP_FACETS = [
    { p: [[1.40,0],[0.95,-0.13],[0.95,0]],                              top: 0.46, bot: -0.04 },
    { p: [[0.95,0],[0.95,-0.13],[0.30,-0.20],[0.30,0]],                 top: 0.30, bot: -0.20 },
    { p: [[0.30,0],[0.30,-0.20],[-1.00,-0.24],[-1.04,-0.10],[-0.92,0]], top: 0.16, bot: -0.32 },
    { p: [[0.30,-0.20],[-0.15,-0.59],[-0.86,-0.59],[-1.00,-0.24]],      top: 0.06, bot: -0.40 },
    { p: [[0.30,-0.20],[-0.60,-0.98],[-0.50,-0.72],[0.12,-0.26]],       top: 0.26, bot: -0.22 },
    { p: [[-0.15,-0.59],[-0.60,-0.98],[-0.72,-0.94],[-0.86,-0.59]],     top: -0.08, bot: -0.54 },
    { p: [[-1.00,-0.24],[-1.22,-0.38],[-1.04,-0.10]],                   top: 0.22, bot: -0.26 },
];
const NOZZLE_X = -0.92, NOZZLE_Y = 0.50;
const SHIP_DARK = [6, 8, 16], SHIP_WHITE = [255, 255, 255];

// Bbox of the hull in r units: nose +1.40, fin -1.22, so the visual centre of the
// sprite sits 0.09r ahead of the pivot drawShip() rotates about. Masters undo that
// with an inner translate so the drawn ship is centred in the canvas, not the pivot.
export const SHIP_CENTRE_X = (1.40 + -1.22) / 2;

// ── Colour ───────────────────────────────────────────────────────────────────
const lerpClr = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = c => '#' + c.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
const n = v => Number(v.toFixed(2));

// darkMix damps the shadow side. In game the hull sits against lit cave rock; an icon
// sits on #04040e, where a facet mixed 54% toward near-black merges into the
// background and the silhouette loses its lower wing at favicon size. 1 = exactly
// the in-game tones.
function tones(base, glow, darkMix) {
    const light = lerpClr(SHIP_WHITE, glow, 0.15);
    return k => hex(k >= 0 ? lerpClr(base, light, k) : lerpClr(base, SHIP_DARK, -k * darkMix));
}

const poly = (pts, r, sy = 1) =>
    pts.map((p, i) => `${i ? 'L' : 'M'} ${n(p[0] * r)} ${n(p[1] * r * sy)}`).join(' ') + ' Z';

// ── Fragment ─────────────────────────────────────────────────────────────────
// Mirrors drawShip()'s own draw order: halo, base fill, lit facets + seams, shadow
// facets + seams, spine/leading edge, nacelles (pod, inlet, nozzle, emissive ring),
// canopy, wingtip strobes. The animated spine running lights are left out - a logo
// is one frame, and four chasing dots read as dirt on the hull.
export function shipGlyph(opt = {}) {
    const r        = opt.r ?? 130;
    const p        = opt.prefix ?? 'sg';
    const base     = opt.base ?? [232, 238, 255];          // SKINS[0] PEARL #e8eeff
    const glow     = opt.glow ?? [210, 220, 255];          // SKINS[0] shadow
    const darkMix  = opt.darkMix ?? 0.62;
    const haloBlur = opt.haloBlur ?? r * 0.105;
    const jetLen   = opt.jetLen ?? 1.30;                   // in r units, from the nozzle
    const jetBlur  = opt.jetBlur ?? r * 0.075;
    const tone     = tones(base, glow, darkMix);
    const g        = glow.join(',');
    const lw       = Math.max(r * 0.016, 0.45);
    const out      = [];
    const add      = (s = '') => out.push(s);

    const hull = poly(SHIP_OUTLINE, r);
    const nx = NOZZLE_X * r, jL = jetLen * r, jW = r * 0.21;

    add(`<defs>`);
    add(`  <filter id="${p}Halo" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${n(haloBlur)}"/></filter>`);
    add(`  <filter id="${p}Jet" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${n(jetBlur)}"/></filter>`);
    add(`  <linearGradient id="${p}JetGrd" gradientUnits="userSpaceOnUse" x1="${n(nx - jL)}" y1="0" x2="${n(nx)}" y2="0">`);
    add(`    <stop offset="0%" stop-color="rgb(${g})" stop-opacity="0"/>`);
    add(`    <stop offset="55%" stop-color="rgb(${g})" stop-opacity="0.34"/>`);
    add(`    <stop offset="100%" stop-color="#fff5d7" stop-opacity="0.85"/>`);
    add(`  </linearGradient>`);
    add(`  <linearGradient id="${p}JetCore" gradientUnits="userSpaceOnUse" x1="${n(nx - jL * 0.55)}" y1="0" x2="${n(nx)}" y2="0">`);
    add(`    <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>`);
    add(`    <stop offset="60%" stop-color="#fdfbf2" stop-opacity="0.55"/>`);
    add(`    <stop offset="100%" stop-color="#fffdf4" stop-opacity="0.95"/>`);
    add(`  </linearGradient>`);
    for (const s of [-1, 1]) {
        const cy = s * r * NOZZLE_Y, tag = s < 0 ? 'T' : 'B';
        add(`  <radialGradient id="${p}Noz${tag}" gradientUnits="userSpaceOnUse" cx="${n(nx)}" cy="${n(cy)}" r="${n(r * 0.12)}">`);
        add(`    <stop offset="0%" stop-color="#fffae1" stop-opacity="0.95"/>`);
        add(`    <stop offset="50%" stop-color="rgb(${g})" stop-opacity="0.6"/>`);
        add(`    <stop offset="100%" stop-color="rgb(${g})" stop-opacity="0"/>`);
        add(`  </radialGradient>`);
        add(`  <radialGradient id="${p}Strb${tag}" gradientUnits="userSpaceOnUse" cx="${n(-r * 0.66)}" cy="${n(s * r * 0.955)}" r="${n(r * 0.16)}">`);
        add(`    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8"/>`);
        add(`    <stop offset="30%" stop-color="rgb(${g})" stop-opacity="0.5"/>`);
        add(`    <stop offset="100%" stop-color="rgb(${g})" stop-opacity="0"/>`);
        add(`  </radialGradient>`);
    }
    add(`</defs>`);
    add();

    // Twin nacelle plumes, drawn first so they read as trailing. drawThrustPlume()
    // tints these with the skin glow (PEARL's is already the cool white-blue the old
    // single cone was hand-picked to be), with a hot core inside a softer teardrop.
    add(`<!-- thrust: one plume per nacelle, from SHIP_NOZZLE_X/Y -->`);
    for (const s of [-1, 1]) {
        const cy = s * r * NOZZLE_Y;
        const drop = (len, wd) => `M ${n(nx)} ${n(cy - wd)} `
            + `C ${n(nx - len * 0.22)} ${n(cy - wd * 1.3)} ${n(nx - len * 0.6)} ${n(cy - wd * 0.55)} ${n(nx - len)} ${n(cy)} `
            + `C ${n(nx - len * 0.6)} ${n(cy + wd * 0.55)} ${n(nx - len * 0.22)} ${n(cy + wd * 1.3)} ${n(nx)} ${n(cy + wd)} Z`;
        add(`<path d="${drop(jL, jW)}" fill="url(#${p}JetGrd)" filter="url(#${p}Jet)"/>`);
        add(`<path d="${drop(jL * 0.55, jW * 0.40)}" fill="url(#${p}JetCore)"/>`);
    }
    add();

    add(`<!-- hull: halo, base fill, then the facet lighting -->`);
    add(`<path d="${hull}" fill="${hex(lerpClr(base, glow, 0.35))}" opacity="0.44" filter="url(#${p}Halo)"/>`);
    add(`<path d="${hull}" fill="${hex(base)}"/>`);
    for (const sy of [-1, 1]) {
        const lit = sy < 0;
        add(`<g>`);
        for (const f of SHIP_FACETS) add(`  <path d="${poly(f.p, r, -sy)}" fill="${tone(lit ? f.top : f.bot)}"/>`);
        // Seams: one faint light (top) / dark (bottom) hairline pass, never black ink.
        add(`  <path d="${SHIP_FACETS.map(f => poly(f.p, r, -sy)).join(' ')}" fill="none"`
            + ` stroke="${lit ? '#ffffff' : '#000000'}" stroke-opacity="${lit ? 0.10 : 0.09}"`
            + ` stroke-width="${n(lw)}" stroke-linejoin="round"/>`);
        add(`</g>`);
    }
    add();

    add(`<!-- spine ridge + lit leading edge -->`);
    add(`<path d="M ${n(r * 1.40)} ${n(-r * 0.004)} L ${n(-r * 0.92)} ${n(-r * 0.004)}" fill="none" stroke="#ffffff" stroke-opacity="0.42" stroke-width="${n(Math.max(r * 0.028, 0.6))}"/>`);
    add(`<path d="M ${n(r * 1.40)} 0 L ${n(r * 0.95)} ${n(-r * 0.13)} L ${n(r * 0.30)} ${n(-r * 0.20)} L ${n(-r * 0.60)} ${n(-r * 0.98)}" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="${n(Math.max(r * 0.035, 0.7))}" stroke-linecap="round" stroke-linejoin="round"/>`);
    add();

    add(`<!-- engine nacelles: faceted pod, shock-cone inlet, hot nozzle, emissive ring -->`);
    const x0 = nx, x1 = r * 0.12, xm = r * 0.02, xr = -r * 0.80, h = r * 0.09, ix = r * 0.03;
    for (const s of [-1, 1]) {
        const cy = s * r * NOZZLE_Y, tag = s < 0 ? 'T' : 'B', d = r * 0.03;
        add(`<path d="M ${n(x1)} ${n(cy + d)} L ${n(xm)} ${n(cy - h + d)} L ${n(xr)} ${n(cy - h + d)} L ${n(x0)} ${n(cy + d)} L ${n(xr)} ${n(cy + h + d)} L ${n(xm)} ${n(cy + h + d)} Z" fill="${hex(lerpClr(base, SHIP_DARK, 0.75))}" fill-opacity="0.45"/>`);
        add(`<path d="M ${n(x1)} ${n(cy)} L ${n(xm)} ${n(cy - h)} L ${n(xr)} ${n(cy - h)} L ${n(x0)} ${n(cy - h * 0.45)} L ${n(x0)} ${n(cy)} Z" fill="${tone(0.24)}"/>`);
        add(`<path d="M ${n(x1)} ${n(cy)} L ${n(xm)} ${n(cy + h)} L ${n(xr)} ${n(cy + h)} L ${n(x0)} ${n(cy + h * 0.45)} L ${n(x0)} ${n(cy)} Z" fill="${tone(-0.42)}"/>`);
        add(`<ellipse cx="${n(ix)}" cy="${n(cy)}" rx="${n(r * 0.03)}" ry="${n(r * 0.062)}" fill="${hex(lerpClr(base, SHIP_DARK, 0.62))}" fill-opacity="0.9"/>`);
        add(`<path d="M ${n(ix + r * 0.10)} ${n(cy)} L ${n(ix)} ${n(cy - r * 0.03)} L ${n(ix)} ${n(cy + r * 0.03)} Z" fill="${hex(lerpClr(base, lerpClr(SHIP_WHITE, glow, 0.15), 0.5))}" fill-opacity="0.9"/>`);
        add(`<ellipse cx="${n(x0)}" cy="${n(cy)}" rx="${n(r * 0.05)}" ry="${n(r * 0.095)}" fill="url(#${p}Noz${tag})"/>`);
        add(`<ellipse cx="${n(ix)}" cy="${n(cy)}" rx="${n(r * 0.045)}" ry="${n(r * 0.075)}" fill="none" stroke="rgb(${g})" stroke-opacity="0.22" stroke-width="${n(Math.max(r * 0.06, 1.2))}"/>`);
        add(`<ellipse cx="${n(ix)}" cy="${n(cy)}" rx="${n(r * 0.045)}" ry="${n(r * 0.075)}" fill="none" stroke="#f2f6ff" stroke-opacity="0.8" stroke-width="${n(Math.max(r * 0.022, 0.7))}"/>`);
    }
    add();

    add(`<!-- cockpit canopy: two glass facets + a glint -->`);
    add(`<path d="M ${n(r * 1.12)} 0 L ${n(r * 0.93)} ${n(-r * 0.078)} L ${n(r * 0.66)} ${n(-r * 0.052)} L ${n(r * 0.60)} 0 Z" fill="#afe1fa" fill-opacity="0.97"/>`);
    add(`<path d="M ${n(r * 1.12)} 0 L ${n(r * 0.60)} 0 L ${n(r * 0.66)} ${n(r * 0.052)} L ${n(r * 0.93)} ${n(r * 0.078)} Z" fill="#0e223e" fill-opacity="0.96"/>`);
    add(`<path d="M ${n(r * 0.98)} ${n(-r * 0.052)} L ${n(r * 0.76)} ${n(-r * 0.046)}" fill="none" stroke="#ffffff" stroke-opacity="0.95" stroke-width="${n(Math.max(r * 0.022, 0.5))}"/>`);
    add();

    add(`<!-- wingtip strobes (one frame of the in-game blink) -->`);
    for (const s of [-1, 1]) {
        const tag = s < 0 ? 'T' : 'B';
        add(`<circle cx="${n(-r * 0.66)}" cy="${n(s * r * 0.955)}" r="${n(r * 0.16)}" fill="url(#${p}Strb${tag})"/>`);
    }
    return out.join('\n');
}

// ── Master files ─────────────────────────────────────────────────────────────
// Each entry names the file plus the fragment options it wants. The outer
// transform, background and everything else stay hand-authored in the file; only
// what sits between the markers is replaced.
const BEGIN = '<!-- BEGIN generated ship: branding/gen-ship-glyph.mjs';
const END   = '<!-- END generated ship -->';
const TARGETS = [
    { file: 'branding/icon-mark.svg',               prefix: 'im' },
    { file: 'branding/icon-adaptive-foreground.svg', prefix: 'af' },
    { file: 'branding/ios-launch-logo.svg',          prefix: 'll' },
    { file: 'branding/feature-graphic.svg',          prefix: 'fg', haloBlur: 16 },
];

function indentBlock(s, pad) {
    return s.split('\n').map(l => (l ? pad + l : l)).join('\n');
}

function writeTargets() {
    for (const t of TARGETS) {
        const path = join(ROOT, t.file);
        const src  = readFileSync(path, 'utf8');
        const i = src.indexOf(BEGIN), j = src.indexOf(END);
        if (i < 0 || j < 0) { console.error(`  SKIP ${t.file} (no generated-ship markers)`); continue; }
        const lineStart = src.lastIndexOf('\n', i) + 1;
        const pad  = src.slice(lineStart, i);
        const head = src.slice(i, src.indexOf('-->', i) + 3);
        const body = indentBlock(shipGlyph(t), pad);
        writeFileSync(path, src.slice(0, i) + head + '\n' + body + '\n' + pad + src.slice(j), 'utf8');
        console.log(`  wrote ${t.file}`);
    }
}

const argv = process.argv.slice(2);
if (argv.includes('--list')) {
    for (const t of TARGETS) console.log(t.file);
} else if (argv.includes('--write')) {
    writeTargets();
} else {
    const opt = {};
    for (const a of argv) {
        const m = /^--(\w+)=(.+)$/.exec(a);
        if (m) opt[m[1]] = isNaN(+m[2]) ? m[2] : +m[2];
    }
    console.log(shipGlyph(opt));
}
