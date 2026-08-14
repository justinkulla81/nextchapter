// Part B Prompt 7's observation generator (src/lib/admin/observations.ts)
// has no real caller yet — phases C/D's /admin/issues and /admin/population
// pages don't exist. This is the synthetic-fixture proof the file's own
// header comment says it needs: sane output against hand-built inputs for
// each of the 4 trigger rules, plus a check that a "boring" input set
// produces no noise.
import { describe, it, expect } from 'vitest'
import {
  generateObservations,
  type IssuePrevalenceInput,
  type SegmentMetricInput,
  type FunnelStepInput,
  type IssueFixRateInput,
} from '@/lib/admin/observations'

describe('generateObservations', () => {
  it('produces nothing from quiet, stable inputs', () => {
    const issuePrevalence: IssuePrevalenceInput[] = [
      { issueCode: 'typo', prevalenceThisWeek: 40, prevalenceLastWeek: 38 },
    ]
    const segmentRates: SegmentMetricInput[] = [
      { segmentType: 'function', segmentValue: 'Engineering', metricLabel: 'Your Evidence score', unit: 'points', segmentRate: 51, overallRate: 50, memberCount: 40 },
      { segmentType: 'function', segmentValue: 'Sales', metricLabel: 'Your Evidence score', unit: 'points', segmentRate: 49, overallRate: 50, memberCount: 40 },
    ]
    const funnelSteps: FunnelStepInput[] = [
      { stepName: 'Registered', conversionThisWeek: 82, conversionLastWeek: 80 },
    ]
    const fixRates: IssueFixRateInput[] = [
      { issueCode: 'typo', timesSurfacedThisWeek: 500, timesFixedThisWeek: 400, totalPointImpact: 200 },
    ]

    const result = generateObservations({ issuePrevalence, segmentRates, funnelSteps, fixRates })
    expect(result).toEqual([])
  })

  it('flags an issue prevalence shift over 10 points, and links back to that issue', () => {
    const issuePrevalence: IssuePrevalenceInput[] = [
      { issueCode: 'no_target_line', prevalenceThisWeek: 62, prevalenceLastWeek: 48 },
      { issueCode: 'typo', prevalenceThisWeek: 41, prevalenceLastWeek: 39 }, // under threshold, no observation
    ]

    const result = generateObservations({ issuePrevalence })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('prevalence_shift:no_target_line')
    expect(result[0].text).toContain('no_target_line')
    expect(result[0].text).toContain('14')
    expect(result[0].linkedFilter).toEqual({
      basePath: '/support/admin/issues',
      params: { issueCode: 'no_target_line' },
    })
  })

  it('does not flag a prevalence shift with no prior-week data', () => {
    const result = generateObservations({
      issuePrevalence: [{ issueCode: 'typo', prevalenceThisWeek: 90, prevalenceLastWeek: null }],
    })
    expect(result).toEqual([])
  })

  it('flags a segment that deviates more than 1.5 sigma from the overall rate', () => {
    const segmentRates: SegmentMetricInput[] = [
      { segmentType: 'function', segmentValue: 'Engineering', metricLabel: 'Your Evidence score', unit: 'points', segmentRate: 36, overallRate: 50, memberCount: 40 },
      { segmentType: 'function', segmentValue: 'Sales', metricLabel: 'Your Evidence score', unit: 'points', segmentRate: 52, overallRate: 50, memberCount: 40 },
      { segmentType: 'function', segmentValue: 'Marketing', metricLabel: 'Your Evidence score', unit: 'points', segmentRate: 51, overallRate: 50, memberCount: 40 },
      { segmentType: 'function', segmentValue: 'Operations', metricLabel: 'Your Evidence score', unit: 'points', segmentRate: 49, overallRate: 50, memberCount: 40 },
    ]

    const result = generateObservations({ segmentRates })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('segment_deviation:function:Engineering:Your Evidence score')
    expect(result[0].text).toContain('Engineering')
    expect(result[0].text).toContain('14 points below average')
    expect(result[0].linkedFilter.params).toEqual({ segmentType: 'function', segmentValue: 'Engineering' })
  })

  it('suppresses a segment below the minimum cell size even if its rate is an outlier', () => {
    const segmentRates: SegmentMetricInput[] = [
      { segmentType: 'metro', segmentValue: 'Boise', metricLabel: 'Your Evidence score', unit: 'points', segmentRate: 5, overallRate: 50, memberCount: 2 },
      { segmentType: 'metro', segmentValue: 'Austin', metricLabel: 'Your Evidence score', unit: 'points', segmentRate: 51, overallRate: 50, memberCount: 40 },
    ]
    const result = generateObservations({ segmentRates })
    expect(result.some((o) => o.text.includes('Boise'))).toBe(false)
  })

  it('flags a funnel step whose conversion dropped more than 5 points', () => {
    const funnelSteps: FunnelStepInput[] = [
      { stepName: 'First reference requested', conversionThisWeek: 61, conversionLastWeek: 70 },
      { stepName: 'Registered', conversionThisWeek: 81, conversionLastWeek: 80 }, // under threshold
    ]

    const result = generateObservations({ funnelSteps })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('funnel_drop:First reference requested')
    expect(result[0].text).toContain('9 points')
    expect(result[0].linkedFilter).toEqual({
      basePath: '/support/admin/population',
      params: { funnelStep: 'First reference requested' },
    })
  })

  it('flags a low fix rate at scale, and names it as highest-point-impact / least-applied when it ranks that way', () => {
    const fixRates: IssueFixRateInput[] = [
      { issueCode: 'no_target_line', timesSurfacedThisWeek: 412, timesFixedThisWeek: 61, totalPointImpact: 9000 }, // 14.8% fix rate, highest point impact, lowest fix rate
      { issueCode: 'typo', timesSurfacedThisWeek: 500, timesFixedThisWeek: 480, totalPointImpact: 1200 }, // 96% fix rate, healthy
      { issueCode: 'no_summary', timesSurfacedThisWeek: 300, timesFixedThisWeek: 250, totalPointImpact: 4000 }, // 83% fix rate, healthy
    ]

    const result = generateObservations({ fixRates })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('low_fix_rate:no_target_line')
    expect(result[0].text).toContain('412 times')
    expect(result[0].text).toContain('61 times')
    expect(result[0].text).toContain('15%')
    expect(result[0].text).toContain('highest-point-impact fix in the product')
    expect(result[0].text).toContain('least-applied')
    expect(result[0].linkedFilter).toEqual({
      basePath: '/support/admin/issues',
      params: { issueCode: 'no_target_line', view: 'fix-rates' },
    })
  })

  it('does not flag an issue below the 100-surfacing floor even with a terrible fix rate', () => {
    const result = generateObservations({
      fixRates: [{ issueCode: 'rare_issue', timesSurfacedThisWeek: 12, timesFixedThisWeek: 0, totalPointImpact: 50 }],
    })
    expect(result).toEqual([])
  })

  it('does not flag an issue with a healthy fix rate even at scale', () => {
    const result = generateObservations({
      fixRates: [{ issueCode: 'popular_fix', timesSurfacedThisWeek: 900, timesFixedThisWeek: 700, totalPointImpact: 3000 }],
    })
    expect(result).toEqual([])
  })
})
