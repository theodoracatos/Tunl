import SwiftUI

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
        UIDevice.current.beginGeneratingDeviceOrientationNotifications()
        NotificationCenter.default.addObserver(self, selector: #selector(deviceOrientationDidChange),
                                                name: UIDevice.orientationDidChangeNotification, object: nil)
        return true
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
