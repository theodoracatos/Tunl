// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── Audio ─────────────────────────────────────────────────────────────

let _ac = null, _tVoice = null;
let _fNode = null, _fGain = null;
let _mNode = null, _mGain = null, _mOsc = null;
// Last-fired bullet-fire voices, so a death mid-burst can cut them off instead of
// letting the tail ring on into sfxDie (see sfxBulletFireStop below).
let _bfVoices = [];
let _bgmBuf = null, _bgmNode = null, _bgmGain = null;
let _bgmLoading = false, _titleBgmLoading = false; // in-flight guards for the lazy loaders
let _bgmActive = false, _bgmPending = false;
let _titleBgmBuf = null, _titleBgmNode = null, _titleBgmGain = null;
let _titleBgmActive = false, _titleBgmPending = false;

function _startBgMusic() {
    if (!musicOn) return;
    if (_bgmActive) return;  // already playing - don't restart
    _bgmActive = true;
    // Reset gain in case it was faded to near-zero during death
    if (_bgmGain && _ac) {
        _bgmGain.gain.cancelScheduledValues(_ac.currentTime);
        _bgmGain.gain.setValueAtTime(0.10, _ac.currentTime);
    }
    if (_bgmBuf) { _playBgmBuffer(); return; }
    // Not loaded yet - mark pending and kick the loader (no-op if already in flight);
    // it starts playback itself once the buffer lands.
    _bgmPending = true;
    _loadBgmBuffer();
}

function _playBgmBuffer() {
    if (!_ac || !_bgmBuf || !_bgmActive) return;
    _bgmGain = _bgmGain || (() => {
        const g = _ac.createGain(); g.gain.value = 0.10; g.connect(_ac.destination); return g;
    })();
    _bgmNode = _ac.createBufferSource();
    _bgmNode.buffer = _bgmBuf;
    _bgmNode.loop = true;
    _bgmNode.connect(_bgmGain);
    _bgmNode.start();
}

function _fadeBgMusic() {
    _bgmActive = false;
    _bgmPending = false;
    // stop Web Audio bgm (tiny ramp to avoid click, then hard stop)
    if (_bgmGain && _bgmNode) {
        const t = _ac.currentTime;
        _bgmGain.gain.cancelScheduledValues(t);
        _bgmGain.gain.setValueAtTime(_bgmGain.gain.value, t);
        _bgmGain.gain.linearRampToValueAtTime(0.001, t + 0.05);
        const n = _bgmNode; _bgmNode = null;
        n.onended = null;  // prevent ghost restart from stopped node
        setTimeout(() => { try { n.stop(); } catch(e){} }, 80);
    }
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

function _startTitleMusic() {
    if (!musicOn) return;
    if (_titleBgmActive) return;  // already playing - don't restart
    _titleBgmActive = true;
    if (_titleBgmGain && _ac) {
        _titleBgmGain.gain.cancelScheduledValues(_ac.currentTime);
        _titleBgmGain.gain.setValueAtTime(0.10, _ac.currentTime);
    }
    if (_titleBgmBuf) { _playTitleBgmBuffer(); return; }
    // Not loaded yet - mark pending and kick the loader (no-op if already in flight);
    // it starts playback itself once the buffer lands.
    _titleBgmPending = true;
    _loadTitleBgmBuffer();
}

function _playTitleBgmBuffer() {
    if (!_ac || !_titleBgmBuf || !_titleBgmActive) return;
    _titleBgmGain = _titleBgmGain || (() => {
        const g = _ac.createGain(); g.gain.value = 0.10; g.connect(_ac.destination); return g;
    })();
    _titleBgmNode = _ac.createBufferSource();
    _titleBgmNode.buffer = _titleBgmBuf;
    _titleBgmNode.loop = true;
    _titleBgmNode.connect(_titleBgmGain);
    _titleBgmNode.start();
}

function _fadeTitleMusic() {
    _titleBgmActive = false;
    _titleBgmPending = false;
    if (_titleBgmGain && _titleBgmNode) {
        const t = _ac.currentTime;
        _titleBgmGain.gain.cancelScheduledValues(t);
        _titleBgmGain.gain.setValueAtTime(_titleBgmGain.gain.value, t);
        _titleBgmGain.gain.linearRampToValueAtTime(0.001, t + 0.05);
        const n = _titleBgmNode; _titleBgmNode = null;
        setTimeout(() => { try { n.stop(); } catch(e){} }, 80);
    }
}

function _initAC() {
    // Every thrust tap during play routes through here too (see input.js) - if
    // backgrounding fully closed the context, this must be able to recover it,
    // not just resume a merely-suspended one (see _reviveAudioContext below).
    if (_ac) { _reviveAudioContext(); return; }
    _ac = new (window.AudioContext || window.webkitAudioContext)();
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

// The open web build (isWeb()) pulls a smaller mono AAC encode of each track to
// roughly halve link-open weight; build-play.mjs copies the .web.m4a files into
// play/. AAC decodes everywhere decodeAudioData is supported, so there's no
// fallback path. The app builds keep the full stereo mp3 - gradle's copyGameFiles
// and the Xcode resource refs list only the .mp3s, so the .m4a is never bundled.
function _bgmUrl(name) {
    return (typeof isWeb === 'function' && isWeb()) ? name + '.web.m4a' : name + '.mp3';
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
            _bgmBuf = buf;
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
            _titleBgmBuf = buf;
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
    try { _ac.close(); } catch(e){}
    _bgmPending = _bgmActive;
    _titleBgmPending = _titleBgmActive;
    _ac = null; _bgmBuf = null; _bgmNode = null; _bgmGain = null;
    _titleBgmBuf = null; _titleBgmNode = null; _titleBgmGain = null;
    // Any decode still in flight belongs to the context just closed and will drop itself
    // on the _ac !== ctx check; clear the guards so the fresh context can load again.
    _bgmLoading = false; _titleBgmLoading = false;
    _mNode = null; _mGain = null; _mOsc = null;  // magnet shimmer belonged to the closed context
    _initAC();
}
// visibilitychange is the fallback path - WKWebView doesn't always fire it
// reliably when the *native* app (rather than the page itself) backgrounds,
// which is why GameView.swift's Coordinator also calls window._tunlResumeAudio
// directly from applicationDidBecomeActive. Both paths funnel into the same
// revive logic so whichever fires first wins.
document.addEventListener('visibilitychange', () => { if (!document.hidden) _reviveAudioContext(); });
window._tunlResumeAudio = _reviveAudioContext;

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
        o.connect(g); g.connect(_ac.destination);
        o.type = 'sine'; o.frequency.value = freq;
        const t0 = t + i * 0.10;
        g.gain.setValueAtTime(0.14, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
        o.start(t0); o.stop(t0 + 0.16);
    });
}

function sfxEngineSpoolUp() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const dur = 1.3;
    // Deep broadband roar - measured real jet engine recordings are bass-dominant
    // noise (spectral centroid ~450Hz, low-band energy ~8x high-band), not a
    // bright tone or whine: fast attack, gradual loudness swell.
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(dur);
    const flt = _ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(160, t);
    flt.frequency.linearRampToValueAtTime(420, t + dur);
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.30, t + 0.12);
    g.gain.linearRampToValueAtTime(0.40, t + dur * 0.9);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(_ac.destination);
    src.start(t); src.stop(t + dur + 0.05);
    // Mid roar color - broad, low-centered bandpass for engine "growl" texture
    const src2 = _ac.createBufferSource();
    src2.buffer = _noiseBuf(dur);
    const flt2 = _ac.createBiquadFilter();
    flt2.type = 'bandpass'; flt2.Q.value = 0.6; flt2.frequency.value = 480;
    const g2 = _ac.createGain();
    g2.gain.setValueAtTime(0.001, t);
    g2.gain.linearRampToValueAtTime(0.14, t + 0.15);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src2.connect(flt2); flt2.connect(g2); g2.connect(_ac.destination);
    src2.start(t); src2.stop(t + dur + 0.05);
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
    src.connect(flt); flt.connect(g); g.connect(_ac.destination);
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
    src2.connect(flt2); flt2.connect(g2); g2.connect(_ac.destination);
    src2.start(t); src2.stop(t + dur + 0.05);
    // Impact crash near the end - low thump only. Used to also layer a sharp
    // highpass "crack" here, but that's the same short highpass-noise-burst
    // technique the projectile-hit sounds use (see sfxStalCrack), so it read as
    // the bullet-hit sound playing again at death - dropped on request.
    const tImpact = t + dur - 0.08;
    const crash = _ac.createBufferSource();
    crash.buffer = _noiseBuf(0.3);
    const crashFlt = _ac.createBiquadFilter();
    crashFlt.type = 'lowpass';
    crashFlt.frequency.setValueAtTime(700, tImpact);
    crashFlt.frequency.exponentialRampToValueAtTime(60, tImpact + 0.22);
    const crashGain = _ac.createGain();
    crashGain.gain.setValueAtTime(0.32, tImpact);
    crashGain.gain.exponentialRampToValueAtTime(0.001, tImpact + 0.26);
    crash.connect(crashFlt); crashFlt.connect(crashGain); crashGain.connect(_ac.destination);
    crash.start(tImpact); crash.stop(tImpact + 0.28);
}

function sfxSlow() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    [480, 360, 270].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_ac.destination);
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
        o.connect(g); g.connect(_ac.destination);
        o.type = 'triangle'; o.frequency.value = freq;
        const t0 = t + i * 0.07;
        g.gain.setValueAtTime(0.15, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
        o.start(t0); o.stop(t0 + 0.25);
    });
    const lo = _ac.createOscillator(), lg = _ac.createGain();
    lo.connect(lg); lg.connect(_ac.destination);
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
        o.connect(g); g.connect(_ac.destination);
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
        o.connect(g); g.connect(_ac.destination);
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
    sq.connect(sqFlt); sqFlt.connect(sqG); sqG.connect(_ac.destination);
    sq.start(t); sq.stop(t + 0.36);
}

function sfxBomb() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    // Bright ascending chime (the "power triggered" cue) immediately followed by a
    // punchy low boom, so the pickup reads as one "charge then detonate" gesture.
    [500, 750, 1100].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_ac.destination);
        o.type = 'triangle'; o.frequency.value = freq;
        const t0 = t + i * 0.045;
        g.gain.setValueAtTime(0.16, t0);   // P6b: rare, run-defining pickup
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
        o.start(t0); o.stop(t0 + 0.15);
    });
    const tBoom = t + 0.16;
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.5);
    const flt = _ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(750, tBoom);
    flt.frequency.exponentialRampToValueAtTime(50, tBoom + 0.40);
    const g2 = _ac.createGain();
    g2.gain.setValueAtTime(0.44, tBoom);
    g2.gain.exponentialRampToValueAtTime(0.001, tBoom + 0.44);
    src.connect(flt); flt.connect(g2); g2.connect(_ac.destination);
    src.start(tBoom); src.stop(tBoom + 0.46);
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
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(flt); flt.connect(g); g.connect(_ac.destination);
    src.start(t); src.stop(t + 0.19);
    // Low thump for artillery weight the old single-layer version lacked.
    const src2 = _ac.createBufferSource();
    src2.buffer = _noiseBuf(0.14);
    const flt2 = _ac.createBiquadFilter();
    flt2.type = 'lowpass'; flt2.frequency.value = 200;
    const g2 = _ac.createGain();
    g2.gain.setValueAtTime(0.34, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    src2.connect(flt2); flt2.connect(g2); g2.connect(_ac.destination);
    src2.start(t); src2.stop(t + 0.15);
    // Muzzle crack: a hair of bright noise on the attack for punch.
    const src3 = _ac.createBufferSource();
    src3.buffer = _noiseBuf(0.02);
    const flt3 = _ac.createBiquadFilter();
    flt3.type = 'highpass'; flt3.frequency.value = 3000;
    const g3 = _ac.createGain();
    g3.gain.setValueAtTime(0.18, t);
    g3.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    src3.connect(flt3); flt3.connect(g3); g3.connect(_ac.destination);
    src3.start(t); src3.stop(t + 0.02);
}

function sfxShieldBreak() {
    if (!_ac || !fxOn) return;
    const t   = _ac.currentTime;
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.3);
    const flt = _ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 700; flt.Q.value = 1.8;
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.40, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    src.connect(flt); flt.connect(g); g.connect(_ac.destination);
    src.start(t); src.stop(t + 0.30);
}

function sfxMilestone(n) {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const base = n >= 1000 ? 780 : n >= 200 ? 660 : n >= 100 ? 550 : 440;
    [base, base*1.25, base*1.5, base*2].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_ac.destination);
        o.type = 'sine'; o.frequency.value = freq;
        const t0 = t + i * 0.06;
        g.gain.setValueAtTime(0.13, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.40);
        o.start(t0); o.stop(t0 + 0.42);
    });
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
        o.connect(g); g.connect(_ac.destination);
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
    o.connect(g); g.connect(_ac.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.10);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.start(t); o.stop(t + 0.15);
}

function sfxCombo(level) {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.connect(g); g.connect(_ac.destination);
    o.type = 'triangle';
    o.frequency.value = Math.min(600 + level * 120, 1400);
    g.gain.setValueAtTime(0.09, t);
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
    src.connect(flt); flt.connect(g); g.connect(_ac.destination);
    src.start(t); src.stop(t + dur + 0.05);
    // Bright ascending ping riding on top so the moment reads as a reward, not a hazard --
    // the noise layer alone sits too close to sfxMineExplode's damage texture.
    [880, 1320].forEach((freq, i) => {
        const o = _ac.createOscillator(), og = _ac.createGain();
        o.connect(og); og.connect(_ac.destination);
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
        o.connect(g); g.connect(_ac.destination);
        o.type = 'triangle'; o.frequency.value = freq;
        const t0 = t + i * 0.06;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.15, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
        o.start(t0); o.stop(t0 + 0.30);
    });
    // High sine ring that outlasts the arpeggio by a beat -- the "gold" shimmer.
    const r = _ac.createOscillator(), rg = _ac.createGain();
    r.connect(rg); rg.connect(_ac.destination);
    r.type = 'sine'; r.frequency.value = 1975.5; // B6
    const rt = t + 0.14;
    rg.gain.setValueAtTime(0.0001, rt);
    rg.gain.exponentialRampToValueAtTime(0.09, rt + 0.02);
    rg.gain.exponentialRampToValueAtTime(0.0001, rt + 0.55);
    r.start(rt); r.stop(rt + 0.6);
}

function sfxMineExplode() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.45);
    const flt = _ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(700, t);
    flt.frequency.exponentialRampToValueAtTime(55, t + 0.38);
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.42, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.44);
    src.connect(flt); flt.connect(g); g.connect(_ac.destination);
    src.start(t); src.stop(t + 0.46);
    // Short high crack layered on top
    const src2 = _ac.createBufferSource();
    src2.buffer = _noiseBuf(0.12);
    const flt2 = _ac.createBiquadFilter();
    flt2.type = 'highpass'; flt2.frequency.value = 1800;
    const g2 = _ac.createGain();
    g2.gain.setValueAtTime(0.28, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    src2.connect(flt2); flt2.connect(g2); g2.connect(_ac.destination);
    src2.start(t); src2.stop(t + 0.12);
}

function sfxBulletPickup() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    [440, 660, 990].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_ac.destination);
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
    o.connect(flt); flt.connect(g); g.connect(_ac.destination);
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
    o2.connect(g2); g2.connect(_ac.destination);
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
    src.connect(cFlt); cFlt.connect(g3); g3.connect(_ac.destination);
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
    src.connect(flt); flt.connect(g); g.connect(_ac.destination);
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
    src2.connect(flt2); flt2.connect(g2); g2.connect(_ac.destination);
    src2.start(t); src2.stop(t + 0.015);
    // Low thump underneath so the hit reads with a bit of weight, not pure static.
    const o = _ac.createOscillator(), g3 = _ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.08);
    g3.gain.setValueAtTime(0.10, t);
    g3.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    o.connect(g3); g3.connect(_ac.destination);
    o.start(t); o.stop(t + 0.09);
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
    src.connect(flt); flt.connect(g); g.connect(_ac.destination);
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
    src.connect(flt); flt.connect(g); g.connect(_ac.destination);
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
    g.connect(_ac.destination);
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
    g.connect(_ac.destination);
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
    src.connect(lp); lp.connect(g); g.connect(_ac.destination);
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

    src.connect(flt); flt.connect(g); g.connect(_ac.destination);
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
    g.connect(_ac.destination);
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

    g.connect(panner); panner.connect(_ac.destination);
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

function thrustOn() {
    if (!_ac || _tVoice || !fxOn) return;
    _tVoice = (_THRUST_BUILDERS[activeSkin] || _thrustPearl)();
}

function thrustOff() {
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
    src.connect(flt); flt.connect(_fGain); _fGain.connect(_ac.destination);
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
    _mGain.connect(_ac.destination);

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
    o.connect(g); g.connect(_ac.destination);
    o.type = 'triangle'; o.frequency.value = 720;
    g.gain.setValueAtTime(0.07, t);
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
    o.connect(g); g.connect(_ac.destination);
    o.type = 'sine'; o.frequency.value = 480;
    g.gain.setValueAtTime(0.05, t);
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
        o.connect(g); g.connect(_ac.destination);
        o.type = 'triangle'; o.frequency.value = freq;
        const t0 = t + i * 0.05;
        g.gain.setValueAtTime(0.06, t0);
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
        o.connect(g); g.connect(_ac.destination);
        o.type = 'triangle'; o.frequency.value = freq;
        const t0 = t + i * 0.055;
        g.gain.setValueAtTime(0.08, t0);
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
    o.connect(g); g.connect(_ac.destination);
    o.type = 'square'; o.frequency.value = 220;
    g.gain.setValueAtTime(0.05, t);
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
        o.connect(g); g.connect(_ac.destination);
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
let _bootChimePlayed = false;
function sfxBoot() {
    if (_bootChimePlayed) return;
    _bootChimePlayed = true;
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.connect(g); g.connect(_ac.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.26);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.10, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.start(t); o.stop(t + 0.3);
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
