# tunl-scores worker

A Cloudflare Worker that backs the daily world-rank on `flytunl.ch/play/`. Free tier
is plenty (D1: 5 GB, 5 M row reads/day, 100 k writes/day).

The game only talks to this when `WEB_LEADERBOARD_API` in `src/web.js` is set; leave
it empty and the web build behaves exactly as before (localStorage only, no rank).

## Status: DEPLOYED 2026-09-04

Live at `https://tunl-scores.theodoracatos.workers.dev` (D1 db `tunl_scores`,
id `2222e48f-acc8-4e66-85f5-3844e9615988`). `src/web.js` `WEB_LEADERBOARD_API`
points at it. To ship a worker code change: `cd flytunl-site/worker && npx wrangler@4 deploy`.

## One-time deploy (kept for reference / disaster recovery)

`wrangler secret put` is blocked by the Claude Code auto-mode classifier - the
human runs step 3.

```sh
npm i -g wrangler          # or use `npx wrangler ...` below
cd flytunl-site/worker
wrangler login

# 1. create the D1 database, then paste the printed database_id into wrangler.toml
wrangler d1 create tunl_scores

# 2. create the table
wrangler d1 execute tunl_scores --remote --file=schema.sql

# 3. set the signing secret (any long random string, e.g. `openssl rand -hex 32`)
wrangler secret put TOKEN_SECRET

# 4. deploy - note the printed https://tunl-scores.<your-subdomain>.workers.dev URL
wrangler deploy
```

Then put that URL into `src/web.js`:

```js
const WEB_LEADERBOARD_API = 'https://tunl-scores.<your-subdomain>.workers.dev';
```

and redeploy the site (`flytunl-site/deploy.sh`). Done - the web death screen now shows
a live daily world rank, same as the app's Game Center number.

## API

| | |
|---|---|
| `GET /t` | `{ t }` - a signed token, valid 8 s .. 15 min. The client fetches one per session and sends it with each submit. |
| `GET /r?d=<YYYYMMDD>&id=<uuid>` | `{ rank, total, best }` for that player that day (rank is `null` if they haven't submitted). |
| `POST /s` `{ d, s, p, id, tok }` | records the score (best-per-day-per-player), returns `{ rank, total, best }`. Past-day `?d=` replays send `d != today` and are silently not recorded, mirroring the app (which only ever submits today). |

Anti-abuse is intentionally light: CORS locked to `https://flytunl.ch`, the signed
token, a `score <= play_seconds * 12 + 25` sanity check, a `score <= 50000` clamp, and
a 5 s floor between one player's submissions. Enough to stop drive-by curl spam, not a
determined cheater - acceptable for a free casual daily.

## Local dev

```sh
wrangler dev --local            # uses a local D1; apply schema.sql to it first with --local
```
