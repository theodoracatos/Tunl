// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// World-x of the first stalactite on every run (see maintainStalactites). No stalactites
// or stalagmites at all before this -- the opening ~4-9s (score 0-25) is a clean stretch
// so a new player's first lesson is the feel of thrust-vs-gravity, not the death screen.
// The player sits at PX so they actually reach it a hair before score 25 (scrollX/60).
// It is a fixed world position, so the first one is always born off the right edge and
// scrolls in -- it never pops into view mid-screen.
const STAL_START_WX = 1500;

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

function titleScreen() {
    phase = 'title'; py = H / 2; vy = 0; holding = false; scrollX = 0;
    score = 0; newBest = false; newDailyBest = false;
    parts = []; thrustParts = []; deadT = 0; titleT = 0; flashA = 0; shake = 0; trailY = [];
    skinFx = []; skinFxT = 0; shipPitch = 0;
    stalactites = []; nextStalWx = 420;
    coins = [];     nextCoinWx = 99999;
    chicaneCoins = [];
    gapBonus = 0; gapBonusVisual = 0; slowTime = 0; slowTimeMax = 0; shieldCount = 0; shieldFlash = 0; magnetTime = 0; notifs = [];
    invulnT = 0; deathCause = null;
    continuesUsedThisRun = 0; continueOfferPending = false; continueAdPending = false;
    reviveCountdownT = 0;
    bullets = []; bulletAmmo = 0; bulletFireTimer = 0;
    ghostTrack = []; ghostY = null; ghostPitch = 0; ghostPassed = false;
    onFire = false; onFireFlash = 0;
    pbPassed = false; pbFlash = 0;
    mines = []; nextMineWx = 99999;
    cannons = []; nextCannonWx = 99999; cannonShots = [];
    // Coins never spawn on the title screen (nextCoinWx = 99999 above), so these are
    // never actually consulted here -- just kept defined to avoid stray undefineds.
    poisonClock = 0; nextPoisonAt = POISON_INTERVAL_SEC;
    bombClock   = 0; nextBombAt   = BOMB_INTERVAL_SEC;
    greenClock  = 0;
    prevRunScore = 0; lastRunScore = 0; milestoneFlash = 0; milestoneText = '';
    runCoins = 0; runNearMisses = 0; runMaxCombo = 0; skinUnlockIdx = -1;
    runCoinsByType = { gold: 0, blue: 0, red: 0, green: 0, orange: 0 };
    missionRewardWon = 0;
    levelIntroT = 0;
    initAmbParts();
    // Cave day, not necessarily today - see world.js _tunlActiveDayInt (?d= deep link).
    seedDailyVariety(_tunlActiveDayInt());
    refreshWave();
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
    bgmSetSlow(false);
    _fadeTitleMusic();
    // Web leaderboard: wall-clock start of this run, read at death for the
    // score/play-time sanity check. Harmless (unused) in the app builds.
    _webRunStartMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    phase = 'play'; py = H + PR * 4; vy = 0; holding = false; hasHeldThisRun = false; idleHoldTimer = 0; scrollX = 0; startRamp = 0;
    score = 0; newBest = false; newDailyBest = false;
    parts = []; thrustParts = []; deadT = 0; flashA = 0; shake = 0; trailY = [];
    skinFx = []; skinFxT = 0; shipPitch = -Math.PI / 2;
    // No stalactites/stalagmites before score ~25 (STAL_START_WX) on any run -- a clean
    // opening stretch so a new player's first lesson is the feel of thrust-vs-gravity,
    // not the death screen. Coins are deliberately left at their normal start distance --
    // they teach collection and can't kill anyone.
    stalactites = []; nextStalWx = STAL_START_WX;
    coins = [];     nextCoinWx = 500;
    chicaneCoins = [];
    gapBonus = 0; gapBonusVisual = 0; slowTime = 0; slowTimeMax = 0; shieldCount = 0; shieldFlash = 0; magnetTime = 0; notifs = [];
    invulnT = 0; deathCause = null;
    continuesUsedThisRun = 0; continueOfferPending = false; continueAdPending = false;
    reviveCountdownT = 0;
    bullets = []; bulletAmmo = 0; bulletFireTimer = 0;
    // Ghost: fresh recording buffer for this run; ghostPlay itself (today's best, from
    // state.js / die()) is untouched here so it survives across runs within the day.
    ghostTrack = []; ghostY = null; ghostPitch = 0; ghostPassed = false;
    onFire = false; onFireFlash = 0;
    pbPassed = false; pbFlash = 0;
    mines = []; nextMineWx = 1800;
    // Cannons start much later than mines (score ~100) and are spaced far apart -- a
    // rare hazard, not a constant one (see world.js cannonSpacing()).
    cannons = []; nextCannonWx = 6000; cannonShots = [];
    bonusScore = 0; milestoneNext = 50; nearMissTimer = 0; coinCombo = 0; coinComboTimer = 0;
    runCoins = 0; runNearMisses = 0; runMaxCombo = 0; skinUnlockIdx = -1;
    skinMasteryUpIdx = -1; missionRewardWon = 0;
    runStartMasteryLevel = masteryLevel(activeSkin);
    runCoinsByType = { gold: 0, blue: 0, red: 0, green: 0, orange: 0 };
    // Day streak update
    const _td = new Date();
    const _todayInt = _td.getUTCFullYear() * 10000 + (_td.getUTCMonth() + 1) * 100 + _td.getUTCDate();
    const _yd = new Date(Date.now() - 86400000);
    const _yesterdayInt = _yd.getUTCFullYear() * 10000 + (_yd.getUTCMonth() + 1) * 100 + _yd.getUTCDate();
    const _lastDay = parseInt(localStorage.getItem('tunnel_lastday') || '0');
    if (_lastDay !== _todayInt) {
        streak = _lastDay === _yesterdayInt ? streak + 1 : 1;
        localStorage.setItem('tunnel_streak', streak);
        if (streak === 7)  window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'achievement', id: 'tunl_ach_streak_7' });
        if (streak === 30) window.webkit?.messageHandlers?.gameCenter?.postMessage({ action: 'achievement', id: 'tunl_ach_streak_30' });
        // Stardust: flat per-day grant, decoupled from skill or run count (constants.js
        // STARDUST_PER_DAY doc comment) -- the SOLARIS-only currency that makes coming
        // back tomorrow the only lever, not how well or how much is played today.
        stardust += STARDUST_PER_DAY;
        if (streak % STARDUST_STREAK_BONUS_DAY === 0) stardust += 1;
        localStorage.setItem('tunnel_stardust', stardust);
        localStorage.setItem('tunnel_lastday', _todayInt);
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
    }
    dailyRuns++;
    localStorage.setItem('tunnel_daily_runs', dailyRuns);
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
    seedDailyVariety(_dayInt);
    // Poison/bomb clocks (constants.js POISON_INTERVAL_SEC doc): jittered +/-30% like
    // every other next*Wx spacing in this file, and drawn from the same seeded rng()
    // so a given calendar day plays out identically for every player, same as the
    // tunnel shape and every other obstacle's placement.
    poisonClock = 0; nextPoisonAt = POISON_INTERVAL_SEC * (0.7 + rng() * 0.6);
    bombClock   = 0; nextBombAt   = BOMB_INTERVAL_SEC   * (0.7 + rng() * 0.6);
    greenClock  = 0;
    refreshWave();
    _startBgMusic();
    sfxEngineSpoolUp();
}
