// Injected into the page: an MPC autopilot + scene staging helpers.
// Plans a 1-switch bang-bang hold schedule over a ~1.3s horizon against a frozen
// snapshot of the obstacle geometry, re-planned every frame.
window.__tunl = (function () {
  const HOR = 105;
  const DT = 1 / 60;

  function spd() { return scrollSpd() * (typeof slowScrollFactor === 'function' ? slowScrollFactor() : 1)
                        * (typeof warpScrollFactor === 'function' ? warpScrollFactor() : 1); }

  // Blocked y-intervals keyed by the TIME the ship reaches them.
  function snapshot() {
    const v = spd(), shipWx = scrollX + PX, out = [];
    const push = (wx0, wx1, y0, y1) => {
      const t0 = (wx0 - shipWx) / v, t1 = (wx1 - shipWx) / v;
      if (t1 < -0.05 || t0 > HOR * DT + 0.2) return;
      out.push({ t0, t1, y0, y1 });
    };
    for (const s of stalactites) {
      if (s.dying) continue;
      const b = boundsAt(s.wx), hw = s.width / 2 + PR * 1.15;
      const fy = (typeof stalFallY === 'function') ? stalFallY(s) : 0;
      if (s.isTop) push(s.wx - hw, s.wx + hw, -1e4, b.top + s.length + fy + PR * 1.1);
      else         push(s.wx - hw, s.wx + hw, b.bot - s.length - PR * 1.1, 1e4);
    }
    for (const m of mines) {
      const r = MINE_R + PR * 1.6;
      push(m.wx - r, m.wx + r, m.baseY - m.bobAmp - r, m.baseY + m.bobAmp + r);
    }
    for (const b of boulders) {
      const hl = (b.hl || b.r) + PR * 1.3, r = b.r + PR * 1.3;
      push(b.wx - hl, b.wx + hl, b.y - r, b.y + r);
    }
    for (const s of cannonShots) {
      for (let k = 0; k <= 8; k++) {
        const tt = k * 0.16;
        const pad = CANNON_SHOT_R + PR * 1.8;
        push(s.wx + s.vx * tt - pad, s.wx + s.vx * tt + pad, s.y + s.vy * tt - pad, s.y + s.vy * tt + pad);
      }
    }
    return out;
  }

  function simulate(hold0, switchStep, haz, startY, startVy) {
    let y = startY, v = startVy, worst = 1e9;
    for (let k = 0; k < HOR; k++) {
      const holdNow = (k < switchStep) ? hold0 : !hold0;
      const vPrev = v;
      v += (holdNow ? -THRUST + GRAVITY : GRAVITY) * DT;
      v = Math.max(-MAX_VY, Math.min(MAX_VY, v));
      y += (vPrev + v) * 0.5 * DT;
      const t = k * DT;
      const b = boundsAt(scrollX + PX + spd() * t);
      let clear = Math.min(y - Math.max(b.top, 0) - PR, Math.min(b.bot, H) - y - PR);
      for (const h of haz) {
        if (t < h.t0 - 0.02 || t > h.t1 + 0.02) continue;
        if (y > h.y0 && y < h.y1) { clear = Math.min(clear, -(Math.min(y - h.y0, h.y1 - y) + 1)); }
        else clear = Math.min(clear, Math.min(Math.abs(y - h.y0), Math.abs(y - h.y1)));
      }
      const decay = 1 - k / (HOR * 1.6);
      worst = Math.min(worst, clear * decay + (clear < 0 ? -400 * (1 - k / HOR) : 0));
    }
    // mild preference for the middle of the corridor at the horizon
    const bEnd = boundsAt(scrollX + PX + spd() * HOR * DT);
    worst -= Math.abs(y - (Math.max(bEnd.top, 0) + Math.min(bEnd.bot, H)) / 2) * 0.02;
    return worst;
  }

  function plan() {
    const haz = snapshot();
    let best = -1e9, bestHold = false;
    for (const h0 of [true, false]) {
      for (let sw = 0; sw <= HOR; sw += 2) {
        const sc = simulate(h0, sw, haz, py, vy);
        if (sc > best) { best = sc; bestHold = h0; }
      }
    }
    return bestHold;
  }

  function step(dt) {
    if (phase === 'play') { holding = plan(); hasHeldThisRun = true; }
    update(dt);
  }

  return {
    run(maxFrames, stop, withDraw) {
      for (let i = 0; i < maxFrames; i++) {
        step(1 / 60);
        if (withDraw) draw();
        if (stop && stop(i)) return { ok: true, i, score, phase };
        if (phase !== 'play') return { ok: false, i, score, phase };
      }
      return { ok: !stop, i: maxFrames, score, phase };
    },
    freeze() { window._freezeDraw = true; window.requestAnimationFrame = () => 0; },
    render() { draw(); },
  };
})();
