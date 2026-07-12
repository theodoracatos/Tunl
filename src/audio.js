// ── Audio ─────────────────────────────────────────────────────────────

let _ac = null, _tNode = null, _tGain = null;
let _bgmBuf = null, _bgmBufRev = null, _bgmNode = null, _bgmGain = null;
let _bgmDir = 1, _bgmActive = false, _bgmPending = false;
let _titleBgmBuf = null, _titleBgmNode = null, _titleBgmGain = null;
let _titleBgmActive = false, _titleBgmPending = false;

function _startBgMusic() {
    if (!musicOn) return;
    if (_bgmActive) return;  // already playing - don't restart
    _bgmActive = true;
    _bgmDir = 1;
    // Reset gain in case it was faded to near-zero during death
    if (_bgmGain && _ac) {
        _bgmGain.gain.cancelScheduledValues(_ac.currentTime);
        _bgmGain.gain.setValueAtTime(0.32, _ac.currentTime);
    }
    if (_bgmBuf) { _playBgmBuffer(); return; }
    // buffer still decoding - mark pending; _initAC will start playback when ready
    _bgmPending = true;
}

function _playBgmBuffer() {
    if (!_ac || !_bgmBuf || !_bgmActive) return;
    _bgmGain = _bgmGain || (() => {
        const g = _ac.createGain(); g.gain.value = 0.32; g.connect(_ac.destination); return g;
    })();
    _bgmNode = _ac.createBufferSource();
    _bgmNode.buffer = _bgmDir === 1 ? _bgmBuf : _bgmBufRev;
    _bgmNode.connect(_bgmGain);
    _bgmNode.onended = () => { _bgmDir *= -1; _playBgmBuffer(); };
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

function _startTitleMusic() {
    if (!musicOn) return;
    if (_titleBgmActive) return;  // already playing - don't restart
    _titleBgmActive = true;
    if (_titleBgmGain && _ac) {
        _titleBgmGain.gain.cancelScheduledValues(_ac.currentTime);
        _titleBgmGain.gain.setValueAtTime(0.32, _ac.currentTime);
    }
    if (_titleBgmBuf) { _playTitleBgmBuffer(); return; }
    // buffer still decoding - mark pending; _initAC will start playback when ready
    _titleBgmPending = true;
}

function _playTitleBgmBuffer() {
    if (!_ac || !_titleBgmBuf || !_titleBgmActive) return;
    _titleBgmGain = _titleBgmGain || (() => {
        const g = _ac.createGain(); g.gain.value = 0.32; g.connect(_ac.destination); return g;
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
    if (_ac) { if (_ac.state === 'suspended') _ac.resume(); return; }
    _ac = new (window.AudioContext || window.webkitAudioContext)();
    // WebKit sometimes creates the context in 'suspended' state even inside a
    // user gesture - resume it explicitly now, still within the gesture.
    if (_ac.state === 'suspended') _ac.resume();
    fetch('the_mountain.mp3')
        .then(r => r.arrayBuffer())
        .then(ab => _ac.decodeAudioData(ab))
        .then(buf => {
            _bgmBuf = buf;
            _bgmBufRev = _ac.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
            for (let c = 0; c < buf.numberOfChannels; c++) {
                const fwd = buf.getChannelData(c);
                const rev = _bgmBufRev.getChannelData(c);
                for (let i = 0; i < buf.length; i++) rev[i] = fwd[buf.length - 1 - i];
            }
            if (_bgmPending && _bgmActive) { _bgmPending = false; _playBgmBuffer(); }
        })
        .catch(() => {});
    fetch('the_mountain_documentary.mp3')
        .then(r => r.arrayBuffer())
        .then(ab => _ac.decodeAudioData(ab))
        .then(buf => {
            _titleBgmBuf = buf;
            if (_titleBgmPending && _titleBgmActive) { _titleBgmPending = false; _playTitleBgmBuffer(); }
        })
        .catch(() => {});
}

function _noiseBuf(dur) {
    const len = Math.ceil(_ac.sampleRate * dur);
    const buf = _ac.createBuffer(1, len, _ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random()*2-1;
    return buf;
}

function sfxCoin() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    [600, 900].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_ac.destination);
        o.type = 'sine'; o.frequency.value = freq;
        const t0 = t + i * 0.10;
        g.gain.setValueAtTime(0.14, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
        o.start(t0); o.stop(t0 + 0.16);
    });
}

function sfxDie() {
    window.webkit?.messageHandlers?.haptic?.postMessage('error');
    if (!_ac || !fxOn) return;
    const t   = _ac.currentTime;
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.6);
    const flt = _ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(900, t);
    flt.frequency.exponentialRampToValueAtTime(55, t + 0.45);
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.50, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.60);
    src.connect(flt); flt.connect(g); g.connect(_ac.destination);
    src.start(t); src.stop(t + 0.62);
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

function sfxShield() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    [500, 750, 1000, 1300].forEach((freq, i) => {
        const o = _ac.createOscillator(), g = _ac.createGain();
        o.connect(g); g.connect(_ac.destination);
        o.type = 'triangle'; o.frequency.value = freq;
        const t0 = t + i * 0.07;
        g.gain.setValueAtTime(0.12, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
        o.start(t0); o.stop(t0 + 0.19);
    });
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
        g.gain.setValueAtTime(0.11, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);
        o.start(t0); o.stop(t0 + 0.33);
    });
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
    const base = n >= 200 ? 660 : n >= 100 ? 550 : 440;
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
    const o = _ac.createOscillator(), g = _ac.createGain();
    o.connect(g); g.connect(_ac.destination);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.09);
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.start(t); o.stop(t + 0.12);
}

function sfxStalCrack() {
    if (!_ac || !fxOn) return;
    const t = _ac.currentTime;
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.22);
    const flt = _ac.createBiquadFilter();
    flt.type = 'highpass'; flt.frequency.value = 1400;
    const g = _ac.createGain();
    g.gain.setValueAtTime(0.38, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
    src.connect(flt); flt.connect(g); g.connect(_ac.destination);
    src.start(t); src.stop(t + 0.22);
}

function thrustOn() {
    if (!_ac || _tNode || !fxOn) return;
    const src = _ac.createBufferSource();
    src.buffer = _noiseBuf(0.5); src.loop = true;
    const flt = _ac.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 115; flt.Q.value = 0.9;
    _tGain = _ac.createGain();
    _tGain.gain.setValueAtTime(0.001, _ac.currentTime);
    _tGain.gain.linearRampToValueAtTime(0.20, _ac.currentTime + 0.07);
    src.connect(flt); flt.connect(_tGain); _tGain.connect(_ac.destination);
    src.start(); _tNode = src;
}

function thrustOff() {
    if (!_tNode) return;
    const t = _ac.currentTime;
    _tGain.gain.cancelScheduledValues(t);
    _tGain.gain.setValueAtTime(_tGain.gain.value, t);
    _tGain.gain.linearRampToValueAtTime(0.001, t + 0.10);
    const n = _tNode; _tNode = null; _tGain = null;
    setTimeout(() => { try { n.stop(); } catch(e){} }, 200);
}
