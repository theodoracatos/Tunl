# TUNL 8.0 store-prep - HANDOFF

Session ran out of credits after Phase 4. This file + the project memory
`project_release_status` are the complete state. A fresh session continues from
**Phase 5**.

## The task (from the user, verbatim intent)

Prepare TUNL 8.0 for the App Store + Play Store, then update flytunl.ch **after** 8.0
is live. Phases run strictly in order; stop and show the user after each, wait for OK.

### Hard rules (non-negotiable)
- **Never click "Submit for Review" / "Rollout".** Everything stays DRAFT. The user does
  the final send.
- **Spend no money.** No ASA / Google Ads campaign activated, no budget set, no bid
  confirmed. Prepare only.
- **No live deploy without the user's OK** - including the website.
- **Never guess paths, languages, or access.** If a file is not where described: stop
  and ask.
- **No misleading claims.** Apple Guideline 2.3 + Google Play Metadata Policy are the
  limit. When in doubt, the more conservative wording.
- **Never overwrite existing files** - new versions land beside the old with a clear name.
- Tone for all copy: playful, casual, loose. Optimise for CTR + conversion.
- Repo rule: no em dashes anywhere. Hyphen-minus only.

## Locked decisions (Phase 0-1)

- **No new icon/logo in 8.0.** The "ship-first" icon is already live since 6.x/7.0
  (`e6ba6ed`). Skip every logo-replacement step. iOS needs no rebuild for an icon.
- **8.0 = renumbered from 7.1** (same day, no content rollback). Content vs last store
  version: coin visual redesign + spawn rebalance (`ec4cee8`), UI sound pass (`2f79c32`),
  Android IAP `ITEM_ALREADY_OWNED` fix (`d77bc49`), "Dock & Drawer" title screen redesign
  (`5c2bc57`..`5ebc3cd`, `6538d26`), ship-mastery fix (`1dbe23b`), gentler onboarding +
  "+RECORD" beat + richer share card (`46f299b`).
- **Version files already at 8.0, committed** (`a90ebdd`): iOS `MARKETING_VERSION` 8.0 /
  `CURRENT_PROJECT_VERSION` 28; Android `versionName` '8.0' / `versionCode` 21.
- **No fastlane in the repo.** Past releases were browser-automation of the consoles.
  Phase 5 = browser-automate to DRAFT with the user logged in. Metadata still lives in
  the fastlane deliver/supply layout under `store-metadata/8.0/` so it maps 1:1 to the
  console fields.
- **Locales:** the 15 in-game langs (src/i18n.js LANG_ORDER) as the standard listing +
  **pt-BR additionally** as its own Brazil-tailored set (Phase 4).
- **iOS screenshots:** two portrait sizes, 6.9" (1320x2868) AND 6.5" (1242x2688).
- **13 non-en/non-ptBR locales reuse the ENGLISH gameplay captures** with translated
  captions (user has no time for native captures). Frames 1+5 show some English game UI.
- **Play phone screenshots: landscape 2208x1242** (game is landscape-only; matches
  Jetpack Joyride / Alto's Odyssey, the horizontal-game competitors).
- **Play App Preview:** YouTube links only (Play takes no upload). en
  `https://youtu.be/OufyMXUaJ8M`, pt-BR `https://youtu.be/7CJsx8_fkQ0`. No other locale.
- **flytunl.ch site:** `flytunl-site/` in THIS repo, deploy via `flytunl-site/deploy.sh`
  (lftp to Hoststar). NEVER edit the Schedly repo for TUNL. See [[project_flytunl_site]].
- No Firebase in repo (AdMob direct only) - assume so unless the user says otherwise.
- App Store app ID: `6789721765`. Bundle/appId: `com.theodoracatos.tunl`.

## What is DONE (Phases 0-4) - all files untracked, nothing committed

### Store copy - `store-metadata/8.0/`
- `build-metadata.py` - one dict holds all 16 locales' copy, writes the fastlane tree
  under `ios/<loc>/` (name/subtitle/promotional_text/keywords/description/release_notes)
  and `android/<loc>/` (title/short_description/full_description + changelogs/21.txt),
  validates every char limit (ALL PASS), writes `OVERVIEW.md` (counts).
  **Re-run after any edit:** `python3 store-metadata/8.0/build-metadata.py`
- Real Unicode diacritics in every language (user was firm: "Münzen" not "Muenzen").
- App name carries an ASO suffix ("TUNL: Daily Cave Flyer" etc.). User MAY still want
  bare "TUNL" - not yet decided.
- Positioning leads with the daily-shared-cave hook (no competitor has it).
- `REVIEW-en-de-fr.md` and `REVIEW-en-de-fr-ptBR.md` - human review docs.
- **User review status: approved Phase 2 (EN/DE/FR) with "passt". Has NOT yet
  confirmed the Phase 4 pt-BR Brazil copy** - was reading `REVIEW-en-de-fr-ptBR.md`
  when credits ran out.

### iOS screenshots - `Screenshots/iOS_8.0/<loc>/`
- `portrait/01-05.png` (1320x2868) + `portrait-6.5/01-05.png` (1242x2688), 16 locales
  = 160 PNGs. Generator: `Screenshots/make-portrait-frames-8.0.py` (`python3 ... ios`).
- Order: title/daily-hook - hold-to-climb - power-ups - death+rank - 15 languages.
- Latin/Cyrillic use Courier New Bold; ja/ko/zh/ar/hi use per-script system fonts;
  ar+hi render via Pillow RAQM. **The env now has libraqm** (`brew install libraqm` +
  `pip install --force-reinstall --no-binary :all: pillow` were run; also `pip install
  arabic-reshaper python-bidi`). Verified ar (RTL), hi (conjuncts), ja, de render right.
- Captions are a punchier register than the Phase 2 store copy, same messaging. NOT yet
  re-synced to final Phase 2 wording (optional; user was told).

### iOS App Preview videos - `Screenshots/iOS_8.0/{en,pt-BR}/`
- `app-preview-6.5.mp4` (1920x886, ~17MB) + `app-preview-6.9.mp4` (2796x1290, ~26MB).
- h264 high, yuv420p, CFR 30fps, silent AAC stereo 44.1k, 20.0s, +faststart. Matches
  the known-good ASC spec in the memory gotchas list.
- **>10MB, so the browser file_upload tool can't do these** - Phase 5 needs the user to
  drag them into App Store Connect manually.

### Play screenshots - `Screenshots/Android_8.0/<loc>/phone/01-05.png`
- Landscape 2208x1242, 16 locales x 5 = 80 PNGs. `make-portrait-frames-8.0.py`
  (`python3 ... play`). Clean dark-gradient bg + stars + accent glow, shot as rounded
  card 82% width, TUNL wordmark top, bottom accent-band one-liner caption.
- **Play tablet screenshots NOT built** - derive from these when needed (Play doesn't
  require them but flags "not optimised for tablets" without them).

### Play feature graphic
- Reuse `branding/web/feature-graphic-1024x500.png` as-is (current brand, no 8.0 rebrand).

### flytunl.ch web clip - `flytunl-site/site/media-8.0/`
- `hero-8.0.mp4` (~900KB h264) + `hero-8.0.webm` (~690KB VP9) + `hero-8.0-poster.jpg`.
  1432-wide, no audio, 20s, web-compressed. **NOT wired into index.html, NOT deployed**
  - that is Phase 6. Does not touch the existing `hero-demo.mp4`.

### Brazil set - `store-metadata/8.0/brazil/`
- `README.md` - the 4 targets.
- pt-BR store copy REWRITTEN Brazil-native in `build-metadata.py` (angles: free/light/
  plays-without-wifi, world ranking + beating friends, daily cave as a WhatsApp ritual,
  casual BR register).
- `asa-custom-product-page.md` - CPP plan + ad-angled promo text (pt-BR) + reordered
  screenshot set at `Screenshots/iOS_8.0/pt-BR/cpp/01-05.png` + `cpp-6.5/` (ranking
  frame first, for ad clickers). CPP must be created in ASC (assigns the ppid).
- `uac/build-uac.py` - validates + writes `headlines.txt` (5x<=30), `descriptions.txt`
  (5x<=90), renders `img-landscape-1200x628.png`, `img-square-1200x1200.png`,
  `img-portrait-960x1200.png` from a clean BR gameplay frame. Nothing uploaded/activated.

## What is LEFT

### Phase 3/4 leftovers (small)
- Play tablet screenshots (optional).
- Optional: re-sync portrait-frame captions with final Phase 2 wording.
- Get the user's "passt" on the Phase 4 pt-BR Brazil copy.

### Phase 5 - Upload as DRAFT (browser automation, user logged in)
- **iOS (App Store Connect, app 6789721765):** create the 8.0 version if not present,
  paste all 16 locales' name/subtitle/promo/keywords/description/what's-new from
  `store-metadata/8.0/ios/<loc>/`, upload the 6.9"+6.5" portrait screenshots per locale
  (en set covers the 13; pt-BR its own), hand the App Preview .mp4 files to the user to
  drag in. Create the Brazil ASA Custom Product Page per `brazil/asa-custom-product-page.md`.
  DO NOT submit for review.
  - GOTCHA (memory): this machine's keychain has only "Apple Development", not
    "Apple Distribution" - the 8.0 BINARY still needs the user's own Xcode Archive ->
    Distribute. Check `https://appstoreconnect.apple.com/apps/6789721765/distribution`
    for any in-flight review first (7.0 was stuck "Warten auf Prüfung" as of 2026-08-30).
  - GOTCHA: ASC vs Play locale codes differ - see `LOCALE_CODES` in build-metadata.py,
    VERIFY against the live console before pasting. Do not guess.
- **Android (Play Console):** the AAB builds unattended here
  (`cd Tunl.Android && ./gradlew bundleRelease` -> `app/build/outputs/bundle/release/
  app-release.aab`, keystore in `Tunl.Android/Keys/`). Upload to a DRAFT/internal track,
  NOT Production rollout. Paste the 15 locales' title/short/full from
  `store-metadata/8.0/android/<loc>/` (Play release-notes locale codes: en-US, ar,
  de-DE, es-ES, fr-FR, hi-IN, id, it-IT, ja-JP, ko-KR, pt-BR, ru-RU, tr-TR, vi, zh-TW -
  all 15 fit in ONE textarea tagged `<locale>...`). Upload the landscape phone
  screenshots. Set the YouTube preview links (en, pt-BR). Reuse the feature graphic.
  Prepare the UAC pack for the user - do not create the asset group.
  - GOTCHA: Play Store-listing has its own "submit for review" separate from a binary
    release. Saving = draft only. Don't report as live.
  - GOTCHA: `file_upload` tool caps at 10MB combined; the AAB (~10-14MB) may need the
    user to drag it in.
- Output: a preview report per store, then STOP. The user does Submit.

### Phase 6 - flytunl.ch (ONLY after 8.0 is LIVE in both stores)
- Update `flytunl-site/site/index.html`: `.whatsnew` banner already says "New in 8.0";
  wire in the 20s clip (`media-8.0/hero-8.0.{mp4,webm}` + poster) with autoplay, muted,
  playsinline, loop, lazy-load; swap in the final 8.0 screenshots in the same order as
  the App Store listing. No logo/favicon/OG change (no rebrand).
- Images web-optimised (WebP/AVIF + fallback), no raw store assets.
- Staging/preview deploy first, link + mobile & desktop screenshot to the user.
- Check: video plays on iOS Safari, no layout shift, Lighthouse not worse, all store
  links point at 8.0.
- Production deploy ONLY after the user's OK. Then verify the LIVE url (curl, not just
  "deploy succeeded") and tell the user how to roll back.
  - GOTCHA: `deploy.sh` must NOT carry `--delete` (see [[project_flytunl_site]] incident).

## Tooling notes
- ffmpeg, ffprobe, rsvg-convert, Pillow (now w/ libraqm), arabic-reshaper, python-bidi
  all present. `timeout` is NOT available on this macOS.
- Chrome browser automation (mcp__claude-in-chrome__*): the extension needed the user to
  install it + `/mcp` reconnect this session. `apps.apple.com` is permitted;
  `play.google.com` was permitted mid-session by the user.
