import UIKit
import AppTrackingTransparency
import UserMessagingPlatform
import GoogleMobileAds

// Interstitial shown every 3rd death, never when Remove Ads is owned. Cadence
// state lives in UserDefaults (not JS) since ad frequency is a platform/store
// concern kept out of the shared game layer.
final class AdsManager: NSObject, FullScreenContentDelegate {

    static let interstitialAdUnitID = "ca-app-pub-3940256099942544/4411468910"
    private static let deathCountKey = "tunnel_death_count"
    private static let deathsPerAd = 3
    // Runs scoring below this are instant faceplants (common in this fast-death
    // game) and shouldn't burn through the cadence counter or interrupt with an ad.
    private static let minScoreForAd = 10

    private var interstitial: InterstitialAd?
    private var started = false

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

            guard ConsentInformation.shared.canRequestAds else { return }

            ATTrackingManager.requestTrackingAuthorization { [weak self] _ in
                DispatchQueue.main.async {
                    MobileAds.shared.start(completionHandler: nil)
                    Task { await self?.loadInterstitial() }
                }
            }
        }
    }

    func requestInterstitial(removeAdsOwned: Bool, score: Int) {
        guard score >= Self.minScoreForAd else { return }

        let defaults = UserDefaults.standard
        let count = defaults.integer(forKey: Self.deathCountKey) + 1
        defaults.set(count, forKey: Self.deathCountKey)

        guard !removeAdsOwned, count % Self.deathsPerAd == 0 else { return }

        guard let interstitial, let root = rootViewController() else {
            Task { await loadInterstitial() }
            return
        }
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

    private func rootViewController() -> UIViewController? {
        UIApplication.shared.connectedScenes
            .compactMap { ($0 as? UIWindowScene)?.keyWindow }
            .first?.rootViewController
    }

    func adDidDismissFullScreenContent(_ ad: FullScreenPresentingAd) {
        interstitial = nil
        Task { await loadInterstitial() }
    }

    func ad(_ ad: FullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        print("AdsManager: failed to present interstitial: \(error.localizedDescription)")
        interstitial = nil
        Task { await loadInterstitial() }
    }
}
