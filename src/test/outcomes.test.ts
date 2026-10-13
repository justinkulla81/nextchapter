import { describe, expect, it } from 'vitest'
import { durationBucketForWeeks, weeksUnemployed } from '@/lib/outcomes/duration-bucket'
import { computeUplift, monthlyToWeeklyRate, pooledUplift, weeklyRate } from '@/lib/outcomes/uplift'
import { medianRetention, payRetention } from '@/lib/outcomes/pay-retention'
import { MIN_CELL_SIZE, suppressSmallCell } from '@/lib/outcomes/small-cell'
import { computeSearchMixNudge } from '@/lib/outcomes/search-mix'
import { describePayRange, estimatePayChange, type PayBenchmarkRow } from '@/lib/outcomes/pay-change-estimate'

describe('duration buckets', () => {
  it('buckets weeks at the edges', () => {
    expect(durationBucketForWeeks(0)).toBe('W0_4')
    expect(durationBucketForWeeks(4)).toBe('W0_4')
    expect(durationBucketForWeeks(5)).toBe('W5_13')
    expect(durationBucketForWeeks(13)).toBe('W5_13')
    expect(durationBucketForWeeks(14)).toBe('W14_26')
    expect(durationBucketForWeeks(26)).toBe('W14_26')
    expect(durationBucketForWeeks(27)).toBe('W27_52')
    expect(durationBucketForWeeks(52)).toBe('W27_52')
    expect(durationBucketForWeeks(53)).toBe('W53_PLUS')
  })
  it('returns null for missing or bad input instead of guessing', () => {
    expect(durationBucketForWeeks(null)).toBeNull()
    expect(durationBucketForWeeks(-1)).toBeNull()
    expect(weeksUnemployed(null, new Date())).toBeNull()
    expect(weeksUnemployed(new Date('2030-01-01'), new Date('2029-01-01'))).toBeNull()
  })
  it('counts whole weeks', () => {
    expect(weeksUnemployed(new Date('2026-01-01'), new Date('2026-01-30'))).toBe(4)
  })
})

describe('uplift', () => {
  it('compares observed to expected within the same bucket', () => {
    const rows = computeUplift(
      [{ bucket: 'W27_52', personWeeks: 200, reemployed: 10 }],
      [{ bucket: 'W27_52', weeklyReemploymentRate: 0.025 }],
    )
    expect(rows[0].expected).toBeCloseTo(5)
    expect(rows[0].uplift).toBeCloseTo(2)
  })
  it('does not divide by zero when no benchmark exists', () => {
    const rows = computeUplift([{ bucket: 'W0_4', personWeeks: 50, reemployed: 5 }], [])
    expect(rows[0].uplift).toBeNull()
  })
  it('pools by totals, not an average of ratios', () => {
    const rows = computeUplift(
      [
        { bucket: 'W0_4', personWeeks: 100, reemployed: 10 },
        { bucket: 'W53_PLUS', personWeeks: 400, reemployed: 8 },
      ],
      [
        { bucket: 'W0_4', weeklyReemploymentRate: 0.1 },
        { bucket: 'W53_PLUS', weeklyReemploymentRate: 0.01 },
      ],
    )
    expect(pooledUplift(rows)).toBeCloseTo(18 / 14)
  })
  it('weekly rate and monthly conversion', () => {
    expect(weeklyRate(0, 0)).toBeNull()
    expect(weeklyRate(100, 5)).toBeCloseTo(0.05)
    const w = monthlyToWeeklyRate(0.1)!
    expect(1 - Math.pow(1 - w, 4.345)).toBeCloseTo(0.1)
    expect(monthlyToWeeklyRate(1)).toBeNull()
  })
})

describe('pay retention', () => {
  it('computes ratio and cut', () => {
    const r = payRetention(200_000, 150_000)!
    expect(r.ratio).toBeCloseTo(0.75)
    expect(r.changePct).toBeCloseTo(-25)
    expect(r.tookCut).toBe(true)
    expect(payRetention(100_000, 110_000)!.tookCut).toBe(false)
  })
  it('returns null on missing pay', () => {
    expect(payRetention(null, 100)).toBeNull()
    expect(payRetention(0, 100)).toBeNull()
  })
  it('median ignores nulls', () => {
    expect(medianRetention([0.8, null, 1.0, 1.2])).toBeCloseTo(1.0)
    expect(medianRetention([])).toBeNull()
  })
})

describe('small cell suppression', () => {
  it('hides cells below the minimum', () => {
    expect(suppressSmallCell(MIN_CELL_SIZE - 1, 'x')).toBeNull()
    expect(suppressSmallCell(MIN_CELL_SIZE, 'x')).toBe('x')
  })
})

describe('search mix nudge', () => {
  it('stays quiet with few cold applications', () => {
    expect(computeSearchMixNudge({ warmConversations: 0, referralAsks: 0, coldApplications: 3 }).level).toBe('none')
  })
  it('stays quiet when warm share is healthy', () => {
    expect(computeSearchMixNudge({ warmConversations: 4, referralAsks: 2, coldApplications: 8 }).level).toBe('none')
  })
  it('nudges gently when mostly cold', () => {
    const n = computeSearchMixNudge({ warmConversations: 1, referralAsks: 0, coldApplications: 8 })
    expect(n.level).toBe('gentle')
    expect(n.convertSuggestion).toBeGreaterThan(0)
  })
  it('is strong only when almost all cold and high volume', () => {
    expect(computeSearchMixNudge({ warmConversations: 0, referralAsks: 0, coldApplications: 12 }).level).toBe('strong')
  })
  it('never uses blaming language', () => {
    const n = computeSearchMixNudge({ warmConversations: 0, referralAsks: 0, coldApplications: 12 })
    expect(`${n.headline} ${n.body}`).not.toMatch(/lazy|bad|wrong|stop applying|too many/i)
  })
})

describe('pay change estimate', () => {
  const row = (over: Partial<PayBenchmarkRow>): PayBenchmarkRow => ({
    pathType: 'RESET', group: 'g', lowPct: -30, highPct: 0, medianPct: -10, sampleSize: 100,
    confidence: 'MEDIUM', sourceTitle: 'BLS DWS', sourceUrl: null, asOf: '2026-01', ...over,
  })
  it('says so when there is no benchmark', () => {
    const e = estimatePayChange('KEEP_SENIORITY', [row({})])
    expect(e.available).toBe(false)
    expect(describePayRange(e)).toMatch(/not enough data/i)
  })
  it('uses the conservative envelope and lowest confidence', () => {
    const e = estimatePayChange('RESET', [row({ lowPct: -30, highPct: 5, confidence: 'HIGH' }), row({ lowPct: -20, highPct: 0, confidence: 'LOW' })])
    expect(e.lowPct).toBe(-30)
    expect(e.highPct).toBe(0)
    expect(e.confidence).toBe('LOW')
  })
})

import { buildInstitutionOutcomes, type OutcomeViewRow } from '@/lib/outcomes/institution-outcomes'

describe('institution outcomes', () => {
  const row = (over: Partial<OutcomeViewRow>): OutcomeViewRow => ({
    bucket: 'W27_52', members: 12, personWeeks: 200, reemployed: 10, hiresAll: 12, interimHires: 2,
    warmSourced: 6, withPay: 11, tookCut: 4, medianPayRetention: 0.92, ...over,
  })
  it('suppresses buckets under the privacy floor and shows nothing from them', () => {
    const s = buildInstitutionOutcomes([row({ bucket: 'W0_4', members: 9, reemployed: 8 })], [])
    const r = s.rows.find((x) => x.bucket === 'W0_4')!
    expect(r.suppressed).toBe(true)
    expect(r.reemployed).toBeNull()
    expect(r.uplift).toBeNull()
    expect(s.allSuppressed).toBe(true)
  })
  it('compares within the same bucket and flags a missing benchmark honestly', () => {
    const s = buildInstitutionOutcomes([row({}), row({ bucket: 'W53_PLUS' })], [{ bucket: 'W27_52', weeklyReemploymentRate: 0.025 }])
    const a = s.rows.find((x) => x.bucket === 'W27_52')!
    expect(a.uplift).toBeCloseTo(2)
    expect(a.benchmarkPending).toBe(false)
    const b = s.rows.find((x) => x.bucket === 'W53_PLUS')!
    expect(b.benchmarkPending).toBe(true)
    expect(b.uplift).toBeNull()
  })
  it('pools only visible, benchmarked buckets', () => {
    const s = buildInstitutionOutcomes([row({}), row({ bucket: 'W53_PLUS', reemployed: 1 })], [{ bucket: 'W27_52', weeklyReemploymentRate: 0.025 }])
    expect(s.pooledUplift).toBeCloseTo(2)
    expect(s.totalMembers).toBe(24)
  })
  it('hides pay and source detail when too few hires report it', () => {
    const s = buildInstitutionOutcomes([row({ withPay: 5, hiresAll: 6 })], [])
    const r = s.rows.find((x) => x.bucket === 'W27_52')!
    expect(r.medianPayRetention).toBeNull()
    expect(r.tookCutShare).toBeNull()
    expect(r.warmShare).toBeNull()
  })
})

import { deriveSegments } from '@/lib/outcomes/segments'

describe('segments', () => {
  const base = { ageBand: null, yearsExperience: null, hasMastersOrHigher: false, laidOff: false, seniorityBand: null } as const
  it('never infers age: no age band means no 55-64 segment', () => {
    expect(deriveSegments({ ...base, yearsExperience: 30 })).not.toContain('LONG_TENURED_55_64')
  })
  it('tags 55-64 only when the candidate said so', () => {
    expect(deriveSegments({ ...base, ageBand: 'A55_64', yearsExperience: 30 })).toContain('LONG_TENURED_55_64')
    expect(deriveSegments({ ...base, ageBand: 'A45_54', yearsExperience: 30 })).not.toContain('LONG_TENURED_55_64')
  })
  it('tags advanced degrees and 25-year veterans', () => {
    expect(deriveSegments({ ...base, hasMastersOrHigher: true })).toContain('MASTERS_OR_25YR')
    expect(deriveSegments({ ...base, yearsExperience: 26 })).toContain('MASTERS_OR_25YR')
    expect(deriveSegments({ ...base, yearsExperience: 10 })).toEqual([])
  })
  it('tags laid-off senior people as managers', () => {
    expect(deriveSegments({ ...base, laidOff: true, seniorityBand: 'SENIOR' })).toContain('LAID_OFF_MANAGER')
    expect(deriveSegments({ ...base, laidOff: true, seniorityBand: 'EARLY' })).toEqual([])
    expect(deriveSegments({ ...base, laidOff: false, seniorityBand: 'EXECUTIVE' })).toEqual([])
  })
})

import { cushionMonths, uiWeeksLeft } from '@/lib/outcomes/runway'

describe('runway', () => {
  it('estimates unemployment weeks left and says when unknown', () => {
    expect(uiWeeksLeft({ maxWeeks: 26, durationVaries: false, weeksSinceLastJob: 10 }).weeksLeft).toBe(16)
    expect(uiWeeksLeft({ maxWeeks: 26, durationVaries: false, weeksSinceLastJob: 40 }).exhausted).toBe(true)
    expect(uiWeeksLeft({ maxWeeks: null, durationVaries: null, weeksSinceLastJob: 3 }).known).toBe(false)
    expect(uiWeeksLeft({ maxWeeks: 26, durationVaries: null, weeksSinceLastJob: null }).known).toBe(false)
  })
  it('warns when a state varies its weeks', () => {
    expect(uiWeeksLeft({ maxWeeks: 20, durationVaries: true, weeksSinceLastJob: 1 }).note).toMatch(/unemployment rate/)
  })
  it('computes cushion months and handles income covering expenses', () => {
    expect(cushionMonths({ savingsUsd: 30000, monthlyExpensesUsd: 6000, monthlyIncomeUsd: 1000 }).months).toBeCloseTo(6)
    expect(cushionMonths({ savingsUsd: 1000, monthlyExpensesUsd: 3000, monthlyIncomeUsd: 3000 }).coveredByIncome).toBe(true)
    expect(cushionMonths({ savingsUsd: -1, monthlyExpensesUsd: 3000, monthlyIncomeUsd: 0 }).months).toBeNull()
    expect(cushionMonths({ savingsUsd: 1000, monthlyExpensesUsd: 0, monthlyIncomeUsd: 0 }).months).toBeNull()
  })
})
