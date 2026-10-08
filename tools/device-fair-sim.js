#!/usr/bin/env node
// Cross-device fairness: does a screen size score more or less than the 956x440 reference?
// Written for the iPhone Duo (2026-10-08, docs/agents/fairness.md "Screen sizes"). Boots the
// real game (every src/ script but main.js, as the iOS app: isWeb() false) at each viewport in
// a Node vm and flies a time-based pilot model on the same days with the same pilot seeds on
// every size. The pilot works in seconds and in fractions of the corridor / multiples of the
// drawn ship radius, so it is the same player on every screen - only the game's own
// screen-dependent geometry (W-derived PR/MINE_R, scrollSpd's W/600, the H cap) differs.
//
// It plans every 0.1 s over 21 corridor lines, probing each with the game's own hit tests
// (boundsAt, stalHit, boulderHit, the mine/shot circles) at future scrollX, and steers with a
// reaction delay. It ignores coins and power-ups. Tiers (delay, lookahead, margin, noise):
// beginner is set to the real players' median run (~22, project memory of the 09-12 red team).
//
// Output: per tier and size the paired score ratio vs 956x440 (geometric mean of per-day mean
// log ratios, days being the independent unit) with a day-bootstrap 95% interval.
//
// Usage: node tools/device-fair-sim.js [days=12] [runsPerDay=8] [sizes=874x402,951x669,678x466,667x375]
//        [tiers=beginner,average,expert]   - each size x tier runs as its own process, in parallel.
// Traps: best < TUTOR_BEST_MAX turns the tap tutor on (the pilot's hold does nothing), so every
// run seeds best = 300; a bang-bang controller with a reaction delay must lead by that delay
// (the kd + delay term) or it oscillates into the walls and every tier dies alike at ~15.
const fs = require('fs'), path = require('path'), vm = require('vm');
const { execFile } = require('child_process');
const ROOT = path.join(__dirname, '..');
const REF = '956x440';
const DAY0 = Date.UTC(2026, 8, 21, 12);

function fakeContext() {
    const special = {
        measureText: s => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
        createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
        createConicGradient: () => ({ addColorStop() {} }), createPattern: () => ({}),
        getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h) * 4), width: w, height: h }),
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h) * 4), width: w, height: h }),
        getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }), isPointInPath: () => false,
    };
    return new Proxy({}, { get: (t, k) => (k in t ? t[k] : k in special ? special[k] : () => {}),
                           set: (t, k, v) => { t[k] = v; return true; } });
}

function boot(NOW, innerWidth, innerHeight) {
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
        console: { log() {}, warn() {}, error() {}, info() {} }, Math, Date: PinnedDate, JSON, atob, btoa, Promise,
        URLSearchParams, TextEncoder, TextDecoder, Uint8Array, Uint8ClampedArray, Float32Array, Int16Array, ArrayBuffer,
    };
    sb.globalThis = sb; sb.self = sb;
    vm.createContext(sb);
    for (const [f, code] of SRC) vm.runInContext(code, sb, { filename: f });
    return code => vm.runInContext(code, sb);
}

// Skill tiers, all screen-independent: reaction delay and lookahead in seconds, aim noise
// as a fraction of the half-gap, safety margin in multiples of the drawn ship radius.
const TIERS = {
    beginner: { delay: 0.24, look: 0.55, margin: 1.00, noise: 0.30, kd: 0.10 },
    average:  { delay: 0.17, look: 0.80, margin: 1.15, noise: 0.18, kd: 0.13 },
    expert:   { delay: 0.10, look: 1.20, margin: 1.40, noise: 0.06, kd: 0.17 },
};
const PILOT = T => `
var _P = ${JSON.stringify(T)};
var _pf = 0, _pnoise = 0, _pTarget = 0, _pNextPlan = 0, _pQueue = [], _pTime = 0, _pRng = 1;
function _prand() { _pRng = (_pRng * 1103515245 + 12345) & 0x7fffffff; return _pRng / 0x7fffffff; }
function _pgauss() { return Math.sqrt(-2 * Math.log(_prand() + 1e-9)) * Math.cos(2 * Math.PI * _prand()); }
function _pHitAt(dxw, y, r, tAhead) {
    const sx0 = scrollX, py0 = py;
    scrollX = sx0 + dxw; py = y;
    let hit = false;
    const b = boundsAt(scrollX + PX);
    if (y - r < b.top || y + r > b.bot || y - r < 0 || y + r > H) hit = true;
    if (!hit) for (const s of stalactites) { if (!s.dying && stalHit(s, r)) { hit = true; break; } }
    if (!hit) for (const m of mines) {
        const sx = m.wx - scrollX; if (sx < -80 || sx > W + 80) continue;
        const my = m.baseY + m.bobAmp * Math.sin((gtime + tAhead) * 1.8 + m.phase);
        const dx = PX - sx, dy = y - my;
        if (dx * dx + dy * dy < (r + MINE_R) * (r + MINE_R)) { hit = true; break; }
    }
    if (!hit) for (const bo of boulders) {
        const sx = bo.wx - scrollX; if (sx < -bo.hl - 40 || sx > W + bo.hl + 40) continue;
        if (boulderHit(bo, PX - sx, y - bo.y, r)) { hit = true; break; }
    }
    if (!hit) for (const s of cannonShots) {
        const sx = s.wx + (s.vx || 0) * tAhead - scrollX, sy = s.y + (s.vy || 0) * tAhead;
        const dx = PX - sx, dy = y - sy;
        if (dx * dx + dy * dy < (r + CANNON_SHOT_R) * (r + CANNON_SHOT_R)) { hit = true; break; }
    }
    scrollX = sx0; py = py0;
    return hit;
}
function _pLineY(dxw, f) { const b = boundsAt(scrollX + PX + dxw); return (b.top + b.bot) / 2 + f * (b.bot - b.top) / 2; }
function _pPlan() {
    const spd = scrollSpd(), r = PR * _P.margin, maxDx = W - PX - 4;
    let best = null;
    for (let i = -10; i <= 10; i++) {
        const f = i * 0.085;
        let cost = 0;
        for (let t = 0.05; t <= _P.look + 1e-9; t += 0.05) {
            const dxw = Math.min(spd * t, maxDx);
            if (_pHitAt(dxw, _pLineY(dxw, f), r, t)) cost += 1 + (_P.look - t);
            if (dxw >= maxDx) break;
        }
        cost += 0.15 * Math.abs(f - _pf) + 0.05 * Math.abs(f);
        if (!best || cost < best.cost) best = { f, cost };
    }
    _pf = best.f;
}
function _pStep(dt) {
    _pTime += dt;
    let hold;
    if (approachLeft > 0 || startRamp < 1) {
        hold = (py - H / 2) + 0.18 * vy > 0;
        if (tutorWaiting()) hold = true;
    } else {
        if (_pTime >= _pNextPlan) { _pPlan(); _pNextPlan = _pTime + 0.1;
            _pnoise = 0.7 * _pnoise + 0.3 * _pgauss() * _P.noise; }
        const dxw = Math.min(scrollSpd() * 0.2, W - PX - 4);
        const b = boundsAt(scrollX + PX + dxw);
        const target = (b.top + b.bot) / 2 + (_pf + _pnoise) * (b.bot - b.top) / 2;
        hold = (py - target) + (_P.kd + _P.delay) * vy > 0;
    }
    _pQueue.push([_pTime + _P.delay, hold]);
    while (_pQueue.length > 1 && _pQueue[1][0] <= _pTime) _pQueue.shift();
    if (_pQueue[0][0] <= _pTime) holding = _pQueue[0][1];
}
`;


const DT = 1 / 60, MAX_SEC = 900;
function worker(innerWidth, innerHeight, tier, days, runsPerDay) {
    const FILES = [...fs.readFileSync(path.join(ROOT, 'tunl.html'), 'utf8')
        .matchAll(/<script src="(src\/[^"]+\.js)"><\/script>/g)].map(m => m[1]).filter(f => f !== 'src/main.js');
    SRC = FILES.map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
    const T = TIERS[tier];
    const out = [];
    for (let d = 0; d < days; d++) {
        for (let r = 0; r < runsPerDay; r++) {
            const g = boot(DAY0 + d * 86400000, innerWidth, innerHeight);
            g(PILOT(T));
            g(`_pRng = ${100003 + d * 1009 + r * 7919 + 17};`);
            g('best = 300; localStorage.setItem(TUTOR_PRAC_PASSED_KEY, "1");');
            g('startPlay()');
            if (g('tutorOn')) throw new Error('tutor still on');
            g(`for (let i = 0; i < ${MAX_SEC * 60} && phase === 'play'; i++) { _pStep(${DT}); update(${DT}); }`);
            out.push({ day: d, run: r, score: g('Math.max(0, Math.floor(scrollX / 60) + bonusScore)') });
        }
    }
    process.stdout.write(JSON.stringify(out));
}
let SRC;

function runWorker(size, tier, days, runs) {
    const [w, h] = size.split('x');
    return new Promise((res, rej) => execFile(process.execPath, [__filename, '--worker', w, h, tier, days, runs],
        { maxBuffer: 64 << 20 }, (err, stdout) => err ? rej(err) : res(JSON.parse(stdout))));
}

async function main() {
    const [days = 12, runs = 8, sizesArg, tiersArg] = process.argv.slice(2);
    const sizes = (sizesArg || '874x402,951x669,678x466,667x375').split(',');
    const tiers = (tiersArg || 'beginner,average,expert').split(',');
    const jobs = {};
    for (const t of tiers) for (const s of [REF, ...sizes]) jobs[`${s}-${t}`] = runWorker(s, t, +days, +runs);
    const res = {};
    for (const k of Object.keys(jobs)) res[k] = await jobs[k];
    let seed = 7;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
    const median = a => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
    console.log(`${days} days x ${runs} runs; ratio = score vs ${REF}, 95% interval by day bootstrap`);
    for (const t of tiers) {
        const ref = res[`${REF}-${t}`];
        console.log(`${t.padEnd(9)} ${REF.padEnd(8)} median ${median(ref.map(r => r.score))}`);
        for (const s of sizes) {
            const r = res[`${s}-${t}`], byDay = {};
            r.forEach((x, i) => (byDay[x.day] = byDay[x.day] || []).push(Math.log((x.score + 1) / (ref[i].score + 1))));
            const dm = Object.values(byDay).map(mean);
            const bs = [];
            for (let k = 0; k < 4000; k++) bs.push(mean(dm.map(() => dm[Math.floor(rnd() * dm.length)])));
            bs.sort((a, b) => a - b);
            console.log(`${t.padEnd(9)} ${s.padEnd(8)} median ${String(median(r.map(x => x.score))).padEnd(5)} ` +
                `x${Math.exp(mean(dm)).toFixed(2)}  [${Math.exp(bs[100]).toFixed(2)} - ${Math.exp(bs[3899]).toFixed(2)}]`);
        }
    }
}

if (process.argv[2] === '--worker') worker(+process.argv[3], +process.argv[4], process.argv[5], +process.argv[6], +process.argv[7]);
else main().catch(e => { console.error(e); process.exit(1); });
