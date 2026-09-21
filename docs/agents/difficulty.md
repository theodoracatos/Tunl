# Tunnel, flight plan, difficulty curves, deep run

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the measurements and rejected alternatives behind them are in `docs/design-history.md` (the 2026-09-21 condensing moved the removed paragraphs there verbatim, under "Narratives moved out of docs/agents").

## Procedural tunnel
Two overlapping sin waves (`refreshWave()` in `world.js`: `_wA1/_wA2` amplitudes,
`_wF1/_wF2` frequencies). `_prog` = sqrt-eased 0->1 over the first 14000 world-px
(~score 233); `_prog2` = linear 0->1 from 14000 to 54000.

**Easier pacing: corridor, bends and hazards each have their own slower clock
(2026-09-13, two passes on player feedback "the game is far too hard" - do not merge
back into `_prog`).**
- **Corridor width + wave amplitude** use `gapProgAt(wx)` (`world.js`): flat (widest)
  through `GAP_EASY_WX` (= `SAFE_START_WX`), then **linear** over `GAP_RAMP_WX` - a sqrt
  ease front-loads the narrowing, which was the complaint. Wave *frequencies* stay on
  `_prog` (re-pacing `sin(wx*f)` at large wx scrambles phase).
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
`sectorRate` / `sectorEnvelope`): `spacing = worldPxForSec(1 / rate)`. Rates start at
`STAL_RATE_S1` / `MINE_RATE_S3` / `COIN_RATE_SAFE` and grow per sector (`STAL_GROWTH`,
tapering from `SECTOR_GROWTH_TAPER`); the px floors stay, so rates grow without limit and
every run still ends. Each sector is a **sawtooth**: a breather at the start (low density,
more coin candidates as the payout), then a ramp past 100%.

The placement vetoes still apply but only decide geometry - **retune by the measured rate
(the replay-harness method), never by the spacing number**; that coupling is exactly how
12.0 accidentally tripled the mine count.

**Hull scratches** (`HULL_SCRATCHES`, from the tunnel entry, for the **whole run**;
`update.js` `hullScratch`): a lethal-wall contact spends one - clamp, bounce, "SCRAPE!"
notif, HUD diamonds - instead of ending the run. Counts as a hit for No-Hit. **A rewarded
continue repairs them** (see `economy.md`). **The grace after a scratch is wall-only**
(`WALL_GRACE_SEC`, `state.js wallGraceT`): the wall clamps, but stalactites, mines, boulders
and shots stay lethal and the ship does not blink - a full invuln would let a player scrape
on purpose to pass a stalactite field. **Scratches forgive wall mistakes only; direct hits
are the shield's job** (a shield here was measured and rejected).

**Known residual:** experts hit a reaction-time wall around S10-S11. A slower `stalLenFrac`
leg and a slower chicane ramp were measured as no-ops; the lever left is speed itself.

The audit that produced this and the measured before/after per tier:
`docs/design-history.md` -> "Flight plan (sectors)". Concept + evidence:
https://claude.ai/code/artifact/9c713c80-e348-46fc-b6ee-f66af5bb9be4

Two bounds functions:
- `boundsAt(wx)` - includes coin bonus - used for rendering AND collision
- `boundsBase(wx)` - base only (no bonus) - used only for placing coins safely

## Difficulty scaling functions

All curves live in `world.js` and are multiplied by the day's `DAY_ARCHETYPES` entry.
`stalSpacing` / `coinSpacing` / `mineSpacing` are sector rates (see Flight plan);
`stalLenFrac` (hard cap 0.80) and `cannonSpacing` still ride `hazProgAt`/`hazProg2At`;
`chicaneProb` fades in from `CHICANE_START_WX` (hard cap 0.62); `scrollSpd()` scales by
W/600 with W capped, then an uncapped sqrt tail.

A maxed `gapBonus` widens the corridor by the same factor at every depth
(`GAP_BONUS_MAX_FRAC`); pre-12.0 a flat bonus more than doubled the plateau corridor.

**Onboarding corridor widen** (`earlyWidenAt()`, `world.js`): extra half-gap
(`EARLY_WIDEN_FRAC` of H at wx=0, walls reduced to a sliver) smoothstepped to 0 by
`EARLY_WIDEN_WX`, rejoining the base curve with no kink. Added in both `refreshWave()` and
`halfGapAt()` so rendering/collision (`boundsAt`) and placement (`boundsBase`) agree - same
pattern as `deepChamberAt`.

## Speed never plateaus (key design decision, do not revert)

- **`scrollSpd()` never plateaus**: every geometry knob caps once `_prog2` saturates
  (pushing geometry further makes the tunnel unnavigable), but speed only shrinks reaction
  time, so past `_prog2 > 1` it climbs forever on a sqrt tail - a long run is never mere
  endurance at a fixed pace. Don't re-add a hard cap.

## Deep-run variety (score ~150+, do not revert)

Past `_prog2 = 1` every geometry knob is capped and only speed moves, so the deep run was
one variable getting twitchier. `DEEP_VARIETY_WX` switches on the shape morph, chambers,
deep coin-line shapes and the palette drift; it was moved early on the leaderboard argument
(no real player reached the old value) - see the doc comment above it in `world.js`.

It is safe at any value because every feature is bounded *relative to the same wx
unmorphed*. Two things deliberately did NOT move with it: the **speed pulse** (gated on
`_prog2 > 1`) and the **apex-biased mines** (`DEEP_APEX_WX`, an unplaytested fairness risk).

All of it lives in `world.js` (`DEEP_*` consts + `_deepHash` + `deepMorphAt`) and is a
pure function of `scrollX` + `_deepDay` (captured in `seedDailyVariety`, independent of
the `rng()` obstacle stream and the `h`-chain), so every player flies the identical
sequence and the scrollX-indexed ghost stays locked. **`_deepVarietyOn` (default true) is
the master kill switch for all of it.**

- **Shape morph** (`deepMorphAt`, folded into `refreshWave` and `boundsBase`): the waves'
  **amplitudes** follow a seeded per-day sequence of characters (`DEEP_CHARS`), each holding
  `DEEP_CHAR_WAVELEN` then smoothstepping into the next. Splits are picked so peak corridor
  velocity (`wA1*wF1 + wA2*wF2`) never exceeds ~1.02x the unmorphed value - a different
  ride, never more wiggle energy. **Frequencies are untouched** (phase scramble). Segment 0
  has its own entry ramp so `wx <= DEEP_VARIETY_WX` stays exactly inert. `test-math.js`
  guards inertness, the energy ceiling and continuity.
- **Speed pulse** (`scrollSpd()`): past `_prog2 > 1`, a seeded swell up to
  `DEEP_PULSE_AMP` **above** the trend over `DEEP_PULSE_WAVELEN`. **Surge-only - never dips
  below the trend** (a +- pulse decelerated half of every cycle, which reads as the game
  getting easier).
- **Chambers** (`deepChamberAt`, `DEEP_CHAMBER_PERIOD`/`DEEP_CHAMBER_PEAK`): a rare seeded
  window where the half-gap balloons on a sine bump - a breather, never a hazard. Applied in
  `refreshWave` **and** `halfGapAt()` so placement follows the room; the factor is 1 at
  every period seam. The one sanctioned exception to "the corridor only narrows".
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
- **Boulders**: see `hazards.md` -> Boulders.
