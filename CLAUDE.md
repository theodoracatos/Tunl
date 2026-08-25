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
`tunl.html` is an HTML/CSS shell that loads 12 plain scripts from `src/` in order - no
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
`W = window.innerWidth` (uncapped), `H = Math.min(window.innerHeight, 600)` - H is capped at 600 for consistent difficulty; W fills the screen so landscape layouts use the full width.

### Physics constants
```javascript
const GRAVITY = 1150;  // px/s² downward
const THRUST  = 2400;  // px/s² upward when holding (net: 1250 up)
const MAX_VY  = 820;   // terminal velocity cap
```
Net upward force (1250) is slightly stronger than net downward (1150) - climbing is a
touch more responsive than falling, deliberately. Do NOT change this ratio, it's the
core feel of the game.

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
const GAP_PER_COIN  = H * 0.06;    // +26px halfGap per coin at H=440
const GAP_BONUS_MAX = H * 0.15;    // cap: max ~66px halfGap bonus at H=440
const GAP_DECAY     = H * 0.015;   // ~4s per coin at constant decay rate
```
Wall glow shifts purple → cyan when bonus is active. Gold bar at bottom shows remaining bonus.

### Difficulty scaling functions

Two-phase difficulty system:
- `_prog  = Math.min(Math.sqrt(scrollX / 14000), 1)` - main ramp (sqrt eased), 0→1 over first 14000px (~score 233)
- `_prog2 = Math.min(Math.max(scrollX - 14000, 0) / 40000, 1)` - inferno, 0→1 from 14000→54000px

All of these are then multiplied by the day's `DAY_ARCHETYPES` entry (`world.js`), so a
given day runs a bit denser or sparser than the base curve.

```javascript
scrollSpd()    // 230 → 400 → 560 px/s at W=600, scaled by W/600, then an uncapped sqrt tail
stalSpacing()  // 260 → 145 → 70 px between stalactites (floor 50)
stalLenFrac()  // 0.46 → 0.64 → 0.76 fraction of halfGap (hard cap 0.80)
coinSpacing()  // 600 → 320 → 230 px between coins (floor 175)
mineSpacing()  // 900 → 340 → 200 px between mines (floor 200)
cannonSpacing()// 4200 → 2400 → 1500 px between cannons (floor 1200)
chicaneProb    // 0.24 → 0.42 once _prog > 0.40 (hard cap 0.62)
```

At score 233 (`_prog` = 1) the full corridor is `2 * H * 0.163`. With `gapBonus` maxed
(`GAP_BONUS_MAX` = `H * 0.15` of extra halfGap, i.e. `H * 0.30` of extra full width) a
maxed bonus nearly doubles the corridor - coins are essential at high difficulty.

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

### Daily run card (share)

`src/share.js`. TUNL seeds every run from the UTC date (`lifecycle.js`), so every player
on Earth flies a pixel-identical cave each day - the hard half of a shareable daily game.
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
session, first submit still in flight) the old 5-row layout renders unchanged.

No backend: `GKLeaderboard.loadEntries` (`GameView.swift` `fetchWorldRank`) and
`loadLeaderboardMetadata`'s `LeaderboardVariant` (`MainActivity.kt` `fetchWorldRank`)
both already return rank *and* total count. Both fire after a submit resolves, and once
at auth to prime the first death of a session. The delta is computed in
`main.js _tunlNativeUpdate`, not natively - only the page knows what rank it last showed.

That local list is `top5`, which is **wiped at the UTC day boundary** (`lifecycle.js`),
so it is labelled `T.todayTop`, never "TOP 5" - the old label made it look like lost data
every morning.

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

Recording and playback are indexed by `scrollX`, never elapsed time - a blue coin halves
scroll speed for 4 seconds, which would desync a time-indexed ghost from the tunnel.

The ghost is drawn *before* the Player block in `draw.js`, not inside it: that block
applies a `rotate()` pivoted on the player's position, which would swing the ghost around
the live ship on every pitch change.

### Onboarding

`runsTotal` (`state.js`) is a lifetime run counter, never reset at the day boundary. Its
only consumer is `FIRST_RUN_RUNWAY_WX` (`lifecycle.js`), a clear stretch before the first
stalactite on the very first run a player ever starts, so their first lesson is the feel
of thrust-vs-gravity rather than the death screen.

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

## Key design decisions (do not revert)

- **Coin bonus is a real difficulty lever, not a marginal aid**: `GAP_PER_COIN` = H*0.06, `GAP_BONUS_MAX` = H*0.15 (see Coin system above) - at max difficulty (196px full corridor at H=600) one coin adds ~37% to the halfGap, a maxed bonus nearly doubles it. Coins are essential at high difficulty by design, not a small nudge - don't shrink these constants back down to make the bonus merely "helpful."
- **boundsBase for coin placement**: Coins placed ignoring current bonus so they're always reachable even without a bonus. Never use `boundsAt()` for coin placement.
- **Triangle-circle collision**: Stalactites use proper geometric collision matching the visual triangle, not AABB. Changing to AABB would make invisible collisions at the edges.
- **No em dashes (-)** anywhere in code, comments, or UI text. Use hyphen-minus (-) instead.
- **The death screen's left-column banner is one merged line, not three branches**: ship
  unlock, mastery level-up and the shard payout used to be three `if`s all targeting
  `H*0.78` and all suppressing each other, so a good run could earn all three and be shown
  one. There is genuinely only one slot there (panel edge below, button row below that),
  so the parts concatenate onto that line and shrink to fit. Don't split them back out.
- **XML comments can't contain `--`**: the no-em-dash rule means `--` is used constantly
  in JS comments, but it is illegal inside an XML comment. `AndroidManifest.xml` and
  `res/xml/*.xml` use single hyphens or a colon instead.
- **`scrollSpd()` never plateaus**: every other difficulty knob (`stalSpacing`, `stalLenFrac`, `coinSpacing`, `mineSpacing`, wave amplitude/frequency) caps once `_prog2` saturates, because those define corridor *geometry* and pushing them further would make the tunnel unnavigable. Scroll speed has no such ceiling - it only shrinks reaction time - so past `_prog2 > 1` (score ~900) it keeps climbing forever via a sqrt-eased tail (`base + sqrt(_prog2-1)*90`), intentionally so a long enough run is never merely "endurance at a fixed pace." Don't re-add a hard cap here.

## Possible future features

- Animated background parallax layers
- Multiple difficulty modes
- Mobile fullscreen on iOS/Android
- Level theming (lava/ice/neon)
- Additional power-up types beyond the current seven (gold/blue/red/orange/green/bomb/poison)
- Friend ghosts carried inside a share link (see Ghost run below - the local ghost is
  already only a few hundred bytes, so a shared one is mostly a transport problem)
- A playable web build. Deliberately NOT on the roadmap right now: the user decided
  against it. If it comes back, the remaining blockers are a portrait/rotate overlay and
  an install CTA - the launch-time audio cost that used to head this list is fixed (see
  the lazy loaders in `audio.js`), though the two MP3s would still want smaller web
  encodes before shipping over a link.
