// ============================================================
//  tunl-scores - Cloudflare Worker: daily leaderboard for flytunl.ch/play
//  + campaign click tracking (GET /go/..., see that section) + the two-sided
//  referral reward (POST /referral, /referral/claim, see that section)
// ============================================================
//  Leaderboard endpoints (see ALLOWED_ORIGINS below for what's accepted):
//    GET  /t                 -> { t } a short-lived signed token
//    GET  /r?d=<day>&id=<id> -> { rank, total, best } for one player on one day
//    POST /s   { d, s, p, id, tok } -> records the score, returns { rank, total, best }
//
//  Storage: D1 (see schema.sql). One row per (day, player); the best score wins.
//  A daily cron prunes rows older than 45 days.
//
//  Anti-abuse is deliberately light (this is a free casual daily game): origin
//  lock, a signed token that must be fetched within 15 min and is at least 8 s
//  old, a score/play-time sanity check, an absolute score clamp, and a 5 s
//  floor between a player's submissions. A determined cheater can still get a
//  fake score in; the goal is only to stop drive-by curl spam.
// ============================================================

const ORIGIN = 'https://flytunl.ch';
// Requests can legitimately arrive from three places: the open web build (a
// real https://flytunl.ch origin), Android's native WebView (every page it
// loads is served from this fixed synthetic origin - see MainActivity.kt's
// WebViewAssetLoader), and iOS's native WebView, which loads tunl.html from a
// local file:// URL and - like every browser - sends Origin: null for a
// fetch() from an opaque/file origin, not the string "file://". A request
// with no Origin header at all (a plain top-level navigation, e.g. GET /go/…
// or GET /clicks below) was already exempt before this existed, since the
// check only ever fires when `origin` is truthy.
const ALLOWED_ORIGINS = new Set([ORIGIN, 'https://appassets.androidplatform.net', 'null']);
const SCORE_MAX = 50000;          // ~2 h of flawless play; anything above is junk
const TOKEN_MIN_AGE_MS = 8000;    // a real run cannot be shorter than this
const TOKEN_MAX_AGE_MS = 900000;  // 15 min
const SUBMIT_FLOOR_MS = 5000;     // min gap between one player's submissions
const PRUNE_DAYS = 45;
const CLICK_PRUNE_DAYS = 400;     // click history is worth keeping much longer than daily-leaderboard rows
const REFERRAL_PRUNE_DAYS = 400;
// Same score floor every other "was this worth something" gate in the game
// uses (CONTINUE_MIN_SCORE, SHARE_MIN_SCORE, REVIEW_MIN_SCORE in
// constants.js) - re-checked here independently of the client's own gate,
// since this one grants value and the client can't be trusted not to skip it.
const REFERRAL_MIN_SCORE = 25;
// Loose on purpose: covers both a real crypto.randomUUID() and web.js
// webPlayerId()'s no-crypto fallback shape ("anon-<timestamp>").
const ID_RE = /^[a-z0-9-]{4,64}$/i;

const enc = new TextEncoder();

function cors(extra) {
  return {
    'access-control-allow-origin': ORIGIN,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    ...(extra || {}),
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: cors({ 'content-type': 'application/json', 'cache-control': 'no-store' }),
  });
}

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// constant-time-ish string compare
function eq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function todayInt() {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

async function issueToken(secret) {
  const ts = Date.now();
  const rand = crypto.randomUUID().replace(/-/g, '');
  const sig = await hmacHex(secret, ts + '.' + rand);
  return ts + '.' + rand + '.' + sig;
}

async function verifyToken(secret, tok) {
  if (typeof tok !== 'string') return false;
  const parts = tok.split('.');
  if (parts.length !== 3) return false;
  const [tsStr, rand, sig] = parts;
  const ts = +tsStr;
  if (!Number.isFinite(ts)) return false;
  const age = Date.now() - ts;
  if (age < TOKEN_MIN_AGE_MS || age > TOKEN_MAX_AGE_MS) return false;
  return eq(sig, await hmacHex(secret, ts + '.' + rand));
}

async function rankFor(db, day, pid) {
  const row = await db.prepare('SELECT score FROM scores WHERE day = ?1 AND pid = ?2').bind(day, pid).first();
  const best = row ? row.score : null;
  const total = (await db.prepare('SELECT COUNT(*) AS c FROM scores WHERE day = ?1').bind(day).first())?.c || 0;
  if (best == null) return { rank: null, total, best: null };
  const above = (await db.prepare('SELECT COUNT(*) AS c FROM scores WHERE day = ?1 AND score > ?2').bind(day, best).first())?.c || 0;
  return { rank: above + 1, total, best };
}

// ── Campaign click tracking ──────────────────────────────────────────
// GET /go/<source>/<campaign>[?m=<medium>][&to=play]
// Redirects to flytunl.ch (or flytunl.ch/play/ with ?to=play) with UTM params
// baked on, and logs one row so GET /clicks can answer "which post actually
// drove traffic" - the one thing Cloudflare Web Analytics can't do, since it
// deliberately never logs query strings (see the project's viral-readiness
// audit). Deliberately stays on this worker's own workers.dev hostname
// rather than a route on the flytunl.ch zone: the domain's nameservers are
// Hoststar's (ns01/ns02.hostfactory.ch), not Cloudflare's, so a Worker Route
// on flytunl.ch itself would first need moving DNS there - a much bigger,
// separate decision than a redirect endpoint. A workers.dev link in a bio or
// caption works fine; a social/creator link doesn't need a branded domain to
// do its job.
//
// No lookup table, no pre-registration: any source/campaign slug just works
// the moment someone posts a link using it, matching the "tag every outbound
// link, even before anything reads them" habit the audit recommended - now
// something does.
const SLUG_RE = /^[a-z0-9_-]{1,40}$/i;

async function handleGo(url, db) {
  const parts = url.pathname.split('/').filter(Boolean); // ['go', source, campaign]
  const source = (parts[1] || '').toLowerCase();
  const campaign = (parts[2] || '').toLowerCase();
  // A malformed link still sends the visitor somewhere real rather than an
  // error page - the person clicked it expecting the game, not a 400.
  if (!SLUG_RE.test(source) || !SLUG_RE.test(campaign)) return Response.redirect(ORIGIN + '/', 302);

  const medium = (url.searchParams.get('m') || 'social').slice(0, 40);
  const toPlay = url.searchParams.get('to') === 'play';

  // Logging must never block the redirect - a D1 hiccup should cost a click
  // count, not strand a real visitor on an error.
  try {
    await db.prepare(
      'INSERT INTO clicks (day, source, campaign, medium, dest, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6)'
    ).bind(todayInt(), source, campaign, medium, toPlay ? 'play' : 'home', Date.now()).run();
  } catch (e) { /* see above */ }

  const target = new URL(toPlay ? '/play/' : '/', ORIGIN);
  target.searchParams.set('utm_source', source);
  target.searchParams.set('utm_medium', medium);
  target.searchParams.set('utm_campaign', campaign);
  return Response.redirect(target.toString(), 302);
}

// GET /clicks?key=<REPORT_KEY>[&since=<YYYYMMDD>]
// Aggregated click counts per source/campaign/medium - this is the developer's
// own marketing dashboard, not a public endpoint, so it's gated by a shared
// key (set with `wrangler secret put REPORT_KEY`) rather than the CORS origin
// lock above, which only ever applies to fetch()/XHR requests carrying an
// Origin header - a plain browser tab or curl hitting this URL directly sends
// none, so the origin check alone would do nothing here.
async function handleClicks(url, db, reportKey) {
  if (!reportKey || !eq(url.searchParams.get('key') || '', reportKey)) return json({ error: 'auth' }, 401);
  const sinceParam = +url.searchParams.get('since');
  const since = Number.isInteger(sinceParam) && sinceParam >= 20250101 ? sinceParam : 0;
  const { results } = await db.prepare(
    'SELECT source, campaign, medium, COUNT(*) AS clicks, MAX(ts) AS lastClick ' +
    'FROM clicks WHERE day >= ?1 GROUP BY source, campaign, medium ORDER BY clicks DESC'
  ).bind(since).all();
  return json({ since, rows: results });
}

// ── Referral reward ──────────────────────────────────────────────────
// POST /referral { referrer, referred, score } - called once from
// src/update.js commitDeath(), only on the *referred* player's own first
// real run (src/web.js submitReferral). Re-validates everything the client
// already gated on, since this grants value and the client can't be trusted:
// distinct ids, a real score floor, and `referred` as the table's PRIMARY KEY
// so the same referred player can never grant a second credit no matter how
// many times (or from how many devices) their client retries the submit.
async function handleReferral(request, db) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'body' }, 400);
  const referrer = String(body.referrer || '');
  const referred = String(body.referred || '');
  const score = Math.floor(+body.score);
  if (!ID_RE.test(referrer) || !ID_RE.test(referred) || referrer === referred) {
    return json({ error: 'ids' }, 400);
  }
  if (!Number.isFinite(score) || score < REFERRAL_MIN_SCORE) return json({ error: 'score' }, 400);

  try {
    await db.prepare(
      'INSERT INTO referrals (referred, referrer, score, day, ts, claimed) VALUES (?1, ?2, ?3, ?4, ?5, 0) ' +
      'ON CONFLICT(referred) DO NOTHING'
    ).bind(referred, referrer, score, todayInt(), Date.now()).run();
  } catch (e) {
    return json({ error: 'server' }, 500);
  }
  return json({ ok: true });
}

// POST /referral/claim { id } - called once at boot (main.js checkReferralReward)
// for every player, referrer or not. Marks every unclaimed referral row
// credited to this id as claimed and reports how many just were, so the
// client can multiply by its own REFERRAL_REWARD (constants.js) and top up
// local shards - the same "worker counts, client applies its own currency
// constant" split /go and /clicks don't need but the leaderboard's own /s
// endpoint also doesn't use, since unlike a score this genuinely is soft,
// client-owned currency (see constants.js REFERRAL_REWARD doc block).
async function handleReferralClaim(request, db) {
  const body = await request.json().catch(() => null);
  const id = String(body?.id || '');
  if (!ID_RE.test(id)) return json({ error: 'id' }, 400);

  const res = await db.prepare(
    'UPDATE referrals SET claimed = 1 WHERE referrer = ?1 AND claimed = 0'
  ).bind(id).run();
  return json({ claimed: res.meta?.changes || 0 });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });

    // Only serve the game's own origins (see ALLOWED_ORIGINS doc comment).
    const origin = request.headers.get('origin');
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'origin' }, 403);

    const url = new URL(request.url);
    const db = env.DB;
    const secret = env.TOKEN_SECRET;

    try {
      if (request.method === 'GET' && url.pathname.startsWith('/go/')) {
        return await handleGo(url, db);
      }

      if (request.method === 'POST' && url.pathname === '/referral') {
        return await handleReferral(request, db);
      }

      if (request.method === 'POST' && url.pathname === '/referral/claim') {
        return await handleReferralClaim(request, db);
      }

      if (request.method === 'GET' && url.pathname === '/clicks') {
        return await handleClicks(url, db, env.REPORT_KEY);
      }

      if (request.method === 'GET' && url.pathname === '/t') {
        return json({ t: await issueToken(secret) });
      }

      if (request.method === 'GET' && url.pathname === '/r') {
        const day = +url.searchParams.get('d');
        const id = url.searchParams.get('id') || '';
        if (!Number.isInteger(day) || day < 20250101 || !/^[0-9a-f-]{8,64}$/i.test(id)) return json({ error: 'params' }, 400);
        return json(await rankFor(db, day, id));
      }

      if (request.method === 'POST' && url.pathname === '/s') {
        const body = await request.json().catch(() => null);
        if (!body) return json({ error: 'body' }, 400);

        const day = +body.d;
        let score = Math.floor(+body.s);
        const play = Math.max(0, Math.floor(+body.p || 0));
        const id = String(body.id || '');

        if (day !== todayInt()) return json({ rank: null, total: 0, best: null }); // past-day replay: not recorded
        if (!/^[0-9a-f-]{8,64}$/i.test(id)) return json({ error: 'id' }, 400);
        if (!Number.isFinite(score) || score <= 0) return json({ error: 'score' }, 400);
        if (!await verifyToken(secret, body.tok)) return json({ error: 'token' }, 401);
        // score can grow at most ~10-12 pts/s (distance + combo/near-miss bonus); allow slack
        if (score > play * 12 + 25) return json({ error: 'implausible' }, 422);

        score = Math.min(score, SCORE_MAX);

        const prev = await db.prepare('SELECT score, ts FROM scores WHERE day = ?1 AND pid = ?2').bind(day, id).first();
        if (prev && Date.now() - prev.ts < SUBMIT_FLOOR_MS) return json(await rankFor(db, day, id)); // too soon; just echo rank

        await db.prepare(
          'INSERT INTO scores (day, pid, score, ts) VALUES (?1, ?2, ?3, ?4) ' +
          'ON CONFLICT(day, pid) DO UPDATE SET score = MAX(score, excluded.score), ts = excluded.ts'
        ).bind(day, id, score, Date.now()).run();

        return json(await rankFor(db, day, id));
      }
    } catch (e) {
      return json({ error: 'server' }, 500);
    }

    return json({ error: 'not_found' }, 404);
  },

  async scheduled(event, env) {
    const d = new Date(Date.now() - PRUNE_DAYS * 86400000);
    const cutoff = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
    await env.DB.prepare('DELETE FROM scores WHERE day < ?1').bind(cutoff).run();

    const clickD = new Date(Date.now() - CLICK_PRUNE_DAYS * 86400000);
    const clickCutoff = clickD.getUTCFullYear() * 10000 + (clickD.getUTCMonth() + 1) * 100 + clickD.getUTCDate();
    await env.DB.prepare('DELETE FROM clicks WHERE day < ?1').bind(clickCutoff).run();

    const refD = new Date(Date.now() - REFERRAL_PRUNE_DAYS * 86400000);
    const refCutoff = refD.getUTCFullYear() * 10000 + (refD.getUTCMonth() + 1) * 100 + refD.getUTCDate();
    // claimed = 1 only: an unclaimed row is a reward the referrer hasn't
    // collected yet, and must never age out from under them, however long
    // that takes - see handleReferralClaim, which has no expiry of its own.
    await env.DB.prepare('DELETE FROM referrals WHERE day < ?1 AND claimed = 1').bind(refCutoff).run();
  },
};
