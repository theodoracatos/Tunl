// Renders branding/promo_paint_master.png, the Play "Symbol" of the Lackiermeister IAP (unlock_all_paints):
// three top-down F-14s in different paint kits, drawn by the game's own drawShip. No text (Play rule).
//   node tools/render-paint-master-icon.mjs "$PWD" branding/promo_paint_master.png   (needs global playwright)
import { createRequire } from 'module';
const require = createRequire('/opt/homebrew/lib/node_modules/');
const { chromium } = require('playwright');
const [,, root, out] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 956, height: 440 } });
await page.addInitScript(() => {
  window.webkit = { messageHandlers: { haptic: { postMessage() {} }, iap: { postMessage() {} } } };
});
await page.goto('file://' + root + '/tunl.html');
await page.waitForTimeout(1500);
const url = await page.evaluate(() => {
  window._freezeDraw = true;
  const S = 1024;
  cv.style.width = S + 'px'; cv.width = S; cv.height = S;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(S * 0.5, S * 0.42, 0, S * 0.5, S * 0.5, S * 0.75);
  g.addColorStop(0, '#3a1f6e'); g.addColorStop(0.55, '#1a0f3a'); g.addColorStop(1, '#0a0618');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  const ships = [
    { x: 0.30, y: 0.70, r: 150, skin: 3, kit: { c: 2, p: 2, pc: 4, m: 2, fx: 0 } },
    { x: 0.70, y: 0.70, r: 150, skin: 1, kit: { c: 7, p: 8, pc: 2, m: 5, fx: 0 } },
    { x: 0.50, y: 0.36, r: 185, skin: 2, kit: { c: 4, p: 5, pc: 10, m: 3, fx: 0 } },
  ];
  for (const s of ships) {
    const sk = SKINS[s.skin];
    ctx.save();
    ctx.translate(S * s.x, S * s.y);
    ctx.rotate(-Math.PI / 2);
    drawShip(0, 0, s.r, sk.color, sk.shadow[0], sk.shadow[1], sk.shadow[2], 40, true, s.kit);
    ctx.restore();
  }
  return cv.toDataURL('image/png');
});
const fs = await import('fs');
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
await browser.close();
