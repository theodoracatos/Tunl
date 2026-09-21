# Ship rendering

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the measurements and rejected alternatives behind them are in `docs/design-history.md` (the 2026-09-21 condensing moved the removed paragraphs there verbatim, under "Narratives moved out of docs/agents").

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

**Envelope (do not grow it):** span +-0.98r, nose +1.40r. A longer nose visibly slid
through stalactites ahead of `update.js`'s forward probe; a narrower span let the PR circle
kill before the wing touched. `PR` itself is untouched - this is purely visual.

**The thrust plume is tinted with the skin glow** (teardrop, white core, three shock
diamonds). Normal thrust used to be the same orange as the ON FIRE afterburner; now
orange-red belongs to ON FIRE alone. Exhaust leaves the nacelles at `SHIP_NOZZLE_X/Y`
(`constants.js`), shared by the plume, the on-fire cone and `update.js`'s thruster
particles. The share card's `_shipGlyph` (`share.js`) carries a copy of the outline.

**The brand marks are generated from this same geometry.** `branding/gen-ship-glyph.mjs`
mirrors `SHIP_OUTLINE` / `SHIP_FACETS` and the facet tone maths into the four SVG masters
(between `BEGIN/END generated ship` markers); `branding/export-icons.sh` pushes the rasters
to iOS, Android, the Play icon and the site. **Run both after any hull change** -
hand-maintained copies once kept showing an old hull everywhere. The homepage ship chips
(`flytunl-site/home.src.html`) carry a flat silhouette of the same outline. Deliberate
deviations for favicon legibility: damped shadow-side tones, no running lights. See
`branding/README.md`.

**Rock roughness is switched off** (`ROCK_ROUGHNESS_MAX` = 0, `draw.js`), and
`_wallJagged` / `_stalOutline`'s `jAmp` **return early on a zero amplitude** - they used to
compute thousands of sines per frame and multiply them by 0. The result is bit-identical at
any non-zero roughness, so raising the constant still behaves as before.

## 3/4 side view in flight (2026-09-19, `SHIP_VIEW_3D`)

The **flying** ship (player, ghost, wrecked death frame, the title screen's in-scene ship)
is rendered from a small 3D model of the K5 hull (`draw.js` `_ship3dFaces` /
`_buildShip3D` / `drawShip3D`), rolled `SHIP3D_ROLL_BASE` out of the top view, projected
orthographically, flat-shaded from screen-up. **Hangar, hero portrait, shop cells and the
share card stay top-down** (`drawShip`) - the hangar is a portrait, the flight is a flight.
Draw-only: `PR`, collision, `rng()` and placement untouched. `SHIP_VIEW_3D = false` restores
the flat hull everywhere. Study: https://claude.ai/artifact/Q9gDK8SdVrCYm9rU9biZdJ

- **The roll angle is a measured middle, not a taste call** - lower and only the near wing
  reads while the picture under-fills the hitbox; 90 is the top view. `test-collision.js`
  asserts the drawn hull never reaches PAST the circle or past the flat nose at any roll or
  sweep, and still fills >= 0.60 of it in flight. The lever for coverage is
  `SHIP3D_ROLL_BASE`, not `SHIP3D_FIN_SCALE` (measured ~no effect).
- **The roll follows the climb rate** (`SHIP3D_ROLL_AMP`, damped spring in `update.js
  stepShipRoll`, a ratio of `MAX_VY` so it stays screen-independent). Deliberately NOT a
  free-swinging wobble - that reads as noise in a game about reading distances.
- **Swing wings (F-14), keyed to the speed the player feels** (`SHIP3D_SWEEP_*`,
  `shipSweep`, `SHIP3D_PIVOT`): spread at the slow start, folded back at the plateau, driven
  by `scrollSpdBase x slowScrollFactor x warpScrollFactor`. A **blue coin throws them past
  spread** (`SHIP3D_BRAKE_DEG`, air brake) and they fold back with the slow-time glide; a
  **warp folds them fast**. Keep the panel slender - a long-chord panel vanishes under the
  glove when swept.
- **The portal grants a barrel roll** (`SHIP3D_BARREL_SEC`, set in `triggerWarp`): one full
  360 deg turn, smoothstepped. Safe by construction - a warp is hazard-immune and
  wall-clamped, so the picture leaving the circle mid-roll can never decide a death.
- **Liveries paint the 3D hull through the same `_drawLiveryOverlay`**: at roll `a` the top
  surface is the planform squashed by `sin(a)`, so the overlay runs under that scale,
  clipped to the 3D silhouette. Facet seams and rim come in as a `hull` argument, traced in
  screen space. 3D-only: seams at half alpha and skipping small faces (else STEALTH turns
  into a lamp), and no pattern near edge-on (mid barrel roll).
- `shipNozzleDY(ns)` projects the exhaust nozzles, so plume, on-fire cone and `update.js`'s
  thruster particles all leave the nacelles at any roll.
- Cost: roughly twice the flat hull's fills, no `shadowBlur`. If a weak device needs it,
  cache the hull per roll/sweep bucket in an offscreen canvas.

**Still top-down, deliberately:** the brand marks (`branding/gen-ship-glyph.mjs`, app icon,
launch logo, Play graphic, the homepage chips) and `share.js`'s `_shipGlyph`. They are
portraits of the ship, not pictures of the flight, and the generator's facet-tone maths has
no 3D twin. The swing-wing outer panel means the in-flight planform is no longer exactly
`SHIP_OUTLINE`; if the marks are ever regenerated, decide then whether they follow.

