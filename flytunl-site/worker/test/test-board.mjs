// The web leaderboard view on the worker side (src/index.js "Pilot names"): GET /top and
// POST /n against the real schema.sql in a real SQLite, behind the same D1-shaped shim as
// test-challenge.mjs. Scores go in through the real POST /s.
// Run: node flytunl-site/worker/test/test-board.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const worker = (await import(new URL('../src/index.js', import.meta.url))).default;

const sql = new DatabaseSync(':memory:');
sql.exec(readFileSync(here + '../schema.sql', 'utf8'));
const DB = {
  prepare(q) {
    let args = [];
    const st = {
      bind(...a) { args = a.map(v => v === undefined ? null : v); return st; },
      async first() { return sql.prepare(q).get(...args) || null; },
      async all() { return { results: sql.prepare(q).all(...args) }; },
      async run() { const r = sql.prepare(q).run(...args); return { meta: { changes: Number(r.changes) } }; },
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
let clockOffset = 0;
Date.now = () => realNow() + clockOffset;
async function call(method, path, body) {
  const res = await worker.fetch(new Request('https://w.dev' + path, {
    method, headers: { 'content-type': 'application/json', origin: 'https://flytunl.ch' },
    body: body ? JSON.stringify(body) : undefined,
  }), env);
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function token() {
  const keep = clockOffset;
  clockOffset -= 10000;
  const t = (await call('GET', '/t')).json.t;
  clockOffset = keep;
  return t;
}
function today() {
  const d = new Date(Date.now());
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
const pid = i => `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`;
async function submit(i, s) {
  return call('POST', '/s', { d: today(), s, p: 9999, id: pid(i), tok: await token() });
}
const later = () => { clockOffset += 6000; };   // past the name and score floors

// ── An empty day ──
let r = await call('GET', `/top?d=${today()}&id=${pid(1)}`);
check('empty day: no rows, no rank, no name', r.status === 200 && r.json.total === 0
  && r.json.top.length === 0 && r.json.me === null && r.json.name === '', r.json);

// ── Twelve players, two of them tied ──
const scores = [500, 900, 300, 900, 120, 80, 640, 410, 220, 60, 50, 700];
for (let i = 0; i < scores.length; i++) await submit(i + 1, scores[i]);
r = await call('GET', `/top?d=${today()}&id=${pid(11)}`);
check('total counts every player of the day', r.json.total === 12, r.json.total);
check('top list holds TOP_N rows, best first', r.json.top.length === 10
  && r.json.top.every((row, i, a) => i === 0 || a[i - 1].s >= row.s), r.json.top);
check('a tie shares its rank and the next rank skips ("1, 1, 3")',
  r.json.top[0].r === 1 && r.json.top[1].r === 1 && r.json.top[2].r === 3, r.json.top.slice(0, 3));
check('the caller outside the top list gets its own rank and best',
  r.json.me && r.json.me.rank === 12 && r.json.me.best === 50 && !r.json.top.some(x => x.me), r.json.me);
check('no pid leaves the worker', !JSON.stringify(r.json).includes('-1111-4111-'));
r = await call('GET', `/top?d=${today()}&id=${pid(7)}`);
check('the caller inside the top list is marked me', r.json.top.filter(x => x.me).length === 1
  && r.json.top.find(x => x.me).s === 640 && r.json.me.rank === 4, r.json);
r = await call('GET', `/top?d=${today()}`);
check('/top without an id still lists the day', r.status === 200 && r.json.top.length === 10 && r.json.me === null);
check('/top refuses a bad id', (await call('GET', `/top?d=${today()}&id=x`)).status === 400);
check('/top refuses a bad day', (await call('GET', `/top?d=1999&id=${pid(1)}`)).status === 400);

// ── Names ──
r = await call('POST', '/n', { id: pid(2), name: '  Ana   Lu ' });
check('a name is stored with its spaces collapsed', r.status === 200 && r.json.name === 'Ana Lu', r.json);
r = await call('GET', `/top?d=${today()}&id=${pid(2)}`);
check('/top shows the name on its row and returns it as the caller\'s name',
  r.json.top.find(x => x.me).n === 'Ana Lu' && r.json.name === 'Ana Lu', r.json);
check('a nameless row has n null', r.json.top.filter(x => !x.me).every(x => x.n === null));
r = await call('POST', '/n', { id: pid(2), name: 'Ana Lu' });
check('resaving the same name at once is accepted', r.status === 200 && r.json.name === 'Ana Lu', r);
r = await call('POST', '/n', { id: pid(2), name: 'Ana' });
check('a rename within NAME_CHANGE_FLOOR_MS is refused (soon)', r.status === 429 && r.json.error === 'soon', r);
clockOffset += 2500;
r = await call('POST', '/n', { id: pid(2), name: 'Ana' });
check('a typo fix a few seconds later goes through', r.status === 200 && r.json.name === 'Ana', r);
later();
r = await call('POST', '/n', { id: pid(2), name: '' });
check('an empty name clears it', r.status === 200 && r.json.name === '', r);
r = await call('GET', `/top?d=${today()}&id=${pid(2)}`);
check('a cleared name is gone from /top', r.json.name === '' && r.json.top.find(x => x.me).n === null);

for (const [why, name] of [
  ['too short', 'A'], ['too long', 'Abcdefghijklmno'], ['a link', 'flytunl.ch'], ['a symbol', 'a<b>'],
  ['a leading space-only name', '   '], ['an emoji', 'Ace 🚀'],
]) {
  later();
  const res = await call('POST', '/n', { id: pid(3), name });
  // '   ' normalises to '' which clears, so it is accepted as a clear, not as a name
  if (name.trim() === '') { check(`${why} clears instead of naming`, res.status === 200 && res.json.name === '', res); continue; }
  check(`refuses ${why}`, res.status === 422 && res.json.error === 'name', res);
}
for (const name of ['FuckYou', 'sh1t head', 'B.i.t.c.h', 'f u c k', 'Hitler88', 'хуй', 'Kurwa', 'TUNL Dev', 'Admin', 'big ass', 'the Nazi']) {
  later();
  const res = await call('POST', '/n', { id: pid(3), name });
  check(`blocks "${name}"`, res.status === 422, res);
}
for (const name of ['Grapes', 'Monique', 'Nazir', 'Fukuoka', 'Dev', 'Cassie', 'Dickens', 'Essex', 'Ленка', 'राहुल', 'محمد', '佐藤', 'Zoë', 'Ace_77', 'Jo-Jo']) {
  later();
  const res = await call('POST', '/n', { id: pid(3), name });
  check(`allows "${name}"`, res.status === 200 && res.json.name === name.normalize('NFKC'), res);
}
check('/n refuses a bad id', (await call('POST', '/n', { id: 'nope', name: 'Ace' })).status === 400);

// ── A ban ──
later();
await call('POST', '/n', { id: pid(4), name: 'Sneaky' });
sql.prepare('UPDATE names SET banned = 1 WHERE pid = ?').run(pid(4));
r = await call('GET', `/top?d=${today()}&id=${pid(4)}`);
check('a banned name is never served', !JSON.stringify(r.json).includes('Sneaky') && r.json.name === '', r.json);
later();
r = await call('POST', '/n', { id: pid(4), name: 'Nice' });
check('a banned player cannot rename', r.status === 403 && r.json.error === 'banned', r);

// ── Pruning ──
sql.prepare("INSERT INTO names (pid, name, banned, ts) VALUES (?, 'Ghost', 0, 0)").run(pid(99));
sql.prepare("INSERT INTO names (pid, name, banned, ts) VALUES (?, 'Banned', 1, 0)").run(pid(98));
await worker.scheduled({}, env);
check('pruning drops a name whose player has no score left', !sql.prepare('SELECT 1 AS x FROM names WHERE pid = ?').get(pid(99)));
check('pruning keeps a ban', !!sql.prepare('SELECT 1 AS x FROM names WHERE pid = ?').get(pid(98)));
check('pruning keeps a name with a score today', !!sql.prepare('SELECT 1 AS x FROM names WHERE pid = ?').get(pid(3)));

Date.now = realNow;
if (failures) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\ntest-board.mjs: all leaderboard view checks passed');
