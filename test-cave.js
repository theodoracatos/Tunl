#!/usr/bin/env node
// Zero-dependency check on the single claim the whole daily leaderboard rests on
// (CLAUDE.md "Cross-device fairness"): given the same UTC day, every player flies the
// SAME cave, whatever their screen size. score = floor(scrollX/60) + bonusScore is
// pure world-distance, so if a narrower phone gets a different set of obstacles in the
// same stretch of world-x, the global daily ranking is comparing different games.
//
// This is a real replay, not a formula check: it loads the actual spawners and steps
// them frame by frame exactly as update() does, then compares the resulting obstacle
// lists byte for byte across device sizes. That matters, because the way this used to
// break was never in a single formula - it was the spawn horizon, the frame step, and
// one shared rng() stream interacting. A per-function unit test would have passed
// happily while the caves diverged from wx ~938.
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const SRC = ['web', 'constants', 'world', 'state', 'systems']
    .map(f => [f, fs.readFileSync(path.join(__dirname, 'src', `${f}.js`), 'utf8')]);

// The spawners touch a handful of draw/audio globals only inside code paths this
// test never reaches (pickup effects, particles); stub them so systems.js loads.
const STUBS = `
    function burst(){} function burstCoin(){} function burstStalCrack(){}
    function sfxCoin(){} function sfxSlow(){} function sfxShield(){} function sfxMagnet(){}
    function sfxBulletPickup(){} function sfxBomb(){} function sfxPoison(){} function sfxDrain(){}
    function sfxCombo(){} function sfxBulletFire(){} function sfxStalCrack(){} function sfxMineBoom(){}
    function bgmSetSlow(){} function magnetLoopOn(){} function magnetLoopOff(){}
    function sfxWarpEnter(){} function warpLoopOn(){} function warpLoopOff(){} function bgmSetWarp(){}
`;

// Mirrors lifecycle.js _seedSpawnStreams + the spawn-cursor block of startPlay().
// Kept in sync by hand; the check below fails loudly if a cursor goes missing.
const START_RUN = `
    this.startRun = function (dayInt) {
        seedRng(dayInt);
        seedDailyVariety(dayInt);
        rngStal   = makeRngStream(Math.imul(dayInt ^ 0x5741, 0x2545F491));
        rngCoin   = makeRngStream(Math.imul(dayInt ^ 0xC01D, 0x9E3779B1));
        rngMine   = makeRngStream(Math.imul(dayInt ^ 0x4D19, 0x85EBCA6B));
        rngCannon = makeRngStream(Math.imul(dayInt ^ 0xCA77, 0xC2B2AE35));
        scrollX = 0; gapBonus = 0; gapBonusVisual = 0; activeSkin = 0;
        stalactites = []; nextStalWx = 1500; nextFallWx = 7800;
        coins = []; nextCoinWx = 500; chicaneCoins = []; lastChicaneCoinWx = -Infinity;
        mines = []; nextMineWx = 1800;
        cannons = []; nextCannonWx = 6000; cannonShots = [];
        boulders = []; nextBoulderWx = 5100;
        portals = []; nextPortalWx = PORTAL_START_WX;
        nextPoisonWx = worldPxForSec(POISON_INTERVAL_SEC * (0.7 + rngCoin() * 0.6), 0);
        nextBombWx   = worldPxForSec(BOMB_INTERVAL_SEC   * (0.7 + rngCoin() * 0.6), 0);
        nextDrainWx  = worldPxForSec(DRAIN_INTERVAL_SEC  * (0.7 + rngCoin() * 0.6), 0);
        nextWarpWx   = worldPxForSec(WARP_COIN_INTERVAL_SEC * (0.7 + rngCoin() * 0.6), 0);
        lastBlueWx = 0; lastRedWx = 0; lastGreenWx = 0;
        refreshWave();
    };
    this.step = function () {
        refreshWave();
        maintainStalactites(); maintainCoins(); maintainMines();
        maintainCannons(); maintainBoulders(); maintainPortals();
        scrollX += scrollSpd() * (1 / 120);
        return scrollX;
    };
    this.snapshot = function () {
        return {
            stal:    stalactites.map(o => [o.wx, o.isTop, o.length, o.falls === true]),
            coin:    coins.map(o => [o.wx, o.y, o.type]),
            chic:    chicaneCoins.map(o => [o.wx, o.y]),
            mine:    mines.map(o => [o.wx, o.baseY, o.bobAmp]),
            cannon:  cannons.map(o => [o.wx, o.isTop]),
            boulder: boulders.map(o => [o.wx, o.y, o.r]),
            portal:  portals.map(o => [o.wx, o.y, o.r]),
        };
    };
    this.H = H; this.W = W;
`;

function makeWorld(innerWidth, innerHeight) {
    const fakeCtx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
    const fakeCanvas = { getContext: () => fakeCtx, width: 0, height: 0, style: {} };
    const store = {};
    const sandbox = {
        window: { innerWidth, innerHeight, webkit: { messageHandlers: { haptic: { postMessage() {} } } }, addEventListener() {}, devicePixelRatio: 1 },
        document: { getElementById: () => fakeCanvas, addEventListener() {}, createElement: () => fakeCanvas, documentElement: { style: {} }, body: { style: {} } },
        localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
        console, Math, Date, JSON, atob, btoa, navigator: { language: 'en' },
        performance: { now: () => 0 }, setTimeout() {},
    };
    sandbox.globalThis = sandbox; sandbox.self = sandbox;
    vm.createContext(sandbox);
    for (const [name, code] of SRC) {
        if (name === 'systems') vm.runInContext(STUBS, sandbox, { filename: 'stubs' });
        vm.runInContext(code, sandbox, { filename: `src/${name}.js` });
    }
    vm.runInContext(START_RUN, sandbox, { filename: 'export' });
    return sandbox;
}

// Everything that is NOT vertical geometry must be bit-identical; vertical positions
// scale exactly with H (the corridor is H * f(wx)), so they are compared normalised.
function normalise(snap, H) {
    const vy = v => +(v / H).toFixed(12);
    return JSON.stringify({
        stal:    snap.stal.map(([wx, t, len, f]) => [+wx.toFixed(9), t, vy(len), f]),
        coin:    snap.coin.map(([wx, y, ty]) => [+wx.toFixed(9), vy(y), ty]),
        chic:    snap.chic.map(([wx, y]) => [+wx.toFixed(9), vy(y)]),
        mine:    snap.mine.map(([wx, y, b]) => [+wx.toFixed(9), vy(y), vy(b)]),
        cannon:  snap.cannon.map(([wx, t]) => [+wx.toFixed(9), t]),
        boulder: snap.boulder.map(([wx, y, r]) => [+wx.toFixed(9), vy(y), vy(r)]),
        portal:  snap.portal.map(([wx, y, r]) => [+wx.toFixed(9), vy(y), vy(r)]),
    });
}

function replay(innerWidth, innerHeight, dayInt, untilWx) {
    const w = makeWorld(innerWidth, innerHeight);
    w.startRun(dayInt);
    const seen = { stal: [], coin: [], chic: [], mine: [], cannon: [], boulder: [], portal: [] };
    const ids = new Set();
    let x = 0, guard = 0;
    while (x < untilWx && guard++ < 2_000_000) {
        x = w.step();
        const snap = w.snapshot();
        for (const k of Object.keys(seen)) {
            for (const row of snap[k]) {
                const id = k + '|' + row[0].toFixed(6);
                if (!ids.has(id)) { ids.add(id); seen[k].push(row); }
            }
        }
    }
    for (const k of Object.keys(seen)) seen[k].sort((a, b) => a[0] - b[0]);
    return { snap: seen, H: w.H };
}

let failed = false;
function check(name, cond) {
    if (cond) console.log(`✓ ${name}`);
    else { failed = true; console.error(`✗ ${name}`); }
}

// Reference: the W cap x the height the feel was tuned at (iPhone 17 Pro Max / web).
const DEVICES = [
    ['iPhone 15',            874, 402],
    ['iPhone 12 mini',       844, 390],
    ['iPhone SE',            844, 375],
    ['Android tablet (H capped)', 956, 520],
    ['narrow Android',       700, 360],
    ['letterboxed wide',    1280, 440],
];
const DAYS = [20260911, 20260912, 20260913];
const UNTIL_WX = 30000;   // score 0-500, well past anything a player reaches

for (const day of DAYS) {
    const ref = replay(956, 440, day, UNTIL_WX);
    const counts = Object.entries(ref.snap).map(([k, v]) => `${k} ${v.length}`).join(', ');
    const refKey = normalise(ref.snap, ref.H);
    let allSame = true, firstBad = '';
    for (const [name, W, H] of DEVICES) {
        const d = replay(W, H, day, UNTIL_WX);
        if (normalise(d.snap, d.H) !== refKey) {
            allSame = false;
            if (!firstBad) {
                const diffs = Object.keys(ref.snap)
                    .filter(k => JSON.stringify(ref.snap[k].map(r => r[0])) !== JSON.stringify(d.snap[k].map(r => r[0])))
                    .join('/');
                firstBad = `${name} (${W}x${H})${diffs ? ' - ' + diffs : ''}`;
            }
        }
    }
    check(`day ${day}: cave identical on all ${DEVICES.length} device sizes (${counts})${allSame ? '' : ' - FIRST MISMATCH: ' + firstBad}`, allSame);
}

// A sanity counter-test: the guard above would also "pass" if the replay produced
// nothing at all. Make sure the reference day actually builds a populated cave.
{
    const ref = replay(956, 440, DAYS[0], UNTIL_WX);
    const n = Object.values(ref.snap).reduce((a, v) => a + v.length, 0);
    check(`reference replay is actually populated (${n} objects)`, n > 200 &&
        ref.snap.stal.length > 50 && ref.snap.coin.length > 20 &&
        ref.snap.mine.length > 10 && ref.snap.boulder.length > 0 &&
        ref.snap.portal.length > 0);
}

// ── Spawn-horizon budget ──────────────────────────────────────────────
// The ORDERING INVARIANT in constants.js SPAWN_AHEAD_* is what keeps every veto that
// inspects the stalactite array honest, and it has been broken once already in a way
// nothing caught: the retry loops (MINE_/CANNON_/BOULDER_RETRY_OFFSETS) were added
// without adding their reach to the budget, so a retried probe walked straight back
// out past the stalactite horizon and the veto it was retrying for saw an empty array.
// Measured cost before the fix: 15 of 18 boulders and 28 of 28 cannons placed blind,
// 12 boulders with a pass sealed by a stalactite and one sealed on both sides.
// The arithmetic is cheap; assert it rather than trusting a comment to stay current.
{
    const w = makeWorld(956, 440);
    const g = name => vm.runInContext(name, w);
    const REF_STAL_W = 956 * 0.030;      // placeStalW at its widest (progAt 0)
    // Widest a boulder can ever be, in reference-y px: _makeBoulderAt caps r at
    // 0.42 * halfGap, and halfGap peaks at the wx=0 onboarding widen (0.34 + 0.09),
    // wider than any deep chamber (2.1 * 0.163 = 0.342).
    const MAX_BOULDER_R_REF = 0.42 * g('_H_REF') * 0.43;
    const budget = [
        // [name, own horizon, largest retry offset, inspection radius]
        ['coins',   g('SPAWN_AHEAD_COIN'),    0,                                   REF_STAL_W + 956 * 0.009 * 2],
        ['mines',   g('SPAWN_AHEAD_MINE'),    Math.max(...g('MINE_RETRY_OFFSETS')),    300],
        ['cannons', g('SPAWN_AHEAD_CANNON'),  Math.max(...g('CANNON_RETRY_OFFSETS')),  REF_STAL_W + g('PLACE_CANNON_R')],
        ['boulder', g('SPAWN_AHEAD_BOULDER'), Math.max(...g('BOULDER_RETRY_OFFSETS')), REF_STAL_W + MAX_BOULDER_R_REF],
        // Portal placement inspects exactly the same window coinBlockedByStal already
        // does for every coin (systems.js _makePortalAt doc) - own-wall clearance
        // (PLACE_PR + PLACE_COIN_R) on each side of the widest stalactite it has to see.
        ['portal',  g('SPAWN_AHEAD_PORTAL'),  Math.max(...g('PORTAL_RETRY_OFFSETS')),   REF_STAL_W + (g('PLACE_PR') + g('PLACE_COIN_R')) * 2],
    ];
    const stalAhead = g('SPAWN_AHEAD_STAL');
    for (const [name, ahead, retry, inspect] of budget) {
        const need = ahead + retry + inspect;
        check(`${name}: horizon ${ahead} + retry ${retry} + inspect ${Math.round(inspect)} = ${Math.round(need)} <= SPAWN_AHEAD_STAL ${stalAhead}`,
            need <= stalAhead);
    }
}

// ── Boulders keep their contract ──────────────────────────────────────
// makeBoulder's whole reason to exist is "there is always a pass above AND below, so
// it asks commit-up-or-down rather than react" (CLAUDE.md). The corridor bound alone
// only guarantees that against a BARE corridor - a stalactite overlapping the rock can
// seal a pass, and that is exactly what the blind veto above was letting through.
{
    const w = makeWorld(956, 440);
    const PR         = vm.runInContext('PR', w);
    const H_TO_REF   = vm.runInContext('_H_TO_REF', w);
    const boundsBase = vm.runInContext('boundsBase', w);
    const placeStalW = vm.runInContext('placeStalW', w);
    let checked = 0, sealed = 0, worst = Infinity;
    for (const day of DAYS) {
        // snapshot() rows: stal [wx, isTop, length, falls], boulder [wx, y, r]
        const { snap } = replay(956, 440, day, 40000);
        for (const [bwx, by, br] of snap.boulder) {
            const bb = boundsBase(bwx);
            let top = bb.top, bot = bb.bot;
            for (const [swx, sTop, slen] of snap.stal) {
                if (Math.abs(swx - bwx) >= br * H_TO_REF + placeStalW(swx)) continue;
                const sb = boundsBase(swx);
                if (sTop) top = Math.max(top, sb.top + slen);
                else      bot = Math.min(bot, sb.bot - slen);
            }
            const above = ((by - br) - top) / (2 * PR), below = (bot - (by + br)) / (2 * PR);
            checked++;
            worst = Math.min(worst, Math.max(above, below));
            if (above < 0.25 && below < 0.25) sealed++;
        }
    }
    check(`every boulder keeps a pass open (${checked} boulders, ${sealed} sealed, worst best-pass ${worst.toFixed(2)} player diameters)`,
        checked > 10 && sealed === 0 && worst >= 1.0);
}

// ── Portals keep their contract ─────────────────────────────────────────
// _makePortalAt's whole flyability contract is "this exact (wx, y) point passes
// coinBlockedByStal" (systems.js doc) - re-run that same test independently against
// every portal a real replay actually placed, rather than trusting the placement
// code to have applied its own rule correctly. Also checks the drawn ring (r +
// its seeded centre jitter, both PORTAL_R_FRAC-bounded) never reaches the wall,
// since only the centre point - not the ring's visual extent - is load-bearing.
{
    const w = makeWorld(956, 440);
    const coinBlockedByStal = vm.runInContext('coinBlockedByStal', w);
    const boundsBase        = vm.runInContext('boundsBase', w);
    let checked = 0, blocked = 0, worstMargin = Infinity;
    for (const day of DAYS) {
        const { snap } = replay(956, 440, day, UNTIL_WX);
        w.startRun(day);   // coinBlockedByStal reads the live `stalactites` array
        for (const [pwx, py, pr] of snap.portal) {
            // maintainStalactites() only ever looks at its own while-condition
            // (scrollX + SPAWN_W + SPAWN_AHEAD_STAL), not at how it got there, and
            // rngStal() is a pure sequential stream - jumping scrollX straight to
            // this portal's wx and calling it once reproduces exactly the
            // stalactite set placement time saw, same as the "a background tab
            // catches up in one burst" case the real game already relies on.
            vm.runInContext(`scrollX = ${pwx}; maintainStalactites();`, w);
            checked++;
            if (coinBlockedByStal(pwx, py)) blocked++;
            const bb = boundsBase(pwx);
            const hg = (bb.bot - bb.top) / 2;
            const margin = hg - (Math.abs(py - (bb.top + bb.bot) / 2) + pr);
            worstMargin = Math.min(worstMargin, margin / hg);
        }
    }
    check(`every portal's centre independently clears coinBlockedByStal (${checked} portals, ${blocked} blocked)`,
        checked > 5 && blocked === 0);
    check(`every portal ring stays inside the corridor with margin (worst ${(worstMargin*100).toFixed(0)}% of halfGap spare)`,
        worstMargin > 0);
}

if (failed) {
    console.error('\ncave check FAILED');
    process.exit(1);
} else {
    console.log('\nThe daily cave is identical on every screen size.');
}
