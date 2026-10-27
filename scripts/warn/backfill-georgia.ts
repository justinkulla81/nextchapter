/**
 * Fills Georgia's county, address, industry, separation date and kind on the notices already stored (the list the browser job reads has
 * none of them; each entry's own page does), then ties them to workforce boards. Safe to re-run: only blank fields are written.
 *
 *   WARN_ENRICH_MAX=250 RESEND_API_KEY= HUNTER_API_KEY= node --env-file=.env.local --conditions=react-server --import tsx scripts/warn/backfill-georgia.ts
 */
import { chromium } from 'playwright'
import { PrismaClient } from '@prisma/client'
import { enrichGeorgia, parseGeorgiaGrid } from '../../src/lib/warn/states'
import { matchNoticesToBoards } from '../../src/lib/workforce/match'

const prisma = new PrismaClient()

async function renderGrid(): Promise<string> {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' })
    await page.goto('https://www.tcsg.edu/warn-public-view/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForFunction(() => document.querySelectorAll('table tr').length > 3, { timeout: 30_000 })
    await page.waitForTimeout(3_000)
    const head = await page.$eval('table.gv-datatables thead', (el) => el.outerHTML)
    await page.evaluate(() => { (window as any).jQuery('table.gv-datatables').DataTable().order([4, 'desc']).draw() }).catch(() => undefined)
    await page.waitForTimeout(2_500)
    await page.selectOption('select[name$="_length"]', '-1')
    await page.waitForFunction(() => document.querySelectorAll('table.gv-datatables tbody tr').length > 30, { timeout: 15_000 }).catch(() => undefined)
    await page.waitForTimeout(1_500)
    const rows = await page.$$eval('table.gv-datatables tbody tr', (trs) => trs.map((tr) => tr.outerHTML))
    return `<table>${head}<tbody>${[...new Set(rows)].join('')}</tbody></table>`
  } finally { await browser.close() }
}

async function main() {
  const rows = await enrichGeorgia(parseGeorgiaGrid(await renderGrid()))
  const enriched = rows.filter((r) => r.county)
  console.log(`grid ${rows.length} rows; ${enriched.length} enriched from entry pages`)
  let updated = 0
  for (const r of enriched) {
    const stored = await prisma.warnNotice.findFirst({ where: { state: 'GA', source: 'WARN_FILING', normalizedEmployer: r.normalizedEmployer, noticeDate: r.noticeDate, employees: r.employees } })
    if (!stored) continue
    const data: Record<string, unknown> = {}
    if (!stored.county && r.county) data.county = r.county
    if (!stored.address && r.address) data.address = r.address
    if (!stored.effectiveDate && r.effectiveDate) data.effectiveDate = r.effectiveDate
    if (!stored.layoffType && r.layoffType) data.layoffType = r.layoffType
    if (!stored.industry && r.industry) data.industry = r.industry
    if (Object.keys(data).length) { await prisma.warnNotice.update({ where: { id: stored.id }, data }); updated++ }
  }
  console.log(`updated ${updated} stored notices`)
  console.log('boards', JSON.stringify(await matchNoticesToBoards(240_000)))
}

main().finally(() => prisma.$disconnect())
