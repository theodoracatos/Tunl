# Cross-device fairness

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the measurements and rejected alternatives behind them are in `docs/design-history.md` (the 2026-09-21 condensing moved the removed paragraphs there verbatim, under "Narratives moved out of docs/agents").

## Cross-device fairness (do not revert without re-auditing)

The daily seed makes the cave identical in world-x for every player on Earth, and
`score = floor(scrollX / 60) + bonusScore` is pure world-distance, so the leaderboard is
only fair if flying a given stretch of world-x is equally hard on every screen.

**This is enforced by `test-cave.js`, not just asserted.** It replays the real spawners
frame by frame at six device sizes, compares the obstacle lists byte for byte, asserts the
`SPAWN_AHEAD_*` budget and re-checks every boulder's two passes. **Run it after touching
anything in `maintain*()` / `make*()` / the difficulty curves.** Until 2026-09-11 six sizes
flew six different caves; four rules came out of that fix, all easy to reintroduce:

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
Stalactites are created first and furthest ahead, and every spawner that inspects them must
sit far enough inside that horizon for its whole inspection radius to be populated. Broken
twice already (the second time most boulders and all cannons were placed blind). Three rules:

- **Raise the horizon, never clamp the retry offsets** (`SPAWN_AHEAD_STAL`). Clamping
  would drop most boulders again. Safe because each spawner owns its rng stream; the cost
  is a longer live stalactite array.
- **Placement vetoes are geometric and same-wall, never a flat radius.** `stalSpacing()`
  floors at 50px, so "no spike within 140px" is a window that essentially never exists
  deep. `makeCannon` vetoes only same-wall spikes within `PLACE_CANNON_R + placeStalW`
  and draws its wall **before** the retry loop, so the rng stream does not depend on how
  many offsets were rejected.
- **`_makeBoulderAt` tests the contract, not a proxy for it**: both passes must survive
  the stalactites that actually overlap the rock, measured against the half-chord at
  each spike's own x, requiring >= 1.3 player diameters each. Result: 0 sealed passes.

**Coins are the fixed point for boulders and mines.** `coinBlockedByStal` only knows
stalactites, so `_fitIsland` and `_makeMineAt` reject any placement within
`PLACE_COIN_CLEAR_R` of an existing coin (shorter island / next retry offset / none), in
reference units. **The coin never moves and is never dropped** - rocks and mines yield.
This needs coins to exist first, hence `SPAWN_AHEAD_COIN`'s reach (bounded by the coin's own
stalactite budget). **Do not lower it or reorder `maintainCoins()` after
`maintainBoulders()`/`maintainMines()`** - verdicts would then depend on frame timing, i.e.
screen width. `test-cave.js` asserts the reach budget and 0 overlaps, but not the call
order (its `step()` repeats update.js's order by hand). Not covered: falling stalactites
and portal rings.

`_makeMineAt`'s tip-push radius shrinks over `_prog2` for the same reason - at minimum
stalactite spacing a flat radius left no vertical room past the plateau.

Two independent fairness axes:

- **Vertical** (gravity/thrust/fall vs corridor): normalized by `_FEEL_SCALE` - see
  "Screen-independent feel". Fair by construction; `test-math.js` guards it.
- **Horizontal** (how fast the cave scrolls past): `scrollSpd()` multiplies by `W/600` and
  obstacle spacing is fixed in world-x, so reaction time per obstacle is `~ 1/W`. Hence **W
  is capped at 956** (a no-op on iOS, clamps large Android devices). Small phones get
  slightly *more* reaction time - the acceptable direction.
- Lookahead *time* (`W*0.78 / scrollSpd`) is W-independent - same seconds of visual
  warning everywhere. Good.
- **Known residual, not addressed:** `PR` is W-derived while the corridor is H-derived, so
  hitbox/corridor tracks aspect ratio (negligible on iPhones, a squarer Android tablet is
  more forgiving). Fixing it means keying `PR` off H - a feel change needing its own playtest.

Measured before/after numbers for both breakages: `docs/design-history.md` ->
"Cross-device fairness".

