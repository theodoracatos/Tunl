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

### Addictive systems

**Score formula**: `score = Math.floor(scrollX / 60) + bonusScore`
`bonusScore` accumulates from coin collection and near-miss bonuses; resets each run.

**Milestone moments**: Triggers at 25, 50, 75, 100, 150, 200, 250... (steps of 25 below 100, then 50).
Shows big floating text + gold particle burst + ascending chord. `milestoneFlash` decays over ~0.6s.

**Near-miss bonus**: +1 bonusScore when wall clearance < `PR * 2.0` (within 2 player radii of wall).
1.5s cooldown prevents spam. Shows "+CLOSE" notif + quick ascending ping sfx.

**Coin combo multiplier**: Coins collected within 2s of each other build a streak.
Score pts = `coinCombo * 3` (so x1=+3, x2=+6, x3=+9...). Shows "x2", "x3" notif above gold coin notif.
Blue/red coins join the streak but their notif doesn't change (power-up is the reward).

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
- Additional power-up types beyond the current five
