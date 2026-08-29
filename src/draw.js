// ── Theme ─────────────────────────────────────────────────────────────
// One fixed rock palette for the whole calendar day (WEEKDAY_PALETTES,
// constants.js), not a within-run gradient by difficulty anymore -- see that
// array's doc comment. Recomputed from the real clock rather than cached at
// load, so a session left open across a UTC day boundary picks up the new
// day's rock the same way top5/dailyBest already roll over elsewhere.
function getTheme() {
    const p = WEEKDAY_PALETTES[weekdayIndex(new Date())];
    return { bg: WEEKDAY_BG, wall: p.wall, stal: p.stal, stalEdge: p.stalEdge, wallBase: p.wallBase };
}

// Rough-rock silhouette noise for the wall's rendered edge (draw()'s "Wall
// arrays" block). A first version summed a few sine waves -- smooth by
// construction, so it only ever read as small ripples, never as an actual
// fractured edge. Real value noise instead: each octave's lattice points are
// connected with a straight LINE (_rockNoise), not smoothed, so the result
// has genuine corners rather than another curve -- stacked at three scales
// (big facets, medium chips, fine grain) the way a meteorite's broken
// surface actually reads. Deterministic hash of world-x (scrolls naturally,
// never writhes in place) plus a seed offset so the top and bottom edges use
// independent noise fields instead of mirroring the same bumps. Purely
// cosmetic: applied only to the rendered topArr/botArr, never to
// boundsAt()/boundsBase(), so collision is untouched.
function _rockHash(i) {
    const x = Math.sin(i * 127.1) * 43758.5453;
    return 2 * (x - Math.floor(x)) - 1;
}
function _rockNoise(x) {
    const i0 = Math.floor(x), t = x - i0;
    return _rockHash(i0) + t * (_rockHash(i0 + 1) - _rockHash(i0));
}
// Shared intensity CAP for the rock-noise treatment below (walls and
// stalactites both read this) -- set to 0 on request, so the ramp still
// runs (harmless: _rockRoughness() always returns 0) but every wall/
// stalactite edge is the plain smooth boundsAt() curve again. The noise
// functions and the ramp itself are left in place rather than ripped out,
// since this was a deliberate "turn it off", not "this approach was
// wrong" -- flip this one constant back up (0.3 was the last hand-tuned
// flat value, 1.0 the top of the score-1000 ramp) if it comes back.
const ROCK_ROUGHNESS_MAX = 0;

// Ramps the roughness from smooth (0) at the start of a run up to the full
// ROCK_ROUGHNESS_MAX cap at score 1000, reading `score` directly -- an
// earlier version used scrollX/60000 instead (score's own distance term)
// on the assumption that score could wobble non-monotonically via poison
// coins, but that's wrong: poison only debits runCoins (the shard pool,
// update.js/systems.js), never bonusScore, and bonusScore only ever
// increments (near-miss, coin combo) -- score is strictly non-decreasing
// through a run, so reading it directly is both safe and exact ("score
// 1000" now means literally 100%, not an approximation). Plain linear
// ramp, not eased like _prog's sqrt -- "smooth", the ask here, just means
// no jump/step, which any continuous function already gives.
function _rockRoughness() {
    return Math.min(score / 1000, 1) * ROCK_ROUGHNESS_MAX;
}

function _wallJagged(wx, seedOffset) {
    const x = wx + seedOffset;
    return (_rockNoise(x * 0.033) * 4.5   // big facets, ~30px feature scale
          + _rockNoise(x * 0.11)  * 2.2   // medium chips
          + _rockNoise(x * 0.30)  * 1.0)  // fine grain
         * _rockRoughness();
}

// Same rough-rock treatment as the walls, applied to a stalactite's own
// silhouette (draw()'s stalactite loop). Walks the same two cubic beziers
// the smooth silhouette used, but as a jagged polyline instead of a single
// curve, tapered to exactly zero jag at the base and tip (Math.sin(t*PI))
// so those two points stay sharp/flush rather than blunted. Returns one
// ordered point list, base_R -> tip -> base_L, exact at both ends -- the
// fill silhouette traces it forward, the edge-glow stroke below reuses the
// same array reversed, so the glow can never drift off the fill it's
// supposed to trace. Seeded on s.wx (fixed per stalactite) rather than
// screen-x, so the jag doesn't reshape as the stalactite scrolls by.
function _stalOutline(sx, hw, hw_base, len, dir, tipY, bLwall, bRwall, seed) {
    const STEPS = 6;
    const jAmp = hw * 0.22 * _rockRoughness();
    const bez = (p0, p1, p2, p3, t) => {
        const u = 1 - t;
        return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
    };
    const pts = [{ x: sx + hw_base, y: bRwall }]; // base_R, exact
    for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS, taper = Math.sin(t * Math.PI);
        const bx = bez(sx + hw_base, sx + hw*0.70, sx + hw*0.12, sx, t);
        const by = bez(bRwall, bRwall + dir*len*0.38, tipY - dir*len*0.18, tipY, t);
        pts.push({ x: bx + _rockNoise(seed + t * 9) * jAmp * taper, y: by });
    }
    for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS, taper = Math.sin(t * Math.PI);
        const bx = bez(sx, sx - hw*0.12, sx - hw*0.70, sx - hw_base, t);
        const by = bez(tipY, tipY - dir*len*0.18, bLwall + dir*len*0.38, bLwall, t);
        pts.push({ x: bx + _rockNoise(seed + 100 + t * 9) * jAmp * taper, y: by });
    }
    return pts; // [base_R, ...jagged, tip (exact), ...jagged, base_L (exact)]
}

// Small tileable rock-speckle pattern, built once at load and reused every
// frame by _paintStonePattern below -- filling with an already-rasterized
// CanvasPattern is one native fill call, far cheaper than any per-pixel noise
// computed in JS every frame.
const STONE_TILE = 72;
function _buildStonePattern() {
    const pc = document.createElement('canvas');
    pc.width = STONE_TILE; pc.height = STONE_TILE;
    const pctx = pc.getContext('2d');
    let seed = 42;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 90; i++) {
        const x = rnd() * STONE_TILE, y = rnd() * STONE_TILE, r = 0.5 + rnd() * 1.6;
        pctx.beginPath();
        pctx.arc(x, y, r, 0, Math.PI * 2);
        pctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.10)';
        pctx.fill();
    }
    return pc;
}
const _stonePatternCanvas = _buildStonePattern();

// Paints the tiled stone pattern into the current clip region, scrolling in
// sync with scrollX. Caller is responsible for clipping to the wall shape
// first (ctx.save()/clip()) and restoring afterward.
function _paintStonePattern(scrollX) {
    const pat = ctx.createPattern(_stonePatternCanvas, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.translate(-(scrollX % STONE_TILE), 0);
    ctx.fillStyle = pat;
    ctx.fillRect(scrollX % STONE_TILE - 4, -8, W + 8, H + 16);
    ctx.restore();
}

function drawCoinIcon(cx, cy, type, r) {
    const isBlu = type === 'blue', isRed = type === 'red', isGrn = type === 'green', isOrng = type === 'orange', isPsn = type === 'poison', isBmb = type === 'bomb';
    const bodyClr = isBlu ? '#4dd9ff' : isRed ? '#ff4444' : isGrn ? '#44ff88' : isOrng ? '#ff5500' : isPsn ? '#5fbf00' : isBmb ? '#b833ff' : '#ffe040';
    const [gr, gg, gb] = isBlu ? [60,200,255] : isRed ? [255,60,60] : isGrn ? [50,255,120] : isOrng ? [255,85,0] : isPsn ? [110,200,20] : isBmb ? [190,50,255] : [255,225,50];
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.fillStyle   = bodyClr;
    ctx.shadowColor = `rgba(${gr},${gg},${gb},0.90)`;
    ctx.shadowBlur  = 10;
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.beginPath();
    ctx.arc(cx - r*0.28, cy - r*0.28, r*0.38, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,220,0.55)';
    ctx.fill();
}

// ── Draw helpers ──────────────────────────────────────────────────────

function shipPath(x, y, r) {
    // SR-71 Blackbird: needle nose, slim chined fuselage blending into large
    // 60-deg delta, outward-canted twin tails (nacelles drawn separately in drawShip)
    ctx.beginPath();
    ctx.moveTo(x + r*1.72,  y);               // needle nose (very long)
    ctx.lineTo(x + r*1.12,  y - r*0.17);      // forward chine
    ctx.lineTo(x + r*0.38,  y - r*0.22);      // chine / delta blend
    ctx.lineTo(x - r*0.65,  y - r*0.92);      // top wing tip
    ctx.lineTo(x - r*1.08,  y - r*0.22);      // top trailing edge
    ctx.lineTo(x - r*1.22,  y - r*0.32);      // top tail fin tip (canted outboard)
    ctx.lineTo(x - r*1.05,  y - r*0.08);      // top tail base
    ctx.lineTo(x - r*0.92,  y);               // tail center notch
    ctx.lineTo(x - r*1.05,  y + r*0.08);      // bottom tail base
    ctx.lineTo(x - r*1.22,  y + r*0.32);      // bottom tail fin tip
    ctx.lineTo(x - r*1.08,  y + r*0.22);      // bottom trailing edge
    ctx.lineTo(x - r*0.65,  y + r*0.92);      // bottom wing tip
    ctx.lineTo(x + r*0.38,  y + r*0.22);      // chine / delta blend
    ctx.lineTo(x + r*1.12,  y + r*0.17);      // forward chine
    ctx.closePath();
}

function drawShip(x, y, r, color, sr, sg, sb, blur) {
    blur = blur === undefined ? 20 : blur;

    // Base fill with glow
    shipPath(x, y, r);
    ctx.fillStyle   = color;
    ctx.shadowColor = `rgba(${sr},${sg},${sb},0.95)`;
    ctx.shadowBlur  = blur;
    ctx.fill();
    ctx.shadowBlur  = 0;

    // Shading overlay: bright at nose, darker at tail
    shipPath(x, y, r);
    const bodyGrd = ctx.createLinearGradient(x + r*1.72, y, x - r*1.22, y);
    bodyGrd.addColorStop(0,   'rgba(255,255,255,0.13)');
    bodyGrd.addColorStop(0.5, 'rgba(0,0,0,0)');
    bodyGrd.addColorStop(1,   'rgba(0,0,0,0.40)');
    ctx.fillStyle = bodyGrd;
    ctx.fill();

    // Leading edge highlight: long needle nose along chine to wing tip
    ctx.beginPath();
    ctx.moveTo(x + r*1.72, y);
    ctx.lineTo(x + r*1.12, y - r*0.17);
    ctx.lineTo(x + r*0.38, y - r*0.22);
    ctx.lineTo(x - r*0.65, y - r*0.92);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth   = Math.max(r * 0.09, 1);
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.stroke();

    // Engine nacelle pods - elongated ovals aligned to fuselage axis
    for (const s of [-1, 1]) {
        const nx = x - r*0.32, ny = y + s * r*0.50;
        ctx.beginPath();
        ctx.ellipse(nx, ny, r*0.42, r*0.115, 0, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fill();
        // Inlet cone: bright circle at forward end of nacelle
        ctx.beginPath();
        ctx.arc(nx + r*0.30, ny, r*0.075, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fill();
    }

    // Cockpit canopy (slim, well forward on the long fuselage)
    const cpx = x + r*1.10, cpy = y - r*0.05;
    const cpg = ctx.createRadialGradient(cpx - r*0.08, cpy - r*0.10, 0, cpx, cpy, r*0.36);
    cpg.addColorStop(0,   'rgba(255,255,255,0.72)');
    cpg.addColorStop(0.4, 'rgba(190,235,255,0.38)');
    cpg.addColorStop(1,   'rgba(120,210,255,0.04)');
    ctx.beginPath();
    ctx.ellipse(cpx, cpy, r*0.22, r*0.085, -0.10, 0, Math.PI*2);
    ctx.fillStyle = cpg;
    ctx.fill();
}

// ── Draw ──────────────────────────────────────────────────────────────

let _lastBgStr = '';


function drawWorld() {
    const ox = shake > 0 ? (Math.random()-0.5)*shake : 0;
    const oy = shake > 0 ? (Math.random()-0.5)*shake : 0;
    ctx.save();
    ctx.translate(ox, oy);

    const theme = getTheme();
    const bgStr = rgb(theme.bg);
    if (bgStr !== _lastBgStr) { document.body.style.background = bgStr; _lastBgStr = bgStr; }
    ctx.fillStyle = bgStr;
    ctx.fillRect(-20, -20, W+40, H+40);

    // Wall arrays. topArr/botArr get a small cosmetic jag added on top of the
    // real boundsAt() curve (_wallJagged, below) so the rendered edge reads as
    // broken rock instead of a smooth mathematical wave -- collision uses
    // boundsAt()/boundsBase() directly (update.js/systems.js), never these
    // arrays, so the jag is purely visual.
    const topArr = [], botArr = [], xs = [];
    for (let sx = -RSTEP; sx <= W + RSTEP*2; sx += RSTEP) {
        const wx = scrollX + sx;
        const b = boundsAt(wx);
        xs.push(sx);
        topArr.push(b.top + _wallJagged(wx, 0));
        botArr.push(b.bot + _wallJagged(wx, 5000));
    }
    const n = xs.length;

    // Precompute corridor edge extents for gradient anchors
    let topMax = topArr[0], botMin = botArr[0];
    for (let i = 1; i < n; i++) {
        if (topArr[i] > topMax) topMax = topArr[i];
        if (botArr[i] < botMin) botMin = botArr[i];
    }
    const edgeClrInner = lerpClr(theme.wall, theme.wallBase, 0.28);

    // Stalactite bodies - drawn BEFORE walls so the wall fill masks the base seam
    for (const s of stalactites) {
        const sx = s.wx - scrollX;
        if (sx < -70 || sx > W+70) continue;
        if (s.fade <= 0) continue;
        if (s.fade < 1.0) ctx.globalAlpha = s.fade;
        const b = boundsAt(s.wx), hw = s.width / 2;
        const len = s.length;
        const dir = s.isTop ? 1 : -1;
        const hw_base = hw;
        const bLwall = s.isTop ? boundsAt(s.wx - hw_base).top : boundsAt(s.wx - hw_base).bot;
        const bRwall = s.isTop ? boundsAt(s.wx + hw_base).top : boundsAt(s.wx + hw_base).bot;
        const tipY = s.isTop ? b.top + len : b.bot - len;
        const canvasBase = s.isTop ? -10 : H + 10;
        const gradY0 = s.isTop ? Math.min(bLwall, bRwall) : Math.max(bLwall, bRwall);

        // Gradient: dark at root, warmer mid-body, bright at tip
        const stalMidClr = lerpClr(theme.stal, theme.stalEdge, 0.18);
        const stalTipClr = lerpClr(theme.stal, theme.stalEdge, 0.58);
        let stalGrd;
        if (s.isTop) {
            stalGrd = ctx.createLinearGradient(sx, gradY0, sx, tipY);
            stalGrd.addColorStop(0,    rgb(theme.stal));
            stalGrd.addColorStop(0.50, rgb(stalMidClr));
            stalGrd.addColorStop(1,    rgb(stalTipClr));
        } else {
            stalGrd = ctx.createLinearGradient(sx, tipY, sx, gradY0);
            stalGrd.addColorStop(0,    rgb(stalTipClr));
            stalGrd.addColorStop(0.50, rgb(stalMidClr));
            stalGrd.addColorStop(1,    rgb(theme.stal));
        }

        // Jagged silhouette, shared by the fill and the edge-glow stroke below
        // so they can't drift apart (see _stalOutline's doc comment).
        const outline = _stalOutline(sx, hw, hw_base, len, dir, tipY, bLwall, bRwall, s.wx);
        const traceStal = () => {
            ctx.moveTo(sx - hw_base, canvasBase);
            ctx.lineTo(sx + hw_base, canvasBase);
            for (const p of outline) ctx.lineTo(p.x, p.y);
            ctx.lineTo(sx - hw_base, canvasBase);
            ctx.closePath();
        };

        // Base fill
        ctx.beginPath(); traceStal();
        ctx.fillStyle = stalGrd;
        ctx.fill();

        // Same stone-speckle texture as the walls -- reads as the same rock,
        // not a differently-treated obstacle.
        ctx.save();
        ctx.beginPath(); traceStal();
        ctx.clip();
        _paintStonePattern(scrollX);
        ctx.restore();

        // Inner glow: clip to shape, paint radial spot for mineral depth/luminescence
        ctx.save();
        ctx.beginPath(); traceStal();
        ctx.clip();
        const igCY = gradY0 + dir * len * 0.40;
        const igGrd = ctx.createRadialGradient(sx - hw*0.10, igCY, 0, sx, gradY0 + dir*len*0.12, hw * 1.15);
        igGrd.addColorStop(0,   rgb(lerpClr(theme.stalEdge, [255,255,255], 0.25), 0.30));
        igGrd.addColorStop(0.5, rgb(theme.stalEdge, 0.07));
        igGrd.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = igGrd;
        const gy0 = Math.min(canvasBase, tipY) - 5, gy1 = Math.max(canvasBase, tipY) + 5;
        ctx.fillRect(sx - hw*1.3, gy0, hw*2.6, gy1 - gy0);
        ctx.restore();

        // Edge glow with soft shadow halo - same outline array, reversed
        // (base_L -> tip -> base_R instead of base_R -> tip -> base_L)
        ctx.shadowBlur  = 11;
        ctx.shadowColor = rgb(theme.stalEdge, 0.48);
        ctx.beginPath();
        const rev = outline.slice().reverse();
        ctx.moveTo(rev[0].x, rev[0].y);
        for (let i = 1; i < rev.length; i++) ctx.lineTo(rev[i].x, rev[i].y);
        ctx.strokeStyle = rgb(theme.stalEdge, 0.78);
        ctx.lineWidth   = 1.5;
        ctx.lineCap = 'butt';
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineCap = 'round';

        // Specular streak: bright reflection line left of center
        const hlA   = gradY0 + dir * len * 0.07;
        const hlB   = gradY0 + dir * len * 0.76;
        const hlClr = lerpClr(theme.stalEdge, [255,255,255], 0.38);
        const hlGrd = ctx.createLinearGradient(sx, hlA, sx, hlB);
        hlGrd.addColorStop(0,    rgb(hlClr, 0));
        hlGrd.addColorStop(0.18, rgb(hlClr, 0.50));
        hlGrd.addColorStop(0.60, rgb(hlClr, 0.25));
        hlGrd.addColorStop(1,    rgb(hlClr, 0));
        ctx.beginPath();
        ctx.moveTo(sx - hw * 0.07, hlA);
        ctx.lineTo(sx - hw * 0.04, hlB);
        ctx.strokeStyle = hlGrd;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        if (s.fade < 1.0) ctx.globalAlpha = 1.0;
    }

    // Top wall - dark at canvas top, accent-tinted at corridor edge
    const traceTopWall = () => {
        ctx.beginPath();
        ctx.moveTo(xs[0], -2);
        for (let i = 0; i < n; i++) ctx.lineTo(xs[i], topArr[i]);
        ctx.lineTo(xs[n-1], -2);
        ctx.closePath();
    };
    traceTopWall();
    const topGrd = ctx.createLinearGradient(0, -2, 0, topMax);
    topGrd.addColorStop(0,    rgb(theme.wall));
    topGrd.addColorStop(0.72, rgb(theme.wall));
    topGrd.addColorStop(1,    rgb(edgeClrInner));
    ctx.fillStyle = topGrd;
    ctx.fill();
    ctx.save();
    traceTopWall();
    ctx.clip();
    _paintStonePattern(scrollX);
    ctx.restore();

    // Bottom wall - accent-tinted at corridor edge, dark at canvas bottom
    const traceBotWall = () => {
        ctx.beginPath();
        ctx.moveTo(xs[0], H+2);
        for (let i = 0; i < n; i++) ctx.lineTo(xs[i], botArr[i]);
        ctx.lineTo(xs[n-1], H+2);
        ctx.closePath();
    };
    traceBotWall();
    const botGrd = ctx.createLinearGradient(0, botMin, 0, H+2);
    botGrd.addColorStop(0,    rgb(edgeClrInner));
    botGrd.addColorStop(0.28, rgb(theme.wall));
    botGrd.addColorStop(1,    rgb(theme.wall));
    ctx.fillStyle = botGrd;
    ctx.fill();
    ctx.save();
    traceBotWall();
    ctx.clip();
    _paintStonePattern(scrollX);
    ctx.restore();

    // Bullets
    drawBullets();

    // Wall edge glow - shifts from theme base -> cyan when bonus is active
    const bonusT  = Math.min(gapBonus / GAP_BONUS_MAX, 1);
    const wb      = theme.wallBase;
    const edgeR   = Math.round(lerp(wb[0],  40, bonusT));
    const edgeG   = Math.round(lerp(wb[1], 210, bonusT));
    const edgeB   = Math.round(lerp(wb[2], 255, bonusT));
    const edgeClr = `rgba(${edgeR},${edgeG},${edgeB},0.55)`;

    // Precompute which columns sit under a stalactite. Same test as before
    // (Math.abs(wx - s.wx) <= s.width/2 - RSTEP), just walked once per
    // stalactite over its own span instead of once per column over the full
    // stalactite list -- avoids an O(columns x stalactites) scan every frame.
    const topBlocked = new Uint8Array(n);
    const botBlocked = new Uint8Array(n);
    for (const s of stalactites) {
        const half = s.width / 2 - RSTEP;
        if (half < 0) continue;
        const loI = Math.max(0, Math.ceil((s.wx - half - scrollX - xs[0]) / RSTEP));
        const hiI = Math.min(n - 1, Math.floor((s.wx + half - scrollX - xs[0]) / RSTEP));
        if (loI > hiI) continue;
        const arr = s.isTop ? topBlocked : botBlocked;
        for (let i = loI; i <= hiI; i++) arr[i] = 1;
    }

    ctx.strokeStyle = edgeClr; ctx.lineWidth = 2;
    let brk = true;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        if (topBlocked[i]) { brk = true; continue; }
        if (brk) { ctx.moveTo(xs[i], topArr[i]); brk = false; }
        else      ctx.lineTo(xs[i], topArr[i]);
    }
    ctx.stroke();

    brk = true;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        if (botBlocked[i]) { brk = true; continue; }
        if (brk) { ctx.moveTo(xs[i], botArr[i]); brk = false; }
        else      ctx.lineTo(xs[i], botArr[i]);
    }
    ctx.stroke();

    // Death markers - rings etched into wall at each death spot
    for (const m of deathMarkers) {
        const sx = m.wx - scrollX;
        if (sx < -80 || sx > W + 80) continue;
        const mr = PR * 1.55;
        ctx.beginPath();
        ctx.arc(sx, m.wallY, mr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,55,55,0.48)';
        ctx.lineWidth   = 1.8;
        ctx.shadowColor = 'rgba(255,30,30,0.55)';
        ctx.shadowBlur  = 6;
        ctx.stroke();
        ctx.shadowBlur  = 0;
        ctx.beginPath();
        ctx.arc(sx, m.wallY, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,80,80,0.50)';
        ctx.fill();
    }

    // Best-run marker - gold ring showing where the all-time best ended
    if (bestMarker) {
        const sx = bestMarker.wx - scrollX;
        if (sx >= -80 && sx <= W + 80) {
            const pulse = 0.7 + 0.3 * Math.sin(gtime * 3.5);
            const mr    = PR * 1.9;
            ctx.beginPath();
            ctx.arc(sx, bestMarker.wallY, mr, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,215,0,${0.75 * pulse})`;
            ctx.lineWidth   = 2.2;
            ctx.shadowColor = `rgba(255,190,0,${0.85 * pulse})`;
            ctx.shadowBlur  = 10;
            ctx.stroke();
            ctx.shadowBlur  = 0;
            // Star center
            ctx.beginPath();
            ctx.arc(sx, bestMarker.wallY, 2.4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,230,80,${0.90 * pulse})`;
            ctx.fill();
        }
    }

    // Mines
    for (const m of mines) {
        const sx = m.wx - scrollX;
        if (sx < -60 || sx > W + 60) continue;
        const my = m.baseY + m.bobAmp * Math.sin(gtime * 1.8 + m.phase);
        const pulse = 0.85 + 0.15 * Math.sin(gtime * 4.5 + m.phase);

        // Outer danger glow
        const mgrd = ctx.createRadialGradient(sx, my, 0, sx, my, MINE_R * 2.8 * pulse);
        mgrd.addColorStop(0,   'rgba(255,40,20,0.22)');
        mgrd.addColorStop(0.5, 'rgba(255,20,10,0.08)');
        mgrd.addColorStop(1,   'transparent');
        ctx.beginPath();
        ctx.arc(sx, my, MINE_R * 2.8 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = mgrd;
        ctx.fill();

        // Spikes (8 directions) - all share one style, so drawn as a single
        // multi-segment path + one stroke() instead of 8 separate strokes
        ctx.strokeStyle = 'rgba(200,60,40,0.80)';
        ctx.lineWidth   = 1.4;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.moveTo(sx + Math.cos(a) * MINE_R * 0.85, my + Math.sin(a) * MINE_R * 0.85);
            ctx.lineTo(sx + Math.cos(a) * (MINE_R * 1.65), my + Math.sin(a) * (MINE_R * 1.65));
        }
        ctx.stroke();

        // Body
        ctx.beginPath();
        ctx.arc(sx, my, MINE_R, 0, Math.PI * 2);
        ctx.fillStyle   = '#1a0808';
        ctx.shadowColor = `rgba(255,50,20,${0.70 + 0.25 * pulse})`;
        ctx.shadowBlur  = 14;
        ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = 'rgba(200,60,40,0.70)';
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        // Hot core highlight
        const core = ctx.createRadialGradient(sx - MINE_R*0.22, my - MINE_R*0.22, 0, sx, my, MINE_R * 0.65);
        core.addColorStop(0,   `rgba(255,160,80,${0.55 * pulse})`);
        core.addColorStop(1,   'transparent');
        ctx.beginPath();
        ctx.arc(sx, my, MINE_R, 0, Math.PI * 2);
        ctx.fillStyle = core;
        ctx.fill();
    }

    // Cannons - military artillery bolted to the wall: gunmetal carriage + barrel,
    // dimmed once spent (fired) so a glance tells whether one still has its shot
    // coming. Fires the exact same projectile sprite as the player's own bullets
    // (drawProjectile, systems.js) so its shots read as literal enemy fire.
    for (const c of cannons) {
        const sx = c.wx - scrollX;
        if (sx < -60 || sx > W + 60) continue;
        const b     = boundsAt(c.wx);
        const wallY = c.isTop ? b.top : b.bot;
        const dir   = c.isTop ? 1 : -1;
        const barrelLen = CANNON_R * 2.2, barrelW = CANNON_R * 0.60;
        ctx.save();
        ctx.globalAlpha = c.fired ? 0.45 : 1.0;
        ctx.translate(sx, wallY);

        // Barrel, angled into the corridor toward its firing direction
        ctx.save();
        ctx.rotate(dir * 0.55);
        const barrelGrd = ctx.createLinearGradient(-barrelW/2, 0, barrelW/2, 0);
        barrelGrd.addColorStop(0,   '#18181a');
        barrelGrd.addColorStop(0.5, '#5c5c62');
        barrelGrd.addColorStop(1,   '#18181a');
        ctx.fillStyle = barrelGrd;
        ctx.fillRect(-barrelW/2, 0, barrelW, dir * barrelLen);
        // Muzzle brake at the tip
        ctx.fillStyle = '#0d0d0f';
        ctx.fillRect(-barrelW*0.72, dir*barrelLen*0.84, barrelW*1.44, dir*barrelLen*0.16);
        // Hazard stripe partway down the barrel
        ctx.fillStyle = 'rgba(255,140,0,0.85)';
        ctx.fillRect(-barrelW/2, dir*barrelLen*0.52, barrelW, dir*barrelLen*0.09);
        ctx.restore();

        // Base carriage bolted flush to the wall
        ctx.beginPath();
        ctx.moveTo(-CANNON_R*1.1, 0);
        ctx.lineTo(CANNON_R*1.1, 0);
        ctx.lineTo(CANNON_R*0.72, dir*CANNON_R*0.85);
        ctx.lineTo(-CANNON_R*0.72, dir*CANNON_R*0.85);
        ctx.closePath();
        const baseGrd = ctx.createLinearGradient(0, 0, 0, dir*CANNON_R*0.85);
        baseGrd.addColorStop(0, '#4a4a50');
        baseGrd.addColorStop(1, '#1a1a1c');
        ctx.fillStyle   = baseGrd;
        ctx.shadowColor = 'rgba(255,140,0,0.35)';
        ctx.shadowBlur  = 6;
        ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = 'rgba(255,160,40,0.45)';
        ctx.lineWidth   = 1.2;
        ctx.stroke();

        // Turret pivot housing
        ctx.beginPath();
        ctx.arc(0, 0, CANNON_R * 0.44, 0, Math.PI * 2);
        ctx.fillStyle   = '#333338';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,150,40,0.5)';
        ctx.lineWidth   = 1;
        ctx.stroke();

        ctx.restore();
    }

    // Cannon shots - fired diagonal projectiles, same sprite as the player's bullets
    for (const s of cannonShots) {
        const sx = s.wx - scrollX;
        if (sx < -20 || sx > W + 20) continue;
        drawProjectile(sx, s.y, Math.atan2(s.vy, s.vx));
    }

    // Ambient motes - subtle dust drifting through the tunnel
    const [mr, mg, mb] = theme.wallBase;
    for (const p of ambParts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${mr},${mg},${mb},${p.a})`;
        ctx.fill();
    }

    // Personal best line
    if (phase === 'play' && bestSX > 0) {
        const lx = bestSX - scrollX;
        if (lx > -60 && lx < W + 80) {
            const ahead  = Math.max(0, Math.min(1, (lx - PX) / 220));   // fade in as it approaches
            const behind = Math.max(0, Math.min(1, (lx + 60)  / 80));   // fade out after passing
            const lineA  = Math.min(ahead > 0 ? ahead : 1, behind) * 0.75;
            if (lineA > 0.01) {
                const lb = boundsAt(bestSX);
                ctx.save();
                ctx.strokeStyle = `rgba(255,210,50,${lineA})`;
                ctx.lineWidth   = 1.5;
                ctx.shadowColor = `rgba(255,200,40,${lineA * 0.8})`;
                ctx.shadowBlur  = 8;
                ctx.setLineDash([5, 4]);
                ctx.beginPath();
                ctx.moveTo(lx, lb.top - 4);
                ctx.lineTo(lx, lb.bot + 4);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.shadowBlur  = 0;
                ctx.font        = `bold ${W * 0.018}px 'Courier New',monospace`;
                ctx.fillStyle   = `rgba(255,215,55,${lineA * 0.95})`;
                ctx.textAlign   = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(T.pb, lx, lb.top - 5);
                ctx.textBaseline = 'top';
                ctx.restore();
            }
        }
    }

    // Coins (regular + chicane guaranteed)
    for (const arr of [coins, chicaneCoins]) for (const coin of arr) {
        if (coin.collected || coin.fade <= 0) continue;
        const sx = coin.wx - scrollX;
        if (sx < -50 || sx > W+50) continue;

        ctx.globalAlpha = coin.fade;

        const isBlu = coin.type === 'blue', isRed = coin.type === 'red', isGrn = coin.type === 'green', isOrng = coin.type === 'orange', isPsn = coin.type === 'poison', isBmb = coin.type === 'bomb';
        const bodyClr = isBlu ? '#4dd9ff' : isRed ? '#ff4444' : isGrn ? '#44ff88' : isOrng ? '#ff5500' : isPsn ? '#5fbf00' : isBmb ? '#b833ff' : '#ffe040';
        const [gr, gg, gb] = isBlu ? [60,200,255] : isRed ? [255,60,60] : isGrn ? [50,255,120] : isOrng ? [255,85,0] : isPsn ? [110,200,20] : isBmb ? [190,50,255] : [255,225,50];
        const darkR = Math.floor(gr * 0.28), darkG = Math.floor(gg * 0.28), darkB = Math.floor(gb * 0.28);

        if (isPsn) {
            // Poison gets an entirely different silhouette and motion, not just a
            // recolored gem -- shape and motion register before color does, and every
            // legitimate coin already owns "faceted gem, smooth pulse, bright sparkle."
            // A jagged, unevenly-pulsing spore with visible drips reads as unstable/
            // dangerous on sight, independent of the X mark or the color itself.
            const jag = coin.wx * 0.017;
            const flicker = 0.55 + 0.25 * Math.sin(gtime * 9.5 + jag) + 0.20 * Math.sin(gtime * 3.1 + jag * 2.3);
            const pr = COIN_R * (0.95 + 0.10 * Math.sin(gtime * 6.3 + jag));

            // Hazy glow that strobes irregularly, unlike the calm single-sine glow
            // every other coin shares
            const grdP = ctx.createRadialGradient(sx, coin.y, pr * 0.3, sx, coin.y, pr * 3.2);
            grdP.addColorStop(0,   `rgba(${gr},${gg},${gb},${0.30 * flicker})`);
            grdP.addColorStop(0.4, `rgba(${gr},${gg},${gb},${0.10 * flicker})`);
            grdP.addColorStop(1,   'transparent');
            ctx.beginPath(); ctx.arc(sx, coin.y, pr * 3.2, 0, Math.PI * 2);
            ctx.fillStyle = grdP; ctx.fill();

            ctx.save();
            ctx.translate(sx, coin.y);

            // Irregular 7-point spore silhouette: alternating long/short spikes, each
            // nudged by a fixed per-point jitter (stable per coin, not reshaping every
            // frame) so the outline itself reads as organic/unstable rather than a
            // clean polished facet.
            const N = 7;
            ctx.beginPath();
            for (let i = 0; i <= N; i++) {
                const ang = (i / N) * Math.PI * 2;
                const jitter = 0.75 + 0.35 * Math.sin(jag + i * 2.4);
                const rad = pr * (i % 2 === 0 ? 1.15 : 0.55) * jitter;
                const x = Math.sin(ang) * rad, y = -Math.cos(ang) * rad;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
            const bGrdP = ctx.createRadialGradient(0, -pr * 0.2, 0, 0, 0, pr * 1.3);
            bGrdP.addColorStop(0,    `rgb(${Math.min(255,gr+60)},${Math.min(255,gg+60)},${Math.min(255,gb+40)})`);
            bGrdP.addColorStop(0.55, bodyClr);
            bGrdP.addColorStop(1,    `rgb(${Math.floor(gr*0.22)},${Math.floor(gg*0.30)},${Math.floor(gb*0.15)})`);
            ctx.fillStyle   = bGrdP;
            ctx.shadowColor = `rgba(${gr},${gg},${gb},${0.7 * flicker})`;
            ctx.shadowBlur  = 9;
            ctx.fill();
            ctx.shadowBlur  = 0;
            // Dark rim -- no bright polished facet lines like the treasure coins get,
            // this one shouldn't look "valuable"
            ctx.strokeStyle = 'rgba(10,20,0,0.65)';
            ctx.lineWidth   = Math.max(pr * 0.10, 1);
            ctx.stroke();

            // Dripping ooze hanging from the underside -- continuous "this is actively
            // leaking" cue, not just a static icon
            for (const ddx of [-0.35, 0.4]) {
                const dripLen = pr * (0.55 + 0.25 * Math.sin(gtime * 4 + jag + ddx * 10));
                ctx.beginPath();
                ctx.moveTo(pr * ddx, pr * 0.7);
                ctx.quadraticCurveTo(pr * ddx * 1.1, pr * 0.7 + dripLen * 0.6, pr * ddx * 0.7, pr * 0.7 + dripLen);
                ctx.strokeStyle = `rgba(${gr},${gg},${gb},0.55)`;
                ctx.lineWidth   = Math.max(pr * 0.12, 1);
                ctx.lineCap     = 'round';
                ctx.stroke();
                ctx.lineCap = 'butt';
            }

            // Warning X on top -- still there as a colorblind-safe "avoid" cue,
            // independent of the new shape too
            ctx.beginPath();
            ctx.moveTo(-pr*0.40, -pr*0.40); ctx.lineTo(pr*0.40, pr*0.40);
            ctx.moveTo(pr*0.40, -pr*0.40);  ctx.lineTo(-pr*0.40, pr*0.40);
            ctx.strokeStyle = 'rgba(15,0,20,0.85)';
            ctx.lineWidth   = Math.max(pr * 0.15, 1.2);
            ctx.lineCap     = 'round';
            ctx.stroke();
            ctx.lineCap = 'butt';

            ctx.restore();
        } else {
        const pulse = 1 + 0.18 * Math.sin(gtime * 5.5 + coin.wx * 0.013);
        const r  = COIN_R * pulse;
        const dh = r * 1.35, dw = r * 0.90;

        // Glow aura
        const grdO = ctx.createRadialGradient(sx, coin.y, r * 0.4, sx, coin.y, r * 3.6);
        grdO.addColorStop(0,    `rgba(${gr},${gg},${gb},0.32)`);
        grdO.addColorStop(0.35, `rgba(${gr},${gg},${gb},0.11)`);
        grdO.addColorStop(1,    'transparent');
        ctx.beginPath(); ctx.arc(sx, coin.y, r * 3.6, 0, Math.PI * 2);
        ctx.fillStyle = grdO; ctx.fill();

        ctx.save();
        ctx.translate(sx, coin.y);
        const spin = gtime * 0.9 + coin.wx * 0.008;
        ctx.rotate(spin);

        // 8 sparkle rays: 4 long + 4 short, each pulsing independently.
        // Style is identical within each group (only direction + pulsing
        // length differ), so each group is one multi-segment path + one
        // stroke() instead of 8 separate save/rotate/stroke cycles. Ray
        // endpoints are rotated by hand (equivalent to the old per-ray
        // ctx.rotate(i*45deg) applied to a point at (0,-d)) since they no
        // longer get their own transform.
        ctx.shadowColor = `rgba(${gr},${gg},${gb},0.65)`;
        for (const long of [true, false]) {
            ctx.beginPath();
            for (let i = long ? 0 : 1; i < 8; i += 2) {
                const rp = 0.72 + 0.28 * Math.sin(gtime * 3.2 + i * 1.1 + coin.wx * 0.005);
                const th = i * Math.PI * 0.25, s = Math.sin(th), c = Math.cos(th);
                const d1 = r * 1.50, d2 = r * (long ? 2.75 : 1.90) * rp;
                ctx.moveTo(d1 * s, -d1 * c);
                ctx.lineTo(d2 * s, -d2 * c);
            }
            ctx.strokeStyle = `rgba(${gr},${gg},${gb},${long ? 0.88 : 0.42})`;
            ctx.lineWidth   = long ? 1.5 : 0.8;
            ctx.shadowBlur  = long ? 3 : 1;
            ctx.stroke();
        }
        ctx.shadowBlur  = 0;

        // Diamond outline helper
        const gem = () => {
            ctx.beginPath();
            ctx.moveTo(0, -dh); ctx.lineTo(dw, 0);
            ctx.lineTo(0,  dh); ctx.lineTo(-dw, 0);
            ctx.closePath();
        };

        // Body: top-to-bottom gradient for 3-D depth
        gem();
        const bGrd = ctx.createLinearGradient(0, -dh, 0, dh);
        bGrd.addColorStop(0,    'rgba(255,255,255,0.95)');
        bGrd.addColorStop(0.13, bodyClr);
        bGrd.addColorStop(0.50, bodyClr);
        bGrd.addColorStop(0.80, `rgb(${darkR},${darkG},${darkB})`);
        bGrd.addColorStop(1,    'rgba(0,0,0,0.55)');
        ctx.fillStyle   = bGrd;
        ctx.shadowColor = `rgba(${gr},${gg},${gb},0.90)`;
        ctx.shadowBlur  = 11;
        ctx.fill();
        ctx.shadowBlur  = 0;

        // 4-facet shading overlays
        ctx.beginPath(); ctx.moveTo(0,-dh); ctx.lineTo(dw,0);  ctx.lineTo(0,0); ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();  // top-right: brightest
        ctx.beginPath(); ctx.moveTo(0,-dh); ctx.lineTo(-dw,0); ctx.lineTo(0,0); ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();  // top-left: lighter
        ctx.beginPath(); ctx.moveTo(dw,0);  ctx.lineTo(0,dh);  ctx.lineTo(0,0); ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.18)';       ctx.fill();  // bottom-right: shadow
        ctx.beginPath(); ctx.moveTo(-dw,0); ctx.lineTo(0,dh);  ctx.lineTo(0,0); ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.30)';       ctx.fill();  // bottom-left: darkest

        // Facet edge lines (structure lines cut through the gem)
        ctx.lineWidth = 0.7; ctx.lineCap = 'round';
        [[0,-dh,dw,0],[dw,0,0,dh]].forEach(([x0,y0,x1,y1]) => {
            ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1);
            ctx.strokeStyle = 'rgba(255,255,255,0.20)'; ctx.stroke();
        });
        [[0,-dh,-dw,0],[-dw,0,0,dh]].forEach(([x0,y0,x1,y1]) => {
            ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1);
            ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.stroke();
        });
        ctx.beginPath(); ctx.moveTo(-dw,0); ctx.lineTo(dw,0);
        ctx.strokeStyle = 'rgba(255,255,255,0.24)'; ctx.stroke();
        ctx.lineCap = 'butt';

        // Glowing outer edge
        gem();
        ctx.strokeStyle = `rgba(${gr},${gg},${gb},0.72)`;
        ctx.lineWidth   = 1.5;
        ctx.shadowColor = `rgba(${gr},${gg},${gb},0.85)`;
        ctx.shadowBlur  = 6;
        ctx.stroke();
        ctx.shadowBlur  = 0;

        // Specular glints: main + secondary
        ctx.beginPath();
        ctx.arc(-dw * 0.18, -dh * 0.40, r * 0.30, 0, Math.PI * 2);
        ctx.fillStyle   = 'rgba(255,255,255,0.95)';
        ctx.shadowColor = 'rgba(255,255,255,0.85)';
        ctx.shadowBlur  = 4;
        ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.beginPath();
        ctx.arc(dw * 0.36, -dh * 0.16, r * 0.13, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.60)';
        ctx.fill();

        // Bomb spark mark: a small 8-point burst so it reads as "trigger me"
        if (isBmb) {
            ctx.beginPath();
            for (let k = 0; k < 8; k++) {
                const ang = k * Math.PI / 4;
                const c = Math.cos(ang), s = Math.sin(ang);
                ctx.moveTo(c*dw*0.16, s*dh*0.16);
                ctx.lineTo(c*dw*0.52, s*dh*0.52);
            }
            ctx.strokeStyle = 'rgba(255,255,255,0.90)';
            ctx.lineWidth   = Math.max(r * 0.13, 1.1);
            ctx.lineCap     = 'round';
            ctx.stroke();
            ctx.lineCap = 'butt';
        }

        ctx.restore();
        }
        ctx.globalAlpha = 1;
    }

    // Proximity danger flash
    if (phase === 'play') {
        const b       = boundsAt(scrollX + PX);
        const minDist = Math.min(py - PR - b.top, b.bot - (py + PR));
        const safe    = (_halfGap + gapBonus) * 0.35;
        const danger  = Math.max(0, 1 - minDist / safe);
        if (danger > 0) {
            ctx.fillStyle = `rgba(255,20,20,${danger*0.22})`;
            ctx.fillRect(-20,-20,W+40,H+40);
        }
    }
    // Thruster particle trail (drawn before player so it appears behind). On-fire embers
    // (update.js, tagged `fire`) get a shadowBlur glow the plain thrust burst doesn't --
    // they're meant to read as flame, not just colored exhaust, so they need actual light
    // spilling onto the dark tunnel around them, not just a saturated fill.
    for (const p of thrustParts) {
        const a = Math.max(p.life, 0);
        const blue = p.h > 150;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(p.r * p.life, 0.4), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.h},100%,${blue ? 68 : 84}%,${a})`;
        if (p.fire) {
            ctx.shadowColor = `hsla(${p.h},100%,60%,${a})`;
            ctx.shadowBlur  = 10;
        }
        ctx.fill();
        if (p.fire) ctx.shadowBlur = 0;
    }

    // Speed lines - horizontal streaks driven by vertical velocity OR scroll speed
    if (phase === 'play') {
        const vyFrac    = Math.max(0, (Math.abs(vy) - 300) / (MAX_VY - 300));
        const actualSpd = scrollSpd() * slowScrollFactor();
        const normSpd   = actualSpd * 600 / W;
        const spdFrac   = Math.max(0, (normSpd - 380) / (560 - 380));
        const speedFrac = Math.max(vyFrac, spdFrac);
        if (speedFrac > 0.05) {
            const sk = SKINS[activeSkin] || SKINS[0];
            const [sr, sg, sb] = sk.shadow;
            const maxLen = W * 0.20 * speedFrac;
            for (let i = 0; i < 6; i++) {
                const yOff     = (i - 2.5) * PR * 0.85;
                const distFrac = Math.abs(yOff) / (PR * 2.5);
                const len      = maxLen * (1 - distFrac * 0.45);
                const alpha    = speedFrac * (0.40 - distFrac * 0.28);
                if (alpha < 0.02 || len < 1) continue;
                ctx.beginPath();
                ctx.moveTo(PX - PR * 1.1, py + yOff);
                ctx.lineTo(PX - PR * 1.1 - len, py + yOff);
                ctx.strokeStyle = `rgba(${sr},${sg},${sb},${alpha})`;
                ctx.lineWidth   = Math.max(0.5, 1.8 - distFrac * 1.1);
                ctx.lineCap     = 'round';
                ctx.stroke();
            }
            ctx.lineCap = 'butt';
        }
    }

    // Player trail - fire-tinted once this run's live score has overtaken today's daily
    // best (onFire, state.js/update.js). Distinct from the physics-driven speed lines
    // above: those say "you're moving fast", this says "you're beating today" -- a
    // score-based state that only changes at run boundaries, not frame to frame. Bigger
    // and more opaque too, so the same recolor reads at a glance rather than needing the
    // player to compare it against the skin-tinted version from memory.
    {
        const sk = SKINS[activeSkin] || SKINS[0];
        const [sr, sg, sb] = onFire ? [255, 110, 20] : sk.shadow;
        const sizeMul = onFire ? 0.85 : 0.65, alphaMul = onFire ? 0.40 : 0.26;
        if (onFire) {
            ctx.shadowColor = 'rgba(255,130,30,0.9)';
            ctx.shadowBlur  = 14;
        }
        for (let i = 0; i < trailY.length; i++) {
            const frac = i / trailY.length, off = (trailY.length-1-i)*5;
            ctx.beginPath();
            ctx.arc(PX-off, trailY[i], PR*frac*sizeMul, 0, Math.PI*2);
            ctx.fillStyle = `rgba(${sr},${sg},${sb},${frac*alphaMul})`;
            ctx.fill();
        }
        if (onFire) ctx.shadowBlur = 0;
    }

    // On-fire ignition pop - one quick expanding ring at the instant onFire flips true
    // (onFireFlash, set alongside onFire in update.js). Decays fast and independently of
    // onFire itself, which stays true for the rest of the run and keeps recoloring the
    // trail above -- this is just the single punchy beat at the moment of catching fire,
    // same relationship milestoneFlash has to the milestone banner it accompanies.
    if (onFireFlash > 0 && phase === 'play') {
        const ofa   = onFireFlash;
        const ringR = PR * (1.6 + (1 - ofa) * 9);
        ctx.save();
        ctx.beginPath();
        ctx.arc(PX, py, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,140,30,${ofa * 0.8})`;
        ctx.lineWidth   = Math.max(1, PR * 0.35 * ofa);
        ctx.shadowColor = 'rgba(255,130,30,0.9)';
        ctx.shadowBlur  = 20 * ofa;
        ctx.stroke();
        ctx.restore();
    }

    // Shield bubble (one nested translucent bubble per charge)
    if (shieldCount > 0 && phase === 'play') {
        const sp = 1 + 0.10 * Math.sin(gtime * 6);
        let rOuter = PR * 2.0;
        for (let i = 0; i < shieldCount; i++) {
            const r = PR * (2.0 + i * 0.7) * sp;
            rOuter = r;
            ctx.beginPath();
            ctx.arc(PX, py, r, 0, Math.PI*2);
            const grad = ctx.createRadialGradient(PX, py, r * 0.3, PX, py, r);
            grad.addColorStop(0,    'rgba(255,90,90,0.04)');
            grad.addColorStop(0.75, 'rgba(255,70,70,0.09)');
            grad.addColorStop(1,    'rgba(255,60,60,0.28)');
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.strokeStyle = `rgba(255,140,140,${Math.max(0.55 - i * 0.12, 0.22)})`;
            ctx.lineWidth   = 1.6;
            ctx.shadowColor = 'rgba(255,50,50,0.75)';
            ctx.shadowBlur  = 10;
            ctx.stroke();
            ctx.shadowBlur  = 0;
        }
        // glossy highlight on the outermost bubble
        ctx.beginPath();
        ctx.arc(PX - rOuter * 0.32, py - rOuter * 0.32, rOuter * 0.22, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fill();
    }

    // Magnet ring
    if (magnetTime > 0 && phase === 'play') {
        const sp = 1 + 0.20 * Math.sin(gtime * 11);
        ctx.beginPath();
        ctx.arc(PX, py, PR * (3.2 + 0.35 * sp), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(80,255,130,${Math.min(magnetTime / 1.5, 1.0) * 0.75})`;
        ctx.lineWidth   = 2.0;
        ctx.shadowColor = 'rgba(60,255,110,0.85)';
        ctx.shadowBlur  = 12;
        ctx.stroke();
        ctx.shadowBlur  = 0;
    }

    // Ghost of today's best run (update.js). Drawn before the Player block below, not
    // inside it: that block applies a rotate() pivoted on the *player's* position for
    // shipPitch, so a ghost drawn inside it would swing around the live ship every time
    // the player pitched. It carries its own pitch, derived from the recorded track's
    // slope. Deliberately a flat desaturated blue rather than the active skin's colour --
    // it has to read as "not you" at a glance, and re-tinting it per skin would make it
    // look like a second live ship.
    //
    // Late join (GHOST_LATE_JOIN_GAP, constants.js): the ship itself only renders once
    // the player has closed to within that many points of the ghost's score, so it
    // doesn't pop in the instant a run starts, arbitrarily far behind.
    const _ghostGap = ghostScore - score;
    if (phase === 'play' && ghostY !== null && ghostY !== undefined && _ghostGap <= GHOST_LATE_JOIN_GAP) {
        ctx.save();
        ctx.globalAlpha = 0.17;
        ctx.translate(PX, ghostY);
        ctx.rotate(ghostPitch);
        ctx.translate(-PX, -ghostY);
        drawShip(PX, ghostY, PR, '#8fb4ec', 120, 165, 235, 8);
        ctx.restore();
    }

    // Player
    if (phase !== 'dead' || deadT < 0.18) {
        const sk = SKINS[activeSkin] || SKINS[0];
        const [sr, sg, sb] = sk.shadow;
        const pitchAngle = shipPitch;
        ctx.save();
        ctx.translate(PX, py);
        ctx.rotate(pitchAngle);
        ctx.translate(-PX, -py);

        if ((holding || startRamp < 1) && (phase === 'play' || phase === 'title')) {
            const pulse = 0.75 + 0.25 * Math.sin(gtime * 22);
            for (const ns of [-1, 1]) {
                const nx = PX - PR * 0.74, ny = py + ns * PR * 0.50;
                const cLen = PR * 5.0 * pulse, cW = PR * 0.14;
                // Afterburner cone: white-hot at nozzle -> orange -> blue-purple
                ctx.beginPath();
                ctx.moveTo(nx,        ny - cW);
                ctx.lineTo(nx - cLen, ny);
                ctx.lineTo(nx,        ny + cW);
                ctx.closePath();
                const lg = ctx.createLinearGradient(nx, ny, nx - cLen, ny);
                lg.addColorStop(0,    'rgba(255,255,210,1.0)');
                lg.addColorStop(0.12, 'rgba(255,175,30,0.90)');
                lg.addColorStop(0.42, 'rgba(255,50,0,0.55)');
                lg.addColorStop(0.74, 'rgba(80,30,220,0.22)');
                lg.addColorStop(1,    'rgba(40,10,180,0)');
                ctx.fillStyle = lg;
                ctx.fill();
                // Hot nozzle ring
                const hg = ctx.createRadialGradient(nx, ny, 0, nx, ny, PR * 0.55);
                hg.addColorStop(0, 'rgba(255,255,240,0.95)');
                hg.addColorStop(1, 'rgba(255,150,20,0)');
                ctx.beginPath();
                ctx.arc(nx, ny, PR * 0.55, 0, Math.PI * 2);
                ctx.fillStyle = hg;
                ctx.fill();
            }
        }

        // On-fire afterburner: bigger than the ordinary thrust cone above and, unlike
        // it, not gated on `holding` -- it has to read during BOTH hold and release
        // (releasing is half the control scheme), so it can't flicker on and off with
        // input the way the ordinary cone does. Same nozzle geometry and cone-gradient
        // technique (so it reads as "the ship's exhaust", not a floating shape), but
        // longer, wider, and pure hot orange-red rather than fading to blue-purple, so
        // the two stay visually distinct on the frames both are burning at once.
        if (onFire && phase === 'play') {
            const pulse = 0.85 + 0.15 * Math.sin(gtime * 9);
            for (const ns of [-1, 1]) {
                const nx = PX - PR * 0.74, ny = py + ns * PR * 0.50;
                const cLen = PR * 8.0 * pulse, cW = PR * 0.30;
                ctx.beginPath();
                ctx.moveTo(nx,        ny - cW);
                ctx.lineTo(nx - cLen, ny);
                ctx.lineTo(nx,        ny + cW);
                ctx.closePath();
                const lg = ctx.createLinearGradient(nx, ny, nx - cLen, ny);
                lg.addColorStop(0,    'rgba(255,255,220,0.95)');
                lg.addColorStop(0.15, 'rgba(255,150,30,0.85)');
                lg.addColorStop(0.5,  'rgba(255,60,10,0.45)');
                lg.addColorStop(1,    'rgba(255,20,0,0)');
                ctx.fillStyle   = lg;
                ctx.shadowColor = 'rgba(255,120,20,0.9)';
                ctx.shadowBlur  = 20;
                ctx.fill();
                ctx.shadowBlur  = 0;
            }
        }

        drawShip(PX, py, PR, phase === 'dead' ? '#ff4040' : sk.color, sr, sg, sb, 20);
        ctx.restore();
    }

    // Idle-hold hint: the player pressed nothing at all after launch (see
    // hasHeldThisRun/idleHoldTimer, state.js + update.js). Gravity is withheld until
    // their first press, so they aren't in danger yet, but they still don't know what
    // to do -- fades in above the parked ship after IDLE_HINT_DELAY and vanishes for
    // good the instant they press. Reuses T.tap (the title screen's "HOLD TO FLY")
    // rather than a new string -- same instruction, just relocated to where the ship
    // actually is instead of a fixed title-screen line (see Onboarding in CLAUDE.md
    // for why a *static* title-screen hint was tried and reverted; this one only ever
    // appears when it's actually needed, and is gone by the player's first touch).
    if (phase === 'play' && !hasHeldThisRun) {
        const IDLE_HINT_DELAY = 1.0, IDLE_HINT_FADE = 0.4;
        const ia = Math.max(0, Math.min(1, (idleHoldTimer - IDLE_HINT_DELAY) / IDLE_HINT_FADE));
        if (ia > 0) {
            const pulse = 0.80 + 0.20 * Math.sin(gtime * 6);
            ctx.save();
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.font         = `bold ${FS*0.026}px 'Courier New',monospace`;
            ctx.shadowColor  = `rgba(140,190,255,${ia * 0.85 * pulse})`;
            ctx.shadowBlur   = 16;
            ctx.fillStyle    = `rgba(220,235,255,${ia * pulse})`;
            ctx.fillText(T.tap, PX, py - PR * 3.4);
            ctx.shadowBlur   = 0;
            ctx.restore();
        }
    }

    // Per-skin effects (draw)
    if (phase === 'play') {
        // PEARL (0): tiny shimmer dots near nose while holding
        if (activeSkin === 0 && holding) {
            for (let i = 0; i < 2; i++) {
                const a = Math.max(0, Math.sin(gtime * 9.1 + i * 2.8)) * 0.5;
                if (a < 0.06) continue;
                const sx = PX + PR * (0.7 + Math.sin(gtime * 1.9 + i) * 0.4);
                const sy = py + (i === 0 ? -1 : 1) * PR * 0.5 * Math.sin(gtime * 2.5 + i);
                ctx.beginPath(); ctx.arc(sx, sy, 1.0, 0, Math.PI*2);
                ctx.fillStyle   = `rgba(220,235,255,${a})`;
                ctx.shadowColor = `rgba(200,220,255,${a})`;
                ctx.shadowBlur  = 4;
                ctx.fill();
                ctx.shadowBlur  = 0;
            }
        }
        for (const f of skinFx) {
            const a = Math.max(f.life, 0);
            if (f.t === 0) {
                // AMBER: small golden ember
                ctx.beginPath();
                ctx.arc(f.x, f.y, Math.max(f.r * f.life, 0.3), 0, Math.PI*2);
                ctx.fillStyle   = `rgba(255,${Math.floor(130 + 90*f.life)},15,${a * 0.8})`;
                ctx.shadowColor = `rgba(255,150,10,${a * 0.5})`;
                ctx.shadowBlur  = 4;
                ctx.fill();
                ctx.shadowBlur  = 0;
            } else if (f.t === 1) {
                // CRIMSON: small expanding ring
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.r, 0, Math.PI*2);
                ctx.strokeStyle = `rgba(255,25,55,${a * 0.75})`;
                ctx.lineWidth   = 1.8 * a;
                ctx.shadowColor = `rgba(255,0,40,${a * 0.5})`;
                ctx.shadowBlur  = 6;
                ctx.stroke();
                ctx.shadowBlur  = 0;
            } else if (f.t === 2) {
                // ELECTRIC: short crackle bolt near ship surface
                const bx0 = PX + PR * (f.s0 > 0.5 ? 1.0 : -0.3) + (f.s0 - 0.5) * PR * 0.6;
                const by0 = py  + (f.s1 - 0.5) * PR * 1.2;
                const ang  = f.s2 * Math.PI * 2;
                const len  = PR * (0.8 + f.s3 * 1.2);
                const bx1  = bx0 + Math.cos(ang) * len;
                const by1  = by0 + Math.sin(ang) * len;
                const mx   = (bx0+bx1)*0.5 + (f.s1-0.5)*PR*0.7;
                const my2  = (by0+by1)*0.5 + (f.s2-0.5)*PR*0.7;
                ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                ctx.beginPath(); ctx.moveTo(bx0,by0); ctx.lineTo(mx,my2); ctx.lineTo(bx1,by1);
                ctx.strokeStyle = `rgba(160,240,255,${a*0.35})`;
                ctx.lineWidth   = 2.5;
                ctx.shadowColor = `rgba(100,210,255,${a*0.6})`;
                ctx.shadowBlur  = 6;
                ctx.stroke();
                ctx.strokeStyle = `rgba(220,250,255,${a*0.85})`;
                ctx.lineWidth   = 1.0;
                ctx.shadowBlur  = 0;
                ctx.stroke();
                ctx.lineCap = 'butt';
            } else if (f.t === 3) {
                // TOXIC: small drip blob
                ctx.beginPath();
                ctx.arc(f.x, f.y, Math.max(f.r, 0.3), 0, Math.PI*2);
                ctx.fillStyle   = `rgba(100,255,30,${a * 0.75})`;
                ctx.shadowColor = `rgba(80,255,20,${a * 0.5})`;
                ctx.shadowBlur  = 6;
                ctx.fill();
                ctx.shadowBlur  = 0;
            } else if (f.t === 4) {
                // VOID: dark mote drawn inward toward the ship, fading as it arrives
                const mx = PX + Math.cos(f.ang) * f.dist;
                const my = py + Math.sin(f.ang) * f.dist;
                ctx.beginPath();
                ctx.arc(mx, my, 1.3, 0, Math.PI*2);
                ctx.fillStyle   = `rgba(180,90,255,${a * 0.8})`;
                ctx.shadowColor = `rgba(180,90,255,${a * 0.6})`;
                ctx.shadowBlur  = 5;
                ctx.fill();
                ctx.shadowBlur  = 0;
            } else if (f.t === 5) {
                // NOVA: brief radial starburst of short white rays
                const rays = 6;
                for (let i = 0; i < rays; i++) {
                    const ang = (i / rays) * Math.PI * 2 + f.seed * Math.PI * 2;
                    const r0  = PR * (1.1 + (1 - f.life) * 2.2);
                    const r1  = r0 + PR * 1.1 * f.life;
                    ctx.beginPath();
                    ctx.moveTo(PX + Math.cos(ang)*r0, py + Math.sin(ang)*r0);
                    ctx.lineTo(PX + Math.cos(ang)*r1, py + Math.sin(ang)*r1);
                    ctx.strokeStyle = `rgba(255,255,255,${a * 0.7})`;
                    ctx.lineWidth   = 1.4;
                    ctx.shadowColor = `rgba(255,255,255,${a * 0.5})`;
                    ctx.shadowBlur  = 5;
                    ctx.stroke();
                }
                ctx.shadowBlur  = 0;
            } else if (f.t === 6) {
                // SOLARIS: bright solar spark streaming from the nose
                ctx.beginPath();
                ctx.arc(f.x, f.y, Math.max(f.r * f.life, 0.3), 0, Math.PI*2);
                ctx.fillStyle   = `rgba(255,${Math.floor(170 + 85*f.life)},30,${a * 0.85})`;
                ctx.shadowColor = `rgba(255,140,0,${a * 0.75})`;
                ctx.shadowBlur  = 7;
                ctx.fill();
                ctx.shadowBlur  = 0;
            }
        }
    }

    // Particles
    for (const p of parts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(p.r*p.life,0.4), 0, Math.PI*2);
        ctx.fillStyle = `hsla(${p.h},90%,65%,${Math.max(p.life,0)})`;
        ctx.fill();
    }

    // Floating notifications
    ctx.textAlign = 'center';
    for (const n of notifs) {
        const [nr, ng, nb] = n.color || [255,220,55];
        const a = Math.max(n.life, 0);
        ctx.font        = `bold ${FS*0.038}px 'Courier New',monospace`;
        ctx.fillStyle   = `rgba(${nr},${ng},${nb},${a})`;
        ctx.shadowColor = `rgba(${nr},${ng},${nb},${a*0.8})`;
        ctx.shadowBlur  = 8;
        ctx.fillText(n.text, n.x, n.y);
        ctx.shadowBlur  = 0;
    }

    // Shield break flash (white)
    if (shieldFlash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${shieldFlash * 0.50})`;
        ctx.fillRect(-20,-20,W+40,H+40);
    }

    // Death flash
    if (flashA > 0) {
        ctx.fillStyle = `rgba(255,20,20,${flashA*0.45})`;
        ctx.fillRect(-20,-20,W+40,H+40);
    }

    ctx.restore();
}

function drawHUD() {
    const theme = getTheme();

    // ── HUD ───────────────────────────────────────────────────────────
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';

    // Score / BEST / next-skin-nudge cascade top to bottom off `hudY`, each line's Y
    // derived from the actual rendered size of the one above it, not independent fixed
    // H-fractions. Those used to be tuned by eye against one reference device (956x440pt)
    // -- fine for that exact aspect ratio, but UI_H only floors font *size* at a 600px
    // reference, not vertical *position*, so a shorter-but-similarly-wide screen (e.g.
    // iPhone 12 mini, 812x375pt) got the same big score digits with proportionally less
    // real H to fit the fixed-fraction gaps in, and the lines nearly touched again. A
    // cascade clears the line above it by construction on any aspect ratio, and also
    // means adding a new line here later can't silently collide with one that already
    // seemed to have a safe fixed offset.
    const scoreFsz = FS * 0.085;
    let hudY = H * 0.03;

    if (phase === 'play') {
        const nearPB = best > 0 && score >= best - 5;
        ctx.font        = `bold ${scoreFsz}px 'Courier New',monospace`;
        ctx.fillStyle   = nearPB ? 'rgba(255,230,80,0.96)' : 'rgba(215,235,255,0.96)';
        ctx.shadowColor = nearPB ? 'rgba(255,200,40,0.80)' : 'rgba(0,0,0,0.85)';
        ctx.shadowBlur  = nearPB ? 18 : 5;
        ctx.fillText(score, W/2, hudY);
        ctx.shadowBlur  = 0;
    }
    hudY += scoreFsz * 0.80 + H * 0.02;

    if (best > 0 && phase === 'play') {
        const bestFsz = FS * 0.025;
        ctx.font        = `${bestFsz}px 'Courier New',monospace`;
        ctx.fillStyle   = 'rgba(170,195,255,0.90)';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur  = 4;
        ctx.fillText(`${T.best}  ${best}`, W/2, hudY);
        ctx.shadowBlur  = 0;
        hudY += bestFsz * 0.85 + H * 0.01;
    }

    // Next skin nudge - faint pulsing hint when this run's banked-so-far shards would
    // cross the next unlock (shards + runCoins, since the actual bank happens at death).
    // Only for a tier whose stardustGate (constants.js) is already met -- otherwise
    // "3 TO VOID" would read as imminent when the calendar, not shards, is still the
    // actual blocker.
    if (phase === 'play') {
        const nextSkin = SKINS.find((sk, i) => sk.cost && !(unlockedSkins & (1 << i))
            && (!sk.stardustGate || stardust >= sk.stardustGate));
        if (nextSkin) {
            const projected = shards + runCoins;
            const remaining = nextSkin.cost - projected;
            if (remaining > 0 && remaining <= 15) {
                const [sr, sg, sb] = nextSkin.shadow;
                const pulse = 0.28 + 0.18 * Math.sin(gtime * 2.8);
                ctx.font      = `${FS*0.020}px 'Courier New',monospace`;
                ctx.fillStyle = `rgba(${sr},${sg},${sb},${pulse})`;
                ctx.fillText(`${remaining} ${T.toSkin} ${nextSkin.name}`, W/2, hudY);
            }
        }
    }

    // Gap bonus bar (bottom, gold)
    if (phase === 'play' && gapBonus > 0) {
        const ratio = gapBonus / GAP_BONUS_MAX;
        const barW  = W * 0.55 * ratio;
        const barY  = H * 0.955;
        const barH  = 4;
        ctx.fillStyle = 'rgba(255,200,40,0.15)';
        ctx.fillRect(W*0.225, barY, W*0.55, barH);
        ctx.fillStyle = `rgba(255,210,50,${0.55 + ratio*0.35})`;
        ctx.fillRect(W*0.225, barY, barW, barH);
    }

    // Slow-time bar (bottom, cyan, just above gap bar)
    if (phase === 'play' && slowTime > 0) {
        const ratio = slowTimeMax > 0 ? Math.min(slowTime / slowTimeMax, 1.0) : Math.min(slowTime / 4.0, 1.0);
        const barW  = W * 0.55 * ratio;
        const barY  = H * 0.940;
        const barH  = 4;
        ctx.fillStyle = 'rgba(60,200,255,0.15)';
        ctx.fillRect(W*0.225, barY, W*0.55, barH);
        ctx.fillStyle = `rgba(60,200,255,${0.55 + ratio*0.35})`;
        ctx.fillRect(W*0.225, barY, barW, barH);
    }

    // Magnet bar (bottom, green, just above slow bar)
    if (phase === 'play' && magnetTime > 0) {
        const ratio = Math.min(magnetTime / 3.0, 1.0);
        const barW  = W * 0.55 * ratio;
        const barY  = H * 0.925;
        const barH  = 4;
        ctx.fillStyle = 'rgba(60,255,120,0.15)';
        ctx.fillRect(W*0.225, barY, W*0.55, barH);
        ctx.fillStyle = `rgba(80,255,130,${0.55 + ratio*0.35})`;
        ctx.fillRect(W*0.225, barY, barW, barH);
    }

    // Bullet ammo dots (bottom, orange, above magnet bar)
    if (phase === 'play' && bulletAmmo > 0) {
        const dotR   = 4;
        const dotY   = H * 0.910;
        const startX = W * 0.225;
        ctx.shadowColor = 'rgba(255,130,0,0.80)';
        ctx.shadowBlur  = 6;
        for (let i = 0; i < bulletAmmo; i++) {
            ctx.beginPath();
            ctx.arc(startX + i * (dotR * 2.8), dotY, dotR, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,150,0,0.85)';
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.save();
        ctx.font         = `bold ${FS*0.016}px 'Courier New',monospace`;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle    = 'rgba(255,175,60,0.85)';
        ctx.fillText(T.ammo, startX + bulletAmmo * dotR * 2.8 + W * 0.010, dotY);
        ctx.restore();
    }

    // Level intro banner -- "LEVEL n: Name", shown briefly at the start of each run
    if (levelIntroT > 0 && phase === 'play') {
        const lia = Math.min(1, levelIntroT / LEVEL_INTRO_FADE);
        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = `bold ${FS*0.045}px 'Courier New',monospace`;
        ctx.shadowColor  = `rgba(90,140,255,${lia * 0.85})`;
        ctx.shadowBlur   = 20;
        ctx.fillStyle    = `rgba(200,222,255,${lia})`;
        ctx.fillText(`${T.level} ${LEVEL_NUM}: ${WORLD_NAME.toUpperCase()}`, W/2, H * 0.30);
        // Planet line -- today's WEEKDAY_PALETTES entry (constants.js) named after a
        // real (mostly) celestial body matching that day's rock color, so the banner
        // reads as "which world is this, and what's it made of" rather than just a
        // difficulty-ramp label. Colored with that same day's wallBase (the bright
        // accent already used for the wall glow elsewhere in this file) so the name
        // itself visually IS the day's rock, not just a caption next to it. Smaller
        // than the level line above and fades on the same `lia` clock, so it still
        // reads as a subtitle, not a second headline.
        ctx.font        = `${FS*0.024}px 'Courier New',monospace`;
        ctx.shadowColor = rgb(theme.wallBase, lia * 0.85);
        ctx.shadowBlur  = 12;
        ctx.fillStyle   = rgb(theme.wallBase, lia);
        ctx.fillText(`${T.planet} ${WEEKDAY_PALETTES[weekdayIndex(new Date())].planet.toUpperCase()}`, W/2, H * 0.30 + FS * 0.05);
        ctx.shadowBlur   = 0;
        ctx.restore();
    }

    // Milestone flash
    if (milestoneFlash > 0 && phase === 'play') {
        const mfa = milestoneFlash;
        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = `bold ${FS*0.11}px 'Courier New',monospace`;
        ctx.fillStyle    = `rgba(255,225,65,${mfa})`;
        ctx.shadowColor  = `rgba(255,180,0,${mfa * 0.9})`;
        ctx.shadowBlur   = 28;
        ctx.fillText(milestoneText, W/2, H * 0.28);
        ctx.shadowBlur   = 0;
        ctx.restore();
    }
}

function drawTitleScreen() {
    // In landscape (W > H*1.15) use a two-column layout to avoid vertical crowding.
    // In portrait keep a centered stack but anchor the skin picker to the bottom.
    const LAND   = W > H * 1.15;
    // Was 0.28 -- direct feedback that there's still a lot of unused space toward the
    // top-left of the title screen. Shifted left by the same amount (0.05W) the death
    // screen's left column moved for the same reason. 0.23 -> 0.25: nudged back
    // toward centre a little, symmetrically with infoX below -- 0.23 left the empty
    // centre gap between the two columns reading as slightly too wide/dead relative
    // to the panels themselves.
    const titleX = LAND ? W * 0.25 : W / 2;
    // Mirrors titleX around the screen's own centre (1 - titleX's fraction) rather
    // than a separately-picked fraction -- was 0.71, pulling the right column 6% of
    // W toward centre with nothing to its own edge pulling back, so the two columns
    // read as one composition shifted left, not a centred pair (more empty margin on
    // the right than the left). Safe against the ship-grid clamp (cx1 in the LAND
    // block below) down to W ~ 690px, well under LAND mode's own H*1.15 floor.
    const infoX  = LAND ? W * 0.75 : W / 2;
    const a      = Math.min(1, titleT * 4);
    const sh     = (blur, col = 'rgba(0,0,0,0.90)') => { ctx.shadowColor = col; ctx.shadowBlur = blur; };

    ctx.textBaseline = 'middle';

    // Darken the scene so the card pops
    ctx.fillStyle = `rgba(4,4,14,${a * 0.55})`;
    ctx.fillRect(0, 0, W, H);

    // Was 0.33 -- shifted up with titleX above, same reasoning. Every other left-
    // column Y anchor below (subtitle/tap-text/settings-button/missions) keeps its
    // old gap from this one, so the whole block moves up together rather than only
    // the logo, which would otherwise crowd into the subtitle beneath it.
    const logoY = LAND ? H * 0.24 - 11 : H/2 - H*0.12;

    // Ship-picker layout is computed here (hoisted above its actual drawing further
    // below) purely so the divider immediately after can be positioned against
    // PEARL's real on-screen left edge instead of a fixed W-fraction. A fixed
    // fraction (tried W*0.49, then W*0.44) looked fine on one device/aspect-ratio
    // and put the divider ON TOP of the ship icon on another -- same root cause as
    // the skinCX overflow bug: fixed fractions don't track how the dynamically-
    // clamped ship row actually shifts across device widths. See measureShipLabelHalfW.
    const showShipPanel = best > 0 || unlockedSkins > 1;
    // Fixed 4-per-row grid, independent of unlock status (was two variable-length
    // rows split by ownership -- unlocked ships alone stretched into one increasingly
    // cramped/overflowing row as more got bought, worst case all 7-8 squeezed into a
    // single line while the locked row shrank to almost nothing). Every ship still
    // renders according to its OWN lock state (see the render loop below), just at a
    // grid position fixed by its index rather than a row determined by ownership.
    const GRID_COLS = 4;
    const nGridRows = Math.ceil(SKINS.length / GRID_COLS);
    // dotR1/dotGap1 size the grid itself (both rows share one spacing so columns
    // line up); dotR2/dotGap2 are kept as the smaller size locked ships still render
    // at within their grid cell. App is landscape-only, but portrait aliases are kept
    // so code paths stay intact.
    const dotR1   = LAND ? UI_H * 0.044 : H * 0.035;
    const dotGap1 = Math.max(dotR1 * 2.8, LAND ? UI_H * 0.130 : W * 0.180);
    const dotR2   = UI_H * 0.035;   // locked-ship render size within its cell
    const dotGap2 = dotGap1;
    // Portrait single-row aliases
    const dotR    = LAND ? dotR1 : H * 0.035;
    const dotGap  = LAND ? dotGap1 : Math.max(dotR * 2.8, W * 0.180);
    const rowHalfW1  = (GRID_COLS - 1) * dotGap1 / 2;
    const rowHalfW2  = rowHalfW1;
    const edgeMargin = 8;
    let cx1 = infoX, cx2 = infoX;
    if (LAND) {
        cx1 = Math.min(Math.max(cx1, edgeMargin + rowHalfW1), W - edgeMargin - rowHalfW1);
        cx2 = cx1;
    }
    // Both rows nudged up from 0.600/0.825 to free room at the bottom of the panel --
    // needed so the perk description has somewhere to go when it has to sit below
    // the 2nd row instead of in the gap between rows (see the perk-position logic
    // near the ship grid render loop).
    // 0.560 -> 0.540 and 0.830 -> 0.810 below: shifted up together with rightColY
    // (all three by 0.02H) so the whole right column -- REKORD/SHIP down through
    // both ship rows -- moves as one block and stays vertically aligned with the
    // left column instead of hanging lower than it. First pass moved this by
    // 0.05H based on a desktop Chrome test, which over-corrected -- letterboxing
    // in that test window (H capped at 600 inside a taller browser viewport, vs
    // the real device's full-bleed canvas since its H never hits the 600 cap)
    // exaggerated the apparent gap. Re-measured against real iPhone 17 Pro Max
    // simulator screenshots (both the original unpatched title screen and this
    // patch applied) instead of the desktop test -- 0.02H matches what the
    // original screenshot actually needed.
    const dotY1  = LAND ? H * 0.540 - 11 : H - dotR * 2.4;
    // 0.780 -> 0.830: widens the gap to row 1, which is what the perk description's
    // available "band" (see the perk-position logic near the ship grid render loop)
    // is measured against -- too narrow a gap meant row 1's description shrank well
    // below row 2's (row 2's own description sits below the whole grid, unclamped by
    // this band, so the two could end up visibly different sizes for the same string
    // length depending only on which row was selected).
    const dotY2  = H * 0.810 - 11;   // 2nd grid row, landscape only
    const startX1 = cx1 - rowHalfW1;
    const startX2 = cx2 - rowHalfW2;
    // Aliases used by the divider calculation and portrait path
    const skinCX = cx1;
    const dotY   = dotY1;
    // Divider is pegged to the grid's fixed 4-column span, which no longer changes
    // as ships get unlocked (the old span tracked the unlocked-row's length, which
    // grew over time and could shift the divider).
    const fullRowHalfW = rowHalfW1;
    const startX       = Math.max(infoX - fullRowHalfW, edgeMargin);

    // Gradient separator between columns (landscape only). When the ship panel is
    // showing, sit just left of PEARL's actual icon (not its text label -- the
    // triangle graphic itself extends further left, see dotR*1.6 below); before any
    // ship is unlocked/played there's nothing to clear yet, so fall back to a fixed
    // fraction close to the old constant.
    // Hoisted out of the `if (LAND)` block below so the level/world-name subtitle
    // further down can also fit itself against the divider's real position, not
    // just the gradient line drawn here.
    // dividerX itself is kept (used below as a layout bound for the button row and
    // missions block widths) even though the gradient line that used to visualize it
    // is gone -- removed per feedback that it wasn't doing anything visually.
    let dividerX = W * 0.44;
    if (LAND) {
        const dividerMargin = 12;
        dividerX = showShipPanel ? (startX - dotR1 * 1.6 - dividerMargin) : W * 0.44;
        // Don't let the divider crash into the left column's own content either.
        dividerX = Math.max(dividerX, W * 0.34);
    }

    // Radial halo behind TUNL logo
    const haloR  = FS * 0.14;
    const haloPulse = 0.65 + 0.35 * Math.sin(gtime * 1.4);
    const halo = ctx.createRadialGradient(titleX, logoY, 0, titleX, logoY, haloR);
    halo.addColorStop(0,   `rgba(80,120,255,${a * haloPulse * 0.22})`);
    halo.addColorStop(0.5, `rgba(60, 90,220,${a * haloPulse * 0.10})`);
    halo.addColorStop(1,   `rgba(40, 60,180,0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(titleX - haloR, logoY - haloR, haloR * 2, haloR * 2);

    // TUNL logo -- the "U" is drawn as a receding tunnel-ring hole instead of
    // a glyph, so the wordmark itself depicts the thing you're flying through.
    // Courier New is monospace, so every char shares one advance width -- that
    // lets us lay glyphs out by hand and drop the hole into the "U" slot without
    // breaking alignment with T/N/L.
    ctx.font = `bold ${FS*0.090}px 'Courier New',monospace`;
    const fontPx    = FS * 0.090;
    const charW     = ctx.measureText('T').width;
    const logoW     = charW * 4;
    const logoPulse = 24 + 14 * Math.sin(gtime * 1.4);

    ctx.textAlign = 'left';
    let lx = titleX - logoW / 2;
    const drawGlyph = (ch) => {
        ctx.shadowColor = `rgba(100,150,255,${a * 0.70})`; ctx.shadowBlur = logoPulse * 1.6;
        ctx.fillStyle   = `rgba(195,220,255,${a * 0.30})`;
        ctx.fillText(ch, lx, logoY);
        ctx.shadowBlur  = logoPulse;
        ctx.fillStyle   = `rgba(215,232,255,${a * 0.97})`;
        ctx.fillText(ch, lx, logoY);
        ctx.shadowBlur  = 0;
    };

    drawGlyph('T');
    lx += charW;

    // Tunnel hole where the "U" sits: the hole is shaped like an actual "U"
    // (open top, rounded bottom) so the wordmark still reads as TUNL, not
    // TONL -- nested rim->core gradients are clipped inside it, painted
    // largest-first so each smaller disc leaves the previous one's bright
    // rim showing as a ring, reading as a corridor receding into the U.
    // Proportions below are measured off the real "U" glyph in this exact
    // font/weight (canvas pixel-scan: stroke edges at cap mid-height, the
    // counter's deepest point via a center-column scan) rather than
    // guessed. The previous hand-tuned path sat ~15% short of T/N/L's
    // actual cap height and was nearly 2x the glyph's true counter width --
    // round and low instead of tall and narrow -- which is why it read as
    // a floating blob rather than a U's counter. uHalfW is kept a bit
    // wider than the raw measurement (0.216*charW) so the rings inside
    // stay legible at in-game sizes.
    // uDipY targets the glyph's true OUTER bottom edge (its descent,
    // ~0.44*charW), not the counter's inner depth (~0.26*charW) that an
    // earlier pass used -- a real U has solid material between where the
    // hole ends and where the letter actually sits, so matching the
    // counter alone left the rim floating ~3px above T/N/L's shared
    // baseline (confirmed by a pixel-scan of the rendered canvas: T and U
    // top rows matched exactly, but U's bottom row came up short).
    // Both ends trimmed back in by ~2px-at-test-scale (holeR*0.15) from
    // that measurement -- the crisp rim stroke's own small shadowBlur
    // softens its edge just enough that the visible ink pokes past T/N/L's
    // hard-edged cap/baseline by a couple px on each side even though the
    // path coordinates land exactly on them.
    const holeCX = lx + charW / 2;
    const holeR  = charW * 0.316;
    const uHalfW = holeR * 0.95;
    const uTopY  = logoY - holeR * 1.65;
    const uSideY = logoY + holeR * 0.54;
    const uDipY  = logoY + holeR * 1.25;
    const buildUPath = () => {
        ctx.beginPath();
        ctx.moveTo(holeCX - uHalfW, uTopY);
        ctx.lineTo(holeCX - uHalfW, uSideY);
        ctx.quadraticCurveTo(holeCX - uHalfW, uDipY, holeCX, uDipY);
        ctx.quadraticCurveTo(holeCX + uHalfW, uDipY, holeCX + uHalfW, uSideY);
        ctx.lineTo(holeCX + uHalfW, uTopY);
    };

    // What glows inside the U: a small pulsing gem instead of the old
    // tunnel-ring portal. Same faceted-diamond + 8-ray sparkle-burst
    // language the real coin pickups use (see the coin-render loop
    // above) so the logo's glow reads as the same light the game already
    // trains the player to want, just recolored out of coin-gold into
    // the wordmark's own purple/cyan family (the old rings' colors) so
    // it still reads as part of the mark rather than a pickup icon
    // pasted on top of it. Drawn unclipped, on purpose: the rays and
    // aura are sized to sit inside the counter but their soft edges are
    // free to bleed slightly past it, the same way T/N/L's own glow
    // bleeds past their ink -- a hard clip here would look like a window
    // instead of a light.
    const gemCX    = holeCX;
    const gemCY    = logoY - charW * 0.07;
    const gemPulse = 0.75 + 0.25 * Math.sin(gtime * 1.6);
    const gemR     = charW * 0.10;
    const gemDH    = gemR * 1.35, gemDW = gemR * 0.90;

    const aura = ctx.createRadialGradient(gemCX, gemCY, 0, gemCX, gemCY, gemR * 3.6);
    aura.addColorStop(0,   `rgba(170,190,255,${a * gemPulse * 0.40})`);
    aura.addColorStop(0.4, `rgba(120,110,255,${a * gemPulse * 0.16})`);
    aura.addColorStop(1,   'rgba(80,60,220,0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(gemCX, gemCY, gemR * 3.6, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(gemCX, gemCY);

    // 8 sparkle rays (4 long + 4 short) -- same construction as the coin's
    // ray-burst, just static (no spin: this is a fixed logo mark, not a
    // falling pickup) and sized off gemR instead of the coin's own radius.
    ctx.shadowColor = `rgba(170,190,255,0.7)`;
    for (const long of [true, false]) {
        ctx.beginPath();
        for (let i = long ? 0 : 1; i < 8; i += 2) {
            const rp = 0.75 + 0.25 * Math.sin(gtime * 3.0 + i * 1.1);
            const th = i * Math.PI * 0.25, s = Math.sin(th), c = Math.cos(th);
            const d1 = gemR * 1.35, d2 = gemR * (long ? 2.5 : 1.7) * rp;
            ctx.moveTo(d1 * s, -d1 * c);
            ctx.lineTo(d2 * s, -d2 * c);
        }
        ctx.strokeStyle = `rgba(190,205,255,${a * (long ? 0.85 : 0.40)})`;
        ctx.lineWidth   = Math.max(0.8, gemR * (long ? 0.18 : 0.10));
        ctx.shadowBlur  = long ? 3 : 1.5;
        ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Faceted diamond body, purple top-half fading to cyan bottom-half --
    // the same split the old rings used, so the recolor still reads as
    // the same mark rather than a new one.
    ctx.beginPath();
    ctx.moveTo(0, -gemDH); ctx.lineTo(gemDW, 0); ctx.lineTo(0, gemDH); ctx.lineTo(-gemDW, 0);
    ctx.closePath();
    const gemGrd = ctx.createLinearGradient(0, -gemDH, 0, gemDH);
    gemGrd.addColorStop(0,    '#e5d4ff');
    gemGrd.addColorStop(0.45, '#a75bff');
    gemGrd.addColorStop(0.55, '#3fe0ff');
    gemGrd.addColorStop(1,    '#0d6a86');
    ctx.globalAlpha = a;
    ctx.fillStyle   = gemGrd;
    ctx.shadowColor = `rgba(170,190,255,0.9)`;
    ctx.shadowBlur  = 6;
    ctx.fill();
    ctx.shadowBlur  = 0;

    // Top-right facet highlight + bright core spark
    ctx.beginPath(); ctx.moveTo(0, -gemDH); ctx.lineTo(gemDW, 0); ctx.lineTo(0, 0); ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, gemR * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.restore();

    // Rim outline, drawn as a glow-then-crisp pair -- the same technique
    // drawGlyph() uses for T/N/L, just applied to a stroke instead of a
    // filled glyph. A single stroke pass at drawGlyph's glow-pass blur
    // (logoPulse*1.6, up to ~60px at this scale) is what made the old rim
    // unreadable: a filled letter has interior mass a big blur can't
    // touch, but a ~7px-wide stroke has none, so that blur smeared the
    // whole outline into a haze instead of leaving a legible U silhouette.
    // The crisp pass here (near-zero blur, full opacity, drawn last) is
    // what actually reads as the letter's edge.
    // lineCap is 'butt', not 'round': buildUPath's two top ends are open
    // path endpoints sitting exactly at T/N/L's cap height, and a round
    // cap adds a lineWidth/2 bump beyond them -- enough to visibly poke
    // the U above the other three letters' baseline.
    ctx.save();
    ctx.lineCap  = 'butt';
    ctx.lineJoin = 'round';
    buildUPath();
    ctx.shadowColor = `rgba(100,150,255,${a * 0.70})`;
    ctx.shadowBlur   = logoPulse * 1.6;
    ctx.strokeStyle  = `rgba(215,232,255,${a * 0.45})`;
    ctx.lineWidth    = Math.max(1, fontPx * 0.14);
    ctx.stroke();
    ctx.shadowBlur   = logoPulse * 0.12;
    ctx.strokeStyle  = `rgba(225,238,255,${a * 0.97})`;
    ctx.lineWidth    = Math.max(1, fontPx * 0.10);
    ctx.stroke();
    ctx.restore();
    lx += charW;

    drawGlyph('N');
    lx += charW;
    drawGlyph('L');
    lx += charW;

    ctx.textAlign = 'center';

    // Accent underline
    const ulY   = logoY + FS * 0.055;
    const ulGrd = ctx.createLinearGradient(titleX - logoW*0.5, ulY, titleX + logoW*0.5, ulY);
    ulGrd.addColorStop(0,   `rgba(80,120,255,0)`);
    ulGrd.addColorStop(0.3, `rgba(120,165,255,${a * 0.80})`);
    ulGrd.addColorStop(0.7, `rgba(120,165,255,${a * 0.80})`);
    ulGrd.addColorStop(1,   `rgba(80,120,255,0)`);
    ctx.fillStyle = ulGrd;
    ctx.fillRect(titleX - logoW*0.5, ulY, logoW, 1.5);

    // Slow hue-cycling glow instead of a flat colour -- this line changes every
    // day anyway (LEVEL_NUM/WORLD_NAME), so a shifting glow reads as "today's level
    // is its own little event" rather than static label text. gtime is the same
    // free-running animation clock every other ambient pulse in this file already
    // keys off (coin flicker, mine bob, etc.), so it needs no state of its own.
    // Slow enough (full hue cycle every 15s) to read as ambient, not distracting.
    const levelHue = (gtime * 24) % 360;
    ctx.shadowColor = `hsla(${levelHue}, 90%, 60%, ${a * 0.6})`;
    ctx.shadowBlur  = 8 + 4 * Math.sin(gtime * 2.2);
    ctx.fillStyle   = `hsla(${levelHue}, 85%, 72%, ${a * 0.95})`;
    // Prefixed with "LEVEL <day-of-year>:" so the world name reads like a level
    // index -- same LEVEL_NUM/T.level pair already used in the run-start banner
    // (see above), just surfaced here too per user request. This line is centered
    // on titleX, but titleX sits much closer to the divider than to the left screen
    // edge on narrow devices, so the divider side is the binding constraint -- shrink
    // the font to fit rather than let long language/level combos cross the divider.
    const levelLine = `${T.level} ${LEVEL_NUM}: ${WORLD_NAME.toUpperCase()}`;
    // Bumped two points above TAGESMISSIONEN's header size (FS*0.023) per explicit
    // request -- the two used to match exactly (see git history), but this line
    // now deliberately reads larger than that one, not as an inconsistency.
    let levelFsz = FS * 0.025;
    ctx.font = `bold ${levelFsz}px 'Courier New',monospace`;
    if (LAND) {
        // Clamped against the screen edges, not the divider: the divider is a
        // hairline gradient with nothing solid drawn near it at this line's height
        // (the REKORD/HEUTE stats sit higher up, the SHIP row sits lower), so it was
        // an overly tight bound that made this line converge to the same ~22px
        // render no matter how much higher levelFsz above was pushed -- clamping
        // against the divider instead of the actual screen edge silently capped it
        // at a size far below what was requested.
        const levelAvailHalfW = Math.min(titleX - 24, W - titleX - 24);
        const levelW = ctx.measureText(levelLine).width;
        if (levelW / 2 > levelAvailHalfW) {
            levelFsz *= (levelAvailHalfW * 2) / levelW;
            levelFsz = Math.max(levelFsz, FS * 0.015); // legibility floor
            ctx.font = `bold ${levelFsz}px 'Courier New',monospace`;
        }
    }
    // Nudged down from 0.365 -- on a short device (UI_H's 600px floor keeps FS/the
    // logo underline's offset from shrinking with H, iPhone 12 mini landscape being
    // the extreme case) the old position sat only a few px under the logo's
    // underline bar, close enough to visually collide with it.
    ctx.fillText(levelLine, titleX, LAND ? H * 0.395 - 11 : H/2 - H*0.038);
    ctx.shadowBlur = 0;

    // Tapping the title screen still starts a run (input.js) even with no visible
    // "HOLD TO FLY" CTA here anymore -- that instruction used to live only on this
    // screen, but now plays out live on the first run's runway (see lifecycle.js's
    // FIRST_RUN_RUNWAY_WX and update.js's onboarding hint), which teaches the actual
    // feel of thrust-vs-gravity instead of just naming it. Keeping both was pure
    // repetition, so this screen dropped its copy of the line, and the button
    // cluster below moved up to take the freed vertical space.
    //
    // Daily missions -- left column, in the middle of the screen (above the
    // settings/leaderboard row, which now anchors to the bottom -- swapped per
    // feedback that a block the player checks once per day shouldn't sit below a
    // button row they use every session). Landscape only: this column is centered
    // and already tight in portrait (same call the pre-unlock TOP 5 block below
    // makes for the right column). Progress is cumulative across today's runs
    // (state.js dailyMissionStats, folded in by update.js die()), and the 3 active
    // missions are the same for every player on a given day (constants.js
    // pickDailyMissionIndices), not per-player randomized.
    if (LAND) {
        // Fixed just under the level line above (which itself sits just under the
        // logo's underline bar) rather than cascading off anything, since this block
        // is now the first thing below the logo/level header. 0.49 -> 0.51: nudged
        // down a touch per feedback, taking the button row(s) below it down by the
        // same amount (see tBtnY's own floor, moved in step).
        let missionY = H * 0.51 - 6;

        // Laid out as a real three-column table (progress right-aligned, label
        // left-aligned, reward right-aligned) rather than centring each row's whole
        // string on titleX. Centring meant every row started at a different x --
        // "9/150" is far wider than "0/6" -- so the labels never lined up and the
        // block had a ragged left edge. The header shares the block's left edge too,
        // so the whole thing reads as one column.
        const rewStr = `+${MISSION_REWARD} \u29eb`;
        let mFsz = FS * 0.021;
        // The reward is drawn bold and a touch larger than the row text, so it has to
        // be measured in its own font or the column lands short of where it renders.
        const rewFont = () => `bold ${mFsz * 1.12}px 'Courier New',monospace`;
        const measureCols = () => {
            ctx.font = `${mFsz}px 'Courier New',monospace`;
            let pw = 0, lw = 0;
            for (let m = 0; m < dailyMissionIdx.length; m++) {
                const d = MISSION_DEFS[dailyMissionIdx[m]];
                const lb = (T.missionDesc && T.missionDesc[d.id]) || d.id;
                const v  = Math.min(dailyMissionStats[d.stat] || 0, d.target);
                // Measure what each row actually renders, not what it could render.
                // A claimed row draws a tick but was being measured as "150/150", so
                // once the day's missions were all done the progress column reserved
                // the width of a number nothing was drawing and shoved every label
                // right by a phantom column.
                const shown = dailyMissionsClaimed[m] ? '✓' : `${v}/${d.target}`;
                pw = Math.max(pw, ctx.measureText(shown).width);
                lw = Math.max(lw, ctx.measureText(lb).width);
            }
            ctx.font = rewFont();
            const rw = ctx.measureText(rewStr).width;
            // Two different gaps, not one: the progress figure and its label are the
            // same thought ("2 of 6 orange coins") and want to sit close, while the
            // reward is a separate column and wants real separation. A single shared
            // gap pushed the labels needlessly far right, which is the dominant text
            // in the block and reads best hard against the left edge.
            const gapPL = mFsz * 0.55;
            const gapLR = mFsz * 2.0;
            return { pw, lw, rw, gapPL, gapLR, total: pw + gapPL + lw + gapLR + rw };
        };
        let mc = measureCols();
        // Shrink to fit rather than cross the divider. The reward column makes this
        // block meaningfully wider than it was, and titleX sits much closer to the
        // divider than to the left screen edge -- same constraint the level line
        // above already deals with.
        const mAvailHalf = Math.min(titleX - 8, dividerX - titleX - 8);
        if (mc.total / 2 > mAvailHalf) {
            mFsz = Math.max(mFsz * (mAvailHalf * 2) / mc.total, FS * 0.010);
            mc = measureCols();
        }
        const blockX  = titleX - mc.total / 2;
        const progRX  = blockX + mc.pw;              // right edge of progress column
        const labelLX = progRX + mc.gapPL;           // left edge of label column
        const rewRX   = blockX + mc.total;           // right edge of reward column

        ctx.textAlign   = 'left';
        ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 3;
        ctx.font        = `bold ${FS*0.023}px 'Courier New',monospace`;
        ctx.fillStyle   = `rgba(180,198,235,${a * 0.80})`;
        ctx.fillText(T.missions, blockX, missionY);
        ctx.shadowBlur  = 0;
        missionY += H * 0.050;

        for (let m = 0; m < dailyMissionIdx.length; m++) {
            const def   = MISSION_DEFS[dailyMissionIdx[m]];
            const label = (T.missionDesc && T.missionDesc[def.id]) || def.id;
            const done  = dailyMissionsClaimed[m];
            const val   = Math.min(dailyMissionStats[def.stat] || 0, def.target);
            ctx.font        = `${mFsz}px 'Courier New',monospace`;
            ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 2;
            ctx.fillStyle   = done ? `rgba(120,255,150,${a * 0.90})` : `rgba(175,190,225,${a * 0.80})`;
            ctx.textAlign   = 'right';
            ctx.fillText(done ? '✓' : `${val}/${def.target}`, progRX, missionY);
            ctx.textAlign   = 'left';
            ctx.fillText(label, labelLX, missionY);
            // What the mission is actually worth. MISSION_REWARD shards, granted the
            // moment the target is met and exempt from DAILY_SHARD_CAP (constants.js).
            // Bold, slightly larger and glowing rather than plain small text: at row
            // weight and 78% alpha this read as near-invisible, exactly the way the
            // death screen's shard line did before it got the same treatment. It is
            // the reason to care about the mission, so it should carry the weight of
            // one. Dimmed once claimed -- already banked, so it stops being an offer.
            ctx.textAlign   = 'right';
            ctx.font        = rewFont();
            ctx.fillStyle   = `rgba(255,228,125,${a * (done ? 0.62 : 1.0)})`;
            ctx.shadowColor = `rgba(255,205,60,${a * (done ? 0.35 : 0.60)})`;
            ctx.shadowBlur  = 7;
            ctx.fillText(rewStr, rewRX, missionY);
            ctx.shadowBlur  = 0;
            missionY += H * 0.046;
        }
        ctx.textAlign = 'center';   // restore -- everything below expects centred text
        _missionsBottom = missionY;
    }

    // Settings/leaderboard row + shared button-drawing helper
    // (also reused inside the settings panel for the audio toggles). Anchored off
    // the daily-missions block's actual bottom edge (_missionsBottom, set above) with
    // a floor near the bottom of the screen, rather than a fixed H fraction on its
    // own -- mirrors how missions used to cascade off the button cluster before the
    // two were swapped, just in the other direction now that buttons render last.
    // Floor moved 0.80 -> 0.82 in step with missionY's own nudge above, so both
    // button rows follow the missions block down by the same amount instead of
    // the Math.max floor swallowing the change.
    const tBtnY = (LAND ? Math.max(H * 0.82 - 11, _missionsBottom + H * 0.09) : H/2 + H*0.140) - (LAND ? 2 : 0);
    const btnFontSz = FS * 0.024 - 1;
    ctx.font = `${btnFontSz}px 'Courier New',monospace`;
    // Hoisted above drawBtn (rather than declared alongside rowGap below) so
    // drawBtn's own auto-width fallback can use the same value the row-centering
    // math assumes -- they used to be two separate constants that happened to
    // match by coincidence, and drifted apart (silently widening the *gap*
    // instead of the buttons) the moment one of them was tuned without the other.
    // FS-based, not W-based: FS scales as sqrt(W*UI_H) while a straight W-fraction
    // grows linearly with screen width, so on a wide real device (much wider than
    // the desktop window this was tuned on) a W-based pad overshoots badly relative
    // to the (much more slowly growing) button text -- this read as "way too wide"
    // on an actual phone despite looking fine narrower.
    const pad = FS * 0.011;
    // fixedW: grid-style buttons (settings panel's audio/ghost rows) pass an exact
    // width so a row of buttons lines up edge-to-edge instead of sizing itself to
    // its own label. Text can still overflow a fixed box on a long localized label
    // (German "GEIST AUS" vs a narrow half-row slot), so shrink the font to fit
    // rather than let it run past the button's edge -- same shrink-to-fit pattern
    // the language grid buttons already use for the same reason.
    const drawBtn = (bCx, bCy, label, active, blue, fixedW, fixedH) => {
        let bw = fixedW, bh = fixedH || H*0.055;
        if (bw == null) {
            bw = ctx.measureText(label).width + pad;
        } else {
            const maxTextW = bw * 0.86;
            const textW = ctx.measureText(label).width;
            if (textW > maxTextW) {
                const sizeMatch = ctx.font.match(/([\d.]+)px/);
                if (sizeMatch) {
                    const shrunk = parseFloat(sizeMatch[1]) * maxTextW / textW;
                    ctx.font = ctx.font.replace(/[\d.]+px/, `${shrunk}px`);
                }
            }
        }
        const bx = bCx - bw/2, by = bCy - bh/2;
        const bgA = active ? a*0.82 : a*0.55;
        const bg  = active
            ? (blue ? `rgba(14,26,62,${bgA})` : `rgba(12,44,24,${bgA})`)
            : `rgba(10,12,26,${bgA})`;
        ctx.shadowColor = active
            ? (blue ? `rgba(80,130,255,${a*0.45})` : `rgba(60,200,100,${a*0.45})`)
            : 'transparent';
        ctx.shadowBlur = active ? 8 : 0;
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill();
        ctx.strokeStyle = active
            ? (blue ? `rgba(90,140,255,${a*0.65})` : `rgba(70,215,110,${a*0.65})`)
            : `rgba(50,55,90,${a*0.40})`;
        ctx.lineWidth = 1; ctx.shadowBlur = 0; ctx.stroke();
        ctx.fillStyle = active
            ? (blue ? `rgba(140,175,255,${a})` : `rgba(90,230,125,${a})`)
            : `rgba(95,100,145,${a*0.70})`;
        ctx.fillText(label, bCx, bCy);
        return { x: bx, y: by, w: bw, h: bh };
    };
    // Shop + Settings buttons -- Shop always sits immediately left of Settings,
    // paired the same way Leaderboard pairs with Challenge. Paired with the Game
    // Center leaderboard button when that native bridge exists, and with a
    // challenge button too on devices new enough to actually use Game Center
    // Challenges (GKChallengeDefinition needs iOS 26+ - see GameView.swift, which
    // sets window._tunlChallengeSupported before this ever runs). Widths are
    // measured first so long localized labels never overlap, and each row is
    // centered as a whole around titleX.
    {
        const settingsBY = tBtnY;
        const hasGameCenter = !!window.webkit?.messageHandlers?.gameCenter;
        const hasChallenge  = hasGameCenter && !!window._tunlChallengeSupported;
        _challengeBtnRect = null;
        const rowGap = W * 0.02;   // matches audioGap, the settings panel's green-pair gap
        const bh     = H * 0.062;
        // Row is centered on titleX, which sits much closer to the left screen edge
        // than to the divider on narrow devices (titleX = W*0.23) -- so on a device
        // that's both narrow (e.g. iPhone 12 mini, 812pt wide landscape) and running
        // a verbose language (German labels especially, e.g. "HERAUSFORDERUNG"), a
        // single 3-button row's left edge can land off-screen, clipping text at the
        // edge. Kept the shrink-to-fit guard below as a safety net, but the real fix
        // (per user suggestion) is two rows instead of one: Rangliste + Herausforderung
        // (the two "compete" buttons) on top, Shop + Einstellungen below -- reads
        // better than shrunk text even on devices where one row would technically
        // have fit.
        const rowMarginL = W * 0.02, rowMarginR = W * 0.02;
        const maxRowW = 2 * Math.max(Math.min(titleX - rowMarginL, dividerX - titleX - rowMarginR), W * 0.10);
        // Bottom Y of whatever got drawn (not currently read elsewhere -- see its
        // state.js comment).
        _btnRowBottom = settingsBY + bh / 2;

        // Natural (unshrunk) width a side-by-side pair would want, capped at
        // maxRowW -- used only to pick a common span for both rows (see finalW
        // below), never to actually draw at.
        const measurePairW = (labelL, labelR) => {
            ctx.font = `${btnFontSz}px 'Courier New',monospace`;
            const textSum = ctx.measureText(labelL).width + ctx.measureText(labelR).width;
            return Math.min(textSum + pad * 2 + rowGap, maxRowW);
        };
        // Draws two buttons side by side, each taking exactly half of totalW (minus
        // rowGap), centered on titleX -- same fixedW-splits-evenly pattern the
        // language grid and the settings panel's audio row already use, so a label
        // too long for its half shrinks itself via drawBtn's own shrink-to-fit
        // rather than pushing the row wider.
        const drawPair = (labelL, labelR, cy, totalW, blue) => {
            const slotW = (totalW - rowGap) / 2;
            const bx = titleX - totalW / 2;
            ctx.font = `${btnFontSz}px 'Courier New',monospace`;
            const rectL = drawBtn(bx + slotW / 2, cy, labelL, true, blue, slotW, bh);
            ctx.font = `${btnFontSz}px 'Courier New',monospace`;   // drawBtn may have shrunk it for labelL
            const rectR = drawBtn(bx + slotW + rowGap + slotW / 2, cy, labelR, true, blue, slotW, bh);
            return { rectL, rectR };
        };

        if (hasChallenge) {
            // Both rows are stretched to the wider pair's natural width so their
            // edges line up into one aligned block instead of two independently
            // sized rows that happen to be stacked.
            const finalW = Math.max(
                measurePairW(T.leaderboard, T.challenge),
                measurePairW(T.shop, T.settings),
            );
            const top = drawPair(T.leaderboard, T.challenge, settingsBY, finalW, false);
            _leaderboardBtnRect = top.rectL;
            _challengeBtnRect   = top.rectR;

            // Shop + Settings on the row below. Vertical gap was H*0.02 -- read as
            // cramped on a real device screenshot, the two rows nearly touching.
            // Widened to H*0.035 so the pair reads as one consistent rhythm rather
            // than two rows that happen to be stacked. This whole cluster is
            // positioned off the missions block's bottom edge (see tBtnY above),
            // not the other way around, so it can't collide just because it grew a
            // 2nd row here.
            const settingsBY2 = settingsBY + bh + H * 0.035;
            const bottom = drawPair(T.shop, T.settings, settingsBY2, finalW, true);
            _shopBtnRect     = bottom.rectL;
            _settingsBtnRect = bottom.rectR;
            _btnRowBottom = settingsBY2 + bh / 2;
        } else if (hasGameCenter) {
            // Leaderboard alone on its own row above -- Shop+Settings always pair
            // together below it now, so Leaderboard can no longer share a row with
            // Settings the way it used to when nothing sat to Settings' left.
            // Stretched to match the pair's width below it (same "single button
            // matches the row's width" pattern GEIST AN uses under MUSIK AN/TON AN
            // in the settings panel), rather than the pair matching Leaderboard's
            // own width, since the pair is the row more likely to need the room.
            ctx.font = `${btnFontSz}px 'Courier New',monospace`;
            const finalW = Math.max(measurePairW(T.shop, T.settings), ctx.measureText(T.leaderboard).width + pad);
            _leaderboardBtnRect = drawBtn(titleX, settingsBY, T.leaderboard, true, false, finalW, bh);

            const settingsBY2 = settingsBY + bh + H * 0.035;
            const bottom = drawPair(T.shop, T.settings, settingsBY2, finalW, true);
            _shopBtnRect     = bottom.rectL;
            _settingsBtnRect = bottom.rectR;
            _btnRowBottom = settingsBY2 + bh / 2;
        } else {
            const finalW = measurePairW(T.shop, T.settings);
            const solo = drawPair(T.shop, T.settings, settingsBY, finalW, true);
            _shopBtnRect     = solo.rectL;
            _settingsBtnRect = solo.rectR;
        }
    }

    // rightColY tracks how far down the right-column stack (TODAY/ALL TIME/
    // STREAK/TOP 5) reaches in landscape, so each line uses the same step
    // and the skin picker below never overlaps regardless of which lines
    // end up shown. 0.22 -> 0.20: nudged up so the right column stays aligned
    // with the left column instead of hanging lower (dotY1/dotY2 below move the
    // same 0.02H so the ship rows follow). First pass tried 0.17 based on a
    // desktop Chrome test, which over-corrected -- see dotY1's comment for why
    // that test read the gap as bigger than it really is on a real device.
    let rightColY  = H * 0.20 - 11;
    // Tightened from 0.105 -- TODAY/streak reads as a secondary line on ALL TIME,
    // not a peer of the SHIP block below it, so it should sit noticeably closer to
    // ALL TIME than to SHIP (the gap down to SHIP is set separately, see
    // shipHeaderY below).
    const lineStep = H * 0.065;

    // BEST (all-time record) is the single headline stat -- it rarely changes, so
    // it reads as "your record" rather than a volatile daily figure. TODAY and the
    // day streak fold into one small secondary line instead of each getting their
    // own full row: was 3 stacked LABEL/value rows that read as a data table, not
    // a HUD (direct feedback: "wirkt ein bisschen überladen"). Skipped entirely
    // before the player's first real run -- an empty title screen doesn't need a
    // "BEST 0" placeholder.
    // Left edge of the HEUTE/streak line below, so the SHIP header (drawn later,
    // above the ship row) can left-align to it instead of centring on the ship
    // row's own axis. Falls back to infoX if that line never renders (no runs
    // played yet today) -- showShipPanel already implies best > 0 in practice, so
    // this is set for real by the time it's read.
    let heuteLeftX = infoX;
    if (best > 0) {
        ctx.shadowColor = 'rgba(0,0,0,0.90)'; ctx.shadowBlur = 3;
        ctx.font        = `bold ${FS*0.036}px 'Courier New',monospace`;
        ctx.fillStyle   = `rgba(190,212,255,${a * 0.98})`;
        const allTimeText = `${T.allTime}  ${best}`;
        const allTimeY    = LAND ? rightColY : H/2 + H*0.280;
        ctx.fillText(allTimeText, infoX, allTimeY);
        ctx.shadowBlur  = 0;

        // Two visually distinct segments instead of one flat string: TODAY stays
        // the calm secondary-stat colour, while the streak segment gets its own
        // warmer glow and a real flame glyph (was a bare '*'/'**' placeholder) so
        // a hot streak actually pops instead of reading as plain text with extra
        // punctuation. No separator glyph between them (a middle-dot used to sit
        // here but did nothing visually beyond the whitespace already doing the
        // separating job) -- just a plain gap.
        const subParts = [];
        if (dailyRuns > 0) subParts.push({ text: `${T.today} ${dailyBest}`, hot: false });
        if (streak > 0) {
            const flame = streak >= 7 ? ' \u{1F525}\u{1F525}' : streak >= 3 ? ' \u{1F525}' : '';
            subParts.push({ text: `${streak}${flame} ${T.day}`, hot: true });
        }
        // Stardust readout used to live here (beside the streak), moved down onto
        // the SHIP/shard line instead -- see shardWalletText below. Both currencies
        // a ship costs now read together in one place rather than one sitting next
        // to the streak that earns it and the other a whole line away.
        if (subParts.length) {
            rightColY += lineStep;
            ctx.font = `bold ${FS*0.025}px 'Courier New',monospace`;
            const gap    = ctx.measureText('    ').width;
            const widths = subParts.map(p => ctx.measureText(p.text).width);
            const totalW = widths.reduce((s, w) => s + w, 0) + gap * (subParts.length - 1);
            const ly     = LAND ? rightColY : H/2 + H*0.316;
            ctx.textAlign = 'left';
            let x = infoX - totalW / 2;
            heuteLeftX = x; // SCHIFF header below left-aligns to this same edge
            subParts.forEach((p, i) => {
                if (p.hot) {
                    // Below the "on fire" threshold this is just a day count, not a
                    // reward -- yellow/gold is reserved for shard figures elsewhere
                    // in the game, so a cold streak uses the same neutral colour as
                    // the HEUTE segment instead.
                    ctx.fillStyle   = streak >= 3 ? `rgba(255,180,70,${a * 0.95})` : `rgba(160,185,230,${a * 0.85})`;
                    ctx.shadowColor = streak >= 3 ? `rgba(255,140,20,${a * 0.55})` : 'rgba(0,0,0,0.90)';
                    ctx.shadowBlur  = streak >= 3 ? 7 : 3;
                } else {
                    ctx.fillStyle   = `rgba(160,185,230,${a * 0.85})`;
                    ctx.shadowColor = 'rgba(0,0,0,0.90)';
                    ctx.shadowBlur  = 3;
                }
                ctx.fillText(p.text, x, ly);
                x += widths[i] + gap;
            });
            ctx.shadowBlur = 0;
            ctx.textAlign  = 'center';
        }
    }

    // Ship wallet + picker shows once the player has actually played --
    // `best > 0` covers the "still on PEARL only" case, since with the shard
    // economy that can last several sessions and the wallet/next-unlock-cost
    // roadmap needs to stay visible that whole time, unlike the old score-gate
    // system where reaching a 2nd ship happened almost immediately. The right
    // column used to also host a "today's top 5 runs" filler here before this
    // panel unlocked, competing for the same space; removed as redundant once
    // Game Center covers competitive leaderboards (where available -- Android's
    // own leaderboard setup is still pending, per project notes) and this panel
    // is now visible from the first run on anyway, not just after a 2nd unlock.
    // (showShipPanel and the two-row layout geometry are computed above, before
    // the divider, so the divider can be positioned against the full ship span --
    // reused here rather than recomputed.)

    // Skin picker - two rows: unlocked (larger) above, locked (smaller) below.
    if (showShipPanel) {
        _skinBtnRects = [];

        // SHIP header + shard wallet, above the unlocked row. Left-aligned to the
        // HEUTE line's left edge (heuteLeftX, set above) rather than centred on the
        // ship row's own axis, so it reads as part of the same stats column instead
        // of a separately-centred label. Whole line in the same gold every other
        // shard figure in the game uses (mission rewards, the shard banner, etc.) --
        // this was the one place still drawing it in the neutral label colour instead.
        //
        // Y position is clamped against rightColY (the actual bottom edge of the
        // REKORD/HEUTE stack above), not just a fixed dotY1-minus-constant offset --
        // dotR1 is UI_H-based and stays a fixed pixel size on a short device, while
        // rightColY's H-based position shrinks with it, so a fixed offset from dotY1
        // that looked fine on a tall device collided with HEUTE/TAGESSERIE on a
        // shorter or wider-aspect real device. This keeps a proportional gap instead.
        const shipHeaderY = Math.max(dotY1 - dotR1 * 2.6, rightColY + H * 0.075) - 4;

        // "?" button opening a one-screen explainer for shards/stardust/coins
        // (showCurrencyInfo, state.js). Shards and stardust are the one pair of
        // numbers on this whole screen that mean nothing without context -- unlike
        // coins, which teach themselves during a run by look and effect. Opt-in
        // (tap to open), not a forced hint, so it doesn't repeat the removed
        // title-screen control hint (CLAUDE.md Onboarding). Left of SHIP/NAVE, gold
        // like the shard figure it sits next to rather than this line's pale label
        // white.
        {
            const infoR = FS * 0.016;
            const infoCx = heuteLeftX - infoR * 2.4;
            const infoCy = shipHeaderY;
            _currencyInfoBtnRect = { cx: infoCx, cy: infoCy, r: infoR * 2.0 };
            ctx.shadowColor = 'rgba(255,205,80,0.65)';
            ctx.shadowBlur  = 6;
            ctx.beginPath();
            ctx.arc(infoCx, infoCy, infoR, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,225,110,0.90)';
            ctx.lineWidth   = 1.6;
            ctx.stroke();
            ctx.font        = `bold ${infoR * 1.4}px 'Courier New',monospace`;
            ctx.fillStyle   = 'rgba(255,225,110,0.98)';
            ctx.textAlign   = 'center';
            ctx.fillText('?', infoCx, infoCy);
            ctx.shadowBlur  = 0;
        }

        ctx.font        = `bold ${FS*0.025}px 'Courier New',monospace`;
        ctx.fillStyle   = 'rgba(255,225,110,0.95)';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur  = 3;
        ctx.textAlign   = 'left';
        const shardWalletText = `${T.ship} ${shards}\u200A⧫`;
        ctx.fillText(shardWalletText, heuteLeftX, shipHeaderY);

        // Stardust joins the shard figure on this same line instead of sitting a
        // whole line up next to the streak -- both currencies a ship actually costs
        // now read together in one place. Kept in its own fillText/colour (not
        // folded into shardWalletText's gold) since gold is reserved for shard
        // figures elsewhere in the game; a hot streak's own comment above says the
        // same thing. Hidden once SOLARIS is owned (constants.js Stardust block) --
        // nothing left for it to count toward.
        if (stardust > 0 && !(unlockedSkins & (1 << (SKINS.length - 1)))) {
            const shardWalletW = ctx.measureText(shardWalletText).width;
            // Bright cyan, not the old pale blue-white -- a currency figure players
            // check daily deserves to actually pop, and cyan reads as clearly its
            // own thing next to shard-gold rather than a washed-out afterthought.
            ctx.shadowColor = 'rgba(80,210,255,0.55)';
            ctx.shadowBlur  = 5;
            ctx.fillStyle   = `rgba(120,225,255,${a * 0.95})`;
            ctx.fillText(`   ${stardust}\u200A✦`, heuteLeftX + shardWalletW, shipHeaderY);
        }
        ctx.shadowBlur  = 0;
        ctx.textAlign   = 'center';   // restore -- ship grid below expects centred text

        // -- Ship grid: fixed 4 per row (GRID_COLS above), every ship rendered
        // according to its own unlock state rather than which row that state used
        // to put it in. Locked ships (dimmed ring + cost, no name/icon) and unlocked
        // ships (full ship render, name, mastery pips when selected) can now land in
        // either row depending on index alone.
        let selectedCx = cx1; // fallback: grid centre, overwritten below once the active ship is found
        let selectedNameBottomY = dotY1 + dotR1 * 1.7; // fallback, overwritten below
        for (let i = 0; i < SKINS.length; i++) {
            const row      = Math.floor(i / GRID_COLS);
            const col      = i % GRID_COLS;
            const cx       = (row === 0 ? startX1 : startX2) + col * dotGap1;
            const cy       = row === 0 ? dotY1 : dotY2;
            const unlocked = !!(unlockedSkins & (1 << i));
            const selected = activeSkin === i;
            if (selected) selectedCx = cx;

            if (!unlocked) {
                // Locked -- dimmed ring + faint ship silhouette + cost, no name
                // (LAND only, matching the old locked-row treatment).
                _skinBtnRects.push({ cx, cy, r: dotR2 * 1.5 });
                if (!LAND) continue;
                ctx.beginPath();
                ctx.arc(cx, cy, dotR2, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(90,95,130,0.50)';
                ctx.lineWidth   = 1.5;
                ctx.stroke();
                // Faint silhouette, same shipPath() geometry every unlocked ship
                // uses (scaled down, no glow/colour) -- an empty ring read as an
                // inert placeholder rather than "a ship you don't have yet". Sized
                // and dimmed well below the unlocked row so it never competes with
                // an actual owned ship for attention.
                shipPath(cx, cy, dotR2 * 0.62);
                ctx.fillStyle   = 'rgba(150,160,205,0.28)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(170,180,220,0.35)';
                ctx.lineWidth   = 1;
                ctx.stroke();
                ctx.shadowColor = 'rgba(0,0,0,0.85)';
                ctx.shadowBlur  = 3;
                // Every tier needs shards AND days-played (constants.js Stardust
                // block) except SOLARIS, which is stardustGate-only. Two stacked
                // lines when both apply -- a flat cost alone would read as
                // buyable-with-enough-shards, which none of these tiers are anymore.
                // Stardust line shows live progress ("5/15"), not just the goal, since
                // it's the one number that moves on its own without playing this run.
                // Cost line in the same shard-gold used everywhere else shards are
                // shown (SHIP wallet, mission rewards) -- was the same neutral grey
                // as the ring around it, reading as inert label text rather than a
                // currency figure. Stardust gate gets its own bright cyan (matching
                // the SHIP-line stardust readout above) so the two currencies stay
                // visually distinct even stacked on top of each other.
                if (SKINS[i].cost) {
                    ctx.font      = `bold ${FS*0.018}px 'Courier New',monospace`;
                    ctx.fillStyle = 'rgba(255,225,110,0.95)';
                    ctx.fillText(`${SKINS[i].cost}\u200A⧫`, cx, cy + dotR2 * 1.7);
                }
                if (SKINS[i].stardustGate) {
                    ctx.font      = `bold ${FS*0.015}px 'Courier New',monospace`;
                    ctx.fillStyle = 'rgba(120,225,255,0.95)';
                    const gateY = SKINS[i].cost ? cy + dotR2 * 2.5 : cy + dotR2 * 1.7;
                    ctx.fillText(`${Math.min(stardust, SKINS[i].stardustGate)}/${SKINS[i].stardustGate}\u200A\u2726`, cx, gateY);
                }
                ctx.shadowBlur  = 0;
                continue;
            }

            _skinBtnRects.push({ cx, cy, r: dotR1 * 1.5 });
            const [sr, sg, sb] = SKINS[i].shadow;
            if (selected) {
                ctx.save();
                shipPath(cx, cy, dotR1 * 1.6);
                ctx.strokeStyle = `rgba(${sr},${sg},${sb},0.50)`;
                ctx.lineWidth   = 2.5;
                ctx.shadowColor = `rgba(${sr},${sg},${sb},0.60)`;
                ctx.shadowBlur  = 12;
                ctx.stroke();
                ctx.shadowBlur  = 0;
                ctx.restore();
            }
            drawShip(cx, cy, dotR1, SKINS[i].color, sr, sg, sb, selected ? 22 : 8);
            // Mastery pips above the selected ship (constants.js masteryLevel/masteryLerp).
            // PEARL has no perk to master.
            if (selected && i > 0) {
                const lvl = masteryLevel(i);
                const pipR = dotR1 * 0.09, pipGap = dotR1 * 0.30;
                const pipsW = (MASTERY_XP_THRESHOLDS.length - 2) * pipGap;
                for (let p = 0; p < MASTERY_XP_THRESHOLDS.length - 1; p++) {
                    const px  = cx - pipsW/2 + p * pipGap;
                    const py2 = cy - dotR1 * 1.35;
                    ctx.beginPath();
                    ctx.arc(px, py2, pipR, 0, Math.PI*2);
                    if (p < lvl) {
                        ctx.fillStyle   = `rgba(${sr},${sg},${sb},0.90)`;
                        ctx.shadowColor = `rgba(${sr},${sg},${sb},0.70)`;
                        ctx.shadowBlur  = 5;
                        ctx.fill();
                        ctx.shadowBlur  = 0;
                    } else {
                        ctx.strokeStyle = `rgba(${sr},${sg},${sb},0.40)`;
                        ctx.lineWidth   = 1;
                        ctx.stroke();
                    }
                }
            }
            ctx.font        = `${FS*0.021}px 'Courier New',monospace`;
            ctx.fillStyle   = selected
                ? `rgba(${sr},${sg},${sb},0.95)`
                : 'rgba(160,175,220,0.65)';
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur  = selected ? 8 : 3;
            const nameY = cy + dotR1 * 1.7;
            ctx.fillText(SKINS[i].name, cx, nameY);
            ctx.shadowBlur  = 0;
            // Real ink-bottom of this label (not the neighbouring dotR1*1.7 offset,
            // which is a hand-tuned icon-clearance number, not a text-metric one, and
            // not fontBoundingBoxDescent either -- that's the whole font box's
            // descent, generous enough to leave room for a 'g' or 'y' this text may
            // not even contain, so it was swallowing the nameGap adjustment below in
            // several px of invisible padding no amount of shrinking nameGap could
            // touch). actualBoundingBoxDescent is this specific string's real
            // rendered extent, so nameGap now measures the whole visible gap.
            if (selected) {
                selectedNameBottomY = nameY + ctx.measureText(SKINS[i].name).actualBoundingBoxDescent;
            }
        }

        // Active perk - shown in the gap between the two grid rows when the selected
        // ship is in row 1, or below the 2nd row entirely when the selected ship is
        // in row 2 (showing it in the gap ABOVE that ship, between the rows, read as
        // detached from the ship it actually describes). Drawback is omitted here;
        // it reads as noise sharing this limited vertical band.
        //
        // dotY1/dotY2 (the row centres) are H-based and shrink on a short device
        // (iPhone 12 mini etc.), but dotR1/dotR2 and this text's font are UI_H-based
        // (constants.js pins UI_H at a 600px floor) and DON'T shrink with them - so
        // the fixed-pixel padding that used to reserve the gap (dotR1*2.1, dotR2*1.8)
        // could eat almost the entire band on a short device, leaving the perk text
        // squeezed against the ship name above or the row below. Fixing that by
        // moving dotY1 up or dotY2 down would fight the layout above/below them, both
        // already tuned close to their own edges - instead this measures the real
        // leftover band each frame and sizes the text to it, so it always has clear
        // air on both sides regardless of device height.
        // '{v}' is filled with the ship's CURRENT mastery-scaled value (constants.js
        // skinPerkValue), not the frozen level-0 number the string used to hardcode --
        // it now tracks the same mastery pips drawn above the ship (see masteryLevel).
        const activePerkTpl = T.skinPerks && T.skinPerks[activeSkin];
        const activePerk = activePerkTpl && activePerkTpl.replace('{v}', skinPerkValue(activeSkin));
        if (activePerk) {
            const [sr, sg, sb] = SKINS[activeSkin].shadow;
            const selectedRow = Math.floor(activeSkin / GRID_COLS);
            const nameGap = 2; // per feedback (was 2px, then 1px, 0.5px, 0.4px, 0.3px)
            let perkFsz = FS * 0.019;
            ctx.font = `${perkFsz}px 'Courier New',monospace`;
            if (nGridRows > 1 && selectedRow < nGridRows - 1) {
                // Row 1 of a multi-row grid: shrink to fit above row 2's ships.
                const bandBottom = dotY2 - dotR2 * 1.35;
                const bandH      = Math.max(bandBottom - selectedNameBottomY, 0);
                perkFsz = Math.max(Math.min(perkFsz, bandH * 0.92), FS * 0.011);
            } else {
                // Last row: shrink to fit above the bottom safety margin instead of
                // clamping the Y position directly -- clamping perkY on its own left
                // the gap correct on a tall device but shrank it (down to overlapping
                // the name label, on a short enough one) wherever the unclamped
                // position would have landed past the margin, which is exactly the
                // "row 2's gap is smaller than row 1's" report this fixes.
                const ascentRatio = ctx.measureText(activePerk).actualBoundingBoxAscent / perkFsz;
                const maxFszForBottom = (H - 10 - nameGap - selectedNameBottomY) / ascentRatio;
                perkFsz = Math.max(Math.min(perkFsz, maxFszForBottom), FS * 0.011);
            }
            ctx.font = `${perkFsz}px 'Courier New',monospace`;
            // Exact nameGap-px gap under the selected ship's own name label, using
            // this specific string's real rendered ink (actualBoundingBoxAscent) --
            // fontBoundingBoxAscent (the whole font box's ascent, tried first) is
            // generous enough to swallow several px of nameGap adjustment in
            // invisible padding no amount of shrinking it could touch.
            const perkAscent = ctx.measureText(activePerk).actualBoundingBoxAscent;
            const perkY = selectedNameBottomY + nameGap + perkAscent;
            // Centred under the selected ship's name -- but clamped so a wide string
            // (e.g. "NEAR-MISS RANGE +100%") doesn't run off-screen when the selected
            // ship sits at either end of a row (column 0 leftmost, column 3 rightmost).
            const perkHalfW = ctx.measureText(activePerk).width / 2;
            const perkX     = Math.min(Math.max(selectedCx, edgeMargin + perkHalfW), W - edgeMargin - perkHalfW);
            ctx.fillStyle   = `rgba(${sr},${sg},${sb},0.82)`;
            ctx.shadowColor = 'rgba(0,0,0,0.90)';
            ctx.shadowBlur  = 4;
            ctx.fillText(activePerk, perkX, perkY);
            ctx.shadowBlur  = 0;
        }
    }

    // Settings panel - drawn last so it overlays everything.
    // Layout flows top-down from a fixed set of section heights/gaps rather
    // than fixed fractions of panH, so it never overlaps as content grows
    // (the old fixed-percentage layout broke once a 5th language was added).
    if (showSettings) {
        ctx.fillStyle = 'rgba(0,0,12,0.88)';
        ctx.fillRect(0, 0, W, H);

        const panW = Math.min(W * 0.56, 340);
        // Shared horizontal span for every row in the panel -- the audio row, the
        // ghost row, and the language grid all start/end at the same x, so the whole
        // stack reads as one aligned block instead of three differently-sized rows
        // floating inside the panel.
        const rowW  = panW * 0.80;
        const rowX0 = W / 2 - rowW / 2;

        // Nominal section heights, computed before knowing whether they'll actually
        // fit. The optional privacy section already made this variable; the ghost
        // row added a fixed amount on top of that, and with everything present at
        // once (privacy + ghost + all 15 languages) the sum can exceed the screen
        // on a short device -- exactly the "old fixed-percentage layout broke once
        // a 5th language was added" failure this whole block's comment already
        // warns about, just triggered by a new row instead of a new language. Rather
        // than hand-tune every gap to *probably* fit, scale every nominal height down
        // by the same factor when the total overshoots, so panH is only ever as big
        // as what's actually on screen -- content stays proportioned, it's just
        // uniformly denser on the device that needs it instead of hanging off the
        // bottom edge.
        const nPadTop     = H * 0.060;
        const nPadBottom  = H * 0.040;
        const nTitleH     = H * 0.070;
        const nAudioRowH  = H * 0.075;
        const nLangLabelH = H * 0.045;
        const nLbh        = H * 0.080;
        const nLbGap      = H * 0.018;
        const nSectionGap = H * 0.045;

        // Only shown once the native layer confirms the UMP SDK actually requires
        // it for this player's region (see state.js's privacyOptionsRequired) -
        // most players outside the EEA/UK/CH/opted-in US states never see this row.
        const hasPrivacyBtn   = !!window.webkit?.messageHandlers?.ads && privacyOptionsRequired;
        const nPrivacyBtnH    = H * 0.062;
        const nPrivacySectionH = hasPrivacyBtn ? nSectionGap + nPrivacyBtnH : 0;

        const langCols   = LANG_ORDER.length > 10 ? 3 : 2;
        const langRows   = Math.ceil(LANG_ORDER.length / langCols);
        const nLangListH = langRows * nLbh + Math.max(0, langRows - 1) * nLbGap;
        const nPanH = nPadTop + nTitleH + nAudioRowH + nSectionGap + nLangLabelH + nLangListH + nPrivacySectionH + nPadBottom;

        // Leave a hair of margin inside the 0.02..0.98 clamp band below rather than
        // filling it exactly, so this never comes down to a single rounding error.
        const panHCap = H * 0.94;
        const settingsScale = Math.min(1, panHCap / nPanH);

        const padTop     = nPadTop     * settingsScale;
        const padBottom  = nPadBottom  * settingsScale;
        const titleH     = nTitleH     * settingsScale;
        const audioRowH  = nAudioRowH  * settingsScale;
        const langLabelH = nLangLabelH * settingsScale;
        const lbh        = nLbh        * settingsScale;
        const lbGap      = nLbGap      * settingsScale;
        const sectionGap = nSectionGap * settingsScale;
        const privacyBtnH = nPrivacyBtnH * settingsScale;
        const langListH  = nLangListH  * settingsScale;
        const privacySectionH = nPrivacySectionH * settingsScale;
        const panH = nPanH * settingsScale;

        const panX = W / 2 - panW / 2;
        const panY = Math.max(H * 0.02, Math.min(H * 0.98 - panH, H / 2 - panH / 2));
        _settingsPanelRect = { x: panX, y: panY, w: panW, h: panH };

        ctx.fillStyle = 'rgba(7,10,28,0.97)';
        ctx.beginPath();
        ctx.roundRect(panX, panY, panW, panH, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(65,88,155,0.55)';
        ctx.lineWidth   = 1;
        ctx.stroke();

        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';

        let y = panY + padTop;

        // Title
        ctx.font        = `bold ${FS * 0.030}px 'Courier New',monospace`;
        ctx.fillStyle   = 'rgba(165,190,255,0.95)';
        ctx.shadowColor = 'rgba(0,0,0,0.90)';
        ctx.shadowBlur  = 5;
        ctx.fillText(T.settings, W / 2, y + titleH / 2);
        ctx.shadowBlur  = 0;
        y += titleH;

        // Audio toggle row (Music/FX) - each button takes exactly half of rowW, split
        // by audioGap, so the pair spans the same edges as the language grid below
        // rather than sizing itself to its own label.
        {
            const audioBY    = y + audioRowH / 2;
            const audioGap   = W * 0.02;
            const halfW      = (rowW - audioGap) / 2;
            const musicCX    = rowX0 + halfW / 2;
            const fxCX       = rowX0 + rowW - halfW / 2;
            const musicLabel = musicOn ? T.musicOn : T.musicOff;
            const fxLabel    = fxOn    ? T.fxOn    : T.fxOff;
            ctx.font = `${FS*0.022}px 'Courier New',monospace`;
            _btnMusicRect = drawBtn(musicCX, audioBY, musicLabel, musicOn, false, halfW);
            ctx.font = `${FS*0.022}px 'Courier New',monospace`;   // drawBtn may have shrunk it for musicLabel
            _btnFxRect    = drawBtn(fxCX,    audioBY, fxLabel,    fxOn,    false, halfW);
        }
        y += audioRowH + sectionGap;

        // Language section label
        ctx.font        = `bold ${FS * 0.021}px 'Courier New',monospace`;
        ctx.fillStyle   = 'rgba(180,200,250,0.95)';
        ctx.shadowColor = 'rgba(0,0,0,0.90)';
        ctx.shadowBlur  = 3;
        ctx.fillText(T.language, W / 2, y + langLabelH / 2 - 2);
        ctx.shadowBlur  = 0;
        y += langLabelH;

        _langBtnRects = [];
        const lbw  = (rowW - lbGap * (langCols - 1)) / langCols;
        const lbx0 = rowX0;
        for (let i = 0; i < LANG_ORDER.length; i++) {
            const code   = LANG_ORDER[i];
            const lang   = LANGS[code];
            const col    = i % langCols;
            const row    = Math.floor(i / langCols);
            const lbx    = lbx0 + col * (lbw + lbGap);
            const lby    = y + row * (lbh + lbGap);
            const active = activeLang === code;

            ctx.fillStyle = active ? 'rgba(28,50,90,0.88)' : 'rgba(15,18,40,0.72)';
            ctx.beginPath();
            ctx.roundRect(lbx, lby, lbw, lbh, 7);
            ctx.fill();
            ctx.strokeStyle = active ? 'rgba(80,140,255,0.70)' : 'rgba(50,60,100,0.38)';
            ctx.lineWidth   = active ? 1.5 : 1;
            ctx.stroke();

            // Shrink the label font to fit narrower buttons (3-col grid, long
            // names like "Indonesia" / "Tiếng Việt") instead of overflowing.
            let langFontPx = FS * 0.023;
            ctx.font = `${active ? 'bold ' : ''}${langFontPx}px 'Courier New',monospace`;
            const nameW = ctx.measureText(lang.name).width;
            const maxNameW = lbw * 0.88;
            if (nameW > maxNameW) {
                langFontPx *= maxNameW / nameW;
                ctx.font = `${active ? 'bold ' : ''}${langFontPx}px 'Courier New',monospace`;
            }
            ctx.fillStyle = active ? 'rgba(140,180,255,0.97)' : 'rgba(150,170,220,0.88)';
            if (active) { ctx.shadowColor = 'rgba(80,140,255,0.55)'; ctx.shadowBlur = 10; }
            ctx.fillText(lang.name, lbx + lbw / 2, lby + lbh / 2);
            ctx.shadowBlur = 0;

            _langBtnRects.push({ x: lbx, y: lby, w: lbw, h: lbh, code });
        }
        y += langListH;

        // Re-entry point into the UMP consent form (see AdsManager.kt/.swift's
        // showPrivacyOptionsForm) - required by Google's policy wherever the
        // form itself is required, so players can change their mind after the
        // one-time launch prompt without reinstalling the app.
        _privacyChoicesBtnRect = null;
        if (hasPrivacyBtn) {
            y += sectionGap;
            const pbw = panW * 0.78, pby = y;
            const pbx = W / 2 - pbw / 2;
            ctx.fillStyle = 'rgba(15,18,40,0.72)';
            ctx.beginPath(); ctx.roundRect(pbx, pby, pbw, privacyBtnH, 7); ctx.fill();
            ctx.strokeStyle = 'rgba(90,120,160,0.50)';
            ctx.lineWidth   = 1;
            ctx.beginPath(); ctx.roundRect(pbx, pby, pbw, privacyBtnH, 7); ctx.stroke();
            ctx.font      = `${FS * 0.019}px 'Courier New',monospace`;
            ctx.fillStyle = 'rgba(180,195,225,0.85)';
            ctx.fillText(T.privacyChoices, W / 2, pby + privacyBtnH / 2);
            _privacyChoicesBtnRect = { x: pbx, y: pby, w: pbw, h: privacyBtnH };
            y += privacyBtnH;
        }
    }

    // Shop panel - Remove Ads + Unlock All Ships + Restore Purchase, split out of
    // the settings panel above so that panel isn't stretched by IAP UI most players
    // never touch. Same nominal-height-then-scale-down pattern as the settings panel,
    // just for the IAP section instead of the whole settings stack.
    if (showShop) {
        ctx.fillStyle = 'rgba(0,0,12,0.88)';
        ctx.fillRect(0, 0, W, H);

        const panW = Math.min(W * 0.56, 340);
        const hasIAP = !!window.webkit?.messageHandlers?.iap;

        const nPadTop    = H * 0.060;
        const nPadBottom = H * 0.040;
        const nTitleH    = H * 0.070;
        const nIapBtnH   = H * 0.085;
        const nShipsGap   = H * 0.022;   // gap above the Unlock All Ships row
        const nRestoreGap = H * 0.022;
        const nRestoreH   = H * 0.062;   // matched to nPrivacyBtnH in the settings panel -- 0.032 read as a squashed sliver
        // Empty-state row shown instead of the buttons when there's no native IAP
        // bridge to talk to (web/dev build) -- the Shop button is always shown per
        // product decision, so this is that build's landing spot rather than a
        // hidden button.
        const nEmptyH     = H * 0.090;

        // Restore Purchase stays hidden only once there's nothing left either
        // product could restore -- unlike the old remove-ads-only check, "owns one"
        // isn't enough to hide it anymore.
        const nBodyH = hasIAP
            ? (nIapBtnH + nShipsGap + nIapBtnH + ((removeAdsOwned && allShipsOwned) ? 0 : nRestoreGap + nRestoreH))
            : nEmptyH;
        const nPanH = nPadTop + nTitleH + nBodyH + nPadBottom;

        const panHCap = H * 0.94;
        const shopScale = Math.min(1, panHCap / nPanH);

        const padTop    = nPadTop    * shopScale;
        const titleH    = nTitleH    * shopScale;
        const iapBtnH   = nIapBtnH   * shopScale;
        const shipsGap   = nShipsGap   * shopScale;
        const restoreGap = nRestoreGap * shopScale;
        const restoreH   = nRestoreH   * shopScale;
        const emptyH     = nEmptyH     * shopScale;
        const panH = nPanH * shopScale;

        const panX = W / 2 - panW / 2;
        const panY = Math.max(H * 0.02, Math.min(H * 0.98 - panH, H / 2 - panH / 2));
        _shopPanelRect = { x: panX, y: panY, w: panW, h: panH };

        ctx.fillStyle = 'rgba(7,10,28,0.97)';
        ctx.beginPath();
        ctx.roundRect(panX, panY, panW, panH, 12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(65,88,155,0.55)';
        ctx.lineWidth   = 1;
        ctx.stroke();

        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';

        let y = panY + padTop;

        ctx.font        = `bold ${FS * 0.030}px 'Courier New',monospace`;
        ctx.fillStyle   = 'rgba(165,190,255,0.95)';
        ctx.shadowColor = 'rgba(0,0,0,0.90)';
        ctx.shadowBlur  = 5;
        ctx.fillText(T.shop, W / 2, y + titleH / 2);
        ctx.shadowBlur  = 0;
        y += titleH;

        _removeAdsBtnRect = null;
        _unlockAllShipsBtnRect = null;
        _restoreBtnRect = null;
        if (hasIAP) {
            if (removeAdsOwned) {
                ctx.font      = `${FS * 0.020}px 'Courier New',monospace`;
                ctx.fillStyle = 'rgba(120,200,150,0.75)';
                ctx.fillText(T.adsRemoved, W / 2, y + iapBtnH / 2);
                y += iapBtnH;
            } else {
                const abw = panW * 0.78, aby = y;
                const abx = W / 2 - abw / 2;
                ctx.fillStyle = 'rgba(15,18,40,0.72)';
                ctx.beginPath(); ctx.roundRect(abx, aby, abw, iapBtnH, 7); ctx.fill();
                ctx.strokeStyle = 'rgba(90,160,255,0.55)';
                ctx.lineWidth   = 1;
                ctx.beginPath(); ctx.roundRect(abx, aby, abw, iapBtnH, 7); ctx.stroke();
                ctx.font      = `${FS * 0.023}px 'Courier New',monospace`;
                ctx.fillStyle = 'rgba(150,200,255,0.90)';
                ctx.fillText(T.removeAds, W / 2, aby + iapBtnH / 2);
                _removeAdsBtnRect = { x: abx, y: aby, w: abw, h: iapBtnH };
                y += iapBtnH;
            }

            // Unlock All Ships: the real-money shortcut past the shard+stardust
            // grind (constants.js Stardust block) -- same button treatment as
            // Remove Ads, gold-tinted instead of blue so it reads as the "ships"
            // product at a glance, matching the shard/skin-grid gold accent used
            // everywhere else ship-unlock-related.
            y += shipsGap;
            if (allShipsOwned) {
                ctx.font      = `${FS * 0.020}px 'Courier New',monospace`;
                ctx.fillStyle = 'rgba(220,190,120,0.80)';
                ctx.fillText(T.allShipsOwned, W / 2, y + iapBtnH / 2);
                y += iapBtnH;
            } else {
                const sbw = panW * 0.78, sby = y;
                const sbx = W / 2 - sbw / 2;
                ctx.fillStyle = 'rgba(15,18,40,0.72)';
                ctx.beginPath(); ctx.roundRect(sbx, sby, sbw, iapBtnH, 7); ctx.fill();
                ctx.strokeStyle = 'rgba(255,200,90,0.55)';
                ctx.lineWidth   = 1;
                ctx.beginPath(); ctx.roundRect(sbx, sby, sbw, iapBtnH, 7); ctx.stroke();
                // Shrink-to-fit, same pattern as the death screen's drawFitLine --
                // the longest translation (French, "DEBLOQUER TOUS LES VAISSEAUX")
                // is longer than Remove Ads' longest (German, 18 chars vs. 28), so a
                // flat font size here either clips French or leaves English cramped.
                let shipsFsz = FS * 0.023;
                ctx.font = `${shipsFsz}px 'Courier New',monospace`;
                const shipsTextW = ctx.measureText(T.unlockAllShips).width;
                const shipsAvailW = sbw * 0.88; // small margin inside the button's own border
                if (shipsTextW > shipsAvailW) {
                    shipsFsz = Math.max(shipsFsz * shipsAvailW / shipsTextW, FS * 0.014);
                    ctx.font = `${shipsFsz}px 'Courier New',monospace`;
                }
                ctx.fillStyle = 'rgba(255,220,140,0.92)';
                ctx.fillText(T.unlockAllShips, W / 2, sby + iapBtnH / 2);
                _unlockAllShipsBtnRect = { x: sbx, y: sby, w: sbw, h: iapBtnH };
                y += iapBtnH;
            }

            if (!(removeAdsOwned && allShipsOwned)) {
                y += restoreGap;
                const rbw = panW * 0.78, rby = y;
                const rbx = W / 2 - rbw / 2;
                ctx.fillStyle = 'rgba(15,18,40,0.72)';
                ctx.beginPath(); ctx.roundRect(rbx, rby, rbw, restoreH, 7); ctx.fill();
                ctx.strokeStyle = 'rgba(90,120,160,0.50)';
                ctx.lineWidth   = 1;
                ctx.beginPath(); ctx.roundRect(rbx, rby, rbw, restoreH, 7); ctx.stroke();
                ctx.font      = `${FS * 0.019}px 'Courier New',monospace`;
                ctx.fillStyle = 'rgba(180,200,240,0.92)';
                ctx.fillText(T.restorePurchases, W / 2, rby + restoreH / 2);
                _restoreBtnRect = { x: rbx, y: rby, w: rbw, h: restoreH };
                y += restoreH;
            }
        } else {
            ctx.font      = `${FS * 0.020}px 'Courier New',monospace`;
            ctx.fillStyle = 'rgba(150,160,200,0.70)';
            ctx.fillText(T.shopUnavailable, W / 2, y + emptyH / 2);
            y += emptyH;
        }
    }

    // Shard/stardust/coin explainer, opened via the small "i" button left of
    // SHIP/NAVE (_currencyInfoBtnRect, drawn above). One static
    // panel rather than four separate tooltips -- shards, stardust and the coin
    // legend are the one screen's worth of numbers that don't teach themselves by
    // playing (unlike coin effects, which read from look and result during a run),
    // so bundling them beats making a new player hunt down five tiny "i"s one at a
    // time. Opt-in (tap to open, tap outside to close, same as Shop/Settings) rather
    // than a forced hint -- see CLAUDE.md Onboarding for why an unprompted hint was
    // rejected here before.
    if (showCurrencyInfo) {
        ctx.fillStyle = 'rgba(0,0,12,0.88)';
        ctx.fillRect(0, 0, W, H);

        const panW = Math.min(W * 0.72, 460);
        // Bullet colour matches each item's own in-game colour (gold wallet, pale
        // stardust glint, the gold coin's own colour for the coin legend line, the
        // bomb coin's purple for the hazard line) so the dot itself is a second,
        // wordless cue.
        const rows = [
            { dot: 'rgba(255,225,110,1)', text: T.shardsInfo },
            { dot: 'rgba(200,210,255,1)', text: T.stardustInfo },
            { dot: 'rgba(255,224,64,1)',  text: T.coinsInfo },
            { dot: 'rgba(184,51,255,1)',  text: T.hazardsInfo },
        ];

        // Greedy wrap at whatever font is currently set on ctx. Tokenises CJK/
        // fullwidth characters one at a time (they carry no spaces to break on --
        // a plain split(' ') treated a whole ja/ko/zh sentence as a single
        // unbreakable "word" and let it run straight off the edge of the panel,
        // unclipped, over whatever sat behind it) while keeping Latin/Cyrillic/etc.
        // words whole and breaking only at spaces, same as before for those.
        const wrapTokenRe = /[　-鿿가-힣＀-￯]|[^\s　-鿿가-힣＀-￯]+|\s+/gu;
        const wrap = (text, maxW) => {
            const tokens = text.match(wrapTokenRe) || [text];
            const lines = [];
            let line = '';
            for (const tok of tokens) {
                if (/^\s+$/.test(tok)) {
                    if (line) line += tok;
                    continue;
                }
                const test = line + tok;
                if (line.trim() && ctx.measureText(test).width > maxW) {
                    lines.push(line.trimEnd());
                    line = tok;
                } else {
                    line = test;
                }
            }
            if (line.trim()) lines.push(line.trimEnd());
            return lines;
        };

        // Unlike the Shop panel above (fixed line count, so one linear shopScale
        // covers it), this panel wraps translated paragraphs -- line count per row
        // depends on the locale's string length, and shrinking the font reflows
        // wrapping too (smaller font = fewer, shorter-looking lines), so a single
        // linear scale can't be computed up front. Iterate the font scale down
        // instead, re-wrapping each try, until the nominal panel height clears the
        // screen-height cap or the shrink hits its floor (0.6x) -- short EN/DE text
        // fits at scale 1 in one pass; long locale strings settle a few steps down.
        let scale = 1, bodyFontSz, dotR2, padSide, textIndent, rowGap2, lineH, titleH, padTop, padBottom, wrappedRows, panH;
        for (let iter = 0; iter < 14; iter++) {
            bodyFontSz = FS * 0.020 * scale;
            ctx.font   = `${bodyFontSz}px 'Courier New',monospace`;
            dotR2      = bodyFontSz * 0.28;
            // Real side margin from the panel border to the dot -- previously the
            // dot sat almost flush against the left edge with no breathing room at
            // all. Mirrored on the right so the text column reads as centred inset,
            // not lopsided.
            padSide    = bodyFontSz * 1.1;
            // 4.4x dotR2 gap from dot to text, not 3.4x -- the dot sits at
            // padSide + dotR2 with its own radius eating into the gap, so the old
            // value left barely a hairline of space before the text (dot visibly
            // touching the first letter).
            textIndent = padSide + dotR2 * 4.4;
            rowGap2    = bodyFontSz * 0.9;
            lineH      = bodyFontSz * 1.35;
            const wrapWidth = panW - textIndent - padSide;
            wrappedRows = rows.map(r => wrap(r.text, wrapWidth));
            titleH    = FS * 0.045 * scale;
            padTop    = H * 0.065 * scale;
            padBottom = H * 0.05  * scale;
            let bodyH = 0;
            wrappedRows.forEach(lines => { bodyH += lines.length * lineH + rowGap2; });
            panH = padTop + titleH + bodyH + padBottom;
            if (panH <= H * 0.92 || scale <= 0.6) break;
            scale *= 0.92;
        }

        const panX = W / 2 - panW / 2, panY = H / 2 - panH / 2;
        _currencyInfoPanelRect = { x: panX, y: panY, w: panW, h: panH };

        ctx.fillStyle = 'rgba(12,14,30,0.95)';
        ctx.beginPath(); ctx.roundRect(panX, panY, panW, panH, 14); ctx.fill();
        ctx.strokeStyle = 'rgba(120,140,200,0.35)';
        ctx.lineWidth   = 1.5;
        ctx.beginPath(); ctx.roundRect(panX, panY, panW, panH, 14); ctx.stroke();

        ctx.textAlign   = 'center';
        ctx.font        = `bold ${titleH}px 'Courier New',monospace`;
        // Shrink to fit -- same reasoning as the death screen's SHARE/HOME/PLAY
        // AGAIN buttons: some locales run long enough to touch the panel's rounded
        // corners edge to edge with zero margin (Hindi measured 455px of 460px
        // available). Capped to the same side margin as the body text (padSide*2)
        // so title and paragraphs share one consistent inset.
        let titleFsz = titleH;
        const titleMaxW = panW - padSide * 2;
        const titleW = ctx.measureText(T.howItWorks).width;
        if (titleW > titleMaxW) {
            titleFsz = Math.max(titleFsz * titleMaxW / titleW, FS * 0.02);
            ctx.font = `bold ${titleFsz}px 'Courier New',monospace`;
        }
        ctx.fillStyle   = 'rgba(255,225,110,0.95)';
        ctx.fillText(T.howItWorks, W / 2, panY + padTop);

        ctx.textAlign = 'left';
        ctx.font      = `${bodyFontSz}px 'Courier New',monospace`;
        let ry        = panY + padTop + titleH + rowGap2 * 0.6;
        const textX   = panX + textIndent;
        wrappedRows.forEach((lines, i) => {
            // Dot centred on the first line's own vertical centre -- textBaseline is
            // 'middle' here (set once for the whole title-phase block above), so
            // ry already *is* line 1's centre. The old `- lineH * 0.32` assumed an
            // alphabetic baseline and floated every dot above-left of its text
            // instead of level with it (same class of bug the info button's "i" had).
            ctx.beginPath();
            ctx.arc(panX + padSide + dotR2, ry, dotR2, 0, Math.PI * 2);
            ctx.fillStyle = rows[i].dot;
            ctx.fill();

            ctx.fillStyle = 'rgba(220,225,245,0.92)';
            lines.forEach(line => {
                ctx.fillText(line, textX, ry);
                ry += lineH;
            });
            ry += rowGap2;
        });
        ctx.textAlign = 'center';
    }
}

function drawDeathScreen() {
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'center'; // was implicitly inherited via the now-removed
                                  // run-profile block's cleanup; set explicitly here
                                  // instead of relying on whatever the previous
                                  // frame happened to leave it as
    const a  = Math.min(1, deadT * 6.5);
    const sh = (blur, col = 'rgba(0,0,0,0.90)') => { ctx.shadowColor = col; ctx.shadowBlur = blur; };

    // Dark overlay
    ctx.fillStyle = `rgba(4,4,14,${a * 0.82})`;
    ctx.fillRect(0, 0, W, H);

    // Panel card backdrop. Margins were 0.07/0.07 on every side (14% of W and H spent
    // on empty margin, on top of the LC/RC columns' own inset from the panel edge) --
    // direct feedback that there was too much unused space top/left. Tightened to
    // 0.03/0.04; LC/RC shift outward by the same amount reclaimed on each side so the
    // content actually uses the extra room instead of just sitting in a bigger frame.
    sh(0);
    ctx.fillStyle = `rgba(6,8,22,${a * 0.64})`;
    ctx.beginPath();
    ctx.roundRect(W * 0.03, H * 0.04, W * 0.94, H * 0.78, 10);
    ctx.fill();
    // Soft glow on the border instead of a flat 1px line -- the rest of the game's
    // panels/buttons all carry a shadowBlur, so a bare stroke here was the one panel
    // that looked printed rather than lit.
    sh(10, `rgba(90,130,230,${a * 0.35})`);
    ctx.strokeStyle = `rgba(80,110,190,${a * 0.65})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    sh(0);

    // The run-profile backdrop (share.js drawRunProfile) used to render faintly
    // across the panel here -- removed per feedback that it read as a strange
    // background overlay (its lit/dark corridor fill sits as a box-shaped tint
    // right behind the WELT/HEUTE TOP text), not as texture.

    const LC = W * 0.2425;
    const RC = W * 0.71;

    // Vertical separator
    const sepGrd = ctx.createLinearGradient(0, H * 0.09, 0, H * 0.82);
    sepGrd.addColorStop(0,   `rgba(55,75,140,0)`);
    sepGrd.addColorStop(0.2, `rgba(70,95,170,${a * 0.50})`);
    sepGrd.addColorStop(0.8, `rgba(70,95,170,${a * 0.50})`);
    sepGrd.addColorStop(1,   `rgba(55,75,140,0)`);
    ctx.fillStyle = sepGrd;
    ctx.fillRect(W * 0.455, H * 0.07, 1, H * 0.76);

    // Left column: DEAD + score
    sh(5, `rgba(200,30,30,${a * 0.55})`);
    ctx.font      = `bold ${FS*0.095}px 'Courier New',monospace`;
    ctx.fillStyle = `rgba(255,70,70,${a})`;
    ctx.fillText(T.dead, LC, H * 0.185);

    // Accent underline
    sh(0);
    ctx.fillStyle = `rgba(255,80,80,${a * 0.75})`;
    const deadW = ctx.measureText(T.dead).width;
    ctx.fillRect(LC - deadW * 0.5, H * 0.252, deadW, 2);

    // Score with pulsing glow. Sized down from 0.140 so a 6-digit score (a long
    // run can clear 100000+ once bonusScore compounds via streaks/milestones)
    // still fits between the panel edge and the divider. At 0.140, "123456" at
    // the narrow reference device used elsewhere in this file (iPhone 12 mini
    // landscape, 812x375) measured ~352px against ~345px available -- a real
    // overflow, not a hypothetical one. 0.115 brings that to ~289px.
    // Any new record -- daily or all-time -- gets the same hue-cycling rainbow
    // glow as the title screen's LEVEL line (same gtime clock, same formula)
    // instead of a flat gold, and the label right under it shares the exact same
    // hue each frame so the two read as one glowing unit, not a coloured number
    // over a separately-coloured caption.
    const isRecord = (newBest || newDailyBest) && score > 0;
    const recordHue = (gtime * 24) % 360;
    const scorePulse = isRecord ? 18 + 5 * Math.sin(deadT * 3.5) : 4;
    let scoreGlow, scoreFill;
    if (isRecord) {
        scoreGlow = `hsla(${recordHue}, 90%, 60%, ${a * 0.75})`;
        scoreFill = `hsla(${recordHue}, 85%, 72%, ${a})`;
    } else {
        scoreGlow = 'rgba(0,0,0,0.90)';
        scoreFill = `rgba(225,240,255,${a})`;
    }
    sh(scorePulse, scoreGlow);
    ctx.font      = `bold ${FS*0.115}px 'Courier New',monospace`;
    ctx.fillStyle = scoreFill;
    ctx.fillText(score, LC, H * 0.395);

    // Label sits directly under the score now (closer than before -- 0.495, not
    // 0.545, per explicit request), with RUNS moved below it instead of wedged in
    // between -- score and "what just happened" read as one beat, RUNS is a
    // separate, cooler stat.
    if (newBest && score > 0) {
        sh(6, `hsla(${recordHue}, 90%, 60%, ${a * 0.7})`);
        ctx.font      = `bold ${FS*0.036}px 'Courier New',monospace`;
        ctx.fillStyle = `hsla(${recordHue}, 90%, 78%, ${a})`;
        ctx.fillText(T.newBest, LC, H * 0.495);
    } else if (newDailyBest && score > 0) {
        sh(6, `hsla(${recordHue}, 90%, 60%, ${a * 0.7})`);
        ctx.font      = `bold ${FS*0.036}px 'Courier New',monospace`;
        ctx.fillStyle = `hsla(${recordHue}, 90%, 78%, ${a})`;
        ctx.fillText(T.newDailyBest, LC, H * 0.495 + 5);
        // No "previous best" sub-line here (there used to be one): "new daily best!"
        // already implies it beat the old number, and the H*0.78 slot further below
        // is shared with the skin-unlock/mastery/shards line -- whichever of those
        // draws there, the sub-line kept colliding with it on short landscape phones
        // (H well under 600, where FS = sqrt(W*H) still stays large), first with the
        // mastery banner ("PEARL LV UP 1"), then with the shards line -- a new report
        // each time the slot below happened to hold something else. Dropping the
        // redundant line removes the whole collision class instead of chasing it
        // banner by banner.
    } else if (best > 0) {
        sh(4, `rgba(60,90,180,${a * 0.45})`);
        ctx.font      = `bold ${FS*0.026}px 'Courier New',monospace`;
        ctx.fillStyle = `rgba(175,205,255,${a * 0.95})`;
        ctx.fillText(`${T.best}  ${best}`, LC, H * 0.545);
    }

    sh(4, `rgba(60,90,180,${a * 0.45})`);
    ctx.font      = `bold ${FS*0.026}px 'Courier New',monospace`;
    ctx.fillStyle = `rgba(175,205,255,${a * 0.95})`;
    ctx.fillText(`${T.runs} ${dailyRuns}`, LC, H * 0.613);

    // Skin-unlock banner (+ shards line below/beside it) sits in the left column's
    // empty space below the best/streak line; the right column is already packed
    // (top5 + stats) and collides with the HOME/PLAY AGAIN buttons if it
    // lands there -- confirmed by measuring text width at common viewport sizes, so
    // don't move this back to the right column.
    // These used to be three separate `if` branches (ship unlock / mastery-up /
    // shards) all targeting H*0.78 and all suppressing each other by priority, so a
    // good run could earn a ship unlock, a mastery level *and* a shard payout and be
    // shown exactly one of them -- the two most motivating outcomes in the game
    // hidden by draw order. They were then joined onto one shared, shrink-to-fit
    // line -- but a ship name plus a full shard line is wide enough that the combined
    // text could still overflow past the shrink floor, reading as a broken/misaligned
    // version of the plain shard-only line one row above it. Each part now gets its
    // own line, at the plain single-line case's usual size, when both are present.
    {
        let bannerLine = null, bannerClr = null;
        // Ship unlock still outranks a mastery level-up when both land in one run:
        // both are ship-coloured and showing two ship banners at once reads as a
        // glitch, not a double reward.
        if (skinUnlockIdx >= 0) {
            const sk = SKINS[skinUnlockIdx];
            bannerLine = `${sk.name} ${T.unlocked}`;
            bannerClr = sk.shadow;
        } else if (skinMasteryUpIdx >= 0) {
            const sk = SKINS[skinMasteryUpIdx];
            bannerLine = `${sk.name} ${T.masteryUp} ${masteryLevel(skinMasteryUpIdx)}`;
            bannerClr = sk.shadow;
        }

        let shardLine = null;
        if (runCoins > 0) {
            // The banked total (`shards`) has no upper bound (grinding never stops
            // once every ship is owned), so past 10000 it's shown rounded to the
            // nearest thousand ("13k") rather than full digits.
            const shardsDisp = shards >= 10000 ? Math.round(shards / 1000) + 'k' : shards;
            shardLine = `+${runShardsBanked}\u200A\u29eb \u00b7 ${shardsDisp}\u200A\u29eb`;
            // Used to be dropped whenever a banner shared the line with it (the first
            // thing cut when space was tight) -- now that the shard line always gets
            // its own row with the same room as the shard-only case, it can stay.
            if (runShardsBanked < runCoins) shardLine += `  (${T.dailyCap})`;
        }

        // Shrink an individual line to fit rather than overflow. The binding
        // constraint is the panel's left edge, not the divider: this line is centred
        // on LC (W*0.2425) and the panel starts at W*0.03, so there is only ~0.17*W
        // of half-width available on the left even though the divider at W*0.455 is
        // further away. Measured this way across all 15 languages.
        const availW = (LC - W * 0.045) * 2;
        const drawFitLine = (text, y, fillClr, glowClr) => {
            let fsz = FS * 0.024;
            ctx.font = `bold ${fsz}px 'Courier New',monospace`;
            const lineW = ctx.measureText(text).width;
            if (lineW > availW) {
                fsz = Math.max(fsz * availW / lineW, FS * 0.014); // legibility floor
                ctx.font = `bold ${fsz}px 'Courier New',monospace`;
            }
            ctx.fillStyle   = fillClr;
            ctx.shadowColor = glowClr;
            ctx.shadowBlur  = 8;
            ctx.fillText(text, LC, y);
            ctx.shadowBlur  = 0;
            return fsz;
        };

        const shardClr = `rgba(255,225,110,${a * 0.95})`;
        const shardGlow = `rgba(255,205,60,${a * 0.62})`;
        if (bannerLine && shardLine) {
            // Gap between the two lines is derived from the banner's own rendered
            // size (not a fixed H-fraction) so it can't desync on a short-but-wide
            // screen the way fixed-fraction gaps did before the death screen's
            // score/BEST cascade fix -- see that fix's comment further up.
            const [br, bg, bb] = bannerClr;
            const fsz1 = drawFitLine(bannerLine, H * 0.688,
                `rgba(${br},${bg},${bb},${a * 0.95})`, `rgba(${br},${bg},${bb},${a * 0.62})`);
            drawFitLine(shardLine, H * 0.688 + fsz1 * 1.35, shardClr, shardGlow);
        } else if (bannerLine) {
            const [br, bg, bb] = bannerClr;
            drawFitLine(bannerLine, H * 0.705, `rgba(${br},${bg},${bb},${a * 0.95})`, `rgba(${br},${bg},${bb},${a * 0.62})`);
        } else if (shardLine) {
            drawFitLine(shardLine, H * 0.705, shardClr, shardGlow);
        }
    }

    // Right column: world rank (when known) + today's local list + stats
    let ry = H * 0.155;

    // The moment a player cares about their standing is the instant they die, and
    // until now this column spent its best space on a local top-5 of the player's
    // *own* scores from today -- the least emotionally charged data available -- while
    // the real leaderboard sat behind a title-screen button they only see once
    // they've already stopped playing. When the native layer has reported a rank
    // (state.js worldRank), it takes the top of the column and the local list shrinks
    // to 3 rows to pay for it. With no rank available (offline, no Game Center /
    // Play Games session, or the first submit still in flight) the old 5-row layout
    // is kept exactly as it was.
    const hasRank = worldRank !== null && worldRank > 0;
    const LB_N    = hasRank ? 3 : 5;
    const LB_STEP = hasRank ? H * 0.080 : H * 0.095;

    if (hasRank) {
        const rankStr  = worldRankTotal > 0
            ? `#${worldRank.toLocaleString()} / ${worldRankTotal.toLocaleString()}`
            : `#${worldRank.toLocaleString()}`;
        sh(2);
        ctx.font      = `bold ${FS*0.022}px 'Courier New',monospace`;
        ctx.fillStyle = `rgba(170,195,240,${a * 0.90})`;
        ctx.fillText(T.worldRank, RC, ry - 4);
        ry += H * 0.058;

        // Shrink to fit rather than overflow: rank strings grow with the player
        // base ("#128,455 / 2,100,388" is a lot wider than "#42 / 900"), and this
        // column is bounded by the panel edge on one side and the divider on the
        // other.
        let rankFsz = FS * 0.046;
        ctx.font = `bold ${rankFsz}px 'Courier New',monospace`;
        const rankAvailW = Math.min(RC - W * 0.475, W * 0.955 - RC) * 2;
        const rankW = ctx.measureText(rankStr).width;
        if (rankW > rankAvailW) {
            rankFsz = Math.max(rankFsz * rankAvailW / rankW, FS * 0.024);
            ctx.font = `bold ${rankFsz}px 'Courier New',monospace`;
        }
        // Orange, not gold -- yellow/gold is reserved for shard figures
        // elsewhere in the game, and the world rank isn't one.
        sh(6, `rgba(255,130,40,${a*0.45})`);
        ctx.fillStyle = `rgba(255,160,80,${a})`;
        ctx.fillText(rankStr, RC, ry);
        ry += H * 0.052;

        // Rank movement since the previous submit -- this is what turns a standing
        // into a loop rather than a stat, so it gets the colour treatment.
        if (worldRankDelta !== 0) {
            sh(3);
            ctx.font      = `bold ${FS*0.024}px 'Courier New',monospace`;
            ctx.fillStyle = worldRankDelta > 0
                ? `rgba(140,230,140,${a})`
                : `rgba(220,140,140,${a})`;
            ctx.fillText(`${worldRankDelta > 0 ? '\u25B2' : '\u25BC'} ${Math.abs(worldRankDelta).toLocaleString()}`, RC, ry);
        }
        ry += H * 0.062;
    }

    // Left-align the rank/score column to a shared start X instead of centering each
    // line independently -- centering per-line let the numbers drift left/right with
    // digit count so they didn't read as a column. The column itself is still
    // centered as a block around RC (measured against the widest of the possible
    // lines, in whichever font that line would actually use).
    let listW = 0;
    for (let i = 0; i < LB_N; i++) {
        const entry = top5[i];
        ctx.font = entry !== undefined ? `bold ${FS*0.040}px 'Courier New',monospace` : `${FS*0.032}px 'Courier New',monospace`;
        listW = Math.max(listW, ctx.measureText(entry !== undefined ? `#${i + 1}  ${entry}` : `#${i + 1}  -`).width);
    }
    const listX = RC - listW / 2;
    ctx.textAlign = 'left';

    sh(4, `rgba(60,90,180,${a * 0.45})`);
    ctx.font      = `bold ${FS*0.024}px 'Courier New',monospace`;
    ctx.fillStyle = `rgba(180,205,255,${a * 0.90})`;
    // T.todayTop, not the old T.top5: this list is wiped at the UTC day boundary
    // (lifecycle.js), so labelling it "TOP 5" made it look like lost data every
    // morning. The label now says what it actually is.
    ctx.fillText(T.todayTop, listX, ry);
    ry += H * 0.072;

    const myRank = top5.findIndex(s => s === score);
    for (let i = 0; i < LB_N; i++) {
        const entry = top5[i];
        const isMe  = i === myRank && entry === score;
        if (entry !== undefined) {
            sh(isMe ? (newBest ? 10 : 4) : 2,
               isMe && newBest ? `rgba(255,190,0,${a*0.7})` : 'rgba(0,0,0,0.90)');
            ctx.font      = `bold ${FS*0.040}px 'Courier New',monospace`;
            ctx.fillStyle = isMe
                ? (newBest ? `rgba(255,225,65,${a})` : `rgba(210,235,255,${a})`)
                : `rgba(175,200,240,${a * 0.90})`;
            ctx.fillText(`#${i + 1}  ${entry}`, listX, ry);
        } else {
            sh(2);
            ctx.font      = `${FS*0.032}px 'Courier New',monospace`;
            ctx.fillStyle = `rgba(100,120,165,${a * 0.55})`;
            ctx.fillText(`#${i + 1}  -`, listX, ry);
        }
        ry += LB_STEP;
    }
    ctx.textAlign = 'center'; // restore -- stats/buttons below expect centered text

    // A "+264 vs. last" line used to sit here (score minus prevRunScore). Dropped:
    // it pushed the stats block down and widened with score magnitude/diff sign
    // unpredictably, so it was the one line in this column liable to bump into
    // neighbouring rows on a real device, for a number that's just this run's score
    // restated as a delta -- low value for the layout risk it carried.

    {
        // Each stat gets its own colour instead of one flat grey-blue line -- the
        // run's actual highlights (a good combo, a close call survived) were
        // reading as filler text under the flashier score/rank numbers above.
        // Gold matches the reward/shard theme used everywhere else in the game,
        // and the near-miss cyan and combo orange are new but distinct from each
        // other.
        //
        // Two lines, not one: run-total counts (powerups, near misses) on the first,
        // run-highlight stats (combo) on the second -- four parts packed onto one
        // row read as a cramped data dump.
        // Default (non-yellow) colour -- yellow/gold is reserved for shard figures
        // elsewhere in the game, and a powerup count isn't one.
        const line1 = [{ text: `${runCoins} ${runCoins !== 1 ? T.powerups : T.powerup}`, clr: [175, 205, 255] }];
        if (runNearMisses > 0) line1.push({ text: `${runNearMisses} ${T.close}`, clr: [110, 210, 255] });
        const line2 = [];
        if (runMaxCombo > 1) line2.push({ text: `x${runMaxCombo} ${T.combo}`, clr: [255, 150, 110] });
        // The ghost target (T.ghost/ghostScore) used to also appear here, but the
        // score it names is just the day's best, already shown in the left column
        // -- redundant, so it was dropped from the death screen.

        // Extra breathing room before this block -- it used to sit right under the
        // top5 block with no more gap than any other row in that list, which read
        // as one more line of the same table rather than its own moment.
        ry += H * 0.025 - 4;
        ctx.font = `bold ${FS*0.023}px 'Courier New',monospace`;
        // Dot separator between parts, matching the shard banner's own "+X * Y"
        // format (src/draw.js's shardLine, ` · `) instead of a blank gap.
        const sep  = ' · ';
        const sepW = ctx.measureText(sep).width;
        const drawStatLine = (parts, y) => {
            if (!parts.length) return;
            const widths = parts.map(p => ctx.measureText(p.text).width);
            const totalW = widths.reduce((s, w) => s + w, 0) + sepW * (parts.length - 1);
            ctx.textAlign = 'left';
            let sx = RC - totalW / 2;
            parts.forEach((p, i) => {
                const [r, g, b] = p.clr;
                sh(4, `rgba(${r},${g},${b},${a * 0.45})`);
                ctx.fillStyle = `rgba(${r},${g},${b},${a * 0.92})`;
                ctx.fillText(p.text, sx, y);
                sx += widths[i];
                if (i < parts.length - 1) {
                    sh(0);
                    ctx.fillStyle = `rgba(140,155,190,${a * 0.55})`;
                    ctx.fillText(sep, sx, y);
                    sx += sepW;
                }
            });
            sh(0);
            ctx.textAlign = 'center';
        };
        drawStatLine(line1, ry);
        if (line2.length) {
            ry += H * 0.048;
            drawStatLine(line2, ry);
        }
        ry += H * 0.088;
    }

    // Bottom row: HOME | (SHARE) | PLAY AGAIN, centered as a group. SHARE only
    // appears on a run actually worth showing someone (share.js shareWorthy) and
    // only where there's somewhere to send it (shareAvailable) -- a share button on
    // every death is a nag, on a personal best it's a reward. The row re-centers
    // around whichever buttons are present rather than leaving a gap.
    if (deadT > 0.75) {
        const b      = Math.min(1, (deadT - 0.75) * 6);
        const botY   = H * 0.905;
        const btnH   = H * 0.13;
        const showShare = shareWorthy() && shareAvailable();
        const btnW   = showShare ? W * 0.155 : W * 0.17;
        const gap    = W * 0.035;
        const nBtn   = showShare ? 3 : 2;
        const rowW   = nBtn * btnW + (nBtn - 1) * gap;
        let   bx     = W * 0.50 - rowW * 0.5;
        const homeCX = bx + btnW * 0.5;  bx += btnW + gap;
        const shareCX = showShare ? bx + btnW * 0.5 : 0;
        if (showShare) bx += btnW + gap;
        const playCX = bx + btnW * 0.5;

        // HOME button. Rounded corners now, matching every other button in the
        // game (title screen, settings panel) -- this row was the one place still
        // drawing sharp-cornered fillRect/strokeRect boxes, which read as flat and
        // out of place next to the rest of the UI's soft-cornered, glowing style.
        ctx.font = `bold ${FS*0.028}px 'Courier New',monospace`;
        const homeX = homeCX - btnW * 0.5, homeY = botY - btnH * 0.5;
        _homeBtnRect = { x: homeX, y: homeY, w: btnW, h: btnH };
        sh(5, `rgba(80,105,180,${b * 0.35})`);
        ctx.fillStyle = `rgba(18,24,44,${b * 0.90})`;
        ctx.beginPath(); ctx.roundRect(homeX, homeY, btnW, btnH, 8); ctx.fill();
        ctx.strokeStyle = `rgba(80,105,180,${b * 0.70})`;
        ctx.lineWidth   = 1;
        ctx.beginPath(); ctx.roundRect(homeX, homeY, btnW, btnH, 8); ctx.stroke();
        // Shrink to fit: same reasoning as SHARE below -- some locales run much
        // longer than English ("JOGAR DE NOVO" for PLAY AGAIN, "AJUSTES"-style
        // words for HOME) and this row's buttons never had SHARE's headroom check.
        let homeFsz = FS * 0.028;
        const homeW = ctx.measureText(T.home).width;
        if (homeW > btnW * 0.86) {
            homeFsz = Math.max(homeFsz * (btnW * 0.86) / homeW, FS * 0.015);
            ctx.font = `bold ${homeFsz}px 'Courier New',monospace`;
        }
        sh(2); ctx.fillStyle = `rgba(130,155,230,${b * 0.90})`;
        ctx.fillText(T.home, homeCX, botY);

        // SHARE button -- gold, matching the shard/personal-best treatment used
        // everywhere else for "this was a good run", so it reads as a reward rather
        // than a third piece of navigation.
        _shareBtnRect = null;
        if (showShare) {
            const shareX = shareCX - btnW * 0.5, shareY = botY - btnH * 0.5;
            _shareBtnRect = { x: shareX, y: shareY, w: btnW, h: btnH };
            sh(6, `rgba(255,190,0,${b * 0.45})`);
            ctx.fillStyle = `rgba(42,32,10,${b * 0.90})`;
            ctx.beginPath(); ctx.roundRect(shareX, shareY, btnW, btnH, 8); ctx.fill();
            ctx.strokeStyle = `rgba(255,205,80,${b * 0.80})`;
            ctx.lineWidth   = 1.5;
            ctx.beginPath(); ctx.roundRect(shareX, shareY, btnW, btnH, 8); ctx.stroke();
            // Shrink to fit: SHARE is one short word in English but a long one in
            // several locales (COMPARTILHAR, ПОДЕЛИТЬСЯ), and this button is the
            // narrowest of the three.
            let shFsz = FS * 0.028;
            ctx.font = `bold ${shFsz}px 'Courier New',monospace`;
            const shW = ctx.measureText(T.share).width;
            if (shW > btnW * 0.86) {
                shFsz = Math.max(shFsz * (btnW * 0.86) / shW, FS * 0.015);
                ctx.font = `bold ${shFsz}px 'Courier New',monospace`;
            }
            sh(5, `rgba(255,200,60,${b * 0.55})`);
            ctx.fillStyle = `rgba(255,228,130,${b * 0.95})`;
            ctx.fillText(T.share, shareCX, botY);
            ctx.font = `bold ${FS*0.028}px 'Courier New',monospace`;
        }

        // PLAY AGAIN button
        ctx.font = `bold ${FS*0.028}px 'Courier New',monospace`;
        const playX = playCX - btnW * 0.5, playY = botY - btnH * 0.5;
        _playBtnRect = { x: playX, y: playY, w: btnW, h: btnH };
        sh(6, `rgba(80,120,255,${b * 0.55})`);
        ctx.fillStyle = `rgba(16,28,65,${b * 0.90})`;
        ctx.beginPath(); ctx.roundRect(playX, playY, btnW, btnH, 8); ctx.fill();
        ctx.strokeStyle = `rgba(110,150,255,${b * 0.85})`;
        ctx.lineWidth   = 1.5;
        ctx.beginPath(); ctx.roundRect(playX, playY, btnW, btnH, 8); ctx.stroke();
        // Shrink to fit -- PLAY AGAIN's translations run long in several locales
        // (JOGAR DE NOVO, TEKRAR OYNA, فيها مجدداً), same fix as SHARE/HOME above.
        let playFsz = FS * 0.028;
        const playW = ctx.measureText(T.playAgain).width;
        if (playW > btnW * 0.86) {
            playFsz = Math.max(playFsz * (btnW * 0.86) / playW, FS * 0.015);
            ctx.font = `bold ${playFsz}px 'Courier New',monospace`;
        }
        sh(6, `rgba(100,150,255,${b * 0.60})`);
        ctx.fillStyle   = `rgba(180,210,255,${b * 0.95})`;
        ctx.fillText(T.playAgain, playCX, botY);
    }
}

function draw() {
    drawWorld();
    drawHUD();
    if (phase === 'title') drawTitleScreen();
    if (phase === 'dead')  drawDeathScreen();
}
