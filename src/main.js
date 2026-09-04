// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
document.addEventListener('contextmenu', e => e.preventDefault());

// Native wrappers call this after purchase/restore/launch entitlement checks
// (see GameView.swift's IAPManager) so JS state stays in sync with StoreKit.
window._tunlNativeUpdate = function (state) {
    if (typeof state.removeAdsOwned === 'boolean') {
        // Fires the purchase-success chime only on the false->true transition, never on
        // the entitlement-sync call every launch makes for a player who already owns it.
        if (state.removeAdsOwned && !removeAdsOwned) sfxUiPurchaseSuccess();
        removeAdsOwned = state.removeAdsOwned;
        localStorage.setItem('tunnel_remove_ads', removeAdsOwned ? '1' : '0');
    }
    // Unlock All Ships IAP (state.js's allShipsOwned doc comment). Force-unlocking every
    // current SKINS bit here, not just remembering the flag, means a purchase takes
    // effect immediately without waiting for the next die()/unlock-loop pass or a reload.
    if (typeof state.allShipsOwned === 'boolean') {
        if (state.allShipsOwned && !allShipsOwned) sfxUiPurchaseSuccess();
        allShipsOwned = state.allShipsOwned;
        localStorage.setItem('tunnel_all_ships', allShipsOwned ? '1' : '0');
        if (allShipsOwned) {
            unlockedSkins = (1 << SKINS.length) - 1;
            localStorage.setItem('tunnel_skins', unlockedSkins);
        }
    }
    // Pushed once per launch after AdsManager's consent-info update resolves
    // (see AdsManager.kt/.swift) - not persisted, see state.js's declaration.
    if (typeof state.privacyOptionsRequired === 'boolean') {
        privacyOptionsRequired = state.privacyOptionsRequired;
    }
    // World rank on today's board, pushed after each score submit resolves. The delta
    // is computed here rather than natively because only the page knows what rank it
    // last displayed - the native side just reports the current number. Positive means
    // the player climbed, since a smaller rank is better.
    if (typeof state.worldRank === 'number' && state.worldRank > 0) {
        if (worldRank !== null) worldRankDelta = worldRank - state.worldRank;
        worldRank = state.worldRank;
    }
    if (typeof state.worldRankTotal === 'number' && state.worldRankTotal > 0) {
        worldRankTotal = state.worldRankTotal;
    }
    // Outstanding Game Center Challenges for this player, pushed from
    // GameView.swift (fetchActiveChallenges) at auth, after each score submit, and
    // when one arrives or is completed live. Drives the CHALLENGE icon badge on the
    // title screen. iOS 26+ only -- Android never sends this key.
    if (typeof state.activeChallenges === 'number') {
        activeChallenges = state.activeChallenges;
    }
    // Dynamic Island/notch clearance (constants.js SAFE_L/SAFE_R), pushed from
    // GameView.swift's TunlWebView.onSafeAreaChange -- on launch and again on
    // every safe-area change (rotation between LandscapeLeft/LandscapeRight
    // included), not just once, since which edge is unsafe can flip without W/H
    // changing at all.
    if (typeof state.safeInsetLeft === 'number') SAFE_L = state.safeInsetLeft;
    if (typeof state.safeInsetRight === 'number') SAFE_R = state.safeInsetRight;
    // Rewarded-ad load state (see AdsManager.swift/.kt's rewarded manager), pushed
    // whenever it changes -- load success, consumption, a failed reload. Gates the
    // continue offer (update.js die()) so it's never shown with nothing behind it.
    if (typeof state.rewardedAdReady === 'boolean') {
        rewardedAdReady = state.rewardedAdReady;
    }
    // Same, for the separate "Shards Rewarded" unit behind the Missions-drawer bonus row
    // (constants.js SHARDS_AD_REWARD). Gates that row's tappable state in draw.js/input.js.
    if (typeof state.shardsAdReady === 'boolean') {
        shardsAdReady = state.shardsAdReady;
    }
};

// Shards rewarded-ad result (see AdsManager.swift/.kt's shards-rewarded manager + the
// "ads" handler's {action:'shardsAdRequest'} wiring). Only meaningful while
// state.js's shardsAdPending is true.
window._tunlShardsRewardGranted = function () {
    if (!shardsAdPending) return;
    shardsAdPending = false;
    if (shardsAdClaimedToday) return;   // belt-and-braces against a double fire
    shards += SHARDS_AD_REWARD;
    shardsAdClaimedToday = true;
    localStorage.setItem('tunnel_shards', shards);
    localStorage.setItem('tunnel_shards_ad_claimed', '1');
    sfxMissionDone();   // already the "you earned shards" chime
};
window._tunlShardsRewardDeclined = function () {
    shardsAdPending = false;
};

// Rewarded continue result (see AdsManager.swift/.kt requestRevive + the "ads"
// message-handler wiring in GameView.swift/MainActivity.kt). Only meaningful while
// state.js's continueAdPending is true; both functions are no-ops otherwise (already
// resolved by a timeout, or a stray second callback).
window._tunlReviveGranted = function () {
    grantRevive();
};
window._tunlReviveDeclined = function () {
    declineRevive();
};

// Android's system/gesture back button has no iOS equivalent, so there's no
// shared bridge call for it. MainActivity calls this directly: closes the
// settings panel and reports true if one was open, so back dismisses the
// panel first instead of always exiting the app.
window._tunlCloseSettingsIfOpen = function () {
    if (showSettings) { showSettings = false; return true; }
    if (showShop) { showShop = false; return true; }
    if (showCurrencyInfo) { showCurrencyInfo = false; return true; }
    if (showMissions) { showMissions = false; return true; }
    if (showShipPicker) { showShipPicker = false; return true; }
    return false;
};

// ── Loop ──────────────────────────────────────────────────────────────

window._freezeDraw = false;
function loop(ts) {
    const dt = Math.min((ts - prev) / 1000, 0.05);
    prev = ts;
    if (!window._freezeDraw) { update(dt); draw(); }
    _syncWebCta();
    requestAnimationFrame(loop);
}

// ── Install CTA (web only) ───────────────────────────────────────────
// A small "Get the app" pill (#cta in tunl.html) on the title screen only,
// linking to the two store listings. Native app builds (isWeb() false) never
// show it. Driven from the loop; cheap - it only touches the DOM on a change,
// and the label follows an in-game language switch.
const _ctaEl  = document.getElementById('cta');
const _ctaLbl = document.getElementById('cta-lbl');
let _ctaShown = false, _ctaLangShown = null;
function _syncWebCta() {
    if (!_ctaEl) return;
    const show = isWeb() && phase === 'title' && !_portraitCovered;
    if (show && _ctaLbl && typeof T !== 'undefined' && T.getApp && _ctaLangShown !== T.getApp) {
        _ctaLbl.textContent = T.getApp;
        _ctaLangShown = T.getApp;
    }
    if (show === _ctaShown) return;
    _ctaShown = show;
    _ctaEl.classList.toggle('show', show);
    _ctaEl.setAttribute('aria-hidden', show ? 'false' : 'true');
}

// ── Portrait gate (web only) ─────────────────────────────────────────
// The game is landscape-only. The iOS (Info.plist) and Android (manifest)
// wrappers lock orientation, so this only ever fires on the open web build
// (flytunl.ch/play). While the viewport is portrait the loop is frozen and
// audio suspended, and #rot (tunl.html) covers the canvas so the player can't
// start a run they can't see.
const _rotEl = document.getElementById('rot');
let _portraitCovered = false;
function _updatePortraitGate() {
    const portrait = isWeb() && window.innerHeight > window.innerWidth;
    if (portrait === _portraitCovered) return;
    _portraitCovered = portrait;
    if (_rotEl) {
        _rotEl.classList.toggle('show', portrait);
        _rotEl.setAttribute('aria-hidden', portrait ? 'false' : 'true');
        const m = document.getElementById('rot-msg');
        if (m && typeof T !== 'undefined' && T.rotateHint) m.textContent = T.rotateHint;
    }
    window._freezeDraw = portrait;
    if (portrait) {
        if (typeof _pauseAudioForAd === 'function') _pauseAudioForAd();
    } else if (typeof _resumeAudioAfterAd === 'function') {
        _resumeAudioAfterAd();
    }
}
window.addEventListener('resize', _updatePortraitGate);
window.addEventListener('orientationchange', _updatePortraitGate);

// GameView.swift disables WKWebView's "user action required for playback"
// policy, so audio can start immediately without waiting for the first tap.
_initAC();
titleScreen();
_updatePortraitGate();
requestAnimationFrame(ts => { prev = ts; requestAnimationFrame(loop); });
