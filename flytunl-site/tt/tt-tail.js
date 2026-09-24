// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ============================================================
//  /tt/ landing - tail half (inlined by build-play.mjs AFTER the game bundle)
// ============================================================
//  Reads the game's globals (phase, T, webPromoOn, ...) - all src files share one
//  global scope, so a classic script loaded after the bundle can see them - and never
//  writes gameplay state. What it adds, /tt/ only:
//   - a HOLD TO FLY pill on the title
//     screen until the first run starts;
//   - the app pitch after the FIRST run at any score (update.js _tunlWebPitchFloor):
//     the store links wait until the visitor has played once, and a first run of an
//     ad visitor rarely reaches CONTINUE_MIN_SCORE;
//   - store links that survive an in-app browser (openStore below);
//   - the funnel, countable in Cloudflare Web Analytics with no new tracker: invisible
//     hits on /tt/run/, /tt/pitch/, /tt/store-ios/, /tt/store-android/ next to the /tt/
//     page views themselves, plus the same steps as GA events through the existing relay;
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

    // ── Hints ─────────────────────────────────────────────────────────────────
    // No turn hint: the game is already drawn landscape, the player turns the phone on their own.
    var go = document.createElement('div');
    go.id = 'tt-go';
    go.setAttribute('aria-hidden', 'true');
    document.body.appendChild(go);

    function toggle(el, on) { if (el && el.classList.contains('show') !== on) el.classList.toggle('show', on); }

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
    var dead = false, promo = false, bootTs = 0;
    function tick(ts) {
        if (!bootTs) bootTs = ts;
        probeFrame(ts);
        lastTs = ts;
        var panel = showShop || showShipPicker || showSettings || showMissions || showCurrencyInfo;

        if (TT.firstRun && phase === 'play') {
            TT.firstRun = false;
            root.classList.remove('tt-fresh');
            count('run');
        }
        if (!dead && phase === 'dead') {
            dead = true;
            window._tunlWebPitchFloor = undefined;
        }
        if (webPromoOn && !promo) { ga('pitch_open'); count('pitch'); }
        promo = webPromoOn;

        if (go.textContent !== T.tap) go.textContent = T.tap;
        toggle(go, TT.firstRun && phase === 'title' && !panel && ts - bootTs > 900);
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
})();
