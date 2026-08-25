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

const constantsSrc = fs.readFileSync(path.join(__dirname, 'src', 'constants.js'), 'utf8');
const worldSrc      = fs.readFileSync(path.join(__dirname, 'src', 'world.js'), 'utf8');

// Builds a fresh sandbox for one screen size. constants.js/world.js compute W/H
// (and everything derived from them) once at load time, so a new size needs a new
// vm context, not just new arguments.
function makeWorld(innerWidth, innerHeight) {
    const fakeCtx = {};
    const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0 };
    const sandbox = {
        window:   { innerWidth, innerHeight },
        document: { getElementById: () => fakeCanvas },
        localStorage: { getItem: () => null, setItem: () => {} },
        console, Math, Date, JSON, atob, btoa,
        scrollX: 0, gapBonus: 0,   // normally state.js globals; only boundsAt/refreshWave need them
    };
    vm.createContext(sandbox);
    vm.runInContext(constantsSrc, sandbox, { filename: 'src/constants.js' });
    vm.runInContext(worldSrc, sandbox, { filename: 'src/world.js' });
    // Top-level const/let don't land on the sandbox object automatically (same
    // gotcha test-i18n.js works around) -- pull out everything the checks below need.
    vm.runInContext(`
        this.W = W; this.H = H; this.GRAVITY = GRAVITY; this.THRUST = THRUST;
        this.lerp = lerp; this.POISON_LOSS_PCT_MIN = POISON_LOSS_PCT_MIN; this.POISON_LOSS_PCT_MAX = POISON_LOSS_PCT_MAX;
        this.halfGapAt = halfGapAt; this.boundsBase = boundsBase; this.refreshWave = refreshWave;
        this.scrollSpd = scrollSpd; this.stalSpacing = stalSpacing; this.coinSpacing = coinSpacing;
        this.mineSpacing = mineSpacing; this.cannonSpacing = cannonSpacing; this.milestoneStep = milestoneStep;
        this.setDayArchetype = function(i) { _dayArchetype = i; };
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

// ── Physics ratio (CLAUDE.md: "Do NOT change this ratio, it's the core feel") ──
{
    const w = makeWorld(600, 600);
    const netUp   = w.THRUST - w.GRAVITY;
    const netDown = w.GRAVITY;
    check('GRAVITY/THRUST match documented constants (1150/2400)', w.GRAVITY === 1150 && w.THRUST === 2400);
    check('net upward force (1250) is stronger than net downward (1150)', netUp === 1250 && netDown === 1150 && netUp > netDown);
}

// ── Corridor bounds (src/world.js boundsBase/halfGapAt) ──────────────────────
for (const [iw, ih] of [[600, 600], [844, 390], [1512, 823]]) {
    const w = makeWorld(iw, ih);
    const H = w.H;

    check(`[${iw}x${ih}] halfGapAt(0) == H*0.34`, Math.abs(w.halfGapAt(0) - H * 0.34) < 1e-9);
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
    check('milestoneStep < 100 is 25',    w.milestoneStep(24)   === 25);
    check('milestoneStep 100-299 is 50',  w.milestoneStep(100)  === 50 && w.milestoneStep(299) === 50);
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

if (failed) {
    console.error('\nmath check FAILED');
    process.exit(1);
} else {
    console.log('\nAll difficulty/scoring invariants hold.');
}
