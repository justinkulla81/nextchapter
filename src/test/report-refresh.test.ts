import { describe, expect, it } from 'vitest'
import { buildOccupationTrendsFile, type ExposureRow } from '@/lib/market/occupation-trends-build'
import { checkFacts, factCore } from '@/lib/reports/fact-check'

const ROW: ExposureRow = { i: 3, name: 'Computer & math', exp: 75.3, g_emp: 12.37, lts26: 40.97, d_lts: 12.71, n26: 462 }

describe('buildOccupationTrendsFile', () => {
  const file = buildOccupationTrendsFile([ROW], {
    edition: 'October 2026',
    version: '1.8',
    url: 'https://example.test/report',
    csrEmployment: { y2025: 2653, y2026: 2447 },
    csrMarginThousands: 111,
  })
  it('writes one typed row per group with rounded values and the right SOC code', () => {
    expect(file).toContain(
      "{ socGroup: '15', name: 'Computer & math', aiExposure: 75.3, employmentChangePct: 12.4, longSearchSharePct: 41.0, longSearchChangePts: 12.7, respondents: 462 },"
    )
  })
  it('carries the edition, version and customer service change', () => {
    expect(file).toContain("edition: 'October 2026'")
    expect(file).toContain("version: '1.8'")
    expect(file).toContain('employmentChangePct2025to2026: -7.8')
    expect(file).toContain('employmentChangeThousands: -206')
    expect(file).toContain('marginThousands: 111')
  })
  it('refuses a row it cannot place', () => {
    expect(() => buildOccupationTrendsFile([{ ...ROW, i: 99 }], { edition: 'x', version: '1', url: 'u', csrEmployment: { y2025: 1, y2026: 1 }, csrMarginThousands: 1 })).toThrow()
  })
})

describe('fact check', () => {
  it('reduces displayed values to their searchable core', () => {
    expect(factCore('$1.396B')).toBe('1.396')
    expect(factCore('~546,000')).toBe('546,000')
    expect(factCore('+1.5 pts')).toBe('1.5')
    expect(factCore('0.88%')).toBe('0.88')
    expect(factCore('about a third')).toBeNull()
  })
  it('separates found, missing and non-numeric figures', () => {
    const text = 'Participants served 187,108 and white-collar long searches 0.75% of the labor force.'
    const r = checkFacts(
      [
        { source: 'a', label: 'served', value: '187,108' },
        { source: 'b', label: 'rate', value: '0.75%' },
        { source: 'c', label: 'old', value: '0.56%' },
        { source: 'd', label: 'words', value: 'about a third' },
      ],
      text
    )
    expect(r.found.map((f) => f.source)).toEqual(['a', 'b'])
    expect(r.missing.map((f) => f.source)).toEqual(['c'])
    expect(r.unchecked.map((f) => f.source)).toEqual(['d'])
  })
})
