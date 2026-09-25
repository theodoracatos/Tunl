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
//    audio/the_mountain*.web.m4a - background tracks, smaller AAC web encodes
//                          (audio.js _bgmUrl picks these on isWeb()). The stereo
//                          .mp3 originals are not shipped to /play.
//  and flytunl-site/site/tt/ - the TikTok landing, see buildTT() below.
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
  'web', 'fonts', 'i18n', 'constants', 'world', 'state', 'lifecycle', 'systems',
  'audio', 'input', 'update', 'draw', 'paint', 'approach', 'share', 'record', 'notify', 'main', 'ads-web',
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

// Google Ad Manager H5 Games Ads (see src/ads-web.js for the full write-up).
// gpt.js is safe to ship unconditionally here - this HEAD_EXTRA only ever
// reaches the served /play page, never tunl.html or the app builds, so the
// app WebViews (which use native AdMob instead) never load it.
//
// FUNDING_CHOICES_SNIPPET: the explicit EU/UK/CH consent-message loader from
// AdSense -> Datenschutz und Mitteilungen -> Europäische Verordnungen ->
// Mitteilungen -> "Code abrufen". As of 2026-09-07 this is NO LONGER required:
// adsbygoogle.js (loaded below) auto-injects the Funding Choices loader for
// ca-pub-4882203470005029 whenever a message is configured, and gpt.js shares
// the same page-level `__tcfapi`, so the consent flow already runs on /play
// (verified live: fundingchoicesmessages.google.com requests fire,
// window.__tcfapi + window.googlefc are present). Kept as an override slot only:
// paste the explicit snippet here if Google ever stops auto-loading it for the
// AdSense tag, or if /play drops adsbygoogle.js and keeps only gpt.js. Left
// blank otherwise - a hand-written guess at Google's boilerplate is a
// compliance risk, not just a bug.
const FUNDING_CHOICES_SNIPPET = '';
const ADS_HEAD = `\n<!-- Google AdSense (site verification + ad serving) -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4882203470005029" crossorigin="anonymous"></script>
<!-- Google Ad Manager: H5 Games Ads (interstitial + rewarded) -->
<script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js" crossorigin="anonymous"></script>` +
  (FUNDING_CHOICES_SNIPPET
    ? `\n${FUNDING_CHOICES_SNIPPET}`
    : `\n<!-- Funding Choices (EU consent) is auto-loaded by adsbygoogle.js above - see FUNDING_CHOICES_SNIPPET note. -->`);

// Web analytics for /play - so traffic shows up next to the iOS/Android apps
// in the Firebase/GA4 console. Web-only by construction: reaches the served
// /play page only, never tunl.html or the app WebViews (they report via the
// native Firebase SDK, which has no relation to any of this).
//
// 2026-09-09: THIS IS A SERVER-TO-SERVER RELAY, NOT A DIRECT gtag.js LOAD.
// Two direct-load approaches were tried first (Firebase SDK's getAnalytics(),
// then bare gtag.js) and both failed identically: every real browser tested
// (this dev's Mac, a phone on cellular, a different computer in incognito)
// got a 503 from every request to google-analytics.com, while curl against
// the byte-identical URL always got 204 - see project_web_firebase_analytics
// memory for the 3-day investigation. The one variable that mattered was
// "sent by a real browser" vs "sent server-to-server". So instead of the
// page hitting Google directly, it posts to our own tunl-scores Cloudflare
// Worker (already live for the leaderboard), which relays to GA4's
// Measurement Protocol from its own server-side fetch() - see POST /ga in
// flytunl-site/worker/src/index.js.
//
// No cookie is ever set by this (no gtag.js runs in the browser at all) - cid
// is a client-generated, localStorage-persisted pseudonymous id, same privacy
// posture as the old cookieless Consent-Mode setup, still no banner needed.
const WEB_ANALYTICS_RELAY = 'https://tunl-scores.theodoracatos.workers.dev/ga';

// This snippet defines window._tunlGA(name, params), which the GAME calls for
// run_start / run_end (src/lifecycle.js, src/update.js). It exists ONLY in the
// /play head, so in the iOS and Android builds the global is simply undefined
// and those call sites are inert - the web/app isolation rule holds without an
// isWeb() branch doing the work.
//
// Three things here are deliberate and were the whole point of the 2026-09-14
// rework; do not simplify them away:
//  - session_id persists for GA_SESSION_GAP_MS of inactivity instead of being
//    minted per page load. It used to be Date.now() at load, so every reload was
//    a fresh session and no engagement metric on the stream meant anything.
//  - engagement_time_msec is real elapsed time since load, not a constant 1.
//  - source/medium/campaign/referrer ride along on the first event of a session,
//    which is what stops every web session landing under "Unassigned". utm_* wins
//    over the referrer when both are present, same precedence gtag.js uses.
// `def` (the /tt/ landing, see TT_GA_DEFAULT) is the source a session is credited to
// when its URL carries no utm_source - the TikTok website button links the bare page.
// TikTok appends ttclid to a paid click, which is what tells paid from organic here.
const gaHead = (def) => WEB_ANALYTICS_RELAY
  ? `\n<!-- Web analytics (relayed server-to-server via the tunl-scores Worker - see build-play.mjs) -->
<script>
(function(){
  try {
    var URL_ = ${JSON.stringify(WEB_ANALYTICS_RELAY)};
    var GAP = 1800000;           // GA4's own 30-minute session window
    var t0 = Date.now();
    var cid = localStorage.getItem('tunl_ga_cid');
    if (!cid) {
      cid = (crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '.' + Math.random().toString(36).slice(2)));
      localStorage.setItem('tunl_ga_cid', cid);
    }
    // {id, last}: id survives reloads, a gap longer than GAP starts a new one.
    var ses = {};
    try { ses = JSON.parse(localStorage.getItem('tunl_ga_ses') || '{}') || {}; } catch (e) {}
    var fresh = !ses.id || !(Date.now() - (ses.last || 0) < GAP);
    if (fresh) ses = { id: String(Math.floor(Date.now() / 1000)) };
    var q = new URLSearchParams(location.search);
    var src = {};
    if (fresh) {
      var utm = q.get('utm_source');
      if (utm) {
        src.source = utm;
        src.medium = q.get('utm_medium') || '';
        src.campaign = q.get('utm_campaign') || '';
        src.term = q.get('utm_term') || '';
        src.content = q.get('utm_content') || '';
      }${def ? ` else {
        src.source = ${JSON.stringify(def.source)};
        src.medium = q.get('ttclid') ? 'paid' : ${JSON.stringify(def.medium)};
        src.campaign = ${JSON.stringify(def.campaign)};
      }` : ''}
      if (document.referrer && document.referrer.indexOf(location.origin) !== 0) src.dr = document.referrer;
    }
    window._tunlGA = function(name, extra) {
      try {
        ses.last = Date.now();
        try { localStorage.setItem('tunl_ga_ses', JSON.stringify(ses)); } catch (e) {}
        var b = { cid: cid, sid: ses.id, en: name, dl: location.href, dt: document.title, ms: Date.now() - t0 };
        for (var k in src) if (src[k]) b[k] = src[k];
        for (var k2 in (extra || {})) b[k2] = extra[k2];
        fetch(URL_, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(b),
          keepalive: true,
        }).catch(function(){});
        src = {};   // source rides the first event of a session only
      } catch (e) {}
    };
    window._tunlGA('page_view');
  } catch (e) {}
})();
</script>`
  : `\n<!-- Web analytics: WEB_ANALYTICS_RELAY not set in build-play.mjs. -->`;
const FIREBASE_HEAD = gaHead(null);

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
<meta name="twitter:image" content="https://flytunl.ch/feature-graphic-1024x500.png">` + CF_BEACON + ADS_HEAD + FIREBASE_HEAD;

async function build() {
  // ---- 1. bundle + minify src/*.js -------------------------------------
  const sources = {};
  for (const name of SCRIPTS) {
    sources[`${name}.js`] = await readFile(path.join(root, 'src', `${name}.js`), 'utf8');
  }

  // TUNL_VERSION is the single source of truth (src/constants.js), shared by all
  // three targets. Stamp it into <head> so the live web build's version is
  // greppable (curl -s https://flytunl.ch/play | grep tunl:version) without
  // diffing the bundle. window.TUNL_VERSION carries the same value at runtime.
  const verMatch = sources['constants.js'].match(/const\s+TUNL_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!verMatch) throw new Error('src/constants.js: TUNL_VERSION const not found');
  const TUNL_VERSION = verMatch[1];

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
  const stripped = html;
  html = html.replace('</body>', `<script src="tunl.bundle.js?v=${v}"></script>\n</body>`);
  if (!html.includes('</head>')) throw new Error('no </head> in tunl.html');
  html = html.replace('</head>', HEAD_EXTRA + `\n<meta name="tunl:version" content="${TUNL_VERSION}">\n</head>`);
  await writeFile(path.join(outDir, 'index.html'), html, 'utf8');

  // ---- 3. static assets referenced by index.html --------------------
  const brandingSrc = path.join(root, 'branding/web');
  const brandingOut = path.join(outDir, 'branding/web');
  await mkdir(brandingOut, { recursive: true });
  for (const f of await readdir(brandingSrc)) {
    await copyFile(path.join(brandingSrc, f), path.join(brandingOut, f));
  }

  const audioOut = path.join(outDir, 'audio');
  await mkdir(audioOut, { recursive: true });
  for (const track of ['the_mountain.web.m4a', 'the_mountain_documentary.web.m4a']) {
    await copyFile(path.join(root, 'audio', track), path.join(audioOut, track));
  }

  await buildTT(stripped, v, TUNL_VERSION);

  const kb = (min.code.length / 1024).toFixed(0);
  console.log(`play/ built - tunl.bundle.js ${kb} KB (from ${SCRIPTS.length} files), version ${TUNL_VERSION}`);
}

// ============================================================
//  /tt/ - the TikTok landing (flytunl-site/tt/, see tt-head.js for the why)
// ============================================================
//  The same game as /play/, served from its own path so paid TikTok clicks land in the
//  game with no homepage or language redirect in between, and so Cloudflare Web
//  Analytics counts them apart (/tt/ page views, then the /tt/<step>/ funnel hits that
//  tt-tail.js loads). Differences from /play/, all in this page only:
//   - <base href="/play/">: the bundle, audio and icons are /play/'s own files, never
//     copies, so the two pages can't drift;
//   - no AdSense / Ad Manager tags (no web ad unit serves - see ads-web.js - and the EU
//     consent dialog they pull in would be the first thing an ad visitor sees);
//   - noindex, canonical -> /play/;
//   - tt.css + tt-head.js before the bundle, tt-tail.js after it.
// Also writes the funnel counter pages and /tt/diag/ (store-link test bench).
const TT_GA_DEFAULT = { source: 'tiktok', medium: 'referral', campaign: 'tt_landing' };
// In funnel order (tt-tail.js has what each one means). run2 sits off the main line.
const TT_STEPS = ['ready', 'run', 'dead', 'pitch', 'store-ios', 'store-android', 'run2'];

async function buildTT(stripped, v, version) {
  const ttSrc = path.join(here, 'tt');
  const ttOut = path.join(root, 'flytunl-site/site/tt');
  const [css, head, tail, diag] = await Promise.all(
    ['tt.css', 'tt-head.js', 'tt-tail.js', 'diag.html'].map(f => readFile(path.join(ttSrc, f), 'utf8')));
  const small = async (code) => {
    const m = await minify(code, { compress: { passes: 2 }, mangle: true, format: { comments: false } });
    if (m.error) throw m.error;
    return m.code;
  };
  const [headMin, tailMin] = await Promise.all([small(head), small(tail)]);

  const ttHead = `<base href="/play/">
<meta name="robots" content="noindex">
<meta name="description" content="Fly today's cave. Every player on Earth gets the same one.">
<meta name="theme-color" content="#000000">
<link rel="canonical" href="https://flytunl.ch/play/">
<style>
${css.trim()}
</style>
<script>${headMin}</script>` + CF_BEACON + gaHead(TT_GA_DEFAULT) + `
<meta name="tunl:version" content="${version}">`;

  let html = stripped;
  // After the viewport meta: tt-head.js reads innerWidth/innerHeight, which a mobile
  // browser reports as its 980px default layout until that tag has been parsed. And
  // before the favicon links: <base> must precede every relative URL in the head.
  html = html.replace(/<meta name="viewport"[^>]*>\r?\n/, m => m + ttHead + '\n');
  if (!html.includes('<base href="/play/">')) throw new Error('tt: <meta name="viewport"> not found in tunl.html');
  // The start screen (tt-head.js), first thing in <body> so it paints before the bundle
  // has even started to download. Its label is filled in by tt-tail.js with the game's
  // own T.tap once the bundle (and with it i18n.js) is there; until then it is wordless.
  // The mark is the homepage's crystal wordmark (site root, outside <base>), not the
  // ringed branding/web one: that read as a tap-and-hold badge next to the play button.
  const splash = `<div id="tt-splash" role="button" aria-label="Play"><img class="mark" src="/wordmark.svg" alt="TUNL">`
    + `<div class="btn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5v17a1 1 0 0 0 1.5.86l14-8.5a1 1 0 0 0 0-1.72l-14-8.5A1 1 0 0 0 6 3.5z" fill="#eaf3ff"/></svg></div>`
    + `<div class="lbl"></div></div>`;
  if (!/<body>\r?\n/.test(html)) throw new Error('tt: <body> not found in tunl.html');
  html = html.replace(/<body>\r?\n/, m => m + splash + '\n');
  html = html.replace('</body>', `<script src="tunl.bundle.js?v=${v}"></script>\n<script>${tailMin}</script>\n</body>`);

  await rm(ttOut, { recursive: true, force: true });
  await mkdir(ttOut, { recursive: true });
  await writeFile(path.join(ttOut, 'index.html'), html, 'utf8');

  // Funnel counters: loaded in a hidden iframe by tt-tail.js count(). Opened on their
  // own (top === self) they redirect to /tt/ before the beacon loads, so only the
  // iframe hit is ever counted.
  for (const step of TT_STEPS) {
    await mkdir(path.join(ttOut, step), { recursive: true });
    await writeFile(path.join(ttOut, step, 'index.html'), `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="robots" content="noindex"><title>TUNL /tt/${step}</title>
<script>if (window.top === window.self) location.replace('/tt/');</script>${CF_BEACON}
</head><body></body></html>
`, 'utf8');
  }

  await mkdir(path.join(ttOut, 'diag'), { recursive: true });
  await writeFile(path.join(ttOut, 'diag', 'index.html'), diag, 'utf8');
  console.log(`tt/ built - landing ${(html.length / 1024).toFixed(0)} KB + ${TT_STEPS.length} counters + diag`);
}

build().catch(err => { console.error('[build-play] failed:', err); process.exit(1); });
