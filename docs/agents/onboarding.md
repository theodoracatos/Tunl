# Approach and onboarding

Moved verbatim from CLAUDE.md on 2026-09-21 (progressive disclosure). CLAUDE.md keeps the one-line rule and points here.

## Approach over the city ("Anflug", 2026-09-19)

`src/approach.js` (doc block at its top). Every run opens over the day's metropolis at dusk
(three parallax silhouette layers, beacons in the day colour) and flies through a rock mouth
into the safe opening flight; the title screen IS that city. Every run, PLAY AGAIN included,
reaches the cave 4s later than before (`APPROACH_SEC` = `START_RAMP_SEC` + 4, user's call: the
start stays the same every time). If it is ever shortened, keep it above ~2.3s or the ship
launches through the mountain foot.
"ENTERING THE TUNL" (`T.entering`, 15 langs) shows over the city; the world banner and the
score wait for the cave. Concept: https://claude.ai/artifact/ECrpmHcPeTsREMwEtK6vNs
- **The city lies before world-x 0, never in it.** `scrollX` stays 0; only `approachLeft`
  (a camera offset) moves, and `drawWorld()` draws the cave translated + clipped by it.
  `update.js` returns right after the physics while `approachLeft > 0`, so no clock, hazard,
  score, flight-time achievement or ghost step runs early. Score, sectors and `test-cave.js`
  are untouched. Don't turn the city into world-x: every score and threshold would shift.
- **No parallax behind a wall** (see "No parallax background"): the skyline exists only left of
  the mountain, and the cave's own void shows through the mouth (`APPROACH_BLEND`).
- **The mouth is the same rock as the cave** (wall colour, stone pattern, day-coloured edge),
  solid all the way into the cave's lethal walls.
- **No soft walls (2026-09-19, "keine Gummiwände mehr").** Over the city the mountain face and
  the screen edges only bounce the ship; from the mouth on (`approachUpdate`) the tunnel rule
  applies at once: a wall contact spends a hull scratch, with none left it kills. The whole
  soft-wall layer (translucent field, dents and rings, `safeWallBump`, `wallsSafe()`,
  `SAFE_FIELD_*`, `SAFE_BUMP_*`) is deleted. Near-miss and the red danger flash now run from
  the tunnel entry; the "walls now deadly" hint fires as the ship enters.
- **The tunnel start was darkened with it** (`DEPTH_LIFT` 0.15 -> 0.05, `DEPTH_MOUTH_ALPHA`
  0.24 -> 0.10): lit by a city at dusk, the old values made the cave a bright olive hall,
  lighter than the sky outside. Sector steps keep their ratios.
- Not done yet: city/tunnel audio (dry outside, cave reverb on entry), the S0 debriefing scene
  showing the mouth, and a device pass (WebKit, 812x375).

## Onboarding

**The first ~50 points of every run are an open, hazard-free flight** (2026-09-13, from
beginner feedback "too hard, frustrating, deleted it"; `SAFE_START_WX` doc block in
`constants.js`, `safeOpenAt()` in `world.js`). Until world-x 3000 the corridor is pushed
out to the screen edges (`boundsAt()` only, never `boundsBase()`), easing shut over the last
1800px. **No stalactites, mines, boulders or cannon fire** until `HAZARD_START_WX` (3400);
boulders and cannons only from their sectors (`BOULDER_START_WX` S4, `CANNON_START_WX` S6),
so no shot lands inside the zone. Coins and the warp
portal still appear. **The walls are lethal from the tunnel entry** since 2026-09-19 (see
Approach): two hull scratches cover the first mistakes. Until then they were SOFT - they
bumped the ship back, drawn as a translucent field with contour lines, dents and rings -
and that whole layer was removed on request ("keine Gummiwände mehr"). The "walls now
deadly" notif fires as the ship enters the tunnel, on a player's first
`WALLS_LIVE_HINT_RUNS` runs. Every run counts normally.

Fair by construction: identical for every player and screen, all offsets are fixed
world-px, and `test-cave.js` mirrors the start cursors. Consequences worth knowing:
every score now starts with ~50 nearly-free points, so the leaderboard baseline shifted
up, and hazard content that sat below score 100 (first stalactite 25, mine 30, boulder
85, cannon 100) moved just past it - the old leaderboard audit numbers (median daily best
70) predate this. The same day it was briefly a 3-run off-record "training flight" with
normal runs safe only to score 50; unified on request once both had the same rules.

**The launch ramp is 1.3s** (`START_RAMP_SEC`, `constants.js`, applied in `update.js`).
The run opens with the ship flying up into frame and levelling out, with `py`/`vy`/
`shipPitch` driven by the ramp rather than by the player - so it is time the player
cannot act in. Held at 1.3s through 11.0; cut in 12.0 after the same red-team replay
measured what that costs the audience the onboarding exists for. A beginner's median run
is **1.0s of flight**, so the ramp was longer than the game, and the full death-to-death
loop (1.3s ramp + 1.0s flight + 0.9s `DEATH_INTERACTIVE_SEC`) was only **31%** time the
player could act in. At 0.5s that is ~42%. Strong players are unaffected either way - at
a 17.7s median run the ramp is noise - so this is purely a first-minutes fix. **Restored
to 1.3s on 2026-09-13 on the user's explicit request** - the longer launch animation looked
better, and that was chosen over the ~42% interactive share. Don't cut it again without
asking.

On top of that, **every run opens with a level glide**: gravity is withheld until the
player's first hold press or `HOLD_GATE_MAX_SEC` (`constants.js`, 2.55s since 2026-09-19, was 2.25s), so the ship
flies dead level and never drops before the player acts. This applies to PLAY AGAIN
restarts too - `input.js` no longer pre-sets `holding`/`hasHeldThisRun` on the restart
tap, so a restart opens exactly like a fresh title-screen start rather than mid-thrust.

**The opening coins teach RELEASE** (`ONBOARD_ARC_WX` / `ONBOARD_ARC_FRAC` in
`constants.js`, applied in `makeCoin()`). Everything above teaches thrust; nothing taught
that letting go is the other half of the control scheme, and a text hint for it is ruled
out (see below). The runway alone doesn't cover it: the ship launches at H/2 with the
corridor ceiling ~H*0.43 above it, so at net-up 1800 px/s^2 a player who just presses and
holds hits the ceiling in ~0.46s. So over the first 2200 world-px the coin line is forced
onto a gentle arc that starts **below** the launch line (verified at +35 to +37px on
every seed sampled) and rises above it for the second coin - take the first by letting go
and gliding down, take the second by holding and climbing. Amplitude tapers to 0 by
`ONBOARD_ARC_WX` so it rejoins normal scattered placement with no seam. `rng()` is
consumed either way, so coin *types* and the whole downstream seeded stream are
unchanged - only y positions move, exactly like the deep-run coin-line shapes.

**Do not re-add a title-screen control hint.** A "HOLD to climb / RELEASE to fall" line
under HOLD TO FLY was added in 5.0 and removed the same day after seeing it on a real
device: it read as redundant next to HOLD TO FLY directly above it, it crowded the
RANKS/CHALLENGE row below it, and the attract-mode ship flies straight through that exact
line of the screen. The reasoning that motivated it (the title screen never says that
releasing is half the control scheme) is real but is better served by the runway, which
teaches it by letting the player feel it. The `T.hold` string it used has been deleted
from all 15 locales - don't reintroduce a translated string for a UI element that doesn't
exist.

