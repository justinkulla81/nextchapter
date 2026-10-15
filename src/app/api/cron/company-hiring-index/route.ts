import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { prisma } from '@/lib/prisma'
import { rebuildHiringIndex } from '@/lib/companies/hiring-index'

export const maxDuration = 300

// Nightly company hiring index (src/lib/companies/hiring-index.ts), incremental:
// links and copies new postings, closes archived openings, and reprices and
// reprofiles only what changed since the last successful run plus a seventh of
// everything (all of it weekly; benchmarks rebuilt Sundays). Paged, with a time
// budget, so no statement rewrites the whole table. Rerun-safe.
export const GET = withCronRun('company-hiring-index', async () => {
  const last = await prisma.cronRun.findFirst({
    where: { job: 'company-hiring-index', status: 'OK' },
    orderBy: { startedAt: 'desc' },
    select: { startedAt: true },
  })
  // No successful run yet: the one-time full rebuild covered everything before today.
  const result = await rebuildHiringIndex({ since: last?.startedAt ?? new Date(Date.now() - 86_400_000) })
  return NextResponse.json(result)
})
