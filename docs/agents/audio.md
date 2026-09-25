# Audio

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the measurements and rejected alternatives behind them are in `docs/design-history.md` (the 2026-09-21 condensing moved the removed paragraphs there verbatim, under "Narratives moved out of docs/agents").

## Audio bus and loudness (do not revert)

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

- **`MASTER_GAIN`** sets the mix near -18 LUFS; it used to sit far below mobile games and
  below the interstitial ad that interrupts it.
- **The limiter is a `WaveShaper` soft clipper, never a `DynamicsCompressor`** (a
  compressor cost 9 dB on percussive sfx). Exactly linear below `LIMIT_KNEE`, so it only
  rounds off the rare frame where several loud events coincide.
- **Loudness hierarchy (loudest-50ms):** death > shield break > milestone > shield/magnet >
  cannon fire > coin / near-miss / combo ~ music bed > thrust > UI. **The rule is warnings >
  rare rewards > routine pickups > the thrust bed.** Match any new sound into it, then
  re-measure (current dB values: `docs/design-history.md` -> "Audio bus and loudness").
- **Low-end layers do not exist on a phone speaker** (below ~300-400 Hz rolls off), so a
  flat RMS measurement flatters thrust, death roar and booms. Each carries a mid-band
  partner (`THRUST_PRESENCE_GAIN`, the crunch layers in `sfxDie`/`sfxBomb`/
  `sfxMineExplode`). The thrust presence layer is shared by all ships, keeping per-ship
  balance intact.
- **The death impact is on frame 0.** It once landed after the freeze frame ended.
- **Death is a crash ("Crash"), neither a pop nor a drum** (`sfxDie`, `DIE_LEVEL`): a
  low-passed noise thud, a thinning cluster of crunch grains, crumpling and tearing metal,
  the ship's buzz-saw engine dying sputtering, a short fireball tail, low debris. **No short
  bright crack or band-passed noise burst on the hit** (with the sub inaudible on a phone
  that pair read as a bursting balloon) **and no tonal sine drop dominating the onset** (read
  as a timpani hit). `DIE_LEVEL` is matched at phone-speaker level (400 Hz highpass), not
  full-band. Study page with the rejected variants:
  https://claude.ai/artifact/DyhLCjt75X7s12u9m8oT5A
- **Spool-up is a low turbofan, "rollendes Grollen"** (`sfxEngineSpoolUp`): lowpassed air
  roar + rumble under a slow tremolo, a buzz-saw and one quiet sine, on a slow-start rev
  curve. User's brief: "low, may stay low, like an airliner turbine" - **no partials above
  ~700 Hz**; for phone presence lean on the buzz-saw harmonics, not a whine. Study with the
  rejected variants: https://claude.ai/artifact/D7D9hELLqBerVNddPgPk4X
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
- **Both tracks loop on `loopStart`/`loopEnd`, never the raw buffer** (the masters carry
  their own fade-out), with the seam crossfaded into the material before the loop start
  (`_bakeBgmLoop` - one baked buffer, one source node, so `playbackRate` effects still
  work). Loop points `BGM_LOOP_START/END` and the title equivalents. **The files are never
  re-encoded to fix a seam** ("encode once from the source" rule in `audio.js`), so the
  same constants hold for the `.web.m4a` builds.
- **Death plays the song's own ending.** `die()` collapses the loop, then `_playBgmOutro()`
  fades in the track's ending (from `BGM_OUTRO_START`) through its own gain node, unlooped.
  `_stopBgmOutro()` cuts it on restart, revive and return to title. `commitDeath()`
  deliberately does NOT start the title music - the ending plays through the continue offer
  and the debriefing; the piano returns only on the title screen.
- **One sound, one meaning.** Hull scratch (`sfxHullScratch`) and revive (`sfxRevive`) do
  not reuse `sfxShieldBreak`.
- **Stereo, centred on the ship** (`_sfxOut(x)`): cannon fire, mine blasts, rock hits and
  cracks pan by screen x relative to `PX`, capped at `SFX_PAN_MAX`; ship-local sounds stay
  centre. **The `Math.SQRT2` in front of the panner is load-bearing** - without it every
  panned sound is ~3 dB quieter (equal-power panner on an upmixed mono source).
- **Per-call variation** (`_vary`): small pitch/level jitter on bullets, cracks, cannon, rock hits.
- **The gold coin is in the play track's key**: Nebula is D major, so the blips are D5 + A5
  with in-key 3x/4x partials and a 3ms attack.
- **Hazard telegraphs, audio only (no `rng()`)**: `sfxCannonArm` `CANNON_ARM_SEC` before a
  cannon fires; `sfxStalCreak` while a loose falling stalactite is on screen, until detach.
  Both quiet, under a coin.
- **Cave reverb** (`_caveSend`): one shared generated convolver per context, unit-energy IR,
  so `CAVE_VERB_WET` is the level (not ear-checked on a device yet - that is the knob).
  Sends only from impacts, blasts, cracks, cannon, creak, shield break, hull scratch and the
  death crash; coins, UI, pickups and the thruster stay dry; the bomb keeps `_bombVerb`.
- **Approach wind** (`approachWindOn`/`approachWindEnter`/`approachWindOff`, 2026-09-24): a
  wind bed over the city, cut where the ship passes the rock mouth (the lowpass closes to
  `APPROACH_WIND_DULL_HZ`, the level drops, and the wind's last moment rings out through
  `_caveSend`). **No tonal hit on the entry.** The send taps the wind before the closing
  lowpass through its own `APPROACH_WIND_ROOM_HZ` lowpass: after the lowpass the ring sat under
  what a phone plays; with no lowpass it rang brighter than the wind outside. Measured offline
  in the real bus (phone band, >400 Hz): ~5 dB under the play track and ~8 dB under PEARL's
  thrust at its peak, the spool-up ~17 dB above it during the ramp, the mix +1.2 dB. It is
  stopped on death, title, interruption and every new run, and is not restarted after a pause.
  `test-sim.js` checks that the swell's predicted mouth time matches the real crossing.
- **Settings: music and sound are three-level** (`musicLevel`/`fxLevel`, `state.js`; FULL ->
  LOW -> OFF, stored '1'/'low'/'0' so old saves read the same). Levels ride
  `_musicLvl`/`_fxLvl`, **never `_musicBus.gain`, which `musicDuck()` owns**
  (`AUDIO_LOW_GAIN`). No vibration toggle (no room).
- **Interruption pause** (`pauseForInterrupt`, `input.js`; `PAUSE_REVEAL_SEC` doc in
  `constants.js`): losing focus mid-run freezes into the revive countdown with the cave
  covered. It ends with **no** `HIT_INVULN_SEC` - backgrounding must never be a free
  invulnerability button.

- **Music follows the flight plan** (2026-09-24, review item S1; doc block above
  `MUSIC_SECTOR_FROM` in `audio.js`): the play chain is gain -> `_bgmLift` -> `_bgmShelf`
  -> lowpass. From `MUSIC_SECTOR_FROM` each sector adds a small lift + presence shelf up to
  `MUSIC_SECTOR_FULL` (measured +1.1 LUFS, +1.4 dB phone band at full; pickups stay ~7 dB
  above the bed), gliding over `MUSIC_SECTOR_GLIDE`, so no boundary is heard as an event.
  **No per-boundary gesture.** The build-and-drop (lowpass dip + noise riser before every
  boundary) was removed 2026-09-25 on the user's call ("stoert"): a boundary comes every
  `SECTOR_SEC`, so it pumped the music every few seconds, off the beat, and the closing
  filter read like the death sweep. `test-sim.js` checks one step per boundary and that
  `bgmSectorBuild` stays gone.

Still open, deliberately: wall-proximity audio and the title sonar pulse. Review proposals and the user's picks:
https://claude.ai/artifact/6KC3aJhYAAfthzVXtX5oAa

