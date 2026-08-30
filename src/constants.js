const cv  = document.getElementById('c');
const ctx = cv.getContext('2d');

const W  = window.innerWidth;
const H  = Math.min(window.innerHeight, 600);
// UI_H/FS drive text AND UI element sizing (ship icons, spacing) -- deliberately NOT the
// real H 1:1: H is capped at 600 for corridor-difficulty reasons (CLAUDE.md) but virtually
// never gets near that cap on an actual landscape phone (~400-450pt tall, vs. desktop
// windows that easily clear 600), so sizing everything off plain H makes every label,
// perk, and mission line noticeably smaller on the exact devices most players actually
// use -- confirmed against a real iPhone 17 Pro Max simulator screenshot (956x440pt),
// where several labels rendered under 10px. Any UI metric (font size, icon radius, icon
// spacing) that reads H directly instead of UI_H will grow out of step with the rest of
// the screen on short-wide devices -- that mismatch is exactly what caused the ship
// picker's per-icon text to overflow past the canvas edge when only FS got this fix
// initially, so use UI_H for icon geometry too, not just text. This floor only affects
// UI sizing, never H itself, so corridor width/difficulty is completely unaffected.
const UI_H = Math.max(H, 600);
const FS = Math.sqrt(W * UI_H);   // font scale: ~603 in landscape, matches old 600x600 sizes
cv.width = W; cv.height = H;

// Dynamic Island / notch clearance, in canvas px (1:1 with CSS px -- W/H above are
// already window.innerWidth/innerHeight, not scaled by devicePixelRatio). Pushed
// from native (GameView.swift's TunlWebView.onSafeAreaChange, via the existing
// _tunlNativeUpdate bridge in main.js) rather than read from CSS env(safe-area-
// inset-*) here -- confirmed by an on-screen debug readout that env() always
// resolves to 0 in this app's WKWebView (TunlApp.swift's .ignoresSafeArea() plus
// its manual window-transform rotation trick for LandscapeLeft/Right leave WebKit's
// own safe-area plumbing with nothing to report), while UIKit's safeAreaInsets on
// the webview itself stays correct across both. Both left AND right are tracked,
// not just whichever edge the island happens to sit on at load -- rotating 180°
// mid-session swaps which edge is unsafe without changing W/H at all (same
// dimensions either way). Stay 0 with no native bridge (browser testing).
let SAFE_L = 0, SAFE_R = 0;

const PX      = W  * 0.22;
const PR      = W  * 0.018;
const GRAVITY = 1150;
const THRUST  = 2400;
const MAX_VY  = 820;
const RSTEP   = 3;

const DEV_INVINCIBLE = false; // set true to disable all deaths (testing only)

// Coin constants
const COIN_R          = W  * 0.009;   // visual radius
const COIN_HIT_R      = W  * 0.032;   // collection radius (generous)

// Size-coded rarity (UX audit, Konzept 06): a second signal channel independent of
// color/shape -- common types (gold, blue) stay at the base COIN_R, the two
// "occasional" state coins (shield, ammo) step up, and the two rarest positive
// events (magnet, bomb) step up again, so a glance at size alone hints at how much
// a pickup should matter. Poison is deliberately excluded: it already reads as
// distinct via its own silhouette + drip motion (see draw.js), not size -- making a
// hazard bigger would read as "more valuable," the opposite of the intent. Applied
// to both the drawn radius (draw.js) and the collection hitbox (systems.js
// checkCoinCollection), so the hitbox never outgrows what the player can see.
// COIN_SIZE_MAX_MULT is the placement code's (systems.js makeCoin) worst-case
// clearance buffer -- type isn't known yet when a coin's corridor position is
// picked, so it has to reserve room for the largest possible coin, not the average.
const COIN_SIZE_MULT     = { gold: 1.0, blue: 1.0, red: 1.15, orange: 1.15, green: 1.35, bomb: 1.35 };
const COIN_SIZE_MAX_MULT = 1.35;
const GAP_PER_COIN    = H  * 0.06;    // bonus halfGap added per coin
const GAP_BONUS_MAX   = H  * 0.15;    // cap: max halfGap bonus
const GAP_DECAY       = H  * 0.015;   // bonus lost per second

function lerp(a, b, t) { return a + (b - a) * Math.min(Math.max(t, 0), 1); }
function lerpClr(a, b, t) {
    return [Math.round(lerp(a[0],b[0],t)), Math.round(lerp(a[1],b[1],t)), Math.round(lerp(a[2],b[2],t))];
}
function rgb(c, a) {
    return a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

// ── Weekday wall palette ──────────────────────────────────────────────
// Replaces the old within-a-run difficulty color ramp (violet -> lava ->
// neon green by _prog) with a fixed color for the whole calendar day,
// chosen the same way the tunnel shape and daily missions already are: from
// the UTC date, so every player sees the same rock on the same day. Seven
// real space-rock/mineral references, deliberately spread across distinct
// hue families (blue / orange / neutral / teal / violet / yellow-green /
// pink) rather than picked freely -- an earlier draft repeated hues twice
// (two blue-greys, two teal-greens) and read as only 5 distinct days.
// Index 0 = Monday ... 6 = Sunday, matching weekdayIndex() below.
//
// `planet` is a one-word world name shown under the run-start LEVEL banner
// (draw.js), chosen to match each day's rock/color rather than the classical
// Monday=Moon/Tuesday=Mars weekday-planet etymology (that mapping would put
// Luna on Monday, but Monday's own rock here is the neutral grey reference
// day -- Mondasche's literal moon-ash color is the one that actually reads as
// the Moon, so it sits on Wednesday instead). Mostly real bodies so the tie
// reads as intentional, not a random label generator:
// Ceres (dwarf planet, grey) / Mars (iron-oxide red) / Luna (the Moon, ash-grey)
// / Io (solar system's volcanic moon, for the volcanic-glass obsidian) /
// Ianthe (a real Uranian moon -- Greek for "violet flower") / Pallas (real
// asteroid sharing its name with the Pallasite meteorite type this rock is
// already named after) / Rhodia (invented, from "rhodo-" = rose, mirroring
// Rhodonit's own pink manganese vein).
const WEEKDAY_PALETTES = [
    { name: 'Asteroid-Grau',      planet: 'Ceres',  wall: [43, 45, 52],  stal: [35, 36, 41],  stalEdge: [170, 196, 222], wallBase: [150, 178, 210] },
    { name: 'Rostgestein',        planet: 'Mars',   wall: [60, 36, 22],  stal: [51, 32, 15],  stalEdge: [255, 162, 92],  wallBase: [255, 148, 72] },
    { name: 'Mondasche',          planet: 'Luna',   wall: [41, 40, 44],  stal: [35, 34, 38],  stalEdge: [230, 230, 240], wallBase: [222, 222, 234] },
    { name: 'Obsidian',           planet: 'Io',     wall: [15, 15, 21],  stal: [12, 12, 17],  stalEdge: [122, 255, 210], wallBase: [112, 255, 206] },
    { name: 'Amethyst-Geode',     planet: 'Ianthe', wall: [36, 26, 58],  stal: [31, 22, 51],  stalEdge: [196, 140, 255], wallBase: [182, 122, 255] },
    { name: 'Peridot-Pallasit',   planet: 'Pallas', wall: [38, 36, 26],  stal: [33, 31, 22],  stalEdge: [208, 236, 112], wallBase: [196, 228, 96] },
    { name: 'Rhodonit-Gestein',   planet: 'Rhodia', wall: [48, 22, 34],  stal: [40, 18, 28],  stalEdge: [255, 140, 190], wallBase: [255, 122, 176] },
];
// Same bg for every day -- the walls carry the day's identity, not the void
// behind them.
const WEEKDAY_BG = [8, 7, 13];

// Monday = 0 ... Sunday = 6 (JS's own getUTCDay() is Sunday = 0).
function weekdayIndex(date) { return (date.getUTCDay() + 6) % 7; }

// ── Ship mastery ──────────────────────────────────────────────────────
// Per-ship XP (state.js `skinXP`, one coin collected while that ship is active
// = 1 XP) unlocks up to 3 mastery levels. Each level eases that ship's buff a
// little further and its drawback a little closer back toward neutral -- the
// more you fly a specific ship, the more you overcome its built-in weakness,
// on top of (not instead of) the base trade-off from constants.js SKINS.
// Levels never fully erase the drawback (see masteryLerp call sites in
// systems.js/update.js) so the ship keeps some identity even fully mastered.
const MASTERY_XP_THRESHOLDS = [0, 150, 400, 900]; // coins collected while flying that ship
function masteryLevel(skin) {
    const xp = (typeof skinXP !== 'undefined' && skinXP[skin]) || 0;
    let lvl = 0;
    for (let i = 1; i < MASTERY_XP_THRESHOLDS.length; i++) if (xp >= MASTERY_XP_THRESHOLDS[i]) lvl = i;
    return lvl;
}
function masteryLerp(skin, base, maxed) {
    return lerp(base, maxed, masteryLevel(skin) / (MASTERY_XP_THRESHOLDS.length - 1));
}

// Live current-value token for the title screen's perk description (draw.js, fills the
// '{v}' placeholder in i18n.js skinPerks). Re-derives the SAME masteryLerp() calls the
// actual buff logic uses (systems.js/update.js, see the skin balance comment above SKINS)
// so what the player reads always matches what mastery is giving them right now, not the
// frozen level-0 number the strings used to hardcode.
function skinPerkValue(skin) {
    switch (skin) {
        case 1: return `+${Math.round((masteryLerp(1, 1.5, 1.7) - 1) * 100)}%`;            // AMBER coin reach
        case 2: return `-${Math.round((1 - masteryLerp(2, 0.82, 0.74)) * 100)}%`;          // CRIMSON slim hitbox
        case 3: return `+${Math.round((masteryLerp(3, 6.0, 7.5) / 4 - 1) * 100)}%`;        // ELECTRIC slow time
        case 4: { const v = masteryLerp(4, 2.0, 2.5); return `${v % 1 === 0 ? v : v.toFixed(1)}x`; } // TOXIC coin bonus
        case 5: return `+${Math.round(masteryLerp(5, 4, 5)) - 3}`;                          // VOID shield cap
        case 6: return `+${Math.round((masteryLerp(6, 8.0, 11.0) / 5 - 1) * 100)}%`;       // NOVA magnet time
        case 7: return `+${Math.round((masteryLerp(7, 4.0, 5.0) / 2 - 1) * 100)}%`;        // SOLARIS near-miss range
        default: return '';
    }
}

// ── Ghost run ─────────────────────────────────────────────────────────
// The corridor is a pure function of world-x and the calendar day (world.js), so
// replaying a past run needs nothing but the ship's vertical position over time --
// no obstacle log, no input log, no seed capture. One sample every GHOST_STEP world
// px, quantised to a byte over [0, H].
//
// Quantising against H rather than storing raw pixels makes the track
// resolution-independent: py is bounded by [0, H] and the whole corridor scales with
// H, so a ghost recorded on a phone replays correctly on a tablet or a resized desktop
// window without any rescaling on load.
//
// GHOST_STEP is 60 to match the score formula (score = scrollX / 60), so one sample is
// exactly one point of distance score -- a score-1000 run is 1000 samples, ~1.4 KB
// base64. GHOST_MAX_SAMPLES bounds localStorage for marathon runs; past it the ghost
// simply stops being recorded and the player is treated as having passed it (see
// update.js), which is the correct outcome anyway at that distance.
const GHOST_STEP = 60;
const GHOST_MAX_SAMPLES = 4000;
// Late-join threshold, in score points remaining. The ghost SHIP only renders once the
// player has closed to within this gap of the ghost's final score; further out, draw.js
// falls back to the plain "GHOST -N" readout it already uses for GHOST OFF. Early in a
// run the player is still reading the corridor, not racing -- a second ship on screen
// then is clutter, not tension.
const GHOST_LATE_JOIN_GAP = 25;

function ghostEncode(track) {
    // Chunked because String.fromCharCode.apply blows the argument limit on a long run.
    let s = '';
    for (let i = 0; i < track.length; i += 1024) {
        s += String.fromCharCode.apply(null, track.slice(i, i + 1024));
    }
    return btoa(s);
}
function ghostDecode(b64) {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
}

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────
let _seed = 0;
function seedRng(s) { _seed = s >>> 0; }
function rng() {
    _seed = (_seed + 0x6D2B79F5) >>> 0;
    let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const MINE_R = W * 0.011;

// ── Cannons ───────────────────────────────────────────────────────────
// Rare wall-mounted turret hazard: sits flush against a wall like a
// stalactite root, fires exactly one diagonal shot as the player closes in,
// then goes inert for the rest of the run. CANNON_FIRE_LEAD is the
// world-px lead the player has when it fires (see systems.js
// updateCannonShots); CANNON_SHOT_TRAVEL is how long the shot takes to
// close that same distance, so together they fix the shot's closing speed.
const CANNON_R           = W * 0.020;
const CANNON_SHOT_R      = W * 0.013;
const CANNON_FIRE_LEAD   = W * 0.62;
const CANNON_SHOT_TRAVEL = 1.15;

// Bomb coin (purple): blast radius for the "destroy nearby obstacles" pickup effect --
// see systems.js triggerBombExplosion(). "Small" on purpose -- clears immediate danger,
// not the whole visible screen.
const BOMB_RADIUS = W * 0.30;

// ── Poison / bomb rarity ─────────────────────────────────────────────
// Both are driven by a real-time clock (state.js poisonClock/bombClock, incremented
// every play-frame in update.js), not a per-candidate percentage. An earlier version
// used `rate * coinSpacing()/scrollSpd()` per coin *candidate* -- that correctly held
// the candidate rate constant, but silently assumed every candidate becomes a real
// coin. It doesn't: coinBlockedByStal() (systems.js) rejects candidates that land too
// close to a stalactite, and a live replay of a real daily seed to score 1000 showed a
// ~90% rejection rate, varying with difficulty/chicane density/day archetype -- so the
// *actual* cadence players saw was roughly 10x rarer than intended and drifted with
// conditions no formula here could see. A real-time clock sidesteps the whole problem:
// once it passes its (jittered) target interval, the next coin that actually clears
// placement becomes poison/bomb (see makeCoin() in systems.js) -- immune to rejection
// rate, day archetype, and screen width by construction, not by calibration. Bomb is
// deliberately a bit more frequent than poison -- a reward landing at least as often as
// a punishment reads more generous.
// 55s/45s (the original guess) turned out to badly outlast how long runs actually
// last: a live replay of today's real seed found a "good" run (score ~300, the
// DAILY_SHARD_CAP-doc benchmark) takes only ~20-36 real seconds end to end on
// realistic phone widths (844-1512px), and even a "great" run (score ~1000) is only
// ~54-97s -- both far shorter than the ~136s a W=600 reference calc had implied.
// 55/45s meant many/most runs, especially on wider screens where scroll speed scales
// up, saw literally zero of either. Retuned so a great run sees several and even a
// good run has real odds of at least one.
const POISON_INTERVAL_SEC = 20; // avg real seconds between poison coins
const BOMB_INTERVAL_SEC   = 16; // avg real seconds between bomb coins

// ── Magnet (green) soft pity ─────────────────────────────────────────
// UX audit, Konzept 07: unlike poison/bomb, magnet is not force-overridden onto the
// next coin once a clock elapses -- that would make it feel scheduled instead of
// rare. Instead greenClock (state.js, incremented every play-frame like poisonClock/
// bombClock) only *biases the weighted roll* in makeCoin() upward the longer it's
// been since a magnet coin actually cleared placement, capped at
// GREEN_DROUGHT_CAP so a long drought shortens the odds without ever guaranteeing
// the next coin. GREEN_DROUGHT_SOFT_SEC is the real-seconds reference the bias
// ramps over -- reaching full GREEN_DROUGHT_CAP strength around this many seconds
// without one.
const GREEN_DROUGHT_SOFT_SEC = 40;
const GREEN_DROUGHT_CAP      = 2.0;

// Poison's runCoins penalty (this run's pending shard bank -- see update.js die()) is a
// percentage of the current pool, not a flat amount -- deliberately, on the explicit
// call that poison should "really punish" rather than just nudge. A %-based tax DOES
// compound multiplicatively over repeated hits (survivor fraction ~0.8^N for a 20% tax
// hit N times), which can gut a long marathon run's entire shard payout -- e.g. at 15%,
// 8 hits in one run leaves ~27% of the pool. That's the whole point of this version: a
// short unlucky run stings proportionally the same as a long one, but a long run that
// keeps getting careless with poison can lose most of what it built, instead of the
// previous flat model where N hits only ever cost N x a fixed amount no matter how
// large the pool had grown. (An earlier flat-loss version deliberately avoided exactly
// this compounding for exactly this reason -- see git history on POISON_LOSS_MIN/MAX
// if that trade-off ever needs revisiting.) Scales modestly with difficulty via _prog,
// same as the old flat version. Always removes at least 1 coin when runCoins > 0, so a
// tiny pool can't round down to a no-op hit.
const POISON_LOSS_PCT_MIN = 0.12;
const POISON_LOSS_PCT_MAX = 0.15;

// Run-start "LEVEL n: Name" banner timing. Was 1.6/0.5 -- bumped on explicit
// request to give the new planet subtitle line (draw.js) enough time to
// actually be read, not just glimpsed before it fades.
const LEVEL_INTRO_DUR  = 2.4; // total seconds visible
const LEVEL_INTRO_FADE = 0.6; // seconds of that spent fading out at the end

// Idle-hold gravity gate (update.js): every run opens with holding false (both the
// title-screen tap-to-confirm path and PLAY AGAIN, see input.js onDown/onUp) and
// withholds gravity entirely until the player's first press, so the ship flies dead
// level and an unprepared player isn't killed by a fall they had no chance to react to.
// But that gate can't stay open forever -- a player who never presses at all rides it as
// a straight, risk-free glide through the early corridor (which is wide and roughly
// centered at this difficulty) and, if the daily seed is forgiving, can drift to a
// surprisingly high score doing nothing at all. This caps the grace -- past it, gravity
// engages exactly as if the gate had never existed, so an unattended run still ends up
// falling like every other unheld ship.
const HOLD_GATE_MAX_SEC = 2.25;

// Shards banked per calendar day are capped so unlocks track *days played*, not just
// *coins collected* -- without this a single long grind session could bank enough shards
// to unlock everything at once, which defeats the point of the shard system (see
// lifecycle.js day-boundary reset + update.js die() banking). Total cost of all 7
// shard-priced tiers, SOLARIS included, is 240+880+2200+4800+12000+32000+50000 = 102120
// (if a tier is added or re-costed, update this sum).
//
// Raised from an original 350 after simulating real coin income against coinSpacing()
// at 3 skill tiers (~100/300/1000 score, ~65/75/85% coin-collection rate): at 350, a
// "good" run (~score 300, ~355 shards/day uncapped over 10 runs) and a "great" run
// (~score 1000, ~1760 shards/day uncapped) both just hit the cap and banked the
// *identical* 350/day -- skill above "decent" stopped affecting unlock speed at all.
//
// Every paid tier now ALSO carries a `stardustGate` (see below) on top of its shard
// cost -- both raised together on the explicit call that a hardcore player clearing
// nearly the whole roster in about a week (the old 13030-total/1800-cap math) was too
// fast, and undermined a later "buy all ships" IAP having any real value to sell. With
// both in place, a hardcore player (1800-1920 shards/day) blows through the shard side
// of every tier well inside a day each -- including SOLARIS's 50000, banked many times
// over by day 180 at this cap -- so `stardustGate` alone paces them: they land almost
// exactly on each tier's gate day (see that comment for the day numbers) all the way to
// SOLARIS at day 180. A "good" player (~355/day, not hitting this cap) stays shard-bound
// for the top two tiers instead: NOVA lands around day ~147 (vs. a hardcore player's
// gate-bound day 110), and SOLARIS's added 50000 shard cost pushes them to day ~288 even
// though their stardustGate (180) was already satisfied by then -- so skill differentiation
// now survives all the way to the last ship for non-hardcore players, not just the tiers
// below it. A "bad" run (~score 100, ~82 shards/day) never sniffs this cap and stays
// shard-bound throughout -- SOLARIS's 50000 alone pushes them past day 1200 on top of an
// already-slow ladder, effectively out of reach without real skill improvement, not just
// patience. See the per-tier cost comment on SKINS below if that slow end needs revisiting.
const DAILY_SHARD_CAP = 1800;

// ── Stardust (calendar-day gate, every paid tier) ────────────────────
// Every paid ship, SOLARIS included, requires a minimum `stardustGate` (SKINS[i]) on top
// of its shard cost. Unlike shards, stardust is NEVER spent -- it's a monotonically
// increasing lifetime "days played" counter, and a tier's gate is just a `>=` threshold
// check against it (update.js's unlock loop), not a purchase. That's deliberate: if
// gates were consumed like a currency, SOLARIS's 180 would sit on top of whatever the 6
// lower tiers already used, pushing the actual last-ship date well past a year for no
// reason -- a pure non-consumed gate keeps "reach SOLARIS at day 180" exactly true
// regardless of how the lower tiers' gates were spent.
//
// Any shard price alone can't hold this job: raise DAILY_SHARD_CAP and a
// skilled/persistent player buys through any price in days, lower the price and the
// same happens on the cheap -- there's no shard number that stays a genuine months-long
// chase for a great player *and* fair for everyone else (see the
// DAILY_SHARD_CAP-vs-SOLARIS-price dead end in git history). Stardust sidesteps it by
// being earned ONLY by opening the app on a new calendar day (lifecycle.js's existing
// day-boundary block, the same `_lastDay !== _todayInt` check that already drives the
// `streak` day-counter -- see state.js `streak`), completely decoupled from skill or how
// much is played *within* that day. A great player and a first-time player earn the
// identical STARDUST_PER_DAY on any given day -- the only lever that moves the needle is
// coming back tomorrow. That also makes a future "buy all ships" IAP an honest sale
// (skip N months of returning daily) instead of undercutting a grind that was buyable
// with enough skill.
//
// +1 base per day, +1 bonus on every 7-day unbroken streak milestone (day 7, 14, 21...,
// via the streak counter above) -- rewards genuinely consecutive return a little without
// being required for it, so a player who comes back most days but not every single one
// still reaches every tier, just a bit slower. A missed day never wipes banked stardust,
// only resets the streak's bonus cadence -- same "tax, never zero out" philosophy as
// poison's %-based loss (see POISON_LOSS_PCT above), avoiding the streak-anxiety
// backlash that hard-reset daily systems (Duolingo et al.) are known for.
//
// Gate schedule (SKINS below), chosen as a smooth day-1-to-day-180 curve rather than a
// cliff concentrated only at the end: AMBER 1, CRIMSON 5, ELECTRIC 15, TOXIC 35, VOID 65,
// NOVA 110, SOLARIS 180 (exactly half a year at the 1/day floor, somewhat faster with
// real weekly streaks). AMBER's gate of 1 is satisfied on a brand-new install's very
// first run (STARDUST_PER_DAY is granted before the first tier's shard cost is even
// checked, see lifecycle.js), so this doesn't cost a new player their fast first unlock.
// Day 180 is a floor, not a guarantee, for SOLARIS specifically -- it also carries a
// 50000 shard cost (DAILY_SHARD_CAP comment above), so only a hardcore player who's
// banking near the daily cap actually lands on day 180; anyone slower stays shard-bound
// past it, same as every other dual-gated tier.
const STARDUST_PER_DAY          = 1;
const STARDUST_STREAK_BONUS_DAY = 7; // every Nth unbroken streak day grants +1 extra

// ── Daily missions ────────────────────────────────────────────────────
// Three short daily challenges, picked deterministically from the calendar day (see
// pickDailyMissionIndices) so every player sees the same 3 on a given day. Progress is
// cumulative across all of today's runs (state.js `dailyMissionStats`, folded in by
// update.js die()), not a single-run target -- keeps them reachable across casual
// multi-session play, not just one long grind run. Completing one grants MISSION_REWARD
// shards immediately, exempt from DAILY_SHARD_CAP: a bounded, once-per-mission-per-day
// reward isn't the unlimited-grind problem that cap guards against.
const MISSION_REWARD = 40;
// `tier` (0 easy / 1 medium / 2 hard) is the pick stratifier: pickDailyMissionIndices
// draws exactly one mission from each tier, so every day is one gimme + one session-grind
// + one skill/deep-run chase -- and the flat MISSION_REWARD stays fair because the three
// slots are structurally different, not three random draws that might all be trivial or
// all be brutal. Targets are tuned so each tier is ~a few / ~5-10 / ~10-15 min of
// focused play for a mid-skill player; green/red were cut hard from an earlier pass where
// their coin-type spawn weight (3% / ~6%, see makeCoin in systems.js) plus their score
// gate made them near-impossible for the casual players who need the shards most.
const MISSION_DEFS = [
    { id: 'gold',     stat: 'gold',       target: 15,  tier: 0 },
    { id: 'blue',     stat: 'blue',       target: 8,   tier: 0 },
    { id: 'runs',     stat: 'runs',       target: 4,   tier: 0 },
    { id: 'orange',   stat: 'orange',     target: 5,   tier: 1 },
    { id: 'nearMiss', stat: 'nearMisses', target: 10,  tier: 1 },
    { id: 'combo',    stat: 'bestCombo',  target: 5,   tier: 1 },
    { id: 'dist',     stat: 'dist',       target: 800, tier: 1 },
    { id: 'red',      stat: 'red',        target: 4,   tier: 2 },
    { id: 'green',    stat: 'green',      target: 2,   tier: 2 },
    { id: 'score',    stat: 'bestScore',  target: 175, tier: 2 },
    { id: 'bomb',     stat: 'bomb',       target: 3,   tier: 2 },
];
function pickDailyMissionIndices(dayInt) {
    // Self-contained LCG, deliberately independent of the shared seedRng()/rng() used
    // for wave generation -- drawing from that shared stream here would shift its call
    // order and desync the tunnel shape from that same day's WORLD_NAME elsewhere.
    // Stratified: one mission per tier, in tier order (easy row first), so the returned
    // triple is both a fair spread of difficulty and a sensible top-to-bottom reading
    // order in the title-screen block.
    const byTier = [[], [], []];
    for (let i = 0; i < MISSION_DEFS.length; i++) byTier[MISSION_DEFS[i].tier].push(i);
    const picked = [];
    for (let t = 0; t < 3; t++) {
        // Independent murmur-style hash per (day, tier) rather than one chained LCG:
        // chaining made the buckets advance in lockstep, so "hard mission" cycled
        // red->green->score->bomb on consecutive days, which reads as a pattern.
        let h = Math.imul(((dayInt >>> 0) + 0x9e3779b9 * (t + 1)) | 0, 0x85ebca6b) >>> 0;
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
        h = (h ^ (h >>> 16)) >>> 0;
        const bucket = byTier[t];
        picked.push(bucket[h % bucket.length]);
    }
    return picked;
}

// Perk (buff) and drawback (nerf) descriptions live in i18n.js (LANGS[*].skinPerks /
// skinDrawbacks, same index order) so they stay live if the player switches language
// without reloading. Unlock needs `cost` shards (persistent currency banked from
// collected coins across all runs, see state.js `shards` + update.js die() banking) AND
// `stardustGate` days played (see the Stardust block above) -- every paid tier, SOLARIS
// included, carries both.
//
// Every non-PEARL ship pairs one buff with one nerf -- a build choice, not a strict
// upgrade ladder. All players were reset to PEARL-only when the shard system shipped
// (state.js), so this rebalance has no legacy-unlock compatibility to preserve:
//   AMBER    (systems.js coin pickup, update.js cPR)       +50% coin reach   / +10% hitbox
//   CRIMSON  (update.js cPR, systems.js shield pickup)      -18% hitbox      / shield cap -1
//   ELECTRIC (systems.js blue coin, systems.js combo timer) +50% slow time   / -25% combo window
//   TOXIC    (systems.js gold coin, update.js gap decay)    2x coin bonus    / +60% decay rate
//   VOID     (systems.js shield pickup, update.js near-miss) shield cap +1  / -25% near-miss window
//   NOVA     (systems.js green coin, systems.js ammo pickup) +60% magnet    / -40% ammo capacity
// PEARL stays the neutral baseline with no perk/drawback, just cosmetic FX. Values above
// are the level-0 (unmastered) numbers -- flying a ship grows its buff and heals its
// drawback further per masteryLerp() below, see that call site in each file for the
// level-3 endpoint of every stat.
//   SOLARIS  (update.js near-miss, update.js cPR)           +100% near-miss range / +20% hitbox
const SKINS = [
    { color: '#e8eeff', shadow: [210,220,255],  name: 'PEARL'                                                },
    { color: '#ffaa00', shadow: [255,155,0],    name: 'AMBER',   cost: 240,   stardustGate: 1                },
    { color: '#ff1a33', shadow: [255,30,55],    name: 'CRIMSON', cost: 880,   stardustGate: 5                },
    { color: '#00ccff', shadow: [0,190,255],    name: 'ELECTRIC',cost: 2200,  stardustGate: 15               },
    { color: '#99ff00', shadow: [140,255,0],    name: 'TOXIC',   cost: 4800,  stardustGate: 35               },
    { color: '#c080ff', shadow: [180,90,255],   name: 'VOID',    cost: 12000, stardustGate: 65               },
    { color: '#ffffff', shadow: [255,255,255],  name: 'NOVA',    cost: 32000, stardustGate: 110              },
    { color: '#ff6600', shadow: [255,100,0],    name: 'SOLARIS', cost: 50000, stardustGate: 180              },
];
