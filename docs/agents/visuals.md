# Typography, HUD, depth light

Moved verbatim from CLAUDE.md on 2026-09-21 (progressive disclosure). CLAUDE.md keeps the one-line rule and points here.

## Typography and title accent (2026-09-16, do not revert to Courier)

`src/fonts.js` (loaded second, right after `web.js`) defines the only two font stacks the
canvas uses: `FONT_UI` (Chakra Petch - logo, labels, buttons, body) and `FONT_NUM`
(JetBrains Mono - numbers that count or line up: live score, death-screen score/best/rank/
list, title stat values, rail badges, the share card's big score). Every `ctx.font` string
interpolates one of them; there is no literal family name anywhere else. Until 12.2 all of
it was `'Courier New',monospace`. Design study with the reasoning:
https://claude.ai/artifact/QPvLrDmGiU6przXNwXLV9y
- **The fonts ship as base64 woff2 inside `fonts.js`**, not as files, because a `.js` in
  `src/` is the one thing iOS (folder reference), Android (`copyGameFiles` copies
  `src/**/*.js` only) and `build-play.mjs` (script concat) all already carry. Subset with
  fonttools to Latin/Latin-1/Latin Ext-A/General Punctuation (+ basic Cyrillic for the mono),
  ~44 KB total. Chakra Petch has no Cyrillic, so Russian falls through to JetBrains Mono per
  glyph; ja/ko/zh/ar/hi fall through to the system face exactly as they did under Courier.
  The Medium cuts are registered as weight 400 (the code only ever asks for bold or default).
- `main.js` holds the first frame on `fontsReady`, capped at `FONT_WAIT_MS` (400ms).
  Headless Chrome's `--virtual-time-budget` never settles while a FontFace is loading, so
  screenshot via DevTools protocol with real waits instead.
- **The TUNL wordmark no longer assumes a monospace grid.** `drawTitleScreen` measures cap
  height off 'T', stem width off 'I' and per-letter advances, and strokes the U channel from
  the real 'U' ink box with chamfered corners, at 0.51x the stem (full stem weight read as
  too heavy on device). Set `textAlign`/`textBaseline` BEFORE those `measureText` calls -
  bounding boxes are relative to the current alignment.
- **The title's left column spaces itself by measured ink, not only by H-fractions**
  (`colGap` in `drawTitleScreen`): world line, planet line and the REKORD plate each move
  down if the line above would come closer. WebKit and Chromium place `textBaseline
  'middle'` differently for Chakra Petch, so the world name overlapped REKORD on an iPhone
  12 mini while Chrome at the same 812x375 looked fine. Test layout on WebKit, not only Chrome.
- **HUD score is FS*0.072, not 0.085** (JetBrains Mono figures are ~28% taller than
  Courier's). Score, BEST and the world intro banner are placed on the ALPHABETIC baseline
  from measured ink, never on `textBaseline 'top'`/`'middle'`: WebKit puts the em-box top
  of these fonts ~15pt lower than Chromium, which on an iPhone 12 mini pushed BEST into the
  banner. The banner also never sits above the HUD stack (`hudY`).
- **Title screen accent = the day's `wallBase`**, same rule as the debriefing: logo halo and
  glow, the U, underline, world line, the ALL SHIPS pill and rail button rims (the floor light
  under the hero ship was removed 2026-09-19). The hero ring and ship keep the SKIN colour. The planet line went
  neutral so the order reads logo > world > planet. Deliberately NOT done from the study:
  a PLAY button (tapping anywhere starts a run, and see Onboarding on title-screen CTAs)
  and rail text labels (no room between the ring and a 5-icon rail at 667x375).

## HUD instrument, web frame (2026-09-16 design pass, proposals 3, 4, 6)

- **HUD** (`drawHUD`, constants.js `HUD_SPARK_*`): under the live score a thin record rail
  fills toward the all-time best (orange once ON FIRE, pulsing gold once `pbPassed`, gold
  tick = the record); a combo chip `xN` sits right of the score's live width with a bar
  draining over `coinComboWindow`; every coin that pays points sends a spark in its type's
  colour to the score, which "swallows" it (`hudBump`, scale + gold tint). A near-miss
  bumps immediately. All presentation: `bonusScore` is still credited at pickup. The world
  intro banner and the milestone flash are both placed below `hudY`, never over the stack.
- **No parallax background - tried and removed the same day (do not re-add).** Two far rock
  silhouettes scrolling behind the walls (proposal 5) read as "extremely confusing" in
  playtest, even after their contrast was cut to near the void colour: in a game whose
  whole skill is reading where the walls are, any second set of wall-shaped edges moving
  at a different speed competes with the real ones.
- **Web frame** (`tunl.html` `body.web-framed`, `main.js _syncWebFrame`): hairline + glow in
  the day's rock around the canvas, only with >= 32px of letterbox room, `isWeb()` only.

## Depth light (background, 2026-09-13)

`constants.js` `DEPTH_LIGHT_*` doc, `draw.js` `depthLightAt()` / `drawWorld()`. The void
behind the walls is no longer a flat `WEEKDAY_BG` at every depth: it is **lifted toward the
day's own `wallBase` and steps darker at each sector boundary** (S0 5% since the 2026-09-19 approach, was 15%; then 62% / 34% / 14%
of that, plain `WEEKDAY_BG` from S4, each step eased over `DEPTH_STEP_EASE_WX`), and a
**warm cave-mouth light** (warm white tinted 60% toward the day's rock) falls in from behind
the ship off the left edge, fading out by S4. Softened 2026-09-16 ("too glaring"): alpha
0.30 -> 0.24 (-> 0.10 with the 2026-09-19 approach), tint 35% -> 60%, gradient centre moved to `DEPTH_MOUTH_X` = -0.30W so its hot
core is never on screen, and a 6-stop falloff (`DEPTH_MOUTH_STOPS`) instead of a 3-stop cone. The title screen is the approach's city now, not the mouth.
Three rules, each from the variant study
(https://claude.ai/code/artifact/ea963ae1-1c8b-4bf4-9587-c2f90286d666):
- **Never literally bright.** A light-to-dark ground was measured and rejected: the
  near-white PEARL ship, gold coins, the white score and every additive `'lighter'` glow
  lost most of their contrast exactly where beginners fly. `DEPTH_LIFT` and
  `DEPTH_MOUTH_ALPHA` are capped low on purpose.
- **Steps, not a fade.** A continuous fade over ~30s is below what a player notices while
  dodging; a step at a sector boundary is not.
- **Light behind the ship, never ahead.** Hazards arrive from the right, and that side
  stays as dark as it was.
Pure function of world-x via `sectorAt`, draw-only, no gameplay value touched, same on every
device and not `isWeb()`-gated. `document.body.style.backgroundColor` follows the lift, which
only changes during a step (a few dozen writes per run, not per frame).

