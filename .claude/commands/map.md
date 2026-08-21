# TUNL source map

The game is split across `tunl.html` (HTML/CSS shell only) and 12 JS files in `src/`. All files share one global scope - scripts load in order via `<script src>` tags, no modules, no build step.

## Load order and contents

| File | What lives here |
|---|---|
| `src/constants.js` | Canvas (`cv`, `ctx`), `W`/`H`/`FS`, physics (`GRAVITY`, `THRUST`, `MAX_VY`, `PX`, `PR`), coin constants (`GAP_PER_COIN`, `GAP_BONUS_MAX`, `GAP_DECAY`), `MINE_R`, `SKINS[]`, utils (`lerp`, `lerpClr`, `rgb`), seeded PRNG (`seedRng`, `rng`) |
| `src/world.js` | Tunnel wave state (`_prog`, `_halfGap`, etc.), `refreshWave()`, difficulty scalars (`scrollSpd`, `stalSpacing`, `stalLenFrac`, `coinSpacing`, `mineSpacing`), daily world name (`WORLD_NAME`), tunnel geometry (`centerAt`, `halfGapAt`, `boundsAt`, `boundsBase`) |
| `src/state.js` | All mutable `let` globals (phase, py, vy, scrollX, score, gapBonus, etc.) and localStorage init |
| `src/lifecycle.js` | `initAmbParts()`, `titleScreen()`, `startPlay()` |
| `src/systems.js` | Stalactites (`makeStal`, `maintainStalactites`), coins (`makeCoin`, `maintainCoins`, `checkCoinCollection`, `coinBlockedByStal`), bullets (`updateBullets`, `drawBullets`), mines (`makeMine`, `maintainMines`), collision math (`ptSeg2`, `inTri`, `stalHit`, `stalHitBullet`), particles (`burst`, `burstCoin`, `burstStalCrack`) |
| `src/audio.js` | BGM (`_startBgMusic`, `_fadeBgMusic`, `_playBgmBuffer`, `_initAC`), all SFX (`sfxCoin`, `sfxDie`, `sfxSlow`, `sfxShield`, `sfxMagnet`, `sfxShieldBreak`, `sfxMilestone`, `sfxNearMiss`, `sfxCombo`, `sfxMineExplode`, `sfxBulletPickup`, `sfxBulletFire`, `sfxStalCrack`), thruster audio (`thrustOn`, `thrustOff`) |
| `src/input.js` | `inRect()`, `onDown()`, `onUp()`, pointer/keyboard event listeners, `triggerMilestone()` |
| `src/update.js` | `let prev`, `update(dt)` (physics, scroll, collision, skin FX, particle tick), `die()` |
| `src/draw.js` | `getTheme()`, `drawCoinIcon()`, `shipPath()`, `drawShip()`, `draw()` (tunnel walls, stalactites, coins, player, HUD, title screen, death screen) |
| `src/share.js` | Daily run card: `SHARE_URL`, `shareWorthy()`, `shareAvailable()`, `_shareCardCanvas()` (offscreen run-profile PNG), `shareRunText()`, `shareRun()` (native bridge / Web Share fallback) |
| `src/main.js` | `window._freezeDraw`, `loop(ts)`, `titleScreen()` kick-off, initial `requestAnimationFrame` |

## Key cross-file dependencies

- `boundsAt()` (world.js) reads `gapBonus` (state.js) -- do not call it for coin/stal placement, use `boundsBase()` instead
- `draw()` calls `drawBullets()` from systems.js -- both are in separate files but share global scope fine
- `die()` (update.js) calls `thrustOff()`, `sfxDie()`, `_fadeBgMusic()` from audio.js
- `startPlay()` (lifecycle.js) calls `thrustOff()` and `_startBgMusic()` from audio.js
- `checkCoinCollection()` (systems.js) calls all `sfx*` functions from audio.js
- `update()` calls `triggerMilestone()` from input.js
- `share.js` reads `lastRunWx`/`lastRunY` (set in update.js `die()`), `bestSX`, and
  `boundsBase()` -- it must load before `main.js` starts the loop
- the ghost is drawn in draw.js *before* the Player block, never inside it (that block
  rotates around the player's own position)

## Finding things fast

- **Physics constants**: `src/constants.js` top
- **Difficulty tuning** (halfGap range, wave params, spawn spacing): `src/world.js` `refreshWave()` + `stalSpacing()` / `coinSpacing()` etc.
- **Coin type probabilities**: `src/systems.js` `makeCoin()`
- **Skin perks** (AMBER coin reach, CRIMSON hitbox, etc.): `src/constants.js` `SKINS[]` + applied in `src/systems.js` `checkCoinCollection()` and `src/update.js` collision block
- **Score formula**: `src/update.js` `update()` -- `score = Math.floor(scrollX / 60) + bonusScore`
- **Near-miss bonus**: `src/update.js` `update()` near-miss block
- **Coin combo multiplier**: `src/systems.js` `checkCoinCollection()`
- **Death screen layout**: `src/draw.js` `draw()` `phase === 'dead'` block
- **Title screen layout**: `src/draw.js` `draw()` `phase === 'title'` block
- **BGM file**: `the_mountain.mp3` in project root, loaded in `src/audio.js` `_initAC()`
- **DEV_INVINCIBLE flag**: `src/constants.js` line 14
