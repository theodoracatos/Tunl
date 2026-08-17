const cv  = document.getElementById('c');
const ctx = cv.getContext('2d');

const W  = window.innerWidth;
const H  = Math.min(window.innerHeight, 600);
const FS = Math.sqrt(W * H);   // font scale: ~603 in landscape, matches old 600x600 sizes
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

// Perk descriptions live in i18n.js (LANGS[*].skinPerks, same index order) so
// they stay live if the player switches language without reloading.
// Unlock cost is in shards (persistent currency banked from collected coins across all
// runs, see state.js `shards` + update.js die() banking), not single-run score anymore.
// VOID/NOVA are new prestige tiers for players who used to max out the old score-gated
// list in one good run: VOID raises max shield stacks 3->4 (systems.js red-coin pickup),
// NOVA raises the magnet duration cap 5s->8s (systems.js green-coin pickup).
const SKINS = [
    { color: '#e8eeff', shadow: [210,220,255],  name: 'PEARL'                       },
    { color: '#ffaa00', shadow: [255,155,0],    name: 'AMBER',   cost: 60           },
    { color: '#ff1a33', shadow: [255,30,55],    name: 'CRIMSON', cost: 220          },
    { color: '#00ccff', shadow: [0,190,255],    name: 'ELECTRIC',cost: 550          },
    { color: '#99ff00', shadow: [140,255,0],    name: 'TOXIC',   cost: 1200         },
    { color: '#c080ff', shadow: [180,90,255],   name: 'VOID',    cost: 3000         },
    { color: '#ffffff', shadow: [255,255,255],  name: 'NOVA',    cost: 8000         },
];
