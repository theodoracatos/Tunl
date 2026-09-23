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

**The footer is never conditional.** Tagline, `flytunl.ch/play` and a QR on every card - a
card forwarded as a bare image must still lead back to the game. The header carries the
**date** for the same reason.

The **QR** is a self-contained encoder in `share.js` (byte mode, ECC M, versions 1-9,
`test-share.js` proves it by reversing the placement and checking the Reed-Solomon
syndromes, not by looking at it). It encodes `shareRunUrl(true)` - the link **without**
the ghost, ~80 characters, version 5 - because a ghost is up to 1500 characters and would
push the code past what is scannable at any size a card can afford.

**The shared text link (`shareRunText()`) is compact too (2026-09-21)** - same
`shareRunUrl(true)`, no ghost. A ghost is up to `SHARE_GHOST_MAX_B64` (1500) base64 chars,
roughly one byte per score point, and chat clients mangle or truncate a link that long.
`?d` + `?s` still hand the recipient the same cave and a score to beat; only the ghost race
is lost. If the ghost-in-link duel ever needs to come back, the fix is server-side (store
the ghost, share a short id), not raising this cap back up.

Gated by `shareWorthy()` and `shareAvailable()`. The card crosses the JS->native boundary as
a base64 PNG, which is why the background is a flat wash, not a gradient (payload size). If
the payload ever needs to shrink, the lever is the scene thumbnails, not the wash.

**The app gate is the DAY, not the career.** A career gate runs backwards to the pride
curve (on constantly in week one, dark once the best settles). A run qualifies at
`SHARE_NEAR_BEST` of **today's** bar (`dailyBest || best`, the same `_fireBar` rule as ON
FIRE), which resets every morning. On web any run past the floor offers it (the share is
the funnel).

**The link is identical on every target.** `web.js _tunlParseWebParams()` is not
`isWeb()`-gated and the Universal/App Link wiring passes the whole query string, so the app
shares `?g`/`?s` too - don't strip them.

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
