package com.theodoracatos.tunl

import android.app.Activity
import android.content.Context
import android.util.Log
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.OnUserEarnedRewardListener
import com.google.android.gms.ads.RequestConfiguration
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.ump.ConsentDebugSettings
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import com.google.firebase.analytics.FirebaseAnalytics

// Mirrors AdsManager.swift: interstitial shown every 3rd death AND at most once
// every MIN_INTERVAL_MS, never when Remove Ads is owned. Cadence state lives in
// SharedPreferences (not JS) since ad frequency is a platform/store concern kept
// out of the shared game layer, same rationale as the iOS version's UserDefaults
// use. See AdsManager.swift for why the wall-clock floor exists (runs here are
// only 20-36 seconds, so a death counter alone doesn't bound interruptions) and
// for why DEATHS_PER_AD is 3 and not 4: once the floor exists it already caps
// the bulk of players at MIN_INTERVAL_MS regardless of this value, so raising it
// only cost impressions from the most-engaged, longest-run segment.
class AdsManager(private val activity: Activity) {

    companion object {
        private const val DEATH_COUNT_KEY = "tunnel_death_count"
        private const val LAST_AD_TIME_KEY = "tunnel_last_ad_time"
        private const val DEATHS_PER_AD = 3
        // Hard wall-clock floor between interstitials, independent of the death
        // counter -- a burst of quick deaths satisfies the counter in well under a
        // minute, and this is what stops that stacking into back-to-back ads.
        private const val MIN_INTERVAL_MS = 120_000L
        // Runs scoring below this are instant faceplants (common in this fast-death
        // game) and shouldn't burn through the cadence counter or interrupt with an ad.
        private const val MIN_SCORE_FOR_AD = 25
        private const val TAG = "TunlAds"
    }

    // Wired up by MainActivity to pause/resume the WebView's Web Audio graph
    // so bgm doesn't play under the interstitial's own audio.
    var onWillPresent: (() -> Unit)? = null
    var onDidDismiss: (() -> Unit)? = null

    // Wired up by MainActivity to push the UMP SDK's privacy-options requirement
    // into the page (see AdsManager.swift for the iOS mirror) so the Settings
    // panel's PRIVACY CHOICES row only renders where Google's policy requires it.
    var onPrivacyOptionsRequiredChange: ((Boolean) -> Unit)? = null

    // Rewarded continue (TUNL 8.1). Wired up by MainActivity to push state.js's
    // rewardedAdReady flag (onRewardedAdReadyChange) and to resolve the JS-side
    // offer once a requestRevive() presentation settles (onRewardEarned ->
    // window._tunlReviveGranted, onReviveDeclined -> window._tunlReviveDeclined).
    // See AdsManager.swift for the iOS mirror and update.js's
    // die()/grantRevive()/declineRevive() for what each side of that does.
    var onRewardedAdReadyChange: ((Boolean) -> Unit)? = null
    var onRewardEarned: (() -> Unit)? = null
    var onReviveDeclined: (() -> Unit)? = null

    // Shards rewarded ad (Missions-drawer daily bonus, src/constants.js SHARDS_AD_REWARD).
    // Its own dedicated unit (admob_shards_rewarded_ad_unit_id), separate from the
    // continue unit above, so fill/eCPM report independently. Mirrors AdsManager.swift.
    // onShardsAdReadyChange -> state.js shardsAdReady, onShardsRewardEarned ->
    // window._tunlShardsRewardGranted, onShardsAdDeclined -> window._tunlShardsRewardDeclined.
    var onShardsAdReadyChange: ((Boolean) -> Unit)? = null
    var onShardsRewardEarned: (() -> Unit)? = null
    var onShardsAdDeclined: (() -> Unit)? = null

    private var interstitialAd: InterstitialAd? = null
    private var rewardedAd: RewardedAd? = null
    private var shardsRewardedAd: RewardedAd? = null
    // Set by the OnUserEarnedRewardListener passed to rewardedAd.show(), which (per
    // the SDK's own design) only ever fires on an actually-completed watch -- never
    // on a skip/close. Read back in the rewarded FullScreenContentCallback's
    // onAdDismissedFullScreenContent below to decide which of
    // onRewardEarned/onReviveDeclined to call, since dismissal is the one callback
    // that always fires, reward or not.
    private var rewardEarned = false
    private var shardsRewardEarned = false
    private var started = false
    private lateinit var consentInformation: ConsentInformation

    private val prefs by lazy {
        activity.getSharedPreferences("tunl_ads", Context.MODE_PRIVATE)
    }

    private val fullScreenContentCallback = object : FullScreenContentCallback() {
        override fun onAdShowedFullScreenContent() {
            onWillPresent?.invoke()
        }

        override fun onAdDismissedFullScreenContent() {
            onDidDismiss?.invoke()
            interstitialAd = null
            loadInterstitial()
        }

        override fun onAdFailedToShowFullScreenContent(adError: AdError) {
            Log.w(TAG, "Failed to present interstitial: ${adError.message}")
            onDidDismiss?.invoke()
            interstitialAd = null
            loadInterstitial()
        }
    }

    private val rewardedFullScreenContentCallback = object : FullScreenContentCallback() {
        override fun onAdShowedFullScreenContent() {
            onWillPresent?.invoke()
        }

        // The one callback guaranteed to fire either way (watched fully, closed
        // early, or the daily impression cap silently declined to show anything)
        // -- rewardEarned was only ever set true by the OnUserEarnedRewardListener
        // in requestRevive below, so this is the single point that resolves the JS
        // side no matter which of those actually happened.
        override fun onAdDismissedFullScreenContent() {
            onDidDismiss?.invoke()
            rewardedAd = null
            loadRewarded()
            if (rewardEarned) onRewardEarned?.invoke() else onReviveDeclined?.invoke()
        }

        override fun onAdFailedToShowFullScreenContent(adError: AdError) {
            Log.w(TAG, "Failed to present rewarded ad: ${adError.message}")
            onDidDismiss?.invoke()
            rewardedAd = null
            loadRewarded()
            onReviveDeclined?.invoke()
        }
    }

    private val shardsRewardedFullScreenContentCallback = object : FullScreenContentCallback() {
        override fun onAdShowedFullScreenContent() {
            onWillPresent?.invoke()
        }

        // Same guaranteed-either-way dismiss callback as the continue rewarded above --
        // rewardEarned is only set true by the OnUserEarnedRewardListener in
        // requestShardsAd, so this is the single point that resolves the JS side.
        override fun onAdDismissedFullScreenContent() {
            onDidDismiss?.invoke()
            shardsRewardedAd = null
            loadShardsRewarded()
            if (shardsRewardEarned) onShardsRewardEarned?.invoke() else onShardsAdDeclined?.invoke()
        }

        override fun onAdFailedToShowFullScreenContent(adError: AdError) {
            Log.w(TAG, "Failed to present shards rewarded ad: ${adError.message}")
            onDidDismiss?.invoke()
            shardsRewardedAd = null
            loadShardsRewarded()
            onShardsAdDeclined?.invoke()
        }
    }

    // Called once the WebView content is visible (see MainActivity's
    // onPageFinished) so the UMP consent form fires while the window is
    // focused, not during construction.
    fun start() {
        if (started) return
        started = true

        consentInformation = UserMessagingPlatform.getConsentInformation(activity)

        val paramsBuilder = ConsentRequestParameters.Builder()
        if (activity.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            // Forces the EEA consent form to appear on debug builds so the flow
            // can be visually verified from any real geography.
            val debugSettings = ConsentDebugSettings.Builder(activity)
                .setDebugGeography(ConsentDebugSettings.DebugGeography.DEBUG_GEOGRAPHY_EEA)
                .build()
            paramsBuilder.setConsentDebugSettings(debugSettings)
        }

        consentInformation.requestConsentInfoUpdate(
            activity,
            paramsBuilder.build(),
            {
                // Consent mode (Firebase Analytics, 8.3). AndroidManifest defaults
                // every signal to denied. Where GDPR does not apply the UMP SDK
                // never touches consent state, so lift analytics_storage/ad_storage
                // (and the two ad_* signals, harmless to restate) back to granted
                // here. EEA / UK / CH users are left alone: the UMP SDK forwards
                // their consent-form choice to Firebase Analytics directly. Needs
                // "consent mode for advertising purposes" turned on in the AdMob UI
                // (Privacy & messaging -> European regulations) for that forwarding
                // to reach Firebase.
                if (consentInformation.consentStatus ==
                    ConsentInformation.ConsentStatus.NOT_REQUIRED
                ) {
                    FirebaseAnalytics.getInstance(activity).setConsent(
                        mapOf(
                            FirebaseAnalytics.ConsentType.ANALYTICS_STORAGE to
                                FirebaseAnalytics.ConsentStatus.GRANTED,
                            FirebaseAnalytics.ConsentType.AD_STORAGE to
                                FirebaseAnalytics.ConsentStatus.GRANTED,
                            FirebaseAnalytics.ConsentType.AD_USER_DATA to
                                FirebaseAnalytics.ConsentStatus.GRANTED,
                            FirebaseAnalytics.ConsentType.AD_PERSONALIZATION to
                                FirebaseAnalytics.ConsentStatus.GRANTED,
                        )
                    )
                }
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { formError ->
                    if (formError != null) {
                        Log.w(TAG, "Consent form error: ${formError.message}")
                    }
                    onPrivacyOptionsRequiredChange?.invoke(
                        consentInformation.privacyOptionsRequirementStatus ==
                            ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
                    )
                    if (consentInformation.canRequestAds()) {
                        // TUNL carries a 9+ / PEGI 7 / USK 6 content rating and is
                        // sold as a kid-appropriate game - without this, the Mobile
                        // Ads SDK applies no content restriction of its own and ad
                        // networks can serve creative aimed at an adult audience.
                        // MAX_AD_CONTENT_RATING_PG allows G and PG creative
                        // ("suitable for most audiences with parental guidance");
                        // T and MA creative are filtered out.
                        MobileAds.setRequestConfiguration(
                            RequestConfiguration.Builder()
                                .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_PG)
                                .build()
                        )
                        MobileAds.initialize(activity) {
                            loadInterstitial()
                            loadRewarded()
                            loadShardsRewarded()
                        }
                    }
                }
            },
            { requestConsentError ->
                Log.w(TAG, "Consent info update failed: ${requestConsentError.message}")
            }
        )
    }

    // Reopens the same UMP consent form the player saw once at launch, invoked
    // from the Settings panel's PRIVACY CHOICES row (only shown when
    // onPrivacyOptionsRequiredChange reported true). Google requires this
    // re-entry point wherever the original form was required.
    fun showPrivacyOptionsForm(activity: Activity) {
        UserMessagingPlatform.showPrivacyOptionsForm(activity) { formError ->
            if (formError != null) {
                Log.w(TAG, "Privacy options form error: ${formError.message}")
            }
        }
    }

    fun requestInterstitial(removeAdsOwned: Boolean, score: Int) {
        if (score < MIN_SCORE_FOR_AD) return

        val count = prefs.getInt(DEATH_COUNT_KEY, 0) + 1
        prefs.edit().putInt(DEATH_COUNT_KEY, count).apply()

        if (removeAdsOwned || count % DEATHS_PER_AD != 0) return

        // Wall-clock floor. When it blocks, roll the counter back one so the very
        // next death re-tests instead of waiting out another full DEATHS_PER_AD
        // cycle on top of the cooldown -- otherwise the two rules compound and a
        // player can go many minutes past the intended cadence.
        val now = System.currentTimeMillis()
        val lastAd = prefs.getLong(LAST_AD_TIME_KEY, 0L)
        if (lastAd > 0L && now - lastAd < MIN_INTERVAL_MS) {
            prefs.edit().putInt(DEATH_COUNT_KEY, count - 1).apply()
            return
        }

        val ad = interstitialAd
        if (ad == null) {
            prefs.edit().putInt(DEATH_COUNT_KEY, count - 1).apply()
            loadInterstitial()
            return
        }
        prefs.edit().putLong(LAST_AD_TIME_KEY, now).apply()
        ad.fullScreenContentCallback = fullScreenContentCallback
        // MainActivity runs edge-to-edge with the system bars hidden (see its
        // setDecorFitsSystemWindows(false) + hideSystemBars()). The GMA SDK's
        // interstitial AdActivity is translucent, so it renders inside that same
        // immersive window instead of insetting itself -- on targetSdk 35+ that
        // pushes the ad's own close "X" under the display cutout or the landscape
        // 3-button nav bar, leaving it untappable and forcing a process kill to
        // escape (a known unresolved GMA issue on Android 15/16 edge-to-edge).
        // setImmersiveMode tells the SDK the host is immersive so it lays the ad
        // chrome out accordingly; MainActivity also drops immersive for the
        // duration of the ad (onWillPresent/onDidDismiss) as a belt-and-braces.
        // iOS is unaffected -- its interstitial respects the safe area natively.
        ad.setImmersiveMode(true)
        ad.show(activity)
    }

    private fun loadInterstitial() {
        val adUnitId = activity.getString(R.string.admob_interstitial_ad_unit_id)
        InterstitialAd.load(
            activity,
            adUnitId,
            AdRequest.Builder().build(),
            object : InterstitialAdLoadCallback() {
                override fun onAdLoaded(ad: InterstitialAd) {
                    interstitialAd = ad
                }

                override fun onAdFailedToLoad(adError: LoadAdError) {
                    Log.w(TAG, "Failed to load interstitial: ${adError.message}")
                    interstitialAd = null
                }
            }
        )
    }

    // Called from MainActivity's NativeBridge on {action: "reviveRequest"}
    // (src/input.js), which only ever fires from a tap on the continue-offer icon
    // (src/draw.js drawContinueOffer) -- itself only ever shown while
    // onRewardedAdReadyChange last reported true. Still presents defensively rather
    // than assuming that held: a stale flag just means an immediate decline instead
    // of a dangling JS-side wait.
    fun requestRevive(score: Int) {
        val ad = rewardedAd
        if (ad == null) {
            onReviveDeclined?.invoke()
            return
        }
        rewardEarned = false
        ad.fullScreenContentCallback = rewardedFullScreenContentCallback
        // Same edge-to-edge AdActivity fix as the interstitial above -- the
        // full-screen-ad immersive-mode issue isn't specific to one ad format.
        ad.setImmersiveMode(true)
        ad.show(activity, OnUserEarnedRewardListener {
            // Only ever called on an actually-completed watch (SDK guarantee) --
            // onAdDismissedFullScreenContent above still fires right after this and
            // is what actually resolves the JS side, this just flags which way.
            rewardEarned = true
        })
    }

    private fun loadRewarded() {
        val adUnitId = activity.getString(R.string.admob_rewarded_ad_unit_id)
        RewardedAd.load(
            activity,
            adUnitId,
            AdRequest.Builder().build(),
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) {
                    rewardedAd = ad
                    onRewardedAdReadyChange?.invoke(true)
                }

                override fun onAdFailedToLoad(adError: LoadAdError) {
                    Log.w(TAG, "Failed to load rewarded ad: ${adError.message}")
                    rewardedAd = null
                    onRewardedAdReadyChange?.invoke(false)
                }
            }
        )
    }

    // Called from MainActivity's NativeBridge on {action: "shardsAdRequest"}
    // (src/input.js's Missions-drawer bonus row), only ever fired while
    // onShardsAdReadyChange last reported true. Presents defensively anyway.
    fun requestShardsAd() {
        val ad = shardsRewardedAd
        if (ad == null) {
            onShardsAdDeclined?.invoke()
            return
        }
        shardsRewardEarned = false
        ad.fullScreenContentCallback = shardsRewardedFullScreenContentCallback
        ad.setImmersiveMode(true)
        ad.show(activity, OnUserEarnedRewardListener {
            shardsRewardEarned = true
        })
    }

    private fun loadShardsRewarded() {
        val adUnitId = activity.getString(R.string.admob_shards_rewarded_ad_unit_id)
        RewardedAd.load(
            activity,
            adUnitId,
            AdRequest.Builder().build(),
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) {
                    shardsRewardedAd = ad
                    onShardsAdReadyChange?.invoke(true)
                }

                override fun onAdFailedToLoad(adError: LoadAdError) {
                    Log.w(TAG, "Failed to load shards rewarded ad: ${adError.message}")
                    shardsRewardedAd = null
                    onShardsAdReadyChange?.invoke(false)
                }
            }
        )
    }
}
