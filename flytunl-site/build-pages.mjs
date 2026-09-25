#!/usr/bin/env node
// ============================================================
//  build-pages.mjs - localize the guide pages (how-to-play, ships, ...)
// ============================================================
//  Source of truth for the ENGLISH text is the hand-written English page itself
//  (site/<page>/index.html, committed). Translations live in
//  i18n/pages/<lang>.<chunk>.json as { "<key>": "<translated html>" }, where the
//  key is a 7-char hash of the English text unit. Nothing else is stored:
//  edit an English sentence and its key changes, so a stale translation can
//  never be shown against text it was not written for - the unit falls back to
//  English (visibly) until it is retranslated.
//
//  Output: site/<lang>/<page>/index.html  (gitignored, like the localized homepage).
//  A language page is produced only when >= MIN_COVERAGE of its units are
//  translated and valid; below that it would be a mostly-English page filed under
//  a foreign URL, which is worse than no page. Links, the language switcher and
//  hreflang follow whichever pages actually exist.
//
//  This script also (re)writes, in place, the generated regions of every English
//  page: the sticky nav, the sitemap footer (with the language switcher) and the
//  hreflang block, all between <!-- site-chrome:... --> markers, plus site/sitemap.xml.
//
//  Usage
//    node build-pages.mjs                 build everything
//    node build-pages.mjs --list a,b      print the English units of pages a,b (key<TAB>text)
//    node build-pages.mjs --missing       coverage table (language x page)
//    node build-pages.mjs --todo <lang> [a,b]   keys still missing / invalid for a language (optionally only pages a,b)
//    node build-pages.mjs --excluded      text runs the extractor deliberately skips
//  Run AFTER build-site.mjs (which recreates site/<lang>/ from scratch).
// ============================================================
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlLang, dirAttr } from './lang-meta.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, 'site');
const TRANS_DIR = path.join(HERE, 'i18n', 'pages');
const ORIGIN = 'https://flytunl.ch';
const MIN_COVERAGE = 0.85;
const APPSTORE  = 'https://apps.apple.com/us/app/tunl-cave-flyer/id6789721765';
const PLAYSTORE = 'https://play.google.com/store/apps/details?id=com.theodoracatos.tunl';

const PAGES = ['how-to-play', 'ships', 'devlog', 'changelog', 'about', 'support', 'press', 'privacy', 'impressum',
  'devlog/daily-cave', 'devlog/first-two-months', 'devlog/run-pacing',
  'devlog/same-ship-every-screen', 'devlog/three-quarter-ship', 'devlog/thrust-retune'];
const PAGE_SET = new Set(PAGES.map(p => `/${p}/`));

const rd = (f) => readFileSync(f, 'utf8');
const home = JSON.parse(rd(path.join(HERE, 'i18n', 'home.json')));
const LANGS = home._langs, NAMES = home._langNames, OTHER = LANGS.filter(l => l !== 'en');
const chrome = (key, lang) => {
  const e = home[key];
  if (!e) throw new Error(`home.json: unknown key ${key}`);
  return e[lang] != null ? e[lang] : e.en;
};
const VERSION = rd(path.join(HERE, '..', 'src', 'constants.js')).match(/const\s+TUNL_VERSION\s*=\s*['"]([^'"]+)['"]/)[1];

// ---------- text units -------------------------------------------------------
const norm = (t) => t.replace(/\s+/g, ' ').trim();
const keyOf = (t) => createHash('sha1').update(t).digest('hex').slice(0, 7);
const plainOf = (t) => t.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

// A run of text is worth translating when it holds an actual word. Ship names, version
// numbers, units ("60px"), URLs, e-mail addresses and lone <code> tokens are not.
function isUnitPlain(plain) {
  if (!/\p{L}{3}/u.test(plain)) return false;
  if (/^[A-Z0-9 ._\-\/+:%,()&#;x×]+$/.test(plain)) return false;
  if (/^[\w.+-]+@[\w.-]+$/.test(plain) || /^https?:\/\/\S+$/.test(plain)) return false;
  return true;
}
function isUnit(run) {
  const t = run.trim();
  if (!t) return false;
  if (/^<code>[^<]*<\/code>$/.test(t)) return false;
  return isUnitPlain(plainOf(t));
}

const BLOCK = new RegExp('(<\\/?(?:html|head|body|title|p|li|ul|ol|h[1-6]|table|thead|tbody|tfoot|tr|td|th|div|section|article|header|footer|main|nav|dl|dt|dd|figure|figcaption|blockquote|details|summary|aside|br|hr|form|button|label|select|option|video|audio|source|caption|colgroup|col|meta|link|base)\\b[^>]*>)', 'gi');
const M_S = '', M_E = '';
function mask(html) {
  const store = [];
  const put = (m) => { store.push(m); return M_S + (store.length - 1) + M_E; };
  const h = html
    .replace(/<!-- site-chrome:(\w+) -->[\s\S]*?<!-- \/site-chrome:\1 -->/g, put)
    .replace(/<!--[\s\S]*?-->/g, put)
    .replace(/<script\b[\s\S]*?<\/script>/gi, put)
    .replace(/<style\b[\s\S]*?<\/style>/gi, put)
    .replace(/<pre\b[\s\S]*?<\/pre>/gi, put)
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, put);
  return [h, store];
}
const unmask = (h, store) => h.replace(/(\d+)/g, (_, i) => store[+i]);
const escAttr = (s) => s.replace(/"/g, '&quot;');

// One walk used for BOTH collecting units and substituting translations, so what a
// translator is shown and what the build replaces can never disagree.
//   tr(text) -> replacement text (identity while collecting)
const JSON_KEYS = new Set(['name', 'description', 'headline', 'alternativeHeadline', 'text', 'abstract']);
function walkJson(node, fn) {
  if (Array.isArray(node)) { node.forEach(n => walkJson(n, fn)); return; }
  if (!node || typeof node !== 'object') return;
  const skipName = node['@type'] === 'Person' || node['@type'] === 'Organization';
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (typeof v === 'string') {
      if (JSON_KEYS.has(k) && !(k === 'name' && skipName) && isUnitPlain(norm(v))) node[k] = fn(norm(v));
    } else walkJson(v, fn);
  }
}
function transform(html, tr, opts = {}) {
  let h = html;
  // 1. structured data
  h = h.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (m, a, body, z) => {
    const obj = JSON.parse(body);
    walkJson(obj, tr);
    if (opts.lang) {
      obj.inLanguage = htmlLang(opts.lang);
      if (typeof obj.mainEntityOfPage === 'string') obj.mainEntityOfPage = pageUrl(opts.lang, opts.page);
    }
    return opts.collect ? m : a + '\n' + JSON.stringify(obj, null, 2) + '\n' + z;
  });
  // 2. text runs, then attributes and head meta
  let [mh, store] = mask(h);
  const parts = mh.split(BLOCK);
  for (let i = 0; i < parts.length; i += 2) {
    if (!isUnit(parts[i])) continue;
    const m = parts[i].match(/^(\s*)([\s\S]*?)(\s*)$/);
    parts[i] = m[1] + tr(norm(m[2])) + m[3];
  }
  mh = parts.join('');
  mh = mh.replace(/(\s(?:alt|title|aria-label|placeholder)=")([^"]*)(")/g,
    (m, a, v, z) => (isUnitPlain(plainOf(v)) ? a + escAttr(tr(norm(v))) + z : m));
  mh = mh.replace(/(<meta\b[^>]*?\b(?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)"[^>]*?\bcontent=")([^"]*)(")/g,
    (m, a, v, z) => a + escAttr(tr(norm(v))) + z);
  return unmask(mh, store);
}
function collectUnits(html) {
  const units = new Map();
  transform(html, (t) => { units.set(keyOf(t), t); return t; }, { collect: true });
  return units;
}

// ---------- generated chrome -------------------------------------------------
const pageUrl = (lang, page) => ORIGIN + (lang === 'en' ? '' : '/' + lang) + '/' + page + '/';
const NAV_ITEMS = [['/how-to-play/', 'footer.howto'], ['/ships/', 'footer.ships'], ['/devlog/', 'footer.devlog'], ['/changelog/', 'footer.changelog']];
const SHEET_ITEMS = [...NAV_ITEMS, ['/about/', 'footer.about'], ['/support/', 'footer.support'], ['/press/', 'footer.press'], ['/privacy/', 'footer.privacy'], ['/impressum/', 'footer.imprint']];
const currentOf = (page) => (page.startsWith('devlog') ? '/devlog/' : `/${page}/`);
const GENERATED = new Set();   // "lang:page" pairs that will exist

function navHtml(lang, page) {
  const cur = currentOf(page);
  const a = (h, k, ind) => `${ind}<a href="${h}"${h === cur ? ' aria-current="page"' : ''}>${chrome(k, lang)}</a>`;
  return `<!-- site-chrome:nav -->
  <header class="sitenav">
    <a class="sn-brand" href="/"><img src="/wordmark.svg" alt="TUNL"></a>
    <nav class="sn-links" aria-label="${chrome('aria.main', lang)}">
${NAV_ITEMS.map(([h, k]) => a(h, k, '      ')).join('\n')}
    </nav>
    <span class="sn-gap"></span>
    <a class="sn-ver" href="/changelog/">${VERSION}</a>
    <a class="sn-cta" href="/play/"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>${chrome('nav.play', lang)}</a>
    <details class="sn-more">
      <summary aria-label="${chrome('aria.menu', lang)}">&#9776;</summary>
      <div class="sn-sheet">
${SHEET_ITEMS.map(([h, k]) => a(h, k, '        ')).join('\n')}
      </div>
    </details>
  </header>
  <!-- /site-chrome:nav -->`;
}
function langSwitch(lang, page) {
  const have = LANGS.filter(l => l === 'en' || GENERATED.has(`${l}:${page}`));
  if (have.length < 2) return '';
  const opts = have.map(l => {
    const url = l === 'en' ? `/${page}/` : `/${l}/${page}/`;
    const homeUrl = l === 'en' ? '/' : `/${l}/`;
    return `<option value="${url}" data-home="${homeUrl}"${l === lang ? ' selected' : ''}>${NAMES[l]}</option>`;
  }).join('');
  const lbl = chrome('footer.langLabel', lang);
  return `<span class="langsw"><label for="langsel">${lbl}:</label> <select id="langsel" aria-label="${lbl}">${opts}</select></span>`;
}
const LANG_JS = `<script>(function(){var s=document.getElementById('langsel');if(!s)return;s.addEventListener('change',function(){try{localStorage.setItem('tunl_site_lang',s.options[s.selectedIndex].getAttribute('data-home'));}catch(e){}location.href=s.value;});})();</script>`;
function footHtml(lang, page) {
  const c = (k) => chrome(k, lang);
  const sw = langSwitch(lang, page);
  return `<!-- site-chrome:foot -->
  <footer class="sitefoot">
    <div class="sf-inner">
      <div class="sf-cols">
        <div class="sf-col">
          <h4>${c('foot.colPlay')}</h4>
          <a href="/play/">${c('hero.playCta')}</a>
          <a href="${APPSTORE}" target="_blank" rel="noopener">App Store</a>
          <a href="${PLAYSTORE}" target="_blank" rel="noopener">Google Play</a>
        </div>
        <div class="sf-col">
          <h4>${c('guides.head')}</h4>
          <a href="/how-to-play/">${c('footer.howto')}</a>
          <a href="/ships/">${c('footer.ships')}</a>
          <a href="/devlog/">${c('footer.devlog')}</a>
          <a href="/changelog/">${c('footer.changelog')}</a>
        </div>
        <div class="sf-col">
          <h4>${c('foot.colMore')}</h4>
          <a href="/about/">${c('footer.about')}</a>
          <a href="/support/">${c('footer.support')}</a>
          <a href="/press/">${c('footer.press')}</a>
          <a href="/privacy/">${c('footer.privacy')}</a>
          <a href="/impressum/">${c('footer.imprint')}</a>
        </div>
      </div>
      <p class="sf-legal">${c('footer.rights')}${sw ? '<br>' + sw : ''}</p>
    </div>
  </footer>${sw ? '\n  ' + LANG_JS : ''}
  <!-- /site-chrome:foot -->`;
}
function altHtml(page) {
  const lines = [];
  for (const l of LANGS) {
    if (l !== 'en' && !GENERATED.has(`${l}:${page}`)) continue;
    lines.push(`<link rel="alternate" hreflang="${htmlLang(l)}" href="${pageUrl(l, page)}">`);
  }
  lines.push(`<link rel="alternate" hreflang="x-default" href="${pageUrl('en', page)}">`);
  return `<!-- site-chrome:alt -->\n${lines.join('\n')}\n<!-- /site-chrome:alt -->`;
}
const setRegion = (html, name, content) => {
  const re = new RegExp(`<!-- site-chrome:${name} -->[\\s\\S]*?<!-- \\/site-chrome:${name} -->`);
  if (!re.test(html)) throw new Error(`marker site-chrome:${name} missing`);
  return html.replace(re, () => content);
};
function withChrome(html, lang, page) {
  if (!html.includes('site-chrome:alt')) {
    html = html.replace(/(<link rel="canonical"[^>]*>)/, '$1\n<!-- site-chrome:alt -->\n<!-- /site-chrome:alt -->');
  }
  html = setRegion(html, 'nav', navHtml(lang, page));
  html = setRegion(html, 'foot', footHtml(lang, page));
  html = setRegion(html, 'alt', altHtml(page));
  return html;
}

// ---------- link localisation ------------------------------------------------
function locHref(lang, href) {
  const m = href.match(/^([^#?]*)(.*)$/);
  const base = m[1], rest = m[2];
  if (base === '/') return `/${lang}/${rest}`;
  if (PAGE_SET.has(base) && GENERATED.has(`${lang}:${base.slice(1, -1)}`)) return `/${lang}${base}${rest}`;
  return href;
}
const localizeLinks = (html, lang) =>
  html.replace(/(\bhref=")(\/(?!\/)[^"]*)(")/g, (m, a, h, z) => a + locHref(lang, h) + z);

// ---------- translations -----------------------------------------------------
function loadTranslations() {
  const T = {};
  if (!existsSync(TRANS_DIR)) return T;
  for (const f of readdirSync(TRANS_DIR).sort()) {
    const m = f.match(/^([a-z]{2})\.[\w-]+\.json$/);
    if (!m) continue;
    let obj;
    try { obj = JSON.parse(rd(path.join(TRANS_DIR, f))); }
    catch (e) { throw new Error(`i18n/pages/${f}: invalid JSON (${e.message})`); }
    Object.assign(T[m[1]] = T[m[1]] || {}, obj);
  }
  return T;
}
const tagSig = (t) => [...t.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g)].map(m => {
  const href = (m[3].match(/\b(?:href|src)="([^"]*)"/) || [])[1] || '';
  const cls = (m[3].match(/\bclass="([^"]*)"/) || [])[1] || '';
  return `${m[1]}${m[2].toLowerCase()}|${href}|${cls}`;
}).join('>');
const codeSig = (t) => [...t.matchAll(/<code>([\s\S]*?)<\/code>/g)].map(m => m[1]).join('\u0001');
function invalid(en, tr) {
  if (typeof tr !== 'string' || !tr.trim()) return 'empty';
  if (tagSig(en) !== tagSig(tr)) return 'tags/links differ';
  if (codeSig(en) !== codeSig(tr)) return '<code> tokens differ';
  if (tr.includes('\u2014')) return 'em dash (project rule: hyphen-minus only)';
  return null;
}

// ---------- main -------------------------------------------------------------
const readEn = (page) => rd(path.join(SITE, page, 'index.html'));
const args = process.argv.slice(2);
const T = loadTranslations();

// corpus of English units per page (from the English pages as they are on disk)
const UNITS = {};
const allKeys = new Map();
for (const p of PAGES) {
  UNITS[p] = collectUnits(readEn(p));
  for (const [k, t] of UNITS[p]) {
    if (allKeys.has(k) && allKeys.get(k) !== t) throw new Error(`hash collision on ${k}: "${allKeys.get(k)}" vs "${t}"`);
    allKeys.set(k, t);
  }
}
const stats = {};   // stats[lang][page] = { total, ok, bad:[], missing:[] }
for (const l of OTHER) {
  stats[l] = {};
  for (const p of PAGES) {
    const s = { total: UNITS[p].size, ok: 0, bad: [], missing: [] };
    for (const [k, en] of UNITS[p]) {
      const tr = (T[l] || {})[k];
      if (tr === undefined) { s.missing.push(k); continue; }
      const why = invalid(en, tr);
      if (why) s.bad.push([k, why]); else s.ok++;
    }
    stats[l][p] = s;
    if (s.ok / s.total >= MIN_COVERAGE) GENERATED.add(`${l}:${p}`);
  }
}

if (args[0] === '--list') {
  const want = (args[1] || '').split(',').filter(Boolean);
  const seen = new Set();
  for (const p of want) {
    if (!UNITS[p]) throw new Error(`unknown page ${p}`);
    console.log(`## ${p}`);
    for (const [k, t] of UNITS[p]) { if (seen.has(k)) continue; seen.add(k); console.log(`${k}\t${t}`); }
  }
  process.exit(0);
}
if (args[0] === '--excluded') {
  const seen = new Set();
  for (const p of PAGES) {
    const [mh] = mask(readEn(p));
    for (let i = 0; i < mh.split(BLOCK).length; i += 2) {
      const r = mh.split(BLOCK)[i];
      const pl = plainOf(r);
      if (r.trim() && /\p{L}/u.test(pl) && !isUnit(r) && !seen.has(pl)) { seen.add(pl); console.log(pl.slice(0, 80)); }
    }
  }
  process.exit(0);
}
if (args[0] === '--missing' || args[0] === '--todo') {
  if (args[0] === '--todo') {
    const l = args[1];
    const only = (args[2] || '').split(',').filter(Boolean);
    for (const p of PAGES) {
      if (only.length && !only.includes(p)) continue;
      const s = stats[l][p];
      const ks = [...s.missing, ...s.bad.map(b => b[0])];
      if (!ks.length) continue;
      console.log(`## ${p}  (${ks.length} of ${s.total})`);
      for (const k of ks) console.log(`${k}\t${UNITS[p].get(k)}${s.bad.find(b => b[0] === k) ? '   [INVALID: ' + s.bad.find(b => b[0] === k)[1] + ']' : ''}`);
    }
    process.exit(0);
  }
  const short = (p) => p.replace('devlog/', 'd/').slice(0, 8).padEnd(8);
  console.log('lang  ' + PAGES.map(short).join(' '));
  for (const l of OTHER) {
    console.log(l.padEnd(5) + ' ' + PAGES.map(p => {
      const s = stats[l][p]; return (Math.round(100 * s.ok / s.total) + '%').padEnd(8);
    }).join(' '));
  }
  process.exit(0);
}

// ----- build -----
const problems = [];
for (const l of OTHER) for (const p of PAGES) {
  for (const [k, why] of stats[l][p].bad) problems.push(`${l}/${p} ${k}: ${why}`);
}

// English pages: regenerate their chrome in place
for (const p of PAGES) {
  const cur = readEn(p);
  const next = withChrome(cur, 'en', p);
  if (next !== cur) writeFileSync(path.join(SITE, p, 'index.html'), next);
}

let written = 0;
for (const l of OTHER) {
  for (const p of PAGES) {
    const outDir = path.join(SITE, l, p);
    if (!GENERATED.has(`${l}:${p}`)) { rmSync(outDir, { recursive: true, force: true }); continue; }
    let h = withChrome(readEn(p), l, p);
    const tl = T[l] || {};
    h = transform(h, (t) => {
      const k = keyOf(t);
      const tr = tl[k];
      return tr !== undefined && !invalid(t, tr) ? tr : t;
    }, { lang: l, page: p });
    h = h.replace('<html lang="en">', `<html lang="${htmlLang(l)}"${dirAttr(l)}>`);
    h = h.replace(/(<link rel="canonical" href=")[^"]*(">)/, `$1${pageUrl(l, p)}$2`);
    h = h.replace(/(<meta property="og:url" content=")[^"]*(">)/, `$1${pageUrl(l, p)}$2`);
    h = localizeLinks(h, l);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, 'index.html'), h);
    written++;
  }
}

// localized homepages: their nav/footer/chapter links point at guide pages, which
// only exist in some languages - relink them to whatever was actually produced
for (const l of OTHER) {
  const f = path.join(SITE, l, 'index.html');
  if (!existsSync(f)) continue;
  writeFileSync(f, localizeLinks(rd(f), l));
}

// sitemap
const today = new Date().toISOString().slice(0, 10);
const PRI = { '': ['weekly', 1.0], 'play': ['daily', 0.9], 'how-to-play': ['monthly', 0.8], 'ships': ['monthly', 0.8],
  'devlog': ['weekly', 0.7], 'devlog/run-pacing': ['yearly', 0.7], 'devlog/same-ship-every-screen': ['yearly', 0.7],
  'devlog/thrust-retune': ['yearly', 0.7], 'devlog/three-quarter-ship': ['yearly', 0.7],
  'devlog/first-two-months': ['yearly', 0.7], 'devlog/daily-cave': ['yearly', 0.8], 'changelog': ['monthly', 0.6],
  'about': ['yearly', 0.5], 'support': ['monthly', 0.5], 'press': ['monthly', 0.4], 'privacy': ['yearly', 0.3],
  'impressum': ['yearly', 0.2] };
const urlFor = (l, page) => ORIGIN + (l === 'en' ? '' : '/' + l) + '/' + (page ? page + '/' : '');
const entries = [];
const add = (page, langs) => {
  const [freq, pri] = PRI[page];
  const alts = langs.map(l => `    <xhtml:link rel="alternate" hreflang="${htmlLang(l)}" href="${urlFor(l, page)}"/>`)
    .concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor('en', page)}"/>`).join('\n');
  for (const l of langs) {
    const p = l === 'en' ? pri : Math.max(0.1, Math.round((pri - 0.1) * 10) / 10);
    entries.push(`  <url>\n    <loc>${urlFor(l, page)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${p.toFixed(1)}</priority>\n${alts}\n  </url>`);
  }
};
add('', LANGS);
entries.push(`  <url>\n    <loc>${ORIGIN}/play/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>`);
for (const p of PAGES) add(p, LANGS.filter(l => l === 'en' || GENERATED.has(`${l}:${p}`)));
writeFileSync(path.join(SITE, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`);

const totalPairs = OTHER.length * PAGES.length;
console.log(`pages built: ${written}/${totalPairs} localized guide pages (${PAGES.length} English pages re-chromed), sitemap ${entries.length} urls`);
const under = [];
for (const l of OTHER) for (const p of PAGES) {
  const s = stats[l][p];
  if (s.ok < s.total && GENERATED.has(`${l}:${p}`)) under.push(`${l}/${p} ${s.total - s.ok} of ${s.total} still English`);
}
if (under.length) console.log(`partially translated (shown with English fallback):\n  ${under.join('\n  ')}`);
if (problems.length) console.log(`INVALID translations (ignored, English shown):\n  ${problems.slice(0, 40).join('\n  ')}${problems.length > 40 ? `\n  ... +${problems.length - 40}` : ''}`);
