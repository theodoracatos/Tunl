// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── Input ─────────────────────────────────────────────────────────────

function inRect(cx, cy, r) { return cx >= r.x && cx <= r.x+r.w && cy >= r.y && cy <= r.y+r.h; }
function inCircle(cx, cy, c) { const dx = cx - c.cx, dy = cy - c.cy; return dx*dx + dy*dy < c.r*c.r; }

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

        // One-time daily-reminder opt-in card (src/notify.js). Only up on the bare
        // title screen (no panel open). A tap on either button resolves it; a tap
        // anywhere else dismisses it as "no" and falls through so the tap still
        // does its normal thing (open a menu, start a run).
        if (showNotifPrompt && window._tunlHasNotifBridge && window._tunlHasNotifBridge()
            && !showSettings && !showShop && !showMissions && !showShipPicker && !showCurrencyInfo) {
            if (_notifPromptYesRect && inRect(cx, cy, _notifPromptYesRect)) {
                sfxUiTap(); _notifPromptResolve(true); return;
            }
            if (_notifPromptNoRect && inRect(cx, cy, _notifPromptNoRect)) {
                sfxUiClose(); _notifPromptResolve(false); return;
            }
            _notifPromptResolve(false);
        }

        // Language panel intercepts all taps when open
        if (showSettings) {
            if (_privacyChoicesBtnRect && inRect(cx, cy, _privacyChoicesBtnRect)) {
                sfxUiTap();
                window.webkit?.messageHandlers?.ads?.postMessage({ action: 'privacyOptions' });
                return;
            }
            if (_notifToggleRect && inRect(cx, cy, _notifToggleRect)) {
                if (notifEnabled) { window._tunlReminderDisable(); sfxUiToggle(false); }
                else              { window._tunlReminderEnable();  sfxUiTap(); }
                return;
            }
            if (_btnMusicRect && inRect(cx, cy, _btnMusicRect)) {
                musicOn = !musicOn;
                localStorage.setItem('tunnel_music', musicOn ? '1' : '0');
                if (musicOn) _startTitleMusic(); else _fadeTitleMusic();
                sfxUiToggle(musicOn);
                return;
            }
            if (_btnFxRect && inRect(cx, cy, _btnFxRect)) {
                fxOn = !fxOn;
                localStorage.setItem('tunnel_fx', fxOn ? '1' : '0');
                sfxUiToggle(fxOn);
                return;
            }
            for (const b of _langBtnRects) {
                if (inRect(cx, cy, b)) {
                    setLang(b.code);
                    // Re-push the schedule so a live reminder switches to the new
                    // language's text (src/notify.js).
                    if (notifEnabled && window._tunlReminderReschedule) window._tunlReminderReschedule();
                    sfxUiSelect();
                    return;
                }
            }
            // Tap outside the panel closes it; a tap inside on empty space does nothing.
            if (!_settingsPanelRect || !inRect(cx, cy, _settingsPanelRect)) { showSettings = false; sfxUiClose(); }
            return;
        }
        if (showCurrencyInfo) {
            // Tap anywhere outside the panel closes it; a tap inside on the body text does
            // nothing (no buttons live inside this panel, unlike Shop/Settings).
            if (!_currencyInfoPanelRect || !inRect(cx, cy, _currencyInfoPanelRect)) { showCurrencyInfo = false; sfxUiClose(); }
            return;
        }
        if (showShop) {
            if (_removeAdsBtnRect && inRect(cx, cy, _removeAdsBtnRect)) {
                sfxUiTap();
                window.webkit?.messageHandlers?.iap?.postMessage({ action: 'purchase', product: 'remove_ads' });
                return;
            }
            if (_unlockAllShipsBtnRect && inRect(cx, cy, _unlockAllShipsBtnRect)) {
                sfxUiTap();
                window.webkit?.messageHandlers?.iap?.postMessage({ action: 'purchase', product: 'unlock_all_ships' });
                return;
            }
            if (_restoreBtnRect && inRect(cx, cy, _restoreBtnRect)) {
                sfxUiTap();
                window.webkit?.messageHandlers?.iap?.postMessage({ action: 'restore' });
                return;
            }
            // Tap outside the panel closes it; a tap inside on empty space does nothing.
            if (!_shopPanelRect || !inRect(cx, cy, _shopPanelRect)) { showShop = false; sfxUiClose(); }
            return;
        }
        // CONCEPT A: Missions drawer. The 3 mission rows complete themselves, but the
        // bonus row at the bottom is a real button (watch a rewarded ad for a
        // once-per-day shard grant, constants.js SHARDS_AD_REWARD).
        if (showMissions) {
            if (_shardsAdBtnRect && inRect(cx, cy, _shardsAdBtnRect)) {
                if (shardsAdReady && !shardsAdClaimedToday) {
                    sfxUiTap();
                    shardsAdPending = true;
                    window.webkit?.messageHandlers?.ads?.postMessage({ action: 'shardsAdRequest' });
                } else {
                    sfxUiDenied();
                }
                return;
            }
            if (!_missionsPanelRect || !inRect(cx, cy, _missionsPanelRect)) { showMissions = false; sfxUiClose(); }
            return;
        }
        // CONCEPT A: ALL SHIPS sheet. Hit-test the grid first (selecting a ship
        // keeps the sheet open, same as picking a language keeps Settings
        // open); anything else -- background, header, wallet line -- closes it.
        if (showShipPicker) {
            if (_currencyInfoBtnRect) {
                const b = _currencyInfoBtnRect, dx = cx - b.cx, dy = cy - b.cy;
                if (dx*dx + dy*dy < b.r*b.r) { showCurrencyInfo = true; sfxUiTap(); return; }
            }
            for (let i = 0; i < _skinBtnRects.length; i++) {
                const b = _skinBtnRects[i];
                if (inCircle(cx, cy, b)) {
                    if (unlockedSkins & (1 << i)) {
                        activeSkin = i;
                        localStorage.setItem('tunnel_skin', activeSkin);
                        sfxUiSelect(i);
                    } else {
                        sfxUiDenied();
                    }
                    return;
                }
            }
            showShipPicker = false;
            sfxUiClose();
            return;
        }

        if (_settingsBtnRect && inCircle(cx, cy, _settingsBtnRect)) {
            showSettings = true;
            sfxUiTap();
            return;
        }
        if (_shopBtnRect && inCircle(cx, cy, _shopBtnRect)) {
            showShop = true;
            sfxUiTap();
            return;
        }
        if (_missionsBtnRect && inCircle(cx, cy, _missionsBtnRect)) {
            showMissions = true;
            sfxUiTap();
            return;
        }
        if (_leaderboardBtnRect && inCircle(cx, cy, _leaderboardBtnRect)) {
            sfxUiTap();
            window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'show' });
            return;
        }
        if (_challengeBtnRect && inCircle(cx, cy, _challengeBtnRect)) {
            sfxUiTap();
            window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'challenge' });
            return;
        }
        if (_shipPickerBtnRect && inRect(cx, cy, _shipPickerBtnRect)) {
            showShipPicker = true;
            sfxUiTap();
            return;
        }
        if (_shipPrevBtnRect && inCircle(cx, cy, _shipPrevBtnRect)) {
            const list = [];
            for (let i = 0; i < SKINS.length; i++) if (unlockedSkins & (1 << i)) list.push(i);
            const idx = Math.max(0, list.indexOf(activeSkin));
            activeSkin = list[(idx - 1 + list.length) % list.length];
            localStorage.setItem('tunnel_skin', activeSkin);
            sfxUiSelect(activeSkin);
            return;
        }
        if (_shipNextBtnRect && inCircle(cx, cy, _shipNextBtnRect)) {
            const list = [];
            for (let i = 0; i < SKINS.length; i++) if (unlockedSkins & (1 << i)) list.push(i);
            const idx = Math.max(0, list.indexOf(activeSkin));
            activeSkin = list[(idx + 1) % list.length];
            localStorage.setItem('tunnel_skin', activeSkin);
            sfxUiSelect(activeSkin);
            return;
        }
        if (_currencyInfoBtnRect) {
            const b = _currencyInfoBtnRect, dx = cx - b.cx, dy = cy - b.cy;
            if (dx*dx + dy*dy < b.r*b.r) { showCurrencyInfo = true; sfxUiTap(); return; }
        }

        // Nothing hit: wait for a confirmed release before starting a run (see note above).
        _titleStartPending = e.pointerId;
        return;
    }
    _initAC();
    if (phase === 'title') {
        if (showSettings) { showSettings = false; return; }
        if (showShop) { showShop = false; return; }
        if (showCurrencyInfo) { showCurrencyInfo = false; return; }
        if (showMissions) { showMissions = false; return; }
        if (showShipPicker) { showShipPicker = false; return; }
        if (showNotifPrompt) _notifPromptResolve(false);   // keyboard start also dismisses it
        startPlay(); return;   // reached only for keyboard/synthetic triggers (no e)
    }
    // Continue offer: its own tap gate, independent of (and open for longer than)
    // the deadT > DEATH_INTERACTIVE_SEC one below -- see constants.js
    // CONTINUE_OFFER_SEC doc. Swallows every tap while it's up rather than falling
    // through, since _homeBtnRect etc. are still null at this point anyway
    // (drawDeathScreen hasn't run yet).
    if (phase === 'dead' && continueOfferPending && !continueAdPending && e) {
        const rect = cv.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (W / rect.width);
        const cy = (e.clientY - rect.top)  * (H / rect.height);
        if (_continueBtnRect && inCircle(cx, cy, _continueBtnRect)) {
            sfxUiTap();
            continueAdPending = true;
            window.webkit?.messageHandlers?.ads?.postMessage({ action: 'reviveRequest', score });
        }
        return;
    }
    if (phase === 'dead' && deadT > DEATH_INTERACTIVE_SEC) {
        if (!e) {
            window.webkit?.messageHandlers?.ads?.postMessage({ action: 'interstitialRequest', score });
            // No holding/hasHeldThisRun here -- every run, restart included, opens with the
            // level glide (gravity gate, update.js) so the ship never drops before the
            // player's first real press. See HOLD_GATE_MAX_SEC.
            startPlay(); return;
        }
        const rect = cv.getBoundingClientRect();
        const cx = (e.clientX - rect.left) * (W / rect.width);
        const cy = (e.clientY - rect.top)  * (H / rect.height);
        if (_homeBtnRect && inRect(cx, cy, _homeBtnRect)) {
            sfxUiTap();
            window.webkit?.messageHandlers?.ads?.postMessage({ action: 'interstitialRequest', score });
            titleScreen(); return;
        }
        // Share does NOT start a new run or request an interstitial -- it hands the
        // card to the OS share sheet and leaves the death screen up, so the player
        // comes back to the same screen afterwards and can still hit PLAY AGAIN.
        if (_shareBtnRect && inRect(cx, cy, _shareBtnRect)) {
            sfxUiTap();
            shareRun();
            window.webkit?.messageHandlers?.haptic?.postMessage('light');
            return;
        }
        if (_playBtnRect && inRect(cx, cy, _playBtnRect)) {
            window.webkit?.messageHandlers?.ads?.postMessage({ action: 'interstitialRequest', score });
            // See the note above -- restart opens with the level glide too, not mid-thrust.
            startPlay(); return;
        }
        return;
    }
    holding = true;
    if (phase === 'play') { hasHeldThisRun = true; thrustOn(); }
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
    // Widened milestoneStep() (world.js) already thins these out for strong players;
    // this adds a 4th tier so a truly deep milestone still reads as a step up rather
    // than the same maxed-out "!!!" every time from 200 all the way to the top.
    milestoneText  = n >= 1000 ? `${n}!!!!` : n >= 200 ? `${n}!!!` : n >= 100 ? `${n}!!` : `${n}!`;
    for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const v = 120 + Math.random() * 220;
        parts.push({ x: W/2, y: H*0.28, vx: Math.cos(a)*v, vy: Math.sin(a)*v,
                     life: 1.1, r: 1.5+Math.random()*3, h: 40+Math.random()*25 });
    }
    sfxMilestone(n);
}
