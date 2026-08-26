import StoreKit

// Non-consumable purchases via StoreKit 2. Entitlement state is the source of
// truth (re-derived from Transaction.currentEntitlements), not just cached
// locally, so a fresh install on the same Apple ID stays unlocked.
//
// Two products share this one manager (generalized from a single-product
// "Remove Ads" design when unlockAllShipsProductID was added): ownedProductIDs
// is a Set rather than a single Bool, and every function takes/reports a
// productID instead of assuming which one. removeAdsOwned/allShipsOwned below
// are just readable views onto that set, kept so call sites elsewhere (e.g.
// GameView's ads.requestInterstitial(removeAdsOwned:)) didn't need to change.
final class IAPManager {

    static let removeAdsProductID     = "remove_ads"
    static let unlockAllShipsProductID = "unlock_all_ships"
    static let allProductIDs = [removeAdsProductID, unlockAllShipsProductID]

    private(set) var ownedProductIDs: Set<String> = []
    var removeAdsOwned: Bool  { ownedProductIDs.contains(Self.removeAdsProductID) }
    var allShipsOwned: Bool  { ownedProductIDs.contains(Self.unlockAllShipsProductID) }
    var onUpdate: ((Set<String>) -> Void)?

    private var updatesTask: Task<Void, Never>?
    private var intentsTask: Task<Void, Never>?

    init() {
        updatesTask = Task { [weak self] in
            for await result in Transaction.updates {
                await self?.handle(result)
            }
        }
        // Handles taps on IAPs promoted on the App Store product page / search
        // results (App Store-Werbeaktion), which can arrive while the app is
        // launching rather than through purchase(productID:).
        intentsTask = Task { [weak self] in
            for await intent in PurchaseIntent.intents {
                await self?.purchase(intent.product)
            }
        }
    }

    deinit {
        updatesTask?.cancel()
        intentsTask?.cancel()
    }

    func refreshEntitlements() async {
        for await result in Transaction.currentEntitlements {
            await handle(result)
        }
        onUpdate?(ownedProductIDs)
    }

    func purchase(productID: String) async {
        do {
            let products = try await Product.products(for: [productID])
            guard let product = products.first else {
                print("IAP purchase: no product found for id \(productID) - check StoreKit Configuration is set on the scheme")
                return
            }
            await purchase(product)
        } catch {
            print("IAP purchase failed: \(error.localizedDescription)")
        }
    }

    private func purchase(_ product: Product) async {
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                await handle(verification)
            case .userCancelled:
                print("IAP purchase: user cancelled")
            case .pending:
                print("IAP purchase: pending (e.g. Ask to Buy)")
            @unknown default:
                print("IAP purchase: unknown result")
            }
        } catch {
            print("IAP purchase failed: \(error.localizedDescription)")
        }
    }

    func restore() async {
        try? await AppStore.sync()
        await refreshEntitlements()
    }

    private func handle(_ result: VerificationResult<Transaction>) async {
        guard case .verified(let transaction) = result else { return }
        guard Self.allProductIDs.contains(transaction.productID) else { return }
        ownedProductIDs.insert(transaction.productID)
        await transaction.finish()
        onUpdate?(ownedProductIDs)
    }
}
