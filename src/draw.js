// ── Theme ─────────────────────────────────────────────────────────────
// Three colour zones interpolated smoothly via _prog (0->1):
// blue/purple (0) -> lava/orange (0.5) -> neon green (1)

function getTheme() {
    const t = _prog;
    const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    if (t < 0.5) {
        return {
            bg:       lerpClr([4,4,10],     [10,5,2],     u),
            wall:     lerpClr([23,16,42],   [30,12,6],    u),
            stal:     lerpClr([29,19,53],   [40,15,8],    u),
            stalEdge: lerpClr([185,95,255], [255,120,30], u),
            wallBase: lerpClr([155,75,255], [255,100,30], u),
        };
    } else {
        return {
            bg:       lerpClr([10,5,2],     [2,10,6],     u),
            wall:     lerpClr([30,12,6],    [6,22,14],    u),
            stal:     lerpClr([40,15,8],    [8,30,18],    u),
            stalEdge: lerpClr([255,120,30], [30,255,120], u),
            wallBase: lerpClr([255,100,30], [30,255,120], u),
        };
    }
}

function drawCoinIcon(cx, cy, type, r) {
    const isBlu = type === 'blue', isRed = type === 'red', isGrn = type === 'green', isOrng = type === 'orange';
    const bodyClr = isBlu ? '#4dd9ff' : isRed ? '#ff4444' : isGrn ? '#44ff88' : isOrng ? '#ff5500' : '#ffe040';
    const [gr, gg, gb] = isBlu ? [60,200,255] : isRed ? [255,60,60] : isGrn ? [50,255,120] : isOrng ? [255,85,0] : [255,225,50];
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

function draw() {
    const ox = shake > 0 ? (Math.random()-0.5)*shake : 0;
    const oy = shake > 0 ? (Math.random()-0.5)*shake : 0;
    ctx.save();
    ctx.translate(ox, oy);

    const theme = getTheme();
    document.body.style.background = rgb(theme.bg);
    ctx.fillStyle = rgb(theme.bg);
    ctx.fillRect(-20, -20, W+40, H+40);

    // Wall arrays
    const topArr = [], botArr = [], xs = [];
    for (let sx = -RSTEP; sx <= W + RSTEP*2; sx += RSTEP) {
        const b = boundsAt(scrollX + sx);
        xs.push(sx); topArr.push(b.top); botArr.push(b.bot);
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

        // Shared path helper (reused for fill clip and doesn't need redrawing)
        const traceStal = () => {
            ctx.moveTo(sx - hw_base, canvasBase);
            ctx.lineTo(sx + hw_base, canvasBase);
            ctx.lineTo(sx + hw_base, bRwall);
            ctx.bezierCurveTo(sx + hw*0.70, bRwall + dir*len*0.38, sx + hw*0.12, tipY - dir*len*0.18, sx, tipY);
            ctx.bezierCurveTo(sx - hw*0.12, tipY - dir*len*0.18, sx - hw*0.70, bLwall + dir*len*0.38, sx - hw_base, bLwall);
            ctx.lineTo(sx - hw_base, canvasBase);
            ctx.closePath();
        };

        // Base fill
        ctx.beginPath(); traceStal();
        ctx.fillStyle = stalGrd;
        ctx.fill();

        // Inner glow: clip to shape, paint radial spot for mineral depth/luminescence
        ctx.save();
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

        // Edge glow with soft shadow halo
        ctx.shadowBlur  = 11;
        ctx.shadowColor = rgb(theme.stalEdge, 0.48);
        ctx.beginPath();
        ctx.moveTo(sx - hw_base, bLwall);
        ctx.bezierCurveTo(sx - hw*0.70, bLwall + dir*len*0.38, sx - hw*0.12, tipY - dir*len*0.18, sx, tipY);
        ctx.bezierCurveTo(sx + hw*0.12, tipY - dir*len*0.18, sx + hw*0.70, bRwall + dir*len*0.38, sx + hw_base, bRwall);
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
    ctx.beginPath();
    ctx.moveTo(xs[0], -2);
    for (let i = 0; i < n; i++) ctx.lineTo(xs[i], topArr[i]);
    ctx.lineTo(xs[n-1], -2);
    ctx.closePath();
    const topGrd = ctx.createLinearGradient(0, -2, 0, topMax);
    topGrd.addColorStop(0,    rgb(theme.wall));
    topGrd.addColorStop(0.72, rgb(theme.wall));
    topGrd.addColorStop(1,    rgb(edgeClrInner));
    ctx.fillStyle = topGrd;
    ctx.fill();

    // Bottom wall - accent-tinted at corridor edge, dark at canvas bottom
    ctx.beginPath();
    ctx.moveTo(xs[0], H+2);
    for (let i = 0; i < n; i++) ctx.lineTo(xs[i], botArr[i]);
    ctx.lineTo(xs[n-1], H+2);
    ctx.closePath();
    const botGrd = ctx.createLinearGradient(0, botMin, 0, H+2);
    botGrd.addColorStop(0,    rgb(edgeClrInner));
    botGrd.addColorStop(0.28, rgb(theme.wall));
    botGrd.addColorStop(1,    rgb(theme.wall));
    ctx.fillStyle = botGrd;
    ctx.fill();

    // Bullets
    drawBullets();

    // Wall edge glow - shifts from theme base -> cyan when bonus is active
    const bonusT  = Math.min(gapBonus / GAP_BONUS_MAX, 1);
    const wb      = theme.wallBase;
    const edgeR   = Math.round(lerp(wb[0],  40, bonusT));
    const edgeG   = Math.round(lerp(wb[1], 210, bonusT));
    const edgeB   = Math.round(lerp(wb[2], 255, bonusT));
    const edgeClr = `rgba(${edgeR},${edgeG},${edgeB},0.55)`;

    ctx.strokeStyle = edgeClr; ctx.lineWidth = 2;
    let brk = true;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        const wx = scrollX + xs[i];
        const blocked = stalactites.some(s => s.isTop && Math.abs(wx - s.wx) <= s.width / 2 - RSTEP);
        if (blocked) { brk = true; continue; }
        if (brk) { ctx.moveTo(xs[i], topArr[i]); brk = false; }
        else      ctx.lineTo(xs[i], topArr[i]);
    }
    ctx.stroke();

    brk = true;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        const wx = scrollX + xs[i];
        const blocked = stalactites.some(s => !s.isTop && Math.abs(wx - s.wx) <= s.width / 2 - RSTEP);
        if (blocked) { brk = true; continue; }
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

        // Spikes (8 directions)
        ctx.strokeStyle = 'rgba(200,60,40,0.80)';
        ctx.lineWidth   = 1.4;
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(sx + Math.cos(a) * MINE_R * 0.85, my + Math.sin(a) * MINE_R * 0.85);
            ctx.lineTo(sx + Math.cos(a) * (MINE_R * 1.65), my + Math.sin(a) * (MINE_R * 1.65));
            ctx.stroke();
        }

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

        const isBlu = coin.type === 'blue', isRed = coin.type === 'red', isGrn = coin.type === 'green', isOrng = coin.type === 'orange';
        const bodyClr = isBlu ? '#4dd9ff' : isRed ? '#ff4444' : isGrn ? '#44ff88' : isOrng ? '#ff5500' : '#ffe040';
        const [gr, gg, gb] = isBlu ? [60,200,255] : isRed ? [255,60,60] : isGrn ? [50,255,120] : isOrng ? [255,85,0] : [255,225,50];
        const darkR = Math.floor(gr * 0.28), darkG = Math.floor(gg * 0.28), darkB = Math.floor(gb * 0.28);

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

        // 8 sparkle rays: 4 long + 4 short, each pulsing independently
        for (let i = 0; i < 8; i++) {
            const long = i % 2 === 0;
            const rp   = 0.72 + 0.28 * Math.sin(gtime * 3.2 + i * 1.1 + coin.wx * 0.005);
            ctx.save();
            ctx.rotate(i * Math.PI * 0.25);
            ctx.beginPath();
            ctx.moveTo(0, -(r * 1.50));
            ctx.lineTo(0, -(r * (long ? 2.75 : 1.90) * rp));
            ctx.strokeStyle = `rgba(${gr},${gg},${gb},${long ? 0.88 : 0.42})`;
            ctx.lineWidth   = long ? 1.5 : 0.8;
            ctx.shadowColor = `rgba(${gr},${gg},${gb},0.65)`;
            ctx.shadowBlur  = long ? 3 : 1;
            ctx.stroke();
            ctx.shadowBlur  = 0;
            ctx.restore();
        }

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

        ctx.restore();
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
    // Thruster particle trail (drawn before player so it appears behind)
    for (const p of thrustParts) {
        const a = Math.max(p.life, 0);
        const blue = p.h > 150;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(p.r * p.life, 0.4), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.h},100%,${blue ? 68 : 84}%,${a})`;
        ctx.fill();
    }

    // Speed lines - horizontal streaks driven by vertical velocity OR scroll speed
    if (phase === 'play') {
        const vyFrac    = Math.max(0, (Math.abs(vy) - 300) / (MAX_VY - 300));
        const actualSpd = scrollSpd() * (slowTime > 0 ? 0.60 : 1.0);
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

    // Player trail
    {
        const sk = SKINS[activeSkin] || SKINS[0];
        const [sr, sg, sb] = sk.shadow;
        for (let i = 0; i < trailY.length; i++) {
            const frac = i / trailY.length, off = (trailY.length-1-i)*5;
            ctx.beginPath();
            ctx.arc(PX-off, trailY[i], PR*frac*0.65, 0, Math.PI*2);
            ctx.fillStyle = `rgba(${sr},${sg},${sb},${frac*0.26})`;
            ctx.fill();
        }
    }

    // Shield rings (one per charge)
    if (shieldCount > 0 && phase === 'play') {
        const sp = 1 + 0.22 * Math.sin(gtime * 8);
        for (let i = 0; i < shieldCount; i++) {
            ctx.beginPath();
            ctx.arc(PX, py, PR * (2.0 + 0.28 * sp + i * 0.7), 0, Math.PI*2);
            ctx.strokeStyle = `rgba(255,80,80,${Math.max(0.75 - i * 0.18, 0.35) + 0.20 * sp})`;
            ctx.lineWidth   = 2.5;
            ctx.shadowColor = 'rgba(255,50,50,0.85)';
            ctx.shadowBlur  = 12;
            ctx.stroke();
            ctx.shadowBlur  = 0;
        }
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

    // Player
    if (phase !== 'dead' || deadT < 0.18) {
        const sk = SKINS[activeSkin] || SKINS[0];
        const [sr, sg, sb] = sk.shadow;
        const pitchAngle = shipPitch;
        ctx.save();
        ctx.translate(PX, py);
        ctx.rotate(pitchAngle);
        ctx.translate(-PX, -py);

        if ((holding || startRamp < 1) && phase === 'play') {
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

        drawShip(PX, py, PR, phase === 'dead' ? '#ff4040' : sk.color, sr, sg, sb, 20);
        ctx.restore();
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

    // ── HUD ───────────────────────────────────────────────────────────
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';

    if (phase === 'play') {
        const nearPB = best > 0 && score >= best - 5;
        ctx.font        = `bold ${FS*0.085}px 'Courier New',monospace`;
        ctx.fillStyle   = nearPB ? 'rgba(255,230,80,0.96)' : 'rgba(215,235,255,0.96)';
        ctx.shadowColor = nearPB ? 'rgba(255,200,40,0.80)' : 'rgba(0,0,0,0.85)';
        ctx.shadowBlur  = nearPB ? 18 : 5;
        ctx.fillText(score, W/2, H*0.03);
        ctx.shadowBlur  = 0;
    }

    if (best > 0 && phase === 'play') {
        ctx.font        = `${FS*0.025}px 'Courier New',monospace`;
        ctx.fillStyle   = 'rgba(170,195,255,0.90)';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur  = 4;
        ctx.fillText(`${T.best}  ${best}`, W/2, H*0.145);
        ctx.shadowBlur  = 0;
    }

    // Next skin nudge - faint pulsing hint when within 20 pts of unlock
    if (phase === 'play') {
        const nextSkin = SKINS.find((sk, i) => sk.req && !(unlockedSkins & (1 << i)));
        if (nextSkin && score < nextSkin.req && nextSkin.req - score <= 20) {
            const [sr, sg, sb] = nextSkin.shadow;
            const pulse = 0.28 + 0.18 * Math.sin(gtime * 2.8);
            ctx.font      = `${FS*0.020}px 'Courier New',monospace`;
            ctx.fillStyle = `rgba(${sr},${sg},${sb},${pulse})`;
            ctx.fillText(`${nextSkin.req - score} ${T.toSkin} ${nextSkin.name}`, W/2, H*0.185);
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
        const ratio = Math.min(slowTime / 4.0, 1.0);
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

    if (phase === 'title') {
        // In landscape (W > H*1.15) use a two-column layout to avoid vertical crowding.
        // In portrait keep a centered stack but anchor the skin picker to the bottom.
        const LAND   = W > H * 1.15;
        const titleX = LAND ? W * 0.28 : W / 2;
        const infoX  = LAND ? W * 0.73 : W / 2;
        const a      = Math.min(1, titleT * 4);
        const sh     = (blur, col = 'rgba(0,0,0,0.90)') => { ctx.shadowColor = col; ctx.shadowBlur = blur; };

        ctx.textBaseline = 'middle';

        // Darken the scene so the card pops
        ctx.fillStyle = `rgba(4,4,14,${a * 0.55})`;
        ctx.fillRect(0, 0, W, H);

        const logoY = LAND ? H * 0.33 : H/2 - H*0.12;

        // Gradient separator between columns (landscape only)
        if (LAND) {
            const sepGrd = ctx.createLinearGradient(0, H * 0.10, 0, H * 0.90);
            sepGrd.addColorStop(0,   `rgba(55,75,140,0)`);
            sepGrd.addColorStop(0.2, `rgba(80,110,200,${a * 0.40})`);
            sepGrd.addColorStop(0.8, `rgba(80,110,200,${a * 0.40})`);
            sepGrd.addColorStop(1,   `rgba(55,75,140,0)`);
            ctx.fillStyle = sepGrd;
            ctx.fillRect(W * 0.49, H * 0.08, 1, H * 0.84);
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
        const holeCX = lx + charW / 2;
        const holeR  = charW * 0.42;
        const uHalfW = holeR * 0.95;
        const uTopY  = logoY - holeR * 1.15;
        const uSideY = logoY + holeR * 0.30;
        const uDipY  = logoY + holeR * 0.74;
        const buildUPath = () => {
            ctx.beginPath();
            ctx.moveTo(holeCX - uHalfW, uTopY);
            ctx.lineTo(holeCX - uHalfW, uSideY);
            ctx.quadraticCurveTo(holeCX - uHalfW, uDipY, holeCX, uDipY);
            ctx.quadraticCurveTo(holeCX + uHalfW, uDipY, holeCX + uHalfW, uSideY);
            ctx.lineTo(holeCX + uHalfW, uTopY);
        };

        ctx.save();
        buildUPath();
        ctx.clip();
        ctx.shadowColor = `rgba(100,150,255,${a * 0.70})`;
        ctx.shadowBlur  = logoPulse * 1.2;
        const rings = 4;
        for (let i = rings; i >= 0; i--) {
            const t = i / rings; // 1 = outer rim, 0 = vanishing point
            const r = holeR * 1.3 * (0.15 + 0.85 * t);
            const grd = ctx.createRadialGradient(holeCX, logoY, 0, holeCX, logoY, r);
            grd.addColorStop(0, `rgba(6,8,20,${a})`);
            grd.addColorStop(1, `rgba(${40+30*t},${60+40*t},${140+60*t},${a * (0.35 + 0.5*t)})`);
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(holeCX, logoY, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        ctx.save();
        ctx.lineCap  = 'round';
        ctx.lineJoin = 'round';
        buildUPath();
        ctx.shadowColor = `rgba(100,150,255,${a * 0.70})`;
        ctx.shadowBlur   = logoPulse * 1.6;
        ctx.strokeStyle  = `rgba(215,232,255,${a * 0.97})`;
        ctx.lineWidth    = Math.max(1, fontPx * 0.13);
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

        ctx.shadowColor = 'rgba(0,0,0,0.90)'; ctx.shadowBlur = 3;
        ctx.font      = `bold ${FS*0.026}px 'Courier New',monospace`;
        ctx.fillStyle = `rgba(175,205,255,${a * 0.95})`;
        ctx.fillText(WORLD_NAME.toUpperCase(), titleX, LAND ? H * 0.455 : H/2 - H*0.038);

        // TAP TO START -- strong pulsing glow, the main CTA
        const tapPulse  = 0.72 + 0.28 * Math.sin(gtime * 2.4);
        const tapGlow   = 14 + 10 * Math.sin(gtime * 2.4);
        ctx.font        = `bold ${FS*0.040}px 'Courier New',monospace`;
        ctx.shadowColor = `rgba(90,140,255,${a * tapPulse * 0.70})`;
        ctx.shadowBlur  = tapGlow * 1.8;
        ctx.fillStyle   = `rgba(190,215,255,${a * tapPulse * 0.35})`;
        ctx.fillText(T.tap, titleX, LAND ? H * 0.63 : H/2 + H*0.140);
        ctx.shadowBlur  = tapGlow;
        ctx.fillStyle   = `rgba(210,228,255,${a * (0.80 + 0.20 * tapPulse)})`;
        ctx.fillText(T.tap, titleX, LAND ? H * 0.63 : H/2 + H*0.140);
        ctx.shadowBlur  = 0;

        // Settings/leaderboard row + shared button-drawing helper
        // (also reused inside the settings panel for the audio toggles)
        const tBtnY = LAND ? H * 0.80 : H/2 + H*0.225;
        ctx.font = `${FS*0.022}px 'Courier New',monospace`;
        const drawBtn = (bCx, bCy, label, active, blue) => {
            const m  = ctx.measureText(label);
            const bw = m.width + W*0.034, bh = H*0.055;
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
        // Settings button -- its (localized) text label can be as wide as it
        // needs without bumping into the info column.
        // Paired with the Game Center leaderboard button when that native bridge exists;
        // widths are measured first so long localized labels never overlap.
        {
            const settingsBY = tBtnY;
            const hasGameCenter = !!window.webkit?.messageHandlers?.gameCenter;
            if (hasGameCenter) {
                const settingsW    = ctx.measureText(T.settings).width + W*0.034;
                const leaderboardW = ctx.measureText(T.leaderboard).width + W*0.034;
                const rowGap = W * 0.02;
                const settingsCX    = titleX - settingsW/2 - rowGap/2;
                const leaderboardCX = titleX + leaderboardW/2 + rowGap/2;
                _settingsBtnRect    = drawBtn(settingsCX, settingsBY, T.settings, true, true);
                _leaderboardBtnRect = drawBtn(leaderboardCX, settingsBY, T.leaderboard, true, false);
            } else {
                _settingsBtnRect = drawBtn(titleX, settingsBY, T.settings, true, true);
            }
        }

        {
            ctx.shadowColor = 'rgba(0,0,0,0.90)'; ctx.shadowBlur = 3;
            ctx.font        = `bold ${FS*0.026}px 'Courier New',monospace`;
            ctx.fillStyle   = `rgba(190,212,255,${a * 0.98})`;
            ctx.fillText(`${T.today}  ${dailyRuns > 0 ? dailyBest : '-'}`, infoX, LAND ? H * 0.33 : H/2 + H*0.280);
            if (best > dailyBest) {
                ctx.font      = `bold ${FS*0.020}px 'Courier New',monospace`;
                ctx.fillStyle = `rgba(150,175,225,${a * 0.85})`;
                ctx.fillText(`${T.allTime}  ${best}`, infoX, LAND ? H * 0.42 : H/2 + H*0.316);
            }
            ctx.shadowBlur = 0;
        }

        if (streak > 0) {
            const flame = streak >= 7 ? ' **' : streak >= 3 ? ' *' : '';
            ctx.font        = `bold ${FS*0.022}px 'Courier New',monospace`;
            ctx.fillStyle   = streak >= 3 ? `rgba(255,180,70,${a * 0.98})` : `rgba(185,205,245,${a * 0.96})`;
            ctx.shadowColor = streak >= 3 ? `rgba(255,140,20,${a * 0.50})` : 'rgba(0,0,0,0.90)';
            ctx.shadowBlur  = streak >= 3 ? 6 : 3;
            ctx.fillText(`${streak}${flame} ${T.day}`, infoX, LAND ? H * 0.50 : H/2 + H*0.348);
            ctx.shadowBlur  = 0;
        }

        // Skin picker
        if (unlockedSkins > 1) {
            // dotR: slightly smaller in portrait so names fit above bottom edge
            const dotR   = LAND ? H * 0.048 : H * 0.035;
            // dotGap must be wide enough that ship shapes don't overlap
            const dotGap = Math.max(dotR * 2.8, LAND ? H * 0.155 : W * 0.180);
            const skinCX = infoX;
            // In portrait anchor to bottom so ships never overlap BEST/streak above them
            const dotY   = LAND ? H * 0.70 : H - dotR * 2.4;
            const startX = skinCX - (SKINS.length - 1) * dotGap / 2;
            _skinBtnRects = [];
            ctx.font        = `bold ${FS*0.018}px 'Courier New',monospace`;
            ctx.fillStyle   = 'rgba(190,205,240,0.92)';
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur  = 3;
            ctx.fillText(T.ship, skinCX, dotY - dotR * 2.0);
            ctx.shadowBlur  = 0;
            for (let i = 0; i < SKINS.length; i++) {
                const cx       = startX + i * dotGap;
                const unlocked = !!(unlockedSkins & (1 << i));
                const selected = activeSkin === i;
                _skinBtnRects.push({ cx, cy: dotY, r: dotR * 1.5 });
                if (!unlocked) {
                    ctx.beginPath();
                    ctx.arc(cx, dotY, dotR, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(90,95,130,0.50)';
                    ctx.lineWidth   = 1.5;
                    ctx.stroke();
                    ctx.font        = `bold ${FS*0.014}px 'Courier New',monospace`;
                    ctx.fillStyle   = 'rgba(150,160,205,0.85)';
                    ctx.shadowColor = 'rgba(0,0,0,0.85)';
                    ctx.shadowBlur  = 3;
                    ctx.fillText(SKINS[i].req, cx, dotY + dotR * 1.7);
                    ctx.shadowBlur  = 0;
                    ctx.font = `${FS*0.018}px 'Courier New',monospace`;
                } else {
                    const [sr, sg, sb] = SKINS[i].shadow;
                    if (selected) {
                        ctx.save();
                        shipPath(cx, dotY, dotR * 1.6);
                        ctx.strokeStyle = `rgba(${sr},${sg},${sb},0.50)`;
                        ctx.lineWidth   = 2.5;
                        ctx.shadowColor = `rgba(${sr},${sg},${sb},0.60)`;
                        ctx.shadowBlur  = 12;
                        ctx.stroke();
                        ctx.shadowBlur  = 0;
                        ctx.restore();
                    }
                    drawShip(cx, dotY, dotR, SKINS[i].color, sr, sg, sb, selected ? 22 : 8);
                    ctx.font        = `${FS*0.016}px 'Courier New',monospace`;
                    ctx.fillStyle   = selected
                        ? `rgba(${sr},${sg},${sb},0.95)`
                        : 'rgba(160,175,220,0.65)';
                    ctx.shadowColor = 'rgba(0,0,0,0.85)';
                    ctx.shadowBlur  = selected ? 8 : 3;
                    ctx.fillText(SKINS[i].name, cx, dotY + dotR * 1.7);
                    ctx.shadowBlur  = 0;
                    const perk = T.skinPerks && T.skinPerks[i];
                    if (selected && perk) {
                        ctx.font        = `${FS*0.016}px 'Courier New',monospace`;
                        ctx.fillStyle   = `rgba(${sr},${sg},${sb},0.85)`;
                        ctx.shadowColor = 'rgba(0,0,0,0.90)';
                        ctx.shadowBlur  = 4;
                        ctx.fillText(perk, cx, dotY + dotR * 2.7);
                        ctx.shadowBlur  = 0;
                    }
                    ctx.font = `${FS*0.018}px 'Courier New',monospace`;
                }
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

            const padTop     = H * 0.060;
            const padBottom  = H * 0.040;
            const titleH     = H * 0.070;
            const audioRowH  = H * 0.075;
            const langLabelH = H * 0.045;
            const lbh        = H * 0.080;
            const lbGap      = H * 0.018;
            const sectionGap = H * 0.045;

            const hasIAP     = !!window.webkit?.messageHandlers?.iap;
            const iapBtnH    = H * 0.085;
            const restoreGap = H * 0.020;
            const restoreH   = H * 0.032;
            const iapSectionH = hasIAP ? sectionGap + iapBtnH + (removeAdsOwned ? 0 : restoreGap + restoreH) : 0;

            const langCols  = 2;
            const langRows  = Math.ceil(LANG_ORDER.length / langCols);
            const langListH = langRows * lbh + Math.max(0, langRows - 1) * lbGap;
            const panH = padTop + titleH + audioRowH + sectionGap + langLabelH + langListH + iapSectionH + padBottom;

            const panX = W / 2 - panW / 2;
            const panY = Math.max(H * 0.02, Math.min(H * 0.98 - panH, H / 2 - panH / 2));

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

            // Audio toggle row (Music/FX)
            {
                const audioBY    = y + audioRowH / 2;
                const audioGap   = W * 0.02;
                const musicLabel = musicOn ? T.musicOn : T.musicOff;
                const fxLabel    = fxOn    ? T.fxOn    : T.fxOff;
                ctx.font = `${FS*0.022}px 'Courier New',monospace`;
                const musicW = ctx.measureText(musicLabel).width + W*0.034;
                const fxW    = ctx.measureText(fxLabel).width    + W*0.034;
                const musicCX = W/2 - musicW/2 - audioGap/2;
                const fxCX    = W/2 + fxW/2    + audioGap/2;
                _btnMusicRect = drawBtn(musicCX, audioBY, musicLabel, musicOn, false);
                _btnFxRect    = drawBtn(fxCX,    audioBY, fxLabel,    fxOn,    false);
            }
            y += audioRowH + sectionGap;

            // Language section label
            ctx.font        = `bold ${FS * 0.021}px 'Courier New',monospace`;
            ctx.fillStyle   = 'rgba(180,200,250,0.95)';
            ctx.shadowColor = 'rgba(0,0,0,0.90)';
            ctx.shadowBlur  = 3;
            ctx.fillText(T.language, W / 2, y + langLabelH / 2);
            ctx.shadowBlur  = 0;
            y += langLabelH;

            _langBtnRects = [];
            const langRowW = panW * 0.80;
            const lbw      = (langRowW - lbGap * (langCols - 1)) / langCols;
            const lbx0     = W / 2 - langRowW / 2;
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

                ctx.font      = `${active ? 'bold ' : ''}${FS * 0.023}px 'Courier New',monospace`;
                ctx.fillStyle = active ? 'rgba(140,180,255,0.97)' : 'rgba(150,170,220,0.88)';
                if (active) { ctx.shadowColor = 'rgba(80,140,255,0.55)'; ctx.shadowBlur = 10; }
                ctx.fillText(lang.name, lbx + lbw / 2, lby + lbh / 2);
                ctx.shadowBlur = 0;

                _langBtnRects.push({ x: lbx, y: lby, w: lbw, h: lbh, code });
            }
            y += langListH;

            // Remove Ads purchase (only when the native IAP bridge exists)
            _removeAdsBtnRect = null;
            _restoreBtnRect = null;
            if (hasIAP) {
                y += sectionGap;
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

                    y += restoreGap;
                    ctx.font      = `${FS * 0.019}px 'Courier New',monospace`;
                    ctx.fillStyle = 'rgba(180,200,240,0.92)';
                    ctx.fillText(T.restorePurchases, W / 2, y + restoreH / 2);
                    _restoreBtnRect = { x: W / 2 - panW * 0.35, y, w: panW * 0.70, h: restoreH };
                    y += restoreH;
                }
            }
        }
    }

    if (phase === 'dead') {
        ctx.textBaseline = 'middle';
        const a  = Math.min(1, deadT * 6.5);
        const sh = (blur, col = 'rgba(0,0,0,0.90)') => { ctx.shadowColor = col; ctx.shadowBlur = blur; };

        // Dark overlay
        ctx.fillStyle = `rgba(4,4,14,${a * 0.82})`;
        ctx.fillRect(0, 0, W, H);

        // Panel card backdrop
        sh(0);
        ctx.fillStyle = `rgba(6,8,22,${a * 0.64})`;
        ctx.beginPath();
        ctx.roundRect(W * 0.07, H * 0.07, W * 0.86, H * 0.75, 10);
        ctx.fill();
        ctx.strokeStyle = `rgba(70,95,170,${a * 0.55})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        const LC = W * 0.24;
        const RC = W * 0.67;

        // Vertical separator
        const sepGrd = ctx.createLinearGradient(0, H * 0.12, 0, H * 0.82);
        sepGrd.addColorStop(0,   `rgba(55,75,140,0)`);
        sepGrd.addColorStop(0.2, `rgba(70,95,170,${a * 0.50})`);
        sepGrd.addColorStop(0.8, `rgba(70,95,170,${a * 0.50})`);
        sepGrd.addColorStop(1,   `rgba(55,75,140,0)`);
        ctx.fillStyle = sepGrd;
        ctx.fillRect(W * 0.455, H * 0.10, 1, H * 0.73);

        // Left column: DEAD + score
        sh(5, `rgba(200,30,30,${a * 0.55})`);
        ctx.font      = `bold ${FS*0.095}px 'Courier New',monospace`;
        ctx.fillStyle = `rgba(255,70,70,${a})`;
        ctx.fillText(T.dead, LC, H * 0.25);

        // Accent underline
        sh(0);
        ctx.fillStyle = `rgba(255,80,80,${a * 0.75})`;
        const deadW = ctx.measureText(T.dead).width;
        ctx.fillRect(LC - deadW * 0.5, H * 0.317, deadW, 2);

        // Score with pulsing glow
        const scorePulse = newDailyBest ? 18 + 5 * Math.sin(deadT * 3.5) : 4;
        sh(scorePulse, newDailyBest ? `rgba(255,190,0,${a*0.75})` : 'rgba(0,0,0,0.90)');
        ctx.font      = `bold ${FS*0.140}px 'Courier New',monospace`;
        ctx.fillStyle = newDailyBest ? `rgba(255,225,65,${a})` : `rgba(225,240,255,${a})`;
        ctx.fillText(score, LC, H * 0.52);

        sh(2);
        ctx.font      = `bold ${FS*0.026}px 'Courier New',monospace`;
        ctx.fillStyle = `rgba(160,190,240,${a * 0.95})`;
        ctx.fillText(`${T.runs} ${dailyRuns}`, LC, H * 0.645);

        if (newBest && score > 0) {
            sh(6, `rgba(255,200,40,${a*0.7})`);
            ctx.font      = `bold ${FS*0.036}px 'Courier New',monospace`;
            ctx.fillStyle = `rgba(255,240,120,${a})`;
            ctx.fillText(T.newBest, LC, H * 0.74);
        } else if (newDailyBest && score > 0) {
            sh(6, `rgba(255,200,40,${a*0.7})`);
            ctx.font      = `bold ${FS*0.036}px 'Courier New',monospace`;
            ctx.fillStyle = `rgba(255,240,120,${a})`;
            ctx.fillText(T.newDailyBest, LC, H * 0.74);
            if (best > 0) {
                sh(2);
                ctx.font      = `bold ${FS*0.022}px 'Courier New',monospace`;
                ctx.fillStyle = `rgba(160,190,240,${a * 0.85})`;
                ctx.fillText(`${T.best}  ${best}`, LC, H * 0.79);
            }
        } else if (best > 0) {
            sh(2);
            ctx.font      = `bold ${FS*0.026}px 'Courier New',monospace`;
            ctx.fillStyle = `rgba(160,190,240,${a * 0.95})`;
            ctx.fillText(`${T.best}  ${best}`, LC, H * 0.74);
        }

        // Right column: top-5 leaderboard + stats
        let ry = H * 0.155;
        const LB_STEP = H * 0.095;

        sh(2);
        ctx.font      = `bold ${FS*0.024}px 'Courier New',monospace`;
        ctx.fillStyle = `rgba(170,195,240,${a * 0.90})`;
        ctx.fillText(T.top5, RC, ry);
        ry += H * 0.072;

        const myRank = top5.findIndex(s => s === score);
        for (let i = 0; i < 5; i++) {
            const entry = top5[i];
            const isMe  = i === myRank && entry === score;
            if (entry !== undefined) {
                sh(isMe ? (newBest ? 10 : 4) : 2,
                   isMe && newBest ? `rgba(255,190,0,${a*0.7})` : 'rgba(0,0,0,0.90)');
                ctx.font      = `bold ${FS*0.040}px 'Courier New',monospace`;
                ctx.fillStyle = isMe
                    ? (newBest ? `rgba(255,225,65,${a})` : `rgba(210,235,255,${a})`)
                    : `rgba(175,200,240,${a * 0.90})`;
                ctx.fillText(`#${i + 1}  ${entry}`, RC, ry);
            } else {
                sh(2);
                ctx.font      = `${FS*0.032}px 'Courier New',monospace`;
                ctx.fillStyle = `rgba(100,120,165,${a * 0.55})`;
                ctx.fillText(`#${i + 1}  -`, RC, ry);
            }
            ry += LB_STEP;
        }

        if (prevRunScore > 0 && score !== prevRunScore) {
            const diff = score - prevRunScore;
            sh(4);
            ctx.font      = `${FS*0.030}px 'Courier New',monospace`;
            ctx.fillStyle = `rgba(${diff >= 0 ? '140,230,140' : '220,140,140'},${a})`;
            ctx.fillText(`${diff >= 0 ? '+' : ''}${diff} ${T.vsLast}`, RC, ry);
            ry += H * 0.088;
        }

        {
            const statParts = [`${runCoins} ${runCoins !== 1 ? T.powerups : T.powerup}`];
            if (runNearMisses > 0) statParts.push(`${runNearMisses} ${T.close}`);
            if (runMaxCombo   > 1) statParts.push(`x${runMaxCombo} ${T.combo}`);
            sh(3);
            ctx.font      = `${FS*0.026}px 'Courier New',monospace`;
            ctx.fillStyle = `rgba(160,180,220,${a})`;
            ctx.fillText(statParts.join('   '), RC, ry);
            ry += H * 0.088;
        }

        if (skinUnlockIdx >= 0) {
            const sk = SKINS[skinUnlockIdx];
            const [sr, sg, sb] = sk.shadow;
            ctx.font        = `bold ${FS*0.030}px 'Courier New',monospace`;
            ctx.fillStyle   = `rgba(${sr},${sg},${sb},${a*0.95})`;
            ctx.shadowColor = `rgba(${sr},${sg},${sb},${a*0.60})`;
            ctx.shadowBlur  = 8;
            ctx.fillText(`${sk.name} ${T.unlocked}`, RC, ry);
            ctx.shadowBlur  = 0;
        }

        // Bottom row: HOME | PLAY AGAIN (centered pair)
        if (deadT > 0.75) {
            const b      = Math.min(1, (deadT - 0.75) * 6);
            const botY   = H * 0.905;
            const btnH   = H * 0.13;
            const btnW   = W * 0.17;
            const gap    = W * 0.04;
            const homeCX = W * 0.50 - gap * 0.5 - btnW * 0.5;
            const playCX = W * 0.50 + gap * 0.5 + btnW * 0.5;

            // HOME button
            ctx.font = `bold ${FS*0.028}px 'Courier New',monospace`;
            const homeX = homeCX - btnW * 0.5;
            _homeBtnRect = { x: homeX, y: botY - btnH * 0.5, w: btnW, h: btnH };
            sh(0);
            ctx.fillStyle   = `rgba(18,24,44,${b * 0.90})`;
            ctx.fillRect(homeX, botY - btnH * 0.5, btnW, btnH);
            ctx.strokeStyle = `rgba(80,105,180,${b * 0.70})`;
            ctx.lineWidth   = 1; ctx.strokeRect(homeX, botY - btnH * 0.5, btnW, btnH);
            sh(2); ctx.fillStyle = `rgba(130,155,230,${b * 0.90})`;
            ctx.fillText(T.home, homeCX, botY);

            // PLAY AGAIN button
            ctx.font = `bold ${FS*0.028}px 'Courier New',monospace`;
            const playX = playCX - btnW * 0.5;
            _playBtnRect = { x: playX, y: botY - btnH * 0.5, w: btnW, h: btnH };
            sh(6, `rgba(80,120,255,${b * 0.55})`);
            ctx.fillStyle   = `rgba(16,28,65,${b * 0.90})`;
            ctx.fillRect(playX, botY - btnH * 0.5, btnW, btnH);
            ctx.strokeStyle = `rgba(110,150,255,${b * 0.85})`;
            ctx.lineWidth   = 1.5; ctx.strokeRect(playX, botY - btnH * 0.5, btnW, btnH);
            sh(6, `rgba(100,150,255,${b * 0.60})`);
            ctx.fillStyle   = `rgba(180,210,255,${b * 0.95})`;
            ctx.fillText(T.playAgain, playCX, botY);
        }
    }
}
