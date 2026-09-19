// Capture 2868x1320 "simulator-equivalent" TUNL raw frames headlessly (2026-09-19).
//
// The store frames need one landscape capture per slide at the iPhone 17 Pro Max's
// own footprint. Driving the real simulator by hand is slow and the frame you get is
// whatever the thumb happened to produce; this drives headless Chrome over the CDP
// instead, at 956x440 CSS with deviceScaleFactor 3 - which is exactly what
// constants.js turns into cv.width/height 2868x1320 - and stages each scene from the
// page's own globals (the game is one shared global scope, see CLAUDE.md).
//
//   - A stub window.webkit.messageHandlers makes isWeb() false, so the canvas is the
//     APP build (title dock position, rail fit), not the web one. No install CTA, no
//     web frame - those are page chrome outside the canvas anyway.
//   - autopilot.js flies the run: a 1-switch bang-bang plan re-solved every frame
//     against a snapshot of the real obstacle geometry. It reaches ~score 680-970 on
//     the sampled days, which is deep enough for every slide.
//   - Each scene in scenes.json runs until its own composition predicate is true
//     (score band, both walls on screen, N obstacles ahead, no notif/milestone
//     overlay), then freezes and reads cv.toDataURL. So the frames are real
//     gameplay, just picked deterministically instead of by luck.
//   - localStorage is seeded before any script runs (records, ship, the 15.0
//     tunnel_record_reset_v15 flag - without it state.js wipes `best` and the title
//     screen has no record plate), and the locale is forced to en-US so
//     toLocaleString() does not print German thousands separators.
//
// Needs a server on the repo root: python3 -m http.server 8787
// Run: node Screenshots/capture/capture.mjs Screenshots/iOS_<version>
import { launch, Session } from './cdp.mjs';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';

const AUTOPILOT = fs.readFileSync(new URL('./autopilot.js', import.meta.url), 'utf8');
const OUT = process.argv[2] || '/tmp/tunl-shots';
fs.mkdirSync(OUT, { recursive: true });

const { proc, wsUrl } = await launch();
const s = await Session.attach(wsUrl);
await s.send('Page.enable'); await s.send('Runtime.enable');
await s.send('Emulation.setDeviceMetricsOverride', { width: 956, height: 440, deviceScaleFactor: 3, mobile: false });
await s.send('Emulation.setLocaleOverride', { locale: 'en-US' });
await s.send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.webkit = { messageHandlers: new Proxy({}, { get: () => ({ postMessage(){} }) }) };
    try {
      localStorage.clear();
      localStorage.setItem('tunnel_record_reset_v15','1');
      localStorage.setItem('tunnel_best','1284');
      localStorage.setItem('tunnel_lifetime_dist','1840000');
      localStorage.setItem('tunnel_total_runs','210');
      localStorage.setItem('tunnel_skin','3'); localStorage.setItem('tunnel_all_ships','1');
      localStorage.setItem('tunnel_stardust','46');
      localStorage.setItem('tunnel_shards','780');
      localStorage.setItem('tunnel_streak','12');
      localStorage.setItem('tunnel_daily_runs','7');
      localStorage.setItem('tunnel_lang','en');
      localStorage.setItem('tunl_notif_prompt_done','1');
    } catch(e){}
  `,
});

async function load(day) {
  await s.send('Page.navigate', { url: `http://localhost:8787/tunl.html?d=${day}` });
  await sleep(2600);
  await s.eval(AUTOPILOT);
  await s.eval(`document.fonts.ready.then(()=>1)`);
  return s.eval(`JSON.stringify({W,H,theme:getTheme().name,phase})`);
}

async function shot(name) {
  const dataUrl = await s.eval(`cv.toDataURL('image/png')`);
  const b64 = dataUrl.split(',')[1];
  fs.writeFileSync(path.join(OUT, name), Buffer.from(b64, 'base64'));
  console.log('  ->', name);
}

// ---------------------------------------------------------------- scenes
const scenes = JSON.parse(fs.readFileSync(new URL('./scenes.json', import.meta.url), 'utf8'));
for (const sc of scenes) {
  console.log(sc.name, await load(sc.day));
  const r = await s.eval(sc.js);
  console.log('  stage:', JSON.stringify(r));
  await shot('capture-' + sc.name.replace('_', '-') + '.png');
}
s.close(); proc.kill();
