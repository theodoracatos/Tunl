package com.theodoracatos.tunl

import android.content.Context
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.google.android.gms.games.PlayGames
import org.json.JSONObject

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    private val leaderboardLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { }

    // Lazy, not constructed inline: field initializers run during Activity
    // construction, before attachBaseContext(), when `this` isn't yet a
    // valid Context -- BillingClient/MobileAds both dereference it immediately.
    private val billing by lazy { BillingManager(this) }
    private val ads by lazy { AdsManager(this) }

    // Shims window.webkit.messageHandlers.{gameCenter,iap,ads,haptic} so the game's
    // existing iOS bridge calls (see update.js/draw.js/input.js/systems.js) work
    // unchanged on Android. haptic gets its own bridge method since it posts a bare
    // string ('heavy'/'light'/...), not a JSON object like the other three.
    private val nativeShimJs = """
        (function() {
            if (!window.webkit) window.webkit = {};
            if (!window.webkit.messageHandlers) window.webkit.messageHandlers = {};
            window.webkit.messageHandlers.gameCenter = {
                postMessage: function(body) {
                    TunlNative.postMessage('gameCenter', JSON.stringify(body));
                }
            };
            window.webkit.messageHandlers.iap = {
                postMessage: function(body) {
                    TunlNative.postMessage('iap', JSON.stringify(body));
                }
            };
            window.webkit.messageHandlers.ads = {
                postMessage: function(body) {
                    TunlNative.postMessage('ads', JSON.stringify(body));
                }
            };
            window.webkit.messageHandlers.haptic = {
                postMessage: function(type) {
                    TunlNative.postHaptic(type);
                }
            };
        })();
    """.trimIndent()

    // Mirrors the iOS wrapper's WKScriptMessageHandler bridge: the game code calls
    // window.webkit.messageHandlers.{gameCenter,iap,ads}.postMessage({...}) unmodified
    // on both platforms, funneled here via the shim above.
    private inner class NativeBridge {
        @JavascriptInterface
        fun postMessage(handler: String, bodyJson: String) {
            val body = JSONObject(bodyJson)
            runOnUiThread {
                when (handler) {
                    "gameCenter" -> when (body.optString("action")) {
                        "submit" -> submitScore(body.optInt("score"))
                        "show" -> showLeaderboard()
                    }
                    "iap" -> when (body.optString("action")) {
                        "purchase" -> billing.purchaseRemoveAds(this@MainActivity)
                        "restore" -> billing.restore()
                    }
                    "ads" -> when (body.optString("action")) {
                        "interstitialRequest" ->
                            ads.requestInterstitial(billing.removeAdsOwned, body.optInt("score"))
                    }
                }
            }
        }

        @JavascriptInterface
        fun postHaptic(type: String) {
            runOnUiThread { triggerHaptic(type) }
        }
    }

    private val vibrator: Vibrator by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    // Mirrors the iOS bridge's UIImpactFeedbackGenerator/UINotificationFeedbackGenerator
    // mapping (see GameView.swift's "haptic" case). Amplitude control needs API 26+;
    // below that this falls back to duration-only vibration.
    private fun triggerHaptic(type: String) {
        if (!vibrator.hasVibrator()) return
        val (timings, amplitudes) = when (type) {
            "heavy" -> longArrayOf(0, 35) to intArrayOf(0, 255)
            "medium" -> longArrayOf(0, 20) to intArrayOf(0, 180)
            "light" -> longArrayOf(0, 12) to intArrayOf(0, 90)
            "success" -> longArrayOf(0, 12, 60, 18) to intArrayOf(0, 110, 0, 200)
            "error" -> longArrayOf(0, 45, 50, 45) to intArrayOf(0, 220, 0, 220)
            else -> longArrayOf(0, 20) to intArrayOf(0, 180)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(timings, -1)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()
        signIntoPlayGames()

        // Mirrors the iOS Coordinator's iap.onUpdate closure, which pushes
        // ownership changes into the page via window._tunlNativeUpdate.
        billing.onUpdate = { owned ->
            val json = "{\"removeAdsOwned\":$owned}"
            webView.evaluateJavascript("window._tunlNativeUpdate && window._tunlNativeUpdate($json)", null)
        }
        billing.start()

        // Mirrors the iOS Coordinator's ads.onWillPresent/onDidDismiss closures,
        // which pause/resume the page's Web Audio graph under the interstitial.
        ads.onWillPresent = { webView.evaluateJavascript("window._pauseAudioForAd && window._pauseAudioForAd()", null) }
        ads.onDidDismiss = { webView.evaluateJavascript("window._resumeAudioAfterAd && window._resumeAudioAfterAd()", null) }

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER
            setBackgroundColor(0xFF04040A.toInt())
            isHapticFeedbackEnabled = false
            // Swallow long-press so no text-selection magnifier appears -- the
            // Android analogue of the iOS wrapper's killPressInteractions().
            setOnLongClickListener { true }
            addJavascriptInterface(NativeBridge(), "TunlNative")
        }
        setContentView(webView)

        // Injected before tunl.html's own <script> tags run, so window.webkit
        // exists by the time the game code first checks for it. On WebView
        // versions too old to support document-start scripts, onPageFinished
        // below injects it a moment later instead -- the draw loop re-checks
        // for the bridge every frame, so the leaderboard button just appears
        // a beat late rather than being missing.
        val supportsDocumentStart = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        if (supportsDocumentStart) {
            WebViewCompat.addDocumentStartJavaScript(webView, nativeShimJs, setOf("*"))
        }

        // Serves the bundled assets over a synthetic https:// origin so relative
        // fetch()/script-tag loads (see audio.js's fetch('the_mountain.mp3')) work
        // the same way they do in a real browser, without legacy file:// access.
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? = assetLoader.shouldInterceptRequest(request.url)

            override fun onPageFinished(view: WebView, url: String?) {
                if (!supportsDocumentStart) view.evaluateJavascript(nativeShimJs, null)
                ads.start()
            }
        }

        webView.loadUrl("https://appassets.androidplatform.net/assets/tunl.html")
    }

    private fun signIntoPlayGames() {
        val signInClient = PlayGames.getGamesSignInClient(this)
        signInClient.isAuthenticated.addOnCompleteListener { task ->
            val authenticated = task.isSuccessful && task.result.isAuthenticated
            if (!authenticated) signInClient.signIn()
        }
    }

    private fun submitScore(score: Int) {
        if (score <= 0) return
        PlayGames.getLeaderboardsClient(this)
            .submitScore(getString(R.string.leaderboard_id), score.toLong())
    }

    private fun showLeaderboard() {
        PlayGames.getLeaderboardsClient(this)
            .getLeaderboardIntent(getString(R.string.leaderboard_id))
            .addOnSuccessListener { intent -> leaderboardLauncher.launch(intent) }
            .addOnFailureListener { e -> Log.w("TunlPlayGames", "Could not open leaderboard", e) }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    private fun hideSystemBars() {
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }
}
