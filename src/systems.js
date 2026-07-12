// ── Stalactite system ─────────────────────────────────────────────────

function makeStal(wx, isTop) {
    const length = _halfGap * stalLenFrac() * (0.55 + rng() * 0.45);
    const width  = W * lerp(0.030, 0.018, _prog) * (0.70 + rng() * 0.40);
    return { wx, isTop, length, width, fade: 1.0, dying: false };
}

function maintainStalactites() {
    while (nextStalWx < scrollX + W + 600) {
        const spacing = stalSpacing() * (0.65 + rng() * 0.70);
        if (_prog > 0.40 && rng() < Math.min(lerp(0.24, 0.42, _prog2), 0.62)) {
            stalactites.push(makeStal(nextStalWx,       true));
            stalactites.push(makeStal(nextStalWx + 65, false));
            const coinWx = nextStalWx - 85;
            if (coinWx > 0 && (!chicaneCoins.length || chicaneCoins[chicaneCoins.length - 1].wx < coinWx - 30)) {
                chicaneCoins.push({ wx: coinWx, y: centerAt(coinWx), collected: false, type: 'gold', fade: 1.0 });
            }
        } else {
            stalactites.push(makeStal(nextStalWx, rng() < 0.5));
        }
        nextStalWx += spacing;
    }
    while (stalactites.length && stalactites[0].wx < scrollX - 150) {
        stalactites.shift();
    }
    while (chicaneCoins.length && chicaneCoins[0].wx < scrollX - 200) {
        chicaneCoins.shift();
    }
}

// ── Coin system ───────────────────────────────────────────────────────

function coinBlockedByStal(wx, y) {
    const safe = PR + COIN_R;   // clearance the player actually needs
    const r2   = safe * safe;
    for (const s of stalactites) {
        if (Math.abs(wx - s.wx) > s.width + safe * 2) continue;
        const b = boundsBase(s.wx), hw = s.width / 2 * 0.85;
        const tipY = s.isTop ? b.top + s.length : b.bot - s.length;
        let ax, ay, bx, by;
        if (s.isTop) {
            ax = s.wx-hw; ay = b.top; bx = s.wx+hw; by = b.top;
            if (inTri(wx,y,ax,ay,bx,by,s.wx,tipY)) return true;
            if (ptSeg2(wx,y,ax,ay,s.wx,tipY) < r2)  return true;
            if (ptSeg2(wx,y,bx,by,s.wx,tipY) < r2)  return true;
            if (y < tipY + safe) return true;   // too close to tip vertically
        } else {
            ax = s.wx-hw; ay = b.bot; bx = s.wx+hw; by = b.bot;
            if (inTri(wx,y,ax,ay,bx,by,s.wx,tipY))  return true;
            if (ptSeg2(wx,y,ax,ay,s.wx,tipY) < r2)   return true;
            if (ptSeg2(wx,y,bx,by,s.wx,tipY) < r2)   return true;
            if (y > tipY - safe) return true;
        }
    }
    return false;
}

function makeCoin(wx) {
    const bBase  = boundsBase(wx);
    // Also intersect with the current visual corridor so the coin never
    // appears inside a wall while still in the lookahead area.
    const visCy  = centerAt(wx);
    const visTop = visCy - _halfGap;
    const visBot = visCy + _halfGap;
    const buf = COIN_R * 2;
    const lo  = Math.max(bBase.top, visTop) + buf;
    const hi  = Math.min(bBase.bot, visBot) - buf;
    if (hi <= lo) return null;
    const cy     = (lo + hi) / 2;
    const margin = (hi - lo) * 0.40;
    const coinY  = Math.max(lo, Math.min(hi, cy + (rng() - 0.5) * 2 * margin));
    const r = rng();
    let type = 'gold';
    if (_prog >= 0.55) {
        // score ~77+: all types including magnet
        const blueEnd = lerp(0.60, 0.44, _prog);
        const redEnd  = lerp(0.77, 0.61, _prog);
        type = r < blueEnd ? 'gold' : r < redEnd ? 'blue' : r < 0.82 ? 'red' : r < 0.85 ? 'green' : 'orange';
    } else if (_prog >= 0.38) {
        // score ~40-77: gold, slow, shield, bullets
        const blueEnd = lerp(0.64, 0.56, _prog);
        const redEnd  = lerp(0.82, 0.72, _prog);
        type = r < blueEnd ? 'gold' : r < redEnd ? 'blue' : r < 0.80 ? 'red' : 'orange';
    } else if (_prog >= 0.22) {
        // score ~12-40: gold and slow time only
        type = r < 0.72 ? 'gold' : 'blue';
    }
    // score 0-12: gold only
    if (coinBlockedByStal(wx, coinY)) return null;
    return { wx, y: coinY, collected: false, type, fade: 1.0 };
}

function maintainCoins() {
    while (nextCoinWx < scrollX + W + 500) {
        const coin = makeCoin(nextCoinWx);
        if (coin) coins.push(coin);
        nextCoinWx += coinSpacing() * (0.65 + rng() * 0.70);
    }
    while (coins.length && (coins[0].wx < scrollX - 200 || (!coins[0].collected && coins[0].fade <= 0))) {
        coins.shift();
    }
}

function checkCoinCollection() {
    const hitR = activeSkin === 1 ? COIN_HIT_R * 1.5 : COIN_HIT_R;
    const r2 = (PR + hitR) * (PR + hitR);
    for (const arr of [coins, chicaneCoins]) for (const coin of arr) {
        if (coin.collected) continue;
        const sx = coin.wx - scrollX;
        if (sx < -60 || sx > W + 60) continue;
        const dx = PX - sx, dy = py - coin.y;
        if (dx*dx + dy*dy < r2) {
            coin.collected = true;
            if (coinComboTimer > 0) coinCombo++; else coinCombo = 1;
            coinComboTimer = activeSkin === 4 ? 3.0 : 2.0;
            const pts = coinCombo * 3;
            bonusScore += pts;
            runCoins++;
            if (coinCombo > runMaxCombo) runMaxCombo = coinCombo;
            if (coin.type === 'blue') {
                slowTime = Math.min(slowTime + (activeSkin === 3 ? 6.0 : 4.0), activeSkin === 3 ? 12.0 : 8.0);
                burstCoin(sx, coin.y, 195, 26);
                shake += 3;
                notifs.push({ x: sx, y: coin.y - 16, life: 1.1, text: T.notifSlow,   color: [60,210,255] });
                sfxSlow();
                window.webkit?.messageHandlers?.haptic?.postMessage('light');
            } else if (coin.type === 'red') {
                shieldCount = Math.min(shieldCount + 1, 3);
                burstCoin(sx, coin.y, 0, 26);
                shake += 3;
                notifs.push({ x: sx, y: coin.y - 16, life: 1.1, text: T.notifShield, color: [255,90,90] });
                sfxShield();
                window.webkit?.messageHandlers?.haptic?.postMessage('success');
            } else if (coin.type === 'green') {
                magnetTime = Math.min(magnetTime + 3.0, 5.0);
                burstCoin(sx, coin.y, 120, 26);
                shake += 3;
                notifs.push({ x: sx, y: coin.y - 16, life: 1.1, text: T.notifMagnet, color: [80,255,130] });
                sfxMagnet();
                window.webkit?.messageHandlers?.haptic?.postMessage('light');
            } else if (coin.type === 'orange') {
                bulletAmmo = Math.min(bulletAmmo + 5, 10);
                bulletFireTimer = 0;
                burstCoin(sx, coin.y, 28, 26);
                shake += 3;
                notifs.push({ x: sx, y: coin.y - 16, life: 1.1, text: T.notifAmmo, color: [255,85,0] });
                sfxBulletPickup();
                window.webkit?.messageHandlers?.haptic?.postMessage('light');
            } else {
                gapBonus = Math.min(GAP_BONUS_MAX, gapBonus + GAP_PER_COIN * (activeSkin === 4 ? 2 : 1));
                burstCoin(sx, coin.y, 44);
                notifs.push({ x: sx, y: coin.y - 16, life: 1.1, text: `+${pts}`, color: [255,220,55] });
                if (coinCombo > 1) {
                    notifs.push({ x: sx, y: coin.y - 48, life: 1.3, text: `x${coinCombo}`, color: [255,255,80] });
                    sfxCombo(coinCombo);
                }
                sfxCoin();
                window.webkit?.messageHandlers?.haptic?.postMessage('light');
            }
        }
    }
}

// ── Bullet system ─────────────────────────────────────────────────────

function updateBullets(dt) {
    if (bulletAmmo > 0) {
        bulletFireTimer = Math.max(0, bulletFireTimer - dt);
        if (bulletFireTimer <= 0) {
            bulletAmmo--;
            bulletFireTimer = 0.32;
            bullets.push({ wx: scrollX + PX + PR * 1.6, y: py });
            sfxBulletFire();
        }
    }
    const bulletSpd = scrollSpd() + 480;
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.wx += bulletSpd * dt;
        const bsx = b.wx - scrollX;
        if (bsx > W * 1.8 + 20) { bullets.splice(i, 1); continue; }
        let hit = false;
        for (const s of stalactites) {
            if (s.dying) continue;
            if (stalHitBullet(s, bsx, b.y)) {
                s.dying = true;
                s.fade  = 1.0;
                const bnd  = boundsAt(s.wx);
                const tipY = s.isTop ? bnd.top + s.length : bnd.bot - s.length;
                burstStalCrack(bsx, tipY);
                sfxStalCrack();
                window.webkit?.messageHandlers?.haptic?.postMessage('light');
                hit = true;
                break;
            }
        }
        if (!hit) {
            for (let mi = mines.length - 1; mi >= 0; mi--) {
                const m  = mines[mi];
                const dx = b.wx - m.wx;
                const my = m.baseY + m.bobAmp * Math.sin(gtime * 1.8 + m.phase);
                const dy = b.y - my;
                if (dx*dx + dy*dy < (MINE_R + 10) * (MINE_R + 10)) {
                    mines.splice(mi, 1);
                    shake += 8;
                    burst(bsx, my);
                    notifs.push({ x: bsx, y: my - H*0.06, life: 1.1, text: T.boom, color: [255, 120, 20] });
                    sfxMineExplode();
                    window.webkit?.messageHandlers?.haptic?.postMessage('medium');
                    hit = true;
                    break;
                }
            }
        }
        if (hit) bullets.splice(i, 1);
    }
    for (let i = stalactites.length - 1; i >= 0; i--) {
        if (stalactites[i].dying) {
            stalactites[i].fade = Math.max(0, stalactites[i].fade - dt * 4.5);
            if (stalactites[i].fade <= 0) stalactites.splice(i, 1);
        }
    }
}

function drawBullets() {
    for (const b of bullets) {
        const bsx = b.wx - scrollX;
        if (bsx < -10 || bsx > W + 10) continue;
        ctx.save();
        ctx.shadowColor = 'rgba(255,150,0,0.95)';
        ctx.shadowBlur  = 14;
        ctx.fillStyle   = '#ffaa00';
        ctx.beginPath();
        ctx.ellipse(bsx, b.y, 18, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

// ── Mine system ───────────────────────────────────────────────────────

function makeMine(wx) {
    // Never place a mine inside a chicane (shrinks at high density so mines don't disappear)
    const chicaneExclude = lerp(120, 50, _prog2);
    let nearTop = false, nearBot = false;
    for (const s of stalactites) {
        if (Math.abs(s.wx - wx) > chicaneExclude) continue;
        if (s.isTop) nearTop = true; else nearBot = true;
    }
    if (nearTop && nearBot) return null;

    const bobAmp = lerp(H * 0.02, H * 0.035, _prog);
    const b      = boundsBase(wx);
    const margin = MINE_R + PR * 2.5;
    let lo = b.top + margin, hi = b.bot - margin;

    // Push mine away from single nearby stalactite tips
    for (const s of stalactites) {
        if (Math.abs(s.wx - wx) > 300) continue;
        const sb = boundsBase(s.wx);
        if (s.isTop) {
            const tipY = sb.top + s.length;
            lo = Math.max(lo, tipY + bobAmp);
        } else {
            const tipY = sb.bot - s.length;
            hi = Math.min(hi, tipY - bobAmp);
        }
    }

    if (hi - lo < MINE_R * 2) return null;
    const baseY = lo + rng() * (hi - lo);
    return { wx, baseY, phase: rng() * Math.PI * 2, bobAmp };
}

function maintainMines() {
    while (nextMineWx < scrollX + W + 600) {
        const mine = makeMine(nextMineWx);
        if (mine) mines.push(mine);
        nextMineWx += mineSpacing() * (0.70 + rng() * 0.60);
    }
    while (mines.length && mines[0].wx < scrollX - 150) mines.shift();
}

// ── Triangle-circle collision ─────────────────────────────────────────

function ptSeg2(px, py, ax, ay, bx, by) {
    const dx = bx-ax, dy = by-ay, l2 = dx*dx+dy*dy;
    if (l2 === 0) return (px-ax)*(px-ax) + (py-ay)*(py-ay);
    const t  = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / l2));
    const nx = ax+t*dx-px, ny = ay+t*dy-py;
    return nx*nx + ny*ny;
}

function inTri(px, py, ax, ay, bx, by, cx, cy) {
    const d1 = (px-bx)*(ay-by) - (ax-bx)*(py-by);
    const d2 = (px-cx)*(by-cy) - (bx-cx)*(py-cy);
    const d3 = (px-ax)*(cy-ay) - (cx-ax)*(py-ay);
    return !((d1<0||d2<0||d3<0) && (d1>0||d2>0||d3>0));
}

function stalHit(s, r = PR) {
    const sx = s.wx - scrollX;
    if (sx < -80 || sx > W + 80) return false;
    const b = boundsAt(s.wx), hw = s.width / 2 * 0.85, r2 = r * r;
    let ax, ay, bx2, by2, tx, ty;
    if (s.isTop) {
        ax = sx-hw; ay = b.top; bx2 = sx+hw; by2 = b.top; tx = sx; ty = b.top+s.length;
    } else {
        ax = sx-hw; ay = b.bot; bx2 = sx+hw; by2 = b.bot; tx = sx; ty = b.bot-s.length;
    }
    return inTri(PX, py, ax, ay, bx2, by2, tx, ty)
        || ptSeg2(PX, py, ax,  ay,  tx,  ty ) < r2
        || ptSeg2(PX, py, bx2, by2, tx,  ty ) < r2
        || ptSeg2(PX, py, ax,  ay,  bx2, by2) < r2;
}

function stalHitBullet(s, bsx, by) {
    const sx = s.wx - scrollX;
    if (Math.abs(sx - bsx) > s.width / 2 + 8) return false;
    const b = boundsAt(s.wx), hw = s.width / 2 * 0.85;
    let ax, ay, bx2, by2, tx, ty;
    if (s.isTop) {
        ax = sx-hw; ay = b.top; bx2 = sx+hw; by2 = b.top; tx = sx; ty = b.top+s.length;
    } else {
        ax = sx-hw; ay = b.bot; bx2 = sx+hw; by2 = b.bot; tx = sx; ty = b.bot-s.length;
    }
    const r2 = 36;
    return inTri(bsx, by, ax, ay, bx2, by2, tx, ty)
        || ptSeg2(bsx, by, ax,  ay,  tx,  ty ) < r2
        || ptSeg2(bsx, by, bx2, by2, tx,  ty ) < r2
        || ptSeg2(bsx, by, ax,  ay,  bx2, by2) < r2;
}

// ── Particles ─────────────────────────────────────────────────────────

function burst(x, y, count = 32) {
    for (let i = 0; i < count; i++) {
        const a = Math.random()*Math.PI*2, v = 65+Math.random()*225;
        parts.push({ x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v,
                     life: 1.0, r: 1.5+Math.random()*4, h: 22+Math.random()*55 });
    }
}

// Coin sparkle: tight ring of gold particles. Power-up coins pass a larger
// count so they read as a bigger moment than the constant stream of gold.
function burstCoin(x, y, baseHue = 44, count = 14) {
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const v = 70 + Math.random() * 110;
        parts.push({ x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v,
                     life: 0.75, r: 1.2+Math.random()*2.5, h: baseHue+Math.random()*20 });
    }
}

// Stalactite destruction debris
function burstStalCrack(x, y) {
    for (let i = 0; i < 22; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 60 + Math.random() * 200;
        parts.push({ x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v,
                     life: 0.5 + Math.random() * 0.4, r: 2 + Math.random() * 3.5, h: 25 + Math.random() * 20 });
    }
}
