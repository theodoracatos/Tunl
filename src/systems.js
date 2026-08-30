// ── Stalactite system ─────────────────────────────────────────────────

function makeStal(wx, isTop) {
    const length = _halfGap * stalLenFrac() * (0.55 + rng() * 0.45);
    const width  = W * lerp(0.030, 0.018, _prog) * (0.70 + rng() * 0.40);
    return { wx, isTop, length, width, fade: 1.0, dying: false };
}

function maintainStalactites() {
    while (nextStalWx < scrollX + W + 600) {
        const spacing = stalSpacing() * (0.65 + rng() * 0.70);
        if (_prog > 0.40 && rng() < Math.min(lerp(0.24, 0.42, _prog2) * DAY_ARCHETYPES[_dayArchetype].chic, 0.62)) {
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

// ── Floating notifications ──────────────────────────────────────────────

// At high scroll speed, coins can chain fast enough that several pickup notifs
// are alive at once, all spawned at roughly the same screen spot (the coin sits
// right where the player just was). Left alone they render on top of each other
// right over the ship. Counting how many live notifs are already near this x and
// nudging the new one further up turns a pile into a readable vertical stack.
function notifStackOffset(x) {
    const nearby = notifs.filter(n => n.life > 0 && Math.abs(n.x - x) < 50).length;
    return nearby * 20;
}

function pushNotif(x, y, life, text, color) {
    notifs.push({ x, y: y - notifStackOffset(x), life, text, color });
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
    // Type isn't rolled until after coinY is picked below, so the clearance buffer
    // has to reserve room for the largest possible size (constants.js
    // COIN_SIZE_MAX_MULT), not the average -- otherwise a rare magnet/bomb coin
    // could land close enough to a wall to visually clip it.
    const buf = COIN_R * COIN_SIZE_MAX_MULT * 2;
    const lo  = Math.max(bBase.top, visTop) + buf;
    const hi  = Math.min(bBase.bot, visBot) - buf;
    if (hi <= lo) return null;
    const cy     = (lo + hi) / 2;
    const margin = (hi - lo) * 0.40;
    const coinY  = Math.max(lo, Math.min(hi, cy + (rng() - 0.5) * 2 * margin));
    const r = rng();
    let type = 'gold';
    if (_prog >= 0.38) {
        // score 34+: weighted shares that sum to 1, normalized against whatever's
        // left, rather than the old chain of sequential thresholds. That older shape
        // is what let shield's real share crater to ~2-3.5% for its first third
        // (score 34-71) -- right as mines start appearing -- purely because it was
        // computed as "whatever's left after blue" instead of being given an
        // explicit floor (UX audit, Befund 3 / Konzept 07). wBlue/wOrange stay flat
        // at their old approximate values (continuity with the previous curve);
        // wRed now has a real floor at introduction and grows to the same ceiling
        // (21%) the old curve reached at max difficulty.
        const t     = Math.min((_prog - 0.38) / 0.62, 1); // 0 at score ~34, 1 at score ~233
        const wBlue   = 0.17;
        const wRed    = lerp(0.09, 0.21, t);
        const wOrange = 0.14;
        // Magnet unlocks at score 71 same as before. Its base share now grows with
        // _prog2 (3% -> 6% from score ~233 to ~900) instead of being pinned at a flat
        // 3% forever -- a long marathon run is exactly where a magnet is most
        // "run-defining" for chaining combos, so it shouldn't stay as rare there as
        // it is early on. greenDroughtBias layers a soft, uncapped-frequency (but
        // capped-strength) pity nudge on top -- see constants.js GREEN_DROUGHT_*
        // doc and the greenClock reset below.
        let wGreen = 0;
        if (_prog >= 0.55) {
            const greenBase   = lerp(0.03, 0.06, _prog2);
            const droughtBias = Math.min(1 + greenClock / GREEN_DROUGHT_SOFT_SEC, GREEN_DROUGHT_CAP);
            wGreen = greenBase * droughtBias;
        }
        const wGold = Math.max(0, 1 - wBlue - wRed - wOrange - wGreen);
        const cumGold   = wGold;
        const cumBlue   = cumGold + wBlue;
        const cumRed    = cumBlue + wRed;
        const cumOrange = cumRed + wOrange;
        type = r < cumGold ? 'gold' : r < cumBlue ? 'blue' : r < cumRed ? 'red' : r < cumOrange ? 'orange' : 'green';
    } else if (_prog >= 0.22) {
        // score ~12-40: gold and slow time only
        type = r < 0.72 ? 'gold' : 'blue';
    }
    // score 0-12: gold only
    if (coinBlockedByStal(wx, coinY)) return null;
    // Magnet soft-pity reset: only once a green roll actually clears placement, same
    // reasoning as the poison/bomb clocks below -- resetting on the roll itself
    // (before this check) would mean the ~90%-rejected candidates keep quietly
    // eating the drought counter without a magnet ever actually appearing.
    if (type === 'green') greenClock = 0;
    // Poison/bomb: rare events layered on top of the ladder above once there's some
    // shard economy to matter (score ~40+, same gate as red/orange). Deliberately
    // checked here, AFTER the placement rejection above, not before it: an earlier
    // version rolled a per-candidate probability before this check and calibrated it
    // assuming every candidate survives placement, but coinBlockedByStal rejects a
    // large and difficulty-dependent fraction of candidates (~90% in one measured
    // sample), so that approach was silently ~10x rarer than intended in practice. A
    // real-time clock (constants.js POISON_INTERVAL_SEC doc) sidesteps that: once it
    // passes its jittered target, the next coin that actually clears placement (i.e.
    // reaches this line) becomes that type -- immune to the rejection rate by
    // construction. Poison checked first, bomb second so it can still override on the
    // rare coin where both clocks happen to be ready at once; each resets/rerolls
    // independently regardless of which one wins that tie.
    if (_prog >= 0.38) {
        if (poisonClock >= nextPoisonAt) {
            type = 'poison';
            poisonClock = 0;
            nextPoisonAt = POISON_INTERVAL_SEC * (0.7 + rng() * 0.6);
        }
        if (bombClock >= nextBombAt) {
            type = 'bomb';
            bombClock = 0;
            nextBombAt = BOMB_INTERVAL_SEC * (0.7 + rng() * 0.6);
        }
    }
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
    const baseHitR = activeSkin === 1 ? COIN_HIT_R * masteryLerp(1, 1.5, 1.7) : COIN_HIT_R;
    for (const arr of [coins, chicaneCoins]) for (const coin of arr) {
        if (coin.collected) continue;
        const sx = coin.wx - scrollX;
        if (sx < -60 || sx > W + 60) continue;
        // Hitbox scales with the same per-type size multiplier as the drawn coin
        // (constants.js COIN_SIZE_MULT) -- a visually bigger rare pickup shouldn't
        // have a smaller effective reach than a common one right next to it.
        const hitR = baseHitR * (COIN_SIZE_MULT[coin.type] || 1.0);
        const r2 = (PR + hitR) * (PR + hitR);
        const dx = PX - sx, dy = py - coin.y;
        if (dx*dx + dy*dy < r2) {
            coin.collected = true;
            if (coin.type === 'poison') {
                // Hazard coin: breaks any active combo and claws back a percentage of
                // this run's *pending* shard bank instead of adding to it -- the
                // risk/reward counterweight to gold, deliberately harsh (see constants.js
                // POISON_LOSS_PCT_MIN/MAX doc: this compounds over repeated hits on
                // purpose, unlike the flat model it replaced). Comes out of runCoins
                // (this run's collected-coin count, banked into the persistent `shards`
                // balance at death, capped by DAILY_SHARD_CAP -- see update.js die()),
                // never the persistent balance itself, so a poison touch can only cost
                // progress not yet banked. Math.ceil rather than round so a small pool's
                // percentage can't round down to a 0-coin no-op hit.
                coinCombo = 0; coinComboTimer = 0;
                const lossPct = lerp(POISON_LOSS_PCT_MIN, POISON_LOSS_PCT_MAX, _prog);
                const loss = runCoins > 0 ? Math.min(runCoins, Math.max(1, Math.ceil(runCoins * lossPct))) : 0;
                runCoins -= loss;
                burstCoin(sx, coin.y, 100, 22);
                shake += 6;
                if (loss > 0) pushNotif(sx, coin.y - 34, 1.1, `-${loss}\u200A⧫`, [140,225,40]);
                sfxPoison();
                window.webkit?.messageHandlers?.haptic?.postMessage('warning');
                continue;
            }
            if (coinComboTimer > 0) coinCombo++; else coinCombo = 1;
            // ELECTRIC trades a shorter combo window for its slow-time buff below; mastery
            // eases it back toward the 2.0s baseline (see constants.js masteryLerp).
            coinComboTimer = activeSkin === 3 ? masteryLerp(3, 1.5, 2.0) : 2.0;
            const pts = coinCombo * 3;
            bonusScore += pts;
            runCoins++;
            skinXP[activeSkin] = (skinXP[activeSkin] || 0) + 1;
            runCoinsByType[coin.type] = (runCoinsByType[coin.type] || 0) + 1; // daily missions
            if (coinCombo > runMaxCombo) runMaxCombo = coinCombo;
            if (coin.type === 'blue') {
                slowTime = Math.min(slowTime + (activeSkin === 3 ? masteryLerp(3, 6.0, 7.5) : 4.0), activeSkin === 3 ? masteryLerp(3, 12.0, 15.0) : 8.0);
                slowTimeMax = slowTime;  // capture the window the scroll + music glide ramps over (world.js slowScrollFactor)
                burstCoin(sx, coin.y, 195, 26);
                shake += 3;
                pushNotif(sx, coin.y - 34, 1.1, T.notifSlow, [60,210,255]);
                sfxSlow();
                bgmSetSlow(true, slowTime);  // music sags, then glides back up over the effect (audio.js)
                window.webkit?.messageHandlers?.haptic?.postMessage('light');
            } else if (coin.type === 'red') {
                // CRIMSON trades shield capacity away for its slim-hitbox buff below;
                // VOID's buff IS extra shield capacity. Mastery grows/heals each toward 5/3.
                const shieldCap = activeSkin === 5 ? Math.round(masteryLerp(5, 4, 5))
                                 : activeSkin === 2 ? Math.round(masteryLerp(2, 2, 3))
                                 : 3;
                shieldCount = Math.min(shieldCount + 1, shieldCap);
                burstCoin(sx, coin.y, 0, 26);
                shake += 3;
                pushNotif(sx, coin.y - 34, 1.1, T.notifShield, [255,90,90]);
                sfxShield();
                window.webkit?.messageHandlers?.haptic?.postMessage('success');
            } else if (coin.type === 'green') {
                magnetTime = Math.min(magnetTime + 3.0, activeSkin === 6 ? masteryLerp(6, 8.0, 11.0) : 5.0);
                burstCoin(sx, coin.y, 120, 26);
                shake += 3;
                pushNotif(sx, coin.y - 34, 1.1, T.notifMagnet, [80,255,130]);
                sfxMagnet();
                magnetLoopOn();  // ambient shimmer for as long as the magnet is live (audio.js)
                window.webkit?.messageHandlers?.haptic?.postMessage('light');
            } else if (coin.type === 'orange') {
                // NOVA trades ammo capacity away for its magnet-duration buff below; mastery
                // heals both the pickup amount and the cap back toward the 5/10 baseline.
                bulletAmmo = Math.min(bulletAmmo + (activeSkin === 6 ? Math.round(masteryLerp(6, 3, 5)) : 5),
                                       activeSkin === 6 ? Math.round(masteryLerp(6, 6, 10)) : 10);
                bulletFireTimer = 0;
                burstCoin(sx, coin.y, 28, 26);
                shake += 3;
                pushNotif(sx, coin.y - 34, 1.1, T.notifAmmo, [255,85,0]);
                sfxBulletPickup();
                window.webkit?.messageHandlers?.haptic?.postMessage('light');
            } else if (coin.type === 'bomb') {
                // Explosive power-up: small blast around the pickup point that clears
                // nearby hazards (see triggerBombExplosion). Sfx lives here, not inside
                // that function, so the "ding-then-boom" pickup identity is a
                // presentation choice, not baked into the explosion logic itself.
                triggerBombExplosion(sx, coin.y);
                burstCoin(sx, coin.y, 280, 26);
                pushNotif(sx, coin.y - 34, 1.1, T.boom, [190,60,255]);
                sfxBomb();
                window.webkit?.messageHandlers?.haptic?.postMessage('heavy');
            } else {
                gapBonus = Math.min(GAP_BONUS_MAX, gapBonus + GAP_PER_COIN * (activeSkin === 4 ? masteryLerp(4, 2.0, 2.5) : 1));
                burstCoin(sx, coin.y, 44);
                // Stack offset computed once and shared by both notifs below: they
                // belong to the same pickup, so they keep their tight fixed 32px gap
                // to each other while still shifting together as a pair when other
                // pickups are already stacked nearby (see notifStackOffset/pushNotif).
                const stackY = coin.y - 34 - notifStackOffset(sx);
                notifs.push({ x: sx, y: stackY, life: 1.1, text: `+${pts}`, color: [255,220,55] });
                if (coinCombo > 1) {
                    notifs.push({ x: sx, y: stackY - 32, life: 1.3, text: `x${coinCombo}`, color: [255,255,80] });
                    sfxCombo(coinCombo);
                }
                sfxCoin(coinCombo);  // pitch climbs with the combo (audio.js)
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
    // slowScrollFactor() folds the blue-coin slow (and its glide back to full) into
    // the bullet's travel too, so during bullet-time the player's own fire crawls with
    // the rest of the world instead of streaking through a slowed tunnel.
    const bulletSpd = (scrollSpd() + 480) * slowScrollFactor();
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
                    pushNotif(bsx, my - H*0.06, 1.1, T.boom, [255, 120, 20]);
                    sfxMineExplode();
                    window.webkit?.messageHandlers?.haptic?.postMessage('medium');
                    hit = true;
                    break;
                }
            }
        }
        if (!hit) {
            for (let ci = cannonShots.length - 1; ci >= 0; ci--) {
                const s   = cannonShots[ci];
                const scx = s.wx - scrollX;
                const cdx = bsx - scx, cdy = b.y - s.y;
                if (cdx*cdx + cdy*cdy < (CANNON_SHOT_R + 10) * (CANNON_SHOT_R + 10)) {
                    cannonShots.splice(ci, 1);
                    burstStalCrack(bsx, b.y);
                    sfxStalCrack();
                    window.webkit?.messageHandlers?.haptic?.postMessage('light');
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

// Shared projectile sprite: player bullets (always horizontal) and cannon shots
// (fired diagonally, see updateCannonShots) both render through this, so a cannon
// shot reads as literal enemy artillery fire, not a different weapon type.
function drawProjectile(x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    if (angle) ctx.rotate(angle);
    ctx.shadowColor = 'rgba(255,150,0,0.95)';
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = '#ffaa00';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
}

function drawBullets() {
    for (const b of bullets) {
        const bsx = b.wx - scrollX;
        if (bsx < -10 || bsx > W + 10) continue;
        drawProjectile(bsx, b.y, 0);
    }
}

// ── Mine system ───────────────────────────────────────────────────────
//
// Placement deliberately uses boundsBase() (the un-bonused corridor), never boundsAt() --
// this is the one obstacle type that ISN'T wall-anchored, so it's also the one thing a
// maxed gapBonus can't neutralize. Stalactites/chicanes are absolute-length and
// wall-rooted (world.js/constants.js caps: stalLenFrac hard-capped, wave amplitude caps
// at _prog2=2), so once those geometry knobs saturate (~score 1567), a player holding a
// maxed coin bonus can park near the corridor's vertical center and never be threatened
// by a wall or stalactite again, no matter how far scrollSpd() (uncapped, see world.js)
// keeps climbing -- speed alone doesn't make a stationary target unsafe. Mines are what
// closes that gap: because they're placed anywhere across the full un-bonused corridor
// width, not just jutting from a wall, "hover at center" doesn't defend against them, and
// dodging an unpredictable mine still needs a real, MAX_VY-bounded reaction every
// mineSpacing() world-px -- which keeps shrinking in real time as scrollSpd rises without
// limit. That's what actually guarantees no run survives forever, however skilled. Don't
// change this to boundsAt()/gapBonus-aware placement -- it would remove the only hazard
// type that can't be trivialized by parking, and nothing else in the difficulty system
// would still guarantee an eventual death.
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

// ── Cannon system ─────────────────────────────────────────────────────
// A cannon is a wall-mounted turret, not a projectile itself -- it's inert
// (not solid, can't be flown into) until the player closes to within
// CANNON_FIRE_LEAD world-px, at which point it fires exactly one diagonal
// shot and goes dormant. See updateCannonShots for the fire trigger + the
// shot's own movement/collision.

function makeCannon(wx) {
    // Skip if it'd land right on top of a stalactite chicane -- keeps the visual
    // (and the fair-warning read) clean rather than layering two hazards at once.
    for (const s of stalactites) {
        if (Math.abs(s.wx - wx) < 140) return null;
    }
    return { wx, isTop: rng() < 0.5, fireAtWx: wx - CANNON_FIRE_LEAD, fired: false };
}

function maintainCannons() {
    while (nextCannonWx < scrollX + W + 900) {
        const cannon = makeCannon(nextCannonWx);
        if (cannon) cannons.push(cannon);
        nextCannonWx += cannonSpacing() * (0.75 + rng() * 0.50);
    }
    while (cannons.length && cannons[0].wx < scrollX - 200) cannons.shift();
}

function updateCannonShots(dt) {
    const playerWx = scrollX + PX;
    for (const c of cannons) {
        if (c.fired || playerWx < c.fireAtWx) continue;
        c.fired = true;
        const b = boundsAt(c.wx);
        const muzzleY    = c.isTop ? b.top + CANNON_R * 1.1 : b.bot - CANNON_R * 1.1;
        const closingSpd = CANNON_FIRE_LEAD / CANNON_SHOT_TRAVEL;
        // Crosses most (not all) of the corridor diagonally -- a rng()-picked span so
        // successive cannons don't all draw the exact same line across the tunnel.
        const spanY = (b.bot - b.top) * (0.55 + rng() * 0.35) * (c.isTop ? 1 : -1);
        cannonShots.push({
            wx: c.wx, y: muzzleY,
            vx: scrollSpd() - closingSpd,
            vy: spanY / CANNON_SHOT_TRAVEL,
        });
        burst(c.wx - scrollX, muzzleY, 10);
        sfxCannonFire();
    }
    // Same slowScrollFactor() scaling as the player's bullets and the scroll itself:
    // an enemy shot fired just before (or during) a blue-coin slow decelerates with
    // everything else, then speeds back up along the glide as the effect wears off.
    const shotSlowF = slowScrollFactor();
    for (let i = cannonShots.length - 1; i >= 0; i--) {
        const s = cannonShots[i];
        s.wx += s.vx * shotSlowF * dt;
        s.y  += s.vy * shotSlowF * dt;
        const bsx = s.wx - scrollX;
        if (bsx < -100) { cannonShots.splice(i, 1); continue; }
        // Flew into a wall before reaching the player -- spark and remove rather than
        // letting it visibly clip through solid rock.
        const sb = boundsAt(s.wx);
        if (s.y < sb.top - 4 || s.y > sb.bot + 4) {
            burstStalCrack(bsx, Math.max(sb.top, Math.min(sb.bot, s.y)));
            cannonShots.splice(i, 1);
        }
    }
}

// ── Bomb explosion ────────────────────────────────────────────────────
// Triggered by collecting a bomb coin (see checkCoinCollection). A small blast
// centered on the pickup point (cx/cy in screen space) that clears every nearby
// hazard: fades out stalactites the same way a bullet-destroyed one does, pops
// mines and in-flight cannon shots, and disables (but doesn't remove -- it's
// still a solid wall fixture, see draw.js) any cannon that hasn't fired yet,
// same as a bullet/shield destroying one of those, now with its own burst so
// it reads as caught in the explosion rather than just quietly switched off.
// Purely logic + particles -- the sfx lives with the pickup itself (systems.js
// checkCoinCollection) so this can't double up if ever called from elsewhere.

function triggerBombExplosion(cx, cy) {
    const r2 = BOMB_RADIUS * BOMB_RADIUS;
    for (const s of stalactites) {
        if (s.dying) continue;
        const sx = s.wx - scrollX;
        const b  = boundsAt(s.wx);
        const tipY = s.isTop ? b.top + s.length : b.bot - s.length;
        const dx = sx - cx, dy = tipY - cy;
        if (dx*dx + dy*dy < r2) {
            s.dying = true; s.fade = 1.0;
            burstStalCrack(sx, tipY);
        }
    }
    for (let mi = mines.length - 1; mi >= 0; mi--) {
        const m  = mines[mi];
        const sx = m.wx - scrollX;
        const my = m.baseY + m.bobAmp * Math.sin(gtime * 1.8 + m.phase);
        const dx = sx - cx, dy = my - cy;
        if (dx*dx + dy*dy < r2) {
            mines.splice(mi, 1);
            burst(sx, my);
        }
    }
    for (let ci = cannonShots.length - 1; ci >= 0; ci--) {
        const s  = cannonShots[ci];
        const sx = s.wx - scrollX;
        const dx = sx - cx, dy = s.y - cy;
        if (dx*dx + dy*dy < r2) {
            cannonShots.splice(ci, 1);
            burstStalCrack(sx, s.y);
        }
    }
    for (const c of cannons) {
        if (c.fired) continue;
        const sx = c.wx - scrollX;
        const b  = boundsAt(c.wx);
        const wallY = c.isTop ? b.top : b.bot;
        const dx = sx - cx, dy = wallY - cy;
        if (dx*dx + dy*dy < r2) {
            c.fired = true; // disabled, same dimmed look as spent
            burst(sx, wallY); // reads as destroyed, not just quietly switched off
        }
    }
    burst(cx, cy, 60, 265, 300);
    shake += 14;
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

function burst(x, y, count = 32, hueMin = 22, hueMax = 77) {
    for (let i = 0; i < count; i++) {
        const a = Math.random()*Math.PI*2, v = 65+Math.random()*225;
        parts.push({ x, y, vx: Math.cos(a)*v, vy: Math.sin(a)*v,
                     life: 1.0, r: 1.5+Math.random()*4, h: hueMin+Math.random()*(hueMax-hueMin) });
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
