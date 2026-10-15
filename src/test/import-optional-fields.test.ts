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
