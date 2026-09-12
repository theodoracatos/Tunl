// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── Procedural tunnel ───────────────────────────────────────────────
// The day whose cave/name/palette we render comes from _tunlActiveDate()
// (src/web.js) - normally today, but the web ?d= deep link can point it at a
// past day. Real-day logic (streak/stardust/daily reset in lifecycle.js) stays
// on the actual date played.

let _prog, _prog2, _halfGap, _wA1, _wA2, _wF1, _wF2;

// Per-day phase offset for the two corridor waves, derived from the same UTC
// day-int used to seed the obstacle rng() (not the rng() stream itself, so it
// doesn't shift obstacle placement). Only the phase varies - amplitude and
// frequency stay exactly as tuned - so every day's corridor is a genuinely
// different shape without touching the hand-tuned difficulty feel.
let _wavePhase1 = 0, _wavePhase2 = 0;
// Small per-day multipliers on top of that same phase: +/-8% on wave amplitude
// and (independently) +/-8% on frequency, so a day's corridor isn't just the
// same curve shifted in time - it can be a bit wider/lazier or tighter/wigglier
// too. Kept tight on purpose: centerAt() already clamps the wave to stay inside
// _halfGap regardless of amplitude, but a big swing would still make the *feel*
// of a day wildly inconsistent with the hand-tuned baseline, which is the thing
// CLAUDE.md says not to touch.
let _waveJitterA = 1, _waveJitterF = 1;
// Which of DAY_ARCHETYPES (below) applies today - nudges obstacle/coin
// spacing and chicane odds, all within their existing tuned ranges (see
// stalSpacing/coinSpacing/mineSpacing below and maintainStalactites in
// systems.js).
let _dayArchetype = 0;
// UTC day-int of the cave being flown, captured in seedDailyVariety. Seeds the
// deep-run shape/pace variety (deepMorphAt / the scrollSpd pulse) independently
// of the rng() obstacle stream. 0 until seedDailyVariety runs (and in the
// test-math sandbox, which just exercises "day 0" deterministically).
let _deepDay = 0;
function seedDailyVariety(dayInt) {
    // Same hash chain as before (phase1/phase2), just kept going for the extra
    // draws below - still fully independent of the rng() stream used for
    // obstacle placement, so none of this shifts stalactite/coin/mine layout.
    let h = Math.imul(dayInt ^ 0x9e3779b9, 0x45d9f3b) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    _wavePhase1 = (h % 6283) / 1000;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    _wavePhase2 = (h % 6283) / 1000;
    const draw = () => {
        h = Math.imul(h ^ (h >>> 15), 1 | h);
        h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h;
        h = (h ^ (h >>> 14)) >>> 0;
        return h / 4294967296;
    };
    _waveJitterA = 1 + (draw() * 2 - 1) * 0.08;
    _waveJitterF = 1 + (draw() * 2 - 1) * 0.08;
    _dayArchetype = Math.floor(draw() * DAY_ARCHETYPES.length);
    _deepDay = dayInt;
}

// ── Deep-run variety (score ~900+) ───────────────────────────────────
// Past the _prog2 plateau every corridor geometry knob is capped (CLAUDE.md:
// pushing them further makes the tunnel unnavigable) and only scrollSpd() still
// climbs - so the deep game was one variable, speed, getting slowly twitchier
// against a frozen corridor. These two additions give the deep run a changing
// SHAPE and PACE without breaching that navigability wall:
//
//  - deepMorphAt() redistributes the two corridor waves' AMPLITUDES per a
//    seeded per-day character sequence, so a deep stretch reads as big clean
//    sweeps, or beating chop, or near-straight. The a1/a2 splits are chosen so
//    wA1*wF1 + wA2*wF2 (peak corridor velocity) never exceeds ~1.03x the frozen
//    plateau - the corridor is a different shape, never more wiggle-energy than
//    today. Only amplitudes move; frequencies are left alone, because changing
//    the frequency of sin(wx*f) at large wx scrambles accumulated phase and
//    would need a phase-integral rework (a later phase, if wanted).
//  - the pulse in scrollSpd(): a slow seeded swell of +/-DEEP_PULSE_AMP around
//    the ever-rising trend, so the deep game breathes instead of being one
//    monotone acceleration. The trend itself is untouched (the "never plateau"
//    rule holds); the pulse only textures it.
//
// Both are pure functions of scrollX + _deepDay, so every player flies the
// identical sequence and the scrollX-indexed ghost stays locked to it, and both
// are inert below DEEP_VARIETY_WX so the hand-tuned mid-game is byte-identical.
// Master kill-switch for both deep-run additions - always true in the shipping
// game; a one-line revert path if a deep playtest ever wants them off without a
// code rollback, and the seam test-math.js uses to isolate the morph's effect
// from the pre-existing _prog2 wave boost.
let _deepVarietyOn = true;
// Where the deep-run variety (shape morph, chambers, coin-line shapes, palette
// drift) switches on. Was 54000 (_prog2 == 1, score ~900) until 2026-09-11, when a
// replay audit against the real leaderboard found the highest daily best ever
// recorded is 169 - so every one of these features was content no player had ever
// seen. Moved to 30000 (_prog2 == 0.4, score 500) that day.
//
// Moved again in 12.0, to 9000 (score 150) - same mistake one order smaller. A
// red-team simulation (2400 runs across 4 calibrated skill tiers, method in
// CLAUDE.md's audit trail) found the real leaderboard sample (median daily best 70)
// sits at its "average" tier, and measured that tier reaching wx 30000 in exactly
// **0%** of 600 runs - the content was still content nobody had ever seen, just one
// step removed from the boulder mistake instead of two. At 9000: average 3.3% of
// runs, good (the tier just under real players' own best runs) 24.7%, expert 63.5% -
// so this is the same "does ANY meaningful share of real play reach it" bar the
// 2026-09-11 boulder move used (7 of 8 day-seeds by score 85-150), not a promise
// that most runs will.
// Safe at any value because every deep-variety piece is bounded RELATIVE to the same
// wx unmorphed: the morph's amplitude splits are capped against corridor velocity at
// that wx (test-math guards this at any wx, not just past the plateau), and chambers
// only ever widen.
// The speed pulse is NOT moved with it - it stays gated on `_prog2 > 1` in
// scrollSpd(), because surging *above* a trend that is still steeply ramping is a
// different proposition from surging above a flat one.
const DEEP_VARIETY_WX    = 9000;    // _prog2 == 0, score ~150
// Apex-biased mines (systems.js makeMine) deliberately did NOT move with
// DEEP_VARIETY_WX. CLAUDE.md flags that one as "watch in playtest for a 'the game
// is cheating' read" and it has never had a device playtest; pulling an unproven
// fairness risk 400 points earlier is not part of a supply/pacing fix. Kept on the
// old score-900 line until someone actually flies it.
const DEEP_APEX_WX       = 54000;   // _prog2 == 1, score ~900
const DEEP_CHAR_WAVELEN  = 4200;    // world-px each shape character holds
const DEEP_PULSE_AMP     = 0.12;    // speed pulse: surge of up to +this fraction ABOVE the trend (never below)
const DEEP_PULSE_WAVELEN = 2600;    // world-px per speed-pulse cycle
// Amplitude multipliers on (wave 1, wave 2). Wave 1 is the slow wide arc, wave 2
// the faster shallow ripple: lifting wave 2 toward wave 1 makes the ride bumpy,
// dropping it leaves long clean sweeps. Every row keeps a1*W1v + a2*W2v within
// ~3% of the (1,1) plateau - see the test-math guard.
const DEEP_CHARS = [
    { a1: 1.00, a2: 1.00 },   // even     - the current frozen plateau shape
    { a1: 1.45, a2: 0.32 },   // sweeps   - big clean arcs, ripple flattened out
    { a1: 0.32, a2: 1.60 },   // chop     - fast wave dominates, bumpy ride
    { a1: 0.24, a2: 0.34 },   // straight - shallow, hold steady at speed
];

// Deterministic per-day pick for band index n. Independent of the rng() obstacle
// stream AND of seedDailyVariety's h-chain, so it shifts neither placement nor
// _dayArchetype. Same imul mix as _worldTable's shuffle rng.
function _deepHash(n) {
    let s = Math.imul((_deepDay ^ 0x9e3779b9) + Math.imul(n + 1, 0x6d2b79f5), 0x45d9f3b) >>> 0;
    s = Math.imul(s ^ (s >>> 15), 1 | s);
    s = (s + Math.imul(s ^ (s >>> 7), 61 | s)) ^ s;
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
}

// Wave-amplitude split (a1, a2 multipliers) active at world-x wx, smoothstepped
// across the last 30% of each band so the wall never kinks at a boundary.
// Every LATER character boundary is continuous by construction: a segment holds its
// character flat for the first 70% of its span, then blends toward the NEXT segment's
// character over the last 30%, so by the time wx crosses into that next segment the
// value has already arrived - no seam. Segment 0 itself had nothing to blend FROM,
// though: below DEEP_VARIETY_WX this returned a bare {1,1} with no segment machinery
// at all, so crossing D could jump straight from {1,1} to a fully-hashed character in
// a single world-px - a real seam, just one small enough (and far enough into a score
// band nothing used to place there) that it went uncaught until 12.0 moved
// DEEP_VARIETY_WX into active boulder territory and test-cave.js's pass-safety check
// hit it. Fixed by giving segment 0 its OWN entry ramp, spending the same 30%-of-
// wavelength window every later segment spends blending OUT, blending IN instead -
// symmetric, and it keeps wx <= DEEP_VARIETY_WX exactly {1,1} (nothing at/below the
// documented switch-on point moves), never shifting where deviation starts.
function deepMorphAt(wx) {
    if (!_deepVarietyOn || wx <= DEEP_VARIETY_WX) return { a1: 1, a2: 1 };
    const entry = DEEP_CHAR_WAVELEN * 0.3;
    if (wx <= DEEP_VARIETY_WX + entry) {
        const t  = (wx - DEEP_VARIETY_WX) / entry;
        const bl = t * t * (3 - 2 * t);
        const c1 = DEEP_CHARS[Math.floor(_deepHash(0) * DEEP_CHARS.length)];
        return { a1: 1 + (c1.a1 - 1) * bl, a2: 1 + (c1.a2 - 1) * bl };
    }
    const u    = (wx - DEEP_VARIETY_WX) / DEEP_CHAR_WAVELEN;
    const seg  = Math.floor(u);
    const frac = u - seg;
    const c0 = DEEP_CHARS[Math.floor(_deepHash(seg)     * DEEP_CHARS.length)];
    const c1 = DEEP_CHARS[Math.floor(_deepHash(seg + 1) * DEEP_CHARS.length)];
    const t  = frac < 0.7 ? 0 : (frac - 0.7) / 0.3;
    const bl = t * t * (3 - 2 * t);
    return { a1: c0.a1 + (c1.a1 - c0.a1) * bl, a2: c0.a2 + (c1.a2 - c0.a2) * bl };
}

// Deep-run chambers (score ~900+): a rare seeded world-x window where the
// corridor half-gap balloons to DEEP_CHAMBER_PEAK and settles back on a sine
// bump - a breather and a visual change, never a hazard (wider is always
// navigable). Applied to _halfGap (refreshWave) AND halfGapAt() so boundsBase /
// coin+mine placement follow the room. At most one per DEEP_CHAMBER_PERIOD
// world-px, ~55% of periods carrying one in a seeded sub-window that never
// touches a period boundary (so the factor is always 1, i.e. continuous, at the
// seams). Same _deepHash / _deepVarietyOn plumbing as the shape morph.
const DEEP_CHAMBER_PERIOD = 15000;
const DEEP_CHAMBER_PEAK   = 2.1;
function deepChamberAt(wx) {
    if (!_deepVarietyOn || wx <= DEEP_VARIETY_WX) return 1;
    const u   = (wx - DEEP_VARIETY_WX) / DEEP_CHAMBER_PERIOD;
    const seg = Math.floor(u);
    if (_deepHash(seg + 4096) > 0.55) return 1;           // ~45% of periods: no chamber
    const start = 0.12 + _deepHash(seg + 4097) * 0.45;    // position within the period
    const width = 0.16 + _deepHash(seg + 4098) * 0.12;    // fraction of the period spanned
    const frac  = u - seg;
    if (frac <= start || frac >= start + width) return 1;
    const local = (frac - start) / width;                 // 0..1 across the chamber
    return 1 + Math.sin(local * Math.PI) * (DEEP_CHAMBER_PEAK - 1);
}

// Falling stalactites (constants.js FALL_LEAD / FALL_SPAN): cadence only - which
// stalactites get flagged is maintainStalactites(), the drop is updateFallingStals().
// Absent before ~score 200 (nextFallWx starts at world-x 12000 in startPlay); then
// from a rare set-piece (~one per 3400px) toward steady deep pressure, floored so
// they never pile onto everything else once scrollSpd is uncapped.
function fallSpacing(wx = scrollX) {
    const p2 = prog2At(wx);
    return Math.max(lerp(3400, 2000, Math.min(p2, 1)) - 350 * Math.max(p2 - 1, 0), 1800);
}

// Boulders (systems.js makeBoulder/maintainBoulders): a deep-only routing
// obstacle from world-x 84000 (~score 1400). Rare - closer to a cannon's cadence
// than a mine's - so it reads as "commit up or down now", not a dodge-fest.
function boulderSpacing(wx = scrollX) {
    return Math.max(3400 - 250 * Math.max(prog2At(wx) - 1.75, 0), 2400);
}

// Warp portal ring (systems.js makePortal/maintainPortals): a reward set-piece,
// rarer than a boulder on purpose - it hands out a real speed boost plus free
// gold, so it shouldn't be common enough to lean on for score. Floor well above
// every hazard spacing floor (all sub-300px deep), similar order of magnitude to
// a cannon's floor. Doesn't scale with day archetype (DAY_ARCHETYPES only nudges
// hazard/coin density, not this reward).
//
// Retuned 2026-09-12 (was lerp(5200, 2800, progAt) floor 2000) after a replay
// audit measured the shipped 11.0 curve delivering the exact opposite of the
// intent above: one ring every 1-4 REAL seconds past score 100, i.e. denser than
// boulders at every depth and 8-13x more frequent than the warp coin's own 40s
// clock. The shape was the error, not just the scale - spacing TIGHTENED with
// depth while scrollSpd() climbs, so the real-time gap collapsed twice over
// exactly where it hurts. Three things compounded it. (1) The ring needs no aim:
// portalHitTol (update.js) is wider than the ring's own +/-25%-of-halfGap jitter
// at every depth, so a player simply holding the corridor centreline logged 0
// misses in 42.3 crossings. (2) One full-length warp sweeps 1900-4300 world-px
// while spacing deep was 2100-3500, so a warp routinely carried the player PAST
// the next ring and re-triggered before it ended (185 re-triggers per run).
// (3) Every warp exit grants HIT_INVULN_SEC on top. Net measured at a 100% hit
// rate: warp live 54.6% of the run, hazard-immune 75.1%, and score 2400 reached
// in 92s instead of 145s - a 1.58x distance-score rate on the one metric the
// shared daily leaderboard is made of. That is the same failure the blue coin was
// retuned for on 2026-09-11 ("slow-time active 38-85% of the run ... makes the
// blue coin the baseline pace rather than a rescue"), and it also breaks the
// "mines are the only thing that guarantees no run survives forever" pillar in
// CLAUDE.md, since a warped player cannot be hit by one.
//
// The growth is keyed to prog2At, NOT progAt, and that is load-bearing. progAt
// saturates at score 233, so any curve that does its growing on progAt has spent
// itself before real players arrive - every flat-widened candidate measured a
// dead zone with ring #1 at score 47 and ring #2 past score 250, and per the
// leaderboard audit (median daily best 70, highest ever 169) that means most
// players would see exactly one ring ever. Same "don't push content past where
// players actually get" rule that moved boulders 84000 -> 5100. Measured now:
// one ring per 11s / 12s / 19s / 28s / 44s / 46s across the score bands, rings at
// score ~47/161/274/455 (so a median run still gets one and a good run two),
// warp live 5.7% of the run, hazard-immune 11.0% - back in the blue coin's
// post-retune band. Re-measure the DUTY CYCLE, not the world-px number, before
// moving this again.
function portalSpacing(wx = scrollX) {
    return lerp(6500, 10000, progAt(wx)) * (1 + 4 * Math.min(prog2At(wx), 1));
}

// Onboarding corridor widen (score 0-~200, do not revert without re-auditing):
// a brand-new player's first runs are where the "hold to climb, release to
// fall" control model gets learned, and the base curve's wx=0 half-gap
// (H*0.34, corridor 68% of screen height) already reads as narrow to someone
// who hasn't found the feel yet. This adds extra half-gap on top of the base
// curve, biggest at wx=0 (walls reduced to a sliver each side) and
// smoothstepped down to 0 by EARLY_WIDEN_WX so the ramp rejoins the
// hand-tuned base curve exactly, with no kink, in time for the difficulty
// plateau at wx=14000 (score ~233). Both refreshWave and halfGapAt add it, so
// rendering/collision (boundsAt) and placement (boundsBase, via halfGapAt)
// agree - same pattern as deepChamberAt.
const EARLY_WIDEN_WX   = 12000;  // ~score 200 - fully rejoins the base curve
const EARLY_WIDEN_FRAC = 0.09;   // extra half-gap at wx=0, as a fraction of H
function earlyWidenAt(wx) {
    if (wx >= EARLY_WIDEN_WX) return 0;
    const t  = 1 - wx / EARLY_WIDEN_WX;
    const bl = t * t * (3 - 2 * t);   // smoothstep - flat approach at both ends
    return H * EARLY_WIDEN_FRAC * bl;
}

function refreshWave() {
    _prog    = Math.min(Math.sqrt(scrollX / 14000), 1);
    _prog2   = Math.max(scrollX - 14000, 0) / 40000;          // no cap - escalates forever
    _halfGap = lerp(H * 0.34,  H * 0.163, _prog) * deepChamberAt(scrollX) + earlyWidenAt(scrollX);
    // Wave amplitude/frequency keep growing with _prog2 (capped at 2x to stay navigable)
    const wMult  = 1 + 0.12 * Math.min(_prog2, 2);            // up to +24% amplitude
    const wFMult = 1 + 0.14 * Math.min(_prog2, 2);            // up to +28% frequency = tighter bends
    // Deep-run shape morph (score ~900+, see deepMorphAt): sampled at the player's
    // own scrollX and then held across the whole visible span - the same lookahead
    // approximation the _prog2 boost already relies on. boundsBase() samples per-wx
    // for placement accuracy.
    const dm = deepMorphAt(scrollX);
    _wA1     = lerp(H * 0.07,  H * 0.12,  _prog) * wMult * _waveJitterA * dm.a1;
    _wA2     = lerp(H * 0.035, H * 0.055, _prog) * wMult * _waveJitterA * dm.a2;
    _wF1     = lerp(0.0025,    0.0048,    _prog) * wFMult * _waveJitterF;
    _wF2     = lerp(0.0060,    0.0115,    _prog) * wFMult * _waveJitterF;
}

// scrollSpd() without the W/600 term - i.e. the part that is a pure function of
// scrollX and therefore IDENTICAL on every device. Anything that turns "how many
// seconds of play" into "how many world-px" must key off this, never off
// scrollSpd(): the daily seed makes the cave pixel-identical in world-x for every
// player on Earth (CLAUDE.md "Cross-device fairness"), so a world-x threshold
// derived from the W-scaled speed would quietly give a wide phone a different cave
// than a small one. See the chicane-gold gate in systems.js maintainStalactites for
// the one caller that needs this, and how it converts back to seconds.
function scrollSpdBase(wx = scrollX) {
    const _p = progAt(wx), _p2 = prog2At(wx);
    const base = lerp(lerp(230, 400, _p), 560, Math.min(_p2, 1));
    // Past the _prog2 ramp (score ~900), speed never plateaus - it keeps
    // creeping up forever (sqrt eased, like _prog's ramp) instead of the other
    // difficulty knobs, which stay capped so the corridor stays navigable.
    const beyond = Math.max(_p2 - 1, 0);
    let spd = base + Math.sqrt(beyond) * 90;
    // Deep-run speed pulse (score ~900+): a slow seeded swell of up to +DEEP_PULSE_AMP
    // ABOVE the trend, so the deep game surges and eases back instead of being one
    // flat acceleration - but it never dips *below* the trend, so the deep run can
    // never actually get slower (it used to be +/-AMP around the trend, i.e. ~half of
    // every cycle the deep game decelerated, which reads as "getting easier"). The
    // trend is untouched and still climbs forever (the "scrollSpd never plateaus"
    // rule). Pure function of scrollX, so it's deterministic and the scrollX-indexed
    // ghost stays locked.
    if (_p2 > 1 && _deepVarietyOn) {
        const ph = _deepHash(0x7ff) * Math.PI * 2;   // fixed per-day phase, distinct index
        const swell = 0.5 - 0.5 * Math.cos((wx - DEEP_VARIETY_WX) / DEEP_PULSE_WAVELEN * Math.PI * 2 + ph);
        spd *= 1 + DEEP_PULSE_AMP * swell;   // swell in [0,1] -> spd in [trend, trend*(1+AMP)]
    }
    return spd;
}

// * W/600 keeps the on-screen pixel speed consistent across widths. W is capped at
// 956 (constants.js) so this can't hand a wide-screen player a faster/harder cave
// than a phone at the same score - see the fairness audit note in CLAUDE.md.
function scrollSpd() { return scrollSpdBase() * W / 600; }

// World-px that correspond to `sec` seconds of play at the REFERENCE width
// (W_REF_SPD below), independent of the device actually running. Use this wherever
// a cadence wants to be expressed in seconds but has to land on a world-x grid that
// every player shares. 956 is the W cap (constants.js), i.e. the width the feel and
// these cadences were tuned at; a narrower phone therefore experiences the same
// world-x cadence as slightly MORE seconds, which is the same "err generous for
// small screens" direction the W cap already takes.
const W_REF_SPD = 956;
function worldPxForSec(sec, wx = scrollX) { return scrollSpdBase(wx) * (W_REF_SPD / 600) * sec; }

// Blue coin: multiplied into the scroll speed (update.js) and the speed-line
// intensity (draw.js). It is NOT a flat 0.6x-while-active plateau - the coin sags
// the scroll to 0.6x on pickup, then this factor ramps linearly back to full over
// the slow-time window, so the effect is a decelerate-then-recover swoop that ends
// exactly as slowTime runs out. The background music glides on the identical curve
// (audio.js bgmSetSlow), so tunnel and soundtrack speed up together. slowTimeMax is
// the duration captured at the last pickup (systems.js); a mid-effect second blue
// coin recaptures it so the ramp restarts from the new, longer window.
function slowScrollFactor() {
    if (!(slowTime > 0) || !(slowTimeMax > 0)) return 1.0;
    return lerp(0.60, 1.0, 1 - slowTime / slowTimeMax);
}

// Warp portal's speed factor - the mirror image of slowScrollFactor() above: a
// SURGE instead of a sag. Ramps 1.0 -> warpMult over WARP_RAMP_SEC, holds at
// warpMult, then glides back down to 1.0 over the last WARP_RECOVER_FRAC of the
// window so the exit isn't an abrupt cut. warpMult (state.js) is rolled once at
// trigger time from the player's _prog2 (constants.js WARP_MULT_MIN/MAX doc) -
// read here as a fixed value for the whole warp, never re-sampled mid-flight, so
// a warp that starts just before the plateau doesn't shift speed partway through
// as _prog2 keeps climbing underneath it. Folded into the same five places
// slowScrollFactor() already is (scroll, bullet timer/speed, cannon shots, the
// speed-line intensity in draw.js) so nothing streaks through a warped tunnel at
// the wrong speed - see constants.js's "Warp portal" doc for why this is real
// seconds, not a world-px distance.
function warpScrollFactor() {
    if (!(warpTime > 0) || !(warpMax > 0)) return 1.0;
    const elapsed  = warpMax - warpTime;
    const recoverAt = warpMax * (1 - WARP_RECOVER_FRAC);
    if (elapsed < WARP_RAMP_SEC) return lerp(1.0, warpMult, elapsed / WARP_RAMP_SEC);
    if (elapsed > recoverAt)     return lerp(warpMult, 1.0, (elapsed - recoverAt) / (warpMax - recoverAt));
    return warpMult;
}
// Nudges stal/coin/mine density and chicane odds per day, on top of the
// existing _prog/_prog2 curves - see seedDailyVariety. Classic is the
// no-op baseline; the other three each push one knob further and pull
// another back so a day reads as a distinct "flavor", not just harder
// or easier across the board.
const DAY_ARCHETYPES = [
    { stal: 1,    coin: 1,    mine: 1,    chic: 1    }, // Classic
    { stal: 0.85, coin: 1,    mine: 1,    chic: 1.35 }, // Chicane Day
    { stal: 1,    coin: 1,    mine: 0.75, chic: 1    }, // Mine Gauntlet
    { stal: 1.15, coin: 0.72, mine: 1.15, chic: 0.8  }, // Coin Rush
];
// ── Difficulty curves, sampled at a WORLD POSITION ───────────────────
// Every one of these takes the wx being placed, defaulting to the player's own
// scrollX for the handful of callers that legitimately mean "here, now".
//
// Passing the placement wx is load-bearing for cross-device fairness, not a tidy-up.
// The spawn loops run `while (nextXWx < scrollX + W + N)`, so the moment a given
// world position gets its spacing rolled depends on the screen WIDTH - and these
// curves used to read the _prog/_prog2 globals, i.e. the difficulty at the PLAYER's
// scrollX. A wider screen therefore sampled the curve earlier (lower _prog) for the
// same placement and got a different spacing out of it, which forked the "identical
// daily cave" guarantee from wx ~938 (score 15) onward. Measured before this change:
// six device sizes produced six different caves. See the Cross-device fairness
// section in CLAUDE.md and the guard in test-cave.js.
function progAt(wx)  { return Math.min(Math.sqrt(Math.max(wx, 0) / 14000), 1); }
function prog2At(wx) { return Math.max(wx - 14000, 0) / 40000; }   // uncapped, like _prog2

function stalSpacing(wx = scrollX) { return Math.max(lerp(lerp(260,  145, progAt(wx)),  70,  prog2At(wx)) * DAY_ARCHETYPES[_dayArchetype].stal, 50); }
function stalLenFrac(wx = scrollX) { return Math.min(lerp(lerp(0.46, 0.64, progAt(wx)), 0.76, prog2At(wx)), 0.80); }
function coinSpacing(wx = scrollX) { return Math.max(lerp(lerp(600,  320, progAt(wx)), 230,  prog2At(wx)) * DAY_ARCHETYPES[_dayArchetype].coin, 175); }
function mineSpacing(wx = scrollX) { return Math.max(lerp(lerp(900, 340, progAt(wx)), 200, prog2At(wx)) * DAY_ARCHETYPES[_dayArchetype].mine, 200); }
// Chicane odds, same story - rolled per placement, not per player position.
function chicaneProb(wx = scrollX) { return Math.min(lerp(0.24, 0.42, prog2At(wx)) * DAY_ARCHETYPES[_dayArchetype].chic, 0.62); }
// Cannons: rare on purpose, so the spacing floor stays far above every other
// obstacle's (stalSpacing/coinSpacing/mineSpacing all bottom out well under
// 1000) even at max difficulty -- this should read as an occasional set-piece
// ambush, not a recurring hazard type.
function cannonSpacing(wx = scrollX) { return Math.max(lerp(lerp(4200, 2400, progAt(wx)), 1500, prog2At(wx)), 1200); }

// Milestone spacing (50/100/etc. step added to milestoneNext each time one fires --
// see update.js). Widens in stages so milestones stay a frequent early-game reward but
// thin out for strong players who blow past 200-1000 in well under a minute: at the old
// flat +50 step, a great run hit a milestone every ~50 points all the way up, and every
// one from 200 on showed the same maxed-out "!!!" (triggerMilestone, input.js) -- same
// popup, over and over, reading as noise rather than a reward. Also uncapped past the
// last band (keeps growing by the same +1000 forever) rather than settling into a fixed
// step, matching this file's existing philosophy that nothing here should feel like
// flat-pace endurance once a run goes long (see CLAUDE.md's scrollSpd() doc).
// The 25-point band below score 100 (25/50/75) was dropped once, on the grounds that it
// "fired 3 milestones before a weak run even reaches 100". Restored in 12.0, because
// that reasoning was calibrated against strong players and the audience is not one: a
// red-team replay against the real leaderboard sample (median daily best 70) put actual
// players at a median run of 22, and measured that only 13% of their runs ever reached
// the first 50-point milestone at all -- 2% within a new player's first five runs. The
// first positive thing the game has to say other than "dead" was sitting at more than
// twice the distance a typical run covers.
// Strictly a first-minutes fix: the band ends at 100, so every milestone a competent
// run sees is exactly where it was, and the "!!"/"!!!" escalation (triggerMilestone,
// input.js) is untouched. If this ever gets revisited again, the number that matters is
// the share of REAL runs that fire a milestone, not the count a good run accumulates.
function milestoneStep(n) {
    if (n < 100)   return 25;
    if (n < 300)   return 50;
    if (n < 1000)  return 100;
    if (n < 3000)  return 250;
    if (n < 10000) return 500;
    return 1000;
}

// -- Daily world name -------------------------------------------------
const WORLD_ADJ  = ['Crimson','Frozen','Ancient','Dark','Burning','Hollow','Scarlet','Azure',
                    'Obsidian','Toxic','Golden','Crystal','Iron','Shadow','Violet','Ember',
                    'Storm','Silent','Blazing','Neon','Jade','Cobalt','Ash','Pale','Rusted',
                    'Glowing','Sunken','Broken','Eternal','Molten'];
const WORLD_NOUN = ['Abyss','Depths','Hollow','Cavern','Passage','Rift','Void','Chasm',
                    'Grotto','Descent','Labyrinth','Sanctum','Vault','Shaft','Tunnel',
                    'Canyon','Gorge','Sinkhole','Drift','Channel','Corridor','Vein','Pit',
                    'Basin','Keep','Ruin','Crypt','Forge','Crater','Nexus'];

// Shuffled lookup table built once with a fixed seed so every adj+noun pair
// appears exactly once per 900-day cycle in a non-sequential order.
const _worldTable = (() => {
    const n = WORLD_ADJ.length * WORLD_NOUN.length;
    const arr = Array.from({ length: n }, (_, i) => i);
    let s = 0x9e3779b9 >>> 0;
    const r = () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
})();

// Whole UTC days since 2025-01-01 for the day we're rendering. Both the world
// name and the world number key off this one monotonic index so they stay
// locked 1:1: WORLD n uses name-table slot n, and gen === ceil(n / 900), i.e.
// "WORLD 900" is visibly the last before the "<name> 2" generation begins.
// The epoch is arbitrary (a round anchor comfortably before the first daily
// seed on 2026-07-06) and invisible to players - it only has to stay fixed
// forever and keep dayIdx positive, including for past-day ?d= deep links.
function _worldDayIdx() {
    const now   = _tunlActiveDate();
    const epoch = Date.UTC(2025, 0, 1);
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.floor((today - epoch) / 86400000);
}

function dailyWorldName() {
    const dayIdx = _worldDayIdx();
    const N    = _worldTable.length;
    const gen  = Math.floor(dayIdx / N) + 1;
    const slot = _worldTable[((dayIdx % N) + N) % N];
    const name = `${WORLD_ADJ[slot % WORLD_ADJ.length]} ${WORLD_NOUN[Math.floor(slot / WORLD_ADJ.length)]}`;
    return gen > 1 ? `${name} ${gen}` : name;
}

const WORLD_NAME = dailyWorldName();

// World number shown in the run-start banner: a monotonic count of days since
// the 2025-01-01 epoch (WORLD 1 = 2025-01-01), never resets, never repeats.
// Was day-of-year (1-366) until 2026-09-07, which reset every Jan 1 - so
// "WORLD 5" came round every year, it had a leap-year wart at 366, and it was
// decoupled from the name's 900-day cycle. Sharing _worldDayIdx() with the
// name fixes all three. clamped to >= 1 so a pre-epoch ?d= deep link can't
// show WORLD 0 or negative.
function dailyLevelNum() {
    return Math.max(1, _worldDayIdx() + 1);
}
const LEVEL_NUM = dailyLevelNum();

function centerAt(wx) {
    const raw = H / 2
        + _wA1 * Math.sin(wx * _wF1 + _wavePhase1)
        + _wA2 * Math.sin(wx * _wF2 + 1.57 + _wavePhase2);
    // WALL_PAD scales with H (constants.js). A flat 8px did not, so the corridor
    // centre clamped to a slightly different place on every screen height - enough to
    // flip a placement rejection and fork the shared cave. See CLAUDE.md
    // "Cross-device fairness".
    return Math.max(_halfGap + WALL_PAD, Math.min(H - _halfGap - WALL_PAD, raw));
}

// halfGapAt predicts the corridor half-gap when the player reaches world x.
// Uses the same sqrt(wx/14000) progression as refreshWave (and the same deep-run
// chamber factor) so bounds are accurate for placement up to ~900px ahead.
function halfGapAt(wx) {
    return lerp(H * 0.34, H * 0.163, Math.min(Math.sqrt(wx / 14000), 1)) * deepChamberAt(wx) + earlyWidenAt(wx);
}

// boundsAt uses base _halfGap + current bonus so both rendering and
// collision benefit from collected coins.
function boundsAt(wx) {
    const cy = centerAt(wx);
    // warpWidenVisual (update.js, constants.js WARP_GAP_MULT doc) only ever
    // applies here, never in boundsBase() - same rule as gapBonusVisual (CLAUDE.md
    // "boundsBase for coin placement"): nothing that decides where an object gets
    // PLACED may depend on whether a warp happens to be live for this player.
    const hg = _halfGap + gapBonusVisual + warpWidenVisual;
    return { top: cy - hg, bot: cy + hg };
}

// boundsBase predicts placement bounds using the wave params and halfGap that
// will be in effect when the player reaches wx. Mirrors refreshWave's scaling
// (the _prog2 wave amplitude/frequency boost AND the deep-run shape morph) for
// accurate lookahead - sampled per-wx here rather than frozen at the player's x.
function boundsBase(wx) {
    const p      = Math.min(Math.sqrt(wx / 14000), 1);
    const p2     = Math.max(wx - 14000, 0) / 40000;
    const wMult  = 1 + 0.12 * Math.min(p2, 2);
    const wFMult = 1 + 0.14 * Math.min(p2, 2);
    const dm  = deepMorphAt(wx);   // deep-run shape morph, per-wx for placement accuracy
    const wA1 = lerp(H * 0.07,  H * 0.12,  p) * wMult * _waveJitterA * dm.a1;
    const wA2 = lerp(H * 0.035, H * 0.055, p) * wMult * _waveJitterA * dm.a2;
    const wF1 = lerp(0.0025,    0.0048,    p) * wFMult * _waveJitterF;
    const wF2 = lerp(0.0060,    0.0115,    p) * wFMult * _waveJitterF;
    const hg  = halfGapAt(wx);
    const raw = H / 2 + wA1 * Math.sin(wx * wF1 + _wavePhase1) + wA2 * Math.sin(wx * wF2 + 1.57 + _wavePhase2);
    const cy  = Math.max(hg + WALL_PAD, Math.min(H - hg - WALL_PAD, raw));
    return { top: cy - hg, bot: cy + hg };
}
