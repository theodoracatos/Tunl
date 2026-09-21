# Warp portal

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the measurements and rejected alternatives behind them are in `docs/design-history.md` (the 2026-09-21 condensing moved the removed paragraphs there verbatim, under "Narratives moved out of docs/agents").

## Warp portal ("Sog")

Reward set-piece, not a hazard - the third verb ("escaping") next to reacting
(stalactites) and committing (boulders). A hoop in the corridor
(`makePortal`/`maintainPortals`/`_makePortalAt`, from `PORTAL_START_WX`) calls
`triggerWarp(accuracy)` (`src/systems.js`) when flown through. Audit numbers:
`docs/design-history.md` -> "Warp portal".

**There is no warp coin, and don't reintroduce one** without a silhouette that reads at
`COIN_R` - the 11.0 coin read as an unidentifiable "pill" and was removed with all its
plumbing.

**The ring's cadence is a DUTY CYCLE, not a world-px number** (`portalSpacing()`,
`world.js`; growth keyed to `prog2At`, because `progAt` saturates at score 233 and a flat
widening leaves most players seeing one ring). **Re-measure the duty cycle (share of the run
with a warp live / hazard-immune), never the world-px number, before moving this** - the
11.0 curve read as reasonable and was 8-13x too frequent, a big score-rate edge on the
shared leaderboard.

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
so the accuracy gradient spans the picture honestly. **A warp-vacuumed coin banks in full
but does not raise the combo** (`systems.js`, `warpVacuum` branch) - the combo's quadratic
term would manufacture points per warp. A combo *earned* before arriving still pays.

**What a live warp does.** For `WARP_DUR_MIN..MAX_SEC` (by crossing accuracy - dead centre
earns the max), `scrollSpd()` is multiplied by `warpMult` (`state.js`, rolled once at
trigger from `WARP_MULT_MIN..MAX` against live `_prog2`, held for the warp).
`warpScrollFactor()` (`world.js`) mirrors `slowScrollFactor()` at the same five call sites.
The corridor widens (`WARP_GAP_MULT`, **`boundsAt()` only, never `boundsBase()`** - no
placement may depend on a player state), every hazard is skipped and drawn ghosted at
`warpFade`, and gold on screen is auto-collected; power-ups must still be flown to. Music
surges via `bgmSetWarp` (mirror of `bgmSetSlow`), deliberately far under the gameplay
multiplier - faster reads as chipmunked.

**A blue coin collected DURING a warp is banked, not started** (`state.js slowPending`,
released on `update.js`'s warpTime falling edge, which also arms `bgmSetSlow`). Same cap.
Started immediately it would be unfeelable, drain its window while hazard-immune, and break
the music (both helpers share `playbackRate`). The HUD shows a banked slow as the cyan bar
held full, dimmed and pulsing. `triggerWarp` still clears a slow that is *already* running.

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
that nearly wiped out boulders and cannons (see `fairness.md`, `SPAWN_AHEAD_*`).
`PORTAL_RETRY_OFFSETS` follows the same retry-on-veto pattern as mines/cannons/boulders.
The ring triggers on an **x-crossing test**, not a circle overlap: a fast-scrolling frame can
jump the player past a thin ring in one step, a risk that only grows once
`warpScrollFactor()` is live.
