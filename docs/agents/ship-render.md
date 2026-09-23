# Ship rendering

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the measurements and rejected alternatives behind them are in `docs/design-history.md` (the 2026-09-21 condensing moved the removed paragraphs there verbatim, under "Narratives moved out of docs/agents").

## Ship rendering (K5 "Facette + Licht", 12.0; F-14 hull since 2026-09-22)

`shipPath()` / `drawShip()` / `drawThrustPlume()` in `draw.js`. The hull is a Grumman F-14
(it was an SR-71 until 2026-09-22; see "F-14 hull" below). Its planform is cut into flat facets (`SHIP_FACETS`) lit from above - top half toward white, bottom half
toward near-black, all mixed from the skin's own colour (`_shipTones`, cached per skin)
so every ship keeps its paint. Seams are faint light/dark hairlines, never black ink: an
earlier pass with dark panel lines read as a technical drawing. Emissive details in the
skin's glow colour (wingtip strobes, spine running lights) are switched off
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

**The brand marks are NOT the flying hull right now (user's call, 2026-09-22).**
`branding/gen-ship-glyph.mjs` carries its own copy of the old SR-71 `SHIP_OUTLINE` /
`SHIP_FACETS`, and the app icon, launch logo, Play graphic and the homepage ship chips
(`flytunl-site/home.src.html`) still show it: the user kept icon and logo for now. Do not
rerun the generator by reflex after a hull change; when the marks are moved to the F-14,
port the new outline and facets into the generator first.

**Historically the brand marks were generated from this same geometry.** `branding/gen-ship-glyph.mjs`
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
is rendered from a small 3D model of the hull (`draw.js` `_ship3dFaces` /
`_buildShip3D` / `drawShip3D`), rolled `SHIP3D_ROLL_BASE` out of the top view, projected
orthographically, flat-shaded from screen-up. **Hangar, hero portrait, shop cells and the
share card stay top-down** (`drawShip`) - the hangar is a portrait, the flight is a flight.
Draw-only: `PR`, collision, `rng()` and placement untouched. `SHIP_VIEW_3D = false` restores
the flat hull everywhere. Study: https://claude.ai/artifact/Q9gDK8SdVrCYm9rU9biZdJ

- **The roll angle is 67 since 2026-09-23** (the user asked for more from above; it was 60).
  Raising it also raises the hitbox fill, which is why it is the lever named below.
- **The roll angle is a measured trade, not a taste call** - lower and only the near wing
  reads while the picture under-fills the hitbox; 90 is the top view. `test-collision.js`
  asserts the drawn hull never reaches PAST the circle or past the flat nose at any roll or
  sweep, and still fills >= 0.60 of it in flight. The lever for coverage is
  `SHIP3D_ROLL_BASE`, not `SHIP3D_FIN_SCALE` (measured ~no effect).
- **The roll follows the climb rate** (`SHIP3D_ROLL_AMP`, damped spring in `update.js
  stepShipRoll`, a ratio of `MAX_VY` so it stays screen-independent). Deliberately NOT a
  free-swinging wobble - that reads as noise in a game about reading distances.
- **Swing wings (F-14): three states, not a speed curve** (`SHIP3D_SWEEP_CRUISE`,
  `SHIP3D_SWEEP_WARP_EASE`, `SHIP3D_SWEEP_MAX`, `shipSweep`, `SHIP3D_PIVOT`, `update.js
  stepShipRoll`). Normal flight cruises **between** the stops; a **warp** folds them fully
  back (held there for the first part of the warp, then gliding home); a **blue coin**
  swings them fully forward and they follow the pill back to cruise. A warp beats a live
  blue coin - the ship really is fast then. Swinging forward and folding into a warp snap
  (x12), the glides back are slow (x4). The sweep used to track the scroll speed, which left
  the ship spread through the whole slow opening (user, 2026-09-22); `SHIP3D_SWEEP_SPD_LO/HI`
  and `SHIP3D_BRAKE_DEG` went with it. `test-sim.js` holds all of it on the real update loop.
  Panel chord: widened twice on 2026-09-23, ending as a DELTA (root 0.51 r, tip 0.11 r,
  user asked for "mehr Dreieckform"). Swept, the panel still clears the glove - that is the
  ceiling, so render a swept ship before going deeper; a long-chord panel vanishes under it.
  The root trailing edge stops at -0.56 r, just inside the glove edge at that span.
- **The portal grants a barrel roll** (`SHIP3D_BARREL_SEC`, set in `triggerWarp`): one full
  360 deg turn, smoothstepped. Safe by construction - a warp is hazard-immune and
  wall-clamped, so the picture leaving the circle mid-roll can never decide a death.
- **Paint (paint.js) paints the 3D hull through the same `_drawPaintOverlay`**: at roll `a` the top
  surface is the planform squashed by `sin(a)`, so the overlay runs under that scale,
  clipped to the 3D silhouette. Facet seams come in as a `hull` argument, traced in screen
  space; the **rim is the planform outline** under the squash, never the model's open edges
  (the F-14's parts share no edges, so those ran through the hull and additive rims lit it
  from inside). 3D-only: seams at ~0.28x strength, bright core only, small faces skipped (the
  F-14 shows ~48 seam faces; at full strength STEALTH turned into a lamp), and no pattern
  near edge-on (mid barrel roll). **Re-check STEALTH and the rim effects in 3D whenever the
  model changes** - both failures were invisible in code and obvious on screen.
- `shipNozzleDY(ns)` projects the exhaust nozzles, so plume, on-fire cone and `update.js`'s
  thruster particles all leave the nacelles at any roll.
- Cost: roughly twice the flat hull's fills, no `shadowBlur`. If a weak device needs it,
  cache the hull per roll/sweep bucket in an offscreen canvas.

**Still top-down, deliberately:** the brand marks (`branding/gen-ship-glyph.mjs`, app icon,
launch logo, Play graphic, the homepage chips) and `share.js`'s `_shipGlyph`. They are
portraits of the ship, not pictures of the flight, and the generator's facet-tone maths has
no 3D twin. The swing-wing outer panel means the in-flight planform is no longer exactly
`SHIP_OUTLINE`; if the marks are ever regenerated, decide then whether they follow.


## F-14 hull (2026-09-22)

User's request: the swing wings did not look real on an SR-71 body; wings and tail should
follow the F-14 Tomcat, flight model and top-down views alike. Concept study with both hulls
in the real renderer: https://claude.ai/artifact/83BUEJDUKVSVMjS6HVtUUE

- **Where the swing comes from:** a narrow glove (68 deg leading edge, canopy to pivot) and
  the pivot well inboard (`SHIP3D_PIVOT`), so almost the whole wing swings. The old hull
  swung a short stub off a wide delta, which is what read as fake.
- **`SHIP3D_SWEEP_MAX` is a hitbox trade.** The real F-14's 68 deg pulls the tips in so far
  that the swept ship fills only ~0.51 r in flight against `test-collision.js`'s 0.60 -
  deaths before the wing touches, at the plateau. The shipped sweep holds the 0.60; the
  swept case at the bottom of the roll swing is the binding one.
- **No box intakes.** A rectangular raked intake read as "a square box up front, not
  aerodynamic" (user). The pods start as a pointed fairing against the fuselage and swell
  round into the engine; the intake is only a dark sliver at the tip.
- **Wing tip 0.95 r, not 0.97:** the blue-coin brake swings the panel forward past spread;
  at 0.97 the tip crossed the circle at roll 90.
- **Tail:** twin fins on the nacelles canted OUTWARD, tailerons, beaver tail, two ventral
  fins. Nozzles moved in beside the beaver tail (`SHIP_NOZZLE_X/Y`), so plume, on-fire cone
  and thruster particles follow automatically.
- **Liveries** are drawn in planform coordinates; STRIPE's wingtip caps were moved to the
  F-14 outer panel. In flight they do not follow the sweep (true before, more visible now).
- **The top-down views show the wings SWEPT** (user's call, 2026-09-22: it reads as speed).
  `SHIP_OUTLINE` / `SHIP_FACETS` are the 3D planform with the outer panels turned
  `SHIP3D_SWEEP_MAX` about `SHIP3D_PIVOT`, panel root tucked under the glove as in 3D, so
  hangar, hero, shop and share card show the same aircraft the flight does at full pace.
  Span drops to 0.78 r there; that only touches the picture, and in the `SHIP_VIEW_3D=false`
  fallback it would also mean a narrower drawn ship than the hitbox.
- **The top-down hull has no engine pods on it** (user, 2026-09-22): drawn as two-tone
  pods they read as "two pointed tubes lying on the ship", and on a real F-14 the nacelles
  are buried under the flat centre body from above anyway. What `drawShip` draws instead is
  what is actually visible from there: a tunnel seam each side, a dark intake slot inside
  the glove leading edge and the hot nozzles. That pass is NOT clipped to the hull, so
  anything added there has to sit inside the silhouette.
- **Fitting the real 3-view was TRIED and REJECTED** (user brought the drawing, 2026-09-22:
  length 62 ft 8.5 in, span 64 ft 1.5 in spread / 38 ft 2.5 in swept, sweep 20/68/75 deg,
  height 16 ft). Putting the pivot (0.28 of the half-span), taileron (0.53), nozzle centre
  (0.17) and body width on the drawing's numbers made a correct but worse-looking ship, and
  the inboard pivot cost so much swept span that `SHIP3D_SWEEP_MAX` had to drop to 30 to
  keep the 0.60 r fill. The user's verdict was "vorher war besser", so the stylized
  proportions stand and the fuselage was WIDENED a touch instead. Do not re-derive the hull
  from the drawing; it is a game ship at ~35 px, not a scale model.
- **Where it deviates from the real jet, on purpose:** length/span 1.30 against 0.98 (the
  nose is pinned at 1.40 r by the forward probe while the span is capped at 0.98 r, so the
  hull can only be stretched), swept span 0.82 of spread against 0.60, pivot further
  outboard, and no glove vanes, chin pods, pylons or gear - none of that resolves in flight.
- **One triangle from the nose back** (user, 2026-09-23, in two steps - "mehr Dreiecksform",
  then "noch staerker"): the forward fuselage flares straight out of the radome (half-width
  0.048 -> 0.070 there, 0.113 -> 0.145 r where the glove starts) and the glove leading edge
  was pulled forward from 0.62 to 0.80 r, so nose, glove and the delta panels read as one
  wedge. That edge is now ~77 deg, past the F-14's 68 - a deliberate stylization, on top of
  the deviations listed below. The tunnel seam and intake slot sit on the wider body side.
- **Profile pass** (user, 2026-09-23, after asking whether the side view was adapted too -
  it is the same model, only rolled): the canopy became a real bubble over the spine, the
  forward nacelles hang deeper (the F-14's intake box, still round and pointed at the tip)
  and the nose droops slightly. The droop started at -0.022 r and read as a dark sliver
  poking out of the nose at roll 60 - keep it shallow.
- **Cost:** the 3D model grew from ~170 to ~240 faces (the round nacelle loft is most of
  it); about half are back-face culled per frame. Not measured on a weak device yet.
- **Tests:** `test-collision.js` also holds the flat outline to the envelope and checks
  that `share.js`'s copied `_shipGlyph` outline is the same polygon as `SHIP_OUTLINE`.
- **Copy:** the flytunl.ch ships page described the hull as "SR-71-style"; the paragraph
  now says F-14 in all 15 languages (key rehashed in `flytunl-site/i18n/pages/*.b-ships.json`).
- **Sweep states** (2026-09-22, two passes): see the swing-wing rule above - the wings no
  longer follow the speed at all. The TOP-DOWN hull stays drawn at full sweep whatever the
  flight is doing; it is the portrait of the ship at speed.
- **Test bug fixed on the way:** `test-collision.js` read `s3.SHIP3D_BRAKE_DEG`, but a
  top-level `const` run in a vm is not a context property - the brake sweep was `NaN`,
  drawn as spread, and never checked. The SR-71 hull actually reached 1.02 r under the brake
  at roll 90 (barrel roll only).
