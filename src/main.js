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
    // Other players' runs on today's board (state.js rivalDeaths doc). Re-validated here
    // rather than trusted, since this crosses the native/JS bridge (or, on web, an HTTP
    // response) the same way every other _tunlNativeUpdate field does. Capped at 20 --
    // plenty for both the death screen's nearest-few rows and the share card's dot cloud,
    // and small enough that a malformed payload can't bloat the object.
    if (Array.isArray(state.rivalDeaths)) {
        rivalDeaths = state.rivalDeaths
            .filter(r => r && typeof r.score === 'number' && r.score > 0)
            .slice(0, 20)
            .map(r => ({ score: r.score, name: typeof r.name === 'string' ? r.name.slice(0, 24) : '' }));
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
    appEvent('ad_result', { format: 'shards', granted: 1, how: 'watched', src: shardsAdSource });
    shards += SHARDS_AD_REWARD;
    shardsAdClaimedToday = true;
    localStorage.setItem('tunnel_shards', shards);
    localStorage.setItem('tunnel_shards_ad_claimed', '1');
    sfxMissionDone();   // already the "you earned shards" chime
};
window._tunlShardsRewardDeclined = function () {
    if (shardsAdPending) appEvent('ad_result', { format: 'shards', granted: 0, how: 'closed', src: shardsAdSource });
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
    if (showStardustPath) { showStardustPath = false; return true; }  // over ALL SHIPS or HOW IT WORKS -- topmost
    if (showCurrencyInfo) { showCurrencyInfo = false; return true; }  // layered on top of Settings -- dismiss it first
    if (showSettings) { showSettings = false; return true; }
    if (showShop) { showShop = false; return true; }
    if (showMissions) { showMissions = false; return true; }
    if (showPaint) { showPaint = false; paintPreview = -1; return true; }
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
    if (typeof _recTick === 'function') _recTick(dt);
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
// The legal links (#legal) ride along: same visibility (minus the arrival-card wait), and
// they open the site's page in the game's language (the site has one per game language, English at the root).
const _legalEl = document.getElementById('legal');
let _legalLangShown = null;
function _syncWebLegalLabels() {
    if (!_legalEl || typeof T === 'undefined' || !T.legalLink || _legalLangShown === activeLang) return;
    _legalLangShown = activeLang;
    const base = activeLang === 'en' || !LANGS[activeLang] ? '/' : '/' + activeLang + '/';
    const imp = document.getElementById('legal-imp'), priv = document.getElementById('legal-priv');
    if (imp)  { imp.textContent  = T.legalLink;   imp.href  = base + 'impressum/'; }
    if (priv) { priv.textContent = T.privacyLink; priv.href = base + 'privacy/'; }
}
let _legalShown = false;
function _setWebOverlay(el, show) {
    if (!el) return;
    el.classList.toggle('show', show);
    el.setAttribute('aria-hidden', show ? 'false' : 'true');
}
function _syncWebCta() {
    if (!_ctaEl) return;
    // Hidden while any title-screen panel is open (ALL SHIPS / shop, ship
    // picker, settings, missions, currency info) - it otherwise floats over the
    // panel content.
    const _panelOpen = showShop || showShipPicker || showSettings || showMissions || showCurrencyInfo || appOnlyKey;
    const show = isWeb() && phase === 'title' && !_portraitCovered && !_panelOpen;
    // The pill sits top-centre, where the day's arrival card (dayGrantT) and the
    // challenge inbox card (challengeInboxT) are drawn: it waits them out. The legal
    // links do not.
    const showCta = show && dayGrantT <= 0 && !(challengeInboxT > 0);
    if (showCta && _ctaLbl && typeof T !== 'undefined' && T.getApp && _ctaLangShown !== T.getApp) {
        _ctaLbl.textContent = T.getApp;
        _ctaLangShown = T.getApp;
    }
    if (show) _syncWebLegalLabels();
    if (showCta !== _ctaShown) { _ctaShown = showCta; _setWebOverlay(_ctaEl, showCta); }
    if (show !== _legalShown) { _legalShown = show; _setWebOverlay(_legalEl, show); }
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

// ── Rotation reload (web only) ───────────────────────────────────────
// W, H, FS and the hundreds of metrics derived from them are frozen at
// first paint (constants.js), so a device rotation leaves the canvas sized
// and proportioned for the previous orientation -- soft-scaled and cramped
// -- until a manual reload. The iOS/Android wrappers lock orientation and
// never reach this. Reload once when the viewport WIDTH changes: a rotation
// always changes it, while iOS Safari's toolbar show/hide changes only the
// height, so a scroll-driven chrome collapse won't trip it.
if (isWeb()) {
    // Letterbox starfield (tunl.html's body.web-bg) - open web only, see its CSS
    // comment for why.
    document.body.classList.add('web-bg');
    // Web frame (tunl.html body.web-framed): only with real letterbox room, so a phone
    // browser filling the screen never gets rounded-off corners on the playfield.
    document.documentElement.style.setProperty('--tunl-acc', getTheme().wallBase.join(','));
    const _syncWebFrame = () => {
        const r = cv.getBoundingClientRect();
        document.body.classList.toggle('web-framed',
            window.innerWidth - r.width >= 32 || window.innerHeight - r.height >= 32);
    };
    _syncWebFrame();
    window.addEventListener('resize', _syncWebFrame);
    let _rotoBootW = window.innerWidth, _rotoT = 0;
    const _reloadAfterRotate = () => {
        if (Math.abs(window.innerWidth - _rotoBootW) < 4) return;
        clearTimeout(_rotoT);
        _rotoT = setTimeout(() => {
            if (Math.abs(window.innerWidth - _rotoBootW) >= 4) location.reload();
        }, 400);
    };
    window.addEventListener('resize', _reloadAfterRotate);
    window.addEventListener('orientationchange', _reloadAfterRotate);
}

// ── Fold / unfold (iOS app only) ────────────────────────────────────
// The iPhone Duo resizes the app live when it is folded or unfolded (outer and inner
// display), and W/H are frozen at load (constants.js, physics.md "Canvas size"). So:
// - the canvas is at once CSS-scaled to fit the new window (input maps through
//   getBoundingClientRect, gameplay coordinates are untouched - a display zoom, no
//   difficulty change);
// - a run in progress is paused through the interruption pause (input.js
//   pauseForInterrupt: the cave is covered, no grace window afterwards), held until the
//   resize has settled, then resumes through the READY countdown - folding takes both
//   hands, a hold-to-thrust ship would fall meanwhile;
// - the page reloads at the new size at the next point where nothing is lost: at once
//   on the bare title screen, else when the player is back on it or starts the next run
//   (startPlay, lifecycle.js). The rest of the run is flown at the size it started on.
// Android keeps its own load path (MainActivity.loadWhenSized) and the web its rotation
// reload above; neither reaches this.
let _resizeReloadPending = false;
function _resizeReloadIfSafe(atRunStart) {
    if (!_resizeReloadPending) return false;
    const panelOpen = showShop || showShipPicker || showSettings || showMissions || showCurrencyInfo
                   || showPaint || showStardustPath;
    if (!atRunStart && (phase !== 'title' || panelOpen)) return false;
    location.reload();
    return true;
}
if (!isWeb() && !isAndroidApp()) {
    const _bootW = window.innerWidth, _bootH = window.innerHeight;
    let _settleT = 0;
    const _fitCanvas = () => {
        const s = Math.min(window.innerWidth / W, window.innerHeight / H);
        cv.style.width  = (W * s) + 'px';
        cv.style.height = (H * s) + 'px';
    };
    window.addEventListener('resize', () => {
        if (Math.abs(window.innerWidth - _bootW) < 4 && Math.abs(window.innerHeight - _bootH) < 4) {
            // Back at the boot size (unfolded and folded again): nothing to reload.
            _resizeReloadPending = false;
            cv.style.width = W + 'px'; cv.style.height = H + 'px';
            return;
        }
        _fitCanvas();
        _resizeReloadPending = true;
        if (phase === 'play') _suppressInput();
        clearTimeout(_settleT);
        _settleT = setTimeout(() => {
            if (interruptPaused && !document.hidden) _pageBack();
            _resizeReloadIfSafe(false);
        }, 700);
    });
    // Panels closed, or the death screen's HOME button: the bare title screen is back.
    setInterval(() => _resizeReloadIfSafe(false), 500);
}

// GameView.swift disables WKWebView's "user action required for playback"
// policy, so audio can start immediately without waiting for the first tap.
_initAC();
// Once per app open, on every platform: picks up shard rewards for anyone
// this player referred who has since played (web.js checkReferralReward).
// Not gated on isWeb() - see that function's doc comment.
if (typeof checkReferralReward === 'function') checkReferralReward();
// The challenge link (web.js "Challenge link"), same platform rule: the ghost of the
// challenge this page was opened on, who flew this player's own challenges, and any
// challenge an earlier session could not upload.
if (typeof challengeFetch === 'function') { challengeFetch(); checkChallengeInbox(); challengeFlushOutbox(); }
titleScreen();
_updatePortraitGate();
// Hold the first frame until the bundled typefaces (fonts.js) are usable, capped at
// FONT_WAIT_MS so a font that never loads can never hold up the game.
let _loopStarted = false;
const _startLoop = () => {
    if (_loopStarted) return;
    _loopStarted = true;
    requestAnimationFrame(ts => { prev = ts; requestAnimationFrame(loop); });
};
fontsReady.then(_startLoop, _startLoop);
setTimeout(_startLoop, FONT_WAIT_MS);
