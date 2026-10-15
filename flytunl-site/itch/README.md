# itch.io listing

`index.html` is the whole upload: it frames `https://flytunl.ch/play/` with
`utm_source=itch`, so a flytunl.ch deploy updates itch.io too and nothing needs re-uploading.
Zip it alone (`zip tunl-itch.zip index.html`), upload as "HTML - This file will be played in
the browser".

Inside itch's frame the game's storage is partitioned by the embedding site: an itch player
starts fresh, separate from their flytunl.ch/play progress. Leaderboard, ads and analytics
keep the `https://flytunl.ch` origin, so the worker's `ALLOWED_ORIGINS` needs no change.

## Project settings

- Title: `TUNL: Fighter Jet Arcade` (the store name since 19.9), URL tunl.itch.io/tunl.
- Kind: HTML. Classification: Games. Release status: Released. Pricing: $0 or donate, $2 suggested
  (user, 2026-10-15; money arrives only once payouts are set up in the itch account).
- Embed: in the page, viewport 960 x 540, "Fullscreen button" on, "Mobile friendly" on,
  orientation Landscape. No scrollbars.
- Genre: Action. Tags: arcade, one-button, endless, flying, cave, daily, leaderboard,
  hypercasual, singleplayer, 2d.
- Cover 630 x 500: `cover.png` from `make-cover.py` (the Play feature graphic re-cropped, wordmark top-left).
  Gameplay crops read as a dark empty box at itch's 315 x 250 grid size; the brand art does not.
- Screenshots: fresh `Screenshots/capture/capture.mjs` frames (2026-10-15, current HUD and hull), 1912 x 880,
  in this order: star mode, flight, deep, debriefing, title. The city frame is left out. Recapture after
  any visible HUD or hull change.
- Trailer: the 18.0 cut, https://www.youtube.com/watch?v=6MpAWIDzXp4 (unlisted - never set it private
  while this listing links it).
- AI disclosure: yes, code (user's call, 2026-10-15).
- Project: https://tunl.itch.io/tunl (edit: itch.io/game/edit/5164268). Making it Public is the user's
  click - the auto-mode classifier refuses it for Claude.
- App link: `https://flytunl.ch/get/?utm_source=itch&utm_campaign=itch` (ASC campaign `ct=itch`,
  Play referrer `utm_source=itch`).
- App store links (the page's store buttons): App Store `...id6789721765?pt=93838800&ct=itch&mt=8`,
  Google Play `...details?id=com.theodoracatos.tunl&referrer=utm_source%3Ditch%26utm_campaign%3Ditch`.
- Metadata tab: inputs keyboard/mouse/touchscreen, session "a few seconds", 16 languages (pt-BR,
  zh_Hant), accessibility "one button".

## Short description

Hold to climb, release to fall. Everyone flies the same cave today.

## Description

TUNL is a one-button cave flyer. Tap to hop, hold to climb, let go to fall.

Every day the whole world gets the same cave: same walls, same mines, same coins. Fly as
far as you can, then see where you rank against everyone who flew it today. Tomorrow
there is a new one.

- One touch controls, played with mouse, Space or Up arrow
- A new cave every day, the same for every player
- Today's top 10 with pilot names
- Shields, lasers, bombs, magnets and a star mode that smashes through everything
- Eight ships to unlock, each with its own feel
- Gets faster the deeper you go: easy to start, hard to master

Also free on iPhone and Android: https://flytunl.ch/get/?utm_source=itch&utm_campaign=itch
