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

const RESET_HOLD_TIME = 1.1; // seconds to hold the reset-progress button to confirm

const SKINS = [
    { color: '#e8eeff', shadow: [210,220,255],  name: 'PEARL'                                      },
    { color: '#ffaa00', shadow: [255,155,0],    name: 'AMBER',   req: 100,  perk: 'COIN REACH +50%' },
    { color: '#ff1a33', shadow: [255,30,55],    name: 'CRIMSON', req: 300, perk: 'SLIM HITBOX -18%'  },
    { color: '#00ccff', shadow: [0,190,255],    name: 'ELECTRIC',req: 500, perk: 'SLOW TIME +50%'   },
    { color: '#99ff00', shadow: [140,255,0],    name: 'TOXIC',   req: 1000, perk: '2x COIN BONUS'    },
];
