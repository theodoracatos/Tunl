# Ship rendering

Moved verbatim from CLAUDE.md on 2026-09-21 (progressive disclosure). CLAUDE.md keeps the one-line rule and points here.

## Ship rendering (K5 "Facette + Licht", 12.0)

`shipPath()` / `drawShip()` / `drawThrustPlume()` in `draw.js`. The SR-71 silhouette is
cut into flat facets (`SHIP_FACETS`) lit from above - top half toward white, bottom half
toward near-black, all mixed from the skin's own colour (`_shipTones`, cached per skin)
so every ship keeps its paint. Seams are faint light/dark hairlines, never black ink: an
earlier pass with dark panel lines read as a technical drawing. Emissive details in the
skin's glow colour (intake rings, wingtip strobes, spine running lights) are switched off
via `drawShip`'s `fx` argument for the ghost and the wrecked death frame, since a ghost
with running lights reads as a second live ship. Only the base fill spends `shadowBlur`;
the glow rings use a wide soft stroke instead, because shadowBlur is the expensive call
on WKWebView.

**Envelope (do not grow it):** span +-0.98r, nose +1.40r. The old nose reached 1.72r,
~17.6px ahead of `update.js`'s forward collision probe (+0.7*PR), so it visibly slid
through stalactites; the old span stopped at 0.92r, so the PR circle killed ~8% before
the wing visibly touched. `PR` itself is untouched - this is purely visual.

**The thrust plume is tinted with the skin glow** (teardrop, white core, three shock
diamonds). Normal thrust used to be the same orange as the ON FIRE afterburner; now
orange-red belongs to ON FIRE alone. Exhaust leaves the nacelles at `SHIP_NOZZLE_X/Y`
(`constants.js`), shared by the plume, the on-fire cone and `update.js`'s thruster
particles. The share card's `_shipGlyph` (`share.js`) carries a copy of the outline.

**The brand marks are generated from this same geometry** (2026-09-13).
`branding/gen-ship-glyph.mjs` mirrors `SHIP_OUTLINE` / `SHIP_FACETS` and the facet
tone maths and writes the ship into the four SVG masters (app icon, Android adaptive
foreground, iOS launch logo, Play feature graphic) between `BEGIN/END generated ship`
markers; `branding/export-icons.sh` then pushes the rasters into iOS, Android, the
Play listing icon and the site. Run both after any hull change - hand-maintained
copies are why the icon, both splash screens and every favicon still showed the
pre-12.0 needle (nose 1.72r, span 0.92r) after the game had stopped drawing it. The
homepage's eight ship chips (`flytunl-site/home.src.html`) carry a flat silhouette of
the same outline. Two deliberate deviations in the marks, both for legibility at
favicon size: the shadow-side facet tones are damped (a 54%-toward-black facet
disappears into the `#04040e` icon ground) and the animated spine running lights are
dropped. See `branding/README.md`.

**Rock roughness is switched off, and the code now short-circuits accordingly.**
`ROCK_ROUGHNESS_MAX` = 0 (`draw.js`), so `_wallJagged` and `_stalOutline`'s `jAmp` both
resolve to zero - but until 2026-09-14 they computed the full value-noise stack first
and multiplied it away afterwards. At `RSTEP` 3 that is ~320 wall samples per frame,
twice each, three `_rockNoise` per call, two `Math.sin` per noise: about 3900 sine calls
per frame producing 0, plus 12 more per on-screen stalactite. Both now return early on a
zero amplitude (measured 30.8 -> 2.5 us per frame's worth of wall samples), and the
returned value is bit-identical at any non-zero roughness, so flipping the constant back
up still behaves exactly as before.

## 3/4 side view in flight (2026-09-19, `SHIP_VIEW_3D`)

The cave is a side section - gravity down, stalactites from the ceiling, a dusk skyline in
the approach - and the ship was the one thing in it drawn from above. The **flying** ship
(player, ghost, wrecked death frame, and the in-scene ship on the title screen) is now
rendered from a small 3D model of the same K5 hull (`draw.js` `_ship3dFaces` /
`_buildShip3D` / `drawShip3D`), rolled `SHIP3D_ROLL_BASE` = 60 degrees out of the top view
and projected orthographically, flat-shaded from screen-up like the facets. **Hangar, hero
portrait, shop cells and the share card stay top-down** (`drawShip`): the hangar is a
portrait, the flight is a flight. `PR` and every collision test are untouched - this is
draw-only, no `rng()`, no placement input. `SHIP_VIEW_3D = false` restores the flat hull
everywhere with no other change. Variant study (five views, a flyable lab, the coverage
curve): https://claude.ai/artifact/Q9gDK8SdVrCYm9rU9biZdJ

- **60 degrees is a measured middle, not a taste call.** At 45 only the near wing read and
  the picture reached just 0.55-0.8 `PR` vertically against the hitbox circle (0.98
  top-down, the flat hull's envelope rule); at 90 it is simply today's top view. At 60 both
  wings read and the span is back to ~0.85 `PR` (0.71 wings swept). `test-collision.js`
  asserts the drawn hull never reaches PAST the circle and never past the flat nose (1.40r)
  at any roll or sweep, and that it still fills >= 0.60 of it while flying. The lever for
  more coverage is `SHIP3D_ROLL_BASE`; `SHIP3D_FIN_SCALE` measurably is not (+0.01 between
  1.0 and 1.8 - at this roll the SPAN carries it).
- **The roll follows the climb rate** (`+-SHIP3D_ROLL_AMP` = 10 deg, damped spring in
  `update.js stepShipRoll`, ratio of `MAX_VY` so it stays screen-independent): climbing
  turns the back toward the camera, falling the belly. A second read on the daumen next to
  the nose. Deliberately NOT a free-swinging wobble - an earlier "schwingt nach" variant
  reads as noise in a game whose whole skill is reading distances, same argument that
  removed the parallax rock.
- **Swing wings (F-14), keyed to the speed the player feels** (`SHIP3D_SWEEP_*`,
  `shipSweep`): the outer panels pivot about `SHIP3D_PIVOT`, spread at the slow start and
  folded ~64 deg back at the difficulty plateau, driven by `scrollSpdBase x
  slowScrollFactor x warpScrollFactor`. A **blue coin throws them forward past spread**
  (`SHIP3D_BRAKE_DEG`, an air brake) and they fold back exactly as fast as the slow-time
  glide returns the speed; a **warp folds them in half a second**. The panel is slender for
  a reason: a long-chord delta panel simply disappears under the glove when swept.
- **The portal grants a barrel roll** (`SHIP3D_BARREL_SEC`, set in `triggerWarp`): one full
  360 deg turn, smoothstepped. Safe by construction - a warp is hazard-immune and
  wall-clamped, so the picture leaving the circle mid-roll can never decide a death.
- **Liveries paint the 3D hull through the same `_drawLiveryOverlay`.** The finishes are
  authored in planform coordinates, and at roll `a` the top surface projects to exactly that
  planform squashed by `sin(a)`, so the overlay runs under that scale, clipped to the 3D
  silhouette instead of `shipPath`. The two things that cannot be expressed that way - the
  facet seams and the rim - come in as a `hull` argument and are traced in screen space (rim
  = the edges that only one visible face owns). Two 3D-only corrections: the seams run at
  half alpha and skip small faces (90 faces against the flat hull's 7 turned STEALTH into a
  lamp), and near edge-on (mid barrel roll) the pattern is skipped for those few frames.
- `shipNozzleDY(ns)` projects the exhaust nozzles, so plume, on-fire cone and `update.js`'s
  thruster particles all leave the nacelles at any roll.
- Cost: ~90 visible faces filled per frame against the flat hull's ~40 fills, no
  `shadowBlur` (the glow is one radial fill). If a weak device ever needs it, the obvious
  cut is caching the hull per roll/sweep bucket into an offscreen canvas.

**Still top-down, deliberately:** the brand marks (`branding/gen-ship-glyph.mjs`, app icon,
launch logo, Play graphic, the homepage chips) and `share.js`'s `_shipGlyph`. They are
portraits of the ship, not pictures of the flight, and the generator's facet-tone maths has
no 3D twin. The swing-wing outer panel means the in-flight planform is no longer exactly
`SHIP_OUTLINE`; if the marks are ever regenerated, decide then whether they follow.

