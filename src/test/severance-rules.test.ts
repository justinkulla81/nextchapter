import { describe, expect, it } from 'vitest'
import { NO_FEDERAL_RULE, SEVERANCE_RULES_AS_OF, SEVERANCE_SOURCE_BLOCKS, SURVEYS, UNEMPLOYMENT_TAX, WAIVER, WARN, WITHHOLDING } from '@/lib/severance/rules'

describe('severance rules: sources and dates', () => {
  it('gives every figure block a date and at least one https source', () => {
    for (const { title, block } of SEVERANCE_SOURCE_BLOCKS) {
      expect(block.asOf, title).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(block.sources.length, title).toBeGreaterThan(0)
      for (const s of block.sources) {
        expect(s.url, title).toMatch(/^https:\/\//)
        expect(s.label.length, title).toBeGreaterThan(0)
      }
    }
  })

  it('lists every exported block in the sources list', () => {
    const blocks = [NO_FEDERAL_RULE, WITHHOLDING, WAIVER, WARN, SURVEYS, UNEMPLOYMENT_TAX]
    for (const b of blocks) expect(SEVERANCE_SOURCE_BLOCKS.map((x) => x.block)).toContain(b)
    expect(SEVERANCE_RULES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('severance rules: the published figures', () => {
  it('uses the withholding and payroll figures in IRS Publication 15 (2026)', () => {
    expect(WITHHOLDING.taxYear).toBe(2026)
    expect(WITHHOLDING.supplementalRate).toBe(0.22)
    expect(WITHHOLDING.supplementalRateOver).toBe(0.37)
    expect(WITHHOLDING.supplementalThreshold).toBe(1_000_000)
    expect(WITHHOLDING.socialSecurityRate).toBe(0.062)
    expect(WITHHOLDING.socialSecurityWageBase).toBe(184_500)
    expect(WITHHOLDING.medicareRate).toBe(0.0145)
    expect(WITHHOLDING.additionalMedicareRate).toBe(0.009)
    expect(WITHHOLDING.additionalMedicareThreshold).toBe(200_000)
  })

  it('uses the EEOC waiver periods', () => {
    expect(WAIVER.minAge).toBe(40)
    expect(WAIVER.considerDays).toBe(21)
    expect(WAIVER.considerDaysGroup).toBe(45)
    expect(WAIVER.revokeDays).toBe(7)
  })

  it('uses the WARN statute figures', () => {
    expect(WARN.noticeDays).toBe(60)
    expect(WARN.minEmployees).toBe(100)
    expect(WARN.plantClosingEmployees).toBe(50)
    expect(WARN.massLayoffEmployees).toBe(50)
    expect(WARN.massLayoffShare).toBe(0.33)
    expect(WARN.massLayoffAlways).toBe(500)
    expect(WARN.maxBackPayDays).toBe(60)
  })

  it('keeps the survey figures with their limits (one region, and a total not a rate)', () => {
    expect(SURVEYS.oneWeekPerYearShare).toBe(0.57)
    expect(SURVEYS.twoWeeksPerYearShare).toBe(0.24)
    expect(SURVEYS.averageTotalWeeks).toBe(19.3)
    expect(SURVEYS.priorAverageTotalWeeks).toBe(15.6)
    expect(SURVEYS.sources.some((s) => /Michigan/.test(s.label))).toBe(true)
  })
})
