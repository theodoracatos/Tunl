# Cross-device fairness

Moved verbatim from CLAUDE.md on 2026-09-21 (progressive disclosure). CLAUDE.md keeps the one-line rule and points here.

## Cross-device fairness (do not revert without re-auditing)

The daily seed makes the cave identical in world-x for every player on Earth, and
`score = floor(scrollX / 60) + bonusScore` is pure world-distance, so the leaderboard is
only fair if flying a given stretch of world-x is equally hard on every screen.

**This is enforced by `test-cave.js`, not just asserted.** It replays the real spawners
frame by frame at six device sizes and compares the resulting obstacle lists byte for
byte, asserts the `SPAWN_AHEAD_*` budget table and re-checks every boulder's two passes.
**Run it after touching anything in `maintain*()` / `make*()` / the difficulty curves.**
Until 2026-09-11 the claim was simply false (six sizes, six different caves, diverging
from wx ~938). Four rules came out of that fix and all four are easy to reintroduce:

1. **Sample the difficulty curves at the PLACEMENT wx, never the player's.**
   `stalSpacing()` / `stalLenFrac()` / `coinSpacing()` / `mineSpacing()` /
   `cannonSpacing()` / `boulderSpacing()` / `fallSpacing()` / `chicaneProb()` and
   `makeCoin`'s whole type ladder take a wx (`progAt`/`prog2At`, `world.js`). The spawn
   loops run to a horizon, so reading `_prog` reads the difficulty wherever the player
   happens to be when the loop reaches that slot.
2. **Do placement geometry in REFERENCE units, not screen units.** `PR`/`COIN_R`/
   `MINE_R` are W-derived while the corridor is H-derived, so any test comparing the two
   differs per aspect ratio - and since `makeMine` draws `rng()` only on success, one
   differing rejection forks the whole stream. Use the `PLACE_*` constants +
   `_H_TO_REF`/`_REF_TO_H` (`constants.js`). The real `PR` is untouched: keying the
   actual hitbox off H is a feel change needing its own playtest.
3. **One rng stream per spawner** (`makeRngStream`, `state.js` `rngStal`/`rngCoin`/
   `rngMine`/`rngCannon`). The deep one: shared `rng()` interleaves per frame, and
   `scrollX` advances by `scrollSpd()*dt` which carries a W/600 term, so the frame an
   object crosses the horizon - and therefore the ORDER of draws - varied by width.
4. **Cadences tuned in seconds must be stored as world-x.** The poison/bomb/drain and
   power-up-floor clocks were `+= dt`; seconds-per-world-px depends on `scrollSpd`, so
   they fired at different world positions per device (and the hazard branch draws
   `rng()`). They are world-x cursors now (`state.js` `nextPoisonWx`), converted from
   the tuned seconds via `worldPxForSec()`, which uses the reference width. Same trick
   as the chicane-gold gate.

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
- **Placement vetoes are geometric and same-wall, never a flat radius.** `stalSpacing()`
  floors at 50px, so "no spike within 140px" is a window that essentially never exists
  deep. `makeCannon` vetoes only same-wall spikes within `PLACE_CANNON_R + placeStalW`
  and draws its wall **before** the retry loop, so the rng stream does not depend on how
  many offsets were rejected.
- **`_makeBoulderAt` tests the contract, not a proxy for it**: both passes must survive
  the stalactites that actually overlap the rock, measured against the half-chord at
  each spike's own x, requiring >= 1.3 player diameters each. Result: 0 sealed passes.

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

Two independent fairness axes:

- **Vertical** (gravity/thrust/fall vs corridor): normalized by `_FEEL_SCALE` - see
  "Screen-independent feel". Fair by construction; `test-math.js` guards it.
- **Horizontal** (how fast the cave scrolls past): `scrollSpd()` multiplies by `W/600`
  and obstacle spacing is fixed in world-x, so reaction time per obstacle at a given
  score is `∝ 1/W`. Hence **W is capped at 956** (`constants.js`) - without it an
  Android tablet (W ~1280) faced the shared cave ~1.75x faster than a small phone. The
  cap is a no-op on iOS (`TARGETED_DEVICE_FAMILY = 1`) and clamps large Android devices.
  Residual: small phones still get slightly *more* reaction time - the acceptable
  direction.
- Lookahead *time* (`W*0.78 / scrollSpd`) is W-independent - same seconds of visual
  warning everywhere. Good.
- **Known residual, not addressed:** `PR = W*0.018` vs corridor `∝ H`, so hitbox/corridor
  tracks aspect ratio. iPhones are all ~2.17 so it is negligible on iOS; a squarer
  Android tablet with H capped at 520 is ~20% more forgiving. Fixing it means keying
  `PR` off H, a feel change needing its own playtest.

Measured before/after numbers for both breakages: `docs/design-history.md` ->
"Cross-device fairness".

