// ── Update ────────────────────────────────────────────────────────────

let prev = 0;

function update(dt) {
    gtime += dt;

    // Particles (always running)
    for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.x += p.vx*dt; p.y += p.vy*dt; const d0 = 0.90 ** (dt * 60); p.vx *= d0; p.vy *= d0;
        p.life -= dt * 2.0;
        if (p.life <= 0) parts.splice(i, 1);
    }

    // Thruster particles
    for (let i = thrustParts.length - 1; i >= 0; i--) {
        const p = thrustParts[i];
        p.x += p.vx*dt; p.y += p.vy*dt; const d1 = 0.88 ** (dt * 60); p.vx *= d1; p.vy *= d1;
        p.life -= dt * 3.2;
        if (p.life <= 0) thrustParts.splice(i, 1);
    }
    if (holding && phase === 'play') {
        for (const ns of [-1, 1]) {
            const ey = py + ns * PR * 0.50;
            for (let i = 0; i < 4; i++) {
                const spread = (Math.random() - 0.5) * PR * 0.13;
                const blue   = Math.random() < 0.35;
                thrustParts.push({
                    x:    PX - PR * 0.74,
                    y:    ey + spread,
                    vx:   -(280 + Math.random() * 480),
                    vy:   spread * 1.8 + (Math.random() - 0.5) * 8,
                    life: 0.35 + Math.random() * 0.45,
                    r:    1.8 + Math.random() * 3.0,
                    h:    blue ? 215 + Math.random() * 35 : 15 + Math.random() * 45,
                });
            }
        }
    }

    // Floating notifs (always running)
    for (let i = notifs.length - 1; i >= 0; i--) {
        const n = notifs[i];
        n.y  -= 38 * dt;
        n.life -= dt * 1.1;
        if (n.life <= 0) notifs.splice(i, 1);
    }

    if (phase === 'dead') {
        deadT      += dt;
        flashA      = Math.max(0, flashA  - dt * 2.5);
        shake       = Math.max(0, shake   - dt * 30);
        return;
    }

    if (phase === 'title') {
        titleT  += dt;
        scrollX += 110 * dt;
        refreshWave();
        const { top: _tTop, bot: _tBot } = boundsAt(scrollX + PX);
        py += (_tTop + (_tBot - _tTop) * 0.65 - py) * dt * 2.5;
        const aTSpd = 110 * 0.18;
        for (const p of ambParts) {
            p.x -= aTSpd * p.par * dt;
            p.y += p.vy * dt;
            if (p.x < -4) p.x += W + 8;
            if (p.y < 0)  p.y = H;
            if (p.y > H)  p.y = 0;
        }
        if (showSettings && _resetHolding) {
            resetHoldT = Math.min(resetHoldT + dt / RESET_HOLD_TIME, 1);
            if (resetHoldT >= 1) {
                resetProgress();
                _resetHolding = false;
                resetHoldT = 0;
                resetFlash = 1;
            }
        } else {
            resetHoldT = Math.max(resetHoldT - dt * 3, 0);
        }
        if (resetFlash > 0) resetFlash = Math.max(0, resetFlash - dt / 1.2);
        return;
    }

    // Launch animation: ship rises from below and rotates to horizontal over 1.3s
    if (startRamp < 1) {
        startRamp = Math.min(startRamp + dt / 1.3, 1);
        const et  = startRamp * startRamp * (3 - 2 * startRamp); // smoothstep
        py        = lerp(H + PR * 4, H / 2, et);
        vy        = 0;
        shipPitch = lerp(-Math.PI / 2, 0, et);
        // Exhaust particles firing downward (ship is pointing up)
        for (let i = 0; i < 3; i++) {
            const sp = (Math.random() - 0.5) * PR * 1.4;
            thrustParts.push({
                x: PX + sp,  y: py + PR * 0.85 + (Math.random() - 0.5) * PR * 0.4,
                vx: sp * 3.5 + (Math.random() - 0.5) * 25,  vy: 90 + Math.random() * 170,
                life: 0.6 + Math.random() * 0.3,  r: 1.0 + Math.random() * 2.4,
                h: 18 + Math.random() * 38,
            });
        }
        // Tunnel starts scrolling only in the last 15% of launch
        const lf = Math.max(0, (startRamp - 0.85) / 0.15);
        scrollX += scrollSpd() * lf * lf * dt;
        refreshWave();
        score = Math.floor(scrollX / 60) + bonusScore;
        maintainStalactites(); maintainCoins(); maintainMines();
        return;
    }

    // Physics
    vy += (holding ? -THRUST + GRAVITY : GRAVITY) * dt;
    vy  = Math.max(-MAX_VY, Math.min(MAX_VY, vy));
    py += vy * dt;

    // Gap bonus / slow / magnet decay
    gapBonus   = Math.max(0, gapBonus   - GAP_DECAY * dt);
    slowTime   = Math.max(0, slowTime   - dt);
    magnetTime = Math.max(0, magnetTime - dt);

    // Scroll + score
    const spd = scrollSpd() * (slowTime > 0 ? 0.60 : 1.0);
    scrollX += spd * dt;
    refreshWave();
    score = Math.floor(scrollX / 60) + bonusScore;

    // Milestone check
    if (score >= milestoneNext) {
        triggerMilestone(milestoneNext);
        milestoneNext += milestoneNext < 100 ? 25 : 50;
    }

    // Near-miss bonus (wall proximity)
    nearMissTimer = Math.max(0, nearMissTimer - dt);
    if (nearMissTimer <= 0) {
        const nmB = boundsAt(scrollX + PX);
        const nmC = Math.min(py - PR - nmB.top, nmB.bot - (py + PR));
        if (nmC >= 0 && nmC < PR * (activeSkin === 2 ? 3.0 : 2.0)) {
            bonusScore++;
            nearMissTimer = 1.5;
            runNearMisses++;
            notifs.push({ x: PX + W*0.07, y: py - H*0.05, life: 1.0, text: T.notifClose, color: [255,160,60] });
            sfxNearMiss();
        }
    }

    // Coin combo timer decay
    coinComboTimer = Math.max(0, coinComboTimer - dt);
    if (coinComboTimer <= 0) coinCombo = 0;

    // Milestone flash decay
    milestoneFlash = Math.max(0, milestoneFlash - dt * 1.6);

    // Per-skin effects - only spawn while holding, clear timer when released
    if (phase === 'play') {
        if (holding) {
            skinFxT += dt;
            // AMBER (1): small embers from engine
            if (activeSkin === 1 && Math.random() < dt * 4) {
                skinFx.push({ t: 0, x: PX - PR*(0.5+Math.random()*0.5), y: py+(Math.random()-0.5)*PR*0.8,
                              vx: -(10+Math.random()*30), vy: -(8+Math.random()*20), life: 1, r: 0.7+Math.random()*1.1 });
            }
            // CRIMSON (2): small shockwave ring every ~0.45s
            if (activeSkin === 2 && skinFxT > 0.45) {
                skinFxT = 0;
                skinFx.push({ t: 1, x: PX, y: py, r: PR * 0.8, life: 1 });
            }
            // ELECTRIC (3): short crackle bolt every ~0.10s
            if (activeSkin === 3 && skinFxT > 0.10) {
                skinFxT = 0;
                skinFx.push({ t: 2, life: 1, s0: Math.random(), s1: Math.random(), s2: Math.random(), s3: Math.random() });
            }
            // TOXIC (4): small drips from belly
            if (activeSkin === 4 && Math.random() < dt * 3) {
                skinFx.push({ t: 3, x: PX+(Math.random()-0.5)*PR*1.0, y: py+PR*0.4,
                              vx: (Math.random()-0.5)*10, vy: 40+Math.random()*55, life: 1, r: 1.0+Math.random()*1.2 });
            }
        } else {
            skinFxT = 0;
        }
        // Advance existing particles
        for (let i = skinFx.length-1; i >= 0; i--) {
            const f = skinFx[i];
            const decay = f.t === 1 ? 3.5 : f.t === 2 ? 14 : 2.8;
            f.life -= dt * decay;
            if (f.t === 0) { f.x += f.vx*dt; f.y += f.vy*dt; f.vy += 30*dt; }
            if (f.t === 1) { f.r  += PR * 6 * dt; }
            if (f.t === 3) { f.x += f.vx*dt; f.y += f.vy*dt; }
            if (f.life <= 0) skinFx.splice(i, 1);
        }
    }

    // Ship pitch - velocity vector angle, capped at ~40 deg, smoothed
    {
        const MAX_PITCH = 0.70;
        const target = phase === 'play'
            ? Math.max(-MAX_PITCH, Math.min(MAX_PITCH, Math.atan2(vy, scrollSpd())))
            : 0;
        shipPitch += (target - shipPitch) * Math.min(dt * 14, 1);
    }

    // Trail
    trailY.push(py);
    if (trailY.length > 10) trailY.shift();

    // Maintain lists
    maintainStalactites();
    maintainCoins();
    maintainMines();

    // Fade coins that are blocked by a stalactite or have scrolled off the left edge
    for (const arr of [coins, chicaneCoins]) for (const coin of arr) {
        if (coin.collected || coin.fade <= 0) continue;
        const csx = coin.wx - scrollX;
        if (csx < 0) {
            coin.fade = Math.max(0, coin.fade - dt * 8);
        }
    }

    // Wall + stalactite collision (CRIMSON has a slimmer hitbox)
    const cPR = activeSkin === 2 ? PR * 0.82 : PR;
    for (const dx of [-cPR * 0.7, 0, cPR * 0.7]) {
        const b = boundsAt(scrollX + PX + dx);
        if (py - cPR < b.top || py + cPR > b.bot) { if (die()) return; break; }
    }
    if (py - cPR < 0 || py + cPR > H) { if (die()) return; }
    for (const s of stalactites) {
        if (s.dying) continue;
        if (stalHit(s, cPR)) { if (die()) return; break; }
    }

    // Mine collision
    const mineHitR2 = (PR + MINE_R) * (PR + MINE_R);
    for (let mi = 0; mi < mines.length; mi++) {
        const m  = mines[mi];
        const sx = m.wx - scrollX;
        if (sx < -80 || sx > W + 80) continue;
        const my = m.baseY + m.bobAmp * Math.sin(gtime * 1.8 + m.phase);
        const dx = PX - sx, dy = py - my;
        if (dx*dx + dy*dy < mineHitR2) {
            if (die()) return;
            // Shield absorbed - destroy the mine so it can't immediately re-hit
            mines.splice(mi, 1);
            shake += 12;
            burst(sx, my);
            notifs.push({ x: sx, y: my - H*0.06, life: 1.1, text: 'BLOCKED', color: [255, 90, 40] });
            window.webkit?.messageHandlers?.haptic?.postMessage('heavy');
            break;
        }
    }

    // Magnet: pull visible uncollected coins toward the player
    if (magnetTime > 0) {
        const playerWx = scrollX + PX;
        const pullSpeed = W * 1.4;
        for (const arr of [coins, chicaneCoins]) for (const coin of arr) {
            if (coin.collected || coin.fade <= 0) continue;
            const csx = coin.wx - scrollX;
            if (csx < -20 || csx > W + 60) continue;
            const dx = playerWx - coin.wx, dy = py - coin.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 1) {
                const move = Math.min(pullSpeed * dt, dist);
                coin.wx += (dx / dist) * move;
                coin.y  += (dy / dist) * move;
            }
        }
    }

    // Coin collection
    checkCoinCollection();

    // Bullets
    updateBullets(dt);

    shake         = Math.max(0, shake         - dt * 30);
    shieldFlash   = Math.max(0, shieldFlash   - dt * 5);
    flashA        = Math.max(0, flashA        - dt * 5);

    // Ambient motes drift at ~18% of play scroll speed (parallax)
    const aSpd = spd * 0.18;
    for (const p of ambParts) {
        p.x -= aSpd * p.par * dt;
        p.y += p.vy * dt;
        if (p.x < -4) p.x += W + 8;
        if (p.y < 0)  p.y = H;
        if (p.y > H)  p.y = 0;
    }
}

function die(bypassShield = false) {
    if (DEV_INVINCIBLE) return false;
    if (!bypassShield && shieldCount > 0) {
        shieldCount--;
        shieldFlash = 1.0; shake = 8;
        // Push to corridor center so the next frame passes collision
        const b = boundsAt(scrollX + PX);
        py = (b.top + b.bot) / 2;
        vy = 0;
        sfxShieldBreak();
        window.webkit?.messageHandlers?.haptic?.postMessage('medium');
        return false;
    }
    thrustOff();
    phase = 'dead'; deadT = 0; flashA = 1.0; shake = 14; holding = false;
    _homeBtnRect = null; _playBtnRect = null;
    prevRunScore = lastRunScore;
    lastRunScore = score;
    newBest = score > best;
    if (newBest) { best = score; localStorage.setItem('tunnel_best', best); }
    runsWithoutPB = newBest ? 0 : runsWithoutPB + 1;
    newDailyBest = score > dailyBest;
    if (newDailyBest) { dailyBest = score; localStorage.setItem('tunnel_daily_best', dailyBest); }
    localStorage.setItem('tunnel_no_pb', runsWithoutPB);
    if (score > 0) {
        top5 = [...top5, score].sort((a, b) => b - a).slice(0, 5);
        localStorage.setItem('tunnel_top5', JSON.stringify(top5));
    }
    skinUnlockIdx = -1;
    for (let i = 1; i < SKINS.length; i++) {
        if (SKINS[i].req && !(unlockedSkins & (1 << i)) && score >= SKINS[i].req) {
            unlockedSkins |= (1 << i);
            skinUnlockIdx = i;
        }
    }
    if (skinUnlockIdx >= 0) localStorage.setItem('tunnel_skins', unlockedSkins);
    // Record a death marker on the nearest wall
    const _dmWx = scrollX + PX;
    const _dmB  = boundsAt(_dmWx);
    const _dmWY = py < (_dmB.top + _dmB.bot) / 2 ? _dmB.top : _dmB.bot;
    deathMarkers.push({ wx: _dmWx, wallY: _dmWY });
    if (deathMarkers.length > MAX_DEATH_MARKERS) deathMarkers.shift();
    if (newBest) {
        bestMarker = { wx: _dmWx, wallY: _dmWY };
        bestSX = _dmWx;
        localStorage.setItem('tunnel_best_sx', bestSX);
    }
    burst(PX, py);
    sfxDie();
    _fadeBgMusic();
    window.webkit?.messageHandlers?.haptic?.postMessage('heavy');
    return true;
}
