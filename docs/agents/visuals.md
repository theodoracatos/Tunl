# Typography, HUD, depth light

Rules, constants and traps for this area. CLAUDE.md keeps a one-line version of each rule; the measurements and rejected alternatives behind them are in `docs/design-history.md` (the 2026-09-21 condensing moved the removed paragraphs there verbatim, under "Narratives moved out of docs/agents").

## Typography and title accent (2026-09-16, do not revert to Courier)

`src/fonts.js` (loaded second) defines the only two font stacks: `FONT_UI` (Chakra Petch -
logo, labels, buttons, body) and `FONT_NUM` (JetBrains Mono - numbers that count or line
up). Every `ctx.font` interpolates one of them; no literal family name anywhere else.
Study: https://claude.ai/artifact/QPvLrDmGiU6przXNwXLV9y
- **The fonts ship as base64 woff2 inside `fonts.js`**, not as files: a `.js` in `src/` is
  the one thing iOS, Android (`copyGameFiles` copies `src/**/*.js` only) and
  `build-play.mjs` all carry. Subset with fonttools (Latin ranges, + basic Cyrillic for the
  mono); other scripts fall through to the system face. Medium cuts are registered as weight
  400 (code only asks for bold or default).
- `main.js` holds the first frame on `fontsReady`, capped at `FONT_WAIT_MS`. Headless
  Chrome's `--virtual-time-budget` never settles while a FontFace loads - screenshot via
  DevTools protocol with real waits.
- **The TUNL wordmark does not assume a monospace grid.** `drawTitleScreen` measures cap
  height off 'T', stem off 'I' and per-letter advances, and strokes the U channel from the
  real 'U' ink box (chamfered, thinner than the stem). Set `textAlign`/`textBaseline`
  BEFORE those `measureText` calls - bounding boxes are relative to the alignment.
- **The title's left column spaces itself by measured ink**, not only H-fractions (`colGap`
  in `drawTitleScreen`). WebKit and Chromium place `textBaseline 'middle'` differently for
  Chakra Petch (an overlap on a 12 mini looked fine in Chrome). **Test layout on WebKit.**
- **HUD score, BEST and the world intro banner sit on the ALPHABETIC baseline from measured
  ink**, never `textBaseline 'top'`/`'middle'` (WebKit puts the em-box top lower than
  Chromium). The banner never sits above the HUD stack (`hudY`).
- **Title screen accent = the day's `wallBase`**, same rule as the debriefing (logo halo, the
  U, underline, world line, ALL SHIPS pill, rail rims). Hero ring and ship keep the SKIN
  colour; the planet line is neutral (logo > world > planet). Deliberately NOT done: a PLAY
  button (tapping anywhere starts) and rail text labels (no room at 667x375).

## HUD instrument, web frame (2026-09-16 design pass, proposals 3, 4, 6)

- **HUD** (`drawHUD`, constants.js `HUD_SPARK_*`): under the live score a thin record rail
  fills toward the all-time best (orange once ON FIRE, pulsing gold once `pbPassed`, gold
  tick = the record); a combo chip `xN` sits right of the score's live width with a bar
  draining over `coinComboWindow`; every coin that pays points sends a spark in its type's
  colour to the score, which "swallows" it (`hudBump`, scale + gold tint). A near-miss
  bumps immediately. All presentation: `bonusScore` is still credited at pickup. The world
  intro banner and the milestone flash are both placed below `hudY`, never over the stack.
- **No parallax background - tried and removed the same day (do not re-add).** Far rock
  silhouettes read as "extremely confusing" even at near-void contrast: any second set of
  wall-shaped edges moving at another speed competes with the real walls.
- **Web frame** (`tunl.html` `body.web-framed`, `main.js _syncWebFrame`): hairline + glow in
  the day's rock around the canvas, only with >= 32px of letterbox room, `isWeb()` only.

## Depth light (background, 2026-09-13)

`constants.js` `DEPTH_LIGHT_*` doc, `draw.js` `depthLightAt()` / `drawWorld()`. The void
behind the walls is **lifted toward the day's `wallBase` and steps darker at each sector
boundary** (`DEPTH_LIFT` and its per-sector ratios, eased over `DEPTH_STEP_EASE_WX`, plain
`WEEKDAY_BG` from S4), plus a **warm cave-mouth light** from behind the ship off the left
edge (`DEPTH_MOUTH_*`; centre off-screen so its hot core never shows), fading by S4. Three
rules (study: https://claude.ai/code/artifact/ea963ae1-1c8b-4bf4-9587-c2f90286d666):
- **Never literally bright.** A light ground killed the contrast of the PEARL ship, gold
  coins, the white score and every additive glow exactly where beginners fly.
- **Steps, not a fade.** A continuous fade over ~30s is below what a player notices while
  dodging; a step at a sector boundary is not.
- **Light behind the ship, never ahead.** Hazards arrive from the right, and that side
  stays as dark as it was.
Pure function of world-x via `sectorAt`, draw-only, no gameplay value touched, same on every
device and not `isWeb()`-gated. `document.body.style.backgroundColor` follows the lift, which
only changes during a step (a few dozen writes per run, not per frame).

