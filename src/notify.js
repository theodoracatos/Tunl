// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── Daily reminder (local notification) ───────────────────────────────
// TUNL has no backend, so the reminder is a *local* notification scheduled
// entirely on-device by the native layer (Tunl/Tunl/NotificationManager.swift,
// Tunl.Android/.../ReminderScheduler.kt). This file is only the bridge: it hands
// native the localized text variants + a "played today" flag and lets native own
// the 19:00-local scheduling. In a browser (no bridge) every call here no-ops.
//
// Opt-in paths: the one-time title-screen card (draw.js / input.js, shown on the
// first app-open of any day after day one - see state.js showNotifPrompt) and the
// Settings-panel toggle. Both funnel through _tunlReminderEnable / *Disable.

function _notifBridge() {
    return window.webkit
        && window.webkit.messageHandlers
        && window.webkit.messageHandlers.notifications;
}

// draw.js gates the card and the settings row on this, same as the privacy row
// keys off messageHandlers.ads.
window._tunlHasNotifBridge = function () { return !!_notifBridge(); };

// Push the current schedule to native: the 3 localized title/body variants (native
// rotates them by day) and whether the player has already flown today's cave, so
// tonight's nudge is skipped if they have. Called on enable, on every app resume
// (main.js), and after a language switch (input.js).
window._tunlReminderReschedule = function () {
    const b = _notifBridge();
    if (!b) return;
    b.postMessage({
        action: 'reschedule',
        enabled: notifEnabled,
        playedToday: dailyRuns > 0,
        titles: T.notifTitles,
        bodies: T.notifBodies,
    });
};

// Ask the OS for notification permission. Native shows its dialog and reports
// back via _tunlNotifPermission once the user answers (or immediately, if the
// choice was already made).
window._tunlReminderEnable = function () {
    const b = _notifBridge();
    if (b) b.postMessage({ action: 'requestPermission' });
};

window._tunlReminderDisable = function () {
    notifEnabled = false;
    localStorage.setItem('tunl_notif_enabled', '0');
    const b = _notifBridge();
    if (b) b.postMessage({ action: 'reschedule', enabled: false });
};

// Native -> JS: the OS permission dialog resolved. granted=false also covers the
// case where the user previously denied at the OS level and can't be re-prompted.
window._tunlNotifPermission = function (granted) {
    const was = notifEnabled;
    notifEnabled = !!granted;
    localStorage.setItem('tunl_notif_enabled', notifEnabled ? '1' : '0');
    if (notifEnabled) {
        window._tunlReminderReschedule();
        if (!was && typeof sfxUiToggle === 'function') sfxUiToggle(true);
    } else if (typeof sfxUiDenied === 'function') {
        sfxUiDenied();
    }
};

// Resolve the one-time title-screen opt-in card. accept=true kicks off the OS
// permission request; either way the card never shows again.
function _notifPromptResolve(accept) {
    showNotifPrompt = false;
    notifPromptDone = true;
    localStorage.setItem('tunl_notif_prompt_done', '1');
    if (accept) window._tunlReminderEnable();
}

// Refresh the schedule whenever the app comes back to the foreground, so
// "played today" and the current language stay accurate and an active user keeps
// getting bumped past tonight's nudge. WKWebView doesn't fire visibilitychange
// reliably when the host app (not the page) backgrounds, so GameView.swift also
// calls _tunlReminderReschedule on didBecomeActive; Android's WebView.onResume
// does fire it.
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && notifEnabled) window._tunlReminderReschedule();
});

// Refresh once on cold launch (a previous session may have left it enabled). The
// native handler is already registered by the time this runs; the short defer
// just lets Android's shim finish injecting on older WebViews.
setTimeout(() => { if (notifEnabled) window._tunlReminderReschedule(); }, 800);
