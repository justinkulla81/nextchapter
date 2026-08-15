import 'server-only'
import { prisma } from '@/lib/prisma'
import { getMarketConditions } from '@/lib/market'

// §A2.4 "quarterly market check with comp benchmarking." Job-market volume
// and BLS trend reuse the existing shared computation (getMarketConditions,
// src/lib/market/index.ts) exactly the way market-reality-report.ts and
// dossier-competencies.ts already call it -- same input shape, same cache.
//
// No existing dollar-figure comp-benchmarking function was found anywhere in
// src/lib/market/ (confirmed by this phase's research pass), so the comp
// benchmark itself is new: the median of real salaryMin/salaryMax pairs on
// ExclusiveJobPosting rows the admin has actually approved, filtered to the
// candidate's target function/level when there's a large enough sample, and
// falling back to the full approved-posting pool otherwise so a thin niche
// never returns "no data." Compared against the candidate's own stated
// targetCompMin -- never fabricated, and never null-in-a-database-column-
// nobody-reads: written to a new MembershipMarketCheck row every run.
const MIN_FUNCTION_MATCH_SAMPLE = 3

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

async function computeCompBenchmark(primaryFunction: string | null): Promise<{ mid: number | null; sampleSize: number }> {
  const approvedWithSalary = await prisma.exclusiveJobPosting.findMany({
    where: { status: 'approved', archivedAt: null, salaryMin: { not: null }, salaryMax: { not: null } },
    select: { salaryMin: true, salaryMax: true, title: true },
    take: 500,
  })

  const midpoints = (rows: typeof approvedWithSalary) =>
    rows.map((r) => Math.round(((r.salaryMin ?? 0) + (r.salaryMax ?? 0)) / 2)).filter((n) => n > 0)

  if (primaryFunction) {
    const functionMatches = approvedWithSalary.filter((r) => r.title.toLowerCase().includes(primaryFunction.toLowerCase()))
    if (functionMatches.length >= MIN_FUNCTION_MATCH_SAMPLE) {
      return { mid: median(midpoints(functionMatches)), sampleSize: functionMatches.length }
    }
  }

  return { mid: median(midpoints(approvedWithSalary)), sampleSize: approvedWithSalary.length }
}

export async function runQuarterlyMarketCheck(candidateId: string): Promise<void> {
  const candidate = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: {
      targetRoleType: true,
      primaryFunction: true,
      currentCity: true,
      currentState: true,
      targetCompMin: true,
    },
  })

  const [marketConditions, compBenchmark] = await Promise.all([
    getMarketConditions({
      roleType: candidate.targetRoleType,
      primaryFunction: candidate.primaryFunction,
      city: candidate.currentCity,
      state: candidate.currentState,
    }),
    computeCompBenchmark(candidate.primaryFunction),
  ])

  await prisma.membershipMarketCheck.create({
    data: {
      candidateId,
      adzunaCount: marketConditions.adzunaCount,
      blsYoyChangePct: marketConditions.blsYoyChangePct,
      targetCompMin: candidate.targetCompMin,
      compBenchmarkMid: compBenchmark.mid,
      compSampleSize: compBenchmark.sampleSize,
    },
  })

  await prisma.membershipSubscription.update({
    where: { candidateId },
    data: { lastMarketCheckAt: new Date() },
  })
}
