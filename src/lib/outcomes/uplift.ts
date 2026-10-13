import type { DurationBucket } from './duration-bucket'

// Duration-adjusted re-employment uplift: how a cohort's actual re-employment
// compares with what public data say to expect for people at the SAME
// unemployment duration. Stratifying by bucket removes the adverse-selection
// penalty. This is observational (self-selected users), so callers must show
// it with n and the caveat, never as proof of causation.

export interface CohortBucketObservation {
  bucket: DurationBucket
  personWeeks: number // total weeks at risk observed in this bucket
  reemployed: number // re-employment events in those weeks
}

export interface BucketBenchmark {
  bucket: DurationBucket
  weeklyReemploymentRate: number // expected probability of re-employment per week, 0-1
}

export interface UpliftRow {
  bucket: DurationBucket
  personWeeks: number
  observed: number
  expected: number
  uplift: number | null // observed / expected; null when expected is 0 or no exposure
}

export function weeklyRate(personWeeks: number, reemployed: number): number | null {
  if (!(personWeeks > 0) || reemployed < 0) return null
  return reemployed / personWeeks
}

export function computeUplift(obs: CohortBucketObservation[], benchmarks: BucketBenchmark[]): UpliftRow[] {
  const byBucket = new Map(benchmarks.map((b) => [b.bucket, b.weeklyReemploymentRate]))
  return obs.map((o) => {
    const rate = byBucket.get(o.bucket)
    const expected = rate !== undefined && o.personWeeks > 0 ? rate * o.personWeeks : 0
    return {
      bucket: o.bucket,
      personWeeks: o.personWeeks,
      observed: o.reemployed,
      expected,
      uplift: expected > 0 ? o.reemployed / expected : null,
    }
  })
}

// Pooled uplift across buckets = total observed / total expected, so a mix of
// short- and long-search people is not averaged unfairly.
export function pooledUplift(rows: UpliftRow[]): number | null {
  const observed = rows.reduce((s, r) => s + r.observed, 0)
  const expected = rows.reduce((s, r) => s + r.expected, 0)
  return expected > 0 ? observed / expected : null
}

// Convert a monthly job-finding probability to a weekly one (4.345 wks/month).
export function monthlyToWeeklyRate(monthlyProbability: number): number | null {
  if (!(monthlyProbability >= 0 && monthlyProbability < 1)) return null
  return 1 - Math.pow(1 - monthlyProbability, 1 / 4.345)
}

// Comparisons are shown only against benchmarks someone has verified. A LOW
// confidence benchmark (for example a dated figure read from a summary) is kept
// in the table for reference but never drives a number a college or employer
// sees. Raise the row's confidence after checking the original source.
export function usableBenchmarks<T extends { confidence: string }>(rows: T[]): T[] {
  return rows.filter((r) => r.confidence !== 'LOW')
}
