import { DURATION_BUCKETS, DURATION_BUCKET_LABEL, type DurationBucket } from '@/lib/outcomes/duration-bucket'
import { computeUplift, type BucketBenchmark } from '@/lib/outcomes/uplift'
import { EMPLOYER_MIN_CELL_SIZE, lastCompleteQuarterRange, type ReportingGranularity } from './candidate-identity-guard'

// Stricter than the spec's minimum: outcome counts ALWAYS round to the nearest
// 5, at any cohort size. The spec only requires it below 50 seats, but a
// month-to-month change of one in an exact count could reveal that one person
// opted in, opted out, or entered Confidential Search Mode.
function roundToFive(n: number): number {
  return Math.round(n / 5) * 5
}

// Employer scorecard: duration-adjusted re-employment, cohort level only.
// Pure logic; the SQL function private.employer_outcomes_by_bucket supplies
// aggregate counts and nothing else. See docs/EMPLOYER_SCORECARD_PRIVACY_REVIEW.md.
//
// Differencing defenses implemented here (spec A1.3), on top of the SQL's
// exclusions (opt-in only, no Confidential Search Mode, org users removed):
//   1. Total below the minimum cell size: nothing is shown at all.
//   2. Buckets are MERGED until every shown group has at least the minimum
//      number of enrolled people, so a hidden cell can never be recovered by
//      subtracting visible cells from a shown total.
//   3. Counts ALWAYS round to the nearest 5 (stricter than the spec's under-50 rule).
//   4. The comparison is a coarse band, never a ratio, and is withheld when
//      too few events are expected for one person to move it.
//   5. EVERY cohort is snapped to the last complete quarter (stricter than the
//      spec's under-20 rule), so the figure only changes once a quarter.
//   6. No cross-tabs (never by function, level, pay or hire source).

export interface EmployerOutcomeRow {
  bucket: DurationBucket
  enrolled: number
  personWeeks: number
  reemployed: number
}

export type ComparisonBand = 'BELOW' | 'ABOUT' | 'ABOVE' | 'WELL_ABOVE'

export const BAND_LABEL: Record<ComparisonBand, string> = {
  BELOW: 'Below what is typical at this stage',
  ABOUT: 'About what is typical at this stage',
  ABOVE: 'Above what is typical at this stage',
  WELL_ABOVE: 'Well above what is typical at this stage',
}

// Below this many expected re-employments, one person could flip the band.
export const MIN_EXPECTED_EVENTS = 5

export function bandForRatio(ratio: number): ComparisonBand {
  if (ratio < 0.75) return 'BELOW'
  if (ratio < 4 / 3) return 'ABOUT'
  if (ratio < 2) return 'ABOVE'
  return 'WELL_ABOVE'
}

export interface ScorecardGroup {
  label: string
  enrolled: number // rounded per the cohort rule
  reemployed: number // rounded per the cohort rule
  band: ComparisonBand | null
  bandWithheld: 'NO_BENCHMARK' | 'TOO_FEW_EVENTS' | null
}

export interface EmployerScorecard {
  suppressed: boolean
  reason: 'TOO_FEW_PEOPLE' | 'NO_DATA' | null
  groups: ScorecardGroup[]
  totalEnrolled: number | null
  overallBand: ComparisonBand | null
  granularity: ReportingGranularity
  asOf: Date
}

export function scorecardAsOf(_seatCount: number, now: Date = new Date()): { granularity: ReportingGranularity; asOf: Date } {
  return { granularity: 'quarterly', asOf: lastCompleteQuarterRange(now).end }
}

// Merge adjacent buckets (in duration order) until every group has at least
// `floor` enrolled people. A short tail is folded into the previous group.
export function mergeBucketsToFloor(rows: EmployerOutcomeRow[], floor: number = EMPLOYER_MIN_CELL_SIZE): EmployerOutcomeRow[][] {
  const byBucket = new Map(rows.map((r) => [r.bucket, r]))
  const ordered = DURATION_BUCKETS.map((b) => byBucket.get(b) ?? { bucket: b, enrolled: 0, personWeeks: 0, reemployed: 0 })
  const groups: EmployerOutcomeRow[][] = []
  let current: EmployerOutcomeRow[] = []
  let count = 0
  for (const r of ordered) {
    current.push(r)
    count += r.enrolled
    if (count >= floor) {
      groups.push(current)
      current = []
      count = 0
    }
  }
  if (current.length > 0) {
    if (groups.length > 0) groups[groups.length - 1].push(...current)
    else groups.push(current) // total below the floor: caller suppresses
  }
  return groups
}

function groupLabel(g: EmployerOutcomeRow[]): string {
  const first = g[0].bucket
  const last = g[g.length - 1].bucket
  if (first === last) return DURATION_BUCKET_LABEL[first]
  const lo = DURATION_BUCKET_LABEL[first].split('-')[0].replace(' weeks', '')
  const hiLabel = DURATION_BUCKET_LABEL[last]
  if (last === 'W53_PLUS') return `${lo}+ weeks`
  return `${lo}-${hiLabel.split('-')[1]}`
}

export function buildEmployerScorecard(
  rows: EmployerOutcomeRow[],
  benchmarks: BucketBenchmark[],
  opts: { seatCount: number; now?: Date },
): EmployerScorecard {
  const { granularity, asOf } = scorecardAsOf(opts.seatCount, opts.now)
  const totalEnrolled = rows.reduce((s, r) => s + r.enrolled, 0)
  const empty = (reason: EmployerScorecard['reason']): EmployerScorecard => ({
    suppressed: true, reason, groups: [], totalEnrolled: null, overallBand: null, granularity, asOf,
  })
  if (rows.length === 0 || totalEnrolled === 0) return empty('NO_DATA')
  if (totalEnrolled < EMPLOYER_MIN_CELL_SIZE) return empty('TOO_FEW_PEOPLE')

  const benchmarked = new Set(benchmarks.map((b) => b.bucket))
  const groups = mergeBucketsToFloor(rows)

  const display: ScorecardGroup[] = groups.map((g) => {
    const enrolled = g.reduce((s, r) => s + r.enrolled, 0)
    const reemployed = g.reduce((s, r) => s + r.reemployed, 0)
    const allBenchmarked = g.every((r) => r.personWeeks === 0 || benchmarked.has(r.bucket))
    const up = computeUplift(g.map((r) => ({ bucket: r.bucket, personWeeks: r.personWeeks, reemployed: r.reemployed })), benchmarks)
    const expected = up.reduce((s, r) => s + r.expected, 0)
    let band: ComparisonBand | null = null
    let withheld: ScorecardGroup['bandWithheld'] = null
    if (!allBenchmarked) withheld = 'NO_BENCHMARK'
    else if (expected < MIN_EXPECTED_EVENTS) withheld = 'TOO_FEW_EVENTS'
    else band = bandForRatio(reemployed / expected)
    return {
      label: groupLabel(g),
      enrolled: roundToFive(enrolled),
      reemployed: roundToFive(reemployed),
      band,
      bandWithheld: withheld,
    }
  })

  // Overall band only when every group could be compared and enough is expected.
  const allUp = computeUplift(rows.map((r) => ({ bucket: r.bucket, personWeeks: r.personWeeks, reemployed: r.reemployed })), benchmarks)
  const allBenchmarked = rows.every((r) => r.personWeeks === 0 || benchmarked.has(r.bucket))
  const expectedAll = allUp.reduce((s, r) => s + r.expected, 0)
  const observedAll = rows.reduce((s, r) => s + r.reemployed, 0)
  const overallBand = allBenchmarked && expectedAll >= MIN_EXPECTED_EVENTS ? bandForRatio(observedAll / expectedAll) : null

  return {
    suppressed: false,
    reason: null,
    groups: display,
    totalEnrolled: roundToFive(totalEnrolled),
    overallBand,
    granularity,
    asOf,
  }
}
