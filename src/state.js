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
// One-time record reset for 15.0: the personal records saved by earlier versions come from
// caves and physics that no longer exist (unrealistic highs), so the first launch of a
// build carrying this block wipes them - all-time best and where it died, plus today's
// best, list and ghost, which would otherwise keep showing the same stale numbers for the
// rest of the UTC day. The flag is keyed to the migration, not to TUNL_VERSION, so it runs
// exactly once per device and a later version never wipes again. Must stay ABOVE the reads
// below: they pick up the zeroed values. Untouched on purpose: shards, stardust, ships,
// achievements and lifetime counters were earned honestly and did not change.
try {
    if (localStorage.getItem('tunnel_record_reset_v15') === null) {
        localStorage.setItem('tunnel_best', '0');
        localStorage.setItem('tunnel_best_sx', '0');
        localStorage.setItem('tunnel_daily_best', '0');
        localStorage.setItem('tunnel_top5', '[]');
        localStorage.setItem('tunnel_no_pb', '0');
        localStorage.removeItem('tunnel_ghost');
        localStorage.setItem('tunnel_record_reset_v15', '1');
    }
} catch (e) {}
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
// Lifetime score, summed across every run ever (each run's final `score` banked in
// commitDeath()). Backs 'tunl_ach_score_100000' ("Sechs Stellen") - that achievement
// used to check a single run's `best`, but the 2026-09-13 flight-plan rework made a
// mine-dodge fail deterministically past a certain scrollX (see the "Mines are the
// only thing that guarantees no run survives forever" doc in CLAUDE.md), so no input
// sequence can reach a six-digit score in one run any more, at any skill level. Summed
// across runs it stays honestly reachable through sustained play instead, same pattern
// as lifetimeDist/lifetimeNearMisses above.
let lifetimeScore = parseFloat(localStorage.getItem('tunnel_lifetime_score') || '0') || 0;
let runsWithoutPB = parseInt(localStorage.getItem('tunnel_no_pb')   || '0');
let top5 = _savedLastDay === _initToday ? JSON.parse(localStorage.getItem('tunnel_top5') || '[]') : [];
let dailyBest = _savedLastDay === _initToday ? parseInt(localStorage.getItem('tunnel_daily_best') || '0') : 0;
let dailyRuns = _savedLastDay === _initToday ? parseInt(localStorage.getItem('tunnel_daily_runs') || '0') : 0;
// Three levels since 2026-09-19 (sound review U4): 0 off, 1 low, 2 full. Stored as '0' / 'low'
// / anything else, so every save written by the old on/off toggle ('0' / '1') still reads the
// same. musicOn / fxOn stay the gate every play-path checks; the level only scales a bus gain
// (audio.js applyAudioLevels).
function _audioLevel(key) { const v = localStorage.getItem(key); return v === '0' ? 0 : v === 'low' ? 1 : 2; }
let musicLevel = _audioLevel('tunnel_music');
let fxLevel    = _audioLevel('tunnel_fx');
let musicOn = musicLevel > 0;
let fxOn    = fxLevel > 0;
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
// Other players' runs on today's leaderboard, pushed in alongside worldRank (native:
// GameView.swift/MainActivity.kt's leaderboard-entries fetch; web: the Cloudflare
// Worker's anonymous daily sample - see main.js _tunlNativeUpdate). Each entry is
// { score, name }. `name` is only ever populated on iOS/Android, where a real Game
// Center / Play Games display name comes back in the same call as the score - web
// players are anonymous by design (no login, no name field in the D1 schema), so web
// entries always carry name: ''. Position is APPROXIMATE: no platform stores a real
// death world-x, only the final score, so draw.js/share.js derive wx as
// `score * GHOST_STEP` (constants.js - already "one point of distance score" by
// definition) - the same distance term the score formula itself uses, ignoring
// bonusScore. Not persisted, same reasoning as worldRank above.
// STATUS (owner-confirmed 2026-09-18): the rival death markers are fully implemented as
// designed - client (draw.js death-screen rail ticks + nearest-rival label, share.js dot
// cloud), native plumbing and the web Worker's `rivals` field. Nothing is missing or
// stubbed; do not treat an empty rivalDeaths as an unfinished feature (it is empty
// offline, before the first submit resolves, or when nobody else has played that day).
let rivalDeaths = [];
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
// Hangar paint (constants.js PAINT_*): what the hangar owns, one bitmask per catalogue
// (colours are shared by the hull slot `c` and the pattern-colour slot `pc`), and one kit
// per ship (shipPaint, index-aligned with SKINS). A part is bought ONCE for the hangar and
// combined freely on every ship. Separate keys from ships on purpose - Unlock All Ships
// never touches these.
const _PAINT_KEYS = ['c', 'p', 'pc', 'm', 'fx'];
function _paintOwnKey(slot) { return slot === 'pc' ? 'c' : slot; }
function _paintList(slot) { return slot === 'p' ? PAINT_PATTERNS : slot === 'm' ? PAINT_MATERIALS : slot === 'fx' ? PAINT_EFFECTS : PAINT_COLORS; }
function _paintKit(o) {
    const k = { c: 0, p: 0, pc: 0, m: 0, fx: 0 };
    for (const s of _PAINT_KEYS) {
        const v = o ? o[s] | 0 : 0;
        k[s] = v >= 0 && v < _paintList(s).length ? v : 0;
    }
    return k;
}
let paintOwned, shipPaint;
try { paintOwned = JSON.parse(localStorage.getItem('tunnel_paint_owned') || 'null'); } catch (e) { paintOwned = null; }
try { shipPaint = JSON.parse(localStorage.getItem('tunnel_ship_paint') || 'null'); } catch (e) { shipPaint = null; }
if (!paintOwned || typeof paintOwned !== 'object') {
    // First load under the kit system: every 2026-09-17 finish the player bought becomes
    // its parts (PAINT_LEGACY), and a ship that wore one keeps that look.
    paintOwned = { c: 0, p: 0, m: 0, fx: 0 };
    const oldMask = parseInt(localStorage.getItem('tunnel_liveries') || '1') | 1;
    let oldShip = null;
    try { oldShip = JSON.parse(localStorage.getItem('tunnel_ship_liveries') || 'null'); } catch (e) { oldShip = null; }
    if (!Array.isArray(oldShip)) oldShip = SKINS.map(() => parseInt(localStorage.getItem('tunnel_livery') || '0') || 0);
    for (let i = 1; i < PAINT_LEGACY.length; i++) {
        if (!(oldMask & (1 << i))) continue;
        for (const s in PAINT_LEGACY[i]) paintOwned[_paintOwnKey(s)] |= 1 << PAINT_LEGACY[i][s];
    }
    if (!Array.isArray(shipPaint)) {
        shipPaint = SKINS.map((_, i) => {
            const lv = oldShip[i] | 0;
            return _paintKit(lv > 0 && lv < PAINT_LEGACY.length && (oldMask & (1 << lv)) ? PAINT_LEGACY[lv] : null);
        });
    }
    localStorage.setItem('tunnel_paint_owned', JSON.stringify(paintOwned));
    localStorage.setItem('tunnel_ship_paint', JSON.stringify(shipPaint));
}
for (const k of ['c', 'p', 'm', 'fx']) paintOwned[k] = paintOwned[k] | 0;
if (!Array.isArray(shipPaint)) shipPaint = [];
while (shipPaint.length < SKINS.length) shipPaint.push(null);
shipPaint = shipPaint.map(_paintKit);
// A kit may only wear bought parts the hangar owns (a save edited by hand, or one written
// while DEV_WALLET was on). Earned parts are left alone: their stats load further down and
// are monotonic.
for (const k of shipPaint) {
    for (const s of _PAINT_KEYS) {
        const part = _paintList(s)[k[s]];
        if (part.cost && !part.earn && !(paintOwned[_paintOwnKey(s)] & (1 << k[s]))) k[s] = 0;
    }
}
// Earned parts (constants.js PAINT_* `earn`): read live from monotonic stats, never stored.
function paintEarnMet(part) {
    if (part.earn === 'best')   return best >= part.need;
    if (part.earn === 'worlds') { let n = 0; for (let m = planetsFlown; m; m &= m - 1) n++; return n >= part.need; }
    if (part.earn === 'days')   return stardust >= part.need;
    if (part.earn === 'streak') return bestStreak >= part.need;
    return true;
}
function paintPartOwned(slot, i) {
    const part = _paintList(slot)[i];
    if (!part) return false;
    if (part.earn) return paintEarnMet(part);
    if (!part.cost) return true;
    return !!(paintOwned[_paintOwnKey(slot)] & (1 << i));
}
// The kit a ship flies, or 0 for plain FACTORY (callers treat any falsy value as factory).
function paintOf(skin) {
    const k = shipPaint[skin];
    if (!k) return 0;
    return k.c || k.p || k.m || k.fx ? k : 0;
}
// `bought`: only a purchase writes ownership, so DEV_WALLET's all-owned hangar (never
// saved) cannot leak into the real save by equipping something.
function savePaint(bought) {
    if (bought) localStorage.setItem('tunnel_paint_owned', JSON.stringify(paintOwned));
    localStorage.setItem('tunnel_ship_paint', JSON.stringify(shipPaint));
}
if (DEV_WALLET) {   // constants.js, ships false
    shards = Math.max(shards, 9999);
    for (const k of ['c', 'p', 'm', 'fx']) paintOwned[k] = (1 << _paintList(k).length) - 1;
}
// Paint sheet, layered on top of the ALL SHIPS sheet. paintTab is the slot being browsed
// (index into PAINT_SLOTS); paintPreview is the unowned part tapped once in that tab (shown
// on the preview ships; a second tap buys it), -1 = none.
let showPaint = false;
let paintTab = 0;
let paintPreview = -1;
let _paintTabRects = [];
// Last coin picked up (systems.js), for the PULSE paint (paint.js). Presentation only.
let paintCoinFx = { col: null, t: -9 };
let _paintBtnRect = null;
let _paintPanelRect = null;
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
// The longest streak ever reached. Backs the two `earn: 'streak'` paints (constants.js
// PAINT_COLORS) and is monotonic on purpose, so a missed day never takes a paint away.
// Seeded from the current streak on first load, which is the only value an existing
// save can prove.
let bestStreak = Math.max(parseInt(localStorage.getItem('tunnel_best_streak') || '0'), streak);
// Banked rest days (constants.js STREAK_GRACE_MAX): one is earned on every completed
// week and spent by a single missed day instead of resetting the streak.
let streakGrace = parseInt(localStorage.getItem('tunnel_streak_grace') || '0');
// What the day rollover just granted (lifecycle.js dayRollover), or null when no new
// day started in this session: { dust, bonus, crate, grace, streak }. Read by the title
// screen's arrival card and by the death screen's stardust chip on the day's first run.
// Deliberately session-only - it is a "what just happened" report, not saved state.
let dayGrant = null;
// Seconds the arrival card stays on the title screen, counted down in update.js.
let dayGrantT = 0;
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
// Web app-pitch store buttons (draw.js drawWebContinuePromo), null while it is not up.
let _promoAppleBtnRect = null, _promoPlayBtnRect = null;
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
// The stardust path: the day-0-to-last-ship timeline opened by tapping the ✦ wallet on
// the ALL SHIPS sheet. Answers "what is this number for?" where the question comes up,
// instead of the Settings explainer's one line two panels away.
let showStardustPath = false;
let _stardustBtnRect = null;
let _stardustPathPanelRect = null;
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
// Blue-coin slow banked while a warp is live (systems.js blue branch, drained at
// update.js's warpTime falling edge). A warp already makes the player immune to
// every hazard, so a slow window spent inside one has no gameplay value at all and
// simply evaporates - and it is a big share of the window: a warp runs 1.1-1.6s
// against the coin's 4.0s. Banking it means the pickup is always worth what it says.
// Same category of per-player effect slowTime itself is: no rng(), no placement
// decision, nothing another player's cave depends on, so it is not a cross-device
// fairness concern (see the "Deliberately real seconds" note in CLAUDE.md's warp doc).
let slowPending;
// Grace/invulnerability window after an absorbed hit (constants.js HIT_INVULN_SEC doc).
let invulnT;
// Wall-only grace after a hull scratch (constants.js WALL_GRACE_SEC): the wall clamps
// instead of scratching again; every hazard still kills. Deliberately not invulnT.
let wallGraceT = 0;
// Safe opening zone (constants.js SAFE_START_WX doc): world-x where the open corridor has
// closed to normal this run, how long it takes to close, and whether the one-shot
// walls-live hint has fired. 0 on the title screen = no zone. (The walls are lethal from the
// tunnel entry since 2026-09-19; this only widens the corridor now.)
let safeEndWx = 0, safeCloseWx = 1, wallsLiveShown = false;
// Flight plan (constants.js sector table): wall-only scratches left this run
// (HULL_SCRATCHES at start, spent by update.js hullScratch, never expiring), and the
// highest sector whose "SECTOR n" notif has already fired this run.
let hullScratches = 0, lastSectorShown = 0;
// Repair kits dropped by bullet kills (constants.js REPAIR_KIT_PTS doc), and the HUD hull
// row's pulse after one refilled it (seconds left).
let repairKits = [], hullRepairFlash = 0;
// Rewarded continue, run-scoped (constants.js CONTINUE_MIN_SCORE doc). continueOfferPending
// is true while the offer icon is up and death's real bookkeeping (commitDeath) is on
// hold; continueAdPending is true only while native has a rewarded ad on screen, and
// freezes deadT so a slow-loading/long-watched ad can't let the auto-commit fire out
// from under a decision the player already made.
let continuesUsedThisRun, continueOfferPending, continueAdPending;
// Web only (constants.js WEB_CONTINUE_PROMO_SEC doc): the app pitch that stands in for
// the rewarded video. webPromoT counts up while the promo screen is on; webPromoOn is
// what draw.js/input.js route on. Never set in either app - isWeb() gates every write.
let webPromoOn = false, webPromoT = 0;
// Web only: the "in the app" sheet opened from a greyed-out title control that exists
// only in the apps ('leaderboard' | 'challenge' | 'paint', null = closed). Never set in
// either app - input.js opens it only behind isWeb(). draw.js drawAppOnlySheet.
let appOnlyKey = null;
let _appOnlyPanelRect = null, _appOnlyAppleBtnRect = null, _appOnlyPlayBtnRect = null;
// Revive countdown after a granted continue (constants.js REVIVE_COUNTDOWN_SEC doc),
// counted down while phase === 'revive'. Reaching 0 flips phase back to 'play'.
let reviveCountdownT;
// The same freeze reused for an interruption (2026-09-19 sound/UX review U2, input.js
// pauseForInterrupt): true while phase === 'revive' was entered because the app lost focus
// mid-run rather than through a rewarded continue. It decides the two differences: no
// HIT_INVULN_SEC at the end, and the cave stays covered (draw.js drawInterruptCover).
let interruptPaused = false;
// True from the moment the page loses focus / visibility until it is back (or tapped).
let _pageAway = false;
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
// warpTime counts down real seconds from warpMax (set fresh on every portal
// flythrough, never stacked - see constants.js WARP_DUR_MIN_SEC doc); warpWidenVisual chases its
// target through the same GAP_EASE_RATE-style channel gapBonusVisual already uses,
// so the corridor widens/narrows smoothly instead of snapping.
// warpMult is the scrollSpd() multiplier rolled once per warp from the player's
// own _prog2 at the moment of trigger (constants.js WARP_MULT_MIN/MAX doc,
// systems.js triggerWarp()) - captured here the same way slowTimeMax captures
// its window, so warpScrollFactor() (world.js) reads a fixed value for the
// whole warp instead of re-sampling a live, still-climbing _prog2 mid-flight.
let warpTime, warpMax, warpWidenVisual, warpMult;
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
// HUD instrument (constants.js HUD_SPARK_*): in-flight coin sparks, the score's swallow
// pulse (1 -> 0), and the full length of the current combo window so the combo chip's
// timer bar can show how much of it is left (ELECTRIC's window is shorter than 2.0s).
let hudSparks = [], hudBump = 0, coinComboWindow = 2.0;
let bonusScore, milestoneNext, nearMissTimer, coinCombo, coinComboTimer;
let grazeChain = 0, grazeChainT = 0;   // hazard graze chain (constants.js GRAZE_*)
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
// Blue-coin "Zeitblase" presentation state (constants.js SLOW_FX doc). Draw-only.
// slowFxVis: eased 0..1 intensity; vtime: slowed visual clock for ambient animation;
// slowFxPulseT: seconds since the pickup ring started (-1 = none); slowFxRipPh: ripple phase.
let slowFxVis = 0, vtime = 0, slowFxPulseT = -1, slowFxRipPh = 0;
let skinFx = [], skinFxT = 0;
let shipPitch = 0;
let shipRoll = SHIP3D_ROLL_BASE, shipRollV = 0;   // degrees, deg/s (constants.js SHIP_VIEW_3D)
let shipSweep = SHIP3D_SWEEP_CRUISE;   // 1 = folded back (warp) .. 0 = spread (blue coin); normal flight cruises in between
let shipBarrelT = -1;   // seconds into the portal barrel roll, -1 = none (SHIP3D_BARREL_SEC)
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
// Run scenes (constants.js SCENE_* doc, draw.js captureRunScenes): one { k, cv } snapshot
// per sector reached this run, in sector order, and the frozen death frame. Reset in
// startPlay(); a rewarded continue drops only the death frame.
let runScenes = [], runDeathScene = null;
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
    // Lifetime total, not a single run's best -- see the lifetimeScore doc above.
    if (lifetimeScore >= 100000) report('tunl_ach_score_100000');
    if (streak >= 7)  report('tunl_ach_streak_7');
    if (streak >= 30) report('tunl_ach_streak_30');
    let _anyMaxed = false, _allFleetMaxed = true;
    for (let i = 0; i < SKINS.length; i++) {
        const _owned = !!(unlockedSkins & (1 << i));
        if (_owned && masteryLevel(i) === MASTERY_XP_THRESHOLDS.length - 1) _anyMaxed = true;
        if (!_owned || masteryLevel(i) < MASTERY_XP_THRESHOLDS.length - 1) _allFleetMaxed = false;
    }
    if (_anyMaxed) report('tunl_ach_ace_pilot');
    if (_allFleetMaxed) report('tunl_ach_master_fleet');
};
window._tunlBackfillAchievements();
