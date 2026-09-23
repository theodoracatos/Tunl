# TUNL source map

The game is split across `tunl.html` (HTML/CSS shell only) and 18 JS files in `src/`. All files share one global scope - scripts load in order via `<script src>` tags, no modules, no build step. The table below is in load order - keep it in sync with the `<script src>` tags in `tunl.html`.

## Load order and contents

| File | What lives here |
|---|---|
| `src/web.js` | Loaded FIRST. Host detection: `isWeb()`, `isAndroidApp()` (both key off `window.webkit.messageHandlers.haptic` / `window.TunlNative`). Deep-link param parsing (`?d=` day, `?g=` ghost, `?s=` ghost score), `_tunlActiveDate()` / `_tunlActiveDayInt()`. All web-vs-app divergences elsewhere gate on `isWeb()` |
| `src/fonts.js` | Loaded SECOND. The only two font stacks the canvas uses: `FONT_UI` (Chakra Petch) and `FONT_NUM` (JetBrains Mono), shipped as base64 woff2 inside this file. `fontsReady` + `FONT_WAIT_MS` (main.js holds the first frame on it). No literal family name exists anywhere else |
| `src/i18n.js` | `LANGS` (15-locale string table), `LANG_ORDER`, `detectLang()`, `activeLang`, `T` (active locale's strings), `setLang()`. Run `node test-i18n.js` after any string change |
| `src/constants.js` | Canvas (`cv`, `ctx`), `W`/`H`/`FS`, physics (`GRAVITY`, `THRUST`, `MAX_VY`, `PX`, `PR`), coin constants (`GAP_PER_COIN_FRAC`, `GAP_BONUS_MAX_FRAC`, `GAP_DECAY_FRAC` - fractions of the corridor's own half-gap since 12.0; the px accessors `gapPerCoin()`/`gapBonusMax()`/`gapDecay()` live in `world.js`), `MINE_R`, `SKINS[]`, utils (`lerp`, `lerpClr`, `rgb`), seeded PRNG (`seedRng`, `rng`) |
| `src/world.js` | Tunnel wave state (`_prog`, `_halfGap`, etc.), `refreshWave()`, difficulty scalars (`scrollSpd`, `stalSpacing`, `stalLenFrac`, `coinSpacing`, `mineSpacing`, plus the sector-rate layer `sectorRate`/`sectorEnvelope` and the separate pacing clocks `gapProgAt`/`hazProgAt`), daily world name (`WORLD_NAME`), tunnel geometry (`centerAt`, `halfGapAt`, `boundsAt`, `boundsBase`) |
| `src/state.js` | All mutable `let` globals (phase, py, vy, scrollX, score, gapBonus, etc.) and localStorage init |
| `src/lifecycle.js` | `initAmbParts()`, `titleScreen()`, `startPlay()` |
| `src/systems.js` | Stalactites (`makeStal`, `maintainStalactites`), coins (`makeCoin`, `maintainCoins`, `checkCoinCollection`, `coinBlockedByStal`), bullets (`updateBullets`, `drawBullets`), mines (`makeMine`, `maintainMines`), collision math (`ptSeg2`, `inTri`, `stalHit`, `stalHitBullet`), particles (`burst`, `burstCoin`, `burstStalCrack`) |
| `src/audio.js` | The bus (`_initAC`: sfx bus + music bus -> `MASTER_GAIN` -> soft-clip limiter; `_caveSend` reverb, `_sfxOut(x)` stereo pan), music (`_playBgmBuffer`, `_bakeBgmLoop`, `_playBgmOutro`, `_fadeBgMusic`, `musicDuck`, `bgmSetSlow`, `bgmSetWarp`), ~40 `sfx*` one-shots, thruster + magnet loops (`thrustOn`/`thrustOff`, `magnetLoopOn`/`Off`). Judge any new sound by offline render + spectrogram, never by ear-guess - see `docs/agents/audio.md` |
| `src/input.js` | `inRect()`, `onDown()`, `onUp()`, pointer/keyboard event listeners, `triggerMilestone()` |
| `src/update.js` | `let prev`, `update(dt)` (physics, scroll, collision, skin FX, particle tick), `die()` |
| `src/draw.js` | `getTheme()`, `drawCoinIcon()`, `shipPath()`, `drawShip()`, `draw()` (tunnel walls, stalactites, coins, player, HUD, title screen, death screen) |
| `src/paint.js` | Hangar paint (Lackiererei): `_paintShade()`, `paintSignals()`, `_drawPaintOverlay()` (pattern, material, effect on drawShip/drawShip3D), `drawPaintSheet()`, `paintSheetTap()`, `paintRandomKit()` |
| `src/approach.js` | Run opening over the city ("Anflug"): `approachStart()`, `approachUpdate()`, `approachRock()` (mountain + mouth profile), `drawApproachScene()` (dusk sky, skyline, mountain), `drawApproachBanner()`; title screen = the city |
| `src/share.js` | Daily run card: `SHARE_URL`, `shareWorthy()`, `shareAvailable()`, `_shareCardCanvas()` (offscreen run-profile PNG), `shareRunText()`, `shareRun()` (native bridge / Web Share fallback), `shareRunUrl()` (web `/play?d=&s=&g=` deep link) |
| `src/record.js` | Web-only "record this run" button for flytunl.ch/play: `startRecording()`/`stopRecording()`/`toggleRecording()`, MediaRecorder onto a dedicated offscreen canvas at a fixed 1912x880 (`REC_OUT_SCALE`) so every clip exports at the same size regardless of DPR/window. Used for the TikTok clip workflow. No-op in both apps |
| `src/notify.js` | Daily-reminder bridge only (native owns the 19:00-local scheduling via `NotificationManager.swift` / `ReminderScheduler.kt`). Hands native the localized text + "played today" flag. No-ops in a browser |
| `src/main.js` | `window._freezeDraw`, `loop(ts)`, `titleScreen()` kick-off, initial `requestAnimationFrame`, `_updatePortraitGate()` / `_syncWebCta()` (web only), `_tunlNativeUpdate` |
| `src/ads-web.js` | Loaded LAST. Web-only ad cadence (Google Ad Manager H5 Games Ads via `googletag`, not the AdMob SDK): forced interstitial, rewarded continue (`reviveRequest`), rewarded shard bonus. `isWeb()`-gated, no-op in both apps |

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
- **BGM files**: `audio/the_mountain.mp3` (play track, "Nebula") and `audio/the_mountain_documentary.mp3` (title piano), plus their `.web.m4a` twins for the web build, all in `audio/`; every target reproduces that folder next to the page (`BGM_DIR` in `src/audio.js`); loop points are `BGM_LOOP_START/END` there too
- **DEV_INVINCIBLE flag**: `src/constants.js` (`const DEV_INVINCIBLE = false`, ~line 96), read in `src/update.js`
- **isWeb() / isAndroidApp() / deep-link params**: `src/web.js` (loaded first)
- **Translation strings (T.*), locale list**: `src/i18n.js`
- **Web ad cadence**: `src/ads-web.js` (loaded last, web-only)
