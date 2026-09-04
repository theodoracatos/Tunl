-- tunl-scores D1 schema. Apply once:
--   wrangler d1 execute tunl_scores --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS scores (
  day   INTEGER NOT NULL,   -- YYYYMMDD (UTC)
  pid   TEXT    NOT NULL,   -- anonymous per-browser id (localStorage tunnel_web_id)
  score INTEGER NOT NULL,
  ts    INTEGER NOT NULL,   -- last-write epoch ms
  PRIMARY KEY (day, pid)
);

CREATE INDEX IF NOT EXISTS idx_scores_day_score ON scores (day, score DESC);
