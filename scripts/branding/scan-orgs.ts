/**
 * Read organizations' brand colors from their own websites and keep them (OrgBrand), so their public page and launch kit can be themed.
 *
 *   tsx --conditions=react-server --env-file=.env.local scripts/branding/scan-orgs.ts --boards "Kentuckiana,EmployIndy" [--apply] [--browser]
 *
 * --boards   comma-separated name fragments; each must match exactly one workforce board (the script says so when it matches none or several)
 * --ids      comma-separated workforce board ids (e.g. KY-247), exact
 * --apply    save the result (default: print only)
 * --browser  also try a real browser when the plain scan finds nothing (sites that refuse bots or draw their colors with script)
 * --force    overwrite colors that were set by hand (otherwise a hand-set pair is left alone)
 *
 * One request at a time per site, with the limits in src/lib/branding/fetch-site.ts.
 */
import { chromium } from 'playwright'
import { prisma } from '../../src/lib/prisma'
import { scanSite } from '../../src/lib/branding/fetch-site'
import { scanComputedColors, type ScanResult } from '../../src/lib/branding/scan'
import { getOrgBrand, saveOrgBrand } from '../../src/lib/branding/store'

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const flag = (name: string) => process.argv.includes(name)

async function browserScan(url: string): Promise<ScanResult> {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(2500)
    // A string, not a function: the script runner rewrites function bodies in a way the page cannot run.
    const data = (await page.evaluate(`(() => {
      var cnt = {};
      function add(c, w) { if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') return; cnt[c] = (cnt[c] || 0) + w; }
      var els = Array.prototype.slice.call(document.querySelectorAll('body *'), 0, 2500);
      for (var i = 0; i < els.length; i++) {
        var e = els[i], r = e.getBoundingClientRect(), a = Math.max(0, r.width * r.height) / 1000, cs = getComputedStyle(e);
        add(cs.backgroundColor, a); add(cs.color, Math.min(a, 40)); add(cs.borderTopColor, 1);
      }
      var t = document.querySelector('meta[name=theme-color]');
      return { entries: Object.keys(cnt).map(function (k) { return { color: k, weight: cnt[k] }; }), theme: t ? t.content : null };
    })()`)) as { entries: { color: string; weight: number }[]; theme: string | null }
    return scanComputedColors(data.entries, data.theme)
  } finally {
    await browser.close()
  }
}

async function main() {
  const names = (arg('--boards') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const ids = (arg('--ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (names.length === 0 && ids.length === 0) {
    console.log('usage: scan-orgs.ts (--boards "name fragment,name fragment" | --ids KY-247,IN-123) [--apply] [--browser]')
    return
  }
  for (const frag of [...ids, ...names]) {
    const isId = ids.includes(frag)
    const boards = await prisma.workforceBoard.findMany({ where: isId ? { id: frag, website: { not: null } } : { name: { contains: frag, mode: 'insensitive' }, website: { not: null } }, select: { id: true, name: true, state: true, website: true } })
    if (boards.length !== 1) {
      console.log(`\n${frag}: ${boards.length === 0 ? 'no board with a website matches' : `${boards.length} boards match, be more specific: ${boards.map((b) => `${b.name} (${b.state})`).join('; ')}`}`)
      continue
    }
    const b = boards[0]
    // The home page, not the deep link the directory lists: that is where a site shows its own look.
    const home = new URL(b.website!).origin
    console.log(`\n${b.name} (${b.state})  ${home}`)
    let result: (ScanResult & { siteUrl: string }) | null = null
    let via = 'page and stylesheets'
    try {
      result = await scanSite(home)
    } catch (e) {
      console.log(`  plain scan: ${(e as Error).message}`)
    }
    if ((!result || !result.pair) && flag('--browser')) {
      try {
        const r = await browserScan(home)
        result = { ...r, siteUrl: home }
        via = 'a real browser'
      } catch (e) {
        console.log(`  browser scan: ${(e as Error).message}`)
      }
    }
    if (!result || !result.pair) {
      console.log('  no brand colors found. Set them by hand if wanted.')
      continue
    }
    console.log(`  read from ${via}`)
    for (const c of result.candidates.slice(0, 6)) console.log(`    ${c.hex}  ${String(c.weight).padStart(6)}  ${c.where}`)
    const p = result.pair
    console.log(`  primary ${p.primary} (text ${p.primaryInk}), secondary ${p.secondary}${p.secondaryDerived ? ' (derived)' : ''} (text ${p.secondaryInk})`)
    if (flag('--apply')) {
      const existing = await getOrgBrand('WORKFORCE_BOARD', b.id)
      if (existing?.source === 'MANUAL' && !flag('--force')) {
        console.log('  colors were set by hand; left alone (use --force to replace)')
        continue
      }
      await saveOrgBrand({ kind: 'WORKFORCE_BOARD', sourceId: b.id, siteUrl: result.siteUrl, pair: p, candidates: result.candidates, source: 'SCAN' })
      console.log('  saved')
    }
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
