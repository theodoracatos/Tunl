# Canvas, physics, player

Moved verbatim from CLAUDE.md on 2026-09-21 (progressive disclosure). CLAUDE.md keeps the one-line rule and points here.

## Canvas size
`W = Math.min(window.innerWidth, 956)`, `H = Math.min(window.innerHeight, 600)` - **W is capped at 956 (iPhone 17 Pro Max landscape width) on every platform** for leaderboard fairness (see "Cross-device fairness" below); H is capped at 600 for consistent difficulty (520 on Android-app, 440 on web). A device wider than 956 letterboxes left/right. H also drives `_FEEL_SCALE` - see "Screen-independent feel" under Physics constants.

## Physics constants
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

Two honest caveats, both left uncompensated deliberately: it did **not** close the score
gap between frame rates (that residue is input resolution, not physics), and it is very
slightly a nerf at 60Hz. If a real-device playtest finds it sluggish the lever is THRUST -
but re-read the tuning history first.

**Screen-independent feel (do not revert - explicit rule).** GRAVITY/THRUST/MAX_VY are
quoted at `_H_REF` = 440pt (iPhone 17 Pro Max landscape height, where the feel was tuned
and player-tested) and **every device - apps and web alike - scales all three by
`_FEEL_SCALE = H / _H_REF`.** Because the corridor half-gap also scales with H, every
trajectory is geometrically similar to the reference: same fraction of the corridor
covered per second, same time-to-cross, identical felt snappiness on a 375pt iPhone 12
mini, a 440pt 17 Pro Max and a 520pt Android tablet. A bigger screen genuinely gets
steeper px/s² and a smaller one gentler, by design.

**Any new code that reasons about vertical motion must stay ratio-based** (fraction of
MAX_VY, fraction of H) and never compare `vy` against a hardcoded px/s literal - scale the
literal by `_FEEL_SCALE` if you need one (see the speed-line `vyFloor` in `draw.js`).

The web build clamps W/H to 956x440 - the 17 Pro Max's own landscape footprint - so
`_FEEL_SCALE` lands at ~1.0 and **web plays as a pixel-and-physics copy of the 17 Pro
Max**. There is no separate web feel tuning; the old `_WEB_FEEL` 1.3 multiplier was
deleted (it only existed to fight the floatiness of web's earlier 520 clamp).


## Player
```javascript
const PX = W * 0.22;   // fixed horizontal position on screen (W capped at 956)
const PR = W * 0.018;  // radius (≈10.8px at W=600, ≈17.2px at the W=956 cap)
```
