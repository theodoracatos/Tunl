#!/usr/bin/env node
// Zero-dependency check: every language in src/i18n.js must expose the same
// keys as English, and skinPerks/skinDrawbacks arrays must line up by index (they're
// looked up positionally against SKINS in draw.js).
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const file = path.join(__dirname, 'src', 'i18n.js');
const src  = fs.readFileSync(file, 'utf8');

const sandbox = {
    localStorage: { getItem: () => null, setItem: () => {} },
    navigator:    { language: 'en' },
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: file });
// top-level const/let don't land on the sandbox object automatically -
// pull them out explicitly via a second run in the same context.
vm.runInContext('this.__LANGS = LANGS; this.__LANG_ORDER = LANG_ORDER;', sandbox);

const { __LANGS: LANGS, __LANG_ORDER: LANG_ORDER } = sandbox;

const refKeys        = Object.keys(LANGS.en).sort();
const refPerkLen     = LANGS.en.skinPerks.length;
const refDrawbackLen = LANGS.en.skinDrawbacks.length;
let failed = false;

for (const langCode of LANG_ORDER) {
    const lang = LANGS[langCode];
    if (!lang) {
        console.error(`✗ ${langCode}: missing from LANGS`);
        failed = true;
        continue;
    }

    const keys    = Object.keys(lang).sort();
    const missing = refKeys.filter(k => !keys.includes(k));
    const extra   = keys.filter(k => !refKeys.includes(k));

    if (missing.length || extra.length) {
        failed = true;
        console.error(`✗ ${langCode}`);
        if (missing.length) console.error(`   missing: ${missing.join(', ')}`);
        if (extra.length)   console.error(`   extra:   ${extra.join(', ')}`);
    } else if (lang.skinPerks.length !== refPerkLen) {
        failed = true;
        console.error(`✗ ${langCode}: skinPerks length ${lang.skinPerks.length} !== ${refPerkLen}`);
    } else if (lang.skinDrawbacks.length !== refDrawbackLen) {
        failed = true;
        console.error(`✗ ${langCode}: skinDrawbacks length ${lang.skinDrawbacks.length} !== ${refDrawbackLen}`);
    } else {
        console.log(`✓ ${langCode}`);
    }
}

if (failed) {
    console.error('\ni18n check FAILED');
    process.exit(1);
} else {
    console.log('\nAll languages have matching keys.');
}
