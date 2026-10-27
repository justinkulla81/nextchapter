/**
 * Corrects the 39 Kentucky notices the daily Big Local News scraper stored with the date received and the projected date swapped, and
 * adds the county and NAICS the workbook carries. Each stored row is matched to the row in Kentucky's own workbooks with the same
 * employer and headcount whose date received equals the stored effective date (the swap); matched rows are updated in place, so the
 * 23 that were promoted to leads and everything pointing at them (matches, rapid responses, drafts) keep their ids.
 *
 * DRY RUN BY DEFAULT.
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/warn/fix-kentucky-dates.ts --out <dir> [--apply]
 * With --apply the rows about to change are saved to <dir>/backup-ky-notices.json first.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { KENTUCKY_PAGE, parseKentuckyWorkbook, resolveKentuckyFiles } from '../../src/lib/warn/states'
import { readXlsx } from '../../src/lib/warn/xlsx'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const outIdx = process.argv.indexOf('--out')
const OUT = outIdx > 0 ? process.argv[outIdx + 1] : './fix-kentucky-out'
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
const UA = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/116.0'

async function main() {
  mkdirSync(OUT, { recursive: true })
  const page = await (await fetch(KENTUCKY_PAGE, { headers: { 'User-Agent': UA } })).text()
  const { current, prior } = resolveKentuckyFiles(page)
  const native = []
  for (const u of [current, prior].filter((x): x is string => !!x)) {
    const buf = Buffer.from(await (await fetch(u, { headers: { 'User-Agent': UA } })).arrayBuffer())
    native.push(...parseKentuckyWorkbook(readXlsx(buf)))
  }
  console.log(`Kentucky's workbooks: ${native.length} notices`)

  const stored = await prisma.warnNotice.findMany({ where: { state: 'KY', source: 'WARN_FILING' } })
  const plan: { id: string; employer: string; from: string; to: string; county: string | null }[] = []
  const unmatched: string[] = []
  const used = new Set<number>()
  for (const row of stored) {
    const i = native.findIndex((n, idx) => !used.has(idx) && n.normalizedEmployer === row.normalizedEmployer && n.employees === row.employees
      && (day(n.noticeDate) === day(row.effectiveDate) || day(n.noticeDate) === day(row.noticeDate)))
    if (i === -1) { unmatched.push(`${row.employer} ${day(row.noticeDate)} ${row.employees}`); continue }
    used.add(i)
    plan.push({ id: row.id, employer: row.employer, from: `${day(row.noticeDate)} / ${day(row.effectiveDate)}`, to: `${day(native[i].noticeDate)} / ${day(native[i].effectiveDate)}`, county: native[i].county })
  }
  console.log(`stored ${stored.length}; matched ${plan.length}; unmatched ${unmatched.length}`)
  for (const u of unmatched) console.log('  unmatched:', u)
  for (const p of plan.slice(0, 6)) console.log(`  ${p.employer}: ${p.from} -> ${p.to}`)
  writeFileSync(`${OUT}/plan.json`, JSON.stringify(plan, null, 2))
  if (!APPLY) { console.log('dry run: nothing written to the database'); return }

  writeFileSync(`${OUT}/backup-ky-notices.json`, JSON.stringify(stored, null, 2))
  let n = 0
  for (const [idx, p] of plan.entries()) {
    const nat = native[[...used][idx]]
    await prisma.warnNotice.update({
      where: { id: p.id },
      data: { noticeDate: nat.noticeDate, effectiveDate: nat.effectiveDate, county: nat.county, industry: nat.industry, layoffType: nat.layoffType, sourceUrl: KENTUCKY_PAGE },
    })
    n++
  }
  console.log(`updated ${n} notices`)
}

main().finally(() => prisma.$disconnect())
