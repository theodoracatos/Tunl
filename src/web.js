// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── Web build: host detection + deep-link params ─────────────────────
// The same tunl.html + src/ runs in three places: the iOS WKWebView wrapper,
// the Android WebView wrapper, and the open web (flytunl.ch/play, assembled by
// flytunl-site/build-play.mjs). Both app wrappers expose
// window.webkit.messageHandlers.haptic - iOS natively, Android through a shim
// (MainActivity.kt nativeShimJs). A plain browser has neither, and that is the
// only thing that reliably tells the three apart at runtime.
//
// This file is loaded first (see tunl.html) so isWeb() and the webParam* globals
// are defined before any other script runs.

// isWeb() is a function, not a captured constant: on older Android WebViews the
// native shim is injected at onPageFinished rather than document-start, so the
// bridge can appear a beat after this file parses. Once the bridge has ever been
// seen we latch to native permanently. Worst case is isWeb() briefly returning
// true on a slow old-WebView cold start - before which nothing web-only (the
// install CTA, the portrait gate) is on screen yet.
let _tunlSawBridge = false;

function _tunlBridgePresent() {
    return !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.haptic)
        || typeof window.TunlNative !== 'undefined';
}

function isWeb() {
    if (_tunlSawBridge) return false;
    if (_tunlBridgePresent()) { _tunlSawBridge = true; return false; }
    return true;
}

// The calendar day whose cave, world name and rock palette we render. Normally
// today (UTC). The ?d= deep link (webParamDay, YYYYMMDD - parsed below) can point
// it at a past day so a shared link still flies the same cave after the UTC
// rollover. Used by world.js (seed / WORLD_NAME / LEVEL_NUM), draw.js and
// share.js (weekdayIndex -> palette + planet). Streak, stardust and the daily
// reset in lifecycle.js deliberately do NOT go through here - those track the
// real date played.
function _tunlActiveDate() {
    if (typeof webParamDay !== 'undefined' && webParamDay) {
        const y = Math.floor(webParamDay / 10000);
        const m = Math.floor(webParamDay / 100) % 100;
        const d = webParamDay % 100;
        return new Date(Date.UTC(y, m - 1, d));
    }
    return new Date();
}
function _tunlActiveDayInt() {
    const d = _tunlActiveDate();
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

// ── Deep-link params ────────────────────────────────────────────────
// Parsed once at load; read later by lifecycle.js (seed) and share.js (link).
//   ?d=YYYYMMDD  replay that day's cave instead of today's. Any past day back to
//                2025-01-01 is allowed so a shared link does not die at the UTC
//                boundary; future dates are rejected.
//   ?g=<base64>  a friend's ghost track to race (decoded via constants.js
//                ghostDecode at use site).
//   ?s=<int>     the score that ghost reached, for the "GHOST -N" readout.
let webParamDay = 0;         // int YYYYMMDD, or 0 meaning "today"
let webParamGhost = null;    // raw base64 string, or null
let webParamGhostScore = 0;  // int, or 0 if absent

(function _tunlParseWebParams() {
    if (typeof URLSearchParams === 'undefined' || typeof location === 'undefined') return;
    let q;
    try { q = new URLSearchParams(location.search); } catch (e) { return; }

    const d = q.get('d');
    if (d && /^\d{8}$/.test(d)) {
        const y = +d.slice(0, 4), m = +d.slice(4, 6), day = +d.slice(6, 8);
        const asInt = y * 10000 + m * 100 + day;
        const now = new Date();
        const todayInt = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
        if (m >= 1 && m <= 12 && day >= 1 && day <= 31 && asInt >= 20250101 && asInt <= todayInt) {
            webParamDay = asInt;
        }
    }

    const g = q.get('g');
    if (g && /^[A-Za-z0-9+/=_-]{4,8192}$/.test(g)) webParamGhost = g;

    const s = q.get('s');
    if (s && /^\d{1,7}$/.test(s)) webParamGhostScore = +s;
})();

// ── Web daily leaderboard ───────────────────────────────────────────
// Gives the open web build the same live daily world-rank the app gets from
// Game Center / Play Games. Backed by the Cloudflare Worker in
// flytunl-site/worker/ - set its URL here after deploying it (see that README),
// or leave empty and nothing below does anything (localStorage-only, as before).
const WEB_LEADERBOARD_API = 'https://tunl-scores.theodoracatos.workers.dev';

let _webRunStartMs = 0;   // set in lifecycle.js startPlay(), read at death
let _webLbTok = null, _webLbTokTs = 0, _webRankFetchTs = 0;

function _webLbOn() {
    return WEB_LEADERBOARD_API && typeof isWeb === 'function' && isWeb() && typeof fetch === 'function';
}

function webPlayerId() {
    try {
        let v = localStorage.getItem('tunnel_web_id');
        if (!v) {
            v = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : String(Math.random()).slice(2) + '-' + Date.now();
            localStorage.setItem('tunnel_web_id', v);
        }
        return v;
    } catch (e) { return 'anon-' + Date.now(); }
}

function _webLbToken() {
    if (_webLbTok && Date.now() - _webLbTokTs < 600000) return Promise.resolve(_webLbTok);
    return fetch(WEB_LEADERBOARD_API + '/t')
        .then(r => r.json())
        .then(j => { _webLbTok = j && j.t || null; _webLbTokTs = Date.now(); return _webLbTok; })
        .catch(() => null);
}

// Feed a leaderboard response into the same state the native world-rank path
// uses (main.js _tunlNativeUpdate) - the death-screen rank column and the
// climbed/dropped delta then work on web unchanged.
function _webApplyRank(j) {
    if (j && typeof j.rank === 'number' && j.rank > 0 && typeof window._tunlNativeUpdate === 'function') {
        window._tunlNativeUpdate({ worldRank: j.rank, worldRankTotal: j.total | 0 });
    }
}

function webFetchRank() {
    if (!_webLbOn() || Date.now() - _webRankFetchTs < 20000) return;
    _webRankFetchTs = Date.now();
    fetch(WEB_LEADERBOARD_API + '/r?d=' + _tunlActiveDayInt() + '&id=' + encodeURIComponent(webPlayerId()))
        .then(r => r.json()).then(_webApplyRank).catch(() => {});
}

function webSubmitScore(score, playSec) {
    if (!_webLbOn() || !(score > 0)) return;
    // Only today's real cave counts - a ?d= replay of a past day is not recorded,
    // same as the app, which only ever submits the current day.
    const now = new Date();
    const todayInt = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
    if (_tunlActiveDayInt() !== todayInt) return;
    _webLbToken().then(tok => {
        if (!tok) return;
        return fetch(WEB_LEADERBOARD_API + '/s', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                d: todayInt, s: score | 0, p: Math.round(playSec || 0),
                id: webPlayerId(), tok,
            }),
        }).then(r => r.json()).then(_webApplyRank);
    }).catch(() => {});
}
