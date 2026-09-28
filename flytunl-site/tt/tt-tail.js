// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ============================================================
//  /tt/ landing - tail half (inlined by build-play.mjs AFTER the game bundle)
// ============================================================
//  Reads the game's globals (phase, T, webPromoOn, ...) - all src files share one
//  global scope, so a classic script loaded after the bundle can see them - and never
//  writes gameplay state, with two narrow exceptions that only replay what a player's own
//  tap does in input.js: the start screen's tap calls startPlay() (the title's blank-area
//  tap), and the first death opens the app card (webPromoOn, the continue ring's tap).
//  What it adds, /tt/ only:
//   - the start screen (#tt-splash, see tt-head.js) instead of the title for the first run;
//   - the app card opening by itself after the FIRST death, at any score (update.js
//     _tunlWebPitchFloor keeps the continue slot open; this skips the ring and opens the
//     card the ring would open). On /play/ the card only opens on a ring tap, and on
//     2026-09-25 zero of ~60 first runs on /tt/ tapped the ring. From the second run on,
//     /tt/ behaves like /play/ again;
//   - store links that survive an in-app browser (openStore below);
//   - the funnel, countable in Cloudflare Web Analytics with no new tracker: invisible
//     hits on /tt/<step>/ next to the /tt/ page views themselves (see STEPS below), plus
//     the same steps as GA events through the existing relay;
//   - a one-time raster downgrade when the title screen runs slow (weak Android).
// ============================================================
(function () {
    'use strict';
    var TT = window.TUNL_TT;
    if (!TT || typeof isWeb !== 'function' || !isWeb()) return;
    var root = document.documentElement;
    try { root.lang = activeLang; } catch (e) {}

    // update.js die(): on web, the pitch floor is this instead of CONTINUE_MIN_SCORE.
    // Cleared at the first death, so from the second run on /tt/ behaves like /play/.
    window._tunlWebPitchFloor = 0;

    function ga(name, params) { try { if (window._tunlGA) window._tunlGA(name, params); } catch (e) {} }

    // ── Cloudflare-countable funnel steps ─────────────────────────────────────
    // Each step loads a tiny page (site/tt/<step>/index.html) in a hidden iframe; that
    // page carries the Cloudflare beacon, so the step shows up as its own path in the
    // same dashboard as /tt/. The page redirects to /tt/ when opened on its own, so a
    // stray visit is never counted.
    //
    // v3 (2026-09-27), after tt_2709 counted pitch 52 > dead 39 and store-android 0:
    //  - every step counts at most ONCE per page view (a later card opened from the
    //    continue ring used to count pitch again);
    //  - the step page reports back (postMessage, build-play.mjs TT_STEP_PAGE) once the
    //    beacon's page-view request has come back from Cloudflare, so a caller about to
    //    leave the page (a store link) can wait for it: leaving first tore the iframe
    //    down with the request still in flight, which is how store clicks went missing;
    //  - an iframe whose page never arrived (flaky mobile data) is tried once more.
    var counted = {}, onCounted = {};
    window.addEventListener('message', function (e) {
        var d = e.data;
        if (e.origin !== location.origin || !d || d.tt !== 'counted') return;
        var cb = onCounted[d.step];
        if (cb) { delete onCounted[d.step]; cb(); }
    });
    function countFrame(step, retry) {
        try {
            var f = document.createElement('iframe'), loaded = false;
            f.src = '/tt/' + step + '/';
            f.setAttribute('aria-hidden', 'true');
            f.tabIndex = -1;
            f.style.cssText = 'position:fixed;left:-10px;top:-10px;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
            f.onload = function () { loaded = true; };
            root.appendChild(f);
            setTimeout(function () { try { f.remove(); } catch (e) {} }, 30000);
            if (retry) setTimeout(function () {
                if (loaded || !onCounted[step] || document.hidden) return;
                try { f.remove(); } catch (e) {}
                countFrame(step, false);
            }, 8000);
        } catch (e) {}
    }
    // count(step[, then, maxMs]): then() runs once the hit is confirmed, or after maxMs
    // at the latest - the visitor is never held longer than that. A step already counted
    // on this page runs then() at once.
    function count(step, then, maxMs) {
        var done = false;
        var go = function () { if (!done) { done = true; if (then) then(); } };
        if (counted[step]) { go(); return; }
        counted[step] = true;
        onCounted[step] = go;
        if (then) setTimeout(go, maxMs || 1500);
        countFrame(step, true);
    }
    // Warm the HTTP cache for a step page the visitor may be about to need, so the hit
    // before a store hand-off costs one Cloudflare round trip, not two.
    function warm(step) {
        try { if (!counted[step]) fetch('/tt/' + step + '/', { credentials: 'same-origin' }).catch(function () {}); } catch (e) {}
    }

    // ── Store links ───────────────────────────────────────────────────────────
    // The game opens a store with window.open(url, '_blank') (input.js). In a WKWebView
    // whose host app implements no new-window delegate that call does nothing at all,
    // so here every store link navigates the page itself, which any host sees.
    //
    // The card only offers the store this device can use (tt-head.js TT.os and
    // _tunlStoreOnly, src/web.js webStoreOnly): tt_2709 had 8 App Store taps,
    // 0 Google Play taps and 0 iOS installs from ~90%-Android Indonesia.
    //
    // Order of a tap: the funnel hit and the GA event first (count() waits for the hit to
    // be confirmed, at most HANDOFF_WAIT_MS), then the hand-off:
    //  - Android in an in-app browser (TikTok): the Play Store app through intent://
    //    naming com.android.vending, then market://, both from a hidden iframe so a host
    //    that refuses a scheme can't replace the page with an error page, then the https
    //    listing if the page is still in front. A top-level intent:// would be the
    //    cleaner call, but a webview that does not handle it shows ERR_UNKNOWN_URL_SCHEME
    //    in place of the game. /tt/diag/ has the variants for the real-device check;
    //  - iOS in an in-app browser: itms-apps://, then the https listing;
    //  - a real browser (Chrome, Safari): the https listing, which both hand to the store
    //    app themselves.
    // Every Play link carries a referrer (utm_source=tiktok, utm_campaign from this page's
    // URL), which the Play Console shows under acquisition by UTM. The App Store links
    // carry ct/pt only once APPLE_PT is set (App Store Connect -> App Analytics ->
    // Acquisition -> Campaigns -> "Generate a campaign link"): ct without pt is ignored.
    var PKG = 'com.theodoracatos.tunl', APP_ID = 'id6789721765';
    var APPLE_PT = '93838800';
    var HANDOFF_WAIT_MS = 1500, STEP_MS = 700;
    var camp = 'tt_landing';
    try {
        var qc = new URLSearchParams(location.search).get('utm_campaign');
        if (qc && /^[\w.-]{1,50}$/.test(qc)) camp = qc;
    } catch (e) {}
    var refQ = 'referrer=' + encodeURIComponent('utm_source=tiktok&utm_campaign=' + camp);
    var PLAY_HTTPS = 'https://play.google.com/store/apps/details?id=' + PKG + '&' + refQ;
    var PLAY_MARKET = 'market://details?id=' + PKG + '&' + refQ;
    var PLAY_INTENT = 'intent://details?id=' + PKG + '&' + refQ + '#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url='
        + encodeURIComponent(PLAY_HTTPS) + ';end';
    var appQ = APPLE_PT ? '?pt=' + APPLE_PT + '&ct=' + encodeURIComponent(camp) + '&mt=8' : '';
    var APP_HTTPS = 'https://apps.apple.com/app/' + APP_ID + appQ;
    var APP_NATIVE = 'itms-apps://apps.apple.com/app/' + APP_ID + appQ;
    TT.storeUrls = { playHttps: PLAY_HTTPS, playMarket: PLAY_MARKET, playIntent: PLAY_INTENT, appHttps: APP_HTTPS, appNative: APP_NATIVE };

    // While a hand-off runs: a wordless spinner over the game (the tap visibly did
    // something) that also swallows repeat taps - tt_2709's GA had 15 store taps from
    // 6 visitors. Gone when the page comes back, or after HANDOFF_UI_MS.
    var HANDOFF_UI_MS = 6000;
    var busy = false, left = false, hand = null, handT = 0;
    function handoffUI(on) {
        clearTimeout(handT);
        if (on) {
            if (!hand) {
                hand = document.createElement('div');
                hand.id = 'tt-hand';
                hand.innerHTML = '<i></i>';
                ['pointerdown', 'pointerup', 'click'].forEach(function (t) {
                    hand.addEventListener(t, function (e) { e.stopPropagation(); if (e.cancelable) e.preventDefault(); });
                });
                document.body.appendChild(hand);
            }
            hand.classList.add('on');
            handT = setTimeout(function () { handoffUI(false); }, HANDOFF_UI_MS);
        } else {
            busy = false;
            if (hand) hand.classList.remove('on');
        }
    }
    function markLeft() { left = true; }
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) markLeft();
        else if (busy) setTimeout(function () { handoffUI(false); }, 300);
    });
    window.addEventListener('pagehide', markLeft);
    window.addEventListener('blur', markLeft);
    window.addEventListener('pageshow', function (e) { if (e.persisted) handoffUI(false); });

    function schemeFrame(url) {
        try {
            var f = document.createElement('iframe');
            f.style.display = 'none';
            f.src = url;
            root.appendChild(f);
            setTimeout(function () { try { f.remove(); } catch (e) {} }, 3000);
        } catch (e) {}
    }
    // Runs [action, ms to wait before the next one] pairs until the page has gone to
    // the background (a store app came to the front).
    function cascade(steps) {
        left = false;
        (function next(i) {
            if (i >= steps.length || left || document.hidden) return;
            steps[i][0]();
            setTimeout(function () { next(i + 1); }, steps[i][1]);
        })(0);
    }
    function handoff(kind) {
        var own = kind === TT.os;
        if (kind === 'android') {
            if (TT.inApp && own) cascade([
                [function () { schemeFrame(PLAY_INTENT); }, STEP_MS],
                [function () { schemeFrame(PLAY_MARKET); }, STEP_MS],
                [function () { location.href = PLAY_HTTPS; }, 0],
            ]);
            else location.href = PLAY_HTTPS;
        } else {
            if (TT.inApp && own) cascade([
                [function () { location.href = APP_NATIVE; }, 1200],
                [function () { location.href = APP_HTTPS; }, 0],
            ]);
            else location.href = APP_HTTPS;
        }
    }
    function openStore(kind) {
        if (busy) return;
        busy = true;
        handoffUI(true);
        ga('store_click', { store: kind });
        count('store-' + kind, function () { handoff(kind); }, HANDOFF_WAIT_MS);
    }
    // Returns a stub, not null: the game's openStoreLink() (src/web.js) treats null as
    // "the browser blocked it" and would navigate to the plain listing on top.
    var _open = window.open, OPENED = { closed: false };
    window.open = function (url) {
        if (url === APP_STORE_URL) { openStore('ios'); return OPENED; }
        if (url === PLAY_STORE_URL) { openStore('android'); return OPENED; }
        return _open.apply(window, arguments);
    };
    // The title-screen pill (#cta) links straight to the listings with target=_blank.
    document.addEventListener('click', function (e) {
        var a = e.target && e.target.closest && e.target.closest('#cta a');
        if (!a) return;
        e.preventDefault();
        openStore(/apps\.apple/.test(a.href) ? 'ios' : 'android');
    }, true);

    // ── Start screen ──────────────────────────────────────────────────────────
    // tt-tail.js runs right after the bundle, so from here on the game is there: the
    // label gets the game's own "hold to fly" string, and a tap that arrived while the
    // bundle was still loading starts the run now.
    var splash = document.getElementById('tt-splash');
    var splashLbl = splash && splash.querySelector('.lbl');
    function startFirstRun() {
        if (phase !== 'title') return;
        try { _initAC(); } catch (e) {}
        startPlay();
    }
    if (splash) {
        if (splashLbl) splashLbl.textContent = T.tap;
        splash.classList.add('ready');
        TT.start = startFirstRun;
        if (TT.armed) startFirstRun();
    }
    function hideSplash() {
        if (!splash || splash.classList.contains('off')) return;
        splash.classList.add('off');
        setTimeout(function () { try { splash.remove(); } catch (e) {} splash = null; }, 400);
    }

    // ── Slow-device fallback ──────────────────────────────────────────────────
    // Median frame time on the untouched title screen, from 1 s after boot for 60 frames.
    // Slower than ~42 fps with a raster above 1.3x: remember a lower cap for this session
    // (tt-head.js reads tt_dpr) and reload once - before the visitor has touched anything,
    // so nothing they did is lost. Never twice per session.
    var probeOn = TT.dpr > 1.3;
    try { if (sessionStorage.getItem('tt_q_done')) probeOn = false; } catch (e) { probeOn = false; }
    var probe = [], probeT0 = 0, lastTs = 0;
    window.addEventListener('pointerdown', function () { probeOn = false; }, true);
    function probeFrame(ts) {
        if (!probeOn) return;
        if (!probeT0) probeT0 = ts;
        if (document.hidden || phase !== 'title') { probeOn = false; return; }
        if (ts - probeT0 > 1000 && lastTs) probe.push(ts - lastTs);
        if (probe.length >= 60) {
            probeOn = false;
            probe.sort(function (a, b) { return a - b; });
            var med = probe[30];
            if (med > 24) {
                try {
                    sessionStorage.setItem('tt_q_done', '1');
                    sessionStorage.setItem('tt_dpr', String(TT.dpr >= 2 ? 1.5 : 1));
                    sessionStorage.setItem('tt_reload', '1');
                    location.replace(location.href);
                } catch (e) {}
            }
        }
    }

    // ── Per-frame state ───────────────────────────────────────────────────────
    // Funnel steps (Cloudflare path /tt/<step>/, GA event in brackets):
    //   ready  the game has loaded and the start screen is live (tt_ready)
    //   run    the first run started (run_start, from lifecycle.js)
    //   dead   the first run ended (tt_dead {score})
    //   pitch  the app card opened (pitch_open {auto}: 1 = opened by itself at the first
    //          death, 0 = from the continue ring of a later run)
    //   store-ios / store-android  a store button (store_click {store}, every tap)
    //   run2   a second run started (tt_run2)
    // ready and dead split the old /tt/ -> /tt/run/ -> /tt/pitch/ gaps: left while the
    // page loaded vs. left at the start screen, and left mid-run vs. died and left.
    // Each Cloudflare step counts once per page view (count()); GA gets every event.
    // A reload this page made itself (the slow-device fallback above, the real-rotation
    // reload in tt-head.js) is the same visit: its ready was counted before the reload,
    // often before /tt/'s own page view, which only goes out at the window's load event -
    // tt_2709 had ready 747 against /tt/ 625.
    var reloaded = false;
    try { reloaded = !!sessionStorage.getItem('tt_reload'); sessionStorage.removeItem('tt_reload'); } catch (e) {}
    var dead = false, runs = 0, promo = false, autoPitch = false, autoOpen = false, lastPhase = '';
    if (!reloaded) { ga('tt_ready'); count('ready'); }
    function tick(ts) {
        probeFrame(ts);
        lastTs = ts;

        if (phase === 'play' && lastPhase !== 'play' && lastPhase !== 'revive') {
            runs++;
            if (runs === 1) { TT.firstRun = false; root.classList.remove('tt-fresh'); count('run'); }
            if (runs === 2) { ga('tt_run2'); count('run2'); }
        }
        if (phase !== 'title') hideSplash();

        if (!dead && phase === 'dead') {
            dead = true;
            window._tunlWebPitchFloor = undefined;
            ga('tt_dead', { score: score }); count('dead');
            autoPitch = continueOfferPending;
        }
        // The first death opens the app card by itself, once the crash's own freeze frame
        // (DEATH_REPLAY_SEC) has played: the same two assignments the continue ring's tap
        // makes in input.js, so the card's timer, skip gate, store buttons and the way it
        // resolves into the death screen are all the game's own. Closing it never starts
        // a run.
        if (autoPitch && phase === 'dead' && continueOfferPending && !webPromoOn && deadT >= DEATH_REPLAY_SEC) {
            autoPitch = false; autoOpen = true;
            webPromoOn = true; webPromoT = 0;
        }
        if (autoPitch && phase !== 'dead') autoPitch = false;
        if (webPromoOn && !promo) {
            ga('pitch_open', { auto: autoOpen ? 1 : 0 }); count('pitch');
            autoOpen = false;
            if (TT.os !== 'android') warm('store-ios');
            if (TT.os !== 'ios') warm('store-android');
        }
        promo = webPromoOn;
        lastPhase = phase;
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
})();
