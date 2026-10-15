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

const refKeys         = Object.keys(LANGS.en).sort();
const refPerkLen      = LANGS.en.skinPerks.length;
const refDrawbackLen  = LANGS.en.skinDrawbacks.length;
const refMissionKeys  = Object.keys(LANGS.en.missionDesc).sort();
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
    } else if (JSON.stringify(Object.keys(lang.missionDesc).sort()) !== JSON.stringify(refMissionKeys)) {
        failed = true;
        console.error(`✗ ${langCode}: missionDesc keys ${Object.keys(lang.missionDesc).sort().join(',')} !== ${refMissionKeys.join(',')}`);
    } else {
        console.log(`✓ ${langCode}`);
    }
}

// The Devanagari alignment wrapper (i18n.js, WebKit drops textAlign for Devanagari): load
// i18n.js again with a recording canvas prototype and check what reaches the real fillText.
{
    const calls = [];
    class Ctx2D {
        constructor() { this.textAlign = 'center'; }
        measureText(t) { return { width: t.length * 10 }; }
        fillText(t, x, y, mw) { calls.push({ t, x, al: this.textAlign, mw }); }
        strokeText(t, x, y, mw) { calls.push({ t, x, al: this.textAlign, mw, stroke: true }); }
    }
    const sb = { localStorage: { getItem: k => (k === 'tunnel_lang' ? 'hi' : null), setItem() {} },
                 navigator: { language: 'en' }, CanvasRenderingContext2D: Ctx2D };
    vm.createContext(sb);
    vm.runInContext(src, sb, { filename: file });
    const c = new Ctx2D();
    const hi = 'दुनिया';                           // 6 code units -> width 60
    const check = (name, ok) => { if (ok) console.log(`✓ ${name}`); else { console.error(`✗ ${name} ${JSON.stringify(calls)}`); failed = true; } };
    calls.length = 0; c.textAlign = 'center'; c.fillText(hi, 100, 0);
    check('hi centred Devanagari drawn left from x - w/2', calls[0].al === 'left' && calls[0].x === 70 && c.textAlign === 'center');
    calls.length = 0; c.textAlign = 'right'; c.strokeText(hi, 100, 0, 40);
    check('hi right-aligned stroke drawn left from x - min(w, maxWidth)', calls[0].al === 'left' && calls[0].x === 60 && calls[0].mw === 40 && c.textAlign === 'right');
    calls.length = 0; c.textAlign = 'center'; c.fillText('WORLD', 100, 0);
    check('hi Latin-only line keeps textAlign', calls[0].al === 'center' && calls[0].x === 100);
    vm.runInContext("setLang('de')", sb);
    calls.length = 0; c.textAlign = 'center'; c.fillText(hi, 100, 0);
    check('other languages untouched', calls[0].al === 'center' && calls[0].x === 100);
}

if (failed) {
    console.error('\ni18n check FAILED');
    process.exit(1);
} else {
    console.log('\nAll languages have matching keys.');
}
