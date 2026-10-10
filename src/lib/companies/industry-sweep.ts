import 'server-only'
import { prisma } from '@/lib/prisma'
import { resolveCompanyIndustry } from '@/lib/market/company-industry'

// Fills in the industry of companies that have none, a bounded amount per run.
//
// One cached AI call per company (see resolveCompanyIndustry), about $0.002 each:
//  - each company is asked at most ONCE ever — industryCheckedAt is set whether or
//    not the model could place it, so an unrecognisable name (a plant or branch
//    from a layoff filing) is not re-asked every night;
//  - at most `limit` per run, and no new call is started after `deadlineMs`, so
//    a bulk import drains over several nights instead of spiking the bill or
//    running the job out of time;
//  - busiest employers first, so the companies members actually look at get an
//    industry before the long tail.
// A failed call (network, rate limit) leaves industryCheckedAt unset, so the
// company is simply retried on a later run.

export interface IndustrySweepResult {
  attempted: number
  filled: number
  unrecognised: number
  errors: number
  stoppedEarly: boolean
}

export async function sweepCompanyIndustries(opts: {
  limit: number
  deadlineMs: number
  concurrency?: number
}): Promise<IndustrySweepResult> {
  const { limit, deadlineMs, concurrency = 6 } = opts
  const startedAt = Date.now()
  const todo = await prisma.company.findMany({
    where: { industry: null, industryCheckedAt: null },
    orderBy: [{ postings: { _count: 'desc' } }, { name: 'asc' }],
    select: { id: true, name: true },
    take: limit,
  })

  const result: IndustrySweepResult = { attempted: 0, filled: 0, unrecognised: 0, errors: 0, stoppedEarly: false }
  const queue = [...todo]
  async function worker() {
    for (let c = queue.shift(); c; c = queue.shift()) {
      if (Date.now() - startedAt > deadlineMs) {
        result.stoppedEarly = true
        return
      }
      result.attempted += 1
      try {
        const { bucket } = await resolveCompanyIndustry(c.name)
        await prisma.company.update({
          where: { id: c.id },
          data: bucket ? { industry: bucket, industryCheckedAt: new Date() } : { industryCheckedAt: new Date() },
        })
        if (bucket) result.filled += 1
        else result.unrecognised += 1
      } catch (error) {
        result.errors += 1
        console.error('industry sweep failed for', c.name, error)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return result
}
