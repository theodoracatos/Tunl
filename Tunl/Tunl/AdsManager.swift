import UIKit
import AppTrackingTransparency
import UserMessagingPlatform
import GoogleMobileAds
import FirebaseAnalytics

// Interstitial shown every 3rd death AND at most once every minInterval seconds,
// never when Remove Ads is owned. Cadence state lives in UserDefaults (not JS)
// since ad frequency is a platform/store concern kept out of the shared game layer.
//
// The death counter alone isn't a cadence: a good run in this game lasts only
// 20-36 real seconds (measured against a real daily seed, see constants.js's
// POISON_INTERVAL_SEC doc), so a pure every-Nth-death rule put a full-screen ad in
// front of engaged players roughly every 90 seconds -- worst for exactly the
// players deciding whether TUNL becomes a habit. The wall-clock floor below is
// what actually bounds interruption frequency; the counter just keeps short
// sessions ad-free. Once the floor exists, it's what protects fast/short-run
// players (max(3 * ~20-36s, 120s) is still 120s for the bulk of them, identical
// to deathsPerAd=4) -- so deathsPerAd only has to be tight enough to matter for
// long-run players *above* the floor, and going to 4 there was giving up real
// impressions from exactly the most-engaged segment for no corresponding gain
// among the players the floor was actually protecting. 3 recovers that without
// reopening the pre-floor problem this was meant to fix.
final class AdsManager: NSObject, FullScreenContentDelegate {

    static let interstitialAdUnitID = "ca-app-pub-4882203470005029/5351137825"
    // AdMob console -> Apps -> TUNL - Cave Flyer (iOS) -> Ad units -> "Continue Rewarded".
    static let rewardedAdUnitID = "ca-app-pub-4882203470005029/6198883271"
    // AdMob console -> Apps -> TUNL - Cave Flyer (iOS) -> Ad units -> "Shards Rewarded".
    // A second, dedicated rewarded unit (separate from "Continue Rewarded" above) so the
    // Missions-drawer daily shard bonus reports its own fill/eCPM.
    static let shardsRewardedAdUnitID = "ca-app-pub-4882203470005029/4182133565"
    private static let deathCountKey = "tunnel_death_count"
    private static let lastAdTimeKey = "tunnel_last_ad_time"
    private static let deathsPerAd = 3
    // Hard wall-clock floor between interstitials, independent of the death
    // counter -- a burst of quick deaths can satisfy the counter in well under a
    // minute, and this is what stops that from stacking into back-to-back ads.
    private static let minInterval: TimeInterval = 120
    // Runs scoring below this are instant faceplants (common in this fast-death
    // game) and shouldn't burn through the cadence counter or interrupt with an ad.
    private static let minScoreForAd = 25

    private var interstitial: InterstitialAd?
    private var rewarded: RewardedAd?
    // The Missions-drawer daily shard bonus (src/constants.js SHARDS_AD_REWARD). Its own
    // RewardedAd instance + unit, resolved independently of `rewarded` above by object
    // identity in the delegate callbacks below (both are RewardedAd, so `is` can't tell
    // them apart).
    private var shardsRewarded: RewardedAd?
    private var shardsRewardEarned = false
    // Set by the userDidEarnRewardHandler passed to rewarded.present(from:), which
    // (per the SDK's own design) only ever fires on an actually-completed watch --
    // never on a skip/close. Read back in adDidDismissFullScreenContent below to
    // decide which of onRewardEarned/onReviveDeclined to call, since dismissal is
    // the one callback that always fires, reward or not.
    private var rewardEarned = false
    private var started = false

    // Wired up by GameView.Coordinator to pause/resume the WKWebView's Web
    // Audio graph so bgm doesn't play under the interstitial's own audio.
    var onWillPresent: (() -> Void)?
    var onDidDismiss: (() -> Void)?

    // Wired up by GameView.Coordinator to push the UMP SDK's privacy-options
    // requirement into the page (see AdsManager.kt for the Android mirror) so
    // the Settings panel's PRIVACY CHOICES row only renders where Google's
    // policy requires it.
    var onPrivacyOptionsRequiredChange: ((Bool) -> Void)?

    // Rewarded continue (TUNL 8.1). Wired up by GameView.Coordinator to push
    // state.js's rewardedAdReady flag (onRewardedAdReadyChange) and to resolve
    // the JS-side offer once a requestRevive() presentation settles
    // (onRewardEarned -> window._tunlReviveGranted, onReviveDeclined ->
    // window._tunlReviveDeclined). See update.js's die()/commitDeath()/
    // grantRevive()/declineRevive() for what each side of that does.
    var onRewardedAdReadyChange: ((Bool) -> Void)?
    var onRewardEarned: (() -> Void)?
    var onReviveDeclined: (() -> Void)?

    // Shards rewarded ad (Missions-drawer daily bonus). Mirrors the continue trio above:
    // onShardsAdReadyChange -> state.js shardsAdReady, onShardsRewardEarned ->
    // window._tunlShardsRewardGranted, onShardsAdDeclined -> window._tunlShardsRewardDeclined.
    var onShardsAdReadyChange: ((Bool) -> Void)?
    var onShardsRewardEarned: (() -> Void)?
    var onShardsAdDeclined: (() -> Void)?

    // Called once the WKWebView content is visible (see GameView.swift's
    // webView(_:didFinish:)) so both the UMP consent form and Apple's ATT
    // prompt fire while the window is key/active, not during Coordinator
    // construction.
    //
    // GDPR (EEA/UK) consent is requested before Apple's ATT prompt and before
    // the Mobile Ads SDK starts, per Google's documented ordering - consent
    // gates ad requests independently of the ATT decision, so both must be
    // resolved before any ad is requested.
    func start() {
        guard !started else { return }
        started = true
        Task { @MainActor [weak self] in
            guard let self else { return }
            let parameters = RequestParameters()
            #if DEBUG
            // Forces the EEA consent form to appear on debug builds so the
            // flow can be visually verified from any real geography. Only
            // applies on a physical device once its hashed ID is listed
            // here - on first run without it, the SDK logs the ID to add
            // to the Xcode console (search "To enable debug mode").
            let debugSettings = DebugSettings()
            debugSettings.geography = .EEA
            debugSettings.testDeviceIdentifiers = []
            parameters.debugSettings = debugSettings
            #endif
            do {
                try await ConsentInformation.shared.requestConsentInfoUpdate(with: parameters)
                if let root = self.rootViewController() {
                    try await ConsentForm.loadAndPresentIfRequired(from: root)
                }
            } catch {
                print("AdsManager: consent update failed: \(error.localizedDescription)")
            }

            // Consent mode (Firebase Analytics, 8.3). Info.plist defaults every
            // signal to denied (ad_user_data / ad_personalization only within the
            // EEA). Where GDPR does not apply the UMP SDK never updates consent
            // state, so grant it back here. EEA / UK / CH users are left to the
            // UMP SDK, which interprets the consent-form choice and forwards it to
            // Firebase Analytics directly - provided "consent mode for advertising
            // purposes" is on in the AdMob UI (Privacy & messaging -> European
            // regulations). Firebase is configured in TunlApp before start() runs.
            if ConsentInformation.shared.consentStatus == .notRequired {
                Analytics.setConsent([
                    .analyticsStorage: .granted,
                    .adStorage: .granted,
                    .adUserData: .granted,
                    .adPersonalization: .granted,
                ])
            }

            self.onPrivacyOptionsRequiredChange?(
                ConsentInformation.shared.privacyOptionsRequirementStatus == .required
            )

            guard ConsentInformation.shared.canRequestAds else { return }

            _ = await ATTrackingManager.requestTrackingAuthorization()
            // TUNL carries a 9+ / PEGI 7 content rating and is sold as a
            // kid-appropriate game - without this, the Mobile Ads SDK applies no
            // content restriction of its own and ad networks can serve creative
            // aimed at an adult audience. .parentalGuidance allows G and PG
            // creative (roughly "suitable for most audiences with parental
            // guidance"); teen and mature creative are filtered out.
            // Must be set before start().
            MobileAds.shared.requestConfiguration.maxAdContentRating = GADMaxAdContentRating.parentalGuidance
            _ = await MobileAds.shared.start()
            await self.loadInterstitial()
            await self.loadRewarded()
            await self.loadShardsRewarded()
        }
    }

    // Reopens the same UMP consent form the player saw once at launch, invoked
    // from the Settings panel's PRIVACY CHOICES row (only shown when
    // onPrivacyOptionsRequiredChange reported true). Google requires this
    // re-entry point wherever the original form was required.
    func showPrivacyOptionsForm() {
        guard let root = rootViewController() else { return }
        Task { @MainActor in
            do {
                try await ConsentForm.presentPrivacyOptionsForm(from: root)
            } catch {
                print("AdsManager: privacy options form failed: \(error.localizedDescription)")
            }
        }
    }

    func requestInterstitial(removeAdsOwned: Bool, score: Int) {
        guard score >= Self.minScoreForAd else { return }

        let defaults = UserDefaults.standard
        let count = defaults.integer(forKey: Self.deathCountKey) + 1
        defaults.set(count, forKey: Self.deathCountKey)

        guard !removeAdsOwned, count % Self.deathsPerAd == 0 else { return }

        // Wall-clock floor. When it blocks, roll the counter back one so the very
        // next death re-tests instead of waiting out another full deathsPerAd
        // cycle on top of the cooldown -- otherwise the two rules compound and a
        // player can go many minutes past the intended cadence.
        let now = Date().timeIntervalSince1970
        let lastAd = defaults.double(forKey: Self.lastAdTimeKey)
        if lastAd > 0, now - lastAd < Self.minInterval {
            defaults.set(count - 1, forKey: Self.deathCountKey)
            return
        }

        guard let interstitial, let root = rootViewController() else {
            defaults.set(count - 1, forKey: Self.deathCountKey)
            Task { await loadInterstitial() }
            return
        }
        defaults.set(now, forKey: Self.lastAdTimeKey)
        interstitial.present(from: root)
    }

    private func loadInterstitial() async {
        do {
            interstitial = try await InterstitialAd.load(with: Self.interstitialAdUnitID, request: Request())
            interstitial?.fullScreenContentDelegate = self
        } catch {
            print("AdsManager: failed to load interstitial: \(error.localizedDescription)")
        }
    }

    // Called from GameView.Coordinator's "ads" message handler on {action:
    // "reviveRequest"} (src/input.js), which only ever fires from a tap on the
    // continue-offer icon (src/draw.js drawContinueOffer) -- itself only ever
    // shown while onRewardedAdReadyChange last reported true. still, present
    // defensively rather than assuming that held: a stale flag just means an
    // immediate decline instead of a dangling JS-side wait.
    func requestRevive(score: Int) {
        guard let rewarded, let root = rootViewController() else {
            onReviveDeclined?()
            return
        }
        rewardEarned = false
        rewarded.present(from: root) { [weak self] in
            // Only ever called on an actually-completed watch (SDK guarantee) --
            // adDidDismissFullScreenContent below still fires right after this and
            // is what actually resolves the JS side, this just flags which way.
            self?.rewardEarned = true
        }
    }

    private func loadRewarded() async {
        do {
            rewarded = try await RewardedAd.load(with: Self.rewardedAdUnitID, request: Request())
            rewarded?.fullScreenContentDelegate = self
            onRewardedAdReadyChange?(true)
        } catch {
            print("AdsManager: failed to load rewarded ad: \(error.localizedDescription)")
            onRewardedAdReadyChange?(false)
        }
    }

    // Called from GameView.Coordinator's "ads" handler on {action: "shardsAdRequest"}
    // (src/input.js's Missions-drawer bonus row), only ever fired while
    // onShardsAdReadyChange last reported true. Presents defensively anyway -- a stale
    // flag just means an immediate decline, not a dangling JS wait.
    func requestShardsAd() {
        guard let shardsRewarded, let root = rootViewController() else {
            onShardsAdDeclined?()
            return
        }
        shardsRewardEarned = false
        shardsRewarded.present(from: root) { [weak self] in
            self?.shardsRewardEarned = true
        }
    }

    private func loadShardsRewarded() async {
        do {
            shardsRewarded = try await RewardedAd.load(with: Self.shardsRewardedAdUnitID, request: Request())
            shardsRewarded?.fullScreenContentDelegate = self
            onShardsAdReadyChange?(true)
        } catch {
            print("AdsManager: failed to load shards rewarded ad: \(error.localizedDescription)")
            onShardsAdReadyChange?(false)
        }
    }

    private func rootViewController() -> UIViewController? {
        UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first?.rootViewController
    }

    func adWillPresentFullScreenContent(_ ad: FullScreenPresentingAd) {
        onWillPresent?()
    }

    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        onDidDismiss?()
        // Both rewarded formats are RewardedAd, so resolve by object identity rather
        // than `is`. The dismiss callback is the one guaranteed to fire either way
        // (watched fully, closed early, or the daily cap silently declined to show
        // anything) -- *RewardEarned was only ever set true by the userDidEarnReward
        // handler in the matching request*, so this is the single point that resolves
        // the JS side no matter which of those happened.
        if ad === shardsRewarded {
            shardsRewarded = nil
            Task { await loadShardsRewarded() }
            if shardsRewardEarned { onShardsRewardEarned?() } else { onShardsAdDeclined?() }
            return
        }
        if ad === rewarded {
            rewarded = nil
            Task { await loadRewarded() }
            if rewardEarned { onRewardEarned?() } else { onReviveDeclined?() }
            return
        }
        interstitial = nil
        Task { await loadInterstitial() }
    }

    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        onDidDismiss?()
        if ad === shardsRewarded {
            print("AdsManager: failed to present shards rewarded ad: \(error.localizedDescription)")
            shardsRewarded = nil
            Task { await loadShardsRewarded() }
            onShardsAdDeclined?()
            return
        }
        if ad === rewarded {
            print("AdsManager: failed to present rewarded ad: \(error.localizedDescription)")
            rewarded = nil
            Task { await loadRewarded() }
            onReviveDeclined?()
            return
        }
        print("AdsManager: failed to present interstitial: \(error.localizedDescription)")
        interstitial = nil
        Task { await loadInterstitial() }
    }
}
