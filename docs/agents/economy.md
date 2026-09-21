# Ads, ship economy, liveries, future features

Moved verbatim from CLAUDE.md on 2026-09-21 (progressive disclosure). CLAUDE.md keeps the one-line rule and points here.

## Ad cadence

Every 4th death **and** at most once per 120s of wall clock, above `MIN_REAL_RUN_SCORE`
(75, `constants.js`; mirrored as `minScoreForAd` in `AdsManager.swift`/`.kt` and
`AD_MIN_SCORE` in `ads-web.js` - keep all four in sync), never with Remove Ads. That
floor was 25 everywhere until 2026-09-14, which the 12.0 safe opening flight had silently
turned into a no-op - see the `MIN_REAL_RUN_SCORE` doc block. The wall-clock floor is the rule that actually matters: a good run lasts only
20-36 real seconds, so a pure every-Nth-death rule put a full-screen ad in front of
engaged players roughly every 90 seconds. When the floor blocks, the death counter is
rolled back one so the two rules don't compound into a much longer gap than intended.

That is the only *forced* ad. There are also two **opt-in rewarded videos**, each on its
own dedicated AdMob unit and each still shown to Remove Ads owners (Remove Ads buys out
the forced interstitial, not a video the player actively taps):
- **Rewarded continue** (8.1) - offered once per run past score 25 on death, revives the
  run **and repairs the hull back to `HULL_SCRATCHES`** (2026-09-19, on request:
  `grantRevive` also resets `hullScratches`/`wallGraceT` and says so with a `+HULL`
  notif). Without it the ad bought a few seconds at the hardest point of the run, since
  spending the scratches is usually what got the player there. Safe: scratches are
  wall-only and run-scoped, no placement, `rng()` or leaderboard number reads them.
  **An extra shield on top was considered and rejected (2026-09-19, user's call)** - the
  revive already recentres the ship, fires a bomb clear and grants `HIT_INVULN_SEC`, so a
  shield would stack a direct-hit absorb on that and blur "scratches forgive wall
  mistakes, direct hits are the shield's job"; the one time a shield was measured at the
  scratch moment it mostly boosted the good tier (+72% median). If it is ever revisited,
  measure death cause by sector per tier first - hull scratches are worth least deep,
  which is where revives happen. See the Rewarded continue notes in `constants.js`.
- **Web has no rewarded video, so the offer slot carries the app pitch instead**
  (2026-09-19, `constants.js WEB_CONTINUE_PROMO_SEC` = 15s, `draw.js`
  `drawWebContinuePromo`). `rewardedAdReady` is false forever on web (the Ad Manager
  network code in `ads-web.js` is still a placeholder and AdSense rejected the site), so
  the one moment a player most wants what the app has said nothing at all. Now the ring
  appears anyway, captioned `T.secondLifeApp` ("second life - in the app") and carrying
  "+1" rather than a play triangle, and a tap opens a card - day accent, the player's own
  ship, both store buttons - for exactly the length of a rewarded video, dismissible from
  `WEB_PROMO_DISMISS_SEC` (2.5s) like an ad's skip. **It never grants a revive** (the
  pitch is that the second life is app-only, and a free one on web would outrank an app
  player who watched an ad for it on the shared leaderboard), and **the caption is honest
  before the tap** so nothing here is a bait-and-switch. `isWeb()`-gated end to end; both
  apps still decide on `rewardedAdReady` alone.
- **Rewarded shard bonus** (8.2) - a row at the bottom of the Missions drawer: watch an
  ad once per UTC day for a flat `SHARDS_AD_REWARD` (20) shards, exempt from
  `DAILY_SHARD_CAP` like a mission reward. Native plumbing
  (`shardsAdRequest` / `_tunlShardsRewardGranted` / `_tunlShardsRewardDeclined` /
  `shardsAdReady`) mirrors the continue's 1:1. With no native bridge (browser) the row
  stays inert.


## Ship unlock economy

Every paid ship (`SKINS` in `src/constants.js`) needs two things at once:
- **`cost` shards** - earned from collected coins (`runCoins`, banked at death), capped
  daily by `DAILY_SHARD_CAP` = 160. The 3 daily missions and the once-per-day rewarded-ad
  bonus (`SHARDS_AD_REWARD` = 20) are exempt, so the real ceiling is
  160+20+30+40+50 = **300/day**.
- **`stardustGate` days played** - `stardust` in `state.js`, +1 per calendar day opened
  regardless of skill or how much is played, +1 bonus per 7-day unbroken streak. Never
  spent, only checked as a `>=` threshold, so a tier's gate doesn't stack on the next.

SOLARIS (the 8th and last ship) needs 5600 shards and 180 stardust (~half a year at the
daily floor). The Stardust doc block in `constants.js` has the worked timelines per player
tier and why neither currency alone can do this job.

**The shard ladder (240/320/560/1280/2400/4000/5600, cumulative 14400) is set just under
what each tier's gate implies at ~80 shards/day, so stardust is the binding constraint at
every tier** and SOLARIS still lands on day 180 exactly. **Re-run the numbers before
changing either side - a shard-side raise silently re-breaks the gate schedule.** Do not
revert to the old ladder; it made the top three tiers effectively unreachable and flipped
the binding constraint to shards at VOID, i.e. the stardust system stopped doing any work
for the entire top half of the roster (`docs/design-history.md` -> "Ship unlock economy").

**Hangar liveries (cosmetic, phase 1 of the cosmetics concept).** Six finishes (`LIVERIES`
in `constants.js`: FACTORY free, STEALTH 80, STRIPE 120, SPLIT 200, CHROME 320, AURORA 520
shards), bought in a Paint sheet opened from a PAINT pill on the ALL SHIPS sheet, which
only appears once AMBER (`LIVERY_GATE_SKIN`) is owned, so the first paid ship stays the
first shard goal. Rules, each load-bearing:
- **Purely visual** - no perk, hitbox, placement or leaderboard effect. No `shadowBlur`.
  The ghost and the wrecked death frame always draw FACTORY.
- **Bought once for the hangar, equipped per ship** (`shipLiveries` in `state.js`, key
  `tunnel_ship_liveries`, migrated from the old single `tunnel_livery`), so each ship keeps
  its own look without re-buying anything. **Not part of Unlock All Ships** (separate save
  keys `tunnel_liveries` / `tunnel_ship_liveries`). Names are untranslated proper nouns, like ship names.
- **It re-shades the ship's own facets** (`_shipTones` livery arg) or paints a clipped
  pattern (`_drawLiveryOverlay`), **never changes the hue**, so ship identity stays readable.
- **Every finish is built from big masses** - a whole half of the hull (SPLIT), a rim
  (STEALTH), a band across the span (STRIPE), a full-hull gradient (CHROME/AURORA). In
  flight the ship is only ~2*PR across (~35px at the W cap), where the first pass's fine
  patterns (a carbon weave, pinstripes) were invisible and the finishes read as not worth
  buying. Detail that only resolves on the hero ship may sit **on top of** a mass, never
  instead of one - and a light mass must flip dark on a pale ship (PEARL/NOVA) or it
  disappears again.
- **Every finish moves in colour** (STEALTH's rim breathes, STRIPE runs a pulse down the
  band, SPLIT cycles its spine line, CHROME's specular sweep throws the two hue
  neighbours, AURORA drifts four bands at two rates) - paint that only sits there reads as
  a recolour, and a recolour is not worth shards. The motion is **one** gradient fill or
  stroke riding `gtime` per frame, never particles or a second pass over the hull.
- **Each finish carries one signature mark** (STEALTH neon facet seams, STRIPE wing
  chevrons + tip caps, SPLIT a clean lit seam with wing-root lips, CHROME a hard reflected
  horizon, AURORA four polar-light curtains at three hues - +-45, the only finish allowed
  past the usual +-24 - plus rim and sparkles). Audited at 150px, where a mere recolour
  still looked cheap.

Three traps from that audit, worth not repeating: **a mark on the NOSE is invisible**
(the canopy and leading-edge highlight draw after this overlay); **small repeated details
read as noise, not paint** (SPLIT shipped a sawtooth divide for one iteration and was
reported as odd - teeth on a top-down planform read as damage); and **an additive wash has
no headroom on a white hull** (PEARL/NOVA blew out to plain white), so on a pale ship the
curtains paint with `source-over` instead of `lighter`.

Later phases in the concept: exhausts and trails, wreck effects and share-card frames,
mastery/achievement rewards, and only then an optional real-money pack of named items
(never random drops).

**Unlock All Ships IAP**: a real-money non-consumable (`unlock_all_ships`, alongside
`remove_ads`) that force-unlocks every ship, current and future (`allShipsOwned` in
`state.js`, **re-applied on every load** rather than snapshotting which ships existed at
purchase time). $9.99 versus `remove_ads` at $2.99 - the standard "unlock everything"
tier, not a whale price, but higher than Remove Ads because it skips up to a year of daily
return and these ships carry real gameplay perks (the buff/nerf table above `SKINS`), not
just cosmetics. Shop UI in `draw.js`'s `showShop`; the purchase/restore bridge is
product-ID-keyed in `IAPManager.swift` and `BillingManager.kt` (they mirror each other
exactly - see their doc comments). **Shards and stardust are untouched by this purchase** -
a separate entitlement flag, not a currency grant. Both products exist live in App Store
Connect and Play Console; `Configuration.storekit` stays for local testing only.

## Possible future features

- Multiple difficulty modes
- Mobile fullscreen on iOS/Android
- Level theming (lava/ice/neon)
- Additional coin types beyond the current eight (gold/blue/red/orange/green/bomb + the two hazards poison/drain)
- Friend ghosts carried inside a share link (see Ghost run below - the local ghost is
  already only a few hundred bytes, so a shared one is mostly a transport problem)
