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
