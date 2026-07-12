// ── Procedural tunnel ───────────────────────────────────────────────

let _prog, _prog2, _halfGap, _wA1, _wA2, _wF1, _wF2;

// Per-day phase offset for the two corridor waves, derived from the same UTC
// day-int used to seed the obstacle rng() (not the rng() stream itself, so it
// doesn't shift obstacle placement). Only the phase varies - amplitude and
// frequency stay exactly as tuned - so every day's corridor is a genuinely
// different shape without touching the hand-tuned difficulty feel.
let _wavePhase1 = 0, _wavePhase2 = 0;
function seedWavePhase(dayInt) {
    let h = Math.imul(dayInt ^ 0x9e3779b9, 0x45d9f3b) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    _wavePhase1 = (h % 6283) / 1000;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    _wavePhase2 = (h % 6283) / 1000;
}

function refreshWave() {
    _prog    = Math.min(Math.sqrt(scrollX / 14000), 1);
    _prog2   = Math.max(scrollX - 14000, 0) / 40000;          // no cap - escalates forever
    _halfGap = lerp(H * 0.34,  H * 0.163, _prog);
    // Wave amplitude/frequency keep growing with _prog2 (capped at 2x to stay navigable)
    const wMult  = 1 + 0.12 * Math.min(_prog2, 2);            // up to +24% amplitude
    const wFMult = 1 + 0.14 * Math.min(_prog2, 2);            // up to +28% frequency = tighter bends
    _wA1     = lerp(H * 0.07,  H * 0.12,  _prog) * wMult;
    _wA2     = lerp(H * 0.035, H * 0.055, _prog) * wMult;
    _wF1     = lerp(0.0025,    0.0048,    _prog) * wFMult;
    _wF2     = lerp(0.0060,    0.0115,    _prog) * wFMult;
}

function scrollSpd()   { return Math.min(lerp(lerp(230,  400, _prog), 560,  _prog2), 790) * W / 600; }
function stalSpacing() { return Math.max(lerp(lerp(260,  145, _prog),  70,  _prog2), 50); }
function stalLenFrac() { return Math.min(lerp(lerp(0.46, 0.64, _prog), 0.76, _prog2), 0.80); }
function coinSpacing() { return Math.max(lerp(lerp(600,  320, _prog), 230,  _prog2), 175); }
function mineSpacing() { return Math.max(lerp(lerp(900, 340, _prog), 200, _prog2), 200); }

// -- Daily world name -------------------------------------------------
const WORLD_ADJ  = ['Crimson','Frozen','Ancient','Dark','Burning','Hollow','Scarlet','Azure',
                    'Obsidian','Toxic','Golden','Crystal','Iron','Shadow','Violet','Ember',
                    'Storm','Silent','Blazing','Neon','Jade','Cobalt','Ash','Pale','Rusted',
                    'Glowing','Sunken','Broken','Eternal','Molten'];
const WORLD_NOUN = ['Abyss','Depths','Hollow','Cavern','Passage','Rift','Void','Chasm',
                    'Grotto','Descent','Labyrinth','Sanctum','Vault','Shaft','Tunnel',
                    'Canyon','Gorge','Sinkhole','Drift','Channel','Corridor','Vein','Pit',
                    'Basin','Keep','Ruin','Crypt','Forge','Crater','Nexus'];

// Shuffled lookup table built once with a fixed seed so every adj+noun pair
// appears exactly once per 900-day cycle in a non-sequential order.
const _worldTable = (() => {
    const n = WORLD_ADJ.length * WORLD_NOUN.length;
    const arr = Array.from({ length: n }, (_, i) => i);
    let s = 0x9e3779b9 >>> 0;
    const r = () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
})();

function dailyWorldName() {
    const now    = new Date();
    const epoch  = Date.UTC(2025, 0, 1);
    const dayIdx = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - epoch) / 86400000);
    const N    = _worldTable.length;
    const gen  = Math.floor(dayIdx / N) + 1;
    const slot = _worldTable[((dayIdx % N) + N) % N];
    const name = `${WORLD_ADJ[slot % WORLD_ADJ.length]} ${WORLD_NOUN[Math.floor(slot / WORLD_ADJ.length)]}`;
    return gen > 1 ? `${name} ${gen}` : name;
}

const WORLD_NAME = dailyWorldName();

function centerAt(wx) {
    const raw = H / 2
        + _wA1 * Math.sin(wx * _wF1 + _wavePhase1)
        + _wA2 * Math.sin(wx * _wF2 + 1.57 + _wavePhase2);
    return Math.max(_halfGap + 8, Math.min(H - _halfGap - 8, raw));
}

// halfGapAt predicts the corridor half-gap when the player reaches world x.
// Uses the same sqrt(wx/14000) progression as refreshWave so bounds are accurate
// for placement up to ~900px ahead.
function halfGapAt(wx) {
    return lerp(H * 0.34, H * 0.163, Math.min(Math.sqrt(wx / 14000), 1));
}

// boundsAt uses base _halfGap + current bonus so both rendering and
// collision benefit from collected coins.
function boundsAt(wx) {
    const cy = centerAt(wx);
    const hg = _halfGap + gapBonus;
    return { top: cy - hg, bot: cy + hg };
}

// boundsBase predicts placement bounds using the wave params and halfGap that
// will be in effect when the player reaches wx. Mirrors refreshWave's scaling
// (including the _prog2 wave amplitude/frequency boost) for accurate lookahead.
function boundsBase(wx) {
    const p      = Math.min(Math.sqrt(wx / 14000), 1);
    const p2     = Math.max(wx - 14000, 0) / 40000;
    const wMult  = 1 + 0.12 * Math.min(p2, 2);
    const wFMult = 1 + 0.14 * Math.min(p2, 2);
    const wA1 = lerp(H * 0.07,  H * 0.12,  p) * wMult;
    const wA2 = lerp(H * 0.035, H * 0.055, p) * wMult;
    const wF1 = lerp(0.0025,    0.0048,    p) * wFMult;
    const wF2 = lerp(0.0060,    0.0115,    p) * wFMult;
    const hg  = halfGapAt(wx);
    const raw = H / 2 + wA1 * Math.sin(wx * wF1 + _wavePhase1) + wA2 * Math.sin(wx * wF2 + 1.57 + _wavePhase2);
    const cy  = Math.max(hg + 8, Math.min(H - hg - 8, raw));
    return { top: cy - hg, bot: cy + hg };
}
