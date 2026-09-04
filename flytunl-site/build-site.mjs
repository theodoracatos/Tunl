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
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(here, 'site');
const SRC  = path.join(here, 'home.src.html');
const I18N = path.join(here, 'i18n/home.json');

const ORIGIN = 'https://flytunl.ch';

async function build() {
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
  const PROGRAMMATIC = new Set(['footer.langLabel']);

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
  tpl = tpl.replace('<html lang="en">', '<html lang="{{LANG}}">');

  if (!tpl.includes('<meta property="og:type" content="website">')) {
    throw new Error('anchor <meta property="og:type"...> not found in home.src.html');
  }
  tpl = tpl.replace(
    '<meta property="og:type" content="website">',
    '<meta property="og:type" content="website">\n{{HEAD_ALT}}'
  );
  // og:url is currently a fixed root URL - make it per-page
  tpl = tpl.replace(
    '<meta property="og:url" content="https://flytunl.ch/">',
    '<meta property="og:url" content="{{OG_URL}}">'
  );

  // Early <head> auto-redirect (English root only) - bounce a first-time visitor
  // to their browser language, once, then never again.
  tpl = tpl.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n{{AUTO_REDIRECT}}');

  // footer language control (before </footer>): the full picker on English, a
  // single "English" link on the localized pages.
  tpl = tpl.replace('</footer>', '    {{LANGSWITCH}}\n  </footer>');

  tpl = tpl.replace('</style>', LANG_CSS + '\n</style>');
  tpl = tpl.replace('</body>', LANG_JS + '\n</body>');

  // ---- 2. render one page per language -----------------------------
  await Promise.all(LANGS.filter(l => l !== 'en').map(l => rm(path.join(SITE, l), { recursive: true, force: true })));

  for (const lang of LANGS) {
    let html = tpl.replace(/\{\{([a-zA-Z0-9._]+)\}\}/g, (m, key) => {
      if (key === 'LANG') return lang;
      if (key === 'OG_URL') return ORIGIN + langPath(lang);
      if (key === 'HEAD_ALT') return headAlt(lang);
      if (key === 'AUTO_REDIRECT') return lang === 'en' ? REDIRECT_JS : '';
      if (key === 'LANGSWITCH') return langSwitch(lang);
      return t(key, lang);
    });

    const outDir = lang === 'en' ? SITE : path.join(SITE, lang);
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'index.html'), html, 'utf8');
  }

  console.log(`site/ built - homepage in ${LANGS.length} languages (${LANGS.join(', ')})`);

  // ---- helpers ----------------------------------------------------
  function headAlt(lang) {
    const lines = [`<link rel="canonical" href="${ORIGIN}${langPath(lang)}">`];
    for (const l of LANGS) {
      lines.push(`<link rel="alternate" hreflang="${l}" href="${ORIGIN}${langPath(l)}">`);
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

// English root only: bounce a first-time visitor to their browser language once,
// then remember the choice so it never fires again (and so returning to "/" via
// the English link stays English). Early in <head> so there is no visible flash.
const REDIRECT_JS = `<script>
(function () {
  try {
    var LS = 'tunl_site_lang';
    if (localStorage.getItem(LS)) return;
    var P = { de:'/de/', fr:'/fr/', it:'/it/', es:'/es/', pt:'/pt/', ja:'/ja/' };
    var l = (navigator.language || '').slice(0, 2).toLowerCase();
    if (P[l]) { localStorage.setItem(LS, P[l]); location.replace(P[l]); }
  } catch (e) {}
})();
</script>`;

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

build().catch(err => { console.error('[build-site] failed:', err); process.exit(1); });
