# Canvas, physics, player

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the measurements and rejected alternatives behind them are in `docs/design-history.md` (the 2026-09-21 condensing moved the removed paragraphs there verbatim, under "Narratives moved out of docs/agents").

## Canvas size
`W` capped at 956 (iPhone 17 Pro Max landscape width) **on every platform** for leaderboard
fairness (`fairness.md`); `H` capped at 600 (520 Android app, 440 web) for consistent
difficulty. Wider devices letterbox. H also drives `_FEEL_SCALE`.

## Physics constants
`GRAVITY` / `THRUST` / `MAX_VY` in `constants.js`, quoted at `_H_REF` and scaled by
`_FEEL_SCALE` on every device.

**THRUST has already been walked back twice on real player feedback - read
`docs/design-history.md` -> "Physics tuning" before touching it.** It was tuned up chasing a
"Flappy Bird snappy" feel, called "too fast" by players, walked back too far (floaty), and
settled in between. GRAVITY and MAX_VY never moved. **The input model is unchanged** -
hold-to-thrust is an acceleration ramp, not an instant velocity impulse.

**Frame-rate-independent integration (do not revert).** `update.js` integrates the ship with
the TRAPEZOID - `py += (vyPrev + vy) * 0.5 * dt` - not `py += vy * dt` after the velocity
update, whose `0.5*a*dt^2` overshoot scales with frame length and gave every refresh rate a
different trajectory on a shared leaderboard. A bit-identical input replay now has a 0px
spread across 12-144Hz; `test-sim.js` drives the real `update()` at eight refresh rates
against the exact solution.

Two honest caveats, both left uncompensated deliberately: it did **not** close the score
gap between frame rates (that residue is input resolution, not physics), and it is very
slightly a nerf at 60Hz. If a real-device playtest finds it sluggish the lever is THRUST -
but re-read the tuning history first.

**Screen-independent feel (do not revert - explicit rule).** GRAVITY/THRUST/MAX_VY are
quoted at `_H_REF` (17 Pro Max landscape height, where the feel was player-tested) and
**every device - apps and web alike - scales all three by `_FEEL_SCALE = H / _H_REF`.**
The corridor also scales with H, so every trajectory is geometrically similar: same
fraction of the corridor per second on every screen.

**Any new code that reasons about vertical motion must stay ratio-based** (fraction of
MAX_VY, fraction of H) and never compare `vy` against a hardcoded px/s literal - scale the
literal by `_FEEL_SCALE` if you need one (see the speed-line `vyFloor` in `draw.js`).

The web build clamps W/H to the 17 Pro Max footprint, so `_FEEL_SCALE` is ~1.0 and **web
plays as a pixel-and-physics copy of the 17 Pro Max**. No separate web feel tuning (the old
`_WEB_FEEL` multiplier is deleted).

## Player
`PX` (fixed horizontal position) and `PR` (radius) are fractions of W in `constants.js`.
