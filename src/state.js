// ── State ─────────────────────────────────────────────────────────────

let phase, py, vy, holding, scrollX, score, newBest, newDailyBest, startRamp;
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
// Ghost VISIBILITY only, not recording -- today's best keeps banking to
// tunnel_ghost either way (state.js's ghostPlay load, update.js's death-time save)
// so re-enabling this mid-day still has something to race. Separate localStorage
// key from tunnel_ghost itself, which holds the actual recorded track.
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
// Bottom Y of the title-screen settings/leaderboard/challenge button cluster, set each
// draw() call -- the daily-missions block below cascades off this instead of an
// independent fixed H fraction, so it can't collide when that cluster grows a 2nd row.
let _btnRowBottom = null;
let _langBtnRects = [];
let _removeAdsBtnRect = null;
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
let deathMarkers = [];   // persists across runs: { wx, wallY }
const MAX_DEATH_MARKERS = 25;
let bestMarker = null;   // { wx, wallY } of all-time best run's death spot
