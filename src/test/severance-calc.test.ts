import { describe, expect, it } from 'vitest'
import { agreementDates, netSeverance, TREATMENT_LABEL, TREATMENT_ORDER, TREATMENT_SENTENCE } from '@/lib/severance/calc'
import { groupByTreatment, severanceByState } from '@/lib/severance/state-groups'
import { WITHHOLDING } from '@/lib/severance/rules'
import { ALL_STATE_CODES } from '@/lib/seo/states'

describe('netSeverance', () => {
  it('withholds 22% federal, 6.2% Social Security and 1.45% Medicare on a $60,000 lump sum with no earlier pay', () => {
    const n = netSeverance({ gross: 60_000 })
    expect(n.federalIncomeTax).toBe(13_200)
    expect(n.socialSecurity).toBe(3_720)
    expect(n.medicare).toBe(870)
    expect(n.additionalMedicare).toBe(0)
    expect(n.stateIncomeTax).toBe(0)
    expect(n.withheld).toBe(17_790)
    expect(n.net).toBe(42_210)
  })

  it('stops Social Security at the wage base, counting pay already earned this year', () => {
    const n = netSeverance({ gross: 60_000, paidThisYear: 150_000 })
    // Room left under 184,500 is 34,500.
    expect(n.socialSecurity).toBe(Math.round(34_500 * WITHHOLDING.socialSecurityRate))
    expect(netSeverance({ gross: 60_000, paidThisYear: 190_000 }).socialSecurity).toBe(0)
  })

  it('adds the 0.9% Medicare tax only on the part of the year’s wages above $200,000', () => {
    expect(netSeverance({ gross: 60_000, paidThisYear: 100_000 }).additionalMedicare).toBe(0)
    // 150,000 + 100,000 = 250,000, so 50,000 is over the threshold.
    expect(netSeverance({ gross: 100_000, paidThisYear: 150_000 }).additionalMedicare).toBe(450)
    // Already over before the severance: all of it counts.
    expect(netSeverance({ gross: 10_000, paidThisYear: 250_000 }).additionalMedicare).toBe(90)
  })

  it('withholds 37% on the part of supplemental wages above $1 million', () => {
    const n = netSeverance({ gross: 1_200_000 })
    expect(n.federalIncomeTax).toBe(Math.round(1_000_000 * 0.22 + 200_000 * 0.37))
  })

  it('applies the state rate the user enters, capped at 20%, and leaves it out otherwise', () => {
    expect(netSeverance({ gross: 50_000, stateRatePercent: 5 }).stateIncomeTax).toBe(2_500)
    expect(netSeverance({ gross: 50_000, stateRatePercent: 99 }).stateIncomeTax).toBe(10_000)
    expect(netSeverance({ gross: 50_000 }).stateIncomeTax).toBe(0)
  })

  it('never returns a negative net and prints its assumptions', () => {
    const n = netSeverance({ gross: 0 })
    expect(n.net).toBe(0)
    expect(n.assumptions.length).toBeGreaterThanOrEqual(3)
    expect(n.assumptions.join(' ')).toMatch(/not the tax you owe/)
  })
})

describe('agreementDates', () => {
  const received = new Date('2026-11-02T00:00:00Z')
  it('gives 21 days to consider an individual offer and 45 for a group program', () => {
    const solo = agreementDates(received, false)
    expect(solo.reviewDays).toBe(21)
    expect(solo.reviewEnds.toISOString().slice(0, 10)).toBe('2026-11-23')
    const group = agreementDates(received, true)
    expect(group.reviewDays).toBe(45)
    expect(group.reviewEnds.toISOString().slice(0, 10)).toBe('2026-12-17')
  })

  it('gives 7 days after signing to revoke', () => {
    const d = agreementDates(received, false)
    expect(d.revokeEnds(new Date('2026-11-10T00:00:00Z')).toISOString().slice(0, 10)).toBe('2026-11-17')
  })
})

describe('how states treat severance', () => {
  const rows = severanceByState()

  it('covers all 50 states and DC, once each', () => {
    expect(rows).toHaveLength(51)
    expect(new Set(rows.map((r) => r.code))).toEqual(new Set(ALL_STATE_CODES))
  })

  it('groups every state exactly once, best news first, with unconfirmed states last', () => {
    const groups = groupByTreatment(rows)
    expect(groups.reduce((n, g) => n + g.states.length, 0)).toBe(51)
    const kinds = groups.map((g) => g.treatment)
    const ordered = TREATMENT_ORDER.filter((t) => kinds.includes(t))
    expect(kinds.filter((k) => k !== null)).toEqual(ordered)
    if (kinds.includes(null)) expect(kinds[kinds.length - 1]).toBeNull()
  })

  it('has a sentence and a label for every treatment', () => {
    for (const t of TREATMENT_ORDER) {
      expect(TREATMENT_SENTENCE[t].length).toBeGreaterThan(20)
      expect(TREATMENT_LABEL[t].length).toBeGreaterThan(3)
    }
  })

  it('only gives a state a treatment when it has the state’s own sourced text and a source link', () => {
    for (const r of rows) {
      if (r.treatment) {
        expect(r.text, r.code).toBeTruthy()
        expect(r.source, r.code).toMatch(/^https?:\/\//)
        expect(r.asOf, r.code).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })
})
