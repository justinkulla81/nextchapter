import { describe, expect, it } from 'vitest'
import { applicablePercent, compare, creditAtCliff, deadlines, fplAmount, fplPercent, medicaidFplAmount } from '@/lib/cobra-aca/calc'
import { COBRA, FPL_SOURCES, MARKETPLACE, MEDICAID, PTC, PTC_RULE_SOURCES, STATE_TABLE_SOURCES } from '@/lib/cobra-aca/rules'
import { NON_EXPANSION_STATES, STATE_FACTS, benchmarkChangePct, benchmarkRank, stateMeetsBar } from '@/lib/cobra-aca/states'
import { ALL_STATE_CODES } from '@/lib/seo/states'

const utc = (s: string) => new Date(`${s}T00:00:00Z`)

describe('sources and dates', () => {
  it('gives every figure block a date and at least one https source', () => {
    const blocks = [COBRA, MARKETPLACE, MEDICAID, PTC[2026], PTC[2027], PTC_RULE_SOURCES, FPL_SOURCES, STATE_TABLE_SOURCES]
    for (const b of blocks) {
      expect(b.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(b.sources.length).toBeGreaterThan(0)
      for (const s of b.sources) expect(s.url).toMatch(/^https?:\/\//)
    }
  })

  it('lists the COBRA rules the Department of Labor publishes', () => {
    expect(COBRA.minEmployees).toBe(20)
    expect(COBRA.electionDays).toBe(60)
    expect(COBRA.firstPaymentDays).toBe(45)
    expect(COBRA.maxMonthsJobLoss).toBe(18)
    expect(COBRA.premiumShareOfPlanCost).toBe(1.02)
    expect(MARKETPLACE.specialEnrollmentDays).toBe(60)
  })
})

describe('premium tax credit tables', () => {
  for (const year of [2026, 2027] as const) {
    it(`${year}: bands run without gaps from 0 to 400% and never fall`, () => {
      const t = PTC[year]
      expect(t.bands[0].fromFpl).toBe(0)
      expect(t.bands[t.bands.length - 1].toFpl).toBe(400)
      expect(t.capFpl).toBe(400)
      t.bands.forEach((b, i) => {
        expect(b.final).toBeGreaterThanOrEqual(b.initial)
        if (i > 0) {
          expect(b.fromFpl).toBe(t.bands[i - 1].toFpl)
          expect(b.initial).toBeGreaterThanOrEqual(t.bands[i - 1].final - 1e-12)
        }
      })
      expect(t.bands[t.bands.length - 1].final).toBe(t.requiredContribution)
    })
  }

  it('uses the published figures (Rev. Proc. 2025-25 and 2026-26)', () => {
    expect(PTC[2026].requiredContribution).toBe(0.0996)
    expect(PTC[2027].requiredContribution).toBe(0.1022)
    expect(PTC[2026].bands[0].initial).toBe(0.021)
    expect(PTC[2027].bands[0].initial).toBe(0.0215)
  })
})

describe('poverty guidelines', () => {
  it('uses the guidelines published the year before the coverage year', () => {
    expect(fplAmount(2026, 1)).toBe(15_650)
    expect(fplAmount(2027, 1)).toBe(15_960)
    expect(fplAmount(2026, 2)).toBe(21_150)
    expect(fplAmount(2026, 4)).toBe(32_150)
  })
  it('puts the 400% line where the IRS and HealthCare.gov state it for 2026', () => {
    expect(fplAmount(2026, 1) * 4).toBe(62_600)
    expect(fplAmount(2026, 2) * 4).toBe(84_600)
    expect(fplAmount(2026, 4) * 4).toBe(128_600)
  })
  it('has higher guidelines for Alaska and Hawaii', () => {
    expect(fplAmount(2026, 1, 'AK')).toBe(19_550)
    expect(fplAmount(2026, 1, 'HI')).toBe(17_990)
    expect(fplAmount(2027, 3, 'AK')).toBe(19_950 + 2 * 7_100)
  })
  it('uses the current-year guideline for Medicaid (138% of 2026 is $22,025 for one person)', () => {
    expect(Math.round(medicaidFplAmount(1) * 1.38)).toBe(22_025)
    expect(medicaidFplAmount(3)).toBe(15_960 + 2 * 5_680)
    expect(medicaidFplAmount(1, 'AK')).toBe(19_950)
  })
  it('turns income into a share of the line', () => {
    expect(fplPercent(31_300, 2026, 1)).toBeCloseTo(200, 5)
  })
})

describe('applicablePercent', () => {
  it('returns each band edge and the flat bands', () => {
    expect(applicablePercent(2026, 120)).toBe(0.021)
    expect(applicablePercent(2026, 133)).toBeCloseTo(0.0314, 6)
    expect(applicablePercent(2026, 150)).toBeCloseTo(0.0419, 6)
    expect(applicablePercent(2026, 300)).toBe(0.0996)
    expect(applicablePercent(2026, 400)).toBe(0.0996)
    expect(applicablePercent(2027, 400)).toBe(0.1022)
  })
  it('moves in a straight line inside a band', () => {
    expect(applicablePercent(2026, 175)).toBeCloseTo((0.0419 + 0.066) / 2, 6)
  })
  it('gives no credit above 400% of the poverty line', () => {
    expect(applicablePercent(2026, 400.01)).toBeNull()
    expect(applicablePercent(2027, 500)).toBeNull()
  })
})

describe('compare', () => {
  const base = { coverageYear: 2026 as const, householdSize: 1, cobraMonthly: 900, marketplaceMonthly: null }

  it('works out the credit for a single adult in Texas at about 256% of the poverty line', () => {
    const r = compare({ ...base, state: 'TX', annualIncome: 40_000 })
    expect(r.eligibility).toBe('credit')
    expect(r.marketplaceSource).toBe('state-benchmark')
    expect(r.marketplaceMonthly).toBe(STATE_FACTS.TX.benchmark[2026])
    const share = 0.0844 + ((40_000 / 15_650) * 100 - 250) / 50 * (0.0996 - 0.0844)
    expect(r.expectedShareOfIncome).toBeCloseTo(share, 6)
    expect(r.marketplaceAfterCreditMonthly).toBeCloseTo((share * 40_000) / 12, 4)
    expect(r.creditMonthly).toBeCloseTo(661 - (share * 40_000) / 12, 4)
    expect(r.monthlyDifference).toBeCloseTo(900 - (share * 40_000) / 12, 4)
  })

  it('uses a quoted Marketplace premium when given', () => {
    const r = compare({ ...base, state: 'TX', annualIncome: 40_000, marketplaceMonthly: 500 })
    expect(r.marketplaceSource).toBe('quote')
    expect(r.marketplaceMonthly).toBe(500)
    expect(r.marketplaceAfterCreditMonthly).toBeLessThanOrEqual(500)
  })

  it('gives no credit over the cliff and says how far over', () => {
    const r = compare({ ...base, state: 'CA', annualIncome: 70_000 })
    expect(r.eligibility).toBe('no-credit')
    expect(r.creditMonthly).toBe(0)
    expect(r.marketplaceAfterCreditMonthly).toBe(STATE_FACTS.CA.benchmark[2026])
    expect(r.headroomToCliff).toBe(62_600 - 70_000)
  })

  it('never lets the credit exceed the plan price', () => {
    const r = compare({ ...base, state: 'MD', annualIncome: 25_000, marketplaceMonthly: 100 })
    expect(r.creditMonthly).toBeLessThanOrEqual(100)
    expect(r.marketplaceAfterCreditMonthly).toBeGreaterThanOrEqual(0)
  })

  it('points a low income in an expansion state to Medicaid', () => {
    expect(compare({ ...base, state: 'CA', annualIncome: 15_000 }).eligibility).toBe('medicaid')
  })

  it('finds the coverage gap in a state that has not expanded, and the waiver exception', () => {
    expect(compare({ ...base, state: 'TX', annualIncome: 10_000 }).eligibility).toBe('gap')
    expect(compare({ ...base, state: 'GA', annualIncome: 10_000 }).eligibility).toBe('medicaid')
  })

  it('uses the 2027 table and guidelines for 2027 coverage', () => {
    const r = compare({ ...base, coverageYear: 2027, state: 'TX', annualIncome: 63_000 })
    expect(r.eligibility).toBe('credit')
    expect(r.cliffIncome).toBe(15_960 * 4)
  })
})

describe('creditAtCliff', () => {
  it('is the benchmark price minus the expected contribution at exactly 400%', () => {
    const r = creditAtCliff(2026, 'TX')
    expect(r.income).toBe(62_600)
    expect(r.creditMonthly).toBeCloseTo(661 - (0.0996 * 62_600) / 12, 6)
    expect(creditAtCliff(2026, 'VT').creditMonthly).toBeCloseTo(1299 - (0.0996 * 62_600) / 12, 6)
  })
  it('is never negative and uses the 2027 line for 2027 coverage', () => {
    expect(creditAtCliff(2026, 'NH').creditMonthly).toBe(0)
    expect(creditAtCliff(2027, 'TX').income).toBe(15_960 * 4)
  })
})

describe('deadlines', () => {
  it('counts COBRA from the later of coverage end and notice, and the Marketplace window from coverage end', () => {
    const d = deadlines(utc('2026-10-31'))
    expect(d.cobraElectBy).toEqual(utc('2026-12-30'))
    expect(d.cobraFirstPaymentBy).toEqual(utc('2027-02-13'))
    expect(d.marketplaceBy).toEqual(utc('2026-12-30'))
    expect(d.marketplaceStartIfPickedBefore).toEqual(utc('2026-11-01'))
    expect(d.marketplaceStartIfPickedLastDay).toEqual(utc('2027-01-01'))
    const late = deadlines(utc('2026-10-31'), utc('2026-11-10'))
    expect(late.cobraElectBy).toEqual(utc('2027-01-09'))
    expect(late.marketplaceBy).toEqual(utc('2026-12-30'))
  })
  it('ignores a notice date earlier than the end of coverage', () => {
    expect(deadlines(utc('2026-10-31'), utc('2026-10-01')).cobraElectBy).toEqual(utc('2026-12-30'))
  })
})

describe('state table', () => {
  it('has a row for every state and DC, and every row passes the page bar', () => {
    expect(Object.keys(STATE_FACTS).sort()).toEqual([...ALL_STATE_CODES].sort())
    expect(ALL_STATE_CODES.length).toBe(51)
    for (const c of ALL_STATE_CODES) expect(stateMeetsBar(c), c).toBe(true)
  })
  it('lists the ten states KFF shows as not expanded in October 2026', () => {
    expect(NON_EXPANSION_STATES).toEqual(['AL', 'FL', 'GA', 'KS', 'MS', 'SC', 'TN', 'TX', 'WI', 'WY'])
    expect(STATE_FACTS.GA.waiverToFpl100).toBe(true)
    expect(STATE_FACTS.WI.waiverToFpl100).toBe(true)
    expect(STATE_FACTS.TX.waiverToFpl100).toBeUndefined()
  })
  it('matches the KFF marketplace-type counts for 2026 (21 state-based, 2 on the federal platform, 28 federal)', () => {
    const count = (t: string) => Object.values(STATE_FACTS).filter((f) => f.marketplace === t).length
    expect(count('state-based')).toBe(21)
    expect(count('state-based-federal-platform')).toBe(2)
    expect(count('federal')).toBe(28)
  })
  it('has plausible premiums and ranks Vermont first and New Hampshire last', () => {
    for (const f of Object.values(STATE_FACTS)) {
      expect(f.benchmark[2025]).toBeGreaterThan(300)
      expect(f.benchmark[2026]).toBeGreaterThan(390)
      expect(f.benchmark[2026]).toBeLessThan(1400)
    }
    expect(benchmarkRank('VT')).toBe(1)
    expect(benchmarkRank('NH')).toBe(51)
    expect(benchmarkChangePct('TX')).toBe(35)
    expect(STATE_FACTS.TX.benchmark).toEqual({ 2025: 489, 2026: 661 })
  })
})
