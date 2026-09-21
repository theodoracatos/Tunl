# Coins

Moved verbatim from CLAUDE.md on 2026-09-21 (progressive disclosure). CLAUDE.md keeps the one-line rule and points here.

## Coin system

Coins collect into `gapBonus` (extra halfGap px, capped, decays over time). Since 12.0
all three magnitudes are **fractions of the corridor's own half-gap, not of `H`**
(`constants.js`, accessors `gapPerCoin()` / `gapBonusMax()` / `gapDecay()` in `world.js`
next to `refreshWave()`):
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

Two properties make this safe, both asserted in `test-math.js`:
- **The fractions are anchored so wx=0 reproduces the old absolute values exactly**
  (`halfGapAt(0)` = `H*0.43`, hence the `/0.43`). Score 0 is a byte-exact no-op; only the
  deep run got harder, which is the standing rule.
- **All three scale together**, so every ratio between them is depth-independent: still
  2.53 coins to fill the bar from empty, still 0.2 coins/sec to hold it at the cap. The
  supply economics that `CHICANE_GOLD_GAP_SEC` and `POWERUP_MIN_GAP_SEC` were tuned
  against are untouched.

They scale off `_gapRef` (`world.js`), the base curve **without** `deepChamberAt` - a
chamber is a transient breather, not a difficulty level, and letting the cap balloon 2.1x
on entering one would only snap it back on the way out. `update.js` clamps `gapBonus`
down to `gapBonusMax()` every frame, so a bonus banked in a wide stretch gives ground as
the corridor narrows under it.

**If the deep run needs tightening, the lever is supply or `GAP_BONUS_MAX_FRAC`, not
`DEEP_DECAY_PEAK`** - swept 1.0 / 1.6 / 2.5 / 25.0 over 100 expert runs each, the held
bonus moved 0.850 -> 0.821 and the per-band corridor not at all. Coin supply refills the
bar far faster than any of those rates drain it, so the cap binds, not decay.

**Gold coins bank no `gapBonus` during the safe opening zone** (`scrollX <
SAFE_START_WX`, `checkCoinCollection`'s gold branch): walls there are already at the
screen edges (`safeOpenAt`), so the widening is invisible in the moment and only pays off
as a bonus already near its cap the instant hazards start. Points, combo and shard
banking are unaffected.

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
- it must use `worldPxForSec()` (W-independent), **never `scrollSpd()`**, or the cave
  forks by screen width and the shared daily seed stops being shared;
- it is gated on `lastChicaneCoinWx` (`state.js`), **not** on the tail of the live
  `chicaneCoins` array, which is culled behind the player and so silently capped any gate
  wider than ~1700px.

The base decay rate was deliberately NOT raised to achieve this (it would have narrowed
the score 25-233 corridor too); the deep end is handled by `_deepDecay` in `update.js`,
inert until 233.

`gapBonus` jumps instantly on pickup (`systems.js`), but collision and rendering never
read it - they read `gapBonusVisual` (`update.js`), which chases it at a constant
`GAP_EASE_RATE` px/s. That is what makes the wall visibly widen rather than teleport, and
the same lag on the way down nudges the total "wide" window a little longer. Wall glow
shifts purple -> cyan while a bonus is active; the gold bar at the bottom shows the
remainder. Both keyed off `gapBonusVisual`, so what is shown matches what is collided
against.

**An off-screen wall is drawn ON the screen edge, in the normal edge look**
(`WALL_EDGE_SLIVER`, clamp in `draw.js`'s wall arrays - do not bring back the red strip).
A maxed `gapBonusVisual` or a warp can push the corridor edge past the canvas; there
`update.js`'s screen-anchored check (`py - cPR < 0 || py + cPR > H`) makes the screen edge
the lethal line. 12.0 marked it with a pulsing red strip, which made one continuous lethal
wall switch between two looks as the wave swung it in and out, and pulsed during warps
where walls only clamp. Now `topArr`/`botArr` are clamped to a ~3pt sliver: **the line is
the wall.** Draw-only; `boundsAt()` and collision untouched. The red proximity flash
measures against that same lethal edge (`max(b.top, 0)` / `min(b.bot, H)`) and is off
while `warpTime > 0 || invulnT > 0`.

**Colour vocabulary:** day colour -> cyan = wall (cyan = coin bonus). Red = only the
proximity wash, death markers and the death reticle.

Measured before/after tables: `docs/design-history.md` -> "Coin system".


## Coin type progression

Coins are staged by `_prog` so power-ups introduce gradually:
- score 0-11 (`_prog` < 0.22): gold only (gap bonus)
- score 11-33 (0.22-0.38): + blue (slow time: scroll sags to 0.6x then ramps back over ~4s)
- score 34+ (>= 0.38): the weighted ladder switches on
- score 50+ (S1, `RED_START_WX`): + red (shield, absorbs 1 hit; type id `red`, drawn violet)
- score 111+ (S2, `ORANGE_START_WX` / `GREEN_START_WX`): + orange (ammo) + green (magnet)
- score 178+ (S3): bomb clock; S8 (583+) poison; S9 (677+) drain - see "Flight plan (sectors)"

Mines first spawn at `MINE_START_WX` = start of sector 3 (~score 178). **Shield coins
unlock in S1, so a player always has shields available before the first mine** - keep
that ordering if either moves.

**Power-up SUPPLY is paced in real seconds, not just by weighted share**
(`POWERUP_MIN_GAP_SEC` / `POWERUP_GAP_EARLY_MULT`, enforced in `makeCoin`;
`blueClock`/`redClock`/`greenClock` in `state.js`, ticked in `update.js`). The weighted
roll has no notion of real time, so as `coinSpacing()` tightens and `scrollSpd()` climbs,
every type's coins-per-second climbs with them - measured deep, the shield stack was full
87-100% of the time and slow-time active 38-85% of the run. Four rules, all load-bearing:
- A vetoed power-up coin is **skipped entirely** (`makeCoin` returns `null`), never
  downgraded to gold - downgrading hands the suppressed share to gold and re-breaks the
  corridor bonus.
- The floor **scales in with depth**, so it is a measured no-op below score 233. That band
  is where real runs end; this pass may only make the deep run harder. Same rule governs
  the `makeMine` retry.
- The check sits **after** the poison/bomb/drain overrides, so a ready hazard is never
  delayed by an unrelated shield veto and the hazard `rng()` stream is untouched.
- **Orange (ammo) is deliberately exempt** (`test-math.js` guards it). Bullets auto-fire
  every 0.32s, so a 5-shot pickup drains in 1.6s - there is no stock to pin, and with
  firing modelled the player is armed only 2-9% of the run at every depth.

The values are FLOORS, not the resulting cadence - the type still has to win the weighted
roll, which adds ~4-6s deep. Pick a floor by subtracting that from the cadence you want,
then re-measure.

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

**Coin/power-up audio** (`audio.js`): pickup sounds carry a loudness hierarchy - gold and
blue at base level; red, green and bomb are rare, run-defining grabs and sit ~2 dB hotter
with more tail (shield also gets a low body layer). Two effects are *states*, not
one-shots:
- **Blue** sags the music to 0.6x playback rate then *glides* it continuously back to 1.0x
  across the whole slow-time window (`bgmSetSlow(true, slowTime)` on
  `_bgmNode.playbackRate` - that ramp IS the effect). A second coin restarts the glide from
  the current rate over the new duration. **The gameplay scroll speed follows the identical
  curve** (`slowScrollFactor()`, multiplied into `scrollSpd()` in `update.js`, the
  speed-line intensity in `draw.js`, and **both** projectile integrations in `systems.js` -
  `updateBullets` and `updateCannonShots`, so nothing streaks through a slowed tunnel at
  full speed). `slowTimeMax` is the window the ramp lerps over.
- **Green** runs a faint ambient shimmer loop while the magnet is live
  (`magnetLoopOn`/`magnetLoopOff`, same at-most-once guard as the thruster/onFire loops),
  turned off from `update.js` on the falling edge of `magnetTime`. `bgmSetSlow(false)`
  fires there too (plus `startPlay`/`die`) as a belt-and-braces snap-home.

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

**Shield is violet, bomb is red.** The type id is still `'red'` for the shield - only
colours moved (coin, pickup notif, `burstCoin` hue, `HUD_SPARK_COLOR`, the shield bubble),
so the effect keeps the coin's colour. **Don't "fix" the id/colour mismatch by renaming
the type** - missions, achievements and saves key off it. Drain is drawn `[215,80,140]`,
not wine `#7a2f4f`, which sank into the void.

**Poison coin**: hazard. Toxic green `#5fbf00` (deliberately unlike the magnet's mint
`#44ff88`) and continuously emits a slow ooze drip while uncollected (`update.js`'s
coin-fade loop), so it reads as an active hazard at a glance. Touching it breaks the combo
and removes a **percentage** of `runCoins` (`POISON_LOSS_PCT_MIN` -> `POISON_LOSS_PCT_MAX`, 12%->15%,
lerp on `_prog`, `Math.ceil` so a small pool can't round to a no-op). Percentage, not a flat
amount, so it **compounds** over repeated hits - a long careless run can lose most of its
pool. (A flat amount was tried first, specifically to avoid that, and reverted on explicit
request that poison "really punish".) Comes out of this run's *pending* shard bank, never
the persistent `shards` balance, so it can only cost progress not yet banked.

**Bomb coin**: power-up, the opposite of a hazard. Clears every hazard within
`BOMB_RADIUS` of the pickup - stalactites fade out like a bullet kill, mines and in-flight
cannon shots are destroyed, an unfired cannon is disabled (`triggerBombExplosion`). Joins
the combo and banks toward `runCoins` like any power-up; only the two hazard coins opt out
of that shared path.

**Drain coin**: the second hazard. Where poison debits the pending shard bank (meta
progress), drain debits the *visible run score* - `ceil(score * lerp(DRAIN_LOSS_PCT_MIN,
DRAIN_LOSS_PCT_MAX, _prog))` (5%->8%) off `bonusScore`, so the HUD number drops. `bonusScore` may go
negative; `update.js` clamps the displayed score at 0, and since the loss is a fraction of
a shrinking number it can never reach a negative total. Its absolute bite *grows* with
depth, deliberately. Breaks the combo. Checked between the poison and bomb clocks in
`makeCoin()`, so a ready bomb still wins a triple-ready coin. Magnet-exempt like poison.
`sfxDrain` is a downward triangle glissando + bandpassed noise "suck", distinct from
poison's sour sawtooth squelch.


## Coin bonus and placement (key design decisions, do not revert)

- **Coin bonus is a real difficulty lever, not a marginal aid**: `GAP_PER_COIN_FRAC` = 0.075/0.43, `GAP_BONUS_MAX_FRAC` = 0.19/0.43 of the corridor's own half-gap (see Coin system above) - one coin adds ~17% to the halfGap and a maxed bonus 44%, at every depth. Coins are essential by design, not a small nudge - don't shrink these back down to make the bonus merely "helpful." The 12.0 change from absolute px to corridor fractions is **not** a weakening of that lever: it is exactly as strong as it always was early (wx=0 is a byte-exact no-op) and now equally strong, rather than disproportionately stronger, deep.
- **boundsBase for coin placement**: Coins placed ignoring current bonus so they're always reachable even without a bonus. Never use `boundsAt()` for coin placement.
