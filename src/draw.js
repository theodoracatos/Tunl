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

function draw() {
    const ox = shake > 0 ? (Math.random()-0.5)*shake : 0;
    const oy = shake > 0 ? (Math.random()-0.5)*shake : 0;
    ctx.save();
    ctx.translate(ox, oy);

    const theme = getTheme();
    const bgStr = rgb(theme.bg);
    if (bgStr !== _lastBgStr) { document.body.style.background = bgStr; _lastBgStr = bgStr; }
    ctx.fillStyle = bgStr;
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
    // cross the next unlock (shards + runCoins, since the actual bank happens at death)
    if (phase === 'play') {
        const nextSkin = SKINS.find((sk, i) => sk.cost && !(unlockedSkins & (1 << i)));
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

    if (phase === 'title') {
        // In landscape (W > H*1.15) use a two-column layout to avoid vertical crowding.
        // In portrait keep a centered stack but anchor the skin picker to the bottom.
        const LAND   = W > H * 1.15;
        // Was 0.28 -- direct feedback that there's still a lot of unused space toward the
        // top-left of the title screen. Shifted left by the same amount (0.05W) the death
        // screen's left column moved for the same reason.
        const titleX = LAND ? W * 0.23 : W / 2;
        const infoX  = LAND ? W * 0.73 : W / 2;
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
        const logoY = LAND ? H * 0.24 : H/2 - H*0.12;

        // Ship-picker layout is computed here (hoisted above its actual drawing further
        // below) purely so the divider immediately after can be positioned against
        // PEARL's real on-screen left edge instead of a fixed W-fraction. A fixed
        // fraction (tried W*0.49, then W*0.44) looked fine on one device/aspect-ratio
        // and put the divider ON TOP of the ship icon on another -- same root cause as
        // the skinCX overflow bug: fixed fractions don't track how the dynamically-
        // clamped ship row actually shifts across device widths. See measureShipLabelHalfW.
        const showShipPanel = best > 0 || unlockedSkins > 1;
        const dotR   = LAND ? H * 0.048 : H * 0.035;
        const dotGap = Math.max(dotR * 2.8, LAND ? H * 0.155 : W * 0.180);
        const measureShipLabelHalfW = (i) => {
            ctx.font = `bold ${FS*0.016}px 'Courier New',monospace`;
            let lw = ctx.measureText(SKINS[i].name).width;
            if (T.skinPerks && T.skinPerks[i]) {
                ctx.font = `${FS*0.016}px 'Courier New',monospace`;
                lw = Math.max(lw, ctx.measureText(T.skinPerks[i]).width);
            }
            if (T.skinDrawbacks && T.skinDrawbacks[i]) {
                ctx.font = `${FS*0.013}px 'Courier New',monospace`;
                lw = Math.max(lw, ctx.measureText(T.skinDrawbacks[i]).width);
            }
            return lw / 2;
        };
        const rowHalfW   = (SKINS.length - 1) * dotGap / 2;
        const edgeMargin = 6;
        let skinCX = infoX;
        if (LAND) {
            const rightLimit = W - edgeMargin - rowHalfW - measureShipLabelHalfW(SKINS.length - 1);
            const leftLimit  = edgeMargin + rowHalfW + measureShipLabelHalfW(0);
            skinCX = Math.min(skinCX, rightLimit);
            skinCX = Math.max(skinCX, leftLimit);
        }
        const dotY   = LAND ? H * 0.70 : H - dotR * 2.4;
        const startX = skinCX - rowHalfW;

        // Gradient separator between columns (landscape only). When the ship panel is
        // showing, sit just left of PEARL's actual icon (not its text label -- the
        // triangle graphic itself extends further left, see dotR*1.6 below); before any
        // ship is unlocked/played there's nothing to clear yet, so fall back to a fixed
        // fraction close to the old constant.
        // Hoisted out of the `if (LAND)` block below so the level/world-name subtitle
        // further down can also fit itself against the divider's real position, not
        // just the gradient line drawn here.
        let dividerX = W * 0.44;
        if (LAND) {
            const sepGrd = ctx.createLinearGradient(0, H * 0.10, 0, H * 0.90);
            sepGrd.addColorStop(0,   `rgba(55,75,140,0)`);
            sepGrd.addColorStop(0.2, `rgba(80,110,200,${a * 0.40})`);
            sepGrd.addColorStop(0.8, `rgba(80,110,200,${a * 0.40})`);
            sepGrd.addColorStop(1,   `rgba(55,75,140,0)`);
            ctx.fillStyle = sepGrd;
            const dividerMargin = 12;
            dividerX = showShipPanel ? (startX - dotR * 1.6 - dividerMargin) : W * 0.44;
            // Don't let the divider crash into the left column's own content either.
            dividerX = Math.max(dividerX, W * 0.34);
            ctx.fillRect(dividerX, H * 0.08, 1, H * 0.84);
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

        // Ring rendering matches branding/wordmark.svg's "uclip" ring group exactly
        // (same radii ratios, same purple/cyan split, same core) so the in-game logo,
        // the exported wordmark, and the app icon are finally the same drawing instead
        // of the icon/wordmark having a crisper portal than what actually ships on
        // screen. Top half purple, bottom half cyan, largest/blurriest ring first so
        // each smaller one shows as a distinct rim -- reads as a corridor receding
        // into the U, same motif as the tunnel walls themselves.
        ctx.save();
        buildUPath();
        ctx.clip();

        const bgGrd = ctx.createRadialGradient(holeCX, logoY, 0, holeCX, logoY, uHalfW * 1.15);
        bgGrd.addColorStop(0,   `rgba(20,28,68,${a})`);
        bgGrd.addColorStop(0.6, `rgba(8,11,34,${a})`);
        bgGrd.addColorStop(1,   `rgba(4,4,14,${a})`);
        ctx.fillStyle = bgGrd;
        ctx.fillRect(holeCX - uHalfW * 2, uTopY - holeR, uHalfW * 4, (uDipY - uTopY) + holeR * 2);

        // Radii ratios (1 : 0.71 : 0.435) match wordmark.svg's own 124:88:54, but
        // rescaled to this U's actual clip headroom -- the SVG's U is proportioned
        // differently (much more room above its ring center than below), so porting
        // its literal 1.55x/1.10x/0.675x-of-half-width radii here clipped the outer
        // ring almost entirely off the top and the whole ring off the bottom, leaving
        // barely more than a dot. Sized against uHalfW (roughly this U's tightest
        // headroom) instead keeps all three rings actually visible on both halves.
        const ringR    = [1.0, 0.71, 0.435].map(f => f * uHalfW);
        const ringW    = [holeR * 0.15, holeR * 0.15, holeR * 0.13];
        const ringOpac = [0.85, 1, 1];
        // Blur scaled proportionally to each ring's own radius (matching
        // branding/wordmark.svg's blur/radius ratios, ~5%/3.5%/2.5%) rather than a
        // fixed pulse-based value -- an absolute blur that looked right on the 1024px
        // SVG export was wildly oversized against this ~35px in-game ring, smearing
        // all three bands into one soft blob instead of distinct rims.
        const ringBlur = ringR.map((r, i) => r * [0.05, 0.035, 0.025][i] + logoPulse * 0.03);
        ctx.lineCap = 'round';
        for (let i = 0; i < ringR.length; i++) {
            const r = ringR[i];
            const purpleGrd = ctx.createLinearGradient(holeCX - r, 0, holeCX + r, 0);
            purpleGrd.addColorStop(0, '#7a3ce0'); purpleGrd.addColorStop(0.5, '#a75bff'); purpleGrd.addColorStop(1, '#7a3ce0');
            const cyanGrd = ctx.createLinearGradient(holeCX - r, 0, holeCX + r, 0);
            cyanGrd.addColorStop(0, '#1aa8d6'); cyanGrd.addColorStop(0.5, '#3fe0ff'); cyanGrd.addColorStop(1, '#1aa8d6');
            ctx.lineWidth   = ringW[i];
            ctx.globalAlpha = a * ringOpac[i];
            ctx.shadowColor = 'rgba(120,100,255,0.7)';
            ctx.shadowBlur  = ringBlur[i];
            ctx.strokeStyle = purpleGrd;
            ctx.beginPath(); ctx.arc(holeCX, logoY, r, Math.PI, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = cyanGrd;
            ctx.beginPath(); ctx.arc(holeCX, logoY, r, 0, Math.PI); ctx.stroke();
        }
        ctx.globalAlpha = a;
        ctx.shadowBlur  = 0;

        // Bright core -- the light at the end of the tunnel, same two-circle
        // treatment (soft halo + solid center) as icon-mark.svg/wordmark.svg.
        const coreR    = 0.325 * uHalfW;
        const coreDotR = 0.15  * uHalfW;
        const coreGrd  = ctx.createRadialGradient(holeCX, logoY, 0, holeCX, logoY, coreR);
        coreGrd.addColorStop(0,   '#ffffff');
        coreGrd.addColorStop(0.4, '#d7e8ff');
        coreGrd.addColorStop(1,   'rgba(111,156,255,0)');
        ctx.fillStyle = coreGrd;
        ctx.beginPath(); ctx.arc(holeCX, logoY, coreR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.arc(holeCX, logoY, coreDotR, 0, Math.PI * 2); ctx.fill();

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
        ctx.fillStyle = `rgba(175,205,255,${a * 0.95})`;
        // Prefixed with "LEVEL <day-of-year>:" so the world name reads like a level
        // index -- same LEVEL_NUM/T.level pair already used in the run-start banner
        // (see above), just surfaced here too per user request. This line is centered
        // on titleX, but titleX sits much closer to the divider than to the left screen
        // edge on narrow devices, so the divider side is the binding constraint -- shrink
        // the font to fit rather than let long language/level combos cross the divider.
        const levelLine = `${T.level} ${LEVEL_NUM}: ${WORLD_NAME.toUpperCase()}`;
        let levelFsz = FS * 0.026;
        ctx.font = `bold ${levelFsz}px 'Courier New',monospace`;
        if (LAND) {
            const levelAvailHalfW = Math.min(titleX - 8, dividerX - titleX - 8);
            const levelW = ctx.measureText(levelLine).width;
            if (levelW / 2 > levelAvailHalfW) {
                levelFsz *= (levelAvailHalfW * 2) / levelW;
                levelFsz = Math.max(levelFsz, FS * 0.015); // legibility floor
                ctx.font = `bold ${levelFsz}px 'Courier New',monospace`;
            }
        }
        ctx.fillText(levelLine, titleX, LAND ? H * 0.365 : H/2 - H*0.038);

        // TAP TO START -- strong pulsing glow, the main CTA
        // Landscape Y was 0.54; shifted up by liftLand (their relative gap to each other
        // is unchanged, only both moved up together) to open up more room between the
        // button cluster and Daily Missions below, per user request -- Daily Missions,
        // the logo, and the level line all stay put; the missionY cascade a bit below
        // (see _btnRowBottom) settles back onto its own fixed position once the button
        // cluster is short enough not to need it, which this lift achieves.
        const liftLand  = H * 0.05;
        const tapPulse  = 0.72 + 0.28 * Math.sin(gtime * 2.4);
        const tapGlow   = 14 + 10 * Math.sin(gtime * 2.4);
        ctx.font        = `bold ${FS*0.040}px 'Courier New',monospace`;
        ctx.shadowColor = `rgba(90,140,255,${a * tapPulse * 0.70})`;
        ctx.shadowBlur  = tapGlow * 1.8;
        ctx.fillStyle   = `rgba(190,215,255,${a * tapPulse * 0.35})`;
        ctx.fillText(T.tap, titleX, LAND ? H * 0.54 - liftLand : H/2 + H*0.140);
        ctx.shadowBlur  = tapGlow;
        ctx.fillStyle   = `rgba(210,228,255,${a * (0.80 + 0.20 * tapPulse)})`;
        ctx.fillText(T.tap, titleX, LAND ? H * 0.54 - liftLand : H/2 + H*0.140);
        ctx.shadowBlur  = 0;

        // Settings/leaderboard row + shared button-drawing helper
        // (also reused inside the settings panel for the audio toggles)
        // Was 0.71 -- nudged up a bit per feedback, still with plenty of clearance
        // from TAP TO START above and the daily-missions block below. Then lifted by
        // liftLand along with TAP TO START above (see that comment).
        const tBtnY = LAND ? H * 0.665 - liftLand : H/2 + H*0.225;
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
        // Paired with the Game Center leaderboard button when that native bridge
        // exists, and with a challenge button too on devices new enough to actually
        // use Game Center Challenges (GKChallengeDefinition needs iOS 26+ - see
        // GameView.swift, which sets window._tunlChallengeSupported before this ever
        // runs). Widths are measured first so long localized labels never overlap,
        // and the row is centered as a whole around titleX.
        {
            const settingsBY = tBtnY;
            const hasGameCenter = !!window.webkit?.messageHandlers?.gameCenter;
            const hasChallenge  = hasGameCenter && !!window._tunlChallengeSupported;
            _challengeBtnRect = null;
            const rowGap = W * 0.02;
            const pad    = W * 0.034;
            const bh     = H * 0.055;
            // Row is centered on titleX, which sits much closer to the left screen edge
            // than to the divider on narrow devices (titleX = W*0.23) -- so on a device
            // that's both narrow (e.g. iPhone 12 mini, 812pt wide landscape) and running
            // a verbose language (German labels especially, e.g. "HERAUSFORDERUNG"), a
            // single 3-button row's left edge can land off-screen, clipping text at the
            // edge. Kept the shrink-to-fit guard below as a safety net, but the real fix
            // (per user suggestion) is two rows instead of one: Rangliste + Herausforderung
            // (the two "compete" buttons) on top, Einstellungen alone below -- reads better
            // than shrunk text even on devices where one row would technically have fit.
            const rowMarginL = W * 0.02, rowMarginR = W * 0.02;
            const maxRowW = 2 * Math.max(Math.min(titleX - rowMarginL, dividerX - titleX - rowMarginR), W * 0.10);
            // Bottom Y of whatever got drawn -- daily missions below cascades off this
            // instead of an independent fixed H fraction, so it can't collide with a
            // button row that grew an extra line.
            _btnRowBottom = settingsBY + bh / 2;
            if (hasChallenge) {
                let leaderboardW = ctx.measureText(T.leaderboard).width;
                let challengeW   = ctx.measureText(T.challenge).width;
                let textSum = leaderboardW + challengeW;
                let totalW = textSum + pad * 2 + rowGap;
                let scale = 1;
                if (totalW > maxRowW) {
                    scale = Math.max((maxRowW - pad * 2 - rowGap) / textSum, 0.50);
                    ctx.font = `${FS * 0.022 * scale}px 'Courier New',monospace`;
                    leaderboardW = ctx.measureText(T.leaderboard).width;
                    challengeW   = ctx.measureText(T.challenge).width;
                    totalW = leaderboardW + challengeW + pad * 2 + rowGap;
                }
                leaderboardW += pad; challengeW += pad;
                let bx = titleX - totalW / 2;
                const leaderboardCX = bx + leaderboardW / 2; bx += leaderboardW + rowGap;
                const challengeCX = bx + challengeW / 2;
                _leaderboardBtnRect = drawBtn(leaderboardCX, settingsBY, T.leaderboard, true, false);
                _challengeBtnRect   = drawBtn(challengeCX, settingsBY, T.challenge, true, false);

                // Settings alone on the row below, same scale as the row above for a
                // visually consistent pair of rows (it virtually never needs to shrink
                // on its own, but matching size beats mismatched sizes in one cluster).
                // Vertical gap was H*0.02 -- read as cramped on a real device screenshot,
                // the two rows nearly touching. Widened to H*0.035, matched to the gap
                // below (see missionY's H*0.03 buffer) so the whole stack reads as one
                // consistent rhythm -- an earlier pass widened just this gap without the
                // one below it, which made Daily Missions look like it was crammed
                // against Settings by comparison (~7px vs this gap's ~20px on a real
                // screenshot). The missions block still cascades off this cluster's
                // actual bottom edge (_btnRowBottom), so it can't collide just because
                // this grew.
                ctx.font = `${FS * 0.022 * scale}px 'Courier New',monospace`;
                const settingsBY2 = settingsBY + bh + H * 0.035;
                _settingsBtnRect = drawBtn(titleX, settingsBY2, T.settings, true, true);
                _btnRowBottom = settingsBY2 + bh / 2;
            } else if (hasGameCenter) {
                let settingsWraw    = ctx.measureText(T.settings).width;
                let leaderboardWraw = ctx.measureText(T.leaderboard).width;
                let textSum = settingsWraw + leaderboardWraw;
                if (textSum + pad * 2 + rowGap > maxRowW) {
                    const scale = Math.max((maxRowW - pad * 2 - rowGap) / textSum, 0.50);
                    ctx.font = `${FS * 0.022 * scale}px 'Courier New',monospace`;
                    settingsWraw    = ctx.measureText(T.settings).width;
                    leaderboardWraw = ctx.measureText(T.leaderboard).width;
                }
                const settingsW    = settingsWraw + pad;
                const leaderboardW = leaderboardWraw + pad;
                const settingsCX    = titleX - settingsW/2 - rowGap/2;
                const leaderboardCX = titleX + leaderboardW/2 + rowGap/2;
                _settingsBtnRect    = drawBtn(settingsCX, settingsBY, T.settings, true, true);
                _leaderboardBtnRect = drawBtn(leaderboardCX, settingsBY, T.leaderboard, true, false);
            } else {
                _settingsBtnRect = drawBtn(titleX, settingsBY, T.settings, true, true);
            }
        }

        // Daily missions -- left column, below the settings row. Landscape only: this
        // column is centered and already tight in portrait (same call the pre-unlock
        // TOP 5 block below makes for the right column). Progress is cumulative across
        // today's runs (state.js dailyMissionStats, folded in by update.js die()), and
        // the 3 active missions are the same for every player on a given day
        // (constants.js pickDailyMissionIndices), not per-player randomized.
        if (LAND) {
            // Was a fixed H*0.775; now the greater of that and the button cluster's
            // actual bottom edge (see _btnRowBottom above) so a two-row cluster on a
            // narrow device can't push into this block.
            let missionY = Math.max(H * 0.775, _btnRowBottom + H * 0.03);
            ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 3;
            ctx.font        = `bold ${FS*0.017}px 'Courier New',monospace`;
            ctx.fillStyle   = `rgba(180,198,235,${a * 0.80})`;
            ctx.fillText(T.missions, titleX, missionY);
            ctx.shadowBlur  = 0;
            missionY += H * 0.040;

            ctx.font = `${FS*0.015}px 'Courier New',monospace`;
            for (let m = 0; m < dailyMissionIdx.length; m++) {
                const def   = MISSION_DEFS[dailyMissionIdx[m]];
                const label = (T.missionDesc && T.missionDesc[def.id]) || def.id;
                const done  = dailyMissionsClaimed[m];
                const val   = Math.min(dailyMissionStats[def.stat] || 0, def.target);
                ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 2;
                ctx.fillStyle   = done ? `rgba(120,255,150,${a * 0.90})` : `rgba(175,190,225,${a * 0.72})`;
                ctx.fillText(`${done ? '✓' : val + '/' + def.target}  ${label}`, titleX, missionY);
                ctx.shadowBlur  = 0;
                missionY += H * 0.037;
            }
        }

        // rightColY tracks how far down the right-column stack (TODAY/ALL TIME/
        // STREAK/TOP 5) reaches in landscape, so each line uses the same step
        // and the skin picker below never overlaps regardless of which lines
        // end up shown.
        let rightColY  = H * 0.33;
        const lineStep = H * 0.085;

        // BEST (all-time record) is the single headline stat -- it rarely changes, so
        // it reads as "your record" rather than a volatile daily figure. TODAY and the
        // day streak fold into one small secondary line instead of each getting their
        // own full row: was 3 stacked LABEL/value rows that read as a data table, not
        // a HUD (direct feedback: "wirkt ein bisschen überladen"). Skipped entirely
        // before the player's first real run -- an empty title screen doesn't need a
        // "BEST 0" placeholder.
        if (best > 0) {
            ctx.shadowColor = 'rgba(0,0,0,0.90)'; ctx.shadowBlur = 3;
            ctx.font        = `bold ${FS*0.028}px 'Courier New',monospace`;
            ctx.fillStyle   = `rgba(190,212,255,${a * 0.98})`;
            ctx.fillText(`${T.allTime}  ${best}`, infoX, LAND ? rightColY : H/2 + H*0.280);
            ctx.shadowBlur  = 0;

            const subParts = [];
            if (dailyRuns > 0) subParts.push(`${T.today} ${dailyBest}`);
            if (streak > 0) {
                const flame = streak >= 7 ? ' **' : streak >= 3 ? ' *' : '';
                subParts.push(`${streak}${flame} ${T.day}`);
            }
            if (subParts.length) {
                rightColY += lineStep;
                ctx.font        = `bold ${FS*0.019}px 'Courier New',monospace`;
                ctx.fillStyle   = streak >= 3 ? `rgba(255,180,70,${a * 0.90})` : `rgba(160,185,230,${a * 0.85})`;
                ctx.shadowColor = streak >= 3 ? `rgba(255,140,20,${a * 0.45})` : 'rgba(0,0,0,0.90)';
                ctx.shadowBlur  = streak >= 3 ? 5 : 3;
                ctx.fillText(subParts.join('   ·   '), infoX, LAND ? rightColY : H/2 + H*0.316);
                ctx.shadowBlur  = 0;
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
        // (showShipPanel and the whole dotR/dotGap/skinCX/startX layout are computed
        // above, before the divider, so the divider can be positioned against PEARL's
        // real position -- reused here rather than recomputed.)

        // Skin picker
        if (showShipPanel) {
            _skinBtnRects = [];
            ctx.font        = `bold ${FS*0.018}px 'Courier New',monospace`;
            ctx.fillStyle   = 'rgba(190,205,240,0.92)';
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur  = 3;
            ctx.fillText(`${T.ship}   ${shards} ⧫`, skinCX, dotY - dotR * 2.0);
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
                    ctx.fillText(`${SKINS[i].cost} ⧫`, cx, dotY + dotR * 1.7);
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
                    // Mastery pips: how far this ship's buff/drawback have grown from flying
                    // it (constants.js masteryLevel/masteryLerp). PEARL has no perk to master.
                    if (selected && i > 0) {
                        const lvl = masteryLevel(i);
                        const pipR = dotR * 0.09, pipGap = dotR * 0.30;
                        const pipsW = (MASTERY_XP_THRESHOLDS.length - 2) * pipGap;
                        for (let p = 0; p < MASTERY_XP_THRESHOLDS.length - 1; p++) {
                            const px = cx - pipsW/2 + p * pipGap;
                            const py2 = dotY - dotR * 1.35;
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
                    ctx.font        = `${FS*0.016}px 'Courier New',monospace`;
                    ctx.fillStyle   = selected
                        ? `rgba(${sr},${sg},${sb},0.95)`
                        : 'rgba(160,175,220,0.65)';
                    ctx.shadowColor = 'rgba(0,0,0,0.85)';
                    ctx.shadowBlur  = selected ? 8 : 3;
                    ctx.fillText(SKINS[i].name, cx, dotY + dotR * 1.7);
                    ctx.shadowBlur  = 0;
                    const perk     = T.skinPerks     && T.skinPerks[i];
                    const drawback = T.skinDrawbacks && T.skinDrawbacks[i];
                    if (selected && perk) {
                        ctx.font        = `${FS*0.016}px 'Courier New',monospace`;
                        ctx.fillStyle   = `rgba(${sr},${sg},${sb},0.85)`;
                        ctx.shadowColor = 'rgba(0,0,0,0.90)';
                        ctx.shadowBlur  = 4;
                        ctx.fillText(perk, cx, dotY + dotR * 2.7);
                        ctx.shadowBlur  = 0;
                    }
                    // Trade-off: each buff above is paired with a drawback, a size step
                    // smaller so the perk stays the visual headline.
                    if (selected && drawback) {
                        ctx.font        = `${FS*0.013}px 'Courier New',monospace`;
                        ctx.fillStyle   = 'rgba(255,120,90,0.80)';
                        ctx.shadowColor = 'rgba(0,0,0,0.90)';
                        ctx.shadowBlur  = 4;
                        ctx.fillText(drawback, cx, dotY + dotR * 3.5);
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

            // Only shown once the native layer confirms the UMP SDK actually requires
            // it for this player's region (see state.js's privacyOptionsRequired) -
            // most players outside the EEA/UK/CH/opted-in US states never see this row.
            const hasPrivacyBtn  = !!window.webkit?.messageHandlers?.ads && privacyOptionsRequired;
            const privacyBtnH    = H * 0.062;
            const privacySectionH = hasPrivacyBtn ? sectionGap + privacyBtnH : 0;

            const langCols  = LANG_ORDER.length > 10 ? 3 : 2;
            const langRows  = Math.ceil(LANG_ORDER.length / langCols);
            const langListH = langRows * lbh + Math.max(0, langRows - 1) * lbGap;
            const panH = padTop + titleH + audioRowH + sectionGap + langLabelH + langListH + iapSectionH + privacySectionH + padBottom;

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
    }

    if (phase === 'dead') {
        ctx.textBaseline = 'middle';
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
        ctx.strokeStyle = `rgba(70,95,170,${a * 0.55})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        const LC = W * 0.20;
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
        ctx.fillText(T.dead, LC, H * 0.20);

        // Accent underline
        sh(0);
        ctx.fillStyle = `rgba(255,80,80,${a * 0.75})`;
        const deadW = ctx.measureText(T.dead).width;
        ctx.fillRect(LC - deadW * 0.5, H * 0.267, deadW, 2);

        // Score with pulsing glow
        const scorePulse = newDailyBest ? 18 + 5 * Math.sin(deadT * 3.5) : 4;
        sh(scorePulse, newDailyBest ? `rgba(255,190,0,${a*0.75})` : 'rgba(0,0,0,0.90)');
        ctx.font      = `bold ${FS*0.140}px 'Courier New',monospace`;
        ctx.fillStyle = newDailyBest ? `rgba(255,225,65,${a})` : `rgba(225,240,255,${a})`;
        ctx.fillText(score, LC, H * 0.44);

        sh(2);
        ctx.font      = `bold ${FS*0.026}px 'Courier New',monospace`;
        ctx.fillStyle = `rgba(160,190,240,${a * 0.95})`;
        ctx.fillText(`${T.runs} ${dailyRuns}`, LC, H * 0.565);

        if (newBest && score > 0) {
            sh(6, `rgba(255,200,40,${a*0.7})`);
            ctx.font      = `bold ${FS*0.036}px 'Courier New',monospace`;
            ctx.fillStyle = `rgba(255,240,120,${a})`;
            ctx.fillText(T.newBest, LC, H * 0.66);
        } else if (newDailyBest && score > 0) {
            sh(6, `rgba(255,200,40,${a*0.7})`);
            ctx.font      = `bold ${FS*0.036}px 'Courier New',monospace`;
            ctx.fillStyle = `rgba(255,240,120,${a})`;
            ctx.fillText(T.newDailyBest, LC, H * 0.66);
            if (best > 0) {
                sh(2);
                ctx.font      = `bold ${FS*0.022}px 'Courier New',monospace`;
                ctx.fillStyle = `rgba(160,190,240,${a * 0.85})`;
                ctx.fillText(`${T.best}  ${best}`, LC, H * 0.71);
            }
        } else if (best > 0) {
            sh(2);
            ctx.font      = `bold ${FS*0.026}px 'Courier New',monospace`;
            ctx.fillStyle = `rgba(160,190,240,${a * 0.95})`;
            ctx.fillText(`${T.best}  ${best}`, LC, H * 0.66);
        }

        // Skin-unlock banner (+ shards line below it) sits in the left column's empty
        // space below the best/streak line; the right column is already packed (top5 +
        // vsLast + stats) and collides with the HOME/PLAY AGAIN buttons if it lands there
        // -- confirmed by measuring text width at common viewport sizes, so don't move
        // this back to the right column.
        if (skinUnlockIdx >= 0) {
            const sk = SKINS[skinUnlockIdx];
            const [sr, sg, sb] = sk.shadow;
            // Font sized down from the panel-tightening pass above (0.03 -> 0.023): the
            // wider left column helped, but this banner's text (ship name + a whole
            // localized word) is long enough that it still reached the divider on a
            // smaller device at the old size -- measured across all 15 languages.
            ctx.font        = `bold ${FS*0.023}px 'Courier New',monospace`;
            ctx.fillStyle   = `rgba(${sr},${sg},${sb},${a*0.95})`;
            ctx.shadowColor = `rgba(${sr},${sg},${sb},${a*0.60})`;
            ctx.shadowBlur  = 8;
            ctx.fillText(`${sk.name} ${T.unlocked}`, LC, H * 0.78);
            ctx.shadowBlur  = 0;
        }

        // Mastery level-up banner -- same left-column slot, one priority step below a
        // fresh unlock (ship-unlock is the bigger moment; skip this if both happen the
        // same run rather than stacking two banners in the same cramped space).
        if (skinUnlockIdx < 0 && skinMasteryUpIdx >= 0) {
            const sk = SKINS[skinMasteryUpIdx];
            const [sr, sg, sb] = sk.shadow;
            ctx.font        = `bold ${FS*0.023}px 'Courier New',monospace`; // see unlock banner comment above
            ctx.fillStyle   = `rgba(${sr},${sg},${sb},${a*0.95})`;
            ctx.shadowColor = `rgba(${sr},${sg},${sb},${a*0.60})`;
            ctx.shadowBlur  = 8;
            ctx.fillText(`${sk.name} ${T.masteryUp} ${masteryLevel(skinMasteryUpIdx)}`, LC, H * 0.78);
            ctx.shadowBlur  = 0;
        }

        // Shards banked this run (post daily-cap, see update.js die()) plus running total,
        // in the same left-column slot the unlock banner uses. Skipped on unlock/mastery
        // runs -- there's no room for both above the panel edge/buttons, and either banner
        // is already that run's headline moment.
        if (runCoins > 0 && skinUnlockIdx < 0 && skinMasteryUpIdx < 0) {
            sh(3);
            // Bumped from 0.017 -- user feedback that this line specifically read too
            // small. The banked total (`shards`) has no upper bound (grinding never
            // stops once every ship is owned), so past 10000 it's shown rounded to the
            // nearest thousand ("13k") rather than full digits -- keeps this line's
            // width from creeping past the divider the longer someone's played, without
            // needing yet another font shrink. Below that threshold, exact digits.
            ctx.font      = `${FS*0.018}px 'Courier New',monospace`; // see unlock banner comment above
            ctx.fillStyle = `rgba(160,180,220,${a * 0.85})`;
            const shardsDisp = shards >= 10000 ? Math.round(shards / 1000) + 'k' : shards;
            let shardLine = `+${runShardsBanked} ⧫ · ${shardsDisp} ⧫`;
            if (runShardsBanked < runCoins) shardLine += `  (${T.dailyCap})`;
            ctx.fillText(shardLine, LC, H * 0.78);
        }

        // Right column: top-5 leaderboard + stats
        let ry = H * 0.155;
        const LB_STEP = H * 0.095;

        // Left-align the rank/score column to a shared start X instead of centering each
        // line independently -- centering per-line let the numbers drift left/right with
        // digit count so they didn't read as a column. The column itself is still
        // centered as a block around RC (measured against the widest of the 5 possible
        // lines, in whichever font that line would actually use).
        let listW = 0;
        for (let i = 0; i < 5; i++) {
            const entry = top5[i];
            ctx.font = entry !== undefined ? `bold ${FS*0.040}px 'Courier New',monospace` : `${FS*0.032}px 'Courier New',monospace`;
            listW = Math.max(listW, ctx.measureText(entry !== undefined ? `#${i + 1}  ${entry}` : `#${i + 1}  -`).width);
        }
        const listX = RC - listW / 2;
        ctx.textAlign = 'left';

        sh(2);
        ctx.font      = `bold ${FS*0.024}px 'Courier New',monospace`;
        ctx.fillStyle = `rgba(170,195,240,${a * 0.90})`;
        ctx.fillText(T.top5, listX, ry);
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
                ctx.fillText(`#${i + 1}  ${entry}`, listX, ry);
            } else {
                sh(2);
                ctx.font      = `${FS*0.032}px 'Courier New',monospace`;
                ctx.fillStyle = `rgba(100,120,165,${a * 0.55})`;
                ctx.fillText(`#${i + 1}  -`, listX, ry);
            }
            ry += LB_STEP;
        }
        ctx.textAlign = 'center'; // restore -- vsLast/stats/buttons below expect centered text

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
            ctx.font      = `${FS*0.022}px 'Courier New',monospace`; // see unlock banner comment above
            ctx.fillStyle = `rgba(160,180,220,${a})`;
            ctx.fillText(statParts.join('   '), RC, ry);
            ry += H * 0.088;
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
