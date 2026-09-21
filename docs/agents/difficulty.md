# Tunnel, flight plan, difficulty curves, deep run

Moved verbatim from CLAUDE.md on 2026-09-21 (progressive disclosure). CLAUDE.md keeps the one-line rule and points here.

## Procedural tunnel
Two overlapping sin waves, amplitude and frequency scale with difficulty (`_prog`).
`_prog = Math.min(Math.sqrt(scrollX / 14000), 1)` - sqrt easing: fast early ramp, plateau near max. Reaches max difficulty at 14000 world px (~score 233).

```javascript
_wA1     = lerp(H * 0.07,  H * 0.12,  _prog);   // wave amplitude 1
_wA2     = lerp(H * 0.035, H * 0.055, _prog);   // wave amplitude 2
_wF1     = lerp(0.0025,    0.0048,    _prog);    // wave frequency 1
_wF2     = lerp(0.0060,    0.0115,    _prog);    // wave frequency 2
```

**Easier pacing: corridor, bends and hazards each have their own slower clock
(2026-09-13, two passes on player feedback "the game is far too hard" - do not merge
back into `_prog`).**
- **Corridor width + wave amplitude** use `gapProgAt(wx)` (`world.js`): flat at 0
  (widest, `H*0.34`) through `GAP_EASY_WX` = `SAFE_START_WX` = 3000 (~score 50, where the safe flight ends), then **linear** (a sqrt
  ease front-loads the narrowing, which was the complaint) over `GAP_RAMP_WX` = 90000,
  so `H*0.163` is only reached at wx=93000 (~score 1550, was ~233). Half-gap
  old -> new: score 200 0.176 -> 0.328, 500 0.163 -> 0.293, 800 0.163 -> 0.257.
  `EARLY_WIDEN_WX` 12000 -> 24000. Wave *frequencies* stay on `_prog` (re-pacing
  `sin(wx*f)` at large wx scrambles phase).
- **Hazard and coin DENSITY, and every hazard's start point, now come from the flight
  plan** - see "Flight plan (sectors)" right below. `hazProgAt`/`hazProg2At` survive only
  for `stalLenFrac` and `cannonSpacing`.
`_prog`/`_prog2` themselves (blue-coin gate, red's share ramp, scroll speed, poison/drain %,
deep variety) are unchanged. `test-math.js` guards the flat zone, plateau and monotonicity;
`test-cave.js` mirrors the start cursors and still shows an identical cave on all
device sizes with 0 sealed boulder passes.

## Flight plan (sectors) - do not revert to per-hazard world-px curves

A run is a sequence of **sectors of `SECTOR_SEC` = 7 reference seconds** (`constants.js`
`refSpdTrend` / `sectorAt` / `sectorStartWx` / `sectorPhase`). Sector 0 is the safe flight
and ends exactly at `SAFE_START_WX`; later boundaries are integrated from `refSpdTrend`,
which is `scrollSpdBase`'s trend at the W cap with no deep pulse - one formula, called by
both (`test-math.js` asserts they agree). Sector boundaries are therefore pure world-x and
identical on every device.

**What each sector introduces** (`constants.js` `*_START_WX = sectorStartWx(n)`):

| sector | score | new |
|--------|-------|-----|
| S0 | 0-50 | open corridor, walls lethal + 2 hull scratches from the tunnel entry (kept all run); gold, blue |
| S1 | 50-111 | first stalactites, shield coin |
| S2 | 111-178 | orange ammo, green magnet |
| S3 | 178-252 | first mine (alone, centred in its band), bomb coin |
| S4 | 252-328 | boulders |
| S5 | 328-408 | chicanes (faded in over `CHICANE_FADE_WX`) |
| S6 | 408-493 | cannons |
| S7 | 493-583 | falling stalactites |
| S8 | 583-677 | poison coin |
| S9 | 677-773 | drain coin |
| S10+ | 773+ | nothing new; rates keep growing |

**Tools come before the threat they answer, but not later than S2**: the daily missions
("5 ammo", "2 magnets", "3 bombs") are cumulative per day and must stay reachable for
casual players, whose runs end around S2-S3. **Check `MISSION_DEFS` before moving a coin
gate.** Bomb/poison/drain clocks start at their sector (`lifecycle.js`), the first one
15-65% of the interval after unlock. The portal ring is unchanged. "SECTOR n" notif fires
at each boundary from S2 on (i18n key `sector`).

**Densities are rates per reference second, not world-px spacings** (`world.js`
`sectorRate` / `sectorEnvelope`): `spacing = worldPxForSec(1 / rate)`. Stalactite slots
`STAL_RATE_S1` 2.0/s x `STAL_GROWTH` 1.14 per sector, 1.08 from `SECTOR_GROWTH_TAPER`
(S8); mines `MINE_RATE_S3` 0.28/s x 1.2, then 1.1; floors 50 / 200 px unchanged, so rates
grow without limit and every run still ends ("mines guarantee an eventual death" holds).
Each sector is a **sawtooth**: the first 20% runs at 55% density (the breather, with 1.5x
coin candidates as the payout), then ramps 80% -> 115%. Coins: `COIN_RATE_SAFE` 0.75/s in
S0, 0.95/s in S1-S3, x0.985 per sector after, floor 0.8/s.

The placement vetoes still apply but only decide geometry - **retune by the measured rate
(the replay-harness method), never by the spacing number**; that coupling is exactly how
12.0 accidentally tripled the mine count.

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

The audit that produced this and the measured before/after per tier:
`docs/design-history.md` -> "Flight plan (sectors)". Concept + evidence:
https://claude.ai/code/artifact/9c713c80-e348-46fc-b6ee-f66af5bb9be4

Two bounds functions:
- `boundsAt(wx)` - includes coin bonus - used for rendering AND collision
- `boundsBase(wx)` - base only (no bonus) - used only for placing coins safely


## Difficulty scaling functions

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

## Deep-run variety (score ~150+, do not revert)

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

All of it lives in `world.js` (`DEEP_*` consts + `_deepHash` + `deepMorphAt`) and is a
pure function of `scrollX` + `_deepDay` (captured in `seedDailyVariety`, independent of
the `rng()` obstacle stream and the `h`-chain), so every player flies the identical
sequence and the scrollX-indexed ghost stays locked. **`_deepVarietyOn` (default true) is
the master kill switch for all of it.**

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
- **Coin-line shapes** (`makeCoin`): deep coin `y` follows a seeded slow sine arc per
  ~3200px band instead of scattering independently - a line to follow. `rng()` is still
  consumed, so coin *types* are unchanged; only positions move.
- **Palette drift** (`draw()`): past `_prog2 > 1` the wall / stalactite *glow*
  (`wallBase`/`stalEdge`) lerps toward a cool deep tint, capped at 0.30. Base rock colour
  and the daily identity are untouched. Subtle on purpose.
- **Apex-biased mines** (`makeMine`, **flagged**): at a genuine bend apex (`centerAt`
  neighbours both on one side) ~60% of mines snap toward the centreline - where the
  corridor shape already forces the player. Same count/speed. **Watch in playtest for a
  "the game is cheating" read** - cut it if it feels unfair.
- **Boulders**: see the Boulders section above.

**Blue coin "Zeitblase" (draw-only, `constants.js` `SLOW_FX_*` doc).** The slow already
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

