#!/usr/bin/env node
// Frenzy phase 1: measure the proposed star (concept https://claude.ai/artifact/Nft1eG8rKrq2LZrnKdTRiC)
// against the real game WITHOUT changing it. Loads every src/ script but main.js into a Node vm
// (same boot as test-sim.js), flies runs with a planning pilot at four skill tiers, and replays
// each run twice on the same day and pilot seed: once plain, once with the star emulated on top.
//
// The pilot plans against the game's own geometry: every decision it forward-simulates a family
// of candidate lines with the real physics constants and checks them with the real hit tests
// (stalHit, boulderHit, the mine/shot circles, boundsAt), up to its tier's horizon. Tiers differ
// in horizon, decision rate, perception noise, safety margin and coin greed.
//
// Star emulation (no src change): the meter follows the concept's "Tank" rule; while a star runs,
// every hazard the ship overlaps is removed before update() (crystals marked dying, mines, shots
// and boulders spliced) and paid BULLET_HIT_PTS into bonusScore, poison/drain coins it touches are
// consumed without effect, and invulnT is held up so walls clamp like a warp. After the star,
// HIT_INVULN_SEC. The timer pauses during a warp; a star that fills during a warp waits for its end.
//
// Usage: node tools/frenzy-sim.js [runsPerDay=6] [days=10] [tiers=beginner,average,good,expert,pro]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');

const FILES = [...fs.readFileSync(path.join(ROOT, 'tunl.html'), 'utf8')
    .matchAll(/<script src="(src\/[^"]+\.js)"><\/script>/g)].map(m => m[1])
    .filter(f => f !== 'src/main.js');
const SRC = FILES.map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);

function fakeContext() {
    const special = {
        measureText: s => ({ width: String(s).length * 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2,
                             actualBoundingBoxLeft: 0, actualBoundingBoxRight: String(s).length * 8 }),
        createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
        createConicGradient: () => ({ addColorStop() {} }), createPattern: () => ({ setTransform() {} }),
        getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h) * 4), width: w, height: h }),
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h) * 4), width: w, height: h }),
        getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), isPointInPath: () => false,
    };
    return new Proxy({}, { get: (t, k) => (k in t ? t[k] : k in special ? special[k] : () => {}),
                           set: (t, k, v) => { t[k] = v; return true; } });
}

function boot(day, innerWidth = 956, innerHeight = 440) {
    const NOW = Date.UTC(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100, 12);
    class PinnedDate extends Date { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } }
    const ctx = fakeContext();
    const canvas = () => ({ getContext: () => ctx, width: 0, height: 0, style: {}, addEventListener() {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: innerWidth, height: innerHeight }),
        toDataURL: () => 'data:image/png;base64,', toBlob() {} });
    const store = {};
    const location = { search: '', href: 'app://tunl/', hostname: '', pathname: '/', hash: '' };
    const navigator = { language: 'en', languages: ['en'], userAgent: 'node', vibrate() {} };
    const sb = {
        window: { innerWidth, innerHeight, devicePixelRatio: 1, location, navigator,
                  webkit: { messageHandlers: { haptic: { postMessage() {} } } },
                  addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
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
    sb.globalThis = sb; sb.self = sb; sb.__starJson = process.env.STAR_JSON || '{}';
    vm.createContext(sb);
    for (const [f, code] of SRC) vm.runInContext(code, sb, { filename: f });
    vm.runInContext(HARNESS, sb, { filename: 'frenzy-harness' });
    return sb;
}

// Everything below runs inside the game's context, so it reads and writes game state directly.
const HARNESS = `
this.TIERS = {
    // delay: seconds between seeing the state and the thumb acting on it; minHold: the
    // shortest press or release a thumb makes. These two are what make the pilot human.
    beginner: { horizon: 0.50, every: 8, noise: 0.35, margin: 0.10, greed: 0.25, lookPx: 0.40, perc: 0.9,  delay: 0.30, minHold: 0.14 },
    average:  { horizon: 0.70, every: 6, noise: 0.25, margin: 0.15, greed: 0.60, lookPx: 0.55, perc: 0.6,  delay: 0.24, minHold: 0.11 },
    good:     { horizon: 0.95, every: 4, noise: 0.15, margin: 0.20, greed: 1.00, lookPx: 0.70, perc: 0.35, delay: 0.15, minHold: 0.08 },
    expert:   { horizon: 1.25, every: 3, noise: 0.08, margin: 0.25, greed: 1.40, lookPx: 0.85, perc: 0.15, delay: 0.11, minHold: 0.06 },
    pro:      { horizon: 1.40, every: 2, noise: 0.05, margin: 0.28, greed: 1.60, lookPx: 0.95, perc: 0.08, delay: 0.08, minHold: 0.05 },
};
this.STAR = Object.assign({ firstCost: 8, costMul: 1.5, sec: 4.0, chicane: 2, missCost: 1, hazardCoinCost: 2, portalMin: 1, portalMax: 3,
    countFromWx: SAFE_START_WX }, JSON.parse(this.__starJson || '{}'));

let _rs = 1;
function _rnd() { _rs |= 0; _rs = _rs + 0x6D2B79F5 | 0; let t = Math.imul(_rs ^ _rs >>> 15, 1 | _rs);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function _gauss() { return Math.sqrt(-2 * Math.log(_rnd() + 1e-12)) * Math.cos(2 * Math.PI * _rnd()); }

// Would a ship of radius r at screen-y y collide at a future moment t seconds from now?
// Temporarily moves the clocks the hit tests read (scrollX, gtime, py) and restores them.
let _hz = null;      // hazards near the planned path, rebuilt per decision (with perception noise)
function _hitAt(y, t, r, star) {
    const sx0 = scrollX, g0 = gtime, py0 = py, spd = scrollSpd();
    const sxF = sx0 + spd * t;
    let hit = false;
    for (const dx of [-r * 0.7, 0, r * 0.7]) {
        const b = boundsAt(sxF + PX + dx);
        if (y - r < b.top || y + r > b.bot || y - r < 0 || y + r > H) { hit = true; break; }
    }
    if (!hit && !star) {
        scrollX = sxF; gtime = g0 + t; py = y;
        try {
            for (const h of _hz) {
                if (h.k === 's') { if (!h.o.dying && stalHit(h.o, r)) { hit = true; break; } }
                else if (h.k === 'm') {
                    const m = h.o, mx = m.wx - scrollX, my = m.baseY + m.bobAmp * Math.sin(gtime * 1.8 + m.phase) + h.jy;
                    const dx = PX - mx, dy = y - my, rr = r + MINE_R;
                    if (dx * dx + dy * dy < rr * rr) { hit = true; break; }
                } else if (h.k === 'c') {
                    const s = h.o, cx = s.wx + s.vx * t - scrollX, cy = s.y + s.vy * t + h.jy;
                    const dx = PX - cx, dy = y - cy, rr = r + CANNON_SHOT_R;
                    if (dx * dx + dy * dy < rr * rr) { hit = true; break; }
                } else if (h.k === 'b') {
                    const bo = h.o; if (boulderHit(bo, PX - (bo.wx - scrollX), y - bo.y - h.jy, r)) { hit = true; break; }
                }
            }
        } finally { scrollX = sx0; gtime = g0; py = py0; }
    }
    return hit;
}

// Candidate: track y = centre + f * halfGap (or a coin's y until it is passed), PD like the
// test-sim autopilot. Returns { t: first collision time or Infinity, coins, poison }.
function _simLine(cand, T, r, star) {
    let y = py, v = vy, t = 0, coins = 0, bad = 0;
    const dt = 1 / 30, spd = scrollSpd(), taken = new Set();
    while (t < T) {
        const wx = scrollX + PX + spd * t;
        let target;
        if (cand.coin && cand.coin.wx > wx - 4) target = cand.coin.y;
        else { const b = boundsAt(wx + spd * 0.15); target = (b.top + b.bot) / 2 + cand.f * (b.bot - b.top) / 2; }
        const hold = (y - target) + 0.18 * v > 0;
        const v0 = v;
        v += (hold ? -THRUST + GRAVITY : GRAVITY) * dt;
        v = Math.max(-MAX_VY, Math.min(MAX_VY, v));
        y += (v0 + v) * 0.5 * dt; t += dt;
        if (_hitAt(y, t, r, star)) return { t, coins, bad };
        for (const c of _coinsAhead) {
            if (taken.has(c)) continue;
            const cx = c.wx - (scrollX + spd * t);
            if (Math.abs(cx - PX) < c.rr && Math.abs(y - c.y) < c.rr) { taken.add(c); if (c.bad) bad++; else coins++; }
        }
    }
    return { t: Infinity, coins, bad };
}

let _coinsAhead = [], _plan = { f: 0, coin: null }, _tick = 0;
this.pilotDecide = function (P, star) {
    const r = PR * (1 + P.margin);
    const look = W * P.lookPx, spd = scrollSpd();
    // Perception: hazards beyond lookPx of the screen are unseen; positions carry noise.
    _hz = [];
    const inView = wx => wx - scrollX > PX - 120 && wx - scrollX < PX + look;
    for (const s of stalactites) if (inView(s.wx)) _hz.push({ k: 's', o: s });
    for (const m of mines) if (inView(m.wx)) _hz.push({ k: 'm', o: m, jy: _gauss() * P.perc * PR });
    for (const s of cannonShots) if (inView(s.wx)) _hz.push({ k: 'c', o: s, jy: _gauss() * P.perc * PR });
    for (const b of boulders) if (inView(b.wx)) _hz.push({ k: 'b', o: b, jy: _gauss() * P.perc * PR * 0.5 });
    _coinsAhead = [];
    const hitR = COIN_HIT_R + PR;
    for (const arr of [coins, chicaneCoins]) for (const c of arr) {
        if (c.collected || !inView(c.wx) || c.wx < scrollX + PX) continue;
        _coinsAhead.push({ wx: c.wx, y: c.y, rr: hitR * 0.8, bad: c.type === 'poison' || c.type === 'drain' });
    }
    const T = P.horizon;
    const cands = [];
    for (const f of [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75]) cands.push({ f, coin: null });
    for (const c of _coinsAhead) if (!c.bad && (c.wx - scrollX - PX) < spd * T) cands.push({ f: 0, coin: c });
    let best = null, bestS = -Infinity;
    for (const c of cands) {
        const res = _simLine(c, T, r, star);
        let s = res.t < Infinity ? -10000 + res.t * 1000 : 0;
        s += P.greed * res.coins - 3 * res.bad - 0.4 * Math.abs(c.f) - 0.25 * Math.abs(c.f - _plan.f) * (c.coin ? 0 : 1);
        if (c.coin === _plan.coin && c.coin) s += 0.2;
        if (s > bestS) { bestS = s; best = c; }
    }
    _plan = { f: best.f + _gauss() * P.noise * 0.5, coin: best.coin };
};
// The thumb: the hold decision is computed from the state it SAW delay seconds ago
// (extrapolated with the planned controller, as a human would), and a press or release
// lasts at least minHold.
let _q = [], _lastToggle = 0, _simT = 0;
this.pilotAct = function (P, dt) {
    _simT += dt;
    if (approachLeft > 0 || startRamp < 1) { holding = (py - H / 2) + 0.18 * vy > 0; _q = []; return; }
    const spd = scrollSpd(), wx = scrollX + PX;
    let target;
    if (_plan.coin && _plan.coin.wx > wx - 4) target = _plan.coin.y;
    else { const b = boundsAt(wx + spd * 0.15); target = (b.top + b.bot) / 2 + _plan.f * (b.bot - b.top) / 2; }
    _q.push((py - target) + 0.18 * vy > 0);
    const lag = Math.round(P.delay * 60);
    const want = _q.length > lag ? _q[_q.length - 1 - lag] : holding;
    if (_q.length > 120) _q.splice(0, _q.length - 120);
    if (want !== holding && _simT - _lastToggle >= P.minHold) { holding = want; _lastToggle = _simT; }
};

// ── star bookkeeping ──
let S = null;
function _cPR() {
    return activeSkin === 2 ? PR * masteryLerp(2, 0.78, 0.72) : activeSkin === 1 ? PR * masteryLerp(1, 1.10, 1.06)
         : activeSkin === 7 ? PR * masteryLerp(7, 1.06, 1.03) : PR;
}
this.starReset = function (on) {
    S = { on, meter: 0, cost: STAR.firstCost, t: 0, pending: false, stars: 0, starTime: 0, smashPts: 0, smashes: 0,
          firstStarScore: -1, firstStarSec: -1, seen: new Set(), counted: new Set(), got: 0, missed: 0, portals: 0,
          portalFill: 0, vac: 0, flight: 0, meterMax: 0, bonusFromStar: 0, realStarTime: 0 };
    const tw = triggerWarp;
    if (!this._twWrapped) { this._twWrapped = true;
        triggerWarp = function (a) { if (S) { S.portals++; if (scrollX >= STAR.countFromWx && S.t <= 0) { const f = STAR.portalMin + (STAR.portalMax - STAR.portalMin) * a; S.meter += f; S.portalFill += f; } } return tw(a); }; }
};
function _curScore() { return Math.floor(scrollX / 60) + bonusScore; }
this.starPre = function (dt) {
    if (!S.on || S.t <= 0) return;
    const r = _cPR();
    let pts = 0;
    for (const s of stalactites) if (!s.dying && stalHit(s, r)) { s.dying = true; s.fade = 1; pts += BULLET_HIT_PTS.stal; S.smashes++; }
    for (let i = mines.length - 1; i >= 0; i--) { const m = mines[i], sx = m.wx - scrollX, my = m.baseY + m.bobAmp * Math.sin(gtime * 1.8 + m.phase);
        const dx = PX - sx, dy = py - my, rr = r + MINE_R; if (dx * dx + dy * dy < rr * rr) { mines.splice(i, 1); pts += BULLET_HIT_PTS.mine; S.smashes++; } }
    for (let i = cannonShots.length - 1; i >= 0; i--) { const s = cannonShots[i], dx = PX - (s.wx - scrollX), dy = py - s.y, rr = r + CANNON_SHOT_R;
        if (dx * dx + dy * dy < rr * rr) { cannonShots.splice(i, 1); pts += BULLET_HIT_PTS.shot; S.smashes++; } }
    for (let i = boulders.length - 1; i >= 0; i--) { const bo = boulders[i];
        if (boulderHit(bo, PX - (bo.wx - scrollX), py - bo.y, r)) { boulders.splice(i, 1); pts += BULLET_HIT_PTS.boulder; S.smashes++; } }
    const hitR = COIN_HIT_R + PR;
    for (const c of coins) if (!c.collected && (c.type === 'poison' || c.type === 'drain')) {
        const dx = PX - (c.wx - scrollX), dy = py - c.y; if (dx * dx + dy * dy < hitR * hitR) { c.collected = true; c.fade = 0; S.seen.add(c); } }
    bonusScore += pts; S.smashPts += pts;
    invulnT = Math.max(invulnT, 0.05);
};
this.starPost = function (dt) {
    if (phase !== 'play' || approachLeft > 0) return;
    const live = scrollX >= STAR.countFromWx;
    if (live) S.flight += dt;
    // collections
    for (const arr of [coins, chicaneCoins]) for (const c of arr) {
        if (!c.collected || S.seen.has(c)) continue;
        S.seen.add(c);
        if (!live) continue;
        const bad = c.type === 'poison' || c.type === 'drain';
        if (warpTime > 0 && c.type === 'gold') S.vac++;
        if (bad) { if (S.t <= 0) S.meter -= STAR.hazardCoinCost; }
        else { S.got++; if (S.t <= 0) S.meter += arr === chicaneCoins ? STAR.chicane : 1; }
    }
    // misses: a good coin that has scrolled past the ship uncollected
    const hitR = COIN_HIT_R + PR;
    for (const arr of [coins, chicaneCoins]) for (const c of arr) {
        if (c.collected || S.counted.has(c) || c.wx - scrollX > PX - hitR - 6) continue;
        S.counted.add(c);
        if (!live || c.type === 'poison' || c.type === 'drain') continue;
        S.missed++;
        if (warpTime <= 0 && S.t <= 0) S.meter -= STAR.missCost;
    }
    S.meter = Math.max(0, S.meter);
    S.meterMax = Math.max(S.meterMax, S.meter);
    if (typeof frenzyTime !== 'undefined' && frenzyTime > 0 && warpTime <= 0) S.realStarTime += dt;   // the game's own star (phase 2+)
    if (!S.on) {
        // still count how often a star WOULD have filled, without granting it
        if (S.meter >= S.cost) { S.stars++; if (S.firstStarScore < 0) { S.firstStarScore = _curScore(); S.firstStarSec = S.flight; }
            S.meter = 0; S.cost = Math.round(S.cost * STAR.costMul); }
        return;
    }
    if (S.t > 0) {
        if (warpTime <= 0) { S.t -= dt; S.starTime += dt; }
        if (S.t <= 0) { S.t = 0; invulnT = Math.max(invulnT, HIT_INVULN_SEC); }
        return;
    }
    if (S.meter >= S.cost) {
        if (warpTime > 0) { S.pending = true; return; }
        S.t = STAR.sec; S.stars++; S.meter = 0; S.cost = Math.round(S.cost * STAR.costMul); S.pending = false;
        if (S.firstStarScore < 0) { S.firstStarScore = _curScore(); S.firstStarSec = S.flight; }
    }
};
this.starActive = () => S && S.on && S.t > 0;

this.runOne = function (tierName, seed, starOn, maxSec) {
    const P = TIERS[tierName];
    _rs = seed; _plan = { f: 0, coin: null }; _tick = 0; _q = []; _lastToggle = 0; _simT = 0;
    shieldCount = 0; rewardedAdReady = false;
    // A pilot past the tap tutor (approach.js): no waiting city, no practice flight.
    best = Math.max(best, TUTOR_BEST_MAX);
    startPlay();
    starReset(starOn);
    let frames = 0; const dt = 1 / 60, maxF = maxSec * 60;
    while (phase === 'play' && frames < maxF) {
        if (approachLeft <= 0 && startRamp >= 1 && (_tick++ % P.every) === 0) pilotDecide(P, starActive());
        pilotAct(P, dt);
        starPre(dt);
        update(dt);
        starPost(dt);
        frames++;
    }
    const score = Math.max(0, Math.floor(scrollX / 60) + bonusScore);
    return { score, dist: Math.floor(scrollX / 60), sector: sectorAt(scrollX), cause: phase === 'play' ? 'timeout' : deathCause,
             flight: S.flight, got: S.got, missed: S.missed, portals: S.portals, portalFill: S.portalFill, vac: S.vac,
             stars: S.stars, starTime: S.starTime, smashPts: S.smashPts, smashes: S.smashes,
             firstStarScore: S.firstStarScore, firstStarSec: S.firstStarSec, meterMax: S.meterMax,
             realStars: typeof runFrenzies !== 'undefined' ? runFrenzies : 0, realStarTime: S.realStarTime, realSmashes: typeof runFrenzySmashes !== 'undefined' ? runFrenzySmashes : 0 };
};
`;

// ── driver ──
const runsPerDay = +(process.argv[2] || 6), nDays = +(process.argv[3] || 10);
const tiers = (process.argv[4] || 'beginner,average,good,expert,pro').split(',');
const MAX_SEC = +(process.env.MAX_SEC || 300);
const days = [];
for (let i = 0; i < nDays; i++) { const d = new Date(Date.UTC(2026, 8, 1 + i * 3)); days.push(+d.toISOString().slice(0, 10).replace(/-/g, '')); }

const out = { meta: { runsPerDay, days, maxSec: MAX_SEC, when: new Date().toISOString() }, runs: [] };
const t0 = Date.now();
for (const day of days) {
    const g = boot(day);
    for (const tier of tiers) for (let k = 0; k < runsPerDay; k++) {
        const seed = (day * 131 + k * 7919 + tier.length * 17) | 0;
        const base = g.runOne(tier, seed, false, MAX_SEC);
        const star = process.env.BASE_ONLY ? null : g.runOne(tier, seed, true, MAX_SEC);
        out.runs.push({ day, tier, k, base, star });
    }
    process.stderr.write(`day ${day} done (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
}
const file = process.env.OUT || path.join(ROOT, 'tools', 'frenzy-sim-out.json');
fs.writeFileSync(file, JSON.stringify(out));
console.log('wrote', file, out.runs.length, 'run pairs');
