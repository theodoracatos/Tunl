# Pending: Russian App Store listing (ru) - apply with the next iOS version after 19.5

Queued 2026-10-11 (user OK). 19.5 was WAITING_FOR_REVIEW, which locks name/subtitle (appInfo) and keywords (version).
Apply in App Store Connect, locale `ru`, then move this file into that version's `store-metadata/<version>/` folder.

## Why

Russia gave 8 of 21 iOS downloads (11.09.-10.10.2026), all organic App Store search, with no ads.
iTunes search API (country=ru, 2026-10-11): TUNL ranks 1 only for its own name ("tunl", "полёт в пещере"),
22 for "пещера", and is outside the top 200 for "самолет игра", "самолёт", "аркада", "игры без интернета",
"flappy", "туннель". The name and subtitle spend characters on words nobody searches ("Тапни и лети"), and
the keywords carry weak filler ("одно", "касание", "палец").

## Current (live in 19.4)

| Field | Value | Length |
|---|---|---|
| Name | TUNL: Полёт в пещере | 20/30 |
| Subtitle | Тапни и лети. Пещера дня | 24/30 |
| Keywords | вертолет,коптер,туннель,самолет,джет,флаппи,одно,касание,палец,бесконечная,реакция,ретро,аркада | 95/100 |

## New

| Field | Value | Length |
|---|---|---|
| Name | TUNL: Самолёт в пещере | 22/30 |
| Subtitle | Аркада офлайн: пещера дня **only if offline play is verified on a device**, else Аркада: одна пещера в день | 25 or 26/30 |
| Keywords | вертолет,коптер,туннель,джет,истребитель,флаппи,flappy,бесконечная,раннер,реакция,ретро,игра,полет | check <= 100 |

Before applying:
- Offline play, code check 2026-10-11: the apps load the game from the bundle (iOS `GameView.swift` `loadFileURL`,
  Android `WebViewAssetLoader`), the daily cave is seeded from the device clock (`_tunlActiveDayInt()` in
  `src/web.js`), Game Center authenticates asynchronously and never gates the start, and every `fetch` to the
  leaderboard Worker is in `src/web.js` (web only). Only leaderboards, ads and sharing need a network.
  Still do one device test before using "офлайн": airplane mode on an iPhone, cold-launch TUNL, fly a run.
- Re-count lengths with a script (keywords: no spaces, commas only, <= 100 bytes as ASC counts characters).
- Keywords must not repeat words already in the name or subtitle (Apple combines the fields).

## Measure

Re-run the rank check about 2 weeks after the version is live (same terms, `country=ru`) and compare
ASC downloads for Russia (Kennzahlen -> Nach Datum -> App Store -> Territorium) against the 8 per 30 days baseline.

## Also: en-GB keywords reach the Russian-speaking storefronts (added 2026-10-11)

Apple's storefront table: Kazakhstan, Uzbekistan, Kyrgyzstan, Belarus, Armenia, Azerbaijan, Moldova, Georgia,
Tajikistan and Turkmenistan index **only English (U.K.)**; Russia indexes Russian **plus English (U.K.)**; Ukraine
English (U.K.) + Russian + Ukrainian. TUNL's ru listing is therefore invisible to search in those countries, and
Russian queries there return almost nothing (iTunes search API, 2026-10-11: "пещера" = 2 apps in KZ/UZ/BY/...,
TUNL not among them). ASC since 2026-08-01: KZ 148 impressions / 6 page views / 1 download, UZ 105 / 0 / 1,
KG 30, UA 101 / 1 / 0, AM 13, AZ 10.

Today en-GB keywords are a copy of en-US (`copter,helicopter,classic,tunnel,endless,flappy,button,finger,jet,plane,
retro,gravity,reflex,hold`). New en-GB keywords, keeping the strongest English terms and adding the core Russian ones
(98 characters):

`copter,helicopter,tunnel,flappy,jet,plane,endless,пещера,самолет,вертолет,аркада,полет,игра,офлайн`

Trade-off: en-GB is the default in most smaller storefronts (UK included), so the weak English words (classic,
button, finger, retro, gravity, reflex, hold) leave those storefronts. "офлайн" under the same device-test condition
as the ru subtitle. Measure with the rank script (`country=kz`, terms "пещера", "самолет игра") two weeks after release.
