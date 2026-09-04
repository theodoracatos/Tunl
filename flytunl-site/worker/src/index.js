// ============================================================
//  tunl-scores - Cloudflare Worker: daily leaderboard for flytunl.ch/play
// ============================================================
//  Endpoints (CORS-locked to https://flytunl.ch):
//    GET  /t                 -> { t } a short-lived signed token
//    GET  /r?d=<day>&id=<id> -> { rank, total, best } for one player on one day
//    POST /s   { d, s, p, id, tok } -> records the score, returns { rank, total, best }
//
//  Storage: D1 (see schema.sql). One row per (day, player); the best score wins.
//  A daily cron prunes rows older than 45 days.
//
//  Anti-abuse is deliberately light (this is a free casual daily game): CORS lock,
//  a signed token that must be fetched within 15 min and is at least 8 s old, a
//  score/play-time sanity check, an absolute score clamp, and a 5 s floor between
//  a player's submissions. A determined cheater can still get a fake score in;
//  the goal is only to stop drive-by curl spam.
// ============================================================

const ORIGIN = 'https://flytunl.ch';
const SCORE_MAX = 50000;          // ~2 h of flawless play; anything above is junk
const TOKEN_MIN_AGE_MS = 8000;    // a real run cannot be shorter than this
const TOKEN_MAX_AGE_MS = 900000;  // 15 min
const SUBMIT_FLOOR_MS = 5000;     // min gap between one player's submissions
const PRUNE_DAYS = 45;

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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors() });

    // Only serve the game's own origin.
    const origin = request.headers.get('origin');
    if (origin && origin !== ORIGIN) return json({ error: 'origin' }, 403);

    const url = new URL(request.url);
    const db = env.DB;
    const secret = env.TOKEN_SECRET;

    try {
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
  },
};
