# Coins

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the measurements and rejected alternatives behind them are in `docs/design-history.md` (the 2026-09-21 condensing moved the removed paragraphs there verbatim, under "Narratives moved out of docs/agents").

## Coin system

Coins collect into `gapBonus` (extra halfGap px, capped, decays over time). Since 12.0
all three magnitudes are **fractions of the corridor's own half-gap, not of `H`**
(`constants.js`, accessors `gapPerCoin()` / `gapBonusMax()` / `gapDecay()` in `world.js`
next to `refreshWave()`):
`GAP_PER_COIN_FRAC` (per coin), `GAP_BONUS_MAX_FRAC` (cap) and `GAP_DECAY_FRAC` (per second),
each written as `<old H fraction> / 0.43`.

**Why fractions (do not revert).** A fixed px bonus on a corridor that shrinks
`H*0.34 -> H*0.163` flattens the difficulty curve: the bonus is easy to hold, so the
widening grew to ~2x deep and cancelled most of the designed narrowing. As fractions the
corridor is the base curve TIMES a constant instead of PLUS one.

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
`DEEP_DECAY_PEAK`** - coin supply refills the bar far faster than any decay rate drains it,
so the cap binds, not decay (swept and measured).

**Gold coins bank no `gapBonus` during the safe opening zone** (`scrollX <
SAFE_START_WX`, `checkCoinCollection`'s gold branch): walls there are already at the
screen edges (`safeOpenAt`), so the widening is invisible in the moment and only pays off
as a bonus already near its cap the instant hazards start. Points, combo and shard
banking are unaffected.

**Chicane gold is gated in SECONDS, not world-px** (`CHICANE_GOLD_GAP_SEC`,
`worldPxForSec()` in `world.js`, applied in `maintainStalactites`). Deep, nearly every
chicane wants to drop a centred gold coin, and a fixed distance shrinks in seconds as
`scrollSpd()` climbs - a px gate pinned `gapBonus` at its cap and cancelled the whole
corridor narrowing. A time gate is flat in coins/sec at every depth. Two constraints:
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
roll has no notion of real time, so without a floor every type's coins-per-second climbs
with depth (the shield stack sat full and slow-time ran most of the deep run). Four rules,
all load-bearing:
- A vetoed power-up coin is **skipped entirely** (`makeCoin` returns `null`), never
  downgraded to gold - downgrading hands the suppressed share to gold and re-breaks the
  corridor bonus.
- The floor **scales in with depth**, so it is a measured no-op below score 233. That band
  is where real runs end; this pass may only make the deep run harder. Same rule governs
  the `makeMine` retry.
- The check sits **after** the poison/bomb/drain overrides, so a ready hazard is never
  delayed by an unrelated shield veto and the hazard `rng()` stream is untouched.
- **Orange (ammo) is deliberately exempt** (`test-math.js` guards it). Bullets auto-fire,
  so a pickup drains in seconds - there is no stock to pin.

The values are FLOORS, not the resulting cadence - the type still has to win the weighted
roll, which adds ~4-6s deep. Pick a floor by subtracting that from the cadence you want,
then re-measure.

**Gold's share also gets an explicit extra cut with depth** (`GOLD_DEEP_DECAY`, applied in
`makeCoin`), half over the score 34-233 ramp (`t`), half over the 233-900 marathon
(`_prog2`). **The two legs are redistributed differently and must stay that way:** the
t-leg spreads proportionally across whichever of blue/orange/green are active (never a
flat leftover-to-green fallback, which bends green's gate open early); the `_prog2` leg
goes to green alone, the one type designed to keep growing. A blended split let capped
power-ups drift past their ceilings ("too many shields").

**Blue's stack cap** (cut 2026-09-11; ELECTRIC's cap scales with it to keep its +50%): a
longer cap made slow-time the baseline pace rather than a rescue. **The per-coin duration is
untouched** - the swoop is the mechanic; the cap only limits how far a streak runs it out.

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
jittered `nextPoisonAt`/`nextDrainAt`/`nextBombAt`, the next coin that clears placement
becomes that type). `coinBlockedByStal()` rejects most candidates at a rate that varies
with difficulty, chicanes and day archetype, so a percentage fired ~10x rarer than intended
and drifted. Intervals: `POISON_INTERVAL_SEC` / `BOMB_INTERVAL_SEC` / `DRAIN_INTERVAL_SEC`;
bomb is deliberately more frequent than poison (a reward at least as often as a punishment
reads generous). First targets count from `HAZARD_START_WX`.

**Coin rendering ("Gegenstand" - do not go back to glossy gems or add a frame)**
(`draw.js` `drawCoin` / `COIN_OBJECTS`). Each coin draws the thing it does: gold = gem with
two outward chevrons, blue = Sanduhr, red = violet Wappenschild, orange = Fadenkreuz,
green = horseshoe magnet with poles toward the ship, bomb = bomb with burning fuse,
poison = Giftflasche, drain = inward Strudel. **No frame** (built and removed on the user's
call - at ~17pt it shrank the object past recognition). Size `COIN_OBJECT_SCALE` of the
hitbox radius, gold `COIN_OBJECT_BOOST` more. Flat facets lit from above, **zero
`shadowBlur`**. Gold moves no more than the blue coin - no spin, no flip. Hitbox is still
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

## Blue coin "Zeitblase" (slow-time presentation)

Draw-only, `constants.js` `SLOW_FX_*` doc. The slow already
sagged the scroll, the music and drew a HUD bar, but nothing else on screen slowed, so it
read as a stutter. Three presentation layers ride one eased intensity `slowFxVis`
(`state.js`, chases `slowTime / slowTimeMax`, so they fade with the glide back to full
speed): particles, thruster exhaust and coin animations run on a slowed clock (`vtime`,
and `vdt` in `update.js`; exhaust spawn is thinned so the live count stays flat); a
one-shot double ring on pickup plus thin time ripples around the ship; a faint ice-blue
wash on the LEFT only (hazards arrive from the right, same rule as the depth light).
**`gtime` is deliberately NOT slowed** - mines bob off it and collide against it, so that
would be a gameplay change. No `shadowBlur`, no `rng()`, no placement decision. Cyan wall
tint stays reserved for the coin bonus, so the effect never colours the walls.

## Coin bonus and placement (key design decisions, do not revert)

- **Coin bonus is a real difficulty lever, not a marginal aid**: one coin adds a large share
  of the half-gap and a maxed bonus much more, at every depth (`GAP_*_FRAC`). Don't shrink
  these to make the bonus merely "helpful". The fractions rewrite is not a weakening: wx=0
  is a byte-exact no-op, and deep it is now equally strong rather than disproportionately.
- **boundsBase for coin placement**: Coins placed ignoring current bonus so they're always reachable even without a bonus. Never use `boundsAt()` for coin placement.

## Repair kit (2026-09-21)

A bullet that destroys a mine or a cannon shot drops a repair kit where it died
(`systems.js` `spawnRepairKit`/`updateRepairKits`, `REPAIR_KIT_PTS` doc in `constants.js`).
Flying through it refills the hull to `HULL_SCRATCHES` and always pays `REPAIR_KIT_PTS`,
so it drops on a full hull too. User's calls: **no cooldown** (deep speed already makes
kits hard to reach, and scratches only forgive walls), **no magnet pull or warp vacuum**
(stays at its world-x, gone if missed).

- **Kits never enter `coins`/`chicaneCoins`.** Spawner vetoes read those arrays, and a kit
  exists only for a player who shot, so the shared daily cave would fork. `repairKits` is
  its own array and draws no rng.
- Placed with `boundsBase()` like a coin, padded so it is never inside rock.
- Drawn through `drawCoin(..., 'repair')` (a frameless wrench in the HUD hull colour), not a plus
  sign: the ammo crosshair already reads as one. Guarded in `test-sim.js` section 10.
