# Stalactites, boulders, cannons, mines

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the measurements and rejected alternatives behind them are in `docs/design-history.md` (the 2026-09-21 condensing moved the removed paragraphs there verbatim, under "Narratives moved out of docs/agents").

## Stalactites
Triangle-shaped obstacles from top or bottom wall. Accurate triangle-circle collision (not AABB).
Paired stalactites (chicane from both sides) start at `CHICANE_START_WX` (S5), faded in over
`CHICANE_FADE_WX`; odds in `chicaneProb()` (`world.js`).

**They are CRYSTALS since 16.0 (`CRYSTAL_STALS`, `constants.js` doc block +
`draw.js` `drawCrystalSpike`) - do not go back to the smooth cone.** Ceiling spike = twin
(main + two companions + two nest crystals), floor spike = druse (main + four steps + six
nest crystals), all upright, drawn from `_rockHash(s.wx)` - no `rng()` draw, no change to
`makeStal()`, placement or collision, so `test-cave.js` still reports a byte-identical
cave. `CRYSTAL_STALS = false` brings `_stalOutline`'s cone back.

Four geometry rules, each of them learned by breaking it:
- **The main crystal sits on the axis at full length**, so its tip lands exactly on
  the collision apex. Give it a lateral offset and the lethal triangle runs on
  below a visibly shorter crystal - the unfair direction, spotted immediately.
- **Shafts taper.** A parallel column of half-width w only fits a triangle running
  from `0.85*hw` to zero up to `t = 1 - w/(0.85*hw)`; that is why the first pass
  could only be fat-and-short or long-and-needle-thin. Companions must also stand
  CLOSE to the axis: at `dx` 0.48 with a 0.24 tilt the clamp left 6-9% of the
  length, invisible at game size; upright at 0.13 it keeps 70%.
- **The side clamp is solved with signs, not absolute values** - with `Math.abs` an
  inward-leaning prism lost up to half its length.
- **Every crystal roots on the wall at ITS own x**, never on the average over
  `+-hw`; nest crystals sit up to `3*hw` out, where the wall has long since moved.

**The drawing is one blitted sprite per spike** (`_xtalSprites`), baked per stalactite and
rebuilt only when the raster scale or tone key changes. Drawn live it cost 6.3x the old
cone's whole `draw()`; as one sprite it is cheaper than the cone. No gradient, clip,
`shadowBlur` or specular stroke per frame. Do not split that blit again without re-measuring.

**Per-world material** (`CRYSTAL_MATERIALS`, index-aligned with
`WEEKDAY_PALETTES`): same geometry, different finish - calcite, rust quartz,
selenite, obsidian, amethyst, olivine, rhodonite. The hue stays the day's own
`stalEdge`: the colour circle is measured full (`COIN_BASE_CLR` plus the state
colours), the day rock lands within 20 degrees of a signal colour on six of seven
worlds, and rotating away only pushes three worlds onto the same blue-violet. What
separates a crystal from a coin is therefore **place** (welded to the wall vs a
small moving object in the corridor), **value** (terminations lift toward white)
and **form**, never hue.

**Breaking one sounds and looks like glass, not gravel** (`sfxCrystalCrack` in `audio.js`,
`burstCrystalShards` in `systems.js`). The sound's signature is four INHARMONIC PARTIALS
(1 / 1.41 / 1.93 / 2.57 off 2050 Hz) ringing after a short fracture transient; 2050 rather
than 3100 so the first partial lands in the MID band and has body on a phone speaker.
Level-matched to the sound it replaced, so the loudness hierarchy holds. Judge by offline
render (`reference_audio_method` memory). Shards are thrown ALONGSIDE the round dust, never
instead of it, on **all four contacts** (bullet kill, bomb-clear, break-off, fatal hit - the
fatal one matters most, it hangs in the death freeze frame). **No crack sound on the fatal
hit** (`sfxDie` owns frame 0). **The LANDING keeps the rock thud** (`sfxStalCrack`). Both
are gated on `CRYSTAL_STALS`.

**A falling spike drops the CRYSTAL, not the rock socket.** Nest crystals and the rock lip
stay on the ceiling as an empty socket (which doubles as a telegraph); only the
load-bearing crystals fall, so the picture stays congruent with the falling triangle - a
free-falling nest would be clippable where at the wall it is unreachable. **On landing
nothing rotates** (tip buried like a nail, consistent with `stalHit()`'s `ay`/`ty` + `fy`).
Burial LENGTHENS the shafts (`CRYSTAL_LAND_SINK`), never translates the body down -
translating sinks the base and leaves the collision standing above the drawing.

**Falling stalactites** (`FALL_LEAD`/`FALL_SPAN` in `constants.js`, `fallSpacing()` in
`world.js`, `stalFallY`/`updateFallingStals` in `systems.js`): from `FALL_START_WX` (S7;
`nextFallWx` set in `startPlay`, flags the next *single* non-chicane ceiling spike), a seeded
cadence flags a spike loose. It **shakes** (`wobX`) and trickles dust, detaches within
`FALL_LEAD`, then **falls the full corridor** over `FALL_SPAN` world-px of scroll
(`stalFallY` = `(corridor - length)*t^2`, **scrollX-indexed so a blue coin can't desync it**)
and becomes a floor spike - the dodge is "go over it". **The fall distance is recomputed live
every frame, never frozen at detach** - the corridor keeps moving and a frozen value left
spikes hanging mid-air (guarded in `test-collision.js`). `fy` is folded into
`stalHit`/`stalHitBullet`/`triggerBombExplosion`/the draw loop so collision and render agree.
Bullets/bombs kill a falling one like any stalactite.

## Boulders
Large static rounded rock (`src/systems.js` `makeBoulder`/`maintainBoulders`, from
`BOULDER_START_WX` = S4 / ~score 252 since the 2026-09-13 flight plan (was 5100 / ~85, then 6620), `boulderSpacing()` in `world.js` - a sparse set-piece cadence,
floor 2400px). Unlike a mine it is telegraphed by sheer size and **never spans the corridor**: radius is bounded (`R <= min(halfGap - 2.6*PR, 0.26*halfGap)`)
and the centre is nudged a seeded amount toward one wall, so there is always a pass above
AND below - one easy, one a squeeze. It asks "commit up or down" rather than "react".
Circle-circle collision (`update.js`), same shield-absorb + shove-clear as a mine. Bombs
clear boulders; player bullets just spark off (solid rock, not a destructible hazard).
Seeded via `_deepHash`, no `rng()`-stream impact.

**Don't push boulders further out without leaderboard data showing players get there.**
They sat at score ~1400 until 2026-09-11 and no real player had ever seen one; earlier is
also the *forgiving* direction, since the radius is bounded by the (wider) corridor.

**Size (2026-09-13, "verdammt schwer zu umfliegen"):** radius cap 0.26 of halfGap, pass
margin 2.6 PR for placement and the stalactite veto alike. A 3.0 PR margin was rejected -
deep boulders stopped fitting and the count collapsed.

**Rock islands, not balls.** `r` is the vertical half-THICKNESS bound only; the horizontal
half-length `hl` = r x a seeded stretch, capped at `BOULDER_MAX_HALF_LEN` (`systems.js`), so
the narrow-pass guarantees hold. Four seeded outline families (`_islandProfile`: lens,
teardrop, peanut, shelf; top and bottom generated separately; shelf gets a smaller roll
slice because it survives placement more often). The outline is one polygon on Chebyshev
samples (`BOULDER_U`), both drawn (`draw.js`) and collided against (`boulderHit`, shared by
ship, bullets and bombs). `hl` is keyed off the REFERENCE radius, so the island covers the
same world-x on every device. `_fitIsland` checks both passes at every outline sample
against that sample's bounds and every overlapping spike, falling back to a shorter island
(`BOULDER_STRETCH_FALLBACK`). `test-cave.js` re-checks both passes along the outline.

## Cannons

Rare wall-mounted artillery turret (`src/systems.js` `makeCannon`/`maintainCannons`/
`updateCannonShots`), first at `CANNON_START_WX` (S6, ~score 408) and spaced far apart
(`cannonSpacing()`, floor 1200px vs every other obstacle's sub-300px floor) - a rare
set-piece, not a recurring hazard. Each cannon is inert (not solid, can't be flown into)
until the player closes to within `CANNON_FIRE_LEAD`, then fires exactly one diagonal
shot toward the opposite wall and goes dormant. Shots reuse the player's own bullet
sprite (`drawProjectile`), so a cannon shot reads as literal enemy fire and only its
diagonal angle tells them apart. Same hitbox trade-offs and shield-absorb behaviour as a
mine; player bullets destroy a shot in flight like they destroy a mine.

**Barrel, shell nose and exit line share one axis - the TUNNEL frame. Do not switch to
screen velocity.** `updateCannonShots` aims everything along the shell's **world**
velocity (`c.aimUX/aimUY`, sprite `atan2(s.vy, s.vx)`); before firing, `draw.js` aims at
the nominal mid-span shot. Since `scrollSpd()` outruns the closing speed at every cannon
depth, that axis leans down-and-away from the player - the player flies into the falling
shell. A screen-velocity aim looks right per element in isolation but the gun is bolted
to the tunnel and scrolls left faster than its own shell, so the shell peels away from
the muzzle almost broadside (~118 degrees off, reported from play).

The shot spawns at the barrel's **muzzle** (`CANNON_BARREL_LEN`, shared between `draw.js`
and `systems.js`), sliding the start along that same world line and slowing the shell by
exactly the barrel length over the flight, so endpoint and arrival time match a pivot
launch and the tuned warning window does not move.

**`CANNON_SHOT_TRAVEL` is 1.45s and `CANNON_FIRE_LEAD` is deliberately untouched at
`W*0.62`.** A cannon's shot does not exist until `CANNON_FIRE_LEAD` out and its vertical
span is rolled from `rngCannon()` at that instant, so **its whole warning window IS its
flight time** - which made it the weakest-telegraphed hazard in the game until the travel
time was raised from 1.15. The muzzle still fires from the same on-screen position and
world-x; only the closing speed dropped (`closingSpd = CANNON_FIRE_LEAD /
CANNON_SHOT_TRAVEL`), and `cannonSpacing()` is untouched, so rarity is unaffected.

**One invariant, checked rather than assumed:** `rngCannon()` is drawn both by
`makeCannon` (at the spawn horizon) and by `updateCannonShots` (at fire time) on the same
stream, which would fork the cave per player if the two could interleave differently.
They can't - a cannon spawns at `scrollX = wx - 1256` and fires at `scrollX = wx - 803`,
and `cannonSpacing()`'s 1200px floor is wider than that 453px window, so the order is
always spawn-N, fire-N, spawn-N+1. Verified identical across 17 cannons for two pilots
with different scroll histories on the same day. **Re-check this if either number moves.**

`makeCannon`'s placement veto is **same-wall and geometric** (`PLACE_CANNON_R +
placeStalW`), not the flat 140px both-walls test it started as, and the wall (`isTop`) is
drawn **before** the retry loop - see the `SPAWN_AHEAD_*` discussion under Cross-device
fairness.

Measurements behind the travel-time change: `docs/design-history.md` -> "Cannons".

## Collision and mines (key design decisions, do not revert)

- **Triangle-circle collision**: Stalactites use proper geometric collision matching the visual triangle, not AABB. Changing to AABB would make invisible collisions at the edges.

- **Mines are the only thing that guarantees no run survives forever, don't make them wall-anchored or bonus-aware**: because every *other* hazard (stalactites/chicanes) is wall-rooted with an absolute, capped length, a player who keeps `gapBonus` maxed can park near the corridor's vertical center past ~score 1567 and never be threatened by a wall or stalactite again, no matter how high the uncapped `scrollSpd()` (above) climbs - speed alone doesn't endanger a stationary target. `makeMine()` (`systems.js`) placing mines across the full un-bonused `boundsBase()` width, not wall-anchored like a stalactite, is what closes that gap: an unpredictable mine still demands a real `MAX_VY`-bounded dodge every `mineSpacing()` world-px, and that reaction window keeps shrinking in real time as `scrollSpd()` rises without limit - so eventually no input sequence can dodge one, for any skill level. See the doc comment above `makeMine()` for the full argument. **`MINE_RETRY_OFFSETS`
(2026-09-11) is what keeps that argument true in practice**: `makeMine` vetoes any x with
a stalactite above *and* below, and deep that is almost every x (50px spacing, 0.62
chicane odds), so ~90% of mines were being silently dropped and spatial density ran
*backwards* with difficulty - 1.66 per 1000 world-px at score 100-150 but only 0.35 past
1400. A vetoed mine now shuffles forward up to 135px (under the 140px minimum spacing
between consecutive mines, so the array stays sorted) and retries. Deep only (`_prog2 >
0`): a retry below the plateau measurably *raised* early mine density, and the early game
is off-limits to this pass. Restoring the drain also matters for the shield stack - a
stock that can only be spent by getting hit never drains if nothing is hitting you.

