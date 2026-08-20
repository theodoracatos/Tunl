# TUNL - Claude Code Instructions

## Working style

- Just do the task. Don't ask for confirmation before reading files, running searches, or making straightforward edits.
- Don't ask clarifying questions if the intent is clear from context - make a reasonable choice and do it.
- Only ask when something is genuinely ambiguous AND the wrong choice would be hard to undo.

## What is this

TUNL is a single-file HTML5 Canvas hold-to-thrust cave flyer game.
Single file: `tunl.html` - no libraries, no build step.
Open in a browser to play.

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
`W = window.innerWidth` (uncapped), `H = Math.min(window.innerHeight, 600)` - H is capped at 600 for consistent difficulty; W fills the screen so landscape layouts use the full width.

### Physics constants
```javascript
const GRAVITY = 950;   // px/s² downward
const THRUST  = 1900;  // px/s² upward when holding (net: 950 up)
const MAX_VY  = 680;   // terminal velocity cap
```
The thrust/gravity balance is symmetric: net upward force = net downward force = 950 px/s².
Do NOT change this ratio - it's the core feel of the game.

### Player
```javascript
const PX = W * 0.22;   // fixed horizontal position on screen
const PR = W * 0.018;  // radius (≈10.8px at W=600)
```

### Procedural tunnel
Two overlapping sin waves, amplitude and frequency scale with difficulty (`_prog`).
`_prog = Math.min(Math.sqrt(scrollX / 14000), 1)` - sqrt easing: fast early ramp, plateau near max. Reaches max difficulty at 14000 world px (~score 233).

```javascript
_halfGap = lerp(H * 0.34,  H * 0.163, _prog);  // 204→98px half-gap (rendering/collision)
_wA1     = lerp(H * 0.07,  H * 0.12,  _prog);   // wave amplitude 1
_wA2     = lerp(H * 0.035, H * 0.055, _prog);   // wave amplitude 2
_wF1     = lerp(0.0025,    0.0048,    _prog);    // wave frequency 1
_wF2     = lerp(0.0060,    0.0115,    _prog);    // wave frequency 2
```

Two bounds functions:
- `boundsAt(wx)` - includes coin bonus - used for rendering AND collision
- `boundsBase(wx)` - base only (no bonus) - used only for placing coins safely

### Stalactites
Triangle-shaped obstacles from top or bottom wall. Accurate triangle-circle collision (not AABB).
Paired stalactites (chicane from both sides) appear after `_prog > 0.40` with 24% chance.

### Cannons
Rare wall-mounted artillery turret (`src/systems.js` `makeCannon`/`maintainCannons`/
`updateCannonShots`), first appearing at wx=6000 (score ~100) and spaced far apart
(`cannonSpacing()` in `src/world.js`, floor 1200px vs. every other obstacle's sub-300px
floor) - a rare set-piece, not a recurring hazard. Each cannon is inert (not solid, can't
be flown into) until the player closes to within `CANNON_FIRE_LEAD` world-px, at which
point it fires exactly one diagonal shot toward the opposite wall and goes dormant.
Shots reuse the player's own bullet sprite (`drawProjectile` in `src/systems.js`) so a
cannon shot reads as literal enemy fire, not a different weapon type - only its diagonal
angle (vs. the player's always-horizontal bullets) tells them apart. Same hitbox
trade-offs and shield-absorb behavior as mine collision; player bullets destroy a shot
in flight the same way they destroy a mine.

### Coin system
Coins collect into `gapBonus` (extra halfGap px, capped, decays over time):
```javascript
const GAP_PER_COIN  = H * 0.04;    // +15.6px halfGap per coin at H=390
const GAP_BONUS_MAX = H * 0.10;    // cap: max ~39px halfGap bonus (+30% corridor width)
const GAP_DECAY     = H * 0.010;   // ~4s per coin at constant decay rate
```
Wall glow shifts purple → cyan when bonus is active. Gold bar at bottom shows remaining bonus.

### Difficulty scaling functions

Two-phase difficulty system:
- `_prog  = Math.min(Math.sqrt(scrollX / 14000), 1)` - main ramp (sqrt eased), 0→1 over first 14000px (~score 233)
- `_prog2 = Math.min(Math.max(scrollX - 14000, 0) / 40000, 1)` - inferno, 0→1 from 14000→54000px

```javascript
scrollSpd()    // 380 → 650 → 900 px/s
stalSpacing()  // 260 → 145 → 70 px between stalactites
stalLenFrac()  // 0.36 → 0.50 → 0.60 fraction of halfGap (also the max cap)
coinSpacing()  // 600 → 320 → 230 px between coins
chicaneProb    // 0 → 0.24 → 0.42 probability of paired stalactites
```

At score 233 (_prog=1): full corridor = 196px, chicane clear = ~78px (3.6× player dia=21.6px).
With gapBonus maxed (+36px halfGap = +72px full): effective chicane clear ~150px - coins are essential at high difficulty.

### Coin type progression

Coins are staged by `_prog` so power-ups introduce gradually:
- score 0-11 (_prog < 0.22): gold only (gap bonus)
- score 11-33 (_prog 0.22-0.38): + blue (slow time, 4s half-speed)
- score 34-70 (_prog 0.38-0.55): + red (shield, absorbs 1 hit) + orange (bullet ammo)
- score 71+ (_prog >= 0.55): + green (magnet, pulls coins)

Mines (bombs) first spawn at wx=1800 (score ~30); shield coins unlock at score ~34 so the player faces mines briefly without protection - intentional.

**Poison/bomb rarity**: both unlock at score ~34+ (`_prog >= 0.38`, same gate as
red/orange) and are driven by a real-time clock, not a per-coin-candidate percentage
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
breaks the coin combo and removes a flat amount of `runCoins`
(`POISON_LOSS_MIN`->`POISON_LOSS_MAX`, 3 early -> 6 late, `lerp` on `_prog`) - flat, not
a % of the pool, so repeated hits over a long run add up linearly instead of compounding
multiplicatively (a %-based tax's survivor fraction is ~0.8^N over N hits - close to a
full wipeout for a long marathon run). Sized against the ~20s poison interval above: a
live replay of today's seed put total poison damage at ~10-23% of a "great" run's coin
pool across realistic phone widths - noticeable, never zero, never crushing. Comes out
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
- only poison opts out of that shared path).

### Addictive systems

**Score formula**: `score = Math.floor(scrollX / 60) + bonusScore`
`bonusScore` accumulates from coin collection and near-miss bonuses; resets each run.

**Milestone moments**: Triggers at 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600...
Step size widens with score via `milestoneStep()` (`world.js`): 25 below 100, 50 up to
300, 100 up to 1000, 250 up to 3000, 500 up to 10000, 1000 beyond - uncapped, keeps
growing forever rather than settling into a fixed step (same "never just endurance at a
fixed pace" philosophy as `scrollSpd()`, see its own doc comment). Originally a flat +50
step past 100, which meant a strong player blowing past 200-1000 in under a minute hit a
milestone every ~50 points, every one of them already-maxed-out `!!!` (see below) -
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

**Death screen context**: Shows "+X vs last" / "-X vs last" after the second run. Uses `prevRunScore` (run before the current one). Score number glows gold when within 5 of personal best.

## Key design decisions (do not revert)

- **Coin bonus is intentionally modest**: +15px per coin, max +36px halfGap. At max difficulty the full corridor is 196px; one coin adds ~15%, max bonus adds ~37%. This is helpful but not a free pass.
- **boundsBase for coin placement**: Coins placed ignoring current bonus so they're always reachable even without a bonus. Never use `boundsAt()` for coin placement.
- **Triangle-circle collision**: Stalactites use proper geometric collision matching the visual triangle, not AABB. Changing to AABB would make invisible collisions at the edges.
- **No em dashes (-)** anywhere in code, comments, or UI text. Use hyphen-minus (-) instead.
- **`scrollSpd()` never plateaus**: every other difficulty knob (`stalSpacing`, `stalLenFrac`, `coinSpacing`, `mineSpacing`, wave amplitude/frequency) caps once `_prog2` saturates, because those define corridor *geometry* and pushing them further would make the tunnel unnavigable. Scroll speed has no such ceiling - it only shrinks reaction time - so past `_prog2 > 1` (score ~900) it keeps climbing forever via a sqrt-eased tail (`base + sqrt(_prog2-1)*90`), intentionally so a long enough run is never merely "endurance at a fixed pace." Don't re-add a hard cap here.

## Possible future features

- Animated background parallax layers
- Multiple difficulty modes
- Mobile fullscreen on iOS/Android
- Level theming (lava/ice/neon)
- Additional power-up types beyond the current six (gold/blue/red/orange/green/bomb)
