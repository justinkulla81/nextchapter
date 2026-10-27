/**
 * Corrects notices the daily Big Local News scraper stored with the layoff date where the notice (received) date belongs:
 * Washington (235 of 273 notices) and South Carolina (every one). Each stored row is matched to the state's own list by employer
 * and headcount, where the stored notice date equals the list's layoff date (the mix-up) or its notice date (already right); matched
 * rows are updated in place so leads and everything linked to them keep their ids. Kentucky had the same fault and was fixed by
 * scripts/warn/fix-kentucky-dates.ts.
 *
 * DRY RUN BY DEFAULT.
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/warn/fix-date-mixups.ts --state WA --out <dir> [--apply]
 * With --apply the rows about to change are saved to <dir>/backup-<state>-notices.json first.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { SOUTH_CAROLINA_PAGE, parseSouthCarolinaWarn, resolveSouthCarolinaPdfs } from '../../src/lib/warn/states'
import { fetchWashington } from '../../src/lib/warn/washington'
import type { WarnRow } from '../../src/lib/warn/sources'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const arg = (name: string, d: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : d }
const STATE = arg('--state', '')
const OUT = arg('--out', './fix-date-mixups-out')
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'

async function nativeRows(): Promise<{ rows: WarnRow[]; url: string }> {
  if (STATE === 'WA') return { rows: await fetchWashington(new Date(Date.now() - 600 * 86_400_000)), url: 'https://fortress.wa.gov/esd/file/warn/Public/SearchWARN.aspx' }
  if (STATE === 'SC') {
    const page = await (await fetch(SOUTH_CAROLINA_PAGE, { headers: { 'User-Agent': UA } })).text()
    const rows: WarnRow[] = []
    for (const u of resolveSouthCarolinaPdfs(page)) rows.push(...(await parseSouthCarolinaWarn(Buffer.from(await (await fetch(u, { headers: { 'User-Agent': UA } })).arrayBuffer()))))
    return { rows, url: SOUTH_CAROLINA_PAGE }
  }
  throw new Error('pass --state WA or --state SC')
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const { rows: native, url } = await nativeRows()
  console.log(`${STATE}'s own list: ${native.length} notices`)
  const stored = await prisma.warnNotice.findMany({ where: { state: STATE, source: 'WARN_FILING', NOT: { sourceUrl: { contains: 'layoffs.fyi', mode: 'insensitive' } } } })
  const used = new Set<number>()
  const plan: { id: string; native: number; employer: string; from: string; to: string }[] = []
  const unmatched: string[] = []
  for (const row of stored) {
    const i = native.findIndex((n, idx) => !used.has(idx) && n.normalizedEmployer === row.normalizedEmployer && n.employees === row.employees
      && (day(n.effectiveDate) === day(row.noticeDate) || day(n.noticeDate) === day(row.noticeDate)))
    // Failing that, the only unused notice of that employer with that headcount (a layoff date given as a range, for one).
    const only = i !== -1 ? [] : native.map((n, idx) => ({ n, idx })).filter(({ n, idx }) => !used.has(idx) && n.normalizedEmployer === row.normalizedEmployer && n.employees === row.employees)
    const j = i !== -1 ? i : only.length === 1 ? only[0].idx : -1
    if (j === -1) { unmatched.push(`${row.employer} ${day(row.noticeDate)} ${row.employees}`); continue }
    used.add(j)
    plan.push({ id: row.id, native: j, employer: row.employer, from: `${day(row.noticeDate)} / ${day(row.effectiveDate)}`, to: `${day(native[j].noticeDate)} / ${day(native[j].effectiveDate)}` })
  }
  const changes = plan.filter((p) => p.from !== p.to)
  console.log(`stored ${stored.length}; matched ${plan.length} (${changes.length} need a change); unmatched ${unmatched.length}`)
  for (const u of unmatched.slice(0, 12)) console.log('  unmatched:', u)
  for (const p of changes.slice(0, 5)) console.log(`  ${p.employer}: ${p.from} -> ${p.to}`)
  writeFileSync(`${OUT}/plan-${STATE}.json`, JSON.stringify({ changes, unmatched }, null, 2))
  if (!APPLY) { console.log('dry run: nothing written to the database'); return }

  const ids = new Set(changes.map((c) => c.id))
  writeFileSync(`${OUT}/backup-${STATE}-notices.json`, JSON.stringify(stored.filter((r) => ids.has(r.id)), null, 2))
  let done = 0
  const skipped: string[] = []
  for (const c of changes) {
    const nat = native[c.native]
    try {
      await prisma.warnNotice.update({ where: { id: c.id }, data: { noticeDate: nat.noticeDate, effectiveDate: nat.effectiveDate, ...(nat.county ? { county: nat.county } : {}), sourceUrl: url } })
      done++
    } catch (e) {
      // The table is unique on state, employer, notice date and headcount: two sites of one filing can collide once the date is right.
      if ((e as { code?: string }).code === 'P2002') skipped.push(`${c.employer} ${c.to}`)
      else throw e
    }
  }
  console.log(`updated ${done} notices; skipped ${skipped.length} that would duplicate another row`)
  for (const k of skipped.slice(0, 10)) console.log('  skipped:', k)
}

main().finally(() => prisma.$disconnect())
