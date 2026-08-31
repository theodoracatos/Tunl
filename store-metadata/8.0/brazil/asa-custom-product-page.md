# Apple Search Ads - Custom Product Page (Brazil)

A Custom Product Page (CPP) is an alternate version of the App Store product page you
link an ASA ad variation to. It is NOT a new campaign and has no budget of its own.

**A CPP can customize only:** screenshots (up to 10), the app preview poster frame, and
the promotional text. Name / subtitle / keywords / description stay identical to the
default pt-BR page.

## Promotional text (pt-BR, ad-angled) - 170 char limit

```
Ranking mundial todo dia. A mesma caverna pro Brasil e pro mundo inteiro. Segura pra subir, solta pra cair. Grátis e joga sem internet. Bora ver até onde você vai?
```

(159 chars - lead harder with the competitive + free/offline hooks than the default
promo text, because this audience already clicked an ad.)

## Screenshot set + order

The Brazil-native portrait frames from `Screenshots/iOS_8.0/pt-BR/portrait/`, copied
into `Screenshots/iOS_8.0/pt-BR/cpp/` (+ `cpp-6.5/`) **reordered to lead with the
ranking moment** for ad clickers. So `cpp/01..05` already are, in order:

1. DEAD + ranking mundial   ("Morra. Veja seu rank mundial.")   [was portrait/04]
2. title + daily hook        ("Uma caverna. Todo jogador. Todo dia.")   [portrait/01]
3. hold to climb / release   ("Segure, sobe. Solte, cai.")   [portrait/02]
4. power-ups                 ("Sete power-ups. Um corredor que so encolhe.")   [portrait/03]
5. 15 languages / no tutorial   [portrait/05]

## How to create it (Phase 5 / user, in App Store Connect)

1. ASC -> TUNL -> (left nav) Custom Product Pages -> add, name it e.g. "BR-ASA-ranking".
2. Set the pt-BR localization, upload the 5 screenshots in the order above (6.9" +
   6.5"), set the app preview poster, paste the promotional text above.
3. Save. ASC assigns a `ppid` and a deep link
   `https://apps.apple.com/br/app/idXXXXXXXXXX?ppid=<uuid>`.
4. In Apple Search Ads, create an **ad variation** on the existing Brazil campaign (or
   a new ad group inside it) that points at this CPP. Do not raise budget or bid here -
   the campaign spend is the user's call.
