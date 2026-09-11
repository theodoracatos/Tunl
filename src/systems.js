// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── Stalactite system ─────────────────────────────────────────────────

function makeStal(wx, isTop) {
    // halfGapAt(wx)/stalLenFrac(wx), not the player's _halfGap/_prog: this runs from a
    // W-dependent spawn horizon, so reading the player's position made the same
    // stalactite come out a different length on a different screen. `width` stays
    // W-derived because it is an on-screen size that draw and collision share; only
    // placement rejection uses the device-invariant placeStalW() instead.
    const length = halfGapAt(wx) * stalLenFrac(wx) * (0.55 + rngStal() * 0.45);
    const width  = W * lerp(0.030, 0.018, progAt(wx)) * (0.70 + rngStal() * 0.40);
    return { wx, isTop, length, width, fade: 1.0, dying: false };
}

function maintainStalactites() {
    // First stalactite is at STAL_START_WX (score ~25, set in startPlay) -- the opening
    // stretch is a clean, obstacle-free intro on every run. It is a fixed world position,
    // so the spawn horizon below always creates it off the right edge and it scrolls into
    // view; it never pops in mid-screen.
    while (nextStalWx < scrollX + SPAWN_W + SPAWN_AHEAD_STAL) {
        const spacing = stalSpacing(nextStalWx) * (0.65 + rngStal() * 0.70);
        if (progAt(nextStalWx) > 0.40 && rngStal() < chicaneProb(nextStalWx)) {
            stalactites.push(makeStal(nextStalWx,       true));
            stalactites.push(makeStal(nextStalWx + 65, false));
            const coinWx = nextStalWx - 85;
            // Min world-x gap between two chicane gold coins, expressed as a real
            // TIME. Past _prog2 the stalactite spacing collapses toward its 50px
            // floor and chicaneProb climbs to 0.62, so an ungated chicane drops a
            // centred gold coin on nearly every one -- right on the line the player
            // threads anyway. A flat 30px gate gave ~7/sec; the 340px gate that
            // replaced it still gave a measured 2.09/sec in the deep run, because a
            // fixed distance keeps shrinking in seconds as scrollSpd() climbs
            // forever. Against the ~0.43 coins/sec that holds gapBonus pinned at its
            // cap (constants.js GAP_DECAY), that was a 5x oversupply, and the
            // measured result was an effective half-gap running flat at ~0.34*H for
            // the entire run -- the whole 0.34->0.163 narrowing cancelled out.
            // A time gate is flat in coins/sec at every depth by construction:
            // 2.2s => at most ~0.45/sec forever, just above the hold-at-cap rate, so
            // the bonus hovers and dips instead of pinning. It is a no-op below score
            // ~230 (the natural chicane cadence there is already slower than this),
            // which is deliberate - the early game must not get harder.
            // worldPxForSec (world.js) is used rather than scrollSpd() because the
            // cave must stay pixel-identical in world-x across devices; scrollSpd()
            // carries a W/600 term and would fork the cave by screen width.
            // coinSpacing() term retained so a Coin Rush day still runs denser.
            // Gated on lastChicaneCoinWx (state.js), NOT on the tail of the live
            // chicaneCoins array: that array is culled at scrollX - 200 and only
            // reaches ~W+600 ahead, so it holds a coin for barely 1700 world-px of
            // travel. Any gate wider than that emptied the array between coins, and
            // the old `!chicaneCoins.length ||` escape hatch then waved the next one
            // straight through -- capping the real gate at the array's lifetime no
            // matter what value was asked for. A plain high-water mark has no such
            // ceiling.
            // Depth-scaled for the same reason the power-up floors are
            // (POWERUP_GAP_EARLY_MULT): at full strength this gate is ~3x the old
            // 340px one early, which measurably narrowed the score 25-233 corridor -
            // the wrong direction, since that is the band real runs end in. Scaled in
            // over _prog2 it is a no-op below score 233 and full strength past ~900.
            const chicSec  = CHICANE_GOLD_GAP_SEC * lerp(CHICANE_GOLD_EARLY_MULT, 1, Math.min(prog2At(coinWx), 1));
            const chicGate = Math.max(worldPxForSec(chicSec, coinWx), coinSpacing(coinWx) * 0.85);
            if (coinWx > 0 && coinWx - lastChicaneCoinWx >= chicGate) {
                // y from boundsBase(coinWx), NOT centerAt(coinWx). centerAt reads the
                // wave params for the PLAYER's current scrollX, but this coin is being
                // placed ~W+600 world-px ahead, and those params keep evolving before
                // the player gets there - measured drift of the corridor centre at the
                // coin's own wx: median 27px, up to 171px. Frozen at the stale centre,
                // 12.4% of chicane gold ended up embedded in the rock by the time the
                // player arrived (up to 4.6 player radii deep), i.e. visible but
                // uncollectable without flying into a wall. boundsBase samples the wave
                // per-wx, so it is a real prediction rather than a lookahead
                // approximation - the same reason makeCoin() uses it (CLAUDE.md:
                // "Never use boundsAt() for coin placement"). Measured after: 0% in
                // rock, min clearance 4.1 player radii, better than the scattered
                // coins' own 1.3 baseline.
                const cb = boundsBase(coinWx);
                chicaneCoins.push({ wx: coinWx, y: (cb.top + cb.bot) / 2, collected: false, type: 'gold', fade: 1.0 });
                lastChicaneCoinWx = coinWx;
            }
        } else {
            // Once the fall cursor is due, the next single stalactite becomes a
            // falling one (forced isTop -- a ceiling spike is the only thing that
            // can drop). updateFallingStals() detaches it as the player closes in.
            let isTop = rngStal() < 0.5;
            let makeFall = false;
            if (nextFallWx !== 99999 && nextStalWx >= nextFallWx) {
                isTop = true; makeFall = true;
                nextFallWx += fallSpacing(nextStalWx) * (0.7 + rngStal() * 0.6);
            }
            const st = makeStal(nextStalWx, isTop);
            if (makeFall) {
                st.falls = true;
                st.detached = false;
                st.detachScrollX = 0;
                st.detachAtWx = nextStalWx - FALL_LEAD;
            }
            stalactites.push(st);
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

// ── Falling stalactites ───────────────────────────────────────────────
// Vertical drop offset (px) of a falling stalactite: 0 until it detaches, then an
// ease-in sweep over FALL_SPAN world-px of scroll, then held. Indexed by scrollX
// (not elapsed time) so a blue-coin slow can't desync the drop from the tunnel,
// same as the ghost. It falls the full corridor until the tip meets the far wall
// (becomes a floor spike - the dodge is unambiguously "go over it"). Read by
// stalHit / stalHitBullet / the draw loop / triggerBombExplosion so collision and
// render always agree.
//
// The travel distance is recomputed LIVE every frame, never frozen at detach. It
// used to be captured once into s.fallDist and then only ever clamped DOWNWARD
// against the live corridor - which is correct if the corridor narrows mid-fall but
// leaves the spike hanging in mid-air if it WIDENS, and the corridor widens
// constantly: gapBonusVisual eases in at GAP_EASE_RATE (up to H*0.19 of extra
// half-gap), deep chambers balloon it 2.1x, and _halfGap itself drifts as the player
// advances. Measured over one run: 5 of 33 spikes finished their drop above the
// floor, by up to 60px at landing and up to 131px (3.8 player diameters) afterwards,
// since a landed spike kept its frozen offset while the floor below it kept moving
// away. Because b.bot - b.top is exactly 2*(_halfGap + gapBonusVisual), evaluating
// it here makes the tip land on b.bot and then STAY on it for the rest of the
// scroll-past, which is what "becomes a floor spike" is supposed to mean.
function stalFallY(s) {
    if (!s.falls || !s.detached) return 0;
    const t = Math.min((scrollX - s.detachScrollX) / FALL_SPAN, 1);
    const b = boundsAt(s.wx);
    return Math.max(0, (b.bot - b.top) - s.length) * t * t;
}

// Per-frame: trickle telegraph dust from loose (not-yet-detached) falling
// stalactites, detach them as the player closes within FALL_LEAD, trail debris
// during the drop, and thud on landing (after which it's just a lowered rock
// that scrolls past like any stalactite). Called from update() right after
// maintainStalactites(). No dt integration - the drop is pure scrollX
// (stalFallY) - only the particle spawn rates use dt.
function updateFallingStals(dt) {
    const playerWx = scrollX + PX;
    for (const s of stalactites) {
        if (!s.falls || s.dying) continue;
        const sx = s.wx - scrollX;
        const onScreen = sx > -30 && sx < W + 30;
        if (!s.detached) {
            // Loose: dust trickle + faint jitter cue while it scrolls in.
            if (onScreen && Math.random() < dt * 8) {
                const b = boundsAt(s.wx);
                parts.push({ x: sx + (Math.random() - 0.5) * s.width, y: b.top + s.length,
                             vx: (Math.random() - 0.5) * 16, vy: 16 + Math.random() * 30,
                             life: 0.4 + Math.random() * 0.4, r: 1 + Math.random() * 1.8, h: 26 + Math.random() * 16 });
            }
            // Detach once the player is within FALL_LEAD - but only while the
            // stalactite is still clearly ahead, so a frame skip can't trip it
            // with the ship already level with the rock.
            if (playerWx >= s.detachAtWx && sx > PX * 0.75) {
                s.detached = true;
                s.detachScrollX = scrollX;
                const b = boundsAt(s.wx);
                // Falls the whole corridor - tip meets the far wall, leaving the
                // gap ABOVE (>= 1.2 * halfGap, since stalLenFrac caps length at 0.8).
                // How far that is is NOT captured here on purpose - stalFallY()
                // recomputes it live every frame, see its doc.
                shake += 4;
                sfxStalCrack();
                burstStalCrack(sx, b.top + s.length);
                window.webkit?.messageHandlers?.haptic?.postMessage('light');
            }
        } else if (!s.landed) {
            const t = Math.min((scrollX - s.detachScrollX) / FALL_SPAN, 1);
            if (t < 1) {
                if (onScreen && Math.random() < dt * 26) {
                    const b = boundsAt(s.wx);
                    parts.push({ x: sx + (Math.random() - 0.5) * s.width, y: b.top + s.length + stalFallY(s) - 2,
                                 vx: (Math.random() - 0.5) * 26, vy: -(6 + Math.random() * 24),
                                 life: 0.3 + Math.random() * 0.3, r: 1 + Math.random() * 1.8, h: 24 + Math.random() * 14 });
                }
            } else {
                s.landed = true;
                const b = boundsAt(s.wx);
                burstStalCrack(sx, b.top + s.length + stalFallY(s));
                if (onScreen) { shake += 3; sfxStalCrack(); }
            }
        }
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

// Placement rejection only - never a live collision test. Uses the PLACE_* radii and
// placeStalW() rather than PR/COIN_R/s.width so the decision comes out the same on
// every screen (constants.js PLACE_PR doc). On a non-reference aspect ratio the
// rejection region is therefore a hair off the drawn triangle; that is a bounded
// cosmetic difference, where the W-derived version forked the whole shared cave.
function coinBlockedByStal(wx, y) {
    const safe = PLACE_PR + PLACE_COIN_R;   // clearance the player actually needs
    const r2   = safe * safe;
    // Everything vertical is converted to reference space (_H_TO_REF) so the triangle
    // has the same proportions on every screen height; x is already world-px.
    const yR = y * _H_TO_REF;
    for (const s of stalactites) {
        const sw = placeStalW(s.wx);
        if (Math.abs(wx - s.wx) > sw + safe * 2) continue;
        const b0 = boundsBase(s.wx);
        const b = { top: b0.top * _H_TO_REF, bot: b0.bot * _H_TO_REF };
        const sLen = s.length * _H_TO_REF;
        const hw = sw / 2 * 0.85;
        const tipY = s.isTop ? b.top + sLen : b.bot - sLen;
        let ax, ay, bx, by;
        if (s.isTop) {
            ax = s.wx-hw; ay = b.top; bx = s.wx+hw; by = b.top;
            if (inTri(wx,yR,ax,ay,bx,by,s.wx,tipY)) return true;
            if (ptSeg2(wx,yR,ax,ay,s.wx,tipY) < r2) return true;
            if (ptSeg2(wx,yR,bx,by,s.wx,tipY) < r2) return true;
            if (yR < tipY + safe) return true;   // too close to tip vertically
        } else {
            ax = s.wx-hw; ay = b.bot; bx = s.wx+hw; by = b.bot;
            if (inTri(wx,yR,ax,ay,bx,by,s.wx,tipY)) return true;
            if (ptSeg2(wx,yR,ax,ay,s.wx,tipY) < r2) return true;
            if (ptSeg2(wx,yR,bx,by,s.wx,tipY) < r2) return true;
            if (yR > tipY - safe) return true;
        }
    }
    return false;
}

function makeCoin(wx) {
    // boundsBase(wx) alone. There used to be a second intersection against
    // `centerAt(wx) +/- _halfGap` - the corridor as the PLAYER currently sees it - to
    // cover the lookahead approximation. boundsBase already samples the wave per-wx,
    // so that intersection was both redundant and a cross-device hazard: _halfGap is
    // the player's, and this runs from a W-dependent horizon, so it clipped the
    // allowed band differently on different screens.
    const bBase  = boundsBase(wx);
    // Type isn't rolled until after coinY is picked below, so the clearance buffer
    // has to reserve room for the largest possible size (constants.js
    // COIN_SIZE_MAX_MULT), not the average -- otherwise a rare magnet/bomb coin
    // could land close enough to a wall to visually clip it.
    const buf = PLACE_COIN_R * COIN_SIZE_MAX_MULT * 2 * _REF_TO_H;
    const lo  = bBase.top + buf;
    const hi  = bBase.bot - buf;
    if (hi <= lo) return null;
    const cy     = (lo + hi) / 2;
    const margin = (hi - lo) * 0.40;
    // rngCoin() is consumed either way so the type roll below (and everything after in
    // the stream) is unchanged. Past the plateau, deep coin runs trace a seeded
    // slow arc instead of scattering independently - a "line to follow", a second
    // thing to read besides the walls. Pure _deepHash, so the shape is identical
    // for every player that day.
    const rY = rngCoin();
    let coinY;
    if (wx < ONBOARD_ARC_WX) {
        // Onboarding arc (constants.js ONBOARD_ARC_WX): the opening coins sit on a
        // gentle wave that starts BELOW the launch line, so taking the first one
        // means releasing and gliding down and taking the second means holding and
        // climbing back -- the game's only wordless lesson that release is half the
        // control scheme. Phase 0.9 rather than 0 so the very first coin is already
        // clearly low rather than dead centre; amplitude tapers to 0 by ONBOARD_ARC_WX
        // so it rejoins the normal scattered placement with no visible seam.
        const u     = wx / ONBOARD_ARC_WX;                 // 0 -> 1 across the stretch
        const taper = 1 - u * u;                           // full at the start, 0 at the end
        const amp   = (hi - lo) * 0.5 * ONBOARD_ARC_FRAC * taper;
        coinY = Math.max(lo, Math.min(hi, cy + Math.sin(u * Math.PI * 2.2 + 0.9) * amp));
    } else if (_deepVarietyOn && wx > DEEP_VARIETY_WX) {
        const seg = Math.floor((wx - DEEP_VARIETY_WX) / 3200);
        const ph  = _deepHash(seg + 0x2000) * Math.PI * 2;
        const k   = lerp(0.004, 0.012, _deepHash(seg + 0x2001));
        const amp = (hi - lo) * 0.5 * (0.45 + _deepHash(seg + 0x2002) * 0.55);
        coinY = Math.max(lo, Math.min(hi, cy + Math.sin(wx * k + ph) * amp));
    } else {
        coinY = Math.max(lo, Math.min(hi, cy + (rY - 0.5) * 2 * margin));
    }
    const r = rngCoin();
    let type = 'gold';
    // progAt(wx)/prog2At(wx) throughout this ladder, never the player's _prog/_prog2:
    // a coin's type has to depend on the difficulty WHERE IT IS, not where the player
    // happened to be when the spawn loop reached it. The latter varies with the frame
    // step (scrollSpd carries a W/600 term), so a borderline roll flipped by screen
    // width and forked the shared cave. See CLAUDE.md "Cross-device fairness".
    if (progAt(wx) >= 0.38) {
        // score 34+: weighted shares that sum to 1, normalized against whatever's
        // left, rather than the old chain of sequential thresholds. That older shape
        // is what let shield's real share crater to ~2-3.5% for its first third
        // (score 34-71) -- right as mines start appearing -- purely because it was
        // computed as "whatever's left after blue" instead of being given an
        // explicit floor (UX audit, Befund 3 / Konzept 07). wBlue/wOrange stay flat
        // at their old approximate values (continuity with the previous curve);
        // wRed now has a real floor at introduction and grows to the same ceiling
        // (21%) the old curve reached at max difficulty. Blue/orange settle at their
        // own natural ceiling once t maxes at score 233 too -- see the goldCutT/
        // goldCutP2 split below.
        const t     = Math.min((progAt(wx) - 0.38) / 0.62, 1); // 0 at score ~34, 1 at score ~233
        let wBlue   = 0.17;
        let wRed    = lerp(0.09, 0.21, t);
        let wOrange = 0.14;
        // Magnet unlocks at score 71 same as before. Its base share (greenBase below)
        // grows with _prog2 (3% -> 6% from score ~233 to ~900) instead of being pinned
        // at a flat 3% forever -- a long marathon run is exactly where a magnet is most
        // "run-defining" for chaining combos, so it shouldn't stay as rare there as it
        // is early on. greenDroughtBias layers a soft, uncapped-frequency (but
        // capped-strength) pity nudge on top -- see constants.js GREEN_DROUGHT_*
        // doc and the greenClock reset below. Green's ACTUAL final share (wGreen,
        // after the goldCutP2 redistribution further down) lands well above this
        // 3-6% base -- ~3.7% at score 233 climbing to ~14.5% by score 900+ -- because
        // green is deliberately the sole sink for gold's marathon-phase decay once
        // red/blue/orange all flatten out at score 233 (see the goldCutT/goldCutP2
        // comment below). That's intentional, not drift: unlike red's stack cap,
        // magnet's is a duration that decays in real time (5s baseline vs. a ~28s
        // average gap between green pickups at the score-900+ coin cadence), so a
        // bigger share doesn't leave pickups going to waste the way excess red did.
        let wGreen = 0;
        if (progAt(wx) >= 0.55) {
            const greenBase   = lerp(0.03, 0.06, prog2At(wx));
            const droughtBias = Math.min(1 + (wx - lastGreenWx) / worldPxForSec(GREEN_DROUGHT_SOFT_SEC, wx), GREEN_DROUGHT_CAP);
            wGreen = greenBase * droughtBias;
        }
        let wGold = Math.max(0, 1 - wBlue - wRed - wOrange - wGreen);
        // Gold keeps thinning out the deeper a run goes, not just as a side effect of
        // the other shares above growing: GOLD_DEEP_DECAY (constants.js) shaves an
        // additional cut off gold's leftover share as t and _prog2 climb (score
        // 34->233, then 233->900). The two legs are redistributed differently
        // (2026-09-11, replacing one blended goldDecayT fed through a single
        // proportional split): every capped power-up -- red (shield, capped stacks),
        // blue (slow time, capped duration), orange (ammo, capped bullets) -- was
        // drifting past its intended ceiling by the deep-run plateau when the whole
        // cut scaled all four "other" types together, since they were already the
        // largest shares (red hit ~26% against its documented 21% ceiling; blue/orange
        // similarly overshot their flat baselines). Real player complaint: "too many
        // shields." So the t-leg (score 34->233, the same window red's own ramp
        // climbs in) still redistributes across blue/orange/green like before -- that
        // keeps green's score-71 gate from opening early via an unaccounted leftover,
        // same as always. But the _prog2 leg (score 233->900, the marathon) goes to
        // green alone: blue/orange/red are all flat past score 233 (matching red's own
        // ramp, which is t-only), and green is the one type explicitly designed to
        // keep growing through the marathon (see greenBase above) -- "magnet is most
        // run-defining on a long run" already motivated that ramp, so the marathon
        // surplus from gold's decay belongs there too, not diluting the other three.
        const goldCutT  = wGold * GOLD_DEEP_DECAY * t * 0.5;
        const goldCutP2 = wGold * GOLD_DEEP_DECAY * prog2At(wx) * 0.5;
        wGold -= (goldCutT + goldCutP2);
        const rampSum = wBlue + wOrange + wGreen;
        if (goldCutT > 0 && rampSum > 0) {
            const scale = 1 + goldCutT / rampSum;
            wBlue *= scale; wOrange *= scale; wGreen *= scale;
        }
        if (goldCutP2 > 0) wGreen += goldCutP2;
        const cumGold   = wGold;
        const cumBlue   = cumGold + wBlue;
        const cumRed    = cumBlue + wRed;
        const cumOrange = cumRed + wOrange;
        type = r < cumGold ? 'gold' : r < cumBlue ? 'blue' : r < cumRed ? 'red' : r < cumOrange ? 'orange' : 'green';
    } else if (progAt(wx) >= 0.22) {
        // score ~12-40: gold and slow time only
        type = r < 0.72 ? 'gold' : 'blue';
    }
    // score 0-12: gold only
    if (coinBlockedByStal(wx, coinY)) return null;
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
    if (progAt(wx) >= 0.38) {
        if (wx >= nextPoisonWx) {
            type = 'poison';
            nextPoisonWx = wx + worldPxForSec(POISON_INTERVAL_SEC * (0.7 + rngCoin() * 0.6), wx);
        }
        // Drain checked after poison, before bomb: a coin where both punisher clocks
        // are ready becomes drain (poison's clock still resets -- same "each rerolls
        // independently" rule as the poison/bomb tie), but a ready bomb still wins the
        // final override so a reward is never eaten by a punisher on a triple-ready coin.
        if (wx >= nextDrainWx) {
            type = 'drain';
            nextDrainWx = wx + worldPxForSec(DRAIN_INTERVAL_SEC * (0.7 + rngCoin() * 0.6), wx);
        }
        if (wx >= nextBombWx) {
            type = 'bomb';
            nextBombWx = wx + worldPxForSec(BOMB_INTERVAL_SEC * (0.7 + rngCoin() * 0.6), wx);
        }
    }
    // Power-up supply floor (constants.js POWERUP_MIN_GAP_SEC doc). Sits here, after
    // the overrides above, for two reasons. (1) Same reason the hazard clocks are
    // checked after placement: ~90% of candidates are rejected by coinBlockedByStal,
    // so a floor applied to the raw roll would be ~10x stricter than its stated
    // seconds. (2) A ready poison/bomb/drain must never be delayed by an unrelated
    // shield veto - and because the override block only draws rngCoin() on the frames it
    // actually fires, and a coin it fires on is never floored, the hazard cadence and
    // the rngCoin() stream downstream of it are bit-identical to before this floor
    // existed. A vetoed coin is dropped ENTIRELY rather than falling back to gold:
    // handing the suppressed share to gold would re-break the corridor bonus this
    // same pass is fixing (constants.js GAP_DECAY / CHICANE_GOLD_GAP_SEC). Gated on
    // the same score-34 threshold as poison/bomb/drain so it can never thin the
    // onboarding coin line, where blue is the only non-gold type and the arc is the
    // game's one wordless lesson that RELEASE is half the control scheme. Orange has
    // no floor on purpose - see the doc; types with no entry pass straight through.
    if (progAt(wx) >= 0.38 && POWERUP_MIN_GAP_SEC[type] !== undefined) {
        const floorMult = lerp(POWERUP_GAP_EARLY_MULT, 1, Math.min(prog2At(wx), 1));
        const lastWx    = type === 'blue' ? lastBlueWx : type === 'red' ? lastRedWx : lastGreenWx;
        if (wx - lastWx < worldPxForSec(POWERUP_MIN_GAP_SEC[type] * floorMult, wx)) return null;
    }
    // Supply clocks reset on the FINAL type, after the poison/bomb/drain overrides
    // above -- a red coin that got overridden into a bomb never reached the player as
    // a shield, so it must not start red's floor running either. (The magnet's
    // soft-pity reset used to sit before the overrides; folding it in here fixes the
    // same edge case for green.)
    if      (type === 'blue')  lastBlueWx  = wx;
    else if (type === 'red')   lastRedWx   = wx;
    else if (type === 'green') lastGreenWx = wx;
    return { wx, y: coinY, collected: false, type, fade: 1.0 };
}

function maintainCoins() {
    while (nextCoinWx < scrollX + SPAWN_W + SPAWN_AHEAD_COIN) {
        const coin = makeCoin(nextCoinWx);
        if (coin) coins.push(coin);
        nextCoinWx += coinSpacing(nextCoinWx) * (0.65 + rngCoin() * 0.70);
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
            if (coin.type === 'drain') {
                // Second hazard coin: debits a compounding percentage of the VISIBLE
                // run score (bonusScore), not the shard pool poison takes. The HUD
                // number itself drops. Fraction of the current score (constants.js
                // DRAIN_LOSS_PCT_MIN/MAX), so the absolute hit grows the deeper the
                // run goes -- on-theme for "the game gets harder over distance". Can't
                // drive the total negative (fraction of a shrinking number); update.js
                // clamps score at 0 regardless. Breaks the combo like poison.
                coinCombo = 0; coinComboTimer = 0;
                const drainPct = lerp(DRAIN_LOSS_PCT_MIN, DRAIN_LOSS_PCT_MAX, _prog);
                const loss = Math.max(1, Math.ceil(Math.max(0, score) * drainPct));
                bonusScore -= loss;
                burstCoin(sx, coin.y, 328, 24);
                shake += 6;
                pushNotif(sx, coin.y - 34, 1.2, `-${loss}`, [200, 70, 110]);
                sfxDrain();
                window.webkit?.messageHandlers?.haptic?.postMessage('warning');
                continue;
            }
            if (coinComboTimer > 0) coinCombo++; else coinCombo = 1;
            // ELECTRIC trades a shorter combo window for its slow-time buff below; mastery
            // eases it toward, but deliberately never all the way to, the 2.0s baseline --
            // see the "never fully erase the drawback" doc above SKINS in constants.js.
            coinComboTimer = activeSkin === 3 ? masteryLerp(3, 1.5, 1.8) : 2.0;
            const pts = coinCombo * 3;
            bonusScore += pts;
            runCoins++;
            skinXP[activeSkin] = (skinXP[activeSkin] || 0) + 1;
            runCoinsByType[coin.type] = (runCoinsByType[coin.type] || 0) + 1; // daily missions
            if (coinCombo > runMaxCombo) runMaxCombo = coinCombo;
            if (coin.type === 'blue') {
                // Cap cut 8.0 -> 6.0 on 2026-09-11 (ELECTRIC's 12/15 scaled with it to
                // keep its documented +50%): a replay audit measured slow-time active
                // 38-85% of the run past score 233, which makes the blue coin the
                // baseline pace rather than a rescue and works directly against the
                // "scrollSpd() never plateaus" rule. The 4.0s PER COIN is untouched -
                // the 0.6x-then-glide-back-to-1.0x swoop is the mechanic and stacking
                // two coins still buys a real window; what changes is how far a streak
                // of them can run the window out. See also POWERUP_MIN_GAP_SEC.
                slowTime = Math.min(slowTime + (activeSkin === 3 ? masteryLerp(3, 6.0, 7.5) : 4.0), activeSkin === 3 ? masteryLerp(3, 9.0, 11.25) : 6.0);
                slowTimeMax = slowTime;  // capture the window the scroll + music glide ramps over (world.js slowScrollFactor)
                burstCoin(sx, coin.y, 195, 26);
                shake += 3;
                pushNotif(sx, coin.y - 34, 1.1, T.notifSlow, [60,210,255]);
                sfxSlow();
                bgmSetSlow(true, slowTime);  // music sags, then glides back up over the effect (audio.js)
                window.webkit?.messageHandlers?.haptic?.postMessage('light');
            } else if (coin.type === 'red') {
                // CRIMSON trades shield capacity away for its slim-hitbox buff below;
                // VOID's buff IS extra shield capacity. VOID's cap grows to 5. CRIMSON's
                // stays capped at 2 (2.4 rounds down, never up to the 3 baseline) --
                // mastery is CRIMSON's hitbox buff getting sharper, not this drawback
                // healing away, see the "never fully erase the drawback" doc above SKINS.
                const shieldCap = activeSkin === 5 ? Math.round(masteryLerp(5, 4, 5))
                                 : activeSkin === 2 ? Math.round(masteryLerp(2, 2, 2.4))
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
                // heals the pickup amount fully to the 5 baseline, but the cap only as far
                // as 9 -- never the full 10 -- so the drawback never fully erases (see the
                // "never fully erase the drawback" doc above SKINS in constants.js).
                bulletAmmo = Math.min(bulletAmmo + (activeSkin === 6 ? Math.round(masteryLerp(6, 3, 5)) : 5),
                                       activeSkin === 6 ? Math.round(masteryLerp(6, 6, 9)) : 10);
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
        // Same slowScrollFactor() clock as bullet travel/scroll/music below, so the
        // fire rate itself sags and recovers with bullet-time instead of staying real-time.
        bulletFireTimer = Math.max(0, bulletFireTimer - dt * slowScrollFactor());
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
        // Corridor wall: bullets only ever check stalactites/mines/cannon shots
        // below, never the tunnel silhouette itself, so a bullet flying near a
        // curving wall would visibly clip straight into solid rock with no
        // collision at all. boundsAt() (not boundsBase()) matches what the
        // player's own wall collision and the rendered wall use, so a bullet
        // dies exactly where it looks like it should.
        const wallBnd = boundsAt(b.wx);
        if (b.y - 3.5 < wallBnd.top || b.y + 3.5 > wallBnd.bot) {
            burstStalCrack(bsx, b.y);
            sfxStalCrack();
            window.webkit?.messageHandlers?.haptic?.postMessage('light');
            hit = true;
        }
        if (!hit) for (const s of stalactites) {
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
            for (const bo of boulders) {
                const dx = b.wx - bo.wx, dy = b.y - bo.y;
                if (dx*dx + dy*dy < (bo.r + 3.5) * (bo.r + 3.5)) {
                    burstStalCrack(bsx, b.y);   // sparks off - solid rock, not destroyed
                    sfxStalCrack();
                    window.webkit?.messageHandlers?.haptic?.postMessage('light');
                    hit = true;
                    break;
                }
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
// MINE_RETRY_OFFSETS: if the requested world-x is unusable, shuffle the mine
// forward a little and try again rather than giving up on it. Added 2026-09-11
// after a replay audit measured mine density running BACKWARDS with difficulty:
// 1.66 mines per 1000 world-px at score 100-150, but only 0.35 past score 1400.
// Cause: the chicane veto below. In the deep run stalSpacing() sits on its 50px
// floor with chicaneProb at 0.62, so almost every candidate x has a stalactite
// above AND below within the exclusion window, and ~90% of mines were silently
// dropped. That quietly voided the invariant mines exist to hold (CLAUDE.md: they
// are "the only thing that guarantees no run survives forever") exactly where it
// matters, and it is also what let a full shield stack sit untouched at 3/3 for
// the whole deep run - a stock that can only be spent by getting hit never drains
// if nothing is hitting you. Offsets stay under the 140px minimum spacing between
// consecutive mines (mineSpacing floor 200 x the 0.70 jitter low end) so the mines
// array stays sorted by wx, which maintainMines' front-shift relies on.
const MINE_RETRY_OFFSETS = [0, 45, 90, 135];

function makeMine(wx) {
    // Applies at every depth. It used to be deep-only, because back then the mine
    // horizon sat level with the stalactite horizon and the overlap veto was half
    // blind - early mines rarely got rejected, so a retry only ADDED density there.
    // Now that the horizons are ordered (constants.js SPAWN_AHEAD_*) the veto sees the
    // whole neighbourhood at every depth and rejects early mines too, so the retry is
    // what keeps the early-game density at its tuned value rather than raising it.
    for (const off of MINE_RETRY_OFFSETS) {
        const m = _makeMineAt(wx + off);
        if (m) return m;
    }
    return null;
}

function _makeMineAt(wx) {
    // Never place a mine inside a chicane (shrinks at high density so mines don't disappear)
    const chicaneExclude = lerp(120, 50, prog2At(wx));
    let nearTop = false, nearBot = false;
    for (const s of stalactites) {
        if (Math.abs(s.wx - wx) > chicaneExclude) continue;
        if (s.isTop) nearTop = true; else nearBot = true;
    }
    if (nearTop && nearBot) return null;

    const bobAmp = lerp(H * 0.02, H * 0.035, progAt(wx));
    const b      = boundsBase(wx);
    // PLACE_* margins, not MINE_R/PR: this decides whether the mine EXISTS, and
    // _makeMineAt draws rngMine() only when it succeeds - so a margin that varies by
    // screen forks the shared obstacle stream (constants.js PLACE_PR doc).
    const margin = (PLACE_MINE_R + PLACE_PR * 2.5) * _REF_TO_H;
    let lo = b.top + margin, hi = b.bot - margin;

    // Push mine away from single nearby stalactite tips. The radius shrinks with
    // depth: 300px is right in the mid-game (don't stack two demands on one stretch),
    // but past the plateau stalSpacing() sits on its 50px floor, so a 300px radius
    // means clearing EVERY tip in a 600px window - which leaves no vertical room at
    // all and made deep mines extinct once the horizon ordering stopped hiding half
    // the stalactites from this loop (constants.js SPAWN_AHEAD_*). The old deep mine
    // density was itself an artifact of that blindness, not a tuned value. 90px deep
    // restores real deep pressure (measured 0.98 -> 2.0 per 1000 world-px at score
    // 900-1400) and is a no-op below score 233, where the lerp is still 300.
    for (const s of stalactites) {
        if (Math.abs(s.wx - wx) > lerp(300, 90, Math.min(prog2At(wx), 1))) continue;
        const sb = boundsBase(s.wx);
        if (s.isTop) {
            const tipY = sb.top + s.length;
            lo = Math.max(lo, tipY + bobAmp);
        } else {
            const tipY = sb.bot - s.length;
            hi = Math.min(hi, tipY - bobAmp);
        }
    }

    if (hi - lo < PLACE_MINE_R * 2 * _REF_TO_H) return null;
    let baseY = lo + rngMine() * (hi - lo);
    // Apex bias (deep only, flagged): at a genuine bend apex - where the corridor
    // shape already forces the player onto the centreline - most mines snap toward
    // that centreline instead of scattering. Same count, same speed; it just puts
    // the mine where the player has to be. _deepHash keyed so it doesn't perturb
    // the rngMine() stream. Watch this one in playtest for a "the game is cheating" read.
    if (_deepVarietyOn && wx > DEEP_APEX_WX) {
        const cM = centerAt(wx), cL = centerAt(wx - 40), cR = centerAt(wx + 40);
        const isApex = (cL - cM) * (cR - cM) > 0;   // neighbours same side => local extremum
        if (isApex && _deepHash(Math.floor(wx / 130) + 0x4000) < 0.6) {
            baseY = Math.max(lo, Math.min(hi, lerp(baseY, cM, 0.75)));
        }
    }
    return { wx, baseY, phase: rngMine() * Math.PI * 2, bobAmp };
}

function maintainMines() {
    while (nextMineWx < scrollX + SPAWN_W + SPAWN_AHEAD_MINE) {
        const mine = makeMine(nextMineWx);
        if (mine) mines.push(mine);
        nextMineWx += mineSpacing(nextMineWx) * (0.70 + rngMine() * 0.60);
    }
    while (mines.length && mines[0].wx < scrollX - 150) mines.shift();
}

// ── Cannon system ─────────────────────────────────────────────────────
// A cannon is a wall-mounted turret, not a projectile itself -- it's inert
// (not solid, can't be flown into) until the player closes to within
// CANNON_FIRE_LEAD world-px, at which point it fires exactly one diagonal
// shot and goes dormant. See updateCannonShots for the fire trigger + the
// shot's own movement/collision.

// Offsets stay under the ~900px minimum gap between consecutive cannons
// (cannonSpacing floor 1200 x the 0.75 jitter low end) so the array keeps its wx
// order, which maintainCannons' front-shift relies on.
const CANNON_RETRY_OFFSETS = [0, 150, 300, 450, 600];

function makeCannon(wx) {
    // Shuffle forward past a stalactite rather than dropping the cannon: the veto is
    // there to avoid layering two hazards at one x, not to thin cannons out. Dropping
    // was survivable only because cannons used to be created BEYOND the stalactite
    // horizon and so barely saw any (see constants.js SPAWN_AHEAD_*).
    //
    // The wall is drawn BEFORE the loop, not inside the winning branch. Two reasons.
    // It picks which wall this cannon is mounted on, and the veto below is per-wall,
    // so it has to be known first. And consuming rngCannon() only on success made the
    // stream depend on how many offsets got rejected - the same failure mode called
    // out on makeMine, and one the retry loop made much more likely to bite.
    const isTop = rngCannon() < 0.5;
    for (const off of CANNON_RETRY_OFFSETS) {
        const cx = wx + off;
        let clear = true;
        for (const s of stalactites) {
            // SAME-WALL, and geometric rather than a flat 140px. A ceiling spike is no
            // reason to move a floor-mounted cannon - they do not overlap and never
            // did. The flat radius looked harmless while the horizon was too short to
            // enforce it, but a ±140px stalactite-free window CANNOT EXIST past the
            // plateau (stalSpacing floors at 50px), so honouring the old test with a
            // horizon wide enough to see the whole window would simply have made deep
            // cannons extinct. What the veto actually wants is "don't draw a turret
            // through a spike": cannon radius + the spike's own width, in reference
            // space because s.wx is world-px while the radii are device-px.
            if (s.isTop !== isTop) continue;
            if (Math.abs(s.wx - cx) < PLACE_CANNON_R + placeStalW(s.wx)) { clear = false; break; }
        }
        if (clear) return { wx: cx, isTop, fireAtWx: cx - CANNON_FIRE_LEAD, fired: false };
    }
    return null;
}

function maintainCannons() {
    while (nextCannonWx < scrollX + SPAWN_W + SPAWN_AHEAD_CANNON) {
        const cannon = makeCannon(nextCannonWx);
        if (cannon) cannons.push(cannon);
        nextCannonWx += cannonSpacing(nextCannonWx) * (0.75 + rngCannon() * 0.50);
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
        // Crosses most (not all) of the corridor diagonally -- a rngCannon()-picked span so
        // successive cannons don't all draw the exact same line across the tunnel.
        const spanY = (b.bot - b.top) * (0.55 + rngCannon() * 0.35) * (c.isTop ? 1 : -1);
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
        // letting it visibly clip through solid rock. Same crack sfx as every other
        // projectile-hits-something case (bullet vs. stalactite/wall, above) -- this
        // one previously sparked silently, no sound at all.
        const sb = boundsAt(s.wx);
        if (s.y < sb.top - 4 || s.y > sb.bot + 4) {
            burstStalCrack(bsx, Math.max(sb.top, Math.min(sb.bot, s.y)));
            sfxStalCrack();
            cannonShots.splice(i, 1);
        }
    }
}

// ── Boulders ──────────────────────────────────────────────────────────
// A large static rounded rock parked in the deep corridor. Unlike a mine it is
// telegraphed by sheer size from far off and it does NOT span the corridor -
// there is always a pass above AND below, so it asks "commit up or down" rather
// than "react". Radius is bounded so both gaps clear the player
// (R <= halfGap - 2*PR), and the centre is nudged a seeded amount toward one
// wall so one route is the easy one and the other is the squeeze. Circle-circle
// collision (update.js), same shield-absorb behaviour as a mine. Bombs clear
// them; bullets just spark off (it is solid rock, not a destructible hazard).
// Offsets stay under the 1800px minimum gap between consecutive boulders
// (boulderSpacing floor 2400 x the 0.75 jitter low end), keeping the array ordered.
const BOULDER_RETRY_OFFSETS = [0, 200, 400, 600, 800, 1000];

function makeBoulder(wx) {
    for (const off of BOULDER_RETRY_OFFSETS) {
        const b = _makeBoulderAt(wx + off);
        if (b) return b;
    }
    return null;
}

function _makeBoulderAt(wx) {
    const b  = boundsBase(wx);
    const hg = (b.bot - b.top) / 2;
    // PLACE_* throughout (constants.js PLACE_PR doc): this sets the boulder's actual
    // radius, so a W-derived margin against an H-derived corridor made the rock a
    // different size - and sometimes made it not exist at all - per device.
    const maxR = Math.min(hg - (PLACE_PR * 2 + 6) * _REF_TO_H, hg * 0.42);
    if (maxR * _H_TO_REF < PLACE_PR) return null;      // corridor too tight for one
    const r    = maxR * (0.82 + _deepHash(Math.floor(wx / 260) + 0x3000) * 0.18);
    const cy   = (b.top + b.bot) / 2;
    const room = hg - r - PLACE_PR * 2 * _REF_TO_H;     // how far the centre can shift
    const side = _deepHash(Math.floor(wx / 260) + 0x3001) < 0.5 ? -1 : 1;
    const off  = side * room * (0.35 + _deepHash(Math.floor(wx / 260) + 0x3002) * 0.5);
    const y    = cy + off;
    // Both passes must SURVIVE the stalactites that overlap this rock - that is the
    // boulder's whole contract ("always a pass above AND below"), and the corridor
    // bound above only guarantees it against a bare corridor. This used to be a proxy
    // test - reject if any stalactite is within r + its width - which had two faults.
    // It was blind (the retry offsets walked the probe past the stalactite horizon,
    // see constants.js SPAWN_AHEAD_*), and once the horizon was widened to make it see
    // properly it turned out to be unsatisfiable deep for the same reason the old flat
    // cannon veto was: stalSpacing() floors at 50px, so "no spike within ~73px" is a
    // window that essentially never exists, and boulders fell from 18 to 7.5 per 60000
    // world-px. Testing the contract directly instead of a proxy for it is both
    // stricter where it matters (0 sealed passes, measured, vs. 12 of 18 before) and
    // far less wasteful - a spike near the rock's EDGE barely eats into either pass,
    // which the proxy could not tell apart from a spike through its middle.
    // Mixed axes throughout, so the horizontal half-chord is computed in reference
    // space (s.wx is world-px; r is H-derived device-px) and converted back.
    const need = PLACE_PR * 2.2 * _REF_TO_H;            // ~1.1 player diameters per pass
    const rRef = r * _H_TO_REF;
    for (const s of stalactites) {
        const dx = Math.abs(s.wx - wx);
        if (dx >= rRef + placeStalW(s.wx)) continue;
        // Vertical half-extent of the rock where this spike actually crosses it.
        const chord = Math.sqrt(Math.max(0, rRef * rRef - Math.max(0, dx - placeStalW(s.wx)) ** 2)) * _REF_TO_H;
        const sb = boundsBase(s.wx);
        if (s.isTop) { if ((y - chord) - (sb.top + s.length) < need) return null; }
        else         { if ((sb.bot - s.length) - (y + chord) < need) return null; }
    }
    return { wx, y, r };
}

function maintainBoulders() {
    while (nextBoulderWx < scrollX + SPAWN_W + SPAWN_AHEAD_BOULDER) {
        const bo = makeBoulder(nextBoulderWx);
        if (bo) boulders.push(bo);
        nextBoulderWx += boulderSpacing(nextBoulderWx) * (0.75 + _deepHash(Math.floor(nextBoulderWx / 300) + 0x3003) * 0.5);
    }
    while (boulders.length && boulders[0].wx < scrollX - 200) boulders.shift();
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
        const fy = stalFallY(s);
        const tipY = s.isTop ? b.top + s.length + fy : b.bot - s.length;
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
    for (let bi = boulders.length - 1; bi >= 0; bi--) {
        const bo = boulders[bi];
        const dx = (bo.wx - scrollX) - cx, dy = bo.y - cy;
        if (dx*dx + dy*dy < (BOMB_RADIUS + bo.r) * (BOMB_RADIUS + bo.r)) {
            boulders.splice(bi, 1);
            burstStalCrack(bo.wx - scrollX, bo.y);
            burst(bo.wx - scrollX, bo.y, 20);
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
    const fy = stalFallY(s);   // 0 unless this is a detached falling stalactite
    let ax, ay, bx2, by2, tx, ty;
    if (s.isTop) {
        ax = sx-hw; ay = b.top+fy; bx2 = sx+hw; by2 = b.top+fy; tx = sx; ty = b.top+s.length+fy;
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
    const fy = stalFallY(s);
    let ax, ay, bx2, by2, tx, ty;
    if (s.isTop) {
        ax = sx-hw; ay = b.top+fy; bx2 = sx+hw; by2 = b.top+fy; tx = sx; ty = b.top+s.length+fy;
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
