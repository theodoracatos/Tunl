#!/usr/bin/env node
// Zero-dependency headless run of the REAL game: every script tunl.html loads, in its
// order, in one vm context, with a do-nothing canvas and no audio. Then it plays.
//
// Why this exists (2026-09-21 mutation audit): no other test loads update.js, draw.js,
// lifecycle.js, input.js or approach.js. The checks that were meant to guard update.js
// (the frame-rate-independent integrator, score, shard cap, gap easing, poison) each
// re-implemented the formula inside the test and asserted the copy - so reverting the
// real line in update.js passed every test. 12 of 14 deliberate regressions survived
// the whole suite. Everything below drives the actual functions instead, and each
// section names the regression it was verified to catch.
//
// Two halves:
//  1. a smoke flight through every sector with draw() on every frame, then the death
//     screen and the title screen - a thrown ReferenceError anywhere in a render or
//     update path fails here, where it used to ship;
//  2. state-level checks of rules CLAUDE.md / docs/agents mark "do not revert", run against the
//     real update()/die()/commitDeath().
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

// main.js is the one script left out: it owns the rAF loop and builds an AudioContext
// at load, neither of which exists here. Everything it would call is driven directly.
const FILES = [...fs.readFileSync(path.join(__dirname, 'tunl.html'), 'utf8')
    .matchAll(/<script src="(src\/[^"]+\.js)"><\/script>/g)].map(m => m[1])
    .filter(f => f !== 'src/main.js');

// A 2D context that accepts everything. Getters return a no-op function for any method
// draw.js calls; the few whose RESULT is read return a plausible shape.
function fakeContext() {
    const special = {
        measureText: s => ({ width: String(s).length * 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2,
                             actualBoundingBoxLeft: 0, actualBoundingBoxRight: String(s).length * 8 }),
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
        createConicGradient:  () => ({ addColorStop() {} }),
        createPattern: () => ({ setTransform() {} }),
        getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h) * 4), width: w, height: h }),
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h) * 4), width: w, height: h }),
        getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
        isPointInPath: () => false,
    };
    return new Proxy({}, {
        get: (t, k) => (k in t ? t[k] : k in special ? special[k] : () => {}),
        set: (t, k, v) => { t[k] = v; return true; },
    });
}

// The cave, the world palette and the crystal material all come from the UTC date, so
// the run is pinned to one day for reproducibility. TUNL_SIM_DAY=YYYYMMDD flies another;
// the checks below were verified day-independent over 42 consecutive days.
const SIM_DAY = +(process.env.TUNL_SIM_DAY || 20260921);
const SIM_NOW = Date.UTC(Math.floor(SIM_DAY / 10000), Math.floor(SIM_DAY / 100) % 100 - 1, SIM_DAY % 100, 12);
class PinnedDate extends Date {
    constructor(...a) { super(...(a.length ? a : [SIM_NOW])); }
    static now() { return SIM_NOW; }
}

function boot(innerWidth = 956, innerHeight = 440) {
    const ctx = fakeContext();
    const canvas = () => ({ getContext: () => ctx, width: 0, height: 0, style: {}, addEventListener() {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: innerWidth, height: innerHeight }),
        toDataURL: () => 'data:image/png;base64,', toBlob() {} });
    const store = {};
    const location = { search: '', href: 'app://tunl/', hostname: '', pathname: '/', hash: '' };
    const navigator = { language: 'en', languages: ['en'], userAgent: 'node', vibrate() {} };
    const sb = {
        // The iOS message-handler bridge makes isWeb() false: this suite runs the APP.
        window: { innerWidth, innerHeight, devicePixelRatio: 1, location, navigator,
                  webkit: { messageHandlers: { haptic: { postMessage() {} } } },
                  addEventListener() {}, removeEventListener() {},
                  matchMedia: () => ({ matches: false, addEventListener() {} }) },
        document: { getElementById: canvas, createElement: canvas, addEventListener() {}, querySelector: () => null,
                    documentElement: { style: {}, lang: 'en' }, hidden: false,
                    body: { style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
                    fonts: { add() {}, ready: Promise.resolve(), load: () => Promise.resolve(), check: () => true } },
        localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
        navigator, location, history: { replaceState() {} },
        performance: { now: () => 0 }, setTimeout() {}, clearTimeout() {}, setInterval() {}, requestAnimationFrame() {},
        FontFace: function () { return { load: () => Promise.resolve() }; }, Image: function () { return {}; },
        fetch: () => Promise.reject(new Error('offline')),
        console, Math, Date: PinnedDate, JSON, atob, btoa, Promise, URLSearchParams, TextEncoder, TextDecoder,
        Uint8Array, Uint8ClampedArray, Float32Array, Int16Array, ArrayBuffer,
    };
    sb.globalThis = sb; sb.self = sb;
    vm.createContext(sb);
    for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), sb, { filename: f });
    // Top-level let/const are not properties of the sandbox; every read and write of
    // game state goes through the context itself.
    return code => vm.runInContext(code, sb);
}

let failed = 0;
function check(name, cond) {
    if (cond) console.log('✓', name);
    else { console.log('✗', name); failed++; }
}

// Autopilot: aim for the corridor centre with a little velocity damping. Not a good
// pilot and not meant to be - it only has to keep the ship somewhere plausible so the
// run reaches deep content. Over the city it holds mid-screen.
const AUTOPILOT = `
    this._pilot = function () {
        const target = approachLeft > 0 ? H / 2
            : (b => (b.top + b.bot) / 2)(boundsAt(scrollX + PX + W * 0.05));
        holding = (py - target) + 0.18 * vy > 0;
    };
`;

// Fly a fresh run into the tunnel and on to world-x `wx`, shields topped up so no hit
// ends it. Returns the context runner.
function flyTo(wx, dt = 1 / 60) {
    const g = boot();
    g(AUTOPILOT);
    g('startPlay()');
    g(`for (let i = 0; i < 200000 && (scrollX < ${wx} || approachLeft > 0 || startRamp < 1); i++) {
        shieldCount = 9; hullScratches = HULL_SCRATCHES; _pilot(); update(${dt});
        if (phase !== 'play') throw new Error('run ended at wx ' + scrollX);
    }`);
    return g;
}

// A quiet, deterministic moment in the tunnel for state tests: past the safe opening,
// nothing near the ship, no timers running. Wall tests need `deep`: until the
// onboarding widen runs out (EARLY_WIDEN_WX) the corridor edge lies OFF screen, so a
// "wall" contact there is really the screen-edge branch - a different line of update.js.
function quietCave(deep = false) {
    const g = flyTo(deep ? 30000 : 4200);
    // The wave swings the corridor, so on some days one wall is still off screen at any
    // given wx; fly on to the next stretch where both are clearly inside it and one side
    // has room for a full coin bonus without that wall leaving the screen as well.
    if (deep) g(`for (let i = 0; i < 60 * 60; i++) {
        const b = boundsAt(scrollX + PX);
        if (b.top > PR * 4 && b.bot < H - PR * 4 && Math.max(b.top, H - b.bot) > PR + gapBonusMax()) break;
        shieldCount = 9; hullScratches = HULL_SCRATCHES; _pilot(); update(1 / 60);
    }`);
    g(`stalactites = []; mines = []; boulders = []; cannons = []; cannonShots = []; coins = []; chicaneCoins = [];
       portals = []; bullets = []; repairKits = []; bulletAmmo = 0;
       invulnT = 0; wallGraceT = 0; warpTime = 0; slowTime = 0; slowPending = 0; magnetTime = 0; shieldCount = 0;
       gapBonus = 0; gapBonusVisual = 0; hullScratches = HULL_SCRATCHES; holding = false; vy = 0;
       rewardedAdReady = false;
       { const _b = boundsAt(scrollX + PX); py = (_b.top + _b.bot) / 2; }`);
    return g;
}

// ── 1. Smoke flight: every sector, draw() on every frame ────────────────────
// Catches: any throw in update/draw/systems/approach along a whole run (e.g. a renamed
// variable in drawDeathScreen or in the cannon / falling-stalactite / warp render path).
{
    const g = boot();
    g(AUTOPILOT);
    g('titleScreen()');
    g('for (let i = 0; i < 120; i++) { update(1 / 60); draw(); }');
    check('title screen updates and draws for 2s', g('phase') === 'title');

    g('startPlay()');
    const END_WX = g('sectorStartWx(11)');   // all of S10: the first sector with nothing new
    const seen = g(`(() => {
        const seen = { stal: 0, falls: 0, mine: 0, boulder: 0, cannonShot: 0, portal: 0, sectors: new Set(), warp: 0 };
        const TYPES = ['gold', 'blue', 'red', 'orange', 'green', 'bomb', 'poison', 'drain'];
        const planted = [];
        let frames = 0, warped = false, plantAt = -1;
        while ((scrollX < ${END_WX} || approachLeft > 0) && frames < 60 * 600) {
            // Every coin type, once, on every day: which types the day's cave happens to
            // offer before S10 ends is its own business (drain unlocks at S9 on a ~30s
            // clock). Eight frames in a row a coin of the next type is set down on the
            // ship, so every pickup branch runs; a second row sits ahead in the corridor
            // so every coin object is drawn before it is flown into.
            if (plantAt < 0 && scrollX > sectorStartWx(4)) {
                plantAt = frames;
                TYPES.forEach((type, i) => {
                    const wx = scrollX + PX + W * 0.45 + i * 45;
                    coins.push({ wx, y: centerAt(wx), collected: false, type, fade: 1.0 });
                });
            }
            if (plantAt >= 0 && frames - plantAt < TYPES.length) {
                const c = { wx: scrollX + PX, y: py, collected: false, type: TYPES[frames - plantAt], fade: 1.0 };
                coins.push(c); planted.push(c);
            }
            shieldCount = 9; hullScratches = HULL_SCRATCHES;
            _pilot(); update(1 / 60); draw(); frames++;
            if (phase !== 'play') throw new Error('smoke run ended at wx ' + scrollX + ' (' + deathCause + ')');
            seen.stal = Math.max(seen.stal, stalactites.length);
            if (stalactites.some(s => s.falls)) seen.falls++;
            if (mines.length) seen.mine++;
            if (boulders.length) seen.boulder++;
            if (cannonShots.length) seen.cannonShot++;
            if (portals.length) seen.portal++;
            seen.sectors.add(sectorAt(scrollX));
            // A warp is only ever entered by flying the ring; the autopilot does not aim
            // for it, so trigger one explicitly once to render the streaks and ghosting.
            if (!warped && scrollX > sectorStartWx(6)) { triggerWarp(1); warped = true; }
            if (warpTime > 0) seen.warp++;
        }
        seen.picked = planted.filter(c => c.collected).map(c => c.type);
        seen.sectors = seen.sectors.size; seen.frames = frames;
        return seen;
    })()`);
    check(`smoke run flies S0-S10 with draw() every frame (${seen.frames} frames, ${seen.sectors} sectors)`,
        g('scrollX') >= END_WX && seen.sectors >= 11);
    check(`smoke run actually met every hazard type (stal ${seen.stal}, falling ${seen.falls}, mine ${seen.mine}, boulder ${seen.boulder}, cannon shot ${seen.cannonShot}, warp ${seen.warp})`,
        seen.stal > 0 && seen.falls > 0 && seen.mine > 0 && seen.boulder > 0 && seen.cannonShot > 0 && seen.warp > 0);
    check(`every coin type is drawn and picked up mid-run (${seen.picked.join(',')})`, seen.picked.length === 8);

    // Death, the debriefing, then back to the title - the three screens a player sees
    // after every run.
    g(`shieldCount = 0; invulnT = 0; rewardedAdReady = false; die(true);`);
    check('a fatal hit ends the run', g('phase') === 'dead');
    g('for (let i = 0; i < 60 * 4; i++) { update(1 / 60); draw(); }');
    check('death freeze + debriefing update and draw for 4s', g('phase') === 'dead' && g('deadT') > 3.9);
    g('titleScreen(); for (let i = 0; i < 30; i++) { update(1 / 60); draw(); }');
    check('back on the title screen after a run', g('phase') === 'title');
}

// ── 2. Frame-rate-independent integration (update.js, 12.0 - do not revert) ──
// Catches: `py += vy * dt` instead of the trapezoid. Real update(), held thrust from
// rest, compared against the exact constant-acceleration solution at 8 refresh rates.
{
    const T = 0.25;
    let worst = 0, spread = [Infinity, -Infinity];
    for (const fps of [144, 120, 90, 72, 60, 45, 30, 24]) {
        const g = quietCave();
        const steps = Math.round(T * fps);
        const { rise, t, a } = g(`(() => {
            hasHeldThisRun = true; holding = true; vy = 0; invulnT = 99;   // invuln only clamps at a wall, never reached
            const y0 = py;
            for (let i = 0; i < ${steps}; i++) { holding = true; update(1 / ${fps}); }
            return { rise: y0 - py, t: ${steps} / ${fps}, a: THRUST - GRAVITY };
        })()`);
        const exact = 0.5 * a * t * t;
        worst = Math.max(worst, Math.abs(rise - exact));
        spread = [Math.min(spread[0], rise - exact), Math.max(spread[1], rise - exact)];
    }
    // The old integrator overshot by 0.5*a*dt*T: 5.6px at 30Hz against 1.2px at 144Hz here.
    check(`held thrust through the real update() matches the exact solution at every frame rate (worst ${worst.toExponential(1)}px)`,
        worst < 1e-6);
}

// ── 3. Walls: hull scratch, warp clamp, and the coin bonus is real width ─────
{
    // Catches: a scratch that no longer spends, or a wall that no longer kills.
    const g = quietCave(true);
    check('precondition: at this depth the corridor wall is on screen, not the screen edge',
        g('(b => b.top > PR * 3 && b.bot < H - PR * 3)(boundsAt(scrollX + PX))'));
    g('{ const _b = boundsAt(scrollX + PX); py = _b.top - 2; } update(1 / 60);');
    check('a wall contact with scratches left spends one and keeps the run alive',
        g('phase') === 'play' && g('hullScratches') === g('HULL_SCRATCHES') - 1 && g('wallGraceT') > 0);
    g('wallGraceT = 0; hullScratches = 0; { const _b = boundsAt(scrollX + PX); py = _b.top - 2; } update(1 / 60);');
    check('a wall contact with no scratches left is fatal', g('phase') === 'dead');
}
{
    // Catches: the hull scratching while a shield is up (user's call 2026-09-21: shield first).
    const g = quietCave(true);
    g('shieldCount = 1; { const _b = boundsAt(scrollX + PX); py = _b.bot + 2; } update(1 / 60);');
    check('a wall contact with a shield up spends the shield and leaves the hull whole',
        g('phase') === 'play' && g('shieldCount') === 0 && g('hullScratches') === g('HULL_SCRATCHES'));
    g('invulnT = 0; wallGraceT = 0; { const _b = boundsAt(scrollX + PX); py = _b.bot + 2; } update(1 / 60);');
    check('with the shield gone the next wall contact scratches the hull',
        g('phase') === 'play' && g('hullScratches') === g('HULL_SCRATCHES') - 1);
    // Catches: a scratched hull that shows nothing, smoke through a shield, or a draw that throws.
    const smoke = sh => g(`(() => { invulnT = 0; wallGraceT = 1; hullScratches = 0; shieldCount = ${sh}; parts = [];
        for (let i = 0; i < 60; i++) { _pilot(); update(1 / 60); } draw(); return parts.filter(p => p.smoke).length; })()`);
    const bare = smoke(0), shielded = smoke(1);
    check(`a scratched hull smokes and draws its damage (${bare} puffs alive after 1 s)`,
        g('phase') === 'play' && bare > 5);
    check(`no smoke while a shield is up (${shielded} puffs)`, shielded === 0);
}
{
    // Catches: dropping `warpTime > 0` from the wall clamp (docs/agents/portal.md: "the wall is
    // never a warp-caused death, by construction").
    const g = quietCave(true);
    g('hullScratches = 0; warpTime = 1.0; { const _b = boundsAt(scrollX + PX); py = _b.top - 4; } update(1 / 60);');
    const inside = g('(b => py >= b.top && py <= b.bot)(boundsAt(scrollX + PX))');
    check('mid-warp the wall clamps the ship back inside instead of killing', g('phase') === 'play' && inside);
}
{
    // Catches: boundsAt() ignoring gapBonusVisual - collision against a corridor the
    // player is not being shown. The ship's EDGE is put in the middle of the bonus band:
    // half a bonus past the bare wall, half a bonus short of the widened one. (Default
    // skin, so the collision radius is plain PR.)
    const g = quietCave(true);
    const r = g(`(() => {
        const base = boundsAt(scrollX + PX);
        const topSide = base.top > H - base.bot;   // widen where there is screen to spare
        gapBonus = gapBonusMax(); gapBonusVisual = gapBonus;
        hullScratches = 0; vy = 0;
        py = topSide ? base.top + PR - gapBonus / 2 : base.bot - PR + gapBonus / 2;
        const wide = boundsAt(scrollX + PX);
        const onScreen = wide.top > 0 && wide.bot < H;
        update(1 / 60);
        return { bonus: gapBonus, onScreen, phase, skin: activeSkin };
    })()`);
    check(`the coin bonus is real width: a ship edge ${(r.bonus / 2).toFixed(0)}px into the bare wall survives inside the widened corridor`,
        r.skin === 0 && r.onScreen && r.bonus / 2 > 10 && r.phase === 'play');
}

// ── 4. Gap-bonus easing (update.js gapBonusVisual, GAP_EASE_RATE) ───────────
// Catches: gapBonusVisual snapping to gapBonus (the wall would teleport, not widen).
{
    const g = quietCave();
    const r = g(`(() => {
        gapBonus = gapBonusMax(); gapBonusVisual = 0;
        update(1 / 60);
        const one = gapBonusVisual, target = gapBonus;
        for (let i = 0; i < 60 * 3; i++) update(1 / 60);
        return { one, target, rate: GAP_EASE_RATE, after: gapBonusVisual, targetAfter: gapBonus };
    })()`);
    check(`gapBonusVisual eases toward the bonus at GAP_EASE_RATE instead of snapping (${r.one.toFixed(2)} of ${r.target.toFixed(0)}px after one frame)`,
        r.one > 0 && r.one <= r.rate / 60 + 1e-9 && r.one < r.target);
    check('and it catches up with the (decaying) bonus within a few seconds',
        Math.abs(r.after - r.targetAfter) < r.rate / 60 + 1e-9);
}

// ── 5. Score (update.js) ────────────────────────────────────────────────────
// Catches: a changed score formula; the displayed score going negative under drain.
{
    const g = quietCave();
    g('bonusScore = 42; update(1 / 60);');
    check('score = floor(scrollX / 60) + bonusScore', g('score') === Math.floor(g('scrollX') / 60) + 42);
    g('bonusScore = -1e6; update(1 / 60);');
    check('score is clamped at 0 however far bonusScore goes negative', g('score') === 0);
}

// ── 6. ON FIRE bar (update.js _fireBar) ─────────────────────────────────────
// Catches: the bar falling back to the all-time best only (a strong day never ignites).
{
    const lit = (best, dailyBest, bonus) => {
        const g = quietCave();
        g(`best = ${best}; dailyBest = ${dailyBest}; onFire = false; bonusScore = ${bonus}; update(1 / 60);`);
        return { onFire: g('onFire'), score: g('score') };
    };
    const a = lit(100000, 50, 0);
    check(`ON FIRE lights on passing today's best even far below the all-time best (score ${a.score} > 50)`, a.onFire === true);
    const b = lit(100000, 0, 0);
    check('with no run today yet, the bar is the all-time best', b.onFire === false);
    const c = lit(0, 0, 0);
    check('a brand-new player never lights on score > 0', c.onFire === false);
}

// ── 7. Hazard coins (systems.js checkCoinCollection) ────────────────────────
// Catches: poison rounding to a 0-coin hit, poison over-taking, drain losing its floor.
function touchCoin(type, setup) {
    const g = quietCave();
    return g(`(() => {
        ${setup}
        coins.push({ wx: scrollX + PX, y: py, collected: false, type: '${type}', fade: 1.0 });
        const before = { runCoins, score, bonusScore };
        update(1 / 60);
        return { before, runCoins, score, bonusScore, prog: _prog, combo: coinCombo,
                 minPct: POISON_LOSS_PCT_MIN, maxPct: POISON_LOSS_PCT_MAX,
                 dMin: DRAIN_LOSS_PCT_MIN, dMax: DRAIN_LOSS_PCT_MAX };
    })()`);
}
{
    const small = touchCoin('poison', 'runCoins = 3;');
    check('poison takes at least one coin from a small pool (never a 0-coin no-op)', small.runCoins === 2);
    const empty = touchCoin('poison', 'runCoins = 0;');
    check('poison on an empty pool leaves it at 0', empty.runCoins === 0);
    const big = touchCoin('poison', 'runCoins = 1000; coinCombo = 4; coinComboTimer = 1;');
    const lost = (1000 - big.runCoins) / 1000;
    check(`poison takes its ${(big.minPct * 100).toFixed(0)}-${(big.maxPct * 100).toFixed(0)}% share of a large pool (${(lost * 100).toFixed(1)}%) and breaks the combo`,
        lost >= big.minPct && lost <= big.maxPct + 0.001 && big.combo === 0);
    const drain = touchCoin('drain', 'bonusScore = 2000; update(1 / 60);');
    // update() computes score before collecting coins, so the drop shows on the NEXT
    // frame; the debit itself lands in bonusScore at once, measured against the score
    // the coin saw.
    const dLost = (drain.before.bonusScore - drain.bonusScore) / drain.before.score;
    check(`drain takes its ${(drain.dMin * 100).toFixed(0)}-${(drain.dMax * 100).toFixed(0)}% bite out of the visible score (${(dLost * 100).toFixed(1)}%)`,
        dLost >= drain.dMin && dLost <= drain.dMax + 0.001);
}

// ── 8. Shard banking at death (update.js commitDeath, DAILY_SHARD_CAP) ───────
// Catches: banking the whole run pool past the daily cap.
{
    const g = quietCave();
    const r = g(`(() => {
        shards = 0; dailyShardsEarned = DAILY_SHARD_CAP - 30; runCoins = 1000;
        die(true);
        return { phase, shards, daily: dailyShardsEarned, cap: DAILY_SHARD_CAP, banked: runShardsBanked };
    })()`);
    // `shards` itself is not asserted: a daily mission completed on the way pays out at
    // the same death and is exempt from the cap, so the balance can rise by more.
    check(`a death banks only the day's remaining headroom (${r.banked} of 1000 run coins)`,
        r.phase === 'dead' && r.banked === 30 && r.shards >= 30 && r.daily === r.cap);
    const g2 = quietCave();
    const r2 = g2(`(() => { shards = 0; dailyShardsEarned = 0; runCoins = 12; die(true); return { daily: dailyShardsEarned, banked: runShardsBanked }; })()`);
    check('with headroom to spare, a death banks exactly the run pool', r2.banked === 12 && r2.daily === 12);
    const g3 = quietCave();
    const r3 = g3(`(() => { dailyShardsEarned = DAILY_SHARD_CAP + 40; runCoins = 50; die(true); return { daily: dailyShardsEarned, banked: runShardsBanked, cap: DAILY_SHARD_CAP }; })()`);
    check('an already-capped day banks nothing (no negative clamp)', r3.banked === 0 && r3.daily === r3.cap + 40);
}

// ── 9. Crystal roots stay on the moving wall (draw.js _xtalFit) ─────────────
// Catches: freezing the cluster's root offsets at first draw. refreshWave() retunes
// the wave every frame, so the wall under a spike tilts and bends while it crosses
// the screen; frozen roots left nest crystals up to 26 px off the wall. Reads the
// real cached geometry after the real draw() and compares it with boundsAt().
// Tallest supported screen, where the drift is worst.
{
    const g = boot(956, 600);
    g(AUTOPILOT);
    g('startPlay()');
    const r = g(`(() => {
        let worst = 0, n = 0;
        while (scrollX < sectorStartWx(8) || approachLeft > 0) {
            shieldCount = 9; hullScratches = HULL_SCRATCHES; _pilot(); update(1 / 60); draw();
            for (const s of stalactites) {
                const X = s._xtal, sx = s.wx - scrollX;
                if (!X || s.detached || s.fade <= 0 || sx < -70 || sx > W + 70) continue;
                const hw = s.width / 2, dir = s.isTop ? 1 : -1;
                const wallAt = o => s.isTop ? boundsAt(s.wx + o).top : boundsAt(s.wx + o).bot;
                const baseY = (wallAt(-hw) + wallAt(hw)) / 2;
                // Drawn root = cached dy sheared by X.k; > 0 means lifted into the corridor.
                for (const pr of X.cluster) if (pr.lip) {
                    const lift = pr.dy + X.k * pr.dx - ((wallAt(pr.dx) - baseY) * dir - hw * CRYSTAL_SINK);
                    worst = Math.max(worst, lift); n++;
                }
            }
        }
        return { worst, n };
    })()`);
    check(`nest crystals stay rooted on the moving wall (worst lift ${r.worst.toFixed(2)} px over ${r.n} roots)`,
        r.n > 1000 && r.worst < 2.5);
}

// ── 10. Repair kit (systems.js spawnRepairKit / updateRepairKits) ────────────
// Catches: a bullet kill that drops no kit, a kit leaking into `coins` (spawner vetoes
// read it, so the daily cave would fork per player), a kit that no longer refills the hull
// or pays nothing on a full one.
{
    const shoot = what => {
        const g = quietCave(true);
        return g(`(() => {
            const wx = scrollX + PX + 140;
            ${what === 'mine'
                ? 'mines.push({ wx, baseY: py, bobAmp: 0, phase: 0 });'
                : 'cannonShots.push({ wx, y: py, vx: 0, vy: 0 });'}
            bullets.push({ wx: scrollX + PX + PR * 1.6, y: py });
            const coinsBefore = coins.length + chicaneCoins.length;
            let n = 0;
            for (let i = 0; i < 30 && !repairKits.length; i++) { shieldCount = 9; _pilot(); update(1 / 60); n++; }
            return { kits: repairKits.length, dx: repairKits.length ? repairKits[0].wx - wx : NaN,
                     coinsSame: coins.length + chicaneCoins.length === coinsBefore, n };
        })()`);
    };
    for (const what of ['mine', 'cannon shot']) {
        const r = shoot(what);
        check(`a bullet that destroys a ${what} drops one repair kit where it died, outside the coin arrays (${r.n} frames)`,
            r.kits === 1 && Math.abs(r.dx) < 1 && r.coinsSame);
    }
    const pick = hull => {
        const g = quietCave(true);
        return g(`(() => {
            hullScratches = ${hull};
            repairKits.push({ wx: scrollX + PX, y: py, t: 0 });
            const before = bonusScore;
            update(1 / 60);
            return { hull: hullScratches, full: HULL_SCRATCHES, gain: bonusScore - before, pts: REPAIR_KIT_PTS, left: repairKits.length };
        })()`);
    };
    const empty = pick(0), half = pick(1), full = pick(2);
    check('a kit gives an empty hull back exactly one scratch and pays its points',
        empty.hull === 1 && empty.gain === empty.pts && empty.left === 0);
    check('a kit tops a once-scratched hull up to full', half.hull === half.full && half.gain === half.pts);
    check('a kit on a full hull still pays its points and leaves the hull as it was',
        full.hull === full.full && full.gain === full.pts && full.left === 0);
    const g = quietCave(true);
    const r = g(`(() => {
        repairKits.push({ wx: scrollX + PX + W * 0.5, y: py, t: 0 }, { wx: scrollX - 100, y: py, t: 0 });
        magnetTime = 5; update(1 / 60);
        return { n: repairKits.length, y: repairKits[0] && repairKits[0].y };
    })()`);
    check('a kit ahead stays put under a magnet, a kit behind the ship is dropped', r.n === 1);
}

if (failed) { console.log(`\n${failed} check(s) failed.`); process.exit(1); }
console.log('\nThe real game runs headless and every simulated rule holds.');
