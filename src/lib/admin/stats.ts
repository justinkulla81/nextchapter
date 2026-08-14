// Statistical primitives for the observation rules in
// src/lib/admin/observations.ts — Phase 2 Master Script, Part B, Prompt 7.
// No precedent anywhere in the repo before this (confirmed: zero
// stdDev/zScore/sigma hits). Kept deliberately small — exactly what the
// spec's threshold rules need (population standard deviation, a z-score,
// and a "does this segment deviate significantly" composition), not a
// general-purpose stats library.

// Population mean (not sample mean — there's no sampling here, these are
// always the full set of segments/values being compared).
export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

// Population standard deviation (divides by N, not N-1) — every caller here
// is describing the full spread of an actual set of segments, not
// estimating a wider population from a sample, so the sample-variance
// correction doesn't apply.
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const m = mean(values)
  const variance = mean(values.map((v) => (v - m) ** 2))
  return Math.sqrt(variance)
}

// How many standard deviations `value` sits from `mean`. Returns 0 when
// `stdDev` is 0 (every value identical, or a single-element set) rather
// than dividing by zero — "no variation" can't mean "infinitely deviant."
export function zScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0
  return (value - mean) / stdDev
}

// Part B Prompt 7 / 8's threshold: "any segment deviating more than 1.5σ
// from the overall rate."
export const SIGNIFICANT_DEVIATION_THRESHOLD = 1.5

export interface SegmentDeviation<T> {
  segment: T
  rate: number
  zScore: number
  deviates: boolean
}

// Composes the above for the one thing every "segment deviates from the
// population" check in Prompt 4 (prevalence by segment) and Prompt 7
// (observations) needs: given a list of segments, a way to read each
// segment's rate, and the already-known overall/population rate, flag every
// segment whose z-score (against the *spread of the segment rates
// themselves*, not the overall rate's own variance — there's only one
// overall rate, it has no spread) exceeds the threshold.
//
// `overallRate` is passed in rather than computed from `segments`, because
// the true population rate (all candidates, not just ones sliced into this
// particular segment breakdown) is usually a different denominator than
// "the average of these segment rates" — e.g. a large segment should not be
// diluted by the presence of many small ones.
export function findSegmentDeviations<T>(
  segments: T[],
  getRate: (segment: T) => number,
  overallRate: number,
  threshold: number = SIGNIFICANT_DEVIATION_THRESHOLD
): SegmentDeviation<T>[] {
  const rates = segments.map(getRate)
  const sd = standardDeviation(rates)

  return segments.map((segment) => {
    const rate = getRate(segment)
    const z = zScore(rate, overallRate, sd)
    return { segment, rate, zScore: z, deviates: Math.abs(z) > threshold }
  })
}
