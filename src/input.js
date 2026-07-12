// ── Input ─────────────────────────────────────────────────────────────

function inRect(cx, cy, r) { return cx >= r.x && cx <= r.x+r.w && cy >= r.y && cy <= r.y+r.h; }
function onDown(e) {
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
                }
            }
            showSettings = false;
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
    }
    _initAC();
    if (phase === 'title') {
        if (showSettings) { showSettings = false; return; }
        startPlay(); return;
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
function onUp() { holding = false; thrustOff(); }

window.addEventListener('pointerdown', e => { e.preventDefault(); onDown(e); });
window.addEventListener('pointerup',   e => { e.preventDefault(); onUp();   });
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
