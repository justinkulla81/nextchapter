import 'server-only'
import { prisma } from '@/lib/prisma'
import { getSalaryHistogram, histogramPercentile, resolveState } from '@/lib/market/adzuna-insights'

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

export type CompBandSource = 'nc_job_board' | 'adzuna'

export interface SourcedCompBand extends CompBand {
  source: CompBandSource
  // Only for source 'adzuna': the role and place the advertised-salary
  // histogram was read for, so the UI can say exactly what it is.
  adzunaRole?: string
  adzunaPlace?: string
}

// Our own NC Job Board band first — it's real posted ranges for director+
// roles. Only when that's too thin or not specific to the member's function do we fall back to Adzuna's advertised-
// salary histogram for the member's role (and state, when known): the
// middle half (25th–75th percentile) of what employers advertise. The
// source is always returned so the UI labels it; an Adzuna band must show
// "Data by Adzuna" next to it.
export async function computeCompBandWithMarketFallback(input: {
  targetFunction: string | null
  role: string | null
  state: string | null
}): Promise<SourcedCompBand> {
  const own = await computeCompBandForTarget(input.targetFunction)
  // Our own band wins only when it's actually about the member's function —
  // the broader director+ pool is a weaker answer than real market data
  // for their role.
  if (own.sufficientData && own.matchedOnFunction && own.low !== null && own.high !== null) {
    return { ...own, source: 'nc_job_board' }
  }
  if (!input.role) return { ...own, source: 'nc_job_board' }

  const state = resolveState(input.state)
  let h = (await getSalaryHistogram({ role: input.role, state }, { onMiss: 'fetch' })).data
  let place = state ?? 'the US'
  // A thin state-level sample is less honest than the national one.
  if (state && (!h || h.total < 20)) {
    h = (await getSalaryHistogram({ role: input.role, state: null }, { onMiss: 'fetch' })).data
    place = 'the US'
  }
  if (!h || h.total < 20) return { ...own, source: 'nc_job_board' }

  const low = histogramPercentile(h, 0.25)
  const high = histogramPercentile(h, 0.75)
  if (low === null || high === null || high <= low) return { ...own, source: 'nc_job_board' }
  return {
    low,
    high,
    sampleSize: h.total,
    matchedOnFunction: true,
    sufficientData: true,
    source: 'adzuna',
    adzunaRole: input.role,
    adzunaPlace: place,
  }
}
