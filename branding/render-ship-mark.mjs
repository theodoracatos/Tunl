// TUNL brand ship, rendered by the game itself.
//
// Since 2026-10-02 the brand marks show the F-14 as it flies (variant D of the icon concept,
// https://claude.ai/artifact/UA3oHiakB3ipBVmTEWoV4k): the 3D hull at SHIP3D_ROLL_BASE with
// the wings folded fully back, as in a warp. That picture comes from drawShip3D's projected
// model, which has no SVG twin, so instead of copying geometry (gen-ship-glyph.mjs did, and
// the copy went stale) this script loads src/*.js in headless Chrome, lets drawShip3D paint
// the ship and embeds the result as a PNG between the masters' BEGIN/END markers. Background,
// aura and the placement transform around the markers stay hand-authored per master.
//
//   node branding/render-ship-mark.mjs --list     # show the targets
//   node branding/render-ship-mark.mjs --write    # re-render and rewrite all masters
//   node branding/render-ship-mark.mjs --site     # flytunl.ch chips + hangar portraits
//   node branding/render-ship-mark.mjs --png=out.png [--res=4]   # ship layer only
//
// Then run branding/export-icons.sh. Needs Google Chrome (override with CHROME=...).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The ship pose. sweep 1 = SHIP3D_SWEEP_MAX (warp fold); roll null = SHIP3D_ROLL_BASE.
const POSE = { sweep: 1, roll: null, jet: 1.7, blur: 26 };
// Drawn area in ship-local px at r = 130 (nose +x): nose 1.40r, icon plume ~2.7r aft of
// the pivot, wings and the 1.5r glow above and below. The masters rotate this box.
const BOX = { x0: -420, x1: 240, y0: -230, y1: 230 };

// res = bitmap px per ship-local px. Each master's own scale times its largest raster
// (launch logo @3x = 1.5x its viewBox), so nothing is upscaled on export.
const TARGETS = [
    { file: 'branding/icon-mark.svg',               res: 2.0 * 1.0 },
    { file: 'branding/ios-launch-logo.svg',         res: 2.0 * 1.5 },
    { file: 'branding/icon-adaptive-foreground.svg', res: 0.62 * 1.0 },
    { file: 'branding/feature-graphic.svg',         res: 1.20 * 1.0 },
];
const BEGIN = '<!-- BEGIN generated ship: branding/render-ship-mark.mjs';
const END   = '<!-- END generated ship -->';

// Scripts in tunl.html order, minus the ones that start the game or ads.
function gameScripts() {
    const html = readFileSync(join(ROOT, 'tunl.html'), 'utf8');
    return [...html.matchAll(/<script src="(src\/[^"]+\.js)"/g)].map(m => m[1])
        .filter(s => !/\/(main|ads-web)\.js$/.test(s));
}

// The page: draws one ship (the ids are split in the source so --dump-dom's copy of
// the script never matches the result patterns) per request and leaves its PNG in the DOM for --dump-dom.
// Plume: the game's drawThrustPlume is 5r long and runs off any icon, so the icon gets
// the same teardrop shape at `jet` r, tinted with the skin glow, white core.
function harness(scripts) {
    return `<!doctype html><html><head><meta charset="utf-8"></head><body><canvas id="c"></canvas>
${scripts.map(s => `<script src="/${s}"></script>`).join('\n')}
<script>
addEventListener('error', e => document.body.insertAdjacentHTML('beforeend', '<pre id="e' + 'rr">' + e.message + '</pre>'));
const P = JSON.parse(decodeURIComponent(location.hash.slice(1)));
const sk = SKINS[P.skin || 0], [sr, sg, sb] = sk.shadow, r = 130;
function iconPlume(L) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const ns of [-1, 1]) {
        const nx = SHIP_NOZZLE_X * r, ny = r * shipNozzleDY(ns);
        const drop = (len, wd) => { ctx.beginPath(); ctx.moveTo(nx, ny - wd);
            ctx.bezierCurveTo(nx - len*0.22, ny - wd*1.3, nx - len*0.6, ny - wd*0.55, nx - len, ny);
            ctx.bezierCurveTo(nx - len*0.6, ny + wd*0.55, nx - len*0.22, ny + wd*1.3, nx, ny + wd); ctx.closePath(); };
        let g = ctx.createLinearGradient(nx, 0, nx - L*r, 0);
        g.addColorStop(0, 'rgba(255,245,215,0.85)'); g.addColorStop(0.45, 'rgba(' + sr + ',' + sg + ',' + sb + ',0.34)');
        g.addColorStop(1, 'rgba(' + sr + ',' + sg + ',' + sb + ',0)');
        ctx.filter = 'blur(' + (r * 0.06 * P.res) + 'px)'; drop(L*r, r*0.14); ctx.fillStyle = g; ctx.fill();
        ctx.filter = 'none';
        g = ctx.createLinearGradient(nx, 0, nx - L*0.55*r, 0);
        g.addColorStop(0, 'rgba(255,253,244,0.95)'); g.addColorStop(0.6, 'rgba(253,251,242,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        drop(L*0.55*r, r*0.055); ctx.fillStyle = g; ctx.fill();
    }
    ctx.restore();
}
const B = P.box;
cv.width = Math.round((B.x1 - B.x0) * P.res); cv.height = Math.round((B.y1 - B.y0) * P.res);
shipRoll = P.roll ?? SHIP3D_ROLL_BASE; shipRollV = 0; shipSweep = P.sweep; shipPitch = 0; gtime = 0;
ctx.setTransform(P.res, 0, 0, P.res, -B.x0 * P.res, -B.y0 * P.res);
if (P.flat) {
    // Hangar portrait: the top-down hull exactly as the hangar draws it (drawShip).
    drawShip(0, 0, r, sk.color, sr, sg, sb, P.blur, false);
} else {
    iconPlume(P.jet);
    drawShip3D(0, 0, r, sk.color, sr, sg, sb, P.blur, false);
}
document.body.insertAdjacentHTML('beforeend', '<pre id="p' + 'ng">' + cv.toDataURL('image/png') + '</pre>'
    + '<pre id="out' + 'line">' + JSON.stringify(SHIP_OUTLINE) + '</pre>'
    + '<pre id="sk' + 'ins">' + JSON.stringify(SKINS.map(k => k.name)) + '</pre>');
</script></body></html>`;
}

const MIME = { '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8' };

// jobs: overrides of POSE (res, skin, flat, box, ...). Resolves [{png, outline}].
export async function renderAll(jobs) {
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
    const port = srv.address().port;
    const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    try {
        const out = [];
        for (const job of jobs) {
            const p = encodeURIComponent(JSON.stringify({ ...POSE, box: BOX, ...job }));
            // Async on purpose: the page is served from this same event loop.
            const r = await new Promise((ok, no) => execFile(chrome,
                ['--headless=new', '--disable-gpu', '--virtual-time-budget=5000', '--dump-dom',
                 `http://127.0.0.1:${port}/harness.html#${p}`],
                { maxBuffer: 256 << 20 }, (e, so) => e ? no(e) : ok(so)));
            const err = r.match(/<pre id="err">([^<]*)/);
            if (err) throw new Error('harness: ' + err[1]);
            const png = r.match(/<pre id="png">(data:image\/png;base64,[^<]+)/);
            if (!png) throw new Error('harness produced no image');
            out.push({ png: png[1], outline: JSON.parse(r.match(/<pre id="outline">([^<]+)/)[1]),
                       skins: JSON.parse(r.match(/<pre id="skins">([^<]+)/)[1]) });
        }
        return out;
    } finally { srv.close(); }
}

// The <image> sits inside the master's ship transform, in ship-local px.
const fragment = uri => `${BEGIN} (do not hand-edit; F-14, drawShip3D) -->
  <image x="${BOX.x0}" y="${BOX.y0}" width="${BOX.x1 - BOX.x0}" height="${BOX.y1 - BOX.y0}" preserveAspectRatio="none" href="${uri}"/>
  ${END}`;

// flytunl.ch ship section (flytunl-site/home.src.html): every chip carries the flat
// SHIP_OUTLINE silhouette, every panel a hangar portrait (drawShip, top-down, no glow - the
// page adds a drop-shadow in the ship's colour). Same framing as the old SVG portraits.
const SITE_HTML = 'flytunl-site/home.src.html', SITE_DIR = 'flytunl-site/site/media-ships';
const SITE_BOX = { x0: -171.6, x1: 195, y0: -140.4, y1: 140.4 }, SITE_RES = 0.82;
async function writeSite() {
    const { mkdirSync } = await import('node:fs');
    let html = readFileSync(join(ROOT, SITE_HTML), 'utf8');
    const names = [...html.matchAll(/id="panel-([A-Z]+)"/g)].map(m => m[1]);
    const probe = await renderAll([{ res: 0.1 }]);
    const skins = probe[0].skins, outline = probe[0].outline;
    const jobs = names.map(n => {
        const skin = skins.indexOf(n);
        if (skin < 0) throw new Error(SITE_HTML + ': no skin named ' + n);
        return { flat: true, skin, blur: 0, box: SITE_BOX, res: SITE_RES };
    });
    const out = await renderAll(jobs);
    mkdirSync(join(ROOT, SITE_DIR), { recursive: true });
    const w = Math.round((SITE_BOX.x1 - SITE_BOX.x0) * SITE_RES), h = Math.round((SITE_BOX.y1 - SITE_BOX.y0) * SITE_RES);
    names.forEach((n, i) => {
        // File names by skin index: build-site.mjs rewrites English i18n values anywhere in the
        // template, so a ship name inside a URL could get translated.
        const file = `f14-${jobs[i].skin}.png`;
        writeFileSync(join(ROOT, SITE_DIR, file), Buffer.from(out[i].png.split(',')[1], 'base64'));
        const re = new RegExp(`(id="panel-${n}"[^>]*>\\s*<div class="sp-art">)[\\s\\S]*?(</div>)`);
        if (!re.test(html)) throw new Error('portrait slot missing for ' + n);
        html = html.replace(re, `$1<img src="/media-ships/${file}" width="${w}" height="${h}" alt="" loading="lazy">$2`);
        console.log(`wrote ${SITE_DIR}/${file} (${n})`);
    });
    const xs = outline.map(p => p[0]), ys = outline.map(p => p[1]);
    const pad = 0.04, vb = [Math.min(...xs) - pad, Math.min(...ys) - pad,
        Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad].map(v => +v.toFixed(3));
    const d = 'M' + outline.map(p => `${+p[0].toFixed(3)} ${+p[1].toFixed(3)}`).join(' ') + 'Z';
    const chips = html.match(/class="ship-chip"[^>]*><svg[^>]*><path d="[^"]*"\/><\/svg>/g) || [];
    if (chips.length !== names.length) throw new Error(`found ${chips.length} chips for ${names.length} panels`);
    html = html.replace(/(class="ship-chip"[^>]*>)<svg[^>]*><path d="[^"]*"\/><\/svg>/g,
        `$1<svg viewBox="${vb.join(' ')}" aria-hidden="true"><path d="${d}"/></svg>`);
    writeFileSync(join(ROOT, SITE_HTML), html);
    console.log(`wrote ${SITE_HTML} (${names.length} chips + portraits)`);
}

// CLI only when run directly; game-center/gen-ship-achievement-icons.mjs imports renderAll.
const _isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
const argv = _isMain ? process.argv.slice(2) : [];
if (!_isMain) {
    // imported as a module
} else if (argv.includes('--list')) {
    for (const t of TARGETS) console.log(t.file);
} else if (argv.includes('--write')) {
    const uris = (await renderAll(TARGETS.map(t => ({ res: t.res })))).map(o => o.png);
    TARGETS.forEach((t, i) => {
        const f = join(ROOT, t.file), src = readFileSync(f, 'utf8');
        const a = src.indexOf('<!-- BEGIN generated ship'), b = src.indexOf(END);
        if (a < 0 || b < 0) throw new Error(t.file + ': BEGIN/END markers missing');
        writeFileSync(f, src.slice(0, a) + fragment(uris[i]) + src.slice(b + END.length));
        console.log(`wrote ${t.file} (${Math.round(uris[i].length / 1024)} KB ship layer)`);
    });
} else if (argv.includes('--site')) {
    await writeSite();
} else {
    const pngArg = argv.find(a => a.startsWith('--png='));
    if (!pngArg) { console.log('usage: --list | --write | --png=out.png [--res=N]'); process.exit(1); }
    const res = Number((argv.find(a => a.startsWith('--res=')) || '--res=2').slice(6));
    const [{ png: uri }] = await renderAll([{ res }]);
    writeFileSync(pngArg.slice(6), Buffer.from(uri.split(',')[1], 'base64'));
    console.log('wrote', pngArg.slice(6));
}
