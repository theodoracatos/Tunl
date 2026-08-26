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

// Mirrors IAPManager.swift: non-consumable purchases via Google Play Billing.
// Ownership is always re-derived from queryPurchasesAsync rather than trusted
// from local cache alone, so a fresh install signed into the same Google
// account stays unlocked.
//
// Two products share this one manager (generalized from a single-product
// "Remove Ads" design when UNLOCK_ALL_SHIPS_PRODUCT_ID was added): ownership
// is a Set rather than a single Bool, and every function takes/reports a
// productId instead of assuming which one. removeAdsOwned below is a readable
// view onto that set, kept so the call site in MainActivity (ads.requestInterstitial)
// didn't need to change.
class BillingManager(context: Context) {

    companion object {
        const val REMOVE_ADS_PRODUCT_ID = "remove_ads"
        const val UNLOCK_ALL_SHIPS_PRODUCT_ID = "unlock_all_ships"
        val ALL_PRODUCT_IDS = listOf(REMOVE_ADS_PRODUCT_ID, UNLOCK_ALL_SHIPS_PRODUCT_ID)
        private const val TAG = "TunlBilling"
    }

    var ownedProductIds: Set<String> = emptySet()
        private set
    val removeAdsOwned: Boolean get() = ownedProductIds.contains(REMOVE_ADS_PRODUCT_ID)
    val allShipsOwned: Boolean get() = ownedProductIds.contains(UNLOCK_ALL_SHIPS_PRODUCT_ID)

    var onUpdate: ((Set<String>) -> Unit)? = null

    private val productDetails = mutableMapOf<String, ProductDetails>()
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
                ALL_PRODUCT_IDS.map { id ->
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(id)
                        .setProductType(ProductType.INAPP)
                        .build()
                }
            )
            .build()
        val result = billingClient.queryProductDetails(params)
        if (result.billingResult.responseCode == BillingResponseCode.OK) {
            result.productDetailsList?.forEach { productDetails[it.productId] = it }
            ALL_PRODUCT_IDS.forEach { id ->
                if (!productDetails.containsKey(id)) {
                    Log.w(TAG, "No product found for id $id - check it's configured in Play Console")
                }
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

    // Mirrors IAPManager.swift's purchase(productID:), which re-fetches product
    // details fresh on every tap rather than trusting a one-time preload -- if
    // the initial queryProductDetails() in start() hasn't finished yet (slow
    // network, or tapping right after cold launch), the cached details would
    // be missing and the button would silently do nothing. purchaseInFlight
    // guards against a double-tap launching two overlapping fetch-then-purchase
    // sequences while the cache is still empty.
    fun purchase(productId: String, activity: Activity) {
        val cached = productDetails[productId]
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
            val details = productDetails[productId]
            if (details == null) {
                Log.w(TAG, "purchase: no product found for id $productId")
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
        val matched = purchase.products.firstOrNull { ALL_PRODUCT_IDS.contains(it) } ?: return
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return
        setOwned(ownedProductIds + matched)
        if (!purchase.isAcknowledged) {
            val ackParams = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.purchaseToken)
                .build()
            billingClient.acknowledgePurchase(ackParams)
        }
    }

    private fun setOwned(owned: Set<String>) {
        if (owned == ownedProductIds) return
        ownedProductIds = owned
        onUpdate?.invoke(owned)
    }
}
