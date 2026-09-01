// Verify every 8.1 release-notes locale fits Google Play's 500-char per-locale limit.
// Run: node store-metadata/8.1/check-lengths.js
const fs = require('fs');
const path = require('path');

const md = fs.readFileSync(path.join(__dirname, 'release-notes.md'), 'utf8');
const LIMIT = 500;
const LANGS = ['en','de','fr','it','es','pt','ja','ko','zh','ru','ar','tr','id','vi','hi'];

// Sections are "## <lang>\n\n<body>\n" and the body runs to the next "## " or "---".
const bodies = {};
const re = /^## ([a-z-]+)\s*\n+([\s\S]*?)(?=\n## |\n---|\s*$)/gm;
let m;
while ((m = re.exec(md)) !== null) bodies[m[1]] = m[2].trim();

let fail = false;
for (const l of LANGS) {
    const b = bodies[l];
    if (!b) { console.log(`MISSING  ${l}`); fail = true; continue; }
    const n = [...b].length; // code-point count, matches how the consoles count
    const flag = n > LIMIT ? 'OVER   ' : 'ok     ';
    if (n > LIMIT) fail = true;
    console.log(`${flag} ${l.padEnd(3)} ${n}`);
}
process.exit(fail ? 1 : 0);
