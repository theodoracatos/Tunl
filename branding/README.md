# TUNL brand assets

The icon identity is one motif: the player ship. The exact in-game sprite
(`SHIP_OUTLINE` / `SHIP_FACETS` / `drawShip()` in `src/draw.js` - the faceted
K5 "Facette + Licht" hull shipped in 12.0) sits centred, in a ~30-degree climb
because the game verb is "hold = climb", on the dark cave ground with a soft
blue aura and its own twin nacelle plumes. One shape, so the silhouette still
reads at a 16px favicon - no coin, no tunnel-ring, no particle field.

## The ship block is generated - `gen-ship-glyph.mjs`

Every master carries the SAME hull, so hand-editing 14 facet polygons in four
SVG files is how they drift out of sync with the game (which is exactly what
happened at 12.0: the masters still held the pre-12.0 needle - nose 1.72r,
span 0.92r, smooth white fill - long after the game stopped drawing it).

`branding/gen-ship-glyph.mjs` mirrors the geometry and the facet tone maths
from `src/draw.js` and writes the ship into each master between its
`BEGIN/END generated ship` markers. Everything outside the markers
(background, aura, placement transform) stays hand-authored per file.

```
node branding/gen-ship-glyph.mjs --list    # the four masters it writes
node branding/gen-ship-glyph.mjs --write   # rewrite them in place
node branding/gen-ship-glyph.mjs --r=130   # print one fragment to stdout
bash branding/export-icons.sh              # then push the rasters everywhere
```

Two deliberate deviations from the in-game render, both for icon legibility:
the shadow-side facet tones are damped (`darkMix`, default 0.62) because a
facet mixed 54% toward near-black merges into the `#04040e` icon ground and
the lower wing drops out of the silhouette at favicon size; and the animated
spine running lights are left out, since a logo is one frame and four chasing
dots read as dirt on the hull. The plumes ARE the game's (`drawThrustPlume()`
tints them with the skin glow, and PEARL's glow is already the cool white-blue
the old hand-picked single cone was reaching for).

The wordmark ("TUNL", with the U drawn as a portal/gem) is a separate asset
and unchanged by the icon direction; the two are meant to lock up together
(ship = the hero, U = the place).

## Masters (edit these, everything else is exported from them)

- `icon-mark.svg` — the ship mark, full-bleed square. App icon source for
  iOS, Android's legacy launcher icon, the Play Store listing icon, and
  favicons. No text.
- `icon-adaptive-foreground.svg` — same ship, transparent background, shrunk
  so the sprite plus its plumes sits inside Android's 66dp adaptive-icon
  safe zone. Pairs with the `tunlBackground` color (`#04040A`) as the
  background layer.
- `ios-launch-logo.svg` — the ship mark with no background rect (transparent),
  for the iOS `LaunchScreen.storyboard`, which lays it on the
  `LaunchBackground` color (`#04040A`) itself. Matches the Android 12 system
  splash, which shows the same ship glyph on the same color.
- `wordmark.svg` — "TUNL" for dark backgrounds (site header, splash, dark
  listing sections).
- `wordmark-light.svg` — same wordmark, navy letterforms, for white/light
  backgrounds (press kit, light site sections).
- `feature-graphic.svg` — 1024×500 Play Store feature graphic: ship mark +
  wordmark + the corridor's own top/bottom wave lines as texture. The wordmark
  is inlined as vector (kept in sync with `wordmark.svg` / the in-game title
  screen), `fw_`-prefixed IDs; it used to be a ~270KB embedded PNG of the
  retired ring-portal U.

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