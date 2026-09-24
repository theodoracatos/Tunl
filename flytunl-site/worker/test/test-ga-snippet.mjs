// Client side of the /play analytics relay: runs the snippet AS BUILT out of
// flytunl-site/site/play/index.html in a stub DOM, so it tests the shipped bytes
// rather than a copy. Covers the three things the 2026-09-14 rework exists for:
// a session that survives a reload and expires after 30 idle minutes, traffic
// source sent once per session, and run_start/run_end reaching the relay.
// Run `node flytunl-site/build-play.mjs` first, then:
// node flytunl-site/worker/test/test-ga-snippet.mjs
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const html = await readFile('/Users/theodoracatos/Development/Tunl/flytunl-site/site/play/index.html','utf8');
const m = html.match(/<!-- Web analytics \(relayed[\s\S]*?<script>([\s\S]*?)<\/script>/);
if (!m) throw new Error('Snippet nicht gefunden');
const code = m[1];
// The /tt/ landing's copy of the snippet (build-play.mjs gaHead(TT_GA_DEFAULT)).
const ttHtml = await readFile('/Users/theodoracatos/Development/Tunl/flytunl-site/site/tt/index.html','utf8');
const mt = ttHtml.match(/<!-- Web analytics \(relayed[\s\S]*?<script>([\s\S]*?)<\/script>/);
if (!mt) throw new Error('tt-Snippet nicht gefunden');

function makeEnv(store, search, referrer, now, src = code) {
  const sent = [];
  const win = {};
  const ctx = {
    localStorage: { getItem: k=>k in store?store[k]:null, setItem:(k,v)=>{store[k]=String(v);}, },
    crypto: { randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
    location: { search, href: 'https://flytunl.ch/play/'+search, origin: 'https://flytunl.ch' },
    document: { title: 'TUNL', referrer },
    URLSearchParams,
    Date: class extends Date { static now(){ return now; } },
    fetch: (u,o)=>{ sent.push(JSON.parse(o.body)); return Promise.resolve(); },
    window: win,
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { ctx, sent, store };
}
const out=[]; const check=(n,c,e='')=>out.push((c?'PASS':'FAIL')+'  '+n+(c?'':'  <- '+e));

// Lauf 1: frischer Besucher ueber utm-Link
let store={};
let a = makeEnv(store, '?utm_source=reddit&utm_medium=social&utm_campaign=launch', 'https://www.reddit.com/r/x', 1_700_000_000_000);
check('page_view beim Laden', a.sent.length===1 && a.sent[0].en==='page_view', JSON.stringify(a.sent));
check('utm als source', a.sent[0].source==='reddit' && a.sent[0].medium==='social' && a.sent[0].campaign==='launch');
check('referrer mitgeschickt', a.sent[0].dr==='https://www.reddit.com/r/x');
check('cid persistiert', !!store['tunl_ga_cid']);
check('session persistiert', !!JSON.parse(store['tunl_ga_ses']).id);
const sid1 = a.sent[0].sid;
// _tunlGA fuer das Spiel verfuegbar, Quelle nur beim ersten Event
a.ctx.window._tunlGA('run_start');
a.ctx.window._tunlGA('run_end', { score: 137, run: 3 });
check('run_start/run_end senden', a.sent[1].en==='run_start' && a.sent[2].en==='run_end');
check('Quelle nur einmal pro Sitzung', a.sent[1].source===undefined && a.sent[2].source===undefined, JSON.stringify(a.sent[1]));
check('score/run im run_end', a.sent[2].score===137 && a.sent[2].run===3);
check('alle Events gleiche sid', a.sent[1].sid===sid1 && a.sent[2].sid===sid1);

// Lauf 2: Reload 5 Minuten spaeter -> gleiche Sitzung
let b = makeEnv(store, '', '', 1_700_000_000_000 + 5*60*1000);
check('Reload behaelt Sitzung', b.sent[0].sid===sid1, b.sent[0].sid+' vs '+sid1);
check('Reload schickt keine Quelle nochmal', b.sent[0].source===undefined);
check('gleiche cid', b.sent[0].cid===a.sent[0].cid);

// Lauf 3: Rueckkehr 31 Minuten nach der LETZTEN Aktivitaet (Lauf 2 lag bei +5 min)
let c = makeEnv(store, '', '', 1_700_000_000_000 + 36*60*1000);
check('31 min nach letzter Aktivitaet -> neue Sitzung', c.sent[0].sid!==sid1, c.sent[0].sid);
// und die Gegenprobe: 29 min danach ist noch dieselbe
let d = makeEnv(store, '', '', 1_700_000_000_000 + 36*60*1000 + 29*60*1000);
check('29 min danach -> selbe Sitzung', d.sent[0].sid===c.sent[0].sid);
check('aber gleicher Nutzer', c.sent[0].cid===a.sent[0].cid);

// engagement time waechst
check('ms ist eine Zahl', typeof a.sent[0].ms === 'number');
// /tt/: a bare link (TikTok website button) is credited to tiktok; ttclid = a paid click;
// an explicit utm_source still wins. /play/ stays uncredited without utm.
let t = makeEnv({}, '', 'https://www.tiktok.com/', 1_700_000_000_000, mt[1]);
check('/tt/ ohne utm -> tiktok/referral', t.sent[0].source==='tiktok' && t.sent[0].medium==='referral' && t.sent[0].campaign==='tt_landing', JSON.stringify(t.sent[0]));
t = makeEnv({}, '?ttclid=abc', '', 1_700_000_000_000, mt[1]);
check('/tt/ mit ttclid -> paid', t.sent[0].source==='tiktok' && t.sent[0].medium==='paid', JSON.stringify(t.sent[0]));
t = makeEnv({}, '?utm_source=ig&utm_medium=story', '', 1_700_000_000_000, mt[1]);
check('/tt/ utm gewinnt', t.sent[0].source==='ig' && t.sent[0].medium==='story', JSON.stringify(t.sent[0]));
t = makeEnv({}, '', '', 1_700_000_000_000);
check('/play/ ohne utm bleibt ohne source', !t.sent[0].source, JSON.stringify(t.sent[0]));

console.log(out.join('\n'));
console.log(out.some(l=>l.startsWith('FAIL'))?'\nFEHLGESCHLAGEN':'\nalle gruen');
