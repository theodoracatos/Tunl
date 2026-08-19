# TUNL brand assets

The identity is one motif: the tunnel ring the title screen already draws as
the "U" in TUNL (purple top wall, cyan bottom wall, converging on a bright
vanishing point) — reused everywhere instead of three unrelated logos.

## Masters (edit these, everything else is exported from them)

- `icon-mark.svg` — the portal alone, full-bleed square. App icon source for
  iOS, Android's legacy launcher icon, the Play Store listing icon, and
  favicons. No text, no ship — store icons get judged at 60-120px in a grid,
  and fine detail is the first thing that turns to mud.
- `icon-adaptive-foreground.svg` — same mark, transparent background, scaled
  to sit inside Android's 66dp adaptive-icon safe zone. Pairs with the
  `tunlBackground` color (`#04040A`) as the background layer.
- `wordmark.svg` — "TUNL" for dark backgrounds (site header, splash, dark
  listing sections). The U *is* the portal mark, not a lookalike drawing.
- `wordmark-light.svg` — same wordmark, navy letterforms, for white/light
  backgrounds (press kit, light site sections).
- `feature-graphic.svg` — 1024×500 Play Store feature graphic: mark +
  wordmark + the corridor's own top/bottom wave lines as texture.

Regenerate any raster from a master with `rsvg-convert`, e.g.:
```
rsvg-convert -w 1024 -h 1024 icon-mark.svg -o out.png
```
iOS and the Play Store listing icon want **no alpha channel** — flatten onto
`#04040e` (see `web/` for an example) before uploading.

## Applied in this repo

- `Tunl/Tunl/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png` — iOS app icon
- `Tunl.Android/app/src/main/res/mipmap-*/ic_launcher.png` — Android legacy launcher icon (all 5 densities)
- `Tunl.Android/app/src/main/res/drawable-xxxhdpi/ic_launcher_foreground.png` — Android adaptive-icon foreground
- `Screenshots/Android/play_icon_512.png` — Play Store listing icon

## `web/` — for the website repo (Schedly `wwwroot/tunl`)

This repo doesn't host the marketing site, so these are exports to copy over
by hand, not applied anywhere automatically:

- `favicon.svg` — modern browsers, scales to any size
- `favicon-16.png`, `favicon-32.png` — legacy favicon fallback
- `apple-touch-icon-180.png` — iOS home-screen bookmark icon
- `favicon-512.png` — PWA manifest / social preview fallback
- `wordmark-dark.png` / `wordmark.svg` — header on dark backgrounds
- `wordmark-light.png` / `wordmark-light.svg` — header on light backgrounds
- `feature-graphic-1024x500.png` — reusable as an OG/social share image