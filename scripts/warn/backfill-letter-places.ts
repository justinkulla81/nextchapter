/**
 * Fills the place and headcount of existing Hawaii and West Virginia notices from each notice's own page or letter, then re-runs the
 * workforce-board match for every recent notice that has none (a board is looked up once, so a notice checked before its place was known,
 * or before a board's counties were loaded, stays unmatched until it is reset). Minnesota's letters sit behind a bot check and are not read here.
 *
 * DRY RUN BY DEFAULT.
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/warn/backfill-letter-places.ts --out <dir> [--apply]
 * With --apply the rows about to change are saved to <dir>/backup-letter-places.json first.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { parseHawaiiWarn, parseWestVirginiaWarn, HAWAII_PAGE, WEST_VIRGINIA_PAGE } from '../../src/lib/warn/states'
import { enrichFromLetters, hawaiiCountyFromText, type LetterRow } from '../../src/lib/warn/letters'
import { WARN_USER_AGENT } from '../../src/lib/warn/sources'
import { matchNoticesToBoards } from '../../src/lib/workforce/match'

const prisma = new PrismaClient()
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const out = args[args.indexOf('--out') + 1]

async function list(url: string, parse: (h: string) => LetterRow[]): Promise<LetterRow[]> {
  const res = await fetch(url, { headers: { 'User-Agent': WARN_USER_AGENT } })
  if (!res.ok) throw new Error(`${url} ${res.status}`)
  return parse(await res.text())
}

async function main() {
  const rows = [...(await list(HAWAII_PAGE, parseHawaiiWarn)), ...(await list(WEST_VIRGINIA_PAGE, parseWestVirginiaWarn))]
  const since = new Date(Date.now() - 540 * 86_400_000)
  const recent = rows.filter((r) => r.noticeDate && r.noticeDate >= since)
  await enrichFromLetters(recent, 400)
  const got = recent.filter((r) => r.address || r.county || r.employees != null)
  console.log({ listed: rows.length, recent: recent.length, enriched: got.length })
  for (const r of got.slice(0, 40)) console.log(r.state, '|', r.employer, '|', r.county ?? '', '|', r.address ?? '', '|', r.employees ?? '')
  if (!apply) return
  if (!out) throw new Error('--out <dir> required with --apply')
  mkdirSync(out, { recursive: true })
  const existing = await prisma.warnNotice.findMany({ where: { state: { in: ['HI', 'WV'] }, dismissedAt: null, noticeDate: { gte: since } } })
  writeFileSync(`${out}/backup-letter-places.json`, JSON.stringify(existing, null, 1))
  let updated = 0
  for (const r of got) {
    const day = r.noticeDate!
    const hit = existing.find((e) => e.state === r.state && e.normalizedEmployer === r.normalizedEmployer && e.noticeDate?.getTime() === day.getTime())
    if (!hit) continue
    await prisma.warnNotice.update({
      where: { id: hit.id },
      data: { county: hit.county ?? r.county, address: hit.address ?? r.address, employees: hit.employees ?? r.employees, boardCheckedAt: null, workforceBoardId: null, boardMatch: null },
    })
    updated++
  }
  console.log('updated', updated)
  // Older Hawaii notices have no page of their own; the employer's name sometimes says where ("JINYA Ramen Bar – Honolulu").
  let named = 0
  for (const e of existing.filter((x) => x.state === 'HI' && !x.county && !x.address)) {
    const county = hawaiiCountyFromText(e.employer)
    if (!county) continue
    await prisma.warnNotice.update({ where: { id: e.id }, data: { county } })
    named++
  }
  console.log('hawaii counties from the employer name', named)
  // Every other recent notice with no board gets one more look: boards and places have been added since it was last checked.
  const reset = await prisma.warnNotice.updateMany({ where: { dismissedAt: null, workforceBoardId: null, state: { not: null }, noticeDate: { gte: since } }, data: { boardCheckedAt: null } })
  console.log('reset for another board check', reset.count)
  for (let i = 0; i < 20; i++) {
    const r = await matchNoticesToBoards(100_000)
    console.log('board pass', i, r)
    if (r.checked === 0) break
  }
}
main().finally(() => prisma.$disconnect())
