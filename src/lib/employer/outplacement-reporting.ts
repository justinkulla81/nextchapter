import 'server-only'
import { prisma } from '@/lib/prisma'
import {
  employerCandidateAggregates,
  EMPLOYER_MIN_CELL_SIZE,
  suppressSmallCell,
  roundEmployerAggregate,
  getReportingGranularity,
  lastCompleteQuarterRange,
  type ReportingGranularity,
} from '@/lib/employer/candidate-identity-guard'
import type { CurrentOutplacementOrgUser } from '@/lib/employer/outplacement-auth'

// Aggregate-only reporting for the employer dashboard — every function here
// is what employer_admin AND employer_viewer are both allowed to see (see
// spec §A7's role table: viewer gets "reporting only," admin gets "all
// reporting" among other things — this file is the "reporting" both of
// them share). Nothing in this file selects a candidate name, email,
// userId, or any other row-identifying field — see each function's own
// comment for exactly how that's enforced for its particular query shape.
//
// Three §A1.3/§A7 differencing mitigations apply throughout, all sourced
// from candidate-identity-guard.ts:
//   1. Minimum cell size 10 — suppressSmallCell (a metric backed by fewer
//      than 10 people renders as null, not a small precise number).
//   2. Round to nearest 5 below 50 seats — roundEmployerAggregate.
//   3. Cohorts under 20 seats report quarterly, not monthly —
//      getReportingGranularity + lastCompleteQuarterRange snap a small
//      cohort's numbers to the last COMPLETE quarter boundary, so the
//      figure itself doesn't change between quarters (the mechanism, not
//      just a label reading "quarterly").

export interface CohortScope {
  contractId: string
  cohortLabel: string | null
  tier: string
  seatCount: number
  granularity: ReportingGranularity
  asOf: Date // the point in time this snapshot reflects — "now" for monthly cohorts, the last complete quarter's end for quarterly ones
}

async function resolveScope(orgUser: CurrentOutplacementOrgUser, contractId: string): Promise<CohortScope | null> {
  const contract = await prisma.outplacementContract.findFirst({
    where: { id: contractId, orgId: orgUser.orgId },
    select: { id: true, cohortLabel: true, tier: true, seatCount: true },
  })
  if (!contract) return null

  const granularity = getReportingGranularity(contract.seatCount)
  const asOf = granularity === 'quarterly' ? lastCompleteQuarterRange().end : new Date()

  return { contractId: contract.id, cohortLabel: contract.cohortLabel, tier: contract.tier, seatCount: contract.seatCount, granularity, asOf }
}

export interface SeatUtilization {
  scope: CohortScope
  totalSeats: number | null
  activatedSeats: number | null
  activationRatePct: number | null
  suppressed: boolean
}

// Live (or quarter-snapped, for small cohorts) seat counts — reads
// OutplacementSeat's own status/activatedAt columns only via count(), never
// a row. count() over OutplacementSeat doesn't touch CandidateProfile at
// all, so there's no identity surface here regardless of cell size — the
// suppression below exists because the COUNT ITSELF (independent of any
// name attached to it) is the differencing risk the spec describes ("9 of
// 11 activated" this month, "10 of 11" next).
export async function getSeatUtilization(orgUser: CurrentOutplacementOrgUser, contractId: string): Promise<SeatUtilization | null> {
  const scope = await resolveScope(orgUser, contractId)
  if (!scope) return null

  const [totalSeats, activatedSeats] = await Promise.all([
    prisma.outplacementSeat.count({
      where: { contractId, status: { not: 'DEACTIVATED' }, enrolledAt: { lte: scope.asOf } },
    }),
    prisma.outplacementSeat.count({
      where: { contractId, status: 'ACTIVATED', activatedAt: { lte: scope.asOf } },
    }),
  ])

  const suppressed = totalSeats < EMPLOYER_MIN_CELL_SIZE
  const rate = totalSeats > 0 ? Math.round((activatedSeats / totalSeats) * 100) : 0

  return {
    scope,
    totalSeats: suppressSmallCell(roundEmployerAggregate(totalSeats, totalSeats), totalSeats),
    activatedSeats: suppressSmallCell(roundEmployerAggregate(activatedSeats, totalSeats), totalSeats),
    activationRatePct: suppressSmallCell(roundEmployerAggregate(rate, totalSeats), totalSeats),
    suppressed,
  }
}

export interface EngagementAggregates {
  scope: CohortScope
  population: number
  avgCurrentStreakDays: number | null
  checkedInLast7DaysPct: number | null
}

// candidateIds is computed server-side from this org's own OutplacementSeat
// rows and used ONLY as a WHERE-IN filter passed to
// employerCandidateAggregates — the Phase 1 primitive that only exposes
// count/aggregate/groupBy against CandidateProfile (never findMany). The
// list itself never leaves this function.
async function orgCandidateIds(contractId: string, asOf: Date): Promise<string[]> {
  const seats = await prisma.outplacementSeat.findMany({
    where: { contractId, status: 'ACTIVATED', activatedAt: { lte: asOf }, candidateId: { not: null } },
    select: { candidateId: true },
  })
  return seats.map((s) => s.candidateId).filter((id): id is string => !!id)
}

export async function getEngagementAggregates(
  orgUser: CurrentOutplacementOrgUser,
  contractId: string
): Promise<EngagementAggregates | null> {
  const scope = await resolveScope(orgUser, contractId)
  if (!scope) return null

  const candidateIds = await orgCandidateIds(contractId, scope.asOf)
  const population = candidateIds.length

  if (population === 0) {
    return { scope, population: 0, avgCurrentStreakDays: null, checkedInLast7DaysPct: null }
  }

  const streakAgg = await employerCandidateAggregates.aggregate({
    where: { id: { in: candidateIds } },
    _avg: { currentStreak: true },
  })

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  // dailyCheckIn.groupBy — the group key is `candidateId` here, which
  // WOULD be identity-resolvable if returned to the UI, so this function
  // only ever consumes the row COUNT (checkedInCandidateIds.length) below,
  // never the group key values themselves.
  const checkIns = await prisma.dailyCheckIn.groupBy({
    by: ['candidateId'],
    where: { candidateId: { in: candidateIds }, checkedInAt: { gte: sevenDaysAgo, lte: scope.asOf } },
  })
  const checkedInCount = checkIns.length

  return {
    scope,
    population,
    avgCurrentStreakDays: suppressSmallCell(
      roundEmployerAggregate(Math.round((streakAgg._avg?.currentStreak ?? 0) * 10) / 10, population),
      population
    ),
    checkedInLast7DaysPct: suppressSmallCell(
      roundEmployerAggregate(Math.round((checkedInCount / population) * 100), population),
      population
    ),
  }
}

export interface PlacementBenchmarkRow {
  function: string
  level: string
  n: number
  avgDaysToPlacement: number | null
}

export interface PlacementBenchmarks {
  hasEnoughData: boolean
  rows: PlacementBenchmarkRow[]
}

// Time-to-placement by function/level (§A7). This needs a cross-table
// average of (placedAt - enrolledAt) grouped by two CandidateProfile
// columns — not expressible through employerCandidateAggregates (which
// only wraps single-table CandidateProfile count/aggregate/groupBy), so
// this computes the average INSIDE a single SQL aggregate query instead of
// pulling per-seat rows into application code: the database returns only
// (function, level, n, avg_days) — never a candidateId, name, or email.
// Cell size 10 is still applied in JS below before any row reaches the
// caller, same as every other function in this file.
export async function getTimeToPlacementBenchmarks(orgUser: CurrentOutplacementOrgUser): Promise<PlacementBenchmarks> {
  const rows = await prisma.$queryRaw<
    { function: string | null; level: string | null; n: bigint; avg_days: number | null }[]
  >`
    SELECT
      COALESCE(cp."primaryFunction", 'Unspecified') AS function,
      COALESCE(cp."levelRankLabel", 'Unspecified') AS level,
      COUNT(*)::bigint AS n,
      AVG(EXTRACT(EPOCH FROM (os."placedAt" - os."enrolledAt")) / 86400.0) AS avg_days
    FROM "OutplacementSeat" os
    JOIN "OutplacementContract" oc ON oc.id = os."contractId"
    JOIN "CandidateProfile" cp ON cp.id = os."candidateId"
    WHERE oc."orgId" = ${orgUser.orgId}
      AND os."placedAt" IS NOT NULL
    GROUP BY cp."primaryFunction", cp."levelRankLabel"
  `

  const suppressedRows: PlacementBenchmarkRow[] = rows.map((r) => {
    const n = Number(r.n)
    const clearsCellSize = n >= EMPLOYER_MIN_CELL_SIZE
    return {
      function: r.function ?? 'Unspecified',
      level: r.level ?? 'Unspecified',
      n: clearsCellSize ? roundEmployerAggregate(n, n) : 0,
      avgDaysToPlacement: clearsCellSize && r.avg_days != null ? Math.round(roundEmployerAggregate(r.avg_days, n)) : null,
    }
  })

  // Only surface buckets that actually cleared the cell-size floor — a row
  // with n below 10 has nothing meaningful left to show once its own
  // number is suppressed, so it's dropped rather than rendered as a row of
  // dashes (spec: "let it show an honest 'insufficient data' state rather
  // than fabricating benchmark numbers").
  const visibleRows = suppressedRows.filter((r) => r.avgDaysToPlacement !== null)

  return { hasEnoughData: visibleRows.length > 0, rows: visibleRows }
}

export interface AlumniSentiment {
  population: number
  hasEnoughData: boolean
  distribution: { mood: string; count: number | null }[]
}

// Aggregate mood distribution over the org's own candidates' daily
// check-ins (the real sentiment-collection mechanism already in the
// product — see DailyCheckIn/Mood in prisma/schema.prisma) — a thin but
// real signal, not fabricated. groupBy's key here is `mood` (a 4-value
// enum, not identity-resolvable), never candidateId.
export async function getAlumniSentiment(orgUser: CurrentOutplacementOrgUser): Promise<AlumniSentiment> {
  const seats = await prisma.outplacementSeat.findMany({
    where: { contract: { orgId: orgUser.orgId }, status: 'ACTIVATED', candidateId: { not: null } },
    select: { candidateId: true },
  })
  const candidateIds = seats.map((s) => s.candidateId).filter((id): id is string => !!id)
  const population = candidateIds.length

  if (population < EMPLOYER_MIN_CELL_SIZE) {
    return { population, hasEnoughData: false, distribution: [] }
  }

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const grouped = await prisma.dailyCheckIn.groupBy({
    by: ['mood'],
    where: { candidateId: { in: candidateIds }, checkedInAt: { gte: ninetyDaysAgo } },
    _count: { _all: true },
  })

  return {
    population,
    hasEnoughData: true,
    distribution: grouped.map((g) => ({
      mood: g.mood,
      count: suppressSmallCell(roundEmployerAggregate(g._count._all, population), g._count._all),
    })),
  }
}

export interface BoomerangSignal {
  population: number
  hasEnoughData: boolean
  boomerangCount: number | null
}

// "Boomerang signal" (§A7) — someone marked placed who later re-engaged
// with the product (a mood check-in more than 14 days after their
// placedAt), which reads as "came back to job search again." Computed as
// a single SQL aggregate for the same reason as the placement-benchmark
// query above — the database returns one count, never which seats.
export async function getBoomerangSignal(orgUser: CurrentOutplacementOrgUser): Promise<BoomerangSignal> {
  const placedCountResult = await prisma.outplacementSeat.count({
    where: { contract: { orgId: orgUser.orgId }, placedAt: { not: null } },
  })

  if (placedCountResult < EMPLOYER_MIN_CELL_SIZE) {
    return { population: placedCountResult, hasEnoughData: false, boomerangCount: null }
  }

  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(DISTINCT os.id)::bigint AS n
    FROM "OutplacementSeat" os
    JOIN "OutplacementContract" oc ON oc.id = os."contractId"
    WHERE oc."orgId" = ${orgUser.orgId}
      AND os."placedAt" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "DailyCheckIn" dc
        WHERE dc."candidateId" = os."candidateId"
          AND dc."checkedInAt" > os."placedAt" + INTERVAL '14 days'
      )
  `
  const n = Number(rows[0]?.n ?? 0)

  return {
    population: placedCountResult,
    hasEnoughData: true,
    boomerangCount: suppressSmallCell(roundEmployerAggregate(n, placedCountResult), placedCountResult),
  }
}
