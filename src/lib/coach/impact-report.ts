import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Grade } from '@/lib/scoring/grade'

const GRADE_ORDER: Grade[] = ['F', 'D', 'C', 'B', 'A']
const QUARTER_MS = 90 * 24 * 60 * 60 * 1000

export interface CoachImpactReport {
  clientCount: number
  improved: number
  same: number
  declined: number
  noData: number
}

// Self-facing only — a coach's own track record across their full
// caseload, the retention mechanic from the brainstorm: a reason to open
// the portal even between sessions. Never shown to anyone else. Reads
// MarketRealitySnapshot (weekly, guaranteed-cadence) rather than
// MarketRealityReport — a report is only generated on specific triggers,
// so "first vs. last report this quarter" could land on as few as one row
// even for an active candidate; the weekly snapshot doesn't have that gap.
export async function getCoachImpactReport(coachId: string): Promise<CoachImpactReport> {
  const quarterStart = new Date(Date.now() - QUARTER_MS)

  const clients = await prisma.candidateProfile.findMany({
    where: { coachId },
    select: {
      id: true,
      marketRealitySnapshots: {
        where: { weekStartDate: { gte: quarterStart } },
        orderBy: { weekStartDate: 'asc' },
        select: { weekStartDate: true, grade: true },
      },
    },
  })

  let improved = 0
  let same = 0
  let declined = 0
  let noData = 0

  for (const client of clients) {
    if (client.marketRealitySnapshots.length < 2) {
      noData++
      continue
    }
    const first = client.marketRealitySnapshots[0].grade as Grade
    const last = client.marketRealitySnapshots[client.marketRealitySnapshots.length - 1].grade as Grade
    const diff = GRADE_ORDER.indexOf(last) - GRADE_ORDER.indexOf(first)
    if (diff > 0) improved++
    else if (diff < 0) declined++
    else same++
  }

  return { clientCount: clients.length, improved, same, declined, noData }
}
