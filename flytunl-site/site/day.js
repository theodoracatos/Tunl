/* ============================================================
   day.js - which cave is it today?
   ============================================================
   TUNL seeds every run from the UTC date, so every player on Earth flies the
   same cave on the same day. That makes the whole thing derivable on the
   client with no backend: the day's rock colour, its world number, its world
   name and its planet. This file is the site's copy of that derivation.

   It does three things:

     1. Sets --day-c on <html> BEFORE first paint (hence: loaded blocking, in
        <head>, on every page). That custom property is the site's single
        accent colour - links, rules, buttons, the sticky bar - so flytunl.ch
        changes colour once a day on its own, the same way the game's title
        screen, world and debriefing all take the day's rock.
     2. Fills every `.today` strip in the page with WORLD n - NAME - PLANET.
     3. Steps the page background darker as you scroll (the "descent").

   The four tables below MIRROR src/world.js (WORLD_ADJ, WORLD_NOUN, the
   _worldTable shuffle, _worldDayIdx) and src/constants.js (WEEKDAY_PALETTES'
   planet and wallBase columns). build-site.mjs re-reads src/ on every build
   and FAILS the build if they have drifted - a stale mirror would have the
   site announce a different cave than the one the game generates that day.

   Site-only. Nothing here is loaded by the game or by either app.
   ============================================================ */
(function () {
  var ADJ = [
    'Crimson','Frozen','Ancient','Dark','Burning','Hollow',
    'Scarlet','Azure','Obsidian','Toxic','Golden','Crystal',
    'Iron','Shadow','Violet','Ember','Storm','Silent',
    'Blazing','Neon','Jade','Cobalt','Ash','Pale',
    'Rusted','Glowing','Sunken','Broken','Eternal','Molten'
  ];
  var NOUN = [
    'Abyss','Depths','Hollow','Cavern','Passage','Rift',
    'Void','Chasm','Grotto','Descent','Labyrinth','Sanctum',
    'Vault','Shaft','Tunnel','Canyon','Gorge','Sinkhole',
    'Drift','Channel','Corridor','Vein','Pit','Basin',
    'Keep','Ruin','Crypt','Forge','Crater','Nexus'
  ];
  var PLANET = ['Ceres','Mars','Luna','Io','Ianthe','Pallas','Rhodia'];   /* Monday first, like weekdayIndex() */
  var WALL = [[150,178,210],[255,148,72],[222,222,234],[112,255,206],[182,122,255],[196,228,96],[255,122,176]];

  var day = null;

  try {
    /* the seeded shuffle from src/world.js _worldTable: every adj+noun pair
       appears exactly once per 900-day cycle, in a non-sequential order */
    var N = ADJ.length * NOUN.length, order = [], i;
    for (i = 0; i < N; i++) order.push(i);
    var seed = 0x9e3779b9 >>> 0;
    var rnd = function () {
      seed = (seed + 0x6D2B79F5) >>> 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (i = N - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }

    var now   = new Date();
    var epoch = Date.UTC(2025, 0, 1);
    var today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    var idx   = Math.floor((today - epoch) / 86400000);

    var gen  = Math.floor(idx / N) + 1;
    var slot = order[((idx % N) + N) % N];
    var name = ADJ[slot % ADJ.length] + ' ' + NOUN[Math.floor(slot / ADJ.length)];
    if (gen > 1) name += ' ' + gen;

    var wd = (now.getUTCDay() + 6) % 7;      /* Monday = 0, like weekdayIndex() */
    var c  = WALL[wd];

    day = {
      levelNum: Math.max(1, idx + 1),
      name:     name,
      planet:   PLANET[wd],
      rgb:      c,
      color:    'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'
    };
    document.documentElement.style.setProperty('--day-c', day.color);
    document.documentElement.style.setProperty('--day-rgb', c[0] + ',' + c[1] + ',' + c[2]);
  } catch (e) { /* the stylesheet's own fallback colour stands */ }

  window.TUNL_DAY = day;

  /* Fill the "today's cave" strips. They ship hidden, so a browser that never
     runs this simply never shows a half-written line. */
  function fill() {
    if (!day) return;
    var strips = document.querySelectorAll('.today'), k, st;
    for (k = 0; k < strips.length; k++) {
      st = strips[k];
      try {
        st.querySelector('.t-no').textContent     = day.levelNum;
        st.querySelector('.t-name').textContent   = day.name.toUpperCase();
        st.querySelector('.t-planet').textContent = day.planet.toUpperCase();
        st.hidden = false;
      } catch (e) {}
    }
  }
  /* The descent. The game lifts the void toward the day's rock near the cave
     mouth and steps it darker at each sector boundary (depthLightAt, draw.js) -
     steps, never a fade, because a continuous fade is below what anyone
     notices. Every page does the same as you scroll: lit at the top, plain
     void by the footer. Capped low on purpose - "never literally bright".
     site.css paints the body from --depth-bg. */
  var STEPS = [0.055, 0.040, 0.026, 0.013, 0];
  var VOID = [4, 4, 10];
  var cur = -1, ticking = false;

  function descend() {
    ticking = false;
    if (!day || !document.body) return;
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var t = Math.min(1, Math.max(0, window.scrollY / max));
    var i = Math.min(STEPS.length - 1, Math.floor(t * STEPS.length));
    if (i === cur) return;
    cur = i;
    var a = STEPS[i], c = [0, 1, 2].map(function (k) {
      return Math.round(VOID[k] + (day.rgb[k] - VOID[k]) * a);
    });
    document.documentElement.style.setProperty('--depth-bg', 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')');
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(descend); }
  }, { passive: true });
  window.addEventListener('resize', descend);

  function ready() { fill(); descend(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else { ready(); }
})();
