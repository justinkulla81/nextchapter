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
