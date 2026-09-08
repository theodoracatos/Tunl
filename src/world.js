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
// UTC day-int of the cave being flown, captured in seedDailyVariety. Seeds the
// deep-run shape/pace variety (deepMorphAt / the scrollSpd pulse) independently
// of the rng() obstacle stream. 0 until seedDailyVariety runs (and in the
// test-math sandbox, which just exercises "day 0" deterministically).
let _deepDay = 0;
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
    _deepDay = dayInt;
}

// ── Deep-run variety (score ~900+) ───────────────────────────────────
// Past the _prog2 plateau every corridor geometry knob is capped (CLAUDE.md:
// pushing them further makes the tunnel unnavigable) and only scrollSpd() still
// climbs - so the deep game was one variable, speed, getting slowly twitchier
// against a frozen corridor. These two additions give the deep run a changing
// SHAPE and PACE without breaching that navigability wall:
//
//  - deepMorphAt() redistributes the two corridor waves' AMPLITUDES per a
//    seeded per-day character sequence, so a deep stretch reads as big clean
//    sweeps, or beating chop, or near-straight. The a1/a2 splits are chosen so
//    wA1*wF1 + wA2*wF2 (peak corridor velocity) never exceeds ~1.03x the frozen
//    plateau - the corridor is a different shape, never more wiggle-energy than
//    today. Only amplitudes move; frequencies are left alone, because changing
//    the frequency of sin(wx*f) at large wx scrambles accumulated phase and
//    would need a phase-integral rework (a later phase, if wanted).
//  - the pulse in scrollSpd(): a slow seeded swell of +/-DEEP_PULSE_AMP around
//    the ever-rising trend, so the deep game breathes instead of being one
//    monotone acceleration. The trend itself is untouched (the "never plateau"
//    rule holds); the pulse only textures it.
//
// Both are pure functions of scrollX + _deepDay, so every player flies the
// identical sequence and the scrollX-indexed ghost stays locked to it, and both
// are inert below DEEP_VARIETY_WX so the hand-tuned mid-game is byte-identical.
// Master kill-switch for both deep-run additions - always true in the shipping
// game; a one-line revert path if a deep playtest ever wants them off without a
// code rollback, and the seam test-math.js uses to isolate the morph's effect
// from the pre-existing _prog2 wave boost.
let _deepVarietyOn = true;
const DEEP_VARIETY_WX    = 54000;   // _prog2 == 1, score ~900
const DEEP_CHAR_WAVELEN  = 4200;    // world-px each shape character holds
const DEEP_PULSE_AMP     = 0.12;    // speed pulse: surge of up to +this fraction ABOVE the trend (never below)
const DEEP_PULSE_WAVELEN = 2600;    // world-px per speed-pulse cycle
// Amplitude multipliers on (wave 1, wave 2). Wave 1 is the slow wide arc, wave 2
// the faster shallow ripple: lifting wave 2 toward wave 1 makes the ride bumpy,
// dropping it leaves long clean sweeps. Every row keeps a1*W1v + a2*W2v within
// ~3% of the (1,1) plateau - see the test-math guard.
const DEEP_CHARS = [
    { a1: 1.00, a2: 1.00 },   // even     - the current frozen plateau shape
    { a1: 1.45, a2: 0.32 },   // sweeps   - big clean arcs, ripple flattened out
    { a1: 0.32, a2: 1.60 },   // chop     - fast wave dominates, bumpy ride
    { a1: 0.24, a2: 0.34 },   // straight - shallow, hold steady at speed
];

// Deterministic per-day pick for band index n. Independent of the rng() obstacle
// stream AND of seedDailyVariety's h-chain, so it shifts neither placement nor
// _dayArchetype. Same imul mix as _worldTable's shuffle rng.
function _deepHash(n) {
    let s = Math.imul((_deepDay ^ 0x9e3779b9) + Math.imul(n + 1, 0x6d2b79f5), 0x45d9f3b) >>> 0;
    s = Math.imul(s ^ (s >>> 15), 1 | s);
    s = (s + Math.imul(s ^ (s >>> 7), 61 | s)) ^ s;
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
}

// Wave-amplitude split (a1, a2 multipliers) active at world-x wx, smoothstepped
// across the last 30% of each band so the wall never kinks at a boundary.
function deepMorphAt(wx) {
    if (!_deepVarietyOn || wx <= DEEP_VARIETY_WX) return { a1: 1, a2: 1 };
    const u    = (wx - DEEP_VARIETY_WX) / DEEP_CHAR_WAVELEN;
    const seg  = Math.floor(u);
    const frac = u - seg;
    const c0 = DEEP_CHARS[Math.floor(_deepHash(seg)     * DEEP_CHARS.length)];
    const c1 = DEEP_CHARS[Math.floor(_deepHash(seg + 1) * DEEP_CHARS.length)];
    const t  = frac < 0.7 ? 0 : (frac - 0.7) / 0.3;
    const bl = t * t * (3 - 2 * t);
    return { a1: c0.a1 + (c1.a1 - c0.a1) * bl, a2: c0.a2 + (c1.a2 - c0.a2) * bl };
}

// Deep-run chambers (score ~900+): a rare seeded world-x window where the
// corridor half-gap balloons to DEEP_CHAMBER_PEAK and settles back on a sine
// bump - a breather and a visual change, never a hazard (wider is always
// navigable). Applied to _halfGap (refreshWave) AND halfGapAt() so boundsBase /
// coin+mine placement follow the room. At most one per DEEP_CHAMBER_PERIOD
// world-px, ~55% of periods carrying one in a seeded sub-window that never
// touches a period boundary (so the factor is always 1, i.e. continuous, at the
// seams). Same _deepHash / _deepVarietyOn plumbing as the shape morph.
const DEEP_CHAMBER_PERIOD = 15000;
const DEEP_CHAMBER_PEAK   = 2.1;
function deepChamberAt(wx) {
    if (!_deepVarietyOn || wx <= DEEP_VARIETY_WX) return 1;
    const u   = (wx - DEEP_VARIETY_WX) / DEEP_CHAMBER_PERIOD;
    const seg = Math.floor(u);
    if (_deepHash(seg + 4096) > 0.55) return 1;           // ~45% of periods: no chamber
    const start = 0.12 + _deepHash(seg + 4097) * 0.45;    // position within the period
    const width = 0.16 + _deepHash(seg + 4098) * 0.12;    // fraction of the period spanned
    const frac  = u - seg;
    if (frac <= start || frac >= start + width) return 1;
    const local = (frac - start) / width;                 // 0..1 across the chamber
    return 1 + Math.sin(local * Math.PI) * (DEEP_CHAMBER_PEAK - 1);
}

// Falling stalactites (constants.js FALL_LEAD / FALL_SPAN): cadence only - which
// stalactites get flagged is maintainStalactites(), the drop is updateFallingStals().
// Absent before ~score 200 (nextFallWx starts at world-x 12000 in startPlay); then
// from a rare set-piece (~one per 3400px) toward steady deep pressure, floored so
// they never pile onto everything else once scrollSpd is uncapped.
function fallSpacing() {
    return Math.max(lerp(3400, 2000, Math.min(_prog2, 1)) - 350 * Math.max(_prog2 - 1, 0), 1800);
}

// Boulders (systems.js makeBoulder/maintainBoulders): a deep-only routing
// obstacle from world-x 84000 (~score 1400). Rare - closer to a cannon's cadence
// than a mine's - so it reads as "commit up or down now", not a dodge-fest.
function boulderSpacing() {
    return Math.max(3400 - 250 * Math.max(_prog2 - 1.75, 0), 2400);
}

function refreshWave() {
    _prog    = Math.min(Math.sqrt(scrollX / 14000), 1);
    _prog2   = Math.max(scrollX - 14000, 0) / 40000;          // no cap - escalates forever
    _halfGap = lerp(H * 0.34,  H * 0.163, _prog) * deepChamberAt(scrollX);
    // Wave amplitude/frequency keep growing with _prog2 (capped at 2x to stay navigable)
    const wMult  = 1 + 0.12 * Math.min(_prog2, 2);            // up to +24% amplitude
    const wFMult = 1 + 0.14 * Math.min(_prog2, 2);            // up to +28% frequency = tighter bends
    // Deep-run shape morph (score ~900+, see deepMorphAt): sampled at the player's
    // own scrollX and then held across the whole visible span - the same lookahead
    // approximation the _prog2 boost already relies on. boundsBase() samples per-wx
    // for placement accuracy.
    const dm = deepMorphAt(scrollX);
    _wA1     = lerp(H * 0.07,  H * 0.12,  _prog) * wMult * _waveJitterA * dm.a1;
    _wA2     = lerp(H * 0.035, H * 0.055, _prog) * wMult * _waveJitterA * dm.a2;
    _wF1     = lerp(0.0025,    0.0048,    _prog) * wFMult * _waveJitterF;
    _wF2     = lerp(0.0060,    0.0115,    _prog) * wFMult * _waveJitterF;
}

function scrollSpd() {
    const base = lerp(lerp(230, 400, _prog), 560, Math.min(_prog2, 1));
    // Past the _prog2 ramp (score ~900), speed never plateaus - it keeps
    // creeping up forever (sqrt eased, like _prog's ramp) instead of the other
    // difficulty knobs, which stay capped so the corridor stays navigable.
    const beyond = Math.max(_prog2 - 1, 0);
    let spd = base + Math.sqrt(beyond) * 90;
    // Deep-run speed pulse (score ~900+): a slow seeded swell of up to +DEEP_PULSE_AMP
    // ABOVE the trend, so the deep game surges and eases back instead of being one
    // flat acceleration - but it never dips *below* the trend, so the deep run can
    // never actually get slower (it used to be +/-AMP around the trend, i.e. ~half of
    // every cycle the deep game decelerated, which reads as "getting easier"). The
    // trend is untouched and still climbs forever (the "scrollSpd never plateaus"
    // rule). Pure function of scrollX, so it's deterministic and the scrollX-indexed
    // ghost stays locked.
    if (_prog2 > 1 && _deepVarietyOn) {
        const ph = _deepHash(0x7ff) * Math.PI * 2;   // fixed per-day phase, distinct index
        const swell = 0.5 - 0.5 * Math.cos((scrollX - DEEP_VARIETY_WX) / DEEP_PULSE_WAVELEN * Math.PI * 2 + ph);
        spd *= 1 + DEEP_PULSE_AMP * swell;   // swell in [0,1] -> spd in [trend, trend*(1+AMP)]
    }
    // * W/600 keeps the on-screen pixel speed consistent across widths. W is capped at
    // 956 (constants.js) so this can't hand a wide-screen player a faster/harder cave
    // than a phone at the same score - see the fairness audit note in CLAUDE.md.
    return spd * W / 600;
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

// Whole UTC days since 2025-01-01 for the day we're rendering. Both the world
// name and the world number key off this one monotonic index so they stay
// locked 1:1: WORLD n uses name-table slot n, and gen === ceil(n / 900), i.e.
// "WORLD 900" is visibly the last before the "<name> 2" generation begins.
// The epoch is arbitrary (a round anchor comfortably before the first daily
// seed on 2026-07-06) and invisible to players - it only has to stay fixed
// forever and keep dayIdx positive, including for past-day ?d= deep links.
function _worldDayIdx() {
    const now   = _tunlActiveDate();
    const epoch = Date.UTC(2025, 0, 1);
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.floor((today - epoch) / 86400000);
}

function dailyWorldName() {
    const dayIdx = _worldDayIdx();
    const N    = _worldTable.length;
    const gen  = Math.floor(dayIdx / N) + 1;
    const slot = _worldTable[((dayIdx % N) + N) % N];
    const name = `${WORLD_ADJ[slot % WORLD_ADJ.length]} ${WORLD_NOUN[Math.floor(slot / WORLD_ADJ.length)]}`;
    return gen > 1 ? `${name} ${gen}` : name;
}

const WORLD_NAME = dailyWorldName();

// World number shown in the run-start banner: a monotonic count of days since
// the 2025-01-01 epoch (WORLD 1 = 2025-01-01), never resets, never repeats.
// Was day-of-year (1-366) until 2026-09-07, which reset every Jan 1 - so
// "WORLD 5" came round every year, it had a leap-year wart at 366, and it was
// decoupled from the name's 900-day cycle. Sharing _worldDayIdx() with the
// name fixes all three. clamped to >= 1 so a pre-epoch ?d= deep link can't
// show WORLD 0 or negative.
function dailyLevelNum() {
    return Math.max(1, _worldDayIdx() + 1);
}
const LEVEL_NUM = dailyLevelNum();

function centerAt(wx) {
    const raw = H / 2
        + _wA1 * Math.sin(wx * _wF1 + _wavePhase1)
        + _wA2 * Math.sin(wx * _wF2 + 1.57 + _wavePhase2);
    return Math.max(_halfGap + 8, Math.min(H - _halfGap - 8, raw));
}

// halfGapAt predicts the corridor half-gap when the player reaches world x.
// Uses the same sqrt(wx/14000) progression as refreshWave (and the same deep-run
// chamber factor) so bounds are accurate for placement up to ~900px ahead.
function halfGapAt(wx) {
    return lerp(H * 0.34, H * 0.163, Math.min(Math.sqrt(wx / 14000), 1)) * deepChamberAt(wx);
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
// (the _prog2 wave amplitude/frequency boost AND the deep-run shape morph) for
// accurate lookahead - sampled per-wx here rather than frozen at the player's x.
function boundsBase(wx) {
    const p      = Math.min(Math.sqrt(wx / 14000), 1);
    const p2     = Math.max(wx - 14000, 0) / 40000;
    const wMult  = 1 + 0.12 * Math.min(p2, 2);
    const wFMult = 1 + 0.14 * Math.min(p2, 2);
    const dm  = deepMorphAt(wx);   // deep-run shape morph, per-wx for placement accuracy
    const wA1 = lerp(H * 0.07,  H * 0.12,  p) * wMult * _waveJitterA * dm.a1;
    const wA2 = lerp(H * 0.035, H * 0.055, p) * wMult * _waveJitterA * dm.a2;
    const wF1 = lerp(0.0025,    0.0048,    p) * wFMult * _waveJitterF;
    const wF2 = lerp(0.0060,    0.0115,    p) * wFMult * _waveJitterF;
    const hg  = halfGapAt(wx);
    const raw = H / 2 + wA1 * Math.sin(wx * wF1 + _wavePhase1) + wA2 * Math.sin(wx * wF2 + 1.57 + _wavePhase2);
    const cy  = Math.max(hg + 8, Math.min(H - hg - 8, raw));
    return { top: cy - hg, bot: cy + hg };
}
