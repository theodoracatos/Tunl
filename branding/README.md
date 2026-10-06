# TUNL brand assets

**App icon (since 2026-10-06): "Steigflug".** The player F-14 in AMBER, big, climbing at
34 deg on a bright violet ground with 12 soft rays, a light halo behind the hull and a long
plume running off the edge (`drawShip3D()`, roll 82, wings SPREAD; pose `ICON_POSE` in
`render-ship-mark.mjs`). Variant D4 of icon study III
(https://claude.ai/artifact/9ikbnZkGhJeYvT3JKixMYA, round 2
https://claude.ai/artifact/RJVt2BxGgH4Cn7GzMexR6q), the user's pick. The study measured the
top App Store hits for TUNL's search terms (107 games): the warp-ring icon of 2026-10-04 was
among the darkest and least colourful in that field (colourfulness 7th percentile, 54 %
near-black pixels); Steigflug sits in the top third. Gold on violet is the strongest
complementary pair the ship palette has. Masters: `icon-mark.svg`, `icon-mark-dark.svg`
(iOS 18 dark/tinted), `icon-adaptive-foreground.svg` + `icon-adaptive-background.svg`
(Android).

**iOS launch logo (since 2026-10-06)** shows the Steigflug picture without its ground (ship,
violet glow) on the dark launch screen, shrunk and centred on ship and plume, with a shorter
plume (`LAUNCH_POSE`) so nothing is cut at the square's edge. Android 12+ shows the adaptive
icon (violet circle) as its splash.

**Play feature graphic (since 2026-10-06)** widens the Steigflug icon to 1024x500: violet
ground, rays and halo, the AMBER F-14 in `ICON_POSE` climbing on the right, the TUNL wordmark
on the left, the centre clear for Play's video play button. Its wordmark U follows the title
screen's `buildUPath()` (chamfered channel on the baseline, gem at in-game size);
`wordmark.svg` / `wordmark-light.svg` carry the same U since the same day (`wordmark-onwhite.svg`
is the retired ring-portal U and is used nowhere).

## The ship block is rendered by the game - `render-ship-mark.mjs`

Every master carries the SAME ship. Copied geometry drifted twice (the pre-12.0
needle, then the SR-71 after the F-14 shipped), and the 3D model has no vector
twin anyway, so the ship is no longer copied at all: `render-ship-mark.mjs`
loads `src/*.js` (tunl.html order, minus `main.js` / `ads-web.js`) in headless
Chrome, lets `drawShip3D()` paint it and embeds the PNG between each master's
`BEGIN/END generated ship` markers, in ship-local px (r = 130) inside the
master's own transform. Everything outside the markers (background, aura,
placement transform) stays hand-authored per file. Each target's bitmap
resolution matches its largest export, so nothing is upscaled.

```
node branding/render-ship-mark.mjs --list     # the four masters it writes
node branding/render-ship-mark.mjs --write    # re-render them in place (--only=icon-mark,... for some)
node branding/render-ship-mark.mjs --png=x.png --res=2   # ship layer only
bash branding/export-icons.sh                 # then push the rasters everywhere
```

Deviations from the in-game frame, all for the icon: the plume is a short
teardrop (1.7r) instead of `drawThrustPlume()`'s 5r, which runs off any icon;
running lights and strobes are off (`fx` false), since a logo is one frame.

The masters are large (the launch logo embeds a ~2 MB PNG); `favicon.svg` is
therefore NOT a copy of `icon-mark.svg` but a 256px raster wrapper written by
`export-icons.sh`.

`--site` renders the flytunl.ch ship section the same way, but top-down like the
hangar (`drawShip()`): chip silhouettes from `SHIP_OUTLINE` and one portrait per
skin into `flytunl-site/site/media-ships/` (named by skin index - `build-site.mjs`
translates English words anywhere in the template, ship names included).

iOS 18 dark and tinted app icons are written by `export-icons.sh` from
`ios-launch-logo.svg` (dark: transparent; tinted: greyscale on black) and listed
as luminosity appearances in `AppIcon.appiconset/Contents.json`.

`gen-ship-glyph.mjs` is the retired vector generator (old SR-71 hull, damped
shadow tones). Its `--write` refuses and nothing imports it any more.

The wordmark ("TUNL", with the U drawn as a portal/gem) is a separate asset
and unchanged by the icon direction; the two are meant to lock up together
(ship = the hero, U = the place).

## Masters (edit these, everything else is exported from them)

- `icon-mark.svg` - the app icon (Steigflug: violet ground, rays, AMBER ship), full-bleed square. Source for
  iOS, Android's legacy launcher icon, the Play Store listing icon, and
  favicons. No text.
- `icon-mark-dark.svg` - the same without its ground, for the iOS 18 dark icon
  (and, greyscaled, the tinted one) in `export-icons.sh`.
- `icon-adaptive-foreground.svg` - ship and streaks, transparent background, shrunk
  so the hull sits inside Android's 66dp adaptive-icon safe zone (the fading
  plume tails reach past it and are cut by the launcher mask).
- `icon-adaptive-background.svg` - the violet ground, rays and halo under the same
  transform as the foreground (hand-authored, no ship block); exported to
  `drawable-xxxhdpi/ic_launcher_background.png`, which `ic_launcher.xml` /
  `ic_launcher_round.xml` use as the background layer (was the `tunlBackground`
  colour until 2026-10-06; that colour still paints the window and the splash ground).
- `ios-launch-logo.svg` - the Steigflug picture with no ground (transparent),
  for the iOS `LaunchScreen.storyboard`, which lays it on the
  `LaunchBackground` color (`#04040A`) itself.
- `wordmark.svg` — "TUNL" for dark backgrounds (site header, splash, dark
  listing sections).
- `wordmark-light.svg` — same wordmark, navy letterforms, for white/light
  backgrounds (press kit, light site sections).
- `feature-graphic.svg` - 1024x500 Play Store feature graphic (Steigflug look, see
  above): ground, rays, halo and streaks hand-authored, ship block generated. The
  wordmark is inlined as vector with `fw_`-prefixed IDs; its U is the title screen's
  `buildUPath()` geometry, like `wordmark.svg`.

## `game-center/` — App Store Connect Game Center art

- `gen-challenge-image.py` — generates `challenge-beat-my-score.jpg`, the
  challenge image for "Beat My Score" (`tunl_challenge_alltime`). Same glyph +
  glow language as the generated leaderboard/achievement icons, extended to
  ASC's 3840x2160 challenge slot (JPEG, sRGB, no alpha). Re-run it to tweak;
  needs `numpy` + `Pillow`.
- `gen-leaderboard-icons.py` — generates `leaderboard-daily.png`
  ("TUNL Highscore", `tunl_highscore`) and `leaderboard-alltime.png`
  ("Ewige Bestenliste", `tunl_highscore_alltime_v2`): 1024x1024 PNG, sRGB, no
  alpha, for the ASC / Play Games leaderboard icon slot. Daily is a gold trophy
  on the dashed "record line"; all-time is a platinum laurel wreath around the
  climb chevron. Same navy-glow language as above; needs `numpy` + `Pillow`.
- `gen-planet-achievement-icons.py` — the 8 weekday-world achievement icons.

The other achievement icons are still generated ad hoc (those scripts have not
been folded into the repo yet).

Regenerate every applied raster from the masters with
`branding/export-icons.sh` (needs `rsvg-convert` + Python `Pillow`). One-off:
```
rsvg-convert -w 1024 -h 1024 icon-mark.svg -o out.png
```
iOS and the Play Store listing icon want **no alpha channel** — the export
script flattens onto `#04040e`; do the same for any manual export.

## Applied in this repo (all written by `export-icons.sh`)

**iOS** — linked via `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon`:
- `Tunl/Tunl/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`

**iOS launch screen** — `Info.plist` `UILaunchStoryboardName = LaunchScreen`
(`Tunl/Tunl/LaunchScreen.storyboard`), image view uses `@LaunchLogo` on the
`LaunchBackground` colorset:
- `Tunl/Tunl/Assets.xcassets/LaunchLogo.imageset/launch-logo@{1,2,3}x.png` (from `ios-launch-logo.svg`)

**Android** — `AndroidManifest.xml` points `android:icon` at `@mipmap/ic_launcher`
and `android:roundIcon` at `@mipmap/ic_launcher_round`; both `mipmap-anydpi-v26`
adaptive XMLs point at `@drawable/ic_launcher_foreground` + `@color/tunlBackground`:
- `Tunl.Android/app/src/main/res/mipmap-*/ic_launcher.png` — legacy square (5 densities)
- `Tunl.Android/app/src/main/res/mipmap-*/ic_launcher_round.png` — legacy round, for API 23-25 (5 densities)
- `Tunl.Android/app/src/main/res/drawable-xxxhdpi/ic_launcher_foreground.png` — adaptive-icon foreground
- `Screenshots/Android/play_icon_512.png` — Play Store listing icon

**Website** (`flytunl-site/site/`) — linked from every page `<head>` plus
`site.webmanifest`:
- `favicon.svg`, `favicon-16.png`, `favicon-32.png`, `favicon-192.png`,
  `favicon-512.png`, `apple-touch-icon-180.png`
- `feature-graphic-1024x500.png` — `og:image` / `twitter:image`
- `site.webmanifest` — `name`/`icons`/`theme_color` (`#04040a`)

The web build's own copy, `flytunl-site/site/play/branding/web/`, is written by
`flytunl-site/build-play.mjs` (it mirrors `branding/web/`), so it refreshes on
the next web build — copy `branding/web/*` over it by hand if you change the
mark without rebuilding.

## `web/` — favicon/wordmark exports

The marketing site (`flytunl-site/site/` in this repo) is deployed separately;
`export-icons.sh` writes the favicons straight into it. `web/` keeps a
parallel copy plus the wordmark rasters:

- `favicon.svg` — modern browsers, scales to any size (a copy of `icon-mark.svg`)
- `favicon-16.png`, `favicon-32.png` — legacy favicon fallback
- `apple-touch-icon-180.png` — iOS home-screen bookmark icon
- `favicon-512.png` — PWA manifest / social preview fallback
- `wordmark-dark.png` / `wordmark.svg` — header on dark backgrounds
- `wordmark-light.png` / `wordmark-light.svg` — header on light backgrounds
- `feature-graphic-1024x500.png` — reusable as an OG/social share image
## Game-Center achievement icons

`game-center/achievement-icons/` holds all 40 live achievement icons at 512x512, one per
`tunl_ach_*` id in `src/state.js` (`planet_grand_tour.png` is `tunl_ach_grand_tour`).

22 of them are generated by the scripts next to them (`gen-planet-achievement-icons.py`,
`gen-distance-achievement-icons.py`, `gen-flight-achievement-icons.py`,
`gen-v11-achievement-icons.py`). The other 18 were uploaded to App Store Connect without
their generator ever being committed, and were recovered from Apple's CDN on 2026-09-14.

- **The 7 `ship_*` have a recipe**: `game-center/gen-ship-achievement-icons.mjs`. Since
  2026-10-02 it draws the F-14 hangar portrait with the game's own `drawShip()` (via
  `render-ship-mark.mjs`, nothing copied), in the 30-deg climb, on the background
  recovered from the old live icons (corner mix toward navy 0.745). **It was run for real
  on 2026-10-02**: the PNGs in `achievement-icons/` are its output (`--write` emits SVGs
  into the gitignored `svg/`, then rasterise and flatten to RGB). Until they are uploaded
  to BOTH stores (ASC Game Center + Play Games), the repo and the stores disagree.
- **The other 11 stay as artifacts without a recipe**: `first_flight`, `ace_pilot`,
  `master_fleet`, `ghost_hunter`, `new_legend`, `on_fire`, `score_1000/10000/100000`,
  `streak_7/30`. Bespoke motifs with nothing to drift against; a variant means redrawing.

**Recovering an icon from App Store Connect** (this is how the 18 came back, and it is
byte-exact - the 22 that existed in both places diffed at maxdiff 0):
1. In a signed-in ASC tab, `fetch('/iris/v1/apps/<appId>/gameCenterDetail')` for the
   detail id, then
   `/iris/v1/gameCenterDetails/<id>/gameCenterAchievements?limit=200`.
2. Per achievement, `/iris/v1/gameCenterAchievements/<id>/localizations?limit=1&include=gameCenterAchievementImage`;
   the included object carries `fileName` and `assetToken`.
3. The asset token's first 6 hex characters are also its CDN path segments, so the file is
   `https://is1-ssl.mzstatic.com/image/thumb/<assetToken>/512x512bb.png`.

That same walk is the audit for "does every achievement actually have its own icon":
identical `assetToken` or `fileSize` across achievements is the placeholder tell. Checked
2026-09-14 - 40 distinct tokens, 40 distinct sizes, all 15 locales each.
