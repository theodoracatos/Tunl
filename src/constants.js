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

// Run-start "LEVEL n: Name" banner timing
const LEVEL_INTRO_DUR  = 1.6; // total seconds visible
const LEVEL_INTRO_FADE = 0.5; // seconds of that spent fading out at the end

// Shards banked per calendar day are capped so unlocks track *days played*, not just
// *coins collected* -- without this a single long grind session could bank enough shards
// to unlock everything at once, which defeats the point of the shard system (see
// lifecycle.js day-boundary reset + update.js die() banking). Total cost of every tier is
// 60+220+550+1200+3000+8000 = 13030, so at this cap a player who returns daily reaches
// NOVA in ~37 days -- a starting estimate like the tier costs themselves, tune after
// playtesting.
const DAILY_SHARD_CAP = 350;

// ── Daily missions ────────────────────────────────────────────────────
// Three short daily challenges, picked deterministically from the calendar day (see
// pickDailyMissionIndices) so every player sees the same 3 on a given day. Progress is
// cumulative across all of today's runs (state.js `dailyMissionStats`, folded in by
// update.js die()), not a single-run target -- keeps them reachable across casual
// multi-session play, not just one long grind run. Completing one grants MISSION_REWARD
// shards immediately, exempt from DAILY_SHARD_CAP: a bounded, once-per-mission-per-day
// reward isn't the unlimited-grind problem that cap guards against.
const MISSION_REWARD = 40;
const MISSION_DEFS = [
    { id: 'gold',     stat: 'gold',       target: 15  },
    { id: 'blue',     stat: 'blue',       target: 8   },
    { id: 'red',      stat: 'red',        target: 6   },
    { id: 'green',    stat: 'green',      target: 5   },
    { id: 'orange',   stat: 'orange',     target: 6   },
    { id: 'nearMiss', stat: 'nearMisses', target: 10  },
    { id: 'combo',    stat: 'bestCombo',  target: 5   },
    { id: 'score',    stat: 'bestScore',  target: 150 },
    { id: 'runs',     stat: 'runs',       target: 3   },
];
function pickDailyMissionIndices(dayInt) {
    // Self-contained LCG, deliberately independent of the shared seedRng()/rng() used
    // for wave generation -- drawing from that shared stream here would shift its call
    // order and desync the tunnel shape from that same day's WORLD_NAME elsewhere.
    const n = MISSION_DEFS.length;
    const picked = [];
    let seed = dayInt >>> 0;
    while (picked.length < 3) {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        const idx = seed % n;
        if (!picked.includes(idx)) picked.push(idx);
    }
    return picked;
}

// Perk (buff) and drawback (nerf) descriptions live in i18n.js (LANGS[*].skinPerks /
// skinDrawbacks, same index order) so they stay live if the player switches language
// without reloading. Unlock cost is in shards (persistent currency banked from collected
// coins across all runs, see state.js `shards` + update.js die() banking).
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
const SKINS = [
    { color: '#e8eeff', shadow: [210,220,255],  name: 'PEARL'                       },
    { color: '#ffaa00', shadow: [255,155,0],    name: 'AMBER',   cost: 60           },
    { color: '#ff1a33', shadow: [255,30,55],    name: 'CRIMSON', cost: 220          },
    { color: '#00ccff', shadow: [0,190,255],    name: 'ELECTRIC',cost: 550          },
    { color: '#99ff00', shadow: [140,255,0],    name: 'TOXIC',   cost: 1200         },
    { color: '#c080ff', shadow: [180,90,255],   name: 'VOID',    cost: 3000         },
    { color: '#ffffff', shadow: [255,255,255],  name: 'NOVA',    cost: 8000         },
];
