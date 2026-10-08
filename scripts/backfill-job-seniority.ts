/**
 * Levels every live automated job (ATS feed + ncrawl) with job-seniority.ts
 * and archives the ones below the floor (entry-level, hourly/frontline).
 * Jobs posted by employers or recruiters are left alone.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-job-seniority.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/backfill-job-seniority.ts --write
 */
import { prisma } from '@/lib/prisma'
import { classifyTitleRung, MANAGER_FLOOR, seniorityGroupOf } from '@/lib/jobs/job-seniority'

async function main() {
  const write = process.argv.includes('--write')
  const rows = await prisma.exclusiveJobPosting.findMany({
    where: { archivedAt: null, addedBy: { in: ['ats_feed', 'ncrawl'] } },
    select: { id: true, title: true, level: true },
  })

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
  console.log('done')
}

main().finally(() => prisma.$disconnect())
