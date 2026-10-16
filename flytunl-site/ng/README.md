# Newgrounds listing

Upload: `flytunl-site/dist/tunl-ng.zip`, written by `build-play.mjs buildOffline()` on every
`npm run build:play` (index.html at the zip root, as Newgrounds requires). Unlike itch and
CrazyGames this is a copy of the game, not a frame around flytunl.ch: **every web release
needs a re-upload here**, or Newgrounds keeps the old version.

## Why an offline build

Newgrounds game guidelines (read 2026-10-16,
newgrounds.com/wiki/help-information/terms-of-use/game-guidelines):

- A game should not rely on third-party servers; one that calls a third-party API or
  anything that could track a user must say so at the start and offer an opt-out.
- No auto-redirects or pop-ups; not "shovelware made to serve ads or promote your site".
- AI: games generated from a prompt are not wanted; any AI use must be disclosed in the
  author comments, and moderators remove at their discretion.
- Submissions go through public judgment: a low score gets it "blammed" (deleted).

So the page sets `window._tunlPortal` and `window._tunlOffline` (`src/web.js webOffline()`):
the portal rules of /cg/ (no store links, app pitch or SHARE) plus no leaderboard, referral
or challenge calls, no analytics beacon, no ad script (the build throws if one appears).
The daily cave is seeded locally, so Newgrounds players fly the same cave, without a rank.
The legal links point to flytunl.ch. `test-sim.js` checks that no call reaches the worker.
Storage lives on Newgrounds' upload host: a player starts fresh there.

## Listing

- Title: `TUNL: Fighter Jet Arcade`. Description: `../itch/README.md`, minus the app line.
- Author comments: the AI disclosure below, then one line with the store links
  (`https://flytunl.ch/get/?utm_source=newgrounds&utm_campaign=newgrounds`).
- Thumbnail and screenshots: `../cg/cover-*.png` and the itch screenshots; all rendered by
  the game's own code, none AI-generated (the guidelines ask for that).
- Rating: E (no violence against people, no blood).
- Size: landscape, 956 x 440 is the game's web canvas; the game scales to any frame.

### AI disclosure (author comments)

How TUNL was made: I designed, tuned and playtested it, and wrote its code together with
an AI coding assistant (Claude). The graphics are drawn by the game's own code and the
sound effects are synthesized in code; the music is "The Mountain" (Pixabay license).
No AI-generated images, music or voices.

## Game Jolt (same zip)

`gamejolt.com/dashboard/games/1108057`, package "TUNL: Fighter Jet Arcade" (free, public), browser
build = this zip, 960 x 540, HTTPS on, fit-to-screen off. Version number = `TUNL_VERSION` (MAJOR.MINOR.PATCH).
Header `../cg/header-gamejolt.png` (2000 x 500, `make-covers.mjs`), thumbnail `../cg/cover-landscape.png`,
screenshots from `Screenshots/capture/capture.mjs` (title, flight, star, deep; not the debrief, which shows a
world rank and SHARE this build does not have). Description = the Newgrounds author comments + hashtags
(#arcade #action #scifi #onebutton #endless #flying), app link `utm_source=gamejolt`. Maturity: All Ages,
every category None. A web release means a new release with a new zip here too.
