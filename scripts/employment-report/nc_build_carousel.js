/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS Playwright script, run with node */
// Build the LinkedIn carousel PDF (1080x1350 px, one slide per page).
// Usage: node nc_build_carousel.js <carousel.html> <output.pdf>
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [src, out] = process.argv.slice(2);
  if (!src || !out) { console.error('usage: node nc_build_carousel.js carousel.html out.pdf'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  await page.goto('file://' + path.resolve(src), { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  await page.pdf({ path: out, width: '1080px', height: '1350px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await browser.close();
  console.log('wrote', out);
})();
