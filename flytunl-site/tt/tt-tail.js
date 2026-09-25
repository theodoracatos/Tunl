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
    function count(step) {
        try {
            var f = document.createElement('iframe');
            f.src = '/tt/' + step + '/';
            f.setAttribute('aria-hidden', 'true');
            f.tabIndex = -1;
            f.style.cssText = 'position:fixed;left:-10px;top:-10px;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
            root.appendChild(f);
            setTimeout(function () { try { f.remove(); } catch (e) {} }, 30000);
        } catch (e) {}
    }

    // ── Store links ───────────────────────────────────────────────────────────
    // The game opens a store with window.open(url, '_blank') (input.js). In a WKWebView
    // whose host app implements no new-window delegate that call does nothing at all,
    // so here every store link navigates the page itself, which any host sees:
    //  - in an in-app browser, the store app's own scheme first (itms-apps:// as a
    //    navigation on iOS; market:// through a hidden iframe on Android, so a host that
    //    refuses it can't replace the page with an error), then the https listing if
    //    the page is still in front ~1.2 s later;
    //  - in a real browser, the https listing, which iOS and Android hand to the store
    //    app themselves.
    // /tt/diag/ tests each of these paths one by one inside the real TikTok app.
    var IOS_NATIVE = 'itms-apps://apps.apple.com/app/id6789721765';
    var PLAY_NATIVE = 'market://details?id=com.theodoracatos.tunl';
    function openStore(kind) {
        ga('store_click', { store: kind });
        count('store-' + kind);
        var https = kind === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
        var own = (kind === 'ios' && TT.ios) || (kind === 'android' && TT.android);
        if (!TT.inApp || !own) { setTimeout(function () { location.href = https; }, 120); return; }
        var left = false;
        var gone = function () { left = true; };
        document.addEventListener('visibilitychange', function () { if (document.hidden) gone(); });
        window.addEventListener('pagehide', gone);
        if (kind === 'ios') {
            location.href = IOS_NATIVE;
        } else {
            var f = document.createElement('iframe');
            f.style.display = 'none';
            f.src = PLAY_NATIVE;
            root.appendChild(f);
            setTimeout(function () { try { f.remove(); } catch (e) {} }, 3000);
        }
        setTimeout(function () { if (!left && !document.hidden) location.href = https; }, 1200);
    }
    var _open = window.open;
    window.open = function (url) {
        if (url === APP_STORE_URL) { openStore('ios'); return null; }
        if (url === PLAY_STORE_URL) { openStore('android'); return null; }
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
    //   pitch  the app card opened (pitch_open {auto})
    //   store-ios / store-android  a store button (store_click {store})
    //   run2   a second run started (tt_run2)
    // ready and dead split the old /tt/ -> /tt/run/ -> /tt/pitch/ gaps: left while the
    // page loaded vs. left at the start screen, and left mid-run vs. died and left.
    var dead = false, runs = 0, promo = false, autoPitch = false, lastPhase = '';
    ga('tt_ready'); count('ready');
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
            autoPitch = false;
            webPromoOn = true; webPromoT = 0;
        }
        if (autoPitch && phase !== 'dead') autoPitch = false;
        if (webPromoOn && !promo) { ga('pitch_open', { auto: runs === 1 && dead ? 1 : 0 }); count('pitch'); }
        promo = webPromoOn;
        lastPhase = phase;
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
})();
