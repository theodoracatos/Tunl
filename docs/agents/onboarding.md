# Approach and onboarding

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the measurements and rejected alternatives behind them are in `docs/design-history.md` (the 2026-09-21 condensing moved the removed paragraphs there verbatim, under "Narratives moved out of docs/agents").

## Approach over the city ("Anflug", 2026-09-19)

`src/approach.js` (doc block at its top). Every run opens over the day's metropolis at dusk
and flies through a rock mouth into the safe opening flight; the title screen IS that city.
`APPROACH_SEC` = `START_RAMP_SEC` + a fixed lead (user's call: the start is the same every
time, PLAY AGAIN included). If shortened, keep it above ~2.3s or the ship launches through
the mountain foot. "ENTERING THE TUNL" (`T.entering`) shows over the city; the world banner
starts once the mouth has passed mid-screen, the score waits for the cave. Concept: https://claude.ai/artifact/ECrpmHcPeTsREMwEtK6vNs
- **The city lies before world-x 0, never in it.** `scrollX` stays 0; only `approachLeft`
  (a camera offset) moves, and `drawWorld()` draws the cave translated + clipped by it.
  `update.js` returns right after the physics while `approachLeft > 0`, so no clock, hazard,
  score, flight-time achievement or ghost step runs early. Score, sectors and `test-cave.js`
  are untouched. Don't turn the city into world-x: every score and threshold would shift.
- **No parallax behind a wall** (see "No parallax background"): the skyline exists only left of
  the mountain, and the cave's own void shows through the mouth (`APPROACH_BLEND`).
- **The mouth is the same rock as the cave** (wall colour, stone pattern, day-coloured edge),
  solid all the way into the cave's lethal walls.
- **No soft walls ("keine Gummiwände mehr").** Over the city the mountain face and screen
  edges only bounce the ship; from the mouth on (`approachUpdate`) the tunnel rule applies:
  a wall contact spends a hull scratch, with none left it kills. The soft-wall layer is
  deleted - don't bring it back. Near-miss, the red danger flash and the "walls now deadly"
  hint start at the tunnel entry.
- **The tunnel start stays dark** (`DEPTH_LIFT`, `DEPTH_MOUTH_ALPHA` lowered with the
  approach): after a city at dusk, the old values made the cave lighter than the sky outside.
- **Polish pass (2026-09-24, concept https://claude.ai/artifact/3hPEAaUYSY1YKDHWBbnxQa)**,
  all in `approach.js`, all draw-only, none of it touches duration, score or `rng()`:
  lit windows on the two far layers (`APPROACH_WIN_*`; the level starts at the title's value
  and rises to the mouth, so the tap never pops; the hash is position+day, not `r()`, so the
  skyline is unchanged), wind streaks in the sky only (`APPROACH_STREAK_*`; the sky clip ends
  at the mouth, so nothing moves behind a wall) and the lip light (`APPROACH_LIP_*`: a
  brighter edge line in two alpha steps on the rock lip, the void stays dark; the wide
  translucent band inside the rock was removed 2026-09-29 - it read as a milky glowing tube
  with blobs along the lower lip. Don't bring it back). **Rejected in the audit, don't redo:**
  light lying in the void ahead of the ship, a zoom into the mouth, a black pulse at entry
  (the first deadly metre must stay readable), gate brackets on the lethal edge, a letter-by-
  letter banner (breaks Arabic/Hindi shaping), a sinusoidal thump for the audio hit (reads as
  a timpani, see `audio.md`).
- **Approach wind** (same day, audio side; rules in `audio.md` "Approach wind"): open over the
  city, cut where the ship passes the mouth - the same line as the lethal-wall rule in
  `approachUpdate()`. `approachStart()` predicts that moment for the swell; `test-sim.js`
  checks the prediction against the real crossing at three screen sizes.
- Device check 2026-09-24: look and wind approved by the user on the device, as shipped.
- **Banner glint + height (2026-09-29, concept https://claude.ai/artifact/McF51Sm8vrD6rSYxT3Mv7r)**:
  `T.entering` starts a shade darker and one bright band (`APPROACH_GLINT_*`) sweeps across
  it once, as a gradient fill of the whole string - never per letter (Arabic/Hindi shaping).
  It sits at `APPROACH_BANNER_Y`, above the old slot, which on the web's short canvas sat on
  the "HOLD TO FLY" hint that shows at the same time. All targets, no `isWeb()` gate (user's
  pick). Not picked from the same concept: side rules ("wings"), a dateline, a chamfered plate.
  The band pass has **no shadow**: on WebKit it drew a ghost copy of the line below the banner
  (see `visuals.md`); the glow comes from the first, solid pass only.
- **Banner leaves early (2026-09-29, user's call)**: it no longer stays until the cave
  arrives; it holds `APPROACH_BANNER_HOLD_SEC` from its fade-in start (glint plus about a
  second to read) and fades over `APPROACH_BANNER_OUT_SEC`. Keep the hold longer than the
  glint (`APPROACH_GLINT_DELAY + APPROACH_GLINT_SEC`). All targets, no `isWeb()` gate.
- **World banner over the mouth (2026-09-29, user's call)**: "WORLD n: Name" starts in
  `approachStep()` once the mouth has passed mid-screen (`approachLeft - APPROACH_LIP <= W/2`),
  about when `T.entering` finishes fading, not when world-x 0 reaches the left edge. It is
  drawn by `drawWorldIntro()` in both HUD branches; the approach has no HUD stack, so the
  banner glides to its in-cave slot when the stack appears rather than jumping.
- **World banner scan line (2026-09-29, variant E of
  https://claude.ai/artifact/UikWNMwTEQ4N53oqRskeam, pick left to Claude)**: a thin line in the
  day's colour draws out, the title unfolds up out of it and the planet line down; at the end
  both fold back and the line retracts (`WORLD_INTRO_*` in draw.js, all inside
  `LEVEL_INTRO_DUR`). Clip rects over the whole string only. Not picked: B rise, C light edge
  (repeats the entering glint a second earlier), D focus, F signal flicker (every run).
- Not done yet: optional extras from the concept (aircraft lights, haze bands, a stepped
  banner) and the S0 debriefing scene showing the mouth.

## Onboarding

**The first ~50 points of every run are an open, hazard-free flight** (beginner feedback
"too hard, frustrating, deleted it"; `SAFE_START_WX` doc block in `constants.js`,
`safeOpenAt()` in `world.js`). Until `SAFE_START_WX` the corridor is pushed out to the
screen edges (`boundsAt()` only, never `boundsBase()`), easing shut at the end. **No
stalactites, mines, boulders or cannon fire** until `HAZARD_START_WX`; boulders and cannons
only from their sectors. Coins and the warp portal still appear. **Walls are lethal from the
tunnel entry**; two hull scratches cover the first mistakes. The "walls now deadly" notif
fires on a player's first `WALLS_LIVE_HINT_RUNS` runs. Every run counts normally. It waits
for the world banner to fold away (`levelIntroT <= 0`): rising from above the ship, it crossed
the planet line (2026-09-29). `test-sim.js` checks both.

Fair by construction (fixed world-px offsets; `test-cave.js` mirrors the start cursors).
Consequence: every score starts with ~50 nearly-free points - leaderboard audit numbers
from before 2026-09-13 predate this.

**The launch ramp** (`START_RAMP_SEC`, applied in `update.js`) is time the player cannot act
in (`py`/`vy`/`shipPitch` driven by the ramp). It was cut once for beginners' interactive
share, then **restored on the user's explicit request** because the longer launch looked
better. **Don't cut it again without asking.**

On top of that, **every run opens with a level glide**: gravity is withheld until the first
press or `HOLD_GATE_MAX_SEC`. Applies to PLAY AGAIN too - `input.js` does not pre-set
`holding`/`hasHeldThisRun` on the restart tap, so a restart opens like a fresh start.

**The opening coins teach RELEASE** (`ONBOARD_ARC_WX` / `ONBOARD_ARC_FRAC`, applied in
`makeCoin()`). A player who just presses and holds hits the ceiling in under half a second,
so over the opening stretch the coin line is forced onto an arc that starts **below** the
launch line (take it by letting go) and rises for the second coin (take it by holding).
Amplitude tapers to 0 by `ONBOARD_ARC_WX`. `rng()` is consumed either way, so coin types and
the seeded stream are unchanged - only y positions move.

**The tap tutor (2026-09-29, user's call, "so eine Art mini Tutorial")**: while the all-time
best is below `TUTOR_BEST_MAX` (the beginner band of "never make score < 233 harder"; it was
`MIN_REAL_RUN_SCORE` for the first evening, user: "unter 233 ist man ja noch schlecht"), a tap circle by the ship shows when to tap so the ship
flies the opening's route, from the end of the launch ramp over the city until the ship passes
`SAFE_START_WX`. Only the player's own tap moves the ship (a press is a hop, see physics.md
"Tap = hop"). Code: approach.js "Tap tutor", `TUTOR_*` in constants.js. Picks from
https://claude.ai/artifact/VVhDdo7T4gCd4HmEqDYECQ (db `picks`), all six recommendations.
- **The planner is the real physics run forward** (`tutorPlan()`): a tap is due when a hop
  started now would top out on the route instead of above it. Recomputed every frame from the
  ship's state, so a missed or extra tap needs no special case. Route (`tutorRouteY()`): the
  mouth's centre over the city, then straight lines through the good coins (the RELEASE arc
  below), kept `PR * 2.2` off the walls.
- **A late tap slows time** to `TUTOR_SLOW_SCALE` (the whole update step, via `tutorStep()`),
  only after the player's first tap of the run; before it the gravity gate glides the ship and
  the circle presses on `TUTOR_DEMO_PERIOD`. The score is world-x, so slow motion changes nothing
  on the leaderboard.
- **The circle is the iPhone touch button** (user: "so dieser typische iPhone Knopf Kreis",
  after a pointing finger read as a white tombstone): a white dot in two translucent rings,
  neutral white like the system's own. It brightens over `TUTOR_LEAD_SEC` and presses in
  (shrinks, glows) while a tap is due; a tap sends a ring out, a tap on the beat draws a check
  mark above the ship (no new string).
- **Draw and time only**: no `rng()`, no placement. The circle replaces the idle "TAP TO FLY"
  words while it shows.
- **The city waits (2026-09-30)**: on a tutor run the approach holds over the city after the
  launch ramp until the first press (`tutorWaiting()`; only `approachUpdate()` may hold, the
  ramp's last frame already reads `startRamp` 1). The ship hovers level because the gravity gate
  (`HOLD_GATE_MAX_SEC`) stays shut while it waits, and the idle "TAP TO FLY" words show beside
  the circle. The first press eases the camera in from a standstill (`_approachGoT`); the wind's
  swell is frozen during the hold (`approachWindHold`) and re-aimed at the mouth on release
  (`approachWindRetime(_tutorMouthSec())`). Why: /tt/ first runs (tt_0110, 48 players) - 35%
  never pressed at all; the gate ran out over the city and they sank into the mouth at score 5.
  The city is before world-x 0, so nothing on the board moves while it waits. `test-sim.js`
  "Tap tutor" checks the 12 s hold, the release and the retimed swell.
- **The music waits too (2026-09-30, user: "die ersten 3 Sekunden der Hintergrundmusik immer
  repetieren ... nahtloser Übergang")**: while the city waits the play track loops its own intro
  (`bgmIntroHold`, `BGM_INTRO_LOOP` in `audio.js`: the two-bar swell before Nebula's first
  downbeat), and the first press only lifts the loop, so the track runs on into its beat without a
  cut. The circle presses on the track's half notes meanwhile (`bgmIntroBeatIn`,
  `TUTOR_DEMO_PERIOD` = the half note). A candidates page with four generated hold musics
  (https://claude.ai/artifact/NharAWyrz679j6xPLXgyaK) was superseded by this idea of the user's.
- **Practice flight over the city (2026-09-30, user: "Kadenz des Tippens beibringen ... erst den
  Tunnel bringen wenn man es einigermassen im Griff hat")**: after the first press the camera flies
  over the city while `approachLeft` holds (`tutorPracticing()`, `tutorPracticeMove()`; the mountain
  is first pushed out of view). A row of light beads (`TUTOR_BEAD_*`) shows the line: flat first
  (the hover cadence), then waves; the planner's route follows it, so the circle keeps the beat.
  A bead passed within `TUTOR_BEAD_TOL` lights. The tunnel comes once `TUTOR_PASS_NEED` of the
  last `TUTOR_PASS_OF` are lit (at least `TUTOR_PASS_MIN`), or after `TUTOR_PRACTICE_MAX_SEC`
  either way; the wind stays held and `_tutorPracEnd()` re-aims it. Every tutor run gets it (a
  good player is through in about the old approach time). User's picks: every tutor run, 30 s cap.
  No sound for a lit bead yet (would need an offline-render pass, see `audio.md`).
- `test-sim.js` "Tap tutor": a pilot that taps only when the circle says so flies the opening to
  `SAFE_START_WX` with no wall touch (29 taps, ~15 px mean off the route at H 440).

**Do not re-add a title-screen control hint.** A "HOLD to climb / RELEASE to fall" line was
removed the same day it shipped: redundant next to HOLD TO FLY, crowded the row below, and
the attract ship flies through that line. The runway teaches it by feel. The `T.hold`
string is deleted from all locales - don't reintroduce it.

