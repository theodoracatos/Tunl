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

function boot(innerWidth = 956, innerHeight = 440, seed = {}) {
    const ctx = fakeContext();
    const canvas = () => ({ getContext: () => ctx, width: 0, height: 0, style: {}, addEventListener() {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: innerWidth, height: innerHeight }),
        toDataURL: () => 'data:image/png;base64,', toBlob() {} });
    const store = { ...seed };
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
       laserTime = 0; laserTimeMax = 0;
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
        const TYPES = ['gold', 'blue', 'red', 'orange', 'green', 'bomb', 'poison', 'drain', 'laser'];
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
    check(`every coin type is drawn and picked up mid-run (${seen.picked.join(',')})`, seen.picked.length === 9);

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
    // Catches: a wall clamp that fixes py but leaves vy integrating to MAX_VY (player
    // report 2026-09-28: "pinned to the floor, it takes forever to come back up" - the
    // stored speed cost MAX_VY / (THRUST - GRAVITY) of counter-thrust at the floor and
    // MAX_VY / GRAVITY at the ceiling before the ship even moved). Real update(): ride a
    // solid wall for 1 s pushing into it, then read how much speed still points into the
    // rock. Not timed: the corridor keeps waving, and a wall falling away from the ship
    // hides the stored speed on some days. The ship lags a wall that drops away, so a
    // free-fall residue is allowed (up to ~40% over a 20-day sweep); the bug left 100%.
    for (const floor of [true, false]) {
        const r = quietCave(true)(`(() => {
            hasHeldThisRun = true; hullScratches = 0; wallGraceT = 99; vy = 0; holding = ${!floor};
            const b = boundsAt(scrollX + PX);
            py = ${floor} ? b.bot - PR - 2 : b.top + PR + 2;
            for (let i = 0; i < 60; i++) { holding = ${!floor}; update(1 / 60); }
            return { into: (${floor} ? vy : -vy) / MAX_VY, phase };
        })()`);
        check(`a ship ridden along the ${floor ? 'floor' : 'ceiling'} for 1 s stores no speed into it (${(r.into * 100).toFixed(0)}% of MAX_VY)`,
            r.phase === 'play' && r.into < 0.6);
    }
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
// ── Laser (systems.js updateLaser, constants.js LASER_* doc) ────────────────
// Catches: a beam that no longer breaks a boulder (or breaks it instantly / pays nothing),
// a bullet that suddenly breaks one, a beam that passes THROUGH a boulder to what is behind
// it, a pickup that grants no window, a window that never ends, a beam that survives death.
{
    // A flat test island straight ahead of the ship, at its height.
    const island = `const _isle = (wx, y) => { const r = PR * 1.4, n = BOULDER_PROF_N + 1;
        return { wx, y, r, hl: 40, up: Array(n).fill(r), dn: Array(n).fill(r), upMax: r, dnMax: r,
                 fTop: Array(n).fill(1), fBot: Array(n).fill(1) }; };`;
    // invulnT: a shield-absorbed hit clears everything around the ship (triggerBombExplosion),
    // which would take the rock away without the laser.
    const hold = 'py = _Y; vy = 0; holding = false; shieldCount = 9; hullScratches = HULL_SCRATCHES; invulnT = 1;';

    let g = quietCave(true);
    const burn = g(`(() => { ${island}
        // The beam stops at the rock while it stands; the mine behind stays inside the
        // beam's reach (laserTrace stops at W + 40).
        const _Y = py, bo = _isle(scrollX + W * 0.8, py);
        const near = { wx: scrollX + PX + W * 0.2, baseY: py, bobAmp: 0, phase: 0 };
        const behind = { wx: bo.wx + bo.hl + 30, baseY: py, bobAmp: 0, phase: 0 };
        boulders.push(bo); mines.push(near, behind);
        laserTime = LASER_SEC; laserTimeMax = LASER_SEC;
        const b0 = bonusScore;
        let frames = 0, behindKept = true, burstGain = 0;
        ${hold} update(1 / 60); frames++;
        const lit = bo.burn !== undefined, nearGone = !mines.includes(near);
        while (boulders.includes(bo) && frames < 60) {
            behindKept = behindKept && mines.includes(behind);
            const s0 = bonusScore;
            ${hold} update(1 / 60); frames++;
            if (!boulders.includes(bo)) burstGain = bonusScore - s0;
        }
        return { lit, nearGone, behindKept, frames, burstGain, pts: BULLET_HIT_PTS.boulder, sec: LASER_BURN_SEC };
    })()`);
    check(`the beam ignites a boulder on first touch and it bursts after LASER_BURN_SEC, paid (${burn.frames} frames, +${burn.burstGain})`,
        burn.lit && burn.frames >= Math.floor(burn.sec * 60) && burn.frames <= Math.ceil(burn.sec * 60) + 2 && burn.burstGain >= burn.pts);
    check('it kills the mine in front at once and stops at the burning rock (the mine behind survives until it bursts)',
        burn.nearGone && burn.behindKept);

    // The reported bug (2026-09-27): a player flies a boulder's pass, so the beam only grazes
    // the rock's edge for a moment - a burn that needed the beam to stay on it almost never
    // broke one. One grazing frame must be enough, even if the beam then moves away or ends.
    g = quietCave(true);
    const graze = g(`(() => { ${island}
        const bo = _isle(scrollX + W * 0.8, py);
        const mid = py;
        let _Y = bo.y - bo.r - LASER_HALF_W * 0.5;   // beam overlaps the top edge by half its width
        boulders.push(bo);
        laserTime = LASER_SEC; laserTimeMax = LASER_SEC;
        ${hold} update(1 / 60);
        const lit = bo.burn !== undefined;
        laserTime = 0; _Y = mid - bo.r * 2;           // beam gone, ship away (still inside the corridor)
        let n = 0; while (boulders.includes(bo) && n < 60) { ${hold} update(1 / 60); n++; }
        // and a beam that clearly misses leaves a rock alone
        _Y = mid;
        const bo2 = _isle(scrollX + W * 0.8, _Y + LASER_HALF_W * 4 + bo.r * 1.5);
        boulders.push(bo2); laserTime = LASER_SEC;
        for (let i = 0; i < 20; i++) { ${hold} update(1 / 60); }
        return { lit, burst: !boulders.includes(bo), n, missKept: boulders.includes(bo2) && bo2.burn === undefined };
    })()`);
    check(`one grazing frame is enough: the rock burns out and bursts after the beam has gone (${graze.n} frames); a miss leaves it`,
        graze.lit && graze.burst && graze.missKept);

    g = quietCave(true);
    const shot = g(`(() => { ${island}
        const _Y = py, bo = _isle(scrollX + W * 0.8, py);
        boulders.push(bo);
        let fired = 0, frames = 0;
        // Stop well before the ship itself reaches the rock (a shield-absorbed hit clears it).
        while (bo.wx - bo.hl - scrollX > PX + W * 0.12 && frames < 240) {
            if (frames % 8 === 0) { bullets.push({ wx: scrollX + PX + PR * 1.6, y: py }); fired++; }
            ${hold} update(1 / 60); frames++;
        }
        return { intact: boulders.includes(bo), stopped: fired - bullets.length, fired, frames };
    })()`);
    check(`a bullet still only sparks off a boulder (${shot.stopped} of ${shot.fired} bullets stopped by it, rock intact)`,
        shot.intact && shot.stopped > 0);

    g = quietCave(true);
    const win = g(`(() => {
        coins.push({ wx: scrollX + PX, y: py, collected: false, type: 'laser', fade: 1.0 });
        update(1 / 60);
        const got = laserTime, max = laserTimeMax;
        let n = 0;
        // Nothing that bends the bullets' clock (a warp ring, a blue coin) may be flown into.
        while (laserTime > 0 && n < 600) {
            coins = []; chicaneCoins = []; portals = [];
            shieldCount = 9; hullScratches = HULL_SCRATCHES; _pilot(); update(1 / 60); n++;
        }
        const ran = n / 60;
        coins.push({ wx: scrollX + PX, y: py, collected: false, type: 'laser', fade: 1.0 });
        update(1 / 60);
        const again = laserTime;
        shieldCount = 0; invulnT = 0; rewardedAdReady = false; die(true);
        return { got, max, ran, again, afterDeath: laserTime, sec: LASER_SEC };
    })()`);
    check(`a laser coin grants one LASER_SEC window that runs out (got ${win.got.toFixed(2)}s, ran ${win.ran.toFixed(2)}s)`,
        Math.abs(win.got - win.sec) < 0.05 && win.max === win.sec && Math.abs(win.ran - win.sec) < 0.1);
    check('death switches the beam off', win.again > 0 && win.afterDeath === 0);
}

// ── Swing wing: cruise in between, warp folds, blue coin spreads ───────────
// docs/agents/ship-render.md "F-14 hull". Measured on the real update loop, because the
// rule the user asked for is about WHEN the wings move, not about the easing constant.
{
    const g = quietCave(true);
    const r = g(`(() => {
        const out = {};
        for (let i = 0; i < 240; i++) { shieldCount = 9; _pilot(); update(1 / 60); }
        out.cruise = shipSweep;
        slowTime = slowTimeMax = 4;
        // A fifth of a second: the wings swing out fast, the pill has barely moved
        for (let i = 0; i < 12; i++) { shieldCount = 9; _pilot(); update(1 / 60); }
        out.coin = shipSweep;
        for (let i = 0; i < 180 && slowTime > 1; i++) { shieldCount = 9; _pilot(); update(1 / 60); }
        out.quarter = shipSweep;
        slowTime = slowTimeMax = 0;
        for (let i = 0; i < 240; i++) { shieldCount = 9; _pilot(); update(1 / 60); }
        out.back = shipSweep;
        warpTime = warpMax = 3;
        for (let i = 0; i < 30; i++) { shieldCount = 9; _pilot(); update(1 / 60); }
        out.warp = shipSweep;
        // A warp beats a live blue coin: the ship really is going fast
        slowTime = slowTimeMax = 4;
        for (let i = 0; i < 30; i++) { shieldCount = 9; _pilot(); update(1 / 60); }
        out.warpWins = shipSweep;
        warpTime = warpMax = 0;
        for (let i = 0; i < 300; i++) { shieldCount = 9; _pilot(); update(1 / 60); }
        out.after = shipSweep;
        out.cruiseK = SHIP3D_SWEEP_CRUISE;
        return out;
    })()`);
    const near = (v, t) => Math.abs(v - t) < 0.06;
    check(`normal flight cruises between the two stops (sweep ${r.cruise.toFixed(2)} vs SHIP3D_SWEEP_CRUISE ${r.cruiseK})`,
        near(r.cruise, r.cruiseK) && r.cruiseK > 0.15 && r.cruiseK < 0.85);
    check(`a blue coin swings them fully forward within 0.2 s (sweep ${r.coin.toFixed(2)})`, r.coin < 0.10);
    check(`they come back WITH the pill, not after it (sweep ${r.quarter.toFixed(2)} at a quarter left)`,
        r.quarter > r.coin + 0.2 && r.quarter < r.cruiseK - 0.02);
    check(`and they are back at cruise once it is over (sweep ${r.back.toFixed(2)})`, near(r.back, r.cruiseK));
    check(`a warp folds them fully back (sweep ${r.warp.toFixed(2)})`, r.warp > 0.90);
    check(`a warp beats a blue coin held at the same time (sweep ${r.warpWins.toFixed(2)})`, r.warpWins > 0.85);
    check(`after the warp they ease back to cruise (sweep ${r.after.toFixed(2)})`, near(r.after, r.cruiseK));
}

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

// ── 11. Hangar paint, the Lackiererei (paint.js, state.js) ───────────────────
// Kit ownership, the migration of the 2026-09-17 finishes, earned parts, buying through
// the real Paint sheet hit-test, and every part drawn on both hulls. Draw-only feature: nothing here may touch a gameplay rng stream.
{
    // Migration: an old save owning STEALTH, SPLIT and AURORA, worn on ships 0-2.
    const m = boot(956, 440, { tunnel_liveries: String(1 | 2 | 8 | 32), tunnel_ship_liveries: JSON.stringify([1, 3, 5, 0, 0, 0, 0, 0]) });
    const r = m(`({
        stealth: paintPartOwned('m', 1), split: paintPartOwned('p', 1), aurora: paintPartOwned('fx', 3),
        chrome: paintPartOwned('m', 5), stripe: paintPartOwned('p', 2),
        s0: shipPaint[0].m, s1: shipPaint[1].p, s2: shipPaint[2].fx, plain: paintOf(3),
        saved: !!localStorage.getItem('tunnel_paint_owned') })`);
    check('old finishes migrate to their parts (STEALTH, SPLIT, AURORA owned; CHROME, STRIPE not)',
        r.stealth && r.split && r.aurora && !r.chrome && !r.stripe && r.saved);
    check('a ship keeps the old finish it wore, an unpainted ship stays FACTORY',
        r.s0 === 1 && r.s1 === 1 && r.s2 === 3 && r.plain === 0);

    const g = boot();
    const fresh = g(`({
        free: paintPartOwned('c', 0) && paintPartOwned('c', 1) && paintPartOwned('m', 0) && paintPartOwned('p', 0) && paintPartOwned('fx', 0),
        paid: paintPartOwned('c', 2) || paintPartOwned('p', 1) || paintPartOwned('m', 1) || paintPartOwned('fx', 1),
        gold: [ (best = 499, paintPartOwned('c', 10)), (best = 500, paintPartOwned('c', 10)) ],
        orbit: [ (planetsFlown = 63, paintPartOwned('p', 9)), (planetsFlown = 127, paintPartOwned('p', 9)) ],
        diamond: [ (stardust = 29, paintPartOwned('m', 6)), (stardust = 30, paintPartOwned('m', 6)) ] })`);
    check('a fresh hangar owns only the free parts', fresh.free && !fresh.paid);
    check('earned parts unlock exactly at their condition (GOLD best 500, ORBIT 7 worlds, DIAMOND 30 days)',
        !fresh.gold[0] && fresh.gold[1] && !fresh.orbit[0] && fresh.orbit[1] && !fresh.diamond[0] && fresh.diamond[1]);

    // The hull colour really changes the paint, the glow (identity) does not enter it.
    const t = g(`(() => {
        const k = _paintKit({ c: 4 }), sk = SKINS[0];
        const f = _shipTones(sk.color, ...sk.shadow, 0), p = _shipTones(sk.color, ...sk.shadow, k);
        const q = _shipTones(sk.color, 0, 0, 0, k);
        return { f: f.base, p: p.base, want: rgb(PAINT_COLORS[4].rgb), glowFree: q.base === p.base };
    })()`);
    check('a hull colour repaints the hull (PEARL in RACING is RACING, not PEARL)', t.p === t.want && t.f !== t.p && t.glowFree);

    // Every part of every slot draws on the flat and the 3D hull, in flight and in the hangar.
    const drawn = g(`(() => {
        let n = 0;
        for (const ph of ['title', 'play']) {
            phase = ph;
            for (const s of PAINT_SLOTS) for (let i = 0; i < s.list.length; i++) {
                const k = _paintKit({ c: 3, p: 2, pc: 2, m: 2, fx: 1 }); k[s.key] = i;
                for (const sk of SKINS) {
                    drawShip(100, 100, 40, sk.color, ...sk.shadow, 10, true, k);
                    drawShip3D(100, 100, 17, sk.color, ...sk.shadow, 10, true, k);
                    n++;
                }
            }
        }
        phase = 'title';
        return n;
    })()`);
    check(`every paint part draws on both hulls for every ship (${drawn} kits)`, drawn > 0);

    // Buying through the real sheet: first tap previews, second buys and equips.
    const buy = g(`(() => {
        shards = 100; activeSkin = 0; showShipPicker = true; showPaint = true; paintTab = 0; paintPreview = -1;
        const tapCell = i => { drawPaintSheet(); const b = _paintCellRects[i]; paintSheetTap(b.x + b.w / 2, b.y + b.h / 2); };
        tapCell(2);
        const afterOne = { owned: paintPartOwned('c', 2), shards, preview: paintPreview };
        tapCell(2);
        const afterTwo = { owned: paintPartOwned('c', 2), shards, worn: shipPaint[0].c, saved: JSON.parse(localStorage.getItem('tunnel_ship_paint'))[0].c };
        tapCell(3); tapCell(3);
        const poor = { owned: paintPartOwned('c', 3), shards };
        best = 0; shards = 9999; tapCell(10); tapCell(10);
        const earned = { owned: paintPartOwned('c', 10), shards };
        return { afterOne, afterTwo, poor, earned };
    })()`);
    check('first tap on an unowned part previews it and spends nothing',
        !buy.afterOne.owned && buy.afterOne.shards === 100 && buy.afterOne.preview === 2);
    check('second tap buys it, pays its price and the ship wears it (saved)',
        buy.afterTwo.owned && buy.afterTwo.shards === 40 && buy.afterTwo.worn === 2 && buy.afterTwo.saved === 2);
    check('a part the player cannot afford is not bought', !buy.poor.owned && buy.poor.shards === 40);
    check('an earned part can never be bought with shards', !buy.earned.owned && buy.earned.shards === 9999);

    // Web greys the PAINT pill and the Game Center icons out behind an "in the app" sheet;
    // the app must keep the real ones (isWeb() gate). A real tap on the drawn pill.
    const appOnly = g(`(() => {
        phase = 'title'; titleT = 10; appOnlyKey = null; showPaint = false; showShipPicker = true;
        unlockedSkins |= (1 << LIVERY_GATE_SKIN);
        drawTitleScreen();
        const b = _paintBtnRect;
        onDown({ clientX: b.x + b.w / 2, clientY: b.y + b.h / 2, pointerId: 1 });
        const r = { paint: showPaint, sheet: appOnlyKey, worn: !!paintOf(0) };
        showPaint = false; showShipPicker = false;
        drawTitleScreen();
        r.rail = _leaderboardBtnRect === null && _challengeBtnRect === null;
        // The apps have a native ads bridge; the row only exists with one.
        window.webkit.messageHandlers.ads = { postMessage() {} };
        shardsAdReady = false; showMissions = true; drawTitleScreen();
        const a = _shardsAdBtnRect;
        onDown({ clientX: a.x + a.w / 2, clientY: a.y + a.h / 2, pointerId: 1 });
        r.shardsSheet = appOnlyKey; showMissions = false;
        delete window.webkit.messageHandlers.ads;
        return r;
    })()`);
    check('in the app the PAINT pill opens the paint sheet, never the web "in the app" sheet',
        appOnly.paint === true && appOnly.sheet === null);
    check('in the app a ship flies the kit it wears (web alone forces FACTORY)', appOnly.worn);
    check('in the app the rail shows no greyed web-only leaderboard/challenge icons', appOnly.rail);
    check('in the app a tap on the shard-ad row never opens the web "in the app" sheet', appOnly.shardsSheet === null);

    // Every tab's grid has to stay inside the panel, whatever a catalogue grows to.
    const fits = g(`(() => {
        showShipPicker = true; showPaint = true; paintPreview = -1;
        let worst = 0, n = 0, counts = [];
        for (let t = 0; t < PAINT_SLOTS.length; t++) {
            paintTab = t; drawPaintSheet();
            counts.push(_paintCellRects.length);
            if (_paintCellRects.length !== PAINT_SLOTS[t].list.length) worst = 9e9;
            const ys = new Set(_paintCellRects.map(b => Math.round(b.y)));
            if (ys.size > 2) worst = 9e9;   // never a third row: it does not fit the screen
            for (const b of _paintCellRects) {
                worst = Math.max(worst, _paintPanelRect.y - b.y, (b.y + b.h) - (_paintPanelRect.y + _paintPanelRect.h),
                                 _paintPanelRect.x - b.x, (b.x + b.w) - (_paintPanelRect.x + _paintPanelRect.w));
                n++;
            }
        }
        paintTab = 0;
        return { worst, n, counts: counts.join('/') };
    })()`);
    check(`every part of every tab is drawn inside the sheet, in two rows (${fits.n} cells, ${fits.counts})`, fits.worst <= 0);

    // Equipping never writes ownership (so a DEV_WALLET hangar cannot leak into the save),
    // and a save that wears parts it does not own loads without them.
    const tog = g(`(() => {
        paintOwned.c |= 1 << 5; shipPaint[2] = _paintKit({ c: 5, p: 0 }); activeSkin = 2;
        showShipPicker = true; showPaint = true; paintTab = 1; paintPreview = -1;
        paintOwned.p = 0x3ff;
        const savedOwned = localStorage.getItem('tunnel_paint_owned');
        drawPaintSheet(); const b = _paintCellRects[3]; paintSheetTap(b.x + b.w / 2, b.y + b.h / 2);
        return { worn: shipPaint[2].p, kept: shipPaint[2].c, leaked: localStorage.getItem('tunnel_paint_owned') !== savedOwned };
    })()`);
    check('equipping a part keeps the rest of the kit and never writes ownership (DEV_WALLET cannot leak into the save)',
        tog.worn === 3 && tog.kept === 5 && !tog.leaked);
    const bad = boot(956, 440, { tunnel_paint_owned: JSON.stringify({ c: 0, p: 0, m: 0, fx: 0 }),
        tunnel_ship_paint: JSON.stringify([{ c: 4, p: 3, pc: 2, m: 5, fx: 4 }, { c: 10, m: 6 }]) });
    const cleaned = bad(`({ a: shipPaint[0], b: shipPaint[1] })`);
    check('a save wearing unowned bought parts loads without them, earned parts are kept for the live check',
        cleaned.a.c === 0 && cleaned.a.p === 0 && cleaned.a.pc === 0 && cleaned.a.m === 0 && cleaned.a.fx === 0
        && cleaned.b.c === 10 && cleaned.b.m === 6);

    // Reactive signals come from the flight: EMBER heat builds while holding, cools after.
    const heat = g(`(() => {
        phase = 'play'; holding = true;
        let t0 = gtime;
        for (let i = 1; i <= 30; i++) { gtime = t0 + i / 60; paintSignals(); }
        const hot = paintSignals().th;
        holding = false;
        for (let i = 31; i <= 150; i++) { gtime = t0 + i / 60; paintSignals(); }
        const cool = paintSignals().th;
        phase = 'title';
        return { hot, cool };
    })()`);
    check(`EMBER follows the thrust: hot after 0.5s held (${heat.hot.toFixed(2)}), cold 2s after release (${heat.cool.toFixed(2)})`,
        heat.hot > 0.8 && heat.cool < 0.1);
}

// ── The calendar day: streak, stardust, week crate, rest day ──────────────────
// Everything here calls the real dayRollover() (lifecycle.js) on a seeded save and
// reads the state it left behind - no reimplementation of its rules in the test.
// Day-independent: every seed is derived from SIM_DAY through the same UTC arithmetic
// the game uses, so this block holds on any TUNL_SIM_DAY.
{
    const dayIntAgo = n => {
        const d = new Date(SIM_NOW - n * 86400000);
        return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
    };
    const YESTERDAY = String(dayIntAgo(1)), TWO_AGO = String(dayIntAgo(2)), THREE_AGO = String(dayIntAgo(3));
    const roll = (seed, extra = '') => {
        const g = boot(956, 440, seed);
        if (extra) g(extra);
        g('dayRollover()');
        return g(`({ streak, stardust, shards, bestStreak, streakGrace, grant: dayGrant,
                     crateSize: STREAK_WEEK_SHARDS, graceMax: STREAK_GRACE_MAX,
                     lastday: localStorage.getItem('tunnel_lastday'),
                     savedStreak: +localStorage.getItem('tunnel_streak'),
                     savedDust: +localStorage.getItem('tunnel_stardust') })`);
    };

    const back = roll({ tunnel_lastday: YESTERDAY, tunnel_streak: '3', tunnel_stardust: '3' });
    check('a day after yesterday continues the streak and pays one stardust',
        back.streak === 4 && back.stardust === 4 && back.savedStreak === 4 && back.savedDust === 4
        && back.grant.dust === 1 && !back.grant.bonus && !back.grant.grace);

    const week = roll({ tunnel_lastday: YESTERDAY, tunnel_streak: '6', tunnel_stardust: '6', tunnel_shards: '100' });
    check('the 7th day in a row pays the bonus stardust, the week crate and banks a rest day',
        week.streak === 7 && week.stardust === 8 && week.shards === 100 + week.crateSize
        && week.crateSize > 0 && week.streakGrace === week.graceMax
        && week.grant.bonus && week.grant.crate === week.crateSize);

    const saved = roll({ tunnel_lastday: TWO_AGO, tunnel_streak: '9', tunnel_stardust: '9', tunnel_streak_grace: '1' });
    check('one missed day spends the banked rest day instead of resetting the streak',
        saved.streak === 10 && saved.streakGrace === 0 && saved.grant.grace && saved.stardust === 10);

    const broke = roll({ tunnel_lastday: TWO_AGO, tunnel_streak: '9', tunnel_stardust: '9', tunnel_streak_grace: '0' });
    check('a missed day with nothing banked resets the streak but never the stardust',
        broke.streak === 1 && broke.stardust === 10 && !broke.grant.grace);

    const twoMissed = roll({ tunnel_lastday: THREE_AGO, tunnel_streak: '9', tunnel_stardust: '9', tunnel_streak_grace: '1' });
    check('two missed days reset the streak and leave the rest day in the bank',
        twoMissed.streak === 1 && twoMissed.streakGrace === 1);

    const keptBest = roll({ tunnel_lastday: THREE_AGO, tunnel_streak: '9', tunnel_best_streak: '30', tunnel_stardust: '9' });
    check('bestStreak only ever grows, so an earned streak paint is never taken back',
        keptBest.bestStreak === 30 && keptBest.streak === 1);

    const g2 = boot(956, 440, { tunnel_lastday: YESTERDAY, tunnel_streak: '3', tunnel_stardust: '3' });
    const twice = g2(`(() => { dayRollover(); const after = { s: streak, d: stardust };
        dayRollover(); dayRollover();
        return { after, s: streak, d: stardust }; })()`);
    check('a second rollover on the same day grants nothing',
        twice.s === twice.after.s && twice.d === twice.after.d && twice.s === 4 && twice.d === 4);

    // The two streak paints read bestStreak, not the live streak (constants.js PAINT_COLORS).
    // The three surfaces the day feeds: the arrival card over the title, the stardust
    // wallet on the ALL SHIPS sheet and the path panel it opens. Drawn through the real
    // drawTitleScreen(), so a missing i18n key or a bad rect fails here.
    const ui = boot(956, 440, { tunnel_lastday: YESTERDAY, tunnel_streak: '6', tunnel_stardust: '6' });
    const surfaces = ui(`(() => {
        titleScreen();                       // rolls the day over and arms the card
        const carded = { grant: !!dayGrant, t: dayGrantT, week: dayGrant.bonus };
        drawTitleScreen();                   // arrival card
        showShipPicker = true; drawTitleScreen();
        const wallet = _stardustBtnRect && _stardustBtnRect.w > 0 && _stardustBtnRect.h > 0;
        showStardustPath = true; drawTitleScreen();
        const panel = _stardustPathPanelRect && _stardustPathPanelRect.w > 0;
        showStardustPath = false; showShipPicker = false;
        const goal = nextStardustGoal();
        // A player past every gate has nothing left for the card to point at.
        stardust = 99999;
        const done = nextStardustGoal();
        return { carded, wallet: !!wallet, panel: !!panel, goal, done };
    })()`);
    check('a new day arms the arrival card, and the 7th day reports its week',
        surfaces.carded.grant && surfaces.carded.t > 0 && surfaces.carded.week === true);
    check('the ALL SHIPS wallet carries a stardust tap target and opens the path panel',
        surfaces.wallet && surfaces.panel);
    check('the next goal is the first locked tier whose gate is still ahead, and nothing once every gate is met',
        surfaces.goal && surfaces.goal.gate > 6 && surfaces.done === null);

    // HOW IT WORKS (Settings): the legend draws in every language inside the screen, its
    // stardust row opens the stardust path on top, and taps outside peel the layers off one
    // at a time. Real drawTitleScreen() and onDown(), so a missing key or a dead rect fails.
    const hiw = ui(`(() => {
        const r = { fits: [], openPath: false, backToHiw: false, closed: false };
        titleT = 10; dayGrantT = 0;
        for (const code of LANG_ORDER) {
            setLang(code);
            showSettings = true; showCurrencyInfo = true; drawTitleScreen();
            const p = _currencyInfoPanelRect, s = _hiwStardustRect;
            if (!(p && s && p.x >= 0 && p.y >= 0 && p.x + p.w <= W && p.y + p.h <= H
                  && s.x >= p.x && s.x + s.w <= p.x + p.w + 1)) r.fits.push(code);
        }
        setLang('en');
        drawTitleScreen();
        const s = _hiwStardustRect;
        onDown({ clientX: s.x + s.w / 2, clientY: s.y + s.h / 2, pointerId: 1 });
        r.openPath = showStardustPath && showCurrencyInfo;
        drawTitleScreen();
        onDown({ clientX: 2, clientY: 2, pointerId: 1 });
        r.backToHiw = !showStardustPath && showCurrencyInfo;
        drawTitleScreen();
        onDown({ clientX: 2, clientY: 2, pointerId: 1 });
        r.closed = !showCurrencyInfo && showSettings;
        showSettings = false;
        return r;
    })()`);
    check('HOW IT WORKS draws inside the screen in every language', hiw.fits.length === 0 || (console.log('   off-screen:', hiw.fits.join(',')), false));
    check('its stardust row opens the stardust path on top, a tap outside returns to it, the next closes it',
        hiw.openPath && hiw.backToHiw && hiw.closed);

    const gp = boot(956, 440, {});
    const paints = gp(`(() => {
        const comet = [ (bestStreak = 13, paintPartOwned('c', 11)), (bestStreak = 14, paintPartOwned('c', 11)) ];
        const eclipse = [ (bestStreak = 29, paintPartOwned('c', 12)), (bestStreak = 30, paintPartOwned('c', 12)) ];
        // Two taps on an unowned cell is the buy gesture (see the paint-sheet checks above).
        bestStreak = 0; shards = 99999; activeSkin = 0;
        showShipPicker = true; showPaint = true; paintTab = 0; paintPreview = -1;
        const tapCell = i => { drawPaintSheet(); const b = _paintCellRects[i]; paintSheetTap(b.x + b.w / 2, b.y + b.h / 2); };
        tapCell(11); tapCell(11);
        return { comet, eclipse, bought: paintPartOwned('c', 11), shards };
    })()`);
    check('the streak paints unlock exactly at their streak and can never be bought',
        paints.comet[0] === false && paints.comet[1] === true
        && paints.eclipse[0] === false && paints.eclipse[1] === true
        && paints.bought === false && paints.shards === 99999);
}

// ── Approach wind: the swell is timed to the mouth ─────────────────────────
// Catches: approachStart() predicting the mouth at the wrong time (a changed camera ease,
// APPROACH_LIP or PX without the formula following, so the wind peaks early or is still
// rising when it is cut), and approachWindEnter() firing twice or not at all. Real
// startPlay()/update(); only the two audio hooks are replaced by recorders.
{
    const res = [[956, 440], [812, 375], [956, 600]].map(([w, h]) => {
        const g = boot(w, h);
        g(AUTOPILOT);
        g(`_windRec = { mouthSec: -1, enters: [] }; _simT = 0;
           approachWindOn = (ramp, mouthSec) => { _windRec.mouthSec = mouthSec; };
           approachWindEnter = () => { _windRec.enters.push(_simT); };`);
        g('startPlay()');
        return g(`(() => {
            for (let i = 0; i < 60 * 20 && approachLeft > 0; i++) {
                shieldCount = 9; hullScratches = HULL_SCRATCHES; _pilot(); _simT += 1 / 60; update(1 / 60);
            }
            return _windRec;
        })()`);
    });
    check(`the approach wind is cut once per run, when the mouth reaches the ship (predicted within a frame: ${
        res.map(r => (r.enters[0] - r.mouthSec).toFixed(3) + 's').join(', ')})`,
        res.every(r => r.enters.length === 1 && r.mouthSec > 1.3 && Math.abs(r.enters[0] - r.mouthSec) <= 1.5 / 60));
}

// ── Hazard graze chain (update.js trackGraze, constants.js GRAZE_*) ─────────
// Catches: paying on entry instead of on the way out (a graze that ends in a hit pays),
// a zone as wide as the wall window or none at all, the chain not climbing inside
// GRAZE_CHAIN_SEC or never expiring. Real update(); mines parked beside the ship's line,
// which is held level so only the scroll moves.
function grazePass(mines, frames = 90, setup = '') {
    const g = quietCave();
    return g(`(() => {
        ${setup}
        const y0 = py;
        for (const [ahead, clearPR] of ${JSON.stringify(mines)})
            mines.push({ wx: scrollX + PX + ahead, baseY: y0 - (PR + MINE_R + PR * clearPR), phase: 0, bobAmp: 0 });
        const b0 = bonusScore, n0 = runNearMisses;
        let chainMax = 0;
        for (let i = 0; i < ${frames} && phase === 'play'; i++) {
            py = y0; vy = 0; holding = false; update(1 / 60);
            chainMax = Math.max(chainMax, grazeChain);
        }
        return { pts: bonusScore - b0, n: runNearMisses - n0, chainMax, P: GRAZE_PTS, phase, shieldCount,
                 chainSec: GRAZE_CHAIN_SEC, spd: scrollSpd() };
    })()`);
}
{
    const one = grazePass([[80, 0.5]]);
    check(`a mine passed half a ship radius clear pays one graze (${one.pts} pts, ${one.n} close)`,
        one.pts === one.P && one.n === 1 && one.chainMax === 1);
    const far = grazePass([[80, 1.5]]);
    check('a mine passed 1.5 ship radii clear pays nothing', far.pts === 0 && far.n === 0);
    const two = grazePass([[80, 0.5], [140, 0.4]]);
    check(`two grazes inside the chain window climb to x2 (${two.pts} pts = 1x + 2x)`,
        two.pts === 3 * two.P && two.chainMax === 2);
    const gap = Math.ceil(one.spd * (one.chainSec + 0.6));
    const apart = grazePass([[80, 0.5], [80 + gap, 0.5]], Math.ceil((one.chainSec + 1.6) * 60));
    check(`two grazes further apart than GRAZE_CHAIN_SEC each pay 1x (${apart.pts} pts)`,
        apart.pts === 2 * apart.P && apart.chainMax === 1);
    const hit = grazePass([[80, -1.2]], 90, 'shieldCount = 1;');
    check('a shield-absorbed hit pays no graze on the way out', hit.pts === 0 && hit.n === 0 && hit.shieldCount === 0);
}

// ── Music follows the flight plan (audio.js bgmSetSector) ───────────────────
// Catches: a sector step firing twice, never or off the boundary, a run not resetting the
// track to sector 0, or a per-boundary build-and-drop coming back (removed 2026-09-25).
// Real startPlay()/update(); only the audio hook is replaced by a recorder.
{
    const g = boot();
    g(AUTOPILOT);
    g(`_musRec = [];
       bgmSetSector = (k, now) => { _musRec.push({ k, now: !!now, wx: scrollX + PX }); };`);
    g('startPlay()');
    const r = g(`(() => {
        const endWx = sectorStartWx(5) + 200;
        for (let i = 0; i < 60 * 120 && (scrollX + PX < endWx || approachLeft > 0); i++) {
            shieldCount = 9; hullScratches = HULL_SCRATCHES; _pilot(); update(1 / 60);
        }
        return { rec: _musRec, starts: [2, 3, 4, 5].map(sectorStartWx), step: scrollSpd(scrollX) / 60 * 3,
                 build: typeof bgmSectorBuild, buildSec: typeof MUSIC_BUILD_SEC };
    })()`);
    const first = r.rec[0];
    check('startPlay resets the music to sector 0 at once', first && first.k === 0 && first.now);
    const hits = [2, 3, 4, 5].map((k, i) => {
        const e = r.rec.filter(x => x.k === k);
        return e.length === 1 && !e[0].now && e[0].wx >= r.starts[i] && e[0].wx - r.starts[i] < r.step;
    });
    check('every sector from 2 steps the music once, on its boundary', hits.every(Boolean));
    check('no per-boundary build-and-drop (lowpass dip + riser) is back',
        r.build === 'undefined' && r.buildSec === 'undefined');
}

// ── Frenzy, the star (constants.js FRENZY_* doc, systems.js frenzy*, update.js) ──
// Catches: the meter filling in the safe opening, a miss or a hazard coin not costing (or a
// warp's miss costing), a chicane coin or a portal paying the wrong amount, the star not
// starting at its cost or not escalating it, a starred ship dying to a mine / crystal /
// boulder / shell or the wall, a star spending the shield or a scratch, a hazard coin
// hurting inside a star, the clock running inside a warp, a star starting inside one, and
// the end not granting HIT_INVULN_SEC. Real update() and checkCoinCollection(); coins and
// hazards are parked on the ship's line, which is held level.
const FZ_HOLD = 'py = y0; vy = 0; holding = false; update(1 / 60);';
function fzCave(setup = '') {
    const g = quietCave(true);
    g(`y0 = py; frenzyMeter = 0; frenzyCost = FRENZY_FIRST_COST; frenzyTime = 0; frenzyPending = false;
       runFrenzies = 0; ${setup}`);
    return g;
}
function fzCoin(g, type, ahead = 0, arr = 'coins') {
    g(`${arr}.push({ wx: scrollX + PX + ${ahead}, y: y0, collected: false, type: '${type}', fade: 1.0 })`);
}
{
    // before SAFE_START_WX nothing moves the meter
    const early = boot();
    early(AUTOPILOT);
    early('startPlay()');
    early(`for (let i = 0; i < 60 * 30 && (approachLeft > 0 || startRamp < 1 || scrollX < 1200); i++) { shieldCount = 9; _pilot(); update(1 / 60); }`);
    early(`y0 = py; coins.push({ wx: scrollX + PX, y: py, collected: false, type: 'gold', fade: 1.0 }); ${FZ_HOLD}`);
    check('a coin in the safe opening does not fill the star meter', early('scrollX < SAFE_START_WX && frenzyMeter === 0'));

    let g = fzCave();
    fzCoin(g, 'gold'); g(FZ_HOLD);
    fzCoin(g, 'blue'); g(FZ_HOLD);
    fzCoin(g, 'gold', 0, 'chicaneCoins'); g(FZ_HOLD);
    check(`gold +1, a power-up +1, chicane gold +FRENZY_CHICANE_FILL (meter ${g('frenzyMeter')})`,
        g('frenzyMeter') === 2 + g('FRENZY_CHICANE_FILL'));
    fzCoin(g, 'poison'); g(FZ_HOLD);
    check(`touching poison costs FRENZY_HAZARD_COIN_COST (meter ${g('frenzyMeter')})`,
        g('frenzyMeter') === 2 + g('FRENZY_CHICANE_FILL') - g('FRENZY_HAZARD_COIN_COST'));
    // a coin that scrolls past uncollected: parked above the ship's line, out of reach
    g('frenzyMeter = 3');
    g(`coins.push({ wx: scrollX + PX + 30, y: y0 - H * 0.3, collected: false, type: 'gold', fade: 1.0 });
       for (let i = 0; i < 40; i++) { ${FZ_HOLD} }`);
    check(`a good coin scrolling past uncollected costs FRENZY_MISS_COST (meter ${g('frenzyMeter')})`,
        g('frenzyMeter') === 3 - g('FRENZY_MISS_COST'));
    g(`frenzyMeter = 3; warpTime = 5; warpMax = 5;
       coins.push({ wx: scrollX + PX + 30, y: y0 - H * 0.3, collected: false, type: 'blue', fade: 1.0 });
       for (let i = 0; i < 20; i++) { ${FZ_HOLD} } warpTime = 0;`);
    check('a coin missed during a warp costs nothing', g('frenzyMeter') === 3);
    g('frenzyMeter = 0; triggerWarp(1); warpTime = 0;');
    const centre = g('frenzyMeter');
    g('frenzyMeter = 0; triggerWarp(0); warpTime = 0;');
    check(`a portal pays FRENZY_PORTAL_MAX dead centre, FRENZY_PORTAL_MIN on the rim (${centre} / ${g('frenzyMeter')})`,
        centre === g('FRENZY_PORTAL_MAX') && g('frenzyMeter') === g('FRENZY_PORTAL_MIN'));

    // reaching the cost starts the star and escalates the next one
    g = fzCave();
    g('frenzyMeter = frenzyCost - 1');
    fzCoin(g, 'gold'); g(FZ_HOLD); g(FZ_HOLD);
    const charging = g('frenzyChargeT > 0 && frenzyTime === 0');
    g(`for (let i = 0; i < 60 && frenzyTime === 0; i++) { ${FZ_HOLD} }`);
    check(`a full meter charges for FRENZY_CHARGE_SEC, then starts a star (${g('frenzyTime').toFixed(2)}s, next costs ${g('frenzyCost')})`,
        charging && g('frenzyTime') > g('FRENZY_SEC') - 0.1 && g('runFrenzies') === 1 && g('frenzyMeter') === 0
        && g('frenzyCost') === Math.round(g('FRENZY_FIRST_COST * FRENZY_COST_MUL')));

    // inside a star every hazard shatters and pays; the shield and the hull are untouched
    const smash = (setup, label) => {
        const s = fzCave(`frenzyTime = 2; shieldCount = 1; ${setup}`);
        const r = s(`(() => { const b0 = bonusScore, h0 = hullScratches;
            for (let i = 0; i < 12 && phase === 'play'; i++) { ${FZ_HOLD} }
            return { phase, pts: bonusScore - b0, shield: shieldCount, hull: hullScratches - h0, invuln: invulnT,
                     mines: mines.length, boulders: boulders.length, shots: cannonShots.length,
                     dying: stalactites.filter(x => x.dying).length }; })()`);
        return r;
    };
    let r = smash(`mines.push({ wx: scrollX + PX + 2 + scrollSpd() * 0.06, baseY: y0, phase: 0, bobAmp: 0 });`);
    check(`a starred ship flies through a mine: survives, mine gone, +BULLET_HIT_PTS.mine (${r.pts})`,
        r.phase === 'play' && r.mines === 0 && r.pts >= g('BULLET_HIT_PTS.mine') && r.shield === 1);
    r = smash(`cannonShots.push({ wx: scrollX + PX + 6, y: y0, vx: 0, vy: 0 });`);
    check(`... through a cannon shot (+${r.pts})`, r.phase === 'play' && r.shots === 0 && r.pts >= g('BULLET_HIT_PTS.shot'));
    r = smash(`{ const b = boundsAt(scrollX + PX);
        stalactites.push({ wx: scrollX + PX + 4, isTop: true, length: (y0 - b.top) + PR * 2, width: PR * 3, fade: 1.0, dying: false }); }`);
    check(`... through a crystal (+${r.pts})`, r.phase === 'play' && r.dying === 1 && r.pts >= g('BULLET_HIT_PTS.stal'));
    // a real island from deeper in the cave, moved onto the ship's line
    const bg = fzCave();
    bg(`for (let i = 0; i < 60 * 90 && !boulders.length; i++) { shieldCount = 9; hullScratches = HULL_SCRATCHES; _pilot(); update(1 / 60); }`);
    if (bg('boulders.length > 0')) {
        const rb = bg(`(() => { const bo = boulders[0];
            stalactites = []; mines = []; cannonShots = []; coins = []; chicaneCoins = []; portals = []; boulders = [bo];
            { const _b = boundsAt(scrollX + PX); y0 = (_b.top + _b.bot) / 2; }
            bo.wx = scrollX + PX + 4; bo.y = y0; frenzyTime = 2; shieldCount = 0; invulnT = 0; wallGraceT = 0;
            const b0 = bonusScore;
            for (let i = 0; i < 12 && phase === 'play'; i++) { ${FZ_HOLD} }
            return { phase, n: boulders.length, pts: bonusScore - b0 }; })()`);
        check(`... through a boulder island (+${rb.pts})`, rb.phase === 'play' && rb.n === 0 && rb.pts >= g('BULLET_HIT_PTS.boulder'));
    } else check('a boulder showed up to test the star against', false);
    // control: the same mine without a star is fatal, so the branch above is what saved it
    const ctl = fzCave(`shieldCount = 0; mines.push({ wx: scrollX + PX + 2 + scrollSpd() * 0.06, baseY: y0, phase: 0, bobAmp: 0 });`);
    ctl(`for (let i = 0; i < 12 && phase === 'play'; i++) { ${FZ_HOLD} }`);
    check('control: the same mine without a star ends the run', ctl('phase') === 'dead');

    // the wall clamps instead of scratching
    const wg = fzCave('frenzyTime = 2; shieldCount = 0;');
    const wr = wg(`(() => { const h0 = hullScratches; const b = boundsAt(scrollX + PX);
        for (let i = 0; i < 20 && phase === 'play'; i++) { py = b.top - PR; vy = -MAX_VY; holding = true; update(1 / 60); }
        return { phase, lost: h0 - hullScratches, inside: py >= boundsAt(scrollX + PX).top }; })()`);
    check('a starred ship grinds along the wall: no scratch, clamped inside', wr.phase === 'play' && wr.lost === 0 && wr.inside);

    // a hazard coin inside a star shatters harmlessly
    const pg = fzCave('frenzyTime = 2; runCoins = 20;');
    fzCoin(pg, 'poison'); pg(FZ_HOLD);
    fzCoin(pg, 'drain'); pg(FZ_HOLD);
    check(`poison and drain inside a star cost nothing (runCoins ${pg('runCoins')}, meter ${pg('frenzyMeter')})`,
        pg('runCoins') === 20 && pg('frenzyMeter') === 0 && pg('coins.every(c => c.collected)'));

    // a warp pauses a running star and holds back one that fills inside it
    const w = fzCave('frenzyTime = 1.5; warpTime = 1.0; warpMax = 1.0;');
    w(`for (let i = 0; i < 30; i++) { ${FZ_HOLD} }`);
    check(`a star's clock stands still inside a warp (${w('frenzyTime').toFixed(2)}s left)`, Math.abs(w('frenzyTime') - 1.5) < 1e-9);
    const wp = fzCave('warpTime = 1.0; warpMax = 1.0; frenzyMeter = frenzyCost - 1;');
    fzCoin(wp, 'blue'); wp(FZ_HOLD); wp(FZ_HOLD);   // collected after this frame's star check, judged on the next
    const heldIn = wp('frenzyTime === 0 && frenzyPending');
    wp(`for (let i = 0; i < 120 && frenzyTime === 0; i++) { ${FZ_HOLD} }`);
    check('a star that fills inside a warp waits for the warp to end, then starts', heldIn && wp('frenzyTime > 0 && warpTime === 0'));

    // a smash holds the frame (hit-stop), a chain of smashes inside FRENZY_HITSTOP_GAP holds it once
    const hs = fzCave(`frenzyTime = 2; mines.push({ wx: scrollX + PX + 2, baseY: y0, phase: 0, bobAmp: 0 },
                                                    { wx: scrollX + PX + 2 + scrollSpd() * 0.06, baseY: y0, phase: 0, bobAmp: 0 });`);
    const hr = hs(`(() => { ${FZ_HOLD}
        const held = frenzyHitStopT > 0, sx0 = scrollX, g0 = gtime, ft0 = frenzyTime;
        update(1 / 60);
        const frozen = scrollX === sx0 && gtime === g0 && frenzyTime === ft0;
        let stops = 1, was = frenzyHitStopT > 0;
        for (let i = 0; i < 14; i++) { ${FZ_HOLD} if (frenzyHitStopT > 0 && !was) stops++; was = frenzyHitStopT > 0; }
        return { held, frozen, stops, mines: mines.length, phase }; })()`);
    check(`a star's smash holds the frame for FRENZY_HITSTOP_SEC, a chain holds it once (${hr.stops} stop)`,
        hr.held && hr.frozen && hr.stops === 1 && hr.mines === 0 && hr.phase === 'play');

    // the end grants HIT_INVULN_SEC
    const e = fzCave('frenzyTime = 0.05; invulnT = 0;');
    e(`for (let i = 0; i < 6; i++) { ${FZ_HOLD} }`);
    check(`a star's end grants HIT_INVULN_SEC (${e('invulnT').toFixed(2)}s)`, e('frenzyTime') === 0 && e('invulnT') > e('HIT_INVULN_SEC') - 0.1);
}

// ── The star's music (audio.js bgmSetFrenzy, FZ_MUS_*) ──
// Catches: the play track not pausing for a star, the excerpt not starting at FZ_MUS_START,
// the D-major pad playing under it, the track not coming back at the star's end or coming
// back from the top instead of the bar it was held at, and a death inside a star fading the
// excerpt out politely (and bringing the track back) instead of collapsing it into the
// song's ending. The real audio.js runs against a recording stand-in for the AudioContext
// whose ramps land at once; its clock only moves when the test sets it.
const FAKE_AC = `(() => {
    const param = v => ({ value: v, setValueAtTime(x) { this.value = x; }, linearRampToValueAtTime(x) { this.value = x; },
        exponentialRampToValueAtTime(x) { this.value = x; }, setTargetAtTime(x) { this.value = x; },
        setValueCurveAtTime(c) { this.value = c[c.length - 1]; }, cancelScheduledValues() {}, cancelAndHoldAtTime() {} });
    const node = () => new Proxy({ connect() {}, disconnect() {},
        start(t, off) { this.started = [t || 0, off || 0]; }, stop() { this.stopped = true; } },
        { get: (o, k) => (k in o ? o[k] : typeof k === 'string' ? (o[k] = param(1)) : undefined) });
    const buf = (ch, len, sr) => { const d = [...Array(ch)].map(() => new Float32Array(len));
        return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: c => d[c] }; };
    _ac = new Proxy({ currentTime: 0, sampleRate: 44100, state: 'running', destination: {}, createBuffer: buf },
        { get: (o, k) => (k in o ? o[k] : () => node()) });
    _master = node(); _musicBus = node();
    musicOn = true; fxOn = true;
    _bgmBuf = { duration: BGM_LOOP_END }; _bgmOutroBuf = { duration: 10 }; _fzMusBuf = { duration: 21.5 };
    _bgmActive = true; _playBgmBuffer();
})()`;
{
    const g = fzCave(`${FAKE_AC}; bed0 = _bgmNode; _ac.currentTime = 20; frenzyMeter = frenzyCost;`);
    g(`for (let i = 0; i < 120 && frenzyTime === 0; i++) { ${FZ_HOLD} }`);
    const on = g(`({ star: frenzyTime > 0, bedOff: _bgmNode === null && bed0.stopped === true && _bgmGain.gain.value < 0.001,
                    start: _fzMus && _fzMus.src.started[1], pad: _fzPad !== null })`);
    check(`a star pauses the play track and plays the excerpt from FZ_MUS_START, no pad under it (from ${on.start}s)`,
        on.star && on.bedOff && on.start === g('FZ_MUS_START') && !on.pad);

    g(`_ac.currentTime = 24; for (let i = 0; i < 600 && frenzyTime > 0; i++) { ${FZ_HOLD} }`);
    const off = g(`({ ended: frenzyTime === 0, fz: _fzMus === null, at: _bgmNode && _bgmNode.started[1], gain: _bgmGain.gain.value })`);
    const bars = (off.at - g('BGM_LOOP_START')) / g('BGM_BAR');
    check(`a star's end brings the play track back on the bar it was held at (${off.at && off.at.toFixed(3)}s, held at 20s)`,
        off.ended && off.fz && Math.abs(bars - Math.round(bars)) < 1e-9 && Math.abs(off.at - 20) <= g('BGM_BAR') / 2
        && off.gain === g('BGM_GAIN'));

    g(`_ac.currentTime = 40; frenzyMeter = frenzyCost; for (let i = 0; i < 120 && frenzyTime === 0; i++) { ${FZ_HOLD} }
       fz0 = _fzMus; shieldCount = 0; invulnT = 0; rewardedAdReady = false; die(true);`);
    const d = g(`({ had: !!fz0, gone: _fzMus === null, collapsed: fz0 && fz0.lp.frequency.value === DEATH_MUSIC_HZ,
                   bed: _bgmNode === null, outro: _outroNode !== null })`);
    check('a death inside a star collapses the excerpt into the song\'s ending, the track stays down',
        d.had && d.gone && d.collapsed && d.bed && d.outro);
}

if (failed) { console.log(`\n${failed} check(s) failed.`); process.exit(1); }
console.log('\nThe real game runs headless and every simulated rule holds.');
