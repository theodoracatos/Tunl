// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch

// Single source of truth for the marketing version, shared by all three targets
// (iOS/Android read their own native MARKETING_VERSION / versionName - keep this in
// sync via /release step 1). Not rendered in any UI (would be a gated web/app change);
// it exists so a build can identify itself: window.TUNL_VERSION for a DevTools check,
// and build-play.mjs stamps it into /play as <meta name="tunl:version"> so the live
// web build's version is greppable without diffing the bundle.
const TUNL_VERSION = '10.4';
if (typeof window !== 'undefined') window.TUNL_VERSION = TUNL_VERSION;

const cv  = document.getElementById('c');
const ctx = cv.getContext('2d');

// Every feel constant is tuned against a phone in landscape (~956x440pt on an
// iPhone 17 Pro Max). GRAVITY/THRUST/MAX_VY are px/s and px/s^2 at that reference
// height and then scaled by H/_H_REF on every device (see the "screen-independent
// feel" rule in CLAUDE.md and the _FEEL_SCALE block below), so a shorter or taller
// screen gets proportionally gentler or steeper px/s^2 and the ship crosses the same
// fraction of the corridor per second everywhere - the felt snappiness is identical
// on an iPhone 12 mini, an iPhone 17 Pro Max and an Android tablet. The web build
// clamps W and H to the iPhone 17 Pro Max's own landscape footprint (956x440) so it
// plays as a pixel-for-pixel copy of that device; the apps keep their raw height (with
// caps below) but share the 956 width cap. isWeb() is false in both apps (bridge bound
// before the first script).
const _WEB = (typeof isWeb === 'function' && isWeb());
// W is capped at 956 (iPhone 17 Pro Max landscape width) on EVERY platform, for
// leaderboard fairness. scrollSpd() scales by W/600, and obstacle spacing is fixed in
// world-x, so on an uncapped wide screen (Android tablet, oversized phone) the shared
// daily cave scrolls past faster and every obstacle's reaction window at a given score
// shrinks by ~W/956 - a real, skill-independent handicap on a global leaderboard. No
// current iPhone exceeds ~956 so this is a no-op on iOS today; it clamps large Android
// devices to the 17-Pro-Max profile. A screen wider than 956 letterboxes left/right
// (body flex-centres the canvas over #04040a; input.js already maps through the
// getBoundingClientRect offset). See the fairness audit note in CLAUDE.md.
//
// H: Android's Play Store allows tablets (no TARGETED_DEVICE_FAMILY=1 phone lock, see
// Info.plist / pbxproj) so its innerHeight can run well past a phone's; the 520 cap
// keeps a tablet's corridor from being a physically much wider (easier) tunnel than the
// phone it was balanced against. The _FEEL_SCALE block already normalizes the *feel*
// across heights - this cap is about corridor size / difficulty, not feel.
const _ANDROID_APP = (typeof isAndroidApp === 'function' && isAndroidApp());
const W  = Math.min(window.innerWidth, 956);
const H  = _WEB ? Math.min(window.innerHeight, 440)
         : _ANDROID_APP ? Math.min(window.innerHeight, 520)
         : Math.min(window.innerHeight, 600);
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

// Web-only, display size only - never touches W/H (the logical/physics coordinate
// space every gameplay constant above is quoted in). On a desktop wider than the
// 956x440 native footprint the canvas would otherwise sit small in a sea of empty
// letterbox space; _DISPLAY_SCALE stretches how big it draws on the page, exactly
// like zooming a photo, while every draw call still runs in the same W/H units it
// always has (verified only constants.js itself touches cv.width/height - see the
// CLAUDE.md canvas-size-vs-internal-resolution note). Capped at 1.4x so a big
// monitor doesn't get a visibly larger, easier-to-read obstacle telegraph than a
// phone gets on the same shared daily leaderboard - this is a page-layout fix, not
// a difficulty knob. Backed by devicePixelRatio so the larger box still renders
// crisp instead of a blurry upscale of the 956x440 raster. Mobile web and both
// native apps are unaffected (scale locks to 1).
const _DPR = window.devicePixelRatio || 1;
const _DISPLAY_SCALE = _WEB
    ? Math.min(1.4, Math.max(1, Math.min(window.innerWidth / W, window.innerHeight / H)))
    : 1;
const _RASTER_SCALE = _DISPLAY_SCALE * _DPR;
cv.width = W * _RASTER_SCALE;
cv.height = H * _RASTER_SCALE;
if (_RASTER_SCALE !== 1) {
    cv.style.width = (W * _DISPLAY_SCALE) + 'px';
    cv.style.height = (H * _DISPLAY_SCALE) + 'px';
    ctx.scale(_RASTER_SCALE, _RASTER_SCALE);
}

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
// SCREEN-INDEPENDENT FEEL (CLAUDE.md rule). GRAVITY/THRUST/MAX_VY are quoted at
// _H_REF - the landscape height the feel was tuned and player-tested at, an iPhone 17
// Pro Max (~956x440pt) - and EVERY device (apps and web alike) scales them by
// H/_H_REF. Because the corridor half-gap also scales with H, this keeps every
// trajectory geometrically similar to the reference: same fraction of the corridor
// covered per second, same time-to-cross, identical felt snappiness on a 375pt iPhone
// 12 mini, a 440pt 17 Pro Max, a 520pt Android tablet, and the web build (which clamps
// H to 440, so _FEEL_SCALE lands at ~1.0 and web == the 17 Pro Max exactly). A bigger
// screen literally gets steeper px/s^2 and a smaller one gentler, by construction.
// There is no separate web feel multiplier any more - the old _WEB_FEEL 1.3 boost
// existed only to fight the floatiness of web's old taller-than-a-phone 520 clamp, and
// dropping that clamp to 440 removes the reason for it. Anything that reasons about
// absolute px/s^2 (draw.js speed-lines already divide by MAX_VY, so it's fine) must
// stay ratio-based, not compare against a hardcoded velocity.
const _H_REF      = 440;
const _FEEL_SCALE = H / _H_REF;
// Vertical dynamics were pushed hard on request across several passes (all values below
// are at _H_REF): GRAVITY 1150 -> 1300, THRUST 2400 -> 3400, MAX_VY 820 -> 1080, chasing
// a "Flappy Bird snappy" hold response. Real-player feedback (Reddit, 2026-09-09) called
// the accel "too fast" with deaths coming before the run's rush ever landed, so THRUST
// was pulled back to the documented middle ground: 3400 -> 2700. A same-day playtest of
// that value felt off in the other direction (too floaty), so it was nudged back up to
// 3100 - net-up 1800 vs net-down 1300, roughly midway between the original 2100:1300
// snap and the 2700 pass's 1400:1300 softness. GRAVITY and MAX_VY are untouched. The
// hold model is still unchanged (an acceleration ramp, not Flappy's instant velocity
// impulse), just tuned to a less hair-trigger point on that same ramp.
const GRAVITY = 1300 * _FEEL_SCALE;
const THRUST  = 3100 * _FEEL_SCALE;
const MAX_VY  = 1080 * _FEEL_SCALE;
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
const GAP_PER_COIN    = H  * 0.075;   // bonus halfGap added per coin
const GAP_BONUS_MAX   = H  * 0.19;    // cap: max halfGap bonus
const GAP_DECAY       = H  * 0.015;   // bonus lost per second
// Extra cut taken off gold's coin-type share as a run gets deeper, on top of the
// natural shrink from other types' shares growing (systems.js makeCoin) -- see the
// goldDecayT doc there. 0.35 = up to 35% of gold's leftover share redistributed to
// the other active types by score ~900 (_prog2 = 1).
const GOLD_DEEP_DECAY = 0.35;
// gapBonus (systems.js) jumps instantly on pickup so a coin's *effect* is never in
// doubt; gapBonusVisual (the value collision/rendering actually use, world.js
// boundsAt) chases it at this constant px/s rate instead of snapping, so the wall
// visibly widens rather than teleporting. Same lag applies on the way down after
// GAP_DECAY starts pulling the target back in, which is why smoothing this also
// nudges the corridor's total "wide" window slightly longer, not just its onset.
const GAP_EASE_RATE   = H  * 0.3;

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

// Game Center / Play Games achievement IDs for "flew this world", index-aligned
// with WEEKDAY_PALETTES above (0 = Monday/Ceres ... 6 = Sunday/Rhodia). Fired
// from commitDeath() (update.js) on the first finished run of a real length
// (CONTINUE_MIN_SCORE) on each world; state.js `planetsFlown` is the persistent
// 7-bit mask that makes each one a one-shot. `tunl_ach_grand_tour` is the
// capstone -- fired the run that completes the set (mask == 0x7f). Same
// self-chosen-id + Android-shim setup as SHIP_ACHIEVEMENTS below; Android maps
// these to Play Console's opaque ids in MainActivity.kt / strings.xml.
const PLANET_ACHIEVEMENTS = [
    'tunl_ach_planet_ceres',  'tunl_ach_planet_mars',   'tunl_ach_planet_luna',
    'tunl_ach_planet_io',     'tunl_ach_planet_ianthe', 'tunl_ach_planet_pallas',
    'tunl_ach_planet_rhodia',
];
const PLANET_GRAND_TOUR_ACH = 'tunl_ach_grand_tour';
const PLANET_ALL_FLOWN_MASK = (1 << PLANET_ACHIEVEMENTS.length) - 1; // 0x7f

// Lifetime-distance achievements: fired from commitDeath() the run that pushes
// the all-time total (state.js `lifetimeDist`, shown on the title screen as
// `lifetimeDist / 60`) past each mark. A single run can never span a whole tier,
// so the before/after crossing check there fires each exactly once - no extra
// persisted flag needed. `at` is in the same displayed distance unit as the
// title-screen figure. MOON is the real ~384 400 km to the Moon; SUN is loose
// poetry (real 1 AU ~150M would be decades of play) - a genuine multi-month /
// year-plus long-haul goal. Same self-chosen-id setup as the achievements above.
const DIST_ACHIEVEMENTS = [
    { id: 'tunl_ach_dist_moon', at: 384000 },
    { id: 'tunl_ach_dist_sun',  at: 3000000 },
];

// Flight-duration achievements: fired from update.js's play-phase block the frame
// this run's real elapsed play time (state.js `flightClock`, accumulated the same
// way as poisonClock/bombClock/drainClock) crosses each mark. Per-run, not
// lifetime, so unlike DIST_ACHIEVEMENTS there is no persisted stat to re-derive
// after the fact - deliberately excluded from _tunlBackfillAchievements(), same as
// on_fire/new_legend/ghost_hunter. `flightAchIdx` (state.js) just walks this array
// forward once per run since flightClock only ever increases.
const FLIGHT_ACHIEVEMENTS = [
    { id: 'tunl_ach_flight_1min', at: 60 },
    { id: 'tunl_ach_flight_2min', at: 120 },
];

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

// ── Falling stalactites ───────────────────────────────────────────────
// A ceiling stalactite that visibly SHAKES left/right (draw.js wobX) and trickles
// dust as it scrolls in - the tell for which spikes drop - then breaks loose as
// the player closes within FALL_LEAD and falls the full corridor over FALL_SPAN
// world-px of scroll, tip meeting the far wall so it reads as "this spike is
// dropping to the floor, get over it". Never dropped onto someone already level
// with it (the detach trigger guards that). Cadence: world.js fallSpacing();
// flagging: maintainStalactites; drop: updateFallingStals. Both scale with W
// (fixed on-screen geometry, W capped 956). FALL_LEAD small enough that the loose
// spike shakes on screen ~0.6s before it lets go; FALL_SPAN a quick drop.
const FALL_LEAD = W * 0.44;
const FALL_SPAN = W * 0.26;

// Bomb coin (purple): blast radius for the "destroy nearby obstacles" pickup effect --
// see systems.js triggerBombExplosion(). "Small" on purpose -- clears immediate danger,
// not the whole visible screen.
const BOMB_RADIUS = W * 0.30;

// Grace window after an absorbed hit (state.js invulnT, decremented in update.js). While
// active, die() returns false unconditionally -- no shield charge is spent on a second
// hit inside the window -- and the wall-bounds checks in update.js clamp py back inside
// the corridor instead of killing, so the ship can't drift into the solid wall geometry
// for the rest of the window the way it would if collision were simply skipped. Hazards
// (stalactites/mines/cannon shots) aren't wall-anchored geometry, so they're just passed
// through harmlessly, same convention as classic arcade invincibility (solid terrain still
// blocks you, hazards don't hurt you). Currently only granted on a shield-absorbed hit
// (see die()'s bypassShield branch); a future rewarded "continue" reuses the same timer.
const HIT_INVULN_SEC = 1.4;

// ── Onboarding: teaching RELEASE ─────────────────────────────────────
// The obstacle-free opening stretch (lifecycle.js STAL_START_WX) teaches thrust, but
// nothing in the game ever teaches that RELEASING is the other half of the control
// scheme -- and CLAUDE.md rules out re-adding a title-screen text hint for it (that was
// tried in 5.0 and removed the same day). The runway alone doesn't cover it: the ship
// launches at H/2 with the corridor ceiling ~H*0.43 above it, and at net-up 1800 px/s^2
// a player who simply presses and holds reaches that ceiling in ~0.46s. Their first
// lesson is still the death screen.
//
// So the opening coins teach it instead, wordlessly and unmissably: over this stretch
// the coin line is forced onto a gentle arc that starts BELOW the launch line, so the
// natural way to take the first coin is to let go and glide down, and the natural way
// to take the second is to hold and climb back. Coins can't kill anyone, so the lesson
// costs a new player nothing if they miss it, and an experienced player just reads it
// as a pleasant opening swoop.
//
// Applied in makeCoin() (systems.js). rng() is consumed either way, so the coin TYPE
// roll and everything downstream in the seeded stream is byte-identical -- only the
// y positions move, exactly like the deep-run coin-line shapes it sits next to.
const ONBOARD_ARC_WX   = 2200;  // world-x the arc fades out at (~first 3 coins, ~6s)
const ONBOARD_ARC_FRAC = 0.55;  // how much of the available half-corridor the arc uses

// ── World rank visibility floor ──────────────────────────────────────
// The daily world rank (death screen's right column + the title screen's leaderboard
// rail badge) is only motivating if there's a real field to be ranked against. Below
// this many participants on the day it is actively DEMOTIVATING: a live check of the
// web leaderboard on 2026-09-10 found 0-4 distinct players on most days, which renders
// as "#1 / 2" -- a number whose real message to the player is "nobody else is here."
// Under this floor both surfaces fall back to exactly what they already do when no rank
// is known at all (the 5-row local list, no rail badge), which is a strictly better
// read than an honest-but-lonely standing. Raise or drop this as the real player base
// moves; it costs nothing once the field is genuinely deep.
//
// Only the TOTAL is gated, never the player's own rank value -- a legitimately deep
// field where the player happens to sit at #1 must still show.
const WORLD_RANK_MIN_FIELD = 50;
function worldRankWorthShowing() {
    return worldRank !== null && worldRank > 0 && worldRankTotal >= WORLD_RANK_MIN_FIELD;
}

// ── Rewarded continue ────────────────────────────────────────────────
// Offered at most once per run, only past this score -- same floor as the
// interstitial's MIN_SCORE_FOR_AD (AdsManager.swift/.kt), for the same reason:
// runs below it are instant faceplants, not worth a 15-30s video either way.
const CONTINUE_MIN_SCORE   = 25;
const MAX_CONTINUES_PER_RUN = 1;

// ── Store rating prompt ─────────────────────────────────────────────
// Native review sheet (SKStoreReviewController on iOS, Play In-App Review on
// Android - see the "review" bridge, update.js maybeRequestReview()). Fired on a
// new all-time best, the same "this was worth celebrating, not a nag" gate
// shareWorthy() (share.js) already uses. Same score floor as CONTINUE_MIN_SCORE
// above, reused rather than a fresh number, for the same reason: a rating
// prompt right after an instant-faceplant "personal best" of 9 reads as absurd.
const REVIEW_MIN_SCORE = CONTINUE_MIN_SCORE;
// Local cooldown between prompts, generous relative to Apple's own system-wide
// limit (max 3 SKStoreReviewController prompts per 365 days, silently a no-op
// beyond that) and Android's equivalent per-app throttling, so this gate is
// never the tighter one - it exists to stop the bridge call from firing every
// single session for a player who keeps beating their own record, not to
// approach either store's real ceiling.
const REVIEW_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;
// The existing gap between a fatal hit and the death screen becoming tappable
// (input.js's onDown gate, draw.js's button fade-in). Reused, not extended, as
// the continue offer's own window (update.js's phase==='dead' branch, draw.js
// drawContinueOffer) -- see CLAUDE.md's Rewarded Continue notes: declining the
// offer must cost zero extra wait or tap versus today, so the offer has to fit
// inside time that's already unskippable, not add its own.
const DEATH_INTERACTIVE_SEC = 0.9;
// The continue offer's own timeout -- deliberately NOT reusing DEATH_INTERACTIVE_SEC
// above. First real-device pass found 0.9s (matched to that *existing* pre-interactive
// beat, so declining would cost zero extra wait) too short to actually use: a player
// has to notice the icon, understand it, and land a tap on a small on-screen target
// right after the hit's own shake/flash, all inside under a second. Declining is still
// free either way (do nothing), but *using* the offer needs enough time to be usable at
// all -- so an eligible death now waits a few extra seconds before falling through to
// the normal death screen if the offer goes untapped, in exchange for the offer being
// something a player can actually land. See drawContinueOffer's countdown ring, which
// makes that budget visible rather than a silent cliff.
const CONTINUE_OFFER_SEC = 3.0;
// Revive countdown (update.js grantRevive()/phase==='revive' branch): once the
// reward lands, the world freezes with the ship parked at the recentered spot for
// this long, showing a localized "READY" flash (T.ready, draw.js
// drawReviveCountdown), before play actually resumes. Not just a beat for the
// player to reorient after tapping through an ad -- HIT_INVULN_SEC only starts
// counting down once play resumes (not during this freeze, where nothing can hit
// the player anyway since scrollX isn't advancing), so this freeze is free grace
// time, not time subtracted from the invulnerability window after it.
const REVIVE_COUNTDOWN_SEC = 1.2;

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
// Drain coin (wine): the second punishing coin. Poison debits the *pending shard
// bank* (runCoins, meta progress); drain debits the *visible run score* (bonusScore,
// see systems.js checkCoinCollection + update.js score clamp), so the HUD number
// itself drops when you hit one. Same real-time-clock cadence model as poison/bomb
// (constants.js POISON_INTERVAL_SEC doc for why a clock, not a per-candidate %), but
// rarer -- it stings more visibly, and with two punishers now live the combined
// punishment cadence (poison 20s + drain 30s ~= one per 12s) already runs a touch
// ahead of bomb's 16s reward. That's deliberate: the deep run is meant to get
// *harder* over distance, and because drain takes a fixed *percentage* of the
// current score its absolute bite grows as the run goes deeper.
const DRAIN_INTERVAL_SEC  = 30; // avg real seconds between drain coins
// Percentage of the current total score clawed back per drain hit, lerp on _prog
// (score ~34 -> ~233). Compounds over repeated hits like poison's %-loss, and
// because it is a fraction of a shrinking number it can never drive the score
// negative (update.js still clamps at 0 as a belt-and-braces guard).
const DRAIN_LOSS_PCT_MIN  = 0.05;
const DRAIN_LOSS_PCT_MAX  = 0.08;

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
// shard-priced tiers, SOLARIS included, is 240+320+560+1280+2400+4000+5600 = 14400
// (if a tier is added or re-costed, update this sum).
//
// Set deliberately tight (160) so unlock speed is paced almost entirely by *days
// returned*, not by a grind session: even a great run banks only a fraction of a day's
// coin income before hitting the cap, and skill past "decent" just means reaching the
// 160 in fewer runs, not banking more. Every paid tier also carries a `stardustGate`
// (see below), and as of the 2026-09-10 re-cost (see SKINS) that gate -- not the shard
// price -- is the binding constraint at every tier for a player banking near the
// ceiling, which is the whole point of the stardust system. At the full 300/day ceiling
// the entire roster's shard cost is 14400/300 = 48 days, deliberately well inside
// SOLARIS's own 180-day gate so the calendar does the pacing. History: this cap was 1800
// (hardcore ~1800-1920/day, so `stardustGate` did the pacing), then 350, 200, 160, then
// 180 for a 300 shards/day ceiling (180 coins + 120 missions); set back to 160 when the
// daily rewarded-ad bonus (SHARDS_AD_REWARD below) took over the missing 20, keeping the
// ceiling at 300 but re-sourcing part of it as an opt-in ad.
//
// Two other shard sources are exempt from this cap: the 3 daily missions
// (MISSION_REWARD_BY_TIER below, 30+40+50) and the once-per-day rewarded-ad bonus
// (SHARDS_AD_REWARD), so the real per-day ceiling is 160 + 20 + 30 + 40 + 50 = 300.
const DAILY_SHARD_CAP = 160;

// Once-per-UTC-day opt-in bonus: the player taps a row in the Missions drawer, watches a
// rewarded video, and gets a flat shard grant. Exempt from DAILY_SHARD_CAP (like a
// mission reward) -- it's a bounded once-a-day top-up, not the unlimited-grind vector the
// cap guards against. Gated on `shardsAdClaimedToday` (state.js, reset at the day
// boundary in lifecycle.js) and on native reporting a loaded rewarded ad
// (`shardsAdReady`); with no native bridge (browser) it simply never becomes claimable.
// Uses its own dedicated AdMob "Shards Rewarded" unit, separate from the rewarded
// continue's unit, so their eCPM/fill report independently. See src/main.js's
// _tunlShardsRewardGranted and AdsManager.swift/.kt's shards-rewarded manager.
const SHARDS_AD_REWARD = 20;

// Two-sided referral reward (web.js submitReferral/checkReferralReward): the
// sharer's payout once someone they invited clears their own first real run.
// Same amount as SHARDS_AD_REWARD - a real bonus, not enough on its own to
// bypass the deliberately-scarce late-ship economy above (a maxed-out player
// sharing constantly still can't out-earn the daily cap this way; a genuine
// referral is a rare event, not a grindable loop). Exempt from
// DAILY_SHARD_CAP for the same reason SHARDS_AD_REWARD is: a bounded,
// opportunistic top-up, not the unlimited-grind vector the cap guards
// against - and unlike the ad bonus, not even once-a-day capped, since
// landing more than one referral in a day is already rare enough to be
// self-limiting.
const REFERRAL_REWARD = 20;

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
// Since the 2026-09-10 shard re-cost (see SKINS) these gates are the REAL schedule, not
// an aspirational floor sitting under an unreachable price: a player banking near the
// daily ceiling now lands on each tier's gate day almost exactly, SOLARIS included
// (day 180). A slower player stays shard-bound a little past each gate, which is the
// intended soft difference between "returns daily and plays well" and "returns daily".
const STARDUST_PER_DAY          = 1;
const STARDUST_STREAK_BONUS_DAY = 7; // every Nth unbroken streak day grants +1 extra

// ── Daily missions ────────────────────────────────────────────────────
// Three short daily challenges, picked deterministically from the calendar day (see
// pickDailyMissionIndices) so every player sees the same 3 on a given day. Progress is
// cumulative across all of today's runs (state.js `dailyMissionStats`, folded in by
// update.js die()), not a single-run target -- keeps them reachable across casual
// multi-session play, not just one long grind run. Completing one grants a per-tier
// reward (MISSION_REWARD_BY_TIER, indexed by the mission's `tier`) immediately, exempt
// from DAILY_SHARD_CAP: a bounded, once-per-mission-per-day reward isn't the
// unlimited-grind problem that cap guards against.
//
// `tier` (0 easy / 1 medium / 2 hard) is both the pick stratifier and the payout tier:
// pickDailyMissionIndices draws exactly one mission from each tier, so every day is one
// gimme + one session-grind + one skill/deep-run chase, and the reward scales with the
// slot -- 30 for the easy gimme, 40 for the medium grind, 50 for the hard chase. The
// three slots are structurally different, not three random draws that might all be
// trivial or all be brutal. Targets are tuned so each tier is ~a few / ~5-10 / ~10-15 min of
// focused play for a mid-skill player; green/red were cut hard from an earlier pass where
// their coin-type spawn weight (3% / ~6%, see makeCoin in systems.js) plus their score
// gate made them near-impossible for the casual players who need the shards most.
const MISSION_REWARD_BY_TIER = [30, 40, 50]; // shards per completed mission, by `tier`
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
// Shard costs were re-tuned 2026-09-10 after measuring what they actually cost in
// days (scratchpad sim against the real curves). The old ladder
// (240/880/2200/4800/12000/32000/50000, cumulative 102120) meant the bindingconstraint
// flipped from `stardustGate` to shards at VOID and then ran away: NOVA was
// ~174 days even for a player maxing all 300 shards/day, SOLARIS ~341 -- and at a
// realistic ~80/day (half the coin cap, no ad, no missions) they were ~652 and ~1277
// days. The top three tiers weren't "aspirational", they were unreachable, and the
// stardust gate they were supposed to be paced by (110/180) had stopped doing any
// work at all because shards bound first by a factor of 2-7x.
//
// The ladder below restores the documented intent (see the Stardust block above:
// "coming back tomorrow is the only lever"). Cumulative cost is set just under what
// each tier's stardustGate implies at a realistic ~80 shards/day, so:
//   - a player banking near the daily ceiling is gated by stardust at EVERY tier,
//     which is what that system exists to do (SOLARIS still lands on day 180 exactly);
//   - a weaker/less frequent player stays shard-bound a little past each gate, so
//     shards still mean something without ever becoming the wall.
// Cumulative: 240 / 560 / 1120 / 2400 / 4800 / 8800 / 14400 (keep DAILY_SHARD_CAP's
// doc comment in sync with that last figure).
const SKINS = [
    { color: '#e8eeff', shadow: [210,220,255],  name: 'PEARL'                                               },
    { color: '#ffaa00', shadow: [255,155,0],    name: 'AMBER',   cost: 240,  stardustGate: 1                },
    { color: '#ff1a33', shadow: [255,30,55],    name: 'CRIMSON', cost: 320,  stardustGate: 5                },
    { color: '#00ccff', shadow: [0,190,255],    name: 'ELECTRIC',cost: 560,  stardustGate: 15               },
    { color: '#99ff00', shadow: [140,255,0],    name: 'TOXIC',   cost: 1280, stardustGate: 35               },
    { color: '#c080ff', shadow: [180,90,255],   name: 'VOID',    cost: 2400, stardustGate: 65               },
    { color: '#ffffff', shadow: [255,255,255],  name: 'NOVA',    cost: 4000, stardustGate: 110              },
    { color: '#ff6600', shadow: [255,100,0],    name: 'SOLARIS', cost: 5600, stardustGate: 180              },
];

// Game Center / Play Games achievement IDs, index-aligned with SKINS above. PEARL (index
// 0) is the free starter ship and has no unlock achievement, hence the leading ''.
const SHIP_ACHIEVEMENTS = ['', 'tunl_ach_ship_amber', 'tunl_ach_ship_crimson', 'tunl_ach_ship_electric',
                            'tunl_ach_ship_toxic', 'tunl_ach_ship_void', 'tunl_ach_ship_nova', 'tunl_ach_ship_solaris'];
