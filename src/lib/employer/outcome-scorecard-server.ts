import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import type { CurrentOutplacementOrgUser } from '@/lib/employer/outplacement-auth'
import type { DurationBucket } from '@/lib/outcomes/duration-bucket'
import { usableBenchmarks } from '@/lib/outcomes/uplift'
import { buildEmployerScorecard, scorecardAsOf, type EmployerOutcomeRow, type EmployerScorecard } from './outcome-scorecard'

// Off unless explicitly enabled. Turn it on only after the privacy review in
// docs/EMPLOYER_SCORECARD_PRIVACY_REVIEW.md is signed off.
export function employerScorecardEnabled(): boolean {
  return process.env.EMPLOYER_OUTCOMES_SCORECARD_ENABLED === 'true'
}

// Aggregate-only. The only database access is the SQL function, which returns
// at most five rows of counts; there is no row-level read of any candidate and
// no joins here. The contract is checked against the caller's own org first.
export async function getEmployerOutcomeScorecard(orgUser: CurrentOutplacementOrgUser, contractId: string): Promise<EmployerScorecard | null> {
  if (!employerScorecardEnabled()) return null
  const contract = await prisma.outplacementContract.findFirst({
    where: { id: contractId, orgId: orgUser.orgId },
    select: { id: true, seatCount: true },
  })
  if (!contract) return null

  const { asOf } = scorecardAsOf(contract.seatCount)
  const [rows, benchmarkRows] = await Promise.all([
    prisma.$queryRaw<{ bucket: string; enrolled: number; person_weeks: number; reemployed: number }[]>`
      select bucket, enrolled, person_weeks, reemployed
      from private.employer_outcomes_by_bucket(${contract.id}, ${asOf}::timestamptz)`,
    prisma.durationBenchmark.findMany({ where: { group: 'all' }, select: { bucket: true, weeklyReemploymentRate: true, confidence: true } }),
  ])

  const scorecard = buildEmployerScorecard(
    rows.map<EmployerOutcomeRow>((r) => ({ bucket: r.bucket as DurationBucket, enrolled: r.enrolled, personWeeks: r.person_weeks, reemployed: r.reemployed })),
    usableBenchmarks(benchmarkRows).map((b) => ({ bucket: b.bucket as DurationBucket, weeklyReemploymentRate: b.weeklyReemploymentRate })),
    { seatCount: contract.seatCount },
  )
  // Log that the page was viewed, never the numbers.
  captureServerEvent(orgUser.userId ?? orgUser.orgId, 'employer_outcomes_scorecard_viewed', { contractId: contract.id, suppressed: scorecard.suppressed })
  return scorecard
}
