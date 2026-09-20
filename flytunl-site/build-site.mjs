// ============================================================
//  build-site.mjs - generate the localized flytunl.ch homepage
// ============================================================
//  Source of truth: flytunl-site/home.src.html (a plain, valid English page -
//  edit it normally) + flytunl-site/i18n/home.json (key -> per-language string).
//
//  Output (all gitignored, rebuilt on every deploy):
//    site/index.html        English, at the root
//    site/de/index.html     Deutsch
//    site/fr/ it/ es/ pt/ ja/ ...
//
//  Each page is fully static and localized (text, <title>, meta, og:), carries
//  <html lang>, a canonical URL, and an hreflang alternate block, plus a footer
//  language switcher and a soft "view in your language" banner. A missing
//  translation falls back to English.
//
//  Marketing site only - never touches the app builds. Run from deploy.sh, or
//  `node flytunl-site/build-site.mjs`.
// ============================================================

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { htmlLang, dirAttr } from './lang-meta.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(here, 'site');
const SRC  = path.join(here, 'home.src.html');
const I18N = path.join(here, 'i18n/home.json');

const ORIGIN = 'https://flytunl.ch';


async function build() {
  // TUNL_VERSION: single source of truth in src/constants.js, shared by all three
  // targets. Stamped into each page's <head> as <meta name="tunl:version"> purely
  // for quick "which release is this site on" checks - not user-facing copy (the
  // "New in X" hero badge is the human-readable version signal).
  const constantsSrc = await readFile(path.join(here, '..', 'src', 'constants.js'), 'utf8');
  const verMatch = constantsSrc.match(/const\s+TUNL_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!verMatch) throw new Error('src/constants.js: TUNL_VERSION const not found');
  const TUNL_VERSION = verMatch[1];

  // site/day.js derives today's rock colour and world name from the UTC date the
  // same way the game does, so the site can name today's cave and take its colour
  // with no backend. It carries MIRRORS of WORLD_ADJ / WORLD_NOUN (src/world.js)
  // and WEEKDAY_PALETTES' planet + wallBase columns (src/constants.js). Re-read
  // them here and fail the build the moment they diverge - a silently stale mirror
  // would have the site announce a different cave than the game generates that day.
  assertDayTablesInSync(await readFile(path.join(SITE, 'day.js'), 'utf8'), constantsSrc,
                        await readFile(path.join(here, '..', 'src', 'world.js'), 'utf8'));

  const raw = JSON.parse(await readFile(I18N, 'utf8'));
  const LANGS = raw._langs;                 // ["en","de",...]
  const NAMES = raw._langNames;
  const strings = {};
  for (const [k, v] of Object.entries(raw)) if (!k.startsWith('_')) strings[k] = v;

  // path for a language: en -> "/", de -> "/de/"
  const langPath = (l) => (l === 'en' ? '/' : `/${l}/`);
  const t = (key, lang) => {
    const e = strings[key];
    if (!e) throw new Error(`home.json: unknown key "${key}"`);
    return e[lang] != null ? e[lang] : e.en;
  };

  // ---- 1. turn home.src.html into a template ------------------------
  let tpl = await readFile(SRC, 'utf8');

  // Keys used only by the generated markup (langswitch / banner), never present
  // verbatim in home.src.html - don't templatize them or warn about them.
  const PROGRAMMATIC = new Set(['footer.langLabel', 'aria.main']);

  // Replace each key's ENGLISH value with a {{key}} marker. Longest first, so a
  // short string that is a substring of a longer one can't corrupt it.
  const missing = [];
  const keysByLen = Object.keys(strings)
    .filter(k => strings[k].en != null && !PROGRAMMATIC.has(k))
    .sort((a, b) => strings[b].en.length - strings[a].en.length);
  for (const key of keysByLen) {
    const en = strings[key].en;
    if (!tpl.includes(en)) { missing.push(key); continue; }
    tpl = tpl.split(en).join(`{{${key}}}`);
  }
  if (missing.length) {
    console.warn('[build-site] WARNING - these keys were not found verbatim in home.src.html '
      + '(their English text will show in every language):\n  ' + missing.join('\n  '));
  }

  // structural injections (anchors that exist in home.src.html)
  tpl = tpl.replace('aria-label="Main"', 'aria-label="{{aria.main}}"');
  tpl = tpl.replace('<html lang="en">', '<html lang="{{HTMLLANG}}"{{DIR}}>');
  // Localized store screenshots: the 15.0 portrait frames carry a headline baked into
  // the image, and Screenshots/iOS_15.0/<locale>/ has a set per language, so a German
  // page shows German frames instead of English ones. home.src.html names the English
  // path (it has to stay a valid standalone page); every language swaps the directory.
  // NOTE the directory is /shots/, not /Screenshots/: "Screenshots" is itself a
  // translated key (s3.head), and step 1 above replaces every key's English value
  // wherever it appears - including inside a URL - so the ja page shipped
  // src="/スクリーンショット/12.1/01.webp" for as long as that path existed. The render
  // check at the end of this file now fails the build on that class of breakage.
  tpl = tpl.split('/shots/15.0/en/').join('/shots/15.0/{{SHOTLANG}}/');

  if (!tpl.includes('<meta property="og:type" content="website">')) {
    throw new Error('anchor <meta property="og:type"...> not found in home.src.html');
  }
  tpl = tpl.replace(
    '<meta property="og:type" content="website">',
    `<meta property="og:type" content="website">\n<meta name="tunl:version" content="${TUNL_VERSION}">\n{{HEAD_ALT}}`
  );
  // og:url is currently a fixed root URL - make it per-page
  tpl = tpl.replace(
    '<meta property="og:url" content="https://flytunl.ch/">',
    '<meta property="og:url" content="{{OG_URL}}">'
  );

  // Early <head> auto-redirect (English root only) - bounce a first-time visitor
  // to their browser language, once, then never again.
  tpl = tpl.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n{{AUTO_REDIRECT}}');

  // Version pill in the sticky bar: stamped from TUNL_VERSION, so it can never
  // go stale the way the hand-written "New in <version>" hero badge did (that
  // badge was a per-release translation chore in 7 languages and was removed
  // with it). home.src.html carries whatever version it was last edited with
  // so it stays a valid standalone page; the build overwrites it either way.
  const verPill = /(<a class="sn-ver" href="\/changelog\/">)[^<]*(<\/a>)/;
  if (!verPill.test(tpl)) {
    throw new Error('anchor <a class="sn-ver"> not found in home.src.html');
  }
  tpl = tpl.replace(verPill, `$1${TUNL_VERSION}$2`);

  // footer language control: the full picker on English, a single "English"
  // link on the localized pages. Anchored on an explicit marker inside the
  // footer's legal line rather than on '</footer>', so the switcher lands
  // inside the sitemap footer's own column block instead of after it.
  if (!tpl.includes('<!-- langswitch -->')) {
    throw new Error('anchor <!-- langswitch --> not found in home.src.html');
  }
  tpl = tpl.replace('<!-- langswitch -->', '{{LANGSWITCH}}');

  tpl = tpl.replace('</style>', LANG_CSS + '\n</style>');
  tpl = tpl.replace('</body>', LANG_JS + '\n</body>');

  // ---- 2. render one page per language -----------------------------
  await Promise.all(LANGS.filter(l => l !== 'en').map(l => rm(path.join(SITE, l), { recursive: true, force: true })));

  for (const lang of LANGS) {
    let html = tpl.replace(/\{\{([a-zA-Z0-9._]+)\}\}/g, (m, key) => {
      if (key === 'LANG') return lang;
      if (key === 'HTMLLANG') return htmlLang(lang);
      if (key === 'DIR') return dirAttr(lang);
      if (key === 'SHOTLANG') return lang;
      if (key === 'OG_URL') return ORIGIN + langPath(lang);
      if (key === 'HEAD_ALT') return headAlt(lang);
      if (key === 'AUTO_REDIRECT') return lang === 'en' ? redirectJs(LANGS) : '';
      if (key === 'LANGSWITCH') return langSwitch(lang);
      return t(key, lang);
    });

    // Every asset URL the page renders must still be an asset URL. Step 1 replaces each
    // key's English text wherever it occurs, with no idea what is markup and what is
    // prose, so a key whose English value happens to be a path segment ("Screenshots")
    // silently rewrites src="/Screenshots/..." into the translated word. That shipped
    // broken image links on the ja homepage; this turns it into a failed build.
    for (const m of html.matchAll(/(?:src|href)="(\/[^"]*\.[a-z0-9]{2,5})"/g)) {
      const url = m[1];
      if (!/^[\x20-\x7E]+$/.test(url)) {
        throw new Error(`[${lang}] non-ASCII asset URL "${url}" - an i18n key's English value collides with a path segment`);
      }
      if (!existsSync(path.join(SITE, url.replace(/^\//, '').split('?')[0]))) {
        throw new Error(`[${lang}] asset URL "${url}" does not exist under site/`);
      }
    }

    const outDir = lang === 'en' ? SITE : path.join(SITE, lang);
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'index.html'), html, 'utf8');
  }

  console.log(`site/ built - homepage in ${LANGS.length} languages (${LANGS.join(', ')})`);

  // ---- helpers ----------------------------------------------------
  function headAlt(lang) {
    const lines = [`<link rel="canonical" href="${ORIGIN}${langPath(lang)}">`];
    for (const l of LANGS) {
      lines.push(`<link rel="alternate" hreflang="${htmlLang(l)}" href="${ORIGIN}${langPath(l)}">`);
    }
    lines.push(`<link rel="alternate" hreflang="x-default" href="${ORIGIN}/">`);
    return lines.join('\n');
  }

  function langSwitch(lang) {
    if (lang === 'en') {
      const opts = LANGS.map(l =>
        `<option value="${langPath(l)}"${l === lang ? ' selected' : ''}>${NAMES[l]}</option>`
      ).join('');
      return `<span class="langsw">`
        + `<label for="langsel">${t('footer.langLabel', 'en')}:</label> `
        + `<select id="langsel" aria-label="${t('footer.langLabel', 'en')}">${opts}</select>`
        + `</span>`;
    }
    // Localized pages: only an escape hatch back to English.
    return `<a class="backtoen" href="/">English</a>`;
  }
}

// English root only: send the visitor to their language. A stored preference of
// "/" (set by the "English" link, or by picking English in the switcher) pins
// them to English; any other stored value sends them there every visit; with no
// preference yet, detect navigator.language once and remember it. Early in <head>
// so there is no visible flash. "en" maps to no target -> Googlebot is unaffected.
function redirectJs(langs) {
  const map = {};
  for (const l of langs) if (l !== 'en') map[l] = `/${l}/`;
  return `<script>
(function () {
  try {
    var LS = 'tunl_site_lang';
    var P = ${JSON.stringify(map)};
    var pref = localStorage.getItem(LS);
    if (pref === '/') return;
    if (pref && P[pref.replace(/\\//g, '')]) { location.replace(pref); return; }
    var nav = navigator.language || '';
    var l = nav.slice(0, 2).toLowerCase();
    /* /zh/ is Traditional Chinese: only zh-TW / zh-HK / zh-MO / zh-Hant browsers go there */
    if (l === 'zh' && !/^zh-(tw|hk|mo|hant)/i.test(nav)) return;
    if (P[l]) { localStorage.setItem(LS, P[l]); location.replace(P[l]); }
  } catch (e) {}
})();
</script>`;
}

const LANG_CSS = `
  /* ---------- Language control ---------- */
  .langsw { display:inline-flex; align-items:center; gap:6px; }
  .langsw label { color:var(--text-faint); font-size:12px; }
  .langsw select {
    background:var(--panel); color:var(--text-dim);
    border:1px solid var(--line); border-radius:8px;
    padding:4px 8px; font-size:12px; font-family:var(--sans); cursor:pointer;
  }
  .langsw select:hover { border-color:var(--cyan); }
  .backtoen { color:var(--text-dim); font-size:12px; }
  .backtoen:hover { color:var(--cyan); }`;

const LANG_JS = `<script>
(function () {
  var LS = 'tunl_site_lang';
  var store = function (v) { try { localStorage.setItem(LS, v); } catch (e) {} };
  var sel = document.getElementById('langsel');
  if (sel) {
    sel.addEventListener('change', function () { store(sel.value); location.href = sel.value; });
  }
  var back = document.querySelector('.backtoen');
  if (back) {
    back.addEventListener('click', function () { store('/'); });
  }
})();
</script>`;


// ---- day-strip table mirror check -----------------------------------
// See the call site in build(). Compares the literal tables in site/day.js
// against the game's own source.
function assertDayTablesInSync(daySrc, constantsSrc, worldSrc) {
  const list = (src, name) => {
    const m = src.match(new RegExp(`(?:const\\s+)?${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
    if (!m) throw new Error(`[build-site] ${name} not found`);
    return (m[1].match(/'([^']*)'/g) || []).map(x => x.slice(1, -1));
  };
  const pairs = [
    ['WORLD_ADJ',  list(worldSrc, 'WORLD_ADJ'),  list(daySrc, 'ADJ')],
    ['WORLD_NOUN', list(worldSrc, 'WORLD_NOUN'), list(daySrc, 'NOUN')],
  ];

  const palette = constantsSrc.match(/const WEEKDAY_PALETTES = \[([\s\S]*?)\n\];/);
  if (!palette) throw new Error('[build-site] WEEKDAY_PALETTES not found');
  const rows = palette[1].split('\n').filter(l => l.includes('planet:'));
  pairs.push(['WEEKDAY_PALETTES.planet',
              rows.map(l => l.match(/planet:\s*'([^']*)'/)[1]),
              list(daySrc, 'PLANET')]);

  const wallGame = rows.map(l => l.match(/wallBase:\s*\[([^\]]*)\]/)[1]
                                  .split(',').map(n => Number(n.trim())).join(','));
  const wallSite = (daySrc.match(/var WALL = \[(.*?)\];/) || [, ''])[1]
                     .match(/\[[^\]]*\]/g) || [];
  pairs.push(['WEEKDAY_PALETTES.wallBase', wallGame,
              wallSite.map(x => x.slice(1, -1).split(',').map(n => Number(n.trim())).join(','))]);

  for (const [name, fromGame, fromSite] of pairs) {
    if (fromGame.join('|') !== fromSite.join('|')) {
      throw new Error(
        `[build-site] site/day.js's mirror of ${name} has drifted from src/.\n`
        + `  src/  (${fromGame.length}): ${fromGame.join(', ')}\n`
        + `  site  (${fromSite.length}): ${fromSite.join(', ')}\n`
        + '  Update the table in site/day.js to match, then rebuild.');
    }
  }
}

build().catch(err => { console.error('[build-site] failed:', err); process.exit(1); });
