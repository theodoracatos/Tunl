# AdSense rejection + web content work - handoff

Working note, written 2026-09-18. Covers the session of 2026-09-15 and what is still open.
Not a spec; this is "where things stand so you can pick up cold".

---

## TL;DR

AdSense **rejected** flytunl.ch on 2026-09-15 for **"Minderwertige Inhalte"** (low-value
content). Two substantial content pages were written and deployed as the fix, and a
**re-review was requested the same day**. Everything is committed, pushed and live.

**The one thing to check first after reboot:** did the AdSense re-review clear?
It was submitted 2026-09-15. The first review took 8 days, so a verdict is plausible
around 2026-09-23.

```
https://adsense.google.com/adsense/u/0/pub-4882203470005029/sites/list
```

Status was "Wird vorbereitet" when last seen. I could not re-check on 09-18 because the
Chrome extension was disconnected.

---

## Repo state (verified 2026-09-18)

- Branch `main`, clean, **everything pushed**, 0 unpushed commits.
- Only untracked files are your own `store-metadata/14.0/follow-up-prompt*.md`.
- Relevant commits:
  - `a5d74f9` - web-only run recording + audio master bus
  - `64789c5` - the two content pages (the AdSense fix)
  - `17b8657` - later updated `/how-to-play/` for the 13.0 coin redesign (already done)

Nothing is half-finished. You can reboot without losing anything.

---

## What happened

Google's verdict was fair. Measured visible word counts on the site before the fix:

| Page | Words |
|---|---|
| `/` homepage | 836 (a feature list) |
| `/privacy` | 1070 (boilerplate legal - Google does not count this) |
| `/press` | 339 |
| `/support` | 231 |
| **`/play`** | **12** |
| 6 locale homepages | duplicates of `/` |

A brochure site plus a text-free canvas. That is the textbook low-value-content profile,
and game-only sites are one of the harder categories to get approved.

---

## What was built (live now)

| Page | Words | What it is |
|---|---|---|
| `/devlog/daily-cave/` | ~2,400 | Technical devlog: how the daily cave is generated from a UTC date, the four independent rng streams, day archetypes, and the two determinism bugs (screen width forking the shared cave from score 15; deep-run content gated past where any real run reaches) |
| `/how-to-play/` | ~1,500 | Player guide: controls, scoring, all 8 coin types, hazards in unlock order, strategy |

Both are hand-written tracked files under `flytunl-site/site/`, in the sitemap,
cross-linked, and linked from the homepage footer with translations in all 7 site
languages (`footer.devlog`, `footer.howto` in `flytunl-site/i18n/home.json`).

Site went from ~2,500 visible words (mostly legal) to ~6,400.

---

## Two hard-won constraints - do not re-litigate these

**1. Never put text content on `/play`.**
`tunl.html` sets `body { height:100dvh; overflow:hidden }`. Anything injected below the
canvas is present in the DOM but invisible to users. That is hidden text, which is its
own AdSense policy violation, so it would make things worse, not better. Standalone
pages are the only safe route - and the only ones that can rank anyway.

**2. Waiting for search indexing before re-requesting a review is unnecessary.**
The AdSense reviewer fetches the site directly; it is not driven by the search index.
Live + linked + in sitemap is sufficient. (I advised waiting; that advice was wrong.)

---

## The traffic reality - read this before spending more effort here

Measured 2026-09-15 from the leaderboard D1 (`scores` has one row per browser per day):

```
2026-09-15  2     2026-09-09  17   <- Reddit share
2026-09-14  1     2026-09-08   2
2026-09-12  1     2026-09-07   1
2026-09-11  2     2026-09-06   1
2026-09-10  4     2026-09-05   1
                  2026-09-04   1
```

**~3 unique web players/day.** 33 player-days over 11 days.

Re-run:
```bash
npx wrangler d1 execute tunl_scores --remote --command \
  "SELECT day, COUNT(DISTINCT pid) AS players FROM scores GROUP BY day ORDER BY day DESC LIMIT 30;"
```

At that scale, web ads are worth roughly **$1-9/month**. Generously: 90 players/month x
3 impressions x $5 CPM is about $1.35.

The original motivation was a fear that web players are cannibalizing app installs and
costing real revenue. **That does not hold at this scale** - you cannot lose much to a
channel with ~90 visitors a month. The binding constraint is **distribution, not
monetization plumbing**.

So the content work is justified as an SEO/distribution play that happens to also
satisfy AdSense. Not the reverse. If you find yourself doing more work purely to unlock
$2/month, stop and do distribution instead.

**Editorial rule applied:** the devlog deliberately does **not** publish engagement
numbers (e.g. the all-time daily best). Putting "hardly anyone plays this" on a page
whose job is attracting players is self-defeating. The bug story works fine as
"essentially nobody was getting near it".

---

## Open items, highest value first

### 1. Post the devlog to Reddit / HN  <- the one that actually matters

This is the step most likely to move the needle and the one most likely to get skipped.
Your only visible traffic signal ever was the 17-player spike from a Reddit share.

Targets: **r/proceduralgeneration**, **r/gamedev**, possibly Hacker News.

The devlog was written for exactly this audience. "Here is my clever generator" is a
dime a dozen; **"here are two ways my determinism guarantee silently broke and how I
found them"** is the part people upvote and share. The two stories are:
- Spawn loops reach `scrollX + W`, so screen width decided when a position's spacing was
  rolled - six device sizes produced six different caves, diverging from score 15.
- Deep-run content was gated at score ~900; a red-team sim (2,400 runs, 4 skill tiers)
  measured the real-player tier reaching it in 0% of 600 runs. It was content nobody had
  ever seen, including me. Gate moved to score ~150.

Ask me to draft the post when you want it. Do **not** lead with "I made a game".

### 2. Check the AdSense re-review
See TL;DR. If rejected again, the likely reads are (a) the site is still mostly a game
plus a few pages, or (b) they want more depth. Next lever would be 2-3 more devlog posts
rather than tweaking the existing ones.

### 3. If approved: Google Ad Manager signup
Blocked until approval. Then:
1. Sign up for GAM (free tier) with the approved AdSense account.
2. Create 3 out-of-page units: 1 Gaming Interstitial, 2 Rewarded.
3. Fill `ADS_WEB_NETWORK_CODE` in `src/ads-web.js` (search `REPLACE_WITH_NETWORK_CODE`);
   units are expected to be named `tunl_web_interstitial`,
   `tunl_web_rewarded_continue`, `tunl_web_rewarded_shards`.
4. `npm run build:play` + `flytunl-site/deploy.sh`, then a real smoke test.

EU consent needs no work: `adsbygoogle.js` auto-injects Funding Choices. It currently
reports `cmpLoaded:true, cmpId:300, gdprApplies:true` but `displayStatus:"hidden"` -
dormant until the site is approved. `FUNDING_CHOICES_SNIPPET` in `build-play.mjs` is an
override slot only; do not hand-write Google's boilerplate (compliance risk).

---

## Console gotchas (cost real time, keep them)

- `adsense.google.com/adsense/u/0/home` falsely shows "Zugriff verweigert". Go directly
  to `.../u/0/pub-4882203470005029/<page>`.
- The Websites list renders its row lazily. A first screenshot often shows an empty or
  ghosted row - re-read the page text or zoom the row rather than trusting it.
- **Coordinate clicks do not work on the AdSense site-detail page.** Viewport is
  1900x964 while the screenshot renders at 1545x784. Use `read_page` and click by
  accessibility ref.
- **Submitting a re-review:** `/sites/detail/url=flytunl.ch` -> expand "Es wurden
  Richtlinienverstöße gefunden" -> tick "Ich bestätige, dass ich die Probleme behoben
  habe" -> "Überprüfung beantragen".
- A "Nicht gefunden" ads.txt status appeared once on 09-14 and was **stale** (its
  timestamp never moved) - it corrected itself. ads.txt has always been correct and
  reachable. Verify with `curl -sI https://flytunl.ch/ads.txt` before believing the
  dashboard.

---

## Quick verification commands

```bash
# pages live?
for u in / /how-to-play/ /devlog/daily-cave/ /play/ /sitemap.xml; do
  printf "%-22s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' https://flytunl.ch$u)"
done

# ads.txt actually serving?
curl -s https://flytunl.ch/ads.txt

# recording feature present on the web build?
curl -s https://flytunl.ch/play/ | grep -o 'id="rec-btn"'

# before any commit (project rule)
npm test && node test-i18n.js
```

---

## Also shipped in that session

`a5d74f9` - the **web-only run recording** feature (`src/record.js`) that was sitting
uncommitted in the working tree. Records a run via `canvas.captureStream()` plus a
`MediaStreamAudioDestinationNode` tapped off a new `_master` bus in `audio.js`, so
recordings carry real game audio. Gated on `isWeb()` **and** on browser support, with
the `tunl.html` UI shipping `display:none`/`aria-hidden`, so the iOS/Android builds are
unaffected. REC/DOWNLOAD strings added across all 15 locales. `npm test` and
`test-i18n.js` were green before commit.
