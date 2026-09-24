# Approach and onboarding

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the measurements and rejected alternatives behind them are in `docs/design-history.md` (the 2026-09-21 condensing moved the removed paragraphs there verbatim, under "Narratives moved out of docs/agents").

## Approach over the city ("Anflug", 2026-09-19)

`src/approach.js` (doc block at its top). Every run opens over the day's metropolis at dusk
and flies through a rock mouth into the safe opening flight; the title screen IS that city.
`APPROACH_SEC` = `START_RAMP_SEC` + a fixed lead (user's call: the start is the same every
time, PLAY AGAIN included). If shortened, keep it above ~2.3s or the ship launches through
the mountain foot. "ENTERING THE TUNL" (`T.entering`) shows over the city; the world banner
and score wait for the cave. Concept: https://claude.ai/artifact/ECrpmHcPeTsREMwEtK6vNs
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
  at the mouth, so nothing moves behind a wall) and the lip light (`APPROACH_LIP_*`: three
  alpha steps on the rock lip, the void stays dark). **Rejected in the audit, don't redo:**
  light lying in the void ahead of the ship, a zoom into the mouth, a black pulse at entry
  (the first deadly metre must stay readable), gate brackets on the lethal edge, a letter-by-
  letter banner (breaks Arabic/Hindi shaping), a sinusoidal thump for the audio hit (reads as
  a timpani, see `audio.md`).
- **Approach wind** (same day, audio side; rules in `audio.md` "Approach wind"): open over the
  city, cut where the ship passes the mouth - the same line as the lethal-wall rule in
  `approachUpdate()`. `approachStart()` predicts that moment for the swell; `test-sim.js`
  checks the prediction against the real crossing at three screen sizes.
- Not done yet: a device ear-check of the wind, optional extras from the concept (aircraft
  lights, haze bands, a stepped banner), the S0 debriefing scene showing the mouth, and a
  device pass (WebKit, 812x375).

## Onboarding

**The first ~50 points of every run are an open, hazard-free flight** (beginner feedback
"too hard, frustrating, deleted it"; `SAFE_START_WX` doc block in `constants.js`,
`safeOpenAt()` in `world.js`). Until `SAFE_START_WX` the corridor is pushed out to the
screen edges (`boundsAt()` only, never `boundsBase()`), easing shut at the end. **No
stalactites, mines, boulders or cannon fire** until `HAZARD_START_WX`; boulders and cannons
only from their sectors. Coins and the warp portal still appear. **Walls are lethal from the
tunnel entry**; two hull scratches cover the first mistakes. The "walls now deadly" notif
fires on a player's first `WALLS_LIVE_HINT_RUNS` runs. Every run counts normally.

Fair by construction (fixed world-px offsets; `test-cave.js` mirrors the start cursors).
Consequence: every score starts with ~50 nearly-free points - leaderboard audit numbers
from before 2026-09-13 predate this.

**The launch ramp** (`START_RAMP_SEC`, applied in `update.js`) is time the player cannot act
in (`py`/`vy`/`shipPitch` driven by the ramp). It was cut once for beginners' interactive
share, then **restored on the user's explicit request** because the longer launch looked
better. **Don't cut it again without asking.**

On top of that, **every run opens with a level glide**: gravity is withheld until the first
hold or `HOLD_GATE_MAX_SEC`. Applies to PLAY AGAIN too - `input.js` does not pre-set
`holding`/`hasHeldThisRun` on the restart tap, so a restart opens like a fresh start.

**The opening coins teach RELEASE** (`ONBOARD_ARC_WX` / `ONBOARD_ARC_FRAC`, applied in
`makeCoin()`). A player who just presses and holds hits the ceiling in under half a second,
so over the opening stretch the coin line is forced onto an arc that starts **below** the
launch line (take it by letting go) and rises for the second coin (take it by holding).
Amplitude tapers to 0 by `ONBOARD_ARC_WX`. `rng()` is consumed either way, so coin types and
the seeded stream are unchanged - only y positions move.

**Do not re-add a title-screen control hint.** A "HOLD to climb / RELEASE to fall" line was
removed the same day it shipped: redundant next to HOLD TO FLY, crowded the row below, and
the attract ship flies through that line. The runway teaches it by feel. The `T.hold`
string is deleted from all locales - don't reintroduce it.

