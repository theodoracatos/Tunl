// Language metadata shared by build-site.mjs (homepage) and build-pages.mjs (guides).
// Kept out of both because build-site.mjs builds the moment it is imported.
//
// The game's `zh` is Traditional Chinese, so the site's is too: the URL stays /zh/,
// the markup says zh-Hant (html lang, hreflang) so search engines and screen readers
// get the script right. Arabic is the only right-to-left language.
export const BCP47 = { zh: 'zh-Hant' };
export const RTL   = new Set(['ar']);
export const htmlLang = (l) => BCP47[l] || l;
export const dirAttr  = (l) => (RTL.has(l) ? ' dir="rtl"' : '');
