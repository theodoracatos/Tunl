#!/usr/bin/env node
// Zero-dependency check on the triangle-circle collision geometry CLAUDE.md calls
// out as load-bearing ("Accurate triangle-circle collision (not AABB) ... would
// make invisible collisions at the edges"): src/systems.js's ptSeg2 (point-to-
// segment squared distance) and inTri (point-in-triangle test). Both are fully
// self-contained (no globals besides Math), so they're extracted straight out of
// the source by name and run in a bare sandbox -- no canvas, no game state.
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const systemsSrc = fs.readFileSync(path.join(__dirname, 'src', 'systems.js'), 'utf8');

function extractFn(src, name) {
    const start = src.indexOf(`function ${name}(`);
    if (start === -1) throw new Error(`function ${name} not found in src/systems.js`);
    let depth = 0, i = src.indexOf('{', start);
    const bodyStart = i;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(start, i + 1);
}

const sandbox = { Math, console };
vm.createContext(sandbox);
vm.runInContext(extractFn(systemsSrc, 'ptSeg2'), sandbox, { filename: 'ptSeg2' });
vm.runInContext(extractFn(systemsSrc, 'inTri'),  sandbox, { filename: 'inTri' });
// stalFallY needs a handful of game globals; stub them so the drop geometry can be
// exercised without a canvas or a live run. `corridor` is what the test moves around.
sandbox.FALL_SPAN = 250;
sandbox.scrollX   = 0;
sandbox.corridor  = 300;
vm.runInContext('function boundsAt(wx) { return { top: 0, bot: corridor }; }', sandbox, { filename: 'boundsAtStub' });
vm.runInContext(extractFn(systemsSrc, 'stalFallY'), sandbox, { filename: 'stalFallY' });
const { ptSeg2, inTri, stalFallY } = sandbox;
// Tip position the draw loop and stalHit both compute: wall root + length + drop.
const tipY = (s) => boundsAtTop() + s.length + stalFallY(s);
const boundsAtTop = () => 0;

let failed = false;
function check(name, cond) {
    if (cond) {
        console.log(`✓ ${name}`);
    } else {
        failed = true;
        console.error(`✗ ${name}`);
    }
}

// ── ptSeg2: squared distance from a point to a segment ──────────────────────
{
    check('ptSeg2: point exactly on the segment is 0',
        ptSeg2(5, 0, 0, 0, 10, 0) === 0);
    check('ptSeg2: perpendicular distance to the segment interior',
        Math.abs(ptSeg2(5, 3, 0, 0, 10, 0) - 9) < 1e-9);
    check('ptSeg2: clamps to the nearest endpoint past either end (not the infinite line)',
        Math.abs(ptSeg2(-5, 0, 0, 0, 10, 0) - 25) < 1e-9 &&
        Math.abs(ptSeg2(15, 0, 0, 0, 10, 0) - 25) < 1e-9);
    check('ptSeg2: degenerate segment (a === b) falls back to point-to-point distance',
        Math.abs(ptSeg2(3, 4, 0, 0, 0, 0) - 25) < 1e-9);
    check('ptSeg2: symmetric under swapping the segment endpoints',
        Math.abs(ptSeg2(5, 3, 0, 0, 10, 0) - ptSeg2(5, 3, 10, 0, 0, 0)) < 1e-9);
}

// ── inTri: point-in-triangle test ────────────────────────────────────────────
{
    // A simple right triangle: (0,0), (10,0), (0,10).
    const tri = [0, 0, 10, 0, 0, 10];
    check('inTri: centroid is inside', inTri(3, 3, ...tri));
    check('inTri: a point clearly outside (past the hypotenuse) is rejected', !inTri(8, 8, ...tri));
    check('inTri: a point clearly outside (negative quadrant) is rejected', !inTri(-1, -1, ...tri));
    check('inTri: each vertex counts as inside (closed test, no gap at the corners)',
        inTri(0, 0, ...tri) && inTri(10, 0, ...tri) && inTri(0, 10, ...tri));
    check('inTri: a point on an edge counts as inside (no seam between adjoining triangles)',
        inTri(5, 0, ...tri) && inTri(0, 5, ...tri));
    check('inTri: winding order does not matter (CW and CCW agree)',
        inTri(3, 3, 0, 0, 10, 0, 0, 10) === inTri(3, 3, 0, 0, 0, 10, 10, 0));

    // A thin sliver triangle like a stalactite: tall and narrow, matching the
    // hw/length shape stalHit builds (ax,ay)-(bx2,by2) base, (tx,ty) tip.
    const sliver = [-5, 0, 5, 0, 0, 100];
    check('sliver triangle: near the wide base is inside', inTri(0, 2, ...sliver));
    check('sliver triangle: near the tip is inside', inTri(0, 98, ...sliver));
    check('sliver triangle: outside the slanted edge is rejected', !inTri(4.9, 50, ...sliver));
    check('sliver triangle: past the tip (beyond the apex) is rejected', !inTri(0, 101, ...sliver));
}

// -- Falling stalactite drop geometry (systems.js stalFallY) --------------------
// CLAUDE.md: a detached falling stalactite "falls the full corridor until the tip
// meets the far wall (becomes a floor spike - the dodge is unambiguously 'go over
// it')". The travel distance therefore has to track the LIVE corridor, not a value
// frozen at detach: gapBonusVisual, deep chambers and _halfGap all keep moving the
// floor after a spike lets go. A frozen distance left 5 of 33 spikes hanging in
// mid-air in a measured run, by up to 3.8 player diameters.
{
    const spike = { falls: true, detached: true, detachScrollX: 0, length: 80, wx: 0 };
    const land = (corridorAtDetach, corridorAtLanding) => {
        sandbox.corridor = corridorAtDetach;
        sandbox.scrollX  = 0;
        stalFallY(spike);                       // a frame mid-flight, at the old width
        sandbox.corridor = corridorAtLanding;
        sandbox.scrollX  = sandbox.FALL_SPAN;   // t = 1
        return corridorAtLanding - tipY(spike); // 0 = tip flush with the floor
    };

    sandbox.corridor = 300; sandbox.scrollX = 0;
    check('undetached spike has no drop offset',
        stalFallY({ falls: true, detached: false, detachScrollX: 0, length: 80, wx: 0 }) === 0 &&
        stalFallY({ falls: false, detached: true, detachScrollX: 0, length: 80, wx: 0 }) === 0);

    check('tip lands flush on the floor in a steady corridor', Math.abs(land(300, 300)) < 1e-9);
    check('tip lands flush even if the corridor WIDENED after detach (the mid-air bug)',
        Math.abs(land(300, 460)) < 1e-9);
    check('tip lands flush, never through the wall, if the corridor NARROWED after detach',
        Math.abs(land(300, 210)) < 1e-9);

    // Ease-in over the span: monotone, starts at 0, never overshoots the floor.
    sandbox.corridor = 300;
    let mono = true, prevOff = -1, overshoot = false;
    for (let i = 0; i <= 40; i++) {
        sandbox.scrollX = (i / 40) * sandbox.FALL_SPAN;
        const off = stalFallY(spike);
        if (off < prevOff - 1e-9) mono = false;
        if (tipY(spike) > sandbox.corridor + 1e-9) overshoot = true;
        prevOff = off;
    }
    sandbox.scrollX = 0;
    check('drop is monotone across the span and never overshoots the floor',
        mono && !overshoot && stalFallY(spike) === 0);

    // Held after landing: keeps tracking the floor rather than drifting off it.
    sandbox.scrollX = sandbox.FALL_SPAN * 4;
    let held = true;
    for (const c of [300, 360, 420, 260, 500]) { sandbox.corridor = c; if (Math.abs(c - tipY(spike)) > 1e-9) held = false; }
    check('a landed spike stays on the floor as the corridor keeps moving', held);
}

// ── Drawn 3D ship vs the PR hitbox (CLAUDE.md "3/4 side view") ────────
// The flat hull's envelope rule is span +-0.98r / nose +1.40r: the picture must sit just
// inside the circle it is collided with, and never reach past what update.js's forward
// probe covers. The 3D hull has to hold the same line at every roll and every wing sweep,
// including the blue-coin brake (wings forward) and the portal barrel roll (any roll).
{
    const drawSrc = fs.readFileSync(path.join(__dirname, 'src', 'draw.js'), 'utf8');
    const ex = name => {
        const start = drawSrc.indexOf(`function ${name}(`);
        if (start === -1) throw new Error(`function ${name} not found in src/draw.js`);
        let depth = 0, i = drawSrc.indexOf('{', start);
        for (; i < drawSrc.length; i++) {
            if (drawSrc[i] === '{') depth++;
            else if (drawSrc[i] === '}') { depth--; if (depth === 0) break; }
        }
        return drawSrc.slice(start, i + 1);
    };
    const consts = fs.readFileSync(path.join(__dirname, 'src', 'constants.js'), 'utf8');
    const num = name => Number(consts.match(new RegExp(`${name}\\s*=\\s*(-?[0-9.]+)`))[1]);
    const s3 = { Math, console };
    vm.createContext(s3);
    vm.runInContext(`const SHIP_NOZZLE_Y = ${num('SHIP_NOZZLE_Y')};`, s3);
    vm.runInContext(`const SHIP3D_SWEEP_MAX = ${num('SHIP3D_SWEEP_MAX')}, SHIP3D_BRAKE_DEG = ${num('SHIP3D_BRAKE_DEG')};`, s3);
    vm.runInContext(drawSrc.match(/const SHIP3D_PIVOT = \[[^\]]*\];/)[0], s3);
    for (const fn of ['_ship3dFaces', '_buildShip3D', '_swingPt', 'ship3dInk']) vm.runInContext(ex(fn), s3, { filename: fn });
    const roll = num('SHIP3D_ROLL_BASE'), amp = num('SHIP3D_ROLL_AMP');
    const M = s3._buildShip3D(num('SHIP3D_FIN_SCALE'), roll);
    const sweeps = [-s3.SHIP3D_BRAKE_DEG / s3.SHIP3D_SWEEP_MAX, 0, 0.5, 1];
    let worst = 0, cover = 9, nose = 0;
    for (let a = 0; a < 360; a += 5) {
        for (const sw of sweeps) {
            const ink = s3.ship3dInk(M, a, sw);
            worst = Math.max(worst, ink.up, ink.dn);
            nose  = Math.max(nose, ink.nose);
            // Coverage is only meaningful at the rolls the ship actually flies at
            // (the barrel roll is hazard-immune and wall-clamped by construction).
            if (a >= roll - amp && a <= roll + amp) cover = Math.min(cover, ink.up, ink.dn);
        }
    }
    check(`3D hull stays inside the PR circle at every roll and sweep (worst ${worst.toFixed(2)} r)`, worst <= 1.0);
    check(`3D nose never reaches past the flat hull's 1.40 r (${nose.toFixed(2)} r)`, nose <= 1.4001);
    check(`3D hull still fills most of the circle while flying (worst ${cover.toFixed(2)} r)`, cover >= 0.60);
}

if (failed) {
    console.error('\ncollision check FAILED');
    process.exit(1);
} else {
    console.log('\nAll collision geometry invariants hold.');
}
