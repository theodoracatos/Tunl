// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── Web ads (Google Ad Manager H5 Games Ads) ──────────────────────────
// Ports the app's ad cadence (forced interstitial, rewarded continue, rewarded
// shard bonus - see AdsManager.swift/.kt) to the open web build, using Google
// Ad Manager's H5 Games Ads formats (GAME_MANUAL_INTERSTITIAL, REWARDED) via
// the Google Publisher Tag (googletag), not the AdMob SDK the apps use - IMA
// (the video-ads SDK) doesn't fit here, it requires a video-content player to
// overlay ads on, which a canvas game doesn't have. H5 Games Ads is Google's
// purpose-built product for exactly this (see googleads.github.io/
// google-publisher-tag-samples/{display-gaming-interstitial-ad,display-rewarded-ad}).
//
// Entirely isWeb()-gated and a no-op in both apps: this file still loads there
// (tunl.html references it like every other src file) but does nothing, since
// the apps already have a real window.webkit/TunlNative ad bridge from native
// code and this must never shadow it.
//
// Integration seam: input.js/update.js already call
// window.webkit?.messageHandlers?.ads?.postMessage({action, ...}) for every ad
// request, and that is a silent no-op on a plain browser (window.webkit is
// undefined there). Rather than sprinkling isWeb() branches through gameplay
// files, this polyfills that exact same window.webkit.messageHandlers.ads
// shape - so input.js/update.js/draw.js need zero changes, and draw.js's
// `!!window.webkit?.messageHandlers?.ads` check (the "does an ad row exist at
// all" gate for the Missions drawer) also just works on web once this loads.
//
// SETUP REQUIRED before any of this does anything real (see project chat -
// "Web ads via Google Ad Manager H5 Games Ads" for the full walkthrough):
//   1. Google Ad Manager account (free tier) linked to the AdSense account
//      already used for flytunl.ch (pub-4882203470005029) - blocked until
//      that AdSense site application clears Google's review.
//   2. Three out-of-page ad units created in Ad Manager under that network:
//      one Gaming Interstitial, two Rewarded (continue, shards).
//   3. Replace the ADS_WEB_NETWORK_CODE placeholder below with the real
//      network code Ad Manager gives you, and the two ad unit *names* if you
//      named them differently than tunl_web_interstitial/tunl_web_rewarded_*.
//   4. Add the Funding Choices (EU/UK/CH consent) snippet from AdSense's
//      Datenschutz und Mitteilungen -> Mitteilungen -> "Code abrufen" page
//      into flytunl-site/build-play.mjs's HEAD_EXTRA (placeholder comment
//      already there) - written by hand here instead of copied from the
//      account would risk being subtly wrong.
// Until step 3 is done, every defineOutOfPageSlot() call below returns null
// (Ad Manager doesn't recognize the placeholder path) and every branch here
// silently no-ops exactly like a native ad that failed to load would -
// death/continue/shards flows all keep working with no ads shown.

if (isWeb()) {

// ── Ad unit paths - REPLACE after creating them in Google Ad Manager ──
const ADS_WEB_NETWORK_CODE = 'REPLACE_WITH_NETWORK_CODE';
const AD_UNIT_INTERSTITIAL      = `/${ADS_WEB_NETWORK_CODE}/tunl_web_interstitial`;
const AD_UNIT_REWARDED_CONTINUE = `/${ADS_WEB_NETWORK_CODE}/tunl_web_rewarded_continue`;
const AD_UNIT_REWARDED_SHARDS   = `/${ADS_WEB_NETWORK_CODE}/tunl_web_rewarded_shards`;

// ── Forced interstitial cadence (mirrors AdsManager.swift 1:1) ────────
// Native persists this in UserDefaults/SharedPreferences; web has no
// equivalent, so localStorage under its own keys (never shared with the
// native tunnel_* keys - a web player and an app player are different
// installs anyway).
const AD_DEATHS_PER_AD    = 3;
const AD_MIN_INTERVAL_SEC = 120;
const AD_MIN_SCORE        = 25;

function _adsDeathCount()  { return +(localStorage.getItem('tunnel_web_death_count') || 0); }
function _adsLastAdTime()  { return +(localStorage.getItem('tunnel_web_last_ad_time') || 0); }

// ── googletag bootstrap ────────────────────────────────────────────────
window.googletag = window.googletag || { cmd: [] };

// Each *ReadyEvent holds the event object from the format's one-time "ready"
// callback (gameManualInterstitialSlotReady / rewardedSlotReady) - that event
// carries the only handle to make*Visible(), and it fires once per slot when
// the ad finishes loading, not on demand. So a request just calls the stored
// event's method if one is waiting; if none is (ad still loading, or none
// returned), it silently declines like a native ad that isn't ready.
let _interstitialSlot = null, _interstitialReadyEvent = null;
let _continueSlot = null, _continueReadyEvent = null, _continueGranted = false;
let _shardsSlot = null, _shardsReadyEvent = null, _shardsGranted = false;

function _defineInterstitialSlot() {
    _interstitialReadyEvent = null;
    _interstitialSlot = googletag.defineOutOfPageSlot(
        AD_UNIT_INTERSTITIAL, googletag.enums.OutOfPageFormat.GAME_MANUAL_INTERSTITIAL);
    if (_interstitialSlot) { _interstitialSlot.addService(googletag.pubads()); googletag.display(_interstitialSlot); }
}
function _defineContinueSlot() {
    _continueReadyEvent = null; rewardedAdReady = false;
    _continueSlot = googletag.defineOutOfPageSlot(AD_UNIT_REWARDED_CONTINUE, googletag.enums.OutOfPageFormat.REWARDED);
    if (_continueSlot) { _continueSlot.addService(googletag.pubads()); googletag.display(_continueSlot); }
}
function _defineShardsSlot() {
    _shardsReadyEvent = null; shardsAdReady = false;
    _shardsSlot = googletag.defineOutOfPageSlot(AD_UNIT_REWARDED_SHARDS, googletag.enums.OutOfPageFormat.REWARDED);
    if (_shardsSlot) { _shardsSlot.addService(googletag.pubads()); googletag.display(_shardsSlot); }
}

googletag.cmd.push(() => {
    _defineInterstitialSlot();
    _defineContinueSlot();
    _defineShardsSlot();

    googletag.pubads().addEventListener('gameManualInterstitialSlotReady', (event) => {
        if (event.slot === _interstitialSlot) _interstitialReadyEvent = event;
    });
    // Gaming interstitial slots are one-time use (Google's own doc note on
    // the format) - redefine after every close so the next death has a
    // fresh one loading, exactly like native reloads its interstitial after
    // each show.
    googletag.pubads().addEventListener('gameManualInterstitialSlotClosed', () => {
        if (_interstitialSlot) googletag.destroySlots([_interstitialSlot]);
        _defineInterstitialSlot();
    });

    googletag.pubads().addEventListener('rewardedSlotReady', (event) => {
        if (event.slot === _continueSlot) { _continueReadyEvent = event; rewardedAdReady = true; }
        if (event.slot === _shardsSlot)   { _shardsReadyEvent = event; shardsAdReady = true; }
    });
    googletag.pubads().addEventListener('rewardedSlotGranted', (event) => {
        if (event.slot === _continueSlot) _continueGranted = true;
        if (event.slot === _shardsSlot)   _shardsGranted = true;
    });
    // Rewarded slots are one-time use too - redefine after every close,
    // whether or not the reward was granted, and only then report the
    // outcome to the same callbacks the native bridge would have called.
    googletag.pubads().addEventListener('rewardedSlotClosed', (event) => {
        if (event.slot === _continueSlot) {
            googletag.destroySlots([_continueSlot]);
            const granted = _continueGranted; _continueGranted = false;
            _defineContinueSlot();
            if (granted) window._tunlReviveGranted(); else window._tunlReviveDeclined();
        }
        if (event.slot === _shardsSlot) {
            googletag.destroySlots([_shardsSlot]);
            const granted = _shardsGranted; _shardsGranted = false;
            _defineShardsSlot();
            if (granted) window._tunlShardsRewardGranted(); else window._tunlShardsRewardDeclined();
        }
    });

    googletag.enableServices();
});

// ── window.webkit.messageHandlers.ads polyfill ────────────────────────
// isWeb() being true already guarantees no native bridge defined this, but
// the guard costs nothing and documents the intent.
if (!window.webkit) window.webkit = {};
if (!window.webkit.messageHandlers) window.webkit.messageHandlers = {};
window.webkit.messageHandlers.ads = {
    postMessage(msg) {
        if (!msg || !msg.action) return;
        if (msg.action === 'interstitialRequest') {
            if (removeAdsOwned || msg.score < AD_MIN_SCORE) return;
            const count = _adsDeathCount() + 1;
            localStorage.setItem('tunnel_web_death_count', count);
            if (count % AD_DEATHS_PER_AD !== 0) return;
            if (Date.now() - _adsLastAdTime() < AD_MIN_INTERVAL_SEC * 1000) {
                // Wall-clock floor not yet clear - roll the counter back so
                // the next death re-tests instead of skipping this cycle
                // outright (constants.js/AdsManager.swift do the same).
                localStorage.setItem('tunnel_web_death_count', count - 1);
                return;
            }
            if (_interstitialReadyEvent) {
                localStorage.setItem('tunnel_web_last_ad_time', Date.now());
                _interstitialReadyEvent.makeGameManualInterstitialVisible();
            }
        } else if (msg.action === 'reviveRequest') {
            if (_continueReadyEvent) _continueReadyEvent.makeRewardedVisible();
            else window._tunlReviveDeclined();
        } else if (msg.action === 'shardsAdRequest') {
            if (_shardsReadyEvent) _shardsReadyEvent.makeRewardedVisible();
            else window._tunlShardsRewardDeclined();
        }
    },
};

}
