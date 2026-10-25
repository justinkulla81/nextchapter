import { describe, expect, it } from 'vitest'
import { awardEligibility, bidNote, mostSimilar, sharedWords, winNote } from '@/lib/bids/crm-core'

const NOW = new Date('2026-10-25T12:00:00Z')

describe('awardEligibility', () => {
  it('contracts are open to for-profit bidders, grants go through a partner', () => {
    expect(awardEligibility('CONTRACT').eligibility).toBe('DIRECT')
    expect(awardEligibility('GRANT').eligibility).toBe('VIA_PARTNER')
  })
})

describe('similarity', () => {
  it('counts informative shared words, ignoring filler', () => {
    expect(sharedWords('Career readiness training for dislocated workers', 'AI-powered career readiness workshop services')).toBe(2)
    expect(sharedWords('Request for proposal services program', 'Services for the program contract')).toBe(0)
  })
  it('returns the closest candidates, needing two shared words', () => {
    const c = [
      { id: 'a', text: 'Career readiness workshop for job seekers' },
      { id: 'b', text: 'Snow removal services' },
      { id: 'c', text: 'Career readiness and job seeker training platform' },
    ]
    expect(mostSimilar('Career readiness training for job seekers', c).map((x) => x.id).sort()).toEqual(['a', 'c'])
    expect(mostSimilar('Tax processing', c)).toEqual([])
  })
})

describe('notes', () => {
  it('a win note states size, dates, re-bid date and eligibility', () => {
    const n = winNote({ competitor: 'Fedcap', buyer: 'Department of Labor', kind: 'GRANT', description: 'Workforce grant', amount: 4_000_000, startDate: new Date('2025-07-01'), endDate: new Date('2027-06-30'), url: 'https://www.usaspending.gov/award/X' }, NOW)
    expect(n.body).toContain('Size: $4.0M (grant)')
    expect(n.body).toContain('Started: 2025-07-01')
    expect(n.body).toContain('Likely re-bid around 2027-06-30')
    expect(n.body).toContain('through a partner')
  })
  it('a finished award says it ended', () => {
    const n = winNote({ competitor: 'X', buyer: 'Y', kind: 'CONTRACT', description: null, amount: 900, startDate: null, endDate: new Date('2025-01-01'), url: 'u' }, NOW)
    expect(n.body).toContain('Ended 2025-01-01')
    expect(n.body).toContain('Size: $900')
  })
  it('a bid note carries the deadline and links, and says size is not stated', () => {
    const n = bidNote({ title: 'RFP: Career services platform', boardName: 'Board', state: 'KY', deadline: new Date('2026-11-20T23:59:00Z'), url: 'https://b/x', pageUrl: 'https://b/' })
    expect(n.body).toContain('Due: 2026-11-20')
    expect(n.body).toContain('Size: not stated')
    expect(n.body).toContain("Board's procurement page: https://b/")
  })
})

import { crossRefs } from '@/lib/bids/crm-core'

describe('crossRefs', () => {
  const awards = [{ id: 'a1', description: 'Career readiness workshop for dislocated workers', competitorName: 'Fedcap', amount: 4_000_000, url: 'https://usaspending/x' }]
  const bids = [
    { id: 'b1', title: 'AI career readiness workshop services', boardName: 'South Central', state: 'KY', url: 'https://b/1', deadline: new Date('2026-11-20T23:59:00Z') },
    { id: 'b2', title: 'Snow removal', boardName: 'Other', state: 'MI', url: 'https://b/2', deadline: null },
  ]
  it('links a win to similar open bids with their dates, and each bid back to the win', () => {
    const r = crossRefs(awards, bids, [])
    expect(r.bidsForAward.a1).toHaveLength(1)
    expect(r.bidsForAward.a1[0].detail).toBe('due 2026-11-20')
    expect(r.winsForBid.b1[0].label).toContain('Fedcap')
    expect(r.winsForBid.b2).toBeUndefined()
  })
  it('includes open federal opportunities', () => {
    const r = crossRefs(awards, [], [{ id: 'o1', title: 'Dislocated workers career readiness grant', agency: 'DOL', url: 'https://g/1', closesAt: null }])
    expect(r.bidsForAward.a1[0].detail).toBe('no close date')
  })
})
