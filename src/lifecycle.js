// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// World-x of the first stalactite on every run (see maintainStalactites). Nothing before
// it: the first ~50 points are the safe opening flight (constants.js SAFE_START_WX).
// A fixed world position, so the first one is always born off the right edge and
// scrolls in -- it never pops into view mid-screen.
const STAL_START_WX = HAZARD_START_WX;   // was 1500 (~score 25) until the 2026-09-13 safe opening flight

// One rng stream per spawner, all derived from the day (constants.js makeRngStream).
// Distinct salts so the streams are independent of each other, not phase-shifted
// copies. Called from both titleScreen() (the attract-mode tunnel spawns
// stalactites) and startPlay().
function _seedSpawnStreams(dayInt) {
    rngStal   = makeRngStream(Math.imul(dayInt ^ 0x5741, 0x2545F491));
    rngCoin   = makeRngStream(Math.imul(dayInt ^ 0xC01D, 0x9E3779B1));
    rngMine   = makeRngStream(Math.imul(dayInt ^ 0x4D19, 0x85EBCA6B));
    rngCannon = makeRngStream(Math.imul(dayInt ^ 0xCA77, 0xC2B2AE35));
}

function initAmbParts() {
    ambParts = Array.from({ length: 30 }, () => ({
        x:   Math.random() * W,
        y:   Math.random() * H,
        vy:  (Math.random() - 0.5) * 16,
        par: 0.12 + Math.random() * 0.18,
        r:   0.5  + Math.random() * 1.0,
        a:   0.06 + Math.random() * 0.10,
    }));
}

// ── Calendar-day rollover ─────────────────────────────────────────────
// Everything that happens once per UTC day: the streak, the stardust grant, the week
// crate and the reset of the day's own state (best/runs/shards, ghost, missions, the
// rewarded-ad bonus). Everything here is keyed off the REAL date, never the cave day a
// ?d= deep link may point at (web.js _tunlActiveDate) - a shared link to Tuesday's cave
// must not hand out Tuesday's stardust again.
//
// Called from BOTH titleScreen() and startPlay(): the constants.js Stardust block
// describes the grant as earned by "opening the app", and until 2026-09-22 only
// startPlay() ran it, so a player who opened TUNL, looked at the hangar and closed it
// again got nothing. Running it at the title fixes that and gives the arrival card
// (draw.js) something to report before the first run; keeping it in startPlay() covers
// a session left open across midnight, which never passes through the title again.
// It is a no-op on every call after the first of a day.
function dayRollover() {
    const _td = new Date();
    const _todayInt = _td.getUTCFullYear() * 10000 + (_td.getUTCMonth() + 1) * 100 + _td.getUTCDate();
    const _lastDay = parseInt(localStorage.getItem('tunnel_lastday') || '0');
    if (_lastDay === _todayInt) return;

    const _dayIntAgo = n => {
        const d = new Date(Date.now() - n * 86400000);
        return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
    };
    const _yesterdayInt  = _dayIntAgo(1);
    const _twoDaysAgoInt = _dayIntAgo(2);

    // A rest day (constants.js STREAK_GRACE_MAX) absorbs exactly one missed day: last
    // played the day before yesterday AND one banked. Two missed days still reset.
    // The missed day itself never granted stardust - the bank buys the streak's
    // continuity, not the day.
    let graceUsed = false;
    if (_lastDay === _yesterdayInt) {
        streak += 1;
    } else if (_lastDay === _twoDaysAgoInt && streakGrace > 0) {
        streak += 1;
        streakGrace -= 1;
        graceUsed = true;
    } else {
        streak = 1;
    }
    localStorage.setItem('tunnel_streak', streak);
    if (streak > bestStreak) {
        bestStreak = streak;
        localStorage.setItem('tunnel_best_streak', bestStreak);
    }
    if (streak === 7)  window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'achievement', id: 'tunl_ach_streak_7' });
    if (streak === 30) window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'achievement', id: 'tunl_ach_streak_30' });

    // Stardust: flat per-day grant, decoupled from skill or run count (constants.js
    // STARDUST_PER_DAY doc comment) -- the SOLARIS-only currency that makes coming
    // back tomorrow the only lever, not how well or how much is played today.
    stardust += STARDUST_PER_DAY;
    const weekDone = streak % STARDUST_STREAK_BONUS_DAY === 0;
    let crate = 0;
    if (weekDone) {
        stardust += 1;
        // The week crate (constants.js STREAK_WEEK_SHARDS): granted straight into the
        // wallet, deliberately NOT through dailyShardsEarned, so it sits outside
        // DAILY_SHARD_CAP like the mission and rewarded-ad payouts.
        crate = STREAK_WEEK_SHARDS;
        shards += crate;
        localStorage.setItem('tunnel_shards', shards);
        // A completed week also banks the next rest day, capped so weeks cannot be
        // stockpiled into a licence to play twice a month.
        if (streakGrace < STREAK_GRACE_MAX) {
            streakGrace += 1;
        }
    }
    localStorage.setItem('tunnel_stardust', stardust);
    localStorage.setItem('tunnel_streak_grace', streakGrace);
    localStorage.setItem('tunnel_lastday', _todayInt);

    // What the arrival card (title) and the stardust chip (death screen) report. Session
    // -only: a fresh launch later the same day shows nothing, because nothing happened.
    dayGrant = { dust: STARDUST_PER_DAY + (weekDone ? 1 : 0), bonus: weekDone, crate: crate, grace: graceUsed, streak: streak };
    dayGrantT = DAY_GRANT_SEC;
    // Reuses the mission-complete chime rather than adding a sound: this sits at the
    // same level of the loudness hierarchy (a rare reward, above a routine pickup) and
    // audio.js already proved that mix. On the very first launch of a day the
    // AudioContext is usually still suspended, exactly like sfxBoot() next to it, so
    // this is the card's accent when it can be, never something it waits for.
    if (typeof sfxMissionDone === 'function') sfxMissionDone();

    dailyBest = 0; dailyRuns = 0; dailyShardsEarned = 0;
    localStorage.setItem('tunnel_daily_best', '0');
    localStorage.setItem('tunnel_daily_runs', '0');
    localStorage.setItem('tunnel_daily_shards', '0');
    // Today's rewarded-ad shard bonus is available again (constants.js SHARDS_AD_REWARD).
    shardsAdClaimedToday = false;
    localStorage.setItem('tunnel_shards_ad_claimed', '0');
    top5 = []; localStorage.setItem('tunnel_top5', '[]');
    // The new day's corridor is a different shape, so yesterday's ghost is racing
    // through a cave that no longer exists -- drop it along with the other daily
    // state rather than let it replay against the wrong tunnel.
    ghostPlay = null; ghostScore = 0;
    localStorage.removeItem('tunnel_ghost');
    dailyMissionStats = { gold: 0, blue: 0, red: 0, green: 0, orange: 0, bomb: 0, dist: 0, nearMisses: 0, bestCombo: 0, bestScore: 0, runs: 0 };
    dailyMissionsClaimed = [false, false, false];
    dailyMissionIdx = pickDailyMissionIndices(_todayInt);
    localStorage.setItem('tunnel_daily_mission_stats', JSON.stringify(dailyMissionStats));
    localStorage.setItem('tunnel_daily_missions_claimed', JSON.stringify(dailyMissionsClaimed));
    // The reminder's "played today" flag and its streak line both just changed.
    if (typeof window._tunlReminderReschedule === 'function') window._tunlReminderReschedule();
}

function titleScreen() {
    approachWindOff();
    phase = 'title'; py = H / 2; vy = 0; holding = false; scrollX = 0; approachLeft = 0;
    score = 0; newBest = false; newDailyBest = false;
    parts = []; thrustParts = []; deadT = 0; titleT = 0; flashA = 0; shake = 0; trailY = [];
    skinFx = []; skinFxT = 0; shipPitch = 0; shipRoll = SHIP3D_ROLL_BASE; shipRollV = 0; shipSweep = SHIP3D_SWEEP_CRUISE; shipBarrelT = -1;
    _seedSpawnStreams(_tunlActiveDayInt());
    stalactites = []; nextStalWx = 420; nextFallWx = 99999;
    coins = [];     nextCoinWx = 99999;
    chicaneCoins = []; lastChicaneCoinWx = -Infinity;
    gapBonus = 0; gapBonusVisual = 0; slowTime = 0; slowTimeMax = 0; slowPending = 0; slowFxVis = 0; slowFxPulseT = -1; shieldCount = 0; shieldFlash = 0; magnetTime = 0; notifs = []; hudSparks = []; hudBump = 0;
    invulnT = 0; wallGraceT = 0; deathCause = null;
    safeEndWx = 0; safeCloseWx = 1; wallsLiveShown = false;
    hullScratches = 0; lastSectorShown = 0; repairKits = []; hullRepairFlash = 0;
    continuesUsedThisRun = 0; continueOfferPending = false; continueAdPending = false;
    webPromoOn = false; webPromoT = 0;
    reviveCountdownT = 0; interruptPaused = false;
    bullets = []; bulletAmmo = 0; bulletFireTimer = 0;
    ghostTrack = []; ghostY = null; ghostPitch = 0; ghostPassed = false;
    onFire = false; onFireFlash = 0;
    pbPassed = false; pbFlash = 0;
    mines = []; nextMineWx = 99999;
    cannons = []; nextCannonWx = 99999; cannonShots = [];
    boulders = []; nextBoulderWx = 99999;
    portals = []; nextPortalWx = 99999;
    warpTime = 0; warpMax = 0; warpWidenVisual = 0; warpMult = WARP_MULT_MIN;
    // Coins never spawn on the title screen (nextCoinWx = 99999 above), so these are
    // never actually consulted here -- just kept defined to avoid stray undefineds.
    nextPoisonWx = 0; nextBombWx = 0; nextDrainWx = 0;
    lastBlueWx = 0; lastRedWx = 0; lastGreenWx = 0;
    flightClock = 0; flightAchIdx = 0;
    prevRunScore = 0; lastRunScore = 0; milestoneFlash = 0; milestoneText = '';
    runCoins = 0; runNearMisses = 0; runMaxCombo = 0; skinUnlockIdx = -1;
    runHitCount = 0; sprintAchFired = false; noHitAchFired = false; noBonusAchFired = false; runBoulderNarrowPasses = 0;
    runCoinsByType = { gold: 0, blue: 0, red: 0, green: 0, orange: 0 };
    missionRewardWon = 0;
    levelIntroT = 0;
    initAmbParts();
    // Cave day, not necessarily today - see world.js _tunlActiveDayInt (?d= deep link).
    seedDailyVariety(_tunlActiveDayInt());
    refreshWave();
    // A new calendar day is granted here, at the title, not only at the first run
    // (see dayRollover) -- and its arrival card is drawn over this screen.
    dayRollover();
    _startTitleMusic();
    sfxBoot();
    // Web build: refresh today's world rank (no-op without a leaderboard API set,
    // and self-throttled to once per 20s). The app gets this from Game Center.
    if (typeof webFetchRank === 'function') webFetchRank();
}

function startPlay() {
    thrustOff();
    onFireLoopOff();
    magnetLoopOff();
    warpLoopOff();
    approachWindOff();
    bgmSetSlow(false);
    bgmSetWarp(false);
    _fadeTitleMusic();
    // Web leaderboard: wall-clock start of this run, read at death for the
    // score/play-time sanity check. Harmless (unused) in the app builds.
    _webRunStartMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    // Web analytics: half of the /play funnel (loaded -> actually played). The
    // global is defined only by the snippet build-play.mjs injects into the web
    // head, so this is inert in the iOS/Android builds by construction - see
    // FIREBASE_HEAD there for the session/attribution contract.
    if (typeof window !== 'undefined' && window._tunlGA) window._tunlGA('run_start');
    phase = 'play'; py = H + PR * 4; vy = 0; holding = false; hasHeldThisRun = false; idleHoldTimer = 0; scrollX = 0; startRamp = 0;
    score = 0; newBest = false; newDailyBest = false;
    parts = []; thrustParts = []; deadT = 0; flashA = 0; shake = 0; trailY = [];
    skinFx = []; skinFxT = 0; shipPitch = -Math.PI / 2; shipRoll = SHIP3D_ROLL_BASE; shipRollV = 0; shipSweep = SHIP3D_SWEEP_CRUISE; shipBarrelT = -1;
    // No stalactites/stalagmites before STAL_START_WX (~score 107) on any run -- see
    // constants.js SAFE_START_WX. Coins start at their normal distance; they can't kill.
    stalactites = []; nextStalWx = STAL_START_WX;
    // Falling stalactites: none before world-x 7800 (~score 130) -- a fresh player
    // learns plain stalactites first (see updateFallingStals / fallSpacing). Was
    // 12000 (~score 200) until 2026-09-11: a replay audit against the real daily
    // leaderboard found the highest daily best ever recorded is 169, so at 12000
    // this was content essentially no player had ever seen. 7800 keeps a full ~100
    // points of plain-stalactite schooling first and still lands inside the reach of
    // a good run. The loose spike shakes and trickles dust before it lets go, so the
    // tell is readable the first time it happens.
    nextFallWx = FALL_START_WX;   // 7800 until 2026-09-13, see constants.js
    coins = [];     nextCoinWx = 500;
    chicaneCoins = []; lastChicaneCoinWx = -Infinity;
    gapBonus = 0; gapBonusVisual = 0; slowTime = 0; slowTimeMax = 0; slowPending = 0; slowFxVis = 0; slowFxPulseT = -1; shieldCount = 0; shieldFlash = 0; magnetTime = 0; notifs = []; hudSparks = []; hudBump = 0;
    invulnT = 0; wallGraceT = 0; deathCause = null;
    continuesUsedThisRun = 0; continueOfferPending = false; continueAdPending = false;
    webPromoOn = false; webPromoT = 0;
    reviveCountdownT = 0; interruptPaused = false;
    bullets = []; bulletAmmo = 0; bulletFireTimer = 0;
    // Ghost: fresh recording buffer for this run; ghostPlay itself (today's best, from
    // state.js / die()) is untouched here so it survives across runs within the day.
    ghostTrack = []; ghostY = null; ghostPitch = 0; ghostPassed = false;
    onFire = false; onFireFlash = 0;
    pbPassed = false; pbFlash = 0;
    mines = []; nextMineWx = MINE_START_WX;   // was 1800, then HAZARD_START_WX; see constants.js
    // Cannons start much later than mines (score ~100) and are spaced far apart -- a
    // rare hazard, not a constant one (see world.js cannonSpacing()).
    cannons = []; nextCannonWx = CANNON_START_WX; cannonShots = [];   // was 6000
    // Boulders: routing obstacle ("commit up or down"), from world-x 5100 (~score
    // 85) -- just past the magnet gate (score 71), before the first cannon (100).
    // Was 84000 (~score 1400, ~109 real seconds of flawless flight) until
    // 2026-09-11, which a replay audit showed meant no player had ever seen one: the
    // highest daily best in the leaderboard is 169. Moving it early is also the
    // FORGIVING direction, not the harsh one - makeBoulder() bounds the radius by the
    // corridor, so at score 85 the narrow pass measures 1.74 player diameters versus
    // 1.11 at score 1400. boulderSpacing() keeps it a sparse set-piece either way.
    boulders = []; nextBoulderWx = BOULDER_START_WX;   // was 5100
    // Warp portal ring: rare reward set-piece, from PORTAL_START_WX (~score 50, see
    // constants.js "Warp portal" doc) - well before boulders/cannons so a new player
    // can meet the reward before the first real hazard set-piece.
    portals = []; nextPortalWx = PORTAL_START_WX;
    warpTime = 0; warpMax = 0; warpWidenVisual = 0; warpMult = WARP_MULT_MIN;
    // 75: the 25 and 50 rungs are free since the safe flight (constants.js MIN_REAL_RUN_SCORE).
    // The three resets below used to sit AFTER this comment on the same line, i.e. inside
    // it, so they never ran - a run began with the previous run's combo state. Mostly
    // masked, because update.js clears the combo the frame its timer expires, but the
    // timer freezes at death (the dead branch advances only deadT), so a combo still had
    // up to ~0.7s of the next run's launch ramp to survive into and pay out on its first
    // coin. Keep these on their own line.
    bonusScore = 0; milestoneNext = MIN_REAL_RUN_SCORE;
    nearMissTimer = 0; coinCombo = 0; coinComboTimer = 0; grazeChain = 0; grazeChainT = 0;
    runCoins = 0; runNearMisses = 0; runMaxCombo = 0; skinUnlockIdx = -1;
    runHitCount = 0; sprintAchFired = false; noHitAchFired = false; noBonusAchFired = false; runBoulderNarrowPasses = 0;
    skinMasteryUpIdx = -1; missionRewardWon = 0;
    runStartMasteryLevel = masteryLevel(activeSkin);
    runCoinsByType = { gold: 0, blue: 0, red: 0, green: 0, orange: 0 };
    dayRollover();
    dailyRuns++;
    localStorage.setItem('tunnel_daily_runs', dailyRuns);
    // Lifetime-runs-played achievements (constants.js RUNS_ACHIEVEMENTS): this counter
    // only ever advances by 1 per call, so a plain before/after threshold check is
    // enough - same crossing idiom as the DIST_ACHIEVEMENTS check in update.js.
    const _runsBefore = totalRuns;
    totalRuns++;
    localStorage.setItem('tunnel_total_runs', totalRuns);
    for (const ra of RUNS_ACHIEVEMENTS) {
        if (_runsBefore < ra.at && totalRuns >= ra.at) {
            window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'achievement', id: ra.id });
        }
    }
    // Safe opening flight (constants.js SAFE_START_WX doc).
    safeEndWx = SAFE_START_WX; safeCloseWx = SAFE_CLOSE_WX;
    hullScratches = HULL_SCRATCHES; lastSectorShown = 1;   // constants.js flight plan
    repairKits = []; hullRepairFlash = 0;
    resetRunScenes();                                       // constants.js SCENE_* doc
    wallsLiveShown = false;
    // A ghost carried in on a ?g= share link (state.js _webGhostPlay) has to
    // survive the daily-rollover reset above, which clears the local ghost -
    // racing that shared ghost is the whole point of opening the link.
    if (typeof _webGhostPlay !== 'undefined' && _webGhostPlay) {
        ghostPlay = _webGhostPlay;
        ghostScore = _webGhostScore | 0;
    }
    milestoneFlash = 0; milestoneText = '';
    levelIntroT = LEVEL_INTRO_DUR;
    // Cave day, not necessarily today - see world.js _tunlActiveDayInt (?d= deep link).
    const _dayInt = _tunlActiveDayInt();
    seedRng(_dayInt);
    _seedSpawnStreams(_dayInt);
    seedDailyVariety(_dayInt);
    // Poison/bomb clocks (constants.js POISON_INTERVAL_SEC doc): jittered +/-30% like
    // every other next*Wx spacing in this file, and drawn from the same seeded rng()
    // so a given calendar day plays out identically for every player, same as the
    // tunnel shape and every other obstacle's placement.
    // Hazard/reward coin cadence as world-x targets (state.js nextPoisonWx doc). The
    // jitter still comes from the same seeded rng(), so a given calendar day plays out
    // identically for every player - which is now literally true rather than
    // approximately, since these no longer depend on how fast the device scrolls.
    // Flight plan (constants.js sector table): bomb unlocks in sector 3 with the first
    // mine, poison in sector 8, drain in sector 9. The first one of each lands a short,
    // jittered 15-65% of its interval after unlock, so it shows up in (or just after)
    // the sector that introduces it; every later one uses the normal interval.
    nextPoisonWx = POISON_START_WX + worldPxForSec(POISON_INTERVAL_SEC * (0.15 + rngCoin() * 0.5), POISON_START_WX);
    nextBombWx   = BOMB_START_WX   + worldPxForSec(BOMB_INTERVAL_SEC   * (0.15 + rngCoin() * 0.5), BOMB_START_WX);
    nextDrainWx  = DRAIN_START_WX  + worldPxForSec(DRAIN_INTERVAL_SEC  * (0.15 + rngCoin() * 0.5), DRAIN_START_WX);
    // Power-up supply floors: 0 = "as if one just landed at the start line". They only
    // apply past the score-34 gate in makeCoin() anyway, well beyond any floor width.
    lastBlueWx = 0; lastRedWx = 0; lastGreenWx = 0;
    flightClock = 0; flightAchIdx = 0;
    refreshWave();
    approachStart();   // approach.js: the run opens over the city, before world-x 0
    bgmSetSector(0, true);   // audio.js: every run starts on the unbuilt track
    _startBgMusic();
    sfxEngineSpoolUp(START_RAMP_SEC);
}
