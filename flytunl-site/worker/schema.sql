-- tunl-scores D1 schema. Apply once (and safe to re-apply after a schema
-- change like the `clicks` table below - every statement is IF NOT EXISTS):
--   wrangler d1 execute tunl_scores --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS scores (
  day   INTEGER NOT NULL,   -- YYYYMMDD (UTC)
  pid   TEXT    NOT NULL,   -- anonymous per-browser id (localStorage tunnel_web_id)
  score INTEGER NOT NULL,
  ts    INTEGER NOT NULL,   -- last-write epoch ms
  PRIMARY KEY (day, pid)
);

CREATE INDEX IF NOT EXISTS idx_scores_day_score ON scores (day, score DESC);

-- Campaign click tracking (GET /go/<source>/<campaign>, see src/index.js).
-- One row per click, not a pre-aggregated counter, so /clicks can group by
-- any of source/campaign/medium/day later without having predicted the
-- question in advance.
CREATE TABLE IF NOT EXISTS clicks (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  day      INTEGER NOT NULL,   -- YYYYMMDD (UTC)
  source   TEXT    NOT NULL,   -- e.g. "tiktok", "reddit", "x"
  campaign TEXT    NOT NULL,   -- e.g. "launch"
  medium   TEXT    NOT NULL,   -- e.g. "social" (default), "video", "post"
  dest     TEXT    NOT NULL,   -- "home" or "play" - which page the click landed on
  ts       INTEGER NOT NULL    -- epoch ms
);

CREATE INDEX IF NOT EXISTS idx_clicks_source_campaign ON clicks (source, campaign, day);

-- Two-sided referral reward (POST /referral, /referral/claim, src/index.js).
-- `referred` is the PRIMARY KEY, not an autoincrement id: it's what makes a
-- referral count exactly once ever for a given referred player, regardless of
-- how many times their client retries the submit.
CREATE TABLE IF NOT EXISTS referrals (
  referred TEXT    PRIMARY KEY,  -- the new player's id - enforces "counts once"
  referrer TEXT    NOT NULL,     -- who gets credited
  score    INTEGER NOT NULL,     -- the qualifying first run's score
  day      INTEGER NOT NULL,     -- YYYYMMDD (UTC), for pruning
  ts       INTEGER NOT NULL,     -- epoch ms
  claimed  INTEGER NOT NULL DEFAULT 0  -- 0/1 - has the referrer's client picked this up yet
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_claimed ON referrals (referrer, claimed);

-- The challenge link (POST /c, GET /c/<id>, POST /c/<id>/run, POST /c/inbox,
-- src/index.js "Challenge link"; client: src/web.js). One row per shared
-- challenge. `owner` is the sender's plain player id and never leaves the
-- worker (same anonymity rule as scores.pid).
CREATE TABLE IF NOT EXISTS challenges (
  id      TEXT    PRIMARY KEY,   -- 10 chars base62, client-generated
  owner   TEXT    NOT NULL,      -- sender's webPlayerId()
  parent  TEXT,                  -- the challenge this one answers (REMATCH), or NULL
  day     INTEGER NOT NULL,      -- YYYYMMDD of the cave (may be a past day via ?d)
  score   INTEGER NOT NULL,
  ghost   TEXT,                  -- URL-safe base64 ghost track, NULL if too long or invalid
  src     TEXT    NOT NULL,      -- 'web' | 'ios' | 'android'
  created INTEGER NOT NULL,      -- YYYYMMDD (UTC) of creation, for pruning and stats
  ts      INTEGER NOT NULL       -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_challenges_owner   ON challenges (owner, created);
CREATE INDEX IF NOT EXISTS idx_challenges_created ON challenges (created);

-- One row per (challenge, recipient). Best score wins, like scores.
CREATE TABLE IF NOT EXISTS challenge_runs (
  cid     TEXT    NOT NULL,
  pid     TEXT    NOT NULL,
  best    INTEGER NOT NULL,
  beat    INTEGER NOT NULL DEFAULT 0,  -- 1 once best > challenges.score (never flips back)
  is_new  INTEGER NOT NULL DEFAULT 0,  -- 1 if this was the recipient's first-ever run (first insert only)
  seen    INTEGER NOT NULL DEFAULT 0,  -- 1 once the owner's inbox has reported it
  created INTEGER NOT NULL,            -- YYYYMMDD (UTC)
  ts      INTEGER NOT NULL,
  PRIMARY KEY (cid, pid)
);
CREATE INDEX IF NOT EXISTS idx_challenge_runs_created ON challenge_runs (created);
CREATE INDEX IF NOT EXISTS idx_challenge_runs_seen    ON challenge_runs (seen, cid);
