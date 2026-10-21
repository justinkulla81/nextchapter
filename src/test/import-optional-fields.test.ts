import { describe, expect, it } from 'vitest'
import { importOptionalFields, importSpecFields, importToken } from '@/lib/jobs/import-optional-fields'

describe('import optional one-board fields', () => {
  it('returns only the fields the sender included', () => {
    expect(importOptionalFields({})).toEqual({})
    expect(importOptionalFields({ employmentType: 'Full-Time', payPeriod: 'hour' })).toEqual({ employmentType: 'full_time', payPeriod: 'hour' })
    expect(importOptionalFields({ workArrangement: null })).toEqual({ workArrangement: null })
  })
  it('drops junk values', () => {
    expect(importToken('<script>')).toBeNull()
    expect(importToken(42)).toBeNull()
    expect(importToken('equity_only')).toBe('equity_only')
  })
})

describe('importSpecFields', () => {
  const codes = new Set(['CA', 'TX', 'NY', 'WA'])
  const statesOf = (l: string) => [...l.matchAll(/\b([A-Z]{2})\b/g)].map((m) => m[1]).filter((s) => codes.has(s))

  it('returns nothing for a sender that does not send the fields', () => {
    expect(importSpecFields({}, statesOf, codes)).toEqual({})
  })

  it('keeps clean location parts and every listed US state, primary first', () => {
    expect(
      importSpecFields(
        { locationCity: 'San Jose', locationState: 'ca', locationCountry: 'us', locations: ['Austin, TX', 'San Jose, CA', 'Toronto, ON'] },
        statesOf,
        codes
      )
    ).toEqual({ locationCity: 'San Jose', locationState: 'CA', locationCountry: 'US', locationStates: ['CA', 'TX'] })
  })

  it("uses the crawler's resolved state list instead of re-reading the locations", () => {
    expect(
      importSpecFields(
        { locationState: 'NY', locations: ['Delaware, OH', 'Seattle, San Francisco, New York'], locationStatesList: ['NY', 'WA', 'CA', 'ZZ', 'WA'] },
        statesOf,
        codes
      ).locationStates
    ).toEqual(['NY', 'WA', 'CA'])
    // A remote-only posting: no primary, the empty list is kept (not re-read from text).
    expect(importSpecFields({ locationState: null, locations: ['Remote'], locationStatesList: [] }, statesOf, codes).locationStates).toEqual([])
  })

  it('drops a junk city, a non-US state and a malformed country', () => {
    expect(importSpecFields({ locationCity: 'TUCSON-805 ~ 1151 E Hermans Rd', locationState: 'AZ1', locationCountry: 'USA' }, statesOf, codes)).toEqual({
      locationCity: null,
      locationState: null,
      locationCountry: null,
      locationStates: [],
    })
    expect(importSpecFields({ locationCity: '(United States', locationState: 'TX' }, statesOf, codes).locationCity).toBeNull()
  })

  it('stores ids and keys as bounded text', () => {
    const out = importSpecFields({ externalJobId: 12345, requisitionId: ' R-1 ', repostKey: 'a'.repeat(100), descHash: '' }, statesOf, codes)
    expect(out).toEqual({ externalJobId: '12345', requisitionId: 'R-1', repostKey: 'a'.repeat(64), descHash: null })
  })

  it('keeps a crawler fingerprint only when it is 24 lowercase hex chars', () => {
    expect(importSpecFields({ crawlerFingerprint: ' 0123456789abcdef01234567 ' }, statesOf, codes)).toEqual({ crawlerFingerprint: '0123456789abcdef01234567' })
    expect(importSpecFields({ crawlerFingerprint: 'not-a-fingerprint' }, statesOf, codes)).toEqual({ crawlerFingerprint: null })
    expect(importSpecFields({ crawlerFingerprint: '' }, statesOf, codes)).toEqual({ crawlerFingerprint: null })
    expect(importSpecFields({}, statesOf, codes)).toEqual({})
  })
})

describe('importSpecFields: O*NET-SOC occupation', () => {
  const codes = new Set<string>()
  it('keeps a well-formed SOC code and its title, drops a malformed one', () => {
    expect(importSpecFields({ socCode: '13-2051.00', socTitle: 'Financial and Investment Analysts' }, () => [], codes)).toEqual({
      socCode: '13-2051.00',
      socTitle: 'Financial and Investment Analysts',
    })
    expect(importSpecFields({ socCode: '13-2051', socTitle: 'x' }, () => [], codes)).toEqual({ socCode: null, socTitle: null })
    expect(importSpecFields({ socCode: null, socTitle: null }, () => [], codes)).toEqual({ socCode: null, socTitle: null })
  })
})

describe('repost and duplicate import fields', () => {
  const codes = new Set(['CA'])
  it('reads counts and the original first-seen date, only when sent', () => {
    expect(importSpecFields({}, () => [], codes)).toEqual({})
    const out = importSpecFields({ reopenCount: '2', repostCount: 3, duplicateCount: 1, repostFirstSeenAt: '2026-08-02T04:35:08.156822+00:00' }, () => [], codes)
    expect(out.reopenCount).toBe(2)
    expect(out.repostCount).toBe(3)
    expect(out.duplicateCount).toBe(1)
    expect(out.repostFirstSeenAt?.toISOString()).toBe('2026-08-02T04:35:08.156Z')
  })
  it('stores junk as null', () => {
    const out = importSpecFields({ reopenCount: -1, repostCount: 'many', duplicateCount: 1.5, repostFirstSeenAt: 'yesterday' }, () => [], codes)
    expect(out).toEqual({ reopenCount: null, repostCount: null, duplicateCount: null, repostFirstSeenAt: null })
  })
})
