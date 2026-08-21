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
// user 2026-08-21 as the site root, not a /tunl subpath -- the store listing pages are
// served from the Schedly repo's wwwroot/tunl (see the release command and the
// reference_store_listing_urls memory), but the public entry point is the bare domain.
// This is the only place the public URL is written down in this repo.
const SHARE_URL = 'https://schedly.ch';

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
    return score >= 200 || ((newBest || newDailyBest) && score >= SHARE_MIN_SCORE);
}

// True when there's somewhere for the card to actually go: the native share sheet on
// iOS/Android, or the Web Share API when running in a plain browser (which is also how
// this gets tested outside a device build).
function shareAvailable() {
    return !!(window.webkit?.messageHandlers?.share) ||
           (typeof navigator !== 'undefined' && !!navigator.share);
}

// ── Run profile ───────────────────────────────────────────────────────
// Draws the tunnel the player just flew into an arbitrary rect on any 2D context.
// Shared by the share card and the death screen (draw.js) -- the whole point of the
// picture is that only this game can draw it, so it should be the thing the player sees
// when they die, not only the thing a recipient sees.
//
// `scale` multiplies line widths, glows and marker sizes so the same drawing reads
// correctly at card size (1060px wide) and at death-screen size (~340pt wide).
// `alpha` lets the death screen fade it in with the rest of the panel.
function drawRunProfile(g, x0, y0, w, h, opts) {
    opts = opts || {};
    const k = opts.scale === undefined ? 1 : opts.scale;
    const A = opts.alpha === undefined ? 1 : opts.alpha;
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
    const smoothWin = Math.min(wxMax / 12, 1300) * smoothMul;
    const SAMPLES = 420;
    const SUB = smoothWin > 1 ? 9 : 1;
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
    fill.addColorStop(0,   `rgba(40,70,150,${0.30 * A})`);
    fill.addColorStop(0.5, `rgba(60,95,190,${0.14 * A})`);
    fill.addColorStop(1,   `rgba(40,70,150,${0.30 * A})`);
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
            g.strokeStyle = bright ? `rgba(195,220,255,${0.95 * A})` : `rgba(95,120,175,${0.42 * A})`;
            g.lineWidth = Math.max(1, (bright ? 3 : 2) * k);
            if (bright) { g.shadowColor = `rgba(100,150,255,${0.65 * A})`; g.shadowBlur = 12 * k; }
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

    // Death point. Drawn as a marker rather than the ship sprite: shipPath/drawShip
    // render into the game's own `ctx`, a const bound to the visible canvas, so they
    // can't be pointed at the share card's offscreen one.
    if (showMarker) {
        const dx = xOf(endWx), dy = yOf(Math.max(0, Math.min(H, lastRunY)));
        const r = 15 * k;
        g.save();
        g.shadowColor = `rgba(255,70,70,${0.85 * A})`; g.shadowBlur = 22 * k;
        g.strokeStyle = `rgba(255,90,90,${0.95 * A})`;
        g.lineWidth = Math.max(1.2, 3.5 * k);
        g.beginPath(); g.arc(dx, dy, r, 0, Math.PI * 2); g.stroke();
        g.beginPath();
        g.moveTo(dx - r * 0.6, dy - r * 0.6); g.lineTo(dx + r * 0.6, dy + r * 0.6);
        g.moveTo(dx + r * 0.6, dy - r * 0.6); g.lineTo(dx - r * 0.6, dy + r * 0.6);
        g.stroke();
        g.restore();
    }
}

// ── Card renderer ─────────────────────────────────────────────────────

function _shareCardCanvas() {
    const c = document.createElement('canvas');
    c.width = SHARE_W; c.height = SHARE_H;
    const g = c.getContext('2d');

    const F = (sz, bold) => `${bold ? 'bold ' : ''}${sz}px 'Courier New',monospace`;

    // Ground + vignette, matching the game's own #04040a
    g.fillStyle = '#04040a';
    g.fillRect(0, 0, SHARE_W, SHARE_H);
    // Flat wash rather than a radial vignette: the card crosses a JS->native bridge as
    // a base64 string (share.js shareRun), and a large smooth gradient is by far the
    // most expensive thing to PNG-encode in an otherwise near-flat dark image.
    g.fillStyle = 'rgba(16,24,52,0.42)';
    g.fillRect(0, 0, SHARE_W, SHARE_H);

    g.strokeStyle = 'rgba(70,95,170,0.55)';
    g.lineWidth = 2;
    g.strokeRect(24, 24, SHARE_W - 48, SHARE_H - 48);

    // ── Header ────────────────────────────────────────────────────────
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.font = F(56, true);
    g.fillStyle = 'rgba(225,238,255,0.98)';
    g.shadowColor = 'rgba(100,150,255,0.55)'; g.shadowBlur = 18;
    g.fillText('TUNL', 70, 86);
    g.shadowBlur = 0;

    g.textAlign = 'right';
    g.font = F(26, true);
    g.fillStyle = 'rgba(160,190,240,0.92)';
    g.fillText(`${T.level} ${LEVEL_NUM}: ${WORLD_NAME.toUpperCase()}`, SHARE_W - 70, 86);

    drawRunProfile(g, 70, 168, SHARE_W - 140, 236, { scale: 1 });

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
        g.font = F(34, true);
        g.fillStyle = 'rgba(255,225,110,0.95)';
        g.shadowColor = 'rgba(255,190,0,0.35)'; g.shadowBlur = 10;
        g.fillText(rankStr, SHARE_W - 70, statY - 14);
        g.shadowBlur = 0;
        rightEdge = SHARE_W - 70 - g.measureText(rankStr).width;
        g.font = F(20, true);
        g.fillStyle = 'rgba(140,170,225,0.80)';
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

    const bits = [];
    if (runMaxCombo > 1)   bits.push(`x${runMaxCombo} ${T.combo}`);
    if (runCoins > 0)      bits.push(`${runCoins} ${T.powerups}`);
    if (runNearMisses > 0) bits.push(`${runNearMisses} ${T.close}`);
    if (bits.length) {
        // Shrink, then drop trailing stats, rather than overrun the rank block. The
        // combo is listed first because it's the one players actually brag about.
        let statsStr = bits.join('   ·   ');
        let statsFsz = 26;
        g.font = F(statsFsz, true);
        while (g.measureText(statsStr).width > statsMaxW && bits.length > 1) {
            bits.pop();
            statsStr = bits.join('   ·   ');
        }
        const w = g.measureText(statsStr).width;
        if (w > statsMaxW) {
            statsFsz = Math.max(statsFsz * statsMaxW / w, 15);
            g.font = F(statsFsz, true);
        }
        g.fillStyle = 'rgba(160,190,240,0.92)';
        g.fillText(statsStr, statsX, statY + 24);
    }

    return c;
}

// ── Share ─────────────────────────────────────────────────────────────

function shareRunText() {
    const lines = [
        `TUNL · ${T.level} ${LEVEL_NUM}: ${WORLD_NAME.toUpperCase()}`,
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
    lines.push(SHARE_URL);
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
    }
}
