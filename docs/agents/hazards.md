# Stalactites, boulders, cannons, warp portal, mines

Moved verbatim from CLAUDE.md on 2026-09-21 (progressive disclosure). CLAUDE.md keeps the one-line rule and points here.

## Stalactites
Triangle-shaped obstacles from top or bottom wall. Accurate triangle-circle collision (not AABB).
Paired stalactites (chicane from both sides) start at `CHICANE_START_WX` (S5), faded in over
`CHICANE_FADE_WX`; odds in `chicaneProb()` (`world.js`).

**They are CRYSTALS since 16.0 (`CRYSTAL_STALS`, `constants.js` doc block +
`draw.js` `drawCrystalSpike`) - do not go back to the smooth cone.** The spike had
not been touched since 1.0 while ship, coins and boulders all moved to flat facets
lit from above; the rock was the last airbrushed object on screen. A ceiling spike
is now a twin (main crystal + two companions + two nest crystals), a floor spike a
druse (main + four steps + six nest crystals), all upright, drawn from
`_rockHash(s.wx)` - no `rng()` draw, no change to `makeStal()`, placement or
collision, so `test-cave.js` still reports a byte-identical cave. Flip
`CRYSTAL_STALS` to `false` and `_stalOutline`'s cone is back.

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

**The drawing is one blitted sprite per spike** (`_xtalSprites`), baked per
stalactite and rebuilt only when the raster scale or the tone key changes. Drawn
live it was ~90 path operations per druse and measured **6.3x the entire `draw()`
of the old cone** at eight visible spikes; socket and body merged into one sprite
it is **0.244ms against the cone's 0.283ms**, i.e. the crystal is now the cheaper
of the two - it spends no gradient, no clip, no `shadowBlur` and no specular
stroke per frame. Do not split that blit again without re-measuring.

**Per-world material** (`CRYSTAL_MATERIALS`, index-aligned with
`WEEKDAY_PALETTES`): same geometry, different finish - calcite, rust quartz,
selenite, obsidian, amethyst, olivine, rhodonite. The hue stays the day's own
`stalEdge`: the colour circle is measured full (`COIN_BASE_CLR` plus the state
colours), the day rock lands within 20 degrees of a signal colour on six of seven
worlds, and rotating away only pushes three worlds onto the same blue-violet. What
separates a crystal from a coin is therefore **place** (welded to the wall vs a
small moving object in the corridor), **value** (terminations lift toward white)
and **form**, never hue.

**Breaking one sounds and looks like glass, not gravel** (`sfxCrystalCrack` in
`audio.js`, `burstCrystalShards` in `systems.js`). The sound's signature is not the
noise burst but the four INHARMONIC PARTIALS that ring on after it (ratios
1 / 1.41 / 1.93 / 2.57 off 2050 Hz, decaying 0.15-0.34s), around a brighter and
shorter fracture transient, a short high body, scattering shard ticks and half the
rock's low thump. Measured against the sound it replaces: loudest-50ms -20.8 vs
-21.3 dB (level-matched, so the hierarchy holds), decay 0.20s vs 0.10s, and the
band split moves from 27/22/52 to 4/17/80 low/mid/high. The fundamental sits at
2050 Hz rather than 3100 deliberately, so the first partial lands in the MID band
and the sound has body on a phone speaker. Judged by offline render through the
real bus, never by ear - see the `reference_audio_method` memory.
The visual half is `burstCrystalShards`: tumbling slivers (`long`/`rot`/`spin` on
the ordinary particle, drawn as a triangle instead of a dot) thrown ALONGSIDE the
round dust, never instead of it - the dust sells the impact, the shards sell the
material. **All four ways of touching a crystal throw them** - measured 14 on a
bullet kill, 18 on the bomb-clear behind a shield, 8 on the break-off and 22 on a
fatal hit. That last one was missing at first and is the one that matters most:
flying into a crystal is by far the most common contact, and it lands in the death
freeze frame, right where `drawDeathFreeze()`'s reticle is contracting. The world
is frozen there, so the shards hang as a starburst rather than animating, which
reads better than motion would. **No crack sound on the fatal hit** - `sfxDie` owns
frame 0 and is ~8 dB louder, so it would only mask it. Both are gated on `CRYSTAL_STALS`, so the one switch reverts picture and
sound together. **The LANDING keeps the rock thud** (`sfxStalCrack`): that is a
chunk striking the floor, not a fracture.

**A falling spike drops the CRYSTAL, not the rock socket.** Nest crystals and the
rock lip stay behind on the ceiling as an empty socket - which doubles as a
telegraph - and only the load-bearing crystals fall, so the falling picture stays
congruent with the triangle that falls with it. That matters: the "nest crystals
are unreachable" argument rests on the wall being in front and the main crystal
behind, and a free-falling chunk has neither (measured 687px^2 of theoretically
clippable nest area at the wall, 0 of it reachable by any trajectory, against
1809px^2 in free fall). **On landing nothing rotates** - the chunk stays as it
fell, tip buried like a nail in wood, which is also the only reading consistent
with `stalHit()`, where a falling spike keeps `ay = b.top + fy` and
`ty = b.top + length + fy`. The burial is done by LENGTHENING the shafts
(`CRYSTAL_LAND_SINK`), never by translating the body down - translating sinks the
base too and leaves the collision standing above the drawing.

**Falling stalactites** (`FALL_LEAD`/`FALL_SPAN` in `constants.js`, `fallSpacing()` in
`world.js`, `stalFallY`/`updateFallingStals` in `systems.js`): from `FALL_START_WX`
(S7, ~score 493; `nextFallWx` set in `startPlay`; the first one lands a bit later, since
the cursor flags the next *single* non-chicane ceiling spike after it),
a seeded cadence flags it to break loose. While loose it **shakes left/right**
(the draw loop's `wobX`, ramping as it nears the detach point) plus trickles dust, so the
player can spot which spikes drop. It detaches when the player is within `FALL_LEAD` (and
still clearly ahead), then **falls the full corridor** over `FALL_SPAN` world-px of scroll
(`stalFallY` = `(corridor - length)·t²`, **scrollX-indexed so a blue coin can't desync
it**, same as the ghost) until the tip meets the far wall - it becomes a floor spike and
the dodge is unambiguously "go over it". That distance is recomputed **live every
frame**, never frozen at detach: the corridor keeps moving after a spike lets go
(`gapBonusVisual` easing in, a deep chamber, `_halfGap` drift), and a captured value left
spikes hanging in mid-air - measured 5 of 33 in one run, up to 3.8 player diameters above
the floor, because a landed spike kept its frozen offset while the floor moved away.
Guarded in `test-collision.js`. The gap above is
`>= 1.2 * halfGap` (stalLenFrac hard-caps length at 0.8). Then it just scrolls past.
`fy` is folded into `stalHit`/`stalHitBullet`/`triggerBombExplosion`/the draw loop so
collision and render always agree. Bullets/bombs kill a falling one like any stalactite.
`fallSpacing()` runs `~3400 -> 2000` world-px over `_prog2`, floored at 1800.

## Boulders
Large static rounded rock (`src/systems.js` `makeBoulder`/`maintainBoulders`, from
`BOULDER_START_WX` = S4 / ~score 252 since the 2026-09-13 flight plan (was 5100 / ~85, then 6620), `boulderSpacing()` in `world.js` - a sparse set-piece cadence,
floor 2400px). Unlike a mine it is telegraphed by sheer size and **never spans the corridor**: radius is bounded (`R <= min(halfGap - 2.6*PR, 0.26*halfGap)`)
and the centre is nudged a seeded amount toward one wall, so there is always a pass above
AND below - one easy, one a squeeze. It asks "commit up or down" rather than "react".
Circle-circle collision (`update.js`), same shield-absorb + shove-clear as a mine. Bombs
clear boulders; player bullets just spark off (solid rock, not a destructible hazard).
Seeded via `_deepHash`, no `rng()`-stream impact.

Started at world-x 84000 (~score 1400) until 2026-09-11. A replay audit against the real
daily leaderboard (D1 `tunl_scores`) showed that meant **no player had ever seen one**:
28 recorded player-days, median daily best 70, highest ever 169 - and 84000 is ~109 real
seconds of flawless flight. Moving it to 5100 is also the *forgiving* direction, not the
harsh one, because `makeBoulder` bounds the radius by the corridor: measured across the
sample grid the narrow pass is 1.74 player diameters at score 85 versus 1.11 at score
1400. Measured across 8 day-seeds the first boulder lands at score 85 on 7 of them and
by score 150 on the last. Same reasoning moved falling stalactites 12000 -> 7800.
**Don't push this content back out past ~score 170 without new leaderboard data showing
players actually get there.**
(The 2026-09-13 flight plan then moved boulders to S4, ~score 252, on the "far too hard"
feedback and the safe opening's +50 baseline. The rule stands relative to that: don't push
it further out without leaderboard data.)

**Shrunk 2026-09-13 on player feedback ("verdammt schwer zu umfliegen")**: radius cap
0.42 -> 0.30 of halfGap, pass margin 2 -> 2.6 PR (placement and stalactite veto alike).
Measured over 8 day-seeds to wx 40000: rock diameter 1.91 -> 1.36 player diameters,
narrow pass 1.22 -> 1.52, wide pass 1.92 -> 2.20, count 64 -> 71. A 3.0 PR margin was
tried and rejected - it dropped the count to 29 (deep boulders stopped fitting).
Same day, shrunk once more on request: radius cap 0.30 -> **0.26** of halfGap.

**Rock islands, not balls (2026-09-13, on request).** `r` is now the vertical
half-THICKNESS bound only; the horizontal half-length `hl` = r x a seeded stretch
(1.7-2.6), hard-capped at `BOULDER_MAX_HALF_LEN` = 100 world-px (`systems.js`), so the
narrow-pass guarantees above are unchanged. Four seeded outline families
(`_islandProfile`): lens, teardrop, peanut, shelf - top and bottom generated separately,
so none is mirror-symmetric. Shelf gets a smaller slice of the roll because its thin face
survives placement far more often (an even roll made it 43% of islands). The outline is a
polygon on Chebyshev samples (`BOULDER_U`), and that exact polygon is both drawn
(`draw.js`) and collided against (`boulderHit`, shared by ship, bullets and bombs) -
verified to agree within 1px. `hl` is world-px keyed off the REFERENCE radius, so the
island covers the same world-x on every device. Placement (`_fitIsland`) checks both
passes at every outline sample against that sample's own bounds and every overlapping
spike, falling back to a shorter island (`BOULDER_STRETCH_FALLBACK`) before giving up.
Measured over 8 day-seeds to wx 60000, circle -> island: count 109 -> 108, narrow pass
median 1.89 -> 1.93 / min 1.48 -> 1.46 player diameters, length median 1.7 -> 3.4 / max
3.8 -> 5.8 diameters; 70% of islands get their full stretch. `test-cave.js` re-checks
both passes along the whole outline.

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

## Warp portal ("Sog")

Reward set-piece, not a hazard - the third verb ("escaping") next to reacting
(stalactites) and committing (boulders). The one way in is a hoop in the corridor
(`makePortal`/`maintainPortals`/`_makePortalAt`, from `PORTAL_START_WX` = 3000,
~score 50) calling `triggerWarp(accuracy)` (`src/systems.js`) when flown through.
Long-form rationale and the audit numbers: `docs/design-history.md` -> "Warp portal".

**There is no warp coin, and don't reintroduce one** without a silhouette that reads at
`COIN_R` - the 11.0 coin read as an unidentifiable "pill" and was removed 2026-09-13 on
request, along with `WARP_COIN_INTERVAL_SEC`, `nextWarpWx`, its `rngCoin()` draws,
`T.notifWarp` and the `Math.random()` duration fallback.

**The ring's cadence is a DUTY CYCLE, not a world-px number** (`portalSpacing()`,
`world.js`, `lerp(6500, 10000, progAt) * (1 + 4*prog2At)` - do not revert to a
progAt-only curve). Growth is keyed to `prog2At` because `progAt` saturates at score 233
and any flat-widened candidate pushes ring #2 past score 250, i.e. most players would
ever see one ring. Measured now: one ring per 11-46s across the score bands, warp live
5.7% of the run, hazard-immune 11.0%. **Re-measure the duty cycle, never the world-px
number, before moving this again** - the 11.0 curve read as reasonable and was 8-13x too
frequent (warp live 54.6%, a 1.58x score rate on the shared leaderboard).

**Look: a tall hoop the ship threads ("Reif") - do not go back to flat ovals.**
`draw.js` draws a tall ellipse (height = `Math.max(p.r, PR*1.6)`, exactly
`portalHitTol`) in two passes: glow, flow lines and the far arc **before** the player,
the near arc plus a chase light **after** it (`_portalBand`), so the ship visibly flies
through. Stacked soft strokes with a near-white core replace `shadowBlur` - the core is
what keeps it legible on the violet Friday rock. A used hoop widens as `usedFade` runs
out. While a warp is live, white speed streaks sweep the tunnel (`WARP_STREAKS`, alpha
riding `warpScrollFactor()`), placed from `scrollX` + `_rockHash` - stateless, no
`rng()`. Proposals: https://claude.ai/code/artifact/7fab90a9-4ad8-4729-a1d6-04d56d49ddd8

**The hit window IS the drawn radius** (`Math.max(p.r, PR*1.6)`, never a flat `PR*3.2`),
so the accuracy gradient spans the picture honestly. **A warp-vacuumed coin banks in
full but does not raise the combo** (`systems.js`, the `warpVacuum` branch) - letting
them increment let the combo's quadratic term manufacture 11-54 bonus points per warp,
worst at low score. A combo *earned* before arriving still pays on every vacuumed coin;
that part is skill and is kept deliberately.

**What a live warp does.** For `WARP_DUR_MIN..MAX_SEC` (~1.1-1.6s, picked linearly by
the crossing's accuracy - dead centre earns the max), `scrollSpd()` is multiplied by
`warpMult` (`state.js`, rolled once at trigger from `WARP_MULT_MIN..MAX` 2.2-2.8x
against the player's live `_prog2`, held fixed for the whole warp; capped at
`_prog2 >= 1`). `warpScrollFactor()` (`world.js`) is the mirror of `slowScrollFactor()`
and is folded into the identical five call sites. The corridor widens (`WARP_GAP_MULT`,
eased like `gapBonusVisual`, **`boundsAt()` only, never `boundsBase()`** - no placement
decision may depend on a player state), every stalactite/mine/boulder/cannon-shot is
skipped and drawn ghosted at `warpFade`, and every gold coin on screen is auto-collected.
Power-up coins still have to be flown to. The music surges via `bgmSetWarp` (mirror of
`bgmSetSlow`, same `_bgmNode.playbackRate`): 1.35x on trigger, gliding back to 1.0x -
deliberately far under the gameplay 2.2-2.8x, because a track played that fast reads as
chipmunked, not fast.

**A blue coin collected DURING a warp is banked, not started** (`state.js slowPending`,
released on `update.js`'s warpTime falling edge next to the `HIT_INVULN_SEC` grant, which
also arms `bgmSetSlow`). Same cap, so banking can never buy more than flying it normally.
Started immediately it would be unfeelable (0.6x against 2.2-2.8x is still faster than
normal) and would drain 27-40% of its window while the player is hazard-immune anyway -
and it broke the music, since both helpers share `playbackRate` and `cancelScheduledValues`.
The HUD shows a banked slow as the cyan bar held full, dimmed and pulsing: a draining bar
would lie, nothing would look swallowed. `triggerWarp` still clears a slow that is
*already* running ("you are now fast, not fast-and-slow-at-once").

**Exiting a warp grants `HIT_INVULN_SEC`** (`update.js`, warpTime falling edge, `Math.max`
against whatever is running, never a shortening) - collision solidifies with the corridor
still easing in from `WARP_GAP_MULT`-wide (`warpWidenVisual`), so a hazard can be uncomfortably close. This is
the reuse `constants.js`'s own `HIT_INVULN_SEC` doc comment anticipated, not a new constant.

**The wall is never a warp-caused death, by construction, not by tuning.**
`update.js`'s wall check treats `warpTime > 0` exactly like `invulnT > 0`: clamp back
inside the corridor instead of killing. `WARP_GAP_MULT` only decides how much clamping
the player feels. (The warp's drift can outrun `MAX_VY` at the wave's peak slope, and
amplitude, frequency and `warpMult` all still climb - so this must not be a tuned margin.)

**Deliberately real seconds, not a world-px distance.** No `rng()` draw, nothing any
other player's cave depends on - the same category of per-player effect as the blue
coin's `slowTime`, not a cross-device-fairness concern. `scrollX` still advances one
`dt` at a time through the ordinary `maintain*()` loops, which already backfill an
arbitrary jump (a backgrounded tab does the same).

**Portal placement reuses the coin contract** (`coinBlockedByStal()` in `_makePortalAt`).
The ring's *drawn* radius (`PORTAL_R_FRAC` of the halfGap at that wx) is spectacle; only
its centre point has to be provably flyable, and that question is already answered for
every coin in the game. So: never a bespoke geometric veto, which is exactly the mistake
that nearly wiped out
boulders and cannons (see `SPAWN_AHEAD_*` above). `PORTAL_RETRY_OFFSETS` follows the same
retry-on-veto pattern as mines/cannons/boulders. The ring triggers on an **x-crossing
test**, not a circle overlap: a fast-scrolling frame can jump the player past a thin ring
in one step, a risk that only grows once `warpScrollFactor()` is live.


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

