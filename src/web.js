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

// isAndroidApp() - unlike isWeb() this needs no latch: MainActivity.kt registers
// TunlNative via addJavascriptInterface() before webView.loadUrl() runs, which
// (per Android's WebView API) makes it available in window synchronously before
// any page <script> executes - it does not depend on document-start support the
// way the window.webkit.messageHandlers shim does (see _tunlBridgePresent above),
// so this is safe to read once, synchronously, at constants.js's top-level H
// calculation.
function isAndroidApp() {
    return typeof window.TunlNative !== 'undefined';
}

// Opens a store listing from one of the canvas store buttons (web only; the apps never
// draw them). window.open(url, '_blank') keeps the game in its tab, but it can do
// nothing and return null: a popup blocker (the buttons fire on pointerdown, which a
// touch does not count as a user gesture - measured: WebKit/iPhone ignored the tap), or
// an in-app browser whose host has no new-window delegate. Then the page itself goes to
// the store. No 'noopener' feature: with it window.open returns null even when it
// worked. flytunl-site/tt/tt-tail.js overrides window.open for the two store URLs (its
// own counted hand-off) and returns a stub, so nothing navigates twice there.
//
// A Play link from a challenge or referral link carries it into the install as Play's
// install referrer (challenge spec phase 3): MainActivity.kt reads it on the app's first
// start and opens the same challenge, and the referral still credits its sender. The App
// Store has no such channel; the web pitch tells iPhones to tap the link again instead.
function openStoreLink(url) {
    if (url === PLAY_STORE_URL) url = playStoreUrlWithReferrer(url);
    let w = null;
    try { w = window.open(url, '_blank'); } catch (e) {}
    if (w) { try { w.opener = null; } catch (e) {} return; }
    location.href = url;
}

// The keys MainActivity.kt accepts from an install referrer, filled from this page's own
// link: c, d (YYYYMMDD), s and r (the plain UUID). Nothing is added for a page opened
// without a challenge or referral, so a plain install keeps the bare listing URL.
function playStoreUrlWithReferrer(url) {
    const q = [];
    if (webParamChallenge) q.push('c=' + webParamChallenge);
    if (webParamDay) q.push('d=' + webParamDay);
    if (webParamGhostScore > 0) q.push('s=' + webParamGhostScore);
    if (webParamReferrer) q.push('r=' + encodeURIComponent(webParamReferrer));
    if (!webParamChallenge && !webParamReferrer) return url;
    return url + '&referrer=' + encodeURIComponent(q.join('&'));
}

// Which store this browser's device installs from: 'android', 'ios', or '' when it
// can't tell (a desktop, a Huawei on HarmonyOS NEXT, ...), which keeps both store
// buttons. The app card and the "in the app" sheet then offer that one store as a single
// filled button: tt_2709 had 8 App Store taps, 0 Google Play taps and 0 iOS installs
// from ~90%-Android Indonesia, so a second button was at best noise. Same rules as
// flytunl-site/tt/tt-head.js TT.os, which sets window._tunlStoreOnly first on /tt/:
//  - Android: every Android UA says "Android" (in-app webviews included); client hints
//    back up a UA a host has rewritten.
//  - iOS: iPhone / iPod / iPad, plus iPadOS in its default desktop mode, which sends a
//    Mac UA: a Mac has no touch points, an iPad reports 5.
function webStoreOnly() {
    if (window._tunlStoreOnly) return window._tunlStoreOnly;
    const ua = navigator.userAgent || '';
    const uaData = navigator.userAgentData;
    if (/Android/i.test(ua) || (uaData && /android/i.test(uaData.platform || ''))) return 'android';
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1)) return 'ios';
    return '';
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
// Parsed once at load; read later by lifecycle.js (seed), share.js (link) and
// update.js (referral submit, see the "Referral reward" section below).
//   ?d=<base36>  days since WEB_DAY_EPOCH, replaying that day's cave instead of
//                today's - share.js shareRunUrl() writes this form (2026-09-21,
//                a handful of chars instead of 8 digits). A bare 8-digit
//                YYYYMMDD is still accepted, so links shared before this date
//                keep working; never remove that branch. Any past day back to
//                2025-01-01 is allowed so a shared link does not die at the UTC
//                boundary; future dates are rejected.
//   ?g=<base64>  a friend's ghost track to race (decoded via constants.js
//                ghostDecode at use site).
//   ?s=<int>     the score that ghost reached, for the "GHOST -N" readout.
//   ?c=<id>      a challenge (2026-10-08): 10 chars base62 naming the worker row
//                that holds the sender's ghost (see "Challenge link" below). ?d
//                and ?s still act at once without it; the ghost arrives a beat
//                later. Anything but exactly 10 base62 chars is ignored.
//   ?r=<id>      whoever shared this link, credits them a referral reward once
//                this player clears their own first real run. share.js
//                shareRunUrl() writes webPlayerId()'s UUID base64url-packed
//                (_uuidPack, 22 chars instead of 36); a bare UUID (dashes, from
//                a link shared before this date) is still accepted and passed
//                to the worker as-is - never remove that branch. Native app
//                builds receive this the same way they receive a Universal/App
//                Link at all: GameView.swift/MainActivity.kt reload the page
//                with the link's query string appended (see
//                DeepLinkRouter.swift / MainActivity.kt's deepLinkQuery), so
//                this parses identically on every platform - no separate
//                native-only path needed.
let webParamDay = 0;         // int YYYYMMDD, or 0 meaning "today"
let webParamGhost = null;    // raw base64 string, or null
let webParamGhostScore = 0;  // int, or 0 if absent
let webParamReferrer = null; // full UUID string (unpacked if arrived packed), or null
let webParamChallenge = null; // 10-char challenge id, or null

// Epoch for the compact ?d= day-offset encoding. Never move this once links using
// it are live - it would silently repoint every already-shared short link at the
// wrong cave. 2025-01-01 matches the ?d range floor above.
const WEB_DAY_EPOCH_MS = Date.UTC(2025, 0, 1);

function _dayIntToOffset(asInt) {
    const y = Math.floor(asInt / 10000), m = Math.floor(asInt / 100) % 100, d = asInt % 100;
    return Math.round((Date.UTC(y, m - 1, d) - WEB_DAY_EPOCH_MS) / 86400000);
}
function _dayOffsetToInt(off) {
    const dt = new Date(WEB_DAY_EPOCH_MS + off * 86400000);
    return dt.getUTCFullYear() * 10000 + (dt.getUTCMonth() + 1) * 100 + dt.getUTCDate();
}

// Packs a UUID's 128 bits into 22-character URL-safe base64 (no dashes, no padding)
// and back. Round-trips through the same hex string; only used for the ?r= link
// param, never for the id kept in localStorage or sent to the leaderboard worker,
// which both stay the plain UUID.
function _uuidPack(uuid) {
    const hex = uuid.replace(/-/g, '');
    if (!/^[0-9a-f]{32}$/i.test(hex)) return uuid;
    let bin = '';
    for (let i = 0; i < 32; i += 2) bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function _uuidUnpack(packed) {
    try {
        const bin = atob(packed.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - packed.length % 4) % 4));
        if (bin.length !== 16) return null;
        let hex = '';
        for (let i = 0; i < 16; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, '0');
        return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    } catch (e) { return null; }
}

(function _tunlParseWebParams() {
    if (typeof URLSearchParams === 'undefined' || typeof location === 'undefined') return;
    let q;
    try { q = new URLSearchParams(location.search); } catch (e) { return; }

    const now = new Date();
    const todayInt = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();

    const d = q.get('d');
    if (d && /^\d{8}$/.test(d)) {
        const y = +d.slice(0, 4), m = +d.slice(4, 6), day = +d.slice(6, 8);
        const asInt = y * 10000 + m * 100 + day;
        if (m >= 1 && m <= 12 && day >= 1 && day <= 31 && asInt >= 20250101 && asInt <= todayInt) {
            webParamDay = asInt;
        }
    } else if (d && /^[0-9a-z]{1,6}$/i.test(d)) {
        const off = parseInt(d, 36);
        if (off >= 0) {
            const asInt = _dayOffsetToInt(off);
            if (asInt >= 20250101 && asInt <= todayInt) webParamDay = asInt;
        }
    }

    const g = q.get('g');
    if (g && /^[A-Za-z0-9+/=_-]{4,8192}$/.test(g)) webParamGhost = g;

    const s = q.get('s');
    if (s && /^\d{1,7}$/.test(s)) webParamGhostScore = +s;

    const r = q.get('r');
    if (r && /^[a-z0-9-]{4,64}$/i.test(r)) {
        webParamReferrer = /^[0-9a-f-]{36}$/i.test(r) ? r : (_uuidUnpack(r) || r);
    }

    const c = q.get('c');
    if (c && /^[0-9A-Za-z]{10}$/.test(c)) webParamChallenge = c;
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

// A token the worker will accept: it refuses one younger than TOKEN_MIN_AGE_MS (8 s,
// "a real run cannot be shorter"), so a token fetched at the moment of death was
// refused on a session's first submit. lifecycle.js startPlay() prefetches one
// (webPrefetchToken) so it has aged by the death; a run shorter than that waits out
// the rest here. The age is measured on this clock from when the fetch returned,
// which is never earlier than the worker's own issue time.
const WEB_TOKEN_MIN_AGE_MS = 8500;
function _webLbTokenAged() {
    return _webLbToken().then(tok => {
        if (!tok) return null;
        const wait = WEB_TOKEN_MIN_AGE_MS - (Date.now() - _webLbTokTs);
        return wait > 0 ? new Promise(res => setTimeout(() => res(tok), wait)) : tok;
    });
}
function webPrefetchToken() {
    if (_referralOn()) _webLbToken();
}

// Feed a leaderboard response into the same state the native world-rank path
// uses (main.js _tunlNativeUpdate) - the death-screen rank column and the
// climbed/dropped delta then work on web unchanged.
function _webApplyRank(j) {
    if (j && typeof j.rank === 'number' && j.rank > 0 && typeof window._tunlNativeUpdate === 'function') {
        window._tunlNativeUpdate({ worldRank: j.rank, worldRankTotal: j.total | 0 });
    }
    // Anonymous rival scores for today (worker's rankFor doc) -- independent of the
    // rank check above, since the sample exists even before this browser's own first
    // submit resolves. Web has no name to attach (see state.js rivalDeaths doc), so
    // name is always '' here; draw.js's named rival rows never show on web as a
    // result, only share.js's unlabeled dots do.
    if (j && Array.isArray(j.rivals) && typeof window._tunlNativeUpdate === 'function') {
        window._tunlNativeUpdate({
            rivalDeaths: j.rivals.filter(s => typeof s === 'number' && s > 0).map(s => ({ score: s, name: '' }))
        });
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
    _webLbTokenAged().then(tok => {
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

// ── Referral reward ──────────────────────────────────────────────────
// The two-sided half of the share loop: share.js's shareRunUrl() already gets
// a friend playing (the daily-seed hook), this is what rewards the sharer for
// it. Unlike the leaderboard functions above, deliberately NOT gated on
// isWeb() - a referral can be sent or received by any of the three build
// targets, since share.js appends ?r= to the link it hands off regardless of
// platform, and web.js's own deep-link parsing above reads ?r= the same way
// everywhere. The worker's ALLOWED_ORIGINS (flytunl-site/worker/src/index.js)
// accepts requests from the native WebView origins as well as the open web
// for exactly this reason, and since 2026-10-08 also answers each with its own
// origin (withCors there) - before that the WebViews dropped every reply.
function _referralOn() {
    return !!WEB_LEADERBOARD_API && typeof fetch === 'function';
}

// Called once from update.js commitDeath(), only on this player's own first
// real run (see the hadPriorBest gate there) - credits whoever's ?r= link
// they arrived on. Fire-and-forget: a referral is a bonus, not something
// worth ever blocking or retrying the death flow over, and win-or-lose it
// only ever gets one shot (hadPriorBest flips permanently once this player
// has any nonzero best), matching the ghost-save's "nice to have" handling
// elsewhere in this file.
function submitReferral(score) {
    if (!_referralOn() || !webParamReferrer) return;
    const me = webPlayerId();
    if (webParamReferrer === me) return; // can't refer yourself
    fetch(WEB_LEADERBOARD_API + '/referral', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ referrer: webParamReferrer, referred: me, score: score | 0 }),
    }).catch(() => {});
}

// Called once at boot (main.js) for every player, referrer or not - the only
// way to find out whether someone you invited has since played is to ask.
// Credits shards for however many referrals have landed since the last check
// (almost always 0 or 1, but not assumed to be - nothing stops a player who
// shares often from having several land between sessions) and plays the same
// chime the rewarded-ad shard bonus uses (main.js _tunlShardsRewardGranted) -
// that's the established shape for "a shard grant that didn't come from
// commitDeath()" in this codebase, audio-only, no separate banner.
function checkReferralReward() {
    if (!_referralOn()) return;
    fetch(WEB_LEADERBOARD_API + '/referral/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: webPlayerId() }),
    }).then(r => r.json()).then(j => {
        const n = j && j.claimed | 0;
        if (n <= 0) return;
        shards += n * REFERRAL_REWARD;
        localStorage.setItem('tunnel_shards', shards);
        sfxMissionDone();
    }).catch(() => {});
}

// ── Challenge link ───────────────────────────────────────────────────
// The share loop's other half (2026-10-08, challenge spec phase 2). A share names a
// challenge (?c=, share.js shareRunUrl) whose worker row (POST /c) holds the sender's
// score and ghost; the recipient's game fetches it (GET /c/<id>), races that ghost,
// sees BEATEN +n / n SHORT on the death screen, reports the run (POST /c/<id>/run) and
// can answer with a REMATCH, a new challenge whose parent is this one. The sender
// learns about it at their next boot (POST /c/inbox, title card).
//
// Not isWeb()-gated, like the referral above: a challenge is sent and received on all
// three targets, and the link parses the same everywhere. Every call is best-effort:
// with the worker down a recipient gets ?d + ?s exactly as before, never an error.
function _challengeOn() {
    return !!WEB_LEADERBOARD_API && typeof fetch === 'function';
}

// 10 chars of base62 from crypto.getRandomValues. Bytes from 248 up are thrown away
// (248 = 4 * 62), so every character is equally likely: 62^10 ids, a collision is
// the worker's 409 and simply means that share goes without a ghost.
const CHALLENGE_ID_LEN = 10;
const _B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
function newChallengeId() {
    let id = '';
    const buf = new Uint8Array(16);
    while (id.length < CHALLENGE_ID_LEN) {
        try { crypto.getRandomValues(buf); }
        catch (e) { for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256); }
        for (let i = 0; i < buf.length && id.length < CHALLENGE_ID_LEN; i++) {
            if (buf[i] < 248) id += _B62[buf[i] % 62];
        }
    }
    return id;
}

// Which build sent a challenge, for the worker's stats.
function _challengeSrc() {
    return isWeb() ? 'web' : (isAndroidApp() ? 'android' : 'ios');
}

// ── Sender ──
// One id per run (share.js shareRunUrl reads it): SHARE then CARD send the same
// challenge. Reset by lifecycle.js startPlay().
let runChallengeId = null;
// Unsent POST /c bodies (offline, 5xx), retried at the next boot: at most
// CHALLENGE_OUTBOX_MAX, none older than CHALLENGE_OUTBOX_MS. Every body is queued
// BEFORE it is sent and dropped once the worker answered, so a page closed straight
// after the share sheet still delivers the challenge on the next launch.
const CHALLENGE_OUTBOX_MAX = 5;
const CHALLENGE_OUTBOX_MS = 86400000;
// The worker keeps at most this many base64 characters of ghost (GHOST_MAX_SAMPLES
// bytes, constants.js, is 5336 in base64); a longer one goes without a ghost.
const CHALLENGE_GHOST_MAX_B64 = 5400;

function _challengeOutbox() {
    try {
        const v = JSON.parse(localStorage.getItem('tunnel_challenge_outbox') || '[]');
        return Array.isArray(v) ? v.filter(b => b && b.id && Date.now() - (b.at || 0) < CHALLENGE_OUTBOX_MS) : [];
    } catch (e) { return []; }
}
function _challengeOutboxSave(list) {
    try { localStorage.setItem('tunnel_challenge_outbox', JSON.stringify(list.slice(-CHALLENGE_OUTBOX_MAX))); } catch (e) {}
}
function _challengeOutboxDrop(id) {
    _challengeOutboxSave(_challengeOutbox().filter(b => b.id !== id));
}

// Sends one queued challenge. A fresh token each time (the queued one would be stale);
// 2xx and 4xx both end it (a 409 is a taken id, a 4xx will not get better by retrying),
// only a network error or 5xx keeps it for the next boot.
function _challengeSend(body) {
    return _webLbTokenAged().then(tok => {
        if (!tok) return;
        const b = Object.assign({}, body, { tok });
        delete b.at;
        return fetch(WEB_LEADERBOARD_API + '/c', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(b),
            keepalive: true,
        }).then(r => { if (r.status < 500) _challengeOutboxDrop(body.id); });
    }).catch(() => {});
}

// Called by share.js shareRun() before it builds the text: makes this run's challenge
// id, queues the upload and sends it alongside the share sheet (no waiting before the
// sheet opens, so a browser keeps the tap's user activation for navigator.share).
function challengeEnsure() {
    if (runChallengeId || !_challengeOn() || !(score > 0)) return runChallengeId;
    runChallengeId = newChallengeId();
    let g = null;
    try {
        if (typeof ghostTrack !== 'undefined' && ghostTrack && ghostTrack.length > 1) {
            const enc = ghostEncode(ghostTrack).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            if (enc.length <= CHALLENGE_GHOST_MAX_B64) g = enc;
        }
    } catch (e) { g = null; }
    const nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const body = {
        id: runChallengeId, owner: webPlayerId(), d: _tunlActiveDayInt(), s: score | 0,
        p: Math.round((nowMs - _webRunStartMs) / 1000), src: _challengeSrc(), at: Date.now(),
    };
    if (g) body.g = g;
    if (challengeActive()) body.parent = webParamChallenge;
    const box = _challengeOutbox(); box.push(body); _challengeOutboxSave(box);
    _challengeSend(body);
    return runChallengeId;
}

// Boot (main.js): retry whatever an earlier session could not send.
function challengeFlushOutbox() {
    if (!_challengeOn()) return;
    const box = _challengeOutbox();
    _challengeOutboxSave(box);   // drops the expired ones
    box.forEach(_challengeSend);
}

// share_open analytics (share.js shareRun): which button, and whether it answered a challenge.
function challengeShareEvent(kind) {
    const p = { kind: kind, reply: challengeActive() ? 1 : 0 };
    appEvent('share_open', p);
    if (window._tunlGA) window._tunlGA('share_open', p);
}

// ── Recipient ──
// The challenge this page was opened on: { mine, ghost, past, plays, beats } once the
// worker answered (null until then, or for good when it never does).
let challengeIn = null;
// This run's result against it, for the death-screen chip (draw.js): { beat, delta,
// plays, beats }. Set in commitDeath (challengeRunDone), cleared by startPlay.
let challengeResult = null;
const CHALLENGE_FETCH_MS = 2500;

// A challenge someone ELSE sent, with a score to beat. The link's own ?r is the
// sender's id, so a sender opening their own link is told apart before the worker
// answers; the worker's `mine` covers a sender on another device of the same id.
function challengeActive() {
    if (!webParamChallenge || !(webParamGhostScore > 0)) return false;
    if (webParamReferrer && webParamReferrer === webPlayerId()) return false;
    return !(challengeIn && challengeIn.mine);
}

// Boot (main.js): fetch the challenge's ghost. A ghost recorded on another cave (the
// row's day is not the link's day) is ignored; banner and score stay from the link.
function challengeFetch() {
    if (!_challengeOn() || !webParamChallenge) return;
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), CHALLENGE_FETCH_MS) : 0;
    const ev = (ok, past, mine) => {
        const p = { ok: ok, past: past, mine: mine };
        appEvent('challenge_open', p);
        if (window._tunlGA) window._tunlGA('challenge_open', p);
    };
    const past = _tunlActiveDayInt() !== _tunlTodayInt() ? 1 : 0;
    fetch(WEB_LEADERBOARD_API + '/c/' + webParamChallenge + '?me=' + encodeURIComponent(webPlayerId()),
          ctl ? { signal: ctl.signal } : {})
        .then(r => r.ok ? r.json() : null)
        .then(j => {
            clearTimeout(timer);
            if (!j) { ev(0, past, 0); return; }
            challengeIn = { mine: !!j.mine, ghost: false, past: past, plays: j.plays | 0, beats: j.beats | 0 };
            ev(1, past, j.mine ? 1 : 0);
            if (j.mine || +j.d !== _tunlActiveDayInt() || !j.g) return;
            challengeIn.ghost = applyFriendGhost(j.g, webParamGhostScore);
        })
        .catch(() => { clearTimeout(timer); ev(0, past, 0); });
}

function _tunlTodayInt() {
    const now = new Date();
    return now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
}

// commitDeath (update.js): the run's result against the challenge, shown at once from
// the link's score, then reported; the worker's plays/beats complete the chip.
// isNew: this was the player's first run ever (lifecycle.js startPlay counts it first).
function challengeRunDone(runScore, playSec, isNew) {
    if (!challengeActive() || !(runScore > 0)) { challengeResult = null; return; }
    const beat = runScore > webParamGhostScore;
    challengeResult = { beat: beat, delta: beat ? runScore - webParamGhostScore : Math.max(1, webParamGhostScore - runScore),
                        plays: 0, beats: 0 };
    const p = { beat: beat ? 1 : 0, is_new: isNew ? 1 : 0 };
    appEvent('challenge_run', p);
    if (window._tunlGA) window._tunlGA('challenge_run', p);
    if (!_challengeOn()) return;
    const res = challengeResult;
    _webLbTokenAged().then(tok => {
        if (!tok) return;
        return fetch(WEB_LEADERBOARD_API + '/c/' + webParamChallenge + '/run', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ pid: webPlayerId(), s: runScore | 0, p: Math.round(playSec || 0), isNew: isNew ? 1 : 0, tok }),
            keepalive: true,
        }).then(r => r.json()).then(j => {
            if (j && !j.self && res === challengeResult) { res.plays = j.plays | 0; res.beats = j.beats | 0; }
        });
    }).catch(() => {});
}

// share.js shareRunText(): a rematch says how the answer went (shareReplyWon/Lost).
function challengeReplyDelta() {
    return (challengeActive() && challengeResult) ? { beat: challengeResult.beat, delta: challengeResult.delta } : null;
}

// ── Sender's inbox ──
// Boot (main.js): who flew this player's challenges since the last check. The worker
// reports each recipient's run once (`seen`), so this never repeats a message. Shown
// on the title as a card (draw.js, CHALLENGE_INBOX_SEC) once the day's arrival card
// has gone; purely informative - the rematch itself goes back through the chat.
let challengeInbox = null;   // { plays, beats } or null
let challengeInboxT = 0;
function checkChallengeInbox() {
    if (!_challengeOn()) return;
    fetch(WEB_LEADERBOARD_API + '/c/inbox', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: webPlayerId() }),
    }).then(r => r.json()).then(j => {
        const items = j && Array.isArray(j.items) ? j.items : [];
        let plays = 0, beats = 0;
        for (const it of items) { plays += it.newPlays | 0; beats += it.newBeats | 0; }
        if (plays <= 0) return;
        challengeInbox = { plays: plays, beats: beats };
        challengeInboxT = CHALLENGE_INBOX_SEC;
    }).catch(() => {});
}
