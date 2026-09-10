#!/usr/bin/env node
// Zero-dependency check on the pure math CLAUDE.md calls out as load-bearing: the
// difficulty curves, corridor bounds, and scoring/penalty formulas in
// src/constants.js + src/world.js. These are plain functions of scrollX/wx and a
// screen size, so they run fine in a stubbed sandbox without a real canvas -- this
// is NOT a game-feel test (see CLAUDE.md's own "canvas rendering ... needs a human
// eyeballing it" note), just a guard against silently breaking a documented
// invariant (a ratio, a floor, a cap) while touching this math.
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const webSrc        = fs.readFileSync(path.join(__dirname, 'src', 'web.js'), 'utf8');
const constantsSrc = fs.readFileSync(path.join(__dirname, 'src', 'constants.js'), 'utf8');
const worldSrc      = fs.readFileSync(path.join(__dirname, 'src', 'world.js'), 'utf8');

// Builds a fresh sandbox for one screen size. constants.js/world.js compute W/H
// (and everything derived from them) once at load time, so a new size needs a new
// vm context, not just new arguments.
function makeWorld(innerWidth, innerHeight) {
    const fakeCtx = {};
    const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0 };
    const sandbox = {
        // Stub the iOS message-handler bridge so web.js's isWeb() returns false:
        // this suite validates the *app's* feel constants (GRAVITY/THRUST, the W/H
        // caps, scrollSpd), not the web build's isWeb()-gated overrides.
        window:   { innerWidth, innerHeight, webkit: { messageHandlers: { haptic: {} } } },
        document: { getElementById: () => fakeCanvas },
        localStorage: { getItem: () => null, setItem: () => {} },
        console, Math, Date, JSON, atob, btoa,
        scrollX: 0, gapBonus: 0,   // normally state.js globals; only boundsAt/refreshWave need them
    };
    vm.createContext(sandbox);
    // web.js is script #1 in tunl.html; world.js now leans on its _tunlActiveDate()
    // for the daily world name / level number (?d= deep link, see project docs).
    vm.runInContext(webSrc, sandbox, { filename: 'src/web.js' });
    vm.runInContext(constantsSrc, sandbox, { filename: 'src/constants.js' });
    vm.runInContext(worldSrc, sandbox, { filename: 'src/world.js' });
    // Top-level const/let don't land on the sandbox object automatically (same
    // gotcha test-i18n.js works around) -- pull out everything the checks below need.
    vm.runInContext(`
        this.W = W; this.H = H; this.GRAVITY = GRAVITY; this.THRUST = THRUST;
        this.MAX_VY = MAX_VY; this.FEEL_SCALE = _FEEL_SCALE; this.H_REF = _H_REF;
        this.lerp = lerp; this.POISON_LOSS_PCT_MIN = POISON_LOSS_PCT_MIN; this.POISON_LOSS_PCT_MAX = POISON_LOSS_PCT_MAX;
        this.halfGapAt = halfGapAt; this.boundsBase = boundsBase; this.refreshWave = refreshWave;
        this.scrollSpd = scrollSpd; this.stalSpacing = stalSpacing; this.coinSpacing = coinSpacing;
        this.mineSpacing = mineSpacing; this.cannonSpacing = cannonSpacing; this.milestoneStep = milestoneStep;
        this.setDayArchetype = function(i) { _dayArchetype = i; };
        this.deepMorphAt = deepMorphAt; this.deepChamberAt = deepChamberAt;
        this.fallSpacing = fallSpacing; this.boulderSpacing = boulderSpacing;
        this.DEEP_VARIETY_WX = DEEP_VARIETY_WX; this.DEEP_PULSE_AMP = DEEP_PULSE_AMP; this.DEEP_PULSE_WAVELEN = DEEP_PULSE_WAVELEN;
        this.DEEP_CHAMBER_PEAK = DEEP_CHAMBER_PEAK;
        this.setDeepDay = function(d) { _deepDay = d; };
        this.setDeepVariety = function(on) { _deepVarietyOn = on; };
        this.waveParams = function() { return { wA1: _wA1, wA2: _wA2, wF1: _wF1, wF2: _wF2 }; };
        this.ghostEncode = ghostEncode; this.ghostDecode = ghostDecode;
        this.DAILY_SHARD_CAP = DAILY_SHARD_CAP; this.GAP_EASE_RATE = GAP_EASE_RATE;
    `, sandbox, { filename: 'export' });
    return sandbox;
}

let failed = false;
function check(name, cond) {
    if (cond) {
        console.log(`✓ ${name}`);
    } else {
        failed = true;
        console.error(`✗ ${name}`);
    }
}

// ── Physics: base constants, screen-independent feel, and net-force direction ──
// CLAUDE.md "Screen-independent feel (do not revert)": GRAVITY/THRUST/MAX_VY are quoted
// at _H_REF (440) and every device multiplies by _FEEL_SCALE = H/_H_REF. So the checks
// divide the scaled value back down to the base before comparing.
{
    const w  = makeWorld(600, 600);              // app path; H caps at 600
    const w2 = makeWorld(956, 440);              // reference height -> _FEEL_SCALE == 1
    check('_H_REF is 440 (iPhone 17 Pro Max landscape height)', w.H_REF === 440);
    check('_FEEL_SCALE = H/_H_REF', Math.abs(w.FEEL_SCALE - 600 / 440) < 1e-9 && w2.FEEL_SCALE === 1);
    check('base GRAVITY/THRUST/MAX_VY are 1300/3100/1080 at _H_REF',
        w2.GRAVITY === 1300 && w2.THRUST === 3100 && w2.MAX_VY === 1080);
    check('all three feel constants scale by the SAME _FEEL_SCALE',
        Math.abs(w.GRAVITY / w.FEEL_SCALE - 1300) < 1e-6 &&
        Math.abs(w.THRUST  / w.FEEL_SCALE - 3100) < 1e-6 &&
        Math.abs(w.MAX_VY  / w.FEEL_SCALE - 1080) < 1e-6);
    const netUp   = w.THRUST - w.GRAVITY;
    const netDown = w.GRAVITY;
    check('net upward force stays stronger than net downward (climbing more responsive)',
        netUp > netDown && Math.abs(netUp / w.FEEL_SCALE - 1800) < 1e-6 && Math.abs(netDown / w.FEEL_SCALE - 1300) < 1e-6);
}

// ── Cross-device fairness: W is capped at 956 on every platform ──────────────
// CLAUDE.md "Cross-device fairness": scrollSpd() scales by W/600, so an uncapped wide
// screen would scroll the shared daily cave past faster at a given score. W must clamp.
{
    check('W caps at 956 on a wide screen', makeWorld(1512, 700).W === 956 && makeWorld(2000, 900).W === 956);
    check('W is untouched below the cap', makeWorld(812, 375).W === 812);
    const narrow = makeWorld(667, 375), wide = makeWorld(1400, 375);
    narrow.scrollX = wide.scrollX = 8000; narrow.refreshWave(); wide.refreshWave();
    check('two screens at the same score never scroll the cave more than the 956/667 width ratio apart',
        wide.scrollSpd() / narrow.scrollSpd() <= 956 / 667 + 1e-9);
}

// ── Corridor bounds (src/world.js boundsBase/halfGapAt) ──────────────────────
for (const [iw, ih] of [[600, 600], [844, 390], [1512, 823]]) {
    const w = makeWorld(iw, ih);
    const H = w.H;

    check(`[${iw}x${ih}] halfGapAt(0) == H*0.34 + early-widen bonus (H*0.09)`, Math.abs(w.halfGapAt(0) - H * 0.43) < 1e-9);
    check(`[${iw}x${ih}] early-widen bonus is gone by wx=12000 (rejoins base curve)`, Math.abs(w.halfGapAt(12000) - w.lerp(H * 0.34, H * 0.163, Math.min(Math.sqrt(12000 / 14000), 1))) < 1e-9);
    check(`[${iw}x${ih}] halfGapAt(14000+) == H*0.163 (max difficulty plateau)`, Math.abs(w.halfGapAt(14000) - H * 0.163) < 1e-9 && w.halfGapAt(20000) === w.halfGapAt(14000));
    // Monotonic: corridor only ever narrows as wx grows, never widens back out.
    let prevHg = w.halfGapAt(0);
    let monotonic = true;
    for (let wx = 500; wx <= 14000; wx += 500) {
        const hg = w.halfGapAt(wx);
        if (hg > prevHg + 1e-9) monotonic = false;
        prevHg = hg;
    }
    check(`[${iw}x${ih}] halfGapAt is monotonically non-increasing 0->14000`, monotonic);

    // boundsBase: top must stay above bot, and the gap must equal 2x halfGapAt(wx)
    // regardless of screen width/height, at every stage of the difficulty ramp.
    let boundsOk = true;
    for (const wx of [0, 1000, 7000, 14000, 30000, 60000]) {
        const { top, bot } = w.boundsBase(wx);
        const gap = bot - top;
        if (top >= bot || Math.abs(gap - 2 * w.halfGapAt(wx)) > 1e-6) boundsOk = false;
    }
    check(`[${iw}x${ih}] boundsBase() gap matches halfGapAt() at every stage`, boundsOk);
}

// ── scrollSpd (CLAUDE.md: "scrollSpd() never plateaus ... don't re-add a cap") ──
{
    const w = makeWorld(600, 600);
    const speedAt = (wx) => { w.scrollX = wx; w.refreshWave(); return w.scrollSpd(); };

    const sEarly = speedAt(0);
    const sMid   = speedAt(14000);
    const sRamp  = speedAt(54000);   // _prog2 hits 1 here
    const sFar   = speedAt(54000 + 1_000_000);
    const sFarther = speedAt(54000 + 4_000_000);

    check('scrollSpd rises through the early/mid ramp (230->400->560 @ W=600)', sEarly < sMid && sMid < sRamp);
    // Every other difficulty knob caps once _prog2 saturates; scrollSpd is the one
    // exception (uncapped sqrt-eased tail) -- assert it keeps climbing far past that point.
    check('scrollSpd keeps climbing indefinitely past the _prog2 ramp (no plateau)', sRamp < sFar && sFar < sFarther);
}

// ── Spacing floors (obstacle/coin/mine/cannon density never goes below its floor) ──
{
    const w = makeWorld(600, 600);
    w.scrollX = 10_000_000; // deep into every ramp, Classic (default) day archetype
    w.refreshWave();
    // CLAUDE.md's documented curve endpoints (260->145->70, 600->320->230, etc.) are
    // the plateau this actually reaches on a Classic day -- the "(floor N)" in that
    // same doc is a lower hard safety net (Math.max(..., N)) that only Coin Rush's
    // reduced multiplier can dip into, exercised separately below.
    check('stalSpacing plateaus at 70px (Classic day)',  Math.abs(w.stalSpacing() - 70)  < 1e-9);
    check('coinSpacing plateaus at 230px (Classic day)', Math.abs(w.coinSpacing() - 230) < 1e-9);
    check('mineSpacing plateaus at 200px (Classic day)', Math.abs(w.mineSpacing() - 200) < 1e-9);
    check('cannonSpacing plateaus at 1500px (no day-archetype multiplier)', Math.abs(w.cannonSpacing() - 1500) < 1e-9);

    // Hard safety floors: whatever a day archetype's multiplier is, spacing must
    // never actually go below its documented floor.
    let floorsHeld = true;
    for (let i = 0; i < 4; i++) {
        w.setDayArchetype(i);
        if (w.stalSpacing() < 50 || w.coinSpacing() < 175 || w.mineSpacing() < 200) floorsHeld = false;
    }
    w.setDayArchetype(0);
    check('stal/coin/mineSpacing never dip below their documented floors, across all day archetypes', floorsHeld);

    // CLAUDE.md: cannons should read as "an occasional set-piece ambush, not a
    // recurring hazard type" -- guard the plateau staying an order of magnitude
    // above every other obstacle's, not just numerically above it.
    check('cannonSpacing stays an order of magnitude above every other obstacle spacing',
        w.cannonSpacing() > w.stalSpacing() * 10 &&
        w.cannonSpacing() > w.coinSpacing() * 5 &&
        w.cannonSpacing() > w.mineSpacing() * 5);
}

// ── Milestone step (world.js milestoneStep, tiers documented in CLAUDE.md) ──
{
    const w = makeWorld(600, 600);
    // One flat 50-point band from the start (the old 25/50/75 sub-100 band was
    // dropped -- see the milestoneStep doc comment in src/world.js).
    check('milestoneStep < 300 is 50',    w.milestoneStep(1)    === 50 && w.milestoneStep(24) === 50 && w.milestoneStep(299) === 50);
    check('milestoneStep 300-999 is 100', w.milestoneStep(300)  === 100 && w.milestoneStep(999) === 100);
    check('milestoneStep 1000-2999 is 250', w.milestoneStep(1000) === 250 && w.milestoneStep(2999) === 250);
    check('milestoneStep 3000-9999 is 500', w.milestoneStep(3000) === 500 && w.milestoneStep(9999) === 500);
    check('milestoneStep >= 10000 is 1000, uncapped', w.milestoneStep(10000) === 1000 && w.milestoneStep(1_000_000) === 1000);
}

// ── Score formula (src/update.js: score = floor(scrollX/60) + bonusScore) ──
{
    const scoreOf = (scrollXVal, bonusScore) => Math.floor(scrollXVal / 60) + bonusScore;
    check('score formula: distance-only at bonusScore=0', scoreOf(6000, 0) === 100);
    check('score formula: coin/near-miss bonus adds on top of distance', scoreOf(6000, 42) === 142);
}

// ── Poison loss (src/systems.js checkCoinCollection 'poison' branch, mirrored
// here -- keep this formula in sync with that inline block if it ever changes) ──
{
    const w = makeWorld(600, 600);
    const lossAt = (runCoins, prog) => {
        const lossPct = w.lerp(w.POISON_LOSS_PCT_MIN, w.POISON_LOSS_PCT_MAX, prog);
        return runCoins > 0 ? Math.min(runCoins, Math.max(1, Math.ceil(runCoins * lossPct))) : 0;
    };

    check('poison loss is 0 with an empty pool (never a negative or no-op-crash)', lossAt(0, 1) === 0);
    check('poison loss always removes at least 1 coin from a nonempty pool (no 0-coin no-op)', lossAt(1, 0) === 1 && lossAt(3, 0) === 1);
    check('poison loss never exceeds the current pool', lossAt(2, 1) <= 2);
    check('poison loss percentage scales with difficulty (_prog)', lossAt(100, 0) === 12 && lossAt(100, 1) === 15);

    // Compounding survivor fraction: this is the whole documented point of the
    // %-based model (CLAUDE.md: "a long run that keeps getting careless with
    // poison can lose most of its pool") -- simulate repeated hits at max
    // difficulty and check the pool shrinks roughly like 0.85^N, not linearly.
    let pool = 1000;
    for (let i = 0; i < 8; i++) pool -= lossAt(pool, 1);
    const expected = 1000 * Math.pow(0.85, 8);
    check('8 poison hits at max difficulty leave roughly the 0.85^N survivor fraction (compounding, not flat)',
        Math.abs(pool - expected) / expected < 0.05);
}

// ── Deep-run variety (world.js deepMorphAt + the scrollSpd speed pulse) ──────
// CLAUDE.md "Deep-run variety": past the score-900 plateau the corridor SHAPE
// and scroll PACE vary by a seeded per-day sequence, but neither may breach the
// navigability wall the geometry caps exist to hold. Guards: the amplitude morph
// is fully inert before the plateau, continuous across band boundaries, and
// never raises corridor velocity (wA1*wF1 + wA2*wF2) more than ~5% over the
// frozen plateau; the speed pulse stays inside its stated +/-8% band, never
// stalls, and leaves the underlying trend still climbing forever.
{
    const w = makeWorld(600, 600);
    const D = w.DEEP_VARIETY_WX;

    // Inert at/below the plateau: mid-game corridor math is untouched.
    let preInert = true;
    for (let day = 0; day < 12; day++) {
        w.setDeepDay(day);
        for (let wx = 0; wx <= D; wx += 1500) {
            const m = w.deepMorphAt(wx);
            if (m.a1 !== 1 || m.a2 !== 1) preInert = false;
        }
    }
    w.setDeepDay(0);
    check('deep shape morph is fully inert at/below the score-900 plateau', preInert);

    // Corridor velocity (wA1*wF1 + wA2*wF2) with the morph vs the SAME wx with it
    // off - isolates the morph from the pre-existing _prog2 wave boost, which also
    // lifts this value and is not what this guards.
    const energyOn  = (wx) => { w.setDeepVariety(true);  w.scrollX = wx; w.refreshWave(); const p = w.waveParams(); return p.wA1 * p.wF1 + p.wA2 * p.wF2; };
    const energyOff = (wx) => { w.setDeepVariety(false); w.scrollX = wx; w.refreshWave(); const p = w.waveParams(); return p.wA1 * p.wF1 + p.wA2 * p.wF2; };
    let energyOk = true, peak = 0;
    for (let day = 0; day < 40; day++) {
        w.setDeepDay(day);
        for (let wx = D + 150; wx < D + 300000; wx += 550) {
            const r = energyOn(wx) / energyOff(wx);
            if (r > peak) peak = r;
            if (r > 1.04) energyOk = false;
        }
    }
    w.setDeepDay(0); w.setDeepVariety(true);
    check(`deep shape morph never raises corridor velocity >4% over the same wx unmorphed (peak ${peak.toFixed(3)}x)`, energyOk);

    // Continuity: no seam in the amplitude split across character boundaries.
    let contOk = true, worst = 0;
    for (let day = 0; day < 15; day++) {
        w.setDeepDay(day);
        let prev = w.deepMorphAt(D + 5);
        for (let wx = D + 30; wx < D + 80000; wx += 25) {
            const m = w.deepMorphAt(wx);
            worst = Math.max(worst, Math.abs(m.a1 - prev.a1), Math.abs(m.a2 - prev.a2));
            prev = m;
        }
    }
    w.setDeepDay(0);
    check(`deep shape morph is continuous across character boundaries (max step ${worst.toFixed(4)})`, worst < 0.05);

    // Speed pulse: trend isolated at whole-wavelength nodes (sin term constant).
    const spdAt = (wx) => { w.scrollX = wx; w.refreshWave(); return w.scrollSpd(); };
    const n0 = spdAt(D + 100  * w.DEEP_PULSE_WAVELEN);
    const n1 = spdAt(D + 500  * w.DEEP_PULSE_WAVELEN);
    const n2 = spdAt(D + 2000 * w.DEEP_PULSE_WAVELEN);
    check('speed trend still climbs indefinitely past the plateau with the pulse in', n0 < n1 && n1 < n2);

    // Surge-only pulse: across one deep wavelength every pulsed sample must sit AT
    // OR ABOVE the pure trend (the deep run never gets slower), and the peak excess
    // is ~DEEP_PULSE_AMP of the trend.
    const w0 = D + 400 * w.DEEP_PULSE_WAVELEN;
    const trendAt = (wx) => { w.setDeepVariety(false); const s = spdAt(wx); w.setDeepVariety(true); return s; };
    let minRatio = Infinity, maxRatio = 0, N = 240;
    for (let i = 0; i < N; i++) {
        const wx = w0 + (i / N) * w.DEEP_PULSE_WAVELEN;
        const r = spdAt(wx) / trendAt(wx);
        minRatio = Math.min(minRatio, r); maxRatio = Math.max(maxRatio, r);
    }
    check(`deep speed pulse never dips below the trend (min ratio ${minRatio.toFixed(4)})`,
        minRatio >= 1 - 1e-6);
    check(`deep speed pulse peak surge is ~+${w.DEEP_PULSE_AMP} of the trend (peak ratio ${maxRatio.toFixed(4)})`,
        maxRatio > 1 + w.DEEP_PULSE_AMP * 0.8 && maxRatio < 1 + w.DEEP_PULSE_AMP * 1.05);
    w.setDeepDay(0);

    // ── Deep chambers (world.js deepChamberAt) ──────────────────────────────
    // Inert below the plateau; bounded to [1, DEEP_CHAMBER_PEAK]; continuous
    // (never a step at a period seam); and it does return to 1 between rooms so
    // the corridor isn't just permanently wider deep.
    let chInert = true;
    for (let day = 0; day < 15; day++) {
        w.setDeepDay(day);
        for (let wx = 0; wx <= D; wx += 1500) if (w.deepChamberAt(wx) !== 1) chInert = false;
    }
    check('deep chambers are inert at/below the score-900 plateau', chInert);

    let chOk = true, chPk = 1, everReset = true;
    for (let day = 0; day < 30; day++) {
        w.setDeepDay(day);
        let prev = w.deepChamberAt(D + 3), sawOne = false, sawGap = false;
        for (let wx = D + 25; wx < D + 500000; wx += 25) {
            const c = w.deepChamberAt(wx);
            if (c < 1 - 1e-9 || c > w.DEEP_CHAMBER_PEAK + 1e-9) chOk = false;
            if (Math.abs(c - prev) > 0.06) chOk = false;   // continuity
            if (c > 1.5) sawOne = true;
            if (c === 1)  sawGap = true;
            chPk = Math.max(chPk, c);
            prev = c;
        }
        if (!(sawOne && sawGap)) everReset = false;
    }
    w.setDeepDay(0);
    check(`deep chambers stay in [1, ${w.DEEP_CHAMBER_PEAK}], continuous, and reset between rooms (peak ${chPk.toFixed(2)})`,
        chOk && chPk > 1.6 && everReset);

    // Falling-stalactite cadence: absent early, then a real deep presence, floored.
    const fsAt = (wx) => { w.scrollX = wx; w.refreshWave(); return w.fallSpacing(); };
    check('fallSpacing tightens from a rare set-piece to a floored deep cadence',
        fsAt(D - 40000) > fsAt(D) && fsAt(D) > fsAt(D + 200000) && fsAt(D + 5_000_000) >= 1800);

    // Boulders (Phase 3): rare - spacing floors well above every recurring hazard.
    const bsAt = (wx) => { w.scrollX = wx; w.refreshWave(); return w.boulderSpacing(); };
    check('boulderSpacing stays a sparse set-piece cadence (>= 2400, above mine/coin spacing)',
        bsAt(84000) >= 2400 && bsAt(5_000_000) >= 2400 &&
        bsAt(5_000_000) > w.mineSpacing() * 5 && bsAt(5_000_000) > w.coinSpacing() * 5);
}

// ── Ghost round-trip (constants.js ghostEncode/ghostDecode) ─────────────────
// CLAUDE.md "Ghost run": one byte per GHOST_STEP world-px, quantised over [0,H],
// so a ghost recorded on one screen replays correctly on any other size. The
// only invariant that actually matters is that encode/decode is a lossless
// round-trip for any byte sequence a track can legitimately contain.
{
    const w = makeWorld(600, 600);
    const roundTrip = (bytes) => Array.from(w.ghostDecode(w.ghostEncode(Uint8Array.from(bytes))));

    check('ghost round-trip: empty track', JSON.stringify(roundTrip([])) === '[]');
    check('ghost round-trip: single byte, both quantisation extremes',
        JSON.stringify(roundTrip([0])) === '[0]' && JSON.stringify(roundTrip([255])) === '[255]');

    const short = [0, 1, 127, 128, 254, 255, 42];
    check('ghost round-trip: short mixed track', JSON.stringify(roundTrip(short)) === JSON.stringify(short));

    // ghostEncode chunks by 1024 bytes (String.fromCharCode.apply's argument
    // limit) -- exercise a track that crosses several chunk boundaries, at
    // exact multiples and just off them.
    let chunkOk = true;
    for (const len of [1023, 1024, 1025, 2048, 2049, 5000]) {
        const track = Array.from({ length: len }, (_, i) => (i * 37) % 256);
        if (JSON.stringify(roundTrip(track)) !== JSON.stringify(track)) chunkOk = false;
    }
    check('ghost round-trip: chunked encoding survives at/around the 1024-byte boundary', chunkOk);
}

// ── Shard banking cap (src/update.js die(), mirrored here -- keep this formula
// in sync with that inline block if it ever changes) ────────────────────────
// CLAUDE.md "Ship unlock economy": DAILY_SHARD_CAP is the real ceiling that
// makes unlocks track days played, not a single grind session.
{
    const w = makeWorld(600, 600);
    const bankedAt = (runCoins, dailyShardsEarned) => Math.max(0, Math.min(runCoins, w.DAILY_SHARD_CAP - dailyShardsEarned));

    check('shard banking: a fresh day banks the full run pool up to the cap',
        bankedAt(50, 0) === 50 && bankedAt(1000, 0) === w.DAILY_SHARD_CAP);
    check('shard banking: an already-capped day banks nothing more (no negative-clamp underflow)',
        bankedAt(50, w.DAILY_SHARD_CAP) === 0 && bankedAt(50, w.DAILY_SHARD_CAP + 40) === 0);
    check('shard banking: a partially-earned day banks only the remaining headroom',
        bankedAt(1000, w.DAILY_SHARD_CAP - 30) === 30);
    check('shard banking: never exceeds the run\'s own coin pool even with headroom to spare',
        bankedAt(10, 0) === 10);
}

// ── Gap-bonus easing (src/update.js gapBonusVisual, GAP_EASE_RATE) ──────────
// CLAUDE.md "Coin system": gapBonusVisual chases the instantly-jumping gapBonus
// target at a constant px/s rate rather than snapping, so collision/rendering
// see the wall widen smoothly. Mirrored formula, same sync-if-it-changes rule.
{
    const w = makeWorld(600, 600);
    const ease = (current, target, dt) => current + Math.max(-w.GAP_EASE_RATE * dt, Math.min(w.GAP_EASE_RATE * dt, target - current));

    check('gap easing: steps toward the target, not past it, for a small dt',
        ease(0, 100, 0.1) > 0 && ease(0, 100, 0.1) < 100);
    check('gap easing: clamps to the rate cap and never overshoots a distant target in one frame',
        ease(0, 100000, 1) === w.GAP_EASE_RATE);
    check('gap easing: converges to the target after enough frames (repeated small dt steps)', (() => {
        let v = 0;
        for (let i = 0; i < 1000; i++) v = ease(v, 100, 1 / 60);
        return Math.abs(v - 100) < 1e-6;
    })());
    check('gap easing: works symmetrically chasing downward (decay direction)', (() => {
        let v = 200;
        for (let i = 0; i < 1000; i++) v = ease(v, 0, 1 / 60);
        return Math.abs(v - 0) < 1e-6;
    })());
}

if (failed) {
    console.error('\nmath check FAILED');
    process.exit(1);
} else {
    console.log('\nAll difficulty/scoring invariants hold.');
}
