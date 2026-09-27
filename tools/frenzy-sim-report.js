#!/usr/bin/env node
// Summarise tools/frenzy-sim.js output: per tier, plain vs. star-emulated runs of the same
// day and pilot seed. Usage: node tools/frenzy-sim-report.js [file]
const path = require('path');
const r = require(path.resolve(process.argv[2] || path.join(__dirname, 'frenzy-sim-out.json')));
const med = a => { const s = [...a].sort((p, q) => p - q); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const pct = (a, q) => { const s = [...a].sort((p, q2) => p - q2); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : NaN; };
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
const tiers = [...new Set(r.runs.map(x => x.tier))];
const rows = {};
for (const t of tiers) {
    const xs = r.runs.filter(x => x.tier === t && x.star);
    const b = xs.map(x => x.base), s = xs.map(x => x.star);
    const withStar = s.filter(x => x.stars > 0);
    const dayBest = (arr, k) => { const m = {}; xs.forEach((x, i) => { m[x.day] = Math.max(m[x.day] || 0, arr[i][k]); }); return Object.values(m); };
    rows[t] = {
        n: xs.length,
        scoreBase: med(b.map(x => x.score)), scoreStar: med(s.map(x => x.score)),
        p90Base: pct(b.map(x => x.score), 0.9), p90Star: pct(s.map(x => x.score), 0.9),
        flightBase: +med(b.map(x => x.flight)).toFixed(1), flightStar: +med(s.map(x => x.flight)).toFixed(1),
        runsWithStarPct: Math.round(100 * withStar.length / xs.length),
        starsPerRun: +(sum(s, x => x.stars) / xs.length).toFixed(2),
        firstStarScore: med(withStar.map(x => x.firstStarScore)),
        firstStarSec: +med(withStar.map(x => x.firstStarSec)).toFixed(1),
        dutyPct: +(100 * sum(s, x => x.starTime) / Math.max(1e-9, sum(s, x => x.flight))).toFixed(1),
        smashSharePct: +(100 * sum(s, x => x.smashPts) / Math.max(1, sum(s, x => x.score))).toFixed(1),
        collectPct: Math.round(100 * sum(b, x => x.got) / Math.max(1, sum(b, x => x.got + x.missed))),
        dayBestBase: med(dayBest(b, 'score')), dayBestStar: med(dayBest(s, 'score')),
        pairedGainPct: Math.round(100 * (med(xs.map(x => (x.star.score + 1) / (x.base.score + 1))) - 1)),
    };
}
console.table(rows);
if (process.argv.includes('--json')) console.log(JSON.stringify(rows));
