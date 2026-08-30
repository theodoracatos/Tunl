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
    // Dynamic Island/notch clearance (constants.js SAFE_L/SAFE_R), pushed from
    // GameView.swift's TunlWebView.onSafeAreaChange -- on launch and again on
    // every safe-area change (rotation between LandscapeLeft/LandscapeRight
    // included), not just once, since which edge is unsafe can flip without W/H
    // changing at all.
    if (typeof state.safeInsetLeft === 'number') SAFE_L = state.safeInsetLeft;
    if (typeof state.safeInsetRight === 'number') SAFE_R = state.safeInsetRight;
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
    requestAnimationFrame(loop);
}

// GameView.swift disables WKWebView's "user action required for playback"
// policy, so audio can start immediately without waiting for the first tap.
_initAC();
titleScreen();
requestAnimationFrame(ts => { prev = ts; requestAnimationFrame(loop); });
