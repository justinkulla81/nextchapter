/**
 * Settles the CRM Review List "Colleges to match" (2026-10-26). Decided from our own data, not guessed:
 *  - "a shortened form of the name": the suggested organization is never a university and is almost always in another
 *    state (Arkansas Talent Group for Arkansas State), so the college is its own organization.
 *  - "same website, different name": 252 of 257 point at an organization already linked to another campus, so they are
 *    sister campuses, each its own organization.
 *  - the 24 left were read one by one: SAME below is the same college under a different spelling or name; the rest differ.
 * Dry run unless --apply:  node --env-file=.env.local --conditions=react-server --import tsx scripts/colleges/settle-review.ts [--apply]
 */
import { prisma } from '@/lib/prisma'
import { resolveCollegeAsDifferent, resolveCollegeAsSame } from '@/lib/workforce/college-org-link'

const SAME = new Set([
  'BridgeValley Community & Technical College',
  'Caldwell Community College and Technical Institute',
  'Chattanooga College Medical Dental and & Technical Careers',
  'Franklin and Marshall College',
  'Good Samaritan College of Nursing and Health Science',
  'Hobart William Smith Colleges',
  'Joyce University of Nursing and Health Sciences',
  'Northland Community and Technical College',
  'Molloy College',
  'West Texas A & M University',
])

async function retry<T>(f: () => Promise<T>): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await f() } catch (e) {
      if (i >= 6) throw e
      await new Promise((r) => setTimeout(r, 2000 * i))
    }
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const rows = await prisma.collegeOrgLink.findMany({ where: { matchStatus: 'REVIEW' }, select: { unitid: true } })
  const names = new Map((await prisma.collegeProfile.findMany({ where: { unitid: { in: rows.map((r) => r.unitid) } }, select: { unitid: true, name: true } })).map((c) => [c.unitid, c.name]))
  const same = rows.filter((r) => SAME.has(names.get(r.unitid) ?? ''))
  const different = rows.filter((r) => !SAME.has(names.get(r.unitid) ?? ''))
  console.log(apply ? 'APPLYING' : 'DRY RUN', { review: rows.length, link: same.length, addAsNew: different.length })
  if (!apply) return
  for (const r of same) await retry(() => resolveCollegeAsSame(r.unitid))
  let n = 0
  for (const r of different) { await retry(() => resolveCollegeAsDifferent(r.unitid)); if (++n % 100 === 0) console.log(n, 'added') }
  console.log('DONE')
}

main().finally(() => prisma.$disconnect())
