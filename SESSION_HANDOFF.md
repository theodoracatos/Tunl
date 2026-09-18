# TUNL growth/Reddit session — handoff (saved 2026-09-18)

Untracked scratch file (not part of the game repo's real content) — safe to delete once you've
picked this back up. Full durable memory of this campaign also lives in
`/Users/theodoracatos/.claude/projects/-Users-theodoracatos-Development-Tunl/memory/project_reddit_karma_building.md`
(and is indexed in that project's `MEMORY.md`) — this file is just a fast-resume snapshot.

## Where things stand right now

**Reddit account (u/Theodoracatos): still 3 total karma (1 post / 2 comment), unchanged for
over a week.** Karma-building via genuine r/playmygame playtest comments is a confirmed dead
end — ~20+ genuine comments there produced zero net karma gain. Don't keep pursuing that route.

**Live TUNL posts, all checked as of 2026-09-16, no new comments/replies on any of them:**

| Sub | Status | Link |
|---|---|---|
| r/playmygame | posted, real engagement (drove the THRUST 3400→3100 tuning fix) | https://www.reddit.com/r/playmygame/comments/1wblfhp/ |
| r/WebGames | posted, real engagement (Cloudflare/China connectivity report, resolved as not-our-bug) | https://www.reddit.com/r/WebGames/comments/1wbptgi/ |
| r/IndieGaming | posted, 1 comment (AutoModerator Discord plug only) | https://www.reddit.com/r/IndieGaming/comments/1wcv09w/ |
| r/hypercasual | posted 2026-09-11, **still 0 comments after 4+ days** | https://old.reddit.com/r/hypercasual/comments/1wdtyk2/ |
| r/freegames | **auto-removed** by AutoModerator (hidden 10-karma gate, not in visible rules) | https://old.reddit.com/r/freegames/comments/1wcvr5o/ |
| r/IndieDev | can't post directly (20 comment-karma gate); commenting weekly in the recurring Monday megathread instead | see below |

**r/IndieDev Monday megathread — the one working recurring channel.** A brand-new thread goes
up every Monday (posted by u/llehsadam). Comment-only self-promo is explicitly invited there
even without enough karma to post directly. Two comments so far:
- 2026-09-10 (Sept 6 thread): https://old.reddit.com/r/IndieDev/comments/1w99lm6/rindiedev_weekly_monday_megathread_september_06/p913sbc/
- 2026-09-14 (Sept 13 thread): https://old.reddit.com/r/IndieDev/comments/1wfl29c/rindiedev_weekly_monday_megathread_september_13/p9scznc/
  led with the real flight-plan/sector rework from the red-team audit rather than repeating the
  generic intro. **As of 2026-09-16 this comment had 0 replies and a near-zero fuzzed score.**

**r/AndroidGaming and r/iosgaming remain blocked** — confirmed by reading their actual rules
pages (not just the submit form): AndroidGaming requires a 1-month-old account with 50+
community karma; iosgaming restricts self-promo to a Saturday Developer Megathread with its own
unstated karma/age minimum. Current 3 karma doesn't clear either bar.

## Standing patterns to follow, next time you pick this up

1. **Every Monday**: check r/IndieDev for that week's fresh megathread
   (`https://old.reddit.com/r/IndieDev/` — it's stickied/announcement-flaired at the top), and
   post a **new** comment there — don't copy-paste the old one verbatim. Lead with whatever real
   dev work happened that week (a shipped balance pass, a new feature, a bugfix worth mentioning)
   rather than the generic intro every time.
2. **Check-ins on existing posts** (hypercasual, playmygame, WebGames, IndieGaming, the IndieDev
   comments) don't need to be frequent — engagement has been slow/nonexistent, so once every
   few days is enough. Fastest way to check: `https://old.reddit.com/message/inbox/` for new
   replies, or open each permalink directly.
3. **CAPTCHA is a hard stop for automation** — Claude can fill in a submit form's fields (title/
   url) via browser automation but can never check the "I'm not a robot" box or click final
   submit on a fresh post; that step is always handed back to you. Comments (not new posts)
   don't have this problem — those can be typed and submitted end-to-end.
4. **Browser automation gotcha**: use `read_page` element refs, not raw pixel coordinates, when
   filling Reddit's submit/comment forms — the rendered viewport width has been observed to
   shift between screenshots within the same session, which silently misses fields if you're
   clicking by coordinate.
5. If a brand-new candidate subreddit comes up, check its real gate before posting: read
   `old.reddit.com/r/<sub>/about/rules` (rules tab) AND actually load `/r/<sub>/submit` (some
   gates, like r/freegames' 10-karma AutoModerator rule, are enforced silently and only surface
   as an instant post-removal, not in visible rules text).

## Other open threads from this conversation (not yet acted on)

- **TikTok**: account is brand new (0 followers). Recommended organic strategy discussed but not
  yet executed: short (7–15s) gameplay clips leaning on near-miss/death hooks, the daily
  "beat my score" / ghost-run framing as a duet/stitch prompt, link-in-bio CTA stated explicitly
  on-screen (since the real funnel bottleneck is store conversion, not awareness — see
  `project_funnel_baseline_2026-09-10` in memory). Nothing posted yet as of this session.
