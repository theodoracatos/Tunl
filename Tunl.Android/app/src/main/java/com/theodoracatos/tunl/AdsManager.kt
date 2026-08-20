package com.theodoracatos.tunl

import android.app.Activity
import android.content.Context
import android.util.Log
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.ump.ConsentDebugSettings
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform

// Mirrors AdsManager.swift: interstitial shown every 3rd death, never when
// Remove Ads is owned. Cadence state lives in SharedPreferences (not JS)
// since ad frequency is a platform/store concern kept out of the shared
// game layer, same rationale as the iOS version's UserDefaults use.
class AdsManager(private val activity: Activity) {

    companion object {
        private const val DEATH_COUNT_KEY = "tunnel_death_count"
        private const val DEATHS_PER_AD = 3
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

    private var interstitialAd: InterstitialAd? = null
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
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { formError ->
                    if (formError != null) {
                        Log.w(TAG, "Consent form error: ${formError.message}")
                    }
                    onPrivacyOptionsRequiredChange?.invoke(
                        consentInformation.privacyOptionsRequirementStatus ==
                            ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
                    )
                    if (consentInformation.canRequestAds()) {
                        MobileAds.initialize(activity) {
                            loadInterstitial()
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

        val ad = interstitialAd
        if (ad == null) {
            loadInterstitial()
            return
        }
        ad.fullScreenContentCallback = fullScreenContentCallback
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
}
