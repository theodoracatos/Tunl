package com.theodoracatos.tunl

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.util.Base64
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
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.leaderboard.LeaderboardVariant
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

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
            window.webkit.messageHandlers.share = {
                postMessage: function(body) {
                    TunlNative.postMessage('share', JSON.stringify(body));
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
                    "share" -> shareRun(
                        body.optString("text"),
                        body.optString("image")
                    )
                    "ads" -> when (body.optString("action")) {
                        "interstitialRequest" ->
                            ads.requestInterstitial(billing.removeAdsOwned, body.optInt("score"))
                        "privacyOptions" -> ads.showPrivacyOptionsForm(this@MainActivity)
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
        requestAudioFocus()

        // Mirrors the iOS Coordinator's iap.onUpdate closure, which pushes
        // ownership changes into the page via window._tunlNativeUpdate.
        billing.onUpdate = { owned ->
            val json = "{\"removeAdsOwned\":$owned}"
            runJs("window._tunlNativeUpdate && window._tunlNativeUpdate($json)")
        }
        billing.start()

        // Mirrors the iOS Coordinator's ads.onWillPresent/onDidDismiss closures,
        // which pause/resume the page's Web Audio graph under the interstitial.
        ads.onWillPresent = { runJs("window._pauseAudioForAd && window._pauseAudioForAd()") }
        ads.onDidDismiss = { runJs("window._resumeAudioAfterAd && window._resumeAudioAfterAd()") }
        ads.onPrivacyOptionsRequiredChange = { required ->
            runJs("window._tunlNativeUpdate && window._tunlNativeUpdate({\"privacyOptionsRequired\":$required})")
        }

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

        // Android's system/gesture back button has no iOS equivalent (no hardware
        // back button exists there). Without this, back always exits the app
        // immediately, even while the canvas-drawn settings panel is open --
        // ask the page to close the panel first and only exit if none was open.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (isFinishing || isDestroyed) return
                webView.evaluateJavascript("window._tunlCloseSettingsIfOpen && window._tunlCloseSettingsIfOpen()") { result ->
                    if (result != "true") {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                        isEnabled = true
                    }
                }
            }
        })
    }

    override fun onPause() {
        // WebView timers (rAF, setInterval) and the page's AudioContext keep
        // running through Activity.onPause unless explicitly paused here --
        // iOS gets this for free from UIScene backgrounding WKWebView with it;
        // plain Android WebView does not.
        webView.onPause()
        webView.pauseTimers()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.resumeTimers()
    }

    // billing/ads callbacks are async SDK calls that can land after the user
    // backgrounds mid-purchase or mid-ad; guards against poking a WebView
    // whose Activity is already on its way out.
    private fun runJs(script: String) {
        if (isFinishing || isDestroyed) return
        webView.evaluateJavascript(script, null)
    }

    override fun onDestroy() {
        abandonAudioFocus()
        billing.end()
        super.onDestroy()
    }

    private var audioFocusRequest: AudioFocusRequest? = null

    // Chromium's WebView, unlike iOS's WKWebView (backed by AVAudioSession),
    // never requests Android audio focus for Web Audio API playback -- without
    // this, TUNL's music/sfx keep playing over phone call ringtones and other
    // apps' audio with no ducking at all. Reuses the same pause/resume JS hooks
    // already wired up for ads.onWillPresent/onDidDismiss above.
    private fun requestAudioFocus() {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val listener = AudioManager.OnAudioFocusChangeListener { focusChange ->
            when (focusChange) {
                AudioManager.AUDIOFOCUS_LOSS,
                AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
                AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK ->
                    runJs("window._pauseAudioForAd && window._pauseAudioForAd()")
                AudioManager.AUDIOFOCUS_GAIN ->
                    runJs("window._resumeAudioAfterAd && window._resumeAudioAfterAd()")
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
            val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attributes)
                .setOnAudioFocusChangeListener(listener)
                .build()
            audioFocusRequest = request
            audioManager.requestAudioFocus(request)
        } else {
            @Suppress("DEPRECATION")
            audioManager.requestAudioFocus(listener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
        }
    }

    private fun abandonAudioFocus() {
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioFocusRequest?.let {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) audioManager.abandonAudioFocusRequest(it)
        }
    }

    private fun signIntoPlayGames() {
        val signInClient = PlayGames.getGamesSignInClient(this)
        signInClient.isAuthenticated.addOnCompleteListener { task ->
            val authenticated = task.isSuccessful && task.result.isAuthenticated
            if (!authenticated) signInClient.signIn()
            // Prime the death screen's rank line either way: already-signed-in players
            // get it immediately, and a fresh sign-in resolves before the first death in
            // practice. Without this the first death of a session has no standing to show
            // and no baseline to compute the first delta against.
            else fetchWorldRank()
        }
    }

    private fun submitScore(score: Int) {
        if (score <= 0) return
        PlayGames.getLeaderboardsClient(this)
            .submitScore(getString(R.string.leaderboard_id), score.toLong())
            // Only after the submit lands, so the rank reflects the run that just ended
            // rather than the previous one. Mirrors GameView.swift's submitScore.
            .addOnCompleteListener { fetchWorldRank() }
    }

    // Mirrors GameView.swift's fetchWorldRank: pulls the player's standing on the daily
    // board plus that board's size and hands both to the page for the death screen
    // (src/draw.js right column, via main.js _tunlNativeUpdate). No backend needed --
    // Play Games already knows both numbers.
    //
    // loadLeaderboardMetadata with forceReload=true is one round trip for both values:
    // a Leaderboard carries a LeaderboardVariant per (time span, collection) pair, and
    // each variant exposes the player's rank *and* the total number of scores. Fetching
    // the score and the count separately would be two calls for the same data.
    private fun fetchWorldRank() {
        PlayGames.getLeaderboardsClient(this)
            .loadLeaderboardMetadata(getString(R.string.leaderboard_id), true)
            .addOnSuccessListener { data ->
                val variant = data.get()?.variants?.firstOrNull {
                    it.timeSpan == LeaderboardVariant.TIME_SPAN_DAILY &&
                        it.collection == LeaderboardVariant.COLLECTION_PUBLIC
                } ?: return@addOnSuccessListener
                // hasPlayerInfo() is false until this player has a score on this board's
                // current daily occurrence; rank would otherwise read as a placeholder.
                if (!variant.hasPlayerInfo()) return@addOnSuccessListener
                val rank = variant.playerRank
                val total = variant.numScores
                if (rank <= 0L) return@addOnSuccessListener
                runJs(
                    "window._tunlNativeUpdate && window._tunlNativeUpdate(" +
                        "{\"worldRank\":$rank,\"worldRankTotal\":$total})"
                )
            }
            .addOnFailureListener { e -> Log.w("TunlPlayGames", "Could not load rank", e) }
    }

    // Mirrors GameView.swift's presentShare: hands the daily run card (src/share.js) to
    // the system share sheet. The image arrives as a base64 data: URL because that's the
    // only way a canvas can cross the JavascriptInterface boundary, and Android's
    // ACTION_SEND needs a content:// URI rather than raw bytes, so it's written to
    // cacheDir and exposed through the FileProvider declared in AndroidManifest.xml.
    // A failed decode degrades to sharing just the text rather than doing nothing.
    private fun shareRun(text: String, imageDataUrl: String?) {
        val intent = Intent(Intent.ACTION_SEND).apply { type = "text/plain" }
        if (text.isNotEmpty()) intent.putExtra(Intent.EXTRA_TEXT, text)

        val base64 = imageDataUrl?.substringAfter(",", "")
        if (!base64.isNullOrEmpty()) {
            try {
                val bytes = Base64.decode(base64, Base64.DEFAULT)
                val dir = File(cacheDir, "share").apply { mkdirs() }
                // Fixed filename: the card is transient, and reusing it keeps the cache
                // from growing by one PNG per share for the life of the install.
                val file = File(dir, "tunl-run.png")
                FileOutputStream(file).use { it.write(bytes) }
                val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
                intent.type = "image/png"
                intent.putExtra(Intent.EXTRA_STREAM, uri)
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } catch (e: Exception) {
                Log.w("TunlShare", "Could not attach run card", e)
            }
        }
        startActivity(Intent.createChooser(intent, null))
    }

    private fun showLeaderboard() {
        // Unlike Game Center (which needed a second, Classic leaderboard resource for
        // an all-time view - see GameView.swift's tunl_highscore_alltime), Play Games
        // leaderboards are a single resource with Daily/Weekly/All-time built into the
        // native leaderboard screen itself, switchable by the player without leaving it.
        // Default to all-time so the persistent record is what players see first.
        PlayGames.getLeaderboardsClient(this)
            .getLeaderboardIntent(
                getString(R.string.leaderboard_id),
                LeaderboardVariant.TIME_SPAN_ALL_TIME,
                LeaderboardVariant.COLLECTION_PUBLIC
            )
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
