# Release Command

Prepares a new TUNL version for submission to the App Store and Google Play, and checks
whether the marketing site needs updating to match. This recurs every version bump -- run
it instead of re-deriving the process from scratch each time.

**Marketing site is flytunl.ch only, in `flytunl-site/` (this repo).** Never touch the
Schedly repo (`Schedly/Schedly/wwwroot/tunl/`) for TUNL -- schedly.ch is frozen since
2026-08-29, not decommissioned, just not maintained.

Scope: this command gets everything *ready* for submission. It never runs an actual
Xcode archive/build, never touches App Store Connect / Play Console, and never commits
or pushes on its own (use `/autocommit` separately once you're happy with the result).
Those stay manual, gated steps for the user.

## 0. Figure out what this release actually is

- Confirm the target version number with the user if it's not already obvious from
  context (e.g. "V4.0"). iOS and Android don't have to share a version number history
  (see `project_release_status` memory for why they've drifted before) but should
  usually land on the same marketing version for a given release unless told otherwise.
- Ask what's actually new in this release if it isn't clear from the conversation --
  the release notes and marketing copy need real content, not filler.
- If new app icon / logo assets are part of this release, confirm the user has actually
  provided the source files (don't proceed on icon replacement with placeholders or by
  generating your own -- ask for the files, or wait if told to).

## 1. Version bump

**iOS** -- `Tunl/Tunl.xcodeproj/project.pbxproj`, both the Debug and Release config
blocks (search `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`, there are 2 of each):
- `MARKETING_VERSION` -> the new version string (e.g. `4.0`)
- `CURRENT_PROJECT_VERSION` -> bump the build number by 1 from whatever it currently is

**Android** -- `Tunl.Android/app/build.gradle`:
- `versionName` -> the new version string, quoted (e.g. `'4.0'`)
- `versionCode` -> bump by 1 from whatever it currently is

Verify both after editing (`grep -n "MARKETING_VERSION\|CURRENT_PROJECT_VERSION"` /
`grep -n "versionCode\|versionName"`) rather than trusting the edit blind.

## 2. App icon replacement (only if new assets were provided this release)

**iOS** -- single 1024x1024 PNG, no other sizes needed (modern single-size app icon):
`Tunl/Tunl/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`. Overwrite in place,
keep the filename identical (`Contents.json` in that same folder references it by name).

**Android** -- adaptive icon, two pieces:
- Foreground layer, one file per density under `Tunl.Android/app/src/main/res/`:
  `drawable-xxxhdpi/ic_launcher_foreground.png` (and any other `drawable-*hdpi` density
  variants present -- check what exists before assuming only xxxhdpi).
- Legacy flat icon (pre-API-26 fallback), one file per density:
  `mipmap-mdpi/ic_launcher.png`, `mipmap-hdpi/ic_launcher.png`, `mipmap-xhdpi/ic_launcher.png`,
  `mipmap-xxhdpi/ic_launcher.png`, `mipmap-xxxhdpi/ic_launcher.png`.
- Background stays a solid color (`@color/tunlBackground`, referenced from
  `mipmap-anydpi-v26/ic_launcher.xml`) -- don't touch that unless the brand color itself
  changed, that's a separate decision from a logo refresh.
- If you only have a single high-res source image and no pre-sized exports, say so
  explicitly rather than silently stretching one image across every density slot --
  ask the user for properly sized exports, or flag that the icon will need a proper
  multi-density export pass before this step can be done right.

**Wordmark/logotype assets** (only if the *wordmark/logotype*, not just the app-icon
glyph, also changed -- these are different things, don't conflate them): masters live in
`branding/` (`wordmark.svg`, `wordmark-light.svg`, `icon-mark.svg`,
`feature-graphic.svg`). Run `branding/export-icons.sh` to regenerate every raster from
the masters -- it writes iOS/Android icon rasters, `flytunl-site/site/`'s favicons and
`wordmark.svg`, and `branding/web/`'s copies in one pass. Never hand-edit the generated
rasters directly.

## 3. Release notes, all 15 languages

Same language set as the game's own i18n (`src/i18n.js` `LANG_ORDER`): en, de, fr, it,
es, pt, ja, ko, zh, ru, ar, tr, id, vi, hi.

- Write real content based on what's actually new this release (step 0) -- don't reuse
  a previous version's notes with the number swapped.
- Keep every language under Google Play's 500-character-per-locale release notes limit
  (write a quick length-check script, don't eyeball it -- see the 3.2 release notes for
  the pattern). App Store's limit is far more generous, so one set of copy covers both.
- Match TUNL's existing voice (see `Schedly/Schedly/wwwroot/tunl/marketing.html` for
  tone reference: short, punchy, second-person, a little dramatic -- "push into the
  dark", not corporate changelog-speak).
- Deliver as a markdown file (one section per language) via the scratchpad + SendUserFile,
  not just inline chat text -- it needs to survive being copy-pasted into two different
  consoles across 15 locale fields each.

## 4. Check flytunl.ch

The marketing site lives in **this repo**, at `flytunl-site/` -- never the Schedly repo
(frozen since 2026-08-29, see `reference_store_listing_urls` memory). Decide, based on
what's actually new this release, whether any of these need a copy update:
- **Homepage whatsnew banner**: edit `hero.newBody` (and its translations) in
  `flytunl-site/i18n/home.json` -- NOT `flytunl-site/site/index.html` directly, which is
  generated + gitignored. See `project_homepage_i18n` memory for the full edit workflow
  (`home.src.html` + `home.json`, rebuilt by `build-site.mjs`). Falls back to English if
  a translation is missed, so a partial update is safe but should still be finished.
  This string goes stale on every release if not bumped.
- The homepage's feature list -- only if this release adds/changes a *persistent*
  feature (new coin type, new obstacle, new system). A release that's just an icon
  refresh or a bug-fix pass usually doesn't need it touched.
- `flytunl-site/site/support/index.html`'s one-line game description -- only if the core
  mechanics list it enumerates (stalactites, mines, cannons, etc.) is now out of date.
  This page is plain English HTML, edited directly (not part of the i18n build).
- Screenshots/hero video under `Screenshots/` and `flytunl-site/site/media-*/` -- these
  go stale fast (they're simulator captures) but replacing them isn't something you can
  do yourself; flag to the user if the visible gameplay has changed enough that current
  screenshots look wrong, and let them recapture.
- Edits here are draft-only until deployed -- run `flytunl-site/deploy.sh` (which
  rebuilds via `build-site.mjs`/`build-play.mjs` before uploading) to actually push
  live, per the standing "site update only after the version is live" rule.

## 5. What this command does NOT do

State this explicitly in the final report so the user knows what's still manual:
- No Xcode archive/build, no `gradlew` build, no `.aab`/`.ipa` generation
- No App Store Connect or Play Console submission (version fields, screenshots upload,
  release notes paste, review submission) -- those need the user's own login
- No git commit/push (run `/autocommit` in each repo separately once satisfied)
- No new screenshot/video capture (simulator-only, needs the user's own machine)

## 6. Final report

Give the user a short checklist: what got bumped/replaced/drafted, what's still needed
from them before this can actually ship, and where to find the release-notes file.
