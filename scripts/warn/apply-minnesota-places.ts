/**
 * Minnesota's notice letters sit behind a bot check that refuses scripts, so they were read inside a real browser (Claude in Chrome,
 * 2026-10-27) and the worksite city and headcount each letter gives are recorded here. Applies them to the stored notices and resets
 * the workforce-board check for those rows.
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/warn/apply-minnesota-places.ts
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
// employer start, notice date (M/D/YYYY), worksite city, headcount
const READ: [string, string, string | null, number | null][] = [
  ['3M', '10/19/2026', 'Fairmont', 62], ['Newport Healthcare', '9/30/2026', 'St. Cloud', null], ['Medtronic', '9/25/2026', 'Plymouth', null],
  ['Heliene', '8/5/2026', 'Mountain Iron', null], ['Revol Greens', '8/5/2026', 'Medford', null], ['UCare', '8/3/2026', 'Minneapolis', null],
  ['Notions Marketing', '7/2/2026', 'Minneapolis', 200], ['Transdev', '7/1/2026', 'Rochester', 84], ['Acuity Brands', '6/17/2026', 'Winona', null],
  ['OneMain', '6/8/2026', 'Mendota Heights', null], ['Nexus Family Healing', '5/21/2026', 'East Bethel', null], ['First Student', '5/21/2026', 'Plymouth', 125],
  ['Ideal US Talent', '5/4/2026', 'Bloomington', null], ['MTD Acquisition', '4/16/2026', 'Chisholm', null],
]
async function main() {
  let n = 0
  for (const [name, date, city, employees] of READ) {
    const [m, d, y] = date.split('/').map(Number)
    const day = new Date(Date.UTC(y, m - 1, d))
    const rows = await prisma.warnNotice.findMany({ where: { state: 'MN', dismissedAt: null, noticeDate: day, employer: { startsWith: name, mode: 'insensitive' } } })
    for (const r of rows) {
      await prisma.warnNotice.update({ where: { id: r.id }, data: { address: r.address ?? (city ? `${city} MN` : null), employees: r.employees ?? employees, boardCheckedAt: null, workforceBoardId: null, boardMatch: null } })
      n++
    }
  }
  console.log('updated', n)
}
main().finally(() => prisma.$disconnect())
