// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── Procedural tunnel ───────────────────────────────────────────────
// The day whose cave/name/palette we render comes from _tunlActiveDate()
// (src/web.js) - normally today, but the web ?d= deep link can point it at a
// past day. Real-day logic (streak/stardust/daily reset in lifecycle.js) stays
// on the actual date played.

let _prog, _prog2, _halfGap, _wA1, _wA2, _wF1, _wF2;

// Per-day phase offset for the two corridor waves, derived from the same UTC
// day-int used to seed the obstacle rng() (not the rng() stream itself, so it
// doesn't shift obstacle placement). Only the phase varies - amplitude and
// frequency stay exactly as tuned - so every day's corridor is a genuinely
// different shape without touching the hand-tuned difficulty feel.
let _wavePhase1 = 0, _wavePhase2 = 0;
// Small per-day multipliers on top of that same phase: +/-8% on wave amplitude
// and (independently) +/-8% on frequency, so a day's corridor isn't just the
// same curve shifted in time - it can be a bit wider/lazier or tighter/wigglier
// too. Kept tight on purpose: centerAt() already clamps the wave to stay inside
// _halfGap regardless of amplitude, but a big swing would still make the *feel*
// of a day wildly inconsistent with the hand-tuned baseline, which is the thing
// CLAUDE.md says not to touch.
let _waveJitterA = 1, _waveJitterF = 1;
// Which of DAY_ARCHETYPES (below) applies today - nudges obstacle/coin
// spacing and chicane odds, all within their existing tuned ranges (see
// stalSpacing/coinSpacing/mineSpacing below and maintainStalactites in
// systems.js).
let _dayArchetype = 0;
function seedDailyVariety(dayInt) {
    // Same hash chain as before (phase1/phase2), just kept going for the extra
    // draws below - still fully independent of the rng() stream used for
    // obstacle placement, so none of this shifts stalactite/coin/mine layout.
    let h = Math.imul(dayInt ^ 0x9e3779b9, 0x45d9f3b) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    _wavePhase1 = (h % 6283) / 1000;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    _wavePhase2 = (h % 6283) / 1000;
    const draw = () => {
        h = Math.imul(h ^ (h >>> 15), 1 | h);
        h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h;
        h = (h ^ (h >>> 14)) >>> 0;
        return h / 4294967296;
    };
    _waveJitterA = 1 + (draw() * 2 - 1) * 0.08;
    _waveJitterF = 1 + (draw() * 2 - 1) * 0.08;
    _dayArchetype = Math.floor(draw() * DAY_ARCHETYPES.length);
}

function refreshWave() {
    _prog    = Math.min(Math.sqrt(scrollX / 14000), 1);
    _prog2   = Math.max(scrollX - 14000, 0) / 40000;          // no cap - escalates forever
    _halfGap = lerp(H * 0.34,  H * 0.163, _prog);
    // Wave amplitude/frequency keep growing with _prog2 (capped at 2x to stay navigable)
    const wMult  = 1 + 0.12 * Math.min(_prog2, 2);            // up to +24% amplitude
    const wFMult = 1 + 0.14 * Math.min(_prog2, 2);            // up to +28% frequency = tighter bends
    _wA1     = lerp(H * 0.07,  H * 0.12,  _prog) * wMult * _waveJitterA;
    _wA2     = lerp(H * 0.035, H * 0.055, _prog) * wMult * _waveJitterA;
    _wF1     = lerp(0.0025,    0.0048,    _prog) * wFMult * _waveJitterF;
    _wF2     = lerp(0.0060,    0.0115,    _prog) * wFMult * _waveJitterF;
}

function scrollSpd() {
    const base = lerp(lerp(230, 400, _prog), 560, Math.min(_prog2, 1));
    // Past the _prog2 ramp (score ~900), speed never plateaus - it keeps
    // creeping up forever (sqrt eased, like _prog's ramp) instead of the other
    // difficulty knobs, which stay capped so the corridor stays navigable.
    const beyond = Math.max(_prog2 - 1, 0);
    // * W/600 keeps the on-screen pixel speed consistent across widths. W is capped at
    // 956 (constants.js) so this can't hand a wide-screen player a faster/harder cave
    // than a phone at the same score - see the fairness audit note in CLAUDE.md.
    return (base + Math.sqrt(beyond) * 90) * W / 600;
}

// Blue coin: multiplied into the scroll speed (update.js) and the speed-line
// intensity (draw.js). It is NOT a flat 0.6x-while-active plateau - the coin sags
// the scroll to 0.6x on pickup, then this factor ramps linearly back to full over
// the slow-time window, so the effect is a decelerate-then-recover swoop that ends
// exactly as slowTime runs out. The background music glides on the identical curve
// (audio.js bgmSetSlow), so tunnel and soundtrack speed up together. slowTimeMax is
// the duration captured at the last pickup (systems.js); a mid-effect second blue
// coin recaptures it so the ramp restarts from the new, longer window.
function slowScrollFactor() {
    if (!(slowTime > 0) || !(slowTimeMax > 0)) return 1.0;
    return lerp(0.60, 1.0, 1 - slowTime / slowTimeMax);
}
// Nudges stal/coin/mine density and chicane odds per day, on top of the
// existing _prog/_prog2 curves - see seedDailyVariety. Classic is the
// no-op baseline; the other three each push one knob further and pull
// another back so a day reads as a distinct "flavor", not just harder
// or easier across the board.
const DAY_ARCHETYPES = [
    { stal: 1,    coin: 1,    mine: 1,    chic: 1    }, // Classic
    { stal: 0.85, coin: 1,    mine: 1,    chic: 1.35 }, // Chicane Day
    { stal: 1,    coin: 1,    mine: 0.75, chic: 1    }, // Mine Gauntlet
    { stal: 1.15, coin: 0.72, mine: 1.15, chic: 0.8  }, // Coin Rush
];
function stalSpacing() { return Math.max(lerp(lerp(260,  145, _prog),  70,  _prog2) * DAY_ARCHETYPES[_dayArchetype].stal, 50); }
function stalLenFrac() { return Math.min(lerp(lerp(0.46, 0.64, _prog), 0.76, _prog2), 0.80); }
function coinSpacing() { return Math.max(lerp(lerp(600,  320, _prog), 230,  _prog2) * DAY_ARCHETYPES[_dayArchetype].coin, 175); }
function mineSpacing() { return Math.max(lerp(lerp(900, 340, _prog), 200, _prog2) * DAY_ARCHETYPES[_dayArchetype].mine, 200); }
// Cannons: rare on purpose, so the spacing floor stays far above every other
// obstacle's (stalSpacing/coinSpacing/mineSpacing all bottom out well under
// 1000) even at max difficulty -- this should read as an occasional set-piece
// ambush, not a recurring hazard type.
function cannonSpacing() { return Math.max(lerp(lerp(4200, 2400, _prog), 1500, _prog2), 1200); }

// Milestone spacing (50/100/etc. step added to milestoneNext each time one fires --
// see update.js). Widens in stages so milestones stay a frequent early-game reward but
// thin out for strong players who blow past 200-1000 in well under a minute: at the old
// flat +50 step, a great run hit a milestone every ~50 points all the way up, and every
// one from 200 on showed the same maxed-out "!!!" (triggerMilestone, input.js) -- same
// popup, over and over, reading as noise rather than a reward. Also uncapped past the
// last band (keeps growing by the same +1000 forever) rather than settling into a fixed
// step, matching this file's existing philosophy that nothing here should feel like
// flat-pace endurance once a run goes long (see CLAUDE.md's scrollSpd() doc).
// Used to have a 25-point band below score 100 (25/50/75) but that fired 3 milestones
// before a weak run even reaches 100 -- dropped in favor of one flat 50-point band from
// the start; still fast enough to reward a rough first run without the extra popups.
function milestoneStep(n) {
    if (n < 300)   return 50;
    if (n < 1000)  return 100;
    if (n < 3000)  return 250;
    if (n < 10000) return 500;
    return 1000;
}

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
    const now    = _tunlActiveDate();
    const epoch  = Date.UTC(2025, 0, 1);
    const dayIdx = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - epoch) / 86400000);
    const N    = _worldTable.length;
    const gen  = Math.floor(dayIdx / N) + 1;
    const slot = _worldTable[((dayIdx % N) + N) % N];
    const name = `${WORLD_ADJ[slot % WORLD_ADJ.length]} ${WORLD_NOUN[Math.floor(slot / WORLD_ADJ.length)]}`;
    return gen > 1 ? `${name} ${gen}` : name;
}

const WORLD_NAME = dailyWorldName();

// World number shown in the run-start banner: day-of-year (1-366, UTC, resets
// each Jan 1) so it reads like a world index without needing separate storage.
function dailyLevelNum() {
    const now   = _tunlActiveDate();
    const start = Date.UTC(now.getUTCFullYear(), 0, 1);
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.floor((today - start) / 86400000) + 1;
}
const LEVEL_NUM = dailyLevelNum();

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
    const hg = _halfGap + gapBonusVisual;
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
    const wA1 = lerp(H * 0.07,  H * 0.12,  p) * wMult * _waveJitterA;
    const wA2 = lerp(H * 0.035, H * 0.055, p) * wMult * _waveJitterA;
    const wF1 = lerp(0.0025,    0.0048,    p) * wFMult * _waveJitterF;
    const wF2 = lerp(0.0060,    0.0115,    p) * wFMult * _waveJitterF;
    const hg  = halfGapAt(wx);
    const raw = H / 2 + wA1 * Math.sin(wx * wF1 + _wavePhase1) + wA2 * Math.sin(wx * wF2 + 1.57 + _wavePhase2);
    const cy  = Math.max(hg + 8, Math.min(H - hg - 8, raw));
    return { top: cy - hg, bot: cy + hg };
}
