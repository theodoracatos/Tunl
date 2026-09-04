// ============================================================
//  build-play.mjs - assemble flytunl.ch/play (the web build)
// ============================================================
//  Phase 00 of the TUNL Web Build plan. The game itself (tunl.html + src/*.js)
//  stays a no-build-step, one-file-per-concern project: this script is web-only
//  and never runs for the iOS or Android builds, which keep loading the individual
//  src/ files (Tunl.xcodeproj references ../src directly, Android's copyGameFiles
//  task copies them in).
//
//  Output: flytunl-site/site/play/
//    index.html        - tunl.html with the 12 <script> tags collapsed to one
//    tunl.bundle.js     - all of src/*.js concatenated, compressed, locals mangled
//    branding/web/*     - icons/wordmarks referenced by index.html
//    the_mountain*.web.m4a - background tracks, smaller mono AAC web encodes
//                          (audio.js _bgmUrl picks these on isWeb()). The stereo
//                          .mp3 originals are not shipped to /play.
//
//  Minification is a speed bump, not protection - client JS is never private.
//  We compress and mangle locals but NOT top-level names: every src file shares
//  one global scope and calls across that boundary by name, and the native bridge
//  reaches in via window.* . `toplevel: true` is the stronger setting to try once
//  there is a real device pass on /play.
//
//  Run: npm run build:play   (or: node flytunl-site/build-play.mjs)
// ============================================================

import { readFile, writeFile, mkdir, copyFile, rm, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { minify } from 'terser';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outDir = path.join(root, 'flytunl-site/site/play');

// src load order - MUST match the <script> tags in tunl.html.
const SCRIPTS = [
  'web', 'i18n', 'constants', 'world', 'state', 'lifecycle', 'systems',
  'audio', 'input', 'update', 'draw', 'share', 'notify', 'main',
];

const BANNER = '/*! TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch */';

// Cloudflare Web Analytics beacon token for flytunl.ch (dash.cloudflare.com ->
// Analytics -> Web Analytics -> flytunl.ch). It is a public identifier - it ships
// in the page source of every page - not a credential. Cloudflare Web Analytics is
// cookieless and stores nothing on the visitor's device, so no consent banner is
// needed. Set to '' to ship no beacon.
const CF_ANALYTICS_TOKEN = '7783839e84374212b7d76f25e1fb8e87';

const CF_BEACON = CF_ANALYTICS_TOKEN
  ? `\n<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${CF_ANALYTICS_TOKEN}"}'></script>`
  : `\n<!-- Web Analytics: set CF_ANALYTICS_TOKEN in build-play.mjs to emit the Cloudflare beacon. -->`;

// Injected into <head> of the served /play page only (never the repo tunl.html or
// the app builds). Link-preview cards for shared runs, canonical URL, theme colour.
// The og:image is the marketing feature graphic already at the site root.
const HEAD_EXTRA = `<meta name="description" content="Fly today's cave. Every player on Earth gets the same one. Hold to climb, release to fall, and see how deep you can go.">
<meta name="author" content="Theodoracatos">
<meta name="copyright" content="Copyright (c) 2026 Theodoracatos. All rights reserved.">
<meta name="theme-color" content="#04040a">
<link rel="canonical" href="https://flytunl.ch/play/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TUNL">
<meta property="og:title" content="TUNL">
<meta property="og:description" content="A daily hold-to-thrust cave flyer. Same cave for everyone, every day. Beat the run I just sent you.">
<meta property="og:url" content="https://flytunl.ch/play/">
<meta property="og:image" content="https://flytunl.ch/feature-graphic-1024x500.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="TUNL">
<meta name="twitter:description" content="A daily hold-to-thrust cave flyer. Same cave for everyone, every day.">
<meta name="twitter:image" content="https://flytunl.ch/feature-graphic-1024x500.png">` + CF_BEACON;

async function build() {
  // ---- 1. bundle + minify src/*.js -------------------------------------
  const sources = {};
  for (const name of SCRIPTS) {
    sources[`${name}.js`] = await readFile(path.join(root, 'src', `${name}.js`), 'utf8');
  }

  const min = await minify(sources, {
    compress: { passes: 2 },
    mangle: true,            // locals only - see header note
    format: { comments: false, preamble: BANNER },
  });
  if (min.error) throw min.error;

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'tunl.bundle.js'), min.code, 'utf8');

  // Content hash -> cache-busting query on the <script src>. The host sends no
  // Cache-Control on the bundle, so without this a returning visitor can keep
  // running a stale build after a deploy. Same hash on an unchanged deploy, so
  // the cache still hits when nothing moved.
  const v = createHash('sha256').update(min.code).digest('hex').slice(0, 10);

  // ---- 2. index.html: 12 script tags -> 1 bundle ----------------------
  let html = await readFile(path.join(root, 'tunl.html'), 'utf8');
  const before = html;
  html = html.replace(/[ \t]*<script src="src\/[^"]+"><\/script>\r?\n?/g, '');
  if (html === before) throw new Error('no <script src="src/..."> tags found in tunl.html - load order changed?');
  html = html.replace('</body>', `<script src="tunl.bundle.js?v=${v}"></script>\n</body>`);
  if (!html.includes('</head>')) throw new Error('no </head> in tunl.html');
  html = html.replace('</head>', HEAD_EXTRA + '\n</head>');
  await writeFile(path.join(outDir, 'index.html'), html, 'utf8');

  // ---- 3. static assets referenced by index.html --------------------
  const brandingSrc = path.join(root, 'branding/web');
  const brandingOut = path.join(outDir, 'branding/web');
  await mkdir(brandingOut, { recursive: true });
  for (const f of await readdir(brandingSrc)) {
    await copyFile(path.join(brandingSrc, f), path.join(brandingOut, f));
  }

  for (const track of ['the_mountain.web.m4a', 'the_mountain_documentary.web.m4a']) {
    await copyFile(path.join(root, track), path.join(outDir, track));
  }

  const kb = (min.code.length / 1024).toFixed(0);
  console.log(`play/ built - tunl.bundle.js ${kb} KB (from ${SCRIPTS.length} files)`);
}

build().catch(err => { console.error('[build-play] failed:', err); process.exit(1); });
