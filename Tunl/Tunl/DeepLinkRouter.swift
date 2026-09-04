// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
import Foundation

// Bridges a Universal Link (flytunl.ch/play/... - a friend's shared run, see
// src/share.js shareRunUrl and the AASA file at flytunl-site/site/.well-known/
// apple-app-site-association) from AppDelegate, where iOS delivers it
// (application(_:continue:restorationHandler:), TunlApp.swift), to GameView's
// Coordinator, where the WKWebView that can actually act on it lives. The two
// don't otherwise know about each other, and on a cold launch the webview may
// not exist yet at the moment iOS delivers the link -- onURL stays nil until
// GameView.Coordinator registers a handler, so a link arriving first is held
// in pendingURL and drained the instant a handler shows up.
final class DeepLinkRouter {
    static let shared = DeepLinkRouter()
    private init() {}

    private var pendingURL: URL?

    var onURL: ((URL) -> Void)? {
        didSet {
            guard let onURL, let url = pendingURL else { return }
            pendingURL = nil
            onURL(url)
        }
    }

    func handle(_ url: URL) {
        if let onURL {
            onURL(url)
        } else {
            pendingURL = url
        }
    }
}
