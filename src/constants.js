// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch

// Single source of truth for the marketing version, shared by all three targets
// (iOS/Android read their own native MARKETING_VERSION / versionName - keep this in
// sync via /release step 1). Not rendered in any UI (would be a gated web/app change);
// it exists so a build can identify itself: window.TUNL_VERSION for a DevTools check,
// and build-play.mjs stamps it into /play as <meta name="tunl:version"> so the live
// web build's version is greppable without diffing the bundle.
const TUNL_VERSION = '17.1';
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
// Ship exhaust nozzles in PR units (draw.js drawShip's nacelles and the 3D model's). Shared
// by the thrust plume and on-fire cone (draw.js) and the thruster particles (update.js), so
// exhaust always leaves the nacelles whatever the hull geometry does. The F-14 hull
// (2026-09-22) puts them close together beside the beaver tail (the SR-71 had them at 0.50).
const SHIP_NOZZLE_X = -0.98, SHIP_NOZZLE_Y = 0.20;

// 3/4 SIDE VIEW (2026-09-19, variant D of the view study:
// https://claude.ai/artifact/Q9gDK8SdVrCYm9rU9biZdJ). The flying ship (player, ghost,
// wreck) is drawn from a small 3D model of the hull (draw.js drawShip3D; an F-14 since
// 2026-09-22), rolled SHIP3D_ROLL_BASE degrees out of the top view toward a side view,
// plus a light roll that follows the climb rate (+-SHIP3D_ROLL_AMP, update.js
// stepShipRoll). Hangar, hero, shop and share card stay top-down - the hangar is a
// portrait, the flight is a flight.
// PR is untouched and this is draw-only: no rng(), no placement, no collision input.
//
// WHY: the cave is a side section (gravity down, stalactites from the ceiling, a dusk
// skyline in the approach) and the ship was the one thing in it seen from above.
//
// The roll angle is a trade: at 45 only the near wing reads and the picture reaches just
// ~0.55-0.8 PR vertically against the hitbox circle (0.98 top-down), at 90 it is simply the
// old top view. It sat at 60 from 2026-09-19; the user asked for "a bit more from above" on
// 2026-09-23 and it is 67 now, which also buys hitbox coverage: the F-14 hull reaches
// ~0.83 PR in normal flight (0.66 in the worst case over the roll swing and every sweep,
// against 0.78 / 0.61 at 60).
// test-collision.js holds that envelope (never past 1.0 PR, never a longer nose than the
// flat hull) at every roll and sweep state. At 60 the SPAN carries the coverage, so
// SHIP3D_FIN_SCALE barely moves it (measured +0.01 between 1.0 and 1.8) - the lever for
// "the picture should fill more of the circle" is SHIP3D_ROLL_BASE.
// Kill switch: false restores the flat top-down drawShip everywhere, with no other change.
const SHIP_VIEW_3D      = true;
const SHIP3D_ROLL_BASE = 67;    // degrees: 90 = today's top view, 0 = pure profile
const SHIP3D_ROLL_AMP  = 10;    // degrees of roll at full climb / full fall
const SHIP3D_FIN_SCALE = 1.0;   // fin height, x the model's F-14 proportion
// Swing wing (F-14 style, 2026-09-19; F-14 hull and the rule below, 2026-09-22): the panels
// tell the player how fast the ship is, in three states (update.js stepShipRoll). Normal
// flight sits at SHIP3D_SWEEP_CRUISE, between the extremes; a WARP folds them all the way
// back; a BLUE COIN swings them all the way forward. Each extreme eases back to cruise on
// its own effect clock, so the wings double as a readout of how much warp or slow time is
// left. They used to track the scroll speed, which spread them through the whole slow
// opening - the ship read as a trainer, not a fighter (user, 2026-09-22).
// SHIP3D_SWEEP_MAX is a hitbox trade, not taste: the panels spread at a 20 deg leading
// edge, so 34 takes them to 54 deg. The real F-14's 68 deg (48 here) pulls the tips in so
// far that the swept ship fills only ~0.51 r of the circle in flight against
// test-collision.js's 0.60 - you would die before the wing touched. 34 holds ~0.60.
const SHIP3D_SWEEP_MAX    = 34;    // degrees of outer-panel sweep (20 -> 54 deg leading edge)
const SHIP3D_SWEEP_CRUISE = 0.46;  // normal flight, as a fraction of SHIP3D_SWEEP_MAX (0 = spread, 1 = folded)
const SHIP3D_SWEEP_WARP_EASE = 0.55;  // last fraction of a warp over which the wings glide back to cruise
// Barrel roll on flying through the warp portal (2026-09-19): one full 360 deg turn about
// the long axis, eased in and out, on top of the normal roll. The warp makes the player
// hazard-immune and wall-clamped (CLAUDE.md "Warp portal"), so the picture briefly
// leaving the hitbox mid-roll can never decide a death.
const SHIP3D_BARREL_SEC = 1.1;
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
// Ships false. Was a bare, unguarded 'P' keydown handler through 11.0 (input.js) --
// a red-team audit found it froze a LIVE run indefinitely (world/physics/audio all
// suspended) with no confirmation and no visible state, which on a leaderboard game
// is unlimited thinking time for free. window._freezeDraw itself stays -- the headless
// playtest workflow (see CLAUDE.md-adjacent memory) drives it from the console, never
// from this key -- only the keyboard shortcut is gated. Flip true for local testing.
const DEV_PAUSE_KEY = false;

// Testing-only wallet (ships false, same pattern as DEV_INVINCIBLE above). True tops the
// shard balance up and hands over every Hangar paint part on load, so the Paint sheet can be
// exercised in a fresh simulator/emulator install that has never earned a shard. Nothing
// is written to localStorage by it, so flipping it back off returns the real save. Ships
// still unlock through the normal rules, which with a full wallet means the shard half is
// satisfied and only the stardust gate (days played) remains.
const DEV_WALLET = false;

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
// ── Gap bonus: fractions of the CORRIDOR, not of the screen ───────────
// Through 12.0 these were absolute (H*0.075 / H*0.19 / H*0.015) - a fixed number of
// px added to a base corridor that shrinks H*0.34 -> H*0.163 over a run. A constant
// added to a shrinking number is a curve-flattener by construction, and a red-team
// replay measured exactly that: an expert pilot holds gapBonus at 66% of its cap for
// the WHOLE run (chicane gold sits on the corridor centreline, i.e. the line they
// already fly, so collecting it costs no detour), which widened the corridor 1.29x at
// score 0 but 1.77x from the difficulty plateau on. Designed narrowing 11.0 -> 4.2
// ship diameters; actually flown, 14.2 -> 7.4. Roughly two thirds of the designed
// narrowing was being handed back by the game's own reward.
//
// Keying them to the half-gap makes the bonus scale-invariant: a run's corridor is
// now the base curve TIMES a constant instead of the base curve PLUS one, so the
// shape the difficulty curve was designed to have is the shape the player flies.
//
// Anchored so wx=0 reproduces the old absolute values EXACTLY (halfGapAt(0) = H*0.43,
// hence 0.075/0.43, 0.19/0.43, 0.015/0.43). Two consequences worth keeping in mind:
//   - Score 0 is an exact no-op and the early game moves by at most a few percent.
//     This pass is only allowed to make the DEEP run harder - same standing rule the
//     2026-09-11 balance pass set ("never make score <233 harder").
//   - All three scale TOGETHER, so every ratio between them holds at every depth:
//     still 2.53 coins to fill the bar from empty, still 0.2 coins/sec to hold it at
//     the cap. The supply economics CHICANE_GOLD_GAP_SEC and POWERUP_MIN_GAP_SEC were
//     tuned against are untouched; only the px magnitude now tracks the corridor the
//     bonus is a bonus ON.
// This does not contradict "coin bonus is a real difficulty lever" (CLAUDE.md): the
// lever is exactly as strong as it ever was early, and now equally strong - rather
// than disproportionately stronger - deep. The accessors live in world.js next to
// refreshWave(), which is what computes the reference half-gap they scale off.
const GAP_PER_COIN_FRAC  = 0.075 / 0.43;   // bonus halfGap added per coin
const GAP_BONUS_MAX_FRAC = 0.19  / 0.43;   // cap: max halfGap bonus
const GAP_DECAY_FRAC     = 0.015 / 0.43;   // bonus lost per second
// Peak multiplier on the decay rate deep (update.js _deepDecay, lerped in over
// _prog2/3, so fully inert until score 233 and only at peak around score ~2400).
// UNCHANGED at 2.5, and named here only so it can be swept without editing the decay
// line. Through 12.0 this was the only brake on a bonus that could otherwise cancel
// the whole corridor narrowing; with the magnitudes now scaling WITH the corridor
// that job is done by construction, so the expectation going in was that 2.5 would
// now overshoot and need lowering.
// It doesn't, and the reason is worth recording so nobody re-litigates it: swept at
// 1.0 / 1.6 / 2.5 (and 25.0 as a sanity check) over 100 expert runs each, the held
// bonus moved 0.850 -> 0.849 -> 0.821 and the per-band corridor not at all. Coin
// SUPPLY refills the bar far faster than any of these rates drain it, so decay is
// simply not the binding constraint any more - the cap is. Left alone rather than
// re-tuned on a guess; if the deep run ever needs tightening again, the lever is
// supply (CHICANE_GOLD_GAP_SEC) or GAP_BONUS_MAX_FRAC, not this.
const DEEP_DECAY_PEAK    = 2.5;
// Extra cut taken off gold's coin-type share as a run gets deeper, on top of the
// natural shrink from other types' shares growing (systems.js makeCoin) -- see the
// goldDecayT doc there. 0.35 = up to 35% of gold's leftover share redistributed to
// the other active types by score ~900 (_prog2 = 1).
const GOLD_DEEP_DECAY = 0.35;
// gapBonus (systems.js) jumps instantly on pickup so a coin's *effect* is never in
// doubt; gapBonusVisual (the value collision/rendering actually use, world.js
// boundsAt) chases it at this constant px/s rate instead of snapping, so the wall
// visibly widens rather than teleporting. Same lag applies on the way down after
// the decay starts pulling the target back in, which is why smoothing this also
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

// Lifetime-runs-played achievements: fired from lifecycle.js startPlay() the run that
// pushes the all-time total (state.js `totalRuns`, same "every started run counts"
// definition as the daily-mission `dailyRuns` counter) past each mark. A single run can
// only ever advance the counter by 1, so the same before/after crossing idiom as
// DIST_ACHIEVEMENTS fires each exactly once. Persisted stat -> backfilled in state.js's
// _tunlBackfillAchievements, unlike the per-run FLIGHT_ACHIEVEMENTS above.
const RUNS_ACHIEVEMENTS = [
    { id: 'tunl_ach_runs_10',   at: 10 },
    { id: 'tunl_ach_runs_100',  at: 100 },
    { id: 'tunl_ach_runs_1000', at: 1000 },
];

// Lifetime near-miss ("Ausweichen") achievements: fired from update.js's commitDeath()
// the run that pushes the all-time total (state.js `lifetimeNearMisses`, summed from
// each run's `runNearMisses` -- the same source dailyMissionStats.nearMisses reads) past
// each mark. Same crossing idiom and same backfill treatment as DIST_ACHIEVEMENTS /
// RUNS_ACHIEVEMENTS above.
const DODGE_ACHIEVEMENTS = [
    { id: 'tunl_ach_dodge_100',  at: 100 },
    { id: 'tunl_ach_dodge_1000', at: 1000 },
];

// "Pacifist" achievement: reach the difficulty plateau (score >= 233, the corridor-
// narrowing curve's _prog=1 point, see world.js) in a single run while collecting ZERO
// coins of any type. Checked against `runCoins` (state.js), which only ever increments
// on a real coin pickup - poison/drain hazard "coins" hit an early `continue` in
// checkCoinCollection (systems.js) before that increment, so touching one doesn't cost
// the achievement, matching the "no REWARD coin collected" reading of "pacifist" rather
// than "touched nothing coin-shaped." Fired from commitDeath() in update.js once score
// is final. Per-run, not a persisted lifetime stat -- like FLIGHT_ACHIEVEMENTS,
// deliberately NOT backfilled since a past run's coin-free-ness can't be reconstructed
// after the fact.
// Raised 233 -> 250 on 2026-09-17 (user request, same pass as NO_BONUS_ACH_SCORE above) -
// nudged just past the difficulty-plateau score so it no longer sits exactly on _prog=1.
const PACIFIST_ACH_SCORE = 250;
const PACIFIST_ACH_ID = 'tunl_ach_pacifist';

// "Perfect Sprint" achievement: reach SPRINT_ACH_SCORE within SPRINT_ACH_MAX_SEC of real
// play time in a single run (state.js `flightClock`, the same real-seconds accumulator
// FLIGHT_ACHIEVEMENTS reads). Checked live in update.js's play-phase block, guarded by
// `sprintAchFired` (state.js, reset each run) since `flightClock` only ever grows so the
// condition would otherwise re-fire every frame it stays true. 30s for score 300 sits at
// the tight end of a "good run" (see CLAUDE.md's POISON_INTERVAL_SEC doc: a good run is
// normally 20-36s) - a real pace achievement, not a grind one. Per-run, not backfilled.
const SPRINT_ACH_SCORE = 300;
const SPRINT_ACH_MAX_SEC = 30;
const SPRINT_ACH_ID = 'tunl_ach_sprint';

// "No-Hit Run" achievement: reach NO_HIT_ACH_SCORE in a single run without ever
// triggering die() (state.js `runHitCount`, incremented at the very top of die() in
// update.js, before the shield-absorb / grace-window early-outs - a hit silently eaten
// by a shield or the post-hit invuln window still counts as a hit here, since the ship
// still got hit). Checked live, guarded by `noHitAchFired` (state.js) for the same
// re-fire reason as SPRINT_ACH above. Per-run, not backfilled.
// Raised 233 -> 250 on 2026-09-17 (user request, same pass as PACIFIST_ACH_SCORE above) -
// same reasoning: 233 sits exactly on the difficulty-plateau score (_prog=1), nudged
// just past it so this no longer lands exactly on that boundary either.
const NO_HIT_ACH_SCORE = 250;
const NO_HIT_ACH_ID = 'tunl_ach_no_hit';

// "Ohne Bonus" (no-bonus run) achievement: reach NO_BONUS_ACH_SCORE in a single run
// without ever collecting a GOLD coin - the only coin type that feeds `gapBonus`
// (constants.js GAP_PER_COIN_FRAC, systems.js checkCoinCollection), so this is "the corridor
// was never widened," not PACIFIST_ACH's "no coins of any type" - other power-up coins
// (blue/red/orange/green/bomb) are still fair game. Checked against
// `runCoinsByType.gold` (state.js), live, guarded by `noBonusAchFired`. Per-run, not
// backfilled.
// Raised 233 -> 500 on 2026-09-17 (user request): unlike PACIFIST_ACH/NO_HIT_ACH, which
// forbid every coin or every hit, this only forbids ONE type while every other coin stays
// fair game, so 233 was trivial to clear on purpose alone - the same score threshold as
// the two much stricter achievements undersold it. 500 sits at the upper end of what a
// "good" tier run reaches post-rebalance (see project_balance_pass_2026-09-11 memory),
// so it is genuinely harder to hit than 233 without needing perfect play.
const NO_BONUS_ACH_SCORE = 500;
const NO_BONUS_ACH_ID = 'tunl_ach_no_bonus';

// "Boulder Meister" achievement: thread BOULDER_MEISTER_TARGET boulders' NARROW
// ("squeeze") pass, clean (no collision with that boulder), within a single run.
// Every boulder's centre is nudged toward one wall (_makeBoulderAt, systems.js) so
// there's always an easy pass and a tighter one - `narrowTop` (set at spawn) records
// which side is tighter. update.js's boulder-collision loop credits a pass the first
// frame the boulder's screen-x reaches the player's fixed PX without a collision having
// happened, same x-crossing idiom the warp portal ring uses. `runBoulderNarrowPasses`
// (state.js) only ever advances by 1, so a plain `=== target` check fires it exactly
// once. Per-run, not backfilled.
const BOULDER_MEISTER_TARGET = 3;
const BOULDER_MEISTER_ID = 'tunl_ach_boulder_meister';

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
        case 1: return `+${Math.round((masteryLerp(1, 1.15, 1.2) - 1) * 100)}%`;           // AMBER coin reach
        case 2: return `-${Math.round((1 - masteryLerp(2, 0.78, 0.72)) * 100)}%`;          // CRIMSON slim hitbox
        case 3: return `+${Math.round((masteryLerp(3, 6.0, 7.5) / 4 - 1) * 100)}%`;        // ELECTRIC slow time
        case 4: { const v = masteryLerp(4, 2.0, 2.5); return `${v % 1 === 0 ? v : v.toFixed(1)}x`; } // TOXIC coin bonus
        case 5: return `+${Math.round(masteryLerp(5, 4, 5)) - 3}`;                          // VOID shield cap
        case 6: return `+${Math.round((masteryLerp(6, 5.0, 6.0) / 3 - 1) * 100)}%`;        // NOVA magnet time (per-coin add, the part that actually moves now)
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
// makeRngStream() hands out an INDEPENDENT mulberry32 with its own state. Each
// spawner (stalactites, coins, mines, cannons) gets one, seeded from the day.
//
// They used to share the single rng() below, and that is what made the "identical
// daily cave" guarantee impossible to hold: the maintain*() loops run once per frame
// and each creates everything out to its horizon, so the frame on which a given
// object crosses that horizon decides whether its draws land before or after the
// other systems' draws that frame. scrollX advances by scrollSpd()*dt, which carries
// a W/600 term, so the frame boundaries - and therefore the INTERLEAVING of the
// shared stream - differed by screen width. Same seed, same spacing curves, and the
// cave still diverged within a few thousand world-px. With one stream per spawner,
// the Nth stalactite's draws are the Nth pair from the stalactite stream no matter
// when any other system ran. It also decouples the systems from each other: adding or
// removing a spawner no longer reshuffles everybody else's cave.
function makeRngStream(seed) {
    let st = seed >>> 0;
    return function () {
        st = (st + 0x6D2B79F5) >>> 0;
        let t = Math.imul(st ^ (st >>> 15), 1 | st);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

let _seed = 0;
function seedRng(s) { _seed = s >>> 0; }
function rng() {
    _seed = (_seed + 0x6D2B79F5) >>> 0;
    let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const MINE_R = W * 0.011;

// ── Placement-only radii (cross-device fairness) ─────────────────────
// PR / COIN_R / MINE_R are all W-derived, because they are on-screen SIZES and the
// screen is W wide. The corridor, though, is H-derived. Any placement decision that
// compares a W-sized margin against an H-sized corridor therefore comes out
// differently on a different aspect ratio - and because makeMine() draws rng() only
// when placement succeeds, one differing rejection forks the whole shared obstacle
// stream from that point on. That is half of why six device sizes produced six
// different daily caves (see world.js progAt/prog2At for the other half, and the
// Cross-device fairness section in CLAUDE.md).
//
// These mirror the same radii at the reference device (W 956 x H 440, the size the
// feel was tuned at) but expressed against H, so they cancel against the H-derived
// corridor and every placement test becomes device-invariant. They are used ONLY by
// the placement/rejection code in systems.js - makeCoin, coinBlockedByStal, makeMine,
// makeBoulder. Collision and rendering keep using the real PR / COIN_R / MINE_R,
// untouched: CLAUDE.md calls keying the actual hitbox off H "a feel change needing
// its own playtest", and this is deliberately not that change.
// Minimum gap the corridor centre keeps from the top/bottom of the screen
// (world.js centerAt / boundsBase). H-relative, so the clamp lands at the same
// fraction of the corridor on every screen height - see the doc at the call site.
const WALL_PAD = H * (8 / _H_REF);

// These are ABSOLUTE reference pixels, not H-scaled, because some placement tests mix
// the two axes: a stalactite is a triangle whose x is world-px (device-invariant) but
// whose y is H-px (device-scaled), so coinBlockedByStal's point-in-triangle test
// stretches vertically with H unless it is done in one common space. The rule is
// therefore: do mixed-axis placement geometry in REFERENCE space (convert y with
// _H_TO_REF), and scale a purely vertical margin into device space with _REF_TO_H.
// Spawn horizon width. All five maintain*() loops create objects out to
// `scrollX + SPAWN_W + N`. That used to be the live W, which looks harmless - it only
// changes HOW FAR AHEAD things are made, not what - except that every system draws
// from ONE shared rng() stream and they interleave frame by frame. A wider screen ran
// each system a little further ahead, so the draws came out in a different ORDER, and
// the whole shared cave diverged from the first few hundred world-px. Pinning it to
// the W cap (constants.js W) makes the interleaving identical everywhere, and since no
// device is wider than the cap the horizon still always sits past the right edge, so
// nothing pops in mid-screen.
const SPAWN_W = 956;
// Per-spawner horizon offsets on top of SPAWN_W. ORDERING INVARIANT: stalactites are
// created first and furthest ahead, and every other spawner that INSPECTS the
// stalactite array must sit far enough inside that horizon for its whole inspection
// radius to be already populated. Otherwise a spawner near the edge sees a different
// set of stalactites depending on exactly where the frame step landed - which is
// screen-width dependent, and forks the shared cave again (test-cave.js catches it).
//
// The budget is `SPAWN_AHEAD_X + largest retry offset + inspection radius`, and the
// RETRY OFFSET TERM IS THE ONE THAT IS EASY TO FORGET. The retry loops (MINE_/
// CANNON_/BOULDER_RETRY_OFFSETS) were added in the same pass that ordered these
// horizons, and the accounting here was left at the no-retry numbers - so every
// spawner that retried walked its probe straight back out past the stalactite
// horizon and the veto it was retrying for went blind again. Measured on one day
// seed over 60000 world-px: 15 of 18 boulders and 28 of 28 cannons were finally
// placed beyond the horizon, i.e. their overlap checks had seen nothing. 12 of
// those boulders ended up with one pass sealed by a stalactite and one with BOTH
// sealed (an unavoidable death), which is exactly the "always a pass above AND
// below" contract makeBoulder exists to keep.
// test-cave.js asserts this table rather than trusting it to stay current:
//   coins  1500 +    0 +  46 = 1546 <= 1550  OK  (coinBlockedByStal, no retry)
//   mines   200 +  135 + 300 =  635 <= 1550  OK  (_makeMineAt tip push)
//   cannons 300 +  600 +  48 =  948 <= 1550  OK  (makeCannon overlap)
//   boulder 300 + 1000 + 108 = 1408 <= 1550  OK  (makeBoulder overlap)
//   portal  300 + 1040 +  81 = 1421 <= 1550  OK  (coinBlockedByStal window)
// Raising the stalactite horizon rather than clamping the offsets is deliberate:
// clamping boulders to the ~226px that fit inside the old 600 would have dropped 15
// of 18 boulders, i.e. re-created the near-extinction the retry loops were added to
// fix. The stalactite sequence itself is unchanged by a wider horizon (each spawner
// has owned its own rng stream since the cross-device pass, so creating stalactites
// earlier no longer reorders anyone's draws) - it only means the vetoes can now see
// what they are vetoing against. Everything is still created well off the right edge
// (W <= 956); the cost is a longer live stalactite array (~39 -> ~70 deep).
// SPAWN_AHEAD_COIN is the ORDERING INVARIANT's mirror image: boulders and mines yield to
// coins (a power-up must never sit inside a rock or a mine - 2026-09-20, measured 1% of
// coins inside a boulder, 3% touching a mine), so every coin they could overlap has to
// exist already. A boulder probes up to SPAWN_AHEAD_BOULDER + 1000 (retry) + 100 (half
// length) + PLACE_COIN_CLEAR_R ahead, hence 1500. That is as far as it can go: coins
// themselves inspect stalactites (+46), so 1500 + 46 <= SPAWN_AHEAD_STAL.
const SPAWN_AHEAD_STAL    = 1550;
const SPAWN_AHEAD_COIN    = 1500;
const SPAWN_AHEAD_MINE    = 200;
const SPAWN_AHEAD_CANNON  = 300;
const SPAWN_AHEAD_BOULDER = 300;

const _W_REF_PLACE = 956;
const _REF_TO_H    = H / _H_REF;      // reference-Y px  -> this device's px
const _H_TO_REF    = _H_REF / H;      // this device's px -> reference-Y px
const PLACE_PR     = _W_REF_PLACE * 0.018;
const PLACE_COIN_R = _W_REF_PLACE * 0.009;
// How far a coin's drawn object reaches (largest coin type x COIN_OBJECT_SCALE, draw.js),
// in reference px. A boulder or mine is never placed closer than this to an existing coin.
const PLACE_COIN_CLEAR_R = PLACE_COIN_R * COIN_SIZE_MAX_MULT * 1.5;
const PLACE_MINE_R = _W_REF_PLACE * 0.011;
// Stalactite half-width used by placement rejection only, at the reference device.
// The drawn/collided s.width stays W-derived (see makeStal).
function placeStalW(wx) { return _W_REF_PLACE * lerp(0.030, 0.018, progAt(wx)); }

// ── Cannons ───────────────────────────────────────────────────────────
// Rare wall-mounted turret hazard: sits flush against a wall like a
// stalactite root, fires exactly one diagonal shot as the player closes in,
// then goes inert for the rest of the run. CANNON_FIRE_LEAD is the
// world-px lead the player has when it fires (see systems.js
// updateCannonShots); CANNON_SHOT_TRAVEL is how long the shot takes to
// close that same distance, so together they fix the shot's closing speed.
const CANNON_R           = W * 0.020;
// Reference-space twin of CANNON_R, for makeCannon's placement veto only (same rule
// as PLACE_PR / PLACE_MINE_R: anything that decides whether an object EXISTS must not
// be keyed off the live W, or the cave forks by screen width).
const PLACE_CANNON_R     = _W_REF_PLACE * 0.020;
const CANNON_SHOT_R      = W * 0.013;
// Barrel length as a multiple of CANNON_R. Shared: draw.js draws the barrel this long
// and systems.js spawns the shot at its tip, so they must not drift apart.
const CANNON_BARREL_LEN  = 2.2;
const CANNON_FIRE_LEAD   = W * 0.62;
// Sound only (2026-09-19 sound review S3): sfxCannonArm plays this many real seconds before
// the shot, converted with the live scrollSpd() at that moment. No rng(), no placement
// decision, nothing another player's cave depends on - the fire point itself is untouched.
// At every cannon depth this puts the cue while the gun is still just off the right edge.
const CANNON_ARM_SEC = 0.4;
// 1.15 -> 1.45 in 12.0: raised the shot's own flight time (CANNON_FIRE_LEAD, hence
// where the muzzle fires from, is untouched) after a red-team measurement found
// cannon shots the worst-telegraphed hazard in the game - see CLAUDE.md's Cannons
// section for the measured before/after numbers.
const CANNON_SHOT_TRAVEL = 1.45;

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

// ── Crystal stalactites (16.0, do not revert to the smooth cone) ──────
// The stalactites had not been touched since 1.0: a smooth bezier cone with a
// root->tip gradient, stone speckle, inner glow, a shadowBlur edge and a
// specular streak. Ship, coins and boulders had all moved to flat facets lit
// from above (draw.js K5 "Facette + Licht"); the rock was the last airbrushed
// object on screen. It is now a CLUSTER of upright, tapered crystal prisms.
// CRYSTAL_STALS is the kill switch, same pattern as SHIP_VIEW_3D: set it false
// and _stalOutline's smooth cone is back with no other change.
//
// Four rules, each of which was arrived at by breaking it first:
//
// 1. THE MAIN CRYSTAL SITS ON THE AXIS AND HAS FULL LENGTH, so its tip lands
//    exactly on the collision triangle's apex. The first draft let every prism
//    carry a lateral offset; the tip then fell short and the lethal triangle ran
//    on below a visibly shorter crystal - the unfair direction, and immediately
//    spotted in playtest.
// 2. THE SHAFTS TAPER. In a triangle running from 0.85*hw to zero, a PARALLEL
//    column of half-width w only fits to t = 1 - w/(0.85*hw). That is why the
//    first pass could only be fat-and-short or long-and-needle-thin. A shaft
//    that narrows from w to w*CRYSTAL_TIP_FRAC follows the flank instead: wide
//    at the foot and still reaching the tip.
// 3. SIDE CRYSTALS ARE CLAMPED, VORZEICHENRICHTIG. Solving
//    |dx + L*sin a| <= 0.85*hw*(1 - L*cos a/len) with absolute values instead of
//    signs cost an inward-leaning prism up to half its length.
// 4. EVERY CRYSTAL ROOTS ON THE WALL AT ITS OWN X, not on the average over
//    +-hw. The nest crystals sit up to 3*hw out to the side, where the wall has
//    long since moved; rooted on the average they visibly float on any sloped
//    wall.
//
// The drawing may reach CRYSTAL_BASE_MAX * hw at the FOOT, against the 0.85*hw
// the collision uses - the forgiving direction, and the same thing the old cone
// did at 1.00. The NEST crystals sit beside the triangle entirely, on rock that
// is lethal anyway. Statically there is a band above them where the ship would
// clip them and live; measured over 682318 pass trajectories with free climb and
// dive phases and instant max thrust, ZERO of them reach it, because over the
// 37px between the outermost nest crystal and the axis the ship can change
// altitude by 3px - TUNL's input is an acceleration ramp, not an impulse. Nest
// height is therefore a purely cosmetic knob. Re-run that check if PR, MAX_VY or
// the scroll speed ever move.
//
// Falling stalactites: WHAT BREAKS OFF IS THE CRYSTAL, NOT THE ROCK SOCKET. The
// nest crystals and the rock lip stay behind on the ceiling as an empty socket
// (which doubles as a telegraph), only the load-bearing crystals fall - so the
// falling picture is congruent with the triangle that falls with it. On landing
// NOTHING ROTATES: the chunk stays as it fell, tip buried in the rock like a nail
// in wood, which is also the only reading consistent with stalHit(), where a
// falling spike keeps ay = b.top + fy and ty = b.top + length + fy. The burial is
// done by LENGTHENING the shafts (CRYSTAL_LAND_SINK), never by translating the
// body down - translating sinks the base too and leaves the collision standing
// above the drawing.
const CRYSTAL_STALS      = true;
const CRYSTAL_BASE_MAX   = 1.30;   // drawn half-width at the foot, in hw
const CRYSTAL_LIP_MAX    = 3.10;   // same for the nest crystals beside the triangle
const CRYSTAL_TIP_FRAC   = 0.40;   // shaft half-width at the shoulder, share of the foot
const CRYSTAL_WIDE       = 1.70;   // overall width multiplier (playtested value)
const CRYSTAL_NEST_MAX   = 0.80;   // tallest nest crystal, share of the spike length
const CRYSTAL_NEST_MIN   = 0.625;  // ... times this, as the low end of the per-spike roll
const CRYSTAL_SINK       = 0.14;   // every root this far into the rock, in hw
const CRYSTAL_LAND_SINK  = 0.40;   // extra shaft length once it has struck, in hw
const CRYSTAL_SAT        = 1.04;   // saturation applied to the day's stalEdge hue
const CRYSTAL_GLOW       = 0.22;   // tip glow; one radial fill per cluster, no shadowBlur

// Material profile per weekday, index-aligned with WEEKDAY_PALETTES. Same
// geometry everywhere - only the finish changes, so each world keeps its own
// mineral instead of seven recolours of one calcite cone. `light`/`dark` are the
// facet spreads toward white/black, `tip` how far the termination lifts toward
// white, `core` the strength of the light pipe along the axis, `gloss` an extra
// hard specular edge (glassy minerals only), `bands` horizontal growth banding
// (sinter and rhodonite), `rough` how far the outline is allowed to vary.
const CRYSTAL_MATERIALS = [
    { name: 'Kalzit',    light: 0.30, dark: 0.34, tip: 0.72, core: 0.40, gloss: 0,    bands: 0.55, rough: 0.10 }, // Ceres
    { name: 'Rostquarz', light: 0.26, dark: 0.40, tip: 0.66, core: 0.30, gloss: 0,    bands: 0.20, rough: 0.16 }, // Mars
    { name: 'Selenit',   light: 0.38, dark: 0.26, tip: 0.86, core: 0.62, gloss: 0.25, bands: 0.30, rough: 0.06 }, // Luna
    { name: 'Obsidian',  light: 0.22, dark: 0.52, tip: 0.60, core: 0.22, gloss: 0.85, bands: 0,    rough: 0.04 }, // Io
    { name: 'Amethyst',  light: 0.34, dark: 0.36, tip: 0.88, core: 0.75, gloss: 0.30, bands: 0,    rough: 0.08 }, // Ianthe
    { name: 'Olivin',    light: 0.28, dark: 0.38, tip: 0.64, core: 0.34, gloss: 0,    bands: 0.15, rough: 0.20 }, // Pallas
    { name: 'Rhodonit',  light: 0.32, dark: 0.34, tip: 0.74, core: 0.45, gloss: 0.15, bands: 0.60, rough: 0.12 }, // Rhodia
];

// ── Warp portal ("Sog") ───────────────────────────────────────────────
// Reward set-piece, not a hazard: a hoop hangs in the corridor (systems.js
// makePortal/maintainPortals); flying through it triggers the warp state
// (systems.js triggerWarp()). The violet warp coin that used to be a second entry
// point was removed 2026-09-13 on request. For
// WARP_DUR_MIN..MAX real seconds, scrollSpd() is multiplied by a per-warp
// multiplier rolled from WARP_MULT_MIN..MAX at trigger time (world.js
// warpScrollFactor(), the mirror image of slowScrollFactor()), the
// corridor widens (see WARP_GAP_MULT below), every wall-rooted/free-floating
// hazard is passed through harmlessly (same convention HIT_INVULN_SEC already
// uses: solid terrain still blocks, hazards don't), and every gold coin the
// player draws level with is auto-collected into the combo (update.js, the
// "Sog" pulling gold in). Deliberately real-seconds, not a fixed world-px
// distance: nothing here is a placement decision (no rng() draw, nothing any
// other player's cave depends on), so it's exactly the same category of
// per-player effect the blue coin's slowTime already is, not a cross-device
// fairness concern - see CLAUDE.md's reply to "why not a hard teleport".
//
// scrollX still advances one dt at a time through the ordinary maintain*()
// while-loops (systems.js) - a warp is simply a few real seconds of a bigger
// step per frame, not a value assigned to scrollX. Those loops already have to
// backfill an arbitrary jump (a backgrounded tab / a slow frame does the same
// thing, unrelated to warp), so nothing about them changes for this. Worst
// case at the dt clamp (main.js, 0.05s) and WARP_MULT_MAX below, a single frame
// advances scrollX by scrollSpd() * WARP_MULT_MAX * 0.05 - a few hundred
// world-px even at a very high deep-run scrollSpd(), nowhere near
// SPAWN_AHEAD_STAL (1550, see the budget doc above SPAWN_AHEAD_STAL).
const PORTAL_START_WX      = 3000;    // ~score 50, generous per the leaderboard audit
// Fraction of halfGapAt(wx) used for the portal ring's DRAWN radius only - always
// comfortably inside the corridor (r + max centre jitter stays well under
// halfGap, see _makePortalAt, systems.js), so an oversized ring can't visually
// clip the wall by construction. This is spectacle, not the flyability contract:
// only the ring's centre point has to be provably reachable, and that's proven
// the same way a coin's placement already is (coinBlockedByStal, systems.js) -
// deliberately NOT a bespoke geometric veto against nearby stalactites. See the
// SPAWN_AHEAD_* budget doc above SPAWN_AHEAD_STAL for why a flat/bespoke veto is
// exactly the mistake that nearly wiped out boulders and cannons; reusing the
// coin contract sidesteps it because coins already place successfully at every
// difficulty without one.
const PORTAL_R_FRAC        = 0.40;
// Per-spawner horizon offset (constants.js SPAWN_AHEAD_* budget doc above
// SPAWN_AHEAD_STAL). Portal placement only inspects the same narrow window
// coinBlockedByStal already does - same shape budget as a coin, just with
// retries (a coin has none; losing an occasional coin slot is a non-event, but a
// portal is rare enough that PORTAL_RETRY_OFFSETS, systems.js, is worth it).
const SPAWN_AHEAD_PORTAL   = 300;
// scrollSpd() multiplier while a warp is live, scaled by the player's OWN _prog2
// at the moment of trigger (systems.js triggerWarp(), rolled into state.js
// warpMult once per warp - never re-rolled mid-warp). Capped at _prog2 >= 1
// (score ~900) like most other per-run difficulty knobs (CLAUDE.md: scrollSpd()
// itself is the one thing that must never plateau; a multiplier layered ON TOP
// of it is fine to cap, and scrollSpd()'s own uncapped climb still means the
// ABSOLUTE warp speed keeps growing forever even once this ratio caps). Reading
// the player's live _prog2 rather than a placement wx is deliberate and safe
// here - see the doc above PORTAL_START_WX for why a warp is a per-player
// effect, not a cave-identity concern, so there is no "sample at placement wx"
// obligation the way a spawner curve would have.
const WARP_MULT_MIN        = 2.2;
const WARP_MULT_MAX        = 2.8;
// Warp duration range. Each flythrough lands on a specific point in it based on
// how centred it was (update.js's x-crossing check, systems.js triggerWarp()
// doc) - dead-centre earns the full
// WARP_DUR_MAX_SEC, a graze along the ring's hit tolerance only WARP_DUR_MIN_SEC.
const WARP_DUR_MIN_SEC     = 1.1;
const WARP_DUR_MAX_SEC     = 1.6;
// Fraction of ramp-in-then-hold time within the duration before warpScrollFactor()
// starts gliding back down to 1.0x, so the exit isn't an abrupt cut (world.js).
const WARP_RAMP_SEC        = 0.15;
const WARP_RECOVER_FRAC    = 0.30;
// Corridor widen while a warp is live, applied through the SAME easing channel as
// gapBonusVisual (update.js) so it ramps and recovers smoothly instead of
// snapping - boundsAt() only, never boundsBase(), so no placement decision
// anywhere ever depends on whether a warp happens to be live (CLAUDE.md
// "boundsBase for coin placement" rule, same reasoning extended here).
//
// This is breathing room, not the safety guarantee: at the wave's peak slope,
// the warp's faster corridor drift CAN in theory outrun MAX_VY for a moment
// (peak vertical corridor speed is roughly (wA1*wF1 + wA2*wF2) * scrollSpd() -
// at the difficulty plateau that's already ~45% of MAX_VY unwarped, so even
// WARP_MULT_MIN alone would clear it, and WARP_MULT_MAX more so). Rather than
// hand-tuning this constant against a moving target (wave amplitude/frequency
// both still climb with _prog2, and now the warp multiplier itself does too),
// the actual guarantee is a clamp: update.js's wall-collision check
// treats warpTime > 0 exactly like invulnT > 0 (the shield-absorbed grace
// window) - push the ship back inside the corridor instead of killing it. A
// warp can therefore never end in a wall death; this constant just decides how
// much of that clamping the player actually feels.
const WARP_GAP_MULT        = 1.7;
const WARP_GAP_EASE_RATE   = H * 1.6;

// Bomb coin (red): blast radius for the "destroy nearby obstacles" pickup effect --
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

// ── Onboarding: safe opening flight (score 0-50, every run) ─────────
// Beginner feedback (2026-09-13, several players): "too hard, frustrating, deleted".
// The measured cause is the control scheme, not the obstacles - a beginner's median
// run was 1.0s of flight, i.e. they died to the ceiling/floor before learning the feel.
// So the first ~50 points of EVERY run are a plain flight (was ~100 until the same
// day, cut to 50 on request):
// - the corridor opens up to the screen edges (world.js safeOpenAt, boundsAt only -
//   placement via boundsBase is untouched), easing shut over the last SAFE_CLOSE_WX.
//   The walls themselves are lethal from the tunnel entry since 2026-09-19 (they used to
//   bump the ship back until SAFE_START_WX); HULL_SCRATCHES absorbs the first two hits;
// - no stalactites, mines, boulders or cannon fire until HAZARD_START_WX, which leaves
//   SAFE_HAZARD_GAP_WX (~1s) between the corridor closing and the first hazard.
//   Coins and the warp portal still appear.
// It applies identically to every player and every screen, so the shared daily cave and
// leaderboard stay fair (test-cave.js mirrors these start cursors). All hazard offsets
// here are fixed world-px, never W/H-derived, or the cave would fork per device.
// Briefly (same day, never shipped) this was a 3-run off-record "training flight" with
// normal runs safe only to score 50; unified on request once both had the same rules.
const SAFE_START_WX       = 3000;   // ~score 50: the open corridor has closed here (was 6000 / ~100)
const SAFE_CLOSE_WX       = 1800;
const SAFE_HAZARD_GAP_WX  = 400;
const HAZARD_START_WX     = SAFE_START_WX + SAFE_HAZARD_GAP_WX;   // first stalactite

// ── Flight plan: sectors (2026-09-13) ────────────────────────────────
// A run is a sequence of SECTORS of SECTOR_SEC reference seconds each. Sector 0 is the
// safe opening flight (ends at SAFE_START_WX); every later sector introduces at most one
// or two new things and runs a small density sawtooth (world.js sectorEnvelope). Why:
// a measured replay (4 bot skill tiers, 24 day-seeds) found 7 new elements in the first
// 9 seconds, none between 9s and 22s, five between 23s and 37s and nothing new after
// that - and hazard rates per second DOUBLING twice between score 300 and 1150, which
// ended 93-100% of expert runs inside one score band. Sectors spread the novelty evenly
// and let every rate grow by a fixed factor per sector instead. See CLAUDE.md "Flight plan".
//
// Reference seconds, not real seconds: refSpdTrend() is scrollSpdBase()'s trend at the
// W cap (no deep pulse, no slow/warp), so a sector boundary is a pure function of world-x
// and identical for every player and screen (cross-device fairness, test-cave.js).
const SECTOR_SEC = 7;
function refSpdTrend(wx) {
    // scrollSpdBase's trend (world.js calls this - one formula, not two copies).
    const p  = Math.min(Math.sqrt(Math.max(wx, 0) / 14000), 1);
    const p2 = Math.max(wx - 14000, 0) / 40000;
    return lerp(lerp(230, 400, p), 560, Math.min(p2, 1)) + Math.sqrt(Math.max(p2 - 1, 0)) * 90;
}
const _sectorWx = [0];
function _extendSectors(untilWx, untilIdx) {
    // Integrates reference flight time in 1/50 s steps from SAFE_START_WX; grows lazily
    // and deterministically, so a deep run only pays for the sectors it reaches.
    if (_sectorWx.length === 1) _sectorWx.push(SAFE_START_WX);
    let wx = _sectorWx[_sectorWx.length - 1];
    while (_sectorWx[_sectorWx.length - 1] <= untilWx || _sectorWx.length <= untilIdx) {
        let t = 0;
        while (t < SECTOR_SEC) {
            const v = refSpdTrend(wx) * 956 / 600;
            wx += v / 50; t += 1 / 50;
        }
        _sectorWx.push(Math.round(wx));
        wx = _sectorWx[_sectorWx.length - 1];
    }
}
function sectorStartWx(k) { _extendSectors(-1, k); return _sectorWx[k]; }
function sectorAt(wx) {
    _extendSectors(wx, 0);
    let lo = 0, hi = _sectorWx.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (_sectorWx[mid] <= wx) lo = mid; else hi = mid - 1; }
    return lo;
}
// 0 at a sector's start, 1 at its end.
function sectorPhase(wx) {
    const k = sectorAt(wx);
    const a = _sectorWx[k], b = sectorStartWx(k + 1);
    return Math.min(Math.max((wx - a) / (b - a), 0), 1);
}
// What each sector introduces (score is approximate, distance only):
//   S0  0-50    open corridor, lethal walls + HULL_SCRATCHES (whole run): gold, blue
//   S1  50-111  first stalactites, shield coin
//   S2  111-178 orange ammo, green magnet
//   S3  178-252 first mine (alone, centred), bomb coin
//   S4  252-328 boulders
//   S5  328-408 chicanes (faded in over CHICANE_FADE_WX)
//   S6  408-493 cannons
//   S7  493-583 falling stalactites
//   S8  583-677 poison coin
//   S9  677-773 drain coin
//   S10+        nothing new - every rate keeps growing per sector (world.js)
// Tools arrive before the threat they answer. They are not pushed later than S2 on
// purpose: the daily missions ("5 ammo", "2 magnets", "3 bombs") must stay reachable for
// casual players, whose runs end around S2-S3.
const RED_START_WX        = sectorStartWx(1);
const ORANGE_START_WX     = sectorStartWx(2);
const GREEN_START_WX      = sectorStartWx(2);
const MINE_START_WX       = sectorStartWx(3);
const BOMB_START_WX       = sectorStartWx(3);
const BOULDER_START_WX    = sectorStartWx(4);
const CHICANE_START_WX    = sectorStartWx(5);
const CHICANE_FADE_WX     = 6000;   // chicaneProb ramps 0 -> full over this after CHICANE_START_WX
const CANNON_START_WX     = sectorStartWx(6);
const FALL_START_WX       = sectorStartWx(7);
const POISON_START_WX     = sectorStartWx(8);
const DRAIN_START_WX      = sectorStartWx(9);
// Hull (update.js wall collision, approach.js in the mouth): from the tunnel entry the ship
// carries HULL_SCRATCHES wall-only "scratches" for the WHOLE run (2026-09-19; they used to
// expire at the start of sector 3, and to start where the soft walls ended). A wall contact
// with a shield up spends the SHIELD first (user's call 2026-09-21: the hull is the ship, it
// only scratches once nothing shields it; it used to be scratches first). Without one it
// spends a scratch - bounce plus WALL_GRACE_SEC in which only the WALL is harmless (the ship is
// held off it so it cannot scrape twice). Hazards stay lethal throughout: a scratch must
// never be a way through a stalactite field, which the old full HIT_INVULN_SEC grace was
// once the scratches reached the deep run. Direct hits are for the shield coin. Measured with
// 2 scratches until score 150: runs dying within 8 points of the walls turning lethal
// 41% -> 4% (beginner tier), share reaching score 100 4% -> 40% (beginner) and 32% -> 66%
// (average, the tier real players match). A plain shield at the same moment was tried
// and rejected: it mostly helped the good tier (+72% median) by eating a stalactite later.
const HULL_SCRATCHES      = 2;
const WALL_GRACE_SEC      = 1.0;    // wall-only grace after a scratch (HIT_INVULN_SEC's length, not its reach)
// Repair kit (systems.js spawnRepairKit/updateRepairKits, 2026-09-21, user's design): every
// mine or cannon shot a bullet destroys drops a kit where it died. Flying through one gives
// back ONE scratch (capped at HULL_SCRATCHES; user's call 2026-09-21, it used to refill to
// full) and always pays REPAIR_KIT_PTS, so it is worth taking with a full hull too. No cooldown on purpose (user's call): the deep run's speed already
// makes a kit hard to reach, and scratches only ever forgive walls, never a hazard. It stays
// at its world-x (no magnet pull, no warp vacuum) and is gone if missed. Never enters
// `coins`: spawner vetoes read that array, and a kit exists only for players who shot, so it
// would fork the shared daily cave.
const REPAIR_KIT_PTS      = 5;
const REPAIR_KIT_SIZE     = 1.15;   // hit and draw size, x COIN_HIT_R / COIN_R, like the shield coin
// Hazard LENGTH pace (world.js stalLenFrac/cannonSpacing): the old 14000/40000 two-leg
// shape, starting at HAZARD_START_WX and stretched. Densities use the sector rates.
const HAZ_RAMP_WX         = 30000;
const WALLS_LIVE_HINT_RUNS = 3;     // "walls now deadly" notif on a player's first runs, as the ship enters the tunnel
const SAFE_OPEN_PAD          = H * (10 / _H_REF);   // wall sliver left at each screen edge

// Rendered wall never leaves the canvas (draw.js wall arrays, 2026-09-17). A maxed
// gapBonusVisual or a warp can push boundsAt() past y=0 / y=H, and there the screen
// edge itself is the lethal line (update.js's screen-anchored check). Until 13.0 the
// rock vanished off-canvas in those columns and a pulsing red strip marked the edge
// instead, so one continuous lethal wall switched between two looks as the wave swung
// it on and off screen, and the red strip also pulsed through warps, where the wall
// cannot kill. Now the drawn edge is clamped to this sliver: rock + edge line rest on
// the screen edge in the normal day/cyan colour. Draw-only; boundsAt() is untouched.
const WALL_EDGE_SLIVER       = Math.max(2, H * (3 / _H_REF));

// Soft walls (translucent field, dent + ring on a bump, 2026-09-13) were removed on
// 2026-09-19 with the approach (approach.js): the walls are lethal from the tunnel entry,
// and HULL_SCRATCHES covers the first mistakes instead.

// ── Blue coin "Zeitblase" (2026-09-18, draw-only) ─────────────────────────────
// The blue coin already slowed the scroll to 0.6x (world.js slowScrollFactor), sagged the
// music and drew a HUD bar - but on screen nothing else changed: particles, sparks and
// coin animations kept running at full speed, so it read as a stutter rather than as
// slow motion. Three presentation layers, all riding one eased intensity `slowFxVis`
// (state.js, 0..1, chases slowTime/slowTimeMax) so they fade out exactly with the glide
// back to normal speed, the mirror of WARP_STREAKS riding warpScrollFactor():
//  1. AMBIENT TIME - particles, thruster exhaust and coin animations run on a slowed
//     clock (`vtime`, and dt * (1 - SLOW_FX_TIME_SCALE * vis) for particles). gtime is NOT
//     touched: mines bob off gtime and collide against it, so slowing it would be a
//     gameplay change, and this pass is presentation only.
//  2. TIME RIPPLES - a one-shot double ring from the ship on pickup, then thin rings that
//     drift out around it while the effect lasts, their period shortening as it wears off.
//  3. COOL WASH - a faint ice-blue wash on the LEFT (behind the ship) only. Never ahead:
//     hazards arrive from the right (same rule as DEPTH_LIGHT_*). Never on the walls'
//     hue: cyan already means "coin bonus" there (gapBonus tint).
// No shadowBlur, no rng(), no placement decision: identical caves on every device.
const SLOW_FX_TIME_SCALE = 0.5;    // ambient clock runs at 1 - this at full intensity
const SLOW_FX_EASE       = 8;      // 1/s the intensity chases its target (no pop on pickup)
const SLOW_FX_RGB        = [140, 208, 255];
const SLOW_PULSE_SEC     = 0.75;   // pickup ring lifetime, real seconds
const SLOW_RIPPLES       = 3;      // concurrent ambient rings
const SLOW_RIPPLE_R0     = 1.5;    // ring radius at birth, x PR
const SLOW_RIPPLE_R1     = 7.0;    // ring radius at death, x PR
const SLOW_RIPPLE_HZ_MIN = 0.45;   // rings per second at full intensity
const SLOW_RIPPLE_HZ_MAX = 0.90;   // ... and as the effect runs out
const SLOW_WASH_ALPHA    = 0.11;   // left-side wash at full intensity
const SLOW_WASH_FRAC     = 0.60;   // how much of the width it covers, from the left edge

// ── Depth light: bright cave mouth, dark depths (2026-09-13) ──────────
// Through 13.0 the void behind the walls was WEEKDAY_BG at every depth, so nothing but
// the HUD number said how far into the cave a run had got. Now the background carries
// it, in two layers, both draw-only (draw.js depthLightAt, drawWorld):
// - A LIFT: WEEKDAY_BG mixed toward the day's own wallBase by DEPTH_LIFT times a level
//   that steps down at each sector boundary (DEPTH_LIGHT_STEPS, eased over
//   DEPTH_STEP_EASE_WX) and reaches plain WEEKDAY_BG at the start of S4. STEPS, not a
//   continuous fade: a fade over ~30 seconds is below what a player notices while
//   dodging spikes, a step at a sector boundary is not.
// - A MOUTH: warm daylight (DEPTH_MOUTH_WARM, tinted DEPTH_MOUTH_TINT toward the day's
//   rock so every day keeps its identity) falling in from behind the ship, off the left
//   edge, shrinking and fading out over the same S0-S4 stretch. It sits BEHIND the ship
//   on purpose: hazards arrive from the right, and that side stays as dark as it was.
// Chosen from a 4-variant study (literal light->dark was rejected: the near-white PEARL
// ship, gold coins, the white score and every additive 'lighter' glow lost most of their
// contrast exactly where beginners fly):
// https://claude.ai/code/artifact/ea963ae1-1c8b-4bf4-9587-c2f90286d666
// Deliberately capped low (DEPTH_LIFT, DEPTH_MOUTH_ALPHA) so every glow keeps dark ground
// to light up. Keyed to world-x through sectorAt/sectorStartWx, so it is identical on every
// device, and it touches no gameplay value. The title screen shows the mouth (wx = 0).
const DEPTH_LIGHT_STEPS      = [1, 0.62, 0.34, 0.14];   // lift level in S0..S3, 0 from S4
const DEPTH_LIFT             = 0.05;  // max mix of WEEKDAY_BG toward the day's wallBase (0.15 until 2026-09-19, see below)
const DEPTH_STEP_EASE_WX     = 540;   // world-px a step takes to settle (~1.3 ref s)
const DEPTH_MOUTH_ALPHA      = 0.10;  // mouth light strength at wx = 0 (0.30 until 2026-09-16, read as glaring; 0.24 until 2026-09-19)
// Darkened 2026-09-19 with the approach (approach.js): the light now comes from a city at
// DUSK behind the ship, and at 0.15 / 0.24 the tunnel just inside the mouth read as a bright
// olive hall, lighter than the sky outside. Cut to about a third / 40%; the sector steps keep their
// ratios, so the run still walks from the lit mouth into the dark.
const DEPTH_MOUTH_END_SECTOR = 4;     // the mouth is gone by the start of this sector
const DEPTH_MOUTH_WARM       = [255, 246, 228];
const DEPTH_MOUTH_TINT       = 0.60;  // how far the daylight leans toward the day's rock (was 0.35: near-white glare)
// Softened 2026-09-16 on request ("ein wenig zu grell"): the gradient centre sits well off
// the left edge (DEPTH_MOUTH_X) so its hot core is never on screen, and the falloff runs
// through DEPTH_MOUTH_STOPS instead of a 3-stop cone, so it reads as scattered light, not a
// lamp. The radius grows by the same offset so the lit reach on screen is unchanged.
const DEPTH_MOUTH_X          = -0.30; // gradient centre, as a fraction of W (was -0.08)
const DEPTH_MOUTH_STOPS      = [[0, 1], [0.25, 0.72], [0.5, 0.40], [0.72, 0.17], [0.88, 0.05], [1, 0]];

// ── Run scenes: the death screen's filmstrip (2026-09-13) ─────────────
// One small snapshot of the real frame per sector the run reached, plus the frozen death
// frame, shown on the death screen in the band that used to hold drawRunProfile (share.js
// still draws that on the card). With the depth light above, the strip reads as the run
// going from the lit mouth into the dark, and the dashed slot after the death frame names
// the next sector, which is the "how far can I get" the plain number never answered.
// Captured inside drawWorld() just before the floating notifs, so no notif, HUD, red
// death flash or panel is in the picture, and cropped around the ship (SCENE_CROP_*) so a
// frame stays readable at band height. SCENE_CAPTURE_LEAD_WX after each boundary lets the
// lift step settle and the sector's first hazards scroll into view. The death frame waits
// SCENE_DEATH_CAPTURE_SEC for the impact shake to settle (still inside DEATH_REPLAY_SEC,
// so before the panel fades in). Canvases are pooled and reused across runs; a deep run keeps S0 plus the latest
// SCENE_MAX_KEPT - 1 sectors.
const SCENE_CAPTURE_LEAD_WX   = 900;
const SCENE_DEATH_CAPTURE_SEC = 0.30;
const SCENE_CROP_X0           = 0.06;  // crop, as fractions of W
const SCENE_CROP_X1           = 0.58;
const SCENE_THUMB_H           = 0.20;  // backing height as a fraction of H (x raster scale)
const SCENE_MAX_KEPT          = 8;

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

// ── "This was a real run" floor ──────────────────────────────────────
// The one number every "was this run worth reacting to" gate in the game shares:
// the ad cadence, the rewarded continue, the referral reward, shard banking, the
// share button and the first milestone.
//
// **It became 75 on 2026-09-14; it must never drop to or below 50 again.** It was
// 25 everywhere, which stopped being a floor at all when the 12.0 safe opening
// flight shipped: no death is possible before SAFE_START_WX (both wall-collision
// paths in update.js bump instead of killing, and no hazard exists before
// HAZARD_START_WX), so **the minimum score of any completed run is now 50**.
// Every gate below that was silently passing every run, including the instant
// faceplants each one was written to exclude - an interstitial after a 1-second
// tutorial death, a 30-second rewarded-video offer on the same, a share button on
// a score of 50 the player did not earn. Note that 50 itself would be no better
// than 25 for the same reason; 75 is the first value that means "left the safe
// zone and kept flying", i.e. the first score that is evidence of anything.
//
// Any NEW score threshold has to clear 50 by construction, not by taste. When
// SAFE_START_WX moves, this moves with it.
const MIN_REAL_RUN_SCORE   = 75;

// ── Rewarded continue ────────────────────────────────────────────────
// Offered at most once per run, only past this score -- same floor as the
// interstitial's MIN_SCORE_FOR_AD (AdsManager.swift/.kt), for the same reason:
// runs below it are instant faceplants, not worth a 15-30s video either way.
const CONTINUE_MIN_SCORE   = MIN_REAL_RUN_SCORE;
const MAX_CONTINUES_PER_RUN = 1;

// ── Store rating prompt ─────────────────────────────────────────────
// Native review sheet (SKStoreReviewController on iOS, Play In-App Review on
// Android - see the "review" bridge, update.js maybeRequestReview()). Fired on a
// run that is good news (new all-time best, or today's best), the same "this was
// worth celebrating, not a nag" gate shareWorthy() (share.js) already uses.
//
// **Retuned 2026-09-14; do not put the old gate back.** It used to be
// `newBest && best > 0 && score >= CONTINUE_MIN_SCORE`, which was simultaneously
// too eager and dead:
//  - Too eager for a new player. `best` climbs on nearly every early run, so the
//    sheet landed on run #2 or #3, ~30 seconds into someone's lifetime with the
//    game. Excluding only the very first completed run (the old `hadPriorBest`)
//    is not the same as excluding "hasn't decided whether they like this yet",
//    which is exactly what Apple's and Google's own guidelines ask for.
//  - Dead for the players worth asking. Someone sitting on a best of 400 will
//    not beat it again inside REVIEW_COOLDOWN_MS, so the one cohort with a real
//    opinion never saw the sheet at all. The 2026-09-10 funnel measurement found
//    zero Google Play ratings, which is what this gate produces by construction.
// The commitment test is now `stardust`, which is already exactly "calendar days
// this player opened the game" (see the Stardust doc block) - the signal the old
// gate was reaching for and missing. It is strictly stronger than the old
// first-run exclusion, since REVIEW_MIN_STARDUST days implies returning across
// that many separate days, and it costs no new state.
const REVIEW_MIN_STARDUST = 3;
// Score floor. Deliberately its own number and stricter than the shared
// MIN_REAL_RUN_SCORE above: a rating prompt is the single most expensive thing
// the game can spend a player's goodwill on, so it asks for more than "this was
// a real run". 100 is ~50 points of real flight past the safe zone, comfortably
// inside sector S1, and still well under the median good run.
const REVIEW_MIN_SCORE = 100;
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
const DEATH_INTERACTIVE_SEC = 1.1;   // 0.9 until 2026-09-19: +0.2s to fit the 0.70s freeze frame
// How long the crash itself stays on screen before the death panel starts fading in
// (draw.js drawDeathScreen/drawContinueOffer). The world is already frozen the moment
// phase flips to 'dead' (update.js's dead branch advances nothing but deadT), so this
// costs no simulation -- it only stops the panel from painting over the one frame that
// explains the run. Before 12.0 the panel reached full opacity at deadT ~0.15s and the
// ship was drawn for 0.18s, so the player never actually saw what killed them: a
// red-team audit measured a beginner's whole run at 0.9s of flight and found the death
// screen's only message was the word "dead" and a number. deathCause has existed since
// the death-marker work but was never shown to anyone.
// Deliberately NOT added to DEATH_INTERACTIVE_SEC: this beat sits INSIDE the existing
// unskippable window (0.70 + 0.15s fade = 0.85 < 0.95, when the buttons start to show), so restarting costs exactly the same wait and the
// same one tap it did before. CONTINUE_OFFER_SEC is the one thing that does get this
// added back (update.js), because that budget is measured in *visible* offer time.
const DEATH_REPLAY_SEC = 0.70;   // 0.40 until 2026-09-19, then 0.70 on request

// ── HUD instrument (2026-09-16 design pass, proposals 3 + 4) ─────────────
// A coin that pays points sends a spark from where it was collected to the live score;
// the score "swallows" it on arrival (a short scale + gold tint). Purely presentational:
// bonusScore is credited at pickup exactly as before, the spark only illustrates where
// the points went. HUD_SPARK_SEC is the flight time, HUD_BUMP_SEC the swallow pulse.
// HUD_SPARK_MAX caps the live array - a warp vacuums every gold coin on screen at once.
const HUD_SPARK_SEC = 0.38;
const HUD_BUMP_SEC  = 0.22;
const HUD_SPARK_MAX = 14;
// Spark colour per coin type, matched to each type's pickup notif colour (systems.js).
const HUD_SPARK_COLOR = {
    gold: [255, 214, 70], blue: [60, 210, 255], red: [190, 60, 255],
    green: [80, 255, 130], orange: [255, 122, 0], bomb: [255, 90, 90],
    repair: [255, 190, 120],   // the HUD hull row's colour (draw.js), where the refill lands
};
// Points for a bullet hit (systems.js updateBullets). Flat, no combo: ammo is capped and
// bullets auto-fire, so this is a small bonus for a shot that landed, not a score engine.
const BULLET_HIT_PTS = { stal: 1, mine: 3, shot: 2 };
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
const CONTINUE_OFFER_SEC = 2.8;   // 3.0 until 2026-09-19, -0.2s on request
// ── Web: the second life lives in the app (2026-09-19) ───────────────
// The rewarded continue is an APP feature: it is paid for by a rewarded video, and the
// web build has no ad network behind it (ads-web.js still ships a placeholder Ad Manager
// network code, and AdSense rejected flytunl.ch - see the project_web_ads_google_admanager
// memory). Until now that just meant `rewardedAdReady` stayed false forever on web and the
// offer never appeared at all: the one moment in the whole game where a player most wants
// something the app has - the instant their run ended - said nothing.
//
// So on web the offer slot is kept and its CONTENT is swapped: the ring says "second life
// - in the app", and tapping it opens drawWebContinuePromo() instead of a video. That
// screen occupies exactly the slot the rewarded ad occupies in the apps, and lasts
// WEB_CONTINUE_PROMO_SEC, the length of a rewarded video.
//
// Three rules, each load-bearing:
//  - It never grants a revive. The pitch IS that the second life is app-only, and a web
//    player who got one for free would both hear the opposite and carry an advantage
//    into the shared daily leaderboard that app players have to watch an ad for.
//  - The offer's own caption is honest BEFORE the tap (i18n secondLifeApp, not
//    watchAdContinue), so nothing here is a bait-and-switch: a player taps because they
//    want the app, not because they were promised a life and handed a billboard.
//  - It is dismissible from WEB_PROMO_DISMISS_SEC on, exactly like a rewarded video's
//    skip button. The full duration is the ceiling, not a toll.
// isWeb()-gated end to end (CLAUDE.md's standing web/app isolation rule): in both apps
// `rewardedAdReady` decides as it always did and none of this code runs.
const WEB_CONTINUE_PROMO_SEC = 15;   // a rewarded video's own length
const WEB_PROMO_DISMISS_SEC  = 2.5;  // before this, a tap can't close it (an ad's skip gate)
// The two store links the promo offers. Written here rather than in draw.js because
// share.js's SHARE_URL sets the precedent: one place per outbound URL in this repo.
const APP_STORE_URL  = 'https://apps.apple.com/app/id6789721765';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.theodoracatos.tunl';
// Revive countdown (update.js grantRevive()/phase==='revive' branch): once the
// reward lands, the world freezes with the ship parked at the recentered spot for
// this long, showing a localized "READY" flash (T.ready, draw.js
// drawReviveCountdown), before play actually resumes. Not just a beat for the
// player to reorient after tapping through an ad -- HIT_INVULN_SEC only starts
// counting down once play resumes (not during this freeze, where nothing can hit
// the player anyway since scrollX isn't advancing), so this freeze is free grace
// time, not time subtracted from the invulnerability window after it.
const REVIVE_COUNTDOWN_SEC = 1.2;
// Interruption pause (input.js pauseForInterrupt, 2026-09-19 review U2). A notification pull,
// a call or an app switch mid-run used to resume the run the instant the page came back,
// with input still suppressed for INPUT_RESUME_GRACE_MS - the ship fell while the finger
// could do nothing. Now the run freezes in the revive phase and restarts through the same
// REVIVE_COUNTDOWN_SEC, but (a) with NO grace window afterwards, or backgrounding the app
// would be a free invulnerability button, and (b) with the screen covered while away and
// for all but the last PAUSE_REVEAL_SEC of the countdown. The cover is the fairness half:
// a pause that shows the cave ahead is free thinking time on a shared daily leaderboard,
// the same reason DEV_PAUSE_KEY ships false.
const PAUSE_REVEAL_SEC = 0.6;

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

// ── Power-up supply floors (systems.js makeCoin) ─────────────────────
// Minimum real seconds between two coins of the same power-up type. Added
// 2026-09-11 after a measured replay audit found every capped power-up sitting
// permanently at its ceiling once a run got deep: from score 233 on the shield
// stack was full 87-100% of the time, ammo sat at 10/10, and slow-time was active
// 38-85% of the run. The DURATIONS were never the problem (4s per blue coin, 3s per
// magnet are short); the SUPPLY was - the weighted roll in makeCoin has no notion of
// real time, so as coinSpacing() tightens and scrollSpd() climbs, every type's
// coins-per-second climbs with them, and a stack that can only be spent by getting
// hit refills faster than any player can drain it.
//
// Two deliberate choices about how this is enforced:
//  - A rejected power-up coin is SKIPPED ENTIRELY (makeCoin returns null), not
//    downgraded to gold. Downgrading would hand the whole suppressed share to gold
//    and re-break the corridor bonus this same pass is fixing (see GAP_DECAY_FRAC).
//  - The floor SCALES IN with depth (POWERUP_GAP_EARLY_MULT below), so it is a
//    no-op for the whole stretch real players actually fly. The measured natural
//    gaps at score 100-233 are 4.3s (red) and ~6.7s (blue/orange/green) against
//    early floors of ~2.5-3.6s - the early game must not get HARDER, since that
//    band is where runs actually end. It binds from score ~300 on, where the audit
//    found the oversupply.
//
// These are FLOORS, not the resulting cadence. After a floor elapses the type still
// has to win the weighted roll, so the real interval is the floor plus the expected
// wait for that roll: ~4-6s deep, per type share. The values below are picked so the
// measured deep intervals land near 13s (blue/red) and 15s (green) - pick a floor by
// subtracting that wait from the cadence you actually want, and re-measure rather
// than reading the number here as the answer.
//
// ORANGE IS DELIBERATELY ABSENT. Ammo looked pinned at 10/10 in the first pass of
// the audit, but that was a modelling error: bullets AUTO-FIRE every 0.32s while
// ammo > 0 (systems.js updateBullets), so a 5-shot pickup empties itself in 1.6s and
// there is no stock to pin. Measured with firing modelled, the player is armed only
// 2-9% of the run at every depth - orange is the rarest state in the game, not the
// most oversupplied, and a floor on it would only make a scarce thing scarcer.
const POWERUP_MIN_GAP_SEC = { blue: 8, red: 9, green: 8 };
// Minimum real seconds between two chicane gold coins (systems.js
// maintainStalactites). Same "cadence in seconds, not pixels" reasoning as the
// floors above - see the full argument at the call site and in the GAP_DECAY_FRAC doc.
// Flat at every depth since 2026-09-13. It used to be scaled by a 0.45 early multiplier
// so it stayed a no-op below score ~233, where chicanes then began; chicanes now only
// start at CHICANE_START_WX (~score 300), where that multiplier just let nearly every
// new chicane drop a free centreline coin (measured 5.1/10s at score 300-500).
const CHICANE_GOLD_GAP_SEC = 2.2;
// Multiplier on POWERUP_MIN_GAP_SEC at/below the _prog2 ramp start, lerped to 1.0 by
// _prog2 = 1 (score ~900). See the "no-op early" argument in the doc block above.
const POWERUP_GAP_EARLY_MULT = 0.30;

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
const HOLD_GATE_MAX_SEC = 2.55;   // 2.25 until 2026-09-19, +0.3s on request

// Launch ramp (update.js): the run opens with the ship flying up into frame from below
// and levelling out, with py/vy/shipPitch driven by the ramp rather than by the player.
// Held at 1.3s through 11.0. Cut to 0.5s in 12.0 after a red-team audit measured what
// that actually costs the audience the onboarding is FOR: a beginner's median run is
// 1.0s of flight, so the ramp was longer than the game, and only 31% of a new player's
// death-to-death loop was time they could act in (1.3s ramp + 1.0s flight + 0.9s
// DEATH_INTERACTIVE_SEC). Strong players are unaffected either way -- at a 17.7s median
// run the ramp is noise -- so this is purely a first-minutes fix.
// Restored to 1.3s on 2026-09-13 on explicit request: the longer launch animation looked
// better, and that was judged worth the lower interactive share for beginners. Don't cut
// it again without asking.
// Keep it a named constant: the ramp also gates scrollX (the lf*lf term below it) and
// is the window the boot audio plays under, so a future change wants one place to edit.
const START_RAMP_SEC = 1.3;

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

// ── The streak week crate and the rest day (2026-09-22) ──────────────
// The +1 bonus above was the streak's only payout, and a 2026-09-22 audit found it
// invisible twice over: nothing on screen ever showed `streak` at all, and the bonus
// itself only moves a player who is ALREADY stardust-bound. At the ~80 shards/day a
// real player banks, shards bind up to CRIMSON and the gates bind from ELECTRIC on,
// so for most of the roster an extra ✦ buys nothing. A streak reward that the average
// player can feel has to be paid in the currency that actually binds them (shards) or
// in something that is not on the ladder at all (paint).
//
// STREAK_WEEK_SHARDS is granted with the bonus ✦ on every STARDUST_STREAK_BONUS_DAY-th
// unbroken day. Exempt from DAILY_SHARD_CAP for the same reason SHARDS_AD_REWARD and
// REFERRAL_REWARD are: bounded and un-grindable (one payout per seven calendar days,
// no amount of skill or playtime brings the next one closer). Half a mission's worth
// of a day's cap, ~+7% on top of ~80/day, which moves the pure-shard path to the last
// ship by a couple of weeks while every `stardustGate` above stays exactly where it
// was - the gates still bind at every tier, which is the invariant the ladder is set
// against (see SKINS below and docs/agents/economy.md).
const STREAK_WEEK_SHARDS = 40;

// A missed day used to reset `streak` to 1 outright. One banked rest day per completed
// week (never more than STREAK_GRACE_MAX) absorbs a single missed day instead: the
// streak carries on, the missed day still grants no stardust, and the bank is spent.
// Two missed days in a row still reset it. This is the same "tax, never zero out"
// philosophy the stardust bank itself follows (a missed day never takes ✦ away) and
// what keeps the streak from becoming the anxiety mechanic the block above rejects -
// it protects the one-off missed evening, not a habit of skipping.
const STREAK_GRACE_MAX = 1;

// From this streak on, the 19:00 reminder (src/notify.js) swaps one of its three text
// variants for the streak line. Below it there is no streak worth naming - a player on
// day 1 or 2 has nothing to continue, and a nudge that invents one reads as pressure.
const NOTIF_STREAK_MIN = 3;

// How long the arrival card (draw.js, title screen) reports the day's grant. Long
// enough to read three short lines, short enough that it is gone before a player who
// opened the app to fly is annoyed by it - it never blocks a tap, the run starts
// through it.
const DAY_GRANT_SEC = 4.5;

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
    // 175 was higher than any score any player has ever recorded: the D1 daily
    // leaderboard (tunl_scores, checked 2026-09-11) holds 28 player-days with a
    // median daily best of 70 and an all-time high of 169. bestScore is a daily MAX,
    // not a sum, so playing more runs barely helps - it was simply unwinnable. 150
    // keeps it firmly aspirational (above ~95% of recorded player-days) while being
    // a score that has actually been reached. Re-check against the live leaderboard
    // before moving it again; the other coin-count targets in this table have the
    // same problem and are NOT fixed here, because the right value for those depends
    // on runs-per-day, which nothing currently measures.
    { id: 'score',    stat: 'bestScore',  target: 150, tier: 2 },
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
//   AMBER    (systems.js coin pickup, update.js cPR)       +15% coin reach   / +10% hitbox
//   CRIMSON  (update.js cPR, systems.js shield pickup)      -22% hitbox      / shield cap -1
//   ELECTRIC (systems.js blue coin, systems.js combo timer) +50% slow time   / -5% combo window
//   TOXIC    (systems.js gold coin, update.js gap decay)    2x coin bonus    / +30% decay rate
//   VOID     (systems.js shield pickup, update.js near-miss) every 3rd red = 2 shields (was: cap +1, near-inert) / -25% near-miss window
//   NOVA     (systems.js green coin, systems.js ammo pickup) +67% magnet per coin (was: cap-only, near-inert) / -40% ammo capacity
// Re-tuned 2026-09-16 (ship audit, replay-harness measured across 4 skill tiers x
// 360 runs/config): AMBER's reach buff (+50%) scaled far harder than its own hitbox
// drawback, so the cheapest ship (240 shards) measured +17-40% score over PEARL at
// every tier - strictly the best ship in the game. VOID's shield-cap+1 and NOVA's
// magnet-cap-only buffs measured ~0% at every tier: the shield/magnet economy
// almost never fills either cap, so the buff was cosmetic text with no real effect
// (see the drawback-side doc above each's masteryLerp call site for how that was
// found). CRIMSON/SOLARIS's hitbox shrinks were too small at mastery 0 to move the
// score outside noise. ELECTRIC and TOXIC's DRAWBACKS were oversized relative to
// their buffs (ELECTRIC measured net NEGATIVE at good/expert tier - a worse-than-
// PEARL ship at a real shard cost). Full write-up + the paired-run methodology:
// see project memory 'ship_balance_audit_2026-09-16'.
// PEARL stays the neutral baseline with no perk/drawback, just cosmetic FX. Values above
// are the level-0 (unmastered) numbers -- flying a ship grows its buff and heals its
// drawback further per masteryLerp() below, see that call site in each file for the
// level-3 endpoint of every stat.
//   SOLARIS  (update.js near-miss, update.js cPR)           +100% near-miss range / +6% hitbox
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

// Hangar paint shop, the Lackiererei (2026-09-22; replaced the six fixed LIVERIES of
// 2026-09-17, which the user called "langweilig, nicht abwechslungsreich": they could only
// lighten or darken the ship's own hue, so every finish read as the same ship). A paint job
// is a KIT of five slots, each bought once for the hangar and combined freely per ship:
//   c  - PAINT_COLORS, the hull colour (index 0 FACTORY = the ship's own colour)
//   p  - PAINT_PATTERNS, one big-mass pattern (index 0 = plain)
//   pc - PAINT_COLORS again, the pattern's colour (index 0 = an automatic contrast shade)
//   m  - PAINT_MATERIALS, how the paint takes light (index 0 GLOSS = the factory shading)
//   fx - PAINT_EFFECTS, a paint that reacts to the flight (index 0 = none)
// The hull colour may now change the hue. The ship's identity lives in its LIGHT instead:
// glow, nozzles, intake rings, running lights and wingtip strobes always stay in SKINS[]
// .shadow, whatever the paint, so a red PEARL still reads as PEARL. Purely visual - no perk,
// hitbox, placement or leaderboard effect; the ghost and the wreck always fly FACTORY.
// `cost` in shards (no cost = free); `earn` parts cannot be bought: 'best' = all-time best
// score >= need, 'worlds' = weekday worlds flown >= need, 'days' = stardust >= need (stardust
// only ever grows, one per day played), 'streak' = bestStreak >= need (the longest streak ever
// reached, so an earned paint is never taken back). Names are proper nouns, untranslated,
// like ship names.
// Prices sit against the ~80 shards/day a real player banks: the full kit (7870) is ~98 days
// of income, where the old set (1240) was done in ~15. Old finishes migrate in state.js
// (PAINT_LEGACY). drawShip()/drawShip3D() in draw.js render it; see docs/agents/economy.md.
const PAINT_COLORS = [
    { name: 'FACTORY'                                               },
    { name: 'GRAPHITE',  rgb: [ 46,  50,  60]                       },
    { name: 'ARCTIC',    rgb: [226, 232, 240], cost: 60             },
    { name: 'MIDNIGHT',  rgb: [ 26,  40,  96], cost: 60             },
    { name: 'RACING',    rgb: [200,  24,  38], cost: 60             },
    { name: 'OLIVE',     rgb: [ 96, 110,  56], cost: 60             },
    { name: 'SAND',      rgb: [210, 184, 134], cost: 60             },
    { name: 'PETROL',    rgb: [ 18, 110, 118], cost: 60             },
    { name: 'BORDEAUX',  rgb: [104,  20,  44], cost: 60             },
    { name: 'TITAN',     rgb: [142, 148, 160], cost: 60             },
    { name: 'GOLD',      rgb: [228, 178,  58], earn: 'best', need: 500 },
    // The two streak paints (2026-09-22). Earned from `bestStreak`, the longest run of
    // consecutive days ever reached, never the current one: a paint the player can lose
    // again by missing a Tuesday would be a punishment, and the hangar has no other
    // part that can be taken back. Read live like every other earned part.
    { name: 'COMET',     rgb: [170, 226, 255], earn: 'streak', need: 14 },
    { name: 'ECLIPSE',   rgb: [ 32,  26,  58], earn: 'streak', need: 30 },
];
const PAINT_PATTERNS = [
    { name: ''                                     },
    { name: 'SPLIT',    cost: 100                  },
    { name: 'STRIPE',   cost: 100                  },
    { name: 'CHEVRON',  cost: 140                  },
    { name: 'WINGTIPS', cost: 140                  },
    { name: 'FLAMES',   cost: 180                  },
    { name: 'TIGER',    cost: 180                  },
    { name: 'ROUNDEL',  cost: 240                  },
    { name: 'SUNBURST', cost: 240                  },
    { name: 'ORBIT',    earn: 'worlds', need: 7    },
];
const PAINT_MATERIALS = [
    { name: 'GLOSS'                              },
    { name: 'STEALTH',  cost: 120                },
    { name: 'METALLIC', cost: 200                },
    { name: 'CANDY',    cost: 260                },
    { name: 'NACRE',    cost: 340                },
    { name: 'CHROME',   cost: 400                },
    { name: 'DIAMOND',  earn: 'days', need: 30   },
];
const PAINT_EFFECTS = [
    { name: ''                       },
    { name: 'EMBER',     cost: 700   },   // hull glows hot while thrusting
    { name: 'PULSE',     cost: 800   },   // a wave in the last coin's colour
    { name: 'AURORA',    cost: 950   },   // polar curtains, swayed by the roll
    { name: 'NEBULA',    cost: 1100  },   // the hull as a window onto a drifting nebula
    { name: 'FIRESTORM', cost: 1200  },   // flames grow toward the record, blaze ON FIRE
];
// Slot -> catalogue, in the Paint sheet's tab order.
const PAINT_SLOTS = [
    { key: 'c',  list: PAINT_COLORS    },
    { key: 'p',  list: PAINT_PATTERNS  },
    { key: 'pc', list: PAINT_COLORS    },
    { key: 'm',  list: PAINT_MATERIALS },
    { key: 'fx', list: PAINT_EFFECTS   },
];
// The 2026-09-17 finishes (old bitmask bit i = index i here) and the kit each becomes:
// owners get those parts free and a ship that wore one keeps the look.
const PAINT_LEGACY = [
    null,                        // FACTORY
    { m: 1 },                    // STEALTH
    { p: 2 },                    // STRIPE
    { p: 1 },                    // SPLIT
    { m: 5 },                    // CHROME
    { fx: 3 },                   // AURORA
];
const LIVERY_GATE_SKIN = 1;
