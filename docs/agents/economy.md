# Ads, ship economy, liveries, future features

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the measurements and rejected alternatives behind them are in `docs/design-history.md` (the 2026-09-21 condensing moved the removed paragraphs there verbatim, under "Narratives moved out of docs/agents").

## Ad cadence

Every Nth death **and** at most once per wall-clock window, above `MIN_REAL_RUN_SCORE`
(mirrored as `minScoreForAd` in `AdsManager.swift`/`.kt` and `AD_MIN_SCORE` in
`ads-web.js` - **keep all four in sync**), never with Remove Ads. The wall-clock floor is
the rule that matters: a good run lasts only seconds, so every-Nth-death alone put an ad in
front of engaged players every ~90s. When the floor blocks, the death counter rolls back one
so the two rules don't compound.

That is the only *forced* ad. There are also two **opt-in rewarded videos**, each on its
own dedicated AdMob unit and each still shown to Remove Ads owners (Remove Ads buys out
the forced interstitial, not a video the player actively taps):
- **Rewarded continue** (8.1) - offered once per run from `CONTINUE_MIN_SCORE` on death;
  revives the run **and repairs the hull to `HULL_SCRATCHES`** (`grantRevive` resets
  `hullScratches`/`wallGraceT`, `+HULL` notif) - otherwise the ad bought seconds at the
  hardest point of the run. **No extra shield on top (user's call)**: the revive already
  recentres, bomb-clears and grants `HIT_INVULN_SEC`; a shield would blur "scratches
  forgive wall mistakes, direct hits are the shield's job". If revisited, measure death
  cause by sector per tier first. See the Rewarded continue notes in `constants.js`.
- **Web has no rewarded video, so the offer slot carries the app pitch**
  (`WEB_CONTINUE_PROMO_SEC`, `draw.js drawWebContinuePromo`). The ring appears captioned
  `T.secondLifeApp` with "+1"; a tap opens a card (day accent, the player's ship, both store
  buttons) for the length of a rewarded video, dismissible from `WEB_PROMO_DISMISS_SEC`.
  **It never grants a revive** (a free one on web would outrank app players who watched an
  ad, on the shared leaderboard), and **the caption is honest before the tap**. `isWeb()`-
  gated end to end; the apps decide on `rewardedAdReady` alone.
- **Rewarded shard bonus** (8.2) - a row at the bottom of the Missions drawer: watch an
  ad once per UTC day for a flat `SHARDS_AD_REWARD` (20) shards, exempt from
  `DAILY_SHARD_CAP` like a mission reward. Native plumbing
  (`shardsAdRequest` / `_tunlShardsRewardGranted` / `_tunlShardsRewardDeclined` /
  `shardsAdReady`) mirrors the continue's 1:1. With no native bridge (browser) the row
  stays inert.

## Ship unlock economy

Every paid ship (`SKINS` in `src/constants.js`) needs two things at once:
- **`cost` shards** - earned from collected coins (`runCoins`, banked at death), capped by
  `DAILY_SHARD_CAP`; the 3 daily missions and the rewarded-ad bonus (`SHARDS_AD_REWARD`) are
  exempt (real ceiling ~300/day).
- **`stardustGate` days played** - `stardust` in `state.js`, +1 per calendar day opened
  regardless of skill or how much is played, +1 bonus per 7-day unbroken streak. Never
  spent, only checked as a `>=` threshold, so a tier's gate doesn't stack on the next.

The Stardust doc block in `constants.js` has the worked timelines per player tier and why
neither currency alone can do this job.

**The shard ladder (`SKINS[].cost`) is set just under what each tier's stardust gate implies,
so stardust is the binding constraint at every tier** and the last ship lands on its gate
day. **Re-run the numbers before changing either side - a shard-side raise silently
re-breaks the gate schedule.** The old ladder flipped the binding constraint to shards and
made the top tiers unreachable (`docs/design-history.md` -> "Ship unlock economy").

**Hangar liveries (cosmetic, phase 1 of the cosmetics concept).** Finishes and prices in
`LIVERIES` (`constants.js`), bought in a Paint sheet from a PAINT pill on the ALL SHIPS
sheet, which only appears once `LIVERY_GATE_SKIN` is owned, so the first paid ship stays
the first shard goal. Rules, each load-bearing:
- **Purely visual** - no perk, hitbox, placement or leaderboard effect. No `shadowBlur`.
  The ghost and the wrecked death frame always draw FACTORY.
- **Bought once for the hangar, equipped per ship** (`shipLiveries` in `state.js`, key
  `tunnel_ship_liveries`, migrated from the old single `tunnel_livery`), so each ship keeps
  its own look without re-buying anything. **Not part of Unlock All Ships** (separate save
  keys `tunnel_liveries` / `tunnel_ship_liveries`). Names are untranslated proper nouns, like ship names.
- **It re-shades the ship's own facets** (`_shipTones` livery arg) or paints a clipped
  pattern (`_drawLiveryOverlay`), **never changes the hue**, so ship identity stays readable.
- **Every finish is built from big masses** (half the hull, a rim, a band, a full-hull
  gradient): in flight the ship is ~35px across and fine patterns vanish. Detail may sit
  **on top of** a mass, never instead of one; a light mass must flip dark on a pale ship
  (PEARL/NOVA).
- **Every finish moves in colour** - paint that only sits there reads as a recolour, not
  worth shards. The motion is **one** gradient fill or stroke riding `gtime` per frame,
  never particles or a second pass over the hull.
- **Each finish carries one signature mark** (see each finish's code); AURORA alone may
  exceed the usual +-24 hue spread.

Three traps: **a mark on the NOSE is invisible** (canopy and leading-edge highlight draw
over it); **small repeated details read as damage, not paint**; **an additive wash has no
headroom on a white hull** - on a pale ship paint with `source-over`, not `lighter`.

Later phases in the concept: exhausts and trails, wreck effects and share-card frames,
mastery/achievement rewards, and only then an optional real-money pack of named items
(never random drops).

**Unlock All Ships IAP**: non-consumable `unlock_all_ships` (next to `remove_ads`) that
force-unlocks every ship, current and future (`allShipsOwned` in `state.js`, **re-applied
on every load**, never a snapshot). Priced above Remove Ads because it skips up to a year of
daily return and ships carry real perks. Shop UI in `draw.js` `showShop`; the bridge is
product-ID-keyed in `IAPManager.swift` / `BillingManager.kt` (mirror each other).
**Shards and stardust are untouched** - an entitlement flag, not a currency grant.
`Configuration.storekit` is for local testing only.

## Possible future features

- Multiple difficulty modes
- Mobile fullscreen on iOS/Android
- Level theming (lava/ice/neon)
- Additional coin types beyond the current eight (gold/blue/red/orange/green/bomb + the two hazards poison/drain)
- Friend ghosts carried inside a share link (see Ghost run below - the local ghost is
  already only a few hundred bytes, so a shared one is mostly a transport problem)
