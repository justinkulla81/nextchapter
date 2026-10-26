import { describe, expect, it } from 'vitest'
import {
  SEARCH_FIRM_MIN_PUBLIC_ROLES, firmKind, isSearchFirmIndexable, specialties, summarizeSearches, yearlyRange, type SearchRow,
} from '@/lib/seo/search-firm-bar'
import { planSearchFirmPings } from '@/lib/syndication/search-firm-ping'
import { isSearchFirmOrg, searchFirmPublicPath } from '@/lib/seo/search-firm-link'

const NOW = Date.parse('2026-10-25T00:00:00Z')
const row = (o: Partial<SearchRow> = {}): SearchRow => ({
  id: 'x', title: 'CFO', level: 'C_SUITE', fn: 'Finance', industry: 'healthcare', location: 'Boston, MA', state: 'MA', workArrangement: null,
  salaryMin: null, salaryMax: null, payPeriod: null, entryPhrase: false, aiSkill: false, openSince: new Date(NOW - 10 * 86_400_000), ...o,
})

describe('page bar', () => {
  it('is indexable at the minimum number of public roles and not below', () => {
    expect(isSearchFirmIndexable(SEARCH_FIRM_MIN_PUBLIC_ROLES - 1)).toBe(false)
    expect(isSearchFirmIndexable(SEARCH_FIRM_MIN_PUBLIC_ROLES)).toBe(true)
    expect(isSearchFirmIndexable(0)).toBe(false)
  })
})

describe('firmKind', () => {
  it('prefers the search-firm segment, then staffing, then outplacement', () => {
    expect(firmKind({ segment: 'contingent', staffing: true, orgTypes: [] })).toBe('contingent')
    expect(firmKind({ segment: null, staffing: true, orgTypes: ['SEARCH_FIRM'] })).toBe('staffing')
    expect(firmKind({ segment: null, staffing: false, orgTypes: ['OUTPLACEMENT_FIRM'] })).toBe('outplacement')
    expect(firmKind({ segment: null, staffing: false, orgTypes: ['SEARCH_FIRM', 'OUTPLACEMENT_FIRM'] })).toBe('search')
  })
})

describe('summarizeSearches', () => {
  const rows = [
    row({ id: 'a', level: 'ENTRY_IC', salaryMin: 60_000, salaryMax: 80_000, payPeriod: 'year', aiSkill: true }),
    row({ id: 'b', fn: 'Finance', entryPhrase: true, salaryMin: 100_000, salaryMax: 120_000, payPeriod: 'year', workArrangement: 'remote', openSince: new Date(NOW - 30 * 86_400_000) }),
    row({ id: 'c', fn: 'Legal', industry: 'financial_services', state: 'NY', salaryMin: 40, salaryMax: 60, payPeriod: 'hour' }),
  ]
  const s = summarizeSearches(rows, NOW)
  it('counts roles, entry-level, AI, remote and pay', () => {
    expect(s.publicRoles).toBe(3)
    expect(s.entryLevel).toBe(2)
    expect(s.aiSkill).toBe(1)
    expect(s.remote).toBe(1)
    expect(s.withPay).toBe(2)
  })
  it('reports how long searches have been open', () => {
    expect(s.medianDaysOpen).toBe(10)
    expect(s.oldestDaysOpen).toBe(30)
  })
  it('ranks functions and states and infers specialties', () => {
    expect(s.functions[0]).toEqual({ label: 'Finance', count: 2 })
    expect(s.states[0]).toEqual({ state: 'MA', count: 2 })
    expect(specialties(s)).toContain('Finance')
  })
  it('needs three posted ranges before it states a median pay', () => {
    expect(s.medianPay).toBeNull()
  })
  it('handles an empty list', () => {
    const e = summarizeSearches([], NOW)
    expect(e.publicRoles).toBe(0)
    expect(e.medianDaysOpen).toBeNull()
    expect(specialties(e)).toEqual([])
  })
})

describe('yearlyRange', () => {
  it('drops hourly, implausible and inverted ranges', () => {
    expect(yearlyRange({ salaryMin: 50_000, salaryMax: 70_000, payPeriod: null })).toEqual([50_000, 70_000])
    expect(yearlyRange({ salaryMin: 20, salaryMax: 30, payPeriod: 'hour' })).toBeNull()
    expect(yearlyRange({ salaryMin: 90_000, salaryMax: 70_000, payPeriod: 'year' })).toBeNull()
    expect(yearlyRange({ salaryMin: 5_000, salaryMax: 7_000, payPeriod: 'year' })).toBeNull()
  })
})

describe('IndexNow plan', () => {
  it('sends new and changed pages, and pages that left the list', () => {
    const announced = new Set(['a@2026-10-24', 'b@2026-10-24', 'gone@2026-10-20'])
    const plan = planSearchFirmPings([{ slug: 'a', lastVerifiedAt: '2026-10-24T05:00:00Z' }, { slug: 'b', lastVerifiedAt: '2026-10-25T05:00:00Z' }, { slug: 'c', lastVerifiedAt: '2026-10-25T05:00:00Z' }], announced)
    expect(plan.send.sort()).toEqual(['b', 'c'])
    expect(plan.removed).toEqual(['gone'])
    expect(plan.next.has('c@2026-10-25')).toBe(true)
  })
  it('sends nothing on a rerun', () => {
    const f = [{ slug: 'a', lastVerifiedAt: '2026-10-24T05:00:00Z' }]
    const plan = planSearchFirmPings(f, planSearchFirmPings(f, new Set()).next)
    expect(plan.send).toEqual([])
    expect(plan.removed).toEqual([])
  })
})

describe('CRM public page link', () => {
  it('links search firms, staffing companies and outplacement firms, and nobody else', () => {
    const base = { canonicalNameNormalized: 'acme search', orgTypes: [] as string[], hasSearchFirm: false, companyIndustry: null as string | null }
    expect(searchFirmPublicPath({ ...base, hasSearchFirm: true })).toBe('/search-firms/acme-search')
    expect(searchFirmPublicPath({ ...base, orgTypes: ['OUTPLACEMENT_FIRM'] })).toBe('/search-firms/acme-search')
    expect(searchFirmPublicPath({ ...base, companyIndustry: 'Staffing & Human Capital' })).toBe('/search-firms/acme-search')
    expect(searchFirmPublicPath({ ...base, orgTypes: ['EMPLOYER'] })).toBeNull()
    expect(isSearchFirmOrg(base)).toBe(false)
  })
})
