/**
 * Levels every live automated job (ATS feed + ncrawl) with job-seniority.ts
 * and archives the ones below the floor (entry-level, hourly/frontline).
 * Also tidies crawled company names ("HOME DEPOT, INC." -> "Home Depot").
 * Jobs posted by employers or recruiters are left alone.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-job-seniority.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/backfill-job-seniority.ts --write
 */
import { prisma } from '@/lib/prisma'
import { classifyTitleRung, MANAGER_FLOOR, seniorityGroupOf } from '@/lib/jobs/job-seniority'
import { displayCompanyName } from '@/lib/text/org-name-match'

async function main() {
  const write = process.argv.includes('--write')
  // Read in pages: one findMany over the whole board drops the connection.
  type Row = { id: string; title: string; level: string | null; companyName: string; addedBy: string | null; location: string | null }
  const rows: Row[] = []
  for (let cursor: string | undefined; ; ) {
    const page: Row[] = await prisma.exclusiveJobPosting.findMany({
      where: { archivedAt: null, addedBy: { in: ['ats_feed', 'ncrawl'] } },
      select: { id: true, title: true, level: true, companyName: true, addedBy: true, location: true },
      orderBy: { id: 'asc' },
      take: 5000,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    rows.push(...page)
    if (page.length < 5000) break
    cursor = page[page.length - 1].id
  }


  const renames = rows
    .filter((r) => r.addedBy === 'ncrawl' && displayCompanyName(r.companyName) !== r.companyName)
    .map((r) => ({ id: r.id, companyName: displayCompanyName(r.companyName) }))
  const PLACEHOLDER = /(^|,\s*)(unavailable|n\/?a|none|tbd)(?=\s*(,|$))/gi
  const relocations = rows
    .filter((r) => r.location && PLACEHOLDER.test(r.location))
    .map((r) => ({ id: r.id, location: r.location!.replace(PLACEHOLDER, '').replace(/^[,\s]+|[,\s]+$/g, '') || null }))
  const byLevel = new Map<string, string[]>()
  const below: string[] = []
  const counts = new Map<string, number>()
  for (const r of rows) {
    const { rung, rank } = classifyTitleRung(r.title)
    if (rank < MANAGER_FLOOR) {
      below.push(r.id)
      continue
    }
    counts.set(seniorityGroupOf(rung) ?? rung, (counts.get(seniorityGroupOf(rung) ?? rung) ?? 0) + 1)
    if (r.level !== rung) byLevel.set(rung, [...(byLevel.get(rung) ?? []), r.id])
  }

  console.log(`${rows.length} live automated jobs`)
  console.log(`  keep ${rows.length - below.length}:`, Object.fromEntries(counts))
  console.log(`  archive ${below.length} below the floor`)
  console.log(`  tidy ${renames.length} company names, ${relocations.length} placeholder locations`)
  if (!write) return console.log('dry run — pass --write to apply')

  for (const [level, ids] of byLevel) {
    for (let i = 0; i < ids.length; i += 1000) {
      await prisma.exclusiveJobPosting.updateMany({ where: { id: { in: ids.slice(i, i + 1000) } }, data: { level } })
    }
  }
  for (let i = 0; i < below.length; i += 1000) {
    await prisma.exclusiveJobPosting.updateMany({
      where: { id: { in: below.slice(i, i + 1000) } },
      data: { archivedAt: new Date(), rejectionReason: 'below seniority floor (manager and up, plus senior individual roles)' },
    })
  }
  for (let i = 0; i < renames.length; i += 100) {
    await prisma.$transaction(
      renames.slice(i, i + 100).map((r) => prisma.exclusiveJobPosting.update({ where: { id: r.id }, data: { companyName: r.companyName } }))
    )
  }
  for (let i = 0; i < relocations.length; i += 100) {
    await prisma.$transaction(
      relocations.slice(i, i + 100).map((r) => prisma.exclusiveJobPosting.update({ where: { id: r.id }, data: { location: r.location } }))
    )
  }
  console.log('done')
}

main().finally(() => prisma.$disconnect())
