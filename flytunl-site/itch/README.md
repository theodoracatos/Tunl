# itch.io listing

`index.html` is the whole upload: it frames `https://flytunl.ch/play/` with
`utm_source=itch`, so a flytunl.ch deploy updates itch.io too and nothing needs re-uploading.
Zip it alone (`zip tunl-itch.zip index.html`), upload as "HTML - This file will be played in
the browser".

Inside itch's frame the game's storage is partitioned by the embedding site: an itch player
starts fresh, separate from their flytunl.ch/play progress. Leaderboard, ads and analytics
keep the `https://flytunl.ch` origin, so the worker's `ALLOWED_ORIGINS` needs no change.

## Project settings

- Kind: HTML. Classification: Games. Release status: Released. Pricing: No payments.
- Embed: in the page, viewport 960 x 540, "Fullscreen button" on, "Mobile friendly" on,
  orientation Landscape. No scrollbars.
- Genre: Action. Tags: arcade, one-button, endless, flying, cave, daily, leaderboard,
  hypercasual, singleplayer, 2d.
- Cover 630 x 500: laser crop of `Screenshots/ppo-B-2026-10/raw/capture-laser-mars.png` + wordmark.
- Screenshots: `Screenshots/iOS_18.4/en/play-tablet-16x9/` 03, 04, 05, 06, 02.
- App link: `https://flytunl.ch/get/?utm_source=itch&utm_campaign=itch` (ASC campaign `ct=itch`,
  Play referrer `utm_source=itch`).

## Short description

Hold to climb, release to fall. Everyone flies the same cave today.

## Description

TUNL is a one-button cave flyer. Tap to hop, hold to climb, let go to fall.

Every day the whole world gets the same cave: same walls, same mines, same coins. Fly as
far as you can, then see where you rank against everyone who flew it today. Tomorrow
there is a new one.

- One touch controls, played with mouse, Space or Up arrow
- A new cave every day, the same for every player
- Daily and all-time leaderboards
- Shields, lasers, bombs, magnets and a star mode that smashes through everything
- Eight ships to unlock, each with its own feel
- Gets faster the deeper you go: easy to start, hard to master

Also free on iPhone and Android: https://flytunl.ch/get/?utm_source=itch&utm_campaign=itch
