// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── State ─────────────────────────────────────────────────────────────

let phase, py, vy, holding, scrollX, score, newBest, newDailyBest, startRamp;
// True once the player has pressed hold at least once during the current run. Gates
// gravity in update.js's physics step (see comment there) -- without it, a run (which
// always begins with holding false now, title start and PLAY AGAIN alike) free-falls
// from a centered launch into the tunnel wall in well under a second, before the player
// has any chance to realize they need to press again. Reset false in startPlay(),
// flipped true wherever input.js sets holding = true, or by the HOLD_GATE_MAX_SEC
// timeout in update.js.
let hasHeldThisRun;
// Real seconds elapsed in-flight while hasHeldThisRun is still false. Once this passes
// IDLE_HINT_DELAY (draw.js), a "HOLD TO FLY" nudge fades in above the parked ship --
// the player who never pressed at all still needs to be told what to do, since the
// gravity gate above only buys them time, not understanding. Reset in startPlay(),
// counted up in update.js, read in draw.js; stops mattering forever once
// hasHeldThisRun flips true.
let idleHoldTimer;
const _initToday    = (() => { const d = new Date(); return d.getUTCFullYear()*10000 + (d.getUTCMonth()+1)*100 + d.getUTCDate(); })();
const _savedLastDay = parseInt(localStorage.getItem('tunnel_lastday') || '0');
let best          = parseInt(localStorage.getItem('tunnel_best')    || '0');
let bestSX        = parseInt(localStorage.getItem('tunnel_best_sx') || '0');
// Lifetime distance flown, in world-px, summed across every run ever (banked in
// commitDeath). Never spent, never resets - a slow progression counter shown on
// the title screen under REKORD. Displayed as lifetimeDist/60, the same "distance"
// unit the live score uses (score = floor(scrollX/60) + bonus).
let lifetimeDist  = parseFloat(localStorage.getItem('tunnel_lifetime_dist') || '0') || 0;
// Lifetime runs played, summed across every run ever started (incremented in
// lifecycle.js startPlay(), same "every started run counts" definition as the
// daily-reset `dailyRuns` above). Never spent, never resets - backs
// RUNS_ACHIEVEMENTS (constants.js).
let totalRuns = parseInt(localStorage.getItem('tunnel_total_runs') || '0');
// Lifetime near-misses (wall clearance < PR*2.0), summed across every run ever
// (each run's `runNearMisses` banked in commitDeath(), same source
// dailyMissionStats.nearMisses reads). Backs DODGE_ACHIEVEMENTS (constants.js).
let lifetimeNearMisses = parseInt(localStorage.getItem('tunnel_lifetime_near_misses') || '0');
let runsWithoutPB = parseInt(localStorage.getItem('tunnel_no_pb')   || '0');
let top5 = _savedLastDay === _initToday ? JSON.parse(localStorage.getItem('tunnel_top5') || '[]') : [];
let dailyBest = _savedLastDay === _initToday ? parseInt(localStorage.getItem('tunnel_daily_best') || '0') : 0;
let dailyRuns = _savedLastDay === _initToday ? parseInt(localStorage.getItem('tunnel_daily_runs') || '0') : 0;
let musicOn = localStorage.getItem('tunnel_music') !== '0';
let fxOn    = localStorage.getItem('tunnel_fx')    !== '0';
let _btnMusicRect = null, _btnFxRect = null;

// ── Daily reminder (local notification, src/notify.js) ────────────────
// Native schedules a 19:00-local nudge on days the player hasn't opened the new
// cave. `tunl_notif_first_day` is stamped on the very first launch so the opt-in
// card can wait for the first launch of a *later* day (never day one).
const _notifFirstDay = parseInt(localStorage.getItem('tunl_notif_first_day') || '0');
if (!_notifFirstDay) localStorage.setItem('tunl_notif_first_day', _initToday);
let notifEnabled    = localStorage.getItem('tunl_notif_enabled') === '1';
let notifPromptDone = localStorage.getItem('tunl_notif_prompt_done') === '1';
// One-time title-screen opt-in card. draw.js additionally gates the render on the
// native bridge being present (browsers / very old WebViews never see it).
let showNotifPrompt = !notifPromptDone && !notifEnabled
    && _notifFirstDay > 0 && _notifFirstDay !== _initToday;
let _notifPromptYesRect = null, _notifPromptNoRect = null, _notifToggleRect = null;
// ── World rank ────────────────────────────────────────────────────────
// Pushed in by the native layer after each score submit resolves (GameView.swift's
// fetchWorldRank / MainActivity.kt's fetchWorldRank) -- see main.js _tunlNativeUpdate.
// Not persisted: a stale rank is worse than no rank, and it's one cheap round trip.
// null means "unknown" (no Game Center / Play Games session, offline, or the first
// submit hasn't come back yet), and the death screen falls back to the local list.
// worldRankDelta is positive when the player climbed, since a smaller rank is better.
let worldRank = null, worldRankTotal = 0, worldRankDelta = 0;
// Count of Game Center Challenges currently issued to this player and not yet met,
// pushed in by GameView.swift's fetchActiveChallenges (iOS 26+ only -- Android has
// no challenge system). Drives the small badge under the title screen's CHALLENGE
// icon so an open challenge is visible without opening Game Center. Not persisted,
// same reasoning as worldRank above.
let activeChallenges = 0;
// Shards: persistent currency banked from collected coins across all runs, spent on ship
// unlocks (see SKINS[].cost in constants.js). Replaces the old single-run-score gate.
// First launch under this system (no tunnel_shards key yet) resets ship unlocks to just
// PEARL and shards to 0 for everyone -- including players who'd earned ships under the
// old score-gated system. Deliberate product decision: keep the new economy consistent
// for all players rather than grandfather a handful of early unlocks.
let unlockedSkins, shards;
if (localStorage.getItem('tunnel_shards') === null) {
    unlockedSkins = 1; shards = 0;
    localStorage.setItem('tunnel_skins', unlockedSkins);
    localStorage.setItem('tunnel_shards', shards);
} else {
    unlockedSkins = parseInt(localStorage.getItem('tunnel_skins') || '1');
    shards = parseInt(localStorage.getItem('tunnel_shards') || '0');
}
// Stardust-gate migration: every paid tier now ALSO needs `stardustGate` days played
// (constants.js Stardust block) on top of its shard cost, and no existing player has
// banked any stardust yet -- it didn't exist before this system shipped. Without this,
// anyone who'd already unlocked ships under the old shard-only rules would keep them for
// free, which defeats the entire point of adding the gate (a hardcore player clearing
// nearly the whole roster in about a week was the problem it was built to fix -- see
// DAILY_SHARD_CAP's doc comment). So on first load under this system, ship unlocks reset
// back to PEARL-only for everyone -- same one-time-reset precedent as when the shard
// system itself first replaced the old score-gate (see the tunnel_shards null-check
// above). Shards themselves are NOT touched here -- they were legitimately earned and
// nothing about how they're earned changed, so a returning player's existing balance
// still counts immediately toward whichever tier's `cost` they're re-approaching; only
// stardustGate was missing, and that starts at 0 for every player either way.
if (localStorage.getItem('tunnel_stardustgate_v1') === null) {
    unlockedSkins = 1;
    localStorage.setItem('tunnel_skins', unlockedSkins);
    localStorage.setItem('tunnel_stardustgate_v1', '1');
}
// Unlock All Ships IAP (non-consumable, see IAPManager.swift/BillingManager.kt): a
// persistent entitlement flag, not a one-time bitmask snapshot, so it stays future-proof
// if a 9th ship is ever added -- every load, force every current SKINS bit on rather than
// remembering which bits existed at purchase time (see update.js's die() unlock loop,
// which would otherwise need its own separate "was this bought outright" special case
// per tier). Placed after the stardustgate migration above so a purchase always wins
// regardless of load order.
let allShipsOwned = localStorage.getItem('tunnel_all_ships') === '1';
if (allShipsOwned) unlockedSkins = (1 << SKINS.length) - 1;
// How many shards have already been banked today (DAILY_SHARD_CAP in constants.js), reset
// on the same UTC day boundary as dailyBest/dailyRuns above (see lifecycle.js startPlay()).
let dailyShardsEarned = _savedLastDay === _initToday ? parseInt(localStorage.getItem('tunnel_daily_shards') || '0') : 0;
let runShardsBanked = 0; // this run's actual post-cap shard gain, shown on the death screen
// Whether today's once-per-day rewarded-ad shard bonus (constants.js SHARDS_AD_REWARD)
// has already been claimed. Persisted, reset on the same UTC day boundary as
// dailyShardsEarned (see lifecycle.js startPlay()).
let shardsAdClaimedToday = _savedLastDay === _initToday ? localStorage.getItem('tunnel_shards_ad_claimed') === '1' : false;
let removeAdsOwned = localStorage.getItem('tunnel_remove_ads') === '1';
// Set by the native layer (see main.js's _tunlNativeUpdate) once the UMP SDK's
// consent-info update resolves. Only true for players in a region where Google's
// consent/privacy rules require an in-app way to revisit their choice (EEA/UK/CH
// GDPR, or an opted-in US state) - not persisted, since it's a live SDK query
// result, not a player preference.
let privacyOptionsRequired = false;
// Whether native currently has a rewarded ad loaded and ready to present, pushed via
// _tunlNativeUpdate exactly like removeAdsOwned/worldRank above. Gates the continue
// offer (update.js die()) so the icon is never shown with nothing behind it -- no
// native bridge (browser testing) means this simply stays false forever.
let rewardedAdReady = false;
// Whether native has a *shards* rewarded ad loaded (its own dedicated unit, separate
// from rewardedAdReady's continue unit), pushed via _tunlNativeUpdate the same way.
// Gates the Missions-drawer bonus row (draw.js) so it's only tappable with an ad behind
// it -- no native bridge (browser) means it stays false forever and the row is inert.
let shardsAdReady = false;
// True only while the shards rewarded ad is on screen (set in input.js on request,
// cleared by _tunlShardsRewardGranted/_tunlShardsRewardDeclined in main.js) -- guards
// the grant callback against a stray second fire.
let shardsAdPending = false;
let activeSkin    = parseInt(localStorage.getItem('tunnel_skin')  || '0');
if (!(unlockedSkins & (1 << activeSkin))) activeSkin = 0;
// Per-ship mastery XP (constants.js masteryLevel/masteryLerp), index-aligned with SKINS.
// One coin collected while a given ship is active = 1 XP for that ship.
let skinXP = JSON.parse(localStorage.getItem('tunnel_skin_xp') || '[0,0,0,0,0,0,0]');
let skinMasteryUpIdx  = -1; // which ship leveled up this run (-1 if none), death-screen banner
let runStartMasteryLevel = 0; // snapshot at startPlay() so die() can detect a level-up
let skinUnlockIdx = -1;
// Daily missions (constants.js MISSION_DEFS/pickDailyMissionIndices). dailyMissionIdx is
// a pure function of the day, so it's recomputed here and on every day-boundary reset
// (lifecycle.js) rather than persisted itself.
let dailyMissionStats = Object.assign(
    { gold: 0, blue: 0, red: 0, green: 0, orange: 0, bomb: 0, dist: 0, nearMisses: 0, bestCombo: 0, bestScore: 0, runs: 0 },
    _savedLastDay === _initToday ? JSON.parse(localStorage.getItem('tunnel_daily_mission_stats') || '{}') : {}
);
let dailyMissionsClaimed = _savedLastDay === _initToday
    ? JSON.parse(localStorage.getItem('tunnel_daily_missions_claimed') || '[false,false,false]')
    : [false, false, false];
let dailyMissionIdx = pickDailyMissionIndices(_initToday);
// Total shards won from daily missions that completed *this run*, set in update.js die()
// and consumed by the death-screen banner + a one-shot chime. Reset at startPlay so the
// banner only shows the run it belongs to. 0 = no mission finished this run.
let missionRewardWon = 0;
let runCoinsByType = { gold: 0, blue: 0, red: 0, green: 0, orange: 0 }; // this run's per-type coin counts
let _skinBtnRects = [];
let streak = parseInt(localStorage.getItem('tunnel_streak') || '0');
// Persistent 7-bit mask of which weekday worlds (constants.js WEEKDAY_PALETTES,
// bit i = index i) the player has finished a real run on -- backs the
// PLANET_ACHIEVEMENTS set, set in commitDeath() (update.js).
let planetsFlown = parseInt(localStorage.getItem('tunnel_planets_flown') || '0');
// SOLARIS-only currency (constants.js STARDUST_PER_DAY): +1 on every new calendar day
// opened (lifecycle.js's day-boundary block, alongside the streak update above), +1
// bonus every STARDUST_STREAK_BONUS_DAY-th unbroken streak day. Deliberately earned
// nowhere else -- see the Stardust doc comment in constants.js for why SOLARIS is priced
// in this instead of shards.
let stardust = parseInt(localStorage.getItem('tunnel_stardust') || '0');
let _homeBtnRect = null, _playBtnRect = null, _shareBtnRect = null;
let _continueBtnRect = null;
// >0 while the death-screen SHARE button should read "link copied" instead of
// "share" - set by share.js's desktop clipboard fallback, decayed in update.js.
let _shareCopiedT = 0;
let showSettings = false;
let _settingsBtnRect = null;
let _settingsPanelRect = null;
let _leaderboardBtnRect = null;
let _challengeBtnRect = null;
let showShop = false;
let _shopBtnRect = null;
let _shopPanelRect = null;
// "HOW IT WORKS" row at the bottom of the Settings panel, opening a one-screen
// explainer for shards/stardust/coins/hazards -- the numbers (⧫/✦) and the two
// hazard coins that mean nothing without context, unlike the power-up coins which
// are self-explanatory by look and effect during a run. Lives in Settings (the
// reference/about surface, one tap from the title) rather than buried in the ALL
// SHIPS sheet where it started -- ship shopping is the wrong context for the coin
// and hazard half of the panel. See CLAUDE.md Onboarding: this is opt-in (tap to
// open) rather than a forced hint, so it doesn't repeat the removed title-screen hint.
let showCurrencyInfo = false;
let _settingsGuideBtnRect = null;
let _currencyInfoPanelRect = null;
// CONCEPT A (Dock & Drawer) title-screen prototype -- Missions drawer and ALL
// SHIPS sheet, opened from the icon rail / hero ship link in drawTitleScreen().
// Same tap-outside-to-close pattern as showShop/showSettings above.
let showMissions = false;
let _missionsBtnRect = null;
let _missionsPanelRect = null;
// The rewarded-ad shard-bonus row at the bottom of the Missions drawer (draw.js /
// constants.js SHARDS_AD_REWARD). Hit-tested in input.js while showMissions is open.
let _shardsAdBtnRect = null;
let showShipPicker = false;
let _shipPickerBtnRect = null;
let _shipPrevBtnRect = null;
let _shipNextBtnRect = null;
let _langBtnRects = [];
let _removeAdsBtnRect = null;
let _unlockAllShipsBtnRect = null;
let _restoreBtnRect = null;
let _privacyChoicesBtnRect = null;
// ── Ghost run (constants.js GHOST_STEP / ghostEncode) ─────────────────
// ghostPlay is today's best run, replayed as a translucent ship alongside the player.
// Deliberately scoped to the calendar day, not all time: the corridor is a different
// shape every day (world.js seedDailyVariety), so an older track would be racing
// through a cave that no longer exists. That also makes the ghost reinforce the daily
// loop -- each day opens with no ghost, and the first decent run of the day creates the
// thing you spend the rest of the day chasing.
let ghostPlay = null, ghostScore = 0;
try {
    const _gRaw = localStorage.getItem('tunnel_ghost');
    if (_gRaw) {
        const _g = JSON.parse(_gRaw);
        if (_g && _g.day === _initToday && _g.data) {
            ghostPlay  = ghostDecode(_g.data);
            ghostScore = _g.score | 0;
        }
    }
} catch (e) { ghostPlay = null; ghostScore = 0; }

// Web build: a friend's ghost carried in on a ?g= share link (src/web.js
// webParamGhost, base64; constants.js ghostDecode). Overrides today's local
// best as the chase target, and lifecycle.js re-applies it past the daily
// rollover. _webGhostScore stays 0 until the share link also carries it.
let _webGhostPlay = null, _webGhostScore = 0;
if (typeof webParamGhost !== 'undefined' && webParamGhost) {
    try {
        // Reverse share.js shareRunUrl's URL-safe base64 (also tolerates a plain
        // standard-base64 link from an older client): - _ back to + /, re-pad to 4.
        let _b64 = webParamGhost.replace(/-/g, '+').replace(/_/g, '/');
        while (_b64.length % 4) _b64 += '=';
        const _wg = ghostDecode(_b64);
        if (_wg && _wg.length) {
            _webGhostScore = (typeof webParamGhostScore !== 'undefined' ? webParamGhostScore : 0) | 0;
            _webGhostPlay = _wg;
            ghostPlay = _wg;
            ghostScore = _webGhostScore;
        }
    } catch (e) { /* malformed link param - keep the local ghost */ }
}

let ghostTrack;   // this run's recording, one byte per GHOST_STEP of scrollX
let ghostY;       // interpolated ghost screen y this frame, or null once it's behind
let ghostPitch;   // ghost's nose angle, derived from the track's local slope (update.js)
let ghostPassed;  // one-shot: has the player already outlasted the ghost this run

// One-shot: has the player's live score already overtaken the all-time best (`best`)
// this run. Fires a notif + sfx + a gold ring pop the frame it flips, same pattern as
// ghostPassed / onFire. pbFlash is the decaying pop, decayed by update.js exactly like
// onFireFlash. Score-based (not the old distance-vs-bestSX check) so it can never fire
// "before" onFire in a way that reads as inconsistent -- both compare the same score.
// Distinct from onFire (daily best): onFire has usually already fired earlier in the
// run, but on the day's first run it is suppressed entirely, so this is the only
// in-flight marker there.
let pbPassed;
let pbFlash;

// On fire: live, this-run signal that score has overtaken today's daily best (distinct
// from newDailyBest, which is only computed once at death -- see update.js). Monotonic
// within a run since score never drops, so once true it stays true until the next
// titleScreen()/startPlay() reset (lifecycle.js). draw.js reads it to recolor the
// player's ambient trail and thruster particles fire-hot; update.js fires a one-shot
// notif+sfx the frame it flips, same pattern as ghostPassed above.
let onFire;
// One-shot ignition pop at the instant onFire flips true, decayed by update.js the same
// way milestoneFlash decays -- separate from onFire itself because onFire stays true for
// the rest of the run (recoloring the trail continuously) while this is just the single
// punchy beat at the moment of catching fire. draw.js reads it to flash a radial burst
// around the ship.
let onFireFlash;

let parts, thrustParts, deadT, titleT, flashA, shake, trailY;
// One independent rng stream per spawner (constants.js makeRngStream doc) - shared
// state would make the cave depend on frame timing, and therefore on screen width.
let rngStal, rngCoin, rngMine, rngCannon;
let stalactites, nextStalWx;
// World-x cursor for flagging the next stalactite as a falling one (systems.js
// maintainStalactites / updateFallingStals). Starts at 12000 (~score 200) in
// startPlay, 99999 on the title screen so the attract-mode cave never drops one.
let nextFallWx;
let coins, nextCoinWx;
let chicaneCoins;
// World-x of the last chicane gold coin actually placed (systems.js
// maintainStalactites). A high-water mark rather than "the tail of chicaneCoins",
// because that array is culled behind the player and so cannot hold a gate wider
// than ~1700 world-px - see the comment at the gate itself. Starts at -Infinity so
// the first chicane of a run is never gated.
let lastChicaneCoinWx;
let gapBonus, gapBonusVisual;
let slowTime, slowTimeMax, shieldCount, shieldFlash, magnetTime;
// Grace/invulnerability window after an absorbed hit (constants.js HIT_INVULN_SEC doc).
let invulnT;
// Safe opening zone (constants.js SAFE_START_WX doc): world-x where the walls turn
// lethal this run, how long the corridor takes to close before it, whether this is a
// training run, and the bump-feedback cooldown. 0 on the title screen = no zone.
let safeEndWx = 0, safeCloseWx = 1, trainingRun = false, safeBumpT = 0, wallsLiveShown = false;
// Rewarded continue, run-scoped (constants.js CONTINUE_MIN_SCORE doc). continueOfferPending
// is true while the offer icon is up and death's real bookkeeping (commitDeath) is on
// hold; continueAdPending is true only while native has a rewarded ad on screen, and
// freezes deadT so a slow-loading/long-watched ad can't let the auto-commit fire out
// from under a decision the player already made.
let continuesUsedThisRun, continueOfferPending, continueAdPending;
// Revive countdown after a granted continue (constants.js REVIVE_COUNTDOWN_SEC doc),
// counted down while phase === 'revive'. Reaching 0 flips phase back to 'play'.
let reviveCountdownT;
let bullets, bulletAmmo, bulletFireTimer;
let mines, nextMineWx;
let cannons, nextCannonWx;
// Boulders: large static rounded rocks in the deep corridor - a "go over or
// under" routing choice (systems.js makeBoulder/maintainBoulders). From world-x
// 84000 (~score 1400) in startPlay, 99999 on the title screen.
let boulders, nextBoulderWx;
let cannonShots;
// Warp portal ring in the corridor (constants.js "Warp portal" doc, systems.js
// makePortal/maintainPortals) - a rare reward set-piece, not a hazard. From
// PORTAL_START_WX (~score 50) in startPlay, 99999 on the title screen.
let portals, nextPortalWx;
// Warp state (update.js triggerWarp()/the warp block, world.js warpScrollFactor()).
// warpTime counts down real seconds from warpMax (set fresh by either entry point,
// never stacked - see constants.js WARP_DUR_MIN_SEC doc); warpWidenVisual chases its
// target through the same GAP_EASE_RATE-style channel gapBonusVisual already uses,
// so the corridor widens/narrows smoothly instead of snapping.
// warpMult is the scrollSpd() multiplier rolled once per warp from the player's
// own _prog2 at the moment of trigger (constants.js WARP_MULT_MIN/MAX doc,
// systems.js triggerWarp()) - captured here the same way slowTimeMax captures
// its window, so warpScrollFactor() (world.js) reads a fixed value for the
// whole warp instead of re-sampling a live, still-climbing _prog2 mid-flight.
let warpTime, warpMax, warpWidenVisual, warpMult;
// Warp coin real-time-clock cursor, same model as nextPoisonWx/nextBombWx/nextDrainWx
// just above (constants.js WARP_COIN_INTERVAL_SEC doc).
let nextWarpWx;
// Poison/bomb: real-time clocks (see constants.js POISON_INTERVAL_SEC doc), not
// per-coin-candidate probabilities. poisonClock/bombClock accumulate play seconds
// (update.js); once one passes its jittered next*At target, the next coin that
// actually clears placement (makeCoin, systems.js) becomes that type.
// World-x cursors, NOT real-time clocks. They used to be seconds accumulated with
// `+= dt`, which is how the doc still describes the intent - but seconds-per-world-px
// carries scrollSpd's W/600 term, so a wall-clock cadence lands at a different WORLD
// position on every screen width, and the poison/bomb/drain branch draws rng() when it
// fires: that forked the shared daily cave. Storing the target as a world position
// (converted from the tuned seconds by world.js worldPxForSec, which uses the
// reference width) makes the cadence identical for every player AND independent of
// frame rate, while still landing on the tuned ~20s/16s/30s at the reference device.
let nextPoisonWx, nextBombWx, nextDrainWx;

// World-x where a coin of that type last cleared placement (constants.js
// POWERUP_MIN_GAP_SEC doc) - same world-x model as the three above, and for the same
// cross-device reason. Unlike poison/bomb/drain these never FORCE a type; they only
// veto one the weighted roll picked too soon after the last, and the coin is then
// dropped rather than downgraded to gold. lastGreenWx does double duty: the floor
// AND the magnet soft-pity bias (constants.js GREEN_DROUGHT_SOFT_SEC) that lifts
// green's share the longer it has been. All three are set in makeCoin(), where a coin
// actually clears placement - not on collection.
let lastBlueWx, lastRedWx, lastGreenWx;
// Real elapsed play seconds this run (constants.js FLIGHT_ACHIEVEMENTS doc),
// accumulated the same way as poisonClock/bombClock/drainClock. flightAchIdx is
// the next not-yet-fired index into FLIGHT_ACHIEVEMENTS -- monotonic within a run
// since flightClock only increases, so a simple forward walk (no before/after
// crossing check) is enough.
let flightClock, flightAchIdx;
let notifs;
let bonusScore, milestoneNext, nearMissTimer, coinCombo, coinComboTimer;
let runCoins, runNearMisses, runMaxCombo;
// Backing state for the 4 skill achievements (constants.js SPRINT_ACH_*/NO_HIT_ACH_*/
// NO_BONUS_ACH_*/BOULDER_MEISTER_*), all reset per-run in lifecycle.js:
// - runHitCount: every die() call this run counts (shield/grace-absorbed or fatal).
// - sprintAchFired/noHitAchFired/noBonusAchFired: one-shot guards so a live per-frame
//   check (update.js) doesn't re-fire every frame its condition stays true.
// - runBoulderNarrowPasses: count of boulders cleanly threaded via their narrow side.
let runHitCount, sprintAchFired, noHitAchFired, noBonusAchFired, runBoulderNarrowPasses;
let prevRunScore, lastRunScore;
// Where the last run ended, in world-x and screen-y. Only the share card reads these
// (share.js), which needs the exact death point to mark on the run profile -- die()'s
// existing deathMarkers entry snaps to the nearest *wall*, which is the right thing for
// the in-game marker but would misplace the ship on the card.
let lastRunWx = 0, lastRunY = 0;
let milestoneFlash, milestoneText;
let levelIntroT = 0;
let gtime = 0;
let skinFx = [], skinFxT = 0;
let shipPitch = 0;
let ambParts = [];
// persists across runs: { wx, side } where side is 'top' | 'bot' | 'mid'. The y is NOT
// stored -- draw.js recomputes it every frame from boundsAt(wx) so the ring rides the
// live corridor edge as it waves and as gapBonus decays (a stored y would detach from
// the wall the moment the corridor width changed). 'mid' (mine / cannon death) tracks
// the corridor centre instead.
let deathMarkers = [];
const MAX_DEATH_MARKERS = 25;
// What landed the fatal hit, set at the collision site just before die() and read by
// commitDeath() to pick the marker's side: 'wallTop'/'wallBot' (or a stalactite rooted
// in that wall) -> the ring hangs on that wall; 'open' (mine / cannon shot) -> corridor
// centre. null -> fall back to whichever wall py was nearer.
let deathCause = null;
// Where the fatal hit landed, in SCREEN coords, plus the radius of whatever landed it.
// Set at the same collision sites as deathCause just above, and read only by draw.js's
// freeze-frame (DEATH_REPLAY_SEC) to ring the thing that killed the player before the
// death panel covers it. Screen coords, not world-x, because the world is frozen for
// the whole window this is read in -- nothing scrolls once phase is 'dead', so there is
// no wx->sx drift to correct for, and a wall hit has no world object to key off anyway.
// Like deathCause these are also written on hits that a shield or invulnT absorbs; that
// is harmless (they are only ever read in the 'dead' phase) and keeps the two in step.
let deathHitX = 0, deathHitY = 0, deathHitR = 0;
let bestMarker = null;   // { wx, side } of all-time best run's death spot

// ── Achievement backfill ──────────────────────────────────────────────
// Every achievement elsewhere in the codebase (update.js/lifecycle.js/input.js) fires
// only from a *live* transition: the run a ship first unlocks, the run that crosses a
// distance/score mark, the moment a streak counter ticks over. A player who already met
// the underlying condition before that achievement even shipped (already had ship 3
// unlocked, already had a lifetime distance or best score past a mark, already at a 7+
// day streak) never revisits that live moment again, so without this pass they could
// NEVER earn it - this is what left "Erster Flug"/"Amber Zündung"/"Crimson Lauf"/ship
// achievements ungranted for existing players. GKAchievement.report() (GameView.swift)
// and AchievementsClient.unlock() (MainActivity.kt) are both idempotent for an
// already-completed achievement (no duplicate banner/popup), so re-checking every load
// and re-firing anything currently true is safe - no "already backfilled" flag needed,
// and any achievement added in the future is covered automatically just by adding its
// condition here alongside its live call site.
//
// Exposed on window (not a bare IIFE) because running it at page-parse time alone is
// not enough: both platforms start their sign-in *before* loading the page but resolve
// it asynchronously, and the page - a local file - parses in milliseconds. So at this
// point GKLocalPlayer.local.isAuthenticated is still false and reportAchievement()
// (GameView.swift) drops every id on its auth guard; Play Games' unlock() likewise
// no-ops on an unauthenticated client. Native therefore calls this again the moment
// auth resolves (GameView.swift authenticateGameCenter, MainActivity.kt
// signIntoPlayGames), which is the call that actually lands - and also covers a player
// who signs in mid-session. The load-time call below is kept because it is free and
// does land for anyone whose session happens to already be authenticated.
window._tunlBackfillAchievements = function backfillAchievements() {
    const report = id => window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'achievement', id });
    if (best > 0) report('tunl_ach_first_flight');
    for (let i = 1; i < SHIP_ACHIEVEMENTS.length; i++) {
        if (unlockedSkins & (1 << i)) report(SHIP_ACHIEVEMENTS[i]);
    }
    for (let i = 0; i < PLANET_ACHIEVEMENTS.length; i++) {
        if (planetsFlown & (1 << i)) report(PLANET_ACHIEVEMENTS[i]);
    }
    if (planetsFlown === PLANET_ALL_FLOWN_MASK) report(PLANET_GRAND_TOUR_ACH);
    const _distNow = Math.floor(lifetimeDist / 60);
    for (const da of DIST_ACHIEVEMENTS) {
        if (_distNow >= da.at) report(da.id);
    }
    for (const ra of RUNS_ACHIEVEMENTS) {
        if (totalRuns >= ra.at) report(ra.id);
    }
    for (const dga of DODGE_ACHIEVEMENTS) {
        if (lifetimeNearMisses >= dga.at) report(dga.id);
    }
    if (best >= 1000)   report('tunl_ach_score_1000');
    if (best >= 10000)  report('tunl_ach_score_10000');
    if (best >= 100000) report('tunl_ach_score_100000');
    if (streak >= 7)  report('tunl_ach_streak_7');
    if (streak >= 30) report('tunl_ach_streak_30');
    let _anyMaxed = false, _allOwnedMaxed = true, _hasOwned = false;
    for (let i = 0; i < SKINS.length; i++) {
        if (!(unlockedSkins & (1 << i))) continue;
        _hasOwned = true;
        if (masteryLevel(i) === MASTERY_XP_THRESHOLDS.length - 1) _anyMaxed = true;
        else _allOwnedMaxed = false;
    }
    if (_anyMaxed) report('tunl_ach_ace_pilot');
    if (_hasOwned && _allOwnedMaxed) report('tunl_ach_master_fleet');
};
window._tunlBackfillAchievements();
