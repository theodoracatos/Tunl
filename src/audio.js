// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── Audio ─────────────────────────────────────────────────────────────

let _ac = null, _tVoice = null;
// Every sfx/bgm node in this file connects to _master (created in _initAC) instead of
// straight to _ac.destination -- one bus in front of the real output, so record.js can
// tap it into a MediaStreamAudioDestinationNode (audioRecordStream below) without a
// second synthesis path. Purely a pass-through node: connecting a second destination
// off it never mutes or alters the speakers.
let _master = null;
// Music rides its own bus (2026-09-17 audio audit) so the death sweep, the title/play
// crossfade and musicDuck() can move ALL music without touching a single sfx, and so the
// limiter below sees music and sfx as one summed programme the way a real mixer would.
// _master keeps its name and its role as the sfx bus - every sfx in this file still
// connects straight to it, which is why none of them needed touching.
let _musicBus = null, _outGain = null, _limiter = null;
let _fNode = null, _fGain = null;
let _mNode = null, _mGain = null, _mOsc = null;
let _wNode = null, _wGain = null, _wOsc = null;
// Last-fired bullet-fire voices, so a death mid-burst can cut them off instead of
// letting the tail ring on into sfxDie (see sfxBulletFireStop below).
let _bfVoices = [];
let _bgmBuf = null, _bgmNode = null, _bgmGain = null, _bgmFlt = null;
let _bgmOutroBuf = null, _outroNode = null, _outroGain = null;  // the track's own ending, played on death
let _bgmLoading = false, _titleBgmLoading = false; // in-flight guards for the lazy loaders
let _bgmActive = false, _bgmPending = false;
let _titleBgmBuf = null, _titleBgmNode = null, _titleBgmGain = null, _titleBgmFlt = null;
let _titleBgmActive = false, _titleBgmPending = false;

// Music bed gains, one per track, calibrated so each track sits where the SFX mix was
// tuned against: the_mountain.mp3 (-6.3 LUFS) at gain 0.10. Both tracks are a single
// 192kbps stereo encode straight from the 256kbps sources (2026-09-15): the earlier
// copies were -16 LUFS normalised and transcoded 128kbps twice over, which audibly lost
// quality. Always encode once from the source, never loudness-normalise the files - set
// the level here instead. Title track
// (the_mountain-piano, -10.6 LUFS) sits 4.4 dB under the old -15.0 title bed's mix
// position once scaled. If a track is replaced, re-measure with ffmpeg ebur128 and
// rescale: gain = 0.10 * 10^((-6.3 - newLUFS) / 20) for the in-game track.
const BGM_GAIN       = 0.25;   // nebula track (-11.3 LUFS, 2026-09-18), +3 dB on request; the old the_mountain.mp3 was 0.10
// Title bed raised 0.058 -> 0.100 (+4.7 dB) on 2026-09-17. Measured, the title screen
// sat at ~-35.5 LUFS against the play screen's ~-26.5: a 9 dB step on every single run
// start, and quiet enough that the UI taps (~-37 dB momentary) were UNDER their own
// music. Still ~4 dB below the play bed, which is the intent - the title screen is the
// calm one - but a step, not a cliff, and the crossfade below smooths what's left.
const TITLE_BGM_GAIN = 0.141;  // +3 dB over 0.100 (2026-09-18, on request)

// ── Master bus: gain then limiter (2026-09-17 audio audit) ───────────────────
// Until 13.0 _master was a bare pass-through into _ac.destination: no limiter anywhere,
// so headroom was the only thing between the mix and a clipped output, and every voice
// in this file had to stay conservatively quiet to guarantee it. That cost twice over.
// Measured integrated level of a real run was about -24 LUFS while mobile games and,
// more to the point, the AdMob interstitial that follows a death sit around -14 to -16 -
// so the ad after every 4th death came in 8-10 dB LOUDER than the game it interrupts.
// MASTER_GAIN lifts the whole programme and the limiter catches what that pushes over.
// Peaks before this: the loudest single sfx was sfxMineExplode at -7.5 dBFS, so +6 dB
// lands it at -1.5 dB, under the threshold as a peak, with the limiter there for the
// cases where several land on the same frame (mine + crack + thrust + music).
// DynamicsCompressor is a soft-knee RMS compressor, not a true brickwall, hence the
// hard knee, the high ratio and the fast attack - it is a safety net on the sum, not a
// loudness tool, and nothing in this file should be tuned to hit it in normal play.
// The safety net is a WaveShaper soft clipper, NOT a DynamicsCompressor - measured, and
// do not swap it back. A compressor was tried first and rejected twice over: it is a
// broadband gain reducer with a release window, so one loud transient ducks everything
// around it for the next 150-250ms, and percussive sfx came out of the boost QUIETER
// than they went in (sfxMineExplode's loudest 50ms measured -26.6 dB through the
// compressor against -17.3 dB with it bypassed - a 9 dB tax on the exact sounds the
// boost was for, and it acted well below its own threshold). The shaper instead is
// EXACTLY linear below LIMIT_KNEE and only rounds off what would otherwise clip, so
// nothing in normal play is touched at all - verified by rendering each sfx with and
// without it in the chain and comparing. The saturation it adds on the rare overs is
// harmonic, which on a phone speaker helps rather than hurts.
const MASTER_GAIN    = 1.6;    // +4 dB; measures ~-18 LUFS integrated in play
const LIMIT_KNEE     = 0.70;   // ~-3.1 dBFS: linear below this, soft above
const LIMIT_CEIL     = 1.00;   // asymptote: the shaper can never output past full scale

// Soft-clip curve: identity up to LIMIT_KNEE, then a tanh shoulder that approaches
// LIMIT_CEIL without ever reaching it.
function _limiterCurve() {
    const n = 8192, c = new Float32Array(n);
    const span = LIMIT_CEIL - LIMIT_KNEE;
    for (let i = 0; i < n; i++) {
        const x = (i * 2) / (n - 1) - 1;
        const a = Math.abs(x);
        const y = a <= LIMIT_KNEE ? a : LIMIT_KNEE + span * Math.tanh((a - LIMIT_KNEE) / span);
        c[i] = x < 0 ? -y : y;
    }
    return c;
}

// Music crossfade / duck timings (seconds).
const MUSIC_FADE_SEC  = 0.30;  // title <-> play crossfade, and every music fade-in
const MUSIC_DUCK_DB   = 3.5;   // how far music steps back under a big one-shot
const MUSIC_DUCK_SEC  = 0.40;  // how long it stays there before gliding back

// Loop points, in seconds into each file (2026-09-17). Both tracks are ordinary
// masters, not loops: the_mountain fades out over its last ~3s into silence,
// the_mountain_documentary fades from ~114.5s, and both open with a
// short lead-in. Looping the raw buffer therefore played a fade-out, a hole and a
// fade-in every pass - loudest on the title screen, where the track loops while the
// player sits there and it reads as "the song ended". BufferSource.loopStart/loopEnd
// keep the lead-in as a one-time intro and then cycle the body only. Measured from the
// EBU momentary envelope (full level from ~8s / ~0.2s, fade starting ~61s / ~114.5s),
// NOT by re-encoding the files - see the "always encode once from the source" rule
// above; the same numbers therefore hold for the .web.m4a encodes.
// Play track = the Nebula master (72s, 2026-09-18): 140 BPM, 1.714s per bar, a quiet
// build-up to ~8s, full body to ~61s, then a quieter outro and a fade. The first loop
// (8.10 / 56.10, 28 bars) was heard on device on 2026-09-19 and the seam was a
// noticeable jump: the music does not repeat sample-exactly, and the waveform of the bar
// before the seam correlated only 0.33 with the bar before the loop start. Now the best
// pair on the bar grid (search over start bar x loop length 16-32 bars, bar-length
// normalised cross-correlation, +-60ms lag) is 11.53 / 38.96 = 16 bars, correlation 0.73,
// and the seam is additionally crossfaded (see _bakeBgmLoop). Chosen by ear from four
// candidates (hard cut vs crossfade, old vs new pair) - do not lengthen the loop without
// re-running that search.
const BGM_LOOP_START       = 11.53, BGM_LOOP_END       = 11.53 + 16 * 1.714286;
const BGM_LOOP_XFADE       = 0.857;   // half a bar, equal-power
// The track's own ending (2026-09-19): full body drops to a quiet pad at ~61.8s, one last
// hit at ~68.5s, then a decay to silence at ~71.7s. Played once on death in place of the
// loop (see _playBgmOutro), then silence until the title screen's own music.
const BGM_OUTRO_START      = 61.75;
const BGM_OUTRO_DELAY      = 0.20;    // the loop collapses first (DEATH_MUSIC_SEC), then this fades in
const BGM_OUTRO_FADE_IN    = 0.60;
// Title track (2026-09-19): the whole song loops, back to 18.0 after 114.0 (bar grid at
// 120 BPM, 2s per bar). The old pair (0.30 / 114.50) cut into the piece's own fade-out
// and landed on unrelated material (waveform correlation -0.11). No exact repeat exists
// for a 114s seam (the piece has copy-pasted sections, 0-16s = 66-82s and 84-96s =
// 100-112s, but nothing that matches the end against the start), so the seam is a 4s
// equal-power crossfade into the material before the start (_bakeBgmLoop). Pair chosen
// by 12-bin chroma similarity of the 4s before each point: 0.96 for 18/114.
const TITLE_BGM_LOOP_START = 18.0,  TITLE_BGM_LOOP_END = 114.0;
const TITLE_BGM_LOOP_XFADE = 4.0;

function _startBgMusic() {
    _stopBgmOutro();
    if (!musicOn) return;
    if (_bgmActive) return;  // already playing - don't restart
    _bgmActive = true;
    // Reset gain in case it was faded to near-zero during death. Ramped, not snapped:
    // the death sweep below takes the music down through a closing lowpass, and a run
    // restarting has to come back up the same way rather than punching in at full level
    // (the restart tap is often inside the death fade's own tail).
    if (_bgmGain && _ac) {
        const t = _ac.currentTime;
        _bgmGain.gain.cancelScheduledValues(t);
        _bgmGain.gain.setValueAtTime(Math.max(_bgmGain.gain.value, 0.0001), t);
        _bgmGain.gain.linearRampToValueAtTime(BGM_GAIN, t + MUSIC_FADE_SEC);
    }
    _bgmOpenFilter();
    if (_bgmBuf) { _playBgmBuffer(); return; }
    // Not loaded yet - mark pending and kick the loader (no-op if already in flight);
    // it starts playback itself once the buffer lands.
    _bgmPending = true;
    _loadBgmBuffer();
}

function _playBgmBuffer() {
    if (!_ac || !_bgmBuf || !_bgmActive) return;
    // gain -> lowpass -> music bus. The filter is wide open in normal play and only
    // moves for the death sweep (_fadeBgMusic), which is why it can live here rather
    // than being built and torn down per death.
    if (!_bgmGain) {
        _bgmGain = _ac.createGain(); _bgmGain.gain.value = 0.0001;
        _bgmFlt  = _ac.createBiquadFilter();
        _bgmFlt.type = 'lowpass'; _bgmFlt.frequency.value = 20000; _bgmFlt.Q.value = 0.7;
        _bgmGain.connect(_bgmFlt); _bgmFlt.connect(_musicBus);
        const t = _ac.currentTime;
        _bgmGain.gain.setValueAtTime(0.0001, t);
        _bgmGain.gain.linearRampToValueAtTime(BGM_GAIN, t + MUSIC_FADE_SEC);
    }
    _bgmOpenFilter();
    _bgmNode = _ac.createBufferSource();
    _bgmNode.buffer = _bgmBuf;
    _bgmNode.loop = true;
    // Skip the lead-in and the fade-out on every pass after the first - see the
    // BGM_LOOP_START doc block.
    if (_bgmBuf.duration > BGM_LOOP_START + 1) {
        _bgmNode.loopStart = BGM_LOOP_START;
        _bgmNode.loopEnd   = Math.min(BGM_LOOP_END, _bgmBuf.duration);
    }
    _bgmNode.connect(_bgmGain);
    _bgmNode.start();
}

// Snaps the play-music lowpass back open (the death sweep leaves it closed down at
// DEATH_MUSIC_HZ). Short ramp rather than an assignment so a restart during the sweep
// does not step.
function _bgmOpenFilter() {
    if (!_ac || !_bgmFlt) return;
    const t = _ac.currentTime;
    _bgmFlt.frequency.cancelScheduledValues(t);
    _bgmFlt.frequency.setValueAtTime(_bgmFlt.frequency.value, t);
    _bgmFlt.frequency.exponentialRampToValueAtTime(20000, t + MUSIC_FADE_SEC);
}

// Death (update.js die()). Used to be a 50ms ramp to silence - the music simply stopped,
// on the same frame as the hit, which is the one moment in the game that wants a gesture
// rather than a cut. Now it collapses: the lowpass closes to DEATH_MUSIC_HZ while the
// level falls, over DEATH_MUSIC_SEC, which is DEATH_REPLAY_SEC (the freeze frame, before
// the debriefing panel paints) plus a beat. The world stops, the room closes over it,
// and sfxDie's own impact lands on frame 0 into the space that opens up. The node is
// still hard-stopped afterwards, so nothing here changes the restart path.
const DEATH_MUSIC_SEC = 0.55;
const DEATH_MUSIC_HZ  = 300;
function _fadeBgMusic() {
    _bgmActive = false;
    _bgmPending = false;
    let faded = false;
    if (_bgmGain && _bgmNode) {
        faded = true;
        const t = _ac.currentTime;
        _bgmGain.gain.cancelScheduledValues(t);
        _bgmGain.gain.setValueAtTime(_bgmGain.gain.value, t);
        _bgmGain.gain.setTargetAtTime(0.0001, t + 0.10, 0.16);
        if (_bgmFlt) {
            _bgmFlt.frequency.cancelScheduledValues(t);
            _bgmFlt.frequency.setValueAtTime(_bgmFlt.frequency.value, t);
            _bgmFlt.frequency.exponentialRampToValueAtTime(DEATH_MUSIC_HZ, t + DEATH_MUSIC_SEC * 0.8);
        }
        const n = _bgmNode; _bgmNode = null;
        n.onended = null;  // prevent ghost restart from stopped node
        setTimeout(() => { try { n.stop(); } catch(e){} }, DEATH_MUSIC_SEC * 1000 + 80);
    }
    return faded;
}

// The song's real ending on the death screen instead of a fade to nothing. Only when the
// play music was actually sounding (_fadeBgMusic returns true), so music-off and
// not-yet-loaded stay silent. Any restart, revive or return to the title cuts it through
// _stopBgmOutro, and nothing loops it: after the last decay there is silence until the
// title screen starts its own track.
function _playBgmOutro() {
    if (!_ac || !_bgmOutroBuf || !musicOn) return;
    _stopBgmOutro(0.05);
    const t = _ac.currentTime;
    _outroGain = _ac.createGain();
    _outroGain.gain.setValueAtTime(0.0001, t);
    _outroGain.gain.setValueAtTime(0.0001, t + BGM_OUTRO_DELAY);
    _outroGain.gain.linearRampToValueAtTime(BGM_GAIN, t + BGM_OUTRO_DELAY + BGM_OUTRO_FADE_IN);
    _outroGain.connect(_musicBus);
    _outroNode = _ac.createBufferSource();
    _outroNode.buffer = _bgmOutroBuf;
    _outroNode.connect(_outroGain);
    const n = _outroNode, g = _outroGain;
    n.onended = () => { try { g.disconnect(); } catch (e) {} if (_outroNode === n) { _outroNode = null; _outroGain = null; } };
    n.start(t + BGM_OUTRO_DELAY);
}

function _stopBgmOutro(fade) {
    if (!_outroNode || !_ac) return;
    const n = _outroNode, g = _outroGain, d = (fade === undefined) ? 0.25 : fade;
    _outroNode = null; _outroGain = null;
    try {
        const t = _ac.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
        g.gain.linearRampToValueAtTime(0.0001, t + d);
        n.onended = () => { try { g.disconnect(); } catch (e) {} };
        n.stop(t + d + 0.02);
    } catch (e) {}
}

// Steps the whole music bus back by MUSIC_DUCK_DB for a moment so a one-shot that
// matters (a milestone, a record, the shield taking a hit for you) lands in its own
// space instead of fighting a bed that is only ~2 dB below it. Bus-level, so it works
// for title and play music alike and never touches an sfx. Overlapping ducks just
// re-arm the same ramp; the release is a setTargetAtTime glide, not a step.
function musicDuck(dB, dur) {
    if (!_ac || !_musicBus) return;
    const t = _ac.currentTime;
    const g = _musicBus.gain;
    const lvl = Math.pow(10, -(dB || MUSIC_DUCK_DB) / 20);
    try {
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(lvl, t + 0.04);
        g.setTargetAtTime(1.0, t + (dur || MUSIC_DUCK_SEC), 0.12);
    } catch (e) {}
}

// Blue coin slows the scroll to 60% for its duration (systems.js). The music follows
// with a *glide*, not a step: it sags to 0.6x on pickup, then eases continuously back
// up to normal speed across the whole slow-time window, landing on 1.0x right as the
// effect runs out. A second blue coin mid-effect just restarts the glide from whatever
// the rate currently is, over the new (topped-up) `duration`. Rides
// _bgmNode.playbackRate, so pitch sags and recovers with it - that ramp IS the effect.
// No-op when music is off or the buffer hasn't started playing yet. `on=false` (the
// belt-and-braces calls in update.js on slowTime hitting 0, plus startPlay/die) just
// snaps the rate home in case the glide and the gameplay timer ever drift apart.
function bgmSetSlow(on, duration) {
    if (!_ac || !_bgmNode) return;
    const t    = _ac.currentTime;
    const rate = _bgmNode.playbackRate;
    try {
        rate.cancelScheduledValues(t);
        rate.setValueAtTime(rate.value, t);
        if (on) {
            const dur = Math.max(duration || 0, 0.6);
            rate.linearRampToValueAtTime(0.6, t + 0.22);   // gentle sag on pickup
            rate.linearRampToValueAtTime(1.0, t + dur);    // then ease back up over the effect
        } else {
            rate.linearRampToValueAtTime(1.0, t + 0.15);
        }
    } catch (e) {}
}

// Warp portal (constants.js "Warp portal" doc) - the mirror image of bgmSetSlow
// above: a quick SURGE instead of a sag, then a glide back down to normal as the
// window runs out, so the soundtrack visibly speeds up with the tunnel instead of
// just the scroll doing it silently. Capped well under the warp's own 2.2-2.8x
// scrollSpd() multiplier (constants.js WARP_MULT_MIN/MAX - a gameplay scroll
// speed, not an audio pitch target, and one that now scales with depth) - a
// whole track played back at that speed stops reading as "faster" and starts
// reading as a chipmunked mess, the same
// reason bgmSetSlow's own floor (0.6x) is a moderate sag, not a near-stop. Same
// rate property as bgmSetSlow (_bgmNode.playbackRate), so the two are mutually
// exclusive in practice - whichever fires last wins the schedule - which is fine
// since both are short, rare, one-shot state changes, not something that needs
// composing. `on=false` (falling edge in update.js, belt-and-braces in
// startPlay/die) just snaps the rate home in case the glide and the gameplay
// timer ever drift apart, identical to bgmSetSlow's own off-path.
function bgmSetWarp(on, duration) {
    if (!_ac || !_bgmNode) return;
    const t    = _ac.currentTime;
    const rate = _bgmNode.playbackRate;
    try {
        rate.cancelScheduledValues(t);
        rate.setValueAtTime(rate.value, t);
        if (on) {
            const dur = Math.max(duration || 0, 0.4);
            rate.linearRampToValueAtTime(1.35, t + 0.12);  // quick surge on entry
            rate.linearRampToValueAtTime(1.0,  t + dur);   // glide back down over the window
        } else {
            rate.linearRampToValueAtTime(1.0, t + 0.15);
        }
    } catch (e) {}
}

function _startTitleMusic() {
    _stopBgmOutro();
    if (!musicOn) return;
    if (_titleBgmActive) return;  // already playing - don't restart
    _titleBgmActive = true;
    if (_titleBgmGain && _ac) {
        const t = _ac.currentTime;
        _titleBgmGain.gain.cancelScheduledValues(t);
        _titleBgmGain.gain.setValueAtTime(Math.max(_titleBgmGain.gain.value, 0.0001), t);
        _titleBgmGain.gain.linearRampToValueAtTime(TITLE_BGM_GAIN, t + MUSIC_FADE_SEC);
    }
    if (_titleBgmBuf) { _playTitleBgmBuffer(); return; }
    // Not loaded yet - mark pending and kick the loader (no-op if already in flight);
    // it starts playback itself once the buffer lands.
    _titleBgmPending = true;
    _loadTitleBgmBuffer();
}

function _playTitleBgmBuffer() {
    if (!_ac || !_titleBgmBuf || !_titleBgmActive) return;
    if (!_titleBgmGain) {
        _titleBgmGain = _ac.createGain(); _titleBgmGain.gain.value = 0.0001;
        _titleBgmGain.connect(_musicBus);
        const t = _ac.currentTime;
        _titleBgmGain.gain.setValueAtTime(0.0001, t);
        _titleBgmGain.gain.linearRampToValueAtTime(TITLE_BGM_GAIN, t + MUSIC_FADE_SEC);
    }
    _titleBgmNode = _ac.createBufferSource();
    _titleBgmNode.buffer = _titleBgmBuf;
    _titleBgmNode.loop = true;
    if (_titleBgmBuf.duration > TITLE_BGM_LOOP_START + 1) {
        _titleBgmNode.loopStart = TITLE_BGM_LOOP_START;
        _titleBgmNode.loopEnd   = Math.min(TITLE_BGM_LOOP_END, _titleBgmBuf.duration);
    }
    _titleBgmNode.connect(_titleBgmGain);
    _titleBgmNode.start();
}

// Leaving the title screen (startPlay, lifecycle). Fades over MUSIC_FADE_SEC against
// _startBgMusic's matching fade-in, so title and play music cross rather than the old
// 50ms cut-then-punch-in at a level 9 dB higher.
function _fadeTitleMusic(dur) {
    _titleBgmActive = false;
    _titleBgmPending = false;
    if (_titleBgmGain && _titleBgmNode) {
        const t = _ac.currentTime;
        const d = (dur === undefined) ? MUSIC_FADE_SEC : dur;
        _titleBgmGain.gain.cancelScheduledValues(t);
        _titleBgmGain.gain.setValueAtTime(_titleBgmGain.gain.value, t);
        _titleBgmGain.gain.linearRampToValueAtTime(0.0001, t + d);
        const n = _titleBgmNode; _titleBgmNode = null;
        setTimeout(() => { try { n.stop(); } catch(e){} }, d * 1000 + 60);
    }
}

function _initAC() {
    // Every thrust tap during play routes through here too (see input.js) - if
    // backgrounding fully closed the context, this must be able to recover it,
    // not just resume a merely-suspended one (see _reviveAudioContext below).
    if (_ac) { _reviveAudioContext(); return; }
    _ac = new (window.AudioContext || window.webkitAudioContext)();
    // sfx bus + music bus -> master gain -> limiter -> output. The gain sits BEFORE the
    // limiter on purpose: it is what pushes the programme up, and the limiter is what
    // catches the result. See the MASTER_GAIN doc block above.
    _master   = _ac.createGain();
    _musicBus = _ac.createGain();
    _outGain  = _ac.createGain();
    _outGain.gain.value = MASTER_GAIN;
    _limiter = _ac.createWaveShaper();
    _limiter.curve = _limiterCurve();
    _limiter.oversample = '4x';   // keeps the shoulder's harmonics out of the alias band
    _master.connect(_outGain);
    _musicBus.connect(_outGain);
    _outGain.connect(_limiter);
    _limiter.connect(_ac.destination);
    // WebKit sometimes creates the context in 'suspended' state even inside a
    // user gesture - resume it explicitly now, still within the gesture.
    if (_ac.state === 'suspended') _ac.resume();
    // Music buffers are NOT fetched here -- see _loadTitleBgmBuffer/_loadBgmBuffer.
    // Only re-kick whatever was already playing when the context was torn down
    // (_reviveAudioContext sets these), so backgrounding still recovers exactly as before.
    if (_titleBgmPending) _loadTitleBgmBuffer();
    if (_bgmPending)      _loadBgmBuffer();
}

// ── Lazy music loading ────────────────────────────────────────────────
// Both tracks used to be fetched and decoded right here in _initAC, i.e. on every
// launch, before the player had done anything -- 7.5 MB of mp3 plus the decoded PCM.
// None of it is needed to launch: sfx only need the AudioContext, the title track isn't wanted until
// title music actually starts, and the play track isn't wanted until a run begins.
// Loading on demand also means a player with music switched off now downloads and
// decodes nothing at all, where before they paid the full cost every launch and then
// threw it away.
//
// Each loader is at-most-once (guarded by its own buffer + in-flight flag) and captures
// the context it started against, so a decode still in flight when backgrounding tears
// the context down resolves into nothing instead of installing a buffer built on a dead
// context -- _reviveAudioContext re-kicks the loaders itself via _initAC above.

// The open web build (isWeb()) pulls a stereo 128kbps AAC encode of each track
// (~1/3 lighter than the mp3; the earlier mono ~66kbps encode sounded thin); build-play.mjs copies the .web.m4a files into
// play/. AAC decodes everywhere decodeAudioData is supported, so there's no
// fallback path. The app builds keep the full stereo mp3 - gradle's copyGameFiles
// and the Xcode resource refs list only the .mp3s, so the .m4a is never bundled.
function _bgmUrl(name) {
    return (typeof isWeb === 'function' && isWeb()) ? name + '.web.m4a' : name + '.mp3';
}

// Bakes the loop seam into a copy of the track, cut at the loop end. The last
// BGM_LOOP_XFADE seconds are an equal-power blend of the material before the loop end
// (fading out) and the material just before the loop START (fading in), so the wrap
// from end to start continues into the real audio that precedes the start - no cut, and
// still ONE source node, which keeps the playbackRate slow/warp effects working. Works
// on any decoder: an mp3/m4a delay offsets both loop points equally.
function _bakeBgmLoop(buf, loopStart, loopEnd, xfade) {
    try {
        const sr = buf.sampleRate;
        const s = Math.round(loopStart * sr), e = Math.round(loopEnd * sr);
        const n = Math.round(xfade * sr);
        if (buf.length < e || s < n) return buf;
        const out = _ac.createBuffer(buf.numberOfChannels, e, sr);
        for (let c = 0; c < buf.numberOfChannels; c++) {
            const src = buf.getChannelData(c), dst = out.getChannelData(c);
            dst.set(src.subarray(0, e));
            for (let i = 0; i < n; i++) {
                const a = (i + 0.5) / n * Math.PI / 2;
                dst[e - n + i] = src[e - n + i] * Math.cos(a) + src[s - n + i] * Math.sin(a);
            }
        }
        return out;
    } catch (err) { return buf; }
}

// The ending as its own small buffer, so the full decode can be dropped.
function _sliceOutro(buf) {
    try {
        const sr = buf.sampleRate, a = Math.round(BGM_OUTRO_START * sr);
        if (buf.length <= a + sr) return null;
        const out = _ac.createBuffer(buf.numberOfChannels, buf.length - a, sr);
        for (let c = 0; c < buf.numberOfChannels; c++) out.getChannelData(c).set(buf.getChannelData(c).subarray(a));
        return out;
    } catch (err) { return null; }
}

function _loadBgmBuffer() {
    if (!_ac || _bgmBuf || _bgmLoading) return;
    _bgmLoading = true;
    const ctx = _ac;
    fetch(_bgmUrl('the_mountain'))
        .then(r => r.arrayBuffer())
        .then(ab => ctx.decodeAudioData(ab))
        .then(buf => {
            _bgmLoading = false;
            if (_ac !== ctx) return;   // context rebuilt mid-load; revive path reloads
            _bgmBuf = _bakeBgmLoop(buf, BGM_LOOP_START, BGM_LOOP_END, BGM_LOOP_XFADE);
            _bgmOutroBuf = _sliceOutro(buf);
            if (_bgmPending && _bgmActive) { _bgmPending = false; _playBgmBuffer(); }
        })
        .catch(err => {
            _bgmLoading = false;
            console.error('[audio]', _bgmUrl('the_mountain'), 'load/decode failed:', err);
        });
}

function _loadTitleBgmBuffer() {
    if (!_ac || _titleBgmBuf || _titleBgmLoading) return;
    _titleBgmLoading = true;
    const ctx = _ac;
    fetch(_bgmUrl('the_mountain_documentary'))
        .then(r => r.arrayBuffer())
        .then(ab => ctx.decodeAudioData(ab))
        .then(buf => {
            _titleBgmLoading = false;
            if (_ac !== ctx) return;
            _titleBgmBuf = _bakeBgmLoop(buf, TITLE_BGM_LOOP_START, TITLE_BGM_LOOP_END, TITLE_BGM_LOOP_XFADE);
            if (_titleBgmPending && _titleBgmActive) { _titleBgmPending = false; _playTitleBgmBuffer(); }
            // Warm the play track now that the title track is in and the player is
            // sitting on the title screen anyway. Sequenced rather than parallel so it
            // never competes with the track that's actually audible right now, and so
            // the first run doesn't open on silence while 4.7 MB decodes.
            if (musicOn) _loadBgmBuffer();
        })
        .catch(err => {
            _titleBgmLoading = false;
            console.error('[audio]', _bgmUrl('the_mountain_documentary'), 'load/decode failed:', err);
        });
}

// WebKit auto-suspends the AudioContext after the app has been backgrounded
// for a while, and after long enough can fully *close* it rather than just
// suspend it. Previously this only fully rebuilt on 'closed' and tried
// .resume() + a fresh bgm node on 'suspended', on the theory that only the
// long-lived bgm/title-bgm nodes (started before the suspend) were affected.
// That undersold the bug: reports of *all* sound going silent (sfx included,
// not just bgm) after ~1min backgrounded show the problem isn't a stale node
// but the AudioContext's route to hardware itself not reconnecting - WebKit
// flips state to 'running' without actually restoring output. Since sfx get
// brand-new nodes on every call and still went silent, a fresh node into the
// same broken destination doesn't help. Don't trust resume() at all: tear
// down and recreate the whole context on 'suspended' exactly like 'closed'
// does, letting _bgmPending/_titleBgmPending (the same flags _initAC already
// uses while the mp3s are still decoding) replay whichever tracks were
// active once the fresh context + buffers are ready.
function _reviveAudioContext() {
    if (!_ac || _ac.state === 'running') return;
    // A live recording tap (record.js) is a node on the context about to be torn down --
    // there's no such thing as reconnecting a MediaRecorder's stream to a different
    // AudioContext's output mid-recording, so finalize whatever was captured instead of
    // leaving the file to go silent from here on.
    if (typeof _recOnAudioContextLost === 'function') _recOnAudioContextLost();
    try { _ac.close(); } catch(e){}
    _bgmPending = _bgmActive;
    _titleBgmPending = _titleBgmActive;
    _ac = null; _master = null; _musicBus = null; _outGain = null; _limiter = null;
    _bgmFlt = null; _titleBgmFlt = null; _bgmBuf = null; _bgmOutroBuf = null; _outroNode = null; _outroGain = null; _bgmNode = null; _bgmGain = null;
    _titleBgmBuf = null; _titleBgmNode = null; _titleBgmGain = null;
    // Any decode still in flight belongs to the context just closed and will drop itself
    // on the _ac !== ctx check; clear the guards so the fresh context can load again.
    _bgmLoading = false; _titleBgmLoading = false;
    _mNode = null; _mGain = null; _mOsc = null;  // magnet shimmer belonged to the closed context
    _wNode = null; _wGain = null; _wOsc = null;  // warp whoosh belonged to the closed context
    _initAC();
}
// visibilitychange is the fallback path - WKWebView doesn't always fire it
// reliably when the *native* app (rather than the page itself) backgrounds,
// which is why GameView.swift's Coordinator also calls window._tunlResumeAudio
// directly from applicationDidBecomeActive. Both paths funnel into the same
// revive logic so whichever fires first wins.
document.addEventListener('visibilitychange', () => { if (!document.hidden) _reviveAudioContext(); });
window._tunlResumeAudio = _reviveAudioContext;

// ── Recording tap (web only, record.js) ─────────────────────────────────
// A MediaStreamAudioDestinationNode fed from _master, in parallel with the real
// _ac.destination output -- record.js merges its stream's audio track with a
// canvas.captureStream() video track so a recorded run has actual game audio,
// not a second guess at what the mix sounds like. Connecting a second
// destination off _master never touches what the player hears.
let _recNode = null;
function audioRecordStream() {
    if (!_ac || !_limiter) return null;
    if (!_recNode) {
        // Tapped POST-limiter (was post-_master, pre-everything) so a recorded run
        // carries the same mix, master gain and limiting the player hears.
        _recNode = _ac.createMediaStreamDestination();
        _limiter.connect(_recNode);
    }
    return _recNode.stream;
}
function audioRecordStop() {
    if (_recNode && _limiter) { try { _limiter.disconnect(_recNode); } catch (e) {} }
    _recNode = null;
}

// Called from native (see AdsManager.swift) around interstitial ad presentation
// so bgm/sfx don't play under the ad's own audio.
function _pauseAudioForAd() {
    if (_ac && _ac.state === 'running') _ac.suspend();
}
function _resumeAudioAfterAd() {
    if (_ac && _ac.state === 'suspended') _ac.resume();
}

function _noiseBuf(dur) {
    const len = Math.ceil(_ac.sampleRate * dur);
    const buf = _ac.createBuffer(1, len, _ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random()*2-1;
    return buf;
}

function _distortionCurve(amount) {
    const n = 4096;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) curve[i] = Math.tanh((i * 2 / n - 1) * amount);
    return curve;
}

// The base pickup pitch climbs a major-pentatonic step per combo level, so a building
// streak is audible in the coin itself - the separate sfxCombo ping only fires from x2
// and never changes the coin sound. `combo` is 1-indexed (systems.js increments
// coinCombo before calling); the climb plateaus a major-tenth up so a long streak keeps
// brightening without shrieking, same "widen the step, never cap flat" idea as
// milestoneStep(). Called with no arg (combo -> NaN -> index 0) it falls back to the
// original 600/900 Hz two-blip.
function sfxCoin(combo) {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const STEPS = [0, 2, 4, 7, 9, 12, 14, 16];  // major pentatonic, semitones
    const semis = STEPS[Math.min(Math.max(((combo | 0) - 1), 0), STEPS.length - 1)];
    const mul   = Math.pow(2, semis / 12);
    [600 * mul, 900 * mul].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_master);
        o.type = 'sine'; o.frequency.value = freq;
        const t0 = t + i * 0.10;
        g.gain.setValueAtTime(0.14, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
        o.start(t0); o.stop(t0 + 0.16);
    });
}

// Turbine spool-up: a whine that climbs in pitch and level until the ship is ready to
// fly, then cuts off in a short release. `dur` is the time the player cannot act yet
// (START_RAMP_SEC on a run start, REVIVE_COUNTDOWN_SEC after a revive), so the sound
// lasts exactly as long as the ship is warming up. The whine and its harmonic live at
// 150-2500 Hz on purpose: a phone speaker drops everything below ~300 Hz, which is
// why the old bass-only roar was barely audible on device.
function sfxEngineSpoolUp(dur) {
    if (!_ac || !fxOn) return;
    dur = dur || 1.3;
    const t = _ac.currentTime;
    const end = t + dur;
    const rel = 0.14;  // release after the ship is ready

    // Main turbine whine: sawtooth through a lowpass that opens with the pitch.
    const o1 = _ac.createOscillator(), f1 = _ac.createBiquadFilter(), g1 = _ac.createGain();
    o1.type = 'sawtooth';
    o1.frequency.setValueAtTime(110, t);
    o1.frequency.exponentialRampToValueAtTime(420, t + dur * 0.55);
    o1.frequency.exponentialRampToValueAtTime(980, end);
    f1.type = 'lowpass'; f1.Q.value = 2;
    f1.frequency.setValueAtTime(500, t);
    f1.frequency.exponentialRampToValueAtTime(3200, end);
    g1.gain.setValueAtTime(0.001, t);
    g1.gain.linearRampToValueAtTime(0.10, t + dur * 0.35);
    g1.gain.linearRampToValueAtTime(0.16, end);
    g1.gain.linearRampToValueAtTime(0.001, end + rel);
    o1.connect(f1); f1.connect(g1); g1.connect(_master);
    o1.start(t); o1.stop(end + rel + 0.02);

    // Compressor-stage whine: a pure tone about 2.5x the main pitch, the thin
    // "turbine" sheen on top. Detuned from a clean harmonic so it beats a little.
    const o2 = _ac.createOscillator(), g2 = _ac.createGain();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(280, t);
    o2.frequency.exponentialRampToValueAtTime(1050, t + dur * 0.55);
    o2.frequency.exponentialRampToValueAtTime(2450, end);
    g2.gain.setValueAtTime(0.001, t);
    g2.gain.linearRampToValueAtTime(0.02, t + dur * 0.4);
    g2.gain.linearRampToValueAtTime(0.07, end);
    g2.gain.linearRampToValueAtTime(0.001, end + rel);
    o2.connect(g2); g2.connect(_master);
    o2.start(t); o2.stop(end + rel + 0.02);

    // Air hiss: bandpassed noise whose centre climbs with the whine.
    const n = _ac.createBufferSource();
    n.buffer = _noiseBuf(dur + rel + 0.05);
    const nf = _ac.createBiquadFilter(), ng = _ac.createGain();
    nf.type = 'bandpass'; nf.Q.value = 0.9;
    nf.frequency.setValueAtTime(700, t);
    nf.frequency.exponentialRampToValueAtTime(4200, end);
    ng.gain.setValueAtTime(0.001, t);
    ng.gain.linearRampToValueAtTime(0.05, t + dur * 0.5);
    ng.gain.linearRampToValueAtTime(0.11, end);
    ng.gain.linearRampToValueAtTime(0.001, end + rel);
    n.connect(nf); nf.connect(ng); ng.connect(_master);
    n.start(t); n.stop(end + rel + 0.05);

    // Low combustion rumble, kept from the old roar for weight on real speakers.
    const r = _ac.createBufferSource();
    r.buffer = _noiseBuf(dur + rel + 0.05);
    const rf = _ac.createBiquadFilter(), rg = _ac.createGain();
    rf.type = 'lowpass';
    rf.frequency.setValueAtTime(140, t);
    rf.frequency.linearRampToValueAtTime(420, end);
    rg.gain.setValueAtTime(0.001, t);
    rg.gain.linearRampToValueAtTime(0.28, t + dur * 0.4);
    rg.gain.linearRampToValueAtTime(0.32, end);
    rg.gain.linearRampToValueAtTime(0.001, end + rel);
    r.connect(rf); rf.connect(rg); rg.connect(_master);
    r.start(t); r.stop(end + rel + 0.05);
}

function sfxDie() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const dur = 1.3;  // matches sfxEngineSpoolUp's duration - this is that sound played in reverse
    // Deep broadband roar - literal time-reversal of the spool-up's roar layer:
    // frequency ramp reversed (420->160, mirroring the up-sweep's 160->420),
    // and the gain envelope's three segments reversed in order and direction.
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(dur);
    const flt = _ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(420, t);
    flt.frequency.linearRampToValueAtTime(160, t + dur);
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.40, t + 0.13);
    g.gain.linearRampToValueAtTime(0.30, t + dur - 0.12);
    g.gain.linearRampToValueAtTime(0.001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(_master);
    src.start(t); src.stop(t + dur + 0.05);
    // Mid roar color - reversed gain envelope of the spool-up's growl layer
    const src2 = _ac.createBufferSource();
    src2.buffer = _noiseBuf(dur);
    const flt2 = _ac.createBiquadFilter();
    flt2.type = 'bandpass'; flt2.Q.value = 0.6; flt2.frequency.value = 480;
    const g2 = _ac.createGain();
    g2.gain.setValueAtTime(0.001, t);
    g2.gain.exponentialRampToValueAtTime(0.14, t + dur - 0.15);
    g2.gain.linearRampToValueAtTime(0.001, t + dur);
    src2.connect(flt2); flt2.connect(g2); g2.connect(_master);
    src2.start(t); src2.stop(t + dur + 0.05);
    // ── The impact itself, on frame 0 (2026-09-17 audio audit) ──────────────
    // The crash used to sit at t + dur - 0.08, i.e. 1.22s AFTER the collision: the
    // reverse-spool roar had to run its length first, so the loudest moment of the death
    // sound landed once drawDeathFreeze() had already finished and the debriefing panel
    // was fading in. The hit itself made no sound at all. The roar and its reversal are
    // kept (that mirror of sfxEngineSpoolUp is the identity of the sound) - what moved
    // is the impact: hull thump, mid crunch and a bright crack all on the hit frame,
    // with only a quiet debris settle left at the tail.
    // Three layers rather than one because the thump alone is a 180->45 Hz sine, which a
    // phone speaker barely reproduces - the 900 Hz crunch and the crack are what carry
    // the hit on a device, the sub is what carries it on headphones.
    const thump = _ac.createOscillator(), thumpG = _ac.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(180, t);
    thump.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    thumpG.gain.setValueAtTime(0.28, t);
    thumpG.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
    thump.connect(thumpG); thumpG.connect(_master);
    thump.start(t); thump.stop(t + 0.32);
    const crunch = _ac.createBufferSource();
    crunch.buffer = _noiseBuf(0.26);
    const crunchFlt = _ac.createBiquadFilter();
    crunchFlt.type = 'bandpass'; crunchFlt.Q.value = 0.8;
    crunchFlt.frequency.setValueAtTime(1400, t);
    crunchFlt.frequency.exponentialRampToValueAtTime(420, t + 0.22);
    const crunchG = _ac.createGain();
    crunchG.gain.setValueAtTime(0.26, t);
    crunchG.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    crunch.connect(crunchFlt); crunchFlt.connect(crunchG); crunchG.connect(_master);
    crunch.start(t); crunch.stop(t + 0.28);
    const snap = _ac.createBufferSource();
    snap.buffer = _noiseBuf(0.03);
    const snapFlt = _ac.createBiquadFilter();
    snapFlt.type = 'highpass'; snapFlt.frequency.value = 2600;
    const snapG = _ac.createGain();
    snapG.gain.setValueAtTime(0.18, t);
    snapG.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    snap.connect(snapFlt); snapFlt.connect(snapG); snapG.connect(_master);
    snap.start(t); snap.stop(t + 0.03);
    // Debris settling as the roar runs out - what the old crash was, at less than half
    // the level, since it is now a tail and not the event.
    const tSettle = t + dur - 0.08;
    const crash = _ac.createBufferSource();
    crash.buffer = _noiseBuf(0.3);
    const crashFlt = _ac.createBiquadFilter();
    crashFlt.type = 'lowpass';
    crashFlt.frequency.setValueAtTime(700, tSettle);
    crashFlt.frequency.exponentialRampToValueAtTime(60, tSettle + 0.22);
    const crashGain = _ac.createGain();
    crashGain.gain.setValueAtTime(0.14, tSettle);
    crashGain.gain.exponentialRampToValueAtTime(0.001, tSettle + 0.26);
    crash.connect(crashFlt); crashFlt.connect(crashGain); crashGain.connect(_master);
    crash.start(tSettle); crash.stop(tSettle + 0.28);
}

function sfxSlow() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    [480, 360, 270].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_master);
        o.type = 'sine';
        const t0 = t + i * 0.09;
        o.frequency.setValueAtTime(freq, t0);
        o.frequency.exponentialRampToValueAtTime(freq * 0.70, t0 + 0.30);
        g.gain.setValueAtTime(0.11, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
        o.start(t0); o.stop(t0 + 0.36);
    });
}

// Loudness hierarchy (P6b): shield/magnet/bomb are rare, run-defining pickups, so they
// sit ~2 dB hotter and with a touch more tail than the common gold/slow grabs, and
// shield gets a low body layer for heft. Gold and slow are deliberately left where
// they were - a routine pickup should not land as hard as a save.
function sfxShield() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    [500, 750, 1000, 1300].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_master);
        o.type = 'triangle'; o.frequency.value = freq;
        const t0 = t + i * 0.07;
        g.gain.setValueAtTime(0.15, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
        o.start(t0); o.stop(t0 + 0.25);
    });
    const lo = _ac.createOscillator(), lg = _ac.createGain();
    lo.connect(lg); lg.connect(_master);
    lo.type = 'sine'; lo.frequency.value = 165;
    lg.gain.setValueAtTime(0.10, t);
    lg.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    lo.start(t); lo.stop(t + 0.47);
}

function sfxMagnet() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    [220, 330, 500, 750].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_master);
        o.type = 'sine';
        const t0 = t + i * 0.07;
        o.frequency.setValueAtTime(freq, t0);
        o.frequency.exponentialRampToValueAtTime(freq * 1.8, t0 + 0.28);
        g.gain.setValueAtTime(0.14, t0);   // P6b: rare pickup, sits hotter than gold/slow
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.38);
        o.start(t0); o.stop(t0 + 0.39);
    });
}

function sfxPoison() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    // Sour descending sawtooth pair -- the negative mirror of sfxCoin's bright rising
    // sine chime, so it reads as a "bad" pickup even before the player sees the notif.
    [400, 340].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_master);
        o.type = 'sawtooth';
        const t0 = t + i * 0.09;
        o.frequency.setValueAtTime(freq, t0);
        o.frequency.exponentialRampToValueAtTime(freq * 0.55, t0 + 0.22);
        g.gain.setValueAtTime(0.12, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.26);
        o.start(t0); o.stop(t0 + 0.27);
    });
    // Low-passed noise squelch under the saws (P6d): poison now claws back a
    // compounding 12-15% of the pending shard bank, a genuinely punishing hit, so the
    // sound needs real body under it rather than a thin blip.
    const sq = _ac.createBufferSource();
    sq.buffer = _noiseBuf(0.35);
    const sqFlt = _ac.createBiquadFilter();
    sqFlt.type = 'lowpass';
    sqFlt.frequency.setValueAtTime(600, t);
    sqFlt.frequency.exponentialRampToValueAtTime(90, t + 0.30);
    const sqG = _ac.createGain();
    sqG.gain.setValueAtTime(0.26, t + 0.02);
    sqG.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    sq.connect(sqFlt); sqFlt.connect(sqG); sqG.connect(_master);
    sq.start(t); sq.stop(t + 0.36);
}

function sfxDrain() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    // Score being siphoned away: a long downward glissando on a detuned triangle
    // pair (hollow, vacuum-ish) rather than poison's sour sawtooth squelch, so the
    // two punishers sound like different bad things. Ends on a soft filtered
    // down-thump.
    [220, 208].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_master);
        o.type = 'triangle';
        const t0 = t + i * 0.04;
        o.frequency.setValueAtTime(freq, t0);
        o.frequency.exponentialRampToValueAtTime(freq * 0.32, t0 + 0.40);
        g.gain.setValueAtTime(0.11, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.46);
        o.start(t0); o.stop(t0 + 0.48);
    });
    // Descending filtered-noise "suck" under the tones.
    const ns = _ac.createBufferSource();
    ns.buffer = _noiseBuf(0.4);
    const nf = _ac.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.setValueAtTime(900, t);
    nf.frequency.exponentialRampToValueAtTime(120, t + 0.4);
    nf.Q.value = 3;
    const ng = _ac.createGain();
    ng.gain.setValueAtTime(0.16, t + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
    ns.connect(nf); nf.connect(ng); ng.connect(_master);
    ns.start(t); ns.stop(t + 0.46);
}

// Blast body for sfxMineExplode (sfxBomb has had its own since 2026-09-19). Reworked twice on 2026-09-18: first from
// a swept noise puff into a layered blast, then again because that still sounded like a
// firecracker ("Knallfrosch"). A firecracker is a bright, sharp crack that is over in a
// fraction of a second, and the first rework had exactly that shape: a hard high-passed
// onset, a mid-heavy body (76% of its energy above 400 Hz), a rattle of HIGH shrapnel ticks
// and only ~0.3 s of length. What makes a blast read as big is the opposite: weight, a
// soft-edged onset, a long low tail, and falling debris that is low, not tinkling.
//  1. PUNCH    - a fast 220 -> 46 Hz sine drop (like a kick drum): the onset is a thump,
//                not a click. Plus a 4 ms click, just enough to define the attack.
//  2. BODY     - noise through a lowpass that closes 2 kHz -> 110 Hz, then a waveshaper for
//                grit and a second lowpass to strip the fizz the shaper adds.
//  3. SUB      - a sine sinking 95 -> 32 Hz, driven through a waveshaper and lowpassed at
//                420 Hz, so the harmonics (200-400 Hz) carry the bass onto a speaker that
//                cannot play the fundamental.
//  4. RUMBLE   - low noise closing 320 -> 55 Hz with a slow tremolo, ~1 s long.
//  5. DEBRIS   - five low band-passed thuds (500-1300 Hz) spread over the tail: rubble
//                landing, not metal pinging.
// `o.size` scales length (a mine is 1.3, the bomb 1.5), `o.pv` is a small pitch factor
// so two blasts in a row do not sound identical, `o.level` the one loudness knob.
function _blast(t, o) {
    const size = o.size, pv = o.pv;
    const out = _ac.createGain();   // one level knob for the whole blast (matched by offline render)
    out.gain.value = o.level;
    out.connect(_master);

    const pu = _ac.createOscillator(), puG = _ac.createGain();
    pu.type = 'sine';
    pu.frequency.setValueAtTime(220 * pv, t);
    pu.frequency.exponentialRampToValueAtTime(46, t + 0.07);
    puG.gain.setValueAtTime(0.0001, t);
    puG.gain.linearRampToValueAtTime(0.30 * o.boom, t + 0.004);
    puG.gain.exponentialRampToValueAtTime(0.001, t + 0.15 * size);
    pu.connect(puG); puG.connect(out);
    pu.start(t); pu.stop(t + 0.17 * size);
    const ck = _ac.createBufferSource();
    ck.buffer = _noiseBuf(0.006);
    const ckF = _ac.createBiquadFilter();
    ckF.type = 'highpass'; ckF.frequency.value = 900;
    const ckG = _ac.createGain();
    ckG.gain.value = 0.10;
    ck.connect(ckF); ckF.connect(ckG); ckG.connect(out);
    ck.start(t); ck.stop(t + 0.006);

    const bd = _ac.createBufferSource();
    bd.buffer = _noiseBuf(0.95 * size);
    const bdF = _ac.createBiquadFilter();
    bdF.type = 'lowpass'; bdF.Q.value = 0.7;
    bdF.frequency.setValueAtTime(2000 * pv, t);
    bdF.frequency.exponentialRampToValueAtTime(110, t + 0.38 * size);
    const shaper = _ac.createWaveShaper();
    shaper.curve = _distortionCurve(4);
    const bdF2 = _ac.createBiquadFilter();
    bdF2.type = 'lowpass'; bdF2.frequency.value = 1600;
    const bdG = _ac.createGain();
    bdG.gain.setValueAtTime(0.0001, t);
    bdG.gain.linearRampToValueAtTime(0.80 * o.blast, t + 0.004);
    // Shoulder: a quick drop to ~40%, then a long roll-off - the body stays present for
    // the first ~0.25 s instead of vanishing (a straight exponential was -18 dB by 0.2 s).
    bdG.gain.exponentialRampToValueAtTime(0.32 * o.blast, t + 0.18 * size);
    bdG.gain.exponentialRampToValueAtTime(0.001, t + 0.90 * size);
    bd.connect(bdF); bdF.connect(shaper); shaper.connect(bdF2); bdF2.connect(bdG); bdG.connect(out);
    bd.start(t); bd.stop(t + 0.94 * size);

    const sb = _ac.createOscillator();
    sb.type = 'sine';
    sb.frequency.setValueAtTime(95 * pv, t);
    sb.frequency.exponentialRampToValueAtTime(32, t + 0.6 * size);
    const sbS = _ac.createWaveShaper();
    sbS.curve = _distortionCurve(3);
    const sbF = _ac.createBiquadFilter();
    sbF.type = 'lowpass'; sbF.frequency.value = 420;
    const sbG = _ac.createGain();
    sbG.gain.setValueAtTime(0.0001, t);
    sbG.gain.linearRampToValueAtTime(0.34 * o.boom, t + 0.01);
    sbG.gain.exponentialRampToValueAtTime(0.001, t + 0.72 * size);
    sb.connect(sbS); sbS.connect(sbF); sbF.connect(sbG); sbG.connect(out);
    sb.start(t); sb.stop(t + 0.75 * size);

    const rum = _ac.createBufferSource();
    rum.buffer = _noiseBuf(1.3 * size);
    const ruF = _ac.createBiquadFilter();
    ruF.type = 'lowpass'; ruF.Q.value = 1.0;
    ruF.frequency.setValueAtTime(320, t);
    ruF.frequency.exponentialRampToValueAtTime(55, t + 1.05 * size);
    const trem = _ac.createGain();
    trem.gain.value = 0.7;
    const lfo = _ac.createOscillator(), lfoD = _ac.createGain();
    lfo.type = 'sine'; lfo.frequency.value = 14;
    lfoD.gain.value = 0.3;
    lfo.connect(lfoD); lfoD.connect(trem.gain);
    const ruG = _ac.createGain();
    ruG.gain.setValueAtTime(0.0001, t);
    ruG.gain.linearRampToValueAtTime(0.24 * o.boom, t + 0.05);
    ruG.gain.exponentialRampToValueAtTime(0.001, t + 1.2 * size);
    rum.connect(ruF); ruF.connect(trem); trem.connect(ruG); ruG.connect(out);
    rum.start(t); rum.stop(t + 1.25 * size);
    lfo.start(t); lfo.stop(t + 1.25 * size);

    [[0.14, 0.12, 1100], [0.26, 0.09, 700], [0.37, 0.10, 1300],
     [0.52, 0.07, 600], [0.68, 0.05, 900]].forEach(([dt, a, hz]) => {
        const td = t + dt * size;
        const dr = _ac.createBufferSource();
        dr.buffer = _noiseBuf(0.08);
        const drF = _ac.createBiquadFilter();
        drF.type = 'lowpass'; drF.frequency.value = hz * pv; drF.Q.value = 0.9;
        const drG = _ac.createGain();
        drG.gain.setValueAtTime(0.0001, td);
        drG.gain.linearRampToValueAtTime(a * 0.75 * o.debris, td + 0.006);   // soft attack: no click
        drG.gain.exponentialRampToValueAtTime(0.001, td + 0.07);
        dr.connect(drF); drF.connect(drG); drG.connect(out);
        dr.start(td); dr.stop(td + 0.08);
    });
}

// Bomb pickup, variant "Donner" (chosen 2026-09-19 from three browser proposals; the old
// arpeggio chime + _blast() noise burst was disliked). A low thunder-like boom sent through a
// convolution hall (`_bombVerb`, generated once per context). The dry path carries the hit,
// the hall gives it the long filmic tail. The proposal had a 0.28 s crackling fuse in front
// (matching the coin's burning fuse); dropped on request, so the boom now lands on frame 0.
// `out` and `both` are the loudness knobs; `out` was matched by offline render to the old
// sound (-24 dB loudest 50 ms), then `both` raised (asked louder, three times).
let _bombVerb = null, _bombVerbAC = null;
function _getBombVerb() {
    if (_bombVerb && _bombVerbAC === _ac) return _bombVerb;
    const sec = 2.2, n = Math.ceil(_ac.sampleRate * sec);
    const buf = _ac.createBuffer(2, n, _ac.sampleRate);
    for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        let p = 0;
        for (let i = 0; i < n; i++) {
            p += ((Math.random()*2-1) - p) * 0.18;   // one-pole lowpass: a dark hall
            d[i] = p * Math.exp(-i / (_ac.sampleRate * sec * 0.28));
        }
    }
    _bombVerb = buf; _bombVerbAC = _ac;
    return buf;
}

function sfxBomb() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime + 0.02;
    const b = t;
    const out = _ac.createGain();
    out.gain.value = 0.12;
    out.connect(_master);
    const dry = _ac.createGain();
    dry.connect(out);
    const rv = _ac.createConvolver();
    rv.buffer = _getBombVerb();
    const wet = _ac.createGain(); wet.gain.value = 0.9;
    rv.connect(wet); wet.connect(out);
    const send = _ac.createGain(); send.gain.value = 0.7;
    send.connect(rv);
    const both = _ac.createGain();   // the boom goes dry and into the hall
    both.gain.value = 3.8;           // +11.5 dB over the first version (asked louder three times, 2026-09-19)
    both.connect(dry); both.connect(send);

    // Boom: punch 130 -> 34 Hz, sub 68 -> 28 Hz through a waveshaper (bass survives a phone
    // speaker), a lowpassed noise body and a 2 ms-ish click to place the hit.
    const pu = _ac.createOscillator(), puG = _ac.createGain();
    pu.type = 'sine';
    pu.frequency.setValueAtTime(130, b);
    pu.frequency.exponentialRampToValueAtTime(34, b + 0.22);
    puG.gain.setValueAtTime(0.0001, b);
    puG.gain.linearRampToValueAtTime(0.6, b + 0.005);
    puG.gain.exponentialRampToValueAtTime(0.001, b + 1.0);
    pu.connect(puG); puG.connect(both);
    pu.start(b); pu.stop(b + 1.02);

    const sb = _ac.createOscillator(), sbS = _ac.createWaveShaper(), sbF = _ac.createBiquadFilter(), sbG = _ac.createGain();
    sb.type = 'sine';
    sb.frequency.setValueAtTime(68, b);
    sb.frequency.exponentialRampToValueAtTime(28, b + 0.8);
    sbS.curve = _distortionCurve(2.5);
    sbF.type = 'lowpass'; sbF.frequency.value = 300;
    sbG.gain.setValueAtTime(0.0001, b);
    sbG.gain.linearRampToValueAtTime(0.5, b + 0.02);
    sbG.gain.exponentialRampToValueAtTime(0.001, b + 1.6);
    sb.connect(sbS); sbS.connect(sbF); sbF.connect(sbG); sbG.connect(both);
    sb.start(b); sb.stop(b + 1.62);

    const bd = _ac.createBufferSource();
    bd.buffer = _noiseBuf(0.95);
    const bdF = _ac.createBiquadFilter();
    bdF.type = 'lowpass'; bdF.Q.value = 0.8;
    bdF.frequency.setValueAtTime(1200, b);
    bdF.frequency.exponentialRampToValueAtTime(80, b + 0.5);
    const bdS = _ac.createWaveShaper(); bdS.curve = _distortionCurve(3);
    const bdG = _ac.createGain();
    bdG.gain.setValueAtTime(0.0001, b);
    bdG.gain.linearRampToValueAtTime(0.30, b + 0.004);
    bdG.gain.exponentialRampToValueAtTime(0.001, b + 0.9);
    bd.connect(bdF); bdF.connect(bdS); bdS.connect(bdG); bdG.connect(both);
    bd.start(b); bd.stop(b + 0.95);

    const ck = _ac.createBufferSource();
    ck.buffer = _noiseBuf(0.02);
    const ckF = _ac.createBiquadFilter(); ckF.type = 'highpass'; ckF.frequency.value = 1500;
    const ckG = _ac.createGain();
    ckG.gain.setValueAtTime(0.10, b);
    ckG.gain.exponentialRampToValueAtTime(0.001, b + 0.02);
    ck.connect(ckF); ckF.connect(ckG); ckG.connect(both);
    ck.start(b); ck.stop(b + 0.02);
}

// Warp portal entry (constants.js "Warp portal" doc): a rising sweep chord + a
// bandpassed noise "whoosh", the mirror image of sfxSlow's descending one. Fires
// on every portal flythrough via triggerWarp().
function sfxWarpEnter() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    [340, 460, 620].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_master);
        o.type = 'sine';
        const t0 = t + i * 0.05;
        o.frequency.setValueAtTime(freq, t0);
        o.frequency.exponentialRampToValueAtTime(freq * 2.2, t0 + 0.32);
        g.gain.setValueAtTime(0.15, t0);   // P6b-hot: rare, run-defining pickup
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.38);
        o.start(t0); o.stop(t0 + 0.39);
    });
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.4);
    const flt = _ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.Q.value = 4;
    flt.frequency.setValueAtTime(600, t);
    flt.frequency.exponentialRampToValueAtTime(4200, t + 0.30);
    const g3 = _ac.createGain();
    g3.gain.setValueAtTime(0.001, t);
    g3.gain.linearRampToValueAtTime(0.24, t + 0.06);
    g3.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    src.connect(flt); flt.connect(g3); g3.connect(_master);
    src.start(t); src.stop(t + 0.36);
}

// The cannon's own muzzle blast (not the impact when its shot lands - see
// sfxStalCrack). Used to be a single bandpassed noise sweep with no low end, no
// sharper than the player's own bullet fire despite being a heavier artillery
// piece. Now three layers: a lower/wider bandpassed whoosh body, a lowpass
// thump underneath for weight, and a bright crack on the attack for punch -
// deliberately heavier than sfxBulletFire's crisp zap so the two guns still
// read as different weapons even though their shots share a sprite.
function sfxCannonFire() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.18);
    const flt = _ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.Q.value = 1.1;
    flt.frequency.setValueAtTime(1100, t);
    flt.frequency.exponentialRampToValueAtTime(180, t + 0.16);
    const g = _ac.createGain();
    // +5 dB across all three layers (2026-09-17): a cannon shot is the game's only
    // "something is about to happen to you" cue, and it measured 4 dB QUIETER than a
    // gold coin. Warnings sit above rewards.
    g.gain.setValueAtTime(0.57, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(flt); flt.connect(g); g.connect(_master);
    src.start(t); src.stop(t + 0.19);
    // Low thump for artillery weight the old single-layer version lacked.
    const src2 = _ac.createBufferSource();
    src2.buffer = _noiseBuf(0.14);
    const flt2 = _ac.createBiquadFilter();
    flt2.type = 'lowpass'; flt2.frequency.value = 200;
    const g2 = _ac.createGain();
    g2.gain.setValueAtTime(0.60, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src2.connect(flt2); flt2.connect(g2); g2.connect(_master);
    src2.start(t); src2.stop(t + 0.15);
    // Muzzle crack: a hair of bright noise on the attack for punch.
    const src3 = _ac.createBufferSource();
    src3.buffer = _noiseBuf(0.02);
    const flt3 = _ac.createBiquadFilter();
    flt3.type = 'highpass'; flt3.frequency.value = 3000;
    const g3 = _ac.createGain();
    g3.gain.setValueAtTime(0.32, t);
    g3.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    src3.connect(flt3); flt3.connect(g3); g3.connect(_master);
    src3.start(t); src3.stop(t + 0.02);
}

// The shield eating a hit for you - also the revive cue (update.js grantRevive).
// Raised ~8 dB on 2026-09-17: measured, this was the QUIETEST gameplay sound in the game
// (-32.3 dB momentary, a good 7 dB under a routine gold coin), which put the sound of
// losing your one shield below the sound of picking up three points. The Q 1.8 bandpass
// strips most of the noise energy before the gain node ever sees it, which is why the
// old 0.40 did not mean what it looked like - see the thruster-voice note below for the
// same trap. A shatter layer on the attack and a music duck carry the rest.
function sfxShieldBreak() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    // Reworked 2026-09-18 ("a bit childish"): the old sound was a bandpassed noise burst
    // plus a bright noise edge, i.e. a pop. An energy field failing sounds like power
    // going out of something, not like something bursting, so it is now four layers:
    //  1. FIELD COLLAPSE - a saw whose pitch falls 820 -> 90 Hz through a lowpass that
    //     closes 3.2 kHz -> 240 Hz. The saw's harmonics keep it in the 500-2000 Hz band a
    //     phone speaker actually reproduces (same reasoning as the mid partners below).
    //  2. DISCHARGE - a short gated burst of band-passed noise, crackling rather than
    //     hissing (hard on/off steps, decaying).
    //  3. HULL THUMP - a fast 150 -> 48 Hz sine drop for the hit itself.
    //  4. RING-DOWN - two inharmonic sines (ratio ~1.51) very quiet, so the tail reads as
    //     metal cooling rather than glass.
    // Level matched by offline render to the pop it replaces (loudest 50 ms about -21 dB
    // before the master gain), so the loudness hierarchy in the 2026-09-17 audit holds.
    const saw = _ac.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(820, t);
    saw.frequency.exponentialRampToValueAtTime(90, t + 0.34);
    const sawF = _ac.createBiquadFilter();
    sawF.type = 'lowpass'; sawF.Q.value = 2.5;
    sawF.frequency.setValueAtTime(3200, t);
    sawF.frequency.exponentialRampToValueAtTime(240, t + 0.34);
    const sawG = _ac.createGain();
    sawG.gain.setValueAtTime(0.0001, t);
    sawG.gain.linearRampToValueAtTime(0.155, t + 0.010);
    sawG.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
    saw.connect(sawF); sawF.connect(sawG); sawG.connect(_master);
    saw.start(t); saw.stop(t + 0.38);

    const dis = _ac.createBufferSource();
    dis.buffer = _noiseBuf(0.16);
    const disF = _ac.createBiquadFilter();
    disF.type = 'bandpass'; disF.frequency.value = 3800; disF.Q.value = 0.8;
    const disG = _ac.createGain();
    // Gate steps at fixed offsets (no Math.random: the sound is identical every time).
    const gate = [0, 0.012, 0.021, 0.038, 0.047, 0.066, 0.077, 0.098, 0.112, 0.131];
    disG.gain.setValueAtTime(0.0001, t);
    gate.forEach((dt, k) => disG.gain.setValueAtTime(k % 2 === 0 ? 0.22 * (1 - k / 11) : 0.0001, t + dt));
    disG.gain.setValueAtTime(0.0001, t + 0.15);
    dis.connect(disF); disF.connect(disG); disG.connect(_master);
    dis.start(t); dis.stop(t + 0.16);

    const th = _ac.createOscillator();
    th.type = 'sine';
    th.frequency.setValueAtTime(150, t);
    th.frequency.exponentialRampToValueAtTime(48, t + 0.14);
    const thG = _ac.createGain();
    thG.gain.setValueAtTime(0.10, t);
    thG.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    th.connect(thG); thG.connect(_master);
    th.start(t); th.stop(t + 0.17);

    [[1240, 0.028], [1873, 0.018]].forEach(([f, a]) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + 0.02);
        g.gain.linearRampToValueAtTime(a, t + 0.035);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.50);
        o.connect(g); g.connect(_master);
        o.start(t + 0.02); o.stop(t + 0.52);
    });
    musicDuck();
}

function sfxMilestone(n) {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const base = n >= 1000 ? 780 : n >= 200 ? 660 : n >= 100 ? 550 : 440;
    [base, base*1.25, base*1.5, base*2].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_master);
        o.type = 'sine'; o.frequency.value = freq;
        const t0 = t + i * 0.06;
        g.gain.setValueAtTime(0.13, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.40);
        o.start(t0); o.stop(t0 + 0.42);
    });
    musicDuck();
}

// Daily-mission completion chime (update.js die()). A bright five-note major-pentatonic
// run with a soft bell tail -- distinct from sfxMilestone's four-note triad-stack so a
// finished mission doesn't read as "just another milestone", and hotter/longer than a
// coin pickup because it's a shard payout, not a +3. Fires right after sfxDie; the high
// register cuts through that low thud cleanly.
function sfxMissionDone() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const notes = [523.25, 587.33, 698.46, 783.99, 1046.5]; // C5 D5 F5 G5 C6
    notes.forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_master);
        o.type = 'triangle'; o.frequency.value = freq;
        const t0 = t + i * 0.07;
        const peak = i === notes.length - 1 ? 0.16 : 0.12;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i === notes.length - 1 ? 0.75 : 0.28));
        o.start(t0); o.stop(t0 + 0.8);
    });
}

function sfxNearMiss() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.connect(g); g.connect(_master);
    o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.10);
    // +5 dB (2026-09-17): measured at -30 dB momentary this sat UNDER the steady thrust
    // bed (-28) and under the music, so the one bonus a player earns by flying well was
    // the thing they could not hear.
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.start(t); o.stop(t + 0.15);
}

function sfxCombo(level) {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.connect(g); g.connect(_master);
    o.type = 'triangle';
    o.frequency.value = Math.min(600 + level * 120, 1400);
    g.gain.setValueAtTime(0.16, t);   // +5 dB, same reason as sfxNearMiss
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.start(t); o.stop(t + 0.20);
}

function sfxOnFire() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const dur = 0.45;
    // Ignition whoosh: broadband noise brightening as a bandpass filter sweeps up --
    // the mirror of sfxMineExplode's downward lowpass sweep (muffling = damage, here
    // brightening = catching alight). Bandpass rather than lowpass so it has a "whoosh"
    // center to it instead of just rising hiss.
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(dur);
    const flt = _ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.Q.value = 0.9;
    flt.frequency.setValueAtTime(300, t);
    flt.frequency.exponentialRampToValueAtTime(2600, t + dur);
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.42, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(_master);
    src.start(t); src.stop(t + dur + 0.05);
    // Bright ascending ping riding on top so the moment reads as a reward, not a hazard --
    // the noise layer alone sits too close to sfxMineExplode's damage texture.
    [880, 1320].forEach((freq, i) => {
        const o = _ac.createOscillator(), og = _ac.createGain();
        o.connect(og); og.connect(_master);
        o.type = 'triangle'; o.frequency.value = freq;
        const t0 = t + 0.08 + i * 0.07;
        og.gain.setValueAtTime(0.16, t0);
        og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
        o.start(t0); o.stop(t0 + 0.24);
    });
}

// Furthest-ever stinger (update.js, the frame the ship passes the all-time best point).
// A short bright rising arpeggio capped by a shimmering high ring -- grander than the
// ghost-passed ping (sfxCombo(4)) because this is the deeper record, but shorter than
// sfxMilestone / sfxMissionDone so it doesn't clutter a mid-flight moment. Triangle
// body for punch, a sine tail on top for the "ring".
function sfxPbPassed() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    [659.25, 987.77, 1318.5].forEach((freq, i) => { // E5 B5 E6
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_master);
        o.type = 'triangle'; o.frequency.value = freq;
        const t0 = t + i * 0.06;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.15, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
        o.start(t0); o.stop(t0 + 0.30);
    });
    // High sine ring that outlasts the arpeggio by a beat -- the "gold" shimmer.
    const r = _ac.createOscillator(), rg = _ac.createGain();
    r.connect(rg); rg.connect(_master);
    r.type = 'sine'; r.frequency.value = 1975.5; // B6
    const rt = t + 0.14;
    rg.gain.setValueAtTime(0.0001, rt);
    rg.gain.exponentialRampToValueAtTime(0.09, rt + 0.02);
    rg.gain.exponentialRampToValueAtTime(0.0001, rt + 0.55);
    r.start(rt); r.stop(rt + 0.6);
    musicDuck(MUSIC_DUCK_DB, 0.60);   // the deepest record of all - give it the room
}

function sfxMineExplode() {
    if (!_ac || !fxOn) return;
    _blast(_ac.currentTime, { size: 1.3, pv: 0.94 + Math.random() * 0.12, blast: 1.0, boom: 1.0, debris: 1.0, level: 0.17 });
}

function sfxBulletPickup() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    [440, 660, 990].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_master);
        o.type = 'square';
        const t0 = t + i * 0.055;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.07, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.13);
        o.start(t0); o.stop(t0 + 0.14);
    });
}

function sfxBulletFire() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const dur = 0.08;
    // Body: triangle wave, not the old sawtooth - sawtooth's dense harmonics on
    // a fast downward sweep read as a nasal "quack" rather than a clean zap.
    // A lowpass sweeping down in lockstep with pitch shaves the remaining top
    // end off as the note falls, keeping the tail smooth instead of buzzy.
    // Fires every 0.32s while ammo lasts, so it stays short to avoid fatigue.
    const o = _ac.createOscillator(), g = _ac.createGain();
    const flt = _ac.createBiquadFilter();
    o.connect(flt); flt.connect(g); g.connect(_master);
    o.type = 'triangle';
    o.frequency.setValueAtTime(1400, t);
    o.frequency.exponentialRampToValueAtTime(300, t + dur);
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(6000, t);
    flt.frequency.exponentialRampToValueAtTime(700, t + dur);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
    _bfVoices = [{ node: o, gain: g }];
    // Sub layer: square wave locked exactly one octave below the body at every
    // instant (same start/end ratio and duration keeps an exponential ramp's
    // ratio constant throughout), so the two layers never drift apart the way
    // two independently-swept pitches can - that drift was part of the old
    // version's "off" quality.
    const o2 = _ac.createOscillator(), g2 = _ac.createGain();
    o2.connect(g2); g2.connect(_master);
    o2.type = 'square';
    o2.frequency.setValueAtTime(700, t);
    o2.frequency.exponentialRampToValueAtTime(150, t + dur);
    g2.gain.setValueAtTime(0.05, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.9);
    o2.start(t); o2.stop(t + dur);
    _bfVoices.push({ node: o2, gain: g2 });
    // Muzzle crack: brief bandpassed noise on the attack for punch - tighter and
    // quieter than a raw open highpass hiss so it adds punch without extra harshness.
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.015);
    const cFlt = _ac.createBiquadFilter();
    cFlt.type = 'bandpass'; cFlt.Q.value = 1.2; cFlt.frequency.value = 5000;
    const g3 = _ac.createGain();
    g3.gain.setValueAtTime(0.09, t);
    g3.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
    src.connect(cFlt); cFlt.connect(g3); g3.connect(_master);
    src.start(t); src.stop(t + 0.015);
    _bfVoices.push({ node: src, gain: g3 });
}

// Cuts off whatever the most recent sfxBulletFire() is still ringing out, called
// the instant a real death commits (update.js's die(), not the shield-absorb
// branch). The fire loop's 0.32s spacing is longer than any single shot's ~0.1s
// tail, so at most one shot is ever still playing - but a death that lands within
// that tail would otherwise let the zap bleed audibly into sfxDie's onset, reading
// as if the bullet sound played "at death". Same cancel/hold/ramp-then-stop shape
// as thrustOff/onFireLoopOff, just for one-shot voices instead of a loop.
function sfxBulletFireStop() {
    if (!_ac || _bfVoices.length === 0) return;
    const t = _ac.currentTime;
    for (const { node, gain } of _bfVoices) {
        try {
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(gain.gain.value, t);
            gain.gain.linearRampToValueAtTime(0.0001, t + 0.02);
            node.stop(t + 0.03);
        } catch (e) { /* already stopped */ }
    }
    _bfVoices = [];
}

// Plays whenever a projectile (player bullet or cannon shot) hits something -
// a stalactite, the corridor wall, or the other side's shot. Used to be a
// single raw highpass-noise burst, which read thin/flat next to the game's
// other layered impact sfx (compare sfxMineExplode's boom+crack). Now three
// short layers: a bandpassed "snap" body, a brief high-frequency tick on the
// attack, and a touch of low thump for weight.
function sfxStalCrack() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.16);
    const flt = _ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.Q.value = 1.1;
    flt.frequency.setValueAtTime(2600, t);
    flt.frequency.exponentialRampToValueAtTime(1200, t + 0.14);
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.34, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src.connect(flt); flt.connect(g); g.connect(_master);
    src.start(t); src.stop(t + 0.16);
    // Transient tick on the attack for a sharp onset - same role as the muzzle
    // crack in sfxBulletFire.
    const src2 = _ac.createBufferSource();
    src2.buffer = _noiseBuf(0.015);
    const flt2 = _ac.createBiquadFilter();
    flt2.type = 'highpass'; flt2.frequency.value = 4500;
    const g2 = _ac.createGain();
    g2.gain.setValueAtTime(0.22, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
    src2.connect(flt2); flt2.connect(g2); g2.connect(_master);
    src2.start(t); src2.stop(t + 0.015);
    // Low thump underneath so the hit reads with a bit of weight, not pure static.
    const o = _ac.createOscillator(), g3 = _ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.08);
    g3.gain.setValueAtTime(0.10, t);
    g3.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g3); g3.connect(_master);
    o.start(t); o.stop(t + 0.09);
}

// A projectile hitting SOLID rock: the corridor wall, a boulder, or a cannon shot dying on
// the wall (2026-09-18, "a very odd sound"). These used to share sfxStalCrack, which is
// the sound of a stalactite BREAKING - a bright band-passed noise snap that reads as static,
// and on a wall it repeats every 0.32s while the ammo auto-fires. Rock does not snap, it
// takes the hit: so now a dull stone "tock" (sine 210 -> 90 Hz) with a band-passed mid
// partner so it exists on a phone speaker, a short dry chip crack on the attack, and three
// tiny gravel ticks scattering after it at fixed offsets. Pitch varies +-8% per call so a
// stream of hits does not machine-gun. Level matched by offline render to sfxStalCrack (loudest 50 ms about -26 dB
// before the master gain), which it replaces at these three call sites.
function sfxRockHit() {
    if (!_ac || !fxOn) return;
    const t  = _ac.currentTime;
    const pv = 0.92 + Math.random() * 0.16;
    const o = _ac.createOscillator(), og = _ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(210 * pv, t);
    o.frequency.exponentialRampToValueAtTime(90 * pv, t + 0.07);
    og.gain.setValueAtTime(0.12, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(og); og.connect(_master);
    o.start(t); o.stop(t + 0.10);
    const body = _ac.createBufferSource();
    body.buffer = _noiseBuf(0.07);
    const bf = _ac.createBiquadFilter();
    bf.type = 'bandpass'; bf.frequency.value = 950 * pv; bf.Q.value = 2.2;
    const bg = _ac.createGain();
    bg.gain.setValueAtTime(0.75, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    body.connect(bf); bf.connect(bg); bg.connect(_master);
    body.start(t); body.stop(t + 0.07);
    const chip = _ac.createBufferSource();
    chip.buffer = _noiseBuf(0.02);
    const cf = _ac.createBiquadFilter();
    cf.type = 'highpass'; cf.frequency.value = 2600;
    const cg = _ac.createGain();
    cg.gain.setValueAtTime(0.24, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    chip.connect(cf); cf.connect(cg); cg.connect(_master);
    chip.start(t); chip.stop(t + 0.02);
    [[0.030, 0.10, 3600], [0.062, 0.07, 4400], [0.098, 0.05, 3100]].forEach(([dt, a, hz]) => {
        const gr = _ac.createBufferSource();
        gr.buffer = _noiseBuf(0.012);
        const gf = _ac.createBiquadFilter();
        gf.type = 'bandpass'; gf.frequency.value = hz * pv; gf.Q.value = 1.6;
        const gg = _ac.createGain();
        gg.gain.setValueAtTime(a, t + dt);
        gg.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.012);
        gr.connect(gf); gf.connect(gg); gg.connect(_master);
        gr.start(t + dt); gr.stop(t + dt + 0.012);
    });
}

// ── Per-skin thruster voices ─────────────────────────────────────────────
// Every skin used to share this exact bandpass-noise texture as its hold-to-thrust
// sound. Each ship below gets an engine built from its own color/perk identity
// instead. thrustOn() picks the builder by activeSkin (constants.js SKINS index) -
// the skin can only change from the title screen, never mid-hold, so no runtime
// skin-switch case needs handling here.
//
// Master gains retuned 2026-09-05: the values below used to be picked by ear
// against each other (a flat 0.4x knocked down from each voice's originally-
// designed level so nothing overpowered PEARL's untouched 0.20), which quietly
// assumed the master-gain number is a decent proxy for perceived loudness. It
// isn't - narrow bandpass filtering strips most of a noise source's energy before
// it ever reaches that gain node, and each voice narrows a different amount, so
// two voices with similar "master gain" numbers can differ wildly in actual
// output. Measured by offline-rendering every voice in isolation (OfflineAudioContext,
// steady-state RMS over its hold texture) against the real the_mountain.mp3 bed at
// its actual in-game gain (0.10): every single ship measured *quieter* than the
// music (-33 to -41.5 dB RMS vs the bed's -32 dB), and the spread between ships
// was 8.4 dB despite being "tuned to the same range". Retuned so every voice's
// master gain lands within ~1 dB of -28 dB RMS (about 4 dB above the music bed,
// clearly audible without burying the coin/milestone one-shots that peak louder
// still) - solo peaks stay near -16 to -19 dB and combined-with-bgm peaks near
// -13 dB, both far from clipping (there's no limiter on the destination bus, so
// headroom here is the only thing keeping this safe). Re-verify with the same
// method (see git history around this commit for the test harness) before hand-
// tuning any of these numbers again - by-ear comparisons of these voices in
// isolation don't predict how they sit under the actual bgm.

// Shared release envelope: ramps the voice's master gain to silence, then stops
// and disconnects every node once the fade finishes so nothing ended-but-still-
// referenced lingers in the graph.
function _thrustRelease(g, stoppables, allNodes, dur) {
    const t = _ac.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0.001, t + dur);
    setTimeout(() => {
        stoppables.forEach(n => { try { n.stop(); } catch(e){} });
        allNodes.forEach(n => { try { n.disconnect(); } catch(e){} });
    }, dur * 1000 + 80);
}

function _thrustPearl() {
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.5); src.loop = true;
    const flt = _ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 115; flt.Q.value = 0.9;
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.001, _ac.currentTime);
    g.gain.linearRampToValueAtTime(0.719, _ac.currentTime + 0.07);
    src.connect(flt); flt.connect(g); g.connect(_master);
    src.start();
    return { stop: () => _thrustRelease(g, [src], [src, flt, g], 0.10) };
}

// AMBER: a warm resonant burn that breathes - a slow tremolo swells the mid-range
// glow brighter and dimmer, like coals cycling with the heat.
function _thrustAmber() {
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.5); src.loop = true;
    const flt = _ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 170; flt.Q.value = 1.6;
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.001, _ac.currentTime);
    g.gain.linearRampToValueAtTime(0.616, _ac.currentTime + 0.09);
    const lfo = _ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 2.2;
    const lfoGain = _ac.createGain(); lfoGain.gain.value = 0.044;
    lfo.connect(lfoGain); lfoGain.connect(g.gain);
    const glow = _ac.createOscillator(); glow.type = 'sine'; glow.frequency.value = 340;
    const glowGain = _ac.createGain(); glowGain.gain.value = 0.05;
    glow.connect(glowGain); glowGain.connect(g);
    src.connect(flt); flt.connect(g); g.connect(_master);
    src.start(); lfo.start(); glow.start();
    return { stop: () => _thrustRelease(g, [src, lfo, glow], [src, flt, lfo, lfoGain, glow, glowGain, g], 0.12) };
}

// CRIMSON: a real jet-engine roar - broadband exhaust turbulence, a mid-range
// chest, and a thin turbine whine riding on top, for a ship built for speed
// over armor. Went through a growl and a whistle before landing here.
function _thrustCrimson() {
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.001, _ac.currentTime);
    g.gain.linearRampToValueAtTime(0.370, _ac.currentTime + 0.08);
    const roarSrc = _ac.createBufferSource();
    roarSrc.buffer = _noiseBuf(0.6); roarSrc.loop = true;
    const roarFlt = _ac.createBiquadFilter(); roarFlt.type = 'lowpass'; roarFlt.frequency.value = 1100;
    const roarGain = _ac.createGain(); roarGain.gain.value = 0.55;
    roarSrc.connect(roarFlt); roarFlt.connect(roarGain); roarGain.connect(g);
    const chestSrc = _ac.createBufferSource();
    chestSrc.buffer = _noiseBuf(0.5); chestSrc.loop = true;
    const chestFlt = _ac.createBiquadFilter(); chestFlt.type = 'bandpass'; chestFlt.frequency.value = 340; chestFlt.Q.value = 0.6;
    const chestGain = _ac.createGain(); chestGain.gain.value = 0.35;
    chestSrc.connect(chestFlt); chestFlt.connect(chestGain); chestGain.connect(g);
    const whine = _ac.createOscillator(); whine.type = 'sine'; whine.frequency.value = 2200;
    const whineLfo = _ac.createOscillator(); whineLfo.type = 'sine'; whineLfo.frequency.value = 5.5;
    const whineLfoGain = _ac.createGain(); whineLfoGain.gain.value = 12;
    whineLfo.connect(whineLfoGain); whineLfoGain.connect(whine.frequency);
    const whineGain = _ac.createGain(); whineGain.gain.value = 0.045;
    whine.connect(whineGain); whineGain.connect(g);
    g.connect(_master);
    roarSrc.start(); chestSrc.start(); whine.start(); whineLfo.start();
    return {
        stop: () => _thrustRelease(
            g,
            [roarSrc, chestSrc, whine, whineLfo],
            [roarSrc, roarFlt, roarGain, chestSrc, chestFlt, chestGain, whine, whineLfo, whineLfoGain, whineGain, g],
            0.12
        )
    };
}

// ELECTRIC: a low square-wave hum ring-modulated into a Tesla-coil buzz, arcing
// like current barely held inside the coil.
function _thrustElectric() {
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.001, _ac.currentTime);
    g.gain.linearRampToValueAtTime(0.320, _ac.currentTime + 0.05);
    const hum = _ac.createOscillator(); hum.type = 'square'; hum.frequency.value = 85;
    const humGain = _ac.createGain(); humGain.gain.value = 0.09;
    hum.connect(humGain); humGain.connect(g);
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.5); src.loop = true;
    const hp = _ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
    const am = _ac.createGain(); am.gain.value = 0.14;
    const ringLfo = _ac.createOscillator(); ringLfo.type = 'sine'; ringLfo.frequency.value = 38;
    const ringLfoGain = _ac.createGain(); ringLfoGain.gain.value = 0.14;
    ringLfo.connect(ringLfoGain); ringLfoGain.connect(am.gain);
    src.connect(hp); hp.connect(am); am.connect(g);
    g.connect(_master);
    src.start(); hum.start(); ringLfo.start();
    return { stop: () => _thrustRelease(g, [src, hum, ringLfo], [src, hp, am, ringLfo, ringLfoGain, hum, humGain, g], 0.12) };
}

// TOXIC: a slow filter sweep gurgles through the noise floor while a vibrato-heavy
// undertone drifts off pitch, like something venting fumes.
function _thrustToxic() {
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.5); src.loop = true;
    const lp = _ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4; lp.frequency.value = 320;
    const sweepLfo = _ac.createOscillator(); sweepLfo.type = 'sine'; sweepLfo.frequency.value = 0.6;
    const sweepGain = _ac.createGain(); sweepGain.gain.value = 220;
    sweepLfo.connect(sweepGain); sweepGain.connect(lp.frequency);
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.001, _ac.currentTime);
    g.gain.linearRampToValueAtTime(0.298, _ac.currentTime + 0.10);
    const wobble = _ac.createOscillator(); wobble.type = 'sine'; wobble.frequency.value = 54;
    const vibLfo = _ac.createOscillator(); vibLfo.type = 'sine'; vibLfo.frequency.value = 4;
    const vibGain = _ac.createGain(); vibGain.gain.value = 7;
    vibLfo.connect(vibGain); vibGain.connect(wobble.frequency);
    const wobbleGain = _ac.createGain(); wobbleGain.gain.value = 0.10;
    wobble.connect(wobbleGain); wobbleGain.connect(g);
    src.connect(lp); lp.connect(g); g.connect(_master);
    src.start(); sweepLfo.start(); wobble.start(); vibLfo.start();
    return {
        stop: () => _thrustRelease(
            g,
            [src, sweepLfo, wobble, vibLfo],
            [src, lp, sweepLfo, sweepGain, wobble, vibLfo, vibGain, wobbleGain, g],
            0.12
        )
    };
}

// VOID: a deep rumble that breathes open and closed, a sub-bass pull that keeps
// sinking and resets, and a feedback echo that grows darker with every repeat -
// thrust swallowed rather than reflected.
function _thrustVoid() {
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.6); src.loop = true;
    const flt = _ac.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 50; flt.Q.value = 0.8;
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.001, _ac.currentTime);
    g.gain.linearRampToValueAtTime(0.387, _ac.currentTime + 0.15);

    // Slow breathing - the void opens and closes instead of droning at a fixed level.
    const breathLfo = _ac.createOscillator(); breathLfo.type = 'sine'; breathLfo.frequency.value = 0.14;
    const breathGain = _ac.createGain(); breathGain.gain.value = 0.064;
    breathLfo.connect(breathGain); breathGain.connect(g.gain);

    // Gravity pull - a deep sub drone that sinks in pitch over several seconds, then
    // glides back up, like something dragged toward a singularity and released.
    // Scheduled directly rather than driven by a raw LFO waveform so the release is
    // a smooth glide instead of an abrupt reset.
    const pull = _ac.createOscillator(); pull.type = 'sine'; pull.frequency.setValueAtTime(52, _ac.currentTime);
    const pullGain = _ac.createGain(); pullGain.gain.value = 0.10;
    pull.connect(pullGain); pullGain.connect(g);
    let pullAlive = true, pullTimer = null;
    (function pullCycle() {
        if (!pullAlive) return;
        const t0 = _ac.currentTime;
        pull.frequency.cancelScheduledValues(t0);
        pull.frequency.setValueAtTime(pull.frequency.value, t0);
        pull.frequency.linearRampToValueAtTime(30, t0 + 6.5);
        pull.frequency.linearRampToValueAtTime(52, t0 + 7.3);
        pullTimer = setTimeout(pullCycle, 7300);
    })();

    // Feedback echo darkened on every pass by a lowpass in the loop, so repeats get
    // swallowed into mud instead of reflecting cleanly.
    const delay = _ac.createDelay(1.0); delay.delayTime.value = 0.34;
    const fbFilter = _ac.createBiquadFilter(); fbFilter.type = 'lowpass'; fbFilter.frequency.value = 750;
    const fb = _ac.createGain(); fb.gain.value = 0.48;
    delay.connect(fbFilter); fbFilter.connect(fb); fb.connect(delay);
    const wet = _ac.createGain(); wet.gain.value = 0.55;

    src.connect(flt); flt.connect(g); g.connect(_master);
    g.connect(delay); delay.connect(wet); wet.connect(g);
    src.start(); breathLfo.start(); pull.start();

    return {
        stop: () => {
            pullAlive = false;
            if (pullTimer) clearTimeout(pullTimer);
            _thrustRelease(
                g,
                [src, breathLfo, pull],
                [src, flt, breathLfo, breathGain, pull, pullGain, delay, fbFilter, fb, wet, g],
                0.12
            );
        }
    };
}

// NOVA: a bright, high-passed sparkle chimes over a thin engine bed, two barely-
// detuned tones beating like starlight caught on metal.
function _thrustNova() {
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.001, _ac.currentTime);
    g.gain.linearRampToValueAtTime(0.216, _ac.currentTime + 0.08);
    const bedSrc = _ac.createBufferSource();
    bedSrc.buffer = _noiseBuf(0.5); bedSrc.loop = true;
    const bedFlt = _ac.createBiquadFilter(); bedFlt.type = 'bandpass'; bedFlt.frequency.value = 115; bedFlt.Q.value = 0.9;
    const bedGain = _ac.createGain(); bedGain.gain.value = 0.32;
    bedSrc.connect(bedFlt); bedFlt.connect(bedGain); bedGain.connect(g);
    const sparkSrc = _ac.createBufferSource();
    sparkSrc.buffer = _noiseBuf(0.5); sparkSrc.loop = true;
    const hp = _ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400; hp.Q.value = 0.7;
    const sparkGain = _ac.createGain(); sparkGain.gain.value = 0.30;
    sparkSrc.connect(hp); hp.connect(sparkGain); sparkGain.connect(g);
    const c1 = _ac.createOscillator(); c1.type = 'sine'; c1.frequency.value = 1800;
    const c2 = _ac.createOscillator(); c2.type = 'sine'; c2.frequency.value = 1812;
    const chimeGain = _ac.createGain(); chimeGain.gain.value = 0.05;
    const trem = _ac.createOscillator(); trem.type = 'sine'; trem.frequency.value = 3.4;
    const tremGain = _ac.createGain(); tremGain.gain.value = 0.04;
    trem.connect(tremGain); tremGain.connect(chimeGain.gain);
    c1.connect(chimeGain); c2.connect(chimeGain); chimeGain.connect(g);
    g.connect(_master);
    bedSrc.start(); sparkSrc.start(); c1.start(); c2.start(); trem.start();
    return {
        stop: () => _thrustRelease(
            g,
            [bedSrc, sparkSrc, c1, c2, trem],
            [bedSrc, bedFlt, bedGain, sparkSrc, hp, sparkGain, c1, c2, chimeGain, trem, tremGain, g],
            0.12
        )
    };
}

// SOLARIS: a rumbling base under a swelling harmonic choir and a slow stereo
// drift, crackling pops overhead, and a lub-dub reactor heartbeat underneath -
// the only engine in the fleet that sings and beats instead of just droning,
// for the last and most expensive ship in the roster.
function _thrustSolaris() {
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.001, _ac.currentTime);
    g.gain.linearRampToValueAtTime(0.875, _ac.currentTime + 0.12);

    const rumbleSrc = _ac.createBufferSource();
    rumbleSrc.buffer = _noiseBuf(0.6); rumbleSrc.loop = true;
    const rumbleFlt = _ac.createBiquadFilter(); rumbleFlt.type = 'bandpass'; rumbleFlt.frequency.value = 85; rumbleFlt.Q.value = 0.6;
    const rumbleGain = _ac.createGain(); rumbleGain.gain.value = 0.55;
    rumbleSrc.connect(rumbleFlt); rumbleFlt.connect(rumbleGain); rumbleGain.connect(g);

    // Fundamental swell plus two tracked overtones - a rising/falling harmonic choir,
    // not just a filtered noise band like every other ship.
    const wind = _ac.createOscillator(); wind.type = 'sine'; wind.frequency.value = 150;
    const overtone2 = _ac.createOscillator(); overtone2.type = 'sine'; overtone2.frequency.value = 300;
    const overtone3 = _ac.createOscillator(); overtone3.type = 'sine'; overtone3.frequency.value = 450;
    const windLfo = _ac.createOscillator(); windLfo.type = 'sine'; windLfo.frequency.value = 0.08;
    const windLfoGain = _ac.createGain(); windLfoGain.gain.value = 90;
    const windLfoGain2 = _ac.createGain(); windLfoGain2.gain.value = 180;
    const windLfoGain3 = _ac.createGain(); windLfoGain3.gain.value = 270;
    windLfo.connect(windLfoGain); windLfoGain.connect(wind.frequency);
    windLfo.connect(windLfoGain2); windLfoGain2.connect(overtone2.frequency);
    windLfo.connect(windLfoGain3); windLfoGain3.connect(overtone3.frequency);
    const windGain = _ac.createGain(); windGain.gain.value = 0.07;
    const ot2Gain = _ac.createGain(); ot2Gain.gain.value = 0.030;
    const ot3Gain = _ac.createGain(); ot3Gain.gain.value = 0.018;
    wind.connect(windGain); windGain.connect(g);
    overtone2.connect(ot2Gain); ot2Gain.connect(g);
    overtone3.connect(ot3Gain); ot3Gain.connect(g);

    // Slow stereo drift - the only ship whose thrust moves in space.
    const panner = _ac.createStereoPanner();
    const panLfo = _ac.createOscillator(); panLfo.type = 'sine'; panLfo.frequency.value = 0.05;
    const panLfoGain = _ac.createGain(); panLfoGain.gain.value = 0.6;
    panLfo.connect(panLfoGain); panLfoGain.connect(panner.pan);

    g.connect(panner); panner.connect(_master);
    rumbleSrc.start(); wind.start(); overtone2.start(); overtone3.start(); windLfo.start(); panLfo.start();

    // Crackling pops - real intermittent bursts, not a steady AM texture.
    let popAlive = true, popTimer = null;
    (function pop() {
        if (!popAlive) return;
        const dur = 0.05 + Math.random() * 0.05;
        const t0 = _ac.currentTime;
        const psrc = _ac.createBufferSource(); psrc.buffer = _noiseBuf(dur);
        const pflt = _ac.createBiquadFilter(); pflt.type = 'bandpass'; pflt.frequency.value = 2200 + Math.random() * 2600; pflt.Q.value = 2.5;
        const pg = _ac.createGain();
        pg.gain.setValueAtTime(0.0001, t0);
        pg.gain.linearRampToValueAtTime(0.14 + Math.random() * 0.10, t0 + 0.006);
        pg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        psrc.connect(pflt); pflt.connect(pg); pg.connect(g);
        psrc.start(t0); psrc.stop(t0 + dur + 0.02);
        setTimeout(() => { try { psrc.disconnect(); pflt.disconnect(); pg.disconnect(); } catch(e){} }, (dur + 0.05) * 1000);
        popTimer = setTimeout(pop, 130 + Math.random() * 320);
    })();

    // Reactor heartbeat - a lub-dub double pulse, not a single metronomic thump, the
    // one engine in the fleet that beats like something alive instead of droning.
    let beatAlive = true, beatTimer = null;
    function playThump(delay, freqStart, peakGain) {
        const t0 = _ac.currentTime + delay;
        const o = _ac.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(freqStart, t0);
        o.frequency.exponentialRampToValueAtTime(freqStart * 0.5, t0 + 0.16);
        const og = _ac.createGain();
        og.gain.setValueAtTime(0.0001, t0);
        og.gain.linearRampToValueAtTime(peakGain, t0 + 0.008);
        og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        o.connect(og); og.connect(g);
        o.start(t0); o.stop(t0 + 0.22);
        setTimeout(() => { try { o.disconnect(); og.disconnect(); } catch(e){} }, (delay + 0.24) * 1000 + 60);
    }
    (function heartbeat() {
        if (!beatAlive) return;
        playThump(0, 92, 0.28);
        playThump(0.16, 78, 0.36);
        beatTimer = setTimeout(heartbeat, 900);
    })();

    return {
        stop: () => {
            popAlive = false;
            beatAlive = false;
            if (popTimer) clearTimeout(popTimer);
            if (beatTimer) clearTimeout(beatTimer);
            _thrustRelease(
                g,
                [rumbleSrc, wind, overtone2, overtone3, windLfo, panLfo],
                [rumbleSrc, rumbleFlt, rumbleGain, wind, overtone2, overtone3, windLfo, windLfoGain, windLfoGain2, windLfoGain3,
                 windGain, ot2Gain, ot3Gain, panner, panLfo, panLfoGain, g],
                0.12
            );
        }
    };
}

const _THRUST_BUILDERS = [
    _thrustPearl, _thrustAmber, _thrustCrimson, _thrustElectric,
    _thrustToxic, _thrustVoid, _thrustNova, _thrustSolaris
];

// Shared upper-mid "presence" layer, added under EVERY ship's voice on 2026-09-17.
// The eight voices are centred between 85 and 340 Hz (PEARL's whole engine is a 115 Hz
// bandpass), which the 2026-09-05 offline-RMS pass measured as evenly matched at -28 dB
// - flat. A phone speaker rolls off hard below ~300-400 Hz, so on the device the thrust
// was far quieter than that number suggests, while on headphones it was exactly right.
// Rather than re-voicing eight engines, one quiet 700 Hz breath layer rides along: it is
// below every voice's own character in the mix, identical for all of them (so the
// carefully matched per-ship balance is untouched, every voice moves by the same
// amount), and it is the part a speaker can actually play.
const THRUST_PRESENCE_GAIN = 0.075;
let _tPresence = null;
function _thrustPresenceOn() {
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.5); src.loop = true;
    const flt = _ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 700; flt.Q.value = 0.8;
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.0001, _ac.currentTime);
    g.gain.linearRampToValueAtTime(THRUST_PRESENCE_GAIN, _ac.currentTime + 0.07);
    src.connect(flt); flt.connect(g); g.connect(_master);
    src.start();
    return { stop: () => _thrustRelease(g, [src], [src, flt, g], 0.10) };
}

function thrustOn() {
    if (!_ac || _tVoice || !fxOn) return;
    _tVoice = (_THRUST_BUILDERS[activeSkin] || _thrustPearl)();
    _tPresence = _thrustPresenceOn();
}

function thrustOff() {
    if (_tPresence) { _tPresence.stop(); _tPresence = null; }
    if (!_tVoice) return;
    _tVoice.stop();
    _tVoice = null;
}

// Ambient burning-thruster loop -- starts the instant onFire flips true (update.js,
// alongside sfxOnFire's one-shot ignition pop) and runs for the rest of the run, same
// "has to read during BOTH hold and release" reasoning as the ember-trickle particles it
// accompanies (see the onFire ember spawn in update.js): a sound gated by `holding` would
// vanish the moment the player releases, even though the ship is still visibly on fire.
// Deliberately the *same* bandpass-noise engine texture as thrustOn (115Hz, Q 0.9) rather
// than a different invented timbre -- the player already knows what that sound means
// (thruster running), so reusing it here reads as "the thruster is now always lit," not
// as an unrelated ambience layered on top. Quieter than thrustOn's active-hold gain since
// this has to sit underneath bgm and every one-shot sfx for however long the run lasts (a
// great run is 54-97s, see world.js/constants.js); when the player is also holding, the
// two stack for a louder, hotter engine, which is the intended feel.
function onFireLoopOn() {
    if (!_ac || _fNode || !fxOn) return;
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.5); src.loop = true;
    const flt = _ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 115; flt.Q.value = 0.9;
    _fGain = _ac.createGain();
    _fGain.gain.setValueAtTime(0.001, _ac.currentTime);
    _fGain.gain.linearRampToValueAtTime(0.14, _ac.currentTime + 0.15);
    src.connect(flt); flt.connect(_fGain); _fGain.connect(_master);
    src.start(); _fNode = src;
}

function onFireLoopOff() {
    if (!_fNode) return;
    const t = _ac.currentTime;
    _fGain.gain.cancelScheduledValues(t);
    _fGain.gain.setValueAtTime(_fGain.gain.value, t);
    _fGain.gain.linearRampToValueAtTime(0.001, t + 0.15);
    const n = _fNode; _fNode = null; _fGain = null;
    setTimeout(() => { try { n.stop(); } catch(e){} }, 250);
}

// Ambient magnet shimmer (P6c) -- runs for the whole time magnetTime > 0, not just as
// the one-shot sfxMagnet pickup. A power *state* (like slow-time reshaping the whole
// soundscape) should be audible for its duration, and the moment it cuts out becomes a
// felt "buff gone" cue the way it can't be when the only sound is the pickup itself.
// Started from systems.js on the green-coin grab, stopped from update.js the frame
// magnetTime hits 0, with belt-and-braces stops in startPlay/die. Deliberately faint:
// a high bandpass-noise shimmer bed plus two barely-detuned sines, well under bgm and
// every one-shot sfx. Same at-most-once guard pattern as thrustOn / onFireLoopOn.
function magnetLoopOn() {
    if (!_ac || _mNode || !fxOn) return;
    _mGain = _ac.createGain();
    _mGain.gain.setValueAtTime(0.0001, _ac.currentTime);
    _mGain.gain.linearRampToValueAtTime(0.05, _ac.currentTime + 0.25);
    _mGain.connect(_master);

    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.5); src.loop = true;
    const flt = _ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 5200; flt.Q.value = 6;
    src.connect(flt); flt.connect(_mGain);
    src.start(); _mNode = src;

    _mOsc = [329.6, 494].map((f, i) => {
        const o = _ac.createOscillator(), og = _ac.createGain();
        o.type = 'sine'; o.frequency.value = f * (1 + i * 0.004);
        og.gain.value = 0.02;
        o.connect(og); og.connect(_mGain);
        o.start();
        return o;
    });
}

// ── UI sfx ───────────────────────────────────────────────────────────
// Everything below is menu/HUD feedback, not gameplay feedback -- deliberately smaller
// and drier than any pickup/hazard sfx above so the menu doesn't compete with the run.

// Generic navigation tap: opens a panel (Settings/Shop/Leaderboard/Challenge/Privacy
// Options) or fires a plain forward action (Home, Share) with no selection semantics of
// its own. One shared sound for all of those rather than one each -- they're all the
// same gesture ("acknowledge the tap"), and a menu that plays a different blip per
// button reads as busier, not more polished.
function sfxUiTap() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.connect(g); g.connect(_master);
    o.type = 'triangle'; o.frequency.value = 720;
    // UI block raised +6 dB on 2026-09-17: measured at ~-33 dB momentary against a title
    // bed at ~-24, every menu sound in the game was quieter than the music it plays
    // over. Still the smallest, driest layer in the mix - see the block comment above.
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.start(t); o.stop(t + 0.06);
}

// Panel dismiss (tap outside Settings/Shop/Currency-Info). The mirror of sfxUiTap --
// lower and a hair quieter so "close" reads as the reverse gesture of "open" without
// inventing a third UI timbre.
function sfxUiClose() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.connect(g); g.connect(_master);
    o.type = 'sine'; o.frequency.value = 480;
    g.gain.setValueAtTime(0.10, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    o.start(t); o.stop(t + 0.05);
}

// Music/FX toggle. Deliberately does NOT gate on fxOn -- this is the control that turns
// fxOn itself on and off, so it has to stay audible on the exact tap that mutes it, or
// there is no confirmation that the mute even registered. Two mirrored two-note runs
// (rising for on, falling for off) rather than one tone, so the direction is audible
// even with the screen not in view (e.g. reaching for the phone).
function sfxUiToggle(on) {
    if (!_ac) return;
    const t = _ac.currentTime;
    const freqs = on ? [500, 700] : [700, 500];
    freqs.forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_master);
        o.type = 'triangle'; o.frequency.value = freq;
        const t0 = t + i * 0.05;
        g.gain.setValueAtTime(0.12, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
        o.start(t0); o.stop(t0 + 0.07);
    });
}

// Confirmed choice: skin select, language select. A real decision (not just navigating),
// so it gets a friendlier two-note lift instead of the flat sfxUiTap -- same idea as
// sfxCoin's climb. `skinIdx` (0-7, SKINS order in constants.js) is optional: pass it from
// the skin picker so each ship rings its own step of a major-pentatonic run (PEARL lowest,
// SOLARIS highest), turning "click through all 8 ships" into a small instrument rather
// than one identical blip eight times; omitted (language picker, or any future caller
// with no per-item identity) falls back to the plain two-note lift.
function sfxUiSelect(skinIdx) {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const STEPS = [0, 2, 4, 5, 7, 9, 11, 12];  // major scale, one step per ship, low->high
    const mul = Number.isInteger(skinIdx)
        ? Math.pow(2, STEPS[Math.min(Math.max(skinIdx, 0), STEPS.length - 1)] / 12)
        : 1;
    [660 * mul, 880 * mul].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_master);
        o.type = 'triangle'; o.frequency.value = freq;
        const t0 = t + i * 0.055;
        g.gain.setValueAtTime(0.16, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
        o.start(t0); o.stop(t0 + 0.10);
    });
}

// "Can't do that" -- tapping a locked skin. Deliberately flat and dull (a square wave
// with no pitch movement) rather than anything from the poison/hazard family: this is a
// neutral no, not a punishment, so it shouldn't borrow a "you got hurt" timbre.
function sfxUiDenied() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.connect(g); g.connect(_master);
    o.type = 'square'; o.frequency.value = 220;
    g.gain.setValueAtTime(0.10, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.start(t); o.stop(t + 0.08);
}

// Purchase/restore actually completed (main.js's _tunlNativeUpdate, on the
// removeAdsOwned/allShipsOwned false->true transition only -- never on every launch's
// entitlement sync). The one moment JS knows real money changed hands, so it earns a
// small fanfare rather than another sfxUiTap: a warm major-triad climb, no boom layer
// (this is a reward, not sfxBomb's charge-then-detonate).
function sfxUiPurchaseSuccess() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_master);
        o.type = 'triangle'; o.frequency.value = freq;
        const t0 = t + i * 0.08;
        const peak = i === 3 ? 0.16 : 0.12;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i === 3 ? 0.55 : 0.22));
        o.start(t0); o.stop(t0 + 0.6);
    });
}

// One-time "power on" stinger for the title screen, standing in for the splash screen
// itself: the native launch screen (black, pre-JS) can't play anything JS-driven no
// matter how it's optimized, so this fires instead on the very first titleScreen() call
// of the app's lifetime (see _bootChimePlayed below, set from lifecycle.js). Purely
// synthesized -- no fetch, no decode -- so it's audible the instant the title screen
// first draws, not gated behind the_mountain_documentary.mp3's network load like the
// title music is. Deliberately NOT replayed on every return-to-title after a death;
// a good run is 20-36 real seconds (see world.js), so a sound played every time would
// wear out inside the first few runs of a single sitting.
// Was a single sine sweeping 180Hz->900Hz -- on request (2026-09-16), replaced: it read
// as a cartoon "boioioing"/fish-flop rather than a power-on. Now a sub thump for weight,
// a rising two-note stab (the system coming online) and a short high shimmer tail --
// same triangle-stab-plus-sine-ring shape as sfxPbPassed, just smaller and lower.
let _bootChimePlayed = false;
function sfxBoot() {
    if (_bootChimePlayed) return;
    _bootChimePlayed = true;
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const sub = _ac.createOscillator(), subG = _ac.createGain();
    sub.connect(subG); subG.connect(_master);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, t);
    sub.frequency.exponentialRampToValueAtTime(55, t + 0.18);
    subG.gain.setValueAtTime(0.001, t);
    subG.gain.linearRampToValueAtTime(0.20, t + 0.02);
    subG.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    sub.start(t); sub.stop(t + 0.24);
    [392.00, 659.25].forEach((freq, i) => { // G4, E5
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_master);
        o.type = 'triangle'; o.frequency.value = freq;
        const t0 = t + 0.05 + i * 0.09;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
        o.start(t0); o.stop(t0 + 0.3);
    });
    const r = _ac.createOscillator(), rg = _ac.createGain();
    r.connect(rg); rg.connect(_master);
    r.type = 'sine'; r.frequency.value = 1318.5; // E6
    const rt = t + 0.16;
    rg.gain.setValueAtTime(0.0001, rt);
    rg.gain.exponentialRampToValueAtTime(0.07, rt + 0.02);
    rg.gain.exponentialRampToValueAtTime(0.0001, rt + 0.35);
    r.start(rt); r.stop(rt + 0.4);
}

function magnetLoopOff() {
    if (!_mNode) return;
    const t = _ac.currentTime;
    _mGain.gain.cancelScheduledValues(t);
    _mGain.gain.setValueAtTime(_mGain.gain.value, t);
    _mGain.gain.linearRampToValueAtTime(0.0001, t + 0.20);
    const n = _mNode, oscs = _mOsc || [];
    _mNode = null; _mGain = null; _mOsc = null;
    setTimeout(() => {
        try { n.stop(); } catch(e){}
        oscs.forEach(o => { try { o.stop(); } catch(e){} });
    }, 260);
}

// Ambient warp whoosh - runs for the whole warpTime > 0 window (constants.js "Warp
// portal" doc), same "a power state should be audible for its duration" reasoning
// as magnetLoopOn above: a rising-pitch filtered noise bed plus two detuned sines,
// distinct from magnet's high shimmer by sitting lower and sweeping upward with the
// warp's own speed ramp instead of holding a fixed frequency. Started from
// triggerWarp() (systems.js), stopped from update.js the frame warpTime hits 0,
// with the same belt-and-braces stop in the AudioContext-recycle path above.
function warpLoopOn() {
    if (!_ac || _wNode || !fxOn) return;
    _wGain = _ac.createGain();
    _wGain.gain.setValueAtTime(0.0001, _ac.currentTime);
    _wGain.gain.linearRampToValueAtTime(0.09, _ac.currentTime + 0.12);
    _wGain.connect(_master);

    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.5); src.loop = true;
    const flt = _ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.Q.value = 3.5;
    flt.frequency.setValueAtTime(700, _ac.currentTime);
    flt.frequency.linearRampToValueAtTime(2200, _ac.currentTime + 1.4);
    src.connect(flt); flt.connect(_wGain);
    src.start(); _wNode = src;

    _wOsc = [220, 330].map((f, i) => {
        const o = _ac.createOscillator(), og = _ac.createGain();
        o.type = 'sawtooth'; o.frequency.value = f * (1 + i * 0.006);
        og.gain.value = 0.018;
        o.connect(og); og.connect(_wGain);
        o.start();
        return o;
    });
}

function warpLoopOff() {
    if (!_wNode) return;
    const t = _ac.currentTime;
    _wGain.gain.cancelScheduledValues(t);
    _wGain.gain.setValueAtTime(_wGain.gain.value, t);
    _wGain.gain.linearRampToValueAtTime(0.0001, t + 0.18);
    const n = _wNode, oscs = _wOsc || [];
    _wNode = null; _wGain = null; _wOsc = null;
    setTimeout(() => {
        try { n.stop(); } catch(e){}
        oscs.forEach(o => { try { o.stop(); } catch(e){} });
    }, 220);
}
