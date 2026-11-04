/**
 * Reads company brand colors from their own websites without the database: "name|key" lines from the file given as the first argument
 * (the company's name and its Company.canonicalNameNormalized key), and one "key<TAB>primary<TAB>secondary<TAB>derived<TAB>siteUrl" line per
 * company whose colors the scan is confident about. A guessed address is used only when its home page names the company
 * (src/lib/branding/company-domain.ts). Nothing is saved here; the lines become OrgBrand rows of kind EMPLOYER keyed by the key.
 *
 *   tsx --conditions=react-server scripts/branding/scan-names.ts names.txt [--browser]
 *
 * With --browser, a site whose colors the page and its stylesheets do not give (it draws them with script) is opened in a real browser and its
 * computed colors are read instead (slower: one page at a time).
 */
import { readFileSync } from 'node:fs'
import { chromium, type Browser } from 'playwright'
import { fetchSite } from '../../src/lib/branding/fetch-site'
import { guessHosts, pageMatchesCompany } from '../../src/lib/branding/company-domain'
import { confidentPair, scanBrand, scanComputedColors, type ScanResult } from '../../src/lib/branding/scan'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const browserMode = process.argv.includes('--browser')

let browser: Browser | null = null
let browserBusy: Promise<unknown> = Promise.resolve()
async function browserScan(url: string): Promise<ScanResult> {
  const run = async (): Promise<ScanResult> => {
    browser ??= await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await page.waitForTimeout(2000)
      const data = (await page.evaluate(`(() => {
        var cnt = {};
        function add(c, w) { if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') return; cnt[c] = (cnt[c] || 0) + w; }
        var els = Array.prototype.slice.call(document.querySelectorAll('body *'), 0, 2500);
        for (var i = 0; i < els.length; i++) { var e = els[i], r = e.getBoundingClientRect(), a = Math.max(0, r.width * r.height) / 1000, cs = getComputedStyle(e); add(cs.backgroundColor, a); add(cs.color, Math.min(a, 40)); add(cs.borderTopColor, 1); }
        var t = document.querySelector('meta[name=theme-color]');
        return { entries: Object.keys(cnt).map(function (k) { return { color: k, weight: cnt[k] }; }), theme: t ? t.content : null };
      })()`)) as { entries: { color: string; weight: number }[]; theme: string | null }
      return scanComputedColors(data.entries, data.theme)
    } finally {
      await page.close()
    }
  }
  const next = browserBusy.then(run, run)
  browserBusy = next.catch(() => {})
  return next
}

async function main() {
  const rows = readFileSync(process.argv[2], 'utf8').split('\n').map((l) => l.split('|')).filter((r) => r[0] && r[1])
  let next = 0
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < rows.length) {
      const [name, key] = rows[next++]
      let done = false
      for (const host of guessHosts(name).slice(0, 4)) {
        await sleep(200)
        try {
          const site = await fetchSite(`https://${host}`)
          if (!pageMatchesCompany(name, site.html)) continue
          let pair = confidentPair(scanBrand(site.html, site.stylesheets, site.hints))
          if (!pair && browserMode) pair = confidentPair(await browserScan(site.siteUrl))
          if (pair) { console.log(`${key}\t${pair.primary}\t${pair.secondary}\t${pair.secondaryDerived ? 1 : 0}\t${site.siteUrl}`); done = true; break }
        } catch { /* try the next address */ }
      }
      if (!done) console.error(`not read: ${name}`)
    }
  }))
}
main().then(() => browser?.close())
