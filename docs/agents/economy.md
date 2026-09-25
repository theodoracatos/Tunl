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
- **Web shows the app's controls greyed out, never hides them** (2026-09-25, user's call):
  the Game Center leaderboard and challenge icons on the title rail and the PAINT pill on
  ALL SHIPS are drawn dimmed on web, and a tap opens the "in the app" sheet
  (`state.js appOnlyKey`, `draw.js drawAppOnlySheet`, strings `T.appOnly*`) with the store
  buttons - the challenge offers the App Store only (iOS-only) and is not shown to an
  Android browser. **The Lackiererei is app-only**: web never opens the Paint sheet; a kit
  a web player already owned still renders. `test-sim.js` guards the app side.
  The Missions drawer's shard-ad row works the same way while web has no rewarded ad of
  its own (`shardsAdAppOnly()` in `ads-web.js`, keyed to the `ADS_WEB_NETWORK_CODE`
  placeholder): label `T.watchAdShardsApp`, tap opens the sheet, and the rail badge counts
  N/3 since the row cannot be done there. Filling in a real network code reverts all of it.
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

**The streak pays in shards, not only in stardust (2026-09-22).** The +1 bonus ✦ only moves
a player who is already stardust-bound, and at a realistic daily income shards bind the lower
tiers - so every `STARDUST_STREAK_BONUS_DAY`-th unbroken day also pays `STREAK_WEEK_SHARDS`
straight into the wallet, outside `DAILY_SHARD_CAP` like the mission and rewarded-ad payouts,
and banks one rest day (`STREAK_GRACE_MAX`). **A rest day absorbs a single missed day instead
of resetting the streak; two missed days still reset it, and banked stardust is never taken
away.** `bestStreak` (`state.js`) is monotonic and is what the streak paints read, so an
earned part can never be taken back. All of it runs in `lifecycle.js` `dayRollover()`, which
is called from **both** `titleScreen()` and `startPlay()` - opening the app is what earns the
day, and a session left open across midnight still rolls over. `test-sim.js` guards the
streak, the crate, the rest day and `bestStreak` against the real function.

**Stardust says what it is, where it is asked.** The ALL SHIPS wallet always shows ✦ with the
"flight days" label (it used to hide at 0 and after the last ship), a locked tier reads "in N
days" instead of `3/5 ✦`, tapping ✦ opens the **stardust path** (`showStardustPath`, the full
day-0-to-last-ship track with the earned paints on it), and the day's grant is reported once
on the title (`dayGrant` / `DAY_GRANT_SEC`) and once as a chip on the first death screen of
the day. The 19:00 reminder swaps one text variant for the streak line from
`NOTIF_STREAK_MIN` on - never as a threat.

**The shard ladder (`SKINS[].cost`) is set just under what each tier's stardust gate implies,
so stardust is the binding constraint at every tier** and the last ship lands on its gate
day. **Re-run the numbers before changing either side - a shard-side raise silently
re-breaks the gate schedule.** The old ladder flipped the binding constraint to shards and
made the top tiers unreachable (`docs/design-history.md` -> "Ship unlock economy").

**Hangar paint, the Lackiererei (2026-09-22, replaced the six fixed liveries of 2026-09-17).**
Catalogue and prices in `PAINT_*` (`constants.js`), rendering and the Paint sheet in
`src/paint.js`, ownership and kits in `state.js`. The sheet opens from the PAINT pill on the
ALL SHIPS sheet once `LIVERY_GATE_SKIN` is owned, so the first paid ship stays the first shard
goal. The user called the old set "langweilig, nicht abwechslungsreich": it could only lighten
or darken the ship's own hue, so all six read as one ship. Rules, each load-bearing:
- **A kit of five slots** (`PAINT_SLOTS`): hull colour, pattern, pattern colour (accent),
  material (finish), reactive effect. Each part is **bought once for the hangar** and combined
  freely **per ship** (`shipPaint`, keys `tunnel_paint_owned` / `tunnel_ship_paint`). Colours
  are one catalogue shared by the hull and the accent slot. **Not part of Unlock All Ships.**
- **The hull may change hue; the ship's LIGHT never does.** Glow, nozzles, intake rings,
  running lights, strobes and the share-card glyph's glow stay in `SKINS[].shadow` - that is
  what keeps a RACING-red PEARL readable as PEARL. Never paint the light.
- **Purely visual** - no perk, hitbox, placement or leaderboard effect, no `shadowBlur`, no
  `rng()`. The ghost and the wrecked death frame always draw FACTORY (kit 0).
- **Earned parts** (`earn`: GOLD best 500, ORBIT all 7 worlds, DIAMOND 30 stardust, COMET and
  ECLIPSE on `bestStreak`) are read live from monotonic stats, never stored, and can never be
  bought. A streak part reads the BEST streak, never the current one - a paint that a missed
  Tuesday takes away again would be the only part in the hangar that can be lost.
- **The Paint sheet is five tabs over a grid of exactly TWO rows** - a third row does not fit
  the screen (user's call). A catalogue that grows gets more columns, never another row;
  `test-sim` fails if a part lands outside the panel or on a third row.
- **No RANDOM and no DAILY PAINT button** (dropped on the user's call 2026-09-22, right after
  they were built): the sheet offers the parts, nothing else. A daily free kit and a shuffle
  were both in the concept; do not re-add either without being asked.
- **Reactive effects read the flight** (`paintSignals`): EMBER = thrust (eased heat), PULSE =
  last coin (`paintCoinFx`, set in systems.js, presentation only), AURORA/NACRE = climb roll,
  NEBULA = scrollX, FIRESTORM = score toward the record, full blaze ON FIRE. Outside a run a
  scripted loop plays them so they can be judged before buying.
- **Everything from big masses** (~35px in flight); detail only on top of a mass. The traps
  still hold: **a mark on the NOSE is invisible**, **small repeated details read as damage**,
  **an additive wash has no headroom on a pale hull** (pale paints use `source-over`). A
  FACTORY accent on a factory hull is **ink or light by luminance**, never a lighter shade of
  the hull (light amber on AMBER vanished).
- **Prices**: the full kit (7870) is ~98 days of the ~80 shards/day a real player banks; the
  old set (1240) was done in ~15. Old finishes migrate once (`PAINT_LEGACY`): owners get the
  parts, ships keep their look.

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
