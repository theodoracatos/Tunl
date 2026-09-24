// Worker side of the /play analytics relay (handleGA in ../src/index.js).
// Stubs globalThis.fetch to capture what would go to GA4's Measurement Protocol.
// Run: node flytunl-site/worker/test/test-ga.mjs
const mod = await import('/Users/theodoracatos/Development/Tunl/flytunl-site/worker/src/index.js');
const worker = mod.default;
const env = { GA_MEASUREMENT_ID: 'G-TEST', GA_API_SECRET: 'secret' };
let captured = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => { captured.push({ u: String(u), body: JSON.parse(o.body), ua: o.headers['user-agent'] }); return new Response(null, { status: 204 }); };

async function post(body, ua='UA/1.0') {
  captured = [];
  const req = new Request('https://w.dev/ga', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': ua }, body: JSON.stringify(body) });
  const res = await worker.fetch(req, env);
  return { status: res.status, json: await res.json().catch(()=>null), sent: captured[0] || null };
}
const ok = [];
function check(name, cond, extra='') { ok.push((cond?'PASS':'FAIL')+'  '+name+(cond?'':'  <- '+extra)); }

// 1. old payload shape (a cached page) still works, defaults to page_view
let r = await post({ cid: 'abcdef-0123', sid: '1700000000', dl: 'https://flytunl.ch/play/', dt: 'TUNL' });
check('alte Payload-Form -> page_view', r.status===200 && r.sent.body.events[0].name==='page_view', JSON.stringify(r));
check('engagement default 1', r.sent.body.events[0].params.engagement_time_msec===1);

// 2. run_end with score + real engagement
r = await post({ cid: 'abcdef-0123', sid: '1700000000', en: 'run_end', score: 137, run: 4, ms: 45000 });
check('run_end durchgereicht', r.sent.body.events[0].name==='run_end');
check('score uebernommen', r.sent.body.events[0].params.score===137);
check('run_index uebernommen', r.sent.body.events[0].params.run_index===4);
check('engagement echt', r.sent.body.events[0].params.engagement_time_msec===45000);

// 3. attribution
r = await post({ cid: 'abcdef-0123', sid: '1', en: 'page_view', source: 'reddit', medium: 'social', campaign: 'launch', dr: 'https://reddit.com/r/x' });
const p = r.sent.body.events[0].params;
check('source/medium/campaign', p.source==='reddit'&&p.medium==='social'&&p.campaign==='launch');
check('page_referrer', p.page_referrer==='https://reddit.com/r/x');

// 4. allowlist + clamping (public endpoint)
r = await post({ cid: 'abcdef-0123', sid: '1', en: 'purchase' });
check('unbekanntes Event -> 400', r.status===400 && r.sent===null, JSON.stringify(r));
r = await post({ cid: 'abcdef-0123', sid: '1', en: 'run_end', score: 1e12, ms: -5 });
check('score geklemmt', r.sent.body.events[0].params.score===9999999);
check('ms geklemmt', r.sent.body.events[0].params.engagement_time_msec===1);
r = await post({ cid: 'abcdef-0123', sid: '1', en: 'run_end', score: 'NaN-ish' });
check('nicht-numerischer score -> 0', r.sent.body.events[0].params.score===0);
r = await post({ cid: 'x', sid: '1' });
check('kaputte cid -> 400', r.status===400);

// 5. no secret
const r2 = await worker.fetch(new Request('https://w.dev/ga',{method:'POST',body:'{}'}), { GA_MEASUREMENT_ID:'G' });
check('ohne Secret -> 501', r2.status===501);

// 6. UA weitergereicht
r = await post({ cid: 'abcdef-0123', sid: '1' }, 'Mozilla/5.0 Test');
check('User-Agent weitergereicht', r.sent.ua==='Mozilla/5.0 Test');

// 7. /tt/ funnel events: store only ios|android, never free text
r = await post({ cid: 'abcdef-0123', sid: '1', en: 'store_click', store: 'ios' });
check('store_click mit store', r.sent.body.events[0].name==='store_click' && r.sent.body.events[0].params.store==='ios', JSON.stringify(r.sent));
r = await post({ cid: 'abcdef-0123', sid: '1', en: 'store_click', store: '<script>' });
check('store_click fremder store verworfen', r.status===200 && r.sent.body.events[0].params.store===undefined);
r = await post({ cid: 'abcdef-0123', sid: '1', en: 'pitch_open' });
check('pitch_open durchgereicht', r.sent.body.events[0].name==='pitch_open');

globalThis.fetch = realFetch;
console.log(ok.join('\n'));
console.log(ok.some(l=>l.startsWith('FAIL')) ? '\nFEHLGESCHLAGEN' : '\nalle gruen');
