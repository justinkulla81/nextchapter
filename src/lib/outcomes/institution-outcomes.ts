import { DURATION_BUCKETS, DURATION_BUCKET_LABEL, type DurationBucket } from './duration-bucket'
import { MIN_CELL_SIZE } from './small-cell'
import { computeUplift, pooledUplift, type BucketBenchmark } from './uplift'

// Turns the consent-applying SQL rows (private.v_outcomes_by_bucket) plus the
// public benchmarks into what the school sees. Everything below the privacy
// floor is suppressed: no number is shown for a cell with fewer than
// MIN_CELL_SIZE people, and the total is suppressed too when every row is.

export interface OutcomeViewRow {
  bucket: string // a DurationBucket or 'UNKNOWN'
  members: number
  personWeeks: number
  reemployed: number
  hiresAll: number
  interimHires: number
  warmSourced: number
  withPay: number
  tookCut: number
  medianPayRetention: number | null
}

export interface BucketDisplayRow {
  bucket: DurationBucket
  label: string
  suppressed: boolean
  members: number | null
  reemployed: number | null
  expected: number | null // benchmark-expected re-employments for the same exposure
  uplift: number | null
  benchmarkPending: boolean // no sourced benchmark for this bucket yet
  warmShare: number | null // share of hires that came through a referral, conversation or alumni/mentor
  interimHires: number | null
  medianPayRetention: number | null
  tookCutShare: number | null
}

export interface InstitutionOutcomeSummary {
  rows: BucketDisplayRow[]
  totalMembers: number
  pooledUplift: number | null
  allSuppressed: boolean
}

const pct = (n: number, d: number) => (d > 0 ? n / d : null)

export function buildInstitutionOutcomes(rows: OutcomeViewRow[], benchmarks: BucketBenchmark[]): InstitutionOutcomeSummary {
  const byBucket = new Map(rows.map((r) => [r.bucket, r]))
  const benchmarked = new Set(benchmarks.map((b) => b.bucket))

  const uplifts = computeUplift(
    DURATION_BUCKETS.map((b) => {
      const r = byBucket.get(b)
      return { bucket: b, personWeeks: r?.personWeeks ?? 0, reemployed: r?.reemployed ?? 0 }
    }),
    benchmarks,
  )

  const display: BucketDisplayRow[] = DURATION_BUCKETS.map((bucket, i) => {
    const r = byBucket.get(bucket)
    const u = uplifts[i]
    const members = r?.members ?? 0
    const suppressed = members < MIN_CELL_SIZE
    if (suppressed) {
      return {
        bucket, label: DURATION_BUCKET_LABEL[bucket], suppressed: true,
        members: null, reemployed: null, expected: null, uplift: null,
        benchmarkPending: !benchmarked.has(bucket), warmShare: null, interimHires: null,
        medianPayRetention: null, tookCutShare: null,
      }
    }
    const payOk = (r?.withPay ?? 0) >= MIN_CELL_SIZE
    const hiresOk = (r?.hiresAll ?? 0) >= MIN_CELL_SIZE
    return {
      bucket, label: DURATION_BUCKET_LABEL[bucket], suppressed: false,
      members,
      reemployed: r?.reemployed ?? 0,
      expected: benchmarked.has(bucket) ? u.expected : null,
      uplift: benchmarked.has(bucket) ? u.uplift : null,
      benchmarkPending: !benchmarked.has(bucket),
      warmShare: hiresOk && r ? pct(r.warmSourced, r.hiresAll) : null,
      interimHires: hiresOk && r ? r.interimHires : null,
      medianPayRetention: payOk && r ? r.medianPayRetention : null,
      tookCutShare: payOk && r ? pct(r.tookCut, r.withPay) : null,
    }
  })

  const visible = display.filter((d) => !d.suppressed)
  // Pool only across buckets that are visible AND benchmarked, so a pooled
  // number never mixes in a bucket the school can't see or we can't compare.
  const poolRows = uplifts.filter((_, i) => !display[i].suppressed && !display[i].benchmarkPending)
  return {
    rows: display,
    totalMembers: visible.reduce((s, d) => s + (d.members ?? 0), 0),
    pooledUplift: pooledUplift(poolRows),
    allSuppressed: visible.length === 0,
  }
}
