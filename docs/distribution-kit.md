# TUNL Distribution Kit

Written 2026-09-10 off the first real funnel measurement (see "The numbers" below).
Everything here is ready to use; nothing here has been posted or uploaded. Posting is
deliberately left as your own action.

## The numbers this is answering

Measured 2026-09-10, not estimated.

| Source | Metric | Value |
|---|---|---|
| iOS (App Store Connect, 90 days) | Impressions | 12,400 |
| | Product page views | 411 (**3.3%** of impressions) |
| | First-time downloads | 56 (**13.6%** of page views) |
| | Overall conversion | 0.7% |
| | Revenue | "Daten nicht ausreichend" |
| Android (Play Console) | Active installs | 12 |
| | Users acquired | 10 |
| | Google Play rating | none (zero ratings) |
| | Gross revenue | none |
| Web (`/r` endpoint, 14 days) | Distinct daily players | 0-4, one spike of 17 on the Reddit day |

**The headline is the 12,400 impressions.** That is real, free, recurring App Store
exposure that already exists and is currently converting at roughly half the normal
rate at both stages. Fixing conversion is worth more than new traffic, and costs no
ad budget.

## Priority 1: fix the store conversion before chasing traffic

Ranked by expected impact per hour of work.

### 1a. Verify the search-result card actually shows a screenshot

3.3% impression-to-page-view is the symptom you would expect from the long-standing
issue where TUNL's search card renders empty because every uploaded screenshot is
landscape. The only portrait sets currently in this repo are `Screenshots/iOS_10.2/pl/`
(built during the Polish recaption work). **Open the App Store app, search "TUNL", and
look at the result card.** If it is blank, this single upload is the highest-value
action available: it is the difference between 12,400 people seeing nothing and 12,400
people seeing the game.

### 1b. Get the first ratings

Google Play shows no rating at all, which removes the strongest piece of social proof
a listing has. The in-app review prompt (`maybeRequestReview`, `src/update.js`) currently
fires only when *all* of these hold: a new all-time best, a prior best already existed,
score >= 25, and no prompt in 90 days. With a base this small almost nobody ever hits
that intersection. Loosen it: any run over a decent score, on maybe the third or fourth
session, is still far inside both stores' own throttles.

### 1c. Rewrite the first screenshot as a hook

Page-view-to-download of 13.6% against a typical 25-35% for games means the listing is
not closing. The first screenshot is doing most of that work. Lead with the one thing
no competitor has: everyone flies the identical cave today, and you race your own ghost.

## Priority 2: traffic

### Tracked links

The worker already logs clicks. Format:

```
https://tunl-scores.theodoracatos.workers.dev/go/<source>/<campaign>?to=play&m=<medium>
```

`to=play` lands on the playable web build (use this for social - it removes the install
step). Drop it to land on the homepage. Read the results back with:

```
GET /clicks?key=<REPORT_KEY>&since=YYYYMMDD
```

Ready-made links:

| Where | Link |
|---|---|
| r/playmygame | `.../go/reddit/playmygame?to=play&m=post` |
| r/incremental_games | `.../go/reddit/incremental?to=play&m=post` |
| r/WebGames | `.../go/reddit/webgames?to=play&m=post` |
| TikTok bio | `.../go/tiktok/bio?to=play&m=social` |
| itch.io | `.../go/itch/listing?to=play&m=listing` |
| Hacker News | `.../go/hn/showhn?to=play&m=post` |

### Reddit drafts

The one Reddit post you made produced 17 players and the only real player feedback the
game has ever received ("acceleration too fast", which became the 10.2 THRUST retune).
That is a channel with a 1-for-1 hit rate and one attempt. Post the drafts below to
different subreddits, spaced out, and reply to every comment.

**r/WebGames** - title: `TUNL - a daily cave flyer where everyone on Earth flies the exact same tunnel`

> Every day the cave is generated from the UTC date, so the tunnel you fly is pixel-identical to the one everyone else is flying that day. Your best run becomes a ghost you race for the rest of the day.
>
> Hold to thrust, release to fall. That is the whole control scheme.
>
> Plays in the browser, no install: [link]
>
> Solo project, no engine, plain canvas and about 11k lines of JS. Happy to answer anything about how the daily seed or the ghost recording works.

**r/playmygame** - title: `[Feedback wanted] TUNL: daily-seed cave flyer, browser playable, looking for opinions on the difficulty curve`

> Hold to climb, release to fall, collect coins to widen the tunnel. Same cave for every player each day so scores are comparable.
>
> Specifically after feedback on: does the early difficulty feel fair, and does the run feel too short or about right?
>
> [link]
>
> I will play and comment on anything posted back.

**Show HN** - title: `Show HN: TUNL - a daily cave flyer with no backend for its ghost replays`

> The corridor is a pure function of world-x and the UTC date, so replaying a run needs nothing but the ship's vertical position over time: one byte per 60 pixels, a few hundred bytes for a whole run. No obstacle log, no input log, no seed capture, no server.
>
> Same property makes the daily leaderboard fair without trusting the client about the world.
>
> [link]

### itch.io

The web build already exists and is already deployed, so this is a listing, not a port.
itch.io has its own browse traffic and costs one evening.

## What not to do

- Do not buy installs yet. Sending paid traffic into a listing converting at 0.7%
  burns money to prove what the 12,400 free impressions already prove.
- Do not build more game systems. See the audit: no measured player reaches the deep-run
  content, mastery, or the upper ship tiers.
