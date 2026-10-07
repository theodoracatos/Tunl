#!/usr/bin/env node
// Top-down hull (hangar, hero, shop, share card) generated from the 3D flight model.
//
//   node tools/gen-ship-topdown.js          dry run: prints the numbers
//   node tools/gen-ship-topdown.js --write  rewrites the generated block in src/draw.js
//                                           and the outline copy in src/share.js
//
// Why: the flat hull was hand-drawn and drifted from the 3D model every time the hull
// changed (docs/agents/ship-render.md). Here the planform IS the 3D model seen from above
// with the outer panels folded to SHIP3D_SWEEP_MAX (the top-down views always draw full
// sweep): every face is rasterised, slits under ~0.03 r are closed, and the result is cut
// into DISJOINT facets (nose, taileron, fuselage, glove, outer wing) plus two lit
// leading-edge bands. Disjoint matters: drawShip strokes every facet outline as a seam, so
// a facet hidden under another would draw its edge through the hull.
// Re-run after any change to _ship3dFaces, SHIP3D_PIVOT or SHIP3D_SWEEP_MAX, then npm test
// (test-collision.js holds the envelope and the share.js copy).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const DRAW = path.join(ROOT, 'src/draw.js'), SHARE = path.join(ROOT, 'src/share.js');
const src = fs.readFileSync(DRAW, 'utf8'), cs = fs.readFileSync(path.join(ROOT, 'src/constants.js'), 'utf8');
const fnSrc = n => { const i = src.indexOf('function ' + n + '('); let d = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); };
const num = n => Number(cs.match(new RegExp(n + '\\s*=\\s*(-?[0-9.]+)'))[1]);
const c = { Math }; vm.createContext(c);
vm.runInContext(`const SHIP_NOZZLE_X=${num('SHIP_NOZZLE_X')},SHIP_NOZZLE_Y=${num('SHIP_NOZZLE_Y')};` + src.match(/const SHIP3D_PIVOT = \[[^\]]*\];/)[0]
    + fnSrc('_ship3dFaces') + fnSrc('_swingPt') + ';this.F=_ship3dFaces();this.sp=_swingPt;this.P=SHIP3D_PIVOT;', c);
const F = c.F, SW = num('SHIP3D_SWEEP_MAX') * Math.PI / 180, cw = Math.cos(SW), sw = Math.sin(SW);
const fold = q => c.sp([q[0], q[1], 0], 1, cw, sw);

// Polygons on side +1 (y >= 0), xy only
const faces = F.map(f => ({ kind: f.kind, swing: f.swing, p: f.p.map(q => f.swing ? c.sp(q, f.swing, cw, f.swing * sw) : q) }))
    .filter(f => !f.p.every(q => q[1] < -1e-6)).map(f => ({ ...f, p: f.p.map(q => [q[0], Math.max(q[1], 0)]) }));
const glove = F.plan.glove, panel = F.plan.panel.map(fold);
const stM = src.match(/const st = (\[\[1\.40[\s\S]*?\]\])\.map\(\(s, i\) => i >= 3 \? \[s\[0\], s\[1\] \* B/);
const B = Number(src.match(/const B = ([0-9.]+), BZ/)[1]);
const st = vm.runInNewContext(stM[1]).map((s, i) => i >= 3 ? [s[0], s[1] * B] : [s[0], s[1]]);
const body = st.map(s => [s[0], s[1]]).concat(st.slice().reverse().map(s => [s[0], 0]));
const tlM = src.match(/const tl = (\[\[-0\.60[^;]*?\]\])\.map\(q => \[q\[0\], s \* q\[1\] \* ([0-9.]+)\]\)/);
const tail = vm.runInNewContext(tlM[1]).map(q => [q[0], q[1] * Number(tlM[2])]);

// Raster
const RES = 0.003, X0 = -1.15, X1 = 1.43, NX = Math.ceil((X1 - X0) / RES), NY = Math.ceil(1.0 / RES);
const inPoly = (x, y, p) => { let ins = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins; } return ins; };
const mask = polys => { const G = new Uint8Array(NX * NY); for (const p of polys) {
    const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - X0) / RES)), i1 = Math.min(NX - 1, Math.ceil((Math.max(...xs) - X0) / RES));
    const j0 = Math.max(0, Math.floor(Math.min(...ys) / RES)), j1 = Math.min(NY - 1, Math.ceil(Math.max(...ys) / RES));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (!G[j * NX + i] && inPoly(X0 + (i + 0.5) * RES, (j + 0.5) * RES, p)) G[j * NX + i] = 1;
} return G; };
const morph = (S, grow, K) => { const O = new Uint8Array(S.length); for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { let v = grow ? 0 : 1;
    outer: for (let dj = -K; dj <= K; dj++) for (let di = -K; di <= K; di++) { if (di * di + dj * dj > K * K) continue;
        const ii = i + di, jj = Math.abs(j + dj), s = ii >= 0 && ii < NX && jj < NY ? S[jj * NX + ii] : 0;
        if (grow && s) { v = 1; break outer; } if (!grow && !s) { v = 0; break outer; } }
    O[j * NX + i] = v; } return O; };
const op = (A, Bm, f) => A.map((a, k) => f(a, Bm[k]) ? 1 : 0);
const xcut = (A, f) => A.map((a, k) => a && f(X0 + ((k % NX) + 0.5) * RES) ? 1 : 0);

// Boundary of the largest region: directed cell edges, filled on the left; y < 0 counts as
// filled when the region touches the axis (the facet closes along the spine).
function trace(G) {
    const at = (i, j) => j < 0 ? (i >= 0 && i < NX && G[i]) : (i >= 0 && j < NY && i < NX && G[j * NX + i]);
    const out = new Map(), key = (i, j) => i + ',' + j;
    const edge = (i0, j0, i1, j1) => { const k = key(i0, j0); if (!out.has(k)) out.set(k, []); out.get(k).push([i1, j1]); };
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        if (!at(i, j)) continue;
        if (!at(i, j - 1)) edge(i, j, i + 1, j);
        if (!at(i + 1, j)) edge(i + 1, j, i + 1, j + 1);
        if (!at(i, j + 1)) edge(i + 1, j + 1, i, j + 1);
        if (!at(i - 1, j)) edge(i, j + 1, i, j);
    }
    // Edges are consumed, not vertices: where two cells touch only at a corner, that vertex
    // has two edges in and two out and is passed twice, and the walk takes the same-side turn
    // there so the region stays one loop. A region on the axis has an OPEN boundary (the
    // spine run is implied), so it is walked from its head. Before 2026-10-07 one edge per
    // vertex was kept and a vertex ended the walk on its second visit: the fuselage facet
    // lost everything aft of a pinch at its taileron root and closed in a diagonal from the
    // nose to x -0.64, drawing a seam through the body and the glove.
    const inDeg = new Map();
    for (const e of out.values()) for (const n of e) inDeg.set(key(n[0], n[1]), (inDeg.get(key(n[0], n[1])) || 0) + 1);
    const heads = [...out.keys()].filter(k => out.get(k).length > (inDeg.get(k) || 0));
    let best = [];
    for (const k0 of heads.concat([...out.keys()])) {
        if (!out.get(k0).length) continue;
        const loop = []; let k = k0, d = null;
        while (out.has(k) && out.get(k).length) {
            const c = k.split(',').map(Number), es = out.get(k);
            let pick = 0;
            if (d && es.length > 1) es.forEach((n, m) => { const t = d[0] * (n[1] - c[1]) - d[1] * (n[0] - c[0]),
                tb = d[0] * (es[pick][1] - c[1]) - d[1] * (es[pick][0] - c[0]); if (t > tb) pick = m; });
            const n = es.splice(pick, 1)[0];
            loop.push(c); d = [n[0] - c[0], n[1] - c[1]]; k = key(n[0], n[1]);
        }
        if (loop.length > best.length) best = loop;
    }
    return best.map(([i, j]) => [X0 + i * RES, j * RES]);
}
const dp = (P, eps) => { if (P.length < 3) return P; let dm = 0, idx = 0; const A = P[0], Bq = P[P.length - 1], L = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]) || 1e-9;
    for (let i = 1; i < P.length - 1; i++) { const d = Math.abs((Bq[0] - A[0]) * (A[1] - P[i][1]) - (A[0] - P[i][0]) * (Bq[1] - A[1])) / L; if (d > dm) { dm = d; idx = i; } }
    return dm > eps ? dp(P.slice(0, idx + 1), eps).slice(0, -1).concat(dp(P.slice(idx), eps)) : [A, Bq]; };
const r3 = v => Math.round(v * 1000) / 1000;
// Closed loop: split at the point farthest from the start, simplify both halves.
const ring = G => { const P = trace(G); if (!P.length) return [];
    let m = 0; P.forEach((q, i) => { if (Math.hypot(q[0] - P[0][0], q[1] - P[0][1]) > Math.hypot(P[m][0] - P[0][0], P[m][1] - P[0][1])) m = i; });
    const S = dp(P.slice(0, m + 1), 0.004).concat(dp(P.slice(m).concat([P[0]]), 0.004).slice(1, -1));
    return S.map(q => [r3(q[0]), -r3(q[1])]); };

const ALL = morph(morph(mask(faces.map(f => f.p)), true, 5), false, 5);
const BODY = mask([body]), GLOVE = mask([glove]), PANEL = mask([panel]), TAIL = mask([tail]);
const POD = mask(faces.filter(f => f.kind === 'pod').map(f => f.p));
const nose = xcut(ALL, x => x >= 1.02);
const gloveF = op(op(ALL, GLOVE, (a, b) => a && b), BODY, (a, b) => a && !b);
const wingF = op(op(op(ALL, PANEL, (a, b) => a && b), GLOVE, (a, b) => a && !b), BODY, (a, b) => a && !b);
const tailF = op(op(op(ALL, TAIL, (a, b) => a && b), BODY, (a, b) => a && !b), POD, (a, b) => a && !b);
let fuse = xcut(ALL, x => x < 1.02);
for (const M of [gloveF, wingF, tailF]) fuse = op(fuse, M, (a, b) => a && !b);
// Lit leading-edge bands (drawn over glove / wing): within 0.03 r inside each leading edge
const band = (M, A, Bq, w) => { const L = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]), nx = -(Bq[1] - A[1]) / L, ny = (Bq[0] - A[0]) / L;
    return M.map((m, k) => { if (!m) return 0; const x = X0 + ((k % NX) + 0.5) * RES, y = (Math.floor(k / NX) + 0.5) * RES;
        const d = Math.abs((x - A[0]) * nx + (y - A[1]) * ny); return d < w ? 1 : 0; }); };
const gRoot = glove.reduce((a, q) => q[0] > a[0] ? q : a), gi = glove.indexOf(gRoot);
const gNext = [glove[(gi + 1) % glove.length], glove[(gi - 1 + glove.length) % glove.length]].reduce((a, q) => q[1] > a[1] ? q : a);
const tipLE = fold([-0.275, 0.95]), pTip = panel.reduce((a, q) => Math.hypot(q[0] - tipLE[0], q[1] - tipLE[1]) < Math.hypot(a[0] - tipLE[0], a[1] - tipLE[1]) ? q : a);
const pi = panel.indexOf(pTip), pNext = [panel[(pi + 1) % panel.length], panel[(pi - 1 + panel.length) % panel.length]].reduce((a, q) => q[0] > a[0] ? q : a);
const gloveLE = band(gloveF, gRoot, gNext, 0.03), wingLE = band(wingF, pNext, pTip, 0.03);

const outlineTop = (() => { const o = ring(ALL); let i0 = 0; o.forEach((q, i) => { if (q[0] > o[i0][0]) i0 = i; });
    let r = o.slice(i0).concat(o.slice(0, i0)); if (r[1][1] > r[r.length - 1][1]) r = [r[0]].concat(r.slice(1).reverse());
    r = r.filter((q, i) => i === 0 || q[1] < -0.0101);   // drop the spine run, keep the nose
    r[0] = [1.40, 0]; r.push([r[r.length - 1][0], 0]); return r; })();
const facets = [
    ['nose cone', ring(nose), 0.46, -0.04], ['taileron', ring(tailF), -0.08, -0.54], ['fuselage, nacelle deck, beaver tail', ring(fuse), 0.30, -0.20],
    ['glove', ring(gloveF), 0.16, -0.32], ['glove leading edge', ring(gloveLE), 0.26, -0.22], ['outer wing (outside the glove)', ring(wingF), 0.16, -0.32],
    ['wing leading edge', ring(wingLE), 0.26, -0.22],
];
// Details for drawShip: the lit leading edge (nose to wing tip), the intake slot just inside
// the glove leading edge, the tunnel seam (body edge), the fins and the folded tip strobe.
const tipI = outlineTop.reduce((m, q, i) => q[1] < outlineTop[m][1] ? i : m, 0);
const le = outlineTop.slice(0, tipI + 1);
// Intake: the nacelle lip that juts out ahead of the glove (hull outside the body and the
// glove, forward of the wing root), eroded 0.009 r so the dark slot sits INSIDE the
// silhouette - drawShip does not clip it. It used to be a fixed 0.03 r strip laid along the
// glove leading edge on its outer side, which ran past the end of the lip and stuck out of
// the hull on both sides (2026-10-07).
const lip = morph(xcut(op(op(ALL, BODY, (a, b) => a && !b), GLOVE, (a, b) => a && !b), x => x > gNext[0] && x < 1.02), false, 3);
const intake = ring(lip);
const bodyW = x => { for (let i = 0; i < st.length - 1; i++) if (x <= st[i][0] && x >= st[i + 1][0]) return st[i][1] + (st[i + 1][1] - st[i][1]) * (st[i][0] - x) / (st[i][0] - st[i + 1][0]); return 0; };
const finM = src.match(/const zb = 0\.068 \* BZ, zt = 0\.44, yb = s \* ([0-9.]+) \* ([0-9.]+), yt = s \* ([0-9.]+) \* ([0-9.]+);/);
const fin = [r3(finM[1] * finM[2]), r3(finM[3] * finM[4])];
const T = F.tip, tip = fold([T[0], T[1]]);
const topd = { le, intake, seamY: r3(bodyW(0.35) * 0.97), fin, tip: [r3(tip[0]), r3(tip[1])] };

const lit = pts => '[' + pts.map(q => `[${q[0]},${q[1]}]`).join(',') + ']';
const wrap = (s, ind) => s.replace(/\],\[/g, '],\n' + ind + '[').split('\n').reduce((acc, part) => { const l = acc[acc.length - 1];
    if (l !== undefined && (l + part).length < 110) acc[acc.length - 1] = l + part.trimStart(); else acc.push(part); return acc; }, []).join('\n');
const block = `// BEGIN generated top-down hull: tools/gen-ship-topdown.js (do not hand-edit)
// The 3D model (_ship3dFaces) seen from above with the outer panels folded to
// SHIP3D_SWEEP_MAX. Facets are disjoint (the seam pass strokes every outline); top/bot are
// tone() amounts. Keep the facet ORDER: paint.js's WINGTIPS pattern fills 1, 5 and 6.
const SHIP_OUTLINE = (() => {
    const top = ${wrap(lit(outlineTop), '                 ')};
    return top.concat(top.slice(1, -1).reverse().map(p => [p[0], -p[1]]));
})();
const SHIP_FACETS = [
${facets.map(([n, p, t, b]) => `    { p: ${lit(p)}, top: ${t}, bot: ${b} }, // ${n}`).join('\n')}
];
const SHIP_TOPDOWN = ${JSON.stringify(topd)};
// END generated top-down hull`;

console.log(`outline ${outlineTop.length} pts, span ${Math.max(...outlineTop.map(q => -q[1]))}, tail ${outlineTop[outlineTop.length - 1][0]}`);
facets.forEach(([n, p]) => console.log(`  ${n}: ${p.length} pts`));
console.log('  details', JSON.stringify(topd).slice(0, 200));
if (!process.argv.includes('--write')) process.exit(0);
let d = src;
const a = d.indexOf('// BEGIN generated top-down hull'), e = d.indexOf('// END generated top-down hull');
if (a < 0 || e < 0) throw new Error('src/draw.js: generated-block markers missing');
d = d.slice(0, a) + block + d.slice(e + '// END generated top-down hull'.length);
fs.writeFileSync(DRAW, d);
let s = fs.readFileSync(SHARE, 'utf8');
const ta = s.indexOf('    const top = [[1.4'), tb = s.indexOf('    const pts = top.concat(', ta);
if (ta < 0 || tb < 0) throw new Error('src/share.js: _shipGlyph outline not found');
s = s.slice(0, ta) + '    const top = ' + lit(outlineTop) + ';\n' + s.slice(tb);
fs.writeFileSync(SHARE, s);
console.log('wrote src/draw.js and src/share.js');
