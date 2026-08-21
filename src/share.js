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

    // ── Corridor strip ────────────────────────────────────────────────
    // x maps world-x onto the card; y maps game-space [0, H] onto the strip, so the
    // corridor keeps its true proportions no matter what device recorded the run.
    const padX = 70, stripY0 = 168, stripY1 = 404, stripH = stripY1 - stripY0;
    const endWx = Math.max(lastRunWx, 1);
    // Extend the x-range past the run when the all-time best sits further in, so the
    // marker the player is chasing is always on the card. Bounded so a short run still
    // fills most of the strip instead of shrinking to a stub next to a distant best.
    const wxMax = Math.max(endWx, Math.min(bestSX || 0, endWx * 1.6));
    const xOf = wx => padX + (wx / wxMax) * (SHARE_W - padX * 2);
    const yOf = y  => stripY0 + (y / H) * stripH;

    // Sampled as a rolling average rather than point samples. Drawing boundsBase()
    // literally is accurate but unreadable on a deep run: the corridor's own waves have
    // a period of roughly 550-2500 world-px, so a score-500 run (~30000 px) packs ~60
    // full oscillations into the strip and renders as a seismograph rather than a cave.
    // The smoothing window scales with the run length -- a short run gets almost none
    // and keeps its real shape, a long run gets a full wave period and resolves into the
    // thing that actually matters at a glance: the corridor drifting and narrowing the
    // deeper the player got.
    const smoothWin = Math.min(wxMax / 12, 1300);
    const SAMPLES = 420;
    const SUB = smoothWin > 1 ? 9 : 1;
    const tops = [], bots = [];
    for (let i = 0; i <= SAMPLES; i++) {
        const wx = (i / SAMPLES) * wxMax;
        let t = 0, b = 0;
        for (let k = 0; k < SUB; k++) {
            const off = SUB === 1 ? 0 : (k / (SUB - 1) - 0.5) * smoothWin;
            const bb = boundsBase(Math.max(0, wx + off));
            t += bb.top; b += bb.bot;
        }
        tops.push([xOf(wx), yOf(t / SUB)]);
        bots.push([xOf(wx), yOf(b / SUB)]);
    }

    // Corridor interior: the flown part is lit, the part beyond the death point stays
    // dark. The card should show where the run stopped, not imply it kept going.
    const flownX = xOf(endWx);
    g.save();
    g.beginPath();
    g.moveTo(tops[0][0], tops[0][1]);
    for (const [x, y] of tops) g.lineTo(x, y);
    for (let i = bots.length - 1; i >= 0; i--) g.lineTo(bots[i][0], bots[i][1]);
    g.closePath();
    g.clip();
    const fill = g.createLinearGradient(0, stripY0, 0, stripY1);
    fill.addColorStop(0,   'rgba(40,70,150,0.30)');
    fill.addColorStop(0.5, 'rgba(60,95,190,0.14)');
    fill.addColorStop(1,   'rgba(40,70,150,0.30)');
    g.fillStyle = fill;
    g.fillRect(0, stripY0, flownX, stripH);
    g.fillStyle = 'rgba(20,26,48,0.55)';
    g.fillRect(flownX, stripY0, SHARE_W - flownX, stripH);
    g.restore();

    // Walls, drawn twice and clipped at the death point: bright for the stretch actually
    // flown, dim for whatever lies past it. The fill difference alone was too subtle to
    // read, and "how much of this did I fly" is the card's whole story.
    g.lineJoin = 'round'; g.lineCap = 'round';
    const strokeWalls = (x0, x1, bright) => {
        g.save();
        g.beginPath(); g.rect(x0, 0, x1 - x0, SHARE_H); g.clip();
        for (const line of [tops, bots]) {
            g.beginPath();
            g.moveTo(line[0][0], line[0][1]);
            for (const [x, y] of line) g.lineTo(x, y);
            g.strokeStyle = bright ? 'rgba(195,220,255,0.95)' : 'rgba(95,120,175,0.42)';
            g.lineWidth = bright ? 3 : 2;
            if (bright) { g.shadowColor = 'rgba(100,150,255,0.65)'; g.shadowBlur = 12; }
            g.stroke();
            g.shadowBlur = 0;
        }
        g.restore();
    };
    strokeWalls(0, flownX, true);
    if (flownX < SHARE_W) strokeWalls(flownX, SHARE_W, false);

    // All-time best marker: a quiet gold tick, only when it isn't the same spot as
    // this run's death (on a new personal best they coincide and one marker is enough).
    if (bestSX > 0 && Math.abs(bestSX - endWx) > wxMax * 0.02 && bestSX <= wxMax) {
        const bx = xOf(bestSX);
        g.setLineDash([7, 7]);
        g.strokeStyle = 'rgba(255,205,60,0.55)';
        g.lineWidth = 2;
        g.beginPath(); g.moveTo(bx, stripY0 - 12); g.lineTo(bx, stripY1 + 12); g.stroke();
        g.setLineDash([]);
        g.textAlign = 'center';
        g.font = F(19, true);
        g.fillStyle = 'rgba(255,215,90,0.85)';
        g.fillText(T.pb, bx, stripY1 + 32);
    }

    // Death point. Drawn as a marker rather than the ship sprite: shipPath/drawShip in
    // draw.js render into the game's own `ctx`, which is a const bound to the visible
    // canvas and can't be pointed at this offscreen one.
    {
        const dx = xOf(endWx), dy = yOf(Math.max(0, Math.min(H, lastRunY)));
        g.shadowColor = 'rgba(255,70,70,0.85)'; g.shadowBlur = 22;
        g.strokeStyle = 'rgba(255,90,90,0.95)';
        g.lineWidth = 3.5;
        g.beginPath(); g.arc(dx, dy, 15, 0, Math.PI * 2); g.stroke();
        g.beginPath();
        g.moveTo(dx - 9, dy - 9); g.lineTo(dx + 9, dy + 9);
        g.moveTo(dx + 9, dy - 9); g.lineTo(dx - 9, dy + 9);
        g.stroke();
        g.shadowBlur = 0;
    }

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
