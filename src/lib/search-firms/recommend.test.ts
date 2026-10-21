import { describe, expect, it } from 'vitest'
import { industryTerms, recommendFirms, type FirmForRecommend } from './recommend'

const firm = (o: Partial<FirmForRecommend>): FirmForRecommend => ({
  id: o.name ?? 'f',
  name: 'Firm',
  website: 'https://firm.example',
  domain: null,
  segment: 'retained',
  liveSearchCount: 1,
  sampleTitles: [],
  teamPageUrl: null,
  orgIndustry: null,
  orgFocus: null,
  ...o,
})

describe('industryTerms', () => {
  it('uses the allowlist only', () => {
    expect(industryTerms(['Higher Education'])).toContain('university')
    expect(industryTerms(['Fractional COO and strategic consulting'])).toEqual([])
  })
})

describe('recommendFirms', () => {
  const firms = [
    firm({ name: 'Finance Search Co', sampleTitles: ['VP Finance', 'Chief Financial Officer', 'Controller'] }),
    firm({ name: 'Junior Finance Staffing', segment: 'contingent', sampleTitles: ['Staff Accountant', 'Accounts Payable Clerk'] }),
    firm({ name: 'Campus Partners', segment: 'nonprofit_higher_ed', sampleTitles: ['Dean of Students'] }),
    firm({ name: 'Code Hunters', sampleTitles: ['Senior Software Engineer'] }),
  ]

  it('matches function at or near the member level, and explains why', () => {
    const r = recommendFirms({ functions: ['Finance'], industries: [], level: 'VP' }, firms)
    expect(r.map((f) => f.name)).toEqual(['Finance Search Co'])
    expect(r[0].why).toMatch(/recent searche?s? in Finance/)
  })

  it('matches nonprofit and higher-ed members to specialist firms', () => {
    const r = recommendFirms({ functions: [], industries: ['Higher Education'], level: 'Director' }, firms)
    expect(r[0].name).toBe('Campus Partners')
    expect(r[0].why).toMatch(/nonprofit and higher-ed/)
  })

  it('returns nothing when nothing fits', () => {
    expect(recommendFirms({ functions: ['Legal'], industries: [], level: null }, firms)).toEqual([])
  })
})
