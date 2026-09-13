# TUNL - Claude Code Instructions

## Working style

- Just do the task. Don't ask for confirmation before reading files, running searches, or making straightforward edits.
- Don't ask clarifying questions if the intent is clear from context - make a reasonable choice and do it.
- Only ask when something is genuinely ambiguous AND the wrong choice would be hard to undo.

## Secret-scanning pre-push hook

`.githooks/pre-push` blocks any `git push` (from Claude Code or the terminal) whose
new commits add a secrets-looking filename (`.env`, `*.pem`, `appsettings.Production.json`,
etc.) or content matching a known secret pattern (AWS/Google/GitHub/Slack/Stripe keys,
private key headers, generic `key|secret|token|password = <value>` assignments). It's
committed to the repo but git does not auto-trust a `core.hooksPath` from a clone, so each
clone must run `git config core.hooksPath .githooks` once to activate it. Bypass with
`git push --no-verify` only after confirming a hit is a false positive. Run `/check-secrets`
to get the same verdict mid-session before attempting a push.

## What is this

TUNL is an HTML5 Canvas hold-to-thrust cave flyer game.
`tunl.html` is an HTML/CSS shell that loads 15 plain scripts from `src/` in order - no
libraries, no modules, no build step, one shared global scope. Run `/map` for the file
map. Open `tunl.html` in a browser to play.

**Orientation: landscape only.** The iOS app (`Info.plist`) locks to `LandscapeLeft + LandscapeRight`. Never change this to portrait.

## How to play

- **HOLD** (tap/click/Space/ArrowUp) = thrust upward
- **RELEASE** = gravity pulls you down
- Collect coins (multiple types unlock progressively) - gold widens the corridor
- Avoid stalactites, mines, and tunnel walls
- Score = distance scrolled / 60

## Game Architecture

One JS class-free script, state machine with three phases: `'title'` | `'play'` | `'dead'`

### Canvas size
`W = Math.min(window.innerWidth, 956)`, `H = Math.min(window.innerHeight, 600)` - **W is capped at 956 (iPhone 17 Pro Max landscape width) on every platform** for leaderboard fairness (see "Cross-device fairness" below); H is capped at 600 for consistent difficulty (520 on Android-app, 440 on web). A device wider than 956 letterboxes left/right. H also drives `_FEEL_SCALE` - see "Screen-independent feel" under Physics constants.

### Physics constants
```javascript
// values below are quoted at _H_REF (440pt); every device multiplies by _FEEL_SCALE = H/_H_REF
const GRAVITY = 1300;  // px/s² downward
const THRUST  = 3100;  // px/s² upward when holding (net: 1800 up)
const MAX_VY  = 1080;  // terminal velocity cap
```
Originally tuned up hard across several requested passes (GRAVITY 1150 -> 1300, THRUST
2400 -> 3400, MAX_VY 820 -> 1080) chasing a "Flappy Bird snappy" feel, but real-player
Reddit feedback (2026-09-09) called the accel "too fast" with players dying before the
run's rush ever landed. Walked back to the documented middle ground on 2026-09-09:
THRUST 3400 -> 2700. A same-day playtest of 2700 felt off in the other direction (too
floaty), so it was nudged back up to **3100** - net-up 1800 vs net-down 1300, roughly
midway between the original 2100:1300 snap and the 2700 pass's 1400:1300 softness.
GRAVITY and MAX_VY are untouched throughout. The input model is UNCHANGED - still
hold-to-thrust (an acceleration ramp), not Flappy's instant velocity impulse - just
tuned to a less hair-trigger point on that same ramp. If this needs walking back
further: original pre-tuning feel is GRAVITY 1150 / THRUST 2400 / MAX_VY 820.

**Frame-rate-independent integration (do not revert).** `update.js` integrates the ship
with the TRAPEZOID - `py += (vyPrev + vy) * 0.5 * dt` - not `py += vy * dt` after the
velocity update. The latter pretends the ship spent the whole frame already at its
end-of-frame speed, overshooting by `0.5*a*dt^2` every frame; because that error scales
with FRAME LENGTH, the ship flew a measurably different trajectory on every refresh
rate. Measured over 0.5s of held thrust: 228px at 144Hz, 232px at 60Hz, 240px at 30Hz,
against an exact 225px. Since everyone flies the same daily cave into the same
leaderboard, that was a bigger inequity than anything `_FEEL_SCALE` and the W cap exist
to equalise. Replaying a bit-identical input schedule now gives a **0.000px** spread
across 12-144Hz (was 4.1px on that same schedule); `test-math.js` asserts both that and
that the old integrator genuinely diverged, so a silent revert fails.

Two honest caveats. **This did not close the measured score gap between frame rates** -
a simulated pilot still scored ~33% higher at 144Hz than at 60Hz afterwards, essentially
unchanged. The physics half is now exact; the rest is input resolution (a thumb can only
change state on a frame boundary, so a 144Hz device genuinely gets finer control), which
no integrator change can remove and which a bang-bang bot exaggerates relative to a
human. **And the fix is very slightly a nerf at 60Hz**: the ship now covers 225px rather
than 232px over a 0.5s climb, and proportionally more on short taps (the old error was
`1 + dt/T`, so it flattered quick corrections most). No constant rescale can reproduce
the old behaviour for that reason. Left uncompensated deliberately; if a real-device
playtest finds it sluggish, the lever is THRUST (3100), where ~+3% restores the old
half-second manoeuvre - but re-read the tuning history above first, that number has
already been walked back twice on player feedback.

**Screen-independent feel (do not revert - explicit rule).** GRAVITY/THRUST/MAX_VY are
quoted at `_H_REF` = 440pt (iPhone 17 Pro Max landscape height, the size the feel was
tuned and player-tested at) and **every device** - apps and web alike - scales all three
by `_FEEL_SCALE = H / _H_REF`. Because the corridor half-gap also scales with H, this
makes every trajectory geometrically similar to the reference - same fraction of the
corridor covered per second, same time-to-cross, identical felt snappiness on a 375pt
iPhone 12 mini, a 440pt 17 Pro Max, and a 520pt Android tablet. A bigger screen genuinely
gets steeper px/s² and a smaller one gentler, by design. Any new code that reasons about
vertical motion must stay ratio-based (fraction of MAX_VY, fraction of H) and never
compare `vy` against a hardcoded px/s literal - scale the literal by `_FEEL_SCALE` if
you need one (see the speed-line `vyFloor` in draw.js).

The web build clamps W/H to 956x440 - the iPhone 17 Pro Max's own landscape footprint -
so `_FEEL_SCALE` lands at ~1.0 and **web plays as a pixel-and-physics copy of the 17 Pro
Max**. There is no separate web feel tuning any more; the old `_WEB_FEEL` 1.3 multiplier
was deleted (it only ever existed to fight the floatiness of web's earlier 520 clamp).

### Cross-device fairness (do not revert without re-auditing)

**This is enforced by `test-cave.js`, not just asserted.** It replays the real
spawners frame by frame at six device sizes and compares the resulting obstacle lists
byte for byte. Run it after touching anything in `maintain*()` / `make*()` / the
difficulty curves. Until 2026-09-11 the claim below was simply false - a replay of one
day seed at six sizes produced six different caves, diverging from wx ~938 (score 15).
Four independent causes had to be fixed, and all four are easy to reintroduce:

1. **Sample the difficulty curves at the PLACEMENT wx, never the player's.**
   `stalSpacing()` / `stalLenFrac()` / `coinSpacing()` / `mineSpacing()` /
   `cannonSpacing()` / `boulderSpacing()` / `fallSpacing()` / `chicaneProb()` and
   `makeCoin`'s whole type ladder now take a wx (`progAt`/`prog2At` in `world.js`).
   The spawn loops run to a horizon, so reading `_prog` meant reading the difficulty
   wherever the player happened to be when the loop reached that slot.
2. **Do placement geometry in REFERENCE units, not screen units.** `PR`/`COIN_R`/
   `MINE_R` are W-derived sizes while the corridor is H-derived, so any placement test
   comparing the two came out differently per aspect ratio - and since `makeMine`
   draws `rng()` only on success, one differing rejection forked the whole stream. The
   `PLACE_*` constants + `_H_TO_REF`/`_REF_TO_H` (`constants.js`) are the fix;
   the real `PR` is untouched, because keying the actual hitbox off H is still "a feel
   change needing its own playtest".
3. **One rng stream per spawner** (`makeRngStream`, `state.js` `rngStal/rngCoin/
   rngMine/rngCannon`). This was the deep one: all spawners shared `rng()` and
   interleave per frame, and `scrollX` advances by `scrollSpd()*dt` which carries a
   W/600 term - so the frame on which an object crossed the horizon, and therefore the
   ORDER of draws, varied by screen width. Same seed, same curves, different cave.
4. **Cadences that are tuned in seconds must be stored as world-x.** The poison/bomb/
   drain and power-up-floor clocks were `+= dt`; seconds-per-world-px depends on
   `scrollSpd`, so they fired at different world positions per device (and the hazard
   branch draws `rng()`). They are world-x cursors now (`state.js` `nextPoisonWx`),
   converted from the tuned seconds via `worldPxForSec()`, which uses the reference
   width. Same trick as the chicane-gold gate.

Two consequences worth knowing. **`SPAWN_AHEAD_*` (`constants.js`) encodes an ordering
invariant**: stalactites are created first and furthest ahead, and every spawner that
inspects the stalactite array must sit far enough inside that horizon for its whole
inspection radius to be populated. Cannons and boulders used to sit OUTSIDE it, so
their overlap checks were half blind - which is the only reason they were as common as
they were. Fixing that made them nearly extinct until they got retry loops
(`CANNON_RETRY_OFFSETS` / `BOULDER_RETRY_OFFSETS`), same pattern as
`MINE_RETRY_OFFSETS`.

**The retry loops then re-broke the same invariant, and a browser playtest is what
caught it (2026-09-11).** The budget is `SPAWN_AHEAD_X + largest retry offset +
inspection radius <= SPAWN_AHEAD_STAL`, and the retry term was simply never added -
so a retried probe walked straight back out past the stalactite horizon and the veto
it was retrying for saw an empty array again. Measured over 60000 world-px: **15 of 18
boulders and 28 of 28 cannons** were placed blind, 12 boulders had a pass sealed by a
stalactite and one was sealed on **both** sides (an unavoidable death at score 940).
The very first boulder of the day had a ceiling spike driven through its top edge.
Three fixes, all load-bearing:
- `SPAWN_AHEAD_STAL` 600 -> **1550**, covering every retry reach. Raising the horizon
  rather than clamping the offsets, because clamping boulders to the ~226px that fit
  inside 600 would have dropped 15 of 18 of them - re-creating the near-extinction the
  retry loops exist to fix. The stalactite sequence itself does not change (each
  spawner has owned its own rng stream since the cross-device pass, so creating
  stalactites earlier no longer reorders anyone's draws); the cost is a longer live
  stalactite array (~39 -> ~70 deep).
- **Flat-radius vetoes had to become geometric**, because once the horizon was wide
  enough to enforce them they turned out to be unsatisfiable deep - `stalSpacing()`
  floors at 50px, so "no spike within 140px" (cannons) or "within ~73px" (boulders) is
  a window that essentially never exists. `makeCannon` now vetoes only **same-wall**
  stalactites within `PLACE_CANNON_R + placeStalW` (a ceiling spike was never a reason
  to move a floor-mounted cannon), and draws its wall **before** the retry loop so the
  rng stream no longer depends on how many offsets were rejected.
- `_makeBoulderAt` **tests the contract instead of a proxy for it**: both passes must
  survive the stalactites that actually overlap the rock, measured against the circle's
  half-chord at each spike's own x, requiring >= 1.3 player diameters each (1.1 before the 2026-09-13 shrink). A spike near
  the rock's edge barely eats into a pass, which the old proxy could not tell apart from
  a spike through its middle. Measured after: **0 sealed passes** (was 12 of 18), first
  boulder back at score 85 on 7 of 8 day-seeds, cannon density unchanged (27.5 per 60000
  world-px), boulder density 9.3. Deep boulders are genuinely rare past score 900 (0.04
  per 1000 world-px vs 0.21 early) - at that corridor width two 1.1-diameter passes plus
  the rock barely fit, so that thinning is honest, not a bug.

`test-cave.js` now asserts the whole budget table and re-checks every boulder's two
passes, so neither can rot silently again.

**And the old deep mine density was itself an artifact** of that
same blindness: with the horizons ordered, `_makeMineAt`'s 300px tip-push radius left
no vertical room at all past the plateau (stalSpacing floors at 50px there), so the
radius now lerps 300 -> 90 over `_prog2`. Measured deep mine density 0.98 -> 2.0 per
1000 world-px; below score 233 every one of these changes is a measured no-op.

The daily seed makes the cave identical in world-x for every player on Earth, and
`score = floor(scrollX / 60) + bonusScore` is pure world-distance, so the leaderboard is
only fair if flying a given stretch of world-x is equally hard on every screen. Two
independent axes:

- **Vertical** (gravity/thrust/fall vs corridor): normalized by `_FEEL_SCALE` - see
  "Screen-independent feel". Fair by construction; `test-math.js` guards it.
- **Horizontal** (how fast the cave scrolls past): `scrollSpd()` multiplies by `W/600`,
  and obstacle spacing is fixed in world-x, so reaction time per obstacle at a given
  score is `∝ 1/W`. This is why **W is capped at 956** (`constants.js`) - without it an
  Android tablet (W ~1280) faced the shared cave ~1.75x faster than a small phone at the
  same score. The cap is a no-op on iOS (`TARGETED_DEVICE_FAMILY = 1`, no iPhone exceeds
  ~956) and clamps large Android devices. Residual: small phones (SE, minis) still get
  slightly *more* reaction time - erring generous for small screens, which is the
  acceptable direction.
- Lookahead *time* (`W*0.78 / scrollSpd`) is W-independent - every device gets the same
  seconds of visual warning. Good.
- Known residual, not yet addressed: `PR = W*0.018` (hitbox) vs corridor `∝ H`, so
  hitbox/corridor tracks aspect ratio - iPhones are all ~2.17 so it's negligible on iOS;
  a squarer Android tablet with H capped at 520 is ~20% more forgiving. Fixing it means
  keying `PR` off H instead of W, which is a feel change needing its own playtest.

### Player
```javascript
const PX = W * 0.22;   // fixed horizontal position on screen (W capped at 956)
const PR = W * 0.018;  // radius (≈10.8px at W=600, ≈17.2px at the W=956 cap)
```

### Ship rendering (K5 "Facette + Licht", 12.0)

`shipPath()` / `drawShip()` / `drawThrustPlume()` in `draw.js`. The SR-71 silhouette is
cut into flat facets (`SHIP_FACETS`) lit from above - top half toward white, bottom half
toward near-black, all mixed from the skin's own colour (`_shipTones`, cached per skin)
so every ship keeps its paint. Seams are faint light/dark hairlines, never black ink: an
earlier pass with dark panel lines read as a technical drawing. Emissive details in the
skin's glow colour (intake rings, wingtip strobes, spine running lights) are switched off
via `drawShip`'s `fx` argument for the ghost and the wrecked death frame, since a ghost
with running lights reads as a second live ship. Only the base fill spends `shadowBlur`;
the glow rings use a wide soft stroke instead, because shadowBlur is the expensive call
on WKWebView.

**Envelope (do not grow it):** span +-0.98r, nose +1.40r. The old nose reached 1.72r,
~17.6px ahead of `update.js`'s forward collision probe (+0.7*PR), so it visibly slid
through stalactites; the old span stopped at 0.92r, so the PR circle killed ~8% before
the wing visibly touched. `PR` itself is untouched - this is purely visual.

**The thrust plume is tinted with the skin glow** (teardrop, white core, three shock
diamonds). Normal thrust used to be the same orange as the ON FIRE afterburner; now
orange-red belongs to ON FIRE alone. Exhaust leaves the nacelles at `SHIP_NOZZLE_X/Y`
(`constants.js`), shared by the plume, the on-fire cone and `update.js`'s thruster
particles. The share card's `_shipGlyph` (`share.js`) carries a copy of the outline.

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

### Procedural tunnel
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

### Flight plan (sectors) - 2026-09-13, do not revert to per-hazard world-px curves

A run is a sequence of **sectors of `SECTOR_SEC` = 7 reference seconds** (`constants.js`
`refSpdTrend` / `sectorAt` / `sectorStartWx` / `sectorPhase`). Sector 0 is the safe
flight and ends exactly at `SAFE_START_WX`; later boundaries are integrated from
`refSpdTrend`, which is `scrollSpdBase`'s trend at the W cap with no deep pulse - one
formula, called by both (`test-math.js` asserts they agree). Sector boundaries are
therefore pure world-x and identical on every device.

**Why.** A replay audit (real spawners + physics, 4 bot tiers x 100 runs, 24 day-seeds)
measured the 12.0 working tree as: 7 new elements in the first 9 s, none between 9 s and
22 s, five between 23 s and 37 s, nothing new after that; **41% of beginner runs dying
within 8 points of the walls turning lethal** (91% of beginner deaths are walls, and the
safe zone only bumps, so it cannot teach them); stalactites per second doubling twice
between score 300 and 1150, which ended 100% of expert runs inside score 500-900; and 3x
the 11.0 mine count because sparse stalactites stopped the placement vetoes from
thinning mines and coins. Concept + evidence:
https://claude.ai/code/artifact/9c713c80-e348-46fc-b6ee-f66af5bb9be4

**What each sector introduces** (`constants.js` `*_START_WX = sectorStartWx(n)`):

| sector | score | new |
|--------|-------|-----|
| S0 | 0-50 | safe flight; gold, blue |
| S1 | 50-111 | walls lethal + 2 hull scratches, first stalactites, red shield coin |
| S2 | 111-178 | orange ammo, green magnet |
| S3 | 178-252 | first mine (alone, centred in its band), bomb coin; scratches expire |
| S4 | 252-328 | boulders |
| S5 | 328-408 | chicanes (faded in over `CHICANE_FADE_WX`) |
| S6 | 408-493 | cannons |
| S7 | 493-583 | falling stalactites |
| S8 | 583-677 | poison coin |
| S9 | 677-773 | drain coin |
| S10+ | 773+ | nothing new; rates keep growing |

Tools come before the threat they answer, but **not later than S2**: the daily missions
("5 ammo", "2 magnets", "3 bombs") are cumulative per day and must stay reachable for
casual players, whose runs end around S2-S3. Check `MISSION_DEFS` before moving a coin gate.
Bomb/poison/drain clocks start at their sector (`lifecycle.js`), first one 15-65% of the
interval after unlock. The portal ring is unchanged.

**Densities are rates per reference second, not world-px spacings** (`world.js`
`sectorRate` / `sectorEnvelope`): `spacing = worldPxForSec(1 / rate)`. Stalactite slots
`STAL_RATE_S1` 2.0/s x `STAL_GROWTH` 1.14 per sector, 1.08 from `SECTOR_GROWTH_TAPER` (S8);
mines `MINE_RATE_S3` 0.28/s x 1.2, then 1.1; floors 50 / 200 px unchanged, so rates grow
without limit and every run still ends ("mines guarantee an eventual death" holds). Each
sector is a **sawtooth**: the first 20% runs at 55% density (the breather, with 1.5x coin
candidates as the payout), then ramps 80% -> 115%. Coins: `COIN_RATE_SAFE` 0.75/s in S0,
0.95/s in S1-S3, x0.985 per sector after, floor 0.8/s. The placement vetoes still apply
but only decide geometry - **retune by the measured rate** (the replay harness method in
the audit), never by the spacing number; that coupling is exactly how 12.0 tripled mines.

**Hull scratches** (`HULL_SCRATCHES` = 2 until `HULL_END_WX` = start of S3, `update.js`
`hullScratch`): a lethal-wall contact spends one - clamp, bounce, `HIT_INVULN_SEC` grace,
"SCRAPE!" notif, HUD diamonds bottom-right - instead of ending the run. Counts as a hit
for the No-Hit achievement. A plain shield at the same moment was measured and rejected
(it mostly boosted the good tier, +72% median, by eating a stalactite later).
"SECTOR n" notif fires at each boundary from S2 on (`update.js`, i18n key `sector`).

**Measured result** (bot tiers; average = the tier real players matched in 11.0):

| tier | median before -> after | reaches 100 | dies within 8 pts of walls lethal |
|------|------------------------|-------------|-----------------------------------|
| beginner | 65 -> 95 | 4% -> 39% | 41% -> 3% |
| average | 107 -> 155 | 32% -> 70% | 16% -> 2% |
| good | 205 -> 401 | 80% -> 91% | 1% -> 1% |
| expert | 715 -> 928 (p90 1328) | 100% | 0% |

Average-tier death rate per sector is now a ramp (S1 38%, S2 60%, S3 68%) instead of a
cliff. Per 10 real seconds at W956: stalactites 17 / 20 / 23 / 26 / 33 / 44 / 53 / 62 / 68 /
78 / 96 across S1..S11+ (was 20 -> 188 with two doublings), mines 2.6 in S3 rising to 10
by score ~1000, coins 7-9 through S4 then thinning to ~4 (+ chicane gold ~4).
**Known residual:** experts still hit a reaction-time wall at S10-S11 (death 63% / 77% per
sector, was 100% at S7-S8). A slower `stalLenFrac` leg and a slower chicane-probability
ramp were both tried and measured as no-ops, so the lever left is speed itself.

Two bounds functions:
- `boundsAt(wx)` - includes coin bonus - used for rendering AND collision
- `boundsBase(wx)` - base only (no bonus) - used only for placing coins safely

### Stalactites
Triangle-shaped obstacles from top or bottom wall. Accurate triangle-circle collision (not AABB).
Paired stalactites (chicane from both sides) appear after `_prog > 0.40` with 24% chance.

**Falling stalactites** (`FALL_LEAD`/`FALL_SPAN` in `constants.js`, `fallSpacing()` in
`world.js`, `stalFallY`/`updateFallingStals` in `systems.js`): from world-x 7800
(~score 130, `nextFallWx` set in `startPlay`; the first one actually lands a bit later,
~score 160, since the cursor flags the next *single* non-chicane ceiling spike after it),
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

### Boulders
Large static rounded rock (`src/systems.js` `makeBoulder`/`maintainBoulders`, from
world-x 6620 / ~score 110 since the 2026-09-13 safe opening flight (was 5100 / ~85), `boulderSpacing()` in `world.js` - a sparse set-piece cadence,
floor 2400px). Unlike a mine it is telegraphed by sheer size and **never spans the corridor**: radius is bounded (`R <= min(halfGap - 2.6*PR, 0.26*halfGap)`)
and the centre is nudged a seeded amount toward one wall, so there is always a pass above
AND below - one easy, one a squeeze. It asks "commit up or down" rather than "react".
Circle-circle collision (`update.js`), same shield-absorb + shove-clear as a mine. Bombs
clear boulders; player bullets just spark off (solid rock, not a destructible hazard).
Seeded via `_deepHash`, no `rng()`-stream impact.

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

### Cannons
Rare wall-mounted artillery turret (`src/systems.js` `makeCannon`/`maintainCannons`/
`updateCannonShots`), first appearing at wx=7000 (score ~117, was 6000 before the 2026-09-13 safe opening flight) and spaced far apart
(`cannonSpacing()` in `src/world.js`, floor 1200px vs. every other obstacle's sub-300px
floor) - a rare set-piece, not a recurring hazard. Each cannon is inert (not solid, can't
be flown into) until the player closes to within `CANNON_FIRE_LEAD` world-px, at which
point it fires exactly one diagonal shot toward the opposite wall and goes dormant.
Shots reuse the player's own bullet sprite (`drawProjectile` in `src/systems.js`) so a
cannon shot reads as literal enemy fire, not a different weapon type - only its diagonal
angle (vs. the player's always-horizontal bullets) tells them apart. Same hitbox
trade-offs and shield-absorb behavior as mine collision; player bullets destroy a shot
in flight the same way they destroy a mine.

**Barrel, shell nose and exit line share one axis - the TUNNEL frame** (12.0, do not
switch to screen velocity). The barrel used to be pinned at a hardcoded `dir * 0.55`
rad while the sprite rotated by world velocity, so gun and shell disagreed. A first
fix aimed both along the shot's **screen** velocity (`s.vx - scrollSpd()`): each looked
right in isolation, but the gun is bolted to the tunnel and scrolls left faster than its
own shell, so the shell visibly peeled away from the muzzle almost broadside to its nose
(~118 degrees off, reported from play). Now `updateCannonShots` aims everything along the
shell's **world** velocity (`c.aimUX/aimUY`, sprite `atan2(s.vy, s.vx)`); before firing,
`draw.js` aims at the nominal mid-span shot. Since `scrollSpd()` outruns the closing
speed at every cannon depth, that axis leans down-and-away from the player - the player
flies into the falling shell. Measured: barrel = nose = motion relative to the gun at
every sampled cannon (49/-32/23/20 degrees).

The shot spawns at the barrel's **muzzle** (`CANNON_BARREL_LEN`, shared between
`draw.js` and `systems.js`), sliding the start along that same world line and slowing
the shell by exactly the barrel length over the flight, so the endpoint and arrival time
(`CANNON_SHOT_TRAVEL`) match a pivot launch - measured 1.43-1.45s to reach the player
against the 1.45 target, so the tuned warning window does not move.

One invariant this relies on, checked rather than assumed: `rngCannon()` is drawn both
by `makeCannon` (at the spawn horizon) and by `updateCannonShots` (at fire time) on the
same stream, which would fork the cave per player if the two could interleave
differently. They can't - a cannon spawns at `scrollX = wx - 1256` and fires at
`scrollX = wx - 803`, and `cannonSpacing()`'s 1200px floor is wider than that 453px
window, so the order is always spawn-N, fire-N, spawn-N+1. Measured identical across
17 cannons for two pilots with different scroll histories on the same day.

`makeCannon`'s placement veto is **same-wall and geometric** (`PLACE_CANNON_R +
placeStalW`), not the flat 140px both-walls test it started as - see the
`SPAWN_AHEAD_*` discussion under Cross-device fairness for why that flat radius could
never be satisfied past the plateau, and why the wall (`isTop`) is now drawn before the
retry loop rather than inside the winning branch.

**`CANNON_SHOT_TRAVEL` raised 1.15 -> 1.45 in 12.0 (`CANNON_FIRE_LEAD` untouched).** A
red-team simulation flagged cannon shots as the weakest-telegraphed hazard in the game -
every other obstacle is visible on screen well before the final dodge (`SPAWN_AHEAD_*`),
but a cannon's shot doesn't even exist until `CANNON_FIRE_LEAD` world-px out, and its
vertical span is freshly rolled from `rngCannon()` at that exact instant, so its whole
warning window IS its flight time. Measured across a pooled 800-run/20-day sample (same
expert-tier pilot, same seeds, before/after only `CANNON_SHOT_TRAVEL` changing): the
share of cannon deaths already unavoidable more than a human reaction-time (0.25s)
before impact fell from **19.4% (n=31, worst of every hazard type, including
stalactites at 17.9% and walls at 11.5%) to 2.9% (n=34, now the best or tied-best)**;
stalactite (18.1%) and wall (9.7%) numbers barely moved in the same run, confirming the
change is isolated to cannons - `CANNON_SHOT_TRAVEL` only feeds the shot's own vx/vy in
`updateCannonShots`, nothing else reads it. `CANNON_FIRE_LEAD` is deliberately
untouched, so the muzzle still fires from the same on-screen position and at the same
world-x as before (verified live: fires ~587-593 world-px out, matching
`CANNON_FIRE_LEAD` = `W*0.62` either way) - only the shot's closing speed dropped, since
`closingSpd = CANNON_FIRE_LEAD / CANNON_SHOT_TRAVEL`. Cannon rarity/density is
unaffected (`cannonSpacing()` untouched; the pooled sample's cannon-death count, n=31 vs
n=34 out of 800 runs, moved by sampling noise alone, same source as every other
hazard's small day-to-day swing - at the time, the game's one unseeded gameplay
`Math.random()` call was the warp coin's duration roll, which compounded enough over a
long run to shift exactly which runs landed in each rare-death bucket from one sample
to the next. The warp coin and that roll were removed on 2026-09-13).

### Warp portal ("Sog")

Reward set-piece added in 11.0, not a hazard - the game's answer to "reacting" and
"committing" (stalactites, boulders) is joined by a third verb, "escaping". The one
way in is a hoop hanging in the corridor (`makePortal`/`maintainPortals`/
`_makePortalAt`, from world-x `PORTAL_START_WX` = 3000, ~score 50), which calls
`triggerWarp()` (`src/systems.js`) when flown through.

**There is no warp coin any more (removed 2026-09-13, on request).** 11.0 shipped a
second entry point, a violet warp coin on its own 40s real-time clock. After the hoop
redesign its coin-size twin read as an unidentifiable "pill", and the user chose the
hoop alone over redesigning it. Removing it deleted `WARP_COIN_INTERVAL_SEC`,
`nextWarpWx`, its `rngCoin()` draws (so the day's coin stream differs from 11.0, still
identical across devices - `test-cave.js` mirrors it), `T.notifWarp`, and the
`Math.random()` duration fallback in `triggerWarp`. Don't reintroduce it as a coin
without a silhouette that reads at `COIN_R`.

**The ring's cadence is a DUTY CYCLE, not a world-px number** (`portalSpacing()`,
`world.js` - retuned 2026-09-12, do not revert to a progAt-keyed curve). Shipped
11.0 ran `lerp(5200, 2800, progAt)`, and an audit measured it at **one ring every
1-4 real seconds** past score 100 - denser than boulders at every depth, 8-13x more
frequent than the (since removed) warp coin's own 40s clock, and the opposite of the "rarer than a
boulder" intent in its own doc comment. The shape was the error, not just the
scale: spacing *tightened* with depth while `scrollSpd()` climbs, collapsing the
real-time gap twice over. Three things compounded. (1) **The ring needs no aim** -
`portalHitTol` (`update.js`, `PR*3.2`) is wider than the ring's own
+/-25%-of-halfGap jitter at *every* depth, so a player holding the corridor
centreline logged **0 misses in 42.3 crossings**, and the accuracy-based duration
added the same day is therefore near-inert. (2) One full-length warp sweeps
1900-4300 world-px against a 2100-3500 spacing, so a warp carried the player *past*
the next ring and re-triggered before it ended - 185 re-triggers per run. (3) Every
warp exit grants `HIT_INVULN_SEC` on top. Net at a 100% hit rate: **warp live 54.6%
of the run, hazard-immune 75.1%**, and score 2400 reached in 92s instead of 145s - a
**1.58x distance-score rate** on the one metric the shared daily leaderboard is made
of. Same failure the blue coin was retuned for on 2026-09-11, and it breaks the
"mines are the only thing that guarantees no run survives forever" pillar below,
since a warped player cannot be hit by one. The curve is now
`lerp(6500, 10000, progAt) * (1 + 4*prog2At)`: growth keyed to **`prog2At`, not
`progAt`**, because `progAt` saturates at score 233 and every flat-widened candidate
therefore left ring #2 past score 250 - which per the leaderboard audit (median
daily best 70, highest ever 169) means most players would see exactly one ring ever,
the same mistake that had boulders at 84000. Measured now: one ring per
11s/12s/19s/28s/44s/46s across the score bands, rings at score ~47/161/274/455,
warp live 5.7%, hazard-immune 11.0%. Re-measure the duty cycle, never the world-px
number, before moving this again.

**Look: a tall hoop the ship threads ("Reif", 2026-09-13, do not go back to flat
ovals).** The 11.0 ring was two wide, flat, counter-rotating ovals drawn entirely
before the ship: it read as a spinning disc you fly *over*, had no direction, sank
into the violet Ianthe (Friday) rock, spent two `shadowBlur`s, and was drawn at only
0.52x the height of its own hit window. Now `draw.js` draws a tall ellipse (height =
`Math.max(p.r, PR*1.6)`, exactly `portalHitTol`) in two passes: glow, flow lines and
the far arc before the player, the near arc plus a chase light after it
(`_portalBand`), so the ship visibly flies through. Stacked soft strokes with a
near-white core replace `shadowBlur`; the core is what keeps it legible on violet
rock. A used hoop widens as `usedFade` runs out. While a warp is live, white speed streaks sweep the whole tunnel
(`WARP_STREAKS`, alpha riding `warpScrollFactor()`), placed from `scrollX` plus
`_rockHash` - stateless, no `rng()`. Design proposals:
https://claude.ai/code/artifact/7fab90a9-4ad8-4729-a1d6-04d56d49ddd8

Two follow-ups from the same audit. **The ring's hit window is its own drawn radius**
(`update.js`, `Math.max(p.r, PR*1.6)`, was a flat `PR*3.2`): 55px of window against a
~39px ring meant you could take a warp while visibly outside it, and `accuracy`
measured off a phantom circle - a rim graze scored ~0.7. Keying it to `p.r` makes the
window the picture and the accuracy gradient span it honestly. Measured a balance
no-op (0 centreline misses before or after, floor never binds at any shipped H) -
forcing a *real* aim would need a smaller ring plus a much wider jitter, which is a
look-and-feel redesign for a playtest, not an audit fix. **A warp-vacuumed coin banks
in full but does not raise the combo** (`systems.js`, the `warpVacuum` branch): one
ring auto-collects every gold coin on screen, and letting those increment normally let
the combo's quadratic term manufacture 11-54 bonus points per warp - worst at LOW
score, where gold's share is 76%. Against a median daily best of 70 the first ring
alone (score ~47, which every player reaches) was worth about as much as the whole
rest of a typical run. Now 17 points cold, and a combo you *earned* before arriving
still pays on every vacuumed coin - that part is skill and is kept deliberately.

For `WARP_DUR_MIN..MAX_SEC`
(~1.1-1.6s) real seconds: `scrollSpd()` is multiplied by `warpMult` (`state.js`,
rolled once at trigger time from `WARP_MULT_MIN..MAX` (2.2-2.8x) against the
player's own live `_prog2` and held fixed for the whole warp - deeper run, stronger
sog, same "never just endurance at a fixed pace" philosophy `scrollSpd()` itself
follows, capped at `_prog2 >= 1` like most per-run knobs since `scrollSpd()`
underneath it keeps climbing forever regardless of where this ratio caps).
`world.js warpScrollFactor()` is the mirror image of `slowScrollFactor()`, folded
into the identical five call sites. The corridor widens (`WARP_GAP_MULT`, eased through
the same `gapBonusVisual`-style channel, `boundsAt()` only, never `boundsBase()` -
same "no placement decision may depend on a player state" rule gapBonus already
follows), every stalactite/mine/boulder/cannon-shot is skipped entirely (drawn ghosted
at `warpFade` opacity, `src/draw.js`), and every gold coin on screen is auto-collected
into the combo (`checkCoinCollection`'s `warpVacuum` check, systems.js) - power-up
coins still have to be flown to and hit normally. The background music surges with it
(`audio.js bgmSetWarp`, the mirror image of `bgmSetSlow` - same `_bgmNode.playbackRate`
rate, so the two are mutually exclusive in practice, which is fine since both are
short and rare): a quick ramp to 1.35x on trigger, gliding back to 1.0x as the window
runs out. Deliberately far under the warp's own 2.2-2.8x - that range is a gameplay
scroll speed, not an audio pitch target, and a whole track played back that fast stops
reading as "faster" and starts reading as a chipmunked mess.

**Exiting a warp grants `HIT_INVULN_SEC` of the same grace window a shield-absorbed
hit or a revive already gets** (`update.js`, the `warpTime` falling edge) - `Math.max`
against whatever's already running, never a shortening. Coming out of a warp drops the
player back into full collision at whatever speed/position the surge left them at,
with the corridor still easing back in from `WARP_GAP_MULT`-wide (`warpWidenVisual`) -
a hazard could already be uncomfortably close the instant collision solidifies again,
so the same clamp-not-kill/pass-through convention the shield window uses covers the
transition. This is the reuse `constants.js`'s own `HIT_INVULN_SEC` doc comment
already anticipated ("a future rewarded continue reuses the same timer") - not a new
constant.

**Deliberately real seconds, not a world-px distance.** Nothing about a warp is a
placement decision - no `rng()` draw, nothing any other player's cave depends on - so
it is exactly the same category of per-player effect the blue coin's `slowTime`
already is, not a cross-device-fairness concern. `scrollX` still advances one `dt` at
a time through the ordinary `maintain*()` while-loops; a warp is just a few real
seconds of a bigger step per frame; the loops already have to backfill an arbitrary
jump (a backgrounded tab does the same thing) so nothing about them changes for this.

**The wall is never a warp-caused death, by construction, not by tuning.** At the
corridor wave's peak slope, the warp's faster drift can in theory outrun `MAX_VY`
(a measured ~45% of `MAX_VY` already at the difficulty plateau, unwarped, before even
`WARP_MULT_MIN` is applied). Rather than hand-tuning `WARP_GAP_MULT` against a moving
target (wave amplitude/frequency both still climb with `_prog2`, and now `warpMult`
does too), `update.js`'s wall-collision check treats `warpTime > 0`
exactly like `invulnT > 0` (the shield-absorbed grace window): clamp the ship back
inside the corridor instead of killing it. `WARP_GAP_MULT` only decides how much of
that clamping the player actually feels, never whether a warp can end in a wall death.

**Portal placement reuses the coin contract, not a bespoke geometric veto.** The
ring's *drawn* radius (`PORTAL_R_FRAC` of the corridor's halfGap at that wx) is
spectacle; only its centre point has to be provably flyable, and that question is
already answered for every coin in the game by `coinBlockedByStal()` - reused directly
in `_makePortalAt` rather than reinventing per-spike chord math. A bespoke flat/
geometric veto is exactly the mistake that nearly wiped out boulders and cannons (see
the `SPAWN_AHEAD_*` discussion above); reusing the coin contract sidesteps it because
coins already place successfully at every difficulty without one. `PORTAL_RETRY_OFFSETS`
follows the same retry-on-veto pattern as mines/cannons/boulders regardless.

The portal ring itself triggers on an **x-crossing test**, not a circle-overlap test -
same reasoning as the falling-stalactite landed check and the cannon fire lead: a
fast-scrolling frame can jump the player's world-x past a thin ring in one step, a risk
that only grows once `warpScrollFactor()` itself can be live.

**Flying the ring's centre is rewarded with a longer warp** (`update.js`'s
x-crossing check, `triggerWarp(accuracy)`) - a dead-centre pass earns the full
`WARP_DUR_MAX_SEC`, a graze along the hit tolerance's edge only `WARP_DUR_MIN_SEC`,
linearly in between. This reuses `WARP_DUR_MIN..MAX_SEC` rather than adding a new constant pair; only
*where in the range* a given warp lands changed, not the range itself.

### Coin system
**Gold coins bank no `gapBonus` during the safe opening zone** (score < 50,
`SAFE_START_WX`, `checkCoinCollection`'s gold branch in `systems.js`, 2026-09-13 on
request) - walls there are already pushed to the screen edges (`safeOpenAt`), so a
gold pickup widening the corridor further is invisible in the moment and only pays
off as a bonus already sitting near its cap the instant the zone ends and hazards
start (`HAZARD_START_WX`). Points, combo and shard banking are unaffected - only the
`gapBonus +=` is skipped while `scrollX < SAFE_START_WX`.

Coins collect into `gapBonus` (extra halfGap px, capped, decays over time). Since 12.0
all three magnitudes are **fractions of the corridor's own half-gap, not of `H`**
(`constants.js`, accessors `gapPerCoin()` / `gapBonusMax()` / `gapDecay()` in
`world.js` next to `refreshWave()`):
```javascript
const GAP_PER_COIN_FRAC  = 0.075 / 0.43;   // bonus halfGap added per coin
const GAP_BONUS_MAX_FRAC = 0.19  / 0.43;   // cap: max halfGap bonus
const GAP_DECAY_FRAC     = 0.015 / 0.43;   // bonus lost per second
```

**Why they stopped being absolute (do not revert).** A fixed number of px added to a
base corridor that shrinks `H*0.34 -> H*0.163` is a curve-flattener by construction,
and a red-team replay measured exactly that. The bonus is easy to hold - chicane gold
sits on the corridor centreline, i.e. the line the player already flies, so collecting
it costs no detour - and an expert holds it at ~66% of cap for the whole run. Measured
widening of the corridor by score band, same pilot, same seeds, before vs after:

| band | 0-25 | 25-50 | 50-100 | 100-233 | 233-500 | 500-900 | 900+ |
|------|------|-------|--------|---------|---------|---------|------|
| before | 1.00x | 1.16x | 1.36x | 1.55x | 1.79x | 1.99x | **2.01x** |
| after  | 1.00x | 1.14x | 1.32x | 1.42x | 1.42x | 1.41x | **1.40x** |

Before, the reward grew steadily with depth until it doubled the deep corridor - the
corridor the pilot actually flew narrowed only 10.6 -> 8.6 ship diameters against a
designed 11.0 -> 4.2. After, the widening is flat from score 100 on (the early rise is
just the bar filling from empty), and the flown corridor narrows 10.6 -> 5.9. A run's
corridor is now the base curve TIMES a constant instead of PLUS one, so the shape the
difficulty curve was designed to have is the shape that gets flown.

Two properties make this safe, both asserted in `test-math.js`:
- **The fractions are anchored so wx=0 reproduces the old absolute values exactly**
  (`halfGapAt(0)` = `H*0.43`, hence the `/0.43`). Score 0 is a byte-exact no-op and the
  band real runs actually end in barely moves: the `average`-tier median was 22 before
  and 22 after, mean -2%. Deep runs are where it bites - expert mean 625 -> 459, p90
  1543 -> 1092. Same standing rule as the 2026-09-11 pass: only the deep run may get
  harder.
- **All three scale together**, so every ratio between them is depth-independent: still
  2.53 coins to fill the bar from empty, still 0.2 coins/sec to hold it at the cap. The
  supply economics `CHICANE_GOLD_GAP_SEC` and `POWERUP_MIN_GAP_SEC` were tuned against
  are untouched; only the px magnitude tracks the corridor the bonus is a bonus ON.

They scale off `_gapRef` (`world.js`), which is the base difficulty curve **without**
`deepChamberAt` - a chamber is a transient local breather, not a difficulty level, and
letting the cap balloon 2.1x on entering one would only snap it back on the way out.
`update.js` also clamps `gapBonus` down to `gapBonusMax()` every frame, so a bonus
banked in a wide stretch gives ground as the corridor narrows under it.

`DEEP_DECAY_PEAK` (the deep decay ramp, `update.js`) was expected to need lowering once
the magnitudes scaled - it doesn't. Swept at 1.0 / 1.6 / 2.5 and 25.0 over 100 expert
runs each, the held bonus moved 0.850 -> 0.849 -> 0.821 and the per-band corridor not
at all: coin **supply** refills the bar far faster than any of those rates drain it, so
decay is no longer the binding constraint, the cap is. Left at 2.5 rather than re-tuned
on a guess. If the deep run needs tightening again, the lever is supply or
`GAP_BONUS_MAX_FRAC`, not that ramp.
**Chicane gold is gated in SECONDS, not world-px** (`CHICANE_GOLD_GAP_SEC`, flat at
every depth since `CHICANE_GOLD_EARLY_MULT` was deleted on 2026-09-13, in `constants.js`, `worldPxForSec()` in `world.js`, applied in
`maintainStalactites`). Deep, `stalSpacing()` sits on its 50px floor at a 0.62 chicane
probability, so nearly every chicane wants to drop a centred gold coin right on the line
the player threads anyway. A flat 30px gate gave ~7/sec; the 340px gate that replaced it
still measured **2.09/sec** in the deep run, because a fixed distance keeps shrinking in
seconds as `scrollSpd()` climbs forever. Against the ~0.2 coins/sec that holds `gapBonus`
pinned at its cap, that was a 10x oversupply - and the measured consequence was that the
*effective* half-gap ran flat at ~0.34*H for the entire run, i.e. **the whole 0.34 ->
0.163 narrowing was cancelled out and the corridor never actually got tighter.** A time
gate is flat in coins/sec at every depth by construction. Two implementation constraints:
it must use `worldPxForSec()` (the W-independent speed) and NOT `scrollSpd()`, or the
cave forks by screen width and the shared daily seed stops being shared; and it is gated
on `lastChicaneCoinWx` (`state.js`), not on the tail of the live `chicaneCoins` array,
which is culled behind the player and so silently capped any gate wider than ~1700px.
Measured result across 8 day-seeds at a 50/70% collection rate: median free channel at a
stalactite now falls 9.4 -> 7.5 -> 6.7 -> 5.5 -> 3.6 -> 2.1 player diameters across the
score bands, against a flat ~5-7 before. The base decay rate was deliberately NOT raised
to achieve this (it would have narrowed the score 25-233 corridor too); the deep end is
handled by the pre-existing `_deepDecay` ramp in `update.js`, which is inert until 233.

`gapBonus` itself still jumps instantly on pickup (systems.js), but collision and
rendering never read it directly - they read `gapBonusVisual` (update.js), which
chases `gapBonus` at a constant `GAP_EASE_RATE` px/s instead of snapping to it. That's
what makes the wall visibly widen rather than teleport, and because the same lag
applies on the way down once the decay starts pulling the target back in, smoothing
this also nudges the corridor's total "wide" window a little longer, not just its
onset. Wall glow shifts purple → cyan when bonus is active. Gold bar at bottom shows
remaining bonus - both keyed off `gapBonusVisual` too, so what's shown always matches
what's actually collided against.

**Off-screen wall warning strip** (`draw.js`, added in 12.0, right after the wall-edge
glow it sits alongside): a maxed `gapBonusVisual` can push the corridor edge past the
canvas entirely (`boundsAt().top < 0` or `.bot > H`) - `centerAt()`'s clamp only keeps
the corridor centred *inside* `_halfGap`, it has no idea the bonus is about to widen the
edge straight off the screen. When that happens the wall polygon fills nowhere on
screen for that column, but the player can still die there: `update.js`'s SECOND
collision check (`py - cPR < 0 || py + cPR > H`) is screen-anchored, not corridor-
anchored, and fires whenever the (invisible, far-off-screen) corridor check can't -
found by a red-team audit as the game's one systematic source of "the wall I died on
was never drawn" deaths (27-55% of play-frames past score 25, depending on skill tier).
The strip is purely visual (a pulsing warm-red band right at `y=0`/`y=H`, only over the
x-ranges where that column is actually off-screen) - `boundsAt()` and the collision code
above are untouched. It reads as a hazard-warning colour distinct from the wall-glow's
purple/cyan bonus indicator on purpose: one says "the bonus is active", the other says
"the edge you can't see is live right here.

### Difficulty scaling functions

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
~86% of screen height), smoothstepped down to 0 by `EARLY_WIDEN_WX` = 12000 (~score 200)
so it rejoins the hand-tuned base curve exactly, with no kink, before the difficulty
plateau at wx=14000. Added in both `refreshWave()` and `halfGapAt()` so rendering/
collision (`boundsAt`) and placement (`boundsBase`, via `halfGapAt`) agree - same pattern
as `deepChamberAt`.

### Deep-run variety (score ~150+, do not revert)

Past `_prog2 = 1` (score ~900) every corridor geometry knob is capped and only
`scrollSpd()` moves - so a five-digit run was one variable, speed, getting twitchier
against a frozen corridor. `DEEP_VARIETY_WX` (the switch-on point for the shape morph,
chambers, deep coin-line shapes and the palette drift) was **moved 54000 -> 30000
(score ~500) on 2026-09-11**, same leaderboard argument as the Boulders section: at
54000 none of it had ever been seen. **Moved again 30000 -> 9000 (score ~150) in
12.0** - a red-team simulation (2400 runs across 4 calibrated skill tiers) found the
real leaderboard sample's own tier reached wx 30000 in exactly 0% of 600 runs: same
mistake, one order smaller. At 9000, a tier just under real players' best runs reaches
it in 24.7% of runs, one step better (expert) in 63.5% - see the doc comment above
`DEEP_VARIETY_WX` in `world.js` for the full numbers. It is safe at any value because
every one of those features is bounded *relative to the same wx unmorphed* (the
`test-math` energy guard holds at any wx, and chambers only ever widen). Two things
deliberately did NOT move with it: the **speed pulse** (still gated on `_prog2 > 1` in
`scrollSpd()` - surging above a still-ramping trend is a different proposition from
surging above a flat one) and the **apex-biased mines**, which keep their own
`DEEP_APEX_WX` = 54000 because that one is flagged below as an unplaytested fairness
risk.

**Moving `DEEP_VARIETY_WX` earlier exposed two latent bugs that moving it back
wouldn't have fixed - both are now fixed, not worked around:**
1. `deepMorphAt` jumped straight from the inert `{a1:1,a2:1}` to a fully-hashed
   character in a single world-px at the `DEEP_VARIETY_WX` boundary itself - a real
   seam that the existing "continuous across character boundaries" guard in
   `test-math.js` never sampled (it starts checking a few hundred world-px past the
   boundary, well after the jump). At wx=30000 this sat deep past every boulder that
   was ever placed there, so it went uncaught; at wx=9000 it landed right in active
   boulder territory and `test-cave.js`'s boulder-pass-safety check caught it as a
   sealed pass. Fixed by giving segment 0 its own entry ramp - the same 30%-of-
   wavelength blend every later segment already spends blending OUT, spent blending
   IN instead - which keeps `wx <= DEEP_VARIETY_WX` exactly inert (nothing at or below
   the documented switch-on point moves) while making everything past it seamless.
2. `test-cave.js`'s own boulder-safety check had a second, independent bug: it
   extracted `boundsBase`/`placeStalW` from one `makeWorld()` sandbox that never had
   `startRun(day)` called on it, so it validated every day's boulders against
   world.js's bare load-time defaults (phase 0, jitter 1, archetype 0, `_deepHash`
   seeded off day 0) instead of that day's real seeded state - the portal check right
   below it already re-seeds per day and was never affected. This test bug is what
   turned bug #1's tiny, already-fixed seam into a false "2 boulders sealed" failure
   in the first place; both are fixed now, and `node test-cave.js` shows 0 sealed
   passes across the full DAYS sample either way.

Two additions in `world.js` (all `DEEP_*` consts + `_deepHash`
+ `deepMorphAt`, gated by `_deepVarietyOn`) give the deep run a changing shape and pace
without touching the navigability caps:

- **Shape morph** (`deepMorphAt`, folded into `refreshWave` and `boundsBase`): past
  `DEEP_VARIETY_WX` the two corridor waves' **amplitudes** are rescaled by a seeded
  per-day sequence of characters (`DEEP_CHARS`: even / sweeps / chop / near-straight),
  each holding `DEEP_CHAR_WAVELEN` world-px then smoothstepping into the next. The a1/a2
  splits are picked so `wA1*wF1 + wA2*wF2` (peak corridor velocity) never exceeds ~1.02x
  the same-`wx` unmorphed value - a different *ride*, never more wiggle-energy than
  today. **Frequencies are deliberately left untouched**: changing the frequency of
  `sin(wx*f)` at large `wx` scrambles accumulated phase and needs a phase-integral
  rework (a later phase if wanted). `test-math.js` guards inertness below the plateau,
  the <4% energy ceiling across 40 day-seeds, and boundary continuity.
- **Speed pulse** (in `scrollSpd()`): past `_prog2 > 1`, a seeded swell of up to
  `+DEEP_PULSE_AMP` (12%) **above** the trend over `DEEP_PULSE_WAVELEN` world-px
  (`swell = 0.5 - 0.5*cos(...)`, in `[0,1]`), so the deep game surges and eases back.
  It is **surge-only - it never dips below the trend** (was `±8%` around the trend
  until 2026-09-08, i.e. half of every cycle the deep run decelerated, which reads as
  the game getting easier). Because each breath's trough sits exactly on the trend and
  the **trend itself is untouched and still climbs forever** ("scrollSpd never
  plateaus"), every successive breath is faster than the last - the speed envelope
  only ever rises; only the within-breath ease-back varies.

- **Chambers** (`deepChamberAt` in `world.js`, `DEEP_CHAMBER_PERIOD`/`DEEP_CHAMBER_PEAK`):
  a rare seeded world-x window (~55% of 15000px periods) where the half-gap balloons to
  `DEEP_CHAMBER_PEAK` (2.1x) on a sine bump then settles back - a breather, never a
  hazard (wider is always navigable). Applied to `_halfGap` in `refreshWave` **and**
  `halfGapAt()` so `boundsBase` / coin+mine placement follow the room. The sub-window
  never touches a period boundary, so the factor is always 1 (continuous) at the seams.
  This is the one thing that legitimately breaks "the corridor only ever narrows" past
  the plateau, by design.

Everything above (morph, pulse, chambers) is a pure function of `scrollX` + `_deepDay`
(captured in `seedDailyVariety`, independent of the `rng()` obstacle stream and the
`h`-chain), so every player flies the identical sequence and the scrollX-indexed ghost
stays locked. `_deepVarietyOn` (default true) is the master kill switch for all of it.

**Phase 3** (also `_deepVarietyOn` / `_deepHash`, all past `DEEP_VARIETY_WX`):
- **Coin-line shapes** (`makeCoin`, `src/systems.js`): deep coin `y` follows a seeded
  slow sine arc per ~3200px band instead of scattering independently - a line to follow.
  `rng()` is still consumed so coin *types* are unchanged; only positions move.
- **Palette drift** (`draw()`, `src/draw.js`): past `_prog2 > 1` the wall / stalactite
  *glow* (`wallBase`/`stalEdge`) lerps toward a cool deep tint, capped at 0.30. Base rock
  colour and the daily identity are untouched. Subtle on purpose.
- **Apex-biased mines** (`makeMine`, `src/systems.js`, flagged): at a genuine bend apex
  (`centerAt` neighbours both on one side) ~60% of mines snap toward the centreline -
  where the corridor shape already forces the player. Same count/speed. **Watch in
  playtest for a "the game is cheating" read** - cut it if it feels unfair.
- **Boulders**: see the Boulders section above.

### Coin type progression

Coins are staged by `_prog` so power-ups introduce gradually:
- score 0-11 (_prog < 0.22): gold only (gap bonus)
- score 11-33 (_prog 0.22-0.38): + blue (slow time: scroll sags to 0.6x on pickup then ramps back to full over ~4s - see slowScrollFactor)
- score 34+ (_prog >= 0.38): the weighted ladder switches on
- score 50+ (S1, `RED_START_WX`): + red (shield, absorbs 1 hit)
- score 111+ (S2, `ORANGE_START_WX` / `GREEN_START_WX`): + orange (bullet ammo) + green (magnet)
- score 178+ (S3): bomb clock; S8 (583+) poison; S9 (677+) drain - see "Flight plan (sectors)"
  (red was 34, orange 34, green 71, bomb/poison/drain 34 until 2026-09-13)

**Power-up SUPPLY is paced in real seconds, not just by weighted share**
(`POWERUP_MIN_GAP_SEC` / `POWERUP_GAP_EARLY_MULT` in `constants.js`, enforced in
`makeCoin`; `blueClock`/`redClock`/`greenClock` in `state.js`, ticked in `update.js`).
A measured replay audit (2026-09-11) found every capped power-up pinned at its ceiling
once a run got deep - shield stack full 87-100% of the time from score 233 on, slow-time
active 38-85% of the run. The *durations* were never the problem (4s per blue coin, 3s
per magnet are short); the weighted roll simply has no notion of real time, so as
`coinSpacing()` tightens and `scrollSpd()` climbs, every type's coins-per-second climbs
with them. Three rules, all load-bearing:
- A vetoed power-up coin is **skipped entirely** (`makeCoin` returns `null`), never
  downgraded to gold - downgrading would hand the suppressed share to gold and re-break
  the corridor bonus (below).
- The floor **scales in with depth**, so it is a measured no-op below score 233. That
  band is where real runs actually end; this pass is only allowed to make the deep run
  harder. Same rule governs the `makeMine` retry.
- The check sits **after** the poison/bomb/drain overrides, so a ready hazard is never
  delayed by an unrelated shield veto and the hazard `rng()` stream is untouched.
- **Orange (ammo) is deliberately exempt.** Bullets auto-fire every 0.32s
  (`updateBullets`), so a 5-shot pickup drains itself in 1.6s - there is no stock to
  pin, and measured with firing modelled the player is armed only 2-9% of the run at
  every depth. An earlier pass of the audit called ammo "pegged at 10/10"; that was a
  modelling error, not a finding. `test-math.js` guards the exemption.

The values are FLOORS, not the resulting cadence - the type still has to win the
weighted roll afterwards, which adds ~4-6s deep. Pick a floor by subtracting that from
the cadence you want, then re-measure.

Mines first spawn at `MINE_START_WX` = start of sector 3 (score ~178; was 1800 / ~30, then 6400, then 12000 on 2026-09-13). Shield coins unlock in sector 1, so a player has shields available before meeting the first mine.

Gold's share isn't just "whatever's left after the other types' shares" - it also
gets an explicit extra cut as a run goes deeper (`GOLD_DEEP_DECAY` in
`src/constants.js`, applied in `makeCoin`, `src/systems.js`), phased half over the
score 34→233 ramp (`t`) and half over the score 233→900 marathon (`_prog2`), so gold
keeps thinning out long after `t` maxes at score 233 instead of holding flat. The two
legs are redistributed differently (retuned 2026-09-11, replacing one blended
`goldDecayT` fed through a single proportional split): the t-leg still spreads
proportionally across whichever of blue/orange/green are already active - never a
flat leftover-to-green fallback, which would otherwise bend green's score-71 gate
open early - but the `_prog2` leg goes to green alone, since red/blue/orange are all
flat past score 233 (matching red's own ramp, which is t-only) while green is the one
type designed to keep growing through the marathon. The single-split version let every
capped power-up (red's stack cap, blue's slow-time duration, orange's ammo cap) drift
past its documented ceiling by the deep-run plateau - red was hitting ~26% against its
21% cap - a real player complaint ("too many shields").

**Coin/power-up audio** (`audio.js`): the pickup sounds carry a loudness hierarchy -
gold and blue (slow) sit at their base level; red (shield), green (magnet) and bomb are
rare, run-defining grabs and sit ~2 dB hotter with a touch more tail (shield also gets a
low body layer). Two effects are *states*, not one-shots, so they stay audible for their
whole duration: blue sags the background music to 0.6x playback rate then *glides* it
continuously back up to 1.0x across the whole slow-time window, landing on normal speed
as the effect runs out (`bgmSetSlow(true, slowTime)`, riding `_bgmNode.playbackRate` so
pitch sags and recovers with it - that ramp is the effect); a second blue coin restarts
the glide from the current rate over the new topped-up duration. **The gameplay scroll
speed follows the identical curve** (`slowScrollFactor()` in `world.js`, multiplied into
`scrollSpd()` in `update.js`, into the speed-line intensity in `draw.js`, and into both
projectile integrations in `systems.js` - the player's own bullets in `updateBullets`
and the cannon shots in `updateCannonShots`, so during bullet-time nothing streaks
through a slowed tunnel at full speed) - the blue coin is a decelerate-then-recover
swoop, not a flat half-speed plateau, and tunnel, projectiles and soundtrack speed back
up together. `slowTimeMax` (state.js, captured at each pickup in `systems.js`) is the
window the ramp lerps over. The **stack cap was cut 8.0s -> 6.0s** on 2026-09-11
(ELECTRIC's 12/15 scaled with it to keep its documented +50%): slow-time measured
active 38-85% of the run past score 233, which makes the blue coin the baseline pace
rather than a rescue and works directly against the "`scrollSpd()` never plateaus" rule
below. The 4.0s **per coin** is untouched - the swoop is the mechanic; what changed is
how far a streak of them can run the window out. Blue also carries a
`POWERUP_MIN_GAP_SEC` floor (see Coin type progression). Green runs a faint
ambient shimmer loop while the magnet is live (`magnetLoopOn`/`magnetLoopOff`, same
at-most-once guard pattern as the thruster / onFire loops). Both are driven ON from the
pickup branch in `systems.js`; the magnet loop is turned OFF from `update.js` on the
falling edge of `magnetTime`, and `bgmSetSlow(false)` fires there too (plus
`startPlay`/`die`) purely as a belt-and-braces snap-home in case the glide and the
gameplay timer drift.

**Poison/bomb/drain rarity**: all three unlock at score ~34+ (`_prog >= 0.38`, same
gate as red/orange; since 2026-09-13 their first clock target also counts from
`HAZARD_START_WX`, so in practice none lands inside the safe opening flight) and are driven by a real-time clock (`drainClock` mirrors
`poisonClock`/`bombClock` exactly; see the Drain coin section below), not a
per-coin-candidate percentage
(`poisonClock`/`bombClock`, `state.js`, incremented every play-frame in `update.js`).
An earlier version rolled a percentage per coin *candidate*, derived from a target
hits/sec so the cadence wouldn't accelerate with difficulty - correct in principle, but
it silently assumed every candidate becomes a real coin. It doesn't: `coinBlockedByStal`
(`src/systems.js`) rejects candidates too close to a stalactite, and a live replay of a
real daily seed measured ~90% rejection, varying with difficulty/chicane
density/day archetype - so the actual cadence players saw was ~10x rarer than intended
and drifted with conditions no formula could predict. The clock model sidesteps that
entirely: once `poisonClock`/`bombClock` passes its jittered `nextPoisonAt`/`nextBombAt`
target (`POISON_INTERVAL_SEC`/`BOMB_INTERVAL_SEC`, `src/constants.js`), the *next coin
that actually clears placement* (i.e. reaches the end of `makeCoin()`) becomes that type
- immune to rejection rate, day archetype, and screen width by construction. Targets are
~20s poison / ~16s bomb, retuned down from an original ~55s/45s guess after checking
against how long runs actually last: a live replay of today's seed found a "good" run
(score ~300) takes only ~20-36 real seconds end to end at realistic phone widths, and
even a "great" run (score ~1000) is only ~54-97s - both far shorter than assumed, so the
original interval meant many runs, especially on wide screens (scroll speed scales with
W), saw literally zero of either. Bomb is deliberately a little more frequent than
poison - a reward landing at least as often as a punishment reads more generous.

**Poison coin**: hazard coin, deliberately NOT a recolored gem. Every legitimate coin
shares one render path (faceted diamond, smooth single-sine pulse, bright sparkle rays)
so poison breaks from it entirely (`isPsn` branch in `src/draw.js`'s coin loop): a
jagged 7-point spore silhouette with per-point jitter (organic/unstable outline instead
of a clean facet), an irregularly-strobing glow (two mismatched sine frequencies instead
of the shared calm pulse), two dripping ooze tails, and a dark X on top - shape and
motion register before color does, so recoloring alone (its first version) wasn't enough
even with the X. Also continuously emits a slow ooze-drip particle while sitting
uncollected on screen (`update.js`'s coin-fade loop), so it visibly reads as "active
hazard" even at a glance, not a static pickup. Color is toxic/acid green ("giftgrün",
`#5fbf00`, deliberately different from the magnet coin's mint `#44ff88`). Touching it
breaks the coin combo and removes a **percentage** of `runCoins`
(`POISON_LOSS_PCT_MIN`->`POISON_LOSS_PCT_MAX`, 12%->15%, `lerp` on `_prog`, `Math.ceil`
so a small pool can't round to a 0-coin no-op) - deliberately punishing rather than a flat
nudge: a %-based tax compounds over repeated hits (survivor fraction ~0.8^N over N hits
at a 20% rate), so a long run that keeps getting careless with poison can lose most of
its pool, not just N x a fixed amount regardless of how large the pool had grown. (An
earlier version used a flat per-hit amount specifically to avoid this compounding -
reverted on explicit request that poison "really punish" someone; see git history on
`POISON_LOSS_MIN`/`POISON_LOSS_MAX` if that trade-off ever needs revisiting.) Comes out
of this run's *pending* shard bank (see Score formula below), never the persistent
`shards` balance directly, so it can only cost progress not yet banked. See
`checkCoinCollection` in `src/systems.js`.

**Bomb coin**: power-up, the opposite of a hazard. Visually a purple gem (`#b833ff`)
with a white 8-point spark mark (`isBmb` in `src/draw.js`, distinct from poison's X even
though both are purple-ish/green-ish). Collecting it triggers a small blast around the
pickup point (`BOMB_RADIUS`, `src/constants.js`) that clears every hazard caught in it:
stalactites fade out the same way a bullet-destroyed one does, mines and in-flight
cannon shots are destroyed outright, and any cannon that hasn't fired yet is disabled.
See `triggerBombExplosion` in `src/systems.js`, called from `checkCoinCollection`'s
`bomb` branch (joins the coin combo and banks toward `runCoins` like any other power-up
- only the two hazard coins opt out of that shared path).

**Drain coin**: the SECOND hazard coin (`'drain'`, wine `#7a2f4f`, `isDrn` branch in
`src/draw.js` - a hollow broken ring with inward barbs that *contracts* on the pulse,
counter-spins, dark punched-out core, heavy downward chevron; poison owns the X). Where
poison debits the *pending shard bank* (`runCoins`, meta progress), drain debits the
*visible run score*: `checkCoinCollection`'s `drain` branch subtracts
`ceil(score * lerp(DRAIN_LOSS_PCT_MIN, DRAIN_LOSS_PCT_MAX, _prog))` (5%->8%) from
`bonusScore`, so the HUD number itself drops. `bonusScore` may now go negative;
`update.js` clamps the displayed `score` at 0, and because the loss is a fraction of a
shrinking number it can never actually reach a negative total. Compounds over repeated
hits like poison's %-loss, and because it is a % of the current score its absolute bite
*grows the deeper the run goes* - deliberately, so the deep run gets harder over
distance. Breaks the combo (`coinCombo = 0`) like poison. Same real-time-clock cadence
model as poison/bomb (`drainClock`/`nextDrainAt`, `DRAIN_INTERVAL_SEC` ~30s - rarer
than poison since it stings more visibly), checked between the poison and bomb clocks in
`makeCoin()` so a ready bomb still wins a triple-ready coin. Magnet-exempt like poison.
`sfxDrain` (`audio.js`) is a downward triangle glissando + bandpassed noise "suck" -
distinct from poison's sour sawtooth squelch so the two punishers sound different.

### Addictive systems

**Score formula**: `score = Math.floor(scrollX / 60) + bonusScore`
`bonusScore` accumulates from coin collection and near-miss bonuses; resets each run.

**Milestone moments**: Triggers at 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600...
Step size widens with score via `milestoneStep()` (`world.js`): 25 up to 100, 50 up to
300, 100 up to 1000, 250 up to 3000, 500 up to 10000, 1000 beyond - uncapped, keeps
growing forever rather than settling into a fixed step (same "never just endurance at a
fixed pace" philosophy as `scrollSpd()`, see its own doc comment).

The 25-point band below 100 was **dropped once and restored in 12.0** - don't drop it
again without new data. The removal argued it "fired 3 milestones before a weak run even
reaches 100", which is true and was the wrong test: it counted milestones per run instead
of asking what share of runs fire one at all. A red-team replay against the real
leaderboard sample (median daily best 70) put actual players at a **median run of 22**,
with only **13% of runs** ever reaching the old first milestone at 50 - **2% within a new
player's first five runs**. The first thing the game had to say other than "dead" sat at
more than twice the distance a typical run covers. The band ends at 100 so everything a
competent run sees is exactly where it was; `test-math.js` asserts the whole ladder plus
that invariant. If this is revisited again, the number that matters is the share of REAL
runs that fire a milestone, not the count a good run accumulates. Originally a
flat +50 step past 100, which meant a strong player blowing past 200-1000 in under a
minute hit a milestone every ~50 points, every one of them already-maxed-out `!!!` (see below) -
noisy repetition, not a reward; widened after that feedback. Shows big floating text +
gold particle burst + ascending chord. `milestoneFlash` decays over ~0.6s.
Text/sfx escalate in 4 tiers (`triggerMilestone` in `input.js`, `sfxMilestone` in
`audio.js`): `!` below 100, `!!` from 100, `!!!` from 200, `!!!!` from 1000 - the 1000+
tier exists so a genuinely deep milestone still reads as a step up rather than the same
maxed punctuation every time from 200 to the top.

**Near-miss bonus**: +1 bonusScore when wall clearance < `PR * 2.0` (within 2 player radii of wall).
1.5s cooldown prevents spam. Shows "+CLOSE" notif + quick ascending ping sfx.

**Coin combo multiplier**: Coins collected within 2s of each other build a streak.
Score pts = `coinCombo * 3` (so x1=+3, x2=+6, x3=+9...). Shows "x2", "x3" notif above gold coin notif.
Blue/red/bomb coins join the streak but their notif doesn't change (power-up is the
reward). Poison breaks the streak outright (`coinCombo` reset to 0) rather than joining
it - see Poison coin above.
The gold pickup sound itself climbs a major-pentatonic step per combo level
(`sfxCoin(coinCombo)`, `audio.js`), plateauing a major-tenth up - the streak is audible
in the coin, not just the separate `sfxCombo` ping (which only fires from x2). Same
"widen the step, never cap flat" shape as `milestoneStep()`.

**Death freeze frame** (`DEATH_REPLAY_SEC` in `constants.js`, `drawDeathFreeze()` in
`draw.js`, `markDeathHit()` in `update.js`, `deathHitX/Y/R` in `state.js`): for the first
0.40s after a fatal hit the death panel does not paint at all. The world is already
frozen (`update.js`'s `dead` branch advances nothing but `deadT`), the wrecked ship keeps
rendering in red, and a reticle contracts onto whatever landed the hit. Added in 12.0:
`deathCause` had existed since the death-marker work but was never shown to the player,
so through 11.0 the death screen's entire answer to "what did I do wrong" was the word
"dead" and a number - against a measured beginner run of 0.9s of flight.

Two things make this **free rather than a tax on restarting**, and both must stay true:
the panel's own alpha is the only thing offset (the button row's `deadT > 0.75` fade and
`input.js`'s `DEATH_INTERACTIVE_SEC` gate are untouched, so 0.40 + the 0.15s fade still
lands inside the 0.9s the death screen was already unskippable for - restarting costs the
same wait and the same one tap it always did); and `CONTINUE_OFFER_SEC` **is** offset by
`DEATH_REPLAY_SEC` in `update.js`, because that budget is measured in seconds the offer is
actually *on screen* - a real-device pass already found 0.9s too short once, so silently
shaving 0.4s off it would have re-broken that. `drawContinueOffer` also nulls
`_continueBtnRect` while it is invisible, so there is no tappable-but-unseen button.
`markDeathHit` is called at the same six sites that set `deathCause`, and like
`deathCause` it also fires on shield/invuln-absorbed hits - harmless, since it is only
ever read in the `dead` phase.

**Death screen context**: Shows "+X vs last" / "-X vs last" after the second run. Uses `prevRunScore` (run before the current one). Score number glows gold when within 5 of personal best.

**Two records, two different beats, both score-based** - kept separate, but as of
2026-09-01 both compare `score`, not distance:
- **ON FIRE** (`onFire`, `update.js`): fires the frame live score overtakes the bar it
  has to beat - normally today's `dailyBest`, but on the day's *first* run (where
  `dailyBest` is still 0) it falls back to the all-time `best` so a strong opening run
  still ignites (`_fireBar = dailyBest || best`; `_fireBar > 0` still guards a brand-new
  player's very first run). Recolors the thruster trail fire-hot for the rest of the run,
  plus a one-shot notif/`sfxOnFire`/orange ring pop (`onFireFlash`).
- **New all-time record** (`pbPassed`, `update.js`): fires the frame live score overtakes
  the all-time `best`, NOT reset at the day boundary. One-shot gold ring pop (`pbFlash`),
  `T.pbPassed` notif, `sfxPbPassed`. Separate from ON FIRE because ON FIRE has usually
  already fired earlier in the run (daily best <= all-time best), so the all-time
  crossing still deserves its own, bigger beat.
  Used to be a pure *position* check instead - crossing `bestSX` (the previous best run's
  death distance), drawn as a dashed gold "PB" line in the tunnel that the ship visibly
  flew through. Retired because `score` includes `bonusScore` (coin combos, near-misses)
  on top of raw distance, so a coin-heavy run could overtake the old best *score* well
  before physically reaching the old best's *distance* - onFire (score-based) and the
  line (distance-based) would then disagree on which fired first, reading as a bug ("on
  fire" before the visible PB line) rather than the two distinct signals they were.
  Merged onto score on request, since the game already only ever settles records by score
  everywhere else (death screen, daily best, all-time best). `bestSX` itself still exists
  and is unaffected - it still backs the passive gold ring (`bestMarker` in `draw.js`)
  showing exactly where the best run died, and the PB marker on the daily share card
  (`share.js`), both of which are legitimately about physical position, not a score
  comparison.

### Daily run card (share)

`src/share.js`. TUNL seeds every run from the UTC date (`lifecycle.js`), so every player
on Earth flies a pixel-identical cave each day - the hard half of a shareable daily
game. (Verified per-device by `test-cave.js`; see "Cross-device fairness" for the four
things that have to stay true for it.)
The card is the other half.

The image is deliberately a picture of the **run**, not a score badge: the corridor is a
pure function of world-x (`boundsBase`), so the whole flown tunnel is redrawn compressed
into a strip, with the death point marked and the all-time best (`bestSX`) marked beside
it. The corridor is sampled as a rolling average whose window scales with run length -
drawing `boundsBase()` literally is accurate but renders a deep run as a seismograph,
since ~60 wave periods get packed into 1100px. Short runs keep their real shape; long
runs resolve into "the corridor narrowed this much and I got this far", which is the
only thing readable at card size.

Gated by `shareWorthy()` (new best, new daily best, or score >= 200) so the button reads
as a reward, not a nag, and by `shareAvailable()` so it never renders without somewhere
to send the card. The card crosses the JS->native boundary as a base64 PNG (the only
channel a canvas has), which is why the background is a flat wash rather than a radial
gradient - that one change took the payload from ~670 KB to ~180 KB.

`SHARE_URL` in `share.js` is the only place the public marketing URL is written down in
this repo; the store listing pages themselves live in the Schedly repo's `wwwroot/tunl`.

Android needs a `FileProvider` for this (`AndroidManifest.xml` + `res/xml/file_paths.xml`)
because `ACTION_SEND` requires a `content://` URI, not raw bytes.

### World rank

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

No backend: `GKLeaderboard.loadEntries` (`GameView.swift` `fetchWorldRank`) and
`loadLeaderboardMetadata`'s `LeaderboardVariant` (`MainActivity.kt` `fetchWorldRank`)
both already return rank *and* total count. Both fire after a submit resolves, and once
at auth to prime the first death of a session. The delta is computed in
`main.js _tunlNativeUpdate`, not natively - only the page knows what rank it last showed.

That local list is `top5`, which is **wiped at the UTC day boundary** (`lifecycle.js`),
so it is labelled `T.todayTop`, never "TOP 5" - the old label made it look like lost data
every morning.

### Death screen ("Debriefing", 13.0 - do not revert to the 12.0 layout)

Rebuilt 2026-09-13 on the report that the screen had looked the same since version 1 and
read as dated. It was not ugly, it was **systemless**: 491 lines setting 13 font sizes and
39 hand-mixed colours at 27 hardcoded H-fractions, every line individually centred on its
own column anchor (so both edges of both columns frayed with text length), with nine
`measureText` shrink-to-fit escapes papering over the missing grid. Five rules replace
that, and each is load-bearing:

1. **Five type steps** (`DS_HERO`/`DS_BIG`/`DS_ROW`/`DS_TXT`/`DS_LBL`), not thirteen.
2. **One accent, and it is the day's own rock** (`getTheme().wallBase`). The panel used to
   be hardcoded blue on all seven days - the one screen that closes out the daily run was
   the only surface in the game that did not know which day it was, while world, title
   screen and share card all tint from `WEEKDAY_PALETTES`. Gold stays reserved for shards,
   green for a positive rank delta, and **red is now only the death marker**: the old red
   "TOT" headline was the largest thing on screen while saying the one thing the player had
   just watched happen, and it competed with `drawDeathFreeze()`'s reticle, which is what
   actually points at the cause. The headline is gone and the score is the hero. A record
   pulses in the day accent rather than cycling the whole hue wheel (that treatment stays
   on the title screen, where it does not have to belong to a palette).
3. **Left-aligned to two column rules** (L = the run, RX = the world); numbers sharing a
   column are right-aligned to R so they form a column instead of drifting with digit count.
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

**The flight-profile band yields when space runs out.** `drawRunProfile()` (share.js) was
once tried here as a faint full-panel backdrop and correctly rejected - as wallpaper behind
text it is noise. Framed, in the left column under the chips, it is the opposite: the only
thing on the screen that belongs to this run alone. It sits in the left column and not
across the full width because the right column (rank + three rows + stats) reaches `H*0.67`
at 952x436 and would leave it 0px. It degrades in three steps - full band, band without its
label, no band - so a run that earns every reward at once pushes the band out instead of
overlapping it.

**Empty state:** only list rows that exist are drawn, and the row count is additionally
clamped against the button row's top edge, which is computed before either column draws. The old layout always drew five, so
the common case rendered as four placeholder dashes under one number - an emptied-out full
state rather than a designed empty one.

**Zero new i18n strings**: the rebuild reuses keys the screen or the share card already had
(`T.level`/`T.planet`/`T.flown`/`T.best`/`T.todayTop`/`T.worldRank`). Two shrink-to-fit
checks survive on purpose - world rank and button labels, the two strings that genuinely
vary without bound.

### Ghost run

`GHOST_STEP`/`ghostEncode` in `constants.js`, recorded and replayed in `update.js`, drawn
in `draw.js`. Because the corridor is reproducible from a date, a replay needs nothing
but the ship's vertical position over time - no obstacle log, no input log, no seed
capture. One byte per 60 world-px (= 1 point of distance score), quantised over `[0, H]`
so a ghost recorded on a phone replays correctly on any other screen size.

Scoped to the **calendar day**, not all time: an older track would be racing through a
cave that no longer exists. That also makes it reinforce the daily loop - each day opens
with no ghost, and the day's first good run creates the thing you chase for the rest of
it. Outlasting the ghost fires a one-shot notif and sound; that moment is the whole point
of the feature.

Recording and playback are indexed by `scrollX`, never elapsed time - a blue coin drops
scroll speed and ramps it back over ~4s (`slowScrollFactor`), which would desync a
time-indexed ghost from the tunnel; scrollX indexing is immune to it.

The ghost is drawn *before* the Player block in `draw.js`, not inside it: that block
applies a `rotate()` pivoted on the player's position, which would swing the ghost around
the live ship on every pitch change.

### Onboarding

**The first ~50 points of every run are a plain, safe flight** (was ~100, cut to 50 on request the same day) (2026-09-13, from
beginner feedback "too hard, frustrating, deleted it"; `SAFE_START_WX` doc block in
`constants.js`, `safeOpenAt()`/`wallsSafe()` in `world.js`, `safeWallBump()` in
`update.js`). Until world-x 3000 the corridor is pushed out to the screen edges
(`boundsAt()` only, never `boundsBase()`) and **walls bump the ship back instead of
killing it**, easing shut over the last 1800px. **No stalactites, mines, boulders or
cannon fire** until `HAZARD_START_WX` (3400, ~1s after the walls turn lethal); boulders
from 6620, cannons from 7000 so no shot lands inside the zone. Coins and the warp portal
still appear. The "walls now deadly" notif fires as the corridor closes, only on a
player's first `WALLS_LIVE_HINT_RUNS` runs. Near-miss bonus and the red danger flash are
off while walls are soft (no wall-riding bonus farm). Every run counts normally.

**A soft wall looks soft (2026-09-13, do not revert to "identical rock").** Through
12.0 a non-lethal wall was pixel-identical to a lethal one, and bumping it fired
`burst()`'s orange sparks plus a shake - the vocabulary every real hit uses - so the one
stretch that cannot kill you looked like the one that just did. Two draw-only halves
(`SAFE_FIELD_ALPHA` doc block in `constants.js`):
- **Field vs rock, split at the world-x, not at a timer.** `draw.js` paints the walls
  twice per frame while `safeEndWx - scrollX` is on screen: full rock past that column,
  and before it the same rock at `SAFE_FIELD_ALPHA` with contour lines riding inside the
  edge (`_paintSoftField`), a bright thin edge over a wide soft one, and a light running
  along it. The lethal rock therefore rolls in from the right and reaches the ship
  exactly when `wallsSafe()` flips - roughly 1.5s of warning, free, no HUD. A hairline
  marks the seam. The signal is **opacity and motion, never hue**: the edge colour is the
  weekday's own (Luna is near-white, Io teal) and `gapBonus` tints it cyan the moment the
  zone ends, so a colour-coded "soft" would be invisible on 3 of 7 days and ambiguous
  right after. Measured cost: none (the second pass is cheaper than the stone pattern it
  replaces, and only runs during the ~7s zone).
- **A bump bends the wall instead of spraying sparks.** `safeWallBump` only records
  `{wx, isTop, t}` into `state.js safeBumps`; `draw.js` bends the RENDERED edge around it
  (`_softBumpDent`, a damped spring that gives and settles) and runs a ring out of the
  contact point. Cleared in `die()`, since the dents stop aging once the world freezes.
Both only ever touch `topArr`/`botArr`, the same rendering-only arrays `_wallJagged`
already offsets - `boundsAt()` and every collision test are untouched, so this is a pure
look change on every device and needs no `isWeb()` gate.

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
player's first hold press or `HOLD_GATE_MAX_SEC` (`constants.js`, 2.25s), so the ship
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

### Ad cadence

Every 4th death **and** at most once per 120s of wall clock, above score 25, never with
Remove Ads. The wall-clock floor is the rule that actually matters: a good run lasts only
20-36 real seconds, so a pure every-Nth-death rule put a full-screen ad in front of
engaged players roughly every 90 seconds. When the floor blocks, the death counter is
rolled back one so the two rules don't compound into a much longer gap than intended.

That is the only *forced* ad. There are also two **opt-in rewarded videos**, each on its
own dedicated AdMob unit and each still shown to Remove Ads owners (Remove Ads buys out
the forced interstitial, not a video the player actively taps):
- **Rewarded continue** (8.1) - offered once per run past score 25 on death, revives the
  run. See the Rewarded continue notes in `constants.js`.
- **Rewarded shard bonus** (8.2) - a row at the bottom of the Missions drawer: watch an
  ad once per UTC day for a flat `SHARDS_AD_REWARD` (20) shards, exempt from
  `DAILY_SHARD_CAP` like a mission reward. Native plumbing
  (`shardsAdRequest` / `_tunlShardsRewardGranted` / `_tunlShardsRewardDeclined` /
  `shardsAdReady`) mirrors the continue's 1:1. With no native bridge (browser) the row
  stays inert.

## Key design decisions (do not revert)

- **No live debug keyboard shortcuts ship unguarded**: `input.js`'s `KeyP` handler
  (toggles `window._freezeDraw`, freezing a live run - world, physics, and audio -
  indefinitely) is gated behind `DEV_PAUSE_KEY` (`constants.js`, ships `false`; same
  pattern as `DEV_INVINCIBLE`). Through 11.0 this shipped live in the web build: a
  red-team audit found it, unguarded, gave any player unlimited thinking time on a
  shared daily leaderboard for free. `window._freezeDraw` itself is untouched - the
  console-driven headless-playtest workflow reads/writes it directly, never through
  this key - only the keyboard binding needed the guard. Flip `DEV_PAUSE_KEY` to
  `true` locally to get the shortcut back for debugging; never ship it `true`.
- **Coin bonus is a real difficulty lever, not a marginal aid**: `GAP_PER_COIN_FRAC` = 0.075/0.43, `GAP_BONUS_MAX_FRAC` = 0.19/0.43 of the corridor's own half-gap (see Coin system above) - one coin adds ~17% to the halfGap and a maxed bonus 44%, at every depth. Coins are essential by design, not a small nudge - don't shrink these back down to make the bonus merely "helpful." The 12.0 change from absolute px to corridor fractions is **not** a weakening of that lever: it is exactly as strong as it always was early (wx=0 is a byte-exact no-op) and now equally strong, rather than disproportionately stronger, deep.
- **boundsBase for coin placement**: Coins placed ignoring current bonus so they're always reachable even without a bonus. Never use `boundsAt()` for coin placement.
- **Triangle-circle collision**: Stalactites use proper geometric collision matching the visual triangle, not AABB. Changing to AABB would make invisible collisions at the edges.
- **No em dashes (-)** anywhere in code, comments, or UI text. Use hyphen-minus (-) instead.
- **The death screen's rewards are a wrapping chip row, not stacked lines**: ship unlock,
  mastery level-up, mission payout and shards used to be three `if`s all targeting `H*0.78`
  and all suppressing each other, so a good run could earn all three and be shown one; the
  fix after that concatenated them onto one shrink-to-fit line. Since the 13.0 rebuild they
  are chips that wrap within the left column, so every reward a run earned is visible at
  once. Ship unlock still outranks a mastery level-up (two ship-coloured chips at once reads
  as a glitch); nothing else suppresses anything.
- **XML comments can't contain `--`**: the no-em-dash rule means `--` is used constantly
  in JS comments, but it is illegal inside an XML comment. `AndroidManifest.xml` and
  `res/xml/*.xml` use single hyphens or a colon instead.
- **`scrollSpd()` never plateaus**: every other difficulty knob (`stalSpacing`, `stalLenFrac`, `coinSpacing`, `mineSpacing`, wave amplitude/frequency) caps once `_prog2` saturates, because those define corridor *geometry* and pushing them further would make the tunnel unnavigable. Scroll speed has no such ceiling - it only shrinks reaction time - so past `_prog2 > 1` (score ~900) it keeps climbing forever via a sqrt-eased tail (`base + sqrt(_prog2-1)*90`), intentionally so a long enough run is never merely "endurance at a fixed pace." Don't re-add a hard cap here.
- **Mines are the only thing that guarantees no run survives forever, don't make them wall-anchored or bonus-aware**: because every *other* hazard (stalactites/chicanes) is wall-rooted with an absolute, capped length, a player who keeps `gapBonus` maxed can park near the corridor's vertical center past ~score 1567 and never be threatened by a wall or stalactite again, no matter how high the uncapped `scrollSpd()` (above) climbs - speed alone doesn't endanger a stationary target. `makeMine()` (`systems.js`) placing mines across the full un-bonused `boundsBase()` width, not wall-anchored like a stalactite, is what closes that gap: an unpredictable mine still demands a real `MAX_VY`-bounded dodge every `mineSpacing()` world-px, and that reaction window keeps shrinking in real time as `scrollSpd()` rises without limit - so eventually no input sequence can dodge one, for any skill level. See the doc comment above `makeMine()` for the full argument. **`MINE_RETRY_OFFSETS`
(2026-09-11) is what keeps that argument true in practice**: `makeMine` vetoes any x with
a stalactite above *and* below, and deep that is almost every x (50px spacing, 0.62
chicane odds), so ~90% of mines were being silently dropped and spatial density ran
*backwards* with difficulty - 1.66 per 1000 world-px at score 100-150 but only 0.35 past
1400. A vetoed mine now shuffles forward up to 135px (under the 140px minimum spacing
between consecutive mines, so the array stays sorted) and retries. Deep only (`_prog2 >
0`): a retry below the plateau measurably *raised* early mine density, and the early game
is off-limits to this pass. Restoring the drain also matters for the shield stack - a
stock that can only be spent by getting hit never drains if nothing is hitting you.

## Ship unlock economy

Every paid ship (`SKINS` in `src/constants.js`) needs two things at once: `cost` shards
(earned from collected coins, `runCoins`, banked at death, capped daily by
`DAILY_SHARD_CAP` = 160; the 3 daily missions and the once-per-day rewarded-ad bonus
`SHARDS_AD_REWARD` = 20 are exempt, so the real ceiling is 160+20+30+40+50 = 300/day)
and `stardustGate` days played (`stardust` in `state.js`, +1 per
calendar day opened regardless of skill or how much is played that day, +1 bonus per
7-day unbroken streak - see the Stardust doc block in `constants.js`). Stardust is never
spent, only checked as a `>=` threshold, so a tier's gate doesn't stack on top of the
next tier's. SOLARIS (the 8th/last ship) needs 5600 shards and 180 stardust (~half a
year at the daily floor) - see that same doc block for why shards alone or stardust alone
can't do this job, and the worked timelines for hardcore/good/bad player tiers.

**Shard costs were re-tuned 2026-09-10 (do not revert to the old ladder).** The previous
prices (240/880/2200/4800/12000/32000/50000, cumulative 102120) were measured against the
real curves and found to make the top three tiers effectively unreachable: NOVA was ~174
days even at the full 300/day ceiling and ~652 days at a realistic ~80/day, SOLARIS ~341
and ~1277. Worse, the binding constraint flipped from `stardustGate` to shards at VOID,
so the stardust system - the thing that is supposed to pace unlocks - stopped doing any
work at all for the entire top half of the roster. The current ladder
(240/320/560/1280/2400/4000/5600, cumulative 14400) is set just under what each tier's
gate implies at ~80 shards/day, so **stardust is the binding constraint at every tier**
and SOLARIS still lands on day 180 exactly. Re-run the numbers before changing either
side; a shard-side raise silently re-breaks the gate schedule.

**Unlock All Ships IAP**: a real-money non-consumable (`unlock_all_ships`, alongside the
existing `remove_ads`) that instantly force-unlocks every ship, current and future
(`allShipsOwned` in `state.js`, re-applied on every load rather than snapshotting which
ships existed at purchase time). $9.99, versus `remove_ads` at $2.99 - priced higher to
match a much bigger value proposition (skip up to a year of daily return, not just an
ad-free screen), landing on the standard "unlock everything" tier common across
App Store/Play Store IAPs rather than a steeper "whale" price, since these ships also
carry real gameplay perks (see the buff/nerf table above `SKINS`), not just cosmetics.
Shop UI in `draw.js`'s `showShop` panel, purchase/restore bridge generalized from a
single-product design to a product-ID-keyed one in `IAPManager.swift` and
`BillingManager.kt` (both mirror each other exactly, see their doc comments). Shards and
stardust are untouched by this purchase - it's a separate entitlement flag, not a
currency grant, so it stays meaningful even for a player who already owns everything.

Shipped in 6.0: the real `unlock_all_ships` product exists in both App Store Connect and
Play Console at the $9.99 tier (alongside `Configuration.storekit`'s copy, which stays
for local testing only), and both stores' content-rating questionnaires were redone
accounting for it - still a flat one-time digital-goods purchase, not gambling/loot-box/
cash-back, so the "never purchasable with real money" answer from the prior audit (see
project memory) held after re-checking.

## Possible future features

- Animated background parallax layers
- Multiple difficulty modes
- Mobile fullscreen on iOS/Android
- Level theming (lava/ice/neon)
- Additional coin types beyond the current eight (gold/blue/red/orange/green/bomb + the two hazards poison/drain)
- Friend ghosts carried inside a share link (see Ghost run below - the local ghost is
  already only a few hundred bytes, so a shared one is mostly a transport problem)
- A playable web build. Deliberately NOT on the roadmap right now: the user decided
  against it. If it comes back, the remaining blockers are a portrait/rotate overlay and
  an install CTA - the launch-time audio cost that used to head this list is fixed (see
  the lazy loaders in `audio.js`), though the two MP3s would still want smaller web
  encodes before shipping over a link.
