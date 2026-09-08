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
const { ptSeg2, inTri } = sandbox;

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

if (failed) {
    console.error('\ncollision check FAILED');
    process.exit(1);
} else {
    console.log('\nAll collision geometry invariants hold.');
}
