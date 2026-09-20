# TUNL design history

Long-form rationale for decisions that CLAUDE.md states as rules. CLAUDE.md is loaded
into every session, so it holds **the rule, the number and the "do not revert"**; the
measurement narrative, the rejected alternatives and the before/after tables live here.

Read the matching section here before re-opening a decision - the numbers are what stop
a change from being re-litigated on intuition. If you change a rule, update CLAUDE.md
*and* append here; if a section here contradicts CLAUDE.md, CLAUDE.md wins and this file
is stale.

---

## Warp portal

CLAUDE.md: "Warp portal (Sog)".

### The 11.0 cadence was 8-13x too frequent (audit 2026-09-12)

Shipped 11.0 ran `portalSpacing() = lerp(5200, 2800, progAt)`. An audit measured that at
**one ring every 1-4 real seconds** past score 100 - denser than boulders at every depth,
8-13x more frequent than the (since removed) warp coin's own 40s clock, and the opposite
of the "rarer than a boulder" intent in its own doc comment.

The shape was the error, not just the scale: spacing *tightened* with depth while
`scrollSpd()` climbs, collapsing the real-time gap twice over. Three things compounded:

1. **The ring needs no aim.** `portalHitTol` was a flat `PR*3.2`, wider than the ring's
   own +/-25%-of-halfGap jitter at every depth, so a player holding the corridor
   centreline logged **0 misses in 42.3 crossings** - and the accuracy-based duration
   added the same day was therefore near-inert.
2. **Warps re-triggered themselves.** One full-length warp sweeps 1900-4300 world-px
   against a 2100-3500 spacing, so a warp carried the player *past* the next ring and
   re-triggered before it ended: 185 re-triggers per run.
3. **Every warp exit grants `HIT_INVULN_SEC`** on top.

Net at a 100% hit rate: **warp live 54.6% of the run, hazard-immune 75.1%**, score 2400
reached in 92s instead of 145s - a **1.58x distance-score rate** on the one metric the
shared daily leaderboard is made of. Same failure the blue coin was retuned for on
2026-09-11, and it breaks the "mines are the only thing that guarantees no run survives
forever" pillar, since a warped player cannot be hit by one.

The fix keys growth to `prog2At`, not `progAt`: `progAt` saturates at score 233, so every
flat-widened candidate left ring #2 past score 250 - which per the leaderboard audit
(median daily best 70, highest ever 169) means most players would see exactly one ring
ever, the same mistake that had boulders at 84000. Measured after: one ring per
11s/12s/19s/28s/44s/46s across the score bands, rings at score ~47/161/274/455, warp live
5.7%, hazard-immune 11.0%.

### Two follow-ups from the same audit

**The hit window was a phantom circle.** 55px of window against a ~39px ring meant you
could take a warp while visibly outside it, and `accuracy` measured off that phantom - a
rim graze scored ~0.7. Keying the window to `p.r` was a measured balance no-op (0
centreline misses before or after; the `PR*1.6` floor never binds at any shipped H).
Forcing a *real* aim would need a smaller ring plus much wider jitter - a look-and-feel
redesign for a playtest, not an audit fix.

**Vacuumed coins were manufacturing combo points.** One ring auto-collects every gold coin
on screen; letting those increment the combo normally let its quadratic term produce 11-54
bonus points per warp, worst at LOW score where gold's share is 76%. Against a median daily
best of 70, the first ring alone (score ~47, which every player reaches) was worth about as
much as the whole rest of a typical run. Now 17 points cold.

### Why the 11.0 look was replaced

The 11.0 ring was two wide, flat, counter-rotating ovals drawn entirely before the ship: it
read as a spinning disc you fly *over*, had no direction, sank into the violet Ianthe
(Friday) rock, spent two `shadowBlur`s, and was drawn at only 0.52x the height of its own
hit window.

### Blue coin during a warp (2026-09-14)

From a player report that the slow bar appeared but neither the sound nor the speed changed.
`triggerWarp` already cleared a slow that was *already running*; the opposite order was
missed. Started immediately, `slowScrollFactor()`'s 0.6x multiplies against
`warpScrollFactor()`'s 2.2-2.8x for a combined 1.32-1.68x - still faster than normal, so
unfeelable - while the player is hazard-immune anyway, so 27-40% of a 4.0s window drained
for nothing. The music broke too: `bgmSetSlow` and `bgmSetWarp` share
`_bgmNode.playbackRate` and each calls `cancelScheduledValues` first, so `bgmSetWarp(false)`
at the warp's end wiped the sag and left the track at normal speed while the game actually
did slow down. Verified in a browser after the fix: banked at 4.00 through the warp at a
clean 2.20x surge, released the frame warpTime hits 0 with the factor dropping to 0.63,
`bgm: warp(false) | slow(true,4.00)` in that order.

### The wall-clamp margin

At the corridor wave's peak slope the warp's faster drift can outrun `MAX_VY` - a measured
~45% of `MAX_VY` already at the difficulty plateau, unwarped, before `WARP_MULT_MIN` is
even applied. Wave amplitude and frequency both still climb with `_prog2`, and so does
`warpMult`, so hand-tuning `WARP_GAP_MULT` against that is tuning against a moving target.
Hence the clamp, not a margin.

---

## Cross-device fairness

CLAUDE.md: "Cross-device fairness".

### The cave genuinely forked per device until 2026-09-11

A replay of one day seed at six device sizes produced six different caves, diverging from
wx ~938 (score 15). The four causes are listed as rules in CLAUDE.md. The one worth
re-reading is #3: all spawners shared `rng()` and interleave per frame, while `scrollX`
advances by `scrollSpd()*dt` which carries a W/600 term - so the frame on which an object
crossed the horizon, and therefore the ORDER of draws, varied by screen width. Same seed,
same curves, different cave.

### The `SPAWN_AHEAD_*` budget has been broken twice

**First:** cannons and boulders sat OUTSIDE the stalactite horizon, so their overlap
checks were half blind - which is the only reason they were as common as they were.
Fixing that made them nearly extinct until they got retry loops (`CANNON_RETRY_OFFSETS` /
`BOULDER_RETRY_OFFSETS`, same pattern as `MINE_RETRY_OFFSETS`).

**Second (2026-09-11, caught by a browser playtest, not by a test):** the retry term was
never added to the budget, so a retried probe walked straight back out past the
stalactite horizon and the veto it was retrying for saw an empty array again. Measured
over 60000 world-px: **15 of 18 boulders and 28 of 28 cannons placed blind**, 12 boulders
had a pass sealed by a stalactite and one was sealed on **both** sides (an unavoidable
death at score 940). The very first boulder of the day had a ceiling spike driven through
its top edge.

Measured after the three fixes: **0 sealed passes** (was 12 of 18), first boulder back at
score 85 on 7 of 8 day-seeds, cannon density unchanged (27.5 per 60000 world-px), boulder
density 9.3. Deep boulders are genuinely rare past score 900 (0.04 per 1000 world-px vs
0.21 early) - at that corridor width two passes plus the rock barely fit, so that thinning
is honest, not a bug.

Why the horizon was raised rather than the offsets clamped: clamping boulders to the
~226px that fit inside `SPAWN_AHEAD_STAL` = 600 would have dropped 15 of 18 of them,
re-creating the near-extinction the retry loops exist to fix. The stalactite sequence
itself does not change (each spawner has owned its own rng stream since the cross-device
pass), so creating stalactites earlier no longer reorders anyone's draws.

The boulder pass margin was 1.1 player diameters before the 2026-09-13 shrink, 1.3 after.

### Deep mine density was an artifact of the same blindness

With the horizons ordered, `_makeMineAt`'s flat 300px tip-push radius left no vertical
room at all past the plateau (`stalSpacing()` floors at 50px there). Lerping it 300 -> 90
over `_prog2` moved measured deep mine density 0.98 -> 2.0 per 1000 world-px. Below score
233 every one of these changes is a measured no-op.

### Coins inside boulders and on mines (2026-09-20)

Reported from play: a power-up inside a mid-corridor rock. Cause: `coinBlockedByStal` only
knows stalactites, and boulders (`_fitIsland`) and mines (`_makeMineAt`) never looked at
coins. Coins are created first (500 ahead against 300 / 200), so the rock or mine was simply
placed over a coin that already existed. Replay, 8 day-seeds x 60000 wx, 956x440, ~625 coins:
7 centres inside a boulder (gold 4, shield 2, slow 1), 17 within the collection radius of one,
20 touching a mine's bob range.

Fix: the later spawner yields, the coin is never touched. Rejecting the coin instead was the
first thought and is unsafe here: it needs the boulder to exist when the coin is made, which
means raising the boulder horizon past SPAWN_AHEAD_STAL, and a two-way removal (boulder
deleting coins that already exist) advances the poison/bomb/red clocks in one order and not
the other, so the cave would depend on frame timing. Coins-first keeps one direction. Cost:
`SPAWN_AHEAD_COIN` 500 -> 1500 (boulder probe 300 + 1000 + 100 + clearance), the most the coin's
own stalactite budget allows (1546 <= 1550).

Measured after: 0 centres in a boulder, 0 overlaps at `PLACE_COIN_CLEAR_R` (~17 ref px), boulders
107 -> 107 (a rejected island takes a shorter stretch or the next retry offset), mines 262 -> 265,
coins 625 -> 624. The remaining ~7 boulder / ~8 mine "touches" in a wider probe are the
generous 30px COIN_HIT_R collection radius reaching a rock the coin does not visually touch.

---

## Coin system

CLAUDE.md: "Coin system".

### gapBonus as absolute px was flattening the difficulty curve (12.0)

Measured widening of the corridor by score band, same pilot, same seeds, absolute px vs
corridor fractions:

| band | 0-25 | 25-50 | 50-100 | 100-233 | 233-500 | 500-900 | 900+ |
|------|------|-------|--------|---------|---------|---------|------|
| before | 1.00x | 1.16x | 1.36x | 1.55x | 1.79x | 1.99x | **2.01x** |
| after  | 1.00x | 1.14x | 1.32x | 1.42x | 1.42x | 1.41x | **1.40x** |

Before, the reward grew steadily with depth until it doubled the deep corridor - the
corridor the pilot actually flew narrowed only 10.6 -> 8.6 ship diameters against a
designed 11.0 -> 4.2. After, the widening is flat from score 100 on (the early rise is
just the bar filling from empty) and the flown corridor narrows 10.6 -> 5.9.

Impact on real runs: the `average`-tier median was 22 before and 22 after, mean -2%. Deep
runs are where it bites - expert mean 625 -> 459, p90 1543 -> 1092. Same standing rule as
the 2026-09-11 pass: only the deep run may get harder.

`DEEP_DECAY_PEAK` was expected to need lowering once the magnitudes scaled and does not.
Swept at 1.0 / 1.6 / 2.5 and 25.0 over 100 expert runs each, the held bonus moved
0.850 -> 0.849 -> 0.821 and the per-band corridor not at all. Left at 2.5 rather than
re-tuned on a guess.

### Chicane gold oversupply cancelled the whole narrowing

A flat 30px gate gave ~7 coins/sec; the 340px gate that replaced it still measured
**2.09/sec** in the deep run. Against the ~0.2 coins/sec that holds `gapBonus` pinned at
its cap that is a 10x oversupply, and the measured consequence was an effective half-gap
running flat at ~0.34*H for the entire run.

Measured after the switch to a seconds gate, across 8 day-seeds at a 50/70% collection
rate: median free channel at a stalactite falls 9.4 -> 7.5 -> 6.7 -> 5.5 -> 3.6 -> 2.1
player diameters across the score bands, against a flat ~5-7 before.

---

## Coin type progression

CLAUDE.md: "Coin type progression".

### Gate history

Red was score 34, orange 34, green 71, and bomb/poison/drain all 34 until 2026-09-13,
when the flight-plan rework moved each to a sector start. `MINE_START_WX` was 1800
(~score 30), then 6400, then 12000, then sector 3 (~178).

### The power-up supply audit (2026-09-11)

Every capped power-up was pinned at its ceiling once a run got deep: shield stack full
87-100% of the time from score 233 on, slow-time active 38-85% of the run. The
*durations* were never the problem (4s per blue coin, 3s per magnet are short) - the
weighted roll has no notion of real time, so coins-per-second climbs with `coinSpacing()`
and `scrollSpd()`.

An earlier pass of the same audit called ammo "pegged at 10/10". That was a modelling
error, not a finding: bullets auto-fire every 0.32s, so with firing modelled the player
is armed only 2-9% of the run at every depth. Hence orange's exemption.

The gold-share split was retuned in the same pass, replacing one blended `goldDecayT` fed
through a single proportional split. The single-split version let every capped power-up
(red's stack cap, blue's slow-time duration, orange's ammo cap) drift past its documented
ceiling by the deep-run plateau - red was hitting ~26% against its 21% cap, which showed
up as a real player complaint ("too many shields").

### Why the hazard-coin clock replaced a percentage roll

The percentage was derived per coin *candidate* from a target hits/sec, so the cadence
would not accelerate with difficulty - correct in principle, but it assumed every
candidate becomes a real coin. A live replay of a real daily seed measured **~90%
rejection** by `coinBlockedByStal()`, varying with difficulty, chicane density and day
archetype, so the actual cadence was ~10x rarer than intended.

The intervals were also retuned down from an original ~55s/45s guess after checking how
long runs actually last: a live replay found a "good" run (score ~300) takes only ~20-36
real seconds end to end at realistic phone widths, and even a "great" run (score ~1000)
is only ~54-97s. The original interval meant many runs, especially on wide screens, saw
literally zero of either.

### Coin rendering

The old glossy gems used an abstract pictogram per type (a droplet for slow time, four
strokes for the magnet) that had to be learned, and their gradient + white-glint +
`shadowBlur` material was the only glossy thing left after the 2026-09-16 design pass.
Three cartridges were tried for the ammo coin before the crosshair and read as sticks at
~17pt.

---

## Deep-run variety

CLAUDE.md: "Deep-run variety".

### Why `DEEP_VARIETY_WX` moved twice

54000 -> 30000 (score ~500) on 2026-09-11, same leaderboard argument as boulders: at
54000 none of it had ever been seen. Then 30000 -> 9000 (score ~150) in 12.0, after a
red-team simulation (2400 runs across 4 calibrated skill tiers) found the real
leaderboard sample's own tier reached wx 30000 in exactly **0% of 600 runs** - the same
mistake, one order smaller. At 9000 a tier just under real players' best runs reaches it
in 24.7% of runs, one step better (expert) in 63.5%.

### Two latent bugs the move exposed (both fixed, not worked around)

1. **`deepMorphAt` had a seam at its own switch-on point.** It jumped straight from the
   inert `{a1:1,a2:1}` to a fully-hashed character in a single world-px at the
   `DEEP_VARIETY_WX` boundary. The existing "continuous across character boundaries"
   guard in `test-math.js` never sampled it - it starts checking a few hundred world-px
   past the boundary, well after the jump. At wx=30000 this sat deep past every boulder
   ever placed there, so it went uncaught; at wx=9000 it landed in active boulder
   territory and `test-cave.js`'s boulder-pass-safety check caught it as a sealed pass.
   Fixed with an entry ramp for segment 0.
2. **`test-cave.js`'s own boulder-safety check was broken.** It extracted
   `boundsBase`/`placeStalW` from a `makeWorld()` sandbox that never had `startRun(day)`
   called on it, so it validated every day's boulders against world.js's bare load-time
   defaults (phase 0, jitter 1, archetype 0, `_deepHash` seeded off day 0) instead of
   that day's real seeded state. The portal check right below it already re-seeded per
   day and was never affected. This test bug is what turned bug #1's tiny seam into a
   false "2 boulders sealed" failure.

---

## Audio bus and loudness

CLAUDE.md: "Audio bus and loudness". Method: `reference_audio_method` memory.

### What the 2026-09-17 audit found

Mix ~6 dB too quiet; no limiter anywhere; the death crash landed 1.22s after the hit;
shield break (-32) and cannon fire (-29) sat *below* a gold coin; near-miss and combo sat
below the thrust bed; UI sfx sat under the title music; both music tracks looped through
their own fade-out plus 0.66s of silence; every low-frequency layer was flattered by flat
measurement and does not exist on a phone speaker.

Raised in the fix: shield break +8, cannon fire +5, near-miss/combo +5, the whole UI block
+6. The title bed went 0.058 -> 0.100 - it sat 9 dB under the play bed and, measured,
under its own UI taps.

The `DynamicsCompressor` trap: it reduces broadband for its whole release window, so
`sfxMineExplode` came out of the boost *quieter* than it went in, and it acted below its
own threshold. The `WaveShaper` was verified linear below `LIMIT_KNEE` by rendering each
sfx with and without it (0.0-0.3 dB).

### Loop points

The play track's first pair (8.10 / 56.10) was an audible jump on device: waveform
correlation 0.33 across the seam. The shipped pair (11.53 / 38.96) scores 0.73 and was
picked by ear from four rendered candidates. The music does not repeat sample-exactly.

The title piano's old pair (0.30 / 114.50) cut into the piece's own fade-out and landed on
unrelated material. The piece has copy-pasted sections (0-16s = 66-82s, 84-96s = 100-112s)
that would give an exact seam, but only for a loop that skips the tail - rejected on
request, the user wants the loop to run to ~114s. The lead-in stays as a one-time intro.

`BGM_OUTRO_START` 61.75 is a quiet pad, one last hit at ~68.5, then decay to silence.

### Impact sound levels

Matched to the sounds they replaced, loudest 50ms before the master gain: shield -21,
rock -26, mine -21, bomb -23 dB.

### Cave reverb

Measured: peaks +0.5 to +1.5 dB, a rock hit's tail ~20 dB under the hit (0.12-0.40 s), a
mine's +6 dB over dry. The first try at `CAVE_VERB_WET` 0.22 left the tail ~28 dB down,
i.e. inaudible under the music bed.

### `sfxDie`

Still the mirror of the OLD spool-up roar layer (420 -> 160 Hz), close enough to the new
turbofan that it was left alone.

---

## Milestone ladder

CLAUDE.md: "Addictive systems".

The 25-point band below 100 was dropped once and restored in 12.0. The removal argued it
"fired 3 milestones before a weak run even reaches 100" - true, and the wrong test: it
counted milestones per run instead of asking what share of runs fire one at all.

A red-team replay against the real leaderboard sample (median daily best 70) put actual
players at a **median run of 22**, with only **13% of runs** ever reaching the old first
milestone at 50 - **2% within a new player's first five runs**. The first thing the game
had to say other than "dead" sat at more than twice the distance a typical run covers.

The ladder was then re-seeded at 75 on 2026-09-14, because the 12.0 restoration was
calibrated on those same "median real run is 22, only 13% reach 50" numbers - which the
same release invalidated, since the safe opening flight makes 50 the minimum score of any
completed run.

---

## Cannons

CLAUDE.md: "Cannons".

### `CANNON_SHOT_TRAVEL` 1.15 -> 1.45 (12.0)

A red-team simulation flagged cannon shots as the weakest-telegraphed hazard in the game:
every other obstacle is visible on screen well before the final dodge (`SPAWN_AHEAD_*`),
but a cannon's shot does not exist until `CANNON_FIRE_LEAD` world-px out and its vertical
span is freshly rolled at that exact instant.

Measured across a pooled 800-run / 20-day sample (same expert-tier pilot, same seeds,
before/after only `CANNON_SHOT_TRAVEL` changing): the share of cannon deaths already
unavoidable more than a human reaction time (0.25s) before impact fell from **19.4%
(n=31, worst of every hazard type - stalactites 17.9%, walls 11.5%) to 2.9% (n=34, now
the best or tied-best)**. Stalactite (18.1%) and wall (9.7%) numbers barely moved in the
same run, confirming the change is isolated to cannons: `CANNON_SHOT_TRAVEL` only feeds
the shot's own vx/vy in `updateCannonShots`.

Verified live that the muzzle still fires ~587-593 world-px out, matching
`CANNON_FIRE_LEAD` = `W*0.62` either way.

The cannon-death count moved n=31 -> n=34 out of 800 runs by sampling noise alone. At the
time, the game's one unseeded gameplay `Math.random()` call was the warp coin's duration
roll, which compounded enough over a long run to shift which runs landed in each
rare-death bucket between samples. That coin and its roll were removed on 2026-09-13.

### Barrel aiming

The barrel used to be pinned at a hardcoded `dir * 0.55` rad while the sprite rotated by
world velocity, so gun and shell disagreed. Measured after the fix: barrel = nose = motion
relative to the gun at every sampled cannon (49 / -32 / 23 / 20 degrees). Shot travel
measured 1.43-1.45s to reach the player against the 1.45 target.

Cannons first appeared at wx=6000 before the 2026-09-13 safe opening flight moved them to
7000.

---

## Flight plan (sectors)

CLAUDE.md: "Flight plan (sectors)". Concept + evidence:
https://claude.ai/code/artifact/9c713c80-e348-46fc-b6ee-f66af5bb9be4

### What the replay audit found in the 12.0 working tree

Real spawners + physics, 4 bot tiers x 100 runs, 24 day-seeds:

- **Pacing was lumpy**: 7 new elements in the first 9 s, none between 9 s and 22 s, five
  between 23 s and 37 s, nothing new after that.
- **41% of beginner runs died within 8 points of the walls turning lethal.** 91% of
  beginner deaths are walls, and the safe zone only bumped, so it could not teach them.
- **Stalactites per second doubled twice** between score 300 and 1150, which ended 100%
  of expert runs inside score 500-900.
- **3x the 11.0 mine count**, because sparse stalactites stopped the placement vetoes
  from thinning mines and coins - the coupling that is why densities must be retuned by
  measured rate, never by the spacing number.

### Measured result (bot tiers; "average" = the tier real players matched in 11.0)

| tier | median before -> after | reaches 100 | dies within 8 pts of walls lethal |
|------|------------------------|-------------|-----------------------------------|
| beginner | 65 -> 95 | 4% -> 39% | 41% -> 3% |
| average | 107 -> 155 | 32% -> 70% | 16% -> 2% |
| good | 205 -> 401 | 80% -> 91% | 1% -> 1% |
| expert | 715 -> 928 (p90 1328) | 100% | 0% |

Average-tier death rate per sector is now a ramp (S1 38%, S2 60%, S3 68%) instead of a
cliff. Per 10 real seconds at W956: stalactites 17 / 20 / 23 / 26 / 33 / 44 / 53 / 62 /
68 / 78 / 96 across S1..S11+ (was 20 -> 188 with two doublings), mines 2.6 in S3 rising
to 10 by score ~1000, coins 7-9 through S4 then thinning to ~4 (+ chicane gold ~4).

### Hull scratches

Originally expired at S3 via `HULL_END_WX`; that constant was deleted on 2026-09-19 when
the dusk-city approach made the walls lethal from the tunnel entry, and the scratches now
last the whole run.

---

## Physics tuning

CLAUDE.md: "Physics constants".

### THRUST has been walked back twice on real player feedback

Originally tuned up hard across several requested passes (GRAVITY 1150 -> 1300, THRUST
2400 -> 3400, MAX_VY 820 -> 1080) chasing a "Flappy Bird snappy" feel. Real-player Reddit
feedback (2026-09-09 - the only unsolicited player feedback the project has ever
received) called the accel "too fast", with players dying before the run's rush ever
landed. Walked back the same day to THRUST 2700; a same-day playtest of 2700 felt off in
the other direction (too floaty), so it was nudged to **3100** - net-up 1800 vs net-down
1300, roughly midway between the original 2100:1300 snap and the 2700 pass's 1400:1300
softness. Shipped in 10.2.

If it ever needs walking back further, the original pre-tuning feel is GRAVITY 1150 /
THRUST 2400 / MAX_VY 820.

### The trapezoid integrator

Measured over 0.5s of held thrust with the old `py += vy * dt`: 228px at 144Hz, 232px at
60Hz, 240px at 30Hz, against an exact 225px. After the fix, a bit-identical input
schedule gives a 0.000px spread across 12-144Hz (was 4.1px on that same schedule).

**It did not close the measured score gap between frame rates** - a simulated pilot still
scored ~33% higher at 144Hz than at 60Hz afterwards, essentially unchanged. The physics
half is now exact; the rest is input resolution (a thumb can only change state on a frame
boundary, so a 144Hz device genuinely gets finer control), which no integrator change can
remove and which a bang-bang bot exaggerates relative to a human.

**It is very slightly a nerf at 60Hz**: the ship covers 225px rather than 232px over a
0.5s climb, and proportionally more on short taps (the old error was `1 + dt/T`, so it
flattered quick corrections most). No constant rescale can reproduce the old behaviour
for that reason. ~+3% on THRUST would restore the old half-second manoeuvre.

---

## Ship unlock economy

CLAUDE.md: "Ship unlock economy".

### Why the shard ladder was re-tuned (2026-09-10)

The previous prices (240/880/2200/4800/12000/32000/50000, cumulative 102120) were measured
against the real earning curves and found to make the top three tiers effectively
unreachable: NOVA was ~174 days even at the full 300/day ceiling and ~652 days at a
realistic ~80/day; SOLARIS ~341 and ~1277.

Worse, the binding constraint flipped from `stardustGate` to shards at VOID - so the
stardust system, the thing that is supposed to pace unlocks, stopped doing any work at all
for the entire top half of the roster.

The current ladder (240/320/560/1280/2400/4000/5600, cumulative 14400) restores stardust as
the binding constraint at every tier, with SOLARIS still landing on day 180 exactly.

### Content rating

Both stores' content-rating questionnaires were redone when `unlock_all_ships` shipped in
6.0. It is a flat one-time digital-goods purchase, not gambling / loot-box / cash-back, so
the "shards are never purchasable with real money" answer from the prior audit held after
re-checking.

## Daily run card (share)

**The audit that produced the rebuild (2026-09-20).** The prompt was the user's:
"the death screen looks so good it would be great for sharing - can't we just forward
it?" The honest answer was "yes technically, no editorially", and the audit that answered
it also challenged the rest of the share path:
https://claude.ai/artifact/XSSaqo22neVCJxtVHXDLnt

**Why not a screenshot of the panel.** It is ~40 lines of work (`cv` is readable -
`record.js` already blits it, and a temporary resize would even give card resolution),
and four things make it the wrong asset anyway: the button row is in the picture; the
panel is a different shape on every target (956x600 iOS, 956x520 Android, 956x440 web),
so the game's public face would have no constant proportion; there is no wordmark, URL or
date anywhere on it; and three of its blocks (`TODAY TOP`, the run counter, the shard
payout with its daily cap) are the sender's own meta. So the card composes the same
CONTENT into a fixed frame instead of copying the panel's pixels.

**The twelve findings, and what shipped.** Ranked by what they cost:

| # | finding | shipped |
|---|---------|---------|
| F1 | URL was the *else* branch of the world rank, so every card with a rank had no address at all | always-on footer |
| F2 | app link was bare `/play/?r=`, stripping `?d`/`?s`/`?g` that all three targets parse | one link everywhere |
| F3 | gate `>= 200 \|\| PB` runs backwards to the pride curve | `SHARE_NEAR_BEST` of today's bar |
| F4 | no date on a card whose tagline says "today" | `20 SEP` in the header |
| F5 | one cut, and it was the link-preview shape | portrait 1080x1350 for share sheets |
| F6 | no QR, and the card keeps landing on a screen | self-contained encoder |
| F7 | the call to action existed only in the accompanying text | tagline in the footer |
| F8 | the profile strip took half the card and said less than the scenes | scenes band leads, profile demoted |
| F9 | desktop copied the link and threw the rendered card away | `ClipboardItem` image + text |
| F10 | the only share entry point is after a run, never an invitation before one | open |
| F11 | the card is in the sender's language | open, mitigated by keeping text minimal |
| F12 | no feedback after a native share | open |

**The QR is measured, not decorative.** Payload is `shareRunUrl(true)`, the link without
the ghost: with the ghost it is up to ~1600 bytes, i.e. past version 40 (177x177 modules),
which at the landscape cut's 104pt is 0.6pt per module - not scannable by anything.
Without it the payload is ~80 characters, version 5 (37x37), ~2.8pt per module landscape
and ~5pt portrait. `?d` and `?s` survive, so the QR still hands over the actual challenge.
`test-share.js` proves the encoder by reversing it (format bits -> mask -> zigzag ->
de-interleave -> Reed-Solomon syndromes -> payload), because a wrong QR fails silently: it
still looks exactly like a QR, on a card that has already been shared.

**Two layout rules came out of looking at the rendered cards, both the same class of bug
as the 13.0 death screen's:**
- The scenes band is a SLOT, not a strip. Dividing a 296pt slot into one row makes each
  frame 335pt wide, which holds two - fine for a run that died in S0, and wrong for a deep
  one, where it drops every sector but the last. It now takes the fewest rows that hold
  what the run has.
- The band yields to the chips, not the other way round. Six chips (record + ship +
  mission + three stats) wrap to a second row and ran straight through the band's label
  at 1080x1350 before the band was placed against the chips' measured bottom edge.

## Crystal stalactites (16.0, 2026-09-20)

The spike had looked the same since 1.0 - a smooth bezier cone with a root-to-tip
gradient, stone speckle, an inner glow, a `shadowBlur` edge and a specular streak -
while the ship (K5 "Facette + Licht"), the coins and the boulders had all moved to
flat facets lit from above. The rock was the last airbrushed object in the picture.
It is a cluster of upright, tapered crystal prisms now. The rules live in CLAUDE.md
and the `CRYSTAL_*` doc block; what follows is how each one was arrived at, because
every single one came out of breaking it first.

**The drawing kept disagreeing with the hitbox, in both directions.** The first
draft gave every prism a lateral offset, including the dominant one. Measured at
game scale (`hw` 12.4, `len` 70) the clamp then cut the main crystal to 46% of the
spike length - so the lethal triangle ran on for another 38px below a visibly
finished crystal. That is the unfair direction and it was the first thing the user
saw in the hitbox overlay ("warum ist die Hitbox so merkwuerdig"). The fix is the
rule that the main crystal sits on the axis at full length. Later the same mistake
appeared mirrored: burying the landed chunk by TRANSLATING it 0.40*hw down sank its
base with it, leaving the collision standing above the drawing. Burying it by
LENGTHENING the shafts keeps the base where `stalHit()` has it.

**A fat crystal in a slender triangle is a geometry problem, not a taste problem.**
The first version read as needles and was rejected. The reason is arithmetic: a
PARALLEL column of half-width w fits a triangle running from `0.85*hw` to zero only
up to `t = 1 - w/(0.85*hw)`, so at `w = 0.8*HB` it is finished at 20% of the
length. Fat therefore meant short and long meant thin. Tapered shafts follow the
flank and are wide at the foot AND reach the tip. The same arithmetic bites
companions: at `dx` 0.48 with a 0.24 tilt the clamp leaves 6-9% of the length,
which is invisible at game size - the "twin" was a single crystal for one iteration
before anyone noticed. Upright at `dx` 0.13 it keeps 70%.

**"Nest crystals can never be flown through" - claimed, refuted, measured, true.**
The nest crystals sit beside the triangle, on rock that kills anyway. Claim one was
that a height of at most `PR` makes them provably untouchable; that was simply
wrong arithmetic (the ship dies at `PR` from the wall and clips a crystal of height
h from `h + PR`, so a band of thickness h always exists). Claim two, that the band
is therefore hit regularly, was wrong the other way: the user said it was impossible
without hitting the main crystal first, and the trajectory sweep agreed - 0 of
682318 passes with free climb and dive phases and instant max thrust reach it, and
0 again at flat, mid and deep spikes, under slow-time, in a warp and with nest
height at its maximum. The reason is the acceleration ramp: over the 37px between
the outermost nest crystal and the axis the ship can change altitude by 3px.
Nest height is a cosmetic knob. Re-run that sweep if `PR`, `MAX_VY` or the scroll
speed ever move.

**The colour circle is full.** The measured hue distance from each world's rock to
the nearest reserved signal colour: Rhodia 1 degree (drain), Mars 3 (ammo), Ianthe
12 (shield), Pallas 16 (poison), Ceres 17 (coin bonus), Io 19 (magnet), Luna 41.
Rotating away reaches at best 19-42 degrees and lands three worlds on the same
blue-violet, which costs the daily identity. So hue is not the axis that separates
a crystal from a coin: place, value and form are.

**Cost, measured rather than estimated.** Drawn live, a floor druse is ~90 path
operations, and at eight visible spikes that measured 1.78ms per `draw()` against
the old cone's 0.283ms - 6.3x, and the geometry cache (which removed ~34
`boundsAt()` calls per spike) barely moved it, because small polygon fills are what
costs. Baking the cluster into offscreen sprites took it to 1.31ms; merging socket
and body into ONE blit for the common attached case took it to **0.244ms, below the
cone's 0.283ms**. Two overlapping alpha blits per spike cost five times what one
does. Do not split that blit again without re-measuring.

Numbers are headless SwiftShader, which exaggerates fill cost against a real
GPU-composited canvas - they are a relative signal, and the device pass is still
outstanding.
