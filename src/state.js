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
let _btnMusicRect = null, _btnFxRect = null;
let unlockedSkins = parseInt(localStorage.getItem('tunnel_skins') || '1');
let removeAdsOwned = localStorage.getItem('tunnel_remove_ads') === '1';
let activeSkin    = parseInt(localStorage.getItem('tunnel_skin')  || '0');
if (!(unlockedSkins & (1 << activeSkin))) activeSkin = 0;
let skinUnlockIdx = -1;
let _skinBtnRects = [];
let streak = parseInt(localStorage.getItem('tunnel_streak') || '0');
let _homeBtnRect = null, _playBtnRect = null;
let showSettings = false;
let _settingsBtnRect = null;
let _settingsPanelRect = null;
let _leaderboardBtnRect = null;
let _langBtnRects = [];
let _removeAdsBtnRect = null;
let _restoreBtnRect = null;
let parts, thrustParts, deadT, titleT, flashA, shake, trailY;
let stalactites, nextStalWx;
let coins, nextCoinWx;
let chicaneCoins;
let gapBonus;
let slowTime, shieldCount, shieldFlash, magnetTime;
let bullets, bulletAmmo, bulletFireTimer;
let mines, nextMineWx;
let notifs;
let bonusScore, milestoneNext, nearMissTimer, coinCombo, coinComboTimer;
let runCoins, runNearMisses, runMaxCombo;
let prevRunScore, lastRunScore;
let milestoneFlash, milestoneText;
let gtime = 0;
let skinFx = [], skinFxT = 0;
let shipPitch = 0;
let ambParts = [];
let deathMarkers = [];   // persists across runs: { wx, wallY }
const MAX_DEATH_MARKERS = 25;
let bestMarker = null;   // { wx, wallY } of all-time best run's death spot
