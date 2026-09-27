# Frenzy, the star

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the
measurements behind them are in `docs/design-history.md` -> "Frenzy: the star".

Concept and the user's picks: https://claude.ai/artifact/Nft1eG8rKrq2LZrnKdTRiC (decision page,
db collection `entscheidungen`). Sounds were picked by ear on
https://claude.ai/artifact/NrN7Tstb7J8MEizkFRZW69 (db collection `sound`).

## What it is

A vertical meter at the bottom-left edge of the energy console fills by collecting (`constants.js` `FRENZY_*` doc). When it is
full it charges for `FRENZY_CHARGE_SEC`, then the ship is a star for `FRENZY_SEC`, like Mario's:
crystals, mines, cannon shots and boulder islands it flies into shatter and pay
`BULLET_HIT_PTS`, poison and drain coins shatter harmlessly, the wall clamps (no kill, no
scratch), the shield is not spent. Speed is unchanged - that is what separates it from the warp
(the warp races past everything, the star clears it).

- **Meter ("tank", user's pick):** +1 per good coin (warp-vacuumed gold included), chicane gold
  `FRENZY_CHICANE_FILL`, a portal `FRENZY_PORTAL_MIN..MAX` by accuracy (user: "warp soll auch
  belohnen"), -`FRENZY_MISS_COST` per good coin that scrolls past the ship uncollected,
  -`FRENZY_HAZARD_COIN_COST` for touching poison or drain. Never below 0, only from
  `SAFE_START_WX`, frozen while charging or starred. A miss is not judged during a warp (its
  pace) or while a magnet runs (it still pulls the coin in).
- **Cost escalates** per star in the same run (`FRENZY_FIRST_COST`, x `FRENZY_COST_MUL`). A
  rewarded continue empties the meter, the price stays.
- **Warp:** a star never charges or starts inside a warp (`frenzyPending`, released at the
  warp's end), and a running star's clock pauses there. The end grants `HIT_INVULN_SEC`.

## Rules

- **Tune by duty cycle, never by coin count.** `tools/frenzy-sim.js` (planning pilot on the real
  game, 5 tiers, paired plain vs star runs) + `tools/frenzy-sim-report.js`. Chosen values
  measured 8.9% of a pro-tier run as star and +23% day best; the concept's first values (8,
  x1.5, 4s) measured 12.2% / +40%. The effect is survival (walls stop killing), smash points
  are ~0.1% of the score.
- **The star is a deep-run reward by design (user's call "Stern fuer Koenner").** Pilot tiers
  that play like today's real players (median run ~30) never fill it in any variant measured.
  Making it reachable for them (counting from S0, cost 5-6) doubled good players' median
  runs - don't lower the cost without re-measuring the leaderboard effect.
- **No rng(), no placement.** Hazards leave through the paths bullet, bomb and laser already
  use (`s.dying`, splice, `burstBoulder`), so the daily cave is untouched; `test-cave.js` stays
  byte-identical. The coin `fzPast` flag is per-player state on the coin object and is read
  by nothing else.
- **Colour = the ship's own light** (`SKINS[i].shadow`, `_fzToneKey()` in `draw.js`): cyan is
  the corridor, red danger, orange ON FIRE, gold shards. No hue-wheel cycling (a Mario rainbow
  was rejected in concept for that rule). The aura stays inside the hull envelope (1.4 PR) so
  it never promises more reach than the hitbox.
- **Audio has no beat.** The pad's tremolo runs in 16ths (`FRENZY_TREM_HZ`, 140 BPM) but a star
  starts at any moment and slow/warp move the track, so a pulse would land off the beat - the
  reason the sector build-and-drop was removed. Music is lifted on `_bgmLift`/`_bgmShelf`
  (`bgmSetFrenzy`), never `playbackRate`. Levels in `audio.js` `FRENZY_LV`, measured offline in
  the real bus (fanfare just under the milestone, ping = coin); judge changes by render.
- **The meter is NOT a power-up lane** (user's call 2026-09-27, "klar abgetrennt"): a vertical
  bar at the bottom-left edge, left of the magazine, filling upward with the star icon on top
  (`_hudFrenzy` in `draw.js`, state from `_hudLaneState('frenzy')`). A key added to
  `_HUD_LANES` also needs its seed in `_hudLaneY`/`_hudLaneA`, or it draws at NaN and throws in
  the browser's `createLinearGradient` - `test-sim.js`'s fake context cannot see that.

## Making it unmistakable (2026-09-27)

User: "bei Frenzy soll man viel mehr sehen, dass Frenzy ist". Idea page
https://claude.ai/artifact/U6FuPqw4JN7dM3w6h1WiLc (db collection `sichtbar`); picked and built:
- **Wash from the left** in the ship's light (`FRENZY_WASH_*`), pulsing in 16ths. Left only:
  light behind the ship, never ahead. It layers with the Zeitblase's wash, it does not replace it.
- **Score in the ship's light** with the star icon left of the digits (the combo chip owns the
  right); every smash pumps it toward white through the existing `hudBump`.
- **Weight on every smash:** a white impact flash (`frenzyImpacts`, `FRENZY_IMPACT_SEC`), more
  shards, harder shake, and a hit-stop - `update()` returns before any clock moves for
  `FRENZY_HITSTOP_SEC`, at most once per `FRENZY_HITSTOP_GAP` (a chain never stutters).
  Guarded in `test-sim.js` (a chain inside the gap holds once).
Not picked (left unmarked): countdown ring, star-sparkle trail, prey highlight on hazards, big
banner, afterimages. Advised against: growing the hull (envelope rule), tinting the background
(depth light never bright).

## Not done

- Daily missions: deliberately not added. Real-player tiers never fill a star, so a "1 star"
  mission would be the unwinnable-slot problem the `MISSION_DEFS` doc describes, and a new
  entry reshuffles every day's picks (`pickDailyMissionIndices` buckets by index), which would
  also split web and app on the day they ship at different versions.
- Achievements: need their ids created and localised in App Store Connect and Play Console
  first (`project_achievements_localization` memory).
- Device ear-check and play feel on a phone.
