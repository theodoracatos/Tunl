# TUNL 8.0 - Brazil content set (Phase 4)

Brazil gets its own set, not a translation. Angles chosen for the market:

- **Free / light / plays without wi-fi** - Brazilian mobile users are data-, storage-
  and price-sensitive. Lead with "grátis, leve, joga sem internet".
- **World ranking + beating your friends** - competitive mobile culture (Free Fire,
  FIFA). Lead with "ranking mundial" and the crash-screen rank moment.
- **The daily shared cave as a WhatsApp ritual** - strong share culture. "Uma caverna
  por dia, a mesma pro mundo, boa pra mandar no grupo do zap."
- **Casual BR register** - "segura", "vicia", "bora", "a galera", "manda no grupo".
  Not European-Portuguese phrasing ("mantém premido", "telemóvel", etc).

## Four targets - all prepared, NOTHING activated or uploaded

| Target | Where the assets are | Status |
|---|---|---|
| 1. App Store listing (BR storefront) | `store-metadata/8.0/ios/pt-BR/` | Brazil-native copy done (all 6 fields). Screenshots: `Screenshots/iOS_8.0/pt-BR/portrait{,-6.5}/`. App preview: `Screenshots/iOS_8.0/pt-BR/app-preview-6.5.mp4` / `-6.9.mp4` |
| 2. Play Console listing (BR storefront) | `store-metadata/8.0/android/pt-BR/` | Brazil-native copy done. Screenshots: `Screenshots/Android_8.0/pt-BR/phone/`. YouTube: `https://youtu.be/7CJsx8_fkQ0` |
| 3. Apple Search Ads - Custom Product Page | `asa-custom-product-page.md` + `Screenshots/iOS_8.0/pt-BR/cpp/` | CPP plan + ad-angled promo text + reordered screenshot set. NOT a new campaign. |
| 4. Google Ads / UAC - creative pack | `uac/` | 5 headlines, 5 descriptions (pt-BR), 3 image ratios. Package only - not uploaded, no asset group created, no budget. |

## What still needs the user (Phase 5 / console work)

- Create the ASA Custom Product Page in App Store Connect (assigns the `ppid`), attach
  the screenshots + promo text below, then reference it from an ASA ad variation.
- The pt-BR App Store listing already exists as a localization; this just updates its
  text + media to 8.0.
- Nothing here sets a budget, activates a campaign, or confirms a bid.
