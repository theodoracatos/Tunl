# TUNL - Claude Code Instructions

## Working style

- Just do the task. Don't ask for confirmation before reading files, running searches, or making straightforward edits.
- Don't ask clarifying questions if the intent is clear from context - make a reasonable choice and do it.
- Only ask when something is genuinely ambiguous AND the wrong choice would be hard to undo.

## Secret-scanning pre-push hook

`.githooks/pre-push` blocks any `git push` (from Claude Code or the terminal) whose
new commits add a secrets-looking filename (`.env`, `*.pem`, `appsettings.Production.json`,
etc.) or content matching a known secret pattern (AWS/Google/GitHub/Slack/Stripe keys,
private key headers, generic `key|secret|token|password = <value>` assignments). It
**also blocks a tip that still has a `DEV_* = true` testing flag in `src/constants.js`**
(`DEV_INVINCIBLE` / `DEV_PAUSE_KEY` / `DEV_WALLET`) - checked against the file content at
the tip, not against added lines, so a flag flipped in an earlier commit cannot sail
through a later push. It's
committed to the repo but git does not auto-trust a `core.hooksPath` from a clone, so each
clone must run `git config core.hooksPath .githooks` once to activate it. Bypass with
`git push --no-verify` only after confirming a hit is a false positive. Run `/check-secrets`
to get the same verdict mid-session before attempting a push.

## What is this

TUNL is an HTML5 Canvas hold-to-thrust cave flyer game.
`tunl.html` is an HTML/CSS shell that loads 18 plain scripts from `src/` in order - no
libraries, no modules, no build step, one shared global scope. Run `/map` for the file
map. Open `tunl.html` in a browser to play.

**Orientation: landscape only.** The iOS app (`Info.plist`) locks to `LandscapeLeft + LandscapeRight`. Never change this to portrait.

**Three targets from one `src/`.** The same `tunl.html` + `src/*.js` ships as the iOS app
(WKWebView), the Android app (WebView, assets mirrored - see
`reference_android_assets_mirror` memory) and the live web build at **flytunl.ch/play**
(source in `flytunl-site/`, bundled by `build-play.mjs`, deployed by
`flytunl-site/deploy.sh`). **Standing rule: a web change must never alter app behaviour
and vice versa** - gate every gameplay/layout/text change in a shared file on `isWeb()`
(`src/web.js`, reliably `false` in both apps from the first script). Build tooling, the
marketing site and test files never reach the apps and need no gate. See the
`feedback_web_app_isolation` and `project_web_build` memories.

**This file holds the rule, the number and the "do not revert".** The measurement
narratives, rejected alternatives and before/after tables behind those rules live in
`docs/design-history.md` - read the matching section there before re-opening a decision,
and append to it when you change one.

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
across 12-144Hz. `test-math.js` asserts both that and that the old integrator genuinely
diverged, so a silent revert fails.

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

### Cross-device fairness (do not revert without re-auditing)

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

**Rock roughness is switched off, and the code now short-circuits accordingly.**
`ROCK_ROUGHNESS_MAX` = 0 (`draw.js`), so `_wallJagged` and `_stalOutline`'s `jAmp` both
resolve to zero - but until 2026-09-14 they computed the full value-noise stack first
and multiplied it away afterwards. At `RSTEP` 3 that is ~320 wall samples per frame,
twice each, three `_rockNoise` per call, two `Math.sin` per noise: about 3900 sine calls
per frame producing 0, plus 12 more per on-screen stalactite. Both now return early on a
zero amplitude (measured 30.8 -> 2.5 us per frame's worth of wall samples), and the
returned value is bit-identical at any non-zero roughness, so flipping the constant back
up still behaves exactly as before.

### 3/4 side view in flight (2026-09-19, `SHIP_VIEW_3D`)

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
- **The portal grants a barrel roll** (`SHIP3D_BARREL_SEC`, set in `triggerWarp`): one full
  360 deg turn, smoothstepped. Safe by construction - a warp is hazard-immune and
  wall-clamped, so the picture leaving the circle mid-roll can never decide a death.
- **Liveries paint the 3D hull through the same `_drawLiveryOverlay`.** The finishes are
  authored in planform coordinates, and at roll `a` the top surface projects to exactly that
  planform squashed by `sin(a)`, so the overlay runs under that scale, clipped to the 3D
  silhouette instead of `shipPath`. The two things that cannot be expressed that way - the
  facet seams and the rim - come in as a `hull` argument and are traced in screen space (rim
  = the edges that only one visible face owns). Two 3D-only corrections: the seams run at
  half alpha and skip small faces (90 faces against the flat hull's 7 turned STEALTH into a
  lamp), and near edge-on (mid barrel roll) the pattern is skipped for those few frames.
- `shipNozzleDY(ns)` projects the exhaust nozzles, so plume, on-fire cone and `update.js`'s
  thruster particles all leave the nacelles at any roll.
- Cost: ~90 visible faces filled per frame against the flat hull's ~40 fills, no
  `shadowBlur` (the glow is one radial fill). If a weak device ever needs it, the obvious
  cut is caching the hull per roll/sweep bucket into an offscreen canvas.

**Still top-down, deliberately:** the brand marks (`branding/gen-ship-glyph.mjs`, app icon,
launch logo, Play graphic, the homepage chips) and `share.js`'s `_shipGlyph`. They are
portraits of the ship, not pictures of the flight, and the generator's facet-tone maths has
no 3D twin. The swing-wing outer panel means the in-flight planform is no longer exactly
`SHIP_OUTLINE`; if the marks are ever regenerated, decide then whether they follow.

### Typography and title accent (2026-09-16, do not revert to Courier)

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

### HUD instrument, web frame (2026-09-16 design pass, proposals 3, 4, 6)

- **HUD** (`drawHUD`, constants.js `HUD_SPARK_*`): under the live score a thin record rail
  fills toward the all-time best (orange once ON FIRE, pulsing gold once `pbPassed`, gold
  tick = the record); a combo chip `xN` sits right of the score's live width with a bar
  draining over `coinComboWindow`; every coin that pays points sends a spark in its type's
  colour to the score, which "swallows" it (`hudBump`, scale + gold tint). A near-miss
  bumps immediately. All presentation: `bonusScore` is still credited at pickup. The world
  intro banner and the milestone flash are both placed below `hudY`, never over the stack.
- **No parallax background - tried and removed the same day (do not re-add).** Two far rock
  silhouettes scrolling behind the walls (proposal 5) read as "extremely confusing" in
  playtest, even after their contrast was cut to near the void colour: in a game whose
  whole skill is reading where the walls are, any second set of wall-shaped edges moving
  at a different speed competes with the real ones.
- **Web frame** (`tunl.html` `body.web-framed`, `main.js _syncWebFrame`): hairline + glow in
  the day's rock around the canvas, only with >= 32px of letterbox room, `isWeb()` only.

### Depth light (background, 2026-09-13)

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
- **Steps, not a fade.** A continuous fade over ~30s is below what a player notices while
  dodging; a step at a sector boundary is not.
- **Light behind the ship, never ahead.** Hazards arrive from the right, and that side
  stays as dark as it was.
Pure function of world-x via `sectorAt`, draw-only, no gameplay value touched, same on every
device and not `isWeb()`-gated. `document.body.style.backgroundColor` follows the lift, which
only changes during a step (a few dozen writes per run, not per frame).

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

### Flight plan (sectors) - do not revert to per-hazard world-px curves

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

### Stalactites
Triangle-shaped obstacles from top or bottom wall. Accurate triangle-circle collision (not AABB).
Paired stalactites (chicane from both sides) appear after `_prog > 0.40` with 24% chance.

**They are CRYSTALS since 16.0 (`CRYSTAL_STALS`, `constants.js` doc block +
`draw.js` `drawCrystalSpike`) - do not go back to the smooth cone.** The spike had
not been touched since 1.0 while ship, coins and boulders all moved to flat facets
lit from above; the rock was the last airbrushed object on screen. A ceiling spike
is now a twin (main crystal + two companions + two nest crystals), a floor spike a
druse (main + four steps + six nest crystals), all upright, drawn from
`_rockHash(s.wx)` - no `rng()` draw, no change to `makeStal()`, placement or
collision, so `test-cave.js` still reports a byte-identical cave. Flip
`CRYSTAL_STALS` to `false` and `_stalOutline`'s cone is back.

Four geometry rules, each of them learned by breaking it:
- **The main crystal sits on the axis at full length**, so its tip lands exactly on
  the collision apex. Give it a lateral offset and the lethal triangle runs on
  below a visibly shorter crystal - the unfair direction, spotted immediately.
- **Shafts taper.** A parallel column of half-width w only fits a triangle running
  from `0.85*hw` to zero up to `t = 1 - w/(0.85*hw)`; that is why the first pass
  could only be fat-and-short or long-and-needle-thin. Companions must also stand
  CLOSE to the axis: at `dx` 0.48 with a 0.24 tilt the clamp left 6-9% of the
  length, invisible at game size; upright at 0.13 it keeps 70%.
- **The side clamp is solved with signs, not absolute values** - with `Math.abs` an
  inward-leaning prism lost up to half its length.
- **Every crystal roots on the wall at ITS own x**, never on the average over
  `+-hw`; nest crystals sit up to `3*hw` out, where the wall has long since moved.

**The drawing is one blitted sprite per spike** (`_xtalSprites`), baked per
stalactite and rebuilt only when the raster scale or the tone key changes. Drawn
live it was ~90 path operations per druse and measured **6.3x the entire `draw()`
of the old cone** at eight visible spikes; socket and body merged into one sprite
it is **0.244ms against the cone's 0.283ms**, i.e. the crystal is now the cheaper
of the two - it spends no gradient, no clip, no `shadowBlur` and no specular
stroke per frame. Do not split that blit again without re-measuring.

**Per-world material** (`CRYSTAL_MATERIALS`, index-aligned with
`WEEKDAY_PALETTES`): same geometry, different finish - calcite, rust quartz,
selenite, obsidian, amethyst, olivine, rhodonite. The hue stays the day's own
`stalEdge`: the colour circle is measured full (`COIN_BASE_CLR` plus the state
colours), the day rock lands within 20 degrees of a signal colour on six of seven
worlds, and rotating away only pushes three worlds onto the same blue-violet. What
separates a crystal from a coin is therefore **place** (welded to the wall vs a
small moving object in the corridor), **value** (terminations lift toward white)
and **form**, never hue.

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
material. Both are gated on `CRYSTAL_STALS`, so the one switch reverts picture and
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
`updateCannonShots`), first at wx=7000 (score ~117) and spaced far apart
(`cannonSpacing()`, floor 1200px vs every other obstacle's sub-300px floor) - a rare
set-piece, not a recurring hazard. Each cannon is inert (not solid, can't be flown into)
until the player closes to within `CANNON_FIRE_LEAD`, then fires exactly one diagonal
shot toward the opposite wall and goes dormant. Shots reuse the player's own bullet
sprite (`drawProjectile`), so a cannon shot reads as literal enemy fire and only its
diagonal angle tells them apart. Same hitbox trade-offs and shield-absorb behaviour as a
mine; player bullets destroy a shot in flight like they destroy a mine.

**Barrel, shell nose and exit line share one axis - the TUNNEL frame. Do not switch to
screen velocity.** `updateCannonShots` aims everything along the shell's **world**
velocity (`c.aimUX/aimUY`, sprite `atan2(s.vy, s.vx)`); before firing, `draw.js` aims at
the nominal mid-span shot. Since `scrollSpd()` outruns the closing speed at every cannon
depth, that axis leans down-and-away from the player - the player flies into the falling
shell. A screen-velocity aim looks right per element in isolation but the gun is bolted
to the tunnel and scrolls left faster than its own shell, so the shell peels away from
the muzzle almost broadside (~118 degrees off, reported from play).

The shot spawns at the barrel's **muzzle** (`CANNON_BARREL_LEN`, shared between `draw.js`
and `systems.js`), sliding the start along that same world line and slowing the shell by
exactly the barrel length over the flight, so endpoint and arrival time match a pivot
launch and the tuned warning window does not move.

**`CANNON_SHOT_TRAVEL` is 1.45s and `CANNON_FIRE_LEAD` is deliberately untouched at
`W*0.62`.** A cannon's shot does not exist until `CANNON_FIRE_LEAD` out and its vertical
span is rolled from `rngCannon()` at that instant, so **its whole warning window IS its
flight time** - which made it the weakest-telegraphed hazard in the game until the travel
time was raised from 1.15. The muzzle still fires from the same on-screen position and
world-x; only the closing speed dropped (`closingSpd = CANNON_FIRE_LEAD /
CANNON_SHOT_TRAVEL`), and `cannonSpacing()` is untouched, so rarity is unaffected.

**One invariant, checked rather than assumed:** `rngCannon()` is drawn both by
`makeCannon` (at the spawn horizon) and by `updateCannonShots` (at fire time) on the same
stream, which would fork the cave per player if the two could interleave differently.
They can't - a cannon spawns at `scrollX = wx - 1256` and fires at `scrollX = wx - 803`,
and `cannonSpacing()`'s 1200px floor is wider than that 453px window, so the order is
always spawn-N, fire-N, spawn-N+1. Verified identical across 17 cannons for two pilots
with different scroll histories on the same day. **Re-check this if either number moves.**

`makeCannon`'s placement veto is **same-wall and geometric** (`PLACE_CANNON_R +
placeStalW`), not the flat 140px both-walls test it started as, and the wall (`isTop`) is
drawn **before** the retry loop - see the `SPAWN_AHEAD_*` discussion under Cross-device
fairness.

Measurements behind the travel-time change: `docs/design-history.md` -> "Cannons".

### Warp portal ("Sog")

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

**Look: a tall hoop the ship threads ("Reif") - do not go back to flat ovals.**
`draw.js` draws a tall ellipse (height = `Math.max(p.r, PR*1.6)`, exactly
`portalHitTol`) in two passes: glow, flow lines and the far arc **before** the player,
the near arc plus a chase light **after** it (`_portalBand`), so the ship visibly flies
through. Stacked soft strokes with a near-white core replace `shadowBlur` - the core is
what keeps it legible on the violet Friday rock. A used hoop widens as `usedFade` runs
out. While a warp is live, white speed streaks sweep the tunnel (`WARP_STREAKS`, alpha
riding `warpScrollFactor()`), placed from `scrollX` + `_rockHash` - stateless, no
`rng()`. Proposals: https://claude.ai/code/artifact/7fab90a9-4ad8-4729-a1d6-04d56d49ddd8

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

**Exiting a warp grants `HIT_INVULN_SEC`** (`update.js`, warpTime falling edge, `Math.max`
against whatever is running, never a shortening) - collision solidifies with the corridor
still easing in from `WARP_GAP_MULT`-wide (`warpWidenVisual`), so a hazard can be uncomfortably close. This is
the reuse `constants.js`'s own `HIT_INVULN_SEC` doc comment anticipated, not a new constant.

**The wall is never a warp-caused death, by construction, not by tuning.**
`update.js`'s wall check treats `warpTime > 0` exactly like `invulnT > 0`: clamp back
inside the corridor instead of killing. `WARP_GAP_MULT` only decides how much clamping
the player feels. (The warp's drift can outrun `MAX_VY` at the wave's peak slope, and
amplitude, frequency and `warpMult` all still climb - so this must not be a tuned margin.)

**Deliberately real seconds, not a world-px distance.** No `rng()` draw, nothing any
other player's cave depends on - the same category of per-player effect as the blue
coin's `slowTime`, not a cross-device-fairness concern. `scrollX` still advances one
`dt` at a time through the ordinary `maintain*()` loops, which already backfill an
arbitrary jump (a backgrounded tab does the same).

**Portal placement reuses the coin contract** (`coinBlockedByStal()` in `_makePortalAt`).
The ring's *drawn* radius (`PORTAL_R_FRAC` of the halfGap at that wx) is spectacle; only
its centre point has to be provably flyable, and that question is already answered for
every coin in the game. So: never a bespoke geometric veto, which is exactly the mistake
that nearly wiped out
boulders and cannons (see `SPAWN_AHEAD_*` above). `PORTAL_RETRY_OFFSETS` follows the same
retry-on-veto pattern as mines/cannons/boulders. The ring triggers on an **x-crossing
test**, not a circle overlap: a fast-scrolling frame can jump the player past a thin ring
in one step, a risk that only grows once `warpScrollFactor()` is live.

### Coin system

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

### Coin type progression

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

### Audio bus and loudness (do not revert)

`src/audio.js`. **Both BGM tracks live in `audio/`** (with their `.web.m4a` web
encodes), not loose at the repo root, and `BGM_DIR` makes the fetch the relative
`audio/<name>.<ext>` - so every target has to reproduce that one subfolder next to the
page: gradle copies `audio/*.mp3`, Xcode uses a Copy Files phase with `dstPath = audio`
(the Resources phase flattens), and `build-play.mjs` writes `play/audio/`.
Every sound is synthesised per call and connects to `_master`; the bus in
front of the speakers is **sfx bus + music bus -> `MASTER_GAIN` -> soft-clip limiter ->
destination** (`_initAC`), plus a shared cave reverb send.

**Judge every change here by offline render, never by ear** - by-ear tuning does not
predict how sounds sit against each other or the bed, and a loudness match alone shipped
a "Knallfrosch" twice. Method, metrics and traps: `reference_audio_method` memory.

- **`MASTER_GAIN` = 1.6.** The mix used to measure ~-24 LUFS integrated while mobile games
  and the AdMob interstitial after every 4th death sit near -14 to -16 - the ad was louder
  than the game it interrupts. Now near -18 LUFS.
- **The limiter is a `WaveShaper` soft clipper, never a `DynamicsCompressor`** (a
  compressor cost 9 dB on percussive sfx). Exactly linear below `LIMIT_KNEE`, so it only
  rounds off the rare frame where several loud events coincide.
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
- **Impact sounds are shaped, not noise bursts (do not go back).** Shield break,
  `sfxRockHit` (wall / boulder / cannon shot on wall; a broken stalactite keeps
  `sfxStalCrack`) and mine / bomb explosions (`_blast()`, shared) need: soft kick-like
  onset, a body whose lowpass closes while its level holds (a straight exponential is
  -18 dB by 0.2s and reads as a firecracker), a waveshaped sub so the bass survives a
  phone speaker, a rumble tail, and low debris thuds with a soft attack (a bandpassed 5ms
  attack clicks).
- **Music is a bus, and death collapses it rather than cutting it.** `_fadeBgMusic` closes
  a lowpass to `DEATH_MUSIC_HZ` as the level falls over `DEATH_MUSIC_SEC`. `musicDuck()`
  steps the whole music bus back `MUSIC_DUCK_DB` under milestone / record / shield-break.
  Title and play music crossfade over `MUSIC_FADE_SEC` instead of cutting.
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
- **One sound, one meaning.** Hull scratch (`sfxHullScratch`) and revive (`sfxRevive`) do
  not reuse `sfxShieldBreak`.
- **Stereo, centred on the ship** (`_sfxOut(x)`): cannon fire, mine blasts, rock hits and
  stalactite cracks pan by screen x relative to `PX`, capped at `SFX_PAN_MAX` 0.6;
  ship-local sounds stay centre. **The `Math.SQRT2` in front of the panner is
  load-bearing** - a mono sfx into `_master` is upmixed to full level per channel and the
  equal-power panner puts it at 0.707, so without it every panned sound is ~3 dB quieter.
- **Per-call variation** (`_vary`): +-3-4% pitch, +-1.5 dB on bullets, cracks, cannon,
  rock hits.
- **The gold coin is in the play track's key**: Nebula is D major, so the blips are D5 + A5
  with in-key 3x/4x partials and a 3ms attack.
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
- **Interruption pause** (`pauseForInterrupt`, `input.js`; `PAUSE_REVEAL_SEC` doc in
  `constants.js`): losing focus mid-run freezes into the revive countdown with the cave
  covered. It ends with **no** `HIT_INVULN_SEC` - backgrounding must never be a free
  invulnerability button.

Still open, deliberately: the music does not follow the sector ramp (with wall-proximity
audio and the title sonar pulse). Review proposals and the user's picks:
https://claude.ai/artifact/6KC3aJhYAAfthzVXtX5oAa

### Addictive systems

**Score formula**: `score = Math.floor(scrollX / 60) + bonusScore`. `bonusScore`
accumulates from coin collection and near-miss bonuses; resets each run.

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

**Near-miss bonus**: +1 `bonusScore` when wall clearance < `PR * 2.0`, 1.5s cooldown.
"+CLOSE" notif + ascending ping.

**Coin combo multiplier**: coins within 2s of each other build a streak; score pts =
`coinCombo * 3`. Shown as a chip beside the live score with a bar draining over the combo
window (see "HUD instrument"). Blue/red/bomb coins join the streak but their notif does
not change (the power-up is the reward); poison and drain break it outright. The gold
pickup sound climbs a major-pentatonic step per combo level (`sfxCoin(coinCombo)`),
plateauing a major-tenth up - the streak is audible in the coin itself, not only in the
separate `sfxCombo` ping (which fires from x2). Same "widen the step, never cap flat"
shape as `milestoneStep()`.

**Death freeze frame** (`DEATH_REPLAY_SEC`, `drawDeathFreeze()` in `draw.js`,
`markDeathHit()` in `update.js`, `deathHitX/Y/R` in `state.js`): for the first **0.70s**
after a fatal hit the death panel does not paint at all. The world is already frozen
(`update.js`'s `dead` branch advances nothing but `deadT`), the wrecked ship keeps
rendering in red, and a reticle contracts onto whatever landed the hit - because through
11.0 the death screen's entire answer to "what did I do wrong" was the word "dead" and a
number, against a measured beginner run of 0.9s of flight.

Two things keep this **free rather than a tax on restarting**, and both must stay true:
- The panel's own alpha is the only thing offset. (The button row's `deadT > 0.95` fade
  and `input.js`'s `DEATH_INTERACTIVE_SEC` gate, 1.1s, both moved +0.2s when the freeze
  went 0.40 -> 0.70 - restarting costs 0.2s more than before, the one deliberate
  exception.)
- `CONTINUE_OFFER_SEC` **is** offset by `DEATH_REPLAY_SEC` in `update.js`: that budget is
  measured in seconds the offer is actually *on screen*, and a real-device pass already
  found 0.9s too short once. `drawContinueOffer` also nulls `_continueBtnRect` while
  invisible, so there is no tappable-but-unseen button.

`markDeathHit` is called at the same six sites that set `deathCause` and, like it, also
fires on shield/invuln-absorbed hits - harmless, since it is only read in the `dead` phase.

**Death screen context**: "+X vs last" / "-X vs last" from the second run on, using
`prevRunScore`. The score glows gold within 5 of the personal best.

**Two records, two different beats, both score-based** (both compare `score`, not
distance):
- **ON FIRE** (`onFire`, `update.js`): fires the frame live score overtakes the bar it has
  to beat - today's `dailyBest`, falling back to the all-time `best` on the day's first run
  so a strong opening run still ignites (`_fireBar = dailyBest || best`, still guarded by
  `_fireBar > 0` for a brand-new player). Recolours the thruster trail fire-hot for the
  rest of the run, plus a one-shot notif / `sfxOnFire` / orange ring pop (`onFireFlash`).
- **New all-time record** (`pbPassed`, `update.js`): fires on overtaking the all-time
  `best`, NOT reset at the day boundary. Gold ring pop (`pbFlash`), `T.pbPassed`, `sfxPbPassed`.
  Separate from ON FIRE because ON FIRE has usually already fired earlier in the run
  (daily best <= all-time best), so the all-time crossing deserves its own bigger beat.

  **Don't turn either back into a position check.** `pbPassed` used to test crossing
  `bestSX` (the previous best run's death distance), drawn as a dashed gold PB line. Since
  `score` includes `bonusScore`, a coin-heavy run overtakes the old best *score* before
  reaching its *distance*, so the two signals disagreed on which fired first and read as a
  bug. `bestSX` still backs the passive gold ring (`bestMarker` in `draw.js`) and the share
  card's PB marker, which are legitimately about position.

### Daily run card (share)

`src/share.js`. TUNL seeds every run from the UTC date (`lifecycle.js`), so every player
on Earth flies a pixel-identical cave each day - the hard half of a shareable daily
game. (Verified per-device by `test-cave.js`; see "Cross-device fairness" for the four
things that have to stay true for it.)
The card is the other half.

The image is deliberately a picture of the **run**, not a score badge. Since the 2026-09-20 rebuild it
carries the **debriefing's own content** (`draw.js drawDeathScreen`), because that screen
already answers "what happened" better than the card's own story did: the run's scenes
(one real frame per sector reached, the death frame last with a red edge, then the dashed
next-sector slot), the score against the bar it was actually playing (all-time best, or
the next `milestoneStep()` when the run is nowhere near it), the world rank, and every
reward as a wrapping chip row. What deliberately does **not** cross over is the death
screen's right column - `TODAY TOP`, the run counter, the shard payout and its daily cap
- which is the sender's own meta and means nothing to a recipient. **Do not "simplify"
this into a screenshot of the panel**: the panel carries the button row, is a different
shape on every target (956x600 iOS / 520 Android / 440 web) and has no wordmark, URL or
date, which is exactly why the card composes the same blocks into a fixed frame instead.

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

**Every block that yields, yields to the same rule as the death screen.** The scenes band
is placed against the chips' real bottom edge (a run that earns a record, a ship, a
mission and three stats wraps to a second chip row) and gives up height rather than being
drawn through; the band picks the **fewest rows** that hold every frame it has, so a run
that died in S0 gets two big frames instead of a half-empty strip.

**The footer is never conditional.** Tagline, `flytunl.ch/play` and a QR sit under a
hairline on every card. Until 2026-09-20 the URL was the *else* branch of the world rank,
so every card good enough to be worth sharing carried no address at all - forwarded as an
image (screenshot, story, any picture-only network) it was a number from a stranger with
no way back to the game. The header carries the **date** for the same reason: the tagline
promises "the same tunnel for everyone today" and the picture never said which day.

The **QR** is a self-contained encoder in `share.js` (byte mode, ECC M, versions 1-9,
`test-share.js` proves it by reversing the placement and checking the Reed-Solomon
syndromes, not by looking at it). It encodes `shareRunUrl(true)` - the link **without**
the ghost, ~80 characters, version 5 - because a ghost is up to 1500 characters and would
push the code past what is scannable at any size a card can afford.

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
   pulses in the day accent rather than cycling the whole hue wheel. (The title screen's
   world line cycled the hue wheel too until 2026-09-16; it now takes the day accent as
   well - see "Typography and title accent".)
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

### Approach over the city ("Anflug", 2026-09-19)

`src/approach.js` (doc block at its top). Every run opens over the day's metropolis at dusk
(three parallax silhouette layers, beacons in the day colour) and flies through a rock mouth
into the safe opening flight; the title screen IS that city. Every run, PLAY AGAIN included,
reaches the cave 4s later than before (`APPROACH_SEC` = `START_RAMP_SEC` + 4, user's call: the
start stays the same every time). If it is ever shortened, keep it above ~2.3s or the ship
launches through the mountain foot.
"ENTERING THE TUNL" (`T.entering`, 15 langs) shows over the city; the world banner and the
score wait for the cave. Concept: https://claude.ai/artifact/ECrpmHcPeTsREMwEtK6vNs
- **The city lies before world-x 0, never in it.** `scrollX` stays 0; only `approachLeft`
  (a camera offset) moves, and `drawWorld()` draws the cave translated + clipped by it.
  `update.js` returns right after the physics while `approachLeft > 0`, so no clock, hazard,
  score, flight-time achievement or ghost step runs early. Score, sectors and `test-cave.js`
  are untouched. Don't turn the city into world-x: every score and threshold would shift.
- **No parallax behind a wall** (see "No parallax background"): the skyline exists only left of
  the mountain, and the cave's own void shows through the mouth (`APPROACH_BLEND`).
- **The mouth is the same rock as the cave** (wall colour, stone pattern, day-coloured edge),
  solid all the way into the cave's lethal walls.
- **No soft walls (2026-09-19, "keine Gummiwände mehr").** Over the city the mountain face and
  the screen edges only bounce the ship; from the mouth on (`approachUpdate`) the tunnel rule
  applies at once: a wall contact spends a hull scratch, with none left it kills. The whole
  soft-wall layer (translucent field, dents and rings, `safeWallBump`, `wallsSafe()`,
  `SAFE_FIELD_*`, `SAFE_BUMP_*`) is deleted. Near-miss and the red danger flash now run from
  the tunnel entry; the "walls now deadly" hint fires as the ship enters.
- **The tunnel start was darkened with it** (`DEPTH_LIFT` 0.15 -> 0.05, `DEPTH_MOUTH_ALPHA`
  0.24 -> 0.10): lit by a city at dusk, the old values made the cave a bright olive hall,
  lighter than the sky outside. Sector steps keep their ratios.
- Not done yet: city/tunnel audio (dry outside, cave reverb on entry), the S0 debriefing scene
  showing the mouth, and a device pass (WebKit, 812x375).

### Onboarding

**The first ~50 points of every run are an open, hazard-free flight** (2026-09-13, from
beginner feedback "too hard, frustrating, deleted it"; `SAFE_START_WX` doc block in
`constants.js`, `safeOpenAt()` in `world.js`). Until world-x 3000 the corridor is pushed
out to the screen edges (`boundsAt()` only, never `boundsBase()`), easing shut over the last
1800px. **No stalactites, mines, boulders or cannon fire** until `HAZARD_START_WX` (3400);
boulders from 6620, cannons from 7000 so no shot lands inside the zone. Coins and the warp
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

### Ad cadence

Every 4th death **and** at most once per 120s of wall clock, above `MIN_REAL_RUN_SCORE`
(75, `constants.js`; mirrored as `minScoreForAd` in `AdsManager.swift`/`.kt` and
`AD_MIN_SCORE` in `ads-web.js` - keep all four in sync), never with Remove Ads. That
floor was 25 everywhere until 2026-09-14, which the 12.0 safe opening flight had silently
turned into a no-op - see the `MIN_REAL_RUN_SCORE` doc block. The wall-clock floor is the rule that actually matters: a good run lasts only
20-36 real seconds, so a pure every-Nth-death rule put a full-screen ad in front of
engaged players roughly every 90 seconds. When the floor blocks, the death counter is
rolled back one so the two rules don't compound into a much longer gap than intended.

That is the only *forced* ad. There are also two **opt-in rewarded videos**, each on its
own dedicated AdMob unit and each still shown to Remove Ads owners (Remove Ads buys out
the forced interstitial, not a video the player actively taps):
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

Every paid ship (`SKINS` in `src/constants.js`) needs two things at once:
- **`cost` shards** - earned from collected coins (`runCoins`, banked at death), capped
  daily by `DAILY_SHARD_CAP` = 160. The 3 daily missions and the once-per-day rewarded-ad
  bonus (`SHARDS_AD_REWARD` = 20) are exempt, so the real ceiling is
  160+20+30+40+50 = **300/day**.
- **`stardustGate` days played** - `stardust` in `state.js`, +1 per calendar day opened
  regardless of skill or how much is played, +1 bonus per 7-day unbroken streak. Never
  spent, only checked as a `>=` threshold, so a tier's gate doesn't stack on the next.

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
- **Purely visual** - no perk, hitbox, placement or leaderboard effect. No `shadowBlur`.
  The ghost and the wrecked death frame always draw FACTORY.
- **Bought once for the hangar, equipped per ship** (`shipLiveries` in `state.js`, key
  `tunnel_ship_liveries`, migrated from the old single `tunnel_livery`), so each ship keeps
  its own look without re-buying anything. **Not part of Unlock All Ships** (separate save
  keys `tunnel_liveries` / `tunnel_ship_liveries`). Names are untranslated proper nouns, like ship names.
- **It re-shades the ship's own facets** (`_shipTones` livery arg) or paints a clipped
  pattern (`_drawLiveryOverlay`), **never changes the hue**, so ship identity stays readable.
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

Later phases in the concept: exhausts and trails, wreck effects and share-card frames,
mastery/achievement rewards, and only then an optional real-money pack of named items
(never random drops).

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

## Possible future features

- Multiple difficulty modes
- Mobile fullscreen on iOS/Android
- Level theming (lava/ice/neon)
- Additional coin types beyond the current eight (gold/blue/red/orange/green/bomb + the two hazards poison/drain)
- Friend ghosts carried inside a share link (see Ghost run below - the local ghost is
  already only a few hundred bytes, so a shared one is mostly a transport problem)
