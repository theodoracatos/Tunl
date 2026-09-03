import SwiftUI
import AVFoundation
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

    // Because Portrait isn't in the supported orientation list above, UIKit
    // never animates a rotation directly between LandscapeLeft and
    // LandscapeRight (it needs an intermediate orientation to notice the
    // change) - a long-standing system limitation. If the device is picked
    // up already flipped 180 degrees, or flipped while flat, the game would
    // stay upside down. Watch the accelerometer-driven device orientation
    // ourselves and flip the window manually to match.
    private var lastLandscapeOrientation: UIDeviceOrientation = .landscapeLeft

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

        UIDevice.current.beginGeneratingDeviceOrientationNotifications()
        NotificationCenter.default.addObserver(self, selector: #selector(deviceOrientationDidChange),
                                                name: UIDevice.orientationDidChangeNotification, object: nil)
        return true
    }

    // Without the "audio" background mode, iOS deactivates our AVAudioSession
    // when the app is backgrounded. Nothing reactivates it afterwards, so both
    // bgm and sfx stay silent once the app returns to the foreground - reactivate
    // it here (in addition to resuming the WKWebView's AudioContext, handled in
    // src/audio.js's visibilitychange listener).
    func applicationDidBecomeActive(_ application: UIApplication) {
        do {
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("AVAudioSession reactivation failed: \(error.localizedDescription)")
        }
    }

    @objc private func deviceOrientationDidChange() {
        let orientation = UIDevice.current.orientation
        guard orientation == .landscapeLeft || orientation == .landscapeRight,
              orientation != lastLandscapeOrientation else { return }
        lastLandscapeOrientation = orientation

        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ ($0 as? UIWindowScene)?.keyWindow }).first else { return }
        UIView.animate(withDuration: 0.3) {
            window.transform = window.transform.isIdentity ? CGAffineTransform(rotationAngle: .pi) : .identity
        }
    }
}
