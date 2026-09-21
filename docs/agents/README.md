# docs/agents - topic rules for coding agents

CLAUDE.md is loaded into every session and holds one line per rule. The files here hold the
full rule, the constants involved and the traps already hit; read the one for the area you
are about to change. Every section was moved here verbatim from CLAUDE.md on 2026-09-21,
headings unchanged, so an old `CLAUDE.md "<Section>"` reference means that heading here.

| file | covers |
|------|--------|
| `physics.md` | canvas size, GRAVITY/THRUST/MAX_VY, trapezoid integration, `_FEEL_SCALE`, player, `scrollSpd()` never plateaus |
| `fairness.md` | cross-device fairness, rng streams, `SPAWN_AHEAD_*` budget, coins as fixed point |
| `difficulty.md` | procedural tunnel, flight plan (sectors), difficulty curves, onboarding widen, deep-run variety |
| `hazards.md` | crystal stalactites, falling stalactites, boulders, cannons, warp portal, mines |
| `coins.md` | gap bonus, chicane gold, power-up supply, coin types and rendering, poison/bomb/drain |
| `audio.md` | bus, limiter, loudness hierarchy, loops, outro, reverb, settings |
| `ship-render.md` | K5 facets, envelope, 3/4 flight view, swing wings, liveries on the 3D hull, brand marks |
| `visuals.md` | typography, title accent, HUD instrument, web frame, depth light |
| `screens.md` | milestones, combo, death freeze, records, share card, world rank, death screen, ghost |
| `onboarding.md` | approach over the city, safe opening flight, launch ramp, release-teaching coins |
| `economy.md` | ad cadence, rewarded videos, ship unlock economy, liveries, Unlock All Ships, future features |

Keep these files free of values copied from code: name the constant, not its number.

## Hard rules, full text (one-liners in CLAUDE.md)

- **No live debug keyboard shortcuts ship unguarded**: `input.js`'s `KeyP` handler
  (toggles `window._freezeDraw`, freezing a live run - world, physics, and audio -
  indefinitely) is gated behind `DEV_PAUSE_KEY` (`constants.js`, ships `false`; same
  pattern as `DEV_INVINCIBLE`). Through 11.0 this shipped live in the web build: a
  red-team audit found it, unguarded, gave any player unlimited thinking time on a
  shared daily leaderboard for free. `window._freezeDraw` itself is untouched - the
  console-driven headless-playtest workflow reads/writes it directly, never through
  this key - only the keyboard binding needed the guard. Flip `DEV_PAUSE_KEY` to
  `true` locally to get the shortcut back for debugging; never ship it `true`.
- **No em dashes (-)** anywhere in code, comments, or UI text. Use hyphen-minus (-) instead.
- **XML comments can't contain `--`**: the no-em-dash rule means `--` is used constantly
  in JS comments, but it is illegal inside an XML comment. `AndroidManifest.xml` and
  `res/xml/*.xml` use single hyphens or a colon instead.
