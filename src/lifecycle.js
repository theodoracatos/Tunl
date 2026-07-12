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
    prevRunScore = 0; lastRunScore = 0; milestoneFlash = 0; milestoneText = '';
    runCoins = 0; runNearMisses = 0; runMaxCombo = 0; skinUnlockIdx = -1;
    initAmbParts();
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
    bonusScore = 0; milestoneNext = 25; nearMissTimer = 0; coinCombo = 0; coinComboTimer = 0;
    runCoins = 0; runNearMisses = 0; runMaxCombo = 0; skinUnlockIdx = -1;
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
        dailyBest = 0; dailyRuns = 0;
        localStorage.setItem('tunnel_daily_best', '0');
        localStorage.setItem('tunnel_daily_runs', '0');
        top5 = []; localStorage.setItem('tunnel_top5', '[]');
    }
    dailyRuns++;
    localStorage.setItem('tunnel_daily_runs', dailyRuns);
    milestoneFlash = 0; milestoneText = '';
    const _d = new Date();
    seedRng(_d.getUTCFullYear() * 10000 + (_d.getUTCMonth() + 1) * 100 + _d.getUTCDate());
    refreshWave();
    _startBgMusic();
}
