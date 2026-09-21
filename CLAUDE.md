# TUNL - Claude Code Instructions

## Working style

- Just do the task. Don't ask for confirmation before reading files, running searches, or making straightforward edits.
- Don't ask clarifying questions if the intent is clear from context - make a reasonable choice and do it.
- Only ask when something is genuinely ambiguous AND the wrong choice would be hard to undo.

## How this file is organised (read first)

This file holds **the rule, and when to read more**. Each topic has a file in `docs/agents/`
with the full rationale, the constants involved and the traps already hit. **Before changing
anything in a topic's area, read its file** - most rules below exist because an agent (or a
player) broke them once. `docs/design-history.md` holds the older measurement narratives
and rejected alternatives; append to it when you change a decision.

Older references of the form `CLAUDE.md "<Section>"` (in memories, design-history, commit
messages) mean that heading in `docs/agents/` - every section was moved there verbatim
on 2026-09-21: `grep -n '^## <Section>' docs/agents/*.md`.

Do not copy numbers from code into these docs - name the constant (`BOULDER_START_WX`),
not its value. Numbers copied here are what went stale.

## Secret-scanning pre-push hook

`.githooks/pre-push` blocks a `git push` whose new commits add a secrets-looking filename
(`.env`, `*.pem`, `appsettings.Production.json`, ...) or content matching a secret pattern,
**and blocks a tip that still has a `DEV_* = true` flag in `src/constants.js`**
(`DEV_INVINCIBLE` / `DEV_PAUSE_KEY` / `DEV_WALLET`, checked on the tip's file content).
Each clone must run `git config core.hooksPath .githooks` once. Bypass with
`git push --no-verify` only after confirming a false positive. `/check-secrets` gives the
same verdict mid-session.

## What is this

TUNL is an HTML5 Canvas hold-to-thrust cave flyer. `tunl.html` loads 18 plain scripts from
`src/` in order - no libraries, no modules, no build step, one shared global scope. Run
`/map` for the file map. Open `tunl.html` in a browser to play.

**Tests: `npm test`** runs six zero-dependency suites (~7s). `test-sim.js` loads every script
but `main.js` into a Node vm and plays S0-S10, the death screen and the title; it is the
only suite that executes `update.js`, `draw.js`, `lifecycle.js` or `approach.js`.
**Test the real function, never a copy of its formula in the test** - a 2026-09-21 mutation
audit found 12 of 14 injected regressions passing because checks asserted mirrored
formulas. Its date is pinned (`TUNL_SIM_DAY` overrides); keep new checks day-independent
and sweep a few dozen days before relying on one.

**Orientation: landscape only.** `Info.plist` locks to `LandscapeLeft + LandscapeRight`. Never change this.

**Three targets from one `src/`**: iOS app (WKWebView), Android app (WebView, assets
mirrored - see `reference_android_assets_mirror` memory) and the web build at
**flytunl.ch/play** (`flytunl-site/`, bundled by `build-play.mjs`, deployed by
`flytunl-site/deploy.sh`). **A web change must never alter app behaviour and vice versa** -
gate every gameplay/layout/text change in a shared file on `isWeb()` (`src/web.js`,
reliably `false` in both apps). Build tooling, the site and tests need no gate.

**i18n:** any UI string change touches all 15 languages in `src/i18n.js`; run `node test-i18n.js`.

## How to play

HOLD (tap/click/Space/ArrowUp) = thrust up, RELEASE = gravity. Collect coins (gold widens
the corridor), avoid stalactites, mines, boulders, cannon shots and walls.
`score = floor(scrollX / 60) + bonusScore`. Phases: `'title'` | `'play'` | `'dead'`.

## Hard rules (all targets)

- **No em dashes** anywhere in code, comments or UI text. Use hyphen-minus.
- **XML comments can't contain `--`**: `AndroidManifest.xml` and `res/xml/*.xml` use a
  single hyphen or a colon instead.
- **No debug shortcut ships unguarded**: `input.js`'s `KeyP` freeze is gated behind
  `DEV_PAUSE_KEY` (ships `false`). An unguarded one gave web players unlimited thinking
  time on a shared leaderboard. `window._freezeDraw` itself stays for headless playtests.
- **Never make score < 233 harder** in a balance pass without the user asking; retune by
  measured rate / duty cycle (the replay-harness method), never by a spacing number.
- **No score gate at or below 50** (`MIN_REAL_RUN_SCORE` doc in `constants.js`): the safe
  opening flight makes 50 free.

## Which docs to read before editing a file

Pick the row for the file you are about to change and read those `docs/agents/` files first.

| file | read first |
|------|-----------|
| `update.js` | physics, fairness, hazards, coins |
| `systems.js` (spawners, `make*`/`maintain*`) | fairness, hazards, coins; then run `test-cave.js` |
| `world.js` (curves, `boundsAt`/`boundsBase`, sectors) | difficulty, fairness, coins |
| `constants.js` | the topic of the constant you touch (its doc block names it) |
| `lifecycle.js`, `state.js` | fairness (rng streams, world-x cursors), onboarding |
| `draw.js` ship / 3D hull / liveries | ship-render, economy |
| `draw.js` walls, HUD, title, depth light | visuals, hazards (crystals) |
| `draw.js` death screen, freeze frame | screens |
| `share.js` | screens |
| `approach.js` | onboarding |
| `audio.js` | audio |
| `input.js` | screens (milestones), README (hard rules) |
| `ads-web.js`, `main.js` web frame, ad/IAP native code | economy |
| `fonts.js` | visuals |
| `branding/` | ship-render |

## Topic rules and where the detail lives

### Physics and canvas -> `docs/agents/physics.md`
- W capped at 956 on every platform, H at 600 (520 Android app, 440 web): leaderboard fairness.
- **THRUST has been walked back twice on player feedback** - read the tuning history before touching it. Hold-to-thrust is an acceleration ramp, not an impulse.
- **Trapezoid integration** in `update.js` (`py += (vyPrev + vy) * 0.5 * dt`) - do not revert; `test-sim.js` guards it.
- **GRAVITY/THRUST/MAX_VY scale by `_FEEL_SCALE = H / _H_REF`** on every device. New vertical-motion code stays ratio-based - never compare `vy` against an unscaled px/s literal.

### Cross-device fairness -> `docs/agents/fairness.md`
Read it and run `test-cave.js` after touching any `maintain*()` / `make*()` / difficulty curve.
- Sample difficulty at the **placement** wx, never the player's.
- Placement geometry in **reference units** (`PLACE_*`, `_H_TO_REF`), not screen units.
- **One rng stream per spawner.** Cadences tuned in seconds are stored as **world-x** (`worldPxForSec()`).
- `SPAWN_AHEAD_*` budget: raise the horizon, never clamp retry offsets. Vetoes are geometric and same-wall.
- Coins are the fixed point: rocks and mines yield to coins. Keep `maintainCoins()` before boulders/mines.

### Difficulty, tunnel, flight plan -> `docs/agents/difficulty.md`
- A run is **sectors of `SECTOR_SEC`**; densities are rates per reference second (`sectorRate`). Do not revert to per-hazard world-px curves. **Check `MISSION_DEFS` before moving a coin gate.**
- `scrollSpd()` never plateaus. Don't re-add a cap.
- Corridor width uses its own slower clock (`gapProgAt`); don't merge back into `_prog`. Wave frequencies stay on `_prog`.
- Deep-run variety (`_deepVarietyOn` kill switch): the morph never adds wiggle energy, frequencies untouched, the speed pulse is surge-only.

### Hazards -> `docs/agents/hazards.md`
- Stalactites are **crystals** (`CRYSTAL_STALS`); main crystal on the axis at full length, one blitted sprite per spike. Triangle-circle collision, never AABB.
- Falling stalactites: fall distance recomputed live each frame, scrollX-indexed.
- Boulders are rock islands with two guaranteed passes; don't push them further out without leaderboard data.
- Cannons: barrel, shell and exit line share the **tunnel** frame. `rngCannon()` ordering invariant - re-check if spawn/fire distances move.
- Warp portal: cadence is a **duty cycle**; no warp coin; the hit window is the drawn radius; the wall never kills during a warp.
- **Mines are what guarantees every run ends** - never wall-anchored or bonus-aware; `MINE_RETRY_OFFSETS` keeps density up deep.

### Coins -> `docs/agents/coins.md`
- Gap bonus magnitudes are **fractions of the half-gap**, not of H. Coins are a real difficulty lever - don't shrink them.
- `boundsBase()` for coin placement, never `boundsAt()`.
- Chicane gold is gated in **seconds** via `lastChicaneCoinWx`. Power-up supply has real-time floors; vetoed power-ups are skipped, never downgraded to gold; orange is exempt.
- Poison/bomb/drain are real-time **clocks**, never per-candidate percentages.
- Coins draw the object they do, no frame, no `shadowBlur`. Shield type id stays `'red'` (drawn violet).

### Audio -> `docs/agents/audio.md`
- **Judge by offline render, never by ear** (`reference_audio_method` memory).
- Soft-clip `WaveShaper` limiter, never a `DynamicsCompressor`. Keep the loudness hierarchy: warnings > rare rewards > routine pickups > thrust bed.
- Loops use baked `loopStart`/`loopEnd`; never re-encode the files to fix a seam. Spool-up stays below ~700 Hz.

### Ship rendering -> `docs/agents/ship-render.md`
- Envelope: span +-0.98r, nose +1.40r - do not grow it. `PR` untouched.
- Flight uses the 3D view (`SHIP_VIEW_3D`, roll 60 deg); hangar, shop and share card stay top-down.
- Brand marks are generated from the hull (`branding/gen-ship-glyph.mjs`); rerun after any hull change.

### Visuals, typography, HUD -> `docs/agents/visuals.md`
- Fonts via `FONT_UI` / `FONT_NUM` only; no Courier. Test layout on **WebKit**, not only Chrome.
- **No parallax background** (tried, removed). Depth light: never bright, steps not fades, light behind the ship only.

### Scoring, share card, death screen, ghost -> `docs/agents/screens.md`
- Milestone ladder seeded at 75; ON FIRE and all-time record are **score** crossings, not positions.
- Death screen: 5 type steps, day accent, every vertical step `max(H-fraction, type-derived)`, rewards as a wrapping chip row.
- Share card carries the debriefing content; the footer (URL + QR) is never conditional.
- Ghost is indexed by `scrollX` and scoped to the calendar day.

### Approach and onboarding -> `docs/agents/onboarding.md`
- The city lies before world-x 0 (camera offset), never in it. No soft walls.
- Safe opening flight to `SAFE_START_WX`; opening coins teach RELEASE.
- `START_RAMP_SEC` stays 1.3s (user's call). **No title-screen control hint.**

### Ads, economy, liveries -> `docs/agents/economy.md`
- Ad floor `MIN_REAL_RUN_SCORE` is mirrored in `AdsManager.swift`/`.kt` and `ads-web.js` - keep all four in sync.
- Rewarded continue repairs the hull, no extra shield. Web's offer slot pitches the app and **never grants a revive**.
- Shard ladder is set so stardust binds at every tier - re-run the numbers before changing either side.
- Liveries are purely visual, bought once, equipped per ship, never change hue.
