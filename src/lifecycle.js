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
    gapBonus = 0; slowTime = 0; shieldCount = 0; shieldFlash = 0; magnetTime = 0; notifs = [];
    bullets = []; bulletAmmo = 0; bulletFireTimer = 0;
    mines = []; nextMineWx = 99999;
    cannons = []; nextCannonWx = 99999; cannonShots = [];
    // Coins never spawn on the title screen (nextCoinWx = 99999 above), so these are
    // never actually consulted here -- just kept defined to avoid stray undefineds.
    poisonClock = 0; nextPoisonAt = POISON_INTERVAL_SEC;
    bombClock   = 0; nextBombAt   = BOMB_INTERVAL_SEC;
    prevRunScore = 0; lastRunScore = 0; milestoneFlash = 0; milestoneText = '';
    runCoins = 0; runNearMisses = 0; runMaxCombo = 0; skinUnlockIdx = -1;
    runCoinsByType = { gold: 0, blue: 0, red: 0, green: 0, orange: 0 };
    levelIntroT = 0;
    initAmbParts();
    const _dt = new Date();
    seedDailyVariety(_dt.getUTCFullYear() * 10000 + (_dt.getUTCMonth() + 1) * 100 + _dt.getUTCDate());
    refreshWave();
    _startTitleMusic();
}

function startPlay() {
    thrustOff();
    _fadeTitleMusic();
    phase = 'play'; py = H + PR * 4; vy = 0; holding = false; scrollX = 0; startRamp = 0;
    score = 0; newBest = false; newDailyBest = false;
    parts = []; thrustParts = []; deadT = 0; flashA = 0; shake = 0; trailY = [];
    skinFx = []; skinFxT = 0; shipPitch = -Math.PI / 2;
    stalactites = []; nextStalWx = 420;
    coins = [];     nextCoinWx = 500;
    chicaneCoins = [];
    gapBonus = 0; slowTime = 0; shieldCount = 0; shieldFlash = 0; magnetTime = 0; notifs = [];
    bullets = []; bulletAmmo = 0; bulletFireTimer = 0;
    mines = []; nextMineWx = 1800;
    // Cannons start much later than mines (score ~100) and are spaced far apart -- a
    // rare hazard, not a constant one (see world.js cannonSpacing()).
    cannons = []; nextCannonWx = 6000; cannonShots = [];
    bonusScore = 0; milestoneNext = 25; nearMissTimer = 0; coinCombo = 0; coinComboTimer = 0;
    runCoins = 0; runNearMisses = 0; runMaxCombo = 0; skinUnlockIdx = -1;
    skinMasteryUpIdx = -1;
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
        localStorage.setItem('tunnel_lastday', _todayInt);
        dailyBest = 0; dailyRuns = 0; dailyShardsEarned = 0;
        localStorage.setItem('tunnel_daily_best', '0');
        localStorage.setItem('tunnel_daily_runs', '0');
        localStorage.setItem('tunnel_daily_shards', '0');
        top5 = []; localStorage.setItem('tunnel_top5', '[]');
        dailyMissionStats = { gold: 0, blue: 0, red: 0, green: 0, orange: 0, nearMisses: 0, bestCombo: 0, bestScore: 0, runs: 0 };
        dailyMissionsClaimed = [false, false, false];
        dailyMissionIdx = pickDailyMissionIndices(_todayInt);
        localStorage.setItem('tunnel_daily_mission_stats', JSON.stringify(dailyMissionStats));
        localStorage.setItem('tunnel_daily_missions_claimed', JSON.stringify(dailyMissionsClaimed));
    }
    dailyRuns++;
    localStorage.setItem('tunnel_daily_runs', dailyRuns);
    milestoneFlash = 0; milestoneText = '';
    levelIntroT = LEVEL_INTRO_DUR;
    const _d = new Date();
    const _dayInt = _d.getUTCFullYear() * 10000 + (_d.getUTCMonth() + 1) * 100 + _d.getUTCDate();
    seedRng(_dayInt);
    seedDailyVariety(_dayInt);
    // Poison/bomb clocks (constants.js POISON_INTERVAL_SEC doc): jittered +/-30% like
    // every other next*Wx spacing in this file, and drawn from the same seeded rng()
    // so a given calendar day plays out identically for every player, same as the
    // tunnel shape and every other obstacle's placement.
    poisonClock = 0; nextPoisonAt = POISON_INTERVAL_SEC * (0.7 + rng() * 0.6);
    bombClock   = 0; nextBombAt   = BOMB_INTERVAL_SEC   * (0.7 + rng() * 0.6);
    refreshWave();
    _startBgMusic();
    sfxEngineSpoolUp();
}
