// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── Approach ("Anflug", 2026-09-19) ──────────────────────────────────
// A run no longer opens inside the cave: the ship takes off over the day's metropolis at
// dusk (a skyline of plain silhouettes, three parallax layers), the mountain rolls in from
// the right and the ship flies through its rock mouth into the safe opening flight. The
// title screen IS that city, so the approach continues the picture the player tapped on.
// Concept + prototype: https://claude.ai/artifact/ECrpmHcPeTsREMwEtK6vNs
//
// Rules, each load-bearing:
// - **The city lies BEFORE world-x 0, never in it.** scrollX stays exactly 0 for the whole
//   approach; only a camera offset (approachLeft) moves, and drawWorld() draws the cave
//   translated by it. Score, sectors, spawners, the ghost, missions, milestones and
//   test-cave.js are therefore untouched - the cave is the same cave, pixel for pixel,
//   and every score still starts at 0 in the tunnel.
// - **No parallax behind a wall.** The skyline only ever exists left of the mountain,
//   where there are no walls; the rock covers it (the 2026-09-16 parallax removal was
//   about wall-shaped edges competing with real walls - see CLAUDE.md).
// - **Outside it can't hurt, inside the mouth it can.** Over the city the mountain face and
//   the screen edges just bounce the ship. From the mouth on the tunnel rule applies at once
//   (2026-09-19, "keine Gummiwände mehr"): a wall contact spends a hull scratch, and with
//   none left it kills - the same order as update.js's wall check. update.js returns before
//   every hazard, clock, achievement timer and ghost step while approachLeft > 0, so nothing
//   is started early and nothing is "free".
// - **Draw-only, per player, no rng().** The skyline is hashed from the day, not drawn
//   from any spawn stream; lengths are screen px keyed off W, so it looks the same on
//   every device and has nothing to do with the shared daily cave.
// - **Beacons in the day colour, never red** (red belongs to death markers).

const APPROACH_SEC         = START_RAMP_SEC + 4.0;   // the cave arrives 4s later than it used to - every run, PLAY AGAIN included (user's call)
const APPROACH_EASE_SEC    = 0.5;                    // camera eases in from the title's slow drift
const APPROACH_LIP   = W * 0.25;    // mouth (narrowest point) -> world-x 0, where it has widened to the safe corridor
const APPROACH_FUN_T = W * 0.30;    // length of the mountain's upper face in front of the mouth
const APPROACH_FUN_B = W * 0.40;    // lower face / foothill (longer: the mountain stands on the city's ground)
const APPROACH_MOUTH_HG = H * 0.26; // half-height of the mouth opening
const APPROACH_TITLE_SPD = 110;     // title drift, same pace the old title cave scrolled at
const APPROACH_SHADOW    = 0.45;    // darkness just inside the mouth
const APPROACH_BLEND     = W * 0.04; // the sky dissolves into the cave's void over this much either side of the mouth
const CITY_LAYERS = [
    // f: parallax factor; h: silhouette heights as fractions of H; w: widths as fractions of W; tone: toward the night
    { f: 0.10, hMin: 0.30, hMax: 0.58, wMin: 0.018, wMax: 0.046, tone: 0.40 },
    { f: 0.26, hMin: 0.18, hMax: 0.44, wMin: 0.026, wMax: 0.064, tone: 0.66 },
    { f: 0.52, hMin: 0.07, hMax: 0.28, wMin: 0.034, wMax: 0.090, tone: 0.88 },
];
const MOON_X = 0.075, MOON_Y = 0.19, MOON_R = 0.042;   // screen fractions; clear of the title wordmark
const MOON_TONE = [232, 234, 242];                      // pale silver, tinted a little toward the day's rock
const MOON_MARIA = [[-0.30, -0.18, 0.28], [0.22, 0.10, 0.22], [-0.05, 0.38, 0.16], [0.34, -0.34, 0.12]];
const MOONLIGHT_RIM = 0.42;   // alpha of the cool rim the moon puts on roofs and left facades
const CITY_TILE = Math.ceil(W * 1.6);   // each layer's building list wraps at this width
// Lit windows (2026-09-24): the two far layers only, so the city switches its lights on while
// the ship flies over it. A window is lit while its hash is below the level; the level starts
// at the title's value (so the tap never pops) and rises to the mouth. Tone is warm, not the
// day colour: the day colour is for beacons.
const APPROACH_WIN_LAYERS = 2;
const APPROACH_WIN_LIT    = [0.22, 0.70];    // lit share: on the title / at the mouth
const APPROACH_WIN_ALPHA  = [0.32, 0.50];    // per layer, far to near
const APPROACH_WIN_TONE   = [255, 214, 150];
// Wind streaks (2026-09-24): air streaks in the SKY left of the mouth only (the sky clip
// ends at the mouth), fading in over the last APPROACH_STREAK_IN_SEC before it. Never inside the cave.
const APPROACH_STREAK_N      = 40;
const APPROACH_STREAK_IN_SEC = 1.8;
const APPROACH_STREAK_MAX    = 0.30;         // alpha at full strength
// Lip light (2026-09-24): the rock lip catches the dusk light in steps (steps, not a
// fade - see "Depth light"). [from, to] in px from the mouth (towards world-x 0); only the
// edge line is drawn (APPROACH_LIP_EDGE). The void inside stays dark, the light lies on the
// rock only. A wide inner band (a 16px stroke in three alpha steps) was removed 2026-09-29:
// it read as a milky glowing tube with blobs along the lower lip, and under the banner.
const APPROACH_LIP_TINT  = 0.35;             // warm daylight toward the day's rock
const APPROACH_LIP_STEPS = [[-W * 0.06, APPROACH_LIP * 0.33], [APPROACH_LIP * 0.33, APPROACH_LIP * 0.66]];
const APPROACH_LIP_EDGE  = [0.55, 0.32];     // edge line alpha per step
// [x seed px, y as fraction of H, speed factor]: fixed, private LCG (draw-only, never rng()).
const _APPROACH_STREAKS = (() => {
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: APPROACH_STREAK_N }, () => { const a = r(), b = r(); return [a * W * 1.6, 0.12 + b * 0.62, 0.6 + (a * 13.1 % 1) * 0.8]; });
})();

let approachLeft = 0;          // screen px until world-x 0 reaches the left edge; > 0 = approach live
let approachT = 0;             // seconds since the approach started (camera ease-in, banner)
let approachFull = 0;          // approachLeft at the start, for the banner's fade
let cityScroll = 0;            // camera distance flown over the city (title drift included, never reset)
let _approachBumpT = 0;        // throttles the city bump's haptic
let _approachWindIn = false;   // the wind has been cut at the mouth this run (audio.js approachWindEnter)
let _approachIntroOn = false;  // the world banner has been started this run
let _cityKey = '', _cityLayers = null;

// Seeded per cave day, so every day's metropolis differs a little. A private LCG, not rng():
// the spawn streams must never see a draw from here.
function _buildCity() {
    const day = _tunlActiveDayInt();
    const key = day + ':' + W + ':' + H;
    if (key === _cityKey) return;
    _cityKey = key;
    let s = (day * 2654435761) >>> 0;
    const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    _cityLayers = CITY_LAYERS.map((L, li) => {
        const bld = [];
        let x = 0;
        while (x < CITY_TILE) {
            const w = W * lerp(L.wMin, L.wMax, r());
            const h = H * lerp(L.hMin, L.hMax, Math.pow(r(), 1.6));
            const k = r();
            // kinds: 0 flat, 1 stepped crown, 2 spire, 3 slanted roof, 4 antenna mast
            const kind = k < 0.16 ? 1 : k < 0.27 ? 2 : k < 0.37 ? 3 : (k < 0.50 && li > 0) ? 4 : 0;
            const b = { x, w, h, kind, ph: r() * 6.283, win: null };
            if (li < APPROACH_WIN_LAYERS) {
                // Windows: flat [dx, dy, hash, ...] from the building's top-left. The hash is a
                // pure function of position and day (not r()), so the skyline itself is unchanged.
                const win = [];
                for (let wx = 4, ci = 0; wx < w - 5; wx += 7, ci++)
                    for (let wy = 8, ri = 0; wy < h - 6; wy += 9, ri++) {
                        const q = Math.sin((x + ci * 7.7) * 12.9898 + ri * 78.233 + li * 37.7 + day * 0.13) * 43758.5453;
                        win.push(wx, wy, q - Math.floor(q));
                    }
                b.win = win;
            }
            bld.push(b);
            x += w + (r() < 0.3 ? r() * W * 0.012 : 0);
        }
        return { f: L.f, tone: L.tone, bld };
    });
}

function _traceBuilding(x, b) {
    const top = H - b.h;
    ctx.moveTo(x, H + 2);
    ctx.lineTo(x, top);
    if (b.kind === 1) {
        ctx.lineTo(x + b.w * 0.2, top); ctx.lineTo(x + b.w * 0.2, top - b.h * 0.16);
        ctx.lineTo(x + b.w * 0.8, top - b.h * 0.16); ctx.lineTo(x + b.w * 0.8, top);
        ctx.lineTo(x + b.w, top);
    } else if (b.kind === 2) {
        ctx.lineTo(x + b.w * 0.44, top); ctx.lineTo(x + b.w * 0.5, top - b.h * 0.34);
        ctx.lineTo(x + b.w * 0.56, top); ctx.lineTo(x + b.w, top);
    } else if (b.kind === 3) {
        ctx.lineTo(x + b.w, top - b.h * 0.12);
    } else if (b.kind === 4) {
        ctx.lineTo(x + b.w * 0.58, top); ctx.lineTo(x + b.w * 0.58, top - b.h * 0.22);
        ctx.lineTo(x + b.w * 0.63, top - b.h * 0.22); ctx.lineTo(x + b.w * 0.63, top);
        ctx.lineTo(x + b.w, top);
    } else {
        ctx.lineTo(x + b.w, top);
    }
    ctx.lineTo(x + b.w, H + 2);
    ctx.closePath();
}

// The moonlit part of a building's outline: the upper third of its left wall and its roof.
function _traceRim(x, b) {
    const top = H - b.h;
    ctx.moveTo(x + 0.5, top + b.h * 0.33);
    ctx.lineTo(x + 0.5, top);
    if (b.kind === 1) {
        ctx.lineTo(x + b.w * 0.2, top); ctx.moveTo(x + b.w * 0.2, top);
        ctx.lineTo(x + b.w * 0.2, top - b.h * 0.16); ctx.lineTo(x + b.w * 0.8, top - b.h * 0.16);
        ctx.moveTo(x + b.w * 0.8, top); ctx.lineTo(x + b.w, top);
    } else if (b.kind === 2) {
        ctx.lineTo(x + b.w * 0.44, top); ctx.lineTo(x + b.w * 0.5, top - b.h * 0.34);
        ctx.moveTo(x + b.w * 0.56, top); ctx.lineTo(x + b.w, top);
    } else if (b.kind === 3) {
        ctx.lineTo(x + b.w, top - b.h * 0.12);
    } else if (b.kind === 4) {
        ctx.lineTo(x + b.w * 0.58, top); ctx.lineTo(x + b.w * 0.58, top - b.h * 0.22);
        ctx.lineTo(x + b.w * 0.63, top - b.h * 0.22);
        ctx.moveTo(x + b.w * 0.63, top); ctx.lineTo(x + b.w, top);
    } else {
        ctx.lineTo(x + b.w, top);
    }
}

// Rock profile in approach space: u = world-x the point would have (negative before the cave).
function _mouthNoise(u) { return (Math.sin(u * 0.045) * 3 + Math.sin(u * 0.13 + 1.3) * 1.4 + Math.sin(u * 0.011 + 0.4) * 5) * (H / 440); }
function approachRock(u) {
    if (u >= 0) {
        const b = boundsAt(u);
        return { top: Math.max(WALL_EDGE_SLIVER, b.top), bot: Math.min(H - WALL_EDGE_SLIVER, b.bot) };
    }
    const um = u + APPROACH_LIP;          // distance past the mouth
    const mTop = H / 2 - APPROACH_MOUTH_HG, mBot = H / 2 + APPROACH_MOUTH_HG;
    if (um >= 0) {
        // Inside the mouth: widen to the cave's own soft edge at world-x 0, so rock meets rock.
        const b0 = approachRock(0), t = um / APPROACH_LIP, e = t * t * (3 - 2 * t);
        return { top: lerp(mTop, b0.top, e) + _mouthNoise(u) * (1 - e), bot: lerp(mBot, b0.bot, e) - _mouthNoise(u + 700) * (1 - e) };
    }
    let top = -H, bot = 2 * H;
    if (um > -APPROACH_FUN_T) { const t = 1 + um / APPROACH_FUN_T; top = lerp(-H * 0.18, mTop, t * t * (3 - 2 * t)) + _mouthNoise(u); }
    if (um > -APPROACH_FUN_B) { const t = 1 + um / APPROACH_FUN_B; bot = lerp(H * 1.18, mBot, Math.pow(t, 1.6)) - _mouthNoise(u + 700); }
    return { top, bot };
}

// Screen x of world-x 0 while drawing (drawWorld translates the cave by it). The title
// screen shows only the city, so its offset is far off the right edge.
function approachCamX() { return phase === 'title' ? W * 4 : approachLeft; }

function approachStart() {
    _buildCity();
    approachT = 0;
    approachLeft = approachFull = scrollSpd() * APPROACH_SEC;
    _approachBumpT = 0;
    levelIntroT = 0;   // the world banner waits for the mouth (approachStep)
    _approachIntroOn = false;
    // Wind (audio.js): seconds until the mouth reaches the ship. The camera's ease-in covers
    // the average of both speeds over APPROACH_EASE_SEC (smoothstep), then runs at scrollSpd().
    _approachWindIn = false;
    const spd = scrollSpd(), easeDist = APPROACH_EASE_SEC * (APPROACH_TITLE_SPD + spd) / 2;
    approachWindOn(START_RAMP_SEC, APPROACH_EASE_SEC + (approachFull - PX - APPROACH_LIP - easeDist) / spd);
}

// Advance the camera. Runs under the launch ramp too, so the ship takes off over a moving city.
function approachStep(dt) {
    approachT += dt;
    const e = Math.min(1, approachT / APPROACH_EASE_SEC);
    const d = lerp(APPROACH_TITLE_SPD, scrollSpd(), e * e * (3 - 2 * e)) * dt;
    cityScroll += d;
    approachLeft = Math.max(0, approachLeft - d);
    _approachBumpT = Math.max(0, _approachBumpT - dt);
    // The ship is in the mouth (same line approachUpdate's lethal-wall rule uses): cut the wind.
    if (!_approachWindIn && approachLeft <= PX + APPROACH_LIP) { _approachWindIn = true; approachWindEnter(); }
    // The mouth has passed the middle of the screen: the world banner starts, as "ENTERING THE
    // TUNL" finishes fading (2026-09-29, user's call; it used to wait for world-x 0 to reach the
    // left edge). A share of the start speed's seconds, so the same moment on every width.
    if (!_approachIntroOn && approachLeft - APPROACH_LIP <= W / 2) { _approachIntroOn = true; levelIntroT = LEVEL_INTRO_DUR; }
}

// The whole play frame while approaching, called from update.js right after the physics
// integration (which already ran): camera, soft collision, pitch and trail - nothing else.
function approachUpdate(dt) {
    approachStep(dt);
    const r = PR;
    let top = 0, bot = H;
    for (const dx of [-r * 0.7, 0, r * 0.7]) {
        const b = approachRock(PX + dx - approachLeft);
        top = Math.max(top, b.top); bot = Math.min(bot, b.bot);
    }
    if (py - r < top || py + r > bot) {
        const hitTop = py - r < top, edge = hitTop ? top : bot;
        if (PX - approachLeft >= -APPROACH_LIP) {
            // In the mouth: the tunnel's own wall rule (update.js), shield first, then scratches.
            if (invulnT > 0 || wallGraceT > 0) clampShipToWall(top, bot, r);
            else if (hullScratches > 0 && shieldCount === 0) hullScratch(top, bot, r);
            else {
                deathCause = hitTop ? 'wallTop' : 'wallBot';
                markDeathHit(PX, edge, r);
                die();
            }
        } else {
            // Over the city: the mountain face or the sky's edge just throws the ship back.
            py = Math.max(top + r, Math.min(bot - r, py));
            if (hitTop ? vy < 0 : vy > 0) vy = -vy * 0.35;
            if (_approachBumpT <= 0) {
                _approachBumpT = 0.25;
                window.webkit?.messageHandlers?.haptic?.postMessage('light');
            }
        }
    }
    shake   = Math.max(0, shake   - dt * 30);
    flashA  = Math.max(0, flashA  - dt * 5);
    invulnT = Math.max(0, invulnT - dt);
    wallGraceT = Math.max(0, wallGraceT - dt);
    const target = Math.max(-0.70, Math.min(0.70, Math.atan2(vy, scrollSpd())));
    shipPitch += (target - shipPitch) * Math.min(dt * 14, 1);
    stepShipRoll(dt, vy);
    trailY.push(py);
    if (trailY.length > 10) trailY.shift();
}

function approachTitleTick(dt) { cityScroll += APPROACH_TITLE_SPD * dt; }

// Everything left of the cave: sky, skyline, mountain and its mouth. Screen space; called by
// drawWorld() after the (translated, clipped) cave and before the ship.
function drawApproachScene(theme, dayRock) {
    const camX = approachCamX();
    if (camX <= 0) return;
    _buildCity();
    const xEnd = Math.min(camX, W + 20);
    const mouthX = camX - APPROACH_LIP;
    const depth = depthLightAt(0);
    const horizon = lerpClr(DEPTH_MOUTH_WARM, dayRock, DEPTH_MOUTH_TINT);
    // drawWorld's cave background at screen x (void + mouth light), to blend into seamlessly.
    const caveAt = x => {
        const bg = lerpClr(theme.bg, dayRock, depth.lift);
        const mx = camX + W * DEPTH_MOUTH_X, R = depth.mouthR - W * DEPTH_MOUTH_X;
        const t = Math.min(1, Math.abs(x - mx) / R);
        let k = 0;
        for (let i = 1; i < DEPTH_MOUTH_STOPS.length; i++) {
            const [o0, a0] = DEPTH_MOUTH_STOPS[i - 1], [o1, a1] = DEPTH_MOUTH_STOPS[i];
            if (t <= o1) { k = lerp(a0, a1, (t - o0) / (o1 - o0)); break; }
        }
        return lerpClr(bg, horizon, depth.mouth * k);
    };
    const skyEnd = Math.min(mouthX + APPROACH_BLEND, xEnd);
    ctx.save();
    ctx.beginPath(); ctx.rect(-20, -20, skyEnd + 20, H + 40); ctx.clip();

    // Dusk sky: the night on top, the day's rock warming the horizon (same light as DEPTH_MOUTH).
    const skyTop  = lerpClr(theme.bg, dayRock, 0.06);
    const skyLow  = lerpClr(skyTop, horizon, 0.40);
    const sg = ctx.createLinearGradient(0, 0, 0, H);
    sg.addColorStop(0, rgb(skyTop));
    sg.addColorStop(0.55, rgb(lerpClr(skyTop, horizon, 0.14)));
    sg.addColorStop(1, rgb(skyLow));
    ctx.fillStyle = sg;
    ctx.fillRect(-20, -20, xEnd + 40, H + 40);

    // Moon, top left: the source of the dusk's dim light (the skyline and the mountain's
    // foothill catch it below), behind the ship like the cave-mouth light (hazards arrive
    // from the right, that side stays dark). Fixed on screen - it is at infinity, no
    // parallax - and left of the title's wordmark + halo (titleX = 0.25W). The mountain's
    // rock covers it as the mouth passes. No shadowBlur.
    const moonX = W * MOON_X, moonY = H * MOON_Y, moonR = H * MOON_R;
    const moonLit = lerpClr(MOON_TONE, dayRock, 0.12);
    {
        const mx = moonX, my = moonY, mr = moonR, lit = moonLit;
        const glow = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 5);
        glow.addColorStop(0, rgb(lit, 0.16));
        glow.addColorStop(0.35, rgb(lit, 0.05));
        glow.addColorStop(1, rgb(lit, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
        const disc = ctx.createLinearGradient(mx - mr, my - mr, mx + mr, my + mr);
        disc.addColorStop(0, rgb(lit));
        disc.addColorStop(1, rgb(lerpClr(lit, skyTop, 0.28)));
        ctx.fillStyle = disc;
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.283); ctx.fill();
        // Maria: a few soft darker patches, clipped to the disc.
        ctx.save();
        ctx.clip();
        ctx.fillStyle = rgb(lerpClr(lit, skyTop, 0.22), 0.55);
        for (const [dx, dy, sz] of MOON_MARIA) {
            ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, sz * mr, 0, 6.283); ctx.fill();
        }
        ctx.restore();
    }
    // Moonlight falls off with distance from the moon: one radial style shared by every rim.
    const moonRim = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, W * 0.9);
    moonRim.addColorStop(0, rgb(moonLit, MOONLIGHT_RIM));
    moonRim.addColorStop(0.5, rgb(moonLit, MOONLIGHT_RIM * 0.45));
    moonRim.addColorStop(1, rgb(moonLit, MOONLIGHT_RIM * 0.12));

    // Skyline: three silhouette layers, one path + one fill each, no shadowBlur.
    const blink = gtime;
    const winProg = phase === 'play' && approachFull > 0 ? Math.min(1, Math.max(0, 1 - approachLeft / approachFull)) : 0;
    const winLit = lerp(APPROACH_WIN_LIT[0], APPROACH_WIN_LIT[1], winProg * winProg * (3 - 2 * winProg));
    for (let li = 0; li < _cityLayers.length; li++) {
        const L = _cityLayers[li];
        const off = (cityScroll * L.f) % CITY_TILE;
        // The side toward the moon is a touch lighter and cooler than the far side.
        const base = lerpClr(lerpClr(skyLow, skyTop, 0.35), theme.bg, L.tone);
        const lf = ctx.createLinearGradient(0, 0, W, 0);
        lf.addColorStop(0, rgb(lerpClr(base, moonLit, 0.10)));
        lf.addColorStop(1, rgb(base));
        ctx.fillStyle = lf;
        ctx.beginPath();
        for (const b of L.bld) {
            let x = b.x - off;
            if (x + b.w < 0) x += CITY_TILE;
            if (x > xEnd) continue;
            _traceBuilding(x, b);
            if (x + CITY_TILE < xEnd) _traceBuilding(x + CITY_TILE, b);
        }
        ctx.fill();
        // Lit windows: one path per layer, only the share below the current level.
        if (L.bld[0].win) {
            ctx.beginPath();
            for (const b of L.bld) {
                let x = b.x - off;
                if (x + b.w < 0) x += CITY_TILE;
                if (x > xEnd) continue;
                const top = H - b.h, w = b.win;
                for (let i = 0; i < w.length; i += 3) {
                    if (w[i + 2] < winLit) ctx.rect(x + w[i], top + w[i + 1], 2, 3);
                }
                if (x + CITY_TILE < xEnd) {
                    for (let i = 0; i < w.length; i += 3) {
                        if (w[i + 2] < winLit) ctx.rect(x + CITY_TILE + w[i], top + w[i + 1], 2, 3);
                    }
                }
            }
            ctx.fillStyle = rgb(APPROACH_WIN_TONE, APPROACH_WIN_ALPHA[li]);
            ctx.fill();
        }
        // Moonlit rim: roofs and the left facades' upper part, one stroke per layer. The far
        // layer gets less (haze), the near one most.
        ctx.beginPath();
        for (const b of L.bld) {
            let x = b.x - off;
            if (x + b.w < 0) x += CITY_TILE;
            if (x > xEnd) continue;
            _traceRim(x, b);
            if (x + CITY_TILE < xEnd) _traceRim(x + CITY_TILE, b);
        }
        ctx.globalAlpha = 0.6 + 0.4 * (li / (_cityLayers.length - 1));
        ctx.strokeStyle = moonRim; ctx.lineWidth = 1; ctx.stroke();
        ctx.globalAlpha = 1;
        // Aircraft-warning beacons on masts and spires, in the day colour, slow blink.
        if (li > 0) {
            for (const b of L.bld) {
                if (b.kind !== 2 && b.kind !== 4) continue;
                let x = b.x - off;
                if (x + b.w < 0) x += CITY_TILE;
                const bx = x + b.w * (b.kind === 2 ? 0.5 : 0.605), by = H - b.h - b.h * (b.kind === 2 ? 0.34 : 0.22);
                if (bx < -4 || bx > xEnd) continue;
                const a = Math.max(0, Math.sin(blink * 1.7 + b.ph)) * (li === 2 ? 0.85 : 0.5);
                if (a < 0.02) continue;
                ctx.fillStyle = rgb(lerpClr(dayRock, [255, 255, 255], 0.3), a);
                ctx.fillRect(bx - 1.3, by - 1.3, 2.6, 2.6);
            }
        }
    }

    // Wind streaks: only while approaching in a run, only in the sky (the clip ends at the mouth).
    if (phase === 'play' && approachLeft > 0) {
        const tRem = (approachLeft - (PX + APPROACH_LIP)) / scrollSpd();   // seconds until the ship crosses the mouth
        const inA = Math.min(1, Math.max(0, (APPROACH_STREAK_IN_SEC - tRem) / (APPROACH_STREAK_IN_SEC * 0.66)));
        const amp = inA * inA * (3 - 2 * inA) * Math.min(1, Math.max(0, 1 + tRem / 0.4));
        if (amp > 0.01) {
            ctx.beginPath();
            const span = W + 240;
            for (const [sx0, sy, f] of _APPROACH_STREAKS) {
                const sx = W + 120 - ((sx0 + cityScroll * 1.5 * f) % span);
                ctx.moveTo(sx, H * sy); ctx.lineTo(sx + 12 + 54 * amp * f, H * sy);
            }
            ctx.strokeStyle = rgb(moonLit, APPROACH_STREAK_MAX * amp); ctx.lineWidth = 1; ctx.stroke();
        }
    }

    // Through the mouth the city dissolves into the cave's own void.
    if (mouthX - APPROACH_BLEND < skyEnd) {
        const c = caveAt(mouthX + APPROACH_BLEND);
        const bl = ctx.createLinearGradient(mouthX - APPROACH_BLEND, 0, mouthX + APPROACH_BLEND, 0);
        bl.addColorStop(0, rgb(c, 0)); bl.addColorStop(1, rgb(c, 1));
        ctx.fillStyle = bl;
        ctx.fillRect(mouthX - APPROACH_BLEND, -20, APPROACH_BLEND * 2, H + 40);
    }
    ctx.restore();

    // The mountain, in cross-section like the cave walls - same rock, same stone, same glow.
    const x0 = mouthX - APPROACH_FUN_B;
    ctx.save();
    ctx.beginPath(); ctx.rect(-20, -20, xEnd + 20, H + 40); ctx.clip();
    if (x0 < xEnd) {
        const xs = [], tops = [], bots = [];
        for (let x = Math.max(x0, -RSTEP) - RSTEP; x <= xEnd + RSTEP; x += RSTEP) {
            const u = x - camX, b = approachRock(u);
            xs.push(x);
            tops.push(b.top);
            bots.push(b.bot);
        }
        const n = xs.length;
        const traceTop = () => { ctx.beginPath(); ctx.moveTo(xs[0], -H); for (let i = 0; i < n; i++) ctx.lineTo(xs[i], tops[i]); ctx.lineTo(xs[n - 1], -H); ctx.closePath(); };
        const traceBot = () => { ctx.beginPath(); ctx.moveTo(xs[0], 2 * H); for (let i = 0; i < n; i++) ctx.lineTo(xs[i], bots[i]); ctx.lineTo(xs[n - 1], 2 * H); ctx.closePath(); };
        const edgeInner = lerpClr(theme.wall, theme.wallBase, 0.28);
        // One rock-profile stroke over [from, to] in screen x, skipping points off screen.
        const strokeSpan = (arr, from, to, style, lw) => {
            ctx.beginPath(); let on = false;
            for (let i = 0; i < n; i++) {
                if (xs[i] < from || xs[i] > to || arr[i] < -10 || arr[i] > H + 10) { on = false; continue; }
                on ? ctx.lineTo(xs[i], arr[i]) : ctx.moveTo(xs[i], arr[i]); on = true;
            }
            ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.stroke();
        };
        const lipTone = lerpClr(DEPTH_MOUTH_WARM, dayRock, APPROACH_LIP_TINT);
        // Solid rock all the way in: the cave walls it meets at world-x 0 are lethal full rock.
        const paintRock = (trace, isTop) => {
            ctx.save();
            trace(); ctx.clip();
            const g = isTop ? ctx.createLinearGradient(0, -2, 0, H * 0.5) : ctx.createLinearGradient(0, H * 0.5, 0, H + 2);
            g.addColorStop(isTop ? 0 : 1, rgb(theme.wall));
            g.addColorStop(isTop ? 0.72 : 0.28, rgb(theme.wall));
            g.addColorStop(isTop ? 1 : 0, rgb(edgeInner));
            ctx.fillStyle = g;
            ctx.fillRect(xs[0], -H, xEnd - xs[0] + RSTEP * 2, 3 * H);
            _paintStonePattern(cityScroll, 0.5);
            ctx.restore();
        };
        paintRock(traceTop, true);
        paintRock(traceBot, false);

        // Edges: the warm horizon catches the outer face; the day's edge line runs along the
        // mouth and into the cave, where drawWorld's own wall edge carries it on.
        for (const isTop of [true, false]) {
            const arr = isTop ? tops : bots;
            const stroke = (from, to, style, lw) => strokeSpan(arr, from, to, style, lw);
            stroke(-Infinity, mouthX, rgb(horizon, 0.30), 3);
            // The foothill's upper face looks up at the moon; the overhang above faces down.
            if (!isTop) stroke(-Infinity, mouthX, moonRim, 1.5);
            // Lip edge: the lip steps get a brighter line on the rock's edge.
            for (let k = 0; k < APPROACH_LIP_EDGE.length; k++) {
                stroke(mouthX + APPROACH_LIP_STEPS[k][0], mouthX + APPROACH_LIP_STEPS[k][1], rgb(lipTone, APPROACH_LIP_EDGE[k]), 2);
            }
            stroke(-Infinity, xEnd, rgb(theme.wallBase, 0.55), 2);   // drawWorld's lethal edge, same stroke
        }
    }
    ctx.restore();

    // Entry shadow: the mouth opens into darkness, not into a brighter room than the dusk
    // outside. Unclipped so it falls into the cave's first metres too; it slides off with the
    // camera and fades out before the approach ends, so nothing pops when it stops drawing.
    if (mouthX < W) {
        const a = APPROACH_SHADOW * Math.min(1, camX / (W * 0.3));
        const sg2 = ctx.createLinearGradient(mouthX - APPROACH_BLEND, 0, mouthX + W * 0.38, 0);
        sg2.addColorStop(0, rgb(theme.bg, 0));
        sg2.addColorStop(APPROACH_BLEND * 2 / (APPROACH_BLEND + W * 0.38), rgb(theme.bg, a));
        sg2.addColorStop(1, rgb(theme.bg, 0));
        ctx.fillStyle = sg2;
        ctx.fillRect(mouthX - APPROACH_BLEND, -20, APPROACH_BLEND + W * 0.38, H + 40);
    }
}

// "ENTERING THE TUNL" over the city, gone well before the cave arrives: it holds
// APPROACH_BANNER_HOLD_SEC from the start of its fade-in (the glint done, about a second to
// read it), then fades over APPROACH_BANNER_OUT_SEC (2026-09-29, user: "darf früher weg" -
// it used to stay until world-x 0 reached the left edge).
// Glint (2026-09-29, concept https://claude.ai/artifact/McF51Sm8vrD6rSYxT3Mv7r): the line
// starts a shade darker and one bright band sweeps across it once. The band is a gradient
// fill of the whole string, never per letter, so Arabic joining and Hindi shaping survive.
// Set at APPROACH_BANNER_Y, above the old H*0.24 slot: on the web's short canvas that slot
// sat right on top of the "HOLD TO FLY" hint over the ship, which shows at the same time.
const APPROACH_BANNER_Y     = 0.165;  // text centre, fraction of H
const APPROACH_GLINT_DELAY  = 0.35;   // s after the fade-in starts
const APPROACH_GLINT_SEC    = 1.0;
const APPROACH_GLINT_HALF   = 1.45;   // band half-width, in font sizes
const APPROACH_GLINT_REACH  = 1.9;    // how far past each end of the text the band starts/ends, in font sizes
const APPROACH_BANNER_HOLD_SEC = 2.25; // s from the fade-in start to the fade-out start
const APPROACH_BANNER_OUT_SEC  = 0.5;
function drawApproachBanner(theme) {
    if (!(phase === 'play' && approachLeft > 0)) return;
    const tIn0 = START_RAMP_SEC * 0.6;
    const tIn  = Math.min(1, Math.max(0, (approachT - tIn0) / 0.5));
    const tOut = Math.min(1, approachLeft / (scrollSpd() * 0.6),
        1 - (approachT - tIn0 - APPROACH_BANNER_HOLD_SEC) / APPROACH_BANNER_OUT_SEC);
    const a = Math.min(tIn, tOut);
    if (a <= 0) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const fs = FS * 0.045;
    ctx.font = `bold ${fs}px ${FONT_UI}`;
    const m = ctx.measureText(T.entering);
    const asc = m.actualBoundingBoxAscent || fs * 0.72;
    const base = H * APPROACH_BANNER_Y + asc / 2;
    ctx.shadowColor = rgb(theme.wallBase, a * 0.7);
    ctx.shadowBlur = 14;
    ctx.fillStyle = rgb(lerpClr(theme.wallBase, [255, 255, 255], 0.42), a);
    ctx.fillText(T.entering, W / 2, base);
    const p = (approachT - tIn0 - APPROACH_GLINT_DELAY) / APPROACH_GLINT_SEC;
    if (p > 0 && p < 1) {
        // Second pass of the same string, transparent except for the band. No shadow on this
        // pass: WebKit draws a gradient-filled text's shadow as a blurred copy of the whole
        // line well below it, cut off hard (iPhone, 2026-09-29). The first pass's glow is enough.
        const q = 1 - (1 - Math.min(1, p * 1.1)) ** 3;
        const reach = fs * APPROACH_GLINT_REACH, half = fs * APPROACH_GLINT_HALF;
        const x = W / 2 - m.width / 2 - reach + (m.width + 2 * reach) * q;
        const band = ctx.createLinearGradient(x - half, base - asc, x + half, base);
        band.addColorStop(0, 'rgba(255,255,255,0)');
        band.addColorStop(0.5, `rgba(255,248,236,${0.95 * a})`);
        band.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.shadowBlur = 0;
        ctx.fillStyle = band;
        ctx.fillText(T.entering, W / 2, base);
    }
    ctx.shadowBlur = 0;
    ctx.restore();
}

// ── Tap tutor (2026-09-29) ───────────────────────────────────────────
// "Halten zum Steigen muss weg": a press is a hop now (constants.js TAP_BURST_SEC), and a
// tap circle by the ship shows when to tap so the ship flies the opening's route, from
// the end of the launch ramp over the city until the ship passes SAFE_START_WX. It is a
// mini tutorial, not an autopilot: only the player's own tap moves the ship.
// Concept + prototype: https://claude.ai/artifact/VVhDdo7T4gCd4HmEqDYECQ
// - **The planner is the real physics run forward** (GRAVITY/THRUST/MAX_VY, the same
//   trapezoid as update.js shipStep): a tap is due when the apex of a hop started now
//   would no longer overshoot the route. Recomputed every frame from the ship's actual
//   state, so it recovers from a missed or an extra tap by itself.
// - **The route** is the mouth's centre over the city, then the line through the good
//   coins (the opening arc that teaches RELEASE, systems.js makeCoin), inside the corridor.
// - **Time slows while a due tap is late** (TUTOR_SLOW_SCALE), only once the player has
//   tapped in this run; before the first tap the gravity gate glides the ship level and the
//   circle presses on a steady beat instead.
// - **Draw and time only**: no rng(), no placement, no score effect (the score is world-x),
//   so the cave, test-cave.js and the leaderboard are untouched. Shown while the all-time
//   best is below TUTOR_BEST_MAX.
let tutorOn = false;      // this run shows the tap circle
let tutorA = 0;           // circle alpha (fades in after the ramp, out past SAFE_START_WX)
let tutorTTap = 1;        // seconds until the next tap is due; <= 0: due now
let tutorOverdue = 0;     // real seconds a due tap has been missing
let tutorScale = 1;       // time scale handed to update()
let tutorTaps = 0;        // presses while the tutor ran
let tutorHitT = 0;        // on-the-beat check mark timer
let tutorRippleT = 0;     // tap ripple timer
let tutorClock = 0;       // demo beat before the first tap

function tutorStart() {
    tutorOn = best < TUTOR_BEST_MAX;
    tutorA = 0; tutorTTap = 1; tutorOverdue = 0; tutorScale = 1;
    tutorTaps = 0; tutorHitT = 0; tutorRippleT = 0; tutorClock = 0;
}

// The ship's position on the approach+cave line: negative over the city, world-x in the cave.
function tutorShipU() { return scrollX + PX - approachLeft; }
function tutorInZone() { return tutorOn && phase === 'play' && startRamp >= 1 && tutorShipU() < SAFE_START_WX; }

// Route height at u: the mouth's centre, then straight lines through the coins ahead
// (collected ones stay route points; hazard coins are left out), kept off the walls.
function tutorRouteY(u) {
    let y = H / 2;
    if (u > -APPROACH_LIP) {
        let x0 = -APPROACH_LIP, y0 = H / 2;
        for (const c of coins) {
            if (c.type === 'poison' || c.type === 'drain' || c.wx <= x0) continue;
            if (c.wx >= u) { y = lerp(y0, c.y, (u - x0) / (c.wx - x0)); break; }
            x0 = c.wx; y0 = y = c.y;
        }
    }
    const b = approachRock(u), m = PR * 2.2;
    return Math.max(b.top + m, Math.min(b.bot - m, y));
}

// One planner step: the same trapezoid as update.js shipStep, with gravity on.
function _tutorStep(s, thrust, h) {
    const v1 = Math.max(-MAX_VY, Math.min(MAX_VY, s.v + (thrust ? GRAVITY - THRUST : GRAVITY) * h));
    s.p += (s.v + v1) * 0.5 * h; s.v = v1; s.b -= h;
}
// Where a hop started now tops out, and when.
function _tutorApex(p, v, b) {
    const s = { p, v, b: Math.max(b, TAP_BURST_SEC) }, h = 1 / 120;
    let t = 0;
    while (t < 1.5 && (s.b > 0 || s.v < 0)) { _tutorStep(s, s.b > 0, h); t += h; }
    return { y: s.p, t };
}
// Seconds until the next tap is due (no tap assumed until then); TUTOR_LOOKAHEAD if none.
function tutorPlan() {
    if (holding) return TUTOR_LOOKAHEAD;
    const spd = scrollSpd(), u0 = tutorShipU(), h = 1 / 60;
    const s = { p: py, v: vy, b: tapBurstT };
    for (let t = 0; t <= TUTOR_LOOKAHEAD; t += h) {
        if (s.b <= 0) {
            const ap = _tutorApex(s.p, s.v, 0);
            if (ap.y >= tutorRouteY(u0 + (t + ap.t) * spd)) return t;
        }
        _tutorStep(s, s.b > 0, h);
    }
    return TUTOR_LOOKAHEAD;
}

// Called by update() once the ramp is over, with the real frame step; returns the step the
// rest of the frame runs on.
function tutorStep(dt) {
    if (!tutorOn) return dt;
    const live = tutorInZone();
    tutorA = live ? Math.min(1, tutorA + dt / 0.3) : Math.max(0, tutorA - dt / TUTOR_FADE_SEC);
    tutorHitT = Math.max(0, tutorHitT - dt);
    tutorRippleT = Math.max(0, tutorRippleT - dt);
    let want = 1;
    if (live) {
        tutorClock += dt;
        if (!hasHeldThisRun) {
            tutorTTap = TUTOR_DEMO_PERIOD - tutorClock % TUTOR_DEMO_PERIOD;
            tutorOverdue = 0;
        } else {
            tutorTTap = tutorPlan();
            tutorOverdue = tutorTTap <= 0 && !thrusting() ? tutorOverdue + dt : 0;
            if (tutorTaps > 0 && tutorOverdue > TUTOR_LATE_SEC) want = TUTOR_SLOW_SCALE;
        }
    } else tutorOverdue = 0;
    tutorScale += (want - tutorScale) * Math.min(1, dt * 10);
    return dt * tutorScale;
}

// input.js onDown in play, after the burst has started.
function tutorOnTap() {
    if (!tutorInZone()) return;
    const onBeat = tutorTaps === 0
        || (tutorTTap <= TUTOR_WINDOW_SEC && tutorOverdue <= TUTOR_LATE_SEC)
        || (!hasHeldThisRun && TUTOR_DEMO_PERIOD - tutorTTap <= TUTOR_WINDOW_SEC);
    tutorTaps++;
    tutorRippleT = 0.35;
    if (onBeat) tutorHitT = 0.6;
    tutorOverdue = 0;
}

// The tap circle, below and ahead of the ship: the iPhone's touch button (user, 2026-09-29:
// "so dieser typische iPhone Knopf Kreis") - a white dot in two translucent rings. It
// brightens as a tap comes due and presses in (shrinks, glows) while one is due. Neutral
// white, like the system's own. draw.js calls it right after the ship, approach and cave.
function drawTapTutor() {
    if (!tutorOn || tutorA <= 0 || phase !== 'play') return;
    const [lr, lg, lb] = (SKINS[activeSkin] || SKINS[0]).shadow;
    const R = PR * 1.5, r = R * 0.5;                       // button, inner dot (AssistiveTouch proportions)
    const fx = PX + PR * 3.4, tipY = Math.min(H - R * 1.2, py + PR * 2.8);
    const t = Math.max(0, tutorTTap);
    const lift = t >= TUTOR_LEAD_SEC ? 1 : t / TUTOR_LEAD_SEC;
    const due = tutorTTap <= 0.02 && !thrusting();
    const press = due ? 0.5 + 0.5 * Math.sin(gtime * 11) : 0;
    const k = 1 - 0.12 * press - 0.05 * (1 - lift);        // pressed in: a little smaller
    const a = tutorA * (0.5 + 0.5 * (1 - lift));            // brightens as the tap comes due
    ctx.save();
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(fx, tipY, R * k, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fill();
    ctx.lineWidth = Math.max(1, R * 0.05);
    ctx.strokeStyle = 'rgba(255,255,255,0.40)';
    ctx.stroke();
    ctx.beginPath(); ctx.arc(fx, tipY, R * 0.74 * k, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.fill();
    ctx.beginPath(); ctx.arc(fx, tipY, r * k, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.shadowColor = `rgba(255,255,255,${0.35 + 0.6 * press})`;
    ctx.shadowBlur = 3 + 12 * press;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = tutorA;
    if (tutorRippleT > 0) {
        const k = 1 - tutorRippleT / 0.35;
        ctx.globalAlpha = tutorA * (1 - k);
        ctx.beginPath(); ctx.arc(fx, tipY, R * (1 + k * 0.9), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgb(255,255,255)'; ctx.lineWidth = Math.max(1.5, r * 0.3); ctx.stroke();
    }
    if (tutorHitT > 0) {
        // On the beat: a check mark above the ship, rising and fading.
        const k = 1 - tutorHitT / 0.6, cx = PX, cy = py - PR * 2.6 - k * PR, u = PR * 0.42;
        ctx.globalAlpha = tutorA * Math.min(1, tutorHitT * 3);
        ctx.beginPath();
        ctx.moveTo(cx - u * 1.2, cy); ctx.lineTo(cx - u * 0.3, cy + u * 0.9); ctx.lineTo(cx + u * 1.4, cy - u * 1.0);
        ctx.strokeStyle = `rgb(${lr},${lg},${lb})`; ctx.lineWidth = Math.max(2, u * 0.45);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    }
    ctx.restore();
}
