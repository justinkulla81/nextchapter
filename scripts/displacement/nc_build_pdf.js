/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS Playwright script, run with node */
// Build the PDF edition of the NextChapter Displacement Report from its HTML page.
// Usage: node nc_build_pdf.js <report.html> <output.pdf> "<Month YYYY>" "<version>"
// Requires: npm i playwright (and `npx playwright install chromium` once).
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const [src, out, month = '', version = '1.0'] = process.argv.slice(2);
  if (!src || !out) { console.error('usage: node nc_build_pdf.js report.html out.pdf "Month YYYY" version'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
  await page.goto('file://' + path.resolve(src), { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach(d => { d.open = true; });
    document.documentElement.setAttribute('data-theme', 'light');
  });
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  const small = 'font-family:Helvetica,Arial;font-size:7.5px;color:#56636e;width:100%;padding:0 0.7in;display:flex;justify-content:space-between';
  await page.pdf({
    path: out, format: 'Letter', printBackground: true,
    margin: { top: '0.7in', bottom: '0.7in', left: '0.7in', right: '0.7in' },
    displayHeaderFooter: true,
    headerTemplate: `<div style="${small}"><span>NextChapter Displacement Report</span><span>${month} · Version ${version}</span></div>`,
    footerTemplate: `<div style="${small}"><span>launchyournextchapter.com/reports</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  });
  await browser.close();
  console.log('wrote', out);
})();
