// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── test-share.js ─────────────────────────────────────────────────────
// Proves the card's QR encoder (src/share.js, byte mode / ECC M / versions 1-9) by
// REVERSING it, not by eyeballing the picture: read the format bits back out of the
// finished matrix, un-mask it, walk the same zigzag to recover the codewords,
// de-interleave the blocks and check every block's Reed-Solomon syndromes. All-zero
// syndromes mean a real decoder accepts the codeword; then the payload is decoded from
// the data bits and compared against the input string.
//
// This matters because a wrong QR fails silently: it still looks exactly like a QR, on
// a card that has already been shared. Run: node test-share.js
//
// Only the QR block is loaded (the card renderer needs a canvas); the slice is taken
// between the two section banners so a moved function cannot leave this testing a stale
// copy - if the banners move, this file fails loudly instead of passing vacuously.
const fs = require('fs');

const src = fs.readFileSync(__dirname + '/src/share.js', 'utf8');
const a = src.indexOf('// ── QR code');
const b = src.indexOf('// ── Card renderer');
if (a < 0 || b < 0 || b <= a) {
    console.error('FAIL: could not slice the QR block out of src/share.js (banners moved?)');
    process.exit(1);
}
const mod = {};
new Function('exports', src.slice(a, b) + '\nObject.assign(exports, { _qrMatrix, _QR_SPEC, _QR_FMT, _QR_MASK, _qrEc, _qrMul });')(mod);
const { _qrMatrix, _QR_SPEC, _QR_FMT, _QR_MASK, _qrMul } = mod;

let failures = 0;
function check(name, cond, detail) {
    if (cond) return;
    failures++;
    console.error(`FAIL: ${name}${detail ? ' -- ' + detail : ''}`);
}

// Reverse the encoder and hand back what a decoder would see.
function decode(q, text) {
    const { n, m, res, ver } = q;

    // 1. Format bits: read both copies, confirm they agree and name a known level-M mask.
    const readFmt = vertical => {
        let f = 0;
        for (let i = 0; i < 15; i++) {
            let bit;
            if (vertical) {
                if (i < 6)      bit = m[i][8];
                else if (i < 8) bit = m[i + 1][8];
                else            bit = m[n - 15 + i][8];
            } else {
                if (i < 8)      bit = m[8][n - i - 1];
                else if (i < 9) bit = m[8][15 - i];
                else            bit = m[8][14 - i];
            }
            f |= bit << i;
        }
        return f;
    };
    const f1 = readFmt(true), f2 = readFmt(false);
    check('format bit copies agree', f1 === f2, `${f1.toString(16)} vs ${f2.toString(16)}`);
    const msk = _QR_FMT.indexOf(f1);
    check('format bits name a level-M mask', msk >= 0, `0x${f1.toString(16)}`);
    if (msk < 0) return null;

    // 2. Un-mask and re-read the data modules in placement order.
    const bits = [];
    let dir = -1, y = n - 1;
    for (let x = n - 1; x > 0; x -= 2) {
        if (x === 6) x--;
        for (;;) {
            for (let k = 0; k < 2; k++) {
                const cx = x - k;
                if (res[y][cx]) continue;
                bits.push(m[y][cx] ^ (_QR_MASK[msk](cx, y) ? 1 : 0));
            }
            y += dir;
            if (y < 0 || y >= n) { y -= dir; dir = -dir; break; }
        }
    }
    const words = [];
    for (let i = 0; i + 7 < bits.length; i += 8) {
        let v = 0;
        for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
        words.push(v);
    }

    // 3. De-interleave into blocks and verify each block's syndromes.
    const [dcTotal, ecLen, spec] = _QR_SPEC[ver];
    const lens = [];
    for (const [cnt, len] of spec) for (let i = 0; i < cnt; i++) lens.push(len);
    const nb = lens.length, maxLen = Math.max(...lens);
    const data = lens.map(() => []), ecs = lens.map(() => []);
    let p = 0;
    for (let i = 0; i < maxLen; i++) for (let bI = 0; bI < nb; bI++) {
        if (i < lens[bI]) data[bI].push(words[p++]);
    }
    for (let i = 0; i < ecLen; i++) for (let bI = 0; bI < nb; bI++) ecs[bI].push(words[p++]);
    check('interleaved stream length', p === dcTotal + ecLen * nb, `${p} vs ${dcTotal + ecLen * nb}`);

    let exp = new Uint8Array(512), log = new Uint8Array(256), x2 = 1;
    for (let i = 0; i < 255; i++) { exp[i] = x2; log[x2] = i; x2 <<= 1; if (x2 & 0x100) x2 ^= 0x11d; }
    for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
    for (let bI = 0; bI < nb; bI++) {
        const code = data[bI].concat(ecs[bI]);
        let bad = 0;
        for (let s = 0; s < ecLen; s++) {
            let acc = 0;
            for (const cw of code) acc = _qrMul(acc, exp[s]) ^ cw;   // Horner at alpha^s
            if (acc !== 0) bad++;
        }
        check(`block ${bI} Reed-Solomon syndromes are zero`, bad === 0, `${bad}/${ecLen} non-zero`);
    }

    // 4. Payload: mode, length, bytes.
    const flat = [];
    for (let bI = 0; bI < nb; bI++) for (const w of data[bI]) flat.push(w);
    check('mode is byte (4)', (flat[0] >> 4) === 4, `got ${flat[0] >> 4}`);
    const len = ((flat[0] & 0x0f) << 4) | (flat[1] >> 4);
    check('declared length matches', len === text.length, `${len} vs ${text.length}`);
    let out = '';
    for (let i = 0; i < len; i++) out += String.fromCharCode(((flat[1 + i] & 0x0f) << 4) | (flat[2 + i] >> 4));
    check('payload round-trips', out === text, out.slice(0, 40));
    return out;
}

// Structural checks a scanner relies on before it ever gets to the data.
function structure(q) {
    const { n, m, ver } = q;
    check('module count matches version', n === 17 + 4 * ver, `${n} for v${ver}`);
    const finderOk = (ox, oy) => {
        for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 7; dx++) {
            const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
            if (m[oy + dy][ox + dx] !== (d === 2 ? 0 : 1)) return false;
        }
        return true;
    };
    check('finder top-left',  finderOk(0, 0));
    check('finder top-right', finderOk(n - 7, 0));
    check('finder bottom-left', finderOk(0, n - 7));
    let timing = true;
    for (let i = 8; i < n - 8; i++) {
        if (m[6][i] !== (i % 2 === 0 ? 1 : 0)) timing = false;
        if (m[i][6] !== (i % 2 === 0 ? 1 : 0)) timing = false;
    }
    check('timing patterns alternate', timing);
    check('dark module is set', m[n - 8][8] === 1);
}

// The real payloads: shareRunUrl(true) is the link without the ghost. These are the
// exact shapes the card encodes, at both ends of the plausible length range.
const cases = [
    'flytunl.ch',
    'https://flytunl.ch/play/?d=20260920&r=anon-1758300000000',
    'https://flytunl.ch/play/?d=20260920&s=412&r=3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    'https://flytunl.ch/play/?d=20260920&s=9999999&r=' + 'a'.repeat(64),
];
for (const t of cases) {
    const q = _qrMatrix(t);
    check(`matrix built for ${t.length} chars`, !!q);
    if (!q) continue;
    structure(q);
    decode(q, t);
    console.log(`  ok  ${String(t.length).padStart(3)} chars -> version ${q.ver} (${q.n}x${q.n} modules)`);
}

// Too long for version 9 must return null rather than a broken matrix.
check('over-long payload is refused', _qrMatrix('x'.repeat(181)) === null);
// Anything past one byte per character is refused rather than silently mangled. The
// share URL is always ASCII (webPlayerId is a UUID, everything else is fixed), and QR
// byte mode is ISO-8859-1, so the guard sits at charCode 255, not at 127.
check('multi-byte payload is refused', _qrMatrix('https://flytunl.ch/中') === null);

if (failures) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
}
console.log('\ntest-share.js: all QR checks passed');
