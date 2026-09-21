# Audio

Moved verbatim from CLAUDE.md on 2026-09-21 (progressive disclosure). CLAUDE.md keeps the one-line rule and points here.

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

