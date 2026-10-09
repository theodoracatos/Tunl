// Renders the three IAP store images (1024x1024, App Store promotional image + Play "Symbol")
// from the shop's own card pictures, so the stores show what the shop shows:
//   branding/promo_remove_ads.png        <- _shopVisAds   (default ship, factory paint)
//   branding/promo_unlock_all_ships.png  <- _shopVisShips
//   branding/promo_paint_master.png      <- _shopVisPaint
// Card fill + product-colour glow as in _shopCards; no name, no price (the store prints both).
//   node tools/render-iap-promos.mjs "$PWD"   (needs global playwright)
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/opt/homebrew/lib/node_modules/');
const { chromium } = require('playwright');
const [,, root] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 956, height: 440 } });
await page.addInitScript(() => {
  window.webkit = { messageHandlers: { haptic: { postMessage() {} }, iap: { postMessage() {} } } };
});
await page.goto('file://' + root + '/tunl.html');
await page.waitForTimeout(1500);
const urls = await page.evaluate(async () => {
  window._freezeDraw = true;
  await document.fonts.load(`bold 60px ${FONT_UI}`);
  const S = 1024;
  cv.style.width = S + 'px'; cv.width = S; cv.height = S;
  // [file, picture, colour] - colours from the showShop card list.
  const items = [
    ['promo_remove_ads',       _shopVisAds,   [143, 188, 255]],
    ['promo_unlock_all_ships', _shopVisShips, [255, 200,  90]],
    ['promo_paint_master',     _shopVisPaint, [235, 130, 245]],
  ];
  const out = {};
  for (const [name, vis, [r, g, b]] of items) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0b0d1f'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(15,18,40,0.72)'; ctx.fillRect(0, 0, S, S);
    // The card's picture band is wider than tall; keep its proportions, centred. The ads
    // picture is a cave whose walls must reach the edges, so it takes the whole square.
    const vw = S, vh = vis === _shopVisAds ? S : S * 0.72, vy = (S - vh) / 2;
    const glow = ctx.createRadialGradient(S / 2, vy + vh * 0.55, 0, S / 2, vy + vh * 0.55, S * 0.6);
    glow.addColorStop(0, `rgba(${r},${g},${b},0.20)`);
    glow.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = glow; ctx.fillRect(0, 0, S, S);
    vis(0, vy, vw, vh);
    out[name] = cv.toDataURL('image/png');
  }
  return out;
});
for (const [name, url] of Object.entries(urls)) {
  fs.writeFileSync(`${root}/branding/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
}
await browser.close();
