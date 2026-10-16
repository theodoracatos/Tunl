// CrazyGames covers (landscape 1920x1080, portrait 800x1200, square 800x800) from the Play
// feature graphic (branding/feature-graphic.svg, "Steigflug"): the same violet ground, rays,
// halo, AMBER F-14 and wordmark, re-framed per format. CrazyGames wants the three alike, the
// title as the only text, no border, no store logo, nothing blurry - so the ship is
// re-rendered by the game itself (render-ship-mark.mjs, ICON_POSE) at a resolution none of
// the covers has to upscale, instead of reusing the feature graphic's 1024-wide raster.
// Re-run after the feature graphic changes. Needs Google Chrome and rsvg-convert.
//   node flytunl-site/cg/make-covers.mjs
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderAll, ICON_POSE } from '../../branding/render-ship-mark.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const SRC = readFileSync(join(ROOT, 'branding/feature-graphic.svg'), 'utf8');

// Bitmap px per ship-local px: the landscape ship (1.25 svg units per local px, 2.16 output
// px per unit) is the most magnified of the three.
const RES = 4;

function swap(svg, a, b) {
    if (svg.split(a).length !== 2) throw new Error('feature-graphic.svg changed shape, update: ' + a.slice(0, 60));
    return svg.replace(a, () => b);
}

const [{ png }] = await renderAll([{ res: RES, ...ICON_POSE }]);
let base = SRC.replace(/href="data:image\/png;base64,[^"]+"/, () => `href="${png}"`);
// The ground and the halo cover a canvas far wider than any frame below.
base = swap(base, '<rect width="1024" height="500" fill="url(#bgGrd)"/>',
    '<rect x="-1500" y="-1500" width="4000" height="3500" fill="url(#bgGrd)"/>');
base = swap(base, '<rect width="1024" height="500" fill="url(#halo)"/>',
    '<rect x="-1500" y="-1500" width="4000" height="3500" fill="url(#halo)"/>');

// view: the frame in feature-graphic units; ship: the ship group's transform (the master's
// is translate(790,255) rotate(-34) scale(1.25)); mark: the wordmark group's transform.
const COVERS = [
    { file: 'cover-landscape.png', w: 1920, h: 1080, view: [95, 0, 889, 500],
      ship: 'translate(790,255) rotate(-34) scale(1.25)', mark: 'translate(125,186) scale(0.50)' },
    { file: 'cover-portrait.png', w: 800, h: 1200, view: [600, -160, 400, 600],
      ship: 'translate(800,250) rotate(-34) scale(1.1)', mark: 'translate(626,-134) scale(0.42)' },
    // The preview videos open on their cover (make-videos.sh): the portrait one at 1080x1620.
    { file: 'video-cover-portrait.png', w: 1080, h: 1620, view: [600, -160, 400, 600],
      ship: 'translate(800,250) rotate(-34) scale(1.1)', mark: 'translate(626,-134) scale(0.42)' },
    { file: 'cover-square.png', w: 800, h: 800, view: [560, -110, 500, 500],
      ship: 'translate(815,215) rotate(-34) scale(1.05)', mark: 'translate(628,-110) scale(0.44)' },
];

const tmp = mkdtempSync(join(tmpdir(), 'tunl-cg-'));
try {
    for (const c of COVERS) {
        let svg = swap(base,
            '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">',
            `<svg xmlns="http://www.w3.org/2000/svg" width="${c.w}" height="${c.h}" viewBox="${c.view.join(' ')}">`);
        svg = swap(svg, '<g transform="translate(790,255) rotate(-34) scale(1.25)">', `<g transform="${c.ship}">`);
        svg = swap(svg, '<g transform="translate(48,186) scale(0.54)">', `<g transform="${c.mark}">`);
        const s = join(tmp, c.file + '.svg');
        writeFileSync(s, svg);
        execFileSync('rsvg-convert', ['-w', String(c.w), '-h', String(c.h), s, '-o', join(HERE, c.file)]);
        console.log('wrote', join('flytunl-site/cg', c.file), `${c.w}x${c.h}`);
    }
} finally {
    rmSync(tmp, { recursive: true, force: true });
}
