# TUNL design history

Long-form rationale for decisions that CLAUDE.md and `docs/agents/*.md` state as rules.
CLAUDE.md is loaded into every session, so it holds only the one-line rule and a pointer;
`docs/agents/<topic>.md` holds the rule, the constants and the "do not revert"; the
measurement narrative, the rejected alternatives and the before/after tables live here.
A `CLAUDE.md: "<Section>"` reference below means that heading in `docs/agents/`.

Read the matching section here before re-opening a decision - the numbers are what stop
a change from being re-litigated on intuition. If you change a rule, update its `docs/agents` file
*and* append here; if a section here contradicts `docs/agents`, `docs/agents` wins and this
file is stale.

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

---

## Narratives moved out of docs/agents (2026-09-21)

When `docs/agents/*.md` was condensed to rules, constants and traps, every paragraph that
was shortened or removed was moved here verbatim, grouped by source file and section. The
short rule that replaced it lives at the same heading in `docs/agents/`.

### Stalactites (moved from docs/agents/hazards.md, 2026-09-21)

**They are CRYSTALS since 16.0 (`CRYSTAL_STALS`, `constants.js` doc block +
`draw.js` `drawCrystalSpike`) - do not go back to the smooth cone.** The spike had
not been touched since 1.0 while ship, coins and boulders all moved to flat facets
lit from above; the rock was the last airbrushed object on screen. A ceiling spike
is now a twin (main crystal + two companions + two nest crystals), a floor spike a
druse (main + four steps + six nest crystals), all upright, drawn from
`_rockHash(s.wx)` - no `rng()` draw, no change to `makeStal()`, placement or
collision, so `test-cave.js` still reports a byte-identical cave. Flip
`CRYSTAL_STALS` to `false` and `_stalOutline`'s cone is back.

**The drawing is one blitted sprite per spike** (`_xtalSprites`), baked per
stalactite and rebuilt only when the raster scale or the tone key changes. Drawn
live it was ~90 path operations per druse and measured **6.3x the entire `draw()`
of the old cone** at eight visible spikes; socket and body merged into one sprite
it is **0.244ms against the cone's 0.283ms**, i.e. the crystal is now the cheaper
of the two - it spends no gradient, no clip, no `shadowBlur` and no specular
stroke per frame. Do not split that blit again without re-measuring.

**Breaking one sounds and looks like glass, not gravel** (`sfxCrystalCrack` in
`audio.js`, `burstCrystalShards` in `systems.js`). The sound's signature is not the
noise burst but the four INHARMONIC PARTIALS that ring on after it (ratios
1 / 1.41 / 1.93 / 2.57 off 2050 Hz, decaying 0.15-0.34s), around a brighter and
shorter fracture transient, a short high body, scattering shard ticks and half the
rock's low thump. Measured against the sound it replaces: loudest-50ms -20.8 vs
-21.3 dB (level-matched, so the hierarchy holds), decay 0.20s vs 0.10s, and the
band split moves from 27/22/52 to 4/17/80 low/mid/high. The fundamental sits at
2050 Hz rather than 3100 deliberately, so the first partial lands in the MID band
and the sound has body on a phone speaker. Judged by offline render through the
real bus, never by ear - see the `reference_audio_method` memory.
The visual half is `burstCrystalShards`: tumbling slivers (`long`/`rot`/`spin` on
the ordinary particle, drawn as a triangle instead of a dot) thrown ALONGSIDE the
round dust, never instead of it - the dust sells the impact, the shards sell the
material. **All four ways of touching a crystal throw them** - measured 14 on a
bullet kill, 18 on the bomb-clear behind a shield, 8 on the break-off and 22 on a
fatal hit. That last one was missing at first and is the one that matters most:
flying into a crystal is by far the most common contact, and it lands in the death
freeze frame, right where `drawDeathFreeze()`'s reticle is contracting. The world
is frozen there, so the shards hang as a starburst rather than animating, which
reads better than motion would. **No crack sound on the fatal hit** - `sfxDie` owns
frame 0 and is ~8 dB louder, so it would only mask it. Both are gated on `CRYSTAL_STALS`, so the one switch reverts picture and
sound together. **The LANDING keeps the rock thud** (`sfxStalCrack`): that is a
chunk striking the floor, not a fracture.

**A falling spike drops the CRYSTAL, not the rock socket.** Nest crystals and the
rock lip stay behind on the ceiling as an empty socket - which doubles as a
telegraph - and only the load-bearing crystals fall, so the falling picture stays
congruent with the triangle that falls with it. That matters: the "nest crystals
are unreachable" argument rests on the wall being in front and the main crystal
behind, and a free-falling chunk has neither (measured 687px^2 of theoretically
clippable nest area at the wall, 0 of it reachable by any trajectory, against
1809px^2 in free fall). **On landing nothing rotates** - the chunk stays as it
fell, tip buried like a nail in wood, which is also the only reading consistent
with `stalHit()`, where a falling spike keeps `ay = b.top + fy` and
`ty = b.top + length + fy`. The burial is done by LENGTHENING the shafts
(`CRYSTAL_LAND_SINK`), never by translating the body down - translating sinks the
base too and leaves the collision standing above the drawing.

**Falling stalactites** (`FALL_LEAD`/`FALL_SPAN` in `constants.js`, `fallSpacing()` in
`world.js`, `stalFallY`/`updateFallingStals` in `systems.js`): from `FALL_START_WX`
(S7, ~score 493; `nextFallWx` set in `startPlay`; the first one lands a bit later, since
the cursor flags the next *single* non-chicane ceiling spike after it),
a seeded cadence flags it to break loose. While loose it **shakes left/right**
(the draw loop's `wobX`, ramping as it nears the detach point) plus trickles dust, so the
player can spot which spikes drop. It detaches when the player is within `FALL_LEAD` (and
still clearly ahead), then **falls the full corridor** over `FALL_SPAN` world-px of scroll
(`stalFallY` = `(corridor - length)·t²`, **scrollX-indexed so a blue coin can't desync
it**, same as the ghost) until the tip meets the far wall - it becomes a floor spike and
the dodge is unambiguously "go over it". That distance is recomputed **live every
frame**, never frozen at detach: the corridor keeps moving after a spike lets go
(`gapBonusVisual` easing in, a deep chamber, `_halfGap` drift), and a captured value left
spikes hanging in mid-air - measured 5 of 33 in one run, up to 3.8 player diameters above
the floor, because a landed spike kept its frozen offset while the floor moved away.
Guarded in `test-collision.js`. The gap above is
`>= 1.2 * halfGap` (stalLenFrac hard-caps length at 0.8). Then it just scrolls past.
`fy` is folded into `stalHit`/`stalHitBullet`/`triggerBombExplosion`/the draw loop so
collision and render always agree. Bullets/bombs kill a falling one like any stalactite.
`fallSpacing()` runs `~3400 -> 2000` world-px over `_prog2`, floored at 1800.


### Boulders (moved from docs/agents/hazards.md, 2026-09-21)

Started at world-x 84000 (~score 1400) until 2026-09-11. A replay audit against the real
daily leaderboard (D1 `tunl_scores`) showed that meant **no player had ever seen one**:
28 recorded player-days, median daily best 70, highest ever 169 - and 84000 is ~109 real
seconds of flawless flight. Moving it to 5100 is also the *forgiving* direction, not the
harsh one, because `makeBoulder` bounds the radius by the corridor: measured across the
sample grid the narrow pass is 1.74 player diameters at score 85 versus 1.11 at score
1400. Measured across 8 day-seeds the first boulder lands at score 85 on 7 of them and
by score 150 on the last. Same reasoning moved falling stalactites 12000 -> 7800.
**Don't push this content back out past ~score 170 without new leaderboard data showing
players actually get there.**
(The 2026-09-13 flight plan then moved boulders to S4, ~score 252, on the "far too hard"
feedback and the safe opening's +50 baseline. The rule stands relative to that: don't push
it further out without leaderboard data.)

**Shrunk 2026-09-13 on player feedback ("verdammt schwer zu umfliegen")**: radius cap
0.42 -> 0.30 of halfGap, pass margin 2 -> 2.6 PR (placement and stalactite veto alike).
Measured over 8 day-seeds to wx 40000: rock diameter 1.91 -> 1.36 player diameters,
narrow pass 1.22 -> 1.52, wide pass 1.92 -> 2.20, count 64 -> 71. A 3.0 PR margin was
tried and rejected - it dropped the count to 29 (deep boulders stopped fitting).
Same day, shrunk once more on request: radius cap 0.30 -> **0.26** of halfGap.

**Rock islands, not balls (2026-09-13, on request).** `r` is now the vertical
half-THICKNESS bound only; the horizontal half-length `hl` = r x a seeded stretch
(1.7-2.6), hard-capped at `BOULDER_MAX_HALF_LEN` = 100 world-px (`systems.js`), so the
narrow-pass guarantees above are unchanged. Four seeded outline families
(`_islandProfile`): lens, teardrop, peanut, shelf - top and bottom generated separately,
so none is mirror-symmetric. Shelf gets a smaller slice of the roll because its thin face
survives placement far more often (an even roll made it 43% of islands). The outline is a
polygon on Chebyshev samples (`BOULDER_U`), and that exact polygon is both drawn
(`draw.js`) and collided against (`boulderHit`, shared by ship, bullets and bombs) -
verified to agree within 1px. `hl` is world-px keyed off the REFERENCE radius, so the
island covers the same world-x on every device. Placement (`_fitIsland`) checks both
passes at every outline sample against that sample's own bounds and every overlapping
spike, falling back to a shorter island (`BOULDER_STRETCH_FALLBACK`) before giving up.
Measured over 8 day-seeds to wx 60000, circle -> island: count 109 -> 108, narrow pass
median 1.89 -> 1.93 / min 1.48 -> 1.46 player diameters, length median 1.7 -> 3.4 / max
3.8 -> 5.8 diameters; 70% of islands get their full stretch. `test-cave.js` re-checks
both passes along the whole outline.


### Coin system (moved from docs/agents/coins.md, 2026-09-21)

```javascript
const GAP_PER_COIN_FRAC  = 0.075 / 0.43;   // bonus halfGap added per coin
const GAP_BONUS_MAX_FRAC = 0.19  / 0.43;   // cap: max halfGap bonus
const GAP_DECAY_FRAC     = 0.015 / 0.43;   // bonus lost per second
```

**Why they stopped being absolute (do not revert).** A fixed number of px added to a base
corridor that shrinks `H*0.34 -> H*0.163` is a curve-flattener by construction: the bonus
is easy to hold (chicane gold sits on the centreline the player already flies), an expert
holds it at ~66% of cap all run, and it grew from 1.00x widening early to **2.01x deep**.
The corridor actually flown narrowed 10.6 -> 8.6 ship diameters against a designed
11.0 -> 4.2. As fractions it is flat at ~1.40x from score 100 on and the flown corridor
narrows 10.6 -> 5.9: the corridor is the base curve TIMES a constant instead of PLUS one.

**If the deep run needs tightening, the lever is supply or `GAP_BONUS_MAX_FRAC`, not
`DEEP_DECAY_PEAK`** - swept 1.0 / 1.6 / 2.5 / 25.0 over 100 expert runs each, the held
bonus moved 0.850 -> 0.821 and the per-band corridor not at all. Coin supply refills the
bar far faster than any of those rates drain it, so the cap binds, not decay.

**Chicane gold is gated in SECONDS, not world-px** (`CHICANE_GOLD_GAP_SEC`,
`worldPxForSec()` in `world.js`, applied in `maintainStalactites`; flat at every depth
since `CHICANE_GOLD_EARLY_MULT` was deleted). Deep, `stalSpacing()` sits on its 50px
floor at a 0.62 chicane probability, so nearly every chicane wants to drop a centred gold
coin on the line the player threads anyway. A fixed distance keeps shrinking in seconds
as `scrollSpd()` climbs forever - the 340px gate still measured 2.09 coins/sec deep
against the ~0.2/sec that pins `gapBonus` at its cap, and the consequence was that the
effective half-gap ran flat at ~0.34*H for the entire run: **the whole 0.34 -> 0.163
narrowing was cancelled out.** A time gate is flat in coins/sec at every depth by
construction. Two implementation constraints:


### Coin type progression (moved from docs/agents/coins.md, 2026-09-21)

**Power-up SUPPLY is paced in real seconds, not just by weighted share**
(`POWERUP_MIN_GAP_SEC` / `POWERUP_GAP_EARLY_MULT`, enforced in `makeCoin`;
`blueClock`/`redClock`/`greenClock` in `state.js`, ticked in `update.js`). The weighted
roll has no notion of real time, so as `coinSpacing()` tightens and `scrollSpd()` climbs,
every type's coins-per-second climbs with them - measured deep, the shield stack was full
87-100% of the time and slow-time active 38-85% of the run. Four rules, all load-bearing:

- **Orange (ammo) is deliberately exempt** (`test-math.js` guards it). Bullets auto-fire
  every 0.32s, so a 5-shot pickup drains in 1.6s - there is no stock to pin, and with
  firing modelled the player is armed only 2-9% of the run at every depth.

**Gold's share also gets an explicit extra cut with depth** (`GOLD_DEEP_DECAY`, applied in
`makeCoin`), phased half over the score 34-233 ramp (`t`) and half over the 233-900
marathon (`_prog2`), so gold keeps thinning long after `t` maxes. **The two legs are
redistributed differently and must stay that way:** the t-leg spreads proportionally
across whichever of blue/orange/green are already active (never a flat
leftover-to-green fallback, which would bend green's gate open early), while the `_prog2`
leg goes to green alone - red/blue/orange are all flat past score 233 while green is the
one type designed to keep growing. A single blended split let every capped power-up drift
past its ceiling by the plateau (red ~26% against a 21% cap), which surfaced as a real
player complaint ("too many shields").

**Blue's stack cap is 6.0s** (cut from 8.0 on 2026-09-11; ELECTRIC's 12/15 scaled with it
to keep its documented +50%). Slow-time measured active 38-85% of the run past score 233,
which makes the blue coin the baseline pace rather than a rescue and works against the
"`scrollSpd()` never plateaus" rule. **The 4.0s per coin is untouched** - the swoop is the
mechanic; what changed is how far a streak can run the window out.

**Poison/bomb/drain cadence is a real-time CLOCK, never a per-candidate percentage**
(`poisonClock`/`drainClock`/`bombClock` in `state.js`, ticked in `update.js`; once past a
jittered `nextPoisonAt`/`nextDrainAt`/`nextBombAt`, the next coin that actually clears
placement becomes that type). A percentage per coin *candidate* silently assumes every
candidate becomes a coin - `coinBlockedByStal()` rejects ~90% of them, varying with
difficulty, chicane density and day archetype, so the cadence players saw was ~10x rarer
than intended and drifted with conditions no formula could predict. The clock is immune to
rejection rate, day archetype and screen width by construction. Intervals `POISON_INTERVAL_SEC` / `BOMB_INTERVAL_SEC` / `DRAIN_INTERVAL_SEC`
(`constants.js`) target ~20s poison / ~16s bomb / ~30s drain; bomb is deliberately more frequent than poison, because a reward
landing at least as often as a punishment reads more generous. Their first clock target
counts from `HAZARD_START_WX`, so none lands inside the safe opening flight.

**Coin rendering ("Gegenstand" - do not go back to glossy gems or add a frame)**
(`draw.js` `drawCoin` / `COIN_OBJECTS`). Each coin draws the thing it does: gold = gem
with two outward chevrons (the corridor widens), blue = a Sanduhr that runs through in 4s,
red = violet Wappenschild, orange = a Fadenkreuz, green = horseshoe magnet with its poles
toward the ship and sparks drifting in, bomb = red bomb with a burning fuse, poison =
Giftflasche, drain = inward Strudel. A player learns the type from the object without
being told. **No frame:** a hexagon / dashed-hazard-ring frame was built and removed on
the user's call - at ~17pt it shrank the object until you could not tell what it was.
Objects draw at `COIN_OBJECT_SCALE` (1.5) of the hitbox radius, gold a little more
(`COIN_OBJECT_BOOST`). Flat facets lit from above, same material as the ship, **zero
`shadowBlur`** (the old path spent 5-6 per coin). Gold moves no more than the blue coin -
no spin, no flip, a slow shallow chevron breathe. Purely visual: the hitbox is still
`COIN_R * COIN_SIZE_MULT`. Study: https://claude.ai/artifact/Cqn7gYiN5ZXneyTA2BwTXb (variant 1)


### Coin bonus and placement (moved from docs/agents/coins.md, 2026-09-21)

- **Coin bonus is a real difficulty lever, not a marginal aid**: `GAP_PER_COIN_FRAC` = 0.075/0.43, `GAP_BONUS_MAX_FRAC` = 0.19/0.43 of the corridor's own half-gap (see Coin system above) - one coin adds ~17% to the halfGap and a maxed bonus 44%, at every depth. Coins are essential by design, not a small nudge - don't shrink these back down to make the bonus merely "helpful." The 12.0 change from absolute px to corridor fractions is **not** a weakening of that lever: it is exactly as strong as it always was early (wx=0 is a byte-exact no-op) and now equally strong, rather than disproportionately stronger, deep.


### Addictive systems (moved from docs/agents/screens.md, 2026-09-21)

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

**Death freeze frame** (`DEATH_REPLAY_SEC`, `drawDeathFreeze()` in `draw.js`,
`markDeathHit()` in `update.js`, `deathHitX/Y/R` in `state.js`): for the first **0.70s**
after a fatal hit the death panel does not paint at all. The world is already frozen
(`update.js`'s `dead` branch advances nothing but `deadT`), the wrecked ship keeps
rendering in red, and a reticle contracts onto whatever landed the hit - because through
11.0 the death screen's entire answer to "what did I do wrong" was the word "dead" and a
number, against a measured beginner run of 0.9s of flight.

- The panel's own alpha is the only thing offset. (The button row's `deadT > 0.95` fade
  and `input.js`'s `DEATH_INTERACTIVE_SEC` gate, 1.1s, both moved +0.2s when the freeze
  went 0.40 -> 0.70 - restarting costs 0.2s more than before, the one deliberate
  exception.)

  **Don't turn either back into a position check.** `pbPassed` used to test crossing
  `bestSX` (the previous best run's death distance), drawn as a dashed gold PB line. Since
  `score` includes `bonusScore`, a coin-heavy run overtakes the old best *score* before
  reaching its *distance*, so the two signals disagreed on which fired first and read as a
  bug. `bestSX` still backs the passive gold ring (`bestMarker` in `draw.js`) and the share
  card's PB marker, which are legitimately about position.


### World rank (moved from docs/agents/screens.md, 2026-09-21)

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


### Death screen ("Debriefing") (moved from docs/agents/screens.md, 2026-09-21)

Rebuilt 2026-09-13 on the report that the screen had looked the same since version 1 and
read as dated. It was not ugly, it was **systemless**: 491 lines setting 13 font sizes and
39 hand-mixed colours at 27 hardcoded H-fractions, every line individually centred on its
own column anchor (so both edges of both columns frayed with text length), with nine
`measureText` shrink-to-fit escapes papering over the missing grid. Five rules replace
that, and each is load-bearing:

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


### Death screen rewards (moved from docs/agents/screens.md, 2026-09-21)

- **The death screen's rewards are a wrapping chip row, not stacked lines**: ship unlock,
  mastery level-up, mission payout and shards used to be three `if`s all targeting `H*0.78`
  and all suppressing each other, so a good run could earn all three and be shown one; the
  fix after that concatenated them onto one shrink-to-fit line. Since the 13.0 rebuild they
  are chips that wrap within the left column, so every reward a run earned is visible at
  once. Ship unlock still outranks a mastery level-up (two ship-coloured chips at once reads
  as a glitch); nothing else suppresses anything.


### Procedural tunnel (moved from docs/agents/difficulty.md, 2026-09-21)

Two overlapping sin waves, amplitude and frequency scale with difficulty (`_prog`).
`_prog = Math.min(Math.sqrt(scrollX / 14000), 1)` - sqrt easing: fast early ramp, plateau near max. Reaches max difficulty at 14000 world px (~score 233).

```javascript
_wA1     = lerp(H * 0.07,  H * 0.12,  _prog);   // wave amplitude 1
_wA2     = lerp(H * 0.035, H * 0.055, _prog);   // wave amplitude 2
_wF1     = lerp(0.0025,    0.0048,    _prog);    // wave frequency 1
_wF2     = lerp(0.0060,    0.0115,    _prog);    // wave frequency 2
```

- **Corridor width + wave amplitude** use `gapProgAt(wx)` (`world.js`): flat at 0
  (widest, `H*0.34`) through `GAP_EASY_WX` = `SAFE_START_WX` = 3000 (~score 50, where the safe flight ends), then **linear** (a sqrt
  ease front-loads the narrowing, which was the complaint) over `GAP_RAMP_WX` = 90000,
  so `H*0.163` is only reached at wx=93000 (~score 1550, was ~233). Half-gap
  old -> new: score 200 0.176 -> 0.328, 500 0.163 -> 0.293, 800 0.163 -> 0.257.
  `EARLY_WIDEN_WX` 12000 -> 24000. Wave *frequencies* stay on `_prog` (re-pacing
  `sin(wx*f)` at large wx scrambles phase).


### Flight plan (sectors) (moved from docs/agents/difficulty.md, 2026-09-21)

**Densities are rates per reference second, not world-px spacings** (`world.js`
`sectorRate` / `sectorEnvelope`): `spacing = worldPxForSec(1 / rate)`. Stalactite slots
`STAL_RATE_S1` 2.0/s x `STAL_GROWTH` 1.14 per sector, 1.08 from `SECTOR_GROWTH_TAPER`
(S8); mines `MINE_RATE_S3` 0.28/s x 1.2, then 1.1; floors 50 / 200 px unchanged, so rates
grow without limit and every run still ends ("mines guarantee an eventual death" holds).
Each sector is a **sawtooth**: the first 20% runs at 55% density (the breather, with 1.5x
coin candidates as the payout), then ramps 80% -> 115%. Coins: `COIN_RATE_SAFE` 0.75/s in
S0, 0.95/s in S1-S3, x0.985 per sector after, floor 0.8/s.

**Hull scratches** (`HULL_SCRATCHES` = 2, from the tunnel entry, for the **whole run**;
`update.js` `hullScratch`): a lethal-wall contact spends one - clamp, bounce, "SCRAPE!"
notif, HUD diamonds bottom-right - instead of ending the run. Counts as a hit for the
No-Hit achievement. **A rewarded continue repairs them** - see Ad cadence. **The grace after a scratch is wall-only** (`WALL_GRACE_SEC`,
`state.js wallGraceT`): the wall clamps instead of scratching again, but stalactites,
mines, boulders and shots stay lethal and the ship does not blink. It was the full
`HIT_INVULN_SEC` while scratches expired at S3; carried into the deep run that would let a
player scrape a wall on purpose to pass through a stalactite field. **Scratches forgive
wall mistakes only; direct hits are the shield's job.** A plain shield at the same moment
was measured and rejected - it mostly boosted the good tier (+72% median) by eating a
stalactite later.

**Known residual:** experts still hit a reaction-time wall at S10-S11 (death 63% / 77% per
sector, was 100% at S7-S8). A slower `stalLenFrac` leg and a slower chicane-probability
ramp were both tried and measured as no-ops, so the lever left is speed itself.


### Difficulty scaling functions (moved from docs/agents/difficulty.md, 2026-09-21)

Two-phase difficulty system:

- `_prog  = Math.min(Math.sqrt(scrollX / 14000), 1)` - main ramp (sqrt eased), 0→1 over first 14000px (~score 233)

- `_prog2 = Math.min(Math.max(scrollX - 14000, 0) / 40000, 1)` - inferno, 0→1 from 14000→54000px

All of these are then multiplied by the day's `DAY_ARCHETYPES` entry (`world.js`), so a
given day runs a bit denser or sparser than the base curve.

```javascript
scrollSpd()    // 230 → 400 → 560 px/s at W=600, scaled by W/600 (W capped at 956), then an uncapped sqrt tail
stalSpacing()  // rate per ref second per sector, see Flight plan (floor 50)
stalLenFrac()  // 0.46 → 0.64 → 0.76 fraction of halfGap (hard cap 0.80)
coinSpacing()  // rate per ref second per sector, see Flight plan (floor 175)
mineSpacing()  // rate per ref second from S3, see Flight plan (floor 200)
cannonSpacing()// 4200 → 2400 → 1500 px between cannons (floor 1200)
chicaneProb    // 0 from CHICANE_START_WX, faded in over 6000px, 0.24 → 0.42 (hard cap 0.62)
```

At score 233 (`_prog` = 1) the full corridor is `2 * H * 0.163`. A maxed `gapBonus`
widens it by `GAP_BONUS_MAX_FRAC` (1.44x), the same factor it widens the wx=0 corridor
by - coins matter just as much at high difficulty as they ever did, they just no longer
matter *disproportionately* there. Pre-12.0 this same maxed bonus was a flat `H*0.19`
at every depth, which at the plateau was **2.17x** - more than doubling the corridor
the difficulty curve had just spent 233 points narrowing.

**Onboarding corridor widen** (`earlyWidenAt()`, `world.js`): the base curve's wx=0
half-gap (`H*0.34`, corridor 68% of screen height) already reads as narrow to a player
who hasn't yet found the hold-to-thrust feel, so `earlyWidenAt(wx)` adds extra half-gap
on top of the base curve - `H*0.09` at wx=0 (walls reduced to a sliver each side, corridor
~86% of screen height), smoothstepped down to 0 by `EARLY_WIDEN_WX` (`world.js`, 24000 / ~score 400 since
2026-09-13) so it rejoins the hand-tuned base curve exactly, with no kink. Added in both `refreshWave()` and `halfGapAt()` so rendering/
collision (`boundsAt`) and placement (`boundsBase`, via `halfGapAt`) agree - same pattern
as `deepChamberAt`.


### Speed never plateaus (moved from docs/agents/difficulty.md, 2026-09-21)

- **`scrollSpd()` never plateaus**: every other difficulty knob (`stalSpacing`, `stalLenFrac`, `coinSpacing`, `mineSpacing`, wave amplitude/frequency) caps once `_prog2` saturates, because those define corridor *geometry* and pushing them further would make the tunnel unnavigable. Scroll speed has no such ceiling - it only shrinks reaction time - so past `_prog2 > 1` (score ~900) it keeps climbing forever via a sqrt-eased tail (`base + sqrt(_prog2-1)*90`), intentionally so a long enough run is never merely "endurance at a fixed pace." Don't re-add a hard cap here.


### Deep-run variety (moved from docs/agents/difficulty.md, 2026-09-21)

Past `_prog2 = 1` (score ~900) every corridor geometry knob is capped and only
`scrollSpd()` moves - so a five-digit run was one variable, speed, getting twitchier
against a frozen corridor. `DEEP_VARIETY_WX` (the switch-on point for the shape morph,
chambers, deep coin-line shapes and the palette drift) is **9000 (~score 150)**, moved
there from 54000 -> 30000 -> 9000 on the same leaderboard argument as the Boulders
section: at the old values essentially no real player had ever seen any of it. Full
numbers in the doc comment above `DEEP_VARIETY_WX` in `world.js`.

It is safe at any value because every feature is bounded *relative to the same wx
unmorphed* (the `test-math` energy guard holds at any wx, chambers only ever widen). Two
things deliberately did NOT move with it: the **speed pulse** (still gated on
`_prog2 > 1` in `scrollSpd()` - surging above a still-ramping trend is a different
proposition from surging above a flat one) and the **apex-biased mines**, which keep
their own `DEEP_APEX_WX` = 54000 because that one is flagged below as an unplaytested
fairness risk.

- **Shape morph** (`deepMorphAt`, folded into `refreshWave` and `boundsBase`): the two
  corridor waves' **amplitudes** are rescaled by a seeded per-day sequence of characters
  (`DEEP_CHARS`: even / sweeps / chop / near-straight), each holding
  `DEEP_CHAR_WAVELEN` world-px then smoothstepping into the next. The a1/a2 splits are
  picked so `wA1*wF1 + wA2*wF2` (peak corridor velocity) never exceeds ~1.02x the
  same-`wx` unmorphed value - a different *ride*, never more wiggle-energy than today.
  **Frequencies are deliberately left untouched**: changing the frequency of `sin(wx*f)`
  at large `wx` scrambles accumulated phase and needs a phase-integral rework.
  `test-math.js` guards inertness below the plateau, the <4% energy ceiling across 40
  day-seeds, and boundary continuity. Segment 0 has its own entry ramp (the same
  30%-of-wavelength blend later segments spend blending OUT, spent blending IN), so
  `wx <= DEEP_VARIETY_WX` stays exactly inert and everything past it is seamless - without
  it the morph jumped from inert to fully-hashed in a single world-px at the boundary.

- **Speed pulse** (`scrollSpd()`): past `_prog2 > 1`, a seeded swell of up to
  `+DEEP_PULSE_AMP` (12%) **above** the trend over `DEEP_PULSE_WAVELEN` world-px
  (`swell = 0.5 - 0.5*cos(...)`, in `[0,1]`). **Surge-only - it never dips below the
  trend** (it was +-8% around the trend until 2026-09-08, i.e. half of every cycle the
  deep run decelerated, which reads as the game getting easier). Each breath's trough
  sits exactly on the trend, and the trend itself still climbs forever, so the speed
  envelope only ever rises; only the within-breath ease-back varies.

- **Chambers** (`deepChamberAt`, `DEEP_CHAMBER_PERIOD`/`DEEP_CHAMBER_PEAK`): a rare
  seeded window (~55% of 15000px periods) where the half-gap balloons to 2.1x on a sine
  bump then settles - a breather, never a hazard (wider is always navigable). Applied to
  `_halfGap` in `refreshWave` **and** `halfGapAt()` so `boundsBase` / coin+mine placement
  follow the room. The sub-window never touches a period boundary, so the factor is
  always 1 (continuous) at the seams. This is the one thing that legitimately breaks
  "the corridor only ever narrows" past the plateau, by design.


### Warp portal (moved from docs/agents/portal.md, 2026-09-21)

Reward set-piece, not a hazard - the third verb ("escaping") next to reacting
(stalactites) and committing (boulders). The one way in is a hoop in the corridor
(`makePortal`/`maintainPortals`/`_makePortalAt`, from `PORTAL_START_WX` = 3000,
~score 50) calling `triggerWarp(accuracy)` (`src/systems.js`) when flown through.
Long-form rationale and the audit numbers: `docs/design-history.md` -> "Warp portal".

**There is no warp coin, and don't reintroduce one** without a silhouette that reads at
`COIN_R` - the 11.0 coin read as an unidentifiable "pill" and was removed 2026-09-13 on
request, along with `WARP_COIN_INTERVAL_SEC`, `nextWarpWx`, its `rngCoin()` draws,
`T.notifWarp` and the `Math.random()` duration fallback.

**The ring's cadence is a DUTY CYCLE, not a world-px number** (`portalSpacing()`,
`world.js`, `lerp(6500, 10000, progAt) * (1 + 4*prog2At)` - do not revert to a
progAt-only curve). Growth is keyed to `prog2At` because `progAt` saturates at score 233
and any flat-widened candidate pushes ring #2 past score 250, i.e. most players would
ever see one ring. Measured now: one ring per 11-46s across the score bands, warp live
5.7% of the run, hazard-immune 11.0%. **Re-measure the duty cycle, never the world-px
number, before moving this again** - the 11.0 curve read as reasonable and was 8-13x too
frequent (warp live 54.6%, a 1.58x score rate on the shared leaderboard).

**The hit window IS the drawn radius** (`Math.max(p.r, PR*1.6)`, never a flat `PR*3.2`),
so the accuracy gradient spans the picture honestly. **A warp-vacuumed coin banks in
full but does not raise the combo** (`systems.js`, the `warpVacuum` branch) - letting
them increment let the combo's quadratic term manufacture 11-54 bonus points per warp,
worst at low score. A combo *earned* before arriving still pays on every vacuumed coin;
that part is skill and is kept deliberately.

**What a live warp does.** For `WARP_DUR_MIN..MAX_SEC` (~1.1-1.6s, picked linearly by
the crossing's accuracy - dead centre earns the max), `scrollSpd()` is multiplied by
`warpMult` (`state.js`, rolled once at trigger from `WARP_MULT_MIN..MAX` 2.2-2.8x
against the player's live `_prog2`, held fixed for the whole warp; capped at
`_prog2 >= 1`). `warpScrollFactor()` (`world.js`) is the mirror of `slowScrollFactor()`
and is folded into the identical five call sites. The corridor widens (`WARP_GAP_MULT`,
eased like `gapBonusVisual`, **`boundsAt()` only, never `boundsBase()`** - no placement
decision may depend on a player state), every stalactite/mine/boulder/cannon-shot is
skipped and drawn ghosted at `warpFade`, and every gold coin on screen is auto-collected.
Power-up coins still have to be flown to. The music surges via `bgmSetWarp` (mirror of
`bgmSetSlow`, same `_bgmNode.playbackRate`): 1.35x on trigger, gliding back to 1.0x -
deliberately far under the gameplay 2.2-2.8x, because a track played that fast reads as
chipmunked, not fast.

**A blue coin collected DURING a warp is banked, not started** (`state.js slowPending`,
released on `update.js`'s warpTime falling edge next to the `HIT_INVULN_SEC` grant, which
also arms `bgmSetSlow`). Same cap, so banking can never buy more than flying it normally.
Started immediately it would be unfeelable (0.6x against 2.2-2.8x is still faster than
normal) and would drain 27-40% of its window while the player is hazard-immune anyway -
and it broke the music, since both helpers share `playbackRate` and `cancelScheduledValues`.
The HUD shows a banked slow as the cyan bar held full, dimmed and pulsing: a draining bar
would lie, nothing would look swallowed. `triggerWarp` still clears a slow that is
*already* running ("you are now fast, not fast-and-slow-at-once").


### Daily run card (share) (moved from docs/agents/share.md, 2026-09-21)

The image is deliberately a picture of the **run**, not a score badge. Since the 2026-09-20 rebuild it
carries the **debriefing's own content** (`draw.js drawDeathScreen`), because that screen
already answers "what happened" better than the card's own story did: the run's scenes
(one real frame per sector reached, the death frame last with a red edge, then the dashed
next-sector slot), the score against the bar it was actually playing (all-time best, or
the next `milestoneStep()` when the run is nowhere near it), the world rank, and every
reward as a wrapping chip row. What deliberately does **not** cross over is the death
screen's right column - `TODAY TOP`, the run counter, the shard payout and its daily cap

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

**The footer is never conditional.** Tagline, `flytunl.ch/play` and a QR sit under a
hairline on every card. Until 2026-09-20 the URL was the *else* branch of the world rank,
so every card good enough to be worth sharing carried no address at all - forwarded as an
image (screenshot, story, any picture-only network) it was a number from a stranger with
no way back to the game. The header carries the **date** for the same reason: the tagline
promises "the same tunnel for everyone today" and the picture never said which day.

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


### Ad cadence (moved from docs/agents/economy.md, 2026-09-21)

Every 4th death **and** at most once per 120s of wall clock, above `MIN_REAL_RUN_SCORE`
(75, `constants.js`; mirrored as `minScoreForAd` in `AdsManager.swift`/`.kt` and
`AD_MIN_SCORE` in `ads-web.js` - keep all four in sync), never with Remove Ads. That
floor was 25 everywhere until 2026-09-14, which the 12.0 safe opening flight had silently
turned into a no-op - see the `MIN_REAL_RUN_SCORE` doc block. The wall-clock floor is the rule that actually matters: a good run lasts only
20-36 real seconds, so a pure every-Nth-death rule put a full-screen ad in front of
engaged players roughly every 90 seconds. When the floor blocks, the death counter is
rolled back one so the two rules don't compound into a much longer gap than intended.

- **Rewarded continue** (8.1) - offered once per run past score 25 on death, revives the
  run **and repairs the hull back to `HULL_SCRATCHES`** (2026-09-19, on request:
  `grantRevive` also resets `hullScratches`/`wallGraceT` and says so with a `+HULL`
  notif). Without it the ad bought a few seconds at the hardest point of the run, since
  spending the scratches is usually what got the player there. Safe: scratches are
  wall-only and run-scoped, no placement, `rng()` or leaderboard number reads them.
  **An extra shield on top was considered and rejected (2026-09-19, user's call)** - the
  revive already recentres the ship, fires a bomb clear and grants `HIT_INVULN_SEC`, so a
  shield would stack a direct-hit absorb on that and blur "scratches forgive wall
  mistakes, direct hits are the shield's job"; the one time a shield was measured at the
  scratch moment it mostly boosted the good tier (+72% median). If it is ever revisited,
  measure death cause by sector per tier first - hull scratches are worth least deep,
  which is where revives happen. See the Rewarded continue notes in `constants.js`.

- **Web has no rewarded video, so the offer slot carries the app pitch instead**
  (2026-09-19, `constants.js WEB_CONTINUE_PROMO_SEC` = 15s, `draw.js`
  `drawWebContinuePromo`). `rewardedAdReady` is false forever on web (the Ad Manager
  network code in `ads-web.js` is still a placeholder and AdSense rejected the site), so
  the one moment a player most wants what the app has said nothing at all. Now the ring
  appears anyway, captioned `T.secondLifeApp` ("second life - in the app") and carrying
  "+1" rather than a play triangle, and a tap opens a card - day accent, the player's own
  ship, both store buttons - for exactly the length of a rewarded video, dismissible from
  `WEB_PROMO_DISMISS_SEC` (2.5s) like an ad's skip. **It never grants a revive** (the
  pitch is that the second life is app-only, and a free one on web would outrank an app
  player who watched an ad for it on the shared leaderboard), and **the caption is honest
  before the tap** so nothing here is a bait-and-switch. `isWeb()`-gated end to end; both
  apps still decide on `rewardedAdReady` alone.


### Ship unlock economy (moved from docs/agents/economy.md, 2026-09-21)

- **`cost` shards** - earned from collected coins (`runCoins`, banked at death), capped
  daily by `DAILY_SHARD_CAP` = 160. The 3 daily missions and the once-per-day rewarded-ad
  bonus (`SHARDS_AD_REWARD` = 20) are exempt, so the real ceiling is
  160+20+30+40+50 = **300/day**.

SOLARIS (the 8th and last ship) needs 5600 shards and 180 stardust (~half a year at the
daily floor). The Stardust doc block in `constants.js` has the worked timelines per player
tier and why neither currency alone can do this job.

**The shard ladder (240/320/560/1280/2400/4000/5600, cumulative 14400) is set just under
what each tier's gate implies at ~80 shards/day, so stardust is the binding constraint at
every tier** and SOLARIS still lands on day 180 exactly. **Re-run the numbers before
changing either side - a shard-side raise silently re-breaks the gate schedule.** Do not
revert to the old ladder; it made the top three tiers effectively unreachable and flipped
the binding constraint to shards at VOID, i.e. the stardust system stopped doing any work
for the entire top half of the roster (`docs/design-history.md` -> "Ship unlock economy").

**Hangar liveries (cosmetic, phase 1 of the cosmetics concept).** Six finishes (`LIVERIES`
in `constants.js`: FACTORY free, STEALTH 80, STRIPE 120, SPLIT 200, CHROME 320, AURORA 520
shards), bought in a Paint sheet opened from a PAINT pill on the ALL SHIPS sheet, which
only appears once AMBER (`LIVERY_GATE_SKIN`) is owned, so the first paid ship stays the
first shard goal. Rules, each load-bearing:

- **Every finish is built from big masses** - a whole half of the hull (SPLIT), a rim
  (STEALTH), a band across the span (STRIPE), a full-hull gradient (CHROME/AURORA). In
  flight the ship is only ~2*PR across (~35px at the W cap), where the first pass's fine
  patterns (a carbon weave, pinstripes) were invisible and the finishes read as not worth
  buying. Detail that only resolves on the hero ship may sit **on top of** a mass, never
  instead of one - and a light mass must flip dark on a pale ship (PEARL/NOVA) or it
  disappears again.

- **Every finish moves in colour** (STEALTH's rim breathes, STRIPE runs a pulse down the
  band, SPLIT cycles its spine line, CHROME's specular sweep throws the two hue
  neighbours, AURORA drifts four bands at two rates) - paint that only sits there reads as
  a recolour, and a recolour is not worth shards. The motion is **one** gradient fill or
  stroke riding `gtime` per frame, never particles or a second pass over the hull.

- **Each finish carries one signature mark** (STEALTH neon facet seams, STRIPE wing
  chevrons + tip caps, SPLIT a clean lit seam with wing-root lips, CHROME a hard reflected
  horizon, AURORA four polar-light curtains at three hues - +-45, the only finish allowed
  past the usual +-24 - plus rim and sparkles). Audited at 150px, where a mere recolour
  still looked cheap.

Three traps from that audit, worth not repeating: **a mark on the NOSE is invisible**
(the canopy and leading-edge highlight draw after this overlay); **small repeated details
read as noise, not paint** (SPLIT shipped a sawtooth divide for one iteration and was
reported as odd - teeth on a top-down planform read as damage); and **an additive wash has
no headroom on a white hull** (PEARL/NOVA blew out to plain white), so on a pale ship the
curtains paint with `source-over` instead of `lighter`.

**Unlock All Ships IAP**: a real-money non-consumable (`unlock_all_ships`, alongside
`remove_ads`) that force-unlocks every ship, current and future (`allShipsOwned` in
`state.js`, **re-applied on every load** rather than snapshotting which ships existed at
purchase time). $9.99 versus `remove_ads` at $2.99 - the standard "unlock everything"
tier, not a whale price, but higher than Remove Ads because it skips up to a year of daily
return and these ships carry real gameplay perks (the buff/nerf table above `SKINS`), not
just cosmetics. Shop UI in `draw.js`'s `showShop`; the purchase/restore bridge is
product-ID-keyed in `IAPManager.swift` and `BillingManager.kt` (they mirror each other
exactly - see their doc comments). **Shards and stardust are untouched by this purchase** -
a separate entitlement flag, not a currency grant. Both products exist live in App Store
Connect and Play Console; `Configuration.storekit` stays for local testing only.


### Audio bus and loudness (moved from docs/agents/audio.md, 2026-09-21)

- **`MASTER_GAIN` = 1.6.** The mix used to measure ~-24 LUFS integrated while mobile games
  and the AdMob interstitial after every 4th death sit near -14 to -16 - the ad was louder
  than the game it interrupts. Now near -18 LUFS.

- **Loudness hierarchy** (loudest-50ms; music bed -19.7): death -13.2, shield break -17.0,
  milestone -17.8, shield/magnet -18, cannon fire -20.6, coin / near-miss / combo -21.4,
  thrust -22.7, UI -27.7. **The rule is warnings > rare rewards > routine pickups > the
  thrust bed.** Match any new sound into this, then re-measure.

- **Low-end layers do not exist on a phone speaker.** Everything below ~300-400 Hz is
  rolled off on device - which is where the thrust voices (85-340 Hz), the death roar and
  the bomb/mine booms live - so a flat RMS measurement flatters all of them. Each carries
  a mid-band partner (`THRUST_PRESENCE_GAIN`, the 400-1400 Hz crunch layers in
  `sfxDie`/`sfxBomb`/`sfxMineExplode`). The thrust presence layer is deliberately shared
  by all eight ships, so the per-ship balance measured in 2026-09-05 is untouched.

- **The death impact is on frame 0.** `sfxDie` is the reverse of the old spool-up roar,
  which takes 1.3s, so its crash used to land 1.22s after the collision - after
  `drawDeathFreeze()` had finished - and the hit frame itself was silent. Hull thump, mid
  crunch and crack fire at `t`; only a quiet debris settle is left at the tail.

- **Spool-up is a low turbofan, "rollendes Grollen"** (`sfxEngineSpoolUp`). Lowpassed air roar 150 -> 700 Hz +
  rumble under a slow 2 -> 8 Hz tremolo, a 40 -> 150 Hz buzz-saw and one quiet 70 -> 260 Hz
  sine, on a rev curve (`t^pw` in log-frequency, slow start). The user's brief was "low,
  may stay low, like an airliner turbine": **do not add partials above ~700 Hz** - if it
  needs presence on a phone speaker, lean on the buzz-saw harmonics, not a higher whine.
  Study (holds the rejected variants): https://claude.ai/artifact/D7D9hELLqBerVNddPgPk4X

- **Both tracks loop on `loopStart`/`loopEnd`, never the raw buffer**, with the seam
  crossfaded into the material before the loop start (`_bakeBgmLoop` - one baked buffer,
  one source node, so `playbackRate` effects still work). They are ordinary masters with
  their own fade-out, so looping the whole buffer played a fade, a hole and a fade-in every
  pass. Play track (`the_mountain`, the Nebula track, 72s): `BGM_LOOP_START/END` 11.53 / 38.96 = 16 bars at 140 BPM,
  0.857s equal-power crossfade. Title piano (`the_mountain_documentary`): 18.0 / 114.0 with a 4s crossfade. **The files
  are never re-encoded to fix a seam** (the "encode once from the source" rule in
  `audio.js`), so the same constants hold for the `.web.m4a` builds.

- **Death plays the song's own ending.** `die()` collapses the loop, then
  `_playBgmOutro()` fades in the track's last ~10s (from `BGM_OUTRO_START` 61.75) through
  its own gain node; nothing loops it, so the death screen ends in silence until the title
  screen's music. `_stopBgmOutro()` cuts it on restart, revive and return to the title.
  Only when the play music was actually sounding. `commitDeath()` deliberately does NOT
  start the title music, so the ending plays through the continue offer AND the debriefing
  to its last decay; the piano only returns on the title screen.

- **Stereo, centred on the ship** (`_sfxOut(x)`): cannon fire, mine blasts, rock hits and
  stalactite cracks pan by screen x relative to `PX`, capped at `SFX_PAN_MAX` 0.6;
  ship-local sounds stay centre. **The `Math.SQRT2` in front of the panner is
  load-bearing** - a mono sfx into `_master` is upmixed to full level per channel and the
  equal-power panner puts it at 0.707, so without it every panned sound is ~3 dB quieter.

- **Per-call variation** (`_vary`): +-3-4% pitch, +-1.5 dB on bullets, cracks, cannon,
  rock hits.

- **Hazard telegraphs, audio only (no `rng()`)**: `sfxCannonArm` `CANNON_ARM_SEC` (0.4s)
  before a cannon fires, usually while it is still just off the right edge; `sfxStalCreak`
  while a loose falling stalactite is on screen, lasting exactly until its detach. Both
  ~-28 dB, under a coin.

- **Cave reverb** (`_caveSend`): one shared generated convolver per context - early rock
  reflections, 8ms pre-delay, a tail darkening and dying over `CAVE_VERB_SEC` 0.9s,
  unit-energy IR so `CAVE_VERB_WET` (0.7) is the level. Sends only from impacts, blasts,
  cracks, cannon (fire + arm), creak, shield break, hull scratch and the death crash;
  coins, UI, pickups and the thruster stay dry, the bomb keeps its own `_bombVerb`. Not
  ear-checked on a device yet - `CAVE_VERB_WET` is the knob.

- **Settings: music and sound are three-level** (`musicLevel`/`fxLevel`, `state.js`;
  FULL -> LOW -> OFF per tap, stored '1'/'low'/'0' so old saves read the same). Levels ride
  `_musicLvl`/`_fxLvl` behind each bus, **never `_musicBus.gain`, which `musicDuck()`
  owns**. `AUDIO_LOW_GAIN` = -8 dB. Vibration deliberately has no toggle (no room).


### Approach over the city (moved from docs/agents/onboarding.md, 2026-09-21)

`src/approach.js` (doc block at its top). Every run opens over the day's metropolis at dusk
(three parallax silhouette layers, beacons in the day colour) and flies through a rock mouth
into the safe opening flight; the title screen IS that city. Every run, PLAY AGAIN included,
reaches the cave 4s later than before (`APPROACH_SEC` = `START_RAMP_SEC` + 4, user's call: the
start stays the same every time). If it is ever shortened, keep it above ~2.3s or the ship
launches through the mountain foot.
"ENTERING THE TUNL" (`T.entering`, 15 langs) shows over the city; the world banner and the
score wait for the cave. Concept: https://claude.ai/artifact/ECrpmHcPeTsREMwEtK6vNs

- **No soft walls (2026-09-19, "keine Gummiwände mehr").** Over the city the mountain face and
  the screen edges only bounce the ship; from the mouth on (`approachUpdate`) the tunnel rule
  applies at once: a wall contact spends a hull scratch, with none left it kills. The whole
  soft-wall layer (translucent field, dents and rings, `safeWallBump`, `wallsSafe()`,
  `SAFE_FIELD_*`, `SAFE_BUMP_*`) is deleted. Near-miss and the red danger flash now run from
  the tunnel entry; the "walls now deadly" hint fires as the ship enters.

- **The tunnel start was darkened with it** (`DEPTH_LIFT` 0.15 -> 0.05, `DEPTH_MOUTH_ALPHA`
  0.24 -> 0.10): lit by a city at dusk, the old values made the cave a bright olive hall,
  lighter than the sky outside. Sector steps keep their ratios.


### Onboarding (moved from docs/agents/onboarding.md, 2026-09-21)

**The first ~50 points of every run are an open, hazard-free flight** (2026-09-13, from
beginner feedback "too hard, frustrating, deleted it"; `SAFE_START_WX` doc block in
`constants.js`, `safeOpenAt()` in `world.js`). Until world-x 3000 the corridor is pushed
out to the screen edges (`boundsAt()` only, never `boundsBase()`), easing shut over the last
1800px. **No stalactites, mines, boulders or cannon fire** until `HAZARD_START_WX` (3400);
boulders and cannons only from their sectors (`BOULDER_START_WX` S4, `CANNON_START_WX` S6),
so no shot lands inside the zone. Coins and the warp
portal still appear. **The walls are lethal from the tunnel entry** since 2026-09-19 (see
Approach): two hull scratches cover the first mistakes. Until then they were SOFT - they
bumped the ship back, drawn as a translucent field with contour lines, dents and rings -
and that whole layer was removed on request ("keine Gummiwände mehr"). The "walls now
deadly" notif fires as the ship enters the tunnel, on a player's first
`WALLS_LIVE_HINT_RUNS` runs. Every run counts normally.

Fair by construction: identical for every player and screen, all offsets are fixed
world-px, and `test-cave.js` mirrors the start cursors. Consequences worth knowing:
every score now starts with ~50 nearly-free points, so the leaderboard baseline shifted
up, and hazard content that sat below score 100 (first stalactite 25, mine 30, boulder
85, cannon 100) moved just past it - the old leaderboard audit numbers (median daily best
70) predate this. The same day it was briefly a 3-run off-record "training flight" with
normal runs safe only to score 50; unified on request once both had the same rules.

**The launch ramp is 1.3s** (`START_RAMP_SEC`, `constants.js`, applied in `update.js`).
The run opens with the ship flying up into frame and levelling out, with `py`/`vy`/
`shipPitch` driven by the ramp rather than by the player - so it is time the player
cannot act in. Held at 1.3s through 11.0; cut in 12.0 after the same red-team replay
measured what that costs the audience the onboarding exists for. A beginner's median run
is **1.0s of flight**, so the ramp was longer than the game, and the full death-to-death
loop (1.3s ramp + 1.0s flight + 0.9s `DEATH_INTERACTIVE_SEC`) was only **31%** time the
player could act in. At 0.5s that is ~42%. Strong players are unaffected either way - at
a 17.7s median run the ramp is noise - so this is purely a first-minutes fix. **Restored
to 1.3s on 2026-09-13 on the user's explicit request** - the longer launch animation looked
better, and that was chosen over the ~42% interactive share. Don't cut it again without
asking.

On top of that, **every run opens with a level glide**: gravity is withheld until the
player's first hold press or `HOLD_GATE_MAX_SEC` (`constants.js`, 2.55s since 2026-09-19, was 2.25s), so the ship
flies dead level and never drops before the player acts. This applies to PLAY AGAIN
restarts too - `input.js` no longer pre-sets `holding`/`hasHeldThisRun` on the restart
tap, so a restart opens exactly like a fresh title-screen start rather than mid-thrust.

**The opening coins teach RELEASE** (`ONBOARD_ARC_WX` / `ONBOARD_ARC_FRAC` in
`constants.js`, applied in `makeCoin()`). Everything above teaches thrust; nothing taught
that letting go is the other half of the control scheme, and a text hint for it is ruled
out (see below). The runway alone doesn't cover it: the ship launches at H/2 with the
corridor ceiling ~H*0.43 above it, so at net-up 1800 px/s^2 a player who just presses and
holds hits the ceiling in ~0.46s. So over the first 2200 world-px the coin line is forced
onto a gentle arc that starts **below** the launch line (verified at +35 to +37px on
every seed sampled) and rises above it for the second coin - take the first by letting go
and gliding down, take the second by holding and climbing. Amplitude tapers to 0 by
`ONBOARD_ARC_WX` so it rejoins normal scattered placement with no seam. `rng()` is
consumed either way, so coin *types* and the whole downstream seeded stream are
unchanged - only y positions move, exactly like the deep-run coin-line shapes.

**Do not re-add a title-screen control hint.** A "HOLD to climb / RELEASE to fall" line
under HOLD TO FLY was added in 5.0 and removed the same day after seeing it on a real
device: it read as redundant next to HOLD TO FLY directly above it, it crowded the
RANKS/CHALLENGE row below it, and the attract-mode ship flies straight through that exact
line of the screen. The reasoning that motivated it (the title screen never says that
releasing is half the control scheme) is real but is better served by the runway, which
teaches it by letting the player feel it. The `T.hold` string it used has been deleted
from all 15 locales - don't reintroduce a translated string for a UI element that doesn't
exist.


### Typography and title accent (moved from docs/agents/visuals.md, 2026-09-21)

`src/fonts.js` (loaded second, right after `web.js`) defines the only two font stacks the
canvas uses: `FONT_UI` (Chakra Petch - logo, labels, buttons, body) and `FONT_NUM`
(JetBrains Mono - numbers that count or line up: live score, death-screen score/best/rank/
list, title stat values, rail badges, the share card's big score). Every `ctx.font` string
interpolates one of them; there is no literal family name anywhere else. Until 12.2 all of
it was `'Courier New',monospace`. Design study with the reasoning:
https://claude.ai/artifact/QPvLrDmGiU6przXNwXLV9y

- **The fonts ship as base64 woff2 inside `fonts.js`**, not as files, because a `.js` in
  `src/` is the one thing iOS (folder reference), Android (`copyGameFiles` copies
  `src/**/*.js` only) and `build-play.mjs` (script concat) all already carry. Subset with
  fonttools to Latin/Latin-1/Latin Ext-A/General Punctuation (+ basic Cyrillic for the mono),
  ~44 KB total. Chakra Petch has no Cyrillic, so Russian falls through to JetBrains Mono per
  glyph; ja/ko/zh/ar/hi fall through to the system face exactly as they did under Courier.
  The Medium cuts are registered as weight 400 (the code only ever asks for bold or default).

- `main.js` holds the first frame on `fontsReady`, capped at `FONT_WAIT_MS` (400ms).
  Headless Chrome's `--virtual-time-budget` never settles while a FontFace is loading, so
  screenshot via DevTools protocol with real waits instead.

- **The TUNL wordmark no longer assumes a monospace grid.** `drawTitleScreen` measures cap
  height off 'T', stem width off 'I' and per-letter advances, and strokes the U channel from
  the real 'U' ink box with chamfered corners, at 0.51x the stem (full stem weight read as
  too heavy on device). Set `textAlign`/`textBaseline` BEFORE those `measureText` calls -
  bounding boxes are relative to the current alignment.

- **The title's left column spaces itself by measured ink, not only by H-fractions**
  (`colGap` in `drawTitleScreen`): world line, planet line and the REKORD plate each move
  down if the line above would come closer. WebKit and Chromium place `textBaseline
  'middle'` differently for Chakra Petch, so the world name overlapped REKORD on an iPhone
  12 mini while Chrome at the same 812x375 looked fine. Test layout on WebKit, not only Chrome.

- **HUD score is FS*0.072, not 0.085** (JetBrains Mono figures are ~28% taller than
  Courier's). Score, BEST and the world intro banner are placed on the ALPHABETIC baseline
  from measured ink, never on `textBaseline 'top'`/`'middle'`: WebKit puts the em-box top
  of these fonts ~15pt lower than Chromium, which on an iPhone 12 mini pushed BEST into the
  banner. The banner also never sits above the HUD stack (`hudY`).

- **Title screen accent = the day's `wallBase`**, same rule as the debriefing: logo halo and
  glow, the U, underline, world line, the ALL SHIPS pill and rail button rims (the floor light
  under the hero ship was removed 2026-09-19). The hero ring and ship keep the SKIN colour. The planet line went
  neutral so the order reads logo > world > planet. Deliberately NOT done from the study:
  a PLAY button (tapping anywhere starts a run, and see Onboarding on title-screen CTAs)
  and rail text labels (no room between the ring and a 5-icon rail at 667x375).


### HUD instrument, web frame (moved from docs/agents/visuals.md, 2026-09-21)

- **No parallax background - tried and removed the same day (do not re-add).** Two far rock
  silhouettes scrolling behind the walls (proposal 5) read as "extremely confusing" in
  playtest, even after their contrast was cut to near the void colour: in a game whose
  whole skill is reading where the walls are, any second set of wall-shaped edges moving
  at a different speed competes with the real ones.


### Depth light (moved from docs/agents/visuals.md, 2026-09-21)

`constants.js` `DEPTH_LIGHT_*` doc, `draw.js` `depthLightAt()` / `drawWorld()`. The void
behind the walls is no longer a flat `WEEKDAY_BG` at every depth: it is **lifted toward the
day's own `wallBase` and steps darker at each sector boundary** (S0 5% since the 2026-09-19 approach, was 15%; then 62% / 34% / 14%
of that, plain `WEEKDAY_BG` from S4, each step eased over `DEPTH_STEP_EASE_WX`), and a
**warm cave-mouth light** (warm white tinted 60% toward the day's rock) falls in from behind
the ship off the left edge, fading out by S4. Softened 2026-09-16 ("too glaring"): alpha
0.30 -> 0.24 (-> 0.10 with the 2026-09-19 approach), tint 35% -> 60%, gradient centre moved to `DEPTH_MOUTH_X` = -0.30W so its hot
core is never on screen, and a 6-stop falloff (`DEPTH_MOUTH_STOPS`) instead of a 3-stop cone. The title screen is the approach's city now, not the mouth.
Three rules, each from the variant study
(https://claude.ai/code/artifact/ea963ae1-1c8b-4bf4-9587-c2f90286d666):

- **Never literally bright.** A light-to-dark ground was measured and rejected: the
  near-white PEARL ship, gold coins, the white score and every additive `'lighter'` glow
  lost most of their contrast exactly where beginners fly. `DEPTH_LIFT` and
  `DEPTH_MOUTH_ALPHA` are capped low on purpose.


### Ship rendering (moved from docs/agents/ship-render.md, 2026-09-21)

**Envelope (do not grow it):** span +-0.98r, nose +1.40r. The old nose reached 1.72r,
~17.6px ahead of `update.js`'s forward collision probe (+0.7*PR), so it visibly slid
through stalactites; the old span stopped at 0.92r, so the PR circle killed ~8% before
the wing visibly touched. `PR` itself is untouched - this is purely visual.

**The brand marks are generated from this same geometry** (2026-09-13).
`branding/gen-ship-glyph.mjs` mirrors `SHIP_OUTLINE` / `SHIP_FACETS` and the facet
tone maths and writes the ship into the four SVG masters (app icon, Android adaptive
foreground, iOS launch logo, Play feature graphic) between `BEGIN/END generated ship`
markers; `branding/export-icons.sh` then pushes the rasters into iOS, Android, the
Play listing icon and the site. Run both after any hull change - hand-maintained
copies are why the icon, both splash screens and every favicon still showed the
pre-12.0 needle (nose 1.72r, span 0.92r) after the game had stopped drawing it. The
homepage's eight ship chips (`flytunl-site/home.src.html`) carry a flat silhouette of
the same outline. Two deliberate deviations in the marks, both for legibility at
favicon size: the shadow-side facet tones are damped (a 54%-toward-black facet
disappears into the `#04040e` icon ground) and the animated spine running lights are
dropped. See `branding/README.md`.

**Rock roughness is switched off, and the code now short-circuits accordingly.**
`ROCK_ROUGHNESS_MAX` = 0 (`draw.js`), so `_wallJagged` and `_stalOutline`'s `jAmp` both
resolve to zero - but until 2026-09-14 they computed the full value-noise stack first
and multiplied it away afterwards. At `RSTEP` 3 that is ~320 wall samples per frame,
twice each, three `_rockNoise` per call, two `Math.sin` per noise: about 3900 sine calls
per frame producing 0, plus 12 more per on-screen stalactite. Both now return early on a
zero amplitude (measured 30.8 -> 2.5 us per frame's worth of wall samples), and the
returned value is bit-identical at any non-zero roughness, so flipping the constant back
up still behaves exactly as before.


### 3/4 side view in flight (moved from docs/agents/ship-render.md, 2026-09-21)

The cave is a side section - gravity down, stalactites from the ceiling, a dusk skyline in
the approach - and the ship was the one thing in it drawn from above. The **flying** ship
(player, ghost, wrecked death frame, and the in-scene ship on the title screen) is now
rendered from a small 3D model of the same K5 hull (`draw.js` `_ship3dFaces` /
`_buildShip3D` / `drawShip3D`), rolled `SHIP3D_ROLL_BASE` = 60 degrees out of the top view
and projected orthographically, flat-shaded from screen-up like the facets. **Hangar, hero
portrait, shop cells and the share card stay top-down** (`drawShip`): the hangar is a
portrait, the flight is a flight. `PR` and every collision test are untouched - this is
draw-only, no `rng()`, no placement input. `SHIP_VIEW_3D = false` restores the flat hull
everywhere with no other change. Variant study (five views, a flyable lab, the coverage
curve): https://claude.ai/artifact/Q9gDK8SdVrCYm9rU9biZdJ

- **60 degrees is a measured middle, not a taste call.** At 45 only the near wing read and
  the picture reached just 0.55-0.8 `PR` vertically against the hitbox circle (0.98
  top-down, the flat hull's envelope rule); at 90 it is simply today's top view. At 60 both
  wings read and the span is back to ~0.85 `PR` (0.71 wings swept). `test-collision.js`
  asserts the drawn hull never reaches PAST the circle and never past the flat nose (1.40r)
  at any roll or sweep, and that it still fills >= 0.60 of it while flying. The lever for
  more coverage is `SHIP3D_ROLL_BASE`; `SHIP3D_FIN_SCALE` measurably is not (+0.01 between
  1.0 and 1.8 - at this roll the SPAN carries it).

- **The roll follows the climb rate** (`+-SHIP3D_ROLL_AMP` = 10 deg, damped spring in
  `update.js stepShipRoll`, ratio of `MAX_VY` so it stays screen-independent): climbing
  turns the back toward the camera, falling the belly. A second read on the daumen next to
  the nose. Deliberately NOT a free-swinging wobble - an earlier "schwingt nach" variant
  reads as noise in a game whose whole skill is reading distances, same argument that
  removed the parallax rock.

- **Swing wings (F-14), keyed to the speed the player feels** (`SHIP3D_SWEEP_*`,
  `shipSweep`): the outer panels pivot about `SHIP3D_PIVOT`, spread at the slow start and
  folded ~64 deg back at the difficulty plateau, driven by `scrollSpdBase x
  slowScrollFactor x warpScrollFactor`. A **blue coin throws them forward past spread**
  (`SHIP3D_BRAKE_DEG`, an air brake) and they fold back exactly as fast as the slow-time
  glide returns the speed; a **warp folds them in half a second**. The panel is slender for
  a reason: a long-chord delta panel simply disappears under the glove when swept.

- **Liveries paint the 3D hull through the same `_drawLiveryOverlay`.** The finishes are
  authored in planform coordinates, and at roll `a` the top surface projects to exactly that
  planform squashed by `sin(a)`, so the overlay runs under that scale, clipped to the 3D
  silhouette instead of `shipPath`. The two things that cannot be expressed that way - the
  facet seams and the rim - come in as a `hull` argument and are traced in screen space (rim
  = the edges that only one visible face owns). Two 3D-only corrections: the seams run at
  half alpha and skip small faces (90 faces against the flat hull's 7 turned STEALTH into a
  lamp), and near edge-on (mid barrel roll) the pattern is skipped for those few frames.

- Cost: ~90 visible faces filled per frame against the flat hull's ~40 fills, no
  `shadowBlur` (the glow is one radial fill). If a weak device ever needs it, the obvious
  cut is caching the hull per roll/sweep bucket into an offscreen canvas.


### Cross-device fairness (moved from docs/agents/fairness.md, 2026-09-21)

**This is enforced by `test-cave.js`, not just asserted.** It replays the real spawners
frame by frame at six device sizes and compares the resulting obstacle lists byte for
byte, asserts the `SPAWN_AHEAD_*` budget table and re-checks every boulder's two passes.
**Run it after touching anything in `maintain*()` / `make*()` / the difficulty curves.**
Until 2026-09-11 the claim was simply false (six sizes, six different caves, diverging
from wx ~938). Four rules came out of that fix and all four are easy to reintroduce:

**`SPAWN_AHEAD_*` (`constants.js`) encodes an ordering invariant with a budget:**
`SPAWN_AHEAD_X + largest retry offset + inspection radius <= SPAWN_AHEAD_STAL`.
Stalactites are created first and furthest ahead, and every spawner that inspects the
stalactite array must sit far enough inside that horizon for its whole inspection radius
to be populated. This has been broken twice (cannons/boulders outside the horizon, then
the retry loops reaching back out past it) - the second time 15 of 18 boulders and 28 of
28 cannons were placed blind and 12 boulders had a pass sealed. Three rules hold it now:

- **Raise the horizon, never clamp the retry offsets** (`SPAWN_AHEAD_STAL` = 1550).
  Clamping boulders to what fits inside the old 600 would drop 15 of 18 of them,
  re-creating the near-extinction the retry loops exist to fix. Safe because each
  spawner owns its rng stream; the cost is a longer live stalactite array (~39 -> ~70).

**Coins are the fixed point for boulders and mines (2026-09-20).** `coinBlockedByStal` only
knows stalactites, so a coin (power-ups included) could land inside a boulder (~1% of
coins) or on a mine's bob range (~3%); the later spawners never looked at coins. Now
`_fitIsland` and `_makeMineAt` reject any placement within `PLACE_COIN_CLEAR_R` of an
existing coin (shorter island / next retry offset / none), in reference units so the verdict
is the same on every screen. **The coin never moves and is never dropped** - rocks and mines
yield, and boulder count is unchanged (107 over 8 days x 60000 wx, before and after), mines
262 -> 265. This needs the coins to exist first, so `SPAWN_AHEAD_COIN` went 500 -> 1500 (a
boulder probes 300 + 1000 retry + 100 half-length ahead; the coin's own stalactite budget
caps it at 1500 + 46 <= 1550). **Do not lower it or reorder `maintainCoins()` after
`maintainBoulders()`/`maintainMines()`**: coin and boulder verdicts would then depend on frame
timing, i.e. on screen width. `test-cave.js` asserts both the reach budget and 0 overlaps.
It guards the budget, not the order: its `step()` repeats update.js's call order by hand, and
with today's 1500 budget swapping the order measurably changes nothing (checked 2026-09-21).
Not covered: falling stalactites (they move) and portal rings.

`_makeMineAt`'s tip-push radius lerps 300 -> 90 over `_prog2` for the same reason - at
50px stalactite spacing a flat 300 left no vertical room at all past the plateau.

- **Horizontal** (how fast the cave scrolls past): `scrollSpd()` multiplies by `W/600`
  and obstacle spacing is fixed in world-x, so reaction time per obstacle at a given
  score is `∝ 1/W`. Hence **W is capped at 956** (`constants.js`) - without it an
  Android tablet (W ~1280) faced the shared cave ~1.75x faster than a small phone. The
  cap is a no-op on iOS (`TARGETED_DEVICE_FAMILY = 1`) and clamps large Android devices.
  Residual: small phones still get slightly *more* reaction time - the acceptable
  direction.

- **Known residual, not addressed:** `PR = W*0.018` vs corridor `∝ H`, so hitbox/corridor
  tracks aspect ratio. iPhones are all ~2.17 so it is negligible on iOS; a squarer
  Android tablet with H capped at 520 is ~20% more forgiving. Fixing it means keying
  `PR` off H, a feel change needing its own playtest.


### Canvas size (moved from docs/agents/physics.md, 2026-09-21)

`W = Math.min(window.innerWidth, 956)`, `H = Math.min(window.innerHeight, 600)` - **W is capped at 956 (iPhone 17 Pro Max landscape width) on every platform** for leaderboard fairness (see "Cross-device fairness" below); H is capped at 600 for consistent difficulty (520 on Android-app, 440 on web). A device wider than 956 letterboxes left/right. H also drives `_FEEL_SCALE` - see "Screen-independent feel" under Physics constants.


### Physics constants (moved from docs/agents/physics.md, 2026-09-21)

```javascript
// values below are quoted at _H_REF (440pt); every device multiplies by _FEEL_SCALE = H/_H_REF
const GRAVITY = 1300;  // px/s² downward
const THRUST  = 3100;  // px/s² upward when holding (net: 1800 up)
const MAX_VY  = 1080;  // terminal velocity cap
```

**THRUST has already been walked back twice on real player feedback - read
`docs/design-history.md` -> "Physics tuning" before touching it.** Short version: tuned up
hard chasing a "Flappy Bird snappy" feel, called "too fast" by real players, walked back
3400 -> 2700, felt floaty, settled at **3100** (net-up 1800 vs net-down 1300). GRAVITY and
MAX_VY are untouched throughout. **The input model is UNCHANGED** - hold-to-thrust is an
acceleration ramp, not Flappy's instant velocity impulse.

**Frame-rate-independent integration (do not revert).** `update.js` integrates the ship
with the TRAPEZOID - `py += (vyPrev + vy) * 0.5 * dt` - not `py += vy * dt` after the
velocity update. The latter pretends the ship spent the whole frame already at its
end-of-frame speed, overshooting by `0.5*a*dt^2` every frame; because that error scales
with FRAME LENGTH, the ship flew a measurably different trajectory on every refresh rate -
a bigger inequity on a shared daily leaderboard than anything `_FEEL_SCALE` and the W cap
exist to equalise. Replaying a bit-identical input schedule now gives a **0.000px** spread
across 12-144Hz. `test-sim.js` drives the real `update()` at eight refresh rates against
the exact solution, so a silent revert fails. (Until 2026-09-21 `test-math.js` asserted a
copy of the integrator instead, and a revert of the real line passed.)

**Screen-independent feel (do not revert - explicit rule).** GRAVITY/THRUST/MAX_VY are
quoted at `_H_REF` = 440pt (iPhone 17 Pro Max landscape height, where the feel was tuned
and player-tested) and **every device - apps and web alike - scales all three by
`_FEEL_SCALE = H / _H_REF`.** Because the corridor half-gap also scales with H, every
trajectory is geometrically similar to the reference: same fraction of the corridor
covered per second, same time-to-cross, identical felt snappiness on a 375pt iPhone 12
mini, a 440pt 17 Pro Max and a 520pt Android tablet. A bigger screen genuinely gets
steeper px/s² and a smaller one gentler, by design.

The web build clamps W/H to 956x440 - the 17 Pro Max's own landscape footprint - so
`_FEEL_SCALE` lands at ~1.0 and **web plays as a pixel-and-physics copy of the 17 Pro
Max**. There is no separate web feel tuning; the old `_WEB_FEEL` 1.3 multiplier was
deleted (it only existed to fight the floatiness of web's earlier 520 clamp).


### Player (moved from docs/agents/physics.md, 2026-09-21)

```javascript
const PX = W * 0.22;   // fixed horizontal position on screen (W capped at 956)
const PR = W * 0.018;  // radius (≈10.8px at W=600, ≈17.2px at the W=956 cap)
```

## Death sound: "Crash" replaces the balloon pop (2026-09-21)

User: the death sound "ist wie wenn ein Ballon zerplatzt", asked for a plane crash. Offline
render showed why: 96% of the old hit's energy sat below 200 Hz (inaudible on a phone), so a
device played only a 0.26 s 1.4 kHz crunch plus a 30 ms 2.6 kHz crack. Three level-matched
proposals (A Blechschaden: metal only, ~1.0 s; B Feuerball: impact + fireball, ~1.4 s;
C Absturz: dying engine + crumple + fireball, ~1.5 s) went to a listening page; the user
picked C. `DIE_LEVEL` matches the old sound's loudest 50 ms. The reverse-spool noise roar
that used to be the sound's identity is gone; the dying buzz-saw engine carries that link to
`sfxEngineSpoolUp` instead. A 25 Hz highpass on the death bus strips the DC offset the
`_distortionCurve` shapers leave after their sources stop. Not ear-checked on a device.

Round two, same day: C read as a timpani hit ("Paukenschlag", user). Its first 150 ms were
86-96% one tonal 100-140 Hz peak (spectral flatness 0.002): the sine-drop impact plus the
fireball bloom. Two new proposals, D Crash and E Crash hart, swapped the sine for a
low-passed noise thud and added a crunch-grain cluster (`_dieCrunch`) and tearing metal
(`_dieTear`); onset energy below 200 Hz went 94% -> 23%. The user picked D. Levels were
matched through a 400 Hz highpass (phone level) this time: a full-band match would have made
D ~10 dB louder on a phone, because C's full-band number was mostly sub.


## F-14 hull replaces the SR-71 (2026-09-22)

The user found the swing wings unrealistic on the SR-71 body and asked for an F-14 Tomcat
look for wings and tail, then for the top-down views too (hangar, shop, share card).
Concept study: https://claude.ai/artifact/83BUEJDUKVSVMjS6HVtUUE. Rules and constants now
live in `docs/agents/ship-render.md` "F-14 hull".

- **Rejected: the real 68 deg sweep.** Measured in-flight fill of the hitbox drops to
  ~0.51 r against the 0.60 rule; a leading-edge range that holds the rule was chosen (user
  approved "the hitbox stays").
- **Rejected: rectangular raked intakes** ("the square box up front, not aerodynamic",
  user). Replaced by pointed nacelle fairings.
- **Deferred: brand marks.** Icon, launch logo, Play graphic and the homepage chips keep
  the SR-71 for now (user's call); `gen-ship-glyph.mjs` was deliberately not rerun.
- **Top-down wings swept, not spread** (user, 2026-09-22): the spread planform read as a
  parked jet in the hangar; the swept one reads as speed. The flat hull is now the 3D
  planform at `SHIP3D_SWEEP_MAX`.
- **Sweep became three states** (user, 2026-09-22, in two passes): first "folded by default,
  the blue coin opens them", then the final rule - normal flight cruises BETWEEN the stops,
  a warp folds fully back, a blue coin swings fully forward, each easing back to cruise on
  its own effect clock. The sweep no longer tracks the scroll speed at all, so
  `SHIP3D_SWEEP_SPD_LO/HI` and the air-brake overshoot `SHIP3D_BRAKE_DEG` were dropped. The
  wings now double as a readout of how much warp or slow time is left.
- **Rejected: fitting the real 3-view** (2026-09-22). The user supplied the F-14 drawing and
  asked for it; pivot, taileron span, nozzle spacing and body width went onto the drawing's
  ratios and `SHIP3D_SWEEP_MAX` fell 34 -> 30 to keep the fill rule. Verdict: "uff das
  gefaellt mir nicht, vorher war besser". Reverted, and the fuselage was widened a touch
  instead (the user's own note on the same look). The deviations that remain are listed in
  ship-render.md and are all hitbox-driven.
- Found on the way: `test-collision.js` never checked the blue-coin brake (a vm `const`
  read as a context property came out `undefined`). The old hull reached 1.02 r there.


## Hangar paint kit (2026-09-22)

The six fixed liveries of 2026-09-17 (FACTORY, STEALTH, STRIPE, SPLIT, CHROME, AURORA) were
replaced by a kit - hull colour x pattern x accent x material x reactive effect, parts bought
once and combined per ship - after the user called them "langweilig, nicht abwechslungsreich".
Diagnosis: the "never change the hue" rule made every finish a brightness step of the same
ship, six fixed bundles gave six looks, motion only rode gtime, the set was bought out in ~15
days and nobody else saw it. The rule was replaced, not dropped: identity now lives in the
ship's light (glow, nozzles, strobes), which no paint touches. Concept page with the full
reasoning: claude.ai artifact "TUNL Lackiererei". Decided by Claude on the user's "entscheide
du": 3 presets per ship were dropped (per-ship kits cover it, and the sheet had no room);
STEALTH/CHROME became materials, STRIPE/SPLIT patterns, AURORA an effect swayed by the roll
(it absorbed the proposed PRISMA). Rendering moved to src/paint.js. The RANDOM and DAILY
PAINT buttons were built and then dropped the same day ("die Buttons Zufall und Tageslack
nicht anbieten"), with the daily-kit and shuffle code removed rather than left dead.

## Streak and stardust made visible (2026-09-22)

The audit that started this (a decision page, all ten proposals scored by the user) found
the retention system working and invisible: `streak` was counted on every rollover and drawn
nowhere - the `T.day` "DAY STREAK" label had existed in all 15 languages for versions
without ever being used - and stardust arrived as a silent `stardust += 1` inside
`startPlay()`. The Settings explainer mentioned neither the 7-day bonus nor the DIAMOND
paint, locked tiers showed `3/5 ✦` (arithmetic the game already knows the answer to), and
the wallet hid ✦ entirely at 0 and again after the last ship - so the number was missing on
the two days a player was most likely to ask about it.

Measured before deciding what to pay: at the ~80 shards/day a real player banks, shards bind
up to CRIMSON and the gates bind from ELECTRIC on (gate days 1/5/15/35/65/110/180 against
shard days 3/7/14/30/60/110/180). A perfect streak's bonus ✦ alone would move SOLARIS from
day 180 to 158 - for a player who is stardust-bound, which the lower half of the roster is
not. **That is why the week reward is paid in shards** (`STREAK_WEEK_SHARDS`, ~+7% on top of
a day's income, outside `DAILY_SHARD_CAP` like the mission and ad payouts) **and in paint**
(COMET at 14, ECLIPSE at 30, read off the monotonic `bestStreak`), not in more stardust. The
`stardustGate` schedule is untouched, so the gates still bind at every tier.

Shipped: `dayRollover()` split out of `startPlay()` and also called from `titleScreen()` (the
constants doc had described the grant as earned by opening the app since it was written, but
only a started run ever ran it); the arrival card on the title; the stardust chip on the
first death screen of the day; "in N days" instead of `x/y ✦`; the always-visible ✦ wallet
with its FLIGHT DAYS label; the stardust path panel behind a tap on ✦; the rest day
(`STREAK_GRACE_MAX`) absorbing one missed day; and one streak variant in the 19:00 reminder
from `NOTIF_STREAK_MIN` on.

Rejected in the same pass, by the user: a weekday dot strip for the streak on the title
screen and a "new cave in H:MM" countdown - the title screen's Dock & Drawer layout keeps
exactly one headline stat, and neither earned its place on it. Rejected on principle and not
offered: losing banked stardust on a broken streak, buying or ad-repairing a streak, a 30-day
login calendar, and a local-midnight day boundary (the cave and the leaderboard are UTC; the
fix for a confusing boundary is showing it, not forking it).

## Greek, the 16th language (17.1, 2026-09-23)

User's call: fill the settings language grid to 4x4 with Greek (`el`). `LANG_ORDER` puts it
after the Latin-script block and before Cyrillic, so the grid reads Latin, then Greek,
Cyrillic, Arabic, Devanagari, CJK. `draw.js` picks 4 columns above 12 languages; the panel
got shorter by one row, so the short-screen scale-down triggers less often.

Glyphs: Chakra Petch has no Greek, so Greek falls back per glyph to JetBrains Mono, like
Russian. The JetBrains Mono subset in `src/fonts.js` was re-cut from JetBrains Mono 2.304
Medium/Bold (Android Studio's bundled copy) with the old codepoints plus U+0370-03FF,
unhinted like the rest: +2.5 KB per cut. The store-frame fonts in `Screenshots/fonts/` were
re-extracted from it.

All-caps Greek drops the tonos, which `String.toUpperCase()` keeps ("ΝΈΟ"), so the two
places that uppercase a translated string at runtime go through `upperT()` (`i18n.js`).
Every other script is unaffected. Planet names stay Latin in Greek text, as in every other
language, because the game draws them in Latin.

## "Kurzweiliger": hazard graze chain + music follows the flight plan (2026-09-24)

The user asked how to make a run feel shorter/livelier and picked two of five proposals:
(1) reward flying close past hazards, (5) let the music follow the sectors (sound review
S1). Rejected in the same brainstorm without trial: new hazard types (the deep-run
drafts were already cut as not-TUNL), more HUD labels, parallax.

Graze: the wall near-miss was the only proximity reward, and the red-team audit had
measured coin greed as strictly dominant with no risk attached. A hazard graze pays on
the way out of the zone so a crash or shield hit never pays, and wall near-misses are
kept out of the chain because hugging the rock yields one every 1.5s. `GRAZE_PTS` 2 was
tried first: a pilot flying 35% off centre through S0-S10 took 18-21% of its score from
grazes, a leaderboard-visible inflation for flying that is not especially risky; 1 gives
10-12% (centreline ~1%). Grazes feed `runNearMisses`, so the nearMiss daily mission and
the dodge achievements get easier past S3 - before this change the centreline pilot
scored zero near-misses in a full S0-S10 run.

Music: one stereo master cannot grow stems, and a tempo-locked synth layer was rejected
because `playbackRate` (slow time, warp) makes the buffer position untrackable in WebKit
without drift. So: a per-sector lift + presence shelf (inaudible below S3, where most
runs end) and a build-and-drop at every boundary. Measured offline, not ear-checked:
the first riser level (0.05) sat 8 dB under the bed in the phone band and the first
lowpass target (1400 Hz, ramped over the whole build) dipped the highs by only 4 dB, so
both were raised (0.12, 900 Hz reached at 60% of the build).
