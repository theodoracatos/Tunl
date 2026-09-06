// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── Update ────────────────────────────────────────────────────────────

let prev = 0;

function update(dt) {
    gtime += dt;

    // Level intro banner decay -- counts down real elapsed time from run start,
    // independent of the launch-ramp/physics sub-phases below.
    if (phase === 'play') levelIntroT = Math.max(0, levelIntroT - dt);

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
    if (holding && (phase === 'play' || phase === 'title')) {
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
    // On-fire ember trickle: a light, continuous stream distinct from the thrust burst
    // above -- it has to read during BOTH hold and release (releasing is half the
    // control scheme), so it can't be gated by `holding` the way the burst is. Spawned
    // from the same exhaust nozzle points as the burst (PX - PR*0.74, py +/- PR*0.50,
    // one nozzle picked at random each particle) rather than a generic point behind the
    // ship, so it reads as coming out of the ship, not just trailing near it. Sparse
    // (one particle/frame) on purpose: it's ambient texture behind the recolored player
    // trail (draw.js), not the main effect. Hue capped at 22 (hotter/redder than the
    // thrust burst's 15-60 orange range) so it still reads as "extra" next to it.
    if (onFire && phase === 'play') {
        const ns = Math.random() < 0.5 ? -1 : 1;
        const ey = py + ns * PR * 0.50;
        thrustParts.push({
            x:    PX - PR * 0.74 + (Math.random() - 0.5) * PR * 0.15,
            y:    ey + (Math.random() - 0.5) * PR * 0.15,
            vx:   -(60 + Math.random() * 90),
            vy:   ns * (10 + Math.random() * 20) + (Math.random() - 0.5) * 10,
            life: 0.45 + Math.random() * 0.35,
            r:    1.4 + Math.random() * 2.2,
            h:    Math.random() * 22,
            fire: true, // draw.js gives these a glow the plain thrust burst doesn't get
        });
    }

    // Floating notifs (always running)
    for (let i = notifs.length - 1; i >= 0; i--) {
        const n = notifs[i];
        n.y  -= 38 * dt;
        n.life -= dt * 1.1;
        if (n.life <= 0) notifs.splice(i, 1);
    }

    if (phase === 'dead') {
        // Frozen while native has a rewarded ad on screen (continueAdPending) so a
        // slow load or a long watch can't let the timeout below fire out from under
        // a decision the player already made by tapping the offer.
        if (!continueAdPending) deadT += dt;
        flashA      = Math.max(0, flashA  - dt * 2.5);
        shake       = Math.max(0, shake   - dt * 30);
        if (_shareCopiedT > 0) _shareCopiedT -= dt;
        // Continue offer timed out with no tap (constants.js CONTINUE_OFFER_SEC doc --
        // longer than DEATH_INTERACTIVE_SEC on purpose, 0.9s wasn't enough to land a
        // tap on a real device).
        if (continueOfferPending && !continueAdPending && deadT >= CONTINUE_OFFER_SEC) {
            continueOfferPending = false;
            commitDeath();
        }
        return;
    }

    // Revive countdown (constants.js REVIVE_COUNTDOWN_SEC doc, grantRevive() above):
    // world stays frozen -- returning early here means scrollX, physics, and
    // collision are all untouched for the duration, same as the launch-ramp branch
    // below does for a fresh run. Once it runs out, play actually resumes and only
    // then does the post-revive grace window start.
    if (phase === 'revive') {
        reviveCountdownT = Math.max(0, reviveCountdownT - dt);
        if (reviveCountdownT <= 0) {
            phase = 'play';
            invulnT = HIT_INVULN_SEC;
            // input.js only starts the thrust engine loop from an onDown while
            // phase === 'play' -- if the player is already holding through the
            // countdown (nothing to do but wait), sync it here so thrust force
            // doesn't silently start applying with no engine sound behind it.
            if (holding) thrustOn();
        }
        return;
    }

    if (phase === 'title') {
        titleT  += dt;
        scrollX += 110 * dt;
        refreshWave();
        const { top: _tTop, bot: _tBot } = boundsAt(scrollX + PX);
        const prevPy = py;
        py += (_tTop + (_tBot - _tTop) * 0.65 - py) * dt * 2.5;
        const demoVy = dt > 0 ? (py - prevPy) / dt : 0;
        holding = demoVy < -4;
        const MAX_PITCH = 0.70;
        const pitchTarget = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, Math.atan2(demoVy, 110)));
        shipPitch += (pitchTarget - shipPitch) * Math.min(dt * 14, 1);
        maintainStalactites();
        const aTSpd = 110 * 0.18;
        for (const p of ambParts) {
            p.x -= aTSpd * p.par * dt;
            p.y += p.vy * dt;
            if (p.x < -4) p.x += W + 8;
            if (p.y < 0)  p.y = H;
            if (p.y > H)  p.y = 0;
        }
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
        maintainStalactites(); maintainCoins(); maintainMines(); maintainCannons();
        return;
    }

    // Physics
    // Gravity is withheld entirely until the player's first hold input of this run
    // (see hasHeldThisRun in state.js) -- otherwise a run that starts with holding
    // already false plummets from a centered launch into the tunnel wall in under a
    // second, with no obstacle to blame and no time to react. That grace expires on
    // its own past HOLD_GATE_MAX_SEC (constants.js) even with zero input, so a player
    // who never presses at all can't ride a risk-free straight glide indefinitely --
    // gravity engages exactly as if the gate had never existed.
    if (!hasHeldThisRun && idleHoldTimer > HOLD_GATE_MAX_SEC) hasHeldThisRun = true;
    vy += (holding ? -THRUST + GRAVITY : (hasHeldThisRun ? GRAVITY : 0)) * dt;
    vy  = Math.max(-MAX_VY, Math.min(MAX_VY, vy));
    py += vy * dt;
    // Idle-hold hint timer (draw.js IDLE_HINT_DELAY) -- only worth counting up before
    // the player's first press; irrelevant forever after, so don't bother once true.
    if (!hasHeldThisRun) idleHoldTimer += dt;

    // Gap bonus / slow / magnet decay
    // TOXIC trades faster gap-bonus decay for its 2x-per-coin buff (systems.js) --
    // has to keep collecting to hold the wider corridor, not just bank it once. Mastery
    // eases the decay rate back down (never fully to baseline -- see masteryLerp doc).
    gapBonus   = Math.max(0, gapBonus   - GAP_DECAY * (activeSkin === 4 ? masteryLerp(4, 1.6, 1.2) : 1.0) * dt);
    // gapBonusVisual chases the instant-jump gapBonus target at a constant rate
    // instead of snapping to it (constants.js GAP_EASE_RATE doc) - this is the
    // value collision/rendering actually use, so the wall visibly widens rather
    // than teleporting.
    gapBonusVisual += Math.max(-GAP_EASE_RATE * dt, Math.min(GAP_EASE_RATE * dt, gapBonus - gapBonusVisual));
    const _slowWas = slowTime > 0, _magWas = magnetTime > 0;
    slowTime   = Math.max(0, slowTime   - dt);
    magnetTime = Math.max(0, magnetTime - dt);
    // Falling-edge only: the pickups turn these audio states ON from systems.js (so a
    // top-up mid-effect can't retrigger the ramp-in), and the frame the timer runs out
    // turns them back OFF here.
    if (_slowWas && slowTime <= 0)   bgmSetSlow(false);
    if (_magWas  && magnetTime <= 0) magnetLoopOff();

    // Scroll + score
    const spd = scrollSpd() * slowScrollFactor();
    scrollX += spd * dt;
    refreshWave();
    score = Math.floor(scrollX / 60) + bonusScore;

    // On fire: fires once, the frame live score first overtakes the bar it has to beat.
    // That bar is today's daily best, EXCEPT on the day's first run where dailyBest is
    // still 0 -- there it falls back to the all-time best so a strong first run of the
    // day still catches fire when it passes into record territory (the alternative,
    // `dailyBest > 0` alone, left the day's first run unable to ignite at all no matter
    // how far it flew). `_fireBar > 0` still guards the very first run a new player ever
    // starts, where both are 0 and `score > 0` would otherwise light this up at score 1.
    // (dailyRuns > 0 looks like the same gate but isn't: it's incremented in startPlay()
    // before the run's first frame, so it's already >=1 by the time this code runs at
    // all and never actually blocks anything.) Monotonic within a run (score only grows),
    // so no un-set path needed -- draw.js and the ember spawn below just read the flag
    // for the rest of the run.
    const _fireBar = dailyBest || best;
    if (!onFire && _fireBar > 0 && score > _fireBar) {
        onFire = true;
        onFireFlash = 1.0;
        pushNotif(PX + PR * 3, py - H * 0.07, 1.4, T.onFire, [255, 140, 30]);
        sfxOnFire();
        onFireLoopOn();
        window.webkit?.messageHandlers?.haptic?.postMessage('light');
        window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'achievement', id: 'tunl_ach_on_fire' });
    }

    // New all-time record: fires once, the frame live score first overtakes the true
    // all-time best (`best`), same score-based comparison as onFire above -- not a
    // position check. Used to fire on physically passing bestSX (the previous best run's
    // death point) instead, but score already includes bonusScore (coin combos,
    // near-misses) on top of pure distance, so a coin-heavy run could overtake the old
    // best *score* well before reaching the old best's *distance* -- onFire and this beat
    // disagreeing on which happened "first" read as a bug (score-record reached, still
    // short of the line) rather than the two distinct signals they are. Merged onto score
    // per explicit request 2026-09-01: the game already only ever settles records by
    // score (death screen, daily best, all-time best), so the in-flight beat should too.
    // Distinct from onFire (daily best): onFire has usually already fired earlier in the
    // run, but on the day's first run it is suppressed entirely, so this is the only
    // in-flight marker there.
    if (!pbPassed && best > 0 && score > best) {
        pbPassed = true;
        pbFlash = 1.0;
        pushNotif(PX + PR * 3, py - H * 0.12, 1.4, T.pbPassed, [255, 210, 50]);
        sfxPbPassed();
        window.webkit?.messageHandlers?.haptic?.postMessage('light');
        window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'achievement', id: 'tunl_ach_new_legend' });
    }

    // Poison/bomb clocks: real elapsed play time, not tied to coin density/rejection
    // rate/day archetype/screen width -- see constants.js POISON_INTERVAL_SEC doc and
    // makeCoin() in systems.js for where these get consumed.
    poisonClock += dt;
    bombClock   += dt;
    greenClock  += dt;

    // ── Ghost (constants.js GHOST_STEP) ──────────────────────────────
    // Record this run, and replay today's best alongside it. Both are indexed by
    // scrollX rather than elapsed time so the ghost stays locked to the corridor even
    // though a blue coin can halve the scroll speed for 4 seconds -- indexing by time
    // would desync the ghost from the tunnel the moment either run used slow-time.
    {
        const gi = Math.floor(scrollX / GHOST_STEP);
        if (gi < GHOST_MAX_SAMPLES) {
            const q = Math.max(0, Math.min(255, Math.round(py / H * 255)));
            // while, not if: a big dt (or a slow frame) can skip an index outright, and
            // the array index has to stay equal to scrollX/GHOST_STEP or playback drifts.
            while (ghostTrack.length <= gi) ghostTrack.push(q);
        }
        if (ghostPlay && ghostPlay.length > 1) {
            const gp  = scrollX / GHOST_STEP;
            const gi0 = Math.floor(gp);
            if (gi0 < ghostPlay.length - 1) {
                const f  = gp - gi0;
                const y0 = ghostPlay[gi0] / 255 * H, y1 = ghostPlay[gi0 + 1] / 255 * H;
                ghostY = y0 + (y1 - y0) * f;
                // The live ship pitches by atan2(vy, scrollSpd()) -- which is just the
                // arctangent of dy/dx -- so the recorded track's slope gives the ghost
                // the same angle without needing vy stored. Same MAX_PITCH cap as the
                // player (see the ship-pitch block below).
                ghostPitch = Math.max(-0.70, Math.min(0.70, Math.atan((y1 - y0) / GHOST_STEP)));
            } else {
                // Player has outlasted today's best run. Fire once, then stop drawing --
                // this is the payoff the whole feature exists for, so it gets a notif and
                // a sound rather than the ghost just quietly vanishing.
                ghostY = null;
                if (!ghostPassed) {
                    ghostPassed = true;
                    pushNotif(PX + PR * 3, py - H * 0.07, 1.4, T.ghostPassed, [150, 200, 255]);
                    sfxCombo(4);
                    window.webkit?.messageHandlers?.haptic?.postMessage('light');
                    window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'achievement', id: 'tunl_ach_ghost_hunter' });
                }
            }
        }
    }

    // Milestone check
    if (score >= milestoneNext) {
        triggerMilestone(milestoneNext);
        milestoneNext += milestoneStep(milestoneNext);
    }

    // Near-miss bonus (wall proximity)
    nearMissTimer = Math.max(0, nearMissTimer - dt);
    if (nearMissTimer <= 0) {
        const nmB = boundsAt(scrollX + PX);
        const nmC = Math.min(py - PR - nmB.top, nmB.bot - (py + PR));
        // VOID trades a smaller near-miss window for its extra shield capacity
        // (systems.js) -- it tanks hits instead of skimming past them for bonus.
        // Mastery eases the window toward, but deliberately never all the way to,
        // the 2.0x baseline (see the "never fully erase the drawback" doc above
        // SKINS in constants.js).
        if (nmC >= 0 && nmC < PR * (activeSkin === 5 ? masteryLerp(5, 1.5, 1.8)
                                  : activeSkin === 7 ? masteryLerp(7, 4.0, 5.0)
                                  : 2.0)) {
            bonusScore++;
            nearMissTimer = 1.5;
            runNearMisses++;
            pushNotif(PX + W*0.07, py - H*0.05, 1.0, T.notifClose, [255,160,60]);
            sfxNearMiss();
        }
    }

    // Coin combo timer decay
    coinComboTimer = Math.max(0, coinComboTimer - dt);
    if (coinComboTimer <= 0) coinCombo = 0;

    // Milestone flash decay
    milestoneFlash = Math.max(0, milestoneFlash - dt * 1.6);

    // On-fire ignition pop decay -- faster than milestoneFlash, a single quick punch
    // rather than a lingering banner (onFire itself, not this, carries the rest of the run).
    onFireFlash = Math.max(0, onFireFlash - dt * 3.0);

    // PB-crossing pop decay -- same shape as onFireFlash, a single quick gold ring.
    pbFlash = Math.max(0, pbFlash - dt * 3.0);

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
            // VOID (5): dark motes drawn inward from a ring, opposite of AMBER's outward embers
            if (activeSkin === 5 && Math.random() < dt * 5) {
                const ang = Math.random() * Math.PI * 2;
                skinFx.push({ t: 4, ang, dist: PR * (2.2 + Math.random()*0.8), life: 1 });
            }
            // NOVA (6): brief radial starburst every ~0.6s
            if (activeSkin === 6 && skinFxT > 0.6) {
                skinFxT = 0;
                skinFx.push({ t: 5, life: 1, seed: Math.random() });
            }
            // SOLARIS (7): solar sparks streaming from the nose
            if (activeSkin === 7 && Math.random() < dt * 7) {
                skinFx.push({ t: 6, x: PX + PR*(0.65 + Math.random()*0.45),
                               y: py + (Math.random()-0.5)*PR*0.7,
                               vx: PR*(3 + Math.random()*4), vy: (Math.random()-0.5)*PR*2,
                               r: 1.0 + Math.random()*0.8, life: 1 });
            }
        } else {
            skinFxT = 0;
        }
        // Advance existing particles
        for (let i = skinFx.length-1; i >= 0; i--) {
            const f = skinFx[i];
            const decay = f.t === 1 ? 3.5 : f.t === 2 ? 14 : f.t === 5 ? 4.5 : 2.8;
            f.life -= dt * decay;
            if (f.t === 0) { f.x += f.vx*dt; f.y += f.vy*dt; f.vy += 30*dt; }
            if (f.t === 1) { f.r  += PR * 6 * dt; }
            if (f.t === 3) { f.x += f.vx*dt; f.y += f.vy*dt; }
            if (f.t === 4) { f.dist = Math.max(0, f.dist - PR * 3.2 * dt); }
            if (f.t === 6) { f.x += f.vx*dt; f.y += f.vy*dt; }
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
    maintainCannons();

    // Fade coins that are blocked by a stalactite or have scrolled off the left edge
    for (const arr of [coins, chicaneCoins]) for (const coin of arr) {
        if (coin.collected || coin.fade <= 0) continue;
        const csx = coin.wx - scrollX;
        if (csx < 0) {
            coin.fade = Math.max(0, coin.fade - dt * 8);
        }
        // Poison coins visibly ooze while they sit in the corridor -- a continuous
        // cue (not just color/shape, see draw.js) that this one is actively
        // dangerous, not a static decoration like every legitimate coin.
        if (coin.type === 'poison' && csx > -40 && csx < W + 40 && Math.random() < dt * 2.5) {
            parts.push({ x: csx, y: coin.y + COIN_R * 0.6, vx: (Math.random()-0.5)*8, vy: 30+Math.random()*35,
                         life: 0.6+Math.random()*0.3, r: 1.0+Math.random()*1.6, h: 95+Math.random()*20 });
        }
    }

    // Wall + stalactite collision. CRIMSON has a slimmer hitbox (its buff); AMBER
    // trades a slightly larger one away for its bigger coin-collection radius. Mastery
    // pushes CRIMSON's slimmer further and eases AMBER's back toward neutral.
    const cPR = activeSkin === 2 ? PR * masteryLerp(2, 0.82, 0.74)
              : activeSkin === 1 ? PR * masteryLerp(1, 1.10, 1.03)
              : activeSkin === 7 ? PR * masteryLerp(7, 1.20, 1.10)
              : PR;
    for (const dx of [-cPR * 0.7, 0, cPR * 0.7]) {
        const b = boundsAt(scrollX + PX + dx);
        if (py - cPR < b.top || py + cPR > b.bot) {
            // Mid-grace-window: the wall is solid geometry, not a hazard, so simply
            // skipping the check (like stalactites/mines below) would let the ship drift
            // into the rock for the rest of the window. Clamp back inside instead.
            if (invulnT > 0) { py = Math.max(b.top + cPR, Math.min(b.bot - cPR, py)); break; }
            deathCause = (py - cPR < b.top) ? 'wallTop' : 'wallBot';
            if (die()) return;
            break;
        }
    }
    if (py - cPR < 0 || py + cPR > H) {
        if (invulnT > 0) { py = Math.max(cPR, Math.min(H - cPR, py)); }
        else { deathCause = (py - cPR < 0) ? 'wallTop' : 'wallBot'; if (die()) return; }
    }
    for (const s of stalactites) {
        if (s.dying) continue;
        if (stalHit(s, cPR)) { deathCause = s.isTop ? 'wallTop' : 'wallBot'; if (die()) return; break; }
    }

    // Mine collision (same trade-off hitbox as walls/stalactites above)
    const mineHitR2 = (cPR + MINE_R) * (cPR + MINE_R);
    for (let mi = 0; mi < mines.length; mi++) {
        const m  = mines[mi];
        const sx = m.wx - scrollX;
        if (sx < -80 || sx > W + 80) continue;
        const my = m.baseY + m.bobAmp * Math.sin(gtime * 1.8 + m.phase);
        const dx = PX - sx, dy = py - my;
        if (dx*dx + dy*dy < mineHitR2) {
            deathCause = 'open';
            if (die()) return;
            // Shield absorbed - destroy the mine so it can't immediately re-hit
            mines.splice(mi, 1);
            shake += 12;
            burst(sx, my);
            pushNotif(sx, my - H*0.06, 1.1, T.blocked, [255, 90, 40]);
            window.webkit?.messageHandlers?.haptic?.postMessage('heavy');
            break;
        }
    }

    // Cannon shot collision (same trade-off hitbox as walls/mines above). Firing +
    // movement live in updateCannonShots below, called after this so a shot that
    // fires this frame can't also hit the player on the same frame it spawns.
    const cannonHitR2 = (cPR + CANNON_SHOT_R) * (cPR + CANNON_SHOT_R);
    for (let ci = 0; ci < cannonShots.length; ci++) {
        const s  = cannonShots[ci];
        const sx = s.wx - scrollX;
        if (sx < -100 || sx > W + 100) continue;
        const dx = PX - sx, dy = py - s.y;
        if (dx*dx + dy*dy < cannonHitR2) {
            deathCause = 'open';
            if (die()) return;
            // Shield absorbed - destroy the shot so it can't immediately re-hit
            cannonShots.splice(ci, 1);
            shake += 10;
            burst(sx, s.y);
            pushNotif(sx, s.y - H*0.06, 1.1, T.blocked, [255, 90, 40]);
            window.webkit?.messageHandlers?.haptic?.postMessage('heavy');
            break;
        }
    }

    // Magnet: pull visible uncollected coins toward the player. Poison is exempt -- it's
    // a hazard, not a pickup, and magnet is a reward the player earned; pulling poison in
    // would turn a power-up into a trap the instant one's on screen, punishing exactly the
    // players who worked for the buff.
    if (magnetTime > 0) {
        const playerWx = scrollX + PX;
        const pullSpeed = W * 1.4;
        for (const arr of [coins, chicaneCoins]) for (const coin of arr) {
            if (coin.collected || coin.fade <= 0 || coin.type === 'poison') continue;
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

    // Cannons: trigger any that the player has now closed within range of, and
    // advance every shot already in flight
    updateCannonShots(dt);

    shake         = Math.max(0, shake         - dt * 30);
    shieldFlash   = Math.max(0, shieldFlash   - dt * 5);
    flashA        = Math.max(0, flashA        - dt * 5);
    invulnT       = Math.max(0, invulnT       - dt);

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
    // Mid-grace-window: absorb silently, no reposition/clear -- that already happened
    // once, at the hit that started the window (see the shield branch below). A second
    // shield charge is never spent on a hit that lands inside someone else's window.
    if (invulnT > 0) return false;
    if (!bypassShield && shieldCount > 0) {
        shieldCount--;
        shieldFlash = 1.0; shake = 10;
        burst(PX, py, 26);
        // Push to corridor center so the next frame passes collision
        const b = boundsAt(scrollX + PX);
        py = (b.top + b.bot) / 2;
        vy = 0;
        // Grace window (constants.js HIT_INVULN_SEC doc): a bare reposition only fixes
        // the instant of this hit -- without a timed follow-up, a stalactite or mine
        // sitting near the recentered spot could kill on literally the next frame.
        invulnT = HIT_INVULN_SEC;
        // Clear anything sitting at the recenter point itself, same radius-clear the
        // bomb pickup uses, so the reposition doesn't just trade one collision for another.
        triggerBombExplosion(PX, py);
        sfxShieldBreak();
        window.webkit?.messageHandlers?.haptic?.postMessage('medium');
        return false;
    }
    thrustOff();
    onFireLoopOff();
    magnetLoopOff();
    sfxBulletFireStop();
    bgmSetSlow(false);
    phase = 'dead'; deadT = 0; flashA = 1.0; shake = 14; holding = false;
    _shareCopiedT = 0;
    _homeBtnRect = null; _playBtnRect = null; _shareBtnRect = null; _continueBtnRect = null;
    // Impact feedback fires now, unconditionally -- a hit should always feel like a
    // hit, whether or not a rewarded continue ends up saving the run a moment later
    // (same principle the shield-absorb branch above already follows).
    burst(PX, py, 46);
    sfxDie();
    _fadeBgMusic();
    window.webkit?.messageHandlers?.haptic?.postMessage('heavy');

    // Rewarded continue (constants.js CONTINUE_MIN_SCORE doc): offered at most once
    // per run, only when native already has a rewarded ad loaded (rewardedAdReady --
    // never show a button that leads nowhere) and the run cleared the same score
    // floor the interstitial uses. When offered, the real bookkeeping below is held
    // until either the offer resolves to a decline (update.js's phase==='dead'
    // branch, at CONTINUE_OFFER_SEC) or grantRevive() undoes this hit entirely.
    if (continuesUsedThisRun < MAX_CONTINUES_PER_RUN && score >= CONTINUE_MIN_SCORE && rewardedAdReady) {
        continueOfferPending = true;
        return true;
    }
    commitDeath();
    return true;
}

// Store rating prompt (constants.js REVIEW_MIN_SCORE/REVIEW_COOLDOWN_MS doc block).
// Called only from commitDeath()'s newBest branch -- a beaten record is the one
// moment in the loop that's unambiguously good news, the same reasoning
// shareWorthy() (share.js) already uses for the share button. `hadPriorBest`
// excludes a brand new player's very first completed run (best was still 0
// going in): every score is trivially "a new best" then, and asking someone to
// rate an app they opened five seconds ago is exactly what Apple's and Google's
// own review guidelines warn against. The cooldown lives in localStorage rather
// than being re-derived from `best`/`stardust` so it survives independently of
// either -- a player who never beats their record again should still only ever
// see this once.
function maybeRequestReview(runScore, hadPriorBest) {
    if (!hadPriorBest || runScore < REVIEW_MIN_SCORE) return;
    let lastAskMs = 0;
    try { lastAskMs = parseInt(localStorage.getItem('tunnel_review_last_ts') || '0'); } catch (e) { /* ignore */ }
    if (Date.now() - lastAskMs < REVIEW_COOLDOWN_MS) return;
    try { localStorage.setItem('tunnel_review_last_ts', String(Date.now())); } catch (e) { /* ignore */ }
    window.webkit?.messageHandlers?.review?.postMessage({ action: 'request' });
}

// The actual bookkeeping half of a death: score submit, shard banking, ship
// unlocks, missions, ghost save, death markers. Split out of die() so a rewarded
// continue can hold this off entirely rather than having to undo it -- see the
// continue-offer branch above and update.js's phase==='dead' handling.
function commitDeath() {
    prevRunScore = lastRunScore;
    lastRunScore = score;
    newBest = score > best;
    // Capture whether a *prior* best existed before this run overwrites it below --
    // maybeRequestReview() needs to tell "beat an existing record" from "this is
    // literally the player's first completed run" (best still 0 going in), which
    // must never trigger a rating prompt.
    const _hadPriorBest = best > 0;
    if (!_hadPriorBest) window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'achievement', id: 'tunl_ach_first_flight' });
    if (newBest) { best = score; localStorage.setItem('tunnel_best', best); }
    if (newBest) maybeRequestReview(score, _hadPriorBest);
    // Referral reward (constants.js REFERRAL_REWARD doc block): the inverse of
    // the review gate just above - fires only on what reads as this player's
    // own first real run (no prior best going in), which is also the one
    // point in a player's lifetime this condition can ever be true, so this
    // naturally never re-submits on a later run. Reuses CONTINUE_MIN_SCORE
    // rather than a fresh constant, same floor REVIEW_MIN_SCORE reuses it
    // for - the worker re-checks this independently regardless (never trust
    // the client on something that grants value).
    if (!_hadPriorBest && score >= CONTINUE_MIN_SCORE && typeof submitReferral === 'function') {
        submitReferral(score);
    }
    runsWithoutPB = newBest ? 0 : runsWithoutPB + 1;
    newDailyBest = score > dailyBest;
    if (newDailyBest) { dailyBest = score; localStorage.setItem('tunnel_daily_best', dailyBest); }
    // Ghost: today's best run becomes the thing the next run races. Keyed to the day the
    // run was actually played (recomputed here, not read from state.js's page-load
    // _initToday) so a session left open across UTC midnight can't file a run under the
    // wrong day's corridor. Wrapped because localStorage can throw when the quota is
    // full or storage is blocked -- a failed ghost save must never cost the player the
    // rest of die()'s bookkeeping (shards, unlocks, missions).
    if (newDailyBest && score > 0 && ghostTrack.length > 1) {
        try {
            // Keyed to the cave actually flown (world.js _tunlActiveDayInt): normally
            // today, but the web ?d= replay flies a past day's corridor, and tagging it
            // with that day keeps state.js from loading it back as today's ghost.
            localStorage.setItem('tunnel_ghost', JSON.stringify({
                day:   _tunlActiveDayInt(),
                score,
                data:  ghostEncode(ghostTrack),
            }));
            ghostPlay  = Uint8Array.from(ghostTrack);
            ghostScore = score;
        } catch (e) { /* ghost is a nice-to-have; never break the death flow over it */ }
    }
    localStorage.setItem('tunnel_no_pb', runsWithoutPB);
    if (score > 0) {
        top5 = [...top5, score].sort((a, b) => b - a).slice(0, 5);
        localStorage.setItem('tunnel_top5', JSON.stringify(top5));
        window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'submit', score });
        // Web build: submit to the daily leaderboard worker (no-op without an API
        // set). Reuses the native world-rank state path (main.js _tunlNativeUpdate).
        if (typeof webSubmitScore === 'function') {
            const _nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            webSubmitScore(score, (_nowMs - _webRunStartMs) / 1000);
        }
    }
    // Bank this run's collected coins into the persistent shard balance, capped per day so
    // unlocks track days played, not just a single grind session (DAILY_SHARD_CAP).
    runShardsBanked = Math.max(0, Math.min(runCoins, DAILY_SHARD_CAP - dailyShardsEarned));
    if (runShardsBanked > 0) {
        shards += runShardsBanked;
        dailyShardsEarned += runShardsBanked;
        localStorage.setItem('tunnel_daily_shards', dailyShardsEarned);
    }
    // Auto-unlock the next affordable ship (cheapest-first, one per run/death) once its
    // requirements are met. Capped at one unlock per run so a single marathon run can't
    // clear several tiers at once -- that was the old score-gate problem this replaces.
    // Every paid tier needs BOTH its `cost` in shards AND its `stardustGate` in days
    // played (constants.js Stardust block). `stardust` itself is never decremented here:
    // it's a monotonically increasing lifetime counter, and a gate is just a threshold
    // check against it, not a purchase -- see that same comment for why (consuming it
    // would stack each tier's gate on top of the next one's).
    //
    // Strictly sequential: a tier can't unlock before SKINS[i-1] has, even if its own
    // requirements are independently met. `cost` and `stardustGate` both climb
    // tier-over-tier today, so in practice this never fires -- but it's cheap insurance
    // against a future re-tuning breaking that ordering (e.g. a tier priced heavier in
    // one currency than the next one up, letting a player with lopsided income jump it).
    // A concrete case that used to actually happen here: an earlier version left SOLARIS
    // with no shard cost at all, so a slow player's stardust could cross its gate before
    // their shards caught up to VOID/NOVA, unlocking SOLARIS first and skipping ships
    // that are supposed to come before "the last ship." SOLARIS carries a shard cost now
    // too, but the guard stays -- it's what made that bug impossible instead of just
    // fixed for the numbers of the day.
    skinUnlockIdx = -1;
    for (let i = 1; i < SKINS.length; i++) {
        if (unlockedSkins & (1 << i)) continue;
        if (!(unlockedSkins & (1 << (i - 1)))) break;
        const sk = SKINS[i];
        if (sk.cost && shards < sk.cost) continue;
        if (sk.stardustGate && stardust < sk.stardustGate) continue;
        if (sk.cost) shards -= sk.cost;
        unlockedSkins |= (1 << i);
        skinUnlockIdx = i;
        break;
    }
    localStorage.setItem('tunnel_shards', shards);
    if (skinUnlockIdx >= 0) {
        localStorage.setItem('tunnel_skins', unlockedSkins);
        window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'achievement', id: SHIP_ACHIEVEMENTS[skinUnlockIdx] });
    }
    // Ship mastery: did flying this run's ship cross a new XP threshold (constants.js
    // MASTERY_XP_THRESHOLDS)? Compared against the level snapshotted at startPlay() since
    // skinXP[activeSkin] was already incremented live during play (systems.js).
    skinMasteryUpIdx = masteryLevel(activeSkin) > runStartMasteryLevel ? activeSkin : -1;
    localStorage.setItem('tunnel_skin_xp', JSON.stringify(skinXP));
    // Achievements: "Ace Pilot" fires the run a ship first reaches max mastery; "Master
    // of the Fleet" fires the run that maxing THIS ship happens to complete the set
    // across every ship currently owned (checked here rather than only at unlock time,
    // since owning all 8 and mastering the last one can happen in either order).
    if (skinMasteryUpIdx >= 0 && masteryLevel(skinMasteryUpIdx) === MASTERY_XP_THRESHOLDS.length - 1) {
        window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'achievement', id: 'tunl_ach_ace_pilot' });
        let _allMastered = true;
        for (let i = 0; i < SKINS.length; i++) {
            if (!(unlockedSkins & (1 << i))) continue;
            if (masteryLevel(i) < MASTERY_XP_THRESHOLDS.length - 1) { _allMastered = false; break; }
        }
        if (_allMastered) window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'achievement', id: 'tunl_ach_master_fleet' });
    }
    // Daily missions: fold this run's stats into today's cumulative totals, then check
    // today's 3 active missions (constants.js MISSION_DEFS via state.js dailyMissionIdx)
    // for newly-met targets. Rewards are granted once per mission per day.
    dailyMissionStats.gold       += runCoinsByType.gold;
    dailyMissionStats.blue       += runCoinsByType.blue;
    dailyMissionStats.red        += runCoinsByType.red;
    dailyMissionStats.green      += runCoinsByType.green;
    dailyMissionStats.orange     += runCoinsByType.orange;
    dailyMissionStats.bomb       += runCoinsByType.bomb || 0;
    dailyMissionStats.dist       += score;
    dailyMissionStats.nearMisses += runNearMisses;
    dailyMissionStats.bestCombo   = Math.max(dailyMissionStats.bestCombo, runMaxCombo);
    dailyMissionStats.bestScore   = Math.max(dailyMissionStats.bestScore, score);
    dailyMissionStats.runs        = dailyRuns;
    missionRewardWon = 0;
    for (let m = 0; m < dailyMissionIdx.length; m++) {
        if (dailyMissionsClaimed[m]) continue;
        const def = MISSION_DEFS[dailyMissionIdx[m]];
        if (dailyMissionStats[def.stat] >= def.target) {
            dailyMissionsClaimed[m] = true;
            const rew = MISSION_REWARD_BY_TIER[def.tier];
            shards += rew;
            missionRewardWon += rew;
        }
    }
    // A completed mission is the whole reason to care about the block, so it gets its
    // own death-screen banner (draw.js) + chime rather than silently topping up shards.
    if (missionRewardWon > 0) sfxMissionDone();
    localStorage.setItem('tunnel_daily_mission_stats', JSON.stringify(dailyMissionStats));
    localStorage.setItem('tunnel_daily_missions_claimed', JSON.stringify(dailyMissionsClaimed));
    localStorage.setItem('tunnel_shards', shards);
    // Record a death marker. Only wx + which side it hangs on is stored -- draw.js
    // recomputes the y from the live corridor every frame so the ring rides the wave
    // and stays glued to the wall as gapBonus decays (see deathMarkers in state.js).
    const _dmWx = scrollX + PX;
    // Exact death point for the share card's run profile (share.js), kept separate from
    // the wall-snapped marker below.
    lastRunWx = _dmWx; lastRunY = py;
    const _dmB = boundsAt(_dmWx);
    const _dmSide = deathCause === 'open'    ? 'mid'
                  : deathCause === 'wallTop' ? 'top'
                  : deathCause === 'wallBot' ? 'bot'
                  : py < (_dmB.top + _dmB.bot) / 2 ? 'top' : 'bot';
    deathMarkers.push({ wx: _dmWx, side: _dmSide });
    if (deathMarkers.length > MAX_DEATH_MARKERS) deathMarkers.shift();
    if (newBest) {
        bestMarker = { wx: _dmWx, side: _dmSide };
        bestSX = _dmWx;
        localStorage.setItem('tunnel_best_sx', bestSX);
    }
    _startTitleMusic();
}

// Rewarded continue succeeded (native's userDidEarnReward callback, see main.js
// window._tunlReviveGranted). Undoes the fatal hit outright rather than reversing
// commitDeath()'s bookkeeping, because commitDeath() never ran for this hit --
// die() held it behind continueOfferPending instead of committing then undoing.
function grantRevive() {
    continueOfferPending = false;
    continueAdPending = false;
    continuesUsedThisRun++;
    const b = boundsAt(scrollX + PX);
    py = (b.top + b.bot) / 2;
    vy = 0;
    triggerBombExplosion(PX, py);
    // Not straight back into 'play' -- phase='revive' freezes the world (scrollX
    // untouched, no physics/collision) with the ship parked here for
    // REVIVE_COUNTDOWN_SEC while a localized "READY" flashes (see the phase==='revive'
    // branch below and drawReviveCountdown), then invulnT starts fresh once play
    // actually resumes. See constants.js's doc comment for why the invuln window
    // doesn't start ticking during this freeze.
    phase = 'revive';
    reviveCountdownT = REVIVE_COUNTDOWN_SEC;
    _startBgMusic();
    sfxShieldBreak(); // reuses the "you were saved" cue; a dedicated revive jingle can replace this later
    // Same "engine warming back up" cue startPlay() opens every run with (~1.3s,
    // fits inside the 2s countdown) -- the ship visibly sat dead a second ago, so
    // it reads as literally spooling back up to fly again, not just a generic sfx.
    sfxEngineSpoolUp();
    window.webkit?.messageHandlers?.haptic?.postMessage('success');
}

// Native reports the rewarded ad couldn't be shown/rewarded after the player already
// tapped the offer (see main.js window._tunlReviveDeclined) -- e.g. a stale
// rewardedAdReady flag, or the ad failed mid-presentation. Falls through to the same
// commitDeath() the CONTINUE_OFFER_SEC timeout would have run anyway; there's no
// separate "declined" bookkeeping path.
function declineRevive() {
    if (!continueOfferPending) return; // already resolved (timeout or a second callback)
    continueOfferPending = false;
    continueAdPending = false;
    commitDeath();
}
