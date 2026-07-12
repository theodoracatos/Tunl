// ── Input ─────────────────────────────────────────────────────────────

function inRect(cx, cy, r) { return cx >= r.x && cx <= r.x+r.w && cy >= r.y && cy <= r.y+r.h; }

// Backgrounding/closing the app (task switcher swipe, tab hide, etc.) can fire
// a spurious pointerdown/up right as the transition happens. Suppress input
// while hidden/unfocused and for a short grace period after returning, so that
// transition doesn't get misread as a tap-to-start.
let _inputSuppressedUntil = 0;
const INPUT_RESUME_GRACE_MS = 400;
function _suppressInput() {
    holding = false; thrustOff();
    _inputSuppressedUntil = performance.now() + INPUT_RESUME_GRACE_MS;
}
document.addEventListener('visibilitychange', () => { if (document.hidden) _suppressInput(); else _inputSuppressedUntil = performance.now() + INPUT_RESUME_GRACE_MS; });
window.addEventListener('blur', _suppressInput);
window.addEventListener('pagehide', _suppressInput);

// A blank-area tap on the title screen starts a run. But that tap's pointerdown
// is indistinguishable from the start of a system edge-swipe gesture (e.g. iOS
// swipe-up to close the app), which iOS cancels rather than completes. So an
// empty-area press on the title screen doesn't start the game immediately -
// it waits for a confirmed pointerup, and a pointercancel aborts it.
let _titleStartPending = null;

function onDown(e) {
    if (document.hidden || performance.now() < _inputSuppressedUntil) return;
    if (phase === 'title' && e) {
        const rect = cv.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (W / rect.width);
        const cy = (e.clientY - rect.top)  * (H / rect.height);

        // Language panel intercepts all taps when open
        if (showSettings) {
            if (_removeAdsBtnRect && inRect(cx, cy, _removeAdsBtnRect)) {
                window.webkit?.messageHandlers?.iap?.postMessage({ action: 'purchase' });
                return;
            }
            if (_restoreBtnRect && inRect(cx, cy, _restoreBtnRect)) {
                window.webkit?.messageHandlers?.iap?.postMessage({ action: 'restore' });
                return;
            }
            if (_btnMusicRect && inRect(cx, cy, _btnMusicRect)) {
                musicOn = !musicOn;
                localStorage.setItem('tunnel_music', musicOn ? '1' : '0');
                if (musicOn) _startTitleMusic(); else _fadeTitleMusic();
                return;
            }
            if (_btnFxRect && inRect(cx, cy, _btnFxRect)) {
                fxOn = !fxOn;
                localStorage.setItem('tunnel_fx', fxOn ? '1' : '0');
                return;
            }
            for (const b of _langBtnRects) {
                if (inRect(cx, cy, b)) {
                    setLang(b.code);
                    return;
                }
            }
            // Tap outside the panel closes it; a tap inside on empty space does nothing.
            if (!_settingsPanelRect || !inRect(cx, cy, _settingsPanelRect)) showSettings = false;
            return;
        }

        if (_settingsBtnRect && inRect(cx, cy, _settingsBtnRect)) {
            showSettings = true;
            return;
        }
        if (_leaderboardBtnRect && inRect(cx, cy, _leaderboardBtnRect)) {
            window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'show' });
            return;
        }
        for (let i = 0; i < _skinBtnRects.length; i++) {
            const b = _skinBtnRects[i], dx = cx - b.cx, dy = cy - b.cy;
            if (dx*dx + dy*dy < b.r*b.r && (unlockedSkins & (1 << i))) {
                activeSkin = i;
                localStorage.setItem('tunnel_skin', activeSkin);
                return;
            }
        }

        // Nothing hit: wait for a confirmed release before starting a run (see note above).
        _titleStartPending = e.pointerId;
        return;
    }
    _initAC();
    if (phase === 'title') {
        if (showSettings) { showSettings = false; return; }
        startPlay(); return;   // reached only for keyboard/synthetic triggers (no e)
    }
    if (phase === 'dead' && deadT > 0.9) {
        if (!e) {
            window.webkit?.messageHandlers?.ads?.postMessage({ action: 'interstitialRequest', score });
            startPlay(); holding = true; thrustOn(); return;
        }
        const rect = cv.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (W / rect.width);
        const cy = (e.clientY - rect.top)  * (H / rect.height);
        if (_homeBtnRect && inRect(cx, cy, _homeBtnRect)) {
            window.webkit?.messageHandlers?.ads?.postMessage({ action: 'interstitialRequest', score });
            titleScreen(); return;
        }
        if (_playBtnRect && inRect(cx, cy, _playBtnRect)) {
            window.webkit?.messageHandlers?.ads?.postMessage({ action: 'interstitialRequest', score });
            startPlay(); holding = true; thrustOn(); return;
        }
        return;
    }
    holding = true;
    if (phase === 'play') thrustOn();
}
function onUp(e) {
    holding = false; thrustOff();
    if (phase === 'title' && _titleStartPending !== null && (!e || e.pointerId === _titleStartPending)) {
        _titleStartPending = null;
        _initAC();
        startPlay();
    }
}
function onCancel(e) {
    holding = false; thrustOff();
    if (!e || e.pointerId === _titleStartPending) _titleStartPending = null;
}

window.addEventListener('pointerdown',   e => { e.preventDefault(); onDown(e); });
window.addEventListener('pointerup',     e => { e.preventDefault(); onUp(e);   });
window.addEventListener('pointercancel', onCancel);
window.addEventListener('keydown', e => {
    if (['Space','ArrowUp'].includes(e.code)) { e.preventDefault(); onDown(); }
    if (e.code === 'KeyP') {
        window._freezeDraw = !window._freezeDraw;
        if (_ac) { window._freezeDraw ? _ac.suspend() : _ac.resume(); }
    }
});
window.addEventListener('keyup', e => {
    if (['Space','ArrowUp'].includes(e.code)) { e.preventDefault(); onUp(); }
});

// ── Milestone ────────────────────────────────────────────────────────

function triggerMilestone(n) {
    milestoneFlash = 1.0;
    milestoneText  = n >= 200 ? `${n}!!!` : n >= 100 ? `${n}!!` : `${n}!`;
    for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const v = 120 + Math.random() * 220;
        parts.push({ x: W/2, y: H*0.28, vx: Math.cos(a)*v, vy: Math.sin(a)*v,
                     life: 1.1, r: 1.5+Math.random()*3, h: 40+Math.random()*25 });
    }
    sfxMilestone(n);
}
