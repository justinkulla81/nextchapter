import { describe, expect, it } from 'vitest'
import { classifyGroup, cleanestName, looseKey, strictKey, websiteMatchesName } from './org-duplicates'

describe('looseKey', () => {
  it('groups site codes, .com and US suffixes with the plain name', () => {
    expect(looseKey('Amazon - SF019')).toBe(looseKey('Amazon'))
    expect(looseKey('Amazon.com')).toBe(looseKey('Amazon'))
    expect(looseKey('Skechers USA')).toBe(looseKey('Skechers'))
    expect(looseKey('Intel Corporation - SC11')).toBe(looseKey('Intel'))
  })
  it('does not fold accents into a different word', () => {
    expect(looseKey('Soléa')).not.toBe(looseKey('Sola'))
    expect(looseKey('Nestlé')).toBe(looseKey('Nestle'))
  })
  it('does not treat a leading "US" as decoration', () => {
    expect(looseKey('U.S. Bank')).not.toBe(looseKey('Bank of America'))
  })
})

describe('classifyGroup', () => {
  it('merges pure spelling variants', () => {
    expect(classifyGroup(['Cushman & Wakefield', 'Cushman and Wakefield']).action).toBe('merge')
    expect(classifyGroup(['Owl Ventures, LP', 'Owl Ventures']).action).toBe('merge')
  })
  it('merges abbreviations, tickers and US suffixes', () => {
    expect(classifyGroup(['Boston Consulting Group', 'Boston Consulting Group (BCG)']).action).toBe('merge')
    expect(classifyGroup(['Cadence Bank', 'Cadence Bank (NASDAQ: CADE)']).action).toBe('merge')
    expect(classifyGroup(['Sanofi', 'Sanofi US']).action).toBe('merge')
  })
  it('holds units and locations in brackets', () => {
    expect(classifyGroup(['Massachusetts Institute of Technology', 'Massachusetts Institute of Technology (Lincoln Lab)']).action).toBe('review')
    expect(classifyGroup(['Spirit Airlines (DFW)', 'Spirit Airlines (IAH)']).action).toBe('review')
  })
  it('holds short names that gain a web address', () => {
    expect(classifyGroup(['Apollo', 'Apollo.io']).action).toBe('review')
    expect(classifyGroup(['Salesforce', 'Salesforce.com']).action).toBe('review')
  })
})

describe('cleanestName', () => {
  it('prefers the name without decoration', () => {
    expect(cleanestName(['Amazon - SF019', 'Amazon.com', 'Amazon'])).toBe('Amazon')
    expect(cleanestName(['Sanofi US', 'Sanofi'])).toBe('Sanofi')
  })
})

describe('websiteMatchesName', () => {
  it('matches a name written as its web address', () => {
    expect(websiteMatchesName('https://www.gong.io/', 'Gong.io')).toBe(true)
    expect(websiteMatchesName('https://gong.com', 'Apollo.io')).toBe(false)
  })
})

describe('strictKey', () => {
  it('ignores spacing, & and legal suffixes only', () => {
    expect(strictKey('Bausch & Lomb')).toBe(strictKey('Bausch + Lomb'))
    expect(strictKey('Apollo')).not.toBe(strictKey('Apollo.io'))
  })
})
