# CrazyGames listing

`index.html` is the whole upload: it frames `https://flytunl.ch/cg/`, the portal page that
`build-play.mjs buildPortal()` writes on /play/'s own bundle. A flytunl.ch deploy updates
CrazyGames too; nothing needs re-uploading. Zip it alone (`zip tunl-cg.zip index.html`).

## Why a separate page, not /play/

CrazyGames requirements (read 2026-10-16, docs.crazygames.com/requirements/):

- App Store links are never allowed in-game; they go in the Developer Portal's metadata fields.
- No cross-promotion of other platforms, no links that lead to a playable web version.
- Basic Launch: no external ads, no external login, SDK optional, no revenue.
- Full Launch (CrazyGames picks it after Basic Launch): their SDK, their ads only, a
  `gameplayStart` event, land in gameplay in at most one click.
- Not exclusive; a game already on itch.io or its own site is fine.

So `/cg/` sets `window._tunlPortal` (`src/web.js webPortal()`), which hides the install pill,
the greyed app-only controls and their "in the app" sheet, the all-time pitch on the board,
the app card behind the continue ring, and SHARE (every share carries a /play link).
It loads no AdSense / GPT script (the build throws if one reaches it). `test-sim.js` checks
both pages and the apps. The legal links stay: the operator must be reachable (Swiss UWG).

Storage inside the frame is partitioned by the portal: a CrazyGames player starts fresh.

## Listing

- Title: `TUNL: Fighter Jet Arcade`. Description and controls: reuse `../itch/README.md`, minus
  the "Also free on iPhone and Android" line, which goes into the portal's store-link fields:
  App Store `https://apps.apple.com/app/id6789721765?pt=93838800&ct=crazygames&mt=8`,
  Google Play `https://play.google.com/store/apps/details?id=com.theodoracatos.tunl&referrer=utm_source%3Dcrazygames%26utm_campaign%3Dcrazygames`.
- Covers: CrazyGames asks for its own sizes; generate them from the feature graphic like
  `../itch/make-cover.py`.
- Analytics: GA4 `utm_source=crazygames`, ASC campaign `ct=crazygames`, Play referrer
  `utm_source=crazygames`, plus the CrazyGames developer dashboard (players, playtime,
  retention) - the reason this listing exists.
