import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { prisma } from '@/lib/prisma'
import { rebuildHiringIndex, sweepAfterFrom } from '@/lib/companies/hiring-index'

export const maxDuration = 300

// Nightly company hiring index (src/lib/companies/hiring-index.ts), incremental:
// links and copies new postings, closes archived openings, and reprices and
// reprofiles only what changed since the last successful run plus a seventh of
// everything (all of it weekly; benchmarks rebuilt Sundays). Paged, with a time
// budget, so no statement rewrites the whole table. Rerun-safe.
//
// The sweep of open openings resumes where the last run stopped: every ledger note and the result carry `sweepAfter`, so a run that fails
// a later phase or is cut off still hands its position on.
export const GET = withCronRun(
  'company-hiring-index',
  async (_request, ctx) => {
    const [last, prev] = await Promise.all([
      prisma.cronRun.findFirst({ where: { job: 'company-hiring-index', status: 'OK' }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } }),
      prisma.cronRun.findFirst({ where: { job: 'company-hiring-index', status: { not: 'RUNNING' } }, orderBy: { startedAt: 'desc' }, select: { detail: true } }),
    ])
    let sweepAfter = sweepAfterFrom(prev?.detail)
    // No successful run yet: the one-time full rebuild covered everything before today.
    const result = await rebuildHiringIndex({
      since: last?.startedAt ?? new Date(Date.now() - 86_400_000),
      sweepAfter,
      onSweep: (after) => {
        sweepAfter = after
      },
      onStep: (step, ms) => ctx.progress({ sweepAfter, step, ms }),
    })
    return NextResponse.json(result)
  },
  { recordResult: true }
)
