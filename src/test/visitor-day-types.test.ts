import { describe, expect, it } from 'vitest'
import { decideVisitorType, visitorTypeSeries } from '@/lib/admin/visitor-day-types'

describe('decideVisitorType', () => {
  it('prefers the CRM type, then an account, then the landing page', () => {
    expect(decideVisitorType({ firstPath: '/press', crmType: 'Workforce', hasAccount: true })).toEqual({ userType: 'Workforce', basis: 'CRM' })
    expect(decideVisitorType({ firstPath: '/press', crmType: null, hasAccount: true })).toEqual({ userType: 'Candidate', basis: 'account' })
    expect(decideVisitorType({ firstPath: '/press', crmType: null, hasAccount: false })).toEqual({ userType: 'Journalist', basis: 'landing page' })
    expect(decideVisitorType({ firstPath: '/', crmType: null, hasAccount: false })).toEqual({ userType: 'Unknown', basis: 'none' })
  })
})

describe('visitorTypeSeries', () => {
  it('builds a daily series per type, largest first, with zeros for quiet days', () => {
    const now = new Date('2026-11-11T17:00:00Z')
    const out = visitorTypeSeries(
      [
        { day: '2026-11-10', userType: 'Workforce', visitors: 3 },
        { day: '2026-11-11', userType: 'Workforce', visitors: 2 },
        { day: '2026-11-11', userType: 'Candidate', visitors: 9 },
      ],
      now,
      7
    )
    expect(out.map((t) => t.userType)).toEqual(['Candidate', 'Workforce'])
    expect(out[1].series['7d'].slice(-2)).toEqual([{ key: '2026-11-10', count: 3 }, { key: '2026-11-11', count: 2 }])
    expect(out[0].series['7d'][0].count).toBe(0)
  })
})
