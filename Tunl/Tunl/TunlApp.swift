import SwiftUI
import FirebaseCore
import FirebaseAnalytics

@main
struct TunlApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .statusBarHidden()
        }
    }
}

// Without this, system-presented UI outside our view hierarchy (e.g. the
// StoreKit purchase confirmation sheet) queries the app delegate for
// supported orientations and falls back to portrait-native layout, which
// then renders sideways when squeezed into our landscape-locked window.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        .landscape
    }

    // Until 18.6.3 an observer here flipped the window by 180 degrees on every
    // landscape change, for a UIKit that would not rotate directly between
    // LandscapeLeft and LandscapeRight. UIKit does rotate itself (iOS 27 sims,
    // 2026-10-07), so the toggle rotated a second time and left the game upside
    // down after turning the phone through portrait. A state-derived flip was tried
    // for 19.0 and failed on the iPhone Duo: unfolded, its device orientation is 90
    // degrees from the interface's (held landscape it reports portrait), so no rule
    // built on UIDevice.orientation can tell when the window is wrong. Leave the
    // rotation to UIKit; .landscape above allows both sides.

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Analytics-only: no Firebase Auth/Firestore/Crashlytics wired up. This
        // exists solely so first_open reaches Google Analytics/Firebase, which
        // is what Google Ads' iOS Download conversion action imports as its
        // install signal -- there's no native Apple App Store conversion
        // source in Google Ads, only Google Play, GA4/Firebase, or a
        // third-party MMP, and third-party MMPs don't feed bidding-optimization
        // data back to Google Ads. Must run before anything else touches Firebase.
        FirebaseApp.configure()
        // GoogleService-Info.plist ships with IS_ANALYTICS_ENABLED=false (Firebase's
        // default for freshly-registered apps until something explicitly flips it) --
        // that flag gates collection at the SDK level regardless of the linked GA4
        // property being active, so first_open would never leave the device without
        // this override. Force it on in code instead of trusting the downloaded plist.
        //
        // Collection being enabled is not the same as data leaving the device: as
        // of 8.3 consent mode gates it. Info.plist defaults every consent signal to
        // denied; AdsManager.start() grants it for non-EEA users and lets the UMP
        // SDK forward the EEA consent-form choice.
        Analytics.setAnalyticsCollectionEnabled(true)
        return true
    }

    // Universal Link handoff (flytunl.ch/play/... - a friend's shared run, see
    // src/share.js shareRunUrl, the Associated Domains entitlement, and the AASA
    // file at flytunl-site/site/.well-known/apple-app-site-association). Fires
    // for both a cold launch via the link and a warm/backgrounded app being
    // brought forward by one -- DeepLinkRouter hands it to GameView's Coordinator,
    // which reloads the webview with the link's query string appended so the
    // page's existing ?d=/?g=/?s= parsing (src/web.js) picks the run up exactly
    // as the web build would.
    func application(_ application: UIApplication,
                      continue userActivity: NSUserActivity,
                      restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
              let url = userActivity.webpageURL else { return false }
        DeepLinkRouter.shared.handle(url)
        return true
    }
}
