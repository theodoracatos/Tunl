// ── State ─────────────────────────────────────────────────────────────

let phase, py, vy, holding, scrollX, score, newBest, newDailyBest, startRamp;
// True once the player has pressed hold at least once during the current run. Gates
// gravity in update.js's physics step (see comment there) -- without it, a run that
// begins with holding already false (the title-screen tap-to-confirm path releases
// the player's finger the instant startPlay() fires, see input.js onUp) free-falls
// from a centered launch into the tunnel wall in well under a second, before a
// first-time player has any chance to realize they need to press again. Reset false
// in startPlay(), flipped true wherever input.js sets holding = true.
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
let runsWithoutPB = parseInt(localStorage.getItem('tunnel_no_pb')   || '0');
let top5 = _savedLastDay === _initToday ? JSON.parse(localStorage.getItem('tunnel_top5') || '[]') : [];
let dailyBest = _savedLastDay === _initToday ? parseInt(localStorage.getItem('tunnel_daily_best') || '0') : 0;
let dailyRuns = _savedLastDay === _initToday ? parseInt(localStorage.getItem('tunnel_daily_runs') || '0') : 0;
let musicOn = localStorage.getItem('tunnel_music') !== '0';
let fxOn    = localStorage.getItem('tunnel_fx')    !== '0';
// Ghost RENDERING only, not recording -- today's best keeps banking to
// tunnel_ghost either way (state.js's ghostPlay load, update.js's death-time save)
// so re-enabling this mid-day still has something to race. Separate localStorage
// key from tunnel_ghost itself, which holds the actual recorded track.
// Off means off: neither the translucent ship nor its "GHOST -N" points-remaining
// stand-in (draw.js, GHOST_LATE_JOIN_GAP) render, so nothing about today's best shows
// on screen during the run. The comparison itself keeps running unconditionally though
// (update.js's ghostPassed check isn't gated by this flag), so outlasting it still fires
// its one-shot notif+sound -- the single moment that's the point of the feature survives
// even with the ambient racing pressure turned off.
let ghostOn = localStorage.getItem('tunnel_ghost_visible') !== '0';
let _btnMusicRect = null, _btnFxRect = null, _btnGhostRect = null;
// ── World rank ────────────────────────────────────────────────────────
// Pushed in by the native layer after each score submit resolves (GameView.swift's
// fetchWorldRank / MainActivity.kt's fetchWorldRank) -- see main.js _tunlNativeUpdate.
// Not persisted: a stale rank is worse than no rank, and it's one cheap round trip.
// null means "unknown" (no Game Center / Play Games session, offline, or the first
// submit hasn't come back yet), and the death screen falls back to the local list.
// worldRankDelta is positive when the player climbed, since a smaller rank is better.
let worldRank = null, worldRankTotal = 0, worldRankDelta = 0;
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
let removeAdsOwned = localStorage.getItem('tunnel_remove_ads') === '1';
// Set by the native layer (see main.js's _tunlNativeUpdate) once the UMP SDK's
// consent-info update resolves. Only true for players in a region where Google's
// consent/privacy rules require an in-app way to revisit their choice (EEA/UK/CH
// GDPR, or an opted-in US state) - not persisted, since it's a live SDK query
// result, not a player preference.
let privacyOptionsRequired = false;
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
    { gold: 0, blue: 0, red: 0, green: 0, orange: 0, nearMisses: 0, bestCombo: 0, bestScore: 0, runs: 0 },
    _savedLastDay === _initToday ? JSON.parse(localStorage.getItem('tunnel_daily_mission_stats') || '{}') : {}
);
let dailyMissionsClaimed = _savedLastDay === _initToday
    ? JSON.parse(localStorage.getItem('tunnel_daily_missions_claimed') || '[false,false,false]')
    : [false, false, false];
let dailyMissionIdx = pickDailyMissionIndices(_initToday);
let runCoinsByType = { gold: 0, blue: 0, red: 0, green: 0, orange: 0 }; // this run's per-type coin counts
let _skinBtnRects = [];
let streak = parseInt(localStorage.getItem('tunnel_streak') || '0');
// SOLARIS-only currency (constants.js STARDUST_PER_DAY): +1 on every new calendar day
// opened (lifecycle.js's day-boundary block, alongside the streak update above), +1
// bonus every STARDUST_STREAK_BONUS_DAY-th unbroken streak day. Deliberately earned
// nowhere else -- see the Stardust doc comment in constants.js for why SOLARIS is priced
// in this instead of shards.
let stardust = parseInt(localStorage.getItem('tunnel_stardust') || '0');
// Lifetime run count (never reset at the day boundary, unlike dailyRuns). Sole consumer
// is the obstacle-free runway on a player's very first run (lifecycle.js
// FIRST_RUN_RUNWAY_WX). There was briefly also a title-screen control hint gated on this
// -- removed, see the Onboarding section in CLAUDE.md for why.
//
// Note this key doesn't exist for players upgrading from 4.x, so they all read 0 on
// first launch and get the first-run runway once. Harmless (one slightly emptier run),
// and not worth a migration.
let runsTotal = parseInt(localStorage.getItem('tunnel_runs_total') || '0');
let _homeBtnRect = null, _playBtnRect = null, _shareBtnRect = null;
let showSettings = false;
let _settingsBtnRect = null;
let _settingsPanelRect = null;
let _leaderboardBtnRect = null;
let _challengeBtnRect = null;
let showShop = false;
let _shopBtnRect = null;
let _shopPanelRect = null;
// Small "i" button next to the shard wallet on the ship panel, opening a one-screen
// explainer for shards/stardust/coins -- the one place new players hit numbers
// (⧫/✦) that mean nothing without context, unlike coins which are self-explanatory
// by look and effect during a run. See CLAUDE.md Onboarding: this is opt-in (tap to
// open) rather than a forced hint, so it doesn't repeat the removed title-screen hint.
let showCurrencyInfo = false;
let _currencyInfoBtnRect = null;
let _currencyInfoPanelRect = null;
// Bottom Y of the title-screen settings/leaderboard/challenge button cluster, set each
// draw() call. No longer read by anything else in draw() (the missions block used to
// cascade off it when buttons sat above missions; the two were swapped per feedback --
// see _missionsBottom below), kept for any future layout that wants the buttons' real
// bottom edge.
let _btnRowBottom = null;
// Bottom Y of the daily-missions block, set each draw() call -- the title-screen
// settings/leaderboard/challenge button cluster (now positioned below missions, buttons
// at the bottom of the screen rather than missions) cascades off this instead of an
// independent fixed H fraction, so it can't collide when the button cluster grows a
// 2nd row above a mission list that shifted position.
let _missionsBottom = null;
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
let ghostTrack;   // this run's recording, one byte per GHOST_STEP of scrollX
let ghostY;       // interpolated ghost screen y this frame, or null once it's behind
let ghostPitch;   // ghost's nose angle, derived from the track's local slope (update.js)
let ghostPassed;  // one-shot: has the player already outlasted the ghost this run

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
let stalactites, nextStalWx;
let coins, nextCoinWx;
let chicaneCoins;
let gapBonus;
let slowTime, shieldCount, shieldFlash, magnetTime;
let bullets, bulletAmmo, bulletFireTimer;
let mines, nextMineWx;
let cannons, nextCannonWx;
let cannonShots;
// Poison/bomb: real-time clocks (see constants.js POISON_INTERVAL_SEC doc), not
// per-coin-candidate probabilities. poisonClock/bombClock accumulate play seconds
// (update.js); once one passes its jittered next*At target, the next coin that
// actually clears placement (makeCoin, systems.js) becomes that type.
let poisonClock, nextPoisonAt;
let bombClock, nextBombAt;
let notifs;
let bonusScore, milestoneNext, nearMissTimer, coinCombo, coinComboTimer;
let runCoins, runNearMisses, runMaxCombo;
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
// Second, farther-back mote layer (lifecycle.js initBgParts, draw.js) - smaller,
// dimmer, drifts slower than ambParts for the same parallax depth cue as the
// background horizon line above.
let bgParts  = [];
let deathMarkers = [];   // persists across runs: { wx, wallY }
const MAX_DEATH_MARKERS = 25;
let bestMarker = null;   // { wx, wallY } of all-time best run's death spot
