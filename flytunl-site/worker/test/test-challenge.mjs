// The challenge link on the worker side (src/index.js "Challenge link"), against the
// real schema.sql in a real SQLite (node:sqlite, no dependency) behind a small D1-shaped
// shim - prepare().bind().first()/all()/run(). Tokens come from the worker's own GET /t
// with Date.now() wound back, so they are old enough to pass TOKEN_MIN_AGE_MS.
// Run: node flytunl-site/worker/test/test-challenge.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const worker = (await import(new URL('../src/index.js', import.meta.url))).default;

const sql = new DatabaseSync(':memory:');
sql.exec(readFileSync(here + '../schema.sql', 'utf8'));
// D1's statement API over node:sqlite. ?1..?n are SQLite's own numbered parameters,
// so positional binding fills them in order.
const DB = {
  prepare(q) {
    let args = [];
    const st = {
      bind(...a) { args = a.map(v => v === undefined ? null : v); return st; },
      async first() { return sql.prepare(q).get(...args) || null; },
      async all() { return { results: sql.prepare(q).all(...args) }; },
      async run() {
        if (/\bRETURNING\b/i.test(q)) { const r = sql.prepare(q).all(...args); return { results: r, meta: { changes: r.length } }; }
        const r = sql.prepare(q).run(...args);
        return { meta: { changes: Number(r.changes) } };
      },
    };
    return st;
  },
};
const env = { DB, TOKEN_SECRET: 'test-secret', REPORT_KEY: 'rk' };

let failures = 0;
function check(name, cond, extra) {
  if (cond) { console.log('  ok  ' + name); return; }
  failures++;
  console.error('FAIL  ' + name + (extra !== undefined ? '  <- ' + JSON.stringify(extra) : ''));
}

const realNow = Date.now;
let clockOffset = 0;   // moves the worker's clock, to step past SUBMIT_FLOOR_MS
Date.now = () => realNow() + clockOffset;
async function call(method, path, body, origin) {
  const headers = { 'content-type': 'application/json' };
  if (origin) headers.origin = origin;
  const res = await worker.fetch(new Request('https://w.dev' + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  }), env);
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) };
}
async function token() {
  const keep = clockOffset;
  clockOffset -= 10000;   // issued ten seconds ago
  const t = (await call('GET', '/t')).json.t;
  clockOffset = keep;
  return t;
}
function today() {
  const d = new Date(Date.now());
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
const later = () => { clockOffset += 6000; };   // past one player's 5 s floor

const OWNER = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const P1 = 'aaaaaaaa-1111-4111-8111-111111111111';
const P2 = 'bbbbbbbb-2222-4222-8222-222222222222';
const GHOST = Buffer.from(Array.from({ length: 300 }, (_, i) => i % 256)).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const base = async (o) => Object.assign({ id: 'Ab3dEf7hIj', owner: OWNER, d: today(), s: 300, p: 60, g: GHOST, src: 'web', tok: await token() }, o || {});

// ── POST /c: what it refuses ──
for (const [name, o, code] of [
  ['9-char id', { id: 'Ab3dEf7hI' }, 400],
  ['id with a dash', { id: 'Ab3dEf7h-j' }, 400],
  ['bad parent', { parent: 'short' }, 400],
  ['a cave from the future', { d: today() + 1 }, 400],
  ['a cave before 2025', { d: 20241231 }, 400],
  ['score over SCORE_MAX', { s: 50001, p: 99999 }, 422],
  ['score over p * 12 + 25', { s: 146, p: 10 }, 422],
  ['zero score', { s: 0 }, 422],
  ['unknown src', { src: 'desktop' }, 400],
  ['bad owner id', { owner: 'not an id!' }, 400],
  ['invalid token', { tok: '1.2.3' }, 401],
]) {
  const r = await call('POST', '/c', await base(o));
  check(`POST /c refuses ${name} (${code})`, r.status === code, r);
}
check('nothing was stored by the refusals', sql.prepare('SELECT COUNT(*) AS c FROM challenges').get().c === 0);

// ── POST /c: stores, ghost rules, collisions ──
let r = await call('POST', '/c', await base());
check('POST /c stores a challenge', r.status === 200 && r.json.ok === true, r);
later();
r = await call('POST', '/c', await base({ owner: P2 }));
check('the same id again is a 409', r.status === 409, r);
later();
r = await call('POST', '/c', await base({ id: 'BigGhost01', g: 'A'.repeat(5400) }));
check('a ghost over 4000 bytes: challenge kept', r.status === 200, r);
check('... and the ghost dropped', sql.prepare("SELECT ghost FROM challenges WHERE id = 'BigGhost01'").get().ghost === null);
later();
// A drain run: score 40 but 300 ghost bytes (distance) - the ghost is NOT tied to the score.
r = await call('POST', '/c', await base({ id: 'DrainRun01', s: 40 }));
check('a ghost longer than the score (drain run) is accepted', r.status === 200
  && sql.prepare("SELECT ghost FROM challenges WHERE id = 'DrainRun01'").get().ghost === GHOST, r);
r = await call('POST', '/c', await base({ id: 'TooSoon001' }));
check('a second challenge inside 5 s is a 429', r.status === 429, r);
later();
r = await call('POST', '/c', await base({ id: 'NotB64Gh01', g: 'abc$%^def' }));
check('a ghost that is not base64url is dropped, challenge kept', r.status === 200
  && sql.prepare("SELECT ghost FROM challenges WHERE id = 'NotB64Gh01'").get().ghost === null, r);

// ── GET /c/<id> ──
r = await call('GET', '/c/Ab3dEf7hIj?me=' + P1);
check('GET returns d, s, g, plays, beats', r.status === 200 && r.json.d === today() && r.json.s === 300
  && r.json.g === GHOST && r.json.plays === 0 && r.json.beats === 0, r);
check('GET never returns the owner', r.json && !('owner' in r.json) && JSON.stringify(r.json).indexOf(OWNER) < 0, r);
check('mine is false for a recipient', r.json.mine === false, r);
r = await call('GET', '/c/Ab3dEf7hIj?me=' + OWNER);
check('mine is true for the owner', r.json.mine === true, r);
r = await call('GET', '/c/Nope000000');
check('an unknown id is a 404', r.status === 404, r);

// ── POST /c/<id>/run ──
r = await call('POST', '/c/Ab3dEf7hIj/run', { pid: OWNER, s: 500, p: 60, isNew: 0, tok: await token() });
check('the owner flying their own link writes nothing', r.json.self === true
  && sql.prepare('SELECT COUNT(*) AS c FROM challenge_runs').get().c === 0, r);
r = await call('POST', '/c/Ab3dEf7hIj/run', { pid: P1, s: 200, p: 40, isNew: 1, tok: await token() });
check('a recipient run counts one play, not beaten', r.json.plays === 1 && r.json.beats === 0 && r.json.best === 200, r);
r = await call('POST', '/c/Ab3dEf7hIj/run', { pid: P1, s: 250, p: 40, isNew: 0, tok: await token() });
check('a second run inside 5 s writes nothing new', r.json.best === 200, r);
later();
r = await call('POST', '/c/Ab3dEf7hIj/run', { pid: P1, s: 250, p: 40, isNew: 0, tok: await token() });
check('a second run of the same recipient does not add a play', r.json.plays === 1 && r.json.best === 250, r);
check('is_new is kept from the first insert', sql.prepare("SELECT is_new FROM challenge_runs WHERE pid = ?").get(P1).is_new === 1);
r = await call('POST', '/c/Ab3dEf7hIj/run', { pid: P2, s: 300, p: 40, isNew: 0, tok: await token() });
check('a tie does not beat it', r.json.plays === 2 && r.json.beats === 0, r);
later();
r = await call('POST', '/c/Ab3dEf7hIj/run', { pid: P1, s: 301, p: 40, isNew: 0, tok: await token() });
check('beat flips exactly on overtaking', r.json.beats === 1 && r.json.best === 301, r);
later();
r = await call('POST', '/c/Ab3dEf7hIj/run', { pid: P1, s: 100, p: 40, isNew: 0, tok: await token() });
check('a worse run keeps best and beat', r.json.beats === 1 && r.json.best === 301, r);
r = await call('POST', '/c/Ab3dEf7hIj/run', { pid: P2, s: 900, p: 10, isNew: 0, tok: await token() });
check('an implausible run is refused', r.status === 422, r);
r = await call('POST', '/c/Nope000000/run', { pid: P2, s: 100, p: 40, isNew: 0, tok: await token() });
check('a run on an unknown challenge is a 404', r.status === 404, r);

// ── POST /c/inbox ──
r = await call('POST', '/c/inbox', { id: OWNER });
const item = r.json && r.json.items.find(i => i.c === 'Ab3dEf7hIj');
check('the inbox reports both recipients once', item && item.newPlays === 2 && item.newBeats === 1
  && item.plays === 2 && item.beats === 1 && item.top === 301 && item.s === 300, r.json);
r = await call('POST', '/c/inbox', { id: OWNER });
check('asked again, the inbox is empty', r.json.items.length === 0, r.json);
later();
r = await call('POST', '/c/Ab3dEf7hIj/run', { pid: P2, s: 350, p: 40, isNew: 0, tok: await token() });
r = await call('POST', '/c/inbox', { id: OWNER });
check('a recipient who now beat it is reported again, as a beat', r.json.items.length === 1
  && r.json.items[0].newPlays === 1 && r.json.items[0].newBeats === 1, r.json);
r = await call('POST', '/c/inbox', { id: P1 });
check('someone else\'s inbox sees nothing of it', r.json.items.length === 0, r.json);

// ── REMATCH (parent) and /c/stats ──
later();
r = await call('POST', '/c', await base({ id: 'Rematch001', owner: P1, parent: 'Ab3dEf7hIj', s: 320 }));
check('a rematch with a parent is stored', r.status === 200
  && sql.prepare("SELECT parent FROM challenges WHERE id = 'Rematch001'").get().parent === 'Ab3dEf7hIj', r);
r = await call('GET', '/c/stats?key=wrong');
check('stats without the key is a 401', r.status === 401, r);
r = await call('GET', '/c/stats?key=rk');
const st = r.json && r.json.rows.find(x => x.day === today());
check('stats count challenges, senders, replies, opens, new players, beats', st && st.challenges === 5
  && st.senders === 2 && st.replies === 1 && st.opens === 2 && st.new_players === 1 && st.beats === 2, r.json);

// ── CORS: the apps' WebView origins get their own origin back ──
for (const o of ['https://appassets.androidplatform.net', 'null', 'https://flytunl.ch']) {
  r = await call('GET', '/c/Ab3dEf7hIj?me=' + P1, null, o);
  check(`CORS answers ${o} with its own origin`, r.headers.get('access-control-allow-origin') === o, r.headers.get('access-control-allow-origin'));
}
r = await call('GET', '/c/Ab3dEf7hIj', null, 'https://evil.example');
check('a foreign origin is still refused', r.status === 403, r);

// ── Pruning: both tables after 45 days ──
const old = 20250102;
sql.prepare("INSERT INTO challenges (id, owner, day, score, src, created, ts) VALUES ('OldOne0001', ?, ?, 10, 'web', ?, 0)").run(OWNER, old, old);
sql.prepare("INSERT INTO challenge_runs (cid, pid, best, created, ts) VALUES ('OldOne0001', ?, 5, ?, 0)").run(P1, old);
sql.prepare("INSERT INTO challenge_runs (cid, pid, best, created, ts) VALUES ('Ab3dEf7hIj', 'cccccccc-3333', 5, ?, 0)").run(old);
await worker.scheduled({}, env);
check('pruning removes an old challenge', !sql.prepare("SELECT 1 AS x FROM challenges WHERE id = 'OldOne0001'").get());
check('pruning removes old runs and runs of pruned challenges',
  sql.prepare("SELECT COUNT(*) AS c FROM challenge_runs WHERE created = ?").get(old).c === 0);
check('pruning keeps today\'s challenge and its runs', !!sql.prepare("SELECT 1 AS x FROM challenges WHERE id = 'Ab3dEf7hIj'").get()
  && sql.prepare("SELECT COUNT(*) AS c FROM challenge_runs WHERE cid = 'Ab3dEf7hIj'").get().c === 2);

Date.now = realNow;
if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\ntest-challenge.mjs: all challenge worker checks passed');
