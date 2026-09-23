// TUNL. Copyright (c) 2026 Theodoracatos. All rights reserved. https://flytunl.ch
// ── Hangar paint, the Lackiererei (2026-09-22) ─────────────────────────
// Renders the paint kit (constants.js PAINT_*, state.js shipPaint) on drawShip() and
// drawShip3D() in draw.js, and draws + handles the Paint sheet. Rules, each load-bearing
// (docs/agents/economy.md "Hangar paint", ship-render.md):
// - The hull colour may change the hue; the ship's LIGHT never does. Glow, nozzles, intake
//   rings, running lights and strobes stay in the skin's shadow colour (draw.js), which is
//   what keeps a repainted ship readable as itself.
// - Everything here is built from BIG masses: in flight the ship is ~35px across. Detail
//   may sit on top of a mass (stars, sparkles on the hangar ship), never instead of one.
// - A pattern never goes on the NOSE (canopy and leading-edge highlight draw over it) and
//   is never small repeated marks (they read as damage, not paint).
// - An additive wash has no headroom on a pale hull: pale paints use source-over.
// - Per frame: fills and at most a few gradients, no shadowBlur, no particles.
// - Draw-only: reads game state, never writes any of it, never calls rng().

// Material re-shading, shared by the flat hull (_shipTones) and the 3D one: the paint's base
// colour and how far the facet lighting is pushed toward white (kUp) and black (kDn).
function paintHullRgb(color, kit) {
    if (kit && kit.c) return PAINT_COLORS[kit.c].rgb;
    return [parseInt(color.substr(1, 2), 16), parseInt(color.substr(3, 2), 16), parseInt(color.substr(5, 2), 16)];
}
function _paintShade(base, kit) {
    const m = kit ? kit.m : 0;
    if (m === 1) return [lerpClr(base, _SHIP_DARK, 0.62), 0.30, 0.55];    // STEALTH
    if (m === 2) return [base, 1.35, 1.35];                                // METALLIC: harder light ramp (1.5 washed the hue out in 3D)
    if (m === 3) return [lerpClr(base, _SHIP_DARK, 0.22), 0.70, 1.50];    // CANDY: deep, dark-sided
    if (m === 4) return [lerpClr(base, _SHIP_WHITE, 0.06), 1.10, 1.00];   // NACRE
    if (m === 5) return [lerpClr(base, _SHIP_WHITE, 0.10), 1.50, 1.35];   // CHROME
    if (m === 6) return [base, 1.25, 1.25];                                // DIAMOND
    return [base, 1, 1];
}
function paintToneKey(kit) { return kit ? kit.c + ':' + kit.m : '0:0'; }
function paintHasOverlay(kit) { return !!(kit && (kit.p || kit.m || kit.fx)); }
const _paintLum = c => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;

// ── Reactive signals (PAINT_EFFECTS, NACRE) ──
// In a run they come from the flight: thrust (holding, eased so the heat builds and cools),
// the climb roll, the last coin, how close the run is to the record, the scroll. Anywhere
// else (hangar, hero, Paint sheet) a scripted loop plays them, so a reactive paint can be
// judged before it is bought.
let _paintHeat = 0, _paintHeatT = 0;
const _paintSig = { th: 0, roll: 0, coin: HUD_SPARK_COLOR.gold, coinT: -9, fire: 0, drift: 0 };
function paintSignals() {
    const S = _paintSig;
    if (phase === 'play') {
        const dt = Math.max(0, Math.min(0.1, gtime - _paintHeatT));
        _paintHeatT = gtime;
        const tgt = holding ? 1 : 0;
        _paintHeat += (tgt - _paintHeat) * Math.min(1, dt * (tgt ? 4.5 : 1.8));
        S.th    = _paintHeat;
        S.roll  = Math.max(-1, Math.min(1, (shipRoll - SHIP3D_ROLL_BASE) / SHIP3D_ROLL_AMP));
        S.coin  = paintCoinFx.col || HUD_SPARK_COLOR.gold;
        S.coinT = paintCoinFx.t;
        const bar = dailyBest || best;
        S.fire  = onFire ? 1 : bar > 0 ? 0.75 * Math.pow(Math.max(0, Math.min(1, score / bar)), 2) : 0;
        S.drift = scrollX / (W * 0.9);
    } else {
        const ph = gtime % 2.6;
        S.th    = ph < 1.4 ? Math.min(1, ph / 0.35) : Math.max(0, 1 - (ph - 1.4) / 0.6);
        S.roll  = Math.sin(gtime * 1.25) * 0.9;
        const k = Math.floor(gtime / 1.8);
        S.coin  = [HUD_SPARK_COLOR.gold, HUD_SPARK_COLOR.blue, HUD_SPARK_COLOR.red, HUD_SPARK_COLOR.green][k % 4];
        S.coinT = k * 1.8;
        S.fire  = 0.5 + 0.5 * Math.sin(gtime * 0.7);
        S.drift = gtime * 0.35;
    }
    return S;
}

// ── Patterns (PAINT_PATTERNS), in r units on the planform's TOP half (y <= 0) ──
// Each is a function of (side s = -1 top / +1 bottom) that adds sub-paths; the caller fills.
// Laid on the F-14 planform (draw.js SHIP_OUTLINE): fuselage |y| <= 0.10, glove to 0.39,
// the outer panel SWEPT back from there to 0.78, taileron behind. Clipped to the hull by the caller.
const _PAINT_PAT = [
    null,
    // SPLIT: one whole side of the ship, a clean divide down the spine.
    s => { if (s < 0) ctx.rect(-1.4, -1.1, 3, 1.1); },
    // STRIPE: a band across the span at the wing root plus a spine band.
    s => { ctx.rect(-0.34, s < 0 ? -1.1 : 0, 0.20, 1.1); ctx.rect(-1.2, s < 0 ? -0.075 : 0, 2.2, 0.075); },
    // CHEVRON: one forward-pointing V across glove and outer panel.
    s => { _pp([[0.50, 0], [-0.24, 0.80 * s], [-0.46, 0.80 * s], [0.20, 0]]); },
    // WINGTIPS: outer panel and taileron solid.
    s => { for (const i of [1, 5, 6]) _pp(SHIP_FACETS[i].p.map(q => [q[0], -q[1] * s])); },
    // FLAMES: hot-rod tongues licking back from behind the canopy.
    s => { _pp([[0.95, 0], [0.55, 0.11 * s], [0.22, 0.27 * s], [0.12, 0.14 * s], [-0.14, 0.38 * s], [-0.20, 0.17 * s],
                [-0.50, 0.32 * s], [-0.44, 0.09 * s], [-0.74, 0.14 * s], [-0.62, 0]]); },
    // TIGER: three slanted wedges per side.
    s => { for (const x0 of [0.18, -0.16, -0.52]) _pp([[x0 + 0.10, 0.06 * s], [x0 - 0.24, 1.0 * s], [x0 - 0.08, 1.0 * s], [x0 + 0.24, 0.06 * s]]); },
    // ROUNDEL: a target on each glove (ring filled here, the hole cut in the hull colour below).
    s => { ctx.moveTo(-0.28 + 0.16, 0.25 * s); ctx.arc(-0.28, 0.25 * s, 0.16, 0, Math.PI * 2); },
    // SUNBURST: rays from the wing root.
    s => { for (let i = 0; i < 5; i++) { const a0 = (0.10 + i * 0.19) * Math.PI, a1 = a0 + 0.095 * Math.PI;
            _pp([[0.20, 0], [0.20 + Math.cos(a0) * 2.6, Math.sin(a0) * 2.6 * s], [0.20 + Math.cos(a1) * 2.6, Math.sin(a1) * 2.6 * s]]); } },
    // ORBIT (earned, all seven worlds): drawn as strokes in _paintPattern.
    null,
];
function _pp(pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
}
function _paintPattern(x, y, r, kit, P, hc) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(r, r);
    // Lit side lighter, shadow side darker, so the pattern sits on the hull's lighting
    // instead of reading as a sticker: one fill per half.
    for (const s of [-1, 1]) {
        ctx.save();
        ctx.beginPath(); ctx.rect(-1.5, s < 0 ? -1.2 : 0, 3, 1.2); ctx.clip();
        const col = s < 0 ? lerpClr(P, _SHIP_WHITE, 0.10) : lerpClr(P, _SHIP_DARK, 0.28);
        if (kit.p === 9) {
            // ORBIT: two crossing orbits around the hull and a moon riding one of them.
            ctx.strokeStyle = rgb(col, 0.92);
            ctx.lineWidth = 0.10;
            for (const rot of [-0.42, 0.42]) { ctx.beginPath(); ctx.ellipse(-0.18, 0, 0.78, 0.30, rot, 0, Math.PI * 2); ctx.stroke(); }
            const a = gtime * 1.1, ca = Math.cos(-0.42), sa = Math.sin(-0.42);
            const ex = 0.78 * Math.cos(a), ey = 0.30 * Math.sin(a);
            ctx.beginPath(); ctx.arc(-0.18 + ex * ca - ey * sa, ex * sa + ey * ca, 0.11, 0, Math.PI * 2);
            ctx.fillStyle = rgb(lerpClr(col, _SHIP_WHITE, 0.35)); ctx.fill();
        } else {
            ctx.beginPath();
            _PAINT_PAT[kit.p](s);
            ctx.fillStyle = rgb(col, 0.93);
            ctx.fill();
            if (kit.p === 7) {
                ctx.beginPath(); ctx.arc(-0.28, 0.25 * s, 0.095, 0, Math.PI * 2);
                ctx.fillStyle = rgb(hc); ctx.fill();
                ctx.beginPath(); ctx.arc(-0.28, 0.25 * s, 0.045, 0, Math.PI * 2);
                ctx.fillStyle = rgb(col); ctx.fill();
            }
        }
        ctx.restore();
    }
    if (kit.p === 1) {
        // SPLIT's seam: a dark line with a bright core down the spine.
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(-1.3, -0.05, 2.6, 0.10);
        ctx.fillStyle = rgb(lerpClr(P, _SHIP_WHITE, 0.55), 0.85);
        ctx.fillRect(-1.3, -0.018, 2.6, 0.036);
    }
    ctx.restore();
}

// The whole paint layer: pattern, then material, then effect. Painted over the facets and
// under the spine/leading-edge highlights and canopy. `hull` comes from drawShip3D (seams
// and rim traced in screen space, see ship-render.md); without it the flat hull clips
// itself to shipPath. `color` is the skin colour, (sr, sg, sb) its glow.
function _drawPaintOverlay(x, y, r, kit, color, sr, sg, sb, hull) {
    const hc   = paintHullRgb(color, kit);
    const pale = _paintLum(hc) > 200;
    const lt   = `${(sr + 255) >> 1},${(sg + 255) >> 1},${(sb + 255) >> 1}`;
    const [hueA, hueB] = _auroraPair(sr, sg, sb);
    const S = kit.fx || kit.m === 4 ? paintSignals() : _paintSig;
    // The rim is the planform outline on both hulls (on the 3D one it lands on the top surface
    // under the caller's squash, clipped to the silhouette). The 3D model's own open edges
    // (hull.rimPath) are no rim on the F-14: its parts do not share edges, so the "rim" ran
    // through the middle of the hull and the additive strokes lit it up from inside.
    const rimStroke = style => {
        shipPath(x, y, r);
        ctx.strokeStyle = style.color;
        ctx.lineWidth   = style.w;
        ctx.lineJoin    = 'round';
        ctx.stroke();
    };
    const full = () => ctx.fillRect(x - r * 1.4, y - r * 1.1, r * 2.9, r * 2.2);
    const add  = pale ? 'source-over' : 'lighter';
    ctx.save();
    if (!hull) { shipPath(x, y, r); ctx.clip(); }

    // ── pattern ──
    if (kit.p) {
        // FACTORY accent: the ship's own light on a custom hull, unless the two are too close
        // in brightness to tell apart (a light amber on the amber hull vanished); then ink
        // on a light hull, light on a dark one.
        let P = kit.pc ? PAINT_COLORS[kit.pc].rgb : kit.c ? [sr, sg, sb] : null;
        if (!P || (!kit.pc && Math.abs(_paintLum(P) - _paintLum(hc)) < 60)) {
            P = _paintLum(hc) > 90 ? [14, 16, 28] : lerpClr([sr, sg, sb], _SHIP_WHITE, 0.55);
        }
        _paintPattern(x, y, r, kit, P, hc);
    }

    // ── material ──
    const m = kit.m;
    if (m === 1) {
        // STEALTH: matte black hull read back by neon seams and an edge-lit rim that breathes.
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        full();
        const br = 0.55 + 0.45 * (0.5 - 0.5 * Math.cos(gtime * 1.6));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // The F-14 model (2026-09-22) shows ~48 seam-worthy faces against the flat hull's 7:
        // at full strength their additive strokes stacked into a lamp, so on the 3D hull the
        // seams run at a fraction and only the thin bright core is drawn.
        const seamK = hull ? 0.28 : 1;
        const seam = (tracePath, i) => {
            const wv = (0.45 + 0.55 * Math.max(0, Math.sin(gtime * 2.2 - i * 0.55))) * seamK;
            tracePath();
            ctx.lineJoin = 'round';
            if (!hull) {
                ctx.strokeStyle = `rgba(${sr},${sg},${sb},${0.30 * wv})`;
                ctx.lineWidth   = Math.max(r * 0.05, 1);
                ctx.stroke();
            }
            ctx.strokeStyle = `rgba(${lt},${0.42 * wv})`;
            ctx.lineWidth   = Math.max(r * 0.016, 0.4);
            ctx.stroke();
        };
        if (hull) hull.screen(() => { ctx.globalCompositeOperation = 'lighter'; hull.eachFace(seam); });
        else for (const sy of [-1, 1]) {
            for (let i = 0; i < SHIP_FACETS.length; i++) {
                seam(() => { ctx.beginPath(); _shipPoly(x, y, r, SHIP_FACETS[i].p, -sy); }, i);
            }
        }
        rimStroke({ color: `rgba(${sr},${sg},${sb},${0.55 * br + 0.30})`, w: Math.max(r * 0.14, 2) });
        rimStroke({ color: `rgba(${lt},${0.45 + 0.50 * br})`, w: Math.max(r * 0.045, 0.8) });
        ctx.restore();
    } else if (m === 2 || m === 3) {
        // METALLIC: a bright sheen sweeping the hull. CANDY: a wet clear coat - a lit top
        // edge and a slower, softer sheen over the deepened paint.
        if (m === 3) {
            const cg = ctx.createLinearGradient(0, y - r, 0, y + r);
            cg.addColorStop(0,    'rgba(255,255,255,0.34)');
            cg.addColorStop(0.38, 'rgba(255,255,255,0)');
            cg.addColorStop(0.62, 'rgba(0,0,0,0)');
            cg.addColorStop(1,    'rgba(0,0,0,0.30)');
            ctx.fillStyle = cg;
            full();
        }
        const u  = (gtime * (m === 2 ? 0.34 : 0.18)) % 1;
        const bx = x + r * (-2.0 + u * 4.2);
        const g  = ctx.createLinearGradient(bx - r * 0.45, y - r, bx + r * 0.45, y + r);
        g.addColorStop(0,   'rgba(255,255,255,0)');
        g.addColorStop(0.5, `rgba(255,255,255,${m === 2 ? 0.62 : 0.34})`);
        g.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.save();
        ctx.globalCompositeOperation = add;
        ctx.fillStyle = g;
        full();
        ctx.restore();
    } else if (m === 4) {
        // NACRE: mother-of-pearl whose colour runs over the hull with the climb roll.
        const h = (((_paintHue(sr, sg, sb) + S.roll * 120 + gtime * 18) % 360) + 360) % 360;
        const g = ctx.createLinearGradient(x - r * 1.2, y - r * (1 - S.roll * 0.6), x + r * 1.2, y + r * (1 - S.roll * 0.6));
        g.addColorStop(0,   `hsla(${h},90%,68%,1)`);
        g.addColorStop(0.5, `hsla(${(h + 70) % 360},90%,76%,1)`);
        g.addColorStop(1,   `hsla(${(h + 140) % 360},90%,68%,1)`);
        ctx.save();
        const dark = _paintLum(hc) < 70;
        ctx.globalCompositeOperation = pale ? 'source-over' : dark ? 'lighter' : 'overlay';
        ctx.globalAlpha = pale ? 0.34 : dark ? 0.30 : 0.62;
        ctx.fillStyle = g;
        full();
        ctx.restore();
    } else if (m === 5) {
        // CHROME: mirror gradient (sky above, ground below), a hard horizon and a specular
        // streak whose edges split into the glow's two hue neighbours.
        const g0 = ctx.createLinearGradient(0, y - r, 0, y + r);
        g0.addColorStop(0,    'rgba(255,255,255,0.72)');
        g0.addColorStop(0.42, 'rgba(255,255,255,0.10)');
        g0.addColorStop(0.5,  `rgba(${lt},0.55)`);
        g0.addColorStop(0.58, 'rgba(0,0,0,0.30)');
        g0.addColorStop(1,    'rgba(0,0,0,0.62)');
        ctx.fillStyle = g0;
        full();
        ctx.fillStyle = `rgba(${lt},0.95)`;
        ctx.fillRect(x - r * 1.3, y - r * 0.022, r * 2.8, r * 0.044);
        const u  = (gtime * 0.30) % 1;
        const bx = x + r * (-2.0 + u * 4.2);
        const g  = ctx.createLinearGradient(bx - r * 0.40, y - r, bx + r * 0.40, y + r);
        g.addColorStop(0,    'rgba(255,255,255,0)');
        g.addColorStop(0.28, hueA);
        g.addColorStop(0.5,  'rgba(255,255,255,0.80)');
        g.addColorStop(0.72, hueB);
        g.addColorStop(1,    'rgba(255,255,255,0)');
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = g;
        full();
        ctx.restore();
    } else if (m === 6) {
        // DIAMOND (earned, 30 days): a prismatic rim cycling the spectrum, sparkles on top.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const h = (gtime * 70) % 360;
        rimStroke({ color: `hsla(${h},95%,65%,0.70)`, w: Math.max(r * 0.10, 1.5) });
        rimStroke({ color: `hsla(${(h + 180) % 360},95%,80%,0.55)`, w: Math.max(r * 0.035, 0.7) });
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = Math.max(r * 0.03, 0.6);
        const SP = [[0.55, -0.08], [-0.20, -0.30], [-0.30, 0.62], [-0.85, -0.45], [0.10, 0.22], [-0.60, 0.05]];
        for (let k = 0; k < SP.length; k++) {
            const a = Math.max(0, Math.sin(gtime * 2.3 + k * 1.9));
            if (a < 0.2) continue;
            const L = r * 0.20 * a, px = x + SP[k][0] * r, py2 = y + SP[k][1] * r;
            ctx.globalAlpha = a;
            ctx.beginPath();
            ctx.moveTo(px - L, py2); ctx.lineTo(px + L, py2);
            ctx.moveTo(px, py2 - L); ctx.lineTo(px, py2 + L);
            ctx.stroke();
        }
        ctx.restore();
    }

    // ── effect ──
    const fx = kit.fx;
    if (fx === 1 && S.th > 0.02) {
        // EMBER: tail and trailing edges heat up while the player thrusts, cool on release.
        const th = S.th;
        const g = ctx.createLinearGradient(x - r * 1.1, 0, x + r * 0.5, 0);
        g.addColorStop(0,    `rgba(255,240,200,${0.92 * th})`);
        g.addColorStop(0.25, `rgba(255,120,20,${0.78 * th})`);
        g.addColorStop(0.7,  `rgba(200,30,0,${0.26 * th})`);
        g.addColorStop(1,    'rgba(200,30,0,0)');
        ctx.save();
        ctx.globalCompositeOperation = add;
        ctx.fillStyle = g;
        full();
        ctx.globalCompositeOperation = 'lighter';
        rimStroke({ color: `rgba(255,140,40,${0.55 * th})`, w: Math.max(r * 0.09, 1.4) });
        ctx.restore();
    } else if (fx === 2) {
        // PULSE: a wave in the colour of the last coin runs nose to tail; between coins a
        // quiet heartbeat in the ship's own light, so the paint never goes dead.
        const u = (gtime - S.coinT) / 0.8;
        let col, a, pos;
        if (u >= 0 && u < 1) { col = S.coin; a = 0.95 * (1 - u * 0.4); pos = u; }
        else { const hb = (gtime % 2.4) / 1.2; col = [sr, sg, sb]; a = hb < 1 ? 0.38 * Math.sin(hb * Math.PI) : 0; pos = hb; }
        if (a > 0.01) {
            const px = x + r * (1.5 - Math.min(1, pos) * 2.9);
            const g = ctx.createLinearGradient(px - r * 0.38, 0, px + r * 0.38, 0);
            g.addColorStop(0,   rgb(col, 0));
            g.addColorStop(0.5, rgb(col, a));
            g.addColorStop(1,   rgb(col, 0));
            ctx.save();
            ctx.globalCompositeOperation = add;
            ctx.fillStyle = g;
            full();
            ctx.restore();
        }
    } else if (fx === 3) {
        // AURORA: polar curtains in three hues at +-45 around the ship's glow, swayed by the
        // climb roll; sparkles ride them.
        const trio = _auroraTrio(sr, sg, sb);
        ctx.save();
        ctx.globalCompositeOperation = pale ? 'multiply' : 'overlay';
        ctx.globalAlpha = pale ? 0.45 : 0.70;
        ctx.fillStyle = rgb(trio[1]);
        full();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = add;
        const CURT = [[0.31, 0.00, 0.62, 0], [0.19, 0.35, 0.90, 2], [0.43, 0.68, 0.48, 1], [0.25, 0.12, 1.15, 2]];
        for (let c = 0; c < CURT.length; c++) {
            const spd = CURT[c][0], ph = CURT[c][1], wid = CURT[c][2], col = trio[CURT[c][3]];
            const u  = (gtime * spd + ph) % 1;
            const bx = x + r * (1.45 - u * 3.1 + S.roll * 0.35 * (c % 2 ? -1 : 1));
            const hw = r * wid * 0.5;
            const g  = ctx.createLinearGradient(bx - hw, y - r * 0.8, bx + hw, y + r * 0.8);
            const aC = pale ? 0.42 : 0.55, aW = pale ? 0.10 : 0.32;
            g.addColorStop(0,    rgb(col, 0));
            g.addColorStop(0.42, rgb(col, aC));
            g.addColorStop(0.55, `rgba(255,255,255,${aW})`);
            g.addColorStop(0.68, rgb(col, aC));
            g.addColorStop(1,    rgb(col, 0));
            ctx.fillStyle = g;
            full();
        }
        ctx.globalCompositeOperation = 'lighter';
        const rimHue = trio[((gtime * 0.31) % 1) < 0.5 ? 0 : 2];
        rimStroke({ color: rgb(rimHue, 0.55 + 0.35 * Math.sin(gtime * 1.3)), w: Math.max(r * 0.10, 1.5) });
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let k = 0; k < 9; k++) {
            const t   = (gtime * 0.35 + k * 0.111) % 1;
            const a   = Math.sin(t * Math.PI);
            ctx.globalAlpha = a * a * 0.95;
            ctx.beginPath();
            ctx.arc(x + r * (1.25 - t * 2.4), y + r * (0.78 * Math.sin(k * 2.4 + gtime * 0.5)), Math.max(r * 0.024, 0.6), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    } else if (fx === 4) {
        // NEBULA: the hull turns into a window onto a nebula drifting past with the flight.
        ctx.fillStyle = 'rgba(8,6,24,0.82)';
        full();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const NEB = [[0.3, -0.35, 0.85, [150, 60, 255]], [-0.6, 0.40, 0.75, [30, 200, 220]],
                     [1.5, 0.15, 0.85, [255, 70, 170]], [-1.3, -0.40, 0.70, [70, 110, 255]]];
        const wrap = v => ((v % 2.9) + 2.9) % 2.9 - 1.4;
        for (const [bx, by, br, cc] of NEB) {
            const X = x + r * wrap(bx - S.drift), Y = y + r * by;
            const g = ctx.createRadialGradient(X, Y, 0, X, Y, r * br);
            g.addColorStop(0, rgb(cc, 0.62));
            g.addColorStop(1, rgb(cc, 0));
            ctx.fillStyle = g;
            full();
        }
        if (r > 24) {   // stars only where they resolve (hangar, hero), on top of the masses
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            const d = Math.max(1, r * 0.022);
            for (let i = 0; i < 18; i++) {
                ctx.fillRect(x + r * wrap(i * 0.73 - S.drift * 1.6), y + r * (((i * 0.37) % 1.9) - 0.95), d, d);
            }
        }
        rimStroke({ color: `rgba(${sr},${sg},${sb},0.55)`, w: Math.max(r * 0.07, 1.2) });
        ctx.restore();
    } else if (fx === 5 && S.fire > 0.02) {
        // FIRESTORM: flames lick forward from the tail, longer the closer the run gets to
        // the record, a full blaze once ON FIRE.
        const f = S.fire;
        ctx.save();
        ctx.globalCompositeOperation = add;
        const L = 0.45 + 1.45 * f;
        const g = ctx.createLinearGradient(x - r * 1.1, 0, x + r * (L - 1.1), 0);
        g.addColorStop(0,   `rgba(255,240,180,${0.95 * Math.min(1, 0.4 + f)})`);
        g.addColorStop(0.5, 'rgba(255,110,10,0.72)');
        g.addColorStop(1,   'rgba(200,20,0,0)');
        ctx.fillStyle = g;
        for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(x - r * 1.1, y);
            const n = 5;
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                const w = 0.14 + 0.62 * (1 - t) * (0.5 + 0.5 * f) + 0.09 * Math.sin(gtime * 9 + i * 1.7 + s);
                ctx.lineTo(x + r * (-1.1 + t * L), y + s * r * w);
            }
            ctx.lineTo(x + r * (-1.1 + L), y);
            ctx.closePath();
            ctx.fill();
        }
        if (f >= 1) {
            ctx.globalCompositeOperation = 'lighter';
            rimStroke({ color: `rgba(255,150,40,${0.45 + 0.25 * Math.sin(gtime * 7)})`, w: Math.max(r * 0.09, 1.4) });
        }
        ctx.restore();
    }
    ctx.restore();
}
// Hue of the ship's glow in degrees (NACRE starts from it).
function _paintHue(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 1) return 200;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return h * 60;
}

// ── Paint sheet ──────────────────────────────────────────────────────────
// Layered on the ALL SHIPS sheet, for the ship being flown. Left: that ship big (top-down,
// the hangar portrait) and below it at flight size in the 3D flight view, both wearing
// what is being looked at. Right: five tabs, one per slot (PAINT_SLOTS), over a grid of
// that slot's parts. Owned part -> tap equips. Unowned -> first tap previews it, a second
// tap buys it.
// Earned parts show their condition instead of a price.
let _paintCellRects = [];
function _paintEarnText(part) {
    if (part.earn === 'best') return `${T.best} ${part.need}`;
    if (part.earn === 'worlds') { let n = 0; for (let q = planetsFlown; q; q &= q - 1) n++; return `${T.planet} ${Math.min(n, part.need)}/${part.need}`; }
    // Days and streaks read as a wait, not a fraction -- same rule the ALL SHIPS
    // gates follow since 2026-09-22.
    if (part.earn === 'days') {
        const left = part.need - stardust;
        return left <= 0 ? '' : left <= 1 ? T.tomorrow : T.inDays.replace('{n}', left);
    }
    if (part.earn === 'streak') return T.streakDay.replace('{n}', `${Math.min(bestStreak, part.need)}/${part.need}`);
    return '';
}
function _paintPartName(slot, i) {
    const n = PAINT_SLOTS[slot].list[i].name;
    return n || T.paintNone;
}
function drawPaintSheet() {
    _paintPanelRect = null;
    _paintCellRects = [];
    _paintTabRects = [];
    if (!(showShipPicker && showPaint)) return;
    drawMenuBackdrop();
    const panW = Math.min(W * 0.86, H * 2.1), panH = H * 0.86;
    const panX = W / 2 - panW / 2, panY = H / 2 - panH / 2;
    drawMenuPanel(panX, panY, panW, panH, 14);
    _paintPanelRect = { x: panX, y: panY, w: panW, h: panH };
    const sk = SKINS[activeSkin];
    const [sr, sg, sb] = sk.shadow;
    const slot = PAINT_SLOTS[paintTab], list = slot.list;
    const cur = paintOf(activeSkin) || _paintKit(null);
    const shown = paintPreview >= 0 ? Object.assign({}, cur, { [slot.key]: paintPreview }) : cur;

    // Header
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `bold ${FS * 0.030}px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(255,225,110,0.95)';
    const headY = panY + Math.max(H * 0.075, FS * 0.045);
    ctx.fillText(`${T.paint}  ${sk.name}`, panX + panW * 0.20, headY);
    ctx.font = `bold ${FS * 0.022}px ${FONT_NUM}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${shards} ⧫`, panX + panW - H * 0.04, headY);
    ctx.textAlign = 'center';

    // Previews: the portrait, then the ship at flight size in the flight view.
    const leftCX = panX + panW * 0.20;
    const prevR  = Math.min(H * 0.105, panW * 0.085);
    const prevCY = panY + panH * 0.36;
    ctx.beginPath();
    ctx.ellipse(leftCX, prevCY + prevR * 1.2, prevR * 1.5, prevR * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${sr},${sg},${sb},0.10)`;
    ctx.fill();
    drawShip(leftCX - prevR * 0.1, prevCY, prevR, sk.color, sr, sg, sb, 18, true, shown);
    const stripY = panY + panH * 0.60, stripH = Math.max(PR * 3.4, H * 0.10), stripW = panW * 0.30;
    ctx.beginPath(); ctx.roundRect(leftCX - stripW / 2, stripY - stripH / 2, stripW, stripH, 8);
    ctx.fillStyle = 'rgba(4,5,12,0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,160,205,0.20)'; ctx.lineWidth = 1; ctx.stroke();
    drawFlightShip(leftCX, stripY, PR, sk.color, sr, sg, sb, 20, true, shown);

    // Name + price / state of what is being looked at
    const nameY = stripY + stripH / 2 + Math.max(H * 0.065, FS * 0.038);
    const infoY = nameY + Math.max(H * 0.05, FS * 0.030);
    ctx.font = `bold ${FS * 0.024}px ${FONT_UI}`;
    ctx.fillStyle = `rgba(${sr},${sg},${sb},0.95)`;
    if (paintPreview >= 0) {
        const part = list[paintPreview];
        ctx.fillText(_paintPartName(paintTab, paintPreview), leftCX, nameY);
        if (part.earn) {
            ctx.font = `bold ${FS * 0.019}px ${FONT_NUM}`;
            ctx.fillStyle = 'rgba(170,175,200,0.75)';
            ctx.fillText(_paintEarnText(part), leftCX, infoY);
        } else {
            const canBuy = shards >= part.cost;
            ctx.font = `bold ${FS * 0.021}px ${FONT_NUM}`;
            ctx.fillStyle = canBuy ? 'rgba(255,225,110,0.95)' : 'rgba(170,175,200,0.55)';
            ctx.fillText(`${part.cost} ⧫`, leftCX, infoY);
            if (canBuy) {
                ctx.font = `bold ${FS * 0.016}px ${FONT_UI}`;
                ctx.fillStyle = `rgba(255,225,110,${0.65 + 0.35 * Math.sin(gtime * 5)})`;
                const maxW = panW * 0.34;
                if (ctx.measureText(T.tapToBuy).width > maxW) ctx.font = `bold ${FS * 0.016 * maxW / ctx.measureText(T.tapToBuy).width}px ${FONT_UI}`;
                ctx.fillText(T.tapToBuy, leftCX, infoY + Math.max(H * 0.042, FS * 0.026));
            }
        }
    } else {
        ctx.fillText(_paintPartName(paintTab, cur[slot.key]), leftCX, nameY);
        ctx.font = `bold ${FS * 0.022}px ${FONT_UI}`;
        ctx.fillStyle = 'rgba(140,235,170,0.90)';
        ctx.fillText('✓', leftCX, infoY);
    }

    // Tabs
    const rx0 = panX + panW * 0.40, rw = panW * 0.57;
    const tabY = panY + panH * 0.155, tabH = Math.max(H * 0.062, FS * 0.040);
    const tabLabels = [T.paintHull, T.paintPattern, T.paintAccent, T.paintFinish, T.paintFx];
    const tw = rw / 5;
    for (let i = 0; i < 5; i++) {
        const tx = rx0 + tw * i;
        const on = i === paintTab;
        ctx.beginPath(); ctx.roundRect(tx + 2, tabY, tw - 4, tabH, tabH / 2);
        ctx.fillStyle = on ? `rgba(${sr},${sg},${sb},0.22)` : 'rgba(255,255,255,0.04)';
        ctx.fill();
        ctx.strokeStyle = on ? `rgba(${sr},${sg},${sb},0.85)` : 'rgba(150,160,205,0.22)';
        ctx.lineWidth = on ? 1.5 : 1;
        ctx.stroke();
        let fs = FS * 0.016;
        ctx.font = `bold ${fs}px ${FONT_UI}`;
        const lw = ctx.measureText(tabLabels[i]).width, maxW = tw - 12;
        if (lw > maxW) ctx.font = `bold ${fs * maxW / lw}px ${FONT_UI}`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = on ? 'rgba(240,244,255,0.97)' : 'rgba(175,182,215,0.80)';
        ctx.fillText(tabLabels[i], tx + tw / 2, tabY + tabH / 2 + 1);
        ctx.textBaseline = 'alphabetic';
        const padT = Math.max(0, (44 - tabH) / 2);
        _paintTabRects.push({ x: tx, y: tabY - padT, w: tw, h: tabH + padT * 2 });
    }

    // Parts grid. ALWAYS two rows (a third one does not fit the screen - user's call): a
    // catalogue that grows gets more columns, never another row, and the cell labels shrink
    // to fit. 13 colours since the streak paints, so 7 columns there.
    const rows = 2, cols = Math.max(6, Math.ceil(list.length / rows));
    const gy0 = tabY + tabH + H * 0.025, gh = panY + panH * 0.92 - gy0;
    const cellW = rw / cols, cellH = gh / rows;
    const isColor = slot.list === PAINT_COLORS;
    for (let i = 0; i < list.length; i++) {
        const part = list[i];
        const cx = rx0 + cellW * (i % cols) + cellW / 2;
        const cy = gy0 + cellH * Math.floor(i / cols) + cellH / 2;
        const owned = paintPartOwned(slot.key, i);
        const worn = cur[slot.key] === i;
        const focus = i === paintPreview;
        const tw2 = cellW * 0.90, th = cellH * 0.90;
        ctx.beginPath(); ctx.roundRect(cx - tw2 / 2, cy - th / 2, tw2, th, 9);
        ctx.fillStyle = focus ? `rgba(${sr},${sg},${sb},0.14)` : 'rgba(255,255,255,0.04)';
        ctx.fill();
        ctx.strokeStyle = worn ? `rgba(${sr},${sg},${sb},0.85)` : focus ? 'rgba(255,225,110,0.70)' : 'rgba(150,160,205,0.22)';
        ctx.lineWidth = worn || focus ? 2 : 1;
        ctx.stroke();
        ctx.save();
        if (!owned) ctx.globalAlpha = 0.55;
        const iconY = cy - th * 0.12;
        if (isColor) {
            const rr = Math.min(th * 0.22, tw2 * 0.26);
            ctx.beginPath(); ctx.arc(cx, iconY, rr, 0, Math.PI * 2);
            if (i === 0) {
                // FACTORY: the ship's own colour; as a pattern colour, the automatic contrast.
                ctx.fillStyle = paintTab === 2 ? `rgba(${sr},${sg},${sb},0.35)` : sk.color;
                ctx.fill();
                ctx.strokeStyle = `rgba(${sr},${sg},${sb},0.95)`; ctx.lineWidth = 2; ctx.stroke();
            } else {
                const c = part.rgb, g = ctx.createLinearGradient(cx, iconY - rr, cx, iconY + rr);
                g.addColorStop(0, rgb(lerpClr(c, _SHIP_WHITE, 0.30)));
                g.addColorStop(1, rgb(lerpClr(c, _SHIP_DARK, 0.35)));
                ctx.fillStyle = g; ctx.fill();
                ctx.strokeStyle = `rgba(${sr},${sg},${sb},0.55)`; ctx.lineWidth = 1.5; ctx.stroke();
            }
        } else {
            const k = Object.assign({}, cur, { [slot.key]: i });
            const shipR = Math.min(th * 0.22, tw2 * 0.27);
            drawShip(cx - shipR * 0.1, iconY, shipR, sk.color, sr, sg, sb, 0, false, k);
        }
        ctx.restore();
        const lblFs = Math.min(FS * 0.0135, th * 0.12);
        ctx.font = `bold ${lblFs}px ${FONT_UI}`;
        const nm = _paintPartName(paintTab, i);
        const nmW = ctx.measureText(nm).width;
        if (nmW > tw2 * 0.92) ctx.font = `bold ${lblFs * tw2 * 0.92 / nmW}px ${FONT_UI}`;
        ctx.fillStyle = owned ? 'rgba(225,232,255,0.90)' : 'rgba(170,178,210,0.70)';
        ctx.fillText(nm, cx, cy + th * 0.23);
        ctx.font = `bold ${lblFs}px ${FONT_NUM}`;
        if (worn) {
            ctx.fillStyle = 'rgba(140,235,170,0.90)';
            ctx.fillText('✓', cx, cy + th * 0.41);
        } else if (!owned && part.earn) {
            ctx.fillStyle = 'rgba(170,175,200,0.65)';
            const et = _paintEarnText(part);
            const ew = ctx.measureText(et).width;
            if (ew > tw2 * 0.92) ctx.font = `bold ${lblFs * tw2 * 0.92 / ew}px ${FONT_NUM}`;
            ctx.fillText(et, cx, cy + th * 0.41);
        } else if (!owned) {
            ctx.fillStyle = shards >= part.cost ? 'rgba(255,225,110,0.95)' : 'rgba(170,175,200,0.50)';
            ctx.fillText(`${part.cost} ⧫`, cx, cy + th * 0.41);
        }
        _paintCellRects.push({ x: cx - tw2 / 2, y: cy - th / 2, w: tw2, h: th });
    }

    ctx.textAlign = 'center';
}

// Tap on the Paint sheet (input.js). Always consumes the tap while the sheet is up.
function paintSheetTap(cx, cy) {
    for (let i = 0; i < _paintTabRects.length; i++) {
        if (!inRect(cx, cy, _paintTabRects[i])) continue;
        if (paintTab !== i) { paintTab = i; paintPreview = -1; sfxUiTap(); }
        return;
    }
    const slot = PAINT_SLOTS[paintTab];
    for (let i = 0; i < _paintCellRects.length; i++) {
        if (!inRect(cx, cy, _paintCellRects[i])) continue;
        const part = slot.list[i];
        if (paintPartOwned(slot.key, i)) {
            shipPaint[activeSkin][slot.key] = i;
            paintPreview = -1;
            savePaint();
            sfxUiSelect(activeSkin);
        } else if (part.earn) {
            paintPreview = i;
            sfxUiDenied();
        } else if (paintPreview === i && shards >= part.cost) {
            shards -= part.cost;
            paintOwned[_paintOwnKey(slot.key)] |= 1 << i;
            shipPaint[activeSkin][slot.key] = i;
            paintPreview = -1;
            localStorage.setItem('tunnel_shards', shards);
            savePaint(true);
            sfxUiPurchaseSuccess();
        } else {
            paintPreview = i;
            if (shards >= part.cost) sfxUiTap(); else sfxUiDenied();
        }
        return;
    }
    if (!_paintPanelRect || !inRect(cx, cy, _paintPanelRect)) {
        showPaint = false; paintPreview = -1; sfxUiClose();
    }
}
