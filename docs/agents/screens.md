# Scoring, world rank, death screen, ghost

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the measurements and rejected alternatives behind them are in `docs/design-history.md` (the 2026-09-21 condensing moved the removed paragraphs there verbatim, under "Narratives moved out of docs/agents").

## Addictive systems

**Score formula**: `score = Math.floor(scrollX / 60) + bonusScore`. `bonusScore`
accumulates from coin collection and near-miss bonuses; resets each run.

**Milestone moments**: step size widens with score via `milestoneStep()` (`world.js`) and
is **uncapped** (same "never just endurance" philosophy as `scrollSpd()`); a flat step made
deep milestones noise. Four tiers `!`..`!!!!` (`triggerMilestone` in `input.js`,
`sfxMilestone`) so a deep milestone still reads as a step up. `test-math.js` asserts the ladder.

**The ladder is seeded at `MIN_REAL_RUN_SCORE`**: the safe opening makes the lower rungs
free for every run, so the first rung is the first one a player can miss. **No score gate
anywhere in the game may sit at or below 50**, and that number moves with `SAFE_START_WX`
(see the `MIN_REAL_RUN_SCORE` doc block in `constants.js`).

**Don't drop the 25-point band below 100 again without new data.** The metric that matters
is the share of REAL runs that fire a milestone at all, not milestones per run.

**Near-miss bonus**: +1 `bonusScore` when wall clearance < `PR * 2.0`, 1.5s cooldown.
"+CLOSE" notif + ascending ping.

**Coin combo multiplier**: coins within 2s of each other build a streak; score pts =
`coinCombo * 3`. Shown as a chip beside the live score with a bar draining over the combo
window (see "HUD instrument"). Blue/red/bomb coins join the streak but their notif does
not change (the power-up is the reward); poison and drain break it outright. The gold
pickup sound climbs a major-pentatonic step per combo level (`sfxCoin(coinCombo)`),
plateauing a major-tenth up - the streak is audible in the coin itself, not only in the
separate `sfxCombo` ping (which fires from x2). Same "widen the step, never cap flat"
shape as `milestoneStep()`.

**Death freeze frame** (`DEATH_REPLAY_SEC`, `drawDeathFreeze()` in `draw.js`,
`markDeathHit()` in `update.js`, `deathHitX/Y/R` in `state.js`): for the first
`DEATH_REPLAY_SEC` after a fatal hit the panel does not paint; the frozen world shows the
wrecked ship in red and a reticle contracting onto what landed the hit - the answer to
"what did I do wrong".

Two things keep this **free rather than a tax on restarting**, and both must stay true:
- The panel's own alpha is the only thing offset. (The button row fade and `input.js`'s
  `DEATH_INTERACTIVE_SEC` gate moved with the freeze length - the one deliberate cost.)
- `CONTINUE_OFFER_SEC` **is** offset by `DEATH_REPLAY_SEC` in `update.js`: that budget is
  measured in seconds the offer is actually *on screen*, and a real-device pass already
  found 0.9s too short once. `drawContinueOffer` also nulls `_continueBtnRect` while
  invisible, so there is no tappable-but-unseen button.

`markDeathHit` is called at the same six sites that set `deathCause` and, like it, also
fires on shield/invuln-absorbed hits - harmless, since it is only read in the `dead` phase.

**Death screen context**: "+X vs last" / "-X vs last" from the second run on, using
`prevRunScore`. The score glows gold within 5 of the personal best.

**Two records, two different beats, both score-based** (both compare `score`, not
distance):
- **ON FIRE** (`onFire`, `update.js`): fires the frame live score overtakes the bar it has
  to beat - today's `dailyBest`, falling back to the all-time `best` on the day's first run
  so a strong opening run still ignites (`_fireBar = dailyBest || best`, still guarded by
  `_fireBar > 0` for a brand-new player). Recolours the thruster trail fire-hot for the
  rest of the run, plus a one-shot notif / `sfxOnFire` / orange ring pop (`onFireFlash`).
- **New all-time record** (`pbPassed`, `update.js`): fires on overtaking the all-time
  `best`, NOT reset at the day boundary. Gold ring pop (`pbFlash`), `T.pbPassed`, `sfxPbPassed`.
  Separate from ON FIRE because ON FIRE has usually already fired earlier in the run
  (daily best <= all-time best), so the all-time crossing deserves its own bigger beat.

  **Don't turn either back into a position check.** `score` includes `bonusScore`, so a
  coin-heavy run passes the old best *score* before its *distance*; a `bestSX` position
  check disagreed with the score and read as a bug. `bestSX` still backs the passive gold
  ring (`bestMarker`) and the share card's PB marker, which are about position.

## World rank

The death screen's right column leads with the player's daily-leaderboard standing plus the
movement since their last run; the local list below is three rows (more overlapped the
button row on a 17 Pro Max). With no rank available the slot shows the all-time best.
When this run placed outside the three, the last row shows it with its real rank.

**Hidden below `WORLD_RANK_MIN_FIELD` participants** (`constants.js`, via the shared
`worldRankWorthShowing()` used by the death screen and the title rail badge): a tiny field
renders as "#1 / 2", i.e. "nobody else is here". Only the total is gated, never the rank.
Move the floor as the real player base moves.

No backend: `GKLeaderboard.loadEntries` (`GameView.swift` `fetchWorldRank`) and
`loadLeaderboardMetadata`'s `LeaderboardVariant` (`MainActivity.kt` `fetchWorldRank`)
both already return rank *and* total count. Both fire after a submit resolves, and once
at auth to prime the first death of a session. The delta is computed in
`main.js _tunlNativeUpdate`, not natively - only the page knows what rank it last showed.

That local list is `top5`, which is **wiped at the UTC day boundary** (`lifecycle.js`),
so it is labelled `T.todayTop`, never "TOP 5" - the old label made it look like lost data
every morning.

## Death screen ("Debriefing", 13.0 - do not revert to the 12.0 layout)

Rebuilt 2026-09-13: the old screen was *systemless* (13 font sizes, 39 hand-mixed colours,
27 hardcoded H-fractions, per-line centring). Five rules replace that, each load-bearing:

1. **Five type steps** (`DS_HERO`/`DS_BIG`/`DS_ROW`/`DS_TXT`/`DS_LBL`), not thirteen.
2. **One accent, and it is the day's own rock** (`getTheme().wallBase`), like world, title
   and share card. Gold = shards, green = positive rank delta, **red = only the death
   marker** (no red headline; it competed with the reticle). The score is the hero. A record
   pulses in the day accent, never cycles the hue wheel.
3. **Left-aligned to two column rules** (L = the run, RX = the world); numbers sharing a
   column are right-aligned to R so they form a column instead of drifting with digit count.
4. **Buttons inside the card**, PLAY AGAIN filled in the day colour, MENU/SHARE as quiet ghosts.
5. **The score gets a scale.** The rail runs to the all-time best, or, when the run is
   nowhere near it, to the next milestone (`milestoneStep()`) - the common case, since the
   median real run is short. Whatever the rail doesn't name, the right column or stats line does.

**Every vertical step is `max(H-fraction, type-derived)`** (the `step()` helper). Not
padding: `FS` is keyed to `UI_H`, which has a **floor of 600**, so on a short phone (H 371,
12 mini) fonts stay full size while H-fractions shrink - pure fractions put a 25px row into
a 17px slot. Anything added here must follow the same rule.

**The run band yields when space runs out.** It sits in the left column under the chips
(the right column would leave it 0px at 952x436) and degrades in three steps - full band,
no label, no band - so a run earning every reward pushes the band out, never overlaps.

**The band holds the run's scenes** (`constants.js` `SCENE_*` doc, `draw.js`
`captureRunScenes`): one real frame per sector reached (captured `SCENE_CAPTURE_LEAD_WX`
after each boundary, inside `drawWorld()` before notifs and flashes, cropped around the
ship), the frozen death frame last with a red edge, then a dashed slot naming the next
sector. Short of room, frames drop deepest-first, then S0, then the next-sector slot; the
death frame always stays. Label `T.flown · T.sector n`, no new strings. Canvases pooled
across runs; a rewarded continue drops only the death frame (`dropDeathScene()` in
`grantRevive`). `drawRunProfile()` is the fallback when no death frame exists (rejected as
a faint full-panel backdrop - noise behind text).

**Empty state:** only list rows that exist are drawn, clamped against the button row's top
edge (computed before either column draws). Never draw placeholder rows.

**Zero new i18n strings**: the rebuild reuses keys the screen or the share card already had
(`T.level`/`T.planet`/`T.flown`/`T.best`/`T.todayTop`/`T.worldRank`). Two shrink-to-fit
checks survive on purpose - world rank and button labels, the two strings that genuinely
vary without bound.

## Ghost run

`GHOST_STEP`/`ghostEncode` in `constants.js`, recorded and replayed in `update.js`, drawn
in `draw.js`. Because the corridor is reproducible from a date, a replay needs nothing
but the ship's vertical position over time - no obstacle log, no input log, no seed
capture. One byte per 60 world-px (= 1 point of distance score), quantised over `[0, H]`
so a ghost recorded on a phone replays correctly on any other screen size.

Scoped to the **calendar day**, not all time: an older track would be racing through a
cave that no longer exists. That also makes it reinforce the daily loop - each day opens
with no ghost, and the day's first good run creates the thing you chase for the rest of
it. Outlasting the ghost fires a one-shot notif and sound; that moment is the whole point
of the feature.

Recording and playback are indexed by `scrollX`, never elapsed time - a blue coin drops
scroll speed and ramps it back over ~4s (`slowScrollFactor`), which would desync a
time-indexed ghost from the tunnel; scrollX indexing is immune to it.

The ghost is drawn *before* the Player block in `draw.js`, not inside it: that block
applies a `rotate()` pivoted on the player's position, which would swing the ghost around
the live ship on every pitch change.

## Death screen rewards (key design decision, do not revert)

- **The death screen's rewards are a wrapping chip row, not stacked lines**, wrapping within
  the left column so every reward a run earned is visible at once (stacked lines used to
  suppress each other). Ship unlock outranks a mastery level-up (two ship-coloured chips
  read as a glitch); nothing else suppresses anything.
