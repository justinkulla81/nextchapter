import { describe, expect, it } from 'vitest'
import { awardUrl, matchAwards, matchRecipient, searchNames, type RawAward } from '@/lib/bids/awards'

const award = (recipient: string, amount = 1000, id: string | null = 'CONT_AWD_X'): RawAward => ({
  generatedId: id, awardId: 'X', recipient, amount, agency: 'Department of Labor', subAgency: 'ETA', description: 'd', startDate: '2025-01-01', endDate: null,
})

describe('searchNames', () => {
  it('splits slashes and keeps former names, drops domains', () => {
    expect(searchNames('Challenger, Gray & Christmas, Inc.')).toContain('Challenger, Gray & Christmas, Inc.')
    expect(searchNames('Jewish Vocational Service (JVS) / JVS Career')).toEqual(expect.arrayContaining(['JVS Career']))
    expect(searchNames('Horsefly Analytics (horsefly.app)')).toEqual(['Horsefly Analytics'])
    expect(searchNames('Drake Beam Morin (now Lee Hecht Harrison)')).toContain('Lee Hecht Harrison')
    expect(searchNames('LHH')).toContain('Lee Hecht Harrison')
  })
})

describe('matchRecipient', () => {
  it('trusts an exact multi-word name', () => {
    expect(matchRecipient('Geographic Solutions', 'GEOGRAPHIC SOLUTIONS, INC.')).toBe('EXACT')
    expect(matchRecipient('Jobs for the Future', 'JOBS FOR THE FUTURE INC')).toBe('EXACT')
  })
  it('sends a one-word common name to review', () => {
    expect(matchRecipient('Pivot', 'PIVOT LLC')).toBe('REVIEW')
  })
  it('trusts a distinctive one-word name, with or without a generic suffix; reviews a common one', () => {
    expect(matchRecipient('Maximus', 'MAXIMUS')).toBe('EXACT')
    expect(matchRecipient('Maximus', 'MAXIMUS US SERVICES, INC.')).toBe('EXACT')
    expect(matchRecipient('Pivot', 'PIVOT SERVICES')).toBe('REVIEW')
  })
  it('rejects a different company that merely starts the same', () => {
    expect(matchRecipient('Maximus', 'MAXIMUS PLUMBING SUPPLY')).toBeNull()
    expect(matchRecipient('Gem', 'GEMSTONE HOLDINGS')).toBeNull()
  })
})

describe('matchAwards', () => {
  it('keeps matches with value and an id, best confidence wins', () => {
    const out = matchAwards('Fedcap', 'GRANT', [award('FEDCAP'), award('SOMEONE ELSE'), award('FEDCAP', 0), award('FEDCAP', 5, null)])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ confidence: 'EXACT', kind: 'GRANT', competitorName: 'Fedcap' })
  })
  it('builds a USAspending link', () => {
    expect(awardUrl('CONT_AWD_W91_9700_-NONE-_-NONE-')).toBe('https://www.usaspending.gov/award/CONT_AWD_W91_9700_-NONE-_-NONE-')
  })
})
