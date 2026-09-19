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

let approachLeft = 0;          // screen px until world-x 0 reaches the left edge; > 0 = approach live
let approachT = 0;             // seconds since the approach started (camera ease-in, banner)
let approachFull = 0;          // approachLeft at the start, for the banner's fade
let cityScroll = 0;            // camera distance flown over the city (title drift included, never reset)
let _approachBumpT = 0;        // throttles the city bump's haptic
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
            bld.push({ x, w, h, kind, ph: r() * 6.283 });
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
    levelIntroT = 0;   // the world banner waits for the cave (approachStep)
}

// Advance the camera. Runs under the launch ramp too, so the ship takes off over a moving city.
function approachStep(dt) {
    approachT += dt;
    const e = Math.min(1, approachT / APPROACH_EASE_SEC);
    const d = lerp(APPROACH_TITLE_SPD, scrollSpd(), e * e * (3 - 2 * e)) * dt;
    cityScroll += d;
    approachLeft = Math.max(0, approachLeft - d);
    _approachBumpT = Math.max(0, _approachBumpT - dt);
    if (approachLeft <= 0) levelIntroT = LEVEL_INTRO_DUR;
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
            // In the mouth: the tunnel's own wall rule (update.js), scratches first.
            if (invulnT > 0 || wallGraceT > 0) py = Math.max(top + r, Math.min(bot - r, py));
            else if (hullScratches > 0) hullScratch(top, bot, r);
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
            const stroke = (from, to, style, lw) => {
                ctx.beginPath(); let on = false;
                for (let i = 0; i < n; i++) {
                    if (xs[i] < from || xs[i] > to || arr[i] < -10 || arr[i] > H + 10) { on = false; continue; }
                    on ? ctx.lineTo(xs[i], arr[i]) : ctx.moveTo(xs[i], arr[i]); on = true;
                }
                ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.stroke();
            };
            stroke(-Infinity, mouthX, rgb(horizon, 0.30), 3);
            // The foothill's upper face looks up at the moon; the overhang above faces down.
            if (!isTop) stroke(-Infinity, mouthX, moonRim, 1.5);
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

// "ENTERING THE TUNL" over the city, gone by the time the world banner takes over in the cave.
function drawApproachBanner(theme) {
    if (!(phase === 'play' && approachLeft > 0)) return;
    const tIn  = Math.min(1, Math.max(0, (approachT - START_RAMP_SEC * 0.6) / 0.5));
    const tOut = Math.min(1, approachLeft / (scrollSpd() * 0.6));
    const a = Math.min(tIn, tOut);
    if (a <= 0) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `bold ${FS * 0.045}px ${FONT_UI}`;
    const m = ctx.measureText(T.entering);
    const asc = m.actualBoundingBoxAscent || FS * 0.045 * 0.72;
    ctx.shadowColor = rgb(theme.wallBase, a * 0.8);
    ctx.shadowBlur = 16;
    ctx.fillStyle = rgb(lerpClr(theme.wallBase, [255, 255, 255], 0.55), a);
    ctx.fillText(T.entering, W / 2, H * 0.24 + asc / 2);
    ctx.shadowBlur = 0;
    ctx.restore();
}
