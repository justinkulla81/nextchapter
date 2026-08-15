import 'server-only'
import { prisma } from '@/lib/prisma'

// Partners Master Build Script §A3.2/§A3.3 — "comp bands by role, level, and
// metro" is listed as an already-built proprietary input. It is not: no
// aggregated-posting comp-band computation exists anywhere in this codebase
// (confirmed by this phase's investigation). The one real, adjacent
// computation is src/lib/membership/market-check.ts's computeCompBenchmark,
// which the earlier Membership phase built from real ExclusiveJobPosting
// salaryMin/salaryMax data — a single median midpoint, not a band, and not
// candidate-facing (it's a Membership quarterly-check ingredient). This
// file extends that exact same real query and MIN_FUNCTION_MATCH_SAMPLE
// discipline into a genuine low/high band (median of salaryMin, median of
// salaryMax across the matched postings), always returned with its real
// sample size so the UI can render "insufficient data" honestly instead of
// showing a number. Never falls back to level or metro (this app has no
// per-posting level/metro field reliable enough to slice on) — scoped to
// function only, same honest scope as market-check.ts.
const MIN_FUNCTION_MATCH_SAMPLE = 3
// Below this, even the full unscoped pool isn't worth showing as "your
// target" — distinct from market-check.ts's quarterly benchmark, which
// always shows the full-pool fallback because it's a single number that
// reads reasonably even off a handful of postings. A band framed as "your
// target" is a stronger claim, so it gets a stricter floor.
const MIN_SAMPLE_FOR_HONEST_BAND = 5

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

export interface CompBand {
  low: number | null
  high: number | null
  sampleSize: number
  matchedOnFunction: boolean
  // false when sampleSize is real but too thin to responsibly show a
  // number — the UI must render "insufficient data," never a band, when
  // this is false.
  sufficientData: boolean
}

export async function computeCompBandForTarget(targetFunction: string | null): Promise<CompBand> {
  const approvedWithSalary = await prisma.exclusiveJobPosting.findMany({
    where: { status: 'approved', archivedAt: null, salaryMin: { not: null }, salaryMax: { not: null } },
    select: { salaryMin: true, salaryMax: true, title: true },
    take: 500,
  })

  const bandFrom = (rows: typeof approvedWithSalary): { low: number | null; high: number | null } => ({
    low: median(rows.map((r) => r.salaryMin ?? 0).filter((n) => n > 0)),
    high: median(rows.map((r) => r.salaryMax ?? 0).filter((n) => n > 0)),
  })

  if (targetFunction) {
    const functionMatches = approvedWithSalary.filter((r) => r.title.toLowerCase().includes(targetFunction.toLowerCase()))
    if (functionMatches.length >= MIN_FUNCTION_MATCH_SAMPLE) {
      const { low, high } = bandFrom(functionMatches)
      return {
        low,
        high,
        sampleSize: functionMatches.length,
        matchedOnFunction: true,
        sufficientData: functionMatches.length >= MIN_SAMPLE_FOR_HONEST_BAND,
      }
    }
  }

  const { low, high } = bandFrom(approvedWithSalary)
  return {
    low,
    high,
    sampleSize: approvedWithSalary.length,
    matchedOnFunction: false,
    sufficientData: approvedWithSalary.length >= MIN_SAMPLE_FOR_HONEST_BAND,
  }
}
