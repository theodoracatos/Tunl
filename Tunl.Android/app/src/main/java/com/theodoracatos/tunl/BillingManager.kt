package com.theodoracatos.tunl

import android.app.Activity
import android.content.Context
import android.util.Log
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClient.ProductType
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.acknowledgePurchase
import com.android.billingclient.api.queryProductDetails
import com.android.billingclient.api.queryPurchasesAsync
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

// Mirrors IAPManager.swift: a single non-consumable "Remove Ads" purchase via
// Google Play Billing. Ownership is always re-derived from queryPurchasesAsync
// rather than trusted from local cache alone, so a fresh install signed into
// the same Google account stays unlocked.
class BillingManager(context: Context) {

    companion object {
        const val REMOVE_ADS_PRODUCT_ID = "remove_ads"
        private const val TAG = "TunlBilling"
    }

    var removeAdsOwned: Boolean = false
        private set

    var onUpdate: ((Boolean) -> Unit)? = null

    private var removeAdsDetails: ProductDetails? = null
    private val scope = CoroutineScope(Dispatchers.Main)

    private val purchasesUpdatedListener = PurchasesUpdatedListener { billingResult, purchases ->
        if (billingResult.responseCode == BillingResponseCode.OK && purchases != null) {
            scope.launch { purchases.forEach { handlePurchase(it) } }
        } else if (billingResult.responseCode != BillingResponseCode.USER_CANCELED) {
            Log.w(TAG, "Purchase update failed: ${billingResult.debugMessage}")
        }
    }

    private val billingClient = BillingClient.newBuilder(context)
        .setListener(purchasesUpdatedListener)
        .enablePendingPurchases(
            PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
        )
        .enableAutoServiceReconnection()
        .build()

    fun start() {
        billingClient.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                if (billingResult.responseCode == BillingResponseCode.OK) {
                    scope.launch {
                        queryProductDetails()
                        refreshEntitlements()
                    }
                } else {
                    Log.w(TAG, "Billing setup failed: ${billingResult.debugMessage}")
                }
            }

            override fun onBillingServiceDisconnected() {
                // enableAutoServiceReconnection() retries automatically.
            }
        })
    }

    // Mirrors IAPManager.swift's deinit, which cancels its background tasks.
    // BillingClient explicitly documents that endConnection() should be called
    // once the client is done with it to release the service binding.
    fun end() {
        scope.cancel()
        billingClient.endConnection()
    }

    private suspend fun queryProductDetails() {
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                listOf(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(REMOVE_ADS_PRODUCT_ID)
                        .setProductType(ProductType.INAPP)
                        .build()
                )
            )
            .build()
        val result = billingClient.queryProductDetails(params)
        if (result.billingResult.responseCode == BillingResponseCode.OK) {
            removeAdsDetails = result.productDetailsList?.firstOrNull()
            if (removeAdsDetails == null) {
                Log.w(TAG, "No product found for id $REMOVE_ADS_PRODUCT_ID - check it's configured in Play Console")
            }
        }
    }

    suspend fun refreshEntitlements() {
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(ProductType.INAPP)
            .build()
        val result = billingClient.queryPurchasesAsync(params)
        if (result.billingResult.responseCode == BillingResponseCode.OK) {
            result.purchasesList.forEach { handlePurchase(it) }
        }
    }

    private var purchaseInFlight = false

    // Mirrors IAPManager.swift's purchaseRemoveAds(), which re-fetches product
    // details fresh on every tap rather than trusting a one-time preload -- if
    // the initial queryProductDetails() in start() hasn't finished yet (slow
    // network, or tapping right after cold launch), the cached details would
    // be null and the button would silently do nothing. purchaseInFlight guards
    // against a double-tap launching two overlapping fetch-then-purchase
    // sequences while the cache is still empty.
    fun purchaseRemoveAds(activity: Activity) {
        val cached = removeAdsDetails
        if (cached != null) {
            launchPurchaseFlow(activity, cached)
            return
        }
        if (purchaseInFlight) return
        purchaseInFlight = true
        scope.launch {
            try {
                queryProductDetails()
            } finally {
                // Reset even if queryProductDetails() throws (network/IPC error),
                // otherwise purchaseInFlight sticks true and every future tap
                // silently no-ops for the rest of the process's lifetime.
                purchaseInFlight = false
            }
            val details = removeAdsDetails
            if (details == null) {
                Log.w(TAG, "purchaseRemoveAds: no product found for id $REMOVE_ADS_PRODUCT_ID")
                return@launch
            }
            launchPurchaseFlow(activity, details)
        }
    }

    private fun launchPurchaseFlow(activity: Activity, details: ProductDetails) {
        val offerToken = details.oneTimePurchaseOfferDetails?.offerToken ?: return
        val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(details)
            .setOfferToken(offerToken)
            .build()
        val flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(productParams))
            .build()
        billingClient.launchBillingFlow(activity, flowParams)
    }

    fun restore() {
        scope.launch { refreshEntitlements() }
    }

    private suspend fun handlePurchase(purchase: Purchase) {
        if (!purchase.products.contains(REMOVE_ADS_PRODUCT_ID)) return
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return
        setOwned(true)
        if (!purchase.isAcknowledged) {
            val ackParams = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.purchaseToken)
                .build()
            billingClient.acknowledgePurchase(ackParams)
        }
    }

    private fun setOwned(owned: Boolean) {
        if (owned == removeAdsOwned) return
        removeAdsOwned = owned
        onUpdate?.invoke(owned)
    }
}
