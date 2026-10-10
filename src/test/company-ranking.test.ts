import { describe, it, expect } from 'vitest'
import {
  scoreCompany,
  rankCompanies,
  industriesOverlap,
  type RankingCandidate,
  type RankingCompany,
  type NamedPosting,
} from '@/lib/companies/company-ranking'

const candidate: RankingCandidate = {
  primaryFunction: 'Finance',
  secondaryFunction: 'Operations',
  highestLevelReached: 'Director',
  levelRankScore: 55,
  metroArea: 'Boston Metro',
  openToRelocation: false,
  remotePreference: 'hybrid',
  industries: ['Healthcare'],
  targetCompanySize: '50-500',
  localStress: 0,
}

function posting(over: Partial<NamedPosting> = {}): NamedPosting {
  return {
    title: 'Director of Finance',
    function: 'Finance',
    level: 'Director',
    metro: 'Boston Metro',
    isRemote: false,
    isRecruiterMandate: false,
    ...over,
  }
}

function company(over: Partial<RankingCompany> = {}): RankingCompany {
  return {
    id: 'c1',
    name: 'Acme Health',
    canonicalNameNormalized: 'acme health',
    industry: 'Healthcare',
    sizeBand: 'SMALL_MID',
    hqMetro: null,
    trajectory: 'growing',
    postings: [posting()],
    signalOpenRoles: null,
    latestPostingAt: null,
    reach: { recruiters: 0, hiringManagers: 0 },
    industryYoyPct: null,
    hiddenPostings: 0,
    warn: null,
    myContactCount: 0,
    memberFormerCount: 0,
    memberSameFunctionCount: 0,
    onWatchlist: false,
    ...over,
  }
}

describe('scoreCompany', () => {
  it('scores a local, growing, in-industry company hiring your exact role as a strong fit', () => {
    const r = scoreCompany(company(), candidate)
    expect(r.band).toBe('strong')
    expect(r.score).toBeGreaterThanOrEqual(75)
    expect(r.reasons.length).toBeGreaterThan(0)
    expect(r.cautions).toEqual([])
  })

  it('never exceeds 100 or drops below 0', () => {
    const maxed = scoreCompany(company({ myContactCount: 9, memberFormerCount: 9 }), candidate)
    expect(maxed.score).toBeLessThanOrEqual(100)
    const worst = scoreCompany(
      company({ trajectory: 'contracting', postings: [], industry: 'Mining', sizeBand: 'MEGA', warn: { filings12mo: 4, employeesAffected: 90000, daysSinceMostRecent: 5 } }),
      candidate
    )
    expect(worst.score).toBeGreaterThanOrEqual(0)
  })

  it('weights a local company above an otherwise identical non-local one', () => {
    const local = scoreCompany(company(), candidate)
    const far = scoreCompany(company({ postings: [posting({ metro: 'Seattle Metro' })] }), candidate)
    expect(local.score).toBeGreaterThan(far.score)
    expect(local.reasons.join(' ')).toMatch(/Local/)
  })

  it('credits remote roles to a candidate open to hybrid/remote, but less than local', () => {
    const remote = scoreCompany(company({ postings: [posting({ metro: null, isRemote: true })] }), candidate)
    const local = scoreCompany(company(), candidate)
    const far = scoreCompany(company({ postings: [posting({ metro: 'Seattle Metro' })] }), candidate)
    expect(remote.score).toBeLessThan(local.score)
    expect(remote.score).toBeGreaterThan(far.score)
  })

  it('penalises a recent layoff notice and surfaces it as a caution, more when it is a larger share of the company', () => {
    const none = scoreCompany(company(), candidate)
    const small = scoreCompany(company({ warn: { filings12mo: 1, employeesAffected: 5, daysSinceMostRecent: 20 } }), candidate)
    const big = scoreCompany(company({ warn: { filings12mo: 1, employeesAffected: 100, daysSinceMostRecent: 20 } }), candidate)
    expect(small.score).toBeLessThan(none.score)
    expect(big.score).toBeLessThan(small.score)
    expect(big.cautions.join(' ')).toMatch(/Layoff notice/)
  })

  it('decays the layoff penalty as the notice ages', () => {
    const fresh = scoreCompany(company({ warn: { filings12mo: 1, employeesAffected: 20, daysSinceMostRecent: 10 } }), candidate)
    const old = scoreCompany(company({ warn: { filings12mo: 1, employeesAffected: 20, daysSinceMostRecent: 300 } }), candidate)
    expect(old.score).toBeGreaterThan(fresh.score)
  })

  it('flags overhire risk for a senior candidate at a very small company, and not at a larger one', () => {
    const exec: RankingCandidate = { ...candidate, highestLevelReached: 'C-Suite', levelRankScore: 85, targetCompanySize: 'Any' }
    const tiny = scoreCompany(company({ sizeBand: 'MICRO', postings: [posting({ title: 'Finance Manager', level: 'Manager' })] }), exec)
    const large = scoreCompany(company({ sizeBand: 'LARGE', postings: [posting({ title: 'Chief Financial Officer', level: 'C-Suite' })] }), exec)
    expect(tiny.cautions.join(' ')).toMatch(/overqualified/)
    expect(large.cautions.join(' ')).not.toMatch(/overqualified/)
  })

  it('treats unknown industry and size as neutral, with no reason text for them', () => {
    const r = scoreCompany(company({ industry: null, sizeBand: null }), candidate)
    expect(r.components.find((c) => c.key === 'industry')!.reason).toBeNull()
    expect(r.components.find((c) => c.key === 'size')!.reason).toBeNull()
    expect(r.components.find((c) => c.key === 'industry')!.points).toBeGreaterThan(0)
  })

  it('rewards people you know there and NC members who worked there', () => {
    const base = scoreCompany(company(), candidate)
    const withContacts = scoreCompany(company({ myContactCount: 3 }), candidate)
    expect(withContacts.score).toBeGreaterThan(base.score)
    expect(withContacts.reasons.join(' ')).toMatch(/You know 3 people here/)
  })

  it('names a public recruiter mandate as a reason', () => {
    const r = scoreCompany(company({ postings: [posting({ isRecruiterMandate: true })] }), candidate)
    expect(r.reasons.join(' ')).toMatch(/Recruiter-led search/)
  })
})

describe('hidden (confidential / locked) postings', () => {
  const noPostings: Partial<RankingCompany> = { postings: [], trajectory: null }

  it('add a small boost but never produce reason or caution text', () => {
    const without = scoreCompany(company({ ...noPostings }), candidate)
    const withHidden = scoreCompany(company({ ...noPostings, hiddenPostings: 3 }), candidate)
    expect(withHidden.score).toBeGreaterThan(without.score)
    expect(withHidden.reasons).toEqual(without.reasons)
    expect(withHidden.cautions).toEqual(without.cautions)
    expect(withHidden.components.every((c) => !c.reason?.match(/recruiter|confidential|search/i))).toBe(true)
  })

  it('are capped so one confidential search cannot lift a company far', () => {
    const one = scoreCompany(company({ ...noPostings, hiddenPostings: 1 }), candidate)
    const many = scoreCompany(company({ ...noPostings, hiddenPostings: 50 }), candidate)
    const without = scoreCompany(company({ ...noPostings }), candidate)
    expect(one.score - without.score).toBeLessThanOrEqual(2)
    expect(many.score - without.score).toBeLessThanOrEqual(4)
  })

  it('do not by themselves mark a company as having named hiring', () => {
    const r = scoreCompany(company({ ...noPostings, hiddenPostings: 2 }), candidate)
    expect(r.components.find((c) => c.key === 'gap')!.points).toBe(0)
  })
})

describe('rankCompanies', () => {
  it('orders by score, then by having real hiring data, then A–Z', () => {
    const a = company({ id: 'a', name: 'Zeta Hospital' })
    const b = company({ id: 'b', name: 'Alpha Hospital' })
    const weak = company({ id: 'w', name: 'Weak Co', postings: [], trajectory: null, industry: 'Mining' })
    const ranked = rankCompanies([weak, a, b], candidate)
    expect(ranked.map((r) => r.company.id)).toEqual(['b', 'a', 'w'])
  })
})

describe('industriesOverlap', () => {
  it('matches containment and shared meaningful tokens, not unrelated industries', () => {
    expect(industriesOverlap('Healthcare', 'Healthcare services')).toBe(true)
    expect(industriesOverlap('Financial Services', 'Financial technology')).toBe(true)
    expect(industriesOverlap('Healthcare', 'Mining')).toBe(false)
    expect(industriesOverlap('', 'Mining')).toBe(false)
  })
})

describe('signal open-role count', () => {
  it('separates companies for a member who can see no postings by name', () => {
    const locked = { postings: [], trajectory: 'growing' as const }
    const busy = scoreCompany(company({ ...locked, signalOpenRoles: 40 }), candidate)
    const quiet = scoreCompany(company({ ...locked, signalOpenRoles: 1 }), candidate)
    expect(busy.score).toBeGreaterThan(quiet.score)
  })

  it('does not double-count hidden postings when a fresh signal already includes them', () => {
    const base = { postings: [], trajectory: 'flat' as const, signalOpenRoles: 5 }
    expect(scoreCompany(company({ ...base, hiddenPostings: 3 }), candidate).score).toBe(
      scoreCompany(company({ ...base, hiddenPostings: 0 }), candidate).score
    )
  })
})

describe('industriesOverlap spacing', () => {
  it('treats "Health care" and "Healthcare" as the same industry', () => {
    expect(industriesOverlap('Health Care and Social Assistance', 'Healthcare')).toBe(true)
  })
})

describe('market adjustments', () => {
  it('nudges a company up when its industry is adding jobs and down when it is shedding them, by at most 3', () => {
    const base = scoreCompany(company(), candidate).score
    const up = scoreCompany(company({ industryYoyPct: 4 }), candidate)
    const down = scoreCompany(company({ industryYoyPct: -4 }), candidate)
    expect(up.score - base).toBeLessThanOrEqual(3)
    expect(up.score).toBeGreaterThan(base)
    expect(base - down.score).toBeLessThanOrEqual(3)
    expect(down.score).toBeLessThan(base)
    expect(down.cautions.join(' ')).toMatch(/shedding jobs/)
  })

  it('stays silent on a negligible industry move', () => {
    const r = scoreCompany(company({ industryYoyPct: 0.3 }), candidate)
    expect(r.adjustments).toEqual([])
  })

  it('treats an unknown industry trend as no trend, not flat', () => {
    expect(scoreCompany(company({ industryYoyPct: null }), candidate).adjustments).toEqual([])
  })

  it('lowers only local companies when the local market is strained, up to 2 points', () => {
    const strained: RankingCandidate = { ...candidate, localStress: 2 }
    const calm = scoreCompany(company(), candidate)
    const local = scoreCompany(company(), strained)
    const far = scoreCompany(company({ postings: [posting({ metro: 'Seattle Metro' })] }), strained)
    const farCalm = scoreCompany(company({ postings: [posting({ metro: 'Seattle Metro' })] }), candidate)
    expect(calm.score - local.score).toBe(2)
    expect(far.score).toBe(farCalm.score)
    expect(local.cautions.join(' ')).toMatch(/local job market is under strain/)
  })
})

describe('reach: people the member already knows', () => {
  it('lifts a company where the member knows the likely hiring manager far above one that only fits on paper', () => {
    const cold = scoreCompany(company(), candidate)
    const warm = scoreCompany(company({ reach: { recruiters: 0, hiringManagers: 1 } }), candidate)
    expect(warm.score - cold.score).toBe(12)
    expect(warm.reasons[0]).toMatch(/likely hiring manager/)
  })

  it('values a recruiter less than the hiring manager, and both most', () => {
    const rec = scoreCompany(company({ reach: { recruiters: 2, hiringManagers: 0 } }), candidate)
    const hm = scoreCompany(company({ reach: { recruiters: 0, hiringManagers: 1 } }), candidate)
    const both = scoreCompany(company({ reach: { recruiters: 1, hiringManagers: 1 } }), candidate)
    expect(rec.score).toBeLessThan(hm.score)
    expect(hm.score).toBeLessThan(both.score)
    expect(rec.reasons[0]).toBe('You know 2 recruiters here')
  })

  it('does nothing when the member knows no one', () => {
    expect(scoreCompany(company(), candidate).adjustments.find((a) => a.key === 'reach')).toBeUndefined()
  })
})

