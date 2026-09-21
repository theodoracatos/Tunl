# Scoring, share card, world rank, death screen, ghost

Moved verbatim from CLAUDE.md on 2026-09-21 (progressive disclosure). CLAUDE.md keeps the one-line rule and points here.

## Addictive systems

**Score formula**: `score = Math.floor(scrollX / 60) + bonusScore`. `bonusScore`
accumulates from coin collection and near-miss bonuses; resets each run.

**Milestone moments**: 75, 100, 150, 200, 250, 300, 400, 500, 600... Step size widens with
score via `milestoneStep()` (`world.js`): 25 up to 100, 50 up to 300, 100 up to 1000, 250
up to 3000, 500 up to 10000, 1000 beyond - **uncapped**, same "never just endurance at a
fixed pace" philosophy as `scrollSpd()`. A flat +50 step past 100 meant a strong player
hit a milestone every ~50 points, every one already-maxed `!!!` - noise, not a reward.
Big floating text + gold particle burst + ascending chord; `milestoneFlash` decays over
~0.6s. Four tiers (`triggerMilestone` in `input.js`, `sfxMilestone`): `!` below 100, `!!`
from 100, `!!!` from 200, `!!!!` from 1000, so a genuinely deep milestone still reads as a
step up.

**The ladder is seeded at `MIN_REAL_RUN_SCORE` (75).** The band SHAPE below 100 is still
25 points; only the starting rung moved. The safe opening flight makes 50 the minimum
score of any completed run, so the 25 and 50 rungs fired for 100% of runs, for free,
before the player had done anything. 75 is the first rung a player can actually miss.
Everything at and above 100 is untouched. **No score gate anywhere in the game may sit at
or below 50**, and that number moves with `SAFE_START_WX` - see the `MIN_REAL_RUN_SCORE`
doc block in `constants.js`.

**Don't drop the 25-point band below 100 again without new data.** It was dropped once on
the argument that it "fired 3 milestones before a weak run even reaches 100" - true, and
the wrong test: it counted milestones per run instead of the share of runs that fire one
at all, which was 13%. `test-math.js` asserts the whole ladder. If revisited, the number
that matters is the share of REAL runs that fire a milestone.

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
`markDeathHit()` in `update.js`, `deathHitX/Y/R` in `state.js`): for the first **0.70s**
after a fatal hit the death panel does not paint at all. The world is already frozen
(`update.js`'s `dead` branch advances nothing but `deadT`), the wrecked ship keeps
rendering in red, and a reticle contracts onto whatever landed the hit - because through
11.0 the death screen's entire answer to "what did I do wrong" was the word "dead" and a
number, against a measured beginner run of 0.9s of flight.

Two things keep this **free rather than a tax on restarting**, and both must stay true:
- The panel's own alpha is the only thing offset. (The button row's `deadT > 0.95` fade
  and `input.js`'s `DEATH_INTERACTIVE_SEC` gate, 1.1s, both moved +0.2s when the freeze
  went 0.40 -> 0.70 - restarting costs 0.2s more than before, the one deliberate
  exception.)
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

  **Don't turn either back into a position check.** `pbPassed` used to test crossing
  `bestSX` (the previous best run's death distance), drawn as a dashed gold PB line. Since
  `score` includes `bonusScore`, a coin-heavy run overtakes the old best *score* before
  reaching its *distance*, so the two signals disagreed on which fired first and read as a
  bug. `bestSX` still backs the passive gold ring (`bestMarker` in `draw.js`) and the share
  card's PB marker, which are legitimately about position.

## Daily run card (share)

`src/share.js`. TUNL seeds every run from the UTC date (`lifecycle.js`), so every player
on Earth flies a pixel-identical cave each day - the hard half of a shareable daily
game. (Verified per-device by `test-cave.js`; see "Cross-device fairness" for the four
things that have to stay true for it.)
The card is the other half.

The image is deliberately a picture of the **run**, not a score badge. Since the 2026-09-20 rebuild it
carries the **debriefing's own content** (`draw.js drawDeathScreen`), because that screen
already answers "what happened" better than the card's own story did: the run's scenes
(one real frame per sector reached, the death frame last with a red edge, then the dashed
next-sector slot), the score against the bar it was actually playing (all-time best, or
the next `milestoneStep()` when the run is nowhere near it), the world rank, and every
reward as a wrapping chip row. What deliberately does **not** cross over is the death
screen's right column - `TODAY TOP`, the run counter, the shard payout and its daily cap
- which is the sender's own meta and means nothing to a recipient. **Do not "simplify"
this into a screenshot of the panel**: the panel carries the button row, is a different
shape on every target (956x600 iOS / 520 Android / 440 web) and has no wordmark, URL or
date, which is exactly why the card composes the same blocks into a fixed frame instead.

The corridor profile (`drawRunProfile`) stays as the second picture, a strip under the
band, and takes the band's whole slot when no death frame exists (a revive drops it). It
is sampled as a rolling average whose window scales with run length - drawing
`boundsBase()` literally is accurate but renders a deep run as a seismograph, since ~60
wave periods get packed into 1100px.

**Two cuts from one renderer** (`_shareCardCanvas(portrait)`): landscape 1200x630 for the
desktop clipboard copy, **portrait 1080x1350 for a share sheet**, which is what every
native and mobile-web share actually feeds - chats, stories and feeds are all vertical,
and the landscape card arrives there as a thin band whose score renders at a third of its
size. The link-preview proportion is not lost: an unfurled *link* is drawn from the site's
own `og:image`, never from this PNG.

**Every block that yields, yields to the same rule as the death screen.** The scenes band
is placed against the chips' real bottom edge (a run that earns a record, a ship, a
mission and three stats wraps to a second chip row) and gives up height rather than being
drawn through; the band picks the **fewest rows** that hold every frame it has, so a run
that died in S0 gets two big frames instead of a half-empty strip.

**The footer is never conditional.** Tagline, `flytunl.ch/play` and a QR sit under a
hairline on every card. Until 2026-09-20 the URL was the *else* branch of the world rank,
so every card good enough to be worth sharing carried no address at all - forwarded as an
image (screenshot, story, any picture-only network) it was a number from a stranger with
no way back to the game. The header carries the **date** for the same reason: the tagline
promises "the same tunnel for everyone today" and the picture never said which day.

The **QR** is a self-contained encoder in `share.js` (byte mode, ECC M, versions 1-9,
`test-share.js` proves it by reversing the placement and checking the Reed-Solomon
syndromes, not by looking at it). It encodes `shareRunUrl(true)` - the link **without**
the ghost, ~80 characters, version 5 - because a ghost is up to 1500 characters and would
push the code past what is scannable at any size a card can afford.

Gated by `shareWorthy()` and by `shareAvailable()` so it never renders without somewhere
to send the card. The card crosses the JS->native boundary as a base64 PNG (the only
channel a canvas has), which is why the background is a flat wash rather than a radial
gradient - that one change took the payload from ~670 KB to ~180 KB. Measured again
2026-09-20: the portrait cut with a scenes band is ~290 KB (1080x1350 is 1.9x the
landscape cut's pixels, and the frames are photographic). If that ever needs to come
down, the lever is the scene thumbnails, not the wash.

**The app gate is the DAY, not the career** (2026-09-20). It was `score >= 200 ||
((newBest || newDailyBest) && score >= MIN_REAL_RUN_SCORE)`, which runs backwards to the
pride curve: a new player's every run is a personal best, so the button is on constantly
in week one and then goes dark once the all-time best settles above what a normal session
reaches - against the red-team sample (median real run ~22, median daily best ~70) almost
nothing in a real player's week clears either branch. Now a run also qualifies at
`SHARE_NEAR_BEST` (90%) of **today's** bar (`dailyBest || best`, the same `_fireBar` rule
ON FIRE uses), which resets every morning. The web branch is untouched: there the share
is the funnel, so any run past the floor offers it.

**The link is identical on every target** (2026-09-20). The app used to share bare
`/play/?r=`, on the stated theory that it had no way to hand a ghost off - not true:
`web.js _tunlParseWebParams()` is not `isWeb()`-gated, `state.js` consumes `?g`/`?s`
there too, and the Universal/App Link wiring reloads the page with the whole query
string. So the app was stripping three parameters all three targets understand and
shipping a card whose tagline the link could not make good on.

`SHARE_URL` in `share.js` is the only place the public marketing URL is written down in
this repo; the store listing pages themselves live in the Schedly repo's `wwwroot/tunl`.

Android needs a `FileProvider` for this (`AndroidManifest.xml` + `res/xml/file_paths.xml`)
because `ACTION_SEND` requires a `content://` URI, not raw bytes.

## World rank

The death screen's right column leads with the player's standing on the daily
leaderboard plus the movement since their last run, and the local list below it shrinks
to 3 rows to pay for it. With no rank available (offline, no Game Center / Play Games
session, first submit still in flight) the slot takes the all-time best instead. The list
is three rows either way since 13.0: five rows plus that BEST block is the tallest this
column gets, and it overlapped the button row on a real 17 Pro Max. When this run placed
outside the three, the last row is given to it with its real rank number, so "where did I
land" still has an answer.

**Hidden below `WORLD_RANK_MIN_FIELD` participants** (`constants.js`, currently 50, via
the shared `worldRankWorthShowing()` used by both the death screen and the title
screen's leaderboard rail badge). A live check of the web leaderboard on 2026-09-10
found 0-4 distinct players on most days, which renders as "#1 / 2" - a standing whose
real message to the player is "nobody else is here." Under the floor both surfaces fall
back to exactly what they already do when no rank is known. Only the total is gated,
never the rank value, so a genuinely deep field with the player at #1 still shows. Raise
or drop the floor as the real player base moves.

No backend: `GKLeaderboard.loadEntries` (`GameView.swift` `fetchWorldRank`) and
`loadLeaderboardMetadata`'s `LeaderboardVariant` (`MainActivity.kt` `fetchWorldRank`)
both already return rank *and* total count. Both fire after a submit resolves, and once
at auth to prime the first death of a session. The delta is computed in
`main.js _tunlNativeUpdate`, not natively - only the page knows what rank it last showed.

That local list is `top5`, which is **wiped at the UTC day boundary** (`lifecycle.js`),
so it is labelled `T.todayTop`, never "TOP 5" - the old label made it look like lost data
every morning.

## Death screen ("Debriefing", 13.0 - do not revert to the 12.0 layout)

Rebuilt 2026-09-13 on the report that the screen had looked the same since version 1 and
read as dated. It was not ugly, it was **systemless**: 491 lines setting 13 font sizes and
39 hand-mixed colours at 27 hardcoded H-fractions, every line individually centred on its
own column anchor (so both edges of both columns frayed with text length), with nine
`measureText` shrink-to-fit escapes papering over the missing grid. Five rules replace
that, and each is load-bearing:

1. **Five type steps** (`DS_HERO`/`DS_BIG`/`DS_ROW`/`DS_TXT`/`DS_LBL`), not thirteen.
2. **One accent, and it is the day's own rock** (`getTheme().wallBase`). The panel used to
   be hardcoded blue on all seven days - the one screen that closes out the daily run was
   the only surface in the game that did not know which day it was, while world, title
   screen and share card all tint from `WEEKDAY_PALETTES`. Gold stays reserved for shards,
   green for a positive rank delta, and **red is now only the death marker**: the old red
   "TOT" headline was the largest thing on screen while saying the one thing the player had
   just watched happen, and it competed with `drawDeathFreeze()`'s reticle, which is what
   actually points at the cause. The headline is gone and the score is the hero. A record
   pulses in the day accent rather than cycling the whole hue wheel. (The title screen's
   world line cycled the hue wheel too until 2026-09-16; it now takes the day accent as
   well - see "Typography and title accent".)
3. **Left-aligned to two column rules** (L = the run, RX = the world); numbers sharing a
   column are right-aligned to R so they form a column instead of drifting with digit count.
4. **Buttons inside the card** (it used to end at `H*0.82` with the row floating at
   `H*0.905`, which is why it read as something pasted over the game), with PLAY AGAIN
   filled in the day colour and MENU/SHARE as quiet ghosts.
5. **The score gets a scale.** A bare number never answered "was that good?" - the rail
   under it runs to the all-time best, or, when the run is nowhere near it, to the next
   milestone (`milestoneStep()`), which is the bar a short run is actually playing against.
   Median real run is ~22 points, so that is the common case, not an edge case. Whichever
   of the two the rail is not naming, the right column or the stats line still names.

**Every vertical step is `max(H-fraction, type-derived)`** (the `step()` helper). This is
the one structural hazard of this screen and it is not defensive padding: `FS` is keyed to
`UI_H`, which has a **floor of 600** (`constants.js`), so on a short landscape phone
(H = 371 on a 12 mini) every font stays full size while every H-fraction shrinks by 15%.
Pure H-fractions put a 25px list row into a 17px slot at that size - measured, not
hypothetical, and it is the same collision class that produced report after report on the
old layout. Anything added here must follow the same rule.

**The run band yields when space runs out.** It sits in the left column under the chips,
the only thing on the screen that belongs to this run alone, and not across the full width
because the right column (rank + three rows + stats) reaches `H*0.67` at 952x436 and would
leave it 0px. It degrades in three steps - full band, band without its label, no band - so a
run that earns every reward at once pushes the band out instead of overlapping it.

**The band holds the run's scenes** (2026-09-13, `constants.js` `SCENE_*` doc,
`draw.js` `captureRunScenes`): one real frame per sector reached (captured
`SCENE_CAPTURE_LEAD_WX` after each boundary, inside `drawWorld()` before notifs and
flashes, cropped around the ship), the frozen death frame last with a red edge (red stays
the death marker), then a dashed slot naming the next sector - the "how far can I get" the
score alone never answered. Short of room, frames drop in this order: deepest reached
sectors first, then S0, then the next-sector slot; the death frame always stays. Label is
`T.flown · T.sector n`, no new strings. Canvases are pooled across runs; a rewarded continue
drops only the death frame (`dropDeathScene()` in `grantRevive`). `drawRunProfile()` held
this band before and is still the fallback when no death frame exists; it remains the share
card's picture. (It was also once tried as a faint full-panel backdrop here and rejected - as
wallpaper behind text it is noise.)

**Empty state:** only list rows that exist are drawn, and the row count is additionally
clamped against the button row's top edge, which is computed before either column draws. The old layout always drew five, so
the common case rendered as four placeholder dashes under one number - an emptied-out full
state rather than a designed empty one.

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

- **The death screen's rewards are a wrapping chip row, not stacked lines**: ship unlock,
  mastery level-up, mission payout and shards used to be three `if`s all targeting `H*0.78`
  and all suppressing each other, so a good run could earn all three and be shown one; the
  fix after that concatenated them onto one shrink-to-fit line. Since the 13.0 rebuild they
  are chips that wrap within the left column, so every reward a run earned is visible at
  once. Ship unlock still outranks a mastery level-up (two ship-coloured chips at once reads
  as a glitch); nothing else suppresses anything.
