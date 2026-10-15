import { describe, expect, it } from 'vitest'
import { aggregateMarketRows, bandForRow, rolesForTitle, MIN_PAY_SAMPLE, type MarketInputRow } from './market-stats'

const NOW = new Date('2026-10-14T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000)

let n = 0
function row(o: Partial<MarketInputRow> = {}): MarketInputRow {
  return {
    id: `r${n++}`,
    title: 'Account Executive',
    companyName: 'Acme',
    location: 'Louisville, KY',
    level: 'SENIOR_IC',
    sourceCategory: null,
    sourceCount: 1,
    postedAt: daysAgo(3),
    createdAt: daysAgo(3),
    salaryMin: null,
    salaryMax: null,
    archivedAt: null,
    ...o,
  }
}

const find = (rows: ReturnType<typeof aggregateMarketRows>, role: string, geo: string, band: string) =>
  rows.find((r) => r.roleKey === role && r.geo === geo && r.band === band)

describe('bandForRow', () => {
  it('maps board rungs and falls back to the title', () => {
    expect(bandForRow('MID_IC', 'Analyst')).toBe('IC')
    expect(bandForRow('SR_MANAGER', 'x')).toBe('MANAGER')
    expect(bandForRow('HEAD', 'x')).toBe('DIRECTOR')
    expect(bandForRow('C_SUITE', 'x')).toBe('EXEC')
    expect(bandForRow(null, 'Director of Sales')).toBe('DIRECTOR')
    expect(bandForRow(null, 'Account Executive')).toBe('IC')
  })
})

describe('rolesForTitle', () => {
  it('finds every pivot role a title belongs to', () => {
    expect(rolesForTitle('Enterprise Account Executive')).toContain('account_executive')
    expect(rolesForTitle('HRIS Analyst')).toContain('hris')
    expect(rolesForTitle('Line Cook')).toEqual([])
  })
})

describe('aggregateMarketRows', () => {
  it('counts open roles by role, state, remote and the nation, plus all-jobs totals', () => {
    const out = aggregateMarketRows(
      [row(), row({ location: 'Remote, US' }), row({ title: 'Line Cook', location: 'Chicago, IL' }), row({ location: 'London, UK' })],
      NOW
    )
    expect(find(out, 'account_executive', 'US', 'IC')!.openNow).toBe(2)
    expect(find(out, 'account_executive', 'KY', 'IC')!.openNow).toBe(1)
    expect(find(out, 'account_executive', 'REMOTE', 'IC')!.openNow).toBe(1)
    expect(find(out, '*', 'US', 'IC')!.openNow).toBe(3) // the non-US job is left out
    expect(find(out, '*', 'IL', 'IC')!.openNow).toBe(1)
    expect(find(out, 'account_executive', 'IL', 'IC')).toBeUndefined()
  })

  it('puts postings in the 30/90-day windows by posted date, including archived ones', () => {
    const out = aggregateMarketRows(
      [
        row({ postedAt: daysAgo(10) }),
        row({ postedAt: daysAgo(45), archivedAt: daysAgo(5) }),
        row({ postedAt: null, createdAt: daysAgo(120), archivedAt: daysAgo(30) }),
        row({ postedAt: daysAgo(200), archivedAt: daysAgo(100) }),
      ],
      NOW
    )
    const us = find(out, 'account_executive', 'US', 'IC')!
    expect(us.openNow).toBe(1)
    expect(us.new30).toBe(1)
    expect(us.prior30).toBe(1)
    expect(us.new90).toBe(2)
    expect(us.prior90).toBe(1)
  })

  it('stores median posted pay only with enough salaries, annualizing hourly pay', () => {
    const few = aggregateMarketRows([row({ salaryMin: 90_000, salaryMax: 110_000 })], NOW)
    expect(find(few, 'account_executive', 'US', 'IC')!.payP50).toBeNull()
    expect(find(few, 'account_executive', 'US', 'IC')!.paySample).toBe(1)
    const many = aggregateMarketRows(
      Array.from({ length: MIN_PAY_SAMPLE }, (_, i) => (i === 0 ? row({ salaryMin: 50, salaryMax: 50 }) : row({ salaryMin: 100_000, salaryMax: 120_000 }))),
      NOW
    )
    expect(find(many, 'account_executive', 'US', 'IC')!.payP50).toBe(110_000)
  })

  it('counts low-competition open roles with the board’s competition score', () => {
    const out = aggregateMarketRows([row({ sourceCategory: 'search_firm' }), row({ sourceCategory: 'aggregator', location: 'Remote' })], NOW)
    expect(find(out, 'account_executive', 'US', 'IC')!.lowCompetitionOpen).toBe(1)
  })

  it('handles an empty board', () => {
    expect(aggregateMarketRows([], NOW)).toEqual([])
  })
})
