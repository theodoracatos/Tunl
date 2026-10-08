# Daily run card (share)

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the measurements and rejected alternatives behind them are in `docs/design-history.md` (the 2026-09-21 condensing moved the removed paragraphs there verbatim, under "Narratives moved out of docs/agents").

## Daily run card (share)

`src/share.js`. TUNL seeds every run from the UTC date (`lifecycle.js`), so every player
on Earth flies a pixel-identical cave each day - the hard half of a shareable daily
game. (Verified per-device by `test-cave.js`; see "Cross-device fairness" for the four
things that have to stay true for it.)
The card is the other half.

The image is a picture of the **run**, not a score badge: it carries the **debriefing's own
content** (`draw.js drawDeathScreen`) - the run's scenes, the score against the bar it was
playing, the world rank, and every reward as a wrapping chip row. The death screen's right
column (`TODAY TOP`, run counter, shard payout) deliberately does **not** cross over - it is
the sender's meta. **Do not "simplify" this into a screenshot of the panel**: the panel has
the button row, differs in shape per target and has no wordmark, URL or date.
- which is the sender's own meta and means nothing to a recipient. **Do not "simplify"
this into a screenshot of the panel**: the panel carries the button row, is a different
shape on every target (956x600 iOS / 520 Android / 440 web) and has no wordmark, URL or
date, which is exactly why the card composes the same blocks into a fixed frame instead.

The corridor profile (`drawRunProfile`) is the second picture, a strip under the band, and
takes the band's slot when no death frame exists (a revive drops it). It is a rolling
average whose window scales with run length - literal `boundsBase()` renders a deep run as
a seismograph.

**Two cuts from one renderer** (`_shareCardCanvas(portrait)`): landscape 1200x630 for the
desktop clipboard, **portrait 1080x1350 for a share sheet** (chats, stories and feeds are
vertical). Link previews come from the site's `og:image`, never from this PNG.

**Every block that yields, yields to the same rule as the death screen.** The scenes band
is placed against the chips' real bottom edge (a run that earns a record, a ship, a
mission and three stats wraps to a second chip row) and gives up height rather than being
drawn through; the band picks the **fewest rows** that hold every frame it has, so a run
that died in S0 gets two big frames instead of a half-empty strip.

**The footer is never conditional.** Tagline, `flytunl.ch/get` and a QR on every card - a
card forwarded as a bare image must still lead back to the game. The header carries the
**date** for the same reason.

**Printed address vs. QR (2026-10-03, user's call).** The printed address is `/get` (store
hand-off: iPhone -> App Store, Android -> Play, desktop -> both buttons) - someone typing a
URL off a picture carries no `?d`/`?s` anyway, so the install is the useful target. The QR
and `shareRunText()` keep the **challenge** link (`/play/?d&s&r`, which the installed app
also opens): don't move them to `/get`, that would drop the same-cave duel and strand
desktop recipients on two store buttons. The QR stays because it is the only way from a
forwarded image back to that link (second screen, long-press in Photos, stories).

The **QR** is a self-contained encoder in `share.js` (byte mode, ECC M, versions 1-9,
`test-share.js` proves it by reversing the placement and checking the Reed-Solomon
syndromes, not by looking at it). It encodes `shareRunUrl()` - the challenge link, at most
78 characters with `?c`, version 5 (`test-share.js` checks the longest one).

**No link carries a ghost (2026-10-08).** A ghost is up to `GHOST_MAX_SAMPLES` bytes; chat
clients mangle a link that long and a QR cannot hold it. The ghost travels by the worker
instead: see "Challenge link" below. The `?g` parser in `web.js` stays for old links.

Gated by `shareWorthy()` and `shareAvailable()` (a recipient's REMATCH is always offered
past `SHARE_MIN_SCORE`, see below). The card crosses the JS->native boundary as
a base64 PNG, which is why the background is a flat wash, not a gradient (payload size). If
the payload ever needs to shrink, the lever is the scene thumbnails, not the wash.

**The app gate is the DAY, not the career.** A career gate runs backwards to the pride
curve (on constantly in week one, dark once the best settles). A run qualifies at
`SHARE_NEAR_BEST` of **today's** bar (`dailyBest || best`, the same `_fireBar` rule as ON
FIRE), which resets every morning. On web any run past the floor offers it (the share is
the funnel).

**The link is identical on every target.** `web.js _tunlParseWebParams()` is not
`isWeb()`-gated and the Universal/App Link wiring passes the whole query string, so the app
shares `?d`/`?s`/`?c`/`?r` too - don't strip them.

**`?d` and `?r` are packed (2026-09-21).** `?d` is a base36 day-offset from
`WEB_DAY_EPOCH_MS` (never move that epoch - it would repoint already-shared short links at
the wrong cave), `?r` is `webPlayerId()`'s UUID through `_uuidPack()` (22 chars, no
dashes). Both parsers in `_tunlParseWebParams()` (`web.js`) still accept the old plain
forms - 8-digit `YYYYMMDD` for `?d`, a dashed UUID for `?r` - so links shared before this
date keep working; never remove those branches. The packing is link-display-only:
`webPlayerId()` in localStorage and what's sent to the leaderboard worker both stay the
plain UUID.

`SHARE_URL` in `share.js` is the only place the public marketing URL is written down in the
game code; the marketing, support and privacy pages live in `flytunl-site/` (never the
Schedly repo).

Android needs a `FileProvider` for this (`AndroidManifest.xml` + `res/xml/file_paths.xml`)
because `ACTION_SEND` requires a `content://` URI, not raw bytes.

## Share text and challenge link (2026-10-08)

Built from the user's spec "TUNL: Share-Text und Challenge-Link" (phases 1-3; phase 4, a
per-challenge preview image, needs the flytunl.ch DNS zone at Cloudflare and is not built).

**Two buttons: SHARE sends the link, CARD sends the picture ("link first").** SHARE posts
the text with `image: ''`; both native bridges then share plain text (no native change).
Image plus text through a share sheet depends on the target app, and the ones that keep
only the image drop the link, the one part that brings a recipient back. A chat still shows
a picture: the link unfurls from `/play/`'s `og:image`. CARD keeps the old image + text
path, for stories and saving. Desktop: SHARE copies the five-line text, CARD the card plus
the link. Row order from the right: PLAY AGAIN, SHARE (gold), CARD and HOME (quiet).

**The text is five fixed lines** (`shareTextFor`, a pure block between the
`// ── Share text (pure)` and `// ── QR code` banners, sliced and run by `test-share.js`
against every i18n table): `TUNL <LEVEL_NUM> · <WORLD_NAME>`; the score with 🏆 on a new
all-time best and `· 🌍 #rank`; the sector bar; the call (`T.shareTagline`, or
`shareReplyWon`/`shareReplyLost` on a rematch); the link. The bar has one cell per sector
S0-S9 (`SHARE_BAR_SECTORS`): clean, hit (a hull scratch or a shield spent there,
`runHitSectors`), revive (a rewarded continue picked the run up there, `runReviveSectors`),
the crash, then unreached; deeper runs add ` 🔥N`, stars ` ⭐N`. Revive outranks hit in a
sector. Arabic gets an LRM so S0 stays first. Every emoji is Unicode 12 or older.
`runHitSectors`/`runReviveSectors` are pure statistics (`markRunSector`, `sectorAt`), never
read by placement or rng.

**Challenge link.** `?c=<id>` (10 chars base62, made on the device by `newChallengeId()`,
rejection-sampled) names a worker row with the sender's score and ghost
(`flytunl-site/worker` "Challenge link", tables `challenges` and `challenge_runs`). `?d`
and `?s` stay in the link: the cave must be known at script load and the score makes the
banner instant, so with the worker down a recipient gets exactly the old `?d` + `?s` duel.
- **Sender** (`challengeEnsure`, from `shareRun`): one id per run, SHARE and CARD reuse it;
  the upload runs alongside the share sheet, queued in `tunnel_challenge_outbox` first and
  retried at the next boot (5 entries, 24 h; any answer below 500 ends it).
- **Recipient**: `challengeFetch()` at boot (2.5 s timeout) puts the ghost in through
  `applyFriendGhost()`, the same decoder the `?g` path uses; a ghost from another cave day
  is ignored, one arriving mid-run waits for the next run. `challengeActive()` is the
  gate everywhere: a `?c` with a score, not sent by this player (the link's own `?r` tells
  that before the worker answers). Title: a banner under the stats (score, "same cave, beat
  the ghost", the cave's date for a past day) - it names the opponent, so the "no title
  control hint" rule is untouched. Death screen: a chip BEATEN +n / n SHORT, plus "b of p
  beat it" once the worker has counted two answers. SHARE reads REMATCH and is offered past
  `SHARE_MIN_SCORE` whatever `shareWorthy()` would say (the answer is the loop); the new
  challenge's `parent` is the one answered.
- **Inbox**: `checkChallengeInbox()` at boot reports runs on this player's challenges once
  each (the worker marks them seen in the same statement); a title card in the arrival
  card's slot after it, `CHALLENGE_INBOX_SEC`. A run that newly beats a challenge is
  reported again as a beat.
- **Tokens**: the worker refuses a token younger than 8 s. `startPlay()` prefetches one and
  `_webLbTokenAged()` waits out the rest, which also fixed the web leaderboard refusing a
  session's first submit.
- **CORS (2026-10-08)**: the worker now answers each allowed origin with itself
  (`withCors`). It used to answer `https://flytunl.ch` to everyone, so the apps' WebViews
  refused every reply: referral calls from the apps never got their answer.
- **Analytics**: `share_open` (kind, reply), `challenge_open` (ok, past, mine),
  `challenge_run` (beat, is_new), through `appEvent` and `window._tunlGA`; the worker's
  `GA_EVENTS` allowlist names them.
- **Android install referrer (phase 3)**: a Play button on a challenge or referral page
  appends `&referrer=c..d..s..r` (`playStoreUrlWithReferrer`, `/get` the same);
  `MainActivity.kt startGame` reads it once on the very first start without an App Link,
  keeps only those four keys and waits at most `REFERRER_WAIT_MS`. iOS has no such channel:
  the web pitch tells iPhones to tap the link again (`T.challengeAfterInstall`).
- **Measure**: `GET /c/stats?key=<REPORT_KEY>` per day; K-factor = new_players / senders
  over 7 days. A known player on a new device counts as new.

**Device test matrix** (spec section 9) - fill in per row when tested on real devices:

| Target | iOS | Android | Result |
|---|---|---|---|
| WhatsApp: text whole, emoji right, link tappable, preview image | | | not tested |
| iMessage: preview, link opens the app | | | not tested |
| Telegram, Signal | | | not tested |
| Instagram DM, Messenger: link opens the in-app browser, game runs | | | not tested |
| Desktop Slack, Discord, WhatsApp Web: clipboard, preview | | | not tested |
| CARD into an Instagram story: image arrives, QR scans | | | not tested |
