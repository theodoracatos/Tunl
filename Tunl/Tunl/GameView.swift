import SwiftUI
import WebKit

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

        let webView = WKWebView(frame: .zero, configuration: config)
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
            GameView.killLongPress(in: webView)
        }

        return webView
    }

    private static func killLongPress(in view: UIView) {
        view.gestureRecognizers?
            .filter { $0 is UILongPressGestureRecognizer }
            .forEach { $0.isEnabled = false }
        view.subviews.forEach { killLongPress(in: $0) }
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    // MARK: - Haptic bridge

    class Coordinator: NSObject, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate {

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            GameView.killLongPress(in: webView)
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
