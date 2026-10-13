import { describe, expect, it } from 'vitest'
import {
  bandForRatio,
  buildEmployerScorecard,
  mergeBucketsToFloor,
  MIN_EXPECTED_EVENTS,
  scorecardAsOf,
  type EmployerOutcomeRow,
} from '@/lib/employer/outcome-scorecard'
import type { BucketBenchmark } from '@/lib/outcomes/uplift'

const row = (bucket: EmployerOutcomeRow['bucket'], enrolled: number, personWeeks: number, reemployed: number): EmployerOutcomeRow => ({ bucket, enrolled, personWeeks, reemployed })
const ALL_BENCH: BucketBenchmark[] = ['W0_4', 'W5_13', 'W14_26', 'W27_52', 'W53_PLUS'].map((b) => ({ bucket: b as BucketBenchmark['bucket'], weeklyReemploymentRate: 0.05 }))

describe('employer scorecard: suppression', () => {
  it('shows nothing when the whole cohort is under the minimum cell size', () => {
    const s = buildEmployerScorecard([row('W5_13', 9, 100, 3)], ALL_BENCH, { seatCount: 100 })
    expect(s.suppressed).toBe(true)
    expect(s.reason).toBe('TOO_FEW_PEOPLE')
    expect(s.groups).toEqual([])
    expect(s.totalEnrolled).toBeNull()
  })
  it('reports no data distinctly', () => {
    expect(buildEmployerScorecard([], ALL_BENCH, { seatCount: 100 }).reason).toBe('NO_DATA')
  })
})

describe('employer scorecard: merging prevents subtraction', () => {
  it('merges small buckets so every shown group has at least 10 people', () => {
    const groups = mergeBucketsToFloor([row('W0_4', 3, 10, 0), row('W5_13', 4, 30, 1), row('W14_26', 12, 90, 3), row('W27_52', 2, 20, 0), row('W53_PLUS', 1, 10, 0)])
    for (const g of groups) expect(g.reduce((s, r) => s + r.enrolled, 0)).toBeGreaterThanOrEqual(10)
    // 3+4+12 = 19 (first three merged), then the tail 2+1 is folded back in
    expect(groups).toHaveLength(1)
  })
  it('keeps separate groups when each clears the floor', () => {
    const groups = mergeBucketsToFloor([row('W0_4', 10, 10, 0), row('W5_13', 11, 30, 1), row('W14_26', 12, 90, 3), row('W27_52', 10, 20, 0), row('W53_PLUS', 10, 10, 0)])
    expect(groups).toHaveLength(5)
  })
  it('never exposes a group below the floor in the built card', () => {
    const s = buildEmployerScorecard(
      [row('W0_4', 4, 20, 1), row('W5_13', 4, 40, 2), row('W14_26', 14, 200, 8), row('W27_52', 2, 30, 0)],
      ALL_BENCH,
      { seatCount: 200 },
    )
    expect(s.suppressed).toBe(false)
    for (const g of s.groups) expect(g.enrolled).toBeGreaterThanOrEqual(10)
  })
})

describe('employer scorecard: rounding and bands', () => {
  it('always rounds counts to the nearest 5, at any cohort size', () => {
    const rows = [row('W5_13', 12, 150, 4)]
    expect(buildEmployerScorecard(rows, ALL_BENCH, { seatCount: 30 }).totalEnrolled).toBe(10)
    expect(buildEmployerScorecard(rows, ALL_BENCH, { seatCount: 800 }).totalEnrolled).toBe(10)
    // a one-person change only shows when it crosses a rounding boundary: 12 rounds to 10, 13 to 15
    expect(buildEmployerScorecard([row('W5_13', 13, 150, 4)], ALL_BENCH, { seatCount: 800 }).totalEnrolled).toBe(15)
  })
  it('uses coarse bands, never a ratio', () => {
    expect(bandForRatio(0.5)).toBe('BELOW')
    expect(bandForRatio(1)).toBe('ABOUT')
    expect(bandForRatio(1.5)).toBe('ABOVE')
    expect(bandForRatio(3)).toBe('WELL_ABOVE')
    const s = buildEmployerScorecard([row('W5_13', 20, 400, 25)], ALL_BENCH, { seatCount: 100 })
    expect(JSON.stringify(s)).not.toMatch(/uplift|ratio/i)
  })
  it('withholds the band when too few events are expected, so one person cannot flip it', () => {
    // expected = 0.05 * 60 = 3 < MIN_EXPECTED_EVENTS
    const s = buildEmployerScorecard([row('W5_13', 12, 60, 3)], ALL_BENCH, { seatCount: 100 })
    expect(MIN_EXPECTED_EVENTS).toBeGreaterThan(3)
    expect(s.groups[0].band).toBeNull()
    expect(s.groups[0].bandWithheld).toBe('TOO_FEW_EVENTS')
    expect(s.overallBand).toBeNull()
  })
  it('withholds the band when a bucket has no sourced benchmark', () => {
    const s = buildEmployerScorecard([row('W53_PLUS', 20, 400, 25)], [], { seatCount: 100 })
    expect(s.groups[0].band).toBeNull()
    expect(s.groups[0].bandWithheld).toBe('NO_BENCHMARK')
  })
})

describe('employer scorecard: structure', () => {
  it('contains only counts, labels and bands (no ids, names, dates of individuals, pay or sources)', () => {
    const s = buildEmployerScorecard([row('W5_13', 20, 400, 25)], ALL_BENCH, { seatCount: 100 })
    const keys = new Set<string>()
    const walk = (v: unknown) => {
      if (v && typeof v === 'object' && !(v instanceof Date)) for (const [k, x] of Object.entries(v)) { keys.add(k); walk(x) }
    }
    walk(s)
    for (const k of keys) expect(k).not.toMatch(/id$|email|name|pay|salary|source|candidate|user/i)
  })
})

describe('employer scorecard: quarterly snapping', () => {
  it('snaps every cohort to the last complete quarter, whatever its size', () => {
    const now = new Date('2026-11-15T12:00:00Z')
    for (const seats of [10, 40, 500]) {
      const s = scorecardAsOf(seats, now)
      expect(s.granularity).toBe('quarterly')
      expect(s.asOf.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    }
    // the figure does not move between mid-quarter dates
    expect(scorecardAsOf(500, new Date('2026-12-30T00:00:00Z')).asOf.toISOString()).toBe('2026-10-01T00:00:00.000Z')
  })
})

import { readFileSync } from 'fs'
import path from 'path'

describe('employer scorecard: structural guard', () => {
  const src = (f: string) => readFileSync(path.join(process.cwd(), f), 'utf8')
  it('the server reader touches no candidate, seat or hire table directly', () => {
    const s = src('src/lib/employer/outcome-scorecard-server.ts')
    for (const banned of ['prisma.candidateProfile', 'prisma.hireOutcome', 'prisma.outplacementSeat', 'prisma.outplacementOrgUser', 'candidateId']) {
      expect(s).not.toContain(banned)
    }
    // the only raw SQL is the private aggregate function
    const raw = s.match(/\$queryRaw/g) ?? []
    expect(raw).toHaveLength(1)
    expect(s).toContain('private.employer_outcomes_by_bucket')
  })
  it('the SQL function returns only counts and keeps every privacy exclusion', () => {
    const sql = src('prisma/sql/employer-outcomes.sql')
    expect(sql).toContain('returns table (bucket text, enrolled int, person_weeks int, reemployed int)')
    expect(sql).toContain('"shareOutcomeWithEmployer" is true')
    expect(sql).toContain('"confidentialSearchMode" is false')
    expect(sql).toMatch(/OutplacementOrgUser[\s\S]*ou\."userId" = cp\."userId"/)
    expect(sql).toContain('p_as_of')
  })
  it('is off unless explicitly enabled', async () => {
    const prev = process.env.EMPLOYER_OUTCOMES_SCORECARD_ENABLED
    delete process.env.EMPLOYER_OUTCOMES_SCORECARD_ENABLED
    const { employerScorecardEnabled } = await import('@/lib/employer/outcome-scorecard-server')
    expect(employerScorecardEnabled()).toBe(false)
    process.env.EMPLOYER_OUTCOMES_SCORECARD_ENABLED = 'true'
    expect(employerScorecardEnabled()).toBe(true)
    if (prev === undefined) delete process.env.EMPLOYER_OUTCOMES_SCORECARD_ENABLED
    else process.env.EMPLOYER_OUTCOMES_SCORECARD_ENABLED = prev
  })
})
