document.addEventListener('contextmenu', e => e.preventDefault());

// Native wrappers call this after purchase/restore/launch entitlement checks
// (see GameView.swift's IAPManager) so JS state stays in sync with StoreKit.
window._tunlNativeUpdate = function (state) {
    if (typeof state.removeAdsOwned === 'boolean') {
        removeAdsOwned = state.removeAdsOwned;
        localStorage.setItem('tunnel_remove_ads', removeAdsOwned ? '1' : '0');
    }
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
