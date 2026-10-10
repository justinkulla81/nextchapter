import { describe, expect, it } from 'vitest'
import { contactRank, coreKey, domainOf, firmKey, matchFirmToOrgs, segmentFor } from './match'

const org = (id: string, name: string, website: string | null = null, emailDomain: string | null = null) => ({ id, name, website, emailDomain })

describe('domainOf', () => {
  it('strips scheme, www and path', () => {
    expect(domainOf('https://www.imsearch.com/about')).toBe('imsearch.com')
    expect(domainOf('kirbybates.com')).toBe('kirbybates.com')
    expect(domainOf(null)).toBeNull()
    expect(domainOf('localhost')).toBeNull()
  })
})

describe('firm keys', () => {
  it('drops taglines and generic words', () => {
    expect(firmKey('Bridge Partners - Executive Search')).toBe(firmKey('Bridge Partners'))
    expect(firmKey('The Barton Partnership | B Corp™')).toBe(firmKey('The Barton Partnership'))
    expect(coreKey('Caldwell Partners')).toBe('caldwell')
  })
})

describe('matchFirmToOrgs', () => {
  it('matches the same name, ignoring legal suffixes and "The"', () => {
    expect(matchFirmToOrgs({ name: 'ZRG Partners' }, [org('a', 'ZRG Partners, LLC')])).toEqual({ kind: 'matched', orgId: 'a', basis: 'name' })
    expect(matchFirmToOrgs({ name: 'Oxbridge Group' }, [org('a', 'The Oxbridge Group')])).toMatchObject({ kind: 'matched', orgId: 'a' })
  })

  it('matches the same domain', () => {
    const m = matchFirmToOrgs({ name: 'IM', website: 'https://www.imsearch.com' }, [org('a', 'Isaacson Miller Inc', 'http://imsearch.com')])
    expect(m).toEqual({ kind: 'matched', orgId: 'a', basis: 'domain' })
    expect(matchFirmToOrgs({ name: 'X', domain: 'kbic.com' }, [org('b', 'KBIC', null, 'kbic.com')])).toMatchObject({ kind: 'matched', orgId: 'b' })
  })

  it('sends near-names to review instead of merging', () => {
    expect(matchFirmToOrgs({ name: 'Bridge Partners' }, [org('a', 'Bridge Partners - Executive Search')]).kind).toBe('review')
    expect(matchFirmToOrgs({ name: 'Caldwell Partners' }, [org('a', 'Caldwell')]).kind).toBe('review')
    expect(matchFirmToOrgs({ name: 'Odgers Berndtson' }, [org('a', 'Odgers')]).kind).toBe('review')
  })

  it('prefers an exact match over a near one', () => {
    expect(matchFirmToOrgs({ name: 'Boyden' }, [org('x', 'Boyden Global Executive Search'), org('y', 'Boyden')])).toMatchObject({ kind: 'matched', orgId: 'y' })
  })

  it('does not suggest a match on a short or common word', () => {
    expect(matchFirmToOrgs({ name: 'True Platform' }, [org('a', 'True')]).kind).toBe('none')
    expect(matchFirmToOrgs({ name: 'Smith & Wilkinson' }, [org('a', 'Smith Inc.')]).kind).toBe('none')
    expect(matchFirmToOrgs({ name: 'Morgan Consulting Resources' }, [org('a', 'Morgan Stanley')]).kind).toBe('none')
    expect(matchFirmToOrgs({ name: 'Charles Aris' }, [org('a', 'Charles Schwab')]).kind).toBe('none')
  })
})

describe('segmentFor', () => {
  it('uses known firms, then the name or hint', () => {
    expect(segmentFor('sf:isaacsonmiller', 'Isaacson, Miller')).toBe('nonprofit_higher_ed')
    expect(segmentFor('sf:mrinetwork', 'MRINetwork')).toBe('contingent')
    expect(segmentFor('csv:x', 'Academic Leaders Search')).toBe('nonprofit_higher_ed')
    expect(segmentFor('csv:y', 'Acme', 'contingency staffing')).toBe('contingent')
    expect(segmentFor('csv:z', 'Acme Partners')).toBe('retained')
  })
})

describe('contactRank', () => {
  it('puts decision makers first and drops non-search roles', () => {
    expect(contactRank('Managing Partner')).toBe(0)
    expect(contactRank('Managing Director, Financial Services')).toBe(1)
    expect(contactRank('Partner')).toBe(2)
    expect(contactRank('Director of Research')).toBe(3)
    expect(contactRank('Senior Recruiter')).toBe(4)
    expect(contactRank('Office Manager')).toBe(-1)
    expect(contactRank(null)).toBe(-1)
  })
})
