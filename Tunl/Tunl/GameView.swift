import SwiftUI
import WebKit
import GameKit

struct GameView: UIViewRepresentable {

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Allow audio to play without requiring a user gesture each time
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        // Allow fetch() to load sibling files from the same bundle directory
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")

        config.userContentController.add(context.coordinator, name: "haptic")
        config.userContentController.add(context.coordinator, name: "gameCenter")
        config.userContentController.add(context.coordinator, name: "iap")
        config.userContentController.add(context.coordinator, name: "ads")

        context.coordinator.authenticateGameCenter()

        let webView = WKWebView(frame: .zero, configuration: config)
        context.coordinator.webView = webView
        webView.uiDelegate = context.coordinator
        webView.navigationDelegate = context.coordinator
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsLinkPreview = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 4/255, green: 4/255, blue: 10/255, alpha: 1)

        if let url = Bundle.main.url(forResource: "tunl", withExtension: "html") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }

        // Disable long-press recognizers after layout to suppress the selection loupe
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            GameView.killPressInteractions(in: webView)
        }

        return webView
    }

    static func killPressInteractions(in view: UIView) {
        // Remove interactions that produce the pill bubble
        view.interactions
            .filter { $0 is UIContextMenuInteraction || $0 is UITextInteraction }
            .forEach { view.removeInteraction($0) }
        if #available(iOS 16.0, *) {
            view.interactions
                .filter { $0 is UIEditMenuInteraction }
                .forEach { view.removeInteraction($0) }
        }
        // Also disable long-press gesture recognizers
        view.gestureRecognizers?
            .filter { $0 is UILongPressGestureRecognizer }
            .forEach { $0.isEnabled = false }
        view.subviews.forEach { killPressInteractions(in: $0) }
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    // MARK: - Haptic + Game Center bridge

    class Coordinator: NSObject, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate, GKGameCenterControllerDelegate {

        static let leaderboardID = "tunl_highscore"

        weak var webView: WKWebView?
        let iap = IAPManager()
        let ads = AdsManager()

        override init() {
            super.init()
            iap.onUpdate = { [weak self] owned in
                let json = "{\"removeAdsOwned\":\(owned)}"
                DispatchQueue.main.async {
                    self?.webView?.evaluateJavaScript("window._tunlNativeUpdate && window._tunlNativeUpdate(\(json))")
                }
            }
        }

        func authenticateGameCenter() {
            GKLocalPlayer.local.authenticateHandler = { [weak self] viewController, error in
                if let viewController {
                    self?.rootViewController()?.present(viewController, animated: true)
                } else if let error {
                    print("Game Center auth failed: \(error.localizedDescription)")
                }
            }
        }

        private func rootViewController() -> UIViewController? {
            UIApplication.shared.connectedScenes
                .compactMap { ($0 as? UIWindowScene)?.keyWindow }
                .first?.rootViewController
        }

        private func submitScore(_ score: Int) {
            guard GKLocalPlayer.local.isAuthenticated else { return }
            GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local,
                                       leaderboardIDs: [Coordinator.leaderboardID]) { error in
                if let error { print("Game Center score submit failed: \(error.localizedDescription)") }
            }
        }

        private func showLeaderboard() {
            guard GKLocalPlayer.local.isAuthenticated else { return }
            let vc = GKGameCenterViewController(leaderboardID: Coordinator.leaderboardID,
                                                 playerScope: .global, timeScope: .today)
            vc.gameCenterDelegate = self
            rootViewController()?.present(vc, animated: true)
        }

        func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
            gameCenterViewController.dismiss(animated: true)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            GameView.killPressInteractions(in: webView)
            Task { await self.iap.refreshEntitlements() }
            ads.start()
        }

        func webView(_ webView: WKWebView,
                     contextMenuConfigurationForElement elementInfo: WKContextMenuElementInfo,
                     completionHandler: @escaping (UIContextMenuConfiguration?) -> Void) {
            completionHandler(nil)
        }

        @available(iOS 16.0, *)
        func webView(_ webView: WKWebView,
                     editMenuForTextIn range: UITextRange,
                     suggestedActions: [UIMenuElement]) -> UIMenu? {
            return nil
        }
        func userContentController(_ controller: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            if message.name == "gameCenter" {
                guard let body = message.body as? [String: Any],
                      let action = body["action"] as? String else { return }
                switch action {
                case "submit":
                    if let score = body["score"] as? Int { submitScore(score) }
                case "show":
                    showLeaderboard()
                default: break
                }
                return
            }
            if message.name == "iap" {
                guard let body = message.body as? [String: Any],
                      let action = body["action"] as? String else { return }
                print("IAP message received: \(action)")
                switch action {
                case "purchase":
                    Task { await iap.purchaseRemoveAds() }
                case "restore":
                    Task { await iap.restore() }
                default: break
                }
                return
            }
            if message.name == "ads" {
                guard let body = message.body as? [String: Any],
                      let action = body["action"] as? String else { return }
                switch action {
                case "interstitialRequest":
                    let score = body["score"] as? Int ?? 0
                    ads.requestInterstitial(removeAdsOwned: iap.removeAdsOwned, score: score)
                default: break
                }
                return
            }
            guard message.name == "haptic", let type = message.body as? String else { return }
            switch type {
            case "heavy":   UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            case "medium":  UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            case "light":   UIImpactFeedbackGenerator(style: .light).impactOccurred()
            case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
            case "error":   UINotificationFeedbackGenerator().notificationOccurred(.error)
            default:        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            }
        }
    }
}
