// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ============================================================
//  /tt/ landing - head half (inlined by build-play.mjs BEFORE the game bundle)
// ============================================================
//  flytunl.ch/tt/ is where paid TikTok clips send their website button. Same game
//  bundle as /play/, but the visitor is almost always on a phone, inside TikTok's
//  in-app browser, which is portrait-locked: turning the phone does not rotate the
//  page, so /play/'s "rotate your device" gate would never let them in.
//
//  So in a portrait viewport this page turns the GAME instead: <body> is rotated 90deg
//  (tt.css), the player turns the phone, and the game sees a landscape viewport. The
//  bundle is not touched for this. Three things are remapped before it runs:
//   - window.innerWidth/innerHeight report the landscape size, so constants.js sizes
//     W/H for landscape and main.js's portrait gate stays down;
//   - the canvas's getBoundingClientRect() reports its rect in the rotated frame;
//   - pointer events get clientX/clientY in the rotated frame (capture phase on
//     window, i.e. before input.js's own listeners), so every tap maps exactly as
//     input.js's (clientX - rect.left) * W / rect.width expects.
//  DOM overlays inside <body> (#cta, #rec-panel) need nothing: the browser hit-tests
//  through the transform itself.
//
//  Direction: TT.rot = +1 turns the content clockwise, i.e. the player turns the phone
//  counter-clockwise (top to the left), the usual way to watch a video sideways. On
//  Android the motion sensor needs no permission, so the page follows whichever way
//  the phone was actually turned (TT.rot = -1 for top-to-the-right). iOS only fires
//  motion events after a permission prompt, so there the direction stays +1 and the
//  turn hint shows which way to go.
//
//  If the webview DOES rotate (a real browser, or an in-app browser that allows it),
//  the viewport width changes and the page reloads into the plain landscape layout -
//  the same rule main.js applies on /play/.
//
//  Everything here is /tt/-only by construction: this file is inlined into
//  site/tt/index.html and nowhere else. The iOS/Android apps never see it.
// ============================================================
(function () {
    'use strict';
    var ua = navigator.userAgent || '';
    var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var android = /Android/.test(ua);
    // TikTok's webview UA carries one of these (musical_ly = the global app, trill = the
    // Asian build, BytedanceWebview = its Android webview). The rest catch the other
    // in-app browsers a clip link can land in when it is re-shared.
    var inApp = /musical_ly|BytedanceWebview|ByteLocale|TikTok|trill_/i.test(ua)
        || /FBAN|FBAV|Instagram|Line\/|Snapchat/.test(ua)
        || (android && /; wv\)/.test(ua));
    var touch = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
    var TT = window.TUNL_TT = {
        ios: ios, android: android, inApp: inApp,
        rot: 0,            // 0 = plain page, +1 / -1 = rotated (see header)
        sideways: false,   // Android: the sensor says the phone is held landscape
        firstRun: true,    // cleared by tt-tail.js when the first run starts
        dpr: 1,
    };
    var root = document.documentElement;
    root.classList.add('tt-fresh', ios ? 'tt-ios' : android ? 'tt-android' : 'tt-desk');

    // ── Raster cap (weak Android phones) ──────────────────────────────────────
    // constants.js rasterises the canvas at devicePixelRatio. A mid-range Android phone
    // reports 2.6-3 and fills ~2.2x the pixels of a 2x raster for no visible gain at
    // this size, so Android is capped at 2. tt-tail.js lowers the cap further for the
    // rest of the session (sessionStorage tt_dpr + one reload) if the title screen
    // still runs slow. Display size is unaffected - only the backing store shrinks.
    var cap = 0;
    try { cap = +sessionStorage.getItem('tt_dpr') || 0; } catch (e) {}
    if (!cap) cap = android ? 2 : 3;
    var realDpr = window.devicePixelRatio || 1;
    TT.dpr = Math.min(realDpr, cap);
    if (realDpr > cap) {
        try { Object.defineProperty(window, 'devicePixelRatio', { get: function () { return cap; }, configurable: true }); }
        catch (e) { TT.dpr = realDpr; }
    }

    // ── Rotated portrait ──────────────────────────────────────────────────────
    function getter(name) {
        for (var o = window; o; o = Object.getPrototypeOf(o)) {
            var d = Object.getOwnPropertyDescriptor(o, name);
            if (d && d.get) return d.get;
        }
        return null;
    }
    var gW = getter('innerWidth'), gH = getter('innerHeight');
    function rw() { return gW ? gW.call(window) : root.clientWidth; }
    function rh() { return gH ? gH.call(window) : root.clientHeight; }
    TT.realW = rw; TT.realH = rh;
    var bootW = rw(), bootH = rh();

    function setVars() {
        root.style.setProperty('--tt-w', rw() + 'px');
        root.style.setProperty('--tt-h', rh() + 'px');
    }
    TT.setRot = function (d) {
        TT.rot = d;
        root.classList.toggle('tt-ccw', d < 0);
    };

    if (touch && bootH > bootW && gW && gH) {
        try {
            // Frozen at the boot values, like every W/H-derived metric in the game:
            // a toolbar sliding in the webview must not reflow (or reload) the run.
            // A real rotation is caught by the width check below instead.
            Object.defineProperty(window, 'innerWidth',  { get: function () { return bootH; }, configurable: true });
            Object.defineProperty(window, 'innerHeight', { get: function () { return bootW; }, configurable: true });
            TT.setRot(1);
            root.classList.add('tt-rot');
            setVars();
        } catch (e) { TT.rot = 0; }
    }

    if (TT.rot) {
        window.addEventListener('resize', function () {
            setVars();
            // The webview rotated for real: start over in the plain landscape layout.
            if (Math.abs(rw() - bootW) >= 4 && rw() > rh()) {
                clearTimeout(TT._rt);
                TT._rt = setTimeout(function () { if (rw() > rh()) location.reload(); }, 400);
            }
        });

        // The canvas rect, in the rotated frame (see header). Screen -> content is
        // (X, Y) -> (Y, realW - X) for +1 and (realH - Y, X) for -1.
        var gbcr = Element.prototype.getBoundingClientRect;
        Element.prototype.getBoundingClientRect = function () {
            var r = gbcr.call(this);
            if (!TT.rot || this.id !== 'c') return r;
            var w = r.height, h = r.width, L, T;
            if (TT.rot > 0) { L = r.top; T = rw() - r.right; }
            else            { L = rh() - r.bottom; T = r.left; }
            return { left: L, top: T, width: w, height: h, right: L + w, bottom: T + h, x: L, y: T };
        };

        var remap = function (e) {
            if (!TT.rot) return;
            var X = e.clientX, Y = e.clientY;
            var cx = TT.rot > 0 ? Y : rh() - Y;
            var cy = TT.rot > 0 ? rw() - X : X;
            try {
                Object.defineProperty(e, 'clientX', { value: cx });
                Object.defineProperty(e, 'clientY', { value: cy });
            } catch (err) {}
        };
        ['pointerdown', 'pointerup', 'pointermove', 'pointercancel'].forEach(function (t) {
            window.addEventListener(t, remap, true);
        });

        // Android: follow the way the phone was really turned. accelerationIncludingGravity
        // reads about +9.8 on the axis pointing up; x points out of the device's right
        // edge, so x > 0 = top turned to the left (+1), x < 0 = top to the right (-1).
        // The 1.6x dominance margin keeps a phone at 45deg from flapping between the two.
        if (android) {
            window.addEventListener('devicemotion', function (e) {
                var g = e.accelerationIncludingGravity;
                if (!g || g.x == null || g.y == null) return;
                var ax = Math.abs(g.x), ay = Math.abs(g.y);
                if (ax > 6.5 && ax > ay * 1.6) {
                    TT.sideways = true;
                    var d = g.x > 0 ? 1 : -1;
                    if (d !== TT.rot) TT.setRot(d);
                } else if (ay > 6.5 && ay > ax * 1.6) {
                    TT.sideways = false;
                }
            });
        }
    }
})();
