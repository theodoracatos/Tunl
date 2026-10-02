// flytunl.ch "feel" strip sprites, rendered by the game itself.
//
// The homepage's little cave flight (flytunl-site/home.src.html, #feelCanvas) shows the
// ship and the stalactites. Both used to be hand-copied geometry (the K5 hull, plain
// triangles) and went stale when the game moved to the F-14 and crystal stalactites.
// Like render-ship-mark.mjs, this script loads src/*.js in headless Chrome and lets the
// game paint: drawShip3D for the ship (cruise sweep, SHIP3D_ROLL_BASE, PEARL), drawCoin for a
// gold coin, and drawCrystalSpike for one ceiling twin and one floor druse per weekday, each in
// that day's palette and crystal material. The result is one image for ship and coin and one per
// weekday (so the page loads only today's), plus a JSON map of cell rects and anchors written
// between the FEEL SPRITES markers in home.src.html.
//
//   node branding/render-feel-sprites.mjs
//
// Needs Google Chrome (override with CHROME=...).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_HTML = 'flytunl-site/home.src.html';
const OUT_DIR = 'flytunl-site/site/media-ships';   // feel-ship.png, feel-day-<0..6>.png
const BEGIN = '/* BEGIN feel sprites: branding/render-feel-sprites.mjs (do not hand-edit) */';
const END = '/* END feel sprites */';

// Sizes in game px; the page scales them to its strip. Big enough to stay sharp at 2x.
const SHIP_R = 36;                    // ship radius (the strip draws ~15 px, so 2x screens stay sharp)
const HW = 15, LEN = 60;              // stalactite half-width and length (the strip draws ~28 px)

function gameScripts() {
    const html = readFileSync(join(ROOT, 'tunl.html'), 'utf8');
    return [...html.matchAll(/<script src="(src\/[^"]+\.js)"/g)].map(m => m[1])
        .filter(s => !/\/(main|ads-web)\.js$/.test(s));
}

function harness(scripts) {
    return `<!doctype html><html><head><meta charset="utf-8"></head><body><canvas id="c"></canvas>
${scripts.map(s => `<script src="/${s}"></script>`).join('\n')}
<script>
addEventListener('error', e => document.body.insertAdjacentHTML('beforeend', '<pre id="e' + 'rr">' + e.message + '</pre>'));
// Paint into a scratch canvas through the game's own ctx, then crop to the drawn pixels.
function paint(w, h, ox, oy, fn) {
    cv.width = w; cv.height = h;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, ox, oy);
    fn();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 4) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const c = document.createElement('canvas');
    c.width = x1 - x0 + 3; c.height = y1 - y0 + 3;
    c.getContext('2d').drawImage(cv, x0 - 1, y0 - 1, c.width, c.height, 0, 0, c.width, c.height);
    return { c, ax: ox - x0 + 1, ay: oy - y0 + 1 };
}
const out = { ship: null, days: [] }, cells = [];

// Ship: PEARL in cruise, no plume (the page draws the thrust), a modest glow.
const sk = SKINS[0], [sr, sg, sb] = sk.shadow;
shipRoll = SHIP3D_ROLL_BASE; shipRollV = 0; shipSweep = SHIP3D_SWEEP_CRUISE; shipPitch = 0; gtime = 0;
const S = paint(${SHIP_R} * 5, ${SHIP_R} * 4, ${SHIP_R} * 2.4, ${SHIP_R} * 2,
    () => drawShip3D(0, 0, ${SHIP_R}, sk.color, sr, sg, sb, 14, false));
S.g = 0; cells.push(S); out.ship = { cell: 0, r: ${SHIP_R}, nozzleX: SHIP_NOZZLE_X, nozzleY: [shipNozzleDY(-1), shipNozzleDY(1)] };

// Gold coin, as drawCoin paints it in the game (glow included), at half-extent COIN_S.
const COIN_S = 16, cScale = COIN_S / (COIN_R * COIN_SIZE_MULT.gold * COIN_OBJECT_SCALE * COIN_OBJECT_BOOST.gold);
const G = paint(COIN_S * 6, COIN_S * 6, COIN_S * 3, COIN_S * 3, () => drawCoin(0, 0, 'gold', 0, cScale));
G.g = 0; cells.push(G); out.coin = { cell: cells.length - 1, s: COIN_S };

// Crystals: a flat wall at y 0, roots sunk into it as in the game.
boundsAt = () => ({ top: 0, bot: 0 });
const ROCK = [16, 16, 26];
for (let wd = 0; wd < 7; wd++) {
    const date = new Date(Date.UTC(2026, 8, 28 + wd));          // 2026-09-28 is a Monday
    _tunlActiveDate = () => date;
    const theme = Object.assign({}, getTheme(), { wall: ROCK, stal: ROCK });
    // No rock socket: the page clips the crystals to its corridor instead, so they meet a
    // sloped wall exactly; a flat socket stuck out of it as a dark bar. The tone object is
    // cached per (stalEdge, material), so drawCrystalSpike below gets this same one.
    _crystalTones(theme, CRYSTAL_MATERIALS[weekdayIndex(date)]).socket = 'rgba(0,0,0,0)';
    const day = { mat: CRYSTAL_MATERIALS[weekdayIndex(date)].name };
    for (const isTop of [true, false]) {
        const s = { isTop, wx: 1000 + wd * 977 + (isTop ? 0 : 431), width: ${HW} * 2, length: ${LEN} };
        const P = paint(${HW} * 9, ${LEN} * 1.9, ${HW} * 4.5, isTop ? 24 : ${LEN} * 1.9 - 24,
            () => drawCrystalSpike(s, 0, 0, 0, theme));
        P.g = wd + 1; cells.push(P);
        day[isTop ? 'top' : 'bot'] = cells.length - 1;
    }
    out.days.push(day);
}

// Pack each group (the ship, then each weekday's pair) into its own image, side by side.
const rects = [], imgs = [];
for (let g = 0; g < 8; g++) {
    const mine = cells.filter(P => P.g === g);
    let x = 0, h = 0;
    for (const P of mine) { rects[cells.indexOf(P)] = [g, x, 0, P.c.width, P.c.height, P.ax, P.ay]; x += P.c.width + 2; h = Math.max(h, P.c.height); }
    const im = document.createElement('canvas');
    im.width = x - 2; im.height = h;
    for (const P of mine) { const r = rects[cells.indexOf(P)]; im.getContext('2d').drawImage(P.c, r[1], 0); }
    imgs.push(im.toDataURL('image/png'));
}
out.cells = rects; out.hw = ${HW}; out.len = ${LEN};
document.body.insertAdjacentHTML('beforeend', imgs.map((u, i) => '<pre id="p' + 'ng' + i + '">' + u + '</pre>').join('')
    + '<pre id="me' + 'ta">' + JSON.stringify(out) + '</pre>');
</script></body></html>`;
}

const MIME = { '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8' };
const page = harness(gameScripts());
const srv = createServer((q, s) => {
    const path = decodeURIComponent(q.url.split('#')[0].split('?')[0]);
    if (path === '/harness.html') { s.writeHead(200, { 'content-type': MIME['.html'] }); return s.end(page); }
    const f = join(ROOT, path);
    if (!f.startsWith(join(ROOT, 'src')) || !existsSync(f)) { s.writeHead(404); return s.end(); }
    s.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    s.end(readFileSync(f));
});
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
try {
    const r = await new Promise((ok, no) => execFile(chrome,
        ['--headless=new', '--disable-gpu', '--virtual-time-budget=5000', '--dump-dom',
         `http://127.0.0.1:${srv.address().port}/harness.html`],
        { maxBuffer: 256 << 20 }, (e, so) => e ? no(e) : ok(so)));
    const err = r.match(/<pre id="err">([^<]*)/);
    if (err) throw new Error('harness: ' + err[1]);
    const meta = r.match(/<pre id="meta">([^<]+)/);
    if (!meta) throw new Error('harness produced no map');
    mkdirSync(join(ROOT, OUT_DIR), { recursive: true });
    let kb = 0;
    for (let i = 0; i < 8; i++) {
        const png = r.match(new RegExp('<pre id="png' + i + '">data:image/png;base64,([^<]+)'));
        if (!png) throw new Error('harness produced no image ' + i);
        const buf = Buffer.from(png[1], 'base64'); kb += buf.length / 1024;
        writeFileSync(join(ROOT, OUT_DIR, i ? `feel-day-${i - 1}.png` : 'feel-ship.png'), buf);
    }
    const html = readFileSync(join(ROOT, SITE_HTML), 'utf8');
    const a = html.indexOf(BEGIN), b = html.indexOf(END);
    if (a < 0 || b < 0) throw new Error(SITE_HTML + ': FEEL SPRITES markers missing');
    const json = meta[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    writeFileSync(join(ROOT, SITE_HTML),
        html.slice(0, a) + BEGIN + '\n    var FEEL = ' + json + ';\n    ' + html.slice(b));
    console.log(`wrote ${OUT_DIR}/feel-ship.png + feel-day-0..6.png (${Math.round(kb)} KB total) and the map in ${SITE_HTML}`);
} finally { srv.close(); }
