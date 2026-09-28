# TUNL 18.0.1 - App Store Connect only (iOS)

18.0.1 exists to carry the new App Store preview video: a live version's previews are locked,
and 18.0 was already in review when the video was cut (2026-09-28). The app code is the
18.0 code unchanged - built from 23c7a51 on branch `release-18.0.1` (1b29371 = version bump
only), so none of the web-only commits on main since then ship in it.

Versions: iOS marketing 18.0.1 / build 62. Android stays 18.0 / versionCode 55 (Play takes the
video as a YouTube link, no build needed).

**What's New**: reuse `store-metadata/18.0/release-notes.md` verbatim in all 16 locales. Nothing
changed in the game, and a player updating straight from 17.3 should still read about the laser
and Frenzy.

**Werbetexte**: do not carry forward to a new version - copy each locale's promotionalText from
the live 18.0 version and verify by re-GET.

**Preview**: `Screenshots/iOS_18.0/TUNL_18.0_1920x886.mp4` into all 16 locales x IPHONE_67 +
IPHONE_65 (delete the 30 old `TUNL_15.0_1920x886.mp4` first; `el` has no preview sets yet).
Screenshots stay as they are.

**ASC status**: build 62 uploaded 2026-09-28; the 18.0.1 version can only be created once 18.0
has left review.
