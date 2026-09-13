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
        this.MINE_START_WX = MINE_START_WX; this.CHICANE_START_WX = CHICANE_START_WX; this.chicaneProb = chicaneProb;
        this.SAFE_START_WX = SAFE_START_WX; this.SECTOR_SEC = SECTOR_SEC; this.refSpdTrend = refSpdTrend;
        this.sectorAt = sectorAt; this.sectorStartWx = sectorStartWx; this.HULL_END_WX = HULL_END_WX;
        for (const n of ['RED_START_WX','ORANGE_START_WX','GREEN_START_WX','BOMB_START_WX','BOULDER_START_WX','CANNON_START_WX','FALL_START_WX','POISON_START_WX','DRAIN_START_WX']) this[n] = eval(n);
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
        this.GAP_DECAY_FRAC = GAP_DECAY_FRAC; this.GAP_PER_COIN_FRAC = GAP_PER_COIN_FRAC;
        this.GAP_BONUS_MAX_FRAC = GAP_BONUS_MAX_FRAC; this.DEEP_DECAY_PEAK = DEEP_DECAY_PEAK;
        this.gapPerCoin = gapPerCoin; this.gapBonusMax = gapBonusMax; this.gapDecay = gapDecay;
        this.worldPxForSec = worldPxForSec; this.scrollSpdBase = scrollSpdBase;
        this.CHICANE_GOLD_GAP_SEC = CHICANE_GOLD_GAP_SEC;
        this.POWERUP_MIN_GAP_SEC = POWERUP_MIN_GAP_SEC; this.POWERUP_GAP_EARLY_MULT = POWERUP_GAP_EARLY_MULT;
        this.DEEP_APEX_WX = DEEP_APEX_WX;
        this.gapProgAt = gapProgAt; this.GAP_EASY_WX = GAP_EASY_WX; this.GAP_RAMP_WX = GAP_RAMP_WX;
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
    // Corridor-width pace (2026-09-13): stays at its easiest (gapProgAt == 0) until
    // score 50 (wx=3000), then narrows over GAP_RAMP_WX - 3x the old 14000 total
    // ramp - so the plateau now lands at wx=42000 (~score 700) instead of ~233.
    const GAP_PLATEAU_WX = w.GAP_EASY_WX + w.GAP_RAMP_WX;
    check(`[${iw}x${ih}] corridor stays at its widest through score 50 (wx<=3000)`, w.gapProgAt(0) === 0 && w.gapProgAt(w.GAP_EASY_WX) === 0 && w.gapProgAt(w.GAP_EASY_WX + 1) > 0);
    check(`[${iw}x${ih}] corridor narrows much slower than before (barely started by the old wx=14000 plateau)`, w.gapProgAt(14000) < 0.6);
    check(`[${iw}x${ih}] early-widen bonus is gone by wx=24000 (rejoins base curve)`, Math.abs(w.halfGapAt(24000) / w.deepChamberAt(24000) - w.lerp(H * 0.34, H * 0.163, w.gapProgAt(24000))) < 1e-9);
    check(`[${iw}x${ih}] halfGapAt(plateau+) == H*0.163 (max difficulty plateau)`, Math.abs(w.halfGapAt(GAP_PLATEAU_WX) - H * 0.163) < 1e-9 && w.halfGapAt(GAP_PLATEAU_WX + 6000) === w.halfGapAt(GAP_PLATEAU_WX));
    // Monotonic: corridor only ever narrows as wx grows, never widens back out.
    let prevHg = w.halfGapAt(0);
    let monotonic = true;
    for (let wx = 500; wx <= GAP_PLATEAU_WX; wx += 500) {
        const hg = w.halfGapAt(wx) / w.deepChamberAt(wx);   // chambers are a deliberate transient widening
        if (hg > prevHg + 1e-9) monotonic = false;
        prevHg = hg;
    }
    check(`[${iw}x${ih}] halfGapAt is monotonically non-increasing 0->plateau`, monotonic);

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

// ── Flight plan: sectors + densities as rates (constants.js SECTOR_SEC, world.js) ──
{
    const w = makeWorld(600, 600);
    const at = (fn, wx) => { w.scrollX = wx; w.refreshWave(); return w[fn](wx); };
    // Sectors: SECTOR_SEC reference seconds each, sector 1 starting exactly where the
    // walls turn lethal, boundaries strictly increasing, each ~7s at the reference speed.
    let secOk = w.sectorStartWx(1) === w.SAFE_START_WX;
    for (let k = 1; k < 40; k++) {
        const a = w.sectorStartWx(k), b = w.sectorStartWx(k + 1);
        if (!(b > a)) secOk = false;
        const mid = (a + b) / 2, sec = (b - a) / (w.refSpdTrend(mid) * 956 / 600);
        if (Math.abs(sec - w.SECTOR_SEC) > 0.25) secOk = false;
        if (w.sectorAt(a) !== k || w.sectorAt(b - 1) !== k) secOk = false;
    }
    check('sectors are SECTOR_SEC reference seconds long and start at the safe-zone exit', secOk);
    // One formula for the speed trend: scrollSpdBase must equal refSpdTrend wherever the
    // deep pulse is off, or the sector clock and the real scroll speed drift apart.
    w.setDeepVariety(false);
    let trendOk = true;
    for (let wx = 0; wx < 300000; wx += 1500) if (Math.abs(w.scrollSpdBase(wx) - w.refSpdTrend(wx)) > 1e-9) trendOk = false;
    w.setDeepVariety(true);
    check('scrollSpdBase trend and the sector clock share one formula (refSpdTrend)', trendOk);

    // Novelty order: every tool before the threat it answers, one new hazard per sector.
    const k = n => w.sectorAt(w[n]);
    check('flight plan order: shield S1, ammo+magnet S2, mine+bomb S3, boulder S4, chicane S5, cannon S6, falling S7, poison S8, drain S9',
        k('RED_START_WX') === 1 && k('ORANGE_START_WX') === 2 && k('GREEN_START_WX') === 2 &&
        k('MINE_START_WX') === 3 && k('BOMB_START_WX') === 3 && k('BOULDER_START_WX') === 4 &&
        k('CHICANE_START_WX') === 5 && k('CANNON_START_WX') === 6 && k('FALL_START_WX') === 7 &&
        k('POISON_START_WX') === 8 && k('DRAIN_START_WX') === 9 && w.HULL_END_WX === w.sectorStartWx(3));

    // Hazard rates per reference second: at the same phase of consecutive sectors they grow
    // by exactly the per-sector factor - never a doubling between neighbours (the 12.0
    // expert wall) - and the breather at a sector's start is below the previous peak.
    const rateAt = (fn, wx) => w.worldPxForSec(1, wx) / at(fn, wx);   // objects per reference second
    let growOk = true, sawOk = true;
    for (let s = 4; s < 14; s++) {
        const a = w.sectorStartWx(s), b = w.sectorStartWx(s + 1), c = w.sectorStartWx(s + 2);
        const midA = a + (b - a) * 0.6, midB = b + (c - b) * 0.6;
        for (const fn of ['stalSpacing', 'mineSpacing']) {
            const r = rateAt(fn, midB) / rateAt(fn, midA);
            if (r > 1.25 || r < 1.04) growOk = false;
        }
        const peakA = rateAt('stalSpacing', b - 1), breathB = rateAt('stalSpacing', b + (c - b) * 0.05);
        if (!(breathB < peakA)) sawOk = false;
    }
    check('stalactite and mine rates grow 4-25% per sector (no doubling between neighbours)', growOk);
    check('each sector opens with a breather below the previous sector\'s peak', sawOk);
    check('no mines before MINE_START_WX, and the first mines are sparse (>= 1500px apart)',
        at('mineSpacing', w.MINE_START_WX + 10) >= 1500);

    // Floors hold at any depth and any day archetype (rates grow without limit).
    let floorsHeld = true;
    for (let i = 0; i < 4; i++) {
        w.setDayArchetype(i);
        if (at('stalSpacing', 10_000_000) < 50 || at('coinSpacing', 10_000_000) < 175 || at('mineSpacing', 10_000_000) < 200) floorsHeld = false;
    }
    w.setDayArchetype(0);
    check('stal/coin/mine spacing never dip below their floors, across all day archetypes', floorsHeld);
    check('deep stalactites and mines end on their floors (50 / 200 px)',
        at('stalSpacing', 10_000_000) === 50 && at('mineSpacing', 10_000_000) === 200);
    // Coins: candidates per reference second stay within a sane band at every depth.
    let coinOk = true;
    for (let wx = 500; wx < 2_000_000; wx += 7919) {
        const r = rateAt('coinSpacing', wx);
        if (r > 1.5 || r < 0.55) coinOk = false;
    }
    check('coin candidates stay between 0.55 and 1.5 per reference second at every depth', coinOk);
    let chicOk = at('chicaneProb', w.CHICANE_START_WX) === 0;
    for (let wx = w.CHICANE_START_WX; wx < w.CHICANE_START_WX + 8000; wx += 250) {
        if (at('chicaneProb', wx + 250) < at('chicaneProb', wx)) chicOk = false;
    }
    check('chicaneProb fades in from 0 at CHICANE_START_WX instead of switching on at full odds', chicOk);

    // Cannons stay a set-piece: an order of magnitude above the recurring hazards.
    w.scrollX = 10_000_000; w.refreshWave();
    check('cannonSpacing plateaus at 1500px (no day-archetype multiplier)', Math.abs(w.cannonSpacing() - 1500) < 1e-9);
    check('cannonSpacing stays an order of magnitude above every other obstacle spacing',
        w.cannonSpacing() > w.stalSpacing() * 10 && w.cannonSpacing() > w.mineSpacing() * 5);
}

// ── Milestone step (world.js milestoneStep, tiers documented in CLAUDE.md) ──
{
    const w = makeWorld(600, 600);
    // 25-point band below 100 (restored in 12.0 -- see the milestoneStep doc comment
    // in src/world.js for why the earlier removal was calibrated against the wrong
    // audience), then the bands that were always there.
    check('milestoneStep < 100 is 25',    w.milestoneStep(1)    === 25 && w.milestoneStep(25) === 25 && w.milestoneStep(99) === 25);
    check('milestoneStep 100-299 is 50',  w.milestoneStep(100)  === 50 && w.milestoneStep(299) === 50);
    check('milestoneStep 300-999 is 100', w.milestoneStep(300)  === 100 && w.milestoneStep(999) === 100);
    check('milestoneStep 1000-2999 is 250', w.milestoneStep(1000) === 250 && w.milestoneStep(2999) === 250);
    check('milestoneStep 3000-9999 is 500', w.milestoneStep(3000) === 500 && w.milestoneStep(9999) === 500);
    check('milestoneStep >= 10000 is 1000, uncapped', w.milestoneStep(10000) === 1000 && w.milestoneStep(1_000_000) === 1000);
    // The ladder a real run actually walks (lifecycle.js seeds milestoneNext = 25 and
    // update.js adds milestoneStep each time one fires). Asserted as a whole sequence
    // because the per-band checks above can all pass while the seed is wrong.
    {
        const ladder = [];
        for (let n = 25; ladder.length < 12; n += w.milestoneStep(n)) ladder.push(n);
        check('milestone ladder starts 25/50/75 then rejoins the old 50-point band',
            ladder.join(',') === '25,50,75,100,150,200,250,300,400,500,600,700');
        // The point of the 12.0 change is that it is a FIRST-MINUTES fix only. Anything
        // a competent run reaches has to be exactly where it was before.
        check('milestone ladder is unchanged at and above score 100',
            ladder.filter(n => n >= 100).join(',') === '100,150,200,250,300,400,500,600,700');
    }
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
    check('deep shape morph is fully inert at/below DEEP_VARIETY_WX', preInert);

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
    check('deep chambers are inert at/below DEEP_VARIETY_WX', chInert);

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
    // Sampled at fixed world-x, not relative to D: fallSpacing is a function of
    // _prog2 alone, and D - 40000 would go negative regardless of exactly where
    // DEEP_VARIETY_WX sits (9000 as of 12.0, was 30000).
    const fsAt = (wx) => { w.scrollX = wx; w.refreshWave(); return w.fallSpacing(); };
    check('fallSpacing tightens from a rare set-piece to a floored deep cadence',
        fsAt(14000) > fsAt(54000) && fsAt(54000) > fsAt(254000) && fsAt(5_000_000) >= 1800);

    // Boulders (Phase 3): rare - spacing floors well above every recurring hazard.
    const bsAt = (wx) => { w.scrollX = wx; w.refreshWave(); return w.boulderSpacing(); };
    check('boulderSpacing stays a sparse set-piece cadence (>= 2400, above mine spacing)',
        bsAt(84000) >= 2400 && bsAt(5_000_000) >= 2400 &&
        bsAt(5_000_000) > w.mineSpacing() * 5);
}

// ── Supply pacing (2026-09-11 balance pass) ─────────────────────────────────
// The pass that re-gated coin supply rests on three claims that are pure math and
// therefore guardable here: the chicane-gold gate is a real per-SECOND cap at every
// depth (not a distance that keeps shrinking as scrollSpd climbs forever), that gate
// and the power-up floors are no-ops for the whole stretch real players reach, and
// the gate is W-independent so the cave stays pixel-identical across devices.
{
    const w = makeWorld(956, 600);

    // worldPxForSec must NOT carry a W term - the daily cave is shared in world-x.
    const wNarrow = makeWorld(600, 600);
    const wWide   = makeWorld(1400, 600);
    let wIndep = true;
    for (const wx of [3000, 14000, 30000, 60000, 120000, 400000]) {
        wNarrow.scrollX = wx; wNarrow.refreshWave();
        wWide.scrollX   = wx; wWide.refreshWave();
        if (Math.abs(wNarrow.worldPxForSec(2.2) - wWide.worldPxForSec(2.2)) > 1e-9) wIndep = false;
        // ...while scrollSpd itself is deliberately W-scaled, so this is a real distinction.
        if (wNarrow.scrollSpd() >= wWide.scrollSpd()) wIndep = false;
    }
    check('worldPxForSec is W-independent (shared cave) while scrollSpd stays W-scaled', wIndep);

    // The chicane gate converts to a bounded coins/sec at every depth, forever. A
    // fixed world-px gate cannot do this: scrollSpd never plateaus, so any constant
    // distance decays toward zero seconds. Measured at the reference width the gate
    // is quoted for.
    const rateAt = (wx) => {
        w.scrollX = wx; w.refreshWave();
        const gate = Math.max(w.worldPxForSec(w.CHICANE_GOLD_GAP_SEC), w.coinSpacing() * 0.85);
        return w.scrollSpd() / gate;                       // chicane gold coins per second
    };
    // Deep: bounded above (the cap this exists for) and bounded below (it must not
    // collapse either). A fixed world-px gate cannot satisfy the upper bound at all -
    // scrollSpd never plateaus, so any constant distance decays toward zero seconds.
    let deepOk = true, peakRate = 0, minRate = Infinity;
    for (let wx = 54000; wx < 3_000_000; wx += 2500) {
        const r = rateAt(wx);
        peakRate = Math.max(peakRate, r);
        minRate  = Math.min(minRate,  r);
        if (r > 0.75 || r < 0.25) deepOk = false;
    }
    // Holding gapBonus pinned at its cap needs gapDecay()/gapPerCoin() gold per second
    // (times the update.js _deepDecay ramp deep, which only makes the bar higher).
    // Since 12.0 both scale off the same _gapRef, so this ratio is a pure constant -
    // the supply economics are depth-independent by construction (see the assertion
    // on that invariant further down).
    const holdRate = w.GAP_DECAY_FRAC / w.GAP_PER_COIN_FRAC;
    check(`chicane gold stays a bounded per-second cadence at any depth (deep ${minRate.toFixed(2)}-${peakRate.toFixed(2)}/s)`, deepOk);
    check(`deep chicane gold no longer outruns the hold-at-cap rate by an order of magnitude (${(peakRate / holdRate).toFixed(1)}x, was ~10x)`,
        peakRate / holdRate < 3);

    // Both gates must be inert where real runs actually end. Highest daily best ever
    // recorded is 169 (D1 tunl_scores, 2026-09-11), so "early" here is score <= 233.
    // The chicane gate is flat since 2026-09-13 (no early multiplier) - it stays inert
    // early because there are no chicanes at all before CHICANE_START_WX (~score 300).
    let earlyNoop = w.CHICANE_START_WX > 14000;
    for (let wx = 2100; wx <= 14000; wx += 250) {
        w.scrollX = wx; w.refreshWave();
        if (w.chicaneProb(wx) !== 0) earlyNoop = false;
        // Power-up floors below the measured natural gaps at this depth (4.3s red,
        // ~6.7s blue/green) so they cannot thin the early coin line.
        for (const k of Object.keys(w.POWERUP_MIN_GAP_SEC)) {
            if (w.POWERUP_MIN_GAP_SEC[k] * w.POWERUP_GAP_EARLY_MULT > 4.3) earlyNoop = false;
        }
    }
    check('chicane gate and power-up floors are no-ops below score 233 (no chicanes there, floors under the natural gaps)', earlyNoop);

    // Orange deliberately has no floor: bullets auto-fire every 0.32s, so a 5-shot
    // pickup drains itself in 1.6s and there is no stock that can sit pinned.
    check('orange (ammo) is deliberately exempt from the power-up floors',
        w.POWERUP_MIN_GAP_SEC.orange === undefined && w.POWERUP_MIN_GAP_SEC.red !== undefined);

    // The apex-mine bias stayed on the old score-900 line while the rest of the deep
    // variety moved to 30000 - it is the one piece flagged as an unplaytested
    // fairness risk (CLAUDE.md), so it must not ride along.
    check('apex-mine bias did not move earlier with DEEP_VARIETY_WX',
        w.DEEP_APEX_WX === 54000 && w.DEEP_VARIETY_WX < w.DEEP_APEX_WX);
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

// ── Physics is frame-rate independent (src/update.js, 12.0) ─────────────────
// `py += vy * dt` AFTER the velocity update pretends the ship spent the whole frame at
// its end-of-frame speed, overshooting by 0.5*a*dt^2 every frame - an error that scales
// with frame length, so the ship flew a different trajectory on every refresh rate.
// Everyone flies the same daily cave into the same leaderboard, so that mattered more
// than anything _FEEL_SCALE and the W cap exist to equalise (measured: a good pilot's
// median was 118 at 144Hz vs 67 at 60Hz vs 41 at 30Hz, decision rate pinned).
// The trapezoid (average of old and new velocity) is exact for constant acceleration.
{
    const w = makeWorld(956, 440);
    const A = w.THRUST - w.GRAVITY, MAXV = w.MAX_VY, T = 0.5;
    // Integrate a pure held-thrust climb the same way update.js does, at a given fps.
    // Compared against the exact solution for the time ACTUALLY simulated (steps*dt),
    // not for T: a frame rate that doesn't divide T evenly (45Hz) lands a fraction of a
    // frame past it, and measuring that as integrator error would be a bug in the test.
    const flyFor = (fps) => {
        const dt = 1 / fps;
        const steps = Math.round(T / dt);
        let py = 0, vy = 0;
        for (let i = 0; i < steps; i++) {
            const prev = vy;
            vy = Math.max(-MAXV, Math.min(MAXV, vy + A * dt));
            py += (prev + vy) * 0.5 * dt;
        }
        return { py, t: steps * dt };
    };
    let worst = 0;
    for (const fps of [144, 120, 90, 72, 60, 45, 30, 24]) {
        const r = flyFor(fps);
        const exact = 0.5 * A * r.t * r.t;
        worst = Math.max(worst, Math.abs(r.py - exact) / exact);
    }
    check(`held-thrust trajectory is identical at every frame rate (worst deviation ${(worst * 100).toFixed(4)}%)`,
        worst < 1e-9);

    // And the old integrator genuinely wasn't - guards against a silent revert to
    // `py += vy * dt`, which would pass nothing else in this file.
    const flyForOld = (fps) => {
        const dt = 1 / fps, steps = Math.round(T / dt);
        let py = 0, vy = 0;
        for (let i = 0; i < steps; i++) { vy = Math.max(-MAXV, Math.min(MAXV, vy + A * dt)); py += vy * dt; }
        return py;   // 144 and 30 both divide T evenly, so this comparison is bias-free
    };
    check(`the pre-12.0 integrator did diverge by frame rate (144Hz ${flyForOld(144).toFixed(1)}px vs 30Hz ${flyForOld(30).toFixed(1)}px)`,
        Math.abs(flyForOld(144) - flyForOld(30)) > 5);
}

// ── Gap bonus scales WITH the corridor (constants.js GAP_*_FRAC, 12.0) ──────
// The bonus used to be absolute px against a corridor that shrinks 0.34H -> 0.163H,
// which flattened the difficulty curve by construction (measured: designed 11.0 ->
// 4.2 ship diameters, actually flown 10.6 -> 8.6). Keying it to the corridor makes
// a run's effective width the base curve TIMES a constant instead of PLUS one.
// Two properties carry that claim, and both are cheap to assert:
{
    const w = makeWorld(956, 440);
    const H = w.H;
    // (a) wx=0 is an exact no-op against the old absolute values. This is what makes
    //     the change legal under "never make score <233 harder" - the early game,
    //     where real runs actually end, is anchored rather than re-tuned.
    w.scrollX = 0; w.refreshWave();
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    check('gap bonus at wx=0 exactly reproduces the pre-12.0 absolute values',
        near(w.gapPerCoin(),  H * 0.075) &&
        near(w.gapBonusMax(), H * 0.19)  &&
        near(w.gapDecay(),    H * 0.015));

    // (b) every RATIO between the three is depth-independent, so the coin economics
    //     CHICANE_GOLD_GAP_SEC / POWERUP_MIN_GAP_SEC were tuned against are untouched:
    //     still 2.53 coins to fill the bar, still 0.2 coins/sec to hold it at the cap.
    let ratiosFlat = true, fillSeen = null, holdSeen = null;
    for (let wx = 0; wx <= 300000; wx += 1500) {
        w.scrollX = wx; w.refreshWave();
        const fill = w.gapBonusMax() / w.gapPerCoin();
        const hold = w.gapDecay()    / w.gapPerCoin();
        if (fillSeen === null) { fillSeen = fill; holdSeen = hold; }
        if (Math.abs(fill - fillSeen) > 1e-9 || Math.abs(hold - holdSeen) > 1e-9) ratiosFlat = false;
    }
    check(`gap-bonus ratios are depth-independent (${fillSeen.toFixed(2)} coins to fill, ${holdSeen.toFixed(2)} coins/sec to hold)`,
        ratiosFlat && Math.abs(fillSeen - 2.5333333) < 1e-4 && Math.abs(holdSeen - 0.2) < 1e-9);

    // (c) the cap genuinely shrinks with the corridor - that IS the fix, stated
    //     against the OLD absolute value rather than against itself. Pre-12.0 the cap
    //     was a flat H*0.19 at every depth, so the plateau corridor (half-gap H*0.163)
    //     got MORE than its own width handed back; now it gets the same proportion the
    //     early game does. Deliberately not compared via halfGapAt(), which folds in
    //     deepChamberAt() - a chamber is a transient widening that exists either way
    //     and would only dilute the comparison.
    const OLD_CAP = H * 0.19;
    w.scrollX = 0;     w.refreshWave(); const capEarly = w.gapBonusMax();
    w.scrollX = 90000; w.refreshWave(); const capDeep  = w.gapBonusMax();
    check(`maxed bonus is unchanged early and materially smaller deep (${(capEarly/OLD_CAP).toFixed(2)}x -> ${(capDeep/OLD_CAP).toFixed(2)}x of the old flat cap)`,
        Math.abs(capEarly - OLD_CAP) < 1e-9 && capDeep / OLD_CAP > 0.30 && capDeep / OLD_CAP < 0.45);

    // (d) the deep-decay ramp is still fully inert before the plateau - it is a
    //     second-order tightener now, not the load-bearing fix, but it must not leak
    //     into the band real runs actually end in.
    let rampInert = true;
    for (let wx = 0; wx <= 14000; wx += 500) {
        w.scrollX = wx; w.refreshWave();
        if (Math.max(wx - 14000, 0) / 40000 !== 0) rampInert = false;
    }
    check('deep-decay ramp stays inert at/below the difficulty plateau', rampInert);
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
