import { describe, expect, it } from 'vitest'
import {
  TOP_EMPLOYERS,
  findTopEmployer,
  isKnownForBenefits,
  isKnownForPay,
  knownForLabel,
  topEmployerKey,
  topEmployerListNames,
  topEmployerSourceLine,
} from '@/lib/companies/top-employers'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { benefitsHighlights, importBenefitsFields, isStrongBenefits, parseBenefits } from '@/lib/jobs/benefits'
import { employerSignalsFor, greatFilterPredicate, type GreatSets } from '@/lib/jobs/great-employers'
import { benefitsBadgeFor, greatParam, parseGreatParam, payBadgeFor } from '@/lib/jobs/great-employer-display'

describe('curated top employers', () => {
  it('mirrors the ncrawl list: 230 entries, no rank numbers, a year on each', () => {
    expect(TOP_EMPLOYERS).toHaveLength(230)
    for (const e of TOP_EMPLOYERS) {
      expect(e.reasons.length).toBeGreaterThan(0)
      expect(e.lists.length).toBeGreaterThan(0)
      expect(e.year).toBeGreaterThanOrEqual(2020)
    }
  })

  it('finds an employer by the names job feeds actually use', () => {
    const cases: [string, string][] = [
      ["Trader Joe's", "Trader Joe's"],
      ['Trader Joes', "Trader Joe's"],
      ['TRADER JOE’S', "Trader Joe's"],
      ['HEB', 'H-E-B'],
      ['H-E-B', 'H-E-B'],
      ['Home Depot', 'The Home Depot'],
      ['The Home Depot', 'The Home Depot'],
      ['JPMorgan Chase & Co.', 'JPMorgan Chase'],
      ['JP Morgan Chase', 'JPMorgan Chase'],
      ['Meta Platforms, Inc.', 'Meta'],
      ['Alphabet Inc.', 'Google'],
      ['Costco Wholesale Corporation', 'Costco'],
      ['ALDI USA', 'Aldi US'],
      ['Eli Lilly and Company', 'Eli Lilly'],
      ['Walmart Inc.', 'Walmart'],
    ]
    for (const [name, expected] of cases) expect(findTopEmployer(name)?.name, name).toBe(expected)
  })

  it('finds it by the Company join key (normalizeOrgName) too', () => {
    expect(findTopEmployer(normalizeOrgName("Trader Joe's"))?.name).toBe("Trader Joe's")
    expect(findTopEmployer(normalizeOrgName('McKinsey & Company'))?.name).toBe('McKinsey & Company')
  })

  it('does not match look-alikes', () => {
    for (const name of ['Target Group', 'Hilton Grand Vacations', 'Coca-Cola Consolidated', 'Welch Allyn', 'REI Systems', 'Metabase', 'Epic Games', '']) {
      expect(findTopEmployer(name), name).toBeNull()
    }
    expect(findTopEmployer(null)).toBeNull()
  })

  it('every name and alias resolves to its own entry (no key is shared by two employers)', () => {
    for (const e of TOP_EMPLOYERS) {
      for (const n of [e.name, ...(e.aliases ?? [])]) expect(findTopEmployer(n)?.name, n).toBe(e.name)
    }
  })

  it('loosens trailing LLP / US / dangling &', () => {
    expect(topEmployerKey('KPMG LLP')).toBe('kpmg')
    expect(topEmployerKey('Bain & Company')).toBe('bain')
  })

  it('reads reasons and spells out list names', () => {
    const costco = findTopEmployer('Costco')!
    expect(isKnownForPay(costco)).toBe(true)
    expect(isKnownForBenefits(costco)).toBe(true)
    expect(knownForLabel(costco)).toBe('pay · benefits')
    expect(topEmployerListNames(costco)).toContain("Forbes America's Best Employers")
    expect(topEmployerSourceLine(costco)).toMatch(/^Named on .*Glassdoor Best Places to Work.*\(2025\)\.$/)
    expect(topEmployerSourceLine(costco)).not.toMatch(/#\d|No\. ?\d|ranked/i)
    const walmart = findTopEmployer('Walmart')!
    expect(isKnownForBenefits(walmart)).toBe(false)
    expect(topEmployerSourceLine(walmart)).toBe('Widely covered in the press for its pay and benefits (2025).')
  })
})

describe('job benefits', () => {
  it('keeps only known, typed keys, in a fixed order', () => {
    expect(parseBenefits('{"vision":true,"health":true,"bogus":1,"k401_match_pct":"6","score":3}')).toEqual({
      health: true,
      k401_match_pct: 6,
      score: 3,
      vision: true,
    })
    expect(Object.keys(parseBenefits({ vision: true, health: true })!)).toEqual(['health', 'vision'])
    expect(parseBenefits('not json')).toBeNull()
    expect(parseBenefits('')).toBeNull()
    expect(parseBenefits({ pto_days: -3, parental_leave_weeks: 999 })).toBeNull()
    expect(parseBenefits([1, 2])).toBeNull()
  })

  it('applies the strong rule', () => {
    expect(isStrongBenefits(null)).toBe(false)
    expect(isStrongBenefits({ strong: true })).toBe(true)
    expect(isStrongBenefits({ score: 6 })).toBe(true)
    expect(isStrongBenefits({ score: 5 })).toBe(false)
    expect(isStrongBenefits({ score: 3, k401_match_pct: 6 })).toBe(true)
    expect(isStrongBenefits({ score: 3, k401_match_pct: 5 })).toBe(false)
    expect(isStrongBenefits({ score: 3, parental_leave_weeks: 16 })).toBe(true)
    expect(isStrongBenefits({ score: 3, parental_leave_weeks: 12 })).toBe(false)
    for (const k of ['pension', 'sabbatical', 'childcare', 'pto_unlimited'] as const) {
      expect(isStrongBenefits({ score: 3, [k]: true }), k).toBe(true)
      expect(isStrongBenefits({ score: 2, [k]: true }), k).toBe(false)
    }
    // No score sent: categories are counted.
    expect(isStrongBenefits({ health: true, dental: true, vision: true, k401: true, pto: true, tuition: true })).toBe(true)
    expect(isStrongBenefits({ health: true, dental: true, pension: true })).toBe(true)
    expect(isStrongBenefits({ health: true, pension: true })).toBe(false)
  })

  it('import fields: absent stays absent, sender flag counts, junk is cleared', () => {
    expect(importBenefitsFields({})).toEqual({})
    expect(importBenefitsFields({ benefitsJson: '{"health":true}', benefitsStrong: 0 })).toEqual({ benefits: { health: true }, benefitsStrong: false })
    expect(importBenefitsFields({ benefitsJson: '{"health":true}', benefitsStrong: '1' })).toEqual({
      benefits: { health: true, strong: true },
      benefitsStrong: true,
    })
    expect(importBenefitsFields({ benefitsJson: '' })).toEqual({ benefits: null, benefitsStrong: false })
  })

  it('highlights read plainly', () => {
    expect(benefitsHighlights({ health: true, dental: true, vision: true, k401_match_pct: 6, parental_leave_weeks: 16, pto_unlimited: true })).toEqual([
      '6% 401(k) match',
      '16 weeks parental leave',
      'Unlimited PTO',
      'Health, dental, vision',
    ])
    expect(benefitsHighlights(null)).toEqual([])
  })
})

describe('great pay / great benefits filter', () => {
  const sets: GreatSets = {
    payHighCompanies: new Set(['acme analytics']),
    aboveMarketJobIds: new Set(['job-above']),
    strongBenefitsJobIds: new Set(['job-benefits']),
  }

  it('parses the URL parameter', () => {
    expect(parseGreatParam(undefined)).toEqual([])
    expect(parseGreatParam('benefits,pay,junk')).toEqual(['pay', 'benefits'])
    expect(greatParam(['benefits', 'pay'])).toBe('pay,benefits')
  })

  it('is null with no filter', () => {
    expect(greatFilterPredicate([], sets)).toBeNull()
  })

  it('great pay: employer pay level, the job’s own pay, or curated pay', () => {
    const keep = greatFilterPredicate(['pay'], sets)!
    expect(keep({ id: 'x', companyName: 'Acme Analytics, Inc.' })).toBe(true)
    expect(keep({ id: 'job-above', companyName: 'Nobody Co' })).toBe(true)
    expect(keep({ id: 'x', companyName: 'Walmart' })).toBe(true)
    expect(keep({ id: 'x', companyName: 'Publix' })).toBe(false) // curated for benefits, not pay
    expect(keep({ id: 'job-benefits', companyName: 'Nobody Co' })).toBe(false)
  })

  it('great benefits: the job’s own strong benefits or curated benefits', () => {
    const keep = greatFilterPredicate(['benefits'], sets)!
    expect(keep({ id: 'job-benefits', companyName: 'Nobody Co' })).toBe(true)
    expect(keep({ id: 'x', companyName: "Trader Joe's" })).toBe(true)
    expect(keep({ id: 'x', companyName: 'Walmart' })).toBe(false)
    expect(keep({ id: 'job-above', companyName: 'Acme Analytics' })).toBe(false)
  })

  it('both on: both must hold', () => {
    const keep = greatFilterPredicate(['pay', 'benefits'], sets)!
    expect(keep({ id: 'x', companyName: 'Costco' })).toBe(true)
    expect(keep({ id: 'x', companyName: 'Walmart' })).toBe(false)
    expect(keep({ id: 'job-benefits', companyName: 'Acme Analytics' })).toBe(true)
  })
})

describe('job card badges', () => {
  const none = new Set<string>()
  it('pay: the job’s own verdict wins, then employer data, then the curated list', () => {
    const walmart = employerSignalsFor('Walmart', none)
    expect(payBadgeFor({ jobVerdictShown: true, signals: walmart })).toBeNull()
    expect(payBadgeFor({ jobVerdictShown: false, signals: walmart })).toBe('known_for_pay')
    expect(payBadgeFor({ jobVerdictShown: false, signals: employerSignalsFor('Walmart', new Set(['walmart'])) })).toBe('employer_above_market')
    expect(payBadgeFor({ jobVerdictShown: false, signals: employerSignalsFor('Nobody Co', none) })).toBeNull()
    expect(payBadgeFor({ jobVerdictShown: false, signals: undefined })).toBeNull()
  })

  it('benefits: the posting’s own strong benefits, then the curated list', () => {
    expect(benefitsBadgeFor({ strongBenefits: true, signals: undefined })).toBe('strong_benefits')
    expect(benefitsBadgeFor({ strongBenefits: false, signals: employerSignalsFor("Trader Joe's", none) })).toBe('known_for_benefits')
    expect(benefitsBadgeFor({ strongBenefits: false, signals: employerSignalsFor('Walmart', none) })).toBeNull()
  })
})
