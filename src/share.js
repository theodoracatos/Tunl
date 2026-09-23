// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── Daily run card ────────────────────────────────────────────────────
// TUNL already generates one identical cave for every player on Earth each day
// (lifecycle.js seeds every run from the UTC date), which is the hard half of a
// shareable daily game. This file is the other half: a picture of the run that can
// leave the app.
//
// The card is deliberately a picture of the *run*, not a score badge. The corridor is a
// pure function of world-x (world.js boundsBase), so the whole flown tunnel can be
// redrawn compressed into a strip, with the death point marked and the all-time best
// marked beside it -- something no score screenshot can show, and something only this
// game can draw, because only this game's world is reproducible from a date.

// Where a recipient goes to get the game, printed on every shared card. Confirmed by the
// user 2026-08-21 as the site root, not a /tunl subpath. Switched from schedly.ch to
// flytunl.ch 2026-08-29 as part of the cutover to the new dedicated domain (see the
// project_flytunl_site memory) -- schedly.ch's own wwwroot/tunl pages (see the release
// command and the reference_store_listing_urls memory) are unaffected by this change.
// This is the only place the public URL is written down in this repo.
const SHARE_URL = 'https://flytunl.ch';

// Cap on the base64 ghost carried in a web share link (shareRunUrl below). The
// ghost is roughly one byte per point of score, so this is about 1100 score
// points of run - longer runs still share, just without the ghost (?d cave +
// ?s score keep the link a real challenge). Holds the whole URL well under what
// chat apps and browsers accept.
const SHARE_GHOST_MAX_B64 = 1500;

// The card's two cuts live in _shareCardCanvas below (landscape 1200x630 for the
// desktop copy, portrait 1080x1350 for a share sheet); the old single SHARE_W/SHARE_H
// pair is gone with them.

// Share is offered only when the run is actually worth showing someone. A share button
// on every death is a nag; on a personal best it's a reward. Kept in one place so the
// button (draw.js) and the tap handler (input.js) can never disagree about it.
// SHARE_MIN_SCORE guards the personal-best path: a player's first-ever run is a "new
// best" by definition, and offering to broadcast a score of 9 is embarrassing rather
// than rewarding. Reuses the game-wide MIN_REAL_RUN_SCORE (constants.js) rather than
// carrying its own copy of the number - it was a hardcoded 25, which the 12.0 safe
// opening flight turned into a no-op, since no completed run scores under 50.
const SHARE_MIN_SCORE = MIN_REAL_RUN_SCORE;
// How close to the bar a run has to come to still be worth offering, as a fraction of
// today's best (falling back to the all-time best on the day's first run, the same
// _fireBar rule update.js uses for ON FIRE). See the gate discussion below.
const SHARE_NEAR_BEST = 0.90;
function shareWorthy() {
    // The web build is an acquisition funnel: every shared run is a tap-to-play
    // link for someone new, so drop the "was this a good run" gate the app uses
    // (a share button on every death reads as a nag in a retention product, but
    // as the point of the thing here) and offer it on any run past the instant-
    // faceplant floor.
    if (typeof isWeb === 'function' && isWeb()) return score >= SHARE_MIN_SCORE;
    // The app gate was `score >= 200 || ((newBest || newDailyBest) && score >= 75)`,
    // which runs BACKWARDS to the pride curve. A new player's every run is a personal
    // best by definition, so the button is on constantly in week one - and then, once
    // the all-time best has settled above what a normal session reaches, it goes dark
    // exactly when the player starts having runs worth showing. Measured against the
    // red-team sample (median real run ~22, median daily best ~70) almost nothing in
    // the long tail of a real player's week clears either branch.
    //
    // A daily game's share beat is the DAY, not the career: a run that lands near
    // today's bar is the shareable one, and today's bar resets every morning, so this
    // keeps offering without ever becoming the nag the web branch above accepts.
    if (score < SHARE_MIN_SCORE) return false;
    if (newBest || newDailyBest || score >= 200) return true;
    const bar = dailyBest || best;
    return bar > 0 && score >= bar * SHARE_NEAR_BEST;
}

// True when there's somewhere for the card to actually go: the native share sheet on
// iOS/Android, the Web Share API on mobile browsers, or - on a desktop browser with
// neither - a clipboard copy of the deep link (shareRun() handles that fallback).
function shareAvailable() {
    return !!(window.webkit?.messageHandlers?.share)
        || (typeof navigator !== 'undefined' && !!navigator.share)
        || (typeof isWeb === 'function' && isWeb()
            && typeof navigator !== 'undefined' && !!navigator.clipboard);
}

// The corridor the player actually FLEW, for the card's picture only.
//
// boundsBase() alone is no longer that picture. The 12.0 safe opening flight pushes
// the walls out to the screen edges for the first SAFE_START_WX of every run, and by
// deliberate design that widening lives in boundsAt() only - never in boundsBase(),
// because nothing about where an object gets PLACED may depend on it (see world.js).
// The card kept sampling boundsBase and so drew a normal, narrowing corridor across a
// stretch where the player had no walls to speak of and could not be killed by them.
// That is a fixed 3000 world-px, so it dominates exactly the runs that get shared:
// two thirds of the strip at score 75 (the share floor itself), half at 95, a third at
// 155. A card of a short run and a card of a middling one told the same story.
//
// This mirrors boundsAt()'s safe-zone branch and nothing else - no gapBonus, no warp,
// no per-player state - so the profile stays a pure function of world-x and renders
// identically on every device, which is the property the whole card depends on. The
// constants are read directly rather than through safeOpenAt(), so this does not
// depend on run state still being set when the death screen draws.
function _profileBounds(wx) {
    const bb = boundsBase(wx);
    if (wx >= SAFE_START_WX) return bb;
    const t = Math.min(1, (SAFE_START_WX - wx) / SAFE_CLOSE_WX);
    const o = t * t * (3 - 2 * t);
    return {
        top: Math.min(bb.top, lerp(bb.top, SAFE_OPEN_PAD, o)),
        bot: Math.max(bb.bot, lerp(bb.bot, H - SAFE_OPEN_PAD, o)),
    };
}

// ── Run profile ───────────────────────────────────────────────────────
// Draws the tunnel the player just flew into an arbitrary rect on any 2D context.
// Currently only the share card draws it (a faint death-screen backdrop version was
// removed -- see draw.js drawDeathScreen), but it stays context-agnostic so it can
// come back: the whole point of the picture is that only this game can draw it.
//
// `scale` multiplies line widths, glows and marker sizes so the same drawing reads
// correctly at card size (1060px wide) and at death-screen size (~340pt wide).
// `alpha` lets a caller fade it in with the rest of a panel.
// `accent` (RGB triplet) tints the lit corridor to the day's rock colour the same way
// the in-game wall glow does -- passed by the share card so it carries the day's world
// identity, not a fixed blue. Defaults to the old blue when omitted.
// Compact F-14 silhouette on an *arbitrary* 2D context. draw.js's shipPath() and
// drawShip() are both hard-bound to the game's `ctx` const, so they can't render onto
// the share card's offscreen canvas -- this is a trimmed copy (hull fill + a
// top-lit shading split + a canopy glint; no facets or nacelle pods) that takes the context
// as an argument. Kept here rather than refactoring draw.js so the card change stays
// self-contained. `k` scales the glow with the caller's overall scale factor.
function _shipGlyph(g, x, y, r, color, glow, k) {
    k = k || 1;
    // Same outline as draw.js SHIP_OUTLINE (the F-14 hull), copied for the reason above.
    const top = [[1.40,0],[1.22,-0.068],[1.02,-0.118],[0.80,-0.145],[0.02,-0.33],
                 [-0.058,-0.405],[-0.585,-0.785],[-0.674,-0.719],[-0.554,-0.347],
                 [-0.649,-0.303],[-0.92,-0.60],[-1.05,-0.60],[-1.00,-0.25],
                 [-0.99,-0.074],[-1.07,-0.044],[-1.07,0]];
    const pts = top.concat(top.slice(1, -1).reverse().map(p => [p[0], -p[1]]));
    const hull = () => {
        g.beginPath();
        g.moveTo(x + r*pts[0][0], y + r*pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(x + r*pts[i][0], y + r*pts[i][1]);
        g.closePath();
    };
    g.save();
    hull();
    g.fillStyle = color;
    g.shadowColor = glow;
    g.shadowBlur = 14 * k;
    g.fill();
    g.shadowBlur = 0;
    hull();
    // Top lit, bottom in shadow - the flat-shaded read of draw.js's facets.
    const bg = g.createLinearGradient(x, y - r*0.98, x, y + r*0.98);
    bg.addColorStop(0,    'rgba(255,255,255,0.22)');
    bg.addColorStop(0.49, 'rgba(255,255,255,0.10)');
    bg.addColorStop(0.51, 'rgba(0,0,0,0.20)');
    bg.addColorStop(1,    'rgba(0,0,0,0.48)');
    g.fillStyle = bg;
    g.fill();
    // Thin dark outline so the hull keeps its silhouette against any background --
    // in particular a red ship (CRIMSON) sitting inside the red crash ring below.
    hull();
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = Math.max(1, 1.4 * k);
    g.lineJoin = 'round';
    g.stroke();
    g.beginPath();
    g.ellipse(x + r*0.76, y - r*0.02, r*0.30, r*0.06, 0, 0, Math.PI*2);
    g.fillStyle = 'rgba(210,240,255,0.55)';
    g.fill();
    g.restore();
}

function drawRunProfile(g, x0, y0, w, h, opts) {
    opts = opts || {};
    const k = opts.scale === undefined ? 1 : opts.scale;
    const A = opts.alpha === undefined ? 1 : opts.alpha;
    const ac = opts.accent || [120, 160, 255];
    const showPB = opts.showPB !== false;
    // The death cross and PB tick are the subject on the share card, but landmarks the
    // backdrop use can't place safely -- they land wherever the run ended, which on the
    // death screen means on top of whatever text happens to be there. Off by request.
    const showMarker = opts.marker !== false;
    // Extra smoothing for the backdrop: what reads as cave texture at card size reads as
    // noise behind body text.
    const smoothMul = opts.smoothMul === undefined ? 1 : opts.smoothMul;

    const endWx = Math.max(lastRunWx, 1);
    // Extend the x-range past the run when the all-time best sits further in, so the
    // marker the player is chasing is always visible. Bounded so a short run still fills
    // most of the strip instead of shrinking to a stub next to a distant best.
    const wxMax = Math.max(endWx, Math.min(bestSX || 0, endWx * 1.6));
    const xOf = wx => x0 + (wx / wxMax) * w;
    const yOf = y  => y0 + (y / H) * h;

    // Sampled as a rolling average rather than point samples. Drawing boundsBase()
    // literally is accurate but unreadable on a deep run: the corridor's own waves have
    // a period of roughly 550-2500 world-px, so a score-500 run (~30000 px) packs ~60
    // full oscillations into the strip and renders as a seismograph rather than a cave.
    // The smoothing window scales with run length -- a short run gets almost none and
    // keeps its real shape, a long run resolves into the thing that actually matters at
    // a glance: the corridor drifting and narrowing the deeper the player got.
    // Cap raised 1300 -> 2200 and the sub-sample count 9 -> 15: at 1300/9 a
    // score-1000+ run still packed enough residual wave into the strip to read as a
    // jagged seismograph rather than a smooth drift. Short runs are unaffected (their
    // window is wxMax/12, well under either cap).
    const smoothWin = Math.min(wxMax / 12, 2200) * smoothMul;
    const SAMPLES = 420;
    const SUB = smoothWin > 1 ? 15 : 1;
    const tops = [], bots = [];
    for (let i = 0; i <= SAMPLES; i++) {
        const wx = (i / SAMPLES) * wxMax;
        let t = 0, b = 0;
        for (let j = 0; j < SUB; j++) {
            const off = SUB === 1 ? 0 : (j / (SUB - 1) - 0.5) * smoothWin;
            const bb = _profileBounds(Math.max(0, wx + off));
            t += bb.top; b += bb.bot;
        }
        tops.push([xOf(wx), yOf(t / SUB)]);
        bots.push([xOf(wx), yOf(b / SUB)]);
    }

    const flownX = xOf(endWx);

    // Corridor interior: the flown stretch is lit, whatever lies past it stays dark.
    // The picture should show where the run stopped, not imply it kept going.
    g.save();
    g.beginPath();
    g.moveTo(tops[0][0], tops[0][1]);
    for (const [x, y] of tops) g.lineTo(x, y);
    for (let i = bots.length - 1; i >= 0; i--) g.lineTo(bots[i][0], bots[i][1]);
    g.closePath();
    g.clip();
    const fill = g.createLinearGradient(0, y0, 0, y0 + h);
    fill.addColorStop(0,   `rgba(${ac[0]},${ac[1]},${ac[2]},${0.20 * A})`);
    fill.addColorStop(0.5, `rgba(${ac[0]},${ac[1]},${ac[2]},${0.07 * A})`);
    fill.addColorStop(1,   `rgba(${ac[0]},${ac[1]},${ac[2]},${0.20 * A})`);
    g.fillStyle = fill;
    g.fillRect(x0, y0, flownX - x0, h);
    g.fillStyle = `rgba(20,26,48,${0.55 * A})`;
    g.fillRect(flownX, y0, x0 + w - flownX, h);
    g.restore();

    // Walls, drawn twice and clipped at the death point: bright for the stretch actually
    // flown, dim for the rest. The fill difference alone was too subtle to read, and
    // "how much of this did I fly" is the whole story.
    g.save();
    g.lineJoin = 'round'; g.lineCap = 'round';
    const strokeWalls = (cx0, cx1, bright) => {
        g.save();
        g.beginPath(); g.rect(cx0, y0 - h, cx1 - cx0, h * 3); g.clip();
        for (const line of [tops, bots]) {
            g.beginPath();
            g.moveTo(line[0][0], line[0][1]);
            for (const [x, y] of line) g.lineTo(x, y);
            g.strokeStyle = bright ? `rgba(235,242,255,${0.95 * A})` : `rgba(95,120,175,${0.42 * A})`;
            g.lineWidth = Math.max(1, (bright ? 3 : 2) * k);
            if (bright) { g.shadowColor = `rgba(${ac[0]},${ac[1]},${ac[2]},${0.65 * A})`; g.shadowBlur = 12 * k; }
            g.stroke();
            g.shadowBlur = 0;
        }
        g.restore();
    };
    strokeWalls(x0, flownX, true);
    if (flownX < x0 + w) strokeWalls(flownX, x0 + w, false);
    g.restore();

    // All-time best marker: a quiet gold tick, only when it isn't the same spot as this
    // run's death (on a new personal best they coincide and one marker is enough).
    if (showMarker && showPB && bestSX > 0 && Math.abs(bestSX - endWx) > wxMax * 0.02 && bestSX <= wxMax) {
        const bx = xOf(bestSX);
        g.save();
        g.setLineDash([7 * k, 7 * k]);
        g.strokeStyle = `rgba(255,205,60,${0.55 * A})`;
        g.lineWidth = Math.max(1, 2 * k);
        g.beginPath(); g.moveTo(bx, y0 - 12 * k); g.lineTo(bx, y0 + h + 12 * k); g.stroke();
        g.restore();
        if (opts.pbLabel !== false) {
            g.textAlign = 'center';
            g.font = `bold ${19 * k}px ${FONT_UI}`;
            g.fillStyle = `rgba(255,215,90,${0.85 * A})`;
            g.fillText(T.pb, bx, y0 + h + 32 * k);
        }
    }

    // Other players' approximate death points on today's board (state.js rivalDeaths
    // doc): small, unlabeled dots. Unlike the PB tick above these carry no name -- this
    // canvas is the shareable card/backdrop, not a list, so it reads as a scatter
    // ("here's where others ended up"), not as individual callouts (those are the death
    // screen's named rival rows, draw.js). Gated on the same showMarker flag as the PB
    // tick and the ship below: nowhere this function is called wants landmarks without
    // also wanting this one. Position is the same score*GHOST_STEP approximation used
    // everywhere else rivalDeaths shows up.
    if (showMarker && rivalDeaths.length) {
        g.save();
        for (const rv of rivalDeaths) {
            const rwx = rv.score * GHOST_STEP;
            if (rwx <= 0 || rwx > wxMax) continue;
            const rb  = _profileBounds(rwx);
            const rx  = xOf(rwx), rym = yOf((rb.top + rb.bot) / 2);
            g.beginPath();
            g.arc(rx, rym, 2.4 * k, 0, Math.PI * 2);
            g.fillStyle = `rgba(220,228,255,${0.40 * A})`;
            g.fill();
        }
        g.restore();
    }

    // Death point -- the ship the run was actually flown in, at the spot it ended,
    // nose forward the way it flies in game (_shipGlyph above; draw.js's own ship
    // routines can't target this offscreen canvas). Skin colour so the card shows
    // *which* ship, wrapped in a red crash glow + ring so it still reads as "died
    // here", not "is here".
    if (showMarker) {
        const sk = (typeof SKINS !== 'undefined' && SKINS[activeSkin]) || { color: '#e8eeff', shadow: [210,220,255] };
        const r = 13 * k;
        const dx = xOf(endWx);
        // Clamp the glyph inside the strip so it never spills into the score row or
        // past the top wall -- the death x is what carries meaning, the exact y is
        // near-arbitrary on a strip this vertically compressed anyway.
        const ringR = r * 1.8;
        const dy = Math.max(y0 + ringR, Math.min(y0 + h - ringR, yOf(Math.max(0, Math.min(H, lastRunY)))));
        // Crash ring is white-hot with a red glow, not a red stroke: a red ring would
        // vanish against a red ship (CRIMSON). White + red glow reads as impact flash
        // regardless of skin colour.
        g.save();
        g.shadowColor = `rgba(255,60,60,${0.85 * A})`; g.shadowBlur = 20 * k;
        g.strokeStyle = `rgba(255,236,236,${0.92 * A})`;
        g.lineWidth = Math.max(1.2, 2.3 * k);
        g.beginPath(); g.arc(dx, dy, ringR, 0, Math.PI * 2); g.stroke();
        g.restore();
        // Hull in the player's paint (paint.js), glow in the ship's own light - the same
        // split the game draws, so a repainted ship still reads as itself.
        const kit = typeof paintOf === 'function' ? paintOf(activeSkin) : 0;
        _shipGlyph(g, dx, dy, r, kit && kit.c ? rgb(paintHullRgb(sk.color, kit)) : sk.color,
            `rgba(${sk.shadow[0]},${sk.shadow[1]},${sk.shadow[2]},${0.90 * A})`, k);
    }
}

// ── QR code ───────────────────────────────────────────────────────────
// A QR on the card, because the card keeps landing somewhere a URL cannot be
// tapped: a phone held out to a friend, a screenshot in a story, a frame of a
// TikTok clip. Byte mode, error correction level M, versions 1-9 - the payload
// is shareRunUrl(true) (the link WITHOUT the ghost, see there), which runs about
// 85 characters and lands on version 5 or 6, i.e. 37-41 modules. At the card's
// 104pt that is ~2.8pt per module, which scans off a screen at arm's length; the
// portrait cut gives it 200pt and scans from across a room. Carrying the ghost
// would push it past version 40 and make it unscannable at any size the card can
// afford, which is the whole reason for the compact variant.
//
// Self-contained rather than a library (no build step, no CDN in the apps) and
// kept here rather than in a 19th src file, since nothing but the card wants it.
const _QR_SPEC = {   // version: [data codewords, EC per block, [[blocks, data each], ...], byte capacity]
    1: [16,  10, [[1, 16]],          14],
    2: [28,  16, [[1, 28]],          26],
    3: [44,  26, [[1, 44]],          42],
    4: [64,  18, [[2, 32]],          62],
    5: [86,  24, [[2, 43]],          84],
    6: [108, 16, [[4, 27]],          106],
    7: [124, 18, [[4, 31]],          122],
    8: [154, 22, [[2, 38], [2, 39]], 152],
    9: [182, 22, [[3, 36], [2, 37]], 180],
};
const _QR_ALIGN = { 1: [], 2: [6,18], 3: [6,22], 4: [6,26], 5: [6,30], 6: [6,34],
                    7: [6,22,38], 8: [6,24,42], 9: [6,26,46] };
const _QR_VER   = { 7: 0x07C94, 8: 0x085BC, 9: 0x09A99 };   // version info, v7+
const _QR_FMT   = [0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0]; // level M x mask
const _QR_MASK  = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (((y / 2) | 0) + ((x / 3) | 0)) % 2 === 0,
    (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
    (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
];

let _qrExp = null, _qrLog = null;
function _qrGf() {
    if (_qrExp) return;
    _qrExp = new Uint8Array(512); _qrLog = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i++) { _qrExp[i] = x; _qrLog[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    for (let i = 255; i < 512; i++) _qrExp[i] = _qrExp[i - 255];
}
function _qrMul(a, b) { _qrGf(); return (a && b) ? _qrExp[_qrLog[a] + _qrLog[b]] : 0; }
function _qrEc(data, n) {
    _qrGf();
    let gp = [1];
    for (let i = 0; i < n; i++) {
        const ng = new Array(gp.length + 1).fill(0);
        for (let j = 0; j < gp.length; j++) { ng[j] ^= gp[j]; ng[j + 1] ^= _qrMul(gp[j], _qrExp[i]); }
        gp = ng;
    }
    const res = data.slice().concat(new Array(n).fill(0));
    for (let i = 0; i < data.length; i++) {
        const f = res[i];
        if (!f) continue;
        for (let j = 0; j < gp.length; j++) res[i + j] ^= _qrMul(gp[j], f);
    }
    return res.slice(data.length);
}

// Penalty scoring (the four rules of the spec). A decoder reads the mask out of the
// format bits, so any mask decodes -- the rules only decide how ROBUSTLY it scans,
// which is the whole point of putting this on a card someone photographs off a screen.
function _qrPenalty(m, n) {
    let p = 0, dark = 0;
    const PAT = [1,0,1,1,1,0,1,0,0,0,0];
    const run = line => {
        let c = line[0], len = 1;
        for (let i = 1; i < n; i++) {
            if (line[i] === c) { len++; continue; }
            if (len >= 5) p += 3 + (len - 5);
            c = line[i]; len = 1;
        }
        if (len >= 5) p += 3 + (len - 5);
    };
    const hasPat = (line, i, rev) => {
        for (let k = 0; k < 11; k++) if (line[i + k] !== PAT[rev ? 10 - k : k]) return false;
        return true;
    };
    for (let y = 0; y < n; y++) {
        const row = m[y], col = [];
        for (let x = 0; x < n; x++) { col.push(m[x][y]); dark += row[x]; }
        run(row); run(col);
        for (let i = 0; i + 10 < n; i++) {
            if (hasPat(row, i, false) || hasPat(row, i, true)) p += 40;
            if (hasPat(col, i, false) || hasPat(col, i, true)) p += 40;
        }
    }
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
        const v = m[y][x];
        if (m[y][x+1] === v && m[y+1][x] === v && m[y+1][x+1] === v) p += 3;
    }
    p += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
    return p;
}

// Returns { n, m } (m[y][x], 1 = dark) or null when the text does not fit / is not
// ASCII. Null is a normal outcome, not an error: the card simply draws no QR and
// gives the space back to the URL line.
function _qrMatrix(text) {
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
        const cc = text.charCodeAt(i);
        if (cc > 255) return null;
        bytes.push(cc);
    }
    let ver = 0;
    for (let v = 1; v <= 9; v++) if (bytes.length <= _QR_SPEC[v][3]) { ver = v; break; }
    if (!ver) return null;
    const [dcTotal, ecLen, spec] = _QR_SPEC[ver];

    // Bit stream: mode 4 (byte), 8-bit length (v1-9), payload, terminator, pad.
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    put(4, 4); put(bytes.length, 8);
    for (const b of bytes) put(b, 8);
    for (let i = 0; i < 4 && bits.length < dcTotal * 8; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const dc = [];
    for (let i = 0; i < bits.length; i += 8) {
        let v = 0;
        for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
        dc.push(v);
    }
    for (let i = 0; dc.length < dcTotal; i++) dc.push(i % 2 === 0 ? 0xEC : 0x11);

    // Blocks, then interleave data and EC the way the spec orders them.
    const blocks = [], ecs = [];
    let p = 0;
    for (const [cnt, len] of spec) for (let i = 0; i < cnt; i++) {
        const d = dc.slice(p, p + len); p += len;
        blocks.push(d); ecs.push(_qrEc(d, ecLen));
    }
    const out = [];
    let maxLen = 0;
    for (const b of blocks) maxLen = Math.max(maxLen, b.length);
    for (let i = 0; i < maxLen; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
    for (let i = 0; i < ecLen; i++) for (const e of ecs) out.push(e[i]);

    // Function patterns.
    const n = 17 + 4 * ver;
    const m = [], res = [];
    for (let i = 0; i < n; i++) { m.push(new Array(n).fill(0)); res.push(new Array(n).fill(0)); }
    const set = (x, y, v) => { if (x < 0 || y < 0 || x >= n || y >= n) return; m[y][x] = v; res[y][x] = 1; };
    const finder = (ox, oy) => {
        for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
            const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
            const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
            set(ox + dx, oy + dy, inside && d !== 2 ? 1 : 0);
        }
    };
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
    for (let i = 8; i < n - 8; i++) { set(i, 6, i % 2 === 0 ? 1 : 0); set(6, i, i % 2 === 0 ? 1 : 0); }
    for (const cy of _QR_ALIGN[ver]) for (const cx of _QR_ALIGN[ver]) {
        if ((cx <= 8 && cy <= 8) || (cx >= n - 9 && cy <= 8) || (cx <= 8 && cy >= n - 9)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
            set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) === 1 ? 0 : 1);
    }
    set(8, n - 8, 1);                                      // the one always-dark module
    for (let i = 0; i < 9; i++) { res[8][i] = 1; res[i][8] = 1; }
    for (let i = 0; i < 8; i++) { res[8][n - 1 - i] = 1; res[n - 1 - i][8] = 1; }
    if (ver >= 7) {
        const vi = _QR_VER[ver];
        for (let i = 0; i < 18; i++) {
            const b = (vi >> i) & 1, r = (i / 3) | 0, c = i % 3;
            set(n - 11 + c, r, b); set(r, n - 11 + c, b);
        }
    }

    // Data, upward-then-downward in two-column strips, skipping the timing column.
    let bi = 0, dir = -1, y = n - 1;
    for (let x = n - 1; x > 0; x -= 2) {
        if (x === 6) x--;
        for (;;) {
            for (let k = 0; k < 2; k++) {
                const cx = x - k;
                if (res[y][cx]) continue;
                m[y][cx] = bi < out.length * 8 ? (out[bi >> 3] >> (7 - (bi & 7))) & 1 : 0;
                bi++;
            }
            y += dir;
            if (y < 0 || y >= n) { y -= dir; dir = -dir; break; }
        }
    }

    // Mask + format bits, best of eight by penalty.
    let best = null, bestPen = Infinity;
    for (let msk = 0; msk < 8; msk++) {
        const t = m.map(r => r.slice());
        for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++)
            if (!res[yy][xx] && _QR_MASK[msk](xx, yy)) t[yy][xx] ^= 1;
        const f = _QR_FMT[msk];
        for (let i = 0; i < 15; i++) {
            const b = (f >> i) & 1;
            if (i < 6)      t[i][8] = b;
            else if (i < 8) t[i + 1][8] = b;
            else            t[n - 15 + i][8] = b;
            if (i < 8)      t[8][n - i - 1] = b;
            else if (i < 9) t[8][15 - i] = b;
            else            t[8][14 - i] = b;
        }
        t[n - 8][8] = 1;
        const pen = _qrPenalty(t, n);
        if (pen < bestPen) { bestPen = pen; best = t; }
    }
    // `res` (which modules are function patterns) is returned for the QR self-check
    // in test-share.js, which reverses the placement to prove the codeword is valid.
    return { n: n, m: best, res: res, ver: ver };
}

// Drawn light-on-dark-ground with its own quiet zone, since the card ground is nearly
// black and a QR needs the light field around it to be found at all.
function _cardQR(g, text, x, y, size) {
    const q = _qrMatrix(text);
    if (!q) return false;
    const quiet = 3;                       // modules; 4 is the spec, 3 buys real estate back
    const mod = size / (q.n + quiet * 2);
    g.save();
    g.fillStyle = 'rgba(232,238,255,0.95)';
    g.beginPath(); g.roundRect(x, y, size, size, Math.max(4, size * 0.05)); g.fill();
    g.fillStyle = '#05060e';
    for (let yy = 0; yy < q.n; yy++) for (let xx = 0; xx < q.n; xx++) {
        if (!q.m[yy][xx]) continue;
        // Half a pixel of overlap: neighbouring modules must not show a seam after
        // the PNG is scaled down by a chat client.
        g.fillRect(x + (quiet + xx) * mod, y + (quiet + yy) * mod, mod + 0.5, mod + 0.5);
    }
    g.restore();
    return true;
}

// ── Card renderer ─────────────────────────────────────────────────────
// Two cuts from one renderer:
//   landscape 1200x630 - the link-preview proportion, used for the desktop copy
//   portrait  1080x1350 - what a share SHEET actually feeds (chats, stories, feeds)
// The portrait cut exists because the sheet's destinations are all vertical, and the
// 1200x630 card arrives there as a thin band whose 96pt score renders at ~30pt. The
// link-preview shape still matters for a posted LINK, but that unfurl is drawn from
// the site's own og:image, never from this PNG.
//
// Both cuts carry the debriefing screen's content rather than the old card's own
// separate story: the run's scenes (one real frame per sector reached, the death frame
// last), the score against the bar it was actually playing, and the reward chips. What
// does NOT come across from draw.js's drawDeathScreen is the right column - TODAY TOP,
// the run counter, the daily shard cap - which is the sender's own meta and means
// nothing to a recipient.
const _CARD_MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function _shareCardCanvas(portrait) {
    const CW = portrait ? 1080 : 1200, CH = portrait ? 1350 : 630;
    const c = document.createElement('canvas');
    c.width = CW; c.height = CH;
    const g = c.getContext('2d');

    const S = portrait ? 1.12 : 1;               // type scale: the tall cut is read smaller
    const F = (sz, bold) => `${bold ? 'bold ' : ''}${Math.round(sz * S)}px ${FONT_UI}`;
    const N = sz => `bold ${Math.round(sz * S)}px ${FONT_NUM}`;

    const P = portrait ? {
        hdrY: 96, wldY: 78, plnY: 120, hair: 152, mark: 52,
        scoreY: 340, scoreSz: 132, railY: 372, railH: 14, railW: 460, targetY: 412,
        rankY: 318, rankSz: 40, rankLblY: 362,
        chipY: 452, chipH: 46, chipRows: 2,
        bandLbl: 556, bandY: 576, bandH: 296, bandRows: 2,
        profY: 912, profH: 148,
        footHair: 1100, tagY: 1142, urlY: 1190, urlSz: 27,
        qr: 200, qrY: 1086,
    } : {
        hdrY: 84, wldY: 68, plnY: 104, hair: 126, mark: 56,
        scoreY: 412, scoreSz: 96, railY: 432, railH: 10, railW: 380, targetY: 462,
        rankY: 400, rankSz: 34, rankLblY: 432,
        chipY: 478, chipH: 38, chipRows: 1,
        bandLbl: 0, bandY: 142, bandH: 160, bandRows: 1,
        profY: 0, profH: 0,
        footHair: 534, tagY: 562, urlY: 592, urlSz: 24,
        qr: 104, qrY: 488,
    };
    const PAD = portrait ? 64 : 70;
    const L = PAD, R = CW - PAD;

    // Today's rock palette (constants.js WEEKDAY_PALETTES via draw.js getTheme) -- the
    // card is tinted to the same accent the title screen, run-start banner and in-game
    // wall glow all use, so a shared card reads as *that day's world*, not a generic
    // blue badge.
    const theme  = getTheme();
    const accent = theme.wallBase;
    const dayDate = _tunlActiveDate();
    const planet  = WEEKDAY_PALETTES[weekdayIndex(dayDate)].planet;
    const dateStr = `${dayDate.getUTCDate()} ${_CARD_MONTHS[dayDate.getUTCMonth()]}`;
    const DAY = al => `rgba(${accent[0]},${accent[1]},${accent[2]},${al})`;

    // Ground + vignette, matching the game's own #04040a. Flat wash rather than a radial
    // gradient: the card crosses a JS->native bridge as a base64 string (shareRun below),
    // and a large smooth gradient is by far the most expensive thing to PNG-encode in an
    // otherwise near-flat dark image.
    g.fillStyle = '#04040a';
    g.fillRect(0, 0, CW, CH);
    g.fillStyle = 'rgba(16,24,52,0.42)';
    g.fillRect(0, 0, CW, CH);

    g.save();
    g.strokeStyle = DAY(0.5);
    g.lineWidth = 2;
    g.shadowColor = DAY(0.35);
    g.shadowBlur = 16;
    g.beginPath(); g.roundRect(24, 24, CW - 48, CH - 48, 18); g.stroke();
    g.restore();

    // ── header ────────────────────────────────────────────────────────
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.font = F(P.mark, true);
    g.fillStyle = 'rgba(225,238,255,0.98)';
    g.shadowColor = 'rgba(100,150,255,0.55)'; g.shadowBlur = 18;
    g.fillText('TUNL', L, P.hdrY);
    g.shadowBlur = 0;

    g.textAlign = 'right';
    g.font = F(24, true);
    g.fillStyle = 'rgba(160,190,240,0.92)';
    g.fillText(`${T.level} ${LEVEL_NUM}: ${WORLD_NAME.toUpperCase()}`, R, P.wldY);
    // The DATE belongs here (2026-09-20). shareRunText's tagline says "same tunnel for
    // everyone TODAY" and the link pins that day with ?d, but the picture itself carried
    // no date at all, so a card forwarded tomorrow claimed a cave nobody is flying any
    // more. Latin month abbreviation on purpose: no new i18n key, and it reads as a
    // stamp rather than as body text.
    g.font = F(21, true);
    g.fillStyle = DAY(0.95);
    g.shadowColor = DAY(0.5); g.shadowBlur = 12;
    g.fillText(`${T.planet} ${planet.toUpperCase()}  ·  ${dateStr}`, R, P.plnY);
    g.shadowBlur = 0;

    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(L, P.hair, R - L, 1);

    // ── score, its scale, and the world rank ──────────────────────────
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.font = N(P.scoreSz);
    g.fillStyle = newBest ? 'rgba(255,225,65,1)' : 'rgba(228,240,255,1)';
    g.shadowColor = newBest ? 'rgba(255,190,0,0.7)' : 'rgba(80,120,255,0.45)';
    g.shadowBlur = newBest ? 26 : 14;
    g.fillText(String(score), L, P.scoreY);
    g.shadowBlur = 0;

    // The rail the death screen gives the score: full to the all-time best, or - when
    // the run is nowhere near it - to the next milestone, which is the bar a short run
    // is actually playing against. A bare number never answered "was that good?".
    let target = best, targetTxt = `${T.best} ${best}`;
    if (best <= 0 || score < best * 0.55) {
        const st = milestoneStep(score);
        target = Math.max(st, (Math.floor(score / st) + 1) * st);
        targetTxt = String(target);
    }
    const frac = target > 0 ? Math.max(0.012, Math.min(1, score / target)) : 0;
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.beginPath(); g.roundRect(L, P.railY, P.railW, P.railH, P.railH / 2); g.fill();
    g.fillStyle = DAY(0.95);
    g.beginPath(); g.roundRect(L, P.railY, P.railW * frac, P.railH, P.railH / 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillRect(L + P.railW, P.railY - P.railH * 0.9, 2, P.railH * 2.8);
    g.textAlign = 'right';
    g.font = F(16, true);
    g.fillStyle = 'rgba(132,146,184,0.75)';
    g.fillText(targetTxt, L + P.railW, P.targetY);

    if (worldRank !== null && worldRank > 0) {
        // Orange, not gold -- matches the death screen, where gold is kept for shard
        // figures only and the world rank is deliberately orange.
        const rankStr = worldRankTotal > 0
            ? `#${worldRank.toLocaleString()} / ${worldRankTotal.toLocaleString()}`
            : `#${worldRank.toLocaleString()}`;
        g.textAlign = 'right';
        g.font = N(P.rankSz);
        g.fillStyle = 'rgba(255,160,80,0.98)';
        g.shadowColor = 'rgba(255,130,40,0.40)'; g.shadowBlur = 10;
        g.fillText(rankStr, R, P.rankY);
        g.shadowBlur = 0;
        g.font = F(19, true);
        g.fillStyle = 'rgba(150,180,235,0.82)';
        g.fillText(T.worldRank, R, P.rankLblY);
    }

    // ── chips: everything this run earned, in the death screen's own language ──
    const chips = [];
    if (newBest || newDailyBest) {
        chips.push({ t: upperT(newBest ? T.newBest : T.newDailyBest), c: [255, 228, 110], solid: true });
    }
    if (typeof skinUnlockIdx !== 'undefined' && skinUnlockIdx >= 0) {
        chips.push({ t: `${SKINS[skinUnlockIdx].name} ${T.unlocked}`, c: SKINS[skinUnlockIdx].shadow, solid: true });
    } else if (typeof skinMasteryUpIdx !== 'undefined' && skinMasteryUpIdx >= 0) {
        chips.push({ t: `${SKINS[skinMasteryUpIdx].name} ${T.masteryUp} ${masteryLevel(skinMasteryUpIdx)}`,
                     c: SKINS[skinMasteryUpIdx].shadow });
    }
    if (typeof missionRewardWon !== 'undefined' && missionRewardWon > 0) {
        chips.push({ t: `${T.missionDone} +${missionRewardWon}`, c: [120, 255, 150] });
    }
    // Run highlights, colour-matched to the death screen's stat line: combo orange,
    // powerups blue, near-miss cyan. Combo first -- it is the one players brag about.
    if (runMaxCombo > 1)   chips.push({ t: `x${runMaxCombo} ${T.combo}`, c: [255, 150, 110] });
    if (runCoins > 0)      chips.push({ t: `${runCoins} ${runCoins !== 1 ? T.powerups : T.powerup}`, c: [175, 205, 255] });
    if (runNearMisses > 0) chips.push({ t: `${runNearMisses} ${T.close}`, c: [110, 210, 255] });
    // The shard payout is deliberately NOT here: it is wallet state, it exposes the
    // daily cap, and it is the one death-screen reward a recipient cannot read.

    const chipMaxW = (R - L) - (portrait ? 0 : P.qr + 30);
    const chipBot = _cardChips(g, chips, L, P.chipY, chipMaxW, P.chipH, P.chipRows, F);

    // ── the run's scenes, or the corridor profile when there is no death frame ──
    // The band YIELDS, exactly as it does on the death screen: on the portrait cut it
    // sits under the chips, and a run that earns a record, a mission and three stats
    // wraps those onto a second row. So the label and the band are placed against the
    // chips' real bottom edge and the band gives up height rather than being drawn
    // through. (On the landscape cut the band sits above the score and has no label, so
    // both maxima resolve to the fixed positions.)
    const haveScenes = typeof runDeathScene !== 'undefined' && runDeathScene && runDeathScene.cv;
    const bandLblY = P.bandLbl ? Math.max(P.bandLbl, chipBot + 34) : 0;
    const bandTop  = P.bandLbl ? Math.max(P.bandY, bandLblY + 18) : P.bandY;
    const bandFloor = (P.profY || (P.footHair - 20)) - 30;
    const bandH    = Math.max(60, Math.min(P.bandH, bandFloor - bandTop));
    let profY = P.profY, profH = P.profH;
    if (haveScenes) {
        if (P.bandLbl) {
            g.textAlign = 'left';
            g.textBaseline = 'alphabetic';
            g.font = F(15, true);
            g.fillStyle = 'rgba(132,146,184,0.62)';
            try { g.letterSpacing = '1.6px'; } catch (e) {}
            g.fillText(`${T.flown}  ·  ${T.sector} ${runDeathScene.k}`, L, bandLblY);
            try { g.letterSpacing = '0px'; } catch (e) {}
        }
        _cardScenes(g, L, bandTop, R - L, bandH, P.bandRows, F, accent);
    } else {
        // No death frame (a revive dropped it, or the card is rendered before the
        // capture): the corridor profile takes the band's slot at its full size.
        profY = bandTop; profH = bandH;
    }
    if (profH > 0 && lastRunWx > 0) {
        g.save();
        g.beginPath(); g.roundRect(L, profY, R - L, profH, 8); g.clip();
        // The crash ring lands at the END of drawRunProfile's width, so the width is
        // pulled in by roughly its radius: clipped in half it read as a rendering fault
        // rather than as the death point. The dark sliver it leaves on the right is the
        // same "past the run stays dark" the function draws anyway.
        drawRunProfile(g, L + 3, profY, R - L - 6 - profH * 0.16, profH, {
            scale: Math.max(0.45, profH / 200), accent: accent,
            pbLabel: haveScenes ? false : true,
        });
        g.restore();
        g.strokeStyle = 'rgba(255,255,255,0.09)';
        g.lineWidth = 1;
        g.beginPath(); g.roundRect(L, profY, R - L, profH, 8); g.stroke();
    }


    // ── footer: the thing the picture is FOR ──────────────────────────
    // The URL used to be the else-branch of the world rank, so every card good enough
    // to be worth sharing -- the ones that have a rank -- carried no address at all.
    // Forwarded as an image (screenshot, story, any picture-only network) that card was
    // a number from a stranger with no way back to the game. Rank and address are not
    // alternatives; the address is a footer, and it is always there.
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fillRect(L, P.footHair, R - L, 1);

    const qrTxt = shareRunUrl(true);
    const hasQR = _cardQR(g, qrTxt, R - P.qr, P.qrY, P.qr);
    const textR = hasQR ? R - P.qr - 30 : R;

    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = F(18);
    g.fillStyle = 'rgba(150,170,215,0.80)';
    _cardFit(g, T.shareTagline, L, P.tagY, textR - L, F, 18);
    g.font = F(P.urlSz, true);
    g.fillStyle = 'rgba(200,220,255,0.95)';
    _cardFit(g, SHARE_URL.replace(/^https:\/\//, '') + '/play', L, P.urlY, textR - L, F, P.urlSz, true);

    return c;
}

// One line, shrunk rather than overrun. Translations run long and the footer's width
// depends on whether the QR rendered.
function _cardFit(g, txt, x, y, maxW, F, sz, bold) {
    let s = sz;
    while (g.measureText(txt).width > maxW && s > sz * 0.6) { s -= 1; g.font = F(s, bold); }
    g.fillText(txt, x, y);
}

// The run's scenes (constants.js SCENE_* doc), same picking order as the death screen's
// band: the death frame always stays, then the next sector's empty slot, then the lit
// mouth (S0), then the deepest sectors reached. With the depth light the strip runs from
// the lit cave mouth into the dark, which says "how deep did I get" faster than any
// number, and the empty slot is the next goal -- on a card sent to someone else, it is
// also the clearest statement of what the game IS.
function _cardScenes(g, x0, y, w, h, maxRows, F, accent) {
    const dk = runDeathScene.k;
    const gap = 12;
    // The band is a SLOT, not a strip, and how it is divided depends on how much run
    // there is to show. Its height over `rows` sets the frame height and the thumbnail's
    // aspect sets the width, so a tall slot in one row makes very wide frames: at the
    // portrait cut's 296pt that is 335pt each, which holds two. Fine for a run that died
    // in S0 (big frames, no dead space) and wrong for a deep one, where it would drop
    // every sector but the last -- the one thing the band exists to show. So: the FEWEST
    // rows that hold everything this run has, capped at the cut's maximum.
    const aspect = runDeathScene.cv.width / runDeathScene.cv.height;
    const avail = 2 + runScenes.filter(s => s.k < dk).length;   // death frame + next slot + earlier
    let rows = 1, rowH = h, fw = h * aspect, perRow = 1;
    for (;;) {
        rowH = (h - gap * (rows - 1)) / rows;
        fw = rowH * aspect;
        perRow = Math.max(1, Math.floor((w + gap) / (fw + gap)));
        if (perRow * rows >= avail || rows >= maxRows) break;
        rows++;
    }
    const fits = perRow * rows;
    const entries = runScenes.filter(s => s.k < dk);
    const pick = [{ k: dk, cv: runDeathScene.cv, death: true }];
    if (pick.length < fits) pick.push({ k: dk + 1, next: true });
    if (pick.length < fits && entries.length && entries[0].k === 0) pick.push(entries.shift());
    while (pick.length < fits && entries.length) pick.push(entries.pop());
    pick.sort((p, q) => p.k - q.k);

    const rr = Math.min(10, rowH * 0.08);
    // Rows are centred individually, so a half-full last row sits under the middle of
    // the one above it rather than hanging off the left edge.
    const rowOf = i => Math.floor(i / perRow);
    const rowCount = i => Math.min(perRow, pick.length - rowOf(i) * perRow);
    let idx = 0;
    for (const s of pick) {
        const col = idx % perRow, rw = rowCount(idx);
        const fx = x0 + Math.max(0, (w - (rw * fw + (rw - 1) * gap)) / 2) + col * (fw + gap);
        const fy = y + rowOf(idx) * (rowH + gap);
        idx++;
        if (s.next) {
            g.save();
            g.setLineDash([6, 6]);
            g.strokeStyle = 'rgba(255,255,255,0.18)';
            g.lineWidth = 1.5;
            g.beginPath(); g.roundRect(fx + 0.5, fy + 0.5, fw - 1, rowH - 1, rr); g.stroke();
            g.restore();
            g.font = F(26, true);
            g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},0.60)`;
            g.fillText(`S${s.k}`, fx + fw / 2, fy + rowH / 2);
        } else {
            g.save();
            g.beginPath(); g.roundRect(fx, fy, fw, rowH, rr); g.clip();
            g.drawImage(s.cv, fx, fy, fw, rowH);
            // A scrim under the label only, so the frame itself stays true to the run.
            const sg = g.createLinearGradient(0, fy + rowH * 0.55, 0, fy + rowH);
            sg.addColorStop(0, 'rgba(4,4,14,0)');
            sg.addColorStop(1, 'rgba(4,4,14,0.78)');
            g.fillStyle = sg;
            g.fillRect(fx, fy, fw, rowH);
            g.restore();
            g.font = F(15, true);
            g.textAlign = 'left'; g.textBaseline = 'alphabetic';
            g.fillStyle = 'rgba(232,238,255,0.88)';
            g.fillText(`S${s.k}`, fx + fw * 0.09, fy + rowH - rowH * 0.10);
            // Red stays the death marker: only the frame the run ended in.
            g.strokeStyle = s.death ? 'rgba(255,86,86,0.85)' : 'rgba(255,255,255,0.10)';
            g.lineWidth = s.death ? 2 : 1;
            g.beginPath(); g.roundRect(fx, fy, fw, rowH, rr); g.stroke();
        }
    }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}

// A wrapping row of chips -- the same device the death screen uses so a run that earns
// a ship, a mission and a combo shows all three instead of one suppressing the others.
// Chips that do not fit in `rows` rows are dropped from the END, which is why the list
// is built in order of what a recipient cares about.
function _cardChips(g, items, x, y, maxW, h, rows, F) {
    const fsz = Math.round(h * 0.40);
    const wOf = t => { g.font = F(fsz, true); return g.measureText(t).width + h * 0.88; };
    const gap = 12;
    let cx = x, cy = y, row = 0;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    let bottom = y;
    for (const it of items) {
        const w = wOf(it.t);
        if (cx + w > x + maxW && cx > x) {
            row++;
            if (row >= rows) break;
            cx = x; cy += h + gap;
        }
        if (w > maxW) continue;
        const cl = it.c;
        g.fillStyle = it.solid ? `rgba(${cl[0]},${cl[1]},${cl[2]},0.15)` : 'rgba(255,255,255,0.05)';
        g.beginPath(); g.roundRect(cx, cy, w, h, h / 2); g.fill();
        g.strokeStyle = `rgba(${cl[0]},${cl[1]},${cl[2]},${it.solid ? 0.42 : 0.20})`;
        g.lineWidth = 1.5;
        g.beginPath(); g.roundRect(cx, cy, w, h, h / 2); g.stroke();
        g.fillStyle = `rgba(${cl[0]},${cl[1]},${cl[2]},0.95)`;
        g.font = F(fsz, true);
        g.fillText(it.t, cx + h * 0.44, cy + h / 2);
        cx += w + gap;
        bottom = cy + h;
    }
    g.textBaseline = 'alphabetic';
    return bottom;
}

// ── Share ─────────────────────────────────────────────────────────────

// The link printed on the card, always carrying a referral tag (?r=, this
// player's web.js webPlayerId()) so a friend who plays credits them a shard
// reward the moment that friend clears their own first real run - see web.js
// submitReferral()/checkReferralReward(). The link also deep-links straight
// back into the run just flown: same cave (?d), the sender's ghost to race
// (?g), and their score so the recipient's ghost readout is right (?s).
//
// EVERY target builds the same link (2026-09-20). Until then a native app
// share pointed at bare /play/?r= on the theory that "the app has no in-app
// equivalent to hand a ghost off to" - which is simply not true: web.js's
// _tunlParseWebParams() is not isWeb()-gated and runs in both apps, state.js
// consumes ?g/?s the same way there, and the Universal/App Link wiring
// (GameView.swift / MainActivity.kt) reloads the page with the link's whole
// query string appended. So the app was stripping three parameters all three
// targets understand, and shipping a card whose own tagline ("same tunnel for
// everyone today, beat me") the link then could not make good on: the
// recipient got an invitation to a duel with no cave, no score and no ghost.
//
// `compact` drops the ghost only. It is what the card's QR encodes: a ghost is
// up to SHARE_GHOST_MAX_B64 characters, which pushes a QR past 40 versions of
// module count and makes it unscannable at card size, while ?d + ?s still
// carry the actual challenge.
function shareRunUrl(compact) {
    // Packed to 22 chars instead of the 36-char UUID (_uuidPack, web.js) - the
    // link is display/tap-only, webPlayerId() itself and what's sent to the
    // leaderboard worker both stay the plain UUID.
    const r = 'r=' + encodeURIComponent(_uuidPack(webPlayerId()));
    // Trailing slash: the host 301-redirects /play -> /play/ (query preserved), so
    // linking straight to /play/ saves every shared link a redirect hop.
    // Day as a base36 offset from WEB_DAY_EPOCH_MS (web.js), not YYYYMMDD - a
    // handful of chars instead of 8.
    let u = SHARE_URL.replace(/\/+$/, '') + '/play/?d=' + _dayIntToOffset(_tunlActiveDayInt()).toString(36);
    if (score > 0) u += '&s=' + Math.min(score | 0, 9999999);
    try {
        if (!compact && typeof ghostTrack !== 'undefined' && ghostTrack && ghostTrack.length > 1) {
            const enc = ghostEncode(ghostTrack);
            if (enc.length <= SHARE_GHOST_MAX_B64) {
                // URL-safe base64, padding stripped: no %2B/%2F/%3D noise, and immune
                // to chat clients that "URL-safe normalise" links. state.js reverses it.
                u += '&g=' + enc.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            }
        }
    } catch (e) { /* the ghost is optional in the link; ?d + ?s still challenge */ }
    return u + '&' + r;
}

function shareRunText() {
    const planet = WEEKDAY_PALETTES[weekdayIndex(_tunlActiveDate())].planet;
    const lines = [
        `TUNL · ${T.level} ${LEVEL_NUM}: ${WORLD_NAME.toUpperCase()} · ${planet.toUpperCase()}`,
        `${score}${runMaxCombo > 1 ? `  (x${runMaxCombo} ${T.combo})` : ''}`,
    ];
    if (worldRank !== null && worldRank > 0) {
        lines.push(worldRankTotal > 0
            ? `${T.worldRank} #${worldRank.toLocaleString()} / ${worldRankTotal.toLocaleString()}`
            : `${T.worldRank} #${worldRank.toLocaleString()}`);
    }
    // The line that makes the card worth sending: it tells the recipient the cave is
    // the same one for them today, which is the only reason a stranger's score means
    // anything. Without it this is just a screenshot of a number.
    lines.push(T.shareTagline);
    // Compact: the ghost pushes this link past 1000 chars on a good run, which
    // chat clients mangle or truncate. The card's QR already drops it for the
    // same reason; ?d + ?s still hand the recipient the same cave and a score
    // to beat.
    lines.push(shareRunUrl(true));
    return lines.join('\n');
}

function shareRun() {
    // Which cut goes out (2026-09-20). A share SHEET feeds chats, stories and feeds,
    // all of which are vertical -- the 1200x630 card lands there as a thin band whose
    // score renders at a third of its size. The landscape cut stays for the desktop
    // copy, where a card gets dropped into a channel and read beside text. The
    // link-preview proportion is not lost either way: an unfurled LINK is drawn from
    // the site's own og:image, never from this PNG.
    const sheet = !!(window.webkit?.messageHandlers?.share)
               || (typeof navigator !== 'undefined' && !!navigator.share);
    let card = null, dataUrl = '';
    try {
        card = _shareCardCanvas(sheet);
        dataUrl = card.toDataURL('image/png');
    } catch (e) {
        // A card that fails to render must not block the share -- fall back to text.
        card = null; dataUrl = '';
    }
    const text = shareRunText();

    if (window.webkit?.messageHandlers?.share) {
        window.webkit.messageHandlers.share.postMessage({ action: 'run', text, image: dataUrl });
        return;
    }
    // Browser fallback, which is also how this is tested outside a device build.
    if (navigator.share) {
        const send = files => navigator.share(files ? { text, files } : { text }).catch(() => {});
        if (dataUrl && navigator.canShare) {
            fetch(dataUrl).then(r => r.blob()).then(b => {
                const f = new File([b], 'tunl.png', { type: 'image/png' });
                send(navigator.canShare({ files: [f] }) ? [f] : null);
            }).catch(() => send(null));
        } else {
            send(null);
        }
        return;
    }
    // Desktop browser: no share sheet, so the card is copied instead of sent. Both the
    // image and the link go on the clipboard where ClipboardItem allows it (Ctrl+V into
    // a chat then pastes the card, and a plain-text paste still gets the link); older
    // browsers keep the link-only behaviour. The ClipboardItem value is a PROMISE for
    // the blob rather than an awaited one: toBlob is async, and awaiting it first loses
    // the user gesture the clipboard write needs.
    if (!navigator.clipboard) return;
    const link = shareRunUrl();
    const ok   = () => { _shareCopiedT = 1.8; };
    const copyText = () => {
        if (navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(ok).catch(() => {});
    };
    if (card && navigator.clipboard.write && typeof ClipboardItem !== 'undefined') {
        try {
            const png = new Promise(res => card.toBlob(res, 'image/png'));
            navigator.clipboard.write([new ClipboardItem({
                'image/png':  png,
                'text/plain': new Blob([link], { type: 'text/plain' }),
            })]).then(ok).catch(copyText);
            return;
        } catch (e) { /* no ClipboardItem support for these types */ }
    }
    copyText();
}
