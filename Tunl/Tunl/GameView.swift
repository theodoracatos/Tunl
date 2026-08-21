import SwiftUI
import WebKit
import GameKit
import AVFoundation

struct GameView: UIViewRepresentable {

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        // Without this, WKWebView audio defaults to the "ambient" session
        // category and is silenced by the hardware mute switch.
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("AVAudioSession setup failed: \(error.localizedDescription)")
        }

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
        config.userContentController.add(context.coordinator, name: "share")

        // Game Center Challenges (GKChallengeDefinition/GKAccessPoint.trigger...) need
        // iOS 26+ - tell the JS side up front so it only draws the CHALLENGE button on
        // devices that can actually use it, instead of showing a dead button everywhere.
        let challengeSupported: Bool = {
            if #available(iOS 26.0, *) { return true } else { return false }
        }()
        let capabilityScript = WKUserScript(
            source: "window._tunlChallengeSupported = \(challengeSupported);",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true)
        config.userContentController.addUserScript(capabilityScript)

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

    class Coordinator: NSObject, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate, GKGameCenterControllerDelegate, GKLocalPlayerListener {

        static let leaderboardID = "tunl_highscore"
        static let allTimeLeaderboardID = "tunl_highscore_alltime"

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
            ads.onWillPresent = { [weak self] in
                DispatchQueue.main.async {
                    self?.webView?.evaluateJavaScript("window._pauseAudioForAd && window._pauseAudioForAd()")
                }
            }
            ads.onDidDismiss = { [weak self] in
                DispatchQueue.main.async {
                    self?.webView?.evaluateJavaScript("window._resumeAudioAfterAd && window._resumeAudioAfterAd()")
                }
            }
            ads.onPrivacyOptionsRequiredChange = { [weak self] required in
                let json = "{\"privacyOptionsRequired\":\(required)}"
                DispatchQueue.main.async {
                    self?.webView?.evaluateJavaScript("window._tunlNativeUpdate && window._tunlNativeUpdate(\(json))")
                }
            }
            // TunlApp.swift's AppDelegate reactivates the *native* AVAudioSession on
            // this same notification, but that alone doesn't recover the WKWebView's
            // own AudioContext once WebKit has fully closed it after extended
            // backgrounding - kick the page's own revive path directly rather than
            // relying only on document.visibilitychange, which WKWebView doesn't
            // always fire when it's the host app (not the page) that backgrounded.
            NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,
                                                    object: nil, queue: .main) { [weak self] _ in
                self?.webView?.evaluateJavaScript("window._tunlResumeAudio && window._tunlResumeAudio()")
            }
        }

        deinit {
            NotificationCenter.default.removeObserver(self)
            GKLocalPlayer.local.unregisterListener(self)
        }

        func authenticateGameCenter() {
            GKLocalPlayer.local.authenticateHandler = { [weak self] viewController, error in
                guard let self else { return }
                if let viewController {
                    self.rootViewController()?.present(viewController, animated: true)
                } else if GKLocalPlayer.local.isAuthenticated {
                    // Needed to receive challenge-related callbacks below (a tap on
                    // "Play" in a friend's challenge notification, etc.) - without
                    // registering, those taps just launch the app with no route in.
                    GKLocalPlayer.local.register(self)
                    // Prime the death screen's rank line, so the first death of a
                    // session already has a standing to show and a baseline to compute
                    // the first delta against, instead of one blank run.
                    self.fetchWorldRank()
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
            // Same run's score goes to both boards: the recurring daily one and
            // the classic (never-resets) all-time one. One call, one round trip.
            GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local,
                                       leaderboardIDs: [Coordinator.leaderboardID,
                                                         Coordinator.allTimeLeaderboardID]) { [weak self] error in
                if let error {
                    print("Game Center score submit failed: \(error.localizedDescription)")
                    return
                }
                // Only after the submit lands, so the rank reflects the run that just
                // ended rather than the previous one.
                self?.fetchWorldRank()
            }
        }

        // Pulls the local player's standing on the daily board and the size of that
        // board, and hands both to the page for the death screen (src/draw.js right
        // column, via main.js _tunlNativeUpdate). No backend needed - GameKit already
        // knows both numbers; they were simply never asked for.
        private func fetchWorldRank() {
            guard GKLocalPlayer.local.isAuthenticated else { return }
            GKLeaderboard.loadLeaderboards(IDs: [Coordinator.leaderboardID]) { [weak self] boards, error in
                guard error == nil, let board = boards?.first else { return }
                // tunl_highscore is a *recurring* (daily) leaderboard, so GameKit already
                // scopes entries to the current occurrence and the time scope is not
                // applied - .allTime here means "this occurrence", not "all history".
                board.loadEntries(for: .global,
                                  timeScope: .allTime,
                                  range: NSRange(location: 1, length: 1)) { localEntry, _, totalPlayers, entriesError in
                    guard entriesError == nil, let localEntry else { return }
                    let json = "{\"worldRank\":\(localEntry.rank),\"worldRankTotal\":\(totalPlayers)}"
                    DispatchQueue.main.async {
                        self?.webView?.evaluateJavaScript("window._tunlNativeUpdate && window._tunlNativeUpdate(\(json))")
                    }
                }
            }
        }

        private func showLeaderboard() {
            guard GKLocalPlayer.local.isAuthenticated else { return }
            // Show the full leaderboard set rather than jumping straight to the
            // daily board, so players can switch between Daily and All-Time.
            let vc = GKGameCenterViewController(state: .leaderboards)
            vc.gameCenterDelegate = self
            rootViewController()?.present(vc, animated: true)
        }

        // Real Game Center Challenges (the redesigned system configured in App Store
        // Connect - see the "tunl_challenge_alltime" definition) only exist as of
        // iOS 26: GKChallengeDefinition and GKAccessPoint's trigger APIs aren't
        // available before that, and there's no older equivalent. Below iOS 26 the
        // CHALLENGE button doesn't even render (gated in src/draw.js via
        // window._tunlChallengeSupported), so this never gets called on those devices.
        @available(iOS 26.0, *)
        private func presentChallengeCreation() {
            guard GKLocalPlayer.local.isAuthenticated else { return }
            Task {
                // Presents Apple's own system UI for picking a challenge (from the
                // definitions configured in App Store Connect) and friends to send it
                // to - there's no custom UI to build here, GameKit owns this screen.
                await GKAccessPoint.shared.triggerForPlayTogether()
            }
        }

        // Hands the daily run card (src/share.js) to the system share sheet. The image
        // arrives as a base64 data: URL because that's the only way a canvas can cross
        // the WKScriptMessage boundary; a failed decode degrades to sharing just the
        // text rather than presenting nothing.
        private func presentShare(text: String, imageDataURL: String?) {
            var items: [Any] = []
            if let imageDataURL,
               let comma = imageDataURL.firstIndex(of: ","),
               let data = Data(base64Encoded: String(imageDataURL[imageDataURL.index(after: comma)...])),
               let image = UIImage(data: data) {
                items.append(image)
            }
            if !text.isEmpty { items.append(text) }
            guard !items.isEmpty, let root = rootViewController() else { return }

            let vc = UIActivityViewController(activityItems: items, applicationActivities: nil)
            // iPad presents this as a popover and hard-crashes without an anchor. The
            // game is full-screen canvas with no view to attach to, so anchor to the
            // bottom-centre of the root view, roughly where the SHARE button is drawn.
            if let pop = vc.popoverPresentationController {
                pop.sourceView = root.view
                pop.sourceRect = CGRect(x: root.view.bounds.midX,
                                        y: root.view.bounds.maxY - 40,
                                        width: 1, height: 1)
                pop.permittedArrowDirections = [.down]
            }
            root.present(vc, animated: true)
        }

        func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
            gameCenterViewController.dismiss(animated: true)
        }

        // Fires when the player taps "Play" on a (legacy-style) challenge notification
        // while this app can handle it. There's no custom screen for a specific
        // challenge to route to here, so just surface the leaderboards the challenge
        // was based on.
        func player(_ player: GKPlayer, wantsToPlay challenge: GKChallenge) {
            showLeaderboard()
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
                case "challenge":
                    if #available(iOS 26.0, *) { presentChallengeCreation() }
                default: break
                }
                return
            }
            if message.name == "share" {
                guard let body = message.body as? [String: Any] else { return }
                presentShare(text: body["text"] as? String ?? "",
                             imageDataURL: body["image"] as? String)
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
                case "privacyOptions":
                    ads.showPrivacyOptionsForm()
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
