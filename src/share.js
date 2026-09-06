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

const SHARE_W = 1200, SHARE_H = 630; // link-preview proportions; reads well in chats

// Share is offered only when the run is actually worth showing someone. A share button
// on every death is a nag; on a personal best it's a reward. Kept in one place so the
// button (draw.js) and the tap handler (input.js) can never disagree about it.
// SHARE_MIN_SCORE guards the personal-best path: a player's first-ever run is a "new
// best" by definition, and offering to broadcast a score of 9 is embarrassing rather
// than rewarding. Same "that was an instant faceplant" threshold the ad cadence uses
// (AdsManager minScoreForAd).
const SHARE_MIN_SCORE = 25;
function shareWorthy() {
    // The web build is an acquisition funnel: every shared run is a tap-to-play
    // link for someone new, so drop the "was this a good run" gate the app uses
    // (a share button on every death reads as a nag in a retention product, but
    // as the point of the thing here) and offer it on any run past the instant-
    // faceplant floor.
    if (typeof isWeb === 'function' && isWeb()) return score >= SHARE_MIN_SCORE;
    return score >= 200 || ((newBest || newDailyBest) && score >= SHARE_MIN_SCORE);
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
// Compact SR-71 silhouette on an *arbitrary* 2D context. draw.js's shipPath() and
// drawShip() are both hard-bound to the game's `ctx` const, so they can't render onto
// the share card's offscreen canvas -- this is a trimmed copy (hull fill + a
// nose-to-tail shading sweep + a canopy glint; no nacelle pods) that takes the context
// as an argument. Kept here rather than refactoring draw.js so the card change stays
// self-contained. `k` scales the glow with the caller's overall scale factor.
function _shipGlyph(g, x, y, r, color, glow, k) {
    k = k || 1;
    const hull = () => {
        g.beginPath();
        g.moveTo(x + r*1.72, y);
        g.lineTo(x + r*1.12, y - r*0.17);
        g.lineTo(x + r*0.38, y - r*0.22);
        g.lineTo(x - r*0.65, y - r*0.92);
        g.lineTo(x - r*1.08, y - r*0.22);
        g.lineTo(x - r*1.22, y - r*0.32);
        g.lineTo(x - r*1.05, y - r*0.08);
        g.lineTo(x - r*0.92, y);
        g.lineTo(x - r*1.05, y + r*0.08);
        g.lineTo(x - r*1.22, y + r*0.32);
        g.lineTo(x - r*1.08, y + r*0.22);
        g.lineTo(x - r*0.65, y + r*0.92);
        g.lineTo(x + r*0.38, y + r*0.22);
        g.lineTo(x + r*1.12, y + r*0.17);
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
    const bg = g.createLinearGradient(x + r*1.72, y, x - r*1.22, y);
    bg.addColorStop(0,   'rgba(255,255,255,0.16)');
    bg.addColorStop(0.5, 'rgba(0,0,0,0)');
    bg.addColorStop(1,   'rgba(0,0,0,0.42)');
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
    g.ellipse(x + r*1.10, y - r*0.05, r*0.22, r*0.085, -0.10, 0, Math.PI*2);
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
            const bb = boundsBase(Math.max(0, wx + off));
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
            g.font = `bold ${19 * k}px 'Courier New',monospace`;
            g.fillStyle = `rgba(255,215,90,${0.85 * A})`;
            g.fillText(T.pb, bx, y0 + h + 32 * k);
        }
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
        _shipGlyph(g, dx, dy, r, sk.color,
            `rgba(${sk.shadow[0]},${sk.shadow[1]},${sk.shadow[2]},${0.90 * A})`, k);
    }
}

// ── Card renderer ─────────────────────────────────────────────────────

function _shareCardCanvas() {
    const c = document.createElement('canvas');
    c.width = SHARE_W; c.height = SHARE_H;
    const g = c.getContext('2d');

    const F = (sz, bold) => `${bold ? 'bold ' : ''}${sz}px 'Courier New',monospace`;

    // Today's rock palette (constants.js WEEKDAY_PALETTES via draw.js getTheme) -- the
    // card is tinted to the same accent the title screen, run-start banner and in-game
    // wall glow all use now, so a shared card reads as *that day's world*, not a
    // generic blue badge.
    const theme  = getTheme();
    const accent = theme.wallBase;
    const planet = WEEKDAY_PALETTES[weekdayIndex(_tunlActiveDate())].planet;

    // Ground + vignette, matching the game's own #04040a
    g.fillStyle = '#04040a';
    g.fillRect(0, 0, SHARE_W, SHARE_H);
    // Flat wash rather than a radial vignette: the card crosses a JS->native bridge as
    // a base64 string (share.js shareRun), and a large smooth gradient is by far the
    // most expensive thing to PNG-encode in an otherwise near-flat dark image.
    g.fillStyle = 'rgba(16,24,52,0.42)';
    g.fillRect(0, 0, SHARE_W, SHARE_H);

    // Rounded, lit frame -- mirrors the death-screen panel (draw.js drawDeathScreen),
    // which moved off a flat 1px stroke to roundRect + a soft glow border. Tinted
    // toward the day's rock accent.
    g.save();
    g.strokeStyle = rgb(accent, 0.5);
    g.lineWidth = 2;
    g.shadowColor = rgb(accent, 0.35);
    g.shadowBlur = 16;
    g.beginPath();
    g.roundRect(24, 24, SHARE_W - 48, SHARE_H - 48, 18);
    g.stroke();
    g.restore();

    // ── Header ────────────────────────────────────────────────────────
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.font = F(56, true);
    g.fillStyle = 'rgba(225,238,255,0.98)';
    g.shadowColor = 'rgba(100,150,255,0.55)'; g.shadowBlur = 18;
    g.fillText('TUNL', 70, 92);
    g.shadowBlur = 0;

    // Right side stacks the world line over a planet subtitle, same pairing the title
    // screen shows: "WORLD n: <rock>" in cool blue, "<T.planet> <PLANET>" in the day's
    // rock accent so the world name visually *is* the day's rock.
    g.textAlign = 'right';
    g.font = F(24, true);
    g.fillStyle = 'rgba(160,190,240,0.92)';
    g.fillText(`${T.level} ${LEVEL_NUM}: ${WORLD_NAME.toUpperCase()}`, SHARE_W - 70, 74);
    g.font = F(21, true);
    g.fillStyle = rgb(accent, 0.95);
    g.shadowColor = rgb(accent, 0.5); g.shadowBlur = 12;
    g.fillText(`${T.planet} ${planet.toUpperCase()}`, SHARE_W - 70, 110);
    g.shadowBlur = 0;

    drawRunProfile(g, 70, 178, SHARE_W - 140, 228, { scale: 1, accent });

    // ── Score + stats ─────────────────────────────────────────────────
    // The right-hand block (rank, or the URL when there's no rank) is laid out first so
    // its left edge is known, and the stats line to the left of it is then clamped to
    // stop short of it. Drawing the stats first and hoping meant a long stats string in
    // a verbose locale ran straight under the rank number.
    g.textBaseline = 'middle';
    const statY = 505;
    let rightEdge = SHARE_W - 70;   // left-most x the right-hand block occupies

    g.textAlign = 'right';
    if (worldRank !== null && worldRank > 0) {
        const rankStr = worldRankTotal > 0
            ? `#${worldRank.toLocaleString()} / ${worldRankTotal.toLocaleString()}`
            : `#${worldRank.toLocaleString()}`;
        // Orange, not gold -- matches the death screen, where gold/yellow is kept for
        // shard figures only and the world rank is deliberately orange.
        g.font = F(34, true);
        g.fillStyle = 'rgba(255,160,80,0.98)';
        g.shadowColor = 'rgba(255,130,40,0.40)'; g.shadowBlur = 10;
        g.fillText(rankStr, SHARE_W - 70, statY - 14);
        g.shadowBlur = 0;
        rightEdge = SHARE_W - 70 - g.measureText(rankStr).width;
        g.font = F(20, true);
        g.fillStyle = 'rgba(150,180,235,0.82)';
        g.fillText(T.worldRank, SHARE_W - 70, statY + 24);
    } else {
        const urlStr = SHARE_URL.replace(/^https:\/\//, '');
        g.font = F(24, true);
        g.fillStyle = 'rgba(130,160,215,0.85)';
        g.fillText(urlStr, SHARE_W - 70, statY);
        rightEdge = SHARE_W - 70 - g.measureText(urlStr).width;
    }

    g.textAlign = 'left';
    g.font = F(96, true);
    g.fillStyle = newBest ? 'rgba(255,225,65,1)' : 'rgba(228,240,255,1)';
    g.shadowColor = newBest ? 'rgba(255,190,0,0.7)' : 'rgba(80,120,255,0.45)';
    g.shadowBlur = newBest ? 26 : 14;
    g.fillText(String(score), 70, statY);
    g.shadowBlur = 0;
    const statsX = 70 + g.measureText(String(score)).width + 34;
    const statsMaxW = Math.max(rightEdge - 40 - statsX, 120);

    if (newBest || newDailyBest) {
        g.font = F(24, true);
        g.fillStyle = 'rgba(255,240,120,0.95)';
        g.fillText((newBest ? T.newBest : T.newDailyBest).toUpperCase(), statsX, statY - 30);
    }

    // Run highlights, colour-matched to the death screen's own stat line (draw.js
    // drawStatLine): combo orange, powerups blue, near-miss cyan -- so a stat reads
    // the same colour here as it did on the screen the player just came from, instead
    // of one flat blue. Combo first: it's the one players brag about (the death screen
    // gives it its own line for the same reason). Singular T.powerup at a count of 1,
    // same as the death screen.
    const bits = [];
    if (runMaxCombo > 1)   bits.push({ t: `x${runMaxCombo} ${T.combo}`, c: [255, 150, 110] });
    if (runCoins > 0)      bits.push({ t: `${runCoins} ${runCoins !== 1 ? T.powerups : T.powerup}`, c: [175, 205, 255] });
    if (runNearMisses > 0) bits.push({ t: `${runNearMisses} ${T.close}`, c: [110, 210, 255] });
    if (bits.length) {
        const sep = '   ·   ';
        let statsFsz = 26;
        g.font = F(statsFsz, true);
        const totalW = () => bits.reduce((s, b) => s + g.measureText(b.t).width, 0)
                           + g.measureText(sep).width * (bits.length - 1);
        // Shrink, then drop trailing stats, rather than overrun the rank block.
        while (totalW() > statsMaxW && bits.length > 1) bits.pop();
        const w = totalW();
        if (w > statsMaxW) {
            statsFsz = Math.max(statsFsz * statsMaxW / w, 15);
            g.font = F(statsFsz, true);
        }
        const sepW = g.measureText(sep).width;
        let sx = statsX;
        bits.forEach((b, i) => {
            g.fillStyle = `rgba(${b.c[0]},${b.c[1]},${b.c[2]},0.95)`;
            g.fillText(b.t, sx, statY + 24);
            sx += g.measureText(b.t).width;
            if (i < bits.length - 1) {
                g.fillStyle = 'rgba(140,155,190,0.62)';
                g.fillText(sep, sx, statY + 24);
                sx += sepW;
            }
        });
    }

    return c;
}

// ── Share ─────────────────────────────────────────────────────────────

// The link printed on the card, always carrying a referral tag (?r=, this
// player's web.js webPlayerId()) so a friend who plays credits them a shard
// reward the moment that friend clears their own first real run - see web.js
// submitReferral()/checkReferralReward(). On the open web the link also
// deep-links straight back into the run just flown: same cave (?d), the
// sender's ghost to race (?g), and their score so the recipient's ghost
// readout is right (?s). A native app share instead points at bare /play/
// with only ?r= attached - the app has no in-app equivalent to hand a ghost
// off to, but /play/ is a real playable page regardless of platform, and for
// a recipient who already has the app, the Universal/App Link wiring
// (GameView.swift / MainActivity.kt) hands them straight back into it rather
// than the web build.
function shareRunUrl() {
    const r = 'r=' + encodeURIComponent(webPlayerId());
    if (typeof isWeb !== 'function' || !isWeb()) {
        return SHARE_URL.replace(/\/+$/, '') + '/play/?' + r;
    }
    // Trailing slash: the host 301-redirects /play -> /play/ (query preserved), so
    // linking straight to /play/ saves every shared link a redirect hop.
    let u = SHARE_URL.replace(/\/+$/, '') + '/play/?d=' + _tunlActiveDayInt();
    if (score > 0) u += '&s=' + Math.min(score | 0, 9999999);
    try {
        if (typeof ghostTrack !== 'undefined' && ghostTrack && ghostTrack.length > 1) {
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
    lines.push(shareRunUrl());
    return lines.join('\n');
}

function shareRun() {
    let dataUrl = '';
    try {
        dataUrl = _shareCardCanvas().toDataURL('image/png');
    } catch (e) {
        // A card that fails to render must not block the share -- fall back to text.
        dataUrl = '';
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
    // Desktop browser: no share sheet. The run card can't cross the clipboard as
    // an image reliably across browsers, but the deep link is the whole viral
    // payload, so copy that and let the death-screen button confirm it (T.linkCopied).
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareRunUrl())
            .then(() => { _shareCopiedT = 1.8; })
            .catch(() => {});
    }
}
